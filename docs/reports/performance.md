# Langlauf und Rechenzeit

Lauf: 1000 Spieltage (24000 Ticks), 8 KI-Spieler, Weltkarte (237 Provinzen) — die ausgelieferte Voreinstellung.

- Dauer gesamt: 193019 ms
- Zeit je Tick inkl. KI: 8.042 ms
- Ereignisprotokoll am Ende: 500 Einträge (Ringpuffer greift)
- Partie entschieden bei Tick: 12672

## Bestände nach 1000 Spieltagen (Befund 58)

Summe über alle Mächte der Partie, auch ausgeschiedene; ganze Einheiten (Festkomma durch 1000, abgerundet). **Keine Schranke:** der Test sichert nur zu, dass jeder Bestand eine sichere ganze Zahl und nicht negativ bleibt. Wie weit die Vorräte wachsen, sagt diese Tabelle, nicht der Test. `STORAGE_OVERFLOW` meldet der Kern höchstens einmal je Macht, Rohstoff und Spieltag; `RESOURCE_SHORTAGE` meldet den Beginn eines Mangels.

| Rohstoff | Start | Ende | Verhältnis | größter Endbestand einer Macht | Verhältnis dieser Macht | Lagergrenze je Macht | Lagerüberlauf-Meldungen | Mangel-Beginne |
|---|---|---|---|---|---|---|---|---|
| food | 5336 | 2797421 | 524.25 | 1000000 (Argentinien) | 1499.25 | 1000000 | 11 | 0 |
| wood | 5336 | 935494 | 175.32 | 536589 (Russland) | 804.48 | 1000000 | 0 | 0 |
| iron | 2664 | 682627 | 256.24 | 362718 (Russland) | 1089.25 | 1000000 | 0 | 0 |
| coal | 2664 | 1034696 | 388.40 | 503912 (Russland) | 1513.25 | 1000000 | 0 | 0 |
| oil | 1336 | 457165 | 342.19 | 354655 (Argentinien) | 2123.68 | 1000000 | 0 | 15 |
| rare | 536 | 238341 | 444.67 | 126558 (Russland) | 1888.93 | 500000 | 0 | 0 |
| money | 13336 | 18112 | 1.36 | 11899 (Vereinigte Staaten) | 7.14 | unbegrenzt | 0 | 4 |

Erzeugt von `apps/headless/test/longrun.slow.test.ts`.
