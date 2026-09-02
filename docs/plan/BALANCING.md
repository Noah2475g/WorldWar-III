# BALANCING

Alle Zahlen des Spiels mit Belegstatus. Quelle für Belegtes ist
`docs/research/SUPREMACY-MECHANICS.md`; Geschätztes wird über den Parameterlauf
(`pnpm balance:sweep`, T-M12-00) abgestimmt.

| Status | Bedeutung |
|---|---|
| **belegt** | aus der Mechanik-Referenz, mit Quellenangabe |
| **abgeleitet** | rechnerisch aus belegten Zahlen gefolgert |
| **geschätzt** | keine Quelle — begründet gesetzt, über Testpartien abgestimmt |

## Zeit

| Größe | Wert | Status | Herkunft |
|---|---|---|---|
| Tick | 1 Spielstunde | belegt | Combat Tick des Originals |
| Spieltag | 24 Ticks | belegt | Day Change |

## Moral

| Größe | Wert | Status | Herkunft |
|---|---|---|---|
| Drift je Spieltag | ein Siebtel der Lücke zum Zielwert | belegt | Fan-Wiki, Stand 2024 |
| Produktionsfaktor | `0,20 + 0,80 × Moral` | belegt | Bytro-Hilfe zum Umbau 2023 |
| Aufstandsrisiko je Tag | `max(0, (33 − Moral) × 3) %` | belegt | Fan-Wiki, Handbuch |
| Startmoral | 70 | belegt | Handbuch |
| Moral nach Eroberung | 25 | belegt | Handbuch |
| Grundzielmoral | 102 | belegt | Handbuch |

## Kampf

| Größe | Wert | Status | Herkunft |
|---|---|---|---|
| Streuung je Kampftick | ±10 %, keine Fehlschläge | belegt | Umbau 2023 |
| Stapel-Deckel | 100 % bis 20 Einheiten, linear auf 0 % bis 50 | belegt | Umbau 2023 |
| Zustandsfaktor | 100 % Trefferpunkte → 100 % Schaden, 0 % → 50 % | belegt | Umbau 2023 |
| Angriffs-/Verteidigungswerte je Einheit | **offen** | geschätzt | nach 2023 neu skaliert, nicht veröffentlicht |
| Trefferpunkte je Einheit | **offen** | geschätzt | dieselbe Lücke |

## Bewegung

| Größe | Wert | Status | Herkunft |
|---|---|---|---|
| Fremdes Gebiet | ×0,70 | belegt | Geschwindigkeitstabelle |
| Feindliches Gebiet | ×0,35 | belegt | Geschwindigkeitstabelle |
| Eisenbahn | ×2,5 | belegt | Geschwindigkeitstabelle |
| Einschiffen / Ausschiffen mit Hafen | 3 h / 1,5 h | belegt | Handbuch |
| An feindlicher Küste | ×1,5 auf beide Zeiten | belegt | Handbuch |

_Weitere Zeilen entstehen mit den zugehörigen Aufgaben (T-M3-01 Regelwerk, T-M12-01 Festschreibung)._
