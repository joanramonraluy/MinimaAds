# AGENTS.md — MinimaAds Engineering Guide

Last reviewed against codebase: 2026-04-23 (Rev 12: pending flow bugfixes)
Scope: `/home/joanramon/Minima/MinimaAds`

> **Origin note**: This file was bootstrapped from lessons learned building MetaChain (a Minima MiniDapp). Sections 1–5 are generic to any Minima MiniDapp. Sections 6+ are project-specific and must be filled in as the project evolves.

---

## 0) Mandatory Update Mandate (Required)

**ANY AGENT (AI) making modifications to this repository IS REQUIRED to update this file (`AGENTS.md`) before finishing its task.**

The goal is that any learning, architectural change, new "fragility point" or design decision is recorded here for future agents. Do not use this file only for reading; it is your shared memory.

Handoff notes must include: `AGENTS.md updated: yes/no` and, if `yes`, list affected sections.
If you intentionally do not update `AGENTS.md`, include `AGENTS.md: N/A` with explicit reason.

---

## 0.5) Source of Truth — Document Hierarchy (MANDATORY)

This project is governed by **two documents** with a strict priority order:

| Document | Role | Authority |
|---|---|---|
| **MinimaAds.md** | Functional and architectural specification | **HIGHEST** — always wins on conflict |
| **AGENTS.md** | Operative and technical guide for agents | Derives from MinimaAds.md; complements it |

### Priority Rule

> **If AGENTS.md and MinimaAds.md conflict on any point → MinimaAds.md has priority.**

Before implementing any feature, the agent MUST read the relevant sections of MinimaAds.md for the areas being touched.

### What Each Document Owns

**MinimaAds.md owns** (agents must NOT override):
- Data models (Campaign, Ad, RewardEvent, UserProfile)
- Core API function signatures (sections 7.1–7.5)
- Maxima message schemas (sections 8.3–8.6)
- System flows: View, Click, Campaign Creation (sections 6.1–6.3)
- Anti-abuse limits and LIMITS constant values (section 5)
- H2 schema (section 3.5)
- Trust model and attack mitigations (sections 9–10)
- Economic model and fee structure (section 4)

**AGENTS.md owns** (operative and platform constraints):
- MDS API usage patterns and gotchas
- H2 database syntax rules
- Rhino/Nashorn syntax constraints
- SW ↔ FE communication patterns
- Pre-merge checklist
- Known fragility points (platform-level)
- Project topology, DB schema mirror, and protocol matrix (sections 6–10)

---

## 0.6) Development Workflow (MANDATORY)

Every agent working on MinimaAds MUST follow this sequence:

### Step 1 — Read before writing
1. Open MinimaAds.md and read the sections relevant to the task.
2. Cross-reference section 6 (Source of Truth) to confirm which modules are affected.
3. Check AGENTS.md sections 12 (Fragility Points) and 14 (Open Bugs) for known issues.
4. If any Minima platform behavior is unclear, consult the source and official docs at `refs/` before improvising. See CLAUDE.md §8 for the full lookup table (covers `refs/Minima-1.0.45/` Java/JS source AND `refs/docs-main/` official documentation).

### Step 2 — Identify affected modules
Map the task to one or more layers:

| Layer | Files | MinimaAds.md ref |
|---|---|---|
| Core | `core/campaigns.js`, `core/selection.js`, `core/validation.js`, `core/rewards.js`, `core/minima.js` | §7 |
| Service Worker | `public/service-workers/main.js`, `db-init.js`, `handlers/*.js` | §11 |
| Database schema | `db-init.js` (SW) + FE DB init | §3.5 |
| SDK | `sdk/index.js` | §13 |
| UI / MiniDapp | `dapp/app.js`, `dapp/views/*.js` | §12.1 |

### Step 3 — Implementation order (mandatory)

Always implement in this order to avoid broken dependencies:

1. **DB schema** — if any new table or column is needed (update both SW `db-init.js` and FE init)
2. **Core** — `core/*.js` functions (no UI, no MDS calls outside `core/minima.js`)
3. **Service Worker** — handlers in `public/service-workers/handlers/`
4. **SDK** — `sdk/index.js` public API wrappers
5. **UI** — `dapp/app.js` and `dapp/views/*.js`

### Step 4 — Validate coherence

Before marking the task done:
- [ ] Function signatures match MinimaAds.md §7 exactly
- [ ] Maxima message types match MinimaAds.md §8 schemas exactly
- [ ] LIMITS values are read from the `LIMITS` constant, never hardcoded inline
- [ ] Trust model not violated: client-side = semi-trusted, on-chain = authoritative (§9)
- [ ] `poll:false` on all outbound Maxima sends
- [ ] DB changes applied in BOTH runtimes
- [ ] AGENTS.md sections 8, 9, 10 updated if schema/protocol/signals changed

### Step 5 — Update AGENTS.md
See section 0) Mandatory Update Mandate.

---

## 0.7) Contract Enforcement — Core API Stability

The functions defined in MinimaAds.md §7 are **stable contracts**. They define the interface between layers.

### Rules

1. **Do not rename Core API functions** without:
   - Updating MinimaAds.md §7 in the same patch
   - Documenting the change in AGENTS.md §16 (Document History)

2. **Do not change function signatures** (parameter order, callback shape) without the same process.

3. **Do not add undocumented parameters** to Core API functions. If a new parameter is needed, add it to MinimaAds.md §7 first, then implement.

4. **SDK public API** (`sdk/index.js`) is the external contract with publishers. Changes here are breaking changes — treat them with extra caution.

5. **Maxima message schemas** (§8) are wire-format contracts. A change to any field name or type may break nodes running older versions.

### Stable Function Reference

The following function signatures must NOT be altered without a MinimaAds.md update:

```
campaigns.js : getCampaigns(cb), getCampaign(id, cb), saveCampaign(campaign, ad, cb),
               updateBudget(campaignId, deductAmount, cb), setCampaignStatus(campaignId, status, cb)
selection.js : selectAd(userAddress, userInterests, campaigns)  [synchronous]
validation.js: validateView(campaignId, userAddress, cb), validateClick(campaignId, userAddress, cb),
               isDuplicate(eventId, cb)
rewards.js   : createRewardEvent(params, cb), getUserRewards(userAddress, cb),
               getUserProfile(userAddress, cb)
minima.js    : sqlQuery(query, cb), broadcastMaxima(payload, cb), signalFE(type, data)
```

---

## 0.8) Forbidden Actions (MANDATORY)

The following actions are **prohibited** for any agent, regardless of task scope:

### Architecture
- ❌ **Do NOT introduce JavaScript frameworks** (React, Vue, Svelte, Angular, etc.). The frontend is Vanilla JavaScript (ES Modules). This is a final, non-negotiable decision.
- ❌ **Do NOT add a build step, bundler, or transpiler** (Webpack, Vite, esbuild, etc.) to the project. MVP has no build step.
- ❌ **Do NOT add UI logic inside Core modules** (`core/*.js`). Core = business logic only. No DOM access, no `document.*` calls.
- ❌ **Do NOT bypass the Service Worker for persistence**. All inbound network data must be persisted by SW (see section 1.3 Golden Rule 1).
- ❌ **Do NOT call `MDS.sql` directly outside `core/minima.js`**. All DB operations go through the `sqlQuery()` wrapper.

### Maxima
- ❌ **Do NOT send Maxima messages without `poll:false`**. A blocking send freezes the SW event loop for ~77 seconds (see section 2.3).
- ❌ **Do NOT add new `application:` names** in Maxima sends. Always use the `APP_NAME = 'minima-ads'` constant.
- ❌ **Do NOT modify Maxima message schemas** without updating MinimaAds.md §8 in the same patch.

