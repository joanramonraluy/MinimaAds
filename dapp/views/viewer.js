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
  listRendering: false,
  rewardAllowed: false,
  clickRewardErrorMsg: ''
};

function renderViewer(root) {
  _clearViewerTimers();
  _viewerState.mode = 'list';
  _viewerState.campaign = null;
  _viewerState.viewTracked = false;
  _viewerState.rewardAllowed = false;
  _viewerState.clickRewardErrorMsg = '';
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
  h2.style.cssText = 'margin:0 0 1.5rem 0;padding:1rem;background:rgba(0,0,0,0.02);border-left:4px solid #10b981;border-radius:0.375rem;';
  root.appendChild(h2);

  var summarySection = document.createElement('section');
  summarySection.style.cssText = 'margin-bottom:1.5rem;padding:.75rem 1rem;border:1px solid var(--pico-border-color);border-radius:var(--pico-border-radius);background-color:rgba(0,0,0,0.015);border-left:3px solid #10b981;';
  var summaryRow = document.createElement('div');
  summaryRow.style.cssText = 'display:flex;gap:.75rem;flex-wrap:wrap;';
  var earnedCard = mkStatCard('Today earned', '—');
  earnedCard.id = 'ma-earned-card';
  summaryRow.appendChild(earnedCard);
  summarySection.appendChild(summaryRow);
  root.appendChild(summarySection);

  var listSection = document.createElement('section');
  listSection.style.cssText = 'margin-bottom:1.5rem;';
  var listTitle = document.createElement('p');
  listTitle.className = 'ma-section-title';
  listTitle.textContent = 'Available campaigns';
  listTitle.style.cssText = 'display:block;font-size:.78rem;color:var(--pico-muted-color,#6c757d);margin-top:0;text-transform:uppercase;letter-spacing:.04em;margin-bottom:.75rem;';
  listSection.appendChild(listTitle);

  var listEl = document.createElement('div');
  listEl.id = 'ma-campaign-list';
  listEl.style.cssText = 'border:1px solid var(--pico-muted-border-color,#ddd);border-radius:var(--pico-border-radius);overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);';
  var loading = document.createElement('p');
  loading.setAttribute('aria-busy', 'true');
  loading.style.cssText = 'color:var(--pico-muted-color,#6c757d);padding:1rem;margin:0;';
  loading.textContent = 'Loading campaigns…';
  listEl.appendChild(loading);
  listSection.appendChild(listEl);
  root.appendChild(listSection);

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
      + "a.BG_COLOR, a.TEXT_COLOR, a.IMAGE_POSITION, a.IMAGE_ZOOM, a.IMAGE_WIDTH_PCT, "
      + "cs.CUMULATIVE_EARNED AS USER_CUMULATIVE, cs.MAX_AMOUNT AS USER_MAX_AMOUNT, cs.STATUS AS USER_CHANNEL_STATUS "
      + "FROM CAMPAIGNS c LEFT JOIN ADS a ON UPPER(a.CAMPAIGN_ID) = UPPER(c.ID) "
      + "LEFT JOIN CHANNEL_STATE cs ON UPPER(cs.CAMPAIGN_ID) = UPPER(c.ID) AND UPPER(cs.VIEWER_KEY) = UPPER('" + escapeSql(MY_ADDRESS || '') + "') AND cs.ROLE = 'viewer' "
      + "WHERE UPPER(c.STATUS) = 'ACTIVE'";

    sqlQuery(sql, function(err, rows) {
      var listEl = document.getElementById('ma-campaign-list');
      if (!listEl) { return; }

      listEl.innerHTML = '';

      if (err) {
        listEl.innerHTML = '';
        listEl.style.border = 'none';
        listEl.style.boxShadow = 'none';
        var errP = document.createElement('p');
        errP.style.cssText = 'color:var(--pico-del-color,#c0392b);padding:1rem;margin:0;text-align:center;';
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
        listEl.innerHTML = '';
        listEl.style.border = 'none';
        listEl.style.boxShadow = 'none';
        var emptyState = mkEmptyState('No ads available right now.', null, null);
        emptyState.style.cssText = 'padding:3rem 1rem;';
        listEl.appendChild(emptyState);
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
    + 'padding:1rem .85rem;background:transparent;border:none;border-radius:0;'
    + 'border-bottom:1px solid var(--pico-muted-border-color,#ddd);'
    + 'cursor:pointer;text-align:left;color:inherit;margin:0;box-shadow:none;'
    + 'transition:background .12s,border-color .12s;';

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

  var titleRow = document.createElement('div');
  titleRow.style.cssText = 'display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;';

  var titleEl = document.createElement('div');
  titleEl.style.cssText = 'font-weight:600;font-size:.95rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
  titleEl.textContent = DOMPurify.sanitize(campaign.AD_TITLE || campaign.TITLE || 'Untitled');
  titleRow.appendChild(titleEl);

  if (campaign.USER_CHANNEL_STATUS) {
    var cStatus = campaign.USER_CHANNEL_STATUS || '';
    if (cStatus === 'open' || cStatus === 'pending') {
      var cumulative = parseFloat(campaign.USER_CUMULATIVE) || 0;
      var maxAmount = parseFloat(campaign.USER_MAX_AMOUNT) || 0;
      var reward = parseFloat(campaign.REWARD_VIEW) || 0;
      if (cumulative + reward > maxAmount) {
        var limitBadge = mkStatusBadge('completed');
        titleRow.appendChild(limitBadge);
      }
    }
  }

  textDiv.appendChild(titleRow);

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
  var rewardText = fmtAmt(rv, 3) + ' MINIMA/view';
  if (rc > 0) { rewardText = rewardText + '  ·  ' + fmtAmt(rc, 3) + '/click'; }
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
    row.style.borderLeftColor = '#10b981';
    row.style.borderLeft = '3px solid #10b981';
    row.style.paddingLeft = 'calc(.85rem - 2px)';
  });
  row.addEventListener('mouseout', function() {
    row.style.background = 'transparent';
    row.style.borderLeft = 'none';
    row.style.paddingLeft = '.85rem';
    row.style.borderLeftColor = 'transparent';
  });
  row.addEventListener('click', function() { window.location.hash = 'campaign-detail?id=' + campaign.ID; });

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
  _viewerState.rewardAllowed = false;
  _viewerState.clickRewardErrorMsg = '';

  var root = document.getElementById('app');
  if (!root) { return; }
  root.innerHTML = '';
  _buildDetailShell(root);
  _startDetailAd();
}

function _buildDetailShell(root) {
  var backRow = document.createElement('div');
  backRow.style.cssText = 'margin-bottom:1rem;';
  var backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = 'outline secondary';
  backBtn.style.cssText = 'width:auto;padding:.3rem .85rem;font-size:.875rem;';
  backBtn.textContent = '← Back';
  backBtn.addEventListener('click', _goBackToList);
  backRow.appendChild(backBtn);
  root.appendChild(backRow);

  var summarySection = document.createElement('section');
  summarySection.style.cssText = 'margin-bottom:1.5rem;padding:.75rem 1rem;border:1px solid var(--pico-border-color);border-radius:var(--pico-border-radius);background-color:rgba(0,0,0,0.015);border-left:3px solid #10b981;';
  var summaryRow = document.createElement('div');
  summaryRow.style.cssText = 'display:flex;gap:.75rem;flex-wrap:wrap;';
  var earnedCard = mkStatCard('Today earned', '—');
  earnedCard.id = 'ma-earned-card';
  summaryRow.appendChild(earnedCard);
  summarySection.appendChild(summaryRow);
  root.appendChild(summarySection);

  var adArticle = document.createElement('article');
  adArticle.id = 'ma-ad-article';
  adArticle.style.cssText = 'padding:0;overflow:hidden;margin-bottom:1.5rem;border:1px solid var(--pico-border-color);border-radius:var(--pico-border-radius);box-shadow:0 2px 8px rgba(0,0,0,0.08);';

  var slot = document.createElement('div');
  slot.id = 'ma-ad-slot';
  adArticle.appendChild(slot);

  var progressWrap = document.createElement('div');
  progressWrap.id = 'ma-view-progress-wrap';
  progressWrap.style.cssText = 'padding:.75rem 1rem;display:none;border-top:1px solid var(--pico-muted-border-color,#ddd);background:rgba(0,0,0,0.02);';
  var progressBar = document.createElement('progress');
  progressBar.id = 'ma-view-progress';
  progressBar.max = 100;
  progressBar.value = 0;
  progressBar.style.cssText = 'width:100%;height:.35rem;margin:0 0 .5rem;';
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

  campaign.force_full = true;
  MinimaAds.render(campaign, 'ma-ad-slot');
  _wireDetailInteractions(campaign);

  var statusEl = document.getElementById('ma-viewer-status');
  if (statusEl) {
    statusEl.textContent = 'Checking reward status...';
    statusEl.style.color = 'var(--pico-muted-color,#6c757d)';
  }

  validateView(campaign.ID, MY_ADDRESS, function(result) {
    if (!result.valid) {
      _viewerState.rewardAllowed = false;
      if (statusEl) {
        var reasonMsg = 'Reward not available';
        if (result.reason === 'cooldown active') {
          reasonMsg = 'You must wait before earning again from this campaign.';
        } else if (result.reason === 'daily view limit reached') {
          reasonMsg = 'You\'ve reached the daily view limit for this campaign.';
        } else if (result.reason === 'campaign reward limit reached for this user') {
          reasonMsg = 'You have reached the maximum reward limit for this campaign.';
        } else if (result.reason === 'insufficient budget') {
          reasonMsg = 'Campaign has insufficient budget for this reward.';
        } else if (result.reason === 'campaign not active') {
          reasonMsg = 'This campaign is no longer active.';
        } else if (result.reason === 'creator cannot earn from own campaign') {
          reasonMsg = 'You cannot earn rewards from your own campaigns.';
        } else if (result.reason === 'db error') {
          reasonMsg = 'System error processing reward.';
        }
        statusEl.textContent = reasonMsg;
        statusEl.style.color = 'var(--pico-del-color,#c0392b)';
      }
      return;
    }

    _viewerState.rewardAllowed = true;
    if (statusEl) {
      statusEl.textContent = '';
    }
    _startProgressBar();
    _viewerState.viewTimerId = setTimeout(function() {
      _trackDetailView(campaign);
    }, LIMITS.MIN_VIEW_DURATION_MS);
  });
}

function _trackDetailView(campaign) {
  if (_viewerState.viewTracked) { return; }
  if (!_viewerState.campaign || _viewerState.campaign.ID !== campaign.ID) { return; }
  _viewerState.viewTracked = true;
  _stopProgressBar();

  var statusEl = document.getElementById('ma-viewer-status');
  if (statusEl) { statusEl.textContent = 'Processing reward…'; }

  var payload = {
    type: 'MA_TRACK_VIEW',
    campaignId: campaign.ID,
    userAddress: MY_ADDRESS,
    publisherKey: MINIMAADS_CREATOR_PK
  };
  console.log('[MA-BUILTIN-VIEWER] TRACK_VIEW: userAddress format=DIRECT_ADDRESS publisherKey format=RSA_KEY');
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

      if (!_viewerState.rewardAllowed) {
        if (href) { window.open(href, '_blank', 'noopener'); }
        if (_viewerState.clickRewardErrorMsg) {
          var statusEl = document.getElementById('ma-viewer-status');
          if (statusEl) {
            statusEl.textContent = _viewerState.clickRewardErrorMsg;
            statusEl.style.color = 'var(--pico-del-color,#c0392b)';
          }
        }
        return;
      }

      var statusEl = document.getElementById('ma-viewer-status');
      if (statusEl) { statusEl.textContent = 'Processing reward…'; }
      var payload = {
        type: 'MA_TRACK_CLICK',
        campaignId: campaign.ID,
        userAddress: MY_ADDRESS,
        publisherKey: MINIMAADS_CREATOR_PK
      };
      window.MDS.comms.broadcast(JSON.stringify(payload), function() {
        if (href) { window.open(href, '_blank', 'noopener'); }
      });
    });
  }
}

