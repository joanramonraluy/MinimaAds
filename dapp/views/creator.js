// T10 — Creator view.
// Renders the campaign creation form, funds the KissVM escrow, persists
// the campaign locally via saveCampaign(), and broadcasts CAMPAIGN_ANNOUNCE.
// Escrow flow: MinimaAds.md §6.3 step 4 / Appendix B.
// CAMPAIGN_ANNOUNCE schema: MinimaAds.md §8.3.

// ~1728 blocks per day at ~50 s/block.
var BLOCKS_PER_DAY = 1728;

// Platform fee rate — MinimaAds.md §6.1 (F = 0.06).
var PLATFORM_FEE_RATE = 0.06;

function formatMinima(val) {
  var parts = val.toFixed(6).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts[0] + '.' + parts[1];
}

function renderCreator(root) {
  root.innerHTML = '';

  var h2 = document.createElement('h2');
  h2.textContent = 'Create Campaign';
  root.appendChild(h2);

  var form = document.createElement('form');
  form.id = 'ma-creator-form';
  form.innerHTML = ''
    + '<div class="ma-creator-overview">'
    + '  <div class="ma-autobalance-row">'
    + '    <label>'
    + '      <input type="checkbox" name="auto_balance" checked>'
    + '      Auto-balance cap'
    + '    </label>'
    + '  </div>'
    + '  <div id="ma-campaign-summary"></div>'
    + '</div>'
    + '<div class="ma-tabs" role="tablist" aria-label="Campaign setup">'
    + '  <button type="button" id="ma-tab-content" role="tab" aria-selected="true" aria-controls="ma-panel-content" data-target="ma-panel-content">Add content & duration</button>'
    + '  <button type="button" id="ma-tab-viewer" role="tab" aria-selected="false" aria-controls="ma-panel-viewer" data-target="ma-panel-viewer">Viewer parameters</button>'
    + '  <button type="button" id="ma-tab-publisher" role="tab" aria-selected="false" aria-controls="ma-panel-publisher" data-target="ma-panel-publisher">Publisher parameters</button>'
    + '</div>'
    + '<div class="ma-section ma-tab-panel" id="ma-panel-content" role="tabpanel" aria-labelledby="ma-tab-content">'
    + '  <label>Campaign title'
    + '    <input name="title" value="Campanya " required maxlength="256">'
    + '  </label>'
    + '  <label>Ad description'
    + '    <textarea name="body" required maxlength="1024">Descripció de la campanya de prova</textarea>'
    + '  </label>'
    + '  <label>Interests (comma-separated)'
    + '    <input name="interests" value="tech, web3, minima" placeholder="tech, web3, minima">'
    + '  </label>'
    + '  <label>CTA label'
    + '    <input name="cta_label" value="Visit" required maxlength="64">'
    + '  </label>'
    + '  <label>CTA URL'
    + '    <input name="cta_url" type="url" value="https://minima.global" required>'
    + '  </label>'
    + '  <label>Campaign duration (days) — max ' + LIMITS.MAX_CAMPAIGN_DAYS
    + '    <input name="campaign_days" type="number" step="1" min="1" max="' + LIMITS.MAX_CAMPAIGN_DAYS + '" value="7" required>'
    + '  </label>'
    + '</div>'
    + '<div class="ma-section ma-tab-panel" id="ma-panel-viewer" role="tabpanel" aria-labelledby="ma-tab-viewer" hidden>'
    + '  <label>Total budget (MINIMA) — min ' + LIMITS.MIN_BUDGET + ' MINIMA'
    + '    <input name="budget" type="text" inputmode="decimal" min="' + LIMITS.MIN_BUDGET + '" value="' + LIMITS.MIN_BUDGET + '" required>'
    + '    <small id="ma-budget-hint">Checking wallet balance…</small>'
    + '  </label>'
    + '  <label>Reward per view (MINIMA)'
    + '    <input name="reward_view" type="number" step="0.000001" min="' + LIMITS.MIN_REWARD_VIEW + '" value="0.01" required>'
    + '  </label>'
    + '  <label>Reward per click (MINIMA)'
    + '    <input name="reward_click" type="number" step="0.000001" min="' + LIMITS.MIN_REWARD_CLICK + '" value="0.10" required>'
    + '  </label>'
    + '  <label>Max reward per viewer (MINIMA)'
    + '    <input name="max_viewer_reward" type="number" step="0.000001" min="0.000001" value="0.11" required>'
    + '    <small id="ma-cap-min-hint" style="display:block;margin-top:0.2rem;"></small>'
    + '    <span id="ma-multiplier-row" style="display:flex;align-items:center;gap:0.5rem;margin-top:0.35rem;">'
    + '      <small style="color:var(--pico-muted-color)">(view + click) &times;</small>'
    + '      <input name="multiplier" type="number" step="0.1" min="1" value="2"'
    + '        style="width:5rem;margin:0;padding:0.2rem 0.4rem;">'
    + '    </span>'
    + '    <small id="ma-max-viewer-hint"></small>'
    + '  </label>'
    + '</div>'
    + '<div class="ma-section ma-tab-panel" id="ma-panel-publisher" role="tabpanel" aria-labelledby="ma-tab-publisher" hidden>'
    + '  <label>Publisher reward per view (MINIMA, optional)'
    + '    <input name="publisher_reward_view" type="number" step="0.001" min="0" value="0">'
    + '    <small>Leave at 0 to disable Frame rewards</small>'
    + '  </label>'
    + '  <label>Max publisher budget (MINIMA)'
    + '    <input name="max_publisher_budget" type="number" step="0.01" min="0" value="0">'
    + '    <small>Subset of total budget reserved for publisher payouts</small>'
    + '  </label>'
    + '</div>'
    + '<button type="submit">Publish campaign</button>'
    + '<p id="ma-creator-msg" role="status"></p>';
  root.appendChild(form);

  setupCreatorTabs(form);
  form.addEventListener('submit', onCreatorSubmit);
  form.addEventListener('input', onCreatorFormInput);
  form.addEventListener('change', onCreatorFormChange);
  var budgetInput = form.querySelector('[name="budget"]');
  budgetInput.addEventListener('focus', function() {
    this.value = this.value.replace(/,/g, '');
  });
  budgetInput.addEventListener('blur', function() {
    var val = parseFloat(this.value.replace(/,/g, ''));
    if (isFinite(val) && val > 0) { this.value = formatMinima(val); }
  });
  var daysInput = form.querySelector('[name="campaign_days"]');
  if (daysInput) {
    daysInput.addEventListener('keydown', function(e) {
      if (e.key === '.' || e.key === ',') { e.preventDefault(); }
    });
  }
  form.addEventListener('reset', function() {
    setTimeout(function() { applyAutoBalance(form); enforceCapMinimum(form); updateCampaignSummary(form); }, 0);
  });
  applyAutoBalance(form);
  enforceCapMinimum(form);
  updateCampaignSummary(form);
  loadWalletBalance(form);
}

