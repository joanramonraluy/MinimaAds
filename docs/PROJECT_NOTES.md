# MinimaAds Project Notes

Extracted from AGENTS.md during documentation compaction on 2026-05-18. MinimaAds.md remains the highest-authority specification.

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

These implementations are required in `service.js` (SW context). Do NOT use browser APIs (`TextEncoder`, `crypto.randomUUID`) — they are unavailable in Rhino.

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
| `[CHANNEL]` | `core/channels.js` — channel lifecycle errors |
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
| `core/channels.js` | CHANNEL_STATE CRUD, channel lifecycle (`openChannel` → `settleChannel`) |

**Layer constraint**: Core must not import from MiniDapp, SDK, or Renderer. Data flows downward only.

### 7.2 Service Worker (SW)

| File | Responsibility |
|---|---|
| `service.js` | SW entry point — `APP_NAME`, `LIMITS`, `MDS.init` handler |
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
| `REWARD_EVENTS` | Audit log of all view/click/publisher_view events; used for dedup and limit checks | `ID` |
| `USER_PROFILE` | Stores local user address, interests, earned totals | `ADDRESS` |
| `DEDUP_LOG` | Deduplication log for reward events; checked by `isDuplicate()` | `ID` |
| `FRAMES` | Registered display surfaces (publisher frames); built-in frame auto-created at init | `FRAME_ID` |
| `CHANNEL_STATE` | Per-channel payment state; covers both viewer and publisher channels | `(CAMPAIGN_ID, VIEWER_KEY, ROLE)` |
| `CHANNEL_HISTORY` | Settled channel archive; one row per settlement; written by `settleChannel()` | `(CAMPAIGN_ID, VIEWER_KEY, ROLE, CREATED_AT)` |

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
| `ESCROW_COINID` | VARCHAR(66) DEFAULT '' | On-chain escrow coinid (updated each time a channel is opened from the escrow) |
| `ESCROW_WALLET_PK` | VARCHAR(66) DEFAULT '' | Per-campaign key generated via `keys action:new` — used in escrow PREVSTATE(1) — NOT the Maxima PK and NOT the main wallet key |
| `MAX_VIEWER_REWARD` | DECIMAL(20,6) DEFAULT NULL | Optional per-viewer channel cap set by creator. If > 0, overrides the `(REWARD_VIEW + REWARD_CLICK) × campaign_days` formula in `_computeMaxAmount()`. NULL → formula applies. |
| `PUBLISHER_REWARD_VIEW` | DECIMAL(20,6) NOT NULL DEFAULT 0 | Tokens paid to the displaying Frame per validated view; 0 = publisher payouts disabled |
| `MAX_PUBLISHER_BUDGET` | DECIMAL(20,6) NOT NULL DEFAULT 0 | Cap on cumulative publisher payouts; subset of BUDGET_TOTAL |
| `PUBLISHER_BUDGET_SPENT` | DECIMAL(20,6) NOT NULL DEFAULT 0 | Running total of publisher payouts; incremented when a publisher channel is opened |
| `MAX_DAILY_VIEWS` | INT DEFAULT 100 | Daily view limit per viewer |
| `MAX_DAILY_CLICKS` | INT DEFAULT 100 | Daily click limit per viewer |

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

### FRAMES
| Column | Type | Notes |
|---|---|---|
| `FRAME_ID` | VARCHAR(512) PK | UUID, or `'builtin:<maxima_pk>'` for the auto-created default frame |
| `PUBLISHER_KEY` | VARCHAR(512) NOT NULL | Maxima public key of the publisher node — captured at frame creation |
| `PUBLISHER_WALLET` | VARCHAR(512) DEFAULT '' | Wallet address for publisher reward settlement output |
| `LABEL` | VARCHAR(256) DEFAULT '' | Human-readable name |
| `IS_BUILTIN` | BOOLEAN NOT NULL DEFAULT FALSE | True for the auto-created built-in frame |
| `CREATED_AT` | BIGINT NOT NULL | unix ms |
| `TOTAL_EARNED` | DECIMAL(20,6) DEFAULT 0 | Cumulative publisher earnings for this frame |

