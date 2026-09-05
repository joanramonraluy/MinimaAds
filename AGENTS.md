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

1. DB schema, if needed, in both runtimes.
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

## 5) Validation Checklist

Before final handoff:

- Function signatures still match `MinimaAds.md §7`.
- Maxima message schemas still match `MinimaAds.md §8`.
- Outbound Maxima sends use `poll:false`, or documented `sendall`.
- DB schema changes are applied in both runtimes.
- SQL string inputs are escaped.
- Public key comparisons normalize case.
- `LIMITS` values are not duplicated inline.
- Creator self-reward checks remain in selection and validation paths.
- New or changed SW signals are handled in FE.
- `AGENTS.md` and relevant `docs/` files are updated.

For verification procedures, see `docs/archive/VERIFICATION.md`.

---

## 6) Current Handoff Notes

> **Rule**: keep the 3 most recent session entries here. Before adding a new entry, move the oldest one to `docs/HISTORY.md §17`. This section is loaded every session — keep keep it short.

### Session: 2026-09-05 (DOC-1) — Stale flow docs describing pre-M-4 SDK reward flow

**Source**: `docs/KNOWN_ISSUES.md` DOC-1, noted at implementation time of prior session fixes but left open as out-of-scope. Complexity LOW (pure documentation rewrite, no code change). Haiku confirmed directly by maintainer.

