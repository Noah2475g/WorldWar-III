# Balancing — Parameterlauf

Erzeugt von `apps/headless/test/sweep.slow.test.ts` (`pnpm balance:sweep`).
6 Mächte, 120 Spieltage, 2 Startzahlen je Variante,
jede Konstante um ±25 % bewegt. Laufzeit 3.3 Minuten.

## Was gemessen wird

Der **Ausschlag** ist die größte Änderung am Anteil des Stärksten an allen Provinzen,
wenn die Konstante um ±25 % bewegt wird. Ab 15 % gilt sie als
**tragend**: eine Zahl, die den Partieausgang kippt und daher stimmen muss.
Konstanten ohne Ausschlag darf man in Ruhe lassen — das ist der eigentliche Nutzen
dieser Liste.

## Ausgangslage

| Kennzahl | Wert |
|---|---|
| Anteil des Stärksten | 55.8 % |
| Überlebende Mächte | 5.0 von 6 |
| Wirtschaft gesamt | 456.380.389 |
| Eroberte Provinzen | 3 |
| Gespielte Tage | 120 |

## Tragende Konstanten (4 von 14)

| Konstante | Ausschlag | −25 % | Grundwert | +25 % |
|---|---|---|---|---|
| `baseTargetMorale` | 15.6 % | 51 % | 56 % | 71 % |
| `moraleDriftDivisor` | 15.6 % | 71 % | 56 % | 71 % |
| `startMorale` | 15.2 % | 71 % | 56 % | 71 % |
| `expansionPenaltyPerProvince` | 15.2 % | 51 % | 56 % | 71 % |

## Alle geprüften Konstanten

| Konstante | Ausschlag | Überlebende −25 % / +25 % | tragend |
|---|---|---|---|
| `baseTargetMorale` | 15.6 % | 5.0 / 5.0 | **ja** |
| `moraleDriftDivisor` | 15.6 % | 5.0 / 5.0 | **ja** |
| `startMorale` | 15.2 % | 5.0 / 5.0 | **ja** |
| `expansionPenaltyPerProvince` | 15.2 % | 5.0 / 5.0 | **ja** |
| `revoltThreshold` | 7.0 % | 5.0 / 5.0 | — |
| `battleRate` | 0.5 % | 5.0 / 5.0 | — |
| `minDamage` | 0.0 % | 5.0 / 5.0 | — |
| `defenceCap` | 0.0 % | 5.0 / 5.0 | — |
| `productionMoraleFloor` | 0.0 % | 5.0 / 5.0 | — |
| `deployDelayTicks` | 0.0 % | 5.0 / 5.0 | — |
| `regenPermillePerTick` | 0.0 % | 5.0 / 5.0 | — |
| `taxPerThousandPopulationPerTick` | 0.0 % | 5.0 / 5.0 | — |
| `marketElasticity` | 0.0 % | 5.0 / 5.0 | — |
| `stackFullContribution` | 0.0 % | 5.0 / 5.0 | — |
