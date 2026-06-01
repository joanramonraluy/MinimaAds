// My Campaigns view — creator dashboard.
// Route: #mycampaigns (Creator mode only).
// Shows per-campaign metrics (views, clicks) from REWARD_EVENTS and management actions.
// Actions (pause/resume/finish) migrated here from the provisional section in creator.js (Sessió 5).
// Sessió 9: Chart.js line chart inside a <details> per card, auto-refresh every 30s.
// M4: table → campaign cards with status badge, stat cards, budget progress bar.
// M5: Rewarded nodes + Settled channels expandable sections per card.

var _autoRefreshTimer = 0;
var _expandedCharts   = {};   // campaignId → Chart instance

function renderMyCampaigns(root) {
  if (_autoRefreshTimer) { clearInterval(_autoRefreshTimer); _autoRefreshTimer = 0; }
  _destroyAllCharts();

  root.innerHTML = '';
  var h2 = document.createElement('h2');
  h2.textContent = 'My Campaigns';
  root.appendChild(h2);
  var section = document.createElement('section');
  section.id = 'ma-mycampaigns-section';
  root.appendChild(section);
  loadMyCampaigns();
  _startAutoRefresh();
}

function _destroyAllCharts() {
  for (var id in _expandedCharts) {
    if (_expandedCharts[id]) { _expandedCharts[id].destroy(); }
  }
  _expandedCharts = {};
}

function _startAutoRefresh() {
  if (_autoRefreshTimer) { clearInterval(_autoRefreshTimer); }
  _autoRefreshTimer = setInterval(function() {
    var section = document.getElementById('ma-mycampaigns-section');
    if (!section) { clearInterval(_autoRefreshTimer); _autoRefreshTimer = 0; return; }
    loadMyCampaigns();
  }, 30000);
}

function loadMyCampaigns() {
  var section = document.getElementById('ma-mycampaigns-section');
  if (!section || !MY_ADDRESS) { return; }

  _destroyAllCharts();
  section.innerHTML = '';
  section.appendChild(mkLoading('Loading campaigns…'));

  var sql = "SELECT c.*,"
    + " (SELECT COUNT(*) FROM REWARD_EVENTS re WHERE UPPER(re.CAMPAIGN_ID) = UPPER(c.ID) AND re.TYPE = 'view') AS VIEW_COUNT,"
    + " (SELECT COUNT(*) FROM REWARD_EVENTS re WHERE UPPER(re.CAMPAIGN_ID) = UPPER(c.ID) AND re.TYPE = 'click') AS CLICK_COUNT"
    + " FROM CAMPAIGNS c"
    + " WHERE UPPER(c.CREATOR_ADDRESS) = UPPER('" + escapeSql(MY_ADDRESS) + "')"
    + " ORDER BY c.CREATED_AT DESC";

  sqlQuery(sql, function(err, rows) {
    var target = document.getElementById('ma-mycampaigns-section');
    if (!target) { return; }
    target.innerHTML = '';

    if (err) {
      var errEl = document.createElement('p');
      errEl.textContent = 'Error loading campaigns: ' + err;
      target.appendChild(errEl);
      return;
    }

    if (!rows || rows.length === 0) {
      target.appendChild(mkEmptyState(
        'No campaigns yet.',
        'Create your first campaign',
        '#creator'
      ));
      return;
    }

    for (var i = 0; i < rows.length; i++) {
      target.appendChild(_buildCampaignCard(rows[i]));
    }
  });
}

