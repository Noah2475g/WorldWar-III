# Balancing — Parameterlauf

Erzeugt von `apps/headless/test/sweep.slow.test.ts` (`pnpm balance:sweep`).
6 Mächte, 120 Spieltage, 12 Startzahlen je Variante,
**Rauschgrenze der Zielgröße: 0.085** (Streuung des Führungsanteils allein durch die Startzahl, ohne jede Regeländerung, gemessen am 2026-09-05). Ein Ausschlag unterhalb dieser Grenze sagt nichts über die Konstante — er sagt etwas über die Startzahl. Aussagekräftig ist ab dem Doppelten, also 0.170.
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
| Anteil des Stärksten | 34.4 % |
| Überlebende Mächte | 5.1 von 6 |
| Endbestaende gesamt | 344.610 |
| Eroberte Provinzen | 305 |
| Gespielte Tage | 120 |

## Tragende Konstanten (0 von 14)

**Keine.** Keine einzelne Konstante kippt den Ausgang um mehr als die Schwelle — das Regelwerk hängt an keiner Zahl allein, und ein Balancing-Fehler an einer Stelle verdirbt nicht die ganze Partie.

## Alle geprüften Konstanten

| Konstante | Ausschlag | Überlebende −25 % / +25 % | tragend |
|---|---|---|---|
| `revoltThreshold` | 6.5 % | 5.5 / 4.9 | — |
| `baseTargetMorale` | 6.4 % | 4.8 / 5.3 | — |
| `expansionPenaltyPerProvince` | 5.2 % | 5.3 / 5.3 | — |
| `startMorale` | 4.6 % | 4.8 / 4.8 | — |
| `productionMoraleFloor` | 3.8 % | 4.5 / 4.8 | — |
| `minDamage` | 3.5 % | 5.4 / 5.0 | — |
| `battleRate` | 1.6 % | 5.1 / 5.2 | — |
| `regenPermillePerTick` | 1.6 % | 5.2 / 5.0 | — |
| `moraleDriftDivisor` | 0.6 % | 5.3 / 4.8 | — |
| `taxPerThousandPopulationPerTick` | 0.4 % | 5.1 / 4.7 | — |
| `deployDelayTicks` | 0.2 % | 5.1 / 5.2 | — |
| `defenceCap` | 0.0 % | 5.1 / 5.1 | — |
| `marketElasticity` | 0.0 % | 5.1 / 5.1 | — |
| `stackFullContribution` | 0.0 % | 5.1 / 5.1 | — |
