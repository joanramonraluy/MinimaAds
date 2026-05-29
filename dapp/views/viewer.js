// Viewer view.
// Loads one ad via the SDK, renders it via the renderer, and wires the
// view timer and CTA click to the SDK tracking calls.
// Creator-is-viewer exclusion is enforced by selectAd (core/selection.js) and
// re-checked by MinimaAds.trackView / trackClick (sdk/index.js).
// Channel settlement and signal handlers (onChannelOpened, onVoucherReceived,
// onAutoSettle, onSettleConfirmed) live in dapp/views/earnings.js.

var _viewerState = { ad: null, viewTimerId: 0, progressId: 0, viewTracked: false };

function renderViewer(root) {
  root.innerHTML = '';

  var h2 = document.createElement('h2');
  h2.textContent = 'View Ads';
  root.appendChild(h2);

  // Stat card: today earned
  var earnedRow = document.createElement('div');
  earnedRow.style.cssText = 'display:flex;gap:.75rem;margin-bottom:1rem;';
  var earnedCard = mkStatCard('Today earned', '—');
  earnedCard.id = 'ma-earned-card';
  earnedRow.appendChild(earnedCard);
  root.appendChild(earnedRow);

  // Ad container with visual depth
  var adArticle = document.createElement('article');
  adArticle.id = 'ma-ad-article';
  adArticle.style.cssText = 'padding:0;overflow:hidden;margin-bottom:.75rem;';

  var slot = document.createElement('div');
  slot.id = 'ma-ad-slot';
  adArticle.appendChild(slot);

  // Progress bar (hidden until ad starts)
  var progressWrap = document.createElement('div');
  progressWrap.id = 'ma-view-progress-wrap';
  progressWrap.style.cssText = 'padding:.5rem .85rem .65rem;display:none;';
  var progressBar = document.createElement('progress');
  progressBar.id = 'ma-view-progress';
  progressBar.max = 100;
  progressBar.value = 0;
  progressBar.style.cssText = 'width:100%;height:.35rem;margin:0 0 .25rem;';
  progressBar.setAttribute('aria-label', 'Viewing ad…');
  var progressLbl = document.createElement('small');
  progressLbl.style.cssText = 'color:var(--pico-muted-color,#6c757d);font-size:.7rem;';
  progressLbl.textContent = 'Watching ad — reward unlocks in a moment…';
  progressWrap.appendChild(progressBar);
  progressWrap.appendChild(progressLbl);
  adArticle.appendChild(progressWrap);

  root.appendChild(adArticle);

  // Status message
  var status = document.createElement('p');
  status.id = 'ma-viewer-status';
  status.setAttribute('role', 'status');
  status.style.cssText = 'min-height:1.4rem;color:var(--pico-muted-color,#6c757d);font-size:.875rem;margin-bottom:.75rem;';
  status.textContent = 'Press "See ad" to start.';
  root.appendChild(status);

  // See ad button
  var nextBtn = document.createElement('button');
  nextBtn.id = 'ma-see-ad-btn';
  nextBtn.textContent = 'See ad';
  nextBtn.addEventListener('click', loadNextAd);
  root.appendChild(nextBtn);

  loadTodayEarned();
}

function _setBtnLoading(loading) {
  var btn = document.getElementById('ma-see-ad-btn');
  if (!btn) { return; }
  if (loading) {
    btn.setAttribute('aria-busy', 'true');
    btn.disabled = true;
  } else {
    btn.removeAttribute('aria-busy');
    btn.disabled = false;
  }
}

function _startProgressBar() {
  var wrap = document.getElementById('ma-view-progress-wrap');
  var bar = document.getElementById('ma-view-progress');
  if (!wrap || !bar) { return; }
  bar.value = 0;
  wrap.style.display = 'block';
  if (_viewerState.progressId) { clearInterval(_viewerState.progressId); }
  var duration = LIMITS.MIN_VIEW_DURATION_MS;
  var step = 50;
  var increment = (step / duration) * 100;
  _viewerState.progressId = setInterval(function() {
    bar.value = Math.min(100, bar.value + increment);
    if (bar.value >= 100) {
      clearInterval(_viewerState.progressId);
      _viewerState.progressId = 0;
    }
  }, step);
}

function _stopProgressBar() {
  if (_viewerState.progressId) {
    clearInterval(_viewerState.progressId);
    _viewerState.progressId = 0;
  }
  var wrap = document.getElementById('ma-view-progress-wrap');
  if (wrap) { wrap.style.display = 'none'; }
}

function loadNextAd() {
  var status = document.getElementById('ma-viewer-status');
  var slot = document.getElementById('ma-ad-slot');
  if (!status || !slot) { return; }

  if (_viewerState.viewTimerId) {
    clearTimeout(_viewerState.viewTimerId);
    _viewerState.viewTimerId = 0;
  }
  _stopProgressBar();
  _viewerState.ad = null;
  _viewerState.viewTracked = false;
  slot.innerHTML = '';
  status.textContent = 'Loading ad…';
  _setBtnLoading(true);

  if (typeof MinimaAds === 'undefined' || typeof MinimaAds.getAd !== 'function') {
    status.textContent = 'SDK not loaded.';
    _setBtnLoading(false);
    return;
  }

  var interests = '';
  getUserProfile(MY_ADDRESS, function(err, profile) {
    if (!err && profile && profile.INTERESTS) { interests = profile.INTERESTS; }

    MinimaAds.getAd(MY_ADDRESS, interests, function(err2, ad) {
      _setBtnLoading(false);
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
  _startProgressBar();
  _viewerState.viewTimerId = setTimeout(function() {
    trackAdView(ad);
  }, LIMITS.MIN_VIEW_DURATION_MS);
}

function trackAdView(ad) {
  if (_viewerState.viewTracked || !_viewerState.ad || _viewerState.ad.ID !== ad.ID) { return; }
  _viewerState.viewTracked = true;
  _stopProgressBar();
  MinimaAds.trackView(ad.ID, MY_ADDRESS, function(err, res) {
    var status = document.getElementById('ma-viewer-status');
    if (!status) { return; }
    if (err || !res) { return; }
    if (!res.confirmed) {
      status.textContent = 'View not rewarded: ' + (res.reason || 'unknown');
    } else {
      loadTodayEarned();
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
  if (!MY_ADDRESS) { return; }
  var sql = "SELECT COALESCE(TOTAL_EARNED, 0) AS TOTAL FROM USER_PROFILE"
    + " WHERE UPPER(ADDRESS) = UPPER('" + escapeSql(MY_ADDRESS) + "')";
  sqlQuery(sql, function(err, rows) {
    var card = document.getElementById('ma-earned-card');
    if (!card) { return; }
    var strong = card.querySelector('strong');
    if (!strong) { return; }
    var total = (!err && rows && rows[0]) ? (parseFloat(rows[0].TOTAL) || 0) : 0;
    strong.textContent = total.toFixed(6) + ' MINIMA';
  });
}

function onCampaignsChanged() {
  if (!_viewerState.ad) { loadNextAd(); }
}
