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

### Session: 2026-06-07 — Normalize Publisher Frame IDs

**Task**: Fix publisher frame "Total earned" mismatch and statistics mismatch on creator/publisher nodes by normalizing frame IDs.

**Root Cause**: In several execution paths, raw public keys (e.g. `0X...`) were not normalized to the prefixed form (`builtin:0X...`), causing database lookups and updates on the `FRAMES` table (which uses prefixed keys) to fail or mapping incorrectly.

**Fix**:
- public/service-workers/handlers/channel.handler.js:
  - In `handleChannelOpen`: extract and normalize `frame_id` (prefixed with `builtin:` and capitalized) and pass it to `_doChannelOpenUpsert`.
  - In `_doChannelOpenUpsert`: update the SQL script to save `frameId` to `CHANNEL_STATE.FRAME_ID` instead of an empty string `''`.
  - In `_continueRewardVoucher`: normalize `frameId` before looking up the frame in `FRAMES` and calling `createRewardEvent`.
  - In `handlePublisherRewardNotify`: normalize `frame_id` before saving to deferred notifies or looking up channel states.
  - In `_maybeGeneratePublisherVoucher`: normalize `frameId` and handle `publisherKey` normalization.
  - In `_doGeneratePublisherVoucher`: normalize `frameId` before using it in any outbound open request, keypair store, or transaction dispatch.

**AGENTS.md updated**: yes — §6 updated.

**Verification**:
- Verified JS syntax using `node -c` (clean).
- Rebuilt `MinimaAds.mds.zip` and verified package integrity.

---

### Session: 2026-06-07 — Modernize Campaign Creator Layout & Fix Publisher Count

**Task**: Modernize the campaign creation wizard layout by removing outer panel borders, grouping related settings inside sub-cards, and placing forms and ad preview side-by-side using responsive grids. Also, resolve creator dashboard performance stats mismatch by deduplicating local reward events and normalizing case/empty strings for unique publisher counts.

**Root Cause**:
- Form fields in the wizard were crowded inside single panel cards. Sub-sections had no distinction, and the ad preview took up too much vertical space without desktop-optimized placement.
- When running creator and viewer/publisher on a single node, duplicate reward events were written. Case differences in publisher Maxima public keys and empty frames also caused `COUNT(DISTINCT)` to return incorrect metrics.

**Fix**:
- dapp/views/creator.js:
  - Removed `.ma-section` card wrapper from outer panels.
  - Rendered "Add Content" and "Review" sections stacked vertically in a single column.
  - Wrapped "Budget", "Viewer", and "Publisher" settings inside `.ma-grid-2col` wrappers to arrange forms/notes side-by-side on desktop.
- public/index.html:
  - Added CSS grid rules for `.ma-creator-grid`, `.ma-grid-2col`, and sticky sidebars.
  - Overrode padding for `input[type="file"]` to center-align native browser text/buttons.
- core/rewards.js:
  - Added `id` and `timestamp` params support to `createRewardEvent` to enable deterministic event IDs.
- public/service-workers/handlers/channel.handler.js:
  - Used `eventId` and `'pub-' + eventId` to set deterministic event IDs, allowing H2 MERGE INTO to deduplicate local database writes.
  - Added `event_id` payload to `VOUCHER_RECEIVED` signal.
- sdk/index.js:
  - Extracted and forwarded `event_id` to `createRewardEvent` on viewer nodes.
- core/frames.js:
  - Updated `listFrames` and `getFrameEarnings` to calculate frame earnings dynamically from `REWARD_EVENTS` instead of reading the cached `TOTAL_EARNED` column from the `FRAMES` table.
- dapp/views/mycampaigns.js:
  - Updated distinct count to `COUNT(DISTINCT UPPER(re.PUBLISHER_ID))` and added check to skip empty IDs (`AND re.PUBLISHER_ID <> ''`).

**AGENTS.md updated**: yes — §6 updated.

**Verification**:
- Checked JS syntax on all modified files with `node -c` (all clean).
- Rebuilt `MinimaAds.mds.zip` and verified package integrity.

---

### Session: 2026-06-07 — Modernize Side Drawer Menu Footer

**Task**: Modernize the side drawer menu footer by adding the DApp name, version, a pulsing connection status badge ("Connected to Minima"), and a dynamic block height tracker.

**Root Cause**: The side drawer menu had no footer, version indicator, or connection status, which missed an opportunity to display relevant node info and offer a more responsive, premium design.

**Fix**:
- public/index.html:
  - Modified `#ma-drawer` panel styles to disable global drawer scrolling (`overflow: hidden;`) and enable internal scroll on the menu options section (`overflow-y: auto;`).
  - Added CSS classes for `.ma-drawer-footer`, `.ma-drawer-footer-title`, `.ma-drawer-version`, `.ma-drawer-status`, `.ma-status-pulse` (with pulsing keyframe animation), and `.ma-drawer-block`.
  - Added HTML structure for Section 3 (Footer) at the bottom of the drawer.
- dapp/app.js:
  - Inside `MDS.init` `inited` handler, added a call to `MDS.cmd('status')` to fetch and display the initial block height (`#ma-footer-block-height`).
  - Added a `NEWBLOCK` event listener in `MDS.init` callback to dynamically update the block height inside the footer as new blocks are mined.

**AGENTS.md updated**: yes — §6 updated.

**Verification**:
- `dapp/app.js` compiles cleanly with `node -c`.

---

> Previous handoff notes (T-SC1–T-SC7, VW-1–VW-3, UI sessions 2–13, Remove Section 1.3, Auto-Sync Platform Creator Route, Unify MLS DevTools, Fix Viewer and Publisher Reward Delivery, Fix Publisher Budget (Multi-Publisher Support), Fix Stale-Pending Publisher Channel Deadlock, and all earlier) are archived in `docs/HISTORY.md §17`.

