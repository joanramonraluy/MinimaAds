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

### Session: 2026-06-13 (patch 4) — Perf fix: eliminate duplicate getCampaign() in REWARD_REQUEST hot path

**Task**: Performance regression identified post-audit: reward receipt was taking noticeably longer (seconds) after T7 added a `getCampaign()` call inside `_handleRewardRequestInner`. The campaign had already been loaded by the caller `handleRewardRequest`, so the inner call was a redundant MDS.sql() round-trip on every single reward request.

**Fix**:
- **Remove duplicate DB call**: Changed `_handleRewardRequestInner` signature to accept `campaign` as a 6th parameter. `handleRewardRequest` now passes its already-loaded campaign object down. The `getCampaign()` call inside `_handleRewardRequestInner` is removed; the T7 accrual delta and cooldown checks now use the passed `campaign` directly.
- **No security impact**: The campaign object is loaded from the creator node's own DB within the same call stack — it is not controlled by the sender.

**Files modified**: `public/service-workers/handlers/channel.handler.js`

**AGENTS.md updated**: yes — §6 updated, oldest entry moved to `docs/HISTORY.md §17`.

---

### Session: 2026-06-13 (patch 3) — Fix direct routing fallback and rate-limit clearing on discovery failures

**Task**: Fix viewer discovery failing to request campaign details from the creator node when the contact relationship is not yet established. If `publickey` routing fails, fallback to direct `to:` routing was attempting to send to the MLS server address itself instead of the full permanent route address (causing the request to be lost). Also, ensure that if campaign requests fail (`ok: false`), the rate limit is reset so that discovery retries immediately on subsequent blocks rather than waiting 30 seconds.

**Fix**:
- **Full Fallback Routing**: Modified `processEscrowCoin` in `campaign.handler.js` to preserve the full permanent route string (`MAX#<pk>#<mls_address>`) in `creatorMxAddr` instead of extracting only the MLS server address (`routeParts[2]`).
- **Dynamic Contact Handling**: Modified `_sendRequestCampaignData` in `campaign.handler.js` to dynamically handle both raw addresses and full permanent routes, setting the `creatorMx` parameter passed to `sendMaxima` to the full permanent route. This ensures `sendMaxima`'s `to:` fallback executes `to:MAX#...`, which correctly query-resolves the destination's current direct address via MLS lookup.
- **Immediate Discovery Retries**: Added a check in `processEscrowCoin`'s `_sendRequestCampaignData` callback to clear `_pendingCampaignRequests[campaignId]` if the request failed (`ok: false`), enabling immediate retry on subsequent blocks.

**Files modified**: `public/service-workers/handlers/campaign.handler.js`

**AGENTS.md updated**: yes — §6 updated.

---

### Session: 2026-06-13 (patch 2) — Fix validation & self-healing for custom key overrides

**Task**: Fix creator campaign launch failure caused by invalid `FOUNDATION_KEY_OVERRIDE` or `PLATFORM_KEY_OVERRIDE` values (e.g. Maxima route strings `MAX#...` saved instead of wallet `0x...` hex addresses), causing escrow transaction builds to fail with a `NumberFormatException`.

**Fix**:
- **Self-Healing on Boot**: Added format validation checks using `isHexKey` to key override loaders during bootstrap in `service.js` (SW) and `dapp/app.js` (FE). Any malformed or invalid custom override key detected on startup is automatically cleared from the MDS keypair storage.
- **Input Validation**: Added `isHexKey` format checks inside `dapp/views/devtools.js` when saving custom override values or using "Set Self Wallet" actions. Malformed keys are rejected immediately with a user-facing error message in the status bar.

**Files modified**: `service.js`, `dapp/app.js`, `dapp/views/devtools.js`

**AGENTS.md updated**: yes — §6 updated, oldest entry moved to `docs/HISTORY.md §17`.

---

> Previous handoff notes (T-SC1–T-SC7, VW-1–VW-3, UI sessions 2–13, Remove Section 1.3, Auto-Sync Platform Creator Route, Unify MLS DevTools, Fix Viewer and Publisher Reward Delivery, Fix Publisher Budget (Multi-Publisher Support), Fix Stale-Pending Publisher Channel Deadlock, Minima Foundation Fee (3%) + V4 Escrow Script Fixes, 2026-06-10 settlement fixes, Security audit T7/T9, and all earlier) are archived in `docs/HISTORY.md §17`.
