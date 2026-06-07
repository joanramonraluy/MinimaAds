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

### Session: 2026-06-07 — Collapsible Campaign Cards & Combined Totals

**Task**: Re-architect the campaign cards view in the creator dashboard to make campaign cards and their budget allocation sections collapsible to keep the UI tidy, introduce a "Combined Totals" budget overview, and preserve details open states across page updates.

**Root Cause**: When a creator had multiple campaigns, the dashboard cards took up too much vertical space, showing long configuration tables and dual budget grids. In addition, there was no quick "combined totals" summary grouping general budget metrics, and page refreshes/updates would reset any toggle states.

**Fix**:
- dapp/views/mycampaigns.js:
  - Switched the main card element from `<article>` to `<details class="ma-campaign-card-details">`.
  - Put title, badge, quick stats summary, and action buttons inside the `<summary>` element.
  - Used `e.stopPropagation()` on the action button click handlers to prevent details toggle when clicking actions.
  - Put the budget allocation rows and indicators inside a collapsible nested `<details data-details-id="budget-allocation">`.
  - Added a **"Combined Totals"** row at the top of the budget allocation details body showing aggregated campaign funds (Total Budget, Escrow Left, Locked, Paid).
  - Modified state saving logic in `loadMyCampaigns` to query all elements matching `[data-campaign-id]` and preserve expanded states of both the campaign details cards and nested details panels using `data-details-id` attribute values.
  - Replaced the static/non-dynamic "Reward/View" and "Reward/Click" stat cards on the Performance row with dynamic **"Viewers"** and **"Publishers"** counts retrieved via H2 `COUNT(DISTINCT USER_ADDRESS)` and `COUNT(DISTINCT PUBLISHER_ID)` queries from `REWARD_EVENTS`.
  - Added a collapsible **"Ad Preview"** (`<details data-details-id="ad-preview">`) section which lazily renders the responsive ad banner using the project's standard `renderAd` function once toggled.
- dapp/views/ui-helpers.js:
  - Updated `mkStatCard` to use a flex column layout (`display:flex; flex-direction:column;`) and added `margin-top:auto` to the main value element (`val`) to guarantee all numbers align horizontally even if labels wrap on small screens.
- public/index.html:
  - Added custom styles for `details.ma-campaign-card-details` to animate open states and render a custom right-aligned chevron arrow indicator.

**AGENTS.md updated**: yes — §6 updated.

**Verification**:
- `mycampaigns.js` and `ui-helpers.js` compile cleanly with `node -c`.
- Rebuilt `MinimaAds.mds.zip` and verified files packaged successfully.

---

### Session: 2026-06-07 — Detailed Campaign Budget Allocation UI

**Task**: Improve the creator's campaign metrics UI to break down the campaign budget into distinct actionable sections (available in escrow, locked in channels, and settled payouts) and introduce CTR performance tracking.

**Root Cause**: Previously, the campaign cards only showed "Budget left" (which represents the escrow balance), without explaining what was locked in open payment channels or already settled/paid to viewers and publishers. This was confusing because users could not audit the flow of funds or see pending unliquidated channel balances.

**Fix**:
- dapp/views/mycampaigns.js:
  - Updated `loadMyCampaigns()`'s SQL query to fetch separate viewer and publisher channel aggregates (`VIEWER_LOCKED`, `VIEWER_UNSETTLED`, `VIEWER_SETTLED`, `PUB_LOCKED`, `PUB_UNSETTLED`, `PUB_SETTLED`, and dynamic `PUB_SPENT_ACTUAL`).
  - Split the "Budget Allocation" section into two distinct rows: "Budget Allocation (Viewer)" (Available Escrow, Locked in Channels, Settled Paid, Unspent Campaign) and "Budget Allocation (Publisher)" (Max Pub Budget, Budget Reserved, Budget Spent, Budget Left) to organize dynamic runtime fons.
  - Mobile responsiveness: Switched both rows to responsive CSS Grids (`repeat(auto-fit, minmax(120px, 1fr))`).
  - Exhausted Publisher Budget Warning: Added a dynamic check so if the remaining publisher budget is lower than a single view's reward rate, the "Budget Left" card values turn red, and the subtext changes to "Exhausted (cannot open)".
  - Collapsible Campaign Configuration: Added an expandable details block showing static parameters divided into themed sub-sections: General Campaign Data, Reward Viewer, Reward Viewer Limits, and Publisher Rewards & Limits (removing dynamic/runtime publisher stats from this static block).
  - Periodic Auto-Refresh Removed: Completely eliminated the 30-second interval timer which caused disruptive full-page UI refreshes.
  - Silent Stateful Update: Added `loadMyCampaigns(isAutoRefresh)` parameter to preserve the open/expanded states of all details blocks before reloading.
  - Polish: updated progress bar labels and footnotes.
- dapp/views/creator.js:
  - Added a descriptive note beneath the "Max publisher budget" input field to explain dynamic runtime budget reservation, payment channels, and tracking.
- dapp/views/help.js:
  - Expanded the Creator Help panel with dedicated sections detailing the Viewer and Publisher budget allocation categories.
- dapp/app.js:
  - Configured handlers for `NEW_CAMPAIGN`, `CAMPAIGN_UPDATED`, and `REWARD_CONFIRMED` to trigger silent/seamless reloads.

**AGENTS.md updated**: yes — §6 updated.

**Verification**:
- `mycampaigns.js`, `creator.js`, and `help.js` compile cleanly with `node -c`.

---

### Session: 2026-06-07 — Log Publisher Reward Events & Rename Active Rewards Label

**Task**: 
- Campaign creator's "Rewarded nodes" screen not showing publisher earnings when they originate from the built-in snippet/viewer frame.
- Clarify active reward section name in the campaign dashboard to avoid confusion with settled channels.

**Root Cause**: 
- On the creator's node, the Service Worker only created a `REWARD_EVENTS` row (type `'view'`) when a viewer voucher was signed and posted. It completely skipped generating `publisher_view` reward events when issuing publisher vouchers. Additionally, in `_swDispatchVoucher`, the `rewardAmount` was hardcoded to `0` when the role was `'publisher'`.
- "Rewarded nodes" label was ambiguous and did not clearly distinguish active, pending-settlement earnings from archived on-chain settled channels.

**Fix**: 
- In `channel.handler.js`:
  - Updated `_swDispatchVoucher` to set `rewardAmount` to the campaign's `PUBLISHER_REWARD_VIEW` when the role is `'publisher'`.
  - In `swSignAndPostChannelTx`'s `sendMaxima` callback, added the path for `role === 'publisher'` to query the active campaign's ad and write a `'publisher_view'` reward event (passing `publisher_id = fid`). This correctly populates `REWARD_EVENTS` and decrements the campaign budget via the local `updateBudget` call in `createRewardEvent`.
- In `dapp/views/mycampaigns.js`:
  - Renamed the section heading and comments from "Rewarded nodes" to "Pending settlement".
  - Renamed empty state and loading texts accordingly to "No pending settlements yet." and "Loading pending settlements…".

**AGENTS.md updated**: yes — §6 updated.

**Verification**:
- `channel.handler.js` and `mycampaigns.js` compile cleanly with `node -c`.

---

> Previous handoff notes (T-SC1–T-SC7, VW-1–VW-3, UI sessions 2–13, Remove Section 1.3, Auto-Sync Platform Creator Route, Unify MLS DevTools, Fix Viewer and Publisher Reward Delivery, Fix Publisher Budget (Multi-Publisher Support), Fix Stale-Pending Publisher Channel Deadlock, and all earlier) are archived in `docs/HISTORY.md §17`.

