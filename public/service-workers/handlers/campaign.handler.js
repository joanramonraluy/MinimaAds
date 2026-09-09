// T8 — Campaign Maxima message handlers.
// Persists CAMPAIGN_ANNOUNCE / CAMPAIGN_PAUSE / CAMPAIGN_FINISH events
// via core/campaigns.js and signals the FE. Called from onMaxima in
// maxima.handler.js. Rhino-safe syntax.
//
// Payload schemas: MinimaAds.md §8.3 and §8.5.
// FE signals: MinimaAds.md §8.6 (NEW_CAMPAIGN, CAMPAIGN_UPDATED).

// Audit 2026-07-18 AUD-4 — identity-field guard.
//
// saveCampaign MERGEs CREATOR_ADDRESS and CREATOR_MX straight from the payload,
// so an unauthenticated CAMPAIGN_ANNOUNCE / CAMPAIGN_DATA_RESPONSE could re-point
// an already-known campaign row at an attacker's public key. That poisoning step
// is what made the Fix #3 vector reachable: overwrite CREATOR_ADDRESS, then send
// a crafted CAMPAIGN_PAUSE / CAMPAIGN_FINISH that now passes the creator check.
//
// Rule: once a row has an *established strong identity* (a permanent route
// MAX#<pk>#<mls>, from CAMPAIGNS.CREATOR_MX or from keypair CREATOR_MX_<id>
// cached from the on-chain escrow STATE(4) — neither settable by a payload), only
// that creator may rewrite the row's identity fields. Everybody else's message is
// still processed normally — budget, status, ad content and all other columns
// keep syncing exactly as before — but creator_address / creator_mx are pinned
// back to the stored values before they reach saveCampaign.
//
// OPEN-4 (2026-09-08) extends the pinned set to escrow_coinid / escrow_wallet_pk,
// which are now security-relevant: processEscrowCoin gates every on-chain action on
// the coin being on the lineage of CAMPAIGNS.ESCROW_COINID, so that column has to be
// as hard to move as CREATOR_ADDRESS is. Same three exemptions.
//
// Deliberately unchanged (documented MVP trade-off, MinimaAds.md §8.5):
//   - first discovery of a campaign_id → trust-on-first-use, payload wins;
//   - a row with no strong identity yet → first-write-wins preserved, so legacy
//     rows discovered before permanent routes existed keep syncing.
//
// senderPk is msg.data.from (verified by the Maxima transport, not a payload
// field). Rhino-safe: var, function(), string concat, no template literals.
function handleCampaignAnnounce(payload, senderPk) {
  if (!payload.campaign || !payload.ad || !payload.campaign.id) {
    MDS.log("[CAMPAIGN] ANNOUNCE missing campaign or ad");
    return;
  }

  // B-1: Drop announces whose money/time fields are not numeric.
  // These fields are interpolated directly into SQL as numeric literals in saveCampaign.
  // An attacker sending a string such as "0,0,'x',…') ; DROP TABLE …" would break out
  // of the VALUES clause. Reject the message here so malformed payloads never reach
  // saveCampaign, and let saveCampaign's own _numF/_numI coercion be the final guard.
  var c = payload.campaign;
  if (!isFinite(parseFloat(c.budget_total)) ||
      !isFinite(parseFloat(c.budget_remaining)) ||
      !isFinite(parseFloat(c.reward_view)) ||
      !isFinite(parseFloat(c.reward_click)) ||
      !isFinite(parseInt(c.created_at, 10))) {
    MDS.log("[CAMPAIGN] ANNOUNCE dropped: non-numeric money/time field in campaign " + c.id);
    return;
  }
  // expires_at is optional (may be null/undefined) — only validate when present.
  if (c.expires_at !== null && c.expires_at !== undefined && !isFinite(parseInt(c.expires_at, 10))) {
    MDS.log("[CAMPAIGN] ANNOUNCE dropped: non-numeric expires_at in campaign " + c.id);
    return;
  }

  var campaignId = payload.campaign.id;

  getCampaign(campaignId, function(err, existing) {
    if (err || !existing) {
      // No existing row — first discovery, trust-on-first-use (unchanged MVP behavior).
      _continueCampaignAnnounce(payload, campaignId);
      return;
    }
    _resolveStrongCreatorPk(existing, campaignId, function(strongPk) {
      if (!strongPk) {
        // Row has no established strong identity yet — preserve current
        // first-write-wins behavior so legacy/pre-route rows keep syncing.
        _continueCampaignAnnounce(payload, campaignId);
        return;
      }
      if (senderPk && strongPk.toUpperCase() === senderPk.toUpperCase()) {
        // Sender IS the strongly-verified creator — trust the payload's identity fields.
        _continueCampaignAnnounce(payload, campaignId);
        return;
      }
      // Sender not strongly verified — pin identity fields to the existing DB
      // values so the rest of the row (budget, status, ad content, etc.) still
      // syncs normally, but CREATOR_ADDRESS/CREATOR_MX cannot be overwritten.
      payload.campaign.creator_address = existing.CREATOR_ADDRESS;
      payload.campaign.creator_mx = existing.CREATOR_MX;
      // OPEN-4 / F3 — the escrow anchor is an identity field too. processEscrowCoin
      // now decides what an on-chain coin may do by comparing it against
      // CAMPAIGNS.ESCROW_COINID, so leaving that column freely writable from any
      // Maxima payload would make the lineage gate decorative: an attacker would
      // simply re-point the anchor at their own forged coin first. ESCROW_WALLET_PK
      // is pinned with it because it is the genesis binding
      // (_processUnknownCampaignCoin checks the coin's STATE(1) against it).
      // Same three exemptions as above: first discovery, no strong identity yet,
      // or the sender IS the strong creator.
      payload.campaign.escrow_coinid = existing.ESCROW_COINID || '';
      payload.campaign.escrow_wallet_pk = existing.ESCROW_WALLET_PK || '';
      MDS.log("[CAMPAIGN] ANNOUNCE identity fields pinned (sender not strongly verified). campaign=" + campaignId);
      _continueCampaignAnnounce(payload, campaignId);
    });
  });
}

// AUD-4 helper — resolves the campaign's *strong* creator public key, i.e. the
// public key embedded in a permanent route MAX#<pk>#<mls>. Two sources, same
// precedence as _assertCreatorThen below:
//   1. CAMPAIGNS.CREATOR_MX  — set locally at creation on the creator's own node.
//   2. keypair CREATOR_MX_<campaignId> — cached from the on-chain escrow STATE(4).
// Neither is settable by a Maxima payload. parseMaximaRoute (core/minima.js)
// returns null for a legacy "MAX#Mx...#mls" contact route, so only a real hex
// public key is ever returned. cb('') when the row has no strong identity.
function _resolveStrongCreatorPk(existing, campaignId, cb) {
  var storedRoute = parseMaximaRoute(existing.CREATOR_MX || '');
  if (storedRoute && storedRoute.publickey) {
    cb(storedRoute.publickey);
    return;
  }
  MDS.keypair.get("CREATOR_MX_" + campaignId, function(kpRes) {
    var onChainRoute = parseMaximaRoute((kpRes && kpRes.status && kpRes.value) ? kpRes.value : '');
    cb((onChainRoute && onChainRoute.publickey) ? onChainRoute.publickey : '');
  });
}

// Body of handleCampaignAnnounce past the AUD-4 identity gate. Logic is
// unchanged from before the gate existed — only *when* it runs, and whether
// payload.campaign's identity fields were pinned first, is new.
function _continueCampaignAnnounce(payload, campaignId) {
  var maxViewerReward = (payload.max_viewer_reward !== undefined && payload.max_viewer_reward !== null)
    ? parseFloat(payload.max_viewer_reward) : null;
  payload.campaign.max_viewer_reward = maxViewerReward;
  if (payload.max_daily_views !== undefined && payload.max_daily_views !== null) {
    payload.campaign.max_daily_views = parseInt(payload.max_daily_views, 10);
  }
  if (payload.max_daily_clicks !== undefined && payload.max_daily_clicks !== null) {
    payload.campaign.max_daily_clicks = parseInt(payload.max_daily_clicks, 10);
  }
  if (payload.cooldown_ms !== undefined && payload.cooldown_ms !== null) {
    payload.campaign.cooldown_ms = parseInt(payload.cooldown_ms, 10);
  }

  var localPlatformSet = !(typeof PLATFORM_KEY === 'undefined' || PLATFORM_KEY === null || PLATFORM_KEY === '');
  var localFoundationSet = !(typeof FOUNDATION_KEY === 'undefined' || FOUNDATION_KEY === null || FOUNDATION_KEY === '');

  if (!localPlatformSet && !localFoundationSet) {
    persistCampaign(payload, campaignId);
    return;
  }

  // Payload-based platform_key check is redundant (spoofable) and breaks cross-node
  // discovery when nodes have per-node PLATFORM_KEY overrides. The authoritative
  // check is PREVSTATE(5) from the on-chain escrow coin (lines 45-58 below).
  // See KNOWN_ISSUES.md #31: never trust payload fields for PKs — verify on-chain.
  // var payloadPk = payload.platform_key ? payload.platform_key.toUpperCase() : '';
  // if (payloadPk !== PLATFORM_KEY.toUpperCase()) {
  //   MDS.log("[CAMPAIGN] platform_key mismatch, dropping campaign: " + campaignId);
  //   return;
  // }

  var coinId = (payload.campaign.escrow_coinid || '');
  if (!coinId) {
    persistCampaign(payload, campaignId);
    return;
  }

  MDS.cmd("coins coinid:" + coinId, function(res) {
    if (!res.status || !res.response || res.response.length === 0) {
      MDS.log("[CAMPAIGN] on-chain coin not found for PK verification, accepting: " + campaignId);
      persistCampaign(payload, campaignId);
      return;
    }
    // Fragility #52: Minima's coin JSON never carries a "prevstate" key — only
    // "state" (the state the coin carries now, which becomes PREVSTATE on its
    // next spend; confirmed against Coin.toJSON()). Reading .prevstate here
    // silently returned [] forever, so the PREVSTATE(5)/(6) checks below never
    // actually validated anything against the real on-chain keys.
    var prevstates = res.response[0].state || [];
    var onChainPk = getStateVar(prevstates, 5);
    // If escrow was created without PLATFORM_KEY (0x00), accept regardless of local setting.
    // Creator and viewer may have different PLATFORM_KEY overrides; 0x00 means creator had fee disabled.
    if (localPlatformSet && onChainPk && onChainPk !== '0x00' && onChainPk.toUpperCase() !== PLATFORM_KEY.toUpperCase()) {
      MDS.log("[CAMPAIGN] PREVSTATE(5) mismatch, dropping campaign: " + campaignId);
      return;
    }

    // Foundation fee verification (V4 escrow): PREVSTATE(6) holds the foundation key.
    // Under V3, PREVSTATE(6) holds max_publisher_budget (a number) — not a key — so a
    // local FOUNDATION_KEY override would never match. Only drop when the on-chain value
    // looks like a key (0x... DER, longer than a short number) and mismatches. A short/0x00
    // value means the creator funded a V3 escrow with the foundation fee disabled → accept.
    var onChainFk = getStateVar(prevstates, 6);
    if (localFoundationSet && onChainFk && onChainFk !== '0x00' && onChainFk.length > 10
        && onChainFk.toUpperCase() !== FOUNDATION_KEY.toUpperCase()) {
      MDS.log("[CAMPAIGN] PREVSTATE(6) foundation key mismatch, dropping campaign: " + campaignId);
      return;
    }

    persistCampaign(payload, campaignId);
  });
}

