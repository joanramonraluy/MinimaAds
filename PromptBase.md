# MinimaAds — Agent Primer

> Give this as the first message to any new implementation agent session.
> Fill in section 6 before sending.

---

## 1) What You Are Building

**MinimaAds** is a decentralised ad network running as a Minima MiniDapp. Advertisers lock Minima in a KissVM on-chain escrow and broadcast campaigns via Maxima P2P. Viewers earn rewards for genuine ad interactions. No server. No framework. No build step.

---

## 2) Document Hierarchy — Read Before Writing

| Document | Read for |
|---|---|
| `PROJECT_INDEX.md` | Folder map, entry points, pending tasks, key decisions |
| `MinimaAds.md` | Data models, API signatures, system flows, KissVM escrow spec — **source of truth, always wins** |
| `AGENTS.md` | Platform gotchas: H2 quirks, Rhino constraints, Maxima patterns, fragility points |
| `CLAUDE.md` | Your task workflow and forbidden actions |

Read the sections relevant to your task. Do not skip this.

---

## 3) Platform Rules — Non-Negotiable

**Rhino (Service Worker runtime)**
- `var` only — no `let`, `const`
- `function()` only — no arrow functions
- `"a" + b` only — no template literals
- `MDS.log()` only — no `console.log`
- No trailing commas in param/arg lists — silent crash
- No ES Module `import` — use `load()` or direct function calls

**H2 Database**
- All column names UPPERCASE — `row.MYFIELD` not `row.myField`
- Upserts: `MERGE INTO t (...) KEY (id) VALUES (...)` — never `ON CONFLICT`
- User-input strings: always `escapeSql(value)` before interpolation
- Schema changes: `ADD COLUMN IF NOT EXISTS` — apply in **both** SW and FE init

**Maxima**
- All outbound sends: `poll:false` — without it the SW blocks for ~77s
- Always use the `APP_NAME` constant (`'minima-ads'`) — never hardcode the string
- Payload: hex-encode with `utf8ToHex`, prefix `0x`, uppercase

**Identity**
- Node identity = Maxima public key (`maxima action:info → publickey`)
- KissVM signing = wallet key (`keys action:list → publickey`)
- These are **different keys** — never substitute one for the other

**Architecture**
- All DB operations through `core/minima.js → sqlQuery()` — no bare `MDS.sql` elsewhere
- Public key comparisons: always `.toUpperCase()` on both sides
- Creator cannot earn rewards from their own campaigns

---

## 4) Implementation Order

Always implement in this sequence — never skip or reverse:

```
1. DB schema  →  2. Core  →  3. Service Worker  →  4. SDK  →  5. UI
```

---

## 5) Project File Structure

```
/core              → campaigns.js, selection.js, validation.js, rewards.js, minima.js
/sdk               → index.js  (public API for publishers)
/dapp              → app.js, /views (creator.js, viewer.js, stats.js)
/renderer          → renderAd.js
/public/service-workers → main.js, db-init.js, /handlers
/refs              → Minima source + official docs (read-only reference)
```

Entry points: `public/service-workers/main.js` (SW) · `dapp/app.js` (FE) · `sdk/index.js` (SDK)

---

## 6) Current Task

Read `TASKS.md` and find the task indicated by the maintainer. That task entry is your complete specification: files to modify, relevant spec sections, constraints, and definition of done.

Do not start implementing until you have read the full task entry in `TASKS.md`.

---

## 7) When You Are Done

Before closing the session, review `TASKS.md` and assess whether anything discovered during this task affects future tasks. If yes, note it explicitly in the handoff — the maintainer will decide whether to update `TASKS.md`.

End every session with this handoff note (required):

```
Task completed: [description]
Files modified: [list]
AGENTS.md updated: yes | no | N/A — [reason if N/A]
Sections updated: [e.g. §8 DB Schema, §9 Protocol Matrix]
Verification: [exact command or check the maintainer should run]
Open issues: [anything discovered but out-of-scope → add to AGENTS.md §14]
Impact on future tasks: [any discovered constraints that affect T[n+1]... → note here]
```
