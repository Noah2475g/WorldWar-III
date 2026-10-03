# LOESCHVERMERKE — was Noah freigeben soll

> **Regel (Noah, Sitzung 2026-10-03):** In dieser Sitzung wird nichts gelöscht. Was weg soll, steht als
> auskommentierter Block mit der Zeile `LOESCHVERMERK (Review): <Grund>`. Diese Liste sammelt jeden Vermerk
> mit einer Empfehlung des Reviews, damit Noah in einer **späteren Sitzung** freigibt (`LÖSCHEN` = Block
> samt Vermerk entfernen, `KÜRZEN` = Code im Block entfernen, die Begründung stehen lassen, `BLEIBT` =
> Vermerk behalten). Nichts davon ist freigegeben. Stand: 2026-10-03, Spitze `bf8af90` plus dieser Commit;
> die Zeilennummern gelten für diesen Stand. Gefunden mit `grep -rn LOESCHVERMERK` (ohne `node_modules`).
> Vor dem Löschen: `pnpm verify` — eine Datei mit einem entfernten Import-Vermerk muss ihn ersetzen.

| # | Datei:Zeile | Inhalt kurz | Empfehlung | Begründung |
|---|---|---|---|---|
| 1 | `packages/ai/src/consolidate.ts:97` | alte `consolidateCommands` (Stapel statt Einheiten, ohne Rolle, eine Gruppe je Provinz), rund 50 auskommentierte Zeilen | **LÖSCHEN** | Von T-M42-08 ersetzt und durch K1–K10 in `decide.test.ts` abgedeckt; die alte Fassung steht in `3e3f850^` in git. Der Befund (Stapel zählen, Deckel überschritten) steht in `PROBLEME.md`. |
| 2 | `packages/ai/src/consolidate.ts:23` | Satz im Kopfkommentar „Die alte Fassung (unten als LOESCHVERMERK) …“ | **KÜRZEN** | Mit Nr. 1 wird „unten als LOESCHVERMERK“ falsch; auf „in git, `3e3f850^`“ umstellen, den Befund-Satz behalten. |
| 3 | `packages/ai/src/consolidate.ts:86` | „eine Provinz je Denkschritt“ (`if (commands.length > 0) break`) mit Begründung | **KÜRZEN** | Die Zeile `break` ist tot und durch Z1/Z2/K7 abgesichert; die Begründung (Paare über zwei Tagesenden, m17 Stufe F: 28) ist der Beleg für D32.10 und bleibt als Satz. |
| 4 | `packages/ai/src/military.ts:156` | alte Fassung der Batterie-Bedingung (`nurFernwaffen` ausgeschrieben) | **LÖSCHEN** | Verhaltensgleich in `army-role.ts`, getestet in `army-role.test.ts` R1–R5 und B6c (`m42-zaehlung.test.ts`). Drei Zeilen, kein Informationsverlust. **Die andere Sitzung fasst `military.ts` an; erst nach deren Merge löschen.** |
| 5 | `apps/headless/test/m42-zaehlung.ts:59` | alter Zwilling `istBatterie` (Wortlaut von `military.ts`) | **LÖSCHEN** | Der Zwilling liest `isBattery`; der alte Wortlaut ist in Nr. 4 und in git. Danach auch den Kopfkommentar (Z. ~43, „Zwilling von `military.ts:155-157`“) und das `Rolle`-Docblock berichtigen — beide nennen den Wortlaut-Wächter B6, den es nicht mehr gibt. |
| 6 | `apps/headless/test/m42-zaehlung.test.ts:106` | alter Fall B6, Wortlaut-Wächter per `readFileSync` gegen `military.ts` | **LÖSCHEN** | Ein Quelltext-Grep prüft Schreibweise, nicht Verhalten; er fiel mit T-M42-08 weg. Ersatz: B6c. |
| 7 | `apps/headless/test/m42-zaehlung.test.ts:122` | alter Fall B6b, zwei `includes()` auf Quelltext | **LÖSCHEN** | Wertlos (Review-Punkt 6): faellt bei jeder Umbenennung, ohne dass sich Verhalten ändert, und besteht, wenn die Zeile nur im Kommentar steht. **Ersetzt durch B6c** (Verhalten: Zähler und `militaryCommands` urteilen für Batterie/Linie gleich; Mutation in `military.ts` lässt B6c rot werden). |
| 8 | `apps/headless/test/m42-zaehlung.test.ts:1` | auskommentierter Import `readFileSync` | **LÖSCHEN** | Seit Nr. 6/7 ungenutzt (Lint). Nur zusammen mit Nr. 6 und 7 löschen. |
| 9 | `packages/ai/src/decide.test.ts:720` | alte Erwartung von K7 (`[['b1','b2']]`, eine Provinz je Denkschritt) | **LÖSCHEN** | Eine Zeile; die neue Erwartung (zwei Provinzen) steht darunter, der Testname sagt es jetzt selbst. |
| 10 | `docs/plan/WORKFLOW.md:42` | Kommentarblock mit dem Kopf von Etappe 1 (Stand 2026-09-27, „nur noch acceptance“) | **LÖSCHEN** | Vollständig überholt (PR #13 gemerged, Abnahme 12/12); Wortlaut in git. Der neue Kopf trägt die Fakten. |
| 11 | `docs/plan/WORKFLOW.md:115` | Kommentarblock „Die Spitze liegt auf `main`“ (PR #13) | **LÖSCHEN** | Falsch für den Zweig; die richtige Aussage steht in §0. Beim Merge nach `main` §0 ohnehin neu schreiben (Falle 1). |
| 12 | `docs/plan/WORKFLOW.md:126` | Kommentar „vorher `git switch main && git pull --ff-only`“ | **LÖSCHEN** | Gleicher Grund wie Nr. 11. |
| 13 | `docs/plan/WORKFLOW.md:218` | Marker über dem berichtigten Zwischenstand vom 2026-10-03 (alt: „T-M42-08/-09 hängen an der Antwort“) | **KÜRZEN** | Der Absatz selbst ist berichtigt; nur der Marker mit dem alten Wortlaut kann weg. |
| 14 | `docs/research/_raw/probe/economy-I1.ts:265` | alte `TARGET_MIX` 50/30/20 | **BLEIBT** | Rohdaten der Messsonde zu Befund M42-07-a; wer die Messung wiederholt, braucht die Ausgangsfassung. Die Sonde ist Archiv, kein Produktivcode. |
| 15 | `docs/research/_raw/probe/economy-I1.ts:298` | alte `rankedUnitsFor` (Stapelzählung) | **BLEIBT** | Dasselbe: Ausgangsfassung der Sonde. |
| 16 | `docs/research/_raw/probe/economy-I1.ts:530` | alte Zeile `nurPanzerDavor`, zweite Iteration M42-07-a | **BLEIBT** | Belegt, welche Iteration was änderte (drei Iterationen, Entscheid in `DECISIONS.md`). |
| 17 | `docs/research/_raw/probe/FS.patch:12, 27, 203, 228, 257` | fünf Vermerke in einem Patch-Archiv (T-M42-04) | **BLEIBT** | Ein Patch trägt seine Vermerke als `+`-Zeilen; sie zu entfernen heißt, den Patch zu ändern. T-M42-04 ist zurückgestellt, der Patch ist die Grundlage für die Wiederaufnahme. |
| 18 | `docs/plan/tasks.yaml:3722, 3732` | Wort „LOESCHVERMERK“ in den `dod`-Texten von T-M42-08/-09 | **BLEIBT** | Prosa über den Vermerk (Beleg des Baus), kein Block. Fällt von selbst weg, wenn Nr. 1/3/4/5/6 gelöscht sind — dann den Satz in der `dod` auf „(Vermerke freigegeben und gelöscht am …)“ ergänzen, nicht streichen. |

**Kein Vermerk, aber ebenfalls nicht gelöscht:** `01-REQUIREMENTS.md` (Vermerk „unerfüllt“ unter R-AI-10/AK1,
„nicht nachprüfbar“ bei R-AI-12/AK3), `03-TASKS.md` (T-M42-08: Abhängigkeit auf T-M42-06 umgestellt, M18-Notiz
zur Einschiffung), `tasks.yaml` (T-M42-08 `deps`), `DECISIONS.md` (Nachtrag 2026-10-03), `PROBLEME.md`
(Befund M42-PL-a) — das sind Berichtigungen und Ergänzungen, keine Löschkandidaten.

- 2026-10-03 (Bahn K): `docs/plan/01-REQUIREMENTS.md` R-AI-12/AK4 — abgeschwächter Wortlaut (61d1477, "Vorrats-Horizont") ersetzt durch den alten Wortlaut; der alte Text steht als HTML-Kommentar mit LOESCHVERMERK dort. Grund: T-M42-14 zurückgenommen (H1–H3), kein Wort von Noah (E1).