### Data Model
- ❌ **Do NOT alter the data model** (add/rename/remove fields in Campaign, Ad, RewardEvent, UserProfile) without updating MinimaAds.md §3 and §3.5.
- ❌ **Do NOT hardcode LIMITS values inline**. Always read from the `LIMITS` constant object defined at the top of `main.js`.
- ❌ **Do NOT allow a creator to earn rewards from their own campaigns**. The `CREATOR_ADDRESS !== userAddress` check must exist in `selectAd()` and `validateView/Click()`.

### Process
- ❌ **Do NOT run `npm run build`**, `npm run minima:*`, or release packaging unless explicitly requested by the maintainer.
- ❌ **Do NOT invent new system flows** not defined in MinimaAds.md §6. If a new flow is needed, propose it to the maintainer first.
- ❌ **Do NOT silently modify AGENTS.md sections 6–10** (project topology, schema, protocol matrix, signals, source of truth rules) without also updating MinimaAds.md if there is a conflict.

---

## 0.9) Role of Agents — Implementers, Not Architects

Agents are **implementers**. The architecture is defined.

| Agent may | Agent may NOT |
|---|---|
| Implement functions defined in MinimaAds.md §7 | Redefine the function signature or purpose |
| Add new handler functions to the SW | Define new Maxima message types without MinimaAds.md §8 update |
| Add UI components to `dapp/views/` | Import React, Vue, or any framework |
| Add DB columns via `ADD COLUMN IF NOT EXISTS` | Change column types or remove existing columns |
| Fix bugs in existing Core logic | Refactor Core architecture unilaterally |
| Update AGENTS.md with new fragility points | Override decisions made in MinimaAds.md |
| Propose architectural changes (in writing) | Implement unapproved architectural changes |

If you believe a MinimaAds.md decision is incorrect or incomplete, **document the issue in AGENTS.md §14 (Open Bugs / Pending Fixes)** and stop. Do not implement a workaround that diverges from the spec.

---

## 1) Minima MiniDapp Runtime Model (Read First)

Every Minima MiniDapp runs in **two separate, independent runtimes** that share a local H2 database but have no direct memory or state sharing:

### 1.1 Frontend (FE)
- Browser context: React, TypeScript, or vanilla JS
- Bootstrapped via `MDS.init(...)` from the `@minima-global/mds` npm package
- Owns UI state, route logic, optimistic UX
- Reads/writes DB via `MDS.sql()` wrappers in services
- Receives inbound Maxima events through the MDS event callback
- Communicates with SW via `MDS.comms.solo()` signals (SW→FE only)

### 1.2 Service Worker (SW)
- Rhino/Nashorn JS engine running inside the Minima Java node (NOT a browser Service Worker)
- Entry point: `public/service.js` (typically compiled from `public/service-workers/main.js`)
- Initializes on `inited` MDS event
- Handles all inbound Maxima messages and network events
- Owns DB schema initialization and migrations
- Emits signals to FE via `MDS.comms.solo(...)`

### 1.3 Golden Rules
1. **SW is authoritative for persistence** — all inbound network data must be persisted by SW, not FE.
2. **FE is authoritative for UI** — rendering, optimistic updates, route logic.
3. **Never share mutable state** — the only bridge is the DB and `MDS.comms.solo` signals.
4. **SW → FE**: via `MDS.comms.solo(JSON.stringify({ type: "...", ... }))` → fires `MDSCOMMS` event in FE.
5. **FE → SW**: via DB writes + polling, or via raw `MDS.cmd(...)` service commands the SW listens to.

### 1.4 Build and Compile Ownership
- Compilation, build, packaging and release are owned by the project maintainer.
- Agents do NOT run `npm run build`, `npm run minima:*`, `capacitor` builds, or release packaging unless explicitly requested.
- Agents must always provide exact verification commands and pass criteria in handoff notes.

---

## 2) MDS API — Critical Distinctions

### 2.1 Frontend TypeScript (`@minima-global/mds`)

| Operation | Correct | Wrong |
|---|---|---|
| Send Maxima message | `MDS.cmd.maxima({ params: { action:'send', ... } }, cb)` | `MDS.cmd("maxima action:send ...")` ← namespace, not a function |
| Raw command (rare) | `MDS.executeRaw("maxima action:send ... poll:false", cb)` | — |
| SQL query | `MDS.sql("SELECT ...", cb)` | — |
| Emit SW signal | `MDS.comms.solo(payload)` | — (callback is supported but only confirms queuing, not delivery — use fire-and-forget) |

**`MDS.cmd` in the TypeScript package is a namespace object, not a callable function.** Calling `(MDS.cmd as any)("maxima ...")` silently does nothing. Always use `MDS.cmd.maxima(...)`, `MDS.cmd.block()`, etc.

**`MDS.executeRaw`** is available in the FE but should only be used when a raw command string is absolutely necessary (e.g., `poll:false` on a non-standard command). For standard Maxima sends, prefer `MDS.cmd.maxima()`.

For raw Maxima sends from FE that need `poll:false`:
```typescript
MDS.executeRaw(`maxima action:send to:${addr} application:myapp data:${hex} poll:false`, cb);
```

### 2.2 Service Worker (raw `mds.js`)

| Operation | Correct |
|---|---|
| Maxima send | `MDS.cmd("maxima action:send publickey:0x... application:myapp data:0x... poll:false", cb)` |
| SQL | `MDS.sql("SELECT ...", cb)` |
| Log | `MDS.log("message")` — NOT `console.log` (unavailable in Rhino) |
| Timer | Do NOT use `MDS.cmd("timer 30000", cb)` — fires immediately in Rhino |
| Signal to FE | `MDS.comms.solo(JSON.stringify({ type: "MY_EVENT", ... }))` — callback optional, only confirms queuing |

### 2.3 SW `MDS.cmd` and `MDS.sql` are synchronous

In the Service Worker (Rhino/Java), `MDS.cmd()` and `MDS.sql()` execute **synchronously** — the callback is called immediately inline before the outer function returns. There is no async scheduling, no event loop tick, no Promise.

```javascript
// In SW: callback fires synchronously — this is safe to chain deeply
MDS.sql("SELECT ...", function(res) {
  // This runs NOW, before the next line of the outer function
  MDS.sql("INSERT ...", function(res2) {
    // And this runs NOW too
  });
});
```

**Consequence**: race conditions within a single event handler are impossible in SW. But state shared across two separate MAXIMA events can still race if two messages arrive in quick succession.

**FE contrast**: In the FE, `MDS.sql()` sends an HTTP POST (truly async). Callback fires only after the HTTP round-trip (~few ms).

### 2.4 `poll:false` — Mandatory in Hot Paths
All outbound Maxima sends in the SW (and FE) **must** use `poll:false`. Without it, the send blocks the entire SW event loop for ~77 seconds if the target is offline or not in contacts. This freezes gossip, message processing, and DB maintenance.

```javascript
// SW — always include poll:false
MDS.cmd("maxima action:send publickey:" + pk + " application:myapp data:" + hex + " poll:false", cb);
```

---

## 3) H2 Database — Minima-Specific Gotchas

### 3.1 Column Names Are UPPERCASE
MDS SQL returns row keys in **UPPERCASE** regardless of how you defined them.

```javascript
// You defined: CREATE TABLE FOO (myColumn VARCHAR(256))
MDS.sql("SELECT myColumn FROM FOO", function(res) {
  var row = res.rows[0];
  console.log(row.myColumn);   // undefined
  console.log(row.MYCOLUMN);   // ✅ correct
});
```