function setupCreatorTabs(form) {
  var tabs = form.querySelectorAll('[role="tab"][data-target]');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].addEventListener('click', function() {
      selectCreatorTab(form, this.getAttribute('data-target'));
    });
  }
  form.addEventListener('invalid', function(e) {
    var panel = findCreatorTabPanel(e.target);
    if (panel && panel.id) {
      selectCreatorTab(form, panel.id);
    }
  }, true);
}

function findCreatorTabPanel(el) {
  while (el && el !== document) {
    if (el.className && (' ' + el.className + ' ').indexOf(' ma-tab-panel ') !== -1) {
      return el;
    }
    el = el.parentNode;
  }
  return null;
}

function selectCreatorTab(form, panelId) {
  var tabs = form.querySelectorAll('[role="tab"][data-target]');
  var panels = form.querySelectorAll('.ma-tab-panel');
  for (var i = 0; i < tabs.length; i++) {
    var active = tabs[i].getAttribute('data-target') === panelId;
    tabs[i].setAttribute('aria-selected', active ? 'true' : 'false');
  }
  for (var j = 0; j < panels.length; j++) {
    if (panels[j].id === panelId) {
      panels[j].removeAttribute('hidden');
    } else {
      panels[j].setAttribute('hidden', '');
    }
  }
}

function loadWalletBalance(form) {
  MDS.cmd('balance', function(res) {
    var hintEl = document.getElementById('ma-budget-hint');
    if (!res.status || !res.response) {
      if (hintEl) { hintEl.textContent = 'Could not fetch wallet balance.'; }
      return;
    }
    var sendable = 0;
    var entries = res.response;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].tokenid === '0x00') {
        sendable = parseFloat(entries[i].sendable) || 0;
        break;
      }
    }
    var budgetInput = form.querySelector('[name="budget"]');
    if (!budgetInput) { return; }
    budgetInput.max = sendable.toFixed(6);
    budgetInput.dataset.walletMax = sendable;
    var initialBudget = parseFloat(budgetInput.value.replace(/,/g, ''));
    if (isFinite(initialBudget) && initialBudget > 0) {
      budgetInput.value = formatMinima(initialBudget);
    }
    if (hintEl) {
      hintEl.textContent = 'Available: ' + formatMinima(sendable) + ' MINIMA';
    }
    updateCampaignSummary(form);
  });
}

