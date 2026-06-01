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
  var maxViewerReward = (payload.max_viewer_reward !== undefined && payload.max_viewer_reward !== null)
    ? parseFloat(payload.max_viewer_reward) : null;
  payload.campaign.max_viewer_reward = maxViewerReward;
  if (payload.max_daily_views !== undefined && payload.max_daily_views !== null) {
    payload.campaign.max_daily_views = parseInt(payload.max_daily_views, 10);
  }
  if (payload.max_daily_clicks !== undefined && payload.max_daily_clicks !== null) {
    payload.campaign.max_daily_clicks = parseInt(payload.max_daily_clicks, 10);
  }
  if (payload.cooldown_ms !== undefined && payload.cooldown_ms !== null) {
    payload.campaign.cooldown_ms = parseInt(payload.cooldown_ms, 10);
  }
  var campaignId = payload.campaign.id;

  if (typeof PLATFORM_KEY === 'undefined' || PLATFORM_KEY === null) {
    persistCampaign(payload, campaignId);
    return;
  }

  var payloadPk = payload.platform_key ? payload.platform_key.toUpperCase() : '';
  if (payloadPk !== PLATFORM_KEY.toUpperCase()) {
    MDS.log("[CAMPAIGN] platform_key mismatch, dropping campaign: " + campaignId);
    return;
  }

  var coinId = (payload.campaign.escrow_coinid || '');
  if (!coinId) {
    persistCampaign(payload, campaignId);
    return;
  }

  MDS.cmd("coins coinid:" + coinId + " relevant:false", function(res) {
    if (!res.status || !res.response || res.response.length === 0) {
      MDS.log("[CAMPAIGN] on-chain coin not found for PK verification, accepting: " + campaignId);
      persistCampaign(payload, campaignId);
      return;
    }
    var prevstates = res.response[0].prevstate || [];
    var onChainPk = getStateVar(prevstates, 5);
    if (!onChainPk || onChainPk.toUpperCase() !== PLATFORM_KEY.toUpperCase()) {
      MDS.log("[CAMPAIGN] PREVSTATE(5) mismatch, dropping campaign: " + campaignId);
      return;
    }
    persistCampaign(payload, campaignId);
  });
}

