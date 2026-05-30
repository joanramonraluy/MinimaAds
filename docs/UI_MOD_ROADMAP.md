# MinimaAds — UI Modernization Roadmap

> **Objectiu**: Modernitzar totes les vistes de la dapp sense canviar cap comportament de negoci.
> Constraintes fixes: sense frameworks JS, sense build step, PicoCSS + Chart.js + DOMPurify ja carregats.
> Les vistes construeixen el DOM de forma imperativa — aquest roadmap no canvia l'arquitectura, millora la presentació.

---

## Regles d'execució

- Ordre obligatori: M1 → M2 → M3 → M4 → M5 → M6.
- M1 és la sessió fonament — totes les altres en depenen.
- **Cap sessió modifica lògica de negoci** — només presentació i UX.
- **No canviar signatures de funcions** de `core/*.js`, `sdk/index.js` ni handlers SW.
- Un commit per sessió, quan el mantenidor ho demani explícitament.

---

## Punt de partida (estat actual)

| Vista | Fitxer | Estat actual |
|---|---|---|
| Viewer | `dapp/views/viewer.js` | `createElement` pla, sense estructura visual |
| Earnings | `dapp/views/earnings.js` | Sections sense jerarquia, loading inconsistent |
| My Campaigns | `dapp/views/mycampaigns.js` | Taula + chart, sense badges ni progress bars |
| Creator | `dapp/views/creator.js` | Formulari llarg sense agrupació visual |
| Stats | `dapp/views/stats.js` | Taula plana, badge "Teva" mínim |
| Frames | `dapp/views/frames.js` | Barreja `innerHTML` i `createElement`, sense mètriques visuals |

Cap vista té helpers compartits. Cada una construeix tot des de zero.

---

## Sessió M1 — Helpers compartits (design system lite)

**Model**: Sonnet

**Scope**: `dapp/views/ui-helpers.js` (nou) · `public/index.html`

Sessió fonament. Crea un fitxer de helpers compartits que elimina la repetició entre vistes i garanteix consistència visual. Cap vista de l'usuari canvia — és purament interna.

**Canvis**:

Crear `dapp/views/ui-helpers.js` amb les funcions següents:

```javascript
// Badge de status: active → verd, paused → groc, finished → gris, publisher → blau
mkStatusBadge(status)
  → <mark> amb color i text localitzat

// Targeta de mètrica: label + valor gran + subtítol opcional
mkStatCard(label, value, sub)
  → <article> PicoCSS amb jerarquia label/valor

// Barra de progrés (0–100)
mkProgressBar(pct, label)
  → <progress> HTML natiu amb label accessible

// Estat buit estàndard
mkEmptyState(message, ctaText, ctaHref)
  → <div> centrat amb missatge + link/botó opcional

// Indicador de càrrega consistent
mkLoading(text)
  → <p aria-busy="true"> amb text

// Separador de secció amb títol
mkSectionTitle(text)
  → <strong class="ma-section-title">
```

Registrar a `index.html` **abans** de tots els fitxers de vista:
```html
<script src="dapp/views/ui-helpers.js"></script>
```

**Decisions de disseny**:
- Funcions pures que retornen un element DOM — cap efecte lateral.
- `mkStatusBadge` usa `<mark>` de PicoCSS amb color inline — no requereix CSS nou.
- Cap helper fa `appendChild` directament — el cridant decideix on inserir.
- No substituir codi existent en aquesta sessió — els helpers s'usaran a M2–M6.

**Done when**:
- [ ] `dapp/views/ui-helpers.js` existeix amb les 6 funcions.
- [ ] `index.html` el carrega abans dels fitxers de vista.
- [ ] Cap vista existent trencada.
- [ ] Cada funció retorna un element DOM vàlid (testejable amb `document.body.appendChild`).

**Fitxers modificats**: `dapp/views/ui-helpers.js` (nou) · `public/index.html`

---

## Sessió M2 — Viewer: redisseny visual

**Model**: Sonnet

**Scope**: `dapp/views/viewer.js`

El Viewer és la vista principal per a la majoria d'usuaris, però és la més austera. El banner de l'anunci queda sense context visual, no hi ha cap indicació del temps de visualització requerit (3s), i el saldo guanyat és gairebé invisible.

**Canvis**:

1. **Contenidor de l'anunci**: embolcallar `#ma-ad-slot` en un `<article>` PicoCSS amb `padding: 0` per donar-li profunditat i separació del reste.

2. **Barra de progrés de visualització**: quan s'inicia el temporitzador de 3s (l'actual `_viewerState.viewTimerId`), mostrar una barra de progrés animada per CSS que omple en 3s. Desapareix quan el view queda registrat. Usar `mkProgressBar` de M1.

3. **"Today earned" badge**: substituir el `<p>` actual per un `mkStatCard` petit (`inline`) posicionat just sota el banner. Valors: label="Today", value=X MINIMA.

4. **Botó "See ad"**: estilitzar com a botó primari gran (PicoCSS `role="button"` o classe `primary`). Afegir estat de càrrega (`aria-busy`) mentre carrega l'anunci.

