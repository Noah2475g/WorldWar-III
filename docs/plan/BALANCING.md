# BALANCING

Alle Zahlen des Spiels mit Belegstatus. Quelle für Belegtes ist
`docs/research/SUPREMACY-MECHANICS.md`; Geschätztes wird über den Parameterlauf
(`pnpm balance:sweep`, T-M12-00) abgestimmt.

| Status | Bedeutung |
|---|---|
| **belegt** | aus der Mechanik-Referenz, mit Quellenangabe |
| **abgeleitet** | rechnerisch aus belegten Zahlen gefolgert |
| **geschätzt** | keine Quelle — begründet gesetzt, über Testpartien abgestimmt |

## Zeit

| Größe | Wert | Status | Herkunft |
|---|---|---|---|
| Tick | 1 Spielstunde | belegt | Combat Tick des Originals |
| Spieltag | 24 Ticks | belegt | Day Change |

## Moral

| Größe | Wert | Status | Herkunft |
|---|---|---|---|
| Drift je Spieltag | ein Siebtel der Lücke zum Zielwert | belegt | Fan-Wiki, Stand 2024 |
| Produktionsfaktor | `0,20 + 0,80 × Moral` | belegt | Bytro-Hilfe zum Umbau 2023 |
| Aufstandsrisiko je Tag | `max(0, (33 − Moral) × 3) %` | belegt | Fan-Wiki, Handbuch |
| Startmoral | 70 | belegt | Handbuch |
| Moral nach Eroberung | 25 | belegt | Handbuch |
| Grundzielmoral | 102 | belegt | Handbuch |

## Kampf

| Größe | Wert | Status | Herkunft |
|---|---|---|---|
| Streuung je Kampftick | ±10 %, keine Fehlschläge | belegt | Umbau 2023 |
| Stapel-Deckel, **Grenzbeitrag** | 100 % bis 20 Einheiten, linear auf 0 % bis 50 | belegt | Umbau 2023 |
| Stapel-Deckel, **Gesamtbeitrag** | `n` bis 20, dann `n − (n−20)²/60`, Plateau bei 35 ab 50 | abgeleitet (Integral) | T-M14-06, 2026-09-06 |
| Zustandsfaktor | 100 % Trefferpunkte → 100 % Schaden, 0 % → 50 % | belegt | Umbau 2023 |
| Angriffs-/Verteidigungswerte je Einheit | **offen** | geschätzt | nach 2023 neu skaliert, nicht veröffentlicht |
| Trefferpunkte je Einheit | **offen** | geschätzt | dieselbe Lücke |

## Bewegung

| Größe | Wert | Status | Herkunft |
|---|---|---|---|
| Fremdes Gebiet | ×0,70 | belegt | Geschwindigkeitstabelle |
| Feindliches Gebiet | ×0,35 | belegt | Geschwindigkeitstabelle |
| Eisenbahn | ×2,5 | belegt | Geschwindigkeitstabelle |
| Einschiffen / Ausschiffen mit Hafen | 3 h / 1,5 h | belegt | Handbuch |
| An feindlicher Küste | ×1,5 auf beide Zeiten | belegt | Handbuch |

_Weitere Zeilen entstehen mit den zugehörigen Aufgaben (T-M3-01 Regelwerk, T-M12-01 Festschreibung)._

## Alle Konstanten mit Status

Vollständig und maschinell geprüft: `test/balancing.test.ts` verlangt für jede Zahl in
`data/rules/default/constants.json` eine Zeile mit Status. Eine neue Konstante ohne
Eintrag lässt den Testlauf scheitern — das ist der einzige Weg, wie eine Tabelle wie
diese über Jahre stimmt.

Die Spalte **Ausschlag** kommt aus dem Parameterlauf (`pnpm balance:sweep`,
`docs/reports/balance-sweep.md`): um wie viel sich der Partieausgang verschiebt, wenn
die Zahl um ±25 % bewegt wird. Fett = tragend, also eine Zahl, die stimmen muss.
Ein Strich heißt: im Lauf nicht geprüft.

