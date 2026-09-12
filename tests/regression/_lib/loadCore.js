// tests/regression/_lib/loadCore.js
//
// Loads one or more core/*.js files (Rhino-style global-scope scripts — no
// module.exports, loaded via load() in the real Service Worker) into a
// single shared vm context, mirroring how the SW composes them. Functions
// declared in one file can call functions declared in another loaded into
// the same context (e.g. campaigns.js's encodeStatusForTx calling minima.js's
// utf8ToHex).
//
// core/*.js is never modified to support this — no module.exports is added,
// per CLAUDE.md §5 (Stable Core API) and the Multi-Agent Safety Rules
// (only touch files required by the task).
//
// `globals` lets a test stub platform APIs a script references at call time
// (e.g. MDS) without needing a live Minima node.
'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

function loadCore(relFileNames, globals) {
  var context = vm.createContext(Object.assign({ console: console }, globals || {}));
  for (var i = 0; i < relFileNames.length; i++) {
    var fullPath = path.join(__dirname, '..', '..', '..', 'core', relFileNames[i]);
    var code = fs.readFileSync(fullPath, 'utf8');
    vm.runInContext(code, context, { filename: fullPath });
  }
  return context;
}

module.exports = { loadCore: loadCore };
