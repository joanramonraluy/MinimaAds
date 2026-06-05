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
| Project topology, DB mirror, protocols, signals | `docs/PROJECT_NOTES.md` (and `PROJECT_NOTES_REFERENCE.md` if needed) |
| Fragility points and open bugs | `docs/KNOWN_ISSUES.md` |
| Active task list | `docs/TASKS.md` |
| New session prompt template | `docs/PromptBase.md` |
| Verification workflow | `docs/VERIFICATION.md` |
| Long change history | `docs/HISTORY.md` |
| UI-only tasks (views, CSS, copy) | `docs/UI_GUIDE.md` |

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

## 3) Contracts, Forbidden Actions, Platform Rules

These are defined in `CLAUDE.md` (always loaded). Do not repeat them here.

- **Stable Core API signatures** → `CLAUDE.md §4`
- **Forbidden actions** → `CLAUDE.md §5`
- **Rhino / H2 / MDS / Maxima runtime constraints** → `CLAUDE.md §6`
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

For verification procedures, see `docs/VERIFICATION.md`.

---

## 6) Current Handoff Notes

> **Rule**: keep the 3 most recent session entries here. Before adding a new entry, move the oldest one to `docs/HISTORY.md §17`. This section is loaded every session — keep it short.

### Session: 2026-06-05 — Include CREATOR_PERMANENT_ROUTE in REWARD_REQUEST Payload

**Task**: Add `publisher_mx` field to the `REWARD_REQUEST` Maxima payload in `_sendRewardRequest`, carrying the creator's permanent Maxima route (`CREATOR_PERMANENT_ROUTE` keypair value) so the creator node can send `PUBLISHER_REWARD_NOTIFY` back via a stable route.

**Changes**:
- **public/service-workers/handlers/comms.handler.js** (`_sendRewardRequest`, lines ~344–367):
  - Wrapped the entire payload-build-and-send logic inside a `getCreatorMaximaRoute()` callback.
  - Added `publisher_mx: creatorRoute || ""` to the `payload` object, alongside the already-present `frame_id`.
  - `getCreatorMaximaRoute` is defined in `core/minima.js`, which is loaded before this handler in `service.js` — no new dependency.

**Why**: The creator node needs a permanent routing address to send `PUBLISHER_REWARD_NOTIFY` back. Without `publisher_mx`, the creator has no stable Maxima address for the viewer/publisher and must rely on dynamic routing alone.

**AGENTS.md updated**: yes — §6 added this entry; oldest (Add Creator Permanent Route Configuration to DevTools) moved to `docs/HISTORY.md §17`.

**Verification**:
- Open `#viewer` on a viewer node and watch an ad for ≥3 s.
- In SW logs on the viewer node, confirm `REWARD_REQUEST sent` appears.
- On the creator node, decode the received `REWARD_REQUEST` payload and confirm `publisher_mx` is present (a `MAX#...` string or empty string if route not yet set).
- No console errors expected on either node.

---

### Session: 2026-06-05 — Unify Settled Channels and Segment Creator Metrics Reward Events

**Task**: Fix creator campaign metrics where settled viewer channels were not shown under "Settled channels" (due to a `role = 'PUBLISHER'` SQL filter) and duplicate settled reward events were displayed under active nodes in "Rewarded nodes". Also ensure that when channels are settled on the creator's node, they are written to `CHANNEL_HISTORY` rather than just overwritten in `CHANNEL_STATE`.

**Changes**:
- **dapp/views/mycampaigns.js**:
  - Removed `AND UPPER(ROLE) = 'PUBLISHER'` from the `CHANNEL_HISTORY` query in `_loadSettledChannels` to load both viewer and publisher settled channels.
  - Updated `_renderSettledChannelsTable` to add a "Type" column showing "Viewer" or "Publisher" based on the channel role, and updated the details colspan to 7.
  - Updated `_groupSettledChannelsByPk` to group channels by PK and role.
  - Refactored `_loadRewardedNodes` to query `CHANNEL_STATE` for active channels, extract their creation timestamps (`CREATED_AT`), and filter out settled events (where event timestamp is less than the active channel's creation timestamp).
- **public/service-workers/handlers/channel.handler.js**:
  - Replaced direct `sqlQuery` `UPDATE CHANNEL_STATE SET STATUS = 'settled'` with a call to `settleChannel` (from `core/channels.js`) for both viewer and publisher settlement paths on the creator node.
  - Implemented `checkOpenChannelsSettled()`, which queries all open channels, verifies if their channel coins have been spent on-chain at the `CHANNEL_SCRIPT_ADDRESS`, and automatically transitions/archives them to `CHANNEL_HISTORY` on the creator node when spent.
- **service.js**:
  - Registered/called `checkOpenChannelsSettled()` on the `NEWBLOCK` event listener.

**Why**: Ensures all settled payment channels are archived and visible on the creator's dashboard, and partitions the individual views/clicks so that already-settled rewards do not duplicate under active nodes. It also solves the sync issue between nodes by automatically detecting on-chain channel settlements via block checks.

**Testing required**:
- Navigate to `#creator` (My Campaigns view).
- Check "Settled channels": verify both settled publisher and viewer channels are listed with their respective "Type" (Viewer or Publisher) when they are settled.
- Check "Rewarded nodes": verify only the active (unsettled) views/clicks of the current channel are listed under each node, and that any older views/clicks that were settled are excluded and do not duplicate.

---

### Session: 2026-06-05 — Segment Reward Events by Channel Open Timestamp

**Task**: Resolve the discrepancy where expanding any settled channel or pending settlement in `dapp/views/earnings.js` showed all reward events of the campaign instead of only those corresponding to the active channel instance.

**Changes**:
- **dapp/views/earnings.js**:
  - Updated `_loadChannelEvents(campaignId, role, isSettled, targetEl)`:
    - Queries `CHANNEL_STATE` to find the open/pending channel's `CREATED_AT` timestamp (`openCreatedAt`).
    - Partitioned `REWARD_EVENTS` using `openCreatedAt` as the boundary:
      - For settled channels (`isSettled === true`), filters for `TIMESTAMP < openCreatedAt` (or no filter if no open channel exists).
      - For open/pending channels (`isSettled === false`), filters for `TIMESTAMP >= openCreatedAt` (or `1=0` to return empty if no open channel exists).
  - Updated callsites in `renderSettlementHistory` (line ~234) to pass `r.ROLE` and `true`.
  - Updated callsite in `_renderChannelRewardRows` (line ~398) to pass `role` and `false`.

**Why**: Solves duplicate event visibility by ensuring that as channels cycle from pending → open → settled → reset, their associated events are cleanly partitioned at the timestamp boundary of the currently open channel.

**Testing required**:
- Navigate to `#earnings`.
- With at least one settled channel and one pending settlement for a campaign, expand both:
  - Verify that the pending settlement dropdown only lists events logged during the current open channel.
  - Verify that the settled channel row dropdown only lists events logged before the current open channel's creation.

---

> Previous handoff notes (T-SC1–T-SC7, VW-1–VW-3, UI sessions 2–13, and all earlier) are archived in `docs/HISTORY.md §17`.