function _replayPendingPublisherNotify(campaignId) {
  MDS.keypair.get("PENDING_PUB_NOTIFY_" + campaignId, function(kpRes) {
    if (!kpRes || !kpRes.status || !kpRes.value) { return; }
    var data;
    try { data = JSON.parse(kpRes.value); } catch (e) { return; }
    MDS.keypair.set("PENDING_PUB_NOTIFY_" + campaignId, "", function() {});
    MDS.log("[CHANNEL] replaying deferred PUBLISHER_REWARD_NOTIFY for: " + campaignId);
    if (typeof handlePublisherRewardNotify === 'function') {
      handlePublisherRewardNotify(data, data.creator_key || '');
    }
  });
}

function persistCampaign(payload, campaignId) {
  saveCampaign(payload.campaign, payload.ad, function(err) {
    if (err) {
      MDS.log("[CAMPAIGN] saveCampaign failed: " + err);
      return;
    }
    MDS.log("[CAMPAIGN] ANNOUNCE persisted, id: " + campaignId);
    signalFE("NEW_CAMPAIGN", { campaign_id: campaignId });
    _replayPendingPublisherNotify(campaignId);
  });
}

function handleCampaignPause(payload, senderPk) {
  if (!payload.campaign_id) {
    MDS.log("[CAMPAIGN] PAUSE missing campaign_id");
    return;
  }
  _assertCreatorThen(payload.campaign_id, senderPk, function(strongSender) {
    // Audit 2026-07-18 AUD-3 — same reasoning as handleCampaignFinish's Fix #3
    // guard: applyStatusChange's isSettling gate also covers 'paused', so a
    // fallback-verified PAUSE could otherwise still force
    // autoSettleChannelsForCampaign on a campaign the sender does not control.
    if (!strongSender) {
      MDS.log("[CAMPAIGN] PAUSE via fallback creator check — deferring auto-settle to on-chain confirmation");
      applyStatusChange(payload.campaign_id, "paused", true);
      return;
    }
    applyStatusChange(payload.campaign_id, "paused");
  });
}

function handleCampaignFinish(payload, senderPk) {
  if (!payload.campaign_id) {
    MDS.log("[CAMPAIGN] FINISH missing campaign_id");
    return;
  }
  _assertCreatorThen(payload.campaign_id, senderPk, function(strongSender) {
    // Audit 2026-07-18 Fix #3: the FINISH fast-path may only force channel
    // settlement when the sender was verified against a permanent route
    // (MAX#<pk>#<mls>). A match on CAMPAIGNS.CREATOR_ADDRESS alone is a weak
    // identity — for announce/response-discovered campaigns that value comes
    // from a Maxima payload field — so a crafted FINISH must not be able to
    // force autoSettleChannelsForCampaign on a campaign it does not control.
    // The local status still flips to 'finished' (recoverable, and reconciled
    // from PREVSTATE(7) on-chain for V3 escrows); only the settlement is
    // withheld, falling back to viewer-initiated settlement.
    if (!strongSender) {
      MDS.log("[CAMPAIGN] FINISH via fallback creator check — deferring auto-settle to on-chain confirmation");
      applyStatusChange(payload.campaign_id, "finished", true);
      return;
    }
    applyStatusChange(payload.campaign_id, "finished");
  });
}

function handleCampaignResume(payload, senderPk) {
  if (!payload.campaign_id) {
    MDS.log("[CAMPAIGN] RESUME missing campaign_id");
    return;
  }
  _assertCreatorThen(payload.campaign_id, senderPk, function(strongSender) {
    applyStatusChange(payload.campaign_id, "active");
  });
}

// Verifies the Maxima sender PK matches the campaign creator before applying
// any status change. Comparison is case-insensitive — public keys may arrive in
// mixed hex case. senderPk comes from msg.data.from (Maxima-layer,
// cryptographically verified).
//
// Audit 2026-07-18 Fix #3 — the callback receives a trust flag:
//   ok(true)  "strong": the sender matched a permanent route MAX#<pk>#<mls>,
//             either the one stored with the campaign (CAMPAIGNS.CREATOR_MX, set
//             locally at creation on the creator's own node) or the on-chain one
//             cached from the escrow coin STATE(4) in keypair
//             CREATOR_MX_<campaignId>. Neither is settable by a Maxima payload.
//   ok(false) "fallback": the sender only matched CAMPAIGNS.CREATOR_ADDRESS. For
//             announce/CAMPAIGN_DATA_RESPONSE-discovered campaigns that column is
//             filled from payload.campaign.creator_address, so it is a weak
//             identity — good enough to flip a local status (recoverable, and
//             overwritten by PREVSTATE(7) reconciliation on V3 escrows), not good
//             enough to force channel settlement. See handleCampaignFinish.
// Same two identity sources, same precedence, as channel.handler.js
// _assertCampaignCreatorSender — but this guard fails CLOSED (no ok() call) when
// no creator identity is known locally, which is the pre-existing behavior here.
function _assertCreatorThen(campaignId, senderPk, ok) {
  if (!senderPk) {
    MDS.log("[CAMPAIGN] status change rejected: no sender PK. campaign=" + campaignId);
    return;
  }
  getCampaign(campaignId, function(err, c) {
    if (err || !c) {
      MDS.log("[CAMPAIGN] status change rejected: campaign not found. campaign=" + campaignId);
      return;
    }
    // parseMaximaRoute (core/minima.js) returns null for a legacy "MAX#Mx...#mls"
    // contact route, so only a real hex public key ever reaches the strong branch.
    var storedRoute = parseMaximaRoute(c.CREATOR_MX || '');
    var storedPk = storedRoute ? storedRoute.publickey : '';
    if (storedPk && storedPk.toUpperCase() === senderPk.toUpperCase()) {
      ok(true);
      return;
    }
    MDS.keypair.get("CREATOR_MX_" + campaignId, function(kpRes) {
      var onChainRoute = parseMaximaRoute((kpRes && kpRes.status && kpRes.value) ? kpRes.value : '');
      var onChainPk = onChainRoute ? onChainRoute.publickey : '';
      if (onChainPk && onChainPk.toUpperCase() === senderPk.toUpperCase()) {
        ok(true);
        return;
      }
      var creatorPk = c.CREATOR_ADDRESS || '';
      if (creatorPk && creatorPk.toUpperCase() === senderPk.toUpperCase()) {
        ok(false);
        return;
      }
      MDS.log("[CAMPAIGN] status change rejected: sender is not the creator. campaign=" + campaignId
        + " sender=" + senderPk.substring(0, 16) + "...");
    });
  });
}

// Returns the data value for a given port in coin.state (array of {port, data} objects).
// Pattern from official Minima mds.js getStateVariable utility.
function getStateVar(states, port) {
  for (var i = 0; i < states.length; i++) {
    if (states[i].port == port) { return states[i].data; }
  }
  return '';
}

// Fix C helper: reads own permanent route from keypair, builds REQUEST_CAMPAIGN_DATA
// with requester_mx = permanent route (if registered) or MY_MX_ADDRESS (fallback),
// then dispatches via PK routing (creatorPk) or direct contact (creatorMx).
// creatorPk = hex public key string or null; creatorMx = Mx... address or null.
function _sendRequestCampaignData(campaignId, creatorPk, creatorMx, cb) {
  if (creatorPk && creatorMx) {
    // Normalise creatorMx to full MAX#pk#mls route so sendMaxima uses the correct to: address.
    creatorMx = (creatorMx.indexOf("MAX#") === 0) ? creatorMx : ("MAX#" + creatorPk + "#" + creatorMx);
  }
  MDS.keypair.get("USER_PERMANENT_ROUTE", function(kpRes) {
    var myRoute = (kpRes && kpRes.status && kpRes.value) ? kpRes.value : "";
    var requesterMx = (myRoute && myRoute.indexOf("MAX#") === 0) ? myRoute : MY_MX_ADDRESS;
    var payload = {
      type: "REQUEST_CAMPAIGN_DATA",
      campaign_id: campaignId,
      requester_mx: requesterMx
    };
    sendMaxima(creatorPk, creatorMx, payload, function(ok) {
      if (ok) {
        cb(true);
        return;
      }
      // Direct routing failed (MLS unreachable or creator not in contacts).
      // Fall back to broadcast — any Maxima peer that has this campaign will
      // receive the request and respond to requester_mx. This handles the case
      // where the MLS address in the escrow coin is stale or the nodes are not
      // directly peered via MLS but share P2P Maxima peers.
      MDS.log("[DISCOVERY] direct routing failed, trying broadcastMaxima for: " + campaignId);
      broadcastMaxima(payload, function(ok2) {
        MDS.log("[DISCOVERY] broadcastMaxima REQUEST_CAMPAIGN_DATA ok=" + ok2 + " campaign=" + campaignId);
        cb(ok2);
      });
    });
  });
}

