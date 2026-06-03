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
| Project topology, DB mirror, protocols, signals | `docs/PROJECT_NOTES.md` (and `PROJECT_NOTES_REFERENCE.md` if needed) |
| Fragility points and open bugs | `docs/KNOWN_ISSUES.md` |
| Active task list | `docs/TASKS.md` |
| New session prompt template | `docs/PromptBase.md` |
| Verification workflow | `docs/VERIFICATION.md` |
| Long change history | `docs/HISTORY.md` |
| UI-only tasks (views, CSS, copy) | `docs/UI_GUIDE.md` |

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

## 3) Contracts, Forbidden Actions, Platform Rules

These are defined in `CLAUDE.md` (always loaded). Do not repeat them here.

- **Stable Core API signatures** → `CLAUDE.md §4`
- **Forbidden actions** → `CLAUDE.md §5`
- **Rhino / H2 / MDS / Maxima runtime constraints** → `CLAUDE.md §6`
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

For verification procedures, see `docs/VERIFICATION.md`.

---

## 6) Current Handoff Notes

> **Rule**: keep the 3 most recent session entries here. Before adding a new entry, move the oldest one to `docs/HISTORY.md §17`. This section is loaded every session — keep it short.

2026-06-03 (fix: CREATOR_LIVENESS_PING regression — revert auto-init hack, restore proper SDK initialization):
- **Problem**: Viewer receives `confirmed: false, reason: 'creator offline'` when calling `trackView()`, even when creator is reachable. PING messages sent to creator had empty `viewer_mx` field, so creator had no return route for PONG; ping timed out and liveness check failed.
- **Root cause**: Recent change added auto-init hack in `_trackEvent` that set `_inited = true` without calling `_completeInit()`, leaving `_myMx` uninitialized. When `_sendLivenessPing()` referenced `_myMx` directly, it was empty.
- **Solution**:
  1. Removed simple auto-init hack from `_trackEvent` (lines 862-865).
  2. Replaced with proper `init()` call in `_trackEvent` when `_inited === false`, ensuring `_completeInit()` runs and populates `_myMx`.
  3. Fixed `_sendLivenessPing()` to use `_myMxAddress()` instead of `_myMx`, respecting both local `_myMx` and global `MY_MX_ADDRESS` override from FE.
  4. Updated `init()` condition (line 113) to detect if MDS.init already called by checking `typeof MDS.sql === 'function'`, preventing duplicate `MDS.init()` calls when running inside main app where dapp/app.js already initialized MDS.
- **Files**: `sdk/index.js`.
- **AGENTS.md updated**: yes — this entry.
- **Verification**: (1) Viewer loads MinimaAds, calls getAd() to fetch campaign. (2) Viewer waits 3s and calls trackView(). (3) SDK auto-initializes, populates _myMx, sends PING to creator with valid viewer_mx. (4) Creator receives PING, sends PONG back. (5) Viewer receives PONG, liveness check passes. (6) trackView() returns `confirmed: true` with event ID. (7) Channel opens, reward is created. (8) Creator sends REWARD_VOUCHER via Maxima. (9) Viewer settles channel on-chain.

2026-06-03 (feat: campaign daily & publisher reward limits validation and hints):
- **Problem**: Creators could configure daily limits that exceed the max reward per viewer, or set a publisher reward per view that exceeds the publisher budget or total campaign budget.
- **Solution**:
  - Added dynamic validation helper `enforceDailyLimits(form)` in `dapp/views/creator.js` to update hints under view/click limits, clamp input bounds, and validate on submit.
  - Added dynamic validation helper `enforcePublisherLimits(form)` to ensure `max_publisher_budget >= publisher_reward_view` and `publisher_reward_view <= budget`, updating corresponding UI hints and clamping inputs. Also dynamically caps the maximum publisher budget and reward based on the remaining budget after viewer cap allocation (`budget - max_viewer_reward`).
  - Added dynamic validation helper `enforceViewerRewardLimits(form)` to enforce `reward_view` and `reward_click` are capped by the allowed budget, displaying dynamic help hints showing minimum limits and max limits.
  - Enforced all sets of checks in form submit validations (`onCreatorSubmit`), including ensuring that `max_viewer_reward + max_publisher_budget <= budget`.
  - Removed "optional" label from `publisher_reward_view` and raised `LIMITS.MIN_PUBLISHER_REWARD_VIEW` from `0.001` to `0.01` in `dapp/app.js`, `service.js` and `MinimaAds.md`. Clamped `publisher_reward_view` to the new `0.01` minimum when active.
  - Lowered `LIMITS.MIN_REWARD_CLICK` from `0.005` to `0.001` in `dapp/app.js`, `service.js`, and `MinimaAds.md` to align with the new click limit.
  - Refactored `formatMinima` in `dapp/views/creator.js` to strip trailing decimal zeroes (e.g. formatting `0.001000` to `0.001` and `10.000000` to `10`).
  - Updated `enforceCapMinimum(form)` to enforce `max_viewer_reward` is capped at `budget - max_publisher_budget`, updating hints dynamically.
