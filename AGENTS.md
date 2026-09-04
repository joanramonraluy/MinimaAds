# AGENTS.md — MinimaAds Agent Guide

Last compacted: 2026-05-18
Scope: `/home/joanramon/Minima/MinimaAds`

This is the short operative guide for agents. Long-form reference material lives in `docs/`.

---

## 0) Mandatory Update Mandate

Any agent making modifications to this repository must update this file before finishing.

Handoff notes must include:
- `AGENTS.md updated: yes/no`
- If `yes`, list affected sections.
- If intentionally not applicable, write `AGENTS.md: N/A` and explain why.

For detailed changes that would make this file noisy, update the relevant document in `docs/` and add only a short pointer here.

---

## 1) Source Of Truth

This project is governed by two documents:

| Document | Role | Authority |
|---|---|---|
| `MinimaAds.md` | Functional and architectural specification | Highest |
| `AGENTS.md` | Operative guide for agents | Derived from `MinimaAds.md` |

If `AGENTS.md` and `MinimaAds.md` conflict, `MinimaAds.md` wins.

Before implementing a feature, read the relevant sections of `MinimaAds.md` and the relevant reference document:

| Topic | Reference |
|---|---|
| Minima/MDS/H2/Rhino platform rules | `docs/PLATFORM_NOTES.md` |
| Project topology, DB mirror, protocols, signals | `docs/PROJECT_NOTES_REFERENCE.md` |
| Fragility points and open bugs | `docs/KNOWN_ISSUES.md` |
| Active task list | `docs/TASKS.md` |
| Long change history | `docs/HISTORY.md` |
| Archived docs (UI guides, roadmaps, old tasks) | `docs/archive/` |

---

## 2) CRITICAL: Model Assessment Protocol

**Before ANY investigation or code changes:**

1. Self-assess task complexity using `CLAUDE.md §2` rubric
2. **Publicly output your assessment** (not just in thinking):
   - Complexity level
   - Reasoning
   - Recommended model
3. **Ask user for confirmation** and WAIT for response
   - "Vols que delegui a [Model], o [current model] va bé?"
4. Only proceed after explicit user approval

See `CLAUDE.md §2` "CRITICAL: Public Assessment → Suggestion → User Confirmation" for full details.

---

## 3) Required Workflow

1. Read the relevant `MinimaAds.md` sections first.
2. Check `docs/KNOWN_ISSUES.md` for known fragility points or open bugs in the touched area.
3. If Minima platform behavior is unclear, consult source and official docs under `refs/`. See `CLAUDE.md §8` for the lookup table.
4. Identify affected layers before editing.
5. Implement in dependency order.
6. Validate contracts, schema parity, Maxima fields, and `poll:false`.
7. Update `AGENTS.md` and, when needed, the relevant `docs/` reference file.

Layer map:

| Layer | Files | MinimaAds.md ref |
|---|---|---|
| Core | `core/*.js` | §7 |
| Service Worker | `service.js`, `public/service-workers/handlers/*.js`, `public/service-workers/db-init.js` | §11 |
| Database schema | `public/service-workers/db-init.js` plus FE initialization | §3.5 |
| SDK | `sdk/index.js` | §13 |
| UI / MiniDapp | `dapp/app.js`, `dapp/views/*.js` | §12.1 |

Implementation order:

1. DB schema, if needed, in both runtimes.
2. Core.
3. Service Worker handlers.
4. SDK.
5. UI.

---

## 3.5) Contracts, Forbidden Actions, Platform Rules

These are defined in `CLAUDE.md` (always loaded). Do not repeat them here.

- **Stable Core API signatures** → `CLAUDE.md §5`
- **Forbidden actions** → `CLAUDE.md §6`
- **Rhino / H2 / MDS / Maxima runtime constraints** → `CLAUDE.md §7`
- **Full platform detail** → `docs/PLATFORM_NOTES.md`

Additional constraints not in CLAUDE.md:
- Do not call `MDS.sql` directly outside `core/minima.js` (except legacy FE code predating the wrapper — prefer the wrapper for new code).
- `maxima action:sendall` does not support `poll:false` — that is the one documented exception to the poll:false rule.
- SDK public API (`sdk/index.js`) is an external publisher contract. Treat any change as breaking unless explicitly approved.

---

## 4) Project Rules

