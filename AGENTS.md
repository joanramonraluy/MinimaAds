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
               getUserProfile(userAddress, cb), updateUserProfile(userAddress, fields, cb)
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

2026-05-25 (fix CLK-1 — click no registrat al publisher frame):
- **Bug**: El publisher frame (generat per `dapp/views/frames.js`) rastrejava visualitzacions via `MA_TRACK_VIEW` comms però NO rastrejava clicks. Quan l'usuari feia click al CTA (imatge o botó de text), l'URL s'obria però cap `MA_TRACK_CLICK` s'enviava. A més, el SW (`service.js` + `comms.handler.js`) no tenia cap handler per a `MA_TRACK_CLICK`, de manera que fins i tot si el frame hagués enviat el missatge, hauria estat descartat silenciosament. **El cooldown NO era el problema**: `validateClick` filtra per `TYPE = 'click'` de forma independent de `validateView` — una visualització recent no bloqueja el primer click.
- **Fix — `public/service-workers/handlers/comms.handler.js`**: Afegit `handleTrackClick(payload)` (Rhino-safe: var, function(), cap arrow, cap template literal, cap trailing comma). Crida `validateClick` → `getCampaign` → `createRewardEvent(type:'click')` → `_triggerChannelPayment` (reusa la mateixa funció que `handleTrackView`). Actualitzat el comentari de capçalera per incloure `MA_TRACK_CLICK` al protocol.
- **Fix — `service.js`**: Afegit cas `MA_TRACK_CLICK → handleTrackClick(payload)` a `onComms()`.
- **Fix — `dapp/views/frames.js`**: Afegida funció `_trackClick(campaignId)` (paral·lela a `_trackView`). Afegits event listeners `click` als tres punts clickables del frame render: imatge mobile (`mobLink`), imatge desktop (`imgLink`), i botó CTA de text (`a`). Cada listener: `e.preventDefault()` → `_trackClick(ad.campaign_id)` → `window.open(url, '_blank')`. S'usa `ctaUrl`/`mobCtaUrl`/`imgCtaUrl` per pre-avaluar la URL segura (evita `javascript:`).
- No canvis d'esquema DB. No nous missatges Maxima. No canvis de SDK. No canvis de UI (viewer.js, earnings.js, etc.).

2026-05-25 (Sessió 13 — Responsivitat: poliment):
- **Scope**: UI only — `dapp/views/viewer.js`. Cap canvi a `creator.js`, DB, SW, SDK, core o protocols.
- **1B-1 "Today earned"**: Eliminat el `<footer>` que contenia el badge "Today earned" del top de `renderViewer`. Afegit en el seu lloc un `<p id="ma-earned-badge">` amb `style.cssText = 'font-size:0.82rem;opacity:0.75;margin:0.25rem 0 0.5rem;text-align:right;'` inserit immediatament *després* de `#ma-ad-slot`. L'element `<span id="ma-earned">` conserva el mateix ID — `loadTodayEarned()` i `onRewardConfirmed()` no requereixen cap canvi.
- **1B-2 Touch events**: `_attachImagePositioner` i `_attachDivider` a `creator.js` **ja tenien** handlers `touchstart`/`touchmove`/`touchend` complets des de sessions anteriors. Cap canvi necessari.
- No nous senyals SW. No noves Maxima messages. No canvis d'esquema.

2026-05-25 (Sessió 12 — Responsivitat crítica):
- **Scope**: UI only — `public/index.html` (CSS) + `dapp/views/creator.js`. Cap canvi a DB, SW, SDK, core o protocols.
- **`public/index.html`** — tres blocs CSS afegits al `<style>`:
  - **1A-1 Nav**: `@media (max-width:479px)` — `header nav { flex-wrap:wrap }` + `order` per organitzar dues files: fila 1 = logo + perfil, fila 2 = mode-switcher, fila 3 = nav-links. `#ma-mode-switcher` i `#ma-nav-links` passen a `flex: 0 0 100%` (amplada completa).
  - **1A-2 Taules**: `#app table { display:block; overflow-x:auto; -webkit-overflow-scrolling:touch }` — totes les taules de l'app fan scroll horitzontal sense modificar els fitxers de vista individuals.
  - **1A-3 Creator mòbil**: `#ma-creator-preview-open-btn { display:none }` (ocult per defecte, visible sota 480px) + `@media (max-width:479px)` que oculta `#ma-creator-preview`, `#ma-preview-btn-mobile`, `#ma-preview-btn-desktop`, i mostra `#ma-creator-preview-open-btn`.
