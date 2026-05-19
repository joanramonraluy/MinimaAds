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
| Project topology, DB mirror, protocols, signals | `docs/PROJECT_NOTES.md` |
| Fragility points and open bugs | `docs/KNOWN_ISSUES.md` |
| Ordered implementation task list | `docs/TASKS.md` |
| New implementation session prompt template | `docs/PromptBase.md` |
| Verification workflow | `docs/VERIFICATION.md` |
| Long change history | `docs/HISTORY.md` |

---

## 2) Required Workflow

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

## 3) Stable Contracts

The functions defined in `MinimaAds.md §7` are stable contracts. Do not rename, reorder parameters, or add undocumented parameters without updating `MinimaAds.md` in the same patch.

Stable core signatures:

```javascript
campaigns.js : getCampaigns(cb), getCampaign(id, cb), saveCampaign(campaign, ad, cb),
               updateBudget(campaignId, deductAmount, cb), setCampaignStatus(campaignId, status, cb)
selection.js : selectAd(userAddress, userInterests, campaigns)
validation.js: validateView(campaignId, userAddress, cb), validateClick(campaignId, userAddress, cb),
               isDuplicate(eventId, cb)
rewards.js   : createRewardEvent(params, cb), getUserRewards(userAddress, cb),
               getUserProfile(userAddress, cb)
minima.js    : sqlQuery(query, cb), broadcastMaxima(payload, cb), signalFE(type, data)
```

SDK public API in `sdk/index.js` is an external publisher contract. Treat changes there as breaking unless explicitly approved.

Maxima message schemas in `MinimaAds.md §8` are wire-format contracts. Field changes require a spec update.

---

## 4) Forbidden Actions

Architecture:
- Do not introduce JavaScript frameworks. The frontend is vanilla JavaScript.
- Do not add a build step, bundler, or transpiler.
- Do not add UI logic inside `core/*.js`.
- Do not bypass the Service Worker for inbound network persistence.
- Do not call `MDS.sql` directly outside `core/minima.js`, except existing FE UI code that predates the wrapper; prefer the wrapper for new code.

Maxima:
- Do not send Maxima messages without `poll:false`, except `maxima action:sendall` where Minima has no `poll:false` parameter.
- Do not add new `application:` names. Use `APP_NAME = 'minima-ads'`.
- Do not modify Maxima schemas without updating `MinimaAds.md §8`.

Data model:
- Do not add, rename, or remove fields in Campaign, Ad, RewardEvent, UserProfile, Frame, or Channel models without updating `MinimaAds.md`.
- Do not hardcode LIMITS values inline. Read from the `LIMITS` constant.
- Do not allow a creator to earn rewards from their own campaigns.

Process:
- Do not run `npm run build`, `npm run minima:*`, Capacitor builds, or release packaging unless explicitly requested.
- Do not invent new system flows outside `MinimaAds.md §6`.
- Do not silently change schema/protocol/signal docs without checking `MinimaAds.md`.

---

## 5) Critical Platform Rules

Full details live in `docs/PLATFORM_NOTES.md`. Keep these in active memory:

- Minima MiniDapps run in two independent runtimes: browser FE and Rhino/Nashorn SW.
- Runtime SW entry point is root `service.js`; `dapp.conf` does not control the service file path.
- SW is authoritative for inbound network persistence. FE is authoritative for UI.
- SW logs with `MDS.log()`, not `console.log`.
- SW JavaScript must be Rhino-safe: use `var`, avoid arrow functions, trailing commas, and template literals.
- H2 returns SQL row keys in uppercase.
- H2 has no PostgreSQL `ON CONFLICT`; use `MERGE INTO`.
- H2 BOOLEAN values may return as strings.
- H2 omits NULL columns from row objects.
- H2 string comparisons are case-sensitive; use `UPPER()` for IDs and public keys.
- Escape all user input and inbound Maxima payload strings before SQL interpolation.
- Maxima payloads are hex-encoded JSON.
- Public keys must be normalized for `0x`/`0X` casing differences.
- `MDS.comms.solo()` fires `MDSCOMMS` in FE; payload is usually at `event.data.message`.

---

## 6) Project Rules

Full project notes live in `docs/PROJECT_NOTES.md`.

Project identity:
- MinimaAds is a decentralized advertising infrastructure MiniDapp.
- Viewers earn for ad views/clicks.
- Creators fund campaigns through Minima token escrow.
- Publishers operate Frames and earn publisher rewards.

