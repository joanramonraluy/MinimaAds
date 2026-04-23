# MinimaAds — Implementation Task List

> Ordered task list for agent sessions.
> Tasks must be implemented in sequence — each task depends on the previous one.
> One task per agent session. Fill in PromptBase.md §6 with the task before sending.

---

## Sequence Rule

```
T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9 → T10 → T11 → T12
```

Never start a task before all previous tasks are marked **Done**.

---

## Git Workflow

**Commits**: one commit per task, after logs are clean and the task is closed. The agent commits and pushes **when the maintainer explicitly requests it**. Message format:
```
T[n] — [short description]

[one line of context if needed]
```

**Tags**: created at the end of each milestone block, after all tasks in the block are verified on a real Minima node:

| Tag | Tasks | Milestone |
|---|---|---|
| `v0.1.0` | T1–T7 | Service Worker functional: DB, Core, Maxima handlers |
| `v0.2.0` | T8–T9 | SDK functional |
| `v0.3.0` | T10–T11 | Full MiniDapp UI — deployable |
| `v1.0.0` | — | First stable public release |

Tag command (run by maintainer after milestone verification):
```bash
git tag v0.x.0 -m "[milestone description]"
git push origin v0.x.0
```

Tags are created by the **maintainer**, not the agent. The agent's job is to note in the handoff when a milestone tag is due.

---

## Task List

### T1 — DB Schema
**Layer**: DB  
**File**: `public/service-workers/db-init.js`  
**Spec**: MinimaAds.md §3.5, AGENTS.md §8  

Implement `initDB()` — all `CREATE TABLE IF NOT EXISTS` statements for:
- `CAMPAIGNS`
- `ADS`
- `REWARD_EVENTS`
- `USER_PROFILE`
- `DEDUP_LOG`

Column names, types, and constraints must match MinimaAds.md §3.5 exactly.
Include a call to `sqlQuery` (not bare `MDS.sql`) for each statement.
At the end of `initDB()` call `signalFE("DB_READY", {})`.

**Definition of done**:
- [ ] All 5 tables created with correct columns
- [ ] Uses `sqlQuery()` from `core/minima.js` (stub it if needed — see T2)
- [ ] No `ON CONFLICT` clauses — H2 uses `MERGE INTO`
- [ ] `signalFE("DB_READY", {})` called at end

> **Note**: `DEDUP_LOG` added here (T1) after analysis. T5 `isDuplicate()` must query `DEDUP_LOG`. T6 `createRewardEvent()` must INSERT into `DEDUP_LOG` on each accepted event. See MinimaAds.md §3.5.

---

### T2 — Core: minima.js
**Layer**: Core  
**File**: `core/minima.js`  
**Spec**: MinimaAds.md §7.5, AGENTS.md §4, §6  

Implement the three platform bridge functions:

```
sqlQuery(query, cb)        — wraps MDS.sql with error logging
broadcastMaxima(payload, cb) — utf8ToHex encode, poll:false, APP_NAME constant
signalFE(type, data)       — MDS.comms.solo wrapper
```

Also implement:
- `utf8ToHex(str)` — pure JS, no TextEncoder (Rhino constraint)
- `hexToUtf8(hex)` — inverse
- `escapeSql(str)` — single-quote escape for H2

**Definition of done**:
- [ ] `sqlQuery` logs errors with `MDS.log("[SQL] ...")`
- [ ] `broadcastMaxima` uses `APP_NAME` constant, `poll:false`, hex-encodes payload
- [ ] `utf8ToHex` / `hexToUtf8` use no `TextEncoder`
- [ ] `escapeSql` replaces `'` with `''`
- [ ] No `let`, `const`, arrow functions, or template literals

---

### T3 — Core: campaigns.js
**Layer**: Core  
**File**: `core/campaigns.js`  
**Spec**: MinimaAds.md §7.1, §3.1, §3.2  

Implement:
```
getCampaigns(cb)
getCampaign(id, cb)
saveCampaign(campaign, ad, cb)
updateBudget(campaignId, deductAmount, cb)
setCampaignStatus(campaignId, status, cb)
```

- All DB access via `sqlQuery()`
- `saveCampaign` writes to both `CAMPAIGNS` and `ADS` tables
- `updateBudget` uses `MERGE INTO` (never `UPDATE ... ON CONFLICT`)
- All H2 column reads use UPPERCASE keys (`row.CAMPAIGN_ID`)