- **`dapp/views/creator.js`** — canvis en 4 punts:
  1. **HTML del formulari**: Afegit `flex-wrap:wrap` al header de la secció preview. Afegit botó `#ma-creator-preview-open-btn` ("View preview") inline. Afegit `<div id="ma-creator-mobile-controls">` (ocult per defecte) amb tres range inputs: `#ma-img-pos-x` (0–100), `#ma-img-pos-y` (0–100), `#ma-img-width-pct` (20–70).
  2. **Setup de `renderCreator`**: Crea `<dialog id="ma-creator-preview-dialog">` (Pico CSS article pattern, tanca per clic sobre backdrop) i l'afegeix a `root`. Handler del botó "View preview": copia `innerHTML` de `#ma-creator-preview` (ja renderitzat però ocult) al `#ma-creator-preview-modal-body` i obre el dialog. Listeners dels tres range inputs criden `_onMobilePosInput` → actualitzen els inputs ocults `image_position` i `image_width_pct` → criden `updateCreatorPreview`.
  3. **`_syncMobileControls(form)`** (nova funció): llegeix `image_position` (format `"XX% YY%"`) i `image_width_pct` dels inputs ocults i n'actualitza els range inputs. Usada per mantenir els controls sincronitzats quan es carrega un nou preview.
  4. **`updateCreatorPreview`** (final de la funció): afegit branching `window.innerWidth < 480`. Branca mòbil: detach `_detachPositioner` si existeix, mostra/oculta `#ma-creator-mobile-controls` si `_pendingImageData`, crida `_syncMobileControls`. Branca desktop: comportament existent (`_attachImagePositioner` + `_attachDivider`).
- No nous senyals SW. No noves Maxima messages. No canvis d'esquema.
- **Nota implementació 1A-2**: S'ha usat CSS (`display:block; overflow-x:auto` sobre `table`) en lloc de wrappers `<div>` individuals a cada vista, ja que aconsegueix el mateix resultat sense modificar fitxers fora d'escope.

2026-05-25 (Sessió 11 — Estats buits):
- **Scope**: UI only — quatre vistes. Cap canvi a DB, SW, SDK, core o protocols.
- **`dapp/views/viewer.js`**: missatge de no-ad actualitzat de `'No ad available right now.'` a `'No hi ha anuncis disponibles ara. Torna-ho a intentar més tard.'`
- **`dapp/views/earnings.js`** (`loadEarnings`): afegit bloc condicional `if (totalEarned === 0)` que renderitza un `<p>` amb text i un link `<a href="#viewer">Vés a View Ads per començar.</a>` al target `#ma-earnings-summary`.
- **`dapp/views/stats.js`** (`renderCampaignsTable`): missatge d'empty state actualitzat de `'No campaigns yet.'` a `'No hi ha campanyes actives al sistema.'`; afegit `style.cssText` per usar `--pico-muted-color`.
- **`dapp/views/frames.js`** (`_renderFramesList`): missatge d'empty state ampliat per explicar el concepte de Frame i orientar l'usuari cap al formulari de creació. Dos paràgrafs: el primer explica el concepte, el segon (en muted color) informa sobre el Frame integrat i el formulari.
- **`dapp/views/mycampaigns.js`**: sense canvis — ja tenia el missatge correcte des de la Sessió 7.
- **`docs/UI_ROADMAP.md`**: Sessió 11 marcada ✅ Fet.
- No nous senyals SW. No noves Maxima messages. No canvis d'esquema.

