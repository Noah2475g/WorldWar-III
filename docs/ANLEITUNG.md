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

## Eine Partie zu zweit — die Einladung

Dieses Spiel kann zu zweit gespielt werden: Sie laden einen Freund ein, er öffnet einen
Link im Browser, und Sie spielen dieselbe Partie auf zwei Rechnern. Er installiert nichts,
lädt keine Datei herunter und legt kein Konto an.

**Wie es funktioniert, in fünf Sätzen.** Beide Rechner haben denselben Spielstand und
rechnen **beide** die ganze Partie, Computergegner eingeschlossen. Übertragen werden nur
**Befehle**, nie Spielstände: je Spielstunde schickt jede Seite genau eine Nachricht, auch
wenn sie leer ist. Eine Spielstunde läuft erst, wenn **beide** Nachrichten da sind —
dadurch stellt sich das Tempo von selbst ein, und der Langsamere gibt es vor. Jede
Nachricht trägt die Prüfsumme des zuletzt gerechneten Ticks; weichen sie ab, hält die
Partie an und sagt es, statt zwei verschiedene Welten weiterzuspielen. Auf Ihrem Rechner
läuft dabei ein kleiner Dienst, der das Spiel ausliefert und die Nachrichten weiterreicht
— mehr tut er nicht.

### Drei Dinge, die anders sind als allein

**Tempo und Vorspulen fallen weg.** Die Geschwindigkeit wird **einmal** beim Anlegen der
Partie gewählt und steht danach fest. Die Tempotasten, der Regler und die Vorspulziele tun
nichts und sagen, warum. Das ist keine Sparsamkeit: im Gleichschritt gibt ohnehin der
Langsamere das Tempo vor, und ein Regler, den einer von beiden bewegt, hieße nur, dass der
andere ihn nicht bewegt hat.

**Eine Pause wird beantragt und angenommen.** Der Pausenknopf wird zum **Pausenantrag**.
Die Partie läuft weiter, bis der andere zustimmt; dann halten beide Uhren bei derselben
Spielstunde an. Ein Antrag, der dreißig Sekunden unbeantwortet bleibt, verfällt, und beide
erfahren es. **Fortsetzen darf jeder allein**, mit drei Sekunden Vorlauf — sonst könnte ein
abgelenkter Mitspieler die Partie einsperren.

**Jeder hat den vollen Spielstand im Speicher — es gibt keinen Schummelschutz.** Der Nebel
des Krieges ist eine Eigenschaft der Anzeige, nicht der Daten: wer die Entwicklerwerkzeuge
seines Browsers öffnet, kann alles sehen. Das ist der Preis dafür, dass beide Seiten
dieselbe Partie selbst rechnen — und genau dieser Umstand ist es auch, der eine
unterbrochene Partie rettet (siehe unten). Unter Freunden ist das in Ordnung; für ein
Spiel mit Fremden wäre es das nicht, und deshalb steht es hier und nicht im Kleingedruckten.

### Was Sie einmal einrichten

Die letzte Meile läuft über **Tailscale**: ein privates Netz zwischen Ihren beiden
Rechnern. Kein öffentlicher Endpunkt, kein Tunnelanbieter, keine Portfreigabe am Router —
Ihr Rechner ist aus dem Internet weiterhin nicht erreichbar.

1. **Tailscale installieren** (einmalig, auf Ihrem Rechner): <https://tailscale.com/download>.
   Anmelden, das Gerät erscheint in Ihrem Tailnet.
2. **Ihren Mitspieler einladen** (einmalig, je Mitspieler): im Tailscale-Adminbereich unter
   *Users → Invite external users* eine Einladung erzeugen und ihm schicken. Er installiert
   Tailscale, nimmt die Einladung an, und ab da sind beide Rechner im selben privaten Netz.
   Das kostet ihn etwa fünf Minuten und danach nie wieder etwas.
3. **Prüfen, dass es steht:** `tailscale ip -4` nennt Ihre Adresse im Tailnet. Sie beginnt
   mit **100.** (der Bereich 100.64.0.0/10). Steht dort stattdessen eine Meldung wie
   `no current Tailscale IPs`, ist Tailscale noch nicht angemeldet — dann funktioniert der
   Link nicht, und das ist kein Fehler des Spiels.

