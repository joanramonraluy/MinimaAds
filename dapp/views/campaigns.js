// Campaigns view — DB campaigns + node-local L1 channel data.
// Summary cards:
//   Campaigns = count from DB (Maxima CAMPAIGN_ANNOUNCE)
//   Total budget = sum of BUDGET_TOTAL from DB
//   My open channels = channel coin count (this node, L1)
//   My active publishers = unique publisher keys from channel coins (this node, L1)
// Campaign list from local DB with filter Active/All.
// Per-campaign publisher count from PREVSTATE(2) of channel coins.
// Accessible from all modes (viewer, creator, publisher).

var _campaignsFilter = 'active'; // 'active' | 'all'

function renderCampaigns(root) {
  root.innerHTML = '';

  var h2 = document.createElement('h2');
  h2.textContent = 'Campaigns';
  h2.style.cssText = 'margin:0 0 1.5rem 0;padding:1rem;background:rgba(0,0,0,0.02);border-left:4px solid #8b5cf6;border-radius:0.375rem;';
  root.appendChild(h2);

  var summaryRow = document.createElement('div');
  summaryRow.id = 'ma-campaigns-summary';
  summaryRow.style.cssText = 'display:flex;gap:.75rem;flex-wrap:wrap;margin-bottom:1.5rem;padding:.75rem 1rem;border:1px solid var(--pico-border-color);border-radius:var(--pico-border-radius);background-color:rgba(0,0,0,0.015);border-left:3px solid #8b5cf6;';
  root.appendChild(summaryRow);

  var filterRow = document.createElement('div');
  filterRow.style.cssText = 'display:flex;gap:.5rem;margin-bottom:1rem;';
  filterRow.id = 'ma-campaigns-filter';
  root.appendChild(filterRow);

  var listSection = document.createElement('div');
  listSection.id = 'ma-campaigns-list';
  root.appendChild(listSection);

  _renderCampaignsFilter();
  _loadCampaigns();
}

function _renderCampaignsFilter() {
  var filterRow = document.getElementById('ma-campaigns-filter');
  if (!filterRow) { return; }
  filterRow.innerHTML = '';

  var filters = [
    { key: 'active', label: 'Active' },
    { key: 'all',    label: 'All' }
  ];
  for (var i = 0; i < filters.length; i++) {
    (function(f) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = f.label;
      btn.style.cssText = 'padding:.3rem .85rem;font-size:.8rem;width:auto;';
      if (_campaignsFilter === f.key) {
        btn.className = '';
      } else {
        btn.className = 'outline secondary';
      }
      btn.addEventListener('click', function() {
        _campaignsFilter = f.key;
        _renderCampaignsFilter();
        _loadCampaigns();
      });
      filterRow.appendChild(btn);
    })(filters[i]);
  }
}

