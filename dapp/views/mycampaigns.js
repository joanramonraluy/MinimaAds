// My Campaigns view — creator dashboard.
// Route: #mycampaigns (Creator mode only).
// Shows per-campaign metrics (views, clicks) from REWARD_EVENTS and management actions.
// Actions (pause/resume/finish) migrated here from the provisional section in creator.js (Sessió 5).
// Sessió 9: Chart.js line chart (expand row to see detail), auto-refresh every 30s.

var _autoRefreshTimer = 0;
var _expandedCampaignId = null;
var _expandedChart = null;

function renderMyCampaigns(root) {
  if (_autoRefreshTimer) { clearInterval(_autoRefreshTimer); _autoRefreshTimer = 0; }
  if (_expandedChart) { _expandedChart.destroy(); _expandedChart = null; }
  _expandedCampaignId = null;

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

  var savedExpandedId = _expandedCampaignId;
  if (_expandedChart) { _expandedChart.destroy(); _expandedChart = null; }
  _expandedCampaignId = null;

  section.innerHTML = '';
  var loading = document.createElement('p');
  loading.setAttribute('aria-busy', 'true');
  loading.textContent = 'Loading…';
  section.appendChild(loading);

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
      var emptyEl = document.createElement('p');
      emptyEl.style.color = 'var(--pico-muted-color,#6c757d)';
      emptyEl.textContent = 'No has creat cap campanya. Vés a Create per publicar la primera.';
      target.appendChild(emptyEl);
      return;
    }

    var table = document.createElement('table');
    var thead = document.createElement('thead');
    var headerRow = document.createElement('tr');
    var headers = ['Títol', 'Estat', 'Pressupost total', 'Restant', 'View reward', 'Click reward', 'Views', 'Clicks', 'Accions'];
    for (var h = 0; h < headers.length; h++) {
      var th = document.createElement('th');
      th.textContent = headers[h];
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    var tbody = document.createElement('tbody');
    for (var i = 0; i < rows.length; i++) {
      tbody.appendChild(_buildMyCampaignRow(rows[i]));
    }
    table.appendChild(tbody);
    target.appendChild(table);

    // Re-open the detail panel that was open before the refresh
    if (savedExpandedId) {
      var savedRow = tbody.querySelector('tr[data-campaign-id="' + savedExpandedId + '"]');
      if (savedRow) { _expandDetailPanel(tbody, savedRow, savedExpandedId); }
    }
  });
}

function _buildMyCampaignRow(c) {
  var tr = document.createElement('tr');
  tr.setAttribute('data-campaign-id', c.ID);

  // Clickable title cell — expands/collapses the detail chart panel
  var tdTitle = document.createElement('td');
  tdTitle.style.cursor = 'pointer';
  tdTitle.title = 'Veure detall';

  var indicator = document.createElement('span');
  indicator.className = 'ma-detail-indicator';
  indicator.style.cssText = 'display:inline-block;width:0.75rem;margin-right:0.35rem;'
    + 'font-size:0.75rem;color:var(--pico-muted-color,#6c757d);';
  indicator.textContent = '▶';
  tdTitle.appendChild(indicator);
  tdTitle.appendChild(document.createTextNode(c.TITLE));

  tdTitle.addEventListener('click', function() {
    _toggleDetailPanel(tr, c.ID);
  });
  tr.appendChild(tdTitle);

  var tdStatus = document.createElement('td');
  var statusColor = c.STATUS === 'active' ? '#1a7a4a'
    : c.STATUS === 'paused' ? '#c47c00' : '#6c757d';
  var statusLabel = c.STATUS === 'active' ? 'Activa'
    : c.STATUS === 'paused' ? 'Pausada' : 'Finalitzada';
  var badge = document.createElement('span');
  badge.style.cssText = 'display:inline-block;padding:0.1rem 0.4rem;border-radius:3px;'
    + 'font-size:0.78rem;background:' + statusColor + ';color:#fff;font-weight:600;';
  badge.textContent = statusLabel;
  tdStatus.appendChild(badge);
  tr.appendChild(tdStatus);

  var tdBudgetTotal = document.createElement('td');
  tdBudgetTotal.textContent = parseFloat(c.BUDGET_TOTAL || 0).toFixed(6);
  tr.appendChild(tdBudgetTotal);

  var tdBudgetLeft = document.createElement('td');
  tdBudgetLeft.textContent = parseFloat(c.BUDGET_REMAINING || 0).toFixed(6);
  tr.appendChild(tdBudgetLeft);

  var tdRv = document.createElement('td');
  tdRv.textContent = parseFloat(c.REWARD_VIEW || 0).toFixed(6);
  tr.appendChild(tdRv);

  var tdRc = document.createElement('td');
  tdRc.textContent = parseFloat(c.REWARD_CLICK || 0).toFixed(6);
  tr.appendChild(tdRc);

  var tdViews = document.createElement('td');
  tdViews.textContent = parseInt(c.VIEW_COUNT || 0, 10);
  tr.appendChild(tdViews);

  var tdClicks = document.createElement('td');
  tdClicks.textContent = parseInt(c.CLICK_COUNT || 0, 10);
  tr.appendChild(tdClicks);

  var tdActions = document.createElement('td');
  tdActions.style.whiteSpace = 'nowrap';
  _appendMyCampaignActions(tdActions, c);
  tr.appendChild(tdActions);

  return tr;
}

