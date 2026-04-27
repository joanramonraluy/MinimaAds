// T10 — Viewer view.
// Loads one ad via the SDK, renders it via the renderer (T11), and wires the
// view timer and CTA click to the SDK tracking calls.
// Creator-is-viewer exclusion is enforced by selectAd (core/selection.js) and
// re-checked by MinimaAds.trackView / trackClick (sdk/index.js).
// "My campaigns" mode bypasses selectAd to let creators preview their own ads
// without earning rewards.
// T-CH6 additions: pending channel rewards section (per-campaign CUMULATIVE_EARNED +
// "Settle" button), manual and auto settlement flow, and signal handlers for
// CHANNEL_OPENED / VOUCHER_RECEIVED / AUTO_SETTLE / SETTLE_CONFIRMED.

var _viewerState = { ad: null, viewTimerId: 0, viewTracked: false };
var _previewMode = false;

function renderViewer(root) {
  root.innerHTML = '';

  var h2 = document.createElement('h2');
  h2.textContent = 'View Ads';
  root.appendChild(h2);

  var toolbar = document.createElement('div');
  toolbar.style.cssText = 'display:flex;gap:.5rem;margin-bottom:.5rem;';

  var allBtn = document.createElement('button');
  allBtn.id = 'ma-btn-all';
  allBtn.textContent = 'All ads';
  allBtn.addEventListener('click', function() { setPreviewMode(false); });

  var ownBtn = document.createElement('button');
  ownBtn.id = 'ma-btn-own';
  ownBtn.textContent = 'My campaigns';
  ownBtn.setAttribute('class', 'outline');
  ownBtn.addEventListener('click', function() { setPreviewMode(true); });

  toolbar.appendChild(allBtn);
  toolbar.appendChild(ownBtn);
  root.appendChild(toolbar);

  var slot = document.createElement('section');
  slot.id = 'ma-ad-slot';
  root.appendChild(slot);

  var status = document.createElement('p');
  status.id = 'ma-viewer-status';
  status.setAttribute('role', 'status');
  root.appendChild(status);

  var footer = document.createElement('footer');
  footer.innerHTML = 'Session earned: <span id="ma-earned">0</span> MINIMA';
  root.appendChild(footer);

  var nextBtn = document.createElement('button');
  nextBtn.textContent = 'Next ad';
  nextBtn.addEventListener('click', loadNextAd);
  root.appendChild(nextBtn);

  var channelSection = document.createElement('section');
  channelSection.style.cssText = 'margin-top:1.5rem;';

  var channelH3 = document.createElement('h3');
  channelH3.textContent = 'Pending rewards';
  channelSection.appendChild(channelH3);

  var settleStatus = document.createElement('p');
  settleStatus.id = 'ma-channel-settle-status';
  settleStatus.setAttribute('role', 'status');
  channelSection.appendChild(settleStatus);

  var channelList = document.createElement('div');
  channelList.id = 'ma-channel-rewards-list';
  channelSection.appendChild(channelList);

  root.appendChild(channelSection);

  loadNextAd();
  _refreshChannelRewards();
}

function setPreviewMode(on) {
  _previewMode = on;
  var allBtn = document.getElementById('ma-btn-all');
  var ownBtn = document.getElementById('ma-btn-own');
  if (allBtn) { allBtn.className = on ? 'outline' : ''; }
  if (ownBtn) { ownBtn.className = on ? '' : 'outline'; }
  loadNextAd();
}

function loadNextAd() {
  var status = document.getElementById('ma-viewer-status');
  var slot = document.getElementById('ma-ad-slot');
  if (!status || !slot) { return; }

  if (_viewerState.viewTimerId) {
    clearTimeout(_viewerState.viewTimerId);
    _viewerState.viewTimerId = 0;
  }
  _viewerState.ad = null;
  _viewerState.viewTracked = false;
  slot.innerHTML = '';
  status.textContent = 'Loading ad…';

  if (_previewMode) {
    loadOwnCampaignAd(status, slot);
    return;
  }

  if (typeof MinimaAds === 'undefined' || typeof MinimaAds.getAd !== 'function') {
    status.textContent = 'SDK not loaded.';
    return;
  }

  var interests = '';
  getUserProfile(MY_ADDRESS, function(err, profile) {
    if (!err && profile && profile.INTERESTS) { interests = profile.INTERESTS; }

    MinimaAds.getAd(MY_ADDRESS, interests, function(err2, ad) {
      if (err2 || !ad) {
        status.textContent = 'No ad available right now.';
        return;
      }
      renderAdInSlot(ad, status, false);
    });
  });
}

