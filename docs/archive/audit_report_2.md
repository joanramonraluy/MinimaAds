# MinimaAds — Second Security, Architecture & Runtime Audit

**Auditor role:** Senior Smart Contract & Decentralized Application Security Auditor
**Date:** 2026-06-14
**Scope:** `core/`, `public/service-workers/` (+ `handlers/`), `sdk/`, `dapp/`, `renderer/`, `service.js`, `config.js`
**Method:** Code-first independent review of the full data + control flow, then cross-referenced against `MinimaAds.md`, `AGENTS.md`, `CLAUDE.md`, `docs/KNOWN_ISSUES.md`, and the first audit (`docs/audit_report.md`, read last). KissVM verified against `refs/docs-main/content/docs/development/contracts-kissvm.mdx`.
**Commits reviewed since first audit:** `8d610a0`, `146ad88`, `508b7ed`, `16d4b89`, `4fe754b`, `9039bf5`, `424207c`, `c13cfe3`, `6bca5a3`, `8ad9b57`, `58c49f7`, `acdd140`, `df6f3ac`, `3a9623f`, `9d46bc7`, `ec44216`, `612d57a`, `b02d248`.

---

## 1) Executive Summary

The remediation from the first audit (commits `e30d5c6`, `0b1bacd`, `b02d248`) is **solid and verified**. All thirteen original tasks (T1–T13) plus the two re-audit findings (N-2, N-4 → T14/T15) are correctly implemented:

- **C-1** server-side accrual delta check is present and correct (`_handleRewardRequestInner`).
- **C-2 / N-2 / N-4** input validators (`isHexKey`, `isMaximaRoute`) are live on `publickey`, `viewer_mx`, `viewer_wallet_addr`, `viewer_wallet_pk`, `requester_contact`.
- **M-1** sender authentication (`_assertCreatorThen`) is correct, including the `CREATOR_ADDRESS` fallback for freshly-announced campaigns.
- **M-2 / M-3 / M-4 / L-1..L-4** all closed.
- **Rhino hygiene remains clean** across `service.js` + `public/service-workers/**`: zero `let`/`const`, arrow functions, template literals (the only backticks are inside `//` comments), `console.log`, or `TextEncoder`. SQL is funnelled through `sqlQuery()`/`escapeSql()`; upserts use `MERGE INTO … KEY(…)`; key comparisons use `.toUpperCase()` both sides.
- **KissVM escrow/channel scripts remain sound:** `ASSERT SIGNEDBY(creatorkey)` gates every escrow spend, `VERIFYOUT(INC(@INPUT) @ADDRESS change @TOKENID TRUE)` preserves change, all `VERIFYOUT` calls use the required 5 parameters, no division/overflow/underflow that mints value.

However, this pass finds **one new MEDIUM injection issue of the exact C-2 class that the original sweep did not reach**, and **one MEDIUM regression** introduced *after* the first audit that partially re-opens the C-1 attack surface for the click path. Both are remotely reachable and unauthenticated.

| # | Severity | Issue | Status vs. first audit |
|---|----------|-------|------------------------|
| **N2-1** | **MEDIUM** | `viewer_key`, `publisher_key`, `publisher_mx` flow into `MDS.cmd` via `sendMaxima()` **unvalidated** → remote command-parameter injection + `poll:true` SW-freeze DoS. | New (C-2 class, sink missed by T1/T2/T14 sweep) |
| **N2-2** | **MEDIUM** | Click `REWARD_REQUEST` **bypasses the server-side cooldown** (commit `508b7ed`). Clicks have no creator-side rate limit; only the per-channel cap + delta remain. | 🔄 Regression of C-1 (T7) |
| **N2-3** | **MEDIUM** | `MAX_PUBLISHER_BUDGET` is enforced only at channel-open (via `SUM(CUMULATIVE_EARNED)`), never at voucher time → concurrent publishers can over-allocate and spend into the viewer budget. | New |
| **N2-4** | **LOW** | Viewer-role `REWARD_REQUEST` does not bind `msg.data.from` to `viewer_key` → third party can advance/grief another viewer's channel; combined with N2-2 enables creator-budget drain to arbitrary recipients. | New |
| **N2-5** | **LOW** | `DEDUP_LOG` grows without bound (no pruning). | New |
| **N2-6** | **LOW** | `ESCROW_INFO_REQUEST` / `PROFILE_REQUEST` answer any peer with campaign financials / node profile. | New (info disclosure) |

The three priority-review changes were audited with extra care: the **shared NEWBLOCK coin scan (B)** and the **campaign-param pass (C)** are correct and fail-safe; the **click cooldown bypass (A)** is the regression captured as **N2-2**.

---

## 2) Status of First Audit Findings

