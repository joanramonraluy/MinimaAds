// T8 — Maxima message dispatcher.
// Decodes inbound Maxima hex payload and routes by payload.type to the
// corresponding campaign handler. Rhino-safe: var, function(), no arrow,
// no template literals, no trailing commas.
//
// Invoked from main.js MDS.init when msg.event === "MAXIMA".
// msg shape: { event: "MAXIMA", data: { from, to, data: "0x...", ... } }

function onMaxima(msg) {
  if (!msg || !msg.data || !msg.data.data) {
    MDS.log("[MAXIMA] invalid message — no data field");
    return;
  }

  var payload;
  try {
    payload = JSON.parse(hexToUtf8(msg.data.data));
  } catch (e) {
    MDS.log("[MAXIMA] failed to decode payload: " + e);
    return;
  }

  if (!payload || !payload.type) {
    MDS.log("[MAXIMA] payload missing type field");
    return;
  }

  if (payload.type === "CAMPAIGN_ANNOUNCE") {
    handleCampaignAnnounce(payload);
  } else if (payload.type === "CAMPAIGN_PAUSE") {
    handleCampaignPause(payload);
  } else if (payload.type === "CAMPAIGN_FINISH") {
    handleCampaignFinish(payload);
  } else if (payload.type === "CAMPAIGN_RESUME") {
    handleCampaignResume(payload);
  } else if (payload.type === "REQUEST_CAMPAIGN_DATA") {
    handleRequestCampaignData(payload);
  } else if (payload.type === "CAMPAIGN_DATA_RESPONSE") {
    handleCampaignDataResponse(payload);
  } else if (payload.type === "CHANNEL_OPEN_REQUEST") {
    handleChannelOpenRequest(payload, msg.data.from || '');
  } else if (payload.type === "CHANNEL_OPEN") {
    handleChannelOpen(payload);
  } else if (payload.type === "REWARD_REQUEST") {
    handleRewardRequest(payload, msg.data.from || '');
  } else if (payload.type === "REWARD_REJECTED") {
    handleRewardRejected(payload);
  } else if (payload.type === "REWARD_VOUCHER") {
    handleRewardVoucher(payload);
  } else if (payload.type === "VOUCHER_SYNC_REQUEST") {
    handleVoucherSyncRequest(payload);
  } else if (payload.type === "PUBLISHER_REWARD_NOTIFY") {
    handlePublisherRewardNotify(payload, msg.data.from || '');
  } else if (payload.type === "CREATOR_LIVENESS_PING") {
    handleCreatorLivenessPing(payload, msg.data.from || '');
  } else if (payload.type === "CREATOR_LIVENESS_PONG") {
    handleCreatorLivenessPong(payload);
  } else if (payload.type === "PROFILE_REQUEST") {
    handleProfileRequest(payload, msg.data.from || '');
  } else if (payload.type === "PROFILE_RESPONSE") {
    handleProfileResponse(payload);
  } else if (payload.type === "REGISTER_PERMANENT_REQUEST") {
    handleRegisterPermanentRequest(payload, msg.data.from || '');
  } else if (payload.type === "REGISTER_PERMANENT_RESPONSE") {
    MDS.log("[MAXIMA] REGISTER_PERMANENT_RESPONSE received, status=" + (payload.status ? "ok" : "failed"));
  } else if (payload.type === "ESCROW_INFO_REQUEST") {
    handleEscrowInfoRequest(payload, msg.data.from || '');
  } else {
    MDS.log("[MAXIMA] unknown type: " + payload.type);
  }
}

// Handle REGISTER_PERMANENT_REQUEST: execute maxextra action:addpermanent on behalf of requester
// payload: { type: "REGISTER_PERMANENT_REQUEST", publickey: "0x...", requester_contact: "Mx...@host:port" }
// fromRoute: the RSA key of the requesting node (not used for response routing)
function handleRegisterPermanentRequest(payload, fromRoute) {
  if (!payload.publickey) {
    MDS.log("[MAXIMA] REGISTER_PERMANENT_REQUEST missing publickey");
    return;
  }
  var pubkey = payload.publickey;
  var requesterContact = payload.requester_contact || '';
  MDS.log("[MAXIMA] REGISTER_PERMANENT_REQUEST from " + (fromRoute ? fromRoute.substring(0, 20) + "..." : "unknown") + " for key: " + pubkey.substring(0, 20) + "...");

  var cmd = "maxextra action:addpermanent publickey:" + pubkey;
  MDS.log("[MAXIMA] Executing: " + cmd);
  MDS.cmd(cmd, function(cmdRes) {
    var response = {
      type: "REGISTER_PERMANENT_RESPONSE",
      status: cmdRes.status,
      error: cmdRes.error || ''
    };

    if (cmdRes.status) {
      MDS.log("[MAXIMA] REGISTER_PERMANENT executed successfully — permanent route registered");
      response.message = "Permanent route registered at MLS";
    } else {
      MDS.log("[MAXIMA] REGISTER_PERMANENT failed: " + cmdRes.error);
      response.message = cmdRes.error || "Unknown error";
    }

    if (requesterContact) {
      MDS.log("[MAXIMA] Sending REGISTER_PERMANENT_RESPONSE back to " + requesterContact.substring(0, 50) + "...");
      sendMaxima(null, requesterContact, response, function(ok) {
        MDS.log("[MAXIMA] REGISTER_PERMANENT_RESPONSE delivery ok=" + ok);
      });
    } else {
      MDS.log("[MAXIMA] REGISTER_PERMANENT: no requester_contact, skipping response");
    }
  });
}

