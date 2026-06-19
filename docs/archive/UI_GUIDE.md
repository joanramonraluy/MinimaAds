# MinimaAds — UI Guide

> Per a sessions de UI pures (canvis de vista, UX, CSS, copy).
> Si el teu canvi toca DB, core, SW, SDK o protocols Maxima → llegeix `AGENTS.md` i `MinimaAds.md` en lloc d'aquest fitxer.

---

## 1) Fitxers de vista

| Fitxer | Ruta | Rol |
|---|---|---|
| `app.js` | `dapp/app.js` | Routing, MDS init, dispatch de senyals SW→FE |
| `creator.js` | `dapp/views/` | Formulari de creació de campanya + escrow tx |
| `viewer.js` | `dapp/views/` | Llista de campanyes, banner d'anunci, reward flow |
| `mycampaigns.js` | `dapp/views/` | Gestió de campanyes del creador (pause/resume/finish, chart, detalls) |
| `earnings.js` | `dapp/views/` | Earnings del viewer i publisher, settlement |
| `frames.js` | `dapp/views/` | Gestió de Frames, snippet de publisher |
| `stats.js` | `dapp/views/` | Taula global de campanyes |
| `profile.js` | `dapp/views/` | Modal de perfil (interessos, adreça, total guanyat) |
| `settings.js` | `dapp/views/` | Vista de configuració |
| `help.js` | `dapp/views/` | Vista d'ajuda i About (guies per rol) |
| `ui-helpers.js` | `dapp/views/` | Funcions DOM compartides — carregat primer |

Estil general: DOM imperatiu via `createElement` + `style.cssText`. No usar `innerHTML` amb strings no sanititzades — si cal, usar `DOMPurify.sanitize(str)`.

---

## 2) Helpers compartits (`ui-helpers.js`)

Funcions pures que retornen un element DOM. El cridant decideix on inserir-lo.

```javascript
mkStatusBadge(status)
// status: 'active' | 'paused' | 'finished' | 'pending' | 'settled'
// → <mark> amb color i text en anglès

mkStatCard(label, value, sub)
// sub és opcional
// → <div> amb label petit, valor gran, subtítol opcional

mkProgressBar(pct, label)
// pct: 0–100
// → <progress> HTML natiu

mkEmptyState(message, ctaText, ctaHref)
// ctaText + ctaHref opcionals
// → <div> centrat amb missatge + link/botó opcional

mkLoading(text)
// text opcional, default: 'Loading…'
// → <p aria-busy="true">

mkSectionTitle(text)
// → <strong class="ma-section-title">

attachScrollIndicator(scrollEl, arrowRightEl, arrowLeftEl)
// Afegeix chevrons ‹ › quan un contenidor fa scroll horitzontal
// Usat per nav tabs i .ma-tabs
```

---

## 3) CSS — convencions

**Framework**: PicoCSS (ja carregat). Usar variables CSS de Pico per a colors i backgrounds.

```css
/* Colors semàntics */
var(--pico-primary)                  /* accent principal */
var(--pico-muted-color)              /* text secundari / labels */
var(--pico-muted-border-color)       /* separadors i vores */
var(--pico-card-background-color)    /* fons de card */
var(--pico-background-color)         /* fons de pàgina */

/* Usar sempre aquests, mai colors hexadecimal hardcodejats per a UI temàtica */
```

**Classes pròpies de l'app** (definides a `public/index.html`):

| Classe | Ús |
|---|---|
| `.ma-tabs` | Contenidor de tabs horitzontal amb scroll |
| `.ma-tabs-container` | Wrapper de tabs + chevrons, `overflow:hidden` |
| `.ma-tabs-arrow` | Chevron de scroll (← →) |
| `.ma-campaign-details` | Secció desplegable dins un campaign card |
| `.ma-campaign-details-summary` | `<summary>` de la secció desplegable |
| `.ma-nested-table` | Taula interna dins detalls de campanya |
| `.ma-nested-detail` | Fila de detall dins una taula nested |
| `.ma-expandable-row` | Fila clicable amb chevron animat |
| `.ma-section-title` | Títol de secció (via `mkSectionTitle`) |
| `.ma-row-avatar` | Avatar circular (inicial o imatge) en llistes |
| `.ma-row-body` | Contenidor de text al costat de l'avatar |

**Tema clar/fosc**: usar `document.documentElement.getAttribute('data-theme') === 'dark'` per a colors que no tenen variable Pico (p.ex. hover backgrounds).

---

## 4) Patrons de maquetació freqüents

**Card de campanya** (My Campaigns, Stats):
```javascript
var article = document.createElement('article');
// PicoCSS article → card visual automàtic
```

**Fila expandible amb detall lazy-load**:
```javascript
var details = document.createElement('details');
var summary = document.createElement('summary');
summary.className = 'ma-campaign-details-summary';
details.addEventListener('toggle', function() {
  if (details.open && !details.dataset.loaded) {
    details.dataset.loaded = '1';
    _loadContent(details); // lazy
  }
});
```

**Taula nested** (dins detalls):
```javascript
var table = document.createElement('table');
table.className = 'ma-nested-table';
```

**Tabs amb scroll indicator**:
```javascript
var tabsContainer = document.createElement('div');
tabsContainer.className = 'ma-tabs-container';
var tabs = document.createElement('ul');
tabs.className = 'ma-tabs';
var arrowR = document.createElement('span');
arrowR.className = 'ma-tabs-arrow ma-tabs-arrow-right';
arrowR.textContent = '›';
tabsContainer.appendChild(tabs);
tabsContainer.appendChild(arrowR);
attachScrollIndicator(tabs, arrowR, null);
```

---

## 5) Idioma i copy

Tots els strings visibles a l'usuari han de ser en **anglès**. Les funcions internes, comentaris i noms de variables poden ser en qualsevol idioma, però el text que apareix a la UI ha de ser anglès.

---

## 6) Biblioteques disponibles (ja carregades)

| Biblioteca | Global | Ús |
|---|---|---|
| PicoCSS | CSS global | Layout, tipografia, botons, formularis |
| Chart.js | `Chart` | Gràfics (line, bar) — usat a `mycampaigns.js` |
| DOMPurify | `DOMPurify` | Sanititzar HTML d'entrada externa abans d'inserir |

---

## 7) Què NO cal llegir per a canvis de UI purs

- `MinimaAds.md §4–§11` (protocol Maxima, KissVM, canals) — irrellevant per a UI
- `AGENTS.md §3` (contracts, forbidden actions) — rellevant si toques core/SW
- `docs/PLATFORM_NOTES.md` — rellevant si toques SW o H2

Sí cal llegir:
- `MinimaAds.md §12` (UI architecture, view responsibilities) si afegeixes una vista nova
- `CLAUDE.md §3` sempre (workflow, checklist, handoff)