function onCreatorFormInput(e) {
  var form        = e.currentTarget;
  var changedName = e.target.name;
  var decimals    = FIELD_DECIMALS[changedName];
  if (decimals !== undefined && e.target.type === 'number') {
    truncateInputDecimals(e.target, decimals);
  }
  if (changedName === 'campaign_days') {
    var days = parseInt(e.target.value, 10);
    if (isFinite(days) && days > LIMITS.MAX_CAMPAIGN_DAYS) { e.target.value = LIMITS.MAX_CAMPAIGN_DAYS; }
  }
  if (changedName === 'multiplier') {
    var mult = parseFloat(e.target.value);
    if (isFinite(mult) && mult < 1) { e.target.value = '1.0'; }
  }
  if (changedName === 'budget') {
    var budgetInput = form.querySelector('[name="budget"]');
    var walletMax = parseFloat(budgetInput.dataset.walletMax);
    var budgetVal = parseFloat(e.target.value.replace(/,/g, ''));
    if (isFinite(walletMax) && isFinite(budgetVal) && budgetVal > walletMax) {
      e.target.value = walletMax.toFixed(6);
    }
  }
  if (changedName === 'reward_view' || changedName === 'reward_click'
      || changedName === 'auto_balance' || changedName === 'multiplier') {
    applyAutoBalance(form);
  }
  enforceCapMinimum(form);
  updateCampaignSummary(form);
}

function truncateInputDecimals(input, maxDecimals) {
  var val = input.value;
  var dotIndex = val.indexOf('.');
  if (dotIndex === -1) { return; }
  if (maxDecimals === 0) {
    input.value = val.slice(0, dotIndex);
  } else if (val.length - dotIndex - 1 > maxDecimals) {
    input.value = val.slice(0, dotIndex + maxDecimals + 1);
  }
}

var FIELD_DECIMALS = {
  budget:                 6,
  reward_view:            6,
  reward_click:           6,
  max_viewer_reward:      6,
  publisher_reward_view:  6,
  max_publisher_budget:   6,
  campaign_days:          0,
  multiplier:             1
};

function onCreatorFormChange(e) {
  var input = e.target;
  var decimals = FIELD_DECIMALS[input.name];
  if (decimals === undefined || input.type !== 'number') { return; }
  var val = parseFloat(input.value);
  if (!isFinite(val)) { return; }
  var factor = Math.pow(10, decimals);
  input.value = (Math.round(val * factor) / factor).toFixed(decimals);
}

// Keeps max_viewer_reward >= reward_view + reward_click at all times.
// Updates the HTML min attribute and clamps the current value if needed.
function enforceCapMinimum(form) {
  var rewardView  = parseFloat(form.querySelector('[name="reward_view"]').value) || 0;
  var rewardClick = parseFloat(form.querySelector('[name="reward_click"]').value) || 0;
  var minCap      = rewardView + rewardClick;
  var capInput    = form.querySelector('[name="max_viewer_reward"]');
  capInput.min = minCap > 0 ? minCap.toFixed(6) : '0.000001';
  var currentCap = parseFloat(capInput.value);
  if (isFinite(currentCap) && currentCap < minCap) {
    capInput.value = minCap.toFixed(6);
  }
  var hintEl = document.getElementById('ma-cap-min-hint');
  if (hintEl) {
    hintEl.textContent = minCap > 0
      ? 'Min: ' + formatMinima(minCap) + ' MINIMA (= reward/view + reward/click)'
      : '';
  }
}

