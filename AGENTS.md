# AGENTS.md — MinimaAds Agent Guide

Last compacted: 2026-05-18
Scope: `/home/joanramon/Minima/MinimaAds`

This is the short operative guide for agents. Long-form reference material lives in `docs/`.

---

## 0) Mandatory Update Mandate

Any agent making modifications to this repository must update this file before finishing.

Handoff notes must include:
- `AGENTS.md updated: yes/no`
- If `yes`, list affected sections.
- If intentionally not applicable, write `AGENTS.md: N/A` and explain why.

For detailed changes that would make this file noisy, update the relevant document in `docs/` and add only a short pointer here.

---

## 1) Source Of Truth

This project is governed by two documents:

| Document | Role | Authority |
|---|---|---|
| `MinimaAds.md` | Functional and architectural specification | Highest |
| `AGENTS.md` | Operative guide for agents | Derived from `MinimaAds.md` |

If `AGENTS.md` and `MinimaAds.md` conflict, `MinimaAds.md` wins.

Before implementing a feature, read the relevant sections of `MinimaAds.md` and the relevant reference document:

| Topic | Reference |
|---|---|
| Minima/MDS/H2/Rhino platform rules | `docs/PLATFORM_NOTES.md` |
| Project topology, DB mirror, protocols, signals | `docs/PROJECT_NOTES_REFERENCE.md` |
| Fragility points and open bugs | `docs/KNOWN_ISSUES.md` |
| Active task list | `docs/TASKS.md` |
| Long change history | `docs/HISTORY.md` |
| Archived docs (UI guides, roadmaps, old tasks) | `docs/archive/` |

---

## 2) CRITICAL: Model Assessment Protocol

**Before ANY investigation or code changes:**

1. Self-assess task complexity using `CLAUDE.md §2` rubric
2. **Publicly output your assessment** (not just in thinking):
   - Complexity level
   - Reasoning
   - Recommended model
3. **Ask user for confirmation** and WAIT for response
   - "Vols que delegui a [Model], o [current model] va bé?"
4. Only proceed after explicit user approval

See `CLAUDE.md §2` "CRITICAL: Public Assessment → Suggestion → User Confirmation" for full details.

---

## 3) Required Workflow

1. Read the relevant `MinimaAds.md` sections first.
2. Check `docs/KNOWN_ISSUES.md` for known fragility points or open bugs in the touched area.
3. If Minima platform behavior is unclear, consult source and official docs under `refs/`. See `CLAUDE.md §8` for the lookup table.
4. Identify affected layers before editing.
5. Implement in dependency order.
6. Validate contracts, schema parity, Maxima fields, and `poll:false`.
7. Update `AGENTS.md` and, when needed, the relevant `docs/` reference file.

Layer map:

| Layer | Files | MinimaAds.md ref |
|---|---|---|
| Core | `core/*.js` | §7 |
| Service Worker | `service.js`, `public/service-workers/handlers/*.js`, `public/service-workers/db-init.js` | §11 |
| Database schema | `public/service-workers/db-init.js` plus FE initialization | §3.5 |
| SDK | `sdk/index.js` | §13 |
| UI / MiniDapp | `dapp/app.js`, `dapp/views/*.js` | §12.1 |

Implementation order:

1. DB schema, if needed, in both runtimes (SW for all tables; FE for tables touched by FE).
2. Core.
3. Service Worker handlers.
4. SDK.
5. UI.

---

## 3.5) Contracts, Forbidden Actions, Platform Rules

These are defined in `CLAUDE.md` (always loaded). Do not repeat them here.

- **Stable Core API signatures** → `CLAUDE.md §5`
- **Forbidden actions** → `CLAUDE.md §6`
- **Rhino / H2 / MDS / Maxima runtime constraints** → `CLAUDE.md §7`
- **Full platform detail** → `docs/PLATFORM_NOTES.md`

Additional constraints not in CLAUDE.md:
- Do not call `MDS.sql` directly outside `core/minima.js` (except legacy FE code predating the wrapper — prefer the wrapper for new code).
- `maxima action:sendall` does not support `poll:false` — that is the one documented exception to the poll:false rule.
- SDK public API (`sdk/index.js`) is an external publisher contract. Treat any change as breaking unless explicitly approved.

---

## 4) Project Rules

Full project notes live in `docs/PROJECT_NOTES.md` (topology, schema) and `docs/PROJECT_NOTES_REFERENCE.md` (protocol detail, signals, source-of-truth rules).