**Rule**: When reading SQL results, always access fields in UPPERCASE, OR use `row.FIELD || row.field` if the object may come from either a raw SQL result or an already-mapped service object.

### 3.2 No PostgreSQL `ON CONFLICT` — Use `MERGE INTO`
H2 does not support PostgreSQL's `ON CONFLICT(col) DO UPDATE SET`. Use H2's `MERGE INTO` syntax:

```sql
-- ❌ PostgreSQL syntax — throws JdbcSQLSyntaxErrorException in H2
INSERT INTO MY_TABLE (id, value) VALUES (1, 'x') ON CONFLICT(id) DO UPDATE SET value='x';

-- ✅ H2 syntax
MERGE INTO MY_TABLE (id, value) KEY (id) VALUES (1, 'x');
```

### 3.3 BOOLEAN Columns Return Strings
H2 BOOLEAN columns return `"true"` or `"false"` (strings), not JS `true`/`false`.

```javascript
// ❌ This will always be false for stored TRUE values:
if (row.IS_ACTIVE) { ... }

// ✅ Correct:
if (row.IS_ACTIVE === true || row.IS_ACTIVE === 1 || row.IS_ACTIVE === "true" || row.IS_ACTIVE === "1") { ... }
```

### 3.4 NULL Columns Are Omitted from Row Objects

**Verified on real H2/MDS node (2026-04-21).** When a column contains NULL, H2/MDS omits the field entirely from the returned row object — it is `undefined`, not `null`.

```javascript
// EXPIRES_AT BIGINT DEFAULT NULL — inserted as NULL
var row = result.rows[0];
row.EXPIRES_AT          // → undefined  (field absent)
row.EXPIRES_AT === null // → false  ← WRONG assumption

// ✅ Correct guard:
var expiresAt = (row.EXPIRES_AT !== null && row.EXPIRES_AT !== undefined) ? row.EXPIRES_AT : "NULL";
```

This affects any column with `DEFAULT NULL` (EXPIRES_AT, INTERESTS, LAST_REWARD_AT, PUBLISHER_ID).

### 3.5 Schema Migrations — Both Runtimes
Both SW and FE initialize the DB schema independently. Any schema change must be mirrored in both:
- SW: `public/service-workers/db-init.js` (or equivalent)
- FE: `src/services/database.service.ts` (or equivalent)

Use `ADD COLUMN IF NOT EXISTS` for non-breaking migrations:
```sql
ALTER TABLE MY_TABLE ADD COLUMN IF NOT EXISTS new_field VARCHAR(256) DEFAULT NULL;
```

**Never use `ALTER TABLE ... ALTER COLUMN ... SET DATA TYPE`** for virtual/computed columns — H2 does not allow altering columns referenced by expressions.

### 3.5 Case-Sensitive String Comparisons
H2 string comparisons are case-sensitive by default. For public keys, IDs, or any value that may have inconsistent casing, always use `UPPER()`:
```sql
WHERE UPPER(publickey) = UPPER('0x30819f...')
WHERE UPPER(channel_id) = UPPER('0xabc...')
```
Silent 0-row updates are the most common symptom of missing `UPPER()`.

**`0x` vs `0X` prefix inconsistency**: Maxima delivers public keys with a lowercase `0x` prefix (`0x30819f...`), but after `UPPER()` or H2 storage the prefix becomes `0X`. Any JS code that uses `startsWith('0x')`, `Set.has(pubkey)`, or strict string equality on public keys must normalize both sides:
```javascript
// Wrong — misses 0X variant:
if (pubkey.startsWith('0x')) { ... }

// Correct:
if (pubkey.toLowerCase().startsWith('0x')) { ... }

// For set lookups and comparisons:
pubkey.toUpperCase() === otherKey.toUpperCase()
```

### 3.6 SQL Injection — Escape User Input

User-supplied strings (campaign `TITLE`, ad `BODY`, `CTA_URL`, `INTERESTS`) must be escaped before interpolation into SQL. The official Minima examples (`maxsolo/service.js`) do **not** escape and are vulnerable — do not follow that pattern.

```javascript
// Minimal safe escape for H2 / Rhino (no external libs available):
function escapeSql(str) {
  return str.replace(/'/g, "''");
}

// Usage:
var sql = "MERGE INTO ADS (ID, TITLE, BODY) KEY (ID) VALUES ("
  + "'" + id + "',"
  + "'" + escapeSql(title) + "',"
  + "'" + escapeSql(body) + "')";
```

**Rule**: Every string value interpolated into an MDS.sql query that originates from user input or an inbound Maxima payload must pass through `escapeSql()`. Numeric values (BUDGET, REWARD amounts) must be cast with `parseFloat()` before interpolation — never trust them as raw strings.

### 3.7 Async Callback Pattern
All MDS SQL calls are asynchronous with Node-style callbacks. There is no Promise API in the SW (Rhino). Chain operations inside callbacks:

```javascript
MDS.sql("SELECT ...", function(res) {
  if (!res.status) { MDS.log("Error: " + res.error); return; }
  var rows = res.rows;
  // next operation here
  MDS.sql("INSERT ...", function(res2) { ... });
});
```

---

## 4) Maxima — P2P Messaging Layer

### 4.1 Overview
Maxima is Minima's unicast P2P messaging layer. It routes messages by public key or Mx address.

- **Public key send**: `publickey:0x30819f...` — requires the recipient to be in your Maxima contacts.
- **Address send**: `to:Mx...` — works without contact relationship, uses routing via MLS/relay.
- **Always use `poll:false`** — see section 2.3.

### 4.2 Send Fallback Strategy
When sending to a peer who may not be in contacts:
1. Try `publickey:0x...` first.
2. On "No Contact found" error, resolve `Mx...` address from local discovery cache.
3. Retry with `to:Mx...`.

Never assume a peer is in contacts. Implement the fallback chain from the start.

### 4.3 Payload Size Limit — 256 KB

Maxima rejects messages larger than **262144 bytes** (256 KB) with a `TOOBIG` response. The limit applies to the full MaximaPackage (header + public key + signature + data). The usable data payload is slightly smaller.

A full `CAMPAIGN_ANNOUNCE` message (campaign + ad JSON, hex-encoded) is typically 1–3 KB — well within the limit. No practical risk for MinimaAds MVP.

If a send returns `TOOBIG`, the message is silently dropped with a node log warning. The SW callback receives `delivered: false`. Always check `result.response.delivered` in the `broadcastMaxima` callback if you need delivery confirmation.

### 4.4 `maxima action:sendall` — Broadcast to All Contacts

`MDS.cmd("maxima action:sendall application:... data:... ", cb)` sends to **all Maxima contacts** in one command. It always uses the background sender (non-blocking, equivalent to `poll:true` per-contact). No `poll:false` parameter is available or needed.

This is the recommended implementation for `broadcastMaxima` in `core/minima.js`:

```javascript
// Preferred: single command, always non-blocking
function broadcastMaxima(payload, cb) {
  var hex = "0x" + utf8ToHex(JSON.stringify(payload)).toUpperCase();
  MDS.cmd("maxima action:sendall application:" + APP_NAME + " data:" + hex, function(res) {
    cb(res.status);
  });
}
```

**Caveat**: The Maxima poll send queue is capped at **256 pending messages**. If the queue exceeds 256, it is cleared. If you have many contacts and re-broadcast frequently, this could cause silent drops. For MVP network sizes, this is not a concern.

### 4.5 Triple Identity — Mx address, Maxima PK, Wallet PK

Minima nodes have three identifiers. Each has a distinct role:

