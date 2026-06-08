// T10 — Creator view.
// _pendingImageData: holds the compressed base64 data URI between file selection and submit.
var _pendingImageData = null;
// Cleanup function for the image drag positioner — removed before each re-render.
var _detachPositioner = null;
// Cleanup function for the split divider drag listeners.
var _detachDivider = null;
// Renders the campaign creation form, funds the KissVM escrow, and persists
// the campaign locally via saveCampaign(). Campaign propagates to other nodes
// automatically via on-chain discovery (MinimaAds.md §8.1).
// Escrow flow: MinimaAds.md §6.3 / Appendix B.

// ~1728 blocks per day at ~50 s/block.
var BLOCKS_PER_DAY = 1728;

// Platform fee rate — MinimaAds.md §6.1 (F = 0.06).
var PLATFORM_FEE_RATE = 0.06;

// Auto-balance configuration
var AUTO_BALANCE_CONFIG = {
  REWARD_RATIO_CLICK_TO_VIEW: 2.0,
  PUBLISHER_REWARD_RATIO: 0.5,
  PUBLISHER_BUDGET_RATIO: 0.10,
  MULTIPLIER_MIN: 1.0,
  MULTIPLIER_MAX: 10.0,
  MULTIPLIER_DEFAULT: 2.0,
  BUDGET_TIERS: [
    { max: 500, reward_view: 0.10, reward_click: 0.20 },
    { max: 2000, reward_view: 0.05, reward_click: 0.10 },
    { max: 10000, reward_view: 0.02, reward_click: 0.04 },
    { max: Infinity, reward_view: 0.01, reward_click: 0.02 }
  ]
};

function formatMinima(val) {
  var s = val.toFixed(6).replace(/\.?0+$/, '');
  var parts = s.split('.');
  var thouSep = window.NUMFMT === 'EU' ? '.' : ',';
  var decSep  = window.NUMFMT === 'EU' ? ',' : '.';
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thouSep);
  return parts.length > 1 ? parts[0] + decSep + parts[1] : parts[0];
}

function getAutoBalanceDefaults(budgetTotal) {
  for (var i = 0; i < AUTO_BALANCE_CONFIG.BUDGET_TIERS.length; i++) {
    var tier = AUTO_BALANCE_CONFIG.BUDGET_TIERS[i];
    if (budgetTotal < tier.max) {
      return { reward_view: tier.reward_view, reward_click: tier.reward_click };
    }
  }
  return { reward_view: 0.01, reward_click: 0.02 };
}

function calculateAutoBalanceMetrics(form) {
  var autoBalance = form.querySelector('[name="auto_balance"]').checked;
  if (!autoBalance) { return null; }

  var budget = parseAmt(form.querySelector('[name="budget"]').value);
  var campaignDays = parseInt(form.querySelector('[name="campaign_days"]').value, 10) || 7;
  var multiplier = parseFloat(form.querySelector('[name="multiplier"]').value) || AUTO_BALANCE_CONFIG.MULTIPLIER_DEFAULT;
  var defaults = getAutoBalanceDefaults(budget);

  var rewardView = defaults.reward_view;
  var rewardClick = defaults.reward_click;
  var maxPublisherBudget = budget * AUTO_BALANCE_CONFIG.PUBLISHER_BUDGET_RATIO;
  var budgetForViewers = budget - maxPublisherBudget;
  var maxViewerReward = (rewardView + rewardClick) * multiplier;

  var perViewerChannelMax = (rewardView + rewardClick) * campaignDays;
  var maxViewers = Math.floor(budgetForViewers / perViewerChannelMax);

  var dailyRewardPerViewer = (100 * rewardView) + (100 * rewardClick);
  var publisherRewardView = (rewardView + rewardClick) * AUTO_BALANCE_CONFIG.PUBLISHER_REWARD_RATIO;
  var totalCostWithFee = budget * (1 + PLATFORM_FEE_RATE);

  return {
    reward_view: rewardView,
    reward_click: rewardClick,
    max_viewer_reward: maxViewerReward,
    per_viewer_channel_max: perViewerChannelMax,
    max_viewers: maxViewers,
    daily_reward_per_viewer: dailyRewardPerViewer,
    max_publisher_budget: maxPublisherBudget,
    publisher_reward_view: publisherRewardView,
    total_cost: totalCostWithFee,
    campaign_days: campaignDays
  };
}

function computeTextColor(hex) {
  hex = (hex || '#ffffff').replace('#', '');
  if (hex.length === 3) { hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]; }
  var r = parseInt(hex.substring(0, 2), 16) / 255;
  var g = parseInt(hex.substring(2, 4), 16) / 255;
  var b = parseInt(hex.substring(4, 6), 16) / 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) > 0.5 ? '#111111' : '#f0f0f0';
}

var AD_THEMES = [
  { label: 'Light', bg: '#ffffff', text: '#111111' },
  { label: 'Dark', bg: '#1a1a2e', text: '#f0f0f0' },
  { label: 'Orange', bg: '#ff6a00', text: '#ffffff' },
  { label: 'Ocean', bg: '#0a3d62', text: '#f0f0f0' },
  { label: 'Forest', bg: '#1e6b3c', text: '#f0f0f0' },
  { label: 'Warm', bg: '#fff3e0', text: '#5d3a00' }
];

function _renderThemeSwatches(form) {
  var container = document.getElementById('ma-theme-presets');
  if (!container) { return; }
  for (var i = 0; i < AD_THEMES.length; i++) {
    (function (theme) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.title = theme.label;
      btn.style.cssText = 'width:2rem;height:2rem;border-radius:50%;background:' + theme.bg
        + ';border:2px solid #aaa;cursor:pointer;padding:0;flex-shrink:0;';
      btn.addEventListener('click', function () {
        var bgInput = form.querySelector('[name="bg_color"]');
        if (bgInput) { bgInput.value = theme.bg; bgInput.dataset.textColor = theme.text; }
        updateCreatorPreview(form);
      });
      container.appendChild(btn);
    })(AD_THEMES[i]);
  }
}