**Definition of done**:
- [ ] All 5 functions present with correct signatures
- [ ] `saveCampaign` inserts into both tables atomically (sequential sqlQuery calls)
- [ ] No bare `MDS.sql` calls

---

### T4 — Core: selection.js
**Layer**: Core  
**File**: `core/selection.js`  
**Spec**: MinimaAds.md §7.2, §5  

Implement:
```
selectAd(userAddress, userInterests, campaigns)  ← synchronous, returns one campaign or null
```

- Must be **synchronous** — no callbacks, no DB calls
- Input `campaigns` is an array already fetched by `getCampaigns`
- Filter: `status === 'active'`, `budget_remaining > 0`
- Filter: `campaign.CREATOR_ADDRESS.toUpperCase() !== userAddress.toUpperCase()`
- Score by interest overlap, break ties randomly
- Returns the matching campaign object or `null`

**Definition of done**:
- [ ] Function is synchronous (no cb parameter)
- [ ] Creator exclusion applied with `.toUpperCase()` on both sides
- [ ] Returns `null` when no eligible campaigns

---

### T5 — Core: validation.js
**Layer**: Core  
**File**: `core/validation.js`  
**Spec**: MinimaAds.md §7.3, §4, LIMITS  

Implement:
```
validateView(campaignId, userAddress, cb)
validateClick(campaignId, userAddress, cb)
isDuplicate(eventId, cb)
```

- All limits read from `LIMITS` constant — never hardcoded
- `validateView`: checks `REWARD_EVENTS` count per user per campaign per day ≤ `LIMITS.MAX_VIEWS_PER_DAY`
- `validateClick`: checks count per user per campaign per day ≤ `LIMITS.MAX_CLICKS_PER_DAY`
- `isDuplicate`: checks `DEDUP_LOG` for `eventId`
- Callbacks: `cb(null, true)` = valid, `cb(null, false)` = invalid, `cb(err)` = error

**Definition of done**:
- [ ] All 3 functions present with correct signatures
- [ ] No hardcoded limit numbers — all from `LIMITS`
- [ ] `isDuplicate` checks `DEDUP_LOG`, not `REWARD_EVENTS`

---

### T6 — Core: rewards.js
**Layer**: Core  
**File**: `core/rewards.js`  
**Spec**: MinimaAds.md §7.4, §3.3, §3.4  

Implement:
```
createRewardEvent(params, cb)
getUserRewards(userAddress, cb)
getUserProfile(userAddress, cb)
```

- `createRewardEvent`: inserts into `REWARD_EVENTS` and upserts `USER_PROFILE` (`MERGE INTO`)
- `getUserRewards`: returns all reward events for address
- `getUserProfile`: returns profile row for address (or null if not found)
- `params` shape: `{ eventId, campaignId, userAddress, type, amount, timestamp }`

**Definition of done**:
- [ ] `createRewardEvent` writes to both tables
- [ ] `USER_PROFILE` upsert uses `MERGE INTO ... KEY (USER_ADDRESS)`
- [ ] No bare `MDS.sql`

---

### T7 — Service Worker: main.js + db-init.js wiring
**Layer**: Service Worker  
**File**: `public/service-workers/main.js`  
**Spec**: MinimaAds.md §11, AGENTS.md §2, §3  

Implement the SW bootstrap:
- Define `LIMITS` constant object (all values from MinimaAds.md §4)
- Define `APP_NAME = 'minima-ads'`
- `MDS.init(function(msg) { ... })` with event routing:
  - `msg.event === "inited"` → call `initDB()`, then load handler files
  - `msg.event === "MAXIMA"` → call `onMaxima(msg)`
  - `msg.event === "MDS_PENDING"` → call `onPending(msg)`

Load order inside `inited` handler:
```
MDS.load("core/minima.js");
MDS.load("core/campaigns.js");
MDS.load("core/selection.js");
MDS.load("core/validation.js");
MDS.load("core/rewards.js");
MDS.load("public/service-workers/db-init.js");
MDS.load("public/service-workers/handlers/maxima.handler.js");
MDS.load("public/service-workers/handlers/campaign.handler.js");
initDB();
```

