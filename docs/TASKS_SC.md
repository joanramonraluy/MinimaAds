# MinimaAds — Status Coin Tasks (T-SC1 → T-SC7)

> On-chain campaign status via ESCROW_SCRIPT_V3.
> Removes the dependency on creator-online Maxima broadcasts for pause/finish/resume propagation.
>
> For full project context see `docs/TASKS.md`. This file contains only the active T-SC block.

---

## Sequence

```
T-SC1 → T-SC2 → { T-SC3, T-SC4, T-SC5 } → T-SC6 → T-SC7
```

T-SC3, T-SC4 and T-SC5 can run in parallel once T-SC2 is done. All three must be done before T-SC6.

---

## Status

| Task | Layer | Agent | Files | Status |
|---|---|---|---|---|
| **T-SC1** | Spec | Opus | `MinimaAds.md`, `AGENTS.md` | Done ✅ |
| **T-SC2** | SW | Sonnet | `service.js` | Done ✅ |
| **T-SC3** | FE | Sonnet | `dapp/views/creator.js`, `dapp/app.js` | Done ✅ |
| **T-SC4** | SW | Sonnet | `public/service-workers/handlers/campaign.handler.js` | Done ✅ |
| **T-SC5** | Core | Sonnet | `core/campaigns.js` | Done ✅ |
| **T-SC6** | FE | Opus | `dapp/app.js`, `dapp/views/mycampaigns.js` | Pending ⬜ |
| **T-SC7** | Docs | Sonnet | `docs/KNOWN_ISSUES.md`, `docs/VERIFICATION.md`, `AGENTS.md` | Pending ⬜ |

---

### T-SC1 — Spec: MinimaAds.md updates for V3 escrow + on-chain status

| Camp | Valor |
|---|---|
| **Status** | Done ✅ |
| **Agent** | Opus |
| **Fitxers** | `MinimaAds.md`, `AGENTS.md` |
| **Spec** | MinimaAds.md §4 §6 §8 Appendix B |

**Context:** Spec must land before any code so subsequent agents have an unambiguous contract. No code is written in this task.

---

### T-SC2 — SW: ESCROW_SCRIPT_V3 registration + scanEscrowCoins V3

| Camp | Valor |
|---|---|
| **Status** | Done ✅ |
| **Agent** | Sonnet |
| **Fitxers** | `service.js` |
| **Spec** | MinimaAds.md Appendix B.2.1, §6.10 |

**Context:** Add V3 script registration alongside V1/V2. The address must be cached under a NEW keypair entry so V2 (`ESCROW_ADDRESS_V2`) is not clobbered. The scan loop must include V3 coins so DISCOVERY runs on them.