| Identifier | Format | Source command | Used for |
|---|---|---|---|
| Maxima public key | `0x30819f...` (256-bit) | `maxima action:info → publickey` | Node identity in MinimaAds: `CREATOR_ADDRESS`, `USER_PROFILE.ADDRESS`, Maxima routing |
| Mx address | `Mx...` | `maxima action:info → address` | Maxima `to:` fallback, UI display — do NOT store as identity |
| Wallet signing key | `0x...` (64 chars, 256-bit) | `keys action:list → publickey` | KissVM `SIGNEDBY()` — escrow PREVSTATE(1) only |

**Rules**:
- `CREATOR_ADDRESS` and `USER_PROFILE.ADDRESS` = **Maxima PK** — never Mx address, never wallet key.
- `CAMPAIGNS.ESCROW_WALLET_PK` = **wallet signing key** — never Maxima PK.
- These are different cryptographic keys. Do not substitute one for the other.
- When querying by address from user input or Maxima payload, always normalize with `UPPER()`.
- When comparing in JS, always use `.toUpperCase()` on both sides — see §3.5 for the `0x`/`0X` prefix issue.
- `broadcastMaxima` in `core/minima.js` must implement the fallback chain: try `publickey:` first, then `to:` on "No Contact found".

### 4.3 Payload Encoding
Maxima `data` field must be hex-encoded:
```javascript
function utf8ToHex(str) {
  // standard utf8 → hex conversion
}
var payload = JSON.stringify({ type: "my_message", data: "hello" });
var hex = "0x" + utf8ToHex(payload).toUpperCase();
MDS.cmd("maxima action:send publickey:" + pk + " application:myapp data:" + hex + " poll:false", cb);
```

### 4.4 Application Name
Each MiniDapp should use a consistent `application:` name in all Maxima sends. The SW filters inbound Maxima events by this name. Define it as a constant and never hardcode it in multiple places.

### 4.5 Receiving Maxima Messages
In the SW, inbound Maxima messages arrive via the `MAXIMA` MDS event:
```javascript
MDS.init(function(msg) {
  if (msg.event === "MAXIMA") {
    var payload = JSON.parse(hexToUtf8(msg.data.data));
    // route by payload.type
  }
});
```

---

## 5) SW ↔ FE Communication

### 5.1 SW → FE: `MDS.comms.solo()`
```javascript
// SW fires:
MDS.comms.solo(JSON.stringify({ type: "MY_EVENT", someField: "value" }));
```

```typescript
// FE receives via MDS event (minima.service.ts or equivalent):
// event.event === "MDSCOMMS"
// event.data.message === '{"type":"MY_EVENT","someField":"value"}'
const parsed = JSON.parse(event.data?.message ?? event.data);
if (parsed.type === "MY_EVENT") { ... }
```

**Key facts:**
- The FE event name is `MDSCOMMS`, NOT `MDS_SOLO`.
- The payload string is at `event.data.message`, not `event.data`.
- `MDS.comms.solo()` is **fire-and-forget** — do NOT pass a second callback argument (it silently fails).
- Every new SW signal type must be added to the FE MDSCOMMS handler. Missing it means the UI never reacts.

### 5.2 FE → SW: Service Commands
For FE-initiated actions that require SW execution:
```typescript
// FE sends a raw command string the SW listens for:
(window as any).MDS?.cmd("service:MY_ACTION:" + someId, () => {});
```
```javascript
// SW listens:
if (msg.event === "MDS_INITED" && msg.data?.startsWith("service:MY_ACTION:")) {
  var id = msg.data.split(":")[2];
  // execute action
}
```

### 5.3 Timer Pattern in SW — Periodic Re-broadcast

`MDS.cmd("timer X", cb)` in Rhino fires `cb` **immediately**, not after X milliseconds. For real elapsed-time delays:

```javascript
// Store start time:
var _myState = { startedAt: Date.now() };

// Check elapsed time in the MDS_TIMER_10SECONDS handler:
MDS.init(function(msg) {
  if (msg.event === "MDS_TIMER_10SECONDS") {
    if (Date.now() - _myState.startedAt >= 30000) {
      // 30 seconds have passed
    }
  }
});
```

**MinimaAds re-broadcast pattern** — `MDS_TIMER_10SECONDS` fires every ~10 s, but CAMPAIGN_ANNOUNCE should re-broadcast every ~10 min (600 s). Use a tick counter:

```javascript
var _timerTicks = 0;
var REBROADCAST_EVERY_TICKS = 60; // 60 × 10s = 600s = 10 min

function onTimer() {
  _timerTicks++;
  if (_timerTicks >= REBROADCAST_EVERY_TICKS) {
    _timerTicks = 0;
    rebroadcastActiveCampaigns();
  }
  checkExpiredCampaigns();
}
```

The `_timerTicks` counter resets on SW restart (node reboot), so the first re-broadcast may happen sooner than 10 min after a restart. This is acceptable for MVP.

### 5.4 Rhino/Nashorn Syntax Constraints
The SW runs on Rhino (Java-based JS engine). Avoid:
- **Trailing commas** in function parameter lists → `EvaluatorException: missing formal parameter`
- **Arrow functions** (limited support) — use `function()` instead
- **`let`/`const`** in some Rhino versions — use `var` for safety
- **Template literals** in older Rhino — use string concatenation

Syntax errors in Rhino are silent: Minima reports `Started service.js` even when the script has evaluation errors.

---

## 6) Project Intent

MinimaAds is a **decentralized advertising infrastructure** running on the Minima blockchain as a MiniDapp.

**Core purpose**: Allow advertisers (creators) to publish ad campaigns with a locked token budget, and reward users (viewers) for viewing and clicking ads. Campaigns propagate peer-to-peer via Maxima — no central server, no external tracking.

**Target users**:
- **Viewers**: Minima node operators who earn token rewards for engaging with ads
- **Creators**: Advertisers who fund campaigns with Minima tokens locked in a KissVM escrow
- **Publishers**: dApp developers who integrate MinimaAds via the SDK to display ads

**Non-goals (MVP)**: Multi-hop campaign gossip, cryptographic event signing, image/video ads, A/B testing.

> Full specification: MinimaAds.md §1.3, §2, §4, Appendix A.

---

## 6) Canonical Utility Functions

These implementations are required in `public/service-workers/main.js` (SW context). Do NOT use browser APIs (`TextEncoder`, `crypto.randomUUID`) — they are unavailable in Rhino.

```javascript
// Hex → UTF-8 string (Rhino-compatible).
// Strips an optional leading "0x"/"0X" prefix — Maxima msg.data.data
// arrives with the prefix and JSON.parse would fail at char 1 otherwise.
function hexToUtf8(s) {
  var hex = s.replace(/\s+/g, '');
  if (hex.length >= 2 && hex.charAt(0) === '0' && (hex.charAt(1) === 'x' || hex.charAt(1) === 'X')) {
    hex = hex.substring(2);
  }
  return decodeURIComponent(hex.replace(/[0-9A-F]{2}/gi, '%$&'));
}

// UTF-8 string → hex (pure JS, no TextEncoder)
function utf8ToHex(str) {
  var hex = '';
  for (var i = 0; i < str.length; i++) {
    var code = str.charCodeAt(i);
    if (code < 128) {
      hex += ('0' + code.toString(16)).slice(-2);
    } else if (code < 2048) {
      hex += ('0' + ((code >> 6) | 192).toString(16)).slice(-2);
      hex += ('0' + ((code & 63) | 128).toString(16)).slice(-2);
    } else {
      hex += ('0' + ((code >> 12) | 224).toString(16)).slice(-2);
      hex += ('0' + (((code >> 6) & 63) | 128).toString(16)).slice(-2);
      hex += ('0' + ((code & 63) | 128).toString(16)).slice(-2);
    }
  }
  return hex;
}

// Unique ID generator (not RFC UUID, but collision-safe for single-node use)
function generateUID() {
  return Date.now().toString(16) + '-' + Math.floor(Math.random() * 0xFFFFFFFF).toString(16);
}
```

