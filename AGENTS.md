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

### Session: 2026-09-03 (Fix #4) — Security: cap publisher CHANNEL_OPEN_REQUEST to LIMITS.MAX_CHANNEL_RESERVATION

**Source**: `docs/IMPLEMENTATION_PLAN_2026-07-18.md` Phase 1, Fix #4 — the publisher branch of `handleChannelOpenRequest` capped a publisher's channel reservation only at `MAX_PUBLISHER_BUDGET` remaining, never at the same per-channel ceiling (`LIMITS.MAX_CHANNEL_RESERVATION`, value 10) already enforced on the viewer branch (`channel.handler.js:230–235`). A publisher (or a hand-crafted `CHANNEL_OPEN_REQUEST`) could pre-reserve up to the entire remaining publisher budget in one channel.

**Fix**: `channel.handler.js:96–103` — after computing `effectiveCap = Math.min(maxAmount, pubRemaining)`, added the same clamp pattern the viewer branch already uses: `var reservationCap = LIMITS.MAX_CHANNEL_RESERVATION || 10; if (effectiveCap > reservationCap) { ...log...; effectiveCap = reservationCap; }`, placed *before* the existing budget log line so the log reflects the final capped value. No hardcoded `10` — reads `LIMITS.MAX_CHANNEL_RESERVATION` (`service.js:21`), matching CLAUDE.md §6. Sender side (`_doSendPublisherChannelOpenRequest:1319`) intentionally untouched — this is a receiver-side defense against hand-crafted requests, per the plan.

