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

### Session: 2026-09-01 (AUD-1) — Security: authenticate inbound channel Maxima in the SDK (FE mirror of a423873)

**Source**: `docs/KNOWN_ISSUES.md §3.5 AUD-1`, the follow-up left open by commit `a423873` (audit Fix #1/#2/#11, SW side only).

**Problem**: `sdk/index.js` duplicates the SW's inbound channel write path in the host MiniDapp FE. `handleMdsEvent` decoded `MAXIMA` and called `_handleChannelOpenPayload` / `_handleRewardVoucherPayload` with the payload only — `event.data.from` was discarded. On an SDK-hosted node any Maxima peer knowing a `(campaign_id, viewer_key)` pair could therefore still: overwrite `LATEST_TX_HEX` with a crafted `REWARD_VOUCHER` (destroying the only creator-signed settlement voucher), push a *lower* `cumulative`, replay a valid voucher to re-credit `FRAMES.EARNINGS` / `REWARD_EVENTS` via the publisher branch of `_onVoucherReceivedCore`, or MERGE over a healthy open channel with a crafted `CHANNEL_OPEN`.

**Fix** (all in `sdk/index.js`, FE syntax — `var`, `function()`, `console.log`/`console.warn`; the SW's Rhino constraints do not apply here):
- New `_assertCampaignCreatorSender(campaignId, senderPk, label, cb)` — direct mirror of the SW guard. Accepts `CAMPAIGNS.CREATOR_ADDRESS` (via `getCampaign`) or the pk parsed out of the on-chain permanent route cached in `CREATOR_MX_<campaignId>` (`parseMaximaRoute`; returns null for plain `Mx…` contact strings, which just falls through). Uppercases BOTH sides. Fails open only when the message has no sender or no creator identity is known locally.
- `_handleChannelOpenPayload(payload, senderPk)` gates on that guard; original body extracted to `_doHandleChannelOpenPayload(payload)`.
- `_handleRewardVoucherPayload(payload, senderPk)` gates on the guard, then reads the stored cumulative (`_storedCumulative` → `getChannelState`) and rejects `cumulative < stored` **before** `updateChannelVoucher` touches `LATEST_TX_HEX`. Equality allowed (VOUCHER_SYNC replays).
- Dedup: `_isDuplicateEvent(payload.event_id)` is evaluated **before** the write path, because `_onVoucherReceivedCore` → `createRewardEvent` MERGEs into `DEDUP_LOG` (after which every id looks duplicate). On a duplicate the voucher is still stored but the reward is not re-credited.
- `_onVoucherReceivedCore` now also receives `viewer_key`, `event_id` and `reward_type` from this path, so `createRewardEvent` uses the deterministic voucher event id (second dedup layer) instead of a fresh random one.
- `handleMdsEvent` forwards `event.data.from` to both handlers.

Public API unchanged (`MinimaAds.{init,getAd,render,trackView,trackClick,handleMdsEvent,…}`) — only private handler arities changed.

**Files modified**: `sdk/index.js`

**AGENTS.md updated**: yes — §6 updated, patch 24 moved to `docs/HISTORY.md §17`. `MinimaAds.md §13.2` gained a "Sender authentication (SDK path)" note. `docs/KNOWN_ISSUES.md §3.5` AUD-1 marked fixed; new AUD-2 logged (out-of-scope pre-existing bug: SDK's direct MAXIMA path never creates the viewer `REWARD_EVENTS` row because `amount` is computed after the cumulative write).

**Verification** (needs a host MiniDapp embedding `sdk/index.js` with `mdsAlreadyInitialized:true`, node A = creator, node B = SDK host, node C = attacker):
1. **Happy path unaffected**: on B watch an ad through the SDK slot. Browser console shows no `rejected:` line; `CHANNEL_STATE.LATEST_TX_HEX` becomes non-empty and `CUMULATIVE_EARNED` rises.
2. **Spoofed voucher rejected**: from C send `maxima action:send publickey:<B_pk> application:minima-ads poll:false data:0x<hex of {"type":"REWARD_VOUCHER","campaign_id":"<id>","viewer_key":"<B_pk>","event_id":"x","cumulative":0,"tx_hex":"0xDEAD"}>`. B's console must show `[SDK] REWARD_VOUCHER rejected: sender is not the campaign creator`; `LATEST_TX_HEX` unchanged.
3. **Spoofed CHANNEL_OPEN rejected**: same from C with `type:"CHANNEL_OPEN"` + `channel_coinid` → `[SDK] CHANNEL_OPEN rejected: …`; `CHANNEL_STATE` row untouched.
4. **Non-monotonic rejected**: have A replay an older valid voucher (lower `cumulative`) → `[SDK] REWARD_VOUCHER rejected: non-monotonic cumulative (x < y)`; `LATEST_TX_HEX` unchanged.
5. **Replay blocked**: have A re-send the same valid voucher (same `event_id`) → `[SDK] REWARD_VOUCHER duplicate event, voucher stored, reward not re-credited`; `FRAMES.EARNINGS` / `REWARD_EVENTS` unchanged on the second delivery.
6. **Fail-open preserved**: on a campaign with no local `CAMPAIGNS` row and no `CREATOR_MX_<id>`, a `CHANNEL_OPEN` still logs `creator key unknown locally — accepting (fail-open)` and proceeds.
7. `node --check sdk/index.js` clean; no console errors in the host dapp.

**Open issues**: AUD-2 (see `docs/KNOWN_ISSUES.md §3.5`) — pre-existing, discovered while tracing this path, not fixed here.

---

### Session: 2026-07-18 (audit fixes #1 + #2 + #11) — Security: authenticate inbound channel Maxima handlers

**Source**: `docs/AUDIT_2026-07-18_FABLE.md` (CRITICAL + HIGH findings) and `docs/IMPLEMENTATION_PLAN_2026-07-18.md` (Phase 1, Fix #1 / #2 / #11).

**Problem**: N2-4 hardened `handleRewardRequest` with an `OPENER_MX_PK` sender binding but left its three mirror handlers unauthenticated — the dispatcher did not even pass `msg.data.from` to them. Any Maxima peer knowing a `(campaign_id, viewer_key)` pair could:
1. Send a crafted `REWARD_VOUCHER` → `updateChannelVoucher` overwrote `LATEST_TX_HEX`, destroying the viewer's only creator-signed settlement voucher (real economic loss). No monotonicity check existed, so a *lower* `cumulative` was accepted.
2. Replay a valid `REWARD_VOUCHER` → the viewer branch bumped `USER_PROFILE.TOTAL_EARNED` unconditionally (`+ delta`) with no `isDuplicate` guard, inflating the displayed balance.
3. Send a crafted `CHANNEL_OPEN` → MERGE overwrote a healthy open channel.
4. Send `VOUCHER_SYNC_REQUEST` → free DoS amplification (forces tx lookups + Maxima sends on the creator).

**Fix**:
- `maxima.handler.js`: dispatcher now passes `msg.data.from || ''` to `handleChannelOpen`, `handleRewardVoucher` and `handleVoucherSyncRequest` (matching the existing call sites for `CHANNEL_OPEN_REQUEST` / `REWARD_REQUEST`).
- `channel.handler.js`: new `_assertCampaignCreatorSender(campaignId, senderPk, label, cb)` — accepts only the campaign creator's Maxima PK (`CAMPAIGNS.CREATOR_ADDRESS`, or the pk embedded in the on-chain permanent route cached in `CREATOR_MX_<campaignId>`). Applied to `handleChannelOpen` (body extracted to `_doHandleChannelOpen`) and `handleRewardVoucher`. Fails open only when no creator identity is known locally or the message carries no sender — same policy as the N2-4 guard.
- `channel.handler.js` `_continueRewardVoucher`: new `senderPk` param; rejects non-monotonic vouchers (`cumulative < oldCumulative`) **before** `updateChannelVoucher` touches `LATEST_TX_HEX`. Equality is still accepted so `VOUCHER_SYNC_REQUEST` recovery works. `handleRewardVoucher` now loads the stored cumulative for the publisher role too, so the guard covers publisher channels.
- `channel.handler.js` `_continueRewardVoucher`: `isDuplicate(eventId)` is now evaluated **before** the `DEDUP_LOG` MERGE (after the MERGE every id looks duplicate); the viewer branch returns early on a duplicate without touching `REWARD_EVENTS` / `USER_PROFILE`.
- `channel.handler.js` `handleVoucherSyncRequest`: rejects when `senderPk != channel.OPENER_MX_PK` (fail-open on empty).

All public key comparisons uppercase both sides. Rhino-safe throughout (`var`, `function()`, string concat, `MDS.log`, no trailing commas).

**Files modified**: `public/service-workers/handlers/maxima.handler.js`, `public/service-workers/handlers/channel.handler.js`

**AGENTS.md updated**: yes — §6 updated, patch 23 moved to `docs/HISTORY.md §17`. `MinimaAds.md` §8.9/§8.11/§8.12 gained a "Sender authentication" note. `docs/KNOWN_ISSUES.md` gained new §3.5 with the SDK-path gap (AUD-1).

**Verification** (needs a two-node setup — node A = creator, node B = viewer, plus node C as the attacker):
1. **Happy path unaffected**: on B open `#viewer`, watch an ad. SW log on B must show `[CHANNEL] REWARD_VOUCHER: voucher stored`, `CHANNEL_STATE.LATEST_TX_HEX` non-empty, `USER_PROFILE.TOTAL_EARNED` increased once. `#earnings` settles normally.
2. **Spoofed voucher rejected**: from node C run `maxima action:send publickey:<B_pk> application:minima-ads poll:false data:0x<hex of {"type":"REWARD_VOUCHER","campaign_id":"<id>","viewer_key":"<B_pk>","event_id":"x","cumulative":0,"tx_hex":"0xDEAD"}>`. B's SW log must show `REWARD_VOUCHER rejected: sender is not the campaign creator` and `LATEST_TX_HEX` must be unchanged.
3. **Replay blocked**: have A re-send the same valid voucher (same `event_id`) twice. Second delivery logs `REWARD_VOUCHER duplicate event, skipping profile update` and `TOTAL_EARNED` increments exactly once.
4. **Non-monotonic blocked**: replay a valid earlier voucher with a lower `cumulative` → `REWARD_VOUCHER rejected: non-monotonic cumulative`, `LATEST_TX_HEX` unchanged.
5. **Sync auth**: on B clear `LATEST_TX_HEX` and restart → `VOUCHER_SYNC_REQUEST` still recovers the voucher (B's pk == `OPENER_MX_PK` on A). From C send the same request for B's channel → A logs `VOUCHER_SYNC_REQUEST rejected: senderPk != OPENER_MX_PK` and sends nothing.
6. No `console.log` in SW output; no Rhino syntax errors on MiniDapp install.

**Open issues**: `sdk/index.js` `_handleChannelOpenPayload` / `_handleRewardVoucherPayload` duplicate this write path in the FE with no sender or monotonicity check — see `docs/KNOWN_ISSUES.md §3.5 AUD-1` (out of scope: SDK is an external publisher contract).

---

### Session: 2026-06-25 (patch 25) — Fix: Campaign pause/resume — liveness cache invalidation + legacy escrow handling

**Problem**: Two interconnected bugs when pausing and resuming campaigns:
1. **Paused campaigns remain visible in viewer UI** — when a campaign was paused via fast-path Maxima CAMPAIGN_PAUSE broadcast, the SDK received the message, updated the DB, but failed to invalidate its internal `_livenessCache`. The SDK continued to serve the paused campaign to the viewer, making it appear in the campaign list even though the DB status was 'paused'.
2. **Resume fails with "On-chain propagation failed" error** — when the creator tried to resume a campaign, `buildAndPostStatusUpdateTx` required both `ESCROW_COINID` and `ESCROW_WALLET_PK` to be present. Legacy campaigns (created before escrow tracking) or those that lost these fields would fail with a hard error instead of gracefully skipping on-chain propagation.

**Root cause**:
- **SDK cache**: `handleMdsEvent` in `sdk/index.js` (lines 1139–1142) handled `CAMPAIGN_PAUSE` and `CAMPAIGN_FINISH` by calling `setCampaignStatus()` but never called `_onCampaignUpdatedCore()` to invalidate the liveness cache. This fast-path optimization avoided an extra DB round-trip but broke the SDK's filtering.
- **Legacy escrow**: `buildAndPostStatusUpdateTx` in `dapp/app.js` (line 1463) returned `{ ok: false, error: '...' }` for campaigns without ESCROW data, treating it as a fatal error instead of a graceful skip (which is already handled downstream by `mycampaigns.js` at line 1413).

**Fix**:
1. **sdk/index.js** (lines 1140, 1143): Added `_onCampaignUpdatedCore()` calls after `setCampaignStatus()` for both CAMPAIGN_PAUSE and CAMPAIGN_FINISH. This immediately invalidates the liveness cache so the next `getAd()` call stops serving the paused campaign.
2. **dapp/app.js** (line 1463): Changed error response to graceful skip: return `{ ok: true, skipped: true }` instead of `{ ok: false, error: '...' }`. Legacy campaigns now skip on-chain propagation without alerting the user.

**Files modified**: `sdk/index.js`, `dapp/app.js`

**AGENTS.md updated**: yes — §6 updated, patch 24 moved to `docs/HISTORY.md §17`.

**Verification**:
1. **Pause visibility fix**: Create an active campaign. Open viewer in one browser tab. In another tab (creator), pause the campaign. In the viewer tab, the paused campaign should disappear from the list immediately (no refresh needed).
2. **Resume error fix**: Create a campaign. Pause it. Resume it. No "On-chain propagation failed" error should appear (may see "skipped" log on console if legacy escrow, which is OK).
3. **No console errors**: Open browser console; no JavaScript errors should appear during pause/resume actions.

---

> Previous handoff notes (patches 15–24, Security Audit 2, and all earlier) are archived in `docs/HISTORY.md §17`.

