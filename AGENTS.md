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

### Session: 2026-06-06 — Fix Stale-Pending Publisher Channel Deadlock

**Task**: Publisher rewards from snippets (and built-in frame) not reaching publishers. Diagnosed via `logs/user1.txt`, `logs/user2.txt`, `logs/user4.txt`.

**Root Cause**: A stale `pending` publisher channel on the creator node caused a deadlock. When a REWARD_REQUEST arrives and no `open` publisher channel exists, `_maybeGeneratePublisherVoucher` defers and calls `_doNotifyPublisherByKey`. That function previously suppressed `PUBLISHER_REWARD_NOTIFY` for **both** `open` AND `pending` channels (line: `ch.STATUS === 'open' || ch.STATUS === 'pending'`). A `pending` channel means the creator ran Tx1+Tx2 but the `CHANNEL_OPEN` Maxima message never reached the publisher. With no notification, the publisher never re-sent `CHANNEL_OPEN_REQUEST`, so the channel stayed stuck in `pending` indefinitely. No deferred publisher rewards were ever replayed. Same bug existed in `_maybeNotifyPublisher` (the legacy frame-lookup path).

**Fix** (`channel.handler.js`, two functions):
- `_doNotifyPublisherByKey`: changed suppression from `open || pending` to `open` only. Added stale-pending guard: if `pending` but channel was created < 5 min ago → skip (TX in flight). If `pending` and ≥ 5 min old → log and send `PUBLISHER_REWARD_NOTIFY` anyway. The publisher has no channel state on its side (it never received `CHANNEL_OPEN`), so it will re-send `CHANNEL_OPEN_REQUEST`, which triggers the creator's stale-pending retry/archive logic.
- `_maybeNotifyPublisher`: same fix applied symmetrically.

**AGENTS.md updated**: yes — §6 updated.

**Verification**:
- `channel.handler.js` compiles cleanly with `node -c`.
- Trigger a view on a snippet after the creator already has a stale `pending` publisher channel (> 5 min old): creator should log `_notifyPublisherByKey: stale pending channel (age=Xms) — re-notifying publisher`. Publisher should then log `PUBLISHER_REWARD_NOTIFY: ...`, send `CHANNEL_OPEN_REQUEST`, and creator should log stale-pending retry. Deferred rewards should replay after new channel opens.

---

### Session: 2026-06-06 — Fix Publisher Budget (Multi-Publisher Support)

**Task**: Second iteration of publisher budget fix. New diagnosis: `PUBLISHER_BUDGET_SPENT` was tracking MAX_AMOUNT *reservations* (100) when a channel opens, not actual payouts (10). After user4's builtin-frame channel opened, `PUBLISHER_BUDGET_SPENT = 100 = MAX_PUBLISHER_BUDGET`, blocking all subsequent publishers (user2 snippet, etc.).

**Root Cause (two sub-bugs)**:
1. **Wrong tracking field**: budget check used `PUBLISHER_BUDGET_SPENT` (tracks channel MAX_AMOUNT reservations) instead of `SUM(CUMULATIVE_EARNED)` (actual payouts). After one channel opens, even with minimal payout, the whole budget appeared exhausted.
2. **Wrong maxAmount for publisher channel**: `_doSendPublisherChannelOpenRequest` sent `max_amount = MAX_PUBLISHER_BUDGET` (total campaign publisher budget) instead of `PUBLISHER_REWARD_VIEW * 10` (a per-session cap mirroring viewer logic). This caused one channel to reserve the entire budget.

**Fixes** (`channel.handler.js`):
- Budget check now uses `SELECT SUM(CUMULATIVE_EARNED)` from all publisher `CHANNEL_STATE` rows. Multiple publishers can open channels concurrently as long as total actual payouts < `MAX_PUBLISHER_BUDGET`.
- `effectiveCap = min(requested, remaining)` — publisher's requested channel max is capped at remaining budget, so a publisher can still open even if their session cap > remaining.
- Reject only if `effectiveCap < PUBLISHER_REWARD_VIEW` (not enough for a single view).
- `_doSendPublisherChannelOpenRequest`: changed `maxAmount` from `MAX_PUBLISHER_BUDGET` to `PUBLISHER_REWARD_VIEW * 10`.

**AGENTS.md updated**: yes — §6 updated.

**Verification**:
- `channel.handler.js` compiles cleanly with `node -c`.
- Budget log now shows: `max=100 earned=10 remaining=90 requestedCap=100 effectiveCap=90` for user2 snippet after user4 earned 10.

---

### Session: 2026-06-06 — Fix Publisher Budget Check (snippet publishers blocked)

**Task**: Publisher nodes using the SDK snippet (custom frames) were being rejected by the creator with "insufficient publisher budget. remaining: 0 requested: 100", even though no budget had been exhausted.

**Root Cause**: `handleChannelOpenRequest` (publisher path) computed `pubRemaining` as `MAX_PUBLISHER_BUDGET - SUM(open channel MAX_AMOUNT)`. If a previous publisher's channel (e.g. builtin frame user4, MAX_AMOUNT=100) was still `STATUS='open'` on the creator DB (voucher sent but not yet settled on-chain), `pubAllocated=100` → `pubRemaining=0` → all new publishers were blocked.

**Fix**: `channel.handler.js` — replaced the `sqlQuery` over `CHANNEL_STATE` with a direct read of `campaign.PUBLISHER_BUDGET_SPENT` (already incremented when a channel is opened). `pubRemaining = MAX_PUBLISHER_BUDGET - PUBLISHER_BUDGET_SPENT`. A new publisher log line shows the full budget state for future debugging.

**AGENTS.md updated**: yes — §6 updated.

**Verification**:
- `channel.handler.js` compiles cleanly with `node -c`.
- With a first publisher channel open (STATUS='open'), a second publisher's CHANNEL_OPEN_REQUEST must be accepted (budget log shows max=100 spent=100 if first channel has been fully committed, or spent=0 if no channel has been opened yet).

---

> Previous handoff notes (T-SC1–T-SC7, VW-1–VW-3, UI sessions 2–13, Remove Section 1.3, Auto-Sync Platform Creator Route, Unify MLS DevTools, Fix Viewer and Publisher Reward Delivery, and all earlier) are archived in `docs/HISTORY.md §17`.

