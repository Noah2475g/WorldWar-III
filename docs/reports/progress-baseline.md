# Die Fortschrittsachse — Ausgangswert und Nachmessung (M34)

Erzeugt aus `apps/headless/test/progress.slow.test.ts` (`docs/reports/progress-measured.json`),
dem Parameterlauf (`pnpm balance:sweep`) und dem Turnier. Gemessen am **2026-09-12** auf
freier Maschine (Gesamtlast 4 % vor dem ersten Lauf).

> **Wozu dieser Bericht.** `FORTSCHRITT.md` Abschnitt 0, Punkt 1: **erst messen, dann
> strecken.** Ohne den Ausgangswert ist jedes spätere „es ist besser geworden" unbelegt —
> und dieses Projekt hat zweimal dafür bezahlt, dass eine Messung fehlte oder unter
> Fremdlast entstand (Lessons Log, 2026-09-06 und 2026-09-07).

## 1 · Der Befund, den M34 behebt

| Kennzahl | vorher | nachher |
|---|---|---|
| Letzte Freischaltung (Raketenartillerie) | Spieltag **16** | Spieltag **80** |
| Das in Echtzeit bei Tempo 1 | **6,4 Minuten** | **32,0 Minuten** |
| Bei Tempo 10 | **38 Sekunden** | **3,2 Minuten** |
| Partie bis zur Entscheidung (Abnahmelauf AK-1) | Spieltag **798** | Spieltag **471** |
| Anteil der Partie mit Freischaltungen | **2,0 %** | **17,0 %** |

Die Uhr läuft mit einem Tick je Sekunde bei Tempo 1 (`App.tsx`, die Schleife mit `owed`),
ein Spieltag hat 24 Ticks. Daraus folgt die zweite Zeile, und aus ihr der ganze
Meilenstein: **die Fortschrittsachse war nach sechs Minuten Echtzeit vorbei**, während
die Partie über achthundert Spieltage lief.

## 2 · Wie gemessen wird, und was das nicht misst

Drei Werkzeuge, und sie beantworten verschiedene Fragen:

- **Der Grundlauf** (`progress.slow.test.ts`): sechs europäische Nachbarn, 120 Spieltage,
  zwölf Startzahlen, Weltkarte, echte Regeln — dieselben Nationen, Tage und Startzahlen
  wie der Grundlauf des Parameterlaufs, damit die Zahlen vergleichbar sind. Er liefert
  Anteil des Stärksten, Eroberungen, Überlebende und Endbestände.
- **Das Turnier** (`tournament.slow.test.ts`): 150 Partien über drei Paarungen. Es
  beantwortet die Frage aus Risiko 2 — ob die KI die gestreckte Frühphase nutzt oder nur
  wartet.
- **Der Parameterlauf** (`pnpm balance:sweep`): vierzehn Konstanten je zweimal über zwölf
  Startzahlen, über 350 Partien, **rund eine Stunde**. Er beantwortet eine andere Frage:
  welche Konstante den Ausgang kippt.

**Eine Abweichung von der Aufgabenbeschreibung, offen genannt.** T-M34-07 verlangt
Parameterlauf *und* Turnier **nach jeder** der vier Zahlenaufgaben — vier Nachtläufe.
Gefahren ist der volle Parameterlauf **genau einmal**, am Endstand; Grundlauf und Turnier
dagegen **an allen fünf Messpunkten**. Zwei Gründe, beide nachprüfbar:

1. **Als Ausgangswert war er schon gefahren.** `data/rules` hat sich seit dem
   2026-09-07 21:04 (`65a4fd8`) nicht geändert, der eingecheckte `balance-sweep.md` ist
   vom 23:01 desselben Tages — er ist jünger als die Regeln, die er vermisst, und genau
   das prüft auch der Frische-Wächter der Abnahme. Ein zweiter Lauf hätte dieselben Zahlen
   reproduziert; die Läufe sind deterministisch über feste Startzahlen. **Vorgeführt statt
   behauptet:** das Turnier vom 2026-09-12 ist zeilengleich mit dem vom 2026-09-07, und
   der Grundlauf trifft die vier Kennzahlen des Berichts auf die vierte Stelle (0,4177
   gegen 41,8 %, 246,6 gegen 247, 4,00 gegen 4,0, 52.320 gegen 52.320).