function handleEscrowInfoRequest(payload, fromRoute) {
  var campaignId = payload.campaign_id || '';
  if (!campaignId) {
    MDS.log("[MAXIMA] ESCROW_INFO_REQUEST missing campaign_id");
    return;
  }

  var campaignSql = "SELECT ID, BUDGET_TOTAL, BUDGET_REMAINING, MAX_PUBLISHER_BUDGET, "
    + "PUBLISHER_BUDGET_SPENT, STATUS FROM CAMPAIGNS WHERE UPPER(ID) = UPPER('"
    + escapeSql(campaignId) + "')";

  sqlQuery(campaignSql, function(err, rows) {
    if (err || !rows || rows.length === 0) {
      MDS.log("[MAXIMA] ESCROW_INFO_REQUEST: campaign not found — " + campaignId);
      if (fromRoute) {
        sendMaxima(null, fromRoute, {type: 'ESCROW_INFO_RESPONSE', campaign_id: campaignId, status: 'not_found', data: {}}, function() {});
      }
      return;
    }

    var row = rows[0];
    var budgetTotal = parseFloat(row.BUDGET_TOTAL) || 0;
    var budgetRemaining = parseFloat(row.BUDGET_REMAINING) || 0;
    var maxPubBudget = parseFloat(row.MAX_PUBLISHER_BUDGET) || 0;
    var pubBudgetSpent = parseFloat(row.PUBLISHER_BUDGET_SPENT) || 0;

    // Query viewer spent from open channels
    var viewerActiveSql = "SELECT COALESCE(SUM(CUMULATIVE_EARNED), 0) AS SPENT FROM CHANNEL_STATE"
      + " WHERE UPPER(CAMPAIGN_ID) = UPPER('" + escapeSql(campaignId) + "') AND ROLE = 'viewer'";

    sqlQuery(viewerActiveSql, function(vaErr, vaRows) {
      var viewerSpentActive = (!vaErr && vaRows && vaRows[0]) ? (parseFloat(vaRows[0].SPENT) || 0) : 0;

      // Query viewer spent from closed/settled channels
      var viewerHistorySql = "SELECT COALESCE(SUM(CUMULATIVE_EARNED), 0) AS SPENT FROM CHANNEL_HISTORY"
        + " WHERE UPPER(CAMPAIGN_ID) = UPPER('" + escapeSql(campaignId) + "') AND ROLE = 'viewer'";

      sqlQuery(viewerHistorySql, function(vhErr, vhRows) {
        var viewerSpentHistory = (!vhErr && vhRows && vhRows[0]) ? (parseFloat(vhRows[0].SPENT) || 0) : 0;
        var viewerBudgetSpent = viewerSpentActive + viewerSpentHistory;
        var escrowLeft = budgetRemaining + (maxPubBudget - pubBudgetSpent);

        var response = {
          type: 'ESCROW_INFO_RESPONSE',
          campaign_id: campaignId,
          status: 'ok',
          data: {
            budget_total: budgetTotal,
            budget_remaining: budgetRemaining,
            max_publisher_budget: maxPubBudget,
            publisher_budget_spent: pubBudgetSpent,
            viewer_budget_spent: viewerBudgetSpent,
            escrow_left: escrowLeft,
            campaign_status: row.STATUS || 'unknown'
          }
        };

        if (fromRoute) {
          sendMaxima(null, fromRoute, response, function(ok) {
            MDS.log("[MAXIMA] ESCROW_INFO_RESPONSE sent ok=" + ok + " campaign=" + campaignId);
          });
        }
      });
    });
  });
}
