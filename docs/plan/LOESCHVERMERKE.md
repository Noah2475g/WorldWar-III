# LOESCHVERMERKE — was Noah freigeben soll

> **Regel (Noah, Sitzung 2026-10-03):** In dieser Sitzung wird nichts gelöscht. Was weg soll, steht als
> auskommentierter Block mit der Zeile `LOESCHVERMERK (Review): <Grund>`. Diese Liste sammelt jeden Vermerk
> mit einer Empfehlung des Reviews, damit Noah in einer **späteren Sitzung** freigibt (`LÖSCHEN` = Block
> samt Vermerk entfernen, `KÜRZEN` = Code im Block entfernen, die Begründung stehen lassen, `BLEIBT` =
> Vermerk behalten). Freigegeben von Noah am 2026-10-03 im Chat und umgesetzt (Protokoll: Spalte Empfehlung; Nr. 14–18 bleiben als Archiv, Nr. 18 mit ergänzter `dod`; Vermerke außerhalb dieser Liste blieben unverändert). Stand: 2026-10-03, Spitze `bf8af90` plus dieser Commit;
> die Zeilennummern gelten für diesen Stand. Gefunden mit `grep -rn LOESCHVERMERK` (ohne `node_modules`).
> Vor dem Löschen: `pnpm verify` — eine Datei mit einem entfernten Import-Vermerk muss ihn ersetzen.

