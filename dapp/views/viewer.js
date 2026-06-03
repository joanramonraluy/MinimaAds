// Viewer view — campaign list + detail.
// List: all active campaigns (Telegram-style chat list).
// Detail: selected campaign renders with the existing 3 s view timer and CTA click reward.
// Channel settlement and signal handlers live in dapp/views/earnings.js.

var _viewerState = {
  mode: 'list',
  campaign: null,
  viewTimerId: 0,
  progressId: 0,
  viewTracked: false,
  listRendering: false
};

function renderViewer(root) {
  _clearViewerTimers();
  _viewerState.mode = 'list';
  _viewerState.campaign = null;
  _viewerState.viewTracked = false;
  root.innerHTML = '';
  _buildListShell(root);
  _loadAndRenderList();
}

function _clearViewerTimers() {
  if (_viewerState.viewTimerId) {
    clearTimeout(_viewerState.viewTimerId);
    _viewerState.viewTimerId = 0;
  }
  _stopProgressBar();
}

// ── List view ──────────────────────────────────────────────────────────────────

function _buildListShell(root) {
  var h2 = document.createElement('h2');
  h2.textContent = 'View Ads';
  root.appendChild(h2);

  var earnedRow = document.createElement('div');
  earnedRow.style.cssText = 'display:flex;gap:.75rem;margin-bottom:1rem;';
  var earnedCard = mkStatCard('Today earned', '—');
  earnedCard.id = 'ma-earned-card';
  earnedRow.appendChild(earnedCard);
  root.appendChild(earnedRow);

  var listEl = document.createElement('div');
  listEl.id = 'ma-campaign-list';
  var loading = document.createElement('p');
  loading.setAttribute('aria-busy', 'true');
  loading.style.cssText = 'color:var(--pico-muted-color,#6c757d);';
  loading.textContent = 'Loading campaigns…';
  listEl.appendChild(loading);
  root.appendChild(listEl);

  loadTodayEarned();
}

function _loadAndRenderList() {
  if (_viewerState.listRendering) { return; }
  _viewerState.listRendering = true;
  // Fetch Maxima contacts first so we can show creator names and avatars
  MDS.cmd('maxcontacts action:list', function(contactsRes) {
    var contactsMap = {};
    if (contactsRes && contactsRes.status && contactsRes.response && contactsRes.response.contacts) {
      var clist = contactsRes.response.contacts;
      for (var ci = 0; ci < clist.length; ci++) {
        var ct = clist[ci];
        if (ct.publickey) {
          contactsMap[ct.publickey.toUpperCase()] = {
            name: (ct.extradata && ct.extradata.name) ? ct.extradata.name : '',
            icon: (ct.extradata && ct.extradata.icon && ct.extradata.icon !== '0x00') ? ct.extradata.icon : ''
          };
        }
      }
    }

    var sql = "SELECT c.ID, c.TITLE, c.CREATOR_ADDRESS, c.BUDGET_REMAINING, c.REWARD_VIEW, c.REWARD_CLICK, "
      + "c.STATUS, c.MAX_VIEWER_REWARD, c.EXPIRES_AT, c.PUBLISHER_REWARD_VIEW, "
      + "a.ID AS AD_ID, a.TITLE AS AD_TITLE, a.BODY AS AD_BODY, "
      + "a.CTA_LABEL AS AD_CTA_LABEL, a.CTA_URL AS AD_CTA_URL, "
      + "a.IMAGE_DATA, a.SHOW_TITLE, a.SHOW_BODY, a.SHOW_CTA, "
      + "a.BG_COLOR, a.TEXT_COLOR, a.IMAGE_POSITION, a.IMAGE_ZOOM, a.IMAGE_WIDTH_PCT "
      + "FROM CAMPAIGNS c LEFT JOIN ADS a ON UPPER(a.CAMPAIGN_ID) = UPPER(c.ID) "
      + "WHERE UPPER(c.STATUS) = 'ACTIVE'";

    sqlQuery(sql, function(err, rows) {
      var listEl = document.getElementById('ma-campaign-list');
      if (!listEl) { return; }

      listEl.innerHTML = '';

      if (err) {
        var errP = document.createElement('p');
        errP.style.cssText = 'color:var(--pico-muted-color,#6c757d);';
        errP.textContent = 'Error loading campaigns.';
        listEl.appendChild(errP);
        return;
      }

      var addr = MY_ADDRESS ? MY_ADDRESS.toUpperCase() : '';
      var campaigns = (rows || []).filter(function(r) {
        if (addr && r.CREATOR_ADDRESS && r.CREATOR_ADDRESS.toUpperCase() === addr) { return false; }
        if (parseFloat(r.BUDGET_REMAINING) < parseFloat(r.REWARD_VIEW)) { return false; }
        return true;
      });

      if (campaigns.length === 0) {
        var emptyP = document.createElement('p');
        emptyP.style.cssText = 'color:var(--pico-muted-color,#6c757d);text-align:center;padding:2rem 0;';
        emptyP.textContent = 'No ads available right now.';
        listEl.appendChild(emptyP);
        return;
      }

      for (var i = 0; i < campaigns.length; i++) {
        var contact = contactsMap[(campaigns[i].CREATOR_ADDRESS || '').toUpperCase()] || null;
        listEl.appendChild(_buildCampaignRow(campaigns[i], contact));
      }
      _fetchNonContactProfiles(campaigns, contactsMap);
      _viewerState.listRendering = false;
    });
  });
}

