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

### Session: 2026-09-06 (audit #7/#12/#15) — Publisher channel batch: sender-auth gaps and dropped `role` in voucher-sync

`channel.handler.js` (+`earnings.js`, `sdk/index.js`, `MinimaAds.md §8.12`). #15: `handlePublisherRewardNotify` now gated behind `_assertCampaignCreatorSender`, always routes to `campaign.CREATOR_ADDRESS` (removed the `creatorKey` param entirely — it previously trusted the sender). #12 (2 parts, both fixed): custom-frame `CHANNEL_OPEN_REQUEST` auth was skippable by omitting `publisher_mx_key`; now defaults to sender + adds an async `getFrame` ownership check against FRAMES. Required extracting the publisher branch's ~140-line body into a new `_continuePublisherChannelOpenRequest(...)` function (pure relocation, verified byte-for-byte unchanged) since the ownership check is async — viewer branch untouched. Also removed `_maybeGeneratePublisherVoucher`'s "any open publisher channel" `LIMIT 1` fallback (no frame/key match) that could misroute a reward to an unrelated publisher's channel — now defers instead, same as the no-channel case. #7: `role`/`frame_id` were silently dropped at 3 of 4 VOUCHER_SYNC hops (SW's REWARD_VOUCHER resend, FE's `_requestVoucherResync`, SDK's `_onReconnect` SELECT+payload) — all fixed, plus MinimaAds.md §8.12 updated. Verified: `node --check` all files; live regression via MetaChain confirmed the SW loads/dispatches cleanly post-redeploy (no Rhino parse failure from the #12 extraction). Could not drive a fresh end-to-end publisher CHANNEL_OPEN_REQUEST — all available campaigns were cooldown-blocked. Files: `public/service-workers/handlers/channel.handler.js`, `dapp/views/earnings.js`, `sdk/index.js`, `MinimaAds.md`. Open issues: #10, #13, #14 (SDK-only) still open; #12's async branch and #7's actual recovery scenario need a fresh non-cooldown-blocked live repro next session. Full detail: `docs/HISTORY.md §17`, session 2026-09-06 (audit #7/#12/#15).

---

### Session: 2026-09-06 (audit #8) — Embedded publisher snippet's inline ad renderer skipped renderAd.js's CSS/URL validators

Confirmed live against the same real third-party host used for #9 (MetaChain). `dapp/views/frames.js` `_buildSnippet`'s inline `_render` used `bg_color`/`text_color`/`image_position` raw in `style.cssText` and only blocklisted `javascript:` for `cta_url` — a malicious campaign could CSS-inject/beacon the *host* page. Fixed by inlining `_safeColor`/`_safePos`/`_safeUrl` (same logic as `renderer/renderAd.js`) into the generated snippet, applied to bg/fg/pos and both `cta_url` sites. Verified live: redeployed, copied the fresh snippet from a Node 2 Frame, pasted+ran it in MetaChain's Help → MinimaAds panel — full view cycle succeeded with zero console errors, ad rendered correctly (screenshot confirmed). Files: `dapp/views/frames.js`. Open issues: audit #7, #10, #12–#15 still open. Full detail: `docs/HISTORY.md §17`, session 2026-09-06 (audit #8).

---

### Session: 2026-09-06 (audit #9) — Custom-frame snippet sent the full Maxima route as `userAddress` instead of the raw public key

Confirmed live for the first time against a real third-party host (MetaChain, embedding a MinimaAds Frame snippet): `[MA-PUBLISHER] ADDRESS: MAX#0x...` sent verbatim as `userAddress` in `MA_GET_AD`/`MA_TRACK_VIEW`. Traced the actual channel/voucher/`REWARD_EVENTS` path and confirmed it's keyed by `MY_MAXIMA_PK`, not `userAddress` — so the real (narrower than worst-case) impact is `selectAd` rotation, `validateView`/`validateClick` daily-limit/cooldown/dedup (queries never match), and the creator-self-reward guard failing open. Fixed with new `_normalizeUserAddress()` in `comms.handler.js` (reuses `parseMaximaRoute`), applied in `handleGetAd`/`handleTrackView`/`handleTrackClick`. Verified live: redeployed, reloaded MetaChain, `MA_TRACK_RESULT confirmed:true` still succeeds post-fix. Files: `public/service-workers/handlers/comms.handler.js`. Open issues: audit #7, #8, #10, #12–#15 still open. Full detail: `docs/HISTORY.md §17`, session 2026-09-06 (audit #9).

---

> Previous handoff notes (AUD-1, patches 15–25, Security Audit 2, and all earlier) are archived in `docs/HISTORY.md §17`.

