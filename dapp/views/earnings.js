// Earnings view — personal rewards dashboard.
// Shows: total earned (USER_PROFILE), reward event history (REWARD_EVENTS),
// and pending channel settlements (CHANNEL_STATE) with settle buttons.
// Channel settlement functions (_runSettlement, _postSettleTx) and signal
// handlers (onChannelOpened, onVoucherReceived, onAutoSettle, onSettleConfirmed)
// live here as globals so app.js can call them regardless of active route.

function renderEarnings(root) {
  root.innerHTML = '';

  var h2 = document.createElement('h2');
  h2.textContent = 'Earnings';
  h2.style.cssText = 'margin:0 0 1.5rem 0;padding:1rem;background:rgba(0,0,0,0.02);border-left:4px solid #27ae60;border-radius:0.375rem;';
  root.appendChild(h2);

  // 3 stat cards in a row
  var summaryRow = document.createElement('div');
  summaryRow.id = 'ma-earnings-summary';
  summaryRow.className = 'ma-stat-grid cols-3';
  summaryRow.style.cssText = 'margin-bottom:1.5rem;padding:.75rem 1rem;border:1px solid var(--pico-border-color);border-radius:var(--pico-border-radius);background-color:rgba(0,0,0,0.015);border-left:3px solid #27ae60;';

  var totalCard = mkStatCard('Total earned', '—');
  totalCard.id = 'ma-stat-total';
  var todayCard = mkStatCard('Today', '—');
  todayCard.id = 'ma-stat-today';
  var channelsCard = mkStatCard('Open channels', '—');
  channelsCard.id = 'ma-stat-channels';

  summaryRow.appendChild(totalCard);
  summaryRow.appendChild(todayCard);
  summaryRow.appendChild(channelsCard);
  root.appendChild(summaryRow);

  // Settlement feedback (referenced by _runSettlement and signal handlers)
  var settleStatus = document.createElement('p');
  settleStatus.id = 'ma-channel-settle-status';
  settleStatus.setAttribute('role', 'status');
  settleStatus.style.cssText = 'min-height:1.4rem;font-size:.875rem;';
  root.appendChild(settleStatus);

  // Pending settlements
  var pendingSection = document.createElement('section');
  pendingSection.style.cssText = 'margin-bottom:1.5rem;padding:.75rem 1rem;border:1px solid var(--pico-border-color);border-radius:var(--pico-border-radius);background-color:rgba(0,0,0,0.015);border-left:3px solid #f39c12;';
  var pendingH3 = document.createElement('h3');
  pendingH3.id = 'ma-pending-settlements-title';
  pendingH3.style.cssText = 'margin-top:0;font-size:.9rem;text-transform:uppercase;color:var(--pico-muted-color,#6c757d);letter-spacing:.04em;margin-bottom:.75rem;';
  pendingH3.textContent = 'Pending settlements';
  pendingSection.appendChild(pendingH3);
  var settlementHint = document.createElement('p');
  settlementHint.style.cssText = 'margin:0 0 .75rem;color:var(--pico-muted-color,#6c757d);font-size:.75rem;';
  settlementHint.textContent = 'Tip: settlement posts to L1. To avoid doing that too often, it is usually better to settle when the campaign ends or when the channel has reached its reward cap, unless you need the funds sooner.';
  pendingSection.appendChild(settlementHint);
  var channelList = document.createElement('div');
  channelList.id = 'ma-channel-rewards-list';
  pendingSection.appendChild(channelList);
  root.appendChild(pendingSection);

  // Settlement history
  var historySection = document.createElement('section');
  historySection.id = 'ma-settlement-history';
  historySection.style.cssText = 'padding:.75rem 1rem;border:1px solid var(--pico-border-color);border-radius:var(--pico-border-radius);background-color:rgba(0,0,0,0.015);border-left:3px solid #27ae60;overflow-x:auto;';
  root.appendChild(historySection);

  loadEarnings();
}

