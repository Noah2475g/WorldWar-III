# WORKFLOW — der Weg bis Noah spielt

> **Diese Datei ist der Einstieg.** Sie ist absichtlich die einzige, die du ganz lesen
> musst. Wenn du hier fertig bist, weißt du, wo du bist, was gilt, was du nicht noch
> einmal herausfinden musst, und was in welcher Reihenfolge zu tun ist.
>
> **Stand:** 2026-09-06, abends · **Aufgesetzt nach** dem Abbruch des vorigen Agenten.

---

## 0 · Ankommen (zwei Befehle, keine Suche)

```bash
git log --oneline -1 && git branch -a --format='%(refname:short) %(objectname:short)'
```

**Der Spitzenstand liegt auf `claude/next-steps-parallel-857224`.** `main` steht auf M8 und
ist **sechzig Commits alt** — ein frischer Worktree landet dort und sieht ein anderes
Projekt. Zeigt dein `HEAD` nicht auf die Spitze:

```bash
git reset --hard claude/next-steps-parallel-857224 && pnpm install
```

Das ist die Falle, in die diese Sitzung und die davor gelaufen sind. Sie kostet, wenn man
sie übersieht, eine halbe Sitzung.

---

## 1 · Was du **nicht** lesen musst

Das Projekt hat 10 500 Zeilen Planungstext. Du brauchst davon fast nichts.

| Datei | Zeilen | Lies sie … |
|---|---|---|
| `docs/reports/audit-2026-09-05.md` | 580 | **gar nicht.** Alles Lebende daraus steht in `PROBLEME.md` oder ist erledigt |
| `docs/plan/03-TASKS.md` | 2994 | **nur den Abschnitt der Aufgabe, die du gerade baust** (`### T-M16-0n`) |
| `docs/plan/02-DESIGN.md` | 1580 | nur das Kapitel, das deine Aufgabe nennt (M16 = **D20**) |
| `docs/plan/PROBLEME.md` | 1117 | nur, wenn du einen Befund suchst — die neuesten stehen **unten** |
| `docs/plan/DECISIONS.md` | 1039 | nur, wenn du eine Entscheidung ändern willst |
| `SESSION-STATE.md` (Vault) | – | nur den obersten Abschnitt; darunter liegt Geschichte |
| `docs/plan/tasks.yaml` | – | ist die **Wahrheit** über Status und Aufgaben. Maschinell lesen, nicht überfliegen |

**Regel:** eine Aufgabe = ein Abschnitt in `03-TASKS.md` + ihr Eintrag in `tasks.yaml`.
Mehr Kontext brauchst du für keine der Aufgaben unten.

---

## 2 · Was gilt (nicht neu herleiten)

- **Kein Remote, nichts gemerged.** Es gibt keinen Push, kein GitHub, keine CI.
- **Der Plan-Wächter ist scharf.** `tasks.yaml` und `03-TASKS.md` müssen dieselben IDs,
  Abhängigkeiten und Anforderungen nennen; jeder `files:`/`tests:`-Pfad einer Aufgabe auf
  `done` muss existieren. `npx vitest run test/plan-consistency.test.ts` sagt es in einer
  Sekunde.
- **Anforderungstor:** `pnpm coverage:requirements` muss `V1 offen: 0` melden und mit 0
  enden. Eine neue Anforderung eines *geplanten* Meilensteins braucht **Aufgabe und
  Entwurfstext**, sonst fällt der Wächter.
- **Sprache:** Dokumente Deutsch, Code und Bezeichner Englisch. `tasks.yaml` ohne Umlaute.
- **Vier Haltepunkte** brauchen Noah (`tasks.yaml`, `gate: true`). Der einzige noch offene
  ist **T-M12-03** (Abnahme) — und der Playtest darin.
- **Ein grüner Einzeltest sagt nichts über das Spiel.** Jede Mechanik braucht eine Zahl aus
  einem Lauf. Und die Umkehrung gilt auch: eine Regel, die *überall* greift, friert das
  Spiel ein, ohne dass ein Einzeltest zuckt (so ging AK-1 am 2026-09-06 kaputt).

---

## 3 · Sieben Fallen, die schon jemanden gekostet haben

1. **`docs/reports/acceptance.md` ist überholt.** Es meldet „AK-1 ❌, 5 von 7" aus einem
   Lauf **vor** der Reparatur — daneben liegt `fullgame.json` mit Sieg an Spieltag 876.
   Seit dem 2026-09-06 stempelt der Bericht den Commit, gegen den er lief. **Schritt 1
   unten macht ihn wieder wahr. Bis dahin: nicht zitieren.**
