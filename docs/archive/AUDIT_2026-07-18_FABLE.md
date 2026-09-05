# MinimaAds Security & Functional Audit — 2026-07-18

**Conducted by**: Fable agent (deep comprehensive audit)
**Scope**: Full codebase at `/home/joanramon/Minima/MinimaAds` (core, SW, SDK, FE, renderer, config)
**Cross-referenced against**: `MinimaAds.md`, `docs/KNOWN_ISSUES.md` (fragility #1–50), patch-25 handoff

---

## Executive Summary

**20 findings** identified across security, functional correctness, platform constraints, and integration consistency.

- **CRITICAL**: 1 (unauthenticated Maxima handlers → remote channel tampering & balance loss)
- **HIGH**: 4 (replay attacks, spoofing, cache invalidation gaps, reservation cap bypass)
- **MEDIUM**: 6 (on-chain validation bypass, budget contradiction, expiry logic, dead code coupling)
- **LOW/INFO**: 9 (documentation drift, dead signals, schema parity, logging)

**Strongest recommendation**: Fix #1 first. The N2-4 security audit added `OPENER_MX_PK` binding to `handleRewardRequest` but left its mirror handlers (`handleChannelOpen`, `handleRewardVoucher`, `handleVoucherSyncRequest`) unauthenticated, reopening the remote-tampering vector.

---

## CATEGORY: Security

### CRITICAL

**Issue**: Unauthenticated `CHANNEL_OPEN` / `REWARD_VOUCHER` Maxima handlers allow remote channel-state tampering and voucher destruction
**Location**: `public/service-workers/handlers/channel.handler.js:361` (`handleChannelOpen`), `:865` (`handleRewardVoucher`), `:715` (`_continueRewardVoucher`)
**Description**: Neither handler receives or checks `senderPk` (the dispatcher in `maxima.handler.js:42,48` doesn't even pass `msg.data.from`). Any Maxima peer that knows a `(campaign_id, viewer_key)` pair — viewer_key is the viewer's public Maxima PK for all comms-handler channels — can:
1. Send `REWARD_VOUCHER` with arbitrary `cumulative` and garbage `tx_hex` → `updateChannelVoucher` **overwrites `LATEST_TX_HEX`**, destroying the viewer's only creator-signed settlement voucher (real economic loss: unsettled earnings revert to the creator after the timelock). There is no monotonicity check — `cumulative` lower than current is accepted.
2. Inflate the viewer's `TOTAL_EARNED`/`REWARD_EVENTS` (viewer branch at `:796–860` writes delta with no `isDuplicate` pre-check and no sender validation).
3. Send the same messages to the **creator** node (same dispatcher) to reset `CUMULATIVE_EARNED` on the creator's channel record, corrupting budget accounting (`SUM(CUMULATIVE_EARNED)` is the publisher-budget cap input at `:88, :666, :1542`) → publisher over-payout beyond `MAX_PUBLISHER_BUDGET`.
4. Send `CHANNEL_OPEN` with a fake `channel_coinid` → MERGE overwrites a healthy open channel (`_doChannelOpenUpsert`), optionally force-archiving it via the settle path.
**Proof**: craft hex payload `{"type":"REWARD_VOUCHER","campaign_id":X,"viewer_key":<victimPK>,"event_id":"x","cumulative":0,"tx_hex":"0xDEAD"}`, send `maxima action:send publickey:<victim> application:minima-ads data:...`. Victim SW runs `handleRewardVoucher` → `_continueRewardVoucher` → `updateChannelVoucher` blows away `LATEST_TX_HEX`.
**Fix**: Pass `msg.data.from` to both handlers and enforce `senderPk === channel.OPENER_MX_PK` (viewer) / `=== creator PK from CREATOR_MX` (creator side), mirroring the `OPENER_MX_PK` guard already present in `_handleRewardRequestInner:579`. Additionally reject non-monotonic `cumulative` (`cumulative < channel.CUMULATIVE_EARNED`) before overwriting `LATEST_TX_HEX`. This is the single most important fix — `handleRewardRequest` was hardened (N2-4) but its two counterpart handlers were not.

### HIGH

**Issue**: `handleRewardVoucher` viewer-reward path has no `isDuplicate` guard → replayable balance inflation
**Location**: `channel.handler.js:796–860` (viewer branch of `_continueRewardVoucher`)
**Description**: MinimaAds.md §10.3 claims "Full mitigation — replayed event IDs always rejected." True for `createRewardEvent` (`core/rewards.js:22`) and `handleRewardRequest` (`:632`), but the SW voucher-receipt path writes `REWARD_EVENTS` and bumps `USER_PROFILE.TOTAL_EARNED` (`+delta`) using `MERGE INTO REWARD_EVENTS KEY(ID)` with `reId = eventId` and **never calls `isDuplicate`**. The MERGE dedupes the REWARD_EVENTS row (same ID) but the `USER_PROFILE.TOTAL_EARNED = TOTAL_EARNED + delta` UPDATE runs unconditionally every time the message arrives → replaying the same voucher repeatedly inflates displayed total earned.
**Proof**: Send the same valid `REWARD_VOUCHER` twice; `TOTAL_EARNED` increments both times while `REWARD_EVENTS` stays single-row.
**Fix**: Wrap the REWARD_EVENTS/USER_PROFILE writes in `isDuplicate(eventId)` and a DEDUP_LOG insert, consistent with `createRewardEvent`.

**Issue**: `_assertCreatorThen` bypassed for on-chain status but Maxima PAUSE/FINISH creator check trusts a spoofable fallback for CAMPAIGN_ANNOUNCE-discovered campaigns
**Location**: `campaign.handler.js:164–192`
**Description**: The creator check reads `creatorPk` from `CREATOR_MX` (permanent route) and, when absent, falls back to `CREATOR_ADDRESS` (`:183`). `CREATOR_ADDRESS` is set from the attacker-controlled `payload.campaign.creator_address` in `saveCampaign` for CAMPAIGN_ANNOUNCE/DATA_RESPONSE campaigns. `senderPk` (`msg.data.from`) is cryptographically authenticated by Maxima, so the check `creatorPk === senderPk` still requires the attacker to actually be the node identified in `creator_address`. That is sound **only if** `creator_address` was validated at persist time — but `handleCampaignAnnounce` never verifies `creator_address` against the on-chain coin. Net effect is limited (attacker can only pause/finish a campaign they declared themselves as creator of, which is self-defeating), so this is HIGH-leaning-MEDIUM, but worth noting: the spec (§8.5) explicitly says "There is no creator-identity check at the protocol level," and the on-chain reconciliation will overwrite spoofed states — but a spoofed CAMPAIGN_FINISH triggers `autoSettleChannelsForCampaign` (`applyStatusChange:592`) prematurely on every receiving node, forcing settlement of live channels. Combined with the fact that legacy campaigns have no `STATE(7)` to reconcile against (fragility #44), the spoofed 'finished' is **not** reverted for V1/V2 campaigns.
**Fix**: For CAMPAIGN_PAUSE/FINISH affecting a campaign whose escrow is V1/V2 (no port 7), require the sender to match the on-chain `PREVSTATE(4)` route PK, or ignore the Maxima fast-path entirely and rely on the reward-rejection back-propagation.

**Issue**: Reservation cap (`MAX_CHANNEL_RESERVATION = 10`) is far smaller than the escrow change verification math tolerates, and viewer `max_amount` capping happens after budget check but publisher path can still over-reserve via `maxAmount = effectiveCap`
**Location**: `channel.handler.js:96–104` (publisher), `:230–235` (viewer)
**Description**: Two separate issues:
- Viewer path caps `maxAmount` to `LIMITS.MAX_CHANNEL_RESERVATION` (10) *after* the `BUDGET_REMAINING < maxAmount` check (`:226`), which is fine, but the SDK computes `_computeMaxAmount` (`sdk/index.js:255`) with the same cap, so a campaign whose per-viewer reward legitimately exceeds 10 MINIMA silently truncates viewer earnings potential without any UI warning. Functional, low-severity.
- Publisher path: `effectiveCap = min(maxAmount, pubRemaining)` then `maxAmount = effectiveCap`. But `MAX_CHANNEL_RESERVATION` is **not** applied to publisher channels, so a publisher CHANNEL_OPEN_REQUEST with `max_amount = MAX_PUBLISHER_BUDGET` reserves the entire publisher budget in one channel, blocking concurrent publishers until the first settles. The `_doSendPublisherChannelOpenRequest` sender caps to `pubView*10` (`:1319`) but a hand-crafted request bypasses that.
**Fix**: Apply `LIMITS.MAX_CHANNEL_RESERVATION` to the publisher branch too.

**Issue**: `ESCROW_INFO_REQUEST` handler leaks campaign financials, and its response signal is a dead path on the FE
**Location**: `maxima.handler.js:135–236`, `dapp/app.js:415` / `dapp/views/campaigns.js:376`
**Description**: Two things: (1) The N2-6 authorization gate (`:162`) only checks `OPENER_MX_PK` membership — but for the **creator** the check is `fromPk === CREATOR_ADDRESS`, and `CREATOR_ADDRESS` is a Maxima PK while `fromRoute` (`msg.data.from`) is also a Maxima PK, so this is sound. However a counterparty who ever opened *any* channel (even a settled/stale one) retains permanent read access to live `budget_remaining`, `escrow_left`, `publisher_budget_spent`. Minor info leak. (2) The response is sent back via Maxima as `ESCROW_INFO_RESPONSE`, and the FE has a handler `_handleEscrowInfoResponse` (`app.js:415`) that is only reachable via **MDSCOMMS** — but no SW code ever `signalFE("ESCROW_INFO_RESPONSE", …)`. The Maxima response arrives as a `MAXIMA` event, which the FE deliberately ignores, and `maxima.handler.js` has no `ESCROW_INFO_RESPONSE` case in the dispatcher (`onMaxima`). So the whole ESCROW_INFO round-trip **updates nothing** on the requester — dead code path. `campaigns.js:376` sends the request, but the answer is silently dropped.
**Fix**: Either add an `ESCROW_INFO_RESPONSE` case to `onMaxima` that calls `signalFE`, or remove the requester code. Also narrow the auth gate to only *open* channels.

### HIGH (continued)

**Issue**: `handleVoucherSyncRequest` unauthenticated — any peer can request re-emission of a signed voucher
**Location**: `channel.handler.js:891`
**Description**: No `senderPk` check. A peer supplying `(campaign_id, viewer_key)` triggers the creator to re-send the latest `REWARD_VOUCHER` (a creator-signed partial tx) to `channel.CREATOR_MX` (the stored viewer route). Since it routes to the stored viewer address, not the requester, this is not a direct exfiltration, but it is a free amplification/DoS primitive (forces tx lookups + Maxima sends). Combined with the resend of `CHANNEL_OPEN`, it is an unauthenticated work-trigger.
**Fix**: Validate `senderPk` against `OPENER_MX_PK`/viewer key before responding.

### MEDIUM

**Issue**: `renderAd` image `alt` uses sanitized title but zoom transform-origin injects `safePos` — OK; but `bg_color`/`text_color` from a stale DB row bypass re-sanitization on some FE views
**Location**: `dapp/views/campaigns.js:247,273` vs `renderer/renderAd.js`
**Description**: `renderAd.js` is well-hardened (`safeColor`, `safePos`, `safeUrl`, `safeImageData`, `ALLOWED_TAGS:[]`) — good. `campaigns.js` uses `DOMPurify.sanitize()` for title/body but assigns to `textContent` anyway (belt-and-suspenders, fine). No live XSS found in ad rendering. This is INFO-level; the sanitization posture is solid. XSS-1 (icon tracking pixel) confirmed fixed — `viewer.js:181,581` gate `img.src` behind the `data:image/...` regex.
**Fix**: None required; noting the render layer is clean.

**Issue**: `getUserRewards` LEFT JOINs CAMPAIGNS but returns raw creator address; `_maxDelivered` logs full response including routes
**Location**: `core/minima.js:71`, `core/rewards.js:148`
**Description**: `_maxDelivered` logs `JSON.stringify(res.response)` on delivery failure, which can include Maxima routing metadata. `MDS.log` only, low exposure. Public keys are already public. Informational.

---

## CATEGORY: Functional Correctness

### HIGH

**Issue**: Patch-25 cache invalidation is incomplete — SW-originated status changes don't always invalidate the SDK `_livenessCache`, and the `_livenessCache` key casing is inconsistent
**Location**: `sdk/index.js:604` (`_onCampaignUpdatedCore`), `:196` (`getAd` filter), `campaign.handler.js:358,707` (CAMPAIGN_UPDATED signals)
**Description**: Patch 25 fixed the SDK fast-path for `CAMPAIGN_PAUSE`/`FINISH` Maxima (`handleMdsEvent:1139–1143`). But `_onCampaignUpdatedCore` requires `parsed.status` to be present (`:605` returns early if absent). Several SW signal sites fire `CAMPAIGN_UPDATED` **without** `status`:
- `processEscrowCoin` budget-sync (`campaign.handler.js:312,333`) — `signalFE("CAMPAIGN_UPDATED", { campaign_id })` — no status.
- `_signalCampaignUpdated` (`channel.handler.js:353`) includes status, OK.
When a campaign is paused on-chain and the viewer discovers it via budget-sync path first, the cache isn't invalidated. More importantly, `getAd`'s filter (`sdk/index.js:194`) keys `_livenessCache[c.ID]` by the raw campaign ID, while `_onCampaignUpdatedCore` keys by `parsed.campaign_id` — if these ever differ in case the cache entry never matches. Campaign IDs are UUIDs (consistent case) so low real risk, but the pattern violates the "always UPPER() both sides" rule (fragility #12) for an in-memory map used as a security filter.
**Fix**: In `_onCampaignUpdatedCore`, when `status` is absent, still invalidate (set `alive` unknown → force re-check) or look it up. Normalize `_livenessCache` keys to `.toUpperCase()` on both write and read.

**Issue**: FE `_autoSettleOpenChannels` and SW `checkOpenChannelsSettled` can double-post / race on finish
**Location**: `dapp/app.js:295,456`, `channel.handler.js:2321,2391`
**Description**: On `CAMPAIGN_UPDATED status='finished'`, the FE immediately runs `_autoSettleOpenChannels` → `_runSettlement` per open channel (`app.js:456`). Simultaneously the SW's `autoSettleChannelsForCampaign` marks channels `'settling'` and `checkOpenChannelsSettled` runs on NEWBLOCK. `_runSettlement` guards on `STATUS='open'` (`earnings.js:535`), so if the SW already flipped to `'settling'` the FE aborts — good. But the CAMPAIGN_UPDATED signal from the creator's status-tx (`finalizeStatusUpdate:1662`) fires on the **creator** node, where `_autoSettleOpenChannels` also runs; the creator can't co-sign (needs viewer), so `_runSettlement` will `txnimport`+`txnsign` with the creator's `VIEWER_WALLET_PK_<campaignId>` keypair which doesn't exist → falls back to `signKey = viewerKey` (`earnings.js:558`) → `txnsign` fails harmlessly. Noisy but not corrupting. The real gap: there's no dedup between the SW-driven settle-request and the viewer FE settle; both rely on the `STATUS='open'` gate + the 60 s grace. Under the grace window a just-opened channel that finishes immediately can be settled with a stale/empty `LATEST_TX_HEX`.
**Fix**: Have `_autoSettleOpenChannels` skip role='publisher' rows and skip when `LATEST_TX_HEX===''` (partially done), and only run on the viewer node (check `MY_ADDRESS !== campaign.CREATOR_ADDRESS`).

### MEDIUM

**Issue**: `selectAd` `MAX_CAMPAIGNS_PER_SESSION` limit documented but not enforced anywhere
**Location**: `core/selection.js` (entire), `sdk/index.js:187` `getAd`
**Description**: MinimaAds.md §5.1 and §13.2 state `getAd` "Respects MAX_CAMPAIGNS_PER_SESSION" and selection.js enforces a session cap of 10. The Closed-issue SEL-1 removed the `_sessionCampaignCount` counter (it was permanently blocking ads). The result is the cap is now **entirely absent** — only `_seenCampaignIds` rotation remains. This is an intentional fix but the spec (§5.1, §13.2) still claims the limit is enforced by `selection.js`. Documentation/behaviour drift.
**Fix**: Update MinimaAds.md §5.1 and §13.2 to reflect that `MAX_CAMPAIGNS_PER_SESSION` is no longer enforced (or re-implement as a soft rotation limit). Currently it's a dead LIMITS constant.

**Issue**: `updateBudget` clamps to 0 then flips to 'finished' — but channel viewer rewards skip `updateBudget` (M-4 fix), so `budget_remaining` only tracks on-chain sync; a campaign can serve ads with 0 real escrow
**Location**: `core/rewards.js:65–71`, `core/campaigns.js:120`
**Description**: The M-4 fix (rewards.js:65) makes `view`/`click` rewards **not** decrement local budget (relies on `processEscrowCoin` on-chain sync). But `comms.handler.js:125,173` (`handleTrackView`/`handleTrackClick`) **do** call `updateBudget(campaignId, amount)` directly, decrementing budget and potentially flipping to 'finished'. So two code paths disagree: the SDK/rewards.js path leaves budget to on-chain sync; the comms cross-dapp path debits locally. On a node acting as both viewer and ad-server this produces inconsistent `BUDGET_REMAINING` and can prematurely finish a campaign (the exact bug M-4 was meant to prevent) whenever the comms path is used.
**Fix**: Align `comms.handler.js` view/click with the M-4 decision — skip local `updateBudget` for view/click and rely on on-chain sync, or document why the comms path differs.

**Issue**: `checkExpiredCampaigns` finishes campaigns by `EXPIRES_AT` in **ms** but escrow expiry is in **blocks** — no cross-check, and expiry only enforced on the local node
**Location**: `campaign.handler.js:737`, escrow `STATE(2)=expiry_block`
**Description**: `checkExpiredCampaigns` compares `EXPIRES_AT < Date.now()` (unix ms). But campaign duration is fundamentally block-based (`CAMPAIGN_DURATION_BLOCKS`, escrow `PREVSTATE(2)`). `EXPIRES_AT` is derived at creation from a ms estimate. Clock skew or block-time variance means a campaign can be marked 'finished' locally while its escrow is still live on-chain (or vice-versa). Since 'finished' is terminal (fragility #46) and never reverts, an early ms-based expiry permanently kills a still-funded campaign on that node.
**Fix**: Drive expiry from block height (compare current block to escrow `PREVSTATE(2)`), not wall-clock ms.

**Issue**: `_generateRewardId` and inline eventId generation use `Date.now()+Math.random()` — collision-prone under burst
**Location**: `core/rewards.js:6`, `comms.handler.js:124,172`, `app.js:77`
**Description**: `Date.now().toString(16) + '-' + Math.floor(Math.random()*0xFFFFFFFF)` — within the same ms two events can collide (32-bit random). A collision causes `isDuplicate` to reject the second legitimate reward (silent loss). Low probability, but the IDs are the dedup primary key.
**Fix**: Add a monotonic counter or use a larger random space.

---

## CATEGORY: Platform Constraints

### MEDIUM

**Issue**: `handleCampaignAnnounce` queries coin with `relevant:false` — hits Minima platform bug #28
**Location**: `campaign.handler.js:73` `MDS.cmd("coins coinid:" + coinId + " relevant:false", ...)`
**Description**: Fragility #28 (documented, verified in source): `coins relevant:false` is treated as `relevant:true` by Minima because the flag is a presence check. So this PREVSTATE(5) verification query runs against `getRelevantCoins()` (wallet-filtered), not the full UTXO set. For a viewer verifying a **remote creator's** escrow coin, that coin is not in the viewer's relevant set → the query returns empty → the code takes the "coin not found, accepting" branch (`:74–77`) and **skips PREVSTATE(5) fee validation entirely**. The on-chain fee enforcement (§4.6) is silently bypassed for exactly the cross-node case it's meant to protect. (MVP `PLATFORM_KEY=null` masks this today, but it's a latent mainnet break.)
**Fix**: Omit `relevant:` entirely (per fragility #28) so `getAllCoins()` is used: `MDS.cmd("coins coinid:" + coinId, ...)`.

### LOW

**Issue**: FE `initFEFrames` schema omits `PUBLISHER_MX` column present in SW schema — DB parity break (fragility #11)
**Location**: `dapp/app.js:2001` vs `db-init.js:71`
**Description**: SW `FRAMES` has `PUBLISHER_MX VARCHAR(512)` (`db-init.js:75`, added via migration `:160`). FE `initFEFrames` (`app.js:2002`) creates FRAMES **without** `PUBLISHER_MX` and has no `ADD COLUMN IF NOT EXISTS` migration for it. Since both runtimes `CREATE TABLE IF NOT EXISTS` against the same H2 DB, whichever runs first wins; if the FE runs first the SW's `saveFrame`/`listFrames` reference `PUBLISHER_MX` (`core/frames.js:7,31,39`) against a table lacking the column → silent SELECT/INSERT failure (fragility #11). In practice the SW usually inits first (DB_READY gates the FE), but the ordering is not guaranteed on a fresh install.
**Fix**: Add `PUBLISHER_MX` to `initFEFrames` (and an `ADD COLUMN IF NOT EXISTS` migration) to match the SW schema.

**Issue**: `db-init.js` uses a raw `ALTER TABLE ... ALTER COLUMN` (not `IF NOT EXISTS`) that violates the dev-workflow rule and can error on some H2 states
**Location**: `db-init.js:138,159`
**Description**: `ALTER TABLE REWARD_EVENTS ALTER COLUMN PUBLISHER_ID VARCHAR(512)` and `ALTER TABLE CHANNEL_STATE ALTER COLUMN VIEWER_KEY VARCHAR(512) NOT NULL` run unconditionally each init. KNOWN_ISSUES §4 says never add ALTER migrations during dev. These are idempotent-ish but the `NOT NULL` re-assertion can throw if any NULL row exists. Errors here `return` early and abort the rest of the init chain silently.
**Fix**: Guard or fold into the CREATE TABLE definitions (DB resets on reinstall per §4).

---

## CATEGORY: Integration Consistency

### MEDIUM

**Issue**: Legacy `DO_*` SW→FE signals removed but FE handlers (`handleDoChannelOpen`, `handleDoRewardVoucher`, `handleDoPublisherChannelOpen`, `buildAndPostChannelTx`, etc.) remain as ~700 lines of dead code
**Location**: `dapp/app.js:612–1418`; dispatcher at `:330–340` explicitly warns these are legacy and "no longer emitted"
**Description**: The entire creator-side FE channel-building path (`handleDoChannelOpen`, `finalizeChannelSplit`, `buildAndPostChannelOpenTx`, `handleDoRewardVoucher`, `handleDoPublisherRewardVoucher`, `handleDoSendVoucher`, `handleDoResendChannelOpen`) is dead — channel TX building moved to the SW (`swBuildAndPostChannelTx` etc.). The `handleFePending` resume paths (`channel_split_sign`, `channel_open`, `voucher_sign`) are still wired to these builders, so if a **stale** `PENDING_CHANNEL_<uid>` keypair from a pre-migration session survives a reinstall, an MDS_PENDING event could re-enter dead code with mismatched escrow-version assumptions. Primarily maintainability, but the pending-resume coupling makes it a latent regression surface.
**Fix**: Delete the dead `DO_*` builders and their `handleFePending` branches, keeping only `settlement`/`settlement_post`/`status_update_*` which are live.

**Issue**: `AUTO_SETTLE` signal documented (§8.15) and handled (`app.js:356 onAutoSettle`) but never emitted by any SW code
**Location**: MinimaAds.md §6.7/§8.15, `app.js:356`
**Description**: §6.7 describes an automatic `signalFE('AUTO_SETTLE', …)` trigger; the FE has `onAutoSettle`. Grep shows no `signalFE("AUTO_SETTLE"` anywhere — the mechanism was superseded by `CAMPAIGN_AUTOSETTLE_REQUEST` (patch 23) + viewer `_autoSettleOpenChannels`. Dead signal in the spec and FE.
**Fix**: Remove `AUTO_SETTLE` from §8.15 and `app.js`, or document it as deprecated.

### LOW

**Issue**: `signalFE` (SW, `core/minima.js:323`) spreads data at root; FE `_handleEscrowInfoResponse` reads `parsed.data.*` (nested) — but this path is dead anyway
**Location**: `core/minima.js:332` vs `app.js:509`
**Description**: Consistent with fragility #32 (root-level spread). `_handleEscrowInfoResponse` expects `parsed.data` nested, which matches the Maxima-payload shape — but as noted above that response never reaches the FE. Non-issue only because the path is dead.

---

## CATEGORY: Maintenance / Observability

### MEDIUM

**Issue**: Silent-failure surface: viewer voucher loss (CRITICAL #1) produces no user-visible error and no monitoring signal
**Location**: `channel.handler.js:715` and settlement path generally
**Description**: If `LATEST_TX_HEX` is clobbered or a voucher is dropped, the viewer simply never receives earnings; there's no reconciliation alarm. `VOUCHER_SYNC_REQUEST` exists (§6.8, SDK `_onReconnect:783`) but only fires when `LATEST_TX_HEX===''`, not when it's been overwritten with garbage. A viewer whose voucher was maliciously overwritten with a well-formed-but-invalid hex will never self-heal.
**Fix**: On settlement `txnimport`/`txnpost` failure (`earnings.js:562,616`), trigger a `VOUCHER_SYNC_REQUEST` to recover the authoritative voucher from the creator rather than just showing "Settlement failed."

### LOW

**Issue**: `LIMITS` mismatch across the three definitions (spec vs service.js vs app.js)
**Location**: MinimaAds.md §5 (`MIN_REWARD_CLICK: 0.001`), `service.js:16` (`0.005`), `app.js:18` (`0.005`)
**Description**: Spec says `MIN_REWARD_CLICK: 0.001` and `MIN_PUBLISHER_REWARD_VIEW: 0.01`; both runtimes use `MIN_REWARD_CLICK: 0.005` and `MIN_PUBLISHER_REWARD_VIEW: 0.001`. Also `service.js` adds `MAX_CHANNEL_RESERVATION` and `SETTLEMENT_GRACE_DAYS` not in the spec's LIMITS block. Not a security issue, but the spec is designated HIGHEST authority (CLAUDE.md §3) and is now out of sync — an agent trusting the spec would use wrong floors.
**Fix**: Reconcile MinimaAds.md §5 with the actual runtime LIMITS.

---

## Summary of Findings by Priority

| # | Sev | One-liner | File | Category |
|---|-----|-----------|------|----------|
| 1 | **CRITICAL** | Unauthenticated handlers accept remote voucher/channel tampering → balance loss | `channel.handler.js:361,865` | Security |
| 2 | HIGH | Voucher-receipt path inflates TOTAL_EARNED on replay (no isDuplicate) | `channel.handler.js:796` | Security |
| 3 | HIGH | Spoofable CAMPAIGN_FINISH forces premature settlement on V1/V2 campaigns | `campaign.handler.js:183` | Security |
| 4 | HIGH | Publisher channel max_amount not capped by MAX_CHANNEL_RESERVATION | `channel.handler.js:96` | Security |
| 5 | HIGH | Patch-25 cache invalidation gap: status-less CAMPAIGN_UPDATED doesn't invalidate _livenessCache | `sdk/index.js:604,196` | Functional |
| 6 | MEDIUM | On-chain fee validation silently skipped via relevant:false bug #28 | `campaign.handler.js:73` | Platform |
| 7 | MEDIUM | comms.handler.js view/click debits budget, contradicting M-4 fix → premature 'finished' | `comms.handler.js:125,173` | Functional |
| 8 | MEDIUM | Expiry compared in ms vs block-based escrow; terminal 'finished' can kill funded campaigns | `campaign.handler.js:737` | Functional |
| 9 | MEDIUM | ~700 lines dead DO_* FE builders still wired to MDS_PENDING resume | `dapp/app.js:612–1418` | Integration |
| 10 | MEDIUM | ESCROW_INFO round-trip is dead path (no dispatcher case / no signalFE) | `maxima.handler.js` / `app.js:415` | Integration |
| 11 | MEDIUM | handleVoucherSyncRequest unauthenticated → DoS amplifier | `channel.handler.js:891` | Security |
| 12 | MEDIUM | FE auto-settle can race with SW settle; dedup gap under grace window | `dapp/app.js:295,456` | Functional |
| 13 | MEDIUM | MAX_CAMPAIGNS_PER_SESSION enforced via config but documented as code logic | `sdk/index.js:187`, spec §5.1 | Maintenance |
| 14 | MEDIUM | PUBLISHER_MX missing in FE FRAMES init → DB parity break | `dapp/app.js:2001` | Platform |
| 15 | MEDIUM | Silent-failure surface: voucher loss produces no monitoring signal | `channel.handler.js:715` | Maintenance |
| 16 | LOW | LIMITS mismatch between spec and code | MinimaAds.md vs service.js/app.js | Maintenance |
| 17 | LOW | AUTO_SETTLE signal documented but never emitted | MinimaAds.md §6.7, app.js:356 | Integration |
| 18 | LOW | _generateRewardId collision-prone under burst (32-bit random) | `core/rewards.js:6` | Functional |
| 19 | LOW | _maxDelivered logs full Maxima response (keys included) | `core/rewards.js:148` | Security |
| 20 | LOW | db-init.js ALTERs run unconditionally; can error and abort init | `db-init.js:138,159` | Platform |

---

## Positive Notes

- `renderer/renderAd.js` sanitization is thorough (colors, positions, URLs, image data-URI allowlist, `ALLOWED_TAGS:[]`); XSS-1 (icon tracking pixel) confirmed fixed in `viewer.js:181,581`.
- `escapeSql` coverage on user-input SQL is consistent.
- `isHexKey`/`isMaximaRoute` guards are correctly applied on the `sendMaxima` and register-permanent paths.
- The `_numF`/`_numI` coercion in `saveCampaign` correctly closes the B-1 SQL-injection vector on remote campaign payloads.
- Fragility #38 (`0[xX]` case sensitivity) is correctly handled in `isHexKey`.
- Overall audit complexity: project has matured through 25 patches with good root-cause discipline; findings are incremental improvements, not fundamental architectural issues.

---

## Next Steps

Awaiting implementation plan concretization from Fable (agent context preserved) to specify:
- Which fixes are blocking vs. independent
- Which agent capability (Haiku/Sonnet/Opus) for each issue
- Effort estimate per fix
- Dependency graph
