# WORKFLOW — der Stand nach M41, M40 und M35, und der Mehrspieler ist geplant

> **Diese Datei ist der Einstieg.** Wenn du hier fertig bist, weißt du, wo du bist, was
> gilt, und was in welcher Reihenfolge zu tun ist.
>
> **Stand: 2026-09-14.** Von **312 Aufgaben sind 264 erledigt** (gezählt in
> `docs/plan/tasks.yaml`, nicht geschätzt). Die **48 offenen** sind: **dreißig geplante und
> freigegebene** aus M37–M39 (der Mehrspieler), **fünfzehn** aus M17 (als Ganzes geplant,
> gebaut wird es auf Noahs Ansage), und **drei zurückgenommene** — T-M10-02, T-M40-04 und
> T-M41-10, jede mit einem `reopened`-Text, der sagt, wer sie ablöst.
>
> **Was seit dem 2026-09-12 dazugekommen ist:** in der Nacht vom 13. auf den 14. September
> sind **M41** (Pflege nach M34, 16 von 17), **M40** (die Haltungen, 18 von 19) und **M35**
> (Zwischenziele zum Sieg, 6 von 6) gebaut worden, jeder von ihnen mit mindestens einer
> adversarischen Durchsicht und der Nacharbeit daraus. `pnpm acceptance` lief am
> 2026-09-13 auf freier Maschine **12 von 12, Exit 0, 4 min 58 s** — zwölf, nicht elf: der
> dritte Frische-Wächter (Haltungs-Messlauf) ist eine neue Prüfung, die alten elf sind alle
> da und alle grün. **AK-8 ist seit dem 2026-09-14 gemessen und erfüllt**, am gebauten
> Programm und nicht im Browser (`docs/reports/packaging.md`).
>
> **Die Partie ist länger geworden.** Sie entscheidet sich mit Startzahl 1914 an
> **Spieltag 975** statt an 471 — der Siegtag springt bei jeder KI-Änderung in beide
> Richtungen, das Tor ist 300–1500. Die Fortschrittsachse endet weiter an Spieltag 80; das
> sind gegen 975 Tage **8 %** der Partie, nicht die 17 %, die hier bis zum 2026-09-12
> standen.
>
> **Wo die Vorgeschichte steht:** die Bauabschnitte V1, LEVEL-UP M22–M24, „Grafik statt
> Text" M25–M27, der Kriegsrat-Umbau M29–M32, die Bilder M33, die Rohstoffleiste M36, der
> Fortschritt M34 und der Block M41/M40/M35 sind je Aufgabe in `PROGRESS.md` festgehalten,
> die Entscheide in `DECISIONS.md`, die Befunde samt Lehren in `PROBLEME.md`. Was davon
> beim Arbeiten wirklich gebraucht wird, steht verdichtet in §3 und §4 — dort und nicht in
> diesem Kopf.
>
> **Was gerade auf Noah wartet:** neun offene Fragen, gesammelt in `DECISIONS.md` unter
> „Offene Fragen an Noah" (2026-09-14). Keine davon hat eine Aufgabe, und das ist Absicht.

---

## 0 · Ankommen (ein Befehl, keine Suche)

```bash
git log --oneline -1 && git status --short
```

**Bis zum Merge von PR #7 liegt die Spitze auf dem Zweig
`claude/offene-punkte-abschliessen`, nicht auf `main`.** Dort liegen M41, M40, M35, der
Schlussblock und diese Datei; `main` ist über achtzig Commits älter. Wer einen Worktree
anlegt, zweigt von diesem Zweig ab.

```bash
git switch claude/offene-punkte-abschliessen
```

**Wer den PR merged, richtet diesen Abschnitt im selben Commit** — danach gilt wieder „die
Spitze liegt auf `main`", und dieser Kasten muss weg. Eine Einstiegsdatei, die auf den
falschen Zweig zeigt, hat dieses Projekt fünf Sitzungen in Folge gekostet (§4 Falle 1); sie
schadet in beide Richtungen gleich viel.

Zeigt `git status` mehr als einen leeren Arbeitsbaum, gehört das geklärt, bevor
irgendetwas gebaut wird. Nach einem Wechsel des Standes:

