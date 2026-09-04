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

> **Rule**: keep the 3 most recent session entries here. Before adding a new entry, move the oldest one to `docs/HISTORY.md §17`. This section is loaded every session — keep keep it short.

### Session: 2026-09-04 (Fix #8) — Block-based campaign expiry instead of wall-clock ms

**Source**: `docs/IMPLEMENTATION_PLAN_2026-07-18.md` Phase 3, Fix #8 — the last open Phase 3 item and the one the plan flags as its highest-risk (a bug here terminally finishes live, funded campaigns). Delegated to an Opus session with plan-mode design, per maintainer instruction. **Phase 3 is now complete.**

**Fix** (`public/service-workers/handlers/campaign.handler.js` + `service.js`): `checkExpiredCampaigns()` compared `EXPIRES_AT < Date.now()` — but `EXPIRES_AT` is only an estimate computed at creation from a block count, while what the creator actually funded is the escrow coin's state port 2 (expiry block, MinimaAds.md App. B.3). Clock skew or block-time variance therefore killed still-funded campaigns permanently (`finished` is terminal, KNOWN_ISSUES #46). Now `checkExpiredCampaigns(currentBlock)` takes the tip height from the NEWBLOCK event (`msg.data.txpow.header.block`, read defensively in `service.js`) and per candidate campaign: reads the escrow coin via `MDS.cmd("coins coinid:" + ESCROW_COINID)` (no `relevant:` — depends on Fix #6) and finishes only when `currentBlock >= port 2`; falls back to the ms comparison **only** when the coin is absent/spent or carries no port 2, and then only past `EXPIRES_AT + 24 h`; defers entirely when the tip height is unknown rather than guessing. Coin lookups are bounded by a 48 h window on `EXPIRES_AT` in the SQL itself, so far-future campaigns are never looked up. `ESCROW_COINID` (which can arrive from a Maxima payload) is passed through the existing `isHexKey` guard before being interpolated into the MDS command. No schema change, no LIMITS change — the two thresholds are local named constants, matching the existing `SIX_HOURS_MS` precedent in the same file.