5. **Missatge de status**: usar `role="status"` ja existent però afegir-hi un estil més visible (color, marge).

**Decisions de disseny**:
- La barra de progrés és CSS pur (`@keyframes` o `transition`), sense JS de polling.
- No canviar la lògica de `loadNextAd`, `trackView` ni `onVoucherReceived`.
- El channel status (canals oberts) ja es mostra a Earnings — no duplicar aquí.

**Done when**:
- [ ] L'anunci es mostra dins un contenidor amb profunditat visual.
- [ ] La barra de progrés de 3s funciona i desapareix en completar-se.
- [ ] "Today earned" és visible i ben posicionat.
- [ ] El botó "See ad" té estat de càrrega mentre carrega.
- [ ] Cap regression en el flux de recompenses.

**Fitxers modificats**: `dapp/views/viewer.js`

---

## Sessió M3 — Earnings: stat cards + settlement cards

**Model**: Sonnet

**Scope**: `dapp/views/earnings.js`

Earnings mostra dades importants (total guanyat, canals pendents, historial) però sense jerarquia visual. L'usuari no té una lectura ràpida de la seva situació.

**Canvis**:

1. **Header de mètriques**: afegir tres `mkStatCard` en fila a la part superior:
   - "Total earned" — llegit de `USER_PROFILE.TOTAL_EARNED`
   - "Today" — llegit de la query existent `_loadTodayEarnedSummary`
   - "Open channels" — comptador de `CHANNEL_STATE WHERE STATUS='open'`

2. **Pending settlements**: cada canal pendent passa a ser un `<article>` PicoCSS amb:
   - Títol: nom de la campanya (o ID truncat si no disponible)
   - Valor acumulat prominent (`mkStatCard` inline)
   - Botó "Settle" com a acció principal de la card
   - `mkStatusBadge('pending')` al header de la card

3. **Settlement history**: les files existents desplegables milloren amb:
   - Data formatada (no timestamp brut)
   - Import formatat amb 6 decimals
   - `mkStatusBadge('settled')` per cada entry

**Decisions de disseny**:
- Les tres stat cards del header usen `display:flex; gap:1rem` — responsive des del mínim.
- No canviar `_runSettlement`, `_postSettleTx` ni cap handler de senyal.
- `loadEarnings()` roman com a punt d'entrada — afegir queries addicionals dins la mateixa funció.

**Done when**:
- [ ] Header mostra 3 stat cards (total, avui, canals oberts).
- [ ] Cada settlement pendent és una card amb tota la info i el botó settle.
- [ ] L'historial de settlements mostra dates llegibles i badges.
- [ ] El flux de settlement funciona igual que abans.

**Fitxers modificats**: `dapp/views/earnings.js`

---

## Sessió M4 — My Campaigns: campaign cards

**Model**: Sonnet

**Scope**: `dapp/views/mycampaigns.js`

My Campaigns mostra les campanyes en una taula plana. Amb el Chart.js de detall (Sessió 9 original), la taula ja tenia certa interactivitat, però la presentació de les mètriques principals és poc llegible.

**Canvis**:

1. **Cards en lloc de taula**: cada campanya passa a ser una `<article>` PicoCSS amb:
   - Header: títol + `mkStatusBadge(status)` alineats esquerra/dreta
   - Fila de mètriques: views, clicks, budget restant (`mkStatCard` inline, 3 en fila)
   - Barra de budget: `mkProgressBar(budgetSpentPct)` mostrant % gastat
   - Footer: botons d'acció (Pause / Resume / Finish) contextuals a l'estat

2. **Detall amb chart**: el clic a la card continua expandint el chart de Chart.js (comportament actual), però ara expandeix un `<details>` dins la card (no substitució de contingut).

3. **Auto-refresh**: el `setInterval` de 30s existent es manté — només refresca les dades, no re-renderitza tot el DOM (actualitzar valors dins les cards existents si les cards ja estan al DOM).

**Decisions de disseny**:
- El layout de cards és una columna (una card per fila) — no grid de 2 columnes (les mètriques necessiten espai).
- `mkProgressBar` mostra % de budget gastat (`(budget_total - budget_remaining) / budget_total`).
- Les accions de Pause/Resume/Finish mantenen el `confirm()` de seguretat actual.
- El chart continua usant la mateixa lògica d'agrupació per dia que la Sessió 9.

**Done when**:
- [ ] Cada campanya és una card amb badge d'estat, mètriques i progress bar.
- [ ] Les accions (pause/resume/finish) funcionen des de les cards.
- [ ] El chart de detall s'expandeix dins la card.
- [ ] L'auto-refresh de 30s funciona correctament amb les cards.

**Fitxers modificats**: `dapp/views/mycampaigns.js`

---

## Sessió M5 — Creator: UX del formulari

**Model**: **Opus** ⚠️

**Scope**: `dapp/views/creator.js`

El formulari de creació de campanyes és el més complex de l'app (camp de pressupost, recompenses, imatge, preview, temes visuals, publisher rewards, escrow tx). L'usuari no té una guia clara de quins camps pertanyen a quina fase de configuració, i els errors es mostren via `alert()`.

**Canvis**:

