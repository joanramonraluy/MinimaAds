// Help view — global, accessible from drawer regardless of active mode.
// Route: #help. Renders interactive guides divided by roles (Viewer, Creator, Publisher)
// and an About section detailing the decentralized architecture.

function renderHelp(root) {
  root.innerHTML = '';

  var h2 = document.createElement('h2');
  h2.textContent = 'Help & About';
  root.appendChild(h2);

  // Tab buttons
  var tabsContainer = document.createElement('div');
  tabsContainer.className = 'ma-tabs-container';

  var tabsDiv = document.createElement('div');
  tabsDiv.className = 'ma-tabs';
  tabsDiv.setAttribute('role', 'tablist');
  tabsDiv.setAttribute('aria-label', 'Help categories');

  var categories = [
    { id: 'viewer', label: 'Viewer' },
    { id: 'creator', label: 'Creator' },
    { id: 'publisher', label: 'Publisher' },
    { id: 'about', label: 'About MinimaAds' }
  ];

  for (var i = 0; i < categories.length; i++) {
    var cat = categories[i];
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'ma-help-tab-' + cat.id;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    btn.setAttribute('aria-controls', 'ma-help-panel-' + cat.id);
    btn.setAttribute('data-target', 'ma-help-panel-' + cat.id);
    btn.textContent = cat.label;
    
    // Add event listener to switch tabs
    btn.addEventListener('click', function() {
      _selectHelpTab(this.getAttribute('data-target'));
    });
    
    tabsDiv.appendChild(btn);
  }
  tabsContainer.appendChild(tabsDiv);

  var arrow = document.createElement('span');
  arrow.className = 'ma-tabs-arrow';
  arrow.id = 'ma-help-tabs-arrow';
  arrow.innerHTML = '&#8250;';
  tabsContainer.appendChild(arrow);

  root.appendChild(tabsContainer);

  if (typeof attachScrollIndicator === 'function') {
    var updateFn = attachScrollIndicator(tabsDiv, arrow);
    setTimeout(updateFn, 50);
  }

  // Helper function to create panels
  function createPanel(id, isVisible) {
    var panel = document.createElement('div');
    panel.id = 'ma-help-panel-' + id;
    panel.className = 'ma-tab-panel ma-section';
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', 'ma-help-tab-' + id);
    if (!isVisible) {
      panel.setAttribute('hidden', '');
      panel.style.display = 'none';
    }
    return panel;
  }

  // Helper to create a card-style content block
  function createContentCard(borderColor, title) {
    var card = document.createElement('div');
    card.style.cssText = 'margin-bottom:1rem;padding:1rem;border:1px solid var(--pico-border-color);border-radius:var(--pico-border-radius);background-color:rgba(0,0,0,0.015);border-left:3px solid ' + borderColor + ';';
    if (title) {
      var titleEl = mkSectionTitle(title);
      titleEl.style.cssText = 'display:block;font-size:.78rem;color:var(--pico-muted-color,#6c757d);margin-top:0;margin-bottom:.5rem;text-transform:uppercase;letter-spacing:.04em;';
      card.appendChild(titleEl);
    }
    return card;
  }

  // --- 1. VIEWER PANEL ---
  var viewerPanel = createPanel('viewer', true);
  viewerPanel.appendChild(mkSectionTitle('Viewer Guide'));

  var vIntro = document.createElement('p');
  vIntro.innerHTML = 'As a <strong>Viewer</strong>, you earn Minima tokens simply by viewing advertisements and clicking on calls-to-action (CTA).';
  vIntro.style.cssText = 'margin-bottom:1.5rem;';
  viewerPanel.appendChild(vIntro);

  // How to Earn card
  var vStepsCard = createContentCard('#3498db', 'How to Earn');
  var vStepsList = document.createElement('ol');
  vStepsList.style.cssText = 'margin:.35rem 0 0;padding-left:1.5rem;';
  vStepsList.innerHTML =
    '<li style="margin-bottom:.5rem;">Go to the <strong>View Ads</strong> section (set your role to Viewer in the side menu).</li>' +
    '<li style="margin-bottom:.5rem;">Browse the available ad campaigns. Your interests profile will automatically prioritize matching ads.</li>' +
    '<li style="margin-bottom:.5rem;"><strong>View rewards:</strong> Keep the ad in view for at least <strong>3 seconds</strong> to receive the view reward.</li>' +
    '<li style="margin-bottom:.5rem;"><strong>Click rewards:</strong> Click the "CTA button" or the ad image to navigate and earn the additional click reward.</li>';
  vStepsCard.appendChild(vStepsList);
  viewerPanel.appendChild(vStepsCard);

  // Layer 2 Channels card
  var vL2Card = createContentCard('#9b59b6', 'Decentralized Layer 2 Channels');
  var vL2Desc = document.createElement('p');
  vL2Desc.style.cssText = 'font-size:0.9rem;margin:.35rem 0 0;';
  vL2Desc.innerHTML = 'To prevent on-chain congestion, rewards accumulate off-chain in <strong>unidirectional payment channels</strong>. ' +
    'The first time you interact with a campaign, the system opens a secure Layer 2 channel funded by the creator\'s campaign escrow. ' +
    'Once open, vouchers are sent directly to your node. You can settle these vouchers at any time under the <strong>Earnings</strong> tab to claim your funds directly to your Minima L1 wallet.';
  vL2Card.appendChild(vL2Desc);
  viewerPanel.appendChild(vL2Card);

  // Limits & Cooldowns card
  var vLimitsCard = createContentCard('#f39c12', 'Limits & Cooldowns');
  var vLimitsList = document.createElement('ul');
  vLimitsList.style.cssText = 'font-size:0.9rem;margin:.35rem 0 0;padding-left:1.5rem;';
  vLimitsList.innerHTML =
    '<li style="margin-bottom:.5rem;"><strong>Cooldown:</strong> There is a cooldown period (default 5 minutes) between rewards for the same campaign to prevent spamming.</li>' +
    '<li style="margin-bottom:.5rem;"><strong>Daily cap:</strong> Each campaign has a maximum daily limit of views and clicks per user (default 100).</li>' +
    '<li style="margin-bottom:.5rem;"><strong>Self-rewards:</strong> You cannot earn rewards from campaigns you created yourself.</li>';
  vLimitsCard.appendChild(vLimitsList);
  viewerPanel.appendChild(vLimitsCard);
  root.appendChild(viewerPanel);

  // --- 2. CREATOR PANEL ---
  var creatorPanel = createPanel('creator', false);
  creatorPanel.appendChild(mkSectionTitle('Creator Guide'));

  var cIntro = document.createElement('p');
  cIntro.innerHTML = 'As a <strong>Creator</strong>, you can design ad banners and fund campaigns using Minima tokens to reach users across the network.';
  cIntro.style.cssText = 'margin-bottom:1.5rem;';
  creatorPanel.appendChild(cIntro);

  // Creating a Campaign card
  var cStepsCard = createContentCard('#2ecc71', 'Creating a Campaign');
  var cStepsList = document.createElement('ol');
  cStepsList.style.cssText = 'margin:.35rem 0 0;padding-left:1.5rem;';
  cStepsList.innerHTML =
    '<li style="margin-bottom:.5rem;">Set your role to <strong>Creator</strong> in the side menu.</li>' +
    '<li style="margin-bottom:.5rem;">Click <strong>Create Campaign</strong>. Fill in the content (title, description, CTA, interests, and optional banner image).</li>' +
    '<li style="margin-bottom:.5rem;">Define your total campaign budget and the reward rates (amount paid per view and per click).</li>' +
    '<li style="margin-bottom:.5rem;">A platform fee of <strong>6%</strong> is automatically calculated and added to the escrow funding amount.</li>' +
    '<li style="margin-bottom:.5rem;">Confirm and approve the transaction. Your funds are locked securely in a smart contract on the Minima blockchain.</li>';
  cStepsCard.appendChild(cStepsList);
  creatorPanel.appendChild(cStepsCard);

  // Campaign Management card
  var cStatusCard = createContentCard('#3498db', 'Campaign Management & On-chain Status');
  var cStatusDesc = document.createElement('p');
  cStatusDesc.style.cssText = 'font-size:0.9rem;margin:.35rem 0 0;';
  cStatusDesc.innerHTML = 'In <strong>My Campaigns</strong>, you can track views/clicks in real time and manage status (Pause, Resume, or Finish). ' +
    'Status changes generate an on-chain update transaction. This updates the status state stored directly in the campaign\'s escrow coin, propagating the changes across the peer-to-peer network even if you go offline.';
  cStatusCard.appendChild(cStatusDesc);
  creatorPanel.appendChild(cStatusCard);

  // Budget Allocation card
  var cBudgetCard = createContentCard('#f39c12', 'Budget Allocation & Performance');
  var cBudgetDesc = document.createElement('p');
  cBudgetDesc.style.cssText = 'font-size:0.9rem;margin:0 0 .75rem;';
  cBudgetDesc.innerHTML = 'To give you complete transparency over campaign funding, budgets are split into two dedicated sections in the dashboard: <strong>Viewer</strong> and <strong>Publisher</strong>.';
  cBudgetCard.appendChild(cBudgetDesc);

  // Viewer Budget sub-card
  var viewerSubCard = document.createElement('div');
  viewerSubCard.style.cssText = 'margin-bottom:.75rem;padding:.75rem;border:1px solid var(--pico-border-color);border-radius:var(--pico-border-radius);background-color:rgba(52,152,219,0.05);border-left:2px solid #3498db;';
  var viewerSubTitle = document.createElement('strong');
  viewerSubTitle.style.cssText = 'display:block;font-size:.78rem;color:var(--pico-muted-color,#6c757d);margin-bottom:.35rem;text-transform:uppercase;letter-spacing:.04em;';
  viewerSubTitle.textContent = 'Viewer Budget';
  viewerSubCard.appendChild(viewerSubTitle);
  var viewerSubList = document.createElement('ul');
  viewerSubList.style.cssText = 'font-size:0.85rem;margin:.35rem 0 0;padding-left:1.3rem;';
  viewerSubList.innerHTML =
    '<li style="margin-bottom:.3rem;"><strong>Available (Escrow):</strong> Budget in the on-chain contract.</li>' +
    '<li style="margin-bottom:.3rem;"><strong>Locked in Channels:</strong> Budget locked in open viewer channels.</li>' +
    '<li style="margin-bottom:.3rem;"><strong>Settled (Paid):</strong> Rewards paid to viewers\' wallets.</li>' +
    '<li style="margin-bottom:.3rem;"><strong>Unspent Campaign:</strong> Total budget not yet allocated.</li>';
  viewerSubCard.appendChild(viewerSubList);
  cBudgetCard.appendChild(viewerSubCard);

  // Publisher Budget sub-card
  var pubSubCard = document.createElement('div');
  pubSubCard.style.cssText = 'margin-bottom:.75rem;padding:.75rem;border:1px solid var(--pico-border-color);border-radius:var(--pico-border-radius);background-color:rgba(244,208,63,0.05);border-left:2px solid #f39c12;';
  var pubSubTitle = document.createElement('strong');
  pubSubTitle.style.cssText = 'display:block;font-size:.78rem;color:var(--pico-muted-color,#6c757d);margin-bottom:.35rem;text-transform:uppercase;letter-spacing:.04em;';
  pubSubTitle.textContent = 'Publisher Budget';
  pubSubCard.appendChild(pubSubTitle);
  var pubSubList = document.createElement('ul');
  pubSubList.style.cssText = 'font-size:0.85rem;margin:.35rem 0 0;padding-left:1.3rem;';
  pubSubList.innerHTML =
    '<li style="margin-bottom:.3rem;"><strong>Max Pub Budget:</strong> Your configured publisher reward cap.</li>' +
    '<li style="margin-bottom:.3rem;"><strong>Budget Reserved:</strong> Capacity in active publisher channels.</li>' +
    '<li style="margin-bottom:.3rem;"><strong>Budget Spent:</strong> Publisher rewards paid dynamically.</li>' +
    '<li style="margin-bottom:.3rem;"><strong>Budget Left:</strong> Remaining unallocated publisher budget.</li>';
  pubSubCard.appendChild(pubSubList);
  cBudgetCard.appendChild(pubSubCard);

  // Key metrics info
  var metricsInfo = document.createElement('p');
  metricsInfo.style.cssText = 'font-size:0.85rem;color:var(--pico-muted-color);margin:0;';
  metricsInfo.innerHTML = 'You can also see <strong>Reward/View</strong> and <strong>Reward/Click</strong> unit rates, and <strong>CTR (Click-Through Rate)</strong> = (Clicks / Views) × 100%.';
  cBudgetCard.appendChild(metricsInfo);
  creatorPanel.appendChild(cBudgetCard);

  // Settlements card
  var cSettleCard = createContentCard('#9b59b6', 'Pending Settlements & Refunds');
  var cSettleDesc = document.createElement('p');
  cSettleDesc.style.cssText = 'font-size:0.9rem;margin:.35rem 0 0;';
  cSettleDesc.innerHTML = 'The <strong>Pending Settlement</strong> section shows open payment channels with active viewers and publishers. ' +
    'When viewers settle their channels or you mark a campaign as finished, all remaining unspent balances are returned directly to your main wallet (not back to the escrow contract).';
  cSettleCard.appendChild(cSettleDesc);
  creatorPanel.appendChild(cSettleCard);

  root.appendChild(creatorPanel);

  // --- 3. PUBLISHER PANEL ---
  var publisherPanel = createPanel('publisher', false);
  publisherPanel.appendChild(mkSectionTitle('Publisher Guide'));

  var pIntro = document.createElement('p');
  pIntro.innerHTML = 'As a <strong>Publisher</strong>, you can monetize your own MiniDapps or websites by integrating the MinimaAds SDK to show ads.';
  pIntro.style.cssText = 'margin-bottom:1.5rem;';
  publisherPanel.appendChild(pIntro);

  // Getting Started card
  var pStepsCard = createContentCard('#2ecc71', 'Getting Started');
  var pStepsList = document.createElement('ol');
  pStepsList.style.cssText = 'margin:.35rem 0 0;padding-left:1.5rem;';
  pStepsList.innerHTML =
    '<li style="margin-bottom:.5rem;">Go to the <strong>Frames</strong> section under the Publisher role.</li>' +
    '<li style="margin-bottom:.5rem;">Create a new <strong>Frame</strong> (a named ad slot identifier).</li>' +
    '<li style="margin-bottom:.5rem;">Copy the generated integration snippet.</li>' +
    '<li style="margin-bottom:.5rem;">Include the MinimaAds SDK script in your dApp and call <code>MinimaAds.init({ frameId: "your-frame-id" })</code>.</li>' +
    '<li style="margin-bottom:.5rem;">Place the <code>&lt;div id="minima-ad-slot"&gt;&lt;/div&gt;</code> container where you want the ad banner to render.</li>';
  pStepsCard.appendChild(pStepsList);
  publisherPanel.appendChild(pStepsCard);

  // Publisher Rewards card
  var pRewardsCard = createContentCard('#3498db', 'Publisher Rewards');
  var pRewardsDesc = document.createElement('p');
  pRewardsDesc.style.cssText = 'font-size:0.9rem;margin:.35rem 0 0;';
  pRewardsDesc.innerHTML = 'When creators specify a <strong>Publisher reward per view</strong> (optional), your frame accumulates rewards automatically. ' +
    'Like viewers, publisher rewards are accrued in L2 payment channels. You can monitor and settle these pending amounts in the <strong>Earnings</strong> tab under your Publisher dashboard.';
  pRewardsCard.appendChild(pRewardsDesc);
  publisherPanel.appendChild(pRewardsCard);
  root.appendChild(publisherPanel);

  // --- 4. ABOUT PANEL ---
  var aboutPanel = createPanel('about', false);
  aboutPanel.appendChild(mkSectionTitle('About MinimaAds'));

  var aDesc = document.createElement('p');
  aDesc.innerHTML = '<strong>MinimaAds</strong> is a fully decentralized advertising protocol built on top of the Minima blockchain. ' +
    'Unlike traditional ad networks, it operates without central servers, tracking databases, or intermediaries.';
  aDesc.style.cssText = 'margin-bottom:1.5rem;';
  aboutPanel.appendChild(aDesc);

  // Key Features card
  var aFeaturesCard = createContentCard('#2ecc71', 'Key Features');
  var aFeaturesList = document.createElement('ul');
  aFeaturesList.style.cssText = 'margin:.35rem 0 0;padding-left:1.5rem;';
  aFeaturesList.innerHTML =
    '<li style="margin-bottom:.5rem;"><strong>Absolute Privacy:</strong> Your interests, browsing patterns, and clicks are processed locally on your node. No data ever leaves your device except cryptographic proofs of validation.</li>' +
    '<li style="margin-bottom:.5rem;"><strong>P2P Propagation:</strong> Ad campaigns and status changes propagate automatically across the network via Maxima, Minima\'s secure peer-to-peer messaging protocol.</li>' +
    '<li style="margin-bottom:.5rem;"><strong>Verifiable Escrows:</strong> All budgets are locked inside KissVM smart contracts. Creators can verify where their money goes, and viewers are guaranteed payment.</li>' +
    '<li style="margin-bottom:.5rem;"><strong>Zero Intermediaries:</strong> Fees are direct, transparent (6% platform fee for protocol maintenance), and payouts go directly from creators to viewers and publishers.</li>';
  aFeaturesCard.appendChild(aFeaturesList);
  aboutPanel.appendChild(aFeaturesCard);

  // Architecture card
  var aArchCard = createContentCard('#3498db', 'Architecture Highlights');
  var aArchList = document.createElement('ul');
  aArchList.style.cssText = 'margin:.35rem 0 0;padding-left:1.5rem;';
  aArchList.innerHTML =
    '<li style="margin-bottom:.5rem;"><strong>Service Worker:</strong> Handles background tasks, persistent data storage, and Maxima event processing without relying on your node being online.</li>' +
    '<li style="margin-bottom:.5rem;"><strong>Layer 2 Channels:</strong> Unidirectional payment channels prevent blockchain congestion while ensuring instant settlement capability.</li>' +
    '<li style="margin-bottom:.5rem;"><strong>KissVM Contracts:</strong> All campaign budgets are locked in verifiable smart contracts on the Minima blockchain.</li>';
  aArchCard.appendChild(aArchList);
  aboutPanel.appendChild(aArchCard);

  var aFooter = document.createElement('p');
  aFooter.style.cssText = 'text-align:center;margin-top:2rem;font-size:0.8rem;color:var(--pico-muted-color);';
  aFooter.textContent = 'MinimaAds v1.2.0 • Decentralized Ad Infrastructure';
  aboutPanel.appendChild(aFooter);

  root.appendChild(aboutPanel);

  // Tab selection logic
  function _selectHelpTab(targetPanelId) {
    var tabList = tabsDiv.querySelectorAll('[role="tab"]');
    for (var j = 0; j < tabList.length; j++) {
      var tab = tabList[j];
      var isTarget = tab.getAttribute('data-target') === targetPanelId;
      tab.setAttribute('aria-selected', isTarget ? 'true' : 'false');
    }

    var panels = root.querySelectorAll('.ma-tab-panel');
    for (var k = 0; k < panels.length; k++) {
      var p = panels[k];
      if (p.id === targetPanelId) {
        p.removeAttribute('hidden');
        p.style.display = '';
      } else {
        p.setAttribute('hidden', '');
        p.style.display = 'none';
      }
    }
  }
}