function _buildCampaignRow(campaign, contact) {
  var row = document.createElement('button');
  row.type = 'button';
  row.style.cssText = 'display:flex;width:100%;align-items:center;gap:.85rem;'
    + 'padding:.75rem .85rem;background:transparent;border:none;border-radius:0;'
    + 'border-bottom:1px solid var(--pico-muted-border-color,#ddd);'
    + 'cursor:pointer;text-align:left;color:inherit;margin:0;box-shadow:none;'
    + 'transition:background .12s;';

  // Deterministic hue from campaign ID for a stable fallback colour
  var hue = 0;
  var cid = campaign.ID || '';
  for (var ci = 0; ci < cid.length; ci++) { hue = (hue + cid.charCodeAt(ci)) % 360; }

  var letter = (campaign.AD_TITLE || campaign.TITLE || '?').charAt(0).toUpperCase();

  var avatar = document.createElement('div');
  avatar.className = 'ma-row-avatar';
  avatar.setAttribute('aria-hidden', 'true');
  avatar.setAttribute('data-letter', letter);
  avatar.style.cssText = 'width:2.75rem;height:2.75rem;min-width:2.75rem;border-radius:50%;'
    + 'overflow:hidden;display:flex;align-items:center;justify-content:center;'
    + 'font-weight:700;font-size:1.1rem;color:#fff;'
    + 'background:hsl(' + hue + ',52%,46%);';

  if (contact && contact.icon) {
    var img = document.createElement('img');
    img.src = contact.icon;
    img.alt = '';
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
    img.onerror = function() { avatar.removeChild(img); avatar.textContent = letter; };
    avatar.appendChild(img);
  } else {
    avatar.textContent = letter;
  }

  var textDiv = document.createElement('div');
  textDiv.style.cssText = 'flex:1;min-width:0;';

  var titleEl = document.createElement('div');
  titleEl.style.cssText = 'font-weight:600;font-size:.95rem;'
    + 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
  titleEl.textContent = DOMPurify.sanitize(campaign.AD_TITLE || campaign.TITLE || 'Untitled');

  textDiv.appendChild(titleEl);

  if (contact && contact.name) {
    var creatorEl = document.createElement('div');
    creatorEl.style.cssText = 'font-size:.75rem;color:var(--pico-muted-color,#6c757d);'
      + 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:.1rem;';
    creatorEl.textContent = DOMPurify.sanitize(contact.name);
    textDiv.appendChild(creatorEl);
  }

  var bodyRaw = ((campaign.AD_BODY || '') + '').replace(/\s+/g, ' ').trim();
  var bodyEl = document.createElement('div');
  bodyEl.className = 'ma-row-body';
  bodyEl.style.cssText = 'color:var(--pico-muted-color,#6c757d);font-size:.82rem;'
    + 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:.1rem;';
  bodyEl.textContent = DOMPurify.sanitize(bodyRaw.length > 60 ? bodyRaw.substring(0, 60) + '…' : bodyRaw);
  textDiv.appendChild(bodyEl);

  var rv = parseFloat(campaign.REWARD_VIEW) || 0;
  var rc = parseFloat(campaign.REWARD_CLICK) || 0;
  var rewardText = rv.toFixed(3) + ' MINIMA/view';
  if (rc > 0) { rewardText = rewardText + '  ·  ' + rc.toFixed(3) + '/click'; }
  var rewardEl = document.createElement('div');
  rewardEl.style.cssText = 'font-size:.75rem;color:var(--pico-primary,#6366f1);margin-top:.2rem;';
  rewardEl.textContent = rewardText;
  textDiv.appendChild(rewardEl);

  var arrow = document.createElement('span');
  arrow.setAttribute('aria-hidden', 'true');
  arrow.style.cssText = 'color:var(--pico-muted-color,#6c757d);font-size:1.2rem;flex-shrink:0;';
  arrow.textContent = '›';

  row.appendChild(avatar);
  row.appendChild(textDiv);
  row.appendChild(arrow);

  row.setAttribute('data-creator-pk', (campaign.CREATOR_ADDRESS || '').toUpperCase());
  row.addEventListener('mouseover', function() {
    row.style.background = _viewerRowHoverBackground();
  });
  row.addEventListener('mouseout', function() { row.style.background = 'transparent'; });
  row.addEventListener('click', function() { _openCampaign(campaign); });

  return row;
}

