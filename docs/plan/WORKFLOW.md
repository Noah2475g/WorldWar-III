# WORKFLOW — der Weg bis Noah spielt

> **Diese Datei ist der Einstieg.** Wenn du hier fertig bist, weißt du, wo du bist, was
> gilt, und was in welcher Reihenfolge zu tun ist.
>
> **Stand:** 2026-09-07 · **Alle Bauaufgaben sind erledigt.** Was bleibt, gehört Noah.

---

## 0 · Ankommen (ein Befehl, keine Suche)

```bash
git log --oneline -1 && git branch -a --format='%(refname:short) %(objectname:short)'
```

**Der Spitzenstand liegt auf `claude/offenen-plan-abarbeiten-4d4c8e`.** `main` steht auf
M8 und ist **über neunzig Commits alt** — ein frischer Worktree landet dort und sieht ein
anderes Projekt. Zeigt dein `HEAD` nicht auf die Spitze:

```bash
git reset --hard claude/offenen-plan-abarbeiten-4d4c8e && pnpm install
```

Das ist die Falle, in die **drei** Sitzungen hintereinander gelaufen sind, zuletzt am
2026-09-07. Sie kostet, wenn man sie übersieht, eine halbe Sitzung.

---

## 1 · Der Stand in einem Absatz

Von 139 Aufgaben sind **137 erledigt**. Offen sind zwei, und keine davon ist Bauarbeit:

| Aufgabe | Was fehlt |
|---|---|
| **T-M12-03** (Haltepunkt) | **Noahs Playtest und seine Abnahme.** Kein Skript kann das |
| T-M10-02 | Nichts. Am 2026-09-06 zurückgenommen und gelöscht; steht mit Begründung im `reopened`-Feld |

**Der vollständige Abnahmelauf ist gelaufen: 7 von 7 maschinelle Prüfungen bestanden**
(`pnpm acceptance` gegen `009bec6`, 73 min, Exit 0) — `docs/reports/acceptance.md`.
`pnpm verify` ist grün (1400 Tests, Kern 96,8 %, gesamt 95,1 %). **AK-8 ist gemessen**
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

## 2b · Geplant, nicht gebaut: M19, M20, M21

Aus Noahs Playtest am 2026-09-07 sind drei Meilensteine mit **fünfzehn Aufgaben** entstanden.
**Nichts davon ist gebaut**, und keiner blockiert die V1-Abnahme.

| | | |
|---|---|---|
| **M19** | Die Karte zeigt, was da ist | der Kartenfehler: 130 von 237 Provinzen verlieren Land |
| **M20** | Die Karte spricht mit | Symbole und Farben, wo heute Wörter stehen |
| **M21** | Die ersten Spieltage führen | der geführte Einstieg |

> **Wenn du das umsetzt, lies `docs/plan/BAUPLAN-M19-M21.md`** — eine Datei, je Aufgabe
> Dateien, Zeilen, Code vorher/nachher, Test und Fallen. Sie ist so gebaut, dass du **nicht
> suchen musst**. Die Reihenfolge steht dort oben; arbeite sie von oben ab.

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

1. **Der Worktree landet auf `main`.** Siehe Abschnitt 0. Drei Sitzungen in Folge.
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
| Aufgaben | 139, davon **137 erledigt** |
| Offen | T-M12-03 (Noahs Abnahme) · T-M10-02 (zurückgenommen, keine Arbeit) |
| Tests | **1400** schnell · Kern 96,8 % · gesamt 95,1 % |
| Anforderungen | `V1 offen: 0` |
| AK-1 | belegt: Sieg an Spieltag 876, 2025 Eroberungen, 11 Kriegserklärungen |
| Abnahmelauf | **7 von 7** maschinell, 2026-09-07 gegen `009bec6` |
| AK-8 | **erfüllt und gemessen** — `docs/reports/packaging.md` |
| Tickbudget | 2,5 ms Median gegen 3,5 ms (Weltkarte, 237 Provinzen, 12 Mächte) |
| KI-Budget | **0,074 gegen 0,30** — erstmals unter den Bedingungen der Anforderung |
| Zeichenbudget | 1,0–1,7 ms Median, 7,3 ms schlechtestes Einzelbild, gegen 16,7 ms |
| Programm | `worldwar.exe` 7,50 MiB + MSI 2,81 MiB + NSIS 2,11 MiB |

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
