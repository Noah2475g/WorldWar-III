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