// When auto-balance is ON: cap = (view + click) × multiplier.
// Multiplier defaults to 2 (balanced). Min 1 = maximum reach. Higher = more incentive per viewer.
function applyAutoBalance(form) {
  var autoBalance    = form.querySelector('[name="auto_balance"]').checked;
  var capInput       = form.querySelector('[name="max_viewer_reward"]');
  var multiplierInput = form.querySelector('[name="multiplier"]');
  var hintEl         = document.getElementById('ma-max-viewer-hint');

  var rewardView  = parseFloat(form.querySelector('[name="reward_view"]').value);
  var rewardClick = parseFloat(form.querySelector('[name="reward_click"]').value);
  var budget      = parseFloat((form.querySelector('[name="budget"]').value || '').replace(/,/g, ''));
  var multiplierRow = document.getElementById('ma-multiplier-row');
  var multiplier    = multiplierInput ? (parseFloat(multiplierInput.value) || 1) : 1;
  if (multiplier < 1) { multiplier = 1; }

  if (multiplierRow) { multiplierRow.style.display = autoBalance ? 'flex' : 'none'; }
  capInput.readOnly = autoBalance;

  if (hintEl) {
    if (!isFinite(rewardView) || !isFinite(rewardClick) || !isFinite(budget)) {
      hintEl.innerHTML = '';
    } else {
      var minCap   = rewardView + rewardClick;
      var maxReach = minCap > 0 ? Math.floor(budget / minCap) : 0;
      var curCap   = minCap * multiplier;
      var curReach = curCap > 0 ? Math.floor(budget / curCap) : 0;
      if (autoBalance) {
        var minLine = '<span style="display:block">'
          + '<strong>&times;1</strong> &nbsp;Max reach: <strong>' + maxReach.toLocaleString() + '</strong> viewers'
          + ' &middot; ' + formatMinima(minCap) + '&thinsp;MINIMA/viewer'
          + '</span>';
        var curLine = multiplier !== 1
          ? '<span style="display:block">'
            + '<strong>&times;' + multiplier.toFixed(1) + '</strong> Current: <strong>' + curReach.toLocaleString() + '</strong> viewers'
            + ' &middot; ' + formatMinima(curCap) + '&thinsp;MINIMA/viewer'
            + '</span>'
          : '';
        var note = '<span style="display:block;margin-top:0.2rem;opacity:0.75">'
          + 'Higher &times; &rarr; fewer viewers, stronger incentive per viewer'
          + '</span>';
        hintEl.innerHTML = minLine + curLine + note;
      } else {
        hintEl.innerHTML = '';
      }
    }
  }

  if (!autoBalance) return;
  if (!isFinite(rewardView) || !isFinite(rewardClick)) return;

  var suggested = (rewardView + rewardClick) * multiplier;
  if (suggested > 0) { capInput.value = suggested.toFixed(6); }
}

function updateCampaignSummary(form) {
  var summaryEl = document.getElementById('ma-campaign-summary');
  if (!summaryEl) return;

  var budget       = parseFloat((form.querySelector('[name="budget"]').value || '').replace(/,/g, ''));
  var rewardView   = parseFloat(form.querySelector('[name="reward_view"]').value);
  var rewardClick  = parseFloat(form.querySelector('[name="reward_click"]').value);
  var campaignDays = parseInt(form.querySelector('[name="campaign_days"]').value, 10);
  var cap          = parseFloat(form.querySelector('[name="max_viewer_reward"]').value);

  if (!isFinite(budget) || budget <= 0 || !isFinite(rewardView) || !isFinite(rewardClick)
      || !isFinite(campaignDays) || campaignDays <= 0 || !isFinite(cap) || cap <= 0) {
    summaryEl.innerHTML = '';
    return;
  }

  var pubRvInput = form.querySelector('[name="publisher_reward_view"]');
  var pubBudgInput = form.querySelector('[name="max_publisher_budget"]');
  var publisherRewardView = pubRvInput ? (parseFloat(pubRvInput.value) || 0) : 0;
  var maxPublisherBudget  = pubBudgInput ? (parseFloat(pubBudgInput.value) || 0) : 0;

  var maxViewers    = Math.floor(budget / cap);
  var platformFee   = budget * PLATFORM_FEE_RATE;
  var totalCost     = budget + platformFee;

  var warningHtml = '';
  if (maxViewers === 0) {
    warningHtml = '<p class="ma-summary-warning">No viewer can be rewarded with these settings.'
      + ' Increase the budget or reduce the cap per viewer.</p>';
  }

  var interactionNote = '';
  var singleInteraction = rewardView + rewardClick;
  if (isFinite(singleInteraction) && singleInteraction > 0 && cap < singleInteraction) {
    interactionNote = '<li><small>Cap is below a single view + click ('
      + formatMinima(singleInteraction) + ' MINIMA) — viewers earn partial rewards per interaction.</small></li>';
  }

  summaryEl.innerHTML = '<div class="ma-summary-box">'
    + warningHtml
    + '<strong>Campaign reach estimate</strong>'
    + '<ul>'
    + '<li>Max reward per viewer: ' + formatMinima(cap) + ' MINIMA</li>'
    + '<li>Max viewers that can be rewarded: <strong>' + maxViewers.toLocaleString() + '</strong></li>'
    + interactionNote
    + '</ul>'
    + '<strong>Cost breakdown</strong>'
    + '<ul>'
    + '<li>Budget: ' + formatMinima(budget) + ' MINIMA</li>'
    + '<li>Platform fee (6%): ' + formatMinima(platformFee) + ' MINIMA</li>'
    + (publisherRewardView > 0
        ? '<li>Publisher reward/view: ' + formatMinima(publisherRewardView) + ' MINIMA'
          + ' &middot; max budget: ' + formatMinima(maxPublisherBudget) + ' MINIMA</li>'
        : '')
    + '<li>Total cost: <strong>' + formatMinima(totalCost) + ' MINIMA</strong></li>'
    + '</ul>'
    + '</div>';
}