function _updateStatCard(id, value) {
  var card = document.getElementById(id);
  if (!card) { return; }
  var s = card.querySelector('strong');
  if (s) { s.textContent = value; }
}

function _loadTodayEarnedSummary() {
  if (!MY_ADDRESS) { return; }
  var role = (typeof _activeMode !== 'undefined') ? _activeMode : 'viewer';
  var types = (role === 'publisher') ? "'publisher_view'" : "'view','click'";
  var now = new Date();
  var startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  var sql = "SELECT SUM(AMOUNT) AS TOTAL FROM REWARD_EVENTS"
    + " WHERE UPPER(USER_ADDRESS) = UPPER('" + escapeSql(MY_ADDRESS) + "')"
    + " AND TYPE IN (" + types + ")"
    + " AND TIMESTAMP >= " + startOfDay;
  sqlQuery(sql, function(err, rows) {
    var total = (!err && rows && rows[0]) ? (parseFloat(rows[0].TOTAL) || 0) : 0;
    _updateStatCard('ma-stat-today', fmtAmt(total, 6) + ' MINIMA');
  });
}

function loadEarnings() {
  if (!MY_ADDRESS) { return; }

  var role = (typeof _activeMode !== 'undefined') ? _activeMode : 'viewer';
  var types = (role === 'publisher') ? "'publisher_view'" : "'view','click'";

  // Total earned
  var totalSql = "SELECT SUM(AMOUNT) AS TOTAL FROM REWARD_EVENTS"
    + " WHERE UPPER(USER_ADDRESS) = UPPER('" + escapeSql(MY_ADDRESS) + "')"
    + " AND TYPE IN (" + types + ")";
  sqlQuery(totalSql, function(err, rows) {
    var total = (!err && rows && rows[0]) ? (parseFloat(rows[0].TOTAL) || 0) : 0;
    _updateStatCard('ma-stat-total', fmtAmt(total, 6) + ' MINIMA');

    // Show hint below cards when nothing earned yet
    var summaryEl = document.getElementById('ma-earnings-summary');
    if (summaryEl) {
      var prev = summaryEl.nextElementSibling;
      if (prev && prev.className === 'ma-earnings-hint') { prev.remove(); }
      if (total === 0) {
        var hint = document.createElement('p');
        hint.className = 'ma-earnings-hint';
        hint.style.cssText = 'color:var(--pico-muted-color,#6c757d);margin-bottom:1rem;font-size:.875rem;';
        hint.appendChild(document.createTextNode('Nothing earned yet. '));
        var hintLink = document.createElement('a');
        if (role === 'publisher') {
          hintLink.href = '#frames';
          hintLink.textContent = 'Go to Frames to get started.';
        } else {
          hintLink.href = '#viewer';
          hintLink.textContent = 'Go to View Ads to get started.';
        }
        hint.appendChild(hintLink);
        summaryEl.insertAdjacentElement('afterend', hint);
      }
    }
  });

  // Today earned
  _loadTodayEarnedSummary();

  // Open channels count
  var roleFilter = (role === 'publisher')
    ? " AND UPPER(ROLE) = 'PUBLISHER'"
    : " AND UPPER(ROLE) = 'VIEWER'";
  var channelSql = "SELECT COUNT(*) AS CNT FROM CHANNEL_STATE WHERE STATUS = 'open'"
    + " AND UPPER(VIEWER_KEY) = UPPER('" + escapeSql(MY_ADDRESS) + "')" + roleFilter;
  sqlQuery(channelSql, function(err, rows) {
    var cnt = (!err && rows && rows[0]) ? (parseInt(rows[0].CNT) || 0) : 0;
    _updateStatCard('ma-stat-channels', String(cnt));
  });

  _refreshSettlementHistory();
  _refreshChannelRewards();
}

