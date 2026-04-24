// T10 — FE entry point.
// MDS.init bootstrap, MDSCOMMS dispatch, hash routing (#viewer | #creator | #stats).
// Waits for DB_READY (from SW signalFE) before rendering any DB-backed view.
// Silently ignores MAXIMA events already persisted by the SW (AGENTS.md §12 #16).
// APP_NAME and LIMITS mirror the SW globals (main.js) so core/minima.js and
// core/selection.js resolve them in FE scope (AGENTS.md §12 #23).

var APP_NAME = 'minima-ads';

var LIMITS = {
  MAX_VIEWS_PER_CAMPAIGN_PER_DAY:  1,
  MAX_CLICKS_PER_CAMPAIGN_PER_DAY: 1,
  COOLDOWN_BETWEEN_REWARDS_MS:     30000,
  MIN_VIEW_DURATION_MS:            3000,
  MAX_CAMPAIGNS_PER_SESSION:       10
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
  if (h === 'creator' || h === 'stats' || h === 'viewer') { return h; }
  return 'viewer';
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
  } else if (route === 'stats' && typeof renderStats === 'function') {
    renderStats(root);
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
  if (parsed.type === 'DO_CHANNEL_OPEN') {
    handleDoChannelOpen(parsed);
    return;
  }
  if (parsed.type === 'DO_REWARD_VOUCHER') {
    handleDoRewardVoucher(parsed);
    return;
  }
  if (parsed.type === 'DO_SEND_VOUCHER') {
    handleDoSendVoucher(parsed);
    return;
  }
  if (parsed.type === 'DO_RESEND_CHANNEL_OPEN') {
    handleDoResendChannelOpen(parsed);
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
}

// ---------------------------------------------------------------------------
// Channel helpers (T-CH4)
// ---------------------------------------------------------------------------

// Send a unicast Maxima message to a specific Mx address, hex-encoded.
// poll:true so messages survive the recipient being offline (per §6.5/§6.6).
function sendChannelMaxima(mxAddress, payload, cb) {
  var hex = '0x' + utf8ToHex(JSON.stringify(payload)).toUpperCase();
  var cmd = 'maxima action:send to:' + mxAddress
          + ' application:' + APP_NAME
          + ' data:' + hex
          + ' poll:true';
  MDS.cmd(cmd, function(res) {
    if (!res || !res.status) {
      console.error('[CHANNEL] sendChannelMaxima failed:', res && res.error);
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
    var cached = kpRes && kpRes.response ? kpRes.response.value : '';
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
    var raw = kpRes && kpRes.response ? kpRes.response.value : '';
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
  var campaignId = data.campaign_id;
  var viewerKey  = data.viewer_key;
  var viewerMx   = data.viewer_mx;
  var maxAmount  = parseFloat(data.max_amount);

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
      var channelAddr = chRes && chRes.response ? chRes.response.value : '';
      MDS.keypair.get('ESCROW_ADDRESS', function(esRes) {
        var escrowAddr = esRes && esRes.response ? esRes.response.value : '';
        if (!channelAddr || !escrowAddr) {
          console.error('[CHANNEL] DO_CHANNEL_OPEN: missing script addresses',
            'channel:', channelAddr, 'escrow:', escrowAddr);
          return;
        }
        buildAndPostChannelTx({
          campaignId:   campaignId,
          viewerKey:    viewerKey,
          viewerMx:     viewerMx,
          maxAmount:    maxAmount,
          budgetLeft:   budgetLeft,
          escrowCoinId: escrowCoinId,
          walletPK:     walletPK,
          channelAddr:  channelAddr,
          escrowAddr:   escrowAddr
        });
      });
    });
  });
}

