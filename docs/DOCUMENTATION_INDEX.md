# MinimaAds — Documentation Index

> Complete menu of available documentation.
> Before any task, read this file and decide what you need to consult.
> You are not required to read everything — choose what's relevant.

---

## Quick Navigation

| Document | Best for |
|---|---|
| **CLAUDE.md** | Mandatory once per session: workflow, model selection, validation, handoff format |
| **AGENTS.md** | Key architectural decisions, project rules, canonical identities |
| **MinimaAds.md** | Technical spec: data models, API contracts, system flows, limits, schema |
| **docs/UI_GUIDE.md** | UI-only tasks: views, CSS, copy, helpers, conventions |
| **docs/KNOWN_ISSUES.md** | Fragility points, open bugs, known gotchas |
| **docs/VERIFICATION.md** | Test procedures, verification workflows |
| **docs/PLATFORM_NOTES.md** | Minima platform details: H2, Rhino, MDS, Maxima, constraints |
| **docs/PROJECT_NOTES.md** (topology, schema) + **docs/PROJECT_NOTES_REFERENCE.md** (protocol detail) | Project topology, DB schema, protocol matrix, signals, handlers |
| **PROJECT_INDEX.md** | Structure, folder map, key decisions log (optional, orientation only) |

---

## Consult by Task Type

**UI task (views, CSS, copy, layout):**
- Start: docs/UI_GUIDE.md
- Then: MinimaAds.md §12 (if view is new or touches routing)
- Reference: docs/PLATFORM_NOTES.md (only if layout affects FE/SW boundary)

**Core / Service Worker (campaigns, channels, validation, DB, handlers):**
- Start: AGENTS.md (Key Decisions + Project Rules)
- Then: MinimaAds.md §3 (data model), §7 (core API), §11 (SW architecture)
- Reference: docs/KNOWN_ISSUES.md (for fragility in your area)

**Protocol (Maxima schemas, channel open, escrow, reward flow):**
- Start: AGENTS.md (Key Decisions for understanding why)
- Then: MinimaAds.md §3 (data), §7 (API), §8 (Maxima protocol), Appendix B/C (KissVM, tx)
- Reference: docs/PROJECT_NOTES_REFERENCE.md (protocol matrix)

**SDK (sdk/index.js, publisher integration):**
- Start: AGENTS.md (Key Decisions)
- Then: MinimaAds.md §3 (data), §7 (core API), §13 (SDK), §4 (economics)

**Full feature or architectural change:**
- Start: PROJECT_INDEX.md §5 (Key Decisions Log)
- Then: AGENTS.md (project rules)
- Then: MinimaAds.md (full relevant sections)

---

## Decision Points

**Should I read CLAUDE.md?**
→ Yes, always. Once per session, at the start. Contains workflow, model selection (Haiku/Sonnet/Opus), and handoff format.

**Should I read AGENTS.md?**
→ Yes, if your task touches Core, SW, or protocol. Contains Key Decisions that explain *why* the system works this way. No if UI-only.

**Should I read PROJECT_INDEX.md?**
→ Only if you need folder structure or project context. Not required for most tasks. Optional.

**Should I read MinimaAds.md?**
→ Yes, for sections relevant to your task type (see "Consult by Task Type" above). You do NOT need to read the entire spec — only your sections.

**Should I read docs/UI_GUIDE.md?**
→ Yes, if your task is UI-only. If you're modifying core or protocol, skip it.

**Should I read docs/KNOWN_ISSUES.md?**
→ Consult if your task touches an area mentioned in the fragility log. Otherwise optional.

---

## Decision Matrix: What the Agent Should Decide

When you receive a task, ask yourself:

1. **Is this a UI task?** (view, CSS, copy, layout)
   - YES → consult UI_GUIDE.md + relevant MinimaAds.md sections
   - NO → next question

2. **Does this touch Core / Service Worker?** (campaigns, channels, validation, DB schema, handlers)
   - YES → consult AGENTS.md + MinimaAds.md §3, §7, §11
   - NO → next question

3. **Does this touch Protocol?** (Maxima, escrow, channel tx, reward flow)
   - YES → consult AGENTS.md + MinimaAds.md §3, §7, §8, Appendix B/C
   - NO → probably SDK or docs task

4. **Do you understand the scope?**
   - YES → proceed
   - NO → consult AGENTS.md, Key Decisions (§4), and relevant project notes

---

## Special Cases

**"I'm implementing a new feature from scratch"**
→ Start with CLAUDE.md §2 (Model Selection) to self-assess complexity and plan mode need.
Then consult PROJECT_INDEX.md §5 (Key Decisions) to understand why the system is designed this way.

**"I'm fixing a bug in a specific area"**
→ Read docs/KNOWN_ISSUES.md for your area, then consult the minimal set above.

**"I don't know if I need plan mode"**
→ See CLAUDE.md §4 (Task Execution Workflow, Step 3). Use `/assess-task` skill if available.

---

**Remember:** You are autonomous. Read what you need, decide what you skip. This index is a menu, not a checklist.
