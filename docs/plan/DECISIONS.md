# DECISIONS

Entscheidungen, die vom Design abweichen oder es ergänzen — je Eintrag: Datum, Aufgabe,
Entscheidung, Begründung, Auswirkung.

---

## 2026-09-02 · T-M0-02 · Lang laufende Prüfungen heißen `*.slow.test.ts`

**Entscheidung:** Das Design spricht von einem Vitest-Tag `@slow`. Umgesetzt ist es als
Dateinamens-Konvention (`*.slow.test.ts`) mit zwei Konfigurationen.

**Begründung:** Vitest kennt keine Tags; eine Filterung über Testnamen wäre eine
Regex-Verrenkung, die still danebengreift, sobald jemand einen Testnamen ändert. Der
Dateiname ist maschinell eindeutig.

**Auswirkung:** `pnpm test` schließt sie aus, `pnpm test:slow` führt nur sie aus.

---

## 2026-09-02 · T-M1-01 · Zwei Divisionsfunktionen statt einer

**Entscheidung:** Das Design nennt nur `divFixed`. Umgesetzt sind zwei Funktionen:
`divFixed(a, b)` (gerundete Ganzzahldivision, die Grundoperation) und `quotFixed(a, b)`
(Festkomma-Quotient, skaliert vorher).

**Begründung:** Beides wird gebraucht, und beides mit einem Namen zu bedienen führt
unweigerlich zu Fehlern um den Faktor 1000 — genau die Fehlerklasse, gegen die die
Festkomma-Regel überhaupt existiert.

**Auswirkung:** Keine für das Spielverhalten; die ESLint-Regel erlaubt beide.

---

## 2026-09-03 · T-M3-05 · Provinzmoral senkt die Stärke frischer Einheiten, nicht ihre Zahl

**Entscheidung:** Belegt ist, dass neu rekrutierte Infanterie mit Trefferpunkten
proportional zur Provinzmoral startet (75 Moral → etwa 15 von 20 Trefferpunkten). Im
Trefferpunkte-Pool-Modell (Design D2) wird daraus: Der gelieferte Pool ist
`bestellteZahl × hpProEinheit × moralAnteil`. Eine Bestellung über fünf Infanteristen
aus einer Provinz mit Moral 70 liefert also einen Pool, der vier Einheiten entspricht.

**Begründung:** Der Pool speichert bewusst keine Stückzahl — sonst driften Zahl und
Stärke auseinander (das war der ausdrückliche Befund des Architektur-Reviews). Die
Alternative wäre gewesen, die Moralwirkung ganz zu streichen; sie ist aber eine der
wenigen wirklich belegten Zahlen und ein spürbarer Grund, Provinzen bei Laune zu halten.
Untergrenze: 25 % — eine Einheit wird nie schon gebrochen geboren.

**Auswirkung:** Der Spieler bezahlt für fünf und bekommt bei schlechter Moral weniger
Kampfkraft. Das muss die Oberfläche erklären (T-M10-05: Tooltip nennt die zu erwartende
Stärke, nicht nur die Stückzahl). Aufgenommen als Hinweis für den UI-Meilenstein.

---

## 2026-09-03 · T-M4-03 · Kein separater Zustandsfaktor im Kampf

**Entscheidung:** Das Original skaliert den Schaden einer Einheit mit ihren
verbleibenden Trefferpunkten (100 % → 100 % Schaden, 0 % → 50 %). Im
Trefferpunkte-Pool-Modell entfällt diese Kurve ersatzlos.

**Begründung:** Der Pool *ist* die Stärke. Eine angeschlagene Armee hat weniger
Trefferpunkte, entspricht damit weniger Einheiten und richtet dadurch bereits weniger
Schaden an. Die Kurve zusätzlich anzuwenden würde dieselben Verluste zweimal bestrafen —
eine halb aufgeriebene Armee wäre dann viermal so schwach wie eine volle statt zweimal.

**Auswirkung:** `healthDamageFloor` bleibt als Konstante im Regelwerk erhalten, wird
aber nicht mehr gelesen. Die Wirkung ist im Test „laesst eine geschwaechte Armee weniger
ausrichten" belegt.

---

## 2026-09-03 · T-M10-02 · Vorspulen läuft in Häppchen über die Ereignisschleife

**Entscheidung:** `fastForward` wird im Worker nicht in einem Zug aufgerufen, sondern in
Stapeln zu 250 Spielstunden — einer je Zeitscheibe des Worker-Takts. Der Kern bleibt
unverändert; die Stapelung liegt im Simulations-Host (`SimEngine.continueFastForward`).

**Begründung:** Ein Test hat es aufgedeckt: JavaScript ist einfädig. Ein Vorspulen, das
in einem Aufruf durchläuft, kommt nie an die Nachricht „Abbrechen" heran — der Worker
liest seinen Posteingang erst, wenn er ohnehin fertig ist. Der Abbruchknopf aus Design D5
wäre eine Attrappe gewesen. Dasselbe gilt für die Fortschrittsanzeige.

**Auswirkung:** Der Abbruch greift innerhalb einer Bildschirmscheibe (16 ms). Der
Durchsatz bleibt weit über der Zusage — gemessen deutlich über 500 Spielstunden je
Sekunde auf der Testkarte. `SimEngine.fastForward(target, shouldAbort?)` bleibt als
blockierende Bequemlichkeit für Tests und den kopflosen Betrieb erhalten.

---

## 2026-09-03 · T-M10-01 · Noah hat Richtung A „Lagekarte" freigegeben

**Entscheidung:** Die Oberfläche bekommt die helle Kartenoptik: Leinengrund `#E4E0D2`,
Papierflächen `#F2EEE3`, Tinte `#1F2420`, Zinnober `#B3341E` ausschließlich für Kampf und
Alarm. Schrift durchgehend IBM Plex (OFL) in drei Schnitten — schmal für Kartenschrift,
normal für Bedienung, dicktengleich für Zahlen.

**Begründung:** Freigabe durch Noah am 2026-09-03 auf das Mockup
`docs/design/ui-mockup.html` (Artifact
`claude.ai/code/artifact/14e02471-d4ab-4267-833d-b6d98f8616e7`), das drei Richtungen
gegenübergestellt hat. Ausschlaggebend war die Lesson `ui-needs-design-gate` aus Rotation:
dunkel auf dunkel hat dort einen fertigen Playtest nach einer Minute beendet.

**Auswirkung:** T-M10-01b schreibt die Werte als `apps/desktop/src/ui/tokens.ts` fest, mit
Kontrasttest ab 4,5:1. T-M10-03 ff. sind entsperrt.

---

## 2026-09-03 · T-M9-01 · Geodaten direkt von Natural Earth, nicht über npm

**Entscheidung:** Die Rohdaten werden von der offiziellen Natural-Earth-Auslieferung
geladen (naturalearthdata.com bzw. deren CDN), nicht als npm-Abhängigkeit.

**Begründung:** Noahs Entscheidung am 2026-09-03. Die Fassung ist damit ausdrücklich
gewählt statt von einem Paketstand geerbt, und die Datei kommt aus derselben Quelle, die
im Lizenzeintrag steht.

**Auswirkung:** Der Bezug läuft über ein eigenes Skript und wird nicht bei jedem
`pnpm install` wiederholt; das Ergebnis der Pipeline (`data/maps/world.json`) wird
eingecheckt, die Rohdaten nicht (D-09: Kartenerzeugung ist eine Offline-Pipeline).

---

## 2026-09-03 · T-M9-01 · Der Datenbezug liegt in `scripts/`, nicht in `packages/mapgen`

**Entscheidung:** Die Aufgabe nennt `packages/mapgen/src/fetch.ts`. Umgesetzt ist der
Bezug als `scripts/fetch-geodata.mjs`; im Paket steht nur das Quellenregister
`sources.ts` — Adressen, Lizenz, Zweck, Größe, ohne jeden Netzzugriff.

**Begründung:** Der Wächter `test/guards/no-network` durchsucht `packages/` und `apps/`
nach ausgehenden Verbindungen, weil das Spiel nach Ziel Z3 offline läuft und niemals nach
Hause funkt (R-FREE-04). Ein `fetch(` in `packages/mapgen` hätte ihn gebrochen — zu Recht:
der Wächter kann nicht zwischen Spiel und Werkzeug unterscheiden, und die Ausnahme wäre
genau die Lücke, durch die später ein echter Netzzugriff schlüpft. Der Kartenbau ist
ohnehin eine einmalige Entwickler-Aufgabe (D-09), kein Teil der Anwendung.

**Auswirkung:** `node scripts/fetch-geodata.mjs` lädt nach `data/geo/` (per `.gitignore`
ausgenommen) und schreibt Prüfsummen. Eingecheckt wird nur das Pipeline-Ergebnis.

---

## 2026-09-03 · T-M10-01b · Spielerfarben werden nach Farbabstand geprüft, nicht nach Kontrast

**Entscheidung:** Ob zwei Nationen auf der Karte unterscheidbar sind, prüft `deltaE`
(CIE76 in Lab) mit Schwelle 10 — nicht das WCAG-Kontrastverhältnis.

