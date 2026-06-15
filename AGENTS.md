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

For verification procedures, see `docs/VERIFICATION.md`.

---

## 6) Current Handoff Notes

> **Rule**: keep the 3 most recent session entries here. Before adding a new entry, move the oldest one to `docs/HISTORY.md §17`. This section is loaded every session — keep keep it short.

### Session: 2026-06-15 (patch 11) — Fix: viewer campaigns list stuck rendering

**Problem**:
If the campaigns list in `dapp/views/viewer.js` initially loaded 0 campaigns (before any campaigns were discovered or synced) or encountered an H2 SQL query error or missing element, the lock variable `_viewerState.listRendering` was left set to `true`. This blocked any subsequent updates or refreshes to the list (e.g. from `NEW_CAMPAIGN` / `CAMPAIGN_UPDATED` SW signals or block events), leaving the UI stuck on "No ads available right now." or "Loading campaigns..." forever.

**Fix**:
- **Viewer UI** (`dapp/views/viewer.js`): Added proper cleanup resets to ensure `_viewerState.listRendering = false` is executed on all return and exit paths (error handler, list element missing check, empty campaign list branch) inside the `_loadAndRenderList` SQL query callback.
- **MiniDapp Package**: Bumped version to `0.26.6.2` in `dapp.conf` and re-zipped the repository files into `MinimaAds.mds.zip`.

**Files modified**: `dapp/views/viewer.js`, `dapp.conf`, `MinimaAds.mds.zip`

**AGENTS.md updated**: yes — §6 updated, oldest entry (patch 9) moved to `docs/HISTORY.md §17`.

**Verification**: Reload the viewer page. Verify that list refreshes are not blocked and that newly discovered or modified campaigns appear dynamically on the View Ads list.

---

### Session: 2026-06-15 — Security N2-3: enforce `MAX_PUBLISHER_BUDGET` at voucher time

**Problem**: `MAX_PUBLISHER_BUDGET` was enforced only at publisher channel-open (via `SUM(CUMULATIVE_EARNED)`), never at voucher/payout time. Concurrent publishers can each open a channel while `SUM=0`, then collectively over-pay and spend into the viewer reward pool, violating the documented `MAX_PUBLISHER_BUDGET ⊆ BUDGET_TOTAL` invariant.

**Fix** (`public/service-workers/handlers/channel.handler.js`, 3 sites): before dispatching each publisher voucher, sum `CUMULATIVE_EARNED` across all `ROLE='publisher'` channels for the campaign and reject when `earnedAll − thisChannelOldCumulative + newCumulative > MAX_PUBLISHER_BUDGET + 1e-6`.
1. `_doGeneratePublisherVoucher` — added the SUM query after the per-channel `MAX_AMOUNT` check; remainder of the function moved into a hoisted `_continuePublisherVoucher()` inner function called from the callback.
2. `_replayDeferredPublisherRewardsNow` — same check before the deferred-replay `isDuplicate`/dispatch, wrapped in `_continueReplayPublisherVoucher()`.
3. Publisher branch of `_handleRewardRequestInner` — same check wrapping the `_swDispatchVoucher('publisher')` call.

All additions are Rhino-safe (`var`, `function()`, string concat, no trailing commas, `MDS.log`, `escapeSql`, UPPERCASE H2 row keys). SW-only — no FE mirror of this logic exists.

**Files modified**: `public/service-workers/handlers/channel.handler.js`, `docs/audit_report_2.md` (§10 tracker).

**AGENTS.md updated**: yes — §6 updated, oldest entry (patch 8) moved to `docs/HISTORY.md §17`.

**Verification**: On a two-node setup, configure a campaign with a small `MAX_PUBLISHER_BUDGET` (e.g. enough for ~2 publisher views) and open 3+ publisher channels concurrently (multiple frames/nodes) before any earnings record. Generate enough publisher views to push the aggregate past the cap. Expect: publisher vouchers settle only up to `MAX_PUBLISHER_BUDGET`; beyond that the SW logs `MAX_PUBLISHER_BUDGET exceeded. projected=… cap=…` and dispatches no further publisher voucher. Confirm viewer rewards are unaffected and no FE console errors.

---

### Session: 2026-06-14 (patch 10) — Fix: Reset click reward cooldown state, clear warning message, and improve channel opening status

**Problem**: 
1. Once a viewer was in click cooldown, any subsequent click on the CTA button showed a red warning message. However, after the cooldown expired:
   - The red warning message did not disappear and was instead replaced by a green success message (from the previous reward), which was confusing to the user.
   - The `rewardAllowed` state was never reset back to `true` on confirmed click rewards, meaning the viewer could not earn any subsequent click rewards in the same details page session.
2. The initial channel opening status message was not descriptive enough regarding the L1 blockchain transaction mining wait.

**Fix**:
- **Viewer UI** (`dapp/views/viewer.js`):
  1. Updated `onRewardValidation` click timers (both for confirmed rewards and cooldown rejections) to set `statusEl.textContent = ''` (clearing the message entirely) when the cooldown expires.
  2. Correctly set `_viewerState.rewardAllowed = true` when the confirmed click reward cooldown timer expires.
  3. Reset `statusEl.style.color = ''` to prevent the red warning color from leaking into the "Processing reward…" and "Reward confirmed…" status messages.
  4. Conditionalized the channel opening status message in `onRewardValidation` to show a detailed message when a new channel needs L1 block confirmation (`Opening secure channel (first time requires L1 block confirmation, ~60s). Once established, subsequent rewards will be near-instant!`) and a faster one for open channels (`Sending payment voucher…`).
  5. Implemented `onChannelOpened(parsed)` hook to dynamically update the session campaign channel status state to `'open'` when mined.

**Files modified**: `dapp/views/viewer.js`, `MinimaAds.mds.zip`

**AGENTS.md updated**: yes — §6 updated, oldest entry (patch 7) moved to `docs/HISTORY.md §17`.

**Verification**: Trigger a click reward and let it confirm. Stay on the details page. Verify that once the cooldown expires, the reward status message completely disappears and subsequent CTA clicks are correctly allowed. Verify that the first channel open warns about the L1 wait while subsequent ones show a direct voucher payment status.

---

> Previous handoff notes (T-SC1–T-SC7, VW-1–VW-3, UI sessions 2–13, Remove Section 1.3, Auto-Sync Platform Creator Route, Unify MLS DevTools, Fix Viewer and Publisher Reward Delivery, Fix Publisher Budget (Multi-Publisher Support), Fix Stale-Pending Publisher Channel Deadlock, Minima Foundation Fee (3%) + V4 Escrow Script Fixes, 2026-06-10 settlement fixes, Security audit T7/T9, and all earlier) are archived in `docs/HISTORY.md §17`.