### Und dann, jedes Mal

1. **Den Hostdienst starten:**

   ```bash
   pnpm mp:host
   ```

   Der Befehl baut das Spiel, startet den Dienst auf Port **7749** und druckt zwei Links:
   einen für Sie (`#/gastgeben…`) und einen für Ihren Gast (`#/beitreten…`). Beide tragen
   dieselbe Raumkennung und dasselbe Geheimnis. Findet der Befehl keine Tailscale-Adresse,
   sagt er es und druckt nur die Links des lokalen Netzes.

2. **Den Gast-Link verschicken** — per Nachricht, Telefon, wie Sie mögen. Das Geheimnis
   steht **hinter dem Rautezeichen**; was dort steht, schickt ein Browser beim Laden der
   Seite nicht an den Server, und es landet in keinem Protokoll.

3. **Ihren eigenen Link öffnen.** Der Anlegedialog steht sofort offen und ist schon auf
   „Zu zweit über einen Link" gestellt. Wählen Sie Karte, Ihre Nation, die Zahl der
   Gegner, die Siegbedingung und die **feste Geschwindigkeit** — und beginnen Sie die
   Partie. Danach sehen Sie die Lobby: den Link zum Kopieren und den Stand der Dinge.

4. **Der Gast öffnet seinen Link.** Er sieht zuerst, worauf er sich einlässt: Karte, seine
   Nation, Ihre Nation, die Zahl der Computergegner, die Siegbedingung und die feste
   Geschwindigkeit. Dann trägt er seinen Namen ein und tritt bei.

5. **Sie starten.** In Ihrer Lobby steht jetzt sein Name. Erst Ihr Druck auf **Partie
   starten** löst den Handschlag aus: beide Rechner vergleichen Protokollfassung,
   Regelwerk, Karte und rechnen einen Spieltag zur Probe. Stimmen die Prüfsummen, beginnt
   die Partie; stimmen sie nicht, beginnt sie **nicht**, und der Grund steht auf dem
   Bildschirm.

**Beenden:** Strg+C im Fenster des Hostdienstes. Der Dienst gibt den Port sofort wieder
frei; ein zweiter Start auf demselben Port gelingt danach ohne Wartezeit.

### Wenn die Verbindung abreißt

Drei Stufen, in dieser Reihenfolge:

1. **Es hakt** (unter zehn Sekunden): die Uhr steht, die Kopfleiste sagt „Warte auf
   Mitspieler". Es geht nichts verloren — der Gleichschritt wartet ohnehin.
2. **Es ist weg** (über zehn Sekunden): ein Hinweis mit zwei Knöpfen, *weiter warten* oder
   *Partie beenden*. Jede Seite hat ihre Nachrichten ab der letzten bestätigten Spielstunde
   gepuffert; kommt die Verbindung zurück, wird nachgeliefert und weitergespielt, als wäre
   nichts gewesen.
3. **Er kommt nicht wieder:** Sie können die Partie **allein weiterspielen**. Ihr
   Mitspieler wird dabei zum Computergegner, und ab da ist es eine Einzelspielerpartie mit
   allem, was dazugehört — Tempo und Vorspulen eingeschlossen. Das ist ein bewusster Klick
   und passiert nie von selbst.

### Über mehrere Abende

Beide speichern lokal weiter, wie im Einzelspieler (Strg+S). Zum Fortsetzen starten Sie
`pnpm mp:host` neu und verschicken den neuen Link; der Handschlag vergleicht die
Prüfsummen der beiden gespeicherten Stände. Sind sie gleich, geht es weiter. Sind sie
ungleich — Ihr Mitspieler hat einen älteren Stand oder gar keinen —, überträgt Ihr Rechner
seinen Stand, und beide prüfen erneut. Das ist die **einzige** Stelle, an der ein
Spielstand über die Leitung geht.

### Was es ausdrücklich nicht gibt

Mehr als zwei Menschen, eine Lobby, eine Freundesliste, ein Konto, einen Chat, einen
Schummelschutz. Es gibt einen Link, und den verschicken Sie selbst.

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
Anhalten, Haltung (siehe unten), Teilen (halbiert jede Einheitenart),
Zusammenlegen (alle eigenen Armeen am Ort) und Beschießen (nur mit Artillerie oder
Bombern, nur im Krieg). Escape bricht die Zielwahl ab.

