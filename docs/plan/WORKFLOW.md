# WORKFLOW — der Weg bis Noah spielt

> **Diese Datei ist der Einstieg.** Wenn du hier fertig bist, weißt du, wo du bist, was
> gilt, und was in welcher Reihenfolge zu tun ist.
>
> **Stand:** 2026-09-07 · **Alle Bauaufgaben sind erledigt — auch M19, M20 und M21.**
> Was bleibt, gehört Noah.

---

## 0 · Ankommen (ein Befehl, keine Suche)

```bash
git log --oneline -1 && git branch -a --format='%(refname:short) %(objectname:short)'
```

**Der Spitzenstand liegt auf `claude/bauplan-m19-m21-ec7e6a`** (bis zum 2026-09-07
auf `claude/offenen-plan-abarbeiten-4d4c8e`; dieser Zweig baut darauf auf und ist
fuenfzehn Aufgaben weiter). `main` steht auf
M8 und ist **über hundert Commits alt** — ein frischer Worktree landet dort und sieht ein
anderes Projekt. Zeigt dein `HEAD` nicht auf die Spitze:

```bash
git reset --hard claude/bauplan-m19-m21-ec7e6a && pnpm install
```

Das ist die Falle, in die **vier** Sitzungen hintereinander gelaufen sind, zuletzt am
2026-09-07 abends — auch die Sitzung, die M19–M21 gebaut hat. Sie kostet, wenn man sie übersieht, eine halbe Sitzung.

---

## 1 · Der Stand in einem Absatz

Von 154 Aufgaben sind **152 erledigt** — die fuenfzehn aus M19, M20 und M21 sind seit
dem 2026-09-07 dabei. Offen sind zwei, und keine davon ist Bauarbeit:

| Aufgabe | Was fehlt |
|---|---|
| **T-M12-03** (Haltepunkt) | **Noahs Playtest und seine Abnahme.** Kein Skript kann das |
| T-M10-02 | Nichts. Am 2026-09-06 zurückgenommen und gelöscht; steht mit Begründung im `reopened`-Feld |

**Der letzte vollständige Abnahmelauf war 7 von 7** (`pnpm acceptance` gegen `009bec6`,
73 min, Exit 0) — `docs/reports/acceptance.md`. ⚠ **Er ist älter als M19–M21 und muss
wiederholt werden**; die Einzelheiten und der Grund, warum er noch nicht lief, stehen in
Abschnitt 5. `pnpm verify` ist auf dem heutigen Stand grün (**1528 Tests**, Kern 96,8 %,
gesamt 95,3 %), und **AK-1 ist nach M19–M21 erneut gefahren: bitgleich** (Spieltag 876,
2025 Eroberungen, 11 Kriegserklärungen). **AK-8 ist gemessen**
(`docs/reports/packaging.md`), **R-AI-04 ist zum ersten Mal unter seinen eigenen
Bedingungen gemessen** (`docs/reports/ai-bench.json`, Anteil 0,074 gegen 0,30), und die
Karte ist zum ersten Mal an einem Kontext gemessen, der wirklich zeichnet
(`docs/reports/render-bench.json`).

---

## 2 · ⏸ Was noch aussteht — und es ist Noahs Teil

**AK-7 ist formal offen, und die Zahl täuscht.** `pnpm playtest:sheet` meldet „60 von 60
Fragen beantwortet", und das stimmt — aber `docs/reports/playtest-v1.md` sagt in seinem
eigenen Kopf:

> *Durchgang durch einen Agenten am 2026-09-06, nicht durch Noah. **AK-7 verlangt im
> Wortlaut Noahs Abnahme** — dieser Bogen ersetzt sie nicht, er nimmt ihr die Suche ab.*

Seit dem 2026-09-07 **sagt das Skript das selbst**: der Bogen trägt eine Zeile
`Durchgang von:`, und solange dort nicht Noah steht, meldet der Abnahmebericht AK-7 als
offen — vorher stand dort ein Haken, während der Satz zwei Zeilen weiter das Gegenteil
sagte. **Es ist der einzige echte Haltepunkt, der noch offen ist.**

Trag dich nach dem Spielen in `docs/reports/playtest-v1.md` bei `**Durchgang von:**`
ein; `pnpm playtest:sheet` sagt dann, ob noch etwas fehlt.

```bash
pnpm --filter @worldwar/desktop dev
```

Oder das Programm selbst:
`apps/desktop/src-tauri/target/release/worldwar.exe` (7,50 MiB, gebaut am 2026-09-07
gegen `1c33ec7`; dazu MSI und NSIS-Setup unter `bundle/`).

**Danach:** T-M12-03 auf `done`, Fortschrittseintrag in `PROGRESS.md`, Merge auf `main`,
alte Worktrees weg (`git worktree list` zeigt mehrere; nur dieser ist aktuell).

---

## 2b · ✅ Gebaut am 2026-09-07: M19, M20, M21

