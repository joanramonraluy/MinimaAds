// Tier 1 regression guard for core/validation.js validateView()/validateClick()
// — the actual enforcement point for "a creator must never earn from their
// own campaign" (CLAUDE.md §6) and for VAL-1 (per-campaign, not global,
// cooldown). See docs/REGRESSION_TEST_PLAN.md.
//
// validation.js talks to the DB via getCampaign()/sqlQuery() (both globals
// it expects to be loaded elsewhere in the SW). Here they're replaced with
// controlled stubs injected into the vm context, so the real branching logic
// (self-reward, budget, channel cap, daily limit, cooldown) runs against
// known inputs with no live node/H2 involved. escapeSql() is loaded for
// real from core/minima.js since it's pure.
'use strict';

var assert = require('assert/strict');
var loadCore = require('./_lib/loadCore').loadCore;

var CREATOR = '0xCREATOR';
var VIEWER = '0xVIEWER';

function freshCampaign(overrides) {
  return Object.assign({
    ID: 'c1',
    CREATOR_ADDRESS: CREATOR,
    STATUS: 'active',
    BUDGET_REMAINING: '10',
    REWARD_VIEW: '0.1',
    REWARD_CLICK: '0.2',
    MAX_DAILY_VIEWS: 10,
    MAX_DAILY_CLICKS: 5,
    COOLDOWN_MS: 300000
  }, overrides || {});
}

// Builds a fresh vm context stubbing getCampaign/sqlQuery/LIMITS around a
// given campaign row, channel row (or none), and REWARD_EVENTS count/last-at.
// minima.js is loaded for its real (pure) escapeSql() — but it also defines
// its own sqlQuery(), which would clobber a stub passed in up front (a
// later `function` declaration wins in the same scope). So the stubs that
// must override it are assigned on the returned context object afterwards.
function makeCtx(campaign, channelRow, eventStats) {
  var ctx = loadCore(['minima.js', 'validation.js'], {
    LIMITS: { MAX_VIEWS_PER_CAMPAIGN_PER_DAY: 999, MAX_CLICKS_PER_CAMPAIGN_PER_DAY: 999, COOLDOWN_BETWEEN_REWARDS_MS: 60000 }
  });
  ctx.getCampaign = function(id, cb) { cb(null, campaign); };
  ctx.sqlQuery = function(sql, cb) {
    if (sql.indexOf('CHANNEL_STATE') !== -1) {
      cb(null, channelRow ? [channelRow] : []);
      return;
    }
    cb(null, [{ CNT: eventStats.count, LAST_AT: eventStats.lastAt }]);
  };
  return ctx;
}

(function testSelfRewardBlockedView() {
  var ctx = makeCtx(freshCampaign(), null, { count: 0, lastAt: null });
  var result;
  ctx.validateView('c1', CREATOR, function(r) { result = r; });
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'creator cannot earn from own campaign');
})();

(function testSelfRewardBlockedCaseInsensitive() {
  var ctx = makeCtx(freshCampaign(), null, { count: 0, lastAt: null });
  var result;
  ctx.validateView('c1', CREATOR.toLowerCase(), function(r) { result = r; });
  assert.equal(result.valid, false, 'self-reward check must be case-insensitive');
})();

(function testInactiveCampaignBlocked() {
  var ctx = makeCtx(freshCampaign({ STATUS: 'paused' }), null, { count: 0, lastAt: null });
  var result;
  ctx.validateView('c1', VIEWER, function(r) { result = r; });
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'campaign not active');
})();

(function testInsufficientBudgetBlocked() {
  var ctx = makeCtx(freshCampaign({ BUDGET_REMAINING: '0.01' }), null, { count: 0, lastAt: null });
  var result;
  ctx.validateView('c1', VIEWER, function(r) { result = r; });
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'insufficient budget');
})();

(function testChannelCapBlocksView() {
  var channelRow = { CUMULATIVE_EARNED: '0.95', MAX_AMOUNT: '1.0', STATUS: 'open' };
  var ctx = makeCtx(freshCampaign(), channelRow, { count: 0, lastAt: null });
  var result;
  ctx.validateView('c1', VIEWER, function(r) { result = r; });
  assert.equal(result.valid, false, '0.95 + 0.1 reward exceeds MAX_AMOUNT 1.0');
  assert.equal(result.reason, 'campaign reward limit reached for this user');
})();

(function testChannelCapIgnoredWhenNotOpen() {
  var channelRow = { CUMULATIVE_EARNED: '0.95', MAX_AMOUNT: '1.0', STATUS: 'settled' };
  var ctx = makeCtx(freshCampaign(), channelRow, { count: 0, lastAt: null });
  var result;
  ctx.validateView('c1', VIEWER, function(r) { result = r; });
  assert.equal(result.valid, true, 'a settled/closed channel row must not block a fresh reward');
})();

(function testDailyViewLimitReached() {
  var ctx = makeCtx(freshCampaign({ MAX_DAILY_VIEWS: 10 }), null, { count: 10, lastAt: null });
  var result;
  ctx.validateView('c1', VIEWER, function(r) { result = r; });
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'daily view limit reached');
})();

(function testCooldownActive() {
  var now = Date.now();
  var ctx = makeCtx(freshCampaign({ COOLDOWN_MS: 300000 }), null, { count: 1, lastAt: now - 1000 });
  var result;
  ctx.validateView('c1', VIEWER, function(r) { result = r; });
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'cooldown active');
  assert.ok(result.remainingMs > 298000 && result.remainingMs <= 300000, 'remainingMs should be ~299s, got ' + result.remainingMs);
})();

(function testValidViewPasses() {
  var ctx = makeCtx(freshCampaign(), null, { count: 0, lastAt: null });
  var result;
  ctx.validateView('c1', VIEWER, function(r) { result = r; });
  assert.equal(result.valid, true);
  assert.equal(result.reason, null);
})();

(function testSelfRewardBlockedClick() {
  var ctx = makeCtx(freshCampaign(), null, { count: 0, lastAt: null });
  var result;
  ctx.validateClick('c1', CREATOR, function(r) { result = r; });
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'creator cannot earn from own campaign');
})();

(function testClickUsesRewardClickNotRewardView() {
  // Budget covers REWARD_VIEW (0.1) but not REWARD_CLICK (0.2) — must check
  // against the click reward, not silently reuse the view one.
  var ctx = makeCtx(freshCampaign({ BUDGET_REMAINING: '0.15', REWARD_VIEW: '0.1', REWARD_CLICK: '0.2' }), null, { count: 0, lastAt: null });
  var result;
  ctx.validateClick('c1', VIEWER, function(r) { result = r; });
  assert.equal(result.valid, false, 'validateClick must compare budget against REWARD_CLICK');
  assert.equal(result.reason, 'insufficient budget');
})();

console.log('validation.test.js: all assertions passed');
