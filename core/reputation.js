// T-REP1 — Core: reputation.js
// First-party reputation evidence: append-only REPUTATION_EVENTS log +
// derived PEER_REPUTATION cache. No UI, no on-chain evidence, no Maxima
// messages — MinimaAds.md §7.8. Rhino-compatible: var only, no arrow
// functions, no template literals, no trailing commas.
//
// Invariant R1 (MinimaAds.md §7.8): a reputation weight can never derive
// from an inbound Maxima payload field. Every call to recordReputationEvent
// must originate from this node's own verified observation (a channel this
// node settled after confirming the on-chain spend) — never from data a
// remote peer merely claims. This is what makes "self-granted reputation"
// structurally impossible rather than something callers have to remember.
//
// Reputation is local and non-transferable: node A and node B may score the
// same subject differently, and that is correct — each scores its own
// experience, not a shared consensus value.

// ---------------------------------------------------------------------------
// recordReputationEvent — the only write path into REPUTATION_EVENTS.
// evidence: { subject_key, subject_role, kind, scope_id, source, weight, observed_at }
// scope_id/source/observed_at are optional (default '', 'local', Date.now()).
// The row ID is fully deterministic from (kind, role, subject_key, scope_id)
// so recording the same observation twice (e.g. a retried settlement check)
// is a harmless idempotent overwrite, never a duplicate.
// ---------------------------------------------------------------------------
function recordReputationEvent(evidence, cb) {
  if (!evidence || !evidence.subject_key || !evidence.subject_role || !evidence.kind) {
    if (cb) { cb("recordReputationEvent: missing subject_key/subject_role/kind"); }
    return;
  }
  var subjectKey  = evidence.subject_key.toUpperCase();
  var subjectRole = evidence.subject_role;
  var kind        = evidence.kind;
  var scopeId     = evidence.scope_id || '';
  var source      = evidence.source || 'local';
  var weight      = parseFloat(evidence.weight);
  if (!isFinite(weight)) { weight = 0; }
  var observedAt  = parseInt(evidence.observed_at, 10);
  if (!isFinite(observedAt) || observedAt <= 0) { observedAt = Date.now(); }
  var id = kind + ':' + subjectRole + ':' + subjectKey + ':' + scopeId;

  var sql = "MERGE INTO REPUTATION_EVENTS" +
    " (ID, SUBJECT_KEY, SUBJECT_ROLE, KIND, WEIGHT, SCOPE_ID, SOURCE, OBSERVED_AT)" +
    " KEY (ID) VALUES (" +
    "'" + escapeSql(id) + "'," +
    "'" + escapeSql(subjectKey) + "'," +
    "'" + escapeSql(subjectRole) + "'," +
    "'" + escapeSql(kind) + "'," +
    weight + "," +
    "'" + escapeSql(scopeId) + "'," +
    "'" + escapeSql(source) + "'," +
    observedAt +
    ")";
  sqlQuery(sql, function(err) {
    if (err) { if (cb) { cb(err); } return; }
    recomputeReputation(subjectKey, subjectRole, cb);
  });
}

// ---------------------------------------------------------------------------
// recomputeReputation — rebuilds the PEER_REPUTATION cache row for one
// (subject_key, subject_role) from its full REPUTATION_EVENTS history.
// Safe to call any time; PEER_REPUTATION holds nothing that isn't
// reconstructible from REPUTATION_EVENTS.
// ---------------------------------------------------------------------------
function recomputeReputation(subjectKey, subjectRole, cb) {
  var sk = subjectKey.toUpperCase();
  var sql = "SELECT * FROM REPUTATION_EVENTS" +
    " WHERE UPPER(SUBJECT_KEY) = UPPER('" + escapeSql(sk) + "')" +
    " AND SUBJECT_ROLE = '" + escapeSql(subjectRole) + "'";
  sqlQuery(sql, function(err, rows) {
    if (err) { if (cb) { cb(err); } return; }
    var result = _scoreFromEvidence(rows || []);
    var now = Date.now();
    var mergeSql = "MERGE INTO PEER_REPUTATION" +
      " (SUBJECT_KEY, SUBJECT_ROLE, SCORE, TIER, EV_POSITIVE, EV_NEGATIVE, FIRST_SEEN_AT, LAST_CALC_AT)" +
      " KEY (SUBJECT_KEY, SUBJECT_ROLE) VALUES (" +
      "'" + escapeSql(sk) + "'," +
      "'" + escapeSql(subjectRole) + "'," +
      result.score + "," +
      "'" + escapeSql(result.tier) + "'," +
      result.evPositive + "," +
      result.evNegative + "," +
      result.firstSeenAt + "," +
      now +
      ")";
    sqlQuery(mergeSql, function(err2) {
      if (err2) { if (cb) { cb(err2); } return; }
      if (cb) { cb(null, result); }
    });
  });
}