function loadOwnCampaignAd(status, slot) {
  var sql = "SELECT c.ID, c.TITLE, c.STATUS, c.BUDGET_REMAINING, c.REWARD_VIEW, c.REWARD_CLICK,"
    + " a.ID AS AD_ID, a.TITLE AS AD_TITLE, a.BODY AS AD_BODY,"
    + " a.CTA_LABEL AS AD_CTA_LABEL, a.CTA_URL AS AD_CTA_URL, a.INTERESTS AS AD_INTERESTS"
    + " FROM CAMPAIGNS c JOIN ADS a ON UPPER(a.CAMPAIGN_ID) = UPPER(c.ID)"
    + " WHERE UPPER(c.CREATOR_ADDRESS) = UPPER('" + escapeSql(MY_ADDRESS) + "')"
    + " AND c.STATUS = 'active' LIMIT 10";

  sqlQuery(sql, function(err, rows) {
    if (err || !rows || rows.length === 0) {
      status.textContent = 'No own campaigns found.';
      return;
    }
    var row = rows[Math.floor(Math.random() * rows.length)];
    renderAdInSlot(row, status, true);
  });
}

function renderAdInSlot(ad, status, isPreview) {
  _viewerState.ad = ad;
  status.textContent = isPreview ? '[Preview — rewards not tracked]' : '';
  MinimaAds.render({
    id: ad.AD_ID,
    campaign_id: ad.ID,
    title: ad.AD_TITLE,
    body: ad.AD_BODY,
    cta_label: ad.AD_CTA_LABEL,
    cta_url: ad.AD_CTA_URL
  }, 'ma-ad-slot');

  if (!isPreview) {
    wireAdInteractions(ad);
    _viewerState.viewTimerId = setTimeout(function() {
      trackAdView(ad);
    }, LIMITS.MIN_VIEW_DURATION_MS);
  }
}

function trackAdView(ad) {
  if (_viewerState.viewTracked || !_viewerState.ad || _viewerState.ad.ID !== ad.ID) { return; }
  _viewerState.viewTracked = true;
  MinimaAds.trackView(ad.ID, MY_ADDRESS, function(err, res) {
    var status = document.getElementById('ma-viewer-status');
    if (!status) { return; }
    if (err || !res) { return; }
    if (!res.confirmed) {
      status.textContent = 'View not rewarded: ' + (res.reason || 'unknown');
    }
  });
}

function wireAdInteractions(ad) {
  var slot = document.getElementById('ma-ad-slot');
  if (!slot) { return; }
  var links = slot.querySelectorAll('a[href]');
  for (var i = 0; i < links.length; i++) {
    links[i].addEventListener('click', function(e) {
      e.preventDefault();
      var href = e.currentTarget.getAttribute('href');
      MinimaAds.trackClick(ad.ID, MY_ADDRESS, function() {
        if (href) { window.open(href, '_blank', 'noopener'); }
        loadNextAd();
      });
    });
  }
}

function onRewardConfirmed(parsed) {
  var earnedEl = document.getElementById('ma-earned');
  if (!earnedEl) { return; }
  var curr = parseFloat(earnedEl.textContent) || 0;
  var delta = parseFloat(parsed.amount) || 0;
  earnedEl.textContent = (curr + delta).toFixed(6);
}

function onCampaignsChanged() {
  if (!_viewerState.ad) { loadNextAd(); }
}

// ---------------------------------------------------------------------------
// T-CH6 — Channel rewards section
// ---------------------------------------------------------------------------

