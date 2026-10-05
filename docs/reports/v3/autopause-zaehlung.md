# Auto-Pause-Zaehlung (VM-06, B1)

Gemessen auf: c67f6cf · Ausloeser: WAR_DECLARED an mich, CAPITAL_LOST (ARMY_INTRUDED gestrichen, siehe unten) · Pause = Tick mit >= 1 Ausloeser, keine Sperrzeit · jede Macht als Betrachter · Gate: max. 10 je Macht und Partie.

Erzeugt von `apps/headless/test/autopause-zaehlung.slow.test.ts`. Simulation (KI spielt alle Maechte), keine Zeitmessung.

**Streichung (P2):** Erstlauf mit ARMY_INTRUDED in die eigene Hauptstadt als dritten Ausloeser: Maximum 38 Pausen (1914, p7) und 90 (1915, p7) - Gate gerissen. ARMY_INTRUDED wurde laut Plan gestrichen; die Zahlen unten gelten fuer WAR_DECLARED + CAPITAL_LOST.

## Startzahl 1914

Entscheidung an Tag 589, Sieger p6. Ausloeser gesamt: 22, Paritaetspruefung (firstAlertFor): 22 von 22 bestanden. **Maximum: 7 Pausen (p7)** - Gate <= 10: erfuellt.

| Macht | Pausen | Typen |
| --- | ---: | --- |
| p1 | 0 | - |
| p2 | 0 | - |
| p3 | 1 | WAR_DECLARED: 1 |
| p4 | 2 | WAR_DECLARED: 2 |
| p5 | 1 | WAR_DECLARED: 1 |
| p6 | 4 | WAR_DECLARED: 2, CAPITAL_LOST: 2 |
| p7 | 7 | WAR_DECLARED: 1, CAPITAL_LOST: 6 |
| p8 | 7 | CAPITAL_LOST: 7 |

## Startzahl 1915

Entscheidung an Tag 535, Sieger p6. Ausloeser gesamt: 15, Paritaetspruefung (firstAlertFor): 15 von 15 bestanden. **Maximum: 6 Pausen (p7)** - Gate <= 10: erfuellt.

| Macht | Pausen | Typen |
| --- | ---: | --- |
| p1 | 0 | - |
| p2 | 0 | - |
| p3 | 0 | - |
| p4 | 1 | WAR_DECLARED: 1 |
| p5 | 1 | WAR_DECLARED: 1 |
| p6 | 1 | WAR_DECLARED: 1 |
| p7 | 6 | WAR_DECLARED: 1, CAPITAL_LOST: 5 |
| p8 | 6 | CAPITAL_LOST: 5, WAR_DECLARED: 1 |