function renderCreator(root) {
  root.innerHTML = '';

  var h2 = document.createElement('h2');
  h2.textContent = 'Create Campaign';
  h2.style.cssText = 'margin:0 0 1.5rem 0;padding:1rem;background:rgba(0,0,0,0.02);border-left:4px solid #9b59b6;border-radius:0.375rem;';
  root.appendChild(h2);

  // Check for permanent Maxima route — redirect to settings if not registered.
  getCreatorMaximaRoute(function(route) {
    if (!route) {
      window.location.hash = 'settings/maxima-routes';
    }
  });

  var form = document.createElement('form');
  form.id = 'ma-creator-form';
  form.innerHTML = ''
    + '<div class="ma-tabs-container">'
    + '  <div class="ma-tabs" id="ma-creator-tabs" role="tablist" aria-label="Campaign setup">'
    + '    <button type="button" id="ma-tab-content" role="tab" aria-selected="true" aria-controls="ma-panel-content" data-target="ma-panel-content">Add Content</button>'
    + '    <button type="button" id="ma-tab-budget" role="tab" aria-selected="false" aria-controls="ma-panel-budget" data-target="ma-panel-budget">Budget</button>'
    + '    <button type="button" id="ma-tab-viewer" role="tab" aria-selected="false" aria-controls="ma-panel-viewer" data-target="ma-panel-viewer">Viewer Rewards</button>'
    + '    <button type="button" id="ma-tab-publisher" role="tab" aria-selected="false" aria-controls="ma-panel-publisher" data-target="ma-panel-publisher">Publisher Rewards</button>'
    + '    <button type="button" id="ma-tab-review" role="tab" aria-selected="false" aria-controls="ma-panel-review" data-target="ma-panel-review">Review</button>'
    + '  </div>'
    + '  <span class="ma-tabs-arrow left" id="ma-creator-tabs-arrow-left">&#8249;</span>'
    + '  <span class="ma-tabs-arrow right" id="ma-creator-tabs-arrow-right">&#8250;</span>'
    + '</div>'
    + '<div class="ma-tab-panel" id="ma-panel-content" role="tabpanel" aria-labelledby="ma-tab-content">'
    + '  <div class="ma-section-group content-section">'
    + '    <strong class="ma-section-title">Ad content</strong>'
    + '    <label>Campaign title'
    + '      <input name="title" value="Campanya " required maxlength="50">'
    + '    </label>'
    + '    <label style="display:flex;align-items:center;gap:0.5rem;font-weight:normal;margin-top:-0.5rem;margin-bottom:0.75rem;">'
    + '      <input type="checkbox" name="show_title" checked style="margin:0;"> Show title in banner</label>'
    + '    <label>Ad description'
    + '      <textarea name="body" required maxlength="90">Descripció de la campanya de prova</textarea>'
    + '    </label>'
    + '    <label style="display:flex;align-items:center;gap:0.5rem;font-weight:normal;margin-top:-0.5rem;margin-bottom:0.75rem;">'
    + '      <input type="checkbox" name="show_body" checked style="margin:0;"> Show description in banner</label>'
    + '    <label>Interests (comma-separated)'
    + '      <input name="interests" value="tech, web3, minima" placeholder="tech, web3, minima">'
    + '    </label>'
    + '    <label>CTA label'
    + '      <input name="cta_label" value="Visit" required maxlength="64">'
    + '    </label>'
    + '    <label>CTA URL'
    + '      <input name="cta_url" type="url" value="https://minima.global" required>'
    + '    </label>'
    + '    <label style="display:flex;align-items:center;gap:0.5rem;font-weight:normal;margin-top:-0.5rem;margin-bottom:0.25rem;">'
    + '      <input type="checkbox" name="show_cta" checked style="margin:0;"> Show CTA button</label>'
    + '    <small style="display:block;margin-bottom:0.75rem;color:var(--pico-muted-color,#6c757d);">Clicking the image still navigates when the button is hidden.</small>'
    + '  </div>'
    + '  <div class="ma-section-group content-section">'
    + '    <strong class="ma-section-title">Visual</strong>'
    + '    <label style="margin-bottom:1.5rem !important;display:block;">Banner image (optional)'
    + '      <input name="image_file" type="file" accept="image/*" style="margin-bottom:0.75rem !important;display:block;width:100%;">'
    + '      <small style="display:block;margin-top:0.25rem;">Recommended: <strong>2:1</strong> (ex. 600&times;300 px). Compressed to JPEG and sent to viewers via Maxima. Max ~55&nbsp;KB after compression.</small>'
    + '    </label>'
    + '    <div id="ma-image-preview" style="display:none;margin-top:0.5rem;"></div>'
    + '    <input type="hidden" name="image_position" value="center">'
    + '    <input type="hidden" name="image_zoom" value="1.0">'
    + '    <input type="hidden" name="image_width_pct" value="40">'
    + '    <div style="margin-top:0.75rem;">'
    + '      <small style="display:block;margin-bottom:0.4rem;color:var(--pico-muted-color,#6c757d);">Banner theme</small>'
    + '      <div id="ma-theme-presets" style="display:flex;flex-wrap:wrap;gap:0.4rem;margin-bottom:0.5rem;"></div>'
    + '      <label style="margin:0;">Custom background'
    + '        <input type="color" name="bg_color" value="#ffffff" style="height:2rem;padding:0.1rem 0.2rem;cursor:pointer;width:4rem;">'
    + '      </label>'
    + '    </div>'
    + '  </div>'
    + '  <div class="ma-section-group content-section">'
    + '    <strong class="ma-section-title">Ad preview</strong>'
    + '    <div style="display:flex;gap:0.5rem;margin-bottom:0.4rem;flex-wrap:wrap;">'
    + '      <button type="button" id="ma-preview-btn-mobile"  style="font-size:0.72rem;padding:0.15rem 0.45rem;border-radius:3px;font-weight:700;">Mobile</button>'
    + '      <button type="button" id="ma-preview-btn-desktop" style="font-size:0.72rem;padding:0.15rem 0.45rem;border-radius:3px;font-weight:400;">Desktop</button>'
    + '      <button type="button" id="ma-creator-preview-open-btn" style="font-size:0.72rem;padding:0.15rem 0.45rem;border-radius:3px;font-weight:400;">View preview</button>'
    + '    </div>'
    + '    <div id="ma-creator-preview" style="min-height:2rem;"></div>'
    + '    <div id="ma-creator-mobile-controls" style="display:none;padding:.5rem 0;margin-top:.5rem;">'
    + '      <small style="display:block;font-weight:600;margin-bottom:.3rem;">Image position &amp; size</small>'
    + '      <label style="font-size:.85rem;margin-bottom:.3rem;display:block;">Horizontal (%)'
    + '        <input type="range" id="ma-img-pos-x" min="0" max="100" value="50" style="margin:.15rem 0 0;">'
    + '      </label>'
    + '      <label style="font-size:.85rem;margin-bottom:.3rem;display:block;">Vertical (%)'
    + '        <input type="range" id="ma-img-pos-y" min="0" max="100" value="50" style="margin:.15rem 0 0;">'
    + '      </label>'
    + '      <label style="font-size:.85rem;margin-bottom:.3rem;display:block;">Image width (%)'
    + '        <input type="range" id="ma-img-width-pct" min="20" max="70" value="40" style="margin:.15rem 0 0;">'
    + '      </label>'
    + '    </div>'
    + '  </div>'
    + '</div>'
    + '<div class="ma-tab-panel" id="ma-panel-budget" role="tabpanel" aria-labelledby="ma-tab-budget" hidden>'
    + '  <div class="ma-grid-2col">'
    + '    <div class="ma-section-group budget-section">'
    + '      <strong class="ma-section-title">Campaign budget</strong>'
    + '      <label>Total budget (MINIMA) — min ' + LIMITS.MIN_BUDGET + ' MINIMA'
    + '        <input name="budget" type="text" inputmode="decimal" min="' + LIMITS.MIN_BUDGET + '" value="1000" required>'
    + '        <small id="ma-budget-hint">Checking wallet balance…</small>'
    + '      </label>'
    + '    </div>'
    + '    <div class="ma-section-group budget-section">'
    + '      <strong class="ma-section-title">Duration</strong>'
    + '      <label>Campaign duration (days) — max ' + LIMITS.MAX_CAMPAIGN_DAYS
    + '        <input name="campaign_days" type="number" step="1" min="1" max="' + LIMITS.MAX_CAMPAIGN_DAYS + '" value="7" required>'
    + '      </label>'
    + '    </div>'
    + '  </div>'
    + '  <div class="ma-autobalance-control">'
    + '    <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;margin:0;padding:0.75rem;border-radius:0.375rem;transition:background-color 0.15s ease;background-color:var(--pico-form-element-focus-border-color,rgba(99,102,241,0.08));">'
    + '      <input type="checkbox" name="auto_balance" style="margin:0;">'
    + '      <span style="font-weight:600;color:var(--pico-primary,#6366f1);">Auto-calculate rewards & cap</span>'
    + '    </label>'
    + '    <small style="display:block;margin-top:0.35rem;margin-left:1.75rem;color:var(--pico-muted-color,#6c757d);font-size:0.8rem;line-height:1.4;">'
    + '      Automatically fill reward rates and viewer cap based on your budget. Adjust the multiplier to balance reach vs. incentive. Shows estimated viewers, daily rewards, and total cost.'
    + '    </small>'
    + '  </div>'
    + '  <div id="ma-autobalance-metrics" style="display:none;margin-top:1.5rem;padding:1rem;background-color:var(--pico-form-element-focus-border-color,rgba(99,102,241,0.08));border-radius:0.5rem;border-left:4px solid var(--pico-primary,#6366f1);">'
    + '    <strong style="display:block;margin-bottom:1rem;">Estimated metrics</strong>'
    + '    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1rem;margin-bottom:1.5rem;">'
    + '      <div><small style="color:var(--pico-muted-color);display:block;margin-bottom:0.3rem;">Max viewers</small><strong id="ma-metric-viewers" style="font-size:1.1rem;">—</strong></div>'
    + '      <div><small style="color:var(--pico-muted-color);display:block;margin-bottom:0.3rem;">Daily reward/viewer</small><strong id="ma-metric-daily" style="font-size:1.1rem;">—</strong></div>'
    + '      <div><small style="color:var(--pico-muted-color);display:block;margin-bottom:0.3rem;">Multiplier</small><input type="range" id="ma-multiplier-slider" min="1" max="10" step="0.1" value="2" style="width:100%;margin:0;padding:0;"> <strong id="ma-multiplier-display" style="display:block;margin-top:0.3rem;font-size:0.95rem;">×2.0</strong></div>'
    + '      <div><small style="color:var(--pico-muted-color);display:block;margin-bottom:0.3rem;">Pub budget pool</small><strong id="ma-metric-pub-budget" style="font-size:1.1rem;">—</strong></div>'
    + '    </div>'
    + '    <div style="padding:0.75rem;background:rgba(0,0,0,0.02);border-radius:0.375rem;margin-bottom:1rem;">'
    + '      <small style="color:var(--pico-muted-color);display:block;margin-bottom:0.3rem;">Per-viewer channel max</small>'
    + '      <strong id="ma-metric-channel-max" style="font-size:1rem;">—</strong>'
    + '    </div>'
    + '    <div style="border-top:1px solid var(--pico-muted-border-color,#e0e0e0);padding-top:1rem;">'
    + '      <small style="color:var(--pico-muted-color);display:block;margin-bottom:0.5rem;"><strong>Publishers (estimate):</strong></small>'
    + '      <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.75rem;">'
    + '        <button type="button" class="ma-pub-est" data-publishers="5" style="font-size:0.85rem;padding:0.4rem 0.7rem;margin:0;border-radius:0.375rem;">5</button>'
    + '        <button type="button" class="ma-pub-est" data-publishers="10" style="font-size:0.85rem;padding:0.4rem 0.7rem;margin:0;border-radius:0.375rem;">10</button>'
    + '        <button type="button" class="ma-pub-est" data-publishers="25" style="font-size:0.85rem;padding:0.4rem 0.7rem;margin:0;border-radius:0.375rem;">25</button>'
    + '        <button type="button" class="ma-pub-est" data-publishers="50" style="font-size:0.85rem;padding:0.4rem 0.7rem;margin:0;border-radius:0.375rem;">50</button>'
    + '      </div>'
    + '      <div id="ma-pub-est-display" style="display:block;font-size:0.9rem;color:var(--pico-color);"></div>'
    + '    </div>'
    + '    <div style="border-top:1px solid var(--pico-muted-border-color,#e0e0e0);padding-top:1rem;margin-top:1rem;">'
    + '      <div style="display:flex;justify-content:space-between;align-items:baseline;">'
    + '        <small style="color:var(--pico-muted-color);">Total cost (w/ 6% fee)</small>'
    + '        <strong id="ma-metric-cost" style="font-size:1.1rem;color:var(--pico-primary,#6366f1);">—</strong>'
    + '      </div>'
    + '    </div>'
    + '  </div>'
    + '</div>'
    + '<div class="ma-tab-panel" id="ma-panel-viewer" role="tabpanel" aria-labelledby="ma-tab-viewer" hidden>'
    + '  <div class="ma-grid-2col">'
    + '    <div class="ma-section-group viewer-section">'
    + '      <strong class="ma-section-title">Rewards</strong>'
    + '      <label>Reward per view (MINIMA)'
    + '        <input name="reward_view" type="text" inputmode="decimal" value="1" required>'
    + '        <small id="ma-reward-view-hint" style="display:block;margin-top:0.2rem;"></small>'
    + '      </label>'
    + '      <label>Reward per click (MINIMA)'
    + '        <input name="reward_click" type="text" inputmode="decimal" value="2" required>'
    + '        <small id="ma-reward-click-hint" style="display:block;margin-top:0.2rem;"></small>'
    + '      </label>'
    + '      <label>Max reward per viewer (MINIMA)'
    + '        <input name="max_viewer_reward" type="text" inputmode="decimal" value="10" required>'
    + '        <small id="ma-cap-min-hint" style="display:block;margin-top:0.2rem;"></small>'
    + '        <span id="ma-multiplier-row" style="display:none;align-items:center;gap:0.5rem;margin-top:0.35rem;">'
    + '          <small style="color:var(--pico-muted-color)">(view + click) &times;</small>'
    + '          <input name="multiplier" type="number" step="0.1" min="1" value="2"'
    + '            style="width:5rem;margin:0;padding:0.2rem 0.4rem;">'
    + '        </span>'
    + '        <small id="ma-max-viewer-hint"></small>'
    + '      </label>'
    + '    </div>'
    + '    <div class="ma-section-group viewer-section">'
    + '      <strong class="ma-section-title">Limits</strong>'
    + '      <label>Daily view limit (per viewer)'
    + '        <input name="max_daily_views" type="number" step="1" min="1" value="100" required>'
    + '        <small id="ma-daily-views-hint" style="display:block;margin-top:0.2rem;"></small>'
    + '      </label>'
    + '      <label>Daily click limit (per viewer)'
    + '        <input name="max_daily_clicks" type="number" step="1" min="1" value="100" required>'
    + '        <small id="ma-daily-clicks-hint" style="display:block;margin-top:0.2rem;"></small>'
    + '      </label>'
    + '      <label>Cooldown between rewards (seconds)'
    + '        <input name="cooldown_s" type="number" step="1" min="1" value="300" required>'
    + '        <small>Minimum time between two rewards for the same viewer (default 5 min)</small>'
    + '      </label>'
    + '    </div>'
    + '  </div>'
    + '</div>'
    + '<div class="ma-tab-panel" id="ma-panel-publisher" role="tabpanel" aria-labelledby="ma-tab-publisher" hidden>'
    + '  <div class="ma-grid-2col">'
    + '    <div class="ma-section-group publisher-section">'
    + '      <strong class="ma-section-title">Publisher rewards</strong>'
    + '      <label>Publisher reward per view (MINIMA)'
    + '        <input name="publisher_reward_view" type="text" inputmode="decimal" value="10">'
    + '        <small id="ma-publisher-reward-hint" style="display:block;margin-top:0.2rem;"></small>'
    + '      </label>'
    + '      <label>Max publisher budget (MINIMA)'
    + '        <input name="max_publisher_budget" type="text" inputmode="decimal" value="100">'
    + '        <small id="ma-publisher-budget-hint" style="display:block;margin-top:0.2rem;"></small>'
    + '      </label>'
    + '    </div>'
    + '    <div class="ma-section-group publisher-section" style="display:flex; flex-direction:column; justify-content:center; padding:1.25rem 1rem;">'
    + '      <strong class="ma-section-title">Budget notes</strong>'
    + '      <div style="padding:0.75rem 1rem;border-left:3px solid var(--pico-primary);background-color:rgba(0,0,0,0.015);border-radius:0 var(--pico-border-radius) var(--pico-border-radius) 0;font-size:0.78rem;line-height:1.35;margin-bottom:0;">'
    + '        <strong>Note on Publisher Budget:</strong> The <em>Max publisher budget</em> reserves a portion of the campaign\'s total budget. When publishers embed your ad, their nodes open payment channels. These channels reserve their capacities dynamically (up to this limit) and pay rewards as views accumulate. You can monitor these dynamic metrics in the campaign dashboard.'
    + '      </div>'
    + '    </div>'
    + '  </div>'
    + '</div>'
    + '<div class="ma-tab-panel" id="ma-panel-review" role="tabpanel" aria-labelledby="ma-tab-review" hidden>'
    + '  <div class="ma-section-group content-section">'
    + '    <strong class="ma-section-title">Ad preview</strong>'
    + '    <div id="ma-creator-preview-review" style="margin-bottom:0;"></div>'
    + '  </div>'
    + '  <div class="ma-section-group budget-section">'
    + '    <strong class="ma-section-title">Campaign summary</strong>'
    + '    <div id="ma-campaign-reach-review"></div>'
    + '    <div id="ma-campaign-cost" style="margin-top:0.75rem;"></div>'
    + '    <button type="submit" style="width:100%;margin-top:1.25rem;">Publish Campaign</button>'
    + '    <p id="ma-creator-msg" role="status" style="margin-top:1rem;margin-bottom:0;text-align:center;font-weight:600;"></p>'
    + '  </div>'
    + '</div>';
  root.appendChild(form);

  setupCreatorTabs(form);
  form.addEventListener('submit', onCreatorSubmit);
  form.addEventListener('input', function(e) {
    onCreatorFormInput(e);
    if (['budget', 'campaign_days', 'multiplier'].includes(e.target.name)) {
      recalculateAllMetrics(form);
    }
  });
  form.addEventListener('change', function(e) {
    onCreatorFormChange(e);
    if (e.target.name === 'auto_balance') {
      recalculateAllMetrics(form);
    }
  });
  var budgetInput = form.querySelector('[name="budget"]');
  budgetInput.addEventListener('focus', function () {
    var thouSep = window.NUMFMT === 'EU' ? '.' : ',';
    this.value = this.value.replace(new RegExp('\\' + thouSep, 'g'), '');
  });
  budgetInput.addEventListener('blur', function () {
    var val = parseAmt(this.value);
    if (isFinite(val) && val > 0) { this.value = formatMinima(val); }
  });
  var daysInput = form.querySelector('[name="campaign_days"]');
  if (daysInput) {
    daysInput.addEventListener('keydown', function (e) {
      if (e.key === '.' || e.key === ',') { e.preventDefault(); }
    });
  }
  var imageInput = form.querySelector('[name="image_file"]');
  if (imageInput) {
    imageInput.addEventListener('change', function () { onImageFileSelect(this); });
  }

  var pubEstButtons = form.querySelectorAll('.ma-pub-est');
  if (pubEstButtons.length > 0) {
    pubEstButtons.forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        pubEstButtons.forEach(function(b) { b.style.fontWeight = '400'; });
        this.style.fontWeight = '600';
        recalculateAllMetrics(form);
      });
    });
  }

  var multiplierSlider = document.getElementById('ma-multiplier-slider');
  if (multiplierSlider) {
    multiplierSlider.addEventListener('input', function() {
      var multiplyInput = form.querySelector('input[name="multiplier"]');
      if (multiplyInput) {
        multiplyInput.value = this.value;
      }
      recalculateAllMetrics(form);
    });
  }

  var multiplyInput = form.querySelector('input[name="multiplier"]');
  if (multiplyInput) {
    multiplyInput.addEventListener('input', function() {
      var slider = document.getElementById('ma-multiplier-slider');
      if (slider) {
        slider.value = this.value;
      }
      recalculateAllMetrics(form);
    });
  }

  form.addEventListener('reset', function () {
    _pendingImageData = null;
    var preview = document.getElementById('ma-image-preview');
    if (preview) { preview.innerHTML = ''; preview.style.display = 'none'; }
    setTimeout(function () {
      var bgInput = form.querySelector('[name="bg_color"]');
      if (bgInput) { bgInput.dataset.textColor = computeTextColor(bgInput.value); }
      enforceViewerRewardLimits(form); applyAutoBalance(form); enforceCapMinimum(form); enforceDailyLimits(form); enforcePublisherLimits(form); updateCampaignSummary(form); updateCreatorPreview(form);
    }, 0);
  });
  _renderThemeSwatches(form);

  var previewBtnMobile = document.getElementById('ma-preview-btn-mobile');
  var previewBtnDesktop = document.getElementById('ma-preview-btn-desktop');
  if (previewBtnMobile && previewBtnDesktop) {
    function _setPreviewWidth(mobile) {
      var p = document.getElementById('ma-creator-preview');
      if (p) { p.style.maxWidth = mobile ? '360px' : ''; }
      previewBtnMobile.style.fontWeight = mobile ? '700' : '400';
      previewBtnDesktop.style.fontWeight = mobile ? '400' : '700';
      var f = document.getElementById('ma-creator-form');
      if (f) { updateCreatorPreview(f); }
    }
    previewBtnMobile.addEventListener('click', function () { _setPreviewWidth(true); });
    previewBtnDesktop.addEventListener('click', function () { _setPreviewWidth(false); });
  }

  // Mobile preview dialog (1A-3)
  var _creatorPreviewDialog = document.createElement('dialog');
  _creatorPreviewDialog.id = 'ma-creator-preview-dialog';
  var _dlgArticle = document.createElement('article');
  _dlgArticle.style.cssText = 'max-width:420px;';
  var _dlgHeader = document.createElement('header');
  var _dlgClose = document.createElement('button');
  _dlgClose.setAttribute('aria-label', 'Close');
  _dlgClose.setAttribute('rel', 'prev');
  _dlgClose.addEventListener('click', function () {
    var d = document.getElementById('ma-creator-preview-dialog');
    if (d) { d.removeAttribute('open'); }
  });
  _dlgHeader.appendChild(_dlgClose);
  var _dlgTitle = document.createElement('strong');
  _dlgTitle.textContent = 'Ad preview';
  _dlgHeader.appendChild(_dlgTitle);
  _dlgArticle.appendChild(_dlgHeader);
  var _dlgBody = document.createElement('div');
  _dlgBody.id = 'ma-creator-preview-modal-body';
  _dlgArticle.appendChild(_dlgBody);
  _creatorPreviewDialog.appendChild(_dlgArticle);
  _creatorPreviewDialog.addEventListener('click', function (e) {
    if (e.target === _creatorPreviewDialog) { _creatorPreviewDialog.removeAttribute('open'); }
  });
  root.appendChild(_creatorPreviewDialog);

  // "View preview" button — copies rendered preview into modal and opens it (mobile only)
  var previewOpenBtn = document.getElementById('ma-creator-preview-open-btn');
  if (previewOpenBtn) {
    previewOpenBtn.addEventListener('click', function () {
      var previewSrc = document.getElementById('ma-creator-preview');
      var modalBody = document.getElementById('ma-creator-preview-modal-body');
      if (previewSrc && modalBody) { modalBody.innerHTML = previewSrc.innerHTML; }
      var dlg = document.getElementById('ma-creator-preview-dialog');
      if (dlg) { dlg.setAttribute('open', ''); }
    });
  }

  // Mobile image position / width controls (1A-3) — range inputs replacing drag
  var posXInput = document.getElementById('ma-img-pos-x');
  var posYInput = document.getElementById('ma-img-pos-y');
  var imgWidthInput = document.getElementById('ma-img-width-pct');
  if (posXInput && posYInput && imgWidthInput) {
    function _onMobilePosInput() {
      var posHidden = form.querySelector('[name="image_position"]');
      var widthHidden = form.querySelector('[name="image_width_pct"]');
      var x = parseInt(posXInput.value, 10);
      var y = parseInt(posYInput.value, 10);
      var w = parseInt(imgWidthInput.value, 10);
      if (posHidden) { posHidden.value = x + '% ' + y + '%'; }
      if (widthHidden) { widthHidden.value = w; }
      updateCreatorPreview(form);
    }
    posXInput.addEventListener('input', _onMobilePosInput);
    posYInput.addEventListener('input', _onMobilePosInput);
    imgWidthInput.addEventListener('input', _onMobilePosInput);
  }

  var bgColorInput = form.querySelector('[name="bg_color"]');
  if (bgColorInput) { bgColorInput.dataset.textColor = computeTextColor(bgColorInput.value); }
  enforceViewerRewardLimits(form);
  applyAutoBalance(form);
  enforceCapMinimum(form);
  enforceDailyLimits(form);
  enforcePublisherLimits(form);
  updateCampaignSummary(form);
  updateCreatorPreview(form);
  loadWalletBalance(form);
}

