// Viewer view.
// Loads one ad via the SDK, renders it via the renderer, and wires the
// view timer and CTA click to the SDK tracking calls.
// Creator-is-viewer exclusion is enforced by selectAd (core/selection.js) and
// re-checked by MinimaAds.trackView / trackClick (sdk/index.js).
// Channel settlement and signal handlers (onChannelOpened, onVoucherReceived,
// onAutoSettle, onSettleConfirmed) live in dapp/views/earnings.js.

var _viewerState = { ad: null, viewTimerId: 0, viewTracked: false };

function renderViewer(root) {
  root.innerHTML = '';

  var h2 = document.createElement('h2');
  h2.textContent = 'View Ads';
  root.appendChild(h2);

  var slot = document.createElement('section');
  slot.id = 'ma-ad-slot';
  root.appendChild(slot);

  var earnedBadge = document.createElement('p');
  earnedBadge.id = 'ma-earned-badge';
  earnedBadge.style.cssText = 'font-size:0.82rem;opacity:0.75;margin:0.25rem 0 0.5rem;text-align:right;';
  earnedBadge.innerHTML = 'Today earned: <span id="ma-earned">0</span> MINIMA';
  root.appendChild(earnedBadge);

  var status = document.createElement('p');
  status.id = 'ma-viewer-status';
  status.setAttribute('role', 'status');
  status.textContent = 'Press "See ad" to start.';
  root.appendChild(status);

  var nextBtn = document.createElement('button');
  nextBtn.textContent = 'See ad';
  nextBtn.addEventListener('click', loadNextAd);
  root.appendChild(nextBtn);

  loadTodayEarned();
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

  if (typeof MinimaAds === 'undefined' || typeof MinimaAds.getAd !== 'function') {
    status.textContent = 'SDK not loaded.';
    return;
  }

  var interests = '';
  getUserProfile(MY_ADDRESS, function(err, profile) {
    if (!err && profile && profile.INTERESTS) { interests = profile.INTERESTS; }

    MinimaAds.getAd(MY_ADDRESS, interests, function(err2, ad) {
      if (err2 || !ad) {
        status.textContent = 'No ads available right now. Try again later.';
        return;
      }
      renderAdInSlot(ad, status);
    });
  });
}

function renderAdInSlot(ad, status) {
  _viewerState.ad = ad;
  if (ad.ALREADY_SEEN) {
    status.textContent = 'Already viewed this session — rewards may not apply.';
  } else {
    status.textContent = '';
  }
  MinimaAds.render({
    id: ad.AD_ID,
    campaign_id: ad.ID,
    title: ad.AD_TITLE,
    body: ad.AD_BODY,
    cta_label: ad.AD_CTA_LABEL,
    cta_url: ad.AD_CTA_URL
  }, 'ma-ad-slot');

  wireAdInteractions(ad);
  _viewerState.viewTimerId = setTimeout(function() {
    trackAdView(ad);
  }, LIMITS.MIN_VIEW_DURATION_MS);
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

function loadTodayEarned() {
  var earnedEl = document.getElementById('ma-earned');
  if (!earnedEl) { return; }
  var sql = "SELECT COALESCE(TOTAL_EARNED, 0) AS TOTAL FROM USER_PROFILE"
    + " WHERE UPPER(ADDRESS) = UPPER('" + escapeSql(MY_ADDRESS) + "')";
  sqlQuery(sql, function(err, rows) {
    if (err || !rows || !rows[0]) { return; }
    var total = parseFloat(rows[0].TOTAL) || 0;
    earnedEl.textContent = total.toFixed(6);
  });
}

function onCampaignsChanged() {
  if (!_viewerState.ad) { loadNextAd(); }
}