**Prompt:**
```
You are implementing T-SC2 for MinimaAds. T-SC1 must be Done. Read CLAUDE.md, MinimaAds.md Appendix B.2.1 and §6.10, AGENTS.md, and the current `registerEscrowScript()` and `scanEscrowCoins()` in service.js.

Task: Add ESCROW_SCRIPT_V3 registration and include the V3 address in the discovery scan.

Changes to service.js ONLY:

1. Add a new constant at the top (alongside ESCROW_SCRIPT and ESCROW_SCRIPT_V2):

   var ESCROW_ADDRESS_V3 = '';

   var ESCROW_SCRIPT_V3 =
     "LET creatorkey=PREVSTATE(1) " +
     "LET platformkey=PREVSTATE(5) " +
     "LET maxpubbudget=PREVSTATE(6) " +
     "LET status=PREVSTATE(7) " +
     "ASSERT SIGNEDBY(creatorkey) " +
     "LET payout=STATE(10) " +
     "LET feeflag=STATE(11) " +
     "LET change=@AMOUNT-payout " +
     "IF feeflag EQ 1 THEN " +
     "LET feeamount=STATE(12) " +
     "ASSERT VERIFYOUT(STATE(13) platformkey feeamount @TOKENID FALSE) " +
     "ENDIF " +
     "IF change GT 0 THEN " +
     "ASSERT VERIFYOUT(INC(@INPUT) @ADDRESS change @TOKENID TRUE) " +
     "ENDIF " +
     "RETURN TRUE";

2. Inside `registerEscrowScript()`, after the V2 newscript callback succeeds and BEFORE the CHANNEL_SCRIPT newscript call, insert a V3 newscript registration:

   MDS.cmd("newscript script:\"" + ESCROW_SCRIPT_V3 + "\" trackall:false", function(resV3) {
     if (!resV3.status) {
       MDS.log("[ADS] newscript V3 failed: " + resV3.error);
       // proceed regardless — V3 features unavailable
     } else {
       ESCROW_ADDRESS_V3 = resV3.response.address;
       MDS.log("[ADS] ESCROW_ADDRESS_V3: " + ESCROW_ADDRESS_V3);
       MDS.keypair.set("ESCROW_ADDRESS_V3", ESCROW_ADDRESS_V3, function() {});
     }
     // ... existing CHANNEL_SCRIPT newscript chain continues here
   });

3. Update `scanEscrowCoins()` to scan V3 as well:

   function scanEscrowCoins() {
     _scanAddress(ESCROW_ADDRESS);
     _scanAddress(ESCROW_ADDRESS_V2);
     _scanAddress(ESCROW_ADDRESS_V3);
   }

Rules:
- Rhino-safe: var, function(), string concat, MDS.log, no trailing commas, no arrow functions.
- Do NOT touch processEscrowCoin (that's T-SC4).
- Do NOT touch FE files.
- Do NOT modify channel handlers.

Definition of done:
- [ ] ESCROW_SCRIPT_V3 and ESCROW_ADDRESS_V3 declared
- [ ] registerEscrowScript registers V3 after V2 succeeds
- [ ] scanEscrowCoins iterates V1, V2, V3 addresses
- [ ] V3 newscript failure does NOT abort the init chain
- [ ] AGENTS.md §8 handoff entry added

Verification: install dapp on a fresh node; SW log should show `[ADS] ESCROW_ADDRESS_V3: 0x...` distinct from V1/V2 addresses. `coins address:<V3_ADDRESS>` returns [] until a V3 campaign is created.

Provide the standard handoff note (CLAUDE.md §10) when done.
```

**Definition of done:**
- [ ] V3 script + address constants declared
- [ ] V3 newscript registered in init chain
- [ ] Scan covers V1, V2, V3
- [ ] No regression on V1/V2 init

---

### T-SC3 — FE: V3 script address + new campaigns use V3

| Camp | Valor |
|---|---|
| **Status** | Pending ⬜ (depends on T-SC2) |
| **Agent** | Sonnet |
| **Fitxers** | `dapp/views/creator.js`, `dapp/app.js` |
| **Spec** | MinimaAds.md Appendix B.2.1, B.5 |

**Context:** New campaigns funded from creator.js must target V3 address. The funding tx must set port:7 = `"active"` (hex). Channel-open spends in app.js must pass through `STATE(7)` so the escrow change coin retains the status.

