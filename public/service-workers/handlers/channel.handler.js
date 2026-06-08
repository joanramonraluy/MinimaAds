// T-CH3 — SW: channel.handler.js
// T-PUB8: all handlers branch on payload.role ('viewer' | 'publisher').
// Handles inbound Maxima messages for the payment channel protocol.
// Called from onMaxima() in maxima.handler.js.
//
// CRITICAL ARCHITECTURE: Channel coin creation (CHANNEL_OPEN_REQUEST) and
// partial tx signing (REWARD_REQUEST) CANNOT run in the SW — they require
// MDS.cmd('txncreate'/'txnsign') which may trigger pending approval and must
// run in the FE. The SW validates state, updates DB, then signals the FE.
//
// CREATOR_MX column stores different values per node:
//   Viewer node: creator's Mx address (to send REWARD_REQUEST / VOUCHER_SYNC_REQUEST)
//   Creator node: viewer's Mx address (to send CHANNEL_OPEN / REWARD_VOUCHER)
//
// Payload schemas: MinimaAds.md §8.8–8.12.
// SW → FE signals: MinimaAds.md §8.13.
// Rhino-safe: var, function(), string concat, MDS.log, no trailing commas.

function handleChannelOpenRequest(payload, senderPk) {
  if (!payload.campaign_id || !payload.viewer_key || !payload.viewer_mx || payload.max_amount === undefined) {
    MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST missing required fields");
    return;
  }

  var campaignId       = payload.campaign_id;
  var viewerKey        = payload.viewer_key;
  var viewerMx         = payload.viewer_mx;
  var maxAmount        = parseFloat(payload.max_amount);
  var viewerWalletAddr = payload.viewer_wallet_addr || '';
  var viewerWalletPK   = payload.viewer_wallet_pk   || '';
  var role             = payload.role || 'viewer';
  var frameId          = payload.frame_id || '';
  var sndrPk           = senderPk || '';

  if (role === 'publisher') {
    if (!frameId) {
      MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST (publisher): missing frame_id");
      return;
    }
    if (sndrPk) {
      if (frameId.toLowerCase().indexOf('builtin:') === 0) {
        var claimedPk = frameId.substring(8);
        // Use viewer_key (MY_MAXIMA_PK sent explicitly) for the check — msg.data.from can
        // differ from MY_MAXIMA_PK when routed via MLS, causing spurious mismatches.
        var publisherSelfKey = viewerKey || sndrPk;
        MDS.log("[CHANNEL] builtin check: claimed=" + claimedPk.substring(18, 28) + " viewerKey=" + (viewerKey ? viewerKey.substring(18, 28) : "EMPTY") + " sndrPk=" + (sndrPk ? sndrPk.substring(18, 28) : "EMPTY"));
        if (claimedPk.toUpperCase() !== publisherSelfKey.toUpperCase()) {
          MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST (publisher): builtin frame_id/viewer_key mismatch — dropping");
          return;
        }
      } else {
        var publisherMxKey = payload.publisher_mx_key || '';
        if (publisherMxKey && publisherMxKey.toUpperCase() !== sndrPk.toUpperCase()) {
          MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST (publisher): publisher_mx_key/sender PK mismatch — dropping");
          return;
        }
      }
    }
    getCampaign(campaignId, function(err, campaign) {
      if (err || !campaign) {
        MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST (publisher): campaign not found: " + campaignId);
        return;
      }
      if (campaign.STATUS !== 'active') {
        MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST (publisher): campaign not active: " + campaignId + " status: " + campaign.STATUS);
        return;
      }
      if (parseFloat(campaign.PUBLISHER_REWARD_VIEW) <= 0) {
        MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST (publisher): campaign has no publisher reward. campaign: " + campaignId);
        return;
      }
      // Budget check: use SUM(CUMULATIVE_EARNED) from all publisher channels — i.e. what
      // has actually been paid out. PUBLISHER_BUDGET_SPENT tracks MAX_AMOUNT reservations
      // (channels opened) which may be higher than actual earnings, incorrectly blocking
      // new publishers. Using CUMULATIVE_EARNED lets multiple publishers participate
      // concurrently as long as actual payouts haven't exhausted MAX_PUBLISHER_BUDGET.
      sqlQuery(
        "SELECT COALESCE(SUM(CUMULATIVE_EARNED), 0) AS EARNED FROM CHANNEL_STATE WHERE " +
        "UPPER(CAMPAIGN_ID) = UPPER('" + escapeSql(campaignId) + "') AND ROLE = 'publisher'",
        function(earnErr, earnRows) {
          var pubEarned    = (earnRows && earnRows.length > 0) ? parseFloat(earnRows[0].EARNED) : 0;
          var pubMaxBudget = parseFloat(campaign.MAX_PUBLISHER_BUDGET || 0) || 0;
          var pubView      = parseFloat(campaign.PUBLISHER_REWARD_VIEW || 0) || 0;
          var pubRemaining = pubMaxBudget - pubEarned;
          // Cap the channel max at remaining budget (publisher may request more than is left)
          var effectiveCap = Math.min(maxAmount, pubRemaining);
          MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST (publisher): budget — max=" + pubMaxBudget + " earned=" + pubEarned + " remaining=" + pubRemaining + " requestedCap=" + maxAmount + " effectiveCap=" + effectiveCap);
          // Reject only if remaining is less than one view's reward
          if (effectiveCap < pubView || effectiveCap <= 0) {
            MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST (publisher): insufficient publisher budget. remaining: " + pubRemaining + " requested: " + maxAmount);
            return;
          }
          // Use the capped value for all subsequent channel operations
          maxAmount = effectiveCap;

      getChannelState(campaignId, viewerKey, 'publisher', function(chErr, existing) {
        if (!chErr && existing && existing.STATUS === 'open') {
          MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST (publisher): channel already open — resending CHANNEL_OPEN. campaign: " + campaignId + " coinId: " + existing.CHANNEL_COINID);
          sendMaxima(viewerKey, viewerMx, {
            type:           "CHANNEL_OPEN",
            campaign_id:    campaignId,
            viewer_key:     viewerKey,
            channel_coinid: existing.CHANNEL_COINID,
            max_amount:     parseFloat(existing.MAX_AMOUNT),
            role:           "publisher",
            frame_id:       frameId
          }, function(ok) {
            MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST (publisher): CHANNEL_OPEN resent ok=" + ok);
          });
          return;
        }
        if (!chErr && existing && existing.STATUS === 'pending') {
          var age = Date.now() - parseInt(existing.CREATED_AT || 0);
          if (age < 300000) {
            MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST (publisher): channel pending — tx in progress, skipping. campaign: " + campaignId);
            return;
          }
          MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST (publisher): stale pending (age=" + age + "ms) — retrying. campaign: " + campaignId);
          if (existing.SPLIT_COINID && existing.SPLIT_COINID !== '') {
            MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST (publisher): split coin known — retrying Tx2 directly. splitCoinId: " + existing.SPLIT_COINID);
            getCampaign(campaignId, function(campErr, camp) {
              if (campErr || !camp) { MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST (publisher): campaign not found for Tx2 retry"); return; }
              swBuildAndPostChannelOpenTx({
                campaignId:    campaignId,
                viewerKey:     viewerKey,
                viewerMx:      viewerMx,
                viewerWalletPK: viewerWalletPK,
                maxAmount:     maxAmount,
                splitCoinId:   existing.SPLIT_COINID,
                walletPK:      camp.ESCROW_WALLET_PK,
                escrowAddr:    ESCROW_ADDRESS_V3 || ESCROW_ADDRESS,
                role:          'publisher',
                frameId:       frameId
              });
            });
            return;
          }
          // Stale pending with no split coin — archive to history before retrying fresh.
          MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST (publisher): stale pending, no split coin — archiving stale record and opening fresh. campaign: " + campaignId);
          settleChannel(campaignId, viewerKey, 'publisher', function(staleSettleErr) {
            if (staleSettleErr) { MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST (publisher): archive stale pending failed: " + staleSettleErr); }
            openChannel(campaignId, viewerKey, viewerMx, maxAmount, 'publisher', frameId, viewerWalletAddr, function(openErr) {
              if (openErr) { MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST (publisher): openChannel (after stale archive) failed: " + openErr); return; }
              sqlQuery(
                "UPDATE CHANNEL_STATE SET VIEWER_WALLET_PK = '" + escapeSql(viewerWalletPK) + "'" +
                " WHERE UPPER(CAMPAIGN_ID) = UPPER('" + escapeSql(campaignId) + "')" +
                " AND UPPER(VIEWER_KEY) = UPPER('" + escapeSql(viewerKey) + "')" +
                " AND ROLE = 'publisher'",
                function() {
                  var bumpSql = "UPDATE CAMPAIGNS SET PUBLISHER_BUDGET_SPENT = COALESCE(PUBLISHER_BUDGET_SPENT, 0) + " + maxAmount +
                    " WHERE UPPER(ID) = UPPER('" + escapeSql(campaignId) + "')";
                  sqlQuery(bumpSql, function(bumpErr) {
                    if (bumpErr) { MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST (publisher): PUBLISHER_BUDGET_SPENT bump failed (after stale archive): " + bumpErr); }
                    MDS.keypair.set("FRAME_PUBLISHER_" + frameId, viewerKey, function() {
                      MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST (publisher): building channel TX after stale archive. campaign: " + campaignId);
                      _swDispatchChannelOpen(campaignId, viewerKey, viewerMx, maxAmount, 'publisher', frameId, viewerWalletPK, viewerWalletAddr);
                    });
                  });
                }
              );
            });
          });
          return;
        }

        openChannel(campaignId, viewerKey, viewerMx, maxAmount, 'publisher', frameId, viewerWalletAddr, function(openErr) {
          if (openErr) {
            MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST (publisher): openChannel failed: " + openErr);
            return;
          }
          sqlQuery(
            "UPDATE CHANNEL_STATE SET VIEWER_WALLET_PK = '" + escapeSql(viewerWalletPK) + "'" +
            " WHERE UPPER(CAMPAIGN_ID) = UPPER('" + escapeSql(campaignId) + "')" +
            " AND UPPER(VIEWER_KEY) = UPPER('" + escapeSql(viewerKey) + "')" +
            " AND ROLE = 'publisher'",
            function() {
              var bumpSql = "UPDATE CAMPAIGNS SET PUBLISHER_BUDGET_SPENT = COALESCE(PUBLISHER_BUDGET_SPENT, 0) + " + maxAmount +
                " WHERE UPPER(ID) = UPPER('" + escapeSql(campaignId) + "')";
              sqlQuery(bumpSql, function(bumpErr) {
                if (bumpErr) {
                  MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST (publisher): PUBLISHER_BUDGET_SPENT bump failed: " + bumpErr);
                }
                MDS.keypair.set("FRAME_PUBLISHER_" + frameId, viewerKey, function() {
                  MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST (publisher): building channel TX in SW. campaign: " + campaignId);
                  _swDispatchChannelOpen(campaignId, viewerKey, viewerMx, maxAmount, 'publisher', frameId, viewerWalletPK, viewerWalletAddr);
                });
              });
            }
          );
        });
      });
        }); // end sqlQuery SUM(CUMULATIVE_EARNED) callback
      });   // end getCampaign callback + call
  } else {
    getCampaign(campaignId, function(err, campaign) {
      if (err || !campaign) {
        MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST: campaign not found: " + campaignId);
        return;
      }
      if (campaign.STATUS !== 'active') {
        MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST: campaign not active: " + campaignId + " status: " + campaign.STATUS);
        if (viewerKey && viewerMx) {
          var _rejStat = campaign.STATUS;
          sendMaxima(viewerKey, viewerMx, {
            type:        "REWARD_REJECTED",
            campaign_id: campaignId,
            reason:      _rejStat
          }, function(ok) {
            MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST: REWARD_REJECTED sent ok=" + ok + " status=" + _rejStat);
          });
        }
        return;
      }
      if (parseFloat(campaign.BUDGET_REMAINING) < maxAmount) {
        MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST: insufficient budget. remaining: " + campaign.BUDGET_REMAINING + " requested: " + maxAmount);
        return;
      }

      MDS.cmd("maxima action:addcontact contact:" + viewerMx, function(addRes) {
        // Optional/informational: contact may already exist; either way routing via
        // to: still works, so a non-true status here is NOT a failure.
        MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST: addcontact viewer (optional, contact may already exist; routing via to: will work) status=" + (addRes ? addRes.status : 'null'));
      });

      getChannelState(campaignId, viewerKey, 'viewer', function(chErr, existing) {
        if (!chErr && existing && existing.STATUS === 'open') {
          var _csAddr = CHANNEL_SCRIPT_ADDRESS || '';
          MDS.cmd("coins address:" + _csAddr, function(_csRes) {
            var _csList = (_csRes && _csRes.status && _csRes.response) ? _csRes.response : [];
            var _coinStillOpen = false;
            for (var _ci = 0; _ci < _csList.length; _ci++) {
              if (_csList[_ci].coinid && _csList[_ci].coinid.toUpperCase() === existing.CHANNEL_COINID.toUpperCase()) {
                _coinStillOpen = true;
                break;
              }
            }
            if (_coinStillOpen) {
              MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST: channel already open — resending CHANNEL_OPEN. campaign: " + campaignId + " coinId: " + existing.CHANNEL_COINID);
              sendMaxima(viewerKey, viewerMx, {
                type:           "CHANNEL_OPEN",
                campaign_id:    campaignId,
                viewer_key:     viewerKey,
                channel_coinid: existing.CHANNEL_COINID,
                max_amount:     parseFloat(existing.MAX_AMOUNT),
                role:           "viewer"
              }, function(ok) {
                MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST: CHANNEL_OPEN resent ok=" + ok);
              });
            } else {
              MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST: coin spent — settling and opening new channel. campaign: " + campaignId);
              settleChannel(campaignId, viewerKey, 'viewer', function(settleErr) {
                if (settleErr) { MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST: settleChannel failed: " + settleErr); }
                openChannel(campaignId, viewerKey, viewerMx, maxAmount, 'viewer', '', viewerWalletAddr, function(openErr) {
                  if (openErr) { MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST: openChannel failed: " + openErr); return; }
                  _signalCampaignUpdated(campaignId);
                  MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST: building channel TX in SW. campaign: " + campaignId + " viewer_mx: " + viewerMx);
                  _swDispatchChannelOpen(campaignId, viewerKey, viewerMx, maxAmount, 'viewer', '', viewerWalletPK, viewerWalletAddr);
                });
              });
            }
          });
          return;
        }
        if (!chErr && existing && existing.STATUS === 'pending') {
          var age = Date.now() - parseInt(existing.CREATED_AT || 0);
          if (age < 300000) {
            MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST: channel pending — tx in progress, skipping. campaign: " + campaignId);
            return;
          }
          MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST: stale pending (age=" + age + "ms) — retrying. campaign: " + campaignId);
          if (existing.SPLIT_COINID && existing.SPLIT_COINID !== '') {
            MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST: split coin known — retrying Tx2 directly. splitCoinId: " + existing.SPLIT_COINID);
            getCampaign(campaignId, function(campErr, camp) {
              if (campErr || !camp) { MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST: campaign not found for Tx2 retry"); return; }
              swBuildAndPostChannelOpenTx({
                campaignId:    campaignId,
                viewerKey:     viewerKey,
                viewerMx:      viewerMx,
                viewerWalletPK: viewerWalletPK,
                maxAmount:     maxAmount,
                splitCoinId:   existing.SPLIT_COINID,
                walletPK:      camp.ESCROW_WALLET_PK,
                escrowAddr:    ESCROW_ADDRESS_V3 || ESCROW_ADDRESS,
                role:          'viewer',
                frameId:       ''
              });
            });
            return;
          }
          // Stale pending with no split coin — archive to history before retrying fresh.
          MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST: stale pending, no split coin — archiving stale record and opening fresh. campaign: " + campaignId);
          settleChannel(campaignId, viewerKey, 'viewer', function(staleSettleErr) {
            if (staleSettleErr) { MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST: archive stale pending failed: " + staleSettleErr); }
            openChannel(campaignId, viewerKey, viewerMx, maxAmount, 'viewer', '', viewerWalletAddr, function(openErr) {
              if (openErr) { MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST: openChannel (after stale archive) failed: " + openErr); return; }
              _signalCampaignUpdated(campaignId);
              MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST: building channel TX after stale archive. campaign: " + campaignId);
              _swDispatchChannelOpen(campaignId, viewerKey, viewerMx, maxAmount, 'viewer', '', viewerWalletPK, viewerWalletAddr);
            });
          });
          return;
        }

        openChannel(campaignId, viewerKey, viewerMx, maxAmount, 'viewer', '', viewerWalletAddr, function(openErr) {
          if (openErr) {
            MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST: openChannel failed: " + openErr);
            return;
          }
          _signalCampaignUpdated(campaignId);
          MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST: building channel TX in SW. campaign: " + campaignId + " viewer_mx: " + viewerMx);
          _swDispatchChannelOpen(campaignId, viewerKey, viewerMx, maxAmount, 'viewer', '', viewerWalletPK, viewerWalletAddr);
        });
      });
    });
  }
}

function _signalCampaignUpdated(campaignId) {
  getCampaign(campaignId, function(err, campaign) {
    if (err || !campaign) {
      MDS.log("[CHANNEL] _signalCampaignUpdated: campaign not found. campaign: " + campaignId);
      return;
    }
    signalFE("CAMPAIGN_UPDATED", {
      campaign_id: campaignId,
      status: campaign.STATUS,
      budget_remaining: parseFloat(campaign.BUDGET_REMAINING || 0)
    });
  });
}

function handleChannelOpen(payload) {
  if (!payload.campaign_id || !payload.viewer_key || !payload.channel_coinid) {
    MDS.log("[CHANNEL] CHANNEL_OPEN missing required fields");
    return;
  }

  var campaignId    = payload.campaign_id;
  var viewerKey     = payload.viewer_key;
  var channelCoinId = payload.channel_coinid;
  var maxAmount     = parseFloat(payload.max_amount) || 0;
  var role          = payload.role || 'viewer';
  var frameId       = payload.frame_id || '';
  if (frameId && (frameId.toUpperCase().indexOf('0X') === 0 || frameId.indexOf(':') === -1)) {
    frameId = 'builtin:' + frameId.toUpperCase();
  }
  var now           = Date.now();

  MDS.keypair.get("CREATOR_MX_" + campaignId, function(kpRes) {
    var _cmxRaw = (kpRes && kpRes.status && kpRes.value) ? kpRes.value : null;
    var creatorMx = (_cmxRaw && (_cmxRaw.indexOf("Mx") === 0 || _cmxRaw.indexOf("MAX#") === 0)) ? _cmxRaw : '';
    MDS.keypair.get("VIEWER_WALLET_ADDR_" + campaignId, function(waRes) {
      var viewerWalletAddr = (waRes && waRes.status && waRes.value) ? waRes.value : '';
      // Archive any existing channel for this campaign+viewer+role before overwriting,
      // so the old record is preserved in CHANNEL_HISTORY.
      getChannelState(campaignId, viewerKey, role, function(gsErr, existing) {
        if (!gsErr && existing && (existing.STATUS === 'open' || existing.STATUS === 'pending') &&
            existing.CHANNEL_COINID !== channelCoinId) {
          MDS.log("[CHANNEL] CHANNEL_OPEN: archiving existing " + existing.STATUS + " channel before new open. campaign: " + campaignId + " old coin: " + existing.CHANNEL_COINID);
          settleChannel(campaignId, viewerKey, role, function(archErr) {
            if (archErr) { MDS.log("[CHANNEL] CHANNEL_OPEN: archive old channel failed (non-fatal): " + archErr); }
            _doChannelOpenUpsert(campaignId, viewerKey, role, channelCoinId, maxAmount, now, creatorMx, viewerWalletAddr, frameId);
          });
        } else {
          _doChannelOpenUpsert(campaignId, viewerKey, role, channelCoinId, maxAmount, now, creatorMx, viewerWalletAddr, frameId);
        }
      });
    });
  });
}

function _doChannelOpenUpsert(campaignId, viewerKey, role, channelCoinId, maxAmount, now, creatorMx, viewerWalletAddr, frameId) {
      var sql = "MERGE INTO CHANNEL_STATE " +
        "(CAMPAIGN_ID, VIEWER_KEY, ROLE, FRAME_ID, CREATOR_MX, CHANNEL_COINID, MAX_AMOUNT, " +
        "CUMULATIVE_EARNED, LATEST_TX_HEX, STATUS, CREATED_AT, VIEWER_WALLET_ADDR) " +
        "KEY (CAMPAIGN_ID, VIEWER_KEY, ROLE) VALUES (" +
        "'" + escapeSql(campaignId) + "'," +
        "'" + escapeSql(viewerKey) + "'," +
        "'" + escapeSql(role) + "'," +
        "'" + escapeSql(frameId || '') + "'," +
        "'" + escapeSql(creatorMx) + "'," +
        "'" + escapeSql(channelCoinId) + "'," +
        maxAmount + "," +
        "0," +
        "''," +
        "'open'," +
        now + "," +
        "'" + escapeSql(viewerWalletAddr) + "'" +
        ")";
      sqlQuery(sql, function(err) {
      if (err) {
        MDS.log("[CHANNEL] CHANNEL_OPEN: upsert failed: " + err);
        return;
      }
      MDS.log("[CHANNEL] CHANNEL_OPEN: channel activated. campaign: " + campaignId + " coinId: " + channelCoinId + " role: " + role);
      signalFE("CHANNEL_OPENED", {
        campaign_id:    campaignId,
        channel_coinid: channelCoinId,
        max_amount:     maxAmount
      });
      MDS.keypair.get("PENDING_REWARD_" + campaignId, function(prRes) {
        if (!prRes || !prRes.status || !prRes.value) { return; }
        var pending;
        try { pending = JSON.parse(prRes.value); } catch(e) { return; }
        if (!pending || !pending.event_id || !pending.creator_address) { return; }
        MDS.keypair.set("PENDING_REWARD_" + campaignId, '', function() {});
        MDS.keypair.get("CREATOR_MX_" + campaignId, function(mxRes) {
          var creatorMxInner = (mxRes && mxRes.status && mxRes.value) ? mxRes.value : null;
          var rewardPayload = {
            type:          "REWARD_REQUEST",
            campaign_id:   campaignId,
            viewer_key:    MY_MAXIMA_PK,
            event_id:      pending.event_id,
            cumulative:    pending.cumulative,
            role:          role,
            publisher_key: pending.publisher_key || "",
            frame_id:      pending.frame_id || "",
            publisher_mx:  pending.publisher_mx || ""
          };
          // Fix 3a: persist publisher_mx so subsequent REWARD_REQUESTs (sent
          // after the channel is already open, via _sendRewardRequest) can look
          // it up without needing MINIMAADS_CREATOR_ROUTE set on this viewer node.
          if (pending.publisher_mx) {
            MDS.keypair.set("PUBLISHER_MX_" + campaignId, pending.publisher_mx, function() {});
          }
          sendMaxima(pending.creator_address, creatorMxInner, rewardPayload, function(ok) {
            MDS.log("[CHANNEL] CHANNEL_OPEN: auto REWARD_REQUEST sent cumulative=" + pending.cumulative + " ok=" + ok);
          });
        });
      });
    });
}

function handleRewardRequest(payload, senderPk) {
  if (!payload.campaign_id || !payload.viewer_key || !payload.event_id || payload.cumulative === undefined) {
    MDS.log("[CHANNEL] REWARD_REQUEST missing required fields");
    return;
  }

  var campaignId   = payload.campaign_id;
  var viewerKey    = payload.viewer_key;
  var eventId      = payload.event_id;
  var cumulative   = parseFloat(payload.cumulative);
  var sndrPk       = senderPk || '';

  getCampaign(campaignId, function(campErr, campaign) {
    if (campErr || !campaign) {
      MDS.log("[CHANNEL] REWARD_REQUEST: campaign not found: " + campaignId);
      return;
    }
    if (campaign.STATUS !== 'active') {
      MDS.log("[CHANNEL] REWARD_REQUEST: campaign not active (" + campaign.STATUS + "), rejecting: " + campaignId);
      if (sndrPk) {
        var _rejStatus = campaign.STATUS;
        var _rejRole   = payload.role || 'viewer';
        getChannelState(campaignId, viewerKey, _rejRole, function(chErr, ch) {
          var _viewerMx = (!chErr && ch && ch.CREATOR_MX) ? ch.CREATOR_MX : null;
          sendMaxima(sndrPk, _viewerMx, {
            type:        "REWARD_REJECTED",
            campaign_id: campaignId,
            reason:      _rejStatus,
            event_id:    eventId || ''
          }, function(ok) {
            MDS.log("[CHANNEL] REWARD_REJECTED sent ok=" + ok + " mx=" + (_viewerMx ? 'yes' : 'no') + " status=" + _rejStatus);
          });
        });
      }
      return;
    }
    _handleRewardRequestInner(payload, campaignId, viewerKey, eventId, cumulative);
  });
}

// ---------------------------------------------------------------------------
// handleRewardRejected — runs on the VIEWER node.
// Received when the creator rejects a REWARD_REQUEST because the campaign is
// paused or finished. Updates the local campaign status so selectAd() and
// validateView() stop serving and tracking the campaign. Signals the FE so
// the SDK can refresh the liveness cache immediately.
// Rhino-safe: var, function(), string concat, MDS.log, no trailing commas.
// ---------------------------------------------------------------------------
function handleRewardRejected(payload) {
  if (!payload.campaign_id || !payload.reason) {
    MDS.log("[CHANNEL] REWARD_REJECTED missing fields");
    return;
  }
  var campaignId = payload.campaign_id;
  var reason     = payload.reason;
  if (reason !== 'paused' && reason !== 'finished') {
    MDS.log("[CHANNEL] REWARD_REJECTED unknown reason: " + reason);
    return;
  }
  var rejEventId = payload.event_id || '';
  MDS.log("[CHANNEL] REWARD_REJECTED received for campaign: " + campaignId + " reason: " + reason);
  if (rejEventId) {
    sqlQuery("DELETE FROM REWARD_EVENTS WHERE UPPER(ID) = UPPER('" + escapeSql(rejEventId) + "')", function() {});
  }
  getCampaign(campaignId, function(err, campaign) {
    if (err || !campaign) {
      MDS.log("[CHANNEL] REWARD_REJECTED: campaign not found locally: " + campaignId);
      return;
    }
    if (campaign.STATUS === reason) {
      signalFE("CAMPAIGN_UPDATED", {campaign_id: campaignId, status: reason});
      return;
    }
    setCampaignStatus(campaignId, reason, function(err2) {
      if (err2) {
        MDS.log("[CHANNEL] REWARD_REJECTED: setCampaignStatus failed: " + err2);
        return;
      }
      MDS.log("[CHANNEL] REWARD_REJECTED: campaign synced to " + reason + " id: " + campaignId);
      signalFE("CAMPAIGN_UPDATED", {campaign_id: campaignId, status: reason});
    });
  });
}

function _handleRewardRequestInner(payload, campaignId, viewerKey, eventId, cumulative) {
  var role         = payload.role || 'viewer';
  var frameId      = payload.frame_id || '';
  var publisherKey = payload.publisher_key || '';
  var publisherMx  = payload.publisher_mx || '';
  MDS.log("[CHANNEL] _handleRewardRequestInner received: frameId=" + frameId + " publisherKey=" + (publisherKey ? publisherKey.substring(0, 16) + '...' : '(empty)') + " publisherMx=" + (publisherMx ? 'present' : 'absent'));

  getChannelState(campaignId, viewerKey, role, function(err, channel) {
    if (err || !channel) {
      MDS.log("[CHANNEL] REWARD_REQUEST: channel not found. campaign: " + campaignId + " viewer_key: " + viewerKey + " role: " + role);
      return;
    }
    if (channel.STATUS !== 'open' && channel.STATUS !== 'settled') {
      MDS.log("[CHANNEL] REWARD_REQUEST: channel not active. status: " + channel.STATUS + " role: " + role);
      return;
    }
    if (cumulative > parseFloat(channel.MAX_AMOUNT)) {
      MDS.log("[CHANNEL] REWARD_REQUEST: cumulative exceeds MAX_AMOUNT. cumulative: " + cumulative + " max: " + channel.MAX_AMOUNT);
      return;
    }

    isDuplicate(eventId, function(isDup) {
      if (isDup) {
        MDS.log("[CHANNEL] REWARD_REQUEST: duplicate event_id: " + eventId);
        return;
      }

      var channelCoinId  = channel.CHANNEL_COINID || '';
      var channelFrameId = channel.FRAME_ID || frameId;

      if (!channelCoinId) {
        MDS.log("[CHANNEL] REWARD_REQUEST: no CHANNEL_COINID on record, cannot queue. campaign: " + campaignId);
        return;
      }

      var _chAddr = CHANNEL_SCRIPT_ADDRESS || '';
      if (!_chAddr) {
        MDS.log("[CHANNEL] REWARD_REQUEST: CHANNEL_SCRIPT_ADDRESS not set, cannot check coin. campaign: " + campaignId);
        return;
      }
      MDS.cmd("coins address:" + _chAddr, function(coinRes) {
        var coinList = (coinRes && coinRes.status && coinRes.response) ? coinRes.response : [];
        var indexed = false;
        for (var ci = 0; ci < coinList.length; ci++) {
          if (coinList[ci].coinid && coinList[ci].coinid.toUpperCase() === channelCoinId.toUpperCase()) {
            indexed = true;
            break;
          }
        }
        if (indexed) {
          if (role === 'publisher') {
            MDS.log("[CHANNEL] REWARD_REQUEST (publisher): coin indexed. building publisher voucher in SW. campaign: " + campaignId + " cumulative: " + cumulative);
            _swDispatchVoucher(campaignId, viewerKey, channel.CREATOR_MX, eventId, cumulative, channel, 'publisher', channelFrameId);
          } else {
            MDS.log("[CHANNEL] REWARD_REQUEST: coin indexed. building viewer voucher in SW. campaign: " + campaignId + " cumulative: " + cumulative);
            _swDispatchVoucher(campaignId, viewerKey, channel.CREATOR_MX, eventId, cumulative, channel, 'viewer', '');
            if (channelFrameId || publisherKey) { _maybeGeneratePublisherVoucher(campaignId, channelFrameId, eventId, publisherKey, publisherMx); }
          }
        } else {
          var pending = JSON.stringify({
            campaign_id:    campaignId,
            viewer_key:     viewerKey,
            viewer_mx:      channel.CREATOR_MX,
            event_id:       eventId,
            cumulative:     cumulative,
            channel_coinid: channelCoinId,
            role:           role,
            frame_id:       channelFrameId,
            publisher_key:  publisherKey,
            publisher_mx:   publisherMx
          });
          var kpKey = "PENDING_VOUCHER_" + campaignId + "_" + viewerKey.toUpperCase() + "_" + role.toUpperCase();
          MDS.keypair.set(kpKey, pending, function() {
            MDS.log("[CHANNEL] coin not yet indexed, queuing voucher for NEWBLOCK: " + campaignId + " coinid: " + channelCoinId + " role: " + role);
          });
        }
      });
    });
  });
}

function _continueRewardVoucher(campaignId, viewerKey, eventId, cumulative, txHex, role, frameId, oldCumulative, viewerWalletAddr) {
  updateChannelVoucher(campaignId, viewerKey, role, cumulative, txHex, function(err) {
    if (err) {
      MDS.log("[CHANNEL] REWARD_VOUCHER: updateChannelVoucher failed: " + err);
      return;
    }

    var now = Date.now();
    var dedupSql = "MERGE INTO DEDUP_LOG (ID, LOGGED_AT) KEY (ID) VALUES ('" + escapeSql(eventId) + "'," + now + ")";
    sqlQuery(dedupSql, function(dedupErr) {
      if (dedupErr) {
        MDS.log("[CHANNEL] REWARD_VOUCHER: DEDUP_LOG insert failed: " + dedupErr);
      }
      MDS.log("[CHANNEL] REWARD_VOUCHER: voucher stored. campaign: " + campaignId + " cumulative: " + cumulative + " role: " + role);
      if (role === 'publisher') {
        if (!frameId) {
          MDS.log("[CHANNEL] REWARD_VOUCHER (publisher): no frame_id — cannot create reward event. campaign: " + campaignId);
          return;
        }
        if (frameId && (frameId.toUpperCase().indexOf('0X') === 0 || frameId.indexOf(':') === -1)) {
          frameId = 'builtin:' + frameId.toUpperCase();
        }
        getCampaign(campaignId, function(campErr, campaign) {
          if (campErr || !campaign) {
            MDS.log("[CHANNEL] REWARD_VOUCHER (publisher): campaign not found: " + campaignId);
            return;
          }
          var pubAmount = parseFloat(campaign.PUBLISHER_REWARD_VIEW) || 0;
          if (!(pubAmount > 0)) {
            MDS.log("[CHANNEL] REWARD_VOUCHER (publisher): no publisher reward on campaign: " + campaignId);
            return;
          }
          sqlQuery(
            "SELECT ID FROM ADS WHERE UPPER(CAMPAIGN_ID) = UPPER('" + escapeSql(campaignId) + "')",
            function(adErr, adRows) {
              var adId = (adRows && adRows.length > 0) ? adRows[0].ID : '';
              getFrame(frameId, function(frErr, frame) {
                var userAddr = (frame && frame.PUBLISHER_KEY) ? frame.PUBLISHER_KEY : frameId;
                var reParams = {
                  id:           'pub-' + eventId,
                  campaign_id:  campaignId,
                  ad_id:        adId,
                  user_address: userAddr,
                  type:         'publisher_view',
                  amount:       pubAmount,
                  publisher_id: frameId
                };
                createRewardEvent(reParams, function(evtErr, evt) {
                  if (evtErr || !evt) {
                    MDS.log("[CHANNEL] REWARD_VOUCHER (publisher): createRewardEvent failed: " + evtErr);
                    return;
                  }
                  MDS.log("[CHANNEL] REWARD_VOUCHER (publisher): reward event created. campaign: " + campaignId + " frame: " + frameId + " amount: " + pubAmount);
                  incrementFrameEarnings(frameId, pubAmount, function() {});
                  signalFE("PUBLISHER_REWARD_CONFIRMED", {
                    event_id:    evt.id,
                    amount:      pubAmount,
                    frame_id:    frameId,
                    campaign_id: campaignId
                  });
                });
              });
            }
          );
        });
      } else {
        var delta = cumulative - oldCumulative;
        if (!(delta > 0)) {
          signalFE("VOUCHER_RECEIVED", {
            campaign_id: campaignId,
            cumulative:  cumulative,
            event_id:    eventId
          });
          return;
        }
        var reTimestamp = Date.now();
        var reId = eventId;
        sqlQuery(
          "SELECT ID FROM ADS WHERE UPPER(CAMPAIGN_ID) = UPPER('" + escapeSql(campaignId) + "')",
          function(adErr, adRows) {
            var adId = (adRows && adRows.length > 0) ? adRows[0].ID : '';
            var reSql = "MERGE INTO REWARD_EVENTS "
              + "(ID, CAMPAIGN_ID, AD_ID, USER_ADDRESS, TYPE, AMOUNT, TIMESTAMP, PUBLISHER_ID) "
              + "KEY (ID) VALUES ("
              + "'" + escapeSql(reId) + "',"
              + "'" + escapeSql(campaignId) + "',"
              + "'" + escapeSql(adId) + "',"
              + "'" + escapeSql(viewerKey) + "',"
              + "'view',"
              + delta + ","
              + reTimestamp + ","
              + "NULL"
              + ")";
            sqlQuery(reSql, function(reErr) {
              if (reErr) { MDS.log("[CHANNEL] REWARD_VOUCHER: REWARD_EVENTS insert failed: " + reErr); }
              // Use viewerKey as the profile identity so getUserProfile(MY_ADDRESS) on the FE
              // finds the row. viewerKey = MY_MAXIMA_PK for comms-handler channels, which is
              // the same key the FE uses as MY_ADDRESS. viewerWalletAddr (coinbase wallet) is a
              // different key type and never matches what the FE queries.
              var profKey = viewerKey;
              sqlQuery(
                "SELECT TOTAL_EARNED FROM USER_PROFILE WHERE UPPER(ADDRESS) = UPPER('" + escapeSql(profKey) + "')",
                function(pErr, pRows) {
                  var pSql;
                  if (pRows && pRows.length > 0) {
                    pSql = "UPDATE USER_PROFILE"
                      + " SET TOTAL_EARNED = COALESCE(TOTAL_EARNED, 0) + " + delta
                      + ", LAST_REWARD_AT = " + reTimestamp
                      + " WHERE UPPER(ADDRESS) = UPPER('" + escapeSql(profKey) + "')";
                  } else {
                    pSql = "INSERT INTO USER_PROFILE (ADDRESS, INTERESTS, TOTAL_EARNED, LAST_REWARD_AT) VALUES ("
                      + "'" + escapeSql(profKey) + "', NULL, " + delta + ", " + reTimestamp + ")";
                  }
                  sqlQuery(pSql, function(profErr) {
                    if (profErr) { MDS.log("[CHANNEL] REWARD_VOUCHER: USER_PROFILE update failed: " + profErr); }
                    signalFE("VOUCHER_RECEIVED", {
                      campaign_id: campaignId,
                      cumulative:  cumulative,
                      event_id:    eventId
                    });
                  });
                }
              );
            });
          }
        );
      }
    });
  });
}

function handleRewardVoucher(payload) {
  if (!payload.campaign_id || !payload.viewer_key || !payload.event_id || payload.cumulative === undefined || !payload.tx_hex) {
    MDS.log("[CHANNEL] REWARD_VOUCHER missing required fields");
    return;
  }

  var campaignId = payload.campaign_id;
  var viewerKey  = payload.viewer_key;
  var eventId    = payload.event_id;
  var cumulative = parseFloat(payload.cumulative);
  var txHex      = payload.tx_hex;
  var role       = payload.role || 'viewer';
  var frameId    = payload.frame_id || '';

  if (role !== 'publisher') {
    getChannelState(campaignId, viewerKey, role, function(csErr, chState) {
      var oldCumulative = chState ? (parseFloat(chState.CUMULATIVE_EARNED) || 0) : 0;
      var viewerWalletAddr = chState ? (chState.VIEWER_WALLET_ADDR || '') : '';
      _continueRewardVoucher(campaignId, viewerKey, eventId, cumulative, txHex, role, frameId, oldCumulative, viewerWalletAddr);
    });
    return;
  }
  _continueRewardVoucher(campaignId, viewerKey, eventId, cumulative, txHex, role, frameId, 0, '');
}

function handleVoucherSyncRequest(payload) {
  if (!payload.campaign_id || !payload.viewer_key) {
    MDS.log("[CHANNEL] VOUCHER_SYNC_REQUEST missing required fields");
    return;
  }

  var campaignId = payload.campaign_id;
  var viewerKey  = payload.viewer_key;
  var role       = payload.role || 'viewer';

  getChannelState(campaignId, viewerKey, role, function(err, channel) {
    if (err || !channel) {
      MDS.log("[CHANNEL] VOUCHER_SYNC_REQUEST: channel not found. campaign: " + campaignId);
      return;
    }

    var viewerMx = channel.CREATOR_MX;

    if (channel.LATEST_TX_HEX && channel.LATEST_TX_HEX !== '') {
      MDS.log("[CHANNEL] VOUCHER_SYNC_REQUEST: resending voucher. campaign: " + campaignId);
      sendMaxima(viewerKey, viewerMx, {
        type:        "REWARD_VOUCHER",
        campaign_id: campaignId,
        viewer_key:  viewerKey,
        event_id:    "sync_" + Date.now(),
        cumulative:  parseFloat(channel.CUMULATIVE_EARNED),
        tx_hex:      channel.LATEST_TX_HEX
      }, function(ok) {
        MDS.log("[CHANNEL] VOUCHER_SYNC_REQUEST: voucher resent ok=" + ok);
      });
    } else {
      MDS.log("[CHANNEL] VOUCHER_SYNC_REQUEST: no voucher yet, resending CHANNEL_OPEN. campaign: " + campaignId);
      sendMaxima(viewerKey, viewerMx, {
        type:           "CHANNEL_OPEN",
        campaign_id:    campaignId,
        viewer_key:     viewerKey,
        channel_coinid: channel.CHANNEL_COINID,
        max_amount:     parseFloat(channel.MAX_AMOUNT),
        role:           role
      }, function(ok) {
        MDS.log("[CHANNEL] VOUCHER_SYNC_REQUEST: CHANNEL_OPEN resent ok=" + ok);
      });
    }
  });
}

function logPendingChannelState() {
  var sql = "SELECT CAMPAIGN_ID, SUM(CUMULATIVE_EARNED) AS TOTAL_PENDING, COUNT(*) AS CHANNELS"
          + " FROM CHANNEL_STATE WHERE STATUS = 'open' GROUP BY CAMPAIGN_ID";
  sqlQuery(sql, function(err, rows) {
    if (err) {
      MDS.log("[CHANNEL] logPendingChannelState error: " + err);
      return;
    }
    if (!rows || rows.length === 0) {
      return;
    }
    for (var i = 0; i < rows.length; i++) {
      MDS.log("[CHANNEL] Pending — campaign: " + rows[i].CAMPAIGN_ID
        + " total: " + rows[i].TOTAL_PENDING
        + " channels: " + rows[i].CHANNELS);
    }
  });
}

// ---------------------------------------------------------------------------
// checkPendingChannelOpens — called on every NEWBLOCK from service.js.
// Reads PENDING_CHOPEN_QUEUE (JSON array of swBuildAndPostChannelOpenTx ctx objects).
// For each entry, checks if the split coin is now indexed. If yes, retries Tx2
// (channel-open) and removes the entry from the queue. Rhino-safe.
// ---------------------------------------------------------------------------
function checkPendingChannelOpens() {
  sqlQuery(
    "SELECT DISTINCT dpr.CAMPAIGN_ID, dpr.FRAME_ID, cs.VIEWER_KEY " +
    "FROM DEFERRED_PUB_REWARDS dpr " +
    "INNER JOIN CHANNEL_STATE cs ON UPPER(dpr.CAMPAIGN_ID) = UPPER(cs.CAMPAIGN_ID) " +
    "AND UPPER(dpr.FRAME_ID) = UPPER(cs.FRAME_ID) " +
    "AND cs.ROLE = 'publisher' AND cs.STATUS = 'open'",
    function(retryErr, retryRows) {
      if (!retryErr && retryRows && retryRows.length > 0) {
        for (var _ri = 0; _ri < retryRows.length; _ri++) {
          (function(_r) {
            _replayDeferredPublisherRewards(_r.CAMPAIGN_ID, _r.FRAME_ID, _r.VIEWER_KEY);
          })(retryRows[_ri]);
        }
      }
    }
  );
  MDS.keypair.get("PENDING_CHOPEN_QUEUE", function(qRes) {
    if (!qRes || !qRes.status || !qRes.value) { return; }
    var queue = [];
    try { queue = JSON.parse(qRes.value); } catch (e) { return; }
    if (queue.length === 0) { return; }
    MDS.log("[CHANNEL] checkPendingChannelOpens: " + queue.length + " pending channel open(s)");
    _retryPendingChOpen(queue, 0, [], []);
  });
}

function _retryPendingChOpen(queue, i, remaining, deferred) {
  if (i >= queue.length) {
    // Persist the surviving queue first, THEN dispatch retries. The retries
    // may re-enqueue (needsSplit or splitCoinId entries) and we don't want
    // this final write to clobber those new pushes.
    MDS.keypair.set("PENDING_CHOPEN_QUEUE", JSON.stringify(remaining), function() {
      for (var d = 0; d < deferred.length; d++) {
        var dctx = deferred[d];
        if (dctx.__kind === 'split') {
          swBuildAndPostChannelTx(dctx.ctx);
        } else if (dctx.__kind === 'open') {
          swBuildAndPostChannelOpenTx(dctx.ctx);
        }
      }
    });
    return;
  }
  var ctx = queue[i];
  if (!ctx) {
    _retryPendingChOpen(queue, i + 1, remaining, deferred);
    return;
  }
  // Entries flagged needsSplit failed Tx1 (escrow coin was in mempool from a
  // prior pending split). Retry the full split+open flow with the current
  // ESCROW_COINID from CAMPAIGNS — which by now points to the change coin
  // produced by the earlier split that has since confirmed.
  if (ctx.needsSplit) {
    MDS.log("[CHANNEL] checkPendingChannelOpens: retrying Tx1 (split) for queued entry. campaign: " + ctx.campaignId + " role: " + (ctx.role || 'viewer'));
    getCampaign(ctx.campaignId, function(cErr, camp) {
      if (cErr || !camp || !camp.ESCROW_COINID || !camp.ESCROW_WALLET_PK) {
        MDS.log("[CHANNEL] checkPendingChannelOpens: campaign/escrow missing — keeping in queue. campaign: " + ctx.campaignId);
        remaining.push(ctx);
        _retryPendingChOpen(queue, i + 1, remaining, deferred);
        return;
      }
      var retryCtx = {
        campaignId:    ctx.campaignId,
        viewerKey:     ctx.viewerKey,
        viewerMx:      ctx.viewerMx,
        viewerWalletPK: ctx.viewerWalletPK || '',
        maxAmount:     ctx.maxAmount,
        escrowCoinId:  camp.ESCROW_COINID,
        walletPK:      camp.ESCROW_WALLET_PK,
        role:          ctx.role || 'viewer',
        frameId:       ctx.frameId || ''
      };
      // Drop this entry from `remaining`; defer the retry call until after the
      // queue is persisted (so a new re-enqueue from inside the retry isn't
      // clobbered).
      deferred.push({ __kind: 'split', ctx: retryCtx });
      _retryPendingChOpen(queue, i + 1, remaining, deferred);
    });
    return;
  }
  if (!ctx.splitCoinId) {
    // Malformed entry — drop it.
    _retryPendingChOpen(queue, i + 1, remaining, deferred);
    return;
  }
  MDS.cmd("coins coinid:" + ctx.splitCoinId, function(cRes) {
    var coins = (cRes && cRes.status && cRes.response) ? cRes.response : [];
    if (coins.length > 0) {
      MDS.log("[CHANNEL] checkPendingChannelOpens: split coin found — building Tx2. campaign: " + ctx.campaignId);
      deferred.push({ __kind: 'open', ctx: ctx });
      _retryPendingChOpen(queue, i + 1, remaining, deferred);
    } else {
      remaining.push(ctx);
      _retryPendingChOpen(queue, i + 1, remaining, deferred);
    }
  });
}

// ---------------------------------------------------------------------------
// _enqueuePendingChOpenSplitRetry — called by swBuildAndPostChannelTx when
// txninput on the escrow coin fails (escrow is locked in mempool by a prior
// pending split tx). Persists the channel open context flagged needsSplit so
// checkPendingChannelOpens retries the FULL split+open flow once the prior
// split confirms and ESCROW_COINID is updated to the change coin.
// ---------------------------------------------------------------------------
function _enqueuePendingChOpenSplitRetry(ctx) {
  MDS.keypair.get("PENDING_CHOPEN_QUEUE", function(qRes) {
    var queue = [];
    try { queue = JSON.parse((qRes && qRes.status && qRes.value) ? qRes.value : "[]"); } catch (e) {}
    var role = ctx.role || 'viewer';
    var vk16 = (ctx.viewerKey || "").substring(0, 16).toUpperCase();
    var key = ctx.campaignId + "|" + vk16 + "|" + role;
    var exists = false;
    for (var qi = 0; qi < queue.length; qi++) {
      var existingRole = queue[qi].role || 'viewer';
      var existingKey = queue[qi].campaignId + "|" + (queue[qi].viewerKey || "").substring(0, 16).toUpperCase() + "|" + existingRole;
      if (existingKey === key) {
        exists = true;
        break;
      }
    }
    if (!exists) {
      queue.push({
        needsSplit:    true,
        campaignId:    ctx.campaignId,
        viewerKey:     ctx.viewerKey,
        viewerMx:      ctx.viewerMx,
        viewerWalletPK: ctx.viewerWalletPK || '',
        maxAmount:     ctx.maxAmount,
        role:          role,
        frameId:       ctx.frameId || ''
      });
      MDS.keypair.set("PENDING_CHOPEN_QUEUE", JSON.stringify(queue), function() {
        MDS.log("[CHANNEL] _enqueuePendingChOpenSplitRetry: queued split retry. campaign: " + ctx.campaignId + " role: " + role);
      });
    } else {
      MDS.log("[CHANNEL] _enqueuePendingChOpenSplitRetry: already queued. campaign: " + ctx.campaignId + " role: " + role);
    }
  });
}

// ---------------------------------------------------------------------------
// checkPendingVouchers — called on every NEWBLOCK from main.js.
// For each open channel, checks if a queued REWARD_REQUEST is waiting for
// the channel coin to be indexed. Once the coin is visible, dispatches
// DO_REWARD_VOUCHER or DO_PUBLISHER_REWARD_VOUCHER and clears the queue.
// Rhino-safe: var, function(), string concat, no arrow functions, no trailing commas.
// ---------------------------------------------------------------------------
function checkPendingVouchers() {
  // Also include recently-settled channels (within 5 min) to recover from the
  // race where checkOpenChannelsSettled prematurely settled a just-activated
  // channel before its coin was locally indexed (Fix 2).
  var fiveMinAgo = Date.now() - 300000;
  var sql = "SELECT CAMPAIGN_ID, VIEWER_KEY, ROLE, CHANNEL_COINID, CREATOR_MX"
          + " FROM CHANNEL_STATE WHERE STATUS = 'open'"
          + " OR (STATUS = 'settled' AND CREATED_AT > " + fiveMinAgo + ")";
  sqlQuery(sql, function(err, rows) {
    if (err) {
      MDS.log("[CHANNEL] checkPendingVouchers query error: " + err);
      return;
    }
    if (!rows || rows.length === 0) { return; }

    for (var i = 0; i < rows.length; i++) {
      checkOnePendingVoucher(
        rows[i].CAMPAIGN_ID,
        rows[i].VIEWER_KEY,
        rows[i].ROLE || 'viewer',
        rows[i].CHANNEL_COINID
      );
    }
  });
}

// ---------------------------------------------------------------------------
// _maybeNotifyPublisher — called on creator node after viewer REWARD_REQUEST.
// Looks up the frame's PUBLISHER_MX; if the publisher channel is not yet open
// or pending, sends PUBLISHER_REWARD_NOTIFY to the publisher's Maxima address.
// ---------------------------------------------------------------------------
function _maybeNotifyPublisher(campaignId, frameId) {
  if (typeof getFrame !== 'function') { return; }
  getFrame(frameId, function(err, frame) {
    if (err || !frame || !frame.PUBLISHER_MX) { return; }
    var publisherKey = frame.PUBLISHER_KEY || '';
    if (!publisherKey) { return; }
    getChannelState(campaignId, publisherKey, 'publisher', function(chErr, ch) {
      if (!chErr && ch && ch.STATUS === 'open') { return; }
      if (!chErr && ch && ch.STATUS === 'pending') {
        var pendingAge = Date.now() - parseInt(ch.CREATED_AT || 0);
        if (pendingAge < 300000) {
          MDS.log("[CHANNEL] _maybeNotifyPublisher: pending channel is fresh (age=" + pendingAge + "ms) — skipping. frame: " + frameId);
          return;
        }
        MDS.log("[CHANNEL] _maybeNotifyPublisher: stale pending (age=" + pendingAge + "ms) — re-notifying. frame: " + frameId);
      }
      var notify = {
        type:        "PUBLISHER_REWARD_NOTIFY",
        campaign_id: campaignId,
        frame_id:    frameId
      };
      sendMaxima(publisherKey, frame.PUBLISHER_MX, notify, function(ok) {
        MDS.log("[CHANNEL] PUBLISHER_REWARD_NOTIFY sent frame: " + frameId + " ok=" + ok);
      });
    });
  });
}

// ---------------------------------------------------------------------------
// _notifyPublisherByKey — sends PUBLISHER_REWARD_NOTIFY directly using the
// publisher's Maxima PK (no FRAMES table lookup required). Used for built-in
// frames where no FRAMES row exists on the creator node but publisherKey is
// known from the REWARD_REQUEST payload (e.g. MINIMAADS_CREATOR_PK).
// ---------------------------------------------------------------------------
function _notifyPublisherByKey(campaignId, frameId, publisherKey, publisherMx) {
  var targetMx = publisherMx;
  if (targetMx) {
    _doNotifyPublisherByKey(campaignId, frameId, publisherKey, targetMx);
  } else {
    if (publisherKey && publisherKey.toUpperCase() === MINIMAADS_CREATOR_PK.toUpperCase()) {
      MDS.keypair.get("MINIMAADS_CREATOR_ROUTE", function(res) {
        var savedRoute = (res && res.status && res.value) ? res.value : '';
        if (savedRoute) {
          _doNotifyPublisherByKey(campaignId, frameId, publisherKey, savedRoute);
        } else {
          MDS.log("[CHANNEL] _notifyPublisherByKey: no publisherMx and no MINIMAADS_CREATOR_ROUTE saved");
        }
      });
    } else {
      MDS.log("[CHANNEL] _notifyPublisherByKey: no publisherMx provided");
    }
  }
}

function _doNotifyPublisherByKey(campaignId, frameId, publisherKey, publisherMx) {
  getChannelState(campaignId, publisherKey, 'publisher', function(chErr, ch) {
    if (!chErr && ch && ch.STATUS === 'open') { return; }
    // Stale-pending guard: a pending channel within 5 minutes means Tx is in flight — wait.
    // After 5 minutes the TX is assumed lost; re-notify so the publisher resends CHANNEL_OPEN_REQUEST,
    // which triggers the stale-pending retry/archive logic on the creator side.
    if (!chErr && ch && ch.STATUS === 'pending') {
      var staleCutoff = 300000;
      var pendingAge = Date.now() - parseInt(ch.CREATED_AT || 0);
      if (pendingAge < staleCutoff) {
        MDS.log("[CHANNEL] _notifyPublisherByKey: pending channel is fresh (age=" + pendingAge + "ms) — skipping notify. campaign: " + campaignId);
        return;
      }
      MDS.log("[CHANNEL] _notifyPublisherByKey: stale pending channel (age=" + pendingAge + "ms) — re-notifying publisher. campaign: " + campaignId);
    }
    var notify = {
      type:        "PUBLISHER_REWARD_NOTIFY",
      campaign_id: campaignId,
      frame_id:    frameId
    };
    MDS.log("[CHANNEL] _notifyPublisherByKey: sending to publisherKey=" + (publisherKey ? publisherKey.substring(0, 20) : "null") + " route=" + publisherMx.substring(0, 30) + "...");
    sendMaxima(publisherKey || null, publisherMx, notify, function(ok) {
      MDS.log("[CHANNEL] PUBLISHER_REWARD_NOTIFY sent via route, ok=" + ok);
    });
  });
}

// ---------------------------------------------------------------------------
// handlePublisherRewardNotify — runs on the publisher's node.
// Generates a wallet key, then sends CHANNEL_OPEN_REQUEST (role=publisher)
// back to the creator so the creator can fund a publisher channel coin.
// ---------------------------------------------------------------------------
function handlePublisherRewardNotify(payload, senderPk) {
  if (!payload.campaign_id || !payload.frame_id) {
    MDS.log("[CHANNEL] PUBLISHER_REWARD_NOTIFY missing required fields");
    return;
  }
  var campaignId = payload.campaign_id;
  var frameId    = payload.frame_id;
  if (frameId && (frameId.toUpperCase().indexOf('0X') === 0 || frameId.indexOf(':') === -1)) {
    frameId = 'builtin:' + frameId.toUpperCase();
  }
  var creatorKey = senderPk || '';

  getCampaign(campaignId, function(err, campaign) {
    if (err || !campaign) {
      MDS.log("[CHANNEL] PUBLISHER_REWARD_NOTIFY: campaign not found, deferring: " + campaignId);
      var deferred = JSON.stringify({ campaign_id: campaignId, frame_id: frameId, creator_key: creatorKey });
      MDS.keypair.set("PENDING_PUB_NOTIFY_" + campaignId, deferred, function() {});
      return;
    }
    if (campaign.STATUS !== 'active') {
      MDS.log("[CHANNEL] PUBLISHER_REWARD_NOTIFY: campaign not active: " + campaignId);
      return;
    }
    if (parseFloat(campaign.PUBLISHER_REWARD_VIEW) <= 0) {
      MDS.log("[CHANNEL] PUBLISHER_REWARD_NOTIFY: no publisher reward for campaign: " + campaignId);
      return;
    }

    getChannelState(campaignId, MY_MAXIMA_PK, 'publisher', function(chErr, ch) {
      if (!chErr && ch && (ch.STATUS === 'open' || ch.STATUS === 'pending')) {
        MDS.log("[CHANNEL] PUBLISHER_REWARD_NOTIFY: channel already open/pending: " + campaignId);
        return;
      }
      MDS.keypair.get("VIEWER_WALLET_PK_" + campaignId, function(pkRes) {
        if (pkRes && pkRes.status && pkRes.value) {
          _doSendPublisherChannelOpenRequest(campaignId, campaign, frameId, creatorKey, pkRes.value);
        } else {
          MDS.cmd("keys action:new", function(keysRes) {
            if (!keysRes || !keysRes.status || !keysRes.response || !keysRes.response.publickey) {
              MDS.log("[CHANNEL] PUBLISHER_REWARD_NOTIFY: keys action:new failed");
              return;
            }
            var walletPK = keysRes.response.publickey;
            MDS.keypair.set("VIEWER_WALLET_PK_" + campaignId, walletPK, function() {
              _doSendPublisherChannelOpenRequest(campaignId, campaign, frameId, creatorKey, walletPK);
            });
          });
        }
      });
    });
  });
}

function _doSendPublisherChannelOpenRequest(campaignId, campaign, frameId, creatorKey, walletPK) {
  MDS.cmd("getaddress", function(gaRes) {
    var walletAddr = (gaRes && gaRes.status && gaRes.response && gaRes.response.address)
      ? gaRes.response.address : '';
    if (!walletAddr) {
      MDS.log("[CHANNEL] _doSendPublisherChannelOpenRequest: getaddress failed. campaign: " + campaignId);
      return;
    }
    MDS.keypair.get("USER_PERMANENT_ROUTE", function(prRes) {
      var prVal = (prRes && prRes.status && prRes.value) ? prRes.value : null;
      var publisherMxAddr = (prVal && prVal.indexOf("MAX#") === 0) ? prVal : MY_MX_ADDRESS;
      var pubView     = parseFloat(campaign.PUBLISHER_REWARD_VIEW) || 0;
      // Per-session cap mirrors viewer logic (REWARD_VIEW * 10).
      // Do NOT use MAX_PUBLISHER_BUDGET here — that is the total campaign budget,
      // not a per-channel cap. Using it would reserve the entire budget for one publisher.
      var maxAmount   = pubView * 10;
      var targetKey   = creatorKey || campaign.CREATOR_ADDRESS;
      var payload = {
        type:               "CHANNEL_OPEN_REQUEST",
        campaign_id:        campaignId,
        viewer_key:         MY_MAXIMA_PK,
        viewer_mx:          publisherMxAddr,
        viewer_wallet_addr: walletAddr,
        viewer_wallet_pk:   walletPK,
        max_amount:         maxAmount,
        role:               "publisher",
        frame_id:           frameId
      };
      MDS.keypair.get("CREATOR_MX_" + campaignId, function(kpRes) {
        var _cmxRaw = (kpRes && kpRes.status && kpRes.value) ? kpRes.value : null;
        var creatorMx = (_cmxRaw && (_cmxRaw.indexOf("Mx") === 0 || _cmxRaw.indexOf("MAX#") === 0)) ? _cmxRaw : null;
        sendMaxima(targetKey, creatorMx, payload, function(ok) {
          MDS.log("[CHANNEL] publisher CHANNEL_OPEN_REQUEST sent: campaign=" + campaignId + " frameId=" + frameId + " ok=" + ok);
        });
      });
    });
  });
}

// ---------------------------------------------------------------------------
// _maybeGeneratePublisherVoucher — called on the CREATOR node after a viewer
// earns a reward. Finds any open publisher channel for this campaign+frame,
// deduplicates on 'pub-<eventId>', then signals the FE to build a publisher
// voucher TX. Replaces the old _maybeNotifyPublisher approach, which failed
// for frames that don't exist in the creator's FRAMES table.
// ---------------------------------------------------------------------------
function _maybeGeneratePublisherVoucher(campaignId, frameId, eventId, publisherKey, publisherMx) {
  if (!frameId && !publisherKey) { return; }

  // Normalize frameId
  var resolvedFrameId = frameId || '';
  if (!resolvedFrameId && publisherKey) {
    resolvedFrameId = 'builtin:' + publisherKey.toUpperCase();
  } else if (resolvedFrameId && (resolvedFrameId.toUpperCase().indexOf('0X') === 0 || resolvedFrameId.indexOf(':') === -1)) {
    resolvedFrameId = 'builtin:' + resolvedFrameId.toUpperCase();
  }

  if (publisherKey) {
    // Fast path: publisherKey provided directly by viewer snippet — no keypair lookup needed.
    sqlQuery(
      "SELECT * FROM CHANNEL_STATE WHERE " +
      "UPPER(CAMPAIGN_ID) = UPPER('" + escapeSql(campaignId) + "') AND " +
      "UPPER(VIEWER_KEY) = UPPER('" + escapeSql(publisherKey) + "') AND " +
      "ROLE = 'publisher' AND STATUS = 'open'",
      function(err, rows) {
        if (err || !rows || rows.length === 0) {
          MDS.log("[CHANNEL] _maybeGeneratePublisherVoucher: publisher channel not open — DEFERRING. campaign: " + campaignId + " pubKey: " + publisherKey.substring(0, 16) + "...");
          _deferPublisherReward(campaignId, resolvedFrameId, eventId, publisherMx || '');

          _notifyPublisherByKey(campaignId, resolvedFrameId, publisherKey, publisherMx);
          return;
        }
        var targetFrameId = resolvedFrameId || rows[0].FRAME_ID;
        if (targetFrameId && (targetFrameId.toUpperCase().indexOf('0X') === 0 || targetFrameId.indexOf(':') === -1)) {
          targetFrameId = 'builtin:' + targetFrameId.toUpperCase();
        }
        _doGeneratePublisherVoucher(campaignId, targetFrameId, eventId, rows[0]);
      }
    );
    return;
  }
  // Legacy path: no publisherKey — resolve via FRAME_PUBLISHER keypair or FRAME_ID.
  MDS.keypair.get("FRAME_PUBLISHER_" + resolvedFrameId, function(kpRes) {
    var kpKey = (kpRes && kpRes.status && kpRes.value) ? kpRes.value : '';
    var sql;
    if (kpKey) {
      sql = "SELECT * FROM CHANNEL_STATE WHERE " +
        "UPPER(CAMPAIGN_ID) = UPPER('" + escapeSql(campaignId) + "') AND " +
        "UPPER(VIEWER_KEY) = UPPER('" + escapeSql(kpKey) + "') AND " +
        "ROLE = 'publisher' AND STATUS = 'open'";
    } else {
      sql = "SELECT * FROM CHANNEL_STATE WHERE " +
        "UPPER(CAMPAIGN_ID) = UPPER('" + escapeSql(campaignId) + "') AND " +
        "UPPER(FRAME_ID) = UPPER('" + escapeSql(resolvedFrameId) + "') AND " +
        "ROLE = 'publisher' AND STATUS = 'open'";
    }
    sqlQuery(sql, function(err, rows) {
      if (err || !rows || rows.length === 0) {
        // Fall back to any open publisher channel (handles stale frame_id from old snippets).
        sqlQuery(
          "SELECT * FROM CHANNEL_STATE WHERE " +
          "UPPER(CAMPAIGN_ID) = UPPER('" + escapeSql(campaignId) + "') AND " +
          "ROLE = 'publisher' AND STATUS = 'open' LIMIT 1",
          function(err2, rows2) {
            if (err2 || !rows2 || rows2.length === 0) {
              MDS.log("[CHANNEL] _maybeGeneratePublisherVoucher: no open publisher channel — DEFERRING. campaign: " + campaignId + " frame: " + resolvedFrameId);
              _deferPublisherReward(campaignId, resolvedFrameId, eventId, publisherMx || '');
              _maybeNotifyPublisher(campaignId, resolvedFrameId);
              return;
            }
            MDS.log("[CHANNEL] _maybeGeneratePublisherVoucher: fallback to open publisher channel. campaign: " + campaignId + " frame: " + resolvedFrameId);
            var targetFrameId = rows2[0].FRAME_ID || resolvedFrameId;
            if (targetFrameId && (targetFrameId.toUpperCase().indexOf('0X') === 0 || targetFrameId.indexOf(':') === -1)) {
              targetFrameId = 'builtin:' + targetFrameId.toUpperCase();
            }
            _doGeneratePublisherVoucher(campaignId, targetFrameId, eventId, rows2[0]);
          }
        );
        return;
      }
      _doGeneratePublisherVoucher(campaignId, resolvedFrameId, eventId, rows[0]);
    });
  });
}

function _deferPublisherReward(campaignId, frameId, eventId, publisherMx) {
  var dprId = 'pub-' + eventId;
  isDuplicate(dprId, function(isDup) {
    if (isDup) {
      MDS.log("[CHANNEL] _deferPublisherReward: already deferred or generated: " + dprId);
      return;
    }
    getCampaign(campaignId, function(err, campaign) {
      if (err || !campaign) { return; }
      var pubReward = parseFloat(campaign.PUBLISHER_REWARD_VIEW) || 0;
      if (pubReward <= 0) { return; }
      var now = Date.now();
      sqlQuery(
        "MERGE INTO DEFERRED_PUB_REWARDS (ID, CAMPAIGN_ID, FRAME_ID, VIEWER_EVENT_ID, AMOUNT, PUBLISHER_MX, CREATED_AT) KEY (ID) VALUES ('" +
        escapeSql(dprId) + "','" + escapeSql(campaignId) + "','" + escapeSql(frameId) + "','" +
        escapeSql(eventId) + "'," + pubReward + ",'" + escapeSql(publisherMx || '') + "'," + now + ")",
        function(mergeErr) {
          if (mergeErr) {
            MDS.log("[CHANNEL] _deferPublisherReward: MERGE failed: " + mergeErr);
            return;
          }
          MDS.log("[CHANNEL] _deferPublisherReward: saved pub-" + eventId + " campaign: " + campaignId + " frame: " + frameId + " amount: " + pubReward);
        }
      );
    });
  });
}

function _replayDeferredPublisherRewards(campaignId, frameId, publisherKey) {
  sqlQuery(
    "SELECT * FROM DEFERRED_PUB_REWARDS WHERE " +
    "UPPER(CAMPAIGN_ID) = UPPER('" + escapeSql(campaignId) + "') ORDER BY CREATED_AT",
    function(err, rows) {
      if (err || !rows || rows.length === 0) {
        MDS.log("[CHANNEL] _replayDeferredPublisherRewards: no deferred rewards. campaign: " + campaignId + " frame: " + frameId);
        return;
      }
      MDS.log("[CHANNEL] _replayDeferredPublisherRewards: " + rows.length + " row(s). campaign: " + campaignId + " frame: " + frameId);
      getChannelState(campaignId, publisherKey, 'publisher', function(chErr, pubChannel) {
        if (chErr || !pubChannel) {
          MDS.log("[CHANNEL] _replayDeferredPublisherRewards: channel not found. campaign: " + campaignId);
          return;
        }
        swWaitForCoin(pubChannel.CHANNEL_COINID, 1, 0, function(coinFound) {
          if (!coinFound) {
            MDS.log("[CHANNEL] _replayDeferredPublisherRewards: channel coin not yet indexed, deferring. campaign: " + campaignId);
            return;
          }
          _replayDeferredPublisherRewardsNow(campaignId, frameId, rows, pubChannel);
        });
      });
    }
  );
}

function _replayDeferredPublisherRewardsNow(campaignId, frameId, rows, pubChannel) {
        var base = parseFloat(pubChannel.CUMULATIVE_EARNED);
        var totalAmount = 0;
        var stableIds    = [];
        var idPlaceholds = [];
        for (var i = 0; i < rows.length; i++) {
          totalAmount += parseFloat(rows[i].AMOUNT);
          stableIds.push(escapeSql(rows[i].ID));
          idPlaceholds.push("'" + escapeSql(rows[i].ID) + "'");
        }
        var cumulative = base + totalAmount;
        var maxAmount = parseFloat(pubChannel.MAX_AMOUNT);
        if (cumulative > maxAmount) {
          MDS.log("[CHANNEL] _replayDeferredPublisherRewards: capping cumulative " + cumulative + " to max " + maxAmount + ". campaign: " + campaignId);
          cumulative = maxAmount;
        }
        var pubEventId = 'pub-replay-' + stableIds.join('-');
        isDuplicate(pubEventId, function(isDup) {
          if (isDup) {
            MDS.log("[CHANNEL] _replayDeferredPublisherRewards: already replayed. campaign: " + campaignId);
            return;
          }
          MDS.log("[CHANNEL] _replayDeferredPublisherRewards: voucher dispatching cumulative: " + cumulative + " campaign: " + campaignId);
          var _cleanupNow = Date.now();
          _swDispatchVoucher(
            campaignId, pubChannel.VIEWER_KEY, pubChannel.CREATOR_MX,
            pubEventId, cumulative, pubChannel, 'publisher', frameId,
            function() {
              sqlQuery(
                "MERGE INTO DEDUP_LOG (ID, LOGGED_AT) KEY (ID) VALUES ('" + escapeSql(pubEventId) + "'," + _cleanupNow + ")",
                function() {
                  sqlQuery(
                    "DELETE FROM DEFERRED_PUB_REWARDS WHERE ID IN (" + idPlaceholds.join(',') + ")",
                    function() {
                      MDS.log("[CHANNEL] _replayDeferredPublisherRewards: cleanup done. campaign: " + campaignId);
                    }
                  );
                }
              );
            }
          );
        });
}

function _doGeneratePublisherVoucher(campaignId, frameId, eventId, pubChannel) {
  if (frameId && (frameId.toUpperCase().indexOf('0X') === 0 || frameId.indexOf(':') === -1)) {
    frameId = 'builtin:' + frameId.toUpperCase();
  }
  getCampaign(campaignId, function(err2, campaign) {
    if (err2 || !campaign) { return; }
    var pubReward = parseFloat(campaign.PUBLISHER_REWARD_VIEW) || 0;
    if (pubReward <= 0) { return; }
    var cumulative = parseFloat(pubChannel.CUMULATIVE_EARNED) + pubReward;
    if (cumulative > parseFloat(pubChannel.MAX_AMOUNT)) {
      MDS.log("[CHANNEL] _doGeneratePublisherVoucher: cumulative exceeds max. campaign: " + campaignId);
      return;
    }
    var pubEventId = 'pub-' + eventId;
    isDuplicate(pubEventId, function(isDup) {
      if (isDup) {
        MDS.log("[CHANNEL] _doGeneratePublisherVoucher: duplicate event: " + pubEventId);
        return;
      }
      var _pubCoinId = pubChannel.CHANNEL_COINID || '';
      if (!_pubCoinId) {
        MDS.log("[CHANNEL] _doGeneratePublisherVoucher: no coinId on publisher channel — skipping. campaign: " + campaignId);
        return;
      }
      var _csAddr = CHANNEL_SCRIPT_ADDRESS || '';
      MDS.cmd("coins address:" + _csAddr, function(_csRes) {
        var _csList = (_csRes && _csRes.status && _csRes.response) ? _csRes.response : [];
        var _coinFound = false;
        for (var _ci = 0; _ci < _csList.length; _ci++) {
          if (_csList[_ci].coinid && _csList[_ci].coinid.toUpperCase() === _pubCoinId.toUpperCase()) {
            _coinFound = true;
            break;
          }
        }
        if (!_coinFound) {
          MDS.log("[CHANNEL] _doGeneratePublisherVoucher: publisher coin spent — reopening channel. campaign: " + campaignId);
          var _pubViewerKey  = pubChannel.VIEWER_KEY        || '';
          var _pubViewerMx   = pubChannel.CREATOR_MX        || '';
          var _pubMaxAmount  = parseFloat(pubChannel.MAX_AMOUNT) || 0;
          var _pubWalletAddr = pubChannel.VIEWER_WALLET_ADDR || '';
          var _pubWalletPK   = pubChannel.VIEWER_WALLET_PK  || '';
          settleChannel(campaignId, _pubViewerKey, 'publisher', function(settleErr) {
            if (settleErr) { MDS.log("[CHANNEL] _doGeneratePublisherVoucher: settleChannel failed: " + settleErr); }
            var _now2 = Date.now();
            sqlQuery(
              "MERGE INTO DEFERRED_PUB_REWARDS (ID, CAMPAIGN_ID, FRAME_ID, VIEWER_EVENT_ID, AMOUNT, CREATED_AT) KEY (ID) VALUES ('" +
              escapeSql(pubEventId) + "','" + escapeSql(campaignId) + "','" + escapeSql(frameId) + "','" +
              escapeSql(eventId) + "'," + pubReward + "," + _now2 + ")",
              function() {
                openChannel(campaignId, _pubViewerKey, _pubViewerMx, _pubMaxAmount, 'publisher', frameId, _pubWalletAddr, function(openErr) {
                  if (openErr) {
                    MDS.log("[CHANNEL] _doGeneratePublisherVoucher: openChannel (publisher) failed: " + openErr);
                    return;
                  }
                  var _bumpSql = "UPDATE CAMPAIGNS SET PUBLISHER_BUDGET_SPENT = COALESCE(PUBLISHER_BUDGET_SPENT, 0) + " + _pubMaxAmount +
                    " WHERE UPPER(ID) = UPPER('" + escapeSql(campaignId) + "')";
                  sqlQuery(_bumpSql, function() {
                    sqlQuery(
                      "UPDATE CHANNEL_STATE SET VIEWER_WALLET_PK = '" + escapeSql(_pubWalletPK) + "'" +
                      " WHERE UPPER(CAMPAIGN_ID) = UPPER('" + escapeSql(campaignId) + "')" +
                      " AND UPPER(VIEWER_KEY) = UPPER('" + escapeSql(_pubViewerKey) + "')" +
                      " AND ROLE = 'publisher'",
                      function() {
                        MDS.keypair.set("FRAME_PUBLISHER_" + frameId, _pubViewerKey, function() {
                          MDS.log("[CHANNEL] _doGeneratePublisherVoucher: dispatching new publisher channel. campaign: " + campaignId);
                          _swDispatchChannelOpen(campaignId, _pubViewerKey, _pubViewerMx, _pubMaxAmount, 'publisher', frameId, _pubWalletPK, _pubWalletAddr);
                        });
                      }
                    );
                  });
                });
              }
            );
          });
          return;
        }
        var now = Date.now();
        sqlQuery(
          "MERGE INTO DEDUP_LOG (ID, LOGGED_AT) KEY (ID) VALUES ('" + escapeSql(pubEventId) + "'," + now + ")",
          function() {
            MDS.log("[CHANNEL] publisher voucher SW: campaign: " + campaignId + " frame: " + frameId + " cumulative: " + cumulative);
            _swDispatchVoucher(campaignId, pubChannel.VIEWER_KEY, pubChannel.CREATOR_MX, pubEventId, cumulative, pubChannel, 'publisher', frameId);
          }
        );
      });
    });
  });
}

function checkOnePendingVoucher(campaignId, viewerKey, role, channelCoinId) {
  var r = role || 'viewer';
  var kpKey = "PENDING_VOUCHER_" + campaignId + "_" + viewerKey.toUpperCase() + "_" + r.toUpperCase();
  MDS.keypair.get(kpKey, function(kpRes) {
    var raw = kpRes && kpRes.status ? kpRes.value : '';
    if (!raw) { return; }

    var pending = null;
    try { pending = JSON.parse(raw); } catch (e) {
      MDS.log("[CHANNEL] checkOnePendingVoucher: bad keypair JSON for " + kpKey);
      return;
    }

    if (!channelCoinId) {
      MDS.log("[CHANNEL] checkOnePendingVoucher: no coinid on record, skipping. campaign: " + campaignId);
      return;
    }

    var _chAddr2 = CHANNEL_SCRIPT_ADDRESS || '';
    if (!_chAddr2) { return; }
    MDS.cmd("coins address:" + _chAddr2, function(coinRes) {
      var coinList2 = (coinRes && coinRes.status && coinRes.response) ? coinRes.response : [];
      var indexed = false;
      for (var ci2 = 0; ci2 < coinList2.length; ci2++) {
        if (coinList2[ci2].coinid && coinList2[ci2].coinid.toUpperCase() === channelCoinId.toUpperCase()) {
          indexed = true;
          break;
        }
      }
      if (!indexed) {
        return;
      }

      MDS.keypair.set(kpKey, '', function() {
        MDS.log("[CHANNEL] pending voucher found, building in SW: " + campaignId + " cumulative: " + pending.cumulative + " role: " + r);
        getChannelState(pending.campaign_id, pending.viewer_key, r, function(chErr, ch) {
          if (chErr || !ch) {
            MDS.log("[CHANNEL] checkOnePendingVoucher: channel not found. campaign: " + pending.campaign_id);
            return;
          }
          _swDispatchVoucher(pending.campaign_id, pending.viewer_key, pending.viewer_mx, pending.event_id, pending.cumulative, ch, r, pending.frame_id || '');
          if (r === 'viewer' && (pending.frame_id || pending.publisher_key)) {
            _maybeGeneratePublisherVoucher(pending.campaign_id, pending.frame_id || '', pending.event_id, pending.publisher_key || '', pending.publisher_mx || '');
          }
        });
      });
    });
  });
}

// ---------------------------------------------------------------------------
// _swDispatchChannelOpen — fetches ESCROW_WALLET_PK + ESCROW_COINID from the
// campaign and calls swBuildAndPostChannelTx. Used by handleChannelOpenRequest.
// ---------------------------------------------------------------------------
function _swDispatchChannelOpen(campaignId, viewerKey, viewerMx, maxAmount, role, frameId, viewerWalletPK, viewerWalletAddr) {
  getCampaign(campaignId, function(err, campaign) {
    if (err || !campaign) {
      MDS.log("[CHANNEL] _swDispatchChannelOpen: campaign not found. campaign: " + campaignId);
      return;
    }
    var walletPK    = campaign.ESCROW_WALLET_PK || '';
    var escrowCoinId = campaign.ESCROW_COINID || '';
    if (!walletPK || !escrowCoinId) {
      MDS.log("[CHANNEL] _swDispatchChannelOpen: ESCROW_WALLET_PK or ESCROW_COINID missing. campaign: " + campaignId);
      return;
    }
    swBuildAndPostChannelTx({
      campaignId:    campaignId,
      viewerKey:     viewerKey,
      viewerMx:      viewerMx,
      viewerWalletPK: viewerWalletPK || '',
      maxAmount:     maxAmount,
      escrowCoinId:  escrowCoinId,
      walletPK:      walletPK,
      role:          role || 'viewer',
      frameId:       frameId || ''
    });
  });
}

// ---------------------------------------------------------------------------
// _swDispatchVoucher — fetches ESCROW_WALLET_PK from campaign and calls
// swBuildAndExportVoucherTx. Used by handleRewardRequest, checkOnePendingVoucher,
// and _doGeneratePublisherVoucher.
// ---------------------------------------------------------------------------
function _swDispatchVoucher(campaignId, viewerKey, viewerMx, eventId, cumulative, channel, role, frameId, afterSend) {
  getCampaign(campaignId, function(err, campaign) {
    if (err || !campaign || !campaign.ESCROW_WALLET_PK) {
      MDS.log("[CHANNEL] _swDispatchVoucher: campaign or ESCROW_WALLET_PK missing. campaign: " + campaignId);
      return;
    }
    var viewerAddr = channel.VIEWER_WALLET_ADDR || '';
    if (!viewerAddr) {
      MDS.log("[CHANNEL] _swDispatchVoucher: VIEWER_WALLET_ADDR missing. campaign: " + campaignId + " role: " + role);
      return;
    }
    // rewardAmount passed to the voucher builder so it can create a creator-side
    // REWARD_EVENT after the voucher is sent.
    var rewardAmount = (role === 'viewer')
      ? (parseFloat(campaign.REWARD_VIEW) || 0)
      : (parseFloat(campaign.PUBLISHER_REWARD_VIEW) || 0);
    swBuildAndExportVoucherTx({
      campaignId:      campaignId,
      viewerKey:       viewerKey,
      viewerMx:        viewerMx,
      eventId:         eventId,
      cumulative:      cumulative,
      maxAmount:       parseFloat(channel.MAX_AMOUNT),
      channelCoinId:   channel.CHANNEL_COINID,
      creatorWalletPK: campaign.ESCROW_WALLET_PK,
      viewerAddr:      viewerAddr,
      role:            role || 'viewer',
      frameId:         frameId || '',
      rewardAmount:    rewardAmount
    }, afterSend || null);
  });
}

// ===========================================================================
// SW TX BUILDERS — moved from FE (app.js) so the full channel + voucher flow
// runs without the MiniDapp UI being open (write mode bypasses pending approvals).
// Rhino-safe: var, function(), string concat, MDS.log, no trailing commas.
// ===========================================================================

function swGenerateUID() {
  var t = Date.now().toString(36);
  var r = Math.random().toString(36).substring(2, 7);
  return t + r;
}

function swRunSequential(cmds, idx, cb) {
  if (idx >= cmds.length) { cb(true); return; }
  MDS.cmd(cmds[idx], function(res) {
    if (!res || !res.status) {
      MDS.log("[CHANNEL] swRunSequential cmd failed: " + cmds[idx] + " err: " + (res && res.error));
      cb(false);
      return;
    }
    swRunSequential(cmds, idx + 1, cb);
  });
}

function swWaitForCoin(coinId, maxRetries, delay, cb) {
  var attempts = 0;
  var actualDelay = delay || 200;
  function check() {
    attempts++;
    MDS.cmd("coins coinid:" + coinId + " relevant:true", function(res) {
      if (res && res.status && res.response && res.response.length > 0) {
        cb(true);
      } else if (attempts < maxRetries) {
        MDS.log("[CHANNEL] swWaitForCoin: coin not yet visible attempt " + attempts + "/" + maxRetries + " coinId: " + coinId);
        setTimeout(function() { check(); }, actualDelay);
      } else {
        MDS.log("[CHANNEL] swWaitForCoin: coin not found after " + maxRetries + " attempts: " + coinId);
        cb(false);
      }
    });
  }
  check();
}

function swBuildAndExportVoucherTx(ctx, afterSend) {
  var txId   = "rv_" + swGenerateUID();
  var refund = parseFloat((ctx.maxAmount - ctx.cumulative).toFixed(6));
  var role   = ctx.role || "viewer";
  var fid    = ctx.frameId || "";

  MDS.log("[CHANNEL] SW voucher tx: channel: " + ctx.channelCoinId + " cumulative: " + ctx.cumulative + " role: " + role);

  function fail(stage) {
    MDS.log("[CHANNEL] swBuildAndExportVoucherTx failed at " + stage + " campaign: " + ctx.campaignId);
    MDS.cmd("txndelete id:" + txId, function() {});
  }

  MDS.cmd("txncreate id:" + txId, function(r1) {
    if (!r1 || !r1.status) { fail("txncreate"); return; }
    MDS.cmd("txninput id:" + txId + " coinid:" + ctx.channelCoinId + " scriptmmr:true", function(r2) {
      if (!r2 || !r2.status) { fail("txninput"); return; }

      MDS.cmd("txnoutput id:" + txId + " storestate:false amount:" + ctx.cumulative + " address:" + ctx.viewerAddr, function(r3) {
        if (!r3 || !r3.status) { fail("txnoutput[viewer]"); return; }

        function afterRefund(r4) {
          if (r4 && !r4.status) { fail("txnoutput[creator]"); return; }

          MDS.cmd("txnsign id:" + txId + " publickey:" + ctx.creatorWalletPK, function(r5) {
            if (!r5 || !r5.status) { fail("txnsign"); return; }
            if (r5.pending) {
              MDS.log("[CHANNEL] swBuildAndExportVoucherTx: txnsign pending - write mode required. campaign: " + ctx.campaignId);
              MDS.cmd("txndelete id:" + txId, function() {});
              return;
            }

            MDS.cmd("txnexport id:" + txId, function(r6) {
              if (!r6 || !r6.status || !r6.response) { fail("txnexport"); return; }
              var txHex = r6.response.data || r6.response.transaction || r6.response;
              if (typeof txHex !== "string") {
                MDS.log("[CHANNEL] swBuildAndExportVoucherTx: txnexport unexpected shape. campaign: " + ctx.campaignId);
                MDS.cmd("txndelete id:" + txId, function() {});
                return;
              }

              MDS.cmd("txndelete id:" + txId, function() {});

              updateChannelVoucher(ctx.campaignId, ctx.viewerKey, role, ctx.cumulative, txHex, function(err) {
                if (err) { MDS.log("[CHANNEL] swBuildAndExportVoucherTx: updateChannelVoucher failed: " + err); }
              });

              var voucherMsg = {
                type:        "REWARD_VOUCHER",
                campaign_id: ctx.campaignId,
                viewer_key:  ctx.viewerKey,
                event_id:    ctx.eventId,
                cumulative:  ctx.cumulative,
                tx_hex:      txHex
              };
              if (role === "publisher") {
                voucherMsg.role     = "publisher";
                voucherMsg.frame_id = fid;
              }
              sendMaxima(ctx.viewerKey, ctx.viewerMx, voucherMsg, function(ok) {
                MDS.log("[CHANNEL] SW REWARD_VOUCHER sent cumulative: " + ctx.cumulative + " role: " + role + " ok=" + ok);
                if (role === 'viewer' && ctx.rewardAmount > 0) {
                  sqlQuery(
                    "SELECT ID FROM ADS WHERE UPPER(CAMPAIGN_ID) = UPPER('" + escapeSql(ctx.campaignId) + "')",
                    function(adErr, adRows) {
                      var adId = (adRows && adRows.length > 0) ? adRows[0].ID : '';
                      createRewardEvent({
                        id:           ctx.eventId,
                        campaign_id:  ctx.campaignId,
                        ad_id:        adId,
                        user_address: ctx.viewerKey,
                        type:         'view',
                        amount:       ctx.rewardAmount
                      }, function(evtErr, evt) {
                        if (evtErr || !evt) {
                          MDS.log("[CHANNEL] SW creator view event failed: " + evtErr);
                        } else {
                          MDS.log("[CHANNEL] SW creator view event created. campaign: " + ctx.campaignId + " amount: " + ctx.rewardAmount);
                        }
                      });
                    }
                  );
                } else if (role === 'publisher' && ctx.rewardAmount > 0) {
                  sqlQuery(
                    "SELECT ID FROM ADS WHERE UPPER(CAMPAIGN_ID) = UPPER('" + escapeSql(ctx.campaignId) + "')",
                    function(adErr, adRows) {
                      var adId = (adRows && adRows.length > 0) ? adRows[0].ID : '';
                      createRewardEvent({
                        id:           'pub-' + ctx.eventId,
                        campaign_id:  ctx.campaignId,
                        ad_id:        adId,
                        user_address: ctx.viewerKey,
                        type:         'publisher_view',
                        amount:       ctx.rewardAmount,
                        publisher_id: fid
                      }, function(evtErr, evt) {
                        if (evtErr || !evt) {
                          MDS.log("[CHANNEL] SW creator publisher view event failed: " + evtErr);
                        } else {
                          MDS.log("[CHANNEL] SW creator publisher view event created. campaign: " + ctx.campaignId + " amount: " + ctx.rewardAmount);
                        }
                      });
                    }
                  );
                }
                if (afterSend) { afterSend(); }
              });
            });
          });
        }

        if (refund > 0) {
          MDS.cmd("txnoutput id:" + txId + " storestate:false amount:" + refund + " address:" + MY_ADDRESS, afterRefund);
        } else {
          afterRefund(null);
        }
      });
    });
  });
}

function swBuildAndPostChannelTx(ctx) {
  var txId         = "sp_" + swGenerateUID();
  var campaignHex  = "0x" + utf8ToHex(ctx.campaignId).toUpperCase();
  // Fix A: prefer permanent route (MAX#<hexPK>#<mls>) in STATE(4) so viewers can
  // route REQUEST_CAMPAIGN_DATA via PK even when this node has no static IP.
  // Fall back to direct contact address if permanent route not registered.
  MDS.keypair.get("USER_PERMANENT_ROUTE", function(kpRouteRes) {
    var routeVal = (kpRouteRes && kpRouteRes.status && kpRouteRes.value) ? kpRouteRes.value : "";
    var contactForState4 = (routeVal && routeVal.indexOf("MAX#") === 0) ? routeVal : MY_MX_ADDRESS;
    _swBuildAndPostChannelTxInner(ctx, txId, campaignHex, contactForState4);
  });
}

function _swBuildAndPostChannelTxInner(ctx, txId, campaignHex, contactForState4) {
  var creatorMxHex = "0x" + utf8ToHex(contactForState4).toUpperCase();
  var escrowAddrFallback = ESCROW_ADDRESS_V3 || ESCROW_ADDRESS;

  function fail(stage) {
    MDS.log("[CHANNEL] swBuildAndPostChannelTx failed at " + stage + " campaign: " + ctx.campaignId);
    MDS.cmd("txndelete id:" + txId, function() {});
  }

  if (!escrowAddrFallback) {
    MDS.log("[CHANNEL] swBuildAndPostChannelTx: no escrow address. campaign: " + ctx.campaignId);
    return;
  }

  MDS.cmd("txncreate id:" + txId, function(r1) {
    if (!r1 || !r1.status) { fail("txncreate"); return; }
    MDS.cmd("txninput id:" + txId + " coinid:" + ctx.escrowCoinId + " scriptmmr:true", function(r2) {
      if (!r2 || !r2.status) {
        // The escrow coin is likely in the mempool because a prior split tx
        // (for another viewer/publisher) is still unconfirmed. Persist this
        // channel open as a pending-retry entry so checkPendingChannelOpens
        // re-attempts the full split+open flow once the mempool clears and
        // ESCROW_COINID points to the change coin.
        fail("txninput");
        _enqueuePendingChOpenSplitRetry(ctx);
        return;
      }

      // Use the coin's actual on-chain address so VERIFYOUT(@ADDRESS) passes
      // regardless of escrow script version (V1/V2/V3).
      var coinAddr = escrowAddrFallback;
      try { coinAddr = r2.response.transaction.inputs[0].address || escrowAddrFallback; } catch(e) {}

      // Carry forward ports 5 (platformKey), 6 (maxPubBudget), 7 (status) so
      // ESCROW_SCRIPT_V3's top-level PREVSTATE reads don't throw on next spend.
      var inputStates = [];
      try { inputStates = r2.response.transaction.inputs[0].state || []; } catch(e) {}
      var ps5 = ''; var ps6 = ''; var ps7 = '';
      for (var si = 0; si < inputStates.length; si++) {
        if (inputStates[si].port == 5) { ps5 = inputStates[si].data; }
        if (inputStates[si].port == 6) { ps6 = inputStates[si].data; }
        if (inputStates[si].port == 7) { ps7 = inputStates[si].data; }
      }
      if (!ps7) { ps7 = '0x' + utf8ToHex('active').toUpperCase(); }

      var actualAmount = 0;
      try { actualAmount = parseFloat(r2.response.transaction.inputs[0].amount); } catch(e) {}
      var change = parseFloat((actualAmount - ctx.maxAmount).toFixed(6));
      MDS.log("[CHANNEL] SW split: actual=" + actualAmount + " max=" + ctx.maxAmount + " change=" + change);

      MDS.cmd("txnoutput id:" + txId + " storestate:true amount:" + ctx.maxAmount + " address:" + coinAddr, function(r3) {
        if (!r3 || !r3.status) { fail("txnoutput[split]"); return; }

        function afterChange(r4) {
          if (r4 && !r4.status) { fail("txnoutput[change]"); return; }

          var stateCmds = [
            "txnstate id:" + txId + " port:1 value:" + ctx.walletPK,
            "txnstate id:" + txId + " port:3 value:" + campaignHex,
            "txnstate id:" + txId + " port:4 value:" + creatorMxHex,
            "txnstate id:" + txId + " port:7 value:" + ps7,
            "txnstate id:" + txId + " port:10 value:" + ctx.maxAmount,
            "txnstate id:" + txId + " port:11 value:0"
          ];
          if (ps5) { stateCmds.push("txnstate id:" + txId + " port:5 value:" + ps5); }
          if (ps6) { stateCmds.push("txnstate id:" + txId + " port:6 value:" + ps6); }
          swRunSequential(stateCmds, 0, function(stateOk) {
            if (!stateOk) { fail("txnstate"); return; }

            MDS.cmd("txnsign id:" + txId + " publickey:" + ctx.walletPK, function(r5) {
              if (!r5 || !r5.status) { fail("txnsign"); return; }
              if (r5.pending) {
                MDS.log("[CHANNEL] swBuildAndPostChannelTx: txnsign pending - write mode required. campaign: " + ctx.campaignId);
                MDS.cmd("txndelete id:" + txId, function() {});
                return;
              }

              MDS.cmd("txnpost id:" + txId + " mine:true", function(r6) {
                if (!r6 || !r6.status) { fail("txnpost"); return; }
                if (r6.pending) {
                  MDS.log("[CHANNEL] swBuildAndPostChannelTx: txnpost pending. campaign: " + ctx.campaignId);
                  MDS.cmd("txndelete id:" + txId, function() {});
                  return;
                }

                MDS.cmd("txndelete id:" + txId, function() {});

                var outputs = null;
                try { outputs = r6.response.body.txn.outputs; } catch(e) {}
                if (!outputs || outputs.length === 0) {
                  MDS.log("[CHANNEL] swBuildAndPostChannelTx: no outputs. campaign: " + ctx.campaignId);
                  return;
                }

                var splitCoinId  = outputs[0].coinid;
                var changeCoinId = outputs.length > 1 ? outputs[1].coinid : "";
                MDS.log("[CHANNEL] SW split posted. splitCoinId: " + splitCoinId);

                if (changeCoinId) {
                  sqlQuery(
                    "UPDATE CAMPAIGNS SET ESCROW_COINID = '" + escapeSql(changeCoinId) + "'" +
                    ", BUDGET_REMAINING = " + change +
                    " WHERE UPPER(ID) = UPPER('" + escapeSql(ctx.campaignId) + "')",
                    function(err) {
                      if (err) { MDS.log("[CHANNEL] SW CAMPAIGNS escrow update failed: " + err); }
                      else { MDS.log("[CHANNEL] budget synced from split: " + ctx.campaignId + " remaining=" + change); }
                    }
                  );
                }

                sqlQuery("UPDATE CHANNEL_STATE SET SPLIT_COINID = '" + escapeSql(splitCoinId) + "' " +
                  "WHERE UPPER(CAMPAIGN_ID) = UPPER('" + escapeSql(ctx.campaignId) + "') " +
                  "AND UPPER(VIEWER_KEY) = UPPER('" + escapeSql(ctx.viewerKey) + "') " +
                  "AND UPPER(ROLE) = UPPER('" + escapeSql(ctx.role || 'viewer') + "')", function(scErr) {
                  if (scErr) { MDS.log("[CHANNEL] SW CHANNEL_STATE split_coinid update failed: " + scErr); }
                });

                var ctx2 = {
                  campaignId:    ctx.campaignId,
                  viewerKey:     ctx.viewerKey,
                  viewerMx:      ctx.viewerMx,
                  viewerWalletPK: ctx.viewerWalletPK,
                  maxAmount:     ctx.maxAmount,
                  splitCoinId:   splitCoinId,
                  walletPK:      ctx.walletPK,
                  escrowAddr:    coinAddr,
                  role:          ctx.role,
                  frameId:       ctx.frameId
                };
                swBuildAndPostChannelOpenTx(ctx2);
              });
            });
          });
        }

        if (change > 0) {
          MDS.cmd("txnoutput id:" + txId + " storestate:true amount:" + change + " address:" + coinAddr, afterChange);
        } else {
          afterChange(null);
        }
      });
    });
  });
}

function swBuildAndPostChannelOpenTx(ctx) {
  var txId        = "ch_" + swGenerateUID();
  var campHex     = "0x" + utf8ToHex(ctx.campaignId).toUpperCase();
  var viewerMxHex = "0x" + utf8ToHex(ctx.viewerMx).toUpperCase();
  var channelAddr = CHANNEL_SCRIPT_ADDRESS;

  function fail(stage) {
    MDS.log("[CHANNEL] swBuildAndPostChannelOpenTx failed at " + stage + " campaign: " + ctx.campaignId);
    MDS.cmd("txndelete id:" + txId, function() {});
  }

  if (!channelAddr) {
    MDS.log("[CHANNEL] swBuildAndPostChannelOpenTx: CHANNEL_SCRIPT_ADDRESS not set. campaign: " + ctx.campaignId);
    return;
  }

  swWaitForCoin(ctx.splitCoinId, 20, 200, function(found) {
    if (!found) {
      MDS.log("[CHANNEL] swBuildAndPostChannelOpenTx: split coin not indexed. Queuing for NEWBLOCK. campaign: " + ctx.campaignId);
      MDS.keypair.get("PENDING_CHOPEN_QUEUE", function(qRes) {
        var queue = [];
        try { queue = JSON.parse((qRes && qRes.status && qRes.value) ? qRes.value : "[]"); } catch (e) {}
        var key = ctx.campaignId + "|" + ctx.viewerKey.substring(0, 16).toUpperCase();
        var exists = false;
        for (var qi = 0; qi < queue.length; qi++) {
          if (queue[qi].campaignId + "|" + (queue[qi].viewerKey || "").substring(0, 16).toUpperCase() === key) {
            exists = true;
            break;
          }
        }
        if (!exists) { queue.push(ctx); }
        MDS.keypair.set("PENDING_CHOPEN_QUEUE", JSON.stringify(queue), function() {});
      });
      return;
    }

    MDS.cmd("txncreate id:" + txId, function(r1) {
      if (!r1 || !r1.status) { fail("txncreate"); return; }
      MDS.cmd("txninput id:" + txId + " coinid:" + ctx.splitCoinId + " scriptmmr:true", function(r2) {
        if (!r2 || !r2.status) { fail("txninput"); return; }

        MDS.cmd("txnoutput id:" + txId + " storestate:true amount:" + ctx.maxAmount + " address:" + channelAddr, function(r3) {
          if (!r3 || !r3.status) { fail("txnoutput[channel]"); return; }

          var port2Key  = ctx.viewerWalletPK || ctx.viewerKey;
          var stateCmds = [
            "txnstate id:" + txId + " port:1 value:" + ctx.walletPK,
            "txnstate id:" + txId + " port:2 value:" + port2Key,
            "txnstate id:" + txId + " port:3 value:" + campHex,
            "txnstate id:" + txId + " port:4 value:" + viewerMxHex,
            "txnstate id:" + txId + " port:10 value:" + ctx.maxAmount,
            "txnstate id:" + txId + " port:11 value:0"
          ];
          swRunSequential(stateCmds, 0, function(stateOk) {
            if (!stateOk) { fail("txnstate"); return; }

            MDS.cmd("txnsign id:" + txId + " publickey:" + ctx.walletPK, function(r5) {
              if (!r5 || !r5.status) { fail("txnsign"); return; }
              if (r5.pending) {
                MDS.log("[CHANNEL] swBuildAndPostChannelOpenTx: txnsign pending - write mode required. campaign: " + ctx.campaignId);
                MDS.cmd("txndelete id:" + txId, function() {});
                return;
              }

              MDS.cmd("txnpost id:" + txId + " mine:true", function(r6) {
                if (!r6 || !r6.status) { fail("txnpost"); return; }
                if (r6.pending) {
                  MDS.log("[CHANNEL] swBuildAndPostChannelOpenTx: txnpost pending. campaign: " + ctx.campaignId);
                  MDS.cmd("txndelete id:" + txId, function() {});
                  return;
                }

                MDS.cmd("txndelete id:" + txId, function() {});

                var outputs = null;
                try { outputs = r6.response.body.txn.outputs; } catch(e) {}
                if (!outputs || outputs.length === 0) {
                  MDS.log("[CHANNEL] swBuildAndPostChannelOpenTx: no outputs. campaign: " + ctx.campaignId);
                  return;
                }

                var channelCoinId = outputs[0].coinid;
                MDS.log("[CHANNEL] SW channel coin (" + (ctx.role || "viewer") + "): " + channelCoinId);

                activateChannel(ctx.campaignId, ctx.viewerKey, ctx.role || "viewer", channelCoinId, function(actErr) {
                  if (actErr) { MDS.log("[CHANNEL] SW activateChannel failed: " + actErr); return; }
                  var openMsg = {
                    type:           "CHANNEL_OPEN",
                    campaign_id:    ctx.campaignId,
                    viewer_key:     ctx.viewerKey,
                    channel_coinid: channelCoinId,
                    max_amount:     ctx.maxAmount,
                    role:           ctx.role || "viewer"
                  };
                  if (ctx.role === "publisher" && ctx.frameId) {
                    openMsg.frame_id = ctx.frameId;
                  }
                  sendMaxima(ctx.viewerKey, ctx.viewerMx, openMsg, function(ok) {
                    MDS.log("[CHANNEL] SW CHANNEL_OPEN sent (" + (ctx.role || "viewer") + ") ok=" + ok);
                    if ((ctx.role || 'viewer') === 'publisher' && ctx.frameId) {
                      _replayDeferredPublisherRewards(ctx.campaignId, ctx.frameId, ctx.viewerKey);
                    }
                  });
                });
              });
            });
          });
        });
      });
    });
  });
}

// ---------------------------------------------------------------------------
// checkOpenChannelsSettled — runs on NEWBLOCK to detect on-chain settlement
// of open channels (spent coins) and transition them to settled in DB.
// Fix 1: adds a 60-second grace period to avoid settling a channel whose coin
// was just created by swBuildAndPostChannelOpenTx and isn't yet locally
// indexed, even though the TX has been mined. This prevents the race where
// checkOpenChannelsSettled fires in the same NEWBLOCK event as Tx2 and
// immediately settles the channel before checkPendingVouchers can process it.
// ---------------------------------------------------------------------------
function checkOpenChannelsSettled() {
  var chAddr = CHANNEL_SCRIPT_ADDRESS || '';
  if (!chAddr) { return; }

  var sql = "SELECT CAMPAIGN_ID, VIEWER_KEY, ROLE, CHANNEL_COINID, CREATED_AT FROM CHANNEL_STATE WHERE STATUS = 'open'";
  sqlQuery(sql, function(err, rows) {
    if (err || !rows || rows.length === 0) { return; }

    MDS.cmd("coins address:" + chAddr, function(cRes) {
      var coins = (cRes && cRes.status && cRes.response) ? cRes.response : [];
      var activeCoinIds = {};
      for (var i = 0; i < coins.length; i++) {
        if (coins[i].coinid) {
          activeCoinIds[coins[i].coinid.toUpperCase()] = true;
        }
      }

      var now = Date.now();
      for (var j = 0; j < rows.length; j++) {
        var row = rows[j];
        var coinId = row.CHANNEL_COINID || '';
        if (coinId && !activeCoinIds[coinId.toUpperCase()]) {
          // Grace period: skip settling channels activated within the last 60 s.
          // The channel coin may not be locally indexed yet even though the TX
          // was mined in this block — indexation lags by up to one block event.
          var age = now - parseInt(row.CREATED_AT || 0);
          if (age < 60000) {
            MDS.log("[CHANNEL] checkOpenChannelsSettled: coin " + coinId.substring(0, 18) + "... not found but channel is new (age=" + age + "ms) — grace period, skipping settle.");
          } else {
            MDS.log("[CHANNEL] checkOpenChannelsSettled: channel coin " + coinId + " spent/settled on-chain! Settling locally.");
            (function(r) {
              settleChannel(r.CAMPAIGN_ID, r.VIEWER_KEY, r.ROLE || 'viewer', function(settleErr) {
                if (settleErr) {
                  MDS.log("[CHANNEL] checkOpenChannelsSettled: settleChannel failed for " + r.CAMPAIGN_ID + " error: " + settleErr);
                } else {
                  _signalCampaignUpdated(r.CAMPAIGN_ID);
                }
              });
            })(row);
          }
        }
      }
    });
  });
}