function _buildCampaignCard(c) {
  var budgetTotal     = parseFloat(c.BUDGET_TOTAL || 0);
  var budgetRemaining = parseFloat(c.BUDGET_REMAINING || 0);
  var budgetSpent     = budgetTotal - budgetRemaining;
  var budgetPct       = budgetTotal > 0 ? (budgetSpent / budgetTotal) * 100 : 0;
  var viewCount       = parseInt(c.VIEW_COUNT || 0, 10);
  var clickCount      = parseInt(c.CLICK_COUNT || 0, 10);

  var card = document.createElement('article');
  card.setAttribute('data-campaign-id', c.ID);
  card.style.cssText = 'margin-bottom:1rem;';

  // ── Header: title + badge (left) | action buttons (right) ──────────────
  var cardHeader = document.createElement('header');
  cardHeader.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:.75rem;flex-wrap:wrap;';

  var badgeGroup = document.createElement('div');
  badgeGroup.className = 'ma-campaign-badge-group';
  badgeGroup.style.cssText = 'display:flex;align-items:center;gap:.5rem;min-width:0;flex:1;';

  var titleEl = document.createElement('strong');
  titleEl.textContent = c.TITLE;
  titleEl.style.cssText = 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:18rem;';
  badgeGroup.appendChild(titleEl);
  badgeGroup.appendChild(mkStatusBadge(c.STATUS));
  cardHeader.appendChild(badgeGroup);

  var actionsDiv = document.createElement('div');
  actionsDiv.style.cssText = 'display:flex;gap:.35rem;flex-shrink:0;';
  _appendCampaignActions(actionsDiv, c);
  cardHeader.appendChild(actionsDiv);

  card.appendChild(cardHeader);

  // ── Stat cards row ──────────────────────────────────────────────────────
  var statsRow = document.createElement('div');
  statsRow.style.cssText = 'display:flex;gap:.6rem;flex-wrap:wrap;margin:.75rem 0 .5rem;';
  statsRow.appendChild(mkStatCard('Views', String(viewCount)));
  statsRow.appendChild(mkStatCard('Clicks', String(clickCount)));
  statsRow.appendChild(mkStatCard('Budget left', budgetRemaining.toFixed(4) + ' M'));
  statsRow.appendChild(mkStatCard('Reward/view', parseFloat(c.REWARD_VIEW || 0).toFixed(4) + ' M'));
  card.appendChild(statsRow);

  // ── Budget progress bar ─────────────────────────────────────────────────
  var progressWrap = document.createElement('div');
  progressWrap.style.cssText = 'margin-bottom:.75rem;';
  progressWrap.appendChild(mkProgressBar(budgetPct, 'Budget used'));
  var progressLbl = document.createElement('small');
  progressLbl.style.cssText = 'color:var(--pico-muted-color,#6c757d);font-size:.72rem;';
  progressLbl.textContent = budgetSpent.toFixed(4) + ' / ' + budgetTotal.toFixed(4) + ' MINIMA used';
  progressWrap.appendChild(progressLbl);
  card.appendChild(progressWrap);

  // ── Activity chart (expandable) ─────────────────────────────────────────
  var details = document.createElement('details');
  details.className = 'ma-campaign-details';
  var summary = document.createElement('summary');
  summary.textContent = 'Activity chart';
  summary.className = 'ma-campaign-details-summary';
  details.appendChild(summary);

  var detailBody = document.createElement('div');
  detailBody.id = 'ma-detail-' + c.ID;
  detailBody.style.cssText = 'padding:.75rem 0 .25rem;';
  details.appendChild(detailBody);

  var chartLoaded = false;
  details.addEventListener('toggle', function() {
    if (details.open && !chartLoaded) {
      chartLoaded = true;
      detailBody.appendChild(mkLoading('Loading chart…'));
      _loadChartData(c.ID, detailBody);
    }
    if (!details.open && _expandedCharts[c.ID]) {
      _expandedCharts[c.ID].destroy();
      delete _expandedCharts[c.ID];
      detailBody.innerHTML = '';
      chartLoaded = false;
    }
  });

  card.appendChild(details);

  // ── Rewarded nodes (expandable) ────────────────────────────────────────
  var nodesDetails = document.createElement('details');
  nodesDetails.className = 'ma-campaign-details';
  var nodesSummary = document.createElement('summary');
  nodesSummary.textContent = 'Rewarded nodes';
  nodesSummary.className = 'ma-campaign-details-summary';
  nodesDetails.appendChild(nodesSummary);

  var nodesBody = document.createElement('div');
  nodesBody.style.cssText = 'padding:.75rem 0 .25rem;';
  nodesDetails.appendChild(nodesBody);

  var nodesLoaded = false;
  nodesDetails.addEventListener('toggle', function() {
    if (nodesDetails.open && !nodesLoaded) {
      nodesLoaded = true;
      nodesBody.appendChild(mkLoading('Loading rewarded nodes…'));
      _loadRewardedNodes(c.ID, nodesBody);
    }
    if (!nodesDetails.open) {
      nodesBody.innerHTML = '';
      nodesLoaded = false;
    }
  });

  card.appendChild(nodesDetails);

  // ── Settled channels (expandable) ─────────────────────────────────────────
  var settledDetails = document.createElement('details');
  settledDetails.className = 'ma-campaign-details';
  var settledSummary = document.createElement('summary');
  settledSummary.textContent = 'Settled channels';
  settledSummary.className = 'ma-campaign-details-summary';
  settledDetails.appendChild(settledSummary);

  var settledBody = document.createElement('div');
  settledBody.style.cssText = 'padding:.75rem 0 .25rem;';
  settledDetails.appendChild(settledBody);

  var settledLoaded = false;
  settledDetails.addEventListener('toggle', function() {
    if (settledDetails.open && !settledLoaded) {
      settledLoaded = true;
      settledBody.appendChild(mkLoading('Loading settled channels…'));
      _loadSettledChannels(c.ID, settledBody);
    }
    if (!settledDetails.open) {
      settledBody.innerHTML = '';
      settledLoaded = false;
    }
  });

  card.appendChild(settledDetails);
  return card;
}