Aus Noahs Playtest am 2026-09-07 sind drei Meilensteine mit **fünfzehn Aufgaben**
entstanden. **Alle fünfzehn sind erledigt**, jede mit einem Test, der ohne die Reparatur
fällt.

| | | Ergebnis |
|---|---|---|
| **M19** | Die Karte zeigt, was da ist | **85,78 % → 100,00 %** der Landfläche; Kalifornien ist da |
| **M20** | Die Karte spricht mit | elf neue Symbole, Farbfelder je Macht, marschierende Armeen |
| **M21** | Die ersten Spieltage führen | fünf Schritte wurden acht, das Warten hat einen Namen |

**Wo die Zahlen stehen:** `docs/reports/map-geometry.md` (die vier Kartenprüfungen,
vorher/nachher, mit Bildbeleg) und `docs/reports/onboarding.md` (der Durchgang über
sechzehn Spieltage). Fünfzehn Einträge in `PROGRESS.md` sagen je Aufgabe, was gebaut
wurde und was anders kam als geplant.

> **`docs/plan/BAUPLAN-M19-M21.md` ist abgearbeitet** und trägt seit dem 2026-09-07 einen
> entsprechenden Kopf. Er bleibt als Begründungssammlung stehen — **aber fünf seiner
> Zahlen sind nicht reproduzierbar** und dort einzeln richtiggestellt. Wer ihn liest, muss
> das wissen.

### Drei Dinge, die daraus für Noah offen sind

Alle drei sind **Entscheidungen**, keine Bauarbeit, und alle drei stehen mit Begründung in
`PROBLEME.md` beziehungsweise `DECISIONS.md`:

1. **Der Name `AUS-SE`.** „Südostaustralien" besteht aus dem Hauptstadtterritorium, Jervis
   Bay und der Macquarie-Insel; Victoria und New South Wales stecken in `AUS-NE`. Die
   Provinz ist seit T-M19-04 anklickbar, der Name bleibt falsch. Umbenennen wäre die
   billige ehrliche Antwort; den Zuschnitt zu ändern hieße, die Anreicherung neu zu
   würfeln.
2. **Drei leere Spieltage.** Zwischen der Eisenbahn an Tag 5 und der Fabrik an Tag 8
   meldet das Spiel nichts. Gemessen in `onboarding.md`, drei Wege dort genannt, keiner
   empfohlen — das ist Balancing.
3. **Der Markt ohne Symbole.** `<option>` kann kein SVG tragen; eine eigene Liste wäre
   Bedienbarkeit gegen Aussehen. Steht in `DECISIONS.md`.

---

## 3 · Was gilt (nicht neu herleiten)


- **Kein Remote, nichts gemerged.** Es gibt keinen Push, kein GitHub, keine CI.
- **Der Plan-Wächter ist scharf.** `npx vitest run test/plan-consistency.test.ts` sagt in
  einer Sekunde, ob `tasks.yaml` und `03-TASKS.md` zusammenpassen und ob jeder
  `files:`/`tests:`-Pfad existiert. Er hat am 2026-09-07 zweimal sofort gebissen — beide
  Male, weil eine Aufgabe einen Pfad nannte, den es nicht gab.
- **Anforderungstor:** `pnpm coverage:requirements` meldet `V1 offen: 0`.
- **Sprache:** Dokumente Deutsch, Code und Bezeichner Englisch. `tasks.yaml` ohne Umlaute.
- **Ein grüner Einzeltest sagt nichts über das Spiel.** Und die schärfere Fassung, die
  diese Sitzung zweimal gebraucht hat: **ein Test, der grün ist, ohne dass die Reparatur
  drin ist, belegt gar nichts.** Nimm die Reparatur weg und sieh nach, dass er fällt.

---

## 4 · Sieben Fallen, die schon jemanden gekostet haben

1. **Der Worktree landet auf `main`.** Siehe Abschnitt 0. Vier Sitzungen in Folge.
2. **`tail` verschluckt den Exit-Code.** `cmd | tail` meldet den Status von `tail`.
   Schreib in eine Datei und frag `$?`, oder lass die Pipe weg. Am 2026-09-07 hat das
   einmal einen roten `pnpm verify` als grün gemeldet.
3. **Benchmarks brauchen die Maschine allein — und „allein" heißt *jeder* Prozess.**
   ```bash
   powershell -c "(Get-CimInstance Win32_Processor).LoadPercentage; Get-Process | Sort-Object CPU -Descending | Select-Object -First 5 ProcessName, CPU"
   ```
   Unter etwa 10 % Grundlast ist die Messung brauchbar.