// ---------------------------------------------------------------------------
// Detail panel — Chart.js line chart per campaign
// ---------------------------------------------------------------------------

function _toggleDetailPanel(tr, campaignId) {
  if (_expandedCampaignId === campaignId) {
    _collapseDetailPanel(tr, campaignId);
    return;
  }
  // Collapse any currently open panel
  if (_expandedCampaignId) {
    var prevTr = tr.parentNode
      ? tr.parentNode.querySelector('tr[data-campaign-id="' + _expandedCampaignId + '"]')
      : null;
    _collapseDetailPanel(prevTr, _expandedCampaignId);
  }
  if (!tr.parentNode) { return; }
  _expandDetailPanel(tr.parentNode, tr, campaignId);
}

function _collapseDetailPanel(tr, campaignId) {
  if (tr) {
    var indicator = tr.querySelector('.ma-detail-indicator');
    if (indicator) { indicator.textContent = '▶'; }
  }
  var detailRow = document.getElementById('ma-detail-' + campaignId);
  if (detailRow && detailRow.parentNode) { detailRow.parentNode.removeChild(detailRow); }
  if (_expandedChart) { _expandedChart.destroy(); _expandedChart = null; }
  _expandedCampaignId = null;
}

function _expandDetailPanel(tbody, tr, campaignId) {
  if (!tbody) { return; }
  _expandedCampaignId = campaignId;

  var indicator = tr.querySelector('.ma-detail-indicator');
  if (indicator) { indicator.textContent = '▼'; }

  var detailTr = document.createElement('tr');
  detailTr.id = 'ma-detail-' + campaignId;

  var detailTd = document.createElement('td');
  detailTd.setAttribute('colspan', '9');
  detailTd.style.cssText = 'background:var(--pico-card-sectionning-background-color,#f8f9fa);'
    + 'padding:1rem 0.75rem;';

  var loadingP = document.createElement('p');
  loadingP.setAttribute('aria-busy', 'true');
  loadingP.textContent = 'Carregant gràfic…';
  detailTd.appendChild(loadingP);

  detailTr.appendChild(detailTd);
  // insertBefore(node, null) is equivalent to appendChild — handles last row correctly
  tbody.insertBefore(detailTr, tr.nextSibling);

  _loadChartData(campaignId, detailTd);
}

