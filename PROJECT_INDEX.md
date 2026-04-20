# MinimaAds — Project Index

> Navigation guide for humans and agents.
> Read this first. Then read the document(s) relevant to your task.

---

## 1) What Is This Project?

**MinimaAds** is a decentralised advertising network built as a Minima MiniDapp. Advertisers lock budget in a KissVM on-chain escrow and broadcast campaigns via Maxima P2P. Viewers earn Minima rewards for genuine ad interactions. No central server. No trusted intermediary.

- Platform: Minima MiniDapp (MDS runtime)
- Language: Vanilla JavaScript — no frameworks, no build step
- Storage: H2 via `MDS.sql`
- Messaging: Maxima P2P via `MDS.cmd`
- Smart contracts: KissVM (budget escrow only)

---

## 2) Document Map

| File | Purpose | Read when… |
|---|---|---|
| **`MinimaAds.md`** | Full system specification — data models, flows, API contracts, KissVM escrow, security | Starting any task; source of truth on all behaviour |
| **`AGENTS.md`** | Engineering guide — H2 quirks, Rhino constraints, Maxima patterns, DB schema, protocol matrix, fragility points | Writing any code; resolving platform doubts |
| **`CLAUDE.md`** | Operational guide for Claude agents — task workflow, forbidden actions, lookup table | Agent sessions; before writing a single line |
| **`PROJECT_INDEX.md`** | This file — navigation, folder map, entry points, pending tasks, playbooks | Project orientation; planning next steps |
| **`PromptBase.md`** | First prompt for a new implementation agent session | Starting a new implementation session |
| **`TASKS.md`** | Ordered implementation task list (T1–T11) with definitions of done | Picking the next task to implement |
| **`refs/`** | Reference material — Minima source code and official docs | Resolving doubts about platform behaviour |

### Sources breakdown

| Folder | Contents | Use for |
|---|---|---|
| `refs/Minima-1.0.45/` | Minima Java + JS source code | Confirming exact MDS/Maxima/H2 behaviour |
| `refs/Minima-1.0.45/mds/` | `mds.js` FE library + official example dapps | FE API, Maxima encoding, SW patterns |
| `refs/docs-main/content/docs/development/` | Official Minima developer docs (MDX) | KissVM, MDS events, transaction construction |
| `refs/docs-main/content/docs/development/layer1/` | KissVM contract examples (HTLC, Vault, Exchange…) | Contract design and escrow patterns |
| `refs/MinimaDEX-main/` | Real DEX MiniDapp (vanilla JS, MDS) | On-chain transaction patterns from MDS |
| `refs/minimask-main/` | Browser extension + embedded DEX | Less relevant — different architecture |

**CLAUDE.md §8 has the full lookup table** (which file answers which platform question).

---

## 3) Planned Folder Structure

> The project has no code yet. This is the target structure from MinimaAds.md §12.1.

```
/dapp
  app.js              ← FE entry point: MDS.init, routing, view dispatch
  /views
    creator.js        ← Campaign creation UI
    viewer.js         ← Ad display + reward UI
    stats.js          ← Campaign stats UI

/core                 ← Business logic (no DOM, no MDS.sql directly)
  campaigns.js        ← Campaign CRUD, budget tracking
  selection.js        ← Ad selection algorithm (selectAd — synchronous)
  validation.js       ← View/click validation, LIMITS, dedup
  rewards.js          ← RewardEvent creation, USER_PROFILE updates
  minima.js           ← sqlQuery(), broadcastMaxima(), signalFE()

/sdk
  index.js            ← Public API: init, getAd, render, trackView, trackClick

/renderer
  renderAd.js         ← Renders one ad unit into a DOM container

/public
  index.html
  dapp.conf           ← Minima MiniDapp manifest
  /service-workers
    main.js           ← SW entry: LIMITS, APP_NAME, MDS.init handler
    db-init.js        ← H2 schema — called from onInited()
    /handlers
      maxima.handler.js    ← Routes inbound Maxima by payload.type
      campaign.handler.js  ← CAMPAIGN_ANNOUNCE / PAUSE / FINISH
```

### Entry Points

| Runtime | File | Role |
|---|---|---|
| Service Worker (Rhino) | `public/service-workers/main.js` | SW bootstrap — MDS.init, event routing |
| Frontend (browser) | `dapp/app.js` | FE bootstrap — MDS.init, routing |
| SDK (publisher) | `sdk/index.js` | Public API surface |
| DB schema (SW) | `public/service-workers/db-init.js` | H2 CREATE TABLE statements |

### Layer Dependency Rule

```
dapp/views → sdk → core → (MDS.sql via minima.js only)
SW handlers → core → (MDS.sql via minima.js only)
```

No layer may skip or reverse this order.

---

## 4) Pending Before Implementation

All pre-implementation tasks are complete. Implementation task list is in **`TASKS.md`**.

| # | Task | Status |
|---|---|---|
| 1 | Write `PromptBase.md` | ✅ Done |
| 2 | Create folder/file skeleton | ✅ Done |
| 3 | Break implementation into ordered tasks (`TASKS.md`) | ✅ Done |
| 4 | Read `minimask-main` SW | ✅ Done — Chrome extension, not applicable |

---

## 5) Key Decisions Log

Non-obvious decisions made during pre-implementation, with rationale. If you're wondering "why does it work this way?", check here first.

| Decision | Rationale | Spec ref |
|---|---|---|
| Reward processing is FE-owned, not SW | FE and SW share the same H2 DB. SW involvement adds complexity with no security benefit — KissVM is the real security boundary | MinimaAds.md §8.4 |
| `broadcastMaxima` uses `sendall`, not contact iteration | `maxima action:sendall` is always background, eliminates contact loop, poll stack cap doesn't apply | AGENTS.md §4.4 |
| `CREATOR_ADDRESS` uses Maxima PK, not wallet address | Maxima PK is the stable node identity; wallet address can change and is not used for Maxima routing | AGENTS.md §4.5 |
| KissVM escrow script enforces change-return | `VERIFYOUT(INC(@INPUT) @ADDRESS change @TOKENID TRUE)` prevents creator from silently draining budget to a different address on partial spend | MinimaAds.md Appendix B |
| Fee collection is off-chain only for MVP | No platform wallet address defined yet — fee tracked in H2 but not enforced on-chain | Appendix A |
| No `TextEncoder` in SW | Rhino does not support `TextEncoder` — use pure-JS `utf8ToHex` implementation | AGENTS.md §6 |
| `VERIFYOUT` requires 5 parameters | Newer Minima: `VERIFYOUT(idx addr amt tokenid keepstate_bool)` — older docs had 4 | AGENTS.md Fragility #17 |
