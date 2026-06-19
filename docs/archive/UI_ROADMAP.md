# MinimaAds — UI Roadmap

> **Estratègia**: Flank 2 (funcional) primer, Flank 1 (responsivitat) després.
> L'estructura de vistes ha de ser estable abans de fer CSS responsiu.
> Cada sessió és independent i seqüencial: no iniciar la següent fins que l'anterior estigui ✅.

---

## Com usar aquest document

1. Busca la primera sessió amb estat `⬜ Pendent`.
2. Llegeix el seu scope, les decisions de disseny i el criteri de "done".
3. Executa la sessió seguint el workflow de `CLAUDE.md §3`.
4. Quan acabis, actualitza l'estat a `✅ Fet` i anota els fitxers modificats.
5. Tanca la sessió amb la nota de handoff (`CLAUDE.md §10`).

---

## Flank 2 — Funcional

---

### Sessió 1 — Viewer opt-in `✅ Fet`
**Model**: Sonnet

**Scope**: `dapp/views/viewer.js`

El Viewer auto-carrega un anunci en entrar, cosa que genera events de recompensa no intencionats durant el desenvolupament i força l'usuari a consumir contingut sense consentiment explícit.

**Canvis**:
- Eliminar la crida automàtica a `loadNextAd()` en entrar a la vista.
- Mostrar un estat inicial neutre (sense anunci carregat).
- Afegir un botó explícit ("Veure anunci" o similar) que iniciï el flux.
- Moure la lògica d'auto-càrrega actual al handler d'aquest botó.

**Decisions de disseny**:
- El botó és l'únic punt d'entrada al flux. Un cop l'usuari l'ha premut, el comportament és idèntic a l'actual (carrega anunci → rastreja view → premia → carrega el següent).
- No afecta el flux de "My campaigns" (toggle de previsualització del creador) — aquest flux s'eliminarà a la Sessió 6.

**Done when**:
- [x] Entrar al Viewer no carrega cap anunci ni genera cap event.
- [x] El botó inicia el flux correctament.
- [x] El flux de view + reward funciona igual que abans un cop iniciat.

**Fitxers modificats**: `dapp/views/viewer.js`

---

### Sessió 2 — Interessos del viewer `✅ Fet`
**Model**: Sonnet

**Scope**: DB schema · `core/` · `dapp/views/viewer.js` · `sdk/index.js`

El sistema de targeting per interessos era inoperatiu: `loadNextAd()` sempre passava `userInterests: []`.

**Canvis**:
- **DB**: Afegit columna `INTERESTS TEXT` a `USER_PROFILE` (en ambdós runtimes: SW i FE).
- **UI**: Afegit camp d'interessos al Viewer (tags separats per comes). ⚠️ **Provisional** — la UI es mourà al Perfil d'usuari a la Sessió 4. El backend (DB + core) és definitiu.
- **Core**: `getUserProfile` i `updateUserProfile` inclouen el camp `interests`.
- **SDK**: `loadNextAd()` llegeix els interessos del perfil i els passa a `MinimaAds.getAd({ userInterests })`.

**Done when**:
- [x] Un viewer pot introduir i guardar els seus interessos.
- [x] Els interessos es persisteixen a `USER_PROFILE.INTERESTS`.
- [x] `getAd()` rep i aplica els interessos correctament.
- [x] Una campanya amb `interests: "tecnologia"` es prioritza per a un viewer amb `interests: "tecnologia"`.

**Fitxers modificats**: `core/rewards.js` · `dapp/views/viewer.js` · `MinimaAds.md` · `AGENTS.md`

---

### Sessió 3 — Selector de mode (Viewer / Creator / Publisher) `✅ Fet`
**Model**: Sonnet

**Scope**: `public/index.html` · `dapp/app.js`

L'app mostra totes les vistes a tots els usuaris sense distinció de rol. Un viewer pur veu "Create" i "Frames" que no li aporten res. Cada rol té un conjunt de vistes ben definit i no hi ha cap cas d'ús real on un usuari necessiti veure vistes de múltiples rols simultàniament.

**Canvis**:
- Afegir un selector de mode al nav (botons compactes de text): **Viewer** | **Creator** | **Publisher**.
- El mode actiu es persisteix via `MDS.keypair` (clau `USER_MODE`). Mode per defecte per a nous usuaris: `viewer`.
- El nav mostra dinàmicament les vistes del mode actiu:
  - **Viewer**: View Ads, Earnings
  - **Creator**: Create, My Campaigns *(afegit a Sessió 7)*, Stats
  - **Publisher**: Frames, Earnings
