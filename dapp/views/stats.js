// Stats view.
// Campaign table (from getCampaigns). Badge marks campaigns created by the current user.
// M6: market summary stat cards + status badges on table rows.

function renderStats(root) {
  root.innerHTML = '';

  var h2 = document.createElement('h2');
  h2.textContent = 'Stats';
  root.appendChild(h2);

  var summaryRow = document.createElement('div');
  summaryRow.id = 'ma-stats-summary';
  summaryRow.style.cssText = 'display:flex;gap:.75rem;flex-wrap:wrap;margin-bottom:1.25rem;';
  root.appendChild(summaryRow);

  var campaignsSection = document.createElement('section');
  campaignsSection.id = 'ma-stats-campaigns';
  root.appendChild(campaignsSection);

  loadStats();
}

function loadStats() {
  getCampaigns(function(err, rows) {
    var target = document.getElementById('ma-stats-campaigns');
    if (!target) { return; }
    target.innerHTML = '';
    if (err) {
      var p = document.createElement('p');
      p.textContent = 'Campaigns error: ' + err;
      target.appendChild(p);
      return;
    }

    var campaigns = rows || [];

    // Market summary stat cards
    var summaryEl = document.getElementById('ma-stats-summary');
    if (summaryEl) {
      summaryEl.innerHTML = '';
      var active = campaigns.filter(function(c) { return c.STATUS === 'active'; });
      var totalBudget = active.reduce(function(sum, c) {
        return sum + (parseFloat(c.BUDGET_REMAINING) || 0);
      }, 0);
      summaryEl.appendChild(mkStatCard('Active campaigns', String(active.length)));
      summaryEl.appendChild(mkStatCard('Total budget in market', fmtAmt(totalBudget, 4) + ' MINIMA'));
    }

    renderCampaignsTable(target, campaigns);
  });
}

function renderCampaignsTable(target, campaigns) {
  var h3 = document.createElement('h3');
  h3.textContent = 'Campaigns (' + campaigns.length + ')';
  target.appendChild(h3);

  if (!campaigns.length) {
    target.appendChild(mkEmptyState('No active campaigns in the system.'));
    return;
  }

  var table = document.createElement('table');
  var thead = document.createElement('thead');
  var headerRow = document.createElement('tr');
  var headers = ['Title', 'Status', 'Creator', 'Budget left', 'Reward/view', 'Reward/click'];
  for (var i = 0; i < headers.length; i++) {
    var th = document.createElement('th');
    th.textContent = headers[i];
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  var tbody = document.createElement('tbody');
  for (var j = 0; j < campaigns.length; j++) {
    var c = campaigns[j];
    var tr = document.createElement('tr');

    // Title + "Mine" badge
    var titleTd = document.createElement('td');
    titleTd.textContent = c.TITLE;
    if (MY_ADDRESS && c.CREATOR_ADDRESS && c.CREATOR_ADDRESS.toUpperCase() === MY_ADDRESS.toUpperCase()) {
      var mineBadge = mkStatusBadge('active');
      mineBadge.textContent = 'Mine';
      mineBadge.style.marginLeft = '.4rem';
      titleTd.appendChild(mineBadge);
    }
    tr.appendChild(titleTd);

    // Status badge
    var statusTd = document.createElement('td');
    statusTd.appendChild(mkStatusBadge(c.STATUS));
    tr.appendChild(statusTd);

    tr.appendChild(td(shortAddr(c.CREATOR_ADDRESS)));
    tr.appendChild(td(fmtAmt(parseFloat(c.BUDGET_REMAINING || 0), 4)));
    tr.appendChild(td(fmtAmt(parseFloat(c.REWARD_VIEW || 0), 6)));
    tr.appendChild(td(fmtAmt(parseFloat(c.REWARD_CLICK || 0), 6)));
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  target.appendChild(table);
}

function td(value) {
  var el = document.createElement('td');
  el.textContent = (value === null || value === undefined) ? '' : String(value);
  return el;
}

function shortAddr(addr) {
  if (!addr) { return ''; }
  var s = String(addr);
  if (s.length <= 16) { return s; }
  return s.slice(0, 10) + '…' + s.slice(-6);
}
