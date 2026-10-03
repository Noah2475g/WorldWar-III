# Langlauf und Rechenzeit

Lauf: 1000 Spieltage (24000 Ticks), 8 KI-Spieler, Weltkarte (237 Provinzen) — die ausgelieferte Voreinstellung.

- Dauer gesamt: 446767 ms
- Zeit je Tick inkl. KI: 18.615 ms
- Ereignisprotokoll am Ende: 500 Einträge (Ringpuffer greift)
- Partie entschieden bei Tick: 9456

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
