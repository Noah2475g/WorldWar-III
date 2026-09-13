# Balancing — Parameterlauf

Erzeugt von `apps/headless/test/sweep.slow.test.ts` (`pnpm balance:sweep`).
6 Mächte, 120 Spieltage, 12 Startzahlen je Variante,
**Rauschgrenze der Zielgröße: 0.056** (Streuung des Führungsanteils allein durch die Startzahl, ohne jede Regeländerung, gemessen am 2026-09-13). Ein Ausschlag unterhalb dieser Grenze sagt nichts über die Konstante — er sagt etwas über die Startzahl. Aussagekräftig ist ab dem Doppelten, also 0.111.
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
| Anteil des Stärksten | 36.8 % |
| Überlebende Mächte | 5.4 von 6 |
| Endbestaende gesamt | 45.357 |
| Eroberte Provinzen | 310 |
| Gespielte Tage | 120 |

## Tragende Konstanten (0 von 14)

**Keine.** Keine einzelne Konstante kippt den Ausgang um mehr als die Schwelle — das Regelwerk hängt an keiner Zahl allein, und ein Balancing-Fehler an einer Stelle verdirbt nicht die ganze Partie.

## Alle geprüften Konstanten

| Konstante | Ausschlag | Überlebende −25 % / +25 % | tragend |
|---|---|---|---|
| `battleRate` | 8.6 % | 4.8 / 5.3 | — |
| `startMorale` | 4.5 % | 5.2 / 4.7 | — |
| `expansionPenaltyPerProvince` | 4.4 % | 4.8 / 5.1 | — |
| `productionMoraleFloor` | 4.2 % | 4.6 / 4.9 | — |
| `moraleDriftDivisor` | 3.9 % | 5.3 / 4.6 | — |
| `taxPerThousandPopulationPerTick` | 3.6 % | 5.4 / 4.9 | — |
| `baseTargetMorale` | 3.2 % | 4.6 / 4.1 | — |
| `regenPermillePerTick` | 3.1 % | 5.5 / 5.6 | — |
| `marketElasticity` | 2.8 % | 4.9 / 4.8 | — |
| `revoltThreshold` | 2.7 % | 5.4 / 5.1 | — |
| `minDamage` | 2.4 % | 5.6 / 4.8 | — |
| `stackFullContribution` | 1.5 % | 5.4 / 5.5 | — |
| `deployDelayTicks` | 0.7 % | 5.4 / 5.3 | — |
| `defenceCap` | 0.0 % | 5.4 / 5.4 | — |
