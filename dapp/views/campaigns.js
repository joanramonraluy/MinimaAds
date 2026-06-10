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
    + 'c.REWARD_CLICK, c.STATUS, c.PUBLISHER_REWARD_VIEW, c.CREATOR_MX, c.MAX_PUBLISHER_BUDGET, c.PUBLISHER_BUDGET_SPENT, '
    + 'a.TITLE AS AD_TITLE, a.BODY AS AD_BODY '
    + 'FROM CAMPAIGNS c LEFT JOIN ADS a ON UPPER(a.CAMPAIGN_ID) = UPPER(c.ID)';
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
      if (_activeMode === 'creator') { _loadL1ChannelData(campaigns, function() {}); }
      return;
    }

    if (_activeMode === 'creator') {
      _loadL1ChannelData(campaigns, function(pubCountMap) {
        _renderCampaignsList(listEl, campaigns, pubCountMap);
        _loadEscrowInfoForActiveCampaigns(campaigns);
      });
    } else {
      _renderCampaignsList(listEl, campaigns, {});
      _loadEscrowInfoForActiveCampaigns(campaigns);
    }
  });
}

function _renderCampaignsList(listEl, campaigns, pubCountMap) {
  if (!listEl) { return; }
  if (listEl.id !== 'ma-campaigns-list') { return; } // Safety check
  listEl.innerHTML = '';

  var wrapper = document.createElement('div');
  wrapper.style.cssText = 'border:1px solid var(--pico-muted-border-color,#ddd);border-radius:var(--pico-border-radius);overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);';

  var campaigns_arr = campaigns || [];
  for (var i = 0; i < campaigns_arr.length; i++) {
    wrapper.appendChild(_buildCampaignsRow(campaigns_arr[i], pubCountMap));
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
  var totalBudget = filtered.reduce(function(sum, c) { return sum + (parseFloat(c.BUDGET_TOTAL) || 0); }, 0);

  var defs = [
    { id: 'ma-cstat-campaigns',  label: 'Campaigns', value: String(count) },
    { id: 'ma-cstat-budget',     label: 'Market budget', value: fmtAmt(totalBudget, 2) + ' MINIMA' }
  ];

  // Creator sees split L1 channel metrics (viewer vs publisher)
  if (_activeMode === 'creator') {
    defs.push({ id: 'ma-cstat-viewer-channels',    label: 'My viewer channels', value: '…' });
    defs.push({ id: 'ma-cstat-publisher-channels', label: 'My publisher channels', value: '…' });
  }

  for (var i = 0; i < defs.length; i++) {
    var card = mkStatCard(defs[i].label, defs[i].value);
    card.id = defs[i].id;
    summaryEl.appendChild(card);
  }
}

function _setStatCard(id, value) {
  var card = document.getElementById(id);
  if (!card) { return; }
  var strong = card.querySelector('strong');
  if (strong) { strong.textContent = value; }
}

function _loadL1ChannelData(campaigns, cb) {
  var campHexMap = {};
  for (var i = 0; i < campaigns.length; i++) {
    var hexId = ('0x' + utf8ToHex(campaigns[i].ID)).toUpperCase();
    campHexMap[hexId] = campaigns[i].ID;
  }

  // Load role map from DB: VIEWER_KEY → 'viewer' | 'publisher'
  sqlQuery("SELECT DISTINCT UPPER(VIEWER_KEY) AS VIEWER_KEY, ROLE FROM CHANNEL_STATE", function(dbErr, roleRows) {
    var roleMap = {};
    if (!dbErr && roleRows) {
      for (var ri = 0; ri < roleRows.length; ri++) {
        if (roleRows[ri].VIEWER_KEY) {
          roleMap[roleRows[ri].VIEWER_KEY] = (roleRows[ri].ROLE || 'viewer').toLowerCase();
        }
      }
    }

    MDS.keypair.get('CHANNEL_SCRIPT_ADDRESS', function(r4) {
      var channelAddr = (r4 && r4.status) ? r4.value : '';
      if (!channelAddr) {
        _setStatCard('ma-cstat-viewer-channels', '0');
        _setStatCard('ma-cstat-publisher-channels', '0');
        cb({});
        return;
      }

      MDS.cmd('coins address:' + channelAddr, function(res) {
        var chCoins = (res && res.status && res.response) ? res.response : [];
        var pubCountMap = {};
        var viewerChannelCount = 0;
        var publisherChannelCount = 0;

        for (var ci = 0; ci < chCoins.length; ci++) {
          var states = chCoins[ci].state || [];
          var campHex = '';
          var coinKey = '';
          for (var si = 0; si < states.length; si++) {
            if (states[si].port == 3) { campHex = (states[si].data || '').toUpperCase(); }
            if (states[si].port == 2) { coinKey  = (states[si].data || '').toUpperCase(); }
          }
          if (!coinKey) { continue; }

          // Split by role for summary cards
          var role = roleMap[coinKey] || 'viewer';
          if (role === 'publisher') {
            publisherChannelCount++;
          } else {
            viewerChannelCount++;
          }

          // pubCountMap: count all open channels per campaign (both roles)
          if (campHex && campHexMap[campHex]) {
            var cid = campHexMap[campHex];
            if (!pubCountMap[cid]) { pubCountMap[cid] = {}; }
            pubCountMap[cid][coinKey] = true;
          }
        }

        _setStatCard('ma-cstat-viewer-channels', String(viewerChannelCount));
        _setStatCard('ma-cstat-publisher-channels', String(publisherChannelCount));
        cb(pubCountMap);
      });
    });
  });
}

function _buildCampaignsRow(campaign, pubCountMap) {
  var row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;gap:.85rem;'
    + 'padding:.85rem;background:transparent;'
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

  var budgetEl = document.createElement('span');
  budgetEl.style.cssText = 'font-size:.75rem;color:var(--pico-muted-color,#6c757d);';
  budgetEl.textContent = fmtAmt(parseFloat(campaign.BUDGET_REMAINING || 0), 4) + ' left';
  metaRow.appendChild(budgetEl);

  // Calculate and display escrow_left (budget_remaining + publisher_budget_remaining)
  var maxPubBudget = parseFloat(campaign.MAX_PUBLISHER_BUDGET) || 0;
  var pubBudgetSpent = parseFloat(campaign.PUBLISHER_BUDGET_SPENT) || 0;
  var budgetRemaining = parseFloat(campaign.BUDGET_REMAINING) || 0;
  var pubBudgetRemaining = maxPubBudget - pubBudgetSpent;
  var escrowLeft = budgetRemaining + pubBudgetRemaining;

  if (escrowLeft > 0) {
    var escrowEl = document.createElement('span');
    escrowEl.style.cssText = 'font-size:.75rem;color:var(--pico-primary,#6366f1);font-weight:500;';
    escrowEl.textContent = 'Escrow: ' + fmtAmt(escrowLeft, 4) + ' MINIMA';
    metaRow.appendChild(escrowEl);
  }

  textDiv.appendChild(metaRow);

  var pubCount = pubCountMap[campaign.ID] ? Object.keys(pubCountMap[campaign.ID]).length : 0;
  var pubBadge = document.createElement('div');
  pubBadge.style.cssText = 'display:flex;flex-direction:column;align-items:center;min-width:3rem;flex-shrink:0;';
  var pubNum = document.createElement('span');
  pubNum.style.cssText = 'font-weight:700;font-size:1rem;color:#8b5cf6;';
  pubNum.textContent = String(pubCount);
  var pubLabel = document.createElement('span');
  pubLabel.style.cssText = 'font-size:.65rem;color:var(--pico-muted-color,#6c757d);text-align:center;line-height:1.2;margin-top:.1rem;';
  pubLabel.textContent = pubCount === 1 ? 'publisher' : 'publishers';
  pubBadge.appendChild(pubNum);
  pubBadge.appendChild(pubLabel);

  row.appendChild(avatar);
  row.appendChild(textDiv);
  row.appendChild(pubBadge);

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

      // Own campaign — data is already fresh in local DB, no Maxima needed
      if (myAddr && creatorAddr === myAddr) { return; }

      var creatorMx = campaign.CREATOR_MX || '';
      if (!campaignId || !creatorMx) { return; }

      _sendEscrowInfoRequest(campaignId, creatorMx);
    })(activeCampaigns[i]);
  }
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
