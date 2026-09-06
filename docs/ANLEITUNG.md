# WorldWar — Anleitung

Ein Strategiespiel auf einer Weltkarte mit 237 Provinzen. Sie führen eine von 24 Mächten
gegen Computergegner. **Es gibt nichts zu kaufen, nichts abzuwarten und keinen
Netzzugriff** — das Spiel läuft vollständig auf Ihrem Rechner.

---

## Der Unterschied zum Original

Wer *Supremacy 1914* kennt, kennt die Regeln. Was fehlt, ist das Warten:

| Im Original | Hier |
|---|---|
| Ein Bauvorhaben dauert Stunden **Ihrer** Zeit | Sie stellen die Geschwindigkeit ein |
| Goldmark beschleunigt gegen Geld | Vorspulen tut dasselbe für alle, kostenlos |
| „High Command"-Abonnement gibt Vorteile | Gibt es nicht |
| Sie müssen zu bestimmten Zeiten online sein | Sie spielen, wann Sie wollen |

Die Zeit ist die eigentliche Neuerung. Sie können eine Partie in einer Stunde spielen
oder über Wochen — die Regeln sind dieselben.

---

## Die ersten fünf Minuten

1. **Partie beginnen.** Wählen Sie eine Macht. Für den Anfang eignet sich eine mit
   Landgrenzen und Küste — Deutschland, die Türkei oder Brasilien. Die Startzahl können
   Sie stehen lassen; dieselbe Zahl ergibt immer dieselbe Partie, was praktisch ist,
   wenn Sie etwas noch einmal ausprobieren wollen.

2. **Sehen Sie sich Ihre Provinzen an.** Klicken Sie eine an. Rechts stehen Moral,
   Bevölkerung und was im Boden liegt. **Moral ist die wichtigste Zahl im Spiel** —
   sie bestimmt, wie viel eine Provinz produziert, ob sie sich erhebt, und wie stark
   frisch ausgehobene Truppen sind. Unter 33 wird es gefährlich.

3. **Bauen Sie etwas.** Eine Kaserne, wenn Sie Truppen wollen; eine Fabrik für mehr
   Produktion. Jeder Knopf nennt im Tooltip die Kosten und die Dauer. Was Sie sich nicht
   leisten können, ist ausgegraut — mit dem Grund daneben. Ohne Maus: die Provinz oben
   in der Seitenleiste aus der Liste wählen.

4. **Lassen Sie die Zeit laufen.** Die Leertaste startet und stoppt. Die Zahlen in der
   Kopfleiste sind Spielstunden je Sekunde: bei 10 vergeht ein Spieltag in gut zwei
   Sekunden. Zum Überspringen längerer Strecken „Vorspulen" — das läuft, bis etwas
   passiert, das Sie sehen müssen.

5. **Achten Sie auf die Ereignisleiste.** Rot heißt: hinsehen. Ein Klick auf eine Zeile
   springt zu der Provinz, um die es geht.

---

## Die Geschwindigkeitsregelung

Das ist der Teil, für den es dieses Spiel gibt.

**Rastpunkte von Pause bis 100.** Die Zahl sind Spielstunden je Sekunde. Bei 1 läuft
das Spiel im Schritttempo, bei 100 vergeht ein Spieljahr in gut einer Minute.

**Vorspulen** läuft, bis eines von sechs Dingen eintritt: ein Bau ist fertig, eine
Armee ist angekommen, ein Gefecht beginnt, ein Tag wechselt, eine feste Zahl Stunden
ist um — oder etwas passiert, das Sie sehen müssen. Ein Angriff auf Ihr Gebiet, eine
verlorene Armee, eine Kriegserklärung halten das Vorspulen sofort an und sagen, warum.

**Oberhalb von 10 Spielstunden je Sekunde** verstummen Töne und Animationen, und
Meldungen werden zu Tagesbündeln zusammengefasst. Sonst wären es Dutzende je Sekunde.

**Ein fremder Krieg hält Sie nicht auf.** Das Vorspulen bricht nur ab, wenn ein Alarm
*Sie* betrifft — eine Eroberung zwischen zwei anderen Mächten läuft durch, dieselbe
Eroberung auf Ihre Kosten hält an. Auf einer Weltkarte mit acht Mächten wäre es sonst
nach drei Spieltagen jedes Mal vorbei.

**Es rechnet in Häppchen**, und Sie können jederzeit abbrechen: Der Knopf wechselt
während des Laufs zu **Abbrechen**, und die Zahl daneben zeigt, wie weit es gekommen
ist. Am Ende steht der Grund in Worten — Ziel erreicht, angehalten, oder Obergrenze
(30 Spieltage; ein Ziel, das nie eintritt, soll nicht ewig laufen).

---

## Was das Spiel entscheidet

