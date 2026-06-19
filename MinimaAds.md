# MinimaAds — Technical Specification

> **Status**: MVP — Implementation-ready
> **Platform**: Minima MiniDapp (MDS)
> **Frontend**: Vanilla JavaScript (ES Modules) — no frameworks
> **Last updated**: 2026-06-19 (patch 24: settlement txnpost bare, §8.15 CAMPAIGN_AUTOSETTLE_REQUEST signal)

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

## Quick Navigation — Read by task type

| Task type | Sections to read |
|---|---|
| UI (views, CSS, copy) | §12, §15 |
| Core logic (campaigns, rewards, selection, validation) | §3, §7 |
| Service Worker (handlers, DB schema, NEWBLOCK) | §3, §7, §11 |
| Maxima protocol (message schemas, send/receive) | §3, §8 |
| Payment channels (open, voucher, settle) | §3, §6.5–6.8, §7.6, §8.8–8.12 |
| KissVM escrow / on-chain status | §4, §6.3, Appendix B |
| SDK (publisher integration) | §3, §7, §13 |
| Full feature (new system flow) | §1–§8, §11–§13, relevant Appendix |

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
| **Publisher** | Operates a Frame that displays ads | Register frame, display ads, earn per-view publisher reward |
| **Frame** | A registered display surface owned by a Publisher. The publisher's Maxima public key is captured at frame creation and stored as `PUBLISHER_KEY`. The built-in MinimaAds viewer is the default Frame for every node, using the node's own Maxima PK resolved at app init. Third-party publishers register additional Frames via `MinimaAds.init({ frameId, ... })`. | Receive `PUBLISHER_REWARD_VIEW` per validated view |
| **Platform** | MinimaAds itself | Acts as Viewer + Creator + Publisher simultaneously; collects 6% fee enforced by KissVM (see §4.6) |

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
  "id":                     "string (UUID)",
  "creator_address":        "string (Maxima public key — 0x...)",
  "title":                  "string",
  "budget_total":           "number (tokens) — covers viewer + publisher rewards",
  "budget_remaining":       "number (tokens)",
  "reward_view":            "number (tokens per view to viewer)",
  "reward_click":           "number (tokens per click to viewer)",
  "publisher_reward_view":  "number (tokens per validated view to publisher; 0 disables publisher payouts)",
  "max_publisher_budget":   "number (tokens) — cap on cumulative publisher payouts; subset of budget_total",
  "publisher_budget_spent": "number (tokens) — running total paid to publishers; ≤ max_publisher_budget",
  "max_daily_views":        "number (views) — daily view limit per user",
  "max_daily_clicks":       "number (clicks) — daily click limit per user",
  "status":                 "enum: draft | active | paused | finished",
  "created_at":             "number (unix ms)",
  "expires_at":             "number (unix ms) | null"
}
```

### 3.2 Ad

```json
{
  "id":             "string (UUID)",
  "campaign_id":    "string",
  "title":          "string",
  "body":           "string",
  "cta_label":      "string",
  "cta_url":        "string",
  "interests":      "string (comma-separated tags, optional)",
  "image_data":     "string (JPEG data URI — data:image/jpeg;base64,… — optional, only on first send)",
  "show_title":     "int 0|1 — whether to render the title in the banner (default 1)",
  "show_body":      "int 0|1 — whether to render the body text (default 1)",
  "show_cta":       "int 0|1 — whether to render the CTA button; image still links when 0 (default 1)",
  "bg_color":       "string (CSS color — background of text block, default '#ffffff')",
  "text_color":     "string (CSS color — title/body/CTA text, default '#111111')",
  "image_position": "string (CSS object-position — focal point, e.g. '50% 30%' — default 'center')",
  "image_zoom":     "float — kept in DB for backward compat; UI removed; always 1.0 for new ads",
  "image_width_pct":"int — desktop image column width as % of banner (20–70, default 40); ignored in mobile layout"
}
```

### 3.3 RewardEvent

```json
{
  "id":           "string (UUID — unique per action, used for dedup)",
  "campaign_id":  "string",
  "ad_id":        "string",
  "user_address": "string",
  "type":         "enum: view | click | publisher_view",
  "amount":       "number (tokens transferred)",
  "timestamp":    "number (unix ms)",
  "publisher_id": "string (frame_id — for type='publisher_view' identifies the earning Frame; for type='view'|'click' identifies the displaying Frame for audit)"
}
```

> **`publisher_id` semantics**: This field stores the **`FRAME_ID`** of the Frame that displayed the ad. For events of `type='publisher_view'`, the Frame is the reward recipient. For `type='view'`/`'click'`, the Frame is logged for audit only.

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
  ID                     VARCHAR(256)  PRIMARY KEY,
  CREATOR_ADDRESS        VARCHAR(512)  NOT NULL,   -- Maxima public key RSA DER hex ~326 chars (NOT wallet signing key)
  TITLE                  VARCHAR(512)  NOT NULL,
  BUDGET_TOTAL           DECIMAL(20,6) NOT NULL,
  BUDGET_REMAINING       DECIMAL(20,6) NOT NULL,
  REWARD_VIEW            DECIMAL(20,6) NOT NULL,
  REWARD_CLICK           DECIMAL(20,6) NOT NULL,
  PUBLISHER_REWARD_VIEW  DECIMAL(20,6) NOT NULL DEFAULT 0,   -- 0 = publisher payouts disabled
  MAX_PUBLISHER_BUDGET   DECIMAL(20,6) NOT NULL DEFAULT 0,   -- cap on cumulative publisher payouts
  PUBLISHER_BUDGET_SPENT DECIMAL(20,6) NOT NULL DEFAULT 0,   -- running total paid to publishers
  STATUS                 VARCHAR(32)   NOT NULL DEFAULT 'active',
  CREATED_AT             BIGINT        NOT NULL,
  EXPIRES_AT             BIGINT        DEFAULT NULL,
  ESCROW_COINID          VARCHAR(66)   DEFAULT '',  -- on-chain escrow coin; updated after each channel open
  ESCROW_WALLET_PK       VARCHAR(66)   DEFAULT '',  -- wallet signing key in escrow PREVSTATE(1)
  MAX_VIEWER_REWARD      DECIMAL(20,6) DEFAULT NULL, -- optional per-viewer channel cap; if set overrides (view+click)×days formula
  MAX_DAILY_VIEWS        INT           DEFAULT 100,
  MAX_DAILY_CLICKS       INT           DEFAULT 100,
  COOLDOWN_MS            BIGINT        DEFAULT 300000  -- ms between rewards for the same viewer; overrides LIMITS.COOLDOWN_BETWEEN_REWARDS_MS
);

CREATE TABLE IF NOT EXISTS ADS (
  ID          VARCHAR(256)  PRIMARY KEY,
  CAMPAIGN_ID VARCHAR(256)  NOT NULL,
  TITLE       VARCHAR(512)  NOT NULL,
  BODY        VARCHAR(2048),
  CTA_LABEL   VARCHAR(128),
  CTA_URL     VARCHAR(1024),
  INTERESTS   VARCHAR(1024) DEFAULT NULL,
  IMAGE_DATA      CLOB          DEFAULT NULL,    -- JPEG data URI; only populated on first Maxima send
  SHOW_TITLE      SMALLINT      DEFAULT 1,
  SHOW_BODY       SMALLINT      DEFAULT 1,
  SHOW_CTA        SMALLINT      DEFAULT 1,       -- hides CTA button; image still links when 0
  BG_COLOR        VARCHAR(16)   DEFAULT '#ffffff',
  TEXT_COLOR      VARCHAR(16)   DEFAULT '#111111',
  IMAGE_POSITION  VARCHAR(32)   DEFAULT 'center', -- CSS object-position focal point; e.g. "50% 30%"
  IMAGE_ZOOM      FLOAT         DEFAULT 1.0,      -- kept for backward compat; UI removed; always 1.0 for new ads
  IMAGE_WIDTH_PCT INT           DEFAULT 40        -- desktop image column width %; ignored in mobile layout
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

CREATE TABLE IF NOT EXISTS FRAMES (
  FRAME_ID         VARCHAR(512)  PRIMARY KEY,        -- UUID, or 'builtin:<maxima_pk>' for default frame
  -- PUBLISHER_KEY: Maxima PK of the owning publisher node (0x...). For the local
  -- built-in row this is the node's own PK (per-node SDK default-frame artifact).
  -- Built-in viewer impressions, however, attribute publisher rewards to the
  -- platform creator (MINIMAADS_CREATOR_PK in config.js) — see §6.9.
  PUBLISHER_KEY    VARCHAR(512)  NOT NULL,           -- Maxima public key of the publisher node (0x...)
  PUBLISHER_WALLET VARCHAR(512)  DEFAULT '',         -- Wallet address for publisher reward settlement
  LABEL            VARCHAR(256)  DEFAULT '',         -- Human-readable name
  IS_BUILTIN       BOOLEAN       NOT NULL DEFAULT FALSE,
  CREATED_AT       BIGINT        NOT NULL,
  TOTAL_EARNED     DECIMAL(20,6) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS CHANNEL_STATE (
  CAMPAIGN_ID       VARCHAR(256)   NOT NULL,
  VIEWER_KEY        VARCHAR(66)    NOT NULL,   -- per-channel wallet key (keys action:new); holds viewer or publisher key per ROLE
  ROLE              VARCHAR(16)    NOT NULL DEFAULT 'viewer', -- 'viewer' | 'publisher'
  FRAME_ID          VARCHAR(512)   DEFAULT '', -- non-empty when ROLE='publisher'
  CREATOR_MX        VARCHAR(512)   NOT NULL,   -- creator Mx contact string (from escrow STATE(4))
  CHANNEL_COINID    VARCHAR(66)    DEFAULT '',  -- set after creator opens channel on-chain
  MAX_AMOUNT        DECIMAL(20,6)  NOT NULL,   -- (REWARD_VIEW + REWARD_CLICK) × campaign_days for viewer; MAX_PUBLISHER_BUDGET cap for publisher
  CUMULATIVE_EARNED DECIMAL(20,6)  NOT NULL DEFAULT 0,
  LATEST_TX_HEX     TEXT           DEFAULT '',  -- last partially-signed tx received from creator
  STATUS            VARCHAR(16)    NOT NULL DEFAULT 'pending', -- pending|open|settled|expired
  CREATED_AT        BIGINT         NOT NULL,
  VIEWER_WALLET_ADDR VARCHAR(512)  DEFAULT '',  -- settlement output address (viewer wallet or publisher wallet)
  PRIMARY KEY (CAMPAIGN_ID, VIEWER_KEY, ROLE)
);
```

