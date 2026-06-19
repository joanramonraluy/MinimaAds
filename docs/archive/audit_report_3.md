# Security Audit Report 3 — MinimaAds

**Auditor role:** Senior Smart Contract & Decentralized Application Security Auditor
**Date:** 2026-06-15
**Scope:** `core/`, `public/service-workers/` (+ `handlers/`), `sdk/`, `dapp/`, `renderer/`, `service.js`, `config.js`, `db-init.js`
**Method:** (A) line-by-line verification of the 10 remediation fixes (N2-1…I-2) from `docs/audit_report_2.md` §8/§10 against the actual code; (B) fresh independent review of the full data + control flow without assuming the fixes are correct. KissVM cross-checked against `refs/docs-main/.../contracts-kissvm.mdx`.

---

## Executive Summary

- **Status vs. audit 2:** All 10 tracked remediations (N2-1 through I-2) are implemented and **correct**. N2-1 is implemented even more robustly than the proposed diff (validation moved to the true sink `_sendMaximaDirect`, covering the outbox-retry path as well). No regressions were introduced by the fixes — the three highlighted regression-risk areas (N2-5 NEWBLOCK dedup, N2-6 escrow gate, N2-2 click cooldown) all behave correctly.
- **New findings:** Part B surfaced **one HIGH** issue not covered by audit 2: an **SQL injection in the remote campaign-ingestion path** (`saveCampaign` numeric columns are interpolated raw from attacker-controlled `CAMPAIGN_ANNOUNCE` / `CAMPAIGN_DATA_RESPONSE` payloads). This is the same *class* as C-2/N2-1 (unsanitised remote input reaching a command/SQL string) but at a different sink that the prior sweeps did not reach. Plus 2 LOW/INFO observations.
- **Critical issues:** 0 critical. 1 high (new). 
- **Production recommendation:** **Conditional.** The audit-2 remediations are production-quality. Ship is gated on fixing the new HIGH SQL-injection finding (B-1), which is a small, well-understood patch (numeric coercion of the campaign money fields before `saveCampaign`). Two-node verification of the audit-2 fixes (still pending per §10) should also be completed.

---

## Part A — Remediation Verification