**Definition of done**:
- [ ] `LIMITS` and `APP_NAME` defined at top of file
- [ ] All three events routed
- [ ] Load order matches above
- [ ] No `let`, `const`, arrow functions, template literals

---

### T8 — SW Handlers: maxima.handler.js + campaign.handler.js
**Layer**: Service Worker  
**Files**: `public/service-workers/handlers/maxima.handler.js`, `campaign.handler.js`  
**Spec**: MinimaAds.md §8, §11.2, AGENTS.md §9  

`maxima.handler.js` — implement `onMaxima(msg)`:
- Decode payload: `hexToUtf8(msg.data.data)` → JSON parse
- Route by `payload.type`:
  - `"CAMPAIGN_ANNOUNCE"` → `onCampaignAnnounce(payload)`
  - `"CAMPAIGN_PAUSE"` → `onCampaignPause(payload)`
  - `"CAMPAIGN_FINISH"` → `onCampaignFinish(payload)`
- Unknown type → `MDS.log("[MAXIMA] unknown type: " + payload.type)`

`campaign.handler.js` — implement the three handlers (names per MinimaAds.md §11.3):
- `handleCampaignAnnounce(payload)`: calls `saveCampaign(payload.campaign, payload.ad, cb)`, signals FE
- `handleCampaignPause(payload)`: calls `setCampaignStatus(id, 'paused', cb)`, signals FE
- `handleCampaignFinish(payload)`: calls `setCampaignStatus(id, 'finished', cb)`, signals FE

Payload schemas: MinimaAds.md §8.1–§8.3

**Definition of done**:
- [ ] All 3 Maxima types routed
- [ ] Payload decoded with `hexToUtf8`
- [ ] Each handler signals FE on completion (`signalFE(...)`)
- [ ] AGENTS.md §9 Protocol Matrix updated with any new message types

---

### T9 — SDK: sdk/index.js
**Layer**: SDK  
**File**: `sdk/index.js`  
**Spec**: MinimaAds.md §13  

Implement the public publisher API:
```
MinimaAds.init(config, cb)
MinimaAds.getAd(userAddress, interests, cb)
MinimaAds.render(ad, containerId)
MinimaAds.trackView(campaignId, userAddress, cb)
MinimaAds.trackClick(campaignId, userAddress, cb)
```

- `init`: stores config, calls `MDS.init` if not already inited
- `getAd`: calls `getCampaigns` then `selectAd` — returns winning ad or null
- `render`: delegates to `renderAd.js`
- `trackView` / `trackClick`: validate then `createRewardEvent`

**Definition of done**:
- [ ] All 5 functions present on `window.MinimaAds`
- [ ] `trackView`/`trackClick` call `validateView`/`validateClick` first
- [ ] Creator-is-viewer check present in `trackView`/`trackClick`

---

### T10 — Frontend: dapp/app.js + views
**Layer**: UI  
**Files**: `dapp/app.js`, `dapp/views/creator.js`, `dapp/views/viewer.js`, `dapp/views/stats.js`  
**Spec**: MinimaAds.md §12  

`app.js`:
- `MDS.init` for FE
- Listen for `MDSCOMMS` events → dispatch to view handlers
- Route by URL hash: `#creator`, `#viewer`, `#stats`
- Wait for `DB_READY` signal before rendering

`creator.js`: Campaign creation form → calls `broadcastMaxima` with `CAMPAIGN_ANNOUNCE`  
`viewer.js`: Calls `MinimaAds.getAd` → renders ad → `trackView` / `trackClick`  
`stats.js`: Calls `getCampaigns` + `getUserRewards` → renders table  

**Definition of done**:
- [ ] FE waits for `DB_READY` before any DB access
- [ ] `creator.js` broadcasts correct `CAMPAIGN_ANNOUNCE` schema
- [ ] `viewer.js` excludes self from earning (creator check)
- [ ] No `MDS.sql` calls in any view file

---

### T11 — Renderer + MiniDapp config
**Layer**: UI  
**Files**: `renderer/renderAd.js`, `public/index.html`, `dapp.conf` (project root)  
**Spec**: MinimaAds.md §12.3, §14  

`renderAd.js`: Takes an ad object and a container element ID, injects HTML.  
`index.html`: Shell HTML — loads `mds.js`, `dapp/app.js`, view scripts.  
`dapp.conf`: MiniDapp manifest — `name`, `icon`, `version`, `permission` fields.  