function onCreatorSubmit(e) {
  e.preventDefault();
  var form = e.target;
  var msgEl = document.getElementById('ma-creator-msg');
  msgEl.textContent = '';

  if (!MY_ADDRESS) {
    msgEl.textContent = 'Waiting for Maxima identity…';
    return;
  }

  var data = new FormData(form);
  var title      = (data.get('title')     || '').toString().trim();
  var body       = (data.get('body')      || '').toString().trim();
  var interests  = (data.get('interests') || '').toString().trim();
  var ctaLabel   = (data.get('cta_label') || '').toString().trim();
  var ctaUrl     = (data.get('cta_url')   || '').toString().trim();
  var budget     = parseFloat((data.get('budget') || '').replace(/,/g, ''));
  var rewardView = parseFloat(data.get('reward_view'));
  var rewardClick= parseFloat(data.get('reward_click'));
  var campaignDaysRaw = (data.get('campaign_days') || '').toString().trim();
  var campaignDays = campaignDaysRaw ? parseInt(campaignDaysRaw, 10) : 7;
  var expiresAt  = Date.now() + (campaignDays * 24 * 60 * 60 * 1000);
  var maxViewerRewardRaw = (data.get('max_viewer_reward') || '').toString().trim();
  var maxViewerReward = (maxViewerRewardRaw && parseFloat(maxViewerRewardRaw) > 0) ? parseFloat(maxViewerRewardRaw) : null;
  var publisherRewardView = parseFloat(data.get('publisher_reward_view') || '0') || 0;
  var maxPublisherBudget  = parseFloat(data.get('max_publisher_budget') || '0') || 0;

  if (maxViewerReward === null) {
    maxViewerReward = (rewardView + rewardClick) * campaignDays;
  }

  if (!title || !body || !ctaLabel || !ctaUrl) {
    msgEl.textContent = 'Missing required text fields.';
    return;
  }
  if (!(budget >= LIMITS.MIN_BUDGET)) {
    msgEl.textContent = 'Budget must be at least ' + LIMITS.MIN_BUDGET + ' MINIMA.';
    return;
  }
  var budgetInput = form.querySelector('[name="budget"]');
  var walletMax = budgetInput ? parseFloat(budgetInput.dataset.walletMax) : NaN;
  if (isFinite(walletMax) && budget > walletMax) {
    msgEl.textContent = 'Budget exceeds wallet balance (' + walletMax.toFixed(6) + ' MINIMA sendable).';
    return;
  }
  if (!(rewardView >= LIMITS.MIN_REWARD_VIEW)) {
    msgEl.textContent = 'Reward per view must be at least ' + LIMITS.MIN_REWARD_VIEW + ' MINIMA.';
    return;
  }
  if (!(rewardClick >= LIMITS.MIN_REWARD_CLICK)) {
    msgEl.textContent = 'Reward per click must be at least ' + LIMITS.MIN_REWARD_CLICK + ' MINIMA.';
    return;
  }
  if (!(campaignDays >= 1) || !(campaignDays <= LIMITS.MAX_CAMPAIGN_DAYS)) {
    msgEl.textContent = 'Campaign duration must be between 1 and ' + LIMITS.MAX_CAMPAIGN_DAYS + ' days.';
    return;
  }
  if (rewardView > budget || rewardClick > budget) {
    msgEl.textContent = 'Rewards cannot exceed total budget.';
    return;
  }
  if (maxViewerReward < rewardView + rewardClick) {
    msgEl.textContent = 'Max reward per viewer cannot be less than reward/view + reward/click (' + (rewardView + rewardClick).toFixed(6) + ' MINIMA).';
    return;
  }
  if (Math.floor(budget / maxViewerReward) === 0) {
    msgEl.textContent = 'Campaign cannot reach any viewer with these settings. Increase budget or reduce cap per viewer.';
    return;
  }
  if (publisherRewardView > 0) {
    if (!(publisherRewardView >= LIMITS.MIN_PUBLISHER_REWARD_VIEW)) {
      msgEl.textContent = 'Publisher reward per view must be at least ' + LIMITS.MIN_PUBLISHER_REWARD_VIEW + ' MINIMA.';
      return;
    }
    if (!(maxPublisherBudget > 0)) {
      msgEl.textContent = 'Max publisher budget is required when publisher reward is enabled.';
      return;
    }
    if (maxPublisherBudget > budget) {
      msgEl.textContent = 'Max publisher budget cannot exceed total budget.';
      return;
    }
  }

  var now        = Date.now();
  var campaignId = generateUID();
  var adId       = generateUID();

  var campaign = {
    id:               campaignId,
    creator_address:  MY_ADDRESS,
    title:            title,
    budget_total:     budget,
    budget_remaining: budget,
    reward_view:      rewardView,
    reward_click:     rewardClick,
    status:           'active',
    created_at:       now,
    expires_at:       expiresAt,
    escrow_coinid:          '',
    escrow_wallet_pk:       '',
    max_viewer_reward:      maxViewerReward,
    publisher_reward_view:  publisherRewardView,
    max_publisher_budget:   maxPublisherBudget,
    publisher_budget_spent: 0
  };

  var ad = {
    id:         adId,
    campaign_id: campaignId,
    title:      title,
    body:       body,
    cta_label:  ctaLabel,
    cta_url:    ctaUrl,
    interests:  interests || null
  };

  var submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) { submitBtn.setAttribute('disabled', ''); }

  msgEl.textContent = 'Funding escrow…';

  var campaignDurationBlocks = campaignDays * BLOCKS_PER_DAY;
  fundEscrowAndPublish(campaign, ad, form, submitBtn, msgEl, campaignDurationBlocks);
}

