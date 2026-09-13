# WORKFLOW — der Stand nach M34, und der Mehrspieler ist geplant

> **⚠ STAND 2026-09-13 ABENDS — ZUERST `docs/plan/UEBERGABE.md` LESEN.** M41, M40 und M35 sind
> gebaut, liegen aber auf dem Zweig **`claude/offene-punkte-abschliessen`** (PR gegen `main`), nicht auf
> `main`. Offen ist nur noch der Schlussblock (Abnahme, Tauri-Bau + AK-8, Sichtprüfung im Chrome —
> von Noah freigegeben —, Einstiegsdoku, Artefakt). Diese Datei ist ab hier **veraltet**, bis
> Schritt 3.6 der Übergabe sie nachzieht.

> **Diese Datei ist der Einstieg.** Wenn du hier fertig bist, weißt du, wo du bist, was
> gilt, und was in welcher Reihenfolge zu tun ist.
>
> **Stand: 2026-09-12.** Von 255 Aufgaben sind **224 erledigt**; die eine alte offene ist
> T-M10-02, zurückgenommen und ohne Arbeit. **Der Plan war an diesem Tag für wenige
> Stunden leer und ist es nicht mehr:** M37 bis M39 bringen **dreißig geplante und
> freigegebene Aufgaben** — eine Partie zu zweit, der Mitspieler tritt über einen Link
> bei. Eine Datei genügt zum Anfangen, `docs/plan/MEHRSPIELER.md`; §2 Punkt 1 sagt das
> Nötige. M34 und M35 waren das Letzte, was aus dem alten Plan offen stand; sie sind an
> diesem Tag gebaut und abgenommen worden.
> `pnpm acceptance` lief auf freier Maschine **11 von 11, Exit 0, 7 min 28 s**. Die Fortschrittsachse reicht
> jetzt bis **Spieltag 80 statt bis 16** — in Echtzeit 32 Minuten statt 6,4 —,
> **Gebäudestufen kosten und dauern mehr** (Stufe 3 das 3,24-fache bei 2,25-facher Zeit),
> zwei Einheiten verlangen eine höhere Gebäudestufe, der Startvorrat steht auf zwei
> Dritteln, und über der Aushebeliste steht, was als Nächstes kommt. M35 ist ein
> **Entwurf** und kein Bau: die Zwischenziele stehen samt vier geschnittenen Teilaufgaben
> in `FORTSCHRITT.md` §3.
>
> **Es gibt keinen aktuelleren Zweig als `main`.** Wer eine ältere Fassung dieser Datei
> gelesen hat, kennt die umgekehrte Anweisung; sie galt bis zum Merge vom 2026-09-11 und
> ist seither falsch. §0 sagt, was zu prüfen ist.
>
> **Wo die Vorgeschichte steht:** die Bauabschnitte V1, LEVEL-UP M22–M24, „Grafik statt
> Text" M25–M27, der Kriegsrat-Umbau M29–M32, die Bilder M33, die Rohstoffleiste M36 und
> der Fortschritt M34 sind je Aufgabe in `PROGRESS.md` festgehalten, die Entscheide in
> `DECISIONS.md`, die Befunde samt Lehren in `PROBLEME.md`. Was davon beim Arbeiten
> wirklich gebraucht wird, steht verdichtet in §3 und §4 — dort und nicht in diesem Kopf.

---

## 0 · Ankommen (ein Befehl, keine Suche)

```bash
git log --oneline -1 && git status --short
```

**Der Spitzenstand liegt auf `main`** (seit dem Merge vom 2026-09-11). Es gibt keinen
`claude/*`-Zweig mehr, der etwas trägt, das `main` nicht hat. Ein frischer Worktree landet
richtig; wer einen anlegt, zweigt von `main` ab.

**Während des Baus, seit T-M35-02 (2026-09-13): `pnpm acceptance` ist absichtlich rot**, bis
der eine Parameterlauf im Schlussblock nach M35 eingecheckt ist (Frische-Wächter über
`data/rules`; M17 abgetrennt, Noah 2026-09-13). Der Schlussblock entfernt diese Zeile.