**Definition of done**:
- [ ] `renderAd` sanitises ad fields before injecting into DOM (XSS)
- [ ] `index.html` loads scripts in correct order (mds.js first)
- [ ] `dapp.conf` has required Minima manifest fields

---

### T12 — Remove CAMPAIGN_ANNOUNCE broadcast to contacts
**Layer**: Service Worker + UI
**Files**: `dapp/views/creator.js`, `public/service-workers/main.js`
**Spec**: MinimaAds.md §8.1

With on-chain discovery (NEWBLOCK → escrow coins → REQUEST/RESPONSE) as the primary distribution mechanism, the `sendall` broadcast via Maxima contacts is redundant. All nodes with the DApp installed discover campaigns independently via the escrow coin.

Remove:
- `broadcastMaxima(payload, ...)` call in `dapp/views/creator.js` after `saveCampaign`
- `rebroadcastActiveCampaigns()` stub and `_timerTicks` / `REBROADCAST_EVERY_TICKS` logic in `main.js`
- `onTimer()` re-broadcast block (keep the function stub if needed for future use)

Update:
- MinimaAds.md §8.1 — remove "Maxima broadcast" section, on-chain discovery is the only mechanism
- MinimaAds.md §6.3 step 7 — remove "SW broadcasts CAMPAIGN_ANNOUNCE" step
- AGENTS.md §9 — remove CAMPAIGN_ANNOUNCE, CAMPAIGN_PAUSE, CAMPAIGN_FINISH from protocol matrix (those types are no longer sent proactively; only REQUEST/RESPONSE remain)
- AGENTS.md §7.2 — remove MDS_TIMER_10SECONDS handler if timer no longer needed

**Note**: `CAMPAIGN_PAUSE` and `CAMPAIGN_FINISH` should also be evaluated — if creators no longer broadcast to contacts, those signals won't propagate. Either implement a pull model for status changes (poll the escrow coin state: if coin is spent/gone, campaign is finished) or keep a minimal broadcast for status changes only.

**Definition of done**:
- [ ] No `sendall` calls in creator flow
- [ ] No re-broadcast timer logic
- [ ] MinimaAds.md §8.1 updated
- [ ] On-chain discovery is the sole campaign distribution mechanism

---

## Status

| Task | Layer | File(s) | Status |
|---|---|---|---|
| T1 | DB Schema | `public/service-workers/db-init.js` | Done |
| T2 | Core | `core/minima.js` | Done |
| T3 | Core | `core/campaigns.js` | Done |
| T4 | Core | `core/selection.js` | Done |
| T5 | Core | `core/validation.js` | Done |
| T6 | Core | `core/rewards.js` | Done |
| T7 | SW | `public/service-workers/main.js` | Done |
| T8 | SW | `public/service-workers/handlers/*.js` | Done |
| T9 | SDK | `sdk/index.js` | Done |
| T10 | UI | `dapp/app.js`, `dapp/views/*.js` | Done |
| T11 | UI | `renderer/renderAd.js`, `public/index.html`, `public/dapp.conf` | Done |
| T12 | SW + UI | `creator.js`, `main.js` | Pending |
| **T-CH1** | **DB** | `db-init.js` (×2 runtimes) | Done |
| **T-CH2** | **Core** | `core/channels.js` (nou) | ⬜ |
| **T-CH3** | **SW** | `handlers/channel.handler.js` (nou) + `maxima.handler.js` | ⬜ |
| **T-CH4** | **FE** | `dapp/views/creator.js`, `dapp/app.js` | ⬜ |
| **T-CH5** | **SDK** | `sdk/index.js` | ⬜ |
| **T-CH6** | **UI** | `dapp/views/viewer.js` | ⬜ |

---

## Canal unidireccional — Payment Channels (T-CH1 → T-CH6)

> Implementació dels canals de recompensa (MinimaAds.md §4.4, §6.5–6.8, §7.6, §8.8–8.12, Appendix C).
> Ordre obligatori: T-CH1 → T-CH2 → T-CH3 → T-CH4 → T-CH5 → T-CH6.
> Llegir MinimaAds.md §6.5–6.8 complet abans de qualsevol tasca d'aquest bloc.

---

### T-CH1 — DB: taula CHANNEL_STATE