**Prompt:**
```
You are implementing T-SC3 for MinimaAds. T-SC2 must be Done. Read CLAUDE.md, MinimaAds.md Appendix B.2.1 §B.5, and AGENTS.md before writing any code.

Task: Wire creator.js to fund NEW campaigns to ESCROW_ADDRESS_V3 with port:7 = hex("active"), and update channel-open spends in app.js to carry STATE(7) forward.

PART 1 — creator.js:

1. Add ESCROW_SCRIPT_V3 FE constant (byte-identical to the SW one in T-SC2).

2. Replace `resolveEscrowAddress()`:
   - Now resolves V3 first (keypair 'ESCROW_ADDRESS_V3'); registers via newscript if missing; caches.
   - Returns the V3 address. V2 fallback only if V3 newscript fails (log a warning).

3. In `fundEscrowAndPublish`, after stateJson is built, append port:7:
     stateJson = stateJson.slice(0, -1) + ',"7":"' + utf8ToHex('active').toUpperCase() + '"}';
   Apply this regardless of feeflag — port:7 is independent of fee branch.

4. Verify: campaign funding tx now lands at V3 address, and the coin has 7 PREVSTATE ports populated (1..7) plus port:11 (feeflag).

PART 2 — dapp/app.js handleDoChannelOpen / buildAndPostChannelTx:

5. The split tx state currently sets ports 1, 3, 4, 10, 11. Add port:7 passthrough:
   - Before building stateCmds, fetch the current escrow coin's PREVSTATE(7) value.
     Read from txninput response: r2.response.transaction.inputs[0].state (verify exact path against refs/Minima-1.0.45).
   - If empty (legacy V1/V2 coin): set port:7 = hex('active') so the change coin behaves as V3 status-bearing going forward.
   - If present: forward the same hex value to STATE(7).
   - Add to stateCmds:
       'txnstate id:' + txId + ' port:7 value:' + statusHex

6. Also resolve ESCROW_ADDRESS_V3 in handleDoChannelOpen (alongside the existing V2/V1 lookup), and prefer V3 when the campaign's escrow coin lives at V3. The split-output address must match the input coin's address.

PART 3 — Backwards compatibility:

7. A campaign created BEFORE T-SC3 (V2 coin) → channel-open still spends from V2 address → keep that path working unchanged. The port:7 line is fine to include on V2 spends too (the V2 script does not read it; harmless extra state).

Rules:
- FE code: arrow functions, let/const, template literals are FINE (browser context).
- Do NOT modify SW files.
- Do NOT change setCampaignStatus or processEscrowCoin (T-SC4 / T-SC5).
- If r2.response shape for input prevstate is unclear: check refs/Minima-1.0.45/src/org/minima/system/commands/txn/txninput.java.

Definition of done:
- [ ] resolveEscrowAddress targets V3 first
- [ ] Funding tx sets port:7 = hex('active')
- [ ] New campaigns land at ESCROW_ADDRESS_V3
- [ ] Channel-open split tx carries port:7 forward
- [ ] Legacy V2 campaigns continue to channel-open without errors

Verification: create a new campaign, then via `coins address:<V3>` confirm the coin has PREVSTATE(7) = hex('active'). Open a channel; the resulting escrow change coin should also have PREVSTATE(7) = hex('active').

Provide the standard handoff note (CLAUDE.md §10) when done.
```

**Definition of done:**
- [ ] V3 funding tx with port:7 active
- [ ] Channel-open split preserves port:7
- [ ] Legacy V1/V2 spends still work

---

### T-SC4 — SW DISCOVERY: read PREVSTATE(7) and sync local status

| Camp | Valor |
|---|---|
| **Status** | Pending ⬜ (depends on T-SC2) |
| **Agent** | Sonnet |
| **Fitxers** | `public/service-workers/handlers/campaign.handler.js` |
| **Spec** | MinimaAds.md §6.10, Appendix B.3 |

**Context:** `processEscrowCoin()` already runs on every NEWBLOCK for every escrow address. Add a small block at the end of the known-campaign branch that reads PREVSTATE(7), compares to local STATUS, and calls setCampaignStatus when they differ.

