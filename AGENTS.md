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

2026-06-01 (feat: help and about us view):
- **Scope**: `dapp/views/help.js`, `public/index.html`, `dapp/app.js`.
- **Change**: added a new Help and About view containing tabbed guides for the three roles (Viewer, Creator, Publisher) and an "About MinimaAds" section. The navigation drawer "Help" button was enabled and connected to the routing logic.
- **Responsive Nav**: updated the sub-navigation tabs (`#ma-nav-links`) to display in a single scrollable row on mobile instead of wrapping to two lines. Implemented dynamic indicator chevrons (`#ma-nav-arrow-right` / `left`) that appear when there are off-screen options and disappear as the user scrolls. Added `flex-shrink: 0` to `li` elements and `white-space: nowrap` to `a` elements to prevent tabs from shrinking/wrapping internally.
- **Help View Tabs**: removed inline styling overrides (`flex-wrap: wrap`) from the tab container in `help.js` to ensure the global stylesheet responsive `.ma-tabs` rules (which make them scroll horizontally on mobile screens) are correctly applied to the Help screen.
- **Shared Scroll Indicator**: added `attachScrollIndicator` to `ui-helpers.js` and `.ma-tabs-container` / `.ma-tabs-arrow` styling to `index.html`. Refactored main navigation, Creator tabs, and Help tabs to use this shared utility, providing consistent visual left/right chevron indicators when tabs overflow. Clicking these arrows smoothly scrolls the tab container, and event propagation is stopped to prevent accidental tab switching. Restricted `.ma-tabs-container` and `#ma-nav-links` to `max-width: 100%` and `overflow: hidden` to prevent page-wide horizontal scrollbars.
- **New files**: `dapp/views/help.js`.
- **No contract changes**: UI changes only.

2026-06-01 (feat: creator settled channels list):
- **Scope**: `dapp/views/mycampaigns.js` only.
- **Change**: added a lazy-loaded `Settled channels` details section to each `My Campaigns` card. It queries `CHANNEL_HISTORY` for `ROLE='publisher'` rows of the campaign, groups them by `VIEWER_KEY` (publisher PK), and shows contact name when available from `maxcontacts`, shortened PK, channel count, total earned, and last settled date. Each publisher row has a nested expander listing individual settlement events with status, earned amount, and settled date.
- **New functions**: `_loadSettledChannels`, `_renderSettledChannelsTable`, `_groupSettledChannelsByPk`, `_renderSettledChannelEvents`. Reuses existing helpers `_loadMaximaContactsMap`, `_nodeTd`, `_shortNodePk`, and shared CSS classes `ma-campaign-details`, `ma-campaign-details-summary`, `ma-nested-table`, `ma-nested-detail`, `ma-expandable-row`.
- **Data note**: `CHANNEL_HISTORY.VIEWER_KEY` for `ROLE='publisher'` is the publisher's Maxima PK. Names resolved opportunistically from local Maxima contacts.
- **No contract changes**: no DB, SW, Maxima schema, SDK, or spec changes.

2026-06-01 (feat: creator rewarded nodes list):
- **Scope**: `dapp/views/mycampaigns.js`, `public/index.html`.
- **Change**: added a lazy-loaded `Rewarded nodes` details section to each `My Campaigns` card. It groups `REWARD_EVENTS` by `USER_ADDRESS` and shows contact name when available from `maxcontacts`, shortened public key, reward count, total rewarded amount, and last rewarded date/time. Each node row has a nested expander listing individual reward events with type, amount, and reward date.
- **UI follow-up**: nested reward detail rows now use `.ma-nested-detail`, with theme-aware light/dark backgrounds, instead of an inline light fallback that showed white in dark mode.
- **UI follow-up 2**: `My Campaigns` top-level details (`Activity chart`, `Rewarded nodes`) now share `.ma-campaign-details` / `.ma-campaign-details-summary` styling for consistent spacing, borders, and theme-aware hover states.
- **UI follow-up 3**: `Rewarded nodes` summary/detail tables now use `.ma-nested-table` for card-like row spacing, soft separators, and theme-aware hover backgrounds.
- **UI follow-up 4**: grouped `Rewarded nodes` rows are now clickable across the full row, with a muted rotating `›` chevron instead of a primary-colour button. Avoided `role="button"` because Pico styles `[role=button]` as a primary button, which made the full row orange; rows keep `tabindex` and `aria-expanded`.
- **Data note**: `USER_PROFILE` does not store Maxima display names; names are resolved opportunistically from local Maxima contacts. Unknown contacts display as `Unknown node`.
- **No contract changes**: no DB, SW, Maxima schema, SDK, or spec changes.

2026-06-01 (UX: settlement timing hint):
- **Scope**: `dapp/views/earnings.js` only.
- **Change**: added a short hint under `Pending settlements` explaining that settlement posts to L1 and is usually best done when the campaign ends or the channel reaches its reward cap, unless funds are needed sooner. The Earnings view is shared by viewer and publisher modes, so the hint appears in both.
- **No contract changes**: UI copy only.

2026-06-01 (fix: sticky header layering during scroll):
- **Scope**: `public/index.html` only.
- **Fix**: scoped sticky header CSS from global `header` selectors to `body > header`. Frame cards use internal `<header>` elements, and the global selector was accidentally making card headers sticky too (`Built-in viewer` / `Built-in` appeared above the app header while scrolling). App header keeps `z-index:90`; drawer overlay/panel remain above it at `100/101`.
- **Follow-up**: made the header background opaque (`var(--pico-background-color)`) instead of semi-transparent rgba. The remaining visible issue was content showing through the translucent header, not a higher stacking layer.
- **No contract changes**: UI CSS only.

2026-06-01 (feat: publisher snippet copy button in summary):
- **Scope**: `dapp/views/frames.js` only.
- **Fix**: custom Frame `Snippet` summary now includes a compact `Copy` button beside the native expand control. The button copies the generated SDK snippet without opening/closing the details panel (`preventDefault` + `stopPropagation`).
- **Follow-up**: styled the summary `Copy` button with the current theme primary colour and `--pico-primary-hover-background` hover effect, with padding/radius aligned to the page's existing small action buttons.
- **Refactor**: snippet generation moved into `_loadSnippet()` and `_buildSnippet()` so both the summary copy button and expanded snippet panel use the same source. `_copySnippetText()` handles Clipboard API and textarea fallback.
- **No contract changes**: no DB, SW, Maxima, SDK, or spec changes.

2026-06-01 (fix: viewer campaign row hover colour):
- **Scope**: `dapp/views/viewer.js` only.
- **Fix**: `_buildCampaignRow` no longer uses `var(--pico-card-sectionning-background-color)` for hover. Added `_viewerRowHoverBackground()` with explicit neutral hover colours: `rgba(255,255,255,.06)` in dark mode and `rgba(15,23,42,.05)` in light mode. Normal row background now resets to `transparent`.
- **No contract changes**: no DB, SW, Maxima, SDK, or spec changes.

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

