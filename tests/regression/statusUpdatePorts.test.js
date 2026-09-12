// Tier 1 regression guard for core/campaigns.js buildStatusUpdateStatePorts()
// — covers fragility #53 (port 16 dropped silently) and fragility #56 (port 2
// invented instead of carried forward). See docs/REGRESSION_TEST_PLAN.md.
'use strict';

var assert = require('assert/strict');
var loadCore = require('./_lib/loadCore').loadCore;

var ctx = loadCore(['minima.js', 'campaigns.js']);
var buildStatusUpdateStatePorts = ctx.buildStatusUpdateStatePorts;

var BASE_ESCROW = { walletPk: '0xA', campaignIdHex: '0xB', creatorMxHex: '0xC', platformKeyHex: '0xD', maxPubBudget: '0' };

function portValue(ports, port) {
  var match = ports.filter(function(p) { return p.port === port; });
  return match.length > 0 ? match[0].value : undefined;
}

(function testPort16AlwaysPresent() {
  // Fragility #53: ESCROW_SCRIPT_V4 reads port 16 unconditionally; omitting it
  // makes txnpost report status:true while the spend is silently dropped.
  var ports = buildStatusUpdateStatePorts(BASE_ESCROW, '0x616374697665', 5);
  assert.equal(portValue(ports, 16), '0', 'port 16 (foundationfeeflag) must always be present');
})();

(function testPort2OmittedWhenAbsent() {
  // Fragility #56: never invent the expiry block if the source coin didn't carry one.
  var ports = buildStatusUpdateStatePorts(BASE_ESCROW, '0x616374697665', 5);
  assert.equal(portValue(ports, 2), undefined, 'port 2 must be omitted when expiryBlock is absent from the source coin');
})();

(function testPort2CarriedWhenPresent() {
  var ports = buildStatusUpdateStatePorts(Object.assign({}, BASE_ESCROW, { expiryBlock: '12345' }), '0x616374697665', 5);
  assert.equal(portValue(ports, 2), '12345', 'port 2 must be carried forward when the source coin has one');
})();

(function testPort10EqualsCoinAmount() {
  // Bypasses the VERIFYOUT(INC(@INPUT) @ADDRESS change ...) check by making
  // change == 0 on a single-output status-update tx (see comment above the
  // function in core/campaigns.js).
  var ports = buildStatusUpdateStatePorts(BASE_ESCROW, '0x616374697665', 42);
  assert.equal(portValue(ports, 10), '42', 'port 10 must equal the full current coin amount');
})();

console.log('statusUpdatePorts.test.js: all assertions passed');
