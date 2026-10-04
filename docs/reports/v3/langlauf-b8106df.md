# Langlauf und Rechenzeit

Lauf: 1000 Spieltage (24000 Ticks), 8 KI-Spieler, Weltkarte (237 Provinzen) — die ausgelieferte Voreinstellung.

- Dauer gesamt: 234678 ms
- Zeit je Tick inkl. KI: 9.778 ms
- Ereignisprotokoll am Ende: 500 Einträge (Ringpuffer greift)
- Partie entschieden bei Tick: 10224

## Zeit je Tick nach 50-Tage-Fenstern (V3, nur Bericht, keine Schranke)

Der Mittelwert oben mischt Ticks nach der Entscheidung; hier steht jedes Fenster einzeln. Die Zahlen gelten nur fuer den Rechner und die Last dieses Laufs.

| Tage | ms je Tick inkl. KI | nach der Entscheidung |
|---|---|---|
| 0–50 | 3.048 | nein |
| 50–100 | 6.131 | nein |
| 100–150 | 7.805 | nein |
| 150–200 | 7.133 | nein |
| 200–250 | 8.955 | nein |
| 250–300 | 8.096 | nein |
| 300–350 | 7.717 | nein |
| 350–400 | 6.608 | nein |
| 400–450 | 6.216 | teils (Entscheidung im Fenster) |
| 450–500 | 6.644 | ja |
| 500–550 | 7.527 | ja |
| 550–600 | 8.849 | ja |
| 600–650 | 9.181 | ja |
| 650–700 | 8.043 | ja |
| 700–750 | 7.779 | ja |
| 750–800 | 8.975 | ja |
| 800–850 | 9.675 | ja |
| 850–900 | 18.733 | ja |
| 900–950 | 24.447 | ja |
| 950–1000 | 24.002 | ja |

Entscheidungstick: 10224 (Tag 426).

## Bestände nach 1000 Spieltagen (Befund 58)

Summe über alle Mächte der Partie, auch ausgeschiedene; ganze Einheiten (Festkomma durch 1000, abgerundet). **Keine Schranke:** der Test sichert nur zu, dass jeder Bestand eine sichere ganze Zahl und nicht negativ bleibt. Wie weit die Vorräte wachsen, sagt diese Tabelle, nicht der Test. `STORAGE_OVERFLOW` meldet der Kern höchstens einmal je Macht, Rohstoff und Spieltag; `RESOURCE_SHORTAGE` meldet den Beginn eines Mangels.

| Rohstoff | Start | Ende | Verhältnis | größter Endbestand einer Macht | Verhältnis dieser Macht | Lagergrenze je Macht | Lagerüberlauf-Meldungen | Mangel-Beginne |
|---|---|---|---|---|---|---|---|---|
| food | 5336 | 2678287 | 501.93 | 1000000 (Argentinien) | 1499.25 | 1000000 | 75 | 0 |
| wood | 5336 | 1223527 | 229.30 | 843739 (Russland) | 1264.98 | 1000000 | 0 | 0 |
| iron | 2664 | 872048 | 327.35 | 592666 (Russland) | 1779.78 | 1000000 | 0 | 0 |
| coal | 2664 | 1320815 | 495.80 | 817704 (Russland) | 2455.57 | 1000000 | 0 | 0 |
| oil | 1336 | 460923 | 345.00 | 302315 (Argentinien) | 1810.27 | 1000000 | 0 | 1 |
| rare | 536 | 243052 | 453.46 | 143932 (Russland) | 2148.24 | 500000 | 0 | 0 |
| money | 13336 | 64028 | 4.80 | 58745 (Russland) | 35.24 | unbegrenzt | 0 | 3 |

Erzeugt von `apps/headless/test/longrun.slow.test.ts`.