Full project notes live in `docs/PROJECT_NOTES.md` (topology, schema) and `docs/PROJECT_NOTES_REFERENCE.md` (protocol detail, signals, source-of-truth rules).

Project identity:
- MinimaAds is a decentralized advertising infrastructure MiniDapp.
- Viewers earn for ad views/clicks.
- Creators fund campaigns through Minima token escrow.
- Publishers operate Frames and earn publisher rewards.

Canonical identities:
- `USER_PROFILE.ADDRESS` and `CAMPAIGN.CREATOR_ADDRESS` are Maxima public keys.
- `FRAMES.FRAME_ID` for the built-in frame is `builtin:<MAXIMA_PK>`.
- `CAMPAIGNS.ESCROW_WALLET_PK` is a wallet signing key, not a Maxima key.

Key architectural decisions (non-obvious — read before assuming):

| Decision | Rationale |
|---|---|
| Reward processing is FE-owned, not SW | FE and SW share the same H2 DB; SW adds complexity with no security benefit — KissVM is the real boundary |
| `CREATOR_ADDRESS` uses Maxima PK, not wallet address | Maxima PK is the stable node identity; wallet address can change and is not used for Maxima routing |
| `broadcastMaxima` uses `sendall` | `maxima action:sendall` is always background; poll stack cap doesn't apply |
| Built-in Frame ID = `'builtin:' + maxima_pk.toUpperCase()` | Deterministic, idempotent, unique per node — avoids requiring manual "install" |
| Publisher rewards reuse channel infra with `ROLE` discriminator | `CHANNEL_STATE` PK is `(campaign_id, viewer_key, role)` — same lifecycle, same handlers, same contract |
| Single budget covers viewer + publisher rewards | `MAX_PUBLISHER_BUDGET` is a capped subset of `BUDGET_TOTAL` — simpler UI and escrow |
| `PLATFORM_KEY` enforced on-chain via KissVM PREVSTATE(5) | Tampering `config.js` on one node is self-defeating — every other node rejects the campaign. MVP: `null` (validation skipped) |
| No `TextEncoder` in SW | Rhino doesn't support it — use pure-JS `utf8ToHex` |
| `VERIFYOUT` requires 5 params | `VERIFYOUT(idx addr amt tokenid keepstate_bool)` — older docs had 4 |
| `PUBLISHER_MX_<campaignId>` keypair on viewer nodes | Cached from `PENDING_REWARD` when channel opens; used as fallback in `_sendRewardRequest` when `MINIMAADS_CREATOR_ROUTE` is not set locally |

Important files:

| File | Responsibility |
|---|---|
| `service.js` | Runtime SW entry point |
| `public/service-workers/db-init.js` | SW schema initialization |
| `dapp/app.js` | FE entry point, routing, MDS event dispatch |
| `dapp/views/*.js` | UI views |
| `core/*.js` | Business logic |
| `sdk/index.js` | External publisher SDK |
| `renderer/renderAd.js` | Ad DOM renderer |

---

## 5) Validation Checklist

Before final handoff:

- Function signatures still match `MinimaAds.md §7`.
- Maxima message schemas still match `MinimaAds.md §8`.
- Outbound Maxima sends use `poll:false`, or documented `sendall`.
- DB schema changes are applied in both runtimes.
- SQL string inputs are escaped.
- Public key comparisons normalize case.
- `LIMITS` values are not duplicated inline.
- Creator self-reward checks remain in selection and validation paths.
- New or changed SW signals are handled in FE.
- `AGENTS.md` and relevant `docs/` files are updated.

For verification procedures, see `docs/archive/VERIFICATION.md`.

---

## 6) Current Handoff Notes

> **Rule**: keep the 3 most recent session entries here. Before adding a new entry, move the oldest one to `docs/HISTORY.md §17`. This section is loaded every session — keep keep it short.

### Session: 2026-09-04 (Fix #14) — `PUBLISHER_MX` missing from FE `FRAMES` schema

**Source**: `docs/IMPLEMENTATION_PLAN_2026-07-18.md` Phase 3, Fix #14 — natural follow-up to this session's Fix #20, which found and fixed the same category of FE/SW schema drift on `CHANNEL_STATE`. Implemented directly by this (Sonnet) session, no delegation.

