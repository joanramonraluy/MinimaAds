// T8 — Campaign Maxima message handlers.
// Persists CAMPAIGN_ANNOUNCE / CAMPAIGN_PAUSE / CAMPAIGN_FINISH events
// via core/campaigns.js and signals the FE. Called from onMaxima in
// maxima.handler.js. Rhino-safe syntax.
//
// Payload schemas: MinimaAds.md §8.3 and §8.5.
// FE signals: MinimaAds.md §8.6 (NEW_CAMPAIGN, CAMPAIGN_UPDATED).

function handleCampaignAnnounce(payload) {
  if (!payload.campaign || !payload.ad || !payload.campaign.id) {
    MDS.log("[CAMPAIGN] ANNOUNCE missing campaign or ad");
    return;
  }
  var campaignId = payload.campaign.id;
  saveCampaign(payload.campaign, payload.ad, function(err) {
    if (err) {
      MDS.log("[CAMPAIGN] saveCampaign failed: " + err);
      return;
    }
    MDS.log("[CAMPAIGN] ANNOUNCE persisted, id: " + campaignId);
    signalFE("NEW_CAMPAIGN", { campaign_id: campaignId });
  });
}

function handleCampaignPause(payload) {
  if (!payload.campaign_id) {
    MDS.log("[CAMPAIGN] PAUSE missing campaign_id");
    return;
  }
  applyStatusChange(payload.campaign_id, "paused");
}

function handleCampaignFinish(payload) {
  if (!payload.campaign_id) {
    MDS.log("[CAMPAIGN] FINISH missing campaign_id");
    return;
  }
  applyStatusChange(payload.campaign_id, "finished");
}

// Returns the data value for a given port in coin.state (array of {port, data} objects).
// Pattern from official Minima mds.js getStateVariable utility.
function getStateVar(states, port) {
  for (var i = 0; i < states.length; i++) {
    if (states[i].port == port) { return states[i].data; }
  }
  return '';
}

// Called from main.js scanEscrowCoins for each coin at ESCROW_ADDRESS.
// Reads STATE(3)=campaign_id_hex, STATE(4)=creator_mx_address.
// If campaign is unknown locally, sends REQUEST_CAMPAIGN_DATA to creator.
// _knownEscrowCoins and MY_MX_ADDRESS are globals defined in main.js.
function processEscrowCoin(coin) {
  var coinId = coin.coinid;
  if (_knownEscrowCoins[coinId]) { return; }
  _knownEscrowCoins[coinId] = true;

  var states = coin.state || [];
  var campaignIdHex     = getStateVar(states, 3);
  var creatorContactHex = getStateVar(states, 4);

  if (!campaignIdHex || !creatorContactHex) {
    MDS.log("[DISCOVERY] Coin missing STATE(3) or STATE(4), skipping: " + coinId);
    return;
  }

  var campaignId    = hexToUtf8(campaignIdHex);
  var creatorMxAddr = hexToUtf8(creatorContactHex);
  MDS.log("[DISCOVERY] coin: " + coinId + " campaignId: " + campaignId + " creatorContact: " + creatorMxAddr);

  getCampaign(campaignId, function(err, campaign) {
    if (campaign) { return; }

    MDS.keypair.get("PENDING_CAMPAIGN_" + campaignId, function(kpRes) {
      var val = kpRes && kpRes.status ? kpRes.value : "";
      MDS.log("[DISCOVERY] keypair check for " + campaignId + ": found=" + (val ? "YES" : "NO"));
      if (val) {
        var data;
        try { data = JSON.parse(val); } catch (ex) {
          MDS.log("[DISCOVERY] keypair parse failed for: " + campaignId);
          return;
        }
        data.campaign.escrow_coinid = coin.coinid;
        MDS.log("[DISCOVERY] found pending campaign in keypair, saving: " + campaignId);
        saveCampaign(data.campaign, data.ad, function(saveErr) {
          if (saveErr) {
            MDS.log("[DISCOVERY] saveCampaign failed: " + saveErr);
            return;
          }
          MDS.log("[DISCOVERY] pending campaign saved: " + campaignId);
          signalFE("NEW_CAMPAIGN", { campaign_id: campaignId });
          MDS.keypair.set("PENDING_CAMPAIGN_" + campaignId, "", function() {});
        });
        return;
      }

      var payload = {
        type: "REQUEST_CAMPAIGN_DATA",
        campaign_id: campaignId,
        requester_mx: MY_MX_ADDRESS
      };
      sendMaxima(null, creatorMxAddr, payload, function(ok) {
        MDS.log("[DISCOVERY] REQUEST_CAMPAIGN_DATA sent for: " + campaignId + " ok: " + ok);
      });
    });
  });
}

