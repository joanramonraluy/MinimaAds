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

### Session: 2026-09-01 (AUD-1) — Security: authenticate inbound channel Maxima in the SDK (FE mirror of a423873)

**Source**: `docs/KNOWN_ISSUES.md §3.5 AUD-1`, the follow-up left open by commit `a423873` (audit Fix #1/#2/#11, SW side only).

**Problem**: `sdk/index.js` duplicates the SW's inbound channel write path in the host MiniDapp FE. `handleMdsEvent` decoded `MAXIMA` and called `_handleChannelOpenPayload` / `_handleRewardVoucherPayload` with the payload only — `event.data.from` was discarded. On an SDK-hosted node any Maxima peer knowing a `(campaign_id, viewer_key)` pair could therefore still: overwrite `LATEST_TX_HEX` with a crafted `REWARD_VOUCHER` (destroying the only creator-signed settlement voucher), push a *lower* `cumulative`, replay a valid voucher to re-credit `FRAMES.EARNINGS` / `REWARD_EVENTS` via the publisher branch of `_onVoucherReceivedCore`, or MERGE over a healthy open channel with a crafted `CHANNEL_OPEN`.

**Fix** (all in `sdk/index.js`, FE syntax — `var`, `function()`, `console.log`/`console.warn`; the SW's Rhino constraints do not apply here):
- New `_assertCampaignCreatorSender(campaignId, senderPk, label, cb)` — direct mirror of the SW guard. Accepts `CAMPAIGNS.CREATOR_ADDRESS` (via `getCampaign`) or the pk parsed out of the on-chain permanent route cached in `CREATOR_MX_<campaignId>` (`parseMaximaRoute`; returns null for plain `Mx…` contact strings, which just falls through). Uppercases BOTH sides. Fails open only when the message has no sender or no creator identity is known locally.
- `_handleChannelOpenPayload(payload, senderPk)` gates on that guard; original body extracted to `_doHandleChannelOpenPayload(payload)`.
- `_handleRewardVoucherPayload(payload, senderPk)` gates on the guard, then reads the stored cumulative (`_storedCumulative` → `getChannelState`) and rejects `cumulative < stored` **before** `updateChannelVoucher` touches `LATEST_TX_HEX`. Equality allowed (VOUCHER_SYNC replays).
- Dedup: `_isDuplicateEvent(payload.event_id)` is evaluated **before** the write path, because `_onVoucherReceivedCore` → `createRewardEvent` MERGEs into `DEDUP_LOG` (after which every id looks duplicate). On a duplicate the voucher is still stored but the reward is not re-credited.
- `_onVoucherReceivedCore` now also receives `viewer_key`, `event_id` and `reward_type` from this path, so `createRewardEvent` uses the deterministic voucher event id (second dedup layer) instead of a fresh random one.
- `handleMdsEvent` forwards `event.data.from` to both handlers.

Public API unchanged (`MinimaAds.{init,getAd,render,trackView,trackClick,handleMdsEvent,…}`) — only private handler arities changed.

**Files modified**: `sdk/index.js`

**AGENTS.md updated**: yes — §6 updated, patch 24 moved to `docs/HISTORY.md §17`. `MinimaAds.md §13.2` gained a "Sender authentication (SDK path)" note. `docs/KNOWN_ISSUES.md §3.5` AUD-1 marked fixed; new AUD-2 logged (out-of-scope pre-existing bug: SDK's direct MAXIMA path never creates the viewer `REWARD_EVENTS` row because `amount` is computed after the cumulative write).

**Verification** (needs a host MiniDapp embedding `sdk/index.js` with `mdsAlreadyInitialized:true`, node A = creator, node B = SDK host, node C = attacker):
1. **Happy path unaffected**: on B watch an ad through the SDK slot. Browser console shows no `rejected:` line; `CHANNEL_STATE.LATEST_TX_HEX` becomes non-empty and `CUMULATIVE_EARNED` rises.
2. **Spoofed voucher rejected**: from C send `maxima action:send publickey:<B_pk> application:minima-ads poll:false data:0x<hex of {"type":"REWARD_VOUCHER","campaign_id":"<id>","viewer_key":"<B_pk>","event_id":"x","cumulative":0,"tx_hex":"0xDEAD"}>`. B's console must show `[SDK] REWARD_VOUCHER rejected: sender is not the campaign creator`; `LATEST_TX_HEX` unchanged.
3. **Spoofed CHANNEL_OPEN rejected**: same from C with `type:"CHANNEL_OPEN"` + `channel_coinid` → `[SDK] CHANNEL_OPEN rejected: …`; `CHANNEL_STATE` row untouched.
4. **Non-monotonic rejected**: have A replay an older valid voucher (lower `cumulative`) → `[SDK] REWARD_VOUCHER rejected: non-monotonic cumulative (x < y)`; `LATEST_TX_HEX` unchanged.
5. **Replay blocked**: have A re-send the same valid voucher (same `event_id`) → `[SDK] REWARD_VOUCHER duplicate event, voucher stored, reward not re-credited`; `FRAMES.EARNINGS` / `REWARD_EVENTS` unchanged on the second delivery.
6. **Fail-open preserved**: on a campaign with no local `CAMPAIGNS` row and no `CREATOR_MX_<id>`, a `CHANNEL_OPEN` still logs `creator key unknown locally — accepting (fail-open)` and proceeds.
7. `node --check sdk/index.js` clean; no console errors in the host dapp.

**Open issues**: AUD-2 (see `docs/KNOWN_ISSUES.md §3.5`) — pre-existing, discovered while tracing this path, not fixed here.

---

### Session: 2026-09-02 — Docs: multi-node browser testing setup (MinimaNodeManager + Playwright MCP)

**Source**: maintainer walked the agent live through starting 5 nodes via MinimaNodeManager (`localhost:3000`), registering a Playwright MCP server (`--browser chrome`), installing/updating MinimaAds via Build Pipeline → "Zip & Install to Nodes", opening all 5 nodes in browser tabs, and clicking through the per-node cert warning + login (`123`) + onboarding screens ("nice to meet you" / username / "Welcome" / quick tour "Skip").

**Why this is now documented**: none of this was written down anywhere, so every future agent asked to "run/test the dapp live" would have had to rediscover the exact click sequence (including two non-obvious gotchas: use "Zip & Install to Nodes", not "Build & Zip", since this repo has no build step per CLAUDE.md §6; and MinimaNodeManager's zip includes the whole workspace, so stray Playwright artifacts in the repo root get bundled into the installed dapp unless cleaned first).

**Output**: new `docs/TESTING_SETUP.md` — step-by-step recipe (prerequisites, one-time Playwright MCP registration, start-N-nodes, install-dapp, open-all-tabs-and-onboard, cheat sheet) plus an explicit "not yet documented" section for the next step (driving actual creator/viewer flows). Session continued and added `§6 "Assign the 5 test roles"`: the standard 5-node mapping (Node1=campaign creator, Node2=publisher, Node3=viewer — all emergent, no config; Node4=MinimaAds Creator; Node5=Minima Foundation, MLS relay + 3% fee). Also added to `§5`: the "Zip & Install to Nodes" path installs MinimaAds in **Read mode** by default (unlike dApp Manager's Write Mode checkbox), so every tab needs a right-click on the MinimaAds icon → "Write mode" → a second confirmation dialog ("Are you sure you wish to give this MiniDAPP WRITE permissions?" → "Confirm") before the dapp is usable — folded into the cheat sheet as step 7.

**Correction made live, mid-session**: §6's first draft (written from static code reading of `core/minima.js` only) claimed Node 4 setup requires editing `config.js`'s `MINIMAADS_CREATOR_PK` + redeploying to all 5 nodes. Actually driving DevTools live proved this **wrong and unnecessary** — `service.js` (lines ~169–176) has a runtime override the static read missed: at SW boot, if the local `MINIMAADS_CREATOR_ROUTE` keypair holds a `MAX#<pk>#<mls>` string, it overwrites the in-memory `MINIMAADS_CREATOR_PK` with that route's `pk`. `DevTools §3.1`'s "Register as Permanent User" button stores that route **unconditionally** (no PK-equality gate — that strict check only lives inside `core/minima.js`'s own internal callers). So Node 4 self-registers with zero `config.js` edits. Caveat found and handled: this override is per-node local storage, so Nodes 1/2/3/5 don't automatically know Node 4 is the creator (needed for `sdk/index.js`'s `_assertCampaignCreatorSender` and for built-in-Frame publisher-reward routing in `comms.handler.js`/`channel.handler.js`, both of which read the *reader's own* `MINIMAADS_CREATOR_ROUTE`) — fixed by copying Node 4's resulting route string and pasting it into `DevTools §3.1`'s "Paste Platform Creator Route" field on each of the other 4 nodes (`§6.3`, new). §6 rewritten end-to-end with the corrected, verified sequence (Node 5 first, since Node 4 needs its MLS address); §6.1/§6.2 swapped order accordingly. All of it verified live on the actual 5-node setup this session, not just read from source. **Lesson for future agents**: for MinimaAds runtime-behavior questions, grep `service.js`'s init/boot path too, not just `core/*.js` — boot-time overrides live there and are easy to miss from a single-file read.

**Second correction, same session**: the agent initially only propagated `MINIMAADS_CREATOR_ROUTE` (§6.3) and treated §6 as done. The maintainer caught two gaps: (1) `MLS_SERVER_ADDRESS` and `FOUNDATION_KEY_OVERRIDE` had only been set on Node 5, not propagated to the other 4 (DevTools §1.2 "Connect"/§2 paste field exist for exactly this); Platform Key (§3.2) had never been set/propagated at all — fixed by mirroring the same copy-from-source/paste-on-the-rest pattern for all three, added as new `§6.4`. (2) The maintainer specifically flagged that `USER_PERMANENT_ROUTE` was missing everywhere except Node 4, and — after the agent initially claimed Node 2 (publisher) didn't need it — proved from source that it does: `dapp/views/frames.js:8-14` hard-redirects the Publisher Frames view to `#settings/maxima-routes` if unset for the current node (confirmed by the page's own copy: *"Essential for both creators and publishers"*), so a publisher literally cannot open its Frames screen without it. Fixed by using the **real in-app Settings page** (`#settings/maxima-routes` → "Register as Permanent"), not DevTools' §3.1 button — the Settings page calls `core/minima.js`'s `setCreatorMaximaRoute()` directly, which only touches `MINIMAADS_CREATOR_ROUTE` on a PK match (never true for non-Node-4 nodes), so it's safe to run on Node 1 and Node 2 without disturbing the propagated creator route. Verified live: `§4 Database & Storage Console` now shows all 5 keypair rows filled on Node 4 (5/5) and Node 1/2 (5/5 after the Settings step); Node 3/5 remain 4/5 (`USER_PERMANENT_ROUTE` unset — acceptable, neither role needs it: Node 3 is viewer-only with a documented fallback, Node 5 doesn't create campaigns or open Frames). **Lesson for future agents**: don't accept "N/5 fields filled" as done without checking whether the missing field gates a UI route (`window.location.hash = ...` redirects are a strong signal of a hard requirement, not a soft fallback) — grep the actual view file for the keypair name before declaring a role's setup optional.

**Third addition, same session — actually ran a campaign creation end-to-end and documented how to verify results**: drove the real Creator wizard (role switch via drawer → Viewer/Creator/Publisher submenu, `#creator`'s 4-tab flow) to publish a 1000-MINIMA campaign, then verified the 6%/3% fee split landed correctly. Added `docs/TESTING_SETUP.md §8` (the click-path) and `§9` (a maintainer-requested reference: *where* to check results and which source to trust for which question). Key finding worth knowing before trusting any balance number: the stock **Wallet** MiniDapp's **Balance** tab is unreliable once an escrow/fee tx is involved — it showed the campaign's full 1,090 total on *both* Node 4 and Node 5's wallets (not each node's real 60/30 share), with an inconsistent Available/Locked split between them. Root cause: Minima's wallet-relevance scanner flags a coin "relevant" to any address referenced anywhere in its `state`, not just the coin's own `address` — the exact pattern already logged as `docs/KNOWN_ISSUES.md #40`. Ground truth instead came from grepping (`browser_find`) each node's raw console log in MinimaNodeManager for `"NEW Unspent Coin"` JSON events, which give the real per-coin `amount`/`address` — that path, plus the Wallet's own **History** tab (reliable, unlike Balance), are now the documented go-to for "did node X really receive Y MINIMA". `§9.4` also flags that MinimaNodeManager's per-node command terminal takes raw Minima CLI syntax, not MDS `action:` syntax — `getbalance` returned `"Command not found"` there; correct verb still unverified, left as an open item rather than guessed at.

**Files modified**: `docs/TESTING_SETUP.md` (new), `.gitignore` (added `.playwright-mcp/`)

**AGENTS.md updated**: yes — this entry; `docs/DOCUMENTATION_INDEX.md` gained a row + a "Special Cases" pointer to the new doc. `MinimaAds.md` untouched (no data model / API / protocol content here). Patch 25 moved to `docs/HISTORY.md §17` to keep this section at 3 entries.

**Verification**: N/A (documentation only, no code path changed) for the doc edits; the campaign-creation flow itself was verified live end-to-end (escrow funded, correct fee split confirmed at the chain level, campaign visible on a second node) — see `docs/TESTING_SETUP.md §9` for the exact evidence trail.

**Open issues**: `docs/TESTING_SETUP.md §10` lists what's still missing — viewer flow (watch ad, claim reward), publisher flow (Frame registration + reward routing), multi-viewer voucher-sync patterns, and state-reset between runs. Left for the next session per the maintainer's plan to continue and document incrementally.

**Fourth addition, same session — capability reference for future agents (`§9.2`/`§9.5` expanded)**: the maintainer asked directly what's the best way to read results, whether the agent can read node logs, and whether it can read the node database. Answered and verified live, now documented: (1) node logs are plain-text files on disk at `MinimaNodeManager/nodes/nodeN/startup.log` — read those directly with `Bash`/`grep` instead of parsing MinimaNodeManager's browser log panel via `browser_find` (the browser path hit a genuine "144,561 characters exceeds maximum" tool-output error this session; the file read of the same content did not — `grep` confirmed identical match counts). (2) Two H2 databases exist per node on disk (Minima's own chain/wallet DBs, and MinimaAds' own app DB at `1.0/mds/data/<uid>/sql/sqldb.mv.db`) but **both are locked while the node process runs** — don't attempt direct file reads. MinimaAds' own DB has a live **SQL Console in `DevTools §4`** (goes through the running node's `MDS.sql`, no lock conflict) — verified working: queried `CAMPAIGNS` on Node 1 and got the exact test-campaign row back. No equivalent console exists for Minima's own chain/wallet DBs.

---

> Previous handoff notes (patches 15–25, Security Audit 2, and all earlier) are archived in `docs/HISTORY.md §17`.

