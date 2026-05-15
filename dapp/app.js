// T10 — FE entry point.
// MDS.init bootstrap, MDSCOMMS dispatch, hash routing (#viewer | #creator | #stats).
// Waits for DB_READY (from SW signalFE) before rendering any DB-backed view.
// Silently ignores MAXIMA events already persisted by the SW (AGENTS.md §12 #16).
// APP_NAME and LIMITS mirror the SW globals (main.js) so core/minima.js and
// core/selection.js resolve them in FE scope (AGENTS.md §12 #23).

var APP_NAME = 'minima-ads';

var LIMITS = {
  MAX_VIEWS_PER_CAMPAIGN_PER_DAY:  100,
  MAX_CLICKS_PER_CAMPAIGN_PER_DAY: 100,
  COOLDOWN_BETWEEN_REWARDS_MS:     30000,
  MIN_VIEW_DURATION_MS:            3000,
  MAX_CAMPAIGNS_PER_SESSION:       10,
  MIN_BUDGET:                      100,
  MIN_REWARD_VIEW:                 0.001,
  MIN_REWARD_CLICK:                0.005,
  MAX_CAMPAIGN_DAYS:               90,
  MIN_PUBLISHER_REWARD_VIEW:       0.001
};

var MY_ADDRESS = '';
var MY_MX_ADDRESS = '';
var _dbReady = false;
// Tracks in-flight channel-related pending txns. Keyed by pendinguid.
// Mirrored to keypair (PENDING_CHANNEL_<uid>) so FE reloads don't lose context.
var _pendingChannelOps = {};

function generateUID() {
  return Date.now().toString(16) + '-' + Math.floor(Math.random() * 0xFFFFFFFF).toString(16);
}

