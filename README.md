# MinimaAds

A decentralised advertising network built as a Minima MiniDapp.

Advertisers lock budget in a KissVM on-chain escrow and broadcast campaigns peer-to-peer via Maxima. Viewers earn Minima rewards for genuine ad interactions. Publishers integrate an SDK to display ads and forward reward events. All budget and rewards are verifiable on-chain — no central server, no trusted intermediary.

---

## How It Works

### 1. Campaign Creation (Creator Node)
- Creator locks Minima budget in a KissVM escrow coin via `newscript` (global, per-node)
- Escrow coin is discoverable on-chain: viewers scan `ESCROW_ADDRESS` via `coins` command
- Creator broadcasts campaign metadata via Maxima (CAMPAIGN_ANNOUNCE)
- Status changes (pause/finish) propagate either via Maxima or on-chain state (V3 coins carry status in PREVSTATE(7))

### 2. Ad Display & Viewer Rewards (Viewer/Publisher Node)
- Viewer node (or embedded Frame in a publisher's MiniDapp) fetches available campaigns
- Publisher SDK calls `MinimaAds.getAd(userAddress, interests, frameId, callback)`
- Selected ad is rendered via `renderAd.js` into a DOM container
- On view/click event, publish `MA_TRACK_VIEW` / `MA_TRACK_CLICK` to creator via Maxima
- Creator validates reward eligibility (budget, daily limits, cooldown) in SW, creates `REWARD_EVENT` record

### 3. Payment Channels & Settlement (Creator ↔ Viewer)
- Creator opens a **payment channel** per viewer (per campaign) with `CHANNEL_OPEN_REQUEST`
- Channel is an on-chain KissVM coin with cumulative reward tracking
- Creator periodically builds partial spending transactions (REWARD_VOUCHER) signing with their wallet key
- Viewer co-signs and posts to L1 to settle accumulated rewards
- Both parties' coins are immediately `sendable` at coinbase addresses (no locked coins)

### 4. Publisher Rewards (Creator → Publisher)
- When a viewer in a custom Frame (e.g., Frame ID `'my-news-site'`) generates a reward, creator also generates a **publisher reward**
- Publisher channel operates identically to viewer channel: creator sends REWARD_VOUCHER, publisher settles
- Built-in Frame (integrated MinimaAds viewer) rewards go to the platform creator (MINIMAADS_CREATOR_PK) on every node
- Custom Frames reward their registering publisher node

---

## Key Concepts

### On-Chain vs Off-Chain

| Layer | Storage | Guarantee |
|---|---|---|
| **On-Chain (L1)** | KissVM escrow coin, channel coins, settlement txs | Immutable; validated by entire Minima network |
| **Off-Chain (H2 DB)** | Campaign metadata, reward events, channel state | Auditable against on-chain coins; single-node authority |

Budget and settlement are on-chain. Campaign discovery and reward attribution are off-chain, auditable.

### Maxima P2P Messaging

- `CAMPAIGN_ANNOUNCE`: Creator broadcasts campaign details to network
- `CAMPAIGN_PAUSE` / `CAMPAIGN_FINISH`: Creator notifies viewers of status change (fallback to on-chain state for V3 coins)
- `REQUEST_CAMPAIGN_DATA`: Viewer requests campaign details from creator (fallback to on-chain discovery)
- `CAMPAIGN_DATA_RESPONSE`: Creator sends full campaign object
- `CHANNEL_OPEN_REQUEST`: Viewer requests a payment channel from creator
- `REWARD_REQUEST`: Viewer/publisher requests reward for their node
- `REWARD_VOUCHER`: Creator sends partial spending tx for viewer/publisher to co-sign and post

### Frame ID Model

- **Built-in Frame**: `'builtin:' + MINIMAADS_CREATOR_PK.toUpperCase()`
  - Owned by platform creator across all nodes
  - All rewards from built-in viewer go to platform creator
- **Custom Frames**: Publisher-chosen string (e.g., `'my-news-site'`)
  - Owned by the node that registered it
  - Rewards attributed to that frame's publisher

---

## SDK Integration

Publishers embed MinimaAds into their MiniDapp using the public SDK:

```javascript
// Initialize with a Frame ID (built-in or custom)
MinimaAds.init({ 
  frameId: 'builtin:0x...' OR 'my-custom-frame',  // Built-in or custom Frame
  mdsAlreadyInitialized: false  // Set true if host MiniDapp already owns MDS.init
}, function(err) {
  if (err) console.error('MinimaAds init failed:', err);
  
  // Fetch an ad suitable for this user
  MinimaAds.getAd(userAddress, ['tech', 'defi'], function(err, ad) {
    if (!err && ad) {
      // Render the ad into a container
      MinimaAds.render(ad, 'ad-container-id');
      
      // Track view (fire-and-forget; SW handles persistence)
      MinimaAds.trackView(ad.campaign_id, userAddress, function() {});
      
      // Track click (when user clicks the CTA)
      MinimaAds.trackClick(ad.campaign_id, userAddress, function() {});
    }
  });
});
```

### SDK API

| Method | Purpose |
|---|---|
| `MinimaAds.init(options, cb)` | Initialize SDK, set up DB sync and event listeners |
| `MinimaAds.getAd(userAddress, interests, frameId, cb)` | Get a single ad matching user interests and creator liveness check |
| `MinimaAds.render(ad, containerId)` | Render ad into a DOM container (responsive banner) |
| `MinimaAds.trackView(campaignId, userAddress, cb)` | Record view event (server-side validation) |
| `MinimaAds.trackClick(campaignId, userAddress, cb)` | Record click event (server-side validation) |
| `MinimaAds.getUserRewards(userAddress, cb)` | Fetch user's earned Minima and reward history |

---

## Project Structure

```
/core                          Business logic (no DOM, no MDS direct access)
  campaigns.js                 Campaign CRUD, escrow coin tracking, budget updates
  channels.js                  Payment channel operations (open, voucher, settle)
  frames.js                    Publisher Frame CRUD and earnings aggregation
  selection.js                 Ad selection algorithm (synchronous, creator-filtering)
  validation.js                View/click validation, daily limits, deduplication
  rewards.js                   Reward event creation, user profile updates
  minima.js                    Platform bridge: sqlQuery, broadcastMaxima, signalFE

/sdk
  index.js                     Public API for publisher integration

/renderer
  renderAd.js                  Renders a single ad unit into a DOM container
  
/dapp                          MiniDapp frontend
  app.js                       Entry point: MDS.init, routing, event dispatch, signal handlers
  /views
    creator.js                 Campaign creation form and management UI
    viewer.js                  Ad display and viewer earnings UI
    stats.js                   Campaign statistics and interaction timeline
    earnings.js                Viewer/publisher earnings, settlement history, pending channels
    frames.js                  Custom Frame management and publisher earnings dashboard

/public
  index.html                   MiniDapp shell, stylesheets, CDN links
  dapp.conf                    Minima MiniDapp manifest (version, name, icon)
  /service-workers
    service.js                 Service Worker entry point, MDS.init, event loop
    db-init.js                 H2 database schema (CAMPAIGNS, CHANNEL_STATE, REWARD_EVENTS, etc.)
    /handlers
      maxima.handler.js        Routes inbound Maxima messages by type
      campaign.handler.js      Handles CAMPAIGN_ANNOUNCE/PAUSE/FINISH; on-chain status sync
      channel.handler.js       Handles CHANNEL_OPEN_REQUEST; manages voucher queue and deferred rewards
      comms.handler.js         Handles publisher Maxima routing for REWARD_REQUEST/REWARD_VOUCHER

/docs
  DOCUMENTATION_INDEX.md       Navigation guide for all documentation
  KNOWN_ISSUES.md              Fragility points, open bugs, known gotchas
  PLATFORM_NOTES.md            Minima platform constraints (H2, Rhino, MDS, Maxima)
  PROJECT_NOTES_REFERENCE.md   Protocol matrix, Maxima message schemas, handler flow
  HISTORY.md                   Archived handoff notes from past sessions
  TASKS.md                     Implementation task list (all tasks completed, v0.26.6+)
  /archive                     Historical documentation (UI guides, roadmaps, audit reports, old tasks)
```

---

## Installation

### End User (Viewer/Publisher)
1. Download the latest `.mds` package from [Releases](https://github.com/joanramonraluy/MinimaAds/releases)
2. Open your Minima node MiniDapp hub
3. Install the `.mds` file
4. MinimaAds will initialize its database automatically on first run

### Developer (Contributing to MinimaAds)
1. Clone this repository
2. Read `CLAUDE.md` (agent workflow guide) and `docs/DOCUMENTATION_INDEX.md` (docs menu)
3. For backend/protocol tasks: read `MinimaAds.md` (spec) and `AGENTS.md` (key decisions)
4. For UI tasks: see `docs/archive/UI_GUIDE.md` for conventions (historical)
5. Open a task from `docs/TASKS.md` or create a new issue

---

## Technical Stack

| Layer | Technology |
|---|---|
| **Runtime** | Minima MiniDapp (MDS) |
| **Language** | Vanilla JavaScript — no frameworks, no build step |
| **Storage** | H2 database (local, per node) via MDS.sql |
| **Messaging** | Maxima P2P (peer-to-peer, encrypted) via MDS.cmd |
| **Smart Contracts** | KissVM (Minima's contract language; escrow + channel validation) |
| **Styling** | Pico CSS (minimal, classless, via CDN) |
| **Sanitization** | DOMPurify (XSS protection for ad content) |

---

## Architecture Decisions

For detailed rationale behind key design choices, see `AGENTS.md` §4 (Key Decisions). Notable patterns:

- **Reward processing is FE-owned, not SW**: FE and SW share the same H2 DB; keeping logic centralized in FE avoids sync bugs
- **On-chain discovery via PREVSTATE**: Campaigns are discoverable without Maxima (resilient to peer absence)
- **Payment channels separate from escrow**: Escrow is global (shared); channels are per-viewer (isolated payout tracking)
- **Publisher rewards use same channel infra**: `CHANNEL_STATE` PK is `(campaign_id, viewer_key, role)` — viewer + publisher coexist with `ROLE` discriminator
- **`CREATOR_ADDRESS` is Maxima PK, not wallet address**: Maxima PK is stable node identity; wallet address can change

---

## Limitations (MVP)

- **Single-node authority**: Each node maintains its own H2 copy; no cross-node consensus except on-chain
- **Creator must be reachable**: Viewers send Maxima requests; offline creators cannot respond (campaigns pause/finish status syncs via on-chain V3 coins as fallback)
- **Budget floor not enforced per reward**: Channel MAX_AMOUNT is on-chain cap; individual reward budget is off-chain validated only
- **No reputation system**: Any Maxima address can be a creator or publisher; future: identity/trust layer

---

## License

GNU General Public License v3.0 — see [LICENSE](LICENSE) for details.

Any derivative work must also be released under GPL v3.
