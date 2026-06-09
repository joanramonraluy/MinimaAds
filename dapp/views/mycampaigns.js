// My Campaigns view — creator dashboard.
// Route: #mycampaigns (Creator mode only).
// Shows per-campaign metrics (views, clicks) from REWARD_EVENTS and management actions.
// Actions (pause/resume/finish) migrated here from the provisional section in creator.js (Sessió 5).
// Sessió 9: Chart.js line chart inside a <details> per card, auto-refresh every 30s.
// M4: table → campaign cards with status badge, stat cards, budget progress bar.
// M5: Pending settlement + Settled channels expandable sections per card.

var _expandedCharts   = {};   // campaignId → Chart instance

function renderMyCampaigns(root) {
  _destroyAllCharts();

  root.innerHTML = '';
  var h2 = document.createElement('h2');
  h2.textContent = 'My Campaigns';
  h2.style.cssText = 'margin:0 0 1.5rem 0;padding:1rem;background:rgba(0,0,0,0.02);border-left:4px solid #f59e0b;border-radius:0.375rem;';
  root.appendChild(h2);
  var section = document.createElement('section');
  section.id = 'ma-mycampaigns-section';
  root.appendChild(section);
  loadMyCampaigns(false);
}

function _destroyAllCharts() {
  for (var id in _expandedCharts) {
    if (_expandedCharts[id]) { _expandedCharts[id].destroy(); }
  }
  _expandedCharts = {};
}

