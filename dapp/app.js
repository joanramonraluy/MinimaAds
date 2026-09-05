// T10 — FE entry point.
// MDS.init bootstrap, MDSCOMMS dispatch, hash routing (#viewer | #creator | #stats).
// Waits for DB_READY (from SW signalFE) before rendering any DB-backed view.
// Silently ignores MAXIMA events already persisted by the SW (AGENTS.md §12 #16).
// APP_NAME and LIMITS mirror the SW globals (main.js) so core/minima.js and
// core/selection.js resolve them in FE scope (AGENTS.md §12 #23).

var APP_NAME = 'minima-ads';

var LIMITS = {
  MAX_VIEWS_PER_CAMPAIGN_PER_DAY:  100,
  MAX_CLICKS_PER_CAMPAIGN_PER_DAY: 100,
  COOLDOWN_BETWEEN_REWARDS_MS:     30000,
  MIN_VIEW_DURATION_MS:            3000,
  MAX_CAMPAIGNS_PER_SESSION:       10,
  MIN_BUDGET:                      100,
  MIN_REWARD_VIEW:                 0.001,
  MIN_REWARD_CLICK:                0.005,
  MAX_CAMPAIGN_DAYS:               90,
  MIN_PUBLISHER_REWARD_VIEW:       0.001,
  MAX_CHANNEL_RESERVATION:         10,
  SETTLEMENT_GRACE_DAYS:           7
};

var MY_ADDRESS = '';
var MY_MX_ADDRESS = '';
var MY_MX_NAME = '';
var MY_MX_ICON = '';
var _dbReady = false;
var _activeMode = 'viewer';
var _profileInterestsSaveTimer = 0;
var _networkConnected = true;
var _lastNewblockTime = 0;
var _newblockOfflineTimer = null;
var _NEWBLOCK_OFFLINE_MS = 120000;

// Number format preference: 'EU' = 1.234,56  |  'EN' = 1,234.56
window.NUMFMT = 'EU';

window.fmtAmt = function(val, decimals) {
  if (typeof decimals !== 'number') { decimals = 6; }
  var n = typeof val === 'number' ? val : parseFloat(val);
  if (!isFinite(n)) { n = 0; }
  var s = n.toFixed(decimals);
  var parts = s.split('.');
  var thouSep = window.NUMFMT === 'EU' ? '.' : ',';
  var decSep  = window.NUMFMT === 'EU' ? ',' : '.';
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thouSep);
  return decimals > 0 ? parts[0] + decSep + parts[1] : parts[0];
};

window.parseAmt = function(str) {
  if (typeof str !== 'string') { str = String(str || ''); }
  str = str.trim();
  if (window.NUMFMT === 'EU') {
    str = str.replace(/\./g, '').replace(',', '.');
  } else {
    str = str.replace(/,/g, '');
  }
  return parseFloat(str);
};

function setNumberFormat(fmt) {
  window.NUMFMT = fmt;
  MDS.keypair.set('UI_NUMBER_FORMAT', fmt, function() {});
  _updateSettingsUI();
}

var MODE_VIEWS = {
  viewer:    ['campaigns', 'earnings', 'campaign-detail'],
  creator:   ['creator', 'mycampaigns', 'campaigns'],
  publisher: ['frames', 'earnings', 'campaigns']
};
// Tracks in-flight channel-related pending txns. Keyed by pendinguid.
// Mirrored to keypair (PENDING_CHANNEL_<uid>) so FE reloads don't lose context.
var _pendingChannelOps = {};

// Fix #18: generateUID() backs several primary keys (CAMPAIGNS.ID, ADS.ID,
// FRAMES.FRAME_ID, settlement txIds). A bare timestamp+random pair can collide
// when two are minted in the same millisecond — a monotonic per-page counter
// plus a second random segment makes that practically impossible.
var _uidCounter = 0;
function generateUID() {
  _uidCounter = (_uidCounter + 1) % 0xFFFF;
  return Date.now().toString(16) + '-' + _uidCounter.toString(16) + '-' +
    Math.floor(Math.random() * 0xFFFFFFFF).toString(16) + Math.floor(Math.random() * 0xFFFFFFFF).toString(16);
}

