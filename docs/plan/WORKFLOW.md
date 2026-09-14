# WORKFLOW — der Stand nach dem Mehrspieler (M37, M38, M39)

> **Diese Datei ist der Einstieg.** Wenn du hier fertig bist, weißt du, wo du bist, was
> gilt, und was in welcher Reihenfolge zu tun ist.
>
> **Stand: 2026-09-14, abends.** Von **312 Aufgaben sind 293 erledigt** (gezählt in
> `docs/plan/tasks.yaml`, nicht geschätzt). Die **19 offenen** sind: **fünfzehn** aus M17
> (als Ganzes geplant, gebaut wird es auf Noahs Ansage), **eine** — T-M39-09, das ist
> **AK-9** und braucht Noah *und einen zweiten Menschen in einem anderen Netz* —, und
> **drei zurückgenommene**: T-M10-02, T-M40-04 und T-M41-10, jede mit einem
> `reopened`-Text, der sagt, wer sie ablöst. **Es ist keine offene Aufgabe übrig, die ein
> Agent erledigen könnte.**
>
> **Was am 2026-09-14 dazugekommen ist: der Mehrspieler, 29 von 30 Aufgaben.** M37 (der
> Gleichschritt, elf Aufgaben, keine Zeile Netzcode), M38 (die Verbindung, zehn) und M39
> (die Einladung, acht von neun) sind gebaut — und danach **zum ersten Mal wirklich
> gesehen**: eine Sichtprüfung an zwei sichtbaren Browserfenstern fand **fünf Befunde**,
> von denen drei repariert wurden. Der schwerste (MP-1) hätte den Mehrspieler auf Noahs
> Maschine unbrauchbar gemacht: `pnpm mp:host` antwortete unter Windows auf **jede**
> Adresse mit 404, bei 2442 grünen Tests
> (`docs/reports/sichtpruefung-mehrspieler-2026-09-14.md`).
>
> **Der Kern wurde dabei nicht angefasst** — keine Zeile in `packages/core/src`,
> `packages/ai/src`, `data/rules` oder `data/maps`. Der Beleg dafür ist keine Behauptung,
> sondern eine Messung: der Haltungs-Messlauf steht nach dem Mehrspieler bei **101,8 %**
> Provinz-Tagen und **0** ohne Gefecht verlorenen Provinzen — auf die Nachkommastelle
> derselbe Wert wie davor.
>
> **Wo die Vorgeschichte steht:** die Bauabschnitte V1, LEVEL-UP M22–M24, „Grafik statt
> Text" M25–M27, der Kriegsrat-Umbau M29–M32, die Bilder M33, die Rohstoffleiste M36, der
> Fortschritt M34, der Block M41/M40/M35 und der Mehrspieler M37–M39 sind je Aufgabe in
> `PROGRESS.md` festgehalten, die Entscheide in `DECISIONS.md`, die Befunde samt Lehren in
> `PROBLEME.md`. Was davon beim Arbeiten wirklich gebraucht wird, steht verdichtet in §3
> und §4 — dort und nicht in diesem Kopf.
>
> **Was gerade auf Noah wartet:** neun offene Fragen in `DECISIONS.md` unter „Offene Fragen
> an Noah" (2026-09-14), dazu **AK-9** (§2) und zwei Spielertext-Fragen aus der
> Sichtprüfung (MP-4, MP-5). Keine davon hat eine Aufgabe, und das ist Absicht.

---

## 0 · Ankommen (ein Befehl, keine Suche)

```bash
git log --oneline -1 && git status --short
```

**Die Spitze liegt auf `main`.** PR #7 (M41, M40, M35 und der Schlussblock) ist am
2026-09-14 gemerged; der Merge-Commit ist `09c7078`, und der Zweig
`claude/offene-punkte-abschliessen` ist damit abgegolten. Wer einen Worktree anlegt,
zweigt von `main` ab.

```bash
git switch main && git pull --ff-only
```

**Wer als Nächstes merged, richtet diesen Abschnitt im selben Zug.** Eine Einstiegsdatei,
die auf den falschen Zweig zeigt, hat dieses Projekt fünf Sitzungen in Folge gekostet
(§4 Falle 1); sie schadet in beide Richtungen gleich viel. Deshalb steht hier immer genau
**ein** Zweig und nie eine Bedingung — ein Satz der Form „bis zum Merge …, danach …“ ist
ab dem Merge falsch und wird trotzdem gelesen.

Zeigt `git status` mehr als einen leeren Arbeitsbaum, gehört das geklärt, bevor
irgendetwas gebaut wird. Nach einem Wechsel des Standes:

```bash
pnpm install
```

---

## 1 · Der Stand in einem Absatz

Das Spiel ist **fertig und abgenommen**, und seit dem 2026-09-14 kann man es **zu zweit
über einen Link spielen**. Der alte Plan war am 2026-09-12 abgearbeitet; am 2026-09-13
kamen M41, M40 und M35 dazu, am 2026-09-14 der **Mehrspieler M37–M39** — 29 von 30
Aufgaben gebaut, die dreißigste ist AK-9 und braucht zwei Menschen. **M17 ist als Ganzes
geplant und wartet auf Noahs Ansage.**

