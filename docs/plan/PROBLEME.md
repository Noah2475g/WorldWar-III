# PROBLEME

Befunde, die die Umsetzung blockieren oder aufschieben — je Eintrag: Datum, Aufgabe, Befund, kleinster reproduzierbarer Fall, Status.

---

## 2026-09-03 · T-M9-00 · Die Rohdaten sehen anders aus als der Plan annahm

**Befund:** Die Aufgabe veranschlagt „rund 4600 Verwaltungseinheiten mit völlig ungleicher
Körnung" und 1–2 Tage Handarbeit. Die geladene Fassung (Natural Earth 1:50 Mio) enthält
**294 Verwaltungseinheiten in nur 9 Ländern** — Russland (85), USA (51), Indien (36),
Indonesien (33), China (31), Brasilien (27), Kanada (13), Australien (9), Südafrika (9).
Alle übrigen Länder sind dort gar nicht untergliedert. Die 4600er-Zahl gehört zur
Fassung 1:10 Mio.

**Kleinster reproduzierbarer Fall:** `ne_50m_admin_1_states_provinces.dbf` auslesen und
nach `adm0_a3` gruppieren — neun Schlüssel.

**Das ist kein Rückschlag, sondern eine bessere Ausgangslage.** Der Zuschnitt fällt
dadurch fast von selbst:

| Gruppe | Quelle | Ergebnis |
|---|---|---|
| Die 9 großen Länder | Admin-1, zu Regionen zusammengefasst | je 4–10 Provinzen |
| Mittlere und kleine Staaten | Admin-0, ein Staat = eine Provinz | rund 125 Provinzen |
| Kleinststaaten und Inseln unter der Schwelle | ausdrücklich ausgeschlossen oder einem Nachbarn zugeschlagen | — |

Überschlag: rund 180 Provinzen, also mitten im geforderten Korridor 150–250 (R-MAP-01).

**Zweiter Befund — Textfelder:** Die DBF-Felder sind mit Null-Bytes aufgefüllt
(`"Asia\0\0\0…"`), und die deutschen Namen kommen falsch dekodiert an (`Ã„thiopien`
statt `Äthiopien`). Beides muss der Lader abfangen, bevor irgendetwas gruppiert wird —
sonst stehen die Fehler später in der Karte.

**Status:** offen, T-M9-00 in Arbeit. Kein Blocker.

---

## 2026-09-03 · T-M9-02a → vorgemerkt für T-M9-02c · Vier Provinzen liegen auf der Datumsgrenze

**Befund:** Fidschi, Neuseeland, der Russische Ferne Osten und der Westen der USA
(Alaska mit den Aleuten) spannen in den Rohdaten über die volle Längenspanne von −180°
bis 180°. Das ist geografisch richtig, aber jede Rechnung, die „westlichster minus
östlichster Punkt" bildet, hält diese Provinzen für so breit wie die halbe Welt.

**Kleinster reproduzierbarer Fall:** In `world-shapes.json` die Längenspanne je Provinz
bilden — vier liegen über 180°.

**Noch keine Auswirkung:** Die Karte zeichnet richtig (die Polygone selbst sind korrekt,
nur weit auseinander), und die Flächenrechnung stimmt — 133,9 Mio km² gegen erwartete
rund 135 Mio ohne Antarktis.