| Camp | Valor |
|---|---|
| **Status** | Done ✅ |
| **Agent** | Sonnet |
| **Fitxers** | `public/service-workers/db-init.js`, FE DB init |
| **Spec** | MinimaAds.md §3.5, AGENTS.md §8 |

**Prompt:**
```
You are implementing T-CH1 for MinimaAds. Read CLAUDE.md, MinimaAds.md §3.5, and AGENTS.md §8 before writing any code.

Task: Add the CHANNEL_STATE table to BOTH runtimes (SW and FE).

The exact schema is in MinimaAds.md §3.5. Key points:
- PRIMARY KEY is (CAMPAIGN_ID, VIEWER_KEY) — composite, not single column
- Use CREATE TABLE IF NOT EXISTS
- SW runtime: Rhino-safe syntax (var, function(), string concat, no trailing commas, MDS.log not console.log)
- Both runtimes must initialize exactly the same table
- Add the CREATE TABLE call in the same place as the other tables in each file

Files to modify:
1. public/service-workers/db-init.js (SW)
2. Find the FE DB init location (check dapp/app.js — search for CREATE TABLE)

Do NOT modify any other file. Do NOT change existing tables.

Provide the standard handoff note (CLAUDE.md §10) when done.
```

---

### T-CH2 — Core: channels.js

| Camp | Valor |
|---|---|
| **Status** | ⬜ |
| **Agent** | Sonnet |
| **Fitxers** | `core/channels.js` (nou fitxer) |
| **Spec** | MinimaAds.md §7.6, §3.5 |

**Prompt:**
```
You are implementing T-CH2 for MinimaAds. Read CLAUDE.md, MinimaAds.md §7.6 and §3.5, and AGENTS.md §8 before writing any code.

Task: Create core/channels.js with these 6 functions (signatures are contracts — do not alter):

  openChannel(campaignId, viewerKey, creatorMx, maxAmount, cb)
    → MERGE INTO CHANNEL_STATE (status='pending')
    → then calls updateBudget(campaignId, maxAmount, cb) to deduct from BUDGET_REMAINING
    → cb(err, boolean)

  activateChannel(campaignId, viewerKey, channelCoinId, cb)
    → UPDATE CHANNEL_STATE SET STATUS='open', CHANNEL_COINID=channelCoinId
    → cb(err, boolean)

  getChannelState(campaignId, viewerKey, cb)
    → SELECT * FROM CHANNEL_STATE WHERE UPPER(CAMPAIGN_ID)=... AND UPPER(VIEWER_KEY)=...
    → cb(err, row | null)

  updateChannelVoucher(campaignId, viewerKey, cumulativeEarned, latestTxHex, cb)
    → MERGE INTO CHANNEL_STATE updating CUMULATIVE_EARNED and LATEST_TX_HEX
    → cb(err, boolean)

  getLatestVoucher(campaignId, viewerKey, cb)
    → returns { latest_tx_hex, cumulative_earned } or null
    → cb(err, object | null)

  settleChannel(campaignId, viewerKey, cb)
    → UPDATE CHANNEL_STATE SET STATUS='settled'
    → cb(err, boolean)

Rules:
- All DB access via sqlQuery() from core/minima.js — no bare MDS.sql
- All H2 column reads use UPPERCASE keys (row.CAMPAIGN_ID, row.STATUS, etc.)
- All user strings through escapeSql()
- String comparisons via UPPER() on both sides
- Rhino-safe: var, function(), string concatenation, no trailing commas
- MERGE INTO ... KEY(CAMPAIGN_ID, VIEWER_KEY) for upserts

Provide the standard handoff note (CLAUDE.md §10) when done.
```

---

### T-CH3 — SW: channel.handler.js + maxima.handler.js

| Camp | Valor |
|---|---|
| **Status** | ⬜ |
| **Agent** | Sonnet |
| **Fitxers** | `public/service-workers/handlers/channel.handler.js` (nou), `maxima.handler.js` |
| **Spec** | MinimaAds.md §6.5–6.8, §8.8–8.12, §11.3 |