> **Und was die Spalte heute nicht sagen kann (T-M14-05, 2026-09-06).** Der Lauf misst
> seit dem 2026-09-06 seine eigene Auflösung: die Zielgröße streut **allein durch die
> Startzahl um 0,085**, ohne jede Regeländerung. Der größte gemessene Ausschlag über alle
> Konstanten liegt bei **6,5 %** — also *unterhalb* dieser Rauschgrenze.
>
> Daraus folgt nicht „keine Konstante ist tragend", sondern: **der Lauf kann es in dieser
> Auflösung nicht entscheiden.** Bis zum 2026-09-06 stand hier die erste Lesart, und sie
> war unbelegt (Befund 23 des Audits) — mit zwei Startzahlen je Variante gemittelt, wo
> die Streuung acht gebraucht hätte. Jetzt sind es zwölf, und die Grenze steht im Bericht.
>
> Wer eine Aussage über eine einzelne Konstante braucht, braucht mehr Startzahlen oder
> eine schärfere Zielgröße. Was der Lauf weiterhin zuverlässig findet, ist der grobe
> Fall: eine Zahl, die die Partie *kippt*, läge weit über 17 %.

| Konstante | Wert | Status | Ausschlag | Herkunft |
|---|---|---|---|---|
| `ticksPerDay` | 24 | belegt | — | Combat Tick = 1 Spielstunde, Day Change = 24 Ticks |
| `startMorale` | 70.000 | belegt | 4.3 % | Handbuch: Startmoral 70 |
| `capturedMorale` | 25.000 | belegt | — | Handbuch: Moral nach Eroberung 25 |
| `baseTargetMorale` | 102.000 | belegt | 10.2 % | Handbuch: Grundzielmoral 102 |
| `moraleDriftDivisor` | 7 | belegt | 2.5 % | Fan-Wiki: ein Siebtel der Lücke je Spieltag |
| `productionMoraleFloor` | 200 | belegt | 6.4 % | Bytro-Hilfe 2023: Produktion = 0,20 + 0,80 × Moral |
| `revoltThreshold` | 33.000 | belegt | 2.6 % | Fan-Wiki: Aufstände ab Moral 33 |
| `revoltChancePerPointPermille` | 30 | belegt | — | Fan-Wiki: (33 − Moral) × 3 % je Tag |
| `ownNeighborBonus` | 1.000 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `ownNeighborBonusMax` | 4.000 | abgeleitet | — | Deckel des belegten Nachbarbonus |
| `enemyNeighborPenalty` | 3.000 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `enemyNeighborPenaltyMax` | 15.000 | abgeleitet | — | Deckel der belegten Nachbarstrafe |
| `foodSurplusBonus` | 3.000 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `foodShortagePenalty` | 20.000 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `occupationPenalty` | 25.000 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `occupationPenaltyDays` | 14 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `capitalLossDays` | 14 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `capitalLossProductionFactor` | 750 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `capitalLossMoralePenalty` | 10.000 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `battleRate` | 80 | geschätzt | 1.4 % | begründet gesetzt, im Parameterlauf gemessen |
| `minDamage` | 100 | geschätzt | 0.0 % | begründet gesetzt, im Parameterlauf gemessen |
| `defenceCap` | 4.000 | geschätzt | 0.0 % | begründet gesetzt, im Parameterlauf gemessen |
| `battleMoraleLoss` | 1.000 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `combatSpreadPermille` | 100 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `stackFullContribution` | 20 | geschätzt | 0.0 % | begründet gesetzt, im Parameterlauf gemessen |
| `stackZeroContribution` | 50 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `healthDamageFloor` | 500 | abgeleitet | — | aus dem Trefferpunkte-Pool-Modell gefolgert (DECISIONS, T-M4-03) |
| `deployDelayTicks` | 2 | geschätzt | 0.0 % | begründet gesetzt, im Parameterlauf gemessen |
| `deployDelayFactor` | 500 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `retreatLossPermille` | 100 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `retreatCooldownTicks` | 24 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `bombardFactor` | 500 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `regenPermillePerTick` | 5 | geschätzt | 0.0 % | begründet gesetzt, im Parameterlauf gemessen |
| `regenShortageFactor` | 500 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `foreignTerritoryFactor` | 700 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `hostileTerritoryFactor` | 350 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `railwayFactor` | 2.500 | belegt | — | Handbuch: Bahnbonus auf die Marschgeschwindigkeit |
| `embarkTicks` | 3 | belegt | — | Handbuch: feste Einschiffungszeit |
| `disembarkTicks` | 2 | belegt | — | Handbuch: feste Ausschiffungszeit |
| `hostileCoastFactor` | 1.500 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `maxBuildSlotsCity` | 2 | belegt | — | Handbuch: Bauplätze je Großstadt |
| `maxBuildSlotsRural` | 1 | belegt | — | Handbuch: Bauplätze je Landprovinz |
| `capitalMoveCooldownDays` | 30 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `warDeclarationDelayTicks` | 12 | belegt | — | Handbuch: Kriegserklärung wird nach Vorlaufzeit wirksam |
| `surpriseAttackReputationLoss` | 200 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `truceDurationDays` | 5 | belegt | — | Handbuch: Waffenstillstand läuft nach fester Frist ab |
| `marketElasticity` | 50 | geschätzt | 2.2 % | begründet gesetzt, im Parameterlauf gemessen |
| `marketReversionPermille` | 50 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `marketMinPrice` | 200 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `marketMaxPrice` | 5.000 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `scoreProvince` | 10 | belegt | — | Handbuch: Punkte je Provinz |
| `scorePopulationPer1000` | 1 | belegt | — | Handbuch: Punkte je 1000 Einwohner |
| `scoreBuildingLevel` | 2 | abgeleitet | — | aus der Punktesystematik gefolgert |
| `scoreUnit` | 1 | abgeleitet | — | aus der Punktesystematik gefolgert |
| `capitalDistancePenalty` | 35.000 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `capitalDistanceRange` | 8 | abgeleitet | — | Reichweite der belegten Hauptstadtentfernung |
| `expansionFreeProvinces` | 2 | geschätzt | — | begründet gesetzt, im Parameterlauf gemessen |
| `expansionPenaltyPerProvince` | 3.000 | geschätzt | 1.5 % | begründet gesetzt, im Parameterlauf gemessen |
| `expansionPenaltyMax` | 35.000 | abgeleitet | — | Deckel der Ausdehnungsstrafe |
| `taxPerThousandPopulationPerTick` | 2 | geschätzt | 0.0 % | begründet gesetzt, im Parameterlauf gemessen |

