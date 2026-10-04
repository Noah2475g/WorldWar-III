# Ereignisdichte je Spielabschnitt (T-M46-16)

Gemessen auf: 2b8e314 · Startzahl 1914 · Aufstellung: ausgeliefert (Weltkarte, 1 Mensch ohne Befehle + 7 KI) · Entscheidung an Tag 589 (Tick 14136), Sieger p6.

Erzeugt von `apps/headless/test/ereignisdichte.slow.test.ts` (`pnpm test:slow` mit dieser Datei). Simulation, keine Zeitmessung. Fenster: je 50 Spieltage, nach Tick des Ereignisses.

**Grenze:** der Mensch befiehlt nichts. Das misst die KI-Umwelt; was ein handelnder Mensch ausloest oder abwendet, fehlt.

## Ereignisse und Alarme

| Tage | Ereignisse | je Tag | Alarme | sichtbar fuer Mensch | betrifft Mensch | davon Alarme |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 0-49 | 3793 | 75.9 | 103 | 149 | 4 | 0 |
| 50-99 | 5862 | 117.2 | 618 | 562 | 10 | 0 |
| 100-149 | 6428 | 128.6 | 1214 | 1078 | 15 | 0 |
| 150-199 | 7033 | 140.7 | 1158 | 1021 | 14 | 0 |
| 200-249 | 6186 | 123.7 | 1048 | 1090 | 27 | 0 |
| 250-299 | 5416 | 108.3 | 806 | 875 | 20 | 0 |
| 300-349 | 5255 | 105.1 | 1034 | 987 | 14 | 0 |
| 350-399 | 8219 | 164.4 | 1080 | 1092 | 17 | 0 |
| 400-449 | 7102 | 142.0 | 781 | 754 | 16 | 1 |
| 450-499 | 6809 | 136.2 | 673 | 566 | 18 | 0 |
| 500-549 | 4991 | 99.8 | 298 | 303 | 24 | 0 |
| 550-599 | 4860 | 124.6 | 403 | 391 | 20 | 1 |

## Krieg und Gefahr fuer den Menschen

| Tage | Kriegserklaerungen | davon an Mensch | Kriege gleichzeitig (Schnitt) | Kriege (Spitze) | Kriege mit Mensch (Spitze) | Einmaersche | Provinzen verloren | Armeen verloren | Kaempfe auf seinem Boden |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0-49 | 3 | 0 | 0.9 | 3 | 0 | 0 | 0 | 0 | 0 |
| 50-99 | 2 | 0 | 3.5 | 4 | 0 | 0 | 0 | 0 | 0 |
| 100-149 | 0 | 0 | 4.0 | 4 | 0 | 0 | 0 | 0 | 0 |
| 150-199 | 1 | 0 | 3.2 | 4 | 0 | 0 | 0 | 0 | 0 |
| 200-249 | 0 | 0 | 2.6 | 3 | 0 | 0 | 0 | 0 | 0 |
| 250-299 | 1 | 0 | 2.3 | 3 | 0 | 0 | 0 | 0 | 0 |
| 300-349 | 0 | 0 | 3.0 | 3 | 0 | 0 | 0 | 0 | 0 |
| 350-399 | 0 | 0 | 3.0 | 3 | 0 | 0 | 0 | 0 | 0 |
| 400-449 | 0 | 0 | 1.2 | 3 | 0 | 0 | 0 | 0 | 0 |
| 450-499 | 0 | 0 | 1.0 | 1 | 0 | 0 | 0 | 0 | 0 |
| 500-549 | 0 | 0 | 1.0 | 1 | 0 | 0 | 0 | 0 | 0 |
| 550-599 | 0 | 0 | 1.0 | 1 | 0 | 0 | 0 | 0 | 0 |

## Ereignisse je Typ

