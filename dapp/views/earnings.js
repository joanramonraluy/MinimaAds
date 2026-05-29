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

  var summarySection = document.createElement('section');
  summarySection.id = 'ma-earnings-summary';
  root.appendChild(summarySection);

  var pendingSection = document.createElement('section');
  pendingSection.style.cssText = 'margin-top:1.5rem;';

  var pendingH3 = document.createElement('h3');
  pendingH3.textContent = 'Pending settlements';
  pendingSection.appendChild(pendingH3);

  var settleStatus = document.createElement('p');
  settleStatus.id = 'ma-channel-settle-status';
  settleStatus.setAttribute('role', 'status');
  pendingSection.appendChild(settleStatus);

  var channelList = document.createElement('div');
  channelList.id = 'ma-channel-rewards-list';
  pendingSection.appendChild(channelList);

  root.appendChild(pendingSection);

  var settleHistorySection = document.createElement('section');
  settleHistorySection.id = 'ma-settlement-history';
  settleHistorySection.style.cssText = 'margin-top:1.5rem;';
  root.appendChild(settleHistorySection);

  loadEarnings();
}

function _loadTodayEarnedSummary() {
  var el = document.getElementById('ma-today-earned');
  if (!el) { return; }
  var role = (typeof _activeMode !== 'undefined') ? _activeMode : 'viewer';
  var types = (role === 'publisher') ? "'publisher_view'" : "'view','click'";
  var now = new Date();
  var startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  var sql = "SELECT SUM(AMOUNT) AS TOTAL FROM REWARD_EVENTS"
    + " WHERE UPPER(USER_ADDRESS) = UPPER('" + escapeSql(MY_ADDRESS) + "')"
    + " AND TYPE IN (" + types + ")"
    + " AND TIMESTAMP >= " + startOfDay;
  sqlQuery(sql, function(err, rows) {
    var target = document.getElementById('ma-today-earned');
    if (!target) { return; }
    var total = (!err && rows && rows[0]) ? (parseFloat(rows[0].TOTAL) || 0) : 0;
    target.textContent = total.toFixed(6);
  });
}

function loadEarnings() {
  if (!MY_ADDRESS) { return; }

  var role = (typeof _activeMode !== 'undefined') ? _activeMode : 'viewer';
  var types = (role === 'publisher') ? "'publisher_view'" : "'view','click'";
  var totalSql = "SELECT SUM(AMOUNT) AS TOTAL FROM REWARD_EVENTS"
    + " WHERE UPPER(USER_ADDRESS) = UPPER('" + escapeSql(MY_ADDRESS) + "')"
    + " AND TYPE IN (" + types + ")";

  sqlQuery(totalSql, function(err, rows) {
    var target = document.getElementById('ma-earnings-summary');
    if (!target) { return; }
    target.innerHTML = '';
    var totalEarned = (!err && rows && rows[0]) ? (parseFloat(rows[0].TOTAL) || 0) : 0;

    var article = document.createElement('article');
    var strong = document.createElement('strong');
    strong.textContent = 'Total earned: ';
    article.appendChild(strong);
    article.appendChild(document.createTextNode(totalEarned.toFixed(6) + ' MINIMA'));
    target.appendChild(article);

    var todayArticle = document.createElement('article');
    var todayStrong = document.createElement('strong');
    todayStrong.textContent = 'Today earned: ';
    todayArticle.appendChild(todayStrong);
    var todaySpan = document.createElement('span');
    todaySpan.id = 'ma-today-earned';
    todaySpan.textContent = '…';
    todayArticle.appendChild(todaySpan);
    todayArticle.appendChild(document.createTextNode(' MINIMA'));
    target.appendChild(todayArticle);

    if (totalEarned === 0) {
      var hint = document.createElement('p');
      hint.style.cssText = 'color:var(--pico-muted-color,#6c757d);margin-top:.5rem;';
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
      target.appendChild(hint);
    }

    _loadTodayEarnedSummary();
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
    var empty = document.createElement('p');
    empty.textContent = 'No settled channels yet.';
    target.appendChild(empty);
    return;
  }

  var table = document.createElement('table');
  var thead = document.createElement('thead');
  var headerRow = document.createElement('tr');
  var headers = ['Campaign', 'Creator', 'Earned', 'Opened', ''];
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
      var campName = r.TITLE || (r.CAMPAIGN_ID ? r.CAMPAIGN_ID.substring(0, 8) + '…' : '');
      var creatorPk = r.CREATOR_ADDRESS ? r.CREATOR_ADDRESS.substring(0, 10) + '…' : '';
      var date = r.CREATED_AT ? new Date(parseInt(r.CREATED_AT)).toLocaleDateString() : '';
      tr.appendChild(earningsTd(campName));
      tr.appendChild(earningsTd(creatorPk));
      tr.appendChild(earningsTd(parseFloat(r.CUMULATIVE_EARNED || 0).toFixed(6) + ' MINIMA'));
      tr.appendChild(earningsTd(date));

      var toggleTd = document.createElement('td');
      var toggleBtn = document.createElement('button');
      toggleBtn.textContent = '▶';
      toggleBtn.style.cssText = 'padding:.1rem .35rem;font-size:.75rem;';
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
          if (!loaded) {
            loaded = true;
            detailTd.textContent = 'Loading…';
            _loadChannelEvents(r.CAMPAIGN_ID, detailTd);
          }
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
      p.style.cssText = 'margin:.25rem 0;font-size:.85em;color:#888;';
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
      var date = r.TIMESTAMP ? new Date(parseInt(r.TIMESTAMP)).toLocaleString() : '';
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
// Channel rewards (moved from viewer.js T-CH6)
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
    if (err) { console.error('[EARNINGS] _refreshChannelRewards query error:', err); return; }
    var found = rows || [];
    console.log('[EARNINGS] settleable channels:', found.length);
    for (var i = 0; i < found.length; i++) {
      var vk = found[i].VIEWER_KEY ? found[i].VIEWER_KEY.substring(0, 12) + '…' : '?';
      console.log('[EARNINGS] pending — campaign:', found[i].CAMPAIGN_ID,
        'role:', found[i].ROLE, 'cumulative:', found[i].CUMULATIVE_EARNED, 'viewer:', vk);
    }
    _renderChannelRewardRows(found, container);
  });
}