| Fix ID | Status | Correctness | Regression Risk | Notes |
|--------|--------|-------------|-----------------|-------|
| **N2-1** | ✓ | yes (stronger than spec) | low | Guard placed in `core/minima.js` `_sendMaximaDirect` (lines 164-173) — the real `MDS.cmd` sink — so it protects *both* `sendMaxima` and the outbox-retry path (`processMaximaOutbox`→`_sendMaximaDirect`). Rejects non-`isHexKey` PK and non-`isMaximaRoute` route (no whitespace ⇒ no `poll:true`/`to:`/`application:` injection). Call-site guards on `viewer_wallet_addr/pk` (`channel.handler.js:36-43`) and `viewer_mx` (`:237`) retained as defence-in-depth. `viewer_key`/`publisher_key`/`publisher_mx` are now all centrally covered. |
| **N2-2** | ✓ | yes | low | `LAST_CLICK_VOUCHER_AT` column added in **both** runtimes (`db-init.js:187`, `dapp/app.js:1928`). Cooldown in `_handleRewardRequestInner` (`channel.handler.js:631-639`) reads the per-type timestamp: clicks paced vs `LAST_CLICK_VOUCHER_AT`, views vs `LAST_VOUCHER_AT` ⇒ click-after-view still immediate, click→click rate-limited. `updateChannelVoucher` (`core/channels.js:70-87`) takes `rewardType` and bumps `LAST_CLICK_VOUCHER_AT` only for clicks. `swBuildAndExportVoucherTx` passes `ctx.rewardType` (`channel.handler.js:1961`). No concurrent-voucher break: the timestamp is per (campaign, viewer, role) row and only ever advances. |
| **N2-3** | ✓ | yes | low | Global `MAX_PUBLISHER_BUDGET` cap re-checked at voucher time in **all three** sites: `_doGeneratePublisherVoucher` (`:1620-1633`), `_replayDeferredPublisherRewardsNow` (`:1548-1561`), and the publisher branch of `_handleRewardRequestInner` (`:674-688`). Each sums `CUMULATIVE_EARNED` across publisher channels and rejects when `earnedAll − thisChannelOld + newCumulative > cap + 1e-6`. SQL uses `UPPER()` + `escapeSql`. |
| **N2-4** | ✓ | yes (Option B) | low | `OPENER_MX_PK VARCHAR(512) DEFAULT ''` added both runtimes (`db-init.js:188`, `dapp/app.js:1929`). `openChannel`/`_doMergeChannel` (`core/channels.js:7-34`) persist it; all SW callers pass `sndrPk` (`channel.handler.js:154/178/288/329/339`) and the reopen path passes the stored `pubChannel.OPENER_MX_PK` (`:1686`); the SDK passes `''` (`sdk/index.js:634`). Guard in `_handleRewardRequestInner` (`:586-592`) rejects when stored PK ≠ `senderPk`, **fails-open on empty column** (pre-existing channels + SDK path keep working). Correctly avoids the unsafe `senderPk === viewer_key` binding flagged in audit 2. |
| **N2-5** | ✓ | yes | low | `pruneDedupLog()` (`campaign.handler.js:729-740`): throttled to once per 6 h via `_lastDedupPruneAt`, deletes `LOGGED_AT < now − 7d`. Called on NEWBLOCK (`service.js:384`). **No regression to NEWBLOCK dedup processing:** dedup is a PK-existence check (`isDuplicate`), and the prune cutoff (7 days) is far beyond any replay/voucher window — settlement and voucher dedup IDs are consumed within minutes. All other NEWBLOCK handlers run unaffected on the same tick. |
| **N2-6** | ✓ | yes | low | `handleEscrowInfoRequest` (`maxima.handler.js:135-181`) now gates on requester = creator (`CREATOR_ADDRESS` match, case-insensitive) **or** known counterparty (`COUNT(*) FROM CHANNEL_STATE WHERE OPENER_MX_PK = fromPk AND OPENER_MX_PK != ''`). Strangers silently dropped. Legitimate creator/channel flows preserved: a counterparty whose channel stored `OPENER_MX_PK` passes; the `OPENER_MX_PK != ''` clause prevents an empty-PK false match. `not_found` still answered (no info leak). Response logic cleanly extracted to `_doEscrowInfoResponse`. `PROFILE_REQUEST` intentionally left open (public name+icon; restricting breaks discovery UI) — acceptable per the tracker rationale. |
| **I-2** | ✓ | yes | low | Viewer `maxAmount` capped at `LIMITS.MAX_CHANNEL_RESERVATION` in `comms.handler.js _doSendChannelOpenRequest` (`:251-252`) and `sdk/index.js _computeMaxAmount` (`:258-259`). Now matches the server-side cap (`channel.handler.js:231-235`). |
| **N-3** | ✓ | yes | low | Tautological `pubReward > pubReward + epsilon` guard removed from `_doGeneratePublisherVoucher`; the accrual guard there is now the meaningful `cumulative > MAX_AMOUNT` and the N2-3 global cap. |
| **N-6** | ✓ | yes | low | `COOLDOWN_MS DEFAULT 30000` in `db-init.js` CREATE (`:25`) and ALTER (`:173`), aligned to `LIMITS.COOLDOWN_BETWEEN_REWARDS_MS = 30000` (`service.js:11`). |

### Summary (Part A)
- Total fixes verified: **10** (N2-1…N2-6, plus I-2/N-3/N-6 bundle).
- All correct: **yes.**
- Regression risk: **low.**
- Blockers for production: **none from the audit-2 fixes.** (The HIGH blocker below is a pre-existing issue independent of these fixes.)

