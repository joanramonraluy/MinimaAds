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

### Session: 2026-06-05 — Platform Creator Permanent Address Registration

**Task**: Implement an input field in the settings UI to register the Platform Creator's stable Maxima permanent route (MAX#...). Ensure the viewer node uses this route for built-in frame reward requests, and campaign creator/publisher nodes fallback to it when routing notifications. Also support client nodes registering their own permanent routes through a remote MLS server.

**Changes**:
- **core/minima.js** (`setCreatorMaximaRoute`):
  - Removed the strict `staticmls === true` requirement so that client nodes connected to a remote MLS server can also build and save their permanent route (validating only that a static `mls` server host is configured).
- **dapp/views/settings-maxima-routes.js**:
  - Consolidated the permanent registration flow: removed the redundant Section 3 ("Finalise Route Registration") and integrated the permanent route status display directly into Section 2.
  - Section 2 now displays the verified registered permanent route (saved under `CREATOR_PERMANENT_ROUTE`) and styles/renames the button dynamically ("Register as Permanent" / "Re-register as Permanent") based on registration status.
  - Added Section 3 (formerly Section 4): "MinimaAds Platform Creator Route" containing a status display, text input field, "Save Route" button, and "Clear" button.
  - Users can save the stable route of the platform creator (saved under `MINIMAADS_CREATOR_ROUTE` keypair) or clear it.
  - Added auto-extraction of raw Maxima contact address if the user inputs a full `MAX#...` permanent route as the MLS Server Address.
- **dapp/views/devtools.js**:
  - Restructured the DevTools panel into exactly three clean visual sections: (1) Platform Creator Configuration (for local server registration, platform key, and creator permanent route), (2) Client / User Configuration (for remote MLS host setting, client handshake, and creator route import), and (3) Database & Storage Console (with Keypair Inspector and SQL Console).
  - Styled sections with distinct colored left-borders (primary accent for creator, purple for client, and neutral/gray for DB console) for premium look and feel.
  - Fixed a bug in the "Register This Node as MLS Server" action by ensuring it uses the node's own P2P identity (`info.p2pidentity || info.localidentity`) instead of the currently configured remote MLS address.
  - Redesigned the MLS status block to show a detailed comparison of DApp Stored MLS address, System staticmls, System MLS host, and System P2P identity, turning green when properly configured.
  - Added Section 5: "SQL Console" at the bottom of the panel allowing developers to execute raw H2 database queries with formatted output, a copy-to-clipboard utility, and automatic status indicators.
- **public/service-workers/handlers/comms.handler.js**:
  - Modified `_sendRewardRequest` to read `MINIMAADS_CREATOR_ROUTE` from keypairs if the reward is for the built-in frame (`publisherKey` equals `MINIMAADS_CREATOR_PK`), sending it as `publisher_mx`. Falls back to the local node's own `CREATOR_PERMANENT_ROUTE` otherwise.
- **public/service-workers/handlers/channel.handler.js**:
  - Propagated `publisher_mx` through the pending voucher queue by adding it to the JSON-serialized payload of `PENDING_VOUCHER_*`.
  - Updated `_notifyPublisherByKey` to query `MINIMAADS_CREATOR_ROUTE` keypair if the destination publisher is `MINIMAADS_CREATOR_PK` and `publisherMx` is empty.
  - Added the fifth argument `publisherMx` when checkOnePendingVoucher calls `_maybeGeneratePublisherVoucher`.

**Why**: Allows non-operator nodes (campaign creators, custom publishers, viewers) to route platform publisher rewards/notifications correctly to the platform creator's permanent Maxima identity without relying on local routes, and allows client nodes to successfully register and save their own permanent routes using a remote MLS server.

**AGENTS.md updated**: yes — §6 updated.

**Verification**:
- Go to Settings → Configure Maxima Routes or press Ctrl+Shift+D to open the DevTools panel.
- Verify "Platform Creator Route Configuration" is visible in both places.
- Input/paste a valid `MAX#` route, click "Save" / "Save Route", verify status changes.
- Click "Clear", verify status changes to (not set) / red cross.
- Set/Save it again.
- No console/SW errors.

---