2026-05-24 (Sessió 10 — Indicador de creator online):
- **New Maxima messages**: `CREATOR_LIVENESS_PING` (§8.13) and `CREATOR_LIVENESS_PONG` (§8.14).
- **SW — `campaign.handler.js`**: Added `handleCreatorLivenessPing(payload, senderPk)` — responds immediately with a PONG via `sendMaxima(senderPk, null, pong, cb)`. Added `handleCreatorLivenessPong(payload)` — calls `signalFE("CREATOR_LIVENESS_PONG", {campaign_id})`.
- **SW — `maxima.handler.js`**: Added routing for `CREATOR_LIVENESS_PING` (passes `msg.data.from` as senderPk) and `CREATOR_LIVENESS_PONG`.
- **SDK — `sdk/index.js`**: Added module-level `_livenessCache`, `_pendingPings`, `LIVENESS_CACHE_MS=120000`, `LIVENESS_TIMEOUT_MS=3000`. Added `_sendLivenessPing(creatorRoute, campaignId, cb)` — unicast Maxima with `poll:false`. Added `_checkCreatorLiveness(campaign, cb)` — checks cache, deduplicates concurrent calls, sets 3s timeout. Added `_onCreatorLivenessPong(campaignId)` — resolves pending callbacks, updates cache. Modified `getAd` — filters out campaigns with cached `alive:false` before `selectAd`. Modified `_trackEvent` — before `createRewardEvent`, checks if a channel exists; if not, calls `_checkCreatorLiveness`; if creator offline, returns `{ confirmed:false, reason:'creator offline' }`. Added `CREATOR_LIVENESS_PONG` branch in `handleMdsEvent` (host-MiniDapp path). Exposed `_onCreatorLivenessPong` as `window.MinimaAds.onCreatorLivenessPong` and as `window.onCreatorLivenessPong` global.
- **FE — `dapp/app.js`**: Added `CREATOR_LIVENESS_PONG` case in `handleMdsComms` → calls `window.onCreatorLivenessPong(parsed.campaign_id)`.
- **`MinimaAds.md §8`**: Added §8.13 `CREATOR_LIVENESS_PING` schema, §8.14 `CREATOR_LIVENESS_PONG` schema, `CREATOR_LIVENESS_PONG` signal row in §8.15 table. Old §8.13 (SW→FE Signal Contract) is now §8.15.
- No DB schema changes. No new on-chain transactions. No SDK public API changes.
- **Liveness flow summary**: Viewer SDK sends PING (poll:false) → Creator SW responds with PONG → Viewer SW relays via MDSCOMMS → FE calls `window.onCreatorLivenessPong` → SDK resolves pending cb and caches result for 2 min. If no PONG within 3s → campaign marked offline → `getAd` filters it out on next call.

2026-05-24 (fix VAL-1 — cooldown global bloqueja campanyes noves):
- **Bug**: `validateView`/`validateClick` a `core/validation.js` comparaven `USER_PROFILE.LAST_REWARD_AT` (timestamp global per usuari) amb `campaign.COOLDOWN_MS` de la campanya objectiu. Guanyar d'una campanya A resetejava el clock global, bloquejant qualsevol campanya B amb cooldown més llarg durant tot el seu `COOLDOWN_MS` — fins i tot si el viewer no hi havia interaccionat mai. Observat als logs (2026-05-24): viewer guanya de campanya vella a 17:42:44; tots els intents de veure la nova campanya (COOLDOWN_MS=300 000 ms) rebutjats fins les 17:47:44.
- **Fix**: eliminada la segona query a `USER_PROFILE`. La query existent de comptatge diari s'amplia amb `MAX(TIMESTAMP) AS LAST_AT` filtrant per `CAMPAIGN_ID + TYPE`. El cooldown ara és per-campanya: `now - LAST_AT < COOLDOWN_MS`. Si `LAST_AT` és null (cap view en les últimes 24 h per aquesta campanya), cooldown expirat per definició.
- Fitxers modificats: `core/validation.js` (únic). Documentat a `docs/KNOWN_ISSUES.md` Closed/Fixed VAL-1.
- No canvis d'esquema, no canvis de protocol, no canvis de SW ni SDK.