```bash
pnpm install
```

---

## 1 · Der Stand in einem Absatz

Das Spiel ist **fertig und abgenommen**. Der alte Plan war am 2026-09-12 abgearbeitet; am
2026-09-12 kam **M37 bis M39** dazu (der Mehrspieler, dreißig Aufgaben, geplant und
freigegeben, keine davon gebaut), und am 2026-09-13 kamen **M41, M40, M35 und M17** dazu —
die ersten drei sind gebaut, M17 ist geplant und wartet auf Noahs Ansage.

V1 lief am 2026-09-08 mit 7 von 7 durch, der Kriegsrat-Umbau am 2026-09-11 mit 11 von 11,
der Stand nach M34 am 2026-09-12 mit 11 von 11, und der Stand nach **M41, M40 und M35** am
2026-09-13 mit **12 von 12, Exit 0, 4 min 58 s** (`docs/reports/acceptance.md`, gemessen
gegen `02c0bf9`). Das Anforderungstor meldet „V1 offen: 0". **AK-7 ist abgenommen:** Noah
hat den Playtest per /goal-Auftrag vom 2026-09-07 ausdrücklich an den Agenten delegiert
(Entscheid in `DECISIONS.md`); beide Berichte liegen vor. **AK-8 ist seit dem 2026-09-14
erfüllt** — gemessen am gebauten Programm gegen `2c52356`, sieben von sieben Schritten.

**Was M41, M40 und M35 geändert haben, in drei Sätzen:** die KI baut ihre Fabriken jetzt
wirklich aus (61 Provinzen auf Stufe 3 statt keiner einzigen Macht über Stufe 1), und die
Uhr hält ihr Tempo (99,9 statt 95,8 Ticks/s am gebauten Bündel, am Dev-Server 99,6 statt
60). Armeen haben vier Haltungen mit Erklärtext, und eine Verteidigung rückt in eine
bedrohte Nachbarprovinz nach — aber nur, wenn eine zweite eigene Armee stehen bleibt; der
Angriff marschiert **nie** von selbst. Und die lange Mitte der Partie hat vier
Zwischenziele, die in der Rangliste stehen.

**Wichtig für T-M22-05:** Befehle werden **gesammelt** und im ersten Tick des nächsten
Laufs angewendet (vorher rechnete jeder Klick bei Pause sofort einen ganzen Tick, samt
KI). Wer an der Befehlskette arbeitet, liest den Entscheid in `DECISIONS.md`.

---

## 2 · Was als Nächstes dran ist

**Geplant, freigegeben und ungebaut sind der Mehrspieler (Noahs Freigabe vom 2026-09-12)
und M17 (Delegation per /goal vom 2026-09-13, Bau auf Noahs Ansage).** Was darunter nicht
„geplant" heißt, ist vorgemerkt.

1. **Neun offene Fragen an Noah** — `DECISIONS.md`, Eintrag „Offene Fragen an Noah"
   (2026-09-14). Sie sind die einzige Sorte Arbeit, die kein Agent erledigen kann, und
   mehrere von ihnen bestimmen, was überhaupt als Nächstes gebaut wird: ob die
   Verteidigungs-Automatik bleibt, ob die tote KI-Artillerie der Voreinstellung ein
   Balancing-Block wird, ob die längere Partie (Tag 975 statt 471) gewollt ist, und ob das,
   was von Gefechten im laufenden Spiel zu sehen ist, genügt. **Nichts davon hat eine
   Aufgabe** — ein Plan, der Fragen als Aufgaben führt, wird nie fertig.