2. **Für die Zwischenpunkte beantwortet er die falsche Frage.** Sein teurer Teil misst die
   *Empfindlichkeit einzelner Konstanten* — die vergleicht T-M34-07 gar nicht. Verglichen
   werden Siegtag, Eroberungen, Anteil des Stärksten und Siegverteilung, und die stehen
   alle im **Grundlauf**, den der Parameterlauf selbst als Ausgangswert fährt. Vier
   weitere volle Läufe hätten vier Stunden gekostet und zur Frage „welche der vier
   Änderungen war es" keine Zeile mehr geliefert als die Reihe unten.

**Was der Grundlauf nicht misst:** eine ganze Partie. 120 Spieltage entscheiden nichts —
der Siegtag steht im Abnahmelauf (AK-1) und in Abschnitt 4.

**Zu `progress-measured.json`:** die Datei beschreibt immer **den Regelstand, gegen den
zuletzt gemessen wurde** — jeder Lauf überschreibt sie. Im Repository liegt deshalb der
Endstand. Die fünf Messpunkte in Abschnitt 3 sind fünf solcher Momentaufnahmen, von Hand
nebeneinandergestellt; wer eine davon nachfahren will, setzt die Regeln auf den
entsprechenden Stand und startet den Lauf erneut.

## 3 · Die fünf Messpunkte

Jede der vier Zahlenaufgaben einzeln, in Baureihenfolge. Der Kern ist dabei unverändert:
„vor T-M34-04" ist über die beiden Konstanten auf 1000 Permille gesetzt, und 1,0 hoch n
ist **exakt** der alte Zustand — sonst müsste für jede Messung der Code gewechselt werden,
und dann misst man den Wechsel mit.

| Messpunkt | letzte Freischaltung | Anteil des Stärksten | Eroberungen | Überlebende | Endbestände | Fabrik: Mächte mit Stufe ≥ 1 | Turnier schwer:normal |
|---|---|---|---|---|---|---|---|
| **Ausgangswert** | Tag 16 | 0,418 | 246,6 | 4,00 | 52.320 | 2 von 6 | 78 % |
| nach **T-M34-03** (Leiter gestreckt) | Tag 80 | **0,543** | 266,5 | 4,58 | 53.709 | 4 von 6 | **54 %** ✗ |
| nach **T-M34-04** (Stufen kosten mehr) | Tag 80 | 0,501 | 264,4 | 4,17 | 50.047 | 3 von 6 | 54 % ✗ |
| nach **T-M34-05** (Stufenbedingung) | Tag 80 | 0,501 | 264,4 | 4,17 | 50.047 | 3 von 6 | 54 % ✗ |
| nach **T-M34-06** (Startvorrat) = **Endstand** | Tag 80 | 0,444 | **302,3** | **5,17** | 50.613 | 1 von 6 | **100 %** ✗ |

**Die Rauschgrenze ist 0,063** (`balance-sweep.md`: Streuung des Führungsanteils allein
durch die Startzahl, ohne jede Regeländerung). Wer die Spalte „Anteil des Stärksten" liest,
liest sie gegen diese Grenze:

- **Die Streckung allein hätte die Macht konzentriert:** +0,125 vom Ausgangswert, das
  Doppelte der Rauschgrenze. Mit weniger Gerät im Feld gewinnt der Größte leichter.
- **Die teureren Stufen nehmen davon 0,042 zurück**, der Startvorrat weitere 0,057 —
  beide für sich **unterhalb** der Rauschgrenze und damit einzeln nicht belegbar.
- **Zusammen heben sie die Streckung auf:** 0,418 gegen 0,444 am Ende, ein Unterschied
  von 0,026 und damit **innerhalb des Rauschens.** Die Konzentration der Macht steht am
  Ende dort, wo sie vorher stand — und das ist das Ergebnis, nicht das Ausbleiben eines
  Ergebnisses.
- **Was sich dabei sehr wohl bewegt hat:** 302 statt 247 Eroberungen (+22 %) und 5,2 statt
  4,0 überlebende Mächte. Es wird **mehr gekämpft und weniger endgültig verloren**.

**T-M34-05 hat in der Simulation exakt nichts geändert** — Zeile 3 und 4 sind
zeichengleich. Das ist kein Fehler der Messung: die KI baut auf dieser Karte weder eine
Werft noch eine zweite Fabrikstufe, also greift eine Bedingung an Werft 2 und Fabrik 3 bei
ihr nie. Die Aufgabe ändert, was **der Spieler** darf, und das misst kein Turnier.