**Begründung:** Der Kontrastwert kennt nur Helligkeit. Ein Blaugrau und ein Rotbraun
gleicher Helligkeit kommen dort als „identisch" heraus, während ein Mensch zwei klar
verschiedene Länder sieht. Umgekehrt hat der Farbabstand einen echten Fehler gefunden,
den der Kontrastwert durchgewinkt hätte: `slate #AFB6BC` und `petrol #9FB2BE` lagen nur
5,7 auseinander. `slate` ist durch `mint #9CC8B4` ersetzt.

**Auswirkung:** Schwelle 10 statt der Wahrnehmungsschwelle 2,3 — zwei Provinzen müssen
sich quer über die Karte hinweg auf einen Blick unterscheiden, nicht erst im direkten
Vergleich. Farbenblindheit ist damit noch nicht abgedeckt; das gehört zu T-M10-12
(Zugänglichkeit) und braucht zusätzlich Musterung oder Beschriftung.

---

## 2026-09-03 · T-M9-00 · Startnationen sind teils Staaten, teils Bündnisse

**Entscheidung:** Die 18 spielbaren Mächte bestehen nicht durchweg aus je einem Staat.
Neun sind es (die von Natural Earth untergliederten Länder), die übrigen fassen mehrere
Staaten zusammen — „Europäische Union" aus zehn Ländern, „Japan" aus Japan, Korea, den
Philippinen und Taiwan.

**Begründung:** Die Anforderung verlangt mindestens drei Provinzen je Startnation, sonst
ist eine Macht mit dem ersten verlorenen Gefecht aus dem Spiel. Bei 1:50 Mio untergliedert
Natural Earth nur neun Länder; Deutschland, Frankreich und Großbritannien wären je eine
einzige Provinz. Ohne Europa wäre es kein Weltkrieg. Blöcke statt Einzelstaaten lösen das
ohne feinere Geodaten und passen zum modernen Setting.

**Auswirkung:** Wer zu Beginn welche Provinz besitzt, entscheidet T-M9-03. Ein Test hält
fest, dass jede Macht mindestens drei Provinzen und mindestens einen Seeweg hat.

---

## 2026-09-03 · T-M9-00 · Provinzkennungen stehen in der Regeldatei, sie werden nicht gezählt

**Entscheidung:** Jede zusammengefasste Provinz trägt eine ausgeschriebene Kennung
(`RUS-SIB`, `CHN-EAST`, `IDN-JAVA`), festgelegt in `merge-rules.json` — statt einer
laufenden Nummer aus der Verarbeitung.

**Begründung:** Der erste Entwurf vergab `RUS-1`, `RUS-2` in Verarbeitungsreihenfolge.
Seewege, Szenarien und Startaufstellungen zeigen aber auf genau diese Zeichenketten:
liefert Natural Earth eines Tages die Datensätze in anderer Reihenfolge, zeigt die
Straße von Malakka plötzlich auf Sibirien, und nichts schlägt an. Ein Test prüft jetzt,
dass eine umgedrehte Eingabe dieselben Kennungen ergibt.

**Auswirkung:** Die Regeldatei ist länger, dafür sind die Kennungen lesbar und stabil.

---

## 2026-09-03 · Sprache · Es bleibt bei Deutsch — weil die Daten es hergeben

**Entscheidung:** Noah hat freigestellt, ob das Spiel deutsch oder englisch ist, solange
es einheitlich bleibt. Es bleibt bei Deutsch für alles, was der Spieler sieht, und bei
Englisch für Code, Kommentare und Commit-Nachrichten — also bei der bereits bestehenden
Trennung. R-UI-07 bleibt damit unverändert gültig.

**Begründung:** Der Anlass für die Freistellung war ein Befund, der sich als mein eigener
Lesefehler herausstellte: die deutschen Ländernamen kamen als `Ã„thiopien` an, weil ich
die DBF-Dateien ohne Kodierungsangabe gelesen habe. Mit `encoding: 'utf8'` sind sie
vollständig und korrekt — **alle 242 Staaten** tragen einen deutschen Namen, ebenso alle
294 Verwaltungseinheiten. Es gab also nie einen Grund zu wechseln, und ein Wechsel hätte
die deutschen Fehlermeldungen und Testnamen aus 56 erledigten Aufgaben umgestellt.

**Auswirkung:** Keine. Die Provinznamen auf der Karte sind deutsch, die Namen der
zusammengefassten Regionen ebenfalls („Nordostchina", „Russischer Ferner Osten").

---

## 2026-09-03 · T-M9-00 · Weltkarte auf 1:10 Mio, damit Europa spielbar wird

**Entscheidung:** Alle drei Geodatensätze kommen jetzt in der feinsten Natural-Earth-Stufe
(1:10 Mio, zusammen rund 23 MB statt 2 MB). Ergebnis: **237 Provinzen** und **24
Startnationen, jede ein eigener Staat** mit mindestens drei Provinzen.

**Begründung:** Noahs Entscheidung. Bei 1:50 Mio untergliedert Natural Earth nur neun
Länder; Deutschland, Frankreich und Großbritannien wären je eine einzige Provinz gewesen,
und Europa hätte nur als Block „Europäische Union" gespielt werden können. Das war eine
Notlösung, keine Designentscheidung. Beide Stufen gemischt zu verwenden schied aus: Admin-0
und Admin-1 müssen aus derselben Stufe stammen, sonst passen die Grenzen nicht aufeinander
und die Nachbarschaftsberechnung (T-M9-02b) findet Lücken, die es in Wirklichkeit nicht gibt.

**Auswirkung:** Die Blöcke sind aufgelöst — Deutschland, Frankreich, Italien, Polen und die
Ukraine sind eigene Mächte. Der Download ist zehnmal so groß, bleibt aber einmalig und
uneingecheckt. `raw-units.json` wächst von 86 kB auf 0,86 MB und bleibt eingecheckt, damit
die Kurationstests ohne Download laufen.

---

## 2026-09-03 · T-M9-00 · Dritte Zuschnitt-Strategie: Aufteilung nach Lage

**Entscheidung:** Neben `region` (Regionsfeld der Rohdaten) und `explicit` (Liste von Hand)
gibt es `geographic`: Die Einheiten eines Landes werden nach ihrer Lage in ein Raster
sortiert — 2×2 für Deutschland, drei Nord-Süd-Streifen für Italien und Ägypten. Die Streifen
enthalten **gleich viele Einheiten**, nicht gleich viele Grade.

**Begründung:** Bei 1:10 Mio ist fast jedes Land untergliedert, die meisten ohne brauchbares
Regionsfeld: Deutschland kommt als 16 Länder ohne Regionen, die Türkei als 81 Provinzen,
Großbritannien als 232 Verwaltungseinheiten. Für zwei Dutzend Länder Listen von Hand zu
schreiben wäre ein Tag Tipparbeit — und eine dauerhafte Last: eine umbenannte Einheit in der
nächsten Natural-Earth-Fassung fiele still aus ihrer Provinz. Gleich viele Einheiten je
Streifen statt gleich viele Grade, weil sonst ein einzelnes weit südliches Gebiet eine ganze
Provinz für sich bekäme.

**Auswirkung:** Drei Angaben je Land genügen: Raster, Zellennamen, fertig.
**Und die Namen nennen die Lage, nicht die Landschaft.** Der erste Entwurf hatte historische
Namen vergeben; eine Stichprobe zeigte, dass sie falsch waren — im „bayerischen" Quadranten
lagen auch Baden-Württemberg und Sachsen, die „Provence" war in Wahrheit Zentralfrankreich,
und „Andalusien" enthielt die Kanarischen Inseln. Wer nach Lage schneidet, muss nach Lage
benennen.

---

## 2026-09-03 · T-M9-02a · Verschmelzen über eine Topologie, nicht über Polygon-Arithmetik

**Entscheidung:** Die Teile einer Provinz werden über eine gemeinsame TopoJSON-Topologie
verschmolzen (`topojson-server` + `topojson-client`, beide frei), nicht über eine
Polygon-Vereinigung.

**Begründung:** In einer Topologie teilen sich zwei aneinandergrenzende Einheiten
denselben *Bogen* — eine Linie, zweimal verwendet. Das Auflösen ist damit exakt: Der
gemeinsame Bogen fällt weg, die äußeren bleiben auf die letzte Stelle dort, wo sie waren.
Eine Polygon-Vereinigung würde stattdessen zwei Linien vergleichen, die nur im Rahmen der
Gleitkommagenauigkeit gleich sind, und Haarrisse zwischen Provinzen hinterlassen, die sich
in Wirklichkeit berühren — die Nachbarschaftsberechnung (T-M9-02b) läse das als „keine
Nachbarn".

**Und die Reihenfolge:** erst verschmelzen, dann vereinfachen. Vereinfacht man die Teile
zuerst, rücken ihre gemeinsamen Kanten je um Bruchteile eines Grades auseinander, und beim
Verschmelzen gibt es nichts Exaktes mehr zu kürzen.