**Prompt:**
```
You are implementing T-SC4 for MinimaAds. T-SC2 must be Done. Read CLAUDE.md, MinimaAds.md §6.10 §8.15 Appendix B.3, AGENTS.md, and the current processEscrowCoin in public/service-workers/handlers/campaign.handler.js.

Task: Extend processEscrowCoin to sync local campaign STATUS from on-chain PREVSTATE(7).

Inside processEscrowCoin's `if (campaign) { ... }` branch (where it currently syncs BUDGET_REMAINING and MAX_PUBLISHER_BUDGET), add — AFTER the existing sync logic — a status sync block:

  var onChainStatusHex = getStateVar(states, 7);
  if (onChainStatusHex) {
    var onChainStatus = '';
    try { onChainStatus = hexToUtf8(onChainStatusHex); } catch (ex) {
      MDS.log("[DISCOVERY] could not decode PREVSTATE(7) for " + campaignId + ": " + ex);
    }
    if (onChainStatus === 'active' || onChainStatus === 'paused' || onChainStatus === 'finished') {
      var localStatus = (campaign.STATUS || '').toLowerCase();
      // Terminal-state guard: do NOT resurrect a finished campaign from an older coin reading
      if (localStatus === 'finished' && onChainStatus !== 'finished') {
        MDS.log("[DISCOVERY] ignoring on-chain status " + onChainStatus + " for finished campaign: " + campaignId);
      } else if (onChainStatus !== localStatus) {
        MDS.log("[DISCOVERY] on-chain status sync: " + campaignId + " " + localStatus + " -> " + onChainStatus);
        setCampaignStatus(campaignId, onChainStatus, function(stErr) {
          if (stErr) {
            MDS.log("[DISCOVERY] setCampaignStatus failed: " + stErr);
            return;
          }
          signalFE("CAMPAIGN_UPDATED", { campaign_id: campaignId, status: onChainStatus });
        });
      }
    } else {
      MDS.log("[DISCOVERY] unknown on-chain status value '" + onChainStatus + "' for " + campaignId);
    }
  }

Rules:
- Rhino-safe: var, function(), string concat, MDS.log, no trailing commas, no arrow functions.
- Place the new block AFTER the budget sync block but BEFORE `return;` inside the `if (campaign)` branch.
- Do NOT touch the unknown-campaign branch (REQUEST_CAMPAIGN_DATA flow).
- Do NOT remove or weaken the terminal-state guard.
- _knownEscrowCoins still caches by coinId — status sync runs only once per coin per session, which is correct because a status change creates a new change coin (new coinId).

Definition of done:
- [ ] PREVSTATE(7) decoded and validated against {active|paused|finished}
- [ ] Terminal-state guard prevents resurrection of finished campaigns
- [ ] setCampaignStatus + signalFE("CAMPAIGN_UPDATED") fires on transition
- [ ] Legacy V1/V2 coins (no port:7) are silently skipped
- [ ] AGENTS.md §16 entry added

Verification: on viewer node A, pause a campaign on creator node B via a manual status-update tx. On A's NEWBLOCK following confirmation, log shows "[DISCOVERY] on-chain status sync: ... active -> paused" and signalFE fires.

Provide the standard handoff note (CLAUDE.md §10) when done.
```

**Definition of done:**
- [ ] PREVSTATE(7) read and applied via setCampaignStatus
- [ ] Terminal-state guard present
- [ ] CAMPAIGN_UPDATED signalled to FE
- [ ] Backwards compatible (V1/V2 coins skipped silently)

---

### T-SC5 — Core: buildStatusUpdateTxPlan + carry-forward helpers

| Camp | Valor |
|---|---|
| **Status** | Pending ⬜ (depends on T-SC2) |
| **Agent** | Sonnet |
| **Fitxers** | `core/campaigns.js` |
| **Spec** | MinimaAds.md Appendix B.5 (Status Update tx) |

**Context:** Pure-data helpers used by T-SC6 to assemble the status-update tx. Keeping the tx-shape builder in core (no MDS calls) makes it testable and keeps app.js focused on the txncreate/sign/post sequence.

**Prompt:**
```
You are implementing T-SC5 for MinimaAds. T-SC2 must be Done. Read CLAUDE.md, MinimaAds.md Appendix B.5 (Status Update tx), AGENTS.md §4, and the existing core/campaigns.js.

Task: Add two pure helper functions to core/campaigns.js. No DOM, no MDS.cmd, no MDS.sql.

Functions to add:

  // Returns the list of port:value pairs to set on a status-update tx.
  // currentEscrow = {
  //   walletPk, campaignIdHex, creatorMxHex, platformKeyHex, maxPubBudget, feeflag
  // }
  // newStatusHex = '0x' + utf8ToHex('active'|'paused'|'finished').toUpperCase()
  // Returns an array of { port, value } objects.
  function buildStatusUpdateStatePorts(currentEscrow, newStatusHex) { ... }

  // Validates a status string and returns the hex encoding suitable for txnstate.
  // Returns '' if invalid (anything other than 'active', 'paused', 'finished').
  function encodeStatusForTx(status) { ... }

Implementation notes:
- Use the existing utf8ToHex helper from core/minima.js (already loaded before campaigns.js).
- var/function() only — no const/let/arrow.
- STATE(10) = '0' (payout=0; full change-back), STATE(11) = '0' (no fee on status-update).
- Plain objects in the returned array: { port: 7, value: '0x...' }.

Do NOT change any existing function signature in core/campaigns.js. Do NOT call MDS.cmd from these helpers.

Definition of done:
- [ ] buildStatusUpdateStatePorts returns the correct ordered array
- [ ] encodeStatusForTx validates and hex-encodes the status string
- [ ] No MDS.cmd / MDS.sql calls in either helper
- [ ] AGENTS.md §16 updated

Provide the standard handoff note (CLAUDE.md §10) when done.
```

