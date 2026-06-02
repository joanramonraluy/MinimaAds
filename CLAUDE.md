# CLAUDE.md — MinimaAds Agent Guide

> **You are an implementation agent.**
> You write code. You do not redefine the system.

---

## 1) Mandatory Reading (at session start)

### First Prompt of This Session

Follow this sequence once, at the start:

1. **Self-assess your overall task complexity** using the rubric in `CLAUDE.md §2`
   - Classify: LOW / MEDIUM / HIGH / XHIGH
   - Confirm you are the right model (Haiku/Sonnet/Opus)
   - Decide if you need plan mode

2. **If assessment says STOP → STOP**
   - If task requires Opus and you're not Opus → tell maintainer
   - If task requires plan mode and you haven't designed it → read `CLAUDE.md §4` first

3. **Read `docs/DOCUMENTATION_INDEX.md`** — the complete menu of available documentation

4. **Use the index to decide autonomously** what you need to consult for your task(s)

You are not required to read all documentation. You decide what's relevant based on your task complexity and the menu.

### Subsequent Tasks (same session)

If you receive a new task within this session:

1. **Quick re-assessment** using the rubric in `CLAUDE.md §2`
   - Has the complexity level changed? (LOW → HIGH, for example)
   - Are you still the right model?
   - Do you now need plan mode?

2. **If complexity jumps beyond your current model → STOP and tell maintainer**
   - Do not attempt a task that requires Opus if you are Sonnet
   - Do not attempt HIGH complexity without plan mode if you skipped it initially

3. Otherwise, proceed with the documented approach from step 3 above (use DOCUMENTATION_INDEX for new docs if needed)

---

**`AGENTS.md` is mandatory if your task touches Core, SW, or Protocol** — it contains Key Decisions that explain why the system works this way.

---

## 2) Model Selection

Before starting, assess task complexity and confirm you are the right model:

| Model | Use for |
|---|---|
| **Haiku** | Copy changes, CSS tweaks, doc updates, renaming — no logic involved |
| **Sonnet** | Most implementation: UI views, core logic, bug fixes, DB migrations |
| **Opus** | Multi-file protocol changes, KissVM/escrow tx, complex reasoning across layers |

### Self-assessment Rubric

Before you start, **classify your task using this rubric**:

**Complexity Level: LOW**
- Single file, no business logic, <50 lines
- Examples: copy change, CSS tweak, doc update, rename, simple fix
- **Model: Haiku is sufficient**
- **Plan mode: No**

**Complexity Level: MEDIUM**
- One layer (UI or Core), single feature, 50–500 lines
- Examples: new UI view, bug fix in existing function, small DB migration, core function
- **Model: Sonnet recommended**
- **Plan mode: No, unless the change affects an important contract**

**Complexity Level: HIGH**
- Multiple layers or files, protocol involved, 500+ lines
- Examples: new Maxima message type, channel implementation, escrow tx, refactor core flow
- **Model: Opus recommended**
- **Plan mode: YES — you must read `MinimaAds.md` and design the approach before coding**

**Complexity Level: XHIGH/MAX**
- Full system flow, protocol redesign, architectural decision
- Examples: new payment model, new trust model, major protocol change
- **Model: Opus required**
- **Plan mode: YES — mandatory. Design review before coding.**

### CRITICAL: Public Assessment → Suggestion → User Confirmation

**Your self-assessment thinking is private. Your suggestion MUST be public.**

After classifying the task, you **MUST IMMEDIATELY**:

1. **Output your assessment publicly** (this is your response to the user):
   ```
   Complexity: [LOW/MEDIUM/HIGH/XHIGH]
   Reasoning: [brief explanation of why this level]
   Recommended model: [Haiku/Sonnet/Opus]
   ```

2. **Ask for confirmation** (blocking — do NOT proceed without user response):
   ```
   Vols que delegui a [Model], o [current model] va bé?
   ```

3. **WAIT for explicit user approval:**
   - User says "OK" / "yes" / "approve" → proceed with suggested model
   - User says "Haiku" / "no" / model name → proceed with that model
   - Do NOT investigate, read files, or start work until you get this response