> `CHANNEL_STATE` exists on both creator and viewer nodes with different semantics:
> - **Creator node**: `LATEST_TX_HEX` = last tx it signed and sent; `CUMULATIVE_EARNED` = total it has committed
> - **Viewer node**: `LATEST_TX_HEX` = last tx received from creator (ready to post); `CUMULATIVE_EARNED` = total earned
>
> **`ROLE` column**: distinguishes viewer-channels (`'viewer'`) from publisher-channels (`'publisher'`). The same campaign can have both types. When `ROLE='publisher'`, `VIEWER_KEY` holds the publisher's per-channel wallet key and `FRAME_ID` identifies the earning Frame. **Always include `AND UPPER(ROLE) = UPPER('viewer'|'publisher')` in WHERE clauses** to avoid matching both channel types for the same key.

**Note on `CAMPAIGNS.ESCROW_WALLET_PK`**: this field stores a **per-campaign generated key** (`keys action:new`), not the node's main wallet key. This provides on-chain isolation between campaigns — a spend on one campaign's escrow does not expose the creator's main wallet key.

**H2 SQL rules** (mandatory — see AGENTS.md §3):
- Upserts via `MERGE INTO ... KEY(id)` — never `ON CONFLICT`
- String comparisons via `UPPER()` — never raw equality on IDs or addresses
- BOOLEAN columns return strings `"true"`/`"false"` — check all four variants

---

### 3.6 Creator Permanent Routes (MVP)

In MVP phase, creators' permanent Maxima routes are stored in local KeyPair storage:

| Key | Value | Semantics |
|---|---|---|
| `USER_PERMANENT_ROUTE` | `MAX#<publickey>#<staticMLS>` | User's permanent, MLS-resolved address. Set once at campaign creation; used in escrow STATE(4). |

**On-chain storage**: The escrow coin's `STATE(4)` now contains the creator's permanent route instead of a mutable `Mx...` contact address. This enables campaign discovery even if the creator's contact address changes.

