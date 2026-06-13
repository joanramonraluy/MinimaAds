# MinimaAds — Security, Architecture & Runtime Audit

**Auditor role:** Senior Smart Contract & Decentralized Application Security Auditor
**Date:** 2026-06-12
**Scope:** `core/`, `public/service-workers/` (+ `handlers/`), `sdk/`, `dapp/`, `renderer/`, `service.js`
**Specs reviewed:** `MinimaAds.md`, `AGENTS.md`, `CLAUDE.md`, `docs/KNOWN_ISSUES.md`
**Method:** Static review of the full data + control flow: KissVM escrow/channel scripts, the off‑chain voucher protocol, the Maxima message dispatcher, the H2 data layer, and Rhino runtime compatibility of all Service‑Worker code.

---

## 1) Executive Summary

The codebase is **mature and disciplined**. Rhino‑runtime hygiene is excellent: a full sweep of `service.js` + `public/service-workers/**` found **zero** uses of `let`/`const`, arrow functions, template literals, `console.log`, or `TextEncoder`/`TextDecoder` in Service‑Worker code. SQL is consistently funnelled through `sqlQuery()`/`escapeSql()` (correct H2 `''` quote‑doubling), upserts use `MERGE INTO … KEY(…)`, and string/key comparisons use `UPPER()` on both sides. The on‑chain **KissVM escrow and channel scripts are sound** for their trust model — the change‑return invariant `VERIFYOUT(INC(@INPUT) @ADDRESS change @TOKENID TRUE)` is present and correct, `VERIFYOUT` is always called with the required 5 parameters, and there are no division/overflow hazards.

However, the audit identifies **one critical economic flaw** and **two remotely‑triggerable issues** that undermine the security guarantees the on‑chain scripts are designed to provide:

| # | Severity | Issue |
|---|----------|-------|
| C‑1 | **CRITICAL** | Creator co‑signs payment vouchers with **no server‑side accrual validation** → a malicious viewer drains a campaign's entire remaining budget with a single forged request. |
| C‑2 | **CRITICAL** | **Remote command injection** — unvalidated Maxima payload fields (`publickey`, `viewer_mx`) are concatenated directly into `MDS.cmd(...)` strings. |
| M‑1 | **MEDIUM** | `CAMPAIGN_PAUSE` / `CAMPAIGN_FINISH` / `CAMPAIGN_RESUME` accept **no sender authentication** → remote griefing DoS, made *permanent* by the terminal‑state guard. |
| M‑2 | **MEDIUM** | FE Maxima sends use `poll:true` in hot paths → UI thread freeze (~77 s) when the peer is offline. |
| M‑3 | **MEDIUM** | Advertiser‑controlled `bg_color`/`text_color`/`image_position` are injected raw into inline CSS → privacy beacon / IP de‑anonymisation. |
| L‑1..L‑4 | **LOW** | Direct `MDS.sql` in FE, `escapeSql` non‑string crash, `data:` scheme not blocked, unsolicited `maxextra addpermanent`. |

The headline risk is **C‑1**: every anti‑abuse control (cooldown, daily caps, duplicate detection, "creator cannot earn from own campaign") lives in `core/validation.js`, which runs **only on the viewer's own node**. The paying party — the creator's node — performs none of these checks before signing a voucher. The cryptography is correct; the **authorization policy is on the wrong side of the trust boundary**.

---

## 2) CRITICAL VULNERABILITIES

### C‑1 — Creator signs vouchers without validating reward accrual (full budget drain)

**Files:** `public/service-workers/handlers/channel.handler.js` — `handleRewardRequest` (L447), `_handleRewardRequestInner` (L531‑617), `swBuildAndExportVoucherTx` (L1684); `handleChannelOpenRequest` (L194‑217); `core/validation.js` (entire file).

**The trust model as implemented.** When a viewer "watches" an ad, their *own* node runs `validateView()` (cooldown, daily limit, budget, self‑reward, per‑channel cap) and then sends a `REWARD_REQUEST` to the creator. The creator's node receives it in `handleRewardRequest` and, if accepted, **builds and signs** a 2‑of‑2 channel voucher paying `cumulative` to the viewer (`swBuildAndExportVoucherTx`).