## 4 · Die ganze Partie

Der Abnahmelauf AK-1 (`pnpm sim:fullgame`): acht Mächte auf der Weltkarte, sieben davon
KI auf „normal", Punktsieg bei 700 ‰, Abbruch nach 1500 Spieltagen.

| | vorher | nachher |
|---|---|---|
| Entschieden an Spieltag | 798 | **471** |
| Eroberungen | 2717 | 1827 |
| Kriegserklärungen | 15 | 12 |
| Schlachten | — | 4040 |

**Das Tor aus der Aufgabenbeschreibung ist eingehalten:** T-M34-07 verlangt einen Siegtag
zwischen 300 und 1500, sonst wird nachjustiert. 471 liegt gut in der Mitte.

**Die Partie ist kürzer geworden, nicht länger — und das war nicht vorhergesagt.** Der
Bauplan hat die Streckung damit begründet, dass die Fortschrittsachse zu früh endet; dass
dabei auch die *Partie* kürzer wird, stand in keiner seiner Vorhersagen. Eine Erklärung
liegt nahe und passt zu Abschnitt 3 (302 statt 247 Eroberungen bei 5,2 statt 4,0
Überlebenden): weniger Startvorrat heißt kleinere Armeen, kleinere Armeen heißen
entschiedenere Gefechte, und der Punktvorsprung des Stärksten wächst schneller über die
Schwelle. **Sie ist nicht gemessen** — wer sie braucht, misst sie.

**Für die Fortschrittsachse ist das die bessere Nachricht:** achtzig Freischaltungstage
von 471 sind **17 %** der Partie. Gegen 2 % vorher ist das eine Verachtfachung des
Anteils, obwohl die Leiter nur fünfmal so lang wurde.

## 5 · Risiko 5: bleibt die dritte Fabrikstufe erreichbar?

**Die Antwort ist nein — und sie war schon vor M34 nein.** Gemessen über 200 Spieltage,
sechs Mächte, Weltkarte, jeden Tag nachgesehen: **keine Macht erreicht in irgendeinem der
fünf Messpunkte die dritte Fabrikstufe.** Die höchste erreichte Stufe ist überall **1**.

| Messpunkt | Mächte mit einer Fabrik (von 6) | höchste Stufe |
|---|---|---|
| Ausgangswert | 2 | 1 |
| nach T-M34-03 | 4 | 1 |
| nach T-M34-04 | 3 | 1 |
| nach T-M34-05 | 3 | 1 |
| **Endstand** | **1** | 1 |

**Was das über Risiko 5 sagt.** Die Sorge war, teurere Stufen könnten die dritte
unerreichbar machen. Sie war unerreichbar, bevor eine Stufe etwas kostete — der Grund ist
nicht der Preis, sondern **die KI baut keine zweite Stufe.** `packages/ai/src/economy.ts`,
`nextBuildingFor`: das einzige Gebäude, das sie über Stufe 1 hinaus ausbaut, ist die
Festung (`level('fortress') < 2`); für Kaserne, Fabrik, Eisenbahn und Hafen fragt sie
`=== 0`. Die zweite Fortschrittsachse aus T-M34-04 ist damit heute **eine Achse für den
Menschen allein.**

**Das ist ein Befund und keine Panne, aber es ist auch kein Zustand zum Stehenlassen:**
R-AI-01 sagt „die KI kann alles, was der Spieler kann", und *können* tut sie es — sie tut
es nur nicht. Der Eintrag dazu steht in `PROBLEME.md`; die Reparatur ist klein (eine
Zeile je Gebäude in `nextBuildingFor`) und gehört nicht in diesen Meilenstein, weil sie
das KI-Verhalten ändert und damit eine eigene Messung braucht.

**Was dagegen sehr wohl M34 zuzuschreiben ist:** von sechs Mächten baut am Ende nur noch
**eine** überhaupt eine Fabrik, gegen zwei am Anfang und vier nach der Streckung allein.
Die Fabrik liegt jetzt auf Spieltag 28 statt 8, und der Startvorrat trägt sie nicht mehr
mit. Für den Spieler ist das die beabsichtigte Knappheit; für die Artilleriekette
(R-BAT-08) ist es eine Verdünnung, die im Auge behalten gehört.

