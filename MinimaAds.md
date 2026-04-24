# MinimaAds — Technical Specification

> **Status**: MVP — Implementation-ready
> **Platform**: Minima MiniDapp (MDS)
> **Frontend**: Vanilla JavaScript (ES Modules) — no frameworks
> **Last updated**: 2026-04-19

---

## Index
- [1) Architecture](#1)
- [2) Actors & Roles](#2)
- [3) Data Model](#3)
- [4) Economic Model](#4)
- [5) Anti-abuse System](#5)
- [6) System Flows](#6)
- [7) Core API](#7)
- [8) Maxima Protocol](#8)
- [9) Trust Model](#9)
- [10) Attack Vectors & Mitigations](#10)
- [11) Service Worker](#11)
- [12) Code Organization](#12)
- [13) SDK Integration](#13)
- [15) UI Design](#15)

---

## 1) Architecture

### 1.1 Technology Stack

| Layer | Technology | Decision |
|---|---|---|
| Runtime | Minima MiniDapp (MDS) | Fixed |
| Frontend | Vanilla JavaScript (ES Modules) | **Final. No frameworks in MVP.** |
| Styling | HTML5, CSS3 | Fixed |
| Storage | H2 via `MDS.sql` | Fixed |
| Messaging | Maxima P2P via `MDS.cmd` | Fixed |
| Smart contracts | KissVM | Budget escrow only |
| Bundler | None | No build step in MVP |

### 1.2 Layer Architecture

Four mandatory layers with strict unidirectional dependency flow:

```
┌─────────────────────────────────────────┐
│         MiniDapp  (dapp/app.js)         │  UI, routing, user interaction
├─────────────────────────────────────────┤
│          SDK  (sdk/index.js)            │  Public API for dApp integration
├─────────────────────────────────────────┤
│       Core  (core/*.js)                 │  Business logic — NO UI allowed
├────────────────────┬────────────────────┤
│  Renderer          │  Minima bridge     │  DOM rendering / MDS wrappers
│  (renderer/*.js)   │  (core/minima.js)  │
└────────────────────┴────────────────────┘
```

**Rule**: Core must not import from MiniDapp, SDK, or Renderer. Data flows downward only.

### 1.3 System Overview

MinimaAds is a decentralized advertising infrastructure on the Minima blockchain. It enables:

- Advertisers (creators) to publish campaigns with a locked token budget
- Users (viewers) to earn token rewards for viewing and clicking ads
- Developers (publishers) to integrate ad display into their dApps via SDK
- Campaigns to propagate peer-to-peer via Maxima without a central server

No central server. No external tracking. Budget is verifiable on-chain.

---

## 2) Actors & Roles

### 2.1 Actor Definitions

| Actor | Description | Core action |
|---|---|---|
| **Viewer** | Consumes ads, earns rewards | View ads, click CTAs, receive tokens |
| **Creator** | Creates ad campaigns | Define budget, publish campaigns, monitor stats |
| **Publisher** | Integrates MinimaAds in a dApp | Display ads, forward events to the system |
| **Platform** | MinimaAds itself | Acts as Viewer + Creator + Publisher simultaneously |

### 2.2 Multi-role Nodes

A single Minima node can hold multiple roles simultaneously. This is an explicit design decision.

| Node type | Viewer | Creator | Publisher |
|---|---|---|---|
| Standard user | ✅ | ❌ | ❌ |
| Advertiser | ✅ | ✅ | ❌ |
| dApp developer | ✅ | optional | ✅ |
| MinimaAds node | ✅ | ✅ | ✅ |

**Critical rule**: A creator cannot earn rewards from their own campaigns.
Implementation: `selection.js` must filter out campaigns where `CREATOR_ADDRESS === current_user_address` before returning candidates.

---

## 3) Data Model

### 3.1 Campaign

```json
{
  "id":               "string (UUID)",
  "creator_address":  "string (Maxima public key — 0x...)",
  "title":            "string",
  "budget_total":     "number (tokens)",
  "budget_remaining": "number (tokens)",
  "reward_view":      "number (tokens per view)",
  "reward_click":     "number (tokens per click)",
  "status":           "enum: draft | active | paused | finished",
  "created_at":       "number (unix ms)",
  "expires_at":       "number (unix ms) | null"
}
```

### 3.2 Ad

```json
{
  "id":          "string (UUID)",
  "campaign_id": "string",
  "title":       "string",
  "body":        "string",
  "cta_label":   "string",
  "cta_url":     "string",
  "interests":   "string (comma-separated tags, optional)"
}
```

### 3.3 RewardEvent

```json
{
  "id":           "string (UUID — unique per action, used for dedup)",
  "campaign_id":  "string",
  "ad_id":        "string",
  "user_address": "string",
  "type":         "enum: view | click",
  "amount":       "number (tokens transferred)",
  "timestamp":    "number (unix ms)",
  "publisher_id": "string"
}
```

### 3.4 UserProfile

```json
{
  "address":        "string (Maxima public key — 0x...)",
  "interests":      "string (comma-separated, optional)",
  "total_earned":   "number (tokens)",
  "last_reward_at": "number (unix ms) | null"
}
```

### 3.5 H2 Database Schema

> All table and column names in UPPERCASE (H2 requirement — AGENTS.md §3.1).
> Both SW and FE runtimes must initialize all tables independently.

```sql
CREATE TABLE IF NOT EXISTS CAMPAIGNS (
  ID               VARCHAR(256)  PRIMARY KEY,
  CREATOR_ADDRESS  VARCHAR(512)  NOT NULL,   -- Maxima public key RSA DER hex ~326 chars (NOT wallet signing key)
  TITLE            VARCHAR(512)  NOT NULL,
  BUDGET_TOTAL     DECIMAL(20,6) NOT NULL,
  BUDGET_REMAINING DECIMAL(20,6) NOT NULL,
  REWARD_VIEW      DECIMAL(20,6) NOT NULL,
  REWARD_CLICK     DECIMAL(20,6) NOT NULL,
  STATUS           VARCHAR(32)   NOT NULL DEFAULT 'active',
  CREATED_AT       BIGINT        NOT NULL,
  EXPIRES_AT       BIGINT        DEFAULT NULL,
  ESCROW_COINID    VARCHAR(66)   DEFAULT '',  -- on-chain escrow coin; updated after each batch payout
  ESCROW_WALLET_PK VARCHAR(66)   DEFAULT ''   -- wallet signing key in escrow PREVSTATE(1)
);

CREATE TABLE IF NOT EXISTS ADS (
  ID          VARCHAR(256)  PRIMARY KEY,
  CAMPAIGN_ID VARCHAR(256)  NOT NULL,
  TITLE       VARCHAR(512)  NOT NULL,
  BODY        VARCHAR(2048),
  CTA_LABEL   VARCHAR(128),
  CTA_URL     VARCHAR(1024),
  INTERESTS   VARCHAR(1024) DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS REWARD_EVENTS (
  ID           VARCHAR(256)  PRIMARY KEY,
  CAMPAIGN_ID  VARCHAR(256)  NOT NULL,
  AD_ID        VARCHAR(256)  NOT NULL,
  USER_ADDRESS VARCHAR(512)  NOT NULL,
  TYPE         VARCHAR(16)   NOT NULL,
  AMOUNT       DECIMAL(20,6) NOT NULL,
  TIMESTAMP    BIGINT        NOT NULL,
  PUBLISHER_ID VARCHAR(256)  DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS USER_PROFILE (
  ADDRESS        VARCHAR(512)  PRIMARY KEY,  -- Maxima public key RSA DER hex ~326 chars
  INTERESTS      VARCHAR(1024) DEFAULT NULL,
  TOTAL_EARNED   DECIMAL(20,6) NOT NULL DEFAULT 0,
  LAST_REWARD_AT BIGINT        DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS DEDUP_LOG (
  ID        VARCHAR(256) PRIMARY KEY,  -- RewardEvent UUID; used by isDuplicate()
  LOGGED_AT BIGINT       NOT NULL      -- unix ms; reserved for future pruning
);

CREATE TABLE IF NOT EXISTS CHANNEL_STATE (
  CAMPAIGN_ID       VARCHAR(256)   NOT NULL,
  VIEWER_KEY        VARCHAR(66)    NOT NULL,   -- per-channel wallet key (keys action:new on viewer)
  CREATOR_MX        VARCHAR(512)   NOT NULL,   -- creator Mx contact string (from escrow STATE(4))
  CHANNEL_COINID    VARCHAR(66)    DEFAULT '',  -- set after creator opens channel on-chain
  MAX_AMOUNT        DECIMAL(20,6)  NOT NULL,   -- (REWARD_VIEW + REWARD_CLICK) × campaign_days
  CUMULATIVE_EARNED DECIMAL(20,6)  NOT NULL DEFAULT 0,
  LATEST_TX_HEX     TEXT           DEFAULT '',  -- last partially-signed tx received from creator
  STATUS            VARCHAR(16)    NOT NULL DEFAULT 'pending', -- pending|open|settled|expired
  CREATED_AT        BIGINT         NOT NULL,
  PRIMARY KEY (CAMPAIGN_ID, VIEWER_KEY)
);
```

> `CHANNEL_STATE` exists on both creator and viewer nodes with different semantics:
> - **Creator node**: `LATEST_TX_HEX` = last tx it signed and sent; `CUMULATIVE_EARNED` = total it has committed
> - **Viewer node**: `LATEST_TX_HEX` = last tx received from creator (ready to post); `CUMULATIVE_EARNED` = total earned

**Note on `CAMPAIGNS.ESCROW_WALLET_PK`**: this field stores a **per-campaign generated key** (`keys action:new`), not the node's main wallet key. This provides on-chain isolation between campaigns — a spend on one campaign's escrow does not expose the creator's main wallet key.

**H2 SQL rules** (mandatory — see AGENTS.md §3):
- Upserts via `MERGE INTO ... KEY(id)` — never `ON CONFLICT`
- String comparisons via `UPPER()` — never raw equality on IDs or addresses
- BOOLEAN columns return strings `"true"`/`"false"` — check all four variants

---

## 4) Economic Model

### 4.1 Variables

| Symbol | Description |
|---|---|
| `B` | Campaign budget total (tokens) |
| `F = 0.06` | Platform fee: 6% of B |
| `P` | Partner share: 0–2% of B (within F) |
| `R_v` | Reward per view (recommended MVP default: `0.01`) |
| `R_c` | Reward per click (recommended MVP default: `0.10`) |

### 4.2 Cost & Fee Structure

- Creator pays: `B + (F × B)` = `B × 1.06`
- Fee split (if partner): `partner_cut = P × B`, `platform_net = (F × B) − partner_cut`
- Fee split (no partner): `platform_net = F × B`

### 4.3 Budget Rules

- Budget never goes negative — guaranteed by pre-execution check and KissVM
- A reward executes only if `budget_remaining >= reward_amount`
- Campaign auto-transitions to `finished` when `budget_remaining <= 0`
- If budget is insufficient: event rejected silently, no state change

### 4.4 Unidirectional Payment Channels

Per-event on-chain transactions would saturate the Minima network and are economically unviable for micropayments (0.01 MINIMA per view).

**Decision**: reward payments use **unidirectional payment channels** (Layer 2). For each viewer-campaign pair, the creator opens a dedicated channel coin on-chain. All intermediate reward updates travel off-chain via Maxima. Only two on-chain transactions occur per viewer: channel opening and final settlement.

#### Channel amount per viewer

```
campaign_days   = ceil(CAMPAIGN_DURATION_BLOCKS / 1728)
max_per_viewer  = (REWARD_VIEW + REWARD_CLICK) × campaign_days
```

This is deterministic — no estimation of viewer count required. The creator reserves exactly this amount per channel. Unspent amounts return to the creator via timelock.

#### Channel coin funding

Each channel coin is funded by **spending the global campaign escrow coin** (Appendix B). The spending tx produces:
- **output[0]**: new channel coin at `CHANNEL_SCRIPT_ADDRESS` with `max_per_viewer` MINIMA
- **output[1]**: change back to `ESCROW_ADDRESS` with remaining budget (keepstate:true)

The global escrow script permits this because `STATE(10)` = `max_per_viewer` and `VERIFYOUT` only constrains the change output — the payout output is unrestricted.

`CAMPAIGNS.BUDGET_REMAINING` is decremented by `max_per_viewer` on the creator's node when a channel is opened, giving the creator accurate local budget tracking.

---

## 5) Anti-abuse System

All limits are defined as a single constant object at the top of `service-workers/main.js`. Never hardcode these values inline.

```javascript
var LIMITS = {
  MAX_VIEWS_PER_CAMPAIGN_PER_DAY:  1,
  MAX_CLICKS_PER_CAMPAIGN_PER_DAY: 1,
  COOLDOWN_BETWEEN_REWARDS_MS:     30000,  // 30 seconds
  MIN_VIEW_DURATION_MS:            3000,   // 3 seconds
  MAX_CAMPAIGNS_PER_SESSION:       10
};
```

### 5.1 Limit Definitions

| Constant | Value | Enforcement point |
|---|---|---|
| `MAX_VIEWS_PER_CAMPAIGN_PER_DAY` | 1 | `validation.js` → query `REWARD_EVENTS` (last 24h, same user+campaign+type=view) |
| `MAX_CLICKS_PER_CAMPAIGN_PER_DAY` | 1 | `validation.js` → same query for `type='click'` |
| `COOLDOWN_BETWEEN_REWARDS_MS` | 30 s | `validation.js` → check `USER_PROFILE.LAST_REWARD_AT` |
| `MIN_VIEW_DURATION_MS` | 3 s | SDK client-side timer — must complete before view event is emitted |
| `MAX_CAMPAIGNS_PER_SESSION` | 10 | `selection.js` — session counter, never persisted to DB |

---

## 6) System Flows

### 6.1 View Flow

```
1.  SDK loads active campaigns from local DB via getCampaigns()
2.  SDK calls selectAd(userAddress, userInterests) → returns one Campaign
3.  Renderer displays the ad in the DOM
4.  SDK starts a timer: MIN_VIEW_DURATION_MS (3 s)
    ├─ User scrolls away before 3 s → NO event. Stop.
    └─ After 3 s → continue
5.  SDK calls validateView(campaignId, userAddress)
    Checks:
    a. campaign.STATUS === 'active'
    b. campaign.BUDGET_REMAINING >= campaign.REWARD_VIEW
    c. views today for (user, campaign) < MAX_VIEWS_PER_CAMPAIGN_PER_DAY
    d. now − USER_PROFILE.LAST_REWARD_AT >= COOLDOWN_BETWEEN_REWARDS_MS
    e. campaign.CREATOR_ADDRESS !== userAddress  (no self-reward)
    ├─ Any check fails → reject, no event. Stop.
    └─ All pass → continue
6.  SDK calls createRewardEvent({ type:'view', campaignId, adId, ... })
    — isDuplicate(eventId) check → if duplicate: stop.
    — Persists RewardEvent to REWARD_EVENTS via sqlQuery()
    — Calls updateBudget(campaignId, reward_view)
    — Updates USER_PROFILE: TOTAL_EARNED += amount, LAST_REWARD_AT = now
    → callback(RewardEvent) on success
7.  SDK fires signalFE('REWARD_CONFIRMED', { event_id, amount, type })
    → FE viewer UI updates balance and confirmation display
```

### 6.2 Click Flow

```
1.  User clicks CTA on an ad that has already completed a valid view
2.  SDK calls validateClick(campaignId, userAddress)
    Checks:
    a. campaign.STATUS === 'active'
    b. campaign.BUDGET_REMAINING >= campaign.REWARD_CLICK
    c. clicks today for (user, campaign) < MAX_CLICKS_PER_CAMPAIGN_PER_DAY
    d. now − USER_PROFILE.LAST_REWARD_AT >= COOLDOWN_BETWEEN_REWARDS_MS
    e. campaign.CREATOR_ADDRESS !== userAddress
    ├─ Any check fails → navigate anyway, no reward. Stop.
    └─ All pass → continue
3.  SDK calls createRewardEvent({ type:'click', campaignId, adId, ... })
    — isDuplicate check, persists RewardEvent, updates budget and USER_PROFILE
    → callback(RewardEvent) — SDK fires signalFE('REWARD_CONFIRMED', ...)
4.  Browser navigates to ad.CTA_URL
```

### 6.3 Campaign Creation Flow

```
1.  Creator fills form: title, budget_total, reward_view, reward_click
2.  System computes fee: fee = budget_total × 0.06
3.  Creator reviews and approves total: budget_total + fee
4.  Budget locked in KissVM escrow (see Appendix B):
    a. Generate a per-campaign wallet key:  keys action:new  → publickey
       → save as CAMPAIGNS.ESCROW_WALLET_PK  (isolates this campaign on-chain)
    b. Register escrow script (once per install):
       newscript script:"LET creatorkey=PREVSTATE(1) ASSERT SIGNEDBY(creatorkey) LET payout=STATE(10) LET change=@AMOUNT-payout IF change GT 0 THEN ASSERT VERIFYOUT(INC(@INPUT) @ADDRESS change @TOKENID TRUE) ENDIF RETURN TRUE" trackall:true
       → save returned address as ESCROW_ADDRESS constant
    c. Send budget to escrow:
       send amount:<budget_total> address:<ESCROW_ADDRESS>
            state:{"1":"<wallet_pubkey>","2":"<expiry_block>","3":"<campaign_id_hex>","4":"<creator_mx_address>"}
       Note: STATE(4) = creator Mx address (Mx...) — enables on-chain campaign discovery by all viewer nodes
    d. Save returned coinid in CAMPAIGNS.ESCROW_COINID (new DB column)
    Note: fee collection is off-chain only for MVP (no platform wallet address defined)
5.  Campaign created locally: status = 'active', budget_remaining = budget_total
6.  Ad object created and linked to campaign
7.  SW broadcasts CAMPAIGN_ANNOUNCE via Maxima to all contacts (poll:false)
8.  SW schedules periodic re-broadcast every ~10 min via MDS_TIMER_10SECONDS
```

### 6.5 Channel Open Flow

Triggered the first time a viewer wants to earn rewards from a campaign. The viewer's SDK checks for an existing `CHANNEL_STATE` record for `(campaign_id, viewer_key)`. If none exists, this flow runs before the first reward.

```
1.  SDK calls MDS.cmd('keys action:new') → generates per-channel viewer key (viewerKey)
2.  SDK writes CHANNEL_STATE locally:
      status = 'pending', viewer_key = viewerKey, campaign_id, creator_mx (from campaign)
      max_amount = (REWARD_VIEW + REWARD_CLICK) × campaign_days
3.  SDK stores pending rewards in keypair (rewards earned while channel is opening)
4.  FE shows status message: "Opening reward channel (first interaction)…"
5.  SDK sends CHANNEL_OPEN_REQUEST to creator via Maxima (poll:true):
      { type, campaign_id, viewer_key: viewerKey, viewer_mx: MY_MX_ADDRESS, max_amount }

--- Creator node ---
6.  SW receives CHANNEL_OPEN_REQUEST → handler runs in FE context (not SW) to allow pending approval:
    a. Verify campaign exists locally and is active
    b. Verify max_amount <= CAMPAIGNS.BUDGET_REMAINING
    c. Spend global escrow coin → create channel coin + change back to escrow
       (requires creator pending approval if MDS write-mode pending is enabled)
    d. On coin confirmed: write CHANNEL_STATE locally
         status = 'open', channel_coinid = new coinId, viewer_key, cumulative_earned = 0
    e. Decrement CAMPAIGNS.BUDGET_REMAINING by max_amount locally
    f. Send CHANNEL_OPEN to viewer via Maxima (poll:true):
         { type, campaign_id, viewer_key, channel_coinid, max_amount }

--- Viewer node ---
7.  FE receives CHANNEL_OPEN signal → update CHANNEL_STATE: status = 'open', channel_coinid
8.  signalFE('CHANNEL_OPENED', { campaign_id, channel_coinid, max_amount })
9.  SDK flushes pending rewards: sends accumulated REWARD_REQUESTs to creator
```

**Failure handling**: if creator does not respond within a configurable timeout (default: 5 min), viewer stores pending rewards in keypair and retries on next app open.

### 6.6 Channel Reward Flow

Runs after every successful `createRewardEvent` call for a campaign with an open channel.

```
1.  createRewardEvent() succeeds → H2 updated locally (as before)
2.  SDK reads CHANNEL_STATE for (campaign_id, viewer_key)
    ├─ status = 'pending' → store REWARD_REQUEST in keypair; show "Channel opening…"
    └─ status = 'open'   → continue
3.  SDK sends REWARD_REQUEST to creator via Maxima (poll:true):
      { type, campaign_id, viewer_key, event_id, cumulative: CUMULATIVE_EARNED + amount }
    SDK writes pending marker to keypair: PENDING_REWARD_<campaign_id>_<event_id> = '1'

--- Creator node ---
4.  SW receives REWARD_REQUEST → validates:
    a. CHANNEL_STATE exists for (campaign_id, viewer_key) and status = 'open'
    b. cumulative <= MAX_AMOUNT  (no over-claim)
    c. Idempotency: check if event_id already processed (DEDUP_LOG)
5.  Creator constructs partial tx (off-chain):
      txncreate → txninput(channel_coinid) → txnoutput(viewer_address, cumulative)
      → txnoutput(creator_change_address, MAX_AMOUNT - cumulative)
      → txnsign(ESCROW_WALLET_PK) → txnexport → hexTx
    Updates CHANNEL_STATE: cumulative_earned = cumulative, latest_tx_hex = hexTx
    Adds event_id to DEDUP_LOG
6.  Sends REWARD_VOUCHER to viewer via Maxima (poll:true):
      { type, campaign_id, viewer_key, event_id, cumulative, tx_hex: hexTx }

--- Viewer node ---
7.  FE receives REWARD_VOUCHER:
    a. Verify event_id matches a pending reward
    b. Update CHANNEL_STATE: cumulative_earned = cumulative, latest_tx_hex = hexTx
    c. Remove pending marker from keypair: PENDING_REWARD_<campaign_id>_<event_id>
    d. signalFE('VOUCHER_RECEIVED', { campaign_id, cumulative })
```

### 6.7 Channel Settlement Flow

Settlement turns the off-chain accumulated `LATEST_TX_HEX` into an on-chain transaction. Runs automatically when a campaign finishes and optionally on manual user request.

```
Automatic trigger:
  SW detects campaign STATUS = 'finished' (via CAMPAIGN_FINISH Maxima or NEWBLOCK expiry check)
  → for each CHANNEL_STATE WHERE campaign_id = X AND status = 'open' AND latest_tx_hex != ''
  → signalFE('AUTO_SETTLE', { campaign_id, viewer_key, tx_hex })

Manual trigger:
  Viewer clicks "Settle rewards" button in UI
  → reads CHANNEL_STATE.LATEST_TX_HEX for selected campaign

Settlement steps (FE):
1.  FE calls MDS.cmd('txnimport data:' + tx_hex) → imports partial tx
2.  FE calls MDS.cmd('txnsign txnid:X key:' + viewer_key) → viewer co-signs
3.  FE calls MDS.cmd('txnpost txnid:X') → broadcasts to Minima network
4.  On success: UPDATE CHANNEL_STATE SET STATUS = 'settled'
5.  signalFE('SETTLE_CONFIRMED', { campaign_id, amount: cumulative_earned })
```

**Creator reclaim**: after `40 × 1728` blocks from channel coin creation, the creator can reclaim any unsettled channel coin unilaterally via `SIGNEDBY(creatorkey)` branch (see Appendix C).

### 6.8 Reconnection & Sync Flow

Handles the case where either party was offline when messages were sent.

```
Viewer reconnects (app opens):
1.  SDK reads all keypair entries matching PENDING_REWARD_<campaign_id>_<event_id>
2.  For each: check CHANNEL_STATE.STATUS
    ├─ 'pending' → channel not yet open; keep in keypair, wait for CHANNEL_OPEN
    └─ 'open'   → resend REWARD_REQUEST (idempotent — creator deduplicates by event_id)
3.  If CHANNEL_STATE.STATUS = 'open' but LATEST_TX_HEX is stale or missing:
    → send VOUCHER_SYNC_REQUEST to creator:
      { type, campaign_id, viewer_key }

Creator receives VOUCHER_SYNC_REQUEST:
4.  Read CHANNEL_STATE for (campaign_id, viewer_key)
5.  If latest_tx_hex exists → resend REWARD_VOUCHER with stored tx_hex
    If no tx yet → respond with CHANNEL_OPEN (re-confirm channel is open)
```

### 6.4 Ad Selection Algorithm

```javascript
// core/selection.js
function selectAd(userAddress, userInterests, campaigns) {
  var eligible = campaigns.filter(function(c) {
    return c.STATUS === 'active'
      && parseFloat(c.BUDGET_REMAINING) >= parseFloat(c.REWARD_VIEW)
      && c.CREATOR_ADDRESS.toUpperCase() !== userAddress.toUpperCase();
  });

  var matched = eligible.filter(function(c) {
    if (!c.AD_INTERESTS || !userInterests) return false;
    var tags = c.AD_INTERESTS.split(',').map(function(t) { return t.trim(); });
    return userInterests.split(',').some(function(u) {
      return tags.indexOf(u.trim()) !== -1;
    });
  });

  var pool = matched.length > 0 ? matched : eligible;
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}
```

---

## 7) Core API

All functions are callback-based (no Promises) for compatibility with the Rhino SW runtime.
FE code can wrap them in Promises using standard patterns if needed.

### 7.1 campaigns.js

```javascript
getCampaigns(callback)
// Returns: callback(Campaign[])

getCampaign(id, callback)
// Returns: callback(Campaign | null)

saveCampaign(campaign, ad, callback)
// Persists via MERGE INTO CAMPAIGNS + ADS. Returns: callback(boolean)

updateBudget(campaignId, deductAmount, callback)
// Deducts amount from BUDGET_REMAINING.
// Sets STATUS = 'finished' if result <= 0.
// Returns: callback(boolean)

setCampaignStatus(campaignId, status, callback)
// Returns: callback(boolean)
```

### 7.2 selection.js

```javascript
selectAd(userAddress, userInterests, campaigns)
// Synchronous — operates on an already-loaded Campaign array.
// Returns: Campaign | null
```

### 7.3 validation.js

```javascript
validateView(campaignId, userAddress, callback)
// Runs all LIMITS checks for a view event.
// Returns: callback({ valid: boolean, reason: string | null })

validateClick(campaignId, userAddress, callback)
// Runs all LIMITS checks for a click event.
// Returns: callback({ valid: boolean, reason: string | null })

isDuplicate(eventId, callback)
// Returns: callback(boolean)
```

### 7.4 rewards.js

```javascript
createRewardEvent(params, callback)
// params: { campaign_id, ad_id, user_address, type, amount, publisher_id }
// Auto-generates: id (UUID), timestamp (Date.now())
// Persists to REWARD_EVENTS, calls updateBudget(), updates USER_PROFILE.
// Returns: callback(RewardEvent | null)

getUserRewards(userAddress, callback)
// Returns: callback(RewardEvent[])

getUserProfile(userAddress, callback)
// Returns: callback(UserProfile | null)
```

### 7.6 channels.js

```javascript
openChannel(campaignId, viewerKey, creatorMx, maxAmount, cb)
// Inserts CHANNEL_STATE (status='pending') and calls updateBudget(deduct maxAmount).
// Returns: callback(err, boolean)

activateChannel(campaignId, viewerKey, channelCoinId, cb)
// Updates CHANNEL_STATE: status='open', channel_coinid=channelCoinId.
// Returns: callback(err, boolean)

getChannelState(campaignId, viewerKey, cb)
// Returns: callback(err, ChannelState | null)

updateChannelVoucher(campaignId, viewerKey, cumulativeEarned, latestTxHex, cb)
// Updates CUMULATIVE_EARNED and LATEST_TX_HEX.
// Returns: callback(err, boolean)

getLatestVoucher(campaignId, viewerKey, cb)
// Returns: callback(err, { latest_tx_hex, cumulative_earned } | null)

settleChannel(campaignId, viewerKey, cb)
// Updates CHANNEL_STATE: status='settled'.
// Returns: callback(err, boolean)
```

### 7.5 minima.js

```javascript
sqlQuery(query, callback)
// Wrapper over MDS.sql. Returns: callback(rows[])   // Note: row keys are UPPERCASE

broadcastMaxima(payload, callback)
// Hex-encodes JSON payload, sends to all Maxima contacts via sendall (always background).
// Returns: callback(boolean)

signalFE(type, data)
// MDS.comms.solo(JSON.stringify({ type, ...data }))
// Fire-and-forget. No second argument.
```

---

## 8) Maxima Protocol

### 8.1 Distribution Model

**Dual mechanism**: on-chain discovery (primary) + Maxima push broadcast (secondary).

#### On-chain discovery (reaches all DApp nodes)

Every node with the DApp installed registers the ESCROW_SCRIPT with `trackall:true` at startup. This means every DApp node independently tracks all coins at `ESCROW_ADDRESS`.

- On `NEWBLOCK` → SW queries `coins address:<ESCROW_ADDRESS>` → finds coins from all creators
- Each coin has STATE(3)=campaign_id_hex and STATE(4)=creator_mx_address
- If campaign is unknown → SW sends `REQUEST_CAMPAIGN_DATA` to creator via `to:<creator_mx_address>`
- Creator responds with `CAMPAIGN_DATA_RESPONSE` containing full campaign + ad JSON
- Receiving node persists via `MERGE INTO CAMPAIGNS` + `MERGE INTO ADS`

#### Maxima broadcast (reaches contacts only)

- On campaign creation → SW broadcasts `CAMPAIGN_ANNOUNCE` to all contacts via `sendall`
- Every ~10 min → SW re-broadcasts all active campaigns
- Receiving nodes persist via `MERGE INTO CAMPAIGNS` and `MERGE INTO ADS`
- Once cached, campaigns are fully operational offline

### 8.2 Application Name

```javascript
var APP_NAME = 'minima-ads';
```

All `MDS.cmd("maxima action:send ... application:" + APP_NAME + " ...")` calls must use this constant.

### 8.3 CAMPAIGN_ANNOUNCE

**Direction**: Creator SW → all Maxima contacts

```json
{
  "type": "CAMPAIGN_ANNOUNCE",
  "campaign": {
    "id": "uuid",
    "creator_address": "0x...",
    "title": "string",
    "budget_total": 1000,
    "budget_remaining": 1000,
    "reward_view": 0.01,
    "reward_click": 0.10,
    "status": "active",
    "created_at": 1713200000000,
    "expires_at": null
  },
  "ad": {
    "id": "uuid",
    "campaign_id": "uuid",
    "title": "string",
    "body": "string",
    "cta_label": "See more",
    "cta_url": "https://example.com",
    "interests": "tech,minima,web3"
  }
}
```

### 8.4 Reward Processing — FE-internal (not a Maxima message)

Reward processing (view and click events) is handled entirely within the FE runtime by `core/rewards.js`. There is no Maxima message and no SW handler for this flow.

**Why FE-owned**: FE and SW share the same H2 database via `MDS.sql`. The on-chain KissVM contract is the authoritative security boundary — client-side processing is a performance optimization, not a trust guarantee. SW involvement would require an unspecified cross-runtime mechanism with no security benefit over FE-direct writes.

**FE call chain** (all within `core/rewards.js` callback chain):
1. `isDuplicate(eventId)` → reject if found
2. INSERT into REWARD_EVENTS
3. `updateBudget(campaignId, amount)`
4. UPDATE USER_PROFILE (TOTAL_EARNED, LAST_REWARD_AT)
5. `signalFE('REWARD_CONFIRMED', { event_id, amount, type })`

### 8.5 CAMPAIGN_PAUSE / CAMPAIGN_FINISH

**Direction**: Creator SW → all Maxima contacts

```json
{ "type": "CAMPAIGN_PAUSE",  "campaign_id": "uuid" }
{ "type": "CAMPAIGN_FINISH", "campaign_id": "uuid" }
```

### 8.6 REQUEST_CAMPAIGN_DATA

**Direction**: Viewer SW → Creator SW (unicast via `to:<creator_mx_address>`)

Sent when a viewer's node detects a new escrow coin but does not have the campaign data locally.

```json
{
  "type": "REQUEST_CAMPAIGN_DATA",
  "campaign_id": "uuid",
  "requester_mx": "Mx..."
}
```

### 8.7 CAMPAIGN_DATA_RESPONSE

**Direction**: Creator SW → Viewer SW (unicast via `to:<requester_mx>`)

Response to a `REQUEST_CAMPAIGN_DATA` message. Payload schema is identical to `CAMPAIGN_ANNOUNCE` (same handler on receiver side).

```json
{
  "type": "CAMPAIGN_DATA_RESPONSE",
  "campaign": { "...": "same as CAMPAIGN_ANNOUNCE §8.3" },
  "ad":      { "...": "same as CAMPAIGN_ANNOUNCE §8.3" }
}
```

### 8.8 CHANNEL_OPEN_REQUEST

**Direction**: Viewer FE → Creator FE (unicast via `to:<creator_mx_address>`, `poll:true`)

Sent by the viewer SDK the first time it wants to earn rewards from a campaign. Triggers channel coin creation on the creator's node.

```json
{
  "type": "CHANNEL_OPEN_REQUEST",
  "campaign_id": "uuid",
  "viewer_key": "0x...",
  "viewer_mx": "Mx...",
  "max_amount": 0.66
}
```

### 8.9 CHANNEL_OPEN

**Direction**: Creator FE → Viewer FE (unicast via `to:<viewer_mx>`, `poll:true`)

Sent after the creator has successfully opened the channel coin on-chain.

```json
{
  "type": "CHANNEL_OPEN",
  "campaign_id": "uuid",
  "viewer_key": "0x...",
  "channel_coinid": "0x...",
  "max_amount": 0.66
}
```

### 8.10 REWARD_REQUEST

**Direction**: Viewer FE → Creator FE (unicast via `to:<creator_mx_address>`, `poll:true`)

Sent after each successful `createRewardEvent`. The `cumulative` field is the total earned so far including this event. Idempotent: creator deduplicates by `event_id`.

```json
{
  "type": "REWARD_REQUEST",
  "campaign_id": "uuid",
  "viewer_key": "0x...",
  "event_id": "uuid",
  "cumulative": 0.12
}
```

### 8.11 REWARD_VOUCHER

**Direction**: Creator FE → Viewer FE (unicast via `to:<viewer_mx>`, `poll:true`)

Sent in response to a `REWARD_REQUEST`. Contains the partially-signed transaction (creator's signature). The viewer co-signs and stores it; posts to chain when settling.

```json
{
  "type": "REWARD_VOUCHER",
  "campaign_id": "uuid",
  "viewer_key": "0x...",
  "event_id": "uuid",
  "cumulative": 0.12,
  "tx_hex": "0x..."
}
```

### 8.12 VOUCHER_SYNC_REQUEST

**Direction**: Viewer FE → Creator FE (unicast via `to:<creator_mx_address>`, `poll:true`)

Sent on reconnection when the viewer has a channel open but is missing or unsure of the latest voucher.

```json
{
  "type": "VOUCHER_SYNC_REQUEST",
  "campaign_id": "uuid",
  "viewer_key": "0x..."
}
```

Creator responds with the latest `REWARD_VOUCHER` it has for this pair, or with `CHANNEL_OPEN` if no voucher has been issued yet.

### 8.13 SW → FE Signal Contract

| Signal type | Payload | Fired by | Trigger |
|---|---|---|---|
| `DB_READY` | `{}` | `db-init.js` (SW) | All tables created — FE may begin DB access |
| `REWARD_CONFIRMED` | `{ event_id, amount, type }` | `core/rewards.js` (FE) | Successful reward persisted in callback chain |
| `CAMPAIGN_UPDATED` | `{ campaign_id, status, budget_remaining }` | `campaign.handler.js` (SW) | Status changed via Maxima |
| `NEW_CAMPAIGN` | `{ campaign_id }` | `campaign.handler.js` (SW) | CAMPAIGN_ANNOUNCE received and persisted |
| `CHANNEL_OPENED` | `{ campaign_id, channel_coinid, max_amount }` | `channel.handler.js` (SW) | Channel coin confirmed on-chain, viewer can earn |
| `VOUCHER_RECEIVED` | `{ campaign_id, cumulative }` | `channel.handler.js` (SW) | New REWARD_VOUCHER stored; viewer balance updated |
| `AUTO_SETTLE` | `{ campaign_id, viewer_key, tx_hex }` | `channel.handler.js` (SW) | Campaign finished — viewer should post settlement tx |
| `SETTLE_CONFIRMED` | `{ campaign_id, amount }` | `channel.handler.js` (FE) | Settlement tx posted successfully |
| `DO_CHANNEL_OPEN` | `{ campaign_id, viewer_key, viewer_mx, max_amount }` | `channel.handler.js` (SW) | Creator FE creates channel coin on-chain |
| `DO_REWARD_VOUCHER` | `{ campaign_id, viewer_key, viewer_mx, event_id, cumulative }` | `channel.handler.js` (SW) | Creator FE builds partial tx and sends REWARD_VOUCHER |
| `DO_SEND_VOUCHER` | `{ campaign_id, viewer_key, viewer_mx, cumulative, tx_hex }` | `channel.handler.js` (SW) | Creator FE re-sends REWARD_VOUCHER (reconnect sync) |
| `DO_RESEND_CHANNEL_OPEN` | `{ campaign_id, viewer_key, viewer_mx, channel_coinid, max_amount }` | `channel.handler.js` (SW) | Creator FE re-sends CHANNEL_OPEN when no voucher issued yet |

---

## 9) Trust Model

### 9.1 Client-side Validation (semi-trusted)

| Check | Module |
|---|---|
| Min view duration (3 s timer) | SDK |
| Daily view/click limits per campaign | `validation.js` → REWARD_EVENTS query |
| Cooldown between any rewards | `validation.js` → USER_PROFILE.LAST_REWARD_AT |
| Creator ≠ viewer | `selection.js` filter |
| Campaign active + budget sufficient | `validation.js` |
| Duplicate event prevention | `validation.js` → `isDuplicate()` |

The client is **semi-trusted**. A malicious publisher can bypass SDK-level checks.

**Runtime note**: The FE also receives `MAXIMA` events via the MDS polling loop (every ~2.5 s). The FE must **not** process Maxima message types already handled by the SW (`CAMPAIGN_ANNOUNCE`, `CAMPAIGN_PAUSE`, `CAMPAIGN_FINISH`). Doing so causes duplicate DB writes. The FE's `MDS.init` callback must silently ignore these types.

### 9.2 On-chain Validation (authoritative)

| Check | Enforcement | Status |
|---|---|---|
| Funds committed by creator | Global escrow KissVM coin | ✅ enforced |
| Only creator can open channels | `SIGNEDBY(creatorkey)` on global escrow | ✅ enforced |
| Channel amount bounded | `max_per_viewer` enforced at channel creation | ✅ enforced |
| Viewer cannot over-claim | Channel coin amount is fixed at open time | ✅ enforced |
| Both parties must agree on payout | `MULTISIG(2 creatorkey viewerkey)` on channel coin | ✅ enforced |
| Creator can reclaim unsettled channels | `@COINAGE GT (40*1728) AND SIGNEDBY(creatorkey)` | ✅ enforced |
| Budget never negative (per-reward) | H2 DB pre-check + channel MAX_AMOUNT cap | ⚠️ H2 + channel cap |

**Note**: Per-reward on-chain deduction is not enforced — rewards accumulate off-chain and are settled in one transaction per channel. The channel coin's fixed `MAX_AMOUNT` is the on-chain cap. See Appendix B (global escrow) and Appendix C (channel contract).

The Minima blockchain is the **source of truth** for fund custody. Client-side H2 is authoritative for reward accounting between settlements.

---

## 10) Attack Vectors & Mitigations (MVP)

### 10.1 Automated Farming

**Attack**: Script generates view/click events at high frequency to drain campaign budgets.

**Mitigations**:
- `COOLDOWN_BETWEEN_REWARDS_MS = 30000` — enforced by DB (`USER_PROFILE.LAST_REWARD_AT`)
- `MAX_VIEWS_PER_CAMPAIGN_PER_DAY = 1` — enforced by querying `REWARD_EVENTS` (last 24h)
- `MIN_VIEW_DURATION_MS = 3000` — timer prevents instant event submission
- UUID-based event deduplication blocks retransmitted events

**MVP residual risk**: A malicious node that implements the protocol directly can earn up to 1 reward/day/campaign. Bounded by on-chain budget cap. Acceptable for MVP.

### 10.2 Malicious Publisher

**Attack**: A dApp publisher calls `trackView` / `trackClick` without users actually viewing ads.

**Mitigations**:
- Daily limits apply regardless of `publisher_id`
- Budget cap enforced on-chain — publisher cannot exceed allocated budget
- `publisher_id` logged in every `RewardEvent` for audit trail
- Future: user-signed events for cryptographic proof of interaction

**MVP residual risk**: Publisher can claim up to 1 reward/day/campaign per address it controls. Bounded by budget cap.

### 10.3 Replay Attacks

**Attack**: A valid `RewardEvent` is re-submitted to trigger duplicate rewards.

**Mitigations**:
- Every `RewardEvent` has a unique UUID `id` assigned at creation time
- `isDuplicate(eventId)` is called before any state change in the SW handler
- If `id` already exists in `REWARD_EVENTS` → operation rejected. Zero state change.

**Effectiveness**: Full mitigation. Replayed event IDs are always rejected.

### 10.4 Budget Race Condition

**Attack**: Concurrent requests target a nearly-empty campaign simultaneously.

**Mitigations**:
- `validateView/Click` checks `BUDGET_REMAINING >= reward_amount` immediately before `createRewardEvent`
- SW is single-threaded (Rhino) — no true concurrency at MDS level
- KissVM enforces final budget check on-chain

**Effectiveness**: Strong mitigation. Single-threaded SW eliminates most race conditions.

---

## 11) Service Worker

### 11.1 Entry Point

File: `public/service-workers/main.js`

```javascript
var APP_NAME = 'minima-ads';

var LIMITS = {
  MAX_VIEWS_PER_CAMPAIGN_PER_DAY:  1,
  MAX_CLICKS_PER_CAMPAIGN_PER_DAY: 1,
  COOLDOWN_BETWEEN_REWARDS_MS:     30000,
  MIN_VIEW_DURATION_MS:            3000,
  MAX_CAMPAIGNS_PER_SESSION:       10
};

MDS.init(function(msg) {
  if (msg.event === 'inited')              { onInited(); }
  if (msg.event === 'MAXIMA')              { onMaxima(msg.data); }
  if (msg.event === 'MDS_TIMER_10SECONDS') { onTimer(); }
});
```

### 11.2 MDS Event Handlers

| MDS event | Handler | Action |
|---|---|---|
| `inited` | `onInited()` | Init DB schema, register node in USER_PROFILE, start re-broadcast |
| `MAXIMA` | `onMaxima(data)` | Decode hex payload, route by `payload.type` |
| `MDS_TIMER_10SECONDS` | `onTimer()` | Re-broadcast active campaigns, check expirations, scan escrow coins |
| `NEWBLOCK` | `onNewBlock()` | Check campaign expiry; trigger AUTO_SETTLE signal for expired campaigns with open channels |

### 11.3 Maxima Message Handlers

| Message type | Handler file | DB impact | FE signal |
|---|---|---|---|
| `CAMPAIGN_ANNOUNCE` | `campaign.handler.js` | MERGE CAMPAIGNS + ADS | `NEW_CAMPAIGN` |
| `CAMPAIGN_PAUSE` | `campaign.handler.js` | UPDATE CAMPAIGNS STATUS='paused' | `CAMPAIGN_UPDATED` |
| `CAMPAIGN_FINISH` | `campaign.handler.js` | UPDATE CAMPAIGNS STATUS='finished' | `CAMPAIGN_UPDATED` |
| `REQUEST_CAMPAIGN_DATA` | `campaign.handler.js` | read only | — (sends CAMPAIGN_DATA_RESPONSE) |
| `CAMPAIGN_DATA_RESPONSE` | `campaign.handler.js` | MERGE CAMPAIGNS + ADS | `NEW_CAMPAIGN` |
| `CHANNEL_OPEN_REQUEST` | `channel.handler.js` | MERGE CHANNEL_STATE (creator) | — (sends CHANNEL_OPEN; FE handles coin creation) |
| `CHANNEL_OPEN` | `channel.handler.js` | UPDATE CHANNEL_STATE status='open' | `CHANNEL_OPENED` |
| `REWARD_REQUEST` | `channel.handler.js` | UPDATE CHANNEL_STATE (cumulative, tx_hex) | — (sends REWARD_VOUCHER) |
| `REWARD_VOUCHER` | `channel.handler.js` | UPDATE CHANNEL_STATE (tx_hex, cumulative) | `VOUCHER_RECEIVED` |
| `VOUCHER_SYNC_REQUEST` | `channel.handler.js` | read only | — (sends REWARD_VOUCHER or CHANNEL_OPEN) |

> Reward accounting (`REWARD_EVENTS`, `USER_PROFILE`) is FE-owned. See §8.4.
> Channel coin creation and settlement tx signing are FE-owned (require pending approval flow).

### 11.4 Rhino Runtime Constraints

| Forbidden | Required alternative |
|---|---|
| `console.log(...)` | `MDS.log("[ADS] ...")` |
| Arrow functions `() =>` | `function() {}` |
| `let` / `const` | `var` |
| Template literals `` `${x}` `` | String concatenation `"" + x` |
| Trailing commas in params/args | Remove — silent crash in Rhino |
| `MDS.cmd("timer X", cb)` | `MDS_TIMER_10SECONDS` + `Date.now()` delta |
| `MDS.comms.solo(p, cb)` | `MDS.comms.solo(p)` — no second argument |
| ES Module `import` | Inline `load()` or direct function reference |

---

## 12) Code Organization

### 12.1 Folder Structure

```
/dapp
  app.js              # FE entry point — MDS.init, routing, view dispatch
  /views
    creator.js        # Campaign creation UI
    viewer.js         # Ad viewing + reward display UI
    stats.js          # Campaign stats UI

/core
  campaigns.js        # Campaign CRUD, budget tracking
  selection.js        # Ad selection algorithm (selectAd)
  validation.js       # View/click validation, LIMITS enforcement, dedup
  rewards.js          # RewardEvent creation, USER_PROFILE updates
  channels.js         # CHANNEL_STATE CRUD, channel lifecycle management
  minima.js           # MDS.sql wrapper, Maxima sender, FE signaller

/sdk
  index.js            # Public API: init, getAd, render, trackView, trackClick

/renderer
  renderAd.js         # Renders one ad unit into a DOM container element

dapp.conf             # Minima MiniDapp manifest — must be at zip root
service.js            # SW entry point — must be named service.js at zip root

/public
  index.html
  /service-workers
    main.js           # SW source (kept for reference — service.js is the actual entry)
    db-init.js        # H2 schema init — called from onInited()
    /handlers
      maxima.handler.js    # Routes inbound Maxima by payload.type
      campaign.handler.js  # CAMPAIGN_ANNOUNCE / PAUSE / FINISH / REQUEST / RESPONSE
      channel.handler.js   # CHANNEL_OPEN_REQUEST/OPEN, REWARD_REQUEST/VOUCHER, VOUCHER_SYNC
```

### 12.2 Module Rules

- **One file = one responsibility**
- **Max 300 lines per file** — split into sub-modules if larger
- **No circular dependencies** — Core never imports from SDK, MiniDapp, or Renderer
- **FE uses ES Modules**: `import { fn } from '../core/campaigns.js'`
- **SW uses no ES Modules**: Rhino does not support `import`. Use direct function calls or `load()`
- **All DB operations go through `core/minima.js`** — no bare `MDS.sql` calls elsewhere in the codebase

---

## 13) SDK Integration

### 13.1 Minimal Integration

A developer integrates MinimaAds in under 10 minutes:

```html
<div id="ad-slot"></div>

<script src="./sdk/index.js"></script>
<script>
  MinimaAds.init({ wallet: '0x...', publisher_id: 'my-dapp' }, function(err) {
    if (err) return;
    MinimaAds.getAd(userAddress, userInterests, function(err2, ad) {
      if (err2 || !ad) return;
      MinimaAds.render(ad, 'ad-slot');
    });
  });
</script>
```

### 13.2 SDK API Reference

All SDK functions are callback-based, matching the Core API pattern (§7.5). This keeps the SDK usable from any runtime — including Rhino — without polyfills.

```javascript
MinimaAds.init(config, cb)
// config:   { wallet: string, interests?: string, publisher_id?: string }
// cb:       function(err, ok)
// Stores config and calls MDS.init if not already inited.

MinimaAds.getAd(userAddress, interests, cb)
// userAddress: string (Maxima public key, 0x…)
// interests:   string (comma-separated tags) | null
// cb:          function(err, ad | null)
// Loads active campaigns, enriches with ad fields, runs selectAd.
// Respects MAX_CAMPAIGNS_PER_SESSION.

MinimaAds.render(ad, containerId)
// ad:          object returned by getAd
// containerId: string — id of DOM element to inject into
// Delegates to renderer/renderAd.js; sanitises via DOMPurify.

MinimaAds.trackView(campaignId, userAddress, cb)
// cb: function(err, { confirmed: boolean, reason?: string, event?: RewardEvent })
// Calls validateView → createRewardEvent. Creator-is-viewer check applied.

MinimaAds.trackClick(campaignId, userAddress, cb)
// cb: function(err, { confirmed: boolean, reason?: string, event?: RewardEvent })
// Calls validateClick → createRewardEvent. Caller handles navigation after cb.
```

### 13.3 Publisher Responsibilities

The publisher must only:
1. Call `MinimaAds.init({ wallet }, cb)`
2. Define an HTML element for the ad slot
3. Call `MinimaAds.getAd(userAddress, interests, cb)` then `MinimaAds.render(ad, containerId)`
4. Wire a view timer (≥ `MIN_VIEW_DURATION_MS`) before calling `trackView`

The publisher must **not**:
- Calculate or distribute rewards
- Call `MDS.sql` directly
- Manage campaign budget or validation logic

---

## Appendix A: Open Items (Post-MVP)

| Item | Status | Notes |
|---|---|---|
| KissVM global escrow contract | **Defined — see Appendix B** | SIGNEDBY(creatorkey); funds campaign channel opens |
| KissVM channel contract | **Defined — see Appendix C** | MULTISIG(2 creatorkey viewerkey) + timelock |
| Platform fee collection wallet | Not defined in MVP | Fee tracked off-chain only for now |
| Per-reward on-chain deduction | Not applicable | Channels solve this at settlement granularity |
| Cryptographic event signing | Future | Eliminates malicious publisher risk |
| Campaign gossip (multi-hop) | Future | MVP: direct Maxima contacts only |
| Advanced interest segmentation | Out of scope | |
| A/B testing | Out of scope | |
| Multi-format ads (images, video) | Out of scope | MVP: text + CTA link only |

---

## Appendix B: KissVM Escrow Contract Spec

### B.1 Purpose

The escrow contract locks campaign budget on-chain, providing:

- **Commitment proof**: Funds are visible on-chain and cannot move without the creator's wallet key
- **Auditability**: Campaign ID, creator key, and expiry block stored in coin state (PREVSTATE)
- **Batch settlement foundation**: Every payout is an on-chain transaction — full audit trail

**MVP limitation**: The script does not auto-distribute rewards or enforce per-reward deductions. Budget accounting is off-chain (H2 DB). The escrow is a commitment + audit mechanism, not an automated payment engine.

### B.2 Script

```
LET creatorkey = PREVSTATE(1)
ASSERT SIGNEDBY(creatorkey)

LET payout = STATE(10)
LET change = @AMOUNT - payout
IF change GT 0 THEN
    ASSERT VERIFYOUT(INC(@INPUT) @ADDRESS change @TOKENID TRUE)
ENDIF

RETURN TRUE
```

**What this enforces**:
- Only the creator (wallet signing key in PREVSTATE(1)) can spend this coin
- If partial spend (change > 0): change MUST return to `@ADDRESS` (same script address) with `keepstate:true` — creator cannot silently redirect remaining budget to another address
- Full spend (change = 0): allowed — used for campaign close / full refund
- The spending transaction provides `STATE(10)` = payout amount; contract validates the change output accordingly

The script is constant. All MinimaAds campaigns share the same script address — coins are differentiated by their state variables.

### B.3 State Variables

| Port | Read by | Value | Type | Purpose |
|---|---|---|---|---|
| 1 | `PREVSTATE(1)` | Creator wallet public key | `0x` hex (64 chars) | Required signer — frozen at coin creation |
| 2 | `PREVSTATE(2)` | Campaign expiry block | integer string | UI reference; not enforced by script |
| 3 | `PREVSTATE(3)` | Campaign ID (hex-encoded UTF-8) | `0x` hex | Links on-chain coin to H2 campaign record |
| 4 | `PREVSTATE(4)` | Creator Mx address | `Mx...` string | Enables on-chain discovery: viewer nodes send REQUEST_CAMPAIGN_DATA to this address |
| 10 | `STATE(10)` | Payout amount (set in spending tx) | number string | Used by script to compute required change |

`PREVSTATE(port)` reads state frozen at coin creation. `STATE(port)` reads state provided by the spending transaction. Port 10 is the only one provided by the spender — it must match the actual payout output amount or the script will fail to validate correctly.

### B.4 DB Schema Addition

```sql
ALTER TABLE CAMPAIGNS ADD COLUMN IF NOT EXISTS ESCROW_COINID VARCHAR(66) DEFAULT '';
ALTER TABLE CAMPAIGNS ADD COLUMN IF NOT EXISTS ESCROW_WALLET_PK VARCHAR(66) DEFAULT '';
```

### B.5 Lifecycle Transactions

#### Campaign Launch (escrow creation)

```javascript
// Run once per install to register the script and persist the address
var ESCROW_SCRIPT = "LET creatorkey=PREVSTATE(1) ASSERT SIGNEDBY(creatorkey) LET payout=STATE(10) LET change=@AMOUNT-payout IF change GT 0 THEN ASSERT VERIFYOUT(INC(@INPUT) @ADDRESS change @TOKENID TRUE) ENDIF RETURN TRUE";

MDS.cmd("newscript script:\"" + ESCROW_SCRIPT + "\" trackall:true", function(res) {
  var escrowAddress = res.response.address;
  // Persist so we don't need to re-run newscript on every startup
  MDS.keypair.set("ESCROW_ADDRESS", escrowAddress, function() {});
});

// On campaign creation — get wallet key, then send to escrow
MDS.keypair.get("ESCROW_ADDRESS", function(addrRes) {
  var escrowAddress = addrRes.response.value;
  MDS.cmd("keys action:new", function(keysRes) {
    // Per-campaign key — isolates this campaign on-chain from other campaigns and the main wallet
    var walletPK = keysRes.response.key.publickey;
    MDS.cmd("block", function(blockRes) {
      var expiryBlock = parseInt(blockRes.response.block) + CAMPAIGN_DURATION_BLOCKS;
      var campaignIdHex = "0x" + utf8ToHex(campaignId).toUpperCase();
      MDS.cmd("maxima action:info", function(mxRes) {
        var creatorMxAddr = mxRes.response.address;
        var state = '{"1":"' + walletPK + '","2":"' + expiryBlock + '","3":"' + campaignIdHex + '","4":"' + creatorMxAddr + '"}';
        MDS.cmd(
          "send amount:" + budgetTotal + " address:" + escrowAddress + " state:" + state,
          function(sendRes) {
            var coinId = sendRes.response.txpow.body.txn.outputs[0].coinid;
            // Save coinId as CAMPAIGNS.ESCROW_COINID
          }
        );
      });
    });
  });
});
```

#### Channel Open (funding a viewer channel from the escrow)

When a viewer requests a channel (`CHANNEL_OPEN_REQUEST`), the creator spends the global escrow to create a channel coin:

```
txncreate id:<txnid>
txninput  id:<txnid> coinid:<ESCROW_COINID> scriptmmr:true
txnoutput id:<txnid> storestate:false amount:<max_per_viewer> address:<CHANNEL_SCRIPT_ADDRESS>
txnoutput id:<txnid> storestate:true  amount:<remaining>     address:<ESCROW_ADDRESS>
txnstate  id:<txnid> port:1  value:<creator_wallet_pk>
txnstate  id:<txnid> port:2  value:<expiry_block>
txnstate  id:<txnid> port:3  value:<campaign_id_hex>
txnstate  id:<txnid> port:4  value:<creator_mx_address>
txnstate  id:<txnid> port:10 value:<max_per_viewer>
txnsign   id:<txnid> publickey:<creator_wallet_pk>
txnpost   id:<txnid> mine:true auto:true
txndelete id:<txnid>
```

Notes:
- `STATE(10)` = `max_per_viewer` → script sees `change = @AMOUNT - max_per_viewer` → verifies output[1] returns to `@ADDRESS`
- Output[0] goes to `CHANNEL_SCRIPT_ADDRESS` — the script does not constrain this output
- After posting: update `CAMPAIGNS.ESCROW_COINID` to new change coinid; save channel coinid in `CHANNEL_STATE.CHANNEL_COINID`

#### Campaign Close / Refund

Creator sends the full remaining balance back to their own wallet address. Set `STATE(10) = @AMOUNT` (full amount = no change):

```
txncreate id:<txnid>
txninput  id:<txnid> coinid:<ESCROW_COINID> scriptmmr:true
txnoutput id:<txnid> storestate:false amount:<remaining> address:<creator_wallet_address>
txnstate  id:<txnid> port:10 value:<remaining>
txnsign   id:<txnid> publickey:<wallet_pubkey>
txnpost   id:<txnid> mine:true auto:true
txndelete id:<txnid>
```

When `change = @AMOUNT - payout = 0`, the `IF change GT 0` branch is skipped — no change output required.

### B.6 Key Distinction: Maxima PK vs Wallet PK

| Key type | Minima command | Role in MinimaAds |
|---|---|---|
| **Maxima public key** | `maxima action:info → publickey` | Node identity — used in `CREATOR_ADDRESS`, `USER_PROFILE.ADDRESS` |
| **Per-campaign wallet key** | `keys action:new → publickey` | KissVM SIGNEDBY — used in escrow PREVSTATE(1) and channel MULTISIG |

These are **different keys**. Do not substitute one for the other.

### B.7 Security Properties (MVP)

| Property | Status | Notes |
|---|---|---|
| Funds locked on-chain | ✅ | Visible to all Minima nodes |
| Requires creator signature to spend | ✅ | SIGNEDBY enforced by network |
| Prevents silent fund redirection | ✅ | Any spend is an auditable on-chain tx |
| Automatic per-reward budget deduction | ⚠️ | Off-chain only; channel MAX_AMOUNT is on-chain cap |
| Trustless payout without creator online | ✅ | Viewer holds signed voucher; settles independently |
| Budget floor per individual payout | ❌ | Not script-enforced; channel cap is the boundary |

---

## Appendix C: KissVM Channel Contract Spec

### C.1 Purpose

The channel contract enables trustless off-chain reward accumulation between a specific creator-viewer pair. It enforces:

- Viewer can only receive up to `MAX_AMOUNT` (set at channel creation)
- Both parties must co-sign any spending during the active period
- Creator can reclaim unsettled funds after the timelock expires

### C.2 Script

```
IF @COINAGE GT (40*1728) AND SIGNEDBY(creatorkey) THEN RETURN TRUE
ENDIF
RETURN MULTISIG(2 creatorkey viewerkey)
```

- `40*1728` blocks ≈ 40 days — creator reclaim window after campaign ends (~6 days)
- `MULTISIG(2 creatorkey viewerkey)` — both signatures required during active period

### C.3 State Variables (frozen at channel coin creation)

| Port | Read by | Value | Purpose |
|---|---|---|---|
| 1 | `PREVSTATE(1)` | Creator per-campaign wallet key | Required for SIGNEDBY and MULTISIG |
| 2 | `PREVSTATE(2)` | Viewer per-channel wallet key | Required for MULTISIG |
| 3 | `PREVSTATE(3)` | Campaign ID (hex-encoded UTF-8) | Links channel to campaign |

### C.4 Partial Transaction Format (REWARD_VOUCHER)

Creator constructs and signs; viewer co-signs at settlement:

```
txncreate id:<txnid>
txninput  id:<txnid> coinid:<CHANNEL_COINID> scriptmmr:true
txnoutput id:<txnid> storestate:false amount:<cumulative>            address:<viewer_wallet_address>
txnoutput id:<txnid> storestate:false amount:<max_amount-cumulative> address:<creator_wallet_address>
txnsign   id:<txnid> publickey:<creator_wallet_pk>
txnexport id:<txnid>
→ hexTx sent to viewer via REWARD_VOUCHER
```

Viewer settles:
```
txnimport data:<hexTx>
txnsign   id:<txnid> publickey:<viewer_wallet_pk>
txnpost   id:<txnid> mine:true auto:true
txndelete id:<txnid>
```

Each new reward creates a **new tx** with a higher `cumulative`. The viewer discards the previous voucher and stores the latest one. Only the last voucher is ever posted.

### C.5 Script Registration

```javascript
var CHANNEL_SCRIPT = "IF @COINAGE GT (40*1728) AND SIGNEDBY(PREVSTATE(1)) THEN RETURN TRUE ENDIF RETURN MULTISIG(2 PREVSTATE(1) PREVSTATE(2))";

MDS.cmd("newscript script:\"" + CHANNEL_SCRIPT + "\" trackall:true", function(res) {
  MDS.keypair.set("CHANNEL_SCRIPT_ADDRESS", res.response.address, function() {});
});
```

`CHANNEL_SCRIPT_ADDRESS` is shared across all channels — coins are differentiated by their PREVSTATE(1) (creator key) and PREVSTATE(2) (viewer key).

---

## 15) UI Design

### 15.1 Design Principles

- **Two audiences**: general Minima users (viewer) and technical advertisers (creator/stats). The viewer UI must be dead simple; the creator/stats UI can be denser.
- **Mobile-first**: all layouts start at small screen and scale up.
- **No framework JS**: Pico CSS via CDN for styling — class-free, semantically driven, modern look with a single `<link>` tag and zero build step.
- **Chart.js via CDN** for the stats dashboard — line chart for interaction timeline, no additional dependencies.

### 15.2 CSS Framework

**Pico CSS** (CDN) — loaded in `public/index.html` before any app scripts:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css">
```

Pico styles standard HTML elements (`<button>`, `<input>`, `<table>`, `<article>`) directly — no class names needed on most elements. Custom overrides go in a `public/css/style.css` file loaded after Pico.

### 15.3 Ad Unit — Responsive Banner

The ad unit rendered by `renderer/renderAd.js` is a **fluid responsive banner**:

- Width: `100%` of its container — the publisher controls placement by sizing the container
- Layout: horizontal (image left, text right) on wide screens; stacked (image top, text below) on narrow screens (`flex-wrap`)
- Elements: thumbnail image · title · short description · CTA button
- Placement examples the publisher can create: header bar, sticky footer, sidebar card

```
┌─────────────────────────────────────────┐
│ [img] │ Title                           │
│       │ Short description text…         │
│       │                    [Visit →]    │
└─────────────────────────────────────────┘

On mobile (stacked):
┌──────────────┐
│    [img]     │
│ Title        │
│ Description… │
│  [Visit →]   │
└──────────────┘
```

All ad fields must be sanitized with `DOMPurify.sanitize()` before DOM injection (see AGENTS.md §12 fragility #21).

### 15.4 Views

#### Viewer (`dapp/views/viewer.js`)
- Single ad unit centered on screen
- "Earned" counter below the ad (total Minima earned this session)
- Minimal chrome — no navigation clutter
- After click: brief confirmation ("Reward registered") then reload next ad

#### Creator (`dapp/views/creator.js`)
- Form: campaign name, ad title, description, image URL, target interests (tags), budget (Minima), reward per view, reward per click, expiry (blocks)
- Inline validation before submit
- On submit: escrow creation flow + `CAMPAIGN_ANNOUNCE` broadcast
- Clear success/error feedback

#### Stats (`dapp/views/stats.js`)
- **Table**: one row per campaign — name, status, impressions, clicks, CTR, budget remaining
- **Line chart** (Chart.js): interactions over time (views + clicks) for the selected campaign
- Toggle between campaigns via dropdown
- Auto-refresh every 30s via `setInterval`

### 15.5 Dependencies (all via CDN, no build step)

| Library | Version | Purpose | Tag |
|---|---|---|---|
| Pico CSS | v2 latest | Base styling | `<link>` in `<head>` |
| DOMPurify | latest | XSS sanitization of ad content | `<script>` before app scripts |
| Chart.js | v4 latest | Stats line chart | `<script>` before `stats.js` |

All three are loaded in `public/index.html`. No `npm install` required.
