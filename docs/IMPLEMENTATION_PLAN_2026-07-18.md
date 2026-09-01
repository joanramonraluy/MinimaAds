# Implementation Plan — MinimaAds Audit Fixes (2026-07-18)

Source audit: `/home/joanramon/Minima/MinimaAds/docs/AUDIT_2026-07-18_FABLE.md`

Verified against live code: dispatcher call sites (`maxima.handler.js:41–67`), handler signatures (`channel.handler.js:19,361,556,715,865,891`), LIMITS (`service.js:13–24`, `dapp/app.js:15–20`).

---

## Phase 1: CRITICAL/HIGH Security

**Goal**: Close the unauthenticated-handler vector (remote voucher destruction, balance inflation, spoofed finish, budget-cap bypass). This phase restores the trust boundary that N2-4 partially built.

### Fix #1: Authenticate `CHANNEL_OPEN` / `REWARD_VOUCHER` handlers + monotonic cumulative

**Complexity**: HIGH
**Recommended agent**: Opus (security-critical, multi-handler, protocol trust boundary — CLAUDE.md §2 "complex reasoning across layers")
**Blocking**: YES — blocks #2, #11 (same file/function region, same auth pattern), and #15 (recovery path assumes authenticated sync)
**Files**: `public/service-workers/handlers/maxima.handler.js`, `public/service-workers/handlers/channel.handler.js`

**Implementation steps**:
1. In `maxima.handler.js` dispatcher, pass sender to the two unauthenticated handlers (mirroring lines 41/45 which already do this):
   ```javascript
   handleChannelOpen(payload, msg.data.from || '');       // line 43
   handleRewardVoucher(payload, msg.data.from || '');     // line 49
   ```
