# Abnahmelauf V1

Erzeugt von `scripts/acceptance.mjs` am 2026-09-06.

| Kriterium | Prüfung | Ergebnis |
|---|---|---|
| AK-2/3 | pnpm verify (Lint, Typen, Tests, Guards, Abdeckung) | ✅ bestanden |
| AK-4/6 | pnpm test:slow (Langläufe, Turnier, Budgets) | ❌ fehlgeschlagen |
| AK-1 | Vollständige Partie: 7 KI-Gegner, entschieden an Tag — (2664 Eroberungen, 11 Kriegserklärungen) | ❌ fehlgeschlagen |
| AK-2 | pnpm coverage:requirements (Anforderungs-Tor) | ✅ bestanden |
| AK-3 | Abdeckung gesamt 94.4 % (Schwelle 80 %) | ✅ bestanden |
| AK-2 | V1-Anforderungen ohne Test: 0 | ✅ bestanden |
| AK-5 | Guards für Monetarisierung und Netzwerk | ✅ bestanden |
| AK-7 | Playtest durch Noah nach `docs/PLAYTEST.md`, Antworten in `docs/reports/playtest-v1.md` | ⏳ ausstehend (0 von 60 Fragen beantwortet) |

**5 von 7 maschinellen Prüfungen bestanden.**

## Fehlgeschlagen

### AK-4/6

```
664 Eroberungen, 11 Kriegserklaerungen): expected null not to be null[39m
[36m [2m❯[22m apps/headless/test/fullgame.slow.test.ts:[2m119:11[22m[39m
    [90m117| [39m      result[33m.[39mstate[33m.[39mvictory[33m.[39mwinner[33m,[39m
    [90m118| [39m      `nach ${tag} Spieltagen unentschieden (${eroberungen} Eroberunge…
    [90m119| [39m    )[33m.[39mnot[33m.[39m[34mtoBeNull[39m()
    [90m   | [39m          [31m^[39m
    [90m120| [39m  }[33m,[39m [34m1_800_000[39m)
    [90m121| [39m})

[31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯[22m[39m

[41m[1m FAIL [22m[49m packages/core/test/perf/tick.bench.slow.test.ts[2m > [22mR-AI-04 Rechenzeit der KI[2m > [22mbleibt unter dreissig Prozent der Tickzeit
[31m[1mAssertionError[22m: expected 0.5172626387176755 to be less than 0.5[39m
[36m [2m❯[22m packages/core/test/perf/tick.bench.slow.test.ts:[2m122:19[22m[39m
    [90m120| [39m    )
    [90m121| [39m
    [90m122| [39m    [34mexpect[39m(share)[33m.[39m[34mtoBeLessThan[39m([34m0.5[39m)
    [90m   | [39m                  [31m^[39m
    [90m123| [39m  })
    [90m124| [39m})

[31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯[22m[39m


```

### AK-1

```
undefined
```

