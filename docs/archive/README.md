# docs/archive — Historical Documentation

This folder contains documentation that is no longer actively maintained or consulted during development. These files are kept for historical reference and context, but are **not in the active reading path**.

---

## Contents

| File | Purpose | Status |
|---|---|---|
| `audit_report.md`, `audit_report_2.md`, `audit_report_3.md` | Security audit findings from past code reviews | All issues resolved and integrated into KNOWN_ISSUES.md |
| `PromptBase.md` | Baseline prompt template for new agent sessions | Superseded by CLAUDE.md and agent memory system |
| `PROJECT_NOTES.md` | Project topology and DB schema (old) | Superseded by PROJECT_NOTES_REFERENCE.md |
| `TASKS_SC.md` | Old task list for supply chain features | Archived; all tasks consolidated into TASKS.md |
| `UI_GUIDE.md`, `UI_MOD_ROADMAP.md`, `UI_ROADMAP.md` | UI conventions and roadmaps | Completed (v0.26.6+); roadmaps are historical |
| `VERIFICATION.md` | Test procedures and checklist | Historical reference; current verification in KNOWN_ISSUES.md |
| `MAXIMA_ROUTE_DISCOVERY.md` | Design notes on publisher route discovery | Partially implemented (STATE(4) done; route caches/PEER_ROUTE_UPDATE deferred) |
| `AUTO_BALANCE_ALGORITHM.md`, `AUTO_BALANCE_SUMMARY.md` | Algorithm study for adaptive reward scaling | Feature not implemented; concept retained for future |

---

## Why These Are Archived

1. **Completed tasks**: TASKS.md supersedes all old task lists
2. **Integrated findings**: Audit reports are consolidated into KNOWN_ISSUES.md §3 (Closed/Fixed Issues)
3. **Outdated specs**: PROJECT_NOTES.md is fully replaced by PROJECT_NOTES_REFERENCE.md
4. **Future-looking docs**: MAXIMA_ROUTE_DISCOVERY and AUTO_BALANCE docs describe unimplemented features (MVP deferral)
5. **Template drift**: PromptBase.md is superseded by CLAUDE.md + the agent memory system

---

## When to Consult Archive

- **"I need to understand a past decision"** → Check HISTORY.md instead (it references these files with context)
- **"I'm implementing a deferred feature"** → Read MAXIMA_ROUTE_DISCOVERY.md or AUTO_BALANCE_*.md
- **"I want the full audit trail"** → See audit_report_*.md (but KNOWN_ISSUES.md is more actionable)
- **"I'm new and need UI conventions"** → UI_GUIDE.md is still useful, but CLAUDE.md §10 has the project's current stance on UI

---

## Active Documentation (Do Not Consult Here)

For current development, use:
- `docs/DOCUMENTATION_INDEX.md` — Main entry point
- `docs/KNOWN_ISSUES.md` — Fragility points + closed security findings
- `docs/PLATFORM_NOTES.md` — Minima constraints
- `docs/PROJECT_NOTES_REFERENCE.md` — Protocol matrix and signal contracts
- `docs/TASKS.md` — Active task list
- `docs/HISTORY.md` — Past handoff notes (with archive references)
- `AGENTS.md` — Operative guide and key decisions
- `MinimaAds.md` — System specification