2. Change signatures: `function handleChannelOpen(payload, senderPk)` (`:361`), `function handleRewardVoucher(payload, senderPk)` (`:865`). Thread `senderPk` through to `_continueRewardVoucher` (`:715`) — add it as a parameter (Rhino: no default params, `var` only).
3. In `handleRewardVoucher`, before any DB write, load the channel row and enforce (mirror the guard at `_handleRewardRequestInner:578–581`):
   ```javascript
   // Viewer side: voucher must come from the creator route stored on the channel
   var _creatorPk = (channel.CREATOR_MX || '');
   if (_creatorPk !== '' && _creatorPk.toUpperCase() !== (senderPk || '').toUpperCase()) {
     MDS.log("[CHANNEL] REWARD_VOUCHER rejected: sender != CREATOR_MX. campaign: " + campaignId);
     return;
   }
   ```
   Fail-open when the stored route is empty (pre-guard channels), exactly like the N2-4 guard. Public key comparison MUST use `.toUpperCase()` both sides (CLAUDE.md §6, fragility #38).
4. In `handleChannelOpen`, same guard: reject if `senderPk` doesn't match the expected creator route for that campaign (from `CAMPAIGNS.CREATOR_MX`, fallback fail-open when empty). This prevents fake `channel_coinid` MERGE-overwrite of a healthy channel.
5. In `_continueRewardVoucher`, add monotonicity check **before** `updateChannelVoucher` overwrites `LATEST_TX_HEX`:
   ```javascript
   if (Number(cumulative) < Number(oldCumulative)) {
     MDS.log("[CHANNEL] REWARD_VOUCHER rejected: non-monotonic cumulative (" + cumulative + " < " + oldCumulative + ")");
     return;
   }
   ```
   (`oldCumulative` is already a parameter at `:715`.)
6. Creator-side branch: reject vouchers/opens that would reset `CUMULATIVE_EARNED` downward (protects the `SUM(CUMULATIVE_EARNED)` publisher-budget cap at `:88, :666, :1542`).
7. SW code rules: `var`, `function()`, string concat, `MDS.log` only, no trailing commas (CLAUDE.md §7).

**Dependencies**: none — first fix to land.
**Risk**: Fail-open on empty stored routes means legacy channels keep working; test that a normal viewer→creator voucher round-trip still credits earnings (open #viewer, watch an ad, verify voucher arrives and `LATEST_TX_HEX` updates). Then simulate the attack: send a crafted `REWARD_VOUCHER` from a third node — must be rejected with the log line, `LATEST_TX_HEX` unchanged.
**Effort**: 2–3 hours

---

### Fix #2: `isDuplicate` guard on the voucher-receipt viewer path

**Complexity**: MEDIUM
**Recommended agent**: Opus (bundle with #1 — same function region in `channel.handler.js:796–860`; a separate agent would conflict)
**Blocking**: no
**Files**: `public/service-workers/handlers/channel.handler.js`

**Implementation steps**:
1. In the viewer branch of `_continueRewardVoucher` (`:796–860`), before the `MERGE INTO REWARD_EVENTS` + `USER_PROFILE.TOTAL_EARNED = TOTAL_EARNED + delta` writes, call `isDuplicate(eventId, cb)` (contract in CLAUDE.md §5, implementation pattern in `core/rewards.js:22`).
2. If duplicate → log `"[CHANNEL] REWARD_VOUCHER duplicate event, skipping profile update: " + eventId` and return **without** touching `USER_PROFILE`.
3. If not duplicate → insert into `DEDUP_LOG` (same pattern `createRewardEvent` uses) then perform the existing writes.
4. Note Rhino closure hazard: keep the callback chain self-contained inside channel.handler.js (memory: cross-file closures inside `MDS.sql` chains silently fail).

**Dependencies**: #1 (same file, same function — implement in the same session, after the auth guard).
**Risk**: If `isDuplicate`/DEDUP_LOG usage differs between SW and core runtimes, verify table name and escaping (`escapeSql(eventId)`). Test: deliver the same voucher twice (re-send from creator devtools) → `TOTAL_EARNED` increments exactly once.
**Effort**: 45 min (incremental on #1)

---

### Fix #11: Authenticate `handleVoucherSyncRequest`

**Complexity**: LOW–MEDIUM
**Recommended agent**: Opus (bundle with #1 — same file, identical auth pattern; ~15 lines)
**Blocking**: soft-blocks #15 (the recovery flow in Phase 4 re-uses this endpoint; auth must not reject the legitimate viewer)
**Files**: `public/service-workers/handlers/maxima.handler.js` (pass `msg.data.from` at `:51`), `public/service-workers/handlers/channel.handler.js:891`

**Implementation steps**:
1. Dispatcher: `handleVoucherSyncRequest(payload, msg.data.from || '');`
2. In the handler, after loading the channel: reject if `(channel.OPENER_MX_PK || '') !== ''` and `senderPk.toUpperCase() !== channel.OPENER_MX_PK.toUpperCase()`. Fail-open on empty, same as #1.
3. Verify the legitimate requester path: the viewer SDK `_onReconnect` (`sdk/index.js:783`) sends from the viewer node, so `msg.data.from` will be the viewer's Maxima PK == `OPENER_MX_PK`. Confirm this holds for publisher-role channels too (viewer_key is the publisher's PK there).

**Dependencies**: #1 (same session).
**Risk**: If `OPENER_MX_PK` was stored with different casing, legit syncs would be rejected — the `.toUpperCase()` on both sides covers it. Test: restart viewer node with `LATEST_TX_HEX=''` → sync still recovers the voucher; third-node request → rejected.
**Effort**: 30 min (incremental on #1)

---

### Fix #4: Apply `MAX_CHANNEL_RESERVATION` to publisher channel opens

**Complexity**: LOW–MEDIUM
**Recommended agent**: Sonnet (one file, <20 lines, but budget logic)
**Blocking**: no
**Files**: `public/service-workers/handlers/channel.handler.js:96–104`

**Implementation steps**:
1. In `handleChannelOpenRequest` publisher branch, after computing `effectiveCap = min(maxAmount, pubRemaining)`, additionally clamp:
   ```javascript
   if (effectiveCap > LIMITS.MAX_CHANNEL_RESERVATION) {
     effectiveCap = LIMITS.MAX_CHANNEL_RESERVATION;
   }
   ```
   `LIMITS.MAX_CHANNEL_RESERVATION` is defined at `service.js:21` (value 10) — never hardcode `10` (CLAUDE.md §6). The constant is visible to channel.handler.js the same way the viewer branch (`:230–235`) already reads it — copy that access pattern exactly.
2. Do NOT change the sender side (`_doSendPublisherChannelOpenRequest:1319` already caps to `pubView*10`); this is a receiver-side defense against hand-crafted requests.

**Dependencies**: must land **after** #1 merges (same file — serialize to avoid conflicts; logic itself is independent).
**Risk**: A legitimate high-volume publisher now needs multiple sequential channels; that matches viewer behavior, acceptable. Test: publisher CHANNEL_OPEN_REQUEST with `max_amount = 50` → channel opens with `MAX_AMOUNT = 10`.
**Effort**: 30 min

---

### Fix #3: Spoofable CAMPAIGN_PAUSE/FINISH on V1/V2 campaigns

**Complexity**: HIGH
**Recommended agent**: Opus (protocol-level trust decision, escrow version awareness, interacts with auto-settle)
**Blocking**: no (independent file — can run **in parallel** with #1/#2/#11 since it touches `campaign.handler.js`, not `channel.handler.js`)
**Files**: `public/service-workers/handlers/campaign.handler.js:164–192` (creator check), `:592` (`applyStatusChange` → `autoSettleChannelsForCampaign`)

**Implementation steps**:
1. Chosen approach (of the two the audit offers): **do not trust the `CREATOR_ADDRESS` fallback for the FINISH fast-path**. Rationale: verifying on-chain `PREVSTATE(4)` for V1/V2 requires a coin lookup that itself hits the `relevant:false` platform bug (#6) — too fragile to be a security gate.
2. In the creator check (`:183`): when `CREATOR_MX` is empty (announce-discovered campaign, fallback path), still allow the **status update to `paused`** (recoverable, reconciled on-chain), but **skip `autoSettleChannelsForCampaign`** for `finished` — i.e., mark status but do not force-settle live channels unless the sender matched the permanent `CREATOR_MX` route.
3. Add `MDS.log("[CAMPAIGN] FINISH via fallback creator check — deferring auto-settle to on-chain confirmation")` for observability.
4. For V3 campaigns (with `STATE(7)`), keep current behavior — on-chain reconciliation reverts spoofed states.
5. Update `MinimaAds.md §8.5` to document the new rule (fast-path finish requires permanent-route sender match; fallback only changes local status).

**Dependencies**: none. Coordinate landing order with #8 (same file, Phase 3) — #3 first.
**Risk**: A legitimate creator whose permanent route was never registered will see delayed auto-settlement (falls back to viewer-initiated settlement + `CAMPAIGN_AUTOSETTLE_REQUEST` from patch 23) — acceptable degradation. Test: (a) legit finish from creator with registered route → channels settle as today; (b) crafted FINISH from third node on a V1 campaign → status may flip locally but **no** settlement is forced, and on-chain reconciliation is unaffected.
**Effort**: 2 hours

---

**Phase 1 sequencing**: #1 → #2 → #11 as one Opus session (same file, shared auth helper). #4 in a follow-up Sonnet session on the merged file. #3 in parallel (different file). Phase 1 does **not** need to fully complete before Phase 2 starts — no file overlap with Phase 2 except none.

---

## Phase 2: HIGH Functional

**Goal**: Close the patch-25 cache invalidation gap and the FE/SW settlement race. Both are viewer-experience correctness fixes.

### Fix #5: `_livenessCache` invalidation on status-less CAMPAIGN_UPDATED + key normalization

**Complexity**: MEDIUM
**Recommended agent**: Sonnet
**Blocking**: no
**Files**: `sdk/index.js:604` (`_onCampaignUpdatedCore`), `:196` (`getAd` filter); optionally `public/service-workers/handlers/campaign.handler.js:312,333` (budget-sync signals)

**Implementation steps**:
1. In `_onCampaignUpdatedCore` (`sdk/index.js:605`), when `parsed.status` is absent, **delete** the cache entry instead of returning early:
   ```javascript
   var key = String(parsed.campaign_id || '').toUpperCase();
   if (!parsed.status) { delete _livenessCache[key]; return; }   // force re-check on next getAd
   ```
2. Normalize ALL `_livenessCache` reads/writes to `.toUpperCase()` keys — audit lists write at `:604` region and read at `:194/:196`. Grep `_livenessCache` for every touch point and normalize each (fragility #12 pattern applied to the in-memory map).
3. Optionally (preferred, belt-and-suspenders): in `campaign.handler.js:312,333` (`processEscrowCoin` budget-sync), include the current `status` in the `signalFE("CAMPAIGN_UPDATED", {...})` payload — the row is already loaded at those sites. This makes the signal self-sufficient. Note: touches `campaign.handler.js`, so land after #3.
4. SDK file is FE-context JS — modern syntax allowed there; the SW change in step 3 must use Rhino-safe syntax.

**Dependencies**: none hard; step 3 serializes behind #3 (same file).
**Risk**: Deleting a cache entry means the next `getAd` re-checks liveness — slight extra latency, no correctness risk. Test: pause a campaign on-chain, let budget-sync fire first (no Maxima PAUSE), then call `getAd` → paused campaign must not be served.
**Effort**: 1–1.5 hours

---

### Fix #12: FE/SW auto-settle race + creator-node noise

**Complexity**: MEDIUM
**Recommended agent**: Sonnet
**Blocking**: YES — blocks #9 (same file `dapp/app.js`; land live-logic changes before the dead-code deletion to keep diffs reviewable)
**Files**: `dapp/app.js:295,456` (`_autoSettleOpenChannels`), reference `dapp/views/earnings.js:535,558` (no change needed there)

**Implementation steps**:
1. In `_autoSettleOpenChannels`, add three skip conditions per audit recommendation:
   - skip rows where `ROLE === 'publisher'` (H2 row keys UPPERCASE — `row.ROLE`, CLAUDE.md §7);
   - skip rows where `(row.LATEST_TX_HEX || '') === ''` (nothing to settle; complete the "partially done" guard);
   - skip entirely when this node is the campaign creator: compare `MY_ADDRESS` vs campaign `CREATOR_ADDRESS` with `.toUpperCase()` on both sides.
2. Keep the existing `STATUS='open'` gate in `_runSettlement` (`earnings.js:535`) as the second line of defense — do not touch it.
3. H2 BOOLEAN/string caveats: `LATEST_TX_HEX` is VARCHAR, straightforward; but check status strings with the exact stored casing.

**Dependencies**: none from Phase 1.
**Risk**: If `MY_ADDRESS`/`CREATOR_ADDRESS` semantics differ (wallet address vs Maxima PK), the creator-skip could mis-fire — verify what `CREATOR_ADDRESS` holds for self-created campaigns before comparing (audit note: for CHANNEL comms it's the Maxima PK; for self-created rows it's set at creation). If ambiguous, fall back to "skip when `VIEWER_WALLET_PK_<campaignId>` local keypair is absent". Test: finish a campaign on the creator node → no failed `txnsign` noise in console; finish on viewer node → settlement still runs.
**Effort**: 1–1.5 hours

**Phase 2 parallelism**: #5 and #12 touch different files — **fully parallel**.

---

## Phase 3: MEDIUM Platform / Integration

**Goal**: Fix latent platform-bug bypasses, budget-accounting contradiction, expiry model, and remove dead code that is a regression surface.

### Fix #6: `relevant:false` bypasses PREVSTATE(5) fee validation

**Complexity**: LOW
**Recommended agent**: Haiku (one-line string change, no logic)
**Blocking**: no
**Files**: `public/service-workers/handlers/campaign.handler.js:73`

**Implementation steps**:
1. Change `MDS.cmd("coins coinid:" + coinId + " relevant:false", ...)` → `MDS.cmd("coins coinid:" + coinId, ...)` (per fragility #28: the flag is a presence check; omitting it yields `getAllCoins()`).
2. Do NOT change the "coin not found, accepting" branch semantics — with the flag removed, a remote creator's escrow coin is now actually found and PREVSTATE(5) validation actually runs.

**Dependencies**: land after #3 (same file). Independent otherwise.
**Risk**: Campaigns that previously slid through the "not found" branch will now be **validated** — a malformed legacy announce could start being rejected. That is the intended behavior (MVP `PLATFORM_KEY=null` masks fee enforcement today anyway). Test: announce a campaign from node A, receive on node B → log shows the PREVSTATE(5) check executing, campaign accepted.
**Effort**: 15 min

---

### Fix #7: `comms.handler.js` view/click contradicts M-4 (double budget accounting)

**Complexity**: MEDIUM
**Recommended agent**: Sonnet
**Blocking**: no
**Files**: `public/service-workers/handlers/comms.handler.js:125,173` (`handleTrackView`/`handleTrackClick`)

**Implementation steps**:
1. Align with the M-4 decision (`core/rewards.js:65–71`): remove the direct `updateBudget(campaignId, amount, cb)` calls from `handleTrackView` and `handleTrackClick`. Budget truth comes from `processEscrowCoin` on-chain sync.
2. Keep the reward-event creation and validation logic intact — only the local budget debit goes.
3. Add a comment referencing M-4 so a future agent doesn't "fix" it back:
   ```javascript
   // M-4: do NOT debit local budget here. BUDGET_REMAINING is synced from the
   // on-chain escrow coin by processEscrowCoin. See docs/AUDIT_2026-07-18_FABLE.md #7.
   ```
4. Rhino-safe syntax throughout.

**Dependencies**: none.
**Risk**: Removing the local debit means a burst of cross-dapp views can transiently overserve until the next on-chain sync — this is exactly the accepted M-4 trade-off; per-user caps (cooldown, daily) still bound it. Test: track a view via the comms path → reward event created, `BUDGET_REMAINING` unchanged until next NEWBLOCK escrow sync; campaign no longer flips to 'finished' prematurely.
**Effort**: 1 hour

---

### Fix #8: Block-based expiry instead of wall-clock ms

**Complexity**: MEDIUM–HIGH
**Recommended agent**: Sonnet (single layer, but flag to maintainer: if a DB schema change is needed in both runtimes it edges HIGH — keep the design lookup-based to avoid that)
**Blocking**: no
**Files**: `public/service-workers/handlers/campaign.handler.js:737` (`checkExpiredCampaigns`)

**Implementation steps**:
1. **Chosen approach: no schema change.** In `checkExpiredCampaigns` (runs on NEWBLOCK, so current block height is available in the event), for campaigns with a known `ESCROW_COINID`: look up the escrow coin (post-#6, without `relevant:`) and read expiry from `PREVSTATE(2)`/state port 2; mark 'finished' only when `currentBlock >= expiryBlock`.
2. For campaigns where the escrow coin is unspendable/missing (already settled or reclaimed), keep the ms comparison as fallback, but add a safety margin: `EXPIRES_AT + 24h < Date.now()` — prevents clock-skew from prematurely killing a funded campaign (fragility #46: 'finished' is terminal).
3. Rate-limit the coin lookups: only check campaigns whose `EXPIRES_AT` is within ±48 h of now (avoid N coin lookups every block).
4. `MDS.log("[CAMPAIGN] expiry check: block " + currentBlock + " vs escrow expiry " + expiryBlock)`.

**Dependencies**: #6 (the coin lookup must not use `relevant:false` or remote escrow coins won't be found and everything falls to the ms path). Land after #3 and #6 (same file, serialize).
**Risk**: Highest-risk fix in Phase 3 — a bug here can terminally finish live campaigns. Test extensively on testnet: create a short campaign, verify it finishes at the escrow block, not before; skew the system clock ±2 h and confirm no early finish.
**Effort**: 2–3 hours

---

### Fix #9: Delete dead `DO_*` FE builders (~700 lines) + their MDS_PENDING resume branches

**Complexity**: MEDIUM (large but subtractive)
**Recommended agent**: Sonnet
**Blocking**: no (but must land **after** #12 — same file)
**Files**: `dapp/app.js:612–1418` (builders), `:330–340` (dispatcher legacy warnings), `handleFePending` branches

**Implementation steps**:
1. Delete: `handleDoChannelOpen`, `finalizeChannelSplit`, `buildAndPostChannelOpenTx`, `handleDoRewardVoucher`, `handleDoPublisherRewardVoucher`, `handleDoSendVoucher`, `handleDoResendChannelOpen`, `handleDoPublisherChannelOpen`, `buildAndPostChannelTx` and the dispatcher cases at `:330–340`.
2. In `handleFePending`, delete the `channel_split_sign`, `channel_open`, `voucher_sign` resume branches. **Keep** `settlement`, `settlement_post`, `status_update_*` (live).
3. For a stale pre-migration `PENDING_CHANNEL_<uid>` hitting the removed branches: add a default log-and-drop (`console.warn('[PENDING] legacy pending action ignored: ' + action)`) rather than silent fall-through.
4. Grep app.js and views for any remaining callers of the deleted functions before finishing — zero references must remain.
5. This is FE code — modern syntax fine; but do not refactor surviving code (CLAUDE.md §8: zero unrelated changes).

**Dependencies**: #12 (same file, land first). #10 also touches app.js — coordinate: #10's `_handleEscrowInfoResponse` (`:415`) is **kept**, not part of this deletion.
**Risk**: Deleting a function that something still calls → runtime error on that path. Mitigate with the grep in step 4 plus a manual pass through #creator (create campaign), #viewer (watch ad, get voucher), #earnings (settle) — none should touch deleted code. Test that MDS_PENDING for a live settlement still resumes.
**Effort**: 2 hours

---

### Fix #10: Wire (or kill) the ESCROW_INFO round-trip + narrow the auth gate

**Complexity**: MEDIUM
**Recommended agent**: Sonnet
**Blocking**: no
**Files**: `public/service-workers/handlers/maxima.handler.js` (dispatcher + `:162` gate), `dapp/app.js:415`, reference `dapp/views/campaigns.js:376`

**Implementation steps**:
1. **Chosen approach: wire it** (the requester UI at `campaigns.js:376` and FE handler at `app.js:415` already exist; completing the loop is less churn than removing three call sites and gives creators live escrow visibility).
2. In `maxima.handler.js` `onMaxima` dispatcher, add:
   ```javascript
   } else if (payload.type === "ESCROW_INFO_RESPONSE") {
     signalFE("ESCROW_INFO_RESPONSE", payload);
   ```
3. Shape check (audit LOW finding, `core/minima.js:332` vs `app.js:509`): `signalFE` spreads `data` at root (fragility #32), but `_handleEscrowInfoResponse` reads `parsed.data.*` nested. Since the Maxima payload itself contains a nested `data` object (`maxima.handler.js:212–216`), passing the whole `payload` through `signalFE` preserves `parsed.data.*` — verify with a live round-trip and adjust the FE reader if the spread flattens it.
4. Narrow the auth gate at `:162`: require the counterparty's channel to have `STATUS = 'open'` (add `AND UPPER(STATUS) = 'OPEN'` to the membership query) so settled/stale counterparties lose read access to live financials.
5. Rhino-safe syntax in the SW file.

**Dependencies**: none. Serialize with #6 only if both agents run simultaneously on `maxima.handler.js`… #6 is in `campaign.handler.js`, so actually no conflict. Independent.
**Risk**: Signal-shape mismatch (step 3) is the main hazard — test end-to-end: open #mycampaigns, trigger the escrow-info request, verify the FE view updates with `budget_remaining`/`escrow_left` and no console errors. Verify a settled-channel counterparty now gets the rejection log.
**Effort**: 1.5 hours

---

### Fix #14: `PUBLISHER_MX` missing from FE FRAMES schema

**Complexity**: LOW–MEDIUM
**Recommended agent**: Sonnet (schema parity across two runtimes; fragility #11 territory)
**Blocking**: no
**Files**: `dapp/app.js:2001` (`initFEFrames`); reference `public/service-workers/db-init.js:71–75,160`

**Implementation steps**:
1. Add `PUBLISHER_MX VARCHAR(512)` to the FE `CREATE TABLE IF NOT EXISTS FRAMES (...)` in `initFEFrames`, matching `db-init.js:75` column-for-column (copy the SW definition verbatim — DB parity rule, CLAUDE.md Step 3 checklist "DB changes applied in BOTH runtimes").
2. Add the matching migration after the CREATE: `ALTER TABLE FRAMES ADD COLUMN IF NOT EXISTS PUBLISHER_MX VARCHAR(512)` (mirrors `db-init.js:160`).
3. Diff both FRAMES definitions line-by-line and fix any *other* drift found while there (still in-scope: it's the same parity task).

**Dependencies**: none. Same file as #9/#12 but distant region (`:2001`) — land after them anyway to avoid rebase churn.
**Risk**: None functional (additive column). Test: fresh install where FE inits first → SW `saveFrame`/`listFrames` (`core/frames.js:7,31,39`) succeed; #frames view lists frames with publisher routes.
**Effort**: 30 min

---

### Fix #20: Unconditional `ALTER COLUMN` statements in db-init.js

**Complexity**: LOW–MEDIUM
**Recommended agent**: Sonnet
**Blocking**: no
**Files**: `public/service-workers/db-init.js:138,159`

**Implementation steps**:
1. Fold `PUBLISHER_ID VARCHAR(512)` and `VIEWER_KEY VARCHAR(512) NOT NULL` directly into the `CREATE TABLE IF NOT EXISTS` definitions (KNOWN_ISSUES §4: dev DBs reset on reinstall, so the CREATE is the source of truth).
2. Remove the two raw `ALTER TABLE ... ALTER COLUMN` statements. If the maintainer wants belt-and-suspenders for existing installs, wrap each in its own `MDS.sql` call whose error is logged (`MDS.log`) but **does not `return` early** — the audit's core complaint is that a failure silently aborts the rest of the init chain.
3. Keep all other migrations (`ADD COLUMN IF NOT EXISTS`) untouched.
4. Rhino-safe syntax; `MDS.log` prefix `[DB]`.

**Dependencies**: none. Fully parallel with everything except #14 must be consistent with it (both touch FRAMES-adjacent schema areas — trivial coordination).
**Risk**: An existing DB with a NULL `VIEWER_KEY` row would previously crash the ALTER; now init completes and the NULL row is a data issue, not an init-abort. Test: reinstall MiniDapp → `[DB]` init logs run to completion, all tables present.
**Effort**: 45 min

---

**Phase 3 parallelism**: three serial tracks — **Track A** (`campaign.handler.js`): #6 → #8. **Track B** (`app.js`): #9 → #14 (after Phase 2's #12). **Track C** (parallel): #7, #10, #20 — all independent files.

---

## Phase 4: MEDIUM/LOW Observability & Documentation

**Goal**: Self-healing for voucher loss, spec/code reconciliation, dead-signal cleanup, ID entropy, log hygiene.

### Fix #15: Voucher-loss self-healing via VOUCHER_SYNC_REQUEST on settlement failure

**Complexity**: MEDIUM
**Recommended agent**: Sonnet
**Blocking**: no
**Files**: `dapp/views/earnings.js:562,616` (settlement `txnimport`/`txnpost` failure branches); reference `sdk/index.js:783` (`_onReconnect` sync pattern)

**Implementation steps**:
1. In `_runSettlement`'s `txnimport` failure branch (`earnings.js:562`) and `txnpost` failure branch (`:616`), on failure: send a `VOUCHER_SYNC_REQUEST` to the campaign creator (reuse the exact send pattern from `sdk/index.js:783` — same payload schema, MinimaAds.md §6.8; `poll:false` mandatory, CLAUDE.md §6).
2. Update the UI message from "Settlement failed" to "Settlement failed — requesting voucher re-sync from creator. Retry in a minute." (English, per dapp-language memory).
3. Debounce: one sync request per channel per session (a module-level `Set` of `campaignId+viewerKey` keys) to avoid hammering the creator on repeated retries.
4. Memory note applies to any txnpost involved: bare `txnpost` for imported txns (patch 22) — do not alter the existing post flow, only add the failure hook.

**Dependencies**: #11 (the creator-side endpoint is now authenticated — the viewer's own request passes since sender == `OPENER_MX_PK`; verify).
**Risk**: The audit notes this heals well-formed-but-invalid overwrites only if the creator still holds the authoritative voucher — true post-#1 (garbage can no longer overwrite creator-side state). Test: corrupt `LATEST_TX_HEX` in devtools, attempt settle → failure triggers sync, voucher restored, second settle succeeds.
**Effort**: 1.5 hours

---

### Fix #16: LIMITS mismatch between spec and runtimes — **maintainer decision required**

**Complexity**: LOW (mechanically), but **CLAUDE.md §3 conflict-escalation applies**
**Recommended agent**: Haiku (after maintainer decides)
**Blocking**: no
**Files**: `MinimaAds.md §5`, possibly `service.js:16,18` + `dapp/app.js:18,20`

**Implementation steps**:
1. **STOP-first**: This is a direct spec-vs-code conflict (`MIN_REWARD_CLICK` 0.001 spec vs 0.005 code; `MIN_PUBLISHER_REWARD_VIEW` 0.01 spec vs 0.001 code). Per CLAUDE.md §3, the agent must NOT resolve unilaterally — present both values to the maintainer and ask which is correct. The economic difference is 5x/10x on reward floors.
2. Once decided: update the losing side. If spec wins → change both `service.js` and `dapp/app.js` **identically** (verified values above at `service.js:16,18` and `app.js:18,20`). If code wins → update MinimaAds.md §5.
3. Either way: add `MAX_CHANNEL_RESERVATION: 10` and `SETTLEMENT_GRACE_DAYS: 7` (from `service.js:21,24`) to the spec's LIMITS block — these exist in code but not in the spec.

**Dependencies**: maintainer answer.
**Risk**: If code changes, existing campaigns created under old floors may fail new-floor validation — check `saveCampaign` validation before shipping a floor increase. Test: create a campaign at exactly the floor value.
**Effort**: 20 min + maintainer round-trip

---

### Fix #13: `MAX_CAMPAIGNS_PER_SESSION` documentation drift

**Complexity**: LOW
**Recommended agent**: Haiku (docs only)
**Blocking**: no
**Files**: `MinimaAds.md §5.1, §13.2`

**Implementation steps**:
1. **Chosen approach: document, don't re-implement.** SEL-1 removed the counter deliberately (it permanently blocked ads); re-adding a soft limit risks re-introducing that bug for marginal benefit.
2. Update §5.1 and §13.2: state that `MAX_CAMPAIGNS_PER_SESSION` is **not currently enforced** by `selection.js` (removed in SEL-1; only `_seenCampaignIds` rotation remains) and the constant is retained in LIMITS for future use.
3. Cross-link the SEL-1 closed issue.

**Dependencies**: none. Bundle with #16's spec edit in one Haiku docs session (same file).
**Risk**: none. Verify: spec renders, no other section still claims the cap is live (grep the spec for `MAX_CAMPAIGNS_PER_SESSION`).
**Effort**: 20 min

---

### Fix #17: Remove dead `AUTO_SETTLE` signal

**Complexity**: LOW
**Recommended agent**: Haiku
**Blocking**: no
**Files**: `dapp/app.js:356` (`onAutoSettle` + its dispatcher case), `MinimaAds.md §6.7, §8.15`

**Implementation steps**:
1. Delete `onAutoSettle` and its dispatcher wiring in app.js (grep `AUTO_SETTLE` — zero SW emitters confirmed by audit).
2. Remove `AUTO_SETTLE` from the §8.15 signal table; in §6.7 replace the description with the live mechanism: `CAMPAIGN_AUTOSETTLE_REQUEST` (patch 23) + viewer `_autoSettleOpenChannels`.
3. Per CLAUDE.md §4 Step 4: signal-table change → spec §8.15 must be updated (that IS this fix).

**Dependencies**: land after #9/#12 (same file app.js). Docs half can go anytime.
**Risk**: none (dead path). Verify: grep `AUTO_SETTLE` project-wide → only `CAMPAIGN_AUTOSETTLE_REQUEST` remains.
**Effort**: 20 min

---

### Fix #18: Reward-ID collision resistance

**Complexity**: LOW
**Recommended agent**: Sonnet (touches dedup primary-key generation in 3 runtimes — trivial code, but it IS logic)
**Blocking**: no
**Files**: `core/rewards.js:6` (`_generateRewardId`), `public/service-workers/handlers/comms.handler.js:124,172`, `dapp/app.js:77`

**Implementation steps**:
1. In all four generation sites, extend the ID with a module-level monotonic counter plus a second 32-bit random segment:
   ```javascript
   var _ridCounter = 0;
   function _generateRewardId() {
     _ridCounter = (_ridCounter + 1) % 0xFFFF;
     return Date.now().toString(16) + "-" + _ridCounter.toString(16) + "-" +
            Math.floor(Math.random() * 0xFFFFFFFF).toString(16) + Math.floor(Math.random() * 0xFFFFFFFF).toString(16);
   }
   ```
   Rhino-safe (`var`, concat) so the identical snippet works in SW and core.
2. Keep the format prefix-compatible (`Date.now().toString(16)-...`) — nothing parses these IDs, but don't shrink them.
3. Confirm the `REWARD_EVENTS.ID` / `DEDUP_LOG` column width (VARCHAR) accommodates the longer ID.

**Dependencies**: none. `comms.handler.js` overlaps with #7 — same file, serialize (either order).
**Risk**: minimal — IDs are opaque. Test: fire two rewards in the same ms (rapid clicks) → both credited.
**Effort**: 30 min

---

### Fix #19: `_maxDelivered` logs full Maxima response

**Complexity**: LOW
**Recommended agent**: Haiku (one-line log change)
**Blocking**: no
**Files**: `core/rewards.js:148`

**Implementation steps**:
1. Replace `JSON.stringify(res.response)` with a minimal summary: `MDS.log("[REWARDS] maxima delivery failed: delivered=" + res.response.delivered + " error=" + (res.error || ""))` — drop routing metadata.
2. Rhino-safe concat (core files run in SW context).

**Dependencies**: none.
**Risk**: slightly less debug detail on delivery failures — acceptable. Verify log line appears on a forced delivery failure (offline peer).
**Effort**: 10 min

---

## Execution Summary

| Phase | Fixes | Est. Effort | Risk | Parallel? |
|---|---|---|---|---|
| 1 | #1, #2, #11 (one Opus session) → #4; #3 parallel | 6–7 hrs | HIGH (settlement/economic paths) | PARTIAL — #3 parallel to #1-bundle; #4 serial after #1 |
| 2 | #5, #12 | 2–3 hrs | MED | YES (different files) — can start alongside Phase 1 (no file overlap) |
| 3 | #6→#8 (track A), #9→#14 (track B, after #12), #7/#10/#20 (track C) | 8–9 hrs | MED (#8 is the risky one) | YES — 3 tracks |
| 4 | #15; #16+#13 (docs, after maintainer decision); #17, #18, #19 | 3 hrs | LOW | YES — mostly independent; #15 after #11, #17 after #9 |

**Total**: ~19–22 hrs of agent work across ~8–10 sessions.

**Cross-phase dependency graph** (only hard edges):

```
#1 ─┬─> #2 ─┐
    ├─> #11 ─┴─> #15
    └─> #4            (same-file serialization)
#3 ──> #6 ──> #8      (same-file serialization; #8 needs #6 functionally)
#12 ─> #9 ─> #14, #17 (same-file serialization in app.js)
#16 ──[maintainer decision]──> #13 (bundled docs session)
#7 ⇄ #18              (comms.handler.js overlap — either order, serialize)
```

**Out-of-scope call-outs**:
- **#8** should be validated on testnet before any mainnet-facing release — it can terminally kill funded campaigns if wrong.
- **#6** re-activates fee validation that MVP `PLATFORM_KEY=null` currently masks; full verification of the PREVSTATE(5) path needs a two-node setup.
- **#16** is a spec-vs-code conflict — per CLAUDE.md §3 it cannot be resolved by an agent; maintainer must pick the correct reward floors (0.001 vs 0.005 / 0.01 vs 0.001).
- The audit's two INFO findings (renderer sanitization clean; `getUserRewards` join) require no action and are not in the 20-fix table.

---

## Next Steps

1. **Delegate first**: Fix #1+#2+#11 as a single Opus task — it is the CRITICAL finding, blocks #4 and #15, and the three changes share one auth pattern in one file. #3 (Opus) and Phase 2 (#5, #12, Sonnet) can start in parallel immediately since there is no file overlap.
2. **Commit strategy**: one commit per fix (or per bundled session, e.g. "#1+#2+#11"), pushed **only when the maintainer explicitly requests** (CLAUDE.md §6 process rules — no proactive push). Batch review per phase: Phase 1 gets its own review gate before Phase 3 touches the same files.
3. **Mainnet/testnet**: Phase 1 needs a two-node adversarial test (crafted hostile payloads) before ship; #8 needs a full campaign-lifecycle testnet run. Everything else is verifiable on a single dev node.
4. **Handoff notes**: yes — every session's handoff entry in `AGENTS.md §6` should reference this plan and the audit (`docs/AUDIT_2026-07-18_FABLE.md`) with the fix ID(s) completed, and mark the corresponding items in `docs/KNOWN_ISSUES.md`/`docs/TASKS.md`. Spec updates required along the way: §8.5 (#3), §8.15 (#17), §5 (#16), §5.1/§13.2 (#13) — per CLAUDE.md §4 Step 4.
