# WORKFLOW — der Stand nach der Abnahme

> **Diese Datei ist der Einstieg.** Wenn du hier fertig bist, weißt du, wo du bist, was
> gilt, und was in welcher Reihenfolge zu tun ist.
>
> **Stand: 2026-09-11.** Alles bis einschließlich **M33 und M36** ist gebaut und liegt
> auf **`main`**. `pnpm acceptance` lief (gegen den Stand nach M32) auf freier Maschine
> **11 von 11, Exit 0, 6 min 2 s** — das Zeitbudget-Tor bestanden mit Tickmedian
> **2,65 ms** gegen 3,5 gefordert. AK-1 wird an Spieltag 798 entschieden. **M33 hat
> Einheiten und Gebäuden Bilder gegeben** (siebzehn Schattenrisse in `ui/art.tsx`,
> Rekrutierungsliste, Bauplatzraster und Armeeliste; die Karte behält ihre NATO-Glyphe)
> und dabei einen Wächter repariert, der seit Monaten leer grün war. **M36 hat die
> Rohstoffleiste lesbar gemacht:** sieben neu gezeichnete Zeichen (Material trägt keinen
> Nadelbaum mehr), Reichweite statt Bilanz, zwei Töne statt sieben gleich lauter Zellen,
> vier Gruppen — und eine ruhigere Wirtschaftstabelle, die trotzdem alle vier Spalten
> behält, weil R-ECON-06 sie wörtlich verlangt. Von **225 Aufgaben sind 215 erledigt**;
> von den 10 offenen ist eine zurückgenommen (T-M10-02, keine Arbeit) und **neun sind
> geplant, freigegeben und ungebaut** — M34 und M35. Sie stehen in §2.
>
> **Es gibt keinen aktuelleren Zweig als `main`.** Wer eine ältere Fassung dieser Datei
> gelesen hat, kennt die umgekehrte Anweisung; sie galt bis zum Merge vom 2026-09-11 und
> ist seither falsch. §0 sagt, was zu prüfen ist.
>
> **Wo die Vorgeschichte steht:** die Bauabschnitte V1, LEVEL-UP M22–M24, „Grafik statt
> Text" M25–M27 und der Kriegsrat-Umbau M29–M32 sind je Aufgabe in `PROGRESS.md`
> festgehalten, die Entscheide in `DECISIONS.md`, die Befunde samt Lehren in
> `PROBLEME.md`. Was davon beim Arbeiten wirklich gebraucht wird, steht verdichtet in
> §3 und §4 — dort und nicht in diesem Kopf.

---

## 0 · Ankommen (ein Befehl, keine Suche)

```bash
git log --oneline -1 && git status --short
```

**Der Spitzenstand liegt auf `main`** (seit dem Merge vom 2026-09-11). Es gibt keinen
`claude/*`-Zweig mehr, der etwas trägt, das `main` nicht hat — die alten sind am
2026-09-11 abgeräumt worden, lokal und auf `origin`. Ein frischer Worktree landet
richtig; wer einen anlegt, zweigt von `main` ab.

Zeigt `git status` mehr als einen leeren Arbeitsbaum, gehört das geklärt, bevor
irgendetwas gebaut wird. Nach einem Wechsel des Standes:

```bash
pnpm install
```

---

## 1 · Der Stand in einem Absatz

Das Spiel ist **fertig und abgenommen**. V1 lief am 2026-09-08 mit 7 von 7 durch, der
Endstand nach dem Kriegsrat-Umbau am 2026-09-11 mit **11 von 11 auf freier Maschine**
(`docs/reports/acceptance.md`). Das Anforderungstor meldet „V1 offen: 0", die Abdeckung
liegt im Kern bei 96,8 %. **AK-7 ist abgenommen:** Noah hat den Playtest per /goal-Auftrag
vom 2026-09-07 ausdrücklich an den Agenten delegiert (Entscheid in `DECISIONS.md`); beide
Berichte liegen vor (`docs/reports/playtest-v1.md`, 62/62, und
`playtest-2026-09-07-v2.md`, 17 Befunde).

Was seither dazukam, war zuerst **Planung** — vier Meilensteine mit zwanzig Aufgaben,
alle freigegeben — und dann Bau: **M33** (Bilder für Einheiten und Gebäude) und **M36**
(die Rohstoffleiste) sind fertig, beide kernfrei. Offen bleiben **M34** — der teuerste
des Plans, weil er `data/rules` anfasst und damit Parameterlauf und Turnier erzwingt —
und **M35**, das ein Entwurf ist und kein Bau. Die Reihenfolge und die Begründungen
stehen in §2, die Baupläne je Meilenstein in `docs/plan/EINHEITSBILDER.md`,
`FORTSCHRITT.md` und `ROHSTOFFE.md`.