**Fix** (`dapp/app.js` `initFEFrames`): added `PUBLISHER_MX VARCHAR(512) DEFAULT ''` to the FE `CREATE TABLE IF NOT EXISTS FRAMES (...)`, copied verbatim from the SW's already-correct definition (`db-init.js` `sql_frames`), plus the matching `ALTER TABLE FRAMES ADD COLUMN IF NOT EXISTS PUBLISHER_MX VARCHAR(512) DEFAULT ''` migration for already-installed FE tables (mirrors `db-init.js:158`). This was a real, exploitable bug, not just a latent one: `dapp/views/frames.js:246` directly runs `SELECT PUBLISHER_KEY, PUBLISHER_MX FROM FRAMES` against the FE's own local table — with the column missing, that query would throw a "column not found" SQL error. Diffed both `FRAMES` definitions column-for-column per the plan's step 3 — after this fix they match exactly, no further drift found.

**Verification — live**, after redeploying via "Zip & Install to Nodes" (6 nodes, all Success). On Node 1's MinimaAds tab (`browser_evaluate` worked normally): inserted a `FRAMES` row with a `PUBLISHER_MX` value via the FE's own `sqlQuery`, read it back — round-tripped correctly, no error. Confirmed against an **already-initialized** table (1 pre-existing frame, the built-in one from boot), not just a fresh CREATE, proving the `ADD COLUMN IF NOT EXISTS` migration path works on existing installs too. Test row deleted afterward.

**Files modified**: `dapp/app.js`.

