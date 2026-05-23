// Cross-dapp comms handler — handles MA_* messages via MDS.comms.broadcast.
// Called from service.js onComms(). Rhino-safe syntax.
//
// Protocol (cross-dapp):
//   MA_GET_AD    {userAddress, interests[]}  → MA_AD_RESPONSE {found, ad?}
//   MA_TRACK_VIEW {campaignId, userAddress}  → MA_TRACK_RESULT {confirmed, amount?, reason?}
//
// After a confirmed view, _triggerChannelPayment initiates the payment channel:
//   - No channel: sends CHANNEL_OPEN_REQUEST via Maxima to creator
//   - Channel open: sends REWARD_REQUEST via Maxima to creator

function handleGetAd(payload) {
  var userAddress = payload.userAddress || "";
  var interestsRaw = payload.interests || [];
  var interests = Array.isArray(interestsRaw) ? interestsRaw.join(',') : (interestsRaw || '');

  getCampaigns(function(err, campaigns) {
    if (err || !campaigns || campaigns.length === 0) {
      MDS.comms.broadcast(JSON.stringify({type: "MA_AD_RESPONSE", found: false}), function() {});
      return;
    }
    sqlQuery(
      "SELECT ID, CAMPAIGN_ID, TITLE, BODY, CTA_LABEL, CTA_URL, INTERESTS, IMAGE_DATA, SHOW_TITLE, SHOW_BODY, SHOW_CTA, BG_COLOR, TEXT_COLOR, IMAGE_POSITION, IMAGE_ZOOM, IMAGE_WIDTH_PCT FROM ADS",
      function(err2, adRows) {
        if (err2) {
          MDS.comms.broadcast(JSON.stringify({type: "MA_AD_RESPONSE", found: false}), function() {});
          return;
        }
        var byCampaign = {};
        var adList = adRows || [];
        for (var i = 0; i < adList.length; i++) {
          var ad = adList[i];
          if (ad.CAMPAIGN_ID) { byCampaign[ad.CAMPAIGN_ID.toUpperCase()] = ad; }
        }
        for (var j = 0; j < campaigns.length; j++) {
          var c = campaigns[j];
          var adData = byCampaign[(c.ID || "").toUpperCase()];
          if (adData) {
            c.AD_ID        = adData.ID;
            c.AD_TITLE     = adData.TITLE;
            c.AD_BODY      = adData.BODY;
            c.AD_CTA_LABEL = adData.CTA_LABEL;
            c.AD_CTA_URL   = adData.CTA_URL;
            c.AD_INTERESTS = adData.INTERESTS;
            c.AD_IMAGE_DATA  = adData.IMAGE_DATA || null;
            c.AD_SHOW_TITLE  = (adData.SHOW_TITLE !== null && adData.SHOW_TITLE !== undefined) ? parseInt(adData.SHOW_TITLE, 10) : 1;
            c.AD_SHOW_BODY   = (adData.SHOW_BODY !== null && adData.SHOW_BODY !== undefined) ? parseInt(adData.SHOW_BODY, 10) : 1;
            c.AD_SHOW_CTA    = (adData.SHOW_CTA !== null && adData.SHOW_CTA !== undefined) ? parseInt(adData.SHOW_CTA, 10) : 1;
            c.AD_BG_COLOR       = adData.BG_COLOR       || '#ffffff';
            c.AD_TEXT_COLOR     = adData.TEXT_COLOR     || '#111111';
            c.AD_IMAGE_POSITION = adData.IMAGE_POSITION || 'center';
            c.AD_IMAGE_ZOOM      = (adData.IMAGE_ZOOM !== null && adData.IMAGE_ZOOM !== undefined) ? parseFloat(adData.IMAGE_ZOOM) : 1.0;
            c.AD_IMAGE_WIDTH_PCT = (adData.IMAGE_WIDTH_PCT !== null && adData.IMAGE_WIDTH_PCT !== undefined) ? parseInt(adData.IMAGE_WIDTH_PCT, 10) : 40;
          }
        }
        var selected = selectAd(userAddress, interests, campaigns);
        if (!selected) {
          MDS.log("[COMMS] MA_GET_AD — no eligible ad for " + userAddress.substring(0, 10) + "...");
          MDS.comms.broadcast(JSON.stringify({type: "MA_AD_RESPONSE", found: false}), function() {});
          return;
        }
        MDS.log("[COMMS] MA_GET_AD → serving campaign:" + selected.ID);
        MDS.comms.broadcast(JSON.stringify({
          type: "MA_AD_RESPONSE",
          found: true,
          ad: {
            campaign_id:  selected.ID,
            title:        selected.AD_TITLE || "",
            body:         selected.AD_BODY || "",
            cta_label:    selected.AD_CTA_LABEL || "",
            cta_url:      selected.AD_CTA_URL || "",
            image_data:   selected.AD_IMAGE_DATA || null,
            show_title:   (selected.AD_SHOW_TITLE !== undefined && selected.AD_SHOW_TITLE !== null) ? selected.AD_SHOW_TITLE : 1,
            show_body:    (selected.AD_SHOW_BODY !== undefined && selected.AD_SHOW_BODY !== null) ? selected.AD_SHOW_BODY : 1,
            show_cta:     (selected.AD_SHOW_CTA !== undefined && selected.AD_SHOW_CTA !== null) ? selected.AD_SHOW_CTA : 1,
            bg_color:       selected.AD_BG_COLOR       || '#ffffff',
            text_color:     selected.AD_TEXT_COLOR     || '#111111',
            image_position:  selected.AD_IMAGE_POSITION || 'center',
            image_zoom:      selected.AD_IMAGE_ZOOM !== undefined ? selected.AD_IMAGE_ZOOM : 1.0,
            image_width_pct: selected.AD_IMAGE_WIDTH_PCT !== undefined ? selected.AD_IMAGE_WIDTH_PCT : 40,
            reward_view:  selected.REWARD_VIEW || 0
          }
        }), function() {});
      }
    );
  });
}

