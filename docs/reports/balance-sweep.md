# Balancing — Parameterlauf

Erzeugt von `apps/headless/test/sweep.slow.test.ts` (`pnpm balance:sweep`).
6 Mächte, 120 Spieltage, 12 Startzahlen je Variante,
**Rauschgrenze der Zielgröße: 0.056** (Streuung des Führungsanteils allein durch die Startzahl, ohne jede Regeländerung, gemessen am 2026-09-25). Ein Ausschlag unterhalb dieser Grenze sagt nichts über die Konstante — er sagt etwas über die Startzahl. Aussagekräftig ist ab dem Doppelten, also 0.112.
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
| Anteil des Stärksten | 38.4 % |
| Überlebende Mächte | 5.7 von 6 |
| Endbestaende gesamt | 46.721 |
| Eroberte Provinzen | 241 |
| Gespielte Tage | 120 |

## Tragende Konstanten (0 von 14)

**Keine.** Keine einzelne Konstante kippt den Ausgang um mehr als die Schwelle — das Regelwerk hängt an keiner Zahl allein, und ein Balancing-Fehler an einer Stelle verdirbt nicht die ganze Partie.

## Alle geprüften Konstanten

| Konstante | Ausschlag | Überlebende −25 % / +25 % | tragend |
|---|---|---|---|
| `baseTargetMorale` | 7.5 % | 4.8 / 4.7 | — |
| `revoltThreshold` | 5.2 % | 5.6 / 5.4 | — |
| `expansionPenaltyPerProvince` | 4.3 % | 5.3 / 5.0 | — |
| `startMorale` | 4.2 % | 4.9 / 5.2 | — |
| `moraleDriftDivisor` | 3.9 % | 4.8 / 5.2 | — |
| `productionMoraleFloor` | 3.1 % | 5.2 / 5.5 | — |
| `marketElasticity` | 2.9 % | 5.1 / 5.3 | — |
| `minDamage` | 2.7 % | 5.2 / 5.3 | — |
| `regenPermillePerTick` | 2.5 % | 5.3 / 5.6 | — |
| `taxPerThousandPopulationPerTick` | 2.3 % | 5.7 / 5.3 | — |
| `deployDelayTicks` | 1.9 % | 5.7 / 5.8 | — |
| `battleRate` | 1.6 % | 5.2 / 5.4 | — |
| `stackFullContribution` | 1.4 % | 5.5 / 5.6 | — |
| `defenceCap` | 0.0 % | 5.7 / 5.7 | — |