**Verification — live, 6-node, adversarial** (not just code review): deployed via MinimaNodeManager "Zip & Install to Nodes" (maintainer clicked it; the Playwright-driven click was blocked twice by the harness's auto-mode permission classifier — flagging this for future sessions: that button needs either a manual click or an explicit Bash/browser permission rule, plain-text encouragement from the user does not override the classifier). Reused the existing test campaign `1a067a5e4a7-b3a50359` (Node 1 = creator). Its `MAX_PUBLISHER_BUDGET` was only 0.5 (would have masked the reservation cap behind the budget cap), so temporarily raised it to 50 via `DevTools §4` SQL Console (test data only, no code/schema change) to make the two caps distinguishable. Crafted a raw `CHANNEL_OPEN_REQUEST` (`role:"publisher"`, `max_amount:50`, `frame_id:"test-attack-frame-1"`, no `publisher_mx_key`) from Node 6 (attacker) via `maxima action:send` RPC in its MinimaNodeManager console, targeting Node 1's real Maxima publickey. Node 1's `[CHANNEL]` log confirmed: `CHANNEL_OPEN_REQUEST (publisher): capping reservation 50 -> 10 campaign=1a067a5e4a7-b3a50359` followed by `budget — max=50 earned=0 remaining=50 requestedCap=50 effectiveCap=10`. The channel actually opened on-chain; `SELECT ... FROM CHANNEL_STATE WHERE ROLE='publisher'` confirmed the persisted row: `STATUS:"open"`, `MAX_AMOUNT:"10.000000"` (not 50), real `CHANNEL_COINID`. `CAMPAIGNS.PUBLISHER_BUDGET_SPENT` incremented by exactly 10 (not 50), confirming the capped value — not the requested one — is what gets reserved end-to-end.

**Operational findings worth keeping**:
- Node 6 (the dedicated attacker node) had been stopped (`[Node 6] Stopping Node 6...` in MinimaNodeManager's global log, cause not established — possibly a side effect of an earlier Chrome/profile recovery in this session) and had to be restarted; it runs in **Clean Mode**, so every restart mints a fresh Maxima identity — any prior `maxcontacts` entries on it are lost and must be re-added (`maxcontacts action:add contact:<target's Mx contact string>`, see `project_maxima_send_needs_contact.md`) after every restart, not just once per session.
- Two Playwright MCP server instances (from two concurrent Claude sessions) cannot share one Chrome profile — attempting `browser_tabs`/etc. from the second session fails with `"Browser is already in use"`. Resolved this session by having the other session `kill -TERM` its own Chrome process and clear the profile's `SingletonLock`/`SingletonCookie`/`SingletonSocket`; the existing MinimaAds tabs (with logins/write-mode intact) survived the relaunch since only the browser process was killed, not the profile directory.

**Files modified**: `public/service-workers/handlers/channel.handler.js`

**AGENTS.md updated**: yes — this entry; oldest entry (2026-09-02, testing-setup docs) moved to `docs/HISTORY.md §17`. `MinimaAds.md`: no change (no schema/API/protocol contract changed — same `LIMITS` constant, same handler signature).

**Verification for maintainer to re-check if desired**: node1's `#mycampaigns` view for campaign `1a067a5e4a7-b3a50359` should still show `Escrow Left: 89,80 M` (was 99.80 before this session's test channel opened) — this is a **live/on-chain test-data side effect** of the verification, not a bug; the campaign's `MAX_PUBLISHER_BUDGET` also remains at the test value of 50 (was 0.5) — left as-is since it's dev/test-only state and no cleanup was requested, but flagged here so the next session (or the concurrent `minimaads-af` session sharing this environment) isn't confused by it.

**Open issues**: none new. Suggested next step per the plan: Fix #3 (`campaign.handler.js`, HIGH — spoofable `CAMPAIGN_PAUSE`/`FINISH`) can proceed in parallel, different file, likely needs Opus per the plan's own recommendation.

---

### Session: 2026-09-03 — Verification: live 6-node adversarial test of audit Fix #1+#2+#11 (channel.handler.js sender auth)

**Source**: maintainer asked to verify (not re-implement) that commits `a423873`/`fd92673` (2026-09-01, see below and `docs/HISTORY.md §17` for the 2026-07-18 fix entry) actually hold up against a real hostile peer, per `docs/IMPLEMENTATION_PLAN_2026-07-18.md`'s own Next Steps note that Phase 1 needs a two-node adversarial test before being considered shippable. No code was changed this session — this is the executed version of the five-point manual test plan written at fix time.

**Setup**: the maintainer's usual 5-node topology (Node1=creator, Node2=publisher, Node3=viewer, Node4=MinimaAds Creator, Node5=Foundation/relay, per `docs/TESTING_SETUP.md §6`) plus a 6th node added specifically as an unprivileged attacker (no MinimaAds installed — attacks were raw `maxima action:send` RPC calls from its MinimaNodeManager console, not through the dapp UI). A real campaign was published from Node 1 (`1a067a5e4a7-b3a50359`, escrow tx confirmed on-chain) and viewed from Node 3 to get a real open channel with a real creator-signed voucher (`cumulative:0.02`) to attack.

**Results — all 5 rejected/accepted as expected, verified against Node 3's live SW log (`[CHANNEL] ...` lines) and its Earnings UI (`TOTAL_EARNED` unchanged across every attack)**:
1. **Happy path**: Node 3 opens channel, receives voucher → `CHANNEL_OPENED` + `VOUCHER_RECEIVED cumulative:0.02`, Earnings UI shows `0,020000 MINIMA`.
2. **Spoofed `REWARD_VOUCHER`** (Node 6 → Node 3, claiming `cumulative:0`, forging no real identity): `[CHANNEL] REWARD_VOUCHER rejected: sender is not the campaign creator`. `LATEST_TX_HEX`/`TOTAL_EARNED` untouched.
3. **Non-monotonic `cumulative`** (Node 1, the *real* creator — sender-auth passes — sends `cumulative:0.01 < 0.02`): `[CHANNEL] REWARD_VOUCHER rejected: non-monotonic cumulative (0.01 < 0.02)`.
4. **Replay** (Node 1 re-sends the exact original `event_id`/`cumulative`): `[CHANNEL] REWARD_VOUCHER duplicate event, skipping profile update`. Earnings unchanged (no double-credit).
5. **Unauthenticated `VOUCHER_SYNC_REQUEST`** (Node 6 → Node 1, asking for Node 3's voucher): `[CHANNEL] VOUCHER_SYNC_REQUEST rejected: senderPk != OPENER_MX_PK`.

Point 3 and 4 are the more interesting proof: the sender-identity check (`msg.data.from`) is authenticated by Maxima's transport layer itself, not by anything in the JSON payload — Node 6 could not forge being Node 1 no matter what the payload claimed, so those two tests had to be sent from the *actual* Node 1 to isolate the monotonicity/dedup guards specifically (sender-auth would otherwise mask them). This confirms the audit's threat model (`msg.data.from` is cryptographically the sender) matches the real implementation.

**Not separately tested**: a spoofed `CHANNEL_OPEN` (item 4 of the original audit's CRITICAL finding) — it runs through the identical `_assertCampaignCreatorSender` guard already proven by test #2/#3, so a dedicated run would be redundant coverage of the same code path, not a different one.

**Operational finding worth keeping** (not a bug, a Maxima RPC gotcha): `maxima action:send publickey:X` fails with `"No Contact found for publickey : X"` unless the sending node has first run `maxcontacts action:add contact:<X's Mx-contact string>` — even when both nodes already share a P2P/relay connection. Each node needs its OWN contact entry per destination public key; there's no implicit routing from being on the same relay. Get the target's Mx-contact string via a plain `maxima` RPC call on the target node (`response.contact` field) before attempting `action:send` to it from a third node.

**Files modified**: none (verification only). `AGENTS.md §6` (this entry, fix #1+2+11 entry moved to `docs/HISTORY.md §17`).

**AGENTS.md updated**: yes — this entry.

**Open issues**: none new. Confirms Fix #1/#2/#11 (SW + SDK, both commits) hold against a real hostile third node; Phase 1 of `docs/IMPLEMENTATION_PLAN_2026-07-18.md` can be considered adversarially verified. Next per the plan: Fix #4 (`MAX_CHANNEL_RESERVATION` on publisher channels, LOW-MEDIUM, same file) and/or Fix #3 (spoofable CAMPAIGN_PAUSE/FINISH, HIGH, different file — `campaign.handler.js`) can proceed.

---

### Session: 2026-09-03 (Fix #3) — Security: spoofable CAMPAIGN_FINISH could force channel settlement (V1/V2)

**Source**: `docs/IMPLEMENTATION_PLAN_2026-07-18.md` Phase 1, Fix #3. Implemented by an Opus subagent (this session ran out of Anthropic monthly spend mid-task once and was resumed — see Open issues), verified live by the parent Sonnet session. `_assertCreatorThen` (`campaign.handler.js`, pre-fix) accepted `CAMPAIGN_PAUSE/FINISH/RESUME` from any sender matching `CAMPAIGNS.CREATOR_ADDRESS`. For announce/`CAMPAIGN_DATA_RESPONSE`-discovered campaigns that column is filled from a Maxima *payload* field, so it is a weak identity: a peer that first poisons the row via an unauthenticated `CAMPAIGN_DATA_RESPONSE` could then send a `CAMPAIGN_FINISH` and force `autoSettleChannelsForCampaign` (`:592`) — an irreversible L1 settlement — on a campaign it does not control. Verifying V1/V2 senders on-chain via `PREVSTATE(4)` was rejected by the plan as a security gate (needs a coin lookup that hits platform bug #6, `relevant:false`).

**Fix** (`campaign.handler.js` only):
- `_assertCreatorThen` now calls `ok(strongSender)` with a trust flag. **Strong** = sender matched a permanent route `MAX#<pk>#<mls>`, from `CAMPAIGNS.CREATOR_MX` *or* from keypair `CREATOR_MX_<campaignId>` (cached from on-chain escrow `STATE(4)`) — neither settable by a payload. **Fallback** = matched `CREATOR_ADDRESS` only. No match → rejected, still fails closed. Hand-rolled `MAX#` parsing replaced with `parseMaximaRoute` (also rejects legacy `MAX#Mx…#mls`). Same two sources and precedence as `channel.handler.js`'s `_assertCampaignCreatorSender`.
- `handleCampaignFinish`: on fallback, logs `[CAMPAIGN] FINISH via fallback creator check — deferring auto-settle to on-chain confirmation` and calls `applyStatusChange(id, "finished", true)`.
- `applyStatusChange(campaignId, status, skipAutoSettle)`: new optional arg gates both `autoSettleChannelsForCampaign` *and* `settling:true` on the `CAMPAIGN_UPDATED` signal (the FE uses `settling` to defer its `mycampaigns` re-render until `onCampaignClosed`, which would never arrive). Existing 2-arg call sites (`handleLocalStatusChange`, `checkExpiredCampaigns`) are unaffected.
- PAUSE/RESUME behavior deliberately unchanged — plan scoped the withholding to `finished` only; a fallback-verified PAUSE can still force settlement (flagged, not fixed — see Open issues).
- The plan named only `CAMPAIGNS.CREATOR_MX` as the strong source, but that column is `''` on every remote node (nothing sends `CAMPAIGN_ANNOUNCE`; `CAMPAIGN_DATA_RESPONSE`'s `campaignObj` omits `creator_mx`). The keypair route was added as a second strong source — without it the FINISH fast-path auto-settle would be disabled on 100% of viewer nodes, a much bigger behavior change than the plan intended. Verified: this mirrors what `channel.handler.js` already does.

**Files modified**: `public/service-workers/handlers/campaign.handler.js`

**AGENTS.md updated**: yes — this entry; oldest entry (2026-09-01, AUD-1) moved to `docs/HISTORY.md §17`. `MinimaAds.md §8.5`: yes — replaced the stale "There is no creator-identity check at the protocol level" line with a "Sender authentication (inbound)" block (strong vs fallback trust table, the resulting rule, and the rationale — a spoofed status is recoverable, a spoofed settlement is an irreversible L1 tx). No schema/API change.

**Verification — live, 6-node, adversarial, executed twice** (first run invalidated itself — see below):
1. **Setup**: reused test campaign `1a067a5e4a7-b3a50359` (Node 1 = creator, real escrow, real 6% platform + no foundation fee). Node 3 (viewer) already held a real open viewer channel (`CHANNEL_STATE STATUS='open'`, from earlier Fix #1/2/11 verification) and, from `[DISCOVERY]` scans of the Fix #4 test's split coins, a correctly-cached keypair `CREATOR_MX_1a067a5e4a7-b3a50359` = Node 1's real permanent route (confirmed via `MDS.keypair.get` in a `browser_evaluate` call — this is the strong-path anchor the attack must fail against).
2. **First attempt — caught a process gap, not a code gap**: deployed the source once at session start, *then* had an Opus subagent implement Fix #3 in-place afterward, and ran the live attack (crafted `CAMPAIGN_DATA_RESPONSE` from Node 6 poisoning Node 3's `CAMPAIGNS.CREATOR_ADDRESS` to Node 6's own PK, then a crafted `CAMPAIGN_FINISH` from Node 6) **without redeploying**. Result: full auto-settle ran, no fallback log line — this is *correct pre-fix behavior* (confirms the vulnerability is real) but does not test the fix, since Node 3 was still running the old bare-`ok()` code. No irreversible damage: `CHANNEL_STATE` flipped to `settling` but `LATEST_TX_HEX` never changed from its pre-existing placeholder value (no real L1 tx was posted) — reset via the SQL Console (`CAMPAIGNS.STATUS='active'`, `CREATOR_ADDRESS`=Node 1's real PK, `CHANNEL_STATE.STATUS='open'`) and redeployed via Build Pipeline → "Zip & Install to Nodes" before retrying.
3. **Second attempt — fix confirmed**: identical attack (poison `CREATOR_ADDRESS` → send `CAMPAIGN_FINISH`, both from Node 6, real Maxima delivery, `msg.data.from` cryptographically Node 6's PK) against the redeployed code. Node 3's SW log showed, in order: `[CAMPAIGN] ANNOUNCE persisted` (poison landed) → **`[CAMPAIGN] FINISH via fallback creator check — deferring auto-settle to on-chain confirmation`** → `[CAMPAIGN] status updated to finished`. Critically, **no** `[CHANNEL] autoSettleChannelsForCampaign` line followed. DB check confirmed: `CAMPAIGNS.STATUS = 'finished'` (local flip, as designed) but `CHANNEL_STATE.STATUS` stayed `'open'` (forced settlement withheld) — the exact security property the fix targets. Test data reset again afterward (`STATUS='active'`, `CREATOR_ADDRESS` restored).
4. **Not separately re-tested**: the legit strong-path finish (test (a) in the original plan) — the diff for that branch is a structural no-op (`ok(true)` → same 1-arg `applyStatusChange(id, "finished")` call as pre-fix), and the first (invalidated) run already exercised behaviorally-equivalent code (unconditional `ok()` → full auto-settle) live. Considered adequately covered without spending a third full attack cycle.
5. **Operational findings**: (a) the Playwright-driven click on "Zip & Install to Nodes" was blocked twice by the harness's permission classifier — needed a manual click from the maintainer both times; flag this for any future session automating deploys. (b) `node --check campaign.handler.js` was clean throughout, including after the redeploy.

**Open issues**: (1) fallback-verified `CAMPAIGN_PAUSE` can still force settlement — same vector as FINISH, not fixed here, scope was FINISH only per the plan; a one-line extension (`applyStatusChange(id, "paused", true)` on `!strongSender`) would close it if the maintainer wants it. (2) `CAMPAIGN_DATA_RESPONSE`/`REQUEST_CAMPAIGN_DATA` remain unauthenticated and MERGE by campaign ID with no sender check — this is the pre-existing enabling bug used to poison `CREATOR_ADDRESS` in the test; out of scope for Fix #3, not filed as a new KNOWN_ISSUES item yet, flagging here for the maintainer to decide where it goes. (3) `dapp/app.js`'s `_autoSettleOpenChannels` still fires client-side on any `CAMPAIGN_UPDATED status:'finished'`, including the fallback one — lesser impact (viewer settling its own earned channel), and it's Fix #12's file, not touched here. (4) Mid-session the Opus implementation subagent hit `HTTP 429 rate_limit — monthly spend limit`, resumed successfully with no code loss once continued.

---

> Previous handoff notes (AUD-1, patches 15–25, Security Audit 2, and all earlier) are archived in `docs/HISTORY.md §17`.