| Finding | Severity | Status | Notes |
|---|---|---|---|
| C-1 — creator signs without accrual validation | CRITICAL | ⚠️ Partially Resolved | View path fully fixed (delta + cooldown, T7) and reservation capped (T8). **Click path regressed** — cooldown skipped for clicks (`508b7ed`). See **N2-2**. |
| C-2 — command injection (`publickey`, `viewer_mx`) | CRITICAL | ⚠️ Partially Resolved | The two named sinks are guarded. The **same class persists** on `viewer_key`/`publisher_key`/`publisher_mx` via `sendMaxima`. See **N2-1**. |
| M-1 — status-message spoof DoS | MEDIUM | ✅ Resolved | `_assertCreatorThen` (`campaign.handler.js:146`) threads `senderPk`, compares to `CREATOR_MX` route PK with `CREATOR_ADDRESS` fallback, `.toUpperCase()` both sides. |
| M-2 — `poll:true` FE freeze | MEDIUM | ✅ Resolved | No `poll:true` remains in `sdk/index.js` or `dapp/app.js`. |
| M-3 — CSS injection / privacy beacon | MEDIUM | ✅ Resolved | `renderAd` `safeColor`/`safePos`/clamps + scheme whitelist present (`renderer/renderAd.js:33-57`). |
| M-4 — budget double-accounting | MEDIUM | ✅ Resolved | `openChannel` no longer pre-debits; `createRewardEvent` skips local debit for `view`/`click`; on-chain `processEscrowCoin` is the single budget authority. |
| L-1 — direct `MDS.sql` in FE | LOW | ✅ Resolved | `frames.js` routes through `sqlQuery`. |
| L-2 — `escapeSql` non-string crash | LOW | ✅ Resolved | `String(str == null ? '' : str)` (`core/minima.js:33`). |
| L-3 — `safeUrl` scheme | LOW | ✅ Resolved | Whitelist `^(https?:\|mailto:)` (`renderer/renderAd.js:27`). |
| L-4 — unsolicited `addpermanent` | LOW | ✅ Resolved | Gated behind `MINIMAADS_ALLOW_RELAY` (`maxima.handler.js:88`). |
| N-2 — `viewer_wallet_addr`/`pk` unvalidated | MEDIUM | ✅ Resolved | Guards at `channel.handler.js:36-43` (`b02d248`). |
| N-4 — `requester_contact` unvalidated | LOW | ✅ Resolved | Guard at `maxima.handler.js:101-104` (`b02d248`). |
| N-1 — transient budget display window | INFO | ✅ Accepted by design | Unchanged. |
| N-3 — tautological publisher guard | INFO | ❌ Still present | `_doGeneratePublisherVoucher:1512-1516` still compares `pubReward` to itself. Harmless; optional cleanup. |
| N-5 — NEWBLOCK replay skips accrual recheck | INFO | ✅ Acceptable | Delta validated before queueing; `MAX_AMOUNT` still enforced in builder. |
| N-6 — cooldown default mismatch | INFO | ❌ Still present | `LIMITS.COOLDOWN_BETWEEN_REWARDS_MS=30000` vs DB `COOLDOWN_MS DEFAULT 300000`. Cosmetic (column never null for real campaigns). |

---

## 3) Priority Review: Recent High-Risk Changes

### A) Click reward cooldown bypass — `channel.handler.js:590-598` (commit `508b7ed`) → **MEDIUM (N2-2)**

The C-1 fix (T7) added a server-side cooldown using `CHANNEL_STATE.LAST_VOUCHER_AT`. Commit `508b7ed` wraps that check so **click events skip it entirely**:

```js
// channel.handler.js:587-598
if ((payload.reward_type || 'view') !== 'click') {
  var cooldown = (campaign.COOLDOWN_MS !== null && campaign.COOLDOWN_MS !== undefined)
    ? parseInt(campaign.COOLDOWN_MS, 10) : LIMITS.COOLDOWN_BETWEEN_REWARDS_MS;
  var lastAt   = parseInt(channel.LAST_VOUCHER_AT, 10) || 0;
  if (lastAt > 0 && (Date.now() - lastAt) < cooldown) { return; }  // never runs for clicks
}
```

**Is `isDuplicate(eventId)` + the accrual delta sufficient without cooldown? No.** The remaining guards for a click `REWARD_REQUEST` are:

1. `cumulative > channel.MAX_AMOUNT` → reject (per-channel cap, capped at `MAX_CHANNEL_RESERVATION = 10` for viewer channels).
2. `delta > 0 && delta <= REWARD_CLICK + ε` → one click unit per request.
3. `isDuplicate(eventId)`.

`eventId` is **generated by the viewer** (`handleTrackClick`: `Date.now()…+Math.random()…`, and a tampered client can forge any value). So `isDuplicate` only blocks reusing the *same* id — it does not bound the *number* of fresh click events. With the cooldown gone, an attacker (a tampered viewer client, or one crafting `REWARD_REQUEST` Maxima messages directly) can stream click requests as fast as the network allows, each adding `REWARD_CLICK`, until `cumulative` reaches the channel cap.

**Can a viewer replay click events to drain a campaign?** Not by *replay* (`isDuplicate` blocks that), but by **spamming fresh click events**:

- Per channel, drain = `MAX_AMOUNT` (≤ 10 Minima). With `REWARD_CLICK` at its floor `0.005`, that is ~2 000 clicks, all honoured in seconds.
- With the cooldown intact (default 30 000 ms / campaign value up to 300 000 ms), the same 2 000 clicks would take **16 hours to a week**. The cooldown was therefore the *dominant* rate limiter, and removing it for clicks is a substantial weakening.
- After a channel hits its cap, the viewer settles (spends the channel coin) and re-opens, repeating. Channel cycling is bounded by on-chain block time (a split + open per cycle), but the **per-campaign cooldown that was meant to pace accrual is fully defeated for clicks**.