### Session: 2026-06-05 — Reorder, Automate, and Clean Creator Permanent Route Registration in DevTools

**Task**: Swap positions of MLS Server Configuration and Creator Permanent Route Configuration in DevTools (Ctrl+Shift+D). Also, add a new explicit "MLS Permanent Registration" section in DevTools to register the node's key locally on the MLS server, and remove the unnecessary custom route input field and "Save" button from DevTools.

**Changes**:
- **dapp/views/devtools.js**:
  - Moved the MLS Server Configuration section code block above the Creator Permanent Route Configuration section.
  - Added a new middle section: "MLS Permanent Registration" with a "Register Self Key on MLS" button, which executes `maxextra action:addpermanent publickey:<local_pk>` locally.
  - Removed the custom route input field and "Save" button from the Creator Permanent Route Configuration section.
- **core/minima.js** (`setCreatorMaximaRoute`):
  - Reverted the temporary background registration change so that Option 3 (Set as Self Route) only sets the `CREATOR_PERMANENT_ROUTE` keypair value without running MLS server commands.

**Why**: Arranges setup steps logically, structures registration into three clean, separate stages (server host configuration, permanent registration, and route keypair setting), and declutters DevTools by removing unused custom input.

**AGENTS.md updated**: yes — §6 updated.

**Verification**:
- Press Ctrl+Shift+D to open the DevTools panel.
- Verify that "MLS Server Configuration", "MLS Permanent Registration", and "Creator Permanent Route Configuration" appear in that order.
- Click "Register Self Key on MLS" and verify that it registers the local key on the MLS server.
- Click "Set as Self Route" to save the route in keypairs.
- Verify there is no custom input text field or "Save" button.
- No console errors.

---

### Session: 2026-06-05 — Remote Permanent Route Registration via Service Worker

**Task**: Implement background registration of permanent route at MLS. FE requests SW to register (so it works even if DApp is closed); SW sends Maxima message to MLS in background.

**Changes**:
- **dapp/views/settings-maxima-routes.js**:
  - Modified "Register as Permanent" button: instead of local `MDS.cmd("maxima ...")`, now calls `MDS.comms.solo(JSON.stringify({type: "DO_REGISTER_PERMANENT", publickey: ...}))` to request SW asynchronously.
  - FE waits 2 seconds (for SW to process in background), then calls `setCreatorMaximaRoute()` to fetch and display the newly registered permanent route.

- **service.js** (`onComms` dispatcher + new handler):
  - Added `DO_REGISTER_PERMANENT` branch to `onComms()`.
  - New `handleRegisterPermanent(payload)`: fetches `MLS_SERVER_ADDRESS` from keypair, constructs `REGISTER_PERMANENT_REQUEST` with publickey, sends to MLS via `sendMaxima(null, mlsAddr, registerReq, cb)` in background.

- **public/service-workers/handlers/maxima.handler.js** (existing from earlier fix):
  - `REGISTER_PERMANENT_REQUEST` dispatcher branch + `handleRegisterPermanentRequest()` handler (executes `maxextra action:addpermanent` at MLS and sends back `REGISTER_PERMANENT_RESPONSE`).

**Why**: (1) SW is always running in background — registration works even if DApp is closed. (2) Mirrors campaign/reward Maxima communication pattern — SW handles Maxima outbound, FE requests. (3) MLS (SW) executes command locally so registration applies at correct node.

**AGENTS.md updated**: yes — §6 updated.

**Verification**:
- Node A (creator): `#settings/maxima-routes` → configure MLS address → click "Register as Permanent".
- Node A FE: should see "Registering with MLS..." → after 2s, should display permanent route (MAX#...#...).
- Node A SW logs: should show `DO_REGISTER_PERMANENT received`, `sending request to MLS`, `request sent ok=true`.
- Node B (MLS) SW logs: should show `REGISTER_PERMANENT_REQUEST from ...`, `REGISTER_PERMANENT executed successfully`.
- No console errors. Works even if DApp is closed (SW runs in background).

---

> Previous handoff notes (T-SC1–T-SC7, VW-1–VW-3, UI sessions 2–13, and all earlier) are archived in `docs/HISTORY.md §17`.