2026-05-24 (Sessió 9 — Chart.js a detall de campanya):
- `dapp/views/mycampaigns.js`: added three module-level vars (`_autoRefreshTimer`, `_expandedCampaignId`, `_expandedChart`). `renderMyCampaigns` now clears any existing timer and chart state before rendering, then calls `_startAutoRefresh()`. `_startAutoRefresh()` sets a 30s `setInterval`; on each tick it checks if `#ma-mycampaigns-section` still exists in DOM — if not, it self-clears (handles navigation-away without any hook into app.js). `loadMyCampaigns()` saves `savedExpandedId`, destroys the existing Chart instance, resets `_expandedCampaignId` to null, rebuilds the table, and re-opens the detail panel for `savedExpandedId` if that campaign row is still present (survives refresh while detail is open). `_buildMyCampaignRow` sets `data-campaign-id` attribute on the `<tr>` and adds a clickable title cell with a `▶`/`▼` indicator; click calls `_toggleDetailPanel(tr, c.ID)`. `_toggleDetailPanel`: if same campaign → collapse; otherwise collapse the previous panel first, then expand the new one. `_collapseDetailPanel(tr, campaignId)`: resets indicator, removes the detail `<tr>` by ID (`ma-detail-<id>`), destroys the Chart instance. `_expandDetailPanel(tbody, tr, campaignId)`: creates a detail `<tr>` with `colspan=9`, inserts after the campaign row, shows loading text, calls `_loadChartData`. `_loadChartData(campaignId, detailEl)`: queries `REWARD_EVENTS (TYPE, TIMESTAMP)` for the campaign; groups by calendar day in JavaScript (`TIMESTAMP` is BIGINT Unix ms — no H2 date function used); empty-state message if no rows; otherwise renders a `<canvas>` and a `new Chart(canvas, ...)` (line chart, two datasets: Views green + Clicks amber, responsive, y-axis integers). Guard: if `_expandedCampaignId !== campaignId` on callback return, no-op (concurrent expansion). `_appendMyCampaignActions` unchanged.
- No DB schema changes. No SW changes. No SDK changes. No Maxima protocol changes. No new signals.
- `docs/UI_ROADMAP.md`: Sessió 9 marked ✅ Fet.

2026-05-24 (fix: creator-side REWARD_EVENT on viewer voucher):
- **Root cause**: Creator's chart (Session 9) showed no events because `swBuildAndExportVoucherTx` in `channel.handler.js` never wrote a `REWARD_EVENT` to the creator's DB when sending viewer vouchers. Viewer's own SW already wrote one via `MA_TRACK_VIEW` (comms.handler.js), but the creator had no record.
- **Fix pattern**: Mirrors PUB-5 (publisher gets a REWARD_EVENT in `handleRewardVoucher`). After the `sendMaxima` call succeeds, if `role === 'viewer'` and `ctx.rewardAmount > 0`: look up the AD ID from the campaign, then call `createRewardEvent({type:'view', ...})` on the creator's SW. Fully fire-and-forget (does not block `afterSend`).
- `_swDispatchVoucher` (Edit 1): computes `rewardAmount = (role === 'viewer') ? parseFloat(campaign.REWARD_VIEW) : 0` and adds it to the ctx object passed to `swBuildAndExportVoucherTx`.
- `swBuildAndExportVoucherTx` (Edit 2): inside the `sendMaxima` callback, after the log line, checks `role === 'viewer' && ctx.rewardAmount > 0` → `sqlQuery` for AD ID → `createRewardEvent`. Uses `escapeSql`, `var`, `function()`, no arrow functions, no template literals — Rhino-safe.
- Files modified: `public/service-workers/handlers/channel.handler.js` only.
- No DB schema changes. No new Maxima message types. No new signals. No SDK changes. No UI changes.

2026-05-23 (Sessió 8 — Earnings: historial desplegable + ajustos nav):
- `dapp/views/earnings.js`: removed `#ma-earnings-history` section from `renderEarnings()`. Removed `getUserRewards` call and the flat `renderRewardHistory` function from `loadEarnings()`. Removed the `histTarget` / `renderRewardHistory` block from `onSettleConfirmed()`. Added `_loadChannelEvents(campaignId, targetEl)` — queries `REWARD_EVENTS` by `campaign_id` + `MY_ADDRESS`, renders a compact table (Type / Amount / Date) into the given element; shows "No events" text when empty. Modified `_renderChannelRewardRows()`: each pending channel card now wraps info+settle in a `mainRow` div, with a `<details>`/`<summary>Detall</summary>` block below; events are lazy-loaded on first open via `toggle` event, guarded by a `loaded` flag. Modified `renderSettlementHistory()`: added 5th column (empty header); each data row has a `▶`/`▼` button that toggles a hidden `<tr>` below (colspan=5); events lazy-loaded on first expand, same `loaded` guard. All desplegables default-closed.
- `dapp/app.js`: changed `currentRoute()` default return from `'stats'` to `'viewer'`. `aria-current` was already correct (set in `renderNav()` which is called by `doRender()` on every `hashchange`).
- No DB schema changes. No SW changes. No SDK changes. No Maxima protocol changes. No new signals.

