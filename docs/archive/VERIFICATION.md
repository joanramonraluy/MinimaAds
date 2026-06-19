# MinimaAds Verification Notes

Extracted from AGENTS.md during documentation compaction on 2026-05-18. MinimaAds.md remains the highest-authority specification.

## 17) Node Verification Workflow

The maintainer has access to one or more active Minima nodes at any time. Any number of nodes can run simultaneously — typically one as **creator** and one or more as **viewer** nodes.

### How verification works

The agent cannot access the nodes directly. The workflow is:

1. **Agent implements** a feature and provides the handoff note with verification steps.
2. **Maintainer installs / reloads** the MiniDapp on the relevant nodes (reinstall clears the H2 DB; reload without reinstall preserves it).
3. **Maintainer triggers** the action described in the verification step (e.g. creates a campaign, sends a Maxima message, clicks an ad).
4. **Maintainer copies** the relevant `MDS.log` output from the node debug panel and pastes it into the conversation.
5. **Agent reads the logs** and confirms the expected log lines are present, or diagnoses any errors.

### What to look for in logs

Each module uses a bracketed prefix in `MDS.log` calls. Use these to filter:

| Prefix | Module |
|---|---|
| `[ADS]` | `main.js` — bootstrap, Maxima PK, escrow registration |
| `[DB]` | `db-init.js` — table creation |
| `[SQL]` | `core/minima.js` — sqlQuery errors |
| `[MAXIMA]` | `maxima.handler.js` — inbound Maxima routing |
| `[CAMPAIGN]` | `campaign.handler.js` — campaign persist, status change, discovery |
| `[CHANNEL]` | `channel.handler.js` — channel open, reward request, voucher |
| `[DISCOVERY]` | `campaign.handler.js` — escrow coin scan |
| `[PENDING]` | `campaign.handler.js` — MDS_PENDING approval flow |
| `[TIMER]` | `main.js` — timer ticks |
| `[VALIDATION]` | `core/validation.js` — isDuplicate errors |

### Status Coin (T-SC) verification

**Prerequisites**: T-SC1 → T-SC6 all Done ✅. Two nodes running with MinimaAds installed.

#### Test 1 — New campaign lands at V3 with port:7 = hex('active')

1. Node A: create a campaign via the Creator form.
2. In node A's console: `coins address:<ESCROW_ADDRESS_V3>`
3. Find the new coin. Its `prevstate` array must include `{ port: 7, data: "0x616374697665" }` (hex of `"active"`).
4. Expected SW log line: `[ADS] ESCROW_ADDRESS_V3: 0x...` (distinct from V1/V2 addresses).

#### Test 2 — Viewer picks up on-chain pause without Maxima

1. Node B: discover the campaign (wait for DISCOVERY scan on NEWBLOCK).
2. Take Node B **offline** (disconnect from network).
3. Node A: click **Pause** on the campaign → approve the pending tx in Minima Hub → wait for confirmation (~1–2 blocks).
4. Bring Node B back **online**.
5. Within ≤ 2 NEWBLOCKs: Node B SW log must show `[DISCOVERY] on-chain status sync: <id> active -> paused`.
6. Node B FE: campaign card must reflect `paused` status without any Maxima message received.

#### Test 3 — On-chain finish propagation

1. Continuing from Test 2 (campaign paused on both nodes).
2. Take Node B offline again.
3. Node A: click **Finish** → approve → wait for confirmation.
4. Bring Node B online.
5. Within ≤ 2 NEWBLOCKs: Node B SW log: `[DISCOVERY] on-chain status sync: <id> paused -> finished`.
6. Node B DB: `SELECT STATUS FROM CAMPAIGNS WHERE ID = '<id>'` → `finished`.

#### Test 4 — Regression: legacy V2 campaign skipped silently

1. Create a campaign before T-SC3 was deployed (or manually insert a row with `ESCROW_ADDRESS_V2` coinid).
2. On any node, NEWBLOCK fires and `processEscrowCoin` processes the V2 coin.
3. Expected: **no** `[DISCOVERY] on-chain status sync` log line for this coin.
4. Pause the V2 campaign: `MA_LOCAL_STATUS` Maxima broadcast fires as before; viewer receives `CAMPAIGN_UPDATED` via the Maxima fast-path.
5. Expected node A log: `[ADS] buildAndPostStatusUpdateTx: campaign <id> not at V3 — skipped` (or equivalent warning).

