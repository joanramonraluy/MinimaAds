// T10 — FE entry point.
// MDS.init bootstrap, MDSCOMMS dispatch, hash routing (#viewer | #creator | #stats).
// Waits for DB_READY (from SW signalFE) before rendering any DB-backed view.
// Silently ignores MAXIMA events already persisted by the SW (AGENTS.md §12 #16).
// APP_NAME and LIMITS mirror the SW globals (main.js) so core/minima.js and
// core/selection.js resolve them in FE scope (AGENTS.md §12 #23).

var APP_NAME = 'minima-ads';

var LIMITS = {
  MAX_VIEWS_PER_CAMPAIGN_PER_DAY:  1,
  MAX_CLICKS_PER_CAMPAIGN_PER_DAY: 1,
  COOLDOWN_BETWEEN_REWARDS_MS:     30000,
  MIN_VIEW_DURATION_MS:            3000,
  MAX_CAMPAIGNS_PER_SESSION:       10
};

var MY_ADDRESS = '';
var _dbReady = false;

function generateUID() {
  return Date.now().toString(16) + '-' + Math.floor(Math.random() * 0xFFFFFFFF).toString(16);
}

function currentRoute() {
  var h = (window.location.hash || '').replace(/^#/, '');
  if (h === 'creator' || h === 'stats' || h === 'viewer') { return h; }
  return 'viewer';
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

function doRender() {
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
  root.innerHTML = '';
  var route = currentRoute();
  if (route === 'creator' && typeof renderCreator === 'function') {
    renderCreator(root);
  } else if (route === 'stats' && typeof renderStats === 'function') {
    renderStats(root);
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
    if (currentRoute() === 'stats' && typeof renderStats === 'function') {
      renderStats(document.getElementById('app'));
    }
    if (currentRoute() === 'viewer' && typeof onCampaignsChanged === 'function') {
      onCampaignsChanged();
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
    return;
  }
}

function probeDb() {
  sqlQuery('SELECT 1 AS PROBE FROM CAMPAIGNS LIMIT 1', function(err) {
    if (!err) {
      _dbReady = true;
      doRender();
    }
  });
}

function initFEChannelState(cb) {
  var sql = "CREATE TABLE IF NOT EXISTS CHANNEL_STATE ("
    + "CAMPAIGN_ID       VARCHAR(256)  NOT NULL,"
    + "VIEWER_KEY        VARCHAR(66)   NOT NULL,"
    + "CREATOR_MX        VARCHAR(512)  NOT NULL,"
    + "CHANNEL_COINID    VARCHAR(66)   DEFAULT '',"
    + "MAX_AMOUNT        DECIMAL(20,6) NOT NULL,"
    + "CUMULATIVE_EARNED DECIMAL(20,6) NOT NULL DEFAULT 0,"
    + "LATEST_TX_HEX     TEXT          DEFAULT '',"
    + "STATUS            VARCHAR(16)   NOT NULL DEFAULT 'pending',"
    + "CREATED_AT        BIGINT        NOT NULL,"
    + "PRIMARY KEY (CAMPAIGN_ID, VIEWER_KEY)"
    + ")";
  sqlQuery(sql, function() { if (cb) { cb(); } });
}

function onInited() {
  MDS.cmd('maxima action:info', function(res) {
    if (res && res.status && res.response && res.response.publickey) {
      MY_ADDRESS = res.response.publickey.toUpperCase();
    }
    initFEChannelState(function() {
      probeDb();
      doRender();
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
    // MAXIMA events for CAMPAIGN_ANNOUNCE / PAUSE / FINISH are persisted by the
    // SW — the FE must ignore them to avoid duplicate DB writes (AGENTS.md §12 #16).
  });
  window.addEventListener('hashchange', doRender);
})();
