# ROHSTOFFE — Bauplan M36

> **Stand:** 2026-09-11 · **Entwurf:** `docs/design/rohstoffleiste.html` · **Noahs Wahl:**
> die Vorschläge 1, 2, 3, 4 und 6. **Vorschlag 5** (Gruppierung in vier Blöcke) liegt als
> Anordnung 2 im Entwurfsblatt und wird dort entschieden — T-M36-04 wartet darauf.
> **Vorschlag 7** (Wirtschaftstabelle nur auf Abruf) ist zurückgestellt, mit Grund in
> Abschnitt 5.
>
> **Status:** freigegeben bis auf T-M36-04. Zwillinge in `tasks.yaml` und `03-TASKS.md`
> angelegt.

---

## 0 · Für den Agenten, der das baut (lies nur das hier)

1. Die sieben neuen Zeichen ersetzen **Einträge in `ICON_PATHS`** — sie sind
   Strichzeichnungen im 24er-Kasten wie der ganze Satz, nicht Schattenrisse wie M33. Der
   Bildsatz aus `art.tsx` bleibt unberührt; Rohstoffe haben keine Bilder, sie haben Zeichen.
2. **T-M36-01 hängt an T-M33-01.** Dort entsteht die Pfadabfahrt, die den heutigen,
   leer grünen Koordinatentest ersetzt. Neue Pfade ohne diesen Wächter einzuchecken hieße,
   sie ungeprüft einzuchecken.
3. **Die Wirtschaftstabelle verliert keine Spalte.** Siehe Abschnitt 3 — das war mein
   erster Vorschlag und er war falsch.
4. Je Aufgabe ein Commit und eine Zeile in `PROGRESS.md`. `pnpm verify` am Ende des
   Meilensteins.

---

## 1 · Die Sichtprüfung, auf der das hier steht (2026-09-11)

Aufgenommen am laufenden Spiel, Weltkarte, Vereinigte Staaten, erster Spieltag.

- **Dieselbe Auskunft steht zweimal gleichzeitig auf dem Bildschirm.** Oben die Leiste mit
  sieben Rohstoffen, je Bestand und Tagesbilanz: einundzwanzig Angaben. Rechts die
  Wirtschaftstabelle mit denselben sieben, je Bestand, Produktion, Unterhalt, Bilanz und
  einem Balken: fünfunddreißig Zellen.
- **In der Leiste ist der Name unsichtbar.** `Header.tsx` setzt ihn als
  `visually-hidden` — richtig fürs Vorlesen, aber es heißt: wer sieht, bekommt
  ausschließlich die Glyphe. Sie trägt damit die ganze Last.
- **Vier von sieben Glyphen tragen sie nicht.** Nahrung ist ein Stiel mit zwei Blättern und
  liest bei vierzehn Pixeln als „Y". Eisen und Kohle sind zwei ähnlich große dunkle
  Klumpen. Und **Material wird durch einen Nadelbaum dargestellt** — der Rohstoff hieß
  einmal Holz, `de.ts` nennt ihn seit T-M23-01 „Material", das Zeichen ist beim Baum
  geblieben. Gut sind nur Öl (Tropfen) und Seltene Erden (Kristall).
- **Die Zahl, nach der man handelt, steht im Tooltip.** Sichtbar ist die Tagesbilanz
  („+155"); die Reichweite („reicht sechs Tage") ist nur beim Überfahren zu sehen, obwohl
  `reachInDays` sie längst ausrechnet.
- **Alles ist gleich laut.** Der Rohstoff, der in sechs Tagen leer ist, sieht aus wie der,
  der seit Tagen überläuft. Die Klasse `resource--short` existiert und färbt nur die Zahl.

---

## 2 · Entwurf D36 „Ampel"

### D36.1 Die sieben Zeichen (Vorschlag 1)

Zwei Fassungen liegen im Entwurfsblatt, Abschnitt 1, jeweils in Originalgröße **neben** der
Großaufnahme. Die Regel dabei ist die Lehre aus dem heutigen Satz: **entschieden wird bei
vierzehn Pixeln.** Die Leitlinie der Fassung 1:

| Rohstoff | heute | neu | warum |
|---|---|---|---|
| Nahrung | Stiel mit zwei Blättern | Ähre | schmale, hohe Silhouette — einmalig im Satz |
| Material | Nadelbaum | Balkenstapel | der Rohstoff heißt nicht mehr Holz |
| Eisen | Klumpen | Barren, flach und breit | flach gegen den Haufen der Kohle |
| Kohle | Klumpen | Haufen, rund und hoch | hoch gegen den flachen Barren |
| Öl | Tropfen | Fass | der Tropfen war gut, das Fass ist eindeutig |
| Seltene Erden | Kristall | Kristall mit Mittelkante | war schon richtig |
| Geld | Scheibe mit Balken | Münzstapel | eine Scheibe sah aus wie ein Knopf |

Eisen und Kohle sind der eigentliche Punkt: sie werden nicht durch Binnenzeichnung
unterschieden, sondern durch den **Umriss** — flach gegen hoch. Binnenzeichnung verschwindet
bei vierzehn Pixeln, der Umriss nicht.

### D36.2 Die Leiste zeigt, was drängt (Vorschläge 2, 3, 4)