**Wichtig für T-M22-05:** Befehle werden **gesammelt** und im ersten Tick des nächsten
Laufs angewendet (vorher rechnete jeder Klick bei Pause sofort einen ganzen Tick, samt
KI). Wer an der Befehlskette arbeitet, liest den Entscheid in `DECISIONS.md`.
---

## 2 · Was als Nächstes dran ist

Alles bis einschließlich **M33** ist gebaut und auf `main`, **M36 seit dem 2026-09-11
ebenfalls**. Was hier als offen steht, ist geplant und freigegeben, aber **nicht
gebaut** — neun Aufgaben in zwei Meilensteinen.

0. **M33 ist fertig** (2026-09-11, fünf Aufgaben, kernfrei). `ui/art.tsx` trägt siebzehn
   Schattenrisse, zeichengleich aus `docs/design/einheiten-bilder.html` und von einem Test
   daran gebunden. Was daraus für alle gilt: der Koordinatenwächter der Symbole war seit
   Monaten **leer grün** (`/-?d+(.d+)?/g` sucht den Buchstaben `d`) und ist jetzt eine
   echte Pfadabfahrt in `test/path-bounds.ts` — sie fand sofort einen Zeichenfehler im
   Entwurfsblatt. Wer neue Pfade einbaut, benutzt sie. Der Rest steht in `PROGRESS.md`.
1. **Der Fortschritt bekommt eine Strecke (M34)** — freigegeben am 2026-09-11, acht
   Aufgaben. `docs/plan/FORTSCHRITT.md` §0 lesen. **Das ist der teuerste Meilenstein des
   Plans**, nicht wegen des Codes, sondern wegen der Messungen: vier Änderungen an
   `data/rules`, und jede macht die Abnahme rot, bis Parameterlauf und Turnier neu
   gelaufen **und eingecheckt** sind. T-M34-01 misst zuerst den Ausgangswert; T-M34-04 ist
   die einzige Kernänderung und verschiebt den Golden-Master.
2. **M36 ist fertig** (2026-09-11, sechs Aufgaben, kernfrei). Die Rohstoffleiste zeigt
   Bestand, Pfeil und — nur wo es drängt — die Reichweite in Tagen; die Bilanzzahl steht
   im Tooltip. Sieben neu gezeichnete Zeichen, vier Gruppen, zwei Töne. Was daraus für
   alle gilt, steht in `ROHSTOFFE.md` §6: **zwei Farben sind aufgegeben** (die
   Richtungsfarben aus D27.1 und das dauerhafte Bernstein des Geldes aus D27.2 — eine
   Signalfarbe, die an einem ruhigen Tag siebenmal leuchtet, ist keine mehr), und die
   Sichtprüfung fand eine Regel, die kein Test sehen konnte: `.resource span` färbte
   Pfeil und Reichweite um, weil ein Element weiter innen eine Stelle mehr Spezifität
   hat. **Wer an der Leiste arbeitet, prüft die Kaskade am laufenden Spiel und nicht nur
   im Test.**
3. **Der lange Mittelteil bekommt Ziele (M35)** — eine Aufgabe, und die ist ein **Entwurf,
   kein Bau** (Muster T-M28-07). Erst nach M34. **Damit sind M34 und M35 alles, was der
   Plan noch offen hat.**

Dazu, ohne Aufgabe in `tasks.yaml`:

4. **Noahs Freigabe für die Haltungen** — T-M28-07 hat vier Teilaufgaben geschnitten
   (`LEVEL-UP-3.md` §5): die Haltungen sollen etwas tun. Befund dort: **`aggressive`
   wirkt im ganzen Kern nirgends.** Eine Spielentscheidung liegt bei Noah — ob
   `garrison` oder `defensive` die Vorgabehaltung wird. Die Teilaufgaben stehen bewusst
   noch **nicht** in `tasks.yaml`.
5. **Zwei Vormerkungen für M17** (Entscheid T-M32-03): Antrag auf Durchmarschrecht und
   Provinzhandel. Sie stehen im **M17-Vorspann von `03-TASKS.md`** und nicht in
   `tasks.yaml` — ein Meilenstein gilt dem Plan-Wächter als geplant, sobald er *eine*
   Aufgabe trägt, und verlangt dann für alle acht M17-Anforderungen Aufgabe und Entwurf.
   M17 wird als Ganzes geplant oder gar nicht.
