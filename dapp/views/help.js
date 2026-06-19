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
    '<li style="margin-bottom:.5rem;"><strong>Cooldown:</strong> There is a cooldown period between rewards for the same campaign to prevent reward farming. Each creator can configure their campaign\'s cooldown duration (default 5 minutes). You cannot earn from the same campaign faster than that campaign\'s cooldown period allows.</li>' +
    '<li style="margin-bottom:.5rem;"><strong>Daily cap:</strong> Each campaign creator sets a daily maximum for views and clicks per user (default is 100 each, tracked independently). You cannot exceed these limits within a 24-hour period, even if you accumulate rewards across multiple sessions.</li>' +
    '<li style="margin-bottom:.5rem;"><strong>Ad rotation:</strong> The app prioritizes showing you campaigns you haven\'t seen yet during your session. Once you\'ve viewed most available campaigns, you\'ll see repeats. Restarting the app resets your session history.</li>' +
    '<li style="margin-bottom:.5rem;"><strong>Self-rewards:</strong> You cannot earn rewards from campaigns you created yourself.</li>' +
    '<li style="margin-bottom:.5rem;"><strong>Paused campaigns:</strong> If a creator pauses their campaign, you won\'t earn new rewards while paused. Your accumulated channel balance is safe and you can still settle it anytime. If the creator resumes, earning resumes.</li>' +
    '<li style="margin-bottom:.5rem;"><strong>Limit Feedback & Badges:</strong> If you open a campaign while under cooldown, having reached your daily limit, or if you have completed the reward limit for that campaign, an immediate red status message will inform you and block reward processing. A red <strong>Limit Reached</strong> badge will also be displayed next to the campaign name in your list once you have received all the rewards allowed for that campaign channel.</li>';
  vLimitsCard.appendChild(vLimitsList);
  viewerPanel.appendChild(vLimitsCard);

  // Reward Settlement card
  var vSettleCard = createContentCard('#2ecc71', 'Reward Settlement');
  var vSettleDesc = document.createElement('p');
  vSettleDesc.style.cssText = 'font-size:0.9rem;margin:.35rem 0 0;';
  vSettleDesc.innerHTML = 'Your rewards accumulate in Layer 2 payment channels (off-chain) as you earn from campaigns. To claim your rewards and transfer them to your Minima wallet, settle your channels in the <strong>Earnings</strong> tab when campaigns end. Settlement is instant and posts your balance to the blockchain. ' +
    '<strong>Settlement Frequency:</strong> You don\'t need to settle frequently — rewards are safe in the channel until you decide to claim them. Settle when a campaign finishes or when you have accumulated substantial rewards. ' +
    'Each channel remains open for ~7 days after a campaign ends. If you don\'t settle within this window, unclaimed rewards are returned to the creator via the timelock mechanism. ' +
    'Check your <strong>Time Left</strong> countdown in the Earnings tab to know your deadline.';
  vSettleCard.appendChild(vSettleDesc);
  viewerPanel.appendChild(vSettleCard);

  root.appendChild(viewerPanel);

  // --- 2. CREATOR PANEL ---
  var creatorPanel = createPanel('creator', false);
  creatorPanel.appendChild(mkSectionTitle('Creator Guide'));

  var cIntro = document.createElement('p');
  cIntro.innerHTML = 'As a <strong>Creator</strong>, you can design ad banners and fund campaigns using Minima tokens to reach users across the network.';
  cIntro.style.cssText = 'margin-bottom:1.5rem;';
  creatorPanel.appendChild(cIntro);

  // Before You Start card
  var cPrereqCard = createContentCard('#e74c3c', 'Before You Start — Static MLS Required');
  var cPrereqDesc = document.createElement('p');
  cPrereqDesc.style.cssText = 'font-size:0.9rem;margin:.35rem 0 0;';
  cPrereqDesc.innerHTML = 'Before creating your first campaign, your node must have a <strong>static Maxima Location Server (MLS)</strong> configured. ' +
    'The MLS is a permanent network address that allows other nodes to discover and reach you for campaign delivery and reward settlement. ' +
    'Without a static MLS, your campaigns will be network-invisible and no one will be able to view your ads or earn rewards. ' +
    'The app will guide you through MLS registration the first time you create a campaign — you will need to have Maxima enabled on your Minima node.';
  cPrereqCard.appendChild(cPrereqDesc);
  creatorPanel.appendChild(cPrereqCard);

  // Creating a Campaign card
  var cStepsCard = createContentCard('#2ecc71', 'Creating a Campaign');
  var cStepsList = document.createElement('ol');
  cStepsList.style.cssText = 'margin:.35rem 0 0;padding-left:1.5rem;';
  cStepsList.innerHTML =
    '<li style="margin-bottom:.5rem;">Set your role to <strong>Creator</strong> in the side menu.</li>' +
    '<li style="margin-bottom:.5rem;">Click <strong>Create Campaign</strong>. Fill in the content (title, description, CTA, interests, and optional banner image).</li>' +
    '<li style="margin-bottom:.5rem;">Define your total campaign budget and the reward rates (amount paid per view and per click). Optional: set publisher rewards if you want to pay publishers for distributing your ads.</li>' +
    '<li style="margin-bottom:.5rem;">Two separate fees are automatically added to your total funding: a <strong>6%</strong> platform fee and a <strong>3%</strong> Minima Foundation fee. Your final payment will be: budget × 1.09.</li>' +
    '<li style="margin-bottom:.5rem;">Review and approve. Your funds are locked in a secure on-chain escrow contract (a KissVM smart contract on the Minima blockchain).</li>' +
    '<li style="margin-bottom:.5rem;"><strong>During the campaign:</strong> Your budget remains in the escrow contract. As viewers open channels and earn rewards, their balances accumulate off-chain in Layer 2 payment channels. Only settlement transactions post to the blockchain.</li>' +
    '<li style="margin-bottom:.5rem;"><strong>Campaign duration:</strong> Campaigns run for a maximum of <strong>90 days</strong>. After 90 days, the campaign automatically transitions to <strong>Finished</strong> status. Viewers can no longer earn new rewards, but existing channels can still be settled.</li>' +
    '<li style="margin-bottom:.5rem;"><strong>Unspent funds:</strong> Any unspent budget returns to your wallet after the campaign ends. When a viewer settles their channel, the change output returns to your escrow contract. After a ~7-day safety period (timelock), you can reclaim any remaining funds locked in unsettled channels.</li>';
  cStepsCard.appendChild(cStepsList);
  creatorPanel.appendChild(cStepsCard);

  // Campaign Management card
  var cStatusCard = createContentCard('#3498db', 'Campaign Management & On-chain Status');
  var cStatusDesc = document.createElement('p');
  cStatusDesc.style.cssText = 'font-size:0.9rem;margin:.35rem 0 0;';
  cStatusDesc.innerHTML = 'In <strong>My Campaigns</strong>, you can track views/clicks in real time and manage status (Pause, Resume, or Finish). ' +
    'To change status, you must be online to sign and post the transaction. Your device will create an on-chain update transaction that stores the new status directly in the escrow coin. ' +
    'Once confirmed, every other node — including those offline during the change — discovers the update on their next block scan. The status change is permanent and on-chain, so viewers see the updated status even if you go offline afterwards. ' +
    'Note: campaigns created with older escrow versions may use different status propagation methods.';
  cStatusCard.appendChild(cStatusDesc);
  creatorPanel.appendChild(cStatusCard);

  // Campaign Finalization card
  var cFinishCard = createContentCard('#e74c3c', 'When Your Campaign Finishes');
  var cFinishDesc = document.createElement('p');
  cFinishDesc.style.cssText = 'font-size:0.9rem;margin:.35rem 0 0;';
  cFinishDesc.innerHTML = 'A campaign finishes either automatically after <strong>90 days</strong> or when you manually click <strong>Finish</strong>. Once finished: ' +
    '<ul style="margin:.35rem 0 0;padding-left:1.5rem;font-size:0.9rem;">' +
    '<li style="margin-bottom:.3rem;">Viewers can no longer earn <strong>new rewards</strong> from your campaign.</li>' +
    '<li style="margin-bottom:.3rem;">Viewers have a <strong>7-day settlement window</strong> to claim their accumulated rewards.</li>' +
    '<li style="margin-bottom:.3rem;">The system automatically attempts to settle all open viewer and publisher channels (auto-settlement).</li>' +
    '<li style="margin-bottom:.3rem;">Any unspent budget returns to your wallet after settlements complete and the 7-day grace period expires.</li>' +
    '</ul>';
  cFinishCard.appendChild(cFinishDesc);
  creatorPanel.appendChild(cFinishCard);

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

  // Campaign Limits card
  var cLimitsCard = createContentCard('#f39c12', 'Campaign Limits & Minimums');
  var cLimitsList = document.createElement('ul');
  cLimitsList.style.cssText = 'font-size:0.9rem;margin:.35rem 0 0;padding-left:1.5rem;';
  cLimitsList.innerHTML =
    '<li style="margin-bottom:.3rem;"><strong>Minimum budget:</strong> 100 MINIMA. Cannot create campaigns with less.</li>' +
    '<li style="margin-bottom:.3rem;"><strong>Minimum view reward:</strong> 0.001 MINIMA per view.</li>' +
    '<li style="margin-bottom:.3rem;"><strong>Minimum click reward:</strong> 0.001 MINIMA per click (if click rewards are enabled).</li>' +
    '<li style="margin-bottom:.3rem;"><strong>Maximum duration:</strong> 90 days. Campaigns automatically finish after 90 days on-chain.</li>' +
    '<li>When a campaign expires, it transitions to <strong>Finished</strong> status automatically. Viewers can no longer earn new rewards but can settle existing channels.</li>';
  cLimitsCard.appendChild(cLimitsList);
  creatorPanel.appendChild(cLimitsCard);

  // Settlements card
  var cSettleCard = createContentCard('#9b59b6', 'Pending Settlements & Refunds');
  var cSettleDesc = document.createElement('p');
  cSettleDesc.style.cssText = 'font-size:0.9rem;margin:.35rem 0 0;';
  cSettleDesc.innerHTML = 'The <strong>Pending Settlement</strong> section shows open payment channels with active viewers and publishers. ' +
    'When viewers settle their channels, any unspent balance returns to you as change output. Unspent channel balances are also automatically returned to your wallet after the channel\'s lock period expires (timelock reclaim). Marking a campaign as finished notifies viewers to settle but does not immediately return funds from open channels.';
  cSettleCard.appendChild(cSettleDesc);
  creatorPanel.appendChild(cSettleCard);

  root.appendChild(creatorPanel);

  // --- 3. PUBLISHER PANEL ---
  var publisherPanel = createPanel('publisher', false);
  publisherPanel.appendChild(mkSectionTitle('Publisher Guide'));

  var pIntro = document.createElement('p');
  pIntro.innerHTML = 'As a <strong>Publisher</strong>, you can monetize your own MiniDapps by integrating the MinimaAds SDK to display ads. Publishers hosting the SDK inside another MiniDapp must use the <code>mdsAlreadyInitialized</code> option to avoid conflicting with the host MDS event loop.';
  pIntro.style.cssText = 'margin-bottom:1.5rem;';
  publisherPanel.appendChild(pIntro);

  // Prerequisites card
  var pPrereqCard = createContentCard('#e74c3c', 'Before You Start — Static MLS Required');
  var pPrereqDesc = document.createElement('p');
  pPrereqDesc.style.cssText = 'font-size:0.9rem;margin:.35rem 0 0;';
  pPrereqDesc.innerHTML = 'Your node must have a <strong>static Maxima Location Server (MLS)</strong> configured. ' +
    'The MLS is a permanent network address that allows creators and the platform to discover and reach you for reward settlement. ' +
    'Without a static MLS, you will not be able to receive publisher rewards or be discoverable by creators. ' +
    'You can configure your static MLS in the <strong>Settings</strong> tab. If not configured, the app will automatically redirect you to Settings when you create your first Frame.';
  pPrereqCard.appendChild(pPrereqDesc);
  publisherPanel.appendChild(pPrereqCard);

  // Getting Started card
  var pStepsCard = createContentCard('#2ecc71', 'Getting Started');
  var pStepsList = document.createElement('ol');
  pStepsList.style.cssText = 'margin:.35rem 0 0;padding-left:1.5rem;';
  pStepsList.innerHTML =
    '<li style="margin-bottom:.5rem;">Go to the <strong>Frames</strong> section under the Publisher role.</li>' +
    '<li style="margin-bottom:.5rem;">Create a new <strong>Frame</strong> (a named ad slot identifier).</li>' +
    '<li style="margin-bottom:.5rem;">Copy the generated integration snippet.</li>' +
    '<li style="margin-bottom:.5rem;">Include the MinimaAds SDK script in your dApp and call <code>MinimaAds.init({ wallet: "0x...", frameId: "your-frame-id" }, callback)</code> with your wallet address.</li>' +
    '<li style="margin-bottom:.5rem;">Place the <code>&lt;div id="minima-ad-slot"&gt;&lt;/div&gt;</code> container where you want the ad banner to render.</li>';
  pStepsCard.appendChild(pStepsList);
  publisherPanel.appendChild(pStepsCard);

  // Embedding in Existing MiniDapp card
  var pEmbedCard = createContentCard('#f39c12', 'Embedding in an Existing MiniDapp');
  var pEmbedDesc = document.createElement('p');
  pEmbedDesc.style.cssText = 'font-size:0.9rem;margin:.35rem 0 .5rem;';
  pEmbedDesc.innerHTML = 'If your dApp already owns <code>MDS.init()</code> and calls it during startup, you must pass an additional option to the SDK to avoid conflicting initializations:';
  pEmbedCard.appendChild(pEmbedDesc);
  var pEmbedCode = document.createElement('code');
  pEmbedCode.style.cssText = 'display:block;background:rgba(0,0,0,0.05);padding:.5rem;border-radius:0.25rem;font-size:0.85rem;margin:.35rem 0 .5rem;';
  pEmbedCode.innerHTML = 'MinimaAds.init({ wallet: "0x...", frameId: "your-frame-id", mdsAlreadyInitialized: true }, callback)';
  pEmbedCard.appendChild(pEmbedCode);
  var pEmbedP2 = document.createElement('p');
  pEmbedP2.style.cssText = 'font-size:0.9rem;margin:0;';
  pEmbedP2.innerHTML = 'Then, forward every MDS callback message to the SDK: <code>MinimaAds.handleMdsEvent(msg)</code> inside your <code>MDS.init</code> callback. This ensures the SDK receives all blockchain events it needs to function.';
  pEmbedCard.appendChild(pEmbedP2);
  publisherPanel.appendChild(pEmbedCard);

  // Publisher Rewards card
  var pRewardsCard = createContentCard('#3498db', 'Publisher Rewards');
  var pRewardsDesc = document.createElement('p');
  pRewardsDesc.style.cssText = 'font-size:0.9rem;margin:.35rem 0 .5rem;';
  pRewardsDesc.textContent = 'When a ';
  var creatorLink = createTabLink('creator', 'creator');
  pRewardsDesc.appendChild(creatorLink);
  pRewardsDesc.appendChild(document.createTextNode(' runs an ad campaign with publisher rewards enabled, your custom frame automatically accumulates a fixed reward amount per validated view. ' +
    'Like '));
  var viewerLink2 = createTabLink('viewer', 'viewers');
  pRewardsDesc.appendChild(viewerLink2);
  var finalSpan = document.createElement('span');
  finalSpan.innerHTML = ', publisher rewards are accrued in L2 payment channels. You can monitor and settle these pending amounts in the <strong>Earnings</strong> tab under your Publisher dashboard.';
  pRewardsDesc.appendChild(finalSpan);
  pRewardsCard.appendChild(pRewardsDesc);
  var pRewardsNote = document.createElement('p');
  pRewardsNote.style.cssText = 'font-size:0.85rem;color:var(--pico-muted-color);margin:0;';
  pRewardsNote.innerHTML = '<strong>Note:</strong> Publishers always earn a minimum reward per validated view. The built-in viewer (View Ads section) also generates publisher-side rewards, but those go to the MinimaAds platform, not to your custom frame.';
  pRewardsCard.appendChild(pRewardsNote);
  publisherPanel.appendChild(pRewardsCard);

  // Reward Settlement card
  var pSettleCard = createContentCard('#2ecc71', 'Reward Settlement');
  var pSettleDesc = document.createElement('p');
  pSettleDesc.style.cssText = 'font-size:0.9rem;margin:.35rem 0 0;';
  pSettleDesc.innerHTML = 'Your publisher rewards accumulate in Layer 2 payment channels (off-chain) as creators run campaigns with publisher rewards enabled. To claim your accumulated rewards and transfer them to your Minima wallet, settle your channels in the <strong>Earnings</strong> tab. Settlement is instant and posts your balance to the blockchain. ' +
    '<strong>Settlement Frequency:</strong> You don\'t need to settle frequently — rewards are safe in the channel until you decide to claim them. Settle when campaigns finish or when you have accumulated substantial rewards. ' +
    'Each channel remains open for ~7 days after a campaign ends. If you don\'t settle within this window, unclaimed rewards are returned to the creator via the timelock mechanism. ' +
    'Check your <strong>Time Left</strong> countdown in the Earnings tab to know your deadline.';
  pSettleCard.appendChild(pSettleDesc);
  publisherPanel.appendChild(pSettleCard);

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
    '<li style="margin-bottom:.3rem;">Check your internet connection and ensure your node is synced. Campaigns are discovered automatically via the blockchain on each new block.</li>' +
    '<li style="margin-bottom:.3rem;">Setting your interests in <strong>Profile</strong> helps prioritize campaigns that match your preferences, but you can browse all active campaigns regardless.</li>' +
    '<li style="margin-bottom:.3rem;">Wait a few moments for your node to sync the latest blockchain state.</li>';
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
  faq4p1.style.cssText = 'font-size:0.9rem;margin:.35rem 0 .5rem;';
  faq4p1.innerHTML = '<strong>For viewers:</strong> Your existing rewards remain safe in payment channels. You can settle your accumulated rewards at any time — you do not need the creator to be online to post your settlement transaction.';
  faq4.appendChild(faq4p1);
  var faq4p2 = document.createElement('p');
  faq4p2.style.cssText = 'font-size:0.9rem;margin:0;';
  faq4p2.innerHTML = '<strong>For new rewards:</strong> Viewers cannot earn new rewards until the creator is back online, as the creator must respond to reward requests and send vouchers. ' +
    '<strong>For campaign status:</strong> For recently launched campaigns, pause or finish status changes are stored directly on the Minima blockchain and propagate automatically to all nodes — the creator does not need to be online for status changes to propagate.';
  faq4.appendChild(faq4p2);
  faqPanel.appendChild(faq4);

  // FAQ Item 5
  var faq5 = createContentCard('#e74c3c', 'What are the fees?');
  var faq5p1 = document.createElement('p');
  faq5p1.style.cssText = 'font-size:0.9rem;margin:.35rem 0 .5rem;';
  faq5p1.innerHTML = 'Creators pay two mandatory fees when creating a campaign:';
  faq5.appendChild(faq5p1);
  var faq5List = document.createElement('ul');
  faq5List.style.cssText = 'font-size:0.9rem;margin:.35rem 0 0;padding-left:1.5rem;';
  faq5List.innerHTML = '<li style="margin-bottom:.3rem;"><strong>6%</strong> platform fee (protocol maintenance and infrastructure).</li>' +
    '<li style="margin-bottom:.3rem;">This fee is added on top of your campaign budget. Your total funding = budget × 1.06.</li>' +
    '<li>Viewers and publishers earn the full reward amount — no fees are deducted from their rewards.</li>';
  faq5.appendChild(faq5List);
  faqPanel.appendChild(faq5);

  // FAQ Item 6
  var faq6 = createContentCard('#3498db', 'How do I become a publisher and earn rewards?');
  var faq6p1 = document.createElement('p');
  faq6p1.style.cssText = 'font-size:0.9rem;margin:.35rem 0 0;';
  var link6a = createTabLink('publisher', 'Publisher Guide');
  faq6p1.appendChild(document.createTextNode('Publishers integrate the MinimaAds SDK into their dApps. See our '));
  faq6p1.appendChild(link6a);
  faq6p1.appendChild(document.createTextNode(' to get started. You\'ll earn a fixed token amount per validated view in your custom Frame — but only from campaigns that have publisher rewards enabled. The reward rate is set by each creator.'));
  faq6.appendChild(faq6p1);
  faqPanel.appendChild(faq6);

  // FAQ Item 7
  var faq7 = createContentCard('#e74c3c', 'Will I lose my rewards if I don\'t claim them?');
  var faq7p1 = document.createElement('p');
  faq7p1.style.cssText = 'font-size:0.9rem;margin:.35rem 0 .5rem;';
  faq7p1.innerHTML = '<strong>Yes, if you wait too long.</strong> When a campaign ends, your channel will <strong>auto-settle automatically</strong> on the blockchain. However, you have a <strong>~7-day safety window</strong> to verify and manually settle if auto-settlement fails. ' +
    'After this window closes, any rewards you have not settled are returned to the creator — they are lost to you. This is a blockchain-enforced timeout, not a bug.';
  faq7.appendChild(faq7p1);
  var faq7p2 = document.createElement('p');
  faq7p2.style.cssText = 'font-size:0.9rem;margin:0;';
  faq7p2.innerHTML = '<strong>What to do:</strong> Check the <strong>Earnings</strong> tab after a campaign ends to verify your channel settled successfully. If it shows "EXPIRED" or settlement failed, go to Earnings and click <strong>Settle</strong> manually within the 7-day grace period. Settlement is instant and sends your rewards directly to your Minima wallet.';
  faq7.appendChild(faq7p2);
  faqPanel.appendChild(faq7);

  // FAQ Item 8
  var faq8 = createContentCard('#3498db', 'How do I claim my earnings?');
  var faq8p1 = document.createElement('p');
  faq8p1.style.cssText = 'font-size:0.9rem;margin:.35rem 0 .5rem;';
  faq8p1.innerHTML = 'Go to the <strong>Earnings</strong> tab in the top menu. You will see all open reward channels from campaigns you have participated in. ' +
    'For each channel with accumulated rewards, click the <strong>Settle</strong> button. This opens the Minima Hub transaction approval dialog.';
  faq8.appendChild(faq8p1);
  var faq8p2 = document.createElement('p');
  faq8p2.style.cssText = 'font-size:0.9rem;margin:0;';
  faq8p2.innerHTML = 'Approve the transaction in the Hub. Your rewards are posted to the Minima blockchain and arrive in your wallet immediately. ' +
    'The settled amount is now yours permanently — no further steps needed.';
  faq8.appendChild(faq8p2);
  faqPanel.appendChild(faq8);

  // FAQ Item 9
  var faq9 = createContentCard('#f39c12', 'What if my settlement fails?');
  var faq9p1 = document.createElement('p');
  faq9p1.style.cssText = 'font-size:0.9rem;margin:.35rem 0 .5rem;';
  faq9p1.innerHTML = 'Settlement is a blockchain operation and can fail. Common reasons:';
  faq9.appendChild(faq9p1);
  var faq9List = document.createElement('ul');
  faq9List.style.cssText = 'font-size:0.9rem;margin:.35rem 0 0;padding-left:1.5rem;';
  faq9List.innerHTML = '<li style="margin-bottom:.3rem;"><strong>Minima Hub not approved:</strong> The Hub must be open and you must approve the transaction. If you decline or close the Hub, settlement fails silently.</li>' +
    '<li style="margin-bottom:.3rem;"><strong>Channel already reclaimed:</strong> The 7-day grace period after campaign end has expired and the creator reclaimed the coin. The channel is now closed and cannot be settled. Contact the creator for a refund (out of band).</li>' +
    '<li style="margin-bottom:.3rem;"><strong>Already settled:</strong> You may have already settled this channel in a previous session. Check your wallet to confirm the balance arrived.</li>' +
    '<li>Network issues: Ensure your node is synced and connected. Try again after waiting a moment for block sync.</li>';
  faq9.appendChild(faq9List);
  var faq9p2 = document.createElement('p');
  faq9p2.style.cssText = 'font-size:0.85rem;color:var(--pico-muted-color);margin:.5rem 0 0;';
  faq9p2.innerHTML = '<strong>Best practice:</strong> Let campaigns auto-settle when they end. Only settle manually if the automatic settlement fails or if you want to claim rewards early. Check the Earnings tab regularly to verify settlements completed successfully within the 7-day grace period.';
  faq9.appendChild(faq9p2);
  faqPanel.appendChild(faq9);

  // FAQ Item 10
  var faq10 = createContentCard('#2ecc71', 'What is the difference between Viewer and Publisher rewards?');
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
    '<li style="margin-bottom:.5rem;"><strong>Service Worker:</strong> Runs background tasks, persistent data storage, and Maxima event processing. Campaign discovery and status changes propagate automatically via the blockchain even when creators are offline. However, creators must be online to open viewer channels and send reward vouchers. Viewers earn passively and can settle rewards at any time.</li>' +
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
