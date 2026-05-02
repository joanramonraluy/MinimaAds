// T-CH5 — SDK: sdk/index.js
// Public publisher API: MinimaAds.{init, getAd, render, trackView, trackClick}.
// Callback-based to match Core API pattern (MinimaAds.md §7.5).
//
// Depends on (loaded before this file):
//   core/minima.js, core/campaigns.js, core/selection.js,
//   core/validation.js, core/rewards.js, core/channels.js, renderer/renderAd.js
//
// Channel integration (MinimaAds.md §6.5–6.8, §8.8–8.12):
//   After createRewardEvent() succeeds, _trackEvent runs the channel flow:
//     - no CHANNEL_STATE row   → open channel (keys action:new, openChannel,
//                                  store pending marker, send CHANNEL_OPEN_REQUEST)
//     - status = 'pending'     → accumulate pending marker, wait for CHANNEL_OPEN
//     - status = 'open'        → send REWARD_REQUEST with new cumulative
//
// Pending rewards are mirrored to keypair for survival across reloads. Since
// MDS.keypair has no list API, we keep a per-campaign index of pending event_ids
// (MA_PENDING_EVENTS_<campaign_id>) alongside per-event markers
// (MA_PENDING_REWARD_<campaign_id>_<event_id>).
//
// CREATOR_MX on the viewer node stores CAMPAIGNS.CREATOR_ADDRESS (Maxima
// public key). We reach the creator via `maxima action:send publickey:<pk>`
// rather than `to:<Mx>` because the Mx contact string is not carried by the
// CAMPAIGN_ANNOUNCE schema (MinimaAds.md §8.3). Both routes are valid under
// Maxima; pk is what we already have in CAMPAIGNS.