// ---------------------------------------------------------------------------
// Chart.js line chart per campaign
// ---------------------------------------------------------------------------

function _loadChartData(campaignId, detailEl) {
  var sql = "SELECT TYPE, TIMESTAMP"
    + " FROM REWARD_EVENTS"
    + " WHERE UPPER(CAMPAIGN_ID) = UPPER('" + escapeSql(campaignId) + "')"
    + " ORDER BY TIMESTAMP ASC";

  sqlQuery(sql, function(err, rows) {
    detailEl.innerHTML = '';

    if (err) {
      var errEl = document.createElement('p');
      errEl.textContent = 'Error loading data: ' + err;
      detailEl.appendChild(errEl);
      return;
    }

    if (!rows || rows.length === 0) {
      detailEl.appendChild(mkEmptyState(
        'No interactions yet. Data will appear here once the first viewer sees the ad.'
      ));
      return;
    }

    var dayMap = {};
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var ts = parseInt(r.TIMESTAMP || 0, 10);
      var d = new Date(ts);
      var day = d.getFullYear() + '-'
        + ('0' + (d.getMonth() + 1)).slice(-2) + '-'
        + ('0' + d.getDate()).slice(-2);
      if (!dayMap[day]) { dayMap[day] = { view: 0, click: 0 }; }
      var type = (r.TYPE || '').toLowerCase();
      if (type === 'view') { dayMap[day].view++; }
      else if (type === 'click') { dayMap[day].click++; }
    }

    var days = Object.keys(dayMap).sort();
    var viewData  = [];
    var clickData = [];
    for (var j = 0; j < days.length; j++) {
      viewData.push(dayMap[days[j]].view);
      clickData.push(dayMap[days[j]].click);
    }

    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'max-width:560px;';
    var canvas = document.createElement('canvas');
    canvas.id = 'ma-chart-' + campaignId;
    wrapper.appendChild(canvas);
    detailEl.appendChild(wrapper);

    if (_expandedCharts[campaignId]) { _expandedCharts[campaignId].destroy(); }
    _expandedCharts[campaignId] = new Chart(canvas, {
      type: 'line',
      data: {
        labels: days,
        datasets: [
          {
            label: 'Views',
            data: viewData,
            borderColor: '#2ecc71',
            backgroundColor: 'rgba(46,204,113,0.1)',
            tension: 0.3,
            fill: true,
            pointRadius: 4
          },
          {
            label: 'Clicks',
            data: clickData,
            borderColor: '#f39c12',
            backgroundColor: 'rgba(243,156,18,0.1)',
            tension: 0.3,
            fill: true,
            pointRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'top' } },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 } }
        }
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Settled channels per campaign (from CHANNEL_HISTORY, grouped by publisher PK)
// ---------------------------------------------------------------------------

function _loadSettledChannels(campaignId, detailEl) {
  _loadMaximaContactsMap(function(contactsMap) {
    var sql = "SELECT VIEWER_KEY, ROLE, CUMULATIVE_EARNED, STATUS, CREATED_AT, VIEWER_WALLET_ADDR"
      + " FROM CHANNEL_HISTORY"
      + " WHERE UPPER(CAMPAIGN_ID) = UPPER('" + escapeSql(campaignId) + "')"
      + " AND UPPER(ROLE) = 'PUBLISHER'"
      + " ORDER BY CREATED_AT DESC";

    sqlQuery(sql, function(err, rows) {
      if (!detailEl) { return; }
      detailEl.innerHTML = '';

      if (err) {
        var errEl = document.createElement('p');
        errEl.textContent = 'Error loading settled channels: ' + err;
        detailEl.appendChild(errEl);
        return;
      }

      if (!rows || rows.length === 0) {
        detailEl.appendChild(mkEmptyState('No settled publisher channels yet.'));
        return;
      }

      _renderSettledChannelsTable(detailEl, rows, contactsMap);
    });
  });
}

function _renderSettledChannelsTable(target, rows, contactsMap) {
  var groups = _groupSettledChannelsByPk(rows);
  var table = document.createElement('table');
  table.className = 'ma-nested-table';

  var thead = document.createElement('thead');
  var headerRow = document.createElement('tr');
  var headers = ['Publisher', 'PK', 'Channels', 'Total', 'Last settled', ''];
  for (var h = 0; h < headers.length; h++) {
    var th = document.createElement('th');
    th.textContent = headers[h];
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  var tbody = document.createElement('tbody');
  for (var i = 0; i < groups.length; i++) {
    var group = groups[i];
    var pk = group.pk || '';
    var contact = contactsMap[String(pk).toUpperCase()] || null;
    var nodeName = contact && contact.name ? contact.name : 'Unknown node';
    var lastText = group.lastTs
      ? new Date(group.lastTs).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
      : '—';

    var tr = document.createElement('tr');
    tr.className = 'ma-expandable-row';
    tr.setAttribute('tabindex', '0');
    tr.setAttribute('aria-expanded', 'false');
    tr.appendChild(_nodeTd(nodeName));
    tr.appendChild(_nodeTd(_shortNodePk(pk)));
    tr.appendChild(_nodeTd(String(group.rows.length)));
    tr.appendChild(_nodeTd(group.total.toFixed(6) + ' M'));
    tr.appendChild(_nodeTd(lastText));

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
    detailTd.setAttribute('colspan', '6');
    detailTd.style.cssText = 'padding:.5rem 1rem;';
    detailTr.appendChild(detailTd);
    tbody.appendChild(detailTr);

    (function(summaryRow, icon, rowEl, cellEl, channelRows) {
      var loaded = false;
      function toggle() {
        if (rowEl.style.display === 'none') {
          rowEl.style.display = '';
          icon.style.transform = 'rotate(90deg)';
          summaryRow.setAttribute('aria-expanded', 'true');
          if (!loaded) {
            loaded = true;
            _renderSettledChannelEvents(cellEl, channelRows);
          }
        } else {
          rowEl.style.display = 'none';
          icon.style.transform = 'rotate(0deg)';
          summaryRow.setAttribute('aria-expanded', 'false');
        }
      }
      summaryRow.addEventListener('click', toggle);
      summaryRow.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle();
        }
      });
    })(tr, toggleIcon, detailTr, detailTd, group.rows);
  }

  table.appendChild(tbody);
  target.appendChild(table);
}