The clicks are never verified by the creator (the creator trusts the `REWARD_REQUEST`), so this is "self-reported clicks with no rate limit" — the regression is fund-affecting. Severity is held at **MEDIUM** (not HIGH) only because the per-channel `MAX_CHANNEL_RESERVATION` cap and the on-chain cost of cycling channels bound the rate; the underlying loss is real campaign budget.

**Fix:** keep the UX goal (a click is allowed immediately after a view) but rate-limit click→click with a *separate* timestamp instead of bypassing the cooldown outright. See §8, Fix N2-2.

### B) Shared NEWBLOCK coin scan — `service.js:286-298` + `channel.handler.js` (commit `8d610a0`) → **Verified safe**

`_checkChannelCoinsOnBlock()` performs one `coins address:CHANNEL_SCRIPT_ADDRESS` scan and passes the array to both `checkPendingVouchers(coins)` and `checkOpenChannelsSettled(coins)`.

- **Mutation cross-talk:** Neither consumer mutates the array — `checkOnePendingVoucher` and `_processSettledChannels` only read `coins[i].coinid`. ✅
- **Empty/failed scan fail-safety:** on failure the array is `[]`. `checkPendingVouchers([])` finds nothing indexed → **dispatches nothing** (retries next block — safe). `checkOpenChannelsSettled([])` would treat every open channel's coin as absent, **but** for channels older than the 60 s grace window it issues a targeted `coins coinid:X relevant:true` verification before settling, so a transient empty address scan does **not** cause a false settlement. ✅ No silent channel lockup.
- **Consistency bonus:** because both consumers now see the *same* snapshot in a fixed order (`checkPendingVouchers` first, then `checkOpenChannelsSettled`), a coin that is present is dispatched and *not* settled in the same block; a coin that is absent is neither dispatched nor (within grace) settled — this is *more* consistent than the previous two independent scans.

No vulnerability. Net positive change.

### C) Campaign object passed as parameter — `channel.handler.js:503, 551, 1714-1727` (commit `16d4b89`) → **Verified safe**

`_handleRewardRequestInner` accepts `campaign` (6th param) from `handleRewardRequest`, and `_swDispatchVoucher` accepts it (11th param).

- **Stale/incorrect object:** the campaign is loaded from the creator's **own DB** in the same call stack and is not attacker-controlled. It is re-loaded per `REWARD_REQUEST`, so it cannot go stale across requests. The values used from it (`REWARD_VIEW`/`REWARD_CLICK` unit, `COOLDOWN_MS`) are exactly the ones the removed `getCampaign()` would have returned. ✅
- **Fallback intact:** `_swDispatchVoucher` uses the passed campaign only when `campaign && campaign.ESCROW_WALLET_PK`; otherwise it falls back to `getCampaign()`. `_dispatchPendingVoucher` correctly passes `null` (forcing the DB load), while `_handleRewardRequestInner`, `_doGeneratePublisherVoucher`, and `_replayDeferredPublisherRewardsNow` pass the loaded object. ✅

No vulnerability.

---

## 4) New Critical Vulnerabilities

**None.** No path was found that allows unauthorized drainage in a single request, theft of a counterparty's funds, or total compromise. The C-1 economic core (delta ≤ one unit, `MAX_AMOUNT` cap, reservation cap) holds; settlement payouts are bound to wallet addresses fixed at channel-open time, so a malicious `REWARD_REQUEST` cannot redirect funds.

---

## 5) New Medium Risks

### N2-1 — `viewer_key` / `publisher_key` / `publisher_mx` reach `MDS.cmd` unvalidated (C-2 class)

**Files / sinks:**
- `core/minima.js:76-102` — `sendMaxima(publicKey, mxAddress, …)` concatenates **both** arguments straight into `MDS.cmd("maxima action:send publickey:" + publicKey + … )` / `… to:" + mxAddress + …` with **no validation**.
- `channel.handler.js` — `handleChannelOpenRequest` validates `viewer_wallet_addr`/`viewer_wallet_pk` (`:36-43`) and `viewer_mx` (`:235`), but **never `viewer_key`**. `viewer_key` then flows to `sendMaxima(viewerKey, viewerMx, …)` at `:270` (CHANNEL_OPEN resend) and via `swBuildAndPostChannelOpenTx` to `sendMaxima(ctx.viewerKey, …)` at `:2180`, and into `txnstate … port:2 value:` + `ctx.viewerKey` at `:2126-2129` (the `viewerWalletPK || viewerKey` fallback).
- `channel.handler.js:1174` — `_doNotifyPublisherByKey` calls `sendMaxima(publisherKey, publisherMx, …)` where both come from the remote `REWARD_REQUEST` payload (`payload.publisher_key`, `payload.publisher_mx`) and neither is validated.

**Why it matters.** Maxima payloads are attacker-controlled (any peer can send any JSON to a creator/publisher node). `MDS.cmd` parses a space-delimited string, so a crafted value such as:

```
viewer_key = "0xAA poll:true"           → maxima action:send publickey:0xAA poll:true application:minima-ads data:… poll:false
publisher_mx = "Mx… application:other"   → maxima action:send to:Mx… application:other …
```