function _renderChannelRewardRows(rows, container) {
  container.innerHTML = '';
  if (rows.length === 0) {
    var empty = document.createElement('p');
    empty.innerHTML = '<em>No pending settlements.</em>';
    container.appendChild(empty);
    return;
  }
  for (var i = 0; i < rows.length; i++) {
    (function(row) {
      var campaignId = row.CAMPAIGN_ID;
      var viewerKey  = row.VIEWER_KEY;
      var role       = row.ROLE || 'viewer';
      var txHex      = row.LATEST_TX_HEX;

      var item = document.createElement('div');
      item.style.cssText = 'margin:.5rem 0;padding:.5rem;border:1px solid #e0e0e0;border-radius:4px;';

      var mainRow = document.createElement('div');
      mainRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:1rem;';

      var infoDiv = document.createElement('div');
      var campName = row.TITLE || (campaignId.substring(0, 8) + '…');
      var nameSpan = document.createElement('strong');
      nameSpan.textContent = campName;
      nameSpan.style.display = 'block';

      var amountSpan = document.createElement('span');
      amountSpan.textContent = parseFloat(row.CUMULATIVE_EARNED).toFixed(6) + ' MINIMA pending';
      amountSpan.style.fontSize = '0.9em';
      amountSpan.style.color = '#555';

      infoDiv.appendChild(nameSpan);
      infoDiv.appendChild(amountSpan);

      var btn = document.createElement('button');
      btn.textContent = 'Settle';
      btn.style.cssText = 'padding:.25rem .75rem;';
      btn.addEventListener('click', function() {
        btn.disabled = true;
        btn.textContent = 'Settling…';
        _runSettlement(campaignId, viewerKey, role, txHex, btn, parseFloat(row.CUMULATIVE_EARNED));
      });

      mainRow.appendChild(infoDiv);
      mainRow.appendChild(btn);
      item.appendChild(mainRow);

      var details = document.createElement('details');
      details.style.cssText = 'margin-top:.5rem;font-size:.9em;';
      var summary = document.createElement('summary');
      summary.textContent = 'Detall';
      summary.style.cssText = 'cursor:pointer;color:#777;user-select:none;';
      details.appendChild(summary);
      var detailBody = document.createElement('div');
      detailBody.style.cssText = 'margin-top:.4rem;padding:.4rem .5rem;background:var(--pico-card-sectionning-background-color,#f8f8f8);border-radius:4px;';
      detailBody.textContent = 'Loading…';
      details.appendChild(detailBody);
      var loaded = false;
      details.addEventListener('toggle', function() {
        if (details.open && !loaded) {
          loaded = true;
          _loadChannelEvents(campaignId, detailBody);
        }
      });

      item.appendChild(details);
      container.appendChild(item);
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
