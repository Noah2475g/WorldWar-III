# Abnahmelauf V1

Erzeugt von `scripts/acceptance.mjs` am 2026-09-06 gegen `5065b99`.

> Dieser Bericht gilt fuer genau diesen Stand. Zeigt `git log --oneline -1` etwas
> anderes, ist er ueberholt und keine Aussage ueber das Projekt (T-M16-01a).

| Kriterium | Prüfung | Ergebnis |
|---|---|---|
| AK-2/3 | pnpm verify (Lint, Typen, Tests, Guards, Abdeckung) | ✅ bestanden |
| AK-4/6 | pnpm test:slow (Langläufe, Turnier, Budgets) | ❌ fehlgeschlagen |
| AK-1 | Vollständige Partie: 7 KI-Gegner, entschieden an Tag 876 (2025 Eroberungen, 11 Kriegserklärungen) | ✅ bestanden |
| AK-2 | pnpm coverage:requirements (Anforderungs-Tor) | ✅ bestanden |
| AK-3 | Abdeckung gesamt 94.4 % (Schwelle 80 %) | ✅ bestanden |
| AK-2 | V1-Anforderungen ohne Test: 0 | ✅ bestanden |
| AK-5 | Guards für Monetarisierung und Netzwerk | ✅ bestanden |
| AK-7 | Playtest durch Noah nach `docs/PLAYTEST.md`, Antworten in `docs/reports/playtest-v1.md` | ⏳ ausstehend (0 von 60 Fragen beantwortet) |
| AK-8 | Verpackung als Programm, gemessen in T-M16-05 | ⏸ M16, zaehlt nicht gegen V1 |

**6 von 7 maschinellen Prüfungen bestanden.**

## Fehlgeschlagen

### AK-4/6

```
2m36 passed[39m[22m[90m (37)[39m
[2m   Start at [22m 21:03:13
[2m   Duration [22m 5416.04s[2m (transform 504ms, setup 0ms, collect 62.37s, tests 5350.96s, environment 1ms, prepare 1.02s)[22m

[ELIFECYCLE] Command failed with exit code 1.
$ vitest run --config vitest.slow.config.ts

[31m⎯⎯⎯⎯⎯⎯⎯[39m[1m[41m Failed Tests 1 [49m[22m[31m⎯⎯⎯⎯⎯⎯⎯[39m

[41m[1m FAIL [22m[49m packages/core/test/perf/worldmap.bench.slow.test.ts[2m > [22mR-ARCH-06 Die Weltkarte traegt die Kernregeln[2m > [22mR-ARCH-06/AK1 haelt das Tickbudget auf 237 Provinzen
[31m[1mAssertionError[22m: Median 3.525 ms: expected 3.525 to be less than 3.5[39m
[36m [2m❯[22m packages/core/test/perf/worldmap.bench.slow.test.ts:[2m133:61[22m[39m
    [90m131| [39m    writeFileSync(`${ROOT}/docs/reports/worldmap-bench.json`, JSON.str…
    [90m132| [39m
    [90m133| [39m    expect(report.medianMs, `Median ${report.medianMs} ms`).toBeLessTh…
    [90m   | [39m                                                            [31m^[39m
    [90m134| [39m    expect(report.p99Ms, `p99 ${report.p99Ms} ms`).toBeLessThan(REQUIR…
    [90m135| [39m  })

[31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯[22m[39m


```