function loadMyCampaigns(isAutoRefresh) {
  var section = document.getElementById('ma-mycampaigns-section');
  if (!section || !MY_ADDRESS) { return; }

  // Save the open states of any expanded details blocks
  var openDetails = {};
  var cards = section.querySelectorAll('*[data-campaign-id]');
  for (var i = 0; i < cards.length; i++) {
    var cId = cards[i].getAttribute('data-campaign-id');
    if (cards[i].tagName.toLowerCase() === 'details' && cards[i].open) {
      openDetails[cId + '-campaign-card'] = true;
    }
    var detailsList = cards[i].querySelectorAll('details');
    for (var j = 0; j < detailsList.length; j++) {
      var detId = detailsList[j].getAttribute('data-details-id') || (detailsList[j].querySelector('summary') ? detailsList[j].querySelector('summary').textContent : '');
      if (detId && detailsList[j].open) {
        openDetails[cId + '-' + detId] = true;
      }
    }
  }

  if (!isAutoRefresh) {
    _destroyAllCharts();
    section.innerHTML = '';
    section.appendChild(mkLoading('Loading campaigns…'));
  }

  var sql = "SELECT c.*, a.TITLE AS AD_TITLE, a.BODY, a.CTA_LABEL, a.CTA_URL, a.IMAGE_DATA, a.SHOW_TITLE, a.SHOW_BODY, a.SHOW_CTA, a.BG_COLOR, a.TEXT_COLOR, a.IMAGE_POSITION, a.IMAGE_ZOOM, a.IMAGE_WIDTH_PCT,"
    + " (SELECT COUNT(*) FROM REWARD_EVENTS re WHERE UPPER(re.CAMPAIGN_ID) = UPPER(c.ID) AND re.TYPE = 'view') AS VIEW_COUNT,"
    + " (SELECT COUNT(*) FROM REWARD_EVENTS re WHERE UPPER(re.CAMPAIGN_ID) = UPPER(c.ID) AND re.TYPE = 'click') AS CLICK_COUNT,"
    + " (SELECT COUNT(DISTINCT re.USER_ADDRESS) FROM REWARD_EVENTS re WHERE UPPER(re.CAMPAIGN_ID) = UPPER(c.ID) AND re.TYPE IN ('view', 'click')) AS UNIQUE_VIEWERS,"
    + " (SELECT COUNT(DISTINCT UPPER(re.USER_ADDRESS)) FROM REWARD_EVENTS re WHERE UPPER(re.CAMPAIGN_ID) = UPPER(c.ID) AND re.TYPE = 'publisher_view') AS UNIQUE_PUBLISHERS,"
    // ── Viewer stats ──
    + " (SELECT COALESCE(SUM(MAX_AMOUNT), 0) FROM CHANNEL_STATE cs WHERE UPPER(cs.CAMPAIGN_ID) = UPPER(c.ID) AND cs.STATUS IN ('open', 'pending') AND cs.ROLE = 'viewer') AS VIEWER_LOCKED,"
    + " (SELECT COALESCE(SUM(CUMULATIVE_EARNED), 0) FROM CHANNEL_STATE cs WHERE UPPER(cs.CAMPAIGN_ID) = UPPER(c.ID) AND cs.STATUS IN ('open', 'pending') AND cs.ROLE = 'viewer') AS VIEWER_UNSETTLED,"
    + " (SELECT COALESCE(SUM(CUMULATIVE_EARNED), 0) FROM CHANNEL_HISTORY ch WHERE UPPER(ch.CAMPAIGN_ID) = UPPER(c.ID) AND ch.STATUS = 'settled' AND ch.ROLE = 'viewer') AS VIEWER_SETTLED,"
    + " (SELECT COUNT(*) FROM CHANNEL_STATE cs WHERE UPPER(cs.CAMPAIGN_ID) = UPPER(c.ID) AND cs.STATUS IN ('open', 'pending') AND cs.ROLE = 'viewer') AS VIEWER_ACTIVE_COUNT,"
    + " (SELECT COUNT(*) FROM CHANNEL_HISTORY ch WHERE UPPER(ch.CAMPAIGN_ID) = UPPER(c.ID) AND ch.STATUS = 'settled' AND ch.ROLE = 'viewer') AS VIEWER_SETTLED_COUNT,"
    // ── Publisher stats ──
    + " (SELECT COALESCE(SUM(MAX_AMOUNT), 0) FROM CHANNEL_STATE cs WHERE UPPER(cs.CAMPAIGN_ID) = UPPER(c.ID) AND cs.STATUS IN ('open', 'pending') AND cs.ROLE = 'publisher') AS PUB_LOCKED,"
    + " (SELECT COALESCE(SUM(CUMULATIVE_EARNED), 0) FROM CHANNEL_STATE cs WHERE UPPER(cs.CAMPAIGN_ID) = UPPER(c.ID) AND cs.STATUS IN ('open', 'pending') AND cs.ROLE = 'publisher') AS PUB_UNSETTLED,"
    + " (SELECT COALESCE(SUM(CUMULATIVE_EARNED), 0) FROM CHANNEL_HISTORY ch WHERE UPPER(ch.CAMPAIGN_ID) = UPPER(c.ID) AND ch.STATUS = 'settled' AND ch.ROLE = 'publisher') AS PUB_SETTLED,"
    + " (SELECT COUNT(*) FROM CHANNEL_STATE cs WHERE UPPER(cs.CAMPAIGN_ID) = UPPER(c.ID) AND cs.STATUS IN ('open', 'pending') AND cs.ROLE = 'publisher') AS PUB_ACTIVE_COUNT,"
    + " (SELECT COUNT(*) FROM CHANNEL_HISTORY ch WHERE UPPER(ch.CAMPAIGN_ID) = UPPER(c.ID) AND ch.STATUS = 'settled' AND ch.ROLE = 'publisher') AS PUB_SETTLED_COUNT,"
    // ── Publisher actual spent ──
    + " (SELECT COALESCE(SUM(re.AMOUNT), 0) FROM REWARD_EVENTS re WHERE UPPER(re.CAMPAIGN_ID) = UPPER(c.ID) AND re.TYPE = 'publisher_view') AS PUB_SPENT_ACTUAL"
    + " FROM CAMPAIGNS c"
    + " LEFT JOIN ADS a ON UPPER(c.ID) = UPPER(a.CAMPAIGN_ID)"
    + " WHERE UPPER(c.CREATOR_ADDRESS) = UPPER('" + escapeSql(MY_ADDRESS) + "')"
    + " ORDER BY c.CREATED_AT DESC";

  sqlQuery(sql, function(err, rows) {
    var target = document.getElementById('ma-mycampaigns-section');
    if (!target) { return; }

    if (err) {
      if (!isAutoRefresh) {
        target.innerHTML = '';
        var errEl = document.createElement('p');
        errEl.textContent = 'Error loading campaigns: ' + err;
        target.appendChild(errEl);
      }
      return;
    }

    if (!rows || rows.length === 0) {
      target.innerHTML = '';
      target.appendChild(mkEmptyState(
        'No campaigns yet.',
        'Create your first campaign',
        '#creator'
      ));
      return;
    }

    _destroyAllCharts();

    var fragment = document.createDocumentFragment();
    for (var i = 0; i < rows.length; i++) {
      fragment.appendChild(_buildCampaignCard(rows[i], openDetails));
    }

    target.innerHTML = '';
    target.appendChild(fragment);
  });
}