## Das Verhältnis zwischen zwei Mächten (R-DIP-06, T-M15-05)

Alle sieben Zahlen **geschätzt** — für Ansehen und Verstimmung gibt es im Vorbild keine
veröffentlichten Werte, und der Umbau 2023 hat die Skalen ohnehin neu gesetzt. Was sie
tragen, ist gemessen und steht in `docs/reports/ai-tournament.md`.

| Konstante | Wert | Status | Begründung |
|---|---|---|---|
| `reputationBaseline` | 1.000 | geschätzt | der Ausgangswert, auf den alles zurückkriecht; 1000 = „nichts vorgefallen", damit die Skala mit dem Verhältnis dieselbe ist |
| `reputationRecoveryPerDay` | 10 | geschätzt | ein Überfall kostet 200, ist also nach 20 Spieltagen vergessen — lang genug, um im selben Krieg zu wirken, kurz genug, um eine Partie nicht zu bestimmen |
| `grievanceOnProvinceLost` | 250 | geschätzt | vier verlorene Provinzen erreichen den Deckel; der häufigste Anlass, und deshalb der kleinere der beiden |
| `grievanceOnSurpriseAttack` | 400 | geschätzt | schwerer als eine verlorene Provinz: der Überfall bricht ein Versprechen, die Eroberung nur eine Front |
| `grievanceDecayPermillePerDay` | 30 | geschätzt | 3 % je Tag — eine Verstimmung von 400 ist nach rund 80 Spieltagen unter 40; Zeit heilt, aber nicht innerhalb eines Krieges |
| `grievanceMax` | 1.000 | abgeleitet | die Skala des Verhältnisses; ohne Deckel könnte eine einzige Macht das Verhältnis auf null drücken und dort halten |
| `stalemateDaysBeforePeace` | 20 | geschätzt | Spieltage ohne Provinzwechsel, nach denen ein Krieg als festgefahren gilt. **Gemessen:** ohne diese Bedingung endete in 150 Turnierpartien *kein einziger* Krieg; mit ihr 78 Friedensschlüsse in 50 Partien |