function setupCreatorTabs(form) {
  var tabs = form.querySelectorAll('[role="tab"][data-target]');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].addEventListener('click', function () {
      selectCreatorTab(form, this.getAttribute('data-target'));
    });
  }
  var creatorTabs = form.querySelector('#ma-creator-tabs');
  var creatorArrowRight = form.querySelector('#ma-creator-tabs-arrow-right');
  var creatorArrowLeft = form.querySelector('#ma-creator-tabs-arrow-left');
  if (creatorTabs && typeof attachScrollIndicator === 'function') {
    var updateFn = attachScrollIndicator(creatorTabs, creatorArrowRight, creatorArrowLeft);
    setTimeout(updateFn, 50);
  }
  form.addEventListener('invalid', function (e) {
    var panel = findCreatorTabPanel(e.target);
    if (panel && panel.id) { selectCreatorTab(form, panel.id); }
  }, true);

  // Add Previous / Next navigation to each panel
  var panelIds = ['ma-panel-content', 'ma-panel-budget', 'ma-panel-viewer', 'ma-panel-publisher', 'ma-panel-review'];
  var panelLabels = ['Add Content', 'Budget', 'Viewer Rewards', 'Publisher Rewards', 'Review'];
  for (var j = 0; j < panelIds.length; j++) {
    (function (idx) {
      var panel = document.getElementById(panelIds[idx]);
      if (!panel) { return; }
      var nav = document.createElement('div');
      nav.style.cssText = 'display:flex;justify-content:space-between;margin-top:1.25rem;gap:.5rem;';
      if (idx > 0) {
        var prevBtn = document.createElement('button');
        prevBtn.type = 'button';
        prevBtn.textContent = '← ' + panelLabels[idx - 1];
        prevBtn.className = 'secondary outline';
        prevBtn.style.cssText = 'width:auto;';
        prevBtn.addEventListener('click', function () { selectCreatorTab(form, panelIds[idx - 1]); });
        nav.appendChild(prevBtn);
      } else {
        nav.appendChild(document.createElement('span'));
      }
      if (idx < panelIds.length - 1) {
        var nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.textContent = panelLabels[idx + 1] + ' →';
        nextBtn.style.cssText = 'width:auto;';
        nextBtn.addEventListener('click', function () { selectCreatorTab(form, panelIds[idx + 1]); });
        nav.appendChild(nextBtn);
      }
      panel.appendChild(nav);
    })(j);
  }
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
  MDS.cmd('balance', function (res) {
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
    budgetInput.dataset.walletMax = sendable;
    var initialBudget = parseAmt(budgetInput.value);
    if (isFinite(initialBudget) && initialBudget > 0) {
      budgetInput.value = formatMinima(initialBudget);
    }
    if (hintEl) {
      hintEl.textContent = 'Available: ' + formatMinima(sendable) + ' MINIMA';
    }
    updateCampaignSummary(form);
  });
}