function handleTrackView(payload) {
  var campaignId   = payload.campaignId || "";
  var userAddress  = payload.userAddress || "";
  var publisherKey = payload.publisherKey || "";

  if (!campaignId || !userAddress) {
    MDS.comms.broadcast(JSON.stringify({type: "MA_TRACK_RESULT", confirmed: false, reason: "missing fields"}), function() {});
    return;
  }

  validateView(campaignId, userAddress, function(result) {
    if (!result.valid) {
      MDS.log("[COMMS] MA_TRACK_VIEW rejected: " + result.reason);
      MDS.comms.broadcast(JSON.stringify({type: "MA_TRACK_RESULT", confirmed: false, reason: result.reason}), function() {});
      return;
    }
    getCampaign(campaignId, function(err, campaign) {
      if (err || !campaign) {
        MDS.comms.broadcast(JSON.stringify({type: "MA_TRACK_RESULT", confirmed: false, reason: "campaign not found"}), function() {});
        return;
      }
      if (campaign.CREATOR_ADDRESS.toUpperCase() === userAddress.toUpperCase()) {
        MDS.comms.broadcast(JSON.stringify({type: "MA_TRACK_RESULT", confirmed: false, reason: "creator cannot earn"}), function() {});
        return;
      }
      sqlQuery(
        "SELECT ID FROM ADS WHERE UPPER(CAMPAIGN_ID) = UPPER('" + escapeSql(campaignId) + "')",
        function(err2, rows) {
          var adId   = (rows && rows.length > 0) ? rows[0].ID : "";
          var amount = parseFloat(campaign.REWARD_VIEW) || 0;
          createRewardEvent({
            campaign_id:  campaignId,
            ad_id:        adId,
            user_address: userAddress,
            type:         "view",
            amount:       amount,
            publisher_id: publisherKey || null
          }, function(err3, evt) {
            if (err3 || !evt) {
              MDS.comms.broadcast(JSON.stringify({type: "MA_TRACK_RESULT", confirmed: false, reason: "reward event failed"}), function() {});
              return;
            }
            MDS.log("[COMMS] MA_TRACK_VIEW confirmed: campaign=" + campaignId + " amount=" + amount);
            MDS.comms.broadcast(JSON.stringify({type: "MA_TRACK_RESULT", confirmed: true, amount: amount}), function() {});
            _triggerChannelPayment(campaignId, campaign, userAddress, amount, evt.id, publisherKey);
          });
        }
      );
    });
  });
}

function _triggerChannelPayment(campaignId, campaign, userAddress, amount, eventId, publisherKey) {
  getChannelState(campaignId, MY_MAXIMA_PK, 'viewer', function(err, channel) {
    if (err || !channel || channel.STATUS === 'settled') {
      _sendChannelOpenRequest(campaignId, campaign, userAddress, amount, eventId, publisherKey);
    } else if (channel.STATUS === 'open') {
      var cumulative = parseFloat(channel.CUMULATIVE_EARNED) + amount;
      _sendRewardRequest(campaignId, campaign, channel, eventId, cumulative, publisherKey);
    } else {
      MDS.log("[COMMS] channel " + channel.STATUS + " for campaign: " + campaignId + " — reward pending channel open");
    }
  });
}

