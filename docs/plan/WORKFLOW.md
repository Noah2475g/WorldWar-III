# WORKFLOW — der Stand nach der Abnahme

> **Diese Datei ist der Einstieg.** Wenn du hier fertig bist, weißt du, wo du bist, was
> gilt, und was in welcher Reihenfolge zu tun ist.
>
> **Stand:** 2026-09-11 · **Der Kriegsrat-Umbau ist bis M31 gebaut** (11 von 15 Aufgaben
> `done`, je Aufgabe ein Commit und eine Zeile in `PROGRESS.md`; `pnpm verify` grün an den
> Toren M29/M30, Abschlussprüfung im M31-Block von PROGRESS.md). **M32 wartet auf Noahs
> Freigabe.** Danach T-M28-06/T-M28-08. Die Spitze liegt auf `claude/design-plan-execution-8b4296`.
>
> **Neu am 2026-09-11: M33 „Einheiten und Gebäude bekommen Bilder" ist geplant und
> freigegeben** (`docs/plan/EINHEITSBILDER.md`, fünf Aufgaben, alle `todo`, kernfrei).
> Noah hat nach zwei Entwurfsrunden Richtung B „Schattenriss" gewählt, für Einheiten und
> Gebäude, eingefärbt nach Besitzerfarbe, Infanterie als Mann. Die siebzehn Zeichnungen
> liegen fertig in `docs/design/einheiten-bilder.html` — wer M33 baut, überträgt, er
> entwirft nicht mehr. **Fund am Rand:** der Koordinatentest in `icons.test.tsx` ist seit
> Monaten leer grün (sein Ausdruck sucht den Buchstaben `d` statt einer Ziffer und findet
> in keinem Pfad etwas); T-M33-01 ersetzt ihn.
>
> **Ebenfalls neu am 2026-09-11: M34 „Der Fortschritt bekommt eine Strecke" und M35**
> (`docs/plan/FORTSCHRITT.md`, neun Aufgaben, alle `todo`). Der Befund: die Uhr läuft mit
> einem Tick je Sekunde, ein Spieltag hat 24 Ticks, die letzte Freischaltung liegt auf
> Spieltag 16 — die ganze Fortschrittsachse ist nach **6,4 Minuten Echtzeit** vorbei,
> während die Partie bis Spieltag 798 läuft. Dazu zwei weitere: Gebäudestufen kosten auf
> jeder Stufe dasselbe, und der Startvorrat trägt die Eröffnung allein. **M34 ist teuer**,
> nicht im Code, sondern in Messungen: vier Änderungen an `data/rules`, jede macht die
> Abnahme rot bis Parameterlauf und Turnier neu eingecheckt sind, und T-M34-04 verschiebt
> den Golden-Master.
>
> **Und M36 „Die Rohstoffleiste wird lesbar"** (`docs/plan/ROHSTOFFE.md`, sechs Aufgaben,
> kernfrei, Entwurf `docs/design/rohstoffleiste.html`). Aus der Sichtprüfung am laufenden
> Spiel: dieselben Zahlen stehen doppelt auf dem Bildschirm, der Rohstoffname ist in der
> Leiste `visually-hidden`, und vier der sieben Zeichen tragen ihre Bedeutung nicht —
> **Material wird bis heute durch einen Nadelbaum dargestellt**, obwohl der Rohstoff seit
> T-M23-01 nicht mehr Holz heißt. Zeichensatz und Gruppierung sind entschieden.
>
> **Stand davor:** 2026-09-10 · **der Kriegsrat-Umbau ist geplant** — Noahs Wahl der
> Designrichtung A, Entwurf `docs/design/kriegsrat.html`, Bauplan **`docs/plan/KRIEGSRAT.md`**
> (M29–M32, 15 Aufgaben, alle `todo`). **Wer den Umbau baut, liest KRIEGSRAT.md §0 und
> sonst nichts** — er ist so geschrieben, dass keine Recherche mehr nötig ist.
>
> **Stand davor:** 2026-09-08 (spät) · **V1 ist abgenommen (7 von 7); LEVEL-UP M22–M24 und
> LEVEL-UP 2 „Grafik statt Text" M25–M27 sind vollständig gebaut.**
>
> **Neu am 2026-09-08 (LEVEL-UP 2, Noahs Wahl: alle fünf Vorschläge A–E,
> `docs/plan/LEVEL-UP-2-GRAFIK.md`):** Zeitreihe je Spieltag · Machtverlauf-Kurve im
> Lage-Panel · Wirtschafts-Sparklines und Bilanzbalken (auch im Tagesbericht) ·
> Marschpfeile mit Fortschritt · Eroberungs-Farbwelle und skalierte Kampfringe ·
> fünfter Kartenmodus „Beziehungen" · Gefechtsbericht mit Stärkebalken und Zeichen
> (BATTLE_RESOLVED additiv um fünf Anzeigefelder ergänzt, Golden-Master unberührt).
> Zeichenbudget nachgemessen: p95 5,39 ms gegen 16,7 ms.
>
> **Dazu ein schwerer Fund aus der Sichtprüfung** (PROBLEME.md, 2026-09-08): die
> setState-Updater der App rechneten mit Seiteneffekten — unter `<StrictMode>` (so
> rendert main.tsx!) verlor das Vorspulen die gesammelten Befehle **spurlos**, und
> die Stoppmeldung zählte doppelt („nach 2 Tagen" bei einem). Kein Test sah es, weil
> alle ohne StrictMode renderten. Repariert (Rechnung außerhalb des Updaters,
> `stateRef`), ein Test rendert jetzt im Harness der echten App. **Regel:** Updater
> sind pur; mindestens ein Test rendert im selben Wrapper wie der Einstiegspunkt.
>
> `pnpm acceptance` dauert seit dem Umbau vom 2026-09-08 **~6,5 min** (gemessen; das
> Skript nennt die erwartete Dauer vorab selbst) und lief gegen den Endstand
> **11 von 11 grün** — inklusive des reparierten AK-6-Langlaufs, der jetzt wirklich
> die Weltkarte mit 8 Spielern fährt (vorher: Testkarte, 3 Spieler — eine Attrappe,
> sichtbar geworden durch den Umbau).

---

## 0 · Ankommen (ein Befehl, keine Suche)

```bash
git log --oneline -1 && git branch -a --format='%(refname:short) %(objectname:short)'
```

**Der Spitzenstand liegt auf `claude/design-plan-execution-8b4296`** (Kriegsrat M29–M31 gebaut,
2026-09-11; baut auf `claude/ui-ux-pro-max-bit-ba5d44` auf). `main` steht auf M8 und
ist **weit über hundert Commits alt** — ein frischer Worktree landet dort und sieht ein
anderes Projekt. Diese Falle hat **fünf** Sitzungen in Folge erwischt. Zeigt dein `HEAD`
nicht auf die Spitze:

```bash
git reset --hard claude/design-plan-execution-8b4296 && pnpm install
```

---

## 1 · Der Stand in einem Absatz

Von **166 Aufgaben sind 165 erledigt** (offen bleibt nur T-M10-02 — zurückgenommen,
keine Arbeit). **`pnpm acceptance` lief am 2026-09-08 gegen den Endstand: 7 von 7,
Exit 0** — AK-1 wird an Spieltag 798 entschieden (2717 Eroberungen, 15
Kriegserklärungen), das Anforderungstor meldet „V1 offen: 0", Abdeckung 95,4 %
(~1650 schnelle Tests). **AK-7 ist abgenommen:** Noah hat den Playtest per
/goal-Auftrag vom 2026-09-07 ausdrücklich an den Agenten delegiert (Entscheid in
`DECISIONS.md`); beide Berichte liegen vor (`docs/reports/playtest-v1.md`, 62/62,
und `playtest-2026-09-07-v2.md`, 17 Befunde).

**Neu seit dem 2026-09-07 abends: der LEVEL-UP-Plan ist gebaut** — zwölf Aufgaben in
drei Meilensteinen, alle mit Test-zuerst und grünem `pnpm verify`:

| | | Ergebnis |
|---|---|---|
| **M22** | Die Oberfläche hält, was der Kern rechnet | Protokoll in voller Breite · Seitenleiste ohne Querscrollen · eigene Rückschläge rot markiert · Startbildschirm mit Titel und **Weiterspielen-Knopf** · Befehls-Quittung + „Pausiert"-Anzeige · A11y-Namen und 24-px-Klickziele |
| **M23** | Die Sprache wird fertig | echte Umlaute mit Wortregel-Wächter · Genus/Dativ/Numerus-Tabelle („Sie können **sie** jetzt bauen", „Vereinigte Staaten **erklären**") · `AUS-SE` heißt ehrlich „Australisches Hauptstadtterritorium" · Marktsymbol |
| **M24** | Die Tage bekommen Inhalt | Tagesbericht mit Körper (Bilanz, Moral, Aufträge, „Morgen neu") · `why`-Feld je Führungsschritt plus zwei neue Schritte (Punktequellen, Moralstrafe) · **Kriegsmarschfaktor 0,35 → 0,5**, gemessen an drei Varianten (`docs/reports/warmarch.json`) |

Die Achse und die Begründungen: `docs/plan/LEVEL-UP.md`. Je Aufgabe: `PROGRESS.md`.

**Wichtig für T-M22-05:** Befehle werden jetzt **gesammelt** und im ersten Tick des
nächsten Laufs angewendet (vorher rechnete jeder Klick bei Pause sofort einen ganzen
Tick, samt KI). Wer an der Befehlskette arbeitet, liest den Entscheid in `DECISIONS.md`.

---

## 2 · Was als Nächstes dran ist

0. **Die Bilder für Einheiten und Gebäude (M33)** — freigegeben am 2026-09-11, kernfrei,
   fünf Aufgaben. `docs/plan/EINHEITSBILDER.md` §0 lesen, dann T-M33-01 bis T-M33-05. Die
   siebzehn Zeichnungen liegen fertig in `docs/design/einheiten-bilder.html`; es ist kein
   Entwurf mehr zu machen, nur noch zu übertragen. **Achtung:** T-M33-01 repariert
   nebenbei einen Wächter, der seit Monaten leer grün ist (Risiko 7 im Bauplan).
1. **Der Fortschritt bekommt eine Strecke (M34)** — freigegeben am 2026-09-11, acht
   Aufgaben. `docs/plan/FORTSCHRITT.md` §0 lesen. **Das ist der teuerste Meilenstein des
   Plans**, nicht wegen des Codes, sondern wegen der Messungen: vier Änderungen an
   `data/rules`, und jede macht die Abnahme rot, bis Parameterlauf und Turnier neu
   gelaufen **und eingecheckt** sind. T-M34-01 misst zuerst den Ausgangswert; T-M34-04 ist
   die einzige Kernänderung und verschiebt den Golden-Master.
2. **Die Rohstoffleiste wird lesbar (M36)** — freigegeben am 2026-09-11, sechs Aufgaben,
   kernfrei. `docs/plan/ROHSTOFFE.md` §0 lesen. T-M36-01 hängt an T-M33-01, weil dort der
   Wächter entsteht, der die neuen Pfade prüft. Zeichensatz und
   Gruppierung sind entschieden; es ist nichts mehr zu entwerfen.
3. **Der lange Mittelteil bekommt Ziele (M35)** — eine Aufgabe, und die ist ein **Entwurf,
   kein Bau** (Muster T-M28-07). Erst nach M34.
4. **Der Kriegsrat-Umbau, Rest (M32)** — `docs/plan/KRIEGSRAT.md` §0 lesen. T-M32-01
   berührt den Kern und wartet auf Noahs Freigabe; T-M32-02 und T-M32-03 sind kernfrei und
   könnten jederzeit laufen.
5. **Noahs Spiel-Feedback (T-M28-06, T-M28-07, T-M28-08)** — vorgemerkt, nicht gebaut.
   T-M28-07 verlangt zuerst eine Analyse und einen Entwurf in `LEVEL-UP-3.md`, keinen Bau.
6. **T-M10-02** — zurückgenommen, keine Arbeit. Steht nur der Vollständigkeit halber hier.
7. **Merge auf `main`** — dieser Branch enthält alles; `main` kann per fast-forward
   nachziehen. Danach die alten Worktrees aufräumen (`git worktree list` zeigt
   mehrere; nur `playtest-levelplan-bbacfc` ist aktuell). Im **Hauptcheckout** liegt
   seit dem 2026-09-03 eine uncommittete, überholte Änderung an
   `packages/core/src/persistence/migrate.ts` — vor dem Merge verwerfen.
8. **AK-8 nachmessen (optional, M16-Pflege):** die `worldwar.exe` ist seit dem
   2026-09-08 **frisch gebaut** gegen `75a0128` (7,93 MB, Bau bei unangefasster
   Quelle, `Finished release in 5m03s`). Was aussteht, ist nur die **Messung** am
   neuen Bündel (starten, speichern, schließen, neu starten, laden —
   `docs/reports/packaging.md` dokumentiert noch den Lauf gegen `1c33ec7`). Zählt
   nicht gegen V1.
9. **Noah spielt** — zum Vergnügen, nicht zur Abnahme. Was er findet, wird der
   nächste Plan. Die eine Frage, die kein Agent beantworten kann: *wollte ich
   weiterspielen?*
10. **Danach:** M17 „Tiefe zwischen den Kriegen" (Spionage, Handelsangebote) ist die
   nächste geplante Achse.

---

## 3 · Was gilt (nicht neu herleiten)

- **Kein Remote, nichts gemerged.** Es gibt keinen Push, kein GitHub, keine CI.
- **Der Plan-Wächter ist scharf.** `npx vitest run test/plan-consistency.test.ts`
  prüft in einer Sekunde tasks.yaml ↔ 03-TASKS.md und jeden `files:`/`tests:`-Pfad.
- **Anforderungstor:** `pnpm coverage:requirements` meldet `V1 offen: 0`.
- **Sprache:** Dokumente Deutsch, Code und Bezeichner Englisch. `tasks.yaml` ohne
  Umlaute — **Spielertexte aber MIT**: seit T-M23-01 fällt ein Wächter bei
  ae/oe/ue-Ersatzschrift in `de.ts`.
- **Ein grüner Einzeltest sagt nichts über das Spiel.** Und: ein Test, der grün ist,
  ohne dass die Reparatur drin ist, belegt gar nichts — Reparatur rausnehmen, fallen
  sehen.

## 4 · Sieben Fallen, die schon jemanden gekostet haben

1. **Der Worktree landet auf `main`.** Abschnitt 0. Fünf Sitzungen in Folge.
2. **`cmd | tail` verschluckt den Exit-Code.** In eine Datei schreiben, `$?` fragen.
3. **Benchmarks brauchen die Maschine allein** — und „allein" heißt *jeder* Prozess:
   ```bash
   powershell -c "(Get-CimInstance Win32_Processor).LoadPercentage; Get-Process | Sort-Object CPU -Descending | Select-Object -First 5 ProcessName, CPU"
   ```
4. **Einen langen Lauf abzubrechen beendet ihn nicht.** Nach jedem Abbruch
   `tasklist //FI "IMAGENAME eq node.exe"` — und wissen: der Berechtigungs-Classifier
   kann `taskkill`/`Stop-Process` **verweigern**; dann Noah bitten (so geschehen am
   2026-09-08: zwei verwaiste Worker banden Stunden lang je einen Kern und machten den
   Abnahmelauf um die Hälfte langsamer).
5. **`scripts/acceptance.mjs` IST der ganze Abnahmelauf** (~6,5 min seit dem Umbau vom
   2026-09-08; die Prognose druckt er selbst aus `acceptance-timing.json`) — und er
   **schreibt** Berichte. Einzelne Aussagen prüft man an der Funktion, nie am Skript.
   Parameterlauf und Turnier laufen NICHT mehr je Abnahme — sie stecken in
   `pnpm test:slow` (Vollsuite, Maschine allein, für die Nacht) und hinter dem
   Frische-Wächter: ändern sich `data/rules/**`, wird die Abnahme rot, bis
   `pnpm balance:sweep` bzw. das Turnier neu gelaufen sind.
6. **Ändere keine Quelldatei, während der Tauri-Bau läuft.** `beforeBuildCommand` liest
   am Anfang; alles danach fehlt im Erzeugnis.
7. **Der git-stash ist zwischen allen Worktrees geteilt.** Nie blankes `git stash` —
   lieber ein WIP-Commit.

Dazu aus dem Bau von M22: **jsdom rechnet kein Layout** (`scrollWidth`/`clientWidth`
sind 0 — Layout-Wächter binden Struktur+Kaskade, Entscheid in DECISIONS.md), und
**jsdoms `requestAnimationFrame` hängt an `setInterval`** — unter `vi.useFakeTimers`
rAF stubben, sonst treibt `advanceTimersByTime` die ganze Spielschleife.

## 5 · Der Stand in Zahlen (2026-09-08)

| | |
|---|---|
| Aufgaben | 166, davon **165 erledigt** (T-M10-02 zurückgenommen) |
| Abnahme | **7 von 7**, `docs/reports/acceptance.md`, gegen den Endstand |
| AK-1 | Sieg an Spieltag 798, 2717 Eroberungen, 15 Kriegserklärungen (mit Kriegsmarsch 0,5) |
| AK-7 | **abgenommen** (Delegation, DECISIONS.md) — 62/62 Fragen, 2 Berichte |
| AK-8 | gemessen gegen `1c33ec7`; Erzeugnis 37 Dateien weiter — Neubau ausstehend, zählt nicht gegen V1 |
| Tests | ~1650 schnell · Kern 96,8 % · gesamt 95,4 % |
| Benchmark-Vorbehalt | die Zahlen vom 2026-09-08 entstanden unter Fremdlast (2 gebundene Kerne) — Budgets bestanden **trotzdem**; wer glatte Zahlen braucht, misst bei freier Maschine nach |
| Programm | `worldwar.exe` 7,93 MB, **frisch gegen `75a0128`** (2026-09-08); die AK-8-Messung in `packaging.md` beschreibt noch das alte Bündel |