**Problem**: MinimaAds.md §6.1 step 6 ("Calls updateBudget(campaignId, reward_view)") and §6.2 step 3 ("updates budget and USER_PROFILE") both predate the M-4 fix that already exists in `core/rewards.js:65–71`. The actual behavior since M-4: `createRewardEvent` skips the local `updateBudget()` call entirely for `type === 'view'` and `type === 'click'` reward types; instead, `BUDGET_REMAINING` is kept in sync via on-chain escrow coin discovery (the SW's `processEscrowCoin` function reads the coin amount on each NEWBLOCK).

**Fix**: rewrote both sentences to reflect the real M-4-compliant behavior:
- §6.1 step 6: "BUDGET_REMAINING is kept in sync via the on-chain escrow coin (processEscrowCoin in SW handles discovery; no local debit)"
- §6.2 step 3: "updates USER_PROFILE; BUDGET_REMAINING is kept in sync via the on-chain escrow coin (processEscrowCoin in SW handles discovery; no local debit)"

**Rationale for change**: the stale docs could mislead a reader or downstream code generator (e.g. for SDK hosted in a foreign MiniDapp). M-4 was a correctness fix to prevent campaigns from premature 'finished' status when local budget updates raced against on-chain state discovery.

**Files modified**: `MinimaAds.md`, `docs/KNOWN_ISSUES.md`.

**AGENTS.md updated**: yes — this entry; oldest entry (2026-09-05, regression — `LIMITS is not defined`) moved to `docs/HISTORY.md §17` to keep the 3-entry limit (now: DOC-1 + #51 + #52).

**Sections updated**: `docs/KNOWN_ISSUES.md` DOC-1 marked Fixed.

**Open issues**: none — DOC-1 was the last purely-documentation item on the backlog.

---

### Session: 2026-09-05 (Fragility #51) — Escrow split tx dropped state port 2 (campaign expiry block)

**Source**: `docs/KNOWN_ISSUES.md` fragility #51, the last open item from `docs/IMPLEMENTATION_PLAN_2026-07-18.md`'s audit (found while implementing Fix #8, deliberately deferred as its own session — protocol-level change to a live escrow spending tx). Complexity HIGH per CLAUDE.md §2 rubric; maintainer confirmed continuing on Sonnet after an interrupted Opus subagent attempt (see below) rather than relaunching.

**Problem**: `_swBuildAndPostChannelTxInner` (`channel.handler.js`) carried forward state ports 1, 3, 4, 7 (+5, 6 when present) from the input escrow coin into the split tx's `stateCmds`, but never port 2 (the funded expiry block). Since `CAMPAIGNS.ESCROW_COINID` is repointed to the change coin after every channel open, every campaign silently lost its on-chain expiry block from its first channel open onwards, degrading Fix #8's block-based expiry check to the wall-clock fallback (`EXPIRES_AT + 24h`) — not catastrophic (margin already covers it) but defeats Fix #8's precision.

**Session note — mid-task interruption**: an Opus subagent was launched for this task; a UI interruption caused it to be cancelled by the harness (non-resumable) mid-verification. Its code edit had already landed on disk (uncommitted) and was correct; picked up from there directly on Sonnet (maintainer's explicit choice) rather than relaunching, re-verifying the applied diff against the plan before proceeding.

**Fix**: extract `ps2` from `r2.response.transaction.inputs[0].state` (same loop as `ps5`/`ps6`/`ps7`), then `if (ps2) { stateCmds.push("txnstate id:" + txId + " port:2 value:" + ps2); }` — plain decimal, no `0x` prefix, same as ports 10/11. Since `stateCmds` is shared by both split-tx outputs (channel-funding coin + change coin that becomes the new `ESCROW_COINID`), one change point was sufficient — `swBuildAndPostChannelOpenTx` (Tx2, the 2-of-2 channel coin) was correctly left untouched, it isn't the coin Fix #8 tracks. Purely additive: neither ESCROW_SCRIPT_V3 nor V4 reads `PREVSTATE(2)`, so no `ASSERT`/`VERIFYOUT` branch could be affected.

**Verification — live, against the 6-node test harness**: redeployed (`latest-deploy.mds` timestamp confirmed *after* the code edit, so all 6 nodes ran the patched build). Found one pre-existing campaign already degraded by this exact bug (channel opened pre-fix — its escrow coin has no port 2, confirmed via `coins coinid:`, and correctly still falls back to wall-clock post-fix, since the fix cannot retroactively repair a coin that already lost the port). Used a second, untouched campaign (original escrow coin carrying `port:2 = 3589`) as the live test: a real viewer node (different wallet identity, not the creator) opened a real channel against it via the actual UI view flow (`#campaign-detail`, real "watching ad" reward path, not a direct `MDS.cmd` call). Confirmed via `coins coinid:` on the resulting change coin (`0x9039F1D1...`, amount 99.8, i.e. the real post-split coin): **port 2 present, value 3589 — same as the original**, alongside all previously-carried ports (1,3,4,5,6,7,10,11,16) unchanged. Went further than the minimum ask: a second successive spend of that same escrow chain (`0xBAF97DA6...`, after the view reward's own settlement cycle) still carried `port:2 = 3589`, confirming the fix survives more than one hop. `checkExpiredCampaigns` logged `block 222 vs escrow expiry 3589` for this campaign with no "no state port 2" fallback message, confirming Fix #8 now reads a real block-based deadline off a post-patch escrow coin end-to-end.

**Files modified**: `public/service-workers/handlers/channel.handler.js`, `docs/KNOWN_ISSUES.md`.

**AGENTS.md updated**: yes — this entry; oldest entry (2026-09-05, Fix #15) moved to `docs/HISTORY.md §17`.

**Sections updated**: `docs/KNOWN_ISSUES.md` #51 marked Fixed.

**Open issues**: none — this was the last open item from `docs/IMPLEMENTATION_PLAN_2026-07-18.md`'s audit. Phases 1–4 plus both fragilities found during Fix #8 (#51, #52) are now all closed.

---

### Session: 2026-09-05 (Fragility #52) — Dead PREVSTATE(5)/(6) validation on campaign announces

**Source**: `docs/KNOWN_ISSUES.md` fragility #52, found (but out of scope) while implementing Fix #8. Complexity MEDIUM (one-line code change, but activates a previously-dead security check — maintainer confirmed Sonnet directly, no delegation). Picked up after Fix #8/#15/#17/#18/#19 and the LIMITS regression closed out Phases 1–4.

**Problem**: `_continueCampaignAnnounce` (`campaign.handler.js`) read `res.response[0].prevstate` to verify a campaign's escrow coin carries the locally-configured `PLATFORM_KEY`/`FOUNDATION_KEY` at state ports 5/6. Minima's `Coin.toJSON()` never emits a `prevstate` key (confirmed against `refs/Minima-1.0.45/src/org/minima/objects/Coin.java` and empirically against a real coin) — only `state`. So `prevstates` was always `[]`, both key checks always no-opped, and a `CAMPAIGN_ANNOUNCE` was accepted regardless of whether its escrow's real on-chain keys matched. Same bug family as Fix #6 (that one made the coin unfindable; this one made the state unreadable even once found).

**Fix**: one line — `var prevstates = res.response[0].state || [];` — plus a comment explaining the naming trap ("PREVSTATE(n)" in the specs means the coin's *current* state, which becomes PREVSTATE on its *next* spend).

**Risk considered before touching it**: this activates a check that was previously silently inert. If `PLATFORM_KEY`/`FOUNDATION_KEY` are misconfigured anywhere (mismatched across nodes, or not actually written into escrow state the way the check expects), announces that used to pass unconditionally could start being silently dropped. Confirmed this is a real live path in the current test topology — all 6 nodes have `PLATFORM_KEY`/`FOUNDATION_KEY` overridden (not null), so `localPlatformSet`/`localFoundationSet` are true and the check actually runs (the `!localPlatformSet && !localFoundationSet` early-out at the top of the function does NOT apply here).

**Verification — live, positive path only**: redeployed to all 6 nodes. Created a brand-new real campaign (node 1) after the fix — real escrow coin, real state port 5/6 values written by `creator.js`. Confirmed on a remote node (node 5) via `sqlQuery`: the `CAMPAIGN_ANNOUNCE` propagated and persisted (`STATUS='active'`) exactly as before the fix — the now-real key check did not reject a legitimate campaign. **Negative path (crafted announce against a coin with a deliberately mismatched port 5/6, confirming the check now actually rejects) was not attempted** — judged disproportionate for a one-line change already root-caused precisely against Minima's own source, given the session's time already invested; noted in `docs/KNOWN_ISSUES.md` #52 if the maintainer wants that extra rigor later.

**Also fixed this session, found by chance while setting up this verification**: a live regression from yesterday's Fix #13 commit — `creator.js`'s `buildChannelScriptFE()` was evaluated eagerly at script-load time, before `dapp/app.js` (loaded after it in `index.html`) had defined the global `LIMITS` it depends on, throwing `ReferenceError: LIMITS is not defined` on every Creator page load and leaving `CHANNEL_SCRIPT_ADDRESS` resolution broken. Fixed by computing it lazily at the point of use instead of at module scope. See commit history for full detail — this was significant enough to warrant its own commit, done immediately rather than batched with #52.

**Files modified**: `public/service-workers/handlers/campaign.handler.js`, `docs/KNOWN_ISSUES.md`.

**AGENTS.md updated**: yes — this entry; oldest entry (2026-09-05, Fix #18) moved to `docs/HISTORY.md §17`.

**Sections updated**: `docs/KNOWN_ISSUES.md` #52 marked Fixed.

**Open issues**: fragility #51 (escrow split tx drops state port 2, degrades Fix #8 after first channel open) is the one remaining open item from the audit — HIGH complexity, protocol-level change to a live escrow spending tx, needs its own dedicated session with Opus + plan mode and real split+channel-open verification, same rigor as Fix #8 itself.

---





> Previous handoff notes (AUD-1, patches 15–25, Security Audit 2, and all earlier) are archived in `docs/HISTORY.md §17`.