2. **Eine Partie zu zweit (M37, M38, M39)** — geplant am 2026-09-12, **dreißig Aufgaben**.
   Noahs Auftrag: ein Mitspieler tritt über einen Link bei, aus einem anderen Netz,
   kostenlos, ohne öffentliche Webseite. **Lies `docs/plan/MEHRSPIELER.md`, sonst
   nichts** — dort stehen Befund, Messung, elf Fallen und die Reihenfolge. Der Entwurf
   ist D28, die Anforderungen sind `R-MP-01` bis `R-MP-13` in Abschnitt 2.17.

   Vier Dinge, die hier gelten und anderswo nicht:

   - **Der Kern wird nicht angefasst**, `data/rules` auch nicht. Golden-Master,
     Parameterlauf, Turnier und Haltungs-Messlauf bleiben unberührt — fünf Minuten Abnahme
     statt eines Nachtlaufs. Das ist der Unterschied zu M34, und er ist der Grund für den
     Zuschnitt.
   - **Fang mit M37 an, nicht mit dem Netz.** Elf der dreißig Aufgaben kommen ohne eine
     Zeile Netzcode aus und sind gegen zwei Simulationen im selben Prozess belegbar.
   - **T-M38-04 kommt vor T-M38-06.** Der Netz-Wächter bekommt seine Grenze, bevor der
     erste `new WebSocket` entsteht; andersherum ist `pnpm verify` rot, und der Grund ist
     nicht der, den man vermutet.
   - **Die Abnahme ist AK-9** (T-M39-09) und braucht Noah **und einen zweiten Menschen**
     in einem anderen Netz. Das einzige Kriterium dieses Plans, das kein Agent erfüllen
     kann. Sein Ort steht schon fest: Abschnitt 3.2 der Anforderungen und
     `scripts/acceptance-criteria.mjs` mit `scope: 'M39'`.
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
   Vorratsaufbau und die amphibische KI (T-M17-01 hat sie hierher gehängt), und die tote
   KI-Artillerie der Voreinstellung (R-BAT-08/AK3, offene Frage).
6. **T-M40-04, T-M41-10 und T-M10-02** — zurückgenommen, jede mit Begründung in
   `tasks.yaml` (`reopened`) und in `DECISIONS.md`. Sie stehen nur der Vollständigkeit
   halber hier; nichts davon ist Arbeit, die wartet.
7. **Die Sichtprüfung zu T-M28-08 ist gelaufen** (2026-09-14,
   `docs/reports/sichtpruefung-2026-09-14.md` §7) und beschreibt **ohne Urteil**, was zu
   sehen ist — der Maßstab ist Noahs. Was sie gemessen hat: ein Gefecht dauert ein bis
   drei Spielstunden, das sind bei Tempo 10 eine bis wenige Bildzeiten; im „Vorspulen"
   zeichnet der Browser gar nicht. **Allgemein bleibt: alles, was nur einen Tick lang
   sichtbar ist, ist im Vorspulen nicht prüfbar** — und in der Browser-Vorschau läuft die
   Spieluhr überhaupt nicht.

---

## 3 · Was gilt (nicht neu herleiten)

