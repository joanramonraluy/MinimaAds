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

  // --- 1. VIEWER PANEL ---
  var viewerPanel = createPanel('viewer', true);
  viewerPanel.appendChild(mkSectionTitle('Viewer Guide'));
  
  var vIntro = document.createElement('p');
  vIntro.innerHTML = 'As a <strong>Viewer</strong>, you earn Minima tokens simply by viewing advertisements and clicking on calls-to-action (CTA).';
  viewerPanel.appendChild(vIntro);

  var vStepsTitle = document.createElement('h4');
  vStepsTitle.textContent = 'How to Earn';
  viewerPanel.appendChild(vStepsTitle);

  var vStepsList = document.createElement('ol');
  vStepsList.innerHTML = 
    '<li>Go to the <strong>View Ads</strong> section (set your role to Viewer in the side menu).</li>' +
    '<li>Browse the available ad campaigns. Your interests profile will automatically prioritize matching ads.</li>' +
    '<li><strong>View rewards:</strong> Keep the ad in view for at least <strong>3 seconds</strong> to receive the view reward.</li>' +
    '<li><strong>Click rewards:</strong> Click the "CTA button" or the ad image to navigate and earn the additional click reward.</li>';
  viewerPanel.appendChild(vStepsList);

  var vL2Title = document.createElement('h4');
  vL2Title.textContent = 'Decentralized Layer 2 Channels';
  viewerPanel.appendChild(vL2Title);

  var vL2Desc = document.createElement('p');
  vL2Desc.style.fontSize = '0.9rem';
  vL2Desc.innerHTML = 'To prevent on-chain congestion, rewards accumulate off-chain in <strong>unidirectional payment channels</strong>. ' +
    'The first time you interact with a campaign, the system opens a secure Layer 2 channel funded by the creator\'s campaign escrow. ' +
    'Once open, vouchers are sent directly to your node. You can settle these vouchers at any time under the <strong>Earnings</strong> tab to claim your funds directly to your Minima L1 wallet.';
  viewerPanel.appendChild(vL2Desc);

  var vLimitsTitle = document.createElement('h4');
  vLimitsTitle.textContent = 'Viewer Limits & Cooldowns';
  viewerPanel.appendChild(vLimitsTitle);

  var vLimitsList = document.createElement('ul');
  vLimitsList.style.fontSize = '0.9rem';
  vLimitsList.innerHTML = 
    '<li><strong>Cooldown:</strong> There is a cooldown period (default 5 minutes) between rewards for the same campaign to prevent spamming.</li>' +
    '<li><strong>Daily cap:</strong> Each campaign has a maximum daily limit of views and clicks per user (default 100).</li>' +
    '<li><strong>Self-rewards:</strong> You cannot earn rewards from campaigns you created yourself.</li>';
  viewerPanel.appendChild(vLimitsList);
  root.appendChild(viewerPanel);

  // --- 2. CREATOR PANEL ---
  var creatorPanel = createPanel('creator', false);
  creatorPanel.appendChild(mkSectionTitle('Creator Guide'));

  var cIntro = document.createElement('p');
  cIntro.innerHTML = 'As a <strong>Creator</strong>, you can design ad banners and fund campaigns using Minima tokens to reach users across the network.';
  creatorPanel.appendChild(cIntro);

  var cStepsTitle = document.createElement('h4');
  cStepsTitle.textContent = 'Creating a Campaign';
  creatorPanel.appendChild(cStepsTitle);

  var cStepsList = document.createElement('ol');
  cStepsList.innerHTML = 
    '<li>Set your role to <strong>Creator</strong> in the side menu.</li>' +
    '<li>Click <strong>Create Campaign</strong>. Fill in the content (title, description, CTA, interests, and optional banner image).</li>' +
    '<li>Define your total campaign budget and the reward rates (amount paid per view and per click).</li>' +
    '<li>A platform fee of <strong>6%</strong> is automatically calculated and added to the escrow funding amount.</li>' +
    '<li>Confirm and approve the transaction. Your funds are locked securely in a smart contract on the Minima blockchain.</li>';
  creatorPanel.appendChild(cStepsList);

  var cStatusTitle = document.createElement('h4');
  cStatusTitle.textContent = 'Campaign Management & On-chain Status';
  creatorPanel.appendChild(cStatusTitle);

  var cStatusDesc = document.createElement('p');
  cStatusDesc.style.fontSize = '0.9rem';
  cStatusDesc.innerHTML = 'In <strong>My Campaigns</strong>, you can track views/clicks in real time and manage status (Pause, Resume, or Finish). ' +
    'Status changes generate an on-chain update transaction. This updates the status state stored directly in the campaign\'s escrow coin, propagating the changes across the peer-to-peer network even if you go offline.';
  creatorPanel.appendChild(cStatusDesc);

  var cBudgetTitle = document.createElement('h4');
  cBudgetTitle.textContent = 'Understanding Budget Allocation & Performance';
  creatorPanel.appendChild(cBudgetTitle);

  var cBudgetDesc = document.createElement('p');
  cBudgetDesc.style.fontSize = '0.9rem';
  cBudgetDesc.innerHTML = 'To give you complete transparency over campaign funding, budgets are split into two dedicated sections in the dashboard: **Viewer** and **Publisher**:' +
    '<h5>Viewer Budget Allocation</h5>' +
    '<ul>' +
    '<li><strong>Available (Escrow):</strong> Budget remaining in the main on-chain smart contract, ready to fund new payment channels as new viewers discover your campaign.</li>' +
    '<li><strong>Locked in Channels:</strong> Budget currently locked in open viewer payment channels, indicating active viewer capacity.</li>' +
    '<li><strong>Settled (Paid):</strong> The total viewer rewards that have been settled on-chain and paid directly to viewers\' wallets.</li>' +
    '<li><strong>Unspent Campaign:</strong> The total campaign budget remaining that has not yet been paid or earned as rewards (Initial Budget minus all Settled and Unsettled earnings).</li>' +
    '</ul>' +
    '<h5>Publisher Budget Allocation</h5>' +
    '<ul>' +
    '<li><strong>Max Pub Budget:</strong> The total budget cap you configured for publisher rewards when creating the campaign.</li>' +
    '<li><strong>Budget Reserved:</strong> The sum of maximum capacities currently reserved in active payment channels opened by publishers (used as a cap to prevent channel over-allocation).</li>' +
    '<li><strong>Budget Spent:</strong> The sum of publisher rewards actually paid and earned dynamically by publishers displaying ads.</li>' +
    '<li><strong>Budget Left:</strong> The remaining portion of the publisher budget limit that has not yet been reserved or spent by publishers.</li>' +
    '</ul>' +
    'Additionally, you can see the **Reward/View** and **Reward/Click** unit rates configured for the campaign, alongside the **CTR (Click-Through Rate)** which measures user engagement as a percentage of views that led to a click: <code>(Clicks / Views) * 100</code>.';
  creatorPanel.appendChild(cBudgetDesc);

  var cSettleTitle = document.createElement('h4');
  cSettleTitle.textContent = 'Pending Settlements & Refunds';
  creatorPanel.appendChild(cSettleTitle);

  var cSettleDesc = document.createElement('p');
  cSettleDesc.style.fontSize = '0.9rem';
  cSettleDesc.innerHTML = 'The **Pending settlement** section shows open payment channels with active viewers/publishers. ' +
    'When viewers settle their channels or you mark a campaign as finished, all remaining unspent channel balances are returned directly to your main wallet address (not back to the escrow contract).';
  creatorPanel.appendChild(cSettleDesc);

  root.appendChild(creatorPanel);

  // --- 3. PUBLISHER PANEL ---
  var publisherPanel = createPanel('publisher', false);
  publisherPanel.appendChild(mkSectionTitle('Publisher Guide'));

  var pIntro = document.createElement('p');
  pIntro.innerHTML = 'As a <strong>Publisher</strong>, you can monetize your own MiniDapps or websites by integrating the MinimaAds SDK to show ads.';
  publisherPanel.appendChild(pIntro);

  var pStepsTitle = document.createElement('h4');
  pStepsTitle.textContent = 'Getting Started';
  publisherPanel.appendChild(pStepsTitle);

  var pStepsList = document.createElement('ol');
  pStepsList.innerHTML = 
    '<li>Go to the <strong>Frames</strong> section under the Publisher role.</li>' +
    '<li>Create a new <strong>Frame</strong> (a named ad slot identifier).</li>' +
    '<li>Copy the generated integration snippet.</li>' +
    '<li>Include the MinimaAds SDK script in your dApp and call <code>MinimaAds.init({ frameId: "your-frame-id" })</code>.</li>' +
    '<li>Place the <code>&lt;div id="minima-ad-slot"&gt;&lt;/div&gt;</code> container where you want the ad banner to render.</li>';
  publisherPanel.appendChild(pStepsList);

  var pRewardsTitle = document.createElement('h4');
  pRewardsTitle.textContent = 'Publisher Rewards';
  publisherPanel.appendChild(pRewardsTitle);

  var pRewardsDesc = document.createElement('p');
  pRewardsDesc.style.fontSize = '0.9rem';
  pRewardsDesc.innerHTML = 'When creators specify a <strong>Publisher reward per view</strong> (optional), your frame accumulates rewards automatically. ' +
    'Like viewers, publisher rewards are accrued in L2 payment channels. You can monitor and settle these pending amounts in the <strong>Earnings</strong> tab under your Publisher dashboard.';
  publisherPanel.appendChild(pRewardsDesc);
  root.appendChild(publisherPanel);

  // --- 4. ABOUT PANEL ---
  var aboutPanel = createPanel('about', false);
  aboutPanel.appendChild(mkSectionTitle('About MinimaAds'));

  var aDesc = document.createElement('p');
  aDesc.innerHTML = '<strong>MinimaAds</strong> is a fully decentralized advertising protocol built on top of the Minima blockchain. ' +
    'Unlike traditional ad networks, it operates without central servers, tracking databases, or intermediaries.';
  aboutPanel.appendChild(aDesc);

  var aFeaturesTitle = document.createElement('h4');
  aFeaturesTitle.textContent = 'Key Features';
  aboutPanel.appendChild(aFeaturesTitle);

  var aFeaturesList = document.createElement('ul');
  aFeaturesList.innerHTML = 
    '<li><strong>Absolute Privacy:</strong> Your interests, browsing patterns, and clicks are processed locally on your node. No data ever leaves your device except cryptographic proofs of validation.</li>' +
    '<li><strong>P2P Propagation:</strong> Ad campaigns and status changes propagate automatically across the network via Maxima, Minima\'s secure peer-to-peer messaging protocol.</li>' +
    '<li><strong>Verifiable Escrows:</strong> All budgets are locked inside KissVM smart contracts. Creators can verify where their money goes, and viewers are guaranteed payment.</li>' +
    '<li><strong>Zero Intermediaries:</strong> Fees are direct, transparent (6% platform fee for protocol maintenance), and payouts go directly from creators to viewers and publishers.</li>';
  aboutPanel.appendChild(aFeaturesList);
  
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