**Setup flow**: Creators must have a static MLS configured on their node before creating campaigns. The creator setup wizard (first access to Creator view) guides them through:
1. `maxextra action:staticmls host:<server-p2p-identity>` (on creator's node)
2. `maxextra action:addpermanent publickey:<creator-pk>` (on static MLS server)
3. Register in MinimaAds via UI button (stores in KeyPair)

Once registered, all future campaigns use `MAX#<pk>#<mls>` in escrow STATE(4), enabling discovery via Minima's native MLS resolution mechanism.

**Future (post-MVP)**: Dynamic route refresh via `PEER_ROUTE_UPDATE` messages (see `docs/MAXIMA_ROUTE_DISCOVERY.md`).

---

## 4) Economic Model

### 4.1 Variables

| Symbol | Description |
|---|---|
| `B` | Campaign budget total (tokens) — covers viewer + publisher rewards |
| `F = 0.06` | Platform fee: 6% of B — enforced on-chain by KissVM (see §4.6) |
| `R_v` | Reward per view to viewer (recommended MVP default: `0.01`) |
| `R_c` | Reward per click to viewer (recommended MVP default: `0.10`) |
| `R_p` | Publisher reward per validated view (`PUBLISHER_REWARD_VIEW`) — 0 disables publisher payouts |
| `B_p` | Maximum publisher budget (`MAX_PUBLISHER_BUDGET`) — subset of `B` |

### 4.2 Cost & Fee Structure

- Creator pays: `B + (F × B)` = `B × 1.06`
- Platform fee `F × B` is paid to the `PLATFORM_KEY` recipient via the escrow KissVM script (see §4.6 and Appendix B).
- The single budget `B` covers BOTH viewer rewards AND publisher rewards. The split is governed by `MAX_PUBLISHER_BUDGET`:
  - Publisher payouts ≤ `B_p`
  - Viewer payouts use the remaining budget

### 4.3 Budget Rules

- Budget never goes negative — guaranteed by pre-execution check, channel `MAX_AMOUNT` cap, and KissVM
- A reward executes only if `budget_remaining >= reward_amount`
- A publisher reward executes only if `(B_p − PUBLISHER_BUDGET_SPENT) >= R_p`
- Campaign auto-transitions to `finished` when `budget_remaining <= 0`
- If budget is insufficient: event rejected silently, no state change

### 4.5 Publisher Reward Economics

- **Per-event publisher payout**: `R_p` MINIMA for every viewer view that is validated AND originates from a registered Frame (`frameId` set in SDK `init()`).
- **Single channel per (campaign, frame)**: the publisher node opens a `ROLE='publisher'` channel with the same campaign escrow used by viewers. Off-chain accumulation and settlement mirror the viewer flow (§6.5–§6.7).
- **Atomicity**: when a viewer view is rewarded, the SDK fires both events sequentially: first viewer reward, then publisher reward (if `frameId` is set and `R_p > 0`). The publisher reward produces a `REWARD_REQUEST` with `role='publisher'` to the creator's node.
- **Fee enforcement**: the escrow contract verifies that the platform fee output goes to `PLATFORM_KEY`. Network nodes silently reject any campaign whose escrow coin does not embed a valid `PLATFORM_KEY` at PREVSTATE(5). See §4.6 and Appendix B.

### 4.6 PLATFORM_KEY — Decentralized Fee Enforcement

`PLATFORM_KEY` is a Minima wallet public key (or `null` for MVP). It identifies the recipient of the 6% platform fee. The key is:

- **Embedded in the escrow KissVM script** at campaign creation (PREVSTATE(5) of the escrow coin).
- **Validated by every receiving node** before persisting a campaign or opening a channel against it.
- **Constant across all DApp installations** — the value is shipped in `config.js` and is identical for every node running the official app.

A campaign whose escrow does not embed the canonical `PLATFORM_KEY` is silently rejected by all participating nodes. No viewers, no publishers, no rewards, no propagation. The attack is self-defeating — it requires deliberate code modification and produces a campaign that the entire network ignores.

For MVP testing, `PLATFORM_KEY = null`. When null, the on-chain enforcement is skipped. This is MVP-only and must be set to a real key before any mainnet release.

#### 4.6.1 MINIMAADS_CREATOR_PK — Built-in Frame Ownership

`MINIMAADS_CREATOR_PK` is the platform creator's Maxima public key (DER format, `0x...`). Like `PLATFORM_KEY`, it is a constant shipped in `config.js` and identical on every node. It identifies the owner of the **built-in viewer Frame**: every impression served by the in-app `#viewer` surface attributes its publisher-side reward to this key (see §6.9). Custom Frames are unaffected — they carry the registering publisher's own key. The constant is loaded in both runtimes (SW via `MDS.load`, FE via `<script>`) and resolves as a global in `core/*` and `dapp/views/*`.

### 4.7 Campaign Status as On-chain State

Campaign status (`active` | `paused` | `finished`) is stored as a mutable state variable on the campaign escrow coin, at `STATE(7)` / `PREVSTATE(7)` of `ESCROW_SCRIPT_V3` (see Appendix B.2.1). This removes the dependency on creator-online Maxima broadcasts for pause/finish/resume propagation.

- **Source of truth**: every node reads `PREVSTATE(7)` from the on-chain escrow coin during its `NEWBLOCK` discovery scan. No Maxima message is required to learn the current campaign status — the chain itself carries it.
- **Manual status change**: when the creator clicks Pause / Resume / Finish, the UI applies the change locally for immediate UX feedback (`applyStatusChange`) and posts a `Status Update Transaction` (Appendix B.5) that spends the current V3 escrow coin and produces a same-amount change coin at `ESCROW_ADDRESS_V3` carrying the new `STATE(7)`.
- **Propagation**: once the status-update tx confirms, every node — including those that were offline at the time — discovers the new change coin on its next `NEWBLOCK` scan and updates its local `CAMPAIGNS.STATUS` to `PREVSTATE(7)`. Channel-open and partial-refund spends also carry `STATE(7)` forward unchanged.
- **Backwards compatibility**: V1/V2 escrow coins (created before T-SC1) have no `STATE(7)` and continue to rely on the legacy Maxima fast-path (§8.5) for status propagation. The on-chain status mechanism only applies to coins held at `ESCROW_ADDRESS_V3`.
- **Enforcement scope**: the V3 KissVM script does **not** enforce status — `STATE(7)` is read-only with respect to the script (no `ASSERT` on its value). Enforcement of "no rewards on non-active campaigns" lives in the SW handlers (`selectAd` filters by `STATUS === 'active'`, `validateView`/`validateClick` and `handleRewardRequest` reject non-active campaigns).

See §6.10 for the full Status Update flow and Appendix B.2.1 for the V3 script.

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

All limits are defined as a single constant object at the top of `service.js`. Never hardcode these values inline.

```javascript
var LIMITS = {
  MAX_VIEWS_PER_CAMPAIGN_PER_DAY:  100,
  MAX_CLICKS_PER_CAMPAIGN_PER_DAY: 100,
  COOLDOWN_BETWEEN_REWARDS_MS:     30000,  // 30 seconds
  MIN_VIEW_DURATION_MS:            3000,   // 3 seconds
  MAX_CAMPAIGNS_PER_SESSION:       10,
  MIN_BUDGET:                      100,    // minimum campaign budget in MINIMA (~$0.77)
  MIN_REWARD_VIEW:                 0.001,  // minimum reward per view in MINIMA
  MIN_REWARD_CLICK:                0.001,  // minimum reward per click in MINIMA
  MIN_PUBLISHER_REWARD_VIEW:       0.01,  // floor for PUBLISHER_REWARD_VIEW (only applies when R_p > 0)
  MAX_CAMPAIGN_DAYS:               90      // maximum campaign duration in days
};
```

### 5.1 Limit Definitions

| Constant | Value | Enforcement point |
|---|---|---|
| `MAX_VIEWS_PER_CAMPAIGN_PER_DAY` | 100 | `validation.js` → query `REWARD_EVENTS` (last 24h, same user+campaign+type=view) |
| `MAX_CLICKS_PER_CAMPAIGN_PER_DAY` | 100 | `validation.js` → same query for `type='click'` |
| `COOLDOWN_BETWEEN_REWARDS_MS` | 30 s | `validation.js` fallback only — overridden by `CAMPAIGNS.COOLDOWN_MS` when set |
| `MIN_VIEW_DURATION_MS` | 3 s | SDK client-side timer — must complete before view event is emitted |
| `MAX_CAMPAIGNS_PER_SESSION` | 10 | `selection.js` — session counter, never persisted to DB |
| `MIN_BUDGET` | 100 MINIMA | `creator.js` submit validation + HTML `min` attribute — anti-spam floor (~$0.77 at current rates) |
| `MIN_REWARD_VIEW` | 0.001 MINIMA | `creator.js` submit validation + HTML `min` attribute |
| `MIN_REWARD_CLICK` | 0.001 MINIMA | `creator.js` submit validation + HTML `min` attribute |
| `MIN_PUBLISHER_REWARD_VIEW` | 0.01 MINIMA | `creator.js` submit validation — only applies when `PUBLISHER_REWARD_VIEW > 0`; value of 0 (disabled) is always valid |
| `MAX_CAMPAIGN_DAYS` | 90 | `creator.js` submit validation + HTML `max` attribute |

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
7.  SDK fires signalFE('REWARD_CONFIRMED', { event_id, amount, reward_type })
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
1.  Creator fills form: title, budget_total, reward_view, reward_click,
    publisher_reward_view (optional, default 0), max_publisher_budget (required if publisher_reward_view > 0)
2.  System computes fee: fee = budget_total × 0.06
3.  Creator reviews and approves total: budget_total + fee
4.  Budget locked in KissVM escrow (see Appendix B):
    a. Generate a per-campaign wallet key:  keys action:new  → publickey
       → save as CAMPAIGNS.ESCROW_WALLET_PK  (isolates this campaign on-chain)
    b. Register escrow script (once per install, or when PLATFORM_KEY changes):
       newscript script:"<B.2 script with PLATFORM_KEY>" trackall:false
       → save returned address as ESCROW_ADDRESS_V2 in keypair
    c. Send budget + fee in two atomic outputs via `send multi:`:
       — If PLATFORM_KEY is null (MVP): legacy `send amount:<budget_total>` (single output, no fee)
       — If PLATFORM_KEY is set: `send multi:["<PLATFORM_KEY>:<feeAmount>","<ESCROW_ADDRESS>:<budgetTotal>"] state:...`
         • Output[0]: fee (6% of budget_total) → PLATFORM_KEY (direct wallet output, no state)
         • Output[1]: budget → ESCROW_ADDRESS_V2 (with state)
         • Change: auto-added by txnpost, back to creator wallet
       State JSON (only on escrow output):
            {"1":"<wallet_pubkey>","2":"<expiry_block>","3":"<campaign_id_hex>",
             "4":"<creator_permanent_route MAX#pk#mls>","5":"<PLATFORM_KEY or 0x00>","6":"<max_publisher_budget>"}
       Note: STATE(4) = creator MAX#route (permanent address for discovery) — enables on-chain campaign discovery
       Note: STATE(5) = PLATFORM_KEY — embedded for contract enforcement and network validation (0x00 if disabled)
       Note: STATE(6) = max_publisher_budget — for publisher channel budget tracking
    d. Save returned coinid in CAMPAIGNS.ESCROW_COINID
5.  Campaign created locally: status='active', budget_remaining=budget_total,
    publisher_reward_view, max_publisher_budget, publisher_budget_spent=0
6.  Ad object created and linked to campaign
    (Campaign propagates to other nodes automatically via on-chain discovery — §8.1)
```

**Network-side validation** (mandatory on every receiving node, in `campaign.handler.js` + `sdk/index.js`):

The payload's `platform_key` field must NOT be used for validation — it is attacker-controlled data. All validation must read the on-chain coin's `PREVSTATE(5)`:

```
On CAMPAIGN_ANNOUNCE via CAMPAIGN_DATA_RESPONSE, or escrow coin discovery via NEWBLOCK:
  1. If escrow coinid is present: query the on-chain coin (MDS.cmd('coins coinid:...'))
  2. Read PREVSTATE(5) from the coin (the authoritative PLATFORM_KEY value)
  3. If local PLATFORM_KEY is null → accept (MVP — no validation)
  4. Else if PREVSTATE(5) = 0x00 → accept (creator had fee disabled; escrow was created without fee output)
  5. Else if PREVSTATE(5).toUpperCase() === PLATFORM_KEY.toUpperCase() → accept
  6. Else → MDS.log("[CAMPAIGN] PREVSTATE(5) mismatch, dropping: " + campaign_id) and return

Do NOT drop campaigns based on the Maxima payload's platform_key field.
The on-chain coin PREVSTATE(5) is the single source of truth for fee enforcement.
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

> **V3 status passthrough**: when the campaign is funded by an `ESCROW_SCRIPT_V3` coin, the channel-open spend (step 6c) MUST carry `STATE(7)` forward on the escrow change output — set `txnstate port:7 value:<current_PREVSTATE(7)>` (or the UTF-8-hex of `"active"` for newly-created V3 campaigns that have not yet been paused). This preserves the on-chain status on the new change coin so subsequent NEWBLOCK scans on other nodes still resolve the correct status. See Appendix B.5 Channel Open template and §4.7.

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

### 6.9 Frame Creation Flow

A Frame is a registered display surface for a publisher. It is the unit of identity for publisher reward attribution.

**Frame ownership model.** Custom Frames can be registered by any publisher and are owned by the node that creates them (`publisher_key = MY_MAXIMA_PK`). The **built-in Frame** (the in-app `#viewer` surface) belongs to the **platform creator**: impressions served by the built-in viewer attribute the publisher-side reward to `MINIMAADS_CREATOR_PK` (a constant shipped in `config.js`, identical on every node), not to the viewing node. This makes the built-in viewer a platform-owned surface — its publisher rewards accrue to the platform creator regardless of which node served the ad.

```
Built-in Frame (auto-registered at app init):
1.  On 'inited' event, SW resolves node Maxima PK via maxima action:info
2.  SW computes frame_id = 'builtin:' + maxima_pk.toUpperCase()
3.  SW upserts FRAMES row: { frame_id, publisher_key=maxima_pk, is_builtin=true,
                             label='Built-in viewer', publisher_wallet=<getaddress> }
    (This local row lets the SDK resolve a default frameId per node; it is a
     per-node artifact and is independent of publisher-reward attribution.)
4.  signalFE('FRAME_READY', { frame_id, is_builtin: true })

Built-in viewer impression attribution (dapp/views/viewer.js):
- MA_TRACK_VIEW / MA_TRACK_CLICK carry publisherKey = MINIMAADS_CREATOR_PK
  (the platform creator's Maxima PK from config.js), NOT the viewing node's key.
- The publisher-side REWARD_VOUCHER is therefore attributed to the platform
  creator. The creator node generates and pays it out against the publisher
  channel held by MINIMAADS_CREATOR_PK.
- Custom Frames keep their own publisher_key in MA_TRACK_* (see SDK snippet),
  so custom-frame rewards still go to the registering publisher.

User-created Frame (via Frames UI):
1.  Publisher opens 'Frames' menu → clicks 'Create frame'
2.  Form: label (required)
3.  On submit: FE generates frame_id = generateUID(), reads node Maxima PK (MY_MAXIMA_PK)
4.  FE inserts FRAMES row: { frame_id, publisher_key: MY_MAXIMA_PK, label, is_builtin: false,
                             publisher_wallet: MY_ADDRESS, created_at: Date.now() }
5.  FE shows publisher the SDK integration snippet:
      MinimaAds.init({ wallet: '0x...', frameId: '<frame_id>' }, cb);
6.  Signals FRAME_CREATED to refresh the list

Third-party SDK integration:
1.  Publisher includes sdk/index.js and calls MinimaAds.init({ wallet, frameId })
2.  SDK validates frame_id exists in local FRAMES table
3.  Subsequent trackView calls include frame_id; the SDK tags REWARD_EVENTS.PUBLISHER_ID
4.  The SDK fires a publisher REWARD_REQUEST (role='publisher') only if PUBLISHER_REWARD_VIEW > 0
```

### 6.10 Campaign Status Update Flow (on-chain)

Triggered when the creator changes a campaign's status (Pause / Resume / Finish) and the campaign is funded by an `ESCROW_SCRIPT_V3` coin. Combines an immediate local UX update with an on-chain status-change tx whose change coin propagates the new status to every node via `NEWBLOCK` discovery — no creator-online Maxima required.

```
1.  Creator clicks Pause / Resume / Finish on a campaign row in mycampaigns.js.

2.  FE applies the local status immediately:
    - mycampaigns.js broadcasts MA_LOCAL_STATUS { campaign_id, status } via MDS.comms.
    - SW receives MA_LOCAL_STATUS → handleLocalStatusChange → applyStatusChange
      → setCampaignStatus updates the local CAMPAIGNS row and signals
        CAMPAIGN_UPDATED to the FE for instant UI feedback.

3.  FE runs buildAndPostStatusUpdateTx (Appendix B.5):
    - Reads CAMPAIGNS.ESCROW_COINID (V3 coin) and CAMPAIGNS.ESCROW_WALLET_PK.
    - Spends the current escrow coin in full and outputs the same amount back
      to ESCROW_ADDRESS_V3 with storestate:true.
    - Sets txnstate port:7 value:<status_hex> to the new UTF-8-hex of "active",
      "paused" or "finished".
    - Carries ports 1, 3, 4, 5, 6, 11 forward (creator key, campaign id, creator
      mx, platform key, max publisher budget, fee flag = 0). Ports 10 = 0 and
      11 = 0 so the V3 script reads payout=0 and skips the fee branch.
    - Posts the tx via txnpost mine:true auto:true; the FE marks the campaign
      as STATUS_TX_PENDING and signals STATUS_TX_PENDING { campaign_id, status,
      pending_uid } to mycampaigns.js for "awaiting confirmation" UX.

4.  On Minima Hub approve → tx confirms on-chain. The new change coin appears at
    ESCROW_ADDRESS_V3 with PREVSTATE(7) = new status.

5.  All nodes — including viewers/publishers that were offline at the time —
    pick up the change coin on their next NEWBLOCK discovery scan
    (campaign.handler.js scanEscrowCoins → processEscrowCoin reads PREVSTATE(7)
    and calls setCampaignStatus when it differs from the local row). The
    creator's own node also re-reads PREVSTATE(7) on confirmation and clears
    the pending marker.

6.  Each node signals CAMPAIGN_UPDATED { campaign_id, status } to its FE.
    Viewer SDKs invalidate _livenessCache[campaign_id] so the next getAd ->
    selectAd filters out non-active campaigns and stops serving the ad. Open
    payment channels remain unchanged on-chain; settlement still works via the
    existing voucher held by each viewer (see §6.7).
```

**Failure handling**: if the status-update tx is rejected at the Hub or fails to confirm, the local DB still reflects the new status (applied at step 2). The creator may retry the tx; until a new change coin appears at `ESCROW_ADDRESS_V3`, other nodes do not see the change. Manual reversal (Pause then Resume) is supported because each status change posts a fresh tx — the latest confirmed change coin wins.

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

updateUserProfile(userAddress, fields, callback)
// fields: { interests: string | null }
// MERGE INTO USER_PROFILE (ADDRESS, INTERESTS) — never touches TOTAL_EARNED or LAST_REWARD_AT.
// Creates profile row with default values if none exists.
// Returns: callback(err)
```

### 7.6 channels.js

> **Note**: T-PUB8 extended all functions with a `role` parameter (`'viewer'` | `'publisher'`). The signatures below reflect the post-T-PUB8 state.

```javascript
openChannel(campaignId, viewerKey, creatorMx, maxAmount, role, frameId, walletAddr, cb)
// Inserts CHANNEL_STATE (status='pending', role, frame_id, viewer_wallet_addr).
// For role='viewer': calls updateBudget(deduct maxAmount). frameId=''.
// For role='publisher': skips updateBudget; caller increments PUBLISHER_BUDGET_SPENT.
// walletAddr: viewer wallet addr for viewer channels; publisher wallet addr for publisher channels.
// Returns: callback(err)

activateChannel(campaignId, viewerKey, role, channelCoinId, cb)
// Updates CHANNEL_STATE: status='open', channel_coinid=channelCoinId.
// Returns: callback(err, boolean)

getChannelState(campaignId, viewerKey, role, cb)
// Returns: callback(err, ChannelState | null)

updateChannelVoucher(campaignId, viewerKey, role, cumulativeEarned, latestTxHex, cb, rewardType)
// Updates CUMULATIVE_EARNED, LATEST_TX_HEX and LAST_VOUCHER_AT.
// rewardType (optional): when 'click', also bumps LAST_CLICK_VOUCHER_AT so the
//   server-side click cooldown is paced click->click separately from views (N2-2).
// Returns: callback(err, boolean)

getLatestVoucher(campaignId, viewerKey, role, cb)
// Returns: callback(err, { latest_tx_hex, cumulative_earned } | null)

settleChannel(campaignId, viewerKey, role, cb)
// Updates CHANNEL_STATE: status='settled'.
// Returns: callback(err, boolean)
```

### 7.7 frames.js

```javascript
listFrames(cb)
// Returns: callback(err, Frame[])

getFrame(frameId, cb)
// Returns: callback(err, Frame | null)

saveFrame(frame, cb)
// frame: { frame_id, publisher_key, publisher_wallet, label, is_builtin }
// MERGE INTO FRAMES KEY(FRAME_ID).
// Returns: callback(err, boolean)

ensureBuiltinFrame(maximaPk, walletAddr, cb)
// Idempotent — creates 'builtin:<pk>' frame if missing.
// Returns: callback(err, Frame)

incrementFrameEarnings(frameId, amount, cb)
// Adds amount to FRAMES.TOTAL_EARNED.
// Returns: callback(err, boolean)

getFrameEarnings(frameId, cb)
// Returns: callback(err, { total_earned, event_count })
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

**Single mechanism**: on-chain discovery via `NEWBLOCK`.

Every node with the DApp installed registers the ESCROW_SCRIPT at startup and independently tracks all coins at `ESCROW_ADDRESS`.

- On `NEWBLOCK` → SW queries `coins address:<ESCROW_ADDRESS>` → finds coins from all creators
- Each coin has STATE(3)=campaign_id_hex and STATE(4)=creator_permanent_route (MAX#<pk>#<mls> format)
- If campaign is unknown → SW sends `REQUEST_CAMPAIGN_DATA` to creator via `to:<STATE(4)>` (Minima resolves the route via static MLS)
- Creator responds with `CAMPAIGN_DATA_RESPONSE` containing full campaign + ad JSON
- Receiving node persists via `MERGE INTO CAMPAIGNS` + `MERGE INTO ADS`

`CAMPAIGN_ANNOUNCE` is still accepted as inbound message type (backward-compat with older nodes) but is no longer broadcast by the creator on campaign creation.

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
    "publisher_reward_view": 0.005,
    "max_publisher_budget": 100,
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
    "interests": "tech,minima,web3",
    "image_data": "data:image/jpeg;base64,/9j/..."
  },
  "max_viewer_reward": 0.50,
  "cooldown_ms": 300000,
  "platform_key": "0x... or null"
}
```

> `max_viewer_reward` is **optional**. When present and > 0, receiving nodes store it in `CAMPAIGNS.MAX_VIEWER_REWARD` and the SDK uses it as the channel `max_amount` instead of the `(REWARD_VIEW + REWARD_CLICK) × campaign_days` formula. When absent or null, the formula applies (backward-compatible).
>
> `cooldown_ms` is **optional** (default 300 000 ms = 5 min). Receiving nodes store it in `CAMPAIGNS.COOLDOWN_MS`. `validation.js` uses it as the cooldown between rewards for any single viewer — overrides the global `LIMITS.COOLDOWN_BETWEEN_REWARDS_MS`. When absent, the LIMITS fallback applies (backward-compatible).
>
> ⚠️ **`platform_key` — INFORMATIONAL ONLY, NOT AUTHORITATIVE.** This field is populated from the creator's local config and may not match the on-chain `PREVSTATE(5)`. Receivers **must NOT** validate campaign acceptance based on this field. The authoritative fee enforcement check is the on-chain escrow coin's `PREVSTATE(5)` — see Network-side validation rules in §6.3.
>
> `publisher_reward_view` and `max_publisher_budget` are **optional** (default 0). When `publisher_reward_view = 0`, the campaign has no publisher payouts.

### 8.4 Reward Processing — FE-internal (not a Maxima message)

Reward processing (view and click events) is handled entirely within the FE runtime by `core/rewards.js`. There is no Maxima message and no SW handler for this flow.

**Why FE-owned**: FE and SW share the same H2 database via `MDS.sql`. The on-chain KissVM contract is the authoritative security boundary — client-side processing is a performance optimization, not a trust guarantee. SW involvement would require an unspecified cross-runtime mechanism with no security benefit over FE-direct writes.

**FE call chain** (all within `core/rewards.js` callback chain):
1. `isDuplicate(eventId)` → reject if found
2. INSERT into REWARD_EVENTS
3. `updateBudget(campaignId, amount)`
4. UPDATE USER_PROFILE (TOTAL_EARNED, LAST_REWARD_AT)
5. `signalFE('REWARD_CONFIRMED', { event_id, amount, reward_type })`

### 8.5 CAMPAIGN_PAUSE / CAMPAIGN_FINISH / CAMPAIGN_RESUME

**Direction**: Creator FE → all Maxima contacts (via `broadcastMaxima` / `sendall`) — **fast-path only, optional**.

```json
{ "type": "CAMPAIGN_PAUSE",   "campaign_id": "uuid" }
{ "type": "CAMPAIGN_FINISH",  "campaign_id": "uuid" }
{ "type": "CAMPAIGN_RESUME",  "campaign_id": "uuid" }   // DEPRECATED
```

**Authoritative source: ESCROW_SCRIPT_V3 `PREVSTATE(7)` (on-chain)**. See §4.7 and §6.10. These Maxima messages remain accepted as inbound legacy/fast-path notifications so that nodes whose creator is currently in their Maxima contacts list can update their local `CAMPAIGNS.STATUS` row before the next `NEWBLOCK` scan picks up the status-update change coin. They are **not** required for correctness — every receiving node will independently reconcile its local status from `PREVSTATE(7)` on the next escrow scan.

- **CAMPAIGN_PAUSE / CAMPAIGN_FINISH**: optional fast-path. Creator FE may emit these alongside the on-chain status-update tx for snappier propagation to currently-online contacts. Receiving handlers call `setCampaignStatus`; the on-chain reconciliation pass is idempotent against this.
- **CAMPAIGN_RESUME** — **DEPRECATED**. Do not emit. Resume is on-chain only, because the typical resume scenario is "creator's node was offline and now comes back" — in that case Maxima cannot deliver the message to viewers that are currently offline. Use the on-chain status-update tx (§6.10) instead. Existing inbound handlers are retained for backward-compat with older creator nodes.

> Only the campaign creator should broadcast PAUSE/FINISH. There is no creator-identity check at the protocol level; enforcement relies on the creator being the one holding the UI controls and on the authoritative `PREVSTATE(7)` reconciliation that will overwrite any spoofed Maxima broadcast on the next `NEWBLOCK` scan.

### 8.6 REQUEST_CAMPAIGN_DATA

**Direction**: Viewer SW → Creator SW (unicast via `to:<STATE(4)>`)

Sent when a viewer's node detects a new escrow coin but does not have the campaign data locally.
The creator's permanent route is read from the escrow coin's STATE(4) (MAX#<pk>#<mls> format).
Minima resolves the MAX# route through the static MLS to find the creator's current contact address.

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
  "max_amount": 0.66,
  "role": "viewer",
  "frame_id": ""
}
```