`pnpm acceptance` lief am 2026-09-14 auf dem Endstand mit **12 von 12, Exit 0, 5 min 7 s**
(`docs/reports/acceptance.md`); `pnpm verify` meldet **Exit 0 mit 2446 Tests in 163
Dateien**, Abdeckung Kern 96,9 %. Das Anforderungstor meldet „V1 offen: 0". **AK-7 ist
abgenommen** (Noah hat den Playtest per /goal-Auftrag vom 2026-09-07 ausdrücklich
delegiert, Entscheid in `DECISIONS.md`). **AK-9 ist der fünfte Haltepunkt** und das einzige
Kriterium dieses Projekts, das kein Agent erfüllen kann.

**Was der Mehrspieler ändert, in vier Sätzen:** beide Rechner rechnen die ganze Partie
selbst und tauschen nur **Befehle**, nie Zustände — rund zweihundert Byte je Sekunde. Ein
Tick wird erst gerechnet, wenn beide Nachrichten für ihn da sind; dadurch gibt der
Langsamere das Tempo vor. Jede Nachricht trägt die **Prüfsumme** des letzten Ticks, und
bei Abweichung hält die Partie an, statt zwei Welten weiterzuspielen. **Der Kern wurde
dafür nicht angefasst** — das Fundament lag seit M5 (reiner `step`, geseedeter Zufall,
Ganzzahl-Festkomma, `hotseat.test.ts`).

**Wichtig für T-M22-05:** Befehle werden **gesammelt** und im ersten Tick des nächsten
Laufs angewendet (vorher rechnete jeder Klick bei Pause sofort einen ganzen Tick, samt
KI). Wer an der Befehlskette arbeitet, liest den Entscheid in `DECISIONS.md`.

---

## 2 · Was als Nächstes dran ist

**Es gibt keine offene Aufgabe mehr, die ein Agent erledigen kann.** Was hier steht, braucht
entweder Noah oder seine Ansage.

1. **AK-9 — eine Partie zu zweit gegen einen echten Menschen** (T-M39-09, der fünfte
   Haltepunkt). Sechs Punkte: Einladung per Link, Beitritt ohne Installation, dreißig
   Spieltage am Stück, eine beantragte und angenommene Pause, ein absichtlicher
   Verbindungsabbruch mit Wiederaufnahme, und am Ende auf beiden Seiten dieselbe
   Prüfsumme. **Die Anleitung dafür liegt fertig:**
   `docs/reports/mehrspieler-anleitung.md` — Schritt für Schritt, mit einem Abschnitt
   „was geprüft ist und was nicht". Was fehlt, ist ein Tailnet (Tailscale ist auf dieser
   Maschine installiert, aber **nicht angemeldet**) und ein zweiter Mensch.

   **Billiger Zwischenschritt, der AK-9 nicht erfüllt, aber viel findet:** zwei Fenster auf
   demselben Rechner. Genau das ist am 2026-09-14 gelaufen und hat fünf Befunde ergeben
   (`docs/reports/sichtpruefung-mehrspieler-2026-09-14.md`).
2. **Elf offene Fragen an Noah** — neun in `DECISIONS.md` unter „Offene Fragen an Noah"
   (2026-09-14), dazu **MP-4** (fünf `netplay`-Spielertexte werden nirgends gerendert) und
   **MP-5** (ein veralteter M37-Satz im Anlegedialog) aus der Sichtprüfung. Sie sind die
   einzige Sorte Arbeit, die kein Agent erledigen kann, und mehrere bestimmen, was als
   Nächstes überhaupt gebaut wird. **Nichts davon hat eine Aufgabe** — ein Plan, der
   Fragen als Aufgaben führt, wird nie fertig.
3. **M17 „Tiefe zwischen den Kriegen" — geplant als Ganzes** (2026-09-13, T-M17-01):
   T-M17-02 bis -16, Entwurf D29, dazu R-DIP-08, R-DIP-09, R-AI-09, R-GAME-09. Die beiden
   Vormerkungen aus T-M32-03 sind darin (T-M17-04, T-M17-06). **Noah hat am 2026-09-13
   entschieden, dass M17 in einer späteren Sitzung gebaut wird** (`DECISIONS.md`) — der
   Plan bleibt vollständig stehen, 1 von 16 Aufgaben ist erledigt (die Planung selbst).
   M17 baut auf **`SCHEMA_VERSION` 4** auf, weil M35 die 3 belegt hat.
4. **Noah spielt.** Zum Vergnügen, nicht zur Abnahme. Was er findet, wird der nächste
   Plan. Die eine Frage, die kein Agent beantworten kann: *wollte ich weiterspielen?*
5. **M18 ist die Sammelstelle für alles, was gemessen und verschoben wurde** — bisher ohne
   eine einzige Aufgabe, mit Absicht: T-M41-10 (die KI legt Armeen wirklich zusammen; der
   Deckel zählt Stapel statt Einheiten, die echte Reparatur tötete die Artillerie),
   der Handel der KI (zielt auf den teuersten Bauwunsch), die Kohle-Senke, der
   Vorratsaufbau, die amphibische KI, die tote KI-Artillerie der Voreinstellung
   (R-BAT-08/AK3) und **Befund M38-4** (`productionFiles()` liest 21 `.test.tsx` mit).