function _buildCampaignCard(c, openDetails) {
  var budgetTotal          = parseFloat(c.BUDGET_TOTAL || 0);
  var budgetRemaining      = parseFloat(c.BUDGET_REMAINING || 0);
  
  var viewerLocked         = parseFloat(c.VIEWER_LOCKED || 0);
  var viewerUnsettled      = parseFloat(c.VIEWER_UNSETTLED || 0);
  var viewerSettled        = parseFloat(c.VIEWER_SETTLED || 0);
  var viewerActiveCount    = parseInt(c.VIEWER_ACTIVE_COUNT || 0, 10);
  var viewerSettledCount   = parseInt(c.VIEWER_SETTLED_COUNT || 0, 10);
  
  var pubLocked            = parseFloat(c.PUB_LOCKED || 0);
  var pubUnsettled         = parseFloat(c.PUB_UNSETTLED || 0);
  var pubSettled           = parseFloat(c.PUB_SETTLED || 0);
  var pubActiveCount       = parseInt(c.PUB_ACTIVE_COUNT || 0, 10);
  var pubSettledCount      = parseInt(c.PUB_SETTLED_COUNT || 0, 10);
  var pubSpentActual       = parseFloat(c.PUB_SPENT_ACTUAL || 0);

  var unspentBudget        = budgetTotal - (viewerSettled + viewerUnsettled + pubSettled + pubUnsettled);
  if (unspentBudget < 0) { unspentBudget = 0; }
  
  var maxPubBudget         = parseFloat(c.MAX_PUBLISHER_BUDGET || 0);
  var pubRemaining         = maxPubBudget - (pubSettled + pubUnsettled);
  if (pubRemaining < 0) { pubRemaining = 0; }

  var budgetSpent          = budgetTotal - budgetRemaining;
  var budgetPct            = budgetTotal > 0 ? (budgetSpent / budgetTotal) * 100 : 0;
  var viewCount            = parseInt(c.VIEW_COUNT || 0, 10);
  var clickCount           = parseInt(c.CLICK_COUNT || 0, 10);
  var uniqueViewers        = parseInt(c.UNIQUE_VIEWERS || 0, 10);
  var uniquePublishers     = parseInt(c.UNIQUE_PUBLISHERS || 0, 10);

  // Main campaign details block
  var card = document.createElement('details');
  card.className = 'ma-campaign-card-details';
  card.setAttribute('data-campaign-id', c.ID);
  card.style.cssText = 'margin-bottom:1.5rem;border:1px solid var(--pico-border-color);border-radius:var(--pico-border-radius);background-color:var(--pico-card-background-color);box-shadow:var(--pico-card-box-shadow,0 1px 3px rgba(0,0,0,0.05));overflow:hidden;';

  // Card summary / header
  var cardSummary = document.createElement('summary');
  cardSummary.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:.75rem;flex-wrap:wrap;padding:.75rem 1rem;cursor:pointer;user-select:none;background-color:var(--pico-card-sectioning-background-color,rgba(0,0,0,0.02));border-bottom:1px solid transparent;';
  
  var badgeGroup = document.createElement('div');
  badgeGroup.className = 'ma-campaign-badge-group';
  badgeGroup.style.cssText = 'display:flex;align-items:center;gap:.5rem;min-width:0;flex:1;flex-wrap:wrap;';

  var titleEl = document.createElement('strong');
  titleEl.textContent = c.TITLE;
  titleEl.style.cssText = 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:16rem;font-size:1.05rem;';
  badgeGroup.appendChild(titleEl);
  badgeGroup.appendChild(mkStatusBadge(c.STATUS));

  // Quick stats in header
  var quickStats = document.createElement('small');
  quickStats.style.cssText = 'color:var(--pico-muted-color,#6c757d);font-size:.78rem;margin-left:.75rem;';
  quickStats.textContent = 'Views: ' + viewCount + ' • Clicks: ' + clickCount + ' • Escrow Left: ' + fmtAmt(budgetRemaining, 2) + ' M';
  badgeGroup.appendChild(quickStats);

  cardSummary.appendChild(badgeGroup);

  // Actions
  var actionsDiv = document.createElement('div');
  actionsDiv.style.cssText = 'display:flex;gap:.35rem;flex-shrink:0;align-items:center;';
  actionsDiv.addEventListener('click', function(e) {
    e.stopPropagation();
  });
  _appendCampaignActions(actionsDiv, c);
  cardSummary.appendChild(actionsDiv);

  card.appendChild(cardSummary);

  // Card body (visible when expanded)
  var cardBody = document.createElement('div');
  cardBody.style.cssText = 'padding:1rem;border-top:1px solid var(--pico-border-color);background-color:var(--pico-card-background-color);overflow:hidden;';

  // ── Performance row (card-style grouping) ────────────────────────────────
  var perfGroup = document.createElement('div');
  perfGroup.className = 'ma-section-group';
  perfGroup.style.cssText = 'margin-bottom:.75rem;padding:.75rem 1rem;border:1px solid var(--pico-border-color);border-radius:var(--pico-border-radius);background-color:rgba(0,0,0,0.015);border-left:3px solid #2ecc71;';

  var perfTitle = mkSectionTitle('Performance');
  perfTitle.style.cssText = 'display:block;font-size:.78rem;color:var(--pico-muted-color,#6c757d);margin-top:0;text-transform:uppercase;letter-spacing:.04em;';
  perfGroup.appendChild(perfTitle);

  var ctr = viewCount > 0 ? (clickCount / viewCount * 100) : 0;

  var perfRow = document.createElement('div');
  perfRow.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:.6rem;margin:.35rem 0 0;';
  perfRow.appendChild(mkStatCard('Views', String(viewCount)));
  perfRow.appendChild(mkStatCard('Clicks', String(clickCount)));
  perfRow.appendChild(mkStatCard('CTR', fmtAmt(ctr, 2) + '%'));
  perfRow.appendChild(mkStatCard('Viewers', String(uniqueViewers)));
  perfRow.appendChild(mkStatCard('Publishers', String(uniquePublishers)));
  perfGroup.appendChild(perfRow);
  cardBody.appendChild(perfGroup);

  // ── Budget Allocation (Collapsible, card-style) ──────────────────────────
  var budgetDetails = document.createElement('details');
  budgetDetails.className = 'ma-campaign-details';
  budgetDetails.setAttribute('data-details-id', 'budget-allocation');
  budgetDetails.style.cssText = 'margin-bottom:.75rem;padding:.75rem 1rem;border:1px solid var(--pico-border-color);border-radius:var(--pico-border-radius);background-color:rgba(0,0,0,0.015);border-left:3px solid #f39c12;';

  var budgetSummary = document.createElement('summary');
  budgetSummary.textContent = 'Budget Allocation';
  budgetSummary.className = 'ma-campaign-details-summary';
  budgetSummary.style.cssText = 'font-weight:600;cursor:pointer;margin:-.75rem -1rem .35rem;padding:.75rem 1rem;';
  budgetDetails.appendChild(budgetSummary);

  var budgetBody = document.createElement('div');
  budgetBody.style.cssText = 'margin-top:.5rem;';

  // ── Combined Totals ──
  var totalBudgetTitle = mkSectionTitle('Combined Totals');
  totalBudgetTitle.style.cssText = 'display:block;font-size:.78rem;color:var(--pico-muted-color,#6c757d);margin-top:0;text-transform:uppercase;letter-spacing:.04em;';
  budgetBody.appendChild(totalBudgetTitle);
  
  var totalBudgetRow = document.createElement('div');
  totalBudgetRow.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:.6rem;margin:.35rem 0 .75rem;';
  totalBudgetRow.appendChild(mkStatCard('Total Budget', fmtAmt(budgetTotal, 4) + ' M', 'Initial funding'));
  totalBudgetRow.appendChild(mkStatCard('Total Escrow Left', fmtAmt(budgetRemaining, 4) + ' M', 'Remaining in escrow'));
  totalBudgetRow.appendChild(mkStatCard('Total Locked', fmtAmt(viewerLocked + pubLocked, 4) + ' M', 'Reserved in L2 channels'));
  totalBudgetRow.appendChild(mkStatCard('Total Paid', fmtAmt(viewerSettled + pubSpentActual, 4) + ' M', 'On-chain settlements'));
  budgetBody.appendChild(totalBudgetRow);

  // ── Viewer Allocation ──
  var viewerBudgetTitle = mkSectionTitle('Budget Allocation (Viewer)');
  viewerBudgetTitle.style.cssText = 'display:block;font-size:.78rem;color:var(--pico-muted-color,#6c757d);margin-top:.75rem;text-transform:uppercase;letter-spacing:.04em;';
  budgetBody.appendChild(viewerBudgetTitle);

  var viewerBudgetRow = document.createElement('div');
  viewerBudgetRow.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:.6rem;margin:.35rem 0 .75rem;';
  
  var escrowCard = mkStatCard('Available (Escrow)', fmtAmt(budgetRemaining, 4) + ' M', 'Total campaign escrow');
  var lockedCard = mkStatCard('Locked in Channels', fmtAmt(viewerLocked, 4) + ' M', viewerActiveCount + ' active channel' + (viewerActiveCount === 1 ? '' : 's') + ' (' + fmtAmt(viewerUnsettled, 4) + ' M earned)');
  var settledCard = mkStatCard('Settled (Paid)', fmtAmt(viewerSettled, 4) + ' M', viewerSettledCount + ' settled channel' + (viewerSettledCount === 1 ? '' : 's') + ' (' + fmtAmt(viewerSettled, 4) + ' M paid)');
  var unspentCard = mkStatCard('Unspent Campaign', fmtAmt(unspentBudget, 4) + ' M', 'Initial: ' + fmtAmt(budgetTotal, 4) + ' M');
  
  viewerBudgetRow.appendChild(escrowCard);
  viewerBudgetRow.appendChild(lockedCard);
  viewerBudgetRow.appendChild(settledCard);
  viewerBudgetRow.appendChild(unspentCard);
  budgetBody.appendChild(viewerBudgetRow);

  // ── Publisher Allocation ──
  if (maxPubBudget > 0) {
    var pubBudgetTitle = mkSectionTitle('Budget Allocation (Publisher)');
    pubBudgetTitle.style.cssText = 'display:block;font-size:.78rem;color:var(--pico-muted-color,#6c757d);margin-top:.75rem;text-transform:uppercase;letter-spacing:.04em;';
    budgetBody.appendChild(pubBudgetTitle);

    var pubBudgetRow = document.createElement('div');
    pubBudgetRow.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:.6rem;margin:.35rem 0 .75rem;';

    var pubLimitCard = mkStatCard('Max Pub Budget', fmtAmt(maxPubBudget, 4) + ' M', 'Configured limit');
    var pubReservedCard = mkStatCard('Budget Reserved', fmtAmt(parseFloat(c.PUBLISHER_BUDGET_SPENT || 0), 4) + ' M', pubActiveCount + ' active channel' + (pubActiveCount === 1 ? '' : 's') + ' (' + fmtAmt(pubUnsettled, 4) + ' M earned)');
    var pubSpentCard = mkStatCard('Budget Spent', fmtAmt(pubSpentActual, 4) + ' M', pubSettledCount + ' settled channel' + (pubSettledCount === 1 ? '' : 's') + ' (' + fmtAmt(pubSettled, 4) + ' M paid)');
    var pubLeftCard = mkStatCard('Budget Left', fmtAmt(pubRemaining, 4) + ' M', 'Unallocated: ' + fmtAmt(pubRemaining, 4) + ' M');

    var pubViewReward = parseFloat(c.PUBLISHER_REWARD_VIEW || 0);
    if (pubRemaining < pubViewReward) {
      var valEl = pubLeftCard.querySelector('strong');
      if (valEl) { valEl.style.color = '#d9534f'; }
      var subEl = pubLeftCard.querySelector('small:last-of-type');
      if (subEl) {
        subEl.textContent = 'Exhausted (cannot open)';
        subEl.style.color = '#d9534f';
        subEl.style.fontWeight = 'bold';
      }
    }

    pubBudgetRow.appendChild(pubLimitCard);
    pubBudgetRow.appendChild(pubReservedCard);
    pubBudgetRow.appendChild(pubSpentCard);
    pubBudgetRow.appendChild(pubLeftCard);
    budgetBody.appendChild(pubBudgetRow);
  }

  // ── Progress & Footnote ──
  var progressWrap = document.createElement('div');
  progressWrap.style.cssText = 'margin-top:.75rem;';
  progressWrap.appendChild(mkProgressBar(budgetPct, 'Budget allocated/spent'));
  var progressLbl = document.createElement('small');
  progressLbl.style.cssText = 'color:var(--pico-muted-color,#6c757d);font-size:.72rem;display:block;margin-top:.15rem;';
  progressLbl.textContent = fmtAmt(budgetSpent, 4) + ' M allocated or spent / ' + fmtAmt(budgetTotal, 4) + ' M initial budget (' + fmtAmt(budgetRemaining, 4) + ' M available in escrow)';
  progressWrap.appendChild(progressLbl);

  var footnote = document.createElement('div');
  footnote.style.cssText = 'color:var(--pico-muted-color,#6c757d);font-size:.68rem;margin-top:.25rem;font-style:italic;';
  footnote.textContent = '* Closed channel refunds and settled rewards are sent directly to your main wallet balance.';
  progressWrap.appendChild(footnote);

  budgetBody.appendChild(progressWrap);
  budgetDetails.appendChild(budgetBody);

  if (openDetails && openDetails[c.ID + '-budget-allocation']) {
    budgetDetails.open = true;
  }
  cardBody.appendChild(budgetDetails);

  // ── Ad Preview (expandable, card-style) ──────────────────────────────────
  var previewDetails = document.createElement('details');
  previewDetails.className = 'ma-campaign-details';
  previewDetails.setAttribute('data-details-id', 'ad-preview');
  previewDetails.style.cssText = 'margin-bottom:.75rem;padding:.75rem 1rem;border:1px solid var(--pico-border-color);border-radius:var(--pico-border-radius);background-color:rgba(0,0,0,0.015);border-left:3px solid #3498db;';

  var previewSummary = document.createElement('summary');
  previewSummary.textContent = 'Ad Preview';
  previewSummary.className = 'ma-campaign-details-summary';
  previewSummary.style.cssText = 'font-weight:600;cursor:pointer;margin:-.75rem -1rem .35rem;padding:.75rem 1rem;';
  previewDetails.appendChild(previewSummary);

  var previewBody = document.createElement('div');
  previewBody.style.cssText = 'margin-top:.5rem;';

  var adContainer = document.createElement('div');
  adContainer.id = 'ma-ad-preview-container-' + c.ID;
  adContainer.style.cssText = 'max-width:600px;width:100%;margin:0 auto;border-radius:6px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);';
  previewBody.appendChild(adContainer);
  previewDetails.appendChild(previewBody);

  var previewLoaded = false;
  function doRenderPreview() {
    if (typeof renderAd !== 'function') { return; }
    var previewAd = {
      title:           c.AD_TITLE || c.TITLE || '',
      body:            c.BODY || '',
      cta_label:       c.CTA_LABEL || '',
      cta_url:         c.CTA_URL || '',
      image_data:      c.IMAGE_DATA || null,
      show_title:      c.SHOW_TITLE !== undefined ? parseInt(c.SHOW_TITLE, 10) : 1,
      show_body:       c.SHOW_BODY !== undefined ? parseInt(c.SHOW_BODY, 10) : 1,
      show_cta:        c.SHOW_CTA !== undefined ? parseInt(c.SHOW_CTA, 10) : 1,
      bg_color:        c.BG_COLOR || '#ffffff',
      text_color:      c.TEXT_COLOR || '#111111',
      image_position:  c.IMAGE_POSITION || 'center',
      image_zoom:      c.IMAGE_ZOOM !== undefined ? parseFloat(c.IMAGE_ZOOM) : 1.0,
      image_width_pct: c.IMAGE_WIDTH_PCT !== undefined ? parseInt(c.IMAGE_WIDTH_PCT, 10) : 40
    };
    renderAd(previewAd, adContainer.id);
  }

  previewDetails.addEventListener('toggle', function() {
    if (previewDetails.open && !previewLoaded) {
      previewLoaded = true;
      doRenderPreview();
    }
  });

  if (openDetails && openDetails[c.ID + '-ad-preview']) {
    previewDetails.open = true;
    previewLoaded = true;
    setTimeout(doRenderPreview, 0);
  }
  cardBody.appendChild(previewDetails);

  // ── Campaign configuration (expandable, card-style) ──────────────────────
  var configDetails = document.createElement('details');
  configDetails.className = 'ma-campaign-details';
  configDetails.setAttribute('data-details-id', 'campaign-config');
  configDetails.style.cssText = 'margin-bottom:.75rem;padding:.75rem 1rem;border:1px solid var(--pico-border-color);border-radius:var(--pico-border-radius);background-color:rgba(0,0,0,0.015);border-left:3px solid #9b59b6;';
  var configSummary = document.createElement('summary');
  configSummary.textContent = 'Campaign configuration';
  configSummary.className = 'ma-campaign-details-summary';
  configSummary.style.cssText = 'font-weight:600;cursor:pointer;margin:-.75rem -1rem .35rem;padding:.75rem 1rem;';
  configDetails.appendChild(configSummary);

  var configBody = document.createElement('div');
  configBody.style.cssText = 'margin-top:.5rem;';

  var sections = [
    {
      title: 'General Campaign Data',
      params: [
        { label: 'Campaign ID', value: c.ID },
        { label: 'Created At', value: new Date(parseInt(c.CREATED_AT)).toLocaleString() },
        { label: 'Expires At', value: c.EXPIRES_AT ? new Date(parseInt(c.EXPIRES_AT)).toLocaleString() : 'Never' },
        { label: 'Initial Escrow Budget', value: fmtAmt(parseFloat(c.BUDGET_TOTAL), 4) + ' M' },
        { label: 'Escrow Coin ID', value: c.ESCROW_COINID || 'N/A' },
        { label: 'Creator Maxima PK', value: c.CREATOR_MX || 'N/A' },
        { label: 'Escrow Signer PK', value: c.ESCROW_WALLET_PK || 'N/A' }
      ]
    },
    {
      title: 'Reward Viewer',
      params: [
        { label: 'Reward / View', value: fmtAmt(parseFloat(c.REWARD_VIEW), 4) + ' M' },
        { label: 'Reward / Click', value: fmtAmt(parseFloat(c.REWARD_CLICK), 4) + ' M' }
      ]
    },
    {
      title: 'Reward Viewer Limits',
      params: [
        { label: 'Max Reward / Viewer', value: c.MAX_VIEWER_REWARD ? fmtAmt(parseFloat(c.MAX_VIEWER_REWARD), 4) + ' M' : 'Unlimited' },
        { label: 'Max Daily Views', value: c.MAX_DAILY_VIEWS ? c.MAX_DAILY_VIEWS : 'No limit' },
        { label: 'Max Daily Clicks', value: c.MAX_DAILY_CLICKS ? c.MAX_DAILY_CLICKS : 'No limit' },
        { label: 'Reward Cooldown', value: c.COOLDOWN_MS ? (parseInt(c.COOLDOWN_MS) / 1000) + 's' : 'No cooldown' }
      ]
    },
    {
      title: 'Publisher Rewards & Limits',
      params: [
        { label: 'Publisher Reward / View', value: maxPubBudget > 0 ? fmtAmt(parseFloat(c.PUBLISHER_REWARD_VIEW), 4) + ' M' : 'Disabled' },
        { label: 'Max Publisher Budget', value: maxPubBudget > 0 ? fmtAmt(maxPubBudget, 4) + ' M' : 'Disabled' }
      ]
    }
  ];

  for (var s = 0; s < sections.length; s++) {
    var sec = sections[s];
    
    var sectionHeader = document.createElement('div');
    sectionHeader.textContent = sec.title;
    sectionHeader.style.cssText = 'font-weight:bold;font-size:.78rem;text-transform:uppercase;margin:.75rem 0 .4rem;color:var(--pico-color);';
    if (s === 0) {
      sectionHeader.style.marginTop = '0';
    }
    configBody.appendChild(sectionHeader);

    var detailsGrid = document.createElement('div');
    detailsGrid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:.5rem;padding:.5rem .75rem;border:1px solid var(--pico-border-color);border-radius:var(--pico-border-radius);background-color:rgba(0,0,0,0.015);margin-bottom:.75rem;';
    if (s === sections.length - 1) {
      detailsGrid.style.marginBottom = '0';
    }

    for (var k = 0; k < sec.params.length; k++) {
      var item = document.createElement('div');
      item.style.cssText = 'display:flex;flex-direction:column;min-width:0;';
      
      var labelSpan = document.createElement('span');
      labelSpan.textContent = sec.params[k].label;
      labelSpan.style.cssText = 'font-size:.7rem;color:var(--pico-muted-color,#6c757d);font-weight:bold;text-transform:uppercase;';
      
      var valSpan = document.createElement('span');
      valSpan.textContent = sec.params[k].value;
      valSpan.style.cssText = 'font-size:.78rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
      valSpan.title = sec.params[k].value;
      
      item.appendChild(labelSpan);
      item.appendChild(valSpan);
      detailsGrid.appendChild(item);
    }
    configBody.appendChild(detailsGrid);
  }

  configDetails.appendChild(configBody);
  if (openDetails && openDetails[c.ID + '-campaign-config']) {
    configDetails.open = true;
  }
  cardBody.appendChild(configDetails);

  // ── Activity chart (expandable, card-style) ─────────────────────────────
  var details = document.createElement('details');
  details.className = 'ma-campaign-details';
  details.setAttribute('data-details-id', 'activity-chart');
  details.style.cssText = 'margin-bottom:.75rem;padding:.75rem 1rem;border:1px solid var(--pico-border-color);border-radius:var(--pico-border-radius);background-color:rgba(0,0,0,0.015);border-left:3px solid #1abc9c;';
  var summary = document.createElement('summary');
  summary.textContent = 'Activity chart';
  summary.className = 'ma-campaign-details-summary';
  summary.style.cssText = 'font-weight:600;cursor:pointer;margin:-.75rem -1rem .35rem;padding:.75rem 1rem;';
  details.appendChild(summary);

  var detailBody = document.createElement('div');
  detailBody.id = 'ma-detail-' + c.ID;
  detailBody.style.cssText = 'margin-top:.5rem;';
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

  if (openDetails && openDetails[c.ID + '-activity-chart']) {
    details.open = true;
    chartLoaded = true;
    detailBody.appendChild(mkLoading('Loading chart…'));
    _loadChartData(c.ID, detailBody);
  }
  cardBody.appendChild(details);

  // ── Pending settlement (expandable, card-style) ────────────────────────
  var nodesDetails = document.createElement('details');
  nodesDetails.className = 'ma-campaign-details';
  nodesDetails.setAttribute('data-details-id', 'pending-settlement');
  nodesDetails.style.cssText = 'margin-bottom:.75rem;padding:.75rem 1rem;border:1px solid var(--pico-border-color);border-radius:var(--pico-border-radius);background-color:rgba(0,0,0,0.015);border-left:3px solid #e74c3c;';
  var nodesSummary = document.createElement('summary');
  nodesSummary.textContent = 'Pending settlement';
  nodesSummary.className = 'ma-campaign-details-summary';
  nodesSummary.style.cssText = 'font-weight:600;cursor:pointer;margin:-.75rem -1rem .35rem;padding:.75rem 1rem;';
  nodesDetails.appendChild(nodesSummary);

  var nodesBody = document.createElement('div');
  nodesBody.style.cssText = 'margin-top:.5rem;';
  nodesDetails.appendChild(nodesBody);

  var nodesLoaded = false;
  nodesDetails.addEventListener('toggle', function() {
    if (nodesDetails.open && !nodesLoaded) {
      nodesLoaded = true;
      nodesBody.appendChild(mkLoading('Loading pending settlements…'));
      _loadRewardedNodes(c.ID, nodesBody);
    }
    if (!nodesDetails.open) {
      nodesBody.innerHTML = '';
      nodesLoaded = false;
    }
  });

  if (openDetails && openDetails[c.ID + '-pending-settlement']) {
    nodesDetails.open = true;
    nodesLoaded = true;
    nodesBody.appendChild(mkLoading('Loading pending settlements…'));
    _loadRewardedNodes(c.ID, nodesBody);
  }
  cardBody.appendChild(nodesDetails);

  // ── Settled channels (expandable, card-style) ─────────────────────────────
  var settledDetails = document.createElement('details');
  settledDetails.className = 'ma-campaign-details';
  settledDetails.setAttribute('data-details-id', 'settled-channels');
  settledDetails.style.cssText = 'margin-bottom:.75rem;padding:.75rem 1rem;border:1px solid var(--pico-border-color);border-radius:var(--pico-border-radius);background-color:rgba(0,0,0,0.015);border-left:3px solid #27ae60;';
  var settledSummary = document.createElement('summary');
  settledSummary.textContent = 'Settled channels';
  settledSummary.className = 'ma-campaign-details-summary';
  settledSummary.style.cssText = 'font-weight:600;cursor:pointer;margin:-.75rem -1rem .35rem;padding:.75rem 1rem;';
  settledDetails.appendChild(settledSummary);

  var settledBody = document.createElement('div');
  settledBody.style.cssText = 'margin-top:.5rem;';
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

  if (openDetails && openDetails[c.ID + '-settled-channels']) {
    settledDetails.open = true;
    settledLoaded = true;
    settledBody.appendChild(mkLoading('Loading settled channels…'));
    _loadSettledChannels(c.ID, settledBody);
  }
  cardBody.appendChild(settledDetails);

  card.appendChild(cardBody);

  if (openDetails && openDetails[c.ID + '-campaign-card']) {
    card.open = true;
  }

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
        detailEl.appendChild(mkEmptyState('No settled channels yet.'));
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
  var headers = ['Type', 'Node', 'PK', 'Channels', 'Total', 'Last settled', ''];
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
    var role = group.role || 'viewer';
    var typeText = role === 'publisher' ? 'Publisher' : 'Viewer';
    var contact = contactsMap[String(pk).toUpperCase()] || null;
    var nodeName = contact && contact.name ? contact.name : 'Unknown node';
    var lastText = group.lastTs
      ? new Date(group.lastTs).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
      : '—';

    var tr = document.createElement('tr');
    tr.className = 'ma-expandable-row';
    tr.setAttribute('tabindex', '0');
    tr.setAttribute('aria-expanded', 'false');
    tr.appendChild(_nodeTd(typeText));
    tr.appendChild(_nodeTd(nodeName));
    tr.appendChild(_nodeTd(_shortNodePk(pk)));
    tr.appendChild(_nodeTd(String(group.rows.length)));
    tr.appendChild(_nodeTd(fmtAmt(group.total, 6) + ' M'));
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
    detailTd.setAttribute('colspan', '7');
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
    var role = r.ROLE || 'viewer';
    var key = String(pk).toUpperCase() + '_' + String(role).toUpperCase();
    if (!map[key]) {
      map[key] = { pk: pk, role: role, rows: [], total: 0, lastTs: 0 };
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
    tr.appendChild(_nodeTd(fmtAmt(parseFloat(r.CUMULATIVE_EARNED || 0) || 0, 6) + ' M'));
    tr.appendChild(_nodeTd(settledDate));
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  target.appendChild(table);
}

// ---------------------------------------------------------------------------
// Pending settlement per campaign
// ---------------------------------------------------------------------------

function _loadRewardedNodes(campaignId, detailEl) {
  _loadMaximaContactsMap(function(contactsMap) {
    var channelSql = "SELECT VIEWER_KEY, ROLE, CREATED_AT FROM CHANNEL_STATE"
      + " WHERE UPPER(CAMPAIGN_ID) = UPPER('" + escapeSql(campaignId) + "')"
      + " AND STATUS IN ('open', 'pending')";

    sqlQuery(channelSql, function(chErr, chRows) {
      if (chErr) {
        if (detailEl) {
          detailEl.innerHTML = '';
          var errEl = document.createElement('p');
          errEl.textContent = 'Error loading active channels: ' + chErr;
          detailEl.appendChild(errEl);
        }
        return;
      }

      var activeStartTimes = {};
      if (chRows) {
        for (var c = 0; c < chRows.length; c++) {
          var ch = chRows[c];
          var key = String(ch.VIEWER_KEY).toUpperCase() + '_' + String(ch.ROLE).toLowerCase();
          activeStartTimes[key] = parseInt(ch.CREATED_AT || 0, 10);
        }
      }

      var sql = "SELECT USER_ADDRESS, TYPE, AMOUNT, TIMESTAMP"
        + " FROM REWARD_EVENTS"
        + " WHERE UPPER(CAMPAIGN_ID) = UPPER('" + escapeSql(campaignId) + "')"
        + " ORDER BY TIMESTAMP DESC";

      sqlQuery(sql, function(err, rows) {
        if (!detailEl) { return; }
        detailEl.innerHTML = '';

        if (err) {
          var errEl = document.createElement('p');
          errEl.textContent = 'Error loading pending settlements: ' + err;
          detailEl.appendChild(errEl);
          return;
        }

        var activeRows = [];
        if (rows) {
          for (var i = 0; i < rows.length; i++) {
            var r = rows[i];
            var role = (r.TYPE === 'publisher_view') ? 'publisher' : 'viewer';
            var k = String(r.USER_ADDRESS).toUpperCase() + '_' + role;
            if (activeStartTimes[k] !== undefined) {
              var tOpen = activeStartTimes[k];
              if (parseInt(r.TIMESTAMP || 0, 10) >= tOpen) {
                activeRows.push(r);
              }
            }
          }
        }

        if (activeRows.length === 0) {
          detailEl.appendChild(mkEmptyState('No pending settlements yet.'));
          return;
        }

        _renderRewardedNodesTable(detailEl, activeRows, contactsMap);
      });
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
    tr.appendChild(_nodeTd(fmtAmt(group.total, 6) + ' M'));
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
    tr.appendChild(_nodeTd(fmtAmt(parseFloat(r.AMOUNT || 0) || 0, 6) + ' M'));
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
  var card = section.querySelector('*[data-campaign-id="' + campaignId + '"]');
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