// ---------------------------------------------------------------------------
// getReputation — reads the cached score. Returns a default 'unknown' shape
// (never touches the DB for the default) when nothing has been recorded yet.
// ---------------------------------------------------------------------------
function getReputation(subjectKey, subjectRole, cb) {
  var sk = subjectKey.toUpperCase();
  var sql = "SELECT * FROM PEER_REPUTATION" +
    " WHERE UPPER(SUBJECT_KEY) = UPPER('" + escapeSql(sk) + "')" +
    " AND SUBJECT_ROLE = '" + escapeSql(subjectRole) + "'";
  sqlQuery(sql, function(err, rows) {
    if (err) { cb(err); return; }
    if (rows && rows.length > 0) {
      cb(null, rows[0]);
    } else {
      cb(null, {
        SUBJECT_KEY: sk, SUBJECT_ROLE: subjectRole, SCORE: 0, TIER: 'unknown',
        EV_POSITIVE: 0, EV_NEGATIVE: 0, FIRST_SEEN_AT: null, LAST_CALC_AT: null
      });
    }
  });
}

// listReputationEvidence — raw evidence rows, most recent first. For devtools
// inspection ("why does this score say what it says"); no UI consumes it yet.
function listReputationEvidence(subjectKey, subjectRole, cb) {
  var sk = subjectKey.toUpperCase();
  var sql = "SELECT * FROM REPUTATION_EVENTS" +
    " WHERE UPPER(SUBJECT_KEY) = UPPER('" + escapeSql(sk) + "')" +
    " AND SUBJECT_ROLE = '" + escapeSql(subjectRole) + "'" +
    " ORDER BY OBSERVED_AT DESC";
  sqlQuery(sql, function(err, rows) {
    if (err) { cb(err); return; }
    cb(null, rows || []);
  });
}

// ---------------------------------------------------------------------------
// _scoreFromEvidence — pure function, no I/O. Exponential time-decay per
// row, summed per KIND and capped per KIND (REPUTATION.CAP_*) before adding
// to the total, so no single kind of evidence can dominate or be farmed by
// repeating cheap observations. A small age bonus rewards a long-observed
// identity regardless of evidence kind. Clamped to [-100, 100].
// ---------------------------------------------------------------------------
function _scoreFromEvidence(rows) {
  var now = Date.now();
  var perKindSum = {};
  var evPositive = 0;
  var evNegative = 0;
  var firstSeenAt = null;
  var hasHardNegative = false;
  var i, row, weight, kind, observedAt, age, decay;

  for (i = 0; i < rows.length; i++) {
    row = rows[i];
    weight = parseFloat(row.WEIGHT);
    if (!isFinite(weight)) { weight = 0; }
    kind = row.KIND;
    observedAt = parseInt(row.OBSERVED_AT, 10);
    if (!isFinite(observedAt)) { observedAt = now; }
    if (firstSeenAt === null || observedAt < firstSeenAt) { firstSeenAt = observedAt; }
    age = now - observedAt;
    if (age < 0) { age = 0; }
    decay = Math.pow(0.5, age / REPUTATION.HALFLIFE_MS);
    if (!perKindSum.hasOwnProperty(kind)) { perKindSum[kind] = 0; }
    perKindSum[kind] += weight * decay;
    if (weight > 0) { evPositive++; } else if (weight < 0) { evNegative++; }
    if (REPUTATION.HARD_NEGATIVE_KINDS.indexOf(kind) !== -1) { hasHardNegative = true; }
  }

  var total = 0;
  var k, sum, cap;
  for (k in perKindSum) {
    if (!perKindSum.hasOwnProperty(k)) { continue; }
    sum = perKindSum[k];
    cap = REPUTATION.CAP_BY_KIND[k] || REPUTATION.CAP_DEFAULT;
    if (sum > cap) { sum = cap; }
    if (sum < -cap) { sum = -cap; }
    total += sum;
  }

  if (firstSeenAt !== null) {
    var ageMs = now - firstSeenAt;
    var ageFrac = ageMs / REPUTATION.ACCOUNT_AGE_FULL_MS;
    if (ageFrac > 1) { ageFrac = 1; }
    total += REPUTATION.WEIGHT_ACCOUNT_AGE_CAP * ageFrac;
  } else {
    firstSeenAt = now;
  }

  if (total > 100) { total = 100; }
  if (total < -100) { total = -100; }

  return {
    score: total,
    tier: _tierFromScore(total, evPositive, evNegative, firstSeenAt, hasHardNegative),
    evPositive: evPositive,
    evNegative: evNegative,
    firstSeenAt: firstSeenAt
  };
}