function _goBackToList() {
  _clearViewerTimers();
  _viewerState.mode = 'list';
  _viewerState.campaign = null;
  _viewerState.viewTracked = false;
  _viewerState.rewardAllowed = false;
  _viewerState.clickRewardErrorMsg = '';

  window.location.hash = 'campaigns';
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
    strong.textContent = fmtAmt(total, 6) + ' MINIMA';
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

function onRewardValidation(result) {
  if (_viewerState.mode !== 'detail' || !result) { return; }
  var statusEl = document.getElementById('ma-viewer-status');
  if (!statusEl) { return; }
  if (result.confirmed) {
    statusEl.textContent = 'Reward confirmed! Opening secure channel…';
    if (result.reward_type === 'click') {
      _viewerState.rewardAllowed = false;
      _viewerState.clickRewardErrorMsg = 'You must wait before earning another click reward from this campaign.';
    }
  } else {
    var reasonMsg = 'Reward not available';
    if (result.reason === 'cooldown active') {
      if (result.reward_type === 'click') {
        reasonMsg = 'You must wait before earning another click reward from this campaign.';
      } else {
        reasonMsg = 'You must wait before earning again from this campaign.';
      }
    } else if (result.reason === 'daily view limit reached') {
      reasonMsg = 'You\'ve reached the daily view limit for this campaign.';
    } else if (result.reason === 'daily click limit reached') {
      reasonMsg = 'You\'ve reached the daily click limit for this campaign.';
    } else if (result.reason === 'campaign reward limit reached for this user') {
      reasonMsg = 'You have reached the maximum reward limit for this campaign.';
    } else if (result.reason === 'insufficient budget') {
      reasonMsg = 'Campaign has insufficient budget for this reward.';
    } else if (result.reason === 'campaign not active') {
      reasonMsg = 'This campaign is no longer active.';
    } else if (result.reason === 'creator cannot earn from own campaign') {
      reasonMsg = 'You cannot earn rewards from your own campaigns.';
    } else if (result.reason === 'db error') {
      reasonMsg = 'System error processing reward.';
    }
    statusEl.textContent = reasonMsg;
    statusEl.style.color = 'var(--pico-del-color,#c0392b)';
    if (result.reward_type === 'click') {
      _viewerState.rewardAllowed = false;
      _viewerState.clickRewardErrorMsg = reasonMsg;
    }
  }
}

function onViewerVoucherReceived(parsed) {
  console.log('[VIEWER] onViewerVoucherReceived parsed:', parsed, 'current campaign:', _viewerState.campaign);
  if (_viewerState.mode !== 'detail' || !_viewerState.campaign || !parsed) { return; }
  var pId = String(parsed.campaign_id || '').trim().toUpperCase();
  var cId = String(_viewerState.campaign.ID || '').trim().toUpperCase();
  if (pId !== cId) {
    console.log('[VIEWER] campaign ID mismatch:', pId, 'vs', cId);
    return;
  }
  var statusEl = document.getElementById('ma-viewer-status');
  if (statusEl) {
    var rType = parsed.reward_type || 'view';
    var amt = (rType === 'click')
      ? (parseFloat(_viewerState.campaign.REWARD_CLICK) || 0)
      : (parseFloat(_viewerState.campaign.REWARD_VIEW) || 0);
    statusEl.textContent = 'Reward received! +' + fmtAmt(amt, 3) + ' MINIMA';
    statusEl.style.color = '#10b981';
  }
}

function renderCampaignDetail(root) {
  _clearViewerTimers();
  var params = typeof getHashParams === 'function' ? getHashParams() : {};
  var id = params.id;
  if (!id) {
    window.location.hash = 'campaigns';
    return;
  }
  root.innerHTML = '';
  var loading = mkLoading('Loading campaign details…');
  loading.style.padding = '3rem 1rem';
  root.appendChild(loading);

  if (typeof getCampaign !== 'function') {
    var errP = document.createElement('p');
    errP.style.cssText = 'color:var(--pico-del-color,#c0392b);padding:1rem;text-align:center;';
    errP.textContent = 'System error: campaign service not loaded.';
    root.appendChild(errP);
    return;
  }

  var detailSql = "SELECT c.ID, c.TITLE, c.CREATOR_ADDRESS, c.BUDGET_REMAINING, c.REWARD_VIEW, c.REWARD_CLICK, "
    + "c.STATUS, c.MAX_VIEWER_REWARD, c.EXPIRES_AT, c.PUBLISHER_REWARD_VIEW, "
    + "a.ID AS AD_ID, a.TITLE AS AD_TITLE, a.BODY AS AD_BODY, "
    + "a.CTA_LABEL AS AD_CTA_LABEL, a.CTA_URL AS AD_CTA_URL, "
    + "a.IMAGE_DATA, a.SHOW_TITLE, a.SHOW_BODY, a.SHOW_CTA, "
    + "a.BG_COLOR, a.TEXT_COLOR, a.IMAGE_POSITION, a.IMAGE_ZOOM, a.IMAGE_WIDTH_PCT, "
    + "cs.CUMULATIVE_EARNED AS USER_CUMULATIVE, cs.MAX_AMOUNT AS USER_MAX_AMOUNT, cs.STATUS AS USER_CHANNEL_STATUS "
    + "FROM CAMPAIGNS c LEFT JOIN ADS a ON UPPER(a.CAMPAIGN_ID) = UPPER(c.ID) "
    + "LEFT JOIN CHANNEL_STATE cs ON UPPER(cs.CAMPAIGN_ID) = UPPER(c.ID) AND UPPER(cs.VIEWER_KEY) = UPPER('" + escapeSql(MY_ADDRESS || '') + "') AND cs.ROLE = 'viewer' "
    + "WHERE UPPER(c.ID) = UPPER('" + escapeSql(id) + "')";

  sqlQuery(detailSql, function(err, rows) {
    if (err || !rows || rows.length === 0) {
      root.innerHTML = '';
      var errP = document.createElement('p');
      errP.style.cssText = 'color:var(--pico-del-color,#c0392b);padding:1rem;text-align:center;';
      errP.textContent = 'Campaign not found or error loading campaign details.';
      root.appendChild(errP);
      return;
    }
    _openCampaign(rows[0]);
  });
}
