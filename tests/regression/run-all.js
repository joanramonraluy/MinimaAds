// tests/regression/run-all.js
// Runs every *.test.js in this directory as a separate `node` process (no
// package.json, no framework — plain Node, per CLAUDE.md's no-build-step
// rule) and prints a pass/fail summary. Exit code 1 if any test failed.
'use strict';

var fs = require('fs');
var path = require('path');
var execFileSync = require('child_process').execFileSync;

var dir = __dirname;
var files = fs.readdirSync(dir).filter(function(f) {
  return f.slice(-8) === '.test.js';
}).sort();

var failures = [];
files.forEach(function(f) {
  try {
    execFileSync(process.execPath, [path.join(dir, f)], { encoding: 'utf8', stdio: 'pipe' });
    console.log('PASS  ' + f);
  } catch (e) {
    failures.push(f);
    console.log('FAIL  ' + f);
    console.log((e.stdout || '') + (e.stderr || e.message || ''));
  }
});

console.log('');
console.log((files.length - failures.length) + '/' + files.length + ' passed');
if (failures.length > 0) {
  process.exit(1);
}