function _groupSettledChannelsByPk(rows) {
  var map = {};
  var groups = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var pk = r.VIEWER_KEY || '';
    var key = String(pk).toUpperCase();
    if (!map[key]) {
      map[key] = { pk: pk, rows: [], total: 0, lastTs: 0 };
      groups.push(map[key]);
    }
    var ts = parseInt(r.CREATED_AT || 0, 10) || 0;
    map[key].rows.push(r);
    map[key].total += (parseFloat(r.CUMULATIVE_EARNED || 0) || 0);
    if (ts > map[key].lastTs) { map[key].lastTs = ts; }
  }
  groups.sort(function(a, b) { return b.lastTs - a.lastTs; });
  return groups;
}

function _renderSettledChannelEvents(target, rows) {
  target.innerHTML = '';
  var table = document.createElement('table');
  table.className = 'ma-nested-table';
  var thead = document.createElement('thead');
  var headerRow = document.createElement('tr');
  var headers = ['Status', 'Earned', 'Settled at'];
  for (var h = 0; h < headers.length; h++) {
    var th = document.createElement('th');
    th.textContent = headers[h];
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  var tbody = document.createElement('tbody');
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var ts = parseInt(r.CREATED_AT || 0, 10);
    var settledDate = ts
      ? new Date(ts).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
      : '—';
    var tr = document.createElement('tr');
    tr.appendChild(_nodeTd(r.STATUS || 'settled'));
    tr.appendChild(_nodeTd((parseFloat(r.CUMULATIVE_EARNED || 0) || 0).toFixed(6) + ' M'));
    tr.appendChild(_nodeTd(settledDate));
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  target.appendChild(table);
}

// ---------------------------------------------------------------------------
// Rewarded nodes per campaign
// ---------------------------------------------------------------------------

function _loadRewardedNodes(campaignId, detailEl) {
  _loadMaximaContactsMap(function(contactsMap) {
    var sql = "SELECT USER_ADDRESS, TYPE, AMOUNT, TIMESTAMP"
      + " FROM REWARD_EVENTS"
      + " WHERE UPPER(CAMPAIGN_ID) = UPPER('" + escapeSql(campaignId) + "')"
      + " ORDER BY TIMESTAMP DESC";

    sqlQuery(sql, function(err, rows) {
      if (!detailEl) { return; }
      detailEl.innerHTML = '';

      if (err) {
        var errEl = document.createElement('p');
        errEl.textContent = 'Error loading rewarded nodes: ' + err;
        detailEl.appendChild(errEl);
        return;
      }

      if (!rows || rows.length === 0) {
        detailEl.appendChild(mkEmptyState('No rewarded nodes yet.'));
        return;
      }

      _renderRewardedNodesTable(detailEl, rows, contactsMap);
    });
  });
}

function _loadMaximaContactsMap(cb) {
  MDS.cmd('maxcontacts action:list', function(res) {
    var map = {};
    if (res && res.status && res.response && res.response.contacts) {
      var contacts = res.response.contacts;
      for (var i = 0; i < contacts.length; i++) {
        var c = contacts[i];
        if (c.publickey) {
          map[String(c.publickey).toUpperCase()] = {
            name: (c.extradata && c.extradata.name) ? c.extradata.name : ''
          };
        }
      }
    }
    cb(map);
  });
}

function _renderRewardedNodesTable(target, rows, contactsMap) {
  var groups = _groupRewardRowsByNode(rows);
  var table = document.createElement('table');
  table.className = 'ma-nested-table';

  var thead = document.createElement('thead');
  var headerRow = document.createElement('tr');
  var headers = ['Node', 'PK', 'Rewards', 'Total', 'Last rewarded', ''];
  for (var h = 0; h < headers.length; h++) {
    var th = document.createElement('th');
    th.textContent = headers[h];
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  var tbody = document.createElement('tbody');
  for (var i = 0; i < groups.length; i++) {
    var group = groups[i];
    var pk = group.pk || '';
    var contact = contactsMap[String(pk).toUpperCase()] || null;
    var nodeName = contact && contact.name ? contact.name : 'Unknown node';
    var lastText = group.lastTs
      ? new Date(group.lastTs).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
      : '—';

    var tr = document.createElement('tr');
    tr.className = 'ma-expandable-row';
    tr.setAttribute('tabindex', '0');
    tr.setAttribute('aria-expanded', 'false');
    tr.appendChild(_nodeTd(nodeName));
    tr.appendChild(_nodeTd(_shortNodePk(pk)));
    tr.appendChild(_nodeTd(String(group.rows.length)));
    tr.appendChild(_nodeTd(group.total.toFixed(6) + ' M'));
    tr.appendChild(_nodeTd(lastText));

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
    detailTd.setAttribute('colspan', '6');
    detailTd.style.cssText = 'padding:.5rem 1rem;';
    detailTr.appendChild(detailTd);
    tbody.appendChild(detailTr);

    (function(summaryRow, icon, rowEl, cellEl, rewardRows) {
      var loaded = false;
      function toggle() {
        if (rowEl.style.display === 'none') {
          rowEl.style.display = '';
          icon.style.transform = 'rotate(90deg)';
          summaryRow.setAttribute('aria-expanded', 'true');
          if (!loaded) {
            loaded = true;
            _renderNodeRewardEvents(cellEl, rewardRows);
          }
        } else {
          rowEl.style.display = 'none';
          icon.style.transform = 'rotate(0deg)';
          summaryRow.setAttribute('aria-expanded', 'false');
        }
      }
      summaryRow.addEventListener('click', toggle);
      summaryRow.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle();
        }
      });
    })(tr, toggleIcon, detailTr, detailTd, group.rows);
  }

  table.appendChild(tbody);
  target.appendChild(table);
}