function _loadChartData(campaignId, detailEl) {
  var sql = "SELECT TYPE, TIMESTAMP"
    + " FROM REWARD_EVENTS"
    + " WHERE UPPER(CAMPAIGN_ID) = UPPER('" + escapeSql(campaignId) + "')"
    + " ORDER BY TIMESTAMP ASC";

  sqlQuery(sql, function(err, rows) {
    // Guard: another campaign may have been expanded while this query was running
    if (_expandedCampaignId !== campaignId) { return; }

    detailEl.innerHTML = '';

    if (err) {
      var errEl = document.createElement('p');
      errEl.textContent = 'Error carregant dades: ' + err;
      detailEl.appendChild(errEl);
      return;
    }

    if (!rows || rows.length === 0) {
      var emptyEl = document.createElement('p');
      emptyEl.style.color = 'var(--pico-muted-color,#6c757d)';
      emptyEl.textContent = 'Sense dades. Les interaccions apareixeran aquí un cop el primer viewer vegi l\'anunci.';
      detailEl.appendChild(emptyEl);
      return;
    }

    // Group by calendar day in JavaScript.
    // REWARD_EVENTS.TIMESTAMP is BIGINT (Unix ms) — no H2 date functions needed.
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
    var viewData = [];
    var clickData = [];
    for (var j = 0; j < days.length; j++) {
      viewData.push(dayMap[days[j]].view);
      clickData.push(dayMap[days[j]].click);
    }

    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'max-width:600px;margin:0 auto;';
    var canvas = document.createElement('canvas');
    canvas.id = 'ma-chart-' + campaignId;
    wrapper.appendChild(canvas);
    detailEl.appendChild(wrapper);

    if (_expandedChart) { _expandedChart.destroy(); }
    _expandedChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: days,
        datasets: [
          {
            label: 'Views',
            data: viewData,
            borderColor: '#1a7a4a',
            backgroundColor: 'rgba(26,122,74,0.1)',
            tension: 0.3,
            fill: true,
            pointRadius: 4
          },
          {
            label: 'Clicks',
            data: clickData,
            borderColor: '#c47c00',
            backgroundColor: 'rgba(196,124,0,0.1)',
            tension: 0.3,
            fill: true,
            pointRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'top' }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1, precision: 0 }
          }
        }
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Campaign action buttons (Pausar / Reprendre / Finalitzar)
// ---------------------------------------------------------------------------

function _appendMyCampaignActions(tdActions, c) {
  function _makeBtn(label, secondary, onClick) {
    var btn = document.createElement('button');
    btn.textContent = label;
    if (secondary) { btn.className = 'secondary'; }
    btn.style.cssText = 'width:auto;margin:0 0.25rem 0 0;padding:0.15rem 0.45rem;font-size:0.78rem;';
    btn.addEventListener('click', onClick);
    return btn;
  }

  function _disableAll() {
    var btns = tdActions.querySelectorAll('button');
    for (var b = 0; b < btns.length; b++) { btns[b].setAttribute('disabled', ''); }
  }

  if (c.STATUS === 'active') {
    tdActions.appendChild(_makeBtn('Pausar', false, function() {
      _disableAll();
      MDS.comms.broadcast(JSON.stringify({ type: 'MA_LOCAL_STATUS', campaign_id: c.ID, status: 'paused' }), function() {});
    }));
  }

  if (c.STATUS === 'paused') {
    tdActions.appendChild(_makeBtn('Reprendre', false, function() {
      _disableAll();
      MDS.comms.broadcast(JSON.stringify({ type: 'MA_LOCAL_STATUS', campaign_id: c.ID, status: 'active' }), function() {});
    }));
  }

  if (c.STATUS === 'active' || c.STATUS === 'paused') {
    tdActions.appendChild(_makeBtn('Finalitzar', true, function() {
      if (!confirm('Finalitzar la campanya "' + c.TITLE + '"?\nAquesta acció no es pot desfer.')) { return; }
      _disableAll();
      MDS.comms.broadcast(JSON.stringify({ type: 'MA_LOCAL_STATUS', campaign_id: c.ID, status: 'finished' }), function() {});
    }));
  }
}
