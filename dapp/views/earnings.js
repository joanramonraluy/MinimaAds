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
  root.appendChild(h2);

  // 3 stat cards in a row
  var summaryRow = document.createElement('div');
  summaryRow.id = 'ma-earnings-summary';
  summaryRow.style.cssText = 'display:flex;gap:.75rem;flex-wrap:wrap;margin-bottom:1.5rem;';

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
  pendingSection.style.cssText = 'margin-bottom:1.5rem;';
  var pendingH3 = document.createElement('h3');
  pendingH3.id = 'ma-pending-settlements-title';
  pendingH3.textContent = 'Pending settlements';
  pendingSection.appendChild(pendingH3);
  var channelList = document.createElement('div');
  channelList.id = 'ma-channel-rewards-list';
  pendingSection.appendChild(channelList);
  root.appendChild(pendingSection);

  // Settlement history
  var historySection = document.createElement('section');
  historySection.id = 'ma-settlement-history';
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
    _updateStatCard('ma-stat-today', total.toFixed(6) + ' MINIMA');
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
    _updateStatCard('ma-stat-total', total.toFixed(6) + ' MINIMA');

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
  var channelSql = "SELECT COUNT(*) AS CNT FROM CHANNEL_STATE WHERE STATUS = 'open'" + roleFilter;
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
  var sql = "SELECT ch.CAMPAIGN_ID, ch.ROLE, SUM(ch.CUMULATIVE_EARNED) AS CUMULATIVE_EARNED,"
          + " MIN(ch.CREATED_AT) AS CREATED_AT, c.TITLE, c.CREATOR_ADDRESS"
          + " FROM CHANNEL_HISTORY ch"
          + " LEFT JOIN CAMPAIGNS c ON UPPER(ch.CAMPAIGN_ID) = UPPER(c.ID)"
          + roleFilter
          + " GROUP BY ch.CAMPAIGN_ID, ch.ROLE, c.TITLE, c.CREATOR_ADDRESS"
          + " ORDER BY MIN(ch.CREATED_AT) ASC";
  sqlQuery(sql, function(err, rows) {
    target.innerHTML = '';
    renderSettlementHistory(target, rows || []);
  });
}