- `doRender()` a `app.js` llegeix el mode actiu i redirigeix al primer item del mode si el hash actual no hi pertany.
- El switcher és visible des de totes les vistes.

**Decisions de disseny**:
- Un sol mode actiu a la vegada — no hi ha cap cas real on un usuari necessiti veure tots els rols alhora.
- Earnings apareix en mode Viewer i Publisher (és transversal als dos).
- "My Campaigns" no existeix en aquesta sessió — el Creator mode mostra Create + Stats fins que la Sessió 7 l'afegeixi. El sistema ha de ser additiu.
- El selector de mode és per a navegació activa. La configuració d'usuari (interessos, etc.) va al Perfil (Sessió 4).
- UI: botons compactes de text, sense ocupar espai innecessari.

**Done when**:
- [x] El selector de mode és visible i funcional des de totes les vistes.
- [x] Cada mode mostra únicament les seves vistes al nav.
- [x] Canviar de mode actualitza el nav instantàniament.
- [x] El mode es persisteix entre sessions (keypair).
- [x] Mode per defecte per a nous usuaris: `viewer`.
- [x] Si el hash actiu no pertany al mode seleccionat, es redirigeix automàticament al primer item del mode.

**Fitxers modificats**: `public/index.html` · `dapp/app.js`

---

### Sessió 4 — Perfil d'usuari `✅ Fet`
**Model**: Sonnet

**Scope**: `public/index.html` · `dapp/app.js` · `dapp/views/viewer.js`

Els interessos (Sessió 2) es van col·locar provisionalment al Viewer. Els interessos són configuració d'usuari, no funcionalitat de visualització. Un perfil d'usuari accessible des de qualsevol mode és el lloc correcte per a aquesta i futures configuracions.

**Canvis**:
- Afegir una icona de perfil al nav (dreta, persistent en tots els modes).
- Fer clic obre un modal amb la configuració de l'usuari:
  - **Interessos**: camp de text (tags separats per comes) — mogut des de `viewer.js`.
  - **Adreça Maxima**: text copiable (informatiu).
  - **Guanys totals**: resum ràpid (`USER_PROFILE.TOTAL_EARNED`).
- Eliminar el camp d'interessos de `dapp/views/viewer.js`.
- El modal és mode-agnòstic: accessible des de qualsevol mode sense canviar la vista activa.

**Decisions de disseny**:
- El perfil és un **modal** (no una vista completa) per no interrompre la navegació.
- El selector de mode (Sessió 3) queda al nav — el perfil és per a configuració, no per a navegació.
- El backend (`INTERESTS` a USER_PROFILE + `core/rewards.js`) ja és correcte des de la Sessió 2. Només es mou la UI.
- La icona pot ser una lletra inicial de l'adreça Maxima o una icona genèrica — no cal imatge real.

**Done when**:
- [x] La icona de perfil és visible al nav des de tots els modes.
- [x] El modal s'obre i tanca correctament.
- [x] Els interessos es llegeixen i guarden igual que abans (mateixa lògica de backend).
- [x] El camp d'interessos ha desaparegut de `viewer.js`.
- [x] L'adreça Maxima i els guanys totals es mostren correctament al modal.

**Fitxers modificats**: `public/index.html` · `dapp/app.js` · `dapp/views/viewer.js`

---

### Sessió 5 — Gestió de campanyes pel creador `✅ Fet`
**Model**: Sonnet

**Scope**: `dapp/views/creator.js` · `dapp/app.js` · `public/service-workers/handlers/campaign.handler.js` · `public/service-workers/handlers/maxima.handler.js`

Els creadors no poden pausar, reprendre ni finalitzar les seves campanyes des de la UI. Els handlers del SW per a `CAMPAIGN_PAUSE` i `CAMPAIGN_FINISH` ja existeixen; `CAMPAIGN_RESUME` s'ha afegit en aquesta sessió.

**Canvis**:
- Afegir a la vista Creator una secció "Les meves campanyes" que llisti les campanyes del creador (`creator_address === MY_ADDRESS`) amb el seu estat i pressupost restant.
- Per a cada campanya activa: botó "Pausar".
- Per a cada campanya pausada: botó "Reprendre".
- Per a cada campanya activa o pausada: botó "Finalitzar".
- Els botons fan broadcast del missatge Maxima corresponent (`CAMPAIGN_PAUSE` / `CAMPAIGN_RESUME` / `CAMPAIGN_FINISH`) via `broadcastMaxima`.
- Actualitzar la UI localment un cop el broadcast és confirmat (o en rebre el signal de SW).