**Auswirkung:** 1279 Teile werden zu 237 Provinzen; die Vereinfachung bei 0,05° drückt
602 842 Stützpunkte auf 62 195 (−90 %), Ergebnisdatei 1,03 MB. Gesamtfläche 133,9 Mio km²
gegen erwartete rund 135 Mio ohne Antarktis. Zwei Nachbesserungen waren nötig, beide für
den Diff und nicht für die Geometrie: die Provinzen werden nach Kennung sortiert, und jeder
Ring beginnt an seinem westlichsten Punkt — sonst lieferte derselbe Bau je nach
Eingabereihenfolge dasselbe Rechteck ab einer anderen Ecke, also eine andere Datei.

---

## 2026-09-03 · T-M9-02b · Die Vereinfachung läuft über die Topologie, nicht je Provinz

**Entscheidung:** Die aus T-M9-02a stammende Vereinfachung Ring für Ring ist ersetzt durch
Visvalingam über die Topologie (`topojson-simplify`). Das Gewicht ist eine Fläche in
Quadratgrad (0,002) statt eines Abstands in Grad.

**Begründung:** Ein Nachweis hat den Mangel gezeigt: nach der alten Vereinfachung teilten
Frankreich und Spanien keinen einzigen Punkt mehr. Jede Provinz wurde für sich gedünnt,
und dieselbe Grenze bekam auf beiden Seiten unterschiedliche Stützpunkte — auf der Karte
ein Spalt, für die Nachbarschaftsberechnung eine fehlende Grenze. Über die Topologie wird
jeder Bogen genau einmal gedünnt, und beide Seiten behalten dieselbe Linie.

**Auswirkung:** 602 408 Stützpunkte auf 102 355 statt auf 62 195 — die Datei wächst von
1,03 auf 1,69 MB. Das ist der Preis dafür, dass Grenzen zusammenpassen, und er ist es wert.

---

## 2026-09-03 · T-M9-02b · Die ganze Karte kommt aus einer einzigen Datei

**Entscheidung:** Auch die 142 Provinzen, die ein ganzes Land sind, werden aus den
Admin-1-Einheiten dieses Landes gebaut — nicht aus der Admin-0-Geometrie. Bei 1:10 Mio
sind alle 142 dort untergliedert vorhanden.

**Begründung:** Natural Earth zeichnet Staatsumrisse und Bundesland-Umrisse getrennt; sie
stimmen nicht auf die letzte Stelle überein. Lesotho, aus Admin-0 genommen, teilte deshalb
nur einen Teil seines Randes mit den südafrikanischen Einheiten ringsum und sah aus wie
ein Land mit Küste. Aus einer Datei ist jede Grenze ein Bogen.

**Auswirkung:** `data/geo/admin0` wird für die Geometrie nicht mehr gelesen, nur noch für
Bevölkerung, Fläche und Kontinent.

---

## 2026-09-03 · T-M9-02b · Enklave heißt: umschlossen **und** von einem einzigen fremden Land

**Entscheidung:** Eine Provinz gilt als Enklave, wenn (a) kein Teil ihres Randes ins Freie
zeigt und (b) alle ihre Landnachbarn zu einem einzigen fremden Land gehören.

**Begründung:** Drei Anläufe, jeder von einem falschen Ergebnis korrigiert.
„Von genau einer Provinz umschlossen" fand **nichts** — Lesotho grenzt an zwei
südafrikanische Provinzen, weil Südafrika selbst geteilt ist. „Alle Nachbarn gehören zu
einem fremden Land" hielt dann auch den **Umschließenden** für eine Enklave, dessen
einziger Nachbar ja ebenfalls fremd ist. Und die Prüfung auf den freien Rand zählte
zunächst die Grenzen *zwischen Lesothos eigenen Distrikten* als Außenrand mit — die
verschwinden aber beim Verschmelzen. Erst auf Einheiten-Ebene gezählt stimmt es.

**Auswirkung:** Lesotho ist die einzige Enklave der Karte, was für diesen Zuschnitt richtig
ist. Der Unterschied zählt im Spiel: eine Enklave kann über Land genommen, aber nie über
Land entsetzt werden.

---

## 2026-09-03 · T-M9-02b · Frankreichs Übersee-Départements sind nicht Teil des Kernlands

**Entscheidung:** Guyane française, Martinique, Guadeloupe, Réunion und Mayotte sind vom
Zuschnitt ausgenommen.

**Begründung:** Ein Test fand es: „Südwestfrankreich" grenzte an **Brasilien**. Die
Übersee-Départements waren in die Frankreich-Quadranten gefallen, hatten deren Schwerpunkt
um Tausende Kilometer verschoben und ihnen Nachbarn in Südamerika verschafft. Ein Blick auf
die anderen 23 untergliederten Länder zeigte, dass nur Frankreich betroffen ist.

**Auswirkung:** Frankreich bleibt kompakt. Sollen die Übersee-Gebiete später spielbar sein,
gehören sie als eigene Provinzen in die Regeldatei — nicht in einen Quadranten des Kernlands.

---

## 2026-09-03 · T-M9-02c · Zu kleine Gebiete werden dem Nachbarn zugeschlagen

**Entscheidung:** Jedes als zu klein abgelehnte Gebiet mit Landnachbarn geht an die
Provinz, mit der es die längste Grenze teilt — 21 Fälle, darunter Liechtenstein,
Luxemburg, Andorra, Monaco, Montenegro und die Westsahara. Abgelehnte Inseln (64) bleiben
draußen.

**Begründung:** Ein abgelehntes Gebiet hört nicht auf zu existieren. Als Loch in der Karte
hinterlässt es einen weißen Fleck — und, schlimmer, seine Nachbarn sehen aus wie
Küstenländer: die Grenze zu einem fehlenden Land ist ein Stück Umriss, das mit niemandem
geteilt wird, also genau die Form einer Küste. So kamen die Schweiz und Österreich als
seefahrende Nationen heraus.

Die längste gemeinsame Grenze statt des nächsten Schwerpunkts, weil letzterer für einen
Streifen entlang eines Gebirges nahezu willkürlich ist; und statt des größten Nachbarn,
weil sonst jedes Loch Europas beim nächstgelegenen Großland landet.

**Auswirkung:** Belgien enthält jetzt Luxemburg, die Schweiz Liechtenstein. Die
Gesamtfläche steigt von 133,9 auf 134,2 Mio km². Küstenprovinzen: 184 von 237.

---

## 2026-09-03 · T-M9-02c · Seewege: die Engstellen von Hand, der Rest abgeleitet

**Entscheidung:** 91 Seewege sind kuratiert (`world-sealinks.csv`), 119 werden aus der
Geometrie abgeleitet. Ein abgeleiteter Weg entsteht nur, wenn die Verbindungslinie keine
dritte Provinz durchquert — geprüft an acht Zwischenpunkten.

**Begründung:** Was Hormus wichtig macht, ist nicht seine Breite; solche Engstellen kann
kein Algorithmus finden. Umgekehrt braucht jede der 184 Küstenprovinzen einen Zugang zum
Meer, sonst ist sie per Schiff unerreichbar und die halbe Karte für Flotten geschlossen.
Eine zweite Runde verbindet die Übriggebliebenen mit der nächsten erreichbaren Küste, auch
über größere Entfernung und auch, wenn es sich um einen Landnachbarn handelt: Eine
Landgrenze kann eine Armee überschreiten, eine Flotte nicht befahren.

**Auswirkung:** 0 Küstenprovinzen ohne Seeweg. Drei Fehler in der kuratierten Tabelle kamen
dabei ans Licht — Andamanensee, Östliche Ostsee und Río de la Plata endeten an Provinzen
ohne Küste.

---

## 2026-09-03 · T-M9-02c · Die Datumsgrenze in der Punkt-in-Fläche-Prüfung

**Entscheidung:** Ringpunkte werden relativ zum Prüfpunkt gemessen (kürzester
Längenunterschied). Ergibt ein Ring dabei mehr als 180° Breite, gilt der Punkt als außerhalb.

**Begründung:** Die relative Messung löst den einfachen Fall — ein Polygon beiderseits der
Datumsgrenze wird nicht mehr zerrissen. Ein Test fand die Grenze der Methode: von der
anderen Seite der Erde aus gemessen klappt so ein Polygon zu einem auf, das scheinbar den
ganzen Globus umspannt, und verschluckt den Prüfpunkt. Ein Ring, der relativ zum Punkt
mehr als eine halbe Welt breit ist, ist schlicht zu weit weg.

**Auswirkung:** Seewege über die Datumsgrenze werden kurz gemessen (Kamtschatka–Alaska),
und kein Seeweg entsteht durch eine irrtümlich getroffene Landmasse.

---

## 2026-09-03 · T-M9-03 · Provinzbevölkerung ist eine Spielgröße, keine Volkszählung

**Entscheidung:** Die reale Bevölkerung wird mit dem Exponenten 0,3 gestaucht, verankert
bei einer Million (eine Provinz mit einer Million Einwohnern bleibt eine Provinz mit einer
Million). Ergebnis: 0,18 bis 6,5 Mio je Provinz statt 0,05 bis 230 Mio.