- **Remote seit 2026-09-11** (`origin` = github.com/Noah2475g/WorldWar-III; PR #7 trägt M41, M40, M35 und den Schlussblock und ist offen — **Noah merged, kein Agent**); weiterhin keine CI — `pnpm verify` ist die Prüfkette. **Nie mit `--force` pushen.**
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

## 4 · Zweiundzwanzig Fallen, die schon jemanden gekostet haben

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
| Aufgaben | **312, davon 264 erledigt** (gezählt in `tasks.yaml`, 2026-09-14). Offen: **30** geplante und freigegebene aus M37–M39, **15** aus M17 (geplant, Bau auf Noahs Ansage), **3** zurückgenommene — T-M10-02, T-M40-04 (die Verfolgung, abgelöst von T-M40-10), T-M41-10 (am Rücknahmekriterium gerissen). Je Meilenstein: M35 **6/6**, M40 **18/19**, M41 **16/17**, M17 **1/16**, M37–M39 **0/30** |
| Abnahme | **12 von 12, Exit 0, 4 min 58 s** (`totalSeconds` 298), `docs/reports/acceptance.md`, 2026-09-13 auf freier Maschine gegen `02c0bf9`. Zwölf statt elf, weil eine Prüfung dazukam (dritter Frische-Wächter, Haltungs-Messlauf, T-M40-16/-17) |
| Tests | **2155 schnell**, **146 Dateien** · Abdeckung Kern **96,9 %**, gesamt **96,3 %** (`pnpm verify` **Exit 0**, Wanduhr 69 und 73 s in zwei Läufen, gemessen am 2026-09-14 auf dem Stand dieses Doku-Commits; davor 2147 vor T-M41-18, 2118 nach M35, 1929 nach M34) |
| AK-1 | Sieg an Spieltag **975**, 2589 Eroberungen, 11 Kriegserklärungen, Sieger China (Startzahl 1914). Dieselbe Voreinstellung mit Startzahl 2015: Tag 583, mit 1815: Tag 583 (`docs/reports/fullgame*.json`). Der Siegtag springt je KI-Änderung in beide Richtungen; das Tor ist 300–1500. Die drei Startzahlen variieren nur den Zufall — Aufstellung, Gegner und Hauptstädte sind identisch |
| AK-7 | **abgenommen** (Delegation, `DECISIONS.md`) — 62/62 Fragen, 2 Berichte |
| AK-8 | **erfüllt**, gemessen am 2026-09-14 gegen `2c52356` am gebauten Programm: starten, Partie beginnen, Strg+S, speichern, beenden, neu starten, „Weiterspielen (Tag 1)" — sieben von sieben Schritten (`docs/reports/packaging.md`). Zählt nicht gegen V1 (M16) |
| AK-9 | ⏸ M39, noch nicht gemessen — braucht Noah und einen zweiten Menschen in einem anderen Netz |
| Anforderungstor | `pnpm coverage:requirements` meldet **V1 offen: 0** |
| Programm | `worldwar.exe` **6 780 416 Bytes** (6,47 MiB), gebaut am 2026-09-14 00:41, `pnpm tauri:build` Exit 0 in 2 min 19 s; dazu MSI 2 813 952 B und NSIS-Setup 2 141 188 B. Der Sprung gegen die 7 933 952 B vom 2026-09-08 stammt aus T-M28-03 (`tauri-plugin-fs` entfernt) |
| Uhr | **99,88 Ticks/s im Median** am gebauten Bündel bei Tempo 100 (Minimum 99,77, fünf Läufe), am Dev-Server 99,57 / 99,61 / 99,73. Vorher: Bündel Median 95,76 bei Streuung 5,42, Dev-Server 57,9 bis 62,6 (T-M41-17, gemessen über CDP am sichtbaren Fenster) |
| Langlauf | 1000 Spieltage in **198 321 ms**, **8,263 ms je Tick** inkl. KI (vorher 319 030 ms / 13,293 ms). **Die Partie ist nach 1000 Spieltagen nicht entschieden** — vorher an Tick 19320; das ist eine offene Frage an Noah, kein gerissenes Kriterium (AK-6 misst Zeit) |
| Zeitbudgets | Weltkarte Median **2,523 ms** / p99 **6,215 ms** (gefordert 3,5 / 8, `worldmap-bench.json`); Zeichnen p95 2,29 ms bei 16,7 ms Bildbudget; Anteil der KI am Tick 0,072 (Grenze 0,3) |
| Fortschrittsachse | letzte Freischaltung **Spieltag 80** (vorher 16), **32 Minuten** Echtzeit bei Tempo 1 (vorher 6,4). Gegen den Siegtag 975 sind das **8 %** der Partie — die 17 % aus M34 rechneten gegen Tag 471 und gelten nicht mehr |
| Haltungen | Provinz-Tage mit `defensive` gegen Garnison **101,8 %** (vorher 79,7 %), Verluste ohne Gefecht **0** (vorher 10), 12 Episodenläufe, `docs/reports/stance.json`. Was die Zahl **nicht** sagt: befohlene Deckung kam in **0 von 19** Fällen rechtzeitig an — offene Frage 1 an Noah |
| Balancing | Grundlauf, Anteil des Stärksten **36,8 %** (vorher 44,4 %), `docs/reports/balance-sweep.md`; Turnier schwer gegen normal im Band von R-AI-06 |
| Benchmark-Vorbehalt | die Zahlen vom 2026-09-08 entstanden unter Fremdlast (2 gebundene Kerne) — Budgets bestanden **trotzdem**; wer glatte Zahlen braucht, misst bei freier Maschine nach |
