# MinimaAds Security & Functional Audit — 2026-09-05

**Conducted by**: Fable agent (deep comprehensive audit)
**Scope**: Full codebase at `/home/joanramon/Minima/MinimaAds` (core, SW, SDK, FE, renderer, config)
**Cross-referenced against**: `MinimaAds.md`, `docs/KNOWN_ISSUES.md` (fragility #1–52, Closed/Fixed table incl. AUD-1..5, DOC-1), `docs/archive/AUDIT_2026-07-18_FABLE.md` (all 20 prior findings re-verified)

---

## Executive Summary

**21 findings** identified across security, functional correctness, platform constraints, and integration consistency.

- **CRITICAL**: 0
- **HIGH**: 6 (unauthenticated ESCROW_INFO_RESPONSE campaign-row overwrite, STATUS-casing self-break in the same handler, unauthenticated CREATOR_LIVENESS_PONG and REWARD_REJECTED status flips, two SDK-side gaps in the AUD-1/AUD-4 hardening family)
- **MEDIUM**: 9 (publisher voucher-sync role gap, snippet renderer bypasses renderAd hardening, snippet identity-format regression vs fragility #35, SDK channel lookup without ROLE filter, publisher wallet-address mismatch, SW boot dead-ends on maxima-info failure, SDK liveness PONG drops status, publisher channel auth/fallback gaps, unauthenticated PUBLISHER_REWARD_NOTIFY)
- **LOW/INFO**: 6 (profile-request amplification, db-init migration/DB_READY race, weak-identity resume, spec drift on PONG schema, unbounded in-memory maps, cross-dapp comms trust surface)

**Strongest recommendation**: fix the ESCROW_INFO_RESPONSE pair (#1 + #2) first. #2 is a *live functional regression introduced by the fix to July's finding #10*: simply opening `#campaigns` as a viewer rewrites every remote active campaign's `STATUS` to `'ACTIVE'` (uppercase) in the local DB, after which `validateView`/`selectAd`/`checkCampaignStatuses` (all exact-lowercase matchers) treat the campaign as not active — the viewer silently stops earning and there is **no self-heal path** (`processEscrowCoin` compares lowercased on both sides, so it never rewrites the row; the liveness ping loop only selects `STATUS = 'active'` rows). #1 makes the same handler remotely abusable by any Maxima peer.

**All 20 findings from the 2026-07-18 audit are confirmed fixed** (verified in code, see §"Status of prior findings"). The new HIGH set is dominated by (a) the two message types the July sender-authentication sweep missed (`CREATOR_LIVENESS_PONG`, `REWARD_REJECTED`), and (b) SW-side fixes (AUD-3/AUD-4) that were never mirrored into the SDK's direct-MAXIMA path.

---

## CATEGORY: Security

### HIGH

**#1 — Unauthenticated `ESCROW_INFO_RESPONSE` lets any Maxima peer overwrite a campaign's budget and status in the local DB** ✅ Fixed 2026-09-05 — dispatcher now routes to `handleEscrowInfoResponse`, gated by `_assertCampaignCreatorSender` before `signalFE`. See `docs/HISTORY.md §17`, session 2026-09-05 (sender-auth class).
**Location**: `public/service-workers/handlers/maxima.handler.js:68-74` (dispatcher relay), `dapp/app.js:528-558` (`_handleEscrowInfoResponse`)
**Description**: The SW dispatcher relays every inbound `ESCROW_INFO_RESPONSE` to the FE as-is (`signalFE("ESCROW_INFO_RESPONSE", payload)`) with **no sender check whatsoever** — no verification that the sender is the campaign creator, no check that this node ever sent an `ESCROW_INFO_REQUEST` for that campaign. The FE handler then runs `UPDATE CAMPAIGNS SET BUDGET_TOTAL = …, BUDGET_REMAINING = …, MAX_PUBLISHER_BUDGET = …, PUBLISHER_BUDGET_SPENT = …, STATUS = '…' WHERE ID = <campaign_id>` straight from the payload. The request side (`handleEscrowInfoRequest`) was carefully authenticated in N2-6; the response side got nothing.
**Impact**: any peer that knows a `campaign_id` (public — it's on-chain in STATE(3)) can remotely: (a) zero out `BUDGET_REMAINING` so the viewer's local `validateView` budget floor rejects all rewards; (b) inflate `BUDGET_REMAINING` so the viewer keeps serving/tracking a drained campaign; (c) set `STATUS` to any string, killing the campaign locally (see #2 — no self-heal). Remote per-node campaign DoS and accounting poisoning, no funds at direct risk.
**Fix**: in the dispatcher (or a small handler), (1) verify `msg.data.from` against the campaign's creator identity with the same `_assertCreatorThen`-style check used for CAMPAIGN_PAUSE/FINISH, and (2) only accept responses for campaigns with an outstanding request (a short-lived `_escrowInfoRequested[campaignId]` map on the FE, mirroring `_responseSentAt`).

**#2 — `_handleEscrowInfoResponse` writes `STATUS` uppercased → legitimate responses permanently break viewer flows (regression introduced by the fix to July #10)** ✅ Fixed 2026-09-05 — status stored lowercased + whitelisted (`active|paused|finished`); STATUS column omitted from the UPDATE on any other value. See `docs/HISTORY.md §17`, session 2026-09-05 (sender-auth class).
**Location**: `dapp/app.js:541` (`(data.campaign_status || 'unknown').toUpperCase()`), triggered from `dapp/views/campaigns.js:319-345` (`_loadEscrowInfoForActiveCampaigns`, fires on every `#campaigns` render)
**Description**: The creator's response carries `campaign_status: 'active'` (lowercase, from its DB row). The FE handler uppercases it before writing: `STATUS = 'ACTIVE'`. Every status comparison in the system is exact-lowercase: `validateView`/`validateClick` (`campaign.STATUS !== 'active'`), `selectAd` (`c.STATUS === "active"`), `handleChannelOpenRequest`, `handleRewardRequest`, and the SW liveness loop `checkCampaignStatuses` (`WHERE c.STATUS = 'active'`). The `#campaigns`/`#viewer` list queries use `UPPER(c.STATUS) = 'ACTIVE'`, so the campaign **still displays** — but tapping into it yields "This campaign is no longer active" and `getAd` stops serving it. No recovery: `processEscrowCoin`'s status sync lowercases the local value before comparing (`'active' === 'active'` → no write), and the ping loop never selects the row. Also, when the responder has no data, `'unknown'` (→ `'UNKNOWN'`) overwrites a real status.
**Proof**: 2 nodes; creator with an active campaign; viewer opens `#campaigns` (mode viewer) → wait for the round-trip → `SELECT STATUS FROM CAMPAIGNS` on the viewer shows `ACTIVE` → `#viewer` detail shows "no longer active", `MA_GET_AD` returns found:false.
**Fix**: store the status lowercased (`.toLowerCase()`), whitelist it (`active|paused|finished`), and never overwrite on `'unknown'`. Consider normalizing comparisons per fragility #12 as defence in depth.

**#3 — Unauthenticated `CREATOR_LIVENESS_PONG` lets any peer flip any local campaign's status (including a de-facto permanent 'finished')** ✅ Fixed 2026-09-05 — `msg.data.from` threaded through the dispatcher; the `setCampaignStatus` write is now gated by a status whitelist + `_assertCreatorThen` (fails closed), while the FE relay stays unconditional. See `docs/HISTORY.md §17`, session 2026-09-05 (sender-auth class).
**Location**: `public/service-workers/handlers/campaign.handler.js:836-853` (`handleCreatorLivenessPong`), dispatcher `maxima.handler.js:56-57` (does not even pass `msg.data.from`)
**Description**: The handler takes `payload.campaign_id` + `payload.status` and calls `setCampaignStatus` when they differ from the local row — no sender check, no validation that `status` is one of the three known values, no check that a PING was outstanding. This is exactly the spoofing shape Fix #3/AUD-3 closed for `CAMPAIGN_PAUSE`/`CAMPAIGN_FINISH`, but the PONG path was missed by that sweep. A spoofed `status:'finished'` is effectively permanent on the victim node: `checkCampaignStatuses` only pings `STATUS='active'` campaigns (so no genuine PONG ever arrives to correct it), `getAd`/`#viewer` hide the campaign (so the SDK's on-demand ping is never triggered), and `processEscrowCoin`'s terminal-state guard (fragility #46) actively refuses to revert `finished` from on-chain reads.
**Impact**: remote, unauthenticated, permanent campaign kill on any viewer node. Unlike the AUD-3 shape it does not force settlement (it calls `setCampaignStatus`, not `applyStatusChange`), so no premature channel close — "just" a serving/earning DoS.
**Fix**: pass `msg.data.from` and require it to match the campaign creator (same two-source check as `_assertCreatorThen`); additionally whitelist `status ∈ {active, paused, finished}` and consider only honouring PONGs for campaigns with a recent outgoing PING.

**#4 — Unauthenticated `REWARD_REJECTED` — same status-flip vector plus deletion of a REWARD_EVENTS row by attacker-supplied event_id** ✅ Fixed 2026-09-05 — `msg.data.from` threaded through; the whole handler (event delete + status flip, body moved to `_handleRewardRejectedInner`) is gated by `_assertCampaignCreatorSender`. See `docs/HISTORY.md §17`, session 2026-09-05 (sender-auth class).
**Location**: `public/service-workers/handlers/channel.handler.js:580-614` (`handleRewardRejected`), dispatcher `maxima.handler.js:46-47` (no `msg.data.from` passed)
**Description**: Any peer can send `{type:'REWARD_REJECTED', campaign_id, reason:'finished'|'paused', event_id}`. The handler (1) `DELETE FROM REWARD_EVENTS WHERE ID = <event_id>` (attacker needs to know/guess the id — 128-bit random, so low practical risk, but the delete is unconditional), and (2) `setCampaignStatus(campaignId, reason)` — the same unauthenticated local status flip as #3, with the same no-heal analysis for `'finished'`.
**Fix**: thread `msg.data.from` through the dispatcher and require the sender to match the campaign creator before honouring the message (the legitimate sender is always the creator, whose identity the viewer knows). Scope the event delete to events the local node itself created for that campaign.

**#5 — SDK direct-MAXIMA path applies `CAMPAIGN_PAUSE`/`CAMPAIGN_FINISH` with no creator check (AUD-3's SW fix never mirrored)**
**Location**: `sdk/index.js:1308-1313` (`handleMdsEvent`)
**Description**: On an SDK-embedded host (no MinimaAds SW; host forwards MAXIMA events into `MinimaAds.handleMdsEvent`), `CAMPAIGN_PAUSE`/`CAMPAIGN_FINISH` call `setCampaignStatus(...)` directly — `event.data.from` is available (the same event object already passes it for CHANNEL_OPEN/REWARD_VOUCHER two lines below) but is not consulted. The SW mirror requires `_assertCreatorThen` (fails closed) and defers settlement on weak identity (AUD-3); the SDK applies the flip unconditionally. AUD-1 (2026-09-01) ported the CHANNEL_OPEN/REWARD_VOUCHER guards into the SDK but left the status messages out.
**Impact**: on SDK hosts, any Maxima peer can pause/finish any known campaign locally (no forced settlement — the SDK has no auto-settle — but serving/earning stops, and `'finished'` sticks for the same reasons as #3).
**Fix**: reuse the SDK's own `_assertCampaignCreatorSender` (already present since AUD-1) before applying either status change.

**#6 — SDK `_persistCampaignPayload` lacks the AUD-4 identity-pinning gate → creator-identity poisoning re-enables the AUD-1 attack chain on SDK hosts**
**Location**: `sdk/index.js:1087-1103` (`_persistCampaignPayload`), vs the SW gate at `campaign.handler.js:32-107`
**Description**: AUD-4 hardened the SW so a `CAMPAIGN_ANNOUNCE`/`CAMPAIGN_DATA_RESPONSE` from a non-creator cannot rewrite `CREATOR_ADDRESS`/`CREATOR_MX` on a row with an established strong identity. The SDK path calls `saveCampaign(payload.campaign, payload.ad, …)` wholesale — `saveCampaign` MERGEs `CREATOR_ADDRESS` straight from the payload. Attack chain on an SDK host: (1) send a crafted `CAMPAIGN_DATA_RESPONSE` re-pointing `creator_address` at the attacker's PK; (2) the SDK's `_assertCampaignCreatorSender` checks `CAMPAIGNS.CREATOR_ADDRESS` **first** and returns true on match — the attacker now passes the AUD-1 guard; (3) send `REWARD_VOUCHER` with `cumulative >= stored` and garbage `tx_hex` → `updateChannelVoucher` clobbers `LATEST_TX_HEX`, the host's only creator-signed settlement voucher (the monotonicity guard allows equal-or-higher). This is the exact enabling step AUD-4 closed on the SW, reopened via the SDK.
**Fix**: port the AUD-4 gate: before `saveCampaign`, resolve the stored strong identity (`parseMaximaRoute(existing.CREATOR_MX)` then keypair `CREATOR_MX_<id>`) and pin `payload.campaign.creator_address`/`creator_mx` to the stored values unless the Maxima sender matches. `handleMdsEvent` already has `event.data.from` at the call site (`sdk/index.js:1306-1307`) — it just needs to be passed down.

### MEDIUM

**#7 — Publisher channels have no working voucher-recovery path: `role` is dropped at every VOUCHER_SYNC hop**
**Location**: `dapp/views/earnings.js:548-552` (`_requestVoucherResync` — no `role` in payload), `sdk/index.js:829-833` (`_onReconnect` — no `role`, though the SELECT includes publisher rows), `public/service-workers/handlers/channel.handler.js:1011-1020` (`handleVoucherSyncRequest`'s `REWARD_VOUCHER` resend — omits `role`/`frame_id` even when the request carried `role:'publisher'`), and `MinimaAds.md §8.12` (schema has no `role` field at all)
**Description**: `handleVoucherSyncRequest` *reads* `payload.role` (defaulting `'viewer'`) to look up the channel — but no sender ever sets it, so a publisher's sync request resolves against the (nonexistent) viewer row and silently returns. Even if it resolved, the resent `REWARD_VOUCHER` omits `role`, so the receiving side would book it against the viewer row. Net effect: July Fix #15's "voucher-loss self-healing" only works for viewer channels; a publisher whose `LATEST_TX_HEX` is stale/lost can never recover it and their unsettled earnings eventually revert to the creator via the timelock.
**Fix**: add `role` (and `frame_id` on the response) at all four sites and to the §8.12 schema; the handler already branches correctly once the field arrives.

**#8 — Embedded publisher snippet re-implements the ad renderer without renderAd.js's hardening (CSS injection / beacon in the host MiniDapp)**
**Location**: `dapp/views/frames.js:255-339` (`_buildSnippet`'s inline `_render`)
**Description**: `renderer/renderAd.js` validates `bg_color`/`text_color` (`safeColor`: hex-only), `image_position` (`safePos`: enum), `cta_url` (`safeUrl`: http/https/mailto whitelist) precisely because these fields come from third-party advertisers via Maxima. The snippet's inline renderer copies the layout but **none of the validators**: `bg`, `fg`, `pos`, `zoom` are concatenated raw into `style.cssText`, and `cta_url` is only checked against `/^javascript:/i`. A malicious campaign served into a publisher's embedded frame can inject arbitrary CSS declarations (e.g. `bg_color: "#fff;background-image:url(http://attacker/beacon)"` → IP-leaking beacon in the *host MiniDapp*, the exact vector `safeColor` was added to close) and position/zoom-based `transform-origin` injection. `image_data` is correctly regex-gated; text fields use `textContent` (no XSS).
**Fix**: inline `safeColor`/`safePos`/`safeUrl` equivalents into `_buildSnippet` (the snippet must stay self-contained), or have the snippet delegate to a minimal validation block identical to renderAd.js's.

**#9 — Snippet identity regression vs fragility #35: `userAddress` is the `MAX#pk#mls` route, so local validation limits and reward history key on the wrong identity**
**Location**: `dapp/views/frames.js:384-394` (snippet `_getMxContact` constructs `MAX#pubkey#mls`; commit `ab0be02` made this deliberate for *routing*), consumed as `userAddress` in `MA_GET_AD`/`MA_TRACK_VIEW`/`MA_TRACK_CLICK` → `comms.handler.js` `validateView/validateClick`
**Description**: Fragility #35 / PUB-3 established that `userAddress` must be the raw Maxima publickey because `REWARD_EVENTS.USER_ADDRESS` rows are written with the raw PK (`viewerKey = MY_MAXIMA_PK` in `_continueRewardVoucher`). The current snippet sends the full permanent route. Consequences on the viewer node using a snippet: (a) `validateView`'s daily-view/click counters and per-campaign cooldown query `REWARD_EVENTS` by `userAddress` = `MAX#…` → always 0 rows → **local daily limits and cooldown never bind** (the server-side C-1/N2-2 checks on the creator still pace per-request delta and cooldown, and `MAX_AMOUNT` caps the channel, so the exposure is bounded but the documented limits are dead); (b) the "creator cannot earn from own campaign" check compares `CREATOR_ADDRESS` to `MAX#…` → never matches → a creator embedding a snippet can self-serve own-campaign rewards (economically ~net-zero, pays self from own escrow, but corrupts stats and burns publisher budget to themselves); (c) `getUserRewards(MAX#…)` matches 0 rows → Reward History empty for snippet viewers (the original #35 symptom, back again).
**Fix**: keep sending the route for `publisherMx`-style *routing* fields, but have the SW normalize `userAddress` on receipt: if it parses as `MAX#<pk>#<mls>`, extract and use the raw `<pk>` (via the existing `parseMaximaRoute`) for validation, dedup and identity.

**#10 — `_getMyChannel` selects by campaign only (no ROLE/viewer filter) — viewer flow can operate on the publisher row**
**Location**: `sdk/index.js:326-334`
**Description**: The comment claims the campaign-only lookup is unambiguous, but the SDK itself inserts `role='publisher'` rows for the same campaign on the same node (`_openNewPublisherChannel`). With both rows present, H2 returns an arbitrary one; `_channelFlow`/`_sendRewardRequest`/`_onVoucherReceivedCore`'s fallback `oldCumulative` read can then use the publisher row's `VIEWER_KEY`/`CUMULATIVE_EARNED` — the resulting viewer `REWARD_REQUEST` carries the publisher's key and cumulative and is rejected by the creator (`channel not found` for role viewer), silently dropping viewer rewards on any SDK host that is simultaneously a publisher for that campaign (the standard custom-frame scenario).
**Fix**: add `AND UPPER(ROLE) = 'VIEWER'` to the query (the publisher path already uses the correctly-filtered `_getPublisherChannel`).

**#11 — Custom frames store the Maxima PK as `PUBLISHER_WALLET`; the SDK opens publisher channels with it as the settlement address**
**Location**: `dapp/views/frames.js:553-561` (`publisher_wallet: MY_ADDRESS` — a Maxima DER PK, not a wallet address), consumed at `sdk/index.js:427,464` (`viewer_wallet_addr: frame.PUBLISHER_WALLET` in the publisher `CHANNEL_OPEN_REQUEST`)
**Description**: `MY_ADDRESS` in the FE is the Maxima publickey (~270 hex chars). On the SW path this doesn't matter (`handlePublisherRewardNotify` → `_doSendPublisherChannelOpenRequest` correctly calls `getaddress`, per fragility #33). But the SDK's own `_publisherChannelFlow` → `_openNewPublisherChannel` sends `frame.PUBLISHER_WALLET` as `viewer_wallet_addr`; the creator stores it in `CHANNEL_STATE.VIEWER_WALLET_ADDR` (it passes `isMaximaRoute` — that check only rejects whitespace) and `_continueSwDispatchVoucher` then builds voucher outputs `txnoutput … address:<maxima_pk>` — funds paid to a "script address" nobody can ever spend (burned) or a failing txnoutput.
**Fix**: in `_onFrameSubmit`, resolve the wallet via `getaddress` (like everywhere else) instead of `MY_ADDRESS`; defensively, `_openNewPublisherChannel` should fall back to `getaddress` when `PUBLISHER_WALLET` doesn't look like a 0x-64 wallet address.

**#12 — Publisher `CHANNEL_OPEN_REQUEST` authentication is optional for custom frames, and `_maybeGeneratePublisherVoucher`'s "any open publisher channel" fallback can misroute rewards**
**Location**: `channel.handler.js:61-67` (auth only runs `if (publisherMxKey)` — an attacker simply omits the field), `:1500-1521` (legacy path falls back to `SELECT * … ROLE='publisher' AND STATUS='open' LIMIT 1`)
**Description**: For a `builtin:` frame the frame-id/viewer-key binding is enforced, but for custom frame_ids the `publisher_mx_key === senderPk` check is skipped when the payload omits `publisher_mx_key` — any node can open a publisher channel claiming any custom `frame_id`. That alone only reserves budget (already capped by `MAX_CHANNEL_RESERVATION` since July Fix #4). It becomes reward capture when combined with the legacy fallback: when a viewer's `REWARD_REQUEST` arrives without `publisher_key` (older snippets, or `frame_id`-only paths), `_maybeGeneratePublisherVoucher` falls back to **any** open publisher channel for the campaign — including the squatter's — and pays it the publisher reward for someone else's frame.
**Fix**: require `publisher_mx_key` (or fall back to `senderPk`) and verify frame ownership for custom frames against the FRAMES row when locally known; drop the `LIMIT 1` any-channel fallback (defer instead, as the no-channel path already does).

**#13 — SW bootstrap dead-ends when `maxima action:info` fails at init ("retrying in 10s" never retries)**
**Location**: `service.js:200-206` (`_initAfterDb`)
**Description**: On failure the code logs "retrying in 10s" and returns — there is no timer (fragility #9: `MDS.cmd("timer …")` fires immediately in Rhino, so a timer was probably abandoned) and no NEWBLOCK-driven re-entry. Consequences of a single failed info call at boot (plausible right after node start, exactly when the SW inits): `MY_MAXIMA_PK`/`MY_MX_ADDRESS`/`MY_ADDRESS` stay empty, `registerEscrowScript` never runs, all ESCROW/CHANNEL addresses stay `''`, and every NEWBLOCK path silently no-ops (`_scanAddress('')` returns, `_checkChannelCoinsOnBlock` falls through with `''`). The node is a zombie for the whole session — no discovery, no channels, no settlements — with only one log line hinting why.
**Fix**: re-attempt from the NEWBLOCK handler while `MY_MAXIMA_PK === ''` (cheap guard, self-heals within ~1 block).

**#14 — SDK host path drops the PONG's `status` argument — paused/finished campaigns count as alive**
**Location**: `sdk/index.js:1325-1327` (`_onCreatorLivenessPong(payload.campaign_id || '')` — the function signature is `(campaignId, status)`)
**Description**: On the direct-MAXIMA path (SDK hosts), `status` is `undefined`, so `alive = !status || status === 'active'` → `true` for every PONG, including `status:'finished'`. The host keeps serving and tracking a finished/paused campaign until a `REWARD_REJECTED` bounce; the local status sync the SW performs (`handleCreatorLivenessPong` → `setCampaignStatus`) also has no SDK equivalent, so the local row never updates either.
**Fix**: pass `payload.status || ''` and replicate the SW's status-sync (guarded by #5's creator check).

**#15 — `handlePublisherRewardNotify` trusts the sender as the campaign creator**
**Location**: `channel.handler.js:1351-1402`, `:1420` (`targetKey = creatorKey || campaign.CREATOR_ADDRESS` where `creatorKey = senderPk`)
**Description**: No check that `senderPk` is the campaign's creator. Any peer can send `PUBLISHER_REWARD_NOTIFY` for a locally-known active campaign and the publisher node will (1) mint a wallet key, and (2) send its `CHANNEL_OPEN_REQUEST` — including `viewer_wallet_addr` and `viewer_wallet_pk` — **to the attacker** instead of the creator. The attacker cannot then complete the channel (their `CHANNEL_OPEN` fails `_assertCampaignCreatorSender`), so this is an info-leak (wallet address/PK are public-key material, low sensitivity) plus a work/spam primitive and a way to stall the real channel open (the resulting `pending` row blocks re-notify for 5 minutes).
**Fix**: validate `senderPk` against the campaign creator (strong-identity sources first), and always route the `CHANNEL_OPEN_REQUEST` to `campaign.CREATOR_ADDRESS` + stored `CREATOR_MX_<id>` route rather than the message sender.

---

## CATEGORY: Functional Correctness / Robustness

### LOW

**#16 — `initDB` fires `DB_READY`/`cb()` before the last three CHANNEL_STATE migrations complete**
**Location**: `public/service-workers/db-init.js:184-197`
**Description**: The `LAST_VOUCHER_AT` → `LAST_CLICK_VOUCHER_AT` → `OPENER_MX_PK` ALTER chain (lines 184-186) is started and then the sibling publisher-budget patch (line 191) — whose callback logs "all tables ready", signals `DB_READY`, and calls `cb()` — runs concurrently. On a fresh install there is a small window where `_initAfterDb`/first inbound messages run against a CHANNEL_STATE lacking `OPENER_MX_PK` (auth guards silently fail-open per H2 missing-column SELECT errors → `sqlQuery` error → handlers bail). Practically millisecond-scale, but it's exactly the kind of ordering bug that produces one-in-fifty flaky first boots.
**Fix**: nest the budget patch (and the completion callback) inside the `OPENER_MX_PK` migration callback.

**#17 — `handleCampaignResume` accepts weak-identity senders and resurrects terminal campaigns**
**Location**: `campaign.handler.js:254-262`
**Description**: The handler receives the `strongSender` flag but ignores it, and `applyStatusChange(id, 'active')` has no terminal-state guard — a `CAMPAIGN_RESUME` from a sender matching only the (payload-derived, for discovered campaigns) `CREATOR_ADDRESS` re-activates even a `finished` campaign, contradicting fragility #46's "finished is terminal" invariant. Limited attacker value (they must already pass the creator fallback), but inconsistent with the PAUSE/FINISH hardening.
**Fix**: refuse `finished → active` in `applyStatusChange`, and treat weak-identity RESUME like weak-identity PAUSE/FINISH (accept the local flip only, or reject).

**#18 — `handleProfileRequest` is unauthenticated and unthrottled**
**Location**: `campaign.handler.js:999-1031`
**Description**: Every `PROFILE_REQUEST` triggers `maxima action:info` + a `PROFILE_RESPONSE` send (with the full icon payload, up to tens of KB). Unlike `REQUEST_CAMPAIGN_DATA` (rate-limited per requester in `_responseSentAt`, bug #14 fix) there is no rate limit — a free traffic-amplification / node-busy primitive, same class as July #11.
**Fix**: reuse the `_responseSentAt` pattern keyed by sender PK.

---

## CATEGORY: Integration Consistency / Documentation

### LOW / INFO

**#19 — `CREATOR_LIVENESS_PONG` spec drift: §8.14 omits the `status` field the code sends and relies on** ✅ Fixed 2026-09-05 — `MinimaAds.md §8.14` JSON + prose and the §8.15 signal table now document `status` ('' | active | paused | finished). See `docs/HISTORY.md §17`, session 2026-09-05 (sender-auth class).
**Location**: `MinimaAds.md §8.14` (payload `{type, campaign_id}`), `§8.15` signal table (`{ campaign_id }`), vs `campaign.handler.js:784` (sends `status`), `:836-853` (syncs local status from it), `app.js:403-407` (forwards it), `sdk/index.js:608-623` (drives `alive` from it)
**Description**: The spec is HIGHEST authority (CLAUDE.md §3); an agent implementing from §8.14 would drop the field and silently break the SW status sync and the SDK's paused/finished detection. Update §8.14/§8.15 to include `status` ('' | active | paused | finished).

**#20 — Unbounded in-memory maps on long-lived SW/FE sessions**
**Location**: `campaign.handler.js:976` (`_responseSentAt`, keyed campaign|requester), `earnings.js:531` (`_voucherResyncRequested`), `sdk/index.js:38` (`_livenessCache`), `service.js:54` (`_knownEscrowCoins`)
**Description**: All grow monotonically per session; only DEDUP_LOG gets pruned (N2-5). Irrelevant at 6-node scale, worth a periodic sweep before mainnet.

**#21 — Cross-dapp MDSCOMMS trust surface (design note)**
**Location**: `service.js:345-364` (`onComms`), `campaign.handler.js:859-870` (`handleLocalStatusChange`), `dapp/views/devtools.js:793` (raw SQL runner)
**Description**: `MA_LOCAL_STATUS` (pause/resume/finish any local campaign, including triggering `autoSettleChannelsForCampaign`) is accepted from **any MiniDapp installed on the node** via `MDS.comms.broadcast` — the MA_* protocol is deliberately cross-dapp, but this particular message is a management command, not an integration API. A malicious/compromised co-installed MiniDapp can close campaigns and force settlements. Same trust class: the devtools view's raw SQL runner. Acceptable for MVP (local machine = trusted), should be revisited before mainnet (e.g. restrict `MA_LOCAL_STATUS` to `msg.data.minidapp === 'minimaads'` if the platform exposes the sender dapp reliably).

---

## Status of prior findings (2026-07-18 audit — all 20 verified FIXED in current code)

| Jul # | One-liner | Verified fix location |
|---|---|---|
| 1 | Unauthenticated CHANNEL_OPEN/REWARD_VOUCHER | `_assertCampaignCreatorSender` + monotonicity guard (`channel.handler.js:380,775`) |
| 2 | TOTAL_EARNED replay inflation | dedup verdict captured pre-MERGE (`channel.handler.js:798,876`) |
| 3 | Spoofable FINISH forces settlement | AUD-3/strongSender + `skipAutoSettle` (`campaign.handler.js:216-252`) |
| 4 | Publisher reservation uncapped | `MAX_CHANNEL_RESERVATION` on publisher branch (`channel.handler.js:98-102`) |
| 5 | _livenessCache invalidation/casing | `_livenessKey` + status-in-signal + delete-on-statusless (`sdk/index.js:49,629`) |
| 6 | `relevant:false` bug #28 in announce verify | bare `coins coinid:` (`campaign.handler.js:150`) |
| 7 | comms handler debits budget vs M-4 | debit removed (`comms.handler.js:139,182`) |
| 8 | ms-based expiry kills funded campaigns | block-based expiry + 24h fallback margin (`campaign.handler.js:872-969`) |
| 9 | ~700 lines dead DO_* FE builders | removed; `handleFePending` warns on legacy kinds (`app.js:961-966`) |
| 10 | ESCROW_INFO round-trip dead | dispatcher case + FE handler wired (`maxima.handler.js:68`) — **but see new #1/#2: the revived path shipped unauthenticated and with a status-casing bug** |
| 11 | VOUCHER_SYNC_REQUEST unauthenticated | OPENER_MX_PK guard (`channel.handler.js:997-1005`) |
| 12 | FE/SW settle race | AUD-5 `settling:true` gate + creator-node skip + publisher skip (`app.js:308,454-497`) |
| 13 | MAX_CAMPAIGNS_PER_SESSION doc drift | documented DEPRECATED (`MinimaAds.md:451`) |
| 14 | FE FRAMES missing PUBLISHER_MX | `initFEFrames` migration (`app.js:1091,1098`) |
| 15 | Voucher loss: no recovery signal | `_requestVoucherResync` on settle failure (`earnings.js:531-557`) — **but see new #7: role gap leaves publisher channels uncovered** |
| 16 | LIMITS spec/code mismatch | `MinimaAds.md §5` reconciled (0.005 click, full table) |
| 17 | AUTO_SETTLE dead signal | removed from spec, FE and SW (grep-clean) |
| 18 | eventId collision under burst | monotonic counter + 64-bit random in all 3 generators |
| 19 | _maxDelivered logs full response | reduced to delivered/error fields (`core/minima.js:63-74`) |
| 20 | Raw ALTER COLUMN in db-init | removed; all migrations `ADD COLUMN IF NOT EXISTS` |

---

## Summary of Findings by Priority

| # | Sev | One-liner | File | Category |
|---|-----|-----------|------|----------|
| 1 | HIGH | Unauthenticated ESCROW_INFO_RESPONSE overwrites local campaign budget/status | `maxima.handler.js:68` / `app.js:528` | Security |
| 2 | HIGH | ESCROW_INFO_RESPONSE uppercases STATUS → viewer flows self-break, no heal | `app.js:541` | Functional |
| 3 | HIGH | Unauthenticated CREATOR_LIVENESS_PONG flips local campaign status (permanent 'finished') | `campaign.handler.js:836` | Security |
| 4 | HIGH | Unauthenticated REWARD_REJECTED — status flip + event delete | `channel.handler.js:580` | Security |
| 5 | HIGH | SDK direct path applies PAUSE/FINISH with no creator check | `sdk/index.js:1308` | Security |
| 6 | HIGH | SDK missing AUD-4 identity gate → AUD-1 chain reopened on hosts | `sdk/index.js:1087` | Security |
| 7 | MEDIUM | Publisher voucher-sync drops `role` at every hop — no recovery for publisher channels | `earnings.js:548` +3 sites | Functional |
| 8 | MEDIUM | Snippet renderer bypasses safeColor/safePos/safeUrl → CSS injection in host | `frames.js:255-339` | Security |
| 9 | MEDIUM | Snippet userAddress = MAX# route → local limits dead, self-reward check bypassed, history empty (#35 regression) | `frames.js:384` / `comms.handler.js` | Functional |
| 10 | MEDIUM | `_getMyChannel` lacks ROLE filter — viewer flow can grab publisher row | `sdk/index.js:326` | Functional |
| 11 | MEDIUM | PUBLISHER_WALLET = Maxima PK used as settlement address on SDK path | `frames.js:556` / `sdk/index.js:427` | Functional |
| 12 | MEDIUM | Publisher CHANNEL_OPEN_REQUEST auth optional + any-open-channel reward fallback | `channel.handler.js:61,1500` | Security |
| 13 | MEDIUM | SW boot dead-ends if `maxima action:info` fails once ("retrying" never retries) | `service.js:200` | Robustness |
| 14 | MEDIUM | SDK host PONG path drops `status` — finished campaigns count alive | `sdk/index.js:1327` | Functional |
| 15 | MEDIUM | PUBLISHER_REWARD_NOTIFY sender trusted as creator — wallet-key leak/stall | `channel.handler.js:1351` | Security |
| 16 | LOW | DB_READY races last three CHANNEL_STATE migrations on fresh install | `db-init.js:184-197` | Platform |
| 17 | LOW | Weak-identity RESUME resurrects finished campaigns | `campaign.handler.js:254` | Security |
| 18 | LOW | PROFILE_REQUEST unauthenticated + unthrottled (amplifier) | `campaign.handler.js:999` | Security |
| 19 | LOW | §8.14/§8.15 omit the PONG `status` field the code depends on | `MinimaAds.md:1215` | Documentation |
| 20 | LOW | Unbounded in-memory maps over long sessions | multiple | Maintenance |
| 21 | INFO | Cross-dapp MA_LOCAL_STATUS / devtools SQL trust surface | `service.js:345` | Design |

---

## Positive Notes

- All 20 findings from the 2026-07-18 audit are genuinely fixed, with fixes verified in code (not just in the docs). Root-cause discipline is visible — e.g. Fix #8's block-based expiry with an explicit wall-clock fallback margin, and the AUD-4 identity-pinning design are both careful, well-commented work.
- `renderer/renderAd.js` remains the reference-quality sanitizer (the problem in #8 is that the snippet doesn't use it).
- The three eventId generators (SW comms, core rewards, SDK) all carry the counter+double-random fix with clear comments about the shared-global pitfall.
- The `_swBuildAndPostChannelTxInner` state-port carry-forward (fragility #51 fix) is complete and includes port 2 with an accurate comment trail.
- Sender authentication is now the norm, not the exception: of ~18 inbound Maxima types, only the 4 flagged above (`CREATOR_LIVENESS_PONG`, `REWARD_REJECTED`, `ESCROW_INFO_RESPONSE`, `PUBLISHER_REWARD_NOTIFY`) plus the intentionally-open discovery messages lack it. One more sweep closes the class.
- `escapeSql` coverage on user-input SQL interpolation remains consistent; no injection path found (B-1's `_numF/_numI` coercion holds on all remote-numeric paths checked).

---

## Next Steps

Findings #1–#4 are cheap, high-value fixes (one authentication helper reused four times + one `.toLowerCase()`); #2 additionally is **live-verifiable on the 6-node harness** (open `#campaigns` on a viewer, watch STATUS flip to `ACTIVE`, watch `#viewer` stop serving) and is the natural first target for the live E2E session. #5/#6/#10/#11/#14 are SDK-host-scope and can be batch-fixed in `sdk/index.js`. #7 and #9 need a small protocol/schema decision (add `role`; normalize `userAddress`) and a MinimaAds.md §8 update before code.
