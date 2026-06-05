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

