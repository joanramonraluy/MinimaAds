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

### Session: 2026-06-05 — Add frame_id to REWARD_REQUEST Payload

**Task**: Include `frame_id` in the `REWARD_REQUEST` Maxima message so the creator node can identify which frame originated the reward request (specifically, built-in frames).

**Changes**:
- **public/service-workers/handlers/comms.handler.js** (`_sendRewardRequest`, line ~349):
  - Added `frame_id: "builtin:" + MY_MAXIMA_PK.toUpperCase()` to the `payload` object.
  - `MY_MAXIMA_PK` is already a global initialized at SW startup in `service.js` and was already used in this function — no new dependency introduced.

**Why**: The creator's `PUBLISHER_REWARD_NOTIFY` routing needs to know the frame that generated the reward. For built-in frames, the frame ID is `"builtin:" + viewerMaximaPK`. Without this field the creator could not correlate the reward request to a specific frame.

**AGENTS.md updated**: yes — §6 added this entry; oldest (Brand Header Navigation to Home) moved to `docs/HISTORY.md §17`.

**Verification**:
  - Open `#viewer` on the viewer node and view an ad for ≥3 s.
  - In the SW log on the viewer node, confirm `REWARD_REQUEST sent` appears.
  - On the creator node, receive the `REWARD_REQUEST` and confirm `frame_id` is present in the decoded payload (e.g. `"builtin:0XABC..."`).
  - No console errors expected on either node.

---

### Session: 2026-06-05 — Viewer Collapsibles and Expandable Table Rows CSS Polish

**Task**: Style collapsibles and expandable rows in the viewer earnings dashboard (`dapp/views/earnings.js`) to match the premium aesthetics of the creator campaign metrics (`dapp/views/mycampaigns.js`).

**Changes**:
- **dapp/views/earnings.js**:
  - For "Pending settlements" (lines ~364–386), updated the `<details>`/`<summary>` element to use `className = 'ma-campaign-details'` and `className = 'ma-campaign-details-summary'` and removed the inline style.
  - For "Settled channels" (lines ~203–240), refactored the expandable table row to use `className = 'ma-expandable-row'`, `tabindex = '0'`, and `aria-expanded = 'false'`. Replaced the plain `▶`/`▼` toggle button with an animated `›` span chevron. Configured row-level click and keyboard Enter/Space event listeners to toggle the expansion and transition the rotation of the chevron, using the `ma-nested-detail` class on the inner detail cell.

**Why**: Unifies the UI layout, brings the custom focus states, hover backgrounds, and smooth chevron transitions from the Campaign card accordion lists to the viewer's personal Earnings views.

**Testing required**:
- Navigate to `#earnings`.
- Check the "Pending settlements" section: the "Show events" details collapsible should have hover styling matching the creator activity chart collapsibles.
- Check the "Settled channels" section: click anywhere on a settled campaign row to expand/collapse it, verifying the `›` chevron transitions to 90 degrees and the detail table loads correctly.

---

### Session: 2026-06-05 — Publisher Notify on Deferral

**Task**: After `_deferPublisherReward()` saves a pending publisher reward, the publisher (e.g. platform creator for built-in frames) was never notified to open a channel. Without the notify, the deferred reward remained orphaned indefinitely.

**Root cause**: `_maybeGeneratePublisherVoucher` called `_deferPublisherReward()` on both its fast path (publisherKey provided) and legacy path (no publisherKey, FRAMES lookup), but neither path sent `PUBLISHER_REWARD_NOTIFY` afterward. The existing `_maybeNotifyPublisher()` requires a FRAMES row with `PUBLISHER_MX` — which doesn't exist on the creator node for built-in frames where `publisherKey = MINIMAADS_CREATOR_PK`.

**Changes**:
- **public/service-workers/handlers/channel.handler.js**:
  - Added `_notifyPublisherByKey(campaignId, frameId, publisherKey)` — sends `PUBLISHER_REWARD_NOTIFY` directly via `sendMaxima(publisherKey, null, ...)` (no FRAMES lookup). Guards against sending if channel already open/pending.
  - Fast-path deferral (line ~1056): added `_notifyPublisherByKey(campaignId, frameId || publisherKey, publisherKey)` after `_deferPublisherReward`.
  - Legacy-path deferral (line ~1090): added `_maybeNotifyPublisher(campaignId, frameId)` after `_deferPublisherReward`. (Legacy path still needs FRAMES to get `PUBLISHER_MX` for non-builtin frames; `_notifyPublisherByKey` isn't applicable since no key is available.)

**Assumption/Gap**: `sendMaxima(publisherKey, null, ...)` uses `publickey:` Maxima routing, which requires the creator node to have a route to the publisher's node. For the built-in frame (MINIMAADS_CREATOR_PK), the platform creator's node must be reachable via Maxima. If no route is cached, the notify will fail silently (`ok=false` logged). The `_replayDeferredPublisherRewards` NEWBLOCK sweep remains the safety net for this case.

**AGENTS.md updated**: yes — §6 added this entry; oldest (Settings Page Accordions) moved to docs/HISTORY.md §17.

**Verification**: Open `#viewer`, view an ad ≥3s. In the SW log on the creator node, look for:
  - `[CHANNEL] _maybeGeneratePublisherVoucher: publisher channel not open — DEFERRING.`
  - Immediately after: `[CHANNEL] PUBLISHER_REWARD_NOTIFY (by-key) sent pubKey: ... ok=true`
  - On the platform creator's node: `[CHANNEL] PUBLISHER_REWARD_NOTIFY` received + `CHANNEL_OPEN_REQUEST (role=publisher)` sent back.
  No console errors expected.


---

> Previous handoff notes (T-SC1–T-SC7, VW-1–VW-3, UI sessions 2–13, and all earlier) are archived in `docs/HISTORY.md §17`.