// How many generations of forward escrow lineage a coin may be away from the
// campaign's stored anchor and still be accepted (OPEN-4). Two covers the realistic
// gap between two scans of this node (e.g. a status-update tx plus a channel-open
// split that both confirmed while the node was busy or offline), at a worst case of
// 6 local `hash` calls per anchor — memoised per campaign in _escrowDescendants.
var ESCROW_LINEAGE_MAX_DEPTH = 2;

// Called from service.js scanEscrowCoins for each coin at an ESCROW_ADDRESS.
// Reads STATE(3)=campaign_id_hex, STATE(4)=creator_mx_address.
// If campaign is unknown locally, sends REQUEST_CAMPAIGN_DATA to creator.
// _knownEscrowCoins and MY_MX_ADDRESS are globals defined in service.js.
//
// OPEN-4 (2026-09-08) — this function is reached for ANY coin anyone pays to the
// public escrow script address, so it is split into a pure parse stage, a trust
// gate (_resolveEscrowCoinTrust), and the state-changing body
// (_applyTrustedEscrowCoin) which only the gate can reach.
function processEscrowCoin(coin) {
  var coinId = coin.coinid;
  // Only skip if the campaign is already confirmed in the local DB.
  // Coins for unknown campaigns are NOT cached here so REQUEST_CAMPAIGN_DATA
  // can be retried on subsequent NEWBLOCKs if delivery was lost.
  if (_knownEscrowCoins[coinId]) { return; }

  var states = coin.state || [];
  var campaignIdHex     = getStateVar(states, 3);
  var creatorContactHex = getStateVar(states, 4);

  if (!campaignIdHex || !creatorContactHex) {
    MDS.log("[DISCOVERY] Coin missing STATE(3) or STATE(4), skipping: " + coinId);
    return;
  }

  var campaignId    = hexToUtf8(campaignIdHex);
  var creatorRaw    = hexToUtf8(creatorContactHex);

  // Fix B: Determine routing mode from STATE(4).
  // If it encodes a permanent route (MAX#<hexPK>#<mls>), use PK-based routing.
  // If it encodes the legacy "MAX#Mx...#mls" format, fall back to direct contact.
  // Otherwise treat as a direct Mx contact address.
  var creatorPkRoute = null;  // hex public key for PK routing
  var creatorMxAddr = creatorRaw;  // direct contact fallback

  if (creatorRaw.indexOf("MAX#") === 0) {
    var routeParts = creatorRaw.split("#");
    if (routeParts.length === 3) {
      var routePk = routeParts[1];
      if (routePk.indexOf("Mx") === 0 || routePk.indexOf("mx") === 0 || routePk.indexOf("MX") === 0) {
        // Legacy format: extract direct contact address
        MDS.log("[DISCOVERY] Outdated route format in coin: " + creatorRaw + " — falling back to direct contact: " + routePk);
        creatorMxAddr = routePk;
      } else {
        // Valid permanent route: PK routing primary, permanent route fallback.
        // Keep the full MAX#... route so to: fallback resolves the creator via MLS registry.
        creatorPkRoute = routePk;
        creatorMxAddr = creatorRaw;
        MDS.log("[DISCOVERY] Permanent route: PK=" + routePk.substring(0, 10) + "... Route=" + creatorRaw.substring(0, 30) + "...");
      }
    }
  }

  MDS.log("[DISCOVERY] coin: " + coinId + " campaignId: " + campaignId + " creatorContact: " + (creatorPkRoute ? ("PK:" + creatorPkRoute.substring(0, 10) + "...") : creatorMxAddr));

  // OPEN-4 — nothing above this point writes anything. Parsing STATE(3)/STATE(4)
  // off a coin found at the *public* escrow script address proves nothing about who
  // created that coin, so every state-changing action now sits behind the lineage
  // gate below.
  getCampaign(campaignId, function(err, campaign) {
    if (!campaign) {
      _processUnknownCampaignCoin(coin, coinId, campaignId, states, creatorPkRoute, creatorMxAddr);
      return;
    }
    _resolveEscrowCoinTrust(coin, coinId, campaignId, campaign, function(verdict) {
      if (verdict === 'trusted') {
        _applyTrustedEscrowCoin(coin, coinId, campaignId, states, campaign, creatorPkRoute, creatorMxAddr);
        return;
      }
      if (verdict === 'skip') {
        // Split-transient sibling rule (fragility #41) — the real continuation is
        // the index-1 change coin, handled in this same scan pass or the next one.
        return;
      }
      // 'rejected' — off-lineage coin, or no usable anchor to compare against.
      // No state-changing action of any kind; ask the *stored* creator identity for
      // fresh campaign data so a genuinely stale anchor can still self-heal.
      _requestReanchorFromStoredCreator(campaign, campaignId);
    });
  });
}

// OPEN-4 — resolves whether a coin found at an escrow address may act on a campaign
// this node already knows. cb('trusted' | 'skip' | 'rejected').
//
// The anchor is CAMPAIGNS.ESCROW_COINID: the coin the campaign was funded with (or
// the last successor this node accepted). A legitimate successor is always produced
// by a tx that spends the current escrow coin as its single input, so it is exactly
// escrowChildCoinId(anchor, 0 | 1) — see core/campaigns.js for the derivation and
// why the check has to be a forward closure rather than a backward walk.
function _resolveEscrowCoinTrust(coin, coinId, campaignId, campaign, cb) {
  var anchor = campaign.ESCROW_COINID || '';
  if (!(/^0[xX][0-9A-Fa-f]{64}$/).test(anchor)) {
    MDS.log("[DISCOVERY] no anchor for campaign=" + campaignId + " — coin " + coinId + " not trusted");
    cb('rejected');
    return;
  }
  if (coinId && coinId.toUpperCase() === anchor.toUpperCase()) {
    cb('trusted');
    return;
  }
  // Keyed on the anchor so the memo self-invalidates the moment the anchor advances
  // (preserves the self-heal property of fragility #43).
  var rejectKey = campaignId + '|' + anchor.toUpperCase() + '|' + (coinId || '').toUpperCase();
  if (_offLineageEscrowCoins[rejectKey]) {
    cb('rejected');
    return;
  }
  if (!_isEscrowAddress(coin.address)) {
    _offLineageEscrowCoins[rejectKey] = true;
    MDS.log("[DISCOVERY] REJECTED off-lineage escrow coin " + coinId + " campaign=" + campaignId + " anchor=" + anchor);
    cb('rejected');
    return;
  }
  _getEscrowDescendants(campaignId, anchor, function(memo) {
    var key = (coinId || '').toUpperCase();
    var entry = memo.set[key];
    if (!entry) {
      // Fragility #41, second half: once the anchor has advanced to the change coin
      // of a split tx, that tx's *other* output (the short-lived split coin, still
      // unspent at the escrow address until the channel-open tx confirms) is no
      // longer derivable from the new anchor. It is not an attack, it is the coin we
      // deliberately skipped a block ago — recognise it through the superseded
      // anchor's closure and skip it again instead of logging a false rejection.
      if (memo.prevSet && memo.prevSet[key]) {
        MDS.log("[DISCOVERY] split-transient: skipping " + coinId
          + " (superseded lineage branch). campaign=" + campaignId);
        cb('skip');
        return;
      }
      _offLineageEscrowCoins[rejectKey] = true;
      MDS.log("[DISCOVERY] REJECTED off-lineage escrow coin " + coinId + " campaign=" + campaignId + " anchor=" + anchor);
      cb('rejected');
      return;
    }
    var path = entry.path || [];
    if (path.length === 0 || path[path.length - 1] !== 0) {
      cb('trusted');
      return;
    }
    // Fragility #41 — an escrow *split* tx (channel open) emits the split coin at
    // output 0 and the escrow continuation (change) at output 1, because the script
    // asserts VERIFYOUT(INC(@INPUT) @ADDRESS change …) and there is one input. A
    // status-update tx emits a single output at index 0 and has no such sibling.
    // So an index-0 descendant is only the real continuation when no unspent
    // escrow-addressed sibling exists at index 1; otherwise skip it entirely and let
    // the sibling advance the anchor, which removes the old budget ping-pong.
    _escrowPathParent(anchor, path, function(parentId) {
      if (!parentId) { cb('trusted'); return; }
      escrowChildCoinId(parentId, 1, function(siblingId) {
        if (!siblingId) { cb('trusted'); return; }
        MDS.cmd("coins coinid:" + siblingId, function(res) {
          var sibling = (res && res.status && res.response && res.response.length > 0) ? res.response[0] : null;
          if (sibling && _isEscrowAddress(sibling.address)) {
            MDS.log("[DISCOVERY] split-transient: skipping " + coinId + " (sibling " + siblingId
              + " is the escrow continuation). campaign=" + campaignId);
            cb('skip');
            return;
          }
          cb('trusted');
        });
      });
    });
  });
}

// Re-derives the parent of a descendant reached by `path` from `anchor`.
// path.length <= 1 → the parent is the anchor itself; otherwise walk the leading
// branches (at most ESCROW_LINEAGE_MAX_DEPTH - 1 extra hash calls). cb('') on failure.
function _escrowPathParent(anchor, path, cb) {
  if (!path || path.length <= 1) { cb(anchor); return; }
  var cur = anchor;
  var i = 0;
  function step() {
    if (i >= path.length - 1) { cb(cur); return; }
    escrowChildCoinId(cur, path[i], function(childId) {
      if (!childId) { cb(''); return; }
      cur = childId;
      i++;
      step();
    });
  }
  step();
}

// Memoised forward hash closure of the campaign's anchor. Recomputed only when the
// anchor changes; the superseded closure is kept as prevSet so the split coin of the
// tx that advanced the anchor can still be recognised (see _resolveEscrowCoinTrust).
// cb({ anchor, set, prevAnchor, prevSet }).
// _escrowDescendants is a global map defined in service.js.
function _getEscrowDescendants(campaignId, anchor, cb) {
  var memo = _escrowDescendants[campaignId];
  if (memo && memo.set && memo.anchor && memo.anchor.toUpperCase() === anchor.toUpperCase()) {
    cb(memo);
    return;
  }
  var prevAnchor = (memo && memo.anchor) ? memo.anchor : '';
  var prevSet    = (memo && memo.set)    ? memo.set    : null;
  escrowDescendantSet(anchor, ESCROW_LINEAGE_MAX_DEPTH, function(set) {
    var fresh = { anchor: anchor, set: set, prevAnchor: prevAnchor, prevSet: prevSet };
    _escrowDescendants[campaignId] = fresh;
    cb(fresh);
  });
}