function _groupRewardRowsByNode(rows) {
  var map = {};
  var groups = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var pk = r.USER_ADDRESS || '';
    var key = String(pk).toUpperCase();
    if (!map[key]) {
      map[key] = {
        pk: pk,
        rows: [],
        total: 0,
        lastTs: 0
      };
      groups.push(map[key]);
    }
    var ts = parseInt(r.TIMESTAMP || 0, 10) || 0;
    map[key].rows.push(r);
    map[key].total += (parseFloat(r.AMOUNT || 0) || 0);
    if (ts > map[key].lastTs) { map[key].lastTs = ts; }
  }
  groups.sort(function(a, b) { return b.lastTs - a.lastTs; });
  return groups;
}

function _renderNodeRewardEvents(target, rows) {
  target.innerHTML = '';
  var table = document.createElement('table');
  table.className = 'ma-nested-table';
  var thead = document.createElement('thead');
  var headerRow = document.createElement('tr');
  var headers = ['Reward', 'Amount', 'Reward date'];
  for (var h = 0; h < headers.length; h++) {
    var th = document.createElement('th');
    th.textContent = headers[h];
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  var tbody = document.createElement('tbody');
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var ts = parseInt(r.TIMESTAMP || 0, 10);
    var rewardDate = ts
      ? new Date(ts).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
      : '—';
    var tr = document.createElement('tr');
    tr.appendChild(_nodeTd(_formatRewardType(r.TYPE)));
    tr.appendChild(_nodeTd((parseFloat(r.AMOUNT || 0) || 0).toFixed(6) + ' M'));
    tr.appendChild(_nodeTd(rewardDate));
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  target.appendChild(table);
}

function _formatRewardType(type) {
  var t = (type || '').toLowerCase();
  if (t === 'publisher_view') { return 'Publisher view'; }
  if (t === 'view') { return 'View'; }
  if (t === 'click') { return 'Click'; }
  return type || '—';
}

function _shortNodePk(pk) {
  if (!pk) { return '—'; }
  var s = String(pk);
  if (s.length <= 18) { return s; }
  return s.slice(0, 10) + '…' + s.slice(-6);
}

function _nodeTd(value) {
  var td = document.createElement('td');
  td.textContent = (value === null || value === undefined) ? '' : String(value);
  return td;
}

// ---------------------------------------------------------------------------
// Campaign action buttons (Pause / Resume / Finish)
// ---------------------------------------------------------------------------

function _appendCampaignActions(container, c) {
  function _makeBtn(label, cls, onClick) {
    var btn = document.createElement('button');
    btn.textContent = label;
    btn.className = cls || '';
    btn.style.cssText = 'width:auto;margin:0;padding:.2rem .55rem;font-size:.78rem;';
    btn.addEventListener('click', onClick);
    return btn;
  }

  function _disableAll() {
    var btns = container.querySelectorAll('button');
    for (var b = 0; b < btns.length; b++) { btns[b].disabled = true; }
  }

  if (c.STATUS === 'active') {
    container.appendChild(_makeBtn('Pause', 'secondary outline', function() {
      _disableAll();
      _applyStatusChange(c.ID, 'paused');
    }));
  }

  if (c.STATUS === 'paused') {
    container.appendChild(_makeBtn('Resume', '', function() {
      _disableAll();
      _applyStatusChange(c.ID, 'active');
    }));
  }

  if (c.STATUS === 'active' || c.STATUS === 'paused') {
    container.appendChild(_makeBtn('Finish', 'secondary', function() {
      // Replace action buttons with inline confirmation
      container.innerHTML = '';
      var msg = document.createElement('small');
      msg.style.cssText = 'color:var(--pico-muted-color,#6c757d);margin-right:.5rem;';
      msg.textContent = 'Finish "' + c.TITLE + '"?';
      var confirmBtn = document.createElement('button');
      confirmBtn.textContent = 'Yes, finish';
      confirmBtn.className = 'secondary';
      confirmBtn.style.cssText = 'width:auto;margin:0 .35rem 0 0;padding:.2rem .55rem;font-size:.78rem;';
      var cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'Cancel';
      cancelBtn.className = 'outline';
      cancelBtn.style.cssText = 'width:auto;margin:0;padding:.2rem .55rem;font-size:.78rem;';
      confirmBtn.addEventListener('click', function() {
        container.innerHTML = '';
        _applyStatusChange(c.ID, 'finished');
      });
      cancelBtn.addEventListener('click', function() {
        container.innerHTML = '';
        _appendCampaignActions(container, c);
      });
      container.appendChild(msg);
      container.appendChild(confirmBtn);
      container.appendChild(cancelBtn);
    }));
  }
}

// Local fast-path broadcast + on-chain status-update tx (T-SC6).
function _applyStatusChange(campaignId, newStatus) {
  MDS.comms.broadcast(JSON.stringify({
    type:        'MA_LOCAL_STATUS',
    campaign_id: campaignId,
    status:      newStatus
  }), function() {});

  var postFn = (typeof window !== 'undefined' && typeof window.buildAndPostStatusUpdateTx === 'function')
    ? window.buildAndPostStatusUpdateTx
    : (typeof buildAndPostStatusUpdateTx === 'function' ? buildAndPostStatusUpdateTx : null);
  if (!postFn) {
    console.warn('[STATUS-TX] buildAndPostStatusUpdateTx not loaded; skipping on-chain propagation.');
    return;
  }

  postFn(campaignId, newStatus, function(res) {
    if (!res || !res.ok) {
      var errMsg = (res && res.error) ? res.error : 'unknown error';
      console.warn('[STATUS-TX] on-chain propagation failed for', campaignId, ':', errMsg);
      alert('On-chain propagation failed: ' + errMsg);
      return;
    }
    if (res.skipped) {
      console.log('[STATUS-TX] on-chain propagation skipped (legacy V1/V2 escrow) for', campaignId);
      return;
    }
    if (res.pending) {
      console.log('[STATUS-TX] awaiting Hub approval for', campaignId, 'uid:', res.pending_uid);
      return;
    }
    console.log('[STATUS-TX] confirmed on-chain for', campaignId, 'new coinid:', res.new_coinid);
  });
}

// ---------------------------------------------------------------------------
// STATUS_TX_PENDING — append an "awaiting confirm" label to the card badge group.
// ---------------------------------------------------------------------------

var _pendingStatusTxLabels = {};

function onStatusTxPending(parsed) {
  if (!parsed || !parsed.campaign_id) { return; }
  _pendingStatusTxLabels[parsed.campaign_id] = parsed.status || '';
  _renderPendingLabel(parsed.campaign_id, parsed.status || '');
}

function _renderPendingLabel(campaignId, status) {
  var section = document.getElementById('ma-mycampaigns-section');
  if (!section) { return; }
  var card = section.querySelector('article[data-campaign-id="' + campaignId + '"]');
  if (!card) { return; }
  var badgeGroup = card.querySelector('.ma-campaign-badge-group');
  if (!badgeGroup) { return; }
  var existing = badgeGroup.querySelector('.ma-status-tx-pending');
  if (existing) { existing.remove(); }
  var lbl = document.createElement('small');
  lbl.className = 'ma-status-tx-pending';
  lbl.style.cssText = 'color:var(--pico-muted-color,#6c757d);font-size:.72rem;font-style:italic;';
  lbl.textContent = '(awaiting on-chain confirm' + (status ? ': ' + status : '') + ')';
  badgeGroup.appendChild(lbl);
}

window.onStatusTxPending = onStatusTxPending;