// _tierFromScore — 'unknown' (no evidence at all) is deliberately distinct
// from 'new' (some evidence, not enough score/age yet) per MinimaAds.md §7.8
// — a fresh identity must never render as indistinguishable from a
// track-recorded one just because its score also starts near zero.
// 'flagged' overrides every other tier: either a single occurrence of a hard
// negative kind (proof of an active spoofing/impersonation attempt, T-REP2),
// or a score low enough that hard-negative status is irrelevant.
function _tierFromScore(score, evPositive, evNegative, firstSeenAt, hasHardNegative) {
  if (evPositive === 0 && evNegative === 0) { return 'unknown'; }
  if (hasHardNegative || score <= REPUTATION.TIER_FLAGGED_SCORE) { return 'flagged'; }
  if (evPositive === 0) { return 'new'; }
  var ageMs = Date.now() - firstSeenAt;
  if (score >= REPUTATION.TIER_TRUSTED_SCORE &&
      evPositive >= REPUTATION.TIER_TRUSTED_MIN_EVIDENCE &&
      ageMs >= REPUTATION.TIER_TRUSTED_MIN_AGE_MS) {
    return 'trusted';
  }
  if (score >= REPUTATION.TIER_OK_SCORE && ageMs >= REPUTATION.TIER_OK_MIN_AGE_MS) {
    return 'ok';
  }
  return 'new';
}

// _myMaximaPk — this node's own Maxima public key, read from whichever
// runtime global holds it: the SW sets MY_MAXIMA_PK (service.js), the FE
// sets MY_ADDRESS (dapp/app.js onInited) from the same maxima action:info
// call. typeof-guarded so referencing the other runtime's unset global
// never throws in Rhino or the browser.
function _myMaximaPk() {
  if (typeof MY_MAXIMA_PK !== 'undefined' && MY_MAXIMA_PK) { return MY_MAXIMA_PK.toUpperCase(); }
  if (typeof MY_ADDRESS !== 'undefined' && MY_ADDRESS) { return MY_ADDRESS.toUpperCase(); }
  return '';
}