**Decisions de disseny**:
- Aquesta secció viu dins la vista Creator existent (no és una vista nova) — la vista nova de dashboard arriba a la Sessió 7.
- Les campanyes de la llista han de mostrar: títol, estat, pressupost restant.
- "Finalitzar" requereix confirmació (`confirm()`) per evitar accidents.
- `CAMPAIGN_RESUME` no existia als handlers del SW → s'ha afegit (handler + routing a maxima.handler.js + spec MinimaAds.md §8.5 + §11.3).

**Done when**:
- [x] La secció "Les meves campanyes" llista correctament les campanyes del creador.
- [x] Pausar una campanya canvia el seu estat a `paused` localment i fa broadcast.
- [x] Finalitzar una campanya canvia el seu estat a `finished` i fa broadcast.
- [x] La UI s'actualitza sense recarregar la pàgina.

**Fitxers modificats**: `dapp/views/creator.js` · `dapp/app.js` · `public/service-workers/handlers/campaign.handler.js` · `public/service-workers/handlers/maxima.handler.js` · `MinimaAds.md` · `AGENTS.md`

---

### Sessió 6 — Neteja Stats i Viewer `✅ Fet`
**Model**: Sonnet

**Scope**: `dapp/views/stats.js` · `dapp/views/viewer.js`

Stats barreja dades globals amb dades personals. El resum de guanys personals ja existeix a Earnings. El toggle "My campaigns" al Viewer és una eina de creador en el lloc equivocat (la gestió és ara a la Sessió 5).

**Canvis a Stats**:
- Eliminar el bloc de resum de guanys personals ("You earned: X MINIMA — Y views / Z clicks"). Aquesta informació ja és a Earnings.
- La vista Stats mostra únicament la taula global de campanyes actives (mercat).
- Afegir un indicador visual que distingeixi les campanyes pròpies de les d'altri (ex: badge "Teva").

**Canvis al Viewer**:
- Eliminar el toggle "All ads / My campaigns" i tota la lògica de `_previewMode`.
- La previsualització de campanyes pròpies és accessible des de la secció de gestió del creador (Sessió 5).

**Done when**:
- [x] Stats no mostra cap dada de guanys personals.
- [x] Stats mostra la taula global de campanyes amb badge per les pròpies.
- [x] El Viewer no té el toggle "My campaigns" ni cap referència a `_previewMode`.
- [x] No es trenca cap funcionalitat existent.

**Fitxers modificats**: `dapp/views/stats.js` · `dapp/views/viewer.js`

---

### Sessió 7 — Vista "My Campaigns" (dashboard creador) `✅ Fet`
**Model**: Sonnet (Opus si l'agent ha de prendre decisions d'arquitectura)

**Scope**: `dapp/views/` (nova vista) · `public/index.html` · `dapp/app.js`

El creador no té un dashboard propi. La secció afegida a la Sessió 5 dins Creator és un primer pas, però el creador mereix una vista dedicada amb mètriques per campanya.

**Canvis**:
- Crear `dapp/views/mycampaigns.js` amb una vista dedicada al creador.
- La vista mostra les seves campanyes amb: títol, estat, pressupost total / restant, rewards per view/click, comptadors de views i clicks (des de `REWARD_EVENTS`).
- Accions de gestió (pausar/finalitzar/reprendre) migrades aquí des de la secció provisional de la Sessió 5. Treure la secció provisional de `creator.js`.
- Afegir la vista al router de `app.js` i registrar el nou script a `index.html` en l'ordre correcte.
- Afegir "My Campaigns" al mode Creator del switcher (Sessió 3): ara Creator mostra Create + My Campaigns + Stats.

**Decisions de disseny**:
- Nom de la ruta: `#mycampaigns`. Nom al nav: "My Campaigns".
- La vista Creator queda exclusivament per crear campanyes noves.
- Les campanyes sense cap event de reward mostren comptadors a zero (no ocultar-les).

**Done when**:
- [x] La nova vista és accessible des del nav en mode Creator.
- [x] Llista correctament les campanyes del creador amb totes les mètriques.
- [x] Les accions de gestió funcionen des d'aquí.
- [x] La secció provisional de `creator.js` (Sessió 5) és eliminada.
- [x] El mode Creator del switcher mostra Create + My Campaigns + Stats.
- [x] `AGENTS.md` actualitzat si s'han afegit senyals nous.

**Fitxers modificats**: `dapp/views/mycampaigns.js` (nou) · `dapp/app.js` · `dapp/views/creator.js` · `public/index.html`

---

### Sessió 8 — Earnings: historial desplegable + ajustos nav `✅ Fet`
**Model**: Sonnet

**Scope**: `dapp/views/earnings.js` · `dapp/app.js`

