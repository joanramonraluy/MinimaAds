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

### Session: 2026-06-14 (patch 8) — Fix: click cooldown warning on subsequent CTA clicks

**Problem**: Once a click reward is successfully claimed or rejected in a campaign details page, further clicks on the CTA in the same session open the link but do not update the UI status. The message remains stuck on `Reward received! +0,050 MINIMA` or the previous message, leaving the user without any visual feedback that subsequent clicks are not eligible for rewards due to the cooldown.

**Fix**:
1. **Viewer State** (`dapp/views/viewer.js`): Added a `clickRewardErrorMsg` field to the global `_viewerState` object. It is initialized to an empty string on entry/exit transitions.
2. **Rejection/Confirmation Handlers** (`dapp/views/viewer.js`): When a click is confirmed, it stores the standard warning message in `clickRewardErrorMsg`. When a click is rejected, it stores the exact `reasonMsg` (e.g. daily click limit or cooldown active) in the field.
3. **CTA Click Event Listener** (`dapp/views/viewer.js`): If the link is clicked when `rewardAllowed` is false and a `clickRewardErrorMsg` is present, the UI updates to show the warning message in red.

**Files modified**: `dapp/views/viewer.js`

**AGENTS.md updated**: yes — §6 updated, oldest entry (patch 5) moved to `docs/HISTORY.md §17`.

**Verification**: Claim a click reward, then click the CTA a second time within the cooldown window and verify that the red warning message `You must wait before earning another click reward from this campaign.` appears instantly.

---

### Session: 2026-06-14 (patch 7) — Fix: Display click cooldown UI warning

**Problem**: Although click-specific cooldown tracking was implemented in patch 4, the UI failed to display click-cooldown warning messages. When a click reward request was rejected due to an active cooldown, the Service Worker sent an `MA_TRACK_RESULT` broadcast, but the FE ignored public broadcasts to avoid signal collisions. This left the user interface stuck on "Processing reward..." indefinitely.

**Fix**:
1. **Comms Handler** (`public/service-workers/handlers/comms.handler.js`): Added private FE signals via `signalFE("MA_TRACK_RESULT", ...)` alongside the public broadcasts, and included the explicit `reward_type: "click"` / `"view"` key in the payload.
2. **Viewer UI** (`dapp/views/viewer.js`): Modified `onRewardValidation` to process the `reward_type` property. It now displays a custom warning message (`You must wait before earning another click reward from this campaign.`) and disables further click tracking (sets `_viewerState.rewardAllowed = false`) once a click is validated.

**Files modified**: `public/service-workers/handlers/comms.handler.js`, `dapp/views/viewer.js`

**AGENTS.md updated**: yes — §6 updated, oldest entry (patch 4) moved to `docs/HISTORY.md §17`.

**Verification**: Trigger click cooldown in a viewer flow and verify that the red click-specific cooldown warning message is displayed immediately in the status bar instead of hanging on "Processing reward...".

---

### Session: 2026-06-14 (patch 6) — Fix: increase isMaximaRoute length limit

**Problem**: outbound Maxima communication (channel open, rewards, liveness) failed with `[MINIMA] sendMaxima rejected: malformed mxAddress`. The validation regex limit of 600 characters in `isMaximaRoute` was too strict because Maxima permanent routes (`MAX#...`) concatenate prefix + 328-char public key hex + `#` + 286-char contact route, yielding 619 characters which exceeded the limit.

**Fix**: Increased the maximum character limit in `isMaximaRoute` in `core/minima.js` from 600 to 1200. This accommodates any valid permanent route containing MLS/IP connection addresses.

**Files modified**: `core/minima.js`

**AGENTS.md updated**: yes — §6 updated, oldest entries (patch 3 and patch 2) archived to `docs/HISTORY.md §17`.

**Verification**: reload the browser and nodes → verify that CAMPAIGN_DATA_RESPONSE and CHANNEL_OPEN_REQUEST messages are successfully transmitted and rewards/discovery resume.

---

> Previous handoff notes (T-SC1–T-SC7, VW-1–VW-3, UI sessions 2–13, Remove Section 1.3, Auto-Sync Platform Creator Route, Unify MLS DevTools, Fix Viewer and Publisher Reward Delivery, Fix Publisher Budget (Multi-Publisher Support), Fix Stale-Pending Publisher Channel Deadlock, Minima Foundation Fee (3%) + V4 Escrow Script Fixes, 2026-06-10 settlement fixes, Security audit T7/T9, and all earlier) are archived in `docs/HISTORY.md §17`.