function _viewerRowHoverBackground() {
  var theme = document.documentElement.getAttribute('data-theme') || '';
  if (theme === 'dark') { return 'rgba(255,255,255,.06)'; }
  return 'rgba(15,23,42,.05)';
}

// ── Detail view ────────────────────────────────────────────────────────────────

function _openCampaign(campaign) {
  _viewerState.mode = 'detail';
  _viewerState.campaign = campaign;
  _viewerState.viewTracked = false;

  var root = document.getElementById('app');
  if (!root) { return; }
  root.innerHTML = '';
  _buildDetailShell(root);
  _startDetailAd();
}

function _buildDetailShell(root) {
  var backRow = document.createElement('div');
  backRow.style.cssText = 'margin-bottom:.75rem;';
  var backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = 'outline secondary';
  backBtn.style.cssText = 'width:auto;padding:.3rem .85rem;font-size:.875rem;';
  backBtn.textContent = '← Back';
  backBtn.addEventListener('click', _goBackToList);
  backRow.appendChild(backBtn);
  root.appendChild(backRow);

  var earnedRow = document.createElement('div');
  earnedRow.style.cssText = 'display:flex;gap:.75rem;margin-bottom:1rem;';
  var earnedCard = mkStatCard('Today earned', '—');
  earnedCard.id = 'ma-earned-card';
  earnedRow.appendChild(earnedCard);
  root.appendChild(earnedRow);

  var adArticle = document.createElement('article');
  adArticle.id = 'ma-ad-article';
  adArticle.style.cssText = 'padding:0;overflow:hidden;margin-bottom:.75rem;';

  var slot = document.createElement('div');
  slot.id = 'ma-ad-slot';
  adArticle.appendChild(slot);

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

  var status = document.createElement('p');
  status.id = 'ma-viewer-status';
  status.setAttribute('role', 'status');
  status.style.cssText = 'min-height:1.4rem;color:var(--pico-muted-color,#6c757d);font-size:.875rem;margin-bottom:.75rem;';
  root.appendChild(status);

  loadTodayEarned();
}

function _startDetailAd() {
  var campaign = _viewerState.campaign;
  if (!campaign) { return; }
  if (typeof MinimaAds === 'undefined' || typeof MinimaAds.render !== 'function') { return; }

  MinimaAds.render(campaign, 'ma-ad-slot');
  _wireDetailInteractions(campaign);
  _startProgressBar();

  _viewerState.viewTimerId = setTimeout(function() {
    _trackDetailView(campaign);
  }, LIMITS.MIN_VIEW_DURATION_MS);
}

function _trackDetailView(campaign) {
  if (_viewerState.viewTracked) { return; }
  if (!_viewerState.campaign || _viewerState.campaign.ID !== campaign.ID) { return; }
  _viewerState.viewTracked = true;
  _stopProgressBar();

  var payload = {
    type: 'MA_TRACK_VIEW',
    campaignId: campaign.ID,
    userAddress: MY_ADDRESS,
    publisherKey: ''
  };
  window.MDS.comms.broadcast(JSON.stringify(payload), function() {});
  loadTodayEarned();
}

function _wireDetailInteractions(campaign) {
  var slot = document.getElementById('ma-ad-slot');
  if (!slot) { return; }
  var links = slot.querySelectorAll('a[href]');
  for (var i = 0; i < links.length; i++) {
    links[i].addEventListener('click', function(e) {
      e.preventDefault();
      var href = e.currentTarget.getAttribute('href');
      var payload = {
        type: 'MA_TRACK_CLICK',
        campaignId: campaign.ID,
        userAddress: MY_ADDRESS,
        publisherKey: ''
      };
      window.MDS.comms.broadcast(JSON.stringify(payload), function() {
        if (href) { window.open(href, '_blank', 'noopener'); }
        _goBackToList();
      });
    });
  }
}

function _goBackToList() {
  _clearViewerTimers();
  _viewerState.mode = 'list';
  _viewerState.campaign = null;
  _viewerState.viewTracked = false;

  var root = document.getElementById('app');
  if (!root) { return; }
  root.innerHTML = '';
  _buildListShell(root);
  _loadAndRenderList();
}

