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

### Session: 2026-09-04 (Fix #7) — `comms.handler.js` view/click no longer double-debits budget (M-4)

**Source**: `docs/IMPLEMENTATION_PLAN_2026-07-18.md` Phase 3, Fix #7. Implemented directly by this (Sonnet) session, no delegation.

**Fix**: `handleTrackView`/`handleTrackClick` (`comms.handler.js`) — removed the direct `updateBudget(campaignId, amount, cb)` call and its `budErr` branch from both; the confirm broadcast/`signalFE`/`_triggerChannelPayment` call sequence is otherwise unchanged, just no longer nested inside the `updateBudget` callback. Added the M-4 comment from the plan so a future agent doesn't "fix" it back. This was a genuine double-accounting bug: `core/rewards.js`'s `createRewardEvent` already skips `updateBudget` for `type === 'view'\|'click'` (pre-existing M-4 fix — `BUDGET_REMAINING` is on-chain-synced via `processEscrowCoin` instead), but `comms.handler.js`'s separate `MA_TRACK_VIEW`/`MA_TRACK_CLICK` path (same-device `MDS.comms.solo`/`broadcast`, used by external host MiniDapps embedding the SDK — not the dapp's own direct `createRewardEvent` call) was still debiting locally on every call, risking a campaign flipping to `'finished'` prematurely from cross-dapp view/click traffic alone.

