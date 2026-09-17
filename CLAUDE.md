# CLAUDE.md — WorldWar

## Das Wichtigste zuerst

**Lies `docs/plan/WORKFLOW.md`.** Eine Datei, absichtlich kurz, und sie enthält alles:
wo du bist, was gilt, welche Fallen es gibt, und den Ablauf bis zu dem Punkt, an dem Noah
spielt. Fang dort an, nicht bei den Plandateien.

**Lies nicht** `01-REQUIREMENTS.md`, `02-DESIGN.md` und `03-TASKS.md` am Stück — das sind
7400 Zeilen, und du brauchst pro Aufgabe **einen Abschnitt**. `WORKFLOW.md` §1 sagt, was
wann zu lesen ist.

## Zwei Dinge, an denen schon Sitzungen verloren gingen

1. **Auf welchem Zweig die Spitze liegt, sagt `WORKFLOW.md` §0 — und sonst nichts.** Seit
   dem Merge von PR #7 (M41, M40, M35 und der Schlussblock) am 2026-09-14 liegt sie wieder
   auf `main`. Erster Befehl in einem frischen Worktree:

   ```bash
   git log --oneline -1 && git status --short
   ```

   **Wer merged, richtet `WORKFLOW.md` §0 im selben Zug** — eine Einstiegsdatei, die auf
   den falschen Zweig zeigt, hat fuenf Sitzungen in Folge erwischt und schadet in beide
   Richtungen.

2. **Benchmarks brauchen die Maschine allein.** Alles unter `packages/core/test/perf`
   und `render.bench.slow.test.ts` misst sonst die Auslastung statt den Code. Nie parallel
   zu einem Bau oder einer zweiten Testsuite.

   **Das gilt NICHT für die Simulationen** — Parameterlauf, Turnier, Vollpartie, Langlauf
   und `progress.slow.test.ts` hängen an Karte, Regeln und Startzahl, nicht an der
   Maschinenlast; nur ihre *Dauer* tut das. Wer während eines solchen Laufs Quelldateien
   schreibt, stört ihn nicht: vitest lädt seine Module beim Start.

## Wie hier gearbeitet wird

- **Erst messen, dann ändern.** Jede Reparatur hält ihren Ausgangswert fest, bevor eine
  Zeile fällt. Eine Grenze anzuheben, damit eine Zahl passt, gilt als Fehler und nicht als
  Lösung.
- **Ein grüner Einzeltest sagt nichts über das Spiel.** Er stellt die Lage selbst her, in
  der die Mechanik greift. Jede Mechanik braucht eine Zahl aus einem Lauf über eine ganze
  Partie — `apps/headless/test/ai-integration.slow.test.ts` ist die Vorlage.
- **Zurückgenommene Zusagen werden begründet, nicht gelöscht.** Eine Aufgabe, die nicht
  gebaut wird, steht auf `todo` mit einem `reopened`-Text, der sagt, wer sie ablöst.
- **Der Plan ist maschinell geprüft.** `npx vitest run test/plan-consistency.test.ts` und
  `pnpm coverage:requirements` (muss `V1 offen: 0` melden) laufen in Sekunden — nutze sie
  nach jeder Planänderung.
- **Sprache:** Dokumente Deutsch, Code und Bezeichner Englisch, `tasks.yaml` ohne Umlaute.
- **Remote ja, CI nein.** `origin` ist github.com/Noah2475g/WorldWar-III (seit 2026-09-11);
  es laeuft dort nichts automatisch. `pnpm verify` ist die Pruefkette.

## Befehle, die du brauchst

```bash
pnpm verify        # Lint, Typen, Tests, Guards, Abdeckung  (69-73 s, gemessen 2026-09-14)
pnpm acceptance    # der ganze Abnahmelauf, enthaelt verify  (4 min 58 s, gemessen 2026-09-13)
pnpm dev           # das Spiel im Browser
```
