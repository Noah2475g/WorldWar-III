# Langlauf und Rechenzeit

Lauf: 1000 Spieltage (24000 Ticks), 8 KI-Spieler, Weltkarte (237 Provinzen) — die ausgelieferte Voreinstellung.

- Dauer gesamt: 401051 ms
- Zeit je Tick inkl. KI: 16.710 ms
- Ereignisprotokoll am Ende: 500 Einträge (Ringpuffer greift)
- Partie entschieden bei Tick: 9456

## Zeit je Tick nach 50-Tage-Fenstern (V3, nur Bericht, keine Schranke)

Der Mittelwert oben mischt Ticks nach der Entscheidung; hier steht jedes Fenster einzeln. Die Zahlen gelten nur fuer den Rechner und die Last dieses Laufs.

| Tage | ms je Tick inkl. KI | nach der Entscheidung |
|---|---|---|
| 0–50 | 3.433 | nein |
| 50–100 | 7.139 | nein |
| 100–150 | 8.741 | nein |
| 150–200 | 8.590 | nein |
| 200–250 | 9.049 | nein |
| 250–300 | 8.765 | nein |
| 300–350 | 8.526 | nein |
| 350–400 | 7.815 | teils (Entscheidung im Fenster) |
| 400–450 | 7.756 | ja |
| 450–500 | 12.906 | ja |
| 500–550 | 17.623 | ja |
| 550–600 | 19.721 | ja |
| 600–650 | 22.244 | ja |
| 650–700 | 23.375 | ja |
| 700–750 | 22.911 | ja |
| 750–800 | 24.071 | ja |
| 800–850 | 27.652 | ja |
| 850–900 | 30.898 | ja |
| 900–950 | 31.137 | ja |
| 950–1000 | 31.855 | ja |

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
