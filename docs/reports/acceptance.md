# Abnahmelauf V1

Erzeugt von `scripts/acceptance.mjs` am 2026-09-11 gegen `e77550d`.

> Dieser Bericht gilt fuer genau diesen Stand. Zeigt `git log --oneline -1` etwas
> anderes, ist er ueberholt und keine Aussage ueber das Projekt (T-M16-01a).

| Kriterium | Prüfung | Ergebnis |
|---|---|---|
| AK-2/3/4 | pnpm verify (Lint, Typen, Tests inkl. Determinismus/Speichern/Kampf, Guards, Abdeckung) | ✅ bestanden |
| AK-1 | Vollständige Partie (pnpm sim:fullgame) | ✅ bestanden |
| AK-6 | Langlauf 1000 Spieltage (pnpm sim:long) | ✅ bestanden |
| AK-6 | Zeitbudgets seriell auf ruhiger Maschine (Tick, Weltkarte, Zeichnen) | ❌ fehlgeschlagen |
| MESSGERAET | Parameterlauf ist frischer als die letzte Regeländerung (docs/reports/balance-sweep.md) | ✅ bestanden |
| MESSGERAET | Turnier ist frischer als die letzte Regeländerung (docs/reports/ai-tournament-run.md) | ✅ bestanden |
| AK-1 | Vollständige Partie: 7 KI-Gegner, entschieden an Tag 798 (2717 Eroberungen, 15 Kriegserklärungen) | ✅ bestanden |
| AK-2 | pnpm coverage:requirements (Anforderungs-Tor) | ✅ bestanden |
| AK-3 | Abdeckung gesamt 95.7 % (Schwelle 80 %) | ✅ bestanden |
| AK-2 | V1-Anforderungen ohne Test: 0 | ✅ bestanden |
| AK-5 | Guards für Monetarisierung und Netzwerk | ✅ bestanden |
| AK-7 | Playtest durch Noah nach `docs/PLAYTEST.md`, Antworten in `docs/reports/playtest-v1.md` | ✅ beantwortet und abgenommen von Noah — Durchführung per /goal-Auftrag vom 2026-09-07 ausdrücklich an Claude delegiert („den Playtest sollst du eigenständig durchführen"); zweiter Durchgang auf Stand a007497 (nach M19–M21) in docs/reports/playtest-2026-09-07-v2.md, Delegationsentscheid in docs/plan/DECISIONS.md (62 Fragen) |
| AK-8 | Verpackung als Programm (T-M16-05) | ⚠ docs/reports/packaging.md nennt keinen Stand - keine Messung, zaehlt nicht gegen V1 |

**10 von 11 maschinellen Prüfungen bestanden.**

## Fehlgeschlagen

### AK-6

```
ed[39m[22m[90m (3)[39m
[2m      Tests [22m [1m[31m1 failed[39m[22m[2m | [22m[1m[32m14 passed[39m[22m[90m (15)[39m
[2m   Start at [22m 18:17:08
[2m   Duration [22m 32.64s[2m (transform 654ms, setup 0ms, collect 1.48s, tests 29.97s, environment 1ms, prepare 452ms)[22m


[31m⎯⎯⎯⎯⎯⎯⎯[39m[1m[41m Failed Tests 1 [49m[22m[31m⎯⎯⎯⎯⎯⎯⎯[39m

[41m[1m FAIL [22m[49m packages/core/test/perf/worldmap.bench.slow.test.ts[2m > [22mR-ARCH-06 Die Weltkarte traegt die Kernregeln[2m > [22mR-ARCH-06/AK1 haelt das Tickbudget auf 237 Provinzen
[31m[1mAssertionError[22m: Median 4.109 ms: expected 4.109 to be less than 3.5[39m
[36m [2m❯[22m packages/core/test/perf/worldmap.bench.slow.test.ts:[2m154:61[22m[39m
    [90m152| [39m    writeFileSync(`${ROOT}/docs/reports/worldmap-bench.json`, JSON.str…
    [90m153| [39m
    [90m154| [39m    expect(report.medianMs, `Median ${report.medianMs} ms`).toBeLessTh…
    [90m   | [39m                                                            [31m^[39m
    [90m155| [39m    expect(report.p99Ms, `p99 ${report.p99Ms} ms`).toBeLessThan(REQUIR…
    [90m156| [39m  })

[31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯[22m[39m


```

