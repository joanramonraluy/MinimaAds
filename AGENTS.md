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

For verification procedures, see `docs/VERIFICATION.md`.

---

## 6) Current Handoff Notes

> **Rule**: keep the 3 most recent session entries here. Before adding a new entry, move the oldest one to `docs/HISTORY.md §17`. This section is loaded every session — keep keep it short.

### Session: 2026-06-19 (patch 24) — Fix: Campaign close confirmation buttons layout overflow

**Problem**: When finishing a campaign on desktop or mobile, the confirmation buttons inside the warnings box would sometimes overflow the screen on the right or wrap asymmetrically. This was caused by PicoCSS applying `width: 100%` by default to `<button>` elements, conflicting with the flex wrap layout in `_showFinishConfirmation`.

**Fix**:
- **Sizing & Flex**: Added explicit `width: auto;` to override PicoCSS's default `width: 100%` on both `confirmBtn` and `cancelBtn`.
- **Responsive Symmetry**: Changed the mobile flex property for both buttons to `flex: 1 1 calc(50% - .175rem)` so they render symmetrically side-by-side on mobile, automatically wrapping and stacking cleanly only when the container width drops below their minimum combined width (e.g. on narrow screens).
- **Action Buttons Visibility**: Passed the actions container to `_showFinishConfirmation` to hide the primary action buttons ('Pause' and 'Finish') in the header when the confirmation dialog is displayed, preventing button duplication. Restored their visibility (`display: flex`) if the action is cancelled.
- **dapp.conf**: Bumped version to `0.26.6.6`.

**Files modified**: `dapp/views/mycampaigns.js`, `dapp.conf`

**AGENTS.md updated**: yes — §6 updated, patch 21 moved to `docs/HISTORY.md §17`.

**Verification**:
1. Open the Creator dashboard and select "Finish" on a campaign.
2. Verify the "Yes, close campaign" and "Cancel" buttons render correctly side-by-side on desktop without any overflow.
3. Resize the browser to mobile viewport width: verify that the buttons scale symmetrically to take up 50% width each (minus gap) and stack onto separate lines cleanly only if the screen gets narrower than the minimum size, without overflowing the layout boundaries.
4. Run `node -c dapp/views/mycampaigns.js` to ensure syntax is clean.

---

### Session: 2026-06-18 (patch 23) — Fix: Campaign finish — on-chain settlement, viewer state refresh, warnings UI

**Changes (3 interconnected fixes):**

**Issue 1 — On-Chain Settlement:**
- `channel.handler.js` `autoSettleChannelsForCampaign()`: no longer calls `settleChannel()` directly (DB-only). Instead marks channels `'settling'` in DB, builds channel list with `LATEST_TX_HEX`/`VIEWER_WALLET_PK`, emits `CAMPAIGN_AUTOSETTLE_REQUEST` signal.
- `dapp/app.js`: added `_handleAutoSettleRequest()` (NOOP on creator node — viewer co-sign required), `_autoSettleOpenChannels()` (queries viewer's local open channels, calls `_runSettlement()` per channel), and a hook in `CAMPAIGN_UPDATED` handler to trigger auto-settle on viewer's node when `status='finished'`.
- L1 finalization: `checkOpenChannelsSettled()` on NEWBLOCK detects spent coins and calls `settleChannel()` — unchanged.

**Issue 3 — Viewer State Refresh:**
- `campaign.handler.js` `checkCampaignStatuses()`: removed `NOT EXISTS (open viewer channel)` clause. Viewers with open channels now send liveness pings, receive `'finished'` PONG, sync status locally, and trigger `CAMPAIGN_UPDATED` → viewer list refreshes + auto-settle fires.

**Issue 2 — UI Warnings Panel:**
- `dapp/views/mycampaigns.js`: `onCampaignSettling` and `onCampaignClosed` now write to `#ma-warnings-<id>` (via `_ensureWarningRow`) in addition to the inline `.ma-settling-progress` element, so progress persists after buttons are removed.
- Added `onMyCampaignsSettleConfirmed()` — appends a green "Channel settled: X MINIMA" row to `#ma-warnings-<id>` on each `SETTLE_CONFIRMED` signal.
- `dapp/app.js`: `SETTLE_CONFIRMED` handler now also calls `window.onMyCampaignsSettleConfirmed`.

**Files modified**:
- `public/service-workers/handlers/channel.handler.js`
- `public/service-workers/handlers/campaign.handler.js`
- `dapp/app.js`
- `dapp/views/mycampaigns.js`

**AGENTS.md updated**: yes — §6 updated, patch 20 moved to `docs/HISTORY.md §17`.

**Verification**:
1. Creator node: finish an active campaign (click Finish → confirm). Check SW logs for `CAMPAIGN_AUTOSETTLE_REQUEST` (not old `settleChannel` calls). Channel STATUS should change to `'settling'` in DB.
2. Viewer node: wait for next liveness ping cycle (~1 block). SW should log `PONG received ... status: finished`. Viewer's campaign list should refresh and show `finished`.
3. Viewer node: if viewer had an open channel with a voucher, earnings.js `_runSettlement` should auto-fire. Check browser console for `[AUTOSETTLE] viewer auto-settle: 1 channel(s)`. Settlement tx should post to L1.
4. On next NEWBLOCK after L1 confirm: `checkOpenChannelsSettled` should log `coin confirmed spent on-chain` and call `settleChannel`. `SETTLE_CONFIRMED` signal should appear.
5. Creator's mycampaigns view: `#ma-warnings-<id>` div should show "Closing channels..." progress, then "Campaign closed — all channels settled." No console errors.
6. After settlement confirmed: `#ma-warnings-<id>` should show green "Channel settled: X MINIMA" row.

**Open issues**: None discovered in scope.

---

### Session: 2026-06-17 (patch 22) — Fix: Settlement tx rejected due to duplicate CoinID proofs

**Problem**: Settlement transactions posted via `txnpost mine:true auto:true` (FE) or `txnpost mine:true` (SW) were being rejected with `non unique CoinIDs`. The tx had already been fully constructed and imported via `txnimport` (with `scriptmmr:true`), which includes all necessary MMR proofs in the witness. `auto:true` calls `setMMRandScripts` → `addCoinProof` (no dedup), adding the same coin proof a second time. `mine:true` similarly re-adds wallet-coin MMR proofs already present.

**Root cause**: `txnpost` flags were redundant and harmful for imported transactions — all proofs are already embedded by `txnimport scriptmmr:true`.

**Fix**: Removed all `mine:true auto:true` / `mine:true` flags from the two `txnpost` calls in the settlement path. Both now post bare: `txnpost id:<settleId>`.

**Files modified**: `dapp/views/earnings.js` (line 555), `public/service-workers/handlers/channel.handler.js` (line 2489)

**AGENTS.md updated**: yes — §6 updated, oldest entry moved to `docs/HISTORY.md §17`.

**Verification**:
1. Publisher node: trigger settlement of a completed voucher channel.
2. Check SW logs — `txnpost` should succeed (no `non unique CoinIDs` error).
3. Viewer node: manually settle a voucher via Earnings view → "Settle" button.
4. Confirm tx posts successfully and balance updates.

---

> Previous handoff notes (patches 15–20, Security Audit 2, and all earlier) are archived in `docs/HISTORY.md §17`.

