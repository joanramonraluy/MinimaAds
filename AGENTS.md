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

### Session: 2026-09-05 (Fix #18) — Reward-ID collision resistance across all five generation sites

**Source**: `docs/IMPLEMENTATION_PLAN_2026-07-18.md` Phase 4, Fix #18. Complexity LOW (per rubric, though it touches ID-generation logic), maintainer confirmed Sonnet directly (no delegation). Implemented in this same session's context.

**Problem**: `Date.now().toString(16) + '-' + Math.floor(Math.random() * 0xFFFFFFFF).toString(16)` can produce identical IDs when two events land in the same millisecond (rapid clicks). This ID becomes `REWARD_EVENTS.ID`/`DEDUP_LOG.ID` downstream — a collision silently drops the second reward as a "duplicate", i.e. a real user-facing loss of funds, not just a data-hygiene issue.

**Sites fixed** (the plan named four; a fifth was found and included — see below):
1. `core/rewards.js` `_generateRewardId()` — canonical fallback used by `createRewardEvent`.
2. `public/service-workers/handlers/comms.handler.js` — two identical inline generations (`handleTrackView`/`handleTrackClick`) consolidated into one shared `_generateCommsEventId()` with its own counter (`_commsEventIdCounter`, distinctly named from `core/rewards.js`'s counter since both `MDS.load()` into the same SW global scope — same top-level `var` name across files loaded that way would silently reset each other).
3. `dapp/app.js` `generateUID()` — backs `CAMPAIGNS.ID`, `ADS.ID`, `FRAMES.FRAME_ID`, and settlement txIds; same collision class.
4. **`sdk/index.js`** — **not in the original plan's four sites, but the most consequential one**: `channel.handler.js` (`createRewardEvent({id: ctx.eventId, ...})`) uses the eventId the *viewer's SDK* generated client-side as the literal `REWARD_EVENTS.ID` — so the SDK-side generator was actually more load-bearing than `core/rewards.js`'s own fallback for the common reward path. Fixed both of its inline sites (`doCreateReward()`'s `eventId`, and `_sendPublisherRewardRequest`'s `evtId` — which had even weaker entropy, `0xFFFF` instead of `0xFFFFFFFF`) via a new `_generateSdkEventId(prefix)` helper scoped inside the SDK's existing IIFE (no cross-file collision risk — its `var`s are private to the closure, unlike the SW files).

**Fix pattern** (identical everywhere, Rhino-safe where required — `var`, `function()`, string concat, no arrows/template literals): a monotonic per-scope counter (mod `0xFFFF`) plus a second `0xFFFFFFFF` random segment appended to the existing timestamp+random pair. Format stays prefix-compatible (nothing parses these IDs, per the plan) — `'pub_'` prefix on the publisher-reward site preserved via the `prefix` param.

**Schema check**: `REWARD_EVENTS.ID`/`DEDUP_LOG.ID` are `VARCHAR(256)` — the new ~35–40 char IDs fit with wide margin, no migration needed in either runtime.

**Out of scope, deliberately not touched**: `dapp/views/earnings.js`'s `settleId` (`'stl_' + Date.now().toString(16)`) — this is a transient Minima `txnimport`/`txnsign`/`txnpost id:` builder handle, deleted (`txndelete`) at the end of each settlement attempt, not a DB primary key. Different risk class, out of this fix's scope.

**Verification**: `node --check` passed on all four touched files (`core/rewards.js`, `comms.handler.js`, `dapp/app.js`, `sdk/index.js`). Grepped for the old weak pattern project-wide after the edit — zero remaining hits outside this fix's own new helper functions.

**Files modified**: `core/rewards.js`, `public/service-workers/handlers/comms.handler.js`, `dapp/app.js`, `sdk/index.js`.

**AGENTS.md updated**: yes — this entry; oldest entry (2026-09-04, Fix #9 + Fix #10) moved to `docs/HISTORY.md §17`.

**Sections updated**: none in `MinimaAds.md` — the ID format was never a documented contract ("nothing parses these IDs"), so no spec drift was introduced.

**Open issues**: none new. Remaining Phase 4 item: Fix #15 (voucher-loss self-healing via `VOUCHER_SYNC_REQUEST`) — the last item on the audit plan, MEDIUM complexity, needs live verification with a corrupted `LATEST_TX_HEX` in devtools.

---

### Session: 2026-09-05 (Fix #19 + Fix #17) — Resolve AUTO_SETTLE signal lift (cleanup, multi-session completion)

**Source**: Fix #19 (log noise in `_maxDelivered` 'delivery failed' line) + Fix #17 (lift deprecated `AUTO_SETTLE` signal type). Prior execution halted mid-Fix #17 part 2 by infrastructure rate limit (not code error). Previous sessions completed Fix #19 and Fix #17 part 1 (dispatcher removal). This session: finish parts 2–3 (function deletion + documentation updates).

**Fix #19 status** (completed in prior execution, not re-touched): `core/minima.js:71` already has the reduced log: `MDS.log("[MINIMA] " + label + " delivery failed: delivered=" + delivered + " error=" + err);` without the per-delivery noise. ✓

**Fix #17 part 1 status** (completed in prior execution, not re-touched): `dapp/app.js`'s `AUTO_SETTLE` dispatcher block already removed. `grep -n "AUTO_SETTLE" dapp/app.js` confirmed: no hits. ✓

**Fix #17 part 2** (`dapp/views/earnings.js`): 
- Removed the dead handler function `onAutoSettle` (was lines 654–664, unreferenced after part 1 dispatcher removal).
- Updated the file's header comment (line 5): removed `onAutoSettle` from the handlers list (now: `onChannelOpened, onVoucherReceived, onSettleConfirmed`).
- Kept `onSettleConfirmed`, `_runSettlement`, and `_postSettleTx` untouched (still active).
- Verified: `node --check dapp/views/earnings.js` passes syntax validation.

**Fix #17 part 3** (`MinimaAds.md`):
1. **§8.15 (signal table, line ~1357)**: removed the row for `AUTO_SETTLE` signal type. `CAMPAIGN_AUTOSETTLE_REQUEST` row stays (now line 1357).
2. **§6.7 (Automatic trigger block, lines ~636–639)**: replaced the old AUTO_SETTLE logic with the new CAMPAIGN_AUTOSETTLE_REQUEST + `_autoSettleOpenChannels` flow:
   ```
   OLD: SW detects finished → signalFE('AUTO_SETTLE', { ... })
   NEW: SW detects finished with settling:true → creator's autoSettleChannelsForCampaign() emits
        CAMPAIGN_AUTOSETTLE_REQUEST → viewer's _autoSettleOpenChannels processes it
   ```
3. **§11.2 (NEWBLOCK event handler, line ~1495)**: updated the Action column from
   `"trigger AUTO_SETTLE signal for expired campaigns"` to
   `"expired campaigns finishing triggers the auto-settle flow (§6.7: CAMPAIGN_AUTOSETTLE_REQUEST + viewer _autoSettleOpenChannels)"`.

**Validation**:
- `grep -rn "AUTO_SETTLE" --include=*.js .` in repo: only matches now are `CAMPAIGN_AUTOSETTLE_REQUEST` (the kept signal) and comments referencing it — zero bare `'AUTO_SETTLE'` or `onAutoSettle` references remain. ✓
- `grep -n "AUTO_SETTLE" MinimaAds.md`: only `CAMPAIGN_AUTOSETTLE_REQUEST` remains. ✓
- `node --check dapp/views/earnings.js`: syntax valid. ✓

**Files modified**: `dapp/views/earnings.js`, `MinimaAds.md`.

**AGENTS.md updated**: yes — this entry added; oldest entry (Fix #14, 2026-09-04) moved to `docs/HISTORY.md §17` per the 3-entry rule.

**Open issues**: none new.

---

### Session: 2026-09-04 (Fix #16 + Fix #13) — LIMITS mismatch sync + dynamic channel script timelock

**Source**: `docs/IMPLEMENTATION_PLAN_2026-07-18.md` Phase 3, Fix #16 and accompanying Fix #13 (bonus discovery). Decisions pre-taken by maintainer via project instructions. Implemented directly by this (Haiku) session, no delegation needed.

**Fix #16** (LIMITS sync across three files):
- `MinimaAds.md` first LIMITS block (line ~423): corrected `MIN_REWARD_CLICK: 0.001 → 0.005` and `MIN_PUBLISHER_REWARD_VIEW: 0.01 → 0.001` to match actual enforced values in `service.js`; added `MAX_CHANNEL_RESERVATION: 10` and `SETTLEMENT_GRACE_DAYS: 7` (already present in SW, now documented).
- `MinimaAds.md` table 5.1 Limit Definitions: updated `MIN_REWARD_CLICK` row from 0.001 to 0.005; reordered columns to put `MIN_PUBLISHER_REWARD_VIEW` after `MAX_CAMPAIGN_DAYS` for clarity; added two new rows for `MAX_CHANNEL_RESERVATION` (enforcement point: channel.handler.js / comms.handler.js / SDK) and `SETTLEMENT_GRACE_DAYS` (enforcement point: service.js buildChannelScript() timelock).
- `MinimaAds.md` second LIMITS block (line ~1456, copy-paste example in §11.1): identical corrections and additions as first block, to maintain parity.
- `dapp/app.js` LIMITS block: added `MAX_CHANNEL_RESERVATION: 10` and `SETTLEMENT_GRACE_DAYS: 7` (values were already correct for click/view rewards).

**Fix #13** (bonus, discovered during validation): `dapp/views/creator.js` line 1515-1516 had the channel script timelock hardcoded as literal `167616` with a comment claiming it mirrored `service.js buildChannelScript()`. But `buildChannelScript()` computes `(MAX_CAMPAIGN_DAYS + SETTLEMENT_GRACE_DAYS) * 1728` dynamically, so if either constant ever changed, the hardcoded value would silently drift. Refactored: defined `buildChannelScriptFE()` function that mirrors `service.js`'s approach exactly, then assigned `CHANNEL_SCRIPT_FE = buildChannelScriptFE()`. Script output remains `167616` identically (verified: (90+7)*1728 = 167616), no behavioral change — but now the timelock is recomputed from LIMITS at FE startup, preventing silent desync if either constant is updated in the future.

**Verification**: Manual calculation (90+7)*1728 = 97*1728 = 167,616 ✓. Node syntax check passed on both `dapp/app.js` and `dapp/views/creator.js`. Verified that `service.js` was not modified (already correct). Spot-checked `MinimaAds.md` to confirm no other references to these constants in contradictory contexts (Fix #13 bonus: updated §5.1 and §13.2 documentation for `MAX_CAMPAIGNS_PER_SESSION` to note it is deprecated/not enforced).

**Files modified**: `MinimaAds.md`, `dapp/app.js`, `dapp/views/creator.js`.

**AGENTS.md updated**: yes — this entry (new); oldest entry (2026-09-04, Fix #8) moved to `docs/HISTORY.md §17` (see below).

**Open issues**: none new.

---


> Previous handoff notes (AUD-1, patches 15–25, Security Audit 2, and all earlier) are archived in `docs/HISTORY.md §17`.