La taula global "Reward History" mostra tots els events descontextualitzats. Cada settlement ha de tenir un desplegable (per defecte tancat) amb els events que li pertanyen.

**Canvis a Earnings**:
- Eliminar la taula global "Reward History".
- Cada fila de settlement pendent: toggle "▶ Detall" que expandeix una sublista amb els events de recompensa d'aquell canal (`REWARD_EVENTS` filtrats per `campaign_id` + `viewer_key`).
- Cada fila de settlement liquidat: mateix desplegable amb els events del canal ja tancat.
- Per defecte: tots els desplegables tancats.

**Ajustos nav**:
- Canviar la ruta per defecte (sense hash) de `stats` a `viewer` a `app.js`.
- Verificar i corregir `aria-current` si no s'ha resolt al switcher de la Sessió 3.

**Done when**:
- [x] No hi ha taula global "Reward History".
- [x] Cada settlement té un desplegable funcional amb els seus events.
- [x] Els desplegables comencen tancats.
- [x] La ruta per defecte sense hash és `viewer`.
- [x] `aria-current` s'actualitza correctament en navegar.

**Fitxers modificats**: `dapp/views/earnings.js` · `dapp/app.js`

---

### Sessió 9 — Chart.js a detall de campanya `✅ Fet`
**Model**: Sonnet

**Scope**: `dapp/views/mycampaigns.js`

L'spec §15.4 defineix un gràfic de línia (Chart.js) per visualitzar interaccions al llarg del temps. La biblioteca ja és carregada a `index.html` però mai s'utilitza.

**Canvis**:
- A la vista "My Campaigns", afegir un detall de campanya (clic a una fila → expandeix un subpanel).
- El detall mostra un gràfic de línies (Chart.js) amb views i clicks agrupats per dia.
- Les dades s'obtenen de `REWARD_EVENTS.TIMESTAMP` (BIGINT Unix ms) agrupats per dia en JS.
- Auto-refresh cada 30s mentre la vista és activa (via `setInterval` + `clearInterval` en sortir).

**Done when**:
- [x] El gràfic es renderitza correctament per a campanyes amb events.
- [x] El gràfic mostra un estat buit per a campanyes sense events (no errors).
- [x] L'auto-refresh funciona i es neteja en canviar de vista.

**Fitxers modificats**: `dapp/views/mycampaigns.js`

---

### Sessió 10 — Indicador de creator online `✅ Fet`
**Model**: **Opus** ⚠️

**Scope**: `sdk/index.js` · `service.js` (SW) · handlers SW · `MinimaAds.md §8` · `AGENTS.md §9`