| Typ | 0-49 | 50-99 | 100-149 | 150-199 | 200-249 | 250-299 | 300-349 | 350-399 | 400-449 | 450-499 | 500-549 | 550-599 | gesamt |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ARMY_ARRIVED | 608 | 1224 | 1286 | 1537 | 1178 | 1171 | 892 | 835 | 845 | 1187 | 1031 | 710 | 12504 |
| ARMY_DEPARTED | 1000 | 1483 | 1408 | 1501 | 1272 | 1127 | 963 | 929 | 1006 | 1250 | 1047 | 716 | 13702 |
| ARMY_DESTROYED (Alarm) | 12 | 124 | 277 | 306 | 192 | 151 | 206 | 209 | 195 | 185 | 35 | 94 | 1986 |
| ARMY_INTRUDED (Alarm) | 23 | 162 | 306 | 339 | 288 | 207 | 251 | 238 | 131 | 86 | 32 | 100 | 2163 |
| ARMY_RETREATED | 11 | 82 | 51 | 113 | 113 | 86 | 133 | 105 | 52 | 11 | 0 | 36 | 793 |
| BATTLE_RESOLVED | 42 | 236 | 431 | 504 | 500 | 374 | 377 | 432 | 260 | 107 | 20 | 139 | 3422 |
| BATTLE_STARTED (Alarm) | 23 | 143 | 287 | 314 | 251 | 189 | 219 | 196 | 108 | 64 | 13 | 68 | 1875 |
| BOMBARDMENT | 0 | 0 | 0 | 0 | 0 | 2 | 146 | 3175 | 2604 | 2068 | 1053 | 1682 | 10730 |
| BUILD_CANCELLED | 0 | 0 | 0 | 0 | 0 | 1 | 2 | 1 | 2 | 2 | 0 | 1 | 9 |
| BUILD_COMPLETED | 108 | 71 | 61 | 79 | 71 | 73 | 62 | 65 | 64 | 63 | 92 | 67 | 876 |
| BUILD_STARTED | 114 | 78 | 75 | 84 | 87 | 93 | 98 | 97 | 106 | 105 | 107 | 81 | 1125 |
| CAPITAL_LOST (Alarm) | 0 | 0 | 2 | 1 | 0 | 3 | 3 | 2 | 1 | 2 | 0 | 1 | 15 |
| CAPITAL_MOVED | 0 | 0 | 2 | 1 | 0 | 3 | 2 | 3 | 0 | 1 | 1 | 1 | 14 |
| DAY_REPORT | 49 | 50 | 50 | 50 | 50 | 50 | 50 | 50 | 50 | 50 | 50 | 40 | 589 |
| DIPLOMACY_CHANGED | 2 | 3 | 0 | 2 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 9 |
| GAME_ENDED (Alarm) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 |
| GOAL_REACHED | 0 | 0 | 1 | 1 | 0 | 0 | 1 | 0 | 1 | 0 | 1 | 0 | 5 |
| PLAYER_ELIMINATED (Alarm) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 1 |
| PROVINCE_CAPTURED (Alarm) | 28 | 84 | 167 | 88 | 155 | 135 | 181 | 227 | 183 | 178 | 113 | 73 | 1612 |
| PROVINCE_REVOLTED (Alarm) | 3 | 39 | 124 | 49 | 107 | 101 | 141 | 165 | 136 | 146 | 82 | 49 | 1142 |
| RESOURCE_SHORTAGE | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 6 | 8 | 9 | 0 | 0 | 25 |
| RIGHT_OF_WAY_CHANGED | 0 | 2 | 0 | 4 | 1 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 9 |
| SABOTAGE_SUFFERED (Alarm) | 11 | 64 | 51 | 60 | 55 | 19 | 33 | 43 | 26 | 12 | 23 | 17 | 414 |
| SPY_DETECTED | 6 | 0 | 0 | 12 | 4 | 23 | 0 | 11 | 1 | 16 | 4 | 4 | 81 |
| SPY_REPORT | 62 | 281 | 211 | 286 | 255 | 138 | 191 | 171 | 109 | 66 | 86 | 64 | 1920 |
| TRADE_EXECUTED | 1087 | 1080 | 1028 | 1029 | 1025 | 1017 | 871 | 855 | 796 | 800 | 798 | 620 | 11006 |
| TRADE_OFFER_CLOSED | 4 | 10 | 15 | 14 | 27 | 20 | 14 | 17 | 15 | 18 | 24 | 19 | 197 |
| UNIT_RECRUITED | 597 | 644 | 595 | 658 | 554 | 429 | 417 | 387 | 402 | 383 | 379 | 277 | 5722 |
| WAR_DECLARED (Alarm) | 3 | 2 | 0 | 1 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 7 |