### Key Verification Notes
1. **N2-1 placement is better than the proposed diff.** The §8 diff added the guard to `sendMaxima`. The code instead added it to `_sendMaximaDirect`, which `sendMaxima` *and* the outbox retry loop (`processMaximaOutbox`) both call — so a malformed route that was queued can never be replayed into `MDS.cmd` either. Net: strictly stronger.
2. **Rhino/H2/Maxima constraints all hold across the changed code.** No `let`/`const`/arrow/template-literal/`console.log` in any SW file (the single backtick match is inside a `//` comment). All new SQL uses `UPPER()` on IDs/keys and routes user input through `escapeSql()`. `LAST_CLICK_VOUCHER_AT` / `OPENER_MX_PK` migrations are present in both runtimes. No new outbound send omits `poll:false` (sends go through `sendMaxima`→`_sendMaximaDirect`, which hard-codes `poll:false`).
3. **N2-3 boundary math is consistent across all three sites** (same `earnedAll − thisChannelOld + newCumulative` formula, same `+1e-6` epsilon, same `cap > 0` short-circuit when no publisher budget is configured).

---

## Part B — Independent Audit Findings

> Only issues **not** already captured in `docs/audit_report_2.md`. Findings whose prior fix was incomplete are not repeated (all 10 were complete).

### Finding B-1: SQL injection via unsanitised numeric fields in remote campaign ingestion

**Severity:** HIGH
**Component:** `core/campaigns.js` `saveCampaign()` (lines 40-46, also `updateBudget` lines 105-111); reached from `public/service-workers/handlers/campaign.handler.js` `handleCampaignAnnounce()` (lines 9-26) and `handleCampaignDataResponse()` (line 496).
**Vulnerability type:** SQL injection (second-order, via Maxima payload → H2 SQL string interpolation).

**Root cause.** `saveCampaign` builds its `MERGE INTO CAMPAIGNS …` statement by concatenating several campaign fields **without `escapeSql()` and without numeric coercion**, on the assumption they are numbers:

```js
// core/campaigns.js (saveCampaign)
campaign.budget_total + "," +
campaign.budget_remaining + "," +
campaign.reward_view + "," +
campaign.reward_click + "," +
"'" + escapeSql(campaign.status) + "'," +
campaign.created_at + "," +
(campaign.expires_at != null ? campaign.expires_at : "NULL") + "," +
```

Only `id`, `creator_address`, `title`, `status`, `creator_mx`, `escrow_*` (strings) are passed through `escapeSql`. The money/time fields (`budget_total`, `budget_remaining`, `reward_view`, `reward_click`, `created_at`, `expires_at`) are emitted verbatim. `handleCampaignAnnounce` coerces only `max_viewer_reward`, `max_daily_views`, `max_daily_clicks`, `cooldown_ms` (lines 14-25) — it never coerces the six fields above before calling `saveCampaign`.

**Attack vector.** `CAMPAIGN_ANNOUNCE` and `CAMPAIGN_DATA_RESPONSE` are **remote, unauthenticated** Maxima messages — any peer can send one to any node, and `handleCampaignDataResponse` simply forwards to `handleCampaignAnnounce`. The JSON `campaign` object is fully attacker-controlled. The early-accept branch (`!localPlatformSet && !localFoundationSet`, line 31-34) persists with **no on-chain check at all** on a default MVP node (`PLATFORM_KEY`/`FOUNDATION_KEY` are `null`), so the attacker reaches `saveCampaign` directly. By sending a string instead of a number, e.g.

```json
"campaign": { "id":"x", "creator_address":"0x..", "title":"t", "status":"active",
  "budget_total": "0,0,0,'a',0,0,NULL,'','',NULL,0,0,0,100,100,30000,'') ; DROP TABLE CAMPAIGNS ; --",
  "reward_view": 0, "reward_click": 0, "budget_remaining": 0, "created_at": 0 }
```

