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

### Session: 2026-06-04 — Fix: Built-in Viewer Publisher Rewards Not Earned

**Task**: Diagnose and fix why the built-in viewer (integrated snippet in MinimaAds) produces viewer rewards but publisher rewards are never generated or sent.

**Investigation**: Opus traced the reward flow end-to-end across frames.js → comms.handler.js → channel.handler.js → voucher pipeline. The channel/voucher infrastructure is correct and capable of publisher-reward generation. The single defect: `viewer.js:313` and `:331` hardcoded `publisherKey: ''` in both `MA_TRACK_VIEW` and `MA_TRACK_CLICK` payloads. Per spec (§96, §664-669), the built-in viewer IS a registered Frame with `publisher_key = node's own Maxima PK`, and should self-publish (earn publisher rewards on own views). An empty `publisher_key` causes the guard at `channel.handler.js:1309` (`if (r === 'viewer' && (frame_id || publisher_key))`) to skip `_maybeGeneratePublisherVoucher`, blocking the entire publisher-reward branch at the deferred-voucher step (where log shows viewer event created at user1.txt:37 then stops — no publisher voucher).

**Changes**:
- **dapp/views/viewer.js** (lines 313 and 331): Replace `publisherKey: ''` with `publisherKey: MY_ADDRESS`. `MY_ADDRESS` is the node's Maxima public key (set from `maxima action:info` at app.js:1842) — the same value used for the built-in frame ID. This enables the publisher-reward branch to fire on every view/click in the built-in viewer.

**Why**: Spec explicitly states the built-in viewer is a Frame and should earn publisher rewards on views. The previous empty key was likely a placeholder that was never filled in. Fixing it makes the built-in viewer behavior match documented intent and makes it consistent with custom-snippet frames (frames.js:242 correctly reads the publisher key from FRAMES and injects it).

**Note**: The built-in viewer publishes to itself, so one view generates both a viewer reward (creator ≠ viewer check) and a publisher reward (self-publishing). Spec allows this (Platform role = Viewer + Creator + Publisher). Confirm intent before shipping.

**AGENTS.md updated**: yes — §6 added this session entry.

---

### Session: 2026-06-04 — Documentation Audit: Publisher Campaign Discovery & SDK Integration

**Task**: Audit MinimaAds.md §6/§8/§13 to identify obsolete or misleading documentation about publisher campaign discovery post-MAXIMA_ROUTE_DISCOVERY, then fix any inaccuracies or gaps.

**Findings and Fixes**:
1. **§13.1 Minimal Integration** — was completely wrong. Documented old API (`MinimaAdsPublisherHandleMdsEvent`, `MinimaAdsPublisherInit`) that doesn't exist. Rewritten to accurately describe the self-contained comms-broadcast snippet that frames.js actually generates: patches `MDS.init`, sends `MA_GET_AD` / `MA_TRACK_VIEW` / `MA_TRACK_CLICK` messages to the host's SW.
2. **§8.3 platform_key contradiction** — line 974 contradicted line 970. Line 970 (correct) says "must NOT validate platform_key from payload"; line 974 (stale) said "must validate platform_key". Deleted line 974.
3. **§6.3 STATE(4) mislabel** — example JSON showed `"4":"<creator_mx_address>"` but the code stores a permanent route `MAX#...`. Relabeled to `<creator_permanent_route MAX#pk#mls>`.
4. **MAXIMA_ROUTE_DISCOVERY.md status** — said "design note for future implementation" but the core recommendation (STATE(4) route) is already implemented. Updated to "Partially implemented (STATE(4) DONE; route caches / PEER_ROUTE_UPDATE still future)".
5. **§13 gap** — SDK section was silent on campaign discovery responsibility. Added 3-line note: "Campaign discovery is SW responsibility, not SDK call. SDK reads from pre-populated CAMPAIGNS table via getAd()."

**Result**: Documentation now accurately describes MAXIMA_ROUTE_DISCOVERY system end-to-end, from on-chain escrow discovery through publisher snippet campaign retrieval.

**AGENTS.md updated**: yes — §6 added this session entry.

---

### Session: 2026-06-04 — Fix: MAXIMA_ROUTE_DISCOVERY Campaign Platform_Key Mismatch

**Task**: Diagnose and fix campaign discovery rejection caused by `platform_key mismatch` error blocking user4 (MinimaAds creator) from accepting campaigns from other nodes.