(function() {
  var _config = null;
  var _inited = false;
  var _reconnectDone = false;
  var _activeFrameId = null;

  function _resolveFrame(config, cb) {
    var frameId = config.frameId || config.publisher_id || null;

    if (frameId) {
      if (typeof getFrame !== 'function') {
        _activeFrameId = frameId;
        if (cb) { cb(null); }
        return;
      }
      getFrame(frameId, function(err, frame) {
        if (err) { if (cb) { cb(err); } return; }
        if (!frame) { if (cb) { cb(new Error('UNKNOWN_FRAME')); } return; }
        _activeFrameId = frame.FRAME_ID;
        if (cb) { cb(null); }
      });
      return;
    }

    // No frameId — resolve builtin frame for this node
    MDS.cmd('maxima action:info', function(res) {
      if (!res || !res.status || !res.response || !res.response.publickey) {
        if (cb) { cb(null); }
        return;
      }
      var pk = res.response.publickey.toUpperCase();
      var builtinId = 'builtin:' + pk;
      if (typeof ensureBuiltinFrame !== 'function') {
        _activeFrameId = builtinId;
        if (cb) { cb(null); }
        return;
      }
      MDS.cmd('getaddress', function(addrRes) {
        var walletAddr = (addrRes && addrRes.status && addrRes.response && addrRes.response.address)
          ? addrRes.response.address : '';
        ensureBuiltinFrame(pk, walletAddr, function(err) {
          if (!err) { _activeFrameId = builtinId; }
          if (cb) { cb(null); }
        });
      });
    });
  }

  function init(config, cb) {
    _config = config || {};
    if (_inited) {
      if (cb) { cb(null, true); }
      _ensureReconnect();
      return;
    }
    if (typeof MDS === 'undefined' || typeof MDS.init !== 'function') {
      if (cb) { cb('MDS not available', false); }
      return;
    }
    MDS.init(function(event) {
      if (event && event.event === 'inited' && !_inited) {
        _inited = true;
        _resolveFrame(_config, function(frameErr) {
          if (frameErr) {
            if (cb) { cb(frameErr, false); }
            return;
          }
          if (cb) { cb(null, true); }
          _ensureReconnect();
        });
      }
    });
  }

  // Enrich each campaign with ad fields (AD_ID, AD_INTERESTS, …).
  // Required because selection.js filters by c.AD_INTERESTS but CAMPAIGNS has no such column.
  function _enrichWithAds(campaigns, cb) {
    if (!campaigns || campaigns.length === 0) {
      cb(null, []);
      return;
    }
    sqlQuery(
      "SELECT ID, CAMPAIGN_ID, TITLE, BODY, CTA_LABEL, CTA_URL, INTERESTS FROM ADS",
      function(err, rows) {
        if (err) { cb(err, null); return; }
        var byCampaign = {};
        var list = rows || [];
        for (var i = 0; i < list.length; i++) {
          var row = list[i];
          if (row.CAMPAIGN_ID) {
            byCampaign[row.CAMPAIGN_ID.toUpperCase()] = row;
          }
        }
        var enriched = campaigns.map(function(c) {
          var ad = byCampaign[(c.ID || '').toUpperCase()];
          if (ad) {
            c.AD_ID = ad.ID;
            c.AD_TITLE = ad.TITLE;
            c.AD_BODY = ad.BODY;
            c.AD_CTA_LABEL = ad.CTA_LABEL;
            c.AD_CTA_URL = ad.CTA_URL;
            c.AD_INTERESTS = ad.INTERESTS;
          }
          return c;
        });
        cb(null, enriched);
      }
    );
  }

  function getAd(userAddress, interests, cb) {
    getCampaigns(function(err, campaigns) {
      if (err) { cb(err, null); return; }
      _enrichWithAds(campaigns || [], function(err2, enriched) {
        if (err2) { cb(err2, null); return; }
        var ad = selectAd(userAddress, interests, enriched);
        cb(null, ad);
      });
    });
  }

  function render(ad, containerId) {
    if (typeof renderAd !== 'function') {
      if (typeof MDS !== 'undefined' && MDS.log) {
        MDS.log("[SDK] renderAd not loaded");
      }
      return false;
    }
    return renderAd(ad, containerId);
  }

  function _lookupAdId(campaignId, cb) {
    sqlQuery(
      "SELECT ID FROM ADS WHERE UPPER(CAMPAIGN_ID) = UPPER('" + escapeSql(campaignId) + "')",
      function(err, rows) {
        if (err) { cb(err, null); return; }
        cb(null, (rows && rows.length > 0) ? rows[0].ID : null);
      }
    );
  }

  // --- Channel helpers --------------------------------------------------

  function _campaignDays() {
    // Legacy fallback: return 6 days.
    // Modern campaigns always provide max_viewer_reward explicitly.
    return 6;
  }

  function _computeMaxAmount(campaign) {
    var explicit = parseFloat(campaign.MAX_VIEWER_REWARD);
    if (explicit > 0) { return explicit; }
    var rv = parseFloat(campaign.REWARD_VIEW) || 0;
    var rc = parseFloat(campaign.REWARD_CLICK) || 0;
    return (rv + rc) * _campaignDays();
  }

  function _myMxAddress() {
    return (typeof MY_MX_ADDRESS !== 'undefined') ? MY_MX_ADDRESS : '';
  }

  // Unicast Maxima send with poll:true.
  // creatorRoute may be an Mx contact string (starts with "Mx" or "MX") or a
  // Maxima public key (starts with "0x"). Mx uses `to:` routing; pk uses
  // `publickey:` routing (requires the peer to be in the contacts list).
  // campaign.handler.js stores the Mx in keypair CREATOR_MX_<campaignId>
  // during on-chain discovery — that value is preferred; pk is the fallback.
  function _sendToCreator(creatorRoute, payload, cb) {
    if (!creatorRoute) { if (cb) { cb(false); } return; }
    var hex = '0x' + utf8ToHex(JSON.stringify(payload)).toUpperCase();
    var isMx = (creatorRoute.substring(0, 2).toUpperCase() === 'MX');
    var routeParam = isMx ? ('to:' + creatorRoute) : ('publickey:' + creatorRoute);
    var cmd = 'maxima action:send ' + routeParam
            + ' application:' + APP_NAME
            + ' data:' + hex
            + ' poll:true';
    MDS.cmd(cmd, function(res) {
      var ok = !!(res && res.status);
      console.log('[SDK] sendToCreator type:' + payload.type + ' route:' + (isMx ? 'Mx' : 'pk') + ' ok:' + ok + (ok ? '' : ' err:' + (res && res.error)));
      if (cb) { cb(ok); }
    });
  }

  // Reads the creator Mx contact string stored by campaign.handler.js during
  // on-chain discovery. Falls back to CREATOR_ADDRESS (pk) if not found.
  function _resolveCreatorRoute(campaign, cb) {
    MDS.keypair.get('CREATOR_MX_' + campaign.ID, function(res) {
      var mx = (res && res.status && res.value) ? res.value : '';
      cb(mx || campaign.CREATOR_ADDRESS);
    });
  }

  // On the viewer node the SDK is always the only consumer of CHANNEL_STATE
  // for a given campaign (creator-is-viewer trackEvent is blocked upstream),
  // so a campaign_id lookup is unambiguous.
  function _getMyChannel(campaignId, cb) {
    sqlQuery(
      "SELECT * FROM CHANNEL_STATE WHERE UPPER(CAMPAIGN_ID) = UPPER('" + escapeSql(campaignId) + "')",
      function(err, rows) {
        if (err) { cb(err, null); return; }
        cb(null, (rows && rows.length > 0) ? rows[0] : null);
      }
    );
  }

  // --- Pending reward bookkeeping --------------------------------------
  // MDS.keypair has no list API (refs/Minima-1.0.45/mds/mds.js only exposes
  // get/set), so we maintain a per-campaign index of event_ids.

  function _pendingIndexKey(campaignId)         { return 'MA_PENDING_EVENTS_' + campaignId; }
  function _pendingInfoKey(campaignId, eventId) { return 'MA_PENDING_REWARD_' + campaignId + '_' + eventId; }

  function _loadPendingIndex(campaignId, cb) {
    MDS.keypair.get(_pendingIndexKey(campaignId), function(res) {
      var raw = (res && res.status && res.value) ? res.value : '';
      if (!raw) { cb([]); return; }
      var parsed = null;
      try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
      cb(Array.isArray(parsed) ? parsed : []);
    });
  }

  function _savePendingIndex(campaignId, list, cb) {
    MDS.keypair.set(_pendingIndexKey(campaignId), JSON.stringify(list || []), function() {
      if (cb) { cb(); }
    });
  }

  function _savePendingInfo(campaignId, eventId, info, cb) {
    MDS.keypair.set(_pendingInfoKey(campaignId, eventId), JSON.stringify(info), function() {
      if (cb) { cb(); }
    });
  }

  function _readPendingInfo(campaignId, eventId, cb) {
    MDS.keypair.get(_pendingInfoKey(campaignId, eventId), function(res) {
      var raw = (res && res.status && res.value) ? res.value : '';
      if (!raw) { cb(null); return; }
      var info = null;
      try { info = JSON.parse(raw); } catch (e) { info = null; }
      cb(info);
    });
  }

  function _addPending(campaignId, eventId, info, cb) {
    _loadPendingIndex(campaignId, function(list) {
      if (list.indexOf(eventId) === -1) { list.push(eventId); }
      _savePendingInfo(campaignId, eventId, info, function() {
        _savePendingIndex(campaignId, list, cb);
      });
    });
  }

  // Clear pending markers whose stored cumulative is <= the vouched cumulative.
  // Creator emits REWARD_VOUCHER monotonically so any pending reward below the
  // incoming cumulative has been absorbed by the creator's signed tx.
  function _clearPendingByCumulative(campaignId, vouchedCum, cb) {
    _loadPendingIndex(campaignId, function(list) {
      if (!list || list.length === 0) { if (cb) { cb(); } return; }
      var remaining = [];
      var done = 0;
      var total = list.length;

      function step() {
        done++;
        if (done === total) { _savePendingIndex(campaignId, remaining, cb); }
      }

      for (var i = 0; i < list.length; i++) {
        (function(eventId) {
          _readPendingInfo(campaignId, eventId, function(info) {
            if (info && parseFloat(info.cumulative) <= vouchedCum) {
              MDS.keypair.set(_pendingInfoKey(campaignId, eventId), '', function() { step(); });
            } else {
              if (info) { remaining.push(eventId); }
              step();
            }
          });
        })(list[i]);
      }
    });
  }

  // --- Publisher channel helpers ---------------------------------------

  function _getPublisherChannel(campaignId, cb) {
    sqlQuery(
      "SELECT * FROM CHANNEL_STATE WHERE UPPER(CAMPAIGN_ID) = UPPER('" + escapeSql(campaignId) + "') AND UPPER(ROLE) = UPPER('publisher')",
      function(err, rows) {
        if (err) { cb(err, null); return; }
        cb(null, rows && rows.length > 0 ? rows[0] : null);
      }
    );
  }

  function _openNewPublisherChannel(campaign, frameId, frame, maxAmount, cb) {
    var publisherWalletAddr = frame.PUBLISHER_WALLET || '';
    MDS.cmd('keys action:new', function(res) {
      if (!res || !res.status || !res.response || !res.response.publickey) {
        if (cb) { cb(); }
        return;
      }
      var publisherKey = res.response.publickey;
      var now = Date.now();
      _resolveCreatorRoute(campaign, function(creatorRoute) {
        var sql = "INSERT INTO CHANNEL_STATE " +
          "(CAMPAIGN_ID, VIEWER_KEY, ROLE, FRAME_ID, CREATOR_MX, MAX_AMOUNT, CUMULATIVE_EARNED, LATEST_TX_HEX, STATUS, CREATED_AT, VIEWER_WALLET_ADDR) VALUES (" +
          "'" + escapeSql(campaign.ID) + "'," +
          "'" + escapeSql(publisherKey) + "'," +
          "'publisher'," +
          "'" + escapeSql(frameId) + "'," +
          "'" + escapeSql(creatorRoute) + "'," +
          maxAmount + "," +
          "0," +
          "''," +
          "'pending'," +
          now + "," +
          "'" + escapeSql(publisherWalletAddr) + "'" +
          ")";
        sqlQuery(sql, function(err) {
          if (err) {
            console.log('[SDK] publisher CHANNEL_STATE insert failed:', err);
            if (cb) { cb(); }
            return;
          }
          _sendToCreator(creatorRoute, {
            type: 'CHANNEL_OPEN_REQUEST',
            campaign_id: campaign.ID,
            viewer_key: publisherKey,
            viewer_mx: _myMxAddress(),
            max_amount: maxAmount,
            viewer_wallet_addr: publisherWalletAddr,
            role: 'publisher',
            frame_id: frameId
          }, function() { if (cb) { cb(); } });
        });
      });
    });
  }

  function _sendPublisherRewardRequest(campaign, channel, frameId, amount, cb) {
    var newCum = (parseFloat(channel.CUMULATIVE_EARNED) || 0) + amount;
    var evtId = 'pub_' + Date.now().toString(16) + '_' + Math.floor(Math.random() * 0xFFFF).toString(16);
    console.log('[SDK] publisher REWARD_REQUEST campaign:' + campaign.ID + ' cumulative:' + newCum);
    _sendToCreator(channel.CREATOR_MX, {
      type: 'REWARD_REQUEST',
      campaign_id: campaign.ID,
      viewer_key: channel.VIEWER_KEY,
      event_id: evtId,
      cumulative: newCum,
      role: 'publisher',
      frame_id: frameId
    }, function() { if (cb) { cb(); } });
  }

  function _publisherChannelFlow(campaign, frameId, amount, cb) {
    if (typeof getFrame !== 'function') { if (cb) { cb(); } return; }
    getFrame(frameId, function(err, frame) {
      if (err || !frame) { if (cb) { cb(); } return; }
      _getPublisherChannel(campaign.ID, function(err2, channel) {
        if (err2) { if (cb) { cb(); } return; }
        if (!channel) {
          var maxAmount = Math.min(
            parseFloat(campaign.MAX_PUBLISHER_BUDGET) || 0,
            (parseFloat(campaign.PUBLISHER_REWARD_VIEW) || 0) * _campaignDays()
          );
          if (!(maxAmount > 0)) { if (cb) { cb(); } return; }
          _openNewPublisherChannel(campaign, frameId, frame, maxAmount, cb);
          return;
        }
        if (channel.STATUS === 'pending') { if (cb) { cb(); } return; }
        if (channel.STATUS === 'open') {
          _sendPublisherRewardRequest(campaign, channel, frameId, amount, cb);
          return;
        }
        if (cb) { cb(); }
      });
    });
  }

  // --- Channel flow orchestration --------------------------------------

  function _openNewChannel(campaign, eventId, amount, cb) {
    MDS.cmd('getaddress', function(addrRes) {
      var viewerWalletAddr = (addrRes && addrRes.status && addrRes.response && addrRes.response.address)
        ? addrRes.response.address : '';
      console.log('[SDK] viewer wallet addr:', viewerWalletAddr || '(not available)');

      MDS.cmd('keys action:new', function(res) {
        if (!res || !res.status || !res.response || !res.response.publickey) {
          if (typeof MDS !== 'undefined' && MDS.log) {
            MDS.log('[SDK] keys action:new failed for channel open');
          }
          if (cb) { cb(); }
          return;
        }
        var viewerKey = res.response.publickey;

        var maxAmount = _computeMaxAmount(campaign);

        _resolveCreatorRoute(campaign, function(creatorRoute) {
          console.log('[SDK] opening new channel campaign:' + campaign.ID + ' viewerKey:' + viewerKey + ' maxAmount:' + maxAmount + ' walletAddr:' + viewerWalletAddr + ' route:' + creatorRoute.substring(0, 8) + '...');
          openChannel(campaign.ID, viewerKey, creatorRoute, maxAmount, viewerWalletAddr, function(err) {
            if (err) {
              console.log('[SDK] openChannel error:', err);
              if (cb) { cb(); }
              return;
            }
            console.log('[SDK] CHANNEL_STATE(pending) written, storing pending event:' + eventId);
            var info = { cumulative: amount, viewer_key: viewerKey, amount: amount };
            _addPending(campaign.ID, eventId, info, function() {
              _sendToCreator(creatorRoute, {
                type: 'CHANNEL_OPEN_REQUEST',
                campaign_id: campaign.ID,
                viewer_key: viewerKey,
                viewer_mx: _myMxAddress(),
                max_amount: maxAmount,
                viewer_wallet_addr: viewerWalletAddr
              }, function() { if (cb) { cb(); } });
            });
          });
        });
      });
    });
  }

  // Channel is still 'pending' on our side. Accumulate the event under the
  // highest running cumulative we've already queued so the flush on
  // CHANNEL_OPENED replays REWARD_REQUESTs with monotonic cumulatives.
  function _accumulatePending(campaignId, viewerKey, eventId, amount, cb) {
    _loadPendingIndex(campaignId, function(list) {
      if (list.length === 0) {
        _addPending(campaignId, eventId, { cumulative: amount, viewer_key: viewerKey, amount: amount }, cb);
        return;
      }
      var maxCum = 0;
      var got = 0;
      for (var i = 0; i < list.length; i++) {
        (function(eid) {
          _readPendingInfo(campaignId, eid, function(info) {
            if (info) {
              var c = parseFloat(info.cumulative);
              if (c > maxCum) { maxCum = c; }
            }
            got++;
            if (got === list.length) {
              var newCum = maxCum + amount;
              _addPending(campaignId, eventId, { cumulative: newCum, viewer_key: viewerKey, amount: amount }, cb);
            }
          });
        })(list[i]);
      }
    });
  }

  function _sendRewardRequest(campaign, channel, eventId, amount, cb) {
    var newCum = (parseFloat(channel.CUMULATIVE_EARNED) || 0) + amount;
    console.log('[SDK] REWARD_REQUEST campaign:' + campaign.ID + ' event:' + eventId + ' cumulative:' + newCum);
    var info = { cumulative: newCum, viewer_key: channel.VIEWER_KEY, amount: amount };
    _addPending(campaign.ID, eventId, info, function() {
      _sendToCreator(channel.CREATOR_MX, {
        type: 'REWARD_REQUEST',
        campaign_id: campaign.ID,
        viewer_key: channel.VIEWER_KEY,
        event_id: eventId,
        cumulative: newCum
      }, function() { if (cb) { cb(); } });
    });
  }

  function _channelFlow(campaign, eventId, amount, finalCb) {
    _getMyChannel(campaign.ID, function(err, channel) {
      if (err) {
        console.log('[SDK] _getMyChannel error:', err);
        finalCb();
        return;
      }
      if (!channel) {
        console.log('[SDK] no channel yet for campaign:' + campaign.ID + ' → opening');
        _openNewChannel(campaign, eventId, amount, finalCb);
        return;
      }
      console.log('[SDK] channel status:' + channel.STATUS + ' campaign:' + campaign.ID + ' event:' + eventId + ' amount:' + amount);
      if (channel.STATUS === 'pending') {
        _accumulatePending(campaign.ID, channel.VIEWER_KEY, eventId, amount, finalCb);
        return;
      }
      if (channel.STATUS === 'open') {
        _sendRewardRequest(campaign, channel, eventId, amount, finalCb);
        return;
      }
      // settled/expired — nothing to do; the reward is recorded locally only.
      finalCb();
    });
  }

  // --- Signal handlers (exposed as MinimaAds.* and as window globals) ---

  // On CHANNEL_OPENED, flush the pending markers that piled up while the
  // channel was 'pending'. activateChannel() was already called by the SW
  // handler, so we only need to replay REWARD_REQUESTs.
  function _flushPending(campaignId) {
    _getMyChannel(campaignId, function(err, channel) {
      if (err || !channel || channel.STATUS !== 'open') { return; }
      _loadPendingIndex(campaignId, function(list) {
        if (!list || list.length === 0) {
          console.log('[SDK] flushPending campaign:' + campaignId + ' — nothing pending');
          return;
        }
        console.log('[SDK] flushPending campaign:' + campaignId + ' events:' + list.length);
        for (var i = 0; i < list.length; i++) {
          (function(eid) {
            _readPendingInfo(campaignId, eid, function(info) {
              if (!info) { return; }
              _sendToCreator(channel.CREATOR_MX, {
                type: 'REWARD_REQUEST',
                campaign_id: campaignId,
                viewer_key: channel.VIEWER_KEY,
                event_id: eid,
                cumulative: parseFloat(info.cumulative)
              }, function() {});
            });
          })(list[i]);
        }
      });
    });
  }

  // Called on first use / app init. For each open channel with pending
  // rewards, resend REWARD_REQUESTs; if no voucher has been received yet,
  // send VOUCHER_SYNC_REQUEST so the creator re-emits the last voucher
  // (§6.8).
  function _onReconnect() {
    sqlQuery(
      "SELECT CAMPAIGN_ID, VIEWER_KEY, STATUS, LATEST_TX_HEX, CREATOR_MX FROM CHANNEL_STATE WHERE STATUS = 'open'",
      function(err, rows) {
        if (err || !rows) { return; }
        console.log('[SDK] reconnect: open channels found:' + rows.length);
        for (var i = 0; i < rows.length; i++) {
          (function(row) {
            _flushPending(row.CAMPAIGN_ID);
            if (!row.LATEST_TX_HEX || row.LATEST_TX_HEX === '') {
              console.log('[SDK] reconnect: no voucher yet for campaign:' + row.CAMPAIGN_ID + ' → VOUCHER_SYNC_REQUEST');
              _sendToCreator(row.CREATOR_MX, {
                type: 'VOUCHER_SYNC_REQUEST',
                campaign_id: row.CAMPAIGN_ID,
                viewer_key: row.VIEWER_KEY
              }, function() {});
            }
          })(rows[i]);
        }
      }
    );
    // Resend CHANNEL_OPEN_REQUEST for channels stuck in 'pending' (e.g. after
    // a routing failure in a prior session). The creator is idempotent on this
    // message (channel.handler.js checks for an existing row).
    sqlQuery(
      "SELECT CAMPAIGN_ID, VIEWER_KEY, CREATOR_MX, MAX_AMOUNT, VIEWER_WALLET_ADDR FROM CHANNEL_STATE WHERE STATUS = 'pending'",
      function(err2, pending) {
        if (err2 || !pending || pending.length === 0) { return; }
        console.log('[SDK] reconnect: pending channels found:' + pending.length + ' → resending CHANNEL_OPEN_REQUEST');
        for (var j = 0; j < pending.length; j++) {
          (function(row) {
            console.log('[SDK] reconnect: resending CHANNEL_OPEN_REQUEST campaign:' + row.CAMPAIGN_ID);
            _sendToCreator(row.CREATOR_MX, {
              type: 'CHANNEL_OPEN_REQUEST',
              campaign_id: row.CAMPAIGN_ID,
              viewer_key: row.VIEWER_KEY,
              viewer_mx: _myMxAddress(),
              max_amount: parseFloat(row.MAX_AMOUNT) || 0,
              viewer_wallet_addr: row.VIEWER_WALLET_ADDR || ''
            }, function() {});
          })(pending[j]);
        }
      }
    );
  }

  function _ensureReconnect() {
    if (_reconnectDone) { return; }
    _reconnectDone = true;
    _onReconnect();
  }

  function _onChannelOpenedCore(parsed) {
    if (!parsed || !parsed.campaign_id) { return; }
    console.log('[SDK] CHANNEL_OPENED campaign:' + parsed.campaign_id + ' coinid:' + parsed.channel_coinid + ' → flushing pending');
    _flushPending(parsed.campaign_id);
  }

  function _onVoucherReceivedCore(parsed) {
    if (!parsed || !parsed.campaign_id || parsed.cumulative === undefined) { return; }

    if (parsed.role === 'publisher') {
      var pubFrameId = parsed.frame_id || '';
      var pubCampaignId = parsed.campaign_id;
      var pubCumulative = parseFloat(parsed.cumulative) || 0;
      console.log('[SDK] VOUCHER_RECEIVED(publisher) campaign:' + pubCampaignId + ' frame:' + pubFrameId + ' cumulative:' + pubCumulative);
      if (!pubFrameId) { return; }
      if (typeof getCampaign !== 'function') { return; }
      getCampaign(pubCampaignId, function(err, campaign) {
        if (err || !campaign) { return; }
        var pubAmount = parseFloat(campaign.PUBLISHER_REWARD_VIEW) || 0;
        if (!(pubAmount > 0)) { return; }
        if (typeof getFrame !== 'function') { return; }
        getFrame(pubFrameId, function(err2, frame) {
          var userAddr = (frame && frame.PUBLISHER_KEY) ? frame.PUBLISHER_KEY : pubFrameId;
          _lookupAdId(pubCampaignId, function(err3, adId) {
            var params = {
              campaign_id: pubCampaignId,
              ad_id: adId || '',
              user_address: userAddr,
              type: 'publisher_view',
              amount: pubAmount,
              publisher_id: pubFrameId
            };
            createRewardEvent(params, function(err4, evt) {
              if (err4 || !evt) { return; }
              if (typeof incrementFrameEarnings === 'function') {
                incrementFrameEarnings(pubFrameId, pubAmount, function() {});
              }
              if (typeof MDS !== 'undefined' && MDS.comms) {
                MDS.comms.solo(JSON.stringify({
                  type: 'PUBLISHER_REWARD_CONFIRMED',
                  event_id: evt.id,
                  amount: pubAmount,
                  frame_id: pubFrameId,
                  campaign_id: pubCampaignId
                }));
              }
            });
          });
        });
      });
      return;
    }

    // Viewer voucher — existing flow
    console.log('[SDK] VOUCHER_RECEIVED campaign:' + parsed.campaign_id + ' cumulative:' + parsed.cumulative + ' → clearing pending ≤' + parsed.cumulative);
    _clearPendingByCumulative(parsed.campaign_id, parseFloat(parsed.cumulative), function() {
      console.log('[SDK] pending cleared for campaign:' + parsed.campaign_id);
    });
  }

  // --- Public API ------------------------------------------------------

  function _trackEvent(type, campaignId, userAddress, cb) {
    _ensureReconnect();
    var validate = (type === 'view') ? validateView : validateClick;
    validate(campaignId, userAddress, function(result) {
      if (!result.valid) {
        cb(null, { confirmed: false, reason: result.reason });
        return;
      }
      getCampaign(campaignId, function(err, campaign) {
        if (err) { cb(err, null); return; }
        if (!campaign) {
          cb(null, { confirmed: false, reason: 'campaign not found' });
          return;
        }
        if (campaign.CREATOR_ADDRESS.toUpperCase() === userAddress.toUpperCase()) {
          cb(null, { confirmed: false, reason: 'creator cannot earn from own campaign' });
          return;
        }
        _lookupAdId(campaignId, function(err2, adId) {
          if (err2) { cb(err2, null); return; }
          var amount = (type === 'view')
            ? parseFloat(campaign.REWARD_VIEW)
            : parseFloat(campaign.REWARD_CLICK);
          var params = {
            campaign_id: campaignId,
            ad_id: adId || '',
            user_address: userAddress,
            type: type,
            amount: amount,
            publisher_id: _activeFrameId || null
          };
          createRewardEvent(params, function(err3, evt) {
            if (err3) { cb(err3, null); return; }
            if (!evt) { cb(null, { confirmed: false }); return; }
            // Fire-and-forget viewer channel flow.
            _channelFlow(campaign, evt.id, amount, function() {});
            // Fire-and-forget publisher reward flow when R_p > 0 and frame is set.
            if (parseFloat(campaign.PUBLISHER_REWARD_VIEW) > 0 && type === 'view' && _activeFrameId) {
              _publisherChannelFlow(campaign, _activeFrameId, parseFloat(campaign.PUBLISHER_REWARD_VIEW), function() {});
            }
            cb(null, { confirmed: true, event: evt });
          });
        });
      });
    });
  }

  function trackView(campaignId, userAddress, cb) {
    _trackEvent('view', campaignId, userAddress, cb);
  }

  function trackClick(campaignId, userAddress, cb) {
    _trackEvent('click', campaignId, userAddress, cb);
  }

  if (typeof window !== 'undefined') {
    window.MinimaAds = {
      init: init,
      getAd: getAd,
      render: render,
      trackView: trackView,
      trackClick: trackClick,
      // Exposed so viewer.js (T-CH6) can compose UI updates on top of the
      // channel bookkeeping without re-implementing it.
      onChannelOpened:  _onChannelOpenedCore,
      onVoucherReceived: _onVoucherReceivedCore
    };

    // app.js dispatches MDSCOMMS signals to global onChannelOpened /
    // onVoucherReceived. Install the SDK's core handlers as defaults so the
    // channel bookkeeping always runs. viewer.js (T-CH6) may override either
    // to add UI refresh — it should call MinimaAds.on* first to preserve
    // this behaviour.
    if (typeof window.onChannelOpened !== 'function') {
      window.onChannelOpened = _onChannelOpenedCore;
    }
    if (typeof window.onVoucherReceived !== 'function') {
      window.onVoucherReceived = _onVoucherReceivedCore;
    }
  }
})();
