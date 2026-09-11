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

## Status Summary

**All task blocks completed** (patches 1–24). See `docs/HISTORY.md` for detailed implementation notes and prompts.

| Task Block | Tasks | Milestone | Status |
|---|---|---|---|
| **Core + SW + SDK MVP** | T1–T12 | v0.3.0 | ✅ Done |
| **Payment Channels** | T-CH1–T-CH9 | v0.25.0+ | ✅ Done |
| **Publisher Rewards** | T-PUB1–T-PUB8 | v0.26.0+ | ✅ Done |
| **Settlement Chain (V3)** | T-SC1–T-SC7 | v0.26.6.0+ | ✅ Done |

---

## Task Status Table (Quick Reference)

| Task | Layer | File(s) | Status |
|---|---|---|---|
| T1 | DB Schema | `public/service-workers/db-init.js` | ✅ Done |
| T2 | Core | `core/minima.js` | ✅ Done |
| T3 | Core | `core/campaigns.js` | ✅ Done |
| T4 | Core | `core/selection.js` | ✅ Done |
| T5 | Core | `core/validation.js` | ✅ Done |
| T6 | Core | `core/rewards.js` | ✅ Done |
| T7 | SW | `service.js` | ✅ Done |
| T8 | SW | `public/service-workers/handlers/*.js` | ✅ Done |
| T9 | SDK | `sdk/index.js` | ✅ Done |
| T10 | UI | `dapp/app.js`, `dapp/views/*.js` | ✅ Done |
| T11 | UI | `renderer/renderAd.js`, `public/index.html`, `public/dapp.conf` | ✅ Done |
| T12 | SW + UI | `creator.js`, `service.js` | ✅ Done |
| **T-CH1** | **DB** | `db-init.js` (×2 runtimes) | ✅ Done |
| **T-CH2** | **Core** | `core/channels.js` | ✅ Done |
| **T-CH3** | **SW** | `handlers/channel.handler.js`, `maxima.handler.js` | ✅ Done |
| **T-CH4** | **FE** | `dapp/views/creator.js`, `dapp/app.js` | ✅ Done |
| **T-CH5** | **SDK** | `sdk/index.js` | ✅ Done |
| **T-CH6** | **UI** | `dapp/views/viewer.js` | ✅ Done |
| **T-CH7** | **Multi-layer** | `db-init.js`, `campaigns.js`, `sdk/index.js`, `creator.js`, `channel.handler.js` | ✅ Done |
| **T-CH8** | **SW** | `channel.handler.js`, `service.js` | ✅ Done |
| **T-CH9** | **FE** | `dapp/app.js` | ✅ Done |
| **T-PUB1** | **DB** | `db-init.js` (×2 runtimes) | ✅ Done |
| **T-PUB2** | **Core** | `core/frames.js` | ✅ Done |
| **T-PUB3** | **Config + SW** | `config.js`, `campaign.handler.js` | ✅ Done |
| **T-PUB4** | **Contract + FE** | `dapp/views/creator.js`, `dapp/app.js` | ✅ Done |
| **T-PUB5** | **SDK** | `sdk/index.js` | ✅ Done |
| **T-PUB6** | **UI** | `dapp/views/creator.js` | ✅ Done |
| **T-PUB7** | **UI + SW** | `dapp/views/frames.js`, `dapp/app.js`, `service.js` | ✅ Done |
| **T-PUB8** | **SW + FE** | `channel.handler.js`, `core/channels.js`, `dapp/app.js` | ✅ Done |
| **T-SC1** | **Spec** | `MinimaAds.md`, `AGENTS.md` | ✅ Done |
| **T-SC2** | **SW** | `service.js` | ✅ Done |
| **T-SC3** | **FE** | `dapp/views/creator.js`, `dapp/app.js` | ✅ Done |
| **T-SC4** | **SW** | `campaign.handler.js` | ✅ Done |
| **T-SC5** | **Core** | `core/campaigns.js` | ✅ Done |
| **T-SC6** | **FE** | `dapp/app.js`, `dapp/views/mycampaigns.js` | ✅ Done |
| **T-SC7** | **Docs** | `docs/KNOWN_ISSUES.md`, `docs/VERIFICATION.md`, `AGENTS.md` | ✅ Done |
| **T-REP0** | **SW** | `maxima.handler.js`, `campaign.handler.js` | ✅ Done |
| **T-REP1** | **DB + Core** | `db-init.js` (×2 runtimes), `core/reputation.js` (new), `service.js`, `dapp/app.js`, `channel.handler.js` | ✅ Done |
| **T-REP2** | **SW + FE** | `campaign.handler.js`, `channel.handler.js`, `core/reputation.js`, `service.js`, `dapp/app.js`, `dapp/views/campaigns.js`, `dapp/views/mycampaigns.js`, `dapp/views/ui-helpers.js` | ✅ Done |
| **T-REP3** | **Protocol** | `maxima.handler.js`, `campaign.handler.js`, `MinimaAds.md §8` | ⬜ Pending — **XHIGH, needs separate approval** |

---

## Next Task

Auth/reputation (chosen 2026-09-11 as the roadmap item to prioritize) is staged into T-REP0–T-REP3 above per the Opus design proposal — see `docs/HISTORY.md §17`, session 2026-09-11 (AUD-6 / T-REP0), for the full design (data model, evidence sources, per-layer impact, abuse vectors). T-REP0, T-REP1 and T-REP2 are all done (session 2026-09-11, `core/reputation.js`). `platform_key_mismatch` evidence was deliberately deferred within T-REP2 (see `MinimaAds.md §7.8` — no trusted subject exists at its rejection point yet). T-REP3 (signed peer attestations, XHIGH, separate approval) is the only remaining piece of this roadmap item.

The other three roadmap candidates remain unstarted:

- **Advanced analytics** — cohort analysis, fraud detection
- **Cross-dApp settlement** — MinimaAds as a settlement layer for other dApps
- **Governance** — community-driven parameter tuning

For implementation details of any past task, see `docs/HISTORY.md §17` (archived handoff notes and detailed prompts).