Zeigt `git status` mehr als einen leeren Arbeitsbaum, gehört das geklärt, bevor
irgendetwas gebaut wird. Nach einem Wechsel des Standes:

```bash
pnpm install
```

---

## 1 · Der Stand in einem Absatz

Das Spiel ist **fertig und abgenommen**, und der alte Plan war am 2026-09-12 abgearbeitet.
Am selben Tag ist ein neuer dazugekommen: **M37 bis M39, der Mehrspieler**, dreißig
Aufgaben, geplant und freigegeben, keine davon gebaut.
V1 lief am 2026-09-08 mit 7 von 7 durch, der Kriegsrat-Umbau am 2026-09-11 mit 11 von 11,
und der Stand nach M34 am 2026-09-12 mit **11 von 11, Exit 0, 7 min 28 s** (`docs/reports/acceptance.md`). Das
Anforderungstor meldet „V1 offen: 0". **AK-7 ist abgenommen:** Noah hat den Playtest per
/goal-Auftrag vom 2026-09-07 ausdrücklich an den Agenten delegiert (Entscheid in
`DECISIONS.md`); beide Berichte liegen vor.

**Was M34 geändert hat, in einem Satz:** die Fortschrittsachse war nach 6,4 Minuten
Echtzeit vorbei, während die Partie über achthundert Spieltage lief — zwei Prozent. Jetzt
sind es **siebzehn**, und die Partie entscheidet sich an Spieltag 471 statt 798. Die Zahlen und der Weg dorthin stehen in `docs/reports/progress-baseline.md`.

**Wichtig für T-M22-05:** Befehle werden **gesammelt** und im ersten Tick des nächsten
Laufs angewendet (vorher rechnete jeder Klick bei Pause sofort einen ganzen Tick, samt
KI). Wer an der Befehlskette arbeitet, liest den Entscheid in `DECISIONS.md`.

---

## 2 · Was als Nächstes dran ist

**Geplant, freigegeben und ungebaut sind der Mehrspieler (Noahs Freigabe vom 2026-09-12)
und seit dem 2026-09-13 M41, M40, M35 und M17 (Delegation per /goal, `DECISIONS.md`).** Was
darunter nicht „geplant" heißt, ist vorgemerkt.

1. **Eine Partie zu zweit (M37, M38, M39)** — geplant am 2026-09-12, **dreißig Aufgaben**.
   Noahs Auftrag: ein Mitspieler tritt über einen Link bei, aus einem anderen Netz,
   kostenlos, ohne öffentliche Webseite. **Lies `docs/plan/MEHRSPIELER.md`, sonst
   nichts** — dort stehen Befund, Messung, elf Fallen und die Reihenfolge. Der Entwurf
   ist D28, die Anforderungen sind `R-MP-01` bis `R-MP-13` in Abschnitt 2.17.

   Vier Dinge, die hier gelten und anderswo nicht:

   - **Der Kern wird nicht angefasst**, `data/rules` auch nicht. Golden-Master,
     Parameterlauf und Turnier bleiben unberührt — sechs Minuten Abnahme statt eines
     Nachtlaufs. Das ist der Unterschied zu M34, und er ist der Grund für den Zuschnitt.
   - **Fang mit M37 an, nicht mit dem Netz.** Elf der dreißig Aufgaben kommen ohne eine
     Zeile Netzcode aus und sind gegen zwei Simulationen im selben Prozess belegbar.
   - **T-M38-04 kommt vor T-M38-06.** Der Netz-Wächter bekommt seine Grenze, bevor der
     erste `new WebSocket` entsteht; andersherum ist `pnpm verify` rot, und der Grund ist
     nicht der, den man vermutet.
   - **Die Abnahme ist AK-9** (T-M39-09) und braucht Noah **und einen zweiten Menschen**
     in einem anderen Netz. Das einzige Kriterium dieses Plans, das kein Agent erfüllen
     kann. Sein Ort steht schon fest: Abschnitt 3.2 der Anforderungen und
     `scripts/acceptance-criteria.mjs` mit `scope: 'M39'`.