**Definition of done:**
- [ ] buildStatusUpdateStatePorts present, pure
- [ ] encodeStatusForTx present, validates input
- [ ] No side effects

---

### T-SC6 — FE: buildAndPostStatusUpdateTx + mycampaigns.js integration

| Camp | Valor |
|---|---|
| **Status** | Pending ⬜ (depends on T-SC3, T-SC4, T-SC5) |
| **Agent** | Opus |
| **Fitxers** | `dapp/app.js`, `dapp/views/mycampaigns.js` |
| **Spec** | MinimaAds.md §6.10, §8.15, Appendix B.5 |

**Context:** Compose the on-chain status update from the creator's UI. Reuses the same MDS_PENDING approve/deny machinery already proven for channel-open spends. The local MA_LOCAL_STATUS broadcast remains as immediate-feedback path; the on-chain tx is the propagation mechanism for other nodes. Opus because it touches the pending-approval ctx restore plus a multi-step tx flow.

**Prompt:**
```
You are implementing T-SC6 for MinimaAds. T-SC3, T-SC4, and T-SC5 must all be Done. Read CLAUDE.md, MinimaAds.md §6.10 §8.15 Appendix B.5, AGENTS.md, the current handleDoChannelOpen / buildAndPostChannelTx / savePendingChannelOp / handleFePending in dapp/app.js, and the current pause/resume/finish buttons in dapp/views/mycampaigns.js.

Task: Add buildAndPostStatusUpdateTx in app.js and wire mycampaigns.js buttons to call it AFTER the existing MA_LOCAL_STATUS broadcast.

PART 1 — dapp/app.js, new functions:

1. buildAndPostStatusUpdateTx(campaignId, newStatus, onResult)
   - Validate newStatus via encodeStatusForTx (returns hex or '').
   - Load campaign: getCampaign(campaignId, ...).
   - Read the current escrow coin's prevstate via:
       MDS.cmd('coins coinid:' + escrowCoinId + ' relevant:false', function(res) { ... })
     to recover ports 5, 6, 11.
   - Resolve ESCROW_ADDRESS_V3 from keypair. If missing → onResult({ ok:false, error:'V3 address not found' }).
   - If the campaign's escrow coin is NOT at ESCROW_ADDRESS_V3: skip the tx, log warning, onResult({ ok:true, skipped:true }).
   - Build the tx using buildStatusUpdateStatePorts (from core/campaigns.js):
       txncreate → txninput → txnoutput (full amount, escrowAddrV3, storestate:true)
       → txnstate for each port → txnsign → txnpost → txndelete
   - Handle pending (txnsign or txnpost returns pending:true): savePendingChannelOp(uid, { kind:'status_update_sign'|'status_update_post', ctx }) ; signalFE('STATUS_TX_PENDING', { campaign_id, status, pending_uid }).
   - After successful post: extract new change coinid from txpow.body.txn.outputs (address === escrowAddrV3), update CAMPAIGNS.ESCROW_COINID via sqlQuery, signalFE('CAMPAIGN_UPDATED', { campaign_id, status: newStatus }).

2. Extend handleFePending to recognise kind === 'status_update_sign' and 'status_update_post' and resume correctly (same pattern as channel_split_sign / channel_split_post).

PART 2 — dapp/views/mycampaigns.js:

3. After each MA_LOCAL_STATUS broadcast (pause / resume / finish), call:
     buildAndPostStatusUpdateTx(c.ID, '<status>', function(res) {
       if (!res || !res.ok) { alert('On-chain propagation failed: ' + (res && res.error || 'unknown')); }
     });
   Use window.buildAndPostStatusUpdateTx if app.js attaches it globally.

4. Listen for STATUS_TX_PENDING signal: append "(awaiting on-chain confirm)" label next to the campaign row while pending.

Rules:
- FE code may use let/const/arrow (browser context).
- Do NOT remove the MA_LOCAL_STATUS broadcast.
- Fire-and-forget — do NOT block the UI waiting for on-chain confirmation.

Definition of done:
- [ ] buildAndPostStatusUpdateTx exists, handles pending approve/deny
- [ ] handleFePending recognises status_update_sign and status_update_post
- [ ] After successful tx, CAMPAIGNS.ESCROW_COINID updated to new change coinid
- [ ] mycampaigns.js Pause/Resume/Finish call the on-chain tx after MA_LOCAL_STATUS
- [ ] STATUS_TX_PENDING signal fires while awaiting approval
- [ ] Legacy V1/V2 campaigns: tx silently skipped with log warning
- [ ] No regression on existing MA_LOCAL_STATUS flow

Verification: 2-node test. Node A creates a campaign (V3). Node B sees the campaign as active. Node A pauses → Hub approves. Wait 1–2 blocks. On node B, WITHOUT any Maxima received: SW log shows "[DISCOVERY] on-chain status sync: <id> active -> paused" and FE updates.

Provide the standard handoff note (CLAUDE.md §10) when done.
```