**Haltung** (vier Knöpfe am Armeepanel): Die Haltung bestimmt, wie eine Armee kämpft — und
eine davon handelt in engen Grenzen von selbst.

- **Verteidigung** ist die Haltung jeder neuen und jeder zurückgewichenen Armee. Sie bleibt
  eingegraben stehen. Steht in ihrer Provinz noch eine weitere eigene Armee, rückt sie von
  selbst in eine bedrohte eigene Nachbarprovinz nach — in eine, in der ein Kriegsgegner steht,
  oder in eine leere, an die ein Kriegsgegner grenzt: höchstens eine Armee je Provinz, die am
  schnellsten dort ist, und nur über eine einzige Grenze. Allein marschiert sie nie, damit ihre
  eigene Provinz nicht leer fällt, und nach einem Marsch oder Rückzug bleibt sie fünf Tage lang
  stehen — gezählt ab dem Abmarsch, nicht ab der Ankunft. Eine Provinz, die schon gefallen ist, holt
  sie nicht zurück.
- **Angriff** kämpft mit Angriffswerten statt eingegraben und marschiert nie von selbst. Sie
  verzichtet damit auf den Vorteil des Verteidigers.
- **Garnison** bleibt stehen, was auch geschieht, und kämpft wie die Verteidigung. Wählen Sie
  sie für eine Armee, die ihren Posten halten soll. **Anhalten** und ein eigener **Marschbefehl**
  stellen eine Armee auf Verteidigung zugleich auf Garnison, damit sie nicht von selbst weitermarschiert —
  auch nicht nach einem langen Marsch, der die fünf Tage schon aufgebraucht hat.
- **Rückzug** siehe unten; danach steht die Armee auf Verteidigung.

Die Automatik gibt nur Befehle, die Sie auch selbst geben könnten, marschiert nur in eigene
Provinzen, und ein eigener Befehl für dieselbe Armee geht vor. Sie entscheidet nur aus dem, was
Sie sehen, und führt nur Ihre Armeen — eine Armee der Computergegner auf Verteidigung folgt deren
eigener Planung. Warum sie so schmal ist: ein Gefecht ist meist nach wenigen Stunden entschieden,
ein Marsch in die Nachbarprovinz dauert ein bis vier Tage. Wer erst auf ein Gefecht hin losmarschiert,
kommt zu spät — und lässt die eigene Provinz leer.

**Rückzug** (Knopf am Armeepanel): Die Armee weicht in eine benachbarte Provinz aus — bevorzugt in
eine eigene, sonst in eine, deren Besitzer nicht mit Ihnen im Krieg liegt — und löst sich dabei aus
einem Kampf. Der Knopf wirkt auch ohne Gefecht, zum selben Preis; gibt es keine solche Provinz, bleibt
sie stehen. Ein Rückzug zählt für die Automatik als Ausrücken: eine Verteidigung derselben Provinz
rückt dann nicht von selbst aus, wenn sie sonst allein zurückbliebe. Der Preis steht am Knopf — sie
verliert beim Absetzen Stärke und darf für eine Anzahl Tage **nicht angreifen**; getroffen
werden kann sie in dieser Zeit sehr wohl. Ein Rückzug ist deshalb eine Entscheidung, keine
Rücknahme: er rettet Einheiten und kostet die Gelegenheit.

**Bauabbruch** (Knopf am laufenden Bauvorhaben in der Provinz): bricht den Auftrag ab und
gibt die Baustelle frei. **Sie bekommen die Hälfte der Rohstoffe zurück** — die andere
Hälfte ist mit dem Auftrag abgeflossen und bleibt es. Ein Abbruch ist damit kein
Totalverlust, aber auch keine folgenlose Rücknahme: er lohnt, wenn die Bauplätze knapp
sind, wenn Sie das Material dringender anderswo brauchen, oder wenn die Provinz zu fallen
droht (fällt sie, bricht der Auftrag ohnehin ab — dann ohne Erstattung).

**Der Kampfbericht** steht im Ereignisprotokoll: nach jedem Gefecht, wer das Feld behalten
hat *und* was es beide Seiten gekostet hat — Verluste getrennt nach Angreifer und
Verteidiger. Filtern Sie das Protokoll auf **Kämpfe**, wenn Sie eine Schlachtreihe
nachlesen wollen.