function _loadCampaigns() {
  var listEl = document.getElementById('ma-campaigns-list');
  if (!listEl) { return; }
  listEl.innerHTML = '';

  var loading = document.createElement('p');
  loading.setAttribute('aria-busy', 'true');
  loading.style.cssText = 'color:var(--pico-muted-color,#6c757d);padding:1rem;margin:0;';
  loading.textContent = 'Loading campaigns…';
  listEl.appendChild(loading);

  var sql = 'SELECT c.ID, c.TITLE, c.CREATOR_ADDRESS, c.BUDGET_TOTAL, c.BUDGET_REMAINING, c.REWARD_VIEW, '
    + 'c.REWARD_CLICK, c.STATUS, c.MAX_VIEWER_REWARD, c.EXPIRES_AT, c.PUBLISHER_REWARD_VIEW, c.CREATOR_MX, c.MAX_PUBLISHER_BUDGET, c.PUBLISHER_BUDGET_SPENT, c.VIEWER_BUDGET_SPENT, c.PUBLISHER_BUDGET_EARNED, '
    + 'a.ID AS AD_ID, a.TITLE AS AD_TITLE, a.BODY AS AD_BODY, '
    + 'a.CTA_LABEL AS AD_CTA_LABEL, a.CTA_URL AS AD_CTA_URL, '
    + 'a.IMAGE_DATA, a.SHOW_TITLE, a.SHOW_BODY, a.SHOW_CTA, '
    + 'a.BG_COLOR, a.TEXT_COLOR, a.IMAGE_POSITION, a.IMAGE_ZOOM, a.IMAGE_WIDTH_PCT, '
    + 'cs.CUMULATIVE_EARNED AS USER_CUMULATIVE, cs.MAX_AMOUNT AS USER_MAX_AMOUNT, cs.STATUS AS USER_CHANNEL_STATUS '
    + 'FROM CAMPAIGNS c '
    + 'LEFT JOIN ADS a ON UPPER(a.CAMPAIGN_ID) = UPPER(c.ID) '
    + "LEFT JOIN CHANNEL_STATE cs ON UPPER(cs.CAMPAIGN_ID) = UPPER(c.ID) AND UPPER(cs.VIEWER_KEY) = UPPER('" + escapeSql(MY_ADDRESS || '') + "') AND cs.ROLE = 'viewer'";
  if (_campaignsFilter === 'active') {
    sql += " WHERE UPPER(c.STATUS) = 'ACTIVE'";
  }
  sql += ' ORDER BY c.STATUS ASC, c.TITLE ASC';

  sqlQuery(sql, function(err, rows) {
    if (err) {
      listEl.innerHTML = '';
      var errP = document.createElement('p');
      errP.style.cssText = 'color:var(--pico-del-color,#c0392b);padding:1rem;margin:0;';
      errP.textContent = 'Error loading campaigns.';
      listEl.appendChild(errP);
      return;
    }

    var campaigns = rows || [];
    _updateCampaignsSummary(campaigns);

    if (campaigns.length === 0) {
      listEl.innerHTML = '';
      var empty = mkEmptyState('No campaigns found.', null, null);
      listEl.appendChild(empty);
      return;
    }

    _renderCampaignsList(listEl, campaigns);
    _loadEscrowInfoForActiveCampaigns(campaigns);
  });
}

function _renderCampaignsList(listEl, campaigns) {
  if (!listEl) { return; }
  listEl.innerHTML = '';

  var wrapper = document.createElement('div');
  wrapper.style.cssText = 'border:1px solid var(--pico-muted-border-color,#ddd);border-radius:var(--pico-border-radius);overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);';

  var arr = campaigns || [];
  for (var i = 0; i < arr.length; i++) {
    wrapper.appendChild(_buildCampaignsRow(arr[i]));
  }
  listEl.appendChild(wrapper);
}

function _updateCampaignsSummary(campaigns) {
  var summaryEl = document.getElementById('ma-campaigns-summary');
  if (!summaryEl) { return; }
  summaryEl.innerHTML = '';

  var filtered = _campaignsFilter === 'active'
    ? campaigns.filter(function(c) { return (c.STATUS || '').toUpperCase() === 'ACTIVE'; })
    : campaigns;

  var count = filtered.length;
  var totalFunded = filtered.reduce(function(sum, c) { return sum + (parseFloat(c.BUDGET_TOTAL) || 0); }, 0);
  var totalAvail  = filtered.reduce(function(sum, c) { return sum + (parseFloat(c.BUDGET_REMAINING) || 0); }, 0);

  var defs = [
    { id: 'ma-cstat-campaigns', label: 'Campaigns',    value: String(count) },
    { id: 'ma-cstat-funded',    label: 'Total funded', value: fmtAmt(totalFunded, 2) + ' MINIMA' },
    { id: 'ma-cstat-available', label: 'Available',    value: fmtAmt(totalAvail, 2) + ' MINIMA' }
  ];

  // Viewer-specific: personal earnings cards
  if (_activeMode === 'viewer') {
    defs.push({ id: 'ma-earned-today', label: 'Today earned', value: '—' });
    defs.push({ id: 'ma-earned-total', label: 'Total earned',  value: '—' });
  }

  for (var i = 0; i < defs.length; i++) {
    var card = mkStatCard(defs[i].label, defs[i].value);
    card.id = defs[i].id;
    summaryEl.appendChild(card);
  }

  if (_activeMode === 'viewer') { _loadViewerEarned(); }
}

