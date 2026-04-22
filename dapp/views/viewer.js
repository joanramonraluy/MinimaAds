// T10 — Viewer view.
// Loads one ad via the SDK, renders it via the renderer (T11), and wires the
// view timer and CTA click to the SDK tracking calls.
// Creator-is-viewer exclusion is enforced by selectAd (core/selection.js) and
// re-checked by MinimaAds.trackView / trackClick (sdk/index.js).

var _viewerState = { ad: null, viewTimerId: 0, viewTracked: false };

function renderViewer(root) {
  root.innerHTML = '';

  var h2 = document.createElement('h2');
  h2.textContent = 'View Ads';
  root.appendChild(h2);

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
      _viewerState.ad = ad;
      status.textContent = '';
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
    });
  });
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