**Verification — live**, after redeploying via "Zip & Install to Nodes" (6 nodes, all Success). `browser_evaluate` was silently declined again this session (see Fix #5's entry in `docs/HISTORY.md §17` for the established pattern) — handed the test script to the maintainer to paste into a MinimaAds tab's DevTools console instead. Script seeded a `CAMPAIGNS` row (`BUDGET_REMAINING=5`), called `MDS.comms.solo(JSON.stringify({type:'MA_TRACK_VIEW', campaignId, userAddress, ...}))` (the exact same-device path `handleTrackView` listens on), waited, then re-read `BUDGET_REMAINING`. Result: `budgetAfter: "5.000000"` — unchanged from `budgetBefore: 5` (pre-fix this would have dropped to `4.99`). Test row deleted afterward.

**Files modified**: `public/service-workers/handlers/comms.handler.js`, `docs/KNOWN_ISSUES.md`.

**AGENTS.md updated**: yes — this entry; oldest entry (2026-09-04, Fix #12 + AUD-5) moved to `docs/HISTORY.md §17`.

**Open issues**: logged `DOC-1` in `docs/KNOWN_ISSUES.md §3.5` (new row, not security) — `MinimaAds.md §6.1`/`§6.2`'s SDK view/click flow diagrams still describe the pre-M-4 `updateBudget` call, stale relative to `core/rewards.js`'s already-fixed behavior; discovered while implementing this fix but out of scope (different file/flow section, predates this session). Not fixed inline per CLAUDE.md multi-agent safety rules.

---

### Session: 2026-09-04 (Fix #6) — `relevant:false` bypassed PREVSTATE(5) fee validation

**Source**: `docs/IMPLEMENTATION_PLAN_2026-07-18.md` Phase 3, Fix #6 — first Phase 3 item, LOW complexity. Delegated to a Haiku subagent (hit the monthly spend limit mid-task after completing the code fix and half the housekeeping; parent Sonnet session verified the completed work and finished the remaining housekeeping — no code loss).

**Fix**: `campaign.handler.js`'s `_continueCampaignAnnounce` — `MDS.cmd("coins coinid:" + coinId + " relevant:false", ...)` → `MDS.cmd("coins coinid:" + coinId, ...)`. Per fragility #28 (AGENTS.md §3.5): Minima's `coins` RPC treats `relevant:` as a boolean *presence* check, not a value check, so `relevant:false` was being read as `relevant=true` and using `getRelevantCoins()` (wallet-filtered) instead of the intended `getAllCoins()` (full UTXO scan) — a remote creator's escrow coin was never found, so PREVSTATE(5) fee validation always silently fell through to the "coin not found, accepting" branch. Omitting `relevant:` entirely is the correct way to get `relevant=false` behavior. The "not found, accepting" fallback branch itself is untouched — it now just actually runs only when the coin is genuinely absent from the full UTXO scan, not on every call.

**Verification**: code-reading + `node --check public/service-workers/handlers/campaign.handler.js` (LOW complexity, 15-min estimate in the plan — no live node test performed, matching the plan's own effort sizing; the plan's suggested live test — announce from node A, receive on node B, confirm the PREVSTATE(5) log line executes — remains available for a future session if desired).

**Files modified**: `public/service-workers/handlers/campaign.handler.js`.

**AGENTS.md updated**: yes — this entry; oldest entry (2026-09-04, AUD-4) moved to `docs/HISTORY.md §17`.

**Open issues**: none new. Next per the plan: remaining Phase 3 items (Fix #7 through #10, #14, #20).

---

### Session: 2026-09-04 (Fix #5) — `_livenessCache` key normalization + status-less invalidation

**Source**: `docs/IMPLEMENTATION_PLAN_2026-07-18.md` Phase 2, Fix #5 — the last item blocking Phase 2 completion (Fix #12 landed earlier this session). Implemented directly by this (Sonnet) session, no delegation.

**Fix** (`sdk/index.js`):
- New `_livenessKey(campaignId)` helper (`.toUpperCase()`), routed through every read/write of `_livenessCache` (`getAd`'s filter, `_checkCreatorLiveness`, `_onCreatorLivenessPong`, `_onCampaignUpdatedCore`) — `campaign_id` reaches the cache from two sources (`campaign.ID` DB rows vs `parsed.campaign_id` from Maxima signals) with no guaranteed shared casing; without normalization a mismatch silently defeats the offline filter (fragility #12 pattern, applied to this in-memory map).
- `_onCampaignUpdatedCore`: a status-less `CAMPAIGN_UPDATED` (the shape `processEscrowCoin`'s budget-sync signals use) previously just returned, leaving a stale cached entry in place until natural expiry (`LIVENESS_CACHE_MS`, 30s) even if the campaign had come back online. Now **deletes** the cache entry instead, forcing the next `getAd()` to re-check.
- `campaign.handler.js`'s two budget-sync `signalFE("CAMPAIGN_UPDATED", ...)` calls in `processEscrowCoin` (step 3, preferred per the plan) now include `status: campaign.STATUS` from the already-loaded row, so the signal is self-sufficient and the SDK cache can refresh directly rather than falling back to the delete-and-recheck path.
- `MinimaAds.md §8.14` gained a paragraph documenting both changes.

**Verification — live**, after redeploying via "Zip & Install to Nodes" (all 5 nodes). Ran into the by-now-familiar `browser_evaluate` silent-decline issue from this session's own automated attempts (twice, no visible dialog) — rather than fighting it, handed the test script to the maintainer to paste directly into Node 3's MinimaAds tab DevTools console. Test monkey-patched the global `getCampaigns`/`selectAd` (both plain top-level functions, not SDK-internal) to observe exactly which campaign IDs reach ad selection, without needing any DB seeding:
1. Baseline (empty cache): `["fix5-test-1"]` visible.
2. `MinimaAds.onCreatorLivenessPong('FIX5-TEST-1', 'finished')` — deliberately uppercase, while the real ID is lowercase — then `getAd` again: `[]` (correctly filtered despite the casing mismatch, proving key normalization).
3. `MinimaAds.onCampaignUpdated({campaign_id: 'fix5-test-1'})` (no `status`) then `getAd` again: `["fix5-test-1"]` (cache entry deleted, campaign visible again instead of stuck offline).
All three matched expectations exactly. First attempt hit stale-session 500 errors on `megapoll`/`sql` (tab had been open since early in the session); confirmed Node 3 itself was healthy (`curl` 200 on `:9003`) and a full page reload of the MinimaAds tab fixed it — a fresh `uid` was all that was needed.

**Files modified**: `sdk/index.js`, `public/service-workers/handlers/campaign.handler.js`, `MinimaAds.md`.

**AGENTS.md updated**: yes — this entry; oldest entry (2026-09-04, AUD-3) moved to `docs/HISTORY.md §17`.

**Open issues**: none new. Phase 2 of `docs/IMPLEMENTATION_PLAN_2026-07-18.md` (Fix #5 + Fix #12) is now complete. AUD-2 (`sdk/index.js` viewer `REWARD_EVENTS` row never created on SDK's direct MAXIMA path) remains the only open item in `docs/KNOWN_ISSUES.md §3.5`. Next per the plan: Phase 3 (MEDIUM platform/integration — Fix #6 through #10, #14, #20).

---

> Previous handoff notes (AUD-1, patches 15–25, Security Audit 2, and all earlier) are archived in `docs/HISTORY.md §17`.

