# Abnahmelauf V1

Erzeugt von `scripts/acceptance.mjs` am 2026-09-03.

| Kriterium | Prüfung | Ergebnis |
|---|---|---|
| AK-2/3 | pnpm verify (Lint, Typen, Tests, Guards, Abdeckung) | ✅ bestanden |
| AK-1/4/6 | pnpm test:slow (Langläufe, Turnier, Budgets) | ✅ bestanden |
| AK-2 | pnpm coverage:requirements (Anforderungs-Tor) | ✅ bestanden |
| AK-3 | Abdeckung gesamt 91.0 % (Schwelle 80 %) | ✅ bestanden |
| AK-2 | Anforderungen ohne Test: 0 | ✅ bestanden |
| AK-5 | Guards für Monetarisierung und Netzwerk | ✅ bestanden |
| AK-7 | Playtest durch Noah nach `docs/PLAYTEST.md` | ⏳ ausstehend |

**6 von 6 maschinellen Prüfungen bestanden.**

Alle maschinell prüfbaren Abnahmekriterien sind erfüllt. Offen bleibt AK-7 — der Playtest, für den kein Skript einspringen kann: ob das Spiel Spaß macht, findet nur ein Mensch heraus.