function compressImageForMaxima(file, callback) {
  var reader = new FileReader();
  reader.onload = function (e) {
    var img = new Image();
    img.onload = function () {
      var maxDim = 800;
      var w = img.width;
      var h = img.height;
      if (w > h) {
        if (w > maxDim) { h = Math.round(h * maxDim / w); w = maxDim; }
      } else {
        if (h > maxDim) { w = Math.round(w * maxDim / h); h = maxDim; }
      }
      var canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      var base64 = canvas.toDataURL('image/jpeg', 0.7);
      if (base64.length * 0.75 > 55000) {
        base64 = canvas.toDataURL('image/jpeg', 0.4);
      }
      callback(base64);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function onImageFileSelect(input) {
  _pendingImageData = null;
  var preview = document.getElementById('ma-image-preview');
  if (preview) { preview.innerHTML = ''; preview.style.display = 'none'; }
  var file = input.files && input.files[0];
  if (!file) { return; }
  if (!file.type.startsWith('image/')) {
    var errMsg = document.getElementById('ma-creator-msg');
    if (errMsg) { errMsg.textContent = 'Please select a valid image file (JPEG, PNG, WebP, etc.).'; }
    input.value = '';
    return;
  }
  compressImageForMaxima(file, function (base64) {
    _pendingImageData = base64;
    if (preview) {
      var approxKb = Math.round(base64.length * 0.75 / 1024);
      var imgEl = document.createElement('img');
      imgEl.src = base64;
      imgEl.style.cssText = 'max-width:300px;max-height:250px;object-fit:contain;border:1px solid #ddd;border-radius:4px;display:block;';
      var note = document.createElement('small');
      note.style.display = 'block';
      note.style.marginTop = '0.25rem';
      if (approxKb > 50) {
        note.style.color = 'var(--pico-color-orange-500, orange)';
        note.textContent = 'Compressed: ~' + approxKb + ' KB (large — may fail Maxima transmission)';
      } else {
        note.textContent = 'Compressed: ~' + approxKb + ' KB';
      }
      var removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.textContent = 'Remove image';
      removeBtn.style.cssText = 'margin-top:0.4rem;';
      removeBtn.addEventListener('click', function () {
        _pendingImageData = null;
        if (_detachPositioner) { _detachPositioner(); _detachPositioner = null; }
        preview.innerHTML = '';
        preview.style.display = 'none';
        var form = document.getElementById('ma-creator-form');
        if (form) {
          var fileInput = form.querySelector('[name="image_file"]');
          if (fileInput) { fileInput.value = ''; }
          var posInput = form.querySelector('[name="image_position"]');
          if (posInput) { posInput.value = 'center'; }
          var widthInput = form.querySelector('[name="image_width_pct"]');
          if (widthInput) { widthInput.value = '40'; }
          updateCreatorPreview(form);
        }
      });
      preview.appendChild(imgEl);
      preview.appendChild(note);
      preview.appendChild(removeBtn);
      preview.style.display = 'block';
    }
    var previewForm = document.getElementById('ma-creator-form');
    if (previewForm) { updateCreatorPreview(previewForm); }
  });
}

function _posToPercent(pos) {
  var map = {
    'left top': '0% 0%', 'center top': '50% 0%', 'right top': '100% 0%',
    'left center': '0% 50%', 'center': '50% 50%', 'right center': '100% 50%',
    'left bottom': '0% 100%', 'center bottom': '50% 100%', 'right bottom': '100% 100%',
    'top': '50% 0%', 'bottom': '50% 100%', 'left': '0% 50%', 'right': '100% 50%'
  };
  return map[pos] || pos;
}

function _attachImagePositioner(form) {
  if (_detachPositioner) { _detachPositioner(); _detachPositioner = null; }

  var preview = document.getElementById('ma-creator-preview');
  if (!preview) { return; }
  var imgEl = preview.querySelector('img');
  if (!imgEl) { return; }

  var posHidden = form.querySelector('[name="image_position"]');
  var pct = _posToPercent(posHidden ? (posHidden.value || 'center') : 'center').split(' ');
  var curX = parseFloat(pct[0]) || 50;
  var curY = parseFloat(pct[1]) || 50;

  var imgParent = imgEl.parentNode;
  var imgWrap = (imgParent.tagName === 'A') ? imgParent.parentNode : imgParent;
  imgWrap.style.position = 'relative';

  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;'
    + 'cursor:grab;z-index:5;user-select:none;-webkit-user-select:none;';
  imgWrap.appendChild(overlay);

  var dragging = false;
  var lastX = 0;
  var lastY = 0;

  function _applyPos(x, y) {
    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));
    curX = x; curY = y;
    var v = Math.round(x) + '% ' + Math.round(y) + '%';
    if (posHidden) { posHidden.value = v; }
    imgEl.style.objectPosition = v;
    imgEl.style.transformOrigin = v;
  }

  function onMouseDown(e) {
    dragging = true;
    lastX = e.clientX; lastY = e.clientY;
    overlay.style.cursor = 'grabbing';
    e.preventDefault();
  }
  function onMouseMove(e) {
    if (!dragging) { return; }
    var rect = overlay.getBoundingClientRect();
    _applyPos(curX - (e.clientX - lastX) / rect.width * 100,
      curY - (e.clientY - lastY) / rect.height * 100);
    lastX = e.clientX; lastY = e.clientY;
  }
  function onMouseUp() {
    if (!dragging) { return; }
    dragging = false;
    overlay.style.cursor = 'grab';
  }
  function onTouchStart(e) {
    dragging = true;
    lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
    e.preventDefault();
  }
  function onTouchMove(e) {
    if (!dragging) { return; }
    var rect = overlay.getBoundingClientRect();
    _applyPos(curX - (e.touches[0].clientX - lastX) / rect.width * 100,
      curY - (e.touches[0].clientY - lastY) / rect.height * 100);
    lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
  }
  function onTouchEnd() { dragging = false; }

  overlay.addEventListener('mousedown', onMouseDown);
  overlay.addEventListener('touchstart', onTouchStart, { passive: false });
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('touchend', onTouchEnd);

  _detachPositioner = function () {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend', onTouchEnd);
  };

  _applyPos(curX, curY);

  var hint = document.createElement('small');
  hint.style.cssText = 'display:block;margin-top:0.3rem;opacity:0.55;';
  var bannerEl = preview.querySelector('.ma-ad-banner');
  var hasDivider = bannerEl && bannerEl.children.length >= 2;
  hint.textContent = hasDivider
    ? 'Drag image to reposition focal point. Drag the divider to resize.'
    : 'Drag image to reposition focal point.';
  preview.appendChild(hint);

}

function _attachDivider(form) {
  if (_detachDivider) { _detachDivider(); _detachDivider = null; }

  var preview = document.getElementById('ma-creator-preview');
  var banner = preview ? preview.querySelector('.ma-ad-banner') : null;
  if (!banner || banner.children.length < 2) { return; }

  var imgWrap = banner.children[0];
  var textBlock = banner.children[1];
  var widthHidden = form.querySelector('[name="image_width_pct"]');

  var divider = document.createElement('div');
  divider.style.cssText = 'width:10px;flex-shrink:0;cursor:col-resize;'
    + 'background:rgba(0,0,0,0.07);display:flex;align-items:center;justify-content:center;z-index:4;';
  var grip = document.createElement('div');
  grip.style.cssText = 'width:2px;height:60%;background:rgba(0,0,0,0.2);border-radius:1px;pointer-events:none;';
  divider.appendChild(grip);
  banner.insertBefore(divider, textBlock);

  var dragging = false;
  var lastDragX = 0;

  function onDivDown(e) {
    dragging = true;
    lastDragX = e.clientX;
    e.preventDefault();
  }
  function onDivMove(e) {
    if (!dragging) { return; }
    var bannerRect = banner.getBoundingClientRect();
    var dx = e.clientX - lastDragX;
    var newPct = Math.round((imgWrap.offsetWidth + dx) / bannerRect.width * 100);
    newPct = Math.max(20, Math.min(70, newPct));
    imgWrap.style.width = newPct + '%';
    if (widthHidden) { widthHidden.value = newPct; }
    textBlock.style.fontSize = Math.max(0.70, Math.min(0.95, (100 - newPct) / 60 * 0.9)).toFixed(2) + 'rem';
    lastDragX = e.clientX;
  }
  function onDivUp() { dragging = false; }
  function onDivTouchStart(e) {
    dragging = true;
    lastDragX = e.touches[0].clientX;
    e.preventDefault();
  }
  function onDivTouchMove(e) {
    if (!dragging) { return; }
    var bannerRect = banner.getBoundingClientRect();
    var dx = e.touches[0].clientX - lastDragX;
    var newPct = Math.round((imgWrap.offsetWidth + dx) / bannerRect.width * 100);
    newPct = Math.max(20, Math.min(70, newPct));
    imgWrap.style.width = newPct + '%';
    if (widthHidden) { widthHidden.value = newPct; }
    textBlock.style.fontSize = Math.max(0.70, Math.min(0.95, (100 - newPct) / 60 * 0.9)).toFixed(2) + 'rem';
    lastDragX = e.touches[0].clientX;
  }
  function onDivTouchEnd() { dragging = false; }

  divider.addEventListener('mousedown', onDivDown);
  divider.addEventListener('touchstart', onDivTouchStart, { passive: false });
  document.addEventListener('mousemove', onDivMove);
  document.addEventListener('mouseup', onDivUp);
  document.addEventListener('touchmove', onDivTouchMove, { passive: false });
  document.addEventListener('touchend', onDivTouchEnd);

  _detachDivider = function () {
    document.removeEventListener('mousemove', onDivMove);
    document.removeEventListener('mouseup', onDivUp);
    document.removeEventListener('touchmove', onDivTouchMove);
    document.removeEventListener('touchend', onDivTouchEnd);
  };
}

function _syncMobileControls(form) {
  var posHidden = form.querySelector('[name="image_position"]');
  var widthHidden = form.querySelector('[name="image_width_pct"]');
  var posXInput = document.getElementById('ma-img-pos-x');
  var posYInput = document.getElementById('ma-img-pos-y');
  var widthInput = document.getElementById('ma-img-width-pct');
  if (!posHidden || !posXInput || !posYInput) { return; }
  var raw = (posHidden.value || '50% 50%').split(' ');
  var x = parseInt(raw[0], 10) || 50;
  var y = parseInt(raw[1], 10) || 50;
  posXInput.value = x;
  posYInput.value = y;
  if (widthHidden && widthInput) {
    widthInput.value = parseInt(widthHidden.value, 10) || 40;
  }
}

function updateCreatorPreview(form) {
  if (typeof renderAd !== 'function') { return; }
  var previewEl = document.getElementById('ma-creator-preview');
  if (!previewEl) { return; }
  var titleEl = form.querySelector('[name="title"]');
  var bodyEl = form.querySelector('[name="body"]');
  var ctaLabelEl = form.querySelector('[name="cta_label"]');
  var ctaUrlEl = form.querySelector('[name="cta_url"]');
  var showTitleEl = form.querySelector('[name="show_title"]');
  var showBodyEl = form.querySelector('[name="show_body"]');
  var showCtaEl = form.querySelector('[name="show_cta"]');
  var bgColorEl = form.querySelector('[name="bg_color"]');
  var imgPosEl = form.querySelector('[name="image_position"]');
  var imgZoomEl = form.querySelector('[name="image_zoom"]');
  var imgWidthEl = form.querySelector('[name="image_width_pct"]');
  var bgColor = bgColorEl ? bgColorEl.value : '#ffffff';
  var textColor = bgColorEl ? (bgColorEl.dataset.textColor || computeTextColor(bgColor)) : '#111111';
  var imagePosition = imgPosEl ? imgPosEl.value : 'center';
  var imageZoom = imgZoomEl ? (parseFloat(imgZoomEl.value) || 1.0) : 1.0;
  var imageWidthPct = imgWidthEl ? (parseInt(imgWidthEl.value, 10) || 40) : 40;
  var previewAd = {
    id: 'preview',
    campaign_id: 'preview',
    title: titleEl ? titleEl.value.trim() : '',
    body: bodyEl ? bodyEl.value.trim() : '',
    cta_label: ctaLabelEl ? ctaLabelEl.value.trim() : '',
    cta_url: ctaUrlEl ? ctaUrlEl.value.trim() : '',
    image_data: _pendingImageData || null,
    show_title: showTitleEl ? (showTitleEl.checked ? 1 : 0) : 1,
    show_body: showBodyEl ? (showBodyEl.checked ? 1 : 0) : 1,
    show_cta: showCtaEl ? (showCtaEl.checked ? 1 : 0) : 1,
    bg_color: bgColor,
    text_color: textColor,
    image_position: imagePosition,
    image_zoom: imageZoom,
    image_width_pct: imageWidthPct
  };
  if (_detachDivider) { _detachDivider(); _detachDivider = null; }
  renderAd(previewAd, 'ma-creator-preview');
  if (document.getElementById('ma-creator-preview-review')) {
    renderAd(previewAd, 'ma-creator-preview-review');
  }
  if (window.innerWidth < 480) {
    // Mobile: detach any drag handlers, show numeric controls instead
    if (_detachPositioner) { _detachPositioner(); _detachPositioner = null; }
    var mobileCtrl = document.getElementById('ma-creator-mobile-controls');
    if (mobileCtrl) {
      mobileCtrl.style.display = _pendingImageData ? 'block' : 'none';
      if (_pendingImageData) { _syncMobileControls(form); }
    }
  } else {
    // Desktop: attach drag overlay and divider as before
    if (_pendingImageData) {
      _attachImagePositioner(form);
      _attachDivider(form);
    }
  }
}

function onCreatorFormInput(e) {
  var form = e.currentTarget;
  var changedName = e.target.name;
  var decimals = FIELD_DECIMALS[changedName];
  if (decimals !== undefined) {
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
    var budgetVal = parseAmt(e.target.value);
    if (isFinite(walletMax) && isFinite(budgetVal) && budgetVal > walletMax) {
      e.target.value = fmtAmt(walletMax, 6);
    }
  }
  if (changedName === 'bg_color') {
    var bgInput = form.querySelector('[name="bg_color"]');
    if (bgInput) { bgInput.dataset.textColor = computeTextColor(bgInput.value); }
  }
  enforceViewerRewardLimits(form);
  if (changedName === 'reward_view' || changedName === 'reward_click'
    || changedName === 'auto_balance' || changedName === 'multiplier') {
    applyAutoBalance(form);
  }
  enforceCapMinimum(form);
  enforceDailyLimits(form);
  enforcePublisherLimits(form);
  updateCampaignSummary(form);
  updateCreatorPreview(form);
}

function truncateInputDecimals(input, maxDecimals) {
  var val = input.value;
  var sep = (window.NUMFMT === 'EU' && input.type !== 'number') ? ',' : '.';
  var dotIndex = val.indexOf(sep);
  if (dotIndex === -1) { return; }
  if (maxDecimals === 0) {
    input.value = val.slice(0, dotIndex);
  } else if (val.length - dotIndex - 1 > maxDecimals) {
    input.value = val.slice(0, dotIndex + maxDecimals + 1);
  }
}

var FIELD_DECIMALS = {
  budget: 6,
  reward_view: 6,
  reward_click: 6,
  max_viewer_reward: 6,
  publisher_reward_view: 6,
  max_publisher_budget: 6,
  campaign_days: 0,
  multiplier: 1,
  max_daily_views: 0,
  max_daily_clicks: 0
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
// Updates the HTML min/max attributes and clamps the current value if needed.
function enforceCapMinimum(form) {
  var rewardView = parseAmt(form.querySelector('[name="reward_view"]').value) || 0;
  var rewardClick = parseAmt(form.querySelector('[name="reward_click"]').value) || 0;
  var minCap = rewardView + rewardClick;
  var budget = parseAmt(form.querySelector('[name="budget"]').value) || 0;
  var maxPubBudget = parseAmt(form.querySelector('[name="max_publisher_budget"]').value) || 0;
  var maxCap = Math.max(minCap, budget - maxPubBudget);

  var capInput = form.querySelector('[name="max_viewer_reward"]');
  capInput.min = minCap > 0 ? minCap.toFixed(6) : '0.000001';
  capInput.max = maxCap.toFixed(6);
  var currentCap = parseAmt(capInput.value);
  if (isFinite(currentCap) && currentCap < minCap) {
    capInput.value = fmtAmt(minCap, 6);
    currentCap = minCap;
  } else if (isFinite(currentCap) && currentCap > maxCap) {
    capInput.value = fmtAmt(maxCap, 6);
    currentCap = maxCap;
  }
  var hintEl = document.getElementById('ma-cap-min-hint');
  if (hintEl) {
    hintEl.textContent = 'Min: ' + formatMinima(minCap) + ' MINIMA, Max: ' + formatMinima(maxCap) + ' MINIMA (remaining budget after publisher allocation).';
  }
}

// Keeps max_daily_views and max_daily_clicks within bounds so that the daily rewards do not exceed the max reward per viewer.
// Displays explanatory messages beneath each input.
function enforceDailyLimits(form) {
  var rewardView = parseAmt(form.querySelector('[name="reward_view"]').value) || 0;
  var rewardClick = parseAmt(form.querySelector('[name="reward_click"]').value) || 0;
  var maxViewerReward = parseAmt(form.querySelector('[name="max_viewer_reward"]').value) || 0;

  var dailyViewsInput = form.querySelector('[name="max_daily_views"]');
  var dailyViewsHint = document.getElementById('ma-daily-views-hint');
  if (dailyViewsInput) {
    if (rewardView > 0 && maxViewerReward > 0) {
      var maxViews = Math.floor(maxViewerReward / rewardView);
      if (maxViews < 1) { maxViews = 1; }
      dailyViewsInput.max = maxViews;
      var curViews = parseInt(dailyViewsInput.value, 10);
      if (isFinite(curViews) && curViews > maxViews) {
        dailyViewsInput.value = maxViews;
      }
      if (dailyViewsHint) {
        dailyViewsHint.textContent = 'Daily view reward cannot exceed the max reward per viewer (' + formatMinima(maxViewerReward) + ' MINIMA). Max: ' + maxViews + ' views/day.';
      }
    } else {
      if (dailyViewsHint) { dailyViewsHint.textContent = ''; }
    }
  }

  var dailyClicksInput = form.querySelector('[name="max_daily_clicks"]');
  var dailyClicksHint = document.getElementById('ma-daily-clicks-hint');
  if (dailyClicksInput) {
    if (rewardClick > 0 && maxViewerReward > 0) {
      var maxClicks = Math.floor(maxViewerReward / rewardClick);
      if (maxClicks < 1) { maxClicks = 1; }
      dailyClicksInput.max = maxClicks;
      var curClicks = parseInt(dailyClicksInput.value, 10);
      if (isFinite(curClicks) && curClicks > maxClicks) {
        dailyClicksInput.value = maxClicks;
      }
      if (dailyClicksHint) {
        dailyClicksHint.textContent = 'Daily click reward cannot exceed the max reward per viewer (' + formatMinima(maxViewerReward) + ' MINIMA). Max: ' + maxClicks + ' clicks/day.';
      }
    } else {
      if (dailyClicksHint) { dailyClicksHint.textContent = ''; }
    }
  }
}

// Keeps max_publisher_budget >= publisher_reward_view and <= budget.
// Displays explanatory messages beneath inputs.
function enforcePublisherLimits(form) {
  var budget = parseAmt(form.querySelector('[name="budget"]').value) || 0;
  var publisherRewardView = parseAmt(form.querySelector('[name="publisher_reward_view"]').value) || 0;
  var maxPubBudgetInput = form.querySelector('[name="max_publisher_budget"]');
  var pubBudgetHint = document.getElementById('ma-publisher-budget-hint');
  var pubRewardHint = document.getElementById('ma-publisher-reward-hint');
  var maxViewerReward = parseAmt(form.querySelector('[name="max_viewer_reward"]').value) || 0;

  var allowedPubBudget = Math.max(publisherRewardView, budget - maxViewerReward);

  if (publisherRewardView > 0) {
    if (publisherRewardView < LIMITS.MIN_PUBLISHER_REWARD_VIEW) {
      publisherRewardView = LIMITS.MIN_PUBLISHER_REWARD_VIEW;
      var prInput = form.querySelector('[name="publisher_reward_view"]');
      if (prInput) { prInput.value = fmtAmt(LIMITS.MIN_PUBLISHER_REWARD_VIEW, 6); }
    }
    var allowedPubReward = Math.max(LIMITS.MIN_PUBLISHER_REWARD_VIEW, budget - maxViewerReward);
    if (pubRewardHint) {
      pubRewardHint.textContent = 'Min: ' + formatMinima(LIMITS.MIN_PUBLISHER_REWARD_VIEW) + ' MINIMA, Max: ' + formatMinima(allowedPubReward) + ' MINIMA (remaining budget after viewer allocation).';
    }
    var rewardInput = form.querySelector('[name="publisher_reward_view"]');
    if (rewardInput) {
      rewardInput.max = allowedPubReward.toFixed(6);
      var curReward = parseAmt(rewardInput.value);
      if (isFinite(curReward) && curReward > allowedPubReward) {
        rewardInput.value = fmtAmt(allowedPubReward, 6);
        publisherRewardView = allowedPubReward;
      }
    }

    if (maxPubBudgetInput) {
      maxPubBudgetInput.min = publisherRewardView.toFixed(6);
      maxPubBudgetInput.max = allowedPubBudget.toFixed(6);
      var curPubBudget = parseAmt(maxPubBudgetInput.value);
      if (isFinite(curPubBudget) && curPubBudget < publisherRewardView) {
        maxPubBudgetInput.value = fmtAmt(publisherRewardView, 6);
      } else if (isFinite(curPubBudget) && curPubBudget > allowedPubBudget) {
        maxPubBudgetInput.value = fmtAmt(allowedPubBudget, 6);
      }

      if (pubBudgetHint) {
        pubBudgetHint.textContent = 'Min: ' + formatMinima(publisherRewardView) + ' MINIMA, Max: ' + formatMinima(allowedPubBudget) + ' MINIMA (remaining budget after viewer allocation).';
      }
    }
  } else {
    if (pubRewardHint) {
      pubRewardHint.textContent = 'Leave at 0 to disable Frame rewards. Min: ' + formatMinima(LIMITS.MIN_PUBLISHER_REWARD_VIEW) + ' MINIMA when active.';
    }
    var allowedPubBudgetNoReward = Math.max(0, budget - maxViewerReward);
    if (maxPubBudgetInput) {
      maxPubBudgetInput.min = '0';
      maxPubBudgetInput.max = allowedPubBudgetNoReward.toFixed(6);
      var curPubBudget2 = parseAmt(maxPubBudgetInput.value);
      if (isFinite(curPubBudget2) && curPubBudget2 > allowedPubBudgetNoReward) {
        maxPubBudgetInput.value = fmtAmt(allowedPubBudgetNoReward, 6);
      }
    }
    if (pubBudgetHint) {
      pubBudgetHint.textContent = 'Max: ' + formatMinima(allowedPubBudgetNoReward) + ' MINIMA (remaining budget after viewer allocation).';
    }
  }
}

// Keeps reward_view and reward_click within limits and updates hints.
function enforceViewerRewardLimits(form) {
  var budget = parseAmt(form.querySelector('[name="budget"]').value) || 0;
  var maxPubBudget = parseAmt(form.querySelector('[name="max_publisher_budget"]').value) || 0;
  var allowedBudget = Math.max(0, budget - maxPubBudget);

  var viewInput = form.querySelector('[name="reward_view"]');
  var viewHint = document.getElementById('ma-reward-view-hint');
  if (viewInput) {
    viewInput.min = LIMITS.MIN_REWARD_VIEW.toFixed(6);
    viewInput.max = allowedBudget.toFixed(6);
    var viewVal = parseAmt(viewInput.value) || 0;
    if (isFinite(viewVal)) {
      if (viewVal > allowedBudget) {
        viewInput.value = fmtAmt(allowedBudget, 6);
      }
    }
    if (viewHint) {
      viewHint.textContent = 'Min: ' + formatMinima(LIMITS.MIN_REWARD_VIEW) + ' MINIMA, Max: ' + formatMinima(allowedBudget) + ' MINIMA (remaining budget after publisher allocation).';
    }
  }

  var clickInput = form.querySelector('[name="reward_click"]');
  var clickHint = document.getElementById('ma-reward-click-hint');
  if (clickInput) {
    clickInput.min = LIMITS.MIN_REWARD_CLICK.toFixed(6);
    clickInput.max = allowedBudget.toFixed(6);
    var clickVal = parseAmt(clickInput.value) || 0;
    if (isFinite(clickVal)) {
      if (clickVal > allowedBudget) {
        clickInput.value = fmtAmt(allowedBudget, 6);
      }
    }
    if (clickHint) {
      clickHint.textContent = 'Min: ' + formatMinima(LIMITS.MIN_REWARD_CLICK) + ' MINIMA, Max: ' + formatMinima(allowedBudget) + ' MINIMA (remaining budget after publisher allocation).';
    }
  }
}

function applyAutoBalance(form) {
  var autoBalance = form.querySelector('[name="auto_balance"]').checked;
  var rewardViewInput = form.querySelector('[name="reward_view"]');
  var rewardClickInput = form.querySelector('[name="reward_click"]');
  var capInput = form.querySelector('[name="max_viewer_reward"]');
  var multiplierInput = form.querySelector('[name="multiplier"]');
  var metricsPanel = document.getElementById('ma-autobalance-metrics');
  var budget = parseAmt(form.querySelector('[name="budget"]').value);

  if (autoBalance && isFinite(budget) && budget > 0) {
    var defaults = getAutoBalanceDefaults(budget);
    rewardViewInput.value = fmtAmt(defaults.reward_view, 6);
    rewardClickInput.value = fmtAmt(defaults.reward_click, 6);

    var multiplier = parseFloat(multiplierInput.value) || AUTO_BALANCE_CONFIG.MULTIPLIER_DEFAULT;
    if (multiplier < AUTO_BALANCE_CONFIG.MULTIPLIER_MIN) { multiplier = AUTO_BALANCE_CONFIG.MULTIPLIER_MIN; }
    if (multiplier > AUTO_BALANCE_CONFIG.MULTIPLIER_MAX) { multiplier = AUTO_BALANCE_CONFIG.MULTIPLIER_MAX; }

    var maxViewerReward = (defaults.reward_view + defaults.reward_click) * multiplier;
    capInput.value = fmtAmt(maxViewerReward, 6);

    var maxPubBudget = budget * AUTO_BALANCE_CONFIG.PUBLISHER_BUDGET_RATIO;
    var pubRewardView = (defaults.reward_view + defaults.reward_click) * AUTO_BALANCE_CONFIG.PUBLISHER_REWARD_RATIO;
    form.querySelector('[name="max_publisher_budget"]').value = fmtAmt(maxPubBudget, 6);
    form.querySelector('[name="publisher_reward_view"]').value = fmtAmt(pubRewardView, 6);

    rewardViewInput.style.opacity = '0.6';
    rewardClickInput.style.opacity = '0.6';
    capInput.style.opacity = '0.6';
    rewardViewInput.readOnly = true;
    rewardClickInput.readOnly = true;
    capInput.readOnly = true;

    multiplierInput.style.display = 'block';
    if (metricsPanel) { metricsPanel.style.display = 'block'; }

    updateAutoBalanceMetricsDisplay(form);
  } else {
    rewardViewInput.style.opacity = '1';
    rewardClickInput.style.opacity = '1';
    capInput.style.opacity = '1';
    rewardViewInput.readOnly = false;
    rewardClickInput.readOnly = false;
    capInput.readOnly = false;

    multiplierInput.style.display = 'none';
    if (metricsPanel) { metricsPanel.style.display = 'none'; }
  }
}

function updateAutoBalanceMetricsDisplay(form) {
  var metrics = calculateAutoBalanceMetrics(form);
  if (!metrics) { return; }

  var viewersEl = document.getElementById('ma-metric-viewers');
  var dailyEl = document.getElementById('ma-metric-daily');
  var maxReachEl = document.getElementById('ma-metric-maxreach');
  var costEl = document.getElementById('ma-metric-cost');

  var minCap = metrics.reward_view + metrics.reward_click;
  var maxReachAt1x = Math.floor(metrics.max_publisher_budget / minCap);

  if (viewersEl) { viewersEl.textContent = metrics.max_viewers.toLocaleString() + ' viewers'; }
  if (dailyEl) { dailyEl.textContent = fmtAmt(metrics.daily_reward_per_viewer, 2) + ' MINIMA/day'; }
  if (maxReachEl && !maxReachEl.value) { maxReachEl.value = maxReachAt1x; }
  if (costEl) { costEl.textContent = fmtAmt(metrics.total_cost, 2) + ' MINIMA'; }

  var pubEstDisplay = document.getElementById('ma-pub-est-display');
  if (pubEstDisplay) { pubEstDisplay.innerHTML = ''; }
}

function recalculateAllMetrics(form) {
  var autoBalanceCheckbox = form.querySelector('[name="auto_balance"]');
  var metricsPanel = document.getElementById('ma-autobalance-metrics');

  if (!autoBalanceCheckbox.checked) {
    if (metricsPanel) { metricsPanel.style.display = 'none'; }
    return;
  }

  if (metricsPanel) { metricsPanel.style.display = 'block'; }

  var budget = parseAmt(form.querySelector('[name="budget"]').value) || 0;
  var campaignDays = parseInt(form.querySelector('[name="campaign_days"]').value, 10) || 7;
  var multiplier = parseFloat(form.querySelector('[name="multiplier"]').value) || AUTO_BALANCE_CONFIG.MULTIPLIER_DEFAULT;

  if (multiplier < AUTO_BALANCE_CONFIG.MULTIPLIER_MIN) { multiplier = AUTO_BALANCE_CONFIG.MULTIPLIER_MIN; }
  if (multiplier > AUTO_BALANCE_CONFIG.MULTIPLIER_MAX) { multiplier = AUTO_BALANCE_CONFIG.MULTIPLIER_MAX; }

  var defaults = getAutoBalanceDefaults(budget);
  var rewardView = defaults.reward_view;
  var rewardClick = defaults.reward_click;

  var maxViewerReward = (rewardView + rewardClick) * multiplier;
  var perViewerChannelMax = (rewardView + rewardClick) * campaignDays;
  var pubBudgetPool = budget * AUTO_BALANCE_CONFIG.PUBLISHER_BUDGET_RATIO;
  var budgetForViewers = budget - pubBudgetPool;
  var maxViewers = Math.floor(budgetForViewers / perViewerChannelMax);
  var dailyRewardPerViewer = (rewardView * 100) + (rewardClick * 100);
  var publisherRewardView = (rewardView + rewardClick) * AUTO_BALANCE_CONFIG.PUBLISHER_REWARD_RATIO;
  var totalCostWithFee = budget * (1 + PLATFORM_FEE_RATE);

  form.querySelector('[name="reward_view"]').value = fmtAmt(rewardView, 6);
  form.querySelector('[name="reward_click"]').value = fmtAmt(rewardClick, 6);
  form.querySelector('[name="max_viewer_reward"]').value = fmtAmt(maxViewerReward, 6);
  form.querySelector('[name="max_publisher_budget"]').value = fmtAmt(pubBudgetPool, 6);
  form.querySelector('[name="publisher_reward_view"]').value = fmtAmt(publisherRewardView, 6);

  var viewersEl = document.getElementById('ma-metric-viewers');
  if (viewersEl) { viewersEl.textContent = maxViewers.toLocaleString() + ' (est.)'; }

  var dailyEl = document.getElementById('ma-metric-daily');
  if (dailyEl) { dailyEl.textContent = fmtAmt(dailyRewardPerViewer, 2) + ' MINIMA'; }

  var multiplierDisplay = document.getElementById('ma-multiplier-display');
  if (multiplierDisplay) { multiplierDisplay.textContent = '×' + multiplier.toFixed(1); }

  var pubBudgetEl = document.getElementById('ma-metric-pub-budget');
  if (pubBudgetEl) { pubBudgetEl.textContent = fmtAmt(pubBudgetPool, 2) + ' MINIMA'; }

  var channelMaxEl = document.getElementById('ma-metric-channel-max');
  if (channelMaxEl) { channelMaxEl.textContent = fmtAmt(perViewerChannelMax, 2) + ' MINIMA'; }

  var costEl = document.getElementById('ma-metric-cost');
  if (costEl) { costEl.textContent = fmtAmt(totalCostWithFee, 2) + ' MINIMA'; }

  var selectedPubBtn = document.querySelector('.ma-pub-est[style*="font-weight"]');
  if (selectedPubBtn) {
    var numPublishers = parseInt(selectedPubBtn.dataset.publishers, 10);
    var budgetPerPublisher = pubBudgetPool / numPublishers;
    var viewsPerPublisher = Math.floor(budgetPerPublisher / publisherRewardView);
    var totalPublisherViews = viewsPerPublisher * numPublishers;
    var totalReach = maxViewers + totalPublisherViews;

    var pubEstDisplay = document.getElementById('ma-pub-est-display');
    if (pubEstDisplay) {
      pubEstDisplay.innerHTML =
        '<strong style="display:block;margin-bottom:0.3rem;">' + numPublishers + ' publishers:</strong>'
        + '<span style="display:block;font-size:0.85rem;margin-bottom:0.2rem;">'
        + fmtAmt(budgetPerPublisher, 2) + ' MINIMA/pub &middot; ' + viewsPerPublisher.toLocaleString() + ' views/pub</span>'
        + '<span style="display:block;font-size:0.85rem;margin-bottom:0.2rem;color:var(--pico-muted-color);">'
        + totalPublisherViews.toLocaleString() + ' publisher views</span>'
        + '<span style="display:block;font-weight:600;color:var(--pico-primary,#6366f1);margin-top:0.3rem;">'
        + maxViewers.toLocaleString() + ' viewers + ' + totalPublisherViews.toLocaleString() + ' pub = '
        + totalReach.toLocaleString() + ' total reach</span>';
    }
  }
}

function updateCampaignSummary(form) {
  var reachReviewEl = document.getElementById('ma-campaign-reach-review');
  var costEl = document.getElementById('ma-campaign-cost');
  if (!reachReviewEl && !costEl) { return; }

  var budget = parseAmt(form.querySelector('[name="budget"]').value);
  var rewardView = parseAmt(form.querySelector('[name="reward_view"]').value);
  var rewardClick = parseAmt(form.querySelector('[name="reward_click"]').value);
  var campaignDays = parseInt(form.querySelector('[name="campaign_days"]').value, 10);
  var cap = parseAmt(form.querySelector('[name="max_viewer_reward"]').value);

  if (!isFinite(budget) || budget <= 0 || !isFinite(rewardView) || !isFinite(rewardClick)
    || !isFinite(campaignDays) || campaignDays <= 0 || !isFinite(cap) || cap <= 0) {
    if (reachReviewEl) { reachReviewEl.innerHTML = ''; }
    if (costEl) { costEl.innerHTML = ''; }
    return;
  }

  var pubRvInput = form.querySelector('[name="publisher_reward_view"]');
  var pubBudgInput = form.querySelector('[name="max_publisher_budget"]');
  var publisherRv = pubRvInput ? (parseAmt(pubRvInput.value) || 0) : 0;
  var maxPubBudget = pubBudgInput ? (parseAmt(pubBudgInput.value) || 0) : 0;

  var maxViewers = Math.floor(budget / cap);
  var platformFee = budget * PLATFORM_FEE_RATE;
  var totalCost = budget + platformFee;

  // ── Reach estimate → Review panel only ───────────────────────────────
  if (reachReviewEl) {
    var warningHtml = maxViewers === 0
      ? '<p class="ma-summary-warning">No viewer can be rewarded with these settings.'
      + ' Increase the budget or reduce the cap per viewer.</p>'
      : '';
    var singleInteraction = rewardView + rewardClick;
    var interactionNote = (isFinite(singleInteraction) && singleInteraction > 0 && cap < singleInteraction)
      ? '<li><small>Cap is below a single view + click (' + formatMinima(singleInteraction)
      + ' MINIMA) — viewers earn partial rewards per interaction.</small></li>'
      : '';
    var reachHtml = '<div class="ma-summary-box">'
      + warningHtml
      + '<strong>Campaign reach estimate</strong>'
      + '<ul>'
      + '<li>Max reward per viewer: ' + formatMinima(cap) + ' MINIMA</li>'
      + '<li>Max viewers that can be rewarded: <strong>' + maxViewers.toLocaleString() + '</strong></li>'
      + interactionNote
      + '</ul>'
      + '<small class="ma-cap-auto">This estimate depends on the parameters configured in Viewer Rewards and Publisher Rewards.</small>'
      + '</div>';
    if (reachReviewEl) { reachReviewEl.innerHTML = reachHtml; }
  }

  // ── Cost breakdown → Review panel ─────────────────────────────────────
  if (costEl) {
    costEl.innerHTML = '<div class="ma-summary-box">'
      + '<strong>Cost breakdown</strong>'
      + '<ul>'
      + '<li>Budget: ' + formatMinima(budget) + ' MINIMA</li>'
      + '<li>Platform fee (6%): ' + formatMinima(platformFee) + ' MINIMA</li>'
      + (publisherRv > 0
        ? '<li>Publisher reward/view: ' + formatMinima(publisherRv) + ' MINIMA'
        + ' &middot; max budget: ' + formatMinima(maxPubBudget) + ' MINIMA</li>'
        : '')
      + '<li>Total cost: <strong>' + formatMinima(totalCost) + ' MINIMA</strong></li>'
      + '</ul>'
      + '</div>';
  }
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
  var title = (data.get('title') || '').toString().trim();
  var body = (data.get('body') || '').toString().trim();
  var interests = (data.get('interests') || '').toString().trim();
  var ctaLabel = (data.get('cta_label') || '').toString().trim();
  var ctaUrl = (data.get('cta_url') || '').toString().trim();
  var imageData = _pendingImageData || null;
  var showTitle = data.get('show_title') ? 1 : 0;
  var showBody = data.get('show_body') ? 1 : 0;
  var showCta = data.get('show_cta') ? 1 : 0;
  var bgColorElS = form.querySelector('[name="bg_color"]');
  var bgColor = bgColorElS ? bgColorElS.value : '#ffffff';
  var textColor = bgColorElS ? (bgColorElS.dataset.textColor || computeTextColor(bgColor)) : '#111111';
  var imagePosition = (data.get('image_position') || 'center').toString().trim();
  var imageZoom = parseFloat((data.get('image_zoom') || '1.0').toString().trim()) || 1.0;
  var imageWidthPct = parseInt((data.get('image_width_pct') || '40').toString().trim(), 10) || 40;
  var budget = parseAmt((data.get('budget') || '').toString());
  var rewardView = parseAmt((data.get('reward_view') || '').toString());
  var rewardClick = parseAmt((data.get('reward_click') || '').toString());
  var campaignDaysRaw = (data.get('campaign_days') || '').toString().trim();
  var campaignDays = campaignDaysRaw ? parseInt(campaignDaysRaw, 10) : 7;
  var expiresAt = Date.now() + (campaignDays * 24 * 60 * 60 * 1000);
  var maxViewerRewardRaw = (data.get('max_viewer_reward') || '').toString().trim();
  var maxViewerReward = (maxViewerRewardRaw && parseAmt(maxViewerRewardRaw) > 0) ? parseAmt(maxViewerRewardRaw) : null;
  var publisherRewardView = parseAmt((data.get('publisher_reward_view') || '0').toString()) || 0;
  var maxPublisherBudget = parseAmt((data.get('max_publisher_budget') || '0').toString()) || 0;
  var maxDailyViews = parseInt(data.get('max_daily_views') || '100', 10);
  var maxDailyClicks = parseInt(data.get('max_daily_clicks') || '100', 10);
  var cooldownS = parseInt(data.get('cooldown_s') || '300', 10);
  var cooldownMs = (cooldownS >= 1 ? cooldownS : 300) * 1000;

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
    msgEl.textContent = 'Budget exceeds wallet balance (' + fmtAmt(walletMax, 6) + ' MINIMA sendable).';
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
    msgEl.textContent = 'Max reward per viewer cannot be less than reward/view + reward/click (' + fmtAmt(rewardView + rewardClick, 6) + ' MINIMA).';
    return;
  }
  if (maxDailyViews * rewardView > maxViewerReward) {
    msgEl.textContent = 'Daily view reward (' + fmtAmt(maxDailyViews * rewardView, 6) + ' MINIMA) cannot exceed max reward per viewer (' + fmtAmt(maxViewerReward, 6) + ' MINIMA).';
    return;
  }
  if (maxDailyClicks * rewardClick > maxViewerReward) {
    msgEl.textContent = 'Daily click reward (' + fmtAmt(maxDailyClicks * rewardClick, 6) + ' MINIMA) cannot exceed max reward per viewer (' + fmtAmt(maxViewerReward, 6) + ' MINIMA).';
    return;
  }
  if (maxViewerReward + maxPublisherBudget > budget) {
    msgEl.textContent = 'Max viewer reward (' + formatMinima(maxViewerReward) + ' MINIMA) + Max publisher budget (' + formatMinima(maxPublisherBudget) + ' MINIMA) cannot exceed total budget (' + formatMinima(budget) + ' MINIMA).';
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
    if (maxPublisherBudget < publisherRewardView) {
      msgEl.textContent = 'Max publisher budget (' + fmtAmt(maxPublisherBudget, 6) + ' MINIMA) cannot be less than publisher reward per view (' + fmtAmt(publisherRewardView, 6) + ' MINIMA).';
      return;
    }
  }

  var now = Date.now();
  var campaignId = generateUID();
  var adId = generateUID();

  var campaign = {
    id: campaignId,
    creator_address: MY_ADDRESS,
    title: title,
    budget_total: budget,
    budget_remaining: budget,
    reward_view: rewardView,
    reward_click: rewardClick,
    status: 'active',
    created_at: now,
    expires_at: expiresAt,
    escrow_coinid: '',
    escrow_wallet_pk: '',
    max_viewer_reward: maxViewerReward,
    publisher_reward_view: publisherRewardView,
    max_publisher_budget: maxPublisherBudget,
    publisher_budget_spent: 0,
    max_daily_views: maxDailyViews,
    max_daily_clicks: maxDailyClicks,
    cooldown_ms: cooldownMs,
    platform_key: (typeof PLATFORM_KEY !== 'undefined' && PLATFORM_KEY) ? PLATFORM_KEY : null
  };

  var ad = {
    id: adId,
    campaign_id: campaignId,
    title: title,
    body: body,
    cta_label: ctaLabel,
    cta_url: ctaUrl,
    interests: interests || null,
    image_data: imageData,
    show_title: showTitle,
    show_body: showBody,
    show_cta: showCta,
    bg_color: bgColor,
    text_color: textColor,
    image_position: imagePosition,
    image_zoom: imageZoom,
    image_width_pct: imageWidthPct
  };

  var submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) { submitBtn.setAttribute('disabled', ''); }

  msgEl.textContent = 'Funding escrow…';

  var campaignDurationBlocks = campaignDays * BLOCKS_PER_DAY;
  fundEscrowAndPublish(campaign, ad, form, submitBtn, msgEl, campaignDurationBlocks);
}