**Example of correct flow:**
```
User: "Fix the creator offline error in viewer campaigns"

[You assess internally: MEDIUM complexity, multi-layer (UI+Core+SW)]

You output:
"Complexity: MEDIUM (bug fix + multi-layer investigation: viewer.js, sdk, handlers)
Reasoning: Involves UI view, Core liveness logic, and Service Worker — needs investigation across multiple layers
Recommended model: Sonnet

Vols que delegui a Sonnet, o Haiku va bé?"

[You STOP here and wait]

User: "OK, Sonnet"

[Now you can proceed]
```

### After Self-Assessment + Confirmation

**If user confirms your suggestion:**
- Proceed with that model (or delegate if needed)

**If you are NOT the recommended model and user doesn't confirm:**
- If you're Haiku and task is MEDIUM or higher → user said "Haiku" anyway → proceed cautiously, report any blockers
- If you're Sonnet and task is HIGH or higher → user said "Sonnet" anyway → proceed, but monitor complexity

**If the task requires plan mode and you haven't already:**
→ Use `CLAUDE.md §4` (Task Execution Workflow, Step 1) to design your approach before coding

---

**MANDATORY: Every complexity assessment triggers the public suggestion + confirmation flow above. No exceptions.**

---

## 3) Document Priority

| Document | Owns | Authority |
|---|---|---|
| **MinimaAds.md** | Data models, API contracts, system flows, LIMITS values, H2 schema, Maxima schemas | **HIGHEST — always wins on conflict** |
| **AGENTS.md** | MDS API usage, H2 syntax rules, Rhino constraints, SW↔FE patterns, pre-merge checklist | Derives from MinimaAds.md |
| **CLAUDE.md** | Your operational guide as an agent | Derives from both |

**If any conflict exists between documents → do NOT resolve it unilaterally. Stop, report the conflict explicitly in the handoff note, and wait for maintainer instruction. Either document could be correct — only the maintainer can decide.**

---

## 4) Task Execution Workflow

For every task, follow this sequence in order:

### Step 1 — Identify the affected layer(s)

| Layer | Files | Spec ref |
|---|---|---|
| DB schema | `public/service-workers/db-init.js` + FE DB init | MinimaAds.md §3.5 |
| Core | `core/campaigns.js`, `core/selection.js`, `core/validation.js`, `core/rewards.js`, `core/minima.js` | MinimaAds.md §7 |
| Service Worker | `service.js`, `db-init.js`, `handlers/*.js` | MinimaAds.md §11 |
| SDK | `sdk/index.js` | MinimaAds.md §13 |
| UI / MiniDapp | `dapp/app.js`, `dapp/views/*.js` | MinimaAds.md §12 |

### Step 2 — Implement in this order (mandatory)

```
1. DB schema  →  2. Core  →  3. Service Worker  →  4. SDK  →  5. UI
```

Never implement a layer before its dependencies are ready.

### Step 3 — Validate before finishing

- [ ] Function signatures match MinimaAds.md §7 exactly
- [ ] Maxima message schemas match MinimaAds.md §8 exactly
- [ ] LIMITS values read from `LIMITS` constant — never hardcoded
- [ ] `poll:false` on all outbound Maxima sends
- [ ] DB changes applied in BOTH runtimes (SW + FE)
- [ ] `CREATOR_ADDRESS !== userAddress` check present where required
- [ ] No `console.log` in SW (use `MDS.log("[PREFIX] ..."`)
- [ ] No arrow functions, `let`/`const`, or template literals in SW code
- [ ] All user-input strings passed through `escapeSql()` before SQL interpolation
- [ ] Public key comparisons use `.toUpperCase()` on both sides (0x vs 0X)

### Step 4 — Update AGENTS.md

If you added a Maxima message type → update MinimaAds.md §8.
If you added a SW signal → update MinimaAds.md §8.15 signal table.
If you changed the DB schema → update MinimaAds.md §3.5.