1. **Agrupació en seccions visuals** (sense canviar l'estructura del `<form>`):
   - **Secció 1 — Basic info**: títol, descripció, interessos target, dies de durada
   - **Secció 2 — Visual**: tema de color, imatge, preview (l'actual split-view)
   - **Secció 3 — Budget & rewards**: pressupost total, reward/view, reward/click, max viewer reward
   - **Secció 4 — Publisher rewards** (col·lapsable per defecte): publisher reward/view, max publisher budget

   Cada secció usa `<fieldset>` + `<legend>` o `.ma-section` per la separació visual.

2. **Resum de pressupost live**: sota la Secció 3, un box (`.ma-summary-box` ja existent a l'index.html) que recalcula en temps real:
   - Fee estimat (6%)
   - Total a bloquejar a l'escrow
   - Avisos si el pressupost és insuficient pel reward/view × views estimats

3. **Validació inline**: substituir `alert()` per missatges d'error inline sota cada camp problemàtic. L'element `#ma-creator-msg` global es manté per a missatges d'estat generals (tx pendent, campanya publicada).

4. **Secció Publisher col·lapsable**: `<details>/<summary>` natiu HTML — "Publisher rewards (optional)". Tancada per defecte. Quan s'obre, mostra les inputs de publisher reward.

**Decisions de disseny**:
- **Opus** perquè el formulari té interdependències complexes (validació creuada de camps, preview live, escrow tx) i cal no trencar cap flux existent.
- No canviar la lògica d'escrow (`buildAndPostEscrowTx`, resolució de keypairs, `CAMPAIGN_ANNOUNCE`).
- No canviar la lògica del split-view preview (`_attachDivider`, `_attachImagePositioner`).
- Els `<fieldset>` són purament visuals — el `<form>` i el `submit` handler no canvien.

**Done when**:
- [ ] El formulari mostra 4 seccions clarament distingides.
- [ ] El resum de pressupost s'actualitza en canviar els inputs de budget.
- [ ] Els errors de validació apareixen inline sota el camp corresponent (no `alert()`).
- [ ] La secció Publisher és col·lapsable i tancada per defecte.
- [ ] El flux complet de creació de campanya funciona igual que abans.

**Fitxers modificats**: `dapp/views/creator.js`

---

## Sessió M6 — Stats + Frames: poliment

**Model**: Sonnet

**Scope**: `dapp/views/stats.js` · `dapp/views/frames.js`

Stats és una taula plana amb poca informació escanejable. Frames barreja `innerHTML` i `createElement` i no mostra les mètriques de guanys de forma prominent.

**Canvis a Stats**:

1. **Taula millorada**: afegir `mkStatusBadge(status)` a la columna Status (en lloc de text pla). Formatar el budget restant i les recompenses amb 6 decimals consistents.
2. **Badge "Mine"** (actual "Teva"): usar `mkStatusBadge` amb tipus custom en lloc del badge inline actual.
3. **Header de mercat**: afegir un petit resum a dalt — `mkStatCard` amb "Active campaigns" i "Total budget in market" (suma de `BUDGET_REMAINING` de campanyes actives).

**Canvis a Frames**:

1. **Llista de frames com a cards**: cada frame és un `<article>` PicoCSS amb:
   - Nom del frame (label) + badge Built-in si escau
   - Stat cards inline: "Total earned" del frame (de `FRAMES.TOTAL_EARNED`)
   - Botó "Snippet" que expandeix el codi (ja existent) — ara dins un `<details>` per neteja visual
2. **Neteja de codi**: unificar el mix `innerHTML`/`createElement` — triar `createElement` consistent (igual que les altres vistes).
3. **Guia d'integració**: la secció de guia existent queda com a `<details>` col·lapsable (tancada per defecte) per no bloquejar la llista de frames.

**Decisions de disseny**:
- Stats no passa a cards — la taula és apropiada per a dades comparatives de mercat. Es millora dins la taula.
- Frames sí passa a cards — cada frame és una entitat independent, no una comparativa.
- No canviar `listFrames`, `getFrameEarnings` ni cap lògica de canal publisher.

**Done when**:
- [ ] Stats mostra status badges de color i header de mercat amb stat cards.
- [ ] Frames mostra cada frame com a card amb earnings i snippet col·lapsable.
- [ ] La guia d'integració de Frames és col·lapsable.
- [ ] Cap codi `innerHTML` amb strings no sanititzades a Frames (DOMPurify on cal).

**Fitxers modificats**: `dapp/views/stats.js` · `dapp/views/frames.js`

---

## Resum d'estat

| Sessió | Descripció | Model | Estat |
|---|---|---|---|
| M1 | Helpers compartits (design system lite) | Sonnet | ✅ Fet |
| M2 | Viewer: redisseny visual | Sonnet | ✅ Fet |
| M3 | Earnings: stat cards + settlement cards | Sonnet | ✅ Fet |
| M4 | My Campaigns: campaign cards | Sonnet | ✅ Fet |
| M5 | Creator: UX del formulari | Sonnet | ✅ Fet |
| M6 | Stats + Frames: poliment | Sonnet | ⬜ Pendent |