// ── Progress bar ───────────────────────────────────────────────────────────────

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

// ── Shared helpers ─────────────────────────────────────────────────────────────

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

// ── Profile request / response (non-contact creators) ─────────────────────────

function _fetchNonContactProfiles(campaigns, contactsMap) {
  var seen = {};
  for (var i = 0; i < campaigns.length; i++) {
    var pk = (campaigns[i].CREATOR_ADDRESS || '').toUpperCase();
    if (!pk || contactsMap[pk] || seen[pk]) { continue; }
    seen[pk] = true;
    _loadOrRequestProfile(pk, campaigns[i].ID);
  }
}

function _loadOrRequestProfile(pk, campaignId) {
  MDS.keypair.get('CREATOR_PROFILE_' + pk, function(kpRes) {
    var cached = (kpRes && kpRes.status && kpRes.value) ? kpRes.value : '';
    if (cached) {
      try {
        var profile = JSON.parse(cached);
        _applyProfileToRow(pk, profile);
      } catch (e) {}
      return;
    }
    // Look up creator Mx contact string stored during on-chain discovery.
    // Required for to: routing — publickey: routing fails when creator is not in contacts.
    MDS.keypair.get('CREATOR_MX_' + campaignId, function(mxRes) {
      var mxAddress = (mxRes && mxRes.status && mxRes.value) ? mxRes.value : '';
      _sendProfileRequest(pk, mxAddress);
    });
  });
}

function _sendProfileRequest(pk, mxAddress) {
  if (!pk && !mxAddress) { return; }
  if (typeof MDS === 'undefined') { return; }
  // Include our own Mx so the creator can route the PROFILE_RESPONSE back to us
  // via to: even when we are not in their contacts (mirrors CREATOR_LIVENESS_PING pattern).
  var payload = JSON.stringify({type: 'PROFILE_REQUEST', requester_mx: MY_MX_ADDRESS});
  var hex = '0x' + utf8ToHex(payload).toUpperCase();
  var cmd;
  if (mxAddress) {
    cmd = 'maxima action:send to:' + mxAddress
      + ' application:' + APP_NAME
      + ' data:' + hex
      + ' poll:false';
  } else {
    cmd = 'maxima action:send publickey:' + pk
      + ' application:' + APP_NAME
      + ' data:' + hex
      + ' poll:false';
  }
  MDS.cmd(cmd, function() {});
}

function _applyProfileToRow(pk, profile) {
  if (!pk || !profile) { return; }
  var row = document.querySelector('[data-creator-pk="' + pk + '"]');
  if (!row) { return; }

  if (profile.icon) {
    var avatarEl = row.querySelector('.ma-row-avatar');
    if (avatarEl) {
      var existingImg = avatarEl.querySelector('img');
      if (!existingImg) {
        var letter = avatarEl.getAttribute('data-letter') || '?';
        avatarEl.innerHTML = '';
        var img = document.createElement('img');
        img.src = profile.icon;
        img.alt = '';
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
        img.onerror = function() { avatarEl.innerHTML = ''; avatarEl.textContent = letter; };
        avatarEl.appendChild(img);
      }
    }
  }

  if (profile.name) {
    var existingCreator = row.querySelector('.ma-row-creator');
    if (!existingCreator) {
      var bodyEl = row.querySelector('.ma-row-body');
      if (bodyEl && bodyEl.parentNode) {
        var creatorEl = document.createElement('div');
        creatorEl.className = 'ma-row-creator';
        creatorEl.style.cssText = 'font-size:.75rem;color:var(--pico-muted-color,#6c757d);'
          + 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:.1rem;';
        creatorEl.textContent = DOMPurify.sanitize(profile.name);
        bodyEl.parentNode.insertBefore(creatorEl, bodyEl);
      }
    } else {
      existingCreator.textContent = DOMPurify.sanitize(profile.name);
    }
  }
}

function onProfileReceived(parsed) {
  if (!parsed || !parsed.publickey) { return; }
  var pk = parsed.publickey.toUpperCase();
  // SW already cached the full profile (including icon) to keypair before signalling.
  // Read it here so we get the icon without re-transmitting it through signalFE.
  MDS.keypair.get('CREATOR_PROFILE_' + pk, function(kpRes) {
    var cached = (kpRes && kpRes.status && kpRes.value) ? kpRes.value : '';
    var profile = {name: parsed.name || '', icon: ''};
    if (cached) {
      try { profile = JSON.parse(cached); } catch (e) {}
    }
    if (_viewerState.mode === 'list') { _applyProfileToRow(pk, profile); }
  });
}

function onCampaignsChanged() {
  if (_viewerState.mode === 'list') { _loadAndRenderList(); }
}