// True when addr is one of this node's registered escrow script addresses.
// ESCROW_ADDRESS / _V3 / _V4 are globals defined in service.js.
function _isEscrowAddress(addr) {
  if (!addr) { return false; }
  var a = addr.toUpperCase();
  if (ESCROW_ADDRESS_V4 && a === ESCROW_ADDRESS_V4.toUpperCase()) { return true; }
  if (ESCROW_ADDRESS_V3 && a === ESCROW_ADDRESS_V3.toUpperCase()) { return true; }
  if (ESCROW_ADDRESS    && a === ESCROW_ADDRESS.toUpperCase())    { return true; }
  return false;
}

// OPEN-4 — a rejected (or unanchorable) coin must never steer discovery traffic.
// The re-anchor request is routed with the identity already stored on the campaign
// row, never with the rejected coin's STATE(4): routing by the attacker's own route
// would hand them the follow-up conversation. Rate-limited through the same 30 s
// _pendingCampaignRequests map the unknown-campaign path uses.
function _requestReanchorFromStoredCreator(campaign, campaignId) {
  var storedPk = campaign.CREATOR_ADDRESS || '';
  var storedMx = campaign.CREATOR_MX || '';
  if (!storedPk && !storedMx) {
    MDS.log("[DISCOVERY] re-anchor skipped: no stored creator identity. campaign=" + campaignId);
    return;
  }
  // On the creator's own node the row IS the source of truth — there is nothing to
  // re-anchor from. Found live 2026-09-08: without this the creator addressed the
  // request to its own Maxima PK, Maxima looped it back, and the node answered its
  // own CAMPAIGN_DATA_RESPONSE — a self-message that passes the AUD-4 strong-sender
  // check and therefore overwrote CAMPAIGNS.CREATOR_MX with the response's (absent)
  // value.
  if (MY_MAXIMA_PK && storedPk && MY_MAXIMA_PK.toUpperCase() === storedPk.toUpperCase()) {
    MDS.log("[DISCOVERY] re-anchor skipped: this node is the campaign creator. campaign=" + campaignId);
    return;
  }
  var now = Date.now();
  var lastSent = (_pendingCampaignRequests && _pendingCampaignRequests[campaignId]) ? _pendingCampaignRequests[campaignId] : 0;
  if (now - lastSent < 30000) {
    MDS.log("[DISCOVERY] re-anchor REQUEST_CAMPAIGN_DATA rate-limited for: " + campaignId
      + " (retry in " + Math.round((30000 - (now - lastSent)) / 1000) + "s)");
    return;
  }
  if (_pendingCampaignRequests) { _pendingCampaignRequests[campaignId] = now; }
  _sendRequestCampaignData(campaignId, storedPk ? storedPk : null, storedMx ? storedMx : null, function(ok) {
    MDS.log("[DISCOVERY] re-anchor REQUEST_CAMPAIGN_DATA sent for: " + campaignId + " ok: " + ok);
    if (!ok) {
      if (_pendingCampaignRequests) { _pendingCampaignRequests[campaignId] = 0; }
    }
  });
}

// The full effect of a *trusted* escrow coin: routing keypair refresh, publisher
// budget patch, budget + anchor sync, and on-chain status reconciliation. Body
// unchanged from before the OPEN-4 gate existed — only reachability changed.
function _applyTrustedEscrowCoin(coin, coinId, campaignId, states, campaign, creatorPkRoute, creatorMxAddr) {
  // Campaign is in local DB — mark coin as fully processed, no further action needed.
  _knownEscrowCoins[coinId] = true;

  // OPEN-4 / F1 — refresh the routing keypair from on-chain STATE(4).
  // This used to run unconditionally, above getCampaign, for EVERY coin found at the
  // public escrow address. CREATOR_MX_<campaignId> is read by _assertCreatorThen
  // (this file) and _assertCampaignCreatorSender (channel.handler.js) as a *strong
  // identity* source, so writing it from an unverified coin let anyone who paid dust
  // to the escrow address impersonate the campaign creator over Maxima — enough to
  // force a CAMPAIGN_FINISH (real L1 settlement) or clobber CHANNEL_STATE.
  // LATEST_TX_HEX. It is now reached only for a coin on the campaign's own escrow
  // lineage.
  MDS.keypair.set("CREATOR_MX_" + campaignId, creatorMxAddr ? creatorMxAddr : creatorPkRoute, function() {});

  // Log-only sanity check. Deliberately NOT a gate: escrow coins legitimately shrink
  // to sub-cent (and, per fragility #54, sub-micro) values as a campaign's budget is
  // consumed, so any amount floor would break real campaigns near exhaustion.
  var coinAmt = parseFloat(coin.amount);
  if (!isFinite(coinAmt) || coinAmt < 0) {
    MDS.log("[DISCOVERY] implausible escrow coin amount '" + coin.amount + "' on trusted coin "
      + coinId + " campaign=" + campaignId);
  }

  // Detect stale publisher data: on-chain STATE(6) has a publisher budget
  // but local DB has MAX_PUBLISHER_BUDGET = 0 (saved with pre-fix code).
  var onChainPubBudget = parseFloat(getStateVar(states, 6) || 0);
  if (onChainPubBudget > 0 && parseFloat(campaign.MAX_PUBLISHER_BUDGET || 0) <= 0) {
    MDS.log("[DISCOVERY] stale MAX_PUBLISHER_BUDGET for: " + campaignId + " — patching DB from on-chain state(" + onChainPubBudget + ")");
    sqlQuery(
      "UPDATE CAMPAIGNS SET MAX_PUBLISHER_BUDGET = " + onChainPubBudget +
      " WHERE UPPER(ID) = UPPER('" + escapeSql(campaignId) + "')",
      function(patchErr) {
        if (patchErr) {
          MDS.log("[DISCOVERY] patch failed: " + patchErr + " — falling back to REQUEST_CAMPAIGN_DATA");
          _sendRequestCampaignData(campaignId, creatorPkRoute, creatorMxAddr, function(ok) {
            MDS.log("[DISCOVERY] refresh REQUEST_CAMPAIGN_DATA sent for: " + campaignId + " ok: " + ok);
          });
        } else {
          MDS.log("[DISCOVERY] MAX_PUBLISHER_BUDGET patched: " + campaignId + " = " + onChainPubBudget);
          // Fix #5: include status so the SDK's _livenessCache can refresh
          // directly from this signal instead of falling back to a delete
          // (see sdk/index.js _onCampaignUpdatedCore).
          signalFE("CAMPAIGN_UPDATED", { campaign_id: campaignId, status: campaign.STATUS });
        }
      }
    );
  }

  // Sync BUDGET_REMAINING when coinId changed (new change coin) or when the
  // on-chain amount differs from the DB value (stale record from old code that
  // updated ESCROW_COINID but not BUDGET_REMAINING). Runs once per coin per session.
  // This is also what advances the lineage anchor — hence the gate above.
  var onChainAmount = parseFloat(coin.amount || 0);
  var dbRemaining = parseFloat(campaign.BUDGET_REMAINING || 0);
  if (coinId !== (campaign.ESCROW_COINID || '') || Math.abs(onChainAmount - dbRemaining) > 0.000001) {
    MDS.log("[DISCOVERY] budget sync: " + campaignId + " coinId " + (campaign.ESCROW_COINID || '(none)') + " -> " + coinId + " amount=" + onChainAmount + " dbRemaining=" + dbRemaining);
    sqlQuery(
      "UPDATE CAMPAIGNS SET BUDGET_REMAINING = " + onChainAmount +
      ", ESCROW_COINID = '" + escapeSql(coinId) + "'" +
      " WHERE UPPER(ID) = UPPER('" + escapeSql(campaignId) + "')",
      function(syncErr) {
        if (syncErr) {
          MDS.log("[DISCOVERY] budget sync failed: " + syncErr);
        } else {
          MDS.log("[DISCOVERY] budget synced: " + campaignId + " remaining=" + onChainAmount);
          // Fix #5: include status (see note above).
          signalFE("CAMPAIGN_UPDATED", { campaign_id: campaignId, status: campaign.STATUS });
        }
      }
    );
  }

  // V3 only — sync local STATUS from PREVSTATE(7). Silently skipped for V1/V2
  // coins (no port 7). Terminal-state guard prevents re-activating a finished
  // campaign from an older coin read. Runs once per coinId per session.
  var onChainStatusHex = getStateVar(states, 7);
  if (onChainStatusHex) {
    var onChainStatus = '';
    try { onChainStatus = hexToUtf8(onChainStatusHex); } catch (ex) {
      MDS.log("[DISCOVERY] could not decode PREVSTATE(7) for " + campaignId + ": " + ex);
    }
    if (onChainStatus === 'active' || onChainStatus === 'paused' || onChainStatus === 'finished') {
      var localStatus = (campaign.STATUS || '').toLowerCase();
      if (localStatus === 'finished' && onChainStatus !== 'finished') {
        MDS.log("[DISCOVERY] ignoring on-chain status " + onChainStatus + " for finished campaign: " + campaignId);
      } else if (onChainStatus !== localStatus) {
        MDS.log("[DISCOVERY] on-chain status sync: " + campaignId + " " + localStatus + " -> " + onChainStatus);
        setCampaignStatus(campaignId, onChainStatus, function(stErr) {
          if (stErr) {
            MDS.log("[DISCOVERY] setCampaignStatus failed: " + stErr);
            return;
          }
          signalFE("CAMPAIGN_UPDATED", { campaign_id: campaignId, status: onChainStatus });
        });
      }
    } else {
      MDS.log("[DISCOVERY] unknown on-chain status value '" + onChainStatus + "' for " + campaignId);
    }
  }
}

