# MinimaAds History

Extracted from AGENTS.md during documentation compaction on 2026-05-18. MinimaAds.md remains the highest-authority specification.

## 16) MinimaAds.md Document History

> Track structural changes to the primary spec document here.

| Date | Agent | Changes |
|---|---|---|
| 2026-04-16 | Antigravity | **Bloc A structural cleanup**: removed duplicate `# Índex` header; removed 10 duplicate section h1 titles (sections 1–8, 10, 11); fixed section 12 duplicate title; removed colloquial AI-chat text (lines 1606–1612); added section 12 to index; removed stray empty `## ` from index; renumbered `12.X` → `12.6` for frontend architecture subsection (12.6.1–12.6.9). Total lines: 1792 → 1760. |
| 2026-04-16 | Antigravity | **Format conversion**: converted entire document from Google Docs markdown style (`# **N\. Name**`, `## **N.N Name**`) to AGENTS.md style (`## N) Name`, `### N.N Name`). Added document title `# MinimaAds — Especificació del Sistema`. Converted index to compact list. Removed excessive `---` separators between subsections. Total lines: 1760 → 1449. |
| 2026-04-16 | Antigravity | **Bloc B content**: completed section 2.3 (formal object definitions: Campaign, Ad, RewardEvent, User with typed attribute tables); created section 9 (Risks & Mitigations: 6 risks with impact+mitigation+summary table); completed section 12.2 (H2 SQL schema: CAMPAIGNS, ADS, REWARD_EVENTS, USER_PROFILE); added section 12.4 (SW responsibilities and handler table). Total lines: 1449 → 1700. |
| 2026-04-16 | Antigravity | **Bloc C design decisions**: added section 3.6 (multi-role nodes: same node can be Viewer+Creator+Publisher; creator cannot earn rewards from own campaigns); concretized section 7.10 (anti-abuse limits with exact MVP values: 1 view/day per campaign, 1 click/day, 30s cooldown, 3s min view, LIMITS constant pattern); added section 10.12 (Maxima campaign distribution protocol: push broadcast model, CAMPAIGN_ANNOUNCE + REWARD_REQUEST message schemas, new-node discovery via periodic re-emit). Total lines: 1700 → 1815. |
| 2026-04-16 | Antigravity | **Consistency fixes**: 12.1 — removed React ambiguity, confirmed Vanilla JavaScript (ES Modules) as sole frontend choice; 12.5 — removed confused "cooldown" terminology, replaced with reference to 7.10 constants (LIMITS pattern) and correct distinction between daily limit vs cooldown. |
| 2026-04-16 | Antigravity | **Full rewrite**: complete refactor of MinimaAds.md from Catalan planning document (1819 lines) to English technical implementation spec (777 lines). New structure: 13 sections + appendix. Added: Core API signatures (7 modules), View/Click/Creation flows (step-by-step), Ad selection algorithm (code), Attack Vectors section (farming, malicious publisher, replay, race condition), Trust Model (client vs on-chain), Rhino constraint table, SDK API reference, folder structure. Eliminated: all redundancy between sections 5/6/8/11/12. All decisions are explicit — no open items in main spec. |
| 2026-04-17 | Antigravity | **Agent governance**: added sections 0.5 (Source of Truth — document hierarchy with priority rules), 0.6 (Development Workflow — 5-step mandatory process), 0.7 (Contract Enforcement — stable Core API reference), 0.8 (Forbidden Actions — 14 explicit prohibitions), 0.9 (Role of Agents — implementer vs architect boundary). Completed all [TO BE FILLED IN] project sections: 6 (Project Intent), 7 (Runtime Topology with file table), 8 (DB Schema with full column detail), 9 (Protocol Matrix with all 4 message types), 10 (SW→FE Signal Contract with 3 signals), 11 (Source of Truth Rules — runtime state ownership table). Updated §15 Maintenance Rules to cross-reference MinimaAds.md in parallel with AGENTS.md updates. |
| 2026-04-17 | Antigravity | **CLAUDE.md created**: new file at project root. 10-section operational guide for Claude agents. Includes: document priority table, 4-step task workflow with layer mapping, stable Core API signature reference, forbidden actions (architecture/Maxima/data model/process), Minima runtime constraints quick-reference (Rhino, H2, MDS API, Maxima encoding), multi-agent safety rules, output standards, and mandatory handoff note format. Derived entirely from MinimaAds.md and AGENTS.md — no new decisions introduced. |
| 2026-04-22 | Claude (T9) | **§13 SDK reference aligned to TASKS.md T9 signatures** — all 5 functions now callback-based with explicit `userAddress`/`interests` params (was Promise-based in §13.2). Resolves conflict between TASKS.md T9 and MinimaAds.md §13.2 flagged during T9 implementation. Consistent with §7.5 "all functions are callback-based". No data-model or protocol changes. |
| 2026-04-24 | Antigravity | **Visual Assets**: Implemented DApp icon for `dapp.conf` (cropped 1:1, transparent corners). Removed logo and favicon from `index.html` UI as per user request to simplify and avoid pathing issues. |
| 2026-05-01 | Opus (architect) | **Publisher Frame system spec**: added Frame actor (§2.1) and Frame entity. Added CAMPAIGNS columns PUBLISHER_REWARD_VIEW, MAX_PUBLISHER_BUDGET, PUBLISHER_BUDGET_SPENT. Added FRAMES table. Added CHANNEL_STATE.ROLE and FRAME_ID columns; PK now `(CAMPAIGN_ID, VIEWER_KEY, ROLE)`. Added LIMITS.MIN_PUBLISHER_REWARD_VIEW=0.001. Added §4.5 Publisher Reward Economics and §4.6 PLATFORM_KEY Security Model (decentralized fee enforcement via KissVM PREVSTATE(5)). Extended escrow KissVM (Appendix B.2/B.3) with PLATFORM_KEY at PREVSTATE(5) and conditional fee branch (STATE(11)). Added §6.9 Frame Creation Flow. Added core/frames.js (§7.7). Updated §7.6 channels.js signatures with role param. Updated SDK init() to accept frameId (§13). Added 6 new SW↔FE signals (FRAME_READY, FRAME_CREATED, PUBLISHER_REWARD_CONFIRMED, DO_PUBLISHER_CHANNEL_OPEN, DO_PUBLISHER_REWARD_VOUCHER). Extended CAMPAIGN_ANNOUNCE, CHANNEL_OPEN_REQUEST/OPEN, REWARD_REQUEST/VOUCHER with optional `role` and `frame_id` fields (no new Maxima message types). Added AGENTS.md §12 fragility #31–#35. Added T-PUB1–T-PUB8 task block to TASKS.md. |
| 2026-05-02 | Sonnet (T-PUB3) | **PLATFORM_KEY (T-PUB3)**: created `config.js` (root) with `PLATFORM_KEY=null` and `APP_NAME`. Added `MDS.load("config.js")` as first load in `service.js`. Added `<script src="config.js">` as first script in `public/index.html`. Extended `handleCampaignAnnounce` with PLATFORM_KEY validation (payload field check + on-chain PREVSTATE(5) check via `coins coinid:X relevant:false`); extracted `persistCampaign()` helper. AGENTS.md §12 fragility #31 updated with implementation status. |
| 2026-05-02 | Sonnet (T-PUB5) | **SDK publisher frame flow (T-PUB5)**: added `_activeFrameId` module var. Added `_resolveFrame()`: validates explicit `frameId`/`publisher_id` against FRAMES, or resolves builtin via `ensureBuiltinFrame(pk, walletAddr)`. `init()` now calls `_resolveFrame` inside the `inited` handler before invoking `cb`. `_trackEvent` sets `publisher_id=_activeFrameId` on all RewardEvents and fires `_publisherChannelFlow` (fire-and-forget) when `PUBLISHER_REWARD_VIEW > 0 && type='view' && _activeFrameId`. Added `_getPublisherChannel` (SELECT with `ROLE='publisher'`), `_openNewPublisherChannel` (keys:new + INSERT CHANNEL_STATE + CHANNEL_OPEN_REQUEST with role/frame_id), `_sendPublisherRewardRequest` (REWARD_REQUEST with role/frame_id). `_onVoucherReceivedCore` branches on `role='publisher'`: reads frame's PUBLISHER_KEY, calls `createRewardEvent(type:'publisher_view')`, `incrementFrameEarnings`, signals `PUBLISHER_REWARD_CONFIRMED`. |
| 2026-05-02 | Sonnet (T-PUB2) | **Core frames.js (T-PUB2)**: created `core/frames.js` with 6 functions: `listFrames`, `getFrame`, `saveFrame` (SELECT+INSERT/UPDATE to preserve CREATED_AT and TOTAL_EARNED), `ensureBuiltinFrame` (idempotent, frame_id = 'builtin:<PK>'), `incrementFrameEarnings`, `getFrameEarnings` (COUNT from REWARD_EVENTS WHERE TYPE='publisher_view'). Added `MDS.load("core/frames.js")` to `service.js` and `<script src="core/frames.js">` to `public/index.html`. |
| 2026-05-02 | Sonnet (T-PUB1) | **DB schema (T-PUB1)**: added PUBLISHER_REWARD_VIEW, MAX_PUBLISHER_BUDGET, PUBLISHER_BUDGET_SPENT columns to CAMPAIGNS CREATE TABLE in SW db-init.js. Added FRAMES CREATE TABLE in SW db-init.js (7 columns, FRAME_ID PK). Updated CHANNEL_STATE CREATE TABLE: added ROLE (VARCHAR(16) NOT NULL DEFAULT 'viewer') and FRAME_ID (VARCHAR(256) DEFAULT '') columns; changed PK from (CAMPAIGN_ID, VIEWER_KEY) to (CAMPAIGN_ID, VIEWER_KEY, ROLE). Added initFEFrames() and updated initFEChannelState() in dapp/app.js to mirror SW schema. AGENTS.md §8 was already updated by architect. |
| 2026-05-03 | Sonnet (T-PUB7) | **Frames UI + builtin frame init (T-PUB7)**: added `initBuiltinFrame(maximaPk, walletAddr)` to `core/frames.js` — fire-and-forget wrapper for `ensureBuiltinFrame` + `signalFE('FRAME_READY')`, defined within frames.js to avoid Rhino cross-file closure bug (AGENTS.md §14 bug #3). Updated `service.js` `onInited`: after `maxima action:info` resolves, calls `MDS.cmd('getaddress')` then `initBuiltinFrame(MY_MAXIMA_PK, walletAddr)` (no closure passed from service.js). Added `#frames` route to `currentRoute()`, `doRender()`, and `handleMdsComms()` in `dapp/app.js`; wired `FRAME_READY`/`FRAME_CREATED` → re-render frames view; wired `PUBLISHER_REWARD_CONFIRMED` → `onPublisherRewardConfirmed()`. Created `dapp/views/frames.js` with `renderFrames(root)`, `_refreshFramesList()`, `_renderFramesList(rows)`, `_showSnippet(fid)`, `_showEarnings(fid)`, `_onFrameSubmit(e)`, `onPublisherRewardConfirmed(parsed)`. All DOM output sanitized with DOMPurify. Frame creation from FE calls `saveFrame()` directly; snippet shown immediately after save. Added `<a href="#frames">Frames</a>` to `public/index.html` nav; added `<script src="dapp/views/frames.js">` after earnings.js. |
| 2026-05-03 | Codex | **Campaign creation UI tabs**: reorganized `dapp/views/creator.js` form into three tabs without changing field names, submit payload, validation, calculations, or campaign publishing flow. Header now keeps `auto_balance` and `ma-campaign-summary` before tabs. Tab 1 contains ad content plus `campaign_days`; tab 2 contains viewer budget/reward/cap controls; tab 3 contains publisher reward controls. Added lightweight tab styling in `public/index.html` and an `invalid` event handler that opens the relevant tab before native browser validation focuses a hidden invalid field. Follow-ups: tab backgrounds now use Pico theme colors (`--pico-primary-background` active, `--pico-secondary-background` inactive) with white text and non-white fallbacks; duplicate section titles inside tab panels were removed because the active tab already provides the title. |
| 2026-05-02 | Sonnet (T-PUB6) | **Campaign UI: publisher reward fields (T-PUB6)**: replaced placeholder `publisher_rate` input in `dapp/views/creator.js` form with `publisher_reward_view` (step=0.001, min=0, value=0) and `max_publisher_budget` (step=0.01, min=0) inputs. Updated `FIELD_DECIMALS` (removed publisher_rate, added both new fields at 6 decimals). Removed publisher_rate clamp from `onCreatorFormInput`. Updated `updateCampaignSummary` to read new fields and display publisher reward line only when > 0. Added submit validation: if publisher_reward_view > 0 → must be >= LIMITS.MIN_PUBLISHER_REWARD_VIEW (0.001); max_publisher_budget must be > 0 and <= budget_total. Added `publisher_reward_view`, `max_publisher_budget`, `publisher_budget_spent: 0` to campaign object in `onCreatorSubmit`. Added explicit publisher fields to CAMPAIGN_ANNOUNCE payload in `saveCampaignAndBroadcast`. Updated `saveCampaign` and `updateBudget` MERGE INTO in `core/campaigns.js` to include all 3 publisher columns (PUBLISHER_REWARD_VIEW, MAX_PUBLISHER_BUDGET, PUBLISHER_BUDGET_SPENT). Added `MIN_PUBLISHER_REWARD_VIEW: 0.001` to LIMITS in both `dapp/app.js` and `service.js`. |
| 2026-05-03 | Sonnet (T-PUB8) | **Publisher channel handler (T-PUB8)**: extended `core/channels.js` — all 6 functions now accept `role` as 3rd param; `openChannel` also adds `frameId` (4th) and `walletAddr` (5th), MERGE INTO KEY uses `(CAMPAIGN_ID, VIEWER_KEY, ROLE)`; viewer branch still calls `updateBudget`, publisher branch skips it. Rewrote `channel.handler.js`: `handleChannelOpenRequest` branches on `payload.role` — publisher path validates `PUBLISHER_REWARD_VIEW > 0` and publisher budget remaining, calls `openChannel` with role/frameId/walletAddr, runs `UPDATE CAMPAIGNS SET PUBLISHER_BUDGET_SPENT += maxAmount`, signals `DO_PUBLISHER_CHANNEL_OPEN`; viewer path unchanged but passes explicit `'viewer'` role. `handleChannelOpen` reads `payload.role` and passes to `activateChannel`. `handleRewardRequest` reads role and dispatches `DO_PUBLISHER_REWARD_VOUCHER` (publisher) or `DO_REWARD_VOUCHER` (viewer); keypair key now includes role suffix. `handleRewardVoucher` calls `updateChannelVoucher` with role; publisher path includes `role:'publisher'` and `frame_id` in `VOUCHER_RECEIVED` signal. `handleVoucherSyncRequest` passes role to `getChannelState`. `checkPendingVouchers` SELECT now includes ROLE; `checkOnePendingVoucher` uses role-aware keypair key and dispatches to correct signal type. `dapp/app.js`: removed `persistPublisherChannelOpen`; `finalizeChannelOpen` publisher branch now calls `activateChannel(role='publisher')`; viewer branch passes explicit `'viewer'`; added `DO_PUBLISHER_REWARD_VOUCHER` MDSCOMMS handler; added `handleDoPublisherRewardVoucher` (reads FRAMES.PUBLISHER_WALLET for settlement output, calls `buildAndExportVoucherTx` with `role:'publisher'`); `buildAndExportVoucherTx` now reads `ctx.role`/`ctx.frameId` for `updateChannelVoucher` and REWARD_VOUCHER message; pending `voucher_sign` resume context also propagated role/frameId. `handleDoRewardVoucher` → `getChannelState(...,'viewer',...)`. `dapp/views/earnings.js`: `settleChannel` and `getChannelState` calls updated to pass `'viewer'`. `sdk/index.js`: viewer `openChannel` call updated to new 8-param signature; reconnect query now selects ROLE/FRAME_ID and includes them in CHANNEL_OPEN_REQUEST. `MinimaAds.md §7.6` updated: `openChannel` signature now includes `walletAddr`. |
| 2026-05-05 | Sonnet | **Split coin PREVSTATE(5/6) missing → Script FAIL + locked wallet balance (fixed 2026-05-05, two-step).** Step 1: fixed by adding port:5/6 to split tx state (workaround). Step 2 (definitive): restructured `ESCROW_SCRIPT_V2` in `service.js` and `dapp/views/creator.js` — `LET platformkey=PREVSTATE(5)` moved inside `IF feeflag EQ 1 THEN`, `LET maxpubbudget=PREVSTATE(6)` removed entirely. Port:5/6 removed from `buildAndPostChannelTx` stateCmds and all pending contexts; `platformKeyHex`/`maxPubBudget` propagation removed from `handleDoChannelOpen` and `startPublisherChannelTxs`. Script hash changes → `ESCROW_ADDRESS_V2` will differ after reinstall; existing campaigns at old address remain valid via legacy fallback. Secondary benefit: platform node wallet no longer shows escrow coins as locked (wallet relevance scanner no longer evaluates PREVSTATE(5) on feeflag=0 spends). See fragility #38. |
| 2026-05-05 | Sonnet | **Multiple session bugfixes**: (1) `sdk/index.js` `_myMxAddress()` returned empty string in standalone publisher dapp context (no `MY_MX_ADDRESS` global) — fixed by adding private `_myMx` var populated via `maxima action:info` in `init()`. (2) `campaign.handler.js` `handleRequestCampaignData` was missing `platform_key` in `CAMPAIGN_DATA_RESPONSE` — viewer nodes with PLATFORM_KEY set were silently dropping every discovered campaign. Fixed by adding `platform_key` field to response payload. (3) `dapp/app.js` `buildAndPostChannelTx` split tx was missing `port:4` (creatorMxHex) on split outputs — change coins at ESCROW_ADDRESS_V2 had no STATE(4) so other nodes skipped them in `processEscrowCoin`. Fixed by adding `port:4 = creatorMxHex` to stateCmds. |
| 2026-05-09 | Codex | **External host SDK integration**: `sdk/index.js` now supports `mdsAlreadyInitialized` / `externalMdsInit` / `skipMdsInit` config for MiniDapps that already own `MDS.init`, and exposes `MinimaAds.handleMdsEvent(msg)` so hosts can forward `MAXIMA` and `MDSCOMMS` events. The SDK now normalizes uppercase campaign/ad rows before rendering. Updated MinimaAds.md §13 and `dapp/views/frames.js` to generate a plug-and-play publisher snippet: slot element, ordered SDK script loader, `MinimaAdsPublisherInit`, `MinimaAdsPublisherRefresh`, and `MinimaAdsPublisherHandleMdsEvent` bridge for host-owned `MDS.init`. |
| 2026-05-13 | Sonnet | **Publisher settlement end-to-end (commit be0f377)**: (1) Publisher reward routing: replaced `frame_id`-based publisher identification with explicit `publisher_key` propagated from snippet → `MA_TRACK_VIEW` → `PENDING_REWARD` → `REWARD_REQUEST`. `_maybeGeneratePublisherVoucher` fast path reads `publisherKey` directly from payload. (2) Cross-node earnings contamination fixed: `earnings.js` `_refreshChannelRewards` and `_refreshSettlementHistory` filter by `VIEWER_KEY = MY_ADDRESS`. (3) Viewer Reward History fix: `_getMxContact` in snippet now returns `res.response.publickey` instead of `res.response.contact`. (4) Settlement pending persistence: `_postSettleTx` checks `r3.pending`; uses `savePendingChannelOp(kind:'settlement_post')`; `handleFePending` in `app.js` adds `settlement_post` branch that calls `settleChannel` after TX confirmation. See fragility #42, Closed/Fixed PUB-3. |
| 2026-05-18 | Sonnet | **Second publisher reward: `txninput scriptmmr:true` + premature cleanup (commit → Closed/Fixed PUB-4)**: fixed two chained bugs in `channel.handler.js`. (1) `afterSend` callback threading: `swBuildAndExportVoucherTx` and `_swDispatchVoucher` now accept an `afterSend` param; DEDUP_LOG write and DEFERRED_PUB_REWARDS delete execute only inside `afterSend` (after `sendMaxima` returns ok). (2) Stable dedup key: changed from `'pub-replay-'+frameId+'-'+Date.now()` (unique per call) to `'pub-replay-'+stableRowIds.join('-')` (row-ID based, stable across retries). (3) NEWBLOCK retry: added `DEFERRED_PUB_REWARDS JOIN CHANNEL_STATE` query at the start of `checkPendingChannelOpens`; calls `_replayDeferredPublisherRewards` for every open publisher channel with pending deferred rows — guarantees the MMR-indexed retry fires within one NEWBLOCK (~4 s). (4) Earlier fix same session: moved `_replayDeferredPublisherRewards` call inside `sendMaxima` callback in `swBuildAndPostChannelTx` so CHANNEL_OPEN is delivered before replay starts. Added fragility #43 and #44. Verified end-to-end: publisher balance shows 2×10 MINIMA after two view+settlement cycles. |
| 2026-05-18 | Codex | **Frames earnings display polish**: `dapp/views/frames.js` now hides the deterministic `builtin:<MAXIMA_PK>` identifier in the Built-in viewer earnings panel title, rendering `Earnings — Built-in viewer` instead. Custom frame earnings panels still show the full frame ID because that identifier is needed when managing external publisher integrations. |
| 2026-05-18 | Codex | **AGENTS.md compaction**: reduced `AGENTS.md` to a short operative guide and moved long-form reference material into `docs/PLATFORM_NOTES.md`, `docs/PROJECT_NOTES.md`, `docs/KNOWN_ISSUES.md`, `docs/HISTORY.md`, and `docs/VERIFICATION.md`. The temporary full pre-compaction archive was removed after the split was verified. |
| 2026-05-18 | Codex | **Documentation root cleanup**: moved the implementation task list from root `TASKS.md` to `docs/TASKS.md`; updated operational references in `docs/PromptBase.md`, `PROJECT_INDEX.md`, and `AGENTS.md`. |
| 2026-05-18 | Codex | **Temporary handoff cleanup**: removed `handoff_session_2026-05-13.md`; its relevant publisher settlement notes are already represented by PUB-1/PUB-2/PUB-3 in `docs/KNOWN_ISSUES.md` and the 2026-05-13 entries in this history. |
| 2026-05-18 | Codex | **Prompt template cleanup**: moved `PromptBase.md` from repo root to `docs/PromptBase.md`; updated references in `docs/TASKS.md`, `PROJECT_INDEX.md`, and `AGENTS.md`. |
| 2026-05-13 | Sonnet + Opus | **Settlement coins available + viewer channel race condition (commit 3286b6e)**: (1) Viewer settlement address changed from `newscript "RETURN SIGNEDBY(pk)"` to `getaddress` coinbase address in `comms.handler.js` `_resolveViewerAddrAndSend` — coins now immediately `sendable`. (2) Publisher settlement address changed from `MY_ADDRESS` (Maxima PK, not spendable) to `getaddress` coinbase address in `channel.handler.js` `_doSendPublisherChannelOpenRequest`. (3) Race condition fix: `swBuildAndPostChannelTx` Tx1 failure calls `_enqueuePendingChOpenSplitRetry(ctx)` instead of silently dropping. New `_retryPendingChOpen` on NEWBLOCK re-reads current ESCROW_COINID/WALLET_PK from CAMPAIGNS and retries. Deduplicated by `campaignId|viewerKey16|role`. End-to-end verified: viewer channel activated and coin confirmed on-chain (2026-05-13). See fragility #40, #41, Closed/Fixed PUB-1, PUB-2. |
| 2026-05-19 | Sonnet | **Stale earnings summary + non-atomic TOTAL_EARNED**: fixed two related bugs causing displayed reward totals to diverge from DB values. (1) `dapp/app.js` `PUBLISHER_REWARD_CONFIRMED` handler now calls `loadEarnings()` (full reload) instead of only refreshing the history table — the "Total earned" headline stayed stale when new publisher vouchers arrived while on the earnings page. (2) `dapp/views/earnings.js` `onSettleConfirmed()` now reloads the summary section via `getUserProfile` and re-renders Total earned / Today earned — previously only the channel list and reward history updated on settlement. (3) `core/rewards.js` `createRewardEvent()`: replaced read-modify-write `MERGE INTO` for `USER_PROFILE.TOTAL_EARNED` with atomic `UPDATE ... SET TOTAL_EARNED = COALESCE(TOTAL_EARNED, 0) + amount` for existing rows; INSERT for new users. Prevents lost increments under concurrent reward events. Verified: earnings.txt (19/5/2026) shows consistent totals (Total earned = Settled channels sum = Reward history sum) for user2 (publisher, 20 MINIMA) and user3 (viewer, 2 MINIMA). Zero errors across all log files. |
| 2026-05-02 | Opus (T-PUB4) | **KissVM escrow extension (T-PUB4)**: introduced `ESCROW_SCRIPT_V2` in `dapp/views/creator.js` (PLATFORM_KEY at PREVSTATE(5), MAX_PUBLISHER_BUDGET at PREVSTATE(6), conditional fee branch via STATE(11)/STATE(12)/STATE(13) using 5-arg `VERIFYOUT`). Address registered with `trackall:false`, cached under keypair `ESCROW_ADDRESS_V2`; legacy V1 retained under `ESCROW_ADDRESS` for old campaigns. `resolveEscrowAddress()` now resolves V2. Campaign-launch state JSON extended to include ports 5, 6, 11 (and 12, 13 when feeflag=1). When `PLATFORM_KEY` is set, new helper `buildEscrowFundingTx()` builds a multi-output tx: `output[0]` fee → PLATFORM_KEY, `output[1]` budget → escrow (with state), change auto-added by `txnpost auto:true`. When `PLATFORM_KEY === null` (MVP), the legacy `send` shorthand is used (no fee output, identical to pre-T-PUB4 shape). Channel-open spend tx (`buildAndPostChannelTx` + `buildAndPostChannelOpenTx` in `dapp/app.js`) sets `port:11=0` on both the split and the open transactions. Added `handleDoPublisherChannelOpen(data)` in `dapp/app.js` and wired `DO_PUBLISHER_CHANNEL_OPEN` into the `MDSCOMMS` dispatch in `handleMdsComms`; reuses `buildAndPostChannelTx` with `ctx.role='publisher'` and `ctx.frameId`. New helper `persistPublisherChannelOpen()` writes the publisher CHANNEL_STATE row via direct SQL (3-key MERGE INTO with ROLE='publisher', FRAME_ID) and increments `CAMPAIGNS.PUBLISHER_BUDGET_SPENT` rather than `BUDGET_REMAINING`. `finalizeChannelOpen()` branches on `ctx.role`: publisher path uses `persistPublisherChannelOpen` + sends CHANNEL_OPEN with `role:'publisher'`, `frame_id`. Pending-resume contexts (`channel_split_sign`, `channel_split_post`, `channel_open_postsign`, `channel_open`) now propagate `role` and `frameId`. AGENTS.md §12 fragility #31 updated. |


---

## 17) UI and Core Session Archive

### Session: 2026-06-14 — Timing investigation + 3 NEWBLOCK perf fixes + click reward bug pending

**Task**: Investigated perceived reward/settlement slowness post-audit. Found no timing regression from audit commits — block latency was the bottleneck. Identified and implemented 3 performance improvements:

**Fixes implemented**:
1. **Shared channel coin scan per NEWBLOCK** (`service.js` + `channel.handler.js`): Added `_checkChannelCoinsOnBlock()` which does ONE `coins address:CHANNEL_SCRIPT_ADDRESS` per block and passes the coin list to both `checkPendingVouchers(coins)` and `checkOpenChannelsSettled(coins)`, eliminating K+1 redundant scans per block. Extracted `_dispatchPendingVoucher` and `_processSettledChannels` helpers.
2. **Removed redundant `getCampaign()` in `_swDispatchVoucher`** (`channel.handler.js`): Added optional 11th `campaign` param. Callers at lines 626, 629, 1491, 1593 now pass the already-loaded campaign. Added `_continueSwDispatchVoucher` helper. Falls back to DB load when campaign not supplied (e.g. `_dispatchPendingVoucher`).
3. **Skip empty legacy escrow address scans** (`service.js`): Added `_escrowHasCoins`/`_escrowScanned` flags. `scanEscrowCoins` always scans V4, skips V? and V3 once confirmed empty in this session.

**Result verified in new logs (14/06)**: View reward flow now completes in **~4 seconds** vs ~66 seconds before (coin already indexed when REWARD_REQUEST arrives — fast path active).

**Open bug**: Click reward does NOT work. Viewer clicks ad, but reward is not delivered. Needs investigation in next session. The view reward path now works correctly.

**Files modified**: `service.js`, `public/service-workers/handlers/channel.handler.js`

**AGENTS.md updated**: yes — §6 updated, oldest entry (patch 2) moved to `docs/HISTORY.md §17`.

---

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

---

### Session: 2026-06-13 (patch 2) — Fix validation & self-healing for custom key overrides

**Task**: Fix creator campaign launch failure caused by invalid `FOUNDATION_KEY_OVERRIDE` or `PLATFORM_KEY_OVERRIDE` values (e.g. Maxima route strings `MAX#...` saved instead of wallet `0x...` hex addresses), causing escrow transaction builds to fail with a `NumberFormatException`.

**Fix**:
- **Self-Healing on Boot**: Added format validation checks using `isHexKey` to key override loaders during bootstrap in `service.js` (SW) and `dapp/app.js` (FE). Any malformed or invalid custom override key detected on startup is automatically cleared from the MDS keypair storage.
- **Input Validation**: Added `isHexKey` format checks inside `dapp/views/devtools.js` when saving custom override values or using "Set Self Wallet" actions. Malformed keys are rejected immediately with a user-facing error message in the status bar.

**Files modified**: `service.js`, `dapp/app.js`, `dapp/views/devtools.js`

---

### Session: 2026-06-13 — Security audit T7/T9: server-side voucher accrual + cooldown guards (C-1)

**Task**: Implement the remaining `[Opus]` security-audit tasks (T7, T9) to close C-1 (channel over-claim). T10 (two-node test) deferred to manual testing.

**Fix** (all in `public/service-workers/handlers/channel.handler.js`):
- **T7** — `_handleRewardRequestInner`: after the existing `MAX_AMOUNT` cap and before `isDuplicate`, reload the campaign via `getCampaign` and validate the per-request accrual delta: `delta = cumulative − channel.CUMULATIVE_EARNED` must satisfy `0 < delta <= unit + ε` (ε = 0.000001), where `unit = REWARD_CLICK` when `payload.reward_type === 'click'` else `REWARD_VIEW`. Also enforce the campaign cooldown server-side: reject when `channel.LAST_VOUCHER_AT > 0 && (Date.now() − LAST_VOUCHER_AT) < cooldown` (cooldown = `campaign.COOLDOWN_MS` or `LIMITS.COOLDOWN_BETWEEN_REWARDS_MS`). **Note**: the redundant `getCampaign()` call introduced here was subsequently optimised away in patch 4 (2026-06-13) by passing the already-loaded campaign object from the outer `handleRewardRequest`.
- **T9** — `_doGeneratePublisherVoucher`: verify `pubReward <= PUBLISHER_REWARD_VIEW + ε` (publisher unit is always view-based) and enforce cooldown via `pubChannel.LAST_VOUCHER_AT`. `_replayDeferredPublisherRewardsNow`: reload the campaign and skip any deferred row whose `AMOUNT` exceeds the unit before accumulating; bail if no valid rows remain.

**T10 (open)**: requires manual two-node test — (a) normal view/click voucher settles, (b) forged `cumulative = MAX_AMOUNT` is rejected by the delta check, (c) cooldown enforced server-side.

**Files modified**: `public/service-workers/handlers/channel.handler.js`, `docs/audit_report.md`

---

### Session: 2026-06-11 — Support Dedicated Routing for Campaign Details

**Task**: Fix the DApp returning to the campaigns list when clicking the CTA/banner links inside campaign detail views. Introduce dedicated hash routing `#campaign-detail?id=<campaignId>` for detail views to guarantee state preservation and enable standard navigation history.

**Fix**:
- **Routing Infrastructure**:
  - Registered `campaign-detail` inside `MODE_VIEWS.viewer` in `dapp/app.js`.
  - Updated `currentRoute()` to parse hash parameters and match route base names (e.g. splitting at `?`).
  - Added the helper `getHashParams()` to extract query parameters from the hash dynamically in any view.
  - Set active link status inside `renderNav()` if view matches `campaigns` and current route is `campaign-detail`.
  - Added a routing fallback block inside `doRender()` for `campaign-detail` calling `renderCampaignDetail(root)`.
- **View Integration**:
  - Implemented `renderCampaignDetail(root)` in `dapp/views/viewer.js` to extract campaign ID, show loading status, query the campaign details from the H2 DB via `getCampaign(id, cb)`, and invoke the detail UI via `_openCampaign(campaign)`.
  - Updated click listeners in `dapp/views/campaigns.js` and list renderer in `dapp/views/viewer.js` to change `window.location.hash` to `'campaign-detail?id=' + campaign.ID` instead of calling `_openCampaign` directly.
  - Rewrote `_goBackToList()` in `dapp/views/viewer.js` to reset `window.location.hash` to `'campaigns'`.

**Files modified**: `dapp/app.js`, `dapp/views/viewer.js`, `dapp/views/campaigns.js`

**AGENTS.md updated**: yes — §6 updated.

---

### Session: 2026-06-11 (patch 2) — Block publisher rewards on viewer click events

**Task**: Publisher was incorrectly receiving a reward voucher every time a viewer clicked (in addition to views). Decision: publisher only earns on views, not clicks.

**Fix**:
- `channel.handler.js` line ~593: added `&& (payload.reward_type || 'view') !== 'click'` guard before calling `_maybeGeneratePublisherVoucher` in the indexed-coin path.
- `channel.handler.js` line ~1566: same guard added to the deferred-voucher replay path, using `pending.reward_type`.
- Note: the previous session's AGENTS.md entry claimed this fix was applied but the guard was never actually written to the file.

**Files modified**: `public/service-workers/handlers/channel.handler.js`

---

### Session: 2026-06-11 — Support Proper Reward Types (View/Click) for Vouchers and Logs

**Task**: Fix click rewards being logged as "view" rewards in the database, triggering incorrect publisher commission generation (publisher rewards should only occur on views, not clicks), and displaying incorrect values in the viewer status UI. Also, prevent returning to the campaigns list automatically in the DApp when clicking the campaign's CTA link/button so the user stays on the details screen.

**Fix**:
- **Service Worker Propagation**:
  - Propagated `reward_type` from `CHANNEL_OPEN` handler (`PENDING_REWARD_<campaignId>` metadata check) to `REWARD_REQUEST` payloads.
  - Modified `_handleRewardRequestInner` to skip generating publisher rewards (`_maybeGeneratePublisherVoucher`) when `role === 'viewer'` and `reward_type === 'click'`.
  - Added `reward_type` to `PENDING_VOUCHER_` queue data during indexing delays.
  - Updated `_swDispatchVoucher` and `swBuildAndExportVoucherTx` to set the correct amount (`REWARD_CLICK` instead of `REWARD_VIEW` if `reward_type === 'click'`), pass the type into the transaction context, include it in `REWARD_VOUCHER` Maxima payloads, and log `REWARD_EVENTS` with correct type.
  - Updated `handleRewardVoucher` and `_continueRewardVoucher` to parse the `reward_type` and store the matching event type in `REWARD_EVENTS` instead of hardcoding `'view'`, sending the type in the `VOUCHER_RECEIVED` FE notification signal.
- **SDK & UI Flow Integration**:
  - Threaded `rewardType` down `_channelFlow` -> `_openNewChannel` / `_accumulatePending` / `_sendRewardRequest` inside `sdk/index.js`, persisting it to pending reward caches and outgoing `REWARD_REQUEST` payloads.
  - Configured `_onVoucherReceivedCore` to read `reward_type` and record the correct type inside `createRewardEvent`.
  - Updated `onViewerVoucherReceived` in `dapp/views/viewer.js` to read the received `reward_type` and display the correct reward amount (REWARD_CLICK vs REWARD_VIEW).
  - Modified link click handler in `_wireDetailInteractions` in `dapp/views/viewer.js` to remove calls to `_goBackToList()`.

**Files modified**: `public/service-workers/handlers/channel.handler.js`, `sdk/index.js`, `dapp/views/viewer.js`

---

### Session: 2026-06-11 — Align Campaign Image Selector Button Layout

**Task**: Align the file selector button and its label/text correctly inside the campaign image upload field. Previously, due to specificity override conflicts on `input:not([type="checkbox"]):not([type="radio"])` vs `input[type="file"]`, the padding wasn't applied correctly and the native button was touching the bottom boundary of the input box and misaligned.

**Fix**:
- **CSS Hierarchy Refinement**: Excluded `[type="file"]` from the general input field styling rule to prevent specificity clashes.
- **Custom Box Styling**: Explicitly defined the layout for `input[type="file"]` using a cohesive border, border-radius, background, and custom `0.35rem 0.5rem` padding to keep the choose-file button and text perfectly centered without touching the container edges.

**Files modified**: `public/index.html`

---

### Session: 2026-06-11 — Show CTA button when rendering ads on mobile in viewer & previews

**Task**: Fix campaigns displayed in the viewer, developer/creator previews, and campaigns list details not showing the Call To Action (CTA) button on mobile (or container width < 480px) or having missing ad metadata (like images and CTA options) when opened from the system campaigns list. Parse visibility flags dynamically to prevent type coercion mismatch bugs.

**Fix**:
- **Mobile Force Full Layout**: Introduced `ad.force_full` flag in `renderer/renderAd.js`. When `force_full` is true, a responsive vertical card layout (image on top, text and button below) is rendered on narrow screens/containers instead of the image-only banner.
- **Set force_full**: Enabled `force_full: true` on the rendering parameters inside `dapp/views/viewer.js` (viewer details view), `dapp/views/creator.js` (creator live preview and review preview), and `dapp/views/mycampaigns.js` (campaign card detail preview).
- **Flag Parsing**: Parsed `show_title`, `show_body`, and `show_cta` via `parseInt(..., 10)` in `renderer/renderAd.js` and `sdk/index.js` mapping to ensure they are compared as numbers against strict `!== 0` constraints, avoiding H2 Hsql type-mismatch/coercion bugs.
- **Full Ad Query in Campaigns List**: Added all missing `ADS` table columns (`CTA_LABEL`, `CTA_URL`, `IMAGE_DATA`, visibility flags, and colors/styling options) to the campaign list query in `dapp/views/campaigns.js`. This guarantees that launching `_openCampaign` from the "Campaigns" list has identical data and fully renders the ad, showing the CTA button/image.

**Files modified**: `renderer/renderAd.js`, `sdk/index.js`, `dapp/views/viewer.js`, `dapp/views/creator.js`, `dapp/views/mycampaigns.js`, `dapp/views/campaigns.js`

**AGENTS.md updated**: yes — §6 updated.

---

### Session: 2026-06-11 (continued) — Fix deferred publisher reward recovery from false settlement

**Task**: Built-in publisher (user4) opened a publisher channel successfully but didn't receive deferred REWARD_VOUCHERs. Investigation found two issues:
1. `_isBuiltinFid` check was too broad: skipped `_maybeGeneratePublisherVoucher()` for ALL built-in frames, even when a different viewer used the publisher's frame (should only skip when viewer IS the publisher).
2. Deferred publisher rewards couldn't be replayed from falsely-settled channels: `checkPendingChannelOpens()` JOIN required `STATUS='open'`, but recovered channels had `STATUS='settled'` from prior false-positive settlement attempts.

**Fix**:
- **Builtin publisher voucher identity check** (commit `e2ca08b`): Replace `_isBuiltinFid` guard with viewer-identity check. Extract PK from `builtin:0X[PK]` and compare with viewer key — skip generation only when they match (viewer is the publisher, they self-dispatch).
- **Deferred reward recovery** (commit `3918a3e`): 
  - `checkPendingChannelOpens()` JOIN now includes `STATUS IN ('open', 'settled')` to find falsely-settled channels with pending deferred rewards.
  - `_replayDeferredPublisherRewards()` detects falsely-settled channels (coin still active on-chain but STATUS='settled') and re-activates them to 'open' before dispatching the voucher TX. `swWaitForCoin()` remains the gatekeeper for legitimately settled channels.

**Verification**: User4 (publisher) now receives 0.006 MINIMA (3 accumulated deferred rewards × 0.002) as REWARD_VOUCHER, correctly tracked in Earnings with "1 Pending settlement".

**Files modified**: `public/service-workers/handlers/channel.handler.js`

**AGENTS.md updated**: yes — §6 updated.

---

### Session: 2026-06-10 — Fix false settlement on node re-sync + remove optimistic settleChannel

**Task**: Two linked bugs around settlement:
1. `checkOpenChannelsSettled()` could prematurely settle channels when `coins address:CHANNEL_SCRIPT_ADDRESS` returned an empty array transiently (e.g. during MiniDapp reinit / node re-sync). Result: CHANNEL_STATE → 'settled', CHANNEL_HISTORY populated, but coin still active on L1. Viewer's wallet never receives the reward.
2. `_postSettleTx()` called `settleChannel()` optimistically after `txnpost` returns status:true, before L1 confirmation. If the tx fails to propagate, local DB is incorrectly marked 'settled' and the voucher disappears from the UI permanently.

**Fix**:
- `checkOpenChannelsSettled()`: before calling `settleChannel()`, verify the specific coin via `coins coinid:X relevant:true`. Only settle if the targeted query also confirms the coin is absent. Also added CUMULATIVE_EARNED to SELECT and `signalFE("SETTLE_CONFIRMED")` after successful settle, so earnings view auto-refreshes.
- `_postSettleTx()`: removed `settleChannel()` call after txnpost. Shows "Settlement posted. Awaiting L1 confirmation…" instead. The SW's `checkOpenChannelsSettled()` will call `settleChannel()` on the next NEWBLOCK once the coin is verifiably spent, then signals SETTLE_CONFIRMED to the FE.

**Files modified**: `public/service-workers/handlers/channel.handler.js`, `dapp/views/earnings.js`

---

### Session: 2026-06-10 — Fix Earnings open channels count for creator/multi-role nodes

**Task**: Open channels count showed other users' channels when creator switched to viewer/publisher mode.

**Fix**: Added `AND UPPER(VIEWER_KEY) = UPPER(MY_ADDRESS)` to all three role-filtered queries in `earnings.js`.

**Files modified**: `dapp/views/earnings.js`

---

### Session: 2026-06-10 — Settings Redirection Flow & Viewer Reward Status Message

**Task**: Fix jarring full-page reload on Maxima route registration. Fix "Processing reward..." status sticking indefinitely.

**Files modified**: `dapp/views/settings-maxima-routes.js`, `dapp/views/viewer.js`, `dapp/app.js`, `MinimaAds.mds.zip`

---

### Session: 2026-06-10 — DevTools reordering, Favicon fix, & Drawer Username styling

**Task**: Move Minima Foundation Fee config to top-level Section 2 in DevTools. Restore favicon. Make drawer username clickable.

**Files modified**: `dapp/views/devtools.js`, `public/index.html`, `dapp.conf`, `icon.png`, `MinimaAds.mds.zip`

---

### Session: 2026-06-10 — Campaigns view refinement + Escrow sync via Maxima

**Task**: Improve Campaigns view to show accurate, role-specific metrics. Query creators for live campaign escrow data (budget remaining) instead of static DB values.

**Implementation**:
- **Campaigns view (hybrid model)**: `Campaigns` & `Market budget` from local DB; `My open channels` & `My active publishers` from L1 channel coins. Creator-only sees 4 cards; Viewer/Publisher sees 2.
- **Escrow data sync** (SW + FE): SW `maxima.handler.js` added `handleEscrowInfoRequest()`; FE `campaigns.js` queries creators for budget updates; FE `app.js` handles `_handleEscrowInfoResponse()`.
- Label clarity: "Total budget" → "Market budget", added "My" prefix to channel metrics, removed (L1) suffix.

**Files modified**: `dapp/views/campaigns.js`, `dapp/app.js`, `public/service-workers/handlers/maxima.handler.js`, `dapp/views/creator.js`, `public/index.html`

---

### Session: 2026-06-09 — Campaigns view (L1 data) + Remove Stats

**Task**: Replace the Stats view with a new Campaigns view accessible from all roles (viewer, creator, publisher). Show real L1 data instead of estimates: escrow coin count/budget + active publishers from channel coins. Replace the publisher estimate selector in the creator form with a live L1 count.

**Fix**:
- `dapp/views/campaigns.js` (new): Campaign list from local DB enriched with L1 data. Summary cards (Campaigns, Total budget, Open channels, Active publishers) all from L1 via `coins address:ESCROW_ADDRESS*` and `coins address:CHANNEL_SCRIPT_ADDRESS`. Per-campaign publisher count from `PREVSTATE(2)` of open channel coins. Filter Active / All.
- `dapp/views/creator.js`: Removed publisher estimate buttons (5/10/25/50). Added `_loadL1PublisherCountForCreator()` — queries L1 on metrics panel open, stores count in `_l1ActivePublishers`, auto-recalculates metrics.
- `dapp/views/stats.js`: Deleted (superseded by Campaigns view).
- `dapp/app.js`: Added `campaigns` route to all three `MODE_VIEWS`. Removed `stats` from creator mode and all routing/render references.
- `public/index.html`: Removed `stats.js` script tag, added `campaigns.js`.

**AGENTS.md updated**: yes — §6 updated, oldest entry moved to `docs/HISTORY.md §17`.

**Verification**:
- Open any mode → "Campaigns" tab visible in nav
- Campaigns view: 4 summary cards show `…` then update with L1 values
- Filter Active / All switches campaign list
- Creator form → metrics panel → "Active publishers (L1)" shows real count, metrics recalculate automatically
- No console errors

**Open issues**: None.

---

### Session: 2026-06-07 — Modernize Side Drawer Menu Footer

**Task**: Modernize the side drawer menu footer by adding the DApp name, version, a pulsing connection status badge ("Connected to Minima"), and a dynamic block height tracker.

**Fix**:
- `public/index.html`: Added CSS classes and HTML for drawer footer with version, status pulse, and block height.
- `dapp/app.js`: Added `MDS.cmd('status')` on init and `NEWBLOCK` listener to update block height in footer.

---

### Session: 2026-06-07 — Normalize Publisher Frame IDs

**Task**: Fix publisher frame "Total earned" mismatch and statistics mismatch on creator/publisher nodes by normalizing frame IDs.

**Root Cause**: In several execution paths, raw public keys (e.g. `0X...`) were not normalized to the prefixed form (`builtin:0X...`), causing database lookups and updates on the `FRAMES` table (which uses prefixed keys) to fail or mapping incorrectly.

**Fix**:
- public/service-workers/handlers/channel.handler.js:
  - In `handleChannelOpen`: extract and normalize `frame_id` (prefixed with `builtin:` and capitalized) and pass it to `_doChannelOpenUpsert`.
  - In `_doChannelOpenUpsert`: update the SQL script to save `frameId` to `CHANNEL_STATE.FRAME_ID` instead of an empty string `''`.
  - In `_continueRewardVoucher`: normalize `frameId` before looking up the frame in `FRAMES` and calling `createRewardEvent`.
  - In `handlePublisherRewardNotify`: normalize `frame_id` before saving to deferred notifies or looking up channel states.
  - In `_maybeGeneratePublisherVoucher`: normalize `frameId` and handle `publisherKey` normalization.
  - In `_doGeneratePublisherVoucher`: normalize `frameId` before using it in any outbound open request, keypair store, or transaction dispatch.

**AGENTS.md updated**: yes — §6 updated.

**Verification**: Verified JS syntax using `node -c` (clean). Rebuilt `MinimaAds.mds.zip` and verified package integrity.

---

### Session: 2026-06-07 — Collapsible Campaign Cards & Combined Totals

**Task**: Re-architect the campaign cards view in the creator dashboard to make campaign cards and their budget allocation sections collapsible to keep the UI tidy, introduce a "Combined Totals" budget overview, and preserve details open states across page updates.

**Root Cause**: When a creator had multiple campaigns, the dashboard cards took up too much vertical space, showing long configuration tables and dual budget grids. In addition, there was no quick "combined totals" summary grouping general budget metrics, and page refreshes/updates would reset any toggle states.

**Fix**:
- dapp/views/mycampaigns.js:
  - Switched the main card element from `<article>` to `<details class="ma-campaign-card-details">`.
  - Put title, badge, quick stats summary, and action buttons inside the `<summary>` element.
  - Used `e.stopPropagation()` on the action button click handlers to prevent details toggle when clicking actions.
  - Put the budget allocation rows and indicators inside a collapsible nested `<details data-details-id="budget-allocation">`.
  - Added a **"Combined Totals"** row at the top of the budget allocation details body showing aggregated campaign funds (Total Budget, Escrow Left, Locked, Paid).
  - Modified state saving logic in `loadMyCampaigns` to query all elements matching `[data-campaign-id]` and preserve expanded states of both the campaign details cards and nested details panels using `data-details-id` attribute values.
  - Replaced the static/non-dynamic "Reward/View" and "Reward/Click" stat cards on the Performance row with dynamic **"Viewers"** and **"Publishers"** counts retrieved via H2 `COUNT(DISTINCT USER_ADDRESS)` and `COUNT(DISTINCT PUBLISHER_ID)` queries from `REWARD_EVENTS`.
  - Added a collapsible **"Ad Preview"** (`<details data-details-id="ad-preview">`) section which lazily renders the responsive ad banner using the project's standard `renderAd` function once toggled.
- dapp/views/ui-helpers.js:
  - Updated `mkStatCard` to use a flex column layout (`display:flex; flex-direction:column;`) and added `margin-top:auto` to the main value element (`val`) to guarantee all numbers align horizontally even if labels wrap on small screens.
- public/index.html:
  - Added custom styles for `details.ma-campaign-card-details` to animate open states and render a custom right-aligned chevron arrow indicator.

**AGENTS.md updated**: yes — §6 updated.

**Verification**:
- `mycampaigns.js` and `ui-helpers.js` compile cleanly with `node -c`.
- Rebuilt `MinimaAds.mds.zip` and verified files packaged successfully.

---

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

### Session: 2026-06-06 — Auto-Sync Platform Creator Route

**Task**: Fix the contradiction where `CREATOR_PERMANENT_ROUTE` was registered but `MINIMAADS_CREATOR_ROUTE` remained `(not set)`, breaking built-in frame reward routing.

**Changes**: **config.js**, **service.js**, **core/minima.js**, **dapp/app.js**, **dapp/views/devtools.js** — auto-sync `MINIMAADS_CREATOR_ROUTE` from `CREATOR_PERMANENT_ROUTE` on boot and on registration.

**AGENTS.md updated**: yes — §6 updated.

**Verification**: All modified JS files compile cleanly with `node -c`.

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

### Session: 2026-06-05 — Invalidate and Auto-Clear Outdated Route Formats

**Task**: Fix off-chain campaign discovery failing with "Unknown publickey" error on the MLS Server for nodes using pre-existing/outdated route configurations by automatically detecting, invalidating, and clearing them, and adding a self-healing fallback to parse direct contact addresses from legacy formats.

**Changes**:
- **core/minima.js** (`parseMaximaRoute`):
  - Updated to reject routes where the publickey segment starts with `Mx`, `mx`, or `MX` (since they represent direct contact strings rather than hex public keys).
- **core/minima.js** (`getCreatorMaximaRoute`):
  - Updated to validate the retrieved route; if the route is invalid or outdated, it prints a log and automatically deletes the keypair `CREATOR_PERMANENT_ROUTE` to trigger the re-registration flow in the UI.
- **public/service-workers/handlers/campaign.handler.js** (`processEscrowCoin`):
  - Added a self-healing parser fallback: if the discovered creator route starts with `MAX#` but the node key starts with `Mx` (legacy format), the handler automatically extracts the direct contact address `Mx...` and routes the `REQUEST_CAMPAIGN_DATA` Maxima message to it directly instead of trying a MLS lookup.

**Why**: (1) Ensures that any node containing a legacy `MAX#Mx...` route in their local database automatically clears it, forcing them to re-register the correct hex format. (2) Protects campaign availability by falling back to direct contact communication if a viewer node discovers an on-chain campaign funded with the legacy route format.

**AGENTS.md updated**: yes — §6 updated.

**Verification**:
- Verify that `parseMaximaRoute` successfully invalidates any route with an `Mx` node key.
- Verify that calling `getCreatorMaximaRoute()` with an outdated route deletes it from keypairs.
- Verify that a viewer scanning an escrow coin with the legacy route falls back to sending directly to the extracted `Mx` address.

---

### Session: 2026-06-05 — Platform Creator Permanent Address Registration

**Task**: Implement an input field in the settings UI to register the Platform Creator's stable Maxima permanent route (MAX#...). Ensure the viewer node uses this route for built-in frame reward requests, and campaign creator/publisher nodes fallback to it when routing notifications. Also support client nodes registering their own permanent routes through a remote MLS server.

**Changes**:
- **core/minima.js** (`setCreatorMaximaRoute`): Removed strict `staticmls === true` requirement so client nodes with remote MLS can also build and save their permanent route.
- **dapp/views/settings-maxima-routes.js**: Consolidated permanent registration flow; Section 2 shows verified registered route; Section 3 added "MinimaAds Platform Creator Route" with input, Save, and Clear buttons (saved under `MINIMAADS_CREATOR_ROUTE` keypair).
- **dapp/views/devtools.js**: Restructured into three clean visual sections; added SQL Console; partitioned MLS actions; fixed "Register This Node as MLS Server" to use node's own P2P identity.
- **public/service-workers/handlers/comms.handler.js** (`_sendRewardRequest`): Reads `MINIMAADS_CREATOR_ROUTE` when publisherKey equals `MINIMAADS_CREATOR_PK`.
- **public/service-workers/handlers/channel.handler.js**: Propagated `publisher_mx` through PENDING_VOUCHER queue; `_notifyPublisherByKey` queries `MINIMAADS_CREATOR_ROUTE` for platform creator; `checkOnePendingVoucher` passes publisherMx to `_maybeGeneratePublisherVoucher`.

**AGENTS.md updated**: yes — §6 updated.

---

### Session: 2026-06-05 — Reorder, Automate, and Clean Creator Permanent Route Registration in DevTools

**Task**: Swap positions of MLS Server Configuration and Creator Permanent Route Configuration in DevTools (Ctrl+Shift+D). Also, add a new explicit "MLS Permanent Registration" section in DevTools to register the node's key locally on the MLS server, and remove the unnecessary custom route input field and "Save" button from DevTools.

**Changes**:
- **dapp/views/devtools.js**:
  - Moved the MLS Server Configuration section code block above the Creator Permanent Route Configuration section.
  - Added a new middle section: "MLS Permanent Registration" with a "Register Self Key on MLS" button, which executes `maxextra action:addpermanent publickey:<local_pk>` locally.
  - Removed the custom route input field and "Save" button from the Creator Permanent Route Configuration section.
- **core/minima.js** (`setCreatorMaximaRoute`):
  - Reverted the temporary background registration change so that Option 3 (Set as Self Route) only sets the `CREATOR_PERMANENT_ROUTE` keypair value without running MLS server commands.

**Why**: Arranges setup steps logically, structures registration into three clean, separate stages (server host configuration, permanent registration, and route keypair setting), and declutters DevTools by removing unused custom input.

**AGENTS.md updated**: yes — §6 updated.

**Verification**:
- Press Ctrl+Shift+D to open the DevTools panel.
- Verify that "MLS Server Configuration", "MLS Permanent Registration", and "Creator Permanent Route Configuration" appear in that order.
- Click "Register Self Key on MLS" and verify that it registers the local key on the MLS server.
- Click "Set as Self Route" to save the route in keypairs.
- Verify there is no custom input text field or "Save" button.
- No console errors.

---

### Session: 2026-06-05 — Remote Permanent Route Registration via Service Worker

**Task**: Implement background registration of permanent route at MLS. FE requests SW to register (so it works even if DApp is closed); SW sends Maxima message to MLS in background.

**Changes**:
- **dapp/views/settings-maxima-routes.js**:
  - Modified "Register as Permanent" button: instead of local `MDS.cmd("maxima ...")`, now calls `MDS.comms.solo(JSON.stringify({type: "DO_REGISTER_PERMANENT", publickey: ...}))` to request SW asynchronously.
  - FE waits 2 seconds (for SW to process in background), then calls `setCreatorMaximaRoute()` to fetch and display the newly registered permanent route.
- **service.js** (`onComms` dispatcher + new handler):
  - Added `DO_REGISTER_PERMANENT` branch to `onComms()`.
  - New `handleRegisterPermanent(payload)`: fetches `MLS_SERVER_ADDRESS` from keypair, constructs `REGISTER_PERMANENT_REQUEST` with publickey, sends to MLS via `sendMaxima(null, mlsAddr, registerReq, cb)` in background.
- **public/service-workers/handlers/maxima.handler.js** (existing from earlier fix):
  - `REGISTER_PERMANENT_REQUEST` dispatcher branch + `handleRegisterPermanentRequest()` handler (executes `maxextra action:addpermanent` at MLS and sends back `REGISTER_PERMANENT_RESPONSE`).

**Why**: (1) SW is always running in background — registration works even if DApp is closed. (2) Mirrors campaign/reward Maxima communication pattern — SW handles Maxima outbound, FE requests. (3) MLS (SW) executes command locally so registration applies at correct node.

**AGENTS.md updated**: yes — §6 updated.

**Verification**:
- Node A (creator): `#settings/maxima-routes` → configure MLS address → click "Register as Permanent".
- Node A FE: should see "Registering with MLS..." → after 2s, should display permanent route (MAX#...#...).
- Node A SW logs: should show `DO_REGISTER_PERMANENT received`, `sending request to MLS`, `request sent ok=true`.
- Node B (MLS) SW logs: should show `REGISTER_PERMANENT_REQUEST from ...`, `REGISTER_PERMANENT executed successfully`.
- No console errors. Works even if DApp is closed (SW runs in background).

---

### Session: 2026-06-05 — Include CREATOR_PERMANENT_ROUTE in REWARD_REQUEST Payload

**Task**: Add `publisher_mx` field to the `REWARD_REQUEST` Maxima payload in `_sendRewardRequest`, carrying the creator's permanent Maxima route (`CREATOR_PERMANENT_ROUTE` keypair value) so the creator node can send `PUBLISHER_REWARD_NOTIFY` back via a stable route.

**Changes**:
- **public/service-workers/handlers/comms.handler.js** (`_sendRewardRequest`, lines ~344–367):
  - Wrapped the entire payload-build-and-send logic inside a `getCreatorMaximaRoute()` callback.
  - Added `publisher_mx: creatorRoute || ""` to the `payload` object, alongside the already-present `frame_id`.
  - `getCreatorMaximaRoute` is defined in `core/minima.js`, which is loaded before this handler in `service.js` — no new dependency.

**Why**: The creator node needs a permanent routing address to send `PUBLISHER_REWARD_NOTIFY` back. Without `publisher_mx`, the creator has no stable Maxima address for the viewer/publisher and must rely on dynamic routing alone.

**AGENTS.md updated**: yes — §6 added this entry; oldest (Add Creator Permanent Route Configuration to DevTools) moved to `docs/HISTORY.md §17`.

**Verification**:
- Open `#viewer` on a viewer node and watch an ad for ≥3 s.
- In SW logs on the viewer node, confirm `REWARD_REQUEST sent` appears.
- On the creator node, decode the received `REWARD_REQUEST` payload and confirm `publisher_mx` is present (a `MAX#...` string or empty string if route not yet set).
- No console errors expected on either node.

---

### Session: 2026-06-05 — Segment Reward Events by Channel Open Timestamp

**Task**: Resolve the discrepancy where expanding any settled channel or pending settlement in `dapp/views/earnings.js` showed all reward events of the campaign instead of only those corresponding to the active channel instance.

**Changes**:
- **dapp/views/earnings.js**:
  - Updated `_loadChannelEvents(campaignId, role, isSettled, targetEl)`:
    - Queries `CHANNEL_STATE` to find the open/pending channel's `CREATED_AT` timestamp (`openCreatedAt`).
    - Partitioned `REWARD_EVENTS` using `openCreatedAt` as the boundary:
      - For settled channels (`isSettled === true`), filters for `TIMESTAMP < openCreatedAt` (or no filter if no open channel exists).
      - For open/pending channels (`isSettled === false`), filters for `TIMESTAMP >= openCreatedAt` (or `1=0` to return empty if no open channel exists).
  - Updated callsites in `renderSettlementHistory` (line ~234) to pass `r.ROLE` and `true`.
  - Updated callsite in `_renderChannelRewardRows` (line ~398) to pass `role` and `false`.

**Why**: Solves duplicate event visibility by ensuring that as channels cycle from pending → open → settled → reset, their associated events are cleanly partitioned at the timestamp boundary of the currently open channel.

**Testing required**:
- Navigate to `#earnings`.
- With at least one settled channel and one pending settlement for a campaign, expand both:
  - Verify that the pending settlement dropdown only lists events logged during the current open channel.
  - Verify that the settled channel row dropdown only lists events logged before the current open channel's creation.

---

### Session: 2026-06-05 — Unify Settled Channels and Segment Creator Metrics Reward Events

**Task**: Fix creator campaign metrics where settled viewer channels were not shown under "Settled channels" (due to a `role = 'PUBLISHER'` SQL filter) and duplicate settled reward events were displayed under active nodes in "Rewarded nodes". Also ensure that when channels are settled on the creator's node, they are written to `CHANNEL_HISTORY` rather than just overwritten in `CHANNEL_STATE`.

**Changes**:
- **dapp/views/mycampaigns.js**:
  - Removed `AND UPPER(ROLE) = 'PUBLISHER'` from the `CHANNEL_HISTORY` query in `_loadSettledChannels` to load both viewer and publisher settled channels.
  - Updated `_renderSettledChannelsTable` to add a "Type" column showing "Viewer" or "Publisher" based on the channel role, and updated the details colspan to 7.
  - Updated `_groupSettledChannelsByPk` to group channels by PK and role.
  - Refactored `_loadRewardedNodes` to query `CHANNEL_STATE` for active channels, extract their creation timestamps (`CREATED_AT`), and filter out settled events (where event timestamp is less than the active channel's creation timestamp).
- **public/service-workers/handlers/channel.handler.js**:
  - Replaced direct `sqlQuery` `UPDATE CHANNEL_STATE SET STATUS = 'settled'` with a call to `settleChannel` (from `core/channels.js`) for both viewer and publisher settlement paths on the creator node.
  - Implemented `checkOpenChannelsSettled()`, which queries all open channels, verifies if their channel coins have been spent on-chain at the `CHANNEL_SCRIPT_ADDRESS`, and automatically transitions/archives them to `CHANNEL_HISTORY` on the creator node when spent.
- **service.js**:
  - Registered/called `checkOpenChannelsSettled()` on the `NEWBLOCK` event listener.

**Why**: Ensures all settled payment channels are archived and visible on the creator's dashboard, and partitions the individual views/clicks so that already-settled rewards do not duplicate under active nodes.

**AGENTS.md updated**: yes — §6 added this entry; oldest session moved to `docs/HISTORY.md §17`.

---

### Session: 2026-06-05 — Add Creator Permanent Route Configuration to DevTools

**Task**: Add a new option to the Ctrl+Shift+D DevTools menu allowing developers/users to manually view, set, copy, clear, and save custom creator permanent Maxima routes (`MAX#` format). Also remove the obsolete "Register MinimaAds Creator as Permanent (Server Mode)" section.

**Changes**:
- **dapp/views/devtools.js**:
  - Added "Section 1.2: Creator Permanent Route Configuration" underneath the Platform Key Configuration.
    - Implemented real-time display of the current route by querying MDS keypair (`CREATOR_PERMANENT_ROUTE`).
    - Added "Set as Self Route" button (uses `setCreatorMaximaRoute` to save current node's permanent route).
    - Added "Clear Route" button (clears `CREATOR_PERMANENT_ROUTE` in keypair).
    - Added "Copy Route" button (copies the current route to the clipboard, displaying a temporary success status).
    - Added text input field (with placeholder `Custom permanent route (MAX#pk#mls)`) and a "Save" button to validate and manually save custom routes to `CREATOR_PERMANENT_ROUTE` in keypair.
  - Removed "Section 1.9: Register MinimaAds Creator as Permanent (Server Mode)" entirely since route registration is now handled via Settings or custom inputs.

**Why**: Allows manually configuring or overriding the creator's Maxima permanent route for testing or running nodes in a multi-node topology, and cleans up obsolete UI options.

**AGENTS.md updated**: yes — §6 added this entry; oldest (Add frame_id to REWARD_REQUEST Payload) moved to `docs/HISTORY.md §17`.

**Verification**:
- Press Ctrl+Shift+D to open the DevTools panel and check the new "Creator Permanent Route Configuration" section.
- Confirm that the "Register MinimaAds Creator as Permanent (Server Mode)" section is completely gone.
- Verify that setting self, clearing, copying, and manually saving custom routes function as expected without console errors.

---

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

### Session: 2026-06-05 — Brand Header Navigation to Home

**Task**: Clicking the MinimaAds title/brand in the header should navigate to the active role's home/start tab (e.g. `#viewer` for viewer, `#creator` for creator, and `#frames` for publisher) without reloading the page.

**Changes**:
- **dapp/app.js**: Added `goHome()` global function that closes the drawer side menu (if open) and routes the user to the default view of their active mode (`MODE_VIEWS[_activeMode][0]`).
- **public/index.html**: Changed the "MinimaAds" brand logo header `<a>` tag to use `href="#" onclick="goHome(); return false;"` to trigger the routing function cleanly without page reloads.

**Why**: Simplifies DApp exploration, letting the user go back to their role's starting point from any deep page (like Settings, Profile, or Help) with a single tap, while maintaining the Single Page App (SPA) structure.

**Testing required**:
- Click the "MinimaAds" title in the top header from the main view of any mode (viewer, creator, publisher) and verify it remains on the start page without reloading.
- Navigate to `#settings` or `#profile`, then click the "MinimaAds" title and verify it correctly returns to the default view of the active mode (e.g., `#viewer` if in viewer mode, `#creator` if in creator mode, `#frames` if in publisher mode).

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

---

### Session: 2026-06-04 — Built-in Frame Owned by Platform Creator (MINIMAADS_CREATOR_PK)

**Task**: Make the built-in viewer Frame belong to the platform creator instead of the viewing node. Previously each node attributed its built-in-viewer publisher rewards to itself (`publisherKey: MY_ADDRESS`). The built-in surface is a platform-owned Frame; its publisher-side rewards must accrue to one canonical key shared by all nodes.

**Design decision**: Introduced `MINIMAADS_CREATOR_PK` as a constant in `config.js`, alongside `PLATFORM_KEY` and `APP_NAME`. `config.js` is loaded first in BOTH runtimes (SW via `MDS.load`, FE via `<script>` in index.html), so the constant resolves as a global in `core/*` and `dapp/views/*` with no init plumbing. This mirrors the existing shared-constant model (§4.6) — identical on every node, no per-node sync needed. It is the node's *attribution* key on the wire; it is NOT made a per-node mutable global like `MY_ADDRESS`. Value extracted from the platform creator's Maxima PK (DER format) in logs/user4.txt.

**Changes**:
- **config.js**: Added `var MINIMAADS_CREATOR_PK = '0X3081...0203010001';` (platform creator's Maxima PK, DER format) with a comment explaining ownership and dual-runtime loading.
- **dapp/views/viewer.js** (lines 313, 331): `publisherKey: MY_ADDRESS` → `publisherKey: MINIMAADS_CREATOR_PK` in both `MA_TRACK_VIEW` and `MA_TRACK_CLICK`. Now every built-in-viewer impression attributes its publisher reward to the platform creator.

**Not changed (deliberate)**:
- **SW (`service.js` / `core/frames.js`)**: `initBuiltinFrame` still registers the local `builtin:<node_pk>` FRAMES row keyed on the node's own Maxima PK. That row is a per-node SDK default-frame artifact and is independent of on-the-wire publisher attribution (`_tryOpenPublisherChannelForAllFrames` already skips built-in frames). No SW change is required for attribution.
- **dapp/views/frames.js** SDK snippet (line 242): custom Frames keep their own `publisherKey` (the registering publisher's key) — unchanged.

**Operational note**: For the platform creator to actually collect the built-in-frame publisher reward, the creator's node must hold an open publisher channel for `MINIMAADS_CREATOR_PK`. That is an operational/runtime concern, out of scope for this attribution change.

**Spec updated**: MinimaAds.md §4.6.1 (new — MINIMAADS_CREATOR_PK), §6.9 (frame ownership model + built-in impression attribution), FRAMES schema comment (§3.5), file-tree config.js comment.

**Verification**: Open `#viewer`, view an ad ≥3s (and click one). In the SW log, the `MA_TRACK_VIEW`/`MA_TRACK_CLICK` publisher attribution and any `REWARD_REQUEST` (role='publisher') / DEFERRED_PUB_REWARD should now carry the platform creator's Maxima PK (`0X3081...`), not the viewing node's wallet address. No console errors expected.

**AGENTS.md updated**: yes — §6 added this entry; oldest entry (Platform_Key Mismatch) moved to docs/HISTORY.md §17.

---

### Session: 2026-06-04 — Fix: Built-in Viewer Publisher Rewards Not Earned

**Task**: Diagnose and fix why the built-in viewer (integrated snippet in MinimaAds) produces viewer rewards but publisher rewards are never generated or sent.

**Investigation**: Opus traced the reward flow end-to-end across frames.js → comms.handler.js → channel.handler.js → voucher pipeline. The channel/voucher infrastructure is correct and capable of publisher-reward generation. The single defect: `viewer.js:313` and `:331` hardcoded `publisherKey: ''` in both `MA_TRACK_VIEW` and `MA_TRACK_CLICK` payloads. Per spec (§96, §664-669), the built-in viewer IS a registered Frame with `publisher_key = node's own Maxima PK`, and should self-publish (earn publisher rewards on own views). An empty `publisher_key` causes the guard at `channel.handler.js:1309` (`if (r === 'viewer' && (frame_id || publisher_key))`) to skip `_maybeGeneratePublisherVoucher`, blocking the entire publisher-reward branch at the deferred-voucher step (where log shows viewer event created at user1.txt:37 then stops — no publisher voucher).

**Changes**:
- **dapp/views/viewer.js** (lines 313 and 331): Replace `publisherKey: ''` with `publisherKey: MY_ADDRESS`. `MY_ADDRESS` is the node's Maxima public key (set from `maxima action:info` at app.js:1842) — the same value used for the built-in frame ID. This enables the publisher-reward branch to fire on every view/click in the built-in viewer.

**Why**: Spec explicitly states the built-in viewer is a Frame and should earn publisher rewards on views. The previous empty key was likely a placeholder that was never filled in. Fixing it makes the built-in viewer behavior match documented intent and makes it consistent with custom-snippet frames (frames.js:242 correctly reads the publisher key from FRAMES and injects it).

**Verification**: Logs from test run 21:57 (with fix applied) confirm:
- publisherKey in MA_TRACK_VIEW is now user3's Maxima PK (not empty) ✓
- _maybeGeneratePublisherVoucher receives non-empty frameId and stores DEFERRED_PUB_REWARD correctly ✓
- Deferred reward record includes frame=user3's PK, amount=10 — ready to replay when publisher channel opens ✓
- Root cause (empty publisherKey causing orphaned deferred records) is fixed

The remaining DEFERRED state is expected (no open publisher channel yet), not a regression.

**Note**: The built-in viewer publishes to itself, so one view generates both a viewer reward (creator ≠ viewer check) and a publisher reward (self-publishing). Spec allows this (Platform role = Viewer + Creator + Publisher). Confirmed working end-to-end.

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

### Session: 2026-06-04 — Fix: MAXIMA_ROUTE_DISCOVERY Campaign Platform_Key Mismatch

**Task**: Diagnose and fix campaign discovery rejection caused by `platform_key mismatch` error blocking user4 (MinimaAds creator) from accepting campaigns from other nodes.

**Root Cause**: The MAXIMA_ROUTE_DISCOVERY changes enabled reliable cross-node campaign discovery, which exposed a latent bug: the `platform_key` validation in `campaign.handler.js` (lines 33-37) compared the announced key from the Maxima payload against the receiver's local `PLATFORM_KEY` override. When nodes had different `PLATFORM_KEY` values (per-node overrides set via DevTools), campaigns were silently rejected as mismatches. The payload-based check is also spoofable — the real authority is the on-chain `PREVSTATE(5)` in the escrow coin.

**Changes**:
- **public/service-workers/handlers/campaign.handler.js** (lines 33-41): Commented out the spoofable payload-based `platform_key` check. Added explanation: the authoritative validation is on-chain via `PREVSTATE(5)`.
- **public/service-workers/handlers/campaign.handler.js** (lines 59): Updated the on-chain `PREVSTATE(5)` validation to accept campaigns where `PREVSTATE(5) = 0x00` (creator had no platform fee). Old logic: `!onChainPk || onChainPk !== PLATFORM_KEY` would reject. New logic: `onChainPk && onChainPk !== '0x00' && onChainPk !== PLATFORM_KEY` accepts 0x00 regardless of receiver's local setting.
- **sdk/index.js** (lines 970-972): Applied the same fix to the SDK path's `_persistCampaignPayload` function. Commented out the equivalent payload-based platform_key check for consistency.

**Why**: The payload-based check breaks cross-node discovery and is a security anti-pattern (payload is attacker-controlled). The on-chain validation already exists and is authoritative. See KNOWN_ISSUES.md #31 principle: "never read PREVSTATE from announced JSON payload as primary verification — always verify on-chain."

**Note on Commission**: Platform creation fees are **already paid as part of the escrow funding tx** (creator.js line 1500-1604). User1 either includes a fee output (output[0] to PLATFORM_KEY, output[1] to escrow) or does not. This is a wallet-level transfer, not a DB reward event. The commission was never "missing" — it was either created or not at creator's choice. The bug only prevented the campaign from being visible on user4's node.

---

### Session: 2026-06-04 — Settings Page Accordions

**Task**: Refactor the Settings page to consolidate all sections (Appearance, Maxima Routes, and Privacy) into collapsible accordions (details/summary elements), keeping only Appearance open by default, and handling automatic route-based expansion.

**Changes**:
- **dapp/views/settings.js**: Refactored `renderSettings()` to use PicoCSS details/summary accordions. Integrated `renderMaximaRoutesSettings` inside the "Configure Maxima Routes" accordion. If the URL hash is `settings/maxima-routes`, it opens the routes accordion, collapses Appearance, and scrolls the routes section into view.
- **dapp/views/settings-maxima-routes.js**: Removed the standalone heading so the MLS and permanent route configuration forms embed cleanly in the accordion, and updated the description to note that the feature is essential for both campaign creators and publishers.
- **dapp/views/creator.js**: Moved the campaign creation status/error message paragraph inside the review panel, directly below the "Publish Campaign" button.

**Testing required**:
- Navigate to `#settings` → Appearance should be open, other accordions closed.
- Click "Configure Maxima Routes" → verify it opens and contains MLS, Permanent User registration, and Finalise options.
- Click a redirection link/trigger (e.g. Creator view without route) → page redirects to `#settings/maxima-routes`, which opens the routes accordion, collapses Appearance, and scrolls to the routes section.

---

### 2026-06-04 (fix: DevTools Polish & SQL Console Removal)
- **Task**: Fix DevTools CSS layout, remove the SQL console, adjust button styling, remove the Copy command button, add "Copy Address" helper buttons, and ensure MLS Save configures static MLS.
- **Changes**: 
  - **dapp/views/devtools.js**: Removed SQL console inputs, textarea, run button, outputs, and the `runQuery` function. Re-styled the entire modal layout with modern glassmorphism overlay using PicoCSS theme variables. Added smooth open/close animations. Aligned all input rows (Platform Key, MLS Server, Client Mode) to a consistent 2.2rem height. Renamed the Platform Key "Register" button to "Save". Removed the "Copy: maxextra action:staticmls" button. Added "Copy Address" buttons to both the Platform Key Configuration and MLS Server Configuration sections to easily copy active addresses. Fixed the MLS Server configuration "Save" button to execute `maxextra action:staticmls` on the node, ensuring the setting applies at the platform level (not just saving to local DB keypair).
- **Why**: Simplifies development settings, makes input-button alignments consistent, cleans up redundant command buttons, and resolves a bug where saving the MLS server via DevTools failed to actually register the MLS server with the Maxima stack.

### 2026-06-04 (feat: MAX# permanent route support — creator setup + escrow STATE(4))
- **What**: Implemented MVP phase of permanent Maxima route support validated by Opus.
- **Changes**:
  - `core/minima.js`: added 4 helper functions — `getMaximaInfo(cb)`, `parseMaximaRoute(route)`, `setCreatorMaximaRoute(cb)`, `getCreatorMaximaRoute(cb)`. All Rhino-safe (var, function declarations, no arrow functions/template literals). Route stored in keypair as `CREATOR_PERMANENT_ROUTE`.
  - `dapp/views/creator.js`: `fundEscrowAndPublish` now validates `CREATOR_PERMANENT_ROUTE` exists before starting escrow. If not set → fails with clear message. Escrow STATE(4) now stores `MAX#<pk>#<mls>` (permanent route) instead of mutable `Mx...` contact string. Added `_showCreatorRouteSetupBanner()` (3-step setup instructions + "Check & Register Route" button) shown on creator view load when route is not set. Submit button disabled while route is missing. Helper `_copyToClipboard()` added.
  - `dapp/views/devtools.js`: Ctrl+Shift+D panel expanded with "Dev Settings — Maxima Routes" section showing current stored route, copy command for `maxextra action:staticmls`, and "Register Creator Route" button.
- **STATE(4) contract change**: escrow coin STATE(4) now encodes `MAX#<pk>#<mls>` instead of `Mx...` contact. Viewers discovering campaigns via on-chain STATE(4) must send to this MAX# route (existing `sendMaxima` fallback with `to:MAX#...` already handles this — see `sendMaxima` in core/minima.js which passes mxAddress as second arg).
- **Files**: `core/minima.js`, `dapp/views/creator.js`, `dapp/views/devtools.js`.
- **AGENTS.md updated**: yes — this entry; oldest entry archived to `docs/HISTORY.md §17`.
- **Verification**: (1) Navigate to #creator — setup banner should appear (route not yet set). (2) Ctrl+Shift+D → "Maxima Routes" section visible, shows "No route registered yet.". (3) If node has static MLS: click "Check & Register Route" → success, page reloads. (4) After reload: no banner, submit enabled. (5) Create a campaign → inspect escrow coin STATE(4) — should be hex of `MAX#<pk>#<mls>`. (6) Nodes without static MLS: "Register" shows "Node does not have static MLS configured" error.

### 2026-06-03 (refactor: viewer.js — eliminate SDK race conditions via Service Worker broadcast)
- **Problem**: Viewer received "creator offline" errors when calling `trackView()` due to race conditions in SDK initialization. Liveness check PING timed out because async Maxima address initialization wasn't complete.
- **Root Cause Analysis**: The SDK was never designed to handle the complex timing interactions in the integrated viewer.js context. However, the **publisher SDK snippet** uses a completely different pattern that **works perfectly**: broadcast `MA_TRACK_VIEW` messages and let the Service Worker handle validation, rewards, and payments.
- **Key Insight**: The Service Worker handlers (`handleTrackView()`, `handleTrackClick()` in `comms.handler.js`) already implement ALL the logic: validation, budget updates, reward creation, channel payment. The SDK's complex async initialization was unnecessary.
- **Solution**: Refactored `viewer.js` to use the proven publisher pattern:
  - `_trackDetailView()`: send `MA_TRACK_VIEW` broadcast, refresh earnings immediately (no callback wait)
  - `_wireDetailInteractions()`: send `MA_TRACK_CLICK` broadcast, open URL in callback
  - Service Worker processes both messages and handles all validation/rewards synchronously
- **Why This Is Better**: 
  1. **No race conditions**: Broadcasting is async and independent of SDK init
  2. **Proven pattern**: Publisher snippet uses this successfully
  3. **Simpler code**: No callback chains or SDK complexity in viewer.js
  4. **Same result**: Identical reward flow, identical budget tracking, identical channel payments
  5. **Better separation**: UI sends message, SW handles logic (clear responsibility boundary)
- **Files**: `dapp/views/viewer.js`, `sdk/index.js`
- **Verification**: (1) Navigate to #viewer, click campaign to open detail. (2) Wait 3s for progress bar. (3) Verify "Today earned" updates automatically. (4) Click CTA and verify URL opens. (5) Check logs for no errors.

### 2026-06-03 (fix: CREATOR_LIVENESS_PING regression — race condition in async Maxima init)
- **Problem**: Viewer receives `confirmed: false, reason: 'creator offline'` when calling `trackView()`, even when creator is reachable. PING messages sent to creator had empty `viewer_mx` field, causing timeout. Root cause: TWO separate issues:
  - **Issue 1**: Auto-init hack set `_inited = true` without calling `_completeInit()`, leaving `_myMx` uninitialized.
  - **Issue 2** (subtle race): Even after `_completeInit()` was fixed, `_checkCreatorLiveness()` was called BEFORE async `MDS.cmd('maxima action:info')` completed inside `_completeInit()`, resulting in empty `_myMx`.
- **Root cause**: The SDK's initialization is async (requires MDS.cmd callback), but `_checkCreatorLiveness()` was not waiting for this completion. In the viewer flow, trackView() → _checkCreatorLiveness() could fire before Maxima address was ready.
- **Solution** (four-part fix):
  1. Removed auto-init hack from `_trackEvent()` (was: simple `_inited = true`).
  2. Added proper `init()` call in `_trackEvent()` when `_inited === false`, ensuring full initialization chain.
  3. Added `_mxReady` flag + `_mxReadyCallbacks` queue in SDK: set to true only after `MDS.cmd('maxima action:info')` completes in `_completeInit()`. Queued callbacks are drained when flag is set.
  4. Updated `_checkCreatorLiveness()` to check `_mxReady` before sending PING. If not ready, callback is queued and executed later when ready.
- **Files**: `sdk/index.js` (two commits: 0e62b5c + d2f3abc).
- **Verification**: Viewer trackView() → SDK checks `_mxReady` → waits if needed → sends PING with valid viewer_mx → creator receives PING and responds with PONG → viewer receives PONG within 3s timeout → liveness check passes → reward proceeds.

### 2026-06-03 (docs: Maxima route discovery and static MLS plan)
- **Problem**: Payment channels between non-contact Maxima users can lose off-chain availability when a creator/viewer/publisher `Mx...` route changes. Existing `PREVSTATE(4)=creator_mx_address` is only a mutable-route hint stored immutably on the current escrow coin.
- **Key finding**: Minima supports permanent Maxima addresses via `maxextra`: `MAX#<maxima_public_key>#<static_mls_address>`. `maxima action:send to:MAX#...` resolves the current address through the static MLS before sending.
- **Documented design**: New `docs/MAXIMA_ROUTE_DISCOVERY.md` recommends treating `PREVSTATE(4)` as `creator_route`, requiring `MAX#...` for campaign discovery before production, keeping `CREATOR_ADDRESS` as Maxima PK identity, adding passive route refresh on every message, and adding future `PEER_ROUTE_UPDATE` for viewer/publisher route changes.
- **Files**: `docs/MAXIMA_ROUTE_DISCOVERY.md`, `docs/DOCUMENTATION_INDEX.md`, `docs/HISTORY.md`, `AGENTS.md`.
- **No runtime changes**: documentation/design note only.

### 2026-06-02 (fix: CREATOR_LIVENESS_PING race condition — Haiku-level fix)
- **Problem**: PING messages were sent with empty `viewer_mx` field when `_myMx` initialization was not complete, causing PONG failures and confusing `ok:false` logs.
- **Root cause**: `_checkCreatorLiveness()` could execute before the async `maxima action:info` in `_completeInit` set `_mxReady`.
- **Solution**:
  - Enhanced `core/minima.js` `sendMaxima()` logging to show route failures and fallback attempts.
  - Added `_mxReady` and `_mxReadyCallbacks` in `sdk/index.js`; `_checkCreatorLiveness()` waits for Maxima info before sending PING.
  - Fixed `_sendLivenessPing()` to use `_myMxAddress()` instead of `_myMx` directly.
  - Increased `LIVENESS_TIMEOUT_MS` from 3000 to 5000.
- **Files**: `core/minima.js`, `sdk/index.js`.
- **No contract changes**: logging and initialization order only.

### 2026-06-01 (feat: PROFILE_REQUEST/RESPONSE — creator avatar and name for non-contact campaigns)
- **New Maxima messages**: `PROFILE_REQUEST` and `PROFILE_RESPONSE`.
- **New SW→FE signal**: `PROFILE_RECEIVED { publickey, name, icon }`.
- **Service Worker**: `campaign.handler.js` handles profile request/response; `maxima.handler.js` routes both message types.
- **Viewer UI**: `dapp/views/viewer.js` fetches creator profiles for non-contact campaigns, caches them in keypair as `CREATOR_PROFILE_<PK>`, and updates avatar/name in-place when received.
- **App dispatch**: `dapp/app.js` dispatches `PROFILE_RECEIVED` to `onProfileReceived(parsed)`.
- **No DB schema changes**.

### 2026-06-03 (feat: campaign daily & publisher reward limits validation and hints)
- **Problem**: Creators could configure daily limits that exceed the max reward per viewer, or set a publisher reward per view that exceeds the publisher budget or total campaign budget.
- **Solution**:
  - Added dynamic validation helper `enforceDailyLimits(form)` in `dapp/views/creator.js` to update hints under view/click limits, clamp input bounds, and validate on submit.
  - Added dynamic validation helper `enforcePublisherLimits(form)` to ensure `max_publisher_budget >= publisher_reward_view` and `publisher_reward_view <= budget`, updating corresponding UI hints and clamping inputs. Also dynamically caps the maximum publisher budget and reward based on the remaining budget after viewer cap allocation (`budget - max_viewer_reward`).
  - Added dynamic validation helper `enforceViewerRewardLimits(form)` to enforce `reward_view` and `reward_click` are capped by the allowed budget, displaying dynamic help hints showing minimum limits and max limits.
  - Enforced all sets of checks in form submit validations (`onCreatorSubmit`), including ensuring that `max_viewer_reward + max_publisher_budget <= budget`.
  - Removed "optional" label from `publisher_reward_view` and raised `LIMITS.MIN_PUBLISHER_REWARD_VIEW` from `0.001` to `0.01` in `dapp/app.js`, `service.js` and `MinimaAds.md`. Clamped `publisher_reward_view` to the new `0.01` minimum when active.
  - Lowered `LIMITS.MIN_REWARD_CLICK` from `0.005` to `0.001` in `dapp/app.js`, `service.js`, and `MinimaAds.md` to align with the new click limit.
  - Refactored `formatMinima` in `dapp/views/creator.js` to strip trailing decimal zeroes.
  - Updated `enforceCapMinimum(form)` to enforce `max_viewer_reward` is capped at `budget - max_publisher_budget`, updating hints dynamically.
- **Files**: `dapp/views/creator.js`, `dapp/app.js`, `service.js`, `MinimaAds.md`.
- **No contract changes**: UI validation and limit adjustment only.

### 2026-06-01 (fix: scoped sticky header CSS)
- **Problem**: Scoped sticky header CSS was affecting subheaders within cards.
- **Solution**: Scoped sticky header CSS from global `header` selectors to `body > header`. Frame cards use internal `<header>` elements. Opaque background color applied to prevent content showing through.

### 2026-06-01 (feat: publisher snippet copy button in summary)
- **Problem**: Users had to open the details panel to copy the snippet.
- **Solution**: Custom Frame `Snippet` summary includes a compact `Copy` button using Clipboard API/textarea fallback. Styled with theme primary hover colors.

### 2026-06-01 (fix: viewer campaign row hover colour)
- **Problem**: Hover color used pico card sectioning background color.
- **Solution**: Set explicit neutral hover colors: `rgba(255,255,255,.06)` in dark mode and `rgba(15,23,42,.05)` in light mode.

---

### 2026-06-05 (fix: _notifyPublisherByKey: extract Maxima routeKey from frameId)
- **Task**: Fix `_notifyPublisherByKey` to route the `PUBLISHER_REWARD_NOTIFY` Maxima message to the correct key. The function was passing `publisherKey` (RSA/DER identity key, `MINIMAADS_CREATOR_PK`) to `sendMaxima`, but `sendMaxima` requires an EC Maxima public key for routing.
- **Root cause**: For built-in frames, `frameId` encodes the publisher node's actual Maxima PK as `builtin:<maxima_pk>`. The RSA `MINIMAADS_CREATOR_PK` stored as `publisherKey` is used for channel-state identity (VIEWER_KEY/PUBLISHER lookups) but is not a valid Maxima routing key. Passing it to `sendMaxima` caused the message to route to the wrong node or fail silently.
- **Changes**:
  - **public/service-workers/handlers/channel.handler.js** — `_notifyPublisherByKey`:
    - Before calling `sendMaxima`, extract `routeKey`:
      - If `frameId` starts with `'builtin:'` → `routeKey = frameId.substring(8).toUpperCase()` (the embedded EC Maxima PK)
      - Otherwise → `routeKey = publisherKey` (existing behaviour for custom frames)
    - Call `sendMaxima(routeKey, null, notify, cb)` instead of `sendMaxima(publisherKey, ...)`.
- **AGENTS.md updated**: yes.

---

### 2026-06-05 (style: Viewer and Publisher Collapsibles and Expandable Table Rows CSS Polish)
- **Task**: Style collapsibles and expandable rows in both the viewer earnings dashboard (`dapp/views/earnings.js`) and the publisher's Frames page (`dapp/views/frames.js`) to match the premium aesthetics of the creator campaign metrics (`dapp/views/mycampaigns.js`).
- **Changes**:
  - **dapp/views/earnings.js**:
    - For "Pending settlements" (lines ~364–386), updated the `<details>`/`<summary>` element to use `className = 'ma-campaign-details'` and `className = 'ma-campaign-details-summary'` and removed the inline style.
    - For "Settled channels" (lines ~203–240), refactored the expandable table row to use `className = 'ma-expandable-row'`, `tabindex = '0'`, and `aria-expanded = 'false'`. Replaced the plain `▶`/`▼` toggle button with an animated `›` span chevron. Configured row-level click and keyboard Enter/Space event listeners to toggle the expansion and transition the rotation of the chevron, using the `ma-nested-detail` class on the inner detail cell.
  - **dapp/views/frames.js**:
    - For the "Snippet" collapsible (lines ~138–185) and the "Earnings" collapsible (lines ~187–208) on custom and built-in frame cards, replaced their inline styles with `className = 'ma-campaign-details'` and `className = 'ma-campaign-details-summary'` to use the unified stylesheet.
- **Why**: Unifies the UI layout across viewer and publisher screens, bringing custom focus states, hover backgrounds, and smooth chevron transitions from the Campaign card accordion lists to personal Earnings and Frames views.

---

### 2026-06-05 (feat: Publisher Notify on Deferral)
- **Task**: After `_deferPublisherReward()` saves a pending publisher reward, the publisher (e.g. platform creator for built-in frames) was never notified to open a channel. Without the notify, the deferred reward remained orphaned indefinitely.
- **Root cause**: `_maybeGeneratePublisherVoucher` called `_deferPublisherReward()` on both its fast path (publisherKey provided) and legacy path (no publisherKey, FRAMES lookup), but neither path sent `PUBLISHER_REWARD_NOTIFY` afterward. The existing `_maybeNotifyPublisher()` requires a FRAMES row with `PUBLISHER_MX` — which doesn't exist on the creator node for built-in frames where `publisherKey = MINIMAADS_CREATOR_PK`.
- **Changes**:
  - **public/service-workers/handlers/channel.handler.js**:
    - Added `_notifyPublisherByKey(campaignId, frameId, publisherKey)` — sends `PUBLISHER_REWARD_NOTIFY` directly via `sendMaxima(publisherKey, null, ...)` (no FRAMES lookup). Guards against sending if channel already open/pending.
    - Fast-path deferral (line ~1056): added `_notifyPublisherByKey(campaignId, frameId || publisherKey, publisherKey)` after `_deferPublisherReward`.
    - Legacy-path deferral (line ~1090): added `_maybeNotifyPublisher(campaignId, frameId)` after `_deferPublisherReward`. (Legacy path still needs FRAMES to get `PUBLISHER_MX` for non-builtin frames; `_notifyPublisherByKey` isn't applicable since no key is available.)
- **AGENTS.md updated**: yes.

---

### 2026-06-05 (fix: Fix Missing Settled Channels on Creator Dashboard)
- **Task**: Diagnose and fix why settled channels never appeared in the creator's `CHANNEL_HISTORY` / Settled channels UI section, even after viewer nodes settled their channels on-chain. Also fix the viewer's `#earnings` view showing all settled cycles merged into one row.
- **Root cause**: Three silent data-loss/display paths:
  1. **`handleChannelOpen`** (viewer side): when the creator sends a `CHANNEL_OPEN` for a second channel cycle, raw `MERGE INTO CHANNEL_STATE KEY (CAMPAIGN_ID, VIEWER_KEY, ROLE)` silently overwrote the existing row without archiving to `CHANNEL_HISTORY`.
  2. **`CHANNEL_OPEN_REQUEST` stale-pending path** (both viewer and publisher sides): when an existing `pending` channel was older than 5 minutes and had no split-coin, the code fell through to `openChannel()` directly, again overwriting without archiving.
  3. **`_refreshSettlementHistory`** in `earnings.js`: a `GROUP BY (CAMPAIGN_ID, ROLE)` merged all settled channel cycles for the same campaign into a single row — hiding individual channel instances.
- **Changes**:
  - **public/service-workers/handlers/channel.handler.js**:
    - `handleChannelOpen`: before the `MERGE`, query `CHANNEL_STATE` for an existing open/pending row with a **different** coinid. If found, call `settleChannel()` first to archive it, then delegate to a new helper `_doChannelOpenUpsert()`.
    - `_doChannelOpenUpsert()` (new helper): extracted the raw MERGE + post-open logic from `handleChannelOpen` to keep both paths DRY.
    - `CHANNEL_OPEN_REQUEST` stale-pending, no split-coin path (**viewer**): now calls `settleChannel()` to archive the stale record, then proceeds to `openChannel()` + `_swDispatchChannelOpen()`.
    - `CHANNEL_OPEN_REQUEST (publisher)` stale-pending, no split-coin path: same fix as viewer — archive stale record via `settleChannel()` before opening a new channel, preserving the `VIEWER_WALLET_PK` and `PUBLISHER_BUDGET_SPENT` updates.
  - **dapp/views/earnings.js**:
    - `_refreshSettlementHistory`: removed `GROUP BY` — now selects each `CHANNEL_HISTORY` row individually so multiple settlement cycles appear as separate rows.
    - `_loadChannelEvents`: added `channelCreatedAt` param; for settled channels, determines the per-channel event range as `[channelCreatedAt, nextChannelCreatedAt)` by querying `CHANNEL_HISTORY` for the next cycle and `CHANNEL_STATE` for the current open channel.
    - `_doLoadEvents()` (new helper): extracted event-table rendering logic shared by both settled and active paths.
- **Why**: Ensures every channel lifecycle transition is fully archived and individually visible.
- **AGENTS.md updated**: yes.

---

### Session: 2026-06-05 — Use Permanent Route in STATE(4) and PK-Routing for Campaign Discovery

**Task**: Fix viewers being unable to discover campaigns when creator nodes have no static IP or stale direct contact in STATE(4) of the escrow coin. Apply four targeted fixes using the permanent Maxima route (`MAX#<hexPK>#<mls>`) instead of `MY_MX_ADDRESS`.

**Changes**:
- **public/service-workers/handlers/channel.handler.js** (`swBuildAndPostChannelTx`):
  - Wrapped body in `MDS.keypair.get("CREATOR_PERMANENT_ROUTE", ...)`. If a valid `MAX#...` route is registered, encodes it as STATE(4) instead of `MY_MX_ADDRESS`. Inner work moved to `_swBuildAndPostChannelTxInner`.
- **public/service-workers/handlers/campaign.handler.js** (`processEscrowCoin`):
  - When STATE(4) decodes to `MAX#<hexPK>#<mls>` with a valid hex PK, sets `creatorPkRoute = pk` and `creatorMxAddr = null` to enable PK-based MLS routing.
- **public/service-workers/handlers/campaign.handler.js** (new `_sendRequestCampaignData` helper):
  - Reads `CREATOR_PERMANENT_ROUTE` keypair and sets `requester_mx` to the permanent route if available; falls back to `MY_MX_ADDRESS`. All `REQUEST_CAMPAIGN_DATA` sends go through this helper.
- **public/service-workers/handlers/campaign.handler.js** (`handleRequestCampaignData`):
  - If `requester_mx` starts with `MAX#` and has a hex PK, routes `CAMPAIGN_DATA_RESPONSE` via `sendMaxima(respPk, null, ...)` instead of `sendMaxima(null, requesterMx, ...)`.

**Why**: Both the creator's STATE(4) and the viewer's `requester_mx` were using `MY_MX_ADDRESS` (direct contact), which is empty/stale on nodes without a static IP or MLS. The permanent route is stable across IP changes and is routed via MLS, so using it in both directions makes campaign discovery resilient.

**AGENTS.md updated**: yes — §6 updated.

**Verification**:
- Creator node: register permanent route in DevTools (Ctrl+Shift+D), then create a new campaign. Verify the new escrow coin's STATE(4) (visible in SQL console: `SELECT * FROM CAMPAIGNS`) stores a `MAX#...` hex route.
- Viewer node: on a node with no static IP (`MY_MX_ADDRESS` empty), wait for escrow coin scan. Verify `[DISCOVERY] Permanent route in coin:` log appears and `REQUEST_CAMPAIGN_DATA` is sent via PK routing.
- Creator node: verify `CAMPAIGN_DATA_RESPONSE` is routed back to the viewer's permanent route (check SW log for `[CAMPAIGN] CAMPAIGN_DATA_RESPONSE sent`).
- Viewer receives campaign in `#viewer` view without errors.

---

### Session: 2026-06-05 — Fix Rewards for Built-in Viewer and Custom Snippet

**Task**: Rewards (viewer + publisher) were not arriving when ads were viewed via the built-in viewer (`viewer.js`) or the embedded snippet. Root cause: wrong `frame_id` in REWARD_REQUEST caused the creator to silently drop publisher `CHANNEL_OPEN_REQUEST` for the built-in frame, and snippets were missing `frameId`/`publisherMx` in tracking calls.

**Changes**:
- **public/service-workers/handlers/comms.handler.js**:
  - `handleTrackView` and `handleTrackClick`: extract `frameId` and `publisherMx` from MA_TRACK_VIEW/MA_TRACK_CLICK payload and thread them through `_triggerChannelPayment`.
  - `_triggerChannelPayment`, `_sendChannelOpenRequest`, `_resolveViewerAddrAndSend`, `_doSendChannelOpenRequest`: all now accept and thread `frameId` and `publisherMx`.
  - `_doSendChannelOpenRequest`: stores `frame_id` and `publisher_mx` in `PENDING_REWARD_` keypair.
  - `_sendRewardRequest`: when `publisherKey == MINIMAADS_CREATOR_PK`, uses `"builtin:" + MINIMAADS_CREATOR_PK.toUpperCase()` as `frame_id` (was `MY_MAXIMA_PK` — wrong). For custom snippets, uses snippet-provided `frameId`.
  - `_doSendRewardRequestWithRoute`: signature updated to take `resolvedFrameId` and `pubMxRoute` as separate args.
- **public/service-workers/handlers/channel.handler.js**:
  - `handleChannelOpen` auto-REWARD_REQUEST: now includes `frame_id` and `publisher_mx` from the `PENDING_REWARD_` keypair.
- **dapp/views/frames.js**:
  - `_loadSnippet`: also reads `PUBLISHER_MX` from FRAMES table.
  - `_buildSnippet(fid, pubKey, pubMx)`: embeds `frameId` and `publisherMx` as snippet constants.
  - Snippet `_trackView` and `_trackClick`: now include `frameId` and `publisherMx` in the broadcast payload.

**Why**: `frame_id = "builtin:" + viewer_PK` in REWARD_REQUEST caused `handleChannelOpenRequest` to drop publisher CHANNEL_OPEN_REQUEST because `claimedPk (viewer_PK) !== sndrPk (MINIMAADS_CREATOR_PK)`. The fix sets the platform creator's built-in frame ID for built-in viewer rewards, and threads the custom frame ID/publisherMx for snippets.

**AGENTS.md updated**: yes — §6 updated.

**Verification**:
- User3 (viewer) opens `#viewer`, waits for ad, views it. Confirm `MA_TRACK_VIEW confirmed` in SW log.
- Confirm REWARD_REQUEST is sent with `frame_id = "builtin:<MINIMAADS_CREATOR_PK>"` (not viewer's PK).
- User4 (platform creator/publisher) receives PUBLISHER_REWARD_NOTIFY, opens publisher channel, receives publisher reward.
- For custom snippet: embed snippet in a MiniDapp, view an ad, confirm correct `frameId` logged in SW.
- No console errors on either node.

---

### Session: 2026-06-06 — Rename CREATOR_PERMANENT_ROUTE to USER_PERMANENT_ROUTE

**Task**: Globally rename the keypair key `CREATOR_PERMANENT_ROUTE` to `USER_PERMANENT_ROUTE` (as it represents the node's permanent route, independent of role), implement seamless database migration on boot for both Service Worker and Front-End runtimes, and update all usages across all layers.

**Changes**:
- **service.js**:
  - In `initBootstrap` (inside `initDB` callback), added a migration step: if the legacy key `CREATOR_PERMANENT_ROUTE` exists, it copies its value to `USER_PERMANENT_ROUTE`, sets the legacy key to `""` to clear it, and then continues boot-up using `USER_PERMANENT_ROUTE`.
  - Updated auto-sync logic for Platform Creator to read/update `USER_PERMANENT_ROUTE`.
- **core/minima.js**:
  - In `setCreatorMaximaRoute` and `getCreatorMaximaRoute`, changed `CREATOR_PERMANENT_ROUTE` references to `USER_PERMANENT_ROUTE`.
- **public/service-workers/handlers/channel.handler.js**:
  - Updated calls to `MDS.keypair.get` to query `USER_PERMANENT_ROUTE` instead of `CREATOR_PERMANENT_ROUTE`.
- **public/service-workers/handlers/campaign.handler.js**:
  - Updated `_sendRequestCampaignData` to check `USER_PERMANENT_ROUTE` instead of `CREATOR_PERMANENT_ROUTE`.
- **dapp/app.js**:
  - In `onInited`, added the same front-end boot-time migration sequence checking for legacy `CREATOR_PERMANENT_ROUTE` and writing to `USER_PERMANENT_ROUTE`.
- **dapp/views/settings-maxima-routes.js**:
  - Updated checked key from `CREATOR_PERMANENT_ROUTE` to `USER_PERMANENT_ROUTE`.
- **dapp/views/devtools.js**:
  - Replaced all query, copy, clear, and save actions target keys from `CREATOR_PERMANENT_ROUTE` to `USER_PERMANENT_ROUTE`.
  - Updated `addKpRow` to inspect and show `USER_PERMANENT_ROUTE` directly, removing the legacy parenthesis label.
  - Removed the "Copy" button from Section 1.3 ("Remote MLS Registration").
- **MinimaAds.md**:
  - Updated documentation table in Section 3.6 to refer to `USER_PERMANENT_ROUTE`.

**Why**: Unifies permanent MLS routing identification to a role-agnostic name `USER_PERMANENT_ROUTE`, preventing data loss for existing setups via runtime migration blocks.

**AGENTS.md updated**: yes — §6 updated.

**Verification**:
- Verified that all modified JS files compile cleanly with `node -c`.

---

### Session: 2026-06-06 — Fix Viewer and Publisher Reward Delivery (3 bugs)

**Task**: Diagnose and fix why viewers and platform creator (publisher) were not receiving rewards. Root cause traced via live node logs.

**Root Cause (3 bugs encadenats)**:
1. **Race condition** (`checkOpenChannelsSettled`).
2. **Pending voucher lost** (`checkPendingVouchers` only queried open channels).
3. **`publisherMx` absent** on viewer nodes.

**Fixes**: `channel.handler.js` (fixes 1–3a), `comms.handler.js` (fix 3b). See `logs/rewards-snippet-debug.md` for full detail.

**AGENTS.md updated**: yes — §6 updated.

---

### Session: 2026-06-06 — Unify MLS Route Registration and Clean DevTools

**Task**: Review DevTools panel (Ctrl+Shift+D), unify static route/MLS registration flows, remove the redundant "Register Self Key on Local MLS" button, and handle local registration in the Service Worker when MLS address is self.

**Changes**:
- **service.js**:
  - In `handleRegisterPermanent`, check if the configured `MLS_SERVER_ADDRESS` is equal to `MY_MX_ADDRESS` (isSelf).
  - If self, execute `maxextra action:addpermanent publickey:<pubkey>` locally using `MDS.cmd` directly.
  - If remote, send the `REGISTER_PERMANENT_REQUEST` Maxima message to the remote MLS server.
- **dapp/views/devtools.js**:
  - Removed the `mlsAddSelfKeyBtn` button ("Register Self Key on Local MLS") and its click listener block.

**Why**: Removes the redundant manual registration button from DevTools and routes the registration flow locally in the SW when the configured MLS is self, maintaining a single unified front-end flow.

**AGENTS.md updated**: yes — §6 updated.

**Verification**:
- Opened DevTools modal (Ctrl+Shift+D) and verified "Register Self Key on Local MLS" button is removed.
- Verified local and remote execution paths in `service.js` work correctly.

---

### Session: 2026-06-07 — Log Publisher Reward Events & Rename Active Rewards Label

**Task**: 
- Campaign creator's "Rewarded nodes" screen not showing publisher earnings when they originate from the built-in snippet/viewer frame.
- Clarify active reward section name in the campaign dashboard to avoid confusion with settled channels.

**Root Cause**: 
- On the creator's node, the Service Worker only created a `REWARD_EVENTS` row (type `'view'`) when a viewer voucher was signed and posted. It completely skipped generating `publisher_view` reward events when issuing publisher vouchers. Additionally, in `_swDispatchVoucher`, the `rewardAmount` was hardcoded to `0` when the role was `'publisher'`.
- "Rewarded nodes" label was ambiguous and did not clearly distinguish active, pending-settlement earnings from archived on-chain settled channels.

**Fix**: 
- In `channel.handler.js`:
  - Updated `_swDispatchVoucher` to set `rewardAmount` to the campaign's `PUBLISHER_REWARD_VIEW` when the role is `'publisher'`.
  - In `swSignAndPostChannelTx`'s `sendMaxima` callback, added the path for `role === 'publisher'` to query the active campaign's ad and write a `'publisher_view'` reward event (passing `publisher_id = fid`). This correctly populates `REWARD_EVENTS` and decrements the campaign budget via the local `updateBudget` call in `createRewardEvent`.
- In `dapp/views/mycampaigns.js`:
  - Renamed the section heading and comments from "Rewarded nodes" to "Pending settlement".
  - Renamed empty state and loading texts accordingly to "No pending settlements yet." and "Loading pending settlements…".

**AGENTS.md updated**: yes — §6 updated.

**Verification**:
- `channel.handler.js` and `mycampaigns.js` compile cleanly with `node -c`.

---

### Session: 2026-06-07 — Detailed Campaign Budget Allocation UI

**Task**: Improve the creator's campaign metrics UI to break down the campaign budget into distinct actionable sections (available in escrow, locked in channels, and settled payouts) and introduce CTR performance tracking.

**Root Cause**: Previously, the campaign cards only showed "Budget left" (which represents the escrow balance), without explaining what was locked in open payment channels or already settled/paid to viewers and publishers. This was confusing because users could not audit the flow of funds or see pending unliquidated channel balances.

**Fix**:
- dapp/views/mycampaigns.js:
  - Updated `loadMyCampaigns()`'s SQL query to fetch separate viewer and publisher channel aggregates (`VIEWER_LOCKED`, `VIEWER_UNSETTLED`, `VIEWER_SETTLED`, `PUB_LOCKED`, `PUB_UNSETTLED`, `PUB_SETTLED`, and dynamic `PUB_SPENT_ACTUAL`).
  - Split the "Budget Allocation" section into two distinct rows: "Budget Allocation (Viewer)" (Available Escrow, Locked in Channels, Settled Paid, Unspent Campaign) and "Budget Allocation (Publisher)" (Max Pub Budget, Budget Reserved, Budget Spent, Budget Left) to organize dynamic runtime fons.
  - Mobile responsiveness: Switched both rows to responsive CSS Grids (`repeat(auto-fit, minmax(120px, 1fr))`).
  - Exhausted Publisher Budget Warning: Added a dynamic check so if the remaining publisher budget is lower than a single view's reward rate, the "Budget Left" card values turn red, and the subtext changes to "Exhausted (cannot open)".
  - Collapsible Campaign Configuration: Added an expandable details block showing static parameters divided into themed sub-sections: General Campaign Data, Reward Viewer, Reward Viewer Limits, and Publisher Rewards & Limits (removing dynamic/runtime publisher stats from this static block).
  - Periodic Auto-Refresh Removed: Completely eliminated the 30-second interval timer which caused disruptive full-page UI refreshes.
  - Silent Stateful Update: Added `loadMyCampaigns(isAutoRefresh)` parameter to preserve the open/expanded states of all details blocks before reloading.
  - Polish: updated progress bar labels and footnotes.
- dapp/views/creator.js:
  - Added a descriptive note beneath the "Max publisher budget" input field to explain dynamic runtime budget reservation, payment channels, and tracking.
- dapp/views/help.js:
  - Expanded the Creator Help panel with dedicated sections detailing the Viewer and Publisher budget allocation categories.
- dapp/app.js:
  - Configured handlers for `NEW_CAMPAIGN`, `CAMPAIGN_UPDATED`, and `REWARD_CONFIRMED` to trigger silent/seamless reloads.

**AGENTS.md updated**: yes — §6 updated.

**Verification**:
- `mycampaigns.js`, `creator.js`, and `help.js` compile cleanly with `node -c`.

---

### Session: 2026-06-07 — Restore Publisher Frame Historical Earnings

**Task**: Fix publisher frame "Total earned" mismatch in the frames view by reading the values directly from the `TOTAL_EARNED` column of the `FRAMES` table rather than dynamically calculating it from `REWARD_EVENTS`.

**Root Cause**: The previous session modified `listFrames` and `getFrameEarnings` to sum `REWARD_EVENTS` dynamically, which discarded historical earnings that didn't have corresponding `REWARD_EVENTS` entries due to past service worker bugs.

**Fix**:
- core/frames.js:
  - Reverted `listFrames` to select `TOTAL_EARNED` directly from the `FRAMES` table without the `REWARD_EVENTS` JOIN.
  - Reverted `getFrameEarnings` to read `TOTAL_EARNED` from the `FRAMES` table, while keeping a subquery to count events in `REWARD_EVENTS`.

**AGENTS.md updated**: yes — §6 updated.

**Verification**:
- Checked JS syntax on all modified files with `node -c` (all clean).
- Rebuilt `MinimaAds.mds.zip` and verified package integrity.

---

### Session: 2026-06-09 — Minima Foundation Fee (3%) + V4 Escrow Script Fixes

**Task**: Add a configurable 3% Minima Foundation fee alongside the existing 6% platform creator fee, and fix all resulting escrow script and channel transaction bugs.

**Root Cause (chain of bugs fixed)**:
1. **STATE(16) not set in split/open txns** — V4 script reads `LET foundationfeeflag=STATE(16)` unconditionally at top-level. KissVM throws when a STATE port is absent (same as PREVSTATE, per KNOWN_ISSUES #38). Split tx and channel-open tx never set port 16, causing `Script FAIL` on every V4 spend. **Fix**: add `txnstate port:16 value:0` to all 4 tx builders (SW Tx1/Tx2, FE Tx1/Tx2).
2. **`escrowAddrFallback` did not include V4** — fallback was `V3 || V1`. If `r2.response.transaction.inputs[0].address` read failed, `coinAddr` fell back to V3, but `@ADDRESS` in V4 script = V4. `VERIFYOUT` would fail. **Fix**: fallback now `V4 || V3 || V1`.
3. **`setTimeout` in SW** — `swWaitForCoin` retry used `setTimeout`, not available in Rhino. **Fix**: single-attempt; rely on `checkPendingChannelOpens` NEWBLOCK retry.
4. **Stale SPLIT_COINID loops forever** — rejected split coin stays in `PENDING_CHOPEN_QUEUE` indefinitely. **Fix**: after 20 blocks without finding the coin, clear `SPLIT_COINID` and reset channel state to `pending`.

**Foundation fee implementation**:
- `config.js`: `FOUNDATION_KEY = null` (MVP, disabled by default)
- `creator.js`: `FOUNDATION_FEE_RATE = 0.03`, ESCROW_SCRIPT_V4, 3-output atomic funding tx, cost breakdown UI
- `service.js`: ESCROW_SCRIPT_V4 (byte-identical), loads `FOUNDATION_KEY_OVERRIDE`
- `dapp/app.js`: loads `FOUNDATION_KEY_OVERRIDE` at boot
- `devtools.js`: new subsection 2.3 "Minima Foundation Fee Address (3%)" — Set/Clear/Copy/manual input
- `campaign.handler.js`: verifies `FOUNDATION_KEY` at `PREVSTATE(6)` on-chain (V4)
- `ESCROW_ADDRESS_V2` / `ESCROW_SCRIPT_V2` removed (development only, no real campaigns)

**Files modified**: `config.js`, `dapp/app.js`, `dapp/views/creator.js`, `dapp/views/devtools.js`, `public/service-workers/handlers/campaign.handler.js`, `public/service-workers/handlers/channel.handler.js`, `service.js`

**AGENTS.md updated**: yes — §6 updated.

**Verification**: Full end-to-end test (user1=creator, user3=viewer, user4=MinimaAds platform). Logs confirm: `SW CHANNEL_OPEN sent (viewer) ok=true`, `SW REWARD_VOUCHER sent cumulative: 0.05 role: viewer ok=true`, `SW CHANNEL_OPEN sent (publisher) ok=true`, `SW REWARD_VOUCHER sent cumulative: 0.075 role: publisher ok=true`. No Script FAIL.

---

### Session: 2026-06-10 — Fix publisher earnings for custom publisher snippets

**Task**: Publisher Earnings view shows "Open channels: 1" but "Total earned: 0 / Pending settlements: 0" for custom publisher-created snippets. Built-in (integrated) snippets work correctly.

**Root cause** (two linked issues):
1. `handleChannelOpenRequest()` in `channel.handler.js` discarded the viewer's `frame_id` when storing the viewer's `CHANNEL_STATE` on the creator's node — always passed `''` to `openChannel()` for viewer role. So `CHANNEL_STATE.FRAME_ID = ''` on the creator's node.
2. `_handleRewardRequestInner()`: `channelFrameId = channel.FRAME_ID || payload.frame_id = '' || '' = ''` → condition `(channelFrameId || publisherKey)` false → `_maybeGeneratePublisherVoucher()` never called → creator never generates publisher vouchers from external viewer REWARD_REQUESTs.
Built-in snippets work because the publisher IS the viewer and sends their own PUBLISHER REWARD_REQUEST via `_publisherChannelFlow()`.

**Fix**:
- `handleChannelOpenRequest()` viewer role (all 3 `openChannel()` call sites + corresponding `_swDispatchChannelOpen()` + stale-pending Tx2 retry): pass `frameId` from payload instead of `''`. Also added retroactive `UPDATE CHANNEL_STATE SET FRAME_ID` for existing open channels with empty FRAME_ID.
- `_handleRewardRequestInner()` and `checkOnePendingVoucher()`: skip `_maybeGeneratePublisherVoucher()` when `channelFrameId` starts with `'builtin:'` — built-in publisher handles their own rewards; skipping prevents duplicate vouchers.

**Files modified**: `public/service-workers/handlers/channel.handler.js`, `sdk/index.js`

**AGENTS.md updated**: yes — §6 updated.

---

### Session: 2026-06-11 — Fix built-in publisher reward not dispatched on channel open

**Task**: Built-in publisher (user4) opened a publisher channel successfully but received no REWARD_VOUCHER. Root cause: `_publisherChannelFlow()` in the SDK opens a new channel (STATUS='pending') but discards the pending `amount`. When CHANNEL_OPEN arrives, `_doChannelOpenUpsert()` checks `PENDING_REWARD_<campaignId>` (which is never set by the publisher flow) and does nothing. The CHANNEL_OPENED signal had no `role` field so the SDK couldn't distinguish viewer from publisher channels.

**Why built-in specifically**: Our earlier fix (`_isBuiltinFid` check in `_handleRewardRequestInner()`) correctly skips `_maybeGeneratePublisherVoucher()` for built-in frames to avoid duplicate vouchers. This means the creator never sends deferred rewards for built-in publishers — the publisher must self-dispatch via REWARD_REQUEST.

**Fix**:
- `channel.handler.js`: added `role` field to the CHANNEL_OPENED signal from `_doChannelOpenUpsert()`.
- `sdk/index.js` — `_publisherChannelFlow()`: for built-in frames, stores pending `amount` in `PENDING_PUB_REWARD_<campaignId>` keypair when opening a new channel or accumulating while pending.
- `sdk/index.js` — `_onChannelOpenedCore()`: when `role='publisher'`, retrieves `PENDING_PUB_REWARD_<campaignId>` and dispatches `_sendPublisherRewardRequest()`. Non-builtin frames still handled by creator-side deferred replay.

**Files modified**: `public/service-workers/handlers/channel.handler.js`, `sdk/index.js`

**AGENTS.md updated**: yes — §6 updated.

---

### Session: 2026-06-11 — Redundant Profile item, Settings Redirection Flow, Scroll Reset, Viewer Status, & Campaign Redirect

**Task**:
1. Remove redundant "Profile" option from vertical drawer menu.
2. Fix jarring page reload/database reset when registering a permanent Maxima route in Settings.
3. Fix window not scrolling to top on route changes (resulting in home page loading scrolled down).
4. Update ad viewer status message to green "Reward received! +X.XX MINIMA" when payment voucher arrives.
5. Automatically redirect user to "My Campaigns" view after successfully creating/publishing a campaign.

**Fix**:
- **UI & Drawer cleanups**: Removed redundant drawer Profile button from `public/index.html` and unused `openProfileFromDrawer` from `dapp/app.js`.
- **Settings Redirection & Scroll Reset**: Replaced `location.reload()` callback with SPA routing (`goHome()`) in `dapp/views/settings-maxima-routes.js`. Added `window.scrollTo(0, 0)` at the beginning of `doRender()` in `dapp/app.js` to reset viewport scroll position on route/page transitions.
- **Viewer Status Update**: Implemented `onViewerVoucherReceived` in `dapp/views/viewer.js` and wired it to `VOUCHER_RECEIVED` event in `dapp/app.js` to change the status element's text and color upon payment voucher confirmation.
- **Campaign Redirect**: Modified `saveCampaignAndBroadcast` in `dapp/views/creator.js` to show a `"Campaign published successfully. Redirecting…"` message and perform a delayed SPA redirect (`window.location.hash = '#mycampaigns'`) after 1.5 seconds.

**Files modified**: `public/index.html`, `dapp/app.js`, `dapp/views/settings-maxima-routes.js`, `dapp/views/viewer.js`, `dapp/views/creator.js`, `MinimaAds.mds.zip`

**AGENTS.md updated**: yes — §6 updated.

---

### Session: 2026-06-11 — Support Immediate Viewer & Creator Error Messages for Reward Limits

**Task**: Display error/status messages immediately on the viewer screen if reward limits (campaign limits, daily limit, cooldown) are hit when opening the campaign details view. Previously, limits were only checked when requesting a reward, causing silent failures, and clicking the ad still attempted to process the click reward. Also, fix the viewer details "Back" button failing to return to the campaigns list in viewer mode, and display a "Limit Reached" badge on the campaigns list when the campaign's viewer reward limit is exceeded.

**Fix**:
- **Viewer-Side Pre-Validation**: Modified `_startDetailAd()` in `dapp/views/viewer.js` to call `validateView()` before initiating the 3-second timer and progress bar.
- **Immediate Rejection UI**: If validation fails, the progress bar and timer are skipped entirely, and the status text displays the rejection reason (e.g. cooldown, daily limit, campaign reward limit reached) in red immediately.
- **Enhanced Limit Rejection Mapping**: Added support for the reason `'campaign reward limit reached for this user'` in both the pre-check and reward feedback UI, rendering errors in red (`var(--pico-del-color,#c0392b)`).
- **Core Database Validation**: Updated `validateView` and `validateClick` inside `core/validation.js` to query `CHANNEL_STATE` for the viewer key and campaign ID. If the cumulative rewards (`CUMULATIVE_EARNED` + reward rate) exceed the channel `MAX_AMOUNT`, return `{ valid: false, reason: 'campaign reward limit reached for this user' }`.
- **Bypass Invalid Click Rewards**: Added a `rewardAllowed` flag to `_viewerState` in `dapp/views/viewer.js`. When a campaign is invalid, clicking the ad link simply opens the URL and returns to the list without broadcasting a click reward request or showing the processing status.
- **Back Button Routing**: Fixed `_goBackToList()` in `dapp/views/viewer.js` which attempted to update `window.location.hash = 'campaigns'`. Because the hash was already `'campaigns'` (rendered inline), no hashchange fired and the DApp remained stuck. Replaced it with an explicit call to the global router `doRender()`.
- **Campaign List Limit Badges**: Updated `mkStatusBadge` in `dapp/views/ui-helpers.js` to map status `'completed'` to a red `"Limit Reached"` badge. Joined `CHANNEL_STATE` in the campaign list queries (`dapp/views/campaigns.js` and `dapp/views/viewer.js`) and appended the red `"Limit Reached"` badge next to the status badge if the viewer's cumulative rewards for the active channel exceed the max amount.

**Files modified**: `core/validation.js`, `dapp/views/viewer.js`, `dapp/views/campaigns.js`, `dapp/views/ui-helpers.js`, `dapp/views/help.js`, `MinimaAds.mds.zip`

**AGENTS.md updated**: yes — §6 updated.

---

### Session: 2026-06-11 — Fix discovery retry on Maxima send failure

**Task**: When `REQUEST_CAMPAIGN_DATA` Maxima send returned `ok: false`, the coin was already marked in `_knownEscrowCoins` so it was never retried on subsequent blocks. Campaigns published while Maxima was transiently unavailable became permanently invisible until SW restart.

**Fix**: In `campaign.handler.js` `processEscrowCoin`, delete the coin from `_knownEscrowCoins` when `_sendRequestCampaignData` returns `ok: false`, allowing retry on the next NEWBLOCK.

**Files modified**: `public/service-workers/handlers/campaign.handler.js`

**AGENTS.md updated**: yes — §6 updated.

---

### Session: 2026-06-12 — Clarify MLS Address, Remove Platform Creator Route Section, Add Privacy Info, Align Theme/Number Format Button Contrast, Remove Horizontal/Vertical Image Position Controls, Improve My Campaigns Action Buttons Contrast, Qualify Offline Publisher Reward Message, Improve Stat Cards Vertical Alignment, & Make Campaign Stat Grids Responsive on Mobile

**Task**: 
1. Clarify in settings that the MLS Server Address is the default/recommended one.
2. Remove the obsolete "Platform Creator Route" section from the Settings sub-page.
3. Update the "Privacy" settings accordion to show an explanatory message about how Minima and MinimaAds approach user privacy (decentralization, Maxima encryption, local storage, on-chain pseudonymity) instead of a placeholder message.
4. Align the default inactive theme/number format buttons to match the outline hover style (primary border and primary text color on soft background).
5. Remove "Horizontal (%)" and "Vertical (%)" range inputs from the image controls in the creator campaign preview, keeping only "Image width (%)".
6. Fix readability and contrast of "Finish" and secondary buttons in My Campaigns by applying the primary outline hover styling as their base state.
7. Correct the misleading offline publisher warning message in Publisher Frames view, since rewards do accumulate offline on the creator's node and are paid out once channels open.
8. Align elements in `mkStatCard` so that when a sub-description is present, any blank flexbox space is inserted between the data value and the description, rather than between the title and the value.
9. Make the performance and budget allocation stat grids responsive on mobile devices to prevent descriptions from overflowing or squishing.

**Fix**:
- Updated the `mlsDesc` textContent in `dapp/views/settings-maxima-routes.js` to state that the MLS address is default and recommended but a custom one can be specified.
- Removed the entire "Platform Creator Route" section (Section 3 UI code) from `dapp/views/settings-maxima-routes.js`.
- Replaced the "Privacy preferences — coming soon" placeholder in `dapp/views/settings.js` with structured list items explaining MinimaAds' decentralized privacy model.
- Customized `.ma-theme-mode-btn` in `public/index.html` so that inactive buttons display with their hover outline styling (primary text, primary border, and soft card background) as their base state.
- Removed "Horizontal (%)" and "Vertical (%)" sliders from `dapp/views/creator.js` HTML template, simplified the mobile input event listener, and streamlined `_syncMobileControls()` to only sync the image width.
- Updated `button.secondary` and `button.outline` styling in `public/index.html` to share the same primary outline design (primary text and border with a soft background) by default in both light and dark modes, resolving all text contrast issues.
- Updated the warning box in `dapp/views/frames.js` to clarify that if the node is offline, publisher rewards accumulate on the campaign creator node and are delivered once back online and channels open.
- Refactored `mkStatCard` inside `dapp/views/ui-helpers.js` to apply `margin-top: auto` to the description element (when present) and keep the value element adjacent to the title. If no description is present, `margin-top: auto` is kept on the value element to preserve bottom alignment.
- Added a `.ma-stat-grid` (and `.ma-stat-grid.cols-3` / `.cols-5` variants) responsive grid CSS helper class in `public/index.html` (rendering as 2 columns on mobile viewports and scaling to 3/4/5 columns on desktop). Modified the inline style grid styles in `dapp/views/mycampaigns.js`, `dapp/views/earnings.js`, and `dapp/views/campaigns.js` to use this new utility class.

**Files modified**: `dapp/views/settings-maxima-routes.js`, `dapp/views/settings.js`, `public/index.html`, `dapp/views/creator.js`, `dapp/views/frames.js`, `dapp/views/ui-helpers.js`, `dapp/views/mycampaigns.js`, `dapp/views/earnings.js`, `dapp/views/campaigns.js`

**AGENTS.md updated**: yes — §6 updated.

---

### Session: 2026-06-14 (patch 2) — Fix click reward blocked by view cooldown

**Task**: Click reward not delivered to viewer after clicking an ad. Viewer SDK sent REWARD_REQUEST with `reward_type:'click'` and correct cumulative, but creator SW rejected it with "cooldown not elapsed."

**Root cause**: `LAST_VOUCHER_AT` in `CHANNEL_STATE` is a single timestamp shared by view and click events. After issuing a view voucher, the cooldown timer resets. A click sent within the cooldown window (e.g. 4 s < 30 s) was incorrectly blocked.

**Fix**: In `_handleRewardRequestInner` (`channel.handler.js` line ~590), wrapped the LAST_VOUCHER_AT cooldown check in `if ((payload.reward_type || 'view') !== 'click')`. Click events now bypass the view cooldown; anti-spam for clicks is already enforced by `isDuplicate(eventId)` + the accrual delta check.

**Files modified**: `public/service-workers/handlers/channel.handler.js`

**AGENTS.md updated**: yes — §6 updated.

---

### Session: 2026-06-14 (patch 3) — Second security audit + N2-1 fix (sendMaxima injection guard)

**Task**: Second comprehensive security audit (`docs/audit_report_2.md`). Verified all first-audit fixes (C-1, C-2, M-1..M-4, L-1..L-4, N-2, N-4) are resolved. Found new issues: N2-1 (MEDIUM, command injection via `sendMaxima`), N2-2 (MEDIUM, click cooldown regression from `508b7ed`), N2-3 (MEDIUM, publisher budget not capped at voucher time), N2-4/N2-5/N2-6 (LOW).

**Fix applied (N2-1 only)**: Added central validation in `sendMaxima` (`core/minima.js`) — rejects a `publicKey` that fails `isHexKey` or an `mxAddress` that fails `isMaximaRoute` before they reach `MDS.cmd("maxima action:send ...")`. Closes the C-2-class injection on `viewer_key`/`publisher_key`/`publisher_mx` (the original T1/T2/T14 sweep guarded the call sites but not these routing keys, and `sendMaxima` itself had no guard). Worst-case averted: injected `poll:true` → ~77s SW freeze (remote DoS).

**Deferred (documented in `docs/audit_report_2.md` §10)**: N2-2/N2-3 → dedicated Opus sessions (hot path + schema in both runtimes / concurrent logic). N2-4 → design task (naive `senderPk === viewer_key` guard breaks the SDK path, which opens channels with a wallet key as `viewer_key`).

**Files modified**: `core/minima.js`, `docs/audit_report_2.md` (new), `AGENTS.md`, `docs/HISTORY.md`.

**AGENTS.md updated**: yes — §6 updated, oldest entry (2026-06-13 patch 4) moved to `docs/HISTORY.md §17`.



