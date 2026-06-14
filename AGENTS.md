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

### Session: 2026-06-14 (patch 5) — Fix: isHexKey case-insensitivity (N2-1 regression)

**Problem**: After deploying N2-1 (sendMaxima validation guard in patch 3), viewers could not see any campaigns. Root cause: `isHexKey()` validator used regex `/^0x.../` (lowercase x) but Minima stores Maxima PKs via `.toUpperCase()` → `0X...` (uppercase x). ALL sendMaxima calls from viewers were rejected, blocking REQUEST_CAMPAIGN_DATA and CHANNEL_OPEN_REQUEST messages.

**Fix**: Changed `/^0x.../` to `/^0[xX].../` in `core/minima.js:41` to accept both cases. Same class of bug as commit 424207c (isHexKey limit too strict). Added fragility point #45 to `docs/KNOWN_ISSUES.md` explaining the issue and rule for future validators.

**Files modified**: `core/minima.js`, `docs/KNOWN_ISSUES.md`.

**AGENTS.md updated**: yes — §6 updated, oldest entry (patch 2, click reward blocked by view cooldown) moved to `docs/HISTORY.md §17`.

**Verification**: Reinstall MiniDapp + reload browser → viewers see campaigns in all nodes.

---

### Session: 2026-06-14 (patch 4) — N2-2 fix: restore click cooldown via LAST_CLICK_VOUCHER_AT

**Task**: Reverse the click-cooldown regression from `508b7ed` (audit finding N2-2). That commit made click `REWARD_REQUEST`s skip the server-side cooldown entirely, leaving clicks rate-limited only by the per-channel cap + accrual delta — fund-affecting (self-reported clicks could drain a channel's `MAX_AMOUNT` in seconds).

**Fix**: Added a SEPARATE click timestamp so a click immediately after a view is still allowed, but click→click is paced by the campaign cooldown.
1. **DB (both runtimes)**: `ALTER TABLE CHANNEL_STATE ADD COLUMN IF NOT EXISTS LAST_CLICK_VOUCHER_AT BIGINT DEFAULT 0` in `public/service-workers/db-init.js` and FE init in `dapp/app.js`.
2. **SW cooldown** (`channel.handler.js` ~590): removed the `!== 'click'` bypass; now selects `LAST_CLICK_VOUCHER_AT` for clicks vs `LAST_VOUCHER_AT` for views, then applies the same cooldown.
3. **Core** (`core/channels.js`): `updateChannelVoucher(...,, cb, rewardType)` — appends `LAST_CLICK_VOUCHER_AT = now` only when `rewardType==='click'`. Backward-compatible (omitted param → unchanged behaviour).
4. **Callers threaded**: SW `swBuildAndExportVoucherTx` (creator-side commit — authoritative for cooldown) + `_continueRewardVoucher`; FE `app.js` voucher paths; SDK `_handleRewardVoucherPayload`.

**Files modified**: `public/service-workers/db-init.js`, `dapp/app.js`, `core/channels.js`, `public/service-workers/handlers/channel.handler.js`, `sdk/index.js`, `MinimaAds.md` (§7 signature), `docs/audit_report_2.md` (N2-2 → Done).

**AGENTS.md updated**: yes — §6 updated, oldest entry (Timing + 3 NEWBLOCK perf fixes) moved to `docs/HISTORY.md §17`.

**Not yet 2-node verified.**

---

### Session: 2026-06-14 (patch 3) — Second security audit + N2-1 fix (sendMaxima injection guard)

**Task**: Second comprehensive security audit (`docs/audit_report_2.md`). Verified all first-audit fixes (C-1, C-2, M-1..M-4, L-1..L-4, N-2, N-4) are resolved. Found new issues: N2-1 (MEDIUM, command injection via `sendMaxima`), N2-2 (MEDIUM, click cooldown regression from `508b7ed`), N2-3 (MEDIUM, publisher budget not capped at voucher time), N2-4/N2-5/N2-6 (LOW).

**Fix applied (N2-1 only)**: Added central validation in `sendMaxima` (`core/minima.js`) — rejects a `publicKey` that fails `isHexKey` or an `mxAddress` that fails `isMaximaRoute` before they reach `MDS.cmd("maxima action:send ...")`. Closes the C-2-class injection on `viewer_key`/`publisher_key`/`publisher_mx` (the original T1/T2/T14 sweep guarded the call sites but not these routing keys, and `sendMaxima` itself had no guard). Worst-case averted: injected `poll:true` → ~77s SW freeze (remote DoS).

**Deferred (documented in `docs/audit_report_2.md` §10)**: N2-2/N2-3 → dedicated Opus sessions (hot path + schema in both runtimes / concurrent logic). N2-4 → design task (naive `senderPk === viewer_key` guard breaks the SDK path, which opens channels with a wallet key as `viewer_key`).

**Files modified**: `core/minima.js`, `docs/audit_report_2.md` (new), `AGENTS.md`, `docs/HISTORY.md`.

**AGENTS.md updated**: yes — §6 updated, oldest entry (2026-06-13 patch 4) moved to `docs/HISTORY.md §17`.

---

### Session: 2026-06-14 (patch 2) — Fix click reward blocked by view cooldown

**Task**: Click reward not delivered to viewer after clicking an ad. Viewer SDK sent REWARD_REQUEST with `reward_type:'click'` and correct cumulative, but creator SW rejected it with "cooldown not elapsed."

**Root cause**: `LAST_VOUCHER_AT` in `CHANNEL_STATE` is a single timestamp shared by view and click events. After issuing a view voucher, the cooldown timer resets. A click sent within the cooldown window (e.g. 4 s < 30 s) was incorrectly blocked.

**Fix**: In `_handleRewardRequestInner` (`channel.handler.js` line ~590), wrapped the LAST_VOUCHER_AT cooldown check in `if ((payload.reward_type || 'view') !== 'click')`. Click events now bypass the view cooldown; anti-spam for clicks is already enforced by `isDuplicate(eventId)` + the accrual delta check.

**Files modified**: `public/service-workers/handlers/channel.handler.js`

**AGENTS.md updated**: yes — §6 updated, oldest entry (patch 3, 2026-06-13) moved to `docs/HISTORY.md §17`.

---

> Previous handoff notes (T-SC1–T-SC7, VW-1–VW-3, UI sessions 2–13, Remove Section 1.3, Auto-Sync Platform Creator Route, Unify MLS DevTools, Fix Viewer and Publisher Reward Delivery, Fix Publisher Budget (Multi-Publisher Support), Fix Stale-Pending Publisher Channel Deadlock, Minima Foundation Fee (3%) + V4 Escrow Script Fixes, 2026-06-10 settlement fixes, Security audit T7/T9, and all earlier) are archived in `docs/HISTORY.md §17`.