| # | Datei:Zeile | Inhalt kurz | Empfehlung | Begründung |
|---|---|---|---|---|
| 1 | `packages/ai/src/consolidate.ts:97` | alte `consolidateCommands` (Stapel statt Einheiten, ohne Rolle, eine Gruppe je Provinz), rund 50 auskommentierte Zeilen | **LÖSCHEN** — erledigt 2026-10-03 (Noahs Freigabe) | Von T-M42-08 ersetzt und durch K1–K10 in `decide.test.ts` abgedeckt; die alte Fassung steht in `3e3f850^` in git. Der Befund (Stapel zählen, Deckel überschritten) steht in `PROBLEME.md`. |
| 2 | `packages/ai/src/consolidate.ts:23` | Satz im Kopfkommentar „Die alte Fassung (unten als LOESCHVERMERK) …“ | **KÜRZEN** — erledigt 2026-10-03 (Noahs Freigabe) | Mit Nr. 1 wird „unten als LOESCHVERMERK“ falsch; auf „in git, `3e3f850^`“ umstellen, den Befund-Satz behalten. |
| 3 | `packages/ai/src/consolidate.ts:86` | „eine Provinz je Denkschritt“ (`if (commands.length > 0) break`) mit Begründung | **KÜRZEN** — erledigt 2026-10-03 (Noahs Freigabe) | Die Zeile `break` ist tot und durch Z1/Z2/K7 abgesichert; die Begründung (Paare über zwei Tagesenden, m17 Stufe F: 28) ist der Beleg für D32.10 und bleibt als Satz. |
| 4 | `packages/ai/src/military.ts:156` | alte Fassung der Batterie-Bedingung (`nurFernwaffen` ausgeschrieben) | **LÖSCHEN** — erledigt 2026-10-03 (Noahs Freigabe) | Verhaltensgleich in `army-role.ts`, getestet in `army-role.test.ts` R1–R5 und B6c (`m42-zaehlung.test.ts`). Drei Zeilen, kein Informationsverlust. **Die andere Sitzung fasst `military.ts` an; erst nach deren Merge löschen.** |
| 5 | `apps/headless/test/m42-zaehlung.ts:59` | alter Zwilling `istBatterie` (Wortlaut von `military.ts`) | **LÖSCHEN** — erledigt 2026-10-03 (Noahs Freigabe) | Der Zwilling liest `isBattery`; der alte Wortlaut ist in Nr. 4 und in git. Danach auch den Kopfkommentar (Z. ~43, „Zwilling von `military.ts:155-157`“) und das `Rolle`-Docblock berichtigen — beide nennen den Wortlaut-Wächter B6, den es nicht mehr gibt. |
| 6 | `apps/headless/test/m42-zaehlung.test.ts:106` | alter Fall B6, Wortlaut-Wächter per `readFileSync` gegen `military.ts` | **LÖSCHEN** — erledigt 2026-10-03 (Noahs Freigabe) | Ein Quelltext-Grep prüft Schreibweise, nicht Verhalten; er fiel mit T-M42-08 weg. Ersatz: B6c. |
| 7 | `apps/headless/test/m42-zaehlung.test.ts:122` | alter Fall B6b, zwei `includes()` auf Quelltext | **LÖSCHEN** — erledigt 2026-10-03 (Noahs Freigabe) | Wertlos (Review-Punkt 6): faellt bei jeder Umbenennung, ohne dass sich Verhalten ändert, und besteht, wenn die Zeile nur im Kommentar steht. **Ersetzt durch B6c** (Verhalten: Zähler und `militaryCommands` urteilen für Batterie/Linie gleich; Mutation in `military.ts` lässt B6c rot werden). |
| 8 | `apps/headless/test/m42-zaehlung.test.ts:1` | auskommentierter Import `readFileSync` | **LÖSCHEN** — erledigt 2026-10-03 (Noahs Freigabe) | Seit Nr. 6/7 ungenutzt (Lint). Nur zusammen mit Nr. 6 und 7 löschen. |
| 9 | `packages/ai/src/decide.test.ts:720` | alte Erwartung von K7 (`[['b1','b2']]`, eine Provinz je Denkschritt) | **LÖSCHEN** — erledigt 2026-10-03 (Noahs Freigabe) | Eine Zeile; die neue Erwartung (zwei Provinzen) steht darunter, der Testname sagt es jetzt selbst. |
| 10 | `docs/plan/WORKFLOW.md:42` | Kommentarblock mit dem Kopf von Etappe 1 (Stand 2026-09-27, „nur noch acceptance“) | **LÖSCHEN** — erledigt 2026-10-03 (Noahs Freigabe) | Vollständig überholt (PR #13 gemerged, Abnahme 12/12); Wortlaut in git. Der neue Kopf trägt die Fakten. |
| 11 | `docs/plan/WORKFLOW.md:115` | Kommentarblock „Die Spitze liegt auf `main`“ (PR #13) | **LÖSCHEN** — erledigt 2026-10-03 (Noahs Freigabe) | Falsch für den Zweig; die richtige Aussage steht in §0. Beim Merge nach `main` §0 ohnehin neu schreiben (Falle 1). |
| 12 | `docs/plan/WORKFLOW.md:126` | Kommentar „vorher `git switch main && git pull --ff-only`“ | **LÖSCHEN** — erledigt 2026-10-03 (Noahs Freigabe) | Gleicher Grund wie Nr. 11. |
| 13 | `docs/plan/WORKFLOW.md:218` | Marker über dem berichtigten Zwischenstand vom 2026-10-03 (alt: „T-M42-08/-09 hängen an der Antwort“) | **KÜRZEN** — erledigt 2026-10-03 (Noahs Freigabe) | Der Absatz selbst ist berichtigt; nur der Marker mit dem alten Wortlaut kann weg. |
| 14 | `docs/research/_raw/probe/economy-I1.ts:265` | alte `TARGET_MIX` 50/30/20 | **BLEIBT** — erledigt 2026-10-03 (Noahs Freigabe) | Rohdaten der Messsonde zu Befund M42-07-a; wer die Messung wiederholt, braucht die Ausgangsfassung. Die Sonde ist Archiv, kein Produktivcode. |
| 15 | `docs/research/_raw/probe/economy-I1.ts:298` | alte `rankedUnitsFor` (Stapelzählung) | **BLEIBT** — erledigt 2026-10-03 (Noahs Freigabe) | Dasselbe: Ausgangsfassung der Sonde. |
| 16 | `docs/research/_raw/probe/economy-I1.ts:530` | alte Zeile `nurPanzerDavor`, zweite Iteration M42-07-a | **BLEIBT** — erledigt 2026-10-03 (Noahs Freigabe) | Belegt, welche Iteration was änderte (drei Iterationen, Entscheid in `DECISIONS.md`). |
| 17 | `docs/research/_raw/probe/FS.patch:12, 27, 203, 228, 257` | fünf Vermerke in einem Patch-Archiv (T-M42-04) | **BLEIBT** — erledigt 2026-10-03 (Noahs Freigabe) | Ein Patch trägt seine Vermerke als `+`-Zeilen; sie zu entfernen heißt, den Patch zu ändern. T-M42-04 ist zurückgestellt, der Patch ist die Grundlage für die Wiederaufnahme. |
| 18 | `docs/plan/tasks.yaml:3722, 3732` | Wort „LOESCHVERMERK“ in den `dod`-Texten von T-M42-08/-09 | **BLEIBT** — erledigt 2026-10-03 (Noahs Freigabe) | Prosa über den Vermerk (Beleg des Baus), kein Block. Fällt von selbst weg, wenn Nr. 1/3/4/5/6 gelöscht sind — dann den Satz in der `dod` auf „(Vermerke freigegeben und gelöscht am …)“ ergänzen, nicht streichen. |

**Kein Vermerk, aber ebenfalls nicht gelöscht:** `01-REQUIREMENTS.md` (Vermerk „unerfüllt“ unter R-AI-10/AK1,
„nicht nachprüfbar“ bei R-AI-12/AK3), `03-TASKS.md` (T-M42-08: Abhängigkeit auf T-M42-06 umgestellt, M18-Notiz
zur Einschiffung), `tasks.yaml` (T-M42-08 `deps`), `DECISIONS.md` (Nachtrag 2026-10-03), `PROBLEME.md`
(Befund M42-PL-a) — das sind Berichtigungen und Ergänzungen, keine Löschkandidaten.

## Nachtrag M44 Paket B (Durchsicht B, 2026-10-03)

Die Durchsicht fand ersetzten Code ohne Vermerk. Der alte Wortlaut steht jetzt als Kommentar an der Stelle; Empfehlung ist
jeweils **LÖSCHEN**, sobald Noah Paket B abgenommen hat (der Wortlaut bleibt in git).

| # | Datei | Inhalt kurz | Empfehlung | Begründung |
|---|---|---|---|---|
| 19 | `apps/desktop/src/ui/Standings.tsx` (`VictoryDialog`) | altes Dialoggerüst des Endedialogs, Tabellenklasse der Rangliste | **LÖSCHEN** — erledigt 2026-10-03 (Noahs Freigabe) | Ersetzt durch `Dialog` (T-M44-08/-15), Test in `a11y.test.tsx`, `Standings.test.tsx`. |
| 20 | `apps/desktop/src/ui/Panels.tsx` (`ActionButton`, `ActionGroup`, `Targeting`, `DiplomacyPanel`) | Touch-Zeile, Signatur ohne `collectReasons`, flache Zielliste, Leerzustände ohne Klasse | **LÖSCHEN** — erledigt 2026-10-03 (Noahs Freigabe) | T-M44-11/-18, getestet in `Panels.test.tsx`. |
| 21 | `apps/desktop/src/ui/Explain.tsx` | Erklärung als Block ohne Escape | **LÖSCHEN** — erledigt 2026-10-03 (Noahs Freigabe) | Popover (T-M44-13), `Explain.test.tsx`. |
| 22 | `apps/desktop/src/ui/Tooltip.tsx` | Tooltip ohne `selected`, immer mit Mausbedienung | **LÖSCHEN** — erledigt 2026-10-03 (Noahs Freigabe) | T-M44-07, `Tooltip.test.tsx`. |
| 23 | `apps/desktop/src/ui/useMapTooltip.ts` | Regel „Zeiger, sonst Auswahl“ (`tooltipId = hover?.id ?? selectedProvince`) | **LÖSCHEN** — erledigt 2026-10-03 (Noahs Freigabe) | T-M44-07, `useMapTooltip.test.tsx`. |
| 24 | `apps/desktop/src/ui/touch.css` | Selektor `.header__top > .meter` | **LÖSCHEN** — erledigt 2026-10-03 (Noahs Freigabe) | T-M44-04, `cascade.touch.test.tsx`. |
| 25 | `apps/desktop/src/i18n/de.ts` | `keys.title` „Tastatur“, `keys.help` „F1 — diese Übersicht“, `victoryPointsHint` mit fester 70 | **LÖSCHEN** — erledigt 2026-10-03 (Noahs Freigabe) | Durchsicht B, Befunde 2 und 5; `Dialogs.test.tsx`. |
| 26 | `apps/desktop/src/ui/menuEntries.ts` (Gegenstück: `Dialogs.tsx`, `MenuDialog`) | Die drei von Hand gesetzten Menüknöpfe mit je einem Prop (`onNewGame`, `onSaves`, `onSettings`); die Datei selbst ist neu (T-M44-02b), der ersetzte Wortlaut steht als Kommentar in `Dialogs.tsx` | **LÖSCHEN** — erledigt 2026-10-03 (Noahs Freigabe) | Ersetzt durch die Liste `MENU_ENTRIES` (T-M44-02b, -09a, -16), `Dialogs.test.tsx`. |
| 27 | `apps/desktop/src/ui/Dialogs.tsx` | `onKeyDown` am Dialog-Element (Escape, Fokusfang), Pflicht-`onClose`, Kopf mit eigenem Schließen-Knopf, `newGame.seedHint`-Zeile, Aktionsabsatz `dialog__actions`, Menüknöpfe von Hand | **LÖSCHEN** — erledigt 2026-10-03 (Noahs Freigabe) | Ersetzt durch den Lauscher am Dokument und die feste Fußzeile (T-M44-05, -08), `Dialogs.test.tsx`, `a11y.test.tsx`. Wortlaut als Kommentar an den drei Stellen (Zeilen mit LOESCHVERMERK). |
| 28 | `apps/desktop/src/game/actions.ts` | Der Block `switch (reason)` mit den Handelsgründen (OFFER_TRADE/ACCEPT_TRADE) | **LÖSCHEN** — erledigt 2026-10-03 (Noahs Freigabe) | Wortgleich nach `rejections.ts` (REASON_KEYS) gezogen, T-M44-06, `rejections.test.ts`. Wortlaut als Kommentar an der Stelle. |
| 29 | `apps/desktop/src/ui/app.css` (`@keyframes alert-in`) | Einblendung über `opacity` (0 → 1) | **LÖSCHEN** — erledigt 2026-10-03 (Noahs Freigabe) | T-M44-17: axe misst im Übergang 3,71:1/4,31:1; `ux:check --only R-UX-06/AK1` 50 Zustände ohne Verstoß. Wortlaut als Kommentar an der Stelle. |
| 30 | `apps/desktop/src/ui/app.css` (`:focus-visible`) | Umriss in `var(--accent)` (Feindrot) | **LÖSCHEN** — erledigt 2026-10-03 (Noahs Freigabe) | T-M44-17, `tokens.contrast.test.ts` (R-UX-06/AK4). Wortlaut als Kommentar an der Stelle. |
- 2026-10-03 (Bahn K): `docs/plan/01-REQUIREMENTS.md` R-AI-12/AK4 — abgeschwächter Wortlaut (61d1477, "Vorrats-Horizont") ersetzt durch den alten Wortlaut; der alte Text steht als HTML-Kommentar mit LOESCHVERMERK dort. Grund: T-M42-14 zurückgenommen (H1–H3), kein Wort von Noah (E1).
- 2026-10-04 (V3 Schritt 0): `docs/reports/packaging.md`, Abschnitt „Grenzen dieser Messung“ — Satz „Die Uhr bei Tempo 100 wurde nicht neu gemessen“ ersetzt durch den Verweis auf den neuen Abschnitt „Uhr bei Tempo 100 (2026-10-04)“; alter Wortlaut als HTML-Kommentar mit LOESCHVERMERK dort. Grund: Uhr an der neuen exe gemessen (Normalstreuung).
- 2026-10-04 (Merge PR #20): `docs/plan/WORKFLOW.md` §0 — Satz zur Spitze nach PR #15 ersetzt durch den Stand nach PR #20 und den Hinweis auf den V3-Zweig; alter Wortlaut als HTML-Kommentar mit LOESCHVERMERK dort.

## Nachtrag V3 Welle 1 (Bahn P-Hülle, 2026-10-04)

| # | Datei:Zeile | Inhalt kurz | Empfehlung | Begründung |
|---|---|---|---|---|
| 31 | `apps/desktop/src/App.tsx` (`stateRef`) | die Zeile `stateRef.current = state` im Render | **LÖSCHEN**, sobald Noah T-M45-04 abgenommen hat | Die Uhr schreibt den Spiegel jetzt zwischen zwei Bildern fort und gibt React den Stand am Bildende (`flushState`); ein Render mit dem alten React-Stand hätte den Spiegel zurückgedreht. Alle Schreiber laufen über `commitState`. Wortlaut als Kommentar an der Stelle. |
| 32 | `apps/desktop/src/map/MapCanvas.tsx` (`withBounds`) | `useMemo` allein auf `props.provinces` | **LÖSCHEN**, sobald Noah T-M45-04 abgenommen hat | Ersetzt durch die Fassung, die dieselbe Liste behält, solange Umrisse und Füllung gleich bleiben (`sameShapes`); Test `MapCanvas.test.tsx` „T-M45-04“. Wortlaut als Kommentar an der Stelle. |