### CHANNEL_STATE
| Column | Type | Notes |
|---|---|---|
| `CAMPAIGN_ID` | VARCHAR(256) NOT NULL | FK → CAMPAIGNS.ID |
| `VIEWER_KEY` | VARCHAR(66) NOT NULL | Per-channel wallet key (`keys action:new`); holds viewer or publisher key depending on ROLE |
| `ROLE` | VARCHAR(16) NOT NULL DEFAULT 'viewer' | `'viewer'` or `'publisher'` — distinguishes channel type. **Always filter by ROLE in WHERE clauses** |
| `FRAME_ID` | VARCHAR(512) DEFAULT '' | Non-empty when ROLE='publisher'; references FRAMES.FRAME_ID |
| `CREATOR_MX` | VARCHAR(512) NOT NULL | Creator Mx contact string from escrow STATE(4) |
| `CHANNEL_COINID` | VARCHAR(66) DEFAULT '' | Set after creator opens channel on-chain |
| `MAX_AMOUNT` | DECIMAL(20,6) NOT NULL | viewer: `(REWARD_VIEW + REWARD_CLICK) × campaign_days`; publisher: cap from MAX_PUBLISHER_BUDGET |
| `CUMULATIVE_EARNED` | DECIMAL(20,6) DEFAULT 0 | Total committed by creator (creator node) / total earned (viewer/publisher node) |
| `LATEST_TX_HEX` | TEXT DEFAULT '' | Last partially-signed tx (viewer/publisher holds for settlement) |
| `STATUS` | VARCHAR(16) DEFAULT 'pending' | `pending\|open\|settled\|expired` |
| `CREATED_AT` | BIGINT NOT NULL | unix ms |
| `VIEWER_WALLET_ADDR` | VARCHAR(512) DEFAULT '' | Settlement output address — viewer wallet for ROLE='viewer', publisher wallet for ROLE='publisher' |

PRIMARY KEY: `(CAMPAIGN_ID, VIEWER_KEY, ROLE)` — one channel per (viewer/publisher key, campaign, role) triple.

> Creator node writes: `CHANNEL_COINID`, `CUMULATIVE_EARNED`, `LATEST_TX_HEX` (what it has signed).
> Viewer/publisher node writes: all fields; `LATEST_TX_HEX` is the voucher received from creator.
> **Critical**: queries that previously used `WHERE CAMPAIGN_ID=X AND VIEWER_KEY=Y` must now also include `AND UPPER(ROLE)='VIEWER'` or `AND UPPER(ROLE)='PUBLISHER'` to avoid matching both rows when the same key holds both viewer and publisher channels for the same campaign (rare but possible). See fragility #33.

### CHANNEL_HISTORY
| Column | Type | Notes |
|---|---|---|
| `CAMPAIGN_ID` | VARCHAR(256) NOT NULL | FK → CAMPAIGNS.ID |
| `VIEWER_KEY` | VARCHAR(512) NOT NULL | Same key as CHANNEL_STATE.VIEWER_KEY |
| `ROLE` | VARCHAR(16) NOT NULL DEFAULT 'viewer' | `'viewer'` or `'publisher'` |
| `CREATOR_MX` | VARCHAR(512) NOT NULL DEFAULT '' | |
| `CHANNEL_COINID` | VARCHAR(66) DEFAULT '' | |
| `MAX_AMOUNT` | DECIMAL(20,6) NOT NULL | |
| `CUMULATIVE_EARNED` | DECIMAL(20,6) NOT NULL DEFAULT 0 | Amount settled |
| `STATUS` | VARCHAR(16) NOT NULL DEFAULT 'settled' | Always `'settled'` |
| `CREATED_AT` | BIGINT NOT NULL | Channel OPEN timestamp (from CHANNEL_STATE.CREATED_AT) |
| `VIEWER_WALLET_ADDR` | VARCHAR(512) DEFAULT '' | |

PRIMARY KEY: `(CAMPAIGN_ID, VIEWER_KEY, ROLE, CREATED_AT)` — distinct channel lifecycles have different CREATED_AT.

> **Lifecycle**: written by `settleChannel()` (core/channels.js) immediately when a channel is settled on-chain. MERGE is idempotent — double-settle on the same channel (same CREATED_AT) overwrites with identical data.
> **Display**: `_refreshSettlementHistory()` (earnings.js) reads exclusively from this table; CHANNEL_STATE is not queried for settlement history.

