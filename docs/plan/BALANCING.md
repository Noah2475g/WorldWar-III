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

## Alle Konstanten mit Status

Vollständig und maschinell geprüft: `test/balancing.test.ts` verlangt für jede Zahl in
`data/rules/default/constants.json` eine Zeile mit Status. Eine neue Konstante ohne
Eintrag lässt den Testlauf scheitern — das ist der einzige Weg, wie eine Tabelle wie
diese über Jahre stimmt.

Die Spalte **Ausschlag** kommt aus dem Parameterlauf (`pnpm balance:sweep`,
`docs/reports/balance-sweep.md`): um wie viel sich der Partieausgang verschiebt, wenn
die Zahl um ±25 % bewegt wird. Fett = tragend, also eine Zahl, die stimmen muss.
Ein Strich heißt: im Lauf nicht geprüft.

| Konstante | Wert | Status | Ausschlag | Herkunft |
|---|---|---|---|---|
| `ticksPerDay` | 24 | belegt | — | Combat Tick = 1 Spielstunde, Day Change = 24 Ticks |
| `startMorale` | 70.000 | belegt | **15.2 %** | Handbuch: Startmoral 70 |
| `capturedMorale` | 25.000 | belegt | — | Handbuch: Moral nach Eroberung 25 |
| `baseTargetMorale` | 102.000 | belegt | **15.6 %** | Handbuch: Grundzielmoral 102 |
| `moraleDriftDivisor` | 7 | belegt | **15.6 %** | Fan-Wiki: ein Siebtel der Lücke je Spieltag |
| `productionMoraleFloor` | 200 | belegt | 0.0 % | Bytro-Hilfe 2023: Produktion = 0,20 + 0,80 × Moral |
| `revoltThreshold` | 33.000 | belegt | 7.0 % | Fan-Wiki: Aufstände ab Moral 33 |
| `revoltChancePerPointPermille` | 30 | belegt | — | Fan-Wiki: (33 − Moral) × 3 % je Tag |
| `ownNeighborBonus` | 1.000 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `ownNeighborBonusMax` | 4.000 | abgeleitet | — | Deckel des belegten Nachbarbonus |
| `enemyNeighborPenalty` | 3.000 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `enemyNeighborPenaltyMax` | 15.000 | abgeleitet | — | Deckel der belegten Nachbarstrafe |
| `foodSurplusBonus` | 3.000 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `foodShortagePenalty` | 20.000 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `occupationPenalty` | 25.000 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `occupationPenaltyDays` | 14 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `capitalLossDays` | 14 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `capitalLossProductionFactor` | 750 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `capitalLossMoralePenalty` | 10.000 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `battleRate` | 80 | geschätzt | 0.5 % | begründet gesetzt, im Parameterlauf gemessen |
| `minDamage` | 100 | geschätzt | 0.0 % | begründet gesetzt, im Parameterlauf gemessen |
| `defenceCap` | 4.000 | geschätzt | 0.0 % | begründet gesetzt, im Parameterlauf gemessen |
| `battleMoraleLoss` | 1.000 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `combatSpreadPermille` | 100 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `stackFullContribution` | 20 | geschätzt | 0.0 % | begründet gesetzt, im Parameterlauf gemessen |
| `stackZeroContribution` | 50 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `healthDamageFloor` | 500 | abgeleitet | — | aus dem Trefferpunkte-Pool-Modell gefolgert (DECISIONS, T-M4-03) |
| `deployDelayTicks` | 2 | geschätzt | 0.0 % | begründet gesetzt, im Parameterlauf gemessen |
| `deployDelayFactor` | 500 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `retreatLossPermille` | 100 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `retreatCooldownTicks` | 24 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `bombardFactor` | 500 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `regenPermillePerTick` | 5 | geschätzt | 0.0 % | begründet gesetzt, im Parameterlauf gemessen |
| `regenShortageFactor` | 500 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `foreignTerritoryFactor` | 700 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `hostileTerritoryFactor` | 350 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `railwayFactor` | 2.500 | belegt | — | Handbuch: Bahnbonus auf die Marschgeschwindigkeit |
| `embarkTicks` | 3 | belegt | — | Handbuch: feste Einschiffungszeit |
| `disembarkTicks` | 2 | belegt | — | Handbuch: feste Ausschiffungszeit |
| `hostileCoastFactor` | 1.500 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `maxBuildSlotsCity` | 2 | belegt | — | Handbuch: Bauplätze je Großstadt |
| `maxBuildSlotsRural` | 1 | belegt | — | Handbuch: Bauplätze je Landprovinz |
| `capitalMoveCooldownDays` | 30 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `warDeclarationDelayTicks` | 12 | belegt | — | Handbuch: Kriegserklärung wird nach Vorlaufzeit wirksam |
| `surpriseAttackReputationLoss` | 200 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `truceDurationDays` | 5 | belegt | — | Handbuch: Waffenstillstand läuft nach fester Frist ab |
| `marketElasticity` | 50 | geschätzt | 0.0 % | begründet gesetzt, im Parameterlauf gemessen |
| `marketReversionPermille` | 50 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `marketMinPrice` | 200 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `marketMaxPrice` | 5.000 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `scoreProvince` | 10 | belegt | — | Handbuch: Punkte je Provinz |
| `scorePopulationPer1000` | 1 | belegt | — | Handbuch: Punkte je 1000 Einwohner |
| `scoreBuildingLevel` | 2 | abgeleitet | — | aus der Punktesystematik gefolgert |
| `scoreUnit` | 1 | abgeleitet | — | aus der Punktesystematik gefolgert |
| `capitalDistancePenalty` | 35.000 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `capitalDistanceRange` | 8 | abgeleitet | — | Reichweite der belegten Hauptstadtentfernung |
| `expansionFreeProvinces` | 2 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `expansionPenaltyPerProvince` | 3.000 | geschätzt | **15.2 %** | begründet gesetzt, im Parameterlauf gemessen |
| `expansionPenaltyMax` | 35.000 | abgeleitet | — | Deckel der Ausdehnungsstrafe |
| `taxPerThousandPopulationPerTick` | 2 | geschätzt | 0.0 % | begründet gesetzt, im Parameterlauf gemessen |

## Was der Parameterlauf ergeben hat

Von 14 gemessenen Konstanten sind **4 tragend** — und alle vier haben mit
Moral und Ausdehnung zu tun, nicht mit Kampfwerten. `battleRate`, `minDamage` und
`defenceCap` um ein Viertel zu bewegen ändert am Ausgang **nichts**.

Das ist die Art Befund, die man ohne Messung nicht hat, und sie sagt etwas über das
Spiel: Partien werden über die Moral entschieden — über Produktion, Aufstände und die
Stärke frisch ausgehobener Truppen —, nicht darüber, wie hart zwei Armeen zuschlagen.
Wer am Balancing arbeitet, arbeitet an diesen vier Zahlen; die übrigen kann er in Ruhe
lassen.

## Keine ausartende Wirtschaft, keine unbesiegbare Strategie

Im Langlauf über 1000 Spieltage (`pnpm test:slow`, T-M9-04) wächst keine Ressource
unbegrenzt, und der Kennzahlenbericht (T-M5-06) schlägt fehl, sobald eine es täte.
Im Turnier über 50 Partien (T-M7-05) gewinnt die schwere Stufe gegen die leichte in
mindestens 70 % der Fälle, ohne dass eine Stufe je alle Partien gewinnt — es gibt also
weder eine unbesiegbare Strategie noch einen wirkungslosen Schwierigkeitsgrad.