// Receives a REQUEST_CAMPAIGN_DATA from a viewer node.
// Looks up the campaign locally and sends a CAMPAIGN_DATA_RESPONSE.
function handleRequestCampaignData(payload) {
  if (!payload.campaign_id || !payload.requester_mx) {
    MDS.log("[CAMPAIGN] REQUEST_CAMPAIGN_DATA missing fields");
    return;
  }
  var campaignId   = payload.campaign_id;
  var requesterMx  = payload.requester_mx;

  getCampaign(campaignId, function(err, campaign) {
    if (err || !campaign) {
      MDS.log("[CAMPAIGN] REQUEST for unknown campaign: " + campaignId);
      return;
    }
    sqlQuery(
      "SELECT * FROM ADS WHERE UPPER(CAMPAIGN_ID) = UPPER('" + escapeSql(campaignId) + "') LIMIT 1",
      function(err2, rows) {
        if (err2 || !rows || rows.length === 0) {
          MDS.log("[CAMPAIGN] REQUEST: no ad for campaign: " + campaignId);
          return;
        }
        var r = rows[0];
        var ad = {
          id: r.ID,
          campaign_id: r.CAMPAIGN_ID,
          title: r.TITLE,
          body: r.BODY,
          cta_label: r.CTA_LABEL,
          cta_url: r.CTA_URL,
          interests: r.INTERESTS
        };
        var c = campaign;
        var campaignObj = {
          id: c.ID,
          creator_address: c.CREATOR_ADDRESS,
          title: c.TITLE,
          budget_total: parseFloat(c.BUDGET_TOTAL),
          budget_remaining: parseFloat(c.BUDGET_REMAINING),
          reward_view: parseFloat(c.REWARD_VIEW),
          reward_click: parseFloat(c.REWARD_CLICK),
          status: c.STATUS,
          created_at: parseInt(c.CREATED_AT),
          expires_at: (c.EXPIRES_AT !== null && c.EXPIRES_AT !== undefined) ? parseInt(c.EXPIRES_AT) : null
        };
        var response = {
          type: "CAMPAIGN_DATA_RESPONSE",
          campaign: campaignObj,
          ad: ad
        };
        sendMaxima(null, requesterMx, response, function(ok) {
          MDS.log("[CAMPAIGN] CAMPAIGN_DATA_RESPONSE sent for: " + campaignId + " ok: " + ok);
        });
      }
    );
  });
}

// CAMPAIGN_DATA_RESPONSE has the same schema as CAMPAIGN_ANNOUNCE.
// Reuse the same handler.
function handleCampaignDataResponse(payload) {
  handleCampaignAnnounce(payload);
}

// Called when the user approves or denies a pending send command from the creator flow.
// msg.data: { uid, accept, status, result }
// result.response.body.txn.outputs[0].coinid = escrow coinId
function onPending(msg) {
  var uid     = msg.data.uid;
  var accepted = msg.data.accept;
  var status  = msg.data.status;
  MDS.log("[PENDING] uid: " + uid + " accepted: " + accepted + " status: " + status);

  if (!accepted || !status) {
    MDS.log("[PENDING] denied or failed, uid: " + uid);
    signalFE("CAMPAIGN_PENDING_DENIED", { uid: uid });
    return;
  }

  var coinId = "";
  var campaignId = "";
  try {
    var body = msg.data.result.response.body;
    coinId = body.txn.outputs[0].coinid;
    var txnState = body.txn.state || [];
    for (var si = 0; si < txnState.length; si++) {
      if (txnState[si].port == 3) { campaignId = hexToUtf8(txnState[si].data); break; }
    }
  } catch (ex) {
    MDS.log("[PENDING] could not extract coinId/campaignId: " + ex);
    return;
  }
  if (!coinId || !campaignId) {
    MDS.log("[PENDING] missing coinId or campaignId");
    return;
  }
  MDS.log("[PENDING] coinId: " + coinId + " campaignId: " + campaignId);

  MDS.keypair.get("PENDING_CAMPAIGN_" + campaignId, function(kpRes) {
    var val = kpRes && kpRes.status ? kpRes.value : "";
    if (!val) {
      MDS.log("[PENDING] no pending campaign data for campaign: " + campaignId);
      return;
    }
    var data;
    try { data = JSON.parse(val); } catch (ex) {
      MDS.log("[PENDING] JSON parse failed: " + ex);
      return;
    }
    var campaign = data.campaign;
    var ad       = data.ad;
    campaign.escrow_coinid = coinId;
    MDS.log("[PENDING] saving campaign: " + campaign.id);
    saveCampaign(campaign, ad, function(err) {
      if (err) {
        MDS.log("[PENDING] saveCampaign failed: " + err);
        return;
      }
      MDS.log("[PENDING] campaign saved: " + campaign.id);
      signalFE("NEW_CAMPAIGN", { campaign_id: campaign.id });
      MDS.keypair.set("PENDING_CAMPAIGN_" + campaign.id, "", function() {});
    });
  });
}

function applyStatusChange(campaignId, status) {
  setCampaignStatus(campaignId, status, function(err) {
    if (err) {
      MDS.log("[CAMPAIGN] setCampaignStatus(" + status + ") failed: " + err);
      return;
    }
    MDS.log("[CAMPAIGN] status updated to " + status + ", id: " + campaignId);
    getCampaign(campaignId, function(err2, campaign) {
      var budget = (campaign && campaign.BUDGET_REMAINING !== undefined)
        ? parseFloat(campaign.BUDGET_REMAINING)
        : 0;
      signalFE("CAMPAIGN_UPDATED", {
        campaign_id: campaignId,
        status: status,
        budget_remaining: budget
      });
    });
  });
}
