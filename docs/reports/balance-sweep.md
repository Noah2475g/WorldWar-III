# Balancing — Parameterlauf

Erzeugt von `apps/headless/test/sweep.slow.test.ts` (`pnpm balance:sweep`).
6 Mächte, 120 Spieltage, 12 Startzahlen je Variante,
**Rauschgrenze der Zielgröße: 0.078** (Streuung des Führungsanteils allein durch die Startzahl, ohne jede Regeländerung, gemessen am 2026-09-12). Ein Ausschlag unterhalb dieser Grenze sagt nichts über die Konstante — er sagt etwas über die Startzahl. Aussagekräftig ist ab dem Doppelten, also 0.157.
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
| Anteil des Stärksten | 44.4 % |
| Überlebende Mächte | 5.2 von 6 |
| Endbestaende gesamt | 50.613 |
| Eroberte Provinzen | 302 |
| Gespielte Tage | 120 |

## Tragende Konstanten (0 von 14)

**Keine.** Keine einzelne Konstante kippt den Ausgang um mehr als die Schwelle — das Regelwerk hängt an keiner Zahl allein, und ein Balancing-Fehler an einer Stelle verdirbt nicht die ganze Partie.

## Alle geprüften Konstanten

| Konstante | Ausschlag | Überlebende −25 % / +25 % | tragend |
|---|---|---|---|
| `baseTargetMorale` | 12.5 % | 4.4 / 5.1 | — |
| `marketElasticity` | 11.1 % | 5.3 / 4.8 | — |
| `expansionPenaltyPerProvince` | 9.5 % | 4.7 / 4.2 | — |
| `revoltThreshold` | 7.2 % | 5.1 / 5.1 | — |
| `taxPerThousandPopulationPerTick` | 6.7 % | 5.2 / 4.7 | — |
| `productionMoraleFloor` | 5.9 % | 4.6 / 5.1 | — |
| `minDamage` | 5.7 % | 5.6 / 4.9 | — |
| `moraleDriftDivisor` | 5.2 % | 4.7 / 4.4 | — |
| `startMorale` | 4.4 % | 4.1 / 4.1 | — |
| `regenPermillePerTick` | 4.3 % | 5.1 / 5.3 | — |
| `battleRate` | 3.2 % | 4.7 / 5.0 | — |
| `deployDelayTicks` | 1.7 % | 5.2 / 5.0 | — |
| `stackFullContribution` | 1.0 % | 5.2 / 5.0 | — |
| `defenceCap` | 0.0 % | 5.2 / 5.2 | — |
