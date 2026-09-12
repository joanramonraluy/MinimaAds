// Tier 1 regression guard for core/campaigns.js escrowDescendantSet() —
// companion to escrowChildCoinId.test.js. Covers fragility #59 / OPEN-4:
// the breadth-first forward closure that decides whether a coin found at
// the public ESCROW_ADDRESS is within the trusted 2-generation lineage of
// the campaign's anchored ESCROW_COINID. See docs/REGRESSION_TEST_PLAN.md.
//
// MDS.cmd is stubbed with a deterministic fake hash (branch-index-aware, so
// child(x,0) != child(x,1)) rather than a real SHA3 — this tests the
// traversal/depth/dedup logic in escrowDescendantSet itself, not the hash
// function (that's escrowChildCoinId.test.js's job).
'use strict';

var assert = require('assert/strict');
var crypto = require('crypto');
var loadCore = require('./_lib/loadCore').loadCore;

var ANCHOR = '0x' + '11'.repeat(32);

// Deterministic fake: child(id, branch) = sha256(id + ':' + branch), reduced
// to a 64-hex-char id. Real crypto (not a hand-rolled scheme) so different
// (parent, branch) pairs are collision-resistant for this test's purposes —
// the point is exercising escrowDescendantSet's traversal/dedup/depth logic,
// not the real SHA3 hash chain (that's escrowChildCoinId.test.js's job).
function fakeChild(parentHex, branch) {
  return '0x' + crypto.createHash('sha256').update(parentHex + ':' + branch).digest('hex').toUpperCase();
}

var mdsStub = {
  cmd: function(command, cb) {
    // command looks like:
    // "hash type:sha3 data:0x00000020" + parentHex(64) + "0001" + idxHex(2)
    var dataHex = command.slice(command.indexOf('data:0x') + 7);
    var parentHex = dataHex.slice(8, 8 + 64);
    var branch = parseInt(dataHex.slice(-2), 16);
    // escrowChildCoinId strips a leading "0x" off res.response.hash itself
    // (matching the real MDS `hash` command's response shape) — the stub
    // must include that prefix, or every id gets truncated by 2 chars and
    // silently fails the next depth's 66-char id-format check.
    cb({ status: true, response: { hash: fakeChild('0x' + parentHex, branch) } });
  }
};

var ctx = loadCore(['campaigns.js'], { MDS: mdsStub });
var escrowDescendantSet = ctx.escrowDescendantSet;

(function testDepth1HasExactlyTwoChildren() {
  var out;
  escrowDescendantSet(ANCHOR, 1, function(map) { out = map; });
  var keys = Object.keys(out);
  assert.equal(keys.length, 2, 'depth 1 must yield exactly the two direct children (branch 0 and 1)');
  keys.forEach(function(k) {
    assert.equal(out[k].depth, 1);
    assert.equal(out[k].path.length, 1);
  });
})();

(function testDepth2MatchesOpenIssue59SixHashCalls() {
  // Fragility #59's own comment: "maxDepth 2 costs 6 hash calls" — 2 at
  // depth 1, 4 at depth 2 (each depth-1 node branches into 2 more).
  var out;
  escrowDescendantSet(ANCHOR, 2, function(map) { out = map; });
  var byDepth = { 1: 0, 2: 0 };
  Object.keys(out).forEach(function(k) { byDepth[out[k].depth]++; });
  assert.equal(byDepth[1], 2, 'expected 2 depth-1 nodes');
  assert.equal(byDepth[2], 4, 'expected 4 depth-2 nodes (6 total hash calls, per fragility #59)');
  assert.equal(Object.keys(out).length, 6);
})();

(function testMaxDepthIsClampedTo4() {
  // escrowDescendantSet clamps maxDepth to the 1..4 range (documented in
  // core/campaigns.js) — a caller passing something larger must not run away.
  var out5, out4;
  escrowDescendantSet(ANCHOR, 5, function(map) { out5 = map; });
  escrowDescendantSet(ANCHOR, 4, function(map) { out4 = map; });
  assert.equal(Object.keys(out5).length, Object.keys(out4).length, 'maxDepth > 4 must clamp to 4, not run deeper');
})();

(function testMaxDepthBelow1ClampsToAtLeast1() {
  var out;
  escrowDescendantSet(ANCHOR, 0, function(map) { out = map; });
  assert.equal(Object.keys(out).length, 2, 'maxDepth < 1 must clamp to 1, not return an empty set');
})();

(function testMalformedAnchorReturnsEmptySet() {
  // out is created inside the vm context (a different realm), so compare by
  // key count rather than assert.deepEqual against a Node-realm {} literal
  // — cross-realm objects fail strict deepEqual on prototype identity alone.
  var out;
  escrowDescendantSet('not-a-coin-id', 2, function(map) { out = map; });
  assert.equal(Object.keys(out).length, 0, 'a malformed anchor must short-circuit to an empty descendant set, not throw');
})();

(function testEachEntryKeyedByUppercaseChildId() {
  var out;
  escrowDescendantSet(ANCHOR, 1, function(map) { out = map; });
  Object.keys(out).forEach(function(k) {
    assert.equal(k, k.toUpperCase(), 'map keys must be uppercased coin ids, per public key / id comparison convention');
  });
})();

console.log('escrowDescendantSet.test.js: all assertions passed');