2. **`ai-bench.json` mit `share: 0.498` belegt nichts.** Gemessen auf **zwölf** Provinzen
   mit **drei** Mächten; R-AI-04 verlangt **acht**. Die Datei sagt das seit dem 2026-09-06
   selbst (`certifies`). Siehe `PROBLEME.md`, letzter Abschnitt, und **T-M16-02**.
3. **`tail` verschluckt den Exit-Code.** `cmd | tail` meldet den Status von `tail`. Ein
   gescheiterter Tauri-Bau sah dadurch aus wie „exit 0". Schreib in eine Datei und frag
   `$?`, oder lass die Pipe weg.
4. **Der Rust-Bau erzeugt 1,2 GB** unter `apps/desktop/src-tauri/target/`. Ignoriert, aber
   `git add -A` vor einem `.gitignore`-Eintrag wäre teuer. `gen/` ist ebenfalls ignoriert.
5. **Benchmarks brauchen die Maschine allein.** Alles unter `packages/core/test/perf`
   misst sonst die Auslastung. Nie parallel zu einem Bau oder einer zweiten Suite.
6. **Der git-stash ist zwischen allen Worktrees geteilt.** Nie blankes `git stash` — lieber
   ein WIP-Commit.
7. **Einen langen Lauf abzubrechen beendet ihn nicht.** `TaskStop` (und Strg+C) trifft die
   Hülle, nicht den Prozessbaum: `pnpm` → `vitest` → `tinypool`-Arbeiter laufen weiter.
   Am 2026-09-06 liefen dadurch **zwei Abnahmeläufe 105 Minuten nebeneinander** — halbe
   Geschwindigkeit, verfälschte Benchmarks, und am Ende hätten beide in dieselben
   Berichtsdateien geschrieben. Nach jedem Abbruch **nachsehen und den Baum killen**:

   ```bash
   tasklist //FI "IMAGENAME eq node.exe"
   ```

   Dann `taskkill //PID <pid> //T //F` auf die Wurzel. Ein `pnpm acceptance` erkennst du
   an der Startzeit; alles, was älter ist als dein eigener Start, gehört jemand anderem.

---

## 4 · Der Ablauf

> **Parallelität, die zählt:** Schritt A gehört Noah und kostet dich nichts. Gib ihm den
> Befehl und arbeite an B weiter — er ist der Engpass, nicht die Maschine.

### ⏸ A · Noah spielt (AK-7) — kann sofort und jederzeit laufen

```bash
pnpm --filter @worldwar/desktop dev
```

Bogen: `docs/PLAYTEST.md` (60 Fragen, ~45 min). Antworten kommen nach
`docs/reports/playtest-v1.md`. `pnpm playtest:sheet` sagt, wie weit er ist und welches
„nein" noch keinen Befund trägt. **AK-7 ist erfüllt, wenn jede Frage beantwortet ist und
jedes „nein" eine Zeile in der Befundtabelle hat.**

Seit T-M16-03 gibt es auch ein echtes Programm:
`apps/desktop/src-tauri/target/release/worldwar.exe`.

---

### 1 · Die Wahrheit herstellen — **ein** Befehl, ~90 Minuten

```bash
pnpm acceptance
```

Er enthält `pnpm verify` **und** `pnpm test:slow`; einzeln zu laufen bringt nichts außer
Wartezeit. Vorher einmal `pnpm verify` allein (~4 min) lohnt trotzdem: scheitert schon
das, sparst du 80 Minuten.

**Während er läuft: nichts anderes auf der Maschine starten** (Falle 5).

**Erwartet:** 6 von 7 maschinell grün, offen bleibt AK-7. Danach ist
`docs/reports/acceptance.md` wieder eine Aussage über das Projekt.

**Wenn rot:** die betroffene Prüfung einzeln nachfahren
(`pnpm sim:fullgame`, `pnpm bench`, `pnpm sim:tournament`) und den Befund in
`PROBLEME.md` eintragen, **bevor** du reparierst. Erst messen, dann ändern.

---

### 2 · T-M16-04 · Der Datei-Port

Spielstände im echten Dateisystem — die Zusage, die seit M8 dasteht. `createStorage` ist
seit T-M14-08 die eine Stelle, `storagePortContract` läuft gegen zwei Umsetzungen; die
dritte tritt hinzu und ändert an beidem nichts.

Braucht `@tauri-apps/api` und `@tauri-apps/plugin-fs` in `apps/desktop`.
**Die entscheidende Prüfung ist R-PKG-02/AK2:** ein *außerhalb* des Programms gelöschter
Stand verschwindet aus der Liste — sonst besteht auch ein Port, der die Namen nur im
Speicher führt.

Schließt **T-M8-00**. Einzelheiten: `03-TASKS.md`, Abschnitt `### T-M16-04`.