## 6 · Was daraus folgt

**1. Der Meilenstein tut, was er sollte.** Die Fortschrittsachse trägt statt zwei jetzt
siebzehn Prozent der Partie, die Leiter reicht von sechs Minuten Echtzeit auf zweiunddreißig,
und die Konzentration der Macht steht am Ende, wo sie am Anfang stand — bei mehr Kämpfen
und mehr überlebenden Mächten.

**2. Zwei Wächter sind dabei gefallen, und beide zu Recht.**

**Der Turnierlauf (R-AI-06).** Nach der Streckung stand zwischen `normal` und `schwer` eine
**Mauer**: Siegquote 1,00 bei null Unentschieden. Die Obergrenze 0,95 gibt es genau dafür —
„wer auf normal verliert, wechselt zu schwer und nicht zu leicht". Zwei Verdächtige wurden
ausgespielt, bevor einer angefasst wurde:

| Messung | Ergebnis |
|---|---|
| Fensterlänge 40 / 80 / 120 / 200 Spieltage | **1,00 bei allen vieren** — das Fenster ist es nicht |
| Startvorrat 667 / 750 / 833 / 1000 ‰ | **1,00 bei allen vieren** — der Startvorrat ist es auch nicht |
| `recruitShare` von `schwer` über **200** Tage: 360 / 320 / 280 / 240 / 200 | 1,00 / 0,80 / 0,72 / 0,50 / 0,52 |
| dieselbe Schraube über **40** Tage: 360 / 300 / 260 / 220 / 200 | 1,00 / 0,94 / 0,68 / 0,52 / 0,52 |

Das Band 0,55 bis 0,95 wird im Bereich **260 bis 320** eingehalten, und zwar über **beide**
Fenster; **280** liegt in dessen Mitte und ist deshalb gesetzt worden — nicht der erste
Wert, der eine Zahl grün macht, sondern die Mitte eines Bereichs, der hält. Der Lauf
danach: **0,70**. **Keine Schwelle wurde angefasst.**

Was dabei *nicht* repariert ist und offen im Bericht steht: in der Paarung **im Krieg**
bleibt es bei 1,00. Kein gemessener `recruitShare` hält beide Paarungen gleichzeitig im
Band. Der Test sichert die Friedens-Paarung zu, weil dort die Wirtschaft überhaupt Zeit
hat, sich auszuwirken; die Kriegs-Paarung steht im Bericht als Zahl und nicht als
Zusicherung. Wer die Stufen wirklich trennen will, trennt sie an mehr als am
Rekrutierungsanteil — das ist eine eigene Aufgabe und gehört Noah.

**Der Onboarding-Durchgang.** Die längste Pause ohne Anlass wächst von **72 auf 96 Ticks**
(vier stille Spieltage zwischen Hafen an Tag 6 und Transportschiff an Tag 10). Das ist die
Rückseite derselben Entscheidung: wer die Leiter streckt, streckt ihre Lücken mit. Die
Sperrklinke ist einmal weitergestellt worden, **mit genannter Ursache**; sie verbietet
weiterhin, dass die Pause ohne solchen Grund wächst. Was sie nicht sehen kann: die Zeile
aus T-M34-08 über der Aushebeliste, die sagt, was als Nächstes kommt und in wie vielen
Tagen — sie zählt Ereignisse, und eine stehende Zeile ist keines. Ob vier stille Spieltage
zu lang sind, beantwortet Noahs Playtest.

**3. Zwei Befunde nebenbei, beide in `PROBLEME.md`.** Die KI baut kein Gebäude über Stufe 1
hinaus außer der Festung — die zweite Fortschrittsachse aus T-M34-04 ist heute eine Achse
für den Menschen allein. Und `BALANCING.md` führte für `recruitShare` seit sechs Tagen
andere Zahlen als `ai.json`; der Wächter las nur `constants.json`. Er liest jetzt auch
`ai.json`, und die Tabelle stimmt wieder.

**4. Was diese Messung nicht ist.** Ein Playtest. Sie sagt, dass die Zahlen sich richtig
bewegt haben; ob die ersten achtzig Spieltage sich *gut anfühlen*, sagt sie nicht. Das ist
die eine Frage, die kein Agent beantworten kann.