// V1 — legacy escrow script. Kept only to spend coins from campaigns created before T-PUB4.
var ESCROW_SCRIPT_FE  = 'LET creatorkey=PREVSTATE(1) ASSERT SIGNEDBY(creatorkey) LET payout=STATE(10) LET change=@AMOUNT-payout IF change GT 0 THEN ASSERT VERIFYOUT(INC(@INPUT) @ADDRESS change @TOKENID TRUE) ENDIF RETURN TRUE';

// V2 — current escrow script (T-PUB4). Embeds PLATFORM_KEY at PREVSTATE(5)
// and MAX_PUBLISHER_BUDGET at PREVSTATE(6); enables conditional fee branch
// via STATE(11). All NEW campaigns use this script. See MinimaAds.md §B.2.
var ESCROW_SCRIPT_V2 =
  "LET creatorkey=PREVSTATE(1) " +
  "ASSERT SIGNEDBY(creatorkey) " +
  "LET payout=STATE(10) " +
  "LET feeflag=STATE(11) " +
  "LET change=@AMOUNT-payout " +
  "IF feeflag EQ 1 THEN " +
    "LET platformkey=PREVSTATE(5) " +
    "LET feeamount=STATE(12) " +
    "ASSERT VERIFYOUT(STATE(13) platformkey feeamount @TOKENID FALSE) " +
  "ENDIF " +
  "IF change GT 0 THEN " +
    "ASSERT VERIFYOUT(INC(@INPUT) @ADDRESS change @TOKENID TRUE) " +
  "ENDIF " +
  "RETURN TRUE";

var CHANNEL_SCRIPT_FE = 'IF @COINAGE GT (40*1728) AND SIGNEDBY(PREVSTATE(1)) THEN RETURN TRUE ENDIF RETURN MULTISIG(2 PREVSTATE(1) PREVSTATE(2))';

// Resolves the V2 escrow address (used by all new campaigns from T-PUB4 onward).
// Cached under 'ESCROW_ADDRESS_V2' — independent from V1 'ESCROW_ADDRESS'
// so legacy campaigns can still be spent from the V1 address.
function resolveEscrowAddress(cb) {
  MDS.keypair.get('ESCROW_ADDRESS_V2', function(addrRes) {
    var cached = addrRes && addrRes.status ? addrRes.value : '';
    if (cached) {
      console.log('[CREATOR] ESCROW_ADDRESS_V2 from keypair:', cached);
      cb(cached);
      return;
    }
    console.log('[CREATOR] ESCROW_ADDRESS_V2 not in keypair — registering via newscript');
    MDS.cmd('newscript script:"' + ESCROW_SCRIPT_V2 + '" trackall:false', function(res) {
      if (!res.status) {
        console.error('[CREATOR] newscript V2 failed:', res.error);
        cb('');
        return;
      }
      var addr = res.response.address;
      console.log('[CREATOR] ESCROW_ADDRESS_V2 derived:', addr);
      MDS.keypair.set('ESCROW_ADDRESS_V2', addr, function() {});
      cb(addr);
    });
  });
}

function resolveChannelScriptAddress(cb) {
  MDS.keypair.get('CHANNEL_SCRIPT_ADDRESS', function(addrRes) {
    var cached = addrRes && addrRes.status ? addrRes.value : '';
    if (cached) {
      console.log('[CREATOR] CHANNEL_SCRIPT_ADDRESS from keypair:', cached);
      cb(cached);
      return;
    }
    console.log('[CREATOR] CHANNEL_SCRIPT_ADDRESS not in keypair — deriving via newscript');
    MDS.cmd('newscript script:"' + CHANNEL_SCRIPT_FE + '" trackall:true', function(res) {
      if (!res.status) {
        console.error('[CREATOR] newscript channel failed:', res.error);
        cb('');
        return;
      }
      var addr = res.response.address;
      console.log('[CREATOR] CHANNEL_SCRIPT_ADDRESS derived:', addr);
      MDS.keypair.set('CHANNEL_SCRIPT_ADDRESS', addr, function() {});
      cb(addr);
    });
  });
}

