# MinimaAds — Regression Test Plan

> **Purpose**: prevent already-fixed bugs from `docs/KNOWN_ISSUES.md §3` (Closed/Fixed
> Issues) from silently reappearing when future sessions touch the same shared
> files (`service.js`, `campaign.handler.js`, `channel.handler.js`, `core/*.js`...).
> **Not** the same job as `docs/MASTER_TEST_PLAN.md`, which covers full functional
> / lifecycle coverage (Suites A–F) on the live 6-node harness.
> **Constraint**: no `package.json`, no test framework, no build step in this repo
> (per `CLAUDE.md §6`). "Automated" here means plain `node` scripts — not CI.

---

## Scope: this document owns Tier 1 only

There is only one tier here: **pure-logic regression tests** — plain Node
scripts that need no live Minima node at all. Anything that needs a live
node belongs in `docs/MASTER_TEST_PLAN.md §4` (the "Current Baseline
Verification Matrix"), not here — see the note below on why.

### Why there's no live-node Tier 2 in this document

An earlier version of this document had a second, live-node "Tier 2"
checklist. On 2026-09-12 the maintainer asked whether it could overlap with
`docs/MASTER_TEST_PLAN.md §4`, which already tracks per-bug live-node status
with evidence pointers. Checking row by row confirmed it did — concretely:

| This document's old Tier 2 entry | Was already `MASTER_TEST_PLAN.md §4` row |
|---|---|
| Fragility #40 + #47 (Pause/Resume, `STATE(7)` hex round-trip) | **D.1** — Manual Pause & Resume |
| OPEN-3 (spoofed `CAMPAIGN_FINISH`) | **F.1** — Adversarial Forged Finish, already tagged `Regression` |
| OPEN-4 (forged dust coin at `ESCROW_ADDRESS`) | **F.4** — Adversarial Dust Coin Injection, already tagged `Regression` |
| CH-5 (settlement coin spendability) | **B.4** — Manual Settlement via `#earnings` |

The 2026-09-12 live verification session (`docs/HISTORY.md §17`,
MVP-DECISIONS + REGRESSION-PLAN) had — without realizing it — re-run D.1,
F.1, F.4, and B.4 under different names. Rather than leave two tables that
can silently drift out of sync, live-node regression tracking now lives
**only** in `MASTER_TEST_PLAN.md §4`, which already had the right shape for
it (per-bug row, status, evidence, `Regression`/`Smoke check` target). Its
four rows above were updated with the 2026-09-12 evidence in place of
duplicating it here.

**If a future session fixes a bug that needs a live-node regression guard**:
add or update a row in `docs/MASTER_TEST_PLAN.md §4` (tag it `Regression` in
the Target column) — do not start a new live-node table in this document.

---

## Tier 1 — Pure logic (no Minima node required)

Scripts in `tests/regression/*.test.js`, plain Node (`assert/strict`, no
dependencies). Each one loads the relevant `core/*.js` file(s) unmodified into
a `vm` context via `tests/regression/_lib/loadCore.js` — this never touches
`core/*.js` itself (no `module.exports` added; the Stable Core API in
`CLAUDE.md §5` stays untouched) and mirrors how the SW composes those files
via `load()`.

Run all of them:
```
node tests/regression/run-all.js
```
Exit code `1` if any test fails. Run a single file directly with
`node tests/regression/<name>.test.js`.

| Test file | Covers | Guards against |
|---|---|---|
| `selectAd.test.js` | `core/selection.js` `selectAd()` | Eligibility filtering (status/budget/self-view/expiry/blocklist), interest-match fallback, and the "never let a creator earn from their own campaign" rule (`CLAUDE.md §6`) silently regressing |
| `statusEncoding.test.js` | `core/campaigns.js` `encodeStatusForTx()` + `core/minima.js` `hexToUtf8()` | Fragility #47 — `PREVSTATE(7)` must be hex-encoded UTF-8; a raw-string write decodes to garbage on the receiving node |
| `statusUpdatePorts.test.js` | `core/campaigns.js` `buildStatusUpdateStatePorts()` | Fragility #53 (port 16 silently dropped → `txnpost` reports `status:true` while the spend is actually rejected) and fragility #56 (port 2 / expiry block invented instead of carried forward) |
| `escrowChildCoinId.test.js` | `core/campaigns.js` `escrowChildCoinId()` command construction | Fragility #59 / OPEN-4 — the lineage-gate security guarantee depends entirely on the hashed byte string matching `SHA3-256(0x00000020 \|\| parent[32] \|\| 0x0001<index>)` exactly; stubs `MDS.cmd` to capture and assert the exact command string, plus malformed-input / out-of-range-index rejection |
| `escrowDescendantSet.test.js` | `core/campaigns.js` `escrowDescendantSet()` breadth-first closure | Fragility #59 / OPEN-4 — the other half of the lineage gate: depth-1 yields exactly 2 children, depth-2 yields 6 total (matching the function's own "6 hash calls" comment), `maxDepth` clamps to `[1,4]`, malformed anchor short-circuits, keys stay uppercased |
| `validation.test.js` | `core/validation.js` `validateView()`/`validateClick()` | The actual enforcement point for "a creator must never earn from their own campaign" (`CLAUDE.md §6`) plus VAL-1 (per-campaign, not global, cooldown) — self-reward (case-insensitive), inactive campaign, insufficient budget (view vs. click reward, not conflated), channel `MAX_AMOUNT` cap (only while `open`/`pending`), daily limit, and cooldown `remainingMs` math |

**What Tier 1 deliberately does not cover**: anything that needs H2, the
Rhino SW runtime, Maxima delivery, or an actual on-chain spend/confirmation —
including the real SHA3 hash chain reproduction against live CoinIDs (see
`docs/KNOWN_ISSUES.md` fragility #59; that's live-node territory, tracked in
`MASTER_TEST_PLAN.md §4`, not here).

**Adding a new Tier 1 test**: when a future session fixes a bug in a pure
function (no `MDS`/`sqlQuery`/DOM dependency at call time), add a
`tests/regression/<name>.test.js` following the existing files' shape:
`loadCore([...])`, plain `assert.equal`/`assert.ok` calls in IIFEs, a
`console.log('<file>: all assertions passed')` at the end, and a comment
citing the fragility/ticket ID it guards. Add its row to the table above.
