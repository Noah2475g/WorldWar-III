# CLAUDE.md — WorldWar

## Das Wichtigste zuerst

**Lies `docs/plan/WORKFLOW.md`.** Eine Datei, absichtlich kurz, und sie enthält alles:
wo du bist, was gilt, welche Fallen es gibt, und den Ablauf bis zu dem Punkt, an dem Noah
spielt. Fang dort an, nicht bei den Plandateien.

**Lies nicht** `01-REQUIREMENTS.md`, `02-DESIGN.md` und `03-TASKS.md` am Stück — das sind
5400 Zeilen, und du brauchst pro Aufgabe **einen Abschnitt**. `WORKFLOW.md` §1 sagt, was
wann zu lesen ist.

## Zwei Dinge, an denen schon Sitzungen verloren gingen

1. **`main` steht auf M8 und ist sechzig Commits alt.** Der Spitzenstand liegt auf einem
   `claude/*`-Branch. Erster Befehl in einem frischen Worktree:

   ```bash
   git log --oneline -1
   ```

   Ist es nicht die Spitze, sagt `WORKFLOW.md` §0, was zu tun ist.

2. **Benchmarks brauchen die Maschine allein.** Alles unter `packages/core/test/perf`
   misst sonst die Auslastung statt den Code. Nie parallel zu einem Bau oder einer
   zweiten Testsuite.

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
- **Kein Remote.** Es gibt keinen Push und keine CI; `pnpm verify` ist die Prüfkette.

## Befehle, die du brauchst

```bash
pnpm verify        # Lint, Typen, Tests, Guards, Abdeckung  (~4 min)
pnpm acceptance    # der ganze Abnahmelauf, enthält verify und test:slow (~90 min)
pnpm dev           # das Spiel im Browser
```