> `role` defaults to `"viewer"`. Set to `"publisher"` for publisher channels. `frame_id` is required when `role="publisher"`.

> **Routing semantics (MVP)**: `viewer_mx` is a short-lived contact address hint. Creators may reply to `to:<viewer_mx>` directly if the viewer is in their contacts, or via `publickey:` fallback. Creator permanent route is stored from escrow STATE(4); viewer route discovery follows the same pattern as RequestCampaignData (via liveness checks).

### 8.9 CHANNEL_OPEN

**Direction**: Creator FE → Viewer FE (unicast via `to:<viewer_mx>`, `poll:true`)

Sent after the creator has successfully opened the channel coin on-chain. When resending an existing channel to a viewer that may have lost local state, includes the creator's current `cumulative_earned` and `latest_tx_hex` so the viewer initializes correctly and can resume accrual without delta errors.

```json
{
  "type": "CHANNEL_OPEN",
  "campaign_id": "uuid",
  "viewer_key": "0x...",
  "channel_coinid": "0x...",
  "max_amount": 0.66,
  "cumulative_earned": 0.12,
  "latest_tx_hex": "0x...",
  "role": "viewer",
  "frame_id": ""
}
```

> `cumulative_earned` (optional, default 0) — the creator's current accumulated earnings on this channel. When present, the viewer initializes CHANNEL_STATE with this value to avoid delta validation errors if state was lost.
>
> `latest_tx_hex` (optional, default '') — the creator's last stored partially-signed transaction. When present, the viewer stores it so the channel can be settled even if new vouchers are not immediately issued after reconnection.