injects additional parameters into the send. The most damaging realistic effect is injecting **`poll:true`**: per `docs/KNOWN_ISSUES.md #5`, a blocking send to an offline peer **freezes the SW event loop ~77 s**. A remote, unauthenticated peer can therefore stall any creator/publisher node at will (sustained DoS), and can otherwise tamper with the send (redirect `to:`, alter `application:`). This is the exact class the first audit fixed for `publickey`/`viewer_mx`/`viewer_wallet_*` — the sweep simply did not reach the routing keys threaded into `sendMaxima`.

No fund theft results (settlement outputs are bound to addresses set at channel-open), so this is **MEDIUM**, consistent with how N-2 was rated.

**Fix (preferred — central, closes all current and future callers):** validate inside `sendMaxima`. See §8, Fix N2-1. The first re-audit even recommended "add the validation inside `sendMaxima` itself (defence in depth)"; that recommendation was applied only at the `requester_contact` call site, not centrally.

### N2-2 — Click `REWARD_REQUEST` bypasses server-side cooldown (regression of C-1)

Full analysis in §3-A. **File:** `channel.handler.js:590-598`. **Fix:** §8, Fix N2-2.

### N2-3 — `MAX_PUBLISHER_BUDGET` not enforced at voucher time → concurrent over-allocation

**Files:** `channel.handler.js:87-104` (open-time check), `_doGeneratePublisherVoucher:1525-1529` and `_handleRewardRequestInner` publisher branch (`:567`) (voucher-time checks).

The publisher-channel open budget gate compares `SUM(CUMULATIVE_EARNED)` across publisher channels against `MAX_PUBLISHER_BUDGET`:

```js
// channel.handler.js:88-99
"SELECT COALESCE(SUM(CUMULATIVE_EARNED), 0) AS EARNED FROM CHANNEL_STATE WHERE … ROLE = 'publisher'"
…
var pubRemaining = pubMaxBudget - pubEarned;
var effectiveCap = Math.min(maxAmount, pubRemaining);
if (effectiveCap < pubView || effectiveCap <= 0) { return; }   // reject
```

At **voucher** time the only caps are **per-channel** (`cumulative > channel.MAX_AMOUNT`). There is **no global check** that the sum of all publisher payouts stays ≤ `MAX_PUBLISHER_BUDGET`.

**Consequence.** If several publishers open channels concurrently before any earnings are recorded, each reads `SUM(CUMULATIVE_EARNED) = 0` and is admitted with `MAX_AMOUNT = PUBLISHER_REWARD_VIEW × 10`. N publishers can then each drain their channel cap, paying out up to `N × (pubView×10)` against a `MAX_PUBLISHER_BUDGET` that may be far smaller. Because publisher-channel splits debit the **same escrow coin** as viewer channels (`swBuildAndPostChannelTx` sets `BUDGET_REMAINING = change`), the over-allocation **spends into the viewer reward pool**. It is bounded by the total escrow (no loss beyond what was funded), and requires real or colluding view traffic on the publisher frames, hence **MEDIUM** rather than CRITICAL — but it breaks the `MAX_PUBLISHER_BUDGET` guarantee the spec promises.

**Fix:** at voucher time (`_doGeneratePublisherVoucher` and the publisher branch of `_handleRewardRequestInner`), reject when `SUM(CUMULATIVE_EARNED over publisher channels) − thisChannelOldCumulative + newCumulative > MAX_PUBLISHER_BUDGET`. See §8, Fix N2-3.

---

## 6) New Low Risks / Code Quality

### N2-4 (LOW) — viewer-role `REWARD_REQUEST` does not bind sender to `viewer_key`

`handleRewardRequest(payload, senderPk)` (`channel.handler.js:467`) receives `senderPk = msg.data.from` (Maxima-layer, cryptographically authentic) but never checks it against `payload.viewer_key` on the accept path. A third party can submit `REWARD_REQUEST`s for **someone else's** channel. They cannot steal (the voucher pays `channel.VIEWER_WALLET_ADDR`, fixed at open time), but they can advance/grief a victim's channel cumulative — and **combined with N2-2** can rapidly max out a victim's *click* channel, forcing the creator to pay real budget to the victim for clicks nobody made.