function _refreshChannelRewards() {
  var container = document.getElementById('ma-channel-rewards-list');
  if (!container) { return; }
  var sql = "SELECT CAMPAIGN_ID, VIEWER_KEY, CUMULATIVE_EARNED, LATEST_TX_HEX"
          + " FROM CHANNEL_STATE WHERE STATUS = 'open' AND LATEST_TX_HEX != ''";
  sqlQuery(sql, function(err, rows) {
    if (err) { console.error('[CH6] _refreshChannelRewards query error:', err); return; }
    console.log('[CH6] setteable channels:', (rows || []).length);
    _renderChannelRewardRows(rows || [], container);
  });
}

function _renderChannelRewardRows(rows, container) {
  container.innerHTML = '';
  if (rows.length === 0) {
    var empty = document.createElement('p');
    empty.innerHTML = '<em>No pending rewards to settle.</em>';
    container.appendChild(empty);
    return;
  }
  for (var i = 0; i < rows.length; i++) {
    (function(row) {
      var campaignId = row.CAMPAIGN_ID;
      var viewerKey  = row.VIEWER_KEY;
      var txHex      = row.LATEST_TX_HEX;

      var item = document.createElement('div');
      item.style.cssText = 'display:flex;align-items:center;gap:.5rem;margin:.25rem 0;';

      var label = document.createElement('span');
      label.textContent = campaignId.substring(0, 8) + '… — '
        + parseFloat(row.CUMULATIVE_EARNED).toFixed(6) + ' MINIMA pending';

      var btn = document.createElement('button');
      btn.textContent = 'Settle';
      btn.style.cssText = 'padding:.25rem .75rem;';
      btn.addEventListener('click', function() {
        btn.disabled = true;
        btn.textContent = 'Settling…';
        _runSettlement(campaignId, viewerKey, txHex, btn);
      });

      item.appendChild(label);
      item.appendChild(btn);
      container.appendChild(item);
    })(rows[i]);
  }
}

// Runs the full viewer-side settlement: import → co-sign → post → DB update → signal.
// btnEl may be null (auto-settle path).
function _runSettlement(campaignId, viewerKey, txHex, btnEl) {
  var settleId = 'stl_' + Date.now().toString(16);
  console.log('[CH6] _runSettlement start campaign:', campaignId, 'settleId:', settleId);

  function onError(msg) {
    console.error('[CH6] _runSettlement error:', msg, 'campaign:', campaignId);
    if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Settle'; }
    var statusEl = document.getElementById('ma-channel-settle-status');
    if (statusEl) { statusEl.textContent = 'Settlement failed: ' + msg; }
    MDS.cmd('txndelete id:' + settleId, function() {});
  }

  MDS.cmd('txnimport id:' + settleId + ' data:' + txHex, function(r1) {
    console.log('[CH6] txnimport status:', r1 && r1.status, r1 && r1.error);
    if (!r1 || !r1.status) { onError((r1 && r1.error) || 'txnimport failed'); return; }

    MDS.cmd('txnsign id:' + settleId + ' publickey:' + viewerKey, function(r2) {
      console.log('[CH6] txnsign status:', r2 && r2.status, 'pending:', r2 && r2.pending, r2 && r2.error);
      if (r2 && r2.pending) {
        savePendingChannelOp(r2.pendinguid, {
          kind:       'settlement',
          settleId:   settleId,
          campaignId: campaignId,
          viewerKey:  viewerKey
        });
        console.log('[CH6] txnsign pending, uid:', r2.pendinguid);
        if (btnEl) { btnEl.textContent = 'Awaiting approval…'; }
        return;
      }
      if (!r2 || !r2.status) { onError((r2 && r2.error) || 'txnsign failed'); return; }

      _postSettleTx(settleId, campaignId, viewerKey);
    });
  });
}