// ---------------------------------------------------------------------------
// recordSettlementReputationEvidence — shared hook called only after
// settleChannel() has confirmed a channel settled locally, itself only
// reached after a verified on-chain coin spend (channel.handler.js
// _processSettledChannels / dapp/app.js settlement_post). Never called on
// any other path, so every event this produces is first-party evidence.
//
// Subject selection follows the "never self" rule (MinimaAds.md §7.8 rule 5):
// - If this node is NOT the campaign's creator: the creator settled a real
//   channel with us, regardless of whether we opened it as viewer or
//   publisher — record 'settled_channel' evidence about the creator.
// - If this node IS the creator: a viewer-role settlement is this node
//   observing itself, so it is skipped. A publisher-role settlement is
//   evidence about the publisher/frame owner (a third party) — record
//   'publisher_settled' evidence about them instead.
// creatorMx: CHANNEL_STATE.CREATOR_MX ("MAX#<pk>#<mls>"); a legacy/malformed
// route (no extractable public key) safely skips evidence rather than guess.
// ---------------------------------------------------------------------------
function recordSettlementReputationEvidence(creatorMx, role, frameId, campaignId) {
  var route = parseMaximaRoute(creatorMx || '');
  if (!route || !route.publickey) { return; }
  var creatorPk = route.publickey.toUpperCase();
  var myPk = _myMaximaPk();

  if (creatorPk !== myPk) {
    recordReputationEvent({
      subject_key:  creatorPk,
      subject_role: 'creator',
      kind:         'settled_channel',
      scope_id:     campaignId || '',
      source:       'local',
      weight:       REPUTATION.WEIGHT_SETTLED_CHANNEL
    }, function(err) {
      if (err) { MDS.log("[REPUTATION] settled_channel record failed: " + err); }
    });
    return;
  }

  if ((role || 'viewer') !== 'publisher' || !frameId) { return; }
  getFrame(frameId, function(err, frame) {
    if (err || !frame || !frame.PUBLISHER_KEY) { return; }
    var publisherPk = frame.PUBLISHER_KEY.toUpperCase();
    if (publisherPk === myPk) { return; }
    recordReputationEvent({
      subject_key:  publisherPk,
      subject_role: 'publisher',
      kind:         'publisher_settled',
      scope_id:     campaignId || '',
      source:       'local',
      weight:       REPUTATION.WEIGHT_PUBLISHER_SETTLED
    }, function(err2) {
      if (err2) { MDS.log("[REPUTATION] publisher_settled record failed: " + err2); }
    });
  });
}

// ---------------------------------------------------------------------------
// recordOnChainEscrowEvidence — T-REP2 on-chain evidence hook. Call only from
// _applyTrustedEscrowCoin (campaign.handler.js) — i.e. only for a coin that
// has already passed the OPEN-4 forward-lineage trust gate
// (_resolveEscrowCoinTrust). Recording this from processEscrowCoin's
// unverified path would reintroduce OPEN-4's forged-coin attack, just against
// reputation instead of campaign state — never move this call earlier.
//
// creatorPkRoute/creatorMxAddr: the same two identity sources
// _applyTrustedEscrowCoin already resolved from STATE(4); at least one must
// be present to identify a subject.
// ---------------------------------------------------------------------------
function recordOnChainEscrowEvidence(creatorPkRoute, creatorMxAddr, campaignId) {
  var creatorPk = creatorPkRoute ? creatorPkRoute.toUpperCase() : '';
  if (!creatorPk) {
    var route = parseMaximaRoute(creatorMxAddr || '');
    creatorPk = route ? route.publickey.toUpperCase() : '';
  }
  if (!creatorPk || creatorPk === _myMaximaPk()) { return; } // never-self rule
  recordReputationEvent({
    subject_key:  creatorPk,
    subject_role: 'creator',
    kind:         'escrow_funded',
    scope_id:     campaignId || '',
    source:       'chain',
    weight:       REPUTATION.WEIGHT_ESCROW_FUNDED
  }, function(err) {
    if (err) { MDS.log("[REPUTATION] escrow_funded record failed: " + err); }
  });
}

// ---------------------------------------------------------------------------
// recordCampaignFinishObserved — plants a zero-weight clock marker the first
// time this node observes a campaign's on-chain status transition to
// 'finished' (same trust/never-self preconditions as recordOnChainEscrowEvidence
// — call only from the trusted STATE(7) transition branch). Deliberately
// weight 0: it never affects score directly, it only exists so
// sweepFinishedCampaignReputation (below) can compute a grace deadline without
// adding a FINISHED_AT column to the protected CAMPAIGNS table.
// ---------------------------------------------------------------------------
function recordCampaignFinishObserved(creatorPkRoute, creatorMxAddr, campaignId) {
  var creatorPk = creatorPkRoute ? creatorPkRoute.toUpperCase() : '';
  if (!creatorPk) {
    var route = parseMaximaRoute(creatorMxAddr || '');
    creatorPk = route ? route.publickey.toUpperCase() : '';
  }
  if (!creatorPk || creatorPk === _myMaximaPk()) { return; }
  recordReputationEvent({
    subject_key:  creatorPk,
    subject_role: 'creator',
    kind:         'campaign_finished_observed',
    scope_id:     campaignId || '',
    source:       'chain',
    weight:       0
  }, function(err) {
    if (err) { MDS.log("[REPUTATION] campaign_finished_observed record failed: " + err); }
  });
}