**Handoff note housekeeping (mandatory):**
- Add your handoff entry at the top of `AGENTS.md §6`.
- If `AGENTS.md §6` has more than 3 session entries after adding yours, move the oldest entry to `docs/HISTORY.md §17` before finishing.
- This keeps `AGENTS.md §6` lean — it is loaded every session.

**Task housekeeping:**
- If a task you implemented is still marked `Pending ⬜` in `docs/TASKS.md` → mark it Done.
- When a task block is fully complete → mark all its tasks Done in `docs/TASKS.md`.

---

## 5) Stable Core API (DO NOT ALTER)

These signatures are contracts. Do not rename, reorder, or add parameters without updating MinimaAds.md §7 first.

```
campaigns.js : getCampaigns(cb)
               getCampaign(id, cb)
               saveCampaign(campaign, ad, cb)
               updateBudget(campaignId, deductAmount, cb)
               setCampaignStatus(campaignId, status, cb)

selection.js : selectAd(userAddress, userInterests, campaigns)  ← synchronous

validation.js: validateView(campaignId, userAddress, cb)
               validateClick(campaignId, userAddress, cb)
               isDuplicate(eventId, cb)

rewards.js   : createRewardEvent(params, cb)
               getUserRewards(userAddress, cb)
               getUserProfile(userAddress, cb)

minima.js    : sqlQuery(query, cb)
               broadcastMaxima(payload, cb)
               signalFE(type, data)
```

---

## 6) Forbidden Actions

You MUST NOT do any of the following, under any circumstances:

### Architecture
- ❌ Introduce any JS framework (React, Vue, Svelte, Angular, etc.)
- ❌ Add a build step or bundler (Webpack, Vite, esbuild, etc.)
- ❌ Add DOM access or UI logic inside `core/*.js`
- ❌ Bypass the Service Worker for **inbound Maxima** event persistence (CAMPAIGN_ANNOUNCE, CAMPAIGN_PAUSE, CAMPAIGN_FINISH must be handled by SW)
- ❌ Call `MDS.sql` directly outside `core/minima.js`
- ❌ Interpolate user input into SQL without `escapeSql()` — see AGENTS.md §3.6
- ❌ Compare public keys with strict string equality — always `.toUpperCase()` both sides

### Maxima
- ❌ Send Maxima messages without `poll:false`
- ❌ Use any `application:` string other than the `APP_NAME` constant (`'minima-ads'`)
- ❌ Modify Maxima message schemas without updating MinimaAds.md §8

### Data Model
- ❌ Add, rename, or remove fields from Campaign, Ad, RewardEvent, or UserProfile
- ❌ Hardcode any LIMITS value — always use the `LIMITS` constant
- ❌ Allow a creator to earn rewards from their own campaigns

### Process
- ✅ Run `git commit` and `git push` **only when the maintainer explicitly requests it** — never proactively
- ❌ Run `npm run build`, `npm run minima:*`, or any release command
- ❌ Invent new system flows not defined in MinimaAds.md §6
- ❌ Modify files unrelated to the current task
- ❌ Refactor code outside the task scope

### Versioning
Format: `0.YY.M.W` — major . year . month . week-of-month
Example: `0.26.6.1` = pre-release, 2026, June, week 1

Update `dapp.conf` version when the maintainer requests a commit at the end of a session.
Week of month: 1 = days 1–7, 2 = 8–14, 3 = 15–21, 4 = 22–28, 5 = 29–31.

---

## 7) Minima Runtime Constraints (CRITICAL)

### Service Worker (Rhino JS engine)
```
✅ Use: var         ❌ Avoid: let, const
✅ Use: function()  ❌ Avoid: () => arrow functions
✅ Use: "a" + b     ❌ Avoid: `${b}` template literals
✅ Use: MDS.log()   ❌ Avoid: console.log()
❌ No trailing commas in function param/arg lists → silent Rhino crash
❌ No ES Module import/export → use load() or direct function reference
```

