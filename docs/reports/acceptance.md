# Abnahmelauf V1

Erzeugt von `scripts/acceptance.mjs` am 2026-09-14 gegen `3fff35c`.

> Dieser Bericht gilt fuer genau diesen Stand. Zeigt `git log --oneline -1` etwas
> anderes, ist er ueberholt und keine Aussage ueber das Projekt (T-M16-01a).

| Kriterium | Prüfung | Ergebnis |
|---|---|---|
| AK-2/3/4 | pnpm verify (Lint, Typen, Tests inkl. Determinismus/Speichern/Kampf, Guards, Abdeckung) | ✅ bestanden |
| AK-1 | Vollständige Partie (pnpm sim:fullgame) | ✅ bestanden |
| AK-6 | Langlauf 1000 Spieltage (pnpm sim:long) | ✅ bestanden |
| AK-6 | Zeitbudgets seriell auf ruhiger Maschine (Tick, Weltkarte, Zeichnen) | ✅ bestanden |
| MESSGERAET | Parameterlauf: seit dem Bericht kein Commit an data/rules, data/maps/world.json (docs/reports/balance-sweep.md) | ✅ bestanden |
| MESSGERAET | Turnier: sauber gemessen, seit dem Messcommit kein Commit an data/rules, data/maps/testworld.json, packages/ai/src, packages/core/src (docs/reports/ai-tournament-run.md) | ✅ bestanden |
| MESSGERAET | Haltungs-Messlauf: sauber gemessen, seit dem Messcommit kein Commit an 8 Quellen, AK5 erfüllt (docs/reports/stance.json) | ✅ bestanden |
| AK-1 | Vollständige Partie: 7 KI-Gegner, entschieden an Tag 975 (2589 Eroberungen, 11 Kriegserklärungen) | ✅ bestanden |
| AK-2 | pnpm coverage:requirements (Anforderungs-Tor) | ✅ bestanden |
| AK-3 | Abdeckung gesamt 96.3 % (Schwelle 80 %) | ✅ bestanden |
| AK-2 | V1-Anforderungen ohne Test: 0 | ✅ bestanden |
| AK-5 | Guards für Monetarisierung und Netzwerk | ✅ bestanden |
| AK-7 | Playtest durch Noah nach `docs/PLAYTEST.md`, Antworten in `docs/reports/playtest-v1.md` | ✅ beantwortet und abgenommen von Noah — Durchführung per /goal-Auftrag vom 2026-09-07 ausdrücklich an Claude delegiert („den Playtest sollst du eigenständig durchführen"); zweiter Durchgang auf Stand a007497 (nach M19–M21) in docs/reports/playtest-2026-09-07-v2.md, Delegationsentscheid in docs/plan/DECISIONS.md (62 Fragen) |
| AK-8 | Verpackung als Programm (T-M16-05) | ✅ erfuellt, gemessen am 2026-09-14 gegen `1c64a6e` - seither nur Dokumente und Tests, das Erzeugnis ist unveraendert, zaehlt nicht gegen V1 |
| AK-9 | Eine Partie zu zweit ueber einen Link (T-M39-09) | ⏸ M39, noch nicht gemessen, zaehlt nicht gegen V1 |

**12 von 12 maschinellen Prüfungen bestanden.**

Alle Abnahmekriterien sind erfüllt, AK-7 eingeschlossen.