**Prompt:**
```
You are implementing T-CH3 for MinimaAds. Read CLAUDE.md, MinimaAds.md §6.5–6.8 §8.8–8.12 §11.3, and AGENTS.md §9 §10 before writing any code.

Task: Create handlers/channel.handler.js and update maxima.handler.js.

CRITICAL ARCHITECTURE NOTE: Channel coin creation (CHANNEL_OPEN_REQUEST handler) and partial tx signing (REWARD_REQUEST handler) CANNOT run in the SW — they require MDS.cmd('send'/'txncreate'/'txnsign') which may trigger pending approval and must run in the FE. The SW handlers must signal the FE to perform these operations via signalFE().

channel.handler.js — implement these 5 functions:

handleChannelOpenRequest(payload):
  - payload: { campaign_id, viewer_key, viewer_mx, max_amount }
  - Creator side: validate campaign active + budget sufficient via getCampaign()
  - Write CHANNEL_STATE via openChannel() (status='pending')
  - signalFE('DO_CHANNEL_OPEN', { campaign_id, viewer_key, viewer_mx, max_amount })
  - The FE (dapp/app.js) will do the actual coin creation and send CHANNEL_OPEN

handleChannelOpen(payload):
  - payload: { campaign_id, viewer_key, channel_coinid, max_amount }
  - Viewer side: call activateChannel(campaign_id, viewer_key, channel_coinid, cb)
  - signalFE('CHANNEL_OPENED', { campaign_id, channel_coinid, max_amount })

handleRewardRequest(payload):
  - payload: { campaign_id, viewer_key, event_id, cumulative }
  - Creator side: validate via getChannelState() — channel open, cumulative <= MAX_AMOUNT
  - Idempotency: check DEDUP_LOG for event_id via isDuplicate()
  - signalFE('DO_REWARD_VOUCHER', { campaign_id, viewer_key, viewer_mx, event_id, cumulative })
  - The FE will build the partial tx and send REWARD_VOUCHER

handleRewardVoucher(payload):
  - payload: { campaign_id, viewer_key, event_id, cumulative, tx_hex }
  - Viewer side: call updateChannelVoucher(campaign_id, viewer_key, cumulative, tx_hex, cb)
  - Remove event_id from DEDUP_LOG pending (add to DEDUP_LOG if not present)
  - signalFE('VOUCHER_RECEIVED', { campaign_id, cumulative })

handleVoucherSyncRequest(payload):
  - payload: { campaign_id, viewer_key }
  - Creator side: getLatestVoucher() → if exists: signalFE('DO_SEND_VOUCHER', {...})
  - The FE re-sends the REWARD_VOUCHER Maxima message

maxima.handler.js: add 5 new else-if branches routing to the channel handlers above.
All Rhino constraints apply. No console.log, no let/const, no arrow functions, no template literals.

Provide the standard handoff note (CLAUDE.md §10) when done.
```

---

### T-CH4 — FE: creator.js + app.js (canal open + tx signing)

| Camp | Valor |
|---|---|
| **Status** | ⬜ |
| **Agent** | **Opus** |
| **Fitxers** | `dapp/views/creator.js`, `dapp/app.js` |
| **Spec** | MinimaAds.md §6.3, §6.5, §8.8–8.9, §8.13, Appendix B §B.5, Appendix C §C.5 |

> **Opus** perquè inclou construcció de txs parcials (txncreate/txninput/txnoutput/txnsign/txnexport) i el flux de pending approval del canal.