- **Files**: `dapp/views/creator.js`, `dapp/app.js`, `service.js`, `MinimaAds.md`.
- **AGENTS.md updated**: yes — this entry.
- **No contract changes**: UI validation and limit adjustment only.
- **Verification**: Go to Creator tab, input Max reward per viewer = 10, Reward per view = 1. The Daily view limit input will be capped at 10. Go to Publisher rewards, set total campaign budget = 100, set publisher reward per view = 0.005. The reward will clamp to 0.01 immediately, displaying a hint under both fields. The reward per view and click inputs will display hints showing Min: 0.001 MINIMA and Max: 100 MINIMA. Trailing zeroes are stripped (e.g. 0.001 instead of 0.001000). Increasing the viewer cap reduces the allowed publisher budget max limit, and vice-versa. Attempting to submit a form where `max_viewer_reward + max_publisher_budget > budget` returns a clear error message.


2026-06-02 (fix: CREATOR_LIVENESS_PING race condition — Haiku-level fix):
- **Problem**: PING messages were sent with empty `viewer_mx` field when `_myMx` initialization wasn't complete, causing PONG failures and confusing `ok:false` logs.
- **Root cause**: Race condition — `_checkCreatorLiveness()` could execute before `_mxReady` flag was set (async `maxima action:info` in `_completeInit`).
- **Solution 1** (`core/minima.js`): Enhanced `sendMaxima()` logging to show exactly which route failed and why (publickey vs mxAddress). Now logs payload type, error details, and fallback attempts.
- **Solution 2** (`sdk/index.js`): Added `_mxReady` flag + `_mxReadyCallbacks` queue. `_checkCreatorLiveness()` now waits for `_mxReady` before sending PING. Callbacks are drained when maxima info completes.
- **Solution 3** (`sdk/index.js`): Fixed `_sendLivenessPing()` to use `_myMxAddress()` instead of `_myMx` directly, respecting global `MY_MX_ADDRESS` if provided by host.
- **Solution 4** (`sdk/index.js`): Also increased `LIVENESS_TIMEOUT_MS` from 3000 to 5000 for better reliability in slow networks.
- **Files**: `core/minima.js`, `sdk/index.js`.
- **AGENTS.md updated**: yes — this entry.
- **No contract changes**: logging and initialization order only.
- **Verification**: Send PING from viewer → check SW logs for `[MAXIMA]` entries showing routing and status. On creator side, check `[LIVENESS]` logs showing PONG sent with `ok:true`.

2026-06-01 (feat: PROFILE_REQUEST/RESPONSE — creator avatar and name for non-contact campaigns):
- **New Maxima messages**: `PROFILE_REQUEST` (§8.17) and `PROFILE_RESPONSE` (§8.18) in MinimaAds.md.
- **New SW→FE signal**: `PROFILE_RECEIVED { publickey, name, icon }` — added to §8.15 signal table.
- **`public/service-workers/handlers/campaign.handler.js`**: Added `handleProfileRequest(payload, senderPk)` — calls `maxima action:info`, reads `name` and `icon`, sends `PROFILE_RESPONSE` back via `sendMaxima(senderPk, null, ...)`. Added `handleProfileResponse(payload)` — calls `signalFE("PROFILE_RECEIVED", { publickey, name, icon })`.
- **`public/service-workers/handlers/maxima.handler.js`**: Added two branches — `PROFILE_REQUEST` (passes `msg.data.from` as senderPk) and `PROFILE_RESPONSE`.
- **`dapp/views/viewer.js`**: `_buildCampaignRow` now sets `data-creator-pk`, `class="ma-row-avatar"` (with `data-letter` fallback), and `class="ma-row-body"`. `_loadAndRenderList` calls `_fetchNonContactProfiles(campaigns, contactsMap)` after rendering rows. New functions: `_fetchNonContactProfiles`, `_loadOrRequestProfile`, `_sendProfileRequest`, `_applyProfileToRow`, `onProfileReceived`. Profile cached in keypair as `CREATOR_PROFILE_<PK>`.
- **`dapp/app.js`**: Added `PROFILE_RECEIVED` dispatch in `handleMdsComms` → `onProfileReceived(parsed)`.
- **Flow**: viewer renders list → for each creator not in contacts, checks keypair cache → if not cached, sends PROFILE_REQUEST (poll:false) → creator SW responds with PROFILE_RESPONSE → viewer SW signals PROFILE_RECEIVED → FE updates avatar/name in-place and caches to keypair. Graceful fallback: letter avatar shown until profile arrives.
- **No contract changes**: UI + new Maxima messages only. DB schema unchanged.

> Previous handoff notes (T-SC1–T-SC7, VW-1–VW-3, UI sessions 2–13, and all earlier) are archived in `docs/HISTORY.md §17`.