// ---------------------------------------------------------------------------
// sweepFinishedCampaignReputation — SW-only, NEWBLOCK-driven, time-gated like
// pruneReputationEvents. For every campaign this node has seen finish
// on-chain (a 'campaign_finished_observed' marker exists) and not yet
// resolved (no 'campaign_finished_clean'/'abandoned_channel' row for the same
// scope), once LIMITS.SETTLEMENT_GRACE_DAYS has elapsed since that marker:
// checks this node's OWN CHANNEL_STATE for that campaign — an open/settling
// channel with money still owed (CUMULATIVE_EARNED > 0) means the creator
// never paid out within the grace window ('abandoned_channel', negative);
// otherwise the campaign closed clean from this node's point of view
// ('campaign_finished_clean', positive). Processes rows one at a time
// (Rhino has no async/await) so a slow DB round-trip never overlaps itself.
// ---------------------------------------------------------------------------
var _lastReputationSweepAt = 0;
function sweepFinishedCampaignReputation() {
  var now = Date.now();
  var SIX_HOURS_MS = 21600000;
  if (now - _lastReputationSweepAt < SIX_HOURS_MS) { return; }
  _lastReputationSweepAt = now;

  var graceMs = (LIMITS.SETTLEMENT_GRACE_DAYS || 7) * 86400000;
  var sql = "SELECT SUBJECT_KEY, SCOPE_ID FROM REPUTATION_EVENTS" +
    " WHERE KIND = 'campaign_finished_observed'" +
    " AND OBSERVED_AT <= " + (now - graceMs) +
    " AND SCOPE_ID NOT IN (" +
    "   SELECT SCOPE_ID FROM REPUTATION_EVENTS WHERE KIND IN ('campaign_finished_clean', 'abandoned_channel')" +
    " )";
  sqlQuery(sql, function(err, rows) {
    if (err) { MDS.log("[REPUTATION] sweepFinishedCampaignReputation query failed: " + err); return; }
    _sweepNext(rows || [], 0);
  });
}

function _sweepNext(rows, i) {
  if (i >= rows.length) { return; }
  var row = rows[i];
  var campaignId = row.SCOPE_ID || '';
  var subjectKey = (row.SUBJECT_KEY || '').toUpperCase();
  var chSql = "SELECT COUNT(*) AS CNT FROM CHANNEL_STATE" +
    " WHERE UPPER(CAMPAIGN_ID) = UPPER('" + escapeSql(campaignId) + "')" +
    " AND STATUS IN ('open', 'settling')" +
    " AND CUMULATIVE_EARNED > 0";
  sqlQuery(chSql, function(err, chRows) {
    var owedCount = (!err && chRows && chRows.length > 0) ? (parseInt(chRows[0].CNT, 10) || 0) : 0;
    if (owedCount > 0) {
      recordReputationEvent({
        subject_key: subjectKey, subject_role: 'creator', kind: 'abandoned_channel',
        scope_id: campaignId, source: 'chain', weight: REPUTATION.WEIGHT_ABANDONED_CHANNEL
      }, function(rErr) {
        if (rErr) { MDS.log("[REPUTATION] abandoned_channel record failed: " + rErr); }
        _sweepNext(rows, i + 1);
      });
    } else {
      recordReputationEvent({
        subject_key: subjectKey, subject_role: 'creator', kind: 'campaign_finished_clean',
        scope_id: campaignId, source: 'chain', weight: REPUTATION.WEIGHT_CAMPAIGN_FINISHED_CLEAN
      }, function(rErr) {
        if (rErr) { MDS.log("[REPUTATION] campaign_finished_clean record failed: " + rErr); }
        _sweepNext(rows, i + 1);
      });
    }
  });
}