**Prompt:**
```
You are implementing T-CH4 for MinimaAds. Read CLAUDE.md, MinimaAds.md §6.3 §6.5 §8.8 §8.9 §8.13 Appendix B §B.5 Appendix C §C.5, and AGENTS.md before writing any code.

Task: Update creator.js and app.js for channel support.

PART 1 — creator.js changes:
1. Replace the `keys action:list → keys[0].publickey` call with `keys action:new → key.publickey`
   The response shape for `keys action:new` is res.response.key.publickey (not keys[0]).
   Verify this against refs/Minima-1.0.45/src/org/minima/system/mds/runnable/MDSJS.java before assuming.
2. After resolveEscrowAddress(), also resolve CHANNEL_SCRIPT_ADDRESS:
   - Check keypair 'CHANNEL_SCRIPT_ADDRESS'
   - If missing: run newscript with the channel script (MinimaAds.md Appendix C §C.5)
   - Store result in keypair 'CHANNEL_SCRIPT_ADDRESS'

PART 2 — app.js new MDSCOMMS handlers (creator side):

Handler for signal 'DO_CHANNEL_OPEN' (from channel.handler.js SW):
  data: { campaign_id, viewer_key, viewer_mx, max_amount }
  1. Get ESCROW_COINID for campaign from DB (getCampaign())
  2. Get CHANNEL_SCRIPT_ADDRESS from keypair
  3. Get creator wallet pk (ESCROW_WALLET_PK from campaign record)
  4. Construct tx (Appendix B §B.5 "Channel Open"):
     MDS.cmd('txncreate id:ch_<uid>')
     MDS.cmd('txninput id:ch_<uid> coinid:<ESCROW_COINID> scriptmmr:true')
     MDS.cmd('txnoutput id:ch_<uid> storestate:false amount:<max_amount> address:<CHANNEL_SCRIPT_ADDRESS>')
     MDS.cmd('txnoutput id:ch_<uid> storestate:true amount:<remaining> address:<ESCROW_ADDRESS>')
     MDS.cmd('txnstate id:ch_<uid> port:1 value:<creator_wallet_pk>')
     MDS.cmd('txnstate id:ch_<uid> port:2 value:<expiry_block>')
     MDS.cmd('txnstate id:ch_<uid> port:3 value:<campaign_id_hex>')
     MDS.cmd('txnstate id:ch_<uid> port:4 value:<creator_mx_address>')
     MDS.cmd('txnstate id:ch_<uid> port:10 value:<max_amount>')
     MDS.cmd('txnsign id:ch_<uid> publickey:<creator_wallet_pk>')
     MDS.cmd('txnpost id:ch_<uid> mine:true auto:true')
  5. On sendRes.pending: store in keypair and show "Awaiting approval…"
  6. On success: extract new escrow change coinid → update CAMPAIGNS.ESCROW_COINID
     Extract channel coinid (output[0].coinid) → send CHANNEL_OPEN Maxima to viewer_mx (poll:true)

Handler for signal 'DO_REWARD_VOUCHER' (from channel.handler.js SW):
  data: { campaign_id, viewer_key, viewer_mx, event_id, cumulative }
  1. Get channel state from DB (CHANNEL_COINID, MAX_AMOUNT, ESCROW_WALLET_PK)
  2. Get viewer wallet address (derived from viewer_key: MDS.cmd('getaddress publickey:<viewer_key>'))
  3. Get creator change address (MDS.cmd('getaddress publickey:<creator_wallet_pk>'))
  4. Construct partial tx (Appendix C §C.4):
     txncreate → txninput(CHANNEL_COINID) → txnoutput(viewer_address, cumulative)
     → txnoutput(creator_address, MAX_AMOUNT-cumulative) → txnsign(creator_wallet_pk) → txnexport
  5. Send REWARD_VOUCHER to viewer_mx (poll:true) with tx_hex: MinimaAds.md §8.11

Handler for signal 'DO_SEND_VOUCHER':
  Re-sends last REWARD_VOUCHER for (campaign_id, viewer_key) from CHANNEL_STATE.LATEST_TX_HEX

Register new MDSCOMMS handlers in app.js for incoming viewer-side signals:
  CHANNEL_OPENED, VOUCHER_RECEIVED, AUTO_SETTLE, SETTLE_CONFIRMED → delegate to viewer.js handlers

Provide the standard handoff note (CLAUDE.md §10) when done.
```

---

### T-CH5 — SDK: channel open request + reward request

| Camp | Valor |
|---|---|
| **Status** | ⬜ |
| **Agent** | Sonnet |
| **Fitxers** | `sdk/index.js` |
| **Spec** | MinimaAds.md §6.5, §6.6, §6.8, §8.8–8.12 |