**AGENTS.md updated**: yes — this entry; oldest entry (2026-09-04, Fix #6) moved to `docs/HISTORY.md §17`.

**Open issues**: none new. Remaining Phase 3 items: Fix #8 (block-based expiry — highest-risk item, needs dedicated planning/clock-skew testing), Fix #9 (delete ~700 lines of dead `DO_*` FE builders), Fix #10 (wire `ESCROW_INFO` round-trip).

---

### Session: 2026-09-04 (Fix #20) — Removed dead `ALTER COLUMN` statements in db-init.js + FE VIEWER_KEY parity fix

**Source**: `docs/IMPLEMENTATION_PLAN_2026-07-18.md` Phase 3, Fix #20. Implemented directly by this (Sonnet) session, no delegation.

**Fix** (`public/service-workers/db-init.js`): removed two `sqlQuery("ALTER TABLE ... ALTER COLUMN ...", ...)` calls (`REWARD_EVENTS.PUBLISHER_ID`, `CHANNEL_STATE.VIEWER_KEY`) whose target column defs were **already** present verbatim in the `CREATE TABLE IF NOT EXISTS` statements above them — both were dead leftovers from an earlier migration that had already been folded into the CREATE, so per the plan's step 1 there was nothing left to fold; just deleted the two calls and un-nested their callback bodies by one level each (matching `}); // end ... migration` closers removed too). Per `docs/KNOWN_ISSUES.md §4` (dev DBs reset on reinstall, CREATE is the source of truth) no belt-and-suspenders replacement was added — the audit's core complaint was that a raw `ALTER COLUMN` failure aborts the rest of `initDB`'s callback chain silently; removing the dead calls removes that specific risk outright.

**Bonus finding, fixed in scope** (same column, same concern as this fix, CLAUDE.md's DB-parity checklist item): while confirming the SW's `CHANNEL_STATE.VIEWER_KEY VARCHAR(512)` was already correct, found the FE's own `initFEChannelState` (`dapp/app.js`) had never been updated to match — it still defined `VIEWER_KEY VARCHAR(66)`. `VIEWER_KEY` holds a full Maxima public key (200+ chars, e.g. the RSA-style keys seen throughout this session's testing), so this was a live truncation/data-loss risk on any FE-side write path. Widened to `VARCHAR(512)` to match the SW. Checked `SPLIT_COINID` (SW-only column, present in `CHANNEL_STATE` migrations but absent from the FE definition) — confirmed via grep it's never read/written from any FE file, purely internal SW bookkeeping for escrow split-coin retries, so its absence on the FE is not a parity bug and was left alone.

**Verification — live**, after redeploying via "Zip & Install to Nodes" (6 nodes, all Success). `browser_evaluate` worked normally this time (no repeat of the silent-decline pattern from earlier fixes this session). On a freshly-booted node: `sqlQuery` round-trips against `CHANNEL_STATE`/`REWARD_EVENTS`/`CAMPAIGNS` all succeeded with no errors (confirms `initDB` completes cleanly post-removal, no regression from deleting the two `ALTER COLUMN` calls). Directly tested the `VIEWER_KEY` widening: inserted a 252-character `VIEWER_KEY` into `CHANNEL_STATE` (well over the old `VARCHAR(66)` limit) — stored and read back at the full 252 chars, no truncation, no error. Test row deleted afterward.

**Files modified**: `public/service-workers/db-init.js`, `dapp/app.js`.

**AGENTS.md updated**: yes — this entry; oldest entry (2026-09-04, Fix #5) moved to `docs/HISTORY.md §17`.

**Open issues**: none new. Remaining Phase 3 items: Fix #8 (block-based expiry — flagged in the plan as the highest-risk Phase 3 item, needs dedicated clock-skew testing, candidate for its own planning session), Fix #9 (delete ~700 lines of dead `DO_*` FE builders), Fix #10 (wire `ESCROW_INFO` round-trip), Fix #14 (`PUBLISHER_MX` FE `FRAMES` schema parity — same category of bug as this session's bonus finding, worth doing together with a full FE/SW `FRAMES` diff).

---

### Session: 2026-09-04 (Fix #7) — `comms.handler.js` view/click no longer double-debits budget (M-4)

**Source**: `docs/IMPLEMENTATION_PLAN_2026-07-18.md` Phase 3, Fix #7. Implemented directly by this (Sonnet) session, no delegation.

**Fix**: `handleTrackView`/`handleTrackClick` (`comms.handler.js`) — removed the direct `updateBudget(campaignId, amount, cb)` call and its `budErr` branch from both; the confirm broadcast/`signalFE`/`_triggerChannelPayment` call sequence is otherwise unchanged, just no longer nested inside the `updateBudget` callback. Added the M-4 comment from the plan so a future agent doesn't "fix" it back. This was a genuine double-accounting bug: `core/rewards.js`'s `createRewardEvent` already skips `updateBudget` for `type === 'view'\|'click'` (pre-existing M-4 fix — `BUDGET_REMAINING` is on-chain-synced via `processEscrowCoin` instead), but `comms.handler.js`'s separate `MA_TRACK_VIEW`/`MA_TRACK_CLICK` path (same-device `MDS.comms.solo`/`broadcast`, used by external host MiniDapps embedding the SDK — not the dapp's own direct `createRewardEvent` call) was still debiting locally on every call, risking a campaign flipping to `'finished'` prematurely from cross-dapp view/click traffic alone.

**Verification — live**, after redeploying via "Zip & Install to Nodes" (6 nodes, all Success). `browser_evaluate` was silently declined again this session (see Fix #5's entry in `docs/HISTORY.md §17` for the established pattern) — handed the test script to the maintainer to paste into a MinimaAds tab's DevTools console instead. Script seeded a `CAMPAIGNS` row (`BUDGET_REMAINING=5`), called `MDS.comms.solo(JSON.stringify({type:'MA_TRACK_VIEW', campaignId, userAddress, ...}))` (the exact same-device path `handleTrackView` listens on), waited, then re-read `BUDGET_REMAINING`. Result: `budgetAfter: "5.000000"` — unchanged from `budgetBefore: 5` (pre-fix this would have dropped to `4.99`). Test row deleted afterward.

**Files modified**: `public/service-workers/handlers/comms.handler.js`, `docs/KNOWN_ISSUES.md`.

**AGENTS.md updated**: yes — this entry; oldest entry (2026-09-04, Fix #12 + AUD-5) moved to `docs/HISTORY.md §17`.

**Open issues**: logged `DOC-1` in `docs/KNOWN_ISSUES.md §3.5` (new row, not security) — `MinimaAds.md §6.1`/`§6.2`'s SDK view/click flow diagrams still describe the pre-M-4 `updateBudget` call, stale relative to `core/rewards.js`'s already-fixed behavior; discovered while implementing this fix but out of scope (different file/flow section, predates this session). Not fixed inline per CLAUDE.md multi-agent safety rules.

---

> Previous handoff notes (AUD-1, patches 15–25, Security Audit 2, and all earlier) are archived in `docs/HISTORY.md §17`.