2026-05-23 (Sessió 7 — Vista "My Campaigns"):
- `dapp/views/mycampaigns.js` (nou): vista dedicada al creador a la ruta `#mycampaigns`. `renderMyCampaigns(root)` crea la secció i crida `loadMyCampaigns()`. `loadMyCampaigns()` fa un SELECT `c.*` + dues subqueries correlades (`VIEW_COUNT`, `CLICK_COUNT` de `REWARD_EVENTS`) filtrades per `CREATOR_ADDRESS`. Renderitza una taula de 9 columnes: títol, estat (badge), pressupost total, restant, reward/view, reward/click, views, clicks, accions. Accions migrades de `loadCreatorCampaigns()`: Pausar → `CAMPAIGN_PAUSE` + `setCampaignStatus('paused')`; Reprendre → `CAMPAIGN_RESUME` + `setCampaignStatus('active')`; Finalitzar → `confirm()` + `CAMPAIGN_FINISH` + `setCampaignStatus('finished')`. Campanyes sense events mostren VIEW_COUNT/CLICK_COUNT a zero (subquery retorna 0, no NULL).
- `dapp/app.js`: `currentRoute()` afegeix `'mycampaigns'` com a ruta vàlida. `MODE_VIEWS.creator` passa de `['creator','stats']` a `['creator','mycampaigns','stats']`. `renderNav()` linkDefs afegeix `mycampaigns: { href:'#mycampaigns', label:'My Campaigns' }`. `doRender()` afegeix branca `route === 'mycampaigns' → renderMyCampaigns(root)`. `handleMdsComms` bloc `CAMPAIGN_UPDATED`: substituïda la crida a `loadCreatorCampaigns()` (route==='creator') per `loadMyCampaigns()` (route==='mycampaigns').
- `dapp/views/creator.js`: eliminats `var _myCampaignsSection = null`, la funció completa `loadCreatorCampaigns()` i el bloc de creació de la secció provisional a `renderCreator()`. Cap altra modificació al formulari ni al flux de creació.
- `public/index.html`: afegit `<script src="dapp/views/mycampaigns.js"></script>` just després de `stats.js`, abans del devtools console.
- No DB schema changes. No SW changes. No SDK changes. No Maxima protocol changes. No new signals.

2026-05-23 (Sessió 6 — Neteja Stats i Viewer):
- `dapp/views/stats.js`: removed `rewardsSection` (`#ma-stats-rewards`) from `renderStats()`. Removed `getUserRewards` call and `renderRewardsSummary()` function from `loadStats()`. Stats now shows only the global campaigns table. In `renderCampaignsTable`, title cell is built manually: if `c.CREATOR_ADDRESS.toUpperCase() === MY_ADDRESS.toUpperCase()`, a `<mark>` badge "Teva" is appended to the cell. No changes to DB, core, SW, or SDK.
- `dapp/views/viewer.js`: removed `var _previewMode = false`. Removed toolbar (allBtn `All ads`, ownBtn `My campaigns`). Removed `setPreviewMode(on)` function. Removed `loadOwnCampaignAd(status, slot)` function. `loadNextAd()` no longer has the `_previewMode` branch. `renderAdInSlot` no longer accepts `isPreview` param — always wires interactions and starts the view timer. Header comment updated to remove reference to preview mode.
- No DB schema changes. No SW changes. No SDK changes. No Maxima protocol changes. No new signals.