Je Rohstoff: Zeichen, Bestand, **ein Pfeil** für die Richtung. Die Bilanzzahl wandert in den
Tooltip, zusammen mit Produktion und Verbrauch, die schon dort stehen.

- **läuft** — ruhiges Grau, Bestand in halber Stärke, Pfeil nach oben.
- **steht** — dasselbe, Strich statt Pfeil.
- **drängt** — Bernstein, Bestand in voller Stärke, Pfeil nach unten, und **die Reichweite
  in Tagen als sichtbare Zahl** („6 T"). Das ist die Auskunft, nach der man handelt.

Aus einundzwanzig gleich lauten Angaben werden sieben Bestände, sieben Pfeile und — an
einem ruhigen Tag — keine einzige Farbe. Die Schwelle für „drängt" ist die vorhandene
`SHORT_REACH_DAYS`, nicht eine neue Zahl.

### D36.3 Die Gruppierung (Vorschlag 5, zu entscheiden)

Vier Blöcke: Versorgung (Nahrung) · Baustoffe (Material, Eisen, Kohle) · Kriegsstoffe (Öl,
Seltene Erden) · Geld. Anordnung 2 im Entwurfsblatt. **Der Preis:** zwei Strichstärken
nebeneinander, die Leiste wird unruhiger statt ruhiger. Deshalb steht sie zur Entscheidung
am Bild und nicht im Beschluss.

---

## 3 · Die Korrektur an meinem eigenen Vorschlag

Vorschlag 6 lautete: „die Wirtschaftstabelle verliert eine Spalte". **Das geht nicht.**
R-ECON-06 verlangt wörtlich, dass „Bestand, Produktion/Tag, Verbrauch/Tag **und** Bilanz je
Ressource sichtbar" sind — eine V1-Zusage, belegt durch einen Test. Eine Spalte zu streichen
hieße, eine Anforderung zu brechen, um eine Tabelle hübscher zu machen.

**Stattdessen wird die Tabelle ruhiger, nicht kürzer:** alle vier Größen bleiben, aber nur
Bestand und Bilanz tragen Gewicht, die sieben „±0" der Unterhaltsspalte werden zu Strichen
in Linienfarbe, und die Farbe gehört allein der Bilanz. Das nimmt der Tabelle das
Gedrängte, ohne ihr etwas zu nehmen.

Die ehrliche Anmerkung dazu: das ist weniger Ersparnis als der ursprüngliche Vorschlag. Es
ist die Ersparnis, die zulässig ist.

---

## 4 · Selbstkritik und Risiken

1. **Ich habe eine Anforderung erst nach dem Vorschlag gelesen.** Vorschlag 6 stand in der
   Besprechung, bevor ich R-ECON-06 nachgeschlagen hatte. Die Korrektur steht in
   Abschnitt 3 und im Entwurfsblatt, nicht in einer stillen Planänderung. Die Lehre:
   ein Vorschlag, der eine Spalte entfernt, gehört gegen die Anforderung geprüft, die sie
   verlangt hat — vor der Besprechung, nicht danach.
2. **Die Pfeile könnten weniger sagen als die Zahlen.** Wer wissen will, *wie stark* etwas
   wächst, findet es nur noch im Tooltip. Die Gegenrechnung: diese Zahl trägt an einem
   normalen Tag keine Entscheidung, und die Tabelle rechts nennt sie weiterhin sichtbar.
   Prüfstein ist der nächste Playtest, nicht dieser Absatz.
3. **„Ruhiges Grau" darf nicht unter die Kontrastschwelle fallen.** Die gedämpfte Fassung
   des Bestands muss die 4,5:1 gegen `paperSunk` halten. Entscheidet der Kontrasttest, nicht
   der Entwurf — wie schon bei `line` in D27.1.
4. **Die Zeichen wandern weiter als die Leiste.** `RESOURCE_ICONS` erscheint auch in den
   Vorkommen einer Provinz, in den Baukosten und im Tagesbericht. Wer sie ändert, ändert sie
   überall — gewollt, aber die Sichtprüfung in T-M36-06 muss alle vier Orte anschauen und
   nicht nur die Leiste.
5. **Was hier nicht gebaut wird.** Keine neue Ressource, keine Lagergrenzen-Anzeige, keine
   Marktkopplung in der Leiste. Und Vorschlag 7 nicht.

---

## 5 · Verworfen und zurückgestellt, mit Grund

- **Vorschlag 7 — die Wirtschaftstabelle nur auf Abruf.** Zurückgestellt, bis die Leiste
  sich bewährt hat. Etwas wegzunehmen, bevor der Ersatz trägt, ist die falsche Reihenfolge.
  Die Doppelung ist erträglich, solange die Leiste die kurze und die Tabelle die lange
  Auskunft ist — genau das stellt D36.2 her.
- **Den Namen in der Leiste sichtbar machen** statt die Zeichen zu reparieren. Wäre die
  bequeme Lösung und macht die Leiste doppelt so breit; sieben Wörter neben sieben Zahlen
  sind kein Gewinn gegenüber einundzwanzig Zahlen. Die Zeichen zu reparieren ist die Arbeit,
  die wirklich ansteht.