// Discovery path for a coin whose campaign this node has never seen. There is no
// anchor to compare against yet, so this branch may only ADOPT a campaign the local
// node itself already staged (PENDING_CAMPAIGN_<id>, written by the creator's own FE
// before funding) or ask the network for the campaign data. It never writes
// CREATOR_MX_<id>, never touches STATUS and never touches an existing row.
function _processUnknownCampaignCoin(coin, coinId, campaignId, states, creatorPkRoute, creatorMxAddr) {
  MDS.keypair.get("PENDING_CAMPAIGN_" + campaignId, function(kpRes) {
    var val = kpRes && kpRes.status ? kpRes.value : "";
    MDS.log("[DISCOVERY] keypair check for " + campaignId + ": found=" + (val ? "YES" : "NO"));
    if (val) {
      var data;
      try { data = JSON.parse(val); } catch (ex) {
        MDS.log("[DISCOVERY] keypair parse failed for: " + campaignId);
        return;
      }
      // OPEN-4 genesis binding — this is where the whole lineage is anchored, so it
      // must not adopt just any coin carrying the right STATE(3). Require the coin to
      // carry the escrow wallet key the pending campaign was built for (STATE(1),
      // frozen at coin creation and enforced by the script's SIGNEDBY(creatorkey))
      // and to actually hold the funded budget. A dust coin racing the real funding
      // tx would otherwise become the campaign's permanent anchor.
      var onChainWalletPk = (getStateVar(states, 1) || '');
      var expectedWalletPk = (data.campaign && data.campaign.escrow_wallet_pk) ? data.campaign.escrow_wallet_pk : '';
      if (!onChainWalletPk || !expectedWalletPk
          || onChainWalletPk.toUpperCase() !== expectedWalletPk.toUpperCase()) {
        MDS.log("[DISCOVERY] genesis binding failed (STATE(1) != escrow_wallet_pk) — not adopting coin "
          + coinId + " for: " + campaignId);
        return;
      }
      var coinAmount = parseFloat(coin.amount);
      var funded = parseFloat(data.campaign.budget_total);
      if (!isFinite(coinAmount) || !isFinite(funded) || coinAmount < funded) {
        MDS.log("[DISCOVERY] genesis binding failed (amount " + coin.amount + " < budget_total "
          + funded + ") — not adopting coin " + coinId + " for: " + campaignId);
        return;
      }
      data.campaign.escrow_coinid = coin.coinid;
      MDS.log("[DISCOVERY] found pending campaign in keypair, saving: " + campaignId);
      saveCampaign(data.campaign, data.ad, function(saveErr) {
        if (saveErr) {
          MDS.log("[DISCOVERY] saveCampaign failed: " + saveErr);
          return;
        }
        MDS.log("[DISCOVERY] pending campaign saved: " + campaignId);
        signalFE("NEW_CAMPAIGN", { campaign_id: campaignId });
        MDS.keypair.set("PENDING_CAMPAIGN_" + campaignId, "", function() {});
      });
      return;
    }

    // Rate-limit retries: send at most once every 30 s per campaign.
    // _pendingCampaignRequests is a global map defined in service.js.
    var now = Date.now();
    var lastSent = (_pendingCampaignRequests && _pendingCampaignRequests[campaignId]) ? _pendingCampaignRequests[campaignId] : 0;
    if (now - lastSent < 30000) {
      MDS.log("[DISCOVERY] REQUEST_CAMPAIGN_DATA rate-limited for: " + campaignId + " (retry in " + Math.round((30000 - (now - lastSent)) / 1000) + "s)");
      return;
    }
    if (_pendingCampaignRequests) { _pendingCampaignRequests[campaignId] = now; }
    _sendRequestCampaignData(campaignId, creatorPkRoute, creatorMxAddr, function(ok) {
      MDS.log("[DISCOVERY] REQUEST_CAMPAIGN_DATA sent for: " + campaignId + " ok: " + ok);
      if (!ok) {
        if (_pendingCampaignRequests) { _pendingCampaignRequests[campaignId] = 0; }
      }
    });
  });
}

// Receives a REQUEST_CAMPAIGN_DATA from a viewer node.
// Looks up the campaign locally and sends a CAMPAIGN_DATA_RESPONSE.
function handleRequestCampaignData(payload) {
  if (!payload.campaign_id || !payload.requester_mx) {
    MDS.log("[CAMPAIGN] REQUEST_CAMPAIGN_DATA missing fields");
    return;
  }
  var campaignId   = payload.campaign_id;
  var requesterMx  = payload.requester_mx;

  var rateKey = campaignId + '|' + requesterMx;

  getCampaign(campaignId, function(err, campaign) {
    if (err || !campaign) {
      MDS.log("[CAMPAIGN] REQUEST for unknown campaign: " + campaignId);
      return;
    }
    var cooldown = (campaign.COOLDOWN_MS !== null && campaign.COOLDOWN_MS !== undefined)
      ? parseInt(campaign.COOLDOWN_MS, 10) : LIMITS.COOLDOWN_BETWEEN_REWARDS_MS;
    var now = Date.now();
    var lastSent = _responseSentAt[rateKey] || 0;
    if (now - lastSent < cooldown) {
      MDS.log("[CAMPAIGN] RESPONSE rate-limited for: " + campaignId + " requester: " + requesterMx.substring(0, 20) + "...");
      return;
    }
    _responseSentAt[rateKey] = now;
    sqlQuery(
      "SELECT * FROM ADS WHERE UPPER(CAMPAIGN_ID) = UPPER('" + escapeSql(campaignId) + "') LIMIT 1",
      function(err2, rows) {
        if (err2 || !rows || rows.length === 0) {
          MDS.log("[CAMPAIGN] REQUEST: no ad for campaign: " + campaignId);
          return;
        }
        var r = rows[0];
        var ad = {
          id: r.ID,
          campaign_id: r.CAMPAIGN_ID,
          title: r.TITLE,
          body: r.BODY,
          cta_label: r.CTA_LABEL,
          cta_url: r.CTA_URL,
          interests: r.INTERESTS,
          image_data: r.IMAGE_DATA || null,
          show_title: (r.SHOW_TITLE !== null && r.SHOW_TITLE !== undefined) ? parseInt(r.SHOW_TITLE, 10) : 1,
          show_body:  (r.SHOW_BODY !== null && r.SHOW_BODY !== undefined) ? parseInt(r.SHOW_BODY, 10) : 1,
          show_cta:   (r.SHOW_CTA !== null && r.SHOW_CTA !== undefined) ? parseInt(r.SHOW_CTA, 10) : 1,
          bg_color:       r.BG_COLOR       || '#ffffff',
          text_color:     r.TEXT_COLOR     || '#111111',
          image_position:  r.IMAGE_POSITION || 'center',
          image_zoom:      (r.IMAGE_ZOOM !== null && r.IMAGE_ZOOM !== undefined) ? parseFloat(r.IMAGE_ZOOM) : 1.0,
          image_width_pct: (r.IMAGE_WIDTH_PCT !== null && r.IMAGE_WIDTH_PCT !== undefined) ? parseInt(r.IMAGE_WIDTH_PCT, 10) : 40
        };
        var c = campaign;
        var campaignObj = {
          id: c.ID,
          creator_address: c.CREATOR_ADDRESS,
          title: c.TITLE,
          budget_total: parseFloat(c.BUDGET_TOTAL),
          budget_remaining: parseFloat(c.BUDGET_REMAINING),
          reward_view: parseFloat(c.REWARD_VIEW),
          reward_click: parseFloat(c.REWARD_CLICK),
          status: c.STATUS,
          created_at: parseInt(c.CREATED_AT),
          expires_at: (c.EXPIRES_AT !== null && c.EXPIRES_AT !== undefined) ? parseInt(c.EXPIRES_AT) : null,
          // OPEN-4 — the escrow anchor must travel with the campaign data.
          // CAMPAIGN_DATA_RESPONSE is the ONLY way a remote node ever learns a
          // campaign (nothing in the codebase sends CAMPAIGN_ANNOUNCE), and since
          // processEscrowCoin now refuses to act on any coin that is not on the
          // campaign's escrow lineage, a row discovered without an anchor could never
          // acquire one. Omitting these two columns used to be harmless only because
          // the unauthenticated budget-sync wrote ESCROW_COINID itself — which is
          // exactly the hole OPEN-4 closes. Both fields are protected on receipt by
          // the AUD-4 identity pin (handleCampaignAnnounce).
          escrow_coinid: c.ESCROW_COINID || '',
          escrow_wallet_pk: c.ESCROW_WALLET_PK || '',
          max_viewer_reward: (c.MAX_VIEWER_REWARD !== null && c.MAX_VIEWER_REWARD !== undefined) ? parseFloat(c.MAX_VIEWER_REWARD) : null,
          publisher_reward_view: (c.PUBLISHER_REWARD_VIEW !== null && c.PUBLISHER_REWARD_VIEW !== undefined) ? parseFloat(c.PUBLISHER_REWARD_VIEW) : 0,
          max_publisher_budget: (c.MAX_PUBLISHER_BUDGET !== null && c.MAX_PUBLISHER_BUDGET !== undefined) ? parseFloat(c.MAX_PUBLISHER_BUDGET) : 0,
          publisher_budget_spent: (c.PUBLISHER_BUDGET_SPENT !== null && c.PUBLISHER_BUDGET_SPENT !== undefined) ? parseFloat(c.PUBLISHER_BUDGET_SPENT) : 0,
          max_daily_views: (c.MAX_DAILY_VIEWS !== null && c.MAX_DAILY_VIEWS !== undefined) ? parseInt(c.MAX_DAILY_VIEWS, 10) : 100,
          max_daily_clicks: (c.MAX_DAILY_CLICKS !== null && c.MAX_DAILY_CLICKS !== undefined) ? parseInt(c.MAX_DAILY_CLICKS, 10) : 100,
          cooldown_ms: (c.COOLDOWN_MS !== null && c.COOLDOWN_MS !== undefined) ? parseInt(c.COOLDOWN_MS, 10) : 300000
        };
        var response = {
          type: "CAMPAIGN_DATA_RESPONSE",
          campaign: campaignObj,
          ad: ad,
          max_viewer_reward: campaignObj.max_viewer_reward,
          max_daily_views: campaignObj.max_daily_views,
          max_daily_clicks: campaignObj.max_daily_clicks,
          cooldown_ms: campaignObj.cooldown_ms,
          platform_key: (typeof PLATFORM_KEY !== 'undefined' && PLATFORM_KEY) ? PLATFORM_KEY : null
        };
        // Fix D: route response via PK if viewer sent a permanent route as requester_mx.
        var respPk = null;
        var respMx = requesterMx;
        if (requesterMx && requesterMx.indexOf("MAX#") === 0) {
          var rParts = requesterMx.split("#");
          if (rParts.length === 3) {
            var rPk = rParts[1];
            if (rPk.indexOf("Mx") !== 0 && rPk.indexOf("mx") !== 0 && rPk.indexOf("MX") !== 0) {
              respPk = rPk;
              respMx = requesterMx;
            }
          }
        }
        sendMaxima(respPk, respMx, response, function(ok) {
          MDS.log("[CAMPAIGN] CAMPAIGN_DATA_RESPONSE sent for: " + campaignId + " ok: " + ok);
        });
      }
    );
  });
}