function fundEscrowAndPublish(campaign, ad, form, submitBtn, msgEl, campaignDurationBlocks) {
  function fail(reason) {
    console.error('[CREATOR] fail:', reason);
    msgEl.textContent = reason;
    if (submitBtn) { submitBtn.removeAttribute('disabled'); }
  }

  resolveEscrowAddress(function(escrowAddress) {
    if (!escrowAddress) {
      fail('Could not resolve escrow address. Check node logs.');
      return;
    }

    resolveChannelScriptAddress(function(channelScriptAddress) {
      if (!channelScriptAddress) {
        fail('Could not resolve channel script address. Check node logs.');
        return;
      }

      // Per-campaign wallet key — isolates this campaign on-chain from other campaigns and the main wallet.
      // KeyRow.toJSON returns { publickey, ... } directly under response — see refs/Minima-1.0.45/src/.../search/keys.java action:new.
      MDS.cmd('keys action:new', function(keysRes) {
        if (!keysRes.status || !keysRes.response || !keysRes.response.publickey) {
          fail('Could not generate per-campaign wallet key.');
          return;
        }
        var walletPK = keysRes.response.publickey;
        console.log('[CREATOR] per-campaign walletPK:', walletPK);

        MDS.cmd('block', function(blockRes) {
          if (!blockRes.status) {
            fail('Could not fetch current block.');
            return;
          }
          var expiryBlock = parseInt(blockRes.response.block) + campaignDurationBlocks;
          console.log('[CREATOR] expiryBlock:', expiryBlock);

          MDS.cmd('maxima action:info', function(mxRes) {
            if (!mxRes.status) {
              fail('Could not fetch Maxima identity.');
              return;
            }
            var creatorContact    = mxRes.response.contact;
            var campaignIdHex     = '0x' + utf8ToHex(campaign.id).toUpperCase();
            var creatorContactHex = '0x' + utf8ToHex(creatorContact).toUpperCase();

            // T-PUB4 — embed PLATFORM_KEY at port 5 and max_publisher_budget at port 6.
            // PLATFORM_KEY is global (declared in config.js). null → fee branch disabled.
            var hasPlatformKey = (typeof PLATFORM_KEY !== 'undefined') && PLATFORM_KEY !== null && PLATFORM_KEY !== '';
            var platformKeyHex = hasPlatformKey ? PLATFORM_KEY : '0x00';
            var maxPubBudget   = (campaign.max_publisher_budget && campaign.max_publisher_budget > 0)
                                   ? campaign.max_publisher_budget : 0;
            var feeflag        = hasPlatformKey ? 1 : 0;
            var feeAmount      = hasPlatformKey ? (campaign.budget_total * PLATFORM_FEE_RATE) : 0;
            var feeOutputIndex = 0;

            // Funding-tx state. Ports 1–6 become PREVSTATE(N) on the escrow coin
            // when later spent. Port 11 is included as an explicit marker; the
            // script reads STATE(11) which is set by the spending tx (channel-open
            // sets it to 0; this funding-time value is informational only).
            var stateJson = '{"1":"' + walletPK
                          + '","2":"' + expiryBlock
                          + '","3":"' + campaignIdHex
                          + '","4":"' + creatorContactHex
                          + '","5":"' + platformKeyHex
                          + '","6":"' + maxPubBudget
                          + '","11":"' + feeflag + '"}';

            if (hasPlatformKey) {
              stateJson = stateJson.slice(0, -1) // drop trailing }
                        + ',"12":"' + feeAmount
                        + '","13":"' + feeOutputIndex + '"}';
            }

            campaign.escrow_wallet_pk = walletPK;

            function onSendResult(sendRes) {
              console.log('[CREATOR] send response:', JSON.stringify(sendRes));

              if (sendRes && sendRes.pending) {
                console.log('[CREATOR] send is pending approval, uid:', sendRes.pendinguid, 'campaignId:', campaign.id);
                var pendingData = JSON.stringify({ campaign: campaign, ad: ad });
                MDS.keypair.set('PENDING_CAMPAIGN_' + campaign.id, pendingData, function() {
                  console.log('[CREATOR] pending data stored in keypair for campaign:', campaign.id);
                });
                msgEl.textContent = 'Awaiting approval — please approve in Minima Hub pending queue.';
                if (submitBtn) { submitBtn.removeAttribute('disabled'); }
                return;
              }

              if (!sendRes || !sendRes.status) {
                fail('Escrow send failed: ' + (sendRes && sendRes.error ? sendRes.error : 'unknown error'));
                return;
              }

              // Locate the escrow output by address — its index depends on whether
              // a fee output precedes it (feeflag=1 puts fee at output[0], escrow at [1]).
              var coinId = '';
              try {
                var outs = sendRes.response.body.txn.outputs;
                for (var i = 0; i < outs.length; i++) {
                  if (outs[i].address && outs[i].address.toUpperCase() === escrowAddress.toUpperCase()) {
                    coinId = outs[i].coinid;
                    break;
                  }
                }
                if (!coinId) { coinId = outs[0].coinid; }
              } catch (ex) {
                console.error('[CREATOR] coinId extraction failed. Full response:', JSON.stringify(sendRes));
                fail('Could not read escrow coinId from send response.');
                return;
              }

              console.log('[CREATOR] escrow coinId:', coinId);
              campaign.escrow_coinid = coinId;
              msgEl.textContent = 'Escrow funded. Saving campaign…';

              saveCampaignAndBroadcast(campaign, ad, form, submitBtn, msgEl);
            }

            if (!hasPlatformKey) {
              // MVP path — feeflag=0, no fee output. Same shape as before T-PUB4.
              console.log('[CREATOR] sending to escrow (feeflag=0):', escrowAddress, 'state:', stateJson);
              MDS.cmd(
                'send amount:' + campaign.budget_total
                  + ' address:' + escrowAddress
                  + ' state:' + stateJson,
                onSendResult
              );
              return;
            }

            // PLATFORM_KEY set — feeflag=1. Build a multi-output tx:
            //   output[0] → PLATFORM_KEY (fee, 6% of budget_total, no state)
            //   output[1] → escrow (budget_total, with state)
            //   change → back to creator wallet (auto-added by txnpost)
            console.log('[CREATOR] sending to escrow (feeflag=1):', escrowAddress,
              'fee:', feeAmount, '→', platformKeyHex, 'state:', stateJson);
            buildEscrowFundingTx({
              walletPK:       walletPK,
              budgetTotal:    campaign.budget_total,
              feeAmount:      feeAmount,
              feeOutputIndex: feeOutputIndex,
              escrowAddress:  escrowAddress,
              platformKey:    platformKeyHex,
              stateJson:      stateJson
            }, onSendResult);
          });
        });
      });
    });
  });
}

