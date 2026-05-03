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

function handleChannelOpenRequest(payload) {
  if (!payload.campaign_id || !payload.viewer_key || !payload.viewer_mx || payload.max_amount === undefined) {
    MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST missing required fields");
    return;
  }

  var campaignId       = payload.campaign_id;
  var viewerKey        = payload.viewer_key;
  var viewerMx         = payload.viewer_mx;
  var maxAmount        = parseFloat(payload.max_amount);
  var viewerWalletAddr = payload.viewer_wallet_addr || '';
  var role             = payload.role || 'viewer';
  var frameId          = payload.frame_id || '';

  if (role === 'publisher') {
    if (!frameId) {
      MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST (publisher): missing frame_id");
      return;
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
      var pubRemaining = (parseFloat(campaign.MAX_PUBLISHER_BUDGET) || 0) - (parseFloat(campaign.PUBLISHER_BUDGET_SPENT) || 0);
      if (pubRemaining < maxAmount) {
        MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST (publisher): insufficient publisher budget. remaining: " + pubRemaining + " requested: " + maxAmount);
        return;
      }

      getChannelState(campaignId, viewerKey, 'publisher', function(chErr, existing) {
        if (!chErr && existing && (existing.STATUS === 'pending' || existing.STATUS === 'open')) {
          MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST (publisher): channel already " + existing.STATUS + ", skipping. campaign: " + campaignId);
          return;
        }

        openChannel(campaignId, viewerKey, viewerMx, maxAmount, 'publisher', frameId, viewerWalletAddr, function(openErr) {
          if (openErr) {
            MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST (publisher): openChannel failed: " + openErr);
            return;
          }
          var bumpSql = "UPDATE CAMPAIGNS SET PUBLISHER_BUDGET_SPENT = COALESCE(PUBLISHER_BUDGET_SPENT, 0) + " + maxAmount +
            " WHERE UPPER(ID) = UPPER('" + escapeSql(campaignId) + "')";
          sqlQuery(bumpSql, function(bumpErr) {
            if (bumpErr) {
              MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST (publisher): PUBLISHER_BUDGET_SPENT bump failed: " + bumpErr);
            }
            MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST (publisher): channel pending. campaign: " + campaignId + " viewer_key: " + viewerKey);
            signalFE("DO_PUBLISHER_CHANNEL_OPEN", {
              campaign_id:   campaignId,
              publisher_key: viewerKey,
              publisher_mx:  viewerMx,
              frame_id:      frameId,
              max_amount:    maxAmount
            });
          });
        });
      });
    });
  } else {
    getCampaign(campaignId, function(err, campaign) {
      if (err || !campaign) {
        MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST: campaign not found: " + campaignId);
        return;
      }
      if (campaign.STATUS !== 'active') {
        MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST: campaign not active: " + campaignId + " status: " + campaign.STATUS);
        return;
      }
      if (parseFloat(campaign.BUDGET_REMAINING) < maxAmount) {
        MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST: insufficient budget. remaining: " + campaign.BUDGET_REMAINING + " requested: " + maxAmount);
        return;
      }

      getChannelState(campaignId, viewerKey, 'viewer', function(chErr, existing) {
        if (!chErr && existing && (existing.STATUS === 'pending' || existing.STATUS === 'open')) {
          MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST: channel already " + existing.STATUS + ", skipping. campaign: " + campaignId);
          return;
        }

        openChannel(campaignId, viewerKey, viewerMx, maxAmount, 'viewer', '', viewerWalletAddr, function(openErr) {
          if (openErr) {
            MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST: openChannel failed: " + openErr);
            return;
          }
          MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST: channel pending. campaign: " + campaignId + " viewer_key: " + viewerKey);
          signalFE("DO_CHANNEL_OPEN", {
            campaign_id:        campaignId,
            viewer_key:         viewerKey,
            viewer_mx:          viewerMx,
            max_amount:         maxAmount,
            viewer_wallet_addr: viewerWalletAddr
          });
        });
      });
    });
  }
}

function handleChannelOpen(payload) {
  if (!payload.campaign_id || !payload.viewer_key || !payload.channel_coinid) {
    MDS.log("[CHANNEL] CHANNEL_OPEN missing required fields");
    return;
  }

  var campaignId    = payload.campaign_id;
  var viewerKey     = payload.viewer_key;
  var channelCoinId = payload.channel_coinid;
  var maxAmount     = payload.max_amount;
  var role          = payload.role || 'viewer';

  activateChannel(campaignId, viewerKey, role, channelCoinId, function(err) {
    if (err) {
      MDS.log("[CHANNEL] CHANNEL_OPEN: activateChannel failed: " + err);
      return;
    }
    MDS.log("[CHANNEL] CHANNEL_OPEN: channel activated. campaign: " + campaignId + " coinId: " + channelCoinId + " role: " + role);
    signalFE("CHANNEL_OPENED", {
      campaign_id:    campaignId,
      channel_coinid: channelCoinId,
      max_amount:     maxAmount
    });
  });
}

