// T10 — Creator view.
// Renders the campaign creation form, funds the KissVM escrow, persists
// the campaign locally via saveCampaign(), and broadcasts CAMPAIGN_ANNOUNCE.
// Escrow flow: MinimaAds.md §6.3 step 4 / Appendix B.
// CAMPAIGN_ANNOUNCE schema: MinimaAds.md §8.3.

// ~10 000 blocks at ~50 s/block ≈ 6 days. Informational only — not enforced by script.
var CAMPAIGN_DURATION_BLOCKS = 10000;

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
  var budget     = parseFloat(data.get('budget'));
  var rewardView = parseFloat(data.get('reward_view'));
  var rewardClick= parseFloat(data.get('reward_click'));
  var expiresAtRaw = (data.get('expires_at') || '').toString().trim();
  var expiresAt  = expiresAtRaw ? parseInt(expiresAtRaw, 10) : null;

  if (!title || !body || !ctaLabel || !ctaUrl) {
    msgEl.textContent = 'Missing required text fields.';
    return;
  }
  if (!(budget > 0) || !(rewardView >= 0) || !(rewardClick >= 0)) {
    msgEl.textContent = 'Budget and reward amounts must be non-negative numbers.';
    return;
  }
  if (rewardView > budget || rewardClick > budget) {
    msgEl.textContent = 'Rewards cannot exceed total budget.';
    return;
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
    escrow_coinid:    '',
    escrow_wallet_pk: ''
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

  fundEscrowAndPublish(campaign, ad, form, submitBtn, msgEl);
}

var ESCROW_SCRIPT_FE = 'LET creatorkey=PREVSTATE(1) ASSERT SIGNEDBY(creatorkey) LET payout=STATE(10) LET change=@AMOUNT-payout IF change GT 0 THEN ASSERT VERIFYOUT(INC(@INPUT) @ADDRESS change @TOKENID TRUE) ENDIF RETURN TRUE';

function resolveEscrowAddress(cb) {
  MDS.keypair.get('ESCROW_ADDRESS', function(addrRes) {
    var cached = addrRes && addrRes.response ? addrRes.response.value : '';
    if (cached) {
      console.log('[CREATOR] ESCROW_ADDRESS from keypair:', cached);
      cb(cached);
      return;
    }
    console.log('[CREATOR] ESCROW_ADDRESS not in keypair — deriving via newscript');
    MDS.cmd('newscript script:"' + ESCROW_SCRIPT_FE + '" trackall:true', function(res) {
      if (!res.status) {
        console.error('[CREATOR] newscript failed:', res.error);
        cb('');
        return;
      }
      var addr = res.response.address;
      console.log('[CREATOR] ESCROW_ADDRESS derived:', addr);
      MDS.keypair.set('ESCROW_ADDRESS', addr, function() {});
      cb(addr);
    });
  });
}

function fundEscrowAndPublish(campaign, ad, form, submitBtn, msgEl) {
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

    MDS.cmd('keys action:list', function(keysRes) {
      if (!keysRes.status || !keysRes.response || !keysRes.response.keys || !keysRes.response.keys.length) {
        fail('Could not fetch wallet keys.');
        return;
      }
      var walletPK = keysRes.response.keys[0].publickey;
      console.log('[CREATOR] walletPK:', walletPK);

      MDS.cmd('block', function(blockRes) {
        if (!blockRes.status) {
          fail('Could not fetch current block.');
          return;
        }
        var expiryBlock = parseInt(blockRes.response.block) + CAMPAIGN_DURATION_BLOCKS;
        console.log('[CREATOR] expiryBlock:', expiryBlock);

        MDS.cmd('maxima action:info', function(mxRes) {
          if (!mxRes.status) {
            fail('Could not fetch Maxima identity.');
            return;
          }
          var creatorContact    = mxRes.response.contact;
          var campaignIdHex     = '0x' + utf8ToHex(campaign.id).toUpperCase();
          var creatorContactHex = '0x' + utf8ToHex(creatorContact).toUpperCase();
          var stateJson         = '{"1":"' + walletPK
                                + '","2":"' + expiryBlock
                                + '","3":"' + campaignIdHex
                                + '","4":"' + creatorContactHex + '"}';
          console.log('[CREATOR] sending to escrow:', escrowAddress, 'state:', stateJson);

          MDS.cmd(
            'send amount:' + campaign.budget_total
              + ' address:' + escrowAddress
              + ' state:' + stateJson,
            function(sendRes) {
              console.log('[CREATOR] send response:', JSON.stringify(sendRes));

              if (sendRes.pending) {
                console.log('[CREATOR] send is pending approval, uid:', sendRes.pendinguid, 'campaignId:', campaign.id);
                campaign.escrow_wallet_pk = walletPK;
                var pendingData = JSON.stringify({ campaign: campaign, ad: ad });
                MDS.keypair.set('PENDING_CAMPAIGN_' + campaign.id, pendingData, function() {
                  console.log('[CREATOR] pending data stored in keypair for campaign:', campaign.id);
                });
                msgEl.textContent = 'Awaiting approval — please approve in Minima Hub pending queue.';
                if (submitBtn) { submitBtn.removeAttribute('disabled'); }
                return;
              }

              if (!sendRes.status) {
                fail('Escrow send failed: ' + (sendRes.error || 'unknown error'));
                return;
              }

              var coinId = '';
              try {
                coinId = sendRes.response.txpow.body.txn.outputs[0].coinid;
              } catch (ex) {
                console.error('[CREATOR] coinId extraction failed. Full response:', JSON.stringify(sendRes));
                fail('Could not read escrow coinId from send response.');
                return;
              }

              console.log('[CREATOR] escrow coinId:', coinId);
              campaign.escrow_coinid    = coinId;
              campaign.escrow_wallet_pk = walletPK;
              msgEl.textContent = 'Escrow funded. Saving campaign…';

              saveCampaignAndBroadcast(campaign, ad, form, submitBtn, msgEl);
            }
          );
        });
      });
    });
  });
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