### Die Kriegs- und Vertrauensschwelle je Stufe

| Stufe | `warThreshold` | `trustThreshold` | `recruitShare` |
|---|---|---|---|
| leicht | 300 | 500 | 80 |
| normal | 450 | 650 | **120** |
| schwer | 600 | 800 | **500** |

`warThreshold` ist **neu und ein eigener Wert**: bis zum 2026-09-06 leitete sich die
Kriegsschwelle aus `maxFronts` ab (`maxFronts >= 3 ? 1200 : 1600`), und dieser eine Wert
bedeutete damit drei Dinge — Frontenzahl, Kriegsschwelle und Risikobereitschaft. Wer eine
davon ändern wollte, änderte alle drei. `maxFronts` trägt jetzt nur noch die Frontenzahl.

**`recruitShare` ist am 2026-09-06 gespreizt worden, und zwar gemessen.** Vorher 80 / 200 /
330; „schwer gegen normal" war damit **nicht unterscheidbar** — jedes der 25 Paare endete
unentschieden. Ein Versuch mit 120 / 500 ergab 8 von 10 Paaren für „schwer", einer mit
150 / 400 wieder nur Unentschieden; die Wirkung liegt also an den Rändern, nicht in der
Mitte. Übernommen wurde das gemessene Paar. Zeit half nicht: 40, 80 und 150 Spieltage
ergaben dasselbe Bild.

**Was dabei offen bleibt:** „schwer gegen leicht" steht bei **1,00** — „leicht" gewinnt
keine einzige Partie. Eine Obergrenze dafür ist nicht einzuhalten, ohne „schwer"
absichtlich schlechter zu machen; sie steht deshalb zwischen den *benachbarten* Stufen,
wo eine Mauer dem Spieler wirklich schadet. Begründet in `PROBLEME.md`.

## Feuerautomatik (R-BAT-08, T-M15-07)

Die Automatik führt **keine eigene Zahl** ein: sie benutzt dieselbe Rechnung wie der
Handbeschuss, einschließlich `bombardFactor`. Das ist die ganze Absicht des Umbaus —
dieselbe Kanone, eine Regel, gleich wer abdrückt.

**Was neu ist, ist eine Reihenfolge, keine Zahl:** die Beschussphase steht zwischen
Bewegung und Nahkampf. Vorher wirkte `BOMBARD` als Kommando in Phase 1, der Nahkampf in
Phase 8; eine Armee, die in diesem Tick abmarschierte, wurde noch am alten Ort getroffen.