// V1 — legacy escrow script. Kept only to spend coins from campaigns created before T-PUB4.
var ESCROW_SCRIPT_FE = 'LET creatorkey=PREVSTATE(1) ASSERT SIGNEDBY(creatorkey) LET payout=STATE(10) LET change=@AMOUNT-payout IF change GT 0 THEN ASSERT VERIFYOUT(INC(@INPUT) @ADDRESS change @TOKENID TRUE) ENDIF RETURN TRUE';

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

// V3 — current escrow script (T-SC2). Adds on-chain campaign status at PREVSTATE(7).
// Byte-identical to the SW constant in service.js. All NEW campaigns use this script.
// See MinimaAds.md §B.2.1 and §4.7.
var ESCROW_SCRIPT_V3 =
  "LET creatorkey=PREVSTATE(1) " +
  "LET platformkey=PREVSTATE(5) " +
  "LET maxpubbudget=PREVSTATE(6) " +
  "LET status=PREVSTATE(7) " +
  "ASSERT SIGNEDBY(creatorkey) " +
  "LET payout=STATE(10) " +
  "LET feeflag=STATE(11) " +
  "LET change=@AMOUNT-payout " +
  "IF feeflag EQ 1 THEN " +
  "LET feeamount=STATE(12) " +
  "ASSERT VERIFYOUT(STATE(13) platformkey feeamount @TOKENID FALSE) " +
  "ENDIF " +
  "IF change GT 0 THEN " +
  "ASSERT VERIFYOUT(INC(@INPUT) @ADDRESS change @TOKENID TRUE) " +
  "ENDIF " +
  "RETURN TRUE";