the crafted `budget_total` value is interpolated into the `VALUES(...)` clause, breaking out of the numeric position and injecting arbitrary SQL (DROP/DELETE/UPDATE against the local H2 store). At minimum this lets a remote peer corrupt or wipe a victim node's campaign/reward/channel tables (loss of accrued-but-unsettled voucher state ⇒ fund-affecting); H2 batch statements make multi-statement injection viable. The same raw-interpolation pattern exists in `updateBudget`, but its inputs come from the already-stored row (a string field there is only dangerous if a poisoned row was first written via this same hole).

**Why audit 2 missed it.** Audit 1/2 fixed the *string* injection class at the Maxima routing sinks (C-2, N-2, N-4, N2-1) and verified `escapeSql` on string columns. The *numeric* columns were treated as trusted-by-type; the remote announce path feeds them unchecked. This is the C-2 class at a new sink.

**Remediation.** Coerce the numeric campaign fields with `parseFloat`/`parseInt` (and reject non-finite values) **before** persisting — ideally inside `saveCampaign` so every caller is covered:

```js
function _num(v, dflt) { var n = parseFloat(v); return isFinite(n) ? n : dflt; }
// in saveCampaign, replace raw concatenations with coerced locals:
var budgetTotal     = _num(campaign.budget_total, 0);
var budgetRemaining = _num(campaign.budget_remaining, 0);
var rewardView      = _num(campaign.reward_view, 0);
var rewardClick     = _num(campaign.reward_click, 0);
var createdAt       = parseInt(campaign.created_at, 10) || Date.now();
var expiresAt       = (campaign.expires_at != null && isFinite(parseInt(campaign.expires_at,10)))
                        ? parseInt(campaign.expires_at, 10) : null;
// ...then interpolate budgetTotal, budgetRemaining, rewardView, rewardClick, createdAt,
//    (expiresAt != null ? expiresAt : "NULL")
```

Apply the same coercion to the numeric fields in `updateBudget` (defence in depth) and add `_num` coercion in `handleCampaignAnnounce` so a malformed announce is dropped early. Optionally add a sanity floor/ceiling (e.g. reject negative budgets) to reduce garbage-campaign noise.
**References:** Same class as audit 2 C-2 / N2-1 (unsanitised remote input → command/SQL string); new sink. `AGENTS.md §3.6` / `CLAUDE.md §6` ("Interpolate user input into SQL without `escapeSql()`") — the rule was applied to string columns only.

### Finding B-2: Numeric `cumulative` is parsed but never lower/upper-sanity-checked against negative or NaN at the SQL write (INFO/LOW)

**Severity:** LOW
**Component:** `public/service-workers/handlers/channel.handler.js` `_continueRewardVoucher` (REWARD_EVENTS insert, line ~829: `+ delta +`) and `_swDispatchVoucher` chain.
**Vulnerability type:** Input-domain / defensive-coding.

**Root cause / vector.** `cumulative` and `delta` are derived from `parseFloat(payload.cumulative)` (`handleRewardRequest`). The accrual guard (`delta > 0 && delta <= unit + epsilon`, `:605`) already rejects non-positive and over-unit deltas, and `cumulative > MAX_AMOUNT` is rejected (`:581`), so a NaN/negative `cumulative` fails those checks and returns early — **so this is not currently exploitable for injection** (`parseFloat` of a malicious string yields a number or NaN, never SQL text). It is recorded only as defence-in-depth: the values that reach `+ delta +` in SQL are numeric by construction. **No fix required for security**; if hardening, assert `isFinite()` before the REWARD_EVENTS write.

**Remediation.** Optional: `if (!isFinite(delta) || delta < 0) { return; }` guard before the `REWARD_EVENTS` MERGE. Low priority.

### Finding B-3: `MA_TRACK_VIEW`/`MA_TRACK_CLICK` are local-trust (INFO)