**Selbsttätige Beschussereignisse je Stufe, gemessen am 2026-09-06:** 0, 0, 0 — in 20
Partien über 40 und in 10 über 150 Spieltage. Die Ursache ist nachgemessen und steht in
`PROBLEME.md`: die KI baut auf der Testkarte nie eine Fabrik (83.081 Holz gegen 667.000
Kosten), also nie Artillerie. **R-BAT-08/AK3 ist damit offen** und an T-M15-08 zugewiesen.
Die Zahl steht hier trotzdem, weil eine fehlende Zeile in dieser Tabelle so aussähe, als
wäre die Frage nie gestellt worden.

## Die Freischaltungsachse — erster Spieltag je Sache

R-TECH-01 (T-M15-02, 2026-09-06). Der Befund war keine falsche Zahl, sondern eine fehlende
Achse: **Spieltag 1 unterschied sich von Spieltag 40 durch nichts als den Kontostand.**
Jede Sache trägt jetzt einen ersten Spieltag; davor lehnt der Kern mit
`NOT_YET_AVAILABLE` ab und nennt den Tag.

**Fünf Zahlen sind belegt** (Referenz 1.4, `docs/research/SUPREMACY-MECHANICS.md`), die
übrigen zwölf abgeleitet. Die Ableitungsregel steht in der letzten Spalte und ist überall
dieselbe Idee: eine Sache kommt nie vor dem Gebäude, das sie braucht, und der Abstand
folgt dem Aufwand. `test/balancing.test.ts` verlangt für jedes der 7 Gebäude und jede der
10 Einheiten eine Zeile hier — eine neue Sache ohne Eintrag lässt den Testlauf scheitern.

### Gebäude

| Sache | Tag | Status | Begründung |
|---|---|---|---|
| `barracks` | 1 | belegt | Referenz 1.4 — das Spiel beginnt mit der Möglichkeit zu rekrutieren |
| `harbour` | 2 | belegt | Referenz 1.4 |
| `fortress` | 3 | abgeleitet | zwischen Hafen und Eisenbahn: rein defensiv, deshalb früh, aber nicht am ersten Tag — sonst gräbt sich jeder ein, bevor überhaupt jemand marschiert |
| `railway` | 5 | belegt | Referenz 1.4 |
| `factory` | 8 | belegt | Referenz 1.4 |
| `shipyard` | 9 | abgeleitet | einen Tag nach der Fabrik: Kriegsschiffe sind der Fabrik gleichrangig, brauchen aber zusätzlich einen Hafen |
| `airfield` | 10 | belegt | Referenz 1.4 |

### Einheiten

| Sache | Tag | Status | Begründung |
|---|---|---|---|
| `infantry` | 1 | abgeleitet | mit der Kaserne — die erste Partie muss am ersten Tag etwas zu tun haben |
| `transport` | 3 | abgeleitet | einen Tag nach dem Hafen; Transport ist kein Kampfmittel und darf früh kommen |
| `motorized` | 4 | abgeleitet | drei Tage nach der Infanterie: dieselbe Kaserne, spürbar mehr Tempo |
| `tank` | 8 | abgeleitet | mit der Fabrik — sie hat sonst am Tag ihrer Freischaltung keinen Zweck |
| `artillery` | 9 | abgeleitet | einen Tag nach dem Panzer; sie ist Vorbedingung der Feuerautomatik (R-BAT-08) und darf nicht ans Ende rutschen |
| `fighter` | 10 | abgeleitet | mit dem Flugplatz |
| `destroyer` | 11 | abgeleitet | zwei Tage nach der Werft: das erste Kriegsschiff |
| `bomber` | 13 | abgeleitet | drei Tage nach dem Jäger — Luftüberlegenheit vor Bodenwirkung |
| `heavy_tank` | 14 | abgeleitet | sechs Tage nach dem Panzer; er braucht ohnehin die zweite Fabrikstufe |
| `rocket_artillery` | 16 | abgeleitet | die späteste Sache im Spiel: größte Reichweite, deshalb der Schlusspunkt der Achse |

