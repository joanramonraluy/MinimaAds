# MinimaAds Platform Notes

Extracted from AGENTS.md during documentation compaction on 2026-05-18. MinimaAds.md remains the highest-authority specification.

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
- Entry point: **`service.js` (project root)** — Minima hardcodes this path (`MDSManager.java:909`, `ServiceJSRunner.java:71`): `new File(getMiniDAPPWebFolder(uid), "service.js")`. The `"service"` field in `dapp.conf` is NOT used to locate the SW. `service.js` is the canonical source but must be manually mirrored to `service.js` — editing only the source file has no runtime effect.
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