function _sendChannelOpenRequest(campaignId, campaign, _viewerMxContact, amount, eventId, publisherKey) {
  if (!MY_MAXIMA_PK || !campaign.CREATOR_ADDRESS) {
    MDS.log("[COMMS] CHANNEL_OPEN_REQUEST skipped — MY_MAXIMA_PK or CREATOR_ADDRESS missing");
    return;
  }
  MDS.keypair.get("VIEWER_WALLET_PK_" + campaignId, function(pkRes) {
    if (pkRes && pkRes.status && pkRes.value) {
      _resolveViewerAddrAndSend(campaignId, campaign, pkRes.value, amount, eventId, publisherKey);
    } else {
      MDS.cmd("keys action:new", function(keysRes) {
        if (!keysRes || !keysRes.status || !keysRes.response || !keysRes.response.publickey) {
          MDS.log("[COMMS] CHANNEL_OPEN_REQUEST: keys action:new failed — cannot generate viewer wallet key");
          return;
        }
        var walletPK = keysRes.response.publickey;
        MDS.keypair.set("VIEWER_WALLET_PK_" + campaignId, walletPK, function() {
          _resolveViewerAddrAndSend(campaignId, campaign, walletPK, amount, eventId, publisherKey);
        });
      });
    }
  });
}

// Gets a coinbase wallet address via getaddress (cached in keypair).
// Settlement coins sent here are immediately available in the wallet.
function _resolveViewerAddrAndSend(campaignId, campaign, walletPK, amount, eventId, publisherKey) {
  MDS.keypair.get("VIEWER_WALLET_ADDR_" + campaignId, function(addrRes) {
    if (addrRes && addrRes.status && addrRes.value) {
      _doSendChannelOpenRequest(campaignId, campaign, addrRes.value, amount, eventId, publisherKey, walletPK);
      return;
    }
    MDS.cmd("getaddress", function(gaRes) {
      if (!gaRes || !gaRes.status || !gaRes.response || !gaRes.response.address) {
        MDS.log("[COMMS] CHANNEL_OPEN_REQUEST: getaddress failed — cannot get viewer wallet addr");
        return;
      }
      var walletAddr = gaRes.response.address;
      MDS.keypair.set("VIEWER_WALLET_ADDR_" + campaignId, walletAddr, function() {
        _doSendChannelOpenRequest(campaignId, campaign, walletAddr, amount, eventId, publisherKey, walletPK);
      });
    });
  });
}

function _doSendChannelOpenRequest(campaignId, campaign, viewerWalletAddr, amount, eventId, publisherKey, viewerWalletPK) {
  var capExplicit = parseFloat(campaign.MAX_VIEWER_REWARD) || 0;
  var perView = parseFloat(campaign.REWARD_VIEW) || 0;
  var maxAmount = capExplicit > 0 ? capExplicit : perView * 10;
  var payload = {
    type:               "CHANNEL_OPEN_REQUEST",
    campaign_id:        campaignId,
    viewer_key:         MY_MAXIMA_PK,
    viewer_mx:          MY_MX_ADDRESS,
    viewer_wallet_addr: viewerWalletAddr,
    viewer_wallet_pk:   viewerWalletPK,
    max_amount:         maxAmount,
    role:               "viewer"
  };
  var pendingReward = JSON.stringify({
    event_id:        eventId || '',
    cumulative:      amount,
    publisher_key:   publisherKey || '',
    creator_address: campaign.CREATOR_ADDRESS
  });
  MDS.keypair.set("PENDING_REWARD_" + campaignId, pendingReward, function() {
    MDS.keypair.get("CREATOR_MX_" + campaignId, function(kpRes) {
      var creatorMx = (kpRes && kpRes.status && kpRes.value) ? kpRes.value : null;
      sendMaxima(campaign.CREATOR_ADDRESS, creatorMx, payload, function(ok) {
        MDS.log("[COMMS] CHANNEL_OPEN_REQUEST sent: campaign=" + campaignId + " max=" + maxAmount + " ok=" + ok);
      });
    });
  });
}

