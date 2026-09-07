# Kartengeometrie — was die Karte zeigt und was da ist

Gemessen am **2026-09-07** gegen `0753329` (T-M19-01), von
`packages/mapgen/src/worldmap.geometry.test.ts`.

> Dieser Bericht gilt für genau diesen Stand. Zeigt `git log --oneline -1` etwas anderes,
> ist er überholt und keine Aussage über das Projekt.

## Warum es diese Messung gibt

Am 2026-09-07 fiel im Playtest auf, dass Kalifornien nicht auf der Karte ist. Die
Prüfkette war zu diesem Zeitpunkt vollständig grün — 1400 Tests, `pnpm verify` ohne
Befund, ein Abnahmelauf mit 7 von 7.

Der Grund ist keine schlechte Prüfung, sondern eine fehlende: `worldmap.test.ts` prüft,
ob `world.json` eine **gültige** Karte ist — jede Kante indiziert, jede Hauptstadt echt,
nichts unerreichbar. Eine Provinz mit dem falschen Umriss ist eine gültige Provinz. Was
nie geprüft wurde, ist das Einzige, was der Spieler sieht: **liegt das Land, das die
Quelle kennt, tatsächlich auf der Leinwand.**

`data/maps/world-shapes.json` — die Quelle — ist vollständig und richtig. Der Fehler
entsteht erst beim Erzeugen von `world.json`: der Generator nahm je Provinz **einen**
Umriss und musste deshalb wählen.

## Die vier Prüfungen

Alle vier vergleichen `world.json` gegen `world-shapes.json` durch **dieselbe**
Projektion, die der Generator benutzt (`packages/mapgen/src/project.ts`). Sie zu kopieren
wäre der Fehler, den die Prüfung finden soll: ein Wächter mit eigener Projektion kann
nicht auffallen, wenn die Projektion das Falsche ist.

| | prüft | Ergebnis 2026-09-07 |
|---|---|---|
| **G1** | Der Ankerpunkt liegt in der eigenen gezeichneten Fläche | **14 von 237 fallen** |
| **G2** | Je Provinz sind ≥ 99 % der Quellfläche gezeichnet | **66 von 237 fallen** |
| **G3** | 35 bekannte Städte liegen auf ihrer eigenen Provinz | **3 von 35 fallen** |
| **G4** | Kein Punkt außerhalb `[0,4000] × [0,2400]` | **1 fällt** (Grönland) |

### G1 — der Ankerpunkt

`center` trägt die Armeemarke und die Beschriftung. Liegt er außerhalb der eigenen
Fläche, steht Norwegens Armee in der Nordsee.

Betroffen: `CAN-NORTH`, `FJI`, `GRC`, `HRV`, `HTI`, `MEX-SE`, `NOR`, `NZL`, `PHL`, `SGP`,
`SWE`, `THA`, `USA-WEST`, `VNM`.

Zwei Ursachen, die T-M19-02 beide angeht: bei `USA-WEST`, `CAN-NORTH`, `FJI`, `NZL` und
`PHL` fehlt die Fläche, in der der Anker liegt. Bei den übrigen neun ist der Anker selbst
falsch gerechnet — `shapeCentre` mittelt die Randpunkte des größten Rings, und bei einer
konkaven Küste wie Norwegens liegt dieser Mittelwert im Wasser.

### G2 — die gezeichnete Fläche

Die eigentliche Zahl des Befundes. Gemessen mit der Schnürsenkelformel über die
**projizierten** Koordinaten, damit Quelle und Zeichnung im selben Maß stehen.

| Schwelle | Provinzen darunter |
|---|---|
| 100 % (verlieren überhaupt etwas) | **130** |
| 99,9 % | 106 |
| **99 %** (die geprüfte Schwelle) | **66** |
| 95 % | 37 |
| 90 % | 24 |

**Insgesamt sind 85,78 % der Landfläche gezeichnet.** Die schlimmsten Fälle:

| Provinz | gezeichnet | Ringe in der Quelle |
|---|---|---|
| `CAN-NORTH` | 11,6 % | 248 |
| `FJI` | 31,3 % | 44 |
| `PHL` | 37,6 % | 99 |
| `NZL` | 38,5 % | 26 |
| `JPN-SOUTH` | 44,7 % | 72 |
| `NOR` | 47,9 % | 120 |
| `USA-WEST` | 58,0 % | 218 |