**Schema parity rule**: Any new table or column must be added in **both** SW `db-init.js` and FE DB init in the same patch. Use `ADD COLUMN IF NOT EXISTS` for non-breaking migrations.

---

## 9) Protocol / Message Types

> Authoritative schemas: MinimaAds.md §8. This section mirrors them for agent reference.
> Update BOTH this section AND MinimaAds.md §8 for every new message type.

| Maxima Type | Direction | Handler | DB Impact | FE Signal |
|---|---|---|---|---|
| `CAMPAIGN_ANNOUNCE` | Creator SW → all contacts | `campaign.handler.js` | `MERGE INTO CAMPAIGNS` + `MERGE INTO ADS` | `NEW_CAMPAIGN` | Optional fields `max_viewer_reward`, `publisher_reward_view`, `max_publisher_budget`, `platform_key`. Receiver MUST validate `platform_key` matches local `PLATFORM_KEY` constant AND escrow coin PREVSTATE(5); mismatch → silent drop. When local `PLATFORM_KEY` is null: skip validation (MVP). |
| `CAMPAIGN_PAUSE` | Creator SW → all contacts | `campaign.handler.js` | `UPDATE CAMPAIGNS SET STATUS='paused'` | `CAMPAIGN_UPDATED` |
| `CAMPAIGN_FINISH` | Creator SW → all contacts | `campaign.handler.js` | `UPDATE CAMPAIGNS SET STATUS='finished'` | `CAMPAIGN_UPDATED` |
| `REQUEST_CAMPAIGN_DATA` | Viewer SW → Creator SW (unicast `to:Mx...`) | `campaign.handler.js` | None (read-only lookup) | None |
| `CAMPAIGN_DATA_RESPONSE` | Creator SW → Viewer SW (unicast `to:Mx...`) | `campaign.handler.js` | `MERGE INTO CAMPAIGNS` + `MERGE INTO ADS` | `NEW_CAMPAIGN` |
| `CHANNEL_OPEN_REQUEST` | Viewer/Publisher FE → Creator FE (unicast, `poll:true`) | `channel.handler.js` | `MERGE INTO CHANNEL_STATE` (creator, incl. `VIEWER_WALLET_ADDR`) | — (triggers coin creation in FE) | + Optional fields `role` (`viewer`\|`publisher`, default `viewer`) and `frame_id` (required when `role='publisher'`). Routes to viewer or publisher channel-open flow. |
| `CHANNEL_OPEN` | Creator FE → Viewer/Publisher FE (unicast, `poll:true`) | `channel.handler.js` | `UPDATE CHANNEL_STATE status='open', ROLE=role` | `CHANNEL_OPENED` | + `role`, `frame_id` echoed back. |
| `REWARD_REQUEST` | Viewer/Publisher FE → Creator FE (unicast, `poll:true`) | `channel.handler.js` | `UPDATE CHANNEL_STATE` (cumulative, tx_hex) | — (sends REWARD_VOUCHER) | + `role`, `frame_id`. Creator queries `CHANNEL_STATE WHERE ROLE=role` to validate cumulative. |
| `REWARD_VOUCHER` | Creator FE → Viewer/Publisher FE (unicast, `poll:true`) | `channel.handler.js` | `UPDATE CHANNEL_STATE` (tx_hex, cumulative) | `VOUCHER_RECEIVED` | + `role`, `frame_id` echoed. Viewer side: standard VOUCHER_RECEIVED. Publisher side: SDK writes `publisher_view` REWARD_EVENT + signals PUBLISHER_REWARD_CONFIRMED. |
| `VOUCHER_SYNC_REQUEST` | Viewer FE → Creator FE (unicast, `poll:true`) | `channel.handler.js` | None (read-only) | — (sends REWARD_VOUCHER or CHANNEL_OPEN) | `role` included to disambiguate which channel to sync. |

> **Reward accounting is FE-owned** — `core/rewards.js` writes REWARD_EVENTS, CAMPAIGNS, USER_PROFILE. See MinimaAds.md §8.4.
> **Channel coin creation and settlement tx signing are FE-owned** — require pending approval flow; cannot run in SW.

