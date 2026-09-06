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

### Session: 2026-09-06 (audit #11) — Custom Frame `PUBLISHER_WALLET` stored the Maxima public key instead of a spendable wallet address

`dapp/views/frames.js` `_onFrameSubmit` sent `MY_ADDRESS` (Maxima PK) as `publisher_wallet` for custom Frames — confirmed live (Node 2 Frame row identical to `PUBLISHER_KEY`). Fixed by resolving a real coinbase address via `getaddress` (new `_resolvePublisherWalletAddr`, cached in keypair, same pattern as SW's `_resolveViewerAddrAndSend`). Added a defensive fallback in `sdk/index.js` `_openNewPublisherChannel` (regex-checks `PUBLISHER_WALLET` looks like a real 66-char address, falls back to `getaddress` if not) to cover pre-fix rows. Verified live: redeployed, created a fresh Frame, new row's `PUBLISHER_WALLET` is a proper 66-char wallet address distinct from `PUBLISHER_KEY`; the old pre-fix row is unchanged (not retroactively migrated, by design). Files: `dapp/views/frames.js`, `sdk/index.js`. Open issues: audit #7–#10, #12–#15 still open. Full detail: `docs/HISTORY.md §17`, session 2026-09-06 (audit #11).

---

### Session: 2026-09-06 (Fragility #53) — Settlement tx accepted by `txnpost` but never mined: float dust made outputs exceed the channel coin

`public/service-workers/handlers/channel.handler.js` only. A viewer settlement posted with `txnpost status:true` but never confirmed on L1 (channel coin still unspent 25 blocks later). Root cause: `0.1 + 0.2 === 0.30000000000000004` in JS flowed from `_sendRewardRequest` through `REWARD_REQUEST` into `swBuildAndExportVoucherTx`'s `txnoutput … amount:` verbatim, while the sibling refund output was `toFixed(6)`-rounded — the two outputs summed to `1.00000000000000004` against a `1` MINIMA input, and Minima's `Transaction.checkValid()` rejects that (`txnpost` does **no** validation, hence the false success). Confirmed live in the node log: `Transaction error : Inputs LESS than Outputs 1/1.00000000000000004`. Fixed by doing all output arithmetic in integer micro-units (new `swAmtToMicro` / `swCoinAmountToMicro` / `swMicroToAmount` helpers), budgeting against the channel coin's **actual** on-chain amount taken from the `txninput` response rather than the DB `MAX_AMOUNT` copy, and deriving `refund = coin - payout` so the sum is exact by construction; the quantised value is also what goes into the voucher message and the `CHANNEL_STATE` write. Verified live end-to-end on the 6-node harness with a deliberately dusty cumulative (`0.4 + 0.2 === 0.6000000000000001` → `payout: 0.600000 refund: 0.400000`): both outputs mined at block 151, channel now `settled`. Files: `public/service-workers/handlers/channel.handler.js`, `docs/KNOWN_ISSUES.md`. Open issues: same bug class un-fixed in the publisher channel-open path (`effectiveCap`/`reservationCap` float subtraction → `swBuildAndPostChannelTx`); invalid cached vouchers aren't healed by `VOUCHER_SYNC_REQUEST` (creator replays stored hex, doesn't rebuild). Full detail: `docs/HISTORY.md §17`, session 2026-09-06 (Fragility #53).

---

### Session: 2026-09-06 (SDK sender-auth mirror) — audit #5/#6: SDK direct-MAXIMA path never got the AUD-3/AUD-4 guards

`sdk/index.js` only. #5: `handleMdsEvent`'s `CAMPAIGN_PAUSE`/`CAMPAIGN_FINISH` branches now gate `setCampaignStatus` behind the existing `_assertCampaignCreatorSender` (AUD-1's helper) — mirrors AUD-3's SW guard, no separate strong/weak split needed since the SDK has no auto-settle to gate. #6: `_persistCampaignPayload` now resolves the row's strong creator pk (new `_resolveStrongCampaignCreatorPk`, same two sources as the SW's AUD-4 helper) before trusting `saveCampaign`'s `creator_address`/`creator_mx` fields — pins them to the stored values when the sender isn't strongly verified, closing the AUD-1-reopening chain. `saveCampaign` call extracted to `_savePersistedCampaign`. Verified via `node --check` only (syntax) — live E2E needs an SDK-only host with no local SW, which the 6-node harness doesn't exercise (same gap as AUD-2). Files: `sdk/index.js`. Open issues: audit #7–#15 (MEDIUM) still open; no test rig for SDK-only hosts. Full detail: `docs/HISTORY.md §17`, session 2026-09-06 (SDK sender-auth mirror).

---





> Previous handoff notes (AUD-1, patches 15–25, Security Audit 2, and all earlier) are archived in `docs/HISTORY.md §17`.