Aus dem gemessenen Parameterlauf (`docs/reports/balance-sweep.md`): Keine einzelne
Stellschraube kippt den Partieausgang für sich allein — aber **was ihn bewegt, sind die
Moralzahlen** (Zielmoral, Startmoral, wie stark schlechte Moral die Produktion drückt).
Wie hart zwei Armeen zuschlagen, ändert am Ende fast nichts.

Praktisch heißt das:

- **Halten Sie die Moral oben.** Nahrungsüberschuss hilft, eigene Nachbarprovinzen
  helfen, Besatzung schadet, feindliche Nachbarn schaden.
- **Dehnen Sie sich nicht zu schnell aus.** Jede Provinz über einer Freigrenze drückt
  die Moral im ganzen Reich. Zwei gut gehaltene Provinzen sind mehr wert als fünf
  aufständische.
- **Rekrutieren Sie in Provinzen mit hoher Moral.** Frische Truppen kommen mit einer
  Stärke, die von der Provinzmoral abhängt — bei Moral 70 bekommen Sie für fünf
  bestellte Infanteristen die Kampfkraft von vier.

---

## Befehle geben

Alles, was das Spiel kann, steht als Knopf in der Seitenleiste — auch das, was gerade
nicht geht, ausgegraut und mit dem Grund darunter. Kein Befehl ist versteckt.

**Provinz** (Klick auf die Karte oder Auswahl aus der Liste): unter **Bauen** jedes
Gebäude mit Kosten und Dauer im Tooltip, unter **Ausheben** jede Einheit — mit der
Dauer und der Anfangsstärke, die von der Provinzmoral abhängt. Dazu die Hauptstadt
verlegen (nur in eine Großstadt, mit Sperrfrist). Stehen eigene Armeen in der Provinz,
sind sie hier aufgeführt; **Auswählen** öffnet die Armee.

**Armee:** **Marschieren** wartet auf ein Ziel — ein Klick auf die Karte oder die
Zielliste im Panel. Bevor Sie bestätigen, steht dort, **wann die Armee ankommt**;
die Zeit stammt aus derselben Rechnung, die die Simulation später ausführt. Außerdem:
Anhalten, Haltung (Angriff/Verteidigung), Teilen (halbiert jede Einheitenart),
Zusammenlegen (alle eigenen Armeen am Ort) und Beschießen (nur mit Artillerie oder
Bombern, nur im Krieg). Escape bricht die Zielwahl ab.

**Rückzug** (Knopf am Armeepanel, nur im Gefecht): Die Armee löst sich aus dem Kampf
und weicht in eine benachbarte eigene Provinz aus. Der Preis steht am Knopf — sie
verliert beim Absetzen Stärke und darf für eine Anzahl Tage **nicht angreifen**; getroffen
werden kann sie in dieser Zeit sehr wohl. Ein Rückzug ist deshalb eine Entscheidung, keine
Rücknahme: er rettet Einheiten und kostet die Gelegenheit.

**Bauabbruch** (Knopf am laufenden Bauvorhaben in der Provinz): bricht den Auftrag ab und
gibt die Baustelle frei. **Es gibt nichts zurück** — die Rohstoffe sind mit dem Auftrag
abgeflossen, nicht mit seiner Fertigstellung. Sinnvoll ist der Abbruch, wenn die
Bauplätze knapp sind oder die Provinz zu fallen droht (fällt sie, bricht der Auftrag
ohnehin ab).

**Der Kampfbericht** steht im Ereignisprotokoll: nach jedem Gefecht, wer das Feld behalten
hat *und* was es beide Seiten gekostet hat — Verluste getrennt nach Angreifer und
Verteidiger. Filtern Sie das Protokoll auf **Kämpfe**, wenn Sie eine Schlachtreihe
nachlesen wollen.

**Diplomatie** (D oder Knopf in der Kopfleiste): Verhältnis zu jeder Macht; eine Macht
auswählen, dann Krieg erklären (wirkt nach Vorlaufzeit — das Protokoll nennt den Tag),
Frieden anbieten oder annehmen, Bündnis, Durchmarsch, Kartenaustausch.

**Markt** (H): Rohstoff abgeben, Menge, Rohstoff erhalten — der Gegenwert steht da,
bevor Sie handeln. Der Kurs gilt für alle Mächte gleich und für den ganzen Tick.

---

## Die Wirtschaftsübersicht

Rechts unten steht für jeden Rohstoff, was Sie haben, was hereinkommt, was hinausgeht
und was unter dem Strich bleibt — alles je Spieltag.

Die Kopfleiste zeigt nur die letzte dieser vier Zahlen, weil vier Zahlen je Rohstoff in
einer Leiste niemand liest. Für die Frage „warum wird das Eisen knapp" reicht die
Bilanz aber nicht: sie sagt nicht, ob eine Mine verloren ging oder eine neue Armee
frisst. Dafür ist die Übersicht da.

