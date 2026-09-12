// Tier 1 regression guard for core/campaigns.js escrowChildCoinId() — covers
// fragility #59 / the OPEN-4 lineage-gate formula. See
// docs/REGRESSION_TEST_PLAN.md.
//
// escrowChildCoinId delegates the actual SHA3-256 hashing to a live node
// (`MDS.cmd("hash type:sha3 ...")`) — reproducing that hash chain against
// real CoinIDs is Tier 2 (live 6-node harness) territory and is already
// covered by the OPEN-4 live verification referenced in fragility #59. What
// IS testable offline, and is exactly what a future refactor is most likely
// to silently break, is the byte-string this test stubs MDS.cmd to capture:
// the OPEN-4 security guarantee depends entirely on it matching
// SHA3-256(0x00000020 || parent[32] || 0x0001<index>) exactly.
'use strict';

var assert = require('assert/strict');
var loadCore = require('./_lib/loadCore').loadCore;

var capturedCommands = [];
var mdsStub = {
  cmd: function(command, cb) {
    capturedCommands.push(command);
    cb({ status: true, response: { hash: '0xDEADBEEF' } }); // value irrelevant to this test
  }
};

var ctx = loadCore(['campaigns.js'], { MDS: mdsStub });
var escrowChildCoinId = ctx.escrowChildCoinId;

var PARENT = '0x' + '11'.repeat(32); // 64 hex chars, well-formed coin id

(function testCommandFormatForLowIndex() {
  capturedCommands.length = 0;
  escrowChildCoinId(PARENT, 0, function() {});
  assert.equal(capturedCommands[0], 'hash type:sha3 data:0x00000020' + '11'.repeat(32) + '000100');
})();

(function testCommandFormatForHighIndex() {
  capturedCommands.length = 0;
  escrowChildCoinId(PARENT, 15, function() {});
  assert.equal(capturedCommands[0], 'hash type:sha3 data:0x00000020' + '11'.repeat(32) + '00010F');
})();

(function testRejectsMalformedParent() {
  capturedCommands.length = 0;
  var got;
  escrowChildCoinId('not-a-coin-id', 0, function(r) { got = r; });
  assert.equal(got, '', 'a malformed parent coinId must short-circuit to empty string');
  assert.equal(capturedCommands.length, 0, 'must not call MDS.cmd for malformed input');
})();

(function testRejectsOutOfRangeIndex() {
  capturedCommands.length = 0;
  var got;
  escrowChildCoinId(PARENT, 16, function(r) { got = r; });
  assert.equal(got, '', 'index > 15 must be rejected — transactions in this codebase never emit more outputs');
  assert.equal(capturedCommands.length, 0);
})();

console.log('escrowChildCoinId.test.js: all assertions passed');