Canonical identities:
- `USER_PROFILE.ADDRESS` and `CAMPAIGN.CREATOR_ADDRESS` are Maxima public keys.
- `FRAMES.FRAME_ID` for the built-in frame is `builtin:<MAXIMA_PK>`.
- `CAMPAIGNS.ESCROW_WALLET_PK` is a wallet signing key, not a Maxima key.

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

## 7) Validation Checklist

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

## 8) Current Handoff Notes

2026-05-19 (Budget left accuracy):
- `public/service-workers/handlers/channel.handler.js` `swBuildAndPostChannelTx`: the split Tx1 now updates `BUDGET_REMAINING = change` alongside `ESCROW_COINID` when the split TX posts. Previously only `ESCROW_COINID` was updated — `BUDGET_REMAINING` only decremented by `reward_view` (1 token) per view event, leaving it far above the actual on-chain escrow amount. Now `BUDGET_REMAINING` reflects the real remaining escrow amount immediately on channel open, for both viewer and publisher splits.
- `public/service-workers/handlers/campaign.handler.js` `processEscrowCoin`: now compares `coin.amount` against `CAMPAIGN.BUDGET_REMAINING` in addition to the `coinId` check. If they differ (stale DB from old code or after SW restart), syncs `BUDGET_REMAINING` and `ESCROW_COINID` from the on-chain coin. Acts as a reconciliation pass on every SW session start (once per coinId per in-memory session). Known minor fragility: between Tx1 (split) and Tx2 (channel open), both the split coin (small) and the change coin (large) are simultaneously visible at `ESCROW_ADDRESS`. If a NEWBLOCK fires in this window, `processEscrowCoin` may process the split coin first (setting `BUDGET_REMAINING` to the split amount), then immediately correct it from the change coin. Both processed in the same scan pass — final value is always correct. Not visible in UI in practice. See `docs/KNOWN_ISSUES.md` fragility entry.

2026-05-19:
- `public/service-workers/handlers/channel.handler.js`: after a viewer `openChannel()` deducts `CAMPAIGNS.BUDGET_REMAINING`, the SW now emits `CAMPAIGN_UPDATED` with the refreshed budget/status. This makes the Stats `Budget left` table refresh while the Stats route is open instead of waiting for another campaign signal or manual reload.
- `dapp/app.js` `PUBLISHER_REWARD_CONFIRMED` handler: changed to call `loadEarnings()` (full reload). Previously only refreshed the history table — "Total earned" headline stayed stale when new publisher vouchers arrived.
- `dapp/views/earnings.js` `onSettleConfirmed()`: added `getUserProfile` reload + re-render of the summary section after settlement. Previously only the channel list and reward history updated.
- `core/rewards.js` `createRewardEvent()`: replaced non-atomic read-modify-write `MERGE INTO` for `USER_PROFILE.TOTAL_EARNED` with atomic `UPDATE ... SET TOTAL_EARNED = COALESCE(TOTAL_EARNED, 0) + amount`. Prevents lost increments under concurrent reward events. INSERT path for new users unchanged.
- Verified end-to-end with earnings.txt (19/5/2026): user2 (publisher) 20 MINIMA and user3 (viewer) 2 MINIMA consistent across Total earned / Settled channels / Reward history. Zero errors in all log files.

2026-05-18:
- Compacted `AGENTS.md` from 1,224 lines into a short operative guide.
- Extracted long-form reference content into:
  - `docs/PLATFORM_NOTES.md`
  - `docs/PROJECT_NOTES.md`
  - `docs/KNOWN_ISSUES.md`
  - `docs/HISTORY.md`
  - `docs/VERIFICATION.md`
- Removed the temporary full pre-compaction archive after confirming the extracted documents cover the needed reference content.
- Moved the implementation task list from root `TASKS.md` to `docs/TASKS.md`.
- Removed obsolete temporary handoff file `handoff_session_2026-05-13.md`; its relevant fixes are already tracked in `docs/HISTORY.md` and `docs/KNOWN_ISSUES.md`.
- Moved the new-session prompt template from root `PromptBase.md` to `docs/PromptBase.md`.
- Removed obsolete `latest-deploy.mds` packaged artifact; it was a non-source deploy ZIP containing logs and temporary files.
- `MinimaAds.md` remains the highest-authority functional specification.
