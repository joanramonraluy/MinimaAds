# MinimaAds — Implementation Task List

> Ordered task list for agent sessions.
> Tasks must be implemented in sequence — each task depends on the previous one.
> One task per agent session. Fill in PromptBase.md §6 with the task before sending.

---

## Sequence Rule

```
T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9 → T10 → T11
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
| T9 | SDK | `sdk/index.js` | Not started |
| T10 | UI | `dapp/app.js`, `dapp/views/*.js` | Not started |
| T11 | UI | `renderer/renderAd.js`, `public/index.html`, `public/dapp.conf` | Not started |