function _postSettleTx(settleId, campaignId, viewerKey) {
  MDS.cmd('txnpost id:' + settleId + ' mine:true', function(r3) {
    console.log('[CH6] txnpost status:', r3 && r3.status, r3 && r3.error);
    MDS.cmd('txndelete id:' + settleId, function() {});
    if (!r3 || !r3.status) {
      console.error('[CH6] txnpost failed:', r3 && r3.error, 'campaign:', campaignId);
      var statusEl = document.getElementById('ma-channel-settle-status');
      if (statusEl) { statusEl.textContent = 'Settlement failed: ' + ((r3 && r3.error) || 'txnpost failed'); }
      _refreshChannelRewards();
      return;
    }
    settleChannel(campaignId, viewerKey, function(err) {
      if (err) {
        console.error('[CH6] settleChannel DB error:', err);
        var el = document.getElementById('ma-channel-settle-status');
        if (el) { el.textContent = 'Settlement posted but DB update failed.'; }
        _refreshChannelRewards();
        return;
      }
      getChannelState(campaignId, viewerKey, function(err2, ch) {
        var cum = (ch && ch.CUMULATIVE_EARNED) ? parseFloat(ch.CUMULATIVE_EARNED) : 0;
        console.log('[CH6] settlement complete campaign:', campaignId, 'cumulative:', cum);
        signalFE('SETTLE_CONFIRMED', { campaign_id: campaignId, amount: cum });
        _refreshChannelRewards();
      });
    });
  });
}

// ---------------------------------------------------------------------------
// T-CH6 — Signal handlers (override SDK defaults; preserve SDK bookkeeping)
// ---------------------------------------------------------------------------

// Override the SDK default so the pending-rewards section refreshes after a
// new channel is opened (previously 'pending' → 'open', no voucher yet so no
// rows will appear, but the query is cheap and keeps UI consistent).
function onChannelOpened(parsed) {
  console.log('[CH6] onChannelOpened campaign:', parsed && parsed.campaign_id, 'coinid:', parsed && parsed.channel_coinid);
  if (typeof MinimaAds !== 'undefined' && typeof MinimaAds.onChannelOpened === 'function') {
    MinimaAds.onChannelOpened(parsed);
  }
  _refreshChannelRewards();
}

// Override the SDK default so the pending-rewards section refreshes whenever a
// new voucher arrives (CUMULATIVE_EARNED updated → settle button shows new amount).
function onVoucherReceived(parsed) {
  console.log('[CH6] onVoucherReceived campaign:', parsed && parsed.campaign_id, 'cumulative:', parsed && parsed.cumulative);
  if (typeof MinimaAds !== 'undefined' && typeof MinimaAds.onVoucherReceived === 'function') {
    MinimaAds.onVoucherReceived(parsed);
  }
  _refreshChannelRewards();
}

// Triggered by AUTO_SETTLE signal when a campaign finishes; settles without
// user interaction and shows a notification.
function onAutoSettle(parsed) {
  console.log('[CH6] onAutoSettle campaign:', parsed && parsed.campaign_id);
  if (!parsed || !parsed.campaign_id || !parsed.viewer_key || !parsed.tx_hex) {
    console.warn('[CH6] onAutoSettle: incomplete payload', parsed);
    return;
  }
  var statusEl = document.getElementById('ma-channel-settle-status');
  if (statusEl) { statusEl.textContent = 'Settling reward channel automatically…'; }
  _runSettlement(parsed.campaign_id, parsed.viewer_key, parsed.tx_hex, null);
}

// Triggered via signalFE('SETTLE_CONFIRMED', ...) after _runSettlement completes.
// Updates the status message and removes the settled channel from the UI.
function onSettleConfirmed(parsed) {
  console.log('[CH6] onSettleConfirmed campaign:', parsed && parsed.campaign_id, 'amount:', parsed && parsed.amount);
  var statusEl = document.getElementById('ma-channel-settle-status');
  if (statusEl) {
    var amount = (parsed && parsed.amount) ? parseFloat(parsed.amount).toFixed(6) : '';
    statusEl.textContent = amount
      ? 'Reward channel settled. Received: ' + amount + ' MINIMA'
      : 'Reward channel settled.';
  }
  _refreshChannelRewards();
}