The *only* checks the creator performs before signing are (L538‑556):

```js
if (channel.STATUS !== 'open' && channel.STATUS !== 'settled') return;   // channel state
if (cumulative > parseFloat(channel.MAX_AMOUNT)) return;                  // <= reservation
isDuplicate(eventId, ...)                                                 // event_id not seen
```

There is **no** check that:
- the new `cumulative` increased by at most one reward unit (`cumulative - channel.CUMULATIVE_EARNED <= REWARD_VIEW`);
- the cooldown elapsed since the previous voucher;
- the daily view/click cap was respected.

**Exploit.** A modified viewer client skips `validateView()` entirely and:
1. Sends `CHANNEL_OPEN_REQUEST` with `max_amount = BUDGET_REMAINING`. The creator accepts because the only gate is `BUDGET_REMAINING < maxAmount → reject` (L214). The full budget is now reserved to one channel.
2. Sends a single `REWARD_REQUEST` with `cumulative = max_amount` and a fresh `event_id`.
3. The creator signs a voucher paying the **entire campaign budget** to the attacker for **one (or zero) ad views**.

`MAX_AMOUNT` is attacker‑chosen and bounded only by the remaining budget, so the cap at L547 does not contain the attack. The on‑chain escrow/channel scripts cannot help here — they faithfully execute a tx the creator *voluntarily signed*. This defeats the core "pay per genuine view" economic model and results in **direct loss of the creator's escrowed funds**.

> The cooldown / daily‑cap / duplicate logic in `validation.js` is security theatre against a hostile counterparty: it is enforced exclusively on the node that *benefits* from cheating.

**Fix:** the creator must re‑derive the legitimate increment server‑side. See **§5, Fix C‑1**.

---

### C‑2 — Remote command injection via unvalidated Maxima payload into `MDS.cmd`

**Files:** `public/service-workers/handlers/maxima.handler.js` — `handleRegisterPermanentRequest` (L76‑111); `public/service-workers/handlers/channel.handler.js` — `handleChannelOpenRequest` (L219).

Maxima payloads are attacker‑controlled (any peer can send any JSON). Two sinks concatenate payload fields straight into a command string passed to `MDS.cmd`:

```js
// maxima.handler.js:85  — payload.publickey is fully attacker-controlled
var cmd = "maxextra action:addpermanent publickey:" + pubkey;
MDS.cmd(cmd, ...);

// channel.handler.js:219 — payload.viewer_mx is fully attacker-controlled
MDS.cmd("maxima action:addcontact contact:" + viewerMx, ...);
```

`MDS.cmd` parses a space‑delimited command string. A value such as
`publickey:0xAA action:<other> param:<...>` injects **additional command parameters** into the `maxextra`/`maxima` invocation. The blast radius is the parameter space of those two commands (route registration, contact manipulation, MLS state) rather than arbitrary shell, but it is **remotely reachable, unauthenticated, and trivially triggered** — exactly the class of bug the project's own rules try to prevent for SQL (`escapeSql`) but which has no equivalent for command strings.

Numeric remote fields elsewhere (`max_amount`, `cumulative`) are safe because they pass through `parseFloat()` before interpolation; the gap is specifically the **string** payload fields used in command context.

**Fix:** validate `publickey` as `^0x[0-9A-Fa-f]+$` and `viewer_mx` against the Maxima address/route grammar before use; reject otherwise. See **§5, Fix C‑2**.

---

## 3) MEDIUM RISKS

### M‑1 — No sender authentication on campaign status messages (permanent remote DoS)

**Files:** `campaign.handler.js` — `handleCampaignPause` (L111), `handleCampaignFinish` (L119), `handleCampaignResume` (L127), `applyStatusChange`; dispatcher `maxima.handler.js` L30‑35.

The dispatcher does not even pass `msg.data.from` to these handlers, and the handlers apply the status change with **no check that the sender is the campaign creator**:

```js
function handleCampaignFinish(payload){ ... applyStatusChange(payload.campaign_id, "finished"); }
```