### 8.10 REWARD_REQUEST

**Direction**: Viewer FE → Creator FE (unicast via `to:<creator_mx_address>`, `poll:true`)

Sent after each successful `createRewardEvent`. The `cumulative` field is the total earned so far including this event. Idempotent: creator deduplicates by `event_id`.

```json
{
  "type": "REWARD_REQUEST",
  "campaign_id": "uuid",
  "viewer_key": "0x...",
  "event_id": "uuid",
  "cumulative": 0.12,
  "role": "viewer",
  "frame_id": ""
}
```

> `role` defaults to `"viewer"`. Set to `"publisher"` for publisher reward requests. `frame_id` is required when `role="publisher"`.

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
  "tx_hex": "0x...",
  "role": "viewer",
  "frame_id": ""
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

### 8.13 CREATOR_LIVENESS_PING

**Direction**: Viewer SW (periodic) or Viewer SDK (FE) → Creator SW (unicast, **`poll:false`**)

Sent either by the viewer SDK before opening a new payment channel, or periodically by the viewer SW (~every 20 blocks) for each locally-active campaign without an open viewer channel. Uses `poll:false` — a queued ping would cause a false "alive" response when the creator eventually comes back online.

```json
{
  "type": "CREATOR_LIVENESS_PING",
  "campaign_id": "uuid",
  "viewer_mx": "Mx..."
}
```

`viewer_mx` — the sender's own Maxima address. Included so the creator can route the PONG back even when the viewer is not in the creator's Maxima contacts list.

> SDK path: if no `CREATOR_LIVENESS_PONG` arrives within 3 s, the campaign is considered inaccessible and the result is cached for 2 min (`LIVENESS_CACHE_MS`). SW periodic path: PONG arrives asynchronously and syncs local status via `handleCreatorLivenessPong`.

### 8.14 CREATOR_LIVENESS_PONG

**Direction**: Creator SW → Viewer SW (unicast via `publickey:<senderPk>` with `to:<viewer_mx>` fallback, **`poll:false`**)

Sent immediately by the creator's SW upon receiving a `CREATOR_LIVENESS_PING`. Uses `viewer_mx` from the PING payload as the Mx-address fallback so delivery succeeds even when the viewer is not in the creator's contacts. Signals the viewer's SDK that the creator is online and can issue vouchers.

```json
{
  "type": "CREATOR_LIVENESS_PONG",
  "campaign_id": "uuid"
}
```

