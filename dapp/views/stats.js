// T10 — Stats view.
// Campaign table (from getCampaigns) + user reward summary (from getUserRewards).
// Uses textContent / DOM methods rather than innerHTML for user-supplied strings
// (T11 will add DOMPurify for rich ad content).

function renderStats(root) {
  root.innerHTML = '';

  var h2 = document.createElement('h2');
  h2.textContent = 'Stats';
  root.appendChild(h2);

  var rewardsSection = document.createElement('section');
  rewardsSection.id = 'ma-stats-rewards';
  root.appendChild(rewardsSection);

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

  if (!MY_ADDRESS) { return; }
  getUserRewards(MY_ADDRESS, function(err, rewards) {
    var target = document.getElementById('ma-stats-rewards');
    if (!target) { return; }
    target.innerHTML = '';
    if (err) {
      var p = document.createElement('p');
      p.textContent = 'Rewards error: ' + err;
      target.appendChild(p);
      return;
    }
    renderRewardsSummary(target, rewards || []);
  });
}

function renderCampaignsTable(target, campaigns) {
  var h3 = document.createElement('h3');
  h3.textContent = 'Campaigns (' + campaigns.length + ')';
  target.appendChild(h3);

  if (!campaigns.length) {
    var p = document.createElement('p');
    p.textContent = 'No campaigns yet.';
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
    tr.appendChild(td(c.TITLE));
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

function renderRewardsSummary(target, rewards) {
  var total = 0;
  var views = 0;
  var clicks = 0;
  for (var i = 0; i < rewards.length; i++) {
    total += parseFloat(rewards[i].AMOUNT || 0);
    if (rewards[i].TYPE === 'view') { views++; }
    else if (rewards[i].TYPE === 'click') { clicks++; }
  }
  var article = document.createElement('article');
  var strong = document.createElement('strong');
  strong.textContent = 'You earned: ';
  article.appendChild(strong);
  article.appendChild(document.createTextNode(
    total.toFixed(6) + ' MINIMA — ' + views + ' views / ' + clicks + ' clicks'
  ));
  target.appendChild(article);
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