function persistCampaign(payload, campaignId) {
  saveCampaign(payload.campaign, payload.ad, function(err) {
    if (err) {
      MDS.log("[CAMPAIGN] saveCampaign failed: " + err);
      return;
    }
    MDS.log("[CAMPAIGN] ANNOUNCE persisted, id: " + campaignId);
    signalFE("NEW_CAMPAIGN", { campaign_id: campaignId });
    if (typeof _tryOpenPublisherChannelForAllFrames === 'function') {
      _tryOpenPublisherChannelForAllFrames(campaignId);
    }
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

function handleCampaignResume(payload) {
  if (!payload.campaign_id) {
    MDS.log("[CAMPAIGN] RESUME missing campaign_id");
    return;
  }
  applyStatusChange(payload.campaign_id, "active");
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
    if (campaign) {
      // Detect stale publisher data: on-chain STATE(6) has a publisher budget
      // but local DB has MAX_PUBLISHER_BUDGET = 0 (saved with pre-fix code).
      var onChainPubBudget = parseFloat(getStateVar(states, 6) || 0);
      if (onChainPubBudget > 0 && parseFloat(campaign.MAX_PUBLISHER_BUDGET || 0) <= 0) {
        MDS.log("[DISCOVERY] stale MAX_PUBLISHER_BUDGET for: " + campaignId + " — patching DB from on-chain state(" + onChainPubBudget + ")");
        sqlQuery(
          "UPDATE CAMPAIGNS SET MAX_PUBLISHER_BUDGET = " + onChainPubBudget +
          " WHERE UPPER(ID) = UPPER('" + escapeSql(campaignId) + "')",
          function(patchErr) {
            if (patchErr) {
              MDS.log("[DISCOVERY] patch failed: " + patchErr + " — falling back to REQUEST_CAMPAIGN_DATA");
              MDS.keypair.set("CREATOR_MX_" + campaignId, creatorMxAddr, function() {
                var refreshPayload = {
                  type: "REQUEST_CAMPAIGN_DATA",
                  campaign_id: campaignId,
                  requester_mx: MY_MX_ADDRESS
                };
                sendMaxima(null, creatorMxAddr, refreshPayload, function(ok) {
                  MDS.log("[DISCOVERY] refresh REQUEST_CAMPAIGN_DATA sent for: " + campaignId + " ok: " + ok);
                });
              });
            } else {
              MDS.log("[DISCOVERY] MAX_PUBLISHER_BUDGET patched: " + campaignId + " = " + onChainPubBudget);
              signalFE("CAMPAIGN_UPDATED", { campaign_id: campaignId });
            }
          }
        );
      }
      // Sync BUDGET_REMAINING when coinId changed (new change coin) or when the
      // on-chain amount differs from the DB value (stale record from old code that
      // updated ESCROW_COINID but not BUDGET_REMAINING). Runs once per coin per session.
      var onChainAmount = parseFloat(coin.amount || 0);
      var dbRemaining = parseFloat(campaign.BUDGET_REMAINING || 0);
      if (coinId !== (campaign.ESCROW_COINID || '') || Math.abs(onChainAmount - dbRemaining) > 0.000001) {
        MDS.log("[DISCOVERY] budget sync: " + campaignId + " coinId " + (campaign.ESCROW_COINID || '(none)') + " -> " + coinId + " amount=" + onChainAmount + " dbRemaining=" + dbRemaining);
        sqlQuery(
          "UPDATE CAMPAIGNS SET BUDGET_REMAINING = " + onChainAmount +
          ", ESCROW_COINID = '" + escapeSql(coinId) + "'" +
          " WHERE UPPER(ID) = UPPER('" + escapeSql(campaignId) + "')",
          function(syncErr) {
            if (syncErr) {
              MDS.log("[DISCOVERY] budget sync failed: " + syncErr);
            } else {
              MDS.log("[DISCOVERY] budget synced: " + campaignId + " remaining=" + onChainAmount);
              signalFE("CAMPAIGN_UPDATED", { campaign_id: campaignId });
            }
          }
        );
      }
      // V3 only — sync local STATUS from PREVSTATE(7). Silently skipped for V1/V2
      // coins (no port 7). Terminal-state guard prevents re-activating a finished
      // campaign from an older coin read. Runs once per coinId per session.
      var onChainStatusHex = getStateVar(states, 7);
      if (onChainStatusHex) {
        var onChainStatus = '';
        try { onChainStatus = hexToUtf8(onChainStatusHex); } catch (ex) {
          MDS.log("[DISCOVERY] could not decode PREVSTATE(7) for " + campaignId + ": " + ex);
        }
        if (onChainStatus === 'active' || onChainStatus === 'paused' || onChainStatus === 'finished') {
          var localStatus = (campaign.STATUS || '').toLowerCase();
          if (localStatus === 'finished' && onChainStatus !== 'finished') {
            MDS.log("[DISCOVERY] ignoring on-chain status " + onChainStatus + " for finished campaign: " + campaignId);
          } else if (onChainStatus !== localStatus) {
            MDS.log("[DISCOVERY] on-chain status sync: " + campaignId + " " + localStatus + " -> " + onChainStatus);
            setCampaignStatus(campaignId, onChainStatus, function(stErr) {
              if (stErr) {
                MDS.log("[DISCOVERY] setCampaignStatus failed: " + stErr);
                return;
              }
              signalFE("CAMPAIGN_UPDATED", { campaign_id: campaignId, status: onChainStatus });
            });
          }
        } else {
          MDS.log("[DISCOVERY] unknown on-chain status value '" + onChainStatus + "' for " + campaignId);
        }
      }
      return;
    }

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

      // Persist creator Mx so viewer SDK can send CHANNEL_OPEN_REQUEST via to: routing.
      MDS.keypair.set("CREATOR_MX_" + campaignId, creatorMxAddr, function() {});

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
          interests: r.INTERESTS,
          image_data: r.IMAGE_DATA || null,
          show_title: (r.SHOW_TITLE !== null && r.SHOW_TITLE !== undefined) ? parseInt(r.SHOW_TITLE, 10) : 1,
          show_body:  (r.SHOW_BODY !== null && r.SHOW_BODY !== undefined) ? parseInt(r.SHOW_BODY, 10) : 1,
          show_cta:   (r.SHOW_CTA !== null && r.SHOW_CTA !== undefined) ? parseInt(r.SHOW_CTA, 10) : 1,
          bg_color:       r.BG_COLOR       || '#ffffff',
          text_color:     r.TEXT_COLOR     || '#111111',
          image_position:  r.IMAGE_POSITION || 'center',
          image_zoom:      (r.IMAGE_ZOOM !== null && r.IMAGE_ZOOM !== undefined) ? parseFloat(r.IMAGE_ZOOM) : 1.0,
          image_width_pct: (r.IMAGE_WIDTH_PCT !== null && r.IMAGE_WIDTH_PCT !== undefined) ? parseInt(r.IMAGE_WIDTH_PCT, 10) : 40
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
          expires_at: (c.EXPIRES_AT !== null && c.EXPIRES_AT !== undefined) ? parseInt(c.EXPIRES_AT) : null,
          max_viewer_reward: (c.MAX_VIEWER_REWARD !== null && c.MAX_VIEWER_REWARD !== undefined) ? parseFloat(c.MAX_VIEWER_REWARD) : null,
          publisher_reward_view: (c.PUBLISHER_REWARD_VIEW !== null && c.PUBLISHER_REWARD_VIEW !== undefined) ? parseFloat(c.PUBLISHER_REWARD_VIEW) : 0,
          max_publisher_budget: (c.MAX_PUBLISHER_BUDGET !== null && c.MAX_PUBLISHER_BUDGET !== undefined) ? parseFloat(c.MAX_PUBLISHER_BUDGET) : 0,
          publisher_budget_spent: (c.PUBLISHER_BUDGET_SPENT !== null && c.PUBLISHER_BUDGET_SPENT !== undefined) ? parseFloat(c.PUBLISHER_BUDGET_SPENT) : 0,
          max_daily_views: (c.MAX_DAILY_VIEWS !== null && c.MAX_DAILY_VIEWS !== undefined) ? parseInt(c.MAX_DAILY_VIEWS, 10) : 100,
          max_daily_clicks: (c.MAX_DAILY_CLICKS !== null && c.MAX_DAILY_CLICKS !== undefined) ? parseInt(c.MAX_DAILY_CLICKS, 10) : 100,
          cooldown_ms: (c.COOLDOWN_MS !== null && c.COOLDOWN_MS !== undefined) ? parseInt(c.COOLDOWN_MS, 10) : 300000
        };
        var response = {
          type: "CAMPAIGN_DATA_RESPONSE",
          campaign: campaignObj,
          ad: ad,
          max_viewer_reward: campaignObj.max_viewer_reward,
          max_daily_views: campaignObj.max_daily_views,
          max_daily_clicks: campaignObj.max_daily_clicks,
          cooldown_ms: campaignObj.cooldown_ms,
          platform_key: (typeof PLATFORM_KEY !== 'undefined' && PLATFORM_KEY) ? PLATFORM_KEY : null
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
    if (!body || !body.txn || !body.txn.outputs) {
      return;
    }
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

// CREATOR_LIVENESS_PING — received on creator's node from a viewer SDK.
// Responds with CREATOR_LIVENESS_PONG including the current campaign status.
// If EXPIRES_AT has passed, reports 'finished' regardless of DB STATUS.
// MinimaAds.md §8.14. Rhino-safe: var, function(), no arrows, no template literals.
function handleCreatorLivenessPing(payload, senderPk) {
  if (!senderPk) {
    MDS.log("[LIVENESS] PING missing senderPk — ignoring");
    return;
  }
  var campaignId = payload.campaign_id || '';
  var viewerMx   = payload.viewer_mx   || null;
  MDS.log("[LIVENESS] PING from " + senderPk.substring(0, 10) + "...");
  if (!campaignId) {
    var pong = {type: "CREATOR_LIVENESS_PONG", campaign_id: ''};
    sendMaxima(senderPk, viewerMx, pong, function(ok) {
      MDS.log("[LIVENESS] PONG sent ok:" + (ok ? "true" : "false"));
    });
    return;
  }
  getCampaign(campaignId, function(err, campaign) {
    var status = '';
    if (!err && campaign) {
      var now = Date.now();
      var expiresAt = (campaign.EXPIRES_AT !== null && campaign.EXPIRES_AT !== undefined && campaign.EXPIRES_AT !== '')
        ? parseInt(campaign.EXPIRES_AT, 10) : 0;
      if (expiresAt > 0 && now > expiresAt) {
        status = 'finished';
      } else {
        status = campaign.STATUS || '';
      }
    }
    var pong2 = {type: "CREATOR_LIVENESS_PONG", campaign_id: campaignId, status: status};
    sendMaxima(senderPk, viewerMx, pong2, function(ok2) {
      MDS.log("[LIVENESS] PONG sent ok:" + (ok2 ? "true" : "false") + " status:" + status);
    });
  });
}

// ---------------------------------------------------------------------------
// checkCampaignStatuses — called periodically from NEWBLOCK (throttled).
// For each locally-active campaign that has NO open viewer channel, sends a
// CREATOR_LIVENESS_PING to the creator. The reply (CREATOR_LIVENESS_PONG via
// handleCreatorLivenessPong) syncs the local status if the creator has paused
// or finished the campaign. Includes viewer_mx so the creator can route the
// PONG back even if the viewer is not in the creator's Maxima contacts.
// Rhino-safe: var, function(), string concat, MDS.log, no trailing commas.
// ---------------------------------------------------------------------------
function checkCampaignStatuses() {
  var sql = "SELECT DISTINCT c.ID, c.CREATOR_ADDRESS FROM CAMPAIGNS c" +
    " WHERE c.STATUS = 'active'" +
    " AND NOT EXISTS (" +
    "   SELECT 1 FROM CHANNEL_STATE cs" +
    "   WHERE UPPER(cs.CAMPAIGN_ID) = UPPER(c.ID)" +
    "   AND cs.STATUS = 'open'" +
    "   AND cs.ROLE = 'viewer'" +
    " )";
  sqlQuery(sql, function(err, rows) {
    if (err || !rows || rows.length === 0) { return; }
    for (var i = 0; i < rows.length; i++) {
      (function(row) {
        var campaignId = row.ID;
        var creatorPk  = row.CREATOR_ADDRESS || '';
        MDS.keypair.get("CREATOR_MX_" + campaignId, function(kpRes) {
          var creatorMx = (kpRes && kpRes.status && kpRes.value) ? kpRes.value : null;
          if (!creatorPk && !creatorMx) { return; }
          var ping = {
            type:        "CREATOR_LIVENESS_PING",
            campaign_id: campaignId,
            viewer_mx:   MY_MX_ADDRESS
          };
          sendMaxima(creatorPk, creatorMx, ping, function(ok) {
            MDS.log("[LIVENESS] auto-ping campaign: " + campaignId + " ok=" + ok);
          });
        });
      })(rows[i]);
    }
  });
}

// CREATOR_LIVENESS_PONG — received on viewer's node from the creator.
// Syncs the local campaign STATUS from the creator's authoritative value,
// then signals the FE so the SDK can resolve the pending liveness check.
// MinimaAds.md §8.15. Rhino-safe: var, function(), no arrows, no template literals.
function handleCreatorLivenessPong(payload) {
  var campaignId = payload.campaign_id || '';
  var status = payload.status || '';
  MDS.log("[LIVENESS] PONG received for campaign: " + campaignId + " status: " + status);
  if (campaignId && status) {
    getCampaign(campaignId, function(err, campaign) {
      if (!err && campaign && campaign.STATUS !== status) {
        setCampaignStatus(campaignId, status, function(err2) {
          if (!err2) {
            MDS.log("[LIVENESS] local campaign status synced: " + campaignId + " -> " + status);
            signalFE("CAMPAIGN_UPDATED", {campaign_id: campaignId, status: status});
          }
        });
      }
    });
  }
  signalFE("CREATOR_LIVENESS_PONG", {campaign_id: campaignId, status: status});
}

// MA_LOCAL_STATUS — sent by the creator's FE (mycampaigns.js) via MDS.comms.broadcast.
// Updates the campaign STATUS on the creator's own SW DB without needing Maxima.
// Valid statuses: 'active', 'paused', 'finished'.
// Rhino-safe: var, function(), no arrows, no template literals.
function handleLocalStatusChange(payload) {
  if (!payload.campaign_id || !payload.status) {
    MDS.log("[CAMPAIGN] MA_LOCAL_STATUS missing fields");
    return;
  }
  var s = payload.status;
  if (s !== 'active' && s !== 'paused' && s !== 'finished') {
    MDS.log("[CAMPAIGN] MA_LOCAL_STATUS invalid status: " + s);
    return;
  }
  applyStatusChange(payload.campaign_id, s);
}

// checkExpiredCampaigns — called on every NEWBLOCK from service.js.
// Marks any active campaign whose EXPIRES_AT has passed as 'finished'.
// Only runs on the local node — other nodes learn the status via the liveness ping.
// Rhino-safe: var, function(), no arrows, no template literals.
function checkExpiredCampaigns() {
  var now = Date.now();
  sqlQuery(
    "SELECT ID FROM CAMPAIGNS WHERE STATUS = 'active' AND EXPIRES_AT IS NOT NULL AND EXPIRES_AT < " + now,
    function(err, rows) {
      if (err || !rows || rows.length === 0) { return; }
      for (var i = 0; i < rows.length; i++) {
        applyStatusChange(rows[i].ID, 'finished');
      }
    }
  );
}

// ---------------------------------------------------------------------------
// PROFILE_REQUEST — received on creator's node from a viewer FE.
// Reads own Maxima name and icon, responds with PROFILE_RESPONSE (poll:false).
// MinimaAds.md §8.17. Rhino-safe: var, function(), no arrows, no template literals.
// ---------------------------------------------------------------------------
function handleProfileRequest(payload, senderPk) {
  if (!senderPk) {
    MDS.log("[PROFILE] REQUEST missing senderPk — ignoring");
    return;
  }
  // requester_mx lets us route the response via to: when viewer is not in our contacts
  var requesterMx = payload.requester_mx || null;
  MDS.log("[PROFILE] REQUEST from " + senderPk.substring(0, 10) + "...");
  MDS.cmd("maxima action:info", function(res) {
    if (!res.status || !res.response) {
      MDS.log("[PROFILE] maxima action:info failed — cannot respond");
      return;
    }
    var name = res.response.name || "";
    var rawIcon = (res.response.icon && res.response.icon !== "0x00") ? res.response.icon : "";
    // The icon is stored URL-encoded (set via encodeURIComponent in profile.js).
    // Decode it so the viewer can use it directly as img.src.
    var icon = "";
    if (rawIcon) {
      try { icon = decodeURIComponent(rawIcon); } catch (e) { icon = rawIcon; }
    }
    MDS.log("[PROFILE] name:" + name + " icon:" + (icon ? "yes(" + icon.length + "b)" : "none"));
    var response = {
      type: "PROFILE_RESPONSE",
      publickey: MY_MAXIMA_PK,
      name: name,
      icon: icon
    };
    sendMaxima(senderPk, requesterMx, response, function(ok) {
      MDS.log("[PROFILE] RESPONSE sent ok:" + (ok ? "true" : "false"));
    });
  });
}

// ---------------------------------------------------------------------------
// PROFILE_RESPONSE — received on viewer's node after a PROFILE_REQUEST.
// Caches full profile (including large icon) to keypair, then signals FE with
// only publickey + name to avoid MDS.comms.solo size limits on large icons.
// FE reads the icon from keypair when applying the profile to the DOM.
// MinimaAds.md §8.18. Rhino-safe: var, function(), no arrows, no template literals.
// ---------------------------------------------------------------------------
function handleProfileResponse(payload) {
  if (!payload.publickey) {
    MDS.log("[PROFILE] RESPONSE missing publickey — ignoring");
    return;
  }
  var pk = payload.publickey.toUpperCase();
  MDS.log("[PROFILE] RESPONSE received from " + pk.substring(0, 10) + "...");
  var profileStr = JSON.stringify({name: payload.name || "", icon: payload.icon || ""});
  // Cache full profile in keypair; signal FE with name only (icon read from keypair by FE)
  MDS.keypair.set("CREATOR_PROFILE_" + pk, profileStr, function() {
    signalFE("PROFILE_RECEIVED", {publickey: pk, name: payload.name || ""});
  });
}
