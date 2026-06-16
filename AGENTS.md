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

For verification procedures, see `docs/VERIFICATION.md`.

---

## 6) Current Handoff Notes

> **Rule**: keep the 3 most recent session entries here. Before adding a new entry, move the oldest one to `docs/HISTORY.md §17`. This section is loaded every session — keep keep it short.

### Session: 2026-06-16 (patch 21) — Fix: Custom publisher opens channels proactively without any view

**Problem**: When a publisher created a custom frame (snippet), the FE immediately sent `MA_OPEN_PUBLISHER_CHANNELS` to the SW, which opened publisher L2 channels for ALL known campaigns — before any viewer had seen an ad through that frame. Simultaneously, every `CAMPAIGN_ANNOUNCE` received on a publisher node triggered `_tryOpenPublisherChannelForAllFrames`, opening channels for all local custom frames without any actual view event. This caused escrow funds to be locked and "active channels" to appear on the creator's campaign stats with no real activity.

**Root cause**: Two proactive channel-opening paths existed that bypassed the requirement for a real view event. The correct trigger is `PUBLISHER_REWARD_NOTIFY` (sent by the creator only after a real view), which already works correctly for the built-in publisher (user4 flow).

**Fix**: Removed both proactive paths entirely:
- `comms.handler.js`: deleted `handleOpenPublisherChannels()`, `_tryOpenPublisherChannel()`, and `_tryOpenPublisherChannelForAllFrames()`.
- `campaign.handler.js`: removed the `_tryOpenPublisherChannelForAllFrames(campaignId)` call from `persistCampaign()`.
- `service.js`: removed the `MA_OPEN_PUBLISHER_CHANNELS` dispatch case.
- `dapp/views/frames.js`: removed `_openPublisherChannelsForExistingFrames()` call from view init, removed its function definition, and removed the `MA_OPEN_PUBLISHER_CHANNELS` broadcast from `_doSaveFrame()`.

Publisher channels now open exclusively via `PUBLISHER_REWARD_NOTIFY` (in `channel.handler.js`), which is only sent after a confirmed view event.

**Files modified**: `public/service-workers/handlers/comms.handler.js`, `public/service-workers/handlers/campaign.handler.js`, `service.js`, `dapp/views/frames.js`

**AGENTS.md updated**: yes — §6 updated, patch 18 and Security audit entries moved to `docs/HISTORY.md §17`.

**Verification**:
1. Create a custom snippet on a publisher node (user2).
2. Verify SW logs do NOT show `MA_OPEN_PUBLISHER_CHANNELS` or any `CHANNEL_OPEN_REQUEST (publisher)`.
3. Verify Campaign1 budget stats remain unchanged after snippet creation.
4. Create a new campaign on the creator node.
5. Verify publisher node does NOT open a channel automatically on ANNOUNCE.
6. Now trigger an actual view through user2's embedded snippet (from another dapp).
7. Verify that ONLY after that view does a `CHANNEL_OPEN_REQUEST (publisher)` appear, triggered by `PUBLISHER_REWARD_NOTIFY`.

---

### Session: 2026-06-16 (patch 20) — Fix: updateBudget _numI regression truncates decimal budgets

**Problem**: `updateBudget()` in `core/campaigns.js` used `_numI(remaining, 0)` (parseInt) to coerce the remaining budget before SQL interpolation. `parseInt` truncates decimals: `parseInt(0.5) = 0`, causing campaigns with sub-1 M remaining budgets to be incorrectly marked as `'finished'` after any reward deduction.

**Root cause**: Introduced in commit `52e9519` (B-1 hardening). The intent was SQL-safety coercion, but `_numI` is the wrong helper for money values — `_numF` (parseFloat) must be used for float precision.

**Fix**: Replaced `_numI(remaining, 0)` with `_numF(remaining, 0)` in `updateBudget()`. Added inline comment explaining why `_numF` is mandatory here.

**Files modified**: `core/campaigns.js`, `dapp.conf` (version → 0.26.6.5), `MinimaAds.mds.zip`

**AGENTS.md updated**: yes — §6 updated, oldest entry moved to `docs/HISTORY.md §17`.

**Also investigated** (no code change needed): The "1 active publisher channel" visible on the creator UI is created by user2 (a legitimate publisher node with a custom frame), NOT by the creator node itself. The self-exclusion guard from patch 19 is working correctly. The correlation with B-1 was coincidental.

---

### Session: 2026-06-16 (patch 19) — Fix: Creator node auto-creating publisher channel on own campaigns

**Problem**: When a creator published a campaign (or when `persistCampaign()` ran on any campaign arrival), `_tryOpenPublisherChannelForAllFrames()` was unconditionally called. If the creator node had custom frames, this triggered `MA_OPEN_PUBLISHER_CHANNELS` → `_tryOpenPublisherChannel`, opening a publisher channel from the creator to their own campaign. This is semantically wrong (a creator cannot be a publisher of their own campaign) and caused a spurious "1 active channel (0.5000 M locked)" to appear in campaign stats for the creator.

**Root cause**: No creator self-exclusion guard existed in either of the two publisher-channel-opening paths.

**Fix**:
- **`comms.handler.js` — `_tryOpenPublisherChannelForAllFrames()`**: Added guard: if `MY_MAXIMA_PK === campaign.CREATOR_ADDRESS` (case-insensitive), log and return immediately.
- **`comms.handler.js` — `handleOpenPublisherChannels()`**: Added per-campaign guard inside the loop: skip any campaign whose `CREATOR_ADDRESS` matches `MY_MAXIMA_PK`. This blocks the path triggered by `renderFrames()` → `_openPublisherChannelsForExistingFrames()` on the creator's FE.

**Files modified**: `public/service-workers/handlers/comms.handler.js`, `dapp.conf` (version → 0.26.6.4), `MinimaAds.mds.zip`

**AGENTS.md updated**: yes — §6 updated, oldest entry (Security cleanups I-2/N-3/N-6) moved to `docs/HISTORY.md §17`.

**Verification**:
1. Create a new campaign on a creator node that also has custom frames.
2. Verify SW logs show `_tryOpenPublisherChannelForAllFrames: skipping — this node is the creator` and no `CHANNEL_OPEN_REQUEST` is sent.
3. Verify campaign stats show 0 publisher channels, not 1.
4. On a separate publisher node with the same frames, verify publisher channels still open correctly.

> Previous handoff notes (patches 15–18, Security Audit 2, and all earlier) are archived in `docs/HISTORY.md §17`.

