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
