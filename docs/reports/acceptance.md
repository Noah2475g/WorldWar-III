# Abnahmelauf V1

Erzeugt von `scripts/acceptance.mjs` am 2026-09-26 gegen `00feba3`.

> Dieser Bericht gilt fuer genau diesen Stand. Zeigt `git log --oneline -1` etwas
> anderes, ist er ueberholt und keine Aussage ueber das Projekt (T-M16-01a).

| Kriterium | Prüfung | Ergebnis |
|---|---|---|
| AK-2/3/4 | pnpm verify (Lint, Typen, Tests inkl. Determinismus/Speichern/Kampf, Guards, Abdeckung) | ✅ bestanden |
| AK-1 | Vollständige Partie (pnpm sim:fullgame) | ✅ bestanden |
| AK-6 | Langlauf 1000 Spieltage (pnpm sim:long) | ✅ bestanden |
| AK-6 | Zeitbudgets seriell auf ruhiger Maschine (Tick, Weltkarte, Zeichnen) | ✅ bestanden |
| MESSGERAET | Parameterlauf: seit dem Bericht kein Commit an data/rules, data/maps/world.json (docs/reports/balance-sweep.md) | ✅ bestanden |
| MESSGERAET | Turnier: sauber gemessen, seit dem Messcommit kein Commit an data/rules, data/maps/testworld.json, packages/ai/src, packages/core/src, packages/shared, packages/testkit, apps/headless/src/tournament.ts, apps/headless/test/tournament.slow.test.ts (docs/reports/ai-tournament-run.md) | ✅ bestanden |
| MESSGERAET | Haltungs-Messlauf: sauber gemessen, seit dem Messcommit kein Commit an 8 Quellen, AK5 erfüllt (docs/reports/stance.json) | ✅ bestanden |
| AK-1 | Vollständige Partie: 7 KI-Gegner, entschieden an Tag 675 (1755 Eroberungen, 20 Kriegserklärungen) | ✅ bestanden |
| AK-2 | pnpm coverage:requirements (Anforderungs-Tor) | ✅ bestanden |
| AK-3 | Abdeckung gesamt 97.0 % (Schwelle 80 %) | ✅ bestanden |
| AK-2 | V1-Anforderungen ohne Test: 0 | ✅ bestanden |
| AK-5 | Guards für Monetarisierung und Netzwerk | ✅ bestanden |
| AK-7 | Playtest durch Noah nach `docs/PLAYTEST.md`, Antworten in `docs/reports/playtest-v1.md` | ✅ beantwortet und abgenommen von Noah — Durchführung per /goal-Auftrag vom 2026-09-07 ausdrücklich an Claude delegiert („den Playtest sollst du eigenständig durchführen"); zweiter Durchgang auf Stand a007497 (nach M19–M21) in docs/reports/playtest-2026-09-07-v2.md, Delegationsentscheid in docs/plan/DECISIONS.md (62 Fragen) |
| AK-8 | Verpackung als Programm (T-M16-05) | ✅ erfuellt, gemessen am 2026-09-26 gegen `7a6aa47` - seither nur Dokumente und Tests, das Erzeugnis ist unveraendert, zaehlt nicht gegen V1 |
| AK-9 | Eine Partie zu zweit ueber einen Link (T-M39-09) | ⏸ M39, noch nicht gemessen, zaehlt nicht gegen V1 |

**12 von 12 maschinellen Prüfungen bestanden.**

Alle Abnahmekriterien sind erfüllt, AK-7 eingeschlossen.

## Vermerke (von Hand, nicht vom Skript; gelten fuer `00feba3`)

`scripts/acceptance.mjs` schreibt diese Datei bei jedem Lauf vollstaendig neu
(`writeFileSync`) — dieser Abschnitt ueberlebt also nur bis zum naechsten Lauf und wird dann
zu Recht verworfen; der Bericht gilt ohnehin nur fuer seinen Commit (T-M16-01a, Kopfzeile
oben). Fuenf Vermerke, verlangt von der dod zu T-M17-16:

1. **R-AI-08/AK3 weiterhin nicht erfuellt.** 0 Artillerie, 0 Beschuss im 200-Tage-Lauf
   (Befund M17-T7). Ursache: „normal" und „schwer" bauen **keine** Fabrik trotz
   ausreichend Geld; „leicht" baut Fabriken, hat aber nie genug Geld dafuer. Die Reparatur
   haengt mit Befund M17-S12 zusammen und kippt das Turnierband (0,760 → 0,460) — Noahs
   Entscheid (2026-09-25): beide gehen an M18. `01-REQUIREMENTS.md` Abschnitt R-AI-08/AK3
   traegt den vollen Wortlaut.
2. **R-AI-09/AK3 in der Neufassung.** Woertlich nicht erfuellt (Summe der Ueberfaelle mit
   Antraegen 3 > ohne 1), aber die Anforderung sichert seit der Nacharbeit T-M17-15 eine
   engere, selbst gewaehlte Teilmenge zu — nur die Ueberfaelle, die ein Antrag auf
   Durchmarsch ueberhaupt bewegen kann (`art === 'durchmarsch'` oder `nachKuendigung`) — und
   die haelt (0 ≤ 0). Neue Fassung siehe `01-REQUIREMENTS.md` Abschnitt R-AI-09/AK3.
3. **Befund M17-I1.** Das Turnierband „schwer gegen normal" (0,760, `ai-tournament-run.md`)
   gilt auf dem Stand **mit** dem `RECRUIT_SPY`-Buchungsfehler (Befund M17-S12): `decide.ts`
   bucht `RECRUIT_SPY` desselben Takts nicht vor, wodurch „schwer" mehr Geld fuer anderes
   uebrig hat, als es nach einer richtigen Buchung haette. Wird der Fehler repariert, faellt
   das Band auf 0,460 (siehe `tournament.slow.test.ts`-Kommentar und `PROBLEME.md`). Beide
   Befunde (M17-S12, M17-T7) gehen zusammen an M18.
4. **Befund M17-F1 (Haltungs-Messlauf) ist erledigt.** Anders als im vorherigen Abnahmelauf
   (11 von 12) haelt die MESSGERAET-Pruefung „Haltungs-Messlauf" jetzt: der Messaufbau bekam
   einen Kriegsplan (Landnachbarn erklaeren dem Menschen am Spieltag 20 foermlich den Krieg),
   `docs/reports/stance.json` ist auf `7a6aa47` sauber gemessen, `ak5.erfuellt: true`,
   `verletzt: []`. Volle Herleitung in `PROBLEME.md` (Befund M17-F1, geloest) und
   `DECISIONS.md` (2026-09-26, M17-F1).
5. **`origin/main` ist gemergt.** Der Vorsprung von 45 Commits (PR #9-#11, Touch-Bedienung),
   der in der Nacharbeit zu T-M17-16 gefunden wurde, ist konfliktfrei in diesen Zweig
   gemerged (`65feab8`, `pnpm verify` dort Exit 0, 186 Testdateien) — Noahs Entscheid
   2026-09-26. Dieser Abnahmelauf misst den Merge-Stand samt M17-F1-Fix; AK-8 wurde auf
   diesem Stand vollstaendig nachgeholt (siehe oben, `packaging.md`).