Any peer can send `CAMPAIGN_FINISH {campaign_id: <victim>}` and every recipient marks that campaign `finished` locally, halting ad serving and reward tracking. Worse, the on‑chain reconciliation in `processEscrowCoin` contains a **terminal‑state guard** (L266‑267, KNOWN_ISSUES #48) that *refuses* to revert a `finished` campaign back to `active` from on‑chain reads. So a single spoofed `CAMPAIGN_FINISH` is **permanent and unrecoverable** without manual DB intervention — even though the authoritative on‑chain `PREVSTATE(7)` still says `active`.

The secure status channel already exists (on‑chain `PREVSTATE(7)`, validated in `processEscrowCoin`). The unauthenticated Maxima "fast path" is a downgrade attack against it.

**Fix:** thread `senderPk` into the three handlers and compare (case‑insensitively) against the campaign's known creator key (`CREATOR_MX`/`CREATOR_ADDRESS` or the on‑chain `STATE(4)` route PK) before applying. See **§5, Fix M‑1**.

### M‑2 — `poll:true` Maxima sends in FE hot paths freeze the UI

**Files:** `sdk/index.js` `_sendToCreator` (L279, `poll:true`); `dapp/app.js` `sendChannelMaxima` (L404, `poll:true`).

KNOWN_ISSUES #17 / PLATFORM_NOTES §2.3 document that a blocking send to an offline peer freezes the event loop for ~77 s. The SW correctly uses `poll:false` everywhere (`core/minima.js` `sendMaxima`). But the **SDK's `_sendToCreator`** — used to deliver `REWARD_REQUEST`, the viewer's primary hot path — and `app.js sendChannelMaxima` both use `poll:true`. If the creator is offline at the instant of the call, the **viewer's UI thread** stalls for ~77 s. The liveness ping gates most flows, but it is cached for 2 min and races with the creator going offline. Comments justify `poll:true` as "survive the recipient being offline", but Maxima already persists `poll:false` sends for offline delivery via the recipient's MLS; the blocking variant buys nothing here and costs a UI freeze.

**Fix:** use `poll:false` for FE sends, consistent with the SW.

### M‑3 — CSS injection from advertiser fields (privacy beacon)

**File:** `renderer/renderAd.js` (L52‑113).

`renderAd` correctly strips HTML tags (`DOMPurify.sanitize(s, {ALLOWED_TAGS:[]})`), neutralises `javascript:` hrefs, and whitelists image data URIs. But `bg_color`, `text_color`, `image_position`, `image_zoom`, `image_width_pct` are advertiser‑controlled (arrive via Maxima `CAMPAIGN_ANNOUNCE`) and are interpolated **raw** into `element.style.cssText`:

```js
'... background:' + bgColor + ';box-sizing:border-box;' ...
'... object-position:' + imgPos + ';display:block;' + zoomCss;
```

Assignment is via `.style.cssText` (not `innerHTML`), so this is **CSS injection, not HTML/JS injection**. A value like
`#fff;background-image:url(https://attacker.example/track.png)` causes every viewer's browser to fetch an attacker URL, leaking IP/timing and de‑anonymising the viewer, and can be used for layout‑based UI redress. No script execution, hence MEDIUM not CRITICAL.

**Fix:** validate colours against `^#[0-9A-Fa-f]{3,8}$` (or a CSS‑colour whitelist), constrain `image_position` to a fixed enum, and clamp the numeric zoom/width. See **§5, Fix M‑3**.

### M‑4 — Budget double‑accounting (correctness)

**Files:** `core/channels.js` `_doMergeChannel` (viewer path calls `updateBudget(maxAmount)`, L36); `swBuildAndPostChannelTx` overwrites `BUDGET_REMAINING = change` from the on‑chain split (L1926‑1927); `core/rewards.js` `createRewardEvent` → `updateBudget(amount)` again (L61).

The same spend is debited from `BUDGET_REMAINING` up to three times along different code paths (reservation at channel open, on‑chain split sync, and per‑reward event). The on‑chain escrow remains the source of truth, so this is not fund loss, but the displayed/queried `BUDGET_REMAINING` can diverge and prematurely flip a campaign to `finished` (`updateBudget` sets `finished` when `remaining <= 0`, L94). Recommend a single authoritative budget‑sync path (the on‑chain `processEscrowCoin` read) and removing the redundant `updateBudget` debits.

---

## 4) LOW RISKS / CODE QUALITY

- **L‑1 — Direct `MDS.sql` in the FE.** `dapp/views/frames.js:247` calls `MDS.sql(...)` directly, violating CLAUDE.md §6 ("Call `MDS.sql` directly outside `core/minima.js`" is forbidden). It does escape manually (`fid.replace(/'/g,"''")`) so it is not injectable, but it should route through `core/frames.js`/`sqlQuery`.
- **L‑2 — `escapeSql` has no type guard.** `core/minima.js:32` `str.replace(...)` throws if a caller passes `undefined`/number. Most callers wrap with `|| ''`, but a missing required field (e.g. `createRewardEvent` with `campaign_id === undefined`) throws inside an SW callback and is silently lost. Add `String(str == null ? '' : str)`.
- **L‑3 — `safeUrl` only blocks `javascript:`.** `renderer/renderAd.js:25` allows `data:`/`vbscript:`/`blob:` CTA hrefs. Top‑level navigation to `data:text/html` is blocked by modern browsers, so impact is minimal, but a scheme **whitelist** (`http`/`https`/`mailto` only) is cleaner.
- **L‑4 — Unsolicited `maxextra addpermanent`.** Independent of the C‑2 injection, `handleRegisterPermanentRequest` lets *any* peer make this node register an arbitrary permanent route at its MLS — a resource/abuse vector. Gate behind an allow‑list or explicit user opt‑in.
- **L‑5 — `_signalCampaignUpdated` transient budget ping‑pong** is already documented and self‑correcting (KNOWN_ISSUES #39) — no action, noted for completeness.

### Positive confirmations (areas audited and found correct)

- **KissVM escrow (V1/V3/V4):** `ASSERT SIGNEDBY(creatorkey)` gates every spend; change is preserved via `VERIFYOUT(INC(@INPUT) @ADDRESS change @TOKENID TRUE)`; fee branches use exactly 5 `VERIFYOUT` params; per KNOWN_ISSUES #38, `LET platformkey=PREVSTATE(5)` reads are correctly placed so intermediate split/change coins (which omit those ports) do not throw. No division, no overflow/underflow path that creates value.
- **Channel script:** `IF @COINAGE GT (40*1728) AND SIGNEDBY(PREVSTATE(1)) … RETURN MULTISIG(2 PREVSTATE(1) PREVSTATE(2))` — correct time‑locked‑refund / 2‑of‑2 construction.
- **Rhino compatibility:** clean across all SW files (no `let`/`const`/arrow/template‑literal/`console.log`/`TextEncoder`); pure‑JS `utf8ToHex`/`hexToUtf8` used throughout; `hexToUtf8` strips `0x` prefix (KNOWN_ISSUES #8).
- **H2:** all upserts use `MERGE INTO … KEY(…)`; migrations use `ADD COLUMN IF NOT EXISTS`; BOOLEAN handling matches the documented 4‑variant rule.
- **SQL injection:** every reviewed remote/user string sink uses `escapeSql`; numeric sinks use `parseFloat`/`parseInt`. The only command‑string sinks are C‑2.
- **`poll:false`:** present on all **SW** sends; the gaps are FE‑only (M‑2).
- **Publisher impersonation:** `handleChannelOpenRequest` validates `msg.data.from` against the claimed frame identity (KNOWN_ISSUES #36) — correctly Maxima‑layer, not payload‑layer.

---

## 5) RECOMMENDED FIXES

> Diffs target the Service‑Worker handlers (Rhino syntax: `var`, `function()`, string concat, no trailing commas).

### Fix C‑1 — Enforce reward accrual on the creator (paying) side

Add a per‑request increment check in `_handleRewardRequestInner`, immediately after the `MAX_AMOUNT` cap. The legitimate increment for one `REWARD_REQUEST` is at most one reward unit (`REWARD_VIEW` for views, `REWARD_CLICK` for clicks). This also rejects replays/decreases.

```diff
--- a/public/service-workers/handlers/channel.handler.js
+++ b/public/service-workers/handlers/channel.handler.js
@@ function _handleRewardRequestInner(payload, campaignId, viewerKey, eventId, cumulative)
     if (cumulative > parseFloat(channel.MAX_AMOUNT)) {
       MDS.log("[CHANNEL] REWARD_REQUEST: cumulative exceeds MAX_AMOUNT. cumulative: " + cumulative + " max: " + channel.MAX_AMOUNT);
       return;
     }
+
+    // SECURITY (C-1): the creator is the paying party and MUST validate the
+    // accrual itself — viewer-side validation.js is not trustworthy. A single
+    // REWARD_REQUEST may advance CUMULATIVE_EARNED by at most one reward unit.
+    getCampaign(campaignId, function(cErr, camp) {
+      if (cErr || !camp) { MDS.log("[CHANNEL] REWARD_REQUEST: campaign gone"); return; }
+      var prevCumulative = parseFloat(channel.CUMULATIVE_EARNED) || 0;
+      var delta          = parseFloat((cumulative - prevCumulative).toFixed(6));
+      var rewardType     = payload.reward_type || 'view';
+      var unit           = (rewardType === 'click')
+        ? (parseFloat(camp.REWARD_CLICK) || 0)
+        : (parseFloat(camp.REWARD_VIEW)  || 0);
+      // Allow a tiny epsilon for float rounding only.
+      if (delta <= 0 || delta > unit + 0.000001) {
+        MDS.log("[CHANNEL] REWARD_REQUEST rejected: illegal increment delta=" + delta + " unit=" + unit + " campaign=" + campaignId);
+        return;
+      }
+      // Optional but recommended: enforce the campaign cooldown server-side.
+      var cooldown = (camp.COOLDOWN_MS != null) ? parseInt(camp.COOLDOWN_MS, 10) : LIMITS.COOLDOWN_BETWEEN_REWARDS_MS;
+      var lastAt   = parseInt(channel.LAST_VOUCHER_AT || 0, 10);
+      if (lastAt && (Date.now() - lastAt) < cooldown) {
+        MDS.log("[CHANNEL] REWARD_REQUEST rejected: cooldown active. campaign=" + campaignId);
+        return;
+      }
+      _continueAfterAccrualCheck();
+    });
+    return;
+
+    function _continueAfterAccrualCheck() {
     isDuplicate(eventId, function(isDup) {
       /* ...existing body unchanged... */
     });
+    }
```

Supporting changes:
- Add `LAST_VOUCHER_AT BIGINT DEFAULT 0` to `CHANNEL_STATE` in **both** `public/service-workers/db-init.js` and the FE DB init (`ADD COLUMN IF NOT EXISTS`), and set it in `updateChannelVoucher`.
- In `handleChannelOpenRequest` (viewer path, L214) cap the reservation to a policy maximum instead of the whole budget, e.g. `if (maxAmount > LIMITS.MAX_CHANNEL_RESERVATION) maxAmount = LIMITS.MAX_CHANNEL_RESERVATION;` so a single channel cannot pre‑reserve the entire campaign.

### Fix C‑2 — Validate remote strings before `MDS.cmd`

Add a hex/route validator in `core/minima.js` and use it at both sinks.

```diff
--- a/core/minima.js
+++ b/core/minima.js
@@
 function escapeSql(str) {
-  return str.replace(/'/g, "''");
+  return String(str == null ? '' : str).replace(/'/g, "''");   // also fixes L-2
 }
+
+// Returns true if s is a bare 0x hex string (no spaces/metacharacters).
+function isHexKey(s) {
+  return typeof s === "string" && /^0x[0-9A-Fa-f]{2,140}$/.test(s);
+}
+
+// Returns true if s is a plausible Maxima contact / MAX# route with no
+// command-injection metacharacters (whitespace).
+function isMaximaRoute(s) {
+  return typeof s === "string" && s.length > 0 && s.length < 600 && !/\s/.test(s);
+}
```

```diff
--- a/public/service-workers/handlers/maxima.handler.js
+++ b/public/service-workers/handlers/maxima.handler.js
@@ function handleRegisterPermanentRequest(payload, fromRoute)
   var pubkey = payload.publickey;
+  if (!isHexKey(pubkey)) {
+    MDS.log("[MAXIMA] REGISTER_PERMANENT_REQUEST rejected: malformed publickey");
+    return;
+  }
```

```diff
--- a/public/service-workers/handlers/channel.handler.js
+++ b/public/service-workers/handlers/channel.handler.js
@@ function handleChannelOpenRequest(payload, senderPk)
-      MDS.cmd("maxima action:addcontact contact:" + viewerMx, function(addRes) {
+      if (!isMaximaRoute(viewerMx)) {
+        MDS.log("[CHANNEL] CHANNEL_OPEN_REQUEST rejected: malformed viewer_mx");
+        return;
+      }
+      MDS.cmd("maxima action:addcontact contact:" + viewerMx, function(addRes) {
```

(Apply `isMaximaRoute` / `isHexKey` guards anywhere else a raw payload string reaches `MDS.cmd`.)

### Fix M‑1 — Authenticate campaign status messages

```diff
--- a/public/service-workers/handlers/maxima.handler.js
+++ b/public/service-workers/handlers/maxima.handler.js
-  } else if (payload.type === "CAMPAIGN_PAUSE") {
-    handleCampaignPause(payload);
-  } else if (payload.type === "CAMPAIGN_FINISH") {
-    handleCampaignFinish(payload);
-  } else if (payload.type === "CAMPAIGN_RESUME") {
-    handleCampaignResume(payload);
+  } else if (payload.type === "CAMPAIGN_PAUSE") {
+    handleCampaignPause(payload, msg.data.from || '');
+  } else if (payload.type === "CAMPAIGN_FINISH") {
+    handleCampaignFinish(payload, msg.data.from || '');
+  } else if (payload.type === "CAMPAIGN_RESUME") {
+    handleCampaignResume(payload, msg.data.from || '');
```

```diff
--- a/public/service-workers/handlers/campaign.handler.js
+++ b/public/service-workers/handlers/campaign.handler.js
-function handleCampaignFinish(payload) {
-  if (!payload.campaign_id) { ... return; }
-  applyStatusChange(payload.campaign_id, "finished");
-}
+function handleCampaignFinish(payload, senderPk) {
+  if (!payload.campaign_id) { MDS.log("[CAMPAIGN] FINISH missing campaign_id"); return; }
+  _assertCreatorThen(payload.campaign_id, senderPk, function() {
+    applyStatusChange(payload.campaign_id, "finished");
+  });
+}
+
+// Verifies the Maxima sender PK matches the campaign creator's known route PK
+// before applying any status change. CREATOR_MX is refreshed from on-chain
+// STATE(4) in processEscrowCoin, so it is authoritative.
+function _assertCreatorThen(campaignId, senderPk, ok) {
+  if (!senderPk) { MDS.log("[CAMPAIGN] status change rejected: no sender PK"); return; }
+  getCampaign(campaignId, function(err, c) {
+    if (err || !c) { return; }
+    var route = (c.CREATOR_MX || '');               // "MAX#<pk>#<mls>" or Mx...
+    var creatorPk = '';
+    if (route.indexOf('MAX#') === 0) { creatorPk = route.split('#')[1] || ''; }
+    if (creatorPk && creatorPk.toUpperCase() === senderPk.toUpperCase()) { ok(); return; }
+    MDS.log("[CAMPAIGN] status change rejected: sender is not the creator. campaign=" + campaignId);
+  });
+}
```

(Apply the same wrapper to `handleCampaignPause` / `handleCampaignResume`.) Where `CREATOR_MX` is not a `MAX#` route, fall back to comparing against the on‑chain `STATE(4)` PK read from the escrow coin. This preserves the legitimate creator broadcast path while closing the spoof.

### Fix M‑2 — `poll:false` on FE sends

```diff
--- a/sdk/index.js
+++ b/sdk/index.js
-            + ' data:' + hex
-            + ' poll:true';
+            + ' data:' + hex
+            + ' poll:false';
```
```diff
--- a/dapp/app.js
+++ b/dapp/app.js
-          + ' data:' + hex
-          + ' poll:true';
+          + ' data:' + hex
+          + ' poll:false';
```

### Fix M‑3 — Sanitise advertiser style fields in `renderAd`

```diff
--- a/renderer/renderAd.js
+++ b/renderer/renderAd.js
   function safeUrl(val) {
     var s = safeText(val);
-    if (/^javascript:/i.test(s.trim())) { return '#'; }
-    return s;
+    var t = s.trim();
+    if (!/^(https?:|mailto:)/i.test(t)) { return '#'; }   // scheme whitelist (L-3)
+    return t;
   }
+
+  function safeColor(val, fallback) {
+    var s = val ? String(val).trim() : '';
+    return /^#[0-9A-Fa-f]{3,8}$/.test(s) ? s : fallback;
+  }
+  function safePos(val) {
+    var s = val ? String(val).trim().toLowerCase() : 'center';
+    var ok = { 'center':1,'top':1,'bottom':1,'left':1,'right':1,
+               'top left':1,'top right':1,'bottom left':1,'bottom right':1 };
+    return ok[s] ? s : 'center';
+  }
@@
-  var bgColor    = ad.bg_color        || '#ffffff';
-  var textColor  = ad.text_color      || '#111111';
-  var imgPos     = ad.image_position  || 'center';
-  var imgZoom    = parseFloat(ad.image_zoom) || 1.0;
-  var imgWidthPct = parseInt(ad.image_width_pct, 10) || 40;
+  var bgColor    = safeColor(ad.bg_color, '#ffffff');
+  var textColor  = safeColor(ad.text_color, '#111111');
+  var imgPos     = safePos(ad.image_position);
+  var imgZoom    = Math.max(1, Math.min(3, parseFloat(ad.image_zoom) || 1.0));
+  var imgWidthPct = Math.max(10, Math.min(80, parseInt(ad.image_width_pct, 10) || 40));
```

---

## 6) Prioritised Remediation Order

1. **C‑1** (fund loss) — server‑side accrual validation + reservation cap. *Highest priority; breaks the economic model until fixed.*
2. **C‑2** (remote command injection) — input validators; small, isolated, high value.
3. **M‑1** (status‑spoof DoS) — sender authentication on pause/finish/resume.
4. **M‑3 / M‑2 / M‑4** — privacy hardening, UI‑freeze removal, budget‑accounting consolidation.
5. **L‑1..L‑4** — code‑quality and defence‑in‑depth.

**Verification after fixes:** open `#viewer`, watch an ad, confirm a normal voucher still settles; then, with a tampered client, attempt (a) `cumulative = MAX_AMOUNT` in one request → must be rejected by C‑1, (b) a `CAMPAIGN_FINISH` from a non‑creator node → victim campaign must stay `active` (M‑1), (c) a `CHANNEL_OPEN_REQUEST` with `viewer_mx` containing a space → must be dropped (C‑2). No console errors in the FE; SW logs show the new rejection messages.

---

## 7) Remediation Plan (live task tracker)

> Worked top‑to‑bottom. Each task is independently reviewable. Mark `[x]` as completed and add the commit/date next to it. Quick wins first (low risk, immediate security gain), then authentication, then the economic fix.
>
> **Confirmed design note (C‑1):** the accrual model is **one reward unit per `REWARD_REQUEST`** — exactly `REWARD_VIEW`, or exactly `REWARD_CLICK` for a click. No batching. The creator‑side check rejects any `delta <= 0` (replay/decrease) or `delta > unit` (over‑claim). This policy is now fixed and needs no further spec reconciliation.

> **Model column:** each task is tagged with the model the executing agent should invoke (`Haiku` / `Sonnet` / `Opus`) per CLAUDE.md §2. Quick, single‑file, no‑logic tasks → Haiku/Sonnet. Multi‑layer but bounded → Sonnet. The C‑1 voucher core (hot path, cross‑layer reasoning, fund‑safety) → Opus.

### Phase 1 — Quick wins (aïllats, risc ~zero)

- [x] **T1 · `[Sonnet]` · C‑2a — Validate `publickey` before `MDS.cmd`.** Add `isHexKey()` to `core/minima.js`; guard `handleRegisterPermanentRequest` (`maxima.handler.js`). *(also fixes L‑2: `escapeSql` non‑string guard)*
- [x] **T2 · `[Sonnet]` · C‑2b — Validate `viewer_mx` before `addcontact`.** Add `isMaximaRoute()` to `core/minima.js`; guard `handleChannelOpenRequest` (`channel.handler.js:219`). Sweep for any other raw‑payload‑string → `MDS.cmd` sinks.
- [x] **T3 · `[Haiku]` · M‑2 — `poll:true` → `poll:false`** in `sdk/index.js` `_sendToCreator` and `dapp/app.js` `sendChannelMaxima`.
- [x] **T4 · `[Sonnet]` · M‑3 — Sanitise advertiser style fields** in `renderer/renderAd.js` (`safeColor`, `safePos`, zoom/width clamps, CTA scheme whitelist → also closes L‑3).

### Phase 2 — Sender authentication

- [x] **T5 · `[Sonnet]` · M‑1 — Authenticate campaign status messages.** Thread `senderPk` from the dispatcher into `handleCampaignPause/Finish/Resume`; add `_assertCreatorThen()` comparing sender PK against the campaign's creator route PK (`CREATOR_MX` / on‑chain `STATE(4)`). **Test the legitimate creator‑broadcast path still works** on a two‑node setup before merging.

### Phase 3 — Economic fix (C‑1)

- [x] **T6 · `[Sonnet]` · Schema — `LAST_VOUCHER_AT`.** `ALTER TABLE CHANNEL_STATE ADD COLUMN IF NOT EXISTS LAST_VOUCHER_AT BIGINT DEFAULT 0` in **both** `public/service-workers/db-init.js` **and** the FE DB init. Set it inside `updateChannelVoucher` (`core/channels.js`).
- [ ] **T7 · `[Opus]` · C‑1 core — Server‑side accrual check.** In `_handleRewardRequestInner` (`channel.handler.js`), after the `MAX_AMOUNT` cap: load campaign, compute `delta = cumulative − channel.CUMULATIVE_EARNED`, reject `delta <= 0` or `delta > unit (+ε)` where `unit = REWARD_CLICK` for clicks else `REWARD_VIEW`; enforce campaign cooldown via `LAST_VOUCHER_AT`.
- [x] **T8 · `[Sonnet]` · C‑1 reservation cap.** In `handleChannelOpenRequest` (viewer path), clamp `max_amount` to a policy ceiling so one channel cannot pre‑reserve the whole budget. Add the limit to the `LIMITS` constant in `service.js`.
- [ ] **T9 · `[Opus]` · C‑1 — apply the same accrual guard to the publisher voucher path** (`_doGeneratePublisherVoucher` / `_maybeGeneratePublisherVoucher`) so publisher channels can't be over‑claimed either.
- [ ] **T10 · `[Opus]` · Two‑node verification** of the three attack scenarios in §6 + confirm a normal view/click voucher still settles end‑to‑end.

### Phase 4 — Hardening & cleanup

- [x] **T11 · `[Sonnet]` · M‑4 — Consolidate budget accounting** to a single authoritative path (on‑chain `processEscrowCoin` sync); remove redundant `updateBudget` debits that can prematurely flip a campaign to `finished`.
- [x] **T12 · `[Sonnet]` · L‑1 — Route `dapp/views/frames.js:247` through `core/frames.js`/`sqlQuery`** instead of direct `MDS.sql`.
- [x] **T13 · `[Sonnet]` · L‑4 — Gate `maxextra addpermanent`** behind an allow‑list or explicit user opt‑in.

### Model assignment summary

| Model | Tasks |
|---|---|
| **Haiku** | T3 |
| **Sonnet** | T1, T2, T4, T5, T6, T8, T11, T12, T13 |
| **Opus** | T7, T9, T10 |

### Cross‑cutting reminders (per CLAUDE.md / KNOWN_ISSUES)

- Every schema change applied in **both** SW and FE runtimes (`ADD COLUMN IF NOT EXISTS`).
- SW edits stay Rhino‑safe: `var`, `function()`, string concat, `MDS.log`, no trailing commas.
- Public‑key / route comparisons `.toUpperCase()` on both sides.
- Update `MinimaAds.md` §8 if any message schema gains a field; add a handoff entry to `AGENTS.md §6`.

