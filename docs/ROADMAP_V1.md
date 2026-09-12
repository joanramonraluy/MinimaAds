# MinimaAds — Roadmap to v1.0.0

> **Purpose**: this is the single entry point for "where are we, and what's
> left before `v1.0.0`?" It does not duplicate any other document — every
> line below points to where the real detail lives (`docs/TASKS.md` for
> build work, `docs/MASTER_TEST_PLAN.md` / `docs/REGRESSION_TEST_PLAN.md` for
> verification, `docs/KNOWN_ISSUES.md` for tech debt). If a status here looks
> stale, the source document is always the source of truth — update this
> file to match it, not the other way round.
> **Read this before `docs/DOCUMENTATION_INDEX.md`** if your question is
> "what's left before release", not "what do I need for my specific task".

---

## 1) What `v1.0.0` means here

Per `CLAUDE.md §6`'s versioning table, `v1.0.0` is reserved for **"First
stable public release"**. Until now that line had no concrete definition —
this document is that definition. Feature completeness (`docs/TASKS.md`:
43/45 tasks `✅ Done`, only `T-REP3` parked) is necessary but **not
sufficient** — the gate below also covers hardening, verification, and
economic wiring that only matters right before a real, public,
real-money release.

---

## 2) Gate criteria — decided 2026-09-12

Every row must reach ✅ before tagging `v1.0.0`. Status reflects what's true
as of 2026-09-12; re-check the linked source before trusting an old ✅ here.

| # | Criterion | Status | Source of truth | What's left |
|---|---|---|---|---|
| 1 | `PLATFORM_KEY` set to a real mainnet key (not `null`) | ⬜ Not done | `MinimaAds.md §4.6` / Appendix B.2, `config.js` | Currently `null` (fee enforcement disabled, `feeflag=0` path). Needs: a real key generated and wired, **and** a live test pass with `feeflag=1` — almost all live verification to date (including this session's) ran the `feeflag=0` branch, so the fee-enforced code path is comparatively under-tested. |
| 2 | Regression coverage complete | 🟡 In progress (5/~20) | `docs/REGRESSION_TEST_PLAN.md` Tier 2 | 5 of the ~20 `docs/KNOWN_ISSUES.md §3` entries have a live-verified Tier 2 guard (as of 2026-09-12, all 5 passing). The remaining ~15 need entries added and run at least once. |
| 3 | `T-REP3` explicitly resolved for v1.0 scope | 🟡 Needs an explicit call | `docs/TASKS.md`, `docs/HISTORY.md §17` session 2026-09-12 | Currently `⏸️ Parked` — Q1 ("is there a real use case?") undecided, by design, until one appears. That's a legitimate *project* state, but v1.0 needs an explicit one-line call either way: "ships without it, revisit post-v1.0 if a use case appears" (most likely) or "blocks v1.0". Not yet stated as a release decision. |
| 4 | External security audit | ⬜ Not done | `docs/KNOWN_ISSUES.md §3` (OPEN-1 through OPEN-10) | All security fixes to date were found, fixed, and live-verified within agent sessions — no review by anyone outside this process. Real-money release should not skip an outside pass, at minimum on the escrow/channel KissVM scripts and the OPEN-4 lineage gate. |
| 5 | Full functional coverage | 🟡 In progress (15/24, 62%) | `docs/MASTER_TEST_PLAN.md §4` (Current Baseline Verification Matrix) | That table already tracks this — 15 ✅, 6 ⬜, 3 ⚠️ as of the matrix's last update. Included here because it's the other half of "stable" alongside regression coverage; not a new tracker, just surfaced. **Flagged for your review** — this line wasn't one of the 4 you explicitly picked; drop it here if you don't want it as a hard gate. |

---

## 3) Post-v1.0 roadmap (explicitly out of scope for the gate above)

Decided 2026-09-12: these do not block `v1.0.0`. They stay visible here so
they don't get silently dropped, but each would need its own design/plan
cycle when picked up — none are "almost done".

- **Advanced analytics / fraud detection** — an iteration on the existing
  reputation system (`core/reputation.js`, T-REP0–T-REP2), not a
  prerequisite for it to be usable.
- **Cross-dApp settlement** ("MinimaAds as a settlement layer for other
  dApps") — a **new product surface**: other dApps using MinimaAds'
  channel/escrow mechanism for their *own* unrelated payments, not for
  serving ads. **Not the same thing as** `docs/MASTER_TEST_PLAN.md` Suite C
  (MetaChain integration) — that's MetaChain acting as a *publisher/host*
  for our existing ad-serving + reward mechanism, which is already-built
  functionality and is correctly covered by gate criterion #5 above (Suite C
  rows C.1–C.4), not by this roadmap item.
- **Governance for parameter tuning** — decentralizing *how future changes
  get decided*; unrelated to whether the current, maintainer-configured
  product is stable today. Common to ship v1 centralized and add this later.

---

## 4) How to use this document

- **Starting a new session and want the big picture?** Read this file first,
  then `docs/DOCUMENTATION_INDEX.md` for what you need for your specific
  task.
- **Closed a gate criterion?** Update its Status cell here (with date), and
  do the normal housekeeping in the owning document (`docs/TASKS.md`,
  `docs/REGRESSION_TEST_PLAN.md`, etc.) — this file only points, it doesn't
  hold the detail.
- **Found a new thing that should gate v1.0?** That's a maintainer call, not
  an agent call — flag it, don't add it unilaterally.