## Deutung

- **Wo es sich ballt:** Die Dichte steigt von 76 Ereignissen je Tag (Tag 0-49) auf 117-141 je Tag ab Tag 50 und bleibt bis Tag 499 über 100; die Spitze liegt bei Tag 350-399 (164 je Tag), getragen von `BOMBARDMENT` (3175 allein in diesem Fenster, vorher fast null). Für den Menschen **sichtbar** (Protokoll) sind es in Tag 100-499 etwa **11-22 Ereignisse je Tag** (100-149: 1078 je 50 Tage, 350-399: 1092), davor 3 (Tag 0-49) bis 11 (50-99) und ab Tag 500 6-8 je Tag. Die Alarme (Einmarsch, Kampf, Eroberung, Aufstand, Sabotage) liegen bei 800-1200 je 50 Tage in Tag 100-399, also 16-24 je Tag - das Mid-Game (Tag 100-350) ist der dichteste Abschnitt, ab Tag 500 fällt es auf ein Viertel.
- **Gefahr für den Menschen:** In dieser Partie **null**. Er wird nie angegriffen: 0 Kriegserklärungen an ihn, 0 Einmärsche, 0 verlorene Provinzen oder Armeen, 0 Kämpfe auf seinem Boden, in keinem Fenster. Was ihn betrifft (`concerns`), sind 4-27 Ereignisse je 50 Tage, davon nur 2 Alarme in 589 Tagen. Die KI führt gleichzeitig 3-4 Kriege (Schnitt 3,0-4,0 in Tag 50-199, 3,0 in 300-399), aber alle ohne ihn.
- **Deutung:** Die Messung spricht für ein **UX-Problem** (viele Meldungen, wenig echte Gefahr): Der Strom besteht überwiegend aus fremden Kriegen, die den Menschen nichts angehen, und er kommt in genau dem Abschnitt, in dem Noah "stressig" sagt. Dass das Vorspulen davon nicht anhält (humanAlerts 0), ist gewollt (R-TIME-06) - der Stress liegt in Protokoll, Karte und Zahl der Ereignisse, nicht im Anhalten. Empfehlung: Fremde Ereignisse im Protokoll verdichten oder filtern (nur eigene und Nachbarn standardmäßig; fremde Kämpfe als Tageszeile), selbsttätiges `BOMBARDMENT` zusammenfassen.
- **Grenze der Aussage (Balance nicht ausgeschlossen):** Der Mensch befiehlt hier nichts. Ein handelnder Mensch erobert, wird zum Ziel und kommt in Kriege; der Anteil echter Gefahr ist dann höher, und gemessen ist er nicht. Die Aussage "UX statt Balance" gilt für den Teil des Stresses, der aus der Umwelt kommt. Ob ein aktiver Mensch im Mid-Game überfordert wird, zeigt erst eine Messung mit einer Spielerstellvertretung (z. B. die Haltung aus `stance.slow.test.ts` oder ein Bot mit Ausbau und Krieg) - nicht in diesem Bericht.
- Eine Startzahl (1914); Siegtag 589 stimmt mit den Ständen S100-S575 überein (Tick 14136).
