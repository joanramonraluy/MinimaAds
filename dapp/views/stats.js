// Stats view.
// Campaign table (from getCampaigns). Badge marks campaigns created by the current user.
// Uses textContent / DOM methods rather than innerHTML for user-supplied strings.

function renderStats(root) {
  root.innerHTML = '';

  var h2 = document.createElement('h2');
  h2.textContent = 'Stats';
  root.appendChild(h2);

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
    renderCampaignsTable(target, rows || []);
  });
}

function renderCampaignsTable(target, campaigns) {
  var h3 = document.createElement('h3');
  h3.textContent = 'Campaigns (' + campaigns.length + ')';
  target.appendChild(h3);

  if (!campaigns.length) {
    var p = document.createElement('p');
    p.style.cssText = 'color:var(--pico-muted-color,#6c757d);';
    p.textContent = 'No active campaigns in the system.';
    target.appendChild(p);
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

    var titleTd = document.createElement('td');
    titleTd.textContent = c.TITLE;
    if (MY_ADDRESS && c.CREATOR_ADDRESS && c.CREATOR_ADDRESS.toUpperCase() === MY_ADDRESS.toUpperCase()) {
      var badge = document.createElement('mark');
      badge.textContent = 'Mine';
      badge.style.cssText = 'display:inline;margin-left:.4rem;font-size:.75em;vertical-align:middle;';
      titleTd.appendChild(badge);
    }
    tr.appendChild(titleTd);

    tr.appendChild(td(c.STATUS));
    tr.appendChild(td(shortAddr(c.CREATOR_ADDRESS)));
    tr.appendChild(td(parseFloat(c.BUDGET_REMAINING || 0)));
    tr.appendChild(td(parseFloat(c.REWARD_VIEW || 0)));
    tr.appendChild(td(parseFloat(c.REWARD_CLICK || 0)));
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
