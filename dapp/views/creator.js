// T10 — Creator view.
// Renders the campaign creation form, persists the campaign locally via
// saveCampaign(), and broadcasts CAMPAIGN_ANNOUNCE over Maxima.
// CAMPAIGN_ANNOUNCE schema: MinimaAds.md §8.3.
// Escrow flow (MinimaAds.md §6.3 step 4 / Appendix B) is out of scope for T10.

function renderCreator(root) {
  root.innerHTML = '';

  var h2 = document.createElement('h2');
  h2.textContent = 'Create Campaign';
  root.appendChild(h2);

  var form = document.createElement('form');
  form.id = 'ma-creator-form';
  form.innerHTML = ''
    + '<label>Campaign title'
    + '  <input name="title" required maxlength="256">'
    + '</label>'
    + '<label>Ad description'
    + '  <textarea name="body" required maxlength="1024"></textarea>'
    + '</label>'
    + '<label>Interests (comma-separated)'
    + '  <input name="interests" placeholder="tech, web3, minima">'
    + '</label>'
    + '<label>CTA label'
    + '  <input name="cta_label" value="Visit" required maxlength="64">'
    + '</label>'
    + '<label>CTA URL'
    + '  <input name="cta_url" type="url" required>'
    + '</label>'
    + '<label>Total budget (MINIMA)'
    + '  <input name="budget" type="number" step="0.000001" min="0.000001" required>'
    + '</label>'
    + '<label>Reward per view'
    + '  <input name="reward_view" type="number" step="0.000001" min="0" value="0.01" required>'
    + '</label>'
    + '<label>Reward per click'
    + '  <input name="reward_click" type="number" step="0.000001" min="0" value="0.10" required>'
    + '</label>'
    + '<label>Expires at (optional, unix ms)'
    + '  <input name="expires_at" type="number" step="1" min="0">'
    + '</label>'
    + '<button type="submit">Publish campaign</button>'
    + '<p id="ma-creator-msg" role="status"></p>';
  root.appendChild(form);

  form.addEventListener('submit', onCreatorSubmit);
}

function onCreatorSubmit(e) {
  e.preventDefault();
  var form = e.target;
  var msg = document.getElementById('ma-creator-msg');
  msg.textContent = '';

  if (!MY_ADDRESS) {
    msg.textContent = 'Waiting for Maxima identity…';
    return;
  }

  var data = new FormData(form);
  var title = (data.get('title') || '').toString().trim();
  var body = (data.get('body') || '').toString().trim();
  var interests = (data.get('interests') || '').toString().trim();
  var ctaLabel = (data.get('cta_label') || '').toString().trim();
  var ctaUrl = (data.get('cta_url') || '').toString().trim();
  var budget = parseFloat(data.get('budget'));
  var rewardView = parseFloat(data.get('reward_view'));
  var rewardClick = parseFloat(data.get('reward_click'));
  var expiresAtRaw = (data.get('expires_at') || '').toString().trim();
  var expiresAt = expiresAtRaw ? parseInt(expiresAtRaw, 10) : null;

  if (!title || !body || !ctaLabel || !ctaUrl) {
    msg.textContent = 'Missing required text fields.';
    return;
  }
  if (!(budget > 0) || !(rewardView >= 0) || !(rewardClick >= 0)) {
    msg.textContent = 'Budget and reward amounts must be non-negative numbers.';
    return;
  }
  if (rewardView > budget || rewardClick > budget) {
    msg.textContent = 'Rewards cannot exceed total budget.';
    return;
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
    expires_at: expiresAt
  };

  var ad = {
    id: adId,
    campaign_id: campaignId,
    title: title,
    body: body,
    cta_label: ctaLabel,
    cta_url: ctaUrl,
    interests: interests || null
  };

  var submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) { submitBtn.setAttribute('disabled', ''); }

  saveCampaign(campaign, ad, function(err) {
    if (err) {
      if (submitBtn) { submitBtn.removeAttribute('disabled'); }
      msg.textContent = 'Local save failed: ' + err;
      return;
    }
    var payload = { type: 'CAMPAIGN_ANNOUNCE', campaign: campaign, ad: ad };
    broadcastMaxima(payload, function(ok) {
      if (submitBtn) { submitBtn.removeAttribute('disabled'); }
      if (!ok) {
        msg.textContent = 'Campaign saved locally, but Maxima broadcast failed.';
        return;
      }
      msg.textContent = 'Campaign published. ID: ' + campaignId;
      form.reset();
    });
  });
}