function _refreshSettlementHistory() {
  var target = document.getElementById('ma-settlement-history');
  if (!target) { return; }
  var role = (typeof _activeMode !== 'undefined') ? _activeMode : 'viewer';
  var roleFilter;
  if (role === 'publisher') {
    roleFilter = " WHERE UPPER(ch.ROLE) = 'PUBLISHER'";
  } else {
    roleFilter = " WHERE UPPER(ch.ROLE) = 'VIEWER'"
      + " AND (UPPER(c.CREATOR_ADDRESS) != UPPER('" + escapeSql(MY_ADDRESS) + "')"
      + " OR c.CREATOR_ADDRESS IS NULL)";
  }
  // Select each settled channel as an individual row (no GROUP BY)
  // so that multiple cycles for the same campaign each show separately.
  var sql = "SELECT ch.CAMPAIGN_ID, ch.ROLE, ch.CUMULATIVE_EARNED, ch.CREATED_AT, c.TITLE, c.CREATOR_ADDRESS"
          + " FROM CHANNEL_HISTORY ch"
          + " LEFT JOIN CAMPAIGNS c ON UPPER(ch.CAMPAIGN_ID) = UPPER(c.ID)"
          + roleFilter
          + " AND UPPER(ch.VIEWER_KEY) = UPPER('" + escapeSql(MY_ADDRESS) + "')"
          + " ORDER BY ch.CREATED_AT ASC";
  sqlQuery(sql, function(err, rows) {
    target.innerHTML = '';
    renderSettlementHistory(target, rows || []);
  });
}

function renderSettlementHistory(target, settlements) {
  var h3 = document.createElement('h3');
  h3.style.cssText = 'margin-top:0;font-size:.9rem;text-transform:uppercase;color:var(--pico-muted-color,#6c757d);letter-spacing:.04em;margin-bottom:.75rem;';
  h3.textContent = 'Settled channels (' + settlements.length + ')';
  target.appendChild(h3);

  if (!settlements.length) {
    target.appendChild(mkEmptyState('No settled channels yet.'));
    return;
  }

  var table = document.createElement('table');
  table.style.cssText = 'width:100%;margin:0;font-size:.9rem;';
  var thead = document.createElement('thead');
  var headerRow = document.createElement('tr');
  var headers = ['Campaign', 'Status', 'Earned', 'Date', ''];
  for (var i = 0; i < headers.length; i++) {
    var th = document.createElement('th');
    th.textContent = headers[i];
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  var tbody = document.createElement('tbody');
  for (var j = 0; j < settlements.length; j++) {
    (function(r) {
      var tr = document.createElement('tr');
      var campName = r.TITLE || (r.CAMPAIGN_ID ? r.CAMPAIGN_ID.substring(0, 8) + '…' : '—');
      var date = r.CREATED_AT
        ? new Date(parseInt(r.CREATED_AT)).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
        : '—';

      tr.appendChild(earningsTd(campName));

      var statusTd = document.createElement('td');
      statusTd.appendChild(mkStatusBadge('settled'));
      tr.appendChild(statusTd);

      tr.appendChild(earningsTd(fmtAmt(parseFloat(r.CUMULATIVE_EARNED || 0), 6) + ' MINIMA'));
      tr.appendChild(earningsTd(date));

      tr.className = 'ma-expandable-row';
      tr.setAttribute('tabindex', '0');
      tr.setAttribute('aria-expanded', 'false');

      var toggleTd = document.createElement('td');
      var toggleIcon = document.createElement('span');
      toggleIcon.setAttribute('aria-hidden', 'true');
      toggleIcon.textContent = '›';
      toggleIcon.style.cssText = 'display:inline-block;color:var(--pico-muted-color,#6c757d);font-size:1rem;transition:transform .15s ease;';
      toggleTd.appendChild(toggleIcon);
      tr.appendChild(toggleTd);
      tbody.appendChild(tr);

      var detailTr = document.createElement('tr');
      detailTr.style.display = 'none';
      var detailTd = document.createElement('td');
      detailTd.className = 'ma-nested-detail';
      detailTd.setAttribute('colspan', '5');
      detailTd.style.cssText = 'padding:.5rem 1rem;';
      detailTr.appendChild(detailTd);
      tbody.appendChild(detailTr);

      var loaded = false;
      function toggle() {
        if (detailTr.style.display === 'none') {
          detailTr.style.display = '';
          toggleIcon.style.transform = 'rotate(90deg)';
          tr.setAttribute('aria-expanded', 'true');
          if (!loaded) { loaded = true; _loadChannelEvents(r.CAMPAIGN_ID, r.ROLE, true, detailTd, parseInt(r.CREATED_AT, 10)); }
        } else {
          detailTr.style.display = 'none';
          toggleIcon.style.transform = 'rotate(0deg)';
          tr.setAttribute('aria-expanded', 'false');
        }
      }
      tr.addEventListener('click', toggle);
      tr.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle();
        }
      });
    })(settlements[j]);
  }
  table.appendChild(tbody);
  target.appendChild(table);
}