**Begründung:** Die Anforderung verlangt, dass keine Startnation mehr als 15 % vom Median
abweicht — und die Startwertformel zählt die Bevölkerung direkt. China hat 37-mal so viele
Einwohner wie Polen; mit echten Zahlen lag die größte Abweichung bei **1108 %**, und keine
Menge Erz auf polnischem Boden hätte das geschlossen. Das wäre keine Schwierigkeitsstufe
gewesen, sondern eine vor dem ersten Zug entschiedene Partie.

Der Exponent ist gemessen, nicht geraten: 0,5 ergab 300 %, 0,4 noch 238 %, 0,3 dann 14 %.
Genommen wurde der mildeste Wert, der die Grenze erreicht — er behält so viel vom echten
Unterschied wie das Gleichgewicht zulässt. Die Reihenfolge bleibt in jedem Fall erhalten:
China ist auch danach die bevölkerungsreichste Macht.

**Auswirkung:** Die Zahlen auf dem Bildschirm lesen sich weiter als Bevölkerungen. Die
Schwellen für Stadt (2,4 Mio) und städtisches Gelände (3,4 Mio) sind auf dieser Skala
gesetzt. 92 der 237 Provinzen sind Städte.

---

## 2026-09-03 · T-M9-03 · Der Rest des Ausgleichs läuft über die Vorkommen

**Entscheidung:** Nach der Stauchung skaliert ein iteratives Verfahren die Vorkommen der
spielbaren Provinzen, bis jede Nation innerhalb von 14 % um den Median liegt. Neutrale
Provinzen bleiben unangetastet.

**Begründung:** Auch gestaucht bleiben Unterschiede — drei gegen sechs Provinzen, dichte
gegen dünne Besiedlung. Sie im Boden auszugleichen ist das Mittel, mit dem
Strategiespiele Startpositionen seit jeher angleichen: Wer klein ist, sitzt auf reicherem
Grund. Neutrale Provinzen davon auszunehmen ist wichtig, weil es dort nichts auszugleichen
gibt und eine Skalierung die Karte nur einebnen würde.

**Auswirkung:** Größte Abweichung 14 % bei 24 Nationen. Der Kartenbericht
(`docs/reports/map.md`) führt jede Nation mit ihrem Startwert auf, damit die Zahl
nachprüfbar bleibt statt behauptet.

---

## 2026-09-03 · M10 · Die Simulation läuft vorerst im Hauptthread

**Entscheidung:** Die Oberfläche ruft den Kern direkt auf, statt über den in T-M10-02
gebauten Worker zu gehen. `SimHost`, die Worker-Schale und ihre Tests bleiben unverändert
bestehen.

**Begründung:** Ein Worker in einem Vite-Bündel ist eine Verpackungsfrage und gehört zu
T-M11-03. Der Grund für den Worker war das Rechenbudget — und das ist gemessen: ein Tick
auf der Weltkarte kostet 2,76 ms bei einem Bildschirmtakt von 16 ms. Die interaktiven
Geschwindigkeiten halten also auch ohne ihn, und der Umzug ist später eine Änderung an
einer Stelle statt an vielen.

**Auswirkung:** Beim Vorspulen über viele Tage blockiert die Oberfläche kurz. Das ist der
Preis, und er ist sichtbar; die Alternative wäre gewesen, den Worker zu verdrahten, bevor
klar ist, wie das Programm verpackt wird.

---

## 2026-09-03 · T-M10-03b · Zeitmessungen gehören in die langsame Suite

**Entscheidung:** Der Bildraten-Budgettest ist nach `render.bench.slow.test.ts` gewandert.
In der schnellen Suite bleibt, was das Budget trägt: dass außerhalb des Ausschnitts nichts
gezeichnet wird, dass Stützpunkte mit dem Zoom ausdünnen, dass der Zwischenspeicher genau
so lange gilt wie er darf.

**Begründung:** Der Test war in `pnpm verify` rot (18,6 ms) und allein grün bei einem
Bruchteil des Budgets. Neben dreißig parallel laufenden Testdateien misst er die Last der
Maschine, nicht die Kosten des Codes. Das Projekt hatte diese Lehre schon einmal gezogen
(T-M8-03); sie gilt für die Oberfläche genauso.

**Auswirkung:** `pnpm verify` bleibt verlässlich. Das Budget wird weiterhin gemessen, nur
in `pnpm test:slow`, wo die Messung etwas bedeutet.

---

## 2026-09-03 · vor T-M12-03 · Die Weltkarte kommt auf die Skala der Regeln, nicht die Regeln auf die Karte

**Entscheidung:** `scripts/build-map.mjs` schreibt Vorkommen und Bevölkerung so in
`world.json`, wie die Anreicherung sie liefert — ohne die zweite Multiplikation mit
1000. Die komprimierte Bevölkerung wird zusätzlich auf ein Fünftel gebracht
(`POPULATION_SCALE` in `enrich.ts`, Stadt- und Ballungsschwellen entsprechend),
jede Startnation bekommt in ihrer Hauptstadt Holz und Erz, falls ihr Gelände keines
hergibt (`ensureStartingBasics`), und ein Skalentest (`economy-scale.test.ts`) misst
seither, wie viele Tage Einkommen die erste Kaserne kostet — auf der Weltkarte gegen die
Referenzkarte, mit den echten Regeln. Die Regeln, ihre 60 Konstanten und die Tests des
Kerns bleiben unverändert.

**Begründung:** Noahs Kriterium war „weniger Probleme beim Spielen". Zwei Wege standen
offen: die Karte auf die Skala der Regeln (dieser) oder die Regeln auf die Skala der
Karte (Kosten, Startbestände, Unterhalt, Marktpreise, Punkteformel — sechzig Zahlen mit
Status, dazu jeder Kerntest, jeder Golden-Master und die Referenzkarte, auf der M3
abgestimmt wurde). Der erste Weg berührt eine Datei im Generator, eine Konstante in der
Anreicherung und die Karte selbst; alles, was das Regelwerk über sich weiß, bleibt wahr,
und die Zahlen auf dem Bildschirm bleiben lesbar (Hunderte statt Hunderttausende).

Die Bevölkerungsskala kam als zweiter Schritt: nach der ersten Korrektur lagen Holz und
Nahrung im Band der Referenz, aber Geld war noch sechs- bis zwanzigfach zu reichlich.
Der Kern rechnet mit 300 000 Menschen als Referenzbevölkerung (Faktor 1,0, Deckel 1,5)
und besteuert je tausend; die komprimierten zwei bis fünf Millionen je Provinz hingen
sämtlich am Deckel — Bevölkerung bedeutete nichts mehr. Ein Fünftel setzt die
Weltprovinzen dorthin, wo die der Referenzkarte liegen (180 000 bis 900 000).

**Auswirkung, gemessen mit `economyOverview` am ersten Spieltag:**

| | Referenz (Nordland) | Deutschland vorher | Deutschland nachher | Italien vorher → nachher |
|---|---|---|---|---|
| Kaserne in Tagen Material | 8,8 | 0,003 (4 Spielminuten) | 2,4 | nie → 3,5 |
| Kaserne in Tagen Geld | 4,1 | 0,0005 | 2,3 | 0,0006 → 3,1 |
| Material je Tag | 38 | 132.805 | 137 | 0 → 96 |

Über alle 24 Mächte: Kaserne 1,1–15 Tage Material und 0,8–4,9 Tage Geld; jede Macht
produziert Nahrung, Material, Erz und Geld vom ersten Tag an. Startwerte: Median 41.262,
größte Abweichung 13 % (Grenze 15 %). Bevölkerung je Provinz: Median 443.000. Der
Parameterlauf ist auf der neuen Karte wiederholt (`docs/reports/balance-sweep.md`,
`BALANCING.md`); die Befunde des ersten Laufs über eine gesättigte Wirtschaft gelten
nicht mehr. Die Datei `world-shapes.json` blieb beim Neubau bitgleich.

---

---

## 2026-09-05 · vor M14 · Der Reparaturumfang ist schmal — was nicht gebaut wird, wird als Zusage zurückgenommen

**Entscheidung:** Aus den 68 Befunden der Auswertung vom 2026-09-04 wird gebaut, was das
Spiel unspielbar oder eine Messung unbrauchbar macht — rund fünfzehn Aufgaben in M14. Jeder
übrige Befund der Form „das Dokument verspricht X, der Code tut Y" wird **keine Aufgabe,
sondern eine zurückgenommene Zusage**: Anforderungstext, Entwurf und Definition-of-Done
werden auf das Gebaute gekürzt, und die Kürzung steht hier mit ihrem Preis.

