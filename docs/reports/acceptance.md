# Abnahmelauf V1

Erzeugt von `scripts/acceptance.mjs` am 2026-09-11 gegen `dd6087a`.

> Dieser Bericht gilt fuer genau diesen Stand. Zeigt `git log --oneline -1` etwas
> anderes, ist er ueberholt und keine Aussage ueber das Projekt (T-M16-01a).

| Kriterium | Prüfung | Ergebnis |
|---|---|---|
| AK-2/3/4 | pnpm verify (Lint, Typen, Tests inkl. Determinismus/Speichern/Kampf, Guards, Abdeckung) | ❌ fehlgeschlagen |
| AK-1 | Vollständige Partie (pnpm sim:fullgame) | ✅ bestanden |
| AK-6 | Langlauf 1000 Spieltage (pnpm sim:long) | ✅ bestanden |
| AK-6 | Zeitbudgets seriell auf ruhiger Maschine (Tick, Weltkarte, Zeichnen) | ✅ bestanden |
| MESSGERAET | Parameterlauf ist frischer als die letzte Regeländerung (docs/reports/balance-sweep.md) | ✅ bestanden |
| MESSGERAET | Turnier ist frischer als die letzte Regeländerung (docs/reports/ai-tournament-run.md) | ✅ bestanden |
| AK-1 | Vollständige Partie: 7 KI-Gegner, entschieden an Tag 798 (2717 Eroberungen, 15 Kriegserklärungen) | ✅ bestanden |
| AK-2 | pnpm coverage:requirements (Anforderungs-Tor) | ✅ bestanden |
| AK-2 | V1-Anforderungen ohne Test: 0 | ✅ bestanden |
| AK-5 | Guards für Monetarisierung und Netzwerk | ❌ fehlgeschlagen |
| AK-7 | Playtest durch Noah nach `docs/PLAYTEST.md`, Antworten in `docs/reports/playtest-v1.md` | ✅ beantwortet und abgenommen von Noah — Durchführung per /goal-Auftrag vom 2026-09-07 ausdrücklich an Claude delegiert („den Playtest sollst du eigenständig durchführen"); zweiter Durchgang auf Stand a007497 (nach M19–M21) in docs/reports/playtest-2026-09-07-v2.md, Delegationsentscheid in docs/plan/DECISIONS.md (62 Fragen) |
| AK-8 | Verpackung als Programm (T-M16-05) | ⚠ docs/reports/packaging.md nennt keinen Stand - keine Messung, zaehlt nicht gegen V1 |

**8 von 10 maschinellen Prüfungen bestanden.**

## Fehlgeschlagen

### AK-2/3/4

```
FAIL [22m[49m test/guards/no-foreign-assets.test.ts[2m > [22mR-ASSET-01 Kein Asset ohne Herkunfts- und Lizenzeintrag[2m > [22muebernimmt nichts aus den Vorbildern
[31m[1mAssertionError[22m: expected [ { …(3) } ] to deeply equal [][39m

[32m- Expected[39m
[31m+ Received[39m

[32m- [][39m
[31m+ [[39m
[31m+   {[39m
[31m+     "file": "apps\\desktop\\src\\ui\\Tooltip.tsx",[39m
[31m+     "line": 10,[39m
[31m+     "text": "* Supremacy erklaert jede Provinz, sobald der Zeiger darauf liegt; wir taten es nur im",[39m
[31m+   },[39m
[31m+ ][39m

[36m [2m❯[22m test/guards/no-foreign-assets.test.ts:[2m125:58[22m[39m
    [90m123| [39m    // Regeln sind nicht geschuetzt, ihre Darstellung schon: im Produk…
    [90m124| [39m    [90m// Vorbild als Quelle von Inhalten auftauchen.[39m
    [90m125| [39m    [34mexpect[39m([34mscan[39m([36m/supremacy|bytro|conflict of nations/i[39m))[33m.[39m[34mtoEqual[39m([])
    [90m   | [39m                                                         [31m^[39m
    [90m126| [39m  })
    [90m127| [39m})

[31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯[22m[39m


✖ verify fehlgeschlagen bei: Tests + Guards (ohne @slow)

```

### AK-5

```
41m Failed Tests 1 [49m[22m[31m⎯⎯⎯⎯⎯⎯⎯[39m

[41m[1m FAIL [22m[49m test/guards/no-foreign-assets.test.ts[2m > [22mR-ASSET-01 Kein Asset ohne Herkunfts- und Lizenzeintrag[2m > [22muebernimmt nichts aus den Vorbildern
[31m[1mAssertionError[22m: expected [ { …(3) } ] to deeply equal [][39m

[32m- Expected[39m
[31m+ Received[39m

[32m- [][39m
[31m+ [[39m
[31m+   {[39m
[31m+     "file": "apps\\desktop\\src\\ui\\Tooltip.tsx",[39m
[31m+     "line": 10,[39m
[31m+     "text": "* Supremacy erklaert jede Provinz, sobald der Zeiger darauf liegt; wir taten es nur im",[39m
[31m+   },[39m
[31m+ ][39m

[36m [2m❯[22m test/guards/no-foreign-assets.test.ts:[2m125:58[22m[39m
    [90m123| [39m    // Regeln sind nicht geschuetzt, ihre Darstellung schon: im Produk…
    [90m124| [39m    [90m// Vorbild als Quelle von Inhalten auftauchen.[39m
    [90m125| [39m    [34mexpect[39m([34mscan[39m([36m/supremacy|bytro|conflict of nations/i[39m))[33m.[39m[34mtoEqual[39m([])
    [90m   | [39m                                                         [31m^[39m
    [90m126| [39m  })
    [90m127| [39m})

[31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯[22m[39m


```