// CAMPAIGN_DATA_RESPONSE has the same schema as CAMPAIGN_ANNOUNCE.
// Reuse the same handler. senderPk (msg.data.from) is threaded through so the
// AUD-4 identity gate can tell a response from the real creator apart from a
// crafted one sent by any peer that happens to know the campaign_id.
function handleCampaignDataResponse(payload, senderPk) {
  handleCampaignAnnounce(payload, senderPk);
}

// Called when the user approves or denies a pending send command from the creator flow.
// msg.data: { uid, accept, status, result }
// result.response.body.txn.outputs[0].coinid = escrow coinId
function onPending(msg) {
  var uid     = msg.data.uid;
  var accepted = msg.data.accept;
  var status  = msg.data.status;
  MDS.log("[PENDING] uid: " + uid + " accepted: " + accepted + " status: " + status);

  if (!accepted || !status) {
    MDS.log("[PENDING] denied or failed, uid: " + uid);
    signalFE("CAMPAIGN_PENDING_DENIED", { uid: uid });
    return;
  }

  var coinId = "";
  var campaignId = "";
  try {
    var body = msg.data.result.response.body;
    if (!body || !body.txn || !body.txn.outputs) {
      return;
    }
    coinId = body.txn.outputs[0].coinid;
    var txnState = body.txn.state || [];
    for (var si = 0; si < txnState.length; si++) {
      if (txnState[si].port == 3) { campaignId = hexToUtf8(txnState[si].data); break; }
    }
  } catch (ex) {
    MDS.log("[PENDING] could not extract coinId/campaignId: " + ex);
    return;
  }
  if (!coinId || !campaignId) {
    MDS.log("[PENDING] missing coinId or campaignId");
    return;
  }
  MDS.log("[PENDING] coinId: " + coinId + " campaignId: " + campaignId);

  MDS.keypair.get("PENDING_CAMPAIGN_" + campaignId, function(kpRes) {
    var val = kpRes && kpRes.status ? kpRes.value : "";
    if (!val) {
      MDS.log("[PENDING] no pending campaign data for campaign: " + campaignId);
      return;
    }
    var data;
    try { data = JSON.parse(val); } catch (ex) {
      MDS.log("[PENDING] JSON parse failed: " + ex);
      return;
    }
    var campaign = data.campaign;
    var ad       = data.ad;
    campaign.escrow_coinid = coinId;
    MDS.log("[PENDING] saving campaign: " + campaign.id);
    saveCampaign(campaign, ad, function(err) {
      if (err) {
        MDS.log("[PENDING] saveCampaign failed: " + err);
        return;
      }
      MDS.log("[PENDING] campaign saved: " + campaign.id);
      signalFE("NEW_CAMPAIGN", { campaign_id: campaign.id });
      MDS.keypair.set("PENDING_CAMPAIGN_" + campaign.id, "", function() {});
      _replayPendingPublisherNotify(campaign.id);
    });
  });
}

// skipAutoSettle (optional, default false) — update the local STATUS row and
// signal the FE, but do NOT start channel settlement. Set by handleCampaignFinish
// when the sender could only be verified through the weak CREATOR_ADDRESS
// fallback (audit 2026-07-18 Fix #3). When settlement is skipped the
// CAMPAIGN_UPDATED signal must not carry settling:true either — the FE uses that
// flag to defer its re-render until onCampaignClosed arrives, and no settlement
// events will follow here.
//
// OPEN-3 (2026-09-07) — two separate decisions, previously conflated into one flag:
//
//   isSettling            → does the CAMPAIGN_UPDATED signal carry settling:true?
//                           This is the FE's gate (dapp/app.js
//                           _autoSettleOpenChannels, AUD-5/Fix #12) for a *viewer*
//                           node posting its own settlement tx. Now 'finished'
//                           only: a Pause is not the end of a channel's life, so
//                           it must never escalate to settlement (maintainer
//                           decision, OPEN-3 fix session).
//
//   runCreatorAutoSettle  → does *this node* run autoSettleChannelsForCampaign?
//                           That function marks every local CHANNEL_STATE row for
//                           the campaign as 'settling' and emits
//                           CAMPAIGN_AUTOSETTLE_REQUEST. That is only meaningful on
//                           the creator's own node. Run unconditionally (as before)
//                           it actively broke remote settlement: a viewer node
//                           receiving the status change marked its *own* channel
//                           'settling' before signalling the FE, so the FE's
//                           "WHERE STATUS = 'open'" auto-settle query matched
//                           nothing and the channel stayed stuck forever.
//                           Gated on the local node being the campaign creator
//                           (same Maxima-pk identity space Fix #12 compares in the
//                           FE, .toUpperCase() on both sides).
function applyStatusChange(campaignId, status, skipAutoSettle) {
  setCampaignStatus(campaignId, status, function(err) {
    if (err) {
      MDS.log("[CAMPAIGN] setCampaignStatus(" + status + ") failed: " + err);
      return;
    }
    MDS.log("[CAMPAIGN] status updated to " + status + ", id: " + campaignId);
    getCampaign(campaignId, function(err2, campaign) {
      var budget = (campaign && campaign.BUDGET_REMAINING !== undefined)
        ? parseFloat(campaign.BUDGET_REMAINING)
        : 0;
      var isSettling = (status === 'finished') && !skipAutoSettle;
      var creatorAddr = (campaign && campaign.CREATOR_ADDRESS) ? campaign.CREATOR_ADDRESS : '';
      var isLocalCreator = !!(MY_MAXIMA_PK && creatorAddr
        && MY_MAXIMA_PK.toUpperCase() === creatorAddr.toUpperCase());
      var runCreatorAutoSettle = isSettling && isLocalCreator;
      if (runCreatorAutoSettle) {
        if (typeof autoSettleChannelsForCampaign === 'function') {
          autoSettleChannelsForCampaign(campaignId);
        }
      } else if (isSettling) {
        MDS.log("[CAMPAIGN] settling signalled without local auto-settle (not creator node): " + campaignId);
      }
      var updatePayload = {
        campaign_id: campaignId,
        status: status,
        budget_remaining: budget
      };
      if (isSettling) {
        updatePayload.settling = true;
      }
      signalFE("CAMPAIGN_UPDATED", updatePayload);
    });
  });
}

// OPEN-3 Step B — creator-side fast-path notification to channel counterparties.
//
// Called from service.js onComms on MA_STATUS_PROPAGATE, which the creator's FE
// broadcasts from finalizeStatusUpdate (dapp/app.js) once the on-chain
// status-update tx has actually confirmed. Until this existed, nothing in the
// codebase ever *sent* a CAMPAIGN_PAUSE / CAMPAIGN_FINISH — only the receive-side
// handlers were implemented (see MinimaAds.md §8.5) — so a remote node learned the
// new status exclusively through processEscrowCoin's on-chain reconciliation,
// which calls the bare setCampaignStatus and therefore never set settling:true.
//
// This function only READS and SENDS. It never writes to the DB and never calls
// autoSettleChannelsForCampaign: applying the status (and deciding whether to
// escalate to settlement) is the *receiving* node's job, through the existing
// handleCampaignFinish / handleCampaignPause → _assertCreatorThen →
// applyStatusChange path, which authenticates the sender exactly as before.
//
// Both 'viewer' and 'publisher' role rows are notified — status sync is useful for
// either. Only viewer rows can escalate to settlement, and that exclusion already
// lives on the receive side (dapp/app.js _autoSettleOpenChannels skips
// ROLE='publisher', Fix #12), so no extra role guard is needed here.
//
// Rhino-safe: var, function(), string concat, MDS.log, no trailing commas.
function propagateStatusToChannelPeers(campaignId, status) {
  if (!campaignId || !status) {
    MDS.log("[CAMPAIGN] MA_STATUS_PROPAGATE missing fields");
    return;
  }
  // Same whitelist shape as handleLocalStatusChange. 'active' is deliberately not
  // propagated: CAMPAIGN_RESUME is deprecated as an outbound message
  // (MinimaAds.md §8.5) — resume is on-chain only.
  if (status !== 'paused' && status !== 'finished') {
    MDS.log("[CAMPAIGN] MA_STATUS_PROPAGATE not propagated for status: " + status);
    return;
  }
  getCampaign(campaignId, function(err, campaign) {
    if (err || !campaign) {
      MDS.log("[CAMPAIGN] MA_STATUS_PROPAGATE: campaign not found: " + campaignId);
      return;
    }
    var creatorAddr = campaign.CREATOR_ADDRESS || '';
    if (!MY_MAXIMA_PK || !creatorAddr
        || MY_MAXIMA_PK.toUpperCase() !== creatorAddr.toUpperCase()) {
      // Not our campaign — nothing to propagate. Silent by design: any node may
      // hold a row for a campaign it did not create.
      return;
    }
    var sql = "SELECT VIEWER_KEY, CREATOR_MX, ROLE FROM CHANNEL_STATE" +
      " WHERE UPPER(CAMPAIGN_ID) = UPPER('" + escapeSql(campaignId) + "')" +
      " AND STATUS IN ('open', 'settling')";
    sqlQuery(sql, function(sqlErr, rows) {
      if (sqlErr) {
        MDS.log("[CAMPAIGN] MA_STATUS_PROPAGATE SELECT failed: " + sqlErr);
        return;
      }
      if (!rows || rows.length === 0) {
        MDS.log("[CAMPAIGN] MA_STATUS_PROPAGATE: no channel peers for: " + campaignId);
        return;
      }
      var msgType = (status === 'finished') ? "CAMPAIGN_FINISH" : "CAMPAIGN_PAUSE";
      MDS.log("[CAMPAIGN] MA_STATUS_PROPAGATE: sending " + msgType + " to " + rows.length
        + " channel peer(s) for: " + campaignId);
      for (var i = 0; i < rows.length; i++) {
        (function(row) {
          // On the creator's own node CHANNEL_STATE.VIEWER_KEY is the counterparty's
          // Maxima public key and CREATOR_MX is its route address — the exact pair
          // swBuildAndExportVoucherTx passes to sendMaxima for REWARD_VOUCHER.
          var peerPk = row.VIEWER_KEY || '';
          var peerMx = row.CREATOR_MX || '';
          if (!peerPk && !peerMx) { return; }
          var payload = {
            type:        msgType,
            campaign_id: campaignId
          };
          sendMaxima(peerPk, peerMx, payload, function(ok) {
            MDS.log("[CAMPAIGN] " + msgType + " sent to " + (row.ROLE || 'viewer')
              + " peer ok=" + ok + " campaign=" + campaignId);
          });
        })(rows[i]);
      }
    });
  });
}