---

### 3 · T-M16-05 · AK-8 gemessen

Starten, speichern, schließen, neu starten, Stand steht wieder in der Liste — mit Datum in
`docs/reports/packaging.md`. Erst danach zählt AK-8 in `pnpm acceptance` mit.
**Die V1-Abnahme AK-1…AK-7 bleibt unberührt** (T-M12-03 wird hier nicht angefasst).

---

### 4 · Befunde aus Noahs Playtest

Jedes „nein" aus `docs/reports/playtest-v1.md` bekommt eine Zeile in der Befundtabelle und
— wenn es Arbeit ist — eine Aufgabe. Kleines sofort, Größeres mit Meilenstein in
`PROBLEME.md`. Nichts bleibt zwischen „nicht gebaut" und „nicht entschieden" liegen.

---

### 5 · T-M16-02 · Das Rechenbudget der KI

Der schwerste offene Befund, und er hängt an keinem Bau.

**Erst messen, dann reparieren.** R-AI-04 zieht auf die ausgelieferte Weltkarte mit acht
KI-Mächten (heute: zwölf Provinzen, drei Mächte). Ausgangswert festhalten, **bevor** eine
Zeile Produktionscode fällt.

Dann zwei Schnitte, jeder einzeln gemessen:
1. `visibleProvinces` läuft **zweimal je Macht und Tick** — `updateIntel` und
   `publicView`, gleicher Zustand, gleicher Tick. Kein Vertrag ändert sich.
2. Die Geografie jeder `VisibleProvince` (`id`, `name`, `kind`, `terrain`, `coastal`,
   `neighbors`, `seaLinks`) ändert sich nie und wird trotzdem je Macht und Tick neu
   abgeschrieben — auf der Weltkarte 237 × 8 × jeden Tick.

Rund **97 %** der gemessenen KI-Zeit ist der Bau der Sicht, nicht die Entscheidung.

**Reißt die Messung die Anforderung, ist das eine Entscheidung für Noah** — nachmessen und
begründen wie bei R-ARCH-06 am 2026-09-06, Eintrag in `DECISIONS.md`. **Die Grenze
anzuheben, damit die Zahl passt, ist ausgeschlossen.**

---

### 6 · T-M16-06 · Die Karte zeichnend messen · 7 · T-M16-07 · Bedienbar ohne Maus

Zwei kleinere Aufgaben, beide erst am gebauten Programm sinnvoll: R-ARCH-06/AK2 (60 FPS)
misst bis heute niemand, der zeichnet — `MapCanvas` läuft in keinem Test, weil
`getContext` in der Testumgebung `null` liefert. Und kein Test öffnet einen Dialog und
schließt ihn (Escape, Fokusfang, Tabreihenfolge, `aria`).

---

### 8 · Abschluss

1. `pnpm acceptance` ein letztes Mal — **7 von 7**, AK-7 mit Noahs Antworten.
2. **T-M12-03 auf `done`** in `tasks.yaml`, Fortschrittseintrag in `PROGRESS.md`.
3. Merge auf `main`. **Vorher** die überholte Änderung an
   `packages/core/src/persistence/migrate.ts` im Haupt-Checkout verwerfen — der
   Spitzenstand löst dasselbe besser (`delete copy.hash` statt `hash: undefined`).
4. Alte Worktrees entfernen (`git worktree list` zeigt sieben; sechs sind Geschichte).
5. `SESSION-STATE.md` im Vault und `WORKFLOW.md` hier nachziehen.

---

## 5 · Der Stand in Zahlen (2026-09-06, abends)

| | |
|---|---|
| Aufgaben | 132, davon **124 erledigt** |
| Offen | T-M12-03 (Abnahme) · T-M16-02, -04, -05, -06, -07 |
| Zurückgenommen, keine Arbeit | T-M8-00 (Datei-Port → M16) · T-M10-02 (Worker-Host → gelöscht) |
| Anforderungen | 101, davon 82 V1-pflichtig, **`V1 offen: 0`** |
| Tests | **1330** schnell (gemessen 2026-09-06) · Kern 96,8 % · gesamt 94,4 % |
| AK-1 | belegt: Sieg an **Spieltag 876**, 11 Kriegserklärungen, 2025 Eroberungen |
| Tickbudget | 2,528 ms Median gegen 3,5 ms gefordert (Weltkarte, 237 Provinzen) |
| KI-Budget | **ungemessen** unter den Bedingungen der Anforderung (siehe Schritt 5) |
| Programm | `worldwar.exe` 7,86 MB + **MSI 2,94 MB** + NSIS-Setup 2,20 MB, gebaut am 2026-09-06 (T-M16-03 erledigt) |