function currentRoute() {
  var h = (window.location.hash || '').replace(/^#/, '');
  var base = h.split('?')[0];
  if (base === 'creator' || base === 'mycampaigns' || base === 'viewer' || base === 'earnings' || base === 'frames' || base === 'campaigns' || base === 'settings' || base === 'settings/maxima-routes' || base === 'profile' || base === 'help' || base === 'campaign-detail') { return base; }
  return 'viewer';
}

function getHashParams() {
  var h = (window.location.hash || '').replace(/^#/, '');
  var parts = h.split('?');
  if (parts.length < 2) { return {}; }
  var query = parts[1];
  var pairs = query.split('&');
  var params = {};
  for (var i = 0; i < pairs.length; i++) {
    var pair = pairs[i].split('=');
    if (pair[0]) {
      params[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
    }
  }
  return params;
}

function renderNav() {
  var modeLabel = _activeMode.charAt(0).toUpperCase() + _activeMode.slice(1);
  var hamburgerLabel = document.getElementById('ma-menu-role-label');
  if (hamburgerLabel) { hamburgerLabel.textContent = modeLabel; }
  var drawerRoleCurrent = document.getElementById('ma-drawer-role-current');
  if (drawerRoleCurrent) { drawerRoleCurrent.textContent = modeLabel; }
  var modeNames = ['viewer', 'creator', 'publisher'];
  for (var i = 0; i < modeNames.length; i++) {
    var btn = document.getElementById('ma-drawer-role-' + modeNames[i]);
    if (btn) { btn.setAttribute('aria-selected', modeNames[i] === _activeMode ? 'true' : 'false'); }
  }
  var linksEl = document.getElementById('ma-nav-links');
  if (!linksEl) { return; }
  if (currentRoute() === 'settings' || currentRoute() === 'settings/maxima-routes' || currentRoute() === 'profile') { linksEl.innerHTML = ''; return; }
  var views = MODE_VIEWS[_activeMode] || MODE_VIEWS.viewer;
  var route = currentRoute();
  var linkDefs = {
    viewer:   { href: '#viewer',   label: 'View Ads' },
    earnings: { href: '#earnings', label: 'Earnings' },
    creator:     { href: '#creator',      label: 'Create' },
    mycampaigns: { href: '#mycampaigns',  label: 'My Campaigns' },
    frames:     { href: '#frames',     label: 'Frames' },
    campaigns:  { href: '#campaigns',  label: 'Campaigns' }
  };
  linksEl.innerHTML = '';
  for (var j = 0; j < views.length; j++) {
    var view = views[j];
    var def = linkDefs[view];
    if (!def) { continue; }
    var li = document.createElement('li');
    var a = document.createElement('a');
    a.href = def.href;
    a.textContent = def.label;
    if (route === view || (view === 'campaigns' && route === 'campaign-detail')) { a.setAttribute('aria-current', 'page'); }
    li.appendChild(a);
    linksEl.appendChild(li);
  }
  if (!linksEl.dataset.hasScrollListener) {
    var arrowRight = document.getElementById('ma-nav-arrow-right');
    var arrowLeft = document.getElementById('ma-nav-arrow-left');
    if (typeof attachScrollIndicator === 'function') {
      var updateFn = attachScrollIndicator(linksEl, arrowRight, arrowLeft);
      linksEl.dataset.hasScrollListener = 'true';
      linksEl.updateScrollIndicator = updateFn;
    }
  }
  if (linksEl.updateScrollIndicator) {
    setTimeout(linksEl.updateScrollIndicator, 50);
  }
}

function setMode(mode) {
  if (!MODE_VIEWS[mode]) { return; }
  _activeMode = mode;
  MDS.keypair.set('USER_MODE', mode, function() {});
  var route = currentRoute();
  if (route === 'settings' || route === 'settings/maxima-routes' || route === 'profile' || route === 'help') {
    window.location.hash = MODE_VIEWS[mode][0];
    return;
  }
  doRender();
}

function goHome() {
  if (typeof closeDrawer === 'function') { closeDrawer(); }
  var view = MODE_VIEWS[_activeMode] ? MODE_VIEWS[_activeMode][0] : 'viewer';
  window.location.hash = view;
}

function setStatus(text) {
  var root = document.getElementById('app');
  if (!root) { return; }
  root.innerHTML = '';
  var p = document.createElement('p');
  p.setAttribute('aria-busy', 'true');
  p.textContent = text;
  root.appendChild(p);
}

function startNetworkStatusMonitoring() {
  _lastNewblockTime = Date.now();
  _scheduleOfflineCheck();
}

function _scheduleOfflineCheck() {
  if (_newblockOfflineTimer) { clearTimeout(_newblockOfflineTimer); }
  _newblockOfflineTimer = setTimeout(function() {
    var sinceLastBlock = Date.now() - _lastNewblockTime;
    if (sinceLastBlock >= _NEWBLOCK_OFFLINE_MS && _networkConnected) {
      _networkConnected = false;
      updateStatusBar();
    }
    _scheduleOfflineCheck();
  }, 15000);
}

function onNewblock() {
  _lastNewblockTime = Date.now();
  if (!_networkConnected) {
    _networkConnected = true;
    updateStatusBar();
  }
}

function updateStatusBar() {
  var statusEl = document.getElementById('ma-status-text');
  var pulseEl = document.querySelector('.ma-status-pulse');
  if (statusEl) {
    statusEl.textContent = _networkConnected ? 'Connected to Minima' : 'Disconnected from Minima';
  }
  if (pulseEl) {
    pulseEl.style.backgroundColor = _networkConnected ? '#10b981' : '#ef4444';
    pulseEl.style.boxShadow = _networkConnected
      ? '0 0 0 0 rgba(16,185,129,0.4)'
      : '0 0 0 0 rgba(239,68,68,0.4)';
  }
}

function doRender() {
  window.scrollTo(0, 0);
  renderNav();
  var root = document.getElementById('app');
  if (!root) { return; }
  if (!_dbReady) {
    setStatus('Initialising database…');
    return;
  }
  if (!MY_ADDRESS) {
    setStatus('Resolving Maxima identity…');
    return;
  }
  var route = currentRoute();
  // Global views — accessible from any mode
  if ((route === 'settings' || route === 'settings/maxima-routes') && typeof renderSettings === 'function') {
    root.innerHTML = '';
    renderSettings(root);
    return;
  }
  if (route === 'profile' && typeof renderProfile === 'function') {
    root.innerHTML = '';
    renderProfile(root);
    return;
  }
  if (route === 'help' && typeof renderHelp === 'function') {
    root.innerHTML = '';
    renderHelp(root);
    return;
  }
  var views = MODE_VIEWS[_activeMode] || MODE_VIEWS.viewer;
  if (views.indexOf(route) === -1) {
    window.location.hash = views[0];
    return;
  }
  root.innerHTML = '';
  if (route === 'creator' && typeof renderCreator === 'function') {
    renderCreator(root);
  } else if (route === 'earnings' && typeof renderEarnings === 'function') {
    renderEarnings(root);
  } else if (route === 'frames' && typeof renderFrames === 'function') {
    renderFrames(root);
  } else if (route === 'mycampaigns' && typeof renderMyCampaigns === 'function') {
    renderMyCampaigns(root);
  } else if (route === 'campaigns' && typeof renderCampaigns === 'function') {
    renderCampaigns(root);
  } else if (route === 'campaign-detail' && typeof renderCampaignDetail === 'function') {
    renderCampaignDetail(root);
  } else if (typeof renderViewer === 'function') {
    renderViewer(root);
  } else {
    setStatus('View not loaded.');
  }
}

function handleMdsComms(parsed) {
  if (!parsed || !parsed.type) { return; }
  if (parsed.type === 'DB_READY') {
    _dbReady = true;
    doRender();
    return;
  }
  if (parsed.type === 'CAMPAIGN_PENDING_DENIED') {
    var msgEl = document.getElementById('ma-creator-msg');
    if (msgEl) { msgEl.textContent = 'Transaction denied — escrow was not funded.'; }
    return;
  }
  if (parsed.type === 'NEW_CAMPAIGN' || parsed.type === 'CAMPAIGN_UPDATED') {
    if (parsed.type === 'CAMPAIGN_UPDATED' && typeof window.onCampaignUpdated === 'function') {
      window.onCampaignUpdated(parsed);
    }
    // Issue 1: viewer auto-settle — when a campaign finishes, check if this node
    // has open channels for it and post the settlement tx. Runs on viewer's node
    // where the local VIEWER_WALLET_PK_<campaignId> keypair is available to sign.
    // AUD-5: only the SW's genuine settling signal (settling:true, set by
    // applyStatusChange only when skipAutoSettle is false — see Fix #3) may
    // trigger the FE's own auto-settle. A fallback-verified CAMPAIGN_FINISH/
    // PAUSE omits settling:true, so it can no longer force this client-side path.
    if (parsed.type === 'CAMPAIGN_UPDATED' && parsed.status === 'finished' && parsed.settling === true && parsed.campaign_id) {
      _autoSettleOpenChannels(parsed.campaign_id);
    }
    if ((currentRoute() === 'viewer' || currentRoute() === 'campaign-detail') && typeof onCampaignsChanged === 'function') {
      onCampaignsChanged();
    }
    if (currentRoute() === 'campaigns' && typeof _loadCampaigns === 'function') {
      _loadCampaigns();
    }
    if (currentRoute() === 'mycampaigns' && typeof loadMyCampaigns === 'function') {
      // If the SW is still settling channels (settling:true), skip the re-render here.
      // onCampaignClosed will trigger loadMyCampaigns once all channels are done.
      if (!parsed.settling) {
        loadMyCampaigns(true);
      }
    }
    if (parsed.type === 'NEW_CAMPAIGN' && currentRoute() === 'creator') {
      var msgEl2 = document.getElementById('ma-creator-msg');
      if (msgEl2 && msgEl2.textContent.indexOf('Awaiting approval') !== -1) {
        msgEl2.textContent = 'Campaign published. ID: ' + (parsed.campaign_id || '');
        var form2 = document.getElementById('ma-creator-form');
        if (form2) { form2.reset(); }
      }
    }
    return;
  }
  if (parsed.type === 'REWARD_CONFIRMED') {
    if (typeof onRewardConfirmed === 'function') {
      onRewardConfirmed(parsed);
    }
    if (currentRoute() === 'mycampaigns' && typeof loadMyCampaigns === 'function') {
      loadMyCampaigns(true);
    }
    return;
  }
  if (parsed.type === 'CHANNEL_OPENED') {
    if (typeof onChannelOpened === 'function') { onChannelOpened(parsed); }
    if (typeof viewerOnChannelOpened === 'function') { viewerOnChannelOpened(parsed); }
    return;
  }
  if (parsed.type === 'VOUCHER_RECEIVED') {
    if (typeof onVoucherReceived === 'function') { onVoucherReceived(parsed); }
    if (currentRoute() === 'earnings' && typeof loadEarnings === 'function') {
      loadEarnings();
    }
    if (typeof onViewerVoucherReceived === 'function') {
      onViewerVoucherReceived(parsed);
    }
    return;
  }
  if (parsed.type === 'SETTLE_CONFIRMED') {
    if (typeof onSettleConfirmed === 'function') { onSettleConfirmed(parsed); }
    // Also update the warnings panel on the mycampaigns view (Issue 2)
    if (typeof window.onMyCampaignsSettleConfirmed === 'function') {
      window.onMyCampaignsSettleConfirmed(parsed);
    }
    return;
  }
  if (parsed.type === 'FRAME_READY' || parsed.type === 'FRAME_CREATED') {
    if (currentRoute() === 'frames' && typeof renderFrames === 'function') {
      renderFrames(document.getElementById('app'));
    }
    return;
  }
  if (parsed.type === 'PUBLISHER_REWARD_CONFIRMED') {
    if (currentRoute() === 'frames' && typeof onPublisherRewardConfirmed === 'function') {
      onPublisherRewardConfirmed(parsed);
    }
    if (currentRoute() === 'earnings' && typeof loadEarnings === 'function') {
      loadEarnings();
    }
    return;
  }
  if (parsed.type === 'STATUS_TX_PENDING') {
    if (typeof window.onStatusTxPending === 'function') {
      window.onStatusTxPending(parsed);
    }
    return;
  }
  if (parsed.type === 'CAMPAIGN_SETTLING') {
    if (typeof window.onCampaignSettling === 'function') {
      window.onCampaignSettling(parsed);
    }
    return;
  }
  if (parsed.type === 'CAMPAIGN_CLOSED') {
    if (typeof window.onCampaignClosed === 'function') {
      window.onCampaignClosed(parsed);
    }
    return;
  }
  if (parsed.type === 'CAMPAIGN_AUTOSETTLE_REQUEST') {
    _handleAutoSettleRequest(parsed);
    return;
  }
  if (parsed.type === 'CREATOR_LIVENESS_PONG') {
    if (typeof window.onCreatorLivenessPong === 'function') {
      window.onCreatorLivenessPong(parsed.campaign_id || '', parsed.status || '');
    }
    return;
  }
  if (parsed.type === 'PROFILE_RECEIVED') {
    if (typeof onProfileReceived === 'function') { onProfileReceived(parsed); }
    return;
  }
  if (parsed.type === 'ESCROW_INFO_RESPONSE') {
    _handleEscrowInfoResponse(parsed);
    return;
  }
  if (parsed.type === 'MA_TRACK_RESULT') {
    if (typeof onRewardValidation === 'function') { onRewardValidation(parsed); }
    return;
  }
}

// ---------------------------------------------------------------------------
// CAMPAIGN_AUTOSETTLE_REQUEST — FE handler (Issue 1)
// ---------------------------------------------------------------------------
// Called on the creator's node when the SW emits CAMPAIGN_AUTOSETTLE_REQUEST
// after a creator finishes a campaign. The SW has already marked channels
// 'settling' in DB. On the creator's node the channel coins were opened with
// viewer keys — the viewer must co-sign to settle (MULTISIG). Creator cannot
// post these txs; checkOpenChannelsSettled() will confirm them once the viewer
// posts their side.
//
// On the VIEWER's node, auto-settle is triggered separately by _autoSettleOpenChannels()
// called from the CAMPAIGN_UPDATED handler when status='finished'.
function _handleAutoSettleRequest(parsed) {
  var campaignId = parsed && parsed.campaign_id;
  var channels   = (parsed && Array.isArray(parsed.channels)) ? parsed.channels : [];
  if (!campaignId) { return; }
  console.log('[AUTOSETTLE] CAMPAIGN_AUTOSETTLE_REQUEST received campaign:', campaignId,
    'channels:', channels.length, '(creator node: L1 txs require viewer co-sign, skipping post)');
  // UI progress is already driven by CAMPAIGN_SETTLING / CAMPAIGN_CLOSED signals
  // emitted by the SW. No L1 tx posting needed here on the creator's node.
}

// Auto-settle open channels for a campaign on the VIEWER's node.
// Called when CAMPAIGN_UPDATED arrives with status='finished'.
// Queries local CHANNEL_STATE for open channels with a tx_hex (creator-signed
// voucher), then calls _runSettlement() (earnings.js) which:
//   1. Checks the local channel status — passes through if still 'open'
//   2. Signs with the viewer's VIEWER_WALLET_PK_<campaignId> keypair
//   3. Posts the settlement tx to L1
// checkOpenChannelsSettled() on NEWBLOCK then detects the spent coin and
// calls settleChannel() to finalize the DB record.
function _autoSettleOpenChannels(campaignId) {
  if (!campaignId) { return; }
  if (typeof sqlQuery !== 'function' || typeof _runSettlement !== 'function') { return; }
  // Fix #12: this path is for VIEWER nodes only. On the creator's own node,
  // settlement (if any) is driven by the SW's autoSettleChannelsForCampaign /
  // CAMPAIGN_AUTOSETTLE_REQUEST flow instead — running this here too would just
  // be noise (creator-opened channels need viewer co-sign, see _handleAutoSettleRequest).
  // CAMPAIGNS.CREATOR_ADDRESS is set to the creator's own MY_ADDRESS at creation
  // (dapp/views/creator.js) and is the same Maxima-pk identity space compared
  // everywhere else, so a direct match is unambiguous here.
  sqlQuery(
    "SELECT CREATOR_ADDRESS FROM CAMPAIGNS" +
    " WHERE UPPER(ID) = UPPER('" + escapeSql(campaignId) + "')",
    function(errC, campaignRows) {
      if (errC) { return; }
      var creatorAddress = (campaignRows && campaignRows[0] && campaignRows[0].CREATOR_ADDRESS) || '';
      if (MY_ADDRESS && creatorAddress && MY_ADDRESS.toUpperCase() === creatorAddress.toUpperCase()) {
        return;
      }
      sqlQuery(
        "SELECT VIEWER_KEY, ROLE, LATEST_TX_HEX, CUMULATIVE_EARNED" +
        " FROM CHANNEL_STATE" +
        " WHERE UPPER(CAMPAIGN_ID) = UPPER('" + escapeSql(campaignId) + "')" +
        " AND STATUS = 'open'" +
        " AND LATEST_TX_HEX != ''",
        function(err, rows) {
          if (err || !rows || rows.length === 0) { return; }
          console.log('[AUTOSETTLE] viewer auto-settle:', rows.length, 'channel(s) for campaign:', campaignId);
          for (var i = 0; i < rows.length; i++) {
            (function(row) {
              var viewerKey  = row.VIEWER_KEY  || '';
              var role       = row.ROLE        || 'viewer';
              var txHex      = row.LATEST_TX_HEX || '';
              var cumulative = parseFloat(row.CUMULATIVE_EARNED || 0);
              // Fix #12: publisher channels settle through their own reward-voucher
              // flow (frames.js), not this viewer-campaign-finish path.
              if (role === 'publisher') { return; }
              if (!viewerKey || !txHex) { return; }
              // _runSettlement: checks channel status (passes if 'open'), gets
              // VIEWER_WALLET_PK_<campaignId> from local keypairs, then imports,
              // signs, and posts the settlement tx.
              _runSettlement(campaignId, viewerKey, role, txHex, null, cumulative);
            })(rows[i]);
          }
        }
      );
    }
  );
}

// ---------------------------------------------------------------------------
// Channel helpers (T-CH4)
// ---------------------------------------------------------------------------

// Send a unicast Maxima message. Prefers publickey: routing (same as SW sendMaxima)
// which is more reliable than to: (contact string may lack @host:port).
// Falls back to to:mxAddress when no publicKey provided.
// poll:false — poll:true blocks the event loop ~77s when peer is offline (KNOWN_ISSUES #17).
function sendChannelMaxima(mxAddress, payload, cb) {
  var hex = '0x' + utf8ToHex(JSON.stringify(payload)).toUpperCase();
  var cmd = 'maxima action:send to:' + mxAddress
          + ' application:' + APP_NAME
          + ' data:' + hex
          + ' poll:false';
  MDS.cmd(cmd, function(res) {
    if (!res || !res.status) {
      console.error('[CHANNEL] sendChannelMaxima failed to=' + mxAddress.substring(0, 20) + ':', res && res.error);
    }
    if (cb) { cb(res && res.status); }
  });
}

// Handle ESCROW_INFO_RESPONSE from creator: update CAMPAIGNS table with latest
// budget and escrow data, then refresh campaigns view if open.
function _handleEscrowInfoResponse(parsed) {
  var campaignId = parsed.campaign_id || '';
  var status = parsed.status || '';
  var data = parsed.data || {};

  if (!campaignId || status !== 'ok') { return; }

  var budgetTotal = parseFloat(data.budget_total) || 0;
  var budgetRemaining = parseFloat(data.budget_remaining) || 0;
  var maxPubBudget = parseFloat(data.max_publisher_budget) || 0;
  var pubBudgetSpent = parseFloat(data.publisher_budget_spent) || 0;
  var viewerBudgetSpent = parseFloat(data.viewer_budget_spent) || 0;
  var publisherBudgetEarned = parseFloat(data.publisher_budget_earned) || 0;
  var campaignStatus = (data.campaign_status || 'unknown').toUpperCase();

  var sql = "UPDATE CAMPAIGNS SET "
    + "BUDGET_TOTAL = " + budgetTotal + ", "
    + "BUDGET_REMAINING = " + budgetRemaining + ", "
    + "MAX_PUBLISHER_BUDGET = " + maxPubBudget + ", "
    + "PUBLISHER_BUDGET_SPENT = " + pubBudgetSpent + ", "
    + "VIEWER_BUDGET_SPENT = " + viewerBudgetSpent + ", "
    + "PUBLISHER_BUDGET_EARNED = " + publisherBudgetEarned + ", "
    + "STATUS = '" + escapeSql(campaignStatus) + "' "
    + "WHERE UPPER(ID) = UPPER('" + escapeSql(campaignId) + "')";

  sqlQuery(sql, function(err) {
    if (err) {
      console.error('[ESCROW] Failed to update CAMPAIGNS for ' + campaignId + ':', err);
    }
  });
}

// Address-from-pubkey via newscript "RETURN SIGNEDBY(<pk>)". Deterministic
// across nodes — the address is a hash of the script. Cached in keypair so
// we only pay the newscript cost once per pubkey.
// trackall:true on creator side (we want to receive funds back to the change
// address). trackall:false on viewer-address derivation (creator just needs
// the address string to direct the voucher's first output).
function deriveScriptAddress(pubkey, trackall, cacheKey, cb) {
  MDS.keypair.get(cacheKey, function(kpRes) {
    var cached = kpRes && kpRes.status ? kpRes.value : '';
    if (cached) { cb(cached); return; }
    var script = 'RETURN SIGNEDBY(' + pubkey + ')';
    var cmd = 'newscript script:"' + script + '" trackall:' + (trackall ? 'true' : 'false');
    MDS.cmd(cmd, function(res) {
      if (!res || !res.status || !res.response || !res.response.address) {
        console.error('[CHANNEL] newscript failed for pk', pubkey, res && res.error);
        cb('');
        return;
      }
      var addr = res.response.address;
      MDS.keypair.set(cacheKey, addr, function() {});
      cb(addr);
    });
  });
}

// Persist channel-pending context across reloads. Indexed by pendinguid so the
// MDS_PENDING event can recover ctx after user approval (or browser reload).
function savePendingChannelOp(uid, ctx) {
  _pendingChannelOps[uid] = ctx;
  MDS.keypair.set('PENDING_CHANNEL_' + uid, JSON.stringify(ctx), function() {});
}

function loadPendingChannelOp(uid, cb) {
  if (_pendingChannelOps[uid]) { cb(_pendingChannelOps[uid]); return; }
  MDS.keypair.get('PENDING_CHANNEL_' + uid, function(kpRes) {
    var raw = kpRes && kpRes.status ? kpRes.value : '';
    if (!raw) { cb(null); return; }
    var ctx = null;
    try { ctx = JSON.parse(raw); } catch (e) { cb(null); return; }
    _pendingChannelOps[uid] = ctx;
    cb(ctx);
  });
}

function clearPendingChannelOp(uid) {
  delete _pendingChannelOps[uid];
  MDS.keypair.set('PENDING_CHANNEL_' + uid, '', function() {});
}

function runSequential(cmds, idx, cb) {
  if (idx >= cmds.length) { cb(true); return; }
  MDS.cmd(cmds[idx], function(res) {
    if (!res.status) { console.error('[CHANNEL] cmd failed:', cmds[idx], res.error); cb(false); return; }
    runSequential(cmds, idx + 1, cb);
  });
}

// ---------------------------------------------------------------------------
// T-SC6 — buildAndPostStatusUpdateTx
// ---------------------------------------------------------------------------
//
// Creator-side: spends the current V3 escrow coin and produces a same-amount
// change coin at ESCROW_ADDRESS_V3 carrying STATE(7) = <new_status_hex>.
// Ports 1,3,4,5,6 are carried forward from the prior coin; port 10=0 (full
// change-back); port 11=0 (no fee on status update). See MinimaAds.md §6.10
// and Appendix B.5.
//
// Fire-and-forget: never blocks the UI. The caller's onResult fires
// asynchronously with { ok, skipped?, error?, new_coinid? } once the tx
// reaches a final state for THIS function. MDS_PENDING resume is handled by
// handleFePending which fires CAMPAIGN_UPDATED on its own completion path.
function buildAndPostStatusUpdateTx(campaignId, newStatus, onResult) {
  function done(res) {
    if (typeof onResult === 'function') { onResult(res); }
  }

  if (typeof encodeStatusForTx !== 'function' || typeof buildStatusUpdateStatePorts !== 'function') {
    done({ ok: false, error: 'status-update helpers not loaded' });
    return;
  }

  var newStatusHex = encodeStatusForTx(newStatus);
  if (!newStatusHex) {
    done({ ok: false, error: 'invalid status: ' + newStatus });
    return;
  }

  if (typeof getCampaign !== 'function') {
    done({ ok: false, error: 'getCampaign not loaded' });
    return;
  }

  getCampaign(campaignId, function(err, campaign) {
    if (err || !campaign) {
      done({ ok: false, error: 'campaign not found: ' + campaignId });
      return;
    }
    var escrowCoinId = campaign.ESCROW_COINID;
    var walletPK     = campaign.ESCROW_WALLET_PK;
    if (!escrowCoinId || !walletPK) {
      console.log('[STATUS-TX] skip: campaign missing escrow data (legacy campaign). campaign:', campaignId);
      done({ ok: true, skipped: true });
      return;
    }

    MDS.keypair.get('ESCROW_ADDRESS_V3', function(esResV3) {
      var escrowAddrV3 = esResV3 && esResV3.status ? (esResV3.value || '') : '';
      MDS.keypair.get('ESCROW_ADDRESS_V4', function(esResV4) {
        var escrowAddrV4 = esResV4 && esResV4.status ? (esResV4.value || '') : '';
        if (!escrowAddrV3 && !escrowAddrV4) {
          done({ ok: false, error: 'no escrow address found (V3 or V4)' });
          return;
        }

        MDS.cmd('coins coinid:' + escrowCoinId, function(cRes) {
          if (!cRes || !cRes.status || !cRes.response || cRes.response.length === 0) {
            done({ ok: false, error: 'escrow coin not found on-chain: ' + escrowCoinId });
            return;
          }
          var coin       = cRes.response[0];
          var coinAddr   = coin.address || '';
          var coinAmount = parseFloat(coin.amount || 0);
          var coinStateArr = coin.state || [];

          var addrMatch = false;
          if (escrowAddrV3 && coinAddr.toUpperCase() === escrowAddrV3.toUpperCase()) {
            addrMatch = true;
          } else if (escrowAddrV4 && coinAddr.toUpperCase() === escrowAddrV4.toUpperCase()) {
            addrMatch = true;
          }

          if (!addrMatch || !coinAddr) {
            console.warn('[STATUS-TX] skip: campaign escrow coin is not at ESCROW_ADDRESS_V3/V4 (legacy coin). campaign:', campaignId,
              'coinAddr:', coinAddr, 'V3:', escrowAddrV3, 'V4:', escrowAddrV4);
            done({ ok: true, skipped: true });
            return;
          }
          if (!(coinAmount > 0)) {
          done({ ok: false, error: 'escrow coin amount is zero or invalid' });
          return;
        }

        function ps(port) {
          for (var i = 0; i < coinStateArr.length; i++) {
            if (coinStateArr[i].port == port) { return coinStateArr[i].data || ''; }
          }
          return '';
        }

        // Carry forward ports 1, 3, 4, 5, 6 from the current escrow coin's state.
        // Fallback to the campaign DB row / current FE identity when a port is
        // missing (defensive — V3 coins set them at funding time).
        var creatorMxHex = '0x' + utf8ToHex(MY_MX_ADDRESS).toUpperCase();
        var campaignIdHex = '0x' + utf8ToHex(campaign.ID || campaignId).toUpperCase();
        var currentEscrow = {
          walletPk:       ps(1) || walletPK,
          campaignIdHex:  ps(3) || campaignIdHex,
          creatorMxHex:   ps(4) || creatorMxHex,
          platformKeyHex: ps(5) || '0x00',
          maxPubBudget:   ps(6) || '0',
          feeflag:        '0'
        };

        var ports = buildStatusUpdateStatePorts(currentEscrow, newStatusHex, coinAmount);
        var txId  = 'st_' + generateUID();
        var escrowAddrToUse = coinAddr.toUpperCase() === (escrowAddrV4 || '').toUpperCase() ? escrowAddrV4 : escrowAddrV3;

        function buildCtx(extra) {
          var base = {
            txId:          txId,
            campaignId:    campaignId,
            newStatus:     newStatus,
            walletPK:      walletPK,
            escrowAddrV3:  escrowAddrV3,
            escrowAddrV4:  escrowAddrV4,
            escrowAddrToUse: escrowAddrToUse,
            escrowCoinId:  escrowCoinId,
            coinAmount:    coinAmount
          };
          if (extra) {
            for (var k in extra) {
              if (extra.hasOwnProperty(k)) { base[k] = extra[k]; }
            }
          }
          return base;
        }

        function fail(stage, res) {
          console.error('[STATUS-TX] failed at', stage, res && (res.error || res));
          MDS.cmd('txndelete id:' + txId, function() {});
          done({ ok: false, error: 'tx failed at ' + stage });
        }

        MDS.cmd('txncreate id:' + txId, function(r1) {
          if (!r1.status) { fail('txncreate', r1); return; }

          MDS.cmd('txninput id:' + txId + ' coinid:' + escrowCoinId + ' scriptmmr:true', function(r2) {
            if (!r2.status) { fail('txninput', r2); return; }

            MDS.cmd('txnoutput id:' + txId
                  + ' storestate:true'
                  + ' amount:' + coinAmount
                  + ' address:' + escrowAddrToUse, function(r3) {
              if (!r3.status) { fail('txnoutput', r3); return; }

              var stateCmds = [];
              for (var pi = 0; pi < ports.length; pi++) {
                stateCmds.push('txnstate id:' + txId + ' port:' + ports[pi].port + ' value:' + ports[pi].value);
              }

              runSequential(stateCmds, 0, function(stateOk) {
                if (!stateOk) { fail('txnstate', null); return; }

                MDS.cmd('txnsign id:' + txId + ' publickey:' + walletPK, function(r5) {
                  if (r5 && r5.pending) {
                    var signCtx = buildCtx({ kind: 'status_update_sign' });
                    savePendingChannelOp(r5.pendinguid, signCtx);
                    console.log('[STATUS-TX] txnsign pending, uid:', r5.pendinguid);
                    signalFE('STATUS_TX_PENDING', {
                      campaign_id: campaignId,
                      status:      newStatus,
                      pending_uid: r5.pendinguid
                    });
                    done({ ok: true, pending: true, pending_uid: r5.pendinguid });
                    return;
                  }
                  if (!r5.status) { fail('txnsign', r5); return; }

                  MDS.cmd('txnpost id:' + txId + ' mine:true auto:false', function(r6) {
                    if (r6 && r6.pending) {
                      var postCtx = buildCtx({ kind: 'status_update_post' });
                      savePendingChannelOp(r6.pendinguid, postCtx);
                      console.log('[STATUS-TX] txnpost pending, uid:', r6.pendinguid);
                      signalFE('STATUS_TX_PENDING', {
                        campaign_id: campaignId,
                        status:      newStatus,
                        pending_uid: r6.pendinguid
                      });
                      done({ ok: true, pending: true, pending_uid: r6.pendinguid });
                      return;
                    }
                    if (!r6.status) { fail('txnpost', r6); return; }

                    MDS.cmd('txndelete id:' + txId, function() {});
                    finalizeStatusUpdate(r6.response, buildCtx(null), done);
                  });
                });
              });
            });
          });
        });
        });
      });
    });
  });
}

function signalFE(type, data) {
  // FE-side proxy of core/minima.js signalFE — emits MDSCOMMS to all this
  // dapp's open contexts (including the SW). Self-route arrives via the same
  // MDSCOMMS event handler in bootstrap().
  var obj = { type: type };
  if (data) {
    for (var k in data) {
      if (data.hasOwnProperty(k)) { obj[k] = data[k]; }
    }
  }
  MDS.comms.solo(JSON.stringify(obj));
}

// Extracts the new V3 change coinid from the txpow response, updates the
// CAMPAIGNS row, and signals CAMPAIGN_UPDATED. Shared by the synchronous
// success path and the MDS_PENDING resume path.
function finalizeStatusUpdate(txpowResponse, ctx, done) {
  var outputs = null;
  try { outputs = txpowResponse.body.txn.outputs; } catch (e) {}
  if (!outputs || !outputs.length) {
    console.error('[STATUS-TX] no outputs in tx response');
    if (typeof done === 'function') { done({ ok: false, error: 'no outputs in tx response' }); }
    return;
  }
  var newCoinId = '';
  var escrowAddrToFind = ctx.escrowAddrToUse || ctx.escrowAddrV3;
  for (var i = 0; i < outputs.length; i++) {
    if (outputs[i].address && outputs[i].address.toUpperCase() === escrowAddrToFind.toUpperCase()) {
      newCoinId = outputs[i].coinid;
      break;
    }
  }
  if (!newCoinId) {
    console.error('[STATUS-TX] could not locate change output at escrow address (V3/V4)', escrowAddrToFind);
    if (typeof done === 'function') { done({ ok: false, error: 'change output not found' }); }
    return;
  }

  var sql = "UPDATE CAMPAIGNS SET ESCROW_COINID = '" + escapeSql(newCoinId) + "' "
          + "WHERE UPPER(ID) = UPPER('" + escapeSql(ctx.campaignId) + "')";
  sqlQuery(sql, function(err) {
    if (err) { console.error('[STATUS-TX] CAMPAIGNS escrow update failed:', err); }
    signalFE('CAMPAIGN_UPDATED', { campaign_id: ctx.campaignId, status: ctx.newStatus });
    console.log('[STATUS-TX] confirmed. campaign:', ctx.campaignId, 'status:', ctx.newStatus, 'new coinId:', newCoinId);
    if (typeof done === 'function') { done({ ok: true, new_coinid: newCoinId }); }
  });
}

// Expose to mycampaigns.js explicitly (already global by virtue of being a
// script-level function, but pinned to window for clarity and future bundling).
window.buildAndPostStatusUpdateTx = buildAndPostStatusUpdateTx;

// ---------------------------------------------------------------------------
// MDS_PENDING (FE) — resume channel-open after user approval
// ---------------------------------------------------------------------------
function handleFePending(msg) {
  if (!msg || !msg.data || !msg.data.uid) { return; }
  var uid      = msg.data.uid;
  var accepted = msg.data.accept;
  var status   = msg.data.status;

  loadPendingChannelOp(uid, function(ctx) {
    if (!ctx) {
      // Not one of ours — likely a campaign-creation pending handled by SW.
      return;
    }
    if (!accepted || !status) {
      console.log('[CHANNEL] pending denied/failed, uid:', uid, 'kind:', ctx.kind);
      if (ctx.kind === 'settlement') {
        MDS.cmd('txndelete id:' + ctx.settleId, function() {});
      } else if (ctx.txId) {
        MDS.cmd('txndelete id:' + ctx.txId, function() {});
      }
      clearPendingChannelOp(uid);
      return;
    }
    if (ctx.kind === 'settlement') {
      console.log('[CHANNEL] settlement txnsign approved, posting campaign:', ctx.campaignId, 'role:', ctx.role);
      if (typeof _postSettleTx === 'function') {
        _postSettleTx(ctx.settleId, ctx.campaignId, ctx.viewerKey, ctx.role || 'viewer');
      }
      clearPendingChannelOp(uid);
      return;
    }
    if (ctx.kind === 'settlement_post') {
      console.log('[CHANNEL] settlement_post approved. campaign:', ctx.campaignId, 'role:', ctx.role);
      if (typeof settleChannel === 'function') {
        settleChannel(ctx.campaignId, ctx.viewerKey, ctx.role || 'viewer', function(err) {
          if (err) { console.error('[CHANNEL] settleChannel error after settlement_post approval:', err); }
          if (typeof _refreshChannelRewards === 'function') { _refreshChannelRewards(); }
        });
      }
      clearPendingChannelOp(uid);
      return;
    }
    var resp = null;
    try { resp = msg.data.result.response; } catch (e) {}
    if (!resp) {
      console.error('[CHANNEL] pending: no result.response, uid:', uid);
      clearPendingChannelOp(uid);
      return;
    }
    if (ctx.kind === 'status_update_sign') {
      // Hub approved the signing step — proceed to txnpost.
      MDS.cmd('txnpost id:' + ctx.txId + ' mine:true auto:false', function(r6) {
        if (r6 && r6.pending) {
          var postCtx = {
            kind:         'status_update_post',
            txId:         ctx.txId,
            campaignId:   ctx.campaignId,
            newStatus:    ctx.newStatus,
            walletPK:     ctx.walletPK,
            escrowAddrV3: ctx.escrowAddrV3,
            escrowCoinId: ctx.escrowCoinId,
            coinAmount:   ctx.coinAmount
          };
          savePendingChannelOp(r6.pendinguid, postCtx);
          console.log('[STATUS-TX] txnpost pending after sign approval, uid:', r6.pendinguid);
          signalFE('STATUS_TX_PENDING', {
            campaign_id: ctx.campaignId,
            status:      ctx.newStatus,
            pending_uid: r6.pendinguid
          });
          clearPendingChannelOp(uid);
          return;
        }
        if (!r6.status) {
          console.error('[STATUS-TX] txnpost failed after sign approval:', r6 && r6.error);
          MDS.cmd('txndelete id:' + ctx.txId, function() {});
          clearPendingChannelOp(uid);
          return;
        }
        MDS.cmd('txndelete id:' + ctx.txId, function() {});
        finalizeStatusUpdate(r6.response, ctx, null);
        clearPendingChannelOp(uid);
      });
      return;
    }
    if (ctx.kind === 'status_update_post') {
      // Hub approved the post step — resp is the txpow response.
      finalizeStatusUpdate(resp, ctx, null);
      clearPendingChannelOp(uid);
      return;
    }
    // Legacy pending action from a stale pre-migration PENDING_CHANNEL_<uid>
    // (channel_split_sign/post, channel_open_postsign/open, voucher_sign) —
    // FE channel TX building was moved to the SW; log and drop instead of
    // silently falling through to clearPendingChannelOp with no explanation.
    console.warn('[PENDING] legacy pending action ignored: ' + ctx.kind);
    clearPendingChannelOp(uid);
  });
}

// ---------------------------------------------------------------------------
// Drawer — hamburger side menu
// ---------------------------------------------------------------------------

function openDrawer() {
  var overlay = document.getElementById('ma-drawer-overlay');
  var drawer = document.getElementById('ma-drawer');
  if (!overlay || !drawer) { return; }
  var avatarEl = document.getElementById('ma-drawer-avatar-circle');
  var mxEl = document.getElementById('ma-drawer-mx-text');
  var name = MY_MX_NAME || '';
  var addr = MY_MX_ADDRESS || '';
  var displayName = name || (addr ? addr.substring(0, 14) + '…' : '—');
  if (avatarEl) { avatarEl.textContent = displayName ? displayName.charAt(0).toUpperCase() : '?'; }
  if (mxEl) { mxEl.textContent = displayName; }
  var modeNames = ['viewer', 'creator', 'publisher'];
  for (var i = 0; i < modeNames.length; i++) {
    var btn = document.getElementById('ma-drawer-role-' + modeNames[i]);
    if (btn) { btn.setAttribute('aria-selected', modeNames[i] === _activeMode ? 'true' : 'false'); }
  }
  overlay.classList.add('open');
  drawer.classList.add('open');
  document.addEventListener('keydown', _onDrawerEsc);
}

function closeDrawer() {
  var overlay = document.getElementById('ma-drawer-overlay');
  var drawer = document.getElementById('ma-drawer');
  if (overlay) { overlay.classList.remove('open'); }
  if (drawer) { drawer.classList.remove('open'); }
  var submenu = document.getElementById('ma-drawer-role-submenu');
  var arrow = document.getElementById('ma-drawer-role-arrow');
  if (submenu) { submenu.hidden = true; }
  if (arrow) { arrow.classList.remove('open'); }
  document.removeEventListener('keydown', _onDrawerEsc);
}

function _onDrawerEsc(e) {
  if (e.key === 'Escape') { closeDrawer(); }
}

function toggleRoleSubmenu() {
  var submenu = document.getElementById('ma-drawer-role-submenu');
  var arrow = document.getElementById('ma-drawer-role-arrow');
  if (!submenu) { return; }
  submenu.hidden = !submenu.hidden;
  if (arrow) {
    if (submenu.hidden) { arrow.classList.remove('open'); } else { arrow.classList.add('open'); }
  }
}

function setModeFromDrawer(mode) {
  closeDrawer();
  setMode(mode);
}


function openSettingsView() {
  closeDrawer();
  window.location.hash = 'settings';
}

function openHelpView() {
  closeDrawer();
  window.location.hash = 'help';
}

function setThemeMode(mode) {
  document.documentElement.setAttribute('data-theme', mode);
  MDS.keypair.set('UI_THEME', mode, function() {});
  _updateSettingsUI();
}

function setAccent(name) {
  if (name === 'indigo') {
    document.documentElement.removeAttribute('data-accent');
  } else {
    document.documentElement.setAttribute('data-accent', name);
  }
  MDS.keypair.set('UI_ACCENT', name, function() {});
  _updateSettingsUI();
}

function _updateSettingsUI() {
  var theme  = document.documentElement.getAttribute('data-theme')  || 'light';
  var accent = document.documentElement.getAttribute('data-accent') || 'indigo';

  var lightBtn = document.getElementById('ma-settings-theme-light');
  var darkBtn  = document.getElementById('ma-settings-theme-dark');
  if (lightBtn) { lightBtn.className = 'ma-theme-mode-btn secondary' + (theme === 'light' ? ' active' : ''); }
  if (darkBtn)  { darkBtn.className  = 'ma-theme-mode-btn secondary' + (theme === 'dark'  ? ' active' : ''); }

  var accents = ['indigo', 'emerald', 'orange', 'slate'];
  for (var i = 0; i < accents.length; i++) {
    var sw = document.getElementById('ma-accent-' + accents[i]);
    if (!sw) { continue; }
    if (accents[i] === accent) { sw.classList.add('active'); }
    else                       { sw.classList.remove('active'); }
  }

  var numFmtEU = document.getElementById('ma-numfmt-eu');
  var numFmtEN = document.getElementById('ma-numfmt-en');
  if (numFmtEU) { numFmtEU.className = 'ma-theme-mode-btn secondary' + (window.NUMFMT === 'EU' ? ' active' : ''); }
  if (numFmtEN) { numFmtEN.className = 'ma-theme-mode-btn secondary' + (window.NUMFMT === 'EN' ? ' active' : ''); }
}


function probeDb() {
  sqlQuery('SELECT 1 AS PROBE FROM CAMPAIGNS LIMIT 1', function(err) {
    if (!err) {
      _dbReady = true;
      doRender();
    }
  });
}

function initFEFrames(cb) {
  var sql = "CREATE TABLE IF NOT EXISTS FRAMES ("
    + "FRAME_ID         VARCHAR(512)  PRIMARY KEY,"
    + "PUBLISHER_KEY    VARCHAR(512)  NOT NULL,"
    + "PUBLISHER_WALLET VARCHAR(512)  DEFAULT '',"
    + "PUBLISHER_MX     VARCHAR(512)  DEFAULT '',"
    + "LABEL            VARCHAR(256)  DEFAULT '',"
    + "IS_BUILTIN       BOOLEAN       NOT NULL DEFAULT FALSE,"
    + "CREATED_AT       BIGINT        NOT NULL,"
    + "TOTAL_EARNED     DECIMAL(20,6) NOT NULL DEFAULT 0"
    + ")";
  sqlQuery(sql, function() {
    sqlQuery("ALTER TABLE FRAMES ADD COLUMN IF NOT EXISTS PUBLISHER_MX VARCHAR(512) DEFAULT ''", function() {
      if (cb) { cb(); }
    });
  });
}

function initFEChannelState(cb) {
  var sql = "CREATE TABLE IF NOT EXISTS CHANNEL_STATE ("
    + "CAMPAIGN_ID        VARCHAR(256)  NOT NULL,"
    + "VIEWER_KEY         VARCHAR(512)  NOT NULL,"
    + "ROLE               VARCHAR(16)   NOT NULL DEFAULT 'viewer',"
    + "FRAME_ID           VARCHAR(512)  DEFAULT '',"
    + "CREATOR_MX         VARCHAR(1024) NOT NULL,"
    + "CHANNEL_COINID     VARCHAR(66)   DEFAULT '',"
    + "MAX_AMOUNT         DECIMAL(20,6) NOT NULL,"
    + "CUMULATIVE_EARNED  DECIMAL(20,6) NOT NULL DEFAULT 0,"
    + "LATEST_TX_HEX      TEXT          DEFAULT '',"
    + "STATUS             VARCHAR(16)   NOT NULL DEFAULT 'pending',"
    + "CREATED_AT         BIGINT        NOT NULL,"
    + "VIEWER_WALLET_ADDR VARCHAR(512)  DEFAULT '',"
    + "PRIMARY KEY (CAMPAIGN_ID, VIEWER_KEY, ROLE)"
    + ")";
  sqlQuery(sql, function() {
    sqlQuery("ALTER TABLE CHANNEL_STATE ADD COLUMN IF NOT EXISTS VIEWER_WALLET_PK VARCHAR(512) DEFAULT ''", function() {
    sqlQuery("ALTER TABLE CHANNEL_STATE ADD COLUMN IF NOT EXISTS LAST_VOUCHER_AT BIGINT DEFAULT 0", function() {
    sqlQuery("ALTER TABLE CHANNEL_STATE ADD COLUMN IF NOT EXISTS LAST_CLICK_VOUCHER_AT BIGINT DEFAULT 0", function() {
    sqlQuery("ALTER TABLE CHANNEL_STATE ADD COLUMN IF NOT EXISTS OPENER_MX_PK VARCHAR(512) DEFAULT ''", function() {
      if (cb) { cb(); }
    }); // end OPENER_MX_PK migration
    }); // end LAST_CLICK_VOUCHER_AT migration
    }); // end LAST_VOUCHER_AT migration
    }); // end VIEWER_WALLET_PK migration
  });
}

function initFEChannelHistory(cb) {
  var sql = "CREATE TABLE IF NOT EXISTS CHANNEL_HISTORY ("
    + "CAMPAIGN_ID        VARCHAR(256)  NOT NULL,"
    + "VIEWER_KEY         VARCHAR(512)  NOT NULL,"
    + "ROLE               VARCHAR(16)   NOT NULL DEFAULT 'viewer',"
    + "CREATOR_MX         VARCHAR(1024) NOT NULL DEFAULT '',"
    + "CHANNEL_COINID     VARCHAR(66)   DEFAULT '',"
    + "MAX_AMOUNT         DECIMAL(20,6) NOT NULL,"
    + "CUMULATIVE_EARNED  DECIMAL(20,6) NOT NULL DEFAULT 0,"
    + "STATUS             VARCHAR(16)   NOT NULL DEFAULT 'settled',"
    + "CREATED_AT         BIGINT        NOT NULL,"
    + "VIEWER_WALLET_ADDR VARCHAR(512)  DEFAULT '',"
    + "PRIMARY KEY (CAMPAIGN_ID, VIEWER_KEY, ROLE, CREATED_AT)"
    + ")";
  sqlQuery(sql, function() { if (cb) { cb(); } });
}

function _showWriteModeRequired() {
  var root = document.getElementById('app');
  if (!root) { return; }
  root.innerHTML = '';
  var box = document.createElement('div');
  box.style.cssText = 'max-width:480px;margin:4rem auto;padding:1.5rem;border:2px solid #c00;border-radius:6px;text-align:center;';
  var title = document.createElement('h2');
  title.textContent = 'Write mode required';
  var msg = document.createElement('p');
  msg.textContent = 'MinimaAds needs WRITE permissions to sign and post transactions.';
  var steps = document.createElement('ol');
  steps.style.cssText = 'text-align:left;margin:.75rem auto;max-width:320px;';
  ['Open the Minima Hub', 'Go to MiniDapps → MinimaAds', 'Tap WRITE', 'Reload this page'].forEach(function(s) {
    var li = document.createElement('li');
    li.textContent = s;
    steps.appendChild(li);
  });
  box.appendChild(title);
  box.appendChild(msg);
  box.appendChild(steps);
  root.appendChild(box);
}

function onInited() {
  MDS.cmd('checkmode', function(cm) {
    if (cm && cm.response && cm.response.writemode === false) {
      _showWriteModeRequired();
      return;
    }
    MDS.keypair.get('PLATFORM_KEY_OVERRIDE', function(kpRes) {
      if (kpRes && kpRes.status && kpRes.value) {
        var pkVal = kpRes.value;
        if (typeof isHexKey === 'function' && !isHexKey(pkVal)) {
          console.warn('[APP] Invalid/malformed PLATFORM_KEY_OVERRIDE detected (' + pkVal + '), clearing');
          MDS.keypair.set('PLATFORM_KEY_OVERRIDE', '', function() {});
        } else {
          PLATFORM_KEY = pkVal;
        }
      }
      MDS.keypair.get('FOUNDATION_KEY_OVERRIDE', function(fkRes) {
        if (fkRes && fkRes.status && fkRes.value) {
          var fkVal = fkRes.value;
          if (typeof isHexKey === 'function' && !isHexKey(fkVal)) {
            console.warn('[APP] Invalid/malformed FOUNDATION_KEY_OVERRIDE detected (' + fkVal + '), clearing');
            MDS.keypair.set('FOUNDATION_KEY_OVERRIDE', '', function() {});
          } else {
            FOUNDATION_KEY = fkVal;
          }
        }
      });
      MDS.keypair.get('MINIMAADS_CREATOR_ROUTE', function(crRes) {
        if (crRes && crRes.status && crRes.value) {
          var crParts = crRes.value.split('#');
          if (crParts.length === 3 && crParts[0] === 'MAX') {
            MINIMAADS_CREATOR_PK = crParts[1].toUpperCase();
          }
        }
      MDS.keypair.get('USER_MODE', function(modeRes) {
        if (modeRes && modeRes.status && modeRes.value && MODE_VIEWS[modeRes.value]) {
          _activeMode = modeRes.value;
        }
        MDS.keypair.get('UI_THEME', function(themeRes) {
          var savedTheme = themeRes && themeRes.status && themeRes.value ? themeRes.value : 'dark';
          document.documentElement.setAttribute('data-theme', savedTheme);
          MDS.keypair.get('UI_ACCENT', function(accentRes) {
          var savedAccent = accentRes && accentRes.status && accentRes.value ? accentRes.value : 'orange';
          if (savedAccent === 'indigo') { document.documentElement.removeAttribute('data-accent'); }
          else { document.documentElement.setAttribute('data-accent', savedAccent); }
          _updateSettingsUI();
          MDS.keypair.get('UI_NUMBER_FORMAT', function(numFmtRes) {
            if (numFmtRes && numFmtRes.status && numFmtRes.value) {
              window.NUMFMT = numFmtRes.value;
            }
          MDS.cmd('maxima action:info', function(res) {
          if (res && res.status && res.response) {
            if (res.response.publickey) { MY_ADDRESS    = res.response.publickey.toUpperCase(); }
            if (res.response.contact)   { MY_MX_ADDRESS = res.response.contact; }
            if (res.response.name)      { MY_MX_NAME    = res.response.name; }
            if (res.response.icon && res.response.icon !== '0x00') { MY_MX_ICON = res.response.icon; }
          }
          // Migration of legacy CREATOR_PERMANENT_ROUTE to USER_PERMANENT_ROUTE
          MDS.keypair.get('CREATOR_PERMANENT_ROUTE', function(oldRes) {
            var oldRoute = (oldRes && oldRes.status && oldRes.value) ? oldRes.value : '';
            if (oldRoute) {
              MDS.keypair.set('USER_PERMANENT_ROUTE', oldRoute, function() {
                MDS.keypair.set('CREATOR_PERMANENT_ROUTE', '', function() {
                  proceedBootFE();
                });
              });
            } else {
              proceedBootFE();
            }
          });

          function proceedBootFE() {
            if (MY_ADDRESS && MY_ADDRESS === MINIMAADS_CREATOR_PK.toUpperCase()) {
              MDS.keypair.get('USER_PERMANENT_ROUTE', function(permRes) {
                var permRoute = (permRes && permRes.status && permRes.value) ? permRes.value : '';
                if (permRoute) {
                  MDS.keypair.get('MINIMAADS_CREATOR_ROUTE', function(curCrRes) {
                    var curCrRoute = (curCrRes && curCrRes.status && curCrRes.value) ? curCrRes.value : '';
                    if (curCrRoute !== permRoute) {
                      MDS.keypair.set('MINIMAADS_CREATOR_ROUTE', permRoute, function() {
                        if (currentRoute() === 'settings/maxima-routes') {
                          doRender();
                        }
                      });
                    }
                  });
                }
              });
            }
            initFEFrames(function() {
              initFEChannelState(function() {
                initFEChannelHistory(function() {
                  renderNav();
                  probeDb();
                  doRender();
                  startNetworkStatusMonitoring();
                });
              });
            });
          }
        });
        });   // closes maxima action:info
          }); // closes UI_NUMBER_FORMAT
        });   // closes UI_ACCENT
      });
      });
    });
  });
}

(function bootstrap() {
  if (typeof MDS === 'undefined' || typeof MDS.init !== 'function') {
    return;
  }
  MDS.init(function(msg) {
    if (!msg || !msg.event) { return; }
    if (msg.event === 'inited') {
      onInited();
      // Fetch initial block height for the footer
      MDS.cmd('status', function(res) {
        if (res && res.status && res.response && res.response.chain) {
          var blockEl = document.getElementById('ma-footer-block-height');
          if (blockEl) { blockEl.textContent = '#' + res.response.chain.block; }
        }
      });
      return;
    }
    if (msg.event === 'NEWBLOCK') {
      onNewblock();
      if (msg.data && msg.data.txpow && msg.data.txpow.header) {
        var blockEl = document.getElementById('ma-footer-block-height');
        if (blockEl) { blockEl.textContent = '#' + msg.data.txpow.header.block; }
      }
      return;
    }
    if (msg.event === 'MDSCOMMS') {
      // Only accept private (solo) signals from our own SW. Public broadcasts
      // from other MiniDapps could collide on signal names (AGENTS.md §5.1).
      if (!msg.data || msg.data.public) { return; }
      var raw = msg.data.message ? msg.data.message : msg.data;
      var parsed = null;
      try { parsed = JSON.parse(raw); } catch (e) { return; }
      handleMdsComms(parsed);
      return;
    }
    if (msg.event === 'MDS_PENDING') {
      handleFePending(msg);
      return;
    }
    // MAXIMA events for CAMPAIGN_ANNOUNCE / PAUSE / FINISH are persisted by the
    // SW — the FE must ignore them to avoid duplicate DB writes (AGENTS.md §12 #16).
  });
  window.addEventListener('hashchange', doRender);
})();