**Definition of done:**
- [ ] On-chain status-update tx posts cleanly
- [ ] Pending approve/deny resumes correctly
- [ ] mycampaigns.js wired
- [ ] STATUS_TX_PENDING signal handled
- [ ] Legacy campaigns skipped safely
- [ ] 2-node propagation verified without Maxima

---

### T-SC7 — Docs: KNOWN_ISSUES + VERIFICATION + AGENTS.md cleanup

| Camp | Valor |
|---|---|
| **Status** | Pending ⬜ (depends on T-SC6) |
| **Agent** | Sonnet |
| **Fitxers** | `docs/KNOWN_ISSUES.md`, `docs/VERIFICATION.md`, `AGENTS.md` |
| **Spec** | — |

**Context:** Document the new fragility points and the verification procedure. No production code changes.

**Prompt:**
```
You are implementing T-SC7 for MinimaAds. T-SC6 must be Done. Read CLAUDE.md, docs/KNOWN_ISSUES.md, docs/VERIFICATION.md, AGENTS.md.

Task: Document the V3 status-coin design — fragility points, verification steps, and protocol matrix updates.

1. docs/KNOWN_ISSUES.md — append new entries:
   - On-chain status sync triggers only on a NEW coinid (status-update tx always creates a new change coin).
   - port:7 missing on V1/V2 coins: status sync silently skipped; legacy campaigns still rely on Maxima + liveness pings.
   - Race: creator pauses AND viewer scans OLD coin in same NEWBLOCK → viewer still sees 'active' for ≤1 block. Acceptable.
   - Terminal-state guard: a finished campaign is NEVER reverted to active/paused from on-chain reads.
   - PREVSTATE(7) MUST be hex-encoded UTF-8 (e.g. '0x6163746976' for 'active'). Reads via hexToUtf8.

2. docs/VERIFICATION.md — append section "Status Coin (T-SC) verification":
   - Test 1: Create campaign on A → confirm coin at ESCROW_ADDRESS_V3 with PREVSTATE(7) = hex('active').
   - Test 2: Take B offline. Pause on A, approve, wait confirm. Bring B online. ≤2 NEWBLOCKs → "[DISCOVERY] on-chain status sync: active -> paused" in B's log.
   - Test 3: Finish on A → repeat. B's local STATUS = 'finished'.
   - Test 4 (regression): Legacy V2 campaign, pause → on-chain tx skipped (log warning), Maxima broadcast still propagates.

3. AGENTS.md:
   - Mark CAMPAIGN_PAUSE, CAMPAIGN_FINISH, CAMPAIGN_RESUME as "fast-path; authoritative state is ESCROW_V3 PREVSTATE(7)".
   - Add STATUS_TX_PENDING to the SW→FE signal list if not already present.
   - Add handoff entry describing T-SC completion.

Do NOT modify any JS files.

Definition of done:
- [ ] KNOWN_ISSUES.md has 5 new entries
- [ ] VERIFICATION.md has 4-test section
- [ ] AGENTS.md protocol matrix annotated + handoff entry added
- [ ] No code changes

Provide the standard handoff note (CLAUDE.md §10) when done.
```

**Definition of done:**
- [ ] KNOWN_ISSUES.md updated
- [ ] VERIFICATION.md updated
- [ ] AGENTS.md updated
- [ ] No code changes

---