**Severity:** INFO (by design)
**Component:** `comms.handler.js handleTrackView/handleTrackClick`.
**Notes.** These arrive over `MDS.comms` (same-node cross-dapp bus), not Maxima, so the sender is a local MiniDapp on the same node — the existing trust model. The actual cross-node economic enforcement happens on the *creator* via the validated `REWARD_REQUEST` path (delta + cooldown + cap + N2-4 opener binding), which is sound. No action. (Consistent with audit 2's treatment of the self-reported-view model.)

---

## Summary Statistics
- New critical issues: **0**
- New high issues: **1** (B-1 — remote SQL injection in campaign ingestion)
- New medium issues: **0**
- New low issues: **1** (B-2 — defensive numeric guard; not currently exploitable)
- New info: **1** (B-3 — local-trust comms, by design)
- Regression risk from audit-2 fixes: **low** — all 10 verified correct, no behavioural regressions in the three high-risk areas (dedup prune, escrow gate, click cooldown).
- Overall security posture: **improved** vs. audit 2 (all MEDIUM/LOW findings closed), with one **pre-existing HIGH** now identified that must be closed before production.

## Recommendations
1. **Fix B-1 (HIGH) first.** Coerce `budget_total`, `budget_remaining`, `reward_view`, `reward_click`, `created_at`, `expires_at` with `parseFloat`/`parseInt` (reject non-finite) inside `saveCampaign`, and drop malformed announces early in `handleCampaignAnnounce`. Smallest-possible, highest-leverage patch; closes the last unsanitised-remote-input sink.
2. **Run the still-pending two-node verification** for the audit-2 fixes (§10 marks N2-1…N2-4 "Not yet 2-node verified"): confirm (a) a forged click `REWARD_REQUEST` stream is paced by `LAST_CLICK_VOUCHER_AT`; (b) a `REWARD_REQUEST` from a non-opener PK is rejected by the `OPENER_MX_PK` guard while legitimate SDK/comms flows still settle; (c) concurrent publisher channels cannot collectively exceed `MAX_PUBLISHER_BUDGET`; (d) `ESCROW_INFO_REQUEST` from a stranger is dropped but creator/counterparty answered.
3. **Optional hardening** (low priority): B-2 `isFinite` guard before reward-event writes; reject negative/over-large budgets in B-1's coercion to limit garbage campaigns; consider a one-statement-only execution policy if H2 batch statements are not required anywhere.
4. **Architecture:** no structural changes needed. The trust model (creator enforces accrual server-side; settlement bound to addresses fixed at channel-open; on-chain escrow as single budget authority) remains sound.

## Appendix A — Code Review Checklist
- ✓ User input validation (forms, URLs, Maxima payloads) — strings validated/escaped; **numeric campaign fields NOT coerced on the remote path → B-1**
- ✗ SQL injection vectors (all input through escapeSql) — string columns covered; **numeric columns in `saveCampaign`/`updateBudget` interpolated raw → B-1**
- ✓ Case sensitivity in queries (UPPER() on public keys, addresses) — consistent across handlers and core
- ✓ Authorization checks (creator ownership `_assertCreatorThen`; channel opener binding `OPENER_MX_PK`; escrow-info gate; `CREATOR_ADDRESS !== userAddress` in validators/comms)
- ✓ Maxima routing (all sends via `sendMaxima`→`_sendMaximaDirect` with hard-coded `poll:false`; routes validated by `isHexKey`/`isMaximaRoute`)
- ✓ Service Worker constraints (no ES6 / arrow / template literals / `console.log`; no trailing commas; both-runtime schema migrations)
- ✓ KissVM script integrity — `ESCROW_SCRIPT`/V3/V4 + `CHANNEL_SCRIPT` use `ASSERT SIGNEDBY`, 5-param `VERIFYOUT`, change-preserving; SW/FE constants byte-identical; matches audit 2 §7 conclusion
- ✓ No hardcoded secrets — `PLATFORM_KEY`/`FOUNDATION_KEY` null in MVP, overridable via validated keypairs
- ✓ No console.log in Service Worker
- ✓ No regressions from audit_2 fixes — N2-1…I-2 all verified correct, dedup-prune / escrow-gate / click-cooldown behave correctly

---

*End of third audit report.*