**Diplomatie** (D oder Knopf in der Kopfleiste): Ihr eigenes Ansehen und das jeder anderen
Macht stehen als Balken oben im Panel — hoch ist gut, niedrig kostet Vertrauen. Darunter
die Kriege der Welt, auch die, an denen Sie nicht beteiligt sind. Eine Macht auswählen,
dann in der Gruppe **Verträge**: Krieg erklären (wirkt nach Vorlaufzeit — das Protokoll
nennt den Tag), Frieden anbieten oder annehmen, Bündnis anbieten, annehmen oder aufkündigen.

**Durchmarsch und Karte**: eine eigene Gruppe neben den Verträgen. Durchmarsch ist
**gerichtet** — wer ihn gewährt, darf damit nicht selbst ins fremde Land. Gewähren wirkt
sofort; kündigen setzt eine Frist (die Spalte „Durchmarsch" nennt dann „endet an Tag N"
statt eines zweiten Knopfs). Wer selbst durchmarschieren will, **beantragt** es — die
andere Macht sieht den Antrag als Meldung und nimmt ihn im Diplomatiepanel an. Die
Kartenfreigabe zeigt der anderen Macht, was Sie selbst sehen; Ihre eigene Karte sieht sie
nur, wenn sie ebenfalls freigibt.

**Handelsangebote**: im Diplomatiepanel, je Macht ein eigenes Formular. Rohstoffe und
Provinzen lassen sich auf **beide** Seiten legen; die Vorschau zeigt den Marktwert beider
Seiten zum Kurs des Ticks, bevor Sie anbieten. Was Sie geben, liegt ab sofort in Treuhand
und kommt zurück, wenn das Angebot ohne Tausch endet — abgelehnt, zurückgezogen, nach drei
Tagen verfallen oder durch Krieg. Provinzen wechseln erst beim Tausch den Besitzer. Ein
eingehendes Angebot meldet sich mit einer eigenen, leisen Meldung; ein Klick führt in die
Diplomatie mit der anbietenden Macht, wo Sie annehmen, ablehnen oder — bei einem eigenen
Angebot — zurückziehen. Die Welt erfährt nur **dass** gehandelt wurde, nie **wie viel**.

**Markt** (H): Rohstoff abgeben, Menge, Rohstoff erhalten — der Gegenwert steht da,
bevor Sie handeln. Der Kurs gilt für alle Mächte gleich und für den ganzen Tick.

**Spionage** (S oder Knopf im Fuß): Anwerben läuft über die Provinzleiste — in einer
fremden oder herrenlosen Provinz Aufklärung, Wirtschafts- oder Militärsabotage, in
einer eigenen nur Gegenspionage. Preis und Tagessold stehen im Tooltip; höchstens fünf
Spione gleichzeitig. Ein Spion arbeitet frühestens ab dem Tag nach dem Ansetzen, einmal
täglich, und kostet jeden Tag seinen Sold, solange er lebt. In der Spionageübersicht
(Taste S) sehen Sie jeden eigenen Spion mit Auftrag, Ziel und letztem Ergebnis:
**Umsetzen** öffnet einen Modus — wählen Sie die Zielprovinz auf der Karte oder in der
Liste, Escape bricht ab —, **Entlassen** nimmt ihn ohne Erstattung aus dem Dienst.
Sabotage gelingt höchstens einmal je Provinz und Tag. Wer sabotiert wird, erfährt
**dass**, aber nicht **wer** — nur ein eigener Gegenspion deckt einen fremden Spion auf,
und dann erfahren es beide Seiten. „Keine Enttarnung" heißt: entweder war niemand da,
oder die Suche blieb erfolglos — das Spiel sagt Ihnen nicht, welches der beiden es war.

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
| S | Spionageübersicht |
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
| Seitenleiste | **Meldungen**: Kampf im eigenen Land, verlorene Hauptstadt, Rohstoffmangel, Aufstandsgefahr, **Sabotage** (rot, bleibt bis zum Wegklicken), Enttarnungen und verlorene Spione (leise). Ein Klick führt die Karte hin. |

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
