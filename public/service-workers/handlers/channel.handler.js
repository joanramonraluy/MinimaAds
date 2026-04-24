// T-CH3 — SW: channel.handler.js
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

  var campaignId = payload.campaign_id;
  var viewerKey  = payload.viewer_key;
  var viewerMx   = payload.viewer_mx;
  var maxAmount  = parseFloat(payload.max_amount);

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

    openChannel(campaignId, viewerKey, viewerMx, maxAmount, function(openErr) {
      if (openErr) {
        MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST: openChannel failed: " + openErr);
        return;
      }
      MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST: channel pending. campaign: " + campaignId + " viewer_key: " + viewerKey);
      signalFE("DO_CHANNEL_OPEN", {
        campaign_id: campaignId,
        viewer_key: viewerKey,
        viewer_mx: viewerMx,
        max_amount: maxAmount
      });
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
  var maxAmount     = payload.max_amount;

  activateChannel(campaignId, viewerKey, channelCoinId, function(err) {
    if (err) {
      MDS.log("[CHANNEL] CHANNEL_OPEN: activateChannel failed: " + err);
      return;
    }
    MDS.log("[CHANNEL] CHANNEL_OPEN: channel activated. campaign: " + campaignId + " coinId: " + channelCoinId);
    signalFE("CHANNEL_OPENED", {
      campaign_id: campaignId,
      channel_coinid: channelCoinId,
      max_amount: maxAmount
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

  getChannelState(campaignId, viewerKey, function(err, channel) {
    if (err || !channel) {
      MDS.log("[CHANNEL] REWARD_REQUEST: channel not found. campaign: " + campaignId + " viewer_key: " + viewerKey);
      return;
    }
    if (channel.STATUS !== 'open') {
      MDS.log("[CHANNEL] REWARD_REQUEST: channel not open. status: " + channel.STATUS);
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

      MDS.log("[CHANNEL] REWARD_REQUEST: valid. campaign: " + campaignId + " cumulative: " + cumulative);
      signalFE("DO_REWARD_VOUCHER", {
        campaign_id: campaignId,
        viewer_key: viewerKey,
        viewer_mx: channel.CREATOR_MX,
        event_id: eventId,
        cumulative: cumulative
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

  updateChannelVoucher(campaignId, viewerKey, cumulative, txHex, function(err) {
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
      MDS.log("[CHANNEL] REWARD_VOUCHER: voucher stored. campaign: " + campaignId + " cumulative: " + cumulative);
      signalFE("VOUCHER_RECEIVED", {
        campaign_id: campaignId,
        cumulative: cumulative
      });
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

  getChannelState(campaignId, viewerKey, function(err, channel) {
    if (err || !channel) {
      MDS.log("[CHANNEL] VOUCHER_SYNC_REQUEST: channel not found. campaign: " + campaignId);
      return;
    }

    var viewerMx = channel.CREATOR_MX;

    if (channel.LATEST_TX_HEX && channel.LATEST_TX_HEX !== '') {
      MDS.log("[CHANNEL] VOUCHER_SYNC_REQUEST: resending voucher. campaign: " + campaignId);
      signalFE("DO_SEND_VOUCHER", {
        campaign_id: campaignId,
        viewer_key: viewerKey,
        viewer_mx: viewerMx,
        cumulative: parseFloat(channel.CUMULATIVE_EARNED),
        tx_hex: channel.LATEST_TX_HEX
      });
    } else {
      MDS.log("[CHANNEL] VOUCHER_SYNC_REQUEST: no voucher yet, signalling FE to resend CHANNEL_OPEN. campaign: " + campaignId);
      signalFE("DO_RESEND_CHANNEL_OPEN", {
        campaign_id: campaignId,
        viewer_key: viewerKey,
        viewer_mx: viewerMx,
        channel_coinid: channel.CHANNEL_COINID,
        max_amount: parseFloat(channel.MAX_AMOUNT)
      });
    }
  });
}