// ---------------------------------------------------------------------------
// handleOpenPublisherChannels — runs on the PUBLISHER node.
// Triggered by the FE (MA_OPEN_PUBLISHER_CHANNELS via MDS.comms.broadcast) when a
// new custom frame is created. For every active campaign that offers a
// publisher reward, opens a publisher channel with the creator so that
// _maybeGeneratePublisherVoucher on the creator can pay commissions without
// needing to look up the frame in its own FRAMES table.
// ---------------------------------------------------------------------------
function handleOpenPublisherChannels(payload) {
  var frameId     = payload.frame_id || '';
  var publisherMx = payload.publisher_mx || '';
  if (!frameId) {
    MDS.log("[COMMS] MA_OPEN_PUBLISHER_CHANNELS: missing frame_id");
    return;
  }
  if (typeof getFrame !== 'function') { return; }
  getFrame(frameId, function(err, frame) {
    if (err || !frame) { return; }
    getCampaigns(function(err2, campaigns) {
      if (err2 || !campaigns || campaigns.length === 0) {
        MDS.log("[COMMS] MA_OPEN_PUBLISHER_CHANNELS: no campaigns found — channels will open when campaigns arrive");
        return;
      }
      MDS.log("[COMMS] MA_OPEN_PUBLISHER_CHANNELS: frame found. opening publisher channels for " + campaigns.length + " campaigns. frame: " + frameId);
      for (var i = 0; i < campaigns.length; i++) {
        var c = campaigns[i];
        if (c.STATUS === 'active' && parseFloat(c.PUBLISHER_REWARD_VIEW) > 0) {
          _tryOpenPublisherChannel(c, frameId);
        }
      }
    });
  });
}

function _tryOpenPublisherChannel(campaign, frameId) {
  var campaignId = campaign.ID;
  if (!campaign.CREATOR_ADDRESS) {
    MDS.log("[COMMS] _tryOpenPublisherChannel: CREATOR_ADDRESS missing. campaign: " + campaignId);
    return;
  }
  getChannelState(campaignId, MY_MAXIMA_PK, 'publisher', function(chErr, ch) {
    if (!chErr && ch && (ch.STATUS === 'open' || ch.STATUS === 'pending')) {
      MDS.log("[COMMS] publisher channel already open/pending. campaign: " + campaignId);
      return;
    }
    MDS.keypair.get("VIEWER_WALLET_PK_" + campaignId, function(pkRes) {
      if (pkRes && pkRes.status && pkRes.value) {
        _doSendPublisherChannelOpenRequest(campaignId, campaign, frameId, '', pkRes.value);
      } else {
        MDS.cmd("keys action:new", function(keysRes) {
          if (!keysRes || !keysRes.status || !keysRes.response || !keysRes.response.publickey) {
            MDS.log("[COMMS] _tryOpenPublisherChannel: keys action:new failed. campaign: " + campaignId);
            return;
          }
          var walletPK = keysRes.response.publickey;
          MDS.keypair.set("VIEWER_WALLET_PK_" + campaignId, walletPK, function() {
            _doSendPublisherChannelOpenRequest(campaignId, campaign, frameId, '', walletPK);
          });
        });
      }
    });
  });
}

// Called by campaign.handler.js after a campaign is persisted (ANNOUNCE or DATA_RESPONSE).
// Iterates all local frames and tries to open a publisher channel for the new campaign,
// covering the race where MA_OPEN_PUBLISHER_CHANNELS fired before campaigns arrived.
function _tryOpenPublisherChannelForAllFrames(campaignId) {
  getCampaign(campaignId, function(err, campaign) {
    if (err || !campaign) { return; }
    if (campaign.STATUS !== 'active') { return; }
    if (!(parseFloat(campaign.PUBLISHER_REWARD_VIEW) > 0)) { return; }
    listFrames(function(fErr, frames) {
      if (fErr || !frames || frames.length === 0) { return; }
      var customCount = 0;
      for (var i = 0; i < frames.length; i++) {
        var isBuiltin = (frames[i].IS_BUILTIN === 'true' || frames[i].IS_BUILTIN === true);
        if (!isBuiltin && frames[i].FRAME_ID) {
          customCount++;
          _tryOpenPublisherChannel(campaign, frames[i].FRAME_ID);
        }
      }
      MDS.log("[COMMS] _tryOpenPublisherChannelForAllFrames: " + customCount + " custom frame(s) for campaign: " + campaignId);
    });
  });
}

function _sendRewardRequest(campaignId, campaign, channel, eventId, cumulative, publisherKey) {
  if (!MY_MAXIMA_PK || !campaign.CREATOR_ADDRESS) {
    MDS.log("[COMMS] REWARD_REQUEST skipped — MY_MAXIMA_PK or CREATOR_ADDRESS missing");
    return;
  }
  var payload = {
    type:          "REWARD_REQUEST",
    campaign_id:   campaignId,
    viewer_key:    MY_MAXIMA_PK,
    event_id:      eventId,
    cumulative:    cumulative,
    role:          "viewer",
    publisher_key: publisherKey || ""
  };
  MDS.keypair.get("CREATOR_MX_" + campaignId, function(kpRes) {
    var creatorMx = (kpRes && kpRes.status && kpRes.value) ? kpRes.value : null;
    sendMaxima(campaign.CREATOR_ADDRESS, creatorMx, payload, function(ok) {
      MDS.log("[COMMS] REWARD_REQUEST sent: campaign=" + campaignId + " cumulative=" + cumulative + " ok=" + ok);
    });
  });
}