**Root Cause**: The MAXIMA_ROUTE_DISCOVERY changes enabled reliable cross-node campaign discovery, which exposed a latent bug: the `platform_key` validation in `campaign.handler.js` (lines 33-37) compared the announced key from the Maxima payload against the receiver's local `PLATFORM_KEY` override. When nodes had different `PLATFORM_KEY` values (per-node overrides set via DevTools), campaigns were silently rejected as mismatches. The payload-based check is also spoofable — the real authority is the on-chain `PREVSTATE(5)` in the escrow coin.

**Changes**:
- **public/service-workers/handlers/campaign.handler.js** (lines 33-41): Commented out the spoofable payload-based `platform_key` check. Added explanation: the authoritative validation is on-chain via `PREVSTATE(5)`.
- **public/service-workers/handlers/campaign.handler.js** (lines 59): Updated the on-chain `PREVSTATE(5)` validation to accept campaigns where `PREVSTATE(5) = 0x00` (creator had no platform fee). Old logic: `!onChainPk || onChainPk !== PLATFORM_KEY` would reject. New logic: `onChainPk && onChainPk !== '0x00' && onChainPk !== PLATFORM_KEY` accepts 0x00 regardless of receiver's local setting.
- **sdk/index.js** (lines 970-972): Applied the same fix to the SDK path's `_persistCampaignPayload` function. Commented out the equivalent payload-based platform_key check for consistency.

**Why**: The payload-based check breaks cross-node discovery and is a security anti-pattern (payload is attacker-controlled). The on-chain validation already exists and is authoritative. See KNOWN_ISSUES.md #31 principle: "never read PREVSTATE from announced JSON payload as primary verification — always verify on-chain."

**Testing required**:
- User1 creates campaign without fee (PREVSTATE(5) = 0x00).
- User4 (with PLATFORM_KEY override) discovers the escrow coin.
- User4 receives `CAMPAIGN_DATA_RESPONSE` from user1.
- Campaign is accepted and persisted (no "platform_key mismatch" log).
- Same test with both nodes having different PLATFORM_KEY overrides (should still accept).

**Note on Commission**: Platform creation fees are **already paid as part of the escrow funding tx** (creator.js line 1500-1604). User1 either includes a fee output (output[0] to PLATFORM_KEY, output[1] to escrow) or does not. This is a wallet-level transfer, not a DB reward event. The commission was never "missing" — it was either created or not at creator's choice. The bug only prevented the campaign from being visible on user4's node.

**AGENTS.md updated**: yes — §6 added this session entry.

---

### Session: 2026-06-04 — Settings Page Accordions

**Task**: Refactor the Settings page to consolidate all sections (Appearance, Maxima Routes, and Privacy) into collapsible accordions (details/summary elements), keeping only Appearance open by default, and handling automatic route-based expansion.

**Changes**:
- **dapp/views/settings.js**: Refactored `renderSettings()` to use PicoCSS details/summary accordions. Integrated `renderMaximaRoutesSettings` inside the "Configure Maxima Routes" accordion. If the URL hash is `settings/maxima-routes`, it opens the routes accordion, collapses Appearance, and scrolls the routes section into view.
- **dapp/views/settings-maxima-routes.js**: Removed the standalone heading so the MLS and permanent route configuration forms embed cleanly in the accordion, and updated the description to note that the feature is essential for both campaign creators and publishers.
- **dapp/views/creator.js**: Moved the campaign creation status/error message paragraph inside the review panel, directly below the "Publish Campaign" button.

**Why**: Consolidates settings configuration onto a single screen to eliminate unnecessary sub-page redirects, while maintaining backward-compatibility with `#settings/maxima-routes` deep links.

**Testing required**:
- Navigate to `#settings` → Appearance should be open, other accordions closed.
- Click "Configure Maxima Routes" → verify it opens and contains MLS, Permanent User registration, and Finalise options.
- Click a redirection link/trigger (e.g. Creator view without route) → page redirects to `#settings/maxima-routes`, which opens the routes accordion, collapses Appearance, and scrolls to the routes section.

---

### Session: 2026-06-04 — Settings: Maxima Routes Page

**Task**: Move MLS/permanent route configuration from inline creator banner to a dedicated Settings sub-page (`#settings/maxima-routes`). Both Creator and Publisher views redirect to that page when no permanent route is registered.

