# Abnahmelauf V1

Erzeugt von `scripts/acceptance.mjs` am 2026-09-11 gegen `23b0823`.

> Dieser Bericht gilt fuer genau diesen Stand. Zeigt `git log --oneline -1` etwas
> anderes, ist er ueberholt und keine Aussage ueber das Projekt (T-M16-01a).

| Kriterium | Prüfung | Ergebnis |
|---|---|---|
| AK-2/3/4 | pnpm verify (Lint, Typen, Tests inkl. Determinismus/Speichern/Kampf, Guards, Abdeckung) | ❌ fehlgeschlagen |
| AK-1 | Vollständige Partie (pnpm sim:fullgame) | ✅ bestanden |
| AK-6 | Langlauf 1000 Spieltage (pnpm sim:long) | ✅ bestanden |
| AK-6 | Zeitbudgets seriell auf ruhiger Maschine (Tick, Weltkarte, Zeichnen) | ❌ fehlgeschlagen |
| MESSGERAET | Parameterlauf ist frischer als die letzte Regeländerung (docs/reports/balance-sweep.md) | ✅ bestanden |
| MESSGERAET | Turnier ist frischer als die letzte Regeländerung (docs/reports/ai-tournament-run.md) | ✅ bestanden |
| AK-1 | Vollständige Partie: 7 KI-Gegner, entschieden an Tag 798 (2717 Eroberungen, 15 Kriegserklärungen) | ✅ bestanden |
| AK-2 | pnpm coverage:requirements (Anforderungs-Tor) | ✅ bestanden |
| AK-2 | V1-Anforderungen ohne Test: 0 | ✅ bestanden |
| AK-5 | Guards für Monetarisierung und Netzwerk | ✅ bestanden |
| AK-7 | Playtest durch Noah nach `docs/PLAYTEST.md`, Antworten in `docs/reports/playtest-v1.md` | ✅ beantwortet und abgenommen von Noah — Durchführung per /goal-Auftrag vom 2026-09-07 ausdrücklich an Claude delegiert („den Playtest sollst du eigenständig durchführen"); zweiter Durchgang auf Stand a007497 (nach M19–M21) in docs/reports/playtest-2026-09-07-v2.md, Delegationsentscheid in docs/plan/DECISIONS.md (62 Fragen) |
| AK-8 | Verpackung als Programm (T-M16-05) | ⚠ docs/reports/packaging.md nennt keinen Stand - keine Messung, zaehlt nicht gegen V1 |

**8 von 10 maschinellen Prüfungen bestanden.**

## Fehlgeschlagen

### AK-2/3/4

```
 {
    [90m 10| [39m  it('verbietet dem Kern den Griff nach KI und Dateisystem', async () …
    [90m   | [39m  [31m^[39m
    [90m 11| [39m    const messages = await lintAs(fixture('import-boundaries'), 'packa…
    [90m 12| [39m    expect(messages.join('\n')).toMatch(/Dependency direction|file sys…

[31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯[22m[39m

[41m[1m FAIL [22m[49m apps/desktop/src/App.test.tsx[2m > [22mR-TIME-06 Das Protokoll spricht in ganzen Zeilen[2m > [22mgibt dem Text jeder Zeile die flexible Spur — auch mit Rubriksymbol davor
[31m[1mError[22m: Test timed out in 5000ms.
If this is a long-running test, pass a timeout value as the last argument or configure it globally with "testTimeout".[39m
[36m [2m❯[22m apps/desktop/src/App.test.tsx:[2m285:3[22m[39m
    [90m283| [39m  }
    [90m284| [39m
    [90m285| [39m  it('gibt dem Text jeder Zeile die flexible Spur — auch mit Rubriksym…
    [90m   | [39m  [31m^[39m
    [90m286| [39m    [35mconst[39m style [33m=[39m [34mwithStylesheet[39m()
    [90m287| [39m    [35mtry[39m {

[31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯[22m[39m


✖ verify fehlgeschlagen bei: Tests + Guards (ohne @slow)

```

### AK-6

```
ed[39m[22m[90m (3)[39m
[2m      Tests [22m [1m[31m1 failed[39m[22m[2m | [22m[1m[32m14 passed[39m[22m[90m (15)[39m
[2m   Start at [22m 17:24:58
[2m   Duration [22m 43.15s[2m (transform 750ms, setup 0ms, collect 1.70s, tests 40.04s, environment 1ms, prepare 520ms)[22m


[31m⎯⎯⎯⎯⎯⎯⎯[39m[1m[41m Failed Tests 1 [49m[22m[31m⎯⎯⎯⎯⎯⎯⎯[39m

[41m[1m FAIL [22m[49m packages/core/test/perf/worldmap.bench.slow.test.ts[2m > [22mR-ARCH-06 Die Weltkarte traegt die Kernregeln[2m > [22mR-ARCH-06/AK1 haelt das Tickbudget auf 237 Provinzen
[31m[1mAssertionError[22m: Median 5.735 ms: expected 5.735 to be less than 3.5[39m
[36m [2m❯[22m packages/core/test/perf/worldmap.bench.slow.test.ts:[2m154:61[22m[39m
    [90m152| [39m    writeFileSync(`${ROOT}/docs/reports/worldmap-bench.json`, JSON.str…
    [90m153| [39m
    [90m154| [39m    expect(report.medianMs, `Median ${report.medianMs} ms`).toBeLessTh…
    [90m   | [39m                                                            [31m^[39m
    [90m155| [39m    expect(report.p99Ms, `p99 ${report.p99Ms} ms`).toBeLessThan(REQUIR…
    [90m156| [39m  })

[31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯[22m[39m


```