> **⚠️ Correction (post-report, 2026-06-14): the naive binding is NOT safe.** A first attempt to require `senderPk === viewer_key` was rejected after verifying the callers. The two channel-open paths use **different identity conventions** for `viewer_key`:
> - **comms.handler path** (built-in viewer / snippet `MA_TRACK_VIEW`): `viewer_key = MY_MAXIMA_PK` → equals `msg.data.from`. ✓
> - **SDK path** (`sdk/index.js _openNewChannel`, host dapps): `viewer_key = keys action:new` (a **wallet key**, not the Maxima PK), and no `viewer_wallet_pk` is sent. Here `msg.data.from` (the node's Maxima PK) **≠ `viewer_key`**.
>
> A `senderPk === viewer_key` guard would therefore **break the SDK reward flow**. A correct fix must first unify the `viewer_key` convention (e.g. always use the Maxima PK as the channel identity and carry the wallet key separately in `viewer_wallet_pk`, as the comms path already does), or bind against a stored `CHANNEL_STATE` field that records the opener's Maxima PK. This makes N2-4 a **design task**, not a one-line guard — deferred. Tracked below.

### N2-5 (LOW) — `DEDUP_LOG` grows without bound

`DEDUP_LOG` (`db-init.js:66`) gains a row per reward event (`createRewardEvent`, `_continueRewardVoucher`, voucher replay) and is **never pruned** (no `DELETE FROM DEDUP_LOG` anywhere). `LOGGED_AT` is stored but unused. Over a long-lived node this bloats the H2 store and slows the `isDuplicate` PK lookup. Not exploitable to bypass dedup (it is a PK existence check, not capacity-bounded), but recommend a periodic prune of rows older than the maximum possible replay window (e.g. > 7 days) on a throttled NEWBLOCK tick.

### N2-6 (LOW) — information disclosure to any peer

- `handleEscrowInfoRequest` (`maxima.handler.js:135`) returns detailed financials (`budget_total`, `budget_remaining`, `max_publisher_budget`, `publisher_budget_spent`, viewer/publisher earned, `escrow_left`, status) to **any** requester with no authentication.
- `handleProfileRequest` (`campaign.handler.js:726`) returns the node's Maxima `name` + `icon` to any peer (gated only by `senderPk` presence).

Campaign data is semi-public (broadcast via `CAMPAIGN_ANNOUNCE`), so impact is low, but escrow accounting and node profile are arguably more than a stranger needs. Consider restricting `ESCROW_INFO_RESPONSE` to the campaign creator / known channel counterparties.

### Informational (no action required for security)

- **I-1 — On-chain fee branches are never exercised.** Every channel spend sets `feeflag` (port 11) and `foundationfeeflag` (port 16) to `0` (`swBuildAndPostChannelTx:1998-1999`, `swBuildAndPostChannelOpenTx:2133-2134`), so the V3/V4 `IF feeflag EQ 1` / `IF foundationfeeflag EQ 1` `VERIFYOUT` branches are dead at spend time. The fee is paid by the *funding* tx's explicit outputs (`buildEscrowFundingTx`), not enforced by the script. Harmless in MVP (`PLATFORM_KEY`/`FOUNDATION_KEY` are `null`), but means the on-chain fee enforcement is advisory, not mandatory — relevant before mainnet if fees become mandatory.
- **I-2 — Viewer/creator `MAX_AMOUNT` mismatch.** A viewer's local `CHANNEL_STATE.MAX_AMOUNT` is set from `MAX_VIEWER_REWARD` (uncapped), but the creator caps the channel to `MAX_CHANNEL_RESERVATION = 10` and `CHANNEL_OPEN`/`activateChannel` does not update the viewer's `MAX_AMOUNT`. If `MAX_VIEWER_REWARD > 10`, the viewer believes it has more headroom than the creator will honour; requests beyond 10 are rejected server-side. Cosmetic/functional, not a security issue (the creator's record is the boundary).
- **I-3 — N-3 tautology and N-6 cooldown-default mismatch** persist (see §2). Optional cleanups.
- **I-4 — `sdk/index.js` uses `console.log`.** Acceptable: the SDK runs in the FE/host context, not the Rhino SW. The SW never `MDS.load`s `sdk/index.js`.

---

## 7) Documentation vs. Code Discrepancies

1. **Click cooldown vs. the C-1 remediation contract.** `docs/audit_report.md` §7 (T7) states the fix "enforce[s] the campaign cooldown server-side via `LAST_VOUCHER_AT`" as the C-1 control. Commit `508b7ed` silently exempts clicks from that control. `AGENTS.md §6` documents the change, but the audit's remediation invariant ("creator enforces cooldown") is no longer true for clicks. Reconcile: either restore a click-specific cooldown (recommended, §8 N2-2) or update the C-1 spec to state explicitly that clicks are rate-limited *only* by the per-channel cap.
2. **`COOLDOWN_MS` default.** `db-init.js` and `handleRequestCampaignData` default `cooldown_ms` to `300000`, while `service.js` `LIMITS.COOLDOWN_BETWEEN_REWARDS_MS = 30000`. Whichever is intended should be made consistent (N-6, carried over).
3. **`MAX_PUBLISHER_BUDGET` guarantee.** `AGENTS.md §4` states "`MAX_PUBLISHER_BUDGET` is a capped subset of `BUDGET_TOTAL`." The code enforces that cap only at channel-open, not at payout (N2-3), so the documented invariant can be violated under concurrency.

No KissVM grammar discrepancies: the scripts in `service.js`/`creator.js` match the 5-parameter `VERIFYOUT(index address amount tokenid keepstate)` form required by `contracts-kissvm.mdx`, and the byte-identical SW/FE escrow constants were confirmed.

---

## 8) Recommended Fixes

### Fix N2-1 — Validate routing identifiers centrally in `sendMaxima`

```diff
--- a/core/minima.js
+++ b/core/minima.js
 function sendMaxima(publicKey, mxAddress, payload, cb) {
+  // SECURITY (N2-1): publicKey / mxAddress may originate from remote Maxima
+  // payloads (viewer_key, publisher_key, publisher_mx). Without validation a
+  // crafted value injects extra parameters into "maxima action:send ..." — most
+  // dangerously poll:true, which freezes the SW event loop ~77s (KNOWN_ISSUES #5).
+  if (publicKey && !isHexKey(publicKey)) {
+    MDS.log("[MINIMA] sendMaxima rejected: malformed publicKey");
+    if (cb) { cb(false); }
+    return;
+  }
+  if (mxAddress && !isMaximaRoute(mxAddress)) {
+    MDS.log("[MINIMA] sendMaxima rejected: malformed mxAddress");
+    if (cb) { cb(false); }
+    return;
+  }
   MDS.log("[MINIMA] sendMaxima called: publicKey=" + (publicKey ? publicKey.substring(0, 16) + "..." : "null") + " mxAddress=" + (mxAddress ? mxAddress.substring(0, 20) + "..." : "null") + " payloadType=" + (payload && payload.type));
```

Legitimate values pass: `publicKey` is always a `0x…` Maxima/wallet PK (`isHexKey`), and `mxAddress` is always an `Mx…@host:port` contact or a `MAX#<pk>#<mls>` route — neither contains whitespace (`isMaximaRoute`). Add the same call-site guard on `viewer_key` in `handleChannelOpenRequest`/`handleRewardRequest` if defence-in-depth at the boundary is preferred.

### Fix N2-2 — Rate-limit click→click without blocking view→click

Add a dedicated click timestamp so a click immediately after a view is allowed, but click spam is paced.

```diff
--- a/public/service-workers/db-init.js   (and the FE DB init in dapp/app.js)
+++ b/public/service-workers/db-init.js
   sqlQuery("ALTER TABLE CHANNEL_STATE ADD COLUMN IF NOT EXISTS LAST_VOUCHER_AT BIGINT DEFAULT 0", function() {
+  sqlQuery("ALTER TABLE CHANNEL_STATE ADD COLUMN IF NOT EXISTS LAST_CLICK_VOUCHER_AT BIGINT DEFAULT 0", function() {
   /* ...continue chain... */
+  });
   });
```

```diff
--- a/public/service-workers/handlers/channel.handler.js
+++ b/public/service-workers/handlers/channel.handler.js
-    if ((payload.reward_type || 'view') !== 'click') {
-      var cooldown = (campaign.COOLDOWN_MS !== null && campaign.COOLDOWN_MS !== undefined)
-        ? parseInt(campaign.COOLDOWN_MS, 10) : LIMITS.COOLDOWN_BETWEEN_REWARDS_MS;
-      var lastAt   = parseInt(channel.LAST_VOUCHER_AT, 10) || 0;
-      if (lastAt > 0 && (Date.now() - lastAt) < cooldown) {
-        MDS.log("[CHANNEL] REWARD_REQUEST: cooldown not elapsed. since=" + (Date.now() - lastAt) + " cooldown=" + cooldown + " campaign: " + campaignId);
-        return;
-      }
-    }
+    var cooldown = (campaign.COOLDOWN_MS !== null && campaign.COOLDOWN_MS !== undefined)
+      ? parseInt(campaign.COOLDOWN_MS, 10) : LIMITS.COOLDOWN_BETWEEN_REWARDS_MS;
+    // Clicks are paced against the last CLICK voucher only (not the last view),
+    // so a click right after a view is allowed but click→click spam is rate-limited.
+    var lastAt = ((payload.reward_type || 'view') === 'click')
+      ? (parseInt(channel.LAST_CLICK_VOUCHER_AT, 10) || 0)
+      : (parseInt(channel.LAST_VOUCHER_AT, 10) || 0);
+    if (lastAt > 0 && (Date.now() - lastAt) < cooldown) {
+      MDS.log("[CHANNEL] REWARD_REQUEST: cooldown not elapsed. type=" + (payload.reward_type || 'view') + " since=" + (Date.now() - lastAt) + " cooldown=" + cooldown + " campaign: " + campaignId);
+      return;
+    }
```

```diff
--- a/core/channels.js   (updateChannelVoucher — set the click timestamp too)
+++ b/core/channels.js
-function updateChannelVoucher(campaignId, viewerKey, role, cumulativeEarned, latestTxHex, cb) {
+function updateChannelVoucher(campaignId, viewerKey, role, cumulativeEarned, latestTxHex, cb, rewardType) {
   var r = role || 'viewer';
   var now = Date.now();
+  var clickSet = (rewardType === 'click') ? (", LAST_CLICK_VOUCHER_AT = " + now) : "";
   var sql = "UPDATE CHANNEL_STATE " +
     "SET CUMULATIVE_EARNED = " + cumulativeEarned + ", " +
     "LATEST_TX_HEX = '" + escapeSql(latestTxHex) + "', " +
-    "LAST_VOUCHER_AT = " + now + " " +
+    "LAST_VOUCHER_AT = " + now + clickSet + " " +
     "WHERE …";
```

Pass `ctx.rewardType` from `swBuildAndExportVoucherTx`'s `updateChannelVoucher` call (and the FE equivalent). Apply the same schema column in the FE DB init for parity.

### Fix N2-3 — Enforce `MAX_PUBLISHER_BUDGET` at voucher time

In `_doGeneratePublisherVoucher`, before dispatch, sum publisher earnings across the campaign and reject if this voucher would exceed the global cap:

```diff
--- a/public/service-workers/handlers/channel.handler.js
+++ b/public/service-workers/handlers/channel.handler.js
@@ _doGeneratePublisherVoucher  (after the per-channel MAX_AMOUNT check)
     var cumulative = parseFloat(pubChannel.CUMULATIVE_EARNED) + pubReward;
     if (cumulative > parseFloat(pubChannel.MAX_AMOUNT)) { /* ...existing... */ return; }
+    // Global publisher-budget cap: the sum of ALL publisher payouts for this
+    // campaign must not exceed MAX_PUBLISHER_BUDGET (concurrent publishers can
+    // otherwise over-allocate into the viewer budget — N2-3).
+    sqlQuery(
+      "SELECT COALESCE(SUM(CUMULATIVE_EARNED),0) AS E FROM CHANNEL_STATE WHERE " +
+      "UPPER(CAMPAIGN_ID) = UPPER('" + escapeSql(campaignId) + "') AND ROLE = 'publisher'",
+      function(sumErr, sumRows) {
+        var earnedAll = (sumRows && sumRows[0]) ? parseFloat(sumRows[0].E) : 0;
+        var projected = earnedAll - (parseFloat(pubChannel.CUMULATIVE_EARNED) || 0) + cumulative;
+        var cap = parseFloat(campaign.MAX_PUBLISHER_BUDGET || 0) || 0;
+        if (cap > 0 && projected > cap + 0.000001) {
+          MDS.log("[CHANNEL] _doGeneratePublisherVoucher: MAX_PUBLISHER_BUDGET exceeded. projected=" + projected + " cap=" + cap + " campaign: " + campaignId);
+          return;
+        }
+        _continuePublisherVoucher();
+      }
+    );
+    return;
+    function _continuePublisherVoucher() {
     var pubEventId = 'pub-' + eventId;
     /* ...existing isDuplicate(...) body unchanged... */
+    }
```

Apply the equivalent guard in the deferred-replay accrual loop (`_replayDeferredPublisherRewardsNow`) and the publisher branch of `_handleRewardRequestInner`.

### Fix N2-4 — Bind `REWARD_REQUEST` sender to the channel opener (DESIGN TASK)

> The naive `senderPk === viewer_key` guard is **unsafe** (breaks the SDK path — see §6 correction). Two viable approaches, both requiring care:
>
> **Option A (preferred, unifies the model):** change `sdk/index.js _openNewChannel` to use `MY_MAXIMA_PK` as `viewer_key` and send the fresh wallet key as `viewer_wallet_pk` (exactly as `comms.handler.js _doSendChannelOpenRequest` already does). Then `viewer_key` is uniformly the Maxima PK across both paths and the one-line binding becomes valid:
> ```diff
> +  if (senderPk && payload.viewer_key && senderPk.toUpperCase() !== payload.viewer_key.toUpperCase()) {
> +    MDS.log("[CHANNEL] REWARD_REQUEST rejected: sender PK != viewer_key");
> +    return;
> +  }
> ```
> This is a breaking change to the SDK channel-identity convention and must be migrated/verified on a two-node + host-dapp setup.
>
> **Option B (non-breaking):** persist the opener's Maxima PK in a new `CHANNEL_STATE.OPENER_MX_PK` column at `CHANNEL_OPEN_REQUEST` time (from `senderPk`), then in `handleRewardRequest` require `senderPk === channel.OPENER_MX_PK`. Adds a column (both runtimes) but does not change the wire `viewer_key`.
>
> Either way this is a **design task**, not a quick guard — schedule a dedicated Opus session.

### Fix N2-5 / N2-6 — defence-in-depth (low priority)

- Prune `DEDUP_LOG` on a throttled NEWBLOCK tick: `DELETE FROM DEDUP_LOG WHERE LOGGED_AT < <now − 7d>`.
- Gate `ESCROW_INFO_REQUEST` behind a creator/counterparty check, or drop fields a stranger does not need.

---

## 9) Conclusions & Next Steps

The project's security posture is **materially better than at the first audit**: the four headline vulnerabilities (C-1, C-2, M-1, M-3) and the two re-audit follow-ups (N-2, N-4) are closed and verified, Rhino/H2 hygiene is clean, and the KissVM trust model is intact. The remaining issues are narrower and, with one exception, the same *class* the team has already shown it can fix cleanly.

**Prioritised remediation:**

1. **N2-1 (MEDIUM)** — harden `sendMaxima` centrally. Smallest, highest-leverage fix; closes the last C-2-class injection (including a remote SW-freeze DoS) for `viewer_key`/`publisher_key`/`publisher_mx` and any future caller.
2. **N2-2 (MEDIUM)** — restore click rate-limiting via a separate `LAST_CLICK_VOUCHER_AT`. Reverses a fund-affecting regression of the C-1 fix while preserving the intended view→click UX.
3. **N2-3 (MEDIUM)** — enforce `MAX_PUBLISHER_BUDGET` at voucher time, not only at channel-open.
4. **N2-4 (LOW)** — bind `REWARD_REQUEST` sender to `viewer_key` (also blunts N2-2 griefing).
5. **N2-5 / N2-6 (LOW)** — prune `DEDUP_LOG`; restrict `ESCROW_INFO_REQUEST`.
6. **Cleanups** — N-3 tautology, N-6 cooldown default, I-2 viewer `MAX_AMOUNT` sync.

**Two-node verification to run after fixes** (the first audit's T10 is still open): (a) a normal view *and* a normal click voucher both settle end-to-end; (b) a stream of forged click `REWARD_REQUEST`s is now paced by the click cooldown (N2-2); (c) a `REWARD_REQUEST` whose `viewer_key` carries a space is dropped by the hardened `sendMaxima` (N2-1) and one whose sender ≠ `viewer_key` is rejected (N2-4); (d) concurrent publisher channels cannot collectively exceed `MAX_PUBLISHER_BUDGET` (N2-3); (e) the legitimate creator broadcast path (pause/finish) still applies — regression-check M-1. Confirm no FE console errors and that SW logs show the new rejection messages.

---

## 10) Remediation Tracker (live)

> One task per session, isolated and independently reviewable (CLAUDE.md §8). Each executing agent: do the public complexity assessment first (CLAUDE.md §2), then on completion mark `[x]` here **and** update `docs/TASKS.md` + add a handoff to `AGENTS.md §6`. Schema changes go in **both** runtimes (`db-init.js` + FE `app.js`). Suggested starting prompt per task:
> *"Read `docs/audit_report_2.md` §8, task `<id>`. Implement only this task per its diff and CLAUDE.md. Do the §2 assessment and wait for my model confirmation before coding. On finish: update §10 here, `docs/TASKS.md`, and `AGENTS.md §6`."*

| Task | Sev | Model | Session | Status |
|---|---|---|---|---|
| **N2-1** — validate `publicKey`/`mxAddress` centrally in `sendMaxima` | MEDIUM | Sonnet | this audit session | ✅ **Done 2026-06-14** — guard added in `core/minima.js sendMaxima` (rejects non-`isHexKey` PK / non-`isMaximaRoute` route before `MDS.cmd`). Not yet 2-node verified. |
| **N2-2** — restore click rate-limit via `LAST_CLICK_VOUCHER_AT` | MEDIUM | **Opus** | this session | ✅ **Done 2026-06-14** — added `LAST_CLICK_VOUCHER_AT` column (both runtimes); cooldown in `channel.handler.js` now reads the per-type timestamp (click→click paced, view→click still immediate); `updateChannelVoucher` bumps it when `rewardType==='click'`. Not yet 2-node verified. |
| **N2-3** — enforce `MAX_PUBLISHER_BUDGET` at voucher time | MEDIUM | **Opus** | this session | ✅ **Done 2026-06-15** — global publisher-budget cap added at voucher time in all 3 sites of `channel.handler.js` (`_doGeneratePublisherVoucher`, `_replayDeferredPublisherRewardsNow`, publisher branch of `_handleRewardRequestInner`). Each sums `CUMULATIVE_EARNED` across publisher channels and rejects when `earnedAll − thisChannelOldCumulative + newCumulative > MAX_PUBLISHER_BUDGET + 1e-6`. Not yet 2-node verified. |
| **N2-4** — bind `REWARD_REQUEST` sender to channel opener | LOW | **Opus** | 2026-06-15 | ✅ **Done 2026-06-15** — Option B: `OPENER_MX_PK VARCHAR(512) DEFAULT ''` added to `CHANNEL_STATE` (both runtimes); `openChannel` / `_doMergeChannel` store it from `senderPk`; guard in `_handleRewardRequestInner` rejects when stored PK ≠ `msg.data.from` (fails-open on empty column). SDK call site passes `''`. Not yet 2-node verified. |
| **N2-5** — prune `DEDUP_LOG` | LOW | Sonnet | 2026-06-15 | ✅ **Done 2026-06-15** — `pruneDedupLog()` added to `campaign.handler.js`; throttled to once per 6 h via `_lastDedupPruneAt`; deletes rows older than 7 days; called on every NEWBLOCK from `service.js`. |
| **N2-6** — restrict `ESCROW_INFO_REQUEST` / `PROFILE_REQUEST` | LOW | Haiku/Sonnet | 2026-06-15 | ✅ **Done 2026-06-15** — `handleEscrowInfoRequest` now requires requester is campaign creator (CREATOR_ADDRESS match) or channel counterparty (`OPENER_MX_PK` match in CHANNEL_STATE); strangers are silently dropped. `PROFILE_REQUEST` left unrestricted (name+icon is public info, restricting breaks campaign discovery UI). Logic extracted to `_doEscrowInfoResponse()`. |
| **I-2/N-3/N-6** — cosmetic cleanups | INFO | Haiku | 2026-06-15 | ✅ **Done 2026-06-15** — N-3: removed tautological `pubReward > pubReward + epsilon` guard in `_doGeneratePublisherVoucher`. N-6: aligned `COOLDOWN_MS DEFAULT 30000` in `db-init.js` to match `LIMITS.COOLDOWN_BETWEEN_REWARDS_MS`. I-2: capped viewer `maxAmount` at `LIMITS.MAX_CHANNEL_RESERVATION` in both `comms.handler.js` and `sdk/index.js` `_computeMaxAmount`. |

---

*End of second audit report.*