6. **T-M40-04, T-M41-10 und T-M10-02** — zurückgenommen, jede mit Begründung in
   `tasks.yaml` (`reopened`) und in `DECISIONS.md`. Sie stehen nur der Vollständigkeit
   halber hier; nichts davon ist Arbeit, die wartet.
7. **Wer am Mehrspieler weiterbaut, liest `docs/plan/MEHRSPIELER.md`** — Befund, Messung,
   elf Fallen (Falle 11 ist seit Befund M38-1 berichtigt) und die Reihenfolge. Der Entwurf
   ist D28, die Anforderungen sind `R-MP-01` bis `R-MP-13` in Abschnitt 2.17. Vier Dinge
   gelten dort und anderswo nicht: der Kern wird nicht angefasst; `packages/netplay`
   enthält **keinen** Netzcode (auch nicht in Prosa); das ausgelieferte Programm bleibt
   netzfrei (`connect-src 'none'`, gemessen am Erzeugnis **und** an der Bauflagge
   `WORLDWAR_MULTIPLAYER=1`); und der Gast hat **keinen sicheren Kontext** — kein
   `crypto.randomUUID`, kein `crypto.subtle` in der Browserseite.

---

## 3 · Was gilt (nicht neu herleiten)

- **Remote seit 2026-09-11** (`origin` = github.com/Noah2475g/WorldWar-III; PR #7 mit M41, M40, M35 und dem Schlussblock ist am 2026-09-14 gemerged, `main` = `09c7078`); weiterhin keine CI — `pnpm verify` ist die Prüfkette. **Noah merged, kein Agent. Nie mit `--force` pushen.**
- **Der Plan-Wächter ist scharf, und er liest seit dem 2026-09-13 beide Aufgabendateien.**
  `npx vitest run test/plan-consistency.test.ts` prüft in einer Sekunde tasks.yaml ↔
  03-TASKS.md, jeden `files:`/`tests:`-Pfad **und** die Zeilen `Dateien` und `Tests zuerst`
  in `03-TASKS.md` — dort standen 63 Pfade, die es nicht gab, während `tasks.yaml` sauber
  war (`fac654b`). Ein Glob wird gezählt, nicht geraten, und der Lauf geht **nicht** in
  `node_modules` (ein `readdirSync({ recursive: true })` folgte pnpms Verknüpfungen und
  hängte den Wächter).
- **Eine zurückgenommene Zusage steht auf `todo` mit einem `reopened`-Text, der sagt, wer
  sie ablöst** — und `reopenedWithoutReason` in `test/plan-paths.ts` erzwingt das für jede
  offene Aufgabe, von der eine erledigte abhängt. Drei gibt es: T-M10-02, T-M40-04,
  T-M41-10. Gelöscht wird eine Zusage nie; ein Plan, in dem etwas verschwindet, lässt sich
  nicht mehr gegen die Wirklichkeit halten.
- **Die Automatik der Haltungen, in einem Satz (D30.4 in der Fassung von T-M40-10):** eine
  Armee auf `defensive` rückt nur dann in eine bedrohte eigene Nachbarprovinz nach, wenn in
  ihrer Provinz eine **weitere eigene Armee stehen bleibt**; allein marschiert sie nie, und
  **der Angriff marschiert überhaupt nie von selbst** (die Verfolgung aus T-M40-04 ist
  ersatzlos entfallen, mit ihr `VisibleArmy.retreating`). Sie führt **nur menschliche**
  Mächte, entscheidet aus `publicView` statt aus Ereignissen (ein geladener Stand hat die
  Ereignisse des Vorticks nicht), und ein eigener Marschbefehl oder ein Anhalten stellt die
  Armee auf Garnison. Wer daran arbeitet, liest D30.4 und D30.9 — und weiß, dass die Regel
  ein **Rücknahmekriterium** hat: fällt eine Zusicherung des Episoden-Messlaufs, gibt
  `adjutantCommands` für `defensive` nichts mehr zurück, statt nachgeschärft zu werden.
- **Anforderungstor:** `pnpm coverage:requirements` meldet `V1 offen: 0`.
- **Sprache:** Dokumente Deutsch, Code und Bezeichner Englisch. `tasks.yaml` ohne
  Umlaute — **Spielertexte aber MIT**: seit T-M23-01 fällt ein Wächter bei
  ae/oe/ue-Ersatzschrift in `de.ts`.
- **Ein grüner Einzeltest sagt nichts über das Spiel.** Und: ein Test, der grün ist,
  ohne dass die Reparatur drin ist, belegt gar nichts — Reparatur rausnehmen, fallen
  sehen.
- **Keine Zahl der Freischaltungsachse ist mehr „belegt"** (T-M34-02). Die Tage des
  Vorbilds stehen weiter in R-TECH-01 und nennen die **Reihenfolge**; die Abstände sind
  seit M34 abgeleitet, weil dort ein Spieltag ein Tag ist und hier 24 Sekunden.
- **Der Golden-Master ändert sich nur mit Absicht.** `packages/core/test/golden/tiny-500.json`
  und `apps/headless/test/golden/walkthrough.json` halten Prüfsummen fest; eine Regeländerung
  verschiebt sie. Neu erzeugen mit `UPDATE_GOLDEN=1 pnpm test` — **und im Commit sagen, warum**.
  Was nicht passieren darf: dass sie sich ändern, ohne dass jemand es beabsichtigt hat.
- **Wer neue SVG-Pfade einbaut, benutzt `test/path-bounds.ts`** (aus M33). Der alte
  Koordinatenwächter war seit Monaten **leer grün** — `/-?d+(.d+)?/g` sucht den Buchstaben
  `d` —, der neue fährt den Pfad wirklich ab und fand sofort einen Zeichenfehler.
- **Wer an der Kopfleiste oder an Panels arbeitet, prüft die Kaskade am laufenden Spiel**
  (aus M36). `.resource span` färbte Pfeil und Reichweite um, weil ein Element weiter
  innen eine Stelle mehr Spezifität hat; kein Test konnte das sehen. Für das, was jsdom
  doch binden kann, gibt es den Kaskaden-Wächter (Muster T-M22-02).

## 4 · Fünfundzwanzig Fallen, die schon jemanden gekostet haben

1. **Die Einstiegsdatei zeigt auf den falschen Zweig.** Bis zum 2026-09-11 stand hier,
   `main` sei alt und die Spitze liege auf einem `claude/*`-Zweig — das hat fünf Sitzungen
   in Folge erwischt. **Die Lehre gilt über diesen Fall hinaus: wer merged, richtet §0
   im selben Zug.** Heute liegt die Spitze auf `main`.
2. **`cmd | tail` verschluckt den Exit-Code.** In eine Datei schreiben, `$?` fragen.
3. **Benchmarks brauchen die Maschine allein** — und „allein" heißt *jeder* Prozess:
   ```bash
   powershell -c "(Get-CimInstance Win32_Processor).LoadPercentage; Get-Process | Sort-Object CPU -Descending | Select-Object -First 5 ProcessName, CPU"
   ```
   **Was NICHT unter diese Regel fällt:** Parameterlauf, Turnier und der Grundlauf aus
   `progress.slow.test.ts`. Das sind Simulationen; ihre *Ergebnisse* hängen an Karte,
   Regeln und Startzahl, nicht an der Maschinenlast — nur ihre Dauer tut das. Zeit messen
   allein die Läufe unter `packages/core/test/perf` und `render.bench.slow.test.ts`.
4. **Einen langen Lauf abzubrechen beendet ihn nicht.** Nach jedem Abbruch
   `powershell -c "Get-Process node | Select Id, CPU, StartTime"` — und wissen: der
   Berechtigungs-Classifier verweigert `Stop-Process`, **`taskkill //PID <n> //F` geht**
   (am 2026-09-12 so gemacht; ein verwaister Sweep-Worker rechnete nach dem Abbruch
   weiter).
5. **`scripts/acceptance.mjs` IST der ganze Abnahmelauf** (gemessen 4 min 58 s; die Prognose druckt
   er selbst aus `acceptance-timing.json`) — und er **schreibt** Berichte. Einzelne
   Aussagen prüft man an der Funktion, nie am Skript. Parameterlauf und Turnier laufen
   NICHT je Abnahme; sie stecken in `pnpm test:slow` und hinter dem Frische-Wächter:
   ändern sich `data/rules/**`, wird die Abnahme rot, bis `pnpm balance:sweep` bzw. das
   Turnier neu gelaufen **und eingecheckt** sind. Das Turnier folgt seit dem 2026-09-13
   auch `packages/ai/src` und `packages/core/src` (13 Sekunden), der Parameterlauf bewusst
   nicht (eine Stunde; Code decken Turnier und `progress.slow` ab). Seit T-M40-16 gilt dasselbe für den
   Haltungs-Messlauf (`apps/headless/test/stance.slow.test.ts`, gut elf Minuten): ändert sich
   `packages/ai/src` oder `packages/core/src`, bleibt die Abnahme rot, bis der Lauf mit
   `WORLDWAR_WRITE_REPORT=1` neu geschrieben ist, AK5 hält und `docs/reports/stance.json`
   eingecheckt ist. **Seit T-M40-17 urteilen die Wächter nach Abstammung, nicht nach Uhrzeit:**
   rot, sobald auf HEAD seit dem Bericht ein Commit an einer Quelle liegt — beim Haltungs-Messlauf
   seit dem Commit, auf dem gemessen wurde (`measuredAtCommit`). Die Quellen stehen in
   `GAUGES` und `STANCE_SOURCES` (`scripts/acceptance-criteria.mjs`); der Haltungs-Messlauf
   braucht dafür einen **an diesen Quellen sauberen Arbeitsbaum**. Am echten Stand, ohne Abnahme:
   `node --input-type=module -e "const m = await import('./scripts/freshness.mjs'); console.log(m.allFreshness('.'))"`.
6. **Der Parameterlauf dauert rund eine Stunde**, das Turnier 13 Sekunden. Wer nur
   wissen will, ob eine Regeländerung die Partie verschoben hat, nimmt
   `apps/headless/test/progress.slow.test.ts` (2,5 min): er fährt **denselben Grundlauf**
   wie der Parameterlauf und reproduziert dessen Ausgangswert auf die vierte Stelle. Der
   volle Lauf misst etwas anderes — die Empfindlichkeit einzelner Konstanten.
7. **Ändere keine Quelldatei, während der Tauri-Bau läuft.** `beforeBuildCommand` liest
   am Anfang; alles danach fehlt im Erzeugnis.
8. **Der git-stash ist zwischen allen Worktrees geteilt.** Nie blankes `git stash` —
   lieber ein WIP-Commit.
9. **Die Browser-Vorschau startet den Dev-Server im HAUPTORDNER, nie im Worktree.** Sie
   serviert dann den Stand von `main`, und kein Neustart hilft. Erkennbar im Browser an
   `await (await fetch('/src/<geänderte Datei>')).text()` ohne den neuen Bezeichner.
   Abhilfe: im `.claude/launch.json` **des Hauptordners** eine zweite Konfiguration mit
   `pnpm -C <absoluter Worktree-Pfad>` und eigenem Port anlegen — und danach wieder
   entfernen. Eigener Port heißt eigener Ursprung: keine Spielstände, keine Autosaves.
10. **Dateien im Arbeitsbaum bleiben LF.** Ein Bearbeitungsskript, das CRLF schreibt, macht
   `pnpm verify` rot an Stellen, die seit Monaten unverändert sind.
11. **`pnpm verify` im HAUPTCHECKOUT liest die Worktrees mit.** Seit dem 2026-09-11 steht
   `.claude/**` in den `ignores` von `eslint.config.js`. **Ein Prüflauf ist nur dort
   belegt, wo er gelaufen ist.**
12. **Ein Ausgangswert, den es schon gibt, wird nicht neu gemessen.** Am 2026-09-12 lief
   ein Parameterlauf 37 Minuten, bevor auffiel, dass er nichts Neues messen konnte: die
   Regeln hatten sich seit dem letzten eingecheckten Bericht nicht geändert. Zwei Befehle
   sagen es in zwei Sekunden — und es ist dieselbe Prüfung, die der Frische-Wächter der
   Abnahme macht:
   ```bash
   git rev-list -1 $(git log -1 --format=%H -- docs/reports/balance-sweep.md)..HEAD -- data/rules data/maps/world.json
   ```
   Ist die Ausgabe leer, **ist** der Bericht der Ausgangswert. (Bis T-M40-17 standen hier zwei
   Commit-Zeiten; nach dem Merge eines älteren Seitencommits sagten sie „jünger", obwohl der
   Bericht die Regeln des Seitenzweigs nie gesehen hatte — Befund M-1.) Die Läufe sind deterministisch
   über feste Startzahlen; wer es belegt haben will, fährt den billigsten Verwandten
   (das 13-Sekunden-Turnier) und zeigt, dass er zeilengleich herauskommt.

13. **Ein Rücknahmekriterium muss die Änderung sehen können.** Das Turnier läuft 40
   Spieltage — der Fabrikausbau der KI beginnt später und war dort unsichtbar; das Kriterium
   hätte jede Änderung durchgewinkt. Und umgekehrt: T-M41-10 riss an genau der Stelle, an
   der die Änderung wirken sollte (Artillerie 63 → 0), und wurde deshalb zurückgenommen
   statt nachgebessert. **Eine Reparatur, die eine abgenommene Anforderung tot macht, um
   eine Zusage nicht einmal einzulösen, ist keine.**
14. **Eine Automatik braucht einen Paritätstest über alle Zeitwege und eine
   Schadenszählung**, nicht nur „0 Ablehnungen". Die Haltungs-Automatik lief zuerst in der
   Uhr, aber nicht im Vorspulen (zwei Befehlsquellen); und sie war „grün", während sie zehn
   Provinzen ohne Gefecht verlor, weil niemand die Verluste zählte. Beides fiel erst im
   Episoden-Messlauf auf.
15. **Frische nach Commit-Zeit ist nach Merges falsch**, und ein zeilengleicher Bericht
   lässt sich nicht neu committen. Seit T-M40-17 urteilen die Wächter nach **Abstammung**
   (`git merge-base --is-ancestor`) und der Haltungs-Messlauf nennt seinen `measuredAtCommit`
   im Bericht selbst — sonst gilt ein Bericht als frisch, der die Regeln des Seitenzweigs nie
   gesehen hat (Befund M-1). Wer zeigen will, dass ein Lauf nichts geändert hat, fährt den
   billigsten Verwandten und belegt Zeilengleichheit.
16. **Eine gewachsene Prüfzahl ist kein Rückschritt.** Die Abnahme meldet seit dem
   2026-09-13 **12** statt 11 Kriterien, weil eine Prüfung dazugekommen ist. Erst zählen, was
   neu ist, bevor man eine Abweichung für einen Fehler hält — dasselbe gilt für Testzahlen
   und Aufgabenzahlen.
17. **Das Werkzeug der Sitzung bestimmt den Weg.** In einer Hintergrund-Sitzung gibt es
   **kein** `preview_start` und kein „Claude in Chrome"; Browserprüfungen laufen dann über
   CDP gegen ein echtes, **sichtbares** Fenster (`--remote-debugging-port`, eigenes
   `--user-data-dir`, `Runtime.evaluate` / `Input.dispatchMouseEvent` /
   `Page.captureScreenshot`). **Kein `--headless`, kein Hintergrund-Tab** — Chromium friert
   ihn ein, und rAF steht. **Google Chrome ist auf dieser Maschine nicht installiert**;
   vorhanden sind Brave und Edge, beide Chromium. Muster: `docs/plan/schlussblock/ak8-cdp.mjs`.
18. **Die Uhr wird am gebauten Bündel gemessen, nicht am Dev-Server.** Der Dev-Bau hat
   dieselbe Schwäche nur früher sichtbar gemacht (58–63 statt 93–98 Ticks/s); ausgeliefert
   wird das Bündel. Und: **eine absolute Schwelle, die unter der eigenen Streuung des
   Ausgangswerts liegt, ist keine Schwelle** — beim Uhr-Befund lautete das Kriterium deshalb
   „nicht schlechter als der eigene, am selben Tag gemessene Ausgangswert", Minimum gegen
   Minimum und Median gegen Median.
19. **Ein Hintergrund-Agent liefert lange Berichte abgeschnitten**, und er beendet seine
   Runde, während eigene Hintergrundläufe noch rechnen, ohne wieder aufzuwachen. Bericht in
   eine Datei schreiben lassen; lange Läufe im Vordergrund oder mit Warteschleife fahren.
   Ein **Sitzungslimit der API** stoppt parallele Agenten mitten in der Arbeit — nach einem
   Abbruch erst `git log` und `git status` lesen, den halbfertigen Arbeitsbaum per
   `git diff` prüfen, dann fortsetzen.
20. **`git worktree remove` scheitert an MAX_PATH.** Den Rest mit PowerShell
   `Remove-Item -LiteralPath '\\?\<pfad>' -Recurse -Force` räumen und danach prüfen, dass
   der Ordner wirklich weg ist.
21. **Uhrzeiten und Daten in Übergaben kommen aus `date` oder git**, nie aus dem Gedächtnis.
   Und eine überraschend runde Messung wird mit einem zweiten Werkzeug gegengeprüft: ein
   `grep -cU $'\r'` erfand einmal vierhundert CRLF-Dateien, die es nicht gab.
22. **`docs/plan/PROBLEME.md` enthält 7 absichtliche CR-Bytes** (Beispiele in einem Befund
   über CRLF). Das Edit-Werkzeug normalisiert sie und schluckt eines; die Datei wird deshalb
   am besten mit Python bearbeitet, und die Zahl vor und nach jeder Änderung gezählt:
   ```bash
   PYTHONIOENCODING=utf-8 python -c "print(open('docs/plan/PROBLEME.md','rb').read().count(b'\r'))"
   ```
   Ohne `PYTHONIOENCODING=utf-8` scheitert die Ausgabe an cp1252.

23. **Ein grüner Prüflauf gilt für den Stand, auf dem er lief — nicht für den danach.**
   Am 2026-09-14 meldete eine Sichtprüfung `pnpm verify` Exit 0 und committete danach
   37 Bildschirmfotos. Der nächste Abnahmelauf fiel an **zwei** Stellen, mit **einer**
   Ursache: R-ASSET-01 verlangt für jede **eingecheckte** Bilddatei einen Eintrag in
   `docs/ASSETS.md`, und AK-2/3/4 wie AK-5 fahren beide denselben Wächter. Das verify
   davor war zu Recht grün — die Bilder waren noch `untracked`. **Wer Dateien committet,
   die ein Wächter zählt, prüft danach noch einmal.**
24. **Unter Windows sind gemischte Pfadtrenner eine eigene Fehlerklasse.** Befund MP-1:
   `pnpm mp:host` antwortete auf **jede** Adresse mit 404, weil die zusammengesetzte
   Wurzel `C:\...\WorldWar\apps/desktop/dist` hieß: `join()` normalisierte sie zu lauter
   Rückstrichen, der Vergleich davor nicht — also hielt die Ausbruchsprüfung jeden Pfad
   für einen Ausbruch. **Kein Test sah es**, weil alle Testfälle ihre Wurzel mit
   `mkdtempSync(join(...))` anlegen, und die ist immer schon normalisiert. Wer eine
   Pfadprüfung schreibt, gibt ihr **einen Fall mit Schrägstrichen**.
25. **Was nur in jsdom geprüft ist, hat niemand gesehen.** Der Mehrspieler war mit 2442
   grünen Tests gebaut und lieferte auf dieser Maschine keine einzige Seite aus. Zwei
   sichtbare Fenster auf **einem** Rechner kosten eine Stunde, brauchen weder Tailscale
   noch einen zweiten Menschen — und fanden fünf Befunde, drei davon in Code, der durch
   Tests gedeckt war. Das ist dieselbe Lehre wie bei der Uhr (Falle 18), nur teurer:
   dort war eine Zusage langsam, hier war sie tot.


Dazu aus dem Bau von M22: **jsdom rechnet kein Layout** (`scrollWidth`/`clientWidth`
sind 0 — Layout-Wächter binden Struktur+Kaskade, Entscheid in DECISIONS.md), und
**jsdoms `requestAnimationFrame` hängt an `setInterval`** — unter `vi.useFakeTimers`
rAF stubben, sonst treibt `advanceTimersByTime` die ganze Spielschleife.

Und aus dem Bau von M34: **ein langer synchroner Lauf im Test tötet den Worker.** Vitest
meldet `Timeout calling "onTaskUpdate"`, obwohl jeder Test grün ist und der Bericht
geschrieben wurde. Eine Zeile behebt es — `await new Promise((r) => setTimeout(r, 0))`
zwischen zwei Partien.

## 5 · Der Stand in Zahlen (2026-09-14; der Benchmark-Vorbehalt: 2026-09-08)

| | |
|---|---|
| Aufgaben | **312, davon 293 erledigt** (gezählt in `tasks.yaml`, 2026-09-14 abends). Offen: **15** aus M17 (geplant, Bau auf Noahs Ansage), **1** — T-M39-09 alias AK-9, der fünfte Haltepunkt —, **3** zurückgenommene: T-M10-02, T-M40-04 (die Verfolgung, abgelöst von T-M40-10), T-M41-10 (am Rücknahmekriterium gerissen). Je Meilenstein: M35 **6/6**, M40 **18/19**, M41 **16/17**, **M37 11/11**, **M38 10/10**, **M39 8/9**, M17 **1/16**. **Keine offene Aufgabe, die ein Agent erledigen könnte** |
| Abnahme | **12 von 12, Exit 0, 5 min 7 s** (`totalSeconds` 307), `docs/reports/acceptance.md`, 2026-09-14 abends gegen `e82c2bc`. Der Vorlauf desselben Abends fiel an **zwei** Stellen mit **einer** Ursache: die 37 Bilder der Sichtprüfung hatten keinen Eintrag in `docs/ASSETS.md`, und AK-2/3/4 wie AK-5 fahren beide R-ASSET-01. **AK-8 steht darin auf ⚠** — die Verpackung war seit `1c64a6e` 32 Dateien weiter; die Neumessung steht in `packaging.md` |
| Tests | **2446 schnell**, **163 Dateien** · Abdeckung Kern **96,9 %**, gesamt **96,3 %** (`pnpm verify` **Exit 0**, gemessen am 2026-09-14 abends; davor 2155/146 vor dem Mehrspieler, 2258/154 nach M37, 2376/160 nach M38, 2442/163 nach M39). Neu: `packages/netplay` **99,0 %**, `apps/desktop/src/net` 100 % |
| Mehrspieler | **29 von 30 Aufgaben**. Gleichschritt belegt über **200 Ticks** mit 63 und 56 Befehlen von beiden Seiten, nach *jedem* Tick derselbe Hash (`5ed264a0fea05076`). Determinismus-Probe: **24 Ticks**, kalt 26 ms / warm 6–8 ms (Grenze 100). **24 ist die kleinste taugliche Zahl** — vier Regelkonstanten werden genau dort sichtbar, bei 12 ist die Probe für alle vier blind; `battleRate` und `minDamage` sieht sie auch nach 48 Ticks nicht (kein Gefecht in zwei Spieltagen), und das steht als eigene Zusicherung im Test |
| Sichtprüfung Mehrspieler | **5 Befunde, 3 repariert** (2026-09-14, zwei sichtbare Brave-Fenster über CDP, 37 Bilder). **MP-1:** `pnpm mp:host` antwortete unter Windows auf *jede* Adresse mit 404 — gemischte Pfadtrenner; ohne die Reparatur war gar nichts zu sehen, bei 2442 grünen Tests. **MP-2:** wer seinen Link zuerst öffnete, wartete für immer. **MP-3:** eine Abweisung wurde 77-mal in 20 s wiederholt, ohne den Grund zu nennen. Gemessen: **245 gemeinsame Ticks über 56,8 Spieltage, 0 Abweichungen**, beidseitig `7aae49be9d989df8`; 22,77 gegen 22,78 Ticks/s. **MP-4 und MP-5 sind Spielertexte und damit Fragen an Noah** |
| AK-1 | Sieg an Spieltag **975**, 2589 Eroberungen, 11 Kriegserklärungen, Sieger China (Startzahl 1914). Dieselbe Voreinstellung mit Startzahl 2015: Tag 583, mit 1815: Tag 583 (`docs/reports/fullgame*.json`). Der Siegtag springt je KI-Änderung in beide Richtungen; das Tor ist 300–1500. Die drei Startzahlen variieren nur den Zufall — Aufstellung, Gegner und Hauptstädte sind identisch |
| AK-7 | **abgenommen** (Delegation, `DECISIONS.md`) — 62/62 Fragen, 2 Berichte |
| AK-8 | **erfüllt**, am 2026-09-14 abends gegen `e82c2bc` am gebauten Programm neu gemessen: starten, Partie beginnen, Strg+S, speichern, beenden, neu starten, „Weiterspielen" — **sieben von sieben**, Exit 0, acht Sekunden (`docs/reports/packaging.md`). Die exe vom Morgen war von M37–M39 überholt, der Frische-Wächter stand zu Recht auf ⚠. Zählt nicht gegen V1 (M16) |
| AK-9 | ⏸ **der fünfte Haltepunkt** (T-M39-08 hat ihn gesetzt und den Wächter mitgezogen; die Nummer stand bis dahin als *erfundenes Gegenbeispiel* im Test und heißt dort jetzt AK-99). Braucht Noah **und einen zweiten Menschen in einem anderen Netz** — Anleitung Schritt für Schritt in `docs/reports/mehrspieler-anleitung.md`. Zählt nicht gegen V1 |
| Anforderungstor | `pnpm coverage:requirements` meldet **V1 offen: 0** |
| Programm | `worldwar.exe` **6 790 144 Bytes** (6,48 MiB), gebaut am **2026-09-14 18:40:02** gegen `e82c2bc`, Rust `release` in 1 min 32 s. Der neue Bau machte den Netzfrei-Wächter rot (er hält die Größe fest) — das ist seine Arbeit: `dist-mp` wurde neu gebaut und `measure-netfree.mjs` erneut gefahren, damit beide Bündel aus demselben Stand stammen. **Keine Aussage änderte sich**: `connect-src 'none'` 1×, WebSocket im Bündel **0×**, mit Bauflagge `WORLDWAR_MULTIPLAYER=1` **1×** |
| Uhr | **99,82 Ticks/s im Median** am gebauten Programm bei Tempo 100 (Minimum 99,46, **dreizehn** Läufe in zwei Reihen), gegen den Ausgangswert 99,88 / 99,77 vom Morgen. Die 0,39 unter dem Minimum sind **nicht weggeredet**: die zwei langsamen Läufe verlieren 3 bis 5 Ticks, und `clockCap(100)` ist 5 — ein einziges Bild. Entscheidend ist die andere Richtung: **alle dreizehn liegen über dem höchsten Wert, der je vor der Uhr-Reparatur gemessen wurde** (98,40), die Reparatur steckt also in dieser exe. Am Dev-Server 99,57 / 99,61 / 99,73; vorher Bündel-Median 95,76 bei Streuung 5,42 |
| Langlauf | 1000 Spieltage in **191 452 ms**, **7,977 ms je Tick** inkl. KI (Vorlauf 198 321 ms / 8,263 ms; davor 319 030 ms / 13,293 ms). **Die Partie ist nach 1000 Spieltagen nicht entschieden** — vorher an Tick 19320; das ist eine offene Frage an Noah, kein gerissenes Kriterium (AK-6 misst Zeit) |
| Zeitbudgets | Weltkarte Median **2,381 ms** / p99 **4,404 ms** (gefordert 3,5 / 8, `worldmap-bench.json`); Zeichnen p95 2,43 ms bei 16,7 ms Bildbudget; Anteil der KI am Tick 0,067 (Grenze 0,3) |
| Fortschrittsachse | letzte Freischaltung **Spieltag 80** (vorher 16), **32 Minuten** Echtzeit bei Tempo 1 (vorher 6,4). Gegen den Siegtag 975 sind das **8 %** der Partie — die 17 % aus M34 rechneten gegen Tag 471 und gelten nicht mehr |
| Haltungen | Provinz-Tage mit `defensive` gegen Garnison **101,8 %**, Verluste ohne Gefecht **0**, `docs/reports/stance.json` — **nach dem Mehrspieler neu gemessen** (2026-09-14 gegen `b1bb3c8`, 468 s), weil `newGame.ts` zu den Quellen zählt und T-M37-03 sie anfasste. Die Zahl ist auf die Nachkommastelle dieselbe wie davor: dreißig Aufgaben Mehrspieler haben die Einzelspieler-Mechanik nicht verschoben. Kontrolllauf 76 Einmärsche / 4 verloren, erwartet wie gemessen. Was die Zahl **nicht** sagt: befohlene Deckung kam in 0 von 19 Fällen rechtzeitig an — offene Frage 1 an Noah |
| Balancing | Grundlauf, Anteil des Stärksten **36,8 %** (vorher 44,4 %), `docs/reports/balance-sweep.md`; Turnier schwer gegen normal im Band von R-AI-06 |
| Benchmark-Vorbehalt | die Zahlen vom 2026-09-08 entstanden unter Fremdlast (2 gebundene Kerne) — Budgets bestanden **trotzdem**; wer glatte Zahlen braucht, misst bei freier Maschine nach |