function _loadViewerEarned() {
  if (!MY_ADDRESS) { return; }

  var todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  var todayMs = todayStart.getTime();

  var sqlToday = "SELECT COALESCE(SUM(AMOUNT), 0) AS EARNED FROM REWARD_EVENTS"
    + " WHERE UPPER(USER_ADDRESS) = UPPER('" + escapeSql(MY_ADDRESS) + "')"
    + " AND TIMESTAMP >= " + todayMs;

  sqlQuery(sqlToday, function(err1, rows1) {
    var today = (!err1 && rows1 && rows1[0]) ? (parseFloat(rows1[0].EARNED) || 0) : 0;
    _setStatCard('ma-earned-today', fmtAmt(today, 6) + ' MINIMA');
  });

  var sqlTotal = "SELECT COALESCE(TOTAL_EARNED, 0) AS EARNED FROM USER_PROFILE"
    + " WHERE UPPER(ADDRESS) = UPPER('" + escapeSql(MY_ADDRESS) + "')";

  sqlQuery(sqlTotal, function(err2, rows2) {
    var total = (!err2 && rows2 && rows2[0]) ? (parseFloat(rows2[0].EARNED) || 0) : 0;
    _setStatCard('ma-earned-total', fmtAmt(total, 6) + ' MINIMA');
  });
}

function _setStatCard(id, value) {
  var card = document.getElementById(id);
  if (!card) { return; }
  var strong = card.querySelector('strong');
  if (strong) { strong.textContent = value; }
}