> The viewer's SW relays this to the FE via `signalFE('CREATOR_LIVENESS_PONG', { campaign_id })`. The SDK resolves the pending liveness callback and caches the result.

### 8.16 REWARD_REJECTED

**Direction**: Creator SW → Viewer node (unicast Maxima, `publickey:` routing, `poll:false`)

**Trigger**: Creator's `handleRewardRequest` rejects a `REWARD_REQUEST` because `campaign.STATUS !== 'active'`.

**Purpose**: Propagates pause/finish status to the viewer without relying on the liveness ping mechanism (which is bypassed once a channel is open). On receiving this message the viewer's SW updates its local campaign status and signals the FE to refresh the SDK liveness cache.

```json
{
  "type": "REWARD_REJECTED",
  "campaign_id": "uuid",
  "reason": "paused | finished",
  "event_id": "uuid-of-rejected-reward-event"
}
```

| Field | Type | Description |
|---|---|---|
| `type` | string | Always `"REWARD_REJECTED"` |
| `campaign_id` | string | Campaign UUID |
| `reason` | string | `"paused"` or `"finished"` — the current campaign STATUS on the creator's node |
| `event_id` | string | *(optional)* ID of the `REWARD_EVENTS` row created on the viewer when the view was tracked. Present when rejection comes from `handleRewardRequest` (open-channel path). Absent when rejection comes from `handleChannelOpen` (channel-open-rejected path). |

**Handler (viewer node)**: `handleRewardRejected(payload)` in `channel.handler.js`

**Effect**:
1. If `event_id` present → deletes the corresponding `REWARD_EVENTS` row (removes optimistic view record that will not be paid)
2. If viewer's local `campaign.STATUS !== reason` → calls `setCampaignStatus(campaignId, reason)`
3. Calls `signalFE("CAMPAIGN_UPDATED", { campaign_id, status: reason })`
4. FE SDK sets `_livenessCache[campaignId] = { alive: false, ts: Date.now() }`
5. Next `getAd()` → `selectAd()` filters out the campaign (`STATUS !== 'active'`)
6. Next `_trackEvent()` → `validateView()` rejects the event

### 8.17 PROFILE_REQUEST

**Direction**: Viewer FE → Creator SW (unicast Maxima, `publickey:` routing, **`poll:false`**)

Sent by the viewer's FE when building the campaign list and the campaign creator is not in the local Maxima contacts. Used to fetch the creator's display name and icon for the viewer list UI. Uses `poll:false` — if the creator is offline the request is silently dropped; the list renders with a letter-based fallback avatar.

```json
{
  "type": "PROFILE_REQUEST"
}
```

**Handler (creator node)**: `handleProfileRequest(payload, senderPk)` in `campaign.handler.js`

**Effect**: Creator's SW calls `maxima action:info` to read its own `name` and `icon`, then sends a `PROFILE_RESPONSE` back to `senderPk`.

---

### 8.18 PROFILE_RESPONSE

**Direction**: Creator SW → Viewer SW (unicast Maxima, `publickey:` routing, **`poll:false`**)

```json
{
  "type": "PROFILE_RESPONSE",
  "publickey": "0x...",
  "name": "Creator display name",
  "icon": "data:image/jpeg;base64,..."
}
```

| Field | Type | Description |
|---|---|---|
| `publickey` | string | Creator's Maxima public key (uppercase) |
| `name` | string | Creator's Maxima display name (empty string if not set) |
| `icon` | string | Creator's avatar as a data URL (empty string if not set) |

**Handler (viewer node)**: `handleProfileResponse(payload)` in `campaign.handler.js`

**Effect**: Viewer's SW signals FE with `PROFILE_RECEIVED { publickey, name, icon }`. FE caches the profile in keypair (`CREATOR_PROFILE_<PK>`) and updates the campaign list row in-place (avatar image + creator name). Cached profiles are reused on subsequent list renders without re-requesting.

### 8.15 SW → FE Signal Contract

| Signal type | Payload | Fired by | Trigger |
|---|---|---|---|
| `DB_READY` | `{}` | `db-init.js` (SW) | All tables created — FE may begin DB access |
| `REWARD_CONFIRMED` | `{ event_id, amount, reward_type }` | `core/rewards.js` (FE) | Successful reward persisted in callback chain |
| `CAMPAIGN_UPDATED` | `{ campaign_id, status, budget_remaining? }` | `campaign.handler.js` / `channel.handler.js` (SW) | Status changed via MA_LOCAL_STATUS, CAMPAIGN_PAUSE/FINISH Maxima, or REWARD_REJECTED |
| `NEW_CAMPAIGN` | `{ campaign_id }` | `campaign.handler.js` (SW) | CAMPAIGN_ANNOUNCE received and persisted |
| `CHANNEL_OPENED` | `{ campaign_id, channel_coinid, max_amount }` | `channel.handler.js` (SW) | Channel coin confirmed on-chain, viewer can earn |
| `VOUCHER_RECEIVED` | `{ campaign_id, cumulative }` | `channel.handler.js` (SW) | New REWARD_VOUCHER stored; viewer balance updated |
| `AUTO_SETTLE` | `{ campaign_id, viewer_key, role, tx_hex, cumulative }` | `channel.handler.js` (SW) | Campaign finished — viewer should post settlement tx |
| `CAMPAIGN_AUTOSETTLE_REQUEST` | `{ campaign_id, channels: [{ viewer_key, role, tx_hex, cumulative }…] }` | `channel.handler.js` (SW) | Creator campaign finished — mark channels settling and request creator to post settlement txs |
| `SETTLE_CONFIRMED` | `{ campaign_id, amount }` | `channel.handler.js` (FE) | Settlement tx posted successfully |
| `DO_CHANNEL_OPEN` | `{ campaign_id, viewer_key, viewer_mx, max_amount }` | `channel.handler.js` (SW) | Creator FE creates channel coin on-chain |
| `DO_REWARD_VOUCHER` | `{ campaign_id, viewer_key, viewer_mx, event_id, cumulative }` | `channel.handler.js` (SW) | Creator FE builds partial tx and sends REWARD_VOUCHER |
| `DO_SEND_VOUCHER` | `{ campaign_id, viewer_key, viewer_mx, cumulative, tx_hex }` | `channel.handler.js` (SW) | Creator FE re-sends REWARD_VOUCHER (reconnect sync) |
| `DO_RESEND_CHANNEL_OPEN` | `{ campaign_id, viewer_key, viewer_mx, channel_coinid, max_amount }` | `channel.handler.js` (SW) | Creator FE re-sends CHANNEL_OPEN when no voucher issued yet |
| `FRAME_READY` | `{ frame_id, is_builtin }` | `service.js` (SW) | Built-in frame ensured at init — SDK can resolve default frameId |
| `FRAME_CREATED` | `{ frame_id, label }` | `dapp/views/frames.js` (FE) | New frame persisted — refresh frame list |
| `PUBLISHER_REWARD_CONFIRMED` | `{ event_id, amount, frame_id, campaign_id }` | `core/rewards.js` (FE) | Publisher reward persisted — update Frame earnings UI |
| `DO_PUBLISHER_CHANNEL_OPEN` | `{ campaign_id, publisher_key, publisher_mx, frame_id, max_amount }` | `channel.handler.js` (SW) | Creator FE creates publisher channel coin on-chain |
| `DO_PUBLISHER_REWARD_VOUCHER` | `{ campaign_id, publisher_key, publisher_mx, frame_id, event_id, cumulative }` | `channel.handler.js` (SW) | Creator FE builds publisher voucher tx and sends REWARD_VOUCHER |
| `CREATOR_LIVENESS_PONG` | `{ campaign_id }` | `campaign.handler.js` (SW) | CREATOR_LIVENESS_PONG received — SDK resolves pending liveness check |
| `STATUS_TX_PENDING` | `{ campaign_id, status, pending_uid }` | `dapp/views/mycampaigns.js` (FE) | Status-change tx awaiting Hub approval — UI shows "awaiting confirmation" until the V3 change coin is confirmed on-chain |
| `PROFILE_RECEIVED` | `{ publickey, name, icon }` | `campaign.handler.js` (SW) | PROFILE_RESPONSE received — viewer FE updates creator avatar/name in campaign list |

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

File: `service.js`