Alle 94 Provinzen, deren Quellgeometrie ein einfaches `Polygon` ist, zeichnen 100 %. Es
fällt **ausschließlich**, was in der Quelle aus mehreren Teilen besteht — 143 Provinzen.
Das ist der Beleg, dass die Ursache die Auswahl ist und nicht die Vereinfachung.

> **Die Falle, die den Fehler so lange getragen hat:** „nimm den größten Ring" wählt für
> `USA-WEST` **Alaska**. Mercator bläht hohe Breiten mit 1/cos²(φ) auf — Alaska misst
> projiziert 84 453 px² gegen 58 147 px² der Weststaaten, bei echter Fläche aber 268
> gegen 329 Grad². Jede Reparatur, die weiter *auswählt*, wählt wieder falsch.

### G3 — bekannte Städte

35 Städte über alle Kontinente, `data/maps/landmarks.csv`. Geprüft wird nicht „liegt
irgendwo an Land" — das wäre zu schwach, eine Stadt, die in die Nachbarprovinz rutscht,
käme durch. Geprüft wird: **die Stadt liegt auf der gezeichneten Fläche der Provinz, in
der die Quelle sie führt.**

Fallen heute: **Los Angeles** (`USA-WEST`), **Tokio** (`JPN-CENTRAL`), **Singapur**
(`IDN-SUM`).

Toleranz 5 px. Sie ist nötig, nicht bequem: die Küstenlinie der Quelle ist bereits
vereinfacht (Visvalingam, 0,002 Grad²), und New York liegt dadurch 0,9 px vor dem
gezeichneten Ufer. Fünf Bildpunkte auf 4000 sind 0,125 % der Breite — zu wenig, um eine
fehlende Landmasse zu verdecken.

### G4 — die Leinwand

Grönland reicht mit **796 Punkten** über den oberen Rand, bis `y = −436`. Der
78°-Beschnitt in `build-map.mjs` legt den Ausschnitt fest, aber nichts klippt gegen ihn.

## Die Übergangslisten

Die vier Prüfungen sind **erwartet rot** und dürfen `pnpm verify` trotzdem nicht rot
machen, bevor T-M19-02 landet — ein neuer roter Wächter, der die Kette blockiert, ist
eine Lehre vom 2026-09-06. Der Test führt deshalb je Prüfung eine benannte Liste der
heute betroffenen Provinzen.

Sie sind **keine weichere Schwelle**: jede Provinz außerhalb einer Liste wird am vollen
Maß gemessen, und jeder Test prüft zusätzlich die **Gegenrichtung** — steht eine Provinz
auf der Liste, die inzwischen heil ist, fällt der Test. Ohne diese zweite Richtung
schrumpfen solche Listen nie, weil eine Reparatur sie nur überflüssig macht, nicht falsch.

`it.fails` wäre der kürzere Weg und der falsche gewesen: es wird grün, sobald der Test
*irgendwie* fällt — auch aus einem ganz anderen Grund.

## Dass die Prüfungen beißen, ist nachgewiesen

Ein Test, der nach der Reparatur geschrieben wird, hat nie bewiesen, dass er den Fehler
findet. Alle vier wurden gegen den heutigen Stand einzeln zum Fallen gebracht, indem eine
Provinz aus ihrer Übergangsliste genommen wurde:

| Prüfung | Meldung |
|---|---|
| G1 | `Ankerpunkt ausserhalb der eigenen Flaeche: USA-WEST` |
| G2 | `zeichnen weniger als 99 % ihrer Quellflaeche: USA-WEST 58.0 %` |
| G3 | `Singapur liegt nicht auf der gezeichneten Flaeche von IDN-SUM` |
| G4 (Gegenrichtung) | `Diese Provinzen stehen auf der Uebergangsliste, sind aber heil: DEU-NE` |

## Was T-M19-02 daraus macht

Die Fortschreibung dieses Berichts nach der Reparatur — mit Bildbeleg — steht in
T-M19-05.