**Rules**:
- `hexToUtf8` / `utf8ToHex` must be defined before `MDS.init(...)` in `main.js` — all handlers depend on them.
- `generateUID()` is used by `createRewardEvent()` and `saveCampaign()` to assign IDs. Never call `Math.random()` alone — always combine with `Date.now()` to avoid collisions if called in the same millisecond.
- For FE (`core/minima.js`), `utf8ToHex` can use `TextEncoder` since it runs in a browser context.

---

## 6.0) Node Identity — Getting the User's Address

`USER_PROFILE.ADDRESS` and `CAMPAIGN.CREATOR_ADDRESS` use the **Maxima public key** (`0x...`), not the Minima wallet address. The Maxima public key uniquely identifies the node, is used for Maxima routing, and is what arrives in `msg.data.from` on inbound messages.

**Pattern for `onInited()` in SW:**

```javascript
var MY_MAXIMA_PK = '';  // module-level, set once on init

function onInited() {
  initDB(function() {
    MDS.cmd("maxima action:info", function(resp) {
      MY_MAXIMA_PK = resp.response.publickey.toUpperCase();
      registerUserProfile(MY_MAXIMA_PK);
    });
  });
}

function registerUserProfile(pk) {
  var sql = "MERGE INTO USER_PROFILE (ADDRESS, INTERESTS, TOTAL_EARNED) "
          + "KEY (ADDRESS) VALUES ('" + pk + "', '', 0)";
  MDS.sql(sql, function(res) {
    MDS.log("[ADS] User profile registered: " + pk);
  });
}
```

**Why not `getaddress`?** `getaddress` returns a Minima wallet address (for token transactions). For all identity checks, routing, and anti-self-reward logic, use the Maxima public key.

**KissVM escrow requires a third key — the wallet signing key:**
```javascript
// Fetch wallet signing key for escrow PREVSTATE(1) — only needed at campaign creation
MDS.cmd("keys action:list", function(res) {
  var walletPK = res.response.keys[0].publickey;  // 0x..., 64 hex chars
  // Use walletPK in CAMPAIGNS.ESCROW_WALLET_PK and in the escrow send state
});
```
See MinimaAds.md Appendix B for the full escrow flow.

---

## 6.1) Logging Convention (SW)

Use consistent prefixed tags in all `MDS.log()` calls so traces are searchable across sessions:

| Prefix | Module |
|---|---|
| `[ADS]` | General / entry points (`main.js`) |
| `[CAMPAIGN]` | `campaign.handler.js` |
| `[MAXIMA]` | `maxima.handler.js` — inbound routing |
| `[REWARD]` | `core/rewards.js` |
| `[VALIDATION]` | `core/validation.js` |
| `[DB]` | `core/minima.js` — sqlQuery errors |
| `[TIMER]` | `onTimer()` — re-broadcast and expiry checks |

```javascript
MDS.log("[CAMPAIGN] ANNOUNCE received, campaign_id: " + id);
MDS.log("[VALIDATION] validateView failed: cooldown active for " + userAddress);
MDS.log("[DB] sqlQuery error: " + res.error);
```

---

## 7) Runtime Topology (Project-Specific)

> Full architecture: MinimaAds.md §1.2, §11, §12.

### 7.1 Frontend (FE)

| File | Responsibility |
|---|---|
| `dapp/app.js` | FE entry point — `MDS.init`, routing, view dispatch, MDSCOMMS handler |
| `dapp/views/creator.js` | Campaign creation UI |
| `dapp/views/viewer.js` | Ad viewing + reward display UI |
| `dapp/views/stats.js` | Campaign stats UI |
| `sdk/index.js` | Public SDK: `init`, `getAd`, `render`, `trackView`, `trackClick` |
| `renderer/renderAd.js` | Pure DOM renderer — renders one ad unit into a container element |
| `core/campaigns.js` | Campaign CRUD, budget tracking |
| `core/selection.js` | `selectAd()` — synchronous ad selection algorithm |
| `core/validation.js` | `validateView/Click()`, `isDuplicate()`, LIMITS enforcement |
| `core/rewards.js` | `createRewardEvent()`, `getUserProfile()` |
| `core/minima.js` | MDS.sql wrapper, Maxima sender, FE signaller |

**Layer constraint**: Core must not import from MiniDapp, SDK, or Renderer. Data flows downward only.

### 7.2 Service Worker (SW)

| File | Responsibility |
|---|---|
| `public/service-workers/main.js` | SW entry point — `APP_NAME`, `LIMITS`, `MDS.init` handler |
| `public/service-workers/db-init.js` | H2 schema init — called from `onInited()` |
| `public/service-workers/handlers/maxima.handler.js` | Routes inbound Maxima messages by `payload.type` |
| `public/service-workers/handlers/campaign.handler.js` | `CAMPAIGN_ANNOUNCE`: persist + signal FE |
| `public/service-workers/handlers/reward.handler.js` | `REWARD_REQUEST`: validate + persist + signal FE |
| `public/service.js` | Compiled SW output — do NOT edit directly |

**MDS Events handled by SW**:

| MDS event | Handler | Action |
|---|---|---|
| `inited` | `onInited()` | Init DB schema, get Maxima identity, register escrow script, initial coin scan |
| `MAXIMA` | `onMaxima(data)` | Hex-decode payload, route by `payload.type` |
| `MDS_TIMER_10SECONDS` | `onTimer()` | Re-broadcast active campaigns, check expirations |
| `NEWBLOCK` | `scanEscrowCoins()` | Query `coins address:<ESCROW_ADDRESS>` and request data for unknown campaigns |
| `MDS_PENDING` | `onPending(msg)` | Fired when user accepts/denies a pending send via Minima Hub. Reads `msg.data.{uid,accept,status,result}`. On accept: extracts coinId from `msg.data.result.response.body.txn.outputs[0].coinid` and campaignId from `msg.data.result.response.body.txn.state[port=3]`; reads campaign+ad from keypair (`PENDING_CAMPAIGN_<campaignId>`); calls `saveCampaign`; signals `NEW_CAMPAIGN` to FE. |

---

## 8) DB Schema

> Authoritative schema definition: MinimaAds.md §3.5. This section mirrors it for quick agent reference.
> Update BOTH this section AND MinimaAds.md §3.5 for every schema change.

| Table | Purpose | Primary Key |
|---|---|---|
| `CAMPAIGNS` | Stores all known campaigns (local + received via Maxima) | `ID` |
| `ADS` | Stores ad units linked to campaigns | `ID` |
| `REWARD_EVENTS` | Audit log of all view/click events; used for dedup and limit checks | `ID` |
| `USER_PROFILE` | Stores local user address, interests, earned totals | `ADDRESS` |

### CAMPAIGNS
| Column | Type | Notes |
|---|---|---|
| `ID` | VARCHAR(256) PK | UUID |
| `CREATOR_ADDRESS` | VARCHAR(512) NOT NULL | Maxima public key (0x...) — RSA DER hex, ~326 chars — NOT wallet PK |
| `TITLE` | VARCHAR(512) NOT NULL | |
| `BUDGET_TOTAL` | DECIMAL(20,6) NOT NULL | |
| `BUDGET_REMAINING` | DECIMAL(20,6) NOT NULL | Decremented on each reward |
| `REWARD_VIEW` | DECIMAL(20,6) NOT NULL | |
| `REWARD_CLICK` | DECIMAL(20,6) NOT NULL | |
| `STATUS` | VARCHAR(32) DEFAULT 'active' | `draft\|active\|paused\|finished` |
| `CREATED_AT` | BIGINT NOT NULL | unix ms |
| `EXPIRES_AT` | BIGINT DEFAULT NULL | unix ms or null |
| `ESCROW_COINID` | VARCHAR(66) DEFAULT '' | On-chain escrow coinid (set at campaign creation; updated after each batch payout) |
| `ESCROW_WALLET_PK` | VARCHAR(66) DEFAULT '' | Creator wallet signing key used in escrow PREVSTATE(1) — NOT the Maxima PK |

