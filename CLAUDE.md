# CLAUDE.md — MinimaAds Agent Guide

> **You are an implementation agent.**
> You write code. You do not redefine the system.

---

## 1) Mandatory Reading (before ANY task)

Before writing a single line of code, you MUST read:

1. **`PROJECT_INDEX.md`** — navigation map, folder structure, playbooks, key decisions log
2. **`MinimaAds.md`** — the system specification (source of truth for all behavior)
3. **`AGENTS.md`** — Minima runtime rules, H2 gotchas, Rhino constraints, workflow

Read the sections relevant to the task. Do not skip this step.

---

## 2) Document Priority

| Document | Owns | Authority |
|---|---|---|
| **MinimaAds.md** | Data models, API contracts, system flows, LIMITS values, H2 schema, Maxima schemas | **HIGHEST — always wins on conflict** |
| **AGENTS.md** | MDS API usage, H2 syntax rules, Rhino constraints, SW↔FE patterns, pre-merge checklist | Derives from MinimaAds.md |
| **CLAUDE.md** | Your operational guide as an agent | Derives from both |

**If any conflict exists between documents → do NOT resolve it unilaterally. Stop, report the conflict explicitly in the handoff note, and wait for maintainer instruction. Either document could be correct — only the maintainer can decide.**

---

## 3) Task Execution Workflow

For every task, follow this sequence in order:

### Step 1 — Identify the affected layer(s)

| Layer | Files | Spec ref |
|---|---|---|
| DB schema | `public/service-workers/db-init.js` + FE DB init | MinimaAds.md §3.5 |
| Core | `core/campaigns.js`, `core/selection.js`, `core/validation.js`, `core/rewards.js`, `core/minima.js` | MinimaAds.md §7 |
| Service Worker | `public/service-workers/main.js`, `db-init.js`, `handlers/*.js` | MinimaAds.md §11 |
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

If you added a Maxima message type → update AGENTS.md §9 and MinimaAds.md §8.
If you added a SW signal → update AGENTS.md §10 and MinimaAds.md §8.6.
If you changed the DB schema → update AGENTS.md §8 and MinimaAds.md §3.5.

---

## 4) Stable Core API (DO NOT ALTER)

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

## 5) Forbidden Actions

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

---

## 6) Minima Runtime Constraints (CRITICAL)

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

## 7) Multi-Agent Safety Rules

When working alongside other agents or in a multi-session context:

- **Only modify files required by the task** — zero unrelated changes
- **Do not restructure or rename** existing functions or files
- **Do not merge unrelated fixes** into the current patch
- **All changes must be isolated and independently reviewable**
- If you discover a bug outside your task scope → document it in AGENTS.md §14, do not fix it inline

---

## 8) If Something Is Unclear

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

## 9) Output Standards

Every code output must be:

- **Correct** — passes the Step 3 validation checklist
- **Minimal** — implements exactly what is required, nothing more
- **Scoped** — changes confined to the identified layer(s)
- **Readable** — no dead code, no speculative features, no commented-out blocks
- **Integration-ready** — can be dropped into the project without manual cleanup

---

## 10) Handoff Note (required at end of every task)

After completing a task, always provide:

```
Task completed: [description]
Files modified: [list]
AGENTS.md updated: yes | no | N/A — [reason if N/A]
Sections updated: [e.g. §8 DB Schema, §9 Protocol Matrix]
Verification: [exact command or check the maintainer should run]
Open issues: [any discovered but out-of-scope problems → document in AGENTS.md §14]
```
