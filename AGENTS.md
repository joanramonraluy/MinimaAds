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
| Project topology, DB mirror, protocols, signals | `docs/PROJECT_NOTES_REFERENCE.md` |
| Fragility points and open bugs | `docs/KNOWN_ISSUES.md` |
| Active task list | `docs/TASKS.md` |
| Long change history | `docs/HISTORY.md` |
| Archived docs (UI guides, roadmaps, old tasks) | `docs/archive/` |

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

## 3.5) Contracts, Forbidden Actions, Platform Rules

These are defined in `CLAUDE.md` (always loaded). Do not repeat them here.

- **Stable Core API signatures** → `CLAUDE.md §5`
- **Forbidden actions** → `CLAUDE.md §6`
- **Rhino / H2 / MDS / Maxima runtime constraints** → `CLAUDE.md §7`
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

For verification procedures, see `docs/archive/VERIFICATION.md`.

---

## 6) Current Handoff Notes

> **Rule**: keep the 3 most recent sessions here, as **short pointers only** — one-line summary + files touched + open issues, ending with a reference to the full narrative in `docs/HISTORY.md §17`. The full problem/fix/verification write-up is written **once**, directly into `docs/HISTORY.md §17`, never duplicated here. When adding a new entry pushes this past 3, just **delete** the oldest pointer — nothing to move, its full content already lives permanently in `docs/HISTORY.md §17`. This section is loaded every session — keep it short.

### Session: 2026-09-06 (OPEN-2) — VOUCHER_SYNC_REQUEST rebuilds the voucher instead of replaying stored hex

Fixed `docs/KNOWN_ISSUES.md` OPEN-2: `handleVoucherSyncRequest` resent `LATEST_TX_HEX` verbatim, so a genuinely invalid stored voucher (e.g. pre-fragility-#49/#54 dust, or a moved coin) stayed broken forever — only a new reward event ever rebuilt a fresh one. Fixed by calling `swBuildAndExportVoucherTx` directly (same machinery a live reward uses) whenever the channel is still open, with `rewardAmount:0` explicitly — bypassing the normal `_swDispatchVoucher` reward-flow wrapper, which always computes a nonzero reward amount and would have created a phantom duplicate `REWARD_EVENT` per resync otherwise. New `_resendStoredVoucher` helper (the original inline behavior, unchanged) is the fallback when a rebuild isn't possible (channel not open, or campaign/wallet lookup fails) — resync can only get better, never worse. Verified live: corrupted a real publisher voucher's `LATEST_TX_HEX` to a nonsense placeholder, called the real `_requestVoucherResync(...,'publisher')` — creator's log: `rebuilding voucher fresh` → `SW voucher tx: ... cumulative: 0.01 role: publisher`; the channel's `LATEST_TX_HEX` became a genuinely fresh tx (different length from both original and corrupted values), `CUMULATIVE_EARNED` unchanged, and `REWARD_EVENTS` count stayed exactly the same before/after (no phantom duplicate). Files: `public/service-workers/handlers/channel.handler.js`. Open issues: none remaining in `docs/KNOWN_ISSUES.md` §1b — both OPEN-1 and OPEN-2 now fixed and live-verified. Full detail: `docs/HISTORY.md §17`, session 2026-09-06 (OPEN-2).

---

### Session: 2026-09-06 (live verification: fragility #54 / OPEN-1) — SW-level confirmation on the redeployed harness

Follow-up to the Opus subagent's fix + `txncheck` proof (previous entry). Maintainer redeployed the fix to all 6 nodes. Reused the live 4+ node setup: engineered `CAMPAIGNS.MAX_PUBLISHER_BUDGET`/`PUBLISHER_BUDGET_SPENT` via `MDS.sql` to values that dust in raw JS (`10-9.9`, `0.03-0.01`), then drove 3 separate real publisher `CHANNEL_OPEN_REQUEST`s end-to-end via real `MA_TRACK_VIEW` broadcasts. All 3 opened successfully (`STATUS='open'`, real coin, real voucher) — confirmed why by reading the deployed code: `pubRemaining` is now computed via `swMicroToAmount(swAmtToMicro(...) - swAmtToMicro(...))`, integer micro-units before subtracting, so no raw-float dust can reach `effectiveCap` regardless of input. Node 1's own log confirms a clean `remaining=0.015` where pre-fix would have carried dust. Second independent confirmation layer on top of the subagent's `txncheck` proof — not required to trust the fix, but closes any doubt about the deployed code specifically. Files: none (verification only). Open issues: OPEN-2 is the only remaining open item in `docs/KNOWN_ISSUES.md` §1b. Full detail: `docs/HISTORY.md §17`, session 2026-09-06 (live verification: fragility #54 / OPEN-1).

---

### Session: 2026-09-06 (OPEN-1 / fragility #54) — publisher channel-open tx silently rejected by the escrow script on float dust

Fixed `docs/KNOWN_ISSUES.md` OPEN-1. `pubMaxBudget - pubEarned` is a raw JS float subtraction that dusts on ordinary values (`10 - 9.9 === 0.09999999999999964`); that value reached both escrow tx builders unrounded. Sharper failure than #53: both builders spend escrow-scripted coins, and `ESCROW_SCRIPT` *derives* `change = @AMOUNT - STATE(10)` and asserts `VERIFYOUT` on it with exact `MiniNumber` equality — so the split tx's independently-rounded change output can never match (Tx1), and the channel-open tx's DB-cached `STATE(10)` leaves a phantom change the tx never emits (Tx2). `txnpost` validates nothing, so the channel silently never opened. Fix mirrors #53: derive every output from the real input coin amount read off `txninput`, in integer micro-units; new helper `swAmountResidual` lets `STATE(10)` carry a legacy dusty coin's sub-micro digits so the change lands exactly. Both builders are shared with the viewer path, so that path is fixed too (stated deliberately, not scope creep); #53's voucher builder untouched. Verified live on the running harness with `txncheck` against the real 499.45 escrow coin — pre-fix `valid.scripts:false`, post-fix `valid.scripts:true` with `burn:0` — nothing posted, harness state restored. Files: `public/service-workers/handlers/channel.handler.js`. Open issues: OPEN-2 still open; nodes not redeployed (verification used Minima's validator directly). Full detail: `docs/HISTORY.md §17`, session 2026-09-06 (OPEN-1 / fragility #54).

---

> Previous handoff notes (AUD-1, patches 15–25, Security Audit 2, and all earlier) are archived in `docs/HISTORY.md §17`.