function _buildCampaignsRow(campaign) {
  var isViewer = (_activeMode === 'viewer');
  var isClickable = isViewer
    && (campaign.STATUS || '').toUpperCase() === 'ACTIVE'
    && typeof _openCampaign === 'function'
    && MY_ADDRESS
    && (campaign.CREATOR_ADDRESS || '').toUpperCase() !== MY_ADDRESS.toUpperCase()
    && parseFloat(campaign.BUDGET_REMAINING) >= parseFloat(campaign.REWARD_VIEW);

  var row = document.createElement(isClickable ? 'button' : 'div');
  if (isClickable) {
    row.type = 'button';
    row.addEventListener('click', function() { window.location.hash = 'campaign-detail?id=' + campaign.ID; });
    row.addEventListener('mouseover', function() {
      row.style.background = document.documentElement.getAttribute('data-theme') === 'dark'
        ? 'rgba(255,255,255,.06)' : 'rgba(15,23,42,.05)';
    });
    row.addEventListener('mouseout', function() { row.style.background = 'transparent'; });
  }
  row.style.cssText = 'display:flex;align-items:center;gap:.85rem;width:100%;'
    + 'padding:.85rem;background:transparent;text-align:left;color:inherit;'
    + (isClickable ? 'cursor:pointer;border:none;border-radius:0;box-shadow:none;margin:0;' : '')
    + 'border-bottom:1px solid var(--pico-muted-border-color,#ddd);';

  var hue = 0;
  var cid = campaign.ID || '';
  for (var ci = 0; ci < cid.length; ci++) { hue = (hue + cid.charCodeAt(ci)) % 360; }

  var letter = (campaign.AD_TITLE || campaign.TITLE || '?').charAt(0).toUpperCase();

  var avatar = document.createElement('div');
  avatar.style.cssText = 'width:2.75rem;height:2.75rem;min-width:2.75rem;border-radius:50%;'
    + 'display:flex;align-items:center;justify-content:center;'
    + 'font-weight:700;font-size:1.1rem;color:#fff;'
    + 'background:hsl(' + hue + ',52%,46%);';
  avatar.textContent = letter;

  var textDiv = document.createElement('div');
  textDiv.style.cssText = 'flex:1;min-width:0;';

  var titleRow = document.createElement('div');
  titleRow.style.cssText = 'display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;';

  var titleEl = document.createElement('div');
  titleEl.style.cssText = 'font-weight:600;font-size:.95rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
  titleEl.textContent = DOMPurify.sanitize(campaign.AD_TITLE || campaign.TITLE || 'Untitled');
  titleRow.appendChild(titleEl);

  var statusBadge = mkStatusBadge(campaign.STATUS);
  titleRow.appendChild(statusBadge);

  if (isViewer && campaign.USER_CHANNEL_STATUS) {
    var cStatus = campaign.USER_CHANNEL_STATUS || '';
    if (cStatus === 'open' || cStatus === 'pending') {
      var cumulative = parseFloat(campaign.USER_CUMULATIVE) || 0;
      var maxAmount = parseFloat(campaign.USER_MAX_AMOUNT) || 0;
      var reward = parseFloat(campaign.REWARD_VIEW) || 0;
      if (cumulative + reward > maxAmount) {
        var limitBadge = mkStatusBadge('completed');
        titleRow.appendChild(limitBadge);
      }
    }
  }

  textDiv.appendChild(titleRow);

  var bodyRaw = ((campaign.AD_BODY || '') + '').replace(/\s+/g, ' ').trim();
  if (bodyRaw) {
    var bodyEl = document.createElement('div');
    bodyEl.style.cssText = 'color:var(--pico-muted-color,#6c757d);font-size:.82rem;'
      + 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:.1rem;';
    bodyEl.textContent = DOMPurify.sanitize(bodyRaw.length > 60 ? bodyRaw.substring(0, 60) + '…' : bodyRaw);
    textDiv.appendChild(bodyEl);
  }

  var metaRow = document.createElement('div');
  metaRow.style.cssText = 'display:flex;gap:.75rem;align-items:center;flex-wrap:wrap;margin-top:.2rem;';

  var rv = parseFloat(campaign.REWARD_VIEW) || 0;
  var rc = parseFloat(campaign.REWARD_CLICK) || 0;
  var rewardText = fmtAmt(rv, 3) + ' MINIMA/view';
  if (rc > 0) { rewardText += '  ·  ' + fmtAmt(rc, 3) + '/click'; }
  var rewardEl = document.createElement('span');
  rewardEl.style.cssText = 'font-size:.75rem;color:var(--pico-primary,#6366f1);';
  rewardEl.textContent = rewardText;
  metaRow.appendChild(rewardEl);

  textDiv.appendChild(metaRow);

  var budgetRow = document.createElement('div');
  budgetRow.style.cssText = 'margin-top:.35rem;';
  var budgetLabel = document.createElement('small');
  budgetLabel.style.cssText = 'display:block;font-size:.7rem;color:var(--pico-muted-color,#6c757d);text-transform:uppercase;letter-spacing:.04em;margin-bottom:.1rem;';
  budgetLabel.textContent = 'Budget remaining';
  var budgetVal = document.createElement('strong');
  budgetVal.style.cssText = 'font-size:.95rem;color:var(--pico-primary,#6366f1);';
  budgetVal.textContent = fmtAmt(parseFloat(campaign.BUDGET_REMAINING || 0), 4) + ' MINIMA';
  budgetRow.appendChild(budgetLabel);
  budgetRow.appendChild(budgetVal);
  textDiv.appendChild(budgetRow);

  row.appendChild(avatar);
  row.appendChild(textDiv);

  if (isClickable) {
    var arrow = document.createElement('span');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.style.cssText = 'color:var(--pico-muted-color,#6c757d);font-size:1.2rem;flex-shrink:0;';
    arrow.textContent = '›';
    row.appendChild(arrow);
  }

  return row;
}