**Die Vorschau stimmt.** Die angezeigte Produktion ist nicht die des letzten Ticks,
sondern die, die der kommende Tag tatsächlich liefert — gerechnet mit derselben Formel,
die die Simulation benutzt. Nur die Moral wandert im Lauf des Tages, deshalb kann die
gelieferte Menge um ein paar Prozent abweichen.

---

## Tastatur

Alles ist ohne Maus erreichbar.

| Taste | Wirkung |
|---|---|
| Leertaste | Pause an/aus |
| + / − | eine Geschwindigkeitsstufe hoch/runter |
| F | Vorspulen |
| M | Kartenmodus wechseln |
| Pfeiltasten | Karte verschieben |
| D | Diplomatie |
| H | Markt (Handel) |
| Strg+S / Strg+L | Speichern / Laden |
| Escape | Dialog, Panel oder Zielwahl schließen |
| F1 | diese Übersicht im Spiel |

---

## Die vier Kartenmodi

| Modus | Zeigt |
|---|---|
| **Besitz** | wem was gehört |
| **Rohstoffe** | wo etwas im Boden liegt |
| **Moral** | wo es ruhig ist und wo es brennt |
| **Truppenstärke** | wo Truppen stehen — so weit Sie sehen können |

Zu jedem Modus steht unten rechts auf der Karte eine Legende; das Fragezeichen daneben
sagt in einem Satz, was die Farben bedeuten. Grau heißt in jedem Modus dasselbe:
**nicht aufgeklärt**. Was Sie nicht sehen, färbt das
Spiel nicht ein — eine ungesehene Provinz ist keine Provinz mit Moral null.

---

## Speichern

Fünf Stände von Hand plus eine automatische Reihe. Automatisch wird gespeichert, wenn
genug Spielzeit **und** genug echte Zeit vergangen ist — sonst wären bei hoher
Geschwindigkeit alle Stände von derselben Sekunde.

Ein beschädigter Stand wird abgelehnt und sagt das auch. Das Spiel fängt nicht
stillschweigend von vorn an.

---

## Was die KI darf

Nichts, was Sie nicht dürfen. Sie sieht dieselbe Karte wie Sie — den Nebel des Krieges
eingeschlossen — und spielt auf jeder Schwierigkeitsstufe **ohne Bonus**: keine zusätzlichen Rohstoffe,
keine geschenkten Truppen, kein Blick auf Ihre Karte. Der
Unterschied zwischen „leicht" und „schwer" ist, wie weit sie vorausplant und an wie
vielen Fronten sie gleichzeitig kämpft. Der Startdialog weist das aus.

---

## Was die Oberfläche von selbst sagt

Vieles, wofür man sonst rechnen müsste, steht als Anzeige da:

| Wo | Was |
|---|---|
| Kopfleiste | je Rohstoff Bestand, Tagesbilanz — und, sobald ein Vorrat schrumpft, wie viele Tage er noch reicht. Unter drei Tagen wird die Zeile zur Warnung. |
| Kopfleiste | der Balken **Siegziel**: Ihr Anteil an allen Punkten gegen den Anteil, den der Sieg verlangt |
| Provinzpanel | **Moral** als Balken mit Pfeil — der Pfeil zeigt, wohin sie läuft, nicht nur wo sie steht |
| Provinzpanel | jedes laufende Bauvorhaben und jede Aushebung als Balken mit Restzeit |
| Armeepanel | der Marsch als Balken mit der Ankunftszeit |
| Seitenleiste | **Meldungen**: Kampf im eigenen Land, verlorene Hauptstadt, Rohstoffmangel, Aufstandsgefahr. Ein Klick führt die Karte hin. |

## Die Lage der Mächte (Taste `L`)

Alle Mächte, von denen Sie wissen, mit Punktebalken, Verhältnis und der Truppenstärke,
**die Sie sehen können**. Was hinter dem Nebel steht, steht nicht in der Tabelle — die
Übersicht weiß nicht mehr als Sie.

Ist die Partie entschieden, sagt das Spiel es einmal, hält die Uhr an und lässt Sie das
Fenster schließen, wenn Sie sich die Karte noch ansehen wollen.

## Wenn Sie etwas nicht kennen

Hinter jedem Gebäude, jeder Einheit, jedem Rohstoff, jeder Geländeart, jedem Kartenmodus
und jedem diplomatischen Zustand steht ein kleines **?**. Ein Druck darauf — mit Maus oder
Tastatur — sagt in ein bis zwei Sätzen, wofür das Ding gut ist. Kosten und Dauer stehen
ohnehin im Tooltip des Knopfes.

## Das Ereignisprotokoll filtern

Unten links über dem Protokoll stehen vier Schalter: **alles**, **Kämpfe**, **Aufbau**,
**Verträge**. Bei hoher Geschwindigkeit ist das der Unterschied zwischen „irgendwo stand
gerade etwas Wichtiges" und „hier ist es".