**Verification — live, against test node 1's real chain, but NOT through a deployed SW.** The Playwright browser profile was locked by a running Chrome instance this session was not permitted to kill, and the fallback (authenticating to MDS over HTTPS from the shell to reach the dapp's H2 DB) was blocked by the permission classifier — so "Zip & Install to Nodes" and any dapp-DB seeding were both unavailable. Instead the **real function bodies** were loaded from disk into a Node `vm` sandbox (real `core/minima.js` `isHexKey`, real `campaign.handler.js`; only `sqlQuery`/`applyStatusChange` stubbed to feed candidate rows and record decisions) with `MDS.cmd` wired to node 1's live RPC — so every coin lookup was a genuine `coins coinid:` against the real chain. Two real coins carrying escrow-shaped state (ports 1/2/3/7) were created on node 1 via RPC `send`.
1. **Coin-JSON shape confirmed empirically**: `coins coinid:` returns `state` as `[{port,type,data}]` with port 2 = `"856"` (plain integer string) and **no `prevstate` key at all** — which is what made KNOWN_ISSUES #52 below visible.
2. **13/13 scenario tests passed**: chain-not-yet-expired (no finish) / `currentBlock == expiry` (finish) / `expiry-1` (no finish, off-by-one guard); clock skew +2 h with a live coin (chain wins, no finish); +2 h with no coin (inside 24 h margin, no finish) vs +25 h (finish); coin absent on chain at +25 h (fallback finish) vs +2 h (holds); far-future campaign (+10 d) never looked up and never finished; campaign expiring in 24 h looked up but not finished; injection-shaped `ESCROW_COINID` (`"0xAA relevant:true"`) rejected before any `MDS.cmd`; unknown tip height with a live coin defers; mixed batch finishes only the right row.
3. **Live advancing-tip test** (the plan's headline test): a campaign whose `EXPIRES_AT` claimed it expired 10 days ago, pointed at a real coin with port 2 = 863, stayed active across real tips 859 → 862 and finished at tip 863 exactly — `[CAMPAIGN] expiry check: block 863 vs escrow expiry 863`.
Not covered: execution inside Rhino on an installed SW (diff mechanically scanned for arrow functions / `let` / `const` / template literals / `console.log` / trailing commas — none) and a real escrow coin produced by the actual campaign-creation flow (no campaigns existed on the test nodes; all six had zero escrow coins). Two 1-Minima test coins remain on node 1 at its own address.

**Files modified**: `public/service-workers/handlers/campaign.handler.js`, `service.js`, `MinimaAds.md`, `docs/KNOWN_ISSUES.md`.

**AGENTS.md updated**: yes — this entry; oldest entry (2026-09-04, Fix #20) moved to `docs/HISTORY.md §17`. `MinimaAds.md §11.2` gained a paragraph describing the block-based expiry rule; App. B.3's port-2 row rewritten (it said "UI reference" — port 2 is now authoritative off-chain).

**Open issues**: two found while implementing this, both documented in `docs/KNOWN_ISSUES.md` and **not fixed inline** (CLAUDE.md §8). **#51 — the escrow split tx drops state port 2**: `swBuildAndPostChannelTx` carries forward ports 1/3/4/5/6/7 but not 2, and `ESCROW_COINID` is repointed to the change coin on every channel open, so from the first channel open onwards this fix degrades to its wall-clock fallback. Three-line fix (mirror the existing `ps5`/`ps6` carry-forward) but it touches a live escrow spending tx, so it needs its own session and a real split test. **#52 — `_continueCampaignAnnounce` reads `res.response[0].prevstate`, a key Minima never emits**, so both the `PREVSTATE(5)` platform-key and `PREVSTATE(6)` foundation-key checks on inbound announces are dead code that always accepts; one-line fix (`.state`), same class as Fix #6.

---

### Session: 2026-09-04 (Fix #9 + Fix #10) — Delete dead `DO_*` FE builders; wire `ESCROW_INFO` round-trip

**Source**: `docs/IMPLEMENTATION_PLAN_2026-07-18.md` Phase 3, Fix #9 and Fix #10 — done together per the plan's own "Track B"/"Track C" parallelism note (independent files: `dapp/app.js` deletions vs `maxima.handler.js` wiring). Implemented directly by this (Sonnet) session, no delegation.

**Fix #9** (`dapp/app.js`, ~950 lines removed): deleted `handleDoChannelOpen`, `buildAndPostChannelTx`, `finalizeChannelSplit`, `buildAndPostChannelOpenTx`, `finalizeChannelOpen`, `handleDoPublisherChannelOpen`, `startPublisherChannelTxs`, `handleDoRewardVoucher`, `buildAndExportVoucherTx`, `handleDoPublisherRewardVoucher`, `handleDoSendVoucher`, `handleDoResendChannelOpen` — the FE channel-TX builders superseded by the SW doing this work instead (per the dispatcher's own pre-existing comment: "All channel TX building and Maxima resends are now handled by the SW"). Also removed: the `handleMdsComms` dispatcher's `DO_*` legacy-warning stub (types that provably can never arrive anymore); the `handleFePending` `channel_split_sign`/`channel_split_post`/`channel_open_postsign`/`channel_open`/`voucher_sign` resume branches, replaced with a single `console.warn('[PENDING] legacy pending action ignored: ' + ctx.kind')` catch-all. Kept `runSequential` (shared with the still-live `buildAndPostStatusUpdateTx`) and `settlement`/`settlement_post`/`status_update_*` branches untouched. Verified zero remaining references to every deleted function via grep before finishing (`0 files reference it` for all twelve).

**Fix #10** (`public/service-workers/handlers/maxima.handler.js`): added the missing `onMaxima` dispatcher case for inbound `ESCROW_INFO_RESPONSE` — `signalFE("ESCROW_INFO_RESPONSE", payload)` — relaying the creator's response to the FE's pre-existing (but previously unreachable) `_handleEscrowInfoResponse` handler. Narrowed the counterparty auth gate in `handleEscrowInfoRequest`: the `CHANNEL_STATE` membership query now also requires `UPPER(STATUS) = 'OPEN'`, so a settled/stale counterparty loses read access to live financials.

**Bonus fix, found while verifying Fix #10 live** (same file): `_doEscrowInfoResponse`'s two `sendMaxima(null, fromRoute, ...)` calls had the arguments backwards — `fromRoute` (`msg.data.from`, a bare public key) was passed in `sendMaxima`'s `mxAddress` slot instead of its `publicKey` slot. This silently broke every escrow-info response ever sent (routed via `to:<bare PK>` instead of `publickey:<PK>`), which is exactly why nothing had caught it before — the FE relay this session just added was the first thing that would have surfaced a live response arriving at all. Fixed both call sites to `sendMaxima(fromRoute, null, ...)`.

**Verification — live, two real nodes** (Node 1 = creator, Node 3 = requester), after redeploying via "Zip & Install to Nodes" (6 nodes, all Success). `browser_evaluate` hung twice for the full 30-minute tool timeout when constructing/sending the Maxima payload (consistent with this session's established pattern for Maxima-send calls specifically — DB-only `sqlQuery` calls via `browser_evaluate` kept working fine throughout) — switched to MinimaNodeManager's per-node terminal textbox for the actual `maxima action:send` calls, which worked immediately both times. Seeded a real `CAMPAIGNS` row on Node 1 (`BUDGET_TOTAL=20, BUDGET_REMAINING=15, MAX_PUBLISHER_BUDGET=2, PUBLISHER_BUDGET_SPENT=0.5`) plus a `CHANNEL_STATE` row with `OPENER_MX_PK` = Node 3's real Maxima PK, `STATUS='open'`; seeded a stale stub row (`BUDGET_REMAINING=999`) on Node 3 to observe the update.
1. Node 3 → Node 1 `ESCROW_INFO_REQUEST` (real Maxima, `maxcontacts action:add` needed first — publickey casing had to match the contact list's stored lowercase `0x` prefix exactly, `UPPER()` in SQL doesn't apply to Minima's own RPC contact lookup): Node 1 log `[MAXIMA] ESCROW_INFO_RESPONSE sent ok=true campaign=fix10-test-1`; Node 3's `CAMPAIGNS` row updated to `BUDGET_TOTAL=20.000000, BUDGET_REMAINING=15.000000, STATUS=ACTIVE` — full round-trip confirmed, and confirms the `sendMaxima` argument-order bonus fix was load-bearing (this would have silently failed pre-fix).
2. Flipped Node 1's `CHANNEL_STATE.STATUS` to `'settled'`, changed `BUDGET_REMAINING` to `10`, resent the identical request from Node 3: Node 3's `CAMPAIGNS` row stayed at `15.000000` (never updated to `10`) — narrowed auth gate correctly withheld the response from a no-longer-open counterparty.
All test rows deleted on both nodes afterward, confirmed `COUNT(*) = 0`.

**Files modified**: `dapp/app.js`, `public/service-workers/handlers/maxima.handler.js`, `MinimaAds.md`.

**AGENTS.md updated**: yes — this entry; oldest entry (2026-09-04, Fix #7) moved to `docs/HISTORY.md §17`. `MinimaAds.md §8.15` signal table: removed the six now-dead `DO_*` rows, added `ESCROW_INFO_RESPONSE`. New `MinimaAds.md §8.19`/`§8.20` document `ESCROW_INFO_REQUEST`/`ESCROW_INFO_RESPONSE` as full Maxima message types (previously undocumented) — includes the auth-gate rule and the `sendMaxima` argument-order gotcha.

**Open issues**: none new. Remaining Phase 3 item: Fix #8 (block-based expiry) — the highest-risk item in Phase 3, needs dedicated planning/clock-skew testing before attempting; not picked up this session.

---

### Session: 2026-09-04 (Fix #14) — `PUBLISHER_MX` missing from FE `FRAMES` schema

**Source**: `docs/IMPLEMENTATION_PLAN_2026-07-18.md` Phase 3, Fix #14 — natural follow-up to this session's Fix #20, which found and fixed the same category of FE/SW schema drift on `CHANNEL_STATE`. Implemented directly by this (Sonnet) session, no delegation.

**Fix** (`dapp/app.js` `initFEFrames`): added `PUBLISHER_MX VARCHAR(512) DEFAULT ''` to the FE `CREATE TABLE IF NOT EXISTS FRAMES (...)`, copied verbatim from the SW's already-correct definition (`db-init.js` `sql_frames`), plus the matching `ALTER TABLE FRAMES ADD COLUMN IF NOT EXISTS PUBLISHER_MX VARCHAR(512) DEFAULT ''` migration for already-installed FE tables (mirrors `db-init.js:158`). This was a real, exploitable bug, not just a latent one: `dapp/views/frames.js:246` directly runs `SELECT PUBLISHER_KEY, PUBLISHER_MX FROM FRAMES` against the FE's own local table — with the column missing, that query would throw a "column not found" SQL error. Diffed both `FRAMES` definitions column-for-column per the plan's step 3 — after this fix they match exactly, no further drift found.

**Verification — live**, after redeploying via "Zip & Install to Nodes" (6 nodes, all Success). On Node 1's MinimaAds tab (`browser_evaluate` worked normally): inserted a `FRAMES` row with a `PUBLISHER_MX` value via the FE's own `sqlQuery`, read it back — round-tripped correctly, no error. Confirmed against an **already-initialized** table (1 pre-existing frame, the built-in one from boot), not just a fresh CREATE, proving the `ADD COLUMN IF NOT EXISTS` migration path works on existing installs too. Test row deleted afterward.

**Files modified**: `dapp/app.js`.

**AGENTS.md updated**: yes — this entry; oldest entry (2026-09-04, Fix #6) moved to `docs/HISTORY.md §17`.

**Open issues**: none new. Remaining Phase 3 items: Fix #8 (block-based expiry — highest-risk item, needs dedicated planning/clock-skew testing), Fix #9 (delete ~700 lines of dead `DO_*` FE builders), Fix #10 (wire `ESCROW_INFO` round-trip).

---

> Previous handoff notes (AUD-1, patches 15–25, Security Audit 2, and all earlier) are archived in `docs/HISTORY.md §17`.

