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

### Session: 2026-06-04 — DevTools Polish & SQL Console Removal

**Task**: Fix DevTools CSS layout, remove the SQL console, adjust button styling, remove the Copy command button, and add "Copy Address" helper buttons.

**Changes**:
- **dapp/views/devtools.js**: Removed SQL console inputs, textarea, run button, outputs, and the `runQuery` function. Re-styled the entire modal layout with modern glassmorphism overlay using PicoCSS theme variables. Added smooth open/close animations. Aligned all input rows (Platform Key, MLS Server, Client Mode) to a consistent 2.2rem height. Renamed the Platform Key "Register" button to "Save". Removed the "Copy: maxextra action:staticmls" button. Added "Copy Address" buttons to both the Platform Key Configuration and MLS Server Configuration sections to easily copy active addresses.

**Why**: Simplifies development settings, makes input-button alignments consistent, cleans up redundant command buttons, and provides convenient one-click copying of nodes' addresses.

**Testing required**:
- Press `Ctrl+Shift+D` to toggle DevTools.
- Verify that inputs and "Save/Connect" buttons are perfectly aligned in height (2.2rem).
- Verify that the Platform Key custom address registration button is named "Save".
- Verify that both the Platform Key and MLS Server configuration sections have a "Copy Address" button.
- Click "Copy Address" in either section and verify the respective key/address is copied to your clipboard (showing a quick status change in the card).
- Verify that the MLS Server configuration section no longer displays the "Copy: maxextra action:staticmls" button.
- Close the modal with `✕` or by clicking outside and verify the transition is smooth.

---

### Session: 2026-06-04 — MAX# Permanent Routes (MVP)

**Task**: Implement MAX# permanent Maxima routes for Creator/Publisher discovery.

**Changes**:
- **core/minima.js** (+45 lines): Added 4 helpers — `getMaximaInfo()`, `parseMaximaRoute()`, `setCreatorMaximaRoute()`, `getCreatorMaximaRoute()`. Routes stored in KeyPair as `CREATOR_PERMANENT_ROUTE`.
- **dapp/views/creator.js** (+150 lines, refactored): Added setup banner (3-step wizard) on first access to Creator role. `fundEscrowAndPublish()` now validates permanent route before escrow funding. `fundEscrowWithRoute()` uses permanent route in escrow STATE(4).
- **dapp/views/devtools.js** (+60 lines): New "Dev Settings — Maxima Routes" section in Ctrl+Shift+D panel. Shows stored route, copy button for `maxextra staticmls` command, and "Register Creator Route" button.

**Why**: Solves dynamic Mx address problem for Creator/Publisher discovery. STATE(4) now contains `MAX#<pk>#<mls>` (permanent, MLS-resolved) instead of mutable `Mx...` contact. Campaign discovery survives creator node restart or address change.

**Architecture validated against**: Minima 1.0.45 source (maxima.java, maxextra.java); MinimaAds codebase (sendMaxima fallback, escrow discovery, keypair storage all pre-existing). No schema migrations needed (KeyPair storage only).

**Testing required**:
- [ ] Ctrl+Shift+D: "Maxima Routes" section visible
- [ ] Creator view (first access): setup banner appears
- [ ] After registering route: campaign form enabled
- [ ] Campaign creation: STATE(4) contains `MAX#0x...#Mx...@host:port`
- [ ] Viewer node discovery: reads STATE(4), sends REQUEST_CAMPAIGN_DATA to MAX# route, receives CAMPAIGN_DATA_RESPONSE via MLS

**Docs updated**: MinimaAds.md §3.6 (new), §8.1 (STATE(4) semantics), §8.8 (routing note). AGENTS.md this section.

**Known limitations (MVP)**: No dynamic route refresh (`PEER_ROUTE_UPDATE` messages). Setup is one-time per node. Viewers are not required to register (they initialize chats directly).

**Future work** (post-MVP, see `docs/MAXIMA_ROUTE_DISCOVERY.md`):
- Implement `PEER_ROUTE_UPDATE` messages for dynamic creator/viewer route refresh
- Add publisher permanent route setup (mirrors creator flow)
- Add passive route refresh headers to all Maxima messages (sender_route, sender_mx)
- Rate-limit route update messages

**Code quality**: All Rhino-compatible (var, function declarations, no arrows/templates). Helpers use MDS.cmd and MDS.keypair APIs. No breaking changes to existing signatures.

---

2026-06-04 (feat: MAX# permanent route support — creator setup + escrow STATE(4)):
- **What**: Implemented MVP phase of permanent Maxima route support validated by Opus.
- **Changes**:
  - `core/minima.js`: added 4 helper functions — `getMaximaInfo(cb)`, `parseMaximaRoute(route)`, `setCreatorMaximaRoute(cb)`, `getCreatorMaximaRoute(cb)`. All Rhino-safe (var, function declarations, no arrow functions/template literals). Route stored in keypair as `CREATOR_PERMANENT_ROUTE`.
  - `dapp/views/creator.js`: `fundEscrowAndPublish` now validates `CREATOR_PERMANENT_ROUTE` exists before starting escrow. If not set → fails with clear message. Escrow STATE(4) now stores `MAX#<pk>#<mls>` (permanent route) instead of mutable `Mx...` contact string. Added `_showCreatorRouteSetupBanner()` (3-step setup instructions + "Check & Register Route" button) shown on creator view load when route is not set. Submit button disabled while route is missing. Helper `_copyToClipboard()` added.
  - `dapp/views/devtools.js`: Ctrl+Shift+D panel expanded with "Dev Settings — Maxima Routes" section showing current stored route, copy command for `maxextra action:staticmls`, and "Register Creator Route" button.
- **STATE(4) contract change**: escrow coin STATE(4) now encodes `MAX#<pk>#<mls>` instead of `Mx...` contact. Viewers discovering campaigns via on-chain STATE(4) must send to this MAX# route (existing `sendMaxima` fallback with `to:MAX#...` already handles this — see `sendMaxima` in core/minima.js which passes mxAddress as second arg).
- **Files**: `core/minima.js`, `dapp/views/creator.js`, `dapp/views/devtools.js`.
- **AGENTS.md updated**: yes — this entry; oldest entry archived to `docs/HISTORY.md §17`.
- **Verification**: (1) Navigate to #creator — setup banner should appear (route not yet set). (2) Ctrl+Shift+D → "Maxima Routes" section visible, shows "No route registered yet.". (3) If node has static MLS: click "Check & Register Route" → success, page reloads. (4) After reload: no banner, submit enabled. (5) Create a campaign → inspect escrow coin STATE(4) — should be hex of `MAX#<pk>#<mls>`. (6) Nodes without static MLS: "Register" shows "Node does not have static MLS configured" error.

> Previous handoff notes (T-SC1–T-SC7, VW-1–VW-3, UI sessions 2–13, and all earlier) are archived in `docs/HISTORY.md §17`.
