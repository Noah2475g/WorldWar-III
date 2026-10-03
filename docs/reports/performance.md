# Langlauf und Rechenzeit

Lauf: 1000 Spieltage (24000 Ticks), 8 KI-Spieler, Weltkarte (237 Provinzen) — die ausgelieferte Voreinstellung.

- Dauer gesamt: 312673 ms
- Zeit je Tick inkl. KI: 13.028 ms
- Ereignisprotokoll am Ende: 500 Einträge (Ringpuffer greift)
- Partie entschieden bei Tick: 10224

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