6. **Die Sichtprüfung zu T-M28-08 bleibt offen, und zwar aus einem strukturellen Grund:
   im Vorschaufenster läuft die Spieluhr nicht** (rAF gedrosselt; Tempo 10 bewegte sie in
   24 s um null Ticks). Zeit bewegt dort nur „Vorspulen", und das springt einen ganzen
   Spieltag — ein Gefecht dauert wenige Ticks und liegt fast immer dazwischen. Fünf
   Anläufe über drei Partien, Einzelheiten in `PROBLEME.md` (2026-09-11). **Allgemein:
   alles, was nur einen Tick lang sichtbar ist, ist in der Vorschau nicht prüfbar.**
   Noahs Maßstab („im Vorspulen fällt ein Krieg auf, ohne dass man das Protokoll liest")
   braucht ein großes Fenster und seinen Blick.
7. **T-M10-02** — zurückgenommen, keine Arbeit. Steht nur der Vollständigkeit halber hier.
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

## 4 · Zehn Fallen, die schon jemanden gekostet haben

1. **Die Einstiegsdatei zeigt auf den falschen Zweig.** Bis zum 2026-09-11 stand hier,
   `main` sei alt und die Spitze liege auf einem `claude/*`-Zweig — das hat fünf Sitzungen
   in Folge erwischt. Nach dem Merge stimmte die Anweisung nicht mehr und hätte in die
   andere Richtung geschadet: wer ihr folgte, warf sich per `git reset --hard` auf einen
   **älteren** Stand. **Die Lehre gilt über diesen Fall hinaus: wer merged, richtet §0
   im selben Zug.** Heute liegt die Spitze auf `main`.
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

8. **Die Browser-Vorschau startet den Dev-Server im HAUPTORDNER, nie im Worktree.** Sie
   serviert dann den Stand von `main`, und kein Neustart hilft. Erkennbar im Browser an
   `await (await fetch('/src/<geänderte Datei>')).text()` ohne den neuen Bezeichner.
   Abhilfe: im `.claude/launch.json` **des Hauptordners** eine zweite Konfiguration mit
   `pnpm -C <absoluter Worktree-Pfad>` und eigenem Port anlegen — und danach wieder
   entfernen. Eigener Port heißt eigener Ursprung: keine Spielstände, keine Autosaves.
9. **Dateien im Arbeitsbaum bleiben LF.** Ein Bearbeitungsskript, das CRLF schreibt, macht
   `pnpm verify` rot an Stellen, die seit Monaten unverändert sind: der Prosa-Wächter
   streift Zeilenkommentare mit einem Ausdruck, dem `` im Weg steht, und meldet dann
   Kommentartext als Spielertext (PROBLEME.md, 2026-09-11). Die Commits sind nie betroffen.

10. **`pnpm verify` im HAUPTCHECKOUT liest die Worktrees mit.** Jeder Baum unter
   `.claude/worktrees/` ist eine vollständige Kopie; ESLint meldete daraus 1684 Probleme,
   keines aus dem Quellcode dieses Baums. Seit dem 2026-09-11 steht `.claude/**` in den
   `ignores` von `eslint.config.js`. Aufgefallen ist es erst, als nach Monaten wieder auf
   `main` geprüft wurde — **ein Prüflauf ist nur dort belegt, wo er gelaufen ist.**

Dazu aus dem Bau von M22: **jsdom rechnet kein Layout** (`scrollWidth`/`clientWidth`
sind 0 — Layout-Wächter binden Struktur+Kaskade, Entscheid in DECISIONS.md), und
**jsdoms `requestAnimationFrame` hängt an `setInterval`** — unter `vi.useFakeTimers`
rAF stubben, sonst treibt `advanceTimersByTime` die ganze Spielschleife.

## 5 · Der Stand in Zahlen (2026-09-11; die Zeilen zu Programm und Benchmark-Vorbehalt: 2026-09-08)

| | |
|---|---|
| Aufgaben | **225, davon 215 erledigt** (2026-09-11, nach M33 und M36); offen: 9 geplante und ungebaute aus M34 und M35, dazu T-M10-02 — zurückgenommen |
| Abnahme | **11 von 11**, `docs/reports/acceptance.md`, 2026-09-11 auf freier Maschine — gegen den Stand nach M32; M33 und M36 sind kernfrei und haben `pnpm verify` durchlaufen, keinen vollen Abnahmelauf |
| AK-1 | Sieg an Spieltag 798, 2717 Eroberungen, 15 Kriegserklärungen (mit Kriegsmarsch 0,5) |
| AK-7 | **abgenommen** (Delegation, DECISIONS.md) — 62/62 Fragen, 2 Berichte |
| AK-8 | gemessen gegen `1c33ec7`; Erzeugnis 37 Dateien weiter — Neubau ausstehend, zählt nicht gegen V1 |
| Tests | **1889 schnell**, 140 Dateien · Kern 96,8 % · gesamt 95,9 % (`pnpm verify` grün, Exit 0, 2026-09-11 nach M36; davor 1859 nach M33 und 1825 davor) |
| Benchmark-Vorbehalt | die Zahlen vom 2026-09-08 entstanden unter Fremdlast (2 gebundene Kerne) — Budgets bestanden **trotzdem**; wer glatte Zahlen braucht, misst bei freier Maschine nach |
| Programm | `worldwar.exe` 7,93 MB, **frisch gegen `75a0128`** (2026-09-08); die AK-8-Messung in `packaging.md` beschreibt noch das alte Bündel |
