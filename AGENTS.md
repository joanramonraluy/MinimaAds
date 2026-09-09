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

### Session: 2026-09-09 (OPEN-4) — forged escrow coins can no longer hijack a campaign; discovery gated on escrow-coin lineage

Closed `docs/KNOWN_ISSUES.md` OPEN-4: `processEscrowCoin` acted on *any* coin at the public `ESCROW_ADDRESS` with no authentication — a forged dust coin could poison `CREATOR_MX_<id>` (the strong identity `_assertCreatorThen` trusts → forged `CAMPAIGN_FINISH`), set a permanent forged `finished`, rewrite budget, and re-point `ESCROW_COINID`. Fixed by splitting `processEscrowCoin` into parse → `_resolveEscrowCoinTrust` (forward-lineage gate: a coin is trusted only if it equals the stored `ESCROW_COINID` anchor or is a hash-derivable descendant within 2 generations — `SHA3-256(0x00000020||parent||0x0001<i>)`) → `_applyTrustedEscrowCoin` (original body, now the only place `CREATOR_MX_<id>` is written) / `_processUnknownCampaignCoin` (genesis binding) / `_requestReanchorFromStoredCreator`; anchor pinned as an AUD-4 identity field; anchor added to `CAMPAIGN_DATA_RESPONSE`. New Core helpers `escrowChildCoinId`/`escrowDescendantSet`. Code was pre-existing/uncommitted from a prior session; this session verified it live (no further code change needed). Live results on the 6-node harness: adversarial forged coin REJECTED on all 6 nodes with victim keypair/DB byte-identical (F1 poisoning closed); bonus AUD-3 spoofed `CAMPAIGN_FINISH` rejected; derivation formula verified against real CoinIDs; full Pause→Resume→Finish cycle propagated with clean lineage; viewer settlement code path ran fully but its channel could not reach `'settled'` — blocked by pre-existing **fragility #58** (stale ~16h voucher MMR proof, `txncheck` shows `mmrproofs:false`), unrelated to OPEN-4. Files (uncommitted): `core/campaigns.js`, `public/service-workers/handlers/campaign.handler.js`, `service.js`. Open issues: OPEN-5, fragility #56 (unchanged), fragility #58 (hit again — still needs its own session). Full detail: `docs/HISTORY.md §17`, session 2026-09-09 (OPEN-4).

---

### Session: 2026-09-08 (publisher auto-settle) — Fix #12's publisher skip removed after confirming delivery reliability

Implemented the `docs/KNOWN_ISSUES.md §1b` "Proposal": removed `dapp/app.js` `_autoSettleOpenChannels`'s `if (role === 'publisher') { return; }` (Fix #12, 2026-07-18) so publisher channels auto-settle on campaign finish exactly like viewer channels — `_runSettlement`/`_postSettleTx` were already fully role-agnostic. Phase 1 (required first): confirmed `PUBLISHER_REWARD_NOTIFY` delivery is reliable — 3/3 real sends on the live harness, `CHANNEL_STATE` populated on the publisher's own node within ~25s each — resolving F2's original unconfirmed "5+ minutes silence" concern (not reproduced; most likely a short test window, not a delivery bug). Live-verified end to end twice: first attempt hit an unrelated stale-MDS-session gotcha (§11.1) plus a genuine newly-found fragility (stale voucher MMR proof after ~18 min/60 blocks — see fragility 58); second attempt, with normal ~30s timing, ran the full automatic signal chain to `onSettleConfirmed` and `CHANNEL_STATE.STATUS='settled'`. Files: `dapp/app.js`, `MinimaAds.md` §4.5. Open issues: OPEN-4, OPEN-5, fragility 56 (unchanged), plus new **fragility 58** (stale voucher MMR proofs can silently fail settlement — needs its own session). Full detail: `docs/HISTORY.md §17`, session 2026-09-08 (publisher auto-settle).

---

### Session: 2026-09-08 (live verification: OPEN-3) — real Finish, real open channel, settled within 35s

Live-verified the previous session's OPEN-3 fix on the redeployed 6-node harness (no code changes this session). Core regression (PASS): a real Node 3 viewer channel — F2's exact broken case — reached `CHANNEL_STATE.STATUS='settled'` within ~35s of a real Finish, with `MDS.cmd("coins coinid:...")` ground truth confirming `STATE(7)="finished"` on-chain. Publisher exclusion (PASS, via the built-in Frame rather than a separate Node 2 custom Frame — same gated code path): stayed `'open'`, manual Settle still worked. Pause (PASS): no `[AUTOSETTLE]` fired at all, channel stayed open. Not completed: an adversarial AUD-3 regression probe (genuinely spoofed `CAMPAIGN_FINISH` from an untrusted sender) — a real attempt hit a node-level `"MAX address invalid.."` error building the raw contact string outside the app's own trusted context; inconclusive, not a pass or fail, worth retrying with a working method. Files: none (verification only). Open issues: same as previous session (OPEN-4, OPEN-5, fragility 56), plus the still-unverified AUD-3 boundary on the new propagation path. Full detail: `docs/HISTORY.md §17`, session 2026-09-08 (live verification: OPEN-3).

---

> Previous handoff notes (2026-09-07 OPEN-3, AUD-1, patches 15–25, Security Audit 2, and all earlier) are archived in `docs/HISTORY.md §17`.