**Application name**: `application:minima-ads` — defined as `APP_NAME` constant in `main.js`. Never hardcode the literal string in `MDS.cmd` calls.

**Rule**: Every new message type added to the SW must also be added to this table. If a type is handled somewhere and not listed here, future agents will implement duplicate handlers.

---

## 10) FE ↔ SW Signal Contract

> Authoritative signal contract: MinimaAds.md §8.13. This section mirrors it for agent reference.
> Update BOTH this section AND MinimaAds.md §8.13 whenever a new signal is added.

| Signal Type | Payload | Fired By | FE Reaction |
|---|---|---|---|
| `DB_READY` | `{}` | `db-init.js` (SW) | Unlock FE routing — only render DB-backed views once seen |
| `REWARD_CONFIRMED` | `{ event_id, amount, reward_type }` | `core/rewards.js` (FE) | Update reward display, balance indicator |
| `CAMPAIGN_UPDATED` | `{ campaign_id, status, budget_remaining }` | `campaign.handler.js` (SW) | Refresh campaign card status |
| `NEW_CAMPAIGN` | `{ campaign_id }` | `campaign.handler.js` (SW) | Reload available campaigns list |
| `CAMPAIGN_PENDING_DENIED` | `{ uid }` | `campaign.handler.js` (SW) | Show "Transaction denied" in creator form |
| `CHANNEL_OPENED` | `{ campaign_id, channel_coinid, max_amount }` | `channel.handler.js` (SW) | Clear "Opening channel…" message; flush pending rewards |
| `VOUCHER_RECEIVED` | `{ campaign_id, cumulative }` | `channel.handler.js` (SW) | Update viewer earned balance display |
| `AUTO_SETTLE` | `{ campaign_id, viewer_key, tx_hex }` | `channel.handler.js` (SW) | Prompt viewer to settle or auto-settle (txnimport → txnsign → txnpost) |
| `SETTLE_CONFIRMED` | `{ campaign_id, amount }` | `channel.handler.js` (FE) | Show settlement confirmation; update channel status |
| `DO_CHANNEL_OPEN` | `{ campaign_id, viewer_key, viewer_mx, max_amount }` | `channel.handler.js` (SW) | Creator FE creates channel coin (txncreate/txninput/txnoutput/txnpost) |
| `DO_REWARD_VOUCHER` | `{ campaign_id, viewer_key, viewer_mx, event_id, cumulative }` | `channel.handler.js` (SW) | Creator FE builds partial tx and sends REWARD_VOUCHER to viewer |
| `DO_SEND_VOUCHER` | `{ campaign_id, viewer_key, viewer_mx, cumulative, tx_hex }` | `channel.handler.js` (SW) | Creator FE re-sends REWARD_VOUCHER with stored tx_hex (reconnect sync) |
| `DO_RESEND_CHANNEL_OPEN` | `{ campaign_id, viewer_key, viewer_mx, channel_coinid, max_amount }` | `channel.handler.js` (SW) | Creator FE re-sends CHANNEL_OPEN when viewer syncs but no voucher exists yet |
| `FRAME_READY` | `{ frame_id, is_builtin }` | `service.js` (SW) | Built-in frame ensured at init; SDK can resolve default frameId |
| `FRAME_CREATED` | `{ frame_id, label }` | `dapp/views/frames.js` (FE) | New frame persisted; refresh frame list |
| `PUBLISHER_REWARD_CONFIRMED` | `{ event_id, amount, frame_id, campaign_id }` | `core/rewards.js` (FE) | Publisher reward persisted; update Frame earnings display |
| `DO_PUBLISHER_CHANNEL_OPEN` | `{ campaign_id, publisher_key, publisher_mx, frame_id, max_amount }` | `channel.handler.js` (SW) | Creator FE creates publisher channel coin (same tx structure as viewer channel) |
| `DO_PUBLISHER_REWARD_VOUCHER` | `{ campaign_id, publisher_key, publisher_mx, frame_id, event_id, cumulative }` | `channel.handler.js` (SW) | Creator FE builds publisher partial tx and sends REWARD_VOUCHER with role='publisher' |

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