```javascript
var APP_NAME = 'minima-ads';

var LIMITS = {
  MAX_VIEWS_PER_CAMPAIGN_PER_DAY:  100,
  MAX_CLICKS_PER_CAMPAIGN_PER_DAY: 100,
  COOLDOWN_BETWEEN_REWARDS_MS:     30000,
  MIN_VIEW_DURATION_MS:            3000,
  MAX_CAMPAIGNS_PER_SESSION:       10,
  MIN_BUDGET:                      100,
  MIN_REWARD_VIEW:                 0.001,
  MIN_REWARD_CLICK:                0.001,
  MIN_PUBLISHER_REWARD_VIEW:       0.01,
  MAX_CAMPAIGN_DAYS:               90
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
| `CAMPAIGN_RESUME` | `campaign.handler.js` | UPDATE CAMPAIGNS STATUS='active' | `CAMPAIGN_UPDATED` |
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
    frames.js         # Frame management UI (list, create, view earnings per frame)

/core
  campaigns.js        # Campaign CRUD, budget tracking
  selection.js        # Ad selection algorithm (selectAd)
  validation.js       # View/click validation, LIMITS enforcement, dedup
  rewards.js          # RewardEvent creation, USER_PROFILE updates
  channels.js         # CHANNEL_STATE CRUD, channel lifecycle management
  frames.js           # FRAMES CRUD, builtin frame ensure, earnings tracking
  minima.js           # MDS.sql wrapper, Maxima sender, FE signaller

/sdk
  index.js            # Public API: init, getAd, render, trackView, trackClick

/renderer
  renderAd.js         # Renders one ad unit into a DOM container element

config.js             # Shared constants — PLATFORM_KEY, APP_NAME, MINIMAADS_CREATOR_PK (loaded first by SW + FE)
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

Publisher Frames generate a self-contained copy-paste snippet. Paste it anywhere
in your MiniDapp's HTML — it requires no external dependencies or setup calls.

The generated snippet:
1. Defines a `<div id="minimaads-slot">` for ad rendering
2. Patches `window.MDS.init` to intercept `inited` and `MDSCOMMS` events
3. Sends `MA_GET_AD` to the host MiniDapp's Service Worker (via `MDS.comms.broadcast`)
4. Receives `MA_AD_RESPONSE` with the ad object
5. Renders the ad into the slot using inline CSS
6. Waits 3 seconds, then sends `MA_TRACK_VIEW` to record the view event
7. Handles click events by calling `MA_TRACK_CLICK`

**How it works**: The snippet intercepts MDS comms messages between the publisher iframe
and the host MiniDapp. The host MiniDapp's Service Worker must handle `MA_GET_AD`,
`MA_TRACK_VIEW`, and `MA_TRACK_CLICK` messages and forward them to the MinimaAds
Service Worker. The MinimaAds Service Worker then queries the local CAMPAIGNS table
(populated by on-chain discovery — see §8.1) and responds with an ad object or a
not-found signal.

**Important**: Campaign discovery is a **Service Worker responsibility**, not an SDK call.
The MinimaAds Service Worker automatically scans escrow coins on each NEWBLOCK and sends
`REQUEST_CAMPAIGN_DATA` to campaign creators. Campaign data is persisted locally and made
available to publishers via the snippet. The SDK (`getAd`) reads from this pre-populated
CAMPAIGNS table — it does not perform discovery itself.

### 13.2 SDK API Reference

All SDK functions are callback-based, matching the Core API pattern (§7.5). This keeps the SDK usable from any runtime — including Rhino — without polyfills.

```javascript
MinimaAds.init(config, cb)
// config:   { wallet: string, interests?: string, frameId?: string, publisher_id?: string,
//             mdsAlreadyInitialized?: boolean, externalMdsInit?: boolean, skipMdsInit?: boolean }
// cb:       function(err, ok)
//
// frameId behavior:
//   - If omitted: SDK uses the built-in frame ('builtin:' + node Maxima PK).
//   - If provided: SDK validates the frame exists in local FRAMES table.
//     If missing: cb(new Error('UNKNOWN_FRAME')) and abort.
//   - The frameId is attached to every REWARD_EVENTS.PUBLISHER_ID and is used to
//     trigger publisher REWARD_REQUEST when campaign.PUBLISHER_REWARD_VIEW > 0.
//
// publisher_id is the LEGACY field name (kept for backward compat); when frameId
// is provided it overrides publisher_id.
//
// Stores config and calls MDS.init unless the host MiniDapp already owns MDS.init.
// If mdsAlreadyInitialized/externalMdsInit/skipMdsInit is true, the host must
// forward MDS events to MinimaAds.handleMdsEvent(msg).

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

MinimaAds.handleMdsEvent(msg)
// Optional host bridge for React/Vite/TypeScript MiniDapps that already call
// MDS.init. Handles MinimaAds MAXIMA messages and MDSCOMMS channel signals.
```

### 13.3 Publisher Responsibilities

The publisher must only:
1. Call `MinimaAds.init({ wallet }, cb)`
2. Define an HTML element for the ad slot
3. Call `MinimaAds.getAd(userAddress, interests, cb)` then `MinimaAds.render(ad, containerId)`
4. Wire a view timer (≥ `MIN_VIEW_DURATION_MS`) before calling `trackView`
5. If the host already owns `MDS.init`, call `MinimaAds.init({ frameId, mdsAlreadyInitialized:true }, cb)` and dispatch each MDS callback message to `MinimaAds.handleMdsEvent(msg)`

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
| Platform fee collection wallet | **Defined — see §4.6 and Appendix B.2** | PLATFORM_KEY embedded in KissVM escrow; `null` for MVP (fee enforcement disabled) |
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

### B.2 Script (V2, legacy)

> **Status**: legacy. Used by campaigns created before T-SC1. New campaigns use the V3 script (§B.2.1). Both scripts coexist; the SW registers both addresses and scans coins at each.

```
LET creatorkey = PREVSTATE(1)
LET platformkey = PREVSTATE(5)
ASSERT SIGNEDBY(creatorkey)

LET payout = STATE(10)
LET feeflag = STATE(11)
LET change = @AMOUNT - payout

IF feeflag EQ 1 THEN
    LET feeamount = STATE(12)
    ASSERT VERIFYOUT(STATE(13) platformkey feeamount @TOKENID FALSE)
ENDIF

IF change GT 0 THEN
    ASSERT VERIFYOUT(INC(@INPUT) @ADDRESS change @TOKENID TRUE)
ENDIF

