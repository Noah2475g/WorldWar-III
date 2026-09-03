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

3. **Bauen Sie etwas.** Eine Kaserne, wenn Sie Truppen wollen; eine Werkstatt für
   Material. Jeder Knopf nennt im Tooltip die Kosten und die Dauer. Was Sie sich nicht
   leisten können, ist ausgegraut — mit dem Grund daneben.

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

---

## Was das Spiel entscheidet

Aus dem gemessenen Parameterlauf (`docs/reports/balance-sweep.md`): Von den geprüften
Stellschrauben kippen nur vier den Partieausgang, und **alle vier haben mit Moral und
Ausdehnung zu tun**. Wie hart zwei Armeen zuschlagen, ändert am Ende fast nichts.

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
| Strg+S / Strg+L | Speichern / Laden |
| Escape | Dialog oder Panel schließen |
| F1 | diese Übersicht im Spiel |

---

## Die vier Kartenmodi

| Modus | Zeigt |
|---|---|
| **Besitz** | wem was gehört |
| **Rohstoffe** | wo etwas im Boden liegt |
| **Moral** | wo es ruhig ist und wo es brennt |
| **Bedrohung** | wo ein Angriff zu erwarten ist |

Grau heißt in jedem Modus dasselbe: **nicht aufgeklärt**. Was Sie nicht sehen, färbt das
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
