# MinimaAds

A decentralised advertising network built as a Minima MiniDapp.

Advertisers lock budget in a KissVM on-chain escrow and broadcast campaigns peer-to-peer via Maxima. Viewers earn Minima rewards for genuine ad interactions. No central server. No trusted intermediary.

---

## How it works

1. **Advertiser** creates a campaign, locks budget in a KissVM escrow, and broadcasts it to the network via Maxima
2. **Viewer** receives campaigns, sees ads, earns Minima per view and per click
3. **Publisher** integrates the SDK into their MiniDapp to display ads and forward events
4. **Budget** is verifiable on-chain at all times — no trust required

---

## Requirements

- Minima node v1.0.45 or later
- MiniDapp installed on your node

---

## Installation

1. Download the latest `.mds` package from [Releases](https://github.com/joanramonraluy/MinimaAds/releases)
2. Open your Minima node MiniDapp hub
3. Install the `.mds` file
4. MinimaAds will initialise its database automatically on first run

---

## Project Structure

```
/core                   Business logic (no DOM, no direct DB access)
  campaigns.js          Campaign CRUD and budget tracking
  selection.js          Ad selection algorithm (synchronous)
  validation.js         View/click validation and deduplication
  rewards.js            Reward event creation and user profile updates
  minima.js             Platform bridge: sqlQuery, broadcastMaxima, signalFE

/sdk
  index.js              Public API for publisher integration

/renderer
  renderAd.js           Renders one ad unit into a DOM container

/dapp                   MiniDapp frontend
  app.js                Entry point: MDS.init, routing, event dispatch
  /views
    creator.js          Campaign creation UI
    viewer.js           Ad display and reward UI
    stats.js            Campaign statistics UI

/public
  index.html            MiniDapp shell
  dapp.conf             Minima MiniDapp manifest
  /service-workers
    main.js             Service Worker entry point
    db-init.js          H2 database schema initialisation
    /handlers
      maxima.handler.js   Routes inbound Maxima messages by type
      campaign.handler.js Handles CAMPAIGN_ANNOUNCE / PAUSE / FINISH
```

---

## SDK Integration

Publishers can integrate MinimaAds into any MiniDapp:

```javascript
MinimaAds.init({ publisherId: 'your-node-address' }, function() {
    MinimaAds.getAd(userAddress, ['tech', 'defi'], function(ad) {
        if (ad) {
            MinimaAds.render(ad, 'ad-container');
            MinimaAds.trackView(ad.campaign_id, userAddress, function() {});
        }
    });
});
```

---

## Technical Stack

| Layer | Technology |
|---|---|
| Runtime | Minima MiniDapp (MDS) |
| Language | Vanilla JavaScript — no frameworks, no build step |
| Storage | H2 via MDS.sql |
| Messaging | Maxima P2P via MDS.cmd |
| Smart contracts | KissVM (budget escrow) |
| Styling | Pico CSS (CDN) |

---

## License

GNU General Public License v3.0 — see [LICENSE](LICENSE) for details.

Any derivative work must also be released under GPL v3.