// CREATOR_LIVENESS_PING — received on creator's node from a viewer SDK.
// Responds with CREATOR_LIVENESS_PONG including the current campaign status.
// If EXPIRES_AT has passed, reports 'finished' regardless of DB STATUS.
// MinimaAds.md §8.14. Rhino-safe: var, function(), no arrows, no template literals.
function handleCreatorLivenessPing(payload, senderPk) {
  if (!senderPk) {
    MDS.log("[LIVENESS] PING missing senderPk — ignoring");
    return;
  }
  var campaignId = payload.campaign_id || '';
  var viewerMx   = payload.viewer_mx   || null;
  MDS.log("[LIVENESS] PING from " + senderPk.substring(0, 10) + "...");
  if (!campaignId) {
    var pong = {type: "CREATOR_LIVENESS_PONG", campaign_id: ''};
    sendMaxima(senderPk, viewerMx, pong, function(ok) {
      MDS.log("[LIVENESS] PONG sent ok:" + (ok ? "true" : "false"));
    });
    return;
  }
  getCampaign(campaignId, function(err, campaign) {
    var status = '';
    if (!err && campaign) {
      var now = Date.now();
      var expiresAt = (campaign.EXPIRES_AT !== null && campaign.EXPIRES_AT !== undefined && campaign.EXPIRES_AT !== '')
        ? parseInt(campaign.EXPIRES_AT, 10) : 0;
      if (expiresAt > 0 && now > expiresAt) {
        status = 'finished';
      } else {
        status = campaign.STATUS || '';
      }
    }
    var pong2 = {type: "CREATOR_LIVENESS_PONG", campaign_id: campaignId, status: status};
    sendMaxima(senderPk, viewerMx, pong2, function(ok2) {
      MDS.log("[LIVENESS] PONG sent ok:" + (ok2 ? "true" : "false") + " status:" + status);
    });
  });
}

// ---------------------------------------------------------------------------
// checkCampaignStatuses — called periodically from NEWBLOCK (throttled).
// For each locally-active campaign that has NO open viewer channel, sends a
// CREATOR_LIVENESS_PING to the creator. The reply (CREATOR_LIVENESS_PONG via
// handleCreatorLivenessPong) syncs the local status if the creator has paused
// or finished the campaign. Includes viewer_mx so the creator can route the
// PONG back even if the viewer is not in the creator's Maxima contacts.
// Rhino-safe: var, function(), string concat, MDS.log, no trailing commas.
// ---------------------------------------------------------------------------
function checkCampaignStatuses() {
  // Issue 3 fix: removed the NOT EXISTS (open viewer channel) exclusion.
  // Viewers with open channels are exactly the ones that need to ping the creator
  // to detect 'finished' status. After the creator finishes and auto-settle posts
  // L1 txs, the viewer's channel transitions to 'settling'; the ping delivers the
  // 'finished' PONG which triggers CAMPAIGN_UPDATED so the UI refreshes.
  // OPEN-3 Step C: also ping for any campaign this node still holds an OPEN channel
  // on, whatever the local CAMPAIGNS.STATUS says. Without this, the on-chain
  // reconciliation flipping the local row to 'finished' first (it usually wins the
  // race) permanently stops the ping loop for exactly the campaigns that still need
  // an answer — the channel is open, unsettled, and the PONG escalation in
  // handleCreatorLivenessPong is what would settle it.
  var sql = "SELECT DISTINCT c.ID, c.CREATOR_ADDRESS FROM CAMPAIGNS c" +
    " WHERE c.STATUS = 'active'" +
    " OR EXISTS (SELECT 1 FROM CHANNEL_STATE ch" +
    " WHERE UPPER(ch.CAMPAIGN_ID) = UPPER(c.ID) AND ch.STATUS = 'open')";
  sqlQuery(sql, function(err, rows) {
    if (err || !rows || rows.length === 0) { return; }
    for (var i = 0; i < rows.length; i++) {
      (function(row) {
        var campaignId = row.ID;
        var creatorPk  = row.CREATOR_ADDRESS || '';
        MDS.keypair.get("CREATOR_MX_" + campaignId, function(kpRes) {
          var _cmxRaw = (kpRes && kpRes.status && kpRes.value) ? kpRes.value : null;
          var creatorMx = (_cmxRaw && (_cmxRaw.indexOf("Mx") === 0 || _cmxRaw.indexOf("MAX#") === 0)) ? _cmxRaw : null;
          if (!creatorPk && !creatorMx) { return; }
          var ping = {
            type:        "CREATOR_LIVENESS_PING",
            campaign_id: campaignId,
            viewer_mx:   MY_MX_ADDRESS
          };
          sendMaxima(creatorPk, creatorMx, ping, function(ok) {
            MDS.log("[LIVENESS] auto-ping campaign: " + campaignId + " ok=" + ok);
          });
        });
      })(rows[i]);
    }
  });
}

// CREATOR_LIVENESS_PONG — received on viewer's node from the creator.
// Syncs the local campaign STATUS from the creator's authoritative value,
// then signals the FE so the SDK can resolve the pending liveness check.
// MinimaAds.md §8.15. Rhino-safe: var, function(), no arrows, no template literals.
function handleCreatorLivenessPong(payload, senderPk) {
  var campaignId = payload.campaign_id || '';
  var status = payload.status || '';
  MDS.log("[LIVENESS] PONG received for campaign: " + campaignId + " status: " + status);

  // Always relay to the FE so the SDK's pending-liveness check resolves. This
  // signal only feeds an in-memory cache (never a DB write), so it is harmless
  // to forward regardless of sender — the authenticated part is the DB write below.
  signalFE("CREATOR_LIVENESS_PONG", {campaign_id: campaignId, status: status});

  // Audit 2026-09-05 #3 — the local STATUS write must be authenticated. Without
  // this any peer could send a PONG with status:'finished' and permanently kill
  // a campaign on the victim node (the ping loop only re-pings STATUS='active'
  // rows, and processEscrowCoin's terminal-state guard #46 refuses to revert
  // 'finished'). Whitelist the status and require the Maxima sender to match the
  // campaign creator via _assertCreatorThen (same file) — which fails CLOSED
  // when the sender is not the creator or no creator identity is known locally.
  if (!campaignId || !status) { return; }
  if (status !== 'active' && status !== 'paused' && status !== 'finished') {
    MDS.log("[LIVENESS] PONG dropped: invalid status '" + status + "' campaign=" + campaignId);
    return;
  }
  _assertCreatorThen(campaignId, senderPk, function(strongSender) {
    // OPEN-3 Step C — a PONG from a *strongly* verified creator (permanent route
    // MAX#<pk>#<mls>, from CAMPAIGNS.CREATOR_MX or the on-chain escrow STATE(4)
    // cache — neither settable by a payload) reporting 'finished' is exactly the
    // trust level handleCampaignFinish requires for the full fast-path, so it gets
    // the full applyStatusChange rather than the bare DB write below. That is what
    // puts settling:true on the CAMPAIGN_UPDATED signal and lets a remote viewer's
    // FE actually settle its open channel.
    //
    // Deliberately NOT gated on campaign.STATUS !== status: the on-chain
    // reconciliation (processEscrowCoin → setCampaignStatus) frequently wins the
    // race and flips the local row to 'finished' first; a "!=" guard here would
    // then skip the escalation and the channel would stay open forever — the exact
    // OPEN-3 failure mode. applyStatusChange is idempotent (setCampaignStatus is a
    // plain UPDATE) so re-running it is safe.
    //
    // 'paused' deliberately does not escalate (maintainer decision, OPEN-3): a
    // paused campaign may still resume, so its channels must stay open.
    // Weak/fallback-verified senders keep the pre-existing non-escalating write.
    if (strongSender && status === 'finished') {
      MDS.log("[LIVENESS] PONG from strongly-verified creator reports finished — applying full status change: " + campaignId);
      applyStatusChange(campaignId, 'finished');
      return;
    }
    getCampaign(campaignId, function(err, campaign) {
      if (!err && campaign && campaign.STATUS !== status) {
        setCampaignStatus(campaignId, status, function(err2) {
          if (!err2) {
            MDS.log("[LIVENESS] local campaign status synced: " + campaignId + " -> " + status);
            signalFE("CAMPAIGN_UPDATED", {campaign_id: campaignId, status: status});
          }
        });
      }
    });
  });
}