// Request escrow info (budget, escrow remaining) from active campaign creators via Maxima.
// Updates CAMPAIGNS table when responses arrive.
function _loadEscrowInfoForActiveCampaigns(campaigns) {
  if (!campaigns || campaigns.length === 0) { return; }

  var myAddr = MY_ADDRESS ? MY_ADDRESS.toUpperCase() : '';

  var activeCampaigns = campaigns.filter(function(c) {
    return (c.STATUS || '').toUpperCase() === 'ACTIVE';
  });

  for (var i = 0; i < activeCampaigns.length; i++) {
    (function(campaign) {
      var campaignId = campaign.ID || '';
      var creatorAddr = (campaign.CREATOR_ADDRESS || '').toUpperCase();

      if (myAddr && creatorAddr === myAddr) {
        // Own campaign — calculate viewer_budget_spent directly from local DB
        _updateOwnCampaignViewerSpent(campaignId);
        return;
      }

      var creatorMx = campaign.CREATOR_MX || '';
      if (!campaignId || !creatorMx) { return; }

      _sendEscrowInfoRequest(campaignId, creatorMx);
    })(activeCampaigns[i]);
  }
}

function _updateOwnCampaignViewerSpent(campaignId) {
  var eid = escapeSql(campaignId);

  sqlQuery("SELECT COALESCE(SUM(CUMULATIVE_EARNED),0) AS E FROM CHANNEL_STATE WHERE UPPER(CAMPAIGN_ID)=UPPER('" + eid + "') AND ROLE='viewer'", function(e1, r1) {
  var va = (!e1 && r1 && r1[0]) ? (parseFloat(r1[0].E) || 0) : 0;

  sqlQuery("SELECT COALESCE(SUM(CUMULATIVE_EARNED),0) AS E FROM CHANNEL_HISTORY WHERE UPPER(CAMPAIGN_ID)=UPPER('" + eid + "') AND ROLE='viewer'", function(e2, r2) {
  var vh = (!e2 && r2 && r2[0]) ? (parseFloat(r2[0].E) || 0) : 0;

  sqlQuery("SELECT COALESCE(SUM(CUMULATIVE_EARNED),0) AS E FROM CHANNEL_STATE WHERE UPPER(CAMPAIGN_ID)=UPPER('" + eid + "') AND ROLE='publisher'", function(e3, r3) {
  var pa = (!e3 && r3 && r3[0]) ? (parseFloat(r3[0].E) || 0) : 0;

  sqlQuery("SELECT COALESCE(SUM(CUMULATIVE_EARNED),0) AS E FROM CHANNEL_HISTORY WHERE UPPER(CAMPAIGN_ID)=UPPER('" + eid + "') AND ROLE='publisher'", function(e4, r4) {
  var ph = (!e4 && r4 && r4[0]) ? (parseFloat(r4[0].E) || 0) : 0;

  sqlQuery("UPDATE CAMPAIGNS SET VIEWER_BUDGET_SPENT = " + (va + vh)
    + ", PUBLISHER_BUDGET_EARNED = " + (pa + ph)
    + " WHERE UPPER(ID) = UPPER('" + eid + "')", function() {});
  });
  });
  });
  });
}

function _sendEscrowInfoRequest(campaignId, creatorMxAddress) {
  if (!campaignId || !creatorMxAddress) { return; }
  if (typeof MDS === 'undefined') { return; }

  var payload = JSON.stringify({
    type: 'ESCROW_INFO_REQUEST',
    campaign_id: campaignId,
    requester_mx: MY_MX_ADDRESS
  });
  var hex = '0x' + utf8ToHex(payload).toUpperCase();
  var cmd = 'maxima action:send to:' + creatorMxAddress
    + ' application:' + APP_NAME
    + ' data:' + hex
    + ' poll:false';

  MDS.cmd(cmd, function() {});
}