### ADS
| Column | Type | Notes |
|---|---|---|
| `ID` | VARCHAR(256) PK | UUID |
| `CAMPAIGN_ID` | VARCHAR(256) NOT NULL | FK → CAMPAIGNS.ID |
| `TITLE` | VARCHAR(512) NOT NULL | |
| `BODY` | VARCHAR(2048) | |
| `CTA_LABEL` | VARCHAR(128) | |
| `CTA_URL` | VARCHAR(1024) | |
| `INTERESTS` | VARCHAR(1024) DEFAULT NULL | comma-separated tags |

### REWARD_EVENTS
| Column | Type | Notes |
|---|---|---|
| `ID` | VARCHAR(256) PK | UUID — used for dedup via `isDuplicate()` |
| `CAMPAIGN_ID` | VARCHAR(256) NOT NULL | |
| `AD_ID` | VARCHAR(256) NOT NULL | |
| `USER_ADDRESS` | VARCHAR(512) NOT NULL | Maxima public key — same RSA DER hex format, ~326 chars |
| `TYPE` | VARCHAR(16) NOT NULL | `view\|click` |
| `AMOUNT` | DECIMAL(20,6) NOT NULL | |
| `TIMESTAMP` | BIGINT NOT NULL | unix ms |
| `PUBLISHER_ID` | VARCHAR(256) DEFAULT NULL | audit trail |

### USER_PROFILE
| Column | Type | Notes |
|---|---|---|
| `ADDRESS` | VARCHAR(512) PK | Maxima public key (0x...) — RSA DER hex, ~326 chars |
| `INTERESTS` | VARCHAR(1024) DEFAULT NULL | comma-separated tags |
| `TOTAL_EARNED` | DECIMAL(20,6) DEFAULT 0 | cumulative rewards |
| `LAST_REWARD_AT` | BIGINT DEFAULT NULL | unix ms; used for cooldown check |

### DEDUP_LOG
| Column | Type | Notes |
|---|---|---|
| `ID` | VARCHAR(256) PK | RewardEvent UUID — checked by `isDuplicate()` |
| `LOGGED_AT` | BIGINT NOT NULL | unix ms — reserved for future pruning |

**Schema parity rule**: Any new table or column must be added in **both** SW `db-init.js` and FE DB init in the same patch. Use `ADD COLUMN IF NOT EXISTS` for non-breaking migrations.

---

## 9) Protocol / Message Types

> Authoritative schemas: MinimaAds.md §8. This section mirrors them for agent reference.
> Update BOTH this section AND MinimaAds.md §8 for every new message type.

| Maxima Type | Direction | Handler | DB Impact | FE Signal |
|---|---|---|---|---|
| `CAMPAIGN_ANNOUNCE` | Creator SW → all contacts | `campaign.handler.js` | `MERGE INTO CAMPAIGNS` + `MERGE INTO ADS` | `NEW_CAMPAIGN` |
| `CAMPAIGN_PAUSE` | Creator SW → all contacts | `campaign.handler.js` | `UPDATE CAMPAIGNS SET STATUS='paused'` | `CAMPAIGN_UPDATED` |
| `CAMPAIGN_FINISH` | Creator SW → all contacts | `campaign.handler.js` | `UPDATE CAMPAIGNS SET STATUS='finished'` | `CAMPAIGN_UPDATED` |
| `REQUEST_CAMPAIGN_DATA` | Viewer SW → Creator SW (unicast `to:Mx...`) | `campaign.handler.js` | None (read-only lookup) | None |
| `CAMPAIGN_DATA_RESPONSE` | Creator SW → Viewer SW (unicast `to:Mx...`) | `campaign.handler.js` | `MERGE INTO CAMPAIGNS` + `MERGE INTO ADS` | `NEW_CAMPAIGN` |

> **Reward processing is FE-owned** — not a Maxima message. `core/rewards.js` writes directly to REWARD_EVENTS, CAMPAIGNS, and USER_PROFILE via `sqlQuery()`. See MinimaAds.md §8.4.

**Application name**: `application:minima-ads` — defined as `APP_NAME` constant in `main.js`. Never hardcode the literal string in `MDS.cmd` calls.

**Rule**: Every new message type added to the SW must also be added to this table. If a type is handled somewhere and not listed here, future agents will implement duplicate handlers.

---

## 10) FE ↔ SW Signal Contract

> Authoritative signal contract: MinimaAds.md §8.8. This section mirrors it for agent reference.
> Update BOTH this section AND MinimaAds.md §8.8 whenever a new signal is added.

| Signal Type | Payload | Fired By | FE Reaction |
|---|---|---|---|
| `DB_READY` | `{}` | `db-init.js` (SW) | Unlock FE routing — only render DB-backed views once seen |
| `REWARD_CONFIRMED` | `{ event_id, amount, type }` | `core/rewards.js` (FE) | Update reward display, balance indicator |
| `CAMPAIGN_UPDATED` | `{ campaign_id, status, budget_remaining }` | `campaign.handler.js` (SW) | Refresh campaign card status |
| `NEW_CAMPAIGN` | `{ campaign_id }` | `campaign.handler.js` (SW) | Reload available campaigns list |
| `CAMPAIGN_PENDING_DENIED` | `{ uid }` | `campaign.handler.js` (SW) | Show "Transaction denied" in creator form |

**Rule**: Every new signal type fired by SW must be registered in the FE `MDSCOMMS` handler (`dapp/app.js`). Missing registrations cause silent UI failures. The payload is at `event.data.message` (not `event.data`) — see section 5.1.

---

## 11) Source of Truth Rules

> For document-level source of truth, see section 0.5.
> This section covers runtime state ownership.

| State | Owner | Details |
|---|---|---|
| Inbound Maxima event persistence | **SW** | `campaign.handler.js` only — reward processing is FE-owned |
| DB schema initialization | **Both** | SW `db-init.js` + FE init — both must be identical |
| UI state and rendering | **FE** | `dapp/views/*.js` |
| LIMITS constant | **SW** | Single `LIMITS` object in `main.js`. FE reads limits from DB if needed — never redefines them |
| Campaign availability (what to display) | **FE** | Reads from local DB via `getCampaigns()` |
| Budget tracking | **FE** | `updateBudget()` called by `core/rewards.js` in FE callback chain |
| Anti-abuse enforcement | **FE** | `validateView/Click()` in `validation.js` — FE writes directly to shared H2 DB |
| Token payment / escrow | **KissVM** | On-chain — authoritative. Client-side is performance optimization only |
| Reward event deduplication | **FE** | `isDuplicate(eventId)` called by `core/rewards.js` before any DB write |

**Creator cannot earn from own campaigns** — enforced in both `selectAd()` (FE, filters candidates) and `validateView/Click()` (SW, rejects events). Both checks must always be present.

---

## 12) Known Fragility Points

*Pre-populated with Minima platform gotchas. Add project-specific points as they are discovered.*

1. **MDS SQL returns UPPERCASE column names**. Always access `row.MYFIELD`, not `row.myField`. When objects may come from either raw SQL or already-mapped service objects, check both casings: `row.MYFIELD || row.myField`. See section 3.1.