function currentRoute() {
  var h = (window.location.hash || '').replace(/^#/, '');
  if (h === 'creator' || h === 'stats' || h === 'viewer' || h === 'earnings' || h === 'frames') { return h; }
  return 'stats';
}

function setStatus(text) {
  var root = document.getElementById('app');
  if (!root) { return; }
  root.innerHTML = '';
  var p = document.createElement('p');
  p.setAttribute('aria-busy', 'true');
  p.textContent = text;
  root.appendChild(p);
}

function doRender() {
  var root = document.getElementById('app');
  if (!root) { return; }
  if (!_dbReady) {
    setStatus('Initialising database…');
    return;
  }
  if (!MY_ADDRESS) {
    setStatus('Resolving Maxima identity…');
    return;
  }
  root.innerHTML = '';
  var route = currentRoute();
  if (route === 'creator' && typeof renderCreator === 'function') {
    renderCreator(root);
  } else if (route === 'earnings' && typeof renderEarnings === 'function') {
    renderEarnings(root);
  } else if (route === 'stats' && typeof renderStats === 'function') {
    renderStats(root);
  } else if (route === 'frames' && typeof renderFrames === 'function') {
    renderFrames(root);
  } else if (typeof renderViewer === 'function') {
    renderViewer(root);
  } else {
    setStatus('View not loaded.');
  }
}

function handleMdsComms(parsed) {
  if (!parsed || !parsed.type) { return; }
  if (parsed.type === 'DB_READY') {
    _dbReady = true;
    doRender();
    return;
  }
  if (parsed.type === 'CAMPAIGN_PENDING_DENIED') {
    var msgEl = document.getElementById('ma-creator-msg');
    if (msgEl) { msgEl.textContent = 'Transaction denied — escrow was not funded.'; }
    return;
  }
  if (parsed.type === 'NEW_CAMPAIGN' || parsed.type === 'CAMPAIGN_UPDATED') {
    if (currentRoute() === 'stats' && typeof renderStats === 'function') {
      renderStats(document.getElementById('app'));
    }
    if (currentRoute() === 'viewer' && typeof onCampaignsChanged === 'function') {
      onCampaignsChanged();
    }
    if (parsed.type === 'NEW_CAMPAIGN' && currentRoute() === 'creator') {
      var msgEl2 = document.getElementById('ma-creator-msg');
      if (msgEl2 && msgEl2.textContent.indexOf('Awaiting approval') !== -1) {
        msgEl2.textContent = 'Campaign published. ID: ' + (parsed.campaign_id || '');
        var form2 = document.getElementById('ma-creator-form');
        if (form2) { form2.reset(); }
      }
    }
    return;
  }
  if (parsed.type === 'REWARD_CONFIRMED') {
    if (typeof onRewardConfirmed === 'function') {
      onRewardConfirmed(parsed);
    }
    return;
  }
  if (parsed.type === 'DO_CHANNEL_OPEN' ||
      parsed.type === 'DO_PUBLISHER_CHANNEL_OPEN' ||
      parsed.type === 'DO_REWARD_VOUCHER' ||
      parsed.type === 'DO_PUBLISHER_REWARD_VOUCHER' ||
      parsed.type === 'DO_SEND_VOUCHER' ||
      parsed.type === 'DO_RESEND_CHANNEL_OPEN') {
    // All channel TX building and Maxima resends are now handled by the SW.
    // These signals are no longer emitted. Log if one arrives unexpectedly.
    console.warn('[CHANNEL] Unexpected legacy FE signal (SW should handle this):', parsed.type);
    return;
  }
  if (parsed.type === 'CHANNEL_OPENED') {
    if (typeof onChannelOpened === 'function') { onChannelOpened(parsed); }
    return;
  }
  if (parsed.type === 'VOUCHER_RECEIVED') {
    if (typeof onVoucherReceived === 'function') { onVoucherReceived(parsed); }
    return;
  }
  if (parsed.type === 'AUTO_SETTLE') {
    if (typeof onAutoSettle === 'function') { onAutoSettle(parsed); }
    return;
  }
  if (parsed.type === 'SETTLE_CONFIRMED') {
    if (typeof onSettleConfirmed === 'function') { onSettleConfirmed(parsed); }
    return;
  }
  if (parsed.type === 'FRAME_READY' || parsed.type === 'FRAME_CREATED') {
    if (currentRoute() === 'frames' && typeof renderFrames === 'function') {
      renderFrames(document.getElementById('app'));
    }
    return;
  }
  if (parsed.type === 'PUBLISHER_REWARD_CONFIRMED') {
    if (currentRoute() === 'frames' && typeof onPublisherRewardConfirmed === 'function') {
      onPublisherRewardConfirmed(parsed);
    }
    return;
  }
}

// ---------------------------------------------------------------------------
// Channel helpers (T-CH4)
// ---------------------------------------------------------------------------

// Send a unicast Maxima message. Prefers publickey: routing (same as SW sendMaxima)
// which is more reliable than to: (contact string may lack @host:port).
// Falls back to to:mxAddress when no publicKey provided.
// poll:true so messages survive the recipient being offline (per §6.5/§6.6).
function sendChannelMaxima(mxAddress, payload, cb) {
  var hex = '0x' + utf8ToHex(JSON.stringify(payload)).toUpperCase();
  var cmd = 'maxima action:send to:' + mxAddress
          + ' application:' + APP_NAME
          + ' data:' + hex
          + ' poll:true';
  MDS.cmd(cmd, function(res) {
    if (!res || !res.status) {
      console.error('[CHANNEL] sendChannelMaxima failed to=' + mxAddress.substring(0, 20) + ':', res && res.error);
    }
    if (cb) { cb(res && res.status); }
  });
}

// Address-from-pubkey via newscript "RETURN SIGNEDBY(<pk>)". Deterministic
// across nodes — the address is a hash of the script. Cached in keypair so
// we only pay the newscript cost once per pubkey.
// trackall:true on creator side (we want to receive funds back to the change
// address). trackall:false on viewer-address derivation (creator just needs
// the address string to direct the voucher's first output).
function deriveScriptAddress(pubkey, trackall, cacheKey, cb) {
  MDS.keypair.get(cacheKey, function(kpRes) {
    var cached = kpRes && kpRes.status ? kpRes.value : '';
    if (cached) { cb(cached); return; }
    var script = 'RETURN SIGNEDBY(' + pubkey + ')';
    var cmd = 'newscript script:"' + script + '" trackall:' + (trackall ? 'true' : 'false');
    MDS.cmd(cmd, function(res) {
      if (!res || !res.status || !res.response || !res.response.address) {
        console.error('[CHANNEL] newscript failed for pk', pubkey, res && res.error);
        cb('');
        return;
      }
      var addr = res.response.address;
      MDS.keypair.set(cacheKey, addr, function() {});
      cb(addr);
    });
  });
}

// Persist channel-pending context across reloads. Indexed by pendinguid so the
// MDS_PENDING event can recover ctx after user approval (or browser reload).
function savePendingChannelOp(uid, ctx) {
  _pendingChannelOps[uid] = ctx;
  MDS.keypair.set('PENDING_CHANNEL_' + uid, JSON.stringify(ctx), function() {});
}

function loadPendingChannelOp(uid, cb) {
  if (_pendingChannelOps[uid]) { cb(_pendingChannelOps[uid]); return; }
  MDS.keypair.get('PENDING_CHANNEL_' + uid, function(kpRes) {
    var raw = kpRes && kpRes.status ? kpRes.value : '';
    if (!raw) { cb(null); return; }
    var ctx = null;
    try { ctx = JSON.parse(raw); } catch (e) { cb(null); return; }
    _pendingChannelOps[uid] = ctx;
    cb(ctx);
  });
}

function clearPendingChannelOp(uid) {
  delete _pendingChannelOps[uid];
  MDS.keypair.set('PENDING_CHANNEL_' + uid, '', function() {});
}

// ---------------------------------------------------------------------------
// DO_CHANNEL_OPEN — creator FE builds & posts the channel-open transaction
// ---------------------------------------------------------------------------
//
// SW signalled us with { campaign_id, viewer_key, viewer_mx, max_amount }.
// We must:
//   1. load campaign (escrow_coinid, escrow_wallet_pk, budget_remaining)
//   2. resolve CHANNEL_SCRIPT_ADDRESS + ESCROW_ADDRESS from keypair
//   3. build tx per Appendix B §B.5 — spend escrow, output channel coin + change
//   4. txnpost; if pending, store ctx for MDS_PENDING resume
//   5. on success: activateChannel locally, update CAMPAIGNS.escrow_coinid,
//      send CHANNEL_OPEN Maxima to viewer_mx
//
// Deviations from spec, flagged for maintainer:
//  - Appendix B.5 sets txnstate port:2 = expiry_block, but the channel script
//    (Appendix C.2) reads PREVSTATE(2) as the viewer's wallet key for the
//    MULTISIG. Since both outputs share the tx's state, port:2 must hold the
//    viewer key for the channel coin to be spendable. The escrow script reads
//    only PREVSTATE(1), so the change output is unaffected.
//  - Appendix B.5 sets storestate:false on the channel output, but the channel
//    script needs the state preserved on the channel coin (PREVSTATE(1/2/3)).
//    Both outputs use storestate:true here.
function handleDoChannelOpen(data) {
  var campaignId     = data.campaign_id;
  var viewerKey      = data.viewer_key;
  var viewerMx       = data.viewer_mx;
  var viewerWalletPK = data.viewer_wallet_pk || '';
  var maxAmount      = parseFloat(data.max_amount);

  if (!campaignId || !viewerKey || !viewerMx || !(maxAmount > 0)) {
    console.error('[CHANNEL] DO_CHANNEL_OPEN: invalid payload', data);
    return;
  }

  if (typeof getCampaign !== 'function') {
    console.error('[CHANNEL] DO_CHANNEL_OPEN: getCampaign not loaded');
    return;
  }

  getCampaign(campaignId, function(err, campaign) {
    if (err || !campaign) {
      console.error('[CHANNEL] DO_CHANNEL_OPEN: campaign not found', campaignId, err);
      return;
    }
    var escrowCoinId = campaign.ESCROW_COINID;
    var walletPK     = campaign.ESCROW_WALLET_PK;
    var budgetLeft   = parseFloat(campaign.BUDGET_REMAINING);
    if (!escrowCoinId || !walletPK) {
      console.error('[CHANNEL] DO_CHANNEL_OPEN: campaign missing escrow data', campaign);
      return;
    }
    if (budgetLeft < maxAmount) {
      console.error('[CHANNEL] DO_CHANNEL_OPEN: insufficient budget', budgetLeft, '<', maxAmount);
      return;
    }

    MDS.keypair.get('CHANNEL_SCRIPT_ADDRESS', function(chRes) {
      var channelAddr = chRes && chRes.status ? chRes.value : '';
      MDS.keypair.get('ESCROW_ADDRESS_V2', function(esResV2) {
        var escrowAddrV2 = esResV2 && esResV2.status ? esResV2.value : '';
        MDS.keypair.get('ESCROW_ADDRESS', function(esRes) {
          var escrowAddr = escrowAddrV2 || (esRes && esRes.status ? esRes.value : '');
          if (!channelAddr || !escrowAddr) {
            console.error('[CHANNEL] DO_CHANNEL_OPEN: missing script addresses',
              'channel:', channelAddr, 'escrow:', escrowAddr);
            return;
          }
          buildAndPostChannelTx({
            campaignId:    campaignId,
            viewerKey:     viewerKey,
            viewerMx:      viewerMx,
            viewerWalletPK: viewerWalletPK,
            maxAmount:     maxAmount,
            budgetLeft:    budgetLeft,
            escrowCoinId:  escrowCoinId,
            walletPK:      walletPK,
            channelAddr:   channelAddr,
            escrowAddr:    escrowAddr
          });
        });
      });
    });
  });
}

function buildAndPostChannelTx(ctx) {
  var txId    = 'sp_' + generateUID();
  var campaignIdHex = '0x' + utf8ToHex(ctx.campaignId).toUpperCase();

  function fail(stage, res) {
    console.error('[CHANNEL] channel-split tx failed at', stage, res && (res.error || res));
    MDS.cmd('txndelete id:' + txId, function() {});
  }

  MDS.cmd('txncreate id:' + txId, function(r1) {
    if (!r1.status) { fail('txncreate', r1); return; }

    MDS.cmd('txninput id:' + txId + ' coinid:' + ctx.escrowCoinId + ' scriptmmr:true', function(r2) {
      if (!r2.status) { fail('txninput', r2); return; }

      var actualAmount = parseFloat(r2.response.transaction.inputs[0].amount);
      var change = parseFloat((actualAmount - ctx.maxAmount).toFixed(6));
      console.log('[CHANNEL] escrow split actualAmount:', actualAmount, 'maxAmount:', ctx.maxAmount, 'change:', change);

      // output[0] — split coin (max_amount → ESCROW_ADDRESS)
      MDS.cmd('txnoutput id:' + txId
            + ' storestate:true'
            + ' amount:' + ctx.maxAmount
            + ' address:' + ctx.escrowAddr, function(r3) {
        if (!r3.status) { fail('txnoutput[split]', r3); return; }

        function afterChange(r4) {
          if (r4 && !r4.status) { fail('txnoutput[change]', r4); return; }

          // STATE for Split Tx: NO VIEWER KEY.
          // port:4 = creator Mx contact preserved so the change coin remains
          // discoverable by other nodes via processEscrowCoin (STATE 3+4 required).
          // port:5/6 intentionally omitted — ESCROW_SCRIPT_V2 only reads PREVSTATE(5)
          // inside the feeflag=1 branch, which is never taken on split/open spends.
          var creatorMxHex = '0x' + utf8ToHex(MY_MX_ADDRESS).toUpperCase();
          var stateCmds = [
            'txnstate id:' + txId + ' port:1 value:' + ctx.walletPK,
            'txnstate id:' + txId + ' port:3 value:' + campaignIdHex,
            'txnstate id:' + txId + ' port:4 value:' + creatorMxHex,
            'txnstate id:' + txId + ' port:10 value:' + ctx.maxAmount,
            'txnstate id:' + txId + ' port:11 value:0'
          ];
          runSequential(stateCmds, 0, function(stateOk) {
            if (!stateOk) { fail('txnstate', null); return; }

            MDS.cmd('txnsign id:' + txId + ' publickey:' + ctx.walletPK, function(r5) {
              if (r5 && r5.pending) {
                var splitCtx = {
                  kind:          'channel_split_sign',
                  txId:          txId,
                  campaignId:    ctx.campaignId,
                  viewerKey:     ctx.viewerKey,
                  viewerMx:      ctx.viewerMx,
                  viewerWalletPK: ctx.viewerWalletPK || '',
                  maxAmount:     ctx.maxAmount,
                  escrowCoinId:  ctx.escrowCoinId,
                  channelAddr:   ctx.channelAddr,
                  escrowAddr:    ctx.escrowAddr,
                  walletPK:      ctx.walletPK,
                  role:          ctx.role || 'viewer',
                  frameId:       ctx.frameId || ''
                };
                savePendingChannelOp(r5.pendinguid, splitCtx);
                console.log('[CHANNEL] split txnsign pending, uid:', r5.pendinguid);
                return;
              }
              if (!r5.status) { fail('txnsign', r5); return; }

              MDS.cmd('txnpost id:' + txId + ' mine:true', function(r6) {
                if (r6 && r6.pending) {
                  var splitPostCtx = {
                    kind:          'channel_split_post',
                    txId:          txId,
                    campaignId:    ctx.campaignId,
                    viewerKey:     ctx.viewerKey,
                    viewerMx:      ctx.viewerMx,
                    viewerWalletPK: ctx.viewerWalletPK || '',
                    maxAmount:     ctx.maxAmount,
                    escrowCoinId:  ctx.escrowCoinId,
                    channelAddr:   ctx.channelAddr,
                    escrowAddr:    ctx.escrowAddr,
                    walletPK:      ctx.walletPK,
                    role:          ctx.role || 'viewer',
                    frameId:       ctx.frameId || ''
                  };
                  savePendingChannelOp(r6.pendinguid, splitPostCtx);
                  console.log('[CHANNEL] split txnpost pending, uid:', r6.pendinguid);
                  return;
                }
                if (!r6.status) { fail('txnpost', r6); return; }

                MDS.cmd('txndelete id:' + txId, function() {});
                finalizeChannelSplit(r6.response, ctx);
              });
            });
          });
        }

        if (change > 0) {
          MDS.cmd('txnoutput id:' + txId
                + ' storestate:true'
                + ' amount:' + change
                + ' address:' + ctx.escrowAddr, afterChange);
        } else {
          afterChange(null);
        }
      });
    });
  });
}

function finalizeChannelSplit(txpowResponse, ctx) {
  var outputs = null;
  try { outputs = txpowResponse.body.txn.outputs; } catch (e) {}
  if (!outputs || !outputs.length) {
    console.error('[CHANNEL] no outputs in split tx response');
    return;
  }
  var splitCoinId = outputs[0].coinid;
  var changeCoinId = outputs.length > 1 ? outputs[1].coinid : '';
  
  console.log('[CHANNEL] Split Tx posted. splitCoinId:', splitCoinId, 'changeCoinId:', changeCoinId);
  
  if (changeCoinId) {
    var sql = "UPDATE CAMPAIGNS SET ESCROW_COINID = '" + escapeSql(changeCoinId) + "' "
            + "WHERE UPPER(ID) = UPPER('" + escapeSql(ctx.campaignId) + "')";
    sqlQuery(sql, function(err) {
      if (err) { console.error('[CHANNEL] CAMPAIGNS escrow update failed:', err); }
    });
  } else {
    var sqlClear = "UPDATE CAMPAIGNS SET ESCROW_COINID = '' "
                 + "WHERE UPPER(ID) = UPPER('" + escapeSql(ctx.campaignId) + "')";
    sqlQuery(sqlClear, function() {});
  }

  ctx.splitCoinId = splitCoinId;
  buildAndPostChannelOpenTx(ctx);
}

function buildAndPostChannelOpenTx(ctx) {
  var txId    = 'ch_' + generateUID();
  var campaignIdHex = '0x' + utf8ToHex(ctx.campaignId).toUpperCase();
  var viewerMxHex   = '0x' + utf8ToHex(ctx.viewerMx).toUpperCase();

  function fail(stage, res) {
    console.error('[CHANNEL] channel-open tx failed at', stage, res && (res.error || res));
    MDS.cmd('txndelete id:' + txId, function() {});
  }

  function waitForCoin(coinId, maxRetries, delay, cb) {
    var attempts = 0;
    function check() {
      attempts++;
      MDS.cmd('coins coinid:' + coinId, function(res) {
        var found = false;
        if (res.status && res.response && res.response.length > 0) {
          found = true;
        }
        if (found) {
          cb(true);
        } else if (attempts < maxRetries) {
          setTimeout(check, delay);
        } else {
          cb(false);
        }
      });
    }
    check();
  }

  // Poll for the split tx coin (up to 10 attempts, every 2s) to ensure it's in the mempool
  waitForCoin(ctx.splitCoinId, 10, 2000, function(found) {
    if (!found) {
      fail('waitForCoin', 'Split coin ' + ctx.splitCoinId + ' not found after retries');
      return;
    }
    MDS.cmd('txncreate id:' + txId, function(r1) {
      if (!r1.status) { fail('txncreate', r1); return; }

      MDS.cmd('txninput id:' + txId + ' coinid:' + ctx.splitCoinId + ' scriptmmr:true', function(r2) {
        if (!r2.status) { fail('txninput', r2); return; }

        MDS.cmd('txnoutput id:' + txId
              + ' storestate:true'
              + ' amount:' + ctx.maxAmount
              + ' address:' + ctx.channelAddr, function(r3) {
          if (!r3.status) { fail('txnoutput[channel]', r3); return; }

          // STATE for Channel Tx: INCLUDES VIEWER KEY.
          // T-PUB4: port:11 = 0 — fee branch skipped (platform fee was paid at launch).
          var port2Key = ctx.viewerWalletPK || ctx.viewerKey;
          var stateCmds = [
            'txnstate id:' + txId + ' port:1 value:' + ctx.walletPK,
            'txnstate id:' + txId + ' port:2 value:' + port2Key,
            'txnstate id:' + txId + ' port:3 value:' + campaignIdHex,
            'txnstate id:' + txId + ' port:4 value:' + viewerMxHex,
            'txnstate id:' + txId + ' port:10 value:' + ctx.maxAmount,
            'txnstate id:' + txId + ' port:11 value:0'
          ];
          runSequential(stateCmds, 0, function(stateOk) {
            if (!stateOk) { fail('txnstate', null); return; }

            MDS.cmd('txnsign id:' + txId + ' publickey:' + ctx.walletPK, function(r5) {
              if (r5 && r5.pending) {
                var signCtx = {
                  kind:          'channel_open_postsign',
                  txId:          txId,
                  campaignId:    ctx.campaignId,
                  viewerKey:     ctx.viewerKey,
                  viewerMx:      ctx.viewerMx,
                  viewerWalletPK: ctx.viewerWalletPK || '',
                  maxAmount:     ctx.maxAmount,
                  channelAddr:   ctx.channelAddr,
                  walletPK:      ctx.walletPK,
                  role:          ctx.role || 'viewer',
                  frameId:       ctx.frameId || ''
                };
                savePendingChannelOp(r5.pendinguid, signCtx);
                console.log('[CHANNEL] txnsign pending, uid:', r5.pendinguid);
                return;
              }
              if (!r5.status) { fail('txnsign', r5); return; }

              MDS.cmd('txnpost id:' + txId + ' mine:true', function(r6) {
                if (r6 && r6.pending) {
                  var pendCtx = {
                    kind:          'channel_open',
                    txId:          txId,
                    campaignId:    ctx.campaignId,
                    viewerKey:     ctx.viewerKey,
                    viewerMx:      ctx.viewerMx,
                    viewerWalletPK: ctx.viewerWalletPK || '',
                    maxAmount:     ctx.maxAmount,
                    channelAddr:   ctx.channelAddr,
                    walletPK:      ctx.walletPK,
                    role:          ctx.role || 'viewer',
                    frameId:       ctx.frameId || ''
                  };
                  savePendingChannelOp(r6.pendinguid, pendCtx);
                  console.log('[CHANNEL] channel-open pending, uid:', r6.pendinguid);
                  return;
                }

                if (!r6.status) { fail('txnpost', r6); return; }
                MDS.cmd('txndelete id:' + txId, function() {});
                finalizeChannelOpen(r6.response, ctx);
              });
            });
          });
        });
      });
    });
  });
}

function runSequential(cmds, idx, cb) {
  if (idx >= cmds.length) { cb(true); return; }
  MDS.cmd(cmds[idx], function(res) {
    if (!res.status) { console.error('[CHANNEL] cmd failed:', cmds[idx], res.error); cb(false); return; }
    runSequential(cmds, idx + 1, cb);
  });
}

function finalizeChannelOpen(txpowResponse, ctx) {
  var outputs = null;
  try { outputs = txpowResponse.body.txn.outputs; } catch (e) {}
  if (!outputs || !outputs.length) {
    console.error('[CHANNEL] finalizeChannelOpen: no outputs in tx response');
    return;
  }
  var channelCoinId = outputs[0].coinid;
  var channelAmount = outputs[0].amount;
  var role = ctx.role || 'viewer';

  console.log('[CHANNEL] channel coin (' + role + '):', channelCoinId, 'amount:', channelAmount);

  if (role === 'publisher') {
    if (typeof activateChannel === 'function') {
      activateChannel(ctx.campaignId, ctx.viewerKey, 'publisher', channelCoinId, function(activErr) {
        if (activErr) { console.error('[CHANNEL] activateChannel (publisher) failed:', activErr); }
      });
    }
    sendChannelMaxima(ctx.viewerMx, {
      type:           'CHANNEL_OPEN',
      campaign_id:    ctx.campaignId,
      viewer_key:     ctx.viewerKey,
      channel_coinid: channelCoinId,
      max_amount:     ctx.maxAmount,
      role:           'publisher',
      frame_id:       ctx.frameId
    }, function(ok) {
      console.log('[CHANNEL] CHANNEL_OPEN (publisher) sent to', ctx.viewerMx, 'ok:', ok);
    });
    return;
  }

  if (typeof activateChannel === 'function') {
    activateChannel(ctx.campaignId, ctx.viewerKey, 'viewer', channelCoinId, function(err) {
      if (err) { console.error('[CHANNEL] activateChannel failed:', err); }
    });
  }

  sendChannelMaxima(ctx.viewerMx, {
    type:           'CHANNEL_OPEN',
    campaign_id:    ctx.campaignId,
    viewer_key:     ctx.viewerKey,
    channel_coinid: channelCoinId,
    max_amount:     ctx.maxAmount
  }, function(ok) {
    console.log('[CHANNEL] CHANNEL_OPEN sent to', ctx.viewerMx, 'ok:', ok);
  });
}

// ---------------------------------------------------------------------------
// DO_PUBLISHER_CHANNEL_OPEN — creator FE builds & posts a publisher channel tx
// ---------------------------------------------------------------------------
//
// SW signalled us with { campaign_id, publisher_key, publisher_mx, frame_id, max_amount }.
// On-chain tx structure mirrors the viewer channel-open exactly:
//   1. Tx1 splits the escrow (port:11=0, no viewer/publisher key in state).
//   2. Tx2 spends the split coin → channel coin at CHANNEL_SCRIPT_ADDRESS,
//      with PREVSTATE(2) = publisher_key so MULTISIG(creator, publisher) holds.
// Differences from viewer flow:
//   - Budget check is against MAX_PUBLISHER_BUDGET - PUBLISHER_BUDGET_SPENT
//   - CHANNEL_STATE row has ROLE='publisher' and FRAME_ID
//   - PUBLISHER_BUDGET_SPENT (not BUDGET_REMAINING) is incremented
//   - CHANNEL_OPEN reply carries role='publisher' and frame_id
function handleDoPublisherChannelOpen(data) {
  var campaignId       = data.campaign_id;
  var publisherKey     = data.publisher_key;
  var publisherMx      = data.publisher_mx;
  var publisherWalletPK = data.publisher_wallet_pk || '';
  var frameId          = data.frame_id;
  var maxAmount        = parseFloat(data.max_amount);

  if (!campaignId || !publisherKey || !publisherMx || !frameId || !(maxAmount > 0)) {
    console.error('[CHANNEL] DO_PUBLISHER_CHANNEL_OPEN: invalid payload', data);
    return;
  }

  if (typeof getCampaign !== 'function') {
    console.error('[CHANNEL] DO_PUBLISHER_CHANNEL_OPEN: getCampaign not loaded');
    return;
  }

  getCampaign(campaignId, function(err, campaign) {
    if (err || !campaign) {
      console.error('[CHANNEL] DO_PUBLISHER_CHANNEL_OPEN: campaign not found', campaignId, err);
      return;
    }
    var escrowCoinId = campaign.ESCROW_COINID;
    var walletPK     = campaign.ESCROW_WALLET_PK;

    if (!escrowCoinId || !walletPK) {
      console.error('[CHANNEL] DO_PUBLISHER_CHANNEL_OPEN: campaign missing escrow data', campaign);
      return;
    }

    MDS.keypair.get('CHANNEL_SCRIPT_ADDRESS', function(chRes) {
      var channelAddr = chRes && chRes.status ? chRes.value : '';
      MDS.keypair.get('ESCROW_ADDRESS_V2', function(esRes) {
        var escrowAddr = esRes && esRes.status ? esRes.value : '';
        if (!escrowAddr) {
          // Fallback for legacy V1 escrows.
          MDS.keypair.get('ESCROW_ADDRESS', function(esResV1) {
            var addrV1 = esResV1 && esResV1.status ? esResV1.value : '';
            if (!channelAddr || !addrV1) {
              console.error('[CHANNEL] DO_PUBLISHER_CHANNEL_OPEN: missing script addresses',
                'channel:', channelAddr, 'escrow:', addrV1);
              return;
            }
            startPublisherChannelTxs(campaignId, publisherKey, publisherMx, frameId,
              maxAmount, escrowCoinId, walletPK, channelAddr, addrV1, publisherWalletPK);
          });
          return;
        }
        if (!channelAddr) {
          console.error('[CHANNEL] DO_PUBLISHER_CHANNEL_OPEN: missing CHANNEL_SCRIPT_ADDRESS');
          return;
        }
        startPublisherChannelTxs(campaignId, publisherKey, publisherMx, frameId,
          maxAmount, escrowCoinId, walletPK, channelAddr, escrowAddr, publisherWalletPK);
      });
    });
  });
}

function startPublisherChannelTxs(campaignId, publisherKey, publisherMx, frameId,
                                  maxAmount, escrowCoinId, walletPK, channelAddr, escrowAddr,
                                  publisherWalletPK) {
  // Reuse the viewer split+open tx builders by passing the publisher key in
  // the viewerKey slot — at the on-chain layer the script does not distinguish
  // viewer from publisher; both produce a MULTISIG channel coin.
  // Persistence and the CHANNEL_OPEN reply branch on ctx.role.
  buildAndPostChannelTx({
    campaignId:    campaignId,
    viewerKey:     publisherKey,
    viewerMx:      publisherMx,
    viewerWalletPK: publisherWalletPK || '',
    maxAmount:     maxAmount,
    budgetLeft:    maxAmount,
    escrowCoinId: escrowCoinId,
    walletPK:     walletPK,
    channelAddr:  channelAddr,
    escrowAddr:   escrowAddr,
    role:         'publisher',
    frameId:      frameId
  });
}

// ---------------------------------------------------------------------------
// DO_REWARD_VOUCHER — creator builds the partial tx and ships it to viewer
// ---------------------------------------------------------------------------
//
// SW signalled us with { campaign_id, viewer_key, viewer_mx, event_id, cumulative }.
// Per Appendix C §C.4: creator-signed partial tx with two outputs (viewer pays
// `cumulative`, creator change pays `MAX_AMOUNT - cumulative`). txnexport
// produces a hex blob that the viewer co-signs at settlement time.
function handleDoRewardVoucher(data) {
  var campaignId = data.campaign_id;
  var viewerKey  = data.viewer_key;
  var viewerMx   = data.viewer_mx;
  var eventId    = data.event_id;
  var cumulative = parseFloat(data.cumulative);

  if (!campaignId || !viewerKey || !viewerMx || !eventId || isNaN(cumulative)) {
    console.error('[CHANNEL] DO_REWARD_VOUCHER: invalid payload', data);
    return;
  }

  if (typeof getChannelState !== 'function') {
    console.error('[CHANNEL] DO_REWARD_VOUCHER: getChannelState not loaded');
    return;
  }

  getChannelState(campaignId, viewerKey, 'viewer', function(err, channel) {
    if (err || !channel) {
      console.error('[CHANNEL] DO_REWARD_VOUCHER: channel not found', err);
      return;
    }
    if (channel.STATUS !== 'open') {
      console.error('[CHANNEL] DO_REWARD_VOUCHER: channel not open, status:', channel.STATUS);
      return;
    }
    var channelCoinId = channel.CHANNEL_COINID;
    var maxAmount     = parseFloat(channel.MAX_AMOUNT);
    if (!channelCoinId || !(maxAmount > 0) || cumulative > maxAmount) {
      console.error('[CHANNEL] DO_REWARD_VOUCHER: bad channel state',
        channelCoinId, maxAmount, cumulative);
      return;
    }

    getCampaign(campaignId, function(err2, campaign) {
      if (err2 || !campaign || !campaign.ESCROW_WALLET_PK) {
        console.error('[CHANNEL] DO_REWARD_VOUCHER: campaign wallet pk missing', err2);
        return;
      }
      var creatorWalletPK = campaign.ESCROW_WALLET_PK;

      var viewerAddr = channel.VIEWER_WALLET_ADDR;
      if (!viewerAddr) {
        console.error('[CHANNEL] DO_REWARD_VOUCHER: VIEWER_WALLET_ADDR missing for campaign:', campaignId);
        return;
      }
      MDS.cmd('getaddress', function(addrRes) {
        var creatorAddr = (addrRes && addrRes.status && addrRes.response && addrRes.response.address)
          ? addrRes.response.address : '';
        if (!creatorAddr) {
          console.error('[CHANNEL] DO_REWARD_VOUCHER: creator getaddress failed');
          return;
        }
        buildAndExportVoucherTx({
          campaignId:      campaignId,
          viewerKey:       viewerKey,
          viewerMx:        viewerMx,
          eventId:         eventId,
          cumulative:      cumulative,
          maxAmount:       maxAmount,
          channelCoinId:   channelCoinId,
          creatorWalletPK: creatorWalletPK,
          viewerAddr:      viewerAddr,
          creatorAddr:     creatorAddr
        });
      });
    });
  });
}

function buildAndExportVoucherTx(ctx) {
  var txId    = 'rv_' + generateUID();
  var refund  = parseFloat((ctx.maxAmount - ctx.cumulative).toFixed(6));
  var role    = ctx.role || 'viewer';
  var frameId = ctx.frameId || '';
  console.log('[CHANNEL] voucher tx: channel:', ctx.channelCoinId,
    '| viewer→', ctx.cumulative, ctx.viewerAddr,
    '| creator←', refund, ctx.creatorAddr);

  function fail(stage, res) {
    console.error('[CHANNEL] voucher tx failed at', stage, res && (res.error || res));
    MDS.cmd('txndelete id:' + txId, function() {});
  }

  MDS.cmd('txncreate id:' + txId, function(r1) {
    if (!r1.status) { fail('txncreate', r1); return; }
    MDS.cmd('txninput id:' + txId + ' coinid:' + ctx.channelCoinId + ' scriptmmr:true', function(r2) {
      if (!r2.status) {
        // SW (T-CH8) guarantees this coin is indexed before emitting DO_REWARD_VOUCHER.
        // A failure here is a genuine error — no retry.
        console.error('[CHANNEL] txninput failed (coin should be indexed by now):',
          r2 && r2.error, 'campaign:', ctx.campaignId);
        fail('txninput', r2);
        return;
      }

      MDS.cmd('txnoutput id:' + txId
            + ' storestate:false'
            + ' amount:' + ctx.cumulative
            + ' address:' + ctx.viewerAddr, function(r3) {
        if (!r3.status) { fail('txnoutput[viewer]', r3); return; }

        function afterRefund(r4) {
          if (r4 && !r4.status) { fail('txnoutput[creator]', r4); return; }

          MDS.cmd('txnsign id:' + txId + ' publickey:' + ctx.creatorWalletPK, function(r5) {
            if (r5 && r5.pending) {
              var voucherCtx = {
                kind:            'voucher_sign',
                txId:            txId,
                campaignId:      ctx.campaignId,
                viewerKey:       ctx.viewerKey,
                viewerMx:        ctx.viewerMx,
                cumulative:      ctx.cumulative,
                eventId:         ctx.eventId,
                creatorWalletPK: ctx.creatorWalletPK,
                role:            role,
                frameId:         frameId
              };
              savePendingChannelOp(r5.pendinguid, voucherCtx);
              console.log('[CHANNEL] voucher txnsign pending, uid:', r5.pendinguid);
              return;
            }
            if (!r5.status) { fail('txnsign', r5); return; }

            MDS.cmd('txnexport id:' + txId, function(r6) {
              if (!r6.status || !r6.response) { fail('txnexport', r6); return; }
              var txHex = r6.response.data || r6.response.transaction || r6.response;
              if (typeof txHex !== 'string') {
                console.error('[CHANNEL] txnexport unexpected shape:', JSON.stringify(r6));
                MDS.cmd('txndelete id:' + txId, function() {});
                return;
              }

              MDS.cmd('txndelete id:' + txId, function() {});

              if (typeof updateChannelVoucher === 'function') {
                updateChannelVoucher(ctx.campaignId, ctx.viewerKey, role, ctx.cumulative, txHex, function(err) {
                  if (err) { console.error('[CHANNEL] updateChannelVoucher failed:', err); }
                });
              }

              var voucherMsg = {
                type:        'REWARD_VOUCHER',
                campaign_id: ctx.campaignId,
                viewer_key:  ctx.viewerKey,
                event_id:    ctx.eventId,
                cumulative:  ctx.cumulative,
                tx_hex:      txHex
              };
              if (role === 'publisher') {
                voucherMsg.role     = 'publisher';
                voucherMsg.frame_id = frameId;
              }
              sendChannelMaxima(ctx.viewerMx, voucherMsg, function(ok) {
                console.log('[CHANNEL] REWARD_VOUCHER sent to', ctx.viewerMx,
                  'cumulative:', ctx.cumulative, 'ok:', ok);
              });
            });
          });
        }

        if (refund > 0) {
          MDS.cmd('txnoutput id:' + txId
                + ' storestate:false'
                + ' amount:' + refund
                + ' address:' + ctx.creatorAddr, afterRefund);
        } else {
          afterRefund(null);
        }
      });
    });
  });
}

// ---------------------------------------------------------------------------
// DO_PUBLISHER_REWARD_VOUCHER — creator builds publisher voucher tx
// ---------------------------------------------------------------------------
//
// Mirrors handleDoRewardVoucher but:
//   - Uses role='publisher' for getChannelState + updateChannelVoucher
//   - Settlement output[0] address: FRAMES.PUBLISHER_WALLET (not VIEWER_WALLET_ADDR)
//   - REWARD_VOUCHER includes role:'publisher' and frame_id
function handleDoPublisherRewardVoucher(data) {
  var campaignId   = data.campaign_id;
  var publisherKey = data.viewer_key;
  var publisherMx  = data.viewer_mx;
  var eventId      = data.event_id;
  var cumulative   = parseFloat(data.cumulative);
  var frameId      = data.frame_id || '';

  if (!campaignId || !publisherKey || !publisherMx || !eventId || isNaN(cumulative) || !frameId) {
    console.error('[CHANNEL] DO_PUBLISHER_REWARD_VOUCHER: invalid payload', data);
    return;
  }

  if (typeof getChannelState !== 'function') {
    console.error('[CHANNEL] DO_PUBLISHER_REWARD_VOUCHER: getChannelState not loaded');
    return;
  }

  getChannelState(campaignId, publisherKey, 'publisher', function(err, channel) {
    if (err || !channel) {
      console.error('[CHANNEL] DO_PUBLISHER_REWARD_VOUCHER: channel not found', err);
      return;
    }
    if (channel.STATUS !== 'open') {
      console.error('[CHANNEL] DO_PUBLISHER_REWARD_VOUCHER: channel not open, status:', channel.STATUS);
      return;
    }
    var channelCoinId = channel.CHANNEL_COINID;
    var maxAmount     = parseFloat(channel.MAX_AMOUNT);
    if (!channelCoinId || !(maxAmount > 0) || cumulative > maxAmount) {
      console.error('[CHANNEL] DO_PUBLISHER_REWARD_VOUCHER: bad channel state',
        channelCoinId, maxAmount, cumulative);
      return;
    }

    getCampaign(campaignId, function(err2, campaign) {
      if (err2 || !campaign || !campaign.ESCROW_WALLET_PK) {
        console.error('[CHANNEL] DO_PUBLISHER_REWARD_VOUCHER: campaign wallet pk missing', err2);
        return;
      }
      var creatorWalletPK = campaign.ESCROW_WALLET_PK;

      var fid = frameId || channel.FRAME_ID || '';
      var publisherAddr = channel.VIEWER_WALLET_ADDR || '';

      function doBuildPublisherVoucher() {
        if (!publisherAddr) {
          console.error('[CHANNEL] DO_PUBLISHER_REWARD_VOUCHER: publisher wallet address missing. campaign:', campaignId);
          return;
        }
        MDS.cmd('getaddress', function(addrRes) {
          var creatorAddr = (addrRes && addrRes.status && addrRes.response && addrRes.response.address)
            ? addrRes.response.address : '';
          if (!creatorAddr) {
            console.error('[CHANNEL] DO_PUBLISHER_REWARD_VOUCHER: creator getaddress failed');
            return;
          }
          buildAndExportVoucherTx({
            campaignId:      campaignId,
            viewerKey:       publisherKey,
            viewerMx:        publisherMx,
            eventId:         eventId,
            cumulative:      cumulative,
            maxAmount:       maxAmount,
            channelCoinId:   channelCoinId,
            creatorWalletPK: creatorWalletPK,
            viewerAddr:      publisherAddr,
            creatorAddr:     creatorAddr,
            role:            'publisher',
            frameId:         fid || ''
          });
        });
      }

      if (publisherAddr) {
        doBuildPublisherVoucher();
      } else if (fid && typeof getFrame === 'function') {
        getFrame(fid, function(err3, frame) {
          publisherAddr = (!err3 && frame) ? (frame.PUBLISHER_WALLET || '') : '';
          doBuildPublisherVoucher();
        });
      } else {
        console.error('[CHANNEL] DO_PUBLISHER_REWARD_VOUCHER: no publisher addr and no frame. campaign:', campaignId);
      }
    });
  });
}

// ---------------------------------------------------------------------------
// DO_SEND_VOUCHER — re-emit the most recent REWARD_VOUCHER (sync recovery)
// ---------------------------------------------------------------------------
function handleDoSendVoucher(data) {
  if (!data.campaign_id || !data.viewer_key || !data.viewer_mx || !data.tx_hex) {
    console.error('[CHANNEL] DO_SEND_VOUCHER: invalid payload', data);
    return;
  }
  sendChannelMaxima(data.viewer_mx, {
    type:        'REWARD_VOUCHER',
    campaign_id: data.campaign_id,
    viewer_key:  data.viewer_key,
    event_id:    'sync_' + Date.now(),
    cumulative:  parseFloat(data.cumulative),
    tx_hex:      data.tx_hex
  }, function(ok) {
    console.log('[CHANNEL] DO_SEND_VOUCHER resend ok:', ok);
  });
}

// ---------------------------------------------------------------------------
// DO_RESEND_CHANNEL_OPEN — re-emit CHANNEL_OPEN when no voucher exists yet
// ---------------------------------------------------------------------------
function handleDoResendChannelOpen(data) {
  if (!data.campaign_id || !data.viewer_key || !data.viewer_mx || !data.channel_coinid) {
    console.error('[CHANNEL] DO_RESEND_CHANNEL_OPEN: invalid payload', data);
    return;
  }
  sendChannelMaxima(data.viewer_mx, {
    type:           'CHANNEL_OPEN',
    campaign_id:    data.campaign_id,
    viewer_key:     data.viewer_key,
    channel_coinid: data.channel_coinid,
    max_amount:     parseFloat(data.max_amount)
  }, function(ok) {
    console.log('[CHANNEL] DO_RESEND_CHANNEL_OPEN resend ok:', ok);
  });
}

// ---------------------------------------------------------------------------
// MDS_PENDING (FE) — resume channel-open after user approval
// ---------------------------------------------------------------------------
function handleFePending(msg) {
  if (!msg || !msg.data || !msg.data.uid) { return; }
  var uid      = msg.data.uid;
  var accepted = msg.data.accept;
  var status   = msg.data.status;

  loadPendingChannelOp(uid, function(ctx) {
    if (!ctx) {
      // Not one of ours — likely a campaign-creation pending handled by SW.
      return;
    }
    if (!accepted || !status) {
      console.log('[CHANNEL] pending denied/failed, uid:', uid, 'kind:', ctx.kind);
      if (ctx.kind === 'settlement') {
        MDS.cmd('txndelete id:' + ctx.settleId, function() {});
      } else if (ctx.txId) {
        MDS.cmd('txndelete id:' + ctx.txId, function() {});
      }
      clearPendingChannelOp(uid);
      return;
    }
    if (ctx.kind === 'settlement') {
      console.log('[CHANNEL] settlement txnsign approved, posting campaign:', ctx.campaignId, 'role:', ctx.role);
      if (typeof _postSettleTx === 'function') {
        _postSettleTx(ctx.settleId, ctx.campaignId, ctx.viewerKey, ctx.role || 'viewer');
      }
      clearPendingChannelOp(uid);
      return;
    }
    if (ctx.kind === 'settlement_post') {
      console.log('[CHANNEL] settlement_post approved. campaign:', ctx.campaignId, 'role:', ctx.role);
      if (typeof settleChannel === 'function') {
        settleChannel(ctx.campaignId, ctx.viewerKey, ctx.role || 'viewer', function(err) {
          if (err) { console.error('[CHANNEL] settleChannel error after settlement_post approval:', err); }
          if (typeof _refreshChannelRewards === 'function') { _refreshChannelRewards(); }
        });
      }
      clearPendingChannelOp(uid);
      return;
    }
    var resp = null;
    try { resp = msg.data.result.response; } catch (e) {}
    if (!resp) {
      console.error('[CHANNEL] pending: no result.response, uid:', uid);
      clearPendingChannelOp(uid);
      return;
    }
    if (ctx.kind === 'channel_split_sign') {
      MDS.cmd('txnpost id:' + ctx.txId + ' mine:true', function(r6) {
        if (r6 && r6.pending) {
          var postCtx = {
            kind:          'channel_split_post',
            txId:          ctx.txId,
            campaignId:    ctx.campaignId,
            viewerKey:     ctx.viewerKey,
            viewerMx:      ctx.viewerMx,
            viewerWalletPK: ctx.viewerWalletPK || '',
            maxAmount:     ctx.maxAmount,
            escrowCoinId:  ctx.escrowCoinId,
            channelAddr:   ctx.channelAddr,
            escrowAddr:    ctx.escrowAddr,
            walletPK:      ctx.walletPK,
            role:          ctx.role || 'viewer',
            frameId:       ctx.frameId || ''
          };
          savePendingChannelOp(r6.pendinguid, postCtx);
          clearPendingChannelOp(uid);
          return;
        }
        if (!r6.status) {
          MDS.cmd('txndelete id:' + ctx.txId, function() {});
          clearPendingChannelOp(uid);
          return;
        }
        MDS.cmd('txndelete id:' + ctx.txId, function() {});
        finalizeChannelSplit(r6.response, ctx);
        clearPendingChannelOp(uid);
      });
      return;
    }
    if (ctx.kind === 'channel_split_post') {
      finalizeChannelSplit(resp, ctx);
      clearPendingChannelOp(uid);
      return;
    }
    if (ctx.kind === 'channel_open_postsign') {
      MDS.cmd('txnpost id:' + ctx.txId + ' mine:true', function(r6) {
        if (r6 && r6.pending) {
          var postCtx = {
            kind:          'channel_open',
            txId:          ctx.txId,
            campaignId:    ctx.campaignId,
            viewerKey:     ctx.viewerKey,
            viewerMx:      ctx.viewerMx,
            viewerWalletPK: ctx.viewerWalletPK || '',
            maxAmount:     ctx.maxAmount,
            channelAddr:   ctx.channelAddr,
            walletPK:      ctx.walletPK,
            role:          ctx.role || 'viewer',
            frameId:       ctx.frameId || ''
          };
          savePendingChannelOp(r6.pendinguid, postCtx);
          console.log('[CHANNEL] txnpost pending after sign, uid:', r6.pendinguid);
          clearPendingChannelOp(uid);
          return;
        }
        if (!r6.status) {
          console.error('[CHANNEL] txnpost failed after sign approval:', r6 && r6.error);
          MDS.cmd('txndelete id:' + ctx.txId, function() {});
          clearPendingChannelOp(uid);
          return;
        }
        MDS.cmd('txndelete id:' + ctx.txId, function() {});
        finalizeChannelOpen(r6.response, ctx);
        clearPendingChannelOp(uid);
      });
      return;
    }
    if (ctx.kind === 'channel_open') {
      finalizeChannelOpen(resp, ctx);
      clearPendingChannelOp(uid);
      return;
    }
    if (ctx.kind === 'voucher_sign') {
      MDS.cmd('txnexport id:' + ctx.txId, function(r6) {
        MDS.cmd('txndelete id:' + ctx.txId, function() {});
        if (!r6.status || !r6.response) {
          console.error('[CHANNEL] voucher txnexport failed after sign:', r6 && r6.error);
          clearPendingChannelOp(uid);
          return;
        }
        var txHex = r6.response.data || r6.response.transaction || r6.response;
        if (typeof txHex !== 'string') {
          console.error('[CHANNEL] voucher txnexport unexpected shape:', JSON.stringify(r6));
          clearPendingChannelOp(uid);
          return;
        }
        var pendRole    = ctx.role || 'viewer';
        var pendFrameId = ctx.frameId || '';
        if (typeof updateChannelVoucher === 'function') {
          updateChannelVoucher(ctx.campaignId, ctx.viewerKey, pendRole, ctx.cumulative, txHex, function(err) {
            if (err) { console.error('[CHANNEL] updateChannelVoucher failed:', err); }
          });
        }
        var pendMsg = {
          type:        'REWARD_VOUCHER',
          campaign_id: ctx.campaignId,
          viewer_key:  ctx.viewerKey,
          event_id:    ctx.eventId,
          cumulative:  ctx.cumulative,
          tx_hex:      txHex
        };
        if (pendRole === 'publisher') {
          pendMsg.role     = 'publisher';
          pendMsg.frame_id = pendFrameId;
        }
        sendChannelMaxima(ctx.viewerMx, pendMsg, function(ok) {
          console.log('[CHANNEL] REWARD_VOUCHER sent (pending resume) to', ctx.viewerMx,
            'cumulative:', ctx.cumulative, 'ok:', ok);
        });
        clearPendingChannelOp(uid);
      });
      return;
    }
    clearPendingChannelOp(uid);
  });
}

function probeDb() {
  sqlQuery('SELECT 1 AS PROBE FROM CAMPAIGNS LIMIT 1', function(err) {
    if (!err) {
      _dbReady = true;
      doRender();
    }
  });
}

function initFEFrames(cb) {
  var sql = "CREATE TABLE IF NOT EXISTS FRAMES ("
    + "FRAME_ID         VARCHAR(512)  PRIMARY KEY,"
    + "PUBLISHER_KEY    VARCHAR(512)  NOT NULL,"
    + "PUBLISHER_WALLET VARCHAR(512)  DEFAULT '',"
    + "LABEL            VARCHAR(256)  DEFAULT '',"
    + "IS_BUILTIN       BOOLEAN       NOT NULL DEFAULT FALSE,"
    + "CREATED_AT       BIGINT        NOT NULL,"
    + "TOTAL_EARNED     DECIMAL(20,6) NOT NULL DEFAULT 0"
    + ")";
  sqlQuery(sql, function() { if (cb) { cb(); } });
}

function initFEChannelState(cb) {
  var sql = "CREATE TABLE IF NOT EXISTS CHANNEL_STATE ("
    + "CAMPAIGN_ID        VARCHAR(256)  NOT NULL,"
    + "VIEWER_KEY         VARCHAR(66)   NOT NULL,"
    + "ROLE               VARCHAR(16)   NOT NULL DEFAULT 'viewer',"
    + "FRAME_ID           VARCHAR(512)  DEFAULT '',"
    + "CREATOR_MX         VARCHAR(512)  NOT NULL,"
    + "CHANNEL_COINID     VARCHAR(66)   DEFAULT '',"
    + "MAX_AMOUNT         DECIMAL(20,6) NOT NULL,"
    + "CUMULATIVE_EARNED  DECIMAL(20,6) NOT NULL DEFAULT 0,"
    + "LATEST_TX_HEX      TEXT          DEFAULT '',"
    + "STATUS             VARCHAR(16)   NOT NULL DEFAULT 'pending',"
    + "CREATED_AT         BIGINT        NOT NULL,"
    + "VIEWER_WALLET_ADDR VARCHAR(512)  DEFAULT '',"
    + "PRIMARY KEY (CAMPAIGN_ID, VIEWER_KEY, ROLE)"
    + ")";
  sqlQuery(sql, function() { if (cb) { cb(); } });
}

function _showWriteModeRequired() {
  var root = document.getElementById('app');
  if (!root) { return; }
  root.innerHTML = '';
  var box = document.createElement('div');
  box.style.cssText = 'max-width:480px;margin:4rem auto;padding:1.5rem;border:2px solid #c00;border-radius:6px;text-align:center;';
  var title = document.createElement('h2');
  title.textContent = 'Write mode required';
  var msg = document.createElement('p');
  msg.textContent = 'MinimaAds needs WRITE permissions to sign and post transactions.';
  var steps = document.createElement('ol');
  steps.style.cssText = 'text-align:left;margin:.75rem auto;max-width:320px;';
  ['Open the Minima Hub', 'Go to MiniDapps → MinimaAds', 'Tap WRITE', 'Reload this page'].forEach(function(s) {
    var li = document.createElement('li');
    li.textContent = s;
    steps.appendChild(li);
  });
  box.appendChild(title);
  box.appendChild(msg);
  box.appendChild(steps);
  root.appendChild(box);
}

function onInited() {
  MDS.cmd('checkmode', function(cm) {
    if (cm && cm.response && cm.response.writemode === false) {
      _showWriteModeRequired();
      return;
    }
    MDS.keypair.get('PLATFORM_KEY_OVERRIDE', function(kpRes) {
      if (kpRes && kpRes.status && kpRes.value) {
        PLATFORM_KEY = kpRes.value;
      }
      MDS.cmd('maxima action:info', function(res) {
        if (res && res.status && res.response) {
          if (res.response.publickey) { MY_ADDRESS    = res.response.publickey.toUpperCase(); }
          if (res.response.contact)   { MY_MX_ADDRESS = res.response.contact; }
        }
        initFEFrames(function() {
          initFEChannelState(function() {
            probeDb();
            doRender();
          });
        });
      });
    });
  });
}

(function bootstrap() {
  if (typeof MDS === 'undefined' || typeof MDS.init !== 'function') {
    return;
  }
  MDS.init(function(msg) {
    if (!msg || !msg.event) { return; }
    if (msg.event === 'inited') {
      onInited();
      return;
    }
    if (msg.event === 'MDSCOMMS') {
      // Only accept private (solo) signals from our own SW. Public broadcasts
      // from other MiniDapps could collide on signal names (AGENTS.md §5.1).
      if (!msg.data || msg.data.public) { return; }
      var raw = msg.data.message ? msg.data.message : msg.data;
      var parsed = null;
      try { parsed = JSON.parse(raw); } catch (e) { return; }
      handleMdsComms(parsed);
      return;
    }
    if (msg.event === 'MDS_PENDING') {
      handleFePending(msg);
      return;
    }
    // MAXIMA events for CAMPAIGN_ANNOUNCE / PAUSE / FINISH are persisted by the
    // SW — the FE must ignore them to avoid duplicate DB writes (AGENTS.md §12 #16).
  });
  window.addEventListener('hashchange', doRender);
})();
