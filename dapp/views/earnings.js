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

  var historySection = document.createElement('section');
  historySection.id = 'ma-earnings-history';
  historySection.style.cssText = 'margin-top:1.5rem;';
  root.appendChild(historySection);

  loadEarnings();
}

function loadEarnings() {
  if (!MY_ADDRESS) { return; }

  getUserProfile(MY_ADDRESS, function(err, profile) {
    var target = document.getElementById('ma-earnings-summary');
    if (!target) { return; }
    target.innerHTML = '';
    var totalEarned = (!err && profile) ? parseFloat(profile.TOTAL_EARNED || 0) : 0;
    var article = document.createElement('article');
    var strong = document.createElement('strong');
    strong.textContent = 'Total earned: ';
    article.appendChild(strong);
    article.appendChild(document.createTextNode(totalEarned.toFixed(6) + ' MINIMA'));
    target.appendChild(article);
  });

  getUserRewards(MY_ADDRESS, function(err, rewards) {
    var target = document.getElementById('ma-earnings-history');
    if (!target) { return; }
    target.innerHTML = '';
    renderRewardHistory(target, rewards || []);
  });

  _refreshSettlementHistory();
  _refreshChannelRewards();
}

function _refreshSettlementHistory() {
  var target = document.getElementById('ma-settlement-history');
  if (!target) { return; }
  var sql = "SELECT cs.CAMPAIGN_ID, cs.CUMULATIVE_EARNED, cs.CREATED_AT, c.TITLE, c.CREATOR_ADDRESS"
          + " FROM CHANNEL_STATE cs"
          + " LEFT JOIN CAMPAIGNS c ON UPPER(cs.CAMPAIGN_ID) = UPPER(c.ID)"
          + " WHERE cs.STATUS = 'settled'";
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
  var headers = ['Campaign', 'Creator', 'Earned', 'Opened'];
  for (var i = 0; i < headers.length; i++) {
    var th = document.createElement('th');
    th.textContent = headers[i];
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  var tbody = document.createElement('tbody');
  for (var j = 0; j < settlements.length; j++) {
    var r = settlements[j];
    var tr = document.createElement('tr');
    var campName = r.TITLE || (r.CAMPAIGN_ID ? r.CAMPAIGN_ID.substring(0, 8) + '…' : '');
    var creatorPk = r.CREATOR_ADDRESS ? r.CREATOR_ADDRESS.substring(0, 10) + '…' : '';
    var date = r.CREATED_AT ? new Date(parseInt(r.CREATED_AT)).toLocaleDateString() : '';
    tr.appendChild(earningsTd(campName));
    tr.appendChild(earningsTd(creatorPk));
    tr.appendChild(earningsTd(parseFloat(r.CUMULATIVE_EARNED || 0).toFixed(6) + ' MINIMA'));
    tr.appendChild(earningsTd(date));
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  target.appendChild(table);
}

function renderRewardHistory(target, rewards) {
  var h3 = document.createElement('h3');
  h3.textContent = 'Reward history (' + rewards.length + ')';
  target.appendChild(h3);

  if (!rewards.length) {
    var empty = document.createElement('p');
    empty.textContent = 'No rewards yet.';
    target.appendChild(empty);
    return;
  }

  var table = document.createElement('table');
  var thead = document.createElement('thead');
  var headerRow = document.createElement('tr');
  var headers = ['Campaign', 'Creator', 'Type', 'Amount', 'Date'];
  for (var i = 0; i < headers.length; i++) {
    var th = document.createElement('th');
    th.textContent = headers[i];
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  var tbody = document.createElement('tbody');
  for (var j = 0; j < rewards.length; j++) {
    var r = rewards[j];
    var tr = document.createElement('tr');
    var shortId = r.TITLE || (r.CAMPAIGN_ID ? r.CAMPAIGN_ID.substring(0, 8) + '…' : '');
    var creatorPk = r.CREATOR_ADDRESS ? r.CREATOR_ADDRESS.substring(0, 10) + '…' : '';
    var date = r.TIMESTAMP ? new Date(parseInt(r.TIMESTAMP)).toLocaleString() : '';
    tr.appendChild(earningsTd(shortId));
    tr.appendChild(earningsTd(creatorPk));
    tr.appendChild(earningsTd(r.TYPE));
    tr.appendChild(earningsTd(parseFloat(r.AMOUNT || 0).toFixed(6)));
    tr.appendChild(earningsTd(date));
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  target.appendChild(table);
}

function earningsTd(value) {
  var el = document.createElement('td');
  el.textContent = (value === null || value === undefined) ? '' : String(value);
  return el;
}

// ---------------------------------------------------------------------------
// Channel rewards (moved from viewer.js T-CH6)
// ---------------------------------------------------------------------------

function _refreshChannelRewards() {
  var container = document.getElementById('ma-channel-rewards-list');
  if (!container) { return; }
  var sql = "SELECT cs.CAMPAIGN_ID, cs.VIEWER_KEY, cs.CUMULATIVE_EARNED, cs.LATEST_TX_HEX, c.TITLE"
          + " FROM CHANNEL_STATE cs"
          + " LEFT JOIN CAMPAIGNS c ON UPPER(cs.CAMPAIGN_ID) = UPPER(c.ID)"
          + " WHERE cs.STATUS = 'open' AND cs.LATEST_TX_HEX != ''";
  sqlQuery(sql, function(err, rows) {
    if (err) { console.error('[EARNINGS] _refreshChannelRewards query error:', err); return; }
    var found = rows || [];
    console.log('[EARNINGS] settleable channels:', found.length);
    for (var i = 0; i < found.length; i++) {
      var vk = found[i].VIEWER_KEY ? found[i].VIEWER_KEY.substring(0, 12) + '…' : '?';
      console.log('[EARNINGS] pending — campaign:', found[i].CAMPAIGN_ID,
        'cumulative:', found[i].CUMULATIVE_EARNED, 'viewer:', vk);
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
      var txHex      = row.LATEST_TX_HEX;

      var item = document.createElement('div');
      item.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:1rem;margin:.5rem 0;padding:.5rem;border:1px solid #e0e0e0;border-radius:4px;';

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
        _runSettlement(campaignId, viewerKey, txHex, btn, parseFloat(row.CUMULATIVE_EARNED));
      });

      item.appendChild(infoDiv);
      item.appendChild(btn);
      container.appendChild(item);
    })(rows[i]);
  }
}

function _runSettlement(campaignId, viewerKey, txHex, btnEl, cumulative) {
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

  MDS.cmd('txnimport id:' + settleId + ' data:' + txHex, function(r1) {
    console.log('[EARNINGS] txnimport status:', r1 && r1.status, r1 && r1.error);
    if (!r1 || !r1.status) { onError((r1 && r1.error) || 'txnimport failed'); return; }

    MDS.cmd('txnsign id:' + settleId + ' publickey:' + viewerKey, function(r2) {
      console.log('[EARNINGS] txnsign status:', r2 && r2.status, 'pending:', r2 && r2.pending, r2 && r2.error);
      if (r2 && r2.pending) {
        savePendingChannelOp(r2.pendinguid, {
          kind:       'settlement',
          settleId:   settleId,
          campaignId: campaignId,
          viewerKey:  viewerKey
        });
        console.log('[EARNINGS] txnsign pending, uid:', r2.pendinguid);
        if (btnEl) { btnEl.textContent = 'Awaiting approval…'; }
        return;
      }
      if (!r2 || !r2.status) { onError((r2 && r2.error) || 'txnsign failed'); return; }

      _postSettleTx(settleId, campaignId, viewerKey);
    });
  });
}

function _postSettleTx(settleId, campaignId, viewerKey) {
  MDS.cmd('txnpost id:' + settleId + ' mine:true', function(r3) {
    console.log('[EARNINGS] txnpost status:', r3 && r3.status, r3 && r3.error);
    try {
      var outs = r3.response.body.txn.outputs;
      for (var oi = 0; oi < outs.length; oi++) {
        console.log('[EARNINGS] settle output[' + oi + ']:', outs[oi].amount, '→', outs[oi].address);
      }
    } catch (e) {}
    MDS.cmd('txndelete id:' + settleId, function() {});
    if (!r3 || !r3.status) {
      console.error('[EARNINGS] txnpost failed:', r3 && r3.error, 'campaign:', campaignId);
      var statusEl = document.getElementById('ma-channel-settle-status');
      if (statusEl) { statusEl.textContent = 'Settlement failed: ' + ((r3 && r3.error) || 'txnpost failed'); }
      _refreshChannelRewards();
      return;
    }
    settleChannel(campaignId, viewerKey, 'viewer', function(err) {
      if (err) {
        console.error('[EARNINGS] settleChannel DB error:', err);
        var el = document.getElementById('ma-channel-settle-status');
        if (el) { el.textContent = 'Settlement posted but DB update failed.'; }
        _refreshChannelRewards();
        return;
      }
      getChannelState(campaignId, viewerKey, 'viewer', function(err2, ch) {
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
  console.log('[EARNINGS] onVoucherReceived campaign:', parsed && parsed.campaign_id, 'cumulative:', parsed && parsed.cumulative);
  if (typeof MinimaAds !== 'undefined' && typeof MinimaAds.onVoucherReceived === 'function') {
    MinimaAds.onVoucherReceived(parsed);
  }
  _refreshChannelRewards();
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
  _runSettlement(parsed.campaign_id, parsed.viewer_key, parsed.tx_hex, null, parsed.cumulative);
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
  _refreshChannelRewards();
  _refreshSettlementHistory();
  var histTarget = document.getElementById('ma-earnings-history');
  if (histTarget && MY_ADDRESS) {
    getUserRewards(MY_ADDRESS, function(err, rewards) {
      if (!err) { histTarget.innerHTML = ''; renderRewardHistory(histTarget, rewards || []); }
    });
  }
}