2. **`MDS.cmd` in FE TypeScript is a namespace, not a function**. Use `MDS.cmd.maxima(...)` for Maxima sends. `(MDS.cmd as any)("...")` silently does nothing. See section 2.1.

3. **`MDS.comms.solo()` fires `MDSCOMMS` (not `MDS_SOLO`) in the FE**. Payload is at `event.data.message`. Using the wrong event name means all SW→FE signals are silently dropped. See section 5.1.

4. **`MDS.comms.solo()` does NOT support a second callback argument**. Providing one causes the notification to fail silently. Always fire-and-forget. See section 5.1.

5. **`poll:false` is mandatory on all Maxima sends in hot paths**. A blocking send to an offline peer freezes the SW event loop for ~77 seconds. See section 2.3.

6. **H2 BOOLEAN columns return strings `"true"`/`"false"`, not JS booleans**. Always check all four variants: `value === true || value === 1 || value === "true" || value === "1"`. See section 3.3.

7. **H2 NULL columns are omitted from row objects entirely — they are `undefined`, not `null`**. Verified on real node (2026-04-21). Affects: EXPIRES_AT, INTERESTS, LAST_REWARD_AT, PUBLISHER_ID. Guard with `!== null && !== undefined`. See section 3.4.

8. **`MERGE INTO ... KEY(...)` for upserts, not PostgreSQL `ON CONFLICT`**. H2 throws `JdbcSQLSyntaxErrorException` on PostgreSQL syntax. See section 3.2.

8. **`MDS.cmd("timer X", cb)` fires immediately in Rhino**. Use `MDS_TIMER_10SECONDS` + `Date.now()` timestamps for real elapsed-time logic. See section 5.3.

9. **Rhino trailing commas crash the SW silently**. Minima still reports `Started service.js` even when the script has a syntax error. No trailing commas in function parameter or argument lists. See section 5.4.

10. **Schema changes must be applied in both SW and FE runtimes**. Both initialize the DB independently. A column added only in one runtime causes the other to fail silently on INSERT/SELECT. See section 3.4.

11. **`UPPER()` required for all string comparisons on IDs and public keys**. H2 string comparisons are case-sensitive. Exact-case WHERE clauses silently match 0 rows when casing drifts. See section 3.5.

12. **All Maxima `data` payloads must be hex-encoded**. The raw JSON string must be converted to `0x` + uppercase hex before sending. Receiving side must hex-decode before `JSON.parse`. See section 4.3.

13. **SW handler function parameters must exactly match the dispatcher call**. In Rhino, referencing a variable from an outer function's scope in a sibling function causes `ReferenceError` on the receiver's node (different call context). Always pass all needed values as explicit arguments.

14. **Inbound Maxima handler must be registered for ALL expected message types**. If a message type arrives and no handler exists, Rhino throws `ReferenceError` and silently drops the message. Enumerate all types in the dispatcher from the start.

15. **`MDS.log()` is the only logging available in the SW**. `console.log` is not available in Rhino. Log with prefixed tags for searchability: `MDS.log("[MYFEATURE] ...")`.

18. **`MDSINIT` event fires alongside `inited` in SW**: Java source confirms `MDS.init()` fires the callback twice — first with `{ event: "inited" }`, then immediately with `{ event: "MDSINIT" }`. The SW handler must check `msg.event === "inited"` specifically and silently ignore `MDSINIT`. If you use `if(msg.event == "inited")` (exact match), this is already safe.

17. **FE/SW race condition on Maxima-triggered UI reloads**: When a `MAXIMA` event arrives, both the SW (persistence) and FE (UI) react. If the FE reloads from DB immediately on the MAXIMA event, the SW may not have finished writing yet. Add a ~200ms delay before DB reads triggered by MAXIMA events in the FE. Signals from SW via `MDS.comms.solo` (`MDSCOMMS`) are deterministic — the SW fires them only after writing — so no delay is needed for `MDSCOMMS`-triggered reloads.

16. **FE also receives `MAXIMA` events via polling** (every ~2.5 s via `PollListener`). The FE `MDS.init` callback will fire for ALL Maxima message types handled by the SW: `CAMPAIGN_ANNOUNCE`, `CAMPAIGN_PAUSE`, `CAMPAIGN_FINISH`, `REQUEST_CAMPAIGN_DATA`, `CAMPAIGN_DATA_RESPONSE`. The FE handler **must silently ignore** all of these types to prevent duplicate DB writes. Handle only `MDSCOMMS` (SW signals) and UI-specific events in the FE `MDS.init` callback.

18. **`newscript` removes and re-adds the script on every call** (verified in `newscript.java`). This means calling it on every SW restart is safe (address is deterministic), but the script's `trackall` setting is briefly reset during re-registration. The `scanEscrowCoins()` call immediately after `registerEscrowScript()` re-indexes all currently tracked coins, so no data is lost in practice.

