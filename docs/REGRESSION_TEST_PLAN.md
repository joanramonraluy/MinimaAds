# MinimaAds — Regression Test Plan

> **Purpose**: prevent already-fixed bugs from `docs/KNOWN_ISSUES.md §3` (Closed/Fixed
> Issues) from silently reappearing when future sessions touch the same shared
> files (`service.js`, `campaign.handler.js`, `channel.handler.js`, `core/*.js`...).
> **Not** the same job as `docs/MASTER_TEST_PLAN.md`, which covers full functional
> / lifecycle coverage (Suites A–F) on the live 6-node harness. This document is
> narrower and reactive: one entry per historical bug, added when it's fixed or
> when a future session first extends this plan to cover it.
> **Constraint**: no `package.json`, no test framework, no build step in this repo
> (per `CLAUDE.md §6`). "Automated" here means plain `node` scripts (Tier 1) and
> scripted checklists against the existing live-node harness (Tier 2) — not CI.

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

**What Tier 1 deliberately does not cover**: anything that needs H2, the
Rhino SW runtime, Maxima delivery, or an actual on-chain spend/confirmation —
including the real SHA3 hash chain reproduction against live CoinIDs (already
verified live per fragility #59; re-verifying that specific chain belongs to
Tier 2 below, not here).

**Adding a new Tier 1 test**: when a future session fixes a bug in a pure
function (no `MDS`/`sqlQuery`/DOM dependency at call time), add a
`tests/regression/<name>.test.js` following the existing files' shape:
`loadCore([...])`, plain `assert.equal`/`assert.ok` calls in IIFEs, a
`console.log('<file>: all assertions passed')` at the end, and a comment
citing the fragility/ticket ID it guards.

---

## Tier 2 — Live-node checklist (6-node harness)

No new infrastructure — reuses the cluster and roles already documented in
`docs/TESTING_SETUP.md`. Each entry: a fixed bug, a minimal repro, the pass
criterion, and the MDS/SQL command that gives ground truth (same pattern
already used in `docs/E2E_LIVE_RUN_2026-09-07.md`). Seeded with a
representative subset, not all ~20 `KNOWN_ISSUES.md §3` entries at once — grows
whenever a future session touches code adjacent to one of these.

| ID | Bug | Repro | Pass criterion | Ground truth | Last verified |
|---|---|---|---|---|---|
| CH-5 | Settlement coins unspendable (`sendable:0`) for both viewer and creator | Open a channel, accrue a reward, settle it (`#earnings` → Settle) | Settlement tx confirms and the resulting coin is spendable, not locked | `MDS.cmd('coins address:' + settlementAddress)` → `sendable:true` on the new coin | ✅ 2026-09-12 — real viewer channel opened against a live campaign, a real view reward (0.1 MINIMA) accrued and settled via `#earnings` → Settle; resulting coin confirmed `sendable:"0.1"` after 1 block |
| Fragility #40 | `PREVSTATE(n)` throws if port `n` isn't stored in the spending coin, even inside an untaken `IF` branch | Spend a split/change coin through `ESCROW_SCRIPT_V2`/`V3`/`V4` that legitimately omits an optional port (e.g. a fee-disabled campaign) | Tx script check passes; no `PREVSTATE Missing` exception | `txnpost` returns `status:true` AND the coin is confirmed spent in a later block (not just locally accepted — see fragility #42's peer-rejection pattern) | ✅ 2026-09-12 — real Pause on a live PLATFORM_KEY=null campaign; new change coin confirmed unspent on-chain |
| Fragility #47 | `PREVSTATE(7)` raw-string write instead of hex-encoded UTF-8 | Post a real status-update tx and read the resulting coin's `STATE(7)` back from a different node | `hexToUtf8(STATE(7))` decodes to the exact status string (`active`/`paused`/`finished`), not garbage | `MDS.cmd('coins coinid:' + coinId)` on a peer node, inspect `state` array port 7 | ✅ 2026-09-12 — live escrow coin, `active` (`0x616374697665`) then `paused` (`0x706175736564`), both round-tripped correctly |
| OPEN-4 | Forged dust coin at the public `ESCROW_ADDRESS` could hijack any campaign with no authentication | Send a crafted coin to `ESCROW_ADDRESS` claiming an existing campaign's identity, from a non-creator node | `_resolveEscrowCoinTrust`'s lineage gate rejects it — no state change on the receiving node | Compare `CAMPAIGNS` row before/after on the receiving node via SQL console; must be identical | ✅ 2026-09-12 — real forged coin posted (campaign_id + `finished` state) to the live `ESCROW_ADDRESS` from a non-creator node; `CAMPAIGNS.STATUS`/`ESCROW_COINID` unchanged on all 3 nodes checked (creator, a synced peer, and the attacker's own node) |
| OPEN-3 | Spoofed `CAMPAIGN_FINISH` / `CAMPAIGN_PAUSE` from a non-creator identity | Send a forged `CAMPAIGN_FINISH` and `CAMPAIGN_PAUSE` from a real but non-creator Maxima identity | `_assertCreatorThen` rejects both outright; no state change | Same SQL before/after comparison as OPEN-4 | ✅ 2026-09-12 — real forged `CAMPAIGN_FINISH` Maxima message sent from a non-creator node to a synced peer; `CAMPAIGNS.STATUS` stayed `paused`, never flipped to `finished` |

**Status as of 2026-09-12**: 5/5 seeded entries verified in one live session
on the real 5-node harness (redeployed, current code confirmed by content —
`_resolveEscrowCoinTrust` and `core/reputation.js`'s flagged tier both present
before testing began). OPEN-3 and OPEN-4 were exercised as genuine live
attacks (a real forged Maxima message and a real forged on-chain coin), not
just re-reads of prior results.

**Executing a Tier 2 entry**: follow `docs/TESTING_SETUP.md` to bring up the
harness and assign roles, then drive the repro via Playwright/`browser_evaluate`
as described there — these are checklist items to work through manually
(with agent assistance), not a script that runs unattended.

---

## Growing this document

- New Tier 1 test → add its row to the Tier 1 table above.
- New Tier 2 checklist entry → add its row to the Tier 2 table above, citing
  the fragility/ticket ID for full detail (never duplicate the narrative —
  `docs/KNOWN_ISSUES.md` / `docs/HISTORY.md §17` remain the source of truth).
- This document does not need updating for bugs with no live regression risk
  (e.g. pure documentation/spec-drift fixes like OPEN-8).