**Prompt:**
```
You are implementing T-CH5 for MinimaAds. Read CLAUDE.md, MinimaAds.md §6.5 §6.6 §6.8 §8.8–8.12, and AGENTS.md before writing any code.

Task: Update sdk/index.js to integrate the payment channel flow after createRewardEvent().

In _trackEvent(), after createRewardEvent() succeeds, add:

1. getChannelState(campaignId, viewerKey, function(err, channel) {
     if (!channel) {
       // First interaction — open a channel
       MDS.cmd('keys action:new', function(res) {
         var viewerKey = res.response.key.publickey;
         var maxAmount = ...; // compute: (REWARD_VIEW + REWARD_CLICK) * campaign_days
         openChannel(campaignId, viewerKey, creatorMx, maxAmount, function() {
           // Store pending reward in keypair
           MDS.keypair.set('PENDING_REWARD_' + campaignId + '_' + eventId, JSON.stringify({ cumulative, viewerKey }), function() {});
           // Send CHANNEL_OPEN_REQUEST to creator
           sendMaxima(creatorMx, { type: 'CHANNEL_OPEN_REQUEST', campaign_id, viewer_key: viewerKey, viewer_mx: MY_MX_ADDRESS, max_amount: maxAmount });
           // Show status message to user
         });
       });
     } else if (channel.STATUS === 'pending') {
       // Channel opening — accumulate pending reward
       MDS.keypair.set('PENDING_REWARD_' + campaignId + '_' + eventId, JSON.stringify({ cumulative, viewerKey: channel.VIEWER_KEY }), function() {});
     } else if (channel.STATUS === 'open') {
       // Send reward request
       var newCumulative = parseFloat(channel.CUMULATIVE_EARNED) + amount;
       MDS.keypair.set('PENDING_REWARD_' + campaignId + '_' + eventId, '1', function() {});
       sendMaxima(channel.CREATOR_MX, { type: 'REWARD_REQUEST', campaign_id, viewer_key: channel.VIEWER_KEY, event_id: eventId, cumulative: newCumulative });
     }
   });

On CHANNEL_OPENED signal received (via MDS.comms or from app.js):
  - activateChannel(campaign_id, channel_coinid)
  - Flush pending: read keypair entries PENDING_REWARD_<campaignId>_*, send REWARD_REQUEST for each

On VOUCHER_RECEIVED signal:
  - MDS.keypair.set('PENDING_REWARD_' + campaign_id + '_' + event_id, '', function() {})

On app reconnect (init time):
  - Scan keypair for PENDING_REWARD_* entries
  - For each with open channel: resend REWARD_REQUEST
  - If LATEST_TX_HEX missing for open channel: send VOUCHER_SYNC_REQUEST

MY_MX_ADDRESS and MY_ADDRESS are globals defined in dapp/app.js. Use them directly.
sendMaxima() helper: use broadcastMaxima or direct MDS.cmd with poll:true to specific Mx address.
campaign_days = Math.ceil(CAMPAIGN_DURATION_BLOCKS / 1728).

Provide the standard handoff note (CLAUDE.md §10) when done.
```

---

### T-CH6 — UI: viewer settlement

| Camp | Valor |
|---|---|
| **Status** | ⬜ |
| **Agent** | Sonnet |
| **Fitxers** | `dapp/views/viewer.js` |
| **Spec** | MinimaAds.md §6.7, §8.13 |

**Prompt:**
```
You are implementing T-CH6 for MinimaAds. Read CLAUDE.md, MinimaAds.md §6.7 §8.13, and AGENTS.md before writing any code.

Task: Update dapp/views/viewer.js to support channel settlement.

Add to the viewer UI (below the existing earned balance):

1. A per-campaign pending rewards section that shows CUMULATIVE_EARNED for each open channel.
   Read from CHANNEL_STATE WHERE STATUS='open' AND LATEST_TX_HEX != '' for the current viewer.

2. "Settle rewards" button per campaign:
   On click — runs settlement flow:
     MDS.cmd('txnimport data:' + tx_hex, function(res) {
       var txnId = res.response.txnid;
       MDS.cmd('txnsign txnid:' + txnId + ' publickey:' + viewer_key, function() {
         MDS.cmd('txnpost txnid:' + txnId + ' mine:true auto:true', function(postRes) {
           if (postRes.status) {
             settleChannel(campaign_id, viewer_key, function() {
               // Update UI: show "Settled X MINIMA"
             });
           }
         });
       });
     });

3. AUTO_SETTLE signal handler (called from app.js when campaign finishes):
   Receives { campaign_id, viewer_key, tx_hex }
   Runs the same txnimport → txnsign → txnpost flow automatically without user interaction.
   Shows a notification: "Reward channel settled automatically".

4. onRewardConfirmed() already handles session balance — no change needed.
   VOUCHER_RECEIVED signal should refresh the pending rewards section display.

VIEWER_KEY for a channel is stored in CHANNEL_STATE.VIEWER_KEY.
Use getLatestVoucher() and getChannelState() from core/channels.js to read data.

Provide the standard handoff note (CLAUDE.md §10) when done.
```