Project identity:
- MinimaAds is a decentralized advertising infrastructure MiniDapp.
- Viewers earn for ad views/clicks.
- Creators fund campaigns through Minima token escrow.
- Publishers operate Frames and earn publisher rewards.

Canonical identities:
- `USER_PROFILE.ADDRESS` and `CAMPAIGN.CREATOR_ADDRESS` are Maxima public keys.
- `FRAMES.FRAME_ID` for the built-in frame is `builtin:<MAXIMA_PK>`.
- `CAMPAIGNS.ESCROW_WALLET_PK` is a wallet signing key, not a Maxima key.

Key architectural decisions (non-obvious — read before assuming):

| Decision | Rationale |
|---|---|
| Reward processing is FE-owned, not SW | FE and SW share the same H2 DB; SW adds complexity with no security benefit — KissVM is the real boundary |
| `CREATOR_ADDRESS` uses Maxima PK, not wallet address | Maxima PK is the stable node identity; wallet address can change and is not used for Maxima routing |
| `broadcastMaxima` uses `sendall` | `maxima action:sendall` is always background; poll stack cap doesn't apply |
| Built-in Frame ID = `'builtin:' + maxima_pk.toUpperCase()` | Deterministic, idempotent, unique per node — avoids requiring manual "install" |
| Publisher rewards reuse channel infra with `ROLE` discriminator | `CHANNEL_STATE` PK is `(campaign_id, viewer_key, role)` — same lifecycle, same handlers, same contract |
| Single budget covers viewer + publisher rewards | `MAX_PUBLISHER_BUDGET` is a capped subset of `BUDGET_TOTAL` — simpler UI and escrow |
| `PLATFORM_KEY` enforced on-chain via KissVM PREVSTATE(5) | Tampering `config.js` on one node is self-defeating — every other node rejects the campaign. MVP: `null` (validation skipped) |
| No `TextEncoder` in SW | Rhino doesn't support it — use pure-JS `utf8ToHex` |
| `VERIFYOUT` requires 5 params | `VERIFYOUT(idx addr amt tokenid keepstate_bool)` — older docs had 4 |
| `PUBLISHER_MX_<campaignId>` keypair on viewer nodes | Cached from `PENDING_REWARD` when channel opens; used as fallback in `_sendRewardRequest` when `MINIMAADS_CREATOR_ROUTE` is not set locally |

Important files:

| File | Responsibility |
|---|---|
| `service.js` | Runtime SW entry point |
| `public/service-workers/db-init.js` | SW schema initialization |
| `dapp/app.js` | FE entry point, routing, MDS event dispatch |
| `dapp/views/*.js` | UI views |
| `core/*.js` | Business logic |
| `sdk/index.js` | External publisher SDK |
| `renderer/renderAd.js` | Ad DOM renderer |

---

### 4.1) H2 DDL Syntax — measured capability matrix

Minima opens its H2 as `jdbc:h2:<path>;MODE=MySQL;DB_CLOSE_ON_EXIT=FALSE` with `autoCommit = true` (`SqlDB.java:66`, which `MiniDAPPDB` extends). **`MODE=MySQL` changes which DDL spellings parse**, so H2 documentation and answers written for default-mode H2 (or for H2 2.2/2.3, where this syntax moved again) are not evidence about this project. The table below was executed against the project's own bundled jar (`refs/Minima-1.0.45/lib/h2-2.1.214.jar`) using those exact settings — do not "correct" it from memory.

