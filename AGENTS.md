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

> **Rule**: keep the 3 most recent sessions here, as **short pointers only** — one-line summary + files touched + open issues, ending with a reference to the full narrative in `docs/HISTORY.md §17`. The full problem/fix/verification write-up is written **once**, directly into `docs/HISTORY.md §17`, never duplicated here. When adding a new entry pushes this past 3, just **delete** the oldest pointer — nothing to move, its full content already lives permanently in `docs/HISTORY.md §17`. This section is loaded every session — keep it short.

### Session: 2026-09-11 (T-REP1) — first-party reputation evidence: schema, core/reputation.js, settlement hooks

Continuation of the AUD-6/T-REP0 session below. Built the scope T-REP1 was staged for: two new tables (`REPUTATION_EVENTS` append-only evidence log, `PEER_REPUTATION` derived score cache — `MinimaAds.md §3.5`), new module `core/reputation.js` (`MinimaAds.md §7.8`), `REPUTATION` scoring constants mirrored in `service.js`/`dapp/app.js`. Shared hook `recordSettlementReputationEvidence` fires only after a settlement is confirmed post-on-chain-spend (`channel.handler.js` `_processSettledChannels`, `dapp/app.js` `handleFePending` settlement_post branch), and follows a never-self rule: records `settled_channel` evidence about the creator unless this node *is* the creator, in which case only a publisher-role settlement records `publisher_settled` evidence about the frame's publisher instead (a viewer-role one would be self-observation, skipped). Found and fixed inline: `MY_MAXIMA_PK` (SW) vs `MY_ADDRESS` (FE) naming mismatch for "my own pk" — no shared core file had needed that comparison before — via a `typeof`-guarded `_myMaximaPk()` helper. Live-verified on the redeployed 5-node harness: clean reload with zero `[DB] initDB: failed to create` lines fleet-wide; a direct FE-console smoke test round-tripped `recordReputationEvent`→`getReputation`→`listReputationEvidence` correctly and confirmed idempotency (repeat call, still 1 row, score not doubled). Files: `public/service-workers/db-init.js`, `dapp/app.js`, `service.js`, `core/reputation.js` (new), `public/service-workers/handlers/channel.handler.js`, `public/index.html`, `MinimaAds.md §3.5/§7.8`, `docs/TASKS.md`. Open issues: `recordSettlementReputationEvidence` not yet exercised against a real channel settlement (needs a fresh open-to-settle cycle); T-REP2 is next. Full detail: `docs/HISTORY.md §17`, session 2026-09-11 (T-REP1).

---

### Session: 2026-09-11 (AUD-6 / T-REP0) — PROFILE_RESPONSE spoofing closed, first step of the auth/reputation roadmap item

Maintainer prioritized "auth/reputation" (of the 4 `docs/TASKS.md` roadmap items) over analytics/cross-dApp settlement/governance. Opus design pass (plan mode, no code) split it into T-REP0 (this session) / T-REP1 / T-REP2 (MEDIUM/HIGH, not started) / T-REP3 (XHIGH signed attestations, separate future approval) — Phases 1–2 add zero new Maxima messages and zero new fields on protected entities, so only Phase 3 is a genuine new trust model. Along the way found `PROFILE_RESPONSE` was unauthenticated: `handleProfileResponse` trusted `payload.publickey` with no check against the real Maxima sender, letting any node poison a third party's cached name/avatar (`CREATOR_PROFILE_<PK>`) — fixed by requiring `payload.publickey.toUpperCase() === msg.data.from.toUpperCase()`. Live-verified on the redeployed 5-node harness (same adversarial pattern as the 2026-09-10 OPEN-3 probe): a forged `PROFILE_RESPONSE` from Node 4 claiming Node 1's key was dropped by Node 2 (logged mismatch, `CREATOR_PROFILE_<PK>` stayed `null`), while a real `PROFILE_REQUEST`→`PROFILE_RESPONSE` round-trip between the same two nodes still cached the correct name. Files: `public/service-workers/handlers/maxima.handler.js`, `public/service-workers/handlers/campaign.handler.js`, `MinimaAds.md §8.18`, `docs/KNOWN_ISSUES.md` (new row AUD-6). Open issues: T-REP1/2/3 not started; 3 pre-existing doc conflicts flagged during design (`CLAUDE.md §5` stale API list, `KNOWN_ISSUES.md §4` vs `AGENTS.md §2.2` on `ALTER TABLE`, `MinimaAds.md §10.1` vs §5/§5.1 on `MAX_VIEWS_PER_CAMPAIGN_PER_DAY`) remain unresolved. Full detail: `docs/HISTORY.md §17`, session 2026-09-11 (AUD-6 / T-REP0).

---

### Session: 2026-09-10 (Fragility #61) — root cause found and fixed: SDK creator-route detection never recognized `MAX#pk#mls` routes

Closed `docs/KNOWN_ISSUES.md` fragility #61. Not a relay/MLS staleness issue as originally hypothesized — ruled that out live first (6/6 raw `sendMaxima` PING/PONG round-trips succeeded immediately post-redeploy). Root cause: `sdk/index.js`'s `_sendLivenessPing`/`_sendToCreator` checked `creatorRoute.substring(0,2) === 'MX'` to pick `to:` vs `publickey:` routing, which never matches a `MAX#<pk>#<mls>` permanent route (`"MAX#..."` → `"MA"`, not `"MX"`) — exactly what `campaign.handler.js` normally stores in keypair `CREATOR_MX_<campaignId>`. Every such route got sent as a malformed `publickey:MAX#...` value, deterministically failing `"No Contact found"`. Fixed with a new shared `_isMaximaRouteString()` helper recognizing both prefixes. Live-verified: `MinimaAds.trackView()` now succeeds where it always failed before; this also unblocked OPEN-5's deferred live E2E verification (real channel, real voucher, real settlement tx mined on-chain, reward paid — see full detail). Files: `sdk/index.js`. Open issues: none new — `_checkOpenChannelsSettled`'s own NEWBLOCK path wasn't directly observed firing (the SW's identical logic won the race on the SW-installed test tab used), flagged for a future no-SW-tab session if it matters. Full detail: `docs/HISTORY.md §17`, session 2026-09-10 (Fragility #61).

---

> Previous handoff notes (2026-09-10 OPEN-3 adversarial regression probe, 2026-09-09 Fragility #60, 2026-09-09 OPEN-5, 2026-09-09 Fragility #58, 2026-09-07 OPEN-3, AUD-1, patches 15–25, Security Audit 2, and all earlier) are archived in `docs/HISTORY.md §17`.