2026-05-23 (Sessió 5 — Gestió de campanyes):
- `dapp/views/creator.js`: added module-level `_myCampaignsSection` var. Added `loadCreatorCampaigns()` — queries `CAMPAIGNS WHERE UPPER(CREATOR_ADDRESS) = UPPER(MY_ADDRESS)`, renders a table with title/status badge/budget/action buttons. Pause → `CAMPAIGN_PAUSE` broadcast + local `setCampaignStatus('paused')`; Resume → `CAMPAIGN_RESUME` broadcast + local `setCampaignStatus('active')`; Finish → `confirm()` dialog + `CAMPAIGN_FINISH` broadcast + local `setCampaignStatus('finished')`. Stale-ref guard: if `section !== _myCampaignsSection` (user navigated away mid-query), callback is a no-op. Added `_myCampaignsSection = null` at top of `renderCreator` to reset on re-render. Section appended to `root` after `_renderThemeSwatches` (before preview buttons setup, which are inside the form; no interference).
- `dapp/app.js`: in `handleMdsComms` CAMPAIGN_UPDATED block added `loadCreatorCampaigns()` call when `currentRoute() === 'creator'`. This ensures the list auto-refreshes when the SW signals a status change (triggered by the creator's own broadcast looping back via sendall).
- `public/service-workers/handlers/campaign.handler.js`: added `handleCampaignResume(payload)` — calls `applyStatusChange(campaignId, "active")`. Rhino-safe (var, function(), no arrows, no template literals, no trailing commas).
- `public/service-workers/handlers/maxima.handler.js`: added `CAMPAIGN_RESUME` routing branch after `CAMPAIGN_FINISH`.
- `MinimaAds.md §8.5`: added `CAMPAIGN_RESUME` schema and note. `MinimaAds.md §11.3`: added `CAMPAIGN_RESUME` row in handler table.
- No DB schema changes. No new FE signals. No new SW signals.

2026-05-23 (Sessió 4 — Perfil d'usuari):
- `public/index.html`: added `.ma-profile-btn` CSS (circular button). Added `<ul>` with `#ma-profile-btn` (button "P") at nav right. Added `<dialog id="ma-profile-modal">` with Pico CSS `<article>` pattern; backdrop click closes via inline `onclick`. No new scripts added.
- `dapp/app.js`: added `_profileInterestsSaveTimer = 0` module-level var. Added `openProfileModal()` — builds modal body via DOM (address row with copy-to-clipboard via `execCommand`, interests input with 800ms debounce to `updateUserProfile`, total earned box loaded async via `getUserProfile`). Added `closeProfileModal()` — removes `open` attribute and clears debounce timer. No changes to routing, DB schema, core, SW, or SDK.
- `dapp/views/viewer.js`: removed `_interestsSaveTimer` var, the `<details>`/`<summary>` interests block, and the `getUserProfile` callback that loaded interests into `#ma-interests`. Backend (DB + `updateUserProfile`) unchanged — same call site, now in modal.

2026-05-23 (Sessió 3 — Selector de mode):
- `public/index.html`: replaced static nav links `<ul>` with two new elements: `<ul id="ma-mode-switcher">` (3 static buttons with `onclick="setMode(...)"`) and `<ul id="ma-nav-links">` (empty, populated by JS). Added `.ma-mode-btn` CSS and `#ma-mode-switcher` gap rule. Mode buttons use `aria-selected` to toggle primary/secondary background via CSS.
- `dapp/app.js`: added `_activeMode = 'viewer'` and `MODE_VIEWS` map (`viewer: ['viewer','earnings']`, `creator: ['creator','stats']`, `publisher: ['frames','earnings']`). Added `renderNav()` (updates button `aria-selected`, rebuilds nav links with `aria-current`). Added `setMode(mode)` (validates mode, persists to keypair `USER_MODE`, calls `doRender()`). Modified `doRender()`: calls `renderNav()` at entry, then after loading guards checks if `currentRoute()` belongs to active mode — if not, redirects to `views[0]` via `window.location.hash`. Modified `onInited()`: reads keypair `USER_MODE` before rendering; sets `_activeMode` if valid; calls `renderNav()` before `probeDb()` + `doRender()`.
- No SW, DB schema, core, or SDK changes — purely UI/routing layer.

2026-05-23 (Sessió 2 — Viewer interests):
- `core/rewards.js`: added `updateUserProfile(userAddress, fields, cb)`. Uses `MERGE INTO USER_PROFILE (ADDRESS, INTERESTS) KEY (ADDRESS)` — only touches INTERESTS, never resets TOTAL_EARNED or LAST_REWARD_AT. Creates profile row with defaults if none exists. Rhino-safe (var, no arrows, no template literals).
- `dapp/views/viewer.js`: added `_interestsSaveTimer` module-level var. In `renderViewer`, added a `<details>` element ("My interests") with a text input after the toolbar. Input value is loaded from `getUserProfile` on render. Changes debounce 800 ms then call `updateUserProfile`. The `loadNextAd` flow already reads `profile.INTERESTS` and passes it to `MinimaAds.getAd()` — no change needed there.
- DB: `USER_PROFILE.INTERESTS VARCHAR(1024)` already exists in SW `db-init.js` CREATE TABLE — no migration added.
- `MinimaAds.md §7.4` and `AGENTS.md §3`: added `updateUserProfile` signature.

2026-05-23 (Responsive banner layout + UI cleanup):
- `renderer/renderAd.js`: two-mode layout based on `container.offsetWidth` at render time. ≥480px → row layout (image left, text right, max-height:160px). <480px with image → image-only (height:140px, clickable). <480px without image → text column. `baseFs` formula scales text block font size with image column width (`clamp(0.70rem … 0.95rem)`); child elements use `em` units. `isMobile` check uses container width, NOT a device media query — a slot in a ≥480px panel always uses desktop layout.
- `dapp/views/frames.js` (SDK snippet): same two-mode logic mirrored in the self-contained `_render` function. `isMobile` reads `el.offsetWidth`.
- `dapp/views/creator.js`: zoom UI (+/− buttons, `_updateZoom`) removed from `_attachImagePositioner`. Focal-point drag and draggable divider (`_attachDivider`) retained. "Remove image" button added to the image preview area — clears `_pendingImageData`, detaches positioner listeners, resets hidden inputs, re-renders. Hint text adapts to mobile/desktop preview (no "drag the divider" text in mobile mode).
- `image_zoom` field: kept in DB (`ADS.IMAGE_ZOOM FLOAT DEFAULT 1.0`), all handlers, and renderer. Always 1.0 for new ads. `transform:scale(1.0)` is a no-op. Backward-compatible with any existing ads that stored a zoom value.
- `image_width_pct`: still active for the desktop row layout (divider drag sets 20–70%). Ignored in mobile layout.
- `MinimaAds.md` updated: §3.2 Ad model (added all missing fields), §3.5 ADS schema (added 7 missing columns), §15.3 Ad Unit (full rewrite to match actual two-mode layout).

2026-05-22 (IMAGE_POSITION field — ad image focal-point control):
- `ADS` table: new column `IMAGE_POSITION VARCHAR(32) DEFAULT 'center'`. Migration via `ALTER TABLE ADS ADD COLUMN IF NOT EXISTS IMAGE_POSITION VARCHAR(32) DEFAULT 'center'` in `public/service-workers/db-init.js`.
- `core/campaigns.js` (`saveCampaign`): `IMAGE_POSITION` included in MERGE INTO ADS; value escaped with `escapeSql`.
- `public/service-workers/handlers/campaign.handler.js`: `image_position` mapped from `r.IMAGE_POSITION` in ad-row reads.
- `public/service-workers/handlers/comms.handler.js`: `IMAGE_POSITION` included in ADS SELECT; propagated as `c.AD_IMAGE_POSITION` and re-exposed as `image_position` in `MA_AD_RESPONSE`.
- `sdk/index.js`: `IMAGE_POSITION` included in ADS SELECT; mapped to `c.AD_IMAGE_POSITION`; passed through in the renderable object.
- `renderer/renderAd.js`: uses `ad.image_position` as CSS `object-position` on the image element.
- `dapp/views/frames.js`: same CSS `object-position` usage in the SDK snippet renderer.
- `dapp/views/creator.js`: hidden form field `image_position`; drag overlay on preview image sets value interactively; hint text shown below preview.
- `MinimaAds.md §3.2` (Ad model) and `§3.5` (ADS schema) updated.

2026-05-20 (Publisher REWARD_EVENT now created in SW — PUB-5 fix):
- `public/service-workers/handlers/channel.handler.js` `handleRewardVoucher`: the publisher branch no longer signals `VOUCHER_RECEIVED` to the FE. Instead, the SW creates the `publisher_view` REWARD_EVENT directly via `createRewardEvent`, calls `incrementFrameEarnings`, then signals `PUBLISHER_REWARD_CONFIRMED`. All three functions (`getCampaign`, `getFrame`, `createRewardEvent`, `incrementFrameEarnings`) are already loaded in the SW runtime (`core/campaigns.js`, `core/frames.js`, `core/rewards.js`). The ADS lookup (for `ad_id`) is done inline via a direct `sqlQuery`.
- Root cause of the bug: `MDS.comms.solo()` (used by `signalFE`) is fire-and-forget. If the publisher's FE is not open when the voucher arrives, the `VOUCHER_RECEIVED` signal is permanently lost and the FE's `_onVoucherReceivedCore` never runs — so no `publisher_view` REWARD_EVENT is created. Verified in logs/user2.txt: voucher stored at 09:50:21 (cumulative=40) but earnings only showed 4 rewards (missing 09:50); FE was not open at that moment.
- The viewer voucher branch is unchanged: still signals `VOUCHER_RECEIVED` (without role) so the SDK's `_clearPendingByCumulative` runs when the FE is open. This is correct — viewer pending-marker bookkeeping is FE-only state and needs no SW persistence.
- `sdk/index.js` `_onVoucherReceivedCore` publisher branch is now dead code for the MinimaAds FE (no longer triggered), but is harmless and correct for SDK use in host MiniDapps (MetaChain etc.) where the SDK runs in a separate MiniDapp DB context.
- See `docs/KNOWN_ISSUES.md` Closed/Fixed PUB-5.

2026-05-20 (Per-campaign cooldown + SEL-1 fix):
- `core/selection.js`: removed `_sessionCampaignCount` and the `MAX_CAMPAIGNS_PER_SESSION` early-return guard. The counter was incremented on every ad serve (not confirmed view), exhausting the session budget in under a minute when a host dapp polls MA_GET_AD frequently. DB-level guards (`COOLDOWN_MS`, `MAX_DAILY_VIEWS`) are sufficient. `_seenCampaignIds` rotation retained. See KNOWN_ISSUES.md SEL-1.
- `CAMPAIGNS` table: new column `COOLDOWN_MS BIGINT DEFAULT 300000` — minimum milliseconds between two rewards for the same viewer on a given campaign. Migration via `ALTER TABLE CAMPAIGNS ADD COLUMN IF NOT EXISTS COOLDOWN_MS BIGINT DEFAULT 300000` in `public/service-workers/db-init.js`.
- `core/campaigns.js` (`saveCampaign`, `updateBudget`): `COOLDOWN_MS` included in all MERGE INTO statements; falls back to `LIMITS.COOLDOWN_BETWEEN_REWARDS_MS` when null.
- `core/validation.js` (`validateView`, `validateClick`): cooldown check now reads `campaign.COOLDOWN_MS` with fallback to `LIMITS.COOLDOWN_BETWEEN_REWARDS_MS`. `LIMITS.COOLDOWN_BETWEEN_REWARDS_MS` remains as the global default (currently 30 s) but is no longer the only enforced value.
- `public/service-workers/handlers/campaign.handler.js`: `handleCampaignAnnounce` propagates `payload.cooldown_ms` into `payload.campaign.cooldown_ms` (same pattern as `max_daily_views`). `handleRequestCampaignData` response includes `cooldown_ms` from DB row.
- `dapp/views/creator.js`: new form field `cooldown_s` (seconds, default 300) in the Viewer tab. Converted to ms on submit and stored as `campaign.cooldown_ms`. Included in `CAMPAIGN_ANNOUNCE` payload as `cooldown_ms`.
- `MinimaAds.md §3.5` and `§8.3` updated: `COOLDOWN_MS` column added to CAMPAIGNS schema; `cooldown_ms` added to CAMPAIGN_ANNOUNCE wire format with backward-compat note.

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
