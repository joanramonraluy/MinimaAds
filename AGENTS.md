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

### Session: 2026-06-15 (patch 18) — Fix: Campaigns discovery UI refresh & channel open collision resolution

**Problem**: The campaign discovery list did not automatically refresh when new campaigns were discovered. The routing structure uses the `#campaigns` route in viewer/creator/publisher modes (rendered by `campaigns.js`), but the message handler in `app.js` only checked `currentRoute() === 'viewer'` before calling `onCampaignsChanged()`, leaving the `#campaigns` page unrefreshed. Additionally, both `viewer.js` and `earnings.js` defined a global `onChannelOpened` handler, causing the latter to override the former and leaving the viewer's detail view without status update events when secure channels successfully open.

**Fix**:
- **App** (`dapp/app.js`):
  - In `handleMdsComms` (`NEW_CAMPAIGN` / `CAMPAIGN_UPDATED` branch), added a check for `currentRoute() === 'campaigns'` and triggered `_loadCampaigns()` to refresh the active campaigns list.
  - In the `CHANNEL_OPENED` branch, added an explicit call to `viewerOnChannelOpened(parsed)` alongside `onChannelOpened(parsed)`.
- **Viewer** (`dapp/views/viewer.js`):
  - Renamed the global `onChannelOpened` handler to `viewerOnChannelOpened` to avoid namespace collisions with `earnings.js`.
- **MiniDapp Package**: Bumped version to `0.26.6.8` in `dapp.conf` and updated the packaged `MinimaAds.mds.zip`.

**Files modified**: `dapp/app.js`, `dapp/views/viewer.js`, `dapp.conf`, `MinimaAds.mds.zip`

**AGENTS.md updated**: yes — §6 updated, oldest entry (patch 15) moved to `docs/HISTORY.md §17`.

**Verification**:
1. Navigate to the "View Ads" list and verify that newly discovered campaigns are rendered dynamically in the list.
2. Open a campaign's detail page, trigger a view, and verify that the status changes to `'open'` upon receiving the channel opening event.

---

### Session: 2026-06-15 (patch 17) — Fix: Implement payment channel synchronization and accrual recovery

**Problem**: When a viewer loses local state and a creator reopens a channel, the viewer's CUMULATIVE_EARNED resets to 0 while the creator expects it to continue from the previous balance, causing persistent "accrual delta invalid" errors. Additionally, pending rewards accumulated while the channel was inactive could be discarded.

**Fix**:
- **Service Worker** (`public/service-workers/handlers/channel.handler.js`):
  - Modified `handleChannelOpen()` to extract `cumulative_earned` and `latest_tx_hex` from CHANNEL_OPEN payload
  - Updated `_doChannelOpenUpsert()` to initialize CHANNEL_STATE with these values instead of hardcoded 0 and ''
  - Enhanced CHANNEL_OPEN resending in all three paths (publisher, viewer, VOUCHER_SYNC_REQUEST) to include cumulative_earned and latest_tx_hex from the existing channel state
  - Added voucher recovery logic: if accrual delta validation fails with delta <= 0, resend the latest stored voucher to recover the viewer state
  - Enhanced logging to include current CUMULATIVE_EARNED value for debugging
- **SDK** (`sdk/index.js`):
  - Enhanced `_handleChannelOpenPayload()` to extract and persist cumulative_earned and latest_tx_hex via `updateChannelVoucher()`
  - Fixed `_flushPending()` to replay ALL accumulated REWARD_REQUESTs instead of discarding them, using stored cumulative values
- **Documentation** (`MinimaAds.md §8.9`): Updated CHANNEL_OPEN schema documentation

**Files modified**: `public/service-workers/handlers/channel.handler.js`, `sdk/index.js`, `MinimaAds.md`

**AGENTS.md updated**: yes — §6 updated, oldest entry (patch 14) moved to `docs/HISTORY.md §17`.

**Verification**:
1. Simulate viewer state loss by clearing CHANNEL_STATE row for a campaign while keeping creator's record
2. Trigger a view reward and verify creator resends CHANNEL_OPEN with correct cumulative_earned
3. Verify viewer receives it, initializes correctly, and no accrual delta invalid errors occur
4. Verify _flushPending replays all accumulated REWARD_REQUESTs

---

### Session: 2026-06-15 (patch 16) — Fix: Implement Maxima Outbox Queue & Case-Insensitive Normalization

**Problem**: Maxima signaling messages (e.g. campaign discovery, reward requests, vouchers) failed with "No Contact found" errors due to strict key case sensitivity checks in the platform's contact manager (e.g. `0X` vs `0x` prefixes) and race conditions where signals are sent before target contacts are fully established on-chain/in-network.

**Fix**:
- **Core** (`core/minima.js`):
  - Added `normalizePublicKey(pk)` to enforce standard lowercase `0x` prefix and uppercase key hex format.
  - Implemented a memory-resident `_maximaOutbox` queue and `processMaximaOutbox()` helper.
  - Refactored `sendMaxima()` to route through `_sendMaximaDirect()`, catch contact routing failures ("No contact found"), and automatically queue them in the outbox.
- **Service Worker** (`service.js`):
  - Normalized all public key variables and configuration key checks on initialization.
  - Added event listeners for `MAXIMACONTACTS` and `MAXIMAHOSTS` events to trigger outbox flushes.
  - Added outbox flushing inside the `NEWBLOCK` event handler.
- **MiniDapp Package**: Bumped version to `0.26.6.7` in `dapp.conf` and updated the packaged `MinimaAds.mds.zip`.

**Files modified**: `core/minima.js`, `service.js`, `dapp.conf`, `MinimaAds.mds.zip`

**AGENTS.md updated**: yes — §6 updated, oldest entry (patch 13) moved to `docs/HISTORY.md §17`.

**Verification**: Deploy and verify that when a message is sent to a peer not yet in the contact list, the node logs the queued outbox status. Verify that once the contact is added, the outbox flushes automatically and successfully delivers the message.

---

> Previous handoff notes (T-SC1–T-SC7, VW-1–VW-3, UI sessions 2–13, Remove Section 1.3, Auto-Sync Platform Creator Route, Unify MLS DevTools, Fix Viewer and Publisher Reward Delivery, Fix Publisher Budget (Multi-Publisher Support), Fix Stale-Pending Publisher Channel Deadlock, Minima Foundation Fee (3%) + V4 Escrow Script Fixes, 2026-06-10 settlement fixes, Security audit T7/T9, Security N2-4: bind REWARD_REQUEST sender, and all earlier including patch 15) are archived in `docs/HISTORY.md §17`.