// ---------------------------------------------------------------------------
// pruneReputationEvents — bounds REPUTATION_EVENTS growth. Time-gated like
// pruneDedupLog (campaign.handler.js): at most once per 6 hours, deletes
// evidence older than REPUTATION.RETENTION_MS (2x the score half-life, so
// nothing still meaningfully scored gets deleted). SW-only; called from
// service.js on NEWBLOCK.
// ---------------------------------------------------------------------------
var _lastReputationPruneAt = 0;
function pruneReputationEvents() {
  var now = Date.now();
  var SIX_HOURS_MS = 21600000;
  if (now - _lastReputationPruneAt < SIX_HOURS_MS) { return; }
  _lastReputationPruneAt = now;
  var cutoff = now - REPUTATION.RETENTION_MS;
  sqlQuery("DELETE FROM REPUTATION_EVENTS WHERE OBSERVED_AT < " + cutoff, function(err) {
    if (err) { MDS.log("[REPUTATION] pruneReputationEvents: failed — " + err); return; }
    MDS.log("[REPUTATION] pruneReputationEvents: pruned rows older than retention window");
  });
}

// ---------------------------------------------------------------------------
// Local Creator Blocklist & Ad Filtering Preferences (MDS.keypair backed)
// Pure local node storage — 100% private, never shared across the network.
// ---------------------------------------------------------------------------

function getBlockedCreators(cb) {
  if (typeof MDS === 'undefined' || !MDS.keypair) {
    if (cb) { cb(null, []); }
    return;
  }
  MDS.keypair.get('BLOCKED_CREATORS', function(res) {
    var raw = (res && res.status && res.value) ? res.value : '';
    var list = [];
    if (raw) {
      try { list = JSON.parse(raw); } catch (e) { list = []; }
    }
    if (!Array.isArray(list)) { list = []; }
    if (cb) { cb(null, list); }
  });
}

function isCreatorBlocked(creatorPk, cb) {
  if (!creatorPk) { if (cb) { cb(null, false); } return; }
  var target = (creatorPk + '').toUpperCase();
  getBlockedCreators(function(err, list) {
    if (err) { if (cb) { cb(err, false); } return; }
    var found = false;
    for (var i = 0; i < list.length; i++) {
      if (((list[i] || '') + '').toUpperCase() === target) {
        found = true;
        break;
      }
    }
    if (cb) { cb(null, found); }
  });
}

function blockCreator(creatorPk, cb) {
  if (!creatorPk) { if (cb) { cb("Missing creatorPk"); } return; }
  var target = (creatorPk + '').toUpperCase();
  getBlockedCreators(function(err, list) {
    if (err) { if (cb) { cb(err); } return; }
    var exists = false;
    for (var i = 0; i < list.length; i++) {
      if (((list[i] || '') + '').toUpperCase() === target) {
        exists = true;
        break;
      }
    }
    if (!exists) {
      list.push(target);
      MDS.keypair.set('BLOCKED_CREATORS', JSON.stringify(list), function() {
        if (cb) { cb(null, list); }
      });
    } else {
      if (cb) { cb(null, list); }
    }
  });
}

function unblockCreator(creatorPk, cb) {
  if (!creatorPk) { if (cb) { cb("Missing creatorPk"); } return; }
  var target = (creatorPk + '').toUpperCase();
  getBlockedCreators(function(err, list) {
    if (err) { if (cb) { cb(err); } return; }
    var updated = [];
    for (var i = 0; i < list.length; i++) {
      if (((list[i] || '') + '').toUpperCase() !== target) {
        updated.push(list[i]);
      }
    }
    MDS.keypair.set('BLOCKED_CREATORS', JSON.stringify(updated), function() {
      if (cb) { cb(null, updated); }
    });
  });
}

function getHideFlaggedPreference(cb) {
  if (typeof MDS === 'undefined' || !MDS.keypair) {
    if (cb) { cb(null, true); }
    return;
  }
  MDS.keypair.get('HIDE_FLAGGED_ADS', function(res) {
    var raw = (res && res.status && res.value) ? res.value : '';
    // Defaults to true (opt-out protection against flagged creators)
    if (cb) { cb(null, raw !== 'false'); }
  });
}

function setHideFlaggedPreference(enabled, cb) {
  if (typeof MDS === 'undefined' || !MDS.keypair) {
    if (cb) { cb(null); }
    return;
  }
  MDS.keypair.set('HIDE_FLAGGED_ADS', enabled ? 'true' : 'false', function() {
    if (cb) { cb(null); }
  });
}

