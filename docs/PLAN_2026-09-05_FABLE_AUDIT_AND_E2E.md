Aquesta sessió continua el treball de MinimaAds. Llegeix primer `CLAUDE.md` i `docs/DOCUMENTATION_INDEX.md` com marca el ritual d'inici de sessió.

## Context previ (2026-09-05, sessió anterior)

Avui s'han tancat TOTS els ítems oberts coneguts: fragility #51, DOC-1, i AUD-2 (l'últim ítem de les taules d'auditoria AUD-1..5). `docs/KNOWN_ISSUES.md` ha quedat sense cap entrada 🔴 Open. Addicionalment, s'ha fet una reestructuració de documentació/procés (CLAUDE.md, AGENTS.md, KNOWN_ISSUES.md, HISTORY.md, TESTING_SETUP.md) per eliminar duplicació de narrativa entre fitxers — llegeix `AGENTS.md §6` (les 3 entrades més recents, ara en format de punter curt) i el seu commit corresponent per detall si cal.

**Aquesta sessió té 3 passos, en ordre.** No saltis al pas 2/3 sense haver completat el 1 (el pla de proves en viu del pas 2 s'ha de prioritzar amb els resultats reals de l'auditoria del pas 1, no a cegues).

---

## Pas 1 — Auditoria de codi amb Fable

Invoca un agent amb `model: "fable"` (via l'eina Agent) per fer una auditoria de codi profunda i comprensiva de l'estat ACTUAL del repositori. Hi ha precedent exacte al projecte: `docs/archive/AUDIT_2026-07-18_FABLE.md` ("Conducted by: Fable agent (deep comprehensive audit)") — llegeix-lo primer per conèixer el format i l'abast que es va fer servir la vegada anterior, i replica'n l'estructura (Executive Summary amb comptatge per severitat CRITICAL/HIGH/MEDIUM/LOW-INFO, després cada troballa amb Location, Description, Impact).

Abast de l'auditoria:
- Codi complet: `core/*.js`, `public/service-workers/**/*.js`, `sdk/index.js`, `dapp/**/*.js`, `renderer/renderAd.js`, `config.js`.
- Creuar-ho contra `MinimaAds.md` (contractes, schemas) i `docs/KNOWN_ISSUES.md` (per no reobrir res ja tancat — però SÍ assenyalar-ho si trobes que un fix ja tancat té una regressió o un cas no cobert).
- Especial atenció a les mateixes categories que l'auditoria anterior ja va trobar rendibles: autenticació de remitent en handlers Maxima inbound, races de UTXO/indexació, monotonicitat de vouchers, dedup, coherència entre validació SW i FE/SDK.

Output: desa els resultats a `docs/AUDIT_2026-09-05_FABLE.md` (mateix format que l'anterior). NO apliquis cap fix encara — aquest pas és només de detecció.

Un cop tens els resultats, fes-ne un resum breu abans de continuar al pas 2 (no cal esperar confirmació del mantenidor per continuar als passos 2/3, ja estan pre-aprovats com a seqüència, però sí que has d'exposar el resum de troballes abans de dissenyar el pla de proves).

---

## Pas 2 — Pla de proves end-to-end en viu, prioritzat

Amb els resultats del pas 1 a la mà, dissenya un pla de proves en viu contra el harness real de 6 nodes (`docs/TESTING_SETUP.md`). Prioritza:

1. Qualsevol troballa CRITICAL/HIGH del pas 1 que sigui verificable en viu (no totes ho seran — algunes són purament de codi/lògica).
2. Els buits ja coneguts i mai coberts, llistats explícitament a `docs/TESTING_SETUP.md §10` ("What's still undocumented"):
   - Flux de viewer sencer: obrir `#viewer`, veure un anunci, reclamar recompensa de view/click, confirmar que el voucher arriba correctament.
   - Patrons multi-viewer / voucher-sync (N-1 viewers contra un sol creador).
   - Flux de publisher: registrar un Frame (`#frames`), incrustar-lo, confirmar que les recompenses de publisher enruten correctament.
   - Com resetejar l'estat entre passades de proves (Delete Data / Kill All Processes a MinimaNodeManager) sense repetir tot l'onboarding.
3. Escenaris d'integració que cap fix puntual anterior ha provat mai junts (p.ex. publisher + viewer amb canals oberts simultàniament sobre la mateixa campanya, múltiples campanyes actives competint pel mateix budget/publisher_budget).

El pla ha de ser concret: quins nodes fan de què (creador/viewer/publisher), quines accions UI exactes, quin resultat s'espera, quina consulta SQL/coin confirma l'èxit — mateix nivell de detall que les verificacions en viu ja documentades a `AGENTS.md §6`/`docs/HISTORY.md §17` d'avui.

---

## Pas 3 — Execució amb control de navegador

Executa el pla del pas 2 fent servir Playwright contra els 6 nodes reals. Abans de començar:
- Llegeix `docs/TESTING_SETUP.md §11` ("Known Environment Gotchas") — conté lliçons operatives d'avui i sessions anteriors (sessió MDS obsoleta després d'un redeploy, pestanyes que es tanquen soles, `browser_evaluate` bloquejat en enviaments Maxima directes → usar el textbox de terminal de MinimaNodeManager) que t'estalviaran temps de redescobriment.
- Comprova si els 6 nodes ja estan aixecats (`localhost:3000`) abans de tornar a muntar res.

Per cada bug real trobat durant l'execució (no cosmètic, no ja conegut): **atura't i aplica el ritual de CLAUDE.md §2** (autoavaluació de complexitat + suggeriment públic + esperar confirmació del mantenidor) abans de tocar cap codi — l'auditoria/pla de proves en si no necessiten aquest ritual (no toquen codi), però CADA fix que en derivi sí.

## Housekeeping (CLAUDE.md §4, obligatori per a cada fix real que apliquis)

- Segueix el patró nou (ja vigent des d'avui): narrativa completa una sola vegada a `docs/HISTORY.md §17`; punter curt a `AGENTS.md §6`; si un ítem de `KNOWN_ISSUES.md` es tanca, marca'l amb una línia + punter a `HISTORY.md`, no repeteixis la narrativa allà.
- Si l'auditoria troba problemes que decideixes NO arreglar en aquesta sessió (fora d'abast, requereixen maintainer decision, etc.), documenta'ls a `docs/KNOWN_ISSUES.md` com a noves entrades obertes (aquestes SÍ amb narrativa completa inline, ja que encara no tenen "full detail" enlloc més fins que es tanquin).

## Restriccions

- NO facis `git commit` ni `git push` — el mantenidor ho demanarà explícitament.
- L'auditoria Fable (pas 1) i el disseny del pla (pas 2) no toquen codi — cap ritual de CLAUDE.md §2 necessari per ells. Qualsevol fix real derivat (pas 3) sí que el necessita, individualment.

## Output final

Handoff Note en català per cada fix real aplicat (format CLAUDE.md §11, abreujat si LOW). Al tancar la sessió (o quan el mantenidor ho digui), un resum global: quantes troballes de l'auditoria, quantes es van arreglar en viu, quines queden documentades com a obertes per a una sessió futura.