// T-PUB4 — Fund escrow when a platform fee applies (feeflag=1).
// Uses send multi: for one atomic tx with two outputs — same coin-selection
// engine as the feeflag=0 send path (proven to work). fee output gets
// storestate:true too (harmless — state not used when spending wallet coins).
function buildEscrowFundingTx(opts, onResult) {
  MDS.cmd(
    'send multi:["' + opts.platformKey + ':' + opts.feeAmount
      + '","' + opts.escrowAddress + ':' + opts.budgetTotal + '"]'
      + ' state:' + opts.stateJson,
    function(r) { onResult(r); }
  );
}

function saveCampaignAndBroadcast(campaign, ad, form, submitBtn, msgEl) {
  saveCampaign(campaign, ad, function(err) {
    if (err) {
      console.error('[CREATOR] local save failed:', err);
      if (msgEl) { msgEl.textContent = 'Local save failed: ' + err; }
      if (submitBtn) { submitBtn.removeAttribute('disabled'); }
      return;
    }
    console.log('[CREATOR] campaign saved locally:', campaign.id);
    var payload = { type: 'CAMPAIGN_ANNOUNCE', campaign: campaign, ad: ad };
    if (campaign.max_viewer_reward !== null && campaign.max_viewer_reward !== undefined) {
      payload.max_viewer_reward = campaign.max_viewer_reward;
    }
    if (campaign.publisher_reward_view > 0) {
      payload.publisher_reward_view = campaign.publisher_reward_view;
      payload.max_publisher_budget  = campaign.max_publisher_budget;
    }
    if (typeof PLATFORM_KEY !== 'undefined' && PLATFORM_KEY) {
      payload.platform_key = PLATFORM_KEY;
    }
    broadcastMaxima(payload, function(ok) {
      if (submitBtn) { submitBtn.removeAttribute('disabled'); }
      if (!ok) {
        if (msgEl) { msgEl.textContent = 'Campaign published. (Maxima broadcast failed — on-chain discovery still active.)'; }
        return;
      }
      if (msgEl) { msgEl.textContent = 'Campaign published. ID: ' + campaign.id; }
      if (form) { form.reset(); }
    });
  });
}
