# Balancing — Parameterlauf

Erzeugt von `apps/headless/test/sweep.slow.test.ts` (`pnpm balance:sweep`).
6 Mächte, 120 Spieltage, 12 Startzahlen je Variante,
**Rauschgrenze der Zielgröße: 0.062** (Streuung des Führungsanteils allein durch die Startzahl, ohne jede Regeländerung, gemessen am 2026-09-07). Ein Ausschlag unterhalb dieser Grenze sagt nichts über die Konstante — er sagt etwas über die Startzahl. Aussagekräftig ist ab dem Doppelten, also 0.124.
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
| Anteil des Stärksten | 32.4 % |
| Überlebende Mächte | 5.2 von 6 |
| Endbestaende gesamt | 49.954 |
| Eroberte Provinzen | 246 |
| Gespielte Tage | 120 |

## Tragende Konstanten (0 von 14)

**Keine.** Keine einzelne Konstante kippt den Ausgang um mehr als die Schwelle — das Regelwerk hängt an keiner Zahl allein, und ein Balancing-Fehler an einer Stelle verdirbt nicht die ganze Partie.

## Alle geprüften Konstanten

| Konstante | Ausschlag | Überlebende −25 % / +25 % | tragend |
|---|---|---|---|
| `productionMoraleFloor` | 10.1 % | 4.9 / 4.8 | — |
| `taxPerThousandPopulationPerTick` | 7.9 % | 5.2 / 4.8 | — |
| `baseTargetMorale` | 7.0 % | 4.2 / 4.7 | — |
| `moraleDriftDivisor` | 5.7 % | 4.6 / 4.1 | — |
| `expansionPenaltyPerProvince` | 5.4 % | 4.5 / 4.4 | — |
| `marketElasticity` | 5.0 % | 5.2 / 4.3 | — |
| `battleRate` | 4.1 % | 4.7 / 4.8 | — |
| `startMorale` | 4.1 % | 4.9 / 4.9 | — |
| `revoltThreshold` | 4.1 % | 4.6 / 4.4 | — |
| `minDamage` | 2.8 % | 4.3 / 5.4 | — |
| `regenPermillePerTick` | 1.8 % | 4.4 / 5.1 | — |
| `deployDelayTicks` | 0.8 % | 5.2 / 4.9 | — |
| `stackFullContribution` | 0.1 % | 5.0 / 5.2 | — |
| `defenceCap` | 0.0 % | 5.2 / 5.2 | — |
