# Balancing — Parameterlauf

Erzeugt von `apps/headless/test/sweep.slow.test.ts` (`pnpm balance:sweep`).
6 Mächte, 120 Spieltage, 12 Startzahlen je Variante,
**Rauschgrenze der Zielgröße: 0.062** (Streuung des Führungsanteils allein durch die Startzahl, ohne jede Regeländerung, gemessen am 2026-09-06). Ein Ausschlag unterhalb dieser Grenze sagt nichts über die Konstante — er sagt etwas über die Startzahl. Aussagekräftig ist ab dem Doppelten, also 0.125.
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
| Anteil des Stärksten | 32.6 % |
| Überlebende Mächte | 4.8 von 6 |
| Endbestaende gesamt | 378.954 |
| Eroberte Provinzen | 211 |
| Gespielte Tage | 120 |

## Tragende Konstanten (0 von 14)

**Keine.** Keine einzelne Konstante kippt den Ausgang um mehr als die Schwelle — das Regelwerk hängt an keiner Zahl allein, und ein Balancing-Fehler an einer Stelle verdirbt nicht die ganze Partie.

## Alle geprüften Konstanten

| Konstante | Ausschlag | Überlebende −25 % / +25 % | tragend |
|---|---|---|---|
| `productionMoraleFloor` | 4.7 % | 4.8 / 4.7 | — |
| `baseTargetMorale` | 3.3 % | 4.6 / 4.9 | — |
| `regenPermillePerTick` | 2.6 % | 4.8 / 4.9 | — |
| `startMorale` | 2.4 % | 4.8 / 5.1 | — |
| `expansionPenaltyPerProvince` | 2.2 % | 4.5 / 4.9 | — |
| `minDamage` | 2.1 % | 4.8 / 4.8 | — |
| `moraleDriftDivisor` | 2.1 % | 5.7 / 4.9 | — |
| `taxPerThousandPopulationPerTick` | 2.0 % | 4.8 / 4.5 | — |
| `revoltThreshold` | 1.5 % | 4.8 / 4.8 | — |
| `battleRate` | 1.2 % | 4.7 / 5.1 | — |
| `deployDelayTicks` | 1.2 % | 4.8 / 4.7 | — |
| `stackFullContribution` | 0.1 % | 4.8 / 4.8 | — |
| `defenceCap` | 0.0 % | 4.8 / 4.8 | — |
| `marketElasticity` | 0.0 % | 4.8 / 4.8 | — |