function earningsTd(value) {
  var el = document.createElement('td');
  el.textContent = (value === null || value === undefined) ? '' : String(value);
  return el;
}

function _loadChannelEvents(campaignId, role, isSettled, targetEl, channelCreatedAt) {
  // For settled channels we need two boundaries:
  //   lower:  channelCreatedAt (the CREATED_AT of this specific channel instance)
  //   upper:  the CREATED_AT of the next channel for this campaign+role
  //           (either the next settled channel or the currently open one)
  // For active (non-settled) channels we only need the lower bound (open channel's CREATED_AT).

  if (isSettled && channelCreatedAt) {
    // Find the next channel boundary: smallest CREATED_AT > channelCreatedAt across
    // CHANNEL_HISTORY and CHANNEL_STATE for the same campaign+role.
    var nextHistSql = "SELECT MIN(CREATED_AT) AS NEXT_AT FROM CHANNEL_HISTORY"
                    + " WHERE UPPER(CAMPAIGN_ID) = UPPER('" + escapeSql(campaignId) + "')"
                    + " AND UPPER(ROLE) = UPPER('" + escapeSql(role) + "')"
                    + " AND CREATED_AT > " + channelCreatedAt;
    sqlQuery(nextHistSql, function(nhErr, nhRows) {
      var nextHistAt = (!nhErr && nhRows && nhRows[0] && nhRows[0].NEXT_AT)
                       ? parseInt(nhRows[0].NEXT_AT, 10) : null;
      var openStateSql = "SELECT CREATED_AT FROM CHANNEL_STATE"
                       + " WHERE UPPER(CAMPAIGN_ID) = UPPER('" + escapeSql(campaignId) + "')"
                       + " AND UPPER(ROLE) = UPPER('" + escapeSql(role) + "')"
                       + " AND (STATUS = 'open' OR STATUS = 'pending')";
      sqlQuery(openStateSql, function(osErr, osRows) {
        var openAt = (!osErr && osRows && osRows[0]) ? parseInt(osRows[0].CREATED_AT, 10) : null;
        // Upper bound = smallest of nextHistAt and openAt (ignore nulls)
        var upperBound = null;
        if (nextHistAt && openAt) { upperBound = Math.min(nextHistAt, openAt); }
        else if (nextHistAt)      { upperBound = nextHistAt; }
        else if (openAt)          { upperBound = openAt; }
        var timeFilter = " AND TIMESTAMP >= " + channelCreatedAt;
        if (upperBound) { timeFilter += " AND TIMESTAMP < " + upperBound; }
        _doLoadEvents(campaignId, timeFilter, targetEl);
      });
    });
    return;
  }

  // Active (non-settled) channel: events from the open channel's CREATED_AT onwards.
  var stateSql = "SELECT CREATED_AT FROM CHANNEL_STATE"
               + " WHERE UPPER(CAMPAIGN_ID) = UPPER('" + escapeSql(campaignId) + "')"
               + " AND UPPER(ROLE) = UPPER('" + escapeSql(role) + "')"
               + " AND STATUS = 'open'";
  sqlQuery(stateSql, function(err, rows) {
    var openCreatedAt = null;
    if (!err && rows && rows.length > 0) {
      openCreatedAt = parseInt(rows[0].CREATED_AT, 10);
    }
    var timeFilter = "";
    if (openCreatedAt) {
      if (isSettled) {
        timeFilter = " AND TIMESTAMP < " + openCreatedAt;
      } else {
        timeFilter = " AND TIMESTAMP >= " + openCreatedAt;
      }
    } else {
      if (!isSettled) {
        timeFilter = " AND 1=0";
      }
    }
    _doLoadEvents(campaignId, timeFilter, targetEl);
  });
}