---

### Verification steps for T-CH3 (channel.handler.js)

To verify `handleChannelOpenRequest`:
- Node A (creator) must have an active campaign in DB.
- Send a `CHANNEL_OPEN_REQUEST` Maxima message from Node B to Node A.
- Expected in Node A logs: `[CHANNEL] CHANNEL_OPEN_REQUEST: channel pending. campaign: <id>`
- If budget insufficient: `[CHANNEL] CHANNEL_OPEN_REQUEST: insufficient budget`
- If campaign inactive: `[CHANNEL] CHANNEL_OPEN_REQUEST: campaign not active`

To verify `handleRewardRequest` duplicate rejection:
- Send the same `REWARD_REQUEST` twice (same `event_id`).
- Second time: `[CHANNEL] REWARD_REQUEST: duplicate event_id: <id>`

To verify `handleRewardVoucher` DEDUP_LOG write:
- After receiving a `REWARD_VOUCHER`, query `SELECT * FROM DEDUP_LOG` from the node SQL console.
- The `event_id` from the voucher should appear as a row.

### T-CH3 Verification Result (2026-04-24)

Two-node test (creator = node1 `10.0.0.11:9001`, viewer = node2):

- ✅ Both nodes boot without Rhino errors — `channel.handler.js` loads cleanly
- ✅ Both nodes reach `[DB] initDB: all tables ready` (CHANNEL_STATE table present)
- ✅ Maxima messaging functional: viewer discovers escrow coin on-chain → sends `REQUEST_CAMPAIGN_DATA` → creator replies → viewer persists campaign `19dbe586589-e7bfa9c1`
- ⏳ `[CHANNEL]` handler functions not yet triggered — expected, as `CHANNEL_OPEN_REQUEST` is only sent by T-CH5 (SDK), not yet implemented

Full per-handler verification (handleChannelOpenRequest, handleRewardRequest, handleRewardVoucher) pending T-CH4 + T-CH5.

---

## 18) Security Audit Fix Verification (Audit Report 2 Remediations)

**Prerequisites**: All audit-2 fixes (N2-1 through I-2) deployed. Two nodes active.

### Test 1 — Click-rate limiting (N2-2 LAST_CLICK_VOUCHER_AT)

1. Node A: create campaign, Node B: open channel.
2. Node B FE: send two `REWARD_REQUEST` events in rapid succession (click, then view) for the same channel.
3. First click: `REWARD_VOUCHER` arrives. Second click (immediate): rejected with log `[CHANNEL] REWARD_REQUEST: click cooldown not met`.
4. Expected: click→click paced by `LAST_CLICK_VOUCHER_AT` (30s); view→click immediate (different cooldown).

### Test 2 — Global publisher budget cap (N2-3 MAX_PUBLISHER_BUDGET)

1. Node A: set campaign `max_publisher_budget: 5`, Node B opens viewer AND publisher channels.
2. Node B SDK: earn 3.0 as viewer, 3.0 as publisher (total 6.0 > 5.0 cap).
3. Publisher REWARD_REQUEST for 2.5: rejected with log `[CHANNEL] REWARD_REQUEST: exceeds MAX_PUBLISHER_BUDGET cap`.
4. Viewer REWARD_REQUEST for 2.5: accepted (viewer subset is uncapped, only global budget matters).

### Test 3 — Publisher channel opener binding (N2-4 OPENER_MX_PK)

1. Node A: create campaign. Node B (publisher) opens publisher channel. `CHANNEL_STATE.OPENER_MX_PK` must equal Node B's Maxima PK.
2. Forge a `REWARD_REQUEST` from a different node C (spoofed Maxima PK).
3. Expected: Node A rejects with log `[CHANNEL] REWARD_REQUEST: opener PK mismatch, rejecting`.
4. Legitimate REWARD_REQUEST from Node B (correct PK): accepted.

### Test 4 — Escrow info request gating (N2-6)

1. Node A: campaign active. Node C (unknown peer): send `ESCROW_INFO_REQUEST`.
2. Expected: Node A silently drops, no log (strangers not answered).
3. Node B (known counterparty with open channel): send `ESCROW_INFO_REQUEST`.
4. Expected: Node A responds with `ESCROW_INFO_RESPONSE`.

---

