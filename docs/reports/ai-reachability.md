# Erreichbarkeit und Nachbarschaft (T-M14-11)

Erzeugt am 2026-09-06. Gemessen an der **ausgelieferten Voreinstellung**
(`DEFAULT_NEW_GAME`: Weltkarte, sieben Gegner, Punktesieg, Startzahl 1914) über
60 Spieltage mit der gemeinsamen Spielschleife aus T-M14-04.

## Der Befund

Zwei Stellen ließen die KI ins Leere greifen, und zusammen erklären sie fast jede
Messung des Audits, in der „nichts passiert" (`docs/reports/audit-2026-09-05.md`,
Ursache D):

1. **`hopDistance` zählt Seewege mit.** Als Maß für „wie weit ist das weg" ist das
   richtig, als Antwort auf „kann ich dort hinmarschieren" falsch — die KI benutzte es
   für beides. **3046 von 4464 Marschbefehlen endeten mit `NO_PATH`**, und weil sie
   denselben unmöglichen Befehl in jedem Tick neu fasste, wiederholte sie ihn bis zum
   Partieende. Inselmächte standen die ganze Partie still.
2. **Die Gegner kamen aus der Kartenreihenfolge.** In der Voreinstellung — Spieler:
   Vereinigte Staaten — waren das Russland, China und Indien: keiner mit Landweg zum
   Spieler. **0 Kriegserklärungen in 1000 Spieltagen.** Die KI konnte in dieser
   Aufstellung gar nicht kämpfen, und jede Aussage über ihr Verhalten maß die
   Aufstellung, nicht die KI.

## Gemessen

| Größe | vorher | nachher |
|---|---|---|
| Gegner in der Standardpartie | Russland, China, Indien … | **Kanada, Mexiko, Brasilien, Argentinien** … |
| Kriegserklärungen (60 Spieltage) | 0 | **6** |
| abgelehnte KI-Befehle | 57 % | **6,3 %** (101 von 1597) |

Die verbleibenden 6,3 % sind gewöhnliche Ablehnungen — zu wenig Vorrat, Bauplatz
belegt, Sperrfrist. Sie gehören zum Spiel; die 57 % gehörten es nicht.

## Was gebaut wurde

- **`landReachable`** (`packages/ai/src/targeting.ts`): Breitensuche allein über
  Landgrenzen. `rateProvinces` bewertet nur noch, was eine Landarmee erreicht.
  `hopDistance` bleibt unverändert — als Entfernungsmaß war es nie falsch.
- **`opponentsNear`** (`apps/desktop/src/game/newGame.ts`): die Gegner per Breitensuche
  über Landgrenzen ab dem Gebiet des Spielers, in der Reihenfolge, in der sie gefunden
  werden. Reicht die Nachbarschaft nicht für die gewünschte Zahl, füllen die übrigen
  Nationen in Kartenreihenfolge auf — eine Insel steht sonst ohne Gegner da.

Beides ist deterministisch: dieselbe Startzahl gibt dieselbe Partie.

## Was das für die Abnahme heißt

**AK-1 ist damit zum ersten Mal messbar.** „Eine vollständige Partie von Start bis
Sieg oder Niederlage gegen mindestens vier KI-Gegner" war in einer Aufstellung ohne
Landweg nicht nur ungetestet (Befund 2), sondern unerreichbar. Der Abnahmetest dazu ist
**T-M14-14**.

Der Seetransport bleibt offen: die KI beherrscht ihn nicht, und Inselmächte sind
deshalb weiterhin passiv. Das ist die amphibische KI aus **M17** — hier ging es darum,
dass die Landmacht überhaupt handeln kann.