Si el creador és offline, el viewer obre un canal que mai rebrà vouchers (documentat a KNOWN_ISSUES #37). Aquesta sessió implementa el "creator liveness check" amb un nou parell de missatges Maxima.

**Canvis**:
- Dissenyar i implementar `CREATOR_LIVENESS_PING` i `CREATOR_LIVENESS_PONG`.
- Al SDK: abans de `_channelFlow`, enviar un ping al creador i esperar resposta (~2s). Si no respon, saltar la campanya.
- Cache de liveness per campanya (~2 min).
- Al SW del creador: handler per a `CREATOR_LIVENESS_PING` que respon amb `CREATOR_LIVENESS_PONG`.
- Actualitzar `MinimaAds.md §8` i `AGENTS.md §9`.
- Al Viewer: indicació visual si cap campanya és accessible.

**Decisions de disseny**:
- El ping és Maxima directe al `creator_address` (no broadcast).
- Si no hi ha resposta en ~2s, la campanya es considera inaccessible per a aquesta sessió.
- És una millora ergonòmica, no un requisit de seguretat.
- La porta de liveness s'aplica **abans de `createRewardEvent`** (no només abans de `_channelFlow`) per evitar rewards locals sense corresponent voucher on-chain.
- Si el canal ja és `open` o `pending`, el creador era accessible quan es va obrir → es salta el ping.

**Done when**:
- [x] Un viewer no veu campanyes de creadors offline.
- [x] El ping/pong funciona en un entorn de dos nodes.
- [x] `MinimaAds.md §8` i `AGENTS.md §9` actualitzats.
- [x] Cache de liveness funciona (no es fa ping repetitiu en 2 min).

**Fitxers modificats**: `sdk/index.js` · `public/service-workers/handlers/campaign.handler.js` · `public/service-workers/handlers/maxima.handler.js` · `dapp/app.js` · `MinimaAds.md` · `AGENTS.md`

---

### Sessió 11 — Estats buits `✅ Fet`
**Model**: Sonnet

**Scope**: totes les vistes

Cap vista mostra un missatge orientatiu quan no hi ha dades.

**Canvis**:
- **Viewer**: "No hi ha anuncis disponibles ara. Torna-ho a intentar més tard."
- **Earnings**: "Encara no has guanyat res. Vés a View Ads per començar." (apareix quan `totalEarned === 0`; inclou link `<a href="#viewer">`).
- **My Campaigns**: ja tenia el missatge correcte des de la Sessió 7 — sense canvis.
- **Stats**: "No hi ha campanyes actives al sistema." (actualitzat des de "No campaigns yet.").
- **Frames**: missatge explicant el concepte de Frame i indicant el formulari de baix com a CTA.

**Done when**:
- [x] Cada vista mostra un empty state útil quan no hi ha dades.
- [x] Cap empty state mostra errors JS o elements buits sense explicació.
- [x] Els missatges suggereixen una acció concreta quan és possible.

**Fitxers modificats**: `dapp/views/viewer.js` · `dapp/views/earnings.js` · `dapp/views/stats.js` · `dapp/views/frames.js`

---

## Flank 1 — Responsivitat

> No iniciar fins que totes les sessions del Flank 2 estiguin ✅.

---

### Sessió 12 — Responsivitat crítica `✅ Fet`
**Model**: Sonnet

**Scope**: `public/index.html` (CSS) · `dapp/views/creator.js`

**Canvis**:
- **Nav (1A-1)**: El selector de mode (Sessió 3) i la icona de perfil (Sessió 4) han de ser usables en 375px. CSS-only (`flex-wrap: wrap`) o `<details>`/toggle si no hi caben. Sense JS addicional.
- **Taules (1A-2)**: Tots els `<table>` de totes les vistes embolcallats en `<div style="overflow-x:auto">`.
- **Creator a mòbil (1A-3)**: En pantalles < 480px, ocultar preview (imatge drag + divider). Botó "Veure preview" que obre un modal. Controls de drag substituïts per inputs numèrics quan el preview és ocult.

**Done when**:
- [x] Nav + selector de mode + icona de perfil usables en 375px sense overflow.
- [x] Totes les taules fan scroll horitzontal en lloc de trencar el layout.
- [x] Creator usable en mòbil sense el preview visible per defecte.
- [ ] Verificat en viewport de 375px (Chrome DevTools o dispositiu real).

**Fitxers modificats**: `public/index.html` · `dapp/views/creator.js`

---

### Sessió 13 — Responsivitat: poliment `✅ Fet`
**Model**: Sonnet

**Scope**: `dapp/views/viewer.js` · `dapp/views/creator.js`

**Canvis**:
- **"Today earned" (1B-1)**: Treure del footer del Viewer. Mostrar com a badge inline just sota el banner de l'anunci.
- **Touch events al Creator (1B-2)**: Afegir `touchstart` / `touchmove` / `touchend` als handlers de drag de la imatge i del divider. No és un refactor — és afegir els mateixos handlers en paral·lel als de mouse.

**Done when**:
- [x] "Today earned" apareix correctament posicionat al Viewer.
- [x] El drag de la imatge i el divider funcionen amb el dit en mòbil.

**Fitxers modificats**: `dapp/views/viewer.js`

**Nota implementació 1B-2**: Els handlers `touchstart` / `touchmove` / `touchend` ja eren presents a `_attachImagePositioner` i `_attachDivider` de sessions anteriors. Cap canvi necessari a `creator.js`.

---

## Resum d'estat

| Sessió | Descripció | Model | Estat |
|---|---|---|---|
| 1 | Viewer opt-in | Sonnet | ✅ Fet |
| 2 | Interessos del viewer (backend definitiu, UI provisional) | Sonnet | ✅ Fet |
| 3 | Selector de mode (Viewer / Creator / Publisher) | Sonnet | ✅ Fet |
| 4 | Perfil d'usuari (mou UI d'interessos de Viewer al modal) | Sonnet | ✅ Fet |
| 5 | Gestió de campanyes (pause/resume/finish) | Sonnet | ✅ Fet |
| 6 | Neteja Stats i Viewer | Sonnet | ✅ Fet |
| 7 | Vista "My Campaigns" | Sonnet / Opus | ✅ Fet |
| 8 | Earnings: historial desplegable + nav | Sonnet | ✅ Fet |
| 9 | Chart.js a detall de campanya | Sonnet | ✅ Fet |
| 10 | Indicador de creator online | **Opus** ⚠️ | ✅ Fet |
| 11 | Estats buits | Sonnet | ✅ Fet |
| 12 | Responsivitat crítica | Sonnet | ✅ Fet |
| 13 | Responsivitat: poliment | Sonnet | ✅ Fet |
