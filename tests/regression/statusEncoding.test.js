// Tier 1 regression guard for fragility #47 (docs/KNOWN_ISSUES.md) —
// PREVSTATE(7) must be hex-encoded UTF-8; a raw-string write decodes to
// garbage on the receiving node. See docs/REGRESSION_TEST_PLAN.md.
'use strict';

var assert = require('assert/strict');
var loadCore = require('./_lib/loadCore').loadCore;

var ctx = loadCore(['minima.js', 'campaigns.js']);
var encodeStatusForTx = ctx.encodeStatusForTx;
var hexToUtf8 = ctx.hexToUtf8;

['active', 'paused', 'finished'].forEach(function(status) {
  var hex = encodeStatusForTx(status);
  assert.ok(/^0x[0-9A-F]+$/.test(hex), 'encodeStatusForTx(' + status + ') must be 0x-prefixed uppercase hex, got ' + hex);
  assert.equal(hexToUtf8(hex), status, 'round-trip must recover the original status');
});

// Fixed fixture from fragility #47's own documented example.
assert.equal(encodeStatusForTx('active'), '0x616374697665');

[undefined, null, '', 'ACTIVE', 'pending'].forEach(function(bad) {
  assert.equal(encodeStatusForTx(bad), '', 'invalid status "' + bad + '" must return empty string, not a garbage hex value');
});

console.log('statusEncoding.test.js: all assertions passed');