**Was hier bewusst fehlt:** eine Zahl für „wie lange dauert eine Partie". Der Abnahmelauf
misst 822 Spieltage (`docs/reports/fullgame.json`), die späteste Freischaltung liegt bei
Tag 16 — die Achse prägt also die **Eröffnung**, nicht den Verlauf. Das ist beabsichtigt
und die kleinste Fassung, die den Befund behebt; ob sie zu kurz greift, beantwortet der
Playtest und nicht diese Tabelle.

## Was der Parameterlauf ergeben hat

Gemessen am 2026-09-03 auf der Weltkarte **nach** der Korrektur ihrer Wirtschaftsskala
(`DECISIONS.md`, gleicher Tag): Von 14 Konstanten ist **keine tragend** — keine einzelne
kippt den Anteil des Stärksten um mehr als die Schwelle von 15 %. Am meisten bewegen
die Moralzahlen: `baseTargetMorale` 10,2 %, `productionMoraleFloor` 6,4 %,
`startMorale` 4,3 %. Die Kampfwerte `battleRate`, `minDamage` und `defenceCap` um ein
Viertel zu bewegen ändert am Ausgang **so gut wie nichts** (1,4 % und weniger).

Das sagt zweierlei über das Spiel: Das Regelwerk hängt an keiner Zahl allein — ein
Balancing-Fehler an einer Stelle verdirbt nicht die ganze Partie. Und was Partien
bewegt, ist die Moral — über Produktion, Aufstände und die Stärke frisch ausgehobener
Truppen —, nicht die Härte, mit der zwei Armeen zuschlagen. Wer am Balancing arbeitet,
arbeitet an den Moralzahlen; die Kampfwerte kann er in Ruhe lassen.

Der erste Lauf (vor der Korrektur) hatte vier tragende Konstanten gemeldet, alle rund um
Moral und Ausdehnung. Er lief auf einer Karte, deren Vorkommen tausendfach über der
Skala der Regeln lagen — Geld und Material waren nie knapp, und die Ausschläge bildeten
nur ab, wie schnell sich eine gesättigte Wirtschaft in Provinzen umsetzt. Diese Zahlen
gelten nicht mehr; die Spalte oben trägt die neuen.

## Keine ausartende Wirtschaft, keine unbesiegbare Strategie

Im Langlauf über 1000 Spieltage (`pnpm test:slow`, T-M9-04) wächst keine Ressource
unbegrenzt, und der Kennzahlenbericht (T-M5-06) schlägt fehl, sobald eine es täte.
Im Turnier über 50 Partien (T-M7-05) gewinnt die schwere Stufe gegen die leichte in
mindestens 70 % der Fälle — ein wirkungsloser Schwierigkeitsgrad fällt damit auf.

> **Richtiggestellt am 2026-09-06 (T-M14-05).** Hier stand bis heute der Zusatz „ohne dass
> eine Stufe je alle Partien gewinnt". Der Bericht, auf den sich der Satz beruft, sagt das
> Gegenteil: `docs/reports/ai-tournament.md` meldet **50 Siege aus 50 Partien, Siegquote
> 100 %**. Der Test konnte den Widerspruch nicht sehen, weil er allein eine Untergrenze
> prüft (≥ 70 %) und es im ganzen Bestand keine Obergrenze auf einer Siegquote gibt.
>
> Eine Obergrenze wird hier **nicht** nachgereicht. Sie wäre gegen die heutige Messung
> sofort rot, machte `pnpm test:slow` rot und damit AK-4, AK-6 und die ganze Abnahmekette —
> ein Tor, das die Abnahme blockiert, weil eine andere Aufgabe noch aussteht, ist genau der
> Fehler, den T-M14-01 gerade behoben hat. Die Reparatur gehört zur Sache selbst und liegt
> bei **T-M15-05**, wo das Verhältnis die KI steuert und die Stufen erstmals mehr
> unterscheidet als eine Zahl. Bis dahin gilt: 100 % ist **gemessen, nicht gewollt**, und
> steht als offener Befund in `PROBLEME.md`.
