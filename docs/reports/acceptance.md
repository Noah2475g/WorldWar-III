# Abnahmelauf V1

Erzeugt von `scripts/acceptance.mjs` am 2026-09-07 gegen `058f45b`.

> Dieser Bericht gilt fuer genau diesen Stand. Zeigt `git log --oneline -1` etwas
> anderes, ist er ueberholt und keine Aussage ueber das Projekt (T-M16-01a).

| Kriterium | Prüfung | Ergebnis |
|---|---|---|
| AK-2/3 | pnpm verify (Lint, Typen, Tests, Guards, Abdeckung) | ✅ bestanden |
| AK-4/6 | pnpm test:slow (Langläufe, Turnier, Budgets) | ✅ bestanden |
| AK-1 | Vollständige Partie: 7 KI-Gegner, entschieden an Tag 876 (2025 Eroberungen, 11 Kriegserklärungen) | ✅ bestanden |
| AK-2 | pnpm coverage:requirements (Anforderungs-Tor) | ✅ bestanden |
| AK-3 | Abdeckung gesamt 95.1 % (Schwelle 80 %) | ✅ bestanden |
| AK-2 | V1-Anforderungen ohne Test: 0 | ✅ bestanden |
| AK-5 | Guards für Monetarisierung und Netzwerk | ✅ bestanden |
| AK-7 | Playtest durch Noah nach `docs/PLAYTEST.md`, Antworten in `docs/reports/playtest-v1.md` | ✅ beantwortet (60 Fragen) |
| AK-8 | Verpackung als Programm (T-M16-05) | ⚠ gemessen am 2026-09-07 gegen `1c33ec7` - nicht dieser Stand, siehe `docs/reports/packaging.md`, zaehlt nicht gegen V1 |

**7 von 7 maschinellen Prüfungen bestanden.**

Alle maschinell prüfbaren Abnahmekriterien sind erfüllt. Offen bleibt AK-7 — der Playtest, für den kein Skript einspringen kann: ob das Spiel Spaß macht, findet nur ein Mensch heraus.