**Begründung:** Über dreißig der 68 Befunde haben genau diese Form. Für jeden gibt es zwei
ehrliche Auflösungen — das Dokument nachziehen oder den Code bauen —, und beide sind
legitim; falsch ist allein, die Lücke offenzulassen, denn dann behauptet der Plan weiter
etwas, das niemand prüft. Würde jeder Befund eine Aufgabe, wüchse der Plan um 68 Einträge,
und T-M12-03 — der Abnahme-Haltepunkt und heute die letzte offene Aufgabe — rückte weiter
weg, statt näher. Ein Plan, der nur wächst, wird nie fertig. Die Gegenrichtung, alles
nachzuziehen und nichts zu bauen, scheidet ebenso aus: sieben der Befunde sind als Blocker
eingestuft, darunter der Speicher, der kein Fenster überlebt, und ein Stapel-Deckel, der
eine Armee ab 50 Einheiten auf null Schaden setzt. Ohne sie ist eine Abnahme sinnlos.

**Auswirkung:** Sechs Zusagen werden zurückgenommen, jede mit eigenem Eintrag unten:
Gebäudeunterhalt, Einheitenmoral, Garnison gegen Aufstand, E2E-Ebene, Zeitsieg,
Übergangsmalus. Das Spiel kann nach M14 weniger, als 01-REQUIREMENTS.md heute verspricht.
Es kann dafür genau das, was dort dann steht — und das ist der eigentliche Zweck der
Übung. Die Rücknahmen sind erst vollzogen, wenn die betroffenen Zeilen in
01-REQUIREMENTS.md, 02-DESIGN.md, 03-TASKS.md und tasks.yaml tatsächlich gekürzt sind;
bis dahin sind sie eine Absicht, kein Zustand.

---

## 2026-09-05 · M14/M16 · Die Abnahme läuft im Browser, Tauri wird ein eigener Meilenstein