// MA_LOCAL_STATUS — sent by the creator's FE (mycampaigns.js) via MDS.comms.broadcast.
// Updates the campaign STATUS on the creator's own SW DB without needing Maxima.
// Valid statuses: 'active', 'paused', 'finished'.
// Rhino-safe: var, function(), no arrows, no template literals.
function handleLocalStatusChange(payload) {
  if (!payload.campaign_id || !payload.status) {
    MDS.log("[CAMPAIGN] MA_LOCAL_STATUS missing fields");
    return;
  }
  var s = payload.status;
  if (s !== 'active' && s !== 'paused' && s !== 'finished') {
    MDS.log("[CAMPAIGN] MA_LOCAL_STATUS invalid status: " + s);
    return;
  }
  applyStatusChange(payload.campaign_id, s);
}

// checkExpiredCampaigns — called on every NEWBLOCK from service.js with the new
// chain tip height (msg.data.txpow.header.block).
//
// Audit 2026-07-18 Fix #8 — expiry is block-based, not wall-clock.
// CAMPAIGNS.EXPIRES_AT is only an estimate computed at creation time from a block
// count; the authoritative deadline is the escrow coin's state port 2 (expiry
// block — MinimaAds.md Appendix B.3), which is what the creator actually funded.
// Clock skew between nodes and block-time variance make the ms value drift from
// the chain, and 'finished' is terminal (KNOWN_ISSUES #46) — an early ms-based
// expiry permanently kills a still-funded campaign on that node. So:
//   - escrow coin readable with a port-2 expiry → finish only when
//     currentBlock >= expiryBlock (the chain is authoritative);
//   - escrow coin absent/spent/settled, or carrying no port 2 → fall back to the
//     ms comparison, but only well past EXPIRES_AT (safety margin below).
// Only runs on the local node — other nodes learn the status via the liveness ping.
// Rhino-safe: var, function(), no arrows, no template literals.

// Escrow-coin lookups are limited to campaigns expiring no more than this far in
// the future, so a node tracking many active campaigns does not issue one coin
// lookup per campaign on every NEWBLOCK. Campaigns already past EXPIRES_AT are
// always included — those are exactly the ones needing the on-chain check.
var EXPIRY_LOOKUP_WINDOW_MS = 172800000;   // 48 h

// Wall-clock fallback path only: extra grace on top of EXPIRES_AT before a
// campaign whose on-chain expiry cannot be read is finished. Absorbs clock skew
// between the creator's node (which computed EXPIRES_AT) and this one.
var EXPIRY_FALLBACK_MARGIN_MS = 86400000;  // 24 h

function checkExpiredCampaigns(currentBlock) {
  var blockNum = parseInt(currentBlock, 10);
  if (!isFinite(blockNum) || blockNum <= 0) { blockNum = 0; }
  var now = Date.now();
  sqlQuery(
    "SELECT ID, ESCROW_COINID, EXPIRES_AT FROM CAMPAIGNS" +
    " WHERE STATUS = 'active' AND EXPIRES_AT IS NOT NULL" +
    " AND EXPIRES_AT < " + (now + EXPIRY_LOOKUP_WINDOW_MS),
    function(err, rows) {
      if (err || !rows || rows.length === 0) { return; }
      for (var i = 0; i < rows.length; i++) {
        _checkCampaignExpiry(rows[i], blockNum, now);
      }
    }
  );
}

// One candidate row. Prefers the on-chain deadline; falls back to wall clock only
// when no escrow expiry can be read.
function _checkCampaignExpiry(row, currentBlock, now) {
  var campaignId = row.ID;
  var expiresAt  = (row.EXPIRES_AT !== null && row.EXPIRES_AT !== undefined && row.EXPIRES_AT !== '')
    ? parseInt(row.EXPIRES_AT, 10) : 0;
  var coinId     = row.ESCROW_COINID || '';

  // ESCROW_COINID can originate from a Maxima payload (CAMPAIGN_ANNOUNCE), so it
  // is interpolated into an MDS command only when it looks like a real coin id.
  if (!isHexKey(coinId)) {
    _expireByWallClock(campaignId, expiresAt, now);
    return;
  }

  // No relevant: param — see fragility #28 / Fix #6: any presence of relevant:
  // is read as true and restricts the search to this wallet's own coins, which
  // would hide a remote creator's escrow coin.
  MDS.cmd("coins coinid:" + coinId, function(res) {
    var coin = (res && res.status && res.response && res.response.length > 0) ? res.response[0] : null;
    if (!coin) {
      // Escrow already spent, settled or reclaimed — no on-chain deadline left.
      MDS.log("[CAMPAIGN] expiry check: escrow coin not found for " + campaignId + " — wall-clock fallback");
      _expireByWallClock(campaignId, expiresAt, now);
      return;
    }
    var expiryBlock = parseInt(getStateVar(coin.state || [], 2), 10);
    if (!isFinite(expiryBlock) || expiryBlock <= 0) {
      MDS.log("[CAMPAIGN] expiry check: no state port 2 on escrow coin for " + campaignId + " — wall-clock fallback");
      _expireByWallClock(campaignId, expiresAt, now);
      return;
    }
    if (currentBlock <= 0) {
      // Block height unknown this round — never guess, wait for the next NEWBLOCK.
      MDS.log("[CAMPAIGN] expiry check: current block unknown for " + campaignId + " — deferring");
      return;
    }
    MDS.log("[CAMPAIGN] expiry check: block " + currentBlock + " vs escrow expiry " + expiryBlock);
    if (currentBlock >= expiryBlock) {
      MDS.log("[CAMPAIGN] escrow expiry block reached, finishing: " + campaignId);
      applyStatusChange(campaignId, 'finished');
    }
  });
}

// Fallback path — only reached when the on-chain expiry is unreadable. Requires
// EXPIRES_AT to be past by EXPIRY_FALLBACK_MARGIN_MS before finishing.
function _expireByWallClock(campaignId, expiresAt, now) {
  if (expiresAt <= 0) { return; }
  if (now <= expiresAt + EXPIRY_FALLBACK_MARGIN_MS) { return; }
  MDS.log("[CAMPAIGN] expiry check: EXPIRES_AT + margin passed, finishing: " + campaignId);
  applyStatusChange(campaignId, 'finished');
}

// Server-side rate-limit for CAMPAIGN_DATA_RESPONSE (bug #14).
// Key: campaignId + '|' + requesterMx. Value: timestamp of last response sent.
// Cooldown uses campaign.COOLDOWN_MS (creator-defined), fallback LIMITS.COOLDOWN_BETWEEN_REWARDS_MS.
// Prevents a malicious peer from flooding the creator with unauthenticated
// REQUEST_CAMPAIGN_DATA messages to trigger repeated ADS queries + Maxima sends.
var _responseSentAt = {};

// N2-5: Throttled prune of DEDUP_LOG — at most once every 6 hours per SW session.
// Deletes rows older than 7 days. Prevents unbounded table growth without affecting
// dedup correctness (no reward event can replay after 7 days).
var _lastDedupPruneAt = 0;
function pruneDedupLog() {
  var now = Date.now();
  var SIX_HOURS_MS = 21600000;
  if (now - _lastDedupPruneAt < SIX_HOURS_MS) { return; }
  _lastDedupPruneAt = now;
  var cutoff = now - 604800000;
  sqlQuery("DELETE FROM DEDUP_LOG WHERE LOGGED_AT < " + cutoff, function(err) {
    if (err) { MDS.log("[CAMPAIGN] pruneDedupLog: failed — " + err); return; }
    MDS.log("[CAMPAIGN] pruneDedupLog: pruned DEDUP_LOG rows older than 7 days");
  });
}

// ---------------------------------------------------------------------------
// PROFILE_REQUEST — received on creator's node from a viewer FE.
// Reads own Maxima name and icon, responds with PROFILE_RESPONSE (poll:false).
// MinimaAds.md §8.17. Rhino-safe: var, function(), no arrows, no template literals.
// ---------------------------------------------------------------------------
function handleProfileRequest(payload, senderPk) {
  if (!senderPk) {
    MDS.log("[PROFILE] REQUEST missing senderPk — ignoring");
    return;
  }
  // requester_mx lets us route the response via to: when viewer is not in our contacts
  var requesterMx = payload.requester_mx || null;
  MDS.log("[PROFILE] REQUEST from " + senderPk.substring(0, 10) + "...");
  MDS.cmd("maxima action:info", function(res) {
    if (!res.status || !res.response) {
      MDS.log("[PROFILE] maxima action:info failed — cannot respond");
      return;
    }
    var name = res.response.name || "";
    var rawIcon = (res.response.icon && res.response.icon !== "0x00") ? res.response.icon : "";
    // The icon is stored URL-encoded (set via encodeURIComponent in profile.js).
    // Decode it so the viewer can use it directly as img.src.
    var icon = "";
    if (rawIcon) {
      try { icon = decodeURIComponent(rawIcon); } catch (e) { icon = rawIcon; }
    }
    MDS.log("[PROFILE] name:" + name + " icon:" + (icon ? "yes(" + icon.length + "b)" : "none"));
    var response = {
      type: "PROFILE_RESPONSE",
      publickey: MY_MAXIMA_PK,
      name: name,
      icon: icon
    };
    sendMaxima(senderPk, requesterMx, response, function(ok) {
      MDS.log("[PROFILE] RESPONSE sent ok:" + (ok ? "true" : "false"));
    });
  });
}

// ---------------------------------------------------------------------------
// PROFILE_RESPONSE — received on viewer's node after a PROFILE_REQUEST.
// Caches full profile (including large icon) to keypair, then signals FE with
// only publickey + name to avoid MDS.comms.solo size limits on large icons.
// FE reads the icon from keypair when applying the profile to the DOM.
// MinimaAds.md §8.18. Rhino-safe: var, function(), no arrows, no template literals.
// ---------------------------------------------------------------------------
function handleProfileResponse(payload) {
  if (!payload.publickey) {
    MDS.log("[PROFILE] RESPONSE missing publickey — ignoring");
    return;
  }
  var pk = payload.publickey.toUpperCase();
  MDS.log("[PROFILE] RESPONSE received from " + pk.substring(0, 10) + "...");
  var profileStr = JSON.stringify({name: payload.name || "", icon: payload.icon || ""});
  // Cache full profile in keypair; signal FE with name only (icon read from keypair by FE)
  MDS.keypair.set("CREATOR_PROFILE_" + pk, profileStr, function() {
    signalFE("PROFILE_RECEIVED", {publickey: pk, name: payload.name || ""});
  });
}