2. **Noah spielt.** Zum Vergnügen, nicht zur Abnahme. Was er findet, wird der nächste
   Plan. Die eine Frage, die kein Agent beantworten kann: *wollte ich weiterspielen?* Nach
   M34 hat sie zum ersten Mal eine ehrliche Chance — die ersten achtzig Spieltage tragen
   jetzt Entscheidungen statt einer Einkaufsliste.
3. **Zwischenziele zum Sieg — geplant als M35** (2026-09-13): T-M35-02 bis -06, Entwurf
   D31, R-GAME-08. Die Marken sind per Delegation entschieden (`DECISIONS.md`, kippbar).
4. **Die Haltungen — geplant als M40** (2026-09-13): T-M40-01 bis -06, Entwurf D30,
   R-UNIT-09. Vorgabe bleibt `defensive`, die Automatik führt nur menschliche Armeen
   (`DECISIONS.md`, kippbar).
5. **M17 „Tiefe zwischen den Kriegen" — geplant als Ganzes** (2026-09-13, T-M17-01):
   T-M17-02 bis -16, Entwurf D29, dazu R-DIP-08, R-DIP-09, R-AI-09, R-GAME-09. Die beiden
   Vormerkungen aus T-M32-03 sind darin (T-M17-04, T-M17-06). Kommt nach M35.
6. **Die Sichtprüfung zu T-M28-08 bleibt offen, und zwar aus einem strukturellen Grund:
   im Vorschaufenster läuft die Spieluhr nicht** (rAF gedrosselt; Tempo 10 bewegte sie in
   24 s um null Ticks). Zeit bewegt dort nur „Vorspulen", und das springt einen ganzen
   Spieltag — ein Gefecht dauert wenige Ticks und liegt fast immer dazwischen.
   **Allgemein: alles, was nur einen Tick lang sichtbar ist, ist in der Vorschau nicht
   prüfbar.**
7. **AK-8 nachmessen (optional, M16-Pflege):** die `worldwar.exe` ist seit dem
   2026-09-08 frisch gebaut gegen `75a0128` (7,93 MB). Was aussteht, ist nur die
   **Messung** am neuen Bündel (starten, speichern, schließen, neu starten, laden).
   Zählt nicht gegen V1.
8. **Die offenen Befunde aus `PROBLEME.md` — geplant als M41** (2026-09-13, zuerst zu
   bauen): die KI baut die Fabrik aus (T-M41-01/02), die stillen Eröffnungstage bekommen
   eine Ankündigung (T-M41-03), die Uhr verliert keine Ticks (T-M41-04), das KI-Gedächtnis
   vergisst tote Armeen (T-M41-05), Planpflege samt „fünf statt sechs" Hüllen-Kommandos
   (T-M41-06), die zugesagte Nahkampf-Eigenschaftsprüfung (T-M41-07).
   - ~~**`03-TASKS.md` nennt 57 Dateien, die es nicht gibt**~~ — **erledigt am 2026-09-13:**
     der Plan-Wächter liest jetzt auch `Dateien` und `Tests zuerst` in `03-TASKS.md`; die 63
     nachgezählten toten Pfade sind korrigiert oder gekennzeichnet (`PROBLEME.md`, 2026-09-12).