**Entscheidung:** Die V1 wird im Browser-Bau abgenommen (AK-7, `docs/PLAYTEST.md`). Die
Verpackung als Programm wird **M16** — mit einem echten Bau und einem eigenen
Abnahmekriterium. C-02 („Auslieferung: Desktop-Anwendung über Tauri. Savegames im echten
Dateisystem", 01-REQUIREMENTS.md:44) wird präzisiert: das gilt ab M16, nicht für die
V1-Abnahme. Der dauerhafte Speicher-Port der V1 ist **IndexedDB**, nicht `fs`.

**Begründung:** C-02 ist die einzige Rahmenbedingung des Projekts, die nie auch nur einmal
ausgeführt wurde. Nachgeprüft im Worktree: `@tauri-apps` kommt in `pnpm-lock.yaml` null mal
vor, es gibt also keine JS-Bindung, mit der ein Dateiport überhaupt schreiben könnte;
`apps/desktop/src-tauri/icons/` existiert nicht, es gibt also kein Programmsymbol;
`Cargo.lock` existiert nicht, es hat also nie ein Rust-Bau stattgefunden. Und
`docs/PLAYTEST.md` startet in seiner eigenen Startanweisung `pnpm --filter
@worldwar/desktop dev` — den Vite-Server. Die Abnahme war längst im Browser geplant, nur
hatte es niemand aufgeschrieben. Damit ist der Bau als Programm unbekanntes Gelände: heute
weiß niemand, ob das Programm startet. So etwas gehört an den Anfang eines eigenen
Meilensteins, nicht ans Ende eines fremden.

**Auswirkung:** Der Speicher-Port wird IndexedDB. Das geht ohne Bruch, weil `StoragePort`
(packages/core/src/persistence/StoragePort.ts:9-15) schon durchgehend asynchron ist —
`list`/`read`/`write`/`remove`/`exists` geben Promises zurück; die Schnittstelle bleibt
unverändert. Ein Spielstand überlebt damit das Schließen des Fensters, aber er liegt im
Browserprofil und nicht in einer Datei, die Noah kopieren, sichern oder verschicken kann.
Das holt M16 nach, und bis dahin muss die Oberfläche es sagen statt es zu verschweigen. Die
Vertragstestreihe wird als gemeinsame Funktion herausgezogen und läuft ab M14 gegen jede
Umsetzung, die es gibt — zwei jetzt, drei ab M16. Die Befunde zu Symbol, CLI und dem
Verpackungswächter, der heute nur Zeichenketten aus zwei JSON-Dateien liest, wandern
vollständig nach M16 (Befunde 17, 20, 21).

---

## 2026-09-05 · M15 · V1.2 heißt „die KI wird ein Gegner"; die Zeitung wird ein Filter

**Entscheidung:** Der Nachtrag 2.15 wird auf einen Satz gekürzt. **In M15:** R-TECH-01,
R-TECH-02, R-DIP-06, R-BAT-08, R-AI-08, R-GAME-07, R-TIME-06. **Gestrichen:** R-NEWS-01,
R-NEWS-02, R-NEWS-03 — ersetzt durch einen Filter „Weltgeschehen" im bestehenden
Ereignisprotokoll, gespeist aus derselben Positivliste. **Nach M15 (M17):** R-SPY-01 bis
R-SPY-06, R-DIP-05, R-DIP-07.

**Begründung, mit den Zahlen:** 2.15 begründet sich selbst mit dem Satz *„Tag 1
unterscheidet sich von Tag 40 durch nichts als den Kontostand"* — und zwei Drittel seines
Umfangs beantworten diese Frage nicht. Von den 50 Akzeptanzkriterien des Nachtrags gehören
**16 zu R-SPY, also 32 %**; ein Spion ändert am Verlauf eines Tages nichts, den der Spieler
sonst durchklickt. Die Anforderung, die die Frage beantwortet, ist **R-TECH-01 mit 3 AK**:
ein Feld in den Regeldateien, eine Prüfung in `build.ts`/`recruit.ts`, ein Fehlercode, ein
Filter in `nextBuilding`. Das ist der beste Aufwand-Nutzen-Quotient im ganzen Nachtrag.

Die Zeitung geht aus zwei Gründen. Erstens verbietet ihr **R-NEWS-02 ausdrücklich alles,
was eine Entscheidung ermöglichen würde** — „nie Mengen, Vorräte, Truppen oder Gebäude"
(01-REQUIREMENTS.md:618-620). Was übrig bleibt, liegt bereits vollständig im
Ereignisprotokoll. Zweitens wäre sie teuer bezahlt worden: `HASH_OMIT_KEYS`
(packages/core/src/state/types.ts:296) nimmt vom Simulationshash genau **einen** Schlüssel
aus, `eventLog`. R-NEWS-01/AK1 verlangt aber, dass jede Ausgabe „im Spielstand liegt" —
Zeitungstext liefe damit in den Hash, den `save.ts:26`, der Golden-Master und die Wiedergabe
benutzen. Jede geänderte Schlagzeilenformulierung hätte Determinismus- und Replaytest
gebrochen, und zwar erst Wochen später und scheinbar grundlos.

**Auswirkung:** Der Ersatz kostet fast nichts, weil die Mechanik steht: `EVENT_FILTERS` und
`categoryOf` in `apps/desktop/src/ui/Panels.tsx:455-471` gibt es seit T-M13-13.
„Weltgeschehen" ist ein weiterer Eintrag in dieser Liste plus die Positivliste aus
R-NEWS-01 — kein neues Zustandsfeld, keine Migration, kein Hashrisiko, ein Tag statt einer
Woche. Was verloren geht, ist die Atmosphäre einer gedruckten Ausgabe; das ist der Preis.
Kommt die Zeitung in M17 doch, muss die Hash-Frage **zuerst** beantwortet werden, nicht
nebenbei. Der `scope`-Block bekommt für all das ein maschinenlesbares Fach je Meilenstein,
sonst zählt das Anforderungstor die verschobenen IDs weiter als V1-Pflicht (Befund 7).

---

## 2026-09-05 · M14 · Die Zielpartie bekommt Nachbarn, keinen amphibischen Umbau

**Entscheidung:** Die Standardpartie füllt ihre Gegner nach **Nachbarschaft** statt nach
Listenreihenfolge, und `rateProvinces` bekommt einen **Erreichbarkeitsfilter**. Ein
amphibischer Umbau der KI — Hafen und Werft in der Bauliste, Transporter in der
Aushebeliste, `MERGE_ARMIES`, Zielbewertung über See — wird in diesem Zug **nicht** gebaut.

**Begründung:** In der ausgelieferten Voreinstellung (`apps/desktop/src/game/newGame.ts`,
sieben Gegner in Kartenreihenfolge, Spieler = Vereinigte Staaten) fallen **0
Kriegserklärungen in 1000 Spieltagen**, und sieben von acht Mächten bewegen sich ab Tag 200
nicht mehr. Der Grund ist doppelt: kein Standardgegner hat eine Landverbindung zum Spieler,
und die KI kann kein Wasser überqueren — **3.046 von 4.464 Marschbefehlen** werden mit
`NO_PATH` abgelehnt, weil `hopDistance` (packages/ai/src/targeting.ts:26) Seewege wie
Landwege zählt, während der Kern den Weg mit `canUseSea` plant. AK-1 („eine vollständige
Partie gegen mindestens vier KI-Gegner") ist in dieser Aufstellung nicht schwer zu messen,
sondern **nicht messbar**: das zu messende Ereignis tritt nie ein.

Beide Hälften der billigen Kur sind Filter, keine neuen Fähigkeiten — die Gegnerauswahl
liest den Nachbarschaftsgraphen der Karte, die Zielbewertung fragt vorher, ob ein Weg
existiert. Der amphibische Umbau ist das Richtige für R-AI-01, aber er ist ein eigenes
Arbeitspaket mit eigenem Balancerisiko, und er darf nicht zwischen der V1 und ihrer
Abnahme stehen.

**Auswirkung:** Inselmächte bleiben handlungsunfähig; sie werden nur nicht mehr als
Standardgegner vorbelegt (Befund 31 bleibt offen, nicht in M14 und nicht in M15 — wann,
entscheidet der Stand nach der Abnahme). Die Zielpartie ist damit eine andere als die heute
vorbelegte, also müssen die Balancezahlen der Weltkarte an ihr neu gemessen werden — und
zwar erst, nachdem die Messgeräte repariert sind (Befunde 24, 25, 33, 45, 62). Erst danach
existiert AK-1 als Ereignis, das ein Test sehen kann.

---

## 2026-09-05 · R-ECON-03 · Zurückgenommen: Gebäude verbrauchen nichts

**Entscheidung:** R-ECON-03 wird auf das Gebaute gekürzt — „Armeen verbrauchen
Ressourcen." Die Gebäudehälfte entfällt aus der Anforderung und aus der Phasenzeile in
02-DESIGN.md. Gebäude bekommen in dieser Version kein `upkeep`-Feld.

**Begründung:** Nachgeprüft: `BuildingRule` (packages/core/src/rules/types.ts:32-44) hat
kein `upkeep`-Feld, `data/rules/default/buildings.json` folglich auch nicht, und
`phases/upkeep.ts:33-46` bildet die Nachfrage ausschließlich über `draft.armyOrder`. Nur
`UnitRule` trägt `upkeep` (types.ts:61). Die Zusage war nie gebaut — und sie nachzubauen ist
kein Feld, sondern ein Wirtschaftspaket: unbezahlter Unterhalt braucht eine Regel, was mit
dem Gebäude geschieht (aussetzen statt zerstören), also einen Zustand je Gebäude, also eine
Migration, dazu neue Zahlen in BALANCING.md — gemessen mit Messgeräten, die heute selbst
falsch messen.

**Auswirkung:** Die Wirtschaft behält genau eine laufende Senke: Armeeunterhalt. Wer nicht
kämpft, häuft an, und Kohle bleibt ohne laufenden Verbraucher (Befunde 26, 35). Das ist ein
echter Verlust an Spieltiefe im Frieden, und der Playtest wird ihn zeigen. Er steht ab jetzt
in der Anforderung, statt sich hinter einem grünen Haken zu verstecken.

---

## 2026-09-05 · T-M4-05 · R-UNIT-07 · Zurückgenommen: Einheiten haben keine Moral

**Entscheidung:** R-UNIT-07 wird auf Trefferpunkte gekürzt. Die Sätze in 02-DESIGN.md
(D6.8) und in T-M4-05, die Einheitenmoral wörtlich zusagen, entfallen.

**Begründung:** Nachgeprüft: ein Verband ist `{ unitKey, hpTotal }`
(packages/core/src/state/types.ts:156-159) — mehr trägt er nicht. Provinzmoral berührt ihn
genau einmal, bei der Aufstellung (`phases/recruitment.ts:48-52`). Eine zweite Moral
einzuziehen hieße: ein Feld je Verband, eine Drift je Spieltag, zwei Einflüsse
(Nahrungsmangel, Feindesland) und ein Schadensfaktor — und dieser Schadensfaktor ist genau
die Kurve, die dieses Projekt in T-M4-03 (Eintrag vom 2026-09-03) mit Begründung gestrichen
hat, weil der Trefferpunkte-Pool die Stärke bereits *ist*. Die Zusage nachzubauen hieße,
dieselbe Entscheidung ein zweites Mal zu treffen und diesmal anders.

**Auswirkung:** Der Zustand einer Armee bleibt eine einzige Zahl. Eine seit vierzig Tagen im
Feindesland stehende Armee ist so gut wie eine frische aus der Hauptstadt; es gibt damit
keinen Grund, Truppen heimzuholen. Kommt die Moral später, kommt sie als eigene Anforderung
mit eigener Zahl und eigenem Test — nicht als Halbsatz in einer alten.

---

## 2026-09-05 · T-M5-02 · R-PROV-03 · Zurückgenommen: Garnison unterdrückt keinen Aufstand, es gibt keine Aufständischen

**Entscheidung:** Zwei Zusagen aus T-M5-02 werden zurückgenommen: die Unterdrückung eines
Aufstands durch eine anwesende Garnison und die Aufständischen-Armee. Ein Aufstand bleibt,
was er heute ist — die Provinz fällt an niemanden (`owner = null`).

**Begründung:** Nachgeprüft: `settleMorale` (packages/core/src/phases/morale.ts:137-158)
liest `draft.armies` nirgends, und `revoltChance(morale, rules)` (:125) bekommt den
Provinzkontext gar nicht. Die Garnisonshälfte wäre billig; die Aufständischen sind es nicht:
`Army.owner` ist `PlayerId` (state/types.ts:163) und lässt eine besitzerlose Armee typseitig
nicht zu, während `Province.owner` (:128) `PlayerId | null` längst kennt. Ein
Rebellen-Eigentümer berührt damit den Vertrag jeder Kampfphase und braucht eine Migration.
**Nur die billige Hälfte zu bauen wäre die schlechtere Wahl:** eine Garnison, die den
Aufstand verhindert, ohne dass es Aufständische gibt, macht Moral zu einem Knopf, den man
mit Truppen abschaltet.

**Auswirkung:** Moral bleibt eine Einbahnstraße — sie sinkt, die Provinz geht verloren,
Truppen helfen nicht. Die Warnung „Aufstandsgefahr" kündigt damit etwas an, das der Spieler
nur vermeiden (durch Moralpflege), nicht abwenden kann (durch Besatzung). T-M5-02 verliert
zwei Zeilen seiner Definition-of-Done, und PROGRESS.md wird an dieser Stelle
richtiggestellt (Befunde 19, 63).

---

## 2026-09-05 · D14 · Zurückgenommen: es gibt keine E2E-Teststufe

**Entscheidung:** Die E2E-Zeile der Teststufentabelle (02-DESIGN.md:724, „E2E | Playwright
(Web-Build) | `apps/desktop/e2e/`") entfällt. Die drei Aufgaben, die e2e-Dateien als ihren
Testbeleg führen (tasks.yaml:703 `map-perf.spec.ts`, :753 `game-flow.spec.ts`, :804
`a11y.spec.ts`), bekommen den Beleg, den sie tatsächlich haben — oder verlieren ihr `done`.

**Begründung:** Nachgeprüft: `apps/desktop/e2e/` existiert nicht, und `playwright` steht in
keiner `package.json` und in keinem Lockfile. Die Stufe gab es nie. Sie jetzt einzuführen
heißt: eine zweite Testlaufzeit, ein Browser in der Prüfkette, eigene Zeitbudgets und eigene
Flakiness — Aufwand, der sich lohnt, wenn eine Anwendung Ende zu Ende steht, und der heute
an einer Anwendung gemessen würde, deren Auslieferungspfad selbst gerade erst entschieden
wurde. Der eigentliche Schaden ist ohnehin nicht die fehlende Stufe, sondern dass drei
erledigte Aufgaben ihren Beleg in einem Verzeichnis führen, das es nicht gibt.

**Auswirkung:** Was E2E geprüft hätte, prüft in der V1 der Playtest-Bogen — und der wird vor
der Abnahme um die Fragen ergänzt, die er heute nicht stellt: Fenster schließen und neu
öffnen, zweite Partie nach der ersten, Rückzug, Kampfbericht, Bauabbruch. Das Zeichnen misst
weiterhin kein Test: 141 von 249 Zeilen in `MapCanvas.tsx` laufen in keinem Test, weil
`getContext` in `App.test.tsx` `null` liefert (Befund 16). Das bleibt so — und es steht
jetzt geschrieben, statt als grüner Haken zu erscheinen.

---

## 2026-09-05 · T-M10-07a · R-GAME-02 · Zurückgenommen: der Zeitsieg ist keine wählbare Siegbedingung

**Entscheidung:** „Zeitlimit" entfällt aus R-GAME-02. Die V1 kennt zwei Siegbedingungen:
Punkte und Eroberung.

**Begründung:** Nachgeprüft: der Kern kann es (packages/core/src/rules/victory.ts:73-86),
aber `NewGameOptions.victory` (apps/desktop/src/game/newGame.ts:25) kennt nur `'points' |
'conquest'`, und `condition: 'time'` wird von **keiner** Produktionsdatei und **keinem** Test
gesetzt. Der Zweig ist zugleich unerreichbar und unbelegt; ihn an den Dialog zu hängen
hieße, ungeprüften Code scharfzuschalten. Der Weg dahin ist auch nicht der Schalter, sondern
das Eingabefeld für die Tage, die Vorgabe, die Anzeige der verbleibenden Zeit und ein Test
für den Ausgang an Tag N.

**Auswirkung:** Eine Partie lässt sich im Spiel nicht auf eine feste Länge begrenzen. Der
Startdialog verspricht dafür nichts mehr, was er nicht hält (Befund 39 ist damit erledigt,
ohne dass eine Zeile Code entsteht). Der kopflose Abnahmelauf setzt seine Obergrenze im
Test, nicht im Dialog. Der Zeitzweig im Kern bleibt zunächst stehen — **benutzt ihn der
Abnahmelauf nicht, ist er nach dem Maßstab dieses Projekts toter Code und gehört gelöscht**,
so wie unten `crossingFactor`.

---

## 2026-09-05 · R-BAT-03 · Zurückgenommen: kein Übergangsmalus für Flüsse und Meerengen

**Entscheidung:** „Fluss/Küste" entfällt aus R-BAT-03; die Verteidigungsboni der V1 sind
Festung und Gelände. `crossingFactor` (packages/core/src/rules/combat.ts:138-143) wird
gelöscht. Das Kartenfeld `crossing` bleibt in `world.json` — es beschreibt die Karte richtig
und kostet nichts.

**Begründung:** Nachgeprüft: `crossingFactor` hat im ganzen Repo genau einen Treffer, seine
eigene Definition — toter Code seit dem Tag, an dem er geschrieben wurde. Er hätte auch gar
nicht angewandt werden können: die Kampfphase weiß nicht, über welche Kante angegriffen
wurde. `phases/movement.ts:75` hält die benutzte Kante als `travelled`, verwertet sie aber
nur für `embarked` (:79) und schreibt sie nicht in den Zustand. Dazu die Karte selbst,
gezählt in `data/maps/world.json`: **633 Kanten ohne Übergang, 25 Meerengen, 0 Flüsse** —
Flüsse gibt es nur auf der Testkarte (packages/testkit/src/maps.ts). Die Zusage nachzubauen
hieße also, dem Zustand ein neues Feld zu geben (die zuletzt benutzte Kante je Armee), um
eine Regel anzuwenden, die auf der ausgelieferten Karte 25 Kanten beträfe.

**Auswirkung:** Eine Landung über die Meerenge kostet dasselbe wie ein Marsch über die
Ebene. Das ist ein spürbarer Verlust — Gibraltar, der Ärmelkanal und der Öresund sind genau
die Stellen, an denen ein Verteidiger einen Vorteil erwartet. Er wird in Kauf genommen, weil
der Landungsmalus sachlich zum Seetransport gehört und der Seetransport der KI ohnehin ein
eigenes Arbeitspaket ist (siehe den Eintrag zur Zielpartie); kommt er wieder, kommt er dort.
Bis dahin gilt: was gebaut liegen bleibt, wird nicht besser — deshalb wird die Funktion
gelöscht und nicht aufgehoben.
---

## 2026-09-06 · T-M14-09 · R-UI-04 · Die Schrift kommt mit, statt vorausgesetzt zu werden

**Entscheidung (Noah):** IBM Plex wird **eingebettet**. Vier `.woff2`-Schnitte plus die
OFL 1.1 werden von `github.com/IBM/plex` bezogen, unter `apps/desktop/src/ui/fonts/`
eingecheckt und von `app.css` über `@font-face` mit relativer `url()` geladen. Der zweite
Weg — auf Systemschriften umstellen und die Design-Freigabe nachführen — ist verworfen.

**Begründung:** Die Freigabe von T-M10-01 war eine Freigabe auf ein *Bild*. Richtung A
„Lagekarte" lebt von der schmalen Kartenschrift, und das Mockup lädt IBM Plex von Google
Fonts; das Spiel hatte keine einzige Schriftdatei und fiel auf `system-ui` zurück. Damit
wäre die erste Frage des Abnahme-Playtests („Sieht das Spiel aus wie Richtung A?") gegen
eine andere Schrift beantwortet worden als die freigegebene. Eine Freigabe auf ein Bild,
das anders gesetzt ist als das Erzeugnis, ist keine Freigabe auf das Erzeugnis.

**Warum das kein neuer Haltepunkt war:** Der einmalige externe Bezug läuft unter derselben
Freigabe, die T-M9-01 für die Geodaten erteilt hat — so steht es seit dem 2026-09-05 in
der Aufgabe selbst. Nachgefragt wurde trotzdem, weil ein Download in ein Repository etwas
anderes ist als ein Download in ein nicht eingechecktes Arbeitsverzeichnis: die Bytes
bleiben.

**Auswirkung:** 208,1 kB im Repository (die Aufgabe zog die Grenze bei 400 kB).
`scripts/fetch-fonts.mjs` hält Quelle, Version, Lizenz und je Datei eine SHA-256-Summe
fest; `--check` prüft das Eingecheckte, ohne etwas zu laden. Zur Laufzeit ändert sich
nichts an R-FREE-04: es gibt weiterhin keinen Netzaufruf, die Dateien liegen bei.

---

## 2026-09-06 · R-ARCH-06 · Das Tickbudget wird auf einen gemessenen Wert gesetzt

**Entscheidung (Noah):** R-ARCH-06/AK1 bekommt statt der Entwurfszahl 0,5 ms einen
**nachgemessenen** Wert, und die Zusicherung im Weltkarten-Bench wird auf diesen Wert
geschärft. Der Kern wird nicht optimiert, um eine nie nachgerechnete Zahl zu halten.

**Begründung:** Die 0,5 ms stammen aus der Entwurfsphase und tragen im Anforderungstext
ihre eigene Begründung — „nur so ist die interaktive Betriebsart erreichbar". Diese
Begründung ist nachgerechnet falsch: R-TIME-02 verlangt bis zu 100 Spielstunden je Sekunde,
also rund 100 Ticks je Sekunde, und bei den gemessenen 2,463 ms je Tick sind rund 400
möglich. Die Anforderung fordert damit das Achtfache dessen, was sie begründet.

**Warum das keine Selbstfreisprechung ist:** Der eigentliche Befund war nicht die verfehlte
Zahl, sondern dass **keine Prüfung sie je gemessen hat**. Der Weltkarten-Bench sicherte
8 ms zu — das Sechzehnfache, also eine Erlaubnis statt einer Prüfung; der zweite Bench
prüfte gegen die Zahl der Anforderung, aber an 12 Provinzen statt 200. Beide grün, keiner
aussagekräftig. Ein angehobenes Budget ohne scharfe Zusicherung wäre derselbe Fehler in
neuer Höhe, deshalb gehört zur Entscheidung zwingend, dass der Bench den neuen Wert eng
hält und der Bericht Anforderung, Messung und Abstand nebeneinander ausweist.

**Auswirkung:** Die Anforderung sagt ab jetzt, was das Spiel wirklich braucht, und ein
Rückschritt in der Rechenzeit fällt auf, statt in einem sechzehnfachen Spielraum zu
verschwinden. Für den Spieler ändert sich nichts — die interaktive Betriebsart war schon
vorher erreichbar.

---

## 2026-09-06 · T-M15-04 · R-GAME-07 · Ein Migrationsschritt für den ganzen Meilenstein

**Entscheidung:** `SCHEMA_VERSION` geht auf **2**, und `MIGRATIONS` enthält **genau einen**
Schritt 1 → 2. Dieser Schritt legt **alle** Zustandsfelder von M15 leer an — das
Betroffenenfeld an jedem Protokolleintrag (T-M15-01), das Verstimmungs-Record (T-M15-05)
und die Feuerleitung jeder Armee (T-M15-07). T-M15-05 und T-M15-07 füllen ihre Felder mit
Verhalten und erhöhen die Version **nicht** ein zweites Mal.

**Begründung:** Drei Schritte für einen Meilenstein hießen drei eingefrorene Stände, drei
Prüfpfade und einen Formatwächter, der sich mit sich selbst streitet: er sichert zu, dass
`SCHEMA_VERSION` genau um eins größer ist als die höchste Stufe in `MIGRATIONS`, und wäre
zwischen zwei Aufgaben regelmäßig rot. Der Preis ist, dass T-M15-04 Felder anlegt, die es
selbst nicht benutzt — sichtbar in `state/types.ts`, wo beide Felder ihren künftigen
Besitzer namentlich nennen. Das ist die ehrlichere Seite des Tauschs: ein leeres Feld mit
Adresse ist auffindbar, eine vierte Schemastufe im Nachhinein nicht mehr rückgängig.

**Auswirkung:** Der Umschlag ist die **führende** Versionsnummer; `deserialise` erzwingt,
dass `state.schemaVersion` mit ihr übereinstimmt, und lehnt sonst ab (Befund 56 — es gab
zwei Nummern und nur eine wurde geführt). Dazu hat seit heute **jeder** Ladeweg eine
Prüfung: nach einer Migration `validateState`, ohne Migration die Prüfsumme, ohne beides
eine Ablehnung. Vorher hing die einzige Prüfung an einem Hash, den `migrate` selbst
entfernt — ab dem ersten echten Migrationsschritt wäre jeder migrierte Stand ungeprüft
durchgelaufen (Befund 55).

---

## 2026-09-06 · R-GAME-07 · Zurückgenommen: die Migration kennt keine Spione und keine Zeitung

**Entscheidung:** Aus dem Text von R-GAME-07 werden **Spione, Aufklärung, Angebote und
Zeitung** gestrichen; genannt werden die drei Felder, die in M15 tatsächlich entstehen.

**Begründung:** Spionage ist am 2026-09-05 nach M17 verschoben (Entscheidung 3), die
Zeitung ist durch den Filter „Weltgeschehen" ersetzt, der **kein** Zustandsfeld braucht
(D19.8), und die Angebote liegen seit T-M14-12 in `PublicView`, gespeist aus
`state.diplomacy.offers` — auch kein neues Feld. Eine Anforderung, die Felder nennt, die
in ihrem Meilenstein nicht entstehen, ist entweder unerfüllbar oder wird stillschweigend
kleiner gelesen, als sie dasteht. Genau das war der Fehler des Nachtrags 2.15, den
T-M14-01 behoben hat; ihn hier zu wiederholen wäre unentschuldbar.

**Auswirkung:** R-GAME-07 bekommt zusätzlich ein **AK2** für das, was diese Aufgabe
wirklich leistet und was vorher in keiner Anforderung stand: kein Ladeweg ohne Prüfung.

---

## 2026-09-06 · T-M15-06 · R-TIME-06 · Eine Spielschleife, und der Worker-Host wird gelöscht

**Entscheidung (Noah):** Weg **(b)**. Die Schleife in `apps/desktop/src/App.tsx` bekommt
echtes Vorspulen über `fastForward` des Kerns; `apps/desktop/src/sim/` — SimEngine, SimHost,
worker, protocol, zusammen **521 Produktionszeilen und 371 Testzeilen** — wird gelöscht.
Weg (a), den Worker-Host zu verdrahten, ist verworfen.

**Der Befund, der die Entscheidung nötig machte:** Der Vorspulknopf ruft den Kern nicht auf.
`App.tsx` und die Taste `F` rechnen `step(ticksPerDay)`, also genau einen Spieltag;
`fastForwarding` steht hart auf `false`, wodurch der Abbruchzweig in `ui/Header.tsx` toter
Code ist; und `fastForward` aus `packages/core/src/clock.ts` wird in `apps/desktop/src` an
**keiner** Stelle gerufen. Der einzige Aufrufer ist `sim/SimEngine.ts`, den nichts startet.
**Ziel Z1 — die frei regelbare Spielgeschwindigkeit, das erste erklärte Produktziel — ist
damit halb eingelöst, und R-TIME-02 wurde ausschließlich gegen Code geprüft, den kein
Spieler ausführt.**

**Warum (b):**

1. **T-M14-04 hat genau diesen Fehler behoben.** Es gab vier Spielschleifen; die des
   Parameterlaufs fragte die KI einmal je Spieltag, wodurch bei sechs Mächten nur die erste
   dachte, und jede Balancezahl beschrieb eine Welt, in der fünf von sechs stillstehen. Den
   Worker-Host zu verdrahten hieße, die zweite Schleife wieder einzuführen — vier Wochen
   nachdem sie mit einem eigenen Wächter (`single-loop`) verboten wurde.
2. **Der Host hat nie gelaufen.** „521 Zeilen retten" rettet Code, den kein Spieler je
   ausgeführt hat. Der Test dazu prüft eine Schnittstelle, kein Verhalten.
3. **Er kann die KI gar nicht.** `SimEngine.ts` importiert nichts aus `@worldwar/ai`; sein
   `commandSource` kann `storeMemories` nicht ausführen. Beim Vorspulen verlöre die KI ihr
   Gedächtnis — R-AI-07 wäre gebrochen, und zwar nur in der Betriebsart, in der niemand
   hinsieht. Das zu reparieren wäre der eigentliche Preis von (a), und er steht nicht in
   den 521 Zeilen.

**Der Preis, offen benannt:** Das Vorspulen rechnet im Hauptthread. Bei den gemessenen
2,463 ms je Tick auf der Weltkarte sind 1000 Spieltage rund **59 Sekunden Rechenzeit**. In
Häppchen mit freigegebener Ereignisschleife bleibt die Oberfläche bedienbar und der
Abbruch erreichbar — aber nebenher läuft es nicht. Wer das später anders will, baut den
Worker gegen die *bestehende* Schleife und nicht neben ihr; das ist ein Thema für M16, wo
die Leistung am echten Bau ohnehin neu zu messen ist.

**Was mitgeht:** T-M10-04 (Kopfleiste mit Vorspulmenü) ist seit T-M14-02 auf `todo`
zurückgestuft und wird von dieser Aufgabe geschlossen.

---

## 2026-09-06 · T-M15-09 · R-NEWS-01/02/03 · Die Zeitung ist gestrichen, der Ersatz steht

**Entscheidung:** Die drei Zeitungsanforderungen sind am 2026-09-06 **ersatzlos aus
`01-REQUIREMENTS.md` entfernt** — Text, `scope`-Einträge und Bezüge. An ihrer Stelle steht
R-NEWS-04, der Filter „Weltgeschehen" im Ereignisprotokoll, und er ist gebaut.

**Warum jetzt und nicht früher:** Eine Zusage verschwindet nicht, bevor das da ist, was an
ihre Stelle tritt. Seit dem 2026-09-05 stand über den drei Anforderungen ein Vermerk, dass
sie nicht gebaut werden und T-M15-09 sie mit ihrem Ersatz streicht; genau das ist jetzt
geschehen. Umgekehrt bleibt eine Anforderung, die niemand mehr baut und die trotzdem
ausformuliert im Anforderungsdokument steht, beim nächsten Lesen wieder eine Zusage —
und das Anforderungstor zählte sie mit.

**Die Rechnung, in einem Satz:** R-NEWS-02 verbot der Zeitung ausdrücklich Mengen, Vorräte,
Truppen und Gebäude; was danach übrig bleibt, ist eine Positivliste von acht Ereignisarten,
und die liegt vollständig im Ereignisprotokoll, dessen Filterbarkeit R-GAME-06 seit M5
fordert.

**Der versteckte Preis, den der Filter nicht hat:** Eine Ausgabe, die „im Spielstand liegt"
(R-NEWS-01/AK1), wäre ein neues Zustandsfeld mit Ringpuffer, eine Migration — und sie liefe
in den **Simulationshash**: `HASH_OMIT_KEYS` nimmt allein `eventLog` aus. Jede spätere
Umformulierung einer Schlagzeile hätte Golden-Master und Wiedergabe gebrochen. Nachweis,
dass der Filter diesen Preis wirklich nicht zahlt: `git diff` über beide Golden-Verzeichnisse
ist nach dieser Aufgabe **leer**.

**Was beim Bauen dazukam und nicht im Plan stand:** Drei Sätze des Protokolls tragen ein
stillschweigendes „ich" — „Verhältnis zu X", „Die Hauptstadt ist verloren", der
Kampfbericht mit Verlusten. Aus fremder Sicht sind sie falsch beziehungsweise verraten
mehr, als R-DIP-04 erlaubt. Es gibt jetzt vier Fassungen mit der Endung `_FOREIGN`, gewählt
über `concerns` — dieselbe Angabe, die seit T-M15-01 am Ereignis steht.

---

## 2026-09-06 · T-M15-08 · R-AI-08 · Zurückgenommen: die KI wirbt in M15 keine Spione an

**Entscheidung:** Aus R-AI-08 werden **Gegenspionage, Aufklärung und Sabotage** gestrichen;
AK1 (Gegenspion in der Hauptstadt) und die Spionageklausel aus AK3 sind entfernt. Die drei
Akzeptanzkriterien nennen jetzt Angebote, Zahlungsfähigkeit und die Kette
Fabrik → Artillerie → selbsttätiger Beschuss.

**Begründung:** Spionage ist am 2026-09-05 mit R-SPY-01…06 nach M17 verschoben
(Entscheidung 3). Eine Anforderung, die Ereignisse einer Mechanik verlangt, die in ihrem
Meilenstein gar nicht gebaut wird, ist nicht streng — sie ist unerfüllbar, und das
Integrationstor hätte nie zumachen können. Genau dieser Fehler hat schon einmal das
Anforderungstor auf 82 von 100 gedrückt und die Abnahme unerreichbar gemacht (Nachtrag
2.15, behoben von T-M14-01); ihn hier zu wiederholen wäre unentschuldbar.

**Was an die Stelle tritt, ist strenger, nicht milder.** AK3 verlangt jetzt eine **Kette**,
die vorher niemand geprüft hat: Fabriken, Artillerie **und** selbsttätigen Beschuss. Sie
war zum Zeitpunkt der Formulierung nachweislich **gerissen** — auf der Testkarte an der
Fabrik, auf der Weltkarte an der Aushebung. Beides ist mit dieser Aufgabe behoben und
gemessen (`docs/reports/ai-integration.json`).
