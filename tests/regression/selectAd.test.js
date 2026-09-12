// Tier 1 regression guard for core/selection.js selectAd() — pure, synchronous,
// no MDS/DB involved. See docs/REGRESSION_TEST_PLAN.md.
'use strict';

var assert = require('assert/strict');
var loadCore = require('./_lib/loadCore').loadCore;

var ctx = loadCore(['selection.js']);
var selectAd = ctx.selectAd;

function freshCampaign(overrides) {
  return Object.assign({
    ID: 'c1',
    CREATOR_ADDRESS: '0xCREATOR',
    STATUS: 'active',
    BUDGET_REMAINING: '10',
    REWARD_VIEW: '0.1',
    AD_INTERESTS: 'crypto,defi',
    EXPIRES_AT: null
  }, overrides || {});
}

(function testExcludesInactiveCampaigns() {
  var result = selectAd('0xVIEWER', 'crypto', [freshCampaign({ STATUS: 'paused' })], []);
  assert.equal(result, null, 'a non-active campaign must not be selected');
})();

(function testExcludesInsufficientBudget() {
  var result = selectAd('0xVIEWER', 'crypto', [freshCampaign({ BUDGET_REMAINING: '0.01', REWARD_VIEW: '0.1' })], []);
  assert.equal(result, null, 'a campaign with budget < reward_view must not be selected');
})();

(function testExcludesSelfViewing() {
  // CLAUDE.md §6: "Allow a creator to earn rewards from their own campaigns" is forbidden.
  var result = selectAd('0xsame', 'crypto', [freshCampaign({ CREATOR_ADDRESS: '0xSAME' })], []);
  assert.equal(result, null, 'a creator must never be shown their own campaign, case-insensitively');
})();

(function testExcludesExpiredCampaigns() {
  var result = selectAd('0xVIEWER', 'crypto', [freshCampaign({ EXPIRES_AT: String(Date.now() - 1000) })], []);
  assert.equal(result, null, 'an expired campaign must not be selected');
})();

(function testExcludesBlockedCreators() {
  var result = selectAd('0xVIEWER', 'crypto', [freshCampaign({ CREATOR_ADDRESS: '0xBAD' })], ['0xbad']);
  assert.equal(result, null, 'a blocked creator (any key casing) must be excluded');
})();

(function testFallsBackToFullEligiblePoolWhenNoInterestMatch() {
  var result = selectAd('0xVIEWER', 'crypto', [freshCampaign({ AD_INTERESTS: 'gaming' })], []);
  assert.ok(result, 'must fall back to the full eligible pool when no tag overlaps');
  assert.equal(result.ID, 'c1');
})();

(function testPrefersInterestMatchOverNonMatch() {
  var campaigns = [
    freshCampaign({ ID: 'no-match', AD_INTERESTS: 'gaming' }),
    freshCampaign({ ID: 'match', AD_INTERESTS: 'crypto' })
  ];
  var result = selectAd('0xVIEWER', 'crypto', campaigns, []);
  assert.equal(result.ID, 'match', 'a matching-interest campaign must win over a non-matching one');
})();

console.log('selectAd.test.js: all assertions passed');