RETURN TRUE
```

**What this enforces**:
- Only the creator (wallet signing key in PREVSTATE(1)) can spend this coin
- When `STATE(11) = 1` (fee branch): the tx must include an output paying `STATE(12)` MINIMA to `platformkey` (PREVSTATE(5)) at output index `STATE(13)`. Any other fee recipient → tx rejected on-chain.
- If partial spend (change > 0): change MUST return to `@ADDRESS` (same script address) with `keepstate:true`
- Full spend (change = 0): allowed — used for campaign close / full refund
- Channel-open txs set `STATE(11) = 0` — fee branch skipped

When `PLATFORM_KEY = null` in `config.js`: campaign launch tx sets PREVSTATE(5) = `0x00` and STATE(11) = 0. The fee assertion never fires. This is the MVP default.

This script replaces the previous V1 script. The address is persisted as `ESCROW_ADDRESS_V2` in keypair to avoid clobbering V1 (used by campaigns created before T-PUB4).

### B.2.1 Script (V3, current — on-chain campaign status)

V3 introduces an on-chain campaign status variable at `PREVSTATE(7)` / `STATE(7)`. The script reads it but does **not** assert on its value — enforcement of "no rewards on non-active campaigns" lives in the SW handlers (`selectAd`, `validateView`/`validateClick`, `handleRewardRequest`). See §4.7 and §6.10.

```
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
```

**Differences from V2**:
- Adds three `LET` reads with no `ASSERT` against their values: `platformkey = PREVSTATE(5)` (already present in V2 — kept verbatim), `maxpubbudget = PREVSTATE(6)`, and `status = PREVSTATE(7)`. The `maxpubbudget` and `status` reads are **no-ops with respect to script semantics** — they exist purely to make the V3 script byte-different from V2 so that `newscript` yields a new address (`ESCROW_ADDRESS_V3`), distinct from `ESCROW_ADDRESS_V2`.
- All enforcement (signer, fee branch, change to same address) is identical to V2. A spend that would succeed under V2 succeeds under V3 with the same inputs/outputs.

**What this enforces** (same as V2):
- Only the creator (wallet signing key in PREVSTATE(1)) can spend this coin.
- When `STATE(11) = 1` (fee branch): the tx must include an output paying `STATE(12)` MINIMA to `platformkey` (PREVSTATE(5)) at output index `STATE(13)`. Any other fee recipient → tx rejected on-chain.
- If partial spend (change > 0): change MUST return to `@ADDRESS` (same script address) with `keepstate:true`.
- Full spend (change = 0): allowed — used for campaign close / full refund.

**What this does NOT enforce**:
- `STATE(7)` is read but never asserted. The script will sign any value (`"active"`, `"paused"`, `"finished"`, or any other hex). Status is enforced **off-chain** by the SW (selectAd, validateView/validateClick, handleRewardRequest reject when `STATUS !== 'active'`). The on-chain mechanism is a propagation channel, not a security boundary — the security boundary remains "only the creator can spend the escrow" (`SIGNEDBY(creatorkey)`).
- The script does not constrain `STATE(7)` to be one of the three valid values. Receiving nodes treat unknown values as `'paused'` for safety.
- `PREVSTATE(6)` (max publisher budget) is read but not enforced — kept for future use and audit visibility.

**Registration**: register once per install via `newscript script:"<V3 script>" trackall:true` and persist the returned address as `ESCROW_ADDRESS_V3` in keypair. V2 and V3 addresses coexist; the SW scans coins at both addresses on every `NEWBLOCK` until V2 campaigns are fully settled out.

### B.3 State Variables

| Port | Read by | Value | Type | Purpose |
|---|---|---|---|---|
| 1 | `PREVSTATE(1)` | Creator wallet public key | `0x` hex (64 chars) | Required signer — frozen at coin creation |
| 2 | `PREVSTATE(2)` | Campaign expiry block | integer string | UI reference; not enforced by script |
| 3 | `PREVSTATE(3)` | Campaign ID (hex-encoded UTF-8) | `0x` hex | Links on-chain coin to H2 campaign record |
| 4 | `PREVSTATE(4)` | Creator Mx address | `Mx...` string | Enables on-chain discovery: viewer nodes send REQUEST_CAMPAIGN_DATA to this address |
| **5** | `PREVSTATE(5)` | **PLATFORM_KEY** | `0x` hex or `0x00` | Fee recipient — validated by network; `0x00` = fee disabled (MVP) |
| **6** | `PREVSTATE(6)` | Max publisher budget | number string | Bound on cumulative publisher payouts; for on-chain audit |
| **7** | `PREVSTATE(7)` | Campaign status (V3 only) | hex string — UTF-8 of `"active"` / `"paused"` / `"finished"` | Read by DISCOVERY on every node — propagates pause/finish without creator online. V1/V2 coins have no port 7. |
| **7** | `STATE(7)` | New status set by spending tx (V3 only) | hex string — same encoding as PREVSTATE(7) | Set on the status-update tx (§6.10, B.5); passed through unchanged on channel-open and partial-refund spends. |
| 10 | `STATE(10)` | Payout amount (set in spending tx) | number string | Used by script to compute required change |
| **11** | `STATE(11)` | Fee flag (0 \| 1) | integer string | When 1: triggers PLATFORM_KEY fee output assertion |
| **12** | `STATE(12)` | Fee amount | number string | Asserted in fee output when feeflag=1 |
| **13** | `STATE(13)` | Fee output index | integer string | Which tx output carries the platform fee |

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
    var walletPK = keysRes.response.publickey; // shape verified: no .key wrapper (keys.java KeyRow.toJSON)
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
txnoutput id:<txnid> storestate:true  amount:<max_per_viewer> address:<CHANNEL_SCRIPT_ADDRESS>
txnoutput id:<txnid> storestate:true  amount:<remaining>     address:<ESCROW_ADDRESS>
txnstate  id:<txnid> port:1  value:<creator_wallet_pk>
txnstate  id:<txnid> port:2  value:<viewer_wallet_pk>
txnstate  id:<txnid> port:3  value:<campaign_id_hex>
txnstate  id:<txnid> port:4  value:<creator_mx_address>
txnstate  id:<txnid> port:5  value:<platform_key_or_0x00>
txnstate  id:<txnid> port:6  value:<max_pub_budget_or_0>
txnstate  id:<txnid> port:7  value:<current_status_hex>
txnstate  id:<txnid> port:10 value:<max_per_viewer>
txnstate  id:<txnid> port:11 value:0
txnsign   id:<txnid> publickey:<creator_wallet_pk>
txnpost   id:<txnid> mine:true
txndelete id:<txnid>
```

Notes:
- `STATE(10)` = `max_per_viewer` → script sees `change = @AMOUNT - max_per_viewer` → verifies output[1] returns to `@ADDRESS`
- Output[0] goes to `CHANNEL_SCRIPT_ADDRESS` — the script does not constrain this output
- After posting: update `CAMPAIGNS.ESCROW_COINID` to new change coinid; save channel coinid in `CHANNEL_STATE.CHANNEL_COINID`
- **V3 only — port:7 passthrough**: `STATE(7)` MUST be set to the current `PREVSTATE(7)` of the spent escrow coin (or the UTF-8-hex of `"active"` for newly-created V3 campaigns that have not been paused). This preserves the on-chain status on the change coin so other nodes' NEWBLOCK scans continue to read the correct status. Ports 5, 6, 11 are similarly carried forward unchanged. V2 spends omit ports 5, 6, 7 (V2 fee path is controlled by STATE(11) alone).

#### Status Update Transaction (V3 only)

Used when the creator changes a campaign's status (Pause / Resume / Finish — see §6.10). Spends the current V3 escrow coin in full and outputs the same amount back to `ESCROW_ADDRESS_V3` with the new `STATE(7)`.

```
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
txnpost   id:<txnid> mine:true auto:false
txndelete id:<txnid>
```

Notes:
- `STATE(10) = 0` so the V3 script reads `payout = 0` → `change = @AMOUNT - 0 = @AMOUNT > 0` → the `IF change GT 0` branch fires and asserts that the change output goes back to `@ADDRESS` (= `ESCROW_ADDRESS_V3`) with `keepstate:true`. The single output[0] satisfies this assertion.
- `STATE(11) = 0` so the fee branch is skipped — no fee output is required.
- `STATE(7) = <new_status_hex>` is the UTF-8 hex of `"active"`, `"paused"` or `"finished"`. The script reads it (`LET status = PREVSTATE(7)`) but does not assert on its value — see §B.2.1.
- Ports 1, 3, 4, 5, 6 are carried forward unchanged from the prior coin's `PREVSTATE` values so the new change coin remains discoverable and validates against the receiving node's `PLATFORM_KEY` check.
- After confirmation: update `CAMPAIGNS.ESCROW_COINID` to the new change coinid on the creator's node (the existing `processEscrowCoin` discovery path also handles this on every other node). The status-tx-pending marker (FE-only) is cleared on `CAMPAIGN_UPDATED` signal for this campaign.

#### Campaign Close / Refund

Creator sends the full remaining balance back to their own wallet address. Set `STATE(10) = @AMOUNT` (full amount = no change):

```
txncreate id:<txnid>
txninput  id:<txnid> coinid:<ESCROW_COINID> scriptmmr:true
txnoutput id:<txnid> storestate:false amount:<remaining> address:<creator_wallet_address>
txnstate  id:<txnid> port:10 value:<remaining>
txnsign   id:<txnid> publickey:<wallet_pubkey>
txnpost   id:<txnid> mine:true
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
| Status survives creator offline | ✅ (V3 only) | Campaign status lives in `PREVSTATE(7)`; all nodes reconcile from chain on NEWBLOCK. V1/V2 still require creator-online Maxima broadcasts (§8.5) to propagate pause/finish. |
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
txnpost   id:<txnid>
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

The ad unit rendered by `renderer/renderAd.js` is a **fluid responsive banner** with two layout modes selected automatically based on the container's rendered width at render time (`container.offsetWidth`):

**Desktop layout (container ≥ 480 px)**
- Row: image column (left, `IMAGE_WIDTH_PCT`% wide, default 40%) + text block (right, fills remaining space)
- Banner height: `min-height: 80px; max-height: 160px`; image fills column via `object-fit: cover`
- Text block font size scales with column width (`baseFs` formula: `clamp(0.70rem, (100−imgWidthPct)/60×0.9, 0.95rem)`)
- Creator can drag a divider to adjust `IMAGE_WIDTH_PCT` (20–70%)

**Mobile layout (container < 480 px) — with image**
- Image only, full width, fixed `height: 140px`, `object-fit: cover`
- Tapping the image navigates to `cta_url` (CTA button is not rendered)
- Note: the 480 px threshold is the **container width**, not a device breakpoint. A slot inside a 500 px panel will always use the desktop layout even on a phone.

**Mobile layout (container < 480 px) — without image**
- Text column only, no height cap, content flows naturally

```
Desktop (≥480px):               Mobile (<480px, with image):
┌──────────┬──────────────────┐  ┌────────────────────────────┐
│          │ Title            │  │                            │
│  image   │ Body text…       │  │        [image only]        │
│ (40%+)   │ [Visit →]        │  │        (tappable)          │
└──────────┴──────────────────┘  └────────────────────────────┘
 min 80px / max 160px              fixed 140px
```

**Ad fields rendered:** `title` (if `show_title`), `body` (if `show_body`), `cta_label`/`cta_url` (if `show_cta`), `bg_color`, `text_color`, `image_data`, `image_position` (focal point), `image_width_pct` (desktop only), `image_zoom` (always 1.0 — UI removed, field kept for backward compat).

- Banner capped at `max-width: 600px`; fully self-contained inline styles (no Pico CSS dependency)
- Recommended image size: **600×300 px** (ratio 2:1). Max 55 KB after JPEG compression.
- Image source: JPEG data URI compressed by creator (`canvas.toDataURL('image/jpeg', 0.7)`) and transmitted in `CAMPAIGN_ANNOUNCE` / `CAMPAIGN_DATA_RESPONSE`.

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
- On submit: escrow creation flow (on-chain discovery propagates campaign automatically)
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