### H2 Database
```
✅ Row keys are always UPPERCASE → access row.MYFIELD not row.myField
✅ Upserts: MERGE INTO t (cols) KEY (id) VALUES (...)
❌ No: INSERT ... ON CONFLICT → throws JdbcSQLSyntaxErrorException
✅ BOOLEAN columns return "true"/"false" strings → check all 4 variants
✅ String comparisons on IDs/addresses: WHERE UPPER(col) = UPPER(val)
✅ Schema migrations: ALTER TABLE t ADD COLUMN IF NOT EXISTS ...
```

### MDS API
```
SW:  MDS.cmd("maxima action:send publickey:0x... application:minima-ads data:0x... poll:false", cb)
FE:  MDS.cmd.maxima({ params: { action:'send', ... } }, cb)
     MDS.comms.solo(payload)  ← fire-and-forget; callback optional but only confirms queuing
FE signal arrives at: event.event === "MDSCOMMS", payload at event.data.message
```

### Maxima Payload
```javascript
// Encode before sending:
var hex = "0x" + utf8ToHex(JSON.stringify(payload)).toUpperCase();

// Decode on receive:
var payload = JSON.parse(hexToUtf8(msg.data.data));
```

---

## 8) Multi-Agent Safety Rules

When working alongside other agents or in a multi-session context:

- **Only modify files required by the task** — zero unrelated changes
- **Do not restructure or rename** existing functions or files
- **Do not merge unrelated fixes** into the current patch
- **All changes must be isolated and independently reviewable**
- If you discover a bug outside your task scope → document it in `docs/KNOWN_ISSUES.md`, do not fix it inline

---

## 9) If Something Is Unclear

**STOP. Do not assume. Do not improvise.**

1. Re-read the relevant section of MinimaAds.md
2. Re-read the relevant section of AGENTS.md
3. **Check the Minima source code and official docs** — available in `refs/`:

   | Doubt about | Where to look |
   |---|---|
   | `MDS.*` behavior in FE | `refs/Minima-1.0.45/mds/mds.js` |
   | `MDS.*` behavior in SW | `refs/Minima-1.0.45/src/org/minima/system/mds/runnable/MDSJS.java` |
   | `MDS.comms.*` internals | `refs/Minima-1.0.45/src/org/minima/system/mds/runnable/COMMSService.java` |
   | Maxima send, limits, routing | `refs/Minima-1.0.45/src/org/minima/system/network/maxima/` |
   | Real MiniDapp patterns (SW, Maxima) | `refs/Minima-1.0.45/mds/code/` |
   | KissVM grammar and all functions | `refs/docs-main/content/docs/development/contracts-kissvm.mdx` |
   | KissVM contract examples (HTLC, vault, exchange, multisig) | `refs/docs-main/content/docs/development/layer1/` |
   | MDS events list (inited, NEWBLOCK, MDS_PENDING…) | `refs/docs-main/content/docs/development/minidapp-events.mdx` |
   | MDS.js API reference | `refs/docs-main/content/docs/development/minidapp-mdsjs.mdx` |
   | Transaction construction (txncreate/txninput/txnpost) | `refs/docs-main/content/docs/development/simple-txn.mdx` |

4. If still unclear after reading the source → ask for clarification before writing code

This rule exists to prevent architectural drift across agent sessions. **Improvising platform behavior is the leading cause of bugs in Minima MiniDapps.**

---

## 10) Output Standards

Every code output must be:

- **Correct** — passes the Step 3 validation checklist
- **Minimal** — implements exactly what is required, nothing more
- **Scoped** — changes confined to the identified layer(s)
- **Readable** — no dead code, no speculative features, no commented-out blocks
- **Integration-ready** — can be dropped into the project without manual cleanup

---

## 11) Handoff Note (required at end of every task)

After completing a task, always provide:

```
Task completed: [description]
Files modified: [list]
AGENTS.md updated: yes | no | N/A — [reason if N/A]
Sections updated: [e.g. MinimaAds.md §8, §3.5]
Verification: [list exactly what the maintainer should test in the browser:
  - Which route/view to open (#viewer, #mycampaigns, etc.)
  - Which action to perform (click X, fill form Y, etc.)
  - What the expected result is
  - Whether there should be no console errors]
Open issues: [any discovered but out-of-scope problems → document in docs/KNOWN_ISSUES.md]
```