function buildAndPostChannelTx(ctx) {
  var txId    = 'ch_' + generateUID();
  var change  = ctx.budgetLeft - ctx.maxAmount;
  var campaignIdHex = '0x' + utf8ToHex(ctx.campaignId).toUpperCase();
  var viewerMxHex   = '0x' + utf8ToHex(ctx.viewerMx).toUpperCase();

  function fail(stage, res) {
    console.error('[CHANNEL] channel-open tx failed at', stage, res && (res.error || res));
    MDS.cmd('txndelete id:' + txId, function() {});
  }

  MDS.cmd('txncreate id:' + txId, function(r1) {
    if (!r1.status) { fail('txncreate', r1); return; }

    MDS.cmd('txninput id:' + txId + ' coinid:' + ctx.escrowCoinId + ' scriptmmr:true', function(r2) {
      if (!r2.status) { fail('txninput', r2); return; }

      // output[0] — channel coin (max_amount → CHANNEL_SCRIPT_ADDRESS)
      MDS.cmd('txnoutput id:' + txId
            + ' storestate:true'
            + ' amount:' + ctx.maxAmount
            + ' address:' + ctx.channelAddr, function(r3) {
        if (!r3.status) { fail('txnoutput[channel]', r3); return; }

        function afterChange(r4) {
          if (r4 && !r4.status) { fail('txnoutput[change]', r4); return; }

          // STATE — port assignments per Appendix B.5 + C.3 reconciliation
          //   port 1 = creator wallet pk  (PREVSTATE(1) for both scripts)
          //   port 2 = viewer key         (PREVSTATE(2) for channel MULTISIG)
          //   port 3 = campaign_id (hex)
          //   port 4 = viewer mx address (hex)  — informational
          //   port 10 = max_amount  (escrow change verification)
          var stateCmds = [
            'txnstate id:' + txId + ' port:1 value:' + ctx.walletPK,
            'txnstate id:' + txId + ' port:2 value:' + ctx.viewerKey,
            'txnstate id:' + txId + ' port:3 value:' + campaignIdHex,
            'txnstate id:' + txId + ' port:4 value:' + viewerMxHex,
            'txnstate id:' + txId + ' port:10 value:' + ctx.maxAmount
          ];
          runSequential(stateCmds, 0, function(stateOk) {
            if (!stateOk) { fail('txnstate', null); return; }

            MDS.cmd('txnsign id:' + txId + ' publickey:' + ctx.walletPK, function(r5) {
              if (!r5.status) { fail('txnsign', r5); return; }

              MDS.cmd('txnpost id:' + txId + ' mine:true auto:true', function(r6) {
                console.log('[CHANNEL] txnpost response:', JSON.stringify(r6));

                if (r6 && r6.pending) {
                  var pendCtx = {
                    kind:         'channel_open',
                    txId:         txId,
                    campaignId:   ctx.campaignId,
                    viewerKey:    ctx.viewerKey,
                    viewerMx:     ctx.viewerMx,
                    maxAmount:    ctx.maxAmount,
                    escrowCoinId: ctx.escrowCoinId,
                    channelAddr:  ctx.channelAddr,
                    escrowAddr:   ctx.escrowAddr,
                    walletPK:     ctx.walletPK
                  };
                  savePendingChannelOp(r6.pendinguid, pendCtx);
                  console.log('[CHANNEL] channel-open pending, uid:', r6.pendinguid);
                  return;
                }

                if (!r6.status) { fail('txnpost', r6); return; }
                MDS.cmd('txndelete id:' + txId, function() {});
                finalizeChannelOpen(r6.response, {
                  campaignId:   ctx.campaignId,
                  viewerKey:    ctx.viewerKey,
                  viewerMx:     ctx.viewerMx,
                  maxAmount:    ctx.maxAmount,
                  escrowAddr:   ctx.escrowAddr
                });
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

function runSequential(cmds, idx, cb) {
  if (idx >= cmds.length) { cb(true); return; }
  MDS.cmd(cmds[idx], function(res) {
    if (!res.status) { console.error('[CHANNEL] cmd failed:', cmds[idx], res.error); cb(false); return; }
    runSequential(cmds, idx + 1, cb);
  });
}

// txpowResponse: the txpow JSON returned by txnpost. May come from immediate
// response (.response) or pending result (.result.response).
// outputs[0] = channel coin, outputs[1] = escrow change (if budget remained).
function finalizeChannelOpen(txpowResponse, ctx) {
  var outputs = null;
  try { outputs = txpowResponse.body.txn.outputs; } catch (e) {}
  if (!outputs || !outputs.length) {
    console.error('[CHANNEL] finalizeChannelOpen: no outputs in tx response');
    return;
  }
  var channelCoinId = outputs[0].coinid;
  var newEscrowCoinId = outputs.length > 1 ? outputs[1].coinid : '';

  console.log('[CHANNEL] channel coin:', channelCoinId, 'new escrow:', newEscrowCoinId);

  if (typeof activateChannel === 'function') {
    activateChannel(ctx.campaignId, ctx.viewerKey, channelCoinId, function(err) {
      if (err) { console.error('[CHANNEL] activateChannel failed:', err); }
    });
  }

  // Roll the escrow forward: the original ESCROW_COINID has been spent,
  // future channel-opens must reference the change coin (or be skipped if no
  // change remains and the campaign is effectively exhausted).
  if (newEscrowCoinId) {
    var sql = "UPDATE CAMPAIGNS SET ESCROW_COINID = '" + escapeSql(newEscrowCoinId) + "' "
            + "WHERE UPPER(ID) = UPPER('" + escapeSql(ctx.campaignId) + "')";
    sqlQuery(sql, function(err) {
      if (err) { console.error('[CHANNEL] CAMPAIGNS escrow update failed:', err); }
    });
  } else {
    var sqlClear = "UPDATE CAMPAIGNS SET ESCROW_COINID = '' "
                 + "WHERE UPPER(ID) = UPPER('" + escapeSql(ctx.campaignId) + "')";
    sqlQuery(sqlClear, function() {});
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

  getChannelState(campaignId, viewerKey, function(err, channel) {
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

      deriveScriptAddress(viewerKey, false, 'VIEWER_ADDR_' + viewerKey, function(viewerAddr) {
        if (!viewerAddr) {
          console.error('[CHANNEL] DO_REWARD_VOUCHER: viewer address derivation failed');
          return;
        }
        deriveScriptAddress(creatorWalletPK, true, 'WALLET_ADDR_' + creatorWalletPK, function(creatorAddr) {
          if (!creatorAddr) {
            console.error('[CHANNEL] DO_REWARD_VOUCHER: creator address derivation failed');
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
  });
}

function buildAndExportVoucherTx(ctx) {
  var txId   = 'rv_' + generateUID();
  var refund = ctx.maxAmount - ctx.cumulative;

  function fail(stage, res) {
    console.error('[CHANNEL] voucher tx failed at', stage, res && (res.error || res));
    MDS.cmd('txndelete id:' + txId, function() {});
  }

  MDS.cmd('txncreate id:' + txId, function(r1) {
    if (!r1.status) { fail('txncreate', r1); return; }

    MDS.cmd('txninput id:' + txId + ' coinid:' + ctx.channelCoinId + ' scriptmmr:true', function(r2) {
      if (!r2.status) { fail('txninput', r2); return; }

      MDS.cmd('txnoutput id:' + txId
            + ' storestate:false'
            + ' amount:' + ctx.cumulative
            + ' address:' + ctx.viewerAddr, function(r3) {
        if (!r3.status) { fail('txnoutput[viewer]', r3); return; }

        function afterRefund(r4) {
          if (r4 && !r4.status) { fail('txnoutput[creator]', r4); return; }

          MDS.cmd('txnsign id:' + txId + ' publickey:' + ctx.creatorWalletPK, function(r5) {
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
                updateChannelVoucher(ctx.campaignId, ctx.viewerKey, ctx.cumulative, txHex, function(err) {
                  if (err) { console.error('[CHANNEL] updateChannelVoucher failed:', err); }
                });
              }

              sendChannelMaxima(ctx.viewerMx, {
                type:        'REWARD_VOUCHER',
                campaign_id: ctx.campaignId,
                viewer_key:  ctx.viewerKey,
                event_id:    ctx.eventId,
                cumulative:  ctx.cumulative,
                tx_hex:      txHex
              }, function(ok) {
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
      console.log('[CHANNEL] pending denied/failed, uid:', uid);
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
    if (ctx.kind === 'channel_open') {
      finalizeChannelOpen(resp, {
        campaignId: ctx.campaignId,
        viewerKey:  ctx.viewerKey,
        viewerMx:   ctx.viewerMx,
        maxAmount:  ctx.maxAmount,
        escrowAddr: ctx.escrowAddr
      });
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

function initFEChannelState(cb) {
  var sql = "CREATE TABLE IF NOT EXISTS CHANNEL_STATE ("
    + "CAMPAIGN_ID       VARCHAR(256)  NOT NULL,"
    + "VIEWER_KEY        VARCHAR(66)   NOT NULL,"
    + "CREATOR_MX        VARCHAR(512)  NOT NULL,"
    + "CHANNEL_COINID    VARCHAR(66)   DEFAULT '',"
    + "MAX_AMOUNT        DECIMAL(20,6) NOT NULL,"
    + "CUMULATIVE_EARNED DECIMAL(20,6) NOT NULL DEFAULT 0,"
    + "LATEST_TX_HEX     TEXT          DEFAULT '',"
    + "STATUS            VARCHAR(16)   NOT NULL DEFAULT 'pending',"
    + "CREATED_AT        BIGINT        NOT NULL,"
    + "PRIMARY KEY (CAMPAIGN_ID, VIEWER_KEY)"
    + ")";
  sqlQuery(sql, function() { if (cb) { cb(); } });
}

function onInited() {
  MDS.cmd('maxima action:info', function(res) {
    if (res && res.status && res.response) {
      if (res.response.publickey) { MY_ADDRESS    = res.response.publickey.toUpperCase(); }
      if (res.response.contact)   { MY_MX_ADDRESS = res.response.contact; }
    }
    initFEChannelState(function() {
      probeDb();
      doRender();
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