9. **T-M10-02** — zurückgenommen, keine Arbeit. Steht nur der Vollständigkeit halber hier.
10. **Danach:** nichts Geplantes mehr außer dem Mehrspieler — M17 ist seit dem 2026-09-13
   geplant (Punkt 5). Den einen Parameterlauf und die Abnahme trägt seit Noahs Entscheid vom
   2026-09-13 („M17 machen wir später") der Schlussblock nach M35, nicht mehr T-M17-16.

---

## 3 · Was gilt (nicht neu herleiten)

- **Remote seit 2026-09-11** (`origin` = github.com/Noah2475g/WorldWar-III, PRs #1–#3); weiterhin keine CI — `pnpm verify` ist die Prüfkette.
- **Der Plan-Wächter ist scharf.** `npx vitest run test/plan-consistency.test.ts`
  prüft in einer Sekunde tasks.yaml ↔ 03-TASKS.md und jeden `files:`/`tests:`-Pfad.
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

## 4 · Zwölf Fallen, die schon jemanden gekostet haben

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
5. **`scripts/acceptance.mjs` IST der ganze Abnahmelauf** (~6,5 min; die Prognose druckt
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

Dazu aus dem Bau von M22: **jsdom rechnet kein Layout** (`scrollWidth`/`clientWidth`
sind 0 — Layout-Wächter binden Struktur+Kaskade, Entscheid in DECISIONS.md), und
**jsdoms `requestAnimationFrame` hängt an `setInterval`** — unter `vi.useFakeTimers`
rAF stubben, sonst treibt `advanceTimersByTime` die ganze Spielschleife.

Und aus dem Bau von M34: **ein langer synchroner Lauf im Test tötet den Worker.** Vitest
meldet `Timeout calling "onTaskUpdate"`, obwohl jeder Test grün ist und der Bericht
geschrieben wurde. Eine Zeile behebt es — `await new Promise((r) => setTimeout(r, 0))`
zwischen zwei Partien.

## 5 · Der Stand in Zahlen (2026-09-12; die Zeilen zu Programm und Benchmark-Vorbehalt: 2026-09-08)

| | |
|---|---|
| Aufgaben | **255, davon 224 erledigt** (2026-09-12, nach M34, M35 und der Mehrspieler-Planung). Offen: **dreißig geplante und freigegebene** aus M37–M39, dazu T-M10-02 — zurückgenommen, keine Arbeit. |
| Abnahme | **11 von 11, Exit 0, 7 min 28 s**, `docs/reports/acceptance.md`, 2026-09-12 auf freier Maschine, gegen den Stand nach M34 |
| AK-1 | Sieg an Spieltag **975**, 2589 Eroberungen, 11 Kriegserklärungen, Sieger China (Startzahl 1914, seit Block N2 der M41-Nacharbeit — der Fabrikausbau sperrt keine Stadt mehr, die KI baut nicht in erinnerten Provinzen; nach T-M41-02 Tag 582, davor 471). Dieselbe Voreinstellung mit Startzahl 2015: Tag 583, mit 1815: Tag 583 (`docs/reports/fullgame*.json`, `PROBLEME.md` 2026-09-13). Der Siegtag springt je KI-Änderung in beide Richtungen; das Tor ist 300–1500. Die drei Startzahlen variieren nur den Zufall — Aufstellung, Gegner und Hauptstädte sind identisch (`PROBLEME.md`, Durchsicht N2, N3) |
| AK-7 | **abgenommen** (Delegation, DECISIONS.md) — 62/62 Fragen, 2 Berichte |
| AK-8 | gemessen gegen `1c33ec7`; Erzeugnis 37 Dateien weiter — Neubau ausstehend, zählt nicht gegen V1 |
| Tests | **1929 schnell**, 140 Dateien · Kern 96,8 % · gesamt 95,9 % (`pnpm verify` grün, Exit 0, 2026-09-12 nach M34; davor 1889 nach M36) |
| Fortschrittsachse | letzte Freischaltung **Spieltag 80** (vorher 16), **32 Minuten** Echtzeit bei Tempo 1 (vorher 6,4), **17 %** der Partie (vorher 2 %) — gegen Siegtag 471; *(korrigiert 2026-09-13: seit T-M41-02 endet die Partie mit Startzahl 1914 an Tag 582, gegen den die 80 Tage **14 %** sind; nach Block N2 endet sie an Tag 975, gegen den es **8 %** sind)* |
| Benchmark-Vorbehalt | die Zahlen vom 2026-09-08 entstanden unter Fremdlast (2 gebundene Kerne) — Budgets bestanden **trotzdem**; wer glatte Zahlen braucht, misst bei freier Maschine nach |
| Programm | `worldwar.exe` 7,93 MB, **frisch gegen `75a0128`** (2026-09-08); die AK-8-Messung in `packaging.md` beschreibt noch das alte Bündel |
