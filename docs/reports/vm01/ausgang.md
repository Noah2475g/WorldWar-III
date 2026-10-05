# VM-01 · Ausgangswerte (main 25aafa4, 2026-10-04)

| Messgerät | Wert | Quelle (Datei:Zeile) |
|---|---|---|
| Turnier, Gemessen auf | 9be3821299336c991c68b24531bf62ad632ed33d | docs/reports/ai-tournament-run.md:8 |
| Turnier schwer gegen leicht, im Krieg | 84 % | docs/reports/ai-tournament-run.md:12 |
| Turnier schwer gegen normal, im Frieden | 61 % | docs/reports/ai-tournament-run.md:13 |
| Turnier schwer gegen normal, im Krieg | 63 % | docs/reports/ai-tournament-run.md:14 |
| progress anteilDesStaerksten | 0.335 | docs/reports/progress-measured.json:33 |
| Vollpartie 1914 (fullgame.json) | decidedOnDay 589, winner p6, captures 1612, battles 3422 | docs/reports/fullgame.json:16-21 |
| Vollpartie 1683 | decidedOnDay 594, winner p7, captures 1467, battles 3074 | docs/reports/fullgame-1683.json:16-21 |
| Vollpartie 1789 | decidedOnDay 953, winner p6, captures 1914, battles 6037 | docs/reports/fullgame-1789.json:16-21 |
| Vollpartie 1806 | decidedOnDay 468, winner p8, captures 1134, battles 3151 | docs/reports/fullgame-1806.json:16-21 |
| Vollpartie 1815 | decidedOnDay 596, winner p7, captures 2139, battles 3369 | docs/reports/fullgame-1815.json:16-21 |
| Vollpartie 1871 | decidedOnDay 522, winner p6, captures 1330, battles 3322 | docs/reports/fullgame-1871.json:16-21 |
| Vollpartie 1939 | decidedOnDay 541, winner p6, captures 1321, battles 3559 | docs/reports/fullgame-1939.json:16-21 |
| Vollpartie 1945 | decidedOnDay 397, winner p6, captures 965, battles 2739 | docs/reports/fullgame-1945.json:16-21 |
| Vollpartie 2015 | decidedOnDay 627, winner p6, captures 1490, battles 4239 | docs/reports/fullgame-2015.json:16-21 |
| Haltung measuredAtCommit | 91faf0320e4b8a2ffeaf39ed8eed26d652fa00a5 | docs/reports/stance.json:533 |
| Haltung letztes erfuellt (ak5) | true | docs/reports/stance.json:570 |
| Verhaltens-Hash S100 | 90f716751cc5344f | docs/reports/v3/verhalten-hash.json:6 |
| Verhaltens-Hash S300 | 098e6884b64480a2 | docs/reports/v3/verhalten-hash.json:12 |
| Verhaltens-Hash (dritter) | 3d6a07bd3cd17a07 | docs/reports/v3/verhalten-hash.json:18 |

Frische: Auf main 25aafa4 waren alle drei Messgeräte frisch (Messung des Planers). Im Zweig
`claude/vm01-schonfrist` sind Turnier und Haltungs-Messlauf nur deshalb `fresh: false`, weil der
cherry-pickte Testcommit 91c9d71 (nur `packages/core/src/commands/recruitConquered.test.ts`, kein
Spielverhalten) unter `packages/core/src` liegt. Parameterlauf bleibt frisch.

allFreshness-Ausgabe im Zweig (nach cherry-pick 91c9d71):

```json
[
 {
  "name": "Parameterlauf",
  "fresh": true,
  "reason": "seit dem Bericht (b8d36e6) kein Commit an data/rules, data/maps/world.json auf HEAD"
 },
 {
  "name": "Turnier",
  "fresh": false,
  "reason": "seit dem Messcommit 9be3821 aus docs/reports/ai-tournament-run.md liegt auf HEAD mindestens ein Commit an data/rules, data/maps/testworld.json, packages/ai/src, packages/core/src, packages/shared, packages/testkit, apps/headless/src/tournament.ts, apps/headless/test/tournament.slow.test.ts (91c9d71) - die Quellen sind juenger als die Messung"
 },
 {
  "name": "Haltungs-Messlauf",
  "fresh": false,
  "reason": "seit dem Messcommit 91faf03 aus docs/reports/stance.json liegt auf HEAD mindestens ein Commit an den Quellen des Messlaufs (91c9d71) - die Automatik ist ungemessen"
 }
]
```