17. **`VERIFYOUT` has 5 parameters** (not 4 as in older Minima docs). The 5th is a BOOL for `keepstate`. Always use the 5-param form: `VERIFYOUT(output_index address amount tokenid keepstate_bool)`. In MinimaAds escrow, the change output uses `TRUE` (keepstate). The payout output uses `FALSE` (no state needed for recipient's regular wallet). Example: `VERIFYOUT(INC(@INPUT) @ADDRESS change @TOKENID TRUE)`.

18. **`MDS_PENDING` event** — fired in the **SW** (not FE) when the user approves or denies a pending transaction via Minima Hub. The `send` command returns `{pending:true, pendinguid:"0x..."}` immediately; the original callback is **never called again** after approval. Recovery is via `MDS_PENDING`. The approved result arrives as `msg.data.result` with shape `{command, status, response: {txpowid, body: {txn: {inputs, outputs, state}}, ...}}` — **no `.txpow` wrapper** between `response` and `body`. CoinId: `msg.data.result.response.body.txn.outputs[0].coinid`. State variables: `msg.data.result.response.body.txn.state` (array of `{port, type, data}`). Verified on Minima 1.0.45.

19. **`MDS.keypair`** — persistent key-value store for MiniDapp config (survives restarts). Use it to store `ESCROW_ADDRESS` after the first `newscript` call, and to pass pending campaign data from FE to SW. **Critical: response shape differs between FE and SW contexts.** FE (HTTP API): `res.response.value`. SW (Rhino Java binding, `KEYPAIRService`): `res.value` (flat — no `response` wrapper). Always use `res.value` in SW code and `res.response.value` in FE code. Key not found → SW returns `{status:false}`, FE returns `{status:false}`. FE and SW share the same underlying store (scoped per DApp UID). Verified on Minima 1.0.45.

20. **Transaction shortcut commands**: `txninput scriptmmr:true` adds the MMR proof for the input coin at input time (avoids a separate `txnbasics` call). `txnpost id:... auto:true` adds MMR proofs and scripts automatically at post time. `txnsign id:... publickey:auto` signs with the matching key automatically — but for custom script coins (like the escrow), specify the wallet public key explicitly: `txnsign id:... publickey:<wallet_pubkey>`.

22. **`service.js` must be at the zip root — the `"service"` field in `dapp.conf` is ignored by Minima**. Use `MDS.load("path/to/file.js")` to load other JS files from the SW — the global `load()` function is **not defined** in the Minima Rhino runtime and throws `ReferenceError` at startup. All TASKS.md references to `load(...)` must be read as `MDS.load(...)`. Verified on Minima 1.0.45. Minima automatically looks for a file named exactly `service.js` at the root of the extracted MiniDapp zip. Any other name or path causes the SW to silently not start — no error is logged, Minima simply does not execute it. `dapp.conf` must also be at the zip root. For MinimaAds, both `service.js` and `dapp.conf` live at the project root; the zip is built from the project root (not from `public/`). `load()` paths inside `service.js` are relative to the zip root (e.g. `load("core/minima.js")`, `load("public/service-workers/db-init.js")`). Verified on Minima 1.0.45.

21. **Sanitize Maxima payloads before rendering (DOMPurify)**. Ad content (title, body, imageUrl) comes from third-party advertisers via Maxima. Before injecting any field into the DOM, run it through `DOMPurify.sanitize()`. The recommended pattern (from MinimaDEX) is to sanitize the entire JSON object at once: `var safe = JSON.parse(DOMPurify.sanitize(JSON.stringify(payload)))`. Apply this in `renderer/renderAd.js` (T11) and any place that renders campaign or ad data into HTML. `DOMPurify` must be included in `public/index.html` before `dapp/app.js`.

23. **`broadcastMaxima` in `core/minima.js` depends on `APP_NAME` being a global**. The function references `APP_NAME` directly (no import). In the SW, `APP_NAME` is defined at the top of `main.js` before `MDS.load("core/minima.js")` — so it is in scope. In the FE, any module that calls `broadcastMaxima` must ensure `APP_NAME` is defined in the same or outer scope before calling it. Do not refactor `broadcastMaxima` to accept `appName` as a parameter without updating MinimaAds.md §7.5.

24. **`signalFE` spreads `data` fields at root level of the payload object** — NOT nested under a `data` key. The FE MDSCOMMS handler must read fields directly from `parsed.*`, not from `parsed.data.*`. Example: `signalFE("REWARD_CONFIRMED", { event_id: "x", amount: 0.1 })` → `{ type: "REWARD_CONFIRMED", event_id: "x", amount: 0.1 }`. The T1 stub incorrectly nested data — this was fixed in T2.

---

## 13) Pre-merge Checklist

1. Verify each new Maxima message type:
   - [ ] Added to Protocol Matrix (section 9)
   - [ ] Handler exists in SW
   - [ ] Signal type registered in FE MDSCOMMS handler (if applicable)
   - [ ] Outbound sends use `maxima action:sendall` or `send poll:false`
2. Verify each schema change:
   - [ ] Applied in SW `db-init.js`
   - [ ] Applied in FE DB init (`.js`, not `.ts` — MinimaAds is Vanilla JS)
   - [ ] Uses `ADD COLUMN IF NOT EXISTS` for non-breaking migration
3. Verify each new `MDS.comms.solo` signal type is listed in section 10.
4. All user-input strings pass through `escapeSql()` before SQL interpolation.
5. All public key comparisons use `.toUpperCase()` on both sides.
6. `AGENTS.md` updated: yes/no + affected sections listed.

---

## 14) Open Bugs / Pending Fixes

| # | Component | Description | Severity |
|---|---|---|---|
| ~~1~~ | ~~`public/service-workers/main.js` (T7 stub)~~ | ~~Uses `load(...)` instead of `MDS.load(...)`. Fixed in T2 verification patch.~~ | ~~High~~ |
| ~~2~~ | ~~`core/selection.js` + `core/campaigns.js`~~ | ~~`selectAd()` filters by `c.AD_INTERESTS` but `getCampaigns()` queries only CAMPAIGNS.~~ Resolved in T9: `sdk/index.js` `_enrichWithAds()` fetches ADS and merges `AD_INTERESTS` (plus `AD_ID/TITLE/BODY/CTA_*`) onto each campaign before `selectAd` runs. | ~~Medium~~ |
| 3 | Rhino cross-file closures | A closure defined in `service.js` and passed as `cb` to a function loaded via `MDS.load()` (e.g. `initDB(cb)`) silently fails to execute when called from inside a nested `MDS.sql` callback chain in the loaded file. No error is thrown — the closure is simply never called. Workaround: never pass closures from `service.js` into `MDS.load`-ed functions. Keep all callback logic self-contained within the file where it is defined. Verified on Minima 1.0.45, Rhino. | High |
| ~~4~~ | ~~`core/validation.js` + `core/campaigns.js`~~ | ~~`validateView/Click` used single-arg callback where `getCampaign` uses err-first `cb(null, campaign)`.~~ Resolved in T9: `validateView` and `validateClick` now use `function(err, campaign)` and short-circuit to `{ valid:false, reason:'db error' }` on err. | ~~High~~ |
| ~~5~~ | ~~TASKS.md T7 description~~ | ~~`MDS_PENDING` listed incorrectly as FE-only.~~ Resolved: `MDS_PENDING` fires in the **SW**, not the FE. `onPending(msg)` is implemented in `campaign.handler.js` and handles campaign creation after user approves the escrow `send`. SW event table and fragility #18 updated. | Resolved |
| 6 | TASKS.md T7 description | Lists `onMaxima(msg)` but MinimaAds.md §11.1 shows `onMaxima(msg.data)`. T8's handler spec accesses `msg.data.data`, which matches passing the full `msg`. T7 was implemented as `onMaxima(msg)` to align with T8. MinimaAds.md §11.1 snippet is inconsistent with its own §11.3 handler flow; consider clarifying. | Low |
| 7 | TASKS.md T8 description (resolved during T8 implementation) | TASKS.md T8 listed handler names as `onCampaignAnnounce/Pause/Finish`; MinimaAds.md §11.3 uses `handleCampaignAnnounce/Pause/Finish`. Resolved: implemented per MinimaAds.md (source of truth wins), TASKS.md T8 updated to match. Convention moving forward: `on*` = MDS event entry points; `handle*` = Maxima sub-handlers dispatched inside `onMaxima`. | Resolved |
| 8 | `core/minima.js` `hexToUtf8` (resolved during T8 verification) | The canonical `hexToUtf8` did not strip the `0x`/`0X` prefix. Maxima delivers `msg.data.data` with the prefix (e.g. `"0x7B..."`), so the decoded string started with literal `0x{…}`. `JSON.parse` parsed `0` as a valid number and then threw `SyntaxError: Expected end of stream at char 1`. Fixed: `hexToUtf8` now strips an optional `0x`/`0X` prefix before hex-to-UTF8 conversion. AGENTS.md §6 canonical snippet updated to match. Confirmed via two-node Maxima send test (21-Apr-2026). | Resolved |

### Dev Workflow Rule — No schema migrations during development

During development, **never add `ALTER TABLE` migration statements** to `db-init.js`. The DB is reset with each MiniDapp reinstall. If a column type or size is wrong, fix the `CREATE TABLE` statement and reinstall — that is all that is needed. Migrations are a post-MVP concern for production upgrades.

### Closed / Fixed
| ID | Component | Description |
|---|---|---|
| — | — | *None yet* |

---

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

---

## 15) AGENTS.md Maintenance Rules

1. Update the header review line (date) whenever protocol handlers, DB schema, or core architecture are touched.
2. Any new Maxima message type → update **section 9** (Protocol Matrix) AND **MinimaAds.md §8** in the same patch.
3. Any new SW signal → update **section 10** AND **MinimaAds.md §8.6** in the same patch.
4. Any schema change → update **section 8** AND **MinimaAds.md §3.5** in the same patch.
5. Any non-obvious bug found during development → add to **section 12** (Fragility Points) and **section 14** (Bugs).
6. Any architectural decision with a non-obvious "why" → document it here, not just in the code.
7. Any change to Core API function signatures → update **section 0.7** (Stable Function Reference) AND **MinimaAds.md §7** in the same patch.
8. Any change to the Forbidden Actions list (section 0.8) or Role of Agents (section 0.9) requires explicit maintainer approval.
