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

## Task Status

Every individual task in every block above (T1–T12, T-CH1–9, T-PUB1–8,
T-SC1–7, T-REP0–2) is `✅ Done` — see the block-level `Status Summary` table
above. Per-task implementation detail (which files, what changed, what was
verified) lives in `git log` and `docs/HISTORY.md §17`, not duplicated here —
a task-by-task table became pure historical noise once every block finished
and started drifting out of sync with the real detail. Follows the same
archive-instead-of-duplicate precedent as `TASKS_SC.md` in `docs/archive/`.

The one task not `✅ Done`:

| Task | Layer | File(s) | Status |
|---|---|---|---|
| **T-REP3** | **Protocol** | `maxima.handler.js`, `campaign.handler.js`, `core/reputation.js`, `db-init.js` (×2 runtimes), `MinimaAds.md §8` | ⏸️ Parked (MVP scope decision) — **XHIGH, needs separate approval.** Signed peer attestations. Full design done 2026-09-12 (design only, no code) — see `docs/HISTORY.md §17`, session 2026-09-12. **Blocked on Q1 = "do we want this at all?" — parked, no concrete use case yet. Q2–Q9 decided 2026-09-12, see §12 of that entry.** |

---

## Next Task

Auth/reputation (chosen 2026-09-11 as the roadmap item to prioritize) is staged into T-REP0–T-REP3 above per the Opus design proposal — see `docs/HISTORY.md §17`, session 2026-09-11 (AUD-6 / T-REP0), for the full design (data model, evidence sources, per-layer impact, abuse vectors). T-REP0, T-REP1 and T-REP2 are all done (session 2026-09-11, `core/reputation.js`). `platform_key_mismatch` evidence was deliberately deferred within T-REP2 (see `MinimaAds.md §7.8` — no trusted subject exists at its rejection point yet). T-REP3 (signed peer attestations, XHIGH, separate approval) is the only remaining piece of this roadmap item. Its **full design was produced 2026-09-12 — design only, no code, no schema, no Maxima type, `MinimaAds.md` deliberately untouched** — see `docs/HISTORY.md §17`, session 2026-09-12 (message pair, `maxsign`/`maxverify` flow, anti-Sybil caps and curve with worked numbers, data model, privacy analysis). It stays `⏸️ Parked`: Q2–Q9 were decided 2026-09-12 (opt-in, closed-counterparty requests, `'none'` lineage default, K=5/N=4/SCALE=15/MAX=40, no relay, no UI surfacing, never merged into `SCORE`/`TIER`/`selectAd` without separate review, no provisional `MinimaAds.md` addendum) — see `docs/HISTORY.md §17`, session 2026-09-12, §12. Only Q1 remains open: no concrete use case for Phase 3 exists yet, so it stays parked rather than approved or rejected; implementation begins only if/when one appears.

The other three roadmap candidates remain unstarted:

- **Advanced analytics** — cohort analysis, fraud detection
- **Cross-dApp settlement** — MinimaAds as a settlement layer for other dApps
- **Governance** — community-driven parameter tuning

For implementation details of any past task, see `docs/HISTORY.md §17` (archived handoff notes and detailed prompts).