**Changes**:
- **dapp/views/settings-maxima-routes.js** (new): `renderMaximaRoutesSettings(root)` — 3 sections: MLS Server Address (save to keypair), Register as Permanent (maxextra addpermanent), Finalise Route Registration (setCreatorMaximaRoute + live route display).
- **dapp/views/settings.js**: added sub-route dispatch — `hash === 'settings/maxima-routes'` → call `renderMaximaRoutesSettings`. Added "Maxima Routes" section to main settings page with `Configure Maxima Routes ›` link.
- **dapp/views/creator.js**: removed `_showCreatorRouteSetupBanner()` and `_copyToClipboard()`. `renderCreator` now calls `getCreatorMaximaRoute` and redirects to `#settings/maxima-routes` when no route is set. No more inline 3-step wizard.
- **dapp/views/frames.js**: added same `getCreatorMaximaRoute` redirect check at start of `renderFrames` — publisher without a registered route is redirected to `#settings/maxima-routes`.
- **dapp/app.js**: `currentRoute()` now recognises `settings/maxima-routes`. `renderNav` and `setMode` treat it as a settings-family route (no nav links, mode change navigates away). `doRender` routes both `settings` and `settings/maxima-routes` to `renderSettings`.
- **public/index.html**: added `<script src="dapp/views/settings-maxima-routes.js">` after settings.js.

**Why**: Centralises route setup into a discoverable, permanent Settings page. Removes the inline banner that cluttered the Creator form. Publisher route setup was missing entirely — now covered by the same redirect pattern.

**Testing required**:
- Navigate to `#settings` → verify "Maxima Routes" section is visible with "Configure Maxima Routes ›" link.
- Click the link → verify `#settings/maxima-routes` loads the three-section page (MLS Server, Register as Permanent, Finalise Route Registration).
- Node without permanent route: navigate to `#creator` → should redirect to `#settings/maxima-routes`.
- Node without permanent route: navigate to `#frames` → should redirect to `#settings/maxima-routes`.
- Node with permanent route already set: `#creator` and `#frames` should load normally (no redirect).
- On `#settings/maxima-routes`: fill MLS address, click Save → verify `MLS_SERVER_ADDRESS` is stored. Click "Register as Permanent" → verify command executes. Click "Check & Register Route" → verify route is shown in green.

---

### Session: 2026-06-04 — DevTools Polish & SQL Console Removal

**Task**: Fix DevTools CSS layout, remove the SQL console, adjust button styling, remove the Copy command button, add "Copy Address" helper buttons, remove the "Client Mode (Advanced)" section, and ensure MLS Save configures static MLS.

**Changes**:
- **dapp/views/devtools.js**: Removed SQL console inputs, textarea, run button, outputs, and the `runQuery` function. Re-styled the entire modal layout with modern glassmorphism overlay using PicoCSS theme variables. Added smooth open/close animations. Aligned all input rows (Platform Key, MLS Server) to a consistent 2.2rem height. Renamed the Platform Key "Register" button to "Save". Removed the "Copy: maxextra action:staticmls" button. Added "Copy Address" buttons to both the Platform Key Configuration and MLS Server Configuration sections to easily copy active addresses. Fixed the MLS Server configuration "Save" button to execute `maxextra action:staticmls` on the node, ensuring the setting applies at the platform level. Completely removed the "Client Mode (Advanced)" section since route setup is now fully managed on the Settings page.

**Why**: Simplifies development settings, makes input-button alignments consistent, cleans up redundant command buttons, and resolves a bug where saving the MLS server via DevTools failed to actually register the MLS server with the Maxima stack.

**Testing required**:
- Press `Ctrl+Shift+D` to toggle DevTools.
- Verify that inputs and "Save" buttons are perfectly aligned in height (2.2rem).
- Verify that the Platform Key custom address registration button is named "Save".
- Verify that the "Client Mode (Advanced)" section is completely gone from the DevTools dialog.
- Verify that both the Platform Key and MLS Server configuration sections have a "Copy Address" button.
- Click "Copy Address" in either section and verify the respective key/address is copied to your clipboard (showing a quick status change in the card).
- Type a valid MLS Server address in the DevTools input and click "Save": verify it displays "MLS server applied and saved" and correctly configures Maxima's static MLS at the platform level.
- Close the modal with `✕` or by clicking outside and verify the transition is smooth.

> Previous handoff notes (T-SC1–T-SC7, VW-1–VW-3, UI sessions 2–13, and all earlier) are archived in `docs/HISTORY.md §17`.
