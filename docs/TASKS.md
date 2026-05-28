# MinimaAds — Implementation Task List

> Ordered task list for agent sessions.
> Tasks must be implemented in sequence — each task depends on the previous one.
> One task per agent session. Fill in `docs/PromptBase.md` §6 with the task before sending.

---

## Sequence Rule

```
T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9 → T10 → T11 → T12
T-CH1 → T-CH2 → T-CH3 → T-CH4 → T-CH5 → T-CH6 → T-CH7 → T-CH8 → T-CH9
T-PUB1 → T-PUB2 → T-PUB3 → T-PUB4 → T-PUB5 → T-PUB6 → T-PUB7 → T-PUB8
T-SC1 → T-SC2 → T-SC3 → T-SC4 → T-SC5 → T-SC6 → T-SC7
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
**File**: `service.js`  
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
**Files**: `dapp/views/creator.js`, `service.js`
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
| T7 | SW | `service.js` | Done |
| T8 | SW | `public/service-workers/handlers/*.js` | Done |
| T9 | SDK | `sdk/index.js` | Done |
| T10 | UI | `dapp/app.js`, `dapp/views/*.js` | Done |
| T11 | UI | `renderer/renderAd.js`, `public/index.html`, `public/dapp.conf` | Done |
| T12 | SW + UI | `creator.js`, `service.js` | Done ✅ |
| **T-CH1** | **DB** | `db-init.js` (×2 runtimes) | Done |
| **T-CH2** | **Core** | `core/channels.js` (nou) | Done |
| **T-CH3** | **SW** | `handlers/channel.handler.js` (nou) + `maxima.handler.js` | Done |
| **T-CH4** | **FE** | `dapp/views/creator.js`, `dapp/app.js` | Done |
| **T-CH5** | **SDK** | `sdk/index.js` | Done |
| **T-CH6** | **UI** | `dapp/views/viewer.js` | Done |
| **T-CH7** | **DB + Core + SDK + UI** | `db-init.js` (×2), `campaigns.js`, `sdk/index.js`, `creator.js`, `channel.handler.js` | Done ✅ |
| **T-CH8** | **SW** | `channel.handler.js`, `main.js` | Done ✅ |
| **T-CH9** | **FE** | `dapp/app.js` | Done ✅ |
| **T-PUB1** | **DB** | `db-init.js` (×2 runtimes) | Done ✅ |
| **T-PUB2** | **Core** | `core/frames.js` (new) | Done ✅ |
| **T-PUB3** | **Config + SW** | `config.js` (new), `campaign.handler.js` | Done ✅ |
| **T-PUB4** | **Contract + FE** | `dapp/views/creator.js`, `dapp/app.js` | Done ✅ |
| **T-PUB5** | **SDK** | `sdk/index.js` | Done ✅ |
| **T-PUB6** | **UI** | `dapp/views/creator.js` | Done ✅ |
| **T-PUB7** | **UI + SW** | `dapp/views/frames.js` (new), `dapp/app.js`, `service.js` | Done ✅ |
| **T-PUB8** | **SW + FE** | `channel.handler.js`, `core/channels.js`, `dapp/app.js` | Done ✅ |
| **T-SC1** | **Spec** | `MinimaAds.md`, `AGENTS.md` | Done ✅ |
| **T-SC2** | **SW** | `service.js` | Done ✅ |
| **T-SC3** | **FE** | `dapp/views/creator.js`, `dapp/app.js` | Pending ⬜ |
| **T-SC4** | **SW** | `public/service-workers/handlers/campaign.handler.js` | Pending ⬜ |
| **T-SC5** | **Core** | `core/campaigns.js` | Pending ⬜ |
| **T-SC6** | **FE** | `dapp/app.js`, `dapp/views/mycampaigns.js` | Pending ⬜ |
| **T-SC7** | **Docs** | `docs/KNOWN_ISSUES.md`, `docs/VERIFICATION.md`, `AGENTS.md` | Pending ⬜ |

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
| **Status** | Done ✅ |
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
| **Status** | Done ✅ |
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
| **Status** | Done ✅ |
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
| **Status** | Done ✅ |
| **Agent** | Opus |
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

---

### T-CH7 — Campaign field: MAX_VIEWER_REWARD

| Camp | Valor |
|---|---|
| **Status** | Pending ⬜ |
| **Agent** | Sonnet |
| **Fitxers** | `public/service-workers/db-init.js`, `dapp/app.js` (initFEChannelState), `core/campaigns.js`, `sdk/index.js`, `dapp/views/creator.js`, `public/service-workers/handlers/campaign.handler.js` |
| **Spec** | MinimaAds.md §3.5 (CAMPAIGNS schema), §8.3 (CAMPAIGN_ANNOUNCE), §6.5 (channel open flow) |

**Context:**
Actualment `maxAmount` del canal es calcula a `sdk/index.js` com `(REWARD_VIEW + REWARD_CLICK) × campaign_days`. Això fa que campanyes llargues bloquegin molt capital per canal (ex: 100 dies × 0.11 = 11 MINIMA per viewer). Un camp explícit `MAX_VIEWER_REWARD` dóna al creador control predictible del cost per viewer.

Side-effect positiu: el viewer veu el coin d'escrow del creador al seu `confirmed` (trackall:true). Quan s'obre el canal, veu `-maxAmount` al seu historial. Reduir `maxAmount` amb `MAX_VIEWER_REWARD` redueix aquesta confusió visual.

**Prompt:**
```
You are implementing T-CH7 for MinimaAds. Read CLAUDE.md, MinimaAds.md §3.5 §8.3 §6.5, and AGENTS.md §8 §9 before writing any code.

Task: Add optional field MAX_VIEWER_REWARD to CAMPAIGNS, allowing creators to
set an explicit cap on the MINIMA reserved per viewer channel. If set, this
replaces the automatic formula (REWARD_VIEW + REWARD_CLICK) × campaign_days.

Implement in this order:

1. DB SCHEMA — both runtimes (dev workflow: fix CREATE TABLE only, no ALTER TABLE):
   Add to CAMPAIGNS table in public/service-workers/db-init.js AND initFEChannelState
   equivalent for CAMPAIGNS in dapp/app.js:
     MAX_VIEWER_REWARD DECIMAL(20,6) DEFAULT NULL
   Dev note: DB is reset on MiniDapp reinstall — no migration statement needed.

2. CORE — core/campaigns.js:
   saveCampaign(campaign, ad, cb) already uses a MERGE INTO CAMPAIGNS.
   Ensure MAX_VIEWER_REWARD is included in the column list and VALUES.
   The field comes from campaign.MAX_VIEWER_REWARD (may be null/undefined → store NULL).
   Do NOT change the function signature.

3. SDK — sdk/index.js, function _computeMaxAmount(campaign):
   Current implementation:
     function _computeMaxAmount(campaign) {
       var rv = parseFloat(campaign.REWARD_VIEW) || 0;
       var rc = parseFloat(campaign.REWARD_CLICK) || 0;
       return (rv + rc) * _campaignDays();
     }
   New implementation:
     function _computeMaxAmount(campaign) {
       var explicit = parseFloat(campaign.MAX_VIEWER_REWARD);
       if (explicit > 0) { return explicit; }
       var rv = parseFloat(campaign.REWARD_VIEW) || 0;
       var rc = parseFloat(campaign.REWARD_CLICK) || 0;
       return (rv + rc) * _campaignDays();
     }
   No other changes to sdk/index.js.

4. SW HANDLER — public/service-workers/handlers/campaign.handler.js,
   function handleCampaignAnnounce(payload):
   Extract max_viewer_reward from payload (may be absent — backward-compat).
   Pass it into the campaign object before calling saveCampaign().
   If payload.max_viewer_reward is absent or null → campaign.MAX_VIEWER_REWARD = null.

5. UI — dapp/views/creator.js, campaign creation form:
   Add an optional numeric input: "Max reward per viewer (MINIMA)".
   Placeholder / hint: "Leave empty to auto-calculate: (view + click) × days"
   If left empty → do not include max_viewer_reward in the campaign object
     (or set to null) → stored as NULL → formula applies.
   Include max_viewer_reward in the CAMPAIGN_ANNOUNCE Maxima payload if set.

6. Update MinimaAds.md:
   §3.5 CAMPAIGNS schema: add MAX_VIEWER_REWARD DECIMAL(20,6) DEFAULT NULL row.
   §8.3 CAMPAIGN_ANNOUNCE payload: add optional field max_viewer_reward (number | null).

7. Update AGENTS.md:
   §8 CAMPAIGNS table: add MAX_VIEWER_REWARD row.
   §9 Protocol Matrix: update CAMPAIGN_ANNOUNCE note to mention optional field.

Rules:
- Backward compatible: nodes receiving CAMPAIGN_ANNOUNCE without max_viewer_reward
  must work identically to before (field absent → NULL → formula used).
- No hardcoded LIMITS values.
- SW code: Rhino-safe (var, function(), string concat, MDS.log, no trailing commas).
- Do NOT modify any file not listed above.

Definition of done:
- [ ] MAX_VIEWER_REWARD in CAMPAIGNS CREATE TABLE (both runtimes)
- [ ] saveCampaign() stores the field (NULL if not provided)
- [ ] _computeMaxAmount() uses explicit value if > 0, formula otherwise
- [ ] handleCampaignAnnounce() extracts and forwards the field
- [ ] Creator form has optional input; CAMPAIGN_ANNOUNCE includes field when set
- [ ] MinimaAds.md §3.5 + §8.3 updated
- [ ] AGENTS.md §8 + §9 updated

Verification: create campaign with MAX_VIEWER_REWARD = 0.50. Verify that the
channel coin is created with amount 0.50 regardless of campaign duration.
Also verify that a campaign without MAX_VIEWER_REWARD still uses the formula.

Provide the standard handoff note (CLAUDE.md §10) when done.
```

---

### T-CH8 — SW: NEWBLOCK-driven pending voucher queue

| Camp | Valor |
|---|---|
| **Status** | Pending ⬜ |
| **Agent** | Sonnet |
| **Fitxers** | `public/service-workers/handlers/channel.handler.js`, `service.js` |
| **Spec** | MinimaAds.md §6.6, §8.10, AGENTS.md §12 fragility #26, §14 bug #15 |

**Context:**
El bug #15 (coin not found) s'ha corregit provisionalment augmentant el retry loop del FE a 20×5s (100s). Aquesta tasca implementa la solució estructural: el SW desa el `REWARD_REQUEST` pendent quan el canal acaba d'obrir-se i el coin encara no és indexat; quan arriba un `NEWBLOCK` i el coin ja és visible, el SW activa el voucher flow. Elimina qualsevol dependència de timing al FE.

**Prompt:**
```
You are implementing T-CH8 for MinimaAds. Read CLAUDE.md, MinimaAds.md §6.6 §8.10, AGENTS.md §12 fragility #26 and §14 bug #15 before writing any code.

Background: When a REWARD_REQUEST arrives at the creator's SW, the FE must build a voucher tx spending the channel coin via txninput coinid:<channelCoinId> scriptmmr:true. This fails if the coin was just mined and has not yet been indexed by the node (~62s observed delay). The current workaround is a 20×5s retry loop in the FE. This task replaces that workaround with a NEWBLOCK-driven event model in the SW.

Task: Implement a pending-voucher queue in the SW so that if handleRewardRequest() cannot immediately proceed (because the coin is not yet indexed), the request is saved and retried on each NEWBLOCK until the coin is findable.

Implementation plan:

1. In channel.handler.js — modify handleRewardRequest():
   After all validation passes (channel open, cumulative valid, not duplicate),
   instead of signalling DO_REWARD_VOUCHER immediately:
   a. Run `MDS.cmd("coins coinid:<channelCoinId> relevant:true", cb)` to check if the coin is indexed.
   b. If coin found (res.response.length > 0): signal DO_REWARD_VOUCHER immediately (current behaviour).
   c. If NOT found: save the pending request to keypair:
      Key: "PENDING_VOUCHER_<campaignId>_<viewerKey>"
      Value: JSON string of { campaign_id, viewer_key, viewer_mx, event_id, cumulative, channel_coinid }
      Log: MDS.log("[CHANNEL] coin not yet indexed, queuing voucher for NEWBLOCK: " + campaignId)

2. In channel.handler.js — add new function checkPendingVouchers():
   a. Query all channel states that have STATUS='open': SELECT CAMPAIGN_ID, VIEWER_KEY, CHANNEL_COINID, CREATOR_MX FROM CHANNEL_STATE WHERE STATUS='open'
   b. For each row, check if keypair "PENDING_VOUCHER_<campaignId>_<viewerKey>" has a value.
   c. If it does: run `MDS.cmd("coins coinid:<channelCoinId> relevant:true", cb)`
      - If coin found: read the pending payload from keypair, clear the keypair entry (set to ''), then signal DO_REWARD_VOUCHER.
      - If not yet found: log and leave in queue.

3. In main.js — inside the NEWBLOCK handler (line 119: `if (msg.event === "NEWBLOCK")`):
   Add a call to checkPendingVouchers() after scanEscrowCoins():
     if (msg.event === "NEWBLOCK") { scanEscrowCoins(); checkPendingVouchers(); }

Rules:
- Rhino-safe: var, function(), string concat, MDS.log, no trailing commas, no arrow functions.
- All DB access via sqlQuery(). No bare MDS.sql.
- checkPendingVouchers() must be defined in channel.handler.js (loaded before main.js event dispatch).
- The keypair key format must be exactly "PENDING_VOUCHER_<campaignId>_<viewerKey>" (no spaces, verbatim).
- Do NOT modify any other file.
- Do NOT change the DO_REWARD_VOUCHER signal schema — it is a contract.

Definition of done:
- [ ] handleRewardRequest() checks coin indexing before signalling
- [ ] Un-indexed coins are saved to keypair with correct key format
- [ ] checkPendingVouchers() reads all open channels and checks their pending queue
- [ ] On NEWBLOCK: checkPendingVouchers() is called after scanEscrowCoins()
- [ ] On coin found: keypair cleared + DO_REWARD_VOUCHER signalled
- [ ] No 20×5s retry loop — that is removed in T-CH9

Verification: open a channel and trigger a view reward immediately after channel-open confirmation. The creator SW log should show "[CHANNEL] coin not yet indexed, queuing voucher for NEWBLOCK: <id>" and then, within 1–3 blocks, "[CHANNEL] pending voucher found, signalling FE: <id>". The FE should receive DO_REWARD_VOUCHER without retries.

Provide the standard handoff note (CLAUDE.md §10) when done.
```

---

### T-CH9 — FE: remove retry loop from buildAndExportVoucherTx

| Camp | Valor |
|---|---|
| **Status** | Pending ⬜ (depends on T-CH8) |
| **Agent** | Sonnet |
| **Fitxers** | `dapp/app.js` |
| **Spec** | AGENTS.md §14 bug #15 |

**Context:**
Amb T-CH8 implementat, el SW garanteix que `DO_REWARD_VOUCHER` només s'emet quan el coin del canal ja és indexat. El retry loop del FE (`retries < 20`, `setTimeout 5000`) és per tant redundant i pot emmascarar errors reals. Aquesta tasca el neteja.

**Prompt:**
```
You are implementing T-CH9 for MinimaAds. Read CLAUDE.md and AGENTS.md §14 bug #15 before writing any code. T-CH8 must be Done before starting this task.

Task: Simplify buildAndExportVoucherTx() in dapp/app.js by removing the retry-on-not-found logic. After T-CH8, the SW guarantees DO_REWARD_VOUCHER is only signalled once the channel coin is indexed — so a "not found" txninput response is a genuine error, not a timing issue.

Changes to dapp/app.js, function buildAndExportVoucherTx(ctx, _retries):

1. Remove the _retries parameter and all retry logic:
   - Remove: `var retries = (_retries === undefined) ? 0 : _retries;`
   - Remove: the `if (retries < 20 && ...) { setTimeout(...) }` branch
   - Remove: the `buildAndExportVoucherTx(ctx, retries + 1)` recursive call

2. On txninput failure (coin not found or any error):
   - Log the error clearly: console.error('[CHANNEL] txninput failed (coin should be indexed by now):', r2.error, 'campaign:', ctx.campaignId)
   - Call fail('txninput', r2) and return — no retry, no channel state clear.
   (Channel state clear was a safety net for the retry case; without retries it is not needed here.)

3. The coindata path (ctx.channelCoinData branch) was the experimental workaround from bug #15.
   Remove it entirely:
   - Remove: the `if (ctx.channelCoinData) { MDS.cmd('txninput ... coindata:...') }` block
   - Remove: `loadChannelCoinData()` call in handleDoRewardVoucher()
   - Remove: the channelCoinData field from the ctx object passed to buildAndExportVoucherTx()
   - The function now always uses `txninput coinid:<channelCoinId> scriptmmr:true`.

4. Also remove the now-unused helper functions and keypair accessors related to coindata:
   - saveChannelCoinData(), loadChannelCoinData(), channelCoinDataKey() — if they are defined in app.js
   - Remove the `saveChannelCoinData(...)` call in buildAndPostChannelTx() after txnlist

5. The txnlist call in buildAndPostChannelTx() was used only to capture outputcoindata.
   Remove it:
   - Remove: `MDS.cmd('txnlist id:' + txId, function(r7) { ... saveChannelCoinData(...) ... })`
   - Replace with: call finalizeChannelOpen(r6.response, ctx) directly after txnpost succeeds.

Do NOT modify any other file. Do NOT change any function signatures in core/*.js or channel.handler.js.

Definition of done:
- [ ] buildAndExportVoucherTx() has no _retries parameter and no setTimeout retry
- [ ] coindata path removed — only coinid path remains
- [ ] saveChannelCoinData / loadChannelCoinData / channelCoinDataKey removed from app.js
- [ ] txnlist call after txnpost removed from buildAndPostChannelTx()
- [ ] AGENTS.md §14 bug #15 marked as Fixed with resolution note

Verification: trigger a view reward. Creator FE log should show a single txninput attempt. No retries. Voucher sent within 1 block of DO_REWARD_VOUCHER signal.

Provide the standard handoff note (CLAUDE.md §10) when done.
```

---

## Publisher Frame System (T-PUB1 → T-PUB8)

> Implementation of the Publisher Frame system (MinimaAds.md §2.1, §3.1, §3.5, §4.5–4.6, §6.9, §7.7, Appendix B.2/B.3 updated, §13).
> Mandatory order: T-PUB1 → T-PUB2 → T-PUB3 → T-PUB4 → T-PUB5 → T-PUB6 → T-PUB7 → T-PUB8.
> Read MinimaAds.md §4.5–4.6, §6.9, Appendix B updated sections fully before starting any task.

---

### T-PUB1 — DB schema (FRAMES table + CAMPAIGNS columns + CHANNEL_STATE.ROLE)

| Field | Value |
|---|---|
| **Status** | Pending |
| **Agent** | Sonnet |
| **Files** | `public/service-workers/db-init.js`, `dapp/app.js` (FE DB init) |
| **Spec** | MinimaAds.md §3.5, AGENTS.md §8 |

**Prompt:**
```
You are implementing T-PUB1 for MinimaAds. Read CLAUDE.md, MinimaAds.md §3.5, and AGENTS.md §8 before writing any code.

Task: Update CREATE TABLE statements in BOTH runtimes (SW db-init.js and FE init in dapp/app.js).

1. CAMPAIGNS — add three new columns to the CREATE TABLE:
     PUBLISHER_REWARD_VIEW DECIMAL(20,6) NOT NULL DEFAULT 0,
     MAX_PUBLISHER_BUDGET  DECIMAL(20,6) NOT NULL DEFAULT 0,
     PUBLISHER_BUDGET_SPENT DECIMAL(20,6) NOT NULL DEFAULT 0
   Place them after REWARD_CLICK and before STATUS.

2. FRAMES — add new CREATE TABLE IF NOT EXISTS:
     FRAME_ID         VARCHAR(256)  PRIMARY KEY,
     PUBLISHER_KEY    VARCHAR(512)  NOT NULL,
     PUBLISHER_WALLET VARCHAR(512)  DEFAULT '',
     LABEL            VARCHAR(256)  DEFAULT '',
     IS_BUILTIN       BOOLEAN       NOT NULL DEFAULT FALSE,
     CREATED_AT       BIGINT        NOT NULL,
     TOTAL_EARNED     DECIMAL(20,6) NOT NULL DEFAULT 0

3. CHANNEL_STATE — add two columns and change PRIMARY KEY:
     ROLE     VARCHAR(16)  NOT NULL DEFAULT 'viewer',
     FRAME_ID VARCHAR(256) DEFAULT ''
   PRIMARY KEY: change from (CAMPAIGN_ID, VIEWER_KEY) to (CAMPAIGN_ID, VIEWER_KEY, ROLE)

Rules:
- Dev workflow rule (AGENTS.md §14): NO ALTER TABLE. Edit CREATE TABLE only — DB resets on reinstall.
- SW: Rhino-safe (var, function(), no trailing commas, MDS.log).
- FE init must mirror SW exactly.
- Do NOT modify any other file.

Definition of done:
- [ ] CAMPAIGNS has 3 new columns in both runtimes
- [ ] FRAMES table exists in both runtimes
- [ ] CHANNEL_STATE has ROLE and FRAME_ID columns; PK uses 3 columns
- [ ] Update AGENTS.md §8 (mirror schema) and §16 (document history entry)

Provide the standard handoff note (CLAUDE.md §10) when done.
```

---

### T-PUB2 — Core: frames.js

| Field | Value |
|---|---|
| **Status** | Pending (depends on T-PUB1) |
| **Agent** | Sonnet |
| **Files** | `core/frames.js` (new) |
| **Spec** | MinimaAds.md §7.7, §3.5 |

**Prompt:**
```
You are implementing T-PUB2 for MinimaAds. Read CLAUDE.md, MinimaAds.md §7.7 §3.5, and AGENTS.md §8 before writing any code.

Task: Create core/frames.js with these functions (signatures are contracts):

  listFrames(cb)
    → SELECT * FROM FRAMES ORDER BY CREATED_AT
    → cb(err, [Frame, ...])

  getFrame(frameId, cb)
    → SELECT WHERE UPPER(FRAME_ID)=UPPER(...)
    → cb(err, Frame | null)

  saveFrame(frame, cb)
    → frame: { frame_id, publisher_key, publisher_wallet, label, is_builtin }
    → MERGE INTO FRAMES KEY(FRAME_ID); CREATED_AT = Date.now() if new
    → cb(err, boolean)

  ensureBuiltinFrame(maximaPk, walletAddr, cb)
    → frame_id = 'builtin:' + maximaPk.toUpperCase()
    → if exists: cb(err, frame); else: saveFrame({ ..., is_builtin:true, label:'Built-in viewer' })
    → cb(err, Frame)

  incrementFrameEarnings(frameId, amount, cb)
    → UPDATE FRAMES SET TOTAL_EARNED = TOTAL_EARNED + amount WHERE UPPER(FRAME_ID)=UPPER(...)
    → cb(err, boolean)

  getFrameEarnings(frameId, cb)
    → SELECT TOTAL_EARNED, plus COUNT(*) from REWARD_EVENTS WHERE UPPER(PUBLISHER_ID)=UPPER(frameId) AND TYPE='publisher_view'
    → cb(err, { total_earned, event_count })

Rules:
- All DB access via sqlQuery() from core/minima.js
- All H2 reads use UPPERCASE keys
- All string interpolation through escapeSql()
- All comparisons use UPPER() on both sides
- Rhino-safe in SW context
- No bare MDS.sql calls

Definition of done:
- [ ] core/frames.js created with all 6 functions
- [ ] No hardcoded values
- [ ] AGENTS.md §16 updated

Provide the standard handoff note (CLAUDE.md §10) when done.
```

---

### T-PUB3 — config.js + PLATFORM_KEY validation in campaign.handler.js

| Field | Value |
|---|---|
| **Status** | Pending (depends on T-PUB2) |
| **Agent** | Sonnet |
| **Files** | `config.js` (new, project root), `public/service-workers/handlers/campaign.handler.js`, `service.js` (load order) |
| **Spec** | MinimaAds.md §4.6, AGENTS.md §12 fragility #31 |

**Prompt:**
```
You are implementing T-PUB3 for MinimaAds. Read CLAUDE.md, MinimaAds.md §4.6 §6.3 (network validation), AGENTS.md §12 fragility #31 before writing any code.

Task: Add PLATFORM_KEY constant and on-receive validation.

1. Create /config.js at project root with Rhino-safe content:

   var PLATFORM_KEY = null;  // MVP: fee enforcement disabled. Set to '0x...' wallet PK before mainnet.
   var APP_NAME = 'minima-ads';

   Note: APP_NAME is currently defined in service.js — leave it there for now,
   config.js shadows it with the same value. Future refactor will consolidate.

2. service.js — add MDS.load("config.js") as the FIRST file in the inited handler load chain
   (before core/minima.js). This makes PLATFORM_KEY available in all subsequent SW loads.

3. dapp/app.js — load config.js via <script src="../config.js"> in index.html BEFORE any
   other app script. Verify PLATFORM_KEY is accessible globally in FE.

4. campaign.handler.js — extend handleCampaignAnnounce(payload):
   After current persistence flow but BEFORE saveCampaign:
     a. If PLATFORM_KEY === null → skip validation, proceed (MVP).
     b. Else compare payload.platform_key (after .toUpperCase()) with PLATFORM_KEY (after .toUpperCase()).
        Mismatch → MDS.log("[CAMPAIGN] platform_key mismatch, dropping campaign: " + id) and return.
     c. Else also verify on-chain: MDS.cmd("coins coinid:" + payload.campaign.escrow_coinid + " relevant:false", function(res) { ... })
        Read state.find(s => s.port === 5).data and compare. Mismatch → drop.

5. handleRequestCampaignData unchanged.

Rules:
- Backward compatibility: if payload.platform_key is missing AND local PLATFORM_KEY is null → accept (MVP nodes talking).
- Rhino-safe.
- Update MinimaAds.md §6.3 if needed.
- Update AGENTS.md §12 fragility #31 with implementation details.

Definition of done:
- [ ] config.js exists at root with PLATFORM_KEY=null
- [ ] service.js loads config.js first
- [ ] index.html loads config.js first
- [ ] handleCampaignAnnounce validates platform_key before persisting
- [ ] AGENTS.md §16 updated

Provide the standard handoff note (CLAUDE.md §10) when done.
```

---

### T-PUB4 — KissVM escrow extension (PLATFORM_KEY enforcement + publisher channel support)

| Field | Value |
|---|---|
| **Status** | Pending (depends on T-PUB3) |
| **Agent** | **Opus** |
| **Files** | `dapp/views/creator.js` (escrow registration), `dapp/app.js` (publisher channel-open tx) |
| **Spec** | MinimaAds.md Appendix B.2/B.3 (updated), §4.5 |

> **Opus**: contract-level changes + multi-state spending tx with conditional fee branch. Contract bugs are silent on Rhino and on-chain failures are hard to debug.

**Prompt:**
```
You are implementing T-PUB4 for MinimaAds. Read CLAUDE.md, MinimaAds.md §4.5 §4.6 §6.3 Appendix B.2 B.3 B.5 and Appendix C, plus AGENTS.md §12 fragility #17 and #31 before writing any code.

Task: Extend the escrow KissVM contract to enforce PLATFORM_KEY and support publisher channels.

PART 1 — Replace the ESCROW_SCRIPT constant in creator.js with the §B.2 updated script:

   var ESCROW_SCRIPT =
     "LET creatorkey=PREVSTATE(1) " +
     "LET platformkey=PREVSTATE(5) " +
     "LET maxpubbudget=PREVSTATE(6) " +
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

Re-register if missing (newscript trackall:false). The address WILL change because the script changed — store under keypair 'ESCROW_ADDRESS_V2' to avoid clobbering the old V1 address used by existing campaigns. Update all reads to look at V2 first, V1 fallback for legacy campaigns.

PART 2 — Campaign launch tx (creator.js):
- Set txnstate port:5 = (PLATFORM_KEY || '0x00')
- Set txnstate port:6 = max_publisher_budget (or 0)
- Set txnstate port:11 = (PLATFORM_KEY ? 1 : 0)
- If feeflag=1: also set port:12 = feeAmount, port:13 = feeOutputIndex (0)
- Add a fee output at index 0: txnoutput amount:<fee> address:<PLATFORM_KEY-derived-address>
- Then the budget output and change output

PART 3 — Channel-open tx (dapp/app.js handleDoChannelOpen):
- Set txnstate port:11 = 0 (no fee branch on channel-open spends)
- Otherwise unchanged from current implementation

PART 4 — Add publisher channel-open handler in dapp/app.js:
  handleDoPublisherChannelOpen(data) — symmetric to handleDoChannelOpen but:
    - Reads MAX_PUBLISHER_BUDGET from CAMPAIGNS
    - Uses max_amount = data.max_amount (passed from SW handler — capped at remaining publisher budget)
    - Sets CHANNEL_STATE.ROLE='publisher', FRAME_ID=data.frame_id
    - Sends CHANNEL_OPEN with role:'publisher', frame_id

Rules:
- Verify VERIFYOUT 5-arg form (AGENTS.md fragility #17)
- The fee branch must use STATE(13) as output index (NOT INC(@INPUT) — fee is at a fixed position)
- All existing T-CH4 logic for viewer channels remains intact
- If PLATFORM_KEY is null: feeflag=0, port:5=0x00, no fee output created — campaign launch is identical to current behavior

Definition of done:
- [ ] New ESCROW_SCRIPT registered as V2
- [ ] Campaign launch tx includes fee output when PLATFORM_KEY is set
- [ ] Channel-open tx sets feeflag=0
- [ ] handleDoPublisherChannelOpen exists and produces a publisher CHANNEL_STATE row
- [ ] Spec checked against actual KissVM grammar (refs/docs-main contracts-kissvm.mdx)
- [ ] AGENTS.md §12 fragility #31 updated; §16 entry added

Provide the standard handoff note (CLAUDE.md §10) when done.
```

---

### T-PUB5 — SDK: init() accepts frameId, publisher REWARD_REQUEST flow

| Field | Value |
|---|---|
| **Status** | Pending (depends on T-PUB4) |
| **Agent** | Sonnet |
| **Files** | `sdk/index.js` |
| **Spec** | MinimaAds.md §13, §4.5, §6.9 |

**Prompt:**
```
You are implementing T-PUB5 for MinimaAds. Read CLAUDE.md, MinimaAds.md §13 §4.5 §6.9, and AGENTS.md §12 fragility #34 #35 before writing any code.

Task: Update sdk/index.js init() to accept frameId and fire publisher REWARD_REQUEST after viewer reward.

PART 1 — init({ wallet, interests, frameId, publisher_id }, cb):
  - If frameId provided: call getFrame(frameId, ...). Missing → cb(new Error('UNKNOWN_FRAME')).
  - If frameId omitted: resolve builtin via maxima action:info, frameId = 'builtin:' + pk.toUpperCase()
  - Store activeFrameId in module scope.
  - publisher_id (legacy): if provided AND frameId not provided, use as frameId.

PART 2 — _trackEvent (after current viewer reward flow + viewer channel logic):
  After viewer REWARD_REQUEST is sent, check campaign.PUBLISHER_REWARD_VIEW:
    if (parseFloat(campaign.PUBLISHER_REWARD_VIEW) > 0 && type === 'view' && activeFrameId) {
      // Open or top up publisher channel for this campaign+frame
      // The publisher channel partner key is derived from the FRAME's PUBLISHER_KEY
      // This requires reading the frame: getFrame(activeFrameId, ...)
      // Then computing maxAmount for publisher channel:
      //   max = Math.min(parseFloat(campaign.MAX_PUBLISHER_BUDGET), R_p × campaign_days)
      // Send CHANNEL_OPEN_REQUEST with role='publisher', frame_id=activeFrameId
      //   (or REWARD_REQUEST if channel already open per ROLE='publisher')
    }

PART 3 — On VOUCHER_RECEIVED with role='publisher':
  - createRewardEvent({ type:'publisher_view', amount, publisher_id: frameId, ... })
  - incrementFrameEarnings(frameId, amount, ...)
  - signalFE('PUBLISHER_REWARD_CONFIRMED', { event_id, amount, frame_id, campaign_id })

Rules:
- Reuse existing channel infrastructure — pass role='publisher' and frame_id consistently
- Set REWARD_EVENTS.PUBLISHER_ID = frameId for ALL events (viewer and publisher), so audits can attribute
- For viewer events: PUBLISHER_ID = frameId where the ad was displayed (audit only)
- For publisher events: PUBLISHER_ID = frameId of the recipient
- No hardcoded values

Definition of done:
- [ ] init() accepts frameId, validates against FRAMES
- [ ] viewer events log frameId in PUBLISHER_ID
- [ ] publisher REWARD_REQUEST fires after viewer flow when R_p > 0 and frameId is set
- [ ] PUBLISHER_REWARD_CONFIRMED signal fires on voucher receipt
- [ ] AGENTS.md §16 updated

Provide the standard handoff note (CLAUDE.md §10) when done.
```

---

### T-PUB6 — Campaign creation UI: publisher reward fields

| Field | Value |
|---|---|
| **Status** | Pending (depends on T-PUB5) |
| **Agent** | Sonnet |
| **Files** | `dapp/views/creator.js` |
| **Spec** | MinimaAds.md §6.3, §3.1 |

**Prompt:**
```
You are implementing T-PUB6 for MinimaAds. Read CLAUDE.md, MinimaAds.md §6.3 §3.1 §5, and AGENTS.md §16 before writing any code.

Task: Add publisher reward fields to the existing campaign creation form.

PART 1 — HTML form additions (creator.js):
  - Numeric input "Publisher reward per view (MINIMA, optional)"
    name=publisher_reward_view, min=0, step=0.001, value=0
    Hint: "Leave at 0 to disable Frame rewards"
  - Numeric input "Max publisher budget (MINIMA)"
    name=max_publisher_budget, min=0, step=0.01
    Conditionally required: if publisher_reward_view > 0, max_publisher_budget > 0 required
    Hint: "Subset of total budget reserved for publisher payouts"

PART 2 — Submit validation:
  - If publisher_reward_view > 0:
    - Must be >= LIMITS.MIN_PUBLISHER_REWARD_VIEW (0.001)
    - max_publisher_budget must be > 0
    - max_publisher_budget must be <= budget_total
  - publisher_reward_view + reward_view + reward_click cannot exceed any single per-view max sanity threshold (use existing budget logic)

PART 3 — saveCampaign call:
  - Include publisher_reward_view and max_publisher_budget in the campaign object
  - PUBLISHER_BUDGET_SPENT defaults to 0

PART 4 — CAMPAIGN_ANNOUNCE payload:
  - Include the two new fields in the broadcast payload (per MinimaAds.md §8.3)

Rules:
- Frontend validation with inline error messages
- HTML5 attributes (min, step) for browser-side help
- No new files

Definition of done:
- [ ] Form has both new inputs with validation
- [ ] saveCampaign + CAMPAIGN_ANNOUNCE include the new fields
- [ ] AGENTS.md §16 updated

Provide the standard handoff note (CLAUDE.md §10) when done.
```

---

### T-PUB7 — Frames UI view + builtin frame init

| Field | Value |
|---|---|
| **Status** | Pending (depends on T-PUB6) |
| **Agent** | Sonnet |
| **Files** | `dapp/views/frames.js` (new), `dapp/app.js` (route + builtin init), `service.js` (FRAME_READY signal), `public/index.html` |
| **Spec** | MinimaAds.md §6.9, §12 |

**Prompt:**
```
You are implementing T-PUB7 for MinimaAds. Read CLAUDE.md, MinimaAds.md §6.9 §7.7 §12, and AGENTS.md §10 §16 before writing any code.

Task: Create the Frames management UI and ensure built-in frame is auto-created.

PART 1 — service.js onInited:
  After the maxima action:info call that resolves MY_MAXIMA_PK and registers USER_PROFILE,
  also call ensureBuiltinFrame(MY_MAXIMA_PK, walletAddr, function(err, frame) {
    signalFE('FRAME_READY', { frame_id: frame.FRAME_ID, is_builtin: true });
  });

PART 2 — dapp/app.js:
  - Add #frames route → loads frames.js view
  - Add 'Frames' link in main navigation
  - Register MDSCOMMS handlers for FRAME_READY, FRAME_CREATED, PUBLISHER_REWARD_CONFIRMED

PART 3 — dapp/views/frames.js:
  Two sections:
  a) "My Frames" — table of all frames from listFrames():
       Columns: Label | Frame ID | Type (builtin/custom) | Total earned | SDK snippet (button "Copy")
       Per-row "View earnings" → calls getFrameEarnings(), shows per-campaign breakdown
  b) "Create new frame" form:
       Input: label
       On submit:
         - frameId = generateUID()
         - getMaximaPk and walletAddr from MY_MAXIMA_PK / MY_ADDRESS
         - saveFrame({ frame_id, publisher_key:MY_MAXIMA_PK, publisher_wallet:MY_ADDRESS, label, is_builtin:false })
         - signalFE('FRAME_CREATED', { frame_id, label })
         - Show snippet:
             MinimaAds.init({ wallet: '0x...', frameId: '<frame_id>' }, function(err){...});
             MinimaAds.getAd(...); MinimaAds.render(ad, 'ad-slot');

PART 4 — public/index.html:
  - Add <a href="#frames">Frames</a> in the nav
  - Load dapp/views/frames.js after the other view scripts

Rules:
- Sanitize all label/frame_id outputs with DOMPurify before DOM injection
- All DB access via core/frames.js (no bare MDS.sql)
- The built-in frame must be created BEFORE FRAME_READY is signalled

Definition of done:
- [ ] Built-in frame auto-created at SW init
- [ ] FRAME_READY signal received and handled in FE
- [ ] Frames list shows builtin + any user-created frames
- [ ] User can create new frames; SDK snippet displayed
- [ ] AGENTS.md §16 updated

Provide the standard handoff note (CLAUDE.md §10) when done.
```

---

### T-PUB8 — Publisher channel handler (SW + creator FE)

| Field | Value |
|---|---|
| **Status** | Pending (depends on T-PUB7) |
| **Agent** | **Opus** |
| **Files** | `public/service-workers/handlers/channel.handler.js`, `core/channels.js`, `dapp/app.js` |
| **Spec** | MinimaAds.md §6.5 §6.6 (publisher variant), §8.8–8.11 (extended fields), §4.5 |

> **Opus**: requires duplicating viewer channel logic with role-aware queries, partial tx construction with publisher keys, and budget tracking against MAX_PUBLISHER_BUDGET. Branch coverage on the creator side is high.

**Prompt:**
```
You are implementing T-PUB8 for MinimaAds. Read CLAUDE.md, MinimaAds.md §4.5 §6.5 §6.6 §8.8–8.11, AGENTS.md §10 §12 fragility #33 #34 before writing any code.

Task: Extend channel handlers to support ROLE='publisher' channels — mirror viewer logic, branch on role.

PART 1 — channel.handler.js:

handleChannelOpenRequest — branch on payload.role (default 'viewer'):
  if role === 'publisher':
    - Validate: campaign active, PUBLISHER_REWARD_VIEW > 0
    - Validate: (MAX_PUBLISHER_BUDGET - PUBLISHER_BUDGET_SPENT) >= max_amount
    - Validate: payload.frame_id is non-empty
    - openChannel(campaignId, viewerKey, creatorMx, maxAmount, role='publisher', frameId, cb)
      (Extend openChannel signature in core/channels.js — add role and frameId params)
    - Deduct from publisher budget: UPDATE CAMPAIGNS SET PUBLISHER_BUDGET_SPENT=PUBLISHER_BUDGET_SPENT+maxAmount
    - signalFE('DO_PUBLISHER_CHANNEL_OPEN', { campaign_id, publisher_key:viewer_key, publisher_mx:viewer_mx, frame_id, max_amount })
  else:
    (existing viewer flow unchanged)

handleRewardRequest — branch on payload.role:
  if role === 'publisher':
    - getChannelState now requires (campaign_id, viewer_key, role='publisher')
    - signalFE('DO_PUBLISHER_REWARD_VOUCHER', { ... frame_id })

handleRewardVoucher — branch on payload.role:
  if role === 'publisher':
    - updateChannelVoucher with role='publisher'
    - signalFE('VOUCHER_RECEIVED', { campaign_id, cumulative, role:'publisher', frame_id })
    (FE will handle the publisher_view REWARD_EVENTS write via SDK)

PART 2 — core/channels.js (signature extensions):
  openChannel(campaignId, viewerKey, creatorMx, maxAmount, role, frameId, cb)
    → MERGE INTO with composite PK (CAMPAIGN_ID, VIEWER_KEY, ROLE)
  getChannelState(campaignId, viewerKey, role, cb)
    → SELECT WHERE matches all 3
  All other functions take role as additional param.

  IMPORTANT: This is a CONTRACT change — update MinimaAds.md §7.6 in the same patch.

PART 3 — dapp/app.js handleDoPublisherChannelOpen / handleDoPublisherRewardVoucher:
  Mirror existing handleDoChannelOpen / handleDoRewardVoucher but:
  - Channel state lookup uses role='publisher'
  - Settlement output[0] address: read FRAMES.PUBLISHER_WALLET for the frame_id (not VIEWER_WALLET_ADDR)
  - All channel-open tx state ports identical to viewer (no fee branch — port:11=0)

Rules:
- All channel-related queries MUST include the ROLE filter (fragility #33)
- T-PUB4 must be Done — escrow contract supports the channel-open flow already
- Update AGENTS.md §10 with the new DO_PUBLISHER_* signals (already pre-listed in this spec change)
- Update MinimaAds.md §7.6 with the new function signatures
- Rhino-safe SW; all FE branches in dapp/app.js follow existing pattern

Definition of done:
- [ ] channel.handler.js handles role='publisher' for all 5 handlers
- [ ] core/channels.js signatures extended with role param
- [ ] MinimaAds.md §7.6 updated for new signatures
- [ ] dapp/app.js has handleDoPublisherChannelOpen + handleDoPublisherRewardVoucher
- [ ] PUBLISHER_BUDGET_SPENT increments correctly on channel-open
- [ ] Settlement pays to FRAMES.PUBLISHER_WALLET
- [ ] AGENTS.md §16 updated; §14 entry for any discovered issues

Provide the standard handoff note (CLAUDE.md §10) when done.
```

---

## Status Coin — On-chain Campaign Status (T-SC1 → T-SC7)

> Implementation of campaign status as a mutable state variable on the escrow coin (ESCROW_SCRIPT_V3), removing the dependency on creator-online Maxima broadcasts for pause/finish/resume propagation.
> Mandatory order: T-SC1 → T-SC2 → T-SC3 → T-SC4 → T-SC5 → T-SC6 → T-SC7.
> Read MinimaAds.md §4.4 §6.5 §8.5 Appendix B fully, plus current processEscrowCoin in `public/service-workers/handlers/campaign.handler.js`, before starting any task.

---

### T-SC1 — Spec: MinimaAds.md updates for V3 escrow + on-chain status

| Camp | Valor |
|---|---|
| **Status** | Pending ⬜ |
| **Agent** | Opus |
| **Fitxers** | `MinimaAds.md`, `AGENTS.md` |
| **Spec** | MinimaAds.md §4 §6 §8 Appendix B |

**Context:** Spec must land before any code so subsequent agents have an unambiguous contract. No code is written in this task.

**Prompt:**
```
You are implementing T-SC1 for MinimaAds. Read CLAUDE.md, MinimaAds.md §4.4 §6.3 §6.5 §8.1 §8.5 §8.15 Appendix B, and AGENTS.md fully before writing any spec text.

Task: Add the on-chain campaign-status spec. No code changes — only MinimaAds.md and AGENTS.md.

MinimaAds.md edits:

1. New subsection §4.7 "Campaign Status as On-chain State" — explain:
   - Status (active|paused|finished) lives in ESCROW_SCRIPT_V3 coin STATE(7)
   - Every node reads PREVSTATE(7) during NEWBLOCK discovery scan → no Maxima needed
   - Manual creator action: applyStatusChange locally → buildAndPostStatusUpdateTx → V3 escrow change coin carries new STATE(7)
   - Old V1/V2 coins unchanged; status sync only triggers on V3 coins

2. New §6.10 "Campaign Status Update Flow (on-chain)" — narrative steps:
   step 1: Creator clicks Pause/Resume/Finish in mycampaigns.js
   step 2: FE applies local status via MA_LOCAL_STATUS (immediate UX)
   step 3: FE runs buildAndPostStatusUpdateTx — spends current escrow coin, outputs same amount to ESCROW_ADDRESS_V3, txnstate port:7 value:<status_hex>, carries ports 1,3,4,5,6,11 forward
   step 4: On Minima Hub approve → tx confirms on-chain
   step 5: All nodes (including offline-then-online ones) see the change coin via NEWBLOCK scan, read PREVSTATE(7), call setCampaignStatus
   step 6: signalFE("CAMPAIGN_UPDATED", { campaign_id, status }) → viewer SDKs invalidate liveness cache, stop serving the ad

3. §6.5 Channel Open Flow — add note: channel-open spends MUST carry STATE(7) forward (= current PREVSTATE(7) or "active" default) so the new escrow change coin preserves the campaign status.

4. §8.5 (CAMPAIGN_PAUSE/FINISH/RESUME) — change "Direction" line to note these are now optional fast-path notifications. Add subsection "Authoritative source: ESCROW_SCRIPT_V3 PREVSTATE(7) (on-chain)" pointing to §6.10. Mark CAMPAIGN_RESUME as DEPRECATED — resume is on-chain only since the offline-creator case cannot Maxima.

5. §8.15 SW→FE Signal Contract — add row:
   STATUS_TX_PENDING | { campaign_id, status, pending_uid } | mycampaigns.js (FE) | Status-change tx awaiting Hub approval

6. Appendix B — split into B.2 (V2 script, "legacy") and new B.2.1 (V3 script). V3 script string:
     LET creatorkey=PREVSTATE(1)
     LET platformkey=PREVSTATE(5)
     LET maxpubbudget=PREVSTATE(6)
     LET status=PREVSTATE(7)
     ASSERT SIGNEDBY(creatorkey)
     LET payout=STATE(10)
     LET feeflag=STATE(11)
     LET change=@AMOUNT-payout
     IF feeflag EQ 1 THEN
       LET feeamount=STATE(12)
       ASSERT VERIFYOUT(STATE(13) platformkey feeamount @TOKENID FALSE)
     ENDIF
     IF change GT 0 THEN
       ASSERT VERIFYOUT(INC(@INPUT) @ADDRESS change @TOKENID TRUE)
     ENDIF
     RETURN TRUE
   The status/platformkey/maxpubbudget reads are no-ops — purely byte-different from V2 so that newscript yields a new address. The script does NOT enforce status; enforcement is in SW handlers (selectAd ignores non-active campaigns).

7. Appendix B.3 — add rows:
   | 7 | PREVSTATE(7) | Campaign status (hex-encoded UTF-8 of "active"/"paused"/"finished") | hex string | Read by DISCOVERY on every node — propagates pause/finish without creator online |
   | 7 | STATE(7) | New status set by spending tx | hex string | Set on status-update tx; passed through on channel-open and refund spends |

8. Appendix B.5 — add new subsection "Status Update Transaction":
     txncreate id:<txnid>
     txninput  id:<txnid> coinid:<ESCROW_COINID_V3> scriptmmr:true
     txnoutput id:<txnid> storestate:true amount:<full_amount> address:<ESCROW_ADDRESS_V3>
     txnstate  id:<txnid> port:1  value:<creator_wallet_pk>
     txnstate  id:<txnid> port:3  value:<campaign_id_hex>
     txnstate  id:<txnid> port:4  value:<creator_mx_hex>
     txnstate  id:<txnid> port:5  value:<platform_key_or_0x00>
     txnstate  id:<txnid> port:6  value:<max_pub_budget_or_0>
     txnstate  id:<txnid> port:7  value:<new_status_hex>
     txnstate  id:<txnid> port:10 value:0
     txnstate  id:<txnid> port:11 value:0
     txnsign   id:<txnid> publickey:<creator_wallet_pk>
     txnpost   id:<txnid> mine:true auto:true
     txndelete id:<txnid>
   Note: payout=0, change=@AMOUNT — script's IF change GT 0 branch runs, asserting same-address change. STATE(10)=0 is intentional so the script reads payout=0.

9. Appendix B.5 — update "Channel Open" template to add port:7 (carry current status forward).

10. Appendix B.7 — change row "Status survives creator offline" from ❌ to ✅ (V3 only) with note "V1/V2 still require creator-online Maxima broadcasts".

AGENTS.md edits:

11. §9 Protocol Matrix (or wherever the message list lives) — add note next to CAMPAIGN_PAUSE/FINISH/RESUME: "Fast-path only; authoritative status is ESCROW_V3 PREVSTATE(7)".

12. Append handoff entry in §8/§16 (whichever is the current history section) describing the V3 script registration and status-coin design.

Do NOT modify any other file. Do NOT write any JS code. This task is spec-only.

Definition of done:
- [ ] MinimaAds.md §4.7, §6.10, §8.15 STATUS_TX_PENDING row, Appendix B.2.1 (V3 script), B.3 (PREVSTATE(7) rows), B.5 (Status Update tx + channel-open port:7 passthrough) all written
- [ ] §8.5 CAMPAIGN_PAUSE/FINISH/RESUME deprecation/fast-path note added
- [ ] Appendix B.7 row updated
- [ ] AGENTS.md updated with V3 protocol note + handoff entry
- [ ] No JS files touched
- [ ] CONFLICT REPORT: if any spec section conflicts with the planned implementation, stop and report — do NOT improvise

Provide the standard handoff note (CLAUDE.md §10) when done.
```

**Definition of done:**
- [ ] §4.7, §6.10, §8.15 row, Appendix B.2.1, B.3 rows, B.5 status-update tx, B.7 row all present
- [ ] §8.5 fast-path/deprecation note added
- [ ] AGENTS.md protocol matrix + handoff updated
- [ ] No code changes

---

### T-SC2 — SW: ESCROW_SCRIPT_V3 registration + scanEscrowCoins V3

| Camp | Valor |
|---|---|
| **Status** | Pending ⬜ (depends on T-SC1) |
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
   - Rename existing function to `resolveEscrowAddressV3` if clearer, OR keep name and switch the version inside.

3. In `fundEscrowAndPublish`, after stateJson is built, append port:7:
     stateJson = stateJson.slice(0, -1) + ',"7":"' + utf8ToHex('active').toUpperCase() + '"}';
   Apply this regardless of feeflag — port:7 is independent of fee branch.
   (If feeflag=1 also appends ports 12/13, do port:7 BEFORE that append so JSON stays valid. Easiest: append port:7 unconditionally before any conditional appends.)

4. Verify: campaign funding tx now lands at V3 address, and the coin has 7 PREVSTATE ports populated (1..7) plus port:11 (feeflag).

PART 2 — dapp/app.js handleDoChannelOpen / buildAndPostChannelTx:

5. The split tx state currently sets ports 1, 3, 4, 10, 11. Add port:7 passthrough:
   - Before building stateCmds, fetch the current escrow coin's PREVSTATE(7) value.
     One way: re-read the input coin's prevstate after `txninput` — `r2.response.transaction.inputs[0].state` (verify exact path against refs/Minima-1.0.45 — the input coin's state may live at `r2.response.transaction.inputs[0].state` or `.prevstate`). Use getStateVar(states, 7) to extract.
   - If empty (legacy V1/V2 coin): set port:7 = hex('active') so going forward the change coin behaves as V3 status-bearing.
   - If present: forward the same hex value to STATE(7).
   - Add to stateCmds:
       'txnstate id:' + txId + ' port:7 value:' + statusHex

6. Also resolve ESCROW_ADDRESS_V3 in handleDoChannelOpen (alongside the existing V2/V1 lookup), and prefer V3 when the campaign's escrow coin lives at V3 (compare coin address against V3 first). The split-output address must match the input coin's address — use whatever resolveEscrowAddressV3() returned for new campaigns; legacy campaigns keep using their original V2/V1 address.

PART 3 — Backwards compatibility check:

7. A campaign created BEFORE T-SC3 (V2 coin) → channel-open still spends from V2 address → keep that path working unchanged. The port:7 line is fine to include on V2 spends too (the V2 script does not read it; harmless extra state).

Rules:
- FE code: arrow functions, let/const, template literals are FINE (browser context).
- Do NOT modify SW files.
- Do NOT change setCampaignStatus or processEscrowCoin (T-SC4 / T-SC5).
- If r2.response shape for input prevstate is unclear: check refs/Minima-1.0.45/src/org/minima/system/commands/txn/txnoutput.java and txninput.java.

Definition of done:
- [ ] resolveEscrowAddress targets V3 first
- [ ] Funding tx sets port:7 = hex('active')
- [ ] New campaigns land at ESCROW_ADDRESS_V3 (verified on chain)
- [ ] Channel-open split tx carries port:7 forward (status preserved on change coin)
- [ ] Legacy V2 campaigns continue to channel-open without errors

Verification: create a new campaign, then on the chain explorer (or via `coins address:<V3>`) confirm the coin has PREVSTATE(7) = hex('active'). Open a channel; the resulting escrow change coin should also have PREVSTATE(7) = hex('active').

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
- Do NOT remove or weaken the terminal-state guard — it prevents an older V3 coin (e.g. before the finish tx confirmed) from un-finishing the campaign if scanned later.
- _knownEscrowCoins still caches by coinId; status sync runs only once per coin per session — which is correct because a status change creates a new change coin (new coinId).

Definition of done:
- [ ] PREVSTATE(7) decoded and validated against {active|paused|finished}
- [ ] Terminal-state guard prevents resurrection of finished campaigns
- [ ] setCampaignStatus + signalFE("CAMPAIGN_UPDATED") fires on transition
- [ ] Legacy V1/V2 coins (no port:7) are silently skipped (getStateVar returns '')
- [ ] AGENTS.md §16 entry added

Verification: on viewer node A, run a campaign created on creator node B. Pause the campaign on B (T-SC5 not required yet — manually craft a status-update tx via console if needed, or wait for T-SC6). On A's NEWBLOCK following the tx confirmation, log should show "[DISCOVERY] on-chain status sync: ... active -> paused" and signalFE fires.

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
  // Caller supplies the resolved on-chain state of the current escrow coin.
  // statusHex must be already hex-encoded (e.g. '0x' + utf8ToHex('paused').toUpperCase()).
  // Returns an array of { port, value } objects.
  function buildStatusUpdateStatePorts(currentEscrow, newStatusHex) {
    // currentEscrow = {
    //   walletPk:        '0x...',          // PREVSTATE(1)
    //   expiryBlock:     '1234567',        // PREVSTATE(2) — pass through if known
    //   campaignIdHex:   '0x...',          // PREVSTATE(3)
    //   creatorMxHex:    '0x...',          // PREVSTATE(4)
    //   platformKeyHex:  '0x...' | '0x00', // PREVSTATE(5)
    //   maxPubBudget:    '0' | '<num>',    // PREVSTATE(6)
    //   feeflag:         '0' | '1'         // STATE(11) — pass through to preserve coin behavior
    // }
    // newStatusHex = '0x' + utf8ToHex('active' | 'paused' | 'finished').toUpperCase()
    //
    // Returns ports 1, 3, 4, 5, 6, 7, 10, 11 (port:2 omitted — script doesn't read it on status-update; if needed for downstream parity, include too).
    // STATE(10) = 0 (payout=0; full change-back), STATE(11) = 0 (no fee output on status-update).
  }

  // Validates a status string and returns the hex encoding suitable for txnstate.
  // Returns '' if invalid.
  function encodeStatusForTx(status) {
    // accept only 'active', 'paused', 'finished' (case-insensitive)
    // returns '0x' + utf8ToHex(lowered).toUpperCase() or '' on invalid
  }

Implementation notes:
- Use the existing utf8ToHex helper from core/minima.js (already loaded before campaigns.js).
- Function declarations only — no const/let/arrow (kept consistent so SW load works if ever needed).
- Plain objects in the returned array: { port: 7, value: '0x...' } etc.
- The port:10 value should be the string '0' (txnstate expects strings).
- The port:11 value should be the string '0' (no fee on status-update).

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
| **Agent** | **Opus** |
| **Fitxers** | `dapp/app.js`, `dapp/views/mycampaigns.js` |
| **Spec** | MinimaAds.md §6.10 §8.15 Appendix B.5 |

**Context:** Compose the on-chain status update from the creator's UI. Reuses the same MDS_PENDING approve/deny machinery already proven for channel-open spends. The local MA_LOCAL_STATUS broadcast remains as immediate-feedback path; the on-chain tx is the propagation mechanism for other nodes. This is the integration task — Opus because it touches the pending-approval ctx restore plus a multi-step tx flow.

**Prompt:**
```
You are implementing T-SC6 for MinimaAds. T-SC3, T-SC4, and T-SC5 must all be Done. Read CLAUDE.md, MinimaAds.md §6.10 §8.15 Appendix B.5, AGENTS.md, the current handleDoChannelOpen / buildAndPostChannelTx / savePendingChannelOp / handleFePending in dapp/app.js, and the current pause/resume/finish buttons in dapp/views/mycampaigns.js.

Task: Add buildAndPostStatusUpdateTx in app.js and wire mycampaigns.js buttons to call it AFTER the existing MA_LOCAL_STATUS broadcast.

PART 1 — dapp/app.js, new functions:

1. buildAndPostStatusUpdateTx(campaignId, newStatus, onResult)
   - Validate newStatus is 'active'|'paused'|'finished' via encodeStatusForTx (returns hex or '')
   - Load campaign: getCampaign(campaignId, ...)
   - Extract: ESCROW_COINID, ESCROW_WALLET_PK, plus enough context to build state ports.
     The platform key / max_pub_budget / feeflag values aren't kept in the local DB explicitly — read them from the current escrow coin's prevstate via:
       MDS.cmd('coins coinid:' + escrowCoinId + ' relevant:false', function(res) {
         var prevstate = res.response[0].prevstate;
         // getStateVar to read ports 5, 6, then look at coin.state for 11 if needed
       })
     If prevstate(5) is missing or '0x00': this is a legacy V1/V2 coin OR a V3 coin without platform fee. The status-update will still work — pass values forward as-is.
   - Resolve ESCROW_ADDRESS_V3 from keypair (must exist — T-SC2 set it). If missing, return error.
   - Build the tx:
       var txId = 'st_' + generateUID();
       MDS.cmd('txncreate id:' + txId)
       MDS.cmd('txninput id:' + txId + ' coinid:' + escrowCoinId + ' scriptmmr:true')
       MDS.cmd('txnoutput id:' + txId + ' storestate:true amount:' + fullAmount + ' address:' + escrowAddrV3)
       // for each port from buildStatusUpdateStatePorts(...):
       MDS.cmd('txnstate id:' + txId + ' port:<p> value:<v>')
       MDS.cmd('txnsign id:' + txId + ' publickey:' + walletPK)
         → if pending: savePendingChannelOp(uid, { kind:'status_update_sign', ctx... }) ; signalFE('STATUS_TX_PENDING', { campaign_id, status, pending_uid })
       MDS.cmd('txnpost id:' + txId + ' mine:true')
         → if pending: savePendingChannelOp(uid, { kind:'status_update_post', ctx... }) ; signalFE('STATUS_TX_PENDING', ...)
       MDS.cmd('txndelete id:' + txId)
       onResult({ ok:true, new_escrow_coinid: ... })

2. After successful post: extract the new escrow change coinid from txpow.body.txn.outputs (the one whose address === escrowAddrV3), and UPDATE CAMPAIGNS.ESCROW_COINID = newCoinId via sqlQuery. Then signalFE('CAMPAIGN_UPDATED', { campaign_id, status: newStatus }).

3. Extend handleFePending (the MDS_PENDING resume in app.js) to recognise kind === 'status_update_sign' and kind === 'status_update_post' and resume the tx from the saved ctx (same pattern as channel_split_sign / channel_split_post).

PART 2 — dapp/views/mycampaigns.js:

4. After each `MDS.comms.broadcast(JSON.stringify({ type: 'MA_LOCAL_STATUS', ... }))` line (3 of them — paused / active / finished), add:
     buildAndPostStatusUpdateTx(c.ID, '<paused|active|finished>', function(res) {
       if (!res || !res.ok) {
         alert('Status updated locally but on-chain propagation failed: ' + (res && res.error ? res.error : 'unknown'));
       }
     });
   Use `window.buildAndPostStatusUpdateTx` if needed (app.js attaches it globally).

5. Add a small visual indicator next to the row when STATUS_TX_PENDING fires for that campaign:
   Listen for the 'STATUS_TX_PENDING' MDSCOMMS signal and append a "(awaiting on-chain confirm)" label.

PART 3 — Rules and constraints:

- FE code may use let/const/arrow (browser context).
- Do NOT remove the MA_LOCAL_STATUS broadcast — it's still needed for immediate creator-UI feedback and for fast-path propagation to nodes currently online.
- Do NOT make the UI wait for the on-chain tx to confirm — fire-and-forget; the user can move on. The local DB is already up-to-date via MA_LOCAL_STATUS handling on the creator's SW.
- The status-update tx must NOT fire for legacy campaigns whose escrow coin is on V1/V2. In that case skip the on-chain tx silently and log a warning. Detect via: read the campaign's escrow coin address; if it doesn't equal ESCROW_ADDRESS_V3, skip the tx.

Definition of done:
- [ ] buildAndPostStatusUpdateTx exists, handles pending approve/deny
- [ ] handleFePending recognises status_update_sign and status_update_post kinds
- [ ] After successful tx, CAMPAIGNS.ESCROW_COINID updated to the new change coinid
- [ ] mycampaigns.js Pause/Resume/Finish call the on-chain tx after MA_LOCAL_STATUS
- [ ] STATUS_TX_PENDING signal fires while awaiting approval
- [ ] Legacy V1/V2 campaigns: status-update tx silently skipped with log warning
- [ ] No regression on existing MA_LOCAL_STATUS flow

Verification: 2-node test. Node A creates a campaign (V3). Node B sees the campaign and the active status. Node A pauses → Minima Hub asks to approve. Approve. Wait 1–2 blocks. On node B (without any Maxima broadcast received): SW log shows "[DISCOVERY] on-chain status sync: <id> active -> paused" and the FE updates within the next NEWBLOCK. Repeat for finish → confirm status propagates without Maxima.

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

### T-SC7 — Tests + KNOWN_ISSUES entry + docs cleanup

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

Task: Document the V3 status-coin design — its fragility points, verification steps, and update the project-wide protocol matrix.

1. docs/KNOWN_ISSUES.md — append new numbered entries:

   - On-chain status sync only triggers on a NEW coinid. Status-update txs always create a new change coin (different coinid), so _knownEscrowCoins[coinId] is fresh and DISCOVERY processes it. Do NOT add coinid de-dup before the status sync block.
   - port:7 missing on V2/V1 coins: status sync is silently skipped (legacy campaigns continue to rely on Maxima broadcasts + liveness pings).
   - Race condition: if the creator pauses AND the viewer's SW scans the OLD escrow coin in the same NEWBLOCK (before the change coin appears), the viewer still sees 'active'. Next NEWBLOCK after the status-update tx confirms resolves it. Acceptable: ≤1 block delay.
   - Terminal-state guard in processEscrowCoin: a finished campaign is NEVER reverted to active/paused from on-chain reads. This protects against the creator accidentally re-broadcasting an older coin scan if multiple V3 coins ever existed for the same campaign.
   - PREVSTATE(7) MUST be hex-encoded UTF-8 (e.g. '0x6163746976' for 'active'). KissVM stores text as hex; reads decode via hexToUtf8.

2. docs/VERIFICATION.md — append a section "Status Coin (T-SC) verification":
   - Setup: 2 nodes A (creator) and B (viewer), both online.
   - Test 1: Create campaign on A → confirm on B that the escrow coin's address is ESCROW_ADDRESS_V3 (`coins address:<V3>`) and PREVSTATE(7) decodes to 'active'.
   - Test 2: Take B offline. On A: pause campaign → approve pending tx → wait for confirmation. Bring B back online. Within 1–2 NEWBLOCKs on B, SW log shows "[DISCOVERY] on-chain status sync: <id> active -> paused", FE updates.
   - Test 3: On A: finish campaign → repeat. Verify B's local STATUS = 'finished'.
   - Test 4 (regression): Create a campaign with a legacy V2 address (revert creator.js temporarily, or use a pre-existing one). Pause it. Verify the on-chain tx is skipped with a log warning, and the Maxima broadcast still propagates.

3. AGENTS.md §9 Protocol Matrix (or equivalent message list):
   - Mark CAMPAIGN_PAUSE, CAMPAIGN_FINISH, CAMPAIGN_RESUME as "fast-path; authoritative state is ESCROW_V3 PREVSTATE(7)"
   - Add STATUS_TX_PENDING signal to the SW→FE signal list (if not already added by T-SC1)
   - Add new handoff entry in §8/§16 describing the T-SC implementation completion.

Do NOT modify any JS files.

Definition of done:
- [ ] KNOWN_ISSUES.md has 5 new entries for V3 status coin
- [ ] VERIFICATION.md has the 4-test status-coin section
- [ ] AGENTS.md protocol matrix annotated + handoff entry added

Provide the standard handoff note (CLAUDE.md §10) when done.
```

**Definition of done:**
- [ ] KNOWN_ISSUES.md updated
- [ ] VERIFICATION.md updated
- [ ] AGENTS.md updated
- [ ] No code changes

---
