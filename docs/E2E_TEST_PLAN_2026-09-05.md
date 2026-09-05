# MinimaAds Live E2E Test Plan — 2026-09-05

**Prioritized from**: `docs/AUDIT_2026-09-05_FABLE.md` (Step 1 findings) + `docs/TESTING_SETUP.md §10` (never-covered gaps).
**Harness**: 6 real nodes via MinimaNodeManager (`localhost:3000`) + Playwright, per `TESTING_SETUP.md`. Read `§11` gotchas before starting; check nodes are already up before rebuilding.

**Topology** (6 nodes; extends the standard 5-node map with a 2nd viewer for multi-viewer tests):

| Node | Role |
|---|---|
| 1 | Campaign creator (advertiser) |
| 2 | Publisher (custom Frame via SDK snippet) |
| 3 | Viewer A (built-in `#viewer`) |
| 4 | MinimaAds Creator (platform identity, built-in Frame owner) + also acts as Viewer B for multi-viewer |
| 5 | Minima Foundation (MLS relay + 3% fee) |
| 6 | Viewer C / spare — also the **attacker node** for the security repros (crafts raw Maxima sends via its MinimaNodeManager terminal textbox, per §11.3) |

Verification tooling per `TESTING_SETUP.md §9`: dapp UI (§9.1) for "does the feature work"; raw node log grep (§9.2) for "who received exactly Y MINIMA"; DevTools §4 SQL Console (§9.5) for `CAMPAIGNS`/`CHANNEL_STATE`/`REWARD_EVENTS`/`FRAMES` rows. Remember H2 returns **UPPERCASE** columns.

---

## Priority tier A — HIGH audit findings, live-verifiable

### A1 — Finding #2: `ESCROW_INFO_RESPONSE` uppercases STATUS → viewer self-break (no attacker needed)
**Why first**: pure functional regression, triggers on normal usage, no crafted message required. Highest confidence of a real reproducible bug.

**Setup**: Node 1 publishes a campaign (budget 1000, see §8 of TESTING_SETUP). Wait for it to propagate to Node 3 (`#campaigns` shows the card).

**Steps**:
1. On **Node 3**, DevTools §4 SQL Console:
   `SELECT ID, STATUS FROM CAMPAIGNS;` → record `STATUS` (expect `active`).
2. On **Node 3**, switch to **Viewer** mode, open `#campaigns` (this fires `_loadEscrowInfoForActiveCampaigns` → `ESCROW_INFO_REQUEST` to Node 1 → Node 1 responds with `campaign_status:'active'`).
3. Wait ~5s (Maxima round-trip + `_handleEscrowInfoResponse` write).
4. Re-run the SQL query on Node 3.

**Expected if bug present (predicted)**: `STATUS` is now `ACTIVE` (uppercase).
**Then confirm the impact**: open `#viewer` → tap the campaign → detail shows *"This campaign is no longer active"* (because `validateView` compares `STATUS !== 'active'`), and `MA_GET_AD` returns nothing. Confirms the self-break.
**Confirm no self-heal**: wait 2+ NEWBLOCKs; re-query STATUS — stays `ACTIVE` (processEscrowCoin lowercases before compare so never rewrites; ping loop selects only `'active'`).
**Success = bug reproduced.** This is the trigger to stop and apply the CLAUDE.md §2 ritual for the fix.

**Fallback / negative control**: if STATUS stays lowercase, the response may not be arriving — verify Node 1 received the `ESCROW_INFO_REQUEST` (grep Node 1 log for `ESCROW_INFO`) before concluding the finding is wrong.

### A2 — Finding #3: unauthenticated `CREATOR_LIVENESS_PONG` permanent 'finished'
**Requires a crafted Maxima send** → use **Node 6**'s MinimaNodeManager terminal textbox (per §11.3; `browser_evaluate` Maxima sends get declined).

**Setup**: reuse the A1 campaign (Node 1 creator). Node 3 = victim viewer with the campaign in `active` state (re-run A1 fix first if A1 already corrupted it, or use a fresh campaign).

