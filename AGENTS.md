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

### Session: 2026-06-06 — Fix Viewer and Publisher Reward Delivery (3 bugs)

**Task**: Diagnose and fix why viewers and platform creator (publisher) were not receiving rewards. Root cause traced via live node logs.

**Root Cause (3 bugs encadenats)**:
1. **Race condition** (`checkOpenChannelsSettled`): when Tx2 (channel open) mines and `swBuildAndPostChannelOpenTx` calls `activateChannel`, the same NEWBLOCK event triggers `checkOpenChannelsSettled` which queries `coins address:<CHANNEL_SCRIPT_ADDRESS>`. The new coin is not yet locally indexed (latency up to ~20s after mining), so `checkOpenChannelsSettled` immediately settles the channel. Subsequent `checkPendingVouchers` finds the channel as `settled` and stops processing the pending voucher.
2. **Pending voucher lost**: `checkPendingVouchers` only queried `STATUS = 'open'` channels, so prematurely-settled channels never had their pending vouchers retried.
3. **`publisherMx` absent**: viewer nodes don't have `MINIMAADS_CREATOR_ROUTE` set locally, so `_sendRewardRequest` sent `publisher_mx: ""` for built-in frame reward requests. The creator then couldn't notify the publisher (user4) to open a publisher channel.

**Fixes**:
- **`channel.handler.js` (Fix 1)**: `checkOpenChannelsSettled` now adds a 60-second grace period (`CREATED_AT`-based) before settling a channel whose coin isn't yet locally indexed.
- **`channel.handler.js` (Fix 2)**: `checkPendingVouchers` SQL now also includes `STATUS = 'settled' AND CREATED_AT > (now - 5 min)` so prematurely-settled channels still have their pending vouchers processed.
- **`channel.handler.js` (Fix 3a)**: `handleChannelOpen` now caches `pending.publisher_mx` as `PUBLISHER_MX_<campaignId>` keypair on the viewer node when processing `PENDING_REWARD`.
- **`comms.handler.js` (Fix 3b)**: `_sendRewardRequest` for built-in frames now falls back to `PUBLISHER_MX_<campaignId>` if `MINIMAADS_CREATOR_ROUTE` is not set on the viewer node.

**AGENTS.md updated**: yes — §6 updated.

**Verification**:
- Both `channel.handler.js` and `comms.handler.js` compile cleanly with `node -c`.
- Live logs confirmed: viewer receives `REWARD_VOUCHER cumulative:1`, publisher receives `REWARD_VOUCHER cumulative:10`, both reward events created on respective nodes.

---

### Session: 2026-06-06 — Unify MLS Naming in DevTools

**Task**: Fix terminology contradictions in the DevTools console (Ctrl+Shift+D): rename sections and buttons to match the actual underlying actions and be consistent with settings terminology.

**Changes**: **dapp/views/devtools.js** — renamed section titles and button labels.

**AGENTS.md updated**: yes — §6 updated.

**Verification**: `devtools.js` compiles cleanly with `node -c`.

---

### Session: 2026-06-06 — Auto-Sync Platform Creator Route

**Task**: Fix the contradiction where `CREATOR_PERMANENT_ROUTE` was registered but `MINIMAADS_CREATOR_ROUTE` remained `(not set)`, breaking built-in frame reward routing.

**Changes**: **config.js**, **service.js**, **core/minima.js**, **dapp/app.js**, **dapp/views/devtools.js** — auto-sync `MINIMAADS_CREATOR_ROUTE` from `CREATOR_PERMANENT_ROUTE` on boot and on registration.

**AGENTS.md updated**: yes — §6 updated.

**Verification**: All modified JS files compile cleanly with `node -c`.

> Previous handoff notes (T-SC1–T-SC7, VW-1–VW-3, UI sessions 2–13, Remove Section 1.3, and all earlier) are archived in `docs/HISTORY.md §17`.