4. **Einen langen Lauf abzubrechen beendet ihn nicht.** `TaskStop` trifft die Hülle, nicht
   den Prozessbaum. Nach jedem Abbruch nachsehen und killen:
   ```bash
   tasklist //FI "IMAGENAME eq node.exe"
   ```
   Am 2026-09-07 hat ein versehentliches `node scripts/acceptance.mjs` (statt einer
   Einzelprüfung) einen 90-Minuten-Lauf gestartet, der zwei Benchmark-Berichte unter Last
   überschrieben hat. Beide mussten verworfen und neu gemessen werden.
5. **`scripts/acceptance.mjs` IST der ganze Abnahmelauf.** Es gibt keinen Trockenlauf. Wer
   nur eine Zeile des Berichts prüfen will, ruft die Funktion direkt.
6. **Der Rust-Bau erzeugt 1,2 GB** unter `apps/desktop/src-tauri/target/`. Ignoriert, aber
   `git add -A` vor einem `.gitignore`-Eintrag wäre teuer.
7. **Ändere keine Quelldatei, während der Tauri-Bau läuft.** `beforeBuildCommand` baut das
   Frontend **am Anfang**; alles danach steht nicht im Erzeugnis. Am 2026-09-07 wurde AK-8
   deshalb an einem Programm gemessen, das den gerade geschriebenen Code nicht enthielt —
   nachgewiesen am Bündel selbst. Der Lauf musste wiederholt werden.
8. **Der git-stash ist zwischen allen Worktrees geteilt.** Nie blankes `git stash` — lieber
   ein WIP-Commit.

---

## 5 · Der Stand in Zahlen (2026-09-07)

| | |
|---|---|
| Aufgaben | 154, davon **152 erledigt** (M19–M21 dazugekommen) |
| Offen | T-M12-03 (Noahs Abnahme) · T-M10-02 (zurückgenommen, keine Arbeit) |
| Tests | **1528** schnell · Kern 96,8 % · gesamt 95,3 % |
| Anforderungen | `V1 offen: 0` |
| AK-1 | belegt: Sieg an Spieltag 876, 2025 Eroberungen, 11 Kriegserklärungen — **nach M19–M21 erneut gefahren, bitgleich** |
| Abnahmelauf | **7 von 7** maschinell, 2026-09-07 gegen `009bec6` — ⚠ **vor M19–M21**, siehe unten |
| AK-8 | **erfüllt und gemessen** — `docs/reports/packaging.md` |
| Tickbudget | 2,5 ms Median gegen 3,5 ms (Weltkarte, 237 Provinzen, 12 Mächte) |
| KI-Budget | **0,074 gegen 0,30** — erstmals unter den Bedingungen der Anforderung |
| Zeichenbudget | **p95 4,57 ms** mit Flächen und Bewegung, gegen 16,7 ms (2026-09-07, nach M19–M21) |
| Landfläche gezeichnet | **100,00 %** (vorher 85,78 %) — `docs/reports/map-geometry.md` |
| Programm | `worldwar.exe` 7,50 MiB + MSI 2,81 MiB + NSIS 2,11 MiB |

> ⚠ **Der Abnahmelauf ist älter als M19–M21 und muss wiederholt werden.** Er lief gegen
> `009bec6`, also vor den fünfzehn Aufgaben. `pnpm verify` ist auf dem neuen Stand grün
> (1528 Tests), aber das ist die schnelle Kette — der volle Lauf mit Langläufen, Turnier
> und Budgets steht aus:
>
> ```bash
> pnpm acceptance
> ```
>
> **Er braucht die Maschine allein** (rund 75 Minuten). Am 2026-09-07 lag die Grundlast bei
> 19–30 % (ein laufendes Spiel und ein Browser), und ein Lauf unter Last überschreibt die
> Benchmark-Berichte mit Zahlen, die die Maschine messen statt den Code — genau das ist am
> selben Tag schon einmal passiert und musste verworfen werden (§4, Falle 4). Deshalb steht
> er aus und wurde nicht blind gestartet.

---

## 6 · Was diese Sitzung gefunden hat, das keine Aufgabe war

Drei Dinge, die niemand gesucht hat und die den Plan betreffen — alle in `PROBLEME.md`:

1. **T-M14-13 stand auf `done` und hatte zwei seiner sechs Punkte nie geliefert** — genau
   die beiden, die der Playtest später als Befund 4 und 48 wieder einsammelte. Die
   Fertig-wenn-Zeile behauptete wörtlich das Gegenteil.
2. **R-AI-04s alte Zahl war in die falsche Richtung falsch.** 0,463 auf zwölf Provinzen
   las sich wie „knapp an der Grenze" und hat zwei Optimierungen in den Plan gebracht, die
   nicht nötig sind: unter den echten Bedingungen liegt der Anteil bei 0,074.
3. **Ein Geländer mit 2,6 % Reserve** (0,487 gegen 0,5) hätte beim nächsten Abnahmelauf
   zufällig gerissen. Es misst jetzt die absolute Zeit statt eines Quotienten, der auf
   einer kleinen Karte von Natur aus nahe 0,5 liegt.