var CHANNEL_SCRIPT_FE = 'IF @COINAGE GT (40*1728) AND SIGNEDBY(PREVSTATE(1)) THEN RETURN TRUE ENDIF RETURN MULTISIG(2 PREVSTATE(1) PREVSTATE(2))';

// Resolves the escrow address for new campaigns (T-SC3).
// Tries V3 first (ESCROW_ADDRESS_V3); registers via newscript if missing.
// Falls back to V2 only if V3 newscript fails (logs a warning).
function resolveEscrowAddress(cb) {
  MDS.keypair.get('ESCROW_ADDRESS_V3', function (addrResV3) {
    var cachedV3 = addrResV3 && addrResV3.status ? addrResV3.value : '';
    if (cachedV3) {
      console.log('[CREATOR] ESCROW_ADDRESS_V3 from keypair:', cachedV3);
      cb(cachedV3);
      return;
    }
    console.log('[CREATOR] ESCROW_ADDRESS_V3 not in keypair — registering via newscript');
    MDS.cmd('newscript script:"' + ESCROW_SCRIPT_V3 + '" trackall:false', function (resV3) {
      if (!resV3.status) {
        console.warn('[CREATOR] newscript V3 failed — falling back to V2:', resV3.error);
        MDS.keypair.get('ESCROW_ADDRESS_V2', function (addrResV2) {
          var cachedV2 = addrResV2 && addrResV2.status ? addrResV2.value : '';
          if (cachedV2) {
            console.log('[CREATOR] ESCROW_ADDRESS_V2 from keypair (V3 fallback):', cachedV2);
            cb(cachedV2);
            return;
          }
          MDS.cmd('newscript script:"' + ESCROW_SCRIPT_V2 + '" trackall:false', function (resV2) {
            if (!resV2.status) {
              console.error('[CREATOR] newscript V2 also failed:', resV2.error);
              cb('');
              return;
            }
            var addrV2 = resV2.response.address;
            MDS.keypair.set('ESCROW_ADDRESS_V2', addrV2, function () { });
            cb(addrV2);
          });
        });
        return;
      }
      var addrV3 = resV3.response.address;
      console.log('[CREATOR] ESCROW_ADDRESS_V3 derived:', addrV3);
      MDS.keypair.set('ESCROW_ADDRESS_V3', addrV3, function () { });
      cb(addrV3);
    });
  });
}

