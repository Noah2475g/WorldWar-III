# KI-Turnier (T-M7-05, erweitert in T-M15-05)

Je 50 Partien, 40 Spieltage, Seiten jede zweite Partie getauscht, feste Seeds ab 1000.

## Grundlauf vom 2026-09-06 — **vor** jeder Änderung an der Diplomatie

Dieser Abschnitt ist die Messlatte für T-M15-05, Schritt 2. Er ist erhoben worden, bevor
eine Zeile in `packages/ai/src/diplomacy.ts` angefasst wurde — sonst wäre jede spätere
Aussage über die Wirkung der neuen Regel Blindflug.

| Paarung | Start | Siege A | Siege B | Unentschieden | Siegquote A | Kriegserklärungen | Friedensschlüsse |
|---|---|---|---|---|---|---|---|
| schwer gegen **normal** | im Krieg | 25 | 25 | 0 | **0,50** | 49 | **0** |
| schwer gegen **normal** | im Frieden | 25 | 25 | 0 | **0,50** | 99 | **0** |
| schwer gegen **leicht** | im Krieg | 50 | 0 | 0 | **1,00** | 0 | 0 |

### Was diese Zahlen sagen — und es ist mehr als „unentschieden"

**1. Zwischen „schwer" und „normal" entscheidet die Startposition, nicht die Stufe.**
25:25 ist kein Zufall und kein Gleichstand: die Seiten werden jede zweite Partie
getauscht, und A gewinnt genau die 25 Partien, in denen A auf Platz eins startet. Anders
gesagt — **in allen 50 Partien gewinnt die erste Nation**, unabhängig davon, welche Stufe
sie spielt. Die beiden Stufen sind im Ergebnis nicht unterscheidbar.

**2. Gegen „leicht" entscheidet nicht das bessere Spiel, sondern der Rekrutierungsanteil.**
`recruitShare` ist 80 (leicht), 200 (normal), 330 (schwer). Der Abstand leicht → schwer ist
das Vierfache, der Abstand normal → schwer weniger als das Doppelte — genau dort verläuft
die Grenze zwischen 50:0 und 25:25. Die Siegquote 1,00 liegt zugleich **über** der
Obergrenze von 0,95, die T-M15-05 in den Turniertest einträgt: eine Stufe, die *jede*
Partie gewinnt, ist kein Schwierigkeitsgrad, sondern ein anderes Spiel.

**3. Kein einziger Krieg endet.** Über 150 Partien: **0 Friedensschlüsse.** Die KI erzeugt
`acceptPeace` zwar (seit T-M14-12 auch gezielt), aber `offerPeace` entsteht in dieser
Aufstellung nie — es gibt keine Bedingung, unter der eine KI einen laufenden Krieg
beenden würde. Das ist R-DIP-06/AK4, und es ist heute unbelegt.

**4. Im Frieden gestartet erklärt jede Seite den Krieg** (99 Erklärungen auf 50 Partien,
also rund zwei je Partie). Die Entscheidung hängt allein an `standing` — dem
Punkteverhältnis — und an `maxFronts`, das dreifach zweckentfremdet ist: Frontenzahl,
Kriegsschwelle (`maxFronts >= 3 ? 1200 : 1600`) und Risikobereitschaft in einem Wert.
`planningDepth` wird von **keiner Zeile** gelesen, `tacticalInterval` überlagert der
Rundenlauf.

### Woran Schritt 2 gemessen wird

- Siegquote „schwer gegen normal" **außerhalb** des in T-M14-05 gemessenen Rauschbands
  und **unter 0,95**; kein Lauf endet 25:25.
- Mindestens ein Friedensschluss, wo heute null stehen.
- Mindestens eine Kriegserklärung bei einem Punkteverhältnis zwischen 900 und 1100 —
  heute unmöglich, weil die Schwelle bei 1200 beziehungsweise 1600 liegt.

## Abnahme R-AI-06 — schwer schlägt leicht

Die Anforderung verlangt mindestens 70 % für die höhere Stufe. Gemessen: **100 %.**
Die Obergrenze von 95 % wird von T-M15-05 eingeführt, zusammen mit der Regel, die sie
einlösen kann — T-M14-05 hat sie bewusst nicht eingetragen, weil sie dort sofort rot
gewesen wäre und mit `pnpm test:slow` die ganze Abnahmekette blockiert hätte.
