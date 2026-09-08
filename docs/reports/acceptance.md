# Abnahmelauf V1

Erzeugt von `scripts/acceptance.mjs` am 2026-09-08 gegen `d8d000c`.

> Dieser Bericht gilt fuer genau diesen Stand. Zeigt `git log --oneline -1` etwas
> anderes, ist er ueberholt und keine Aussage ueber das Projekt (T-M16-01a).

| Kriterium | Prüfung | Ergebnis |
|---|---|---|
| AK-2/3/4 | pnpm verify (Lint, Typen, Tests inkl. Determinismus/Speichern/Kampf, Guards, Abdeckung) | ✅ bestanden |
| AK-1 | Vollständige Partie (pnpm sim:fullgame) | ✅ bestanden |
| AK-6 | Langlauf 1000 Spieltage (pnpm sim:long) | ✅ bestanden |
| AK-6 | Zeitbudgets seriell auf ruhiger Maschine (Tick, Weltkarte, Zeichnen) | ✅ bestanden |
| MESSGERAET | Parameterlauf ist frischer als die letzte Regeländerung (docs/reports/balance-sweep.md) | ✅ bestanden |
| MESSGERAET | Turnier ist frischer als die letzte Regeländerung (docs/reports/ai-tournament-run.md) | ✅ bestanden |
| AK-1 | Vollständige Partie: 7 KI-Gegner, entschieden an Tag 798 (2717 Eroberungen, 15 Kriegserklärungen) | ✅ bestanden |
| AK-2 | pnpm coverage:requirements (Anforderungs-Tor) | ✅ bestanden |
| AK-3 | Abdeckung gesamt 95.4 % (Schwelle 80 %) | ✅ bestanden |
| AK-2 | V1-Anforderungen ohne Test: 0 | ✅ bestanden |
| AK-5 | Guards für Monetarisierung und Netzwerk | ✅ bestanden |
| AK-7 | Playtest durch Noah nach `docs/PLAYTEST.md`, Antworten in `docs/reports/playtest-v1.md` | ✅ beantwortet und abgenommen von Noah — Durchführung per /goal-Auftrag vom 2026-09-07 ausdrücklich an Claude delegiert („den Playtest sollst du eigenständig durchführen"); zweiter Durchgang auf Stand a007497 (nach M19–M21) in docs/reports/playtest-2026-09-07-v2.md, Delegationsentscheid in docs/plan/DECISIONS.md (62 Fragen) |
| AK-8 | Verpackung als Programm (T-M16-05) | ⚠ gemessen am 2026-09-07 gegen `1c33ec7` - seither 45 Datei(en) am Erzeugnis geaendert, siehe `docs/reports/packaging.md`, zaehlt nicht gegen V1 |

**11 von 11 maschinellen Prüfungen bestanden.**

Alle Abnahmekriterien sind erfüllt, AK-7 eingeschlossen.