function resolveChannelScriptAddress(cb) {
  MDS.keypair.get('CHANNEL_SCRIPT_ADDRESS', function (addrRes) {
    var cached = addrRes && addrRes.status ? addrRes.value : '';
    if (cached) {
      console.log('[CREATOR] CHANNEL_SCRIPT_ADDRESS from keypair:', cached);
      cb(cached);
      return;
    }
    console.log('[CREATOR] CHANNEL_SCRIPT_ADDRESS not in keypair — deriving via newscript');
    MDS.cmd('newscript script:"' + CHANNEL_SCRIPT_FE + '" trackall:true', function (res) {
      if (!res.status) {
        console.error('[CREATOR] newscript channel failed:', res.error);
        cb('');
        return;
      }
      var addr = res.response.address;
      console.log('[CREATOR] CHANNEL_SCRIPT_ADDRESS derived:', addr);
      MDS.keypair.set('CHANNEL_SCRIPT_ADDRESS', addr, function () { });
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

  // Validate permanent route before doing anything else.
  getCreatorMaximaRoute(function(permanentRoute) {
    if (!permanentRoute) {
      fail('Permanent Maxima route not set. Please configure your static MLS and register your route in the Creator setup wizard.');
      return;
    }
    _fundEscrowWithRoute(campaign, ad, form, submitBtn, msgEl, campaignDurationBlocks, permanentRoute, fail);
  });
}

function _fundEscrowWithRoute(campaign, ad, form, submitBtn, msgEl, campaignDurationBlocks, permanentRoute, fail) {
  resolveEscrowAddress(function (escrowAddress) {
    if (!escrowAddress) {
      fail('Could not resolve escrow address. Check node logs.');
      return;
    }

    resolveChannelScriptAddress(function (channelScriptAddress) {
      if (!channelScriptAddress) {
        fail('Could not resolve channel script address. Check node logs.');
        return;
      }

      // Per-campaign wallet key — isolates this campaign on-chain from other campaigns and the main wallet.
      // KeyRow.toJSON returns { publickey, ... } directly under response — see refs/Minima-1.0.45/src/.../search/keys.java action:new.
      MDS.cmd('keys action:new', function (keysRes) {
        if (!keysRes.status || !keysRes.response || !keysRes.response.publickey) {
          fail('Could not generate per-campaign wallet key.');
          return;
        }
        var walletPK = keysRes.response.publickey;
        console.log('[CREATOR] per-campaign walletPK:', walletPK);

        MDS.cmd('block', function (blockRes) {
          if (!blockRes.status) {
            fail('Could not fetch current block.');
            return;
          }
          var expiryBlock = parseInt(blockRes.response.block) + campaignDurationBlocks;
          console.log('[CREATOR] expiryBlock:', expiryBlock);

          // Use permanent route (MAX#pk#mls) for STATE(4) — validated before entering this flow.
          var campaignIdHex = '0x' + utf8ToHex(campaign.id).toUpperCase();
          var creatorContactHex = '0x' + utf8ToHex(permanentRoute).toUpperCase();

          // T-PUB4 — embed PLATFORM_KEY at port 5 and max_publisher_budget at port 6.
          // PLATFORM_KEY is global (declared in config.js). null → fee branch disabled.
          var hasPlatformKey = (typeof PLATFORM_KEY !== 'undefined') && PLATFORM_KEY !== null && PLATFORM_KEY !== '';
          var platformKeyHex = hasPlatformKey ? PLATFORM_KEY : '0x00';
          var maxPubBudget = (campaign.max_publisher_budget && campaign.max_publisher_budget > 0)
            ? campaign.max_publisher_budget : 0;
          var feeflag = hasPlatformKey ? 1 : 0;
          var feeAmount = hasPlatformKey ? (campaign.budget_total * PLATFORM_FEE_RATE) : 0;
          var feeOutputIndex = 0;

          // Funding-tx state. Ports 1–6 become PREVSTATE(N) on the escrow coin
          // when later spent. Port 11 is included as an explicit marker; the
          // script reads STATE(11) which is set by the spending tx (channel-open
          // sets it to 0; this funding-time value is informational only).
          // PORT 4: permanent route MAX#pk#mls — allows off-chain discovery even
          // after the creator's mutable Mx... contact address changes.
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

          // V3: initial campaign status at port 7 — always 'active' at launch.
          stateJson = stateJson.slice(0, -1) + ',"7":"0x' + utf8ToHex('active').toUpperCase() + '"}';

          campaign.escrow_wallet_pk = walletPK;

          function onSendResult(sendRes) {
            console.log('[CREATOR] send response:', JSON.stringify(sendRes));

            if (sendRes && sendRes.pending) {
              console.log('[CREATOR] send is pending approval, uid:', sendRes.pendinguid, 'campaignId:', campaign.id);
              var pendingData = JSON.stringify({ campaign: campaign, ad: ad });
              MDS.keypair.set('PENDING_CAMPAIGN_' + campaign.id, pendingData, function () {
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

            // Retrieve creator's permanent route (MAX#Mx...#mls) to store with campaign
            if (typeof getCreatorMaximaRoute === 'function') {
              getCreatorMaximaRoute(function(creatorRoute) {
                campaign.creator_mx = creatorRoute || '';
                console.log('[CREATOR] campaign creator_mx:', campaign.creator_mx ? 'stored' : 'empty');
                saveCampaignAndBroadcast(campaign, ad, form, submitBtn, msgEl);
              });
            } else {
              campaign.creator_mx = '';
              saveCampaignAndBroadcast(campaign, ad, form, submitBtn, msgEl);
            }
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
            walletPK: walletPK,
            budgetTotal: campaign.budget_total,
            feeAmount: feeAmount,
            feeOutputIndex: feeOutputIndex,
            escrowAddress: escrowAddress,
            platformKey: platformKeyHex,
            stateJson: stateJson
          }, onSendResult);
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
    function (r) { onResult(r); }
  );
}

function saveCampaignAndBroadcast(campaign, ad, form, submitBtn, msgEl) {
  saveCampaign(campaign, ad, function (err) {
    if (err) {
      console.error('[CREATOR] local save failed:', err);
      if (msgEl) { msgEl.textContent = 'Local save failed: ' + err; }
      if (submitBtn) { submitBtn.removeAttribute('disabled'); }
      return;
    }
    console.log('[CREATOR] campaign saved locally:', campaign.id);
    if (submitBtn) { submitBtn.removeAttribute('disabled'); }
    if (msgEl) {
      msgEl.innerHTML = '';
      var successMsg = document.createElement('span');
      successMsg.style.cssText = 'color:#2ecc71;font-weight:600;';
      successMsg.textContent = 'Campaign "' + campaign.title + '" published successfully. ';
      var link = document.createElement('a');
      link.href = '#mycampaigns';
      link.textContent = 'View in My Campaigns';
      msgEl.appendChild(successMsg);
      msgEl.appendChild(link);
    }
    if (form) { form.reset(); }
  });
}
