# Balancing — Parameterlauf

Erzeugt von `apps/headless/test/sweep.slow.test.ts` (`pnpm balance:sweep`).
6 Mächte, 120 Spieltage, 2 Startzahlen je Variante,
jede Konstante um ±25 % bewegt.

## Was gemessen wird

Der **Ausschlag** ist die größte Änderung am Anteil des Stärksten an allen Provinzen,
wenn die Konstante um ±25 % bewegt wird. Ab 15 % gilt sie als
**tragend**: eine Zahl, die den Partieausgang kippt und daher stimmen muss.
Konstanten ohne Ausschlag darf man in Ruhe lassen — das ist der eigentliche Nutzen
dieser Liste.

## Ausgangslage

| Kennzahl | Wert |
|---|---|
| Anteil des Stärksten | 55.0 % |
| Überlebende Mächte | 5.0 von 6 |
| Wirtschaft gesamt | 172.762 |
| Eroberte Provinzen | 3 |
| Gespielte Tage | 120 |

## Tragende Konstanten (0 von 14)

**Keine.** Keine einzelne Konstante kippt den Ausgang um mehr als die Schwelle — das Regelwerk hängt an keiner Zahl allein, und ein Balancing-Fehler an einer Stelle verdirbt nicht die ganze Partie.

## Alle geprüften Konstanten

| Konstante | Ausschlag | Überlebende −25 % / +25 % | tragend |
|---|---|---|---|
| `baseTargetMorale` | 10.2 % | 5.0 / 5.0 | — |
| `productionMoraleFloor` | 6.4 % | 5.0 / 5.0 | — |
| `startMorale` | 4.3 % | 5.0 / 5.0 | — |
| `revoltThreshold` | 2.6 % | 5.0 / 5.0 | — |
| `moraleDriftDivisor` | 2.5 % | 5.0 / 5.0 | — |
| `marketElasticity` | 2.2 % | 5.0 / 5.0 | — |
| `expansionPenaltyPerProvince` | 1.5 % | 5.0 / 5.0 | — |
| `battleRate` | 1.4 % | 5.0 / 5.0 | — |
| `minDamage` | 0.0 % | 5.0 / 5.0 | — |
| `defenceCap` | 0.0 % | 5.0 / 5.0 | — |
| `deployDelayTicks` | 0.0 % | 5.0 / 5.0 | — |
| `regenPermillePerTick` | 0.0 % | 5.0 / 5.0 | — |
| `taxPerThousandPopulationPerTick` | 0.0 % | 5.0 / 5.0 | — |
| `stackFullContribution` | 0.0 % | 5.0 / 5.0 | — |