function _doLoadEvents(campaignId, timeFilter, targetEl) {
    var sql = "SELECT TYPE, AMOUNT, TIMESTAMP"
            + " FROM REWARD_EVENTS"
            + " WHERE UPPER(CAMPAIGN_ID) = UPPER('" + escapeSql(campaignId) + "')"
            + " AND UPPER(USER_ADDRESS) = UPPER('" + escapeSql(MY_ADDRESS) + "')"
            + timeFilter
            + " ORDER BY TIMESTAMP ASC";

    sqlQuery(sql, function(err2, eventRows) {
      if (!targetEl) { return; }
      targetEl.innerHTML = '';
      if (err2 || !eventRows || !eventRows.length) {
        var p = document.createElement('p');
        p.style.cssText = 'margin:.25rem 0;font-size:.85em;color:var(--pico-muted-color,#6c757d);';
        p.textContent = 'No events recorded for this channel.';
        targetEl.appendChild(p);
        return;
      }
      var table = document.createElement('table');
      table.style.cssText = 'width:100%;font-size:.85em;margin:0;';
      var thead = document.createElement('thead');
      var hRow = document.createElement('tr');
      var headers = ['Type', 'Amount', 'Date'];
      for (var h = 0; h < headers.length; h++) {
        var th = document.createElement('th');
        th.textContent = headers[h];
        hRow.appendChild(th);
      }
      thead.appendChild(hRow);
      table.appendChild(thead);
      var tbody = document.createElement('tbody');
      for (var i = 0; i < eventRows.length; i++) {
        var eventRow = eventRows[i];
        var tr = document.createElement('tr');
        var date = eventRow.TIMESTAMP
          ? new Date(parseInt(eventRow.TIMESTAMP)).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
          : '—';
        tr.appendChild(earningsTd(eventRow.TYPE));
        tr.appendChild(earningsTd(fmtAmt(parseFloat(eventRow.AMOUNT || 0), 6)));
        tr.appendChild(earningsTd(date));
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      targetEl.appendChild(table);
    });
}

// ---------------------------------------------------------------------------
// Channel rewards (pending settlements)
// ---------------------------------------------------------------------------

function _refreshChannelRewards() {
  var container = document.getElementById('ma-channel-rewards-list');
  if (!container) { return; }
  var role = (typeof _activeMode !== 'undefined') ? _activeMode : 'viewer';
  var roleFilter;
  if (role === 'publisher') {
    roleFilter = " AND UPPER(cs.ROLE) = 'PUBLISHER'";
  } else {
    roleFilter = " AND UPPER(cs.ROLE) = 'VIEWER'"
      + " AND (UPPER(c.CREATOR_ADDRESS) != UPPER('" + escapeSql(MY_ADDRESS) + "')"
      + " OR c.CREATOR_ADDRESS IS NULL)";
  }
  var sql = "SELECT cs.CAMPAIGN_ID, cs.VIEWER_KEY, cs.ROLE, cs.CUMULATIVE_EARNED, cs.LATEST_TX_HEX, c.TITLE"
          + " FROM CHANNEL_STATE cs"
          + " LEFT JOIN CAMPAIGNS c ON UPPER(cs.CAMPAIGN_ID) = UPPER(c.ID)"
          + " WHERE cs.STATUS = 'open' AND cs.LATEST_TX_HEX != ''"
          + " AND UPPER(cs.VIEWER_KEY) = UPPER('" + escapeSql(MY_ADDRESS) + "')"
          + roleFilter;
  sqlQuery(sql, function(err, rows) {
    if (err) { console.error('[EARNINGS] _refreshChannelRewards error:', err); return; }
    _renderChannelRewardRows(rows || [], container);
  });
}

function _renderChannelRewardRows(rows, container) {
  var titleEl = document.getElementById('ma-pending-settlements-title');
  if (titleEl) { titleEl.textContent = 'Pending settlements (' + rows.length + ')'; }
  container.innerHTML = '';
  if (rows.length === 0) {
    container.appendChild(mkEmptyState('No pending settlements.'));
    return;
  }

  var table = document.createElement('table');
  table.style.cssText = 'width:100%;margin:0;font-size:.9rem;';
  var thead = document.createElement('thead');
  var headerRow = document.createElement('tr');
  var headers = ['Type', 'Campaign', 'Amount', 'Action'];
  for (var h = 0; h < headers.length; h++) {
    var th = document.createElement('th');
    th.textContent = headers[h];
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  var tbody = document.createElement('tbody');
  for (var i = 0; i < rows.length; i++) {
    (function(row) {
      var campaignId = row.CAMPAIGN_ID;
      var viewerKey  = row.VIEWER_KEY;
      var role       = row.ROLE || 'viewer';
      var txHex      = row.LATEST_TX_HEX;
      var campName   = row.TITLE || (campaignId.substring(0, 8) + '…');
      var amount     = parseFloat(row.CUMULATIVE_EARNED || 0);

      var tr = document.createElement('tr');

      var typeTd = document.createElement('td');
      typeTd.textContent = role.charAt(0).toUpperCase() + role.slice(1);
      tr.appendChild(typeTd);

      tr.appendChild(earningsTd(campName));
      tr.appendChild(earningsTd(fmtAmt(amount, 6) + ' MINIMA'));

      var actionTd = document.createElement('td');
      var btn = document.createElement('button');
      btn.textContent = 'Settle';
      btn.style.cssText = 'width:auto;margin:0;padding:.3rem .85rem;';
      btn.addEventListener('click', function() {
        btn.disabled = true;
        btn.textContent = 'Settling…';
        _runSettlement(campaignId, viewerKey, role, txHex, btn, amount);
      });
      actionTd.appendChild(btn);
      tr.appendChild(actionTd);
      tbody.appendChild(tr);

      var detailTr = document.createElement('tr');
      detailTr.style.display = 'none';
      var detailTd = document.createElement('td');
      detailTd.className = 'ma-nested-detail';
      detailTd.setAttribute('colspan', '4');
      detailTd.style.cssText = 'padding:.5rem 1rem;';
      detailTr.appendChild(detailTd);
      tbody.appendChild(detailTr);

      var loaded = false;
      function toggle() {
        if (detailTr.style.display === 'none') {
          detailTr.style.display = '';
          if (!loaded) { loaded = true; _loadChannelEvents(campaignId, role, false, detailTd); }
        } else {
          detailTr.style.display = 'none';
        }
      }
      tr.style.cursor = 'pointer';
      tr.addEventListener('click', toggle);
    })(rows[i]);
  }
  table.appendChild(tbody);
  container.appendChild(table);
}

function _runSettlement(campaignId, viewerKey, role, txHex, btnEl, cumulative) {
  var settleId = 'stl_' + Date.now().toString(16);
  console.log('[EARNINGS] _runSettlement start campaign:', campaignId,
    'settleId:', settleId, 'cumulative:', cumulative !== undefined ? cumulative : '?');

  // Guard: abort if the channel is already being settled (SW auto-settle may have locked it)
  sqlQuery(
    "SELECT STATUS FROM CHANNEL_STATE" +
    " WHERE UPPER(CAMPAIGN_ID) = UPPER('" + escapeSql(campaignId) + "')" +
    " AND UPPER(VIEWER_KEY) = UPPER('" + escapeSql(viewerKey) + "')" +
    " AND UPPER(ROLE) = UPPER('" + escapeSql(role) + "')",
    function(stErr, stRows) {
      var status = (!stErr && stRows && stRows.length > 0) ? (stRows[0].STATUS || '') : '';
      if (status !== 'open') {
        console.log('[EARNINGS] _runSettlement aborted — channel status:', status, 'campaign:', campaignId);
        if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Settle'; }
        var stEl = document.getElementById('ma-channel-settle-status');
        if (stEl) { stEl.textContent = status === 'settling' ? 'Settlement already in progress…' : 'Channel already settled.'; }
        _refreshChannelRewards();
        return;
      }
      _runSettlementInner(campaignId, viewerKey, role, txHex, btnEl, settleId);
    }
  );
}

function _runSettlementInner(campaignId, viewerKey, role, txHex, btnEl, settleId) {
  function onError(msg) {
    console.error('[EARNINGS] _runSettlement error:', msg, 'campaign:', campaignId);
    if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Settle'; }
    var statusEl = document.getElementById('ma-channel-settle-status');
    if (statusEl) { statusEl.textContent = 'Settlement failed: ' + msg; }
    MDS.cmd('txndelete id:' + settleId, function() {});
  }

  MDS.keypair.get('VIEWER_WALLET_PK_' + campaignId, function(pkRes) {
    var signKey = (pkRes && pkRes.status && pkRes.value) ? pkRes.value : viewerKey;
    console.log('[EARNINGS] settlement signKey:', signKey !== viewerKey ? 'wallet-pk' : 'viewer-key (fallback)');
    MDS.cmd('txnimport id:' + settleId + ' data:' + txHex, function(r1) {
      console.log('[EARNINGS] txnimport status:', r1 && r1.status, r1 && r1.error);
      if (!r1 || !r1.status) { onError((r1 && r1.error) || 'txnimport failed'); return; }

      MDS.cmd('txnsign id:' + settleId + ' publickey:' + signKey, function(r2) {
        console.log('[EARNINGS] txnsign status:', r2 && r2.status, 'pending:', r2 && r2.pending, r2 && r2.error);
        if (r2 && r2.pending) {
          savePendingChannelOp(r2.pendinguid, {
            kind:       'settlement',
            settleId:   settleId,
            campaignId: campaignId,
            viewerKey:  viewerKey,
            role:       role,
            signKey:    signKey
          });
          console.log('[EARNINGS] txnsign pending, uid:', r2.pendinguid);
          if (btnEl) { btnEl.textContent = 'Awaiting approval…'; }
          return;
        }
        if (!r2 || !r2.status) { onError((r2 && r2.error) || 'txnsign failed'); return; }

        _postSettleTx(settleId, campaignId, viewerKey, role, btnEl);
      });
    });
  });
}

function _postSettleTx(settleId, campaignId, viewerKey, role, btnEl) {
  console.log('[EARNINGS] _postSettleTx enter settleId:', settleId,
    'campaign:', campaignId,
    'viewerKey:', viewerKey ? viewerKey.substring(0, 12) + '...' : '(none)',
    'role:', role);
  MDS.cmd('txnpost id:' + settleId + ' mine:true auto:true', function(r3) {
    console.log('[EARNINGS] txnpost result — status:', r3 && r3.status,
      'pending:', r3 && r3.pending,
      'pendinguid:', r3 && r3.pendinguid,
      'error:', r3 && r3.error);
    try {
      var outs = r3.response.body.txn.outputs;
      for (var oi = 0; oi < outs.length; oi++) {
        console.log('[EARNINGS] settle output[' + oi + ']:', outs[oi].amount, '→', outs[oi].address);
      }
    } catch (e) {}
    if (r3 && r3.pending) {
      MDS.cmd('txndelete id:' + settleId, function() {});
      savePendingChannelOp(r3.pendinguid, {
        kind:       'settlement_post',
        campaignId: campaignId,
        viewerKey:  viewerKey,
        role:       role
      });
      var pendEl = document.getElementById('ma-channel-settle-status');
      if (pendEl) { pendEl.textContent = 'Settlement awaiting approval…'; }
      return;
    }
    MDS.cmd('txndelete id:' + settleId, function() {});
    if (!r3 || !r3.status) {
      console.error('[EARNINGS] txnpost failed — error:', r3 && r3.error, 'campaign:', campaignId, 'role:', role);
      var statusEl = document.getElementById('ma-channel-settle-status');
      if (statusEl) { statusEl.textContent = 'Settlement failed: ' + ((r3 && r3.error) || 'txnpost failed'); }
      if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Settle'; }
      _refreshChannelRewards();
      return;
    }
    // Settlement tx posted to L1. Do NOT call settleChannel() here — the SW's
    // checkOpenChannelsSettled() will confirm it on the next NEWBLOCK once the
    // coin is verifiably spent on-chain, preventing false settlement from
    // transient node re-sync issues.
    console.log('[EARNINGS] settlement tx posted. Awaiting L1 confirmation. campaign:', campaignId);
    var okEl = document.getElementById('ma-channel-settle-status');
    if (okEl) { okEl.textContent = 'Settlement posted. Awaiting L1 confirmation…'; }
  });
}

// ---------------------------------------------------------------------------
// Signal handlers — called from app.js MDSCOMMS dispatcher
// ---------------------------------------------------------------------------

function onChannelOpened(parsed) {
  console.log('[EARNINGS] onChannelOpened campaign:', parsed && parsed.campaign_id);
  if (typeof MinimaAds !== 'undefined' && typeof MinimaAds.onChannelOpened === 'function') {
    MinimaAds.onChannelOpened(parsed);
  }
  _refreshChannelRewards();
}

function onVoucherReceived(parsed) {
  if (typeof MinimaAds !== 'undefined' && typeof MinimaAds.onVoucherReceived === 'function') {
    MinimaAds.onVoucherReceived(parsed);
  }
  _refreshChannelRewards();
  if (typeof loadTodayEarned === 'function') { loadTodayEarned(); }
}

function onAutoSettle(parsed) {
  console.log('[EARNINGS] onAutoSettle campaign:', parsed && parsed.campaign_id,
    'cumulative:', parsed && parsed.cumulative);
  if (!parsed || !parsed.campaign_id || !parsed.viewer_key || !parsed.tx_hex) {
    console.warn('[EARNINGS] onAutoSettle: incomplete payload', parsed);
    return;
  }
  var statusEl = document.getElementById('ma-channel-settle-status');
  if (statusEl) { statusEl.textContent = 'Settling reward channel automatically…'; }
  _runSettlement(parsed.campaign_id, parsed.viewer_key, parsed.role || 'viewer', parsed.tx_hex, null, parsed.cumulative);
}

function onSettleConfirmed(parsed) {
  console.log('[EARNINGS] onSettleConfirmed campaign:', parsed && parsed.campaign_id, 'amount:', parsed && parsed.amount);
  var statusEl = document.getElementById('ma-channel-settle-status');
  if (statusEl) {
    var amount = (parsed && parsed.amount) ? fmtAmt(parseFloat(parsed.amount), 6) : '';
    statusEl.textContent = amount
      ? 'Reward channel settled. Received: ' + amount + ' MINIMA'
      : 'Reward channel settled.';
  }
  loadEarnings();
}