**Steps**:
1. Record victim state: Node 3 SQL `SELECT ID, STATUS FROM CAMPAIGNS;` (expect `active`).
2. Build the spoof payload (hex-encode `{"type":"CREATOR_LIVENESS_PONG","campaign_id":"<campId>","status":"finished"}`): on Node 6 terminal, first add Node 3 as a contact (`maxcontacts action:add contact:<node3 contact>` — see memory [[project_maxima_send_needs_contact]]), then `maxima action:send publickey:<node3 MaximaPK> application:minima-ads data:0x<hex> poll:false`.
3. Wait ~5s. Node 3 SQL re-query.

**Expected if bug present**: Node 3 `STATUS` = `finished`, from a node that is NOT the campaign creator.
**Confirm permanence**: wait 2+ NEWBLOCKs → still `finished` (terminal-state guard #46 refuses to revert; ping loop skips non-active).
**Success = bug reproduced.**

**Note**: A2 is the most complex live repro (raw hex Maxima from a non-creator). If constructing the send proves unreliable in the harness, downgrade A2/A3/A4 to code-only findings (they're already argued in the audit) and prioritize the functional/publisher tiers below — the fixes don't strictly need a live repro, only a real bug found *during execution* triggers the §2 ritual.

### A3 — Finding #4: unauthenticated `REWARD_REJECTED` status flip
Same mechanism as A2 with payload `{"type":"REWARD_REJECTED","campaign_id":"<id>","reason":"finished"}` from Node 6 → Node 3. Expected: Node 3 flips to `finished`. (The event-delete half is impractical to repro without a known event_id — skip it, note in findings.)

### A4 — Finding #1: unauthenticated `ESCROW_INFO_RESPONSE` budget overwrite
Node 6 → Node 3, payload `{"type":"ESCROW_INFO_RESPONSE","campaign_id":"<id>","status":"ok","data":{"budget_total":1,"budget_remaining":0,"max_publisher_budget":0,"publisher_budget_spent":0,"viewer_budget_spent":0,"publisher_budget_earned":0,"campaign_status":"active"}}`. Expected: Node 3 `BUDGET_REMAINING` → 0 (and STATUS → `ACTIVE` per #2), from a non-creator, with no prior request from Node 3. Confirms remote budget poisoning.

---

## Priority tier B — never-covered core flows (`TESTING_SETUP.md §10`)

### B1 — Full viewer flow (view + click reward, voucher lands)
**The gap §10 item 1.** No attacker; pure happy-path never documented end-to-end.

**Steps** (Node 3, Viewer mode):
1. `#viewer` → campaign list shows Node 1's active campaign → tap it → detail renders the ad, 3s progress bar runs.
2. After 3s: status shows "Reward confirmed! Opening secure channel…". This fires `MA_TRACK_VIEW` → SW `handleTrackView` → `_triggerChannelPayment` → `CHANNEL_OPEN_REQUEST` to Node 1.
3. **Node 3 SQL**: `SELECT CAMPAIGN_ID, ROLE, STATUS, CUMULATIVE_EARNED, MAX_AMOUNT, LATEST_TX_HEX FROM CHANNEL_STATE;` → expect a `viewer` row, `STATUS='pending'` initially.
4. Wait ~5 NEWBLOCKs (channel-open Tx1 split + Tx2, per fragility #24/#26). Re-query → `STATUS='open'`, `CHANNEL_COINID` set.
5. Re-open the ad (after cooldown) → second view → `REWARD_REQUEST` → creator returns `REWARD_VOUCHER`. Node 3 SQL: `CUMULATIVE_EARNED > 0`, `LATEST_TX_HEX != ''`.
6. **Node 3 SQL** `SELECT * FROM REWARD_EVENTS;` → a `view` row with the correct amount; `SELECT TOTAL_EARNED FROM USER_PROFILE;` matches.
7. Click the CTA → `MA_TRACK_CLICK` → a `click` reward event + voucher (cumulative bumps by reward_click).
8. **`#earnings`** on Node 3 → "Pending settlements" lists the open channel with the accrued amount; "Total earned" matches USER_PROFILE.

**Success**: voucher chain works, REWARD_EVENTS + USER_PROFILE consistent, earnings UI reflects it. Confirms the core viewer loop (never before documented).

**Watch for**: this flow also exercises finding **#9** indirectly — Node 3 uses the built-in `#viewer` (publisherKey = `MINIMAADS_CREATOR_PK`, not a MAX# route), so #9's symptom won't show here; #9 needs the **snippet** path (B3).

### B2 — Settlement to L1 wallet
Continue from B1's open channel. On `#earnings`, click **Settle** on the pending channel.
1. Watch status: "Settlement posted. Awaiting L1 confirmation…".
2. Wait for NEWBLOCK → SW `checkOpenChannelsSettled` detects spent coin → `SETTLE_CONFIRMED` signal → "Reward channel settled. Received: X MINIMA".
3. **Node 3 SQL**: channel row moved to `CHANNEL_HISTORY` (`STATUS='settled'`); `CHANNEL_STATE` row gone/settled.
4. **Node 3 raw log** (§9.2): grep `"NEW Unspent Coin"` for a coin at Node 3's wallet address with the settled amount — ground-truth confirmation the funds actually landed on L1.
5. **Node 1** `#mycampaigns` → campaign card → "Settled channels" shows Node 3's settled channel.

### B3 — Publisher flow (custom Frame via snippet) — also exercises findings #7, #9, #11
**The gap §10 item 3.**

**Setup**: Node 2 (publisher) must have `USER_PERMANENT_ROUTE` set (§6.4 — its Frames view won't open otherwise).

**Steps**:
1. Node 2 → Publisher mode → `#frames` → "Create Frame" (label e.g. "test-site"). Confirm a custom Frame row appears (SQL: `SELECT FRAME_ID, PUBLISHER_KEY, PUBLISHER_WALLET, PUBLISHER_MX, IS_BUILTIN FROM FRAMES;`).
   - **Finding #11 check**: inspect `PUBLISHER_WALLET` — audit predicts it holds the Maxima **PK** (~270 hex), not a 0x-64 wallet address. Record it.
2. Copy the snippet ("Snippet" details → Copy).
   - **Finding #9 check**: read the snippet's `_getMxContact` output — it sends `userAddress = MAX#<pk>#<mls>`. Note for the fix; a live repro needs the snippet embedded in a separate host dapp (out of harness scope) — instead verify indirectly in step 5.
3. Simulate the snippet's `MA_GET_AD`/`MA_TRACK_VIEW`: easiest live path is to actually drive a view through Node 2 as a viewer using the built-in `#viewer` but with the custom frame — OR, more faithfully, note that a full snippet-embed test needs a host MiniDapp and is a documented harness gap. **Minimum viable**: on Node 2, open `#viewer`, watch an ad → this generates a `publisher_view` reward routed to Node 2's built-in frame, exercising the publisher channel open on Node 1.
4. **Node 1 SQL**: `SELECT * FROM CHANNEL_STATE WHERE ROLE='publisher';` → publisher channel opened for the frame; after a view, `CUMULATIVE_EARNED > 0`.
   - **Finding #11 live symptom**: if the publisher channel was opened via the SDK path with a bad `VIEWER_WALLET_ADDR` (Maxima PK), the voucher `txnoutput` will fail — grep Node 1 log for `swBuildAndExportVoucherTx failed at txnoutput`. If it fails, #11 is confirmed live.
5. **Node 2** `#frames` → the frame's "Earnings" → publisher views count + total earned; `#earnings` (publisher mode) → publisher pending settlement. Settle it → confirm on L1 log (§9.2).
   - **Finding #7 check**: after a publisher channel is open, on Node 2 `#earnings` publisher-mode click Settle when `LATEST_TX_HEX` is stale/empty → observe whether `VOUCHER_SYNC_REQUEST` recovers it. Audit predicts it does NOT (role dropped) → publisher settlement stuck. Grep Node 1 for a `VOUCHER_SYNC_REQUEST` that resolves to a viewer (not publisher) row.

### B4 — State reset between runs (`TESTING_SETUP.md §10` item 4)
Document, while executing, the minimal reset: in MinimaNodeManager, per node, "Delete Data" vs full "Kill All Processes" — and which one preserves onboarding/write-mode/§6 role config vs forces a full redo. Capture the answer for TESTING_SETUP §10.

---

## Priority tier C — integration scenarios never tested together

### C1 — Multi-viewer against one creator (voucher-sync, `§10` item 2)
Nodes 3, 4(as viewer B), 6(as viewer C) all view the **same** Node 1 campaign concurrently.
1. Drive a view on all three within a short window.
2. **Node 1 SQL**: `SELECT VIEWER_KEY, CUMULATIVE_EARNED, STATUS FROM CHANNEL_STATE WHERE ROLE='viewer';` → three distinct viewer channels, independent cumulatives.
3. Confirm no cross-contamination: each viewer's `REWARD_EVENTS.USER_ADDRESS` = its own PK; budgets deducted correctly (`SELECT BUDGET_REMAINING FROM CAMPAIGNS` on Node 1 reflects on-chain escrow after splits).
4. Kill one viewer's tab mid-flight, reopen → SDK `_onReconnect` fires `VOUCHER_SYNC_REQUEST` for the open channel with no voucher → creator re-emits. Confirm recovery (this is the viewer-side of #7, which the audit says DOES work — good contrast case).

### C2 — Publisher + viewer channels open simultaneously on the same campaign
Node 3 views via Node 2's frame while Node 3 also has its own built-in viewer channel → both a `viewer` and a `publisher` channel exist for the same campaign on the involved nodes.
1. **Node 1 SQL**: both `ROLE='viewer'` and `ROLE='publisher'` channels present for the campaign.
2. Confirm `MAX_PUBLISHER_BUDGET` cap holds: drive enough publisher views that `SUM(CUMULATIVE_EARNED) WHERE ROLE='publisher'` approaches `MAX_PUBLISHER_BUDGET` → further publisher vouchers rejected (grep Node 1 for `MAX_PUBLISHER_BUDGET exceeded`). Verifies N2-3 cap under concurrency.
   - **Finding #10 live symptom**: on an SDK host that is both viewer and publisher, `_getMyChannel` (no ROLE filter) could grab the publisher row for a viewer reward → viewer REWARD_REQUEST rejected. On our SW-integrated harness the SW path is used (not the SDK `_getMyChannel`), so #10 may not reproduce here — note as "SDK-host-only, not live-verifiable on this harness."

### C3 — Multiple active campaigns competing for the same viewer/budget
Node 1 publishes 2 campaigns; Node 4 publishes a 3rd. Node 3 views all three.
1. Confirm `selectAd` rotation (`_seenCampaignIds`) serves different campaigns across successive `#viewer` opens.
2. Confirm per-campaign channels are independent (3 viewer channels, separate cumulatives, separate cooldowns — regression check on VAL-1 per-campaign cooldown).

---

## Execution notes

- **Per real bug found during execution** (not cosmetic, not already-known): stop, run the **CLAUDE.md §2 ritual** (complexity assessment → public suggestion → wait for maintainer confirmation) before touching code. The audit/plan themselves need no ritual.
- **A1 is the anchor test** — highest-confidence live repro, do it first. If confirmed, it's the first fix candidate.
- Findings not live-verifiable on this harness (SDK-host-only: #5, #6, #10, #14): mark them explicitly as "code-confirmed, not live-testable here" in the final findings; they still warrant fixes but the §2 ritual for those triggers from the code analysis, at maintainer discretion, not from a live repro.
- Keep the workspace clean before any "Zip & Install" (`git status --short`, per §4 gotcha).