**Wo es weh tun wird:** T-M9-02b (Nachbarschaft über Schwerpunktabstände) und T-M9-02c
(Seewege, „kein Sprung über die halbe Welt"). Beide müssen die Längendifferenz über die
Datumsgrenze rechnen, nicht linear. `distanceKm` in `project.ts` tut das bereits und hat
einen Test dafür; die noch zu schreibenden Schritte müssen es ebenso tun.

**Erledigt in T-M9-02b:** Die Nachbarschaft rechnet Entfernungen mit `distanceKm`
(Haversine), das die Datumsgrenze richtig behandelt — keine der 445 Landgrenzen kommt
über 6000 km, was ein Test festhält. **Offen bleibt es für T-M9-02c:** die Seewege aus
der Geometrie dürfen dort ebenfalls nicht linear rechnen.

**Status:** halb erledigt, Rest vorgemerkt für T-M9-02c.

---

## 2026-09-03 · vor T-M12-03 · Die Weltkarte ist wirtschaftlich vom Regelwerk abgekoppelt

**Befund:** Ein Rauchtest der Oberfläche vor dem Playtest (Deutschland, Startzahl 1914)
zeigte in der Kopfleiste eine Tagesproduktion von **+203.093 Nahrung** bei einem
Startbestand von 1.000. Nachgemessen mit `economyOverview` auf beiden Karten, mit
denselben Regeln:

| Karte / Macht | Provinzen | Material je Tag | Geld je Tag | Kaserne (333 Material) kostet |
|---|---|---|---|---|
| Kleine Welt / Nordland | 3 | 38 | 61 | **8,8 Tage** Materialeinkommen |
| Welt / Deutschland | 4 | 132.805 | 542.407 | **4 Minuten** Spielzeit |
| Welt / China | 6 | 43.366 | 1.643.294 | 12 Minuten |
| Welt / Italien | 3 | **0** | 402.209 | — nie aus eigener Produktion |

Die Regeln (Kosten, Startbestände, Unterhalt, Marktgrundpreise, `BALANCING.md`) wurden
in M3 auf der Kleinen Welt abgestimmt: dort liegt ein Vorkommen bei 1,5–2,5 Einheiten
je Tick. Auf der Weltkarte liegt es bei **1.000–3.000 Einheiten je Tick** — Faktor
600 bis 1000. Die Bevölkerung ist um denselben Faktor größer (Deutschland 9,9 Mio
gegen Nordland 1.330), und die Steuer rechnet `Bevölkerung / 1000 × Satz`, also
tausendfach mehr Geld.

**Ursache:** `packages/mapgen/src/enrich.ts` erzeugt Vorkommen als ganze Einheiten
(`amount(1200)` ≈ 700–3.600), `scripts/build-map.mjs` wandelt sie mit `toFixed`
(× 1000) in Festkomma um — die Kleine Welt trägt dieselben Größenordnungen aber bereits
*als* Festkomma (2000 = 2,0). Zwei Karten, zwei Einheiten, ein Regelwerk. Der
Startwert-Abgleich in T-M9-03 (±15 % vom Median) prüft die Nationen gegeneinander,
nicht gegen die Regeln; T-M9-04 prüft Tickbudget und Fehlerfreiheit, nicht die
Spielbarkeit der Zahlen.

**Kleinster reproduzierbarer Fall:** `createInitialState` auf `world.json` mit
Deutschland, dann `economyOverview(state, 'p1', rules).wood.production / ONE` → 132.805,
gegen `rules.buildings.barracks.cost.wood / ONE` → 333.

**Folgen, solange das so bleibt:**
- Geld und Material sind ab der ersten Spielstunde bedeutungslos; jeder Bauknopf ist
  immer bezahlbar, die Wirtschaftsfragen des Playtests (13–16b) messen nichts.
- Die KI-Logik „reagiert auf Mangel, verschuldet sich nie" kommt nie zum Zug.
- Der Parameterlauf (`balance-sweep.md`: „nur Moral und Ausdehnung sind tragend") ist
  vermutlich ein Artefakt einer gesättigten Wirtschaft, kein Befund über das Spiel.
- Italien (und womöglich weitere Mächte) startet ohne Material-Vorkommen und kann aus
  eigener Produktion nie eine Kaserne bauen.
- Die Rohstoff-Kartenfärbung („zehntausend ist reich", `modes.ts`) ist auf der
  Weltkarte überall voll ausgesteuert.

**Vorschlag (Entscheidung Noah):** Die Anreicherung auf die Skala der Regeln bringen —
Vorkommen so setzen, dass eine Startnation mit 3–4 Provinzen etwa das Tageseinkommen
Nordlands erreicht (Grundwerte in `depositsFor` durch ~1000 teilen, Bevölkerung im
Kern als Festkomma-Personen behandeln oder die Steuerformel anpassen), jeder
Startnation ein Mindestvorkommen an Nahrung, Material und Geld sichern, `world.json`
und `docs/reports/map.md` neu erzeugen, Golden-Master und Parameterlauf wiederholen.
Erst danach ist der Playtest aussagekräftig.

**Status: behoben am 2026-09-03** (Entscheidung Noah: der Weg mit den wenigsten
Spielproblemen — die Karte auf die Regelskala, nicht umgekehrt; `DECISIONS.md`). Der
Generator schreibt beide Größen ungeskaliert, die Bevölkerung geht zusätzlich auf ein
Fünftel (die komprimierten Millionen hingen alle am Deckel des Bevölkerungsfaktors,
Geld war noch zwanzigfach zu reichlich), jede Startnation erhält Holz und Erz, und
`apps/headless/test/economy-scale.test.ts` misst seither die Tage Einkommen je Kaserne
gegen die Referenzkarte. Nachher: Deutschland 2,4 Tage Material, 2,3 Tage Geld; Italien
3,5 / 3,1; über alle Mächte 1,1–15 bzw. 0,8–4,9 Tage (Referenz 8,8 / 4,1).


## 2026-09-03 · vor T-M12-03 · Rauchtest der Oberfläche — behoben

Gefunden beim selben Rauchtest, alle mit Test behoben:

- **KI-Befehle je Stunde neu:** Die Oberfläche fragte die KI einmal und wandte dieselben
  Befehle auf jeden Tick eines Vorspulens an — ein „Bau begonnen", dann 23 × „Befehl
  abgelehnt". Jetzt läuft dieselbe Schleife wie im kopflosen Läufer (`advance.ts`).
- **Protokoll zeigte fremde Ereignisse:** Bauten und Ablehnungen der KI-Mächte standen
  im Protokoll des Spielers (R-DIP-04). Jetzt gefiltert über `eventsFor`.
- **Rohtexte im Protokoll:** `{{reason}}`, `barracks`, `p2`, Armeekennungen, ein Marsch
  „nach" seinem Startort, Handel und Kriegserklärung mit falschen Platzhaltern
  (R-UI-07). Gebäude, Einheiten und Ablehnungsgründe haben jetzt deutsche Namen im
  Katalog; Nationen und Armeen kommen aus dem Spielzustand.
- **Wirtschaftsübersicht abgeschnitten:** Seitenleiste 260px, fünf Spalten — zwei
  fielen hinter einen Rollbalken. Jetzt 380px.
- **„1 Tage"** im Kosten-Tooltip.
- **Escape im Startdialog** ließ einen leeren Bildschirm ohne Rückweg zurück.
