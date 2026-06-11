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

> **Rule**: keep the 3 most recent session entries here. Before adding a new entry, move the oldest one to `docs/HISTORY.md §17`. This section is loaded every session — keep it short.

### Session: 2026-06-11 — Redundant Profile item, Settings Redirection Flow, Scroll Reset, Viewer Status, & Campaign Redirect

**Task**:
1. Remove redundant "Profile" option from vertical drawer menu.
2. Fix jarring page reload/database reset when registering a permanent Maxima route in Settings.
3. Fix window not scrolling to top on route changes (resulting in home page loading scrolled down).
4. Update ad viewer status message to green "Reward received! +X.XX MINIMA" when payment voucher arrives.
5. Automatically redirect user to "My Campaigns" view after successfully creating/publishing a campaign.

**Fix**:
- **UI & Drawer cleanups**: Removed redundant drawer Profile button from `public/index.html` and unused `openProfileFromDrawer` from `dapp/app.js`.
- **Settings Redirection & Scroll Reset**: Replaced `location.reload()` callback with SPA routing (`goHome()`) in `dapp/views/settings-maxima-routes.js`. Added `window.scrollTo(0, 0)` at the beginning of `doRender()` in `dapp/app.js` to reset viewport scroll position on route/page transitions.
- **Viewer Status Update**: Implemented `onViewerVoucherReceived` in `dapp/views/viewer.js` and wired it to `VOUCHER_RECEIVED` event in `dapp/app.js` to change the status element's text and color upon payment voucher confirmation.
- **Campaign Redirect**: Modified `saveCampaignAndBroadcast` in `dapp/views/creator.js` to show a `"Campaign published successfully. Redirecting…"` message and perform a delayed SPA redirect (`window.location.hash = '#mycampaigns'`) after 1.5 seconds.

**Files modified**: `public/index.html`, `dapp/app.js`, `dapp/views/settings-maxima-routes.js`, `dapp/views/viewer.js`, `dapp/views/creator.js`, `MinimaAds.mds.zip`

**AGENTS.md updated**: yes — §6 updated.

---

### Session: 2026-06-11 — Fix built-in publisher reward not dispatched on channel open

**Task**: Built-in publisher (user4) opened a publisher channel successfully but received no REWARD_VOUCHER. Root cause: `_publisherChannelFlow()` in the SDK opens a new channel (STATUS='pending') but discards the pending `amount`. When CHANNEL_OPEN arrives, `_doChannelOpenUpsert()` checks `PENDING_REWARD_<campaignId>` (which is never set by the publisher flow) and does nothing. The CHANNEL_OPENED signal had no `role` field so the SDK couldn't distinguish viewer from publisher channels.

**Why built-in specifically**: Our earlier fix (`_isBuiltinFid` check in `_handleRewardRequestInner()`) correctly skips `_maybeGeneratePublisherVoucher()` for built-in frames to avoid duplicate vouchers. This means the creator never sends deferred rewards for built-in publishers — the publisher must self-dispatch via REWARD_REQUEST.

**Fix**:
- `channel.handler.js`: added `role` field to the CHANNEL_OPENED signal from `_doChannelOpenUpsert()`.
- `sdk/index.js` — `_publisherChannelFlow()`: for built-in frames, stores pending `amount` in `PENDING_PUB_REWARD_<campaignId>` keypair when opening a new channel or accumulating while pending.
- `sdk/index.js` — `_onChannelOpenedCore()`: when `role='publisher'`, retrieves `PENDING_PUB_REWARD_<campaignId>` and dispatches `_sendPublisherRewardRequest()`. Non-builtin frames still handled by creator-side deferred replay.

**Files modified**: `public/service-workers/handlers/channel.handler.js`, `sdk/index.js`

**AGENTS.md updated**: yes — §6 updated.

---

### Session: 2026-06-10 — Fix false settlement on node re-sync + remove optimistic settleChannel

**Task**: Two linked bugs around settlement:
1. `checkOpenChannelsSettled()` could prematurely settle channels when `coins address:CHANNEL_SCRIPT_ADDRESS` returned an empty array transiently (e.g. during MiniDapp reinit / node re-sync). Result: CHANNEL_STATE → 'settled', CHANNEL_HISTORY populated, but coin still active on L1. Viewer's wallet never receives the reward.
2. `_postSettleTx()` called `settleChannel()` optimistically after `txnpost` returns status:true, before L1 confirmation. If the tx fails to propagate, local DB is incorrectly marked 'settled' and the voucher disappears from the UI permanently.

**Fix**:
- `checkOpenChannelsSettled()`: before calling `settleChannel()`, verify the specific coin via `coins coinid:X relevant:true`. Only settle if the targeted query also confirms the coin is absent. Also added CUMULATIVE_EARNED to SELECT and `signalFE("SETTLE_CONFIRMED")` after successful settle, so earnings view auto-refreshes.
- `_postSettleTx()`: removed `settleChannel()` call after txnpost. Shows "Settlement posted. Awaiting L1 confirmation…" instead. The SW's `checkOpenChannelsSettled()` will call `settleChannel()` on the next NEWBLOCK once the coin is verifiably spent, then signals SETTLE_CONFIRMED to the FE.

**Files modified**: `public/service-workers/handlers/channel.handler.js`, `dapp/views/earnings.js`

**AGENTS.md updated**: yes — §6 updated.

---

> Previous handoff notes (T-SC1–T-SC7, VW-1–VW-3, UI sessions 2–13, Remove Section 1.3, Auto-Sync Platform Creator Route, Unify MLS DevTools, Fix Viewer and Publisher Reward Delivery, Fix Publisher Budget (Multi-Publisher Support), Fix Stale-Pending Publisher Channel Deadlock, Minima Foundation Fee (3%) + V4 Escrow Script Fixes, and all earlier) are archived in `docs/HISTORY.md §17`.


