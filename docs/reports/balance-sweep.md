# Balancing — Parameterlauf

Erzeugt von `apps/headless/test/sweep.slow.test.ts` (`pnpm balance:sweep`).
6 Mächte, 120 Spieltage, 12 Startzahlen je Variante,
**Rauschgrenze der Zielgröße: 0.042** (Streuung des Führungsanteils allein durch die Startzahl, ohne jede Regeländerung, gemessen am 2026-10-10). Ein Ausschlag unterhalb dieser Grenze sagt nichts über die Konstante — er sagt etwas über die Startzahl. Aussagekräftig ist ab dem Doppelten, also 0.085.
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
| Anteil des Stärksten | 30.9 % |
| Überlebende Mächte | 5.1 von 6 |
| Endbestaende gesamt | 55.801 |
| Eroberte Provinzen | 241 |
| Gespielte Tage | 120 |

## Tragende Konstanten (0 von 14)

**Keine.** Keine einzelne Konstante kippt den Ausgang um mehr als die Schwelle — das Regelwerk hängt an keiner Zahl allein, und ein Balancing-Fehler an einer Stelle verdirbt nicht die ganze Partie.

## Alle geprüften Konstanten

| Konstante | Ausschlag | Überlebende −25 % / +25 % | tragend |
|---|---|---|---|
| `baseTargetMorale` | 8.0 % | 5.1 / 5.3 | — |
| `battleRate` | 5.1 % | 5.3 / 5.1 | — |
| `moraleDriftDivisor` | 4.5 % | 5.4 / 5.2 | — |
| `taxPerThousandPopulationPerTick` | 4.0 % | 5.1 / 5.1 | — |
| `regenPermillePerTick` | 3.6 % | 5.1 / 5.2 | — |
| `startMorale` | 3.4 % | 5.3 / 5.2 | — |
| `revoltThreshold` | 2.5 % | 5.1 / 4.8 | — |
| `deployDelayTicks` | 2.5 % | 5.1 / 5.1 | — |
| `expansionPenaltyPerProvince` | 2.4 % | 5.3 / 5.5 | — |
| `productionMoraleFloor` | 1.2 % | 5.7 / 5.3 | — |
| `minDamage` | 1.0 % | 5.3 / 5.3 | — |
| `marketElasticity` | 1.0 % | 5.7 / 5.5 | — |
| `stackFullContribution` | 0.5 % | 5.1 / 5.2 | — |
| `defenceCap` | 0.0 % | 5.1 / 5.1 | — |