function renderSettlementHistory(target, settlements) {
  var h3 = document.createElement('h3');
  h3.textContent = 'Settled channels (' + settlements.length + ')';
  target.appendChild(h3);

  if (!settlements.length) {
    target.appendChild(mkEmptyState('No settled channels yet.'));
    return;
  }

  var table = document.createElement('table');
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

      tr.appendChild(earningsTd(parseFloat(r.CUMULATIVE_EARNED || 0).toFixed(6) + ' MINIMA'));
      tr.appendChild(earningsTd(date));

      var toggleTd = document.createElement('td');
      var toggleBtn = document.createElement('button');
      toggleBtn.textContent = '▶';
      toggleBtn.style.cssText = 'width:auto;margin:0;padding:.1rem .4rem;font-size:.75rem;';
      toggleTd.appendChild(toggleBtn);
      tr.appendChild(toggleTd);
      tbody.appendChild(tr);

      var detailTr = document.createElement('tr');
      detailTr.style.display = 'none';
      var detailTd = document.createElement('td');
      detailTd.setAttribute('colspan', '5');
      detailTd.style.cssText = 'padding:.5rem 1rem;background:var(--pico-card-sectionning-background-color,#f8f8f8);';
      detailTr.appendChild(detailTd);
      tbody.appendChild(detailTr);

      var loaded = false;
      toggleBtn.addEventListener('click', function() {
        if (detailTr.style.display === 'none') {
          detailTr.style.display = '';
          toggleBtn.textContent = '▼';
          if (!loaded) { loaded = true; _loadChannelEvents(r.CAMPAIGN_ID, detailTd); }
        } else {
          detailTr.style.display = 'none';
          toggleBtn.textContent = '▶';
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

function _loadChannelEvents(campaignId, targetEl) {
  var sql = "SELECT TYPE, AMOUNT, TIMESTAMP"
          + " FROM REWARD_EVENTS"
          + " WHERE UPPER(CAMPAIGN_ID) = UPPER('" + escapeSql(campaignId) + "')"
          + " AND UPPER(USER_ADDRESS) = UPPER('" + escapeSql(MY_ADDRESS) + "')"
          + " ORDER BY TIMESTAMP ASC";
  sqlQuery(sql, function(err, rows) {
    if (!targetEl) { return; }
    targetEl.innerHTML = '';
    if (err || !rows || !rows.length) {
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
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var tr = document.createElement('tr');
      var date = r.TIMESTAMP
        ? new Date(parseInt(r.TIMESTAMP)).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
        : '—';
      tr.appendChild(earningsTd(r.TYPE));
      tr.appendChild(earningsTd(parseFloat(r.AMOUNT || 0).toFixed(6)));
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
  for (var i = 0; i < rows.length; i++) {
    (function(row) {
      var campaignId = row.CAMPAIGN_ID;
      var viewerKey  = row.VIEWER_KEY;
      var role       = row.ROLE || 'viewer';
      var txHex      = row.LATEST_TX_HEX;
      var campName   = row.TITLE || (campaignId.substring(0, 8) + '…');
      var amount     = parseFloat(row.CUMULATIVE_EARNED || 0);

      var card = document.createElement('article');
      card.style.cssText = 'margin-bottom:1rem;';

      // Card header: name + badge + settle button
      var cardHeader = document.createElement('header');
      cardHeader.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:.75rem;';

      var titleGroup = document.createElement('div');
      titleGroup.style.cssText = 'display:flex;align-items:center;gap:.5rem;min-width:0;';
      var nameEl = document.createElement('strong');
      nameEl.textContent = campName;
      titleGroup.appendChild(nameEl);
      titleGroup.appendChild(mkStatusBadge('pending'));
      cardHeader.appendChild(titleGroup);

      var btn = document.createElement('button');
      btn.textContent = 'Settle';
      btn.style.cssText = 'width:auto;margin:0;padding:.3rem .85rem;flex-shrink:0;';
      btn.addEventListener('click', function() {
        btn.disabled = true;
        btn.textContent = 'Settling…';
        _runSettlement(campaignId, viewerKey, role, txHex, btn, amount);
      });
      cardHeader.appendChild(btn);
      card.appendChild(cardHeader);

      // Amount stat card
      var amountWrap = document.createElement('div');
      amountWrap.style.cssText = 'margin:.75rem 0;';
      var amountCard = mkStatCard('Pending', amount.toFixed(6) + ' MINIMA');
      amountCard.style.flex = 'none';
      amountWrap.appendChild(amountCard);
      card.appendChild(amountWrap);

      // Expandable event detail
      var details = document.createElement('details');
      var summary = document.createElement('summary');
      summary.textContent = 'Show events';
      summary.style.cssText = 'cursor:pointer;font-size:.875rem;color:var(--pico-muted-color,#6c757d);';
      details.appendChild(summary);
      var detailBody = document.createElement('div');
      detailBody.style.cssText = 'margin-top:.5rem;';
      detailBody.appendChild(mkLoading('Loading events…'));
      details.appendChild(detailBody);
      var loaded = false;
      details.addEventListener('toggle', function() {
        if (details.open && !loaded) {
          loaded = true;
          _loadChannelEvents(campaignId, detailBody);
        }
      });
      card.appendChild(details);

      container.appendChild(card);
    })(rows[i]);
  }
}

function _runSettlement(campaignId, viewerKey, role, txHex, btnEl, cumulative) {
  var settleId = 'stl_' + Date.now().toString(16);
  console.log('[EARNINGS] _runSettlement start campaign:', campaignId,
    'settleId:', settleId, 'cumulative:', cumulative !== undefined ? cumulative : '?');

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

        _postSettleTx(settleId, campaignId, viewerKey, role);
      });
    });
  });
}

function _postSettleTx(settleId, campaignId, viewerKey, role) {
  console.log('[EARNINGS] _postSettleTx enter settleId:', settleId,
    'campaign:', campaignId,
    'viewerKey:', viewerKey ? viewerKey.substring(0, 12) + '...' : '(none)',
    'role:', role);
  MDS.cmd('txnpost id:' + settleId + ' mine:true', function(r3) {
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
      console.error('[EARNINGS] txnpost failed — NOT calling settleChannel. error:', r3 && r3.error, 'campaign:', campaignId, 'role:', role);
      var statusEl = document.getElementById('ma-channel-settle-status');
      if (statusEl) { statusEl.textContent = 'Settlement failed: ' + ((r3 && r3.error) || 'txnpost failed'); }
      _refreshChannelRewards();
      return;
    }
    console.log('[EARNINGS] calling settleChannel campaign:', campaignId, 'role:', role,
      'viewerKey:', viewerKey ? viewerKey.substring(0, 12) + '...' : '(none)');
    settleChannel(campaignId, viewerKey, role, function(err) {
      if (err) {
        console.error('[EARNINGS] settleChannel DB error:', err);
        var el = document.getElementById('ma-channel-settle-status');
        if (el) { el.textContent = 'Settlement posted but DB update failed.'; }
        _refreshChannelRewards();
        return;
      }
      getChannelState(campaignId, viewerKey, role, function(err2, ch) {
        var cum = (ch && ch.CUMULATIVE_EARNED) ? parseFloat(ch.CUMULATIVE_EARNED) : 0;
        console.log('[EARNINGS] settlement complete campaign:', campaignId, 'cumulative:', cum);
        signalFE('SETTLE_CONFIRMED', { campaign_id: campaignId, amount: cum });
        _refreshChannelRewards();
      });
    });
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
    var amount = (parsed && parsed.amount) ? parseFloat(parsed.amount).toFixed(6) : '';
    statusEl.textContent = amount
      ? 'Reward channel settled. Received: ' + amount + ' MINIMA'
      : 'Reward channel settled.';
  }
  loadEarnings();
}
