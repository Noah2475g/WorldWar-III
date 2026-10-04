# Langlauf und Rechenzeit

Lauf: 1000 Spieltage (24000 Ticks), 8 KI-Spieler, Weltkarte (237 Provinzen) — die ausgelieferte Voreinstellung.

- Dauer gesamt: 88508 ms
- Zeit je Tick inkl. KI: 3.688 ms
- Ereignisprotokoll am Ende: 500 Einträge (Ringpuffer greift)
- Partie entschieden bei Tick: 9456

## Zeit je Tick nach 50-Tage-Fenstern (V3, nur Bericht, keine Schranke)

Der Mittelwert oben mischt Ticks nach der Entscheidung; hier steht jedes Fenster einzeln. Die Zahlen gelten nur fuer den Rechner und die Last dieses Laufs.

| Tage | ms je Tick inkl. KI | nach der Entscheidung |
|---|---|---|
| 0–50 | 1.249 | nein |
| 50–100 | 2.561 | nein |
| 100–150 | 3.576 | nein |
| 150–200 | 3.581 | nein |
| 200–250 | 3.777 | nein |
| 250–300 | 3.691 | nein |
| 300–350 | 3.767 | nein |
| 350–400 | 3.493 | teils (Entscheidung im Fenster) |
| 400–450 | 3.253 | ja |
| 450–500 | 3.766 | ja |
| 500–550 | 4.592 | ja |
| 550–600 | 4.894 | ja |
| 600–650 | 3.456 | ja |
| 650–700 | 3.393 | ja |
| 700–750 | 3.759 | ja |
| 750–800 | 3.594 | ja |
| 800–850 | 4.542 | ja |
| 850–900 | 4.262 | ja |
| 900–950 | 4.268 | ja |
| 950–1000 | 4.282 | ja |

Entscheidungstick: 9456 (Tag 394).

## Bestände nach 1000 Spieltagen (Befund 58)

Summe über alle Mächte der Partie, auch ausgeschiedene; ganze Einheiten (Festkomma durch 1000, abgerundet). **Keine Schranke:** der Test sichert nur zu, dass jeder Bestand eine sichere ganze Zahl und nicht negativ bleibt. Wie weit die Vorräte wachsen, sagt diese Tabelle, nicht der Test. `STORAGE_OVERFLOW` meldet der Kern höchstens einmal je Macht, Rohstoff und Spieltag; `RESOURCE_SHORTAGE` meldet den Beginn eines Mangels.

| Rohstoff | Start | Ende | Verhältnis | größter Endbestand einer Macht | Verhältnis dieser Macht | Lagergrenze je Macht | Lagerüberlauf-Meldungen | Mangel-Beginne |
|---|---|---|---|---|---|---|---|---|
| food | 5336 | 2000467 | 374.90 | 1000000 (Russland) | 1499.25 | 1000000 | 91 | 0 |
| wood | 5336 | 1311410 | 245.77 | 972041 (Russland) | 1457.33 | 1000000 | 0 | 0 |
| iron | 2664 | 773129 | 290.21 | 624788 (Russland) | 1876.24 | 1000000 | 0 | 0 |
| coal | 2664 | 1245260 | 467.44 | 921121 (Russland) | 2766.13 | 1000000 | 0 | 0 |
| oil | 1336 | 133725 | 100.09 | 124866 (Mexiko) | 747.70 | 1000000 | 0 | 55 |
| rare | 536 | 192042 | 358.29 | 147532 (Russland) | 2201.98 | 500000 | 0 | 0 |
| money | 13336 | 68612 | 5.14 | 65229 (Russland) | 39.13 | unbegrenzt | 0 | 3 |

Erzeugt von `apps/headless/test/longrun.slow.test.ts`.