function handleRewardRequest(payload) {
  if (!payload.campaign_id || !payload.viewer_key || !payload.event_id || payload.cumulative === undefined) {
    MDS.log("[CHANNEL] REWARD_REQUEST missing required fields");
    return;
  }

  var campaignId = payload.campaign_id;
  var viewerKey  = payload.viewer_key;
  var eventId    = payload.event_id;
  var cumulative = parseFloat(payload.cumulative);
  var role       = payload.role || 'viewer';
  var frameId    = payload.frame_id || '';

  getChannelState(campaignId, viewerKey, role, function(err, channel) {
    if (err || !channel) {
      MDS.log("[CHANNEL] REWARD_REQUEST: channel not found. campaign: " + campaignId + " viewer_key: " + viewerKey + " role: " + role);
      return;
    }
    if (channel.STATUS !== 'open') {
      MDS.log("[CHANNEL] REWARD_REQUEST: channel not open. status: " + channel.STATUS + " role: " + role);
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

      MDS.cmd("coins coinid:" + channelCoinId + " relevant:true", function(coinRes) {
        var indexed = coinRes && coinRes.status && coinRes.response && coinRes.response.length > 0;
        if (indexed) {
          if (role === 'publisher') {
            MDS.log("[CHANNEL] REWARD_REQUEST (publisher): coin indexed. signalling DO_PUBLISHER_REWARD_VOUCHER. campaign: " + campaignId + " cumulative: " + cumulative);
            signalFE("DO_PUBLISHER_REWARD_VOUCHER", {
              campaign_id: campaignId,
              viewer_key:  viewerKey,
              viewer_mx:   channel.CREATOR_MX,
              event_id:    eventId,
              cumulative:  cumulative,
              frame_id:    channelFrameId
            });
          } else {
            MDS.log("[CHANNEL] REWARD_REQUEST: coin indexed. signalling DO_REWARD_VOUCHER. campaign: " + campaignId + " cumulative: " + cumulative);
            signalFE("DO_REWARD_VOUCHER", {
              campaign_id: campaignId,
              viewer_key:  viewerKey,
              viewer_mx:   channel.CREATOR_MX,
              event_id:    eventId,
              cumulative:  cumulative
            });
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
            frame_id:       channelFrameId
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
        signalFE("VOUCHER_RECEIVED", {
          campaign_id: campaignId,
          cumulative:  cumulative,
          role:        'publisher',
          frame_id:    frameId
        });
      } else {
        signalFE("VOUCHER_RECEIVED", {
          campaign_id: campaignId,
          cumulative:  cumulative
        });
      }
    });
  });
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
      signalFE("DO_SEND_VOUCHER", {
        campaign_id: campaignId,
        viewer_key:  viewerKey,
        viewer_mx:   viewerMx,
        cumulative:  parseFloat(channel.CUMULATIVE_EARNED),
        tx_hex:      channel.LATEST_TX_HEX
      });
    } else {
      MDS.log("[CHANNEL] VOUCHER_SYNC_REQUEST: no voucher yet, signalling FE to resend CHANNEL_OPEN. campaign: " + campaignId);
      signalFE("DO_RESEND_CHANNEL_OPEN", {
        campaign_id:    campaignId,
        viewer_key:     viewerKey,
        viewer_mx:      viewerMx,
        channel_coinid: channel.CHANNEL_COINID,
        max_amount:     parseFloat(channel.MAX_AMOUNT)
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
// checkPendingVouchers — called on every NEWBLOCK from main.js.
// For each open channel, checks if a queued REWARD_REQUEST is waiting for
// the channel coin to be indexed. Once the coin is visible, dispatches
// DO_REWARD_VOUCHER or DO_PUBLISHER_REWARD_VOUCHER and clears the queue.
// Rhino-safe: var, function(), string concat, no arrow functions, no trailing commas.
// ---------------------------------------------------------------------------
function checkPendingVouchers() {
  var sql = "SELECT CAMPAIGN_ID, VIEWER_KEY, ROLE, CHANNEL_COINID, CREATOR_MX"
          + " FROM CHANNEL_STATE WHERE STATUS = 'open'";
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

    MDS.cmd("coins coinid:" + channelCoinId + " relevant:true", function(coinRes) {
      var indexed = coinRes && coinRes.status && coinRes.response && coinRes.response.length > 0;
      if (!indexed) {
        return;
      }

      MDS.keypair.set(kpKey, '', function() {
        MDS.log("[CHANNEL] pending voucher found, signalling FE: " + campaignId + " cumulative: " + pending.cumulative + " role: " + r);
        if (r === 'publisher') {
          signalFE("DO_PUBLISHER_REWARD_VOUCHER", {
            campaign_id: pending.campaign_id,
            viewer_key:  pending.viewer_key,
            viewer_mx:   pending.viewer_mx,
            event_id:    pending.event_id,
            cumulative:  pending.cumulative,
            frame_id:    pending.frame_id || ''
          });
        } else {
          signalFE("DO_REWARD_VOUCHER", {
            campaign_id: pending.campaign_id,
            viewer_key:  pending.viewer_key,
            viewer_mx:   pending.viewer_mx,
            event_id:    pending.event_id,
            cumulative:  pending.cumulative
          });
        }
      });
    });
  });
}