| Statement | Result |
|---|---|
| `ALTER TABLE t ADD COLUMN IF NOT EXISTS c T DEFAULT d` | ✅ idempotent — **the only way to add a column** |
| `ALTER TABLE t ALTER COLUMN IF EXISTS c SET DATA TYPE T` | ✅ **idempotent retype primitive** — applies when present, no-ops when absent |
| `ALTER TABLE t ALTER COLUMN IF EXISTS old RENAME TO new` | ✅ **idempotent rename primitive** — silently no-ops when `old` is absent |
| `ALTER TABLE t DROP COLUMN IF EXISTS c` | ✅ idempotent |
| `ALTER TABLE IF EXISTS t …` | ✅ no-ops on a missing table, and **composes** with `ALTER COLUMN IF EXISTS` |
| `ALTER TABLE t RENAME COLUMN old TO new` | ⚠️ works once, then **errors** on re-run (`Column "OLD" not found`). `RENAME COLUMN IF EXISTS` is a ❌ syntax error. Unusable. |
| `ALTER TABLE t MODIFY COLUMN c T` | ⚠️ works, but `MODIFY COLUMN IF EXISTS` is a ❌ syntax error. Unusable. |
| `ALTER TABLE t CHANGE COLUMN old new T` | ⚠️ works, but `CHANGE COLUMN IF EXISTS` is a ❌ syntax error. Unusable. |
| `RENAME TABLE a TO b` (MySQL spelling) | ❌ syntax error even in `MODE=MySQL` — use `ALTER TABLE IF EXISTS a RENAME TO b` ✅ |
| `DROP COLUMN c` unguarded, when absent | ❌ `Column "C" not found [42122-214]` |
| `CREATE TABLE IF NOT EXISTS x AS SELECT …` / `CREATE INDEX IF NOT EXISTS` / `DROP INDEX IF EXISTS` | ✅ all idempotent |
| `MERGE INTO t (cols) KEY (id) VALUES (…)` | ✅ the upsert form — `INSERT … ON CONFLICT` still ❌ does not exist |
| `SELECT … FROM INFORMATION_SCHEMA.COLUMNS / .TABLES` | ✅ feature detection by name, declared type, `CHARACTER_MAXIMUM_LENGTH` |

**Only the ✅-idempotent forms may be used in a migration.** Four semantics worth knowing before writing one:

- **No transactions exist.** `autoCommit = true` and H2 auto-commits DDL regardless — a `CREATE TABLE` survives an explicit `rollback()`. Multi-statement atomicity is **not available**; no design may assume it. Several `;`-separated statements in one `MDS.sql` string buys ordering, not atomicity — statements before a failure persist.
- **A failed type change is a clean no-op**, not a corruption: no leftover `_COPY_` table, original type unchanged, all rows intact. (A type change is internally a full table rewrite via `T_COPY_<n>_<m>`.) Widening preserves data, PK and named indexes.
- **Errors are returned, never thrown** — `sqlQuery` surfaces them as `cb(err)`, so a callback written `function() { … }` with no `err` parameter silently ignores a failed migration. Migration callbacks must inspect `err`.
- **Two sharp edges**: `DROP COLUMN IF EXISTS <primary key column>` **succeeds** without complaint — review is the only guard. And `ALTER COLUMN IF EXISTS old RENAME TO new` fails with `Duplicate column name` if both names exist, so **never add a column with the same name a pending rename targets**.

Full measurement detail: `docs/HISTORY.md §17`, session 2026-09-12 (OPEN-6). Mechanism and migration classes: `MinimaAds.md §3.5`, `core/schema.js`.

---

## 5) Validation Checklist

Before final handoff:

- Function signatures still match `MinimaAds.md §7`.
- Maxima message schemas still match `MinimaAds.md §8`.
- Outbound Maxima sends use `poll:false`, or documented `sendall`.
- DB schema changes are applied in both runtimes (SW for all tables; FE for tables touched by FE).
- **A destructive migration is always a paired change**: update the `CREATE TABLE` definition in *both* `public/service-workers/db-init.js` and `dapp/app.js` **and** append the Class B/C entry to `SCHEMA_MIGRATIONS_LIST` in `core/schema.js`. Doing only the first breaks upgrades; doing only the second leaves fresh installs on the old shape. Both, always — and the list is append-only (never reorder, never edit a shipped entry, never reuse an id). Only the ✅-idempotent DDL forms in §4.1 are permitted.
- SQL string inputs are escaped.
- Public key comparisons normalize case.
- `LIMITS` values are not duplicated inline.
- Creator self-reward checks remain in selection and validation paths.
- New or changed SW signals are handled in FE.
- `AGENTS.md` and relevant `docs/` files are updated.

For verification procedures, see `docs/archive/VERIFICATION.md`.

---

## 6) Current Handoff Notes

> **Rule**: keep the 3 most recent sessions here, as **short pointers only** — one-line summary + files touched + open issues, ending with a reference to the full narrative in `docs/HISTORY.md §17`. The full problem/fix/verification write-up is written **once**, directly into `docs/HISTORY.md §17`, never duplicated here. When adding a new entry pushes this past 3, just **delete** the oldest pointer — nothing to move, its full content already lives permanently in `docs/HISTORY.md §17`. This section is loaded every session — keep it short.

