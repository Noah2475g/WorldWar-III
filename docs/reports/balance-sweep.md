# Balancing — Parameterlauf

Erzeugt von `apps/headless/test/sweep.slow.test.ts` (`pnpm balance:sweep`).
6 Mächte, 120 Spieltage, 12 Startzahlen je Variante,
**Rauschgrenze der Zielgröße: 0.063** (Streuung des Führungsanteils allein durch die Startzahl, ohne jede Regeländerung, gemessen am 2026-09-07). Ein Ausschlag unterhalb dieser Grenze sagt nichts über die Konstante — er sagt etwas über die Startzahl. Aussagekräftig ist ab dem Doppelten, also 0.126.
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
| Anteil des Stärksten | 41.8 % |
| Überlebende Mächte | 4.0 von 6 |
| Endbestaende gesamt | 52.320 |
| Eroberte Provinzen | 247 |
| Gespielte Tage | 120 |

## Tragende Konstanten (0 von 14)

**Keine.** Keine einzelne Konstante kippt den Ausgang um mehr als die Schwelle — das Regelwerk hängt an keiner Zahl allein, und ein Balancing-Fehler an einer Stelle verdirbt nicht die ganze Partie.

## Alle geprüften Konstanten

| Konstante | Ausschlag | Überlebende −25 % / +25 % | tragend |
|---|---|---|---|
| `baseTargetMorale` | 6.3 % | 4.0 / 4.5 | — |
| `marketElasticity` | 5.9 % | 4.1 / 4.8 | — |
| `startMorale` | 5.4 % | 4.7 / 4.3 | — |
| `minDamage` | 5.3 % | 4.1 / 4.3 | — |
| `expansionPenaltyPerProvince` | 4.3 % | 4.4 / 4.0 | — |
| `battleRate` | 4.1 % | 4.3 / 4.1 | — |
| `revoltThreshold` | 4.0 % | 4.0 / 4.5 | — |
| `moraleDriftDivisor` | 3.6 % | 4.5 / 4.3 | — |
| `productionMoraleFloor` | 2.0 % | 4.2 / 4.3 | — |
| `taxPerThousandPopulationPerTick` | 2.0 % | 4.0 / 4.2 | — |
| `deployDelayTicks` | 1.4 % | 4.0 / 4.2 | — |
| `regenPermillePerTick` | 1.2 % | 4.1 / 4.2 | — |
| `stackFullContribution` | 0.4 % | 4.0 / 4.0 | — |
| `defenceCap` | 0.0 % | 4.0 / 4.0 | — |
