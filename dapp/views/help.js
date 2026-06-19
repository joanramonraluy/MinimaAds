// Help view — global, accessible from drawer regardless of active mode.
// Route: #help. Renders interactive guides divided by roles (Viewer, Creator, Publisher)
// and an About section detailing the decentralized architecture.

function renderHelp(root) {
  root.innerHTML = '';

  var h2 = document.createElement('h2');
  h2.textContent = 'Help & About';
  h2.style.cssText = 'margin:0 0 1.5rem 0;padding:1rem;background:rgba(0,0,0,0.02);border-left:4px solid #3498db;border-radius:0.375rem;';
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
    { id: 'faq', label: 'FAQ' },
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

  // Helper to create a cross-section link that switches tabs
  function createTabLink(tabId, label) {
    var link = document.createElement('button');
    link.type = 'button';
    link.textContent = label;
    link.style.cssText = 'background:none;border:none;color:var(--pico-form-element-valid-border-color,#2ecc71);cursor:pointer;padding:0;text-decoration:underline;font-weight:600;font-size:inherit;';
    link.addEventListener('click', function(e) {
      e.preventDefault();
      _selectHelpTab('ma-help-panel-' + tabId);
      // Scroll tab into view
      var tab = document.getElementById('ma-help-tab-' + tabId);
      if (tab) { tab.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
    });
    return link;
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
    '<li style="margin-bottom:.5rem;">Set your interests in the <strong>Profile</strong> section to help match campaigns to your preferences.</li>' +
    '<li style="margin-bottom:.5rem;">Browse the available ad campaigns. Matching ads will be prioritized based on your interests.</li>' +
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
    'Once open, vouchers are sent directly to your node. You can settle these vouchers at any time under the <strong>Earnings</strong> tab to claim your funds directly to your Minima L1 wallet. ';
  var faqLinkL2 = createTabLink('faq', 'Learn more about channels');
  vL2Desc.appendChild(faqLinkL2);
  vL2Desc.appendChild(document.createTextNode('.'));
  vL2Card.appendChild(vL2Desc);
  viewerPanel.appendChild(vL2Card);

  // Limits & Cooldowns card
  var vLimitsCard = createContentCard('#f39c12', 'Limits & Cooldowns');
  var vLimitsList = document.createElement('ul');
  vLimitsList.style.cssText = 'font-size:0.9rem;margin:.35rem 0 0;padding-left:1.5rem;';
  vLimitsList.innerHTML =
    '<li style="margin-bottom:.5rem;"><strong>Cooldown:</strong> There is a cooldown period (default 5 minutes) between rewards for the same campaign to prevent spamming.</li>' +
    '<li style="margin-bottom:.5rem;"><strong>Daily cap:</strong> Each campaign has a maximum daily limit of views and clicks per user (default 100).</li>' +
    '<li style="margin-bottom:.5rem;"><strong>Self-rewards:</strong> You cannot earn rewards from campaigns you created yourself.</li>' +
    '<li style="margin-bottom:.5rem;"><strong>Limit Feedback & Badges:</strong> If you open a campaign while under cooldown, having reached your daily limit, or if you have completed the reward limit for that campaign, an immediate red status message will inform you and block reward processing. A red <strong>Limit Reached</strong> badge will also be displayed next to the campaign name in your list once you have received all the rewards allowed for that campaign channel.</li>';
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
    '<li style="margin-bottom:.5rem;">Platform fees of <strong>6%</strong> (protocol) and <strong>3%</strong> (Minima Foundation) are automatically calculated and added to the escrow funding amount.</li>' +
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
  cBudgetDesc.textContent = 'To give you complete transparency over campaign funding, your budget is split into two mandatory allocations: ';
  var viewerLink = createTabLink('viewer', 'Viewer Rewards');
  cBudgetDesc.appendChild(viewerLink);
  cBudgetDesc.appendChild(document.createTextNode(' (for viewers who interact with your ads) and '));
  var pubLink = createTabLink('publisher', 'Publisher Rewards');
  cBudgetDesc.appendChild(pubLink);
  cBudgetDesc.appendChild(document.createTextNode(' (for publishers who distribute your campaign).'));
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
  pRewardsDesc.textContent = 'When a ';
  var creatorLink = createTabLink('creator', 'creator');
  pRewardsDesc.appendChild(creatorLink);
  pRewardsDesc.appendChild(document.createTextNode(' runs an ad campaign, your frame automatically accumulates <strong>Publisher rewards per view</strong>. ' +
    'Like '));
  var viewerLink2 = createTabLink('viewer', 'viewers');
  pRewardsDesc.appendChild(viewerLink2);
  pRewardsDesc.appendChild(document.createTextNode(', publisher rewards are accrued in L2 payment channels. You can monitor and settle these pending amounts in the <strong>Earnings</strong> tab under your Publisher dashboard.'));
  pRewardsCard.appendChild(pRewardsDesc);
  publisherPanel.appendChild(pRewardsCard);
  root.appendChild(publisherPanel);

  // --- 4. FAQ PANEL ---
  var faqPanel = createPanel('faq', false);
  faqPanel.appendChild(mkSectionTitle('Frequently Asked Questions'));

  // FAQ Item 1
  var faq1 = createContentCard('#3498db', 'Why can\'t I see any campaigns?');
  var faq1p1 = document.createElement('p');
  faq1p1.style.cssText = 'font-size:0.9rem;margin:.35rem 0 .5rem;';
  faq1p1.innerHTML = 'Campaigns are discovered through Maxima peer-to-peer messaging. If no campaigns appear:';
  faq1.appendChild(faq1p1);
  var faq1List = document.createElement('ul');
  faq1List.style.cssText = 'font-size:0.9rem;margin:.35rem 0 0;padding-left:1.5rem;';
  faq1List.innerHTML = '<li style="margin-bottom:.3rem;">Check that you\'ve set your role to <strong>Viewer</strong> in the side menu.</li>' +
    '<li style="margin-bottom:.3rem;">Ensure your interests are set in <strong>Profile</strong> — campaigns match based on your interests.</li>' +
    '<li style="margin-bottom:.3rem;">Wait a few moments for Maxima messages to propagate across the network.</li>' +
    '<li style="margin-bottom:.3rem;">Check if there are any active campaigns by asking a creator to broadcast one.</li>';
  faq1.appendChild(faq1List);
  faqPanel.appendChild(faq1);

  // FAQ Item 2
  var faq2 = createContentCard('#2ecc71', 'How do I set up and start earning as a creator?');
  var faq2p1 = document.createElement('p');
  faq2p1.style.cssText = 'font-size:0.9rem;margin:.35rem 0 0;';
  var link2a = createTabLink('creator', 'Creator Guide');
  faq2p1.appendChild(document.createTextNode('See our '));
  faq2p1.appendChild(link2a);
  faq2p1.appendChild(document.createTextNode(' for step-by-step instructions on creating a campaign and funding it with your budget.'));
  faq2.appendChild(faq2p1);
  faqPanel.appendChild(faq2);

  // FAQ Item 3
  var faq3 = createContentCard('#9b59b6', 'What are Layer 2 Channels and why do I need them?');
  var faq3p1 = document.createElement('p');
  faq3p1.style.cssText = 'font-size:0.9rem;margin:.35rem 0 0;';
  faq3p1.innerHTML = 'Payment channels are a scaling technique that accumulates rewards off-chain to avoid blockchain congestion. ' +
    'Instead of settling every single view or click on-chain (expensive), rewards accumulate in a secure L2 channel. ' +
    'You can settle your channel to your L1 wallet anytime through the <strong>Earnings</strong> tab.';
  faq3.appendChild(faq3p1);
  faqPanel.appendChild(faq3);

  // FAQ Item 4
  var faq4 = createContentCard('#f39c12', 'What happens if a creator goes offline?');
  var faq4p1 = document.createElement('p');
  faq4p1.style.cssText = 'font-size:0.9rem;margin:.35rem 0 0;';
  faq4p1.innerHTML = '<strong>For viewers:</strong> Your existing rewards remain safe in payment channels. ' +
    'You can continue settling your channel anytime. However, new rewards cannot be earned until the creator comes back online. ' +
    '<strong>For campaign status:</strong> If a campaign has a status update stored on-chain (V3 coins), the status change will propagate across the network even if the creator is offline.';
  faq4.appendChild(faq4p1);
  faqPanel.appendChild(faq4);

  // FAQ Item 5
  var faq5 = createContentCard('#e74c3c', 'What are the fees?');
  var faq5p1 = document.createElement('p');
  faq5p1.style.cssText = 'font-size:0.9rem;margin:.35rem 0 .5rem;';
  faq5p1.innerHTML = 'Creators pay two mandatory fees when creating a campaign:';
  faq5.appendChild(faq5p1);
  var faq5List = document.createElement('ul');
  faq5List.style.cssText = 'font-size:0.9rem;margin:.35rem 0 0;padding-left:1.5rem;';
  faq5List.innerHTML = '<li style="margin-bottom:.3rem;"><strong>6%</strong> Platform fee (protocol maintenance and infrastructure).</li>' +
    '<li style="margin-bottom:.3rem;"><strong>3%</strong> Minima Foundation fee (ecosystem support).</li>' +
    '<li style="margin-bottom:.3rem;">These are added to your campaign budget at creation time.</li>' +
    '<li>Viewers and publishers earn the full reward amount — no fees deducted from their rewards.</li>';
  faq5.appendChild(faq5List);
  faqPanel.appendChild(faq5);

  // FAQ Item 6
  var faq6 = createContentCard('#3498db', 'How do I become a publisher and earn rewards?');
  var faq6p1 = document.createElement('p');
  faq6p1.style.cssText = 'font-size:0.9rem;margin:.35rem 0 0;';
  var link6a = createTabLink('publisher', 'Publisher Guide');
  faq6p1.appendChild(document.createTextNode('Publishers integrate the MinimaAds SDK into their dApps. See our '));
  faq6p1.appendChild(link6a);
  faq6p1.appendChild(document.createTextNode(' to get started. You\'ll earn a share of every ad impression in your custom Frame.'));
  faq6.appendChild(faq6p1);
  faqPanel.appendChild(faq6);

  // FAQ Item 7
  var faq7 = createContentCard('#2ecc71', 'What is the difference between Viewer and Publisher rewards?');
  var faq7p1 = document.createElement('p');
  faq7p1.style.cssText = 'font-size:0.9rem;margin:.35rem 0 .5rem;';
  faq7p1.innerHTML = 'Creators allocate their budget into two pools:';
  faq7.appendChild(faq7p1);
  var faq7List = document.createElement('ul');
  faq7List.style.cssText = 'font-size:0.9rem;margin:.35rem 0 0;padding-left:1.5rem;';
  faq7List.innerHTML = '<li style="margin-bottom:.3rem;"><strong>Viewer Rewards:</strong> Paid to users who view and click your ads.</li>' +
    '<li style="margin-bottom:.3rem;"><strong>Publisher Rewards:</strong> Paid to publishers who distribute your campaign in their dApps.</li>' +
    '<li>Both use the same Layer 2 channel infrastructure and are fully transparent in your campaign budget breakdown.</li>';
  faq7.appendChild(faq7List);
  faqPanel.appendChild(faq7);

  root.appendChild(faqPanel);

  // --- 5. ABOUT PANEL ---
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
    '<li style="margin-bottom:.5rem;"><strong>Service Worker:</strong> Runs background tasks, persistent data storage, and Maxima event processing. Creators and publishers must stay online to send campaigns and receive rewards; viewers earn passively and can settle rewards anytime.</li>' +
    '<li style="margin-bottom:.5rem;"><strong>Layer 2 Channels:</strong> Unidirectional payment channels prevent blockchain congestion while ensuring instant settlement capability.</li>' +
    '<li style="margin-bottom:.5rem;"><strong>KissVM Contracts:</strong> All campaign budgets are locked in verifiable smart contracts on the Minima blockchain.</li>';
  aArchCard.appendChild(aArchList);
  aboutPanel.appendChild(aArchCard);

  var aFooter = document.createElement('p');
  aFooter.style.cssText = 'text-align:center;margin-top:2rem;font-size:0.8rem;color:var(--pico-muted-color);';
  aFooter.textContent = 'MinimaAds v0.26.6.3 • Decentralized Ad Infrastructure';
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