### Session: 2026-09-12 (MVP-DECISIONS + REGRESSION-PLAN) — MVP trade-off decisions, regression test plan, and full live verification

Closed the only two genuine "for MVP" behaviors in `docs/KNOWN_ISSUES.md §1` (fragility #24, #45) as permanent trade-offs by design, decided by the maintainer. Built `docs/REGRESSION_TEST_PLAN.md` (Tier 1: `tests/regression/*.test.js`, plain Node, 4 passing tests; Tier 2: 5-entry live-node checklist). Then live-verified all 5 Tier 2 entries in one session on the real 5-node harness, including two genuine adversarial attacks (a real forged Maxima `CAMPAIGN_FINISH` and a real forged on-chain coin at `ESCROW_ADDRESS`) — all 5 **PASS**. Side effect: fixed a real `selectAd()` signature drift (`blockedCreators` param missing from `CLAUDE.md §5` / `MinimaAds.md §6.4/§7.2`). Files: `docs/KNOWN_ISSUES.md`, `docs/REGRESSION_TEST_PLAN.md` (new), `docs/DOCUMENTATION_INDEX.md`, `tests/regression/*` (new), `MinimaAds.md`, `CLAUDE.md`. Open issues: harness now carries real test state (active campaign, settled channel) — `⚠ DELETE ALL DATA ⚠` before a clean-slate session. Full detail: `docs/HISTORY.md §17`, session 2026-09-12 (MVP-DECISIONS + REGRESSION-PLAN).

---

### Session: 2026-09-12 (KNOWN-ISSUES-AUDIT) — Comprehensive audit and cleanup of `docs/KNOWN_ISSUES.md`

Audited `docs/KNOWN_ISSUES.md`: verified 0 active bugs in §1b; added rows for Proposal, OPEN-6, OPEN-7, OPEN-8, OPEN-9, OPEN-10 to §3 Closed/Fixed table; updated §4 Development Workflow Rule to reflect OPEN-6 schema migration mechanism (`core/schema.js`). Files: `docs/KNOWN_ISSUES.md`, `AGENTS.md`, `docs/HISTORY.md`. Open issues: none. Full detail: `docs/HISTORY.md §17`, session 2026-09-12 (KNOWN-ISSUES-AUDIT).

---

### Session: 2026-09-12 (OPEN-6-IMPL) — H2 schema migration mechanism implemented (`core/schema.js`)

Implemented the OPEN-6 design: new shared `core/schema.js` (`SCHEMA_MIGRATIONS_LIST` + `runSchemaMigrations(runtimeTag, done)`) loaded and run by **both** runtimes, `SCHEMA_MIGRATIONS` bookkeeping table (Class C only), first real migration `2026-09-12-001` widening `FRAMES.PUBLISHER_MX` 512→1024 in both `CREATE TABLE`s, failed migrations non-fatal and surfaced via new `SCHEMA_MIGRATION_FAILED` signal; added AGENTS.md §4.1 measured H2 DDL capability matrix. The ~30 existing `ADD COLUMN IF NOT EXISTS` statements are deliberately untouched. Files: `core/schema.js` (new), `service.js`, `public/service-workers/db-init.js`, `public/index.html`, `dapp/app.js`, `MinimaAds.md`, `AGENTS.md`, `docs/KNOWN_ISSUES.md`, `docs/HISTORY.md`. Open issues: OPEN-10 (unmeasured — whether real Maxima routes ever exceeded 512 chars); two `MinimaAds.md §3.5` drift mismatches from the OPEN-6 §11 side findings were already closed by OPEN-8. Full detail: `docs/HISTORY.md §17`, session 2026-09-12 (OPEN-6-IMPL).

---

> Previous handoff notes (2026-09-12 REP-VIEWER — creator reputation badge, local blocklist & flagged-ad filtering in Viewer; 2026-09-12 OPEN-8, 2026-09-11 T-REP1, 2026-09-10 Fragility #61, 2026-09-11 AUD-6/T-REP0, 2026-09-10 OPEN-3 adversarial regression probe, 2026-09-09 Fragility #60, 2026-09-09 OPEN-5, 2026-09-09 Fragility #58, 2026-09-07 OPEN-3, AUD-1, patches 15–25, Security Audit 2, and all earlier) are archived in `docs/HISTORY.md §17`.

