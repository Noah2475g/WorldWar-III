# Abnahmelauf V1

Erzeugt von `scripts/acceptance.mjs` am 2026-09-25 gegen `b8d36e6`.

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
| MESSGERAET | Haltungs-Messlauf: sauber gemessen, seit dem Messcommit kein Commit an 8 Quellen, AK5 erfüllt (docs/reports/stance.json) | ❌ fehlgeschlagen |
| AK-1 | Vollständige Partie: 7 KI-Gegner, entschieden an Tag 675 (1755 Eroberungen, 20 Kriegserklärungen) | ✅ bestanden |
| AK-2 | pnpm coverage:requirements (Anforderungs-Tor) | ✅ bestanden |
| AK-3 | Abdeckung gesamt 96.7 % (Schwelle 80 %) | ✅ bestanden |
| AK-2 | V1-Anforderungen ohne Test: 0 | ✅ bestanden |
| AK-5 | Guards für Monetarisierung und Netzwerk | ✅ bestanden |
| AK-7 | Playtest durch Noah nach `docs/PLAYTEST.md`, Antworten in `docs/reports/playtest-v1.md` | ✅ beantwortet und abgenommen von Noah — Durchführung per /goal-Auftrag vom 2026-09-07 ausdrücklich an Claude delegiert („den Playtest sollst du eigenständig durchführen"); zweiter Durchgang auf Stand a007497 (nach M19–M21) in docs/reports/playtest-2026-09-07-v2.md, Delegationsentscheid in docs/plan/DECISIONS.md (62 Fragen) |
| AK-8 | Verpackung als Programm (T-M16-05) | ⚠ gemessen am 2026-09-14 gegen `e82c2bc` - seither 57 Datei(en) am Erzeugnis geaendert, siehe `docs/reports/packaging.md`, zaehlt nicht gegen V1 |
| AK-9 | Eine Partie zu zweit ueber einen Link (T-M39-09) | ⏸ M39, noch nicht gemessen, zaehlt nicht gegen V1 |

**11 von 12 maschinellen Prüfungen bestanden.**

## Fehlgeschlagen

### MESSGERAET

```
seit dem Messcommit b1bb3c8 aus docs/reports/stance.json liegt auf HEAD mindestens ein Commit an den Quellen des Messlaufs (de8d246) - die Automatik ist ungemessen — bitte WORLDWAR_WRITE_REPORT=1 pnpm vitest run --config vitest.slow.config.ts apps/headless/test/stance.slow.test.ts auf sauberem Arbeitsbaum laufen lassen und docs/reports/stance.json einchecken
```

*(Nacharbeit T-M17-16: dieser Abschnitt zeigte vorher `undefined` — `scripts/acceptance.mjs`
las `r.output` statt des tatsächlich gesetzten Felds `r.detail`; das Skript ist berichtigt,
der Text oben von Hand aus `stanceFreshness()` nachgetragen.)*

## Vermerke (von Hand, nicht vom Skript; gelten fuer `b8d36e6`)

`scripts/acceptance.mjs` schreibt diese Datei bei jedem Lauf vollstaendig neu
(`writeFileSync`) — dieser Abschnitt ueberlebt also nur bis zum naechsten Lauf und wird dann
zu Recht verworfen; der Bericht gilt ohnehin nur fuer seinen Commit (T-M16-01a, Kopfzeile
oben). Drei Vermerke, verlangt von der dod zu T-M17-16:

1. **R-AI-08/AK3 weiterhin nicht erfuellt.** 0 Artillerie, 0 Beschuss im 200-Tage-Lauf
   (Befund M17-T7). Ursache (berichtigt in der Nacharbeit 2026-09-25): „normal" und „schwer"
   bauen **keine** Fabrik trotz ausreichend Geld; „leicht" baut Fabriken, hat aber nie genug
   Geld dafuer. Die Reparatur haengt an Befund M17-S12 zusammen und kippt das Turnierband
   (0,760 → 0,460) — Noahs Entscheid (2026-09-25): beide gehen an M18. `01-REQUIREMENTS.md`
   Abschnitt R-AI-08/AK3 traegt den vollen Wortlaut.
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
4. **Zusaetzlich zu diesem Lauf (T-M17-16):** die MESSGERAET-Pruefung „Haltungs-Messlauf"
   ist zu Recht rot — `docs/reports/stance.json` steht absichtlich auf dem alten Stand
   (`b1bb3c8`), weil der neu gemessene Nachher-Stand an der festen Kontrollzahl reisst
   (**Befund M17-F1**, `PROBLEME.md`: 76 Einmaersche/4 verlorene Provinzen fielen auf 0/0).
   Provinz-Tage und Verluste-ohne-Gefecht bleiben zwar ueber ihrer Schwelle, aber bei 0
   Einmaerschen wird die Verteidigungsautomatik in diesem Lauf gar nicht ausgeloest — das ist
   **ungeprueft**, nicht „gehalten". Ein roter Messstand wird nicht eingecheckt, damit
   `allFreshness` keinen gruenen Anschein erweckt, der nicht stimmt — dieser Abnahmelauf
   bleibt deshalb bei **11 von 12** stehen, bis Noah entschieden hat, ob die Kontrollzahl
   bewusst neu kalibriert wird oder ob 0 Einmaersche selbst ein Befund ueber die KI ist.
5. **Nachgetragen in der Nacharbeit zu T-M17-16:** dieser Lauf misst `claude/m17-tiefe-
   zwischen-den-kriegen` ohne die 45 Commits, um die `origin/main` (`30c0b3f`, PR #9-#11)
   inzwischen vor diesem Zweig liegt (Basis `8bda869`). Alle Zahlen oben gelten nur fuer
   diesen Stand; vor dem Pull Request muss `origin/main` gemergt und dieser Lauf auf dem
   Merge-Stand wiederholt werden (`WORKFLOW.md` §2 Punkt 1, Blocker 3).

