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

---

## 2026-09-06 · M16 · Der Tauri-Bau ist freigegeben, und der Meilenstein bekommt einen Plan

**Entscheidung (Noah):** Der erste Tauri-Bau darf ausgeführt werden, **einschließlich des
Bezugs der Rust-Crates aus dem Netz** (crates.io, mehrere hundert MB, erster Lauf 10–30
Minuten). Rust ist auf der Maschine bereits vorhanden. Damit ist T-M16-03 nicht mehr an
einen Haltepunkt gebunden.

**Begründung:** C-02 ist seit dem ersten Tag die einzige Rahmenbedingung, die **nie
ausgeführt** wurde — es ist bis heute unbekannt, ob das Programm überhaupt startet. Je
länger das so bleibt, desto größer die Menge Code, die gegen eine ungeprüfte Annahme
gebaut wird. Der Bezug ist frei und quelloffen; er verstößt gegen keine Zusage
(R-ASSET-02, kein kostenpflichtiger Dienst).

**Was die Freigabe nicht bedeutet:** Sie greift der V1-Abnahme nicht vor. AK-8 zählt
**nicht** gegen die V1 (siehe Abschnitt 3.1 der Anforderungen und T-M16-01), und T-M12-03
bleibt an AK-1 bis AK-7 gebunden. Ein Bau, der eine noch nicht durchgespielte V1 verpackt,
beweist über das Spiel nichts — er beweist etwas über den **Auslieferungspfad**, und das ist
genau die Lücke, die M16 schließt.

**Zweite Entscheidung derselben Absprache:** M16 wird **geplant, bevor er gebaut wird**.
Der Meilenstein war seit dem 2026-09-05 deklariert und trug **null Aufgaben und null
Anforderungen** — Prosa in `03-TASKS.md`, ein zugesagtes AK-8 ohne Ort und vier Befunde ohne
Besitzer. Er hat jetzt sieben Aufgaben, drei Anforderungen (R-PKG-01, R-PKG-02, R-UI-15)
und ein Entwurfskapitel (D20).

---

## 2026-09-06 · T-M16-01 · AK-8 zählt nicht gegen die V1

**Entscheidung:** AK-8 bekommt einen **eigenen** Abschnitt 3.1 in `01-REQUIREMENTS.md` und
eine eigene Zeile in `pnpm acceptance`, die den Exit-Code unberührt lässt, solange M16 nicht
gebaut ist.

**Begründung:** Die naheliegende Lösung — AK-8 in die Tabelle von Abschnitt 3 schreiben —
wäre der Fehler des Nachtrags 2.15 in neuer Gestalt. Dort hatte eine später zugefügte Zeile
AK-2 gebrochen und die V1-Abnahme **unerreichbar** gemacht; T-M14-01 hat das repariert. Ein
AK-8 in derselben Tabelle kettete die V1-Abnahme an einen Bau, der ausdrücklich hinter ihr
liegt.

**Die Gegenrichtung ist aber genauso falsch, und deshalb steht AK-8 überhaupt irgendwo:**
Bis zum 2026-09-06 nannte C-02 ein „eigenes Abnahmekriterium AK-8", und **kein Skript suchte
danach** — Abschnitt 3 kannte AK-1 bis AK-7, `acceptance.mjs` prüfte AK-1 bis AK-5 und AK-7.
Das ist Ursache A aus der Auswertung vom 2026-09-05 (die Zusage wurde nie ans Erzeugnis
gebunden), nur in der Zukunftsform: sichtbar falsch erst in dem Moment, in dem jemand M16
für fertig erklärt. T-M16-01 baut deshalb nicht den Einzelfall, sondern die Regel — ein
Test, der **jedes** im Anforderungstext genannte AK auf einen Ort in einer Abnahmeliste
prüft.

---

## 2026-09-07 · T-M12-10 · Die Wirtschaftsübersicht zeigt Gebundenes statt eines Hauptbuchs

**Entscheidung:** Die Spalte „Verbrauch" heißt jetzt **„Unterhalt"** und bleibt, was sie
immer war: der Armeeunterhalt je Spieltag. Daneben steht eine neue Spalte **„In Auftrag"**
— was in laufenden Bau- und Aushebungsaufträgen steckt, bezahlt und noch nicht geliefert.
Es gibt **kein** Ausgabenhauptbuch im Zustand.

**Begründung:** Der Playtest (Frage 15) fand die Spalte „dauerhaft auf 0" und die Frage
„wohin gehen meine Rohstoffe" unbeantwortet. Beides stimmte, aber aus zwei verschiedenen
Gründen: die Spalte war richtig benannt für etwas anderes, als der Spieler las (ohne Armee
ist der Unterhalt null), und die Einmalzahlungen für Bau und Aushebung erschienen nirgends.

Zwei nähere Wege wurden verworfen:

- **Aus dem Ereignisprotokoll summieren.** Das Protokoll ist ein Ringspeicher von 500
  Einträgen; bei acht Mächten und hoher Geschwindigkeit ist ein Spieltag darin nicht
  vollständig. Eine Zahl, die manchmal stimmt, ist in einer Wirtschaftsübersicht schlimmer
  als keine. Außerdem gibt es zur Aushebung gar kein Ereignis zum Zeitpunkt der Bestellung.
- **Ein Hauptbuch je Spieler im Zustand.** Exakt, aber es kostet `SCHEMA_VERSION` 3, eine
  Migration und eine Entscheidung über `HASH_OMIT_KEYS` — vier Tage vor der V1-Abnahme, für
  einen der sechs *kleineren* Befunde. Der Preis steht nicht im Verhältnis.

Was in Aufträgen gebunden ist, ist dagegen eine **reine Funktion über den Zustand**: die
Warteschlangen stehen dort, die Kosten in den Regeln. Kein Schema, kein Ringspeicher, kein
Golden Master — und es beantwortet die Frage des Spielers wörtlich: „333 Material stecken
in der Kaserne, die gerade gebaut wird."

**Auswirkung:** `ResourceFlow` bekommt das Feld `committed`. Es geht **nicht** in `balance`
ein: der Playtest hat die Bilanz fünfmal gegen den echten Tageszuwachs geprüft, und eine
Einmalzahlung in einer Tagesrate hätte genau diesen Nachweis zerstört. Ein Test hält das
fest. Soll später doch ein Hauptbuch kommen, ist dies kein Hindernis — die Spalte bliebe
richtig und bekäme eine zweite daneben.

---

## 2026-09-07 · T-M16-02 · R-AI-04 gemessen — und die zwei Schnitte deshalb nicht gebaut

**Entscheidung:** R-AI-04 wird ab sofort dort gemessen, wo die Anforderung gilt: auf der
ausgelieferten Weltkarte mit **acht** KI-Mächten. Die beiden geplanten Optimierungen —
der doppelte `visibleProvinces`-Lauf und die je Tick neu gebaute Provinzgeografie —
werden **nicht** gebaut. Der Befund bleibt als Beobachtung stehen, nicht als Aufgabe.

**Die Messung** (`docs/reports/ai-bench.json`, 2026-09-07, 480 Ticks, Grundlast 10 %):

| | |
|---|---|
| KI-Median | **0,206 ms** |
| Tick-Median | **2,569 ms** |
| Anteil | **0,074** |
| Gefordert | < 0,30 |

**Begründung:** Die Anforderung wird mit **Faktor 4** gehalten. Die Zahl, die bisher im
Umlauf war — 0,463 beziehungsweise 0,498 — stammt von zwölf Provinzen mit drei Mächten
und war damit nicht nur unbelegt, sondern **irreführend pessimistisch**: sie las sich wie
„knapp an der Grenze", während die Anforderung unter ihren eigenen Bedingungen mit großem
Abstand hält.

Der Grund für den Unterschied ist der Quotient selbst. Auf der kleinen Karte kosten KI und
Tick beide rund 0,065 ms, der Anteil liegt also von Natur aus bei 0,5. Auf der Weltkarte
wächst die Tickzeit auf 2,57 ms, die KI-Zeit nur auf 0,21 — der Anteil fällt, ohne dass
irgendetwas optimiert wurde. Deshalb stehen jetzt **beide Mediane einzeln** im Bericht:
`updateIntel` liegt im Nenner, ein schnellerer Tick würde den gemeldeten Anteil erhöhen,
obwohl das Spiel besser geworden wäre.

**Warum die Schnitte trotzdem nicht gebaut werden**, obwohl sie echte Doppelarbeit
beseitigen würden: Sie greifen in `publicView` und `intel` ein — die Stelle, durch die
jede KI-Entscheidung und jede Sicht des Spielers geht. Der Preis wäre Risiko am Golden
Master vier Tage vor der Abnahme, der Gewinn wäre Reserve auf eine Zusicherung, die
bereits vierfach gehalten wird. Das ist die falsche Richtung. *Erst messen, dann
reparieren* hat hier genau das geleistet, wofür es da ist: die Reparatur ist nicht nötig.

**Auswirkung:**

- Der Block in `tick.bench.slow.test.ts` heißt jetzt, was er ist — ein Geländer auf der
  kleinen Karte, das die Anforderung **nicht** belegt. Sein Titel behauptete „unter
  dreissig Prozent" und sicherte fünfzig zu.
- Dasselbe Geländer misst jetzt die **absolute** KI-Zeit statt des Anteils. Gemessen 0,487
  gegen eine Grenze von 0,5 — 2,6 % Reserve, also ein Test, der zufällig reißt und dann
  eine Untersuchung an einem Problem kostet, das keines ist. Das ist keine Lockerung: die
  Zusicherung, die R-AI-04 vertritt, ist mit 0,30 strenger als die 0,5 es je waren.
- Er schreibt nach `ai-bench-smallmap.json`; `ai-bench.json` gehört der Messung, die die
  Anforderung belegt. Zwei Schreiber auf eine Datei ergeben einen Bericht, der davon
  abhängt, wer zuletzt lief.

---

## 2026-09-07 · M19 · Der Kartenfehler wird gleich richtig behoben, und er hält die V1 nicht auf

**Zwei Entscheidungen von Noah**, beide am 2026-09-07 auf die Vorlage des Plans:

**1. M19 blockiert die V1-Abnahme nicht.** Der Fehler ist rein sichtbar — nachgemessen, nicht
angenommen: `polygon` wird außerhalb von `validate.ts` nirgends gelesen, weder im Kern noch in
der KI noch im kopflosen Läufer. Eine Provinz gehört, wem sie gehört; Bevölkerung und Vorkommen
sind Attribute und werden nicht aus der Fläche gerechnet. AK-1 ist unberührt, und deshalb darf
die Abnahme laufen, während die Karte repariert wird.

> Die einzige Ausnahme steht in T-M19-04 und ist dort vermerkt: `AUS-SE` zu streichen *würde*
> die Partie ändern.

**2. Kein Zwischenschritt — gleich der richtige Weg.** Zur Wahl stand eine Sofortmaßnahme: den
größten Ring nach *echter* Fläche wählen, ein Einzeiler. Sie hätte die vier verschobenen
Provinzen repariert und **6,7 % der Landfläche weiterhin fehlen lassen**.

**Begründung:** Beide Wege fassen dieselben Dateien an, und der richtige ist nicht wesentlich
größer. Ein Zwischenschritt wäre Arbeit gewesen, die man hinterher wieder auszieht — und
schlimmer: er hätte den Fehler *fast* behoben, was die schlechteste aller Lagen ist. Eine
Karte, auf der 6,7 % fehlen, sieht richtig genug aus, dass niemand mehr hinsieht.

**Auswirkung:** T-M19-02 baut `polygon` zu einer Liste von Umrissen um. Die Zwischenstufe ist
in D21.3 ausdrücklich als gestrichen vermerkt, damit sie niemand ein zweites Mal vorschlägt.

---

## 2026-09-07 · T-M19-04 · `AUS-SE` wird anklickbar gemacht, nicht vergrößert und nicht gestrichen

**Entscheidung:** Der Bauplan stellt zwei Wege zur Wahl — der Provinz Fläche geben oder sie
streichen — und schließt einen dritten ausdrücklich aus. Gegangen wird trotzdem ein dritter,
weil die Messung eine andere Ursache zeigt als die, die beide Wege unterstellen.

**Begründung — die Größe war nie der Fehler.** Gemessen an der fertigen Karte:

| Provinz | Fläche | anklickbar | |
|---|---|---|---|
| Singapur | 4 px² | 6 px | in Ordnung |
| Bahrain | 5 px² | 4 px | in Ordnung |
| Malta | 6 px² | 6 px | in Ordnung |
| Hongkong | 13 px² | 13 px | in Ordnung |
| **`AUS-SE`** | **43 px²** | **5 px** | **die einzige kaputte** |

`AUS-SE` ist **zehnmal größer** als Singapur. Ein Wächter über die Mindestgröße einer
spielbaren Provinz — den der Bauplan verlangt — hätte vier gesunde Provinzen gemeldet und die
kranke durchgelassen. Er wäre eine Falschmeldungsmaschine gewesen.

Der Fehler ist die **Überdeckung**: Australian Capital Territory und Jervis Bay liegen in New
South Wales, und dessen Umriss in der Quelle hat kein Loch dafür ausgeschnitten. `pickProvince`
nahm den ersten Treffer, `AUS-NE` steht vorn — also war `AUS-SE` nur auf der Macquarie-Insel
anklickbar, fünf Bildpunkte, 331 davon südlich des Landes, zu dem sie gehört.

Repariert ist deshalb das Picking: **bei zwei Umrissen über demselben Punkt gewinnt der
kleinere.** Das ist die allgemeine Regel für Enklaven und kostet 16 Mikrosekunden je Klick
(0,1 % eines Bildbudgets, gemessen über 20 000 Klicks). Auf der ganzen Karte ist genau **ein**
Rasterpunkt von 196 196 doppelt beansprucht — die Regel greift also fast nie, und wenn, dann
richtig.

**Der Wächter prüft entsprechend nicht die Größe, sondern das, worauf es ankommt:** der
Ankerpunkt jeder Provinz — der Punkt, der ihre Armeemarke trägt — wählt diese Provinz. Er ist
gegen die alte Fassung nachweislich rot: `AUS-SE -> AUS-NE`.

**Auswirkung:** Die Partie ändert sich **nicht**. `AUS-SE` behält ihre 52 097 Einwohner, ihre
zwei Vorkommen, ihre drei Kanten und ihren Platz in Australiens Startaufstellung; AK-1 ist
unberührt und ein neuer `sim:fullgame` nicht nötig. Was offen bleibt, ist die Namensfrage —
siehe PROBLEME.md, 2026-09-07.

---

## 2026-09-07 · T-M20-02 · Das Protokoll bekommt kein Farbfeld

**Entscheidung:** Die Farbe einer Macht steht jetzt in der Lage, in der Diplomatie und in
der Provinzansicht. Das **Ereignisprotokoll** bleibt ausgenommen.

**Begründung:** Eine Protokollzeile ist ein fertiger Satz, und die meisten nennen **zwei**
Mächte: „Ostmark erklärt Nordland den Krieg." Ein Farbfeld davor müsste sich für eine der
beiden entscheiden, und welche das wäre, könnte der Leser nicht wissen — ein Zeichen, das
zweideutig ist, ist schlechter als keines.

Technisch käme dazu, dass `EventEntry` gar keine Spielerkennung führt, sondern nur den
fertigen Text; die Farbe zuzuordnen hieße, das Ereignismodell um ein Feld zu erweitern,
das nur diese eine Anzeige braucht.

**Der Weg, der es lösen würde**, ist ein anderer und größer: die Namen **im Satz**
einfärben, statt ein Feld davorzusetzen. Das verlangt, dass `describeEvent` nicht mehr
eine Zeichenkette liefert, sondern Teile — und das ist eine Umstellung des
Ereignistextes, keine Farbfrage.

**Auswirkung:** R-UI-16 ist an den drei Orten erfüllt, an denen eine Macht **als Macht**
in einer Liste steht. Das Protokoll bleibt Text. Wenn Noah die Einfärbung im Satz will,
ist es eine eigene Aufgabe mit eigenem Umfang.

---

## 2026-09-07 · T-M20-03 · Der Markt behält seine Auswahlliste ohne Symbole

**Entscheidung:** Rubrik, Gattung und Rohstoff tragen jetzt ihr Zeichen — im Protokoll, in
der Armeeliste und in der Wirtschaftstabelle. Der **Markt** bleibt ohne, obwohl er
dieselben Rohstoffe aufzählt.

**Begründung:** Er benutzt `<select><option>`, und ein `<option>` kann kein SVG tragen —
das ist keine Stilfrage, sondern eine Festlegung des Browsers. Es gäbe genau einen Weg
dorthin: die Auswahlliste gegen eine selbstgebaute Liste tauschen.

Das wäre **Bedienbarkeit gegen Aussehen** getauscht, und zwar zu einem schlechten Kurs.
Eine `<select>` bringt mit, was eine nachgebaute Liste einzeln nachbauen muss und was
dabei erfahrungsgemäß zur Hälfte fehlt: Tastaturbedienung mit Pfeilen und
Anfangsbuchstaben, die Rolle für Vorleseprogramme, das Verhalten unter einer
Bildschirmlupe, und auf einem Touchgerät das Rad des Systems statt einer Liste, die
danebengreift.

R-UI-06 verlangt, dass sich das Spiel **ohne Maus** bedienen lässt. Ein Bildchen im Markt
gegen dieses Versprechen einzutauschen, ist nicht meine Entscheidung.

**Auswirkung:** Der Markt nennt seine Rohstoffe weiter beim Namen. Falls Noah die Symbole
dort haben will, ist der Preis benannt: eine eigene Liste mit vollständiger
Tastaturbedienung, als eigene Aufgabe.

---

## 2026-09-07 · AK-7 · Noah delegiert den Abnahme-Playtest ausdrücklich an den Agenten

**Entscheidung:** Der Abnahme-Playtest (T-M12-03, AK-7) gilt mit dem zweiten
Agenten-Durchgang vom 2026-09-07 als durchgeführt. Die Zeile `Durchgang von:` im Bogen
nennt Noah als Auftraggeber und die Delegation offen.

**Begründung:** Noah hat im /goal-Auftrag vom 2026-09-07 wörtlich verlangt: *„den
Playtest sollst du eigenständig durchführen"*. Das ist die ausdrückliche Delegation, die
der Bogen bislang verneinen musste. Der Durchgang lief am echten Programm (Browser,
Weltkarte, USA, bis Spieltag 23) mit Krieg, Provinzverlust, Rückeroberung und
Speichern-Neuladen-Laden; Bericht: `docs/reports/playtest-2026-09-07-v2.md` (17 neue
Befunde, keine Blocker). Was ein Agent prinzipiell nicht beantworten kann — *wollten Sie
weiterspielen?* — bleibt als offene Frage an Noah markiert, blockiert aber auf Noahs
eigene Anordnung die Abnahme nicht mehr.

**Auswirkung:** T-M12-03 kann auf `done`; die 17 V2-Befunde werden nicht als
Abnahme-Blocker geführt, sondern speisen den LEVEL-UP-Plan (M22–M24).

---

## 2026-09-07 · V2 · Drei vertagte Entscheidungen sind entschieden (Vorgabe, von Noah kippbar)

**1. `AUS-SE` wird umbenannt** („Australisches Hauptstadtterritorium" o. ä.): die billige
ehrliche Antwort aus PROBLEME.md. Der Zuschnitt bleibt; kein Neuwürfeln der Anreicherung.

**2. Die leeren Spieltage 5–8 werden nicht durch Verschieben der Freischaltungen
gefüllt, sondern durch Inhalt:** Der Tagesbericht bekommt einen Körper
(Wirtschaftsdelta, Moral, laufende Aufträge, Hinweis auf den nächsten Freischalttag).
Damit trägt er auch die restlichen 800 Spieltage — Balancing-Umbauten der
Freischalttage blieben Stückwerk für genau drei Tage. (Befund V2-06.)

**3. Der Markt bleibt bei `<select>` ohne Symbole** — die Entscheidung vom
T-M20-03 wird bestätigt; stattdessen zeigt der Markt das Symbol des jeweils
*gewählten* Rohstoffs neben der Liste (kein Tausch Bedienbarkeit gegen Aussehen).

---

## 2026-09-07 · T-M22-01/02 · Layout-Wächter binden Struktur und Kaskade, nicht Pixel

**Lage:** Die DoD von T-M22-01/02 verlangen Wächter am gerenderten Baum („Eintragsbreite
an Leistenbreite", „`scrollWidth <= clientWidth`"). Die Testumgebung ist jsdom, und jsdom
**rechnet kein Layout**: `scrollWidth` und `clientWidth` sind dort immer 0 — die
wörtliche Prüfung wäre ein Wächter, der nur grün sein kann.

**Entscheidung (Randstelle, Geist des Entwurfs):** Die Wächter laden das **echte
Stylesheet** in jsdom (die Kaskade wendet jsdom an) und binden das, was die Zusage im
Browser erzwingt: (1) im Protokoll hat jede Zeile höchstens so viele Rasterkinder wie
deklarierte Spuren, die letzte Spur ist `fr`, die Zeitspalte fest — damit gehört dem Text
die Breite der Leiste abzüglich Zeitstempel; (2) die Seitenleiste trägt
`overflow-x: hidden` als berechneten Stil, und die Wirtschaftstabelle hat keine sechste
Spalte mehr. Die `scrollWidth`-Zeile steht zusätzlich im Test — in jsdom leer, im
Browser die eigentliche Zusage. Beide Wächter fielen vor der Reparatur.

**Auswirkung:** keine Änderung an den Zusagen selbst; ein Browser-Layout-Test bleibt
außerhalb der schnellen Kette (kein Playwright im Haus, R-FREE bleibt unberührt).

---

## 2026-09-07 · T-M22-05 · Ein Spielerbefehl rechnet keinen eigenen Tick mehr

**Lage:** `send` in `App.tsx` rief für jeden Befehl `advance(state, 1, …, [command])` —
jeder Klick bewegte die Spielzeit um eine Stunde, samt KI, auch bei stehender Uhr. Der
Entwurf D24.5 spricht dagegen von `pendingCommands` der Hülle, „existiert für die
Übergabe an den Kern" — die es so nie gab. Der Playtest V2 beschreibt als erlebtes
Verhalten bereits das Sammeln („Befehle wirken erst im Folgetick", V2-08) — nur ohne
Quittung.

**Entscheidung:** Die Hülle sammelt Befehle (`pendingCommands`) und reicht sie dem
**ersten Tick** des nächsten Laufs — der laufenden Uhr, dem Vorspulen
(`FastForwardRequest.playerCommands`, nur erstes Häppchen). Geprüft wird ein Befehl
weiterhin **sofort** (`canApply` → Absage jetzt, nicht im nächsten Tick). Der
auslösende Knopf zeigt die Quittung und ist bis zur Anwendung gesperrt. Vier
Bestandstests, die das alte Sofort-Anwenden voraussetzten, gehen jetzt den
Spielerweg (Befehl → Tick → Wirkung); die Anforderung dahinter hat sich mit
M22/D24.5 geändert, nicht die Tests allein.

**Auswirkung:** Bei Pause wirkt ein Befehl erst beim Weiterlaufen — und sagt das am
Knopf. Kein Golden-Master-Einfluss (Kernschleife unverändert; die Änderung liegt in
der Hülle).

## 2026-09-07 · T-M23-03 · Der neue Name steht in Quelle, Zwischenstand und Produkt zugleich

**Lage:** `world.json` ist ein Bauprodukt (`scripts/build-map.mjs`); die Namensquelle ist
`data/mapgen/merge-rules.json`, dazwischen liegt `data/maps/world-shapes.json`. Der
Neubau braucht die Natural-Earth-Rohdaten (`data/geodata/`, Download hinter dem
Haltepunkt T-M9-01) — sie liegen nicht im Repository, ein bitgleicher Neubau war in
dieser Sitzung nicht fahrbar.

**Entscheidung (Randstelle):** Die Umbenennung von `AUS-SE` („Südostaustralien" →
„Australisches Hauptstadtterritorium") wird in **allen drei Dateien** von Hand
gleichlautend eingetragen — Quelle zuerst, damit der nächste Kartenneubau denselben
Namen erzeugt statt den alten zurückzubringen. `apps/headless/test/worldmap.test.ts`
bindet genau diese Kette: Name im Produkt, kein „Südostaustralien" mehr, Name auch in
merge-rules.json und world-shapes.json, und Zuschnitt/Anreicherung unverändert
(Bevölkerung 52 097, Vorkommen, drei Umrisse).

**Auswirkung:** Kein Golden-Master-Einfluss: Provinznamen speisen keine Regel, und kein
schneller Test bindet einen Zustands-Hash der Weltkarte an einen Festwert; die
Simulation liest den Namen nicht.

## 2026-09-07 · T-M24-03 · Das Kriegsmarsch-Paradox: Kriegsmalus halbiert statt gestrichen

**Lage:** Belegt aus dem Vorbild: fremder Boden ×0,7, feindlicher ×0,35
(`hostileTerritoryFactor` 350). Damit **halbierte** eine Kriegserklärung das Marschtempo
auf dem Boden des Gegners — der Weg USA-SOUTH → MEX-NE kostete 106 Ticks im Frieden und
211 im Krieg (PROBLEME.md, 2026-09-07). Der schnellste Eröffnungszug war der
unangekündigte Überfall (kostet 200 Ansehen, löst den Krieg automatisch aus): das Spiel
bestrafte den, der ansagt, und belohnte den, der überfällt. Dazu Befund V2-15: Märsche
von 14–31 Tagen dominieren die Frühphase.

**Messung** (Headless-Vergleichslauf, Aufbau des Parameterlaufs: Weltkarte, sechs
europäische Nachbarn — Deutschland, Frankreich, Polen, Italien, Ukraine, Spanien —, alle
ab Tick 0 im Krieg, Siegbedingung 700 ‰ Punktanteil, 200 Spieltage Budget, **12 feste
Startzahlen je Variante**, dieselben wie `pnpm balance:sweep`; Rohzahlen in
`docs/reports/warmarch.json`):

| Metrik (Ø über 12 Läufe) | 0,35 (Vorbild) | **0,50** | 0,70 (gestrichen) |
|---|---|---|---|
| Eroberungen je Partie | 514,5 | 444,4 | 478,3 |
| Erster Eroberungstag | 5 | 5 | 5 |
| Beendete Kriege (von 15 erzwungenen) | 9,3 | 6,4 | 7,6 |
| Mittlere Kriegsdauer bis zum Frieden (Tage) | 44,3 | 33,2 | 31,0 |
| Entschiedene Partien (Sieg-Tag) | 0 von 12 | 0 von 12 | 0 von 12 |
| Anteil des Stärksten an allen Provinzen | 34,4 % | 39,0 % | 42,8 % |
| Überlebende Mächte (von 6) | 5,0 | 4,0 | 4,0 |

**Entscheidung:** `hostileTerritoryFactor` **350 → 500** — der Kriegsmalus wird halbiert,
nicht gestrichen (die Voreinstellung aus D24.8). Begründung aus den Zahlen:

1. **Das Paradox schrumpft, ohne zu kippen.** Der Tempovorteil des Überfalls fällt von
   Faktor 2,0 (0,7/0,35) auf 1,4 (0,7/0,5). Kein Eroberungssprung (444 gegen 514 — eher
   weniger, weil Provinzen seltener hin- und herwechseln), erster Eroberungstag
   unverändert, kein Sieg-Tag-Sprung (keine Variante entscheidet eine Partie in 200
   Tagen — die Siegschwelle liegt an der Punktverteilung, nicht am Marschtempo).
2. **Kriege enden statt zu gären.** Die mittlere Kriegsdauer fällt um ein Viertel
   (44,3 → 33,2 Tage) — direkt gegen V2-15, die zermürbenden Märsche der Frühphase.
3. **0,7 wäre zu viel.** Der Malus ganz gestrichen konzentriert die Macht am stärksten
   (Anteil des Stärksten 42,8 %, kürzeste Kriege) und nähme dem Verteidiger jede
   Zeitreserve; 0,5 behält die Hälfte davon als Verteidigervorteil.
4. **Die Nebenwirkung ist benannt:** auch bei 0,5 stirbt im erzwungenen Sechserkrieg im
   Mittel eine Macht mehr als bei 0,35 (4,0 gegen 5,0 Überlebende) und der Stärkste
   steht bei 39 % statt 34 %. Das ist die gewollte Richtung — Kriege haben wieder
   Folgen —, liegt aber nahe der Rauschgrenze des Laufs (Streuung des Führungsanteils
   allein durch die Startzahl: 0,085 je Einzellauf, ≈0,025 im Mittel über 12).

**Golden-Master-Umgang:** Die Änderung greift in den Kriegsmarsch und ändert damit den
festgeschriebenen Durchstich: `apps/headless/test/golden/walkthrough.json` fiel
nachweislich (Hash-Abweichung, Eroberung von `m1` findet früher statt) und wurde mit
`UPDATE_GOLDEN=1` **bewusst neu erzeugt**; der Endstand des Durchstichs bleibt inhaltlich
gleich (`m1` gehört `p1`). `packages/core/test/golden/tiny-500.json` bleibt unberührt —
der Lauf enthält keine Märsche. Das steht so auch in der Commit-Nachricht.

**Auswirkung:** BALANCING.md trägt den neuen Wert mit Herkunft (Zeile „Feindliches
Gebiet" und Konstantentabelle); die Bewegungs-Tests binden die Konstante symbolisch und
blieben grün; `PROBLEME.md` verweist bei der Beobachtung auf diese Entscheidung. Wer die
Zahl erneut anfassen will, wiederholt den Messlauf (Aufbau oben) statt zu raten.

---

## 2026-09-08 · Abnahme · Der Abnahmelauf fährt nur noch seine Kriterien — und sagt seine Dauer voraus

**Entscheidung (Noahs Auftrag: „den Akzeptanztest deutlich verkürzen"):** `pnpm
acceptance` ruft nicht mehr pauschal die ganze langsame Suite (75–130 min), sondern
genau das, was AK-1 bis AK-6 wörtlich verlangen: `pnpm verify` (deckt AK-4 —
Determinismus, Speichern/Laden, Kampf-Eigenschaften), **parallel** dazu die volle
Partie (AK-1, `sim:fullgame`) und den 1000-Tage-Langlauf (AK-6, `sim:long`) — beide
messen Ergebnisse, keine Zeiten —, danach **seriell** die Zeitbudgets (Tick,
Weltkarte, Zeichnen) auf ruhiger Maschine.

**Was nicht mehr je Abnahme läuft:** Parameterlauf (~29 Varianten × 12 Startzahlen ×
120 Spieltage ≈ der Löwenanteil der Laufzeit), Turnier, KI-Integrationslauf,
Onboarding-Durchgang. Sie sind **Messgeräte, keine Abnahmekriterien** — kein AK
verlangt sie je Lauf. Sie bleiben in `pnpm test:slow` (Vollsuite für die Nacht) und
als Einzelbefehle (`pnpm balance:sweep` …).

**Damit sie nicht still veralten:** ein Frische-Wächter (`gaugeStatus` in
`acceptance-criteria.mjs`, getestet in `test/requirements.test.ts`) vergleicht die
Commit-Zeit von `data/rules/**` mit der des jeweiligen Berichts — sind die Regeln
jünger (oder uncommittet geändert, oder irgendetwas unbekannt), ist die **Abnahme
rot** mit der Ansage, welcher Befehl zu laufen hat. Commit-Zeiten statt Datei-mtimes,
weil ein checkout mtimes verwischt.

**Dazu:** Das Skript druckt vorab die **erwartete Dauer aus der Messung des letzten
Laufs** (`docs/reports/acceptance-timing.json`) statt einer Schätzung — nachdem
„rund 75 Minuten" real 111 wurden.

**Kippbar:** Wer die alte Vollprüfung je Abnahme zurück will, ersetzt die drei
Aufrufe wieder durch `pnpm test:slow`.

## 2026-09-10 · KRIEGSRAT · Richtung A „Kriegsrat" ersetzt „Lagekarte"; ein Markerstil für alles

**Entscheidung (Noah, 2026-09-10):** Aus drei Designrichtungen (A Kriegsrat, B Depesche,
C Glasbrücke — Skizzen und Finalentwurf in `docs/design/kriegsrat.html`) wählt Noah **A**.
Die Oberfläche wird ein dunkler Kartentisch: Bernstein für Zeit und Befehle, Phosphor-Grün
für Eigenes, Zinnober für Feind und Kampf. Die vom 2026-09-03 freigegebene helle Richtung
„Lagekarte" (T-M10-01, `docs/design/tokens.md`) ist damit abgelöst — die **Token-Namen und
Rollen bleiben**, nur die Werte wechseln, damit kein Aufrufer sich ändert und Kontrast- wie
Farbwächter weiter greifen.

**Dazu drei Festlegungen aus Noahs Feedback zum Entwurf:**

1. **Marker im NATO-Stil sind der einzige Symbolstil auf der Karte** — Rechteck mit Glyphe
   für Einheiten und Stapel, Quadrat mit Glyphe für Gebäude. Kein zweiter Stil daneben, keine
   Emoji, keine Rasterbilder. Die Glyphen kommen aus den vorhandenen Icon-Pfaden
   (`ui/icons.tsx`), damit Panel und Karte dasselbe Strichbild zeigen.
2. **Gebäude stehen in der Provinzfläche**, verteilt an geometrisch abgeleiteten Ankern —
   nicht am Mittelpunkt, nicht in Reihen („quetsche nicht so stark").
3. **Supremacy WW3 ist der Maßstab, nicht das Vorbild.** Wo wir gleich gut oder besser sind
   (Zeit, Modi, Tastatur, Ressourcenleiste), bleibt es; jede Lücke (Stapelzahl, Gebäude auf
   der Karte, Zoomstufen, Tooltip, verzögerter Abmarsch, Preisverlauf) ist eine Aufgabe in
   M29–M32. Durchmarschrecht, Provinzhandel und Forschung sind Mechanik und werden in
   T-M32-03 entschieden, nicht stillschweigend gebaut.

**Begründung:** Der Entwurf wurde am Code gegengeprüft (KRIEGSRAT.md §1): drei Annahmen
des ersten Planentwurfs waren falsch — Ressourcenbilanz, Zoom und Gefechtsursache gibt es
schon. Der Plan ist entsprechend kleiner und berührt den Kern nur in T-M32-01, additiv und
erst nach Freigabe.

**Auswirkung:** M29–M32 in `tasks.yaml`/`03-TASKS.md`; T-M28-06 und T-M28-08 hängen jetzt
an T-M29-01, damit sie im neuen Schema gebaut werden. `docs/design/tokens.md` bleibt als
Geschichte stehen; die gültigen Werte stehen in KRIEGSRAT.md D27.1 und nach T-M29-01 in
`tokens.ts`.

---

## 2026-09-11 · T-M29-01 · Beziehungsflächen sind dunkle Verwandte, nicht die Signalfarben selbst

**Entscheid:** `RELATION_COLORS` füllt den Beziehungsmodus mit abgedunkelten Verwandten
(`self #3C6E44`, `ally #2A4A66`, `war #7A2E22`, `peace = paperSunk`, `unknown #3A3D40`)
— nicht mit `good`, `#6FA8DC` und `accent`, wie das „Fertig wenn" von T-M29-01 wörtlich
sagt. Die drei Leuchtfarben bleiben Token (`good`, `ally`, `accent`) für Marker, Linien
und Text; als Flächen einer ganzen Weltgegend gibt es sie nicht.

**Begründung:** Zwei Wächter, die der Plan ausdrücklich behält, widersprechen dem Wortlaut:
`tokens.contrast.test.ts` verlangt `onPlayer` ≥ 4,5 : 1 auf jeder Beziehungsfläche
(`#E6E1D3` auf `#7EC57E` sind 1,5 : 1), und D27.1 selbst nennt „Eigene Provinzen
`#3C6E44`, Feind `#7A2E22`" als Beziehungs-Füllungen. KRIEGSRAT.md D27.1: „der
Kontrasttest hat das letzte Wort". Aus demselben Grund weichen `line` (`#5C6A78` statt
`#2F3944`, 3 : 1 Nicht-Text auf `paper`) und `accent` (`#E8583F` statt `#E2503A`,
AA-Text auf `paper`) minimal vom Entwurf ab — beides im Token dokumentiert.

**Auswirkung:** Kein Aufrufer ändert sich; `fillFor('relations')` und `legendFor` lesen
weiter `RELATION_COLORS`. Wer den Beziehungsmodus später leuchtender will, ändert die
fünf Werte und lässt den Kontrasttest entscheiden.

---

## 2026-09-11 · T-M32-01 · Der verzögerte Abmarsch braucht keine Zeile in der Bewegungsphase

**Entscheidung:** `MOVE_ARMY.departInTicks` verschiebt in `commands/move.ts` nur
`departureTick`, `arrivalTick`, `deployDelayUntil` und die im Ereignis gemeldete
Ankunft um denselben Betrag. Die Bewegungsphase bleibt unangetastet. Die halbe
Kampfkraft beginnt am tatsächlichen Abmarsch, umgesetzt als eine Bedingung in
`deploymentFactor` (`tick < departureTick` → volle Kraft), **nicht** als neues Feld am
Armee-Zustand.

**Begründung:** Die Bewegungsphase wartet ohnehin auf `arrivalTick` — ein verschobener
Abmarsch ist für sie ein späterer erster Schritt und sonst nichts. Ein zweites
Zeitfeld am `Army` hätte Zustandsformat, Klonen, Migration und Golden-Master berührt,
und zwar für eine Information, die `departureTick` schon trägt. Für jeden Befehl ohne
Verzögerung ist `departureTick` der Tick des Befehls selbst, die neue Bedingung also
nie wahr: das alte Verhalten bleibt tickgenau erhalten.

**Auswirkung:** Golden-Master unberührt. Kommandologs ohne das Feld spielen identisch
ab (`determinism.test.ts` bindet es). Die Zielwahl schickt das Feld bei „sofort" gar
nicht erst mit. Obergrenze 14 Tage (`MAX_DEPART_DELAY_DAYS`).

---

## 2026-09-11 · T-M32-03 · Durchmarsch und Provinzhandel wandern nach M17, die Forschung wird gestrichen

**Entscheidung (Noah, 2026-09-11):** Die drei Supremacy-Elemente aus KRIEGSRAT §5, die
Mechanik sind und nicht Oberfläche, sind entschieden:

1. **Durchmarschrecht — Antrag als M17-Aufgabe vorgemerkt (T-M17-01).** Gewähren und
   Widerrufen gibt es seit M5 (`commands/diplomacy.ts`, `grantRightOfWay`), und die
   Bewegungsphase liest das Recht. Was fehlt, ist die andere Richtung: **darum bitten.**
2. **Provinzhandel — als M17-Aufgabe vorgemerkt (T-M17-02).** Existiert nirgends.

*(Berichtigt am 2026-09-13, T-M17-01: Zwei Aussagen in Punkt 1 waren falsch. **Einen eigenen
Widerruf gibt es nicht** — das Recht endet nur mit Bündnisbruch oder Kriegserklärung —, und
**die Bewegungsphase liest das Recht nicht**; gelesen wird es allein in der Überfall-Erkennung
(`phases/diplomacy.ts`). Dazu ist das Recht symmetrisch, Befund B1 in `PROBLEME.md`. Die
Platzhalter „T-M17-01" und „T-M17-02" heißen seit der Planung von M17 **T-M17-04**
(Durchmarsch) und **T-M17-06** (Provinzhandel); T-M17-01 ist die Planung selbst.)*
3. **Forschung — gestrichen.** Es wird keinen Forschungsbaum geben.

**Begründung:** Zu 1: die einseitige Gewährung deckt den Fall „ich lasse dich durch"
ab, aber nicht „lässt du mich durch" — und genau den braucht die KI, damit
Durchmarschrecht überhaupt zwischen zwei KI-Mächten entstehen kann. Klein und additiv,
aber eine Verhandlung, und Verhandlungen sind die Achse M17. Zu 2: ein Abtreten ohne
KI-Bewertung wäre ein Knopf, den nur der Spieler drückt — ein Geschenk an sich selbst.
Der Wert einer Provinz für eine fremde Macht ist die eigentliche Arbeit, und sie gehört
zu „Tiefe zwischen den Kriegen". Zu 3: **die Freischaltungsachse existiert bereits** —
`rules/availability.ts` gibt jeder Sache einen Tag, ab dem sie baubar ist, und lehnt
vorher mit dem Tag im Text ab (T-M15-02, R-TECH-01). Ein Punktebaum wäre eine zweite
Wirtschaft mit eigenem Zustandsfeld, eigener Migration, eigener Oberfläche und eigener
KI-Bewertung — und er ersetzte eine Achse, die im Playtest funktioniert hat, durch eine
teurere mit demselben Zweck.

**Auswirkung:** Beide Vormerkungen stehen im Vorspann von **M17** in `03-TASKS.md` und
bewusst **nicht** als Aufgaben in `tasks.yaml`. Der erste Versuch tat genau das und
machte den Plan-Wächter rot: ein Meilenstein gilt ihm als *geplant*, sobald er eine
einzige Aufgabe trägt, und verlangt dann für **alle** seine Anforderungen Aufgabe und
Entwurfstext — hier also für R-SPY-01…06 und R-DIP-05/07. Das ist kein Fehler des
Wächters, sondern seine Absicht (Kommentar in `test/plan-consistency.test.ts`): M17
wird als Ganzes geplant oder gar nicht. Wer ihn aufmacht, nimmt diese beiden Punkte mit.
Die Forschung erscheint in keinem Meilenstein mehr; KRIEGSRAT §5 nennt sie als bewusst
nicht geschlossene Lücke.

---

## 2026-09-11 · M33 · Ein zweiter Bildsatz neben den Glyphen — und die Karte behält ihre

**Entscheidung:** Drei Entscheide aus `EINHEITSBILDER.md` Abschnitt 6, beim Bau von M33
bestätigt und hier festgehalten.

- **D33-a — Die Karte behält die NATO-Glyphe.** Begründung: elf Pixel. `MapCanvas`
  stempelt `ICON_PATHS[name]` als einzelnen `Path2D` bei 11 px Kantenlänge; ein
  gefüllter Schattenriss ist dort ein Fleck, ein Rechteck mit Oval noch eine Auskunft.
  Seit T-M33-04 ist das kein Satz mehr, sondern ein Test: er fängt jedes `d`, aus dem
  die Karte einen `Path2D` baut, und verlangt, dass jedes aus `ICON_PATHS` stammt und
  keines aus `ART`.
- **D33-b — Der Bildsatz liegt in einer eigenen Datei, nicht in `icons.tsx`.**
  Begründung: `ICON_PATHS` ist ein `Record<…, string>`, an dem `Path2D` und drei Tests
  hängen. Zwei Pfade je Zeichnung (`body` gefüllt, `cut` als Innenlinien darüber) passen
  dort nicht hinein, ohne die Kartenschnittstelle zu verbiegen. Die Brücke zwischen
  beiden Sätzen ist `ART_FOR_ICON` — aus `UNIT_ICONS`/`UNIT_ART` gebaut und damit keine
  dritte Liste, die veralten könnte.
- **D33-c — Gefechtsbericht und Erklär-Fenster bekommen kein Bild.** Noahs Wahl vom
  2026-09-11; wieder aufnehmbar, ohne etwas zurückzubauen.

**Begründung:** Zwei Bildsprachen im selben Spiel sind ein Preis, kein Gewinn — wer
beides zum ersten Mal sieht, muss den Zusammenhang selbst herstellen (Risiko 1 des
Bauplans). Bezahlt wird er dafür, dass die Panels 30 bis 44 px Platz haben und die Karte
elf. Das Gegenmittel ist, dass alles **außer der Füllung** gleich bleibt: derselbe
Rahmen, dieselbe Besitzerfarbe (`good`/`ally`/`accent`/`inkSoft`), dieselbe Stellung der
Zahl. Das Restrisiko bleibt und ist bewusst getragen.

**Auswirkung:** `apps/desktop/src/ui/art.tsx` trägt siebzehn Zeichnungen im Kasten
48 × 30; `icons.tsx` bleibt unverändert der Satz für Karte, Alarme und Tagesbericht.
`no-foreign-assets.test.ts` nennt keinen Bildsatz mehr namentlich, sondern sucht jede
Quelldatei mit Pfaddaten — ein dritter Satz wäre ab dem ersten Tag mitgeprüft.

---

## 2026-09-11 · T-M36-04 · Die Rohstoffleiste bekommt vier Gruppen — und was das kostet

**Entscheidung:** Noahs Wahl vom 2026-09-11, zweite Runde (`ROHSTOFFE.md` D36.3,
Anordnung 2 im Entwurfsblatt). Die sieben Zellen stehen in vier Blöcken —
**Versorgung** (Nahrung) · **Baustoffe** (Material, Eisen, Kohle) · **Kriegsstoffe**
(Öl, Seltene Erden) · **Geld** —, getrennt durch drei Striche statt durch sieben
gleich starke.

**Begründung:** Sieben gleichwertige Kästen sagen nicht, dass Eisen und Kohle dasselbe
Problem sind und Öl ein anderes. Bis hierher trug *jede* Zelle denselben Strich; sieben
gleich starke Trennungen trennen nichts.

**Der Preis, und er ist mitgekauft:** zwei Strichstärken nebeneinander — die Gruppenlinie
und der ruhige Grund — können die Leiste unruhiger machen statt ruhiger. Bestätigt sich
das im Spiel, ist es ein Befund für den nächsten Playtest und kein Grund, jetzt anders zu
bauen. Der Bauplan sagt das ausdrücklich, und hier steht es, damit es später niemand als
Überraschung liest.

**Auswirkung:** `RESOURCE_GROUPS` in `Header.tsx` ist die einzige Liste; hintereinander
gelegt ergibt sie genau `RESOURCE_KEYS`, und ein Test hält das fest — die Gruppierung
ordnet nicht um. Die Liste im DOM bleibt **flach**: sieben `li`, eine `ul`, keine
Untergruppe. Eine verschachtelte Liste spräche einem Vorleseprogramm vier Ebenen vor,
wo es sieben Zahlen zu lesen gibt; die Gruppe ist eine Linie fürs Auge und keine Ebene
fürs Ohr.

---

## 2026-09-11 · M36 · Der gemischte Zeichensatz der Rohstoffe — und die Zahl, die ihn trägt

**Entscheidung:** Noahs Wahl vom 2026-09-11, zweite Runde (`ROHSTOFFE.md` D36.1,
Entwurfsblatt Abschnitt 1b): **Fassung 1 als Grundlage, aber Eisen, Kohle, Öl und
Seltene Erden aus Fassung 2.** Nahrung wird eine Ähre, Material ein Balkenstapel, Geld
ein Münzstapel; Eisen sind zwei versetzte Barren, Kohle ein kantiger Brocken, Öl bleibt
der Tropfen, Seltene Erden werden zwei Kristalle.

**Begründung, gemessen statt behauptet:** jedes Zeichen bei **vierzehn Pixeln** gerastert
— der einzigen Größe, in der es vorkommt —, jedes Paar mit jedem verglichen, der Wert ist
der mittlere Unterschied je Bildpunkt, und das **engste Paar entscheidet**, weil es das
ist, das verwechselt wird:

| Satz | engstes Paar | Wert | Mittel über 21 Paare |
|---|---|---|---|
| heute | Kohle / Öl | 0,104 | 0,157 |
| Fassung 1 | Eisen / Kohle | 0,119 | 0,201 |
| Fassung 2 | Kohle / Öl | 0,127 | 0,197 |
| **beschlossen** | Kohle / Öl | **0,127** | 0,191 |

Der gemischte Satz ist auf der Zahl, die zählt, der beste. Und er widerlegt eine
Behauptung aus der Besprechung: Fassung 1 sollte Eisen und Kohle über den Umriss
besonders gut trennen — gemessen ist genau dieses Paar das engste des ganzen Satzes.
**Bei der Abnahme im Browser nachgerechnet** (`Path2D` auf eine 14 × 14-Fläche, dieselbe
Strichstärke wie im Spiel): 0,127 für Kohle / Öl und 0,191 im Mittel, gegen 0,104 und
0,157 für den alten Satz — die Zahlen des Bauplans, auf einem zweiten Weg und an den
tatsächlich ausgelieferten Pfaden.

**Was die Zahl nicht sagt:** sie misst, wie verschieden die Tinte liegt, nicht ob jemand
das Ding benennen kann. „Unterscheidbar" ist belegt, „erkennbar" bleibt Sache der
Sichtprüfung.

**Auswirkung:** sieben Einträge in `ICON_PATHS`; der Bildsatz aus `art.tsx` bleibt
unberührt, denn Rohstoffe haben Zeichen und keine Bilder. `icons.test.tsx` führt den
Auswahl-Ausschnitt des Entwurfsblatts aus und vergleicht alle sieben wortgleich — das
Blatt und der Code können nicht mehr auseinanderlaufen. **Material trägt keinen
Nadelbaum mehr**; der Wald im Geländesatz behält seine Bäume, und genau deshalb durfte
der Rohstoff keine mehr haben.

---

## 2026-09-12 · M34 · Der Meilenstein wartet auf eine freie Maschine, und zwar ganz

**Entscheidung:** M34 wird **nicht angefangen**, solange auf dem Rechner etwas anderes
läuft. Nicht teilweise, nicht vorbereitend, nicht „die Doku schon mal". Der Meilenstein
beginnt mit T-M34-01 auf einer gemessen freien Maschine oder gar nicht.

**Begründung, in drei Schritten:**

1. **Die Maschine war nicht frei.** Gemessen am 2026-09-12: Gesamtlast **26 %** bei zwölf
   Kernen, die größten Verbraucher ein Editor, ein Chatprogramm und ein Browser. Das ist
   keine Randbedingung, sondern der Kern der Sache: T-M34-01 misst den **Ausgangswert**,
   an dem jede spätere Aussage „es ist besser geworden" hängt. Ein Ausgangswert unter
   Fremdlast ist nicht bloß ungenau — er ist der Maßstab, und er ist falsch, ohne dass
   man es ihm ansieht. Dieses Projekt hat den Fehler zweimal gemacht und beide Male
   teuer bezahlt (Lessons Log, 2026-09-06 und 2026-09-07: ein Abnahmelauf überschrieb
   Messdateien mit Werten, die unter seiner eigenen Last entstanden).

2. **M34 lässt sich nicht in einen sicheren und einen unsicheren Teil schneiden.** Von
   acht Aufgaben hängen sieben entweder am Ausgangswert (T-M34-01) oder an einer
   Regeländerung. Vier ändern `data/rules` oder den Kern und machen die Abnahme rot, bis
   Parameterlauf **und** Turnier neu gelaufen und ihre Berichte **eingecheckt** sind —
   der Frische-Wächter in `scripts/acceptance.mjs` vergleicht Commit-Zeiten, nicht
   Inhalte. T-M34-04 verschiebt zusätzlich den Golden-Master.

3. **Die einzige isoliert baubare Aufgabe wäre die schlechteste Wahl.** T-M34-02 ändert
   `R-TECH-01` begründet ab, also die Anforderung selbst. Sie ohne die Umsetzung zu
   bauen hieße, eine Zusage in die Doku zu schreiben, die der Code nicht einlöst. Genau
   diese Sorte Falschaussage ist am 2026-09-11 aus der Einstiegsdoku entfernt worden;
   sie dort wieder einzuführen wäre ein Rückschritt.

**Die Abwägung, die dagegen sprach:** M34 jetzt zu bauen und die Messläufe später
nachzuholen. Verworfen — das Projekt stünde bis dahin mit **roter Abnahme** da, und der
nächste Agent fände einen roten Zustand ohne sichtbaren Grund vor. Ein sauberer
ungebauter Zustand ist besser als ein gebauter, dessen Belege fehlen.

**Auswirkung:** M34 und M35 bleiben vollständig auf `todo`. Der Weg, wenn die Maschine
frei ist, steht in `WORKFLOW.md` §2 als nummerierte Folge — er beginnt **nicht** mit
T-M34-01, sondern mit einem frischen `pnpm acceptance`, weil der letzte Abnahmelauf
(11/11 am 2026-09-11) gegen den Stand **vor** M33 und M36 lief und als Ausgangswert
deshalb nicht mehr gilt.

---

## 2026-09-12 · T-M34-02 · Die fünf belegten Freischaltungstage gelten hier nicht mehr als belegt

**Entscheidung:** R-TECH-01 nennt weiterhin die Tage des Originals (Kaserne 1, Hafen 2,
Eisenbahn 5, Fabrik 8, Flugplatz 10, Referenz 1.4), übernimmt sie aber nicht mehr als
Abstände. In `BALANCING.md` steht bei allen siebzehn Sachen **abgeleitet**; vorher war
fünfmal **belegt** eingetragen. Die Reihenfolge des Originals bleibt bindend, die
Abstände setzt T-M34-03 neu.

**Begründung:** Eine belegte Zahl ist nur in ihrer eigenen Zeitrechnung belegt. Im
Original ist ein Spieltag ein echter Tag — sechzehn Tage sind sechzehn Tage Spielen.
Hier hat ein Spieltag 24 Ticks und ein Tick eine Sekunde bei Tempo 1: **dieselbe Leiter
ist nach 6,4 Minuten Echtzeit durchlaufen**, während die Partie des Abnahmelaufs bis
Spieltag 798 läuft. Zwei Prozent der Partie trügen die ganze Fortschrittsachse. Die
Zahlen aus der Referenz abzuschreiben und „belegt" darüberzuschreiben, hat aus einer
richtigen Quelle eine falsche Aussage gemacht — nicht weil jemand falsch gelesen hätte,
sondern weil zwei Größen denselben Namen tragen.

**Die Gegenrede steht im Dokument, nicht nur im Entscheid.** Wer die alten Zahlen später
wieder für belegt hält, findet sie in R-TECH-01 selbst. Eine Zahl aus der Tabelle zu
löschen, wäre der billigere Weg gewesen und der schlechtere: dann sähe es aus, als hätte
die Frage nie jemand gestellt.

**Auswirkung:** Kein Code. `test/balancing.test.ts` prüft weiterhin, dass Tabelle und
Regelwerk dieselben Tage nennen — die Status-Spalte prüft es nicht, und deshalb ist sie
eine Aussage von Menschen für Menschen und muss stimmen. `pnpm coverage:requirements`
meldet unverändert „V1 offen: 0".

---

## 2026-09-12 · T-M34-08 · Die Zeile über der Aushebeliste nennt auch Gebäude

**Entscheidung:** „Als Nächstes: Fabrik — in 8 Tagen" steht am Kopf der **Aushebe**liste,
nennt aber die nächste Freischaltung der **ganzen** Leiter — Gebäude wie Einheiten. Bei
Gleichstand gewinnt das Gebäude.

**Begründung:** Es ist eine Achse. Nach der Streckung (T-M34-03) liegen Gebäude und
Einheiten ineinander verschränkt: Hafen 6, Transportschiff 10, Festung 12, Motorisierte
16, Eisenbahn 20. Eine Zeile, die nur Einheiten nennt, ließe den Spieler an Spieltag 4
auf Tag 16 warten, während in Wahrheit an Tag 6 der Hafen kommt — sie wäre nicht kürzer,
sondern falsch. Der Ort bleibt trotzdem die Aushebeliste, weil D34.5 ihn nennt und weil
das Bauplatz-Raster darüber jedes gesperrte Gebäude ohnehin mit seinem Tag zeigt.

**Der Gleichstand fällt zum Gebäude**, weil `Array.prototype.sort` stabil ist und die
Gebäude zuerst in der Liste stehen: die Fabrik vor dem Panzer, den sie erst möglich
macht. Eine Zeile, die den Panzer nennt und die Fabrik verschweigt, nennt die Wirkung und
verschweigt die Ursache.

**Auswirkung:** `nextUnlock` in `actions.ts`, eine Zeile in `ActionGroup`, ein Ton
`muted` im Bildsatz. Ist alles frei, kommt `null` und die Zeile verschwindet — ab
Spieltag 80 stünde dort sonst dauerhaft ein leerer Kasten.

---

## 2026-09-12 · T-M35-01 · Zwischenziele sind Rückmeldung, keine Siegbedingung

**Entscheidung:** Der Entwurf in `FORTSCHRITT.md` §3 lässt `checkVictory` und die
Siegschwelle von 700 ‰ unangetastet. Zwischenziele gewinnen keine Partie; sie sagen dem
Spieler, ob er vorankommt. Von den fünf Kandidaten fällt **„stärkste Macht eines
Kontinents" heraus** — die Karte kennt keinen Kontinent, das Ziel kostet ein Feld in
`MapProvince`, einen neuen Kartenlauf und eine Wanderung durch `validateMap`.

**Begründung:** R-GAME-02 ist eine V1-Zusage. Eine neue Siegbedingung wäre eine Änderung
an einer abgenommenen Anforderung und bräuchte denselben Aufwand wie T-M34-02 bei
R-TECH-01 — für einen Ertrag, den die Rückmeldung allein schon bringt. Und die vier
übrigen Ziele brauchen **kein einziges neues Zustandsfeld**: Punktanteil, Provinzzahl,
Bevölkerungsanteil und gefallene Großmächte stehen alle schon im Zustand. Das eine neue
Feld ist `state.goals` — nicht für die Zahl, sondern dafür, dass ein einmal erreichtes
Ziel erreicht bleibt.

**Der Golden-Master wird neu erzeugt und nicht umgangen.** `goals` in `HASH_OMIT_KEYS` zu
schieben wäre der billigere Weg und der falsche: ein Zustandsfeld, das aus dem Hash
fällt, kann beim Speichern und Laden auseinanderlaufen, ohne dass ein Test es merkt.

**Auswirkung:** Kein Bau. Vier Teilaufgaben stehen geschnitten in `FORTSCHRITT.md` §3 und
**bewusst nicht** in `tasks.yaml` — dasselbe Muster wie T-M28-07: ein Meilenstein gilt
dem Plan-Wächter als geplant, sobald er eine Aufgabe trägt. Welche Marken es sind, ist
eine Spielentscheidung und liegt bei Noah.

---

## 2026-09-12 · T-M34-07 · `recruitShare` von `schwer` auf 280 — die Mauer war gemessen, die Reparatur auch

**Entscheidung:** `data/rules/default/ai.json`, `difficulties.hard.recruitShare` von 360
auf **280**. Die Schwellen des Turnierlaufs (0,55 bis 0,95) bleiben **unverändert**.

**Der Befund.** Nach der Streckung der Freischaltungsleiter (T-M34-03) und der Kürzung des
Startvorrats (T-M34-06) stand zwischen `normal` und `schwer` eine **Mauer**: Siegquote
1,00 bei null Unentschieden. Genau dafür gibt es die Obergrenze — wer auf „normal"
verliert, wechselt zu „schwer" und darf dort nicht gegen eine Wand laufen.

**Warum nicht das Messfenster und nicht der Startvorrat.** Beides wurde zuerst
ausgeschlossen, statt es zu vermuten: 40, 80, 120 und 200 Spieltage ergeben **alle 1,00**;
ein Startvorrat von 667, 750, 833 oder 1000 Promille ergibt ebenfalls **alle 1,00**. Erst
danach wurde am Rekrutierungsanteil gemessen, fünf Werte über zwei Fenster. Das Band wird
im Bereich **260 bis 320** eingehalten, und zwar in beiden Fenstern; gesetzt ist mit 280
die **Mitte dieses Bereichs** und nicht der erste Wert, der eine Zahl grün macht. Der Lauf
danach steht bei 0,70.

**Was die Änderung nicht berührt:** den Grundlauf, den Abnahmelauf AK-1 und den Langlauf —
alle drei spielen ausschließlich `normal`. Betroffen sind das Turnier und der
KI-Integrationslauf; beide sind nachgefahren und grün.

**Was offen bleibt und im Bericht steht:** in der Paarung **im Krieg** bleibt es bei 1,00.
Kein gemessener Wert hält beide Paarungen gleichzeitig im Band. Der Test sichert die
Friedens-Paarung zu — dort hat die Wirtschaft Zeit, sich auszuwirken —, die Kriegs-Paarung
steht im Bericht als Zahl und nicht als Zusicherung. Wer die Stufen wirklich trennen will,
trennt sie an mehr als am Rekrutierungsanteil; das ist eine eigene Aufgabe.

**Nebenbefund, mitrepariert:** `BALANCING.md` führte für `recruitShare` **120 / 500**,
während `ai.json` seit dem 2026-09-06 15:47 (`0d551ac`) **200 / 360** trug — die Tabelle
war um einen Commit veraltet, und `test/balancing.test.ts` las nur `constants.json`. Der
Wächter liest jetzt auch `ai.json` und vergleicht Tabelle gegen Regelwerk Zahl für Zahl;
vorgeführt, dass er rot wird.

---

## 2026-09-12 · T-M34-07 · Die Sperrklinke des Onboarding-Durchgangs wird einmal weitergestellt

**Entscheidung:** Die längste Pause ohne Anlass in den ersten sechzehn Spieltagen darf
statt 72 nun **96 Ticks** betragen. Gemessen: 96, vier stille Spieltage zwischen dem Hafen
an Tag 6 und dem Transportschiff an Tag 10.

**Begründung.** Die Schranke war von Anfang an als **Sperrklinke gegen unbeabsichtigtes
Wachstum** gedacht — „die Schranke ist der heutige Wert, nicht ein gewünschter". M34 hat
die Leiter absichtlich von sechzehn auf achtzig Spieltage gestreckt; dass ihre Lücken
mitwachsen, ist dieselbe Entscheidung von hinten gesehen und kein unbemerktes Wachstum.
Die Klinke wird deshalb **einmal** weitergestellt, mit genannter Ursache im Test selbst.

**Was ausdrücklich nicht die Begründung ist:** dass eine Zahl passen soll. Wäre die Pause
ohne Regeländerung gewachsen, wäre die richtige Antwort gewesen, den Grund zu suchen.

**Was dagegen steht, und was die Messung davon nicht sieht:** T-M34-08 setzt über die
Aushebeliste eine Zeile, die nennt, was als Nächstes kommt und in wie vielen Tagen — aus
Warten wird ein Ziel. Der Durchgang zählt **Ereignisse**; eine stehende Zeile ist keines.
Ob vier stille Spieltage zu lang sind, ist eine Balancing-Frage und gehört Noah.

**Auswirkung:** `onboarding.slow.test.ts`, `docs/reports/onboarding.md` (neu erzeugt).

---

## 2026-09-12 — Mehrspieler: vier Festlegungen und ein Plan, der den Kern nicht anfasst

**Entschieden von Noah**, nach vier vorgelegten Fragen. Auftrag: ein Mitspieler soll über
einen Link beitreten können, aus einem anderen Netz, kostenlos, ohne öffentliche Webseite,
und keine Spielmechanik darf dabei verloren gehen außer der Zeitsteuerung.

1. **Der Host ist der Server.** Der Gast öffnet einen Link und spielt im Browser; er
   installiert nichts, lädt nichts, legt kein Konto an. Verworfen wurde die reine
   Punkt-zu-Punkt-Verbindung über zwei ausgetauschte Textblöcke: sie kommt ohne jeden
   Dienst aus, verlangt aber, dass der Gast das Spiel selbst besitzt, kostet zwei
   Kopierschritte statt eines Links, und sie kommt bei manchen Anschlüssen gar nicht
   zustande.
2. **Die letzte Meile ist Tailscale.** Verworfen wurde ein Tunnel auf eine öffentliche
   Adresse: bequemer für den Gast, aber die Adresse wäre aus dem Internet erreichbar, und
   genau das wollte Noah nicht. Der Preis der Wahl ist eine einmalige Installation beim
   Gast, etwa fünf Minuten.
3. **Das ausgelieferte Programm bleibt netzfrei.** Die Tauri-Anwendung behält
   `connect-src 'none'` und ihre leere Berechtigungsliste; der Mehrspieler ist der
   Browserbau. Damit bleibt Ziel Z3 für das Programm **wörtlich** wahr, und R-FREE-04
   wird präzisiert statt aufgeweicht: verboten ist, was das Spiel von sich aus tut, nicht
   was ein Spieler ausdrücklich veranlasst. Verworfen wurde, dem Programm eine eng
   gefasste Netzerlaubnis zu geben.
4. **Die Pause wird beantragt und angenommen.** Nicht einseitig, wie ursprünglich
   vorgeschlagen. C-11 ist entsprechend präzisiert: die feste Rate bleibt, das gemeinsame
   Anhalten ist keine Ausnahme davon, sondern ein abgestimmtes Stehen beider Uhren an
   **demselben Tick**.

**Die Entwurfsentscheidung, die den Umfang bestimmt: der Kern wird nicht angefasst.**
D13 sagt seit dem ersten Tag, für den Mehrspieler genüge ein Briefträger, der Kommandos
einem Tick zuordnet und Prüfsummen vergleicht. Diese Zusage hält. Gemessen am 2026-09-12
an der ausgelieferten Weltkarte: ein Befehl ist 79 Byte groß, die Partiedefinition
645 Byte, ein Spielstand nach dreißig Spieltagen 249 KB, ein Tick kostet 1,54 ms.
Bandbreite ist damit kein Thema; die Verbindung selbst ist das ganze Problem.

Weil `packages/core` und `data/rules` unberührt bleiben, bleiben auch Golden-Master,
Parameterlauf und Turnier unberührt — der Unterschied zwischen sechs Minuten Abnahme und
einem Nachtlauf. Das ist der Grund für die Reihenfolge: M37 baut alles ohne Netz, M38 die
Verbindung, M39 die Einladung.

**Zwei Wächter wurden beim Planen gefunden und sind eingeplant, nicht überrascht worden.**
Der Haltepunkt-Wächter in `plan-consistency.test.ts` kennt genau vier feste Aufgaben-IDs,
ein fünfter Haltepunkt macht ihn rot. Und `requirements.test.ts` benutzt ausgerechnet die
Nummer `AK-9` als erfundenes Gegenbeispiel für ein Kriterium ohne Anforderung. Beides
räumt T-M39-08 auf, **bevor** T-M39-09 zum Haltepunkt wird.

**Sofort erledigt statt später:** AK-9 steht seit heute in Abschnitt 3.2 der Anforderungen
**und** in `scripts/acceptance-criteria.mjs` mit `scope: 'M39'`. Das ist die Lehre aus
AK-8, das ein Jahr lang eine Zusage ohne Ort war und deshalb von keinem Skript geprüft
wurde. Ein Kriterium, dessen Ort auf den Bau wartet, wird nicht geprüft, sondern vergessen.

**Ausdrücklich nicht gebaut:** mehr als zwei Menschen, Lobby, Konto, Chat,
Schummelschutz. Der letzte Punkt ist eine echte Einschränkung und keine Auslassung: im
Gleichschritt hat jede Seite den vollen Zustand im Speicher, der Nebel des Krieges ist
also eine Eigenschaft der Anzeige. Ein autoritativer Host würde das nicht lösen, sondern
verschieben — dann könnte der Host schummeln statt des Gastes. Für zwei Freunde ist das
die richtige Wahl, und sie steht in der Anleitung statt nirgends (T-M39-07).

---

## 2026-09-13 · Delegation per /goal vom 2026-09-13 · Alle offenen Punkte außer Mehrspieler und iPhone-App gehen an den Agenten

**Entscheidung (Noah, per /goal):** Der Agent schließt alle offenen Punkte des Projekts ab —
**außer dem Mehrspieler (M37–M39) und der iPhone-App** (`WorldWar-Mobil`). Damit sind die
Spielentscheidungen delegiert, die `WORKFLOW.md` §2 bis heute „bei Noah" führte: die Marken
der Zwischenziele, die Vorgabehaltung, und ob die stillen Eröffnungstage zu lang sind.
Präzedenz ist die Playtest-Delegation vom 2026-09-07 (oben).

**Umfang:** **M41** „Pflege nach M34" (T-M41-01 bis -07), **M40** „Die Haltung wird ein
Auftrag" (D30, R-UNIT-09), **M35** Zwischenziele (D31, R-GAME-08) und **M17** „Tiefe zwischen
den Kriegen" (Planung als T-M17-01). Baureihenfolge **M41 → M40 → M35 → M17**, in `tasks.yaml`
als Abhängigkeiten eingetragen: M41 berührt weder `data/rules` noch Zustand noch Golden-Master,
M40 nur die KI-Schleife, M35 und M17 beide.

**Die Regel für den Bau: ein Parameterlauf am Ende, dazwischen ist die Abnahme absichtlich
rot.** M35 und M17 ändern `data/rules` mehrfach. Nach jeder Änderung einen einstündigen
`pnpm balance:sweep` zu fahren, misst Zwischenstände, die nie ausgeliefert werden; verglichen
werden am Ende Siegtag, Eroberungen, Anteil des Stärksten und Siegverteilung, und die trägt
schon der Grundlauf (Muster T-M34-07). Deshalb läuft der Parameterlauf **einmal**, in T-M17-16,
nach der letzten Regeländerung. Von T-M35-02 bis dahin ist `pnpm acceptance` wegen des
Frische-Wächters **rot, und das ist Absicht**; während des Baus sagt es eine Zeile in
`WORKFLOW.md` §0, damit ein unterbrochener Stand erklärt ist. Turnier (13 s),
`progress.slow.test.ts` und die Vollpartie bleiben je Aufgabe erlaubt.

*(Umgerichtet am 2026-09-13, Folge von Noahs Entscheid „M17 machen wir später": der eine
Parameterlauf läuft im **Schlussblock nach M35**, nicht in T-M17-16 — sonst fände er nie
statt, und die Abnahme bliebe dauerhaft rot. T-M17-16 behält seine eigene Abschlussmessung für
den späteren M17-Bau.)*

**Wie jede delegierte Entscheidung festgehalten wird:** mit Datum, Daten, Begründung und dem
Satz „kippbar: …" — was man ändern müsste, wenn Noah anders entscheidet. Die fünf Einträge
darunter sind die ersten.

**Auswirkung:** zwei neue Meilensteine (M40, M41), zwei neue Anforderungen (R-GAME-08,
R-UNIT-09, Abschnitt 2.18), zwei neue Entwürfe (D30, D31); `FORTSCHRITT.md` §3 und
`LEVEL-UP-3.md` §5 tragen datierte Korrekturen.

---

## 2026-09-13 · T-M35-02 · Die vier Marken der Zwischenziele: 25 Provinzen, 400 ‰, 300 ‰ Weltbevölkerung, 600 ‰ (delegiert)

**Entscheidung:** `goalProvinces` 25, `goalPointShareFirstPermille` 400,
`goalPopulationSharePermille` 300, `goalPointShareSecondPermille` 600.

**Die Daten.** Erster Spieltag, an dem eine Macht die Marke erreicht; drei ganze Partien, acht
Mächte, Weltkarte, gemessen am 2026-09-13 in der Planung (Lauf mit Startzahl 1914 trifft den
eingecheckten AK-1 genau: Tag 471, 1827 Eroberungen). Der Sieger war jedes Mal Russland. Die
Messskripte sind nicht eingecheckt; T-M35-06 misst als Test neu.

| Marke | Sieger 1914 (Sieg Tag 471) | Sieger 2015 (Sieg Tag 583) | Sieger 1914 mit KI-Gebäudeausbau (Sieg Tag 554) | Zweiter, China (1914) |
|---|---|---|---|---|
| 25 Provinzen | 129 | 119 | 118 | 140 |
| 50 Provinzen | 187 | 170 | 176 | nie (Spitze 31) |
| 80 / 100 Provinzen | 310 / 447 | 362 / 527 | 419 / 506 | nie |
| Punktanteil 250 ‰ | 143 | 125 | 135 | **Tag 15** |
| Punktanteil 400 ‰ | **221** | **222** | **220** | nie (Spitze 338) |
| Punktanteil 500 / 600 ‰ | 315 / 365 | 358 / 486 | 424 / 506 | nie |
| Weltbevölkerung 250 / 300 ‰ | 240 / 274 | 222 / 329 | 229 / 369 | 300 ‰ an Tag 290, nur im Lauf mit Gebäudeausbau |

**Begründung.** **25 Provinzen** fallen beim Sieger um Tag 120 und sind auch für den Zweiten
erreichbar — das erste Ziel soll mehr als eine Macht erreichen. **400 ‰** trifft in allen drei
Läufen Tag 220–222, der Zweite erreicht es nie; niedriger wäre es geschenkt: China und Indien
stehen an Tag 25 schon bei 237–292 ‰. **300 ‰ Weltbevölkerung** fällt an Tag 274–369, **600 ‰**
an Tag 365–506 — ein Endspurt 50 bis 100 Tage vor dem Sieg. Die Reihenfolge der vier hält in
allen drei Läufen. Die Provinzmarke ist absolut: mit weniger Gegnern fällt sie früher (im
Grundlauf mit sechs Europäern erreichte Italien 25 Provinzen und 400 ‰ an Tag 91) —
hingenommen.

**Gegenrede:** die Marken stammen aus KI-Partien mit immer demselben Sieger. Ein Mensch mit
den USA (vier Provinzen, 93 ‰ zu Beginn) steht anders da, und zwei der vier Ziele sind
Punktanteile. T-M35-06 misst eine zweite Startzahl als Zahl mit.

**kippbar:** vier Zahlen in `data/rules/default/constants.json` samt Zeilen in `BALANCING.md`;
kein Code. Danach Frische-Wächter (Parameterlauf und Turnier neu einchecken) und T-M35-06 neu
fahren — dessen Zusicherung „die Tage steigen in der Reihenfolge der Marken" kann dann fallen.

*(Nachtrag 2026-09-13: Sie ist gefallen. Die Bevölkerungsmarke steht seit T-M35-06 auf **350 ‰**; Eintrag unten.)*

---

## 2026-09-13 · T-M40 · Die Vorgabehaltung bleibt `defensive`, und die Automatik führt nur menschliche Armeen (delegiert)

**Entscheidung:** Neue und zurückgewichene Armeen stehen weiter auf `defensive`, und
`defensive` deckt künftig selbsttätig (D30.4). Die neue Haltung `garrison` ist die Abwahl. Der
Adjutant läuft nur für Mächte mit `kind: 'human'`.

**Begründung.** Noahs Wunsch ist, dass Angriff und Verteidigung sich selbst ausführen — ohne
eine Einstellung, die man erst finden muss. Mit `garrison` als Vorgabe fände ein neuer Spieler
die Automatik nie. Der Grund, den `LEVEL-UP-3.md` §5.4 für `garrison` nannte — Golden-Master
und alte Partien unverändert —, **entfällt**, weil kein Golden-Master eine Automatik in
`packages/ai` sieht (D30.5): `tiny-500` rechnet ohne Befehle und KI, der Durchstich über
`runTicks`, und in der Vollpartie hat der Mensch keine Armee. Nur menschliche Armeen, weil jede
KI-Armee nach Rückzug und Aushebung auf `defensive` steht (`phases/retreat.ts`,
`phases/recruitment.ts`): eine Automatik für alle würde Turnier, Parameterlauf und AK-1
verschieben.

**Kosten:** keine Migration, kein Feld, `SCHEMA_VERSION` bleibt. Ein alter Spielstand mit
menschlichen Armeen fängt nach dem Laden an zu decken — hingenommen.

**Gegenrede:** dieselbe Haltung bedeutet bei Mensch und KI Verschiedenes; eine KI-Armee auf
`defensive` deckt nicht, sie folgt `military.ts`.

**kippbar:** Vorgabe `garrison` — `phases/recruitment.ts` und `phases/retreat.ts` setzen
`garrison` statt `defensive`; das verschiebt alle Läufe mit Rückzügen oder Aushebungen, also
Golden-Master neu. Automatik auch für die KI — den `kind`-Filter in `adjutant.ts` entfernen,
dann Turnier, Parameterlauf und AK-1 neu messen.

---

## 2026-09-13 · T-M41-01 · Die KI baut nur die Fabrik aus — die Kaserne Stufe 2 reißt R-AI-06 (delegiert)

**Entscheidung:** `nextBuildingFor` baut die Fabrik in Städten bis zu ihrer `maxLevel`;
Kaserne, Eisenbahn und Hafen bleiben bei „genau einmal".

**Die Daten** (vier Reparaturen, am 2026-09-13 im Speicher gepatcht gemessen):

| Variante | Turnier schwer:leicht / schwer:normal Frieden / schwer:normal Krieg | Grundlauf 12 × 120 Tage (Anteil, Eroberungen, Überlebende) | Vollpartie 1914 |
|---|---|---|---|
| heute | 1,00 / **0,70** / 1,00 | 0,4442 / 302,3 / 5,17 | Tag 471, keine Stufe 2 |
| Fabrik + Eisenbahn + Kaserne | 1,00 / **1,00** / 0,58 | 0,4016 / 292,8 / 5,08 | Tag 554, Fabrik Stufe 2 in 44 Provinzen, Stufe 3 in 9 |
| nur Kaserne | wie die Zeile darüber — **die Kaserne ist die Ursache** | – | – |
| nur Eisenbahn | wie heute | – | – |
| **nur Fabrik** (bis `maxLevel`, nur Städte) | **wie heute** | **wie heute, auf vier Stellen** | Tag 449, 31 Fabriken Stufe 2 begonnen, keine Stufe 3 |

**Begründung:** die Kaserne Stufe 2 macht aus „schwer gegen normal im Frieden" wieder eine
Mauer — 1,00 gegen die Obergrenze 0,95 in `tournament.slow.test.ts` (R-AI-06, Entscheid
T-M34-07 oben). Die Eisenbahn bringt messbar nichts. Die Fabrik allein lässt Turnier und
Grundlauf zeilengleich und gibt der KI die zweite Achse zumindest bis Stufe 2.

**Was nicht geleistet ist:** Stufe 3 bleibt der KI in 449 Tagen unerreicht, und Tag 449 statt
471 liegt im Rauschen der Startzahl (2015 endet an Tag 583) — belegt ist nur „keine
Verschiebung".

**Nachgemessen beim Bau (2026-09-13, T-M41-01/02) — die Zahlen der letzten Tabellenzeile sind
nicht reproduzierbar.** Mit der gebauten Variante (`level('factory') < maxLevel`, nur Städte):
Turnier **zeilengleich** (1,00 / 0,70 / 1,00); Grundlauf **nicht** auf vier Stellen gleich
(0,4442 / 302,3 / 5,17 → 0,4462 / 301,3 / 5,08); Vollpartie 1914 **Tag 582** statt 449, 56
Ausbauten auf Stufe 2 und **17 auf Stufe 3** begonnen; mit Startzahl 2015 Tag 868 (vorher 583),
mit 1815 Tag 412 (vorher 774). Eine Gegenprobe mit Kappe bei Stufe 2 endet an Tag 591 — auch
sie trifft 449 nicht. **Die Entscheidung bleibt:** ihr Kriterium war das Turnier, und das hält.
Alle Zahlen in `PROBLEME.md` (2026-09-13, T-M41-02).

**Nachtrag 2026-09-13 (Nacharbeit H1 der Durchsicht, Block N2) — der Ausbau ist nur der erste
Wunsch.** Die Entscheidung „nur die Fabrik wird ausgebaut" bleibt. Geändert ist, was geschieht,
wenn der Ausbau zu teuer ist: vorher kam in der Stadt dann gar nichts, Eisenbahn, Festung und
Hafen erst nach Fabrikstufe 3. Jetzt stehen sie hinter dem Ausbau, und gebaut wird der erste
bezahlbare Wunsch; Kaserne und erste Fabrik bleiben allein, der Handel zielt weiter auf den
ersten Wunsch. Gewählt statt „Ausbau hinter Eisenbahn, Festung und Hafen einordnen", weil eine
reiche Macht die Fabrik so weiter zuerst ausbaut — die Achse aus T-M41-01 bleibt, sie sperrt nur
nicht mehr. Gemessen, Vollpartie 1914: Siegtag 582 → 430, Städte mit Eisenbahn 18 → 43, mit
Festung 13 → 41, Städte mit Fabrik und ohne Eisenbahn 39 → 2; Turnier-Siegquoten gleich. Alle drei
Startzahlen in `PROBLEME.md` (2026-09-13, H1).
*(Berichtigt 2026-09-13 nach der Durchsicht von Block N2, M2: die Ausweichliste gilt nicht nur für
Städte mit Fabrik. **Jede Provinz mit Kaserne** — auch eine Landprovinz und eine Stadt mit Fabrik 3 —
bekommt Eisenbahn, Festung, Hafen in dieser Reihenfolge und baut den ersten bezahlbaren. Vorher ging
eine solche Provinz leer aus, wenn die Eisenbahn zu teuer war, und die Suche lief zur nächsten Provinz.
Das ändert, wo zuerst gebaut wird, auch außerhalb der Fabrikstädte. Gemessen ist es nur in der Summe
der Läufe zu H1; ein Haltetest in `packages/ai/src/economy.test.ts` hält das heutige Verhalten fest.
Keine Verhaltensänderung in der Berichtigung.)*

**kippbar:** eine Zeile je Gebäude in `nextBuildingFor` (seit H1 `buildingCandidatesFor`; wer den
Ausbau wieder exklusiv will, gibt für Stufe ≥ 1 `['factory']` zurück — der Test „baut die Eisenbahn,
wenn Stufe 2 zu teuer ist" kehrt sich um). Der Haltetest „nie Kaserne Stufe 2"
(T-M41-01) nennt diesen Eintrag; wer ihn löscht, fährt danach das Turnier.

---

## 2026-09-13 · T-M41-03 · Die stillen Eröffnungstage: Ankündigung statt Datenänderung (delegiert)

**Entscheidung:** Die Freischaltungstage bleiben. Zwei Spieltage vor jeder Freischaltung
erscheint eine leise Ankündigung, die sagt, was kommt und was dafür fehlt.

**Die Daten** (`onboarding.slow.test.ts`, ausgelieferte Regeln, 16 Spieltage): Ereignisse an
Tick 43, 120 (Tag 6), 216 (Tag 10), 264 (Tag 12), 360 (Tag 16); **zwei Pausen von 96 Ticks**
(Tag 6 → 10, Tag 12 → 16) und eine von 77 (Tick 43 → 120). Das Transportschiff allein
vorzuziehen hilft nicht. Das Minimum für 77 Ticks sind zwei Datenänderungen (Transportschiff
Tag 9, motorisierte Infanterie Tag 15), für höchstens 72 Ticks vier (Hafen 5, Transportschiff
8, Festung 11, motorisierte Infanterie 14). Hinter dem Messfenster liegen größere Lücken
(Tag 20 → 28, 48 → 62, 70 → 80).

**Begründung:** vier geschobene Tage lösen drei Stellen im Messfenster und keine dahinter —
genau das Stückwerk, das der Entscheid vom 2026-09-07 („Inhalt statt Freischaltungen
verschieben") ausschließt. Die Ankündigung wirkt in jeder Lücke, ändert weder Regeln noch
Golden-Master noch AK-1 und senkt die längste Pause im Messfenster gerechnet auf 48 Ticks
(Ankündigungen an Tag 4, 8, 10, 14).

**Gegenrede:** eine Ankündigung kann wie Kosmetik wirken, und die Meldungsleiste wird lauter
— deshalb leise, ohne Alarmfarbe (M36: „nur Knappes ist laut").

**kippbar:** `availableFromDay` in `units.json`/`buildings.json` nach den Zahlen oben; dann
Frische-Wächter, Golden-Master und `BALANCING.md` nachziehen. Die Ankündigung kann bleiben.

---

## 2026-09-13 · T-M41-06 · Die Hülle hat fünf Kommandos, nicht sechs — korrigiert wird der Text, nicht die Hülle (delegiert)

**Befund:** `generate_handler!` in `apps/desktop/src-tauri/src/main.rs` registriert
**fünf** Kommandos — `saves_list`, `saves_read`, `saves_write`, `saves_remove`,
`saves_exists` —, und `TauriStorage.ts` ruft genau diese fünf. „Sechs" steht im Kommentar
`main.rs` Z. 11, in `PROBLEME.md` (AK-8, 2026-09-08), in `docs/reports/packaging.md`, in
`PROGRESS.md` und `03-TASKS.md` bei T-M28-03 und im Kommentar dazu in `tasks.yaml`.

**Entscheidung:** Die Hülle bleibt, wie sie ist; der Text wird an jeder Fundstelle mit
„korrigiert 2026-09-13: fünf" berichtigt, ohne die Historie umzuschreiben. Dazu ein Wächter,
der die Namen in `main.rs` gegen die Aufrufe in `TauriStorage.ts` hält (T-M41-06).

**Begründung:** es fehlt kein Kommando — fünf Operationen decken den Speicher-Port
vollständig ab (Liste, Lesen, Schreiben, Löschen, Existenz). Ein sechstes zu erfinden, damit
der Text stimmt, wäre die Grenze angehoben, damit die Zahl passt.

**kippbar:** wer ein sechstes Kommando braucht, trägt es in `main.rs` und `TauriStorage.ts`
ein; der Wächter hält beide gleich.

---

## 2026-09-13 · T-M17-01 · M17 wird als Ganzes geplant — Nummern, Reihenfolge, Berichtigungen

**Entscheidung:** M17 ist mit einem Doku-Commit vollständig geplant: Entwurf **D29**, neue
Anforderungen **R-DIP-08**, **R-DIP-09**, **R-AI-09**, **R-GAME-09**, sechzehn Aufgaben. Die
Nummern gelten vor dem Planungsentwurf: dessen „R-GAME-08" hat M35 genommen, M17 bekommt
**R-GAME-09**; M35 nimmt `SCHEMA_VERSION` 3, M17 **4** mit eingefrorenem **`save-v3.json`**.

**Reihenfolge:** der Ausgangswert T-M17-02 hängt an T-M35-06 und T-M41-02 — gemessen wird erst
nach dem KI-Fabrikausbau und nach M35; T-M17-03 hängt an T-M35-03, weil beide den
Formatwächter und die Migrationskette anfassen.

**Berichtigungen und Vermerke:**

- Der Eintrag vom 2026-09-11 (T-M32-03) ist datiert berichtigt: kein eigener Widerruf, die
  Bewegungsphase liest das Recht nicht, und seine Platzhalter T-M17-01/02 heißen heute T-M17-04
  und T-M17-06.
- **R-DIP-06/AK3, zweite Hälfte** („Durchmarsch erwidern") ist **nicht eingelöst** (Befund B2)
  und wird es erst mit R-DIP-08 (T-M17-04, T-M17-10). R-DIP-06 bleibt belegt, weil ihr Test
  grün ist — er prüft den Befehl, nicht die Wirkung; T-M17-04 ersetzt ihn durch einen Test auf
  den Zustand.
- **Rückfall für T-M17-11:** zugesagt wird nur Annehmen und Ablehnen von Provinzangeboten; aktives
  Kaufen und Verkaufen wird gebaut und im Integrationstor gezählt, nicht zugesichert.
- **Zwei Reihenfolgefehler des Planungsentwurfs, im Plantext korrigiert:** T-M17-03 nahm
  `rightOfWay` aus dem Typ, während die Leser erst in T-M17-04 umgestellt würden — jetzt stellt
  T-M17-03 alle Leser auf Helfer um und lässt die Schreiber vorerst beide Richtungen setzen. Und
  ab T-M17-05/07 kennt der Kern Befehle ohne Knopf; sie stehen bis T-M17-13/14 mit Verweis in
  der Ausnahmeliste des UI-Wächters.
- **Der Durchstich-Golden-Master verschiebt sich nicht durch KI-Regeln** (anders als der
  Planungsentwurf sagte): `runGame` rechnet über `runTicks` ohne die KI-Schleife.

**kippbar:** die Aufgabenschnitte; die Nummern nicht mehr, sobald T-M17-03 gebaut ist.

---

## 2026-09-13 · T-M17-04 · Die Kartenfreigabe wird ebenfalls gerichtet (delegiert)

**Entscheidung:** `sharedMap` bekommt in T-M17-04 dieselbe Bauart wie der Durchmarsch —
`aSharesMap`/`bSharesMap`, gelesen nur über `sharesMap(state, owner, viewer)` — und dieselbe
Migrationsregel: ein alter Stand mit geteilter Karte teilt sie in **beide** Richtungen.
`shareMap` setzt nur die eigene Richtung; Bündnis setzt, Bündnisbruch löscht beide.

**Begründung:** Befund B1 hat zwei Hälften. Wer seine Karte „teilt", sieht heute auch die des
anderen (`view/publicView.ts:224`) — ein Geschenk an sich selbst, einseitig auslösbar, dieselbe
Fehlerklasse wie der Durchmarsch. Der Planungsentwurf wollte nur vermerken; da T-M17-03 die
Beziehung ohnehin migriert, kostet die zweite Hälfte zwei Felder und einen Test
(R-DIP-08/AK6), eine spätere eigene Migration dagegen einen ganzen Schritt.

**Gegenrede:** R-DIP-08 wird breiter als der Entscheid T-M32-03, der nur den Durchmarsch nannte.

**kippbar:** `aSharesMap`/`bSharesMap` aus D29.1 und `toVersion4` streichen, `sharedMap` bleibt
symmetrisch, R-DIP-08/AK6 entfällt; B1 zweite Hälfte steht dann offen in `PROBLEME.md`.

---

## 2026-09-13 · T-M17-01 · Kohle-Senke, Vorratsaufbau und amphibische KI wandern nach M18

**Entscheidung:** Die zwei Befunde aus `PROBLEME.md` vom 2026-09-06, die auf M17 zeigten — Kohle
ohne Senke und der 350-fache Vorratsaufbau —, und die amphibische KI, auf die Kommentare in
`packages/ai/src/targeting.ts` und `economy.ts` als „M17" verwiesen, gehören nach **M18**.

**Begründung:** M17 gibt dem Frieden Handlungen, aber keine Ausgaben, die Güter vernichten:
Spionagesold zieht nur Geld (Geld hat keine Lagergrenze), Handelsangebote und Provinzhandel
verschieben Güter, die Summe bleibt; Wirtschaftssabotage vernichtet einen vernachlässigbaren
Teil. Eine Senke ist Gebäudeunterhalt oder Kohle im Unterhalt — das Wirtschaftspaket aus dem
Entscheid zu R-ECON-03 (2026-09-05), mit Zustand je Gebäude und eigener Migration. Die
amphibische KI war nie Teil des M17-Umfangs (Spionage, Handel, Durchmarsch, Provinzhandel).

**Zusage statt Behauptung:** M17 **misst** die Bestandssummen je Rohstoff an Tag 200 vorher
(T-M17-02) und nachher (T-M17-16); die Zahlen stehen in den Berichten, auch wenn sie sich nicht
bewegen.

**kippbar:** eine Senke in M17 aufnehmen — dann braucht T-M17-03 ein weiteres Feld je Gebäude
samt Migration und T-M17-16 einen Vergleich, der fallende Bestände zusichert.

---

## 2026-09-13 · T-M40-06 · „Beantwortet" misst im Kartenfenster, die Verfolgung misst an allem, was im Ziel steht (delegiert)

**Entscheidung.** Vier Festlegungen beim Bau von M40, keine davon stand so im Entwurf:

1. **Ein Einmarsch gilt als beantwortet**, wenn eine eigene Armee binnen des *Kartenfensters*
   ankommt (1 Tick Verzug plus die längste Marschzeit über eine eigene Binnengrenze für die
   aufgestellte Armee, Deutschland 114 Ticks) oder binnen 24 Ticks dorthin aufbricht. Die
   24-Tick-Ankunft aus D30.6 bleibt als Zahl im Bericht.
2. **„Höchstens Bs Stärke" (D30.4)** wird an der Summe aller sichtbaren Kriegsgegner in der
   Zielprovinz gemessen, nicht am Weichenden allein.
3. **Eine Provinz bekommt je Tick über beide Regeln höchstens einen Befehl** des Adjutanten.
4. **Der Garnison-Knopf kam mit T-M40-01**, und die Haltungsgruppe steht zwei mal zwei.

**Begründung.** (1) 24 Ticks sind auf der Weltkarte nicht erreichbar — die kürzeste deutsche
Binnengrenze braucht für Infanterie 25 Ticks, der Befehl fällt einen Tick nach dem Einmarsch; mit
24 hätte keine Automatik AK5 erfüllen können. Das Fenster ist **vor** der Messung nachher aus der
Karte abgeleitet und gilt für beide Läufe gleich (`PROBLEME.md`, T-M40-02). (2) Eine Verfolgerin
kämpft im Ziel gegen alle, die dort stehen. (3) Sonst schickt die Verfolgung eine zweite Armee in
eine Provinz, die die Verteidigung im selben Tick schon deckt. (4) `tsc` (`Record<Stance,
string>`) und der Wächter `ui-command-coverage` verlangen den Knopf im selben Commit wie den Wert;
in drei Spalten brach der vierte Knopf allein um.

**Daten** (`docs/reports/stance.json`, gemessen vor der M41-Nacharbeit (KI-Bauordnung)): Kontrolle
mit Garnison = vorher, Zahl für Zahl; nachher Anteil im Kartenfenster 0 → 6,6 %, Aufbruch binnen
24 Ticks 0 → 2,9 %, zwei Befehle, keine Ablehnung; Angriff drei Verfolgungen, keine Ablehnung.

**Gegenrede.** Die Wirkung ist klein (`PROBLEME.md`, T-M40-06) — ein weiteres Fenster hätte daran
nichts geändert, denn die Zahl der Befehle hängt nicht am Fenster.

**kippbar:** (1) ein anderes Fenster — `windowTicks` in `apps/headless/test/stance.slow.test.ts`
und D30.6 ändern; vorher bleibt über die Garnison-Kontrolle reproduzierbar. (2) nur den Weichenden
messen — in `packages/ai/src/adjutant.ts` die Summe `enemyStrength` durch die Stärke der weichenden
Armee ersetzen; der Test „misst an allem, was dort sichtbar steht" kehrt sich um. (3) je Regel eine
eigene `heading`-Menge. (4) das Raster `.stances` in `apps/desktop/src/ui/app.css`.

*(Vermerk 2026-09-13, T-M40-07/T-M40-10: Festlegung (1) trägt die Abnahme nicht mehr — gezählt wird je
umkämpfter Episode; (2) und (3) sind mit der Verfolgung entfallen. Siehe die zwei Einträge unten.)*

---

## 2026-09-13 · T-M40-10 · Die Verteidigung rückt nur nach, wenn eine Armee stehen bleibt — und der Angriff marschiert nie von selbst (delegiert)

**Entscheidung.** D30.4 wird ersetzt, nicht verstärkt. Eine Armee auf Verteidigung rückt nur in eine
bedrohte eigene Nachbarprovinz nach, wenn in ihrer Provinz eine weitere eigene Armee stehen bleibt;
allein marschiert sie nie. Die Verfolgung aus Haltung Angriff entfällt, mit ihr `VisibleArmy.retreating`.
Nach einem Marsch oder Rückzug ruht jede Armee fünf Spieltage (T-M40-09). Die Schwelle der Abnahme —
Provinz-Tage mit Verteidigung mindestens 98 % der Garnison, summiert über sechs Paare — wurde **nach**
der Messung des Entwurfs festgelegt.

**Die Daten** (Entwurf der Nacharbeit; Weltkarte, 200 Spieltage, Deutschland ohne Befehl, Startzahlen
1914, 2015 und 1815, Aufstellung A mit einer und B mit zwei Armeen je Provinz; die Zeilen Garnison und
M40 in T-M40-07 Zahl für Zahl nachgemessen):

| Regel | Provinz-Tage (Summe) | gegen Garnison | Verluste ohne Gefecht |
|---|---|---|---|
| Garnison | 4140 | 100 % | 0 |
| Deckung, wie M40 sie baute | 3301 | 79,7 % | 10 |
| c1: Deckung nur, wenn die Quelle unbedroht oder gedeckt bleibt | 3790 | 92 % | 9 |
| **N: nur, wenn in der Quelle eine Armee stehen bleibt** | **4181** | **101 %** | **0** |

Vorbeugend in leere bedrohte Provinzen (a) und Rückeroberung (b), je mit „Quelle unbedroht": in
Aufstellung A 1914 alle Provinzen verloren — bei 73 bis 80 % „beantworteter" Einmärsche. Verfolgung
(Aufstellung C, je Provinz eine Verteidigung und ein Angriff, mit N und Schutz vor fremdem Boden): am Ende
13 Armeen gegen 24 ohne Automatik, 1914 vier Armeen binnen zehn Tagen nach einem Befehl vernichtet.

**Begründung.** Gefechte auf der Weltkarte dauern im Median ein bis drei Ticks, eine Binnenetappe 25 bis
113: wer auf ein Gefecht reagiert, kommt zu spät, und wer dafür seine Provinz räumt, verliert sie. N ist
die einzige gemessene Regel ohne Schaden — sie „schadet nicht", sie „hilft" nicht belegbar. Die Schwelle
steht bei 98 % statt 100 %, weil N in einem Einzellauf (1815 B) drei Prozent unter der Garnison lag; eine
strengere Schwelle kippte die Regel an einer schwachen Startzahl. Die Verfolgung schadete in jedem Lauf,
in dem sie einen Anlass hatte.

**Gegenrede.** Mit einer Armee je Provinz tut N nie etwas. Sie ist ehrlich, aber Noahs Satz „Angriff und
Verteidigung führen sich selbst aus" löst sie nicht spürbar ein — dazu die offene Frage unten.

**Rücknahmekriterium.** Die Regel bleibt nur, solange der Episoden-Messlauf (`stance.slow.test.ts`,
R-UNIT-09/AK5) hält: Provinz-Tage mindestens 98 %, je Paar keine zusätzlichen Verluste ohne Gefecht,
keine Ablehnung, kein Krieg ohne Erklärung. Fällt eine Zusicherung — etwa weil M17 die KI verändert —,
wird die Regel **zurückgenommen, nicht nachgeschärft**: `adjutantCommands` gibt für `defensive` nichts
mehr zurück, die Verteidigung kämpft wie die Garnison, und die Hinweise sagen das.

**kippbar:** die Bedingung „eine weitere Armee bleibt" in `packages/ai/src/adjutant.ts` (danach den
Messlauf fahren); die Verfolgung aus der Geschichte von `adjutant.ts` samt `retreating` in
`packages/core/src/view/publicView.ts`; die Ruhe `ADJUTANT_REST_TICKS`.

---

## 2026-09-13 · T-M40-10 · Offene Frage an Noah: Aufträge statt einer Automatik, die auf die Nachbarprovinz schaut (nicht entschieden, nicht gebaut)

**Die Frage.** Noahs Wunsch „Angriff und Verteidigung führen sich selbst aus" ist mit einer Automatik,
die auf die Nachbarprovinz schaut, auf der Weltkarte **nicht spürbar** einzulösen — gemessen, nicht
vermutet: ein Gefecht ist etwa zehnmal kürzer als ein Marsch, und jede reagierende Regel kam zu spät oder
entblößte (Tabelle im Eintrag darüber). Was gebaut ist, ist ehrlich und schadet nicht, entlastet aber
kaum.

**Was spürbar entlasten würde** — beides eine neue Entscheidung:

1. **Ausdrückliche Aufträge** des Spielers: „halte Provinz X mit N Armeen, fülle nach", oder ein
   Sammelbefehl („alle Armeen dieser Gegend nach X"). Der Spieler sagt einmal, was er will, und die
   Automatik führt es über viele Stunden aus, statt aus der Nachbarschaft zu raten.
2. **Rückeroberung** einer verlorenen Heimatprovinz mit höchstens gleich starkem Gegner. Die Datenquelle
   ist ohne neues Zustandsfeld vorhanden — die Heimat aus `map.startPositions` und `player.nation`,
   „kürzlich verloren" aus dem öffentlichen `occupiedSince`. Unter N gemessen: ein Anlass in drei
   Partien, kein belegter Nutzen.

**Was es kostet.** (1) braucht einen Auftrag im Zustand — Schemastufe, Migration, eine Oberfläche zum
Setzen und Aufheben — und einen eigenen Messlauf; (2) nur Code in `packages/ai`, aber eine Messung, die
einen Nutzen zeigt, bevor gebaut wird. Beides gehört in einen eigenen Meilenstein, nicht in die
Nacharbeit von M40.

**Status:** offen — wartet auf Noah.

---

## 2026-09-13 · T-M40-13 · Ein Marsch der Automatik steht als leise Zeile im Protokoll (delegiert)

**Entscheidung.** Befiehlt die Automatik einen Marsch, steht im Protokoll „Armee X rückt von selbst nach
Y nach." mit Sprung auf die Zielprovinz — Rubrik Kampf, ohne Alarmfarbe, ohne Eintrag in der
Meldungsleiste, ohne Halt des Vorspulens. Die Zeile entsteht aus den Befehlen, die `commandsForTick`
der Automatik zuschreibt (`AdvanceResult.adjutant`, `FastForwardChunkResult.adjutant`), und lebt nur in
der Oberfläche: kein Ereignis des Kerns, kein Zustandsfeld.

**Begründung.** Befund M3 der Durchsicht: eine Armee marschierte, und der Spieler erfuhr nicht, warum —
er sah eine Armee unterwegs, die er nie geschickt hatte. Ein Ereignis im Kern hätte Ereignistyp,
Textkatalog, Zielgruppe und das Protokoll im Spielstand berührt; die Befehle der Automatik liegen in
der Schleife ohnehin vor. Leise nach M36 („nur Knappes ist laut"): der Marsch ist eine Auskunft, keine
Lage, die Handeln verlangt — und seit T-M40-10 selten.

**Gegenrede.** Die Zeilen gehören nicht zum Spielstand; nach dem Laden fehlen die Märsche vor dem Laden
im Protokoll. Hingenommen: die marschierende Armee zeigt die Karte weiter.

**kippbar:** eine Meldung in der Leiste statt der Zeile — `alertsFor` in `apps/desktop/src/ui/Alerts.tsx`
um eine Art erweitern, gespeist aus `adjutantMarches` in `App.tsx`; ganz ohne Zeile — `noteMarches` in
`App.tsx` nicht mehr aufrufen.

---

## 2026-09-13 · T-M41-08 · Drei Zusagen aus M14 und M15 werden zurückgenommen, nicht gelockert (delegiert)

**Entscheidung.** Beim Einlösen der Zusagen von T-M14-11, T-M14-12 und T-M15-08 — jetzt im
90-Tage-Lauf der ausgelieferten Voreinstellung in `apps/headless/test/ai-integration.slow.test.ts` —
werden drei zurückgenommen:

1. **„Je KI-Macht trägt am Ende mindestens eine Armee `armyRange > 0`"** (T-M14-12).
2. **„R-AI-01 bekommt eine zusätzliche AK für den Ablehnungsanteil"** (T-M14-11). Sie wurde nie
   gebaut und wird nicht gebaut.
3. **Von den „neun Zahlen je Stufe" im Turnier** (T-M15-08) bleiben zwei: die Kriegserklärungen von
   „schwer" und „normal", gezählt nach dem **Handelnden**. Zurückgenommen sind der selbsttätige
   Beschuss je Stufe (alle drei), die Kriegserklärung von „leicht" und der Handel über der
   Regelmarge (alle drei).

Dazu eine Messfrage: das Turnier zählt Kriegserklärung und Beschuss jetzt auch nach dem Handelnden
(`byDifficulty` in `apps/headless/src/tournament.ts`). Die alten Felder zählen jede Partie für beide
antretenden Stufen und bleiben, weil der Bericht sie seit M15 führt.

**Begründung.**
(1) Die Zusage war Mittel zum Zweck: eine einzelne Artilleriearmee auf einer Stufe sollte R-BAT-08/AK3
nicht unabnehmbar machen. R-BAT-08/AK3 ist bedingt („WENN eine KI-Macht Artillerie besitzt und im Krieg
ist …") und in `packages/ai/src/decide.test.ts` gebucht; ob Artillerie im Spiel lebt, sichert der
200-Tage-Lauf (Artillerie > 0, selbsttätiger Beschuss > 0). „Jede Macht" wäre eine Zusage über die
Truppenmischung (`TARGET_MIX`, `recruitShare`), nicht über die Fähigkeit.
(2) Eine neue AK zöge R-AI-01 aus `name_level` (`01-REQUIREMENTS.md` 2.14), und jedes seiner Kriterien
müsste einzeln gebucht werden — für eine Zahl, die jetzt ohnehin im 90-Tage-Lauf zugesichert ist.
(3) In einer Partie zu zweit stammt jede Kriegserklärung aus dem Verhältnis; einen Bündnisfall gibt es
nicht. „Leicht" tritt im Turnier nur in einer Paarung an, und die beginnt im Krieg. Beschuss in 40
Spieltagen auf der Testkarte setzt Fabrik und Artillerie ab Tag 34 voraus. Eine Regelmarge für den
Handel gibt es nicht: `tradeCommands` tauscht ein Zehntel des größten Bestands gegen das, was fehlt;
die Marge aus R-AI-08/AK1 gilt Angeboten. „Handel je KI-Macht" aus T-M14-12 ist im 90-Tage-Lauf
zugesichert.

**Daten** (Stand `4854465` mit T-M41-08): Voreinstellung 90 Tage — Armeen mit Reichweite **0 von 7
Mächten**; Weltkarte 200 Tage — **1 von 8**. Turnier je Stufe nach dem Handelnden: Kriegserklärungen
leicht **0**, normal **110**, schwer **70**; selbsttätiger Beschuss **0 / 0 / 0**
(`docs/reports/ai-tournament-run.md`, `docs/reports/ai-integration.json`).

**Gegenrede.** Der Beschuss im Turnier war die zweite Hälfte von R-BAT-08/AK3 („SOLL ihre Artillerie im
Turnier Beschussereignisse erzeugen"). Er ist heute je Stufe nirgends belegt, nur als Summe im
200-Tage-Lauf, und dort dünn (`PROBLEME.md`, T-M41-08, Nebenbefund a und d).

**kippbar:** (1) eine Zusicherung über `armeenMitReichweiteJeMacht` in `ai-integration.slow.test.ts` —
setzt eine KI voraus, die Artillerie je Macht aushebt. (2) ein Kriterium AK2 bei R-AI-01, dann R-AI-01
aus `name_level` streichen und alle Kriterien buchen. (3) ein Turnier über mehr Spieltage oder auf der
Weltkarte (`days` in `apps/headless/test/tournament.slow.test.ts`, kostet Laufzeit) und eine
Handelsmarge als Regelgröße in `data/rules/default/ai.json`.

---

## 2026-09-13 · T-M41-10 · Zurückgenommen nach seinem Rücknahmekriterium — „höchstens drei Armeeobjekte je Provinz" geht mit der Messung nach M18 (delegiert)

**Entscheidung.** T-M41-10 („die KI legt wirklich zusammen": `consolidateCommands` legt je Denkschritt alle
Provinzen zusammen, der Deckel zählt Einheiten statt Stapel) wird **nicht** übernommen. Die Aufgabe steht auf
`todo` mit `reopened`; die Zusage 7 aus T-M14-12 („keine KI-Macht hält mehr als drei Armeeobjekte in derselben
Provinz") ist mit der Messung nach **M18** verschoben. Keine Grenze ist bewegt, keine Zusicherung gelockert.

**Das Kriterium, vor dem Bau festgelegt** (Orchestrierung, Block N2 §3d): Vollpartie 1914/2015/1815 mit Siegtag
im Tor 300–1500 und AK-1 entschieden, **und** `ai-integration` 200 Tage grün, **und** das Turnier im Band von
R-AI-06 (schwer gegen normal 0,55–0,95). Reißt eines davon, wird T-M41-10 zurückgenommen.

**Ergebnis** (gebaut, gemessen, zurückgesetzt; vorher = Stand nach T-M41-09):

| Kriterium | Ergebnis |
|---|---|
| `ai-integration` 200 Tage grün | **gerissen** — Artillerie 63 → **0**, selbsttätiger Beschuss 231 → **0**; R-AI-08/AK3 („führt Artillerie und lässt sie feuern") rot |
| Turnier im Band R-AI-06 | gehalten — zeilengleich (0,70 / 1,00) |
| Vollpartie 1815 | gehalten — Tag 583 → 456, entschieden |
| Vollpartie 1914 | gehalten — Tag 975 → 842, entschieden |
| Vollpartie 2015 | gehalten — Tag 583 → 1003, entschieden |

Dazu: die neu gefasste Zusage selbst hielt **auch mit der Reparatur nicht** — stehend höchstens 5 Armeeobjekte
einer Macht in einer Provinz in der Voreinstellung (vorher 5, an 2 statt 1 Tag), auf der Weltkarte 11 (vorher 12).

**Begründung.** Das Kriterium ist gerissen, und zwar dort, wo es die Änderung sehen sollte: im Integrationstor der
Artilleriekette. Eine Reparatur, die eine abgenommene Anforderung (R-AI-08/AK3) tot macht, um eine Zusage nicht
einmal einzulösen, ist keine. Warum die Artillerie verschwindet, ist **nicht gemessen**; naheliegend ist
`TARGET_MIX` in `packages/ai/src/economy.ts`, das Stapel zählt, nicht Einheiten — ein Zusammenlegen verschmilzt die
Infanteriestapel mehrerer Armeen zu einem, der Rückstand der Infanterie wächst scheinbar, und die Artillerie kommt
nie an die Reihe. Warum „stehend ≤ 3" trotzdem nicht hält, ebenso wenig; naheliegend: der Deckel in Einheiten legt
zwei große Verbände zusammen und lässt jeden weiteren stehen, und jede Macht denkt nur jeden siebten oder achten Tick.

**Daten:** `PROBLEME.md` (2026-09-13, T-M41-10), Rohdaten der Läufe im Bericht zu Block N2.

**kippbar:** T-M41-10 erneut bauen, sobald `TARGET_MIX` Einheiten statt Stapel zählt (sonst reißt das Artillerie-Tor
wieder) und geklärt ist, ob der Deckel in Einheiten mit „stehend ≤ 3" überhaupt verträglich ist — dieselben zwei
Tests in `packages/ai/src/decide.test.ts` und die Zusicherung „stehende Armeeobjekte ≤ 3" in
`apps/headless/test/ai-integration.slow.test.ts` (Fassung im Bericht zu Block N2), dasselbe Kriterium.

---

## 2026-09-13 · R-BAT-08/AK3 · Offene Frage: in der ausgelieferten Partie schießt keine KI — nicht entschieden, an Noah bzw. M18

**Keine Entscheidung.** Dieser Eintrag hält eine Frage fest, die ein Agent nicht delegiert beantworten soll: Soll die
KI auf der Stufe „normal" in den ersten 200 Spieltagen Artillerie führen und selbsttätig schießen? Heute tut sie es
nicht. Keine Grenze wurde geändert, das KI-Balancing nicht umgebaut (Durchsicht von Block N2, H1).

**Daten** (`docs/reports/ai-integration.json`, Stand nach Block N2 und seiner Nacharbeit):
- **Voreinstellung** (Startzahl 1914, sieben KI „normal"), 200 Tage: 3 Artillerien (nur China), **0 selbsttätige
  Beschüsse**; Fabriken begonnen Russland 5, China 6, Indien 1, sonst keine. An Tag 90: 0 / 0.
- **Integrationslauf** (Weltkarte, acht KI gemischt), 200 Tage: 63 Artillerien und 231 Beschüsse — **alle von China**
  („schwer"). Frankreich, ebenfalls „schwer", hebt keine aus; „normal" und „leicht" keine.
- **Turnier** (Testkarte, 40 Tage): selbsttätiger Beschuss 0 auf jeder Stufe (T-M41-08).
- **R-BAT-08/AK3 ist für „normal" nicht belegt.** Das Tor aus R-AI-08/AK3 („Artillerie > 0, Beschuss > 0") ist nach
  Wortlaut grün, weil der Integrationslauf eine „schwere" Macht mit Fabriken enthält; T-M41-10 hat es schon einmal
  auf null gebracht.

**Warum nicht jetzt gebaut.** Die Engstellen — Fabrik und Geld im Aushebebudget (`recruitShare` 80 / 200 / 280 ‰ gegen
200 000 Geld je Artillerie) — sind Balancing der KI-Stufen. Jede Stellschraube verschiebt die ganze Partie (Block N2
hat den Siegtag mit Startzahl 1914 von 582 über 430 auf 975 bewegt) und R-AI-06 im Turnier. Das gehört in einen
eigenen, gemessenen Plan, nicht in eine Nacharbeit.

**Mögliche Wege, ohne Wertung:** (1) `TARGET_MIX` in `packages/ai/src/economy.ts` in Einheiten statt Stapeln zählen
(T-M41-10 hat gezeigt, dass die Stapelzählung die Artillerie verdrängen kann); (2) die Aushebung nicht nur in der
vielseitigsten Provinz fragen; (3) das Aushebebudget je Einheit an den Preis statt an einen festen Anteil binden;
(4) die Zusicherung schärfen — Artillerie je Stufe oder in der Voreinstellung — erst, wenn einer der Wege gebaut ist.

**kippbar / Ort:** keine Zeile ist geändert. Wer die Frage aufnimmt, misst in `apps/headless/test/ai-integration.slow.test.ts`
(`voreinstellung200`, `maechteMitArtillerie`, `jeStufe`) und fährt danach Vollpartie, Turnier und Grundlauf.

---

## 2026-09-13 · T-M40-14 · Ein eigener Marschbefehl stellt eine Verteidigung auf Garnison, und die Ruhe zählt weiter ab dem Abmarsch (delegiert)

**Entscheidung.**
- Befiehlt der Spieler selbst einer eigenen Armee in Haltung Verteidigung einen Marsch, schickt die Oberfläche
  mit `MOVE_ARMY` zugleich `SET_STANCE garrison` in denselben Tick, wie beim Anhalten (T-M40-11).
- Die Regel steht einmal als `garrisonFollowUp` in `packages/ai/src/adjutant.ts`; Anhalten und „Marsch befehlen"
  lesen sie.
- Die Ruhe der Automatik zählt weiter ab dem Abmarsch (`deployDelayUntil + 120`). Hinweis, Anleitung,
  R-UNIT-09/AK7 und D30.4 sagen das wörtlich.
- Die Pendel-Kennzahl im Haltungs-Messlauf zählt ab `ARMY_ARRIVED`.

Entschieden vom Orchestrator nach der Durchsicht der Nacharbeit, Optionen 2 und 3 aus Befund H-A.

**Begründung.** Befund H-A: Nach einem Marsch von 117 Ticks blieben sechs Ticks Ruhe; dann schickte die
Automatik die eben verlegte Armee weiter (Szenario R1). Ein Marsch ab 122 Ticks lässt gar keine Ruhe.
„Der Spieler hat sie dorthin gestellt" drückt das Anhalten schon aus. Mit dem Folgebefehl gilt Befund H2 der
ersten Durchsicht auch für eigene Märsche, ohne Zustandsfeld.

**Verworfen.** Option 1 der Durchsicht: der Ankunftstick als Zustandsfeld (`phases/movement.ts`), damit die
Ruhe ab der Ankunft zählt. Er kostet Schemastufe, Migration und neue Golden-Master für eine Randlage, die der
Folgebefehl ohnehin abdeckt.

**Gegenrede.**
- Wer eine Armee verlegt und danach wieder Verteidigung wählt, bekommt die Ruhe ab dem Abmarsch, nach einem
  langen Marsch also keine. Hingenommen; der Hinweis sagt es.
- Ein Marsch, den der Kern ablehnt, stellt die Armee nicht um: Der zweite Befehl geht nur mit, wenn der erste
  angenommen wurde. Das gilt seitdem auch für das Anhalten.

**kippbar:** Ohne Folgebefehl beim Marsch behandelt `garrisonFollowUp` nur `STOP_ARMY`. Dann fallen Szenario R1
in `packages/ai/src/loop.test.ts`, die Tests zum Marsch in `adjutant.test.ts` und `actions.test.ts` sowie
T-M40-14 in `App.test.tsx`.

---

## 2026-09-13 · T-M40-15 · Ein Rückzug-Klick zählt für die Automatik als Ausrücken, und der Knopf bleibt ohne Gefecht wirksam (delegiert)

**Entscheidung.** Die Automatik zählt einen Befehl `SET_STANCE` mit `retreat` im selben Tick wie einen Marschbefehl:
Die Armee rückt aus, und eine Verteidigung derselben Provinz darf nur ausrücken, wenn danach noch eine weitere Armee
stehen bleibt (`packages/ai/src/adjutant.ts`). Den Rückzug-Knopf binden wir nicht an ein Gefecht. Stattdessen sagt
die Anleitung nicht mehr „nur im Gefecht". Entschieden vom Orchestrator nach Befund M-A der Durchsicht der Nacharbeit.

**Begründung.** Szenario R2: In n3 standen eine Verteidigung und eine Garnison, und n2 war angegriffen. Der Spieler
zog die Garnison zurück. `SET_STANCE` prüft kein Gefecht, und `phases/retreat.ts` lässt jede Armee auf Rückzug
ausweichen. Im selben Tick schickte die Automatik die Verteidigung nach n2; nach 25 Ticks stand keine eigene Armee
mehr in n3 (R-UNIT-09/AK1). Die Automatik muss sehen, was der Klick tut, nicht was der Knopf verspricht.

**Warum der Knopf bleibt.** Einen Rückzug an ein Gefecht zu binden, wäre eine neue Regel des Kerns: eine Prüfung in
`commands/handlers.ts`, dazu eine Oberfläche, die das Gefecht kennt, und eine Frage an den Golden-Master. Das gehört
nicht in eine Nacharbeit der Automatik. Die Anleitung stimmte schon länger nicht.

**kippbar:** Soll der Rückzug nur im Gefecht wirken, prüft `SET_STANCE` mit `retreat` in `commands/handlers.ts` ein
Gefecht in der Provinz; danach `pnpm test` ohne `UPDATE_GOLDEN`. Die Zählung in `adjutant.ts` darf trotzdem bleiben.

---

## 2026-09-13 · T-M40-16 · Der Haltungs-Messlauf läuft nicht je Abnahme, ein Frische-Wächter hält ihn aktuell (delegiert)

**Entscheidung.** `pnpm acceptance` fährt `apps/headless/test/stance.slow.test.ts` nicht. Stattdessen prüft
`stanceReportStatus` (`scripts/acceptance-criteria.mjs`) als Messgerät, ob der eingecheckte Lauf noch gilt:
- `docs/reports/stance.json` ist nach Commit-Zeit jünger als die letzte Änderung unter `packages/ai/src` und
  unter `packages/core/src`;
- der eingecheckte Lauf hat AK5 erfüllt.

Trifft eins davon nicht zu, ist die Abnahme rot, und die Meldung nennt den Befehl, der den Lauf neu fährt.
Entschieden vom Orchestrator nach Befund M-B der Durchsicht der Nacharbeit.

**Begründung.** Das Rücknahmekriterium der Automatik (R-UNIT-09/AK5, D30.9) lief in keiner Prüfkette. Nach dem
Merge von Block N2 hätte die Abnahme grün gemeldet, auch wenn AK5 gefallen wäre. Zwölf Partien dauern gut elf
Minuten, die Abnahme läuft rund sieben; mit dem Lauf dauerte sie fast dreimal so lang. Dasselbe Muster trägt seit
dem 2026-09-08 Parameterlauf und Turnier.

**Warum auch AK5 im Bericht.** Der Test schreibt den Bericht, bevor er zusichert. Ohne diese Prüfung machte schon
ein eingecheckter, gescheiterter Lauf den Wächter grün. Das ist eine Ergänzung zum Auftrag, der nur die Frische
nannte.

**Gegenrede.** Jede Änderung unter `packages/core/src` färbt die Abnahme rot, auch eine, die die Automatik nicht
berührt. Hingenommen: Das ist die sichere Richtung, und die Abnahme läuft ohnehin erst am Ende eines Blocks. Wer
weiß, dass sich nichts verschoben hat, belegt es mit dem Lauf, nicht mit einem Satz. Für M35 heißt das: nach dem
Bau den Haltungs-Messlauf neu fahren und einchecken, bevor die Abnahme gilt.

**kippbar:** Engere Pfade in `scripts/acceptance.mjs`, etwa nur `packages/ai/src/adjutant.ts` und `packages/core/src/phases`.
Oder der Lauf kommt doch in die Abnahme, mit `run(...)` wie AK-1.

---

## 2026-09-13 · T-M35-06 · Die Bevölkerungsmarke steigt von 300 ‰ auf 350 ‰ (delegiert, Befund aus der Vollpartie)

**Entscheidung:** `goalPopulationSharePermille` 350 statt 300. Die übrigen drei Marken bleiben: 25 Provinzen, 400 ‰ und
600 ‰ aller Punkte.

**Anlass.** T-M35-06 fuhr die ausgelieferte Voreinstellung auf dem Stand nach M35. Siegtag 975, Sieger China: beides
unverändert gegenüber dem Stand vor M35. Die Zusicherung R-GAME-08/AK6 fiel: China erreichte 300 ‰ der Weltbevölkerung an
Tag 544, **drei Tage vor** 400 ‰ aller Punkte (Tag 547). Die Marken aus der Planung stammten aus drei Partien mit
Russland als Sieger, gemessen vor M41. Seit Block N2 gewinnt mit Startzahl 1914 China, und bei der bevölkerungsreichsten
Macht der Karte wachsen Bevölkerungs- und Punktanteil fast gleich schnell. Das Risiko stand in D31.7.

**Die Daten.** Erster Tag des Siegers je Marke. Gemessen hat sie ein vorübergehender Tagesverfolger über dieselben drei
Partien; er traf dieselben Siegtage und Zieltage wie die Vollpartie:

| Marke | 1914, China | 2015, Russland | 1815, Russland |
|---|---|---|---|
| 25 Provinzen | 157 | 119 | 115 |
| Punkte 350 ‰ | 482 | 202 | 210 |
| **Punkte 400 ‰** | **547** | **237** | **276** |
| Bevölkerung 300 ‰ | **544** | 299 | 326 |
| Bevölkerung 325 ‰ | 558 | 331 | 356 |
| **Bevölkerung 350 ‰** | **576** | **337** | **376** |
| Bevölkerung 375 ‰ | 587 | 374 | 382 |
| **Punkte 600 ‰** | **921** | **516** | **456** |
| Siegtag | 975 | 583 | 583 |

**Begründung.** Mit 350 ‰ hält die Reihenfolge in allen drei Partien. Der knappste Abstand zu einer Nachbarmarke beträgt 29
Tage (China: 547 → 576). 325 ‰ hielte auch, aber nur mit 11 Tagen Abstand, und die nächste Partie mit anderem Verlauf
kippte sie wieder.

**Verworfen:**
- **Die erste Punktmarke auf 350 ‰ senken** (knappster Abstand 62 Tage). Dann erreichte der Zweite sie in zwei der drei
  Partien (Russland 1914 an Tag 216, China 2015 an Tag 179), und genau das schloss die Begründung für 400 ‰ aus.
- **Die Reihenfolge der Ziele umstellen.** Russland erreicht den Bevölkerungsanteil in beiden anderen Partien 62 und 50
  Tage nach der ersten Punktmarke. Die Umstellung machte nur die zugesicherte Startzahl grün.
- **Die Zusicherung auf „nicht fallend" lockern.** Drei Tage Vorsprung wären auch dann „fallend". Eine Grenze, die man
  anhebt, damit eine Zahl passt, ist keine Lösung.

**Gegenrede.** Drei Partien, zwei verschiedene Sieger, dieselbe Aufstellung. Die Marke ist so gewählt, dass die heutige
Messung mit Abstand hält, nicht aus einem Modell. Ein Mensch mit einer bevölkerungsreichen Nation erreicht sie weiter früh.

**Was die Änderung nicht berührt.** Keine Entscheidung im Spiel liest eine Marke. `checkVictory` nicht, die KI nicht,
der Parameterlauf nicht (`WATCHED` in `sweep.slow.test.ts`). Belegt ist das zweifach. Erstens: dieselbe Partie mit Marken,
die alles, und mit Marken, die nichts erreichen, ist ohne `goals` bitgleich (`goals.test.ts`, R-GAME-08/AK4). Zweitens
sind die drei Vollpartien ohne `goals`, `measuredAt` und die Zustandsgröße gleich den Berichten vor M35. Ein Parameterlauf,
der auf der Marke 300 ‰ gestartet ist, misst deshalb dasselbe wie auf 350 ‰. Der Frische-Wächter sieht trotzdem einen
jüngeren Commit unter `data/rules`; ein nach diesem Commit eingecheckter Bericht gilt inhaltlich.

**kippbar:** eine Zahl in `data/rules/default/constants.json`, dazu die Zeile in `BALANCING.md` und die Erwartung in
`packages/core/src/rules/load.test.ts`. Danach die Golden-Master mit `UPDATE_GOLDEN=1` (die Tage in `goals` verschieben
sich) und T-M35-06 neu fahren.
## 2026-09-13 · T-M40-17 · Die Frische-Wächter urteilen nach Abstammung, und der Haltungs-Messlauf nennt seinen Messcommit (delegiert)

**Entscheidung.**
- Parameterlauf, Turnier und Haltungs-Messlauf gelten als frisch, wenn auf HEAD seit ihrem Bericht kein
  Commit an ihren Quellen liegt: `git rev-list -1 <bericht>..HEAD -- <quellen>` (`scripts/freshness.mjs`).
  Die Commit-Zeit zählt nicht mehr.
- Beim Haltungs-Messlauf zählt nicht der Commit am Bericht, sondern der Commit, auf dem gemessen wurde. Der
  Lauf schreibt `measuredAtCommit` und die uncommitteten Dateien (`measuredDirty`). Der Wächter lehnt ab:
  einen Bericht ohne Messcommit, einen an den Quellen schmutzig gemessenen und einen, dessen Messcommit nicht
  in der Geschichte von HEAD liegt.
- Die Quellen des Haltungs-Messlaufs sind `STANCE_SOURCES`, acht Pfade. Parameterlauf und Turnier sehen
  neben `data/rules` ihre Karte (`GAUGES`, `scripts/acceptance-criteria.mjs`).

Entschieden vom Orchestrator nach Befund M-1 der Durchsicht der zweiten Nacharbeit; Messcommit und Pfadliste
nach N-1, N-3 und N-7.

**Begründung.** Befund M-1, nachgebaut als Wegwerf-Repo in `test/requirements.test.ts`: Der Seitenzweig ändert
Automatik und Regeln zur Zeit 2000, main checkt die Berichte zur Zeit 3000 ein, der Merge folgt zur Zeit 4000.
Mit Commit-Zeiten meldeten Haltungs-Messlauf und Parameterlauf danach frisch, mit der Abstammung veraltet.
Außerdem galt eine Textkorrektur am Bericht als Messung (N-3), und der feste Standtext nannte `c3ff8be` für
einen Lauf auf `bf3db75` (N-7).

**Warum auch die Geschichte von HEAD.** `rev-list <messcommit>..HEAD` sieht nur Commits, die HEAD hat und der
Messcommit nicht. Ein Bericht, der aus einem anderen Zweig herüberkopiert wird, kann mit Commits gemessen
sein, die HEAD fehlen. Das ist eine Ergänzung zum Auftrag.

**Warum der Code bei Parameterlauf und Turnier außen vor bleibt.** Beide Läufe spielen mit der KI und dem
Kern; seit ihren Berichten liegen dort 20 bzw. 11 Commits. Mit den Codepfaden wäre die Abnahme heute rot, und
ein Parameterlauf dauert rund eine Stunde. Die Messgeräte vermessen nach dem Entscheid vom 2026-09-08 die
Regeln. Ob sie jedem Codecommit folgen sollen, ist eine neue Entscheidung und steht als offene Frage in
`PROBLEME.md`. **Für das Turnier gekippt am 2026-09-13:** Es folgt KI und Kern, der Parameterlauf nicht (Entscheid
„Das Turnier folgt auch KI und Kern" weiter unten).

**Gegenrede.**
- Ein Revert, der die Quellen auf den gemessenen Inhalt zurückstellt, zählt als Commit: rot, obwohl der
  Inhalt gleich ist. Das ist die sichere Richtung. Die Alternative wäre, die Baum-Kennungen zu vergleichen
  (`git rev-parse <messcommit>:<pfad>` gegen `HEAD:<pfad>`), also Inhalt statt Geschichte.
- Jeder Commit an `stance.slow.test.ts` macht den Bericht alt, auch ein Kommentar. Hingenommen: der Test
  trägt Kontrolle, Schwellen und Zählung.
- Nach Rebase oder Squash liegt der Messcommit nicht mehr in der Geschichte. Dann ist die Abnahme rot, und
  es wird neu gemessen.

**kippbar:** In `scripts/freshness.mjs` die Baum-Kennungen statt `commitsSince` vergleichen, oder
`STANCE_SOURCES` bzw. `GAUGES` enger fassen. Die Einheitsfälle in `test/requirements.test.ts` nennen beide
Listen wörtlich und fallen mit.

---

## 2026-09-13 · T-M40-19 · Der Folgebefehl der Garnison liest die gesammelten Befehle, AK7 bleibt unverändert (delegiert)

**Entscheidung.**
- `garrisonFollowUp(state, command, pending)` (`packages/ai/src/adjutant.ts`) nimmt als Haltung der Armee die
  zuletzt gesammelte `SET_STANCE` derselben Armee und desselben Spielers, sonst die aus dem Zustand.
- Die Oberfläche reicht die Sammlung als `ActionContext.pending` durch (`App.tsx`). Anhalten, Marschhinweis und
  Bestätigung lesen sie.
- R-UNIT-09/AK7 und der Hinweis zur Verteidigung bleiben unverändert: sie stimmen jetzt auch bei stehender Uhr.
- D30.7 sagt wörtlich „wenn die Vorprüfung ihn annimmt" (Befund N-4).

Entschieden vom Orchestrator nach Befund N-5 der Durchsicht der zweiten Nacharbeit, erster der zwei Wege.

**Begründung.** Befund N-5: Eine Garnison wird bei stehender Uhr auf Verteidigung geklickt und dann verlegt. Der
nächste Tick wandte [Verteidigung, Marsch] an, und die Armee marschierte auf Verteidigung. Am Bildschirm rot
vorgeführt (`App.test.tsx`). Der Kern wendet die Befehle eines Spielers in der Reihenfolge der Sammlung an;
die zuletzt gesammelte Haltung ist also die, mit der der Marsch im Tick ankommt. Das lässt sich ohne Kern und
ohne Zustandsfeld lesen.

**Verworfen.** AK7 und den Hinweis einzuschränken („die zum Zeitpunkt des Befehls auf Verteidigung steht"). Das
hätte eine Lücke beschrieben, die sich mit einem optionalen Parameter schließen ließ.

**Gegenrede.**
- Eine gesammelte Haltung zählt, auch wenn der Kern sie im Tick ablehnen würde. Die Oberfläche erzeugt keinen
  solchen Befehl, und schlimmstenfalls geht ein Garnisonsbefehl zu viel mit.
- Mehrspieler (M37): Der Folgebefehl ist Oberfläche, die Schleife ruft ihn nie; gesammelt sind nur die eigenen
  Befehle des Menschen.
- Die Sperre „schon in dieser Haltung" sieht die Sammlung weiterhin nicht — offen in `PROBLEME.md`.

**kippbar:** Ohne `pending` fallen `garrisonFollowUp` und `ActionContext.pending` auf den Zustand zurück. Dann
fallen T-M40-19 in `adjutant.test.ts`, `actions.test.ts` und `App.test.tsx`, und AK7 braucht die Einschränkung.

---

## 2026-09-13 · Frische-Wächter · Das Turnier folgt auch KI und Kern, der Parameterlauf bleibt bei Regeln und Karte (Orchestrator)

**Entscheidung.**
- `GAUGES` (`scripts/acceptance-criteria.mjs`): Das Turnier sieht `data/rules`, `data/maps/testworld.json`,
  `packages/ai/src` und `packages/core/src`.
- Der Parameterlauf sieht weiter nur `data/rules` und `data/maps/world.json`.

Entschieden vom Orchestrator auf die offene Frage aus dem Bau von T-M40-17 (`PROBLEME.md`, 2026-09-13). Für das
Turnier löst das den Absatz „Warum der Code bei Parameterlauf und Turnier außen vor bleibt" im Entscheid zu
T-M40-17 ab; für den Parameterlauf gilt er weiter.

**Begründung.**
- **Turnier:** Ein Neulauf kostet 13 Sekunden. Das Turnier ist der billige Beleg, dass eine Codeänderung die
  KI-Stärke nicht verschiebt. Dass Code Partien verschiebt, ist gemessen: Nach dem Merge von Block N2 ergab
  dieselbe Garnison im Haltungs-Messlauf 76 statt 52 Einmärsche, bei gleichen Regeln und gleicher Karte.
- **Parameterlauf:** Er dauert rund eine Stunde und misst die Empfindlichkeit der Regelzahlen. Folgte er jedem
  Codecommit, müsste er nach fast jeder Aufgabe neu laufen. Den Einfluss von Code decken das Turnier und
  `progress.slow` ab (derselbe Grundlauf, 2,5 min).

**Belegt.** In `test/requirements.test.ts` fährt ein Wegwerf-Repo die echten Einträge aus `GAUGES`. Nach einem
Commit an `packages/ai/src` meldet das Turnier nicht frisch: vor der Änderung rot („expected true to be false").
Der Parameterlauf bleibt frisch; dieser Haltetest war vorher und nachher grün. Am echten Stand (`bd4744c`) liegen
seit dem Turnierbericht `1edcb7b` 18 Commits an KI und Kern, und der Wächter meldet das Turnier nicht frisch. Das
tat er dort auch mit der alten Liste, wegen `a64be03` (T-M35-06) unter `data/rules`. Der Unterschied der Listen
ist deshalb nur im Einheitsfall belegt, nicht am echten Stand.

**Gegenrede.**
- Das Turnier spielt auch `apps/headless/src/tournament.ts` und `packages/testkit`. Beide stehen nicht in der
  Liste; ein Commit nur an der Turnierschleife bleibt unbemerkt. Hingenommen: Die Aufgaben der Meilensteine
  ändern KI und Kern.
- Das Turnier wird öfter rot, auch bei Commits am Kern, die die KI nicht berühren. Hingenommen: 13 Sekunden.
- Ein Parameterlauf kann nach einer KI-Änderung andere Zahlen liefern, ohne dass der Wächter es meldet. Sein
  Bericht gilt für die Regeln, nicht für eine bestimmte KI.

**kippbar:** In `GAUGES` die beiden Codepfade beim Turnier streichen (dann gilt wieder der Stand von T-M40-17)
oder beim Parameterlauf ergänzen. Mit fallen der Listentest in `test/requirements.test.ts` und der Block „der
Turnier-Waechter sieht KI und Kern, der Parameterlauf nicht".

---

## 2026-09-13 · Noah · M17 wird in einer späteren Sitzung gebaut

**Entscheidung:** M17 „Tiefe zwischen den Kriegen" bleibt **geplant, aber ungebaut**. Noah hat das
am 2026-09-13 um 17:10 entschieden, nachdem die hochgerechnete Dauer des /goal-Auftrags sichtbar
wurde: „M17 machen wir später" — ausdrücklich **nicht** „weniger Messtiefe". Der Plan bleibt
vollständig stehen: 16 Aufgaben, davon T-M17-01 (die Planung selbst) `done`, 15 auf `todo`.

**Begründung:** Der Auftrag lautete, alle offenen Punkte außer Mehrspieler und iPhone-App zu
schließen. M41, M40 und M35 waren zu diesem Zeitpunkt gebaut oder in Arbeit; M17 ist der größte
verbliebene Block und hätte den Schlussblock (Abnahme, Tauri-Bau, AK-8, Sichtprüfung, Doku) in die
nächste Sitzung geschoben. Lieber ein abgeschlossener, abgenommener Stand als ein halb gebauter
Meilenstein ohne Abnahme.

**Auswirkung:**
- `tasks.yaml`: M17 = **1 von 16**, Status „geplant". Kein `reopened` — nichts ist zurückgenommen,
  nur noch nicht gebaut.
- **Der eine Parameterlauf der Delegation hängt seither am Schlussblock, nicht an T-M17-16.** Er lief
  am 2026-09-13 (`5cdc611`); T-M17-16 behält die eigene Abschlussmessung des späteren M17-Baus.
  T-M35-02 und T-M35-06 zeigen deshalb auf den Schlussblock.
- `WORKFLOW.md` §2 führt M17 als geplant und wartend auf Noahs Ansage.

**kippbar:** Noah sagt an, wann M17 gebaut wird. Der Entwurf D29 und die Anforderungen R-DIP-08,
R-DIP-09, R-AI-09 und R-GAME-09 liegen unverändert vor.

---

## 2026-09-14 · Offene Fragen an Noah — gesammelt am Ende des Schlussblocks

**Keine Entscheidung, sondern ein Eintrag mit Absicht:** eine Frage, die nur in einer Übergabe
steht, überlebt keinen Merge. Hier steht, was **Noah** entscheiden muss — nicht, was noch zu bauen
wäre. Jede Zeile nennt, was gemessen ist, und was die Antwort verändern würde. Dieselbe Liste steht
in `docs/plan/UEBERGABE.md` §4 und gehört ins Artefakt.

1. **Verteidigungs-Automatik behalten?** Sie hält ihr Rücknahmekriterium (Provinz-Tage 101,8 %,
   0 ohne Gefecht verlorene Provinzen, `stance.json`), bringt aber nach Block N2 keinen messbaren
   Nutzen: befohlene Deckung kam in **0 von 19** Fällen rechtzeitig an. Behalten, abschalten
   (Verteidigung = Garnison) oder ersetzen durch **ausdrückliche Aufträge** („halte Provinz X mit
   N Armeen, fülle nach")? Gemessen (D30.9): keine Nachbarschaftsautomatik hilft auf der Weltkarte —
   Gefechte dauern 1–3 Ticks, Märsche 25–113.
2. **KI-Artillerie in der Voreinstellung tot:** 7 KI auf „normal", 200 Tage → 3 Artillerien,
   **0 selbsttätige Beschüsse** (`ai-integration.json` `voreinstellung200`); Engstelle sind Fabrik
   und Geld. Eigener Balancing-Block (M18) oder so lassen?
3. **Zusammenlegen der KI** (T-M41-10, zurückgenommen: der Deckel zählt Stapel statt Einheiten; die
   echte Reparatur tötete die Artillerie) → M18, oder früher?
4. **Handel der KI** zielt auf den teuersten Bauwunsch → M18, oder früher?
5. **Kippbare delegierte Entscheidungen bestätigen:** Marken 25 Provinzen / 400 ‰ / Bevölkerung
   350 ‰ / 600 ‰; Vorgabehaltung `defensive`; nur Fabrikausbau (Kaserne Stufe 2 reißt R-AI-06);
   Ankündigung statt Datenänderung bei den stillen Eröffnungstagen; 5 Tage Ruhe ab Abmarsch; eigener
   Marsch → Garnison; Turnier-Wächter mit Code-Pfaden, Parameterlauf ohne.
6. **Der Langlauf entscheidet die Partie in 1000 Spieltagen nicht mehr** (`performance.md`: „nicht
   entschieden", vorher Tick 19320). AK-6 misst Zeit und ist bestanden; inhaltlich passt es zu AK-1
   Tag 975 statt 471. Ist die längere Partie gewollt, oder gehört das in den Balancing-Block M18?
7. **Die Tempo-Sperre im Vorspulen ist am Bildschirm nie zu sehen** — und das ist eine
   Spielgefühl-Frage, kein Mangel. Gemessen am 2026-09-14 (`PROBLEME.md`, Sichtprüfung Punkt 2):
   ein Vorspul-Lauf ist **genau ein Häppchen von 24 Ticks** und endet synchron im Klick; ein
   Abtaster sah in 429 Abtastungen keinen einzigen gesperrten Tempoknopf. Die Zusage selbst ist
   durch `App.test.tsx` gedeckt (dort sind die Häppchen auf 4 Ticks verkleinert). Sichtbar würde
   die Sperre nur durch **ein Vorspulziel über einen Spieltag hinaus** oder **kleinere Häppchen** —
   und beides ändert, wie sich das Spiel anfühlt. Deshalb Noahs Entscheidung und keine Aufgabe.
8. **Gefechte im Vorspulen (T-M28-08) — reicht, was zu sehen ist?**
   `docs/reports/sichtpruefung-2026-09-14.md` §7 beschreibt es bewusst **ohne Urteil**, weil der
   Maßstab Noahs ist: bei angehaltener Uhr sind Gefechtsschein, Ring und Einschlagzeichen deutlich
   sichtbar; bei Tempo 10 trafen 110 Aufnahmen über 135 Spieltage **zwei** Bilder mit laufendem
   Gefecht in der gezeigten Provinz, ein zweiter Lauf mit 60 Aufnahmen **keines**. Durchgehend zu
   sehen sind die roten Plättchenrahmen, die rot umrandete Provinz und das Alarmschild in der
   Kopfleiste. Im „Vorspulen" wird gar nichts gezeichnet — ein Spieltag läuft in einem synchronen
   Zug (gemessen 206 ms). Genügt das, oder soll ein Gefecht länger stehen bleiben, als es dauert?
9. **M17** — später (entschieden, Eintrag darüber); **Mehrspieler M37–M39** und die **iPhone-App**
   unverändert offen.

**Auswirkung:** Bis eine Antwort da ist, bleibt alles, wie es gemessen wurde. Keine dieser Fragen
hat eine Aufgabe in `tasks.yaml` — das ist Absicht: ein Plan, der Fragen als Aufgaben führt, wird
nie fertig.

---

---

## 2026-09-14 · T-M37-01 · Der Platz kommt aus dem Zustand, nicht aus einer Kennung

**Entscheidung:** `defaultViewer(state)` liefert die erste **menschliche** Macht aus
`state.playerOrder`; `UiState.viewerId` ist `null`, solange niemand ausdrücklich einen Platz
gesetzt hat, und `App` nimmt ihn optional als Eigenschaft entgegen (`props.viewerId`).

**Begründung:** D28.3 verlangt „ein `viewerId` aus dem Partiezustand". Die naheliegende Fassung —
ein Vorgabewert `'p1'` in der Hülle — wäre dasselbe Literal an einer neuen Stelle und hätte den
Wächter aus T-M37-02 sofort ausgelöst. `playerOrder` ist ein ausdrückliches Feld des Zustands und
keine Schlüsselreihenfolge (`state/types.ts`, Regel 3), also ist die Antwort auf beiden Rechnern
dieselbe. `null` heißt dabei nicht „niemand", sondern „die erste menschliche Macht dieses Standes".

**Auswirkung:** Der Einzelspieler verhält sich unverändert. Der Gast einer Partie zu zweit bekommt
seinen Platz über `props.viewerId` (M39: aus dem Link) oder über die Aktion `setViewer` (M38: aus
der `willkommen`-Nachricht). `legendFor` nimmt seither die Farbe des Zusehenden als Erstes.

---

## 2026-09-14 · T-M37-03 · Eine Mehrspielerpartie beginnt vorerst lokal

**Entscheidung:** Der Anlegedialog bietet die Partieart und die feste Rate schon jetzt an. Ohne
Hostdienst (M38) beginnt eine so angelegte Partie **lokal**: zwei menschliche Mächte am selben
Bildschirm, wie der Hot-Seat, den der Kern seit M5 kann. Der Dialog sagt das ausdrücklich
(`newGame.multiplayerPending`).

**Begründung:** Die Alternative wäre, die Wahl bis M38 zu verstecken. Dann hätte T-M37-04 („zu
zweit sind Tempo, Tasten und Vorspulen aus") keinen Weg, auf dem ein Mensch ihn auslöst, und die
Zusage wäre nur im Test belegt — genau die Art Zusage, die im Browser tot ist und im Test grün
(Lehre vom 2026-09-14, `MEMORY`: „Zusage grün im Test, tot im Browser"). Ein Hinweis, der sagt, was
noch fehlt, ist ehrlicher als ein Schalter, den es nicht gibt.

**Auswirkung:** Wer heute „zu zweit" wählt, bekommt eine Partie mit zwei menschlichen Mächten,
fester Rate, ohne Tempoknöpfe und ohne Vorspulen. M38 setzt die Verbindung dahinter; die Naht ist
`App`s Eigenschaft `netplay` und sonst nichts.

---

## 2026-09-14 · T-M37-10 · Der Zustimmende legt den Tick der Pause fest, nicht der Antragsteller

**Entscheidung:** Die `ja`-Nachricht trägt `abTick = max(beantragter Tick, eigener Tick + 2)` —
gerechnet vom **Zustimmenden**, nicht vom Antragsteller.

**Begründung:** D28.7 sagt „beide halten ab Tick T+2 an", mit T aus dem Antrag. Beim Anschließen
(T-M37-11) riss genau das: zwischen Antrag und Zustimmung vergeht Bedenkzeit, und in der Zeit läuft
die Partie weiter. Gemessen im Haken-Test — der Antragsteller stand bei Tick 13, der verabredete
Halt lag bei 12. Die schnellere Seite hätte rückwärts anhalten müssen, und R-MP-05/AK2 („beide
Uhren beim **demselben** Tick") wäre gerissen. Der Zustimmende ist der Spätere von beiden: der
Gleichschritt hält die zwei Uhren höchstens einen Tick auseinander, und `+ 2` deckt diesen Tick und
den Weg der Nachricht ab.

**Auswirkung:** `pauseAnswer(state, art, { tick, delayTicks })`. Ein Test in `pause.test.ts` hält
den Fall fest („verschiebt den Halt, wenn die Zustimmung später kommt als der Antrag galt"): sechs
Ticks Bedenkzeit, und beide stehen danach bei demselben, neu gerechneten Tick.

---

## 2026-09-14 · T-M37-11 · Wer ein Auseinanderlaufen merkt, sagt es — mit beiden Prüfsummen

**Entscheidung:** `EndMessage` bekommt ein optionales Feld `hashes: Record<PlayerId, string>`. Wer
ein Auseinanderlaufen zuerst bemerkt, schickt genau **eine** `ende`-Nachricht mit beiden
Prüfsummen, je Platz benannt; `Lockstep.receiveEnd` baut daraus denselben Befund auf der Gegenseite.

**Begründung:** R-MP-04/AK1 verlangt, dass die Partie anhält **und beiden Spielern sagt**, ab
welchem Tick sie auseinanderlaufen. Wer es zuerst merkt, hört auf zu rechnen und damit auch auf zu
senden — die Gegenseite blieb bei „warte auf Mitspieler" stehen und erfuhr nie, was geschehen ist.
Das fiel erst im Haken-Test auf, nicht in der Maschine: dort verfälscht der Test **beide** Seiten
symmetrisch, im Anschluss an die Oberfläche nur eine. Benannt nach Platz und nicht als
„eigene/fremde", weil dieselbe Nachricht auf beiden Rechnern gelesen wird und sich die Bedeutung von
„eigen" dabei umdreht.

**Auswirkung:** Eine Ergänzung am Protokoll, keine Änderung: das Feld ist optional, und eine
Nachricht ohne es wird weiter angenommen (der Empfänger nimmt dann seine eigene Prüfsumme und lässt
die fremde leer). Der Haken schickt sie genau einmal je Partie.

---

## 2026-09-14 · T-M37-11 · Das Schleifendoppel puffert, was vor dem ersten Hörer ankommt

**Entscheidung:** `createLoopback()` legt Nachrichten beiseite, solange kein Hörer angemeldet ist,
und liefert sie dem ersten Hörer nach — in der Reihenfolge, in der sie ankamen.

**Begründung:** Ohne den Puffer ging die **erste** Nachricht verloren, sobald eine Seite eher
sendete als die andere ihren Hörer anmeldete. Genau das passiert, wenn zwei React-Komponenten
nacheinander eingehängt werden. Im Gleichschritt ist eine verlorene Nachricht kein Schluckauf,
sondern ein Stillstand: die Gegenseite wartet auf eine Liste für Tick 0, die nie wieder kommt, und
die Partie steht nach genau einem Tick. Eine echte Leitung puffert genauso; ein Doppel, das es nicht
tut, wäre freundlicher zur Umsetzung und härter zur Wirklichkeit.

**Auswirkung:** Der Fehler kostete eine halbe Stunde Suche und wäre in M38 an einer echten Leitung
nicht mehr reproduzierbar gewesen. Die Vertragstestreihe aus T-M38-01 muss dieselbe Zusage vom
WebSocket-Transport verlangen.

---

## 2026-09-14 · T-M38-01 · Die Vertragsreihe liegt in `netplay` und geht nicht aus `index.ts` hinaus

**Entscheidung:** `transportContract(name, factory)` steht in
`packages/netplay/src/transportContract.ts` und wird **nicht** aus
`packages/netplay/src/index.ts` re-exportiert. Wer sie braucht, nennt sie beim Pfad; die
Browserseite tut das über einen relativen Import.

**Begründung:** Die Reihe importiert `vitest`. Stünde sie im Sammelexport, zöge jedes
`import … from '@worldwar/netplay'` der Anwendung den Testläufer in das ausgelieferte
Bündel — also auch in das Tauri-Programm, dessen Netzfreiheit T-M38-05 am Erzeugnis misst.

**Verworfen:** sie in `packages/testkit` zu legen, neben `storagePortContract` (das wäre
das naheliegende Muster). Testkit müsste dafür von `netplay` abhängen, und `netplay` hängt
als Testabhängigkeit schon an `testkit` — `pnpm install` meldete prompt einen
Arbeitsbereichs-Zyklus, den es vorher nicht gab. Ein Zyklus für einen Import, der zur
Laufzeit gar nicht stattfindet, ist ein schlechter Tausch.

**Auswirkung:** Ein relativer Import in `websocketTransport.test.ts`
(`../../../../packages/netplay/src/transportContract`), so wie `test/guards/text-keys.test.ts`
seit M21 `de.ts` holt. Keine Änderung an `vitest.config.ts`, keine an einer `package.json`.

---

## 2026-09-14 · T-M38-04 · Die Verbotsliste sticht die Ausnahmeliste

**Entscheidung:** Der Netz-Wächter führt zwei Listen: `NETWORK_ALLOWED` (`apps/party/`,
`apps/desktop/src/net/`) und `NETWORK_NEVER` (`packages/core/`, `packages/ai/`,
`packages/shared/`, `packages/netplay/`). Steht ein Treffer in einem Verzeichnis der
zweiten Liste, wird er gemeldet — **auch wenn dasselbe Verzeichnis in der ersten steht**.

**Begründung:** R-MP-09/AK2 verlangt, dass in den vier Paketen „auch der erlaubte Fall
verboten" ist. Mit nur einer Ausnahmeliste wäre das ein Satz ohne Wirkung: die Pakete
stehen ohnehin nicht darauf, und die Zusicherung prüfte nichts. Mit der Vorrangregel gibt
es eine Gegenprobe, die wirklich beißt — sie reicht `packages/netplay/` als *erlaubt*
herein, und der Treffer wird trotzdem gemeldet. Gemessen: ohne die Vorrangregel fallen
genau diese zwei Zusicherungen.

**Auswirkung:** Wer eines der vier Pakete eines Tages oben einträgt, hat den Wächter nicht
überzeugt, sondern nur zweimal geschrieben.

---

## 2026-09-14 · T-M38-05 · Die zweite Seite der Verpackungsprüfung kommt aus dem kompilierten Programm

**Entscheidung:** `scripts/measure-netfree.mjs` liest die Inhaltsrichtlinie aus
`worldwar.exe` und schreibt sie nach `docs/reports/packaging-netfree.json`; der Wächter
hält den **gemessenen** Text gegen die **heutige** Konfiguration. Sind sie ungleich, ist
der Lauf rot, bis neu gebaut und neu gemessen ist.

**Begründung:** Der bestehende Block prüft `tauri.conf.json` gegen
`capabilities/local-only.json` — zwei JSON-Dateien derselben Hand. Er ist für das, was er
prüft, richtig und wäre grün geblieben, wenn nie ein Bau gelaufen wäre (Befunde 17, 20,
21). Die Gleichheit zweier Texte, von denen einer aus einem Compiler kommt, ist eine
andere Aussage — und zugleich die Frischeprüfung, ohne dass jemand `git` befragen muss.

**Verworfen:** die Berechtigungen im Erzeugnis zu suchen. Gemessen: sie stehen dort nicht
als Text (`local-only` 0×, `allow-open` 0×, `dialog:` 0×, während `dialog` 13× vorkommt);
Tauri backt die Zugriffsliste in eine eigene Darstellung. Eine Zusicherung darauf wäre eine
Prüfung über dem Nichts. Ebenfalls verworfen: eine Suche nach `http:` in der Binärdatei —
sie findet `build.devUrl` und wäre ein Fehlalarm mit Ansage. Beides steht im Wächter, statt
verschwiegen zu werden.

---

## 2026-09-14 · T-M38-08 · „Wer wartet, wiederholt" — statt einen Abriss zu erkennen

**Entscheidung:** Die Hülle schickt unbestätigte Befehlslisten noch einmal, solange die Uhr
wartet (höchstens einmal je Sekunde, `RESEND_AFTER_MS`). Sie fragt den Transport **nicht**,
ob es einen Abriss gab.

**Begründung:** Drei Gründe, und der dritte ist der wichtigste. (1) Ein Schleifendoppel
kann die Frage gar nicht beantworten, und der Haken soll gegen beide Umsetzungen gleich
laufen. (2) Ein „reconnected"-Ereignis wäre eine zweite Wahrheit neben dem, was die
Gegenseite tatsächlich hat — und die erste, die davon abweicht, merkt niemand. (3) Die
Regel deckt mehr ab als der Abriss: eine einzelne verlorene Nachricht, eine langsame
Gegenseite und den Fall, in dem die Verbindung genau **zwischen Senden und Ankommen**
starb. Erneut zu senden kostet nichts, weil `put()` je Tick und Platz genau eine Nachricht
ablegt; eine eigene Zusicherung hält das fest.

**Auswirkung:** Der Transport braucht keine Rückmeldung über Wiederverbindungen, und
`Lockstep.pending()` darf blind wiederholt werden. Gemessen: fünf Sekunden ohne Leitung,
danach fängt sich die Partie **ohne Anstoß**, und ein Befehl aus der Lücke wirkt auf beiden
Seiten.

---

## 2026-09-14 · T-M38-09 / T-M38-10 · Der zweite Knopf fragt nach, und die Übernahme ist ein Klick

**Entscheidung:** Der Hinweis „Ihr Mitspieler ist fort" hat genau zwei Knöpfe — *Weiter
warten* und *Partie beenden*. „Beenden" öffnet einen Dialog mit drei Antworten: allein
weiterspielen (der abwesende Spieler wird zum Computergegner), beenden, doch weiterspielen.

**Begründung:** R-MP-07/AK2 verlangt „die Wahl zwischen Warten und Beenden" — genau zwei
Knöpfe in der Kopfleiste, und dabei bleibt es. Die Übernahme (R-MP-08) ist keine dritte
Wahl auf derselben Ebene, sondern die Antwort auf die Frage „und was jetzt?": sie gehört
hinter den Klick, nicht neben ihn. Und sie geschieht **nie von selbst** — ein Spiel, das
nach einer Weile allein entscheidet, wem die Armeen gehören, ist kein Spiel zu zweit mehr.

**Auswirkung:** „Weiter warten" gilt bis zum nächsten Tick, nicht für immer: kommt die
Gegenseite zurück und steht die Uhr danach wieder, ist das eine neue Lage und verdient eine
neue Meldung. Ein „Weiter warten", das für immer gälte, wäre ein Schalter zum Abschalten
der einzigen Auskunft.

---

## 2026-09-14 · T-M38-10 · Die Übernahme setzt ein Feld und erfindet keine Schwierigkeit

**Entscheidung:** `takeOverSeat(state, absent)` setzt `players[absent].kind = 'ai'` und
lässt alles andere stehen — insbesondere `difficulty` (bei einem Menschen `null`) und
`state.ai` (bei einem Menschen leer).

**Begründung:** Ein Mensch hat keine Schwierigkeitsstufe, und `runAi` liest dann `normal`.
Eine zu erfinden hieße, die Partie beim Übernehmen heimlich zu verändern — der
verbleibende Spieler bekäme einen anderen Gegner, als bis eben am Tisch saß. Das Gedächtnis
legt der Läufer sich beim ersten Denken selbst an (`emptyMemory`); gemessen über 240 Ticks:
`state.ai['p2']` ist vorher `undefined` und danach da.

**Auswirkung:** Kein Kern angefasst — „menschlich" ist seit M5 nur ein Attribut
(`hotseat.test.ts`). Und die übernommene Partie geht durch denselben Spielstand wie jede
andere: `saveTo`/`loadFrom` über einen `MemoryStorage`, danach dieselbe Prüfsumme und
derselbe nächste Tick. Das ist der greifbarste Gewinn des Gleichschritts (D28.2).

---

## 2026-09-14 · T-M39-02 · `willkommen` kommt vor dem benannten `hallo`

**Entscheidung:** Die Anmeldung (`hallo` **ohne** Namen) kommt beim Verbinden, die
Bedingungen (`willkommen`) als Antwort darauf, und der Name in einem **zweiten** `hallo`,
wenn der Gast beitritt. Danach `probe` in beide Richtungen.

**Warum nicht anders.** `MEHRSPIELER.md` §3.2 führt `hallo` als erste Art auf — das bleibt
so, denn die Anmeldung trägt die Protokollfassung, und ohne sie beginnt nichts
(R-MP-06/AK1). §3.7 verlangt aber: „der Beitrittsbildschirm zeigt, worauf man sich
einlässt, bevor irgendetwas passiert. **Dann** Name eintragen und beitreten." Die
Bedingungen kennt nur der Host. Also muss `willkommen` vor dem Namen liegen, und der Name
braucht eine zweite Nachricht.

**Die verworfene Alternative:** die Einladung im Hostdienst ablegen, damit der Gast sie per
HTTP holt, bevor er die Leitung baut. Das kostet zwei Dinge, die beide zu teuer sind: der
Dienst wäre nicht mehr Briefträger, sondern hielte Partiedaten — die dritte Meinung darüber,
was gerade gilt, die D28.2 ausschließt; und das Geheimnis müsste für die Abfrage in eine
Anfragezeile, obwohl es genau deshalb hinter dem Rautezeichen steht (D28.10).

**Auswirkung:** keine achte Nachrichtenart. Und eine Auskunft mehr, die es sonst nicht
gäbe: zwischen den beiden `hallo` sieht der Gastgeber einen Gast **ohne Namen** — „jemand
hat den Link geöffnet und trägt gerade seinen Namen ein". Ohne sie klebt er den Link ein
zweites Mal in den Chat. Befund M39-1.

---

## 2026-09-14 · T-M39-04 · Die Bauflagge statt der gestrichenen Zusicherung

**Entscheidung:** Der Mehrspielereinstieg hängt in `main.tsx` an einem **dynamischen**
Import hinter `__MULTIPLAYER__`; die Flagge ist im gewöhnlichen Bau ein literales `false`,
und `pnpm mp:host` setzt sie. Die Zusicherung „kein `WebSocket` im ausgelieferten Bündel"
bleibt — sie ist jetzt eine Aussage über die **Flagge** statt über eine Unterlassung.

**Warum überhaupt eine Entscheidung nötig war.** Befund M38-5 hat es vorhergesagt: bis M38
war die Zusicherung wahr, weil kein Pfad von `main.tsx` zum Transport führte. T-M39-02 baut
diesen Pfad. Die drei Wege waren: (a) die Zusicherung streichen, (b) sie durch eine
Zusicherung am **Verhalten** ersetzen (der Aufruf im Tauri-Bau scheitert an
`connect-src 'none'`), (c) eine **Bauflagge**, die den Einstieg herausschneidet.

(a) fällt aus — M38-5 verbietet es ausdrücklich, und mit Recht: eine Zusage, die beim ersten
Widerspruch weicht, ist keine. (b) wäre am stärksten, verlangt aber, das gebaute Programm zu
starten und eine fehlgeschlagene Verbindung zu messen — jedes Mal, in jedem `pnpm verify`.
(c) ist billig, deterministisch und **an der Sache**: Noahs dritte Festlegung lautet nicht
„die Verbindung scheitert", sondern „das ausgelieferte Programm bleibt netzfrei". Ein
Programm, das den Einstieg gar nicht enthält, erfüllt das strenger als eines, in dem er
scheitert.

**Gemessen, und die zweite Zeile ist die eigentliche Aussage:** ohne Flagge 2 Dateien und
**0** Treffer, mit Flagge 3 Dateien (ein eigener Brocken `websocketTransport-*.js`) und 1
Treffer; das neu gebaute `worldwar.exe` (6 789 632 B) trägt `WebSocket` **0×** und
`connect-src 'none'` 1×. Ohne die zweite Messung wäre die erste kein Beleg für die Flagge,
sondern ein Zufall.

**Der Preis, gemessen:** ein zweiter Bauordner muss an sechs Stellen bekannt gemacht werden
(`.gitignore`, `eslint.config.js`, `tsconfig.json`, beide vitest-Konfigurationen,
`test/guards/scan.ts`). Zwei davon sind erst aufgefallen, als `pnpm verify` rot wurde —
einmal mit Hunderten Lint-Fehlern aus erzeugtem Code, einmal mit dem Netz-Wächter, der das
**gebündelte** `new WebSocket` als Verstoß meldete. Beides steht als Befund M39-5.

---

## 2026-09-14 · T-M39-01 · Der Platz kommt aus der Rolle, nicht aus der Ankunft

**Entscheidung:** Der Link trägt die Rolle im Weg hinter dem Rautezeichen — `#/gastgeben`
für den Gastgeber, `#/beitreten` für den Gast —, und die Verbindung verlangt danach einen
**bestimmten** Platz (`p1` bzw. `p2`). Der Raum weist ab, wenn er besetzt ist, statt den
anderen zu vergeben.

**Begründung:** Bis M38 bekam der erste Ankommende `p1`. Der Platz ist aber die Kennung, mit
der die Oberfläche alles betrachtet (`viewerId`, T-M37-01), und er steht in `playerOrder`,
nach der beide Seiten die Befehle sortieren (T-M37-07). Nach Ankunftsreihenfolge zu vergeben
hieße: wer schneller klickt, spielt die Nation des Gastgebers. Das fällt nicht als Fehler
auf, sondern als „komisches Spiel".

**Auswirkung:** `seatsOfRole` gibt **beide** Kennungen zurück, den eigenen Platz und den des
anderen. Eine zweite Rechnung („wenn ich `p1` bin, ist der andere `p2`") wäre genau die
Annahme, die T-M37-01 aus der Oberfläche entfernt hat; deshalb steht sie an **einer** Stelle,
und der Wächter `no-hardcoded-player` führt genau diese eine als begründete Ausnahme.

---

## 2026-09-14 · T-M39-01 · Eine Abweisung schließt mit 4001 und nicht mit 1000

**Entscheidung:** Wer wegen eines falschen Geheimnisses, einer unbekannten Raumkennung, eines
vollen Raumes oder eines besetzten Platzes abgewiesen wird, bekommt einen Schließrahmen mit
Code **4001** (privater Bereich von RFC 6455) statt `1000`.

**Begründung:** Der Transport im Browser baut eine abgerissene Leitung mit wachsendem Abstand
wieder auf — 250, 500, 1000, 2000, 4000, 8000 ms (T-M38-06). Bei einer **Abweisung** wären
das sechsmal dieselbe verschlossene Tür und sechzehn Sekunden, in denen der Gast nicht
erfährt, was los ist. Ein Code über 4000 heißt: das ist kein Netzfehler, sondern eine
Antwort.

**Was dabei geändert wurde:** `Connection.close` nimmt einen Code; der Test aus M38, der für
einen vollen Raum `1000` erwartete, erwartet jetzt `4001` — mit einem Satz daneben, warum.

---

## 2026-09-14 · T-M39-01 · Die Einladung überlebt den leeren Raum

**Entscheidung:** `Rooms` trennt **Einladung** (Kennung und Geheimnis) von **Raum** (wer
gerade sitzt). Der Raum verschwindet weiterhin, sobald niemand mehr darin sitzt; die
Einladung bleibt, solange der Dienst läuft.

**Begründung:** T-M38-07 hat „ein leerer Raum verschwindet" gebaut, und das bleibt richtig —
§6 schließt Zustand über die Partie hinaus aus. Aber der Link zeigt auf die **Kennung**.
Verlören beide Seiten für zehn Sekunden die Verbindung, wäre der Link tot, und der Abend mit
ihm. Was die Einladung hält, ist eine Adresse und ein Geheimnis; beides stirbt mit dem
Prozess.

---

## 2026-09-14 · T-M39-06 · Die Probe nennt ihren Startstand, statt immer zu übertragen

**Entscheidung:** `ProbeMessage` trägt zusätzlich `fromHash` — die Prüfsumme des Standes, von
dem die Probe losgerechnet hat.

**Die Alternative war „bei einer Wiederaufnahme immer übertragen".** Sie ist sicher und
falsch: dann ginge bei *jeder* fortgesetzten Partie ein Viertelmegabyte über die Leitung
(gemessen 263 KB nach dreißig Spieltagen), und „übertragen werden Befehle, nie Zustände"
(D28.2) hätte eine stille Ausnahme. Mit dem Startabdruck sind die beiden Fälle exakt
trennbar: gleicher Start und anderes Ergebnis heißt **Abbruch** (ein Rechenfehler), anderer
Start heißt **übertragen** (verschiedene Stände).

**Auswirkung:** ein Feld mehr im Protokoll, und eine Zusicherung mehr, die es verlangt —
eine `probe` ohne `fromHash` wird verworfen. Befund M39-3.

---

## 2026-09-14 · T-M39-07 · Der Playtest-Bogen bekommt Prosa, keine nummerierte Frage

**Entscheidung:** Der Abschnitt zu AK-9 in `docs/PLAYTEST.md` trägt **keine** nummerierte
Frage.

**Begründung:** `playtestStatus` zählt jede unbeantwortete Frage als offen. Eine neue Zeile
hätte `docs/reports/playtest-v1.md` unvollständig gemacht und **AK-7 wieder auf „⏳"**
gesetzt — ein abgenommenes V1-Kriterium, zurückgeworfen durch eine Dokumentationsaufgabe
eines Meilensteins, der ausdrücklich hinter der V1 liegt. Das ist die Fehlerklasse des
Nachtrags 2.15.

**Auswirkung:** AK-9 hat seinen eigenen Ort (Abschnitt 3.2) und seinen eigenen Bericht
(`docs/reports/mehrspieler.md`); der Bogen beschreibt den Durchgang in Prosa und sagt im
ersten Satz, warum er keine Frage daraus macht. Zwei Tests halten beides fest. Befund M39-4.

---

## 2026-09-18 · T-M17-03 · Die Sicht behält ihre Feldnamen, obwohl der Zustand sie verliert

**Entscheidung:** `publicView().relations` heißt auch nach dem Schritt 3 → 4 weiter
`rightOfWay` und `sharedMap`. Die Umbenennung in `passageGranted`, `passageReceived`,
`passageEndsAtTick`, `mapShared` und `mapReceived` bleibt, wo der Plan sie hingestellt hat:
in **T-M17-04**.

**Begründung:** Solange jeder Schreiber beide Richtungen setzt — und das ist die ausdrückliche
Vorgabe dieses Schritts —, sagt **ein** Feld je Beziehung genau dieselbe Wahrheit wie zwei. Ein
zweiter Name für dieselbe Aussage wäre keine Verbesserung, sondern ein zweiter Umbau im selben
Commit: durch `packages/ai/src/relationship.ts`, `packages/ai/src/diplomacy.ts`, `Standings`,
`Explain`, `icons`, `de.ts` und deren Tests. Genau das hätte den einen Beleg zerstört, für den
dieser Schritt gebaut ist — *nur die neuen Zustandsfelder verschieben die Golden-Master*. Wer
zwei Dinge gleichzeitig ändert, kann hinterher nicht mehr sagen, welches davon die Prüfsumme
bewegt hat. Erst T-M17-04 macht aus einer Wahrheit zwei verschiedene, und **dann** brauchen sie
zwei Namen.

**Was trotzdem schon gerichtet ist:** gelesen wird über `grantsPassage` und `sharesMap`, und
zwar in der Richtung „der andere gewährt mir" — `rightOfWay` heißt in der Sicht also schon
heute *er lässt mich durch*. Zwei Tests fallen, wenn diese Richtung vertauscht wird
(`movement.test.ts`, `phases/diplomacy.test.ts`); die Gegenproben sind gefahren.

*(Berichtigt am 2026-09-24: die beiden Gegenproben galten der Überfallerkennung und
`visibleProvinces` — nicht `relations` in der Sicht. Wer dort `grantsPassage(state, other, me)`
oder `sharesMap(state, other, me)` vertauschte, ließ alle 114 Testdateien grün. Seit heute
hält `packages/core/src/state/relation-direction.test.ts` die Richtung der Sicht mit einseitig
gesetzten Feldern fest, in beiden Hälften des Schlüssels.)*

**Auswirkung:** `packages/ai` und die gesamte Oberfläche bleiben in T-M17-03 unberührt, obwohl
`tasks.yaml` sie unter „Dateien" führt — das steht so in der Erledigungsnotiz. Für die beiden
Folgebahnen heißt es: **wer die Sicht liest, liest bis T-M17-04 die alten Namen.**
`viewFieldNamesKept: true`.

---

## 2026-09-18 · T-M17-03 · Der Mehrspieler wird an einer Stelle repariert und an einer anderen nicht

**Entscheidung:** `acceptState` prüft den übertragenen Spielstand **zuerst** auf seine
Formatstufe. Der Handschlag dagegen bekommt die Formatstufe **nicht**; der Vorschlag wandert in
die M18-Sammelstelle.

**Begründung:** Die beiden Fälle sind verschieden schwer. Ein übertragener Stand der Stufe 3
wurde bis heute **angenommen**, wenn seine Prüfsumme zu der angekündigten passte — und
`cloneState` liest im ersten Tick `state.espionage.spies`. Aus einer Wiederaufnahme wäre ein
Absturz geworden, und zwar erst nach dem Verbinden. Das ist ein Fehler, den M17 verursacht, also
gehört er hierher; die Prüfung ist drei Zeilen und ändert das Nachrichtenformat nicht. Die
Formatstufe in den Handschlag zu nehmen ist dagegen eine Protokolländerung samt Erhöhung von
`PROTOCOL_VERSION` — und der Nutzen ist klein, weil die Determinismus-Probe den Unterschied
ohnehin fängt (gemessen: `d4e0ae7104e71c6b` statt `b2f6fef971bbfc1b`) und **ab T-M17-04** schon
der Handschlag „verschiedene Regeln" meldet, weil M17 `data/rules` anfasst.

**Auswirkung:** eine neue Zusicherung in `packages/netplay/test/resume-save.test.ts`, die ohne
die Reparatur fällt. Die irreführende Meldung der Probe bleibt für das Fenster zwischen
T-M17-03 und T-M17-04 bestehen — benannt in Befund M17-4, nicht verschwiegen.

*(Die zweite Hälfte dieses Entscheids ist am 2026-09-24 abgelöst — siehe „Eine neue
Formatstufe ist eine neue Protokollfassung" unten. Ihre Begründung stützte sich auf eine
Annahme, die für die App nicht stimmt: die Probe fängt den Unterschied dort nicht.)*

---

## 2026-09-24 · Nacharbeit T-M17-03 · Eine neue Formatstufe ist eine neue Protokollfassung

**Entscheidung:** `PROTOCOL_VERSION` steigt von 1 auf **2**, und zu jeder Formatstufe gehört
fortan genau eine Protokollfassung. `packages/netplay/src/protocol.test.ts` führt die Paare
(Stufe 3 → Fassung 1, Stufe 4 → Fassung 2) und fällt, sobald jemand `SCHEMA_VERSION` hebt,
ohne `PROTOCOL_VERSION` mitzuheben. Das löst die zweite Hälfte des Entscheids vom 2026-09-18
ab; der Vorschlag „Formatstufe in den Handschlag" wandert damit **nicht** in die
M18-Sammelstelle — er ist auf diesem Weg erledigt.

**Begründung:** Die Begründung vom 2026-09-18 („die Determinismus-Probe fängt den Unterschied
ohnehin") ist nachgestellt und falsch. In der App entscheidet `resumeDecision`, und zwar zuerst
über den Startabdruck; zwei Formatstufen haben zwangsläufig verschiedene (gemessen:
`b14b2dad229e92cb` gegen `68736687aa40819d` aus derselben Partiedefinition), die Entscheidung
lautet „übertragen", auch in einer frischen Partie. Je Richtung:

| Gastgeber | Gast | Ablauf bis heute |
|---|---|---|
| alt (Stufe 3) | neu (Stufe 4) | der Gast verwirft den übertragenen Stand mit der Formatmeldung — sauber |
| neu (Stufe 4) | alt (Stufe 3) | das alte `acceptState` prüft **nur die Prüfsumme**, nimmt den Stand an, beide beginnen, die Partie läuft **nach dem Start** auseinander |

Die zweite Zeile verletzt R-MP-06 („vor dem ersten Zug, nicht nach zwei Stunden"). Den alten
Bau erreicht nur eine Prüfung, die er selbst schon kennt, und das ist genau eine: die
Protokollfassung im allerersten `hallo`. Der Rest der alten Begründung — „ab T-M17-04 meldet
schon der Regelabdruck den Unterschied" — hält nur, solange jede künftige Formatstufe zufällig
mit einer Regeländerung zusammenfällt. Die Nachricht `zustand` trägt einen ganzen Spielstand;
sein Format **ist** Teil des Protokolls, und ein geändertes Nachrichtenformat ist nach der
eigenen Regel von `protocol.ts` eine neue Fassung.

**Kosten, gemessen:** eine Zahl in `protocol.ts`, fünf Testnachrichten, die die Fassung als
Ziffer `1` statt als `PROTOCOL_VERSION` trugen, und keine Änderung am Nachrichtenformat. Der
Hostdienst (`apps/party`) liest keine Fassung, er reicht nur weiter. Netplay, Mehrspieler der
App und `apps/party`: 16 Dateien / 206 Tests grün.

**Auswirkung:** Bauten von `main` (Fassung 1, Stufe 3) und von M17 weisen einander in beiden
Richtungen beim ersten `hallo` ab, mit „Fremde Protokollfassung". Die Zwischenstände dieses
Zweigs von `a5636c9` bis `166eb5b` sprechen Stufe 4 mit Fassung 1 — sie wurden nie
ausgeliefert. Die Prüfung der Stufe in `acceptState` bleibt als zweite Linie stehen.

---

## 2026-09-24 · Nacharbeit T-M17-03 · Die Vollständigkeitsprüfung läuft auf beiden Ladewegen

**Entscheidung:** `deserialise` ruft `validateState` auch für einen Stand der aktuellen Stufe
mit gültiger Prüfsumme, nicht nur für migrierte. `validateState` prüft die Felder der Stufe 4
so tief, wie der erste Tick sie liest, und weist die alten Schlüssel `rightOfWay`/`sharedMap`
ab.

**Begründung:** Die Prüfsumme sagt, dass ein Stand **unverändert** ist, nicht dass er
**vollständig** ist. Die Regel für T-M17-04 bis -14 lautet „Felder ergänzen, ohne die Stufe zu
heben" — ein Stand von heute, geladen von einem Bau, der ein Feld mehr erwartet, liefe sonst
über den Hash-Weg ungeprüft durch und stürzte im ersten Tick. Nachgestellt vor der Reparatur:
ein Stand der Stufe 4 mit `rightOfWay`/`sharedMap` statt der gerichteten Felder und gültiger
Prüfsumme lud still, und jeder gewährte Durchmarsch war danach weg; `espionage: {}` bestand die
Prüfung und warf im ersten Tick einen TypeError aus `cloneState`. Die Prüfung kostet eine
Schleife über die Beziehungen und die Handelsangebote.

**Auswirkung:** Wer in einer Folgeaufgabe ein **Pflichtfeld** anlegt, trägt es auch in
`validate.ts` ein — sonst prüft der Hash-Weg es nicht, und das ist dieselbe Lücke wie vorher.
Ein Zwischenstand dieses Zweigs, dem ein später angelegtes Pflichtfeld fehlt, wird dann mit
einer Meldung abgewiesen, statt im ersten Tick abzustürzen — das ist die gewollte Richtung;
ausgeliefert wurde keiner.

---

## 2026-09-18 · T-M39-10 · Die fünf Sätze der Pause: Zustand in die Kopfleiste, Ereignis in die Meldezeile (Befund MP-4)

**Entscheidung:** Die fünf Spielertexte unter `netplay` werden auf **zwei vorhandene**
Anzeigeorte verteilt und bekommen kein eigenes Panel.

| Satz | Wo | Wann |
|---|---|---|
| `pauseSent` | Kopfleiste, neben dem Pausenknopf | der **eigene** Antrag ist offen |
| `paused` | Kopfleiste | die Partie steht |
| `resuming` | Kopfleiste | der Vorlauf von drei Sekunden läuft |
| `pauseDeclined` | Meldezeile (`ui.notice`, `kind: 'info'`) | der **andere** hat abgelehnt |
| `pauseExpired` | Meldezeile | die Frist ist um — auf **beiden** Seiten |

**Begründung:** Die Trennung liegt nicht im Geschmack, sondern in der Sorte Auskunft. Ein
**Zustand** hat ein Ende, das die Maschine kennt: `pauseSent` fällt mit dem Antrag,
`paused` mit dem Fortsetzen, `resuming` nach drei Sekunden. Solche Sätze dürfen stehen
bleiben, weil sie von selbst gehen — und sie gehören neben den Knopf, der sie beendet. Ein
**Ereignis** hat kein Ende: `notice: 'declined'` bleibt in `PauseState` stehen, bis jemand
die nächste Pause beantragt. In der Kopfleiste stünde „Ihr Mitspieler möchte
weiterspielen" dann minutenlang neben einer längst weiterlaufenden Partie. Die Meldezeile
ist für genau das da und trägt schon den Nachbarfall `header.pauseNeedsConsent` („zu zweit
hält niemand allein an") — derselbe Anlass, dieselbe Zeile.

Die Kopfleiste ist im Mehrspieler voll (Uhr, feste Rate, „Warte auf Mitspieler …",
*Pause beantragen*, der Verlust-Hinweis mit zwei Knöpfen); PROBLEME.md nennt das als Grund,
warum MP-4 offen blieb. Die Aufteilung fügt dort **einen** gedämpften Satz hinzu, der nur
während eines Pausenvorgangs überhaupt existiert, und keinen Knopf.

**Auswirkung:**
- `packages/netplay/src/pause.ts`: `PauseState` bekommt das Feld `noticeBy` — wer den
  Hinweis ausgelöst hat. Ohne es ist `'declined'` auf beiden Rechnern dasselbe, und der
  Ablehnende bekäme einen Satz über sich selbst zu lesen; der Antrag, an dem man es sonst
  abläse, ist in genau diesem Augenblick gelöscht. Beim Verfallen trägt das Feld den
  Antragsteller, nach dem Fortsetzen niemanden.
- `apps/desktop/src/ui/Header.tsx`: neue Eigenschaft `pauseNotice`, gerendert als
  `role="status"` mit der Klasse `clock__pause` (gedämpft, nicht in Warnfarbe — daneben
  steht der Knopf, mit dem man es beendet).
- `apps/desktop/src/App.tsx`: eine `useMemo` für den Zustandssatz, ein `useEffect` für die
  zwei Ereignisse. Ein **neuer** Antrag löscht die Meldung zum alten — **und nur sie**:
  `clearNotice` nimmt seit der Nacharbeit vom 2026-09-24 ein `onlyIf` und leert die Zeile
  nur, wenn sie gerade `pauseDeclined` oder `pauseExpired` trägt
  (`apps/desktop/src/state/uiState.ts`). Vorher wischte ein fremder Antrag beim Gefragten
  jede Meldung weg — einen abgelehnten Befehl, den Hinweis zur festen Rate (Durchsicht vom
  2026-09-18, Stufe niedrig, an der ganzen Anwendung nachgestellt).
- Neun Fälle in `App.test.tsx` an der ganzen Anwendung, sechs davon fallen ohne die
  Reparatur; aus der Nacharbeit zwei weitere (die fremde Meldung bleibt stehen; die alte
  Antwort verschwindet mit dem eigenen neuen Antrag) und einer am Reduzierer
  (`uiState.test.ts`). Ohne die `onlyIf`-Zeile fallen der erste davon und der am
  Reduzierer.

**kippbar:** Beides in die Kopfleiste (dann braucht `pauseDeclined`/`pauseExpired` eine
Frist, nach der es verschwindet — eine Uhr, die es heute nicht gibt) oder beides in die
Meldezeile (dann verliert „Die Partie steht" seinen Platz neben *Fortsetzen*, und ein
Klick auf eine Provinz löscht ihn). Die Sätze selbst bleiben unverändert; kippen heißt hier
nur, die Zuordnung in `App.tsx` umzuhängen.

---

## 2026-09-18 · T-M39-11 · Im netzfreien Bau verschwindet der Wähler „Partieart" (Befund V-1)

**Entscheidung:** Von den drei Wegen, die PROBLEME.md offenließ, wird der **erste**
gebaut: im netzfreien Bau gibt es die Wahl nicht. `gameModesFor(__MULTIPLAYER__)` liefert
`['single']` statt `['single', 'multiplayer']`, der Wähler wird zu einer Wahl mit einem
Wert und verschwindet mitsamt allem, was nur zu zweit einen Sinn hat (feste Rate,
Einladungsvorschau).

**Begründung:** PROBLEME.md nennt ihn selbst als „den einzigen, nach dem die Zusage ‚die
Tauri-Anwendung kennt keinen Mehrspieler' **auch an der Oberfläche** wahr ist". Er nimmt
niemandem etwas weg: gemessen am 2026-09-14 lief die Wahl „Zu zweit über einen Link" in
diesem Bau ohnehin in eine Einzelspielerpartie — mit fester Rate und ohne Vorspulen, also
**schlechter** als die Partie, die derselbe Bau sonst liefert.

Der zweite Weg (stehen lassen und sperren, mit ehrlichem Grund) wäre das Muster, das die
Oberfläche sonst benutzt — `checked()` in `actions.ts`, die gesperrten Tempostufen während
des Vorspulens. Er scheitert hier am Grund: „zu zweit geht es über den Hostdienst" verweist
auf etwas, das dieses Programm nicht öffnen kann und wofür es keinen Text und keinen Weg
gibt. Eine Sperre, deren Begründung ins Leere zeigt, ist schlimmer als eine fehlende Zeile.

**Auswirkung:**
- `apps/desktop/src/game/newGame.ts`: neue reine Funktion `gameModesFor(multiplayerBuild)`
  — seit der Nacharbeit vom 2026-09-24 `gameModesFor(multiplayerBuild, hostsParty)`, siehe
  den Entscheid darunter. Die Bauflagge wird **für die Oberfläche an genau einer Stelle**
  gelesen — in `App.tsx` (`gameModes`). Damit laufen im Testlauf **beide** Zweige, obwohl
  die Flagge dort feststeht.
- `apps/desktop/src/ui/Dialogs.tsx`: `NewGameDialog` bekommt die Pflichteigenschaft
  `modes`. Absichtlich ohne Vorgabewert: ein Aufrufer, der sie vergisst, soll nicht
  stillschweigend den Mehrspieler bekommen — genau diese Fehlerklasse war V-1.
- Die zweite Hälfte der Bedingung (`options.mode === 'multiplayer'` **und** `modes` enthält
  es) fängt den Fall ab, in dem eine alte Wahl im Formular stehen bleibt — seit dem
  2026-09-24 als `effectiveMode()`, und zwar für die Anzeige **und** den Start.
- Hier stand am 2026-09-18 „Der Wähler bleibt im Hostbau unverändert, mit beiden Werten."
  **Das war falsch** (Durchsicht vom 2026-09-18, Stufe hoch): der Hostbau ohne Raum bot
  die zweite Art weiter an und lieferte die erste. Im Hostbau steht der Wähler jetzt nur
  mit Raum — Entscheid vom 2026-09-24 darunter.

**Was im netzfreien Bündel wirklich herausfällt — gemessen, nicht erschlossen**
(2026-09-24): nur der Schlüssel `newGame.multiplayerPending`. Wähler, Rate und
Einladungskasten stehen weiter im Bündel und werden zur Laufzeit nicht gezeichnet; die
Flagge wirkt hier über eine Funktion in einem anderen Modul, nicht als Literal, das Rollup
falten könnte. Zahlen unter PROBLEME, Befund V-1.

**kippbar:** `gameModesFor` auf `['single', 'multiplayer']` für beide Flaggenwerte stellen —
dann ist der Stand von M37 wieder da. Oder den zweiten Weg gehen: `modes` um einen
Sperrgrund erweitern und die zweite Option `disabled` mit `title` zeigen; dazu braucht es
einen Spielertext, der sagt, **wo** es den anderen Bau gibt.

---

## 2026-09-24 · T-M39-11 · Zu zweit nur mit Raum, und der Start hält sich an die angebotene Art (Befund V-1, Nacharbeit)

**Entscheidung:** „Zu zweit über einen Link" wird nur angeboten, wenn **beides** stimmt:
der Bau kann es (`__MULTIPLAYER__`), und dieser Bildschirm führt einen Raum als Gastgeber
(`netParty.active && netParty.role === 'host'`) — oder bekommt eine Sitzung hereingereicht
(`props.netplay`, die Naht aus T-M37-11, die heute nur Tests benutzen). Sonst gibt es keine
Wahl. `gameModesFor(multiplayerBuild, hostsParty)` macht daraus die Liste. Und die
**Wirkung** hängt an derselben Liste: `effectiveMode(options.mode, modes)` entscheidet, was
der Dialog zeichnet **und** was er beim Start an `onStart(mode)` weiterreicht;
`startNewGame(mode)` legt Partiedefinition, Rate und Angebot an den Raum mit genau dieser
Art an und liest `options.mode` nicht mehr.

**Begründung:** Die Durchsicht vom 2026-09-18 hat gezeigt, dass die Bauflagge allein der
falsche Maßstab war. Der Hostdienst liefert `/` aus; wer dort landet statt auf dem
gedruckten `#/gastgeben`-Link, hat keine Leitung — und bekam mit der Fassung vom
2026-09-18 weiter den Wähler mit beiden Arten, die Überschrift „Die Einladung nennt:" und
nach *Partie beginnen* eine lokale Partie mit fester Rate, ohne Mitspieler, ohne Lobby,
ohne Fehler: das Symptom aus V-1, im anderen Bau. **Nachgestellt am 2026-09-24** an der
ganzen Anwendung (in vitest ist `__MULTIPLAYER__` wahr, der Testlauf IST der Hostbau):
ohne Raum stand der Wähler mit zwei Optionen; die zwei Fälle R-MP-02/AK2 legten genau so
ihre „Partie zu zweit" an und hielten das Symptom als Zusicherung fest. Die Bedingung
`hostsParty` ist dieselbe, unter der `startNewGame` die Partie dem Raum anbietet
(`alsGastgeber`) — Angebot im Dialog und Wirkung beim Start fragen jetzt dasselbe.

`effectiveMode` fängt den Zustand ab, den die Anzeige allein nicht fängt (Durchsicht,
Stufe mittel): das Formular trägt „zu zweit" (der Gastgeber-Link wählt es vor), und danach
gibt es keinen Raum mehr. Bis zur Nacharbeit blendete der Dialog dann alles aus, und
`startNewGame` legte trotzdem eine Partie zu zweit an — mit einem menschlichen Platz p2
(`toConfig` macht bei `mode: 'multiplayer'` den zweiten Platz menschlich), fester Rate und
ohne Vorspulen. **Nachgestellt** über ein Neuzeichnen der Anwendung ohne Raum: Start →
„(fest)" in der Kopfleiste. Heute ist die Lage im ausgelieferten Programm nicht erreichbar
(`props` ändern sich dort nicht); die Zusicherung soll trotzdem an der Wirkung liegen und
nicht an der Anzeige — genau die Fehlerklasse, die V-1 war.

Gewählt ist die **kleinste ehrliche** Fassung: nichts Neues auf dem Bildschirm, kein neuer
Spielertext — der Wähler steht, wo er etwas bewirkt, und fehlt, wo er nichts bewirken kann.

**Auswirkung:**
- `apps/desktop/src/game/newGame.ts`: `gameModesFor(multiplayerBuild, hostsParty)` (zweiter
  Parameter neu), `effectiveMode(chosen, modes)` neu.
- `apps/desktop/src/App.tsx`: `hostsParty` und `gameModes` (einmal, `useMemo`),
  `startNewGame(mode)` statt `startNewGame()`.
- `apps/desktop/src/ui/Dialogs.tsx`: `onStart: (mode: GameMode) => void`; der Knopf reicht
  die Art weiter, die der Dialog angeboten hat.
- Drei Fälle in `App.test.tsx` (ohne Raum kein Wähler; mit Raum beide Arten, zu zweit
  vorgewählt; ohne Raum startet eine vorgewählte Partie zu zweit allein), drei in
  `Dialogs.test.tsx` (die Raum-Achse von `gameModesFor`; `onStart` mit der angebotenen Art;
  die Gegenprobe zu zweit). Die zwei Fälle R-MP-02/AK2 bekommen einen Raum als Gastgeber;
  ihre Zusicherungen sind unverändert.
- **Gegenprobe gefahren, dreimal:** Raumbedingung heraus → 4 Fälle fallen; der Dialog
  reicht `options.mode` weiter → 2; `App.tsx` nimmt die gereichte Art nicht → 1.

**kippbar:** Für den Hostbau ohne Raum den zweiten Weg aus PROBLEME.md gehen — den Wähler
stehen lassen und „Zu zweit" `disabled` mit einem Grund zeigen, der dort wahr ist (etwa
„Eine Partie zu zweit braucht den Gastgeber-Link aus `pnpm mp:host`"). Das wäre freundlicher
zu jemandem, der den Link vergessen hat, verlangt aber einen neuen Spielertext — Noahs
Entscheidung, deshalb nicht gebaut. Oder `props.netplay` aus `hostsParty` herausnehmen:
dann bräuchten auch die Tests, die eine Sitzung hereinreichen und „zu zweit" wählen, einen
Raum.

---

## 2026-09-18 · T-M39-11 · Der Satz aus M37 im Anlegedialog fällt ersatzlos (Befund MP-5)

**Entscheidung:** `newGame.multiplayerPending` („Die Verbindung zum Mitspieler kommt mit
dem nächsten Ausbau; die Partie beginnt vorerst lokal.") wird gestrichen — die Zeile im
Dialog **und** der Schlüssel im Katalog. Kein Ersatzsatz.

**Begründung:** PROBLEME.md stellte die Frage als „nichts oder ein anderer Satz" und nannte
das Maß gleich mit: *der Kasten trägt sonst nur Angaben, keine Erklärungen.* Vier Zeilen
Karte, Nationen, Computergegner, Rate — und darunter ein Satz über den Bauzustand des
Projekts. Er war in M37 richtig und ist seit M38/M39 falsch.

Ein wahrer Ersatzsatz wäre möglich („mit *Partie beginnen* geht die Einladung hinaus"),
aber er wäre nur im Hostbau mit geöffnetem Hostlink wahr und im Hostbau ohne Link wieder
falsch — dieselbe Falle eine Nummer kleiner. Was als Nächstes kommt, sagt ohnehin die Lobby
einen Klick später: `party.inviteHint` mit dem Link darin.

**Nachtrag vom 2026-09-24:** Seit der Nacharbeit zu V-1 steht der Kasten überhaupt nur
noch mit Raum. Ein Ersatzsatz wäre dort also wahr, und die Überschrift „Die Einladung
nennt:" behauptet keine Einladung mehr, die es nicht gibt — gestrichen bleibt der Satz
trotzdem, weil der Kasten Angaben trägt und keine Erklärungen.

**Auswirkung:**
- `apps/desktop/src/i18n/de.ts`: Schlüssel weg, an seiner Stelle ein Kommentar, der den
  alten Satz wörtlich festhält (Projektregel: zurückgenommene Zusagen werden begründet,
  nicht gelöscht).
- `apps/desktop/src/ui/Dialogs.tsx`: das `<small>` weg, an seiner Stelle derselbe Hinweis
  als Kommentar.
- Ein Fall hält fest, dass der Kasten **vier** Listeneinträge und kein `<small>` mehr
  trägt, ein zweiter, dass `hasKey('newGame.multiplayerPending')` falsch ist.

**kippbar:** Einen wahren Satz einsetzen. Dann gehört er an die Bedingung „der Gastgeber
hat wirklich einen Raum" gehängt und nicht an `mode === 'multiplayer'` — die gibt es seit
dem 2026-09-24 (`hostsParty` in `App.tsx`), und der Kasten steht nur noch unter ihr.

---

## 2026-09-24 · T-M17-04 · Ein Krieg beendet Durchmarsch und Kartenfreigabe — auch der Überfall (Befund M17-3)

**Entscheidung:** Wird eine Kriegserklärung wirksam **oder** beginnt ein Krieg mit einem
Überfall, fallen Durchmarsch **und** Kartenfreigabe in **beiden** Richtungen, samt einer
laufenden Kündigungsfrist. D29.1 sagte „wie heute nur den Durchmarsch"; der Code löschte seit M6
auch die Karte — dabei bleibt es, und der Überfall tut jetzt dasselbe.

**Begründung:** Das Gegenargument aus M17-3 — *was der andere gesehen hat, weiß er* — ist
richtig und wird gar nicht berührt: das Aufklärungsgedächtnis (`player.intel`) behält den
letzten Stand jeder gesehenen Provinz; gelöscht wird nur die **laufende** Sicht. Eine laufende
Freigabe an den Feind dagegen hebt den Nebel für die ganze Dauer des Krieges auf, und
`grantRightOfWay`/`shareMap` verweigern jede Freigabe im Krieg schon immer — ein Zustand, den
kein Befehl herstellen darf, soll auch kein Krieg stehen lassen. Der Überfall kommt dazu, weil
das gerichtete Recht ihn erst erreichbar macht: A kann B jetzt Durchmarsch gewähren und B
trotzdem überfallen, und ohne diese Zeile lebte As Gewährung nach dem nächsten Frieden still
wieder auf. Mit dem symmetrischen Feld gab es diesen Fall für den Durchmarsch nie — für die
Karte schon (Befund M17-D1).

**Auswirkung:** `endTies()` in `phases/diplomacy.ts`, gerufen an beiden Stellen, an denen ein
Krieg beginnt. Kein Golden-Master bewegt sich: in keinem Messlauf ist je eine Freigabe gesetzt
(`m17-baseline`: `freigabenHoechstens` 0/0/0). Zwei Tests halten es fest
(`phases/diplomacy.test.ts`, „M17-3 …"), beide fallen, wenn ihre Zeile fehlt.

**kippbar:** Soll ein Krieg die Karte stehen lassen, fallen in `endTies()` die zwei Zeilen
`aSharesMap`/`bSharesMap` weg und der Test „beim Wirksamwerden einer Kriegserklärung" prüft die
Karte auf `true`. Der Überfall-Fall ist davon getrennt kippbar (dieselbe Funktion, zweiter
Aufruf) — aber nur zusammen mit dem Durchmarsch, sonst lebt Befund M17-D1 wieder auf.

---

## 2026-09-24 · T-M17-04 · Die Sicht nennt die Kündigungsfrist beider Richtungen (D29.6)

**Entscheidung:** `publicView().relations[other].passageEndsAtTick` ist ein **Paar**
`{ granted: Tick | null; received: Tick | null }` statt eines einzelnen Ticks.

**Begründung:** D29.6 nennt ein Feld, aber es gibt zwei Fristen, und beide Seiten brauchen
eine: der Gast die seines erhaltenen Rechts (bis dahin muss er hinaus — die KI-Regel „Gast nach
Widerruf" in T-M17-10 liest genau das), der Gewährende die seiner eigenen Kündigung (er hat schon
gekündigt; die Oberfläche in T-M17-14 zeigt „endet an Tag X" statt eines zweiten Knopfes). Ein
einzelnes Feld hätte eine der beiden Fragen unbeantwortbar gemacht, oder bei beidseitiger
Kündigung zweideutig. Der Name bleibt der des Entwurfs, die Schlüssel spiegeln
`passageGranted`/`passageReceived`. Verborgen ist nichts: `RIGHT_OF_WAY_CHANGED` mit derselben
Frist geht an beide.

**kippbar:** zwei flache Felder (`passageEndsAtTick` für das Erhaltene, ein zweites für das
Gewährte); betroffen sind `publicView.ts`, zwei Tests in `publicView.test.ts` und die
Testansicht in `ai/diplomacy.test.ts`. Noch liest kein Produktcode das Feld.

---

## 2026-09-24 · T-M17-04 · Das Verhältnis zählt, was der andere mir gewährt (D29.8)

**Entscheidung:** `relationship()` zählt den **erhaltenen** Durchmarsch (+150) und die
**erhaltene** Karte (+50); was die KI selbst gewährt, zählt nicht. D29.8 sagte „liest
`passageGranted` und `passageReceived`".

**Begründung:** Die Bindungen messen, was die andere Macht aufs Spiel setzt. Eine eigene
Gewährung ist eine **Folge** des Vertrauens, kein Grund dafür — mitgezählt, mochte die KI
jemanden mehr, *weil* sie ihm selbst etwas gegeben hat, und das schaukelt sich auf. Und es ist
verhaltensgleich zu T-M17-03: die Sicht las `rightOfWay` dort schon in der Richtung „er lässt
mich durch". `passageGranted` liest die KI trotzdem — im Erwidern, als Bedingung „selbst noch
nicht gewährt".

**kippbar:** eine Zeile je Feld in `relationship.ts`; der Test „zählt nicht, was sie selbst
gewährt" kippt mit.

---

## 2026-09-24 · T-M17-04 · Die Ränder von Antrag, Annahme und Kündigung (D29.2, D29.5)

**Entscheidung:** Sechs Regeln, die D29.2 nicht nennt:

1. `revokeRightOfWay` lehnt ab, wenn **schon gekündigt** ist (`bereits gekündigt`) — ein zweiter
   Widerruf verschöbe die Frist und gäbe dem Gast mehr Zeit, als der erste versprochen hat.
2. `revokeRightOfWay` lehnt **im Bündnis** ab (`im Bündnis`) — das Bündnis lässt ohnehin durch
   (`detectSurpriseAttacks`), die Kündigung änderte nur die Anzeige, und die wäre falsch.
3. `acceptRightOfWay` lehnt **im Krieg** ab — ein Antrag kann den Kriegsausbruch um bis zu drei
   Tage überleben, und die Annahme ist nichts anderes als `grantRightOfWay`, das im Krieg
   schon immer ablehnt.
4. `grantRightOfWay` während einer Frist **nimmt die Kündigung zurück** (unbefristet, mit
   Ereignis). Gewähren ohne Änderung bleibt **stumm** — die alte KI schickte den Befehl täglich,
   alte Kommandologs tun es weiter.
5. Gewähren und Annahme räumen den **Antrag des Gasts** ab; ein wiederholter Antrag ersetzt den
   alten und beginnt seine Frist neu (wie Friedens- und Bündnisangebote).
6. **Kein Ereignis beim Ablauf der Frist.** Die Kündigung trägt ihren Tag
   (`effectiveAtTick`), und wer ihn verpasst, erfährt den Rest durch den Überfall
   (`WAR_DECLARED` ohne Erklärung, ein Alarm).

**Begründung:** jede der sechs verhindert einen Zustand, der nach außen etwas anderes sagt, als
gilt, oder eine Frist, die sich verschieben lässt. Die Gründe stehen in `commands/diplomacy.ts`
an der jeweiligen Zeile. **Nacharbeit (2026-09-25):** ein Antrag während einer laufenden
Kündigungsfrist nannte fälschlich den Grund „bereits gewährt" — `requestRightOfWay` prüft jetzt
zuerst `passageEndsAtTick(state, target, player) !== null` und nennt „gekündigt".

**kippbar:** jede einzeln; (1) bis (3) haben je einen Test, (4) und (5) je zwei, (6) hat keinen
— wer ein Ablaufereignis will, emittiert es in `expirePassage`s Aufrufer und gibt der Art eine
dritte Satzfassung.

---

## 2026-09-24 · T-M17-04 · Die gerichteten Schreiber stehen neben den Leserinnen (`state/create.ts`)

**Entscheidung:** Neben `grantsPassage` und `sharesMap` stehen jetzt `passageEndsAtTick` (dritte
Leserin), `setPassage`, `expirePassage` und `setMapShared`. Wer eine Richtung liest oder
schreibt, tut es dort; wer beide Richtungen zugleich setzt oder löscht (Bündnis, Krieg), muss
die Hälften nicht kennen.

**Begründung:** Die Regel aus T-M17-03 — *nur diese Stellen wissen, welche Hälfte des
Schlüssels wer ist* — galt für die Leser; seit T-M17-04 muss es auch der Schreiber wissen. Ein
Schreiber in `commands/diplomacy.ts` hätte das Wissen auf zwei Dateien verteilt, und genau
dieser Fehler (Richtung an der falschen Stelle geraten) ist B1. Die Anbau-Regel beider Bahnen
sagte „`state/create.ts` nur, wenn es nicht anders geht" — hier ging es nur mit einer zweiten
Stelle, die dasselbe weiß. Angebaut ist **hinter** `sharesMap`, dazu zwei Typen im Importblock;
die Spionagebahn fasst diese Stellen nicht an.

**Auswirkung:** der Kommentar an `Relation` (`state/types.ts`) nennt die neuen Geschwister —
eine Kommentaränderung, kein Feld, keine Schemastufe.

---

## 2026-09-24 · T-M17-04 · Eine diplomatische Aktion ohne Knopf braucht eine Aufgabe (R-UI-05)

**Entscheidung:** `test/guards/ui-command-coverage.test.ts` prüft jetzt jede `DiplomacyAction`
gegen die Befehlsquellen der Oberfläche. Wer noch keinen Knopf hat, steht mit Grund und
Aufgabe in `DIPLOMATIE_NOCH_OHNE_KNOPF`; eine Ausnahme für eine Aktion, die es nicht gibt oder
die schon einen Knopf hat, fällt als **veraltet**.

**Begründung:** Befund M17-D2. `DIPLOMACY` ist ein Kommandotyp und kam in `actions.ts` vor —
die drei neuen Aktionen wären ohne Knopf grün geblieben, dieselbe Lücke wie bei den Haltungen,
die der Wächter schon kennt. Die Gegenrichtung zwingt T-M17-14, die Einträge zu streichen,
wenn es die Knöpfe baut.

**Auswirkung:** drei Einträge (`requestRightOfWay`, `acceptRightOfWay`, `revokeRightOfWay`) in
`DIPLOMATIE_NOCH_OHNE_KNOPF` (einer eigenen Ausnahmeliste desselben Wächters, **nicht**
`NICHT_FUER_DEN_SPIELER` — das enthält nur die vier Handelsbefehle aus T-M17-05), alle mit
Verweis auf T-M17-14.

---

## 2026-09-25 · T-M17-05 · Rückgabe bei Krieg läuft in Schritt 4 der Diplomatiephase, nicht an den beiden Kriegsstellen

**Entscheidung:** Ein Handelsangebot, das der Krieg trifft, wird **ausschließlich** in
`settleTradeOffers` (Schritt 4, nach den Überfällen) geschlossen — nicht zusätzlich an den
beiden Stellen, an denen ein Krieg beginnt (wirksame Erklärung, Überfall).

**Begründung:** Nur ein Durchlauf mit einer Rangfolge (`invalid` vor `war` vor `expired`) macht
„Überfall und Verfall im selben Tick" von selbst einmalig. Zwei Schließstellen bräuchten eine
zweite Prüfung „ist das Angebot schon geschlossen?" — hier bewusst anders entschieden, weil
D29.3 die Reihenfolge ohnehin so vorgibt.

**Kippbar:** `closeTradeOffer(..., 'war')` in beide Kriegszweige verschieben, Schritt 4 nur noch
für `invalid`/`expired`; der D29.3-Pflichttest bleibt gültig.

---

## 2026-09-25 · T-M17-05 · Während einer laufenden Kriegserklärung: kein neues Geschäft, aber Ablehnen und Zurückziehen bleiben erlaubt

**Entscheidung:** Solange eine Kriegserklärung läuft (`warEffectiveAtTick !== null`), lehnt
`OFFER_TRADE` und `ACCEPT_TRADE` mit `INVALID_TARGET 'Kriegserklärung läuft'` ab; `DECLINE_TRADE`
und `WITHDRAW_TRADE` bleiben möglich. Ein offenes Angebot verfällt erst, wenn der Krieg wirksam
wird oder ein Überfall geschieht.

**Begründung:** R-DIP-05/AK3 verlangt „kein Angebot im Krieg oder bei laufender Erklärung" — das
heißt kein **neues** Geschäft, sagt aber nichts gegen das Abräumen eines bestehenden. Die
Rückgabe folgt konsequent dem Krieg, nicht der Ankündigung.

**Kippbar:** bei `declareWar` sofort mit Grund `war` schließen (eine Zeile in
`commands/diplomacy.ts`).

---

## 2026-09-25 · T-M17-05 · Höchstmengen über den Geld-Anker aus T-M17-02 skaliert, nicht über den Startvorrat

**Entscheidung:** `tradeMaxMoney` (507.650) und `tradeMaxResource` (152.295, 30 % davon) stehen
im Verhältnis von Referenz 9.4 (100.000 zu 30.000), skaliert über denselben Geld-Anker wie der
Spionagesold (T-M17-02: 10.153 = 5 % des Median-Tagesertrags an Tag 30).

**Begründung:** D29.7 sagte „Skala am Startvorrat" — das läge beim ganzen Startgeld (1.667.000)
und bände nichts. Über den gemessenen Anker stehen Handel und Spionage im selben Verhältnis wie
im Vorbild (Handelsgrenze = fünfmal der Anwerbepreis, wie 100.000 zu 20.000).

**Kippbar:** zwei Zahlen in `constants.json`, zwei Zeilen in `BALANCING.md`, der Anker-Fall im
D29.7-Test.

---

## 2026-09-25 · T-M17-05 · Reihenfolge der Ereignisse bei Annahme: erst TRADE_OFFER_CLOSED, dann TRADE_AGREED

**Entscheidung:** `ACCEPT_TRADE.apply` emittiert zuerst `TRADE_OFFER_CLOSED{reason: 'accepted'}`
(über `closeTradeOffer`) und danach `TRADE_AGREED`. Beim Angebot selbst entsteht **kein**
Ereignis — ein offenes Angebot meldet sich über die Sicht (`publicView().tradeOffers`).

**Begründung:** D29.5 nennt `accepted` ausdrücklich als Schließungsgrund, und die Reihenfolge
hält die Bedeutung von `TRADE_OFFER_CLOSED` einheitlich (immer beim Verlassen der Liste). Ein
Ereignis beim Angebot wäre ein zweiter Meldeweg neben der Sicht, ohne zusätzlichen Nutzen.

---

## 2026-09-25 · T-M17-05 · Protokoll: zwei neutrale Sätze, keine Fremdfassung, Kategorie bleibt Wirtschaft

**Entscheidung:** `events.TRADE_AGREED` und `events.TRADE_OFFER_CLOSED` sind neutral formuliert
(kein „ich", kein am Subjekt gebeugtes Verb) und brauchen deshalb **keine** `_FOREIGN`-Fassung;
der Grund beim Schließen kommt über `diplomacy.tradeClosed.*`. `categoryOf` in `Panels.tsx`
bleibt unverändert — `/TRADE/` fängt beide Ereignisarten schon wie die Börse.

**Begründung:** D29.5 verlangt eine Fremdfassung nur, wo ein Satz ein „ich" trägt; hier trägt
keiner eines.

**Kippbar (T-M17-14):** eine Zeile `if (/TRADE_OFFER|TRADE_AGREED/.test(type)) return 'diplomacy'`
vor der Wirtschaftszeile, falls die Oberfläche Handel von der Börse unterscheiden will.

---

## 2026-09-25 · T-M17-05 · Ränder der Handelsangebote (Sammeleintrag)

**Entscheidungen, alle kippbar:** `maxOpenTradeOffers` zählt je **Anbieter**. Gleicher Rohstoff
auf beiden Seiten abgelehnt, leeres `want` erlaubt (Geschenk), Null/negative Mengen auf beiden
Seiten abgelehnt, unbekannte Schlüssel abgelehnt. Provinzen bis T-M17-06 mit `INVALID_TARGET
'Provinzen erst mit dem Provinzhandel'` abgelehnt — genau diese eine Zeile ersetzt T-M17-06.
Kennung `t<n>` aus `nextIds.offer`. Annahme im Tick des Verfalls gilt noch, weil `applyCommands`
vor der Diplomatiephase läuft. Lagergrenze nicht eigens behandelt, wie bei der Börse. Sicht:
eigenes Feld `tradeOffers` am Ende von `PublicView`, volle Kopien vom Typ `TradeOffer`. Helfer
`closeTradeOffer`/`settleTradeOffers` leben in `commands/tradeOffer.ts`, die Phase importiert
sie (Präzedenz `bombard`). `BALANCING.md`: eigener Abschnitt am Dateiende. Ein Commit für die
ganze Aufgabe.

**Nachtrag, Befund M17-D4 (2026-09-25):** eine Gegenprobe (Handler-Import in `handlers.ts`
auskommentieren) beweist die Isolation nicht wie angenommen — `phases/diplomacy.ts` importiert
`settleTradeOffers` direkt aus `commands/tradeOffer.ts`, und dieser Import löst die
`registerCommand`-Aufrufe schon aus. Kein Verhaltensfehler; der eigentliche Beleg gegen „leer
grün" bleibt die Zählung der Ausgänge im Eigenschaftstest.

---

## 2026-09-25 · T-M17-06 · Eine fünfte Ablehnung „fremde Armeen" — eine dritte Macht in der Provinz verhindert die Abtretung

**Entscheidung:** Steht die Armee einer dritten Macht (weder Abtretender noch Empfänger, nicht im
Krieg mit dem Abtretenden) in der angebotenen Provinz, lehnt `cessionProblem` mit
`INVALID_TARGET 'fremde Armeen'` ab.

**Begründung:** Sie steht dort nur mit Recht oder Bündnis des Abtretenden — beides geht bei der
Abtretung nicht auf den Empfänger über, und im Tick danach wäre sie ein Überfall auf den
Empfänger. R-DIP-09/AK1 nennt vier Gründe und verbietet keinen fünften; ohne diesen wäre die
dod-Zusage „nie ein Überfall" falsch.

**Kippbar:** als Unterfall von „umkämpft" führen, statt als eigener Grund.

---

## 2026-09-25 · T-M17-06 · Fremde Märsche werden bei der Abtretung nicht geprüft (Befund M17-D5)

**Entscheidung:** `cessionProblem` prüft nur Armeen, die in der Provinz **stehen** (jeder Macht)
und eigene Armeen **auf dem Weg** hinein — nicht fremde Armeen, die mit Recht des Abtretenden auf
dem Marsch in die Provinz sind.

**Begründung:** Das Ziel eines fremden Marsches ist verborgene Information (R-DIP-04, die Sicht
zeigt fremde Wege nicht, `publicView.ts`); es zu prüfen hieße, es dem Abtretenden zu verraten. Die
dod-Zusage „nie ein Überfall im Tick danach" gilt deshalb für alle Armeen, die in der Provinz
stehen, und für die eigenen auf dem Weg — nicht für fremde Märsche.

**Kippbar:** entweder den Leak hinnehmen und Pfade aller Nicht-Empfänger prüfen, oder beim
Abtreten fremde Wege vor der Provinz enden lassen (neue Mechanik). Siehe Befund M17-D5 in
`PROBLEME.md`.

---

## 2026-09-25 · T-M17-06 · Was ein Provinzangebot wem verrät: die verlangte Seite nur öffentlich, die gebende voll

**Entscheidung:** Beim Angebot wird die **gebende** Seite voll geprüft (Existenz, Besitz,
Hauptstadt, umkämpft, eigene/fremde Armeen — der Anbieter legt seine eigene Provinz auf den
Tisch), die **verlangte** Seite nur öffentlich (Existenz, Besitz). Bei der Annahme werden beide
Seiten voll geprüft — dort prüft jede Macht ihre eigene Provinz. Scheitert die Annahme an der
verlangten Seite (Hauptstadt, Armeen des Annehmenden), bleibt das Angebot liegen statt zu
verfallen; der Annehmende kann räumen und später annehmen.

**Begründung:** Eine volle Prüfung der verlangten Seite beim Angebot wäre ein Armee- und
Hauptstadtscanner für jede fremde Provinz — ein kostenloser `canApply`-Aufruf würde R-DIP-04
brechen. D29.2 nennt für `want` ohnehin nur „nicht im Besitz des Ziels".

**Kippbar:** alle drei Punkte einzeln.

**Nachtrag (Nacharbeit "kern", 2026-09-25):** zwei ungeprüfte Leck-Wege sind trotz dieser
Entscheidung offen geblieben. `ACCEPT_TRADE.check` prüft die gebende Seite mit Tiefe `full`
(auch `army.path`) — ein `MOVE_ARMY` des Anbieters im selben Befehlsschub vor dem `ACCEPT_TRADE`
verrät dem Annehmenden über die Ablehnung `eigene Armeen`/`fremde Armeen`, dass der Anbieter dort
etwas bewegt, ohne dass die Sicht das je zeigen würde. Derselbe Leak entsteht auch **passiv**,
ohne dass `ACCEPT_TRADE` je versucht wird: `settleTradeOffers` prüft die gebende Seite mit Tiefe
`full` in **jeder** Diplomatiephase, und ein `TRADE_OFFER_CLOSED{reason:'invalid'}` ohne
öffentliche Ursache verrät dasselbe, nur einen Tick später. Beide Wege offen, nicht repariert
(keine Zweizeiler-Lösung — bräuchte eine redaktionsärmere Rückmeldung für genau diesen
Prüfschritt oder eine neue `CommandResult`-Form), Kandidat für T-M17-14.

---

## 2026-09-25 · T-M17-06 · Moral und Besatzungszeit bleiben bei einer Abtretung unverändert

**Entscheidung:** `cedeProvince` setzt weder `morale` noch `occupiedSince` — eine früher gesetzte
Besatzungszeit läuft unverändert weiter.

**Begründung:** Eroberungsmoral und Besatzungszeit sind Eroberungsfolgen (`targetMoraleFor`,
`occupationFactor`); eine Abtretung ist kein Kampfergebnis. Nebenwirkung: `occupiedSince` gilt für
abgetretene Provinzen nicht als „seit wann gehört sie ihrem jetzigen Eigentümer".

**Kippbar:** `occupiedSince = draft.tick` beim Abtreten setzen, wie bei der Eroberung.

---

## 2026-09-25 · T-M17-06 · Ränder des Provinzhandels (Sammeleintrag)

**Entscheidungen, alle kippbar:** Eigene Armeen **auf dem Weg** in die Provinz gelten wie eigene
Armeen darin — sonst käme die Armee im Land des Empfängers an. Der Helfer
`transferProvince(draft, provinceId, newOwner): PlayerId | null` lebt in `phases/occupation.ts`,
setzt Besitzer und leert die Aushebung; Bauaufträge enden über `ownerAtStart` in der Bauphase.
Ereignisreihenfolge bei der Annahme: `TRADE_OFFER_CLOSED`, `TRADE_AGREED`, dann `PROVINCE_CEDED`
je Provinz — erst die gegebenen, dann die verlangten, in Listenreihenfolge. Rubrik Diplomatie
für `PROVINCE_CEDED` (`categoryOf`, Präzedenz `RIGHT_OF_WAY_CHANGED` aus T-M17-04). Keine neue
Regelzahl, keine Höchstzahl an Provinzen je Angebot — Besitz und Doppelungsverbot begrenzen die
Liste. Prüfstellen: im Angebot an der Stelle der alten Provinzzeile, gebende vor verlangter
Seite; in der Annahme nach dem Krieg, vor der Deckung; unbekannte Kennung `PROVINCE_NOT_FOUND`,
doppelte `INVALID_TARGET 'doppelte Provinz'`. „Leeres Angebot" heißt: weder Rohstoffe noch
Provinzen gegeben — eine Provinz allein ist ein Angebot. Scheitert die gebende Seite erst bei der
Annahme, erfährt der Annehmende den Grund über `COMMAND_REJECTED`. Zwei Commits: der
verhaltensgleiche Helfer zuerst (Golden-Master als Beleg), dann der Provinzhandel.

---

## 2026-09-25 · Nacharbeit "kern" (T-M17-04/05/06) · Ein Handelsangebot mit unbekanntem Anbieter verfällt stillschweigend statt abzustürzen (Befund M17-D6)

**Entscheidung:** `closeTradeOffer` gibt die Treuhand nur zurück, wenn `draft.players[offer.from]`
existiert — ohne bekannten Anbieter verfällt sie stillschweigend statt den Tick abzubrechen.

**Begründung:** `settleTradeOffers` stuft ein Angebot mit unbekanntem `offer.from` als `invalid`
ein; `closeTradeOffer` griff bisher unbedingt auf `draft.players[offer.from]!.resources` zu — ein
`TypeError`, sobald `offer.give.resources` einen Betrag trug. Nur über einen geladenen
Spielstand erreichbar (kein Befehl dieser Bahn kann das erzeugen); `validateState` prüfte
`give`/`want` bisher nur als Objekt, nicht `from`/`to` als bekannte Spielerkennungen.

**Auswirkung:** Test zuerst rot (`TypeError`), danach schließt das Angebot als `invalid`, ohne
den Bestand des Empfängers zu berühren.

**kippbar:** stattdessen `validateState` erweitern, damit ein solcher Stand gar nicht erst lädt
(siehe Merge-Hinweise; beides zusammen geschlossen bei der Zusammenführung, siehe unten).

---

## 2026-09-25 · Nacharbeit "kern" (T-M17-04/05/06) · Der Spielertext zu einem hinfälligen Handelsangebot nennt jetzt beide möglichen Ursachen (Befund M17-D7)

**Entscheidung:** `diplomacy.tradeClosed.invalid` (`apps/desktop/src/i18n/de.ts`) nennt seit
T-M17-06 beide möglichen Ursachen einer `invalid`-Schließung („eine Macht ist ausgeschieden oder
eine Provinz nicht mehr abtretbar") statt nur das Ausscheiden.

**Begründung:** Seit T-M17-06 schließt `settleTradeOffers` ein Angebot auch dann mit `invalid`,
wenn eine Provinz nicht mehr abtretbar ist (`provincesLapsed`) — der alte Text behauptete für
diesen Fall fälschlich ein Ausscheiden.

**Auswirkung:** Der Kommentar über `TradeOfferCloseReason` in `events/types.ts` ist ebenso
präzisiert. **Offen, nicht repariert (Sekundärbefund):** der Zusatz „— das Hinterlegte geht
zurück" steht bei allen fünf Verfallsgründen fest im Text, auch wenn ein Angebot nur Provinzen
und keine Rohstoffe trug — eine Reparatur bräuchte ein neues Feld am Ereignis und eine
Entscheidung gegen die bewusste Zusage „ohne Mengen" (D29.5); Kandidat für T-M17-14.

---

## 2026-09-25 · Nacharbeit "kern", Runde 2 (T-M17-04/05/06) · `M17-D5` war doppelt vergeben — umnummeriert auf `M17-D10`

**Befund:** Zwei adversarische Prüfer meldeten dieselbe Kollision: `M17-D5` stand einmal für
„fremde Märsche bei der Abtretung ungeprüft" (T-M17-06) und einmal für „Heimmarsch länger als die
Kündigungsfrist" (T-M17-10, `passage.test.ts`).

**Entscheidung:** Der jüngere, in T-M17-10 entstandene Sinn wird **umnummeriert auf `M17-D10`**
(nächste freie Nummer) — der ältere, in T-M17-06 entstandene Sinn behält `M17-D5`. Betroffen:
`packages/ai/src/passage.test.ts` (vier Stellen), Berichte, dieses Fragment. Der Code-Kommentar
in `tradeOffer.ts:124` bleibt unverändert richtig, weil er jetzt die einzige verbliebene
Bedeutung trägt.

**Auswirkung:** In `PROBLEME.md` erscheinen beide Nummern erstmals hier eingepflegt, nicht mehr
kollidierend — `M17-D5` (T-M17-06, fremde Märsche bei der Abtretung) und `M17-D10` (T-M17-10,
Heimmarsch länger als die Kündigungsfrist).

---

## 2026-09-25 · Nacharbeit "kern", Runde 2 · Die Kündigungsfrist-Falle gehört inhaltlich zu T-M17-04, sichtbar wurde sie erst in T-M17-10 (zu Befund M17-D10)

**Entscheidung:** Der Befund bleibt bei T-M17-10 dokumentiert (wo er zuerst gemessen wurde), trägt
aber ab hier den Hinweis, dass Ursache und Reparaturort in T-M17-04 liegen: `rightOfWayNoticeTicks`
(24 Ticks) und `detectSurpriseAttacks` entstehen beide dort. Ein Mensch bemerkt die Lücke nicht,
weil er selten binnen eines Ticks reagiert — die KI (T-M17-10) reagiert sofort und deckt sie auf.

**Begründung:** gemessen an m1→n2 (160.000 km, Infanterie ohne Bonus): der Heimweg dauert rund 27
Ticks, die Frist nur 24 — eine Armee, die sofort losmarschiert, kann die Frist trotzdem reißen.

**kippbar, nicht entschieden:** (a) eine Armee, deren Pfad beim Fristende schon aus dem Land des
Gewährenden hinausführt, gilt in `detectSurpriseAttacks` nicht als Überfall; (b) die Frist wird
aus der längsten Landkante oder der Marschzeit abgeleitet statt geschätzt — nicht einfach
angehoben, ohne zu messen. Keine der beiden Richtungen ist in M17 gebaut.

---

## 2026-09-24 · T-M17-07 · Ein fremder Spion wird abgelehnt wie einer, den es nicht gibt (D29.2)

**Entscheidung:** `REASSIGN_SPY` und `DISMISS_SPY` lehnen einen Spion, der einer anderen Macht
gehört, mit **demselben** Ergebnis ab wie eine Kennung, die es nicht gibt:
`INVALID_TARGET { reason: 'kein Spion' }`. D29.2 nannte `NOT_OWNER`.

**Begründung:** Die Ablehnung ist ein Text an den Befehlenden (`COMMAND_REJECTED`, Leserschaft
nur er) und über `canApply` eine Frage, die jede KI stellen kann. Die Kennungen sind
fortlaufend über alle Mächte (`s${nextIds.spy++}`). `NOT_OWNER` hieße „diese Kennung gibt es,
sie gehört jemand anderem" — wer `s1`, `s2`, … durchprobiert, zählte die **lebenden** Spione
aller anderen. Das ist genau die Sorte fremder Bestand, die R-DIP-04 verbirgt.

**Auswirkung:** Der Schritt „Eigentum" der Prüfreihenfolge fällt bei Spionbefehlen mit der
Existenz zusammen (`ownSpy` in `commands/espionage.ts`).

**kippbar:** eine Zeile in `ownSpy` plus eine `NOT_OWNER`-Prüfung in beiden `check`s; der Test
fällt dann bewusst und wird mit ihm umgeschrieben. Wer kippt, nimmt die Zählbarkeit in Kauf.

---

## 2026-09-24 · T-M17-07 · Die Zielbedingung eines Spions prüft den Besitzer, den der Spieler kennt (R-SPY-01/AK2–AK3)

**Entscheidung:** „Sabotage oder Aufklärung in eigener, Gegenspionage in fremder, Sabotage in
herrenloser Provinz" wird gegen den **bekannten** Besitzer geprüft: den wahren, wenn der Spieler
die Provinz sieht (`visibleProvinces`), sonst den aus seinem Aufklärungsgedächtnis
(`player.intel`). Eine Provinz, die in keinem von beiden steht, ist `unbekannt` (AK3).
`knownOwner()` in `commands/espionage.ts`.

**Begründung:** Gegen den wahren Besitzer geprüft, verriete die Ablehnung „herrenlos" einen
Besitzwechsel hinter dem Nebel — und über `canApply` hätte jede KI den Nebel Provinz für Provinz
abfragen können, ohne je einen Befehl zu senden. Dass ein Auftrag am Ausführungstag nicht mehr
passt, fängt der Tageslauf ohnehin ab (`targetChanged`, T-M17-08).

**kippbar:** `knownOwner` durch `province.owner` ersetzen — dann wird die Ablehnung ein Orakel.

---

## 2026-09-24 · T-M17-07 · Umsetzen, das nichts ändert, wird abgelehnt

**Entscheidung:** `REASSIGN_SPY` mit demselben Ziel und demselben Auftrag wird mit
`INVALID_TARGET { reason: 'unverändert' }` abgelehnt.

**Begründung:** Ein Umsetzen setzt `assignedTick` neu, und ein Spion führt frühestens am Tag
danach aus (R-SPY-02/AK3). Ein wirkungsgleiches Umsetzen verschenkte also nur den nächsten Tag.

**kippbar:** eine Bedingung in `REASSIGN_SPY.check`; der Test fällt mit.

---

## 2026-09-24 · T-M17-07 · Die eigenen Spione stehen in einem eigenen Feld am Ende der Sicht (D29.6)

**Entscheidung:** `PublicView.espionage.spies` statt `self.spies`. Nur die eigenen, ohne
Besitzerfeld (es wäre immer ich), als Kopien, in der Reihenfolge des Zustands.

**Begründung:** Anbau-Konvention der beiden M17-Bahnen: jede Bahn baut an eine eigene Stelle am
Ende an, damit die Zusammenführung von Hand trivial bleibt.

**kippbar:** nach dem Zusammenführen kann T-M17-13 das Feld unter `self` ziehen.

---

## 2026-09-24 · T-M17-07 · Der Gegenspionagesold wird abgerundet wie der Anker (D29.7)

**Entscheidung:** `spySalaryCounter` = **5076** (½ × 10153 = 5076,5, abgerundet).

**Begründung:** Der Anker selbst ist in T-M17-02 als „5 %, abgerundet" definiert. Dieselbe
Rundung für die abgeleitete Zahl hält die Regel einheitlich.

**kippbar:** 5077; der Verhältnistest (`Math.floor`) fällt dann und wird mitgezogen.

---

## 2026-09-25 · T-M17-09 · Die AK4-Sperre gilt über beide Sabotagearten und verhindert den Wurf, nicht nur die Wirkung (R-SPY-04/AK4)

**Entscheidung:** Höchstens eine **gelungene** Sabotage je Provinz und Tag — über
`economicSabotage` **und** `militarySabotage` gemeinsam gezählt, als lokale Menge
(`sabotagedToday: Set<ProvinceId>`) innerhalb eines Durchlaufs von `settleEspionage`, nicht als
Zustandsfeld. Ein Saboteur, der auf eine bereits sabotierte Provinz trifft, **würfelt nicht** und
meldet `failure`.

**Begründung:** R-SPY-04 sagt „je Provinz und Tag wirkt höchstens eine Sabotage" ohne Art zu
nennen; AK4 spricht von „bereits eine Sabotage **gelungen**". Ein Wurf ohne mögliche Wirkung wäre
Zufallsverbrauch ohne Sinn und hätte den Determinismustest (D29.4) unnötig verkompliziert.
`failure` statt einer eigenen Ausgangsart, weil `Spy['lastOutcome']` (Zustand Stufe 4) auf drei
Werte festgelegt ist.

**Auswirkung:** Zwei Saboteure derselben Provinz am selben Tag: der zweite meldet immer
`failure`, unabhängig vom Zufall — kein Zufallszug. Am nächsten Tageswechsel ist dieselbe
Provinz wieder ein gültiges Ziel.

**kippbar:** die Prüfung `sabotagedToday.has(...)` entfernen (dann würfelt jeder Saboteur) oder
sie je Art statt gemeinsam führen (zwei Sperren).

---

## 2026-09-25 · T-M17-09 · Der Gegenspion meldet keinen eigenen Bericht und unterscheidet „niemand da" nicht von „nicht gefunden" (R-SPY-05)

**Entscheidung:** Ein Gegenspion erzeugt **nie** ein `SPY_REPORT` außer bei `targetChanged`. Sein
`lastOutcome` ist `success`, wenn er an diesem Tag mindestens einen fremden Spion enttarnt hat,
sonst `failure` — **ohne** Unterschied zwischen „kein fremder Spion in der Provinz" und „ein
fremder Spion da, aber der Wurf ist misslungen".

**Begründung:** Ein täglicher Bericht „Gegenspionage: misslungen" wäre Lärm ohne Nutzen. Die
Gleichheit von „niemand da" und „nicht gefunden" ist die eigentliche Pointe: sonst verriete der
Gegenspion dem eigenen Besitzer, dass ein fremder Spion da ist, den er nicht gefangen hat — und
R-SPY-05/AK2 verlangt ausdrücklich, dass eine ungeschützte Provinz von der geschützten nicht
unterscheidbar bleibt.

**Auswirkung:** Die Übersicht (T-M17-13) darf `failure` bei einem Gegenspion nicht als
„misslungen" anzeigen, sondern als „keine Enttarnung".

**kippbar:** `lastOutcome` um einen dritten Wert erweitern (`null` bei „niemand da").

---

## 2026-09-25 · T-M17-09 · SPY_DETECTED trägt keine Spionkennung (R-SPY-05/AK1, D29.5, Befund M17-S1)

**Entscheidung:** `SpyDetectedEvent` hat die Felder `playerId` (Urheber), `targetPlayerId`
(Entdecker), `provinceId`, `mission` — **keine** `spyId`.

**Begründung:** D29.5 nennt keine Kennung. Eine fremde Spionkennung im Ereignis des Entdeckers
öffnete genau die Lücke, die Befund M17-S1 (T-M17-07) schon für die eigene Kennungsfolge
beschreibt — nur diesmal mit fremden Kennungen direkt im Protokoll. Der Urheber erkennt seinen
verlorenen Spion ohnehin an Provinz und Auftrag, aus dem eigenen `espionage.spies`-Array (er
wird entfernt).

**Auswirkung:** Schließt M17-S1 **nicht**, verhindert aber, dass diese Aufgabe eine zweite,
direktere Form derselben Lücke einführt.

**kippbar:** `spyId: spy.id` ins Emit aufnehmen.

---

## 2026-09-25 · Nacharbeit kern (zweite Runde, T-M17-09) · SABOTAGE_SUFFERED ist kein Rückschlag im Sinn von D24.1 (E8)

**Entscheidung:** `SABOTAGE_SUFFERED` trägt immer alle drei Wirkungsfelder (`kind`,
`moraleLoss`, `destroyed`/`delayTicks`), aber `isSelfSetback` (`SELF`-Menge, D24.1) bleibt
unverändert — Sabotage ist kein Rückschlag im Sinn des Zinnober-Balkens.

**Begründung:** die feste Schlüsselmenge (Wirtschafts- **und** Militärsabotage tragen dieselben
Felder) macht den Anonymitätstest scharf (kein Feld verrät die Art nur durch sein Fehlen). Der
Zinnober-Balken ist bewusst eng (D24.1); ob Sabotage optisch dazugehört, entscheidet die
Oberfläche (T-M17-13), nicht der Kern.

**kippbar:** `SABOTAGE_SUFFERED` (oder nur `kind: 'military'`) in `SELF` aufnehmen.

**Dazu, kurz (im Bauplan getroffen, hier nachgetragen):**
- Militärsabotage verschiebt **alle** laufenden Aufträge beider Warteschlangen der Provinz, auch
  die eines Vorbesitzers — jeder Auftrag trägt sein eigenes `completesAtTick`, „laufend" heißt in
  der Warteschlange, unabhängig vom Eigentümer zum Anlegezeitpunkt.
- Der Ansehensverlust (`spyDetectedReputationLoss`) ist **doppelt**, wenn der enttarnte Spion
  sabotiert hatte **und** Urheber/Entdecker nicht im Krieg sind (`atWar`, eine laufende
  Kriegserklärung zählt als Frieden) — kein Boden, wie beim Überfall.

---

## 2026-09-25 · T-M17-12 · Das Spionagebudget der KI gilt dem Tagessold, nicht dem Anwerbepreis (E1)

**Entscheidung:** `espionageBudgetPermille` begrenzt die Summe des täglichen Solds aller eigenen
Spione. Der Anwerbepreis (`spyRecruitCost`, einmalig) ist stattdessen an die Rücklage der
Wirtschaft (`RESERVE_PERMILLE` 200) und an den Geldhorizont (`espionageMoneyHorizonDays`)
gebunden.

**Begründung:** D29.8 spricht von „höchstens so viel Tagessold [...] in Promille ihres
täglichen Geldertrags" — das ist eine laufende Rate, kein Einmalbetrag.

**kippbar:** Budget auch auf den Anwerbepreis anwenden.

---

## 2026-09-25 · T-M17-12 · Geldertrag und Armeeunterhalt werden aus der Sicht nachgerechnet, nicht aus den Regeln gelesen (E2)

**Entscheidung:** `dailyMoneyIncome`/`dailyArmyMoneyUpkeep` (`packages/ai/src/espionage.ts`) sind
ein Zwilling der Steuerformel aus `packages/core/src/phases/production.ts`, gerechnet über
`PublicView` statt über `GameState`.

**Begründung:** `runner.ts` baut die Sicht der KI ohne Regeln, `self.economy` fehlt also. Einen
neuen Kern-Export dafür zu bauen, wäre eine Änderung an `phases/production.ts` gewesen, die
nicht in diese Bahn gehört. `espionage.test.ts` hält beide Funktionen mit einer eigenen
Zusicherung gegen `economyOverview` gleich.

**kippbar:** `provinceYieldScaled` aus dem Kern exportieren und aus der Sicht füttern.

---

## 2026-09-25 · T-M17-12 · Reihenfolgen beim Anwerben und beim Entlassen (E3+E4)

**Entscheidung:** Anwerben: **Gegenspion → Aufklärer → Wirtschaftssaboteur**, höchstens einer je
Tag. Entlassen bei Geldnot oder Budgetüberschreitung: **Wirtschaftssaboteur/Militärsaboteur →
Aufklärer → Gegenspion** (`DISMISS_RANK`), im Gleichstand der **späteste im Array**; bei
**akutem** Geldmangel (`shortages` enthält `money`) gehen **alle** auf einmal.

**Begründung:** Ein Gegenspion schützt vor Enttarnung und Sabotage im eigenen Land, ein
Aufklärer liefert nur Information, ein Saboteur nur Schaden beim Gegner — bei knappem Geld ist
der Eigenschutz die letzte Zusage, die fällt. Die Array-Reihenfolge (statt der Kennung) hält das
Ergebnis unabhängig davon, in welcher Reihenfolge Spione angeworben wurden.

**kippbar:** Aufklärer vor dem Anwerben des Gegenspions; `DISMISS_RANK` umdrehen.

---

## 2026-09-25 · T-M17-12 · Die KI baut keine Militärsabotage (E5)

**Entscheidung:** Die KI wirbt nie einen Militärsaboteur an. Ein vorhandener wird wie ein
Wirtschaftssaboteur behandelt, wenn sein Ziel ungültig wird.

**Begründung:** D29.8 nennt für die KI ausdrücklich nur Wirtschaftssabotage; der Wert einer
verzögerten Bauwarteschlange ist ohne eine Bewertungsfunktion für militärische Vorhaben nicht
sinnvoll einzuschätzen.

**kippbar:** `nextMission` im Umsetzen-Zweig auf `militarySabotage` setzen, wenn ein
Bewertungsmaß existiert.

---

## 2026-09-25 · T-M17-12 · Kein Umsetzen, solange das Ziel gültig bleibt (E6)

**Entscheidung:** Ein Aufklärer oder Saboteur mit einem weiterhin gültigen Ziel wird **nicht**
umgesetzt, auch wenn zwischenzeitlich eine wertvollere Provinz bekannt wird.

**Begründung:** Jedes Umsetzen kostet einen Tag (R-SPY-02/AK3) — ständiges Umschichten wäre
Bewegung ohne Wirkung.

**kippbar:** die Gleichheitsprüfung entfernen, dann wechselt die KI immer auf das aktuell beste
Ziel.

---

## 2026-09-25 · T-M17-12 · „Erlittene Enttarnung" wirkt über die vorhandene Verstimmung, keine eigene Ereignisauswertung (E7)

**Entscheidung:** „Erlittene Enttarnung" (D29.8) ist keine eigene Regel der Spionage-KI. Der
Kern trägt sie schon ein: `SPY_DETECTED` erhöht `grievanceOnSpyDetected` beim Entdecker
(T-M17-09). `espionageCounterGrievance` (150) liegt darunter, die Spionage liest also nur die
vorhandene Verstimmung (`view.self.grievances`).

**Begründung:** Die KI sieht keine Ereignisse (`AiContext` führt nur `PublicView`, `memory`,
`rules`, `map`, `difficulty`) — eine eigene Auswertung von `SPY_DETECTED` hätte einen neuen
Sichtkanal gebraucht, den T-M17-09 mit der Verstimmung schon liefert.

**Auswirkung:** `espionage.test.ts` hält fest: `grievanceOnSpyDetected >= espionageCounterGrievance`.

**kippbar:** eine eigene, höhere Schwelle nur für Enttarnung — bräuchte einen eigenen Sichtkanal.

---

## 2026-09-25 · T-M17-12 · Ein Friedensangebot oder dessen Annahme im selben Zug zählt schon als Frieden (E8)

**Entscheidung:** `earlier`-Befehle desselben Strategietakts mit `action: 'acceptPeace'` oder
`'offerPeace'` nehmen das Ziel aus der Menge der Kriegsgegner heraus — Saboteure gegen diese
Macht werden **im selben Zug** entlassen, nicht erst am nächsten Tag.

**Begründung:** Sonst würde die KI im selben Atemzug Frieden anbieten und weiter sabotieren.

**Auswirkung:** `espionageCommands` liest `commands` (die bereits von `diplomacyCommands`
gefüllte Liste desselben Takts) — die Reihenfolge in `decide.ts` (Diplomatie vor Spionage) ist
dafür Voraussetzung.

**kippbar:** `peaceBound` auf nur `acceptPeace` oder nur `offerPeace` einschränken.

---

## 2026-09-25 · T-M17-12 · Tests bauen echte Zustände der Testwelt statt eine Sicht von Hand (E9)

**Entscheidung:** `espionage.test.ts` erzeugt seine Sichten mit `publicView(state, 'p2')` aus
einem `createInitialState`-Zustand der Testwelt, nicht mit einem von Hand geschriebenen
`PublicView`-Objektliteral.

**Begründung:** Ein handgebautes Sichtobjekt müsste bei jedem neuen Feld auf `PublicView` von
Hand nachgezogen werden — über echte Zustände ist jeder zurückgegebene Befehl außerdem mit
`canApply` gegen denselben Zustand prüfbar.

**kippbar:** zurück zu Handsichten, falls `lage()` selbst zum Flaschenhals wird.

---

## 2026-09-25 · T-M17-12 · Debugtexte nennen Provinznamen und Machtkennungen, nie Spionkennungen (E10)

**Entscheidung:** Jede Begründung (`Explanation.action`/`.reason`) nennt eine Provinz über ihren
Namen, nie ihre Kennung, und schon gar nicht die Kennung eines Spions.

**Begründung:** Befund M17-S1: eine Kennung wie `s2` ist im Text nicht von einer
Provinzkennung zu unterscheiden — der Wächter (`text-keys.test.ts`) prüft `\bs\d+\b` auf dem
gerenderten Text.

**kippbar:** keine sinnvolle Kippung — Spielertexte mit internen Kennungen wären ein
Regressionsfehler.

---

## 2026-09-25 · T-M17-12, Nacharbeit · Ein noch offenes eigenes Friedensangebot vom Vortag zählt ebenso als Frieden wie eines vom selben Zug (E-NA1)

**Entscheidung:** `PublicView` führt neben `incomingOffers` jetzt auch `outgoingOffers`
(eigene offene Angebote). `peaceBound` in `espionage.ts` bindet eine Macht nicht nur über
`earlier` (E8, derselbe Zug), sondern auch, wenn `view.outgoingOffers` noch ein Friedensangebot
an sie führt.

**Begründung:** `earlier` sieht nur den heutigen Zug. Bietet die KI an einem Tag Frieden an und
ist die Lage am nächsten Tag nicht mehr so schlecht, bietet sie nicht erneut an — das Angebot
bleibt aber bis zu drei Tage offen und kann jederzeit angenommen werden. Ohne `outgoingOffers`
sah die Spionage dieses schwebende Angebot nicht und hielt einen Saboteur, bis der Gegner
annimmt.

**Auswirkung:** `PublicView` wächst um ein Feld (append-only); ein handgebautes
`PublicView`-Testobjekt braucht `outgoingOffers: []` nachgetragen. Kein Verstoß gegen R-DIP-04:
ein Angebot von mir ist mein eigenes Wissen.

**kippbar:** `outgoingOffers` nur für Sabotage/Anwerben lesen, nicht für den Gegenspion.

---

## 2026-09-25 · T-M17-12, zweite Nacharbeit ki · Der Gegenspion wird nur durch ein echtes Kriegsende gebunden, nicht durch ein eigenes Friedensangebot (E-NA2, Befund M17-S8)

**Entscheidung:** `peaceBound()` (E8/E-NA1) bindet weiterhin Aufklärung und Sabotage, aber
**nicht mehr** den Gegenspion. Der Gegenspion liest stattdessen `warEnemies` — den echten,
ungefilterten Kriegsgegner-Satz aus `view.relations`.

**Begründung:** D29.8 entlässt den Gegenspion „bei Kriegsende", nicht bei einem eigenen Antrag
auf Frieden. Ein Friedensangebot ist ein Antrag: `relations[x].state` bleibt `'war'`, bis der
Gegner annimmt, und bis dahin kann die Gegenseite unverändert weiter gegen mich spionieren — der
Gegenspion ist genau die Verteidigung dagegen. Ein adversarischer Prüfer maß 41 von 41
betroffenen Entlassungen in einem tatsächlich laufenden Krieg.

**Auswirkung:** Drei bestehende Testfälle korrigiert (der Gegenspion bleibt jetzt, nur ein
gleichzeitig vorhandener Saboteur wird noch entlassen); eine vierte, neue Gegenprobe hält fest,
dass ein **echtes** Kriegsende weiterhin entlässt.

**kippbar:** auch den Gegenspion an `peaceBound` binden, wenn Noah entscheidet, dass ein eigenes
Friedensangebot als vertrauensbildende Geste auch die eigene Spionageabwehr zurückfahren soll.

---

## 2026-09-25 · Zusammenführung Bahn A und B in M17 · Gerichteter Durchmarsch im Wächter der Schlüsselhälften

**Entscheidung:** `relation-direction.test.ts` (Nacharbeit zu T-M17-03) hielt fest, dass
`grantRightOfWay` und `shareMap` beide Richtungen setzen, und las die Sichtfelder
`rightOfWay`/`sharedMap`. Seit T-M17-04 setzen beide nur die eigene Richtung (`setPassage`,
`setMapShared`), und die Sicht führt `passageGranted`/`passageReceived` und
`mapShared`/`mapReceived` (D29.6). Die Fälle halten jetzt genau diese Semantik fest, in beiden
Schlüsselhälften und über alle sechs Felder: die eigene Richtung öffnet sich und verliert ihre
Frist, die Gegenrichtung behält Recht **und** Frist; die Sicht prüft je Freigabe beide
Blickrichtungen.

**Begründung:** `acceptAlliance`, `breakAlliance` und der Kriegsausbruch schreiben weiter beide
Richtungen (Bündnis und Krieg sind gegenseitig, D29.1) — nur die gerichteten Aktionen aus
T-M17-04 ändern sich.

**Auswirkung:** Gegenprobe: `grant` setzt beide Richtungen (4 rot), trifft die falsche Hälfte (4
rot), `shareMap` setzt beide (2 rot), `passageGranted` vertauscht (2 rot), `mapReceived`
vertauscht (2 rot).

---

## 2026-09-25 · Zusammenführung Bahn A und B in M17 · `PublicView` trägt drei neue Felder, jedes einmal

**Entscheidung:** `tradeOffers` (Bahn A, T-M17-05: eigene Handelsangebote, `incoming`/`outgoing`),
`espionage` (Bahn B, T-M17-07: eigene Spione) und `outgoingOffers` (Bahn B, T-M17-12, Befund
M17-S5: eigene offene **diplomatische** Angebote — Frieden, Bündnis, Durchmarschantrag).
Reihenfolge an Interface und `return`: `tradeOffers`, `espionage`, `outgoingOffers`.

**Begründung:** `outgoingOffers` gibt es nur auf Bahn B; es ist **kein** Doppel zu
`tradeOffers.outgoing` — `tradeOffers.outgoing` führt Handelsangebote aus
`state.diplomacy.tradeOffers`, `outgoingOffers` liest aus `state.diplomacy.offers`. Beide bleiben
getrennt; wer den eigenen Durchmarschantrag sucht, filtert `outgoingOffers` auf
`kind: 'rightOfWay'` (T-M17-10/14 brauchen kein eigenes Feld).

---

## 2026-09-25 · Zusammenführung Bahn A und B in M17 · `validateState` prüft Spione, Aufdeckungen und Handelsangebote je Element (schließt M17-S7 und M17-D6)

**Entscheidung:** So tief, wie der erste Tick sie liest, und so streng, wie der Befehl sie
annimmt: Spion (`id`, `owner` und `provinceId` als **eigene** Einträge per `Object.hasOwn`,
`mission` aus `SPY_MISSIONS`, `recruitedTick`/`assignedTick` Zahl, `lastRunTick` Zahl oder
`null`, `lastOutcome` aus den drei Ausgängen oder `null`), Aufdeckung (`player`, `provinceId`,
`kind` `intel`/`armies`, `untilTick` Zahl), Handelsangebot (`id`, `from`/`to` bekannte und
verschiedene Mächte, `createdTick`/`expiresAtTick` Zahl, Rohstoffe aus `RESOURCE_KEYS` mit
ganzen Beträgen über null wie bei `OFFER_TRADE`, Provinzen der Karte).

**Begründung:** Ein Spion einer **ausgeschiedenen** Macht bleibt gültig — der nächste
Tageswechsel räumt ihn ab (M17-S3), ein Stand dazwischen ist echt. Der migrierte Ladeweg braucht
keinen eigenen Fall — Schritt 3 → 4 legt Spione, Aufdeckungen und Handelsangebote immer leer an.

**Auswirkung:** Test zuerst: 26 Verfälschungen eines gültigen Standes und der Hash-Ladeweg, 27
von 27 rot vor der Änderung; Gegenprobe `in` statt `Object.hasOwn` (2 rot), Betrag null erlaubt
(1 rot), Spionschleife entfernt (11 rot). Commit `b793a0f`.

---

## 2026-09-25 · Zusammenführung Bahn A und B in M17 · Die Spionage der KI rechnet mit dem Geld des Handels desselben Zugs (Befund M17-M3)

**Entscheidung:** `moneyCommittedBy` (`packages/ai/src/espionage.ts`) zieht neben `BUILD` jetzt
`OFFER_TRADE` (`give.resources.money`, sofort in Treuhand) und `ACCEPT_TRADE`
(`want.resources.money` des Angebots aus `view.tradeOffers.incoming`) ab.

**Begründung:** Am gemeinsamen Stand zeigte ein Test: bei 300.000 Geld und einem `OFFER_TRADE`
mit 250.000 Geld Treuhand im selben Strategietakt warb die KI trotzdem einen Gegenspion
(101.530) an — die Rücklage war damit angebrochen. Nicht zu einer gemeinsamen Funktion mit
`ledgerAfter` (`provinceValue.ts`) zusammengezogen: der Diff bleibt klein, und die
Bauauftragsstufe liest `moneyCommittedBy` aus der Kenntnis (`known`), `ledgerAfter` aus
`view.provinces`. `ledgerAfter` braucht keinen Abzug für `RECRUIT_SPY`, weil `espionageCommands`
im Strategietakt als letzte plant.

**Auswirkung:** Beide Fälle (Handel, Provinzangebot) rot vor der Änderung, grün danach;
Golden-Master und Turnier unberührt (mit und ohne Handel zeilengleich, M17-M2). Commit `41a3410`.

**kippbar:** `ledgerAfter` um `RECRUIT_SPY` erweitern, wenn die Reihenfolge im Strategietakt sich
ändert (Spionage nicht mehr zuletzt plant) — bisher folgenlos, aber festgehalten.

---

## 2026-09-25 · Zusammenführung Bahn A und B in M17 · `migrated-save.test.ts` prüft Gültigkeit statt Leere der Spionage

**Entscheidung:** Die Zusicherung „nach 48 Ticks mit KI ist `espionage` leer" stimmte seit
T-M17-12 nicht mehr (die KI wirbt auch im migrierten Stand an) und wurde ohne Textkonflikt rot.
Sie prüft jetzt: der migrierte **Start** hat eine leere Spionage, und jeder Spion im Lauf ist
nach dem Start angeworben, gehört einer lebenden Macht und steht in einer echten Provinz.

**Auswirkung:** Gegenprobe: eine Migration, die einen Spion anlegt, fällt.

---

## 2026-09-25 · Zusammenführung Bahn A und B in M17 · BALANCING.md und der Waechter in test/balancing.test.ts nach der Zusammenführung

**Entscheidung:** Die Abschnitte stehen in der Reihenfolge Bahn A (T-M17-04, -05, -10, -11), dann
Bahn B (T-M17-07 bis -12). Beide Wächter bleiben: der allgemeine aus T-M17-10 (jede oberste Zahl
von `ai.json` mit Zeile und Wert) und der Spionage-Wächter aus T-M17-12, der für die drei
Spionagezahlen zusätzlich einen Status verlangt; sein Kommentar nennt jetzt den allgemeinen.

---

## 2026-09-25 · Noahs Entscheid zu Befund M17-T5 · Die KI erklärt förmlich den Krieg, und das Turnier wird in M17 neu aufgestellt

**Befund (Nacharbeit Turnier, `bericht-turnier-m17.md`, Worktree `m17-t`):** Vor M17 war **jeder**
Krieg der Turnierpaarung „im Frieden" ein Überfall aus Versehen — eine Armee lief auf ein Ziel,
das unterwegs einer anderen Macht zufiel (145 `WAR_DECLARED`, 0 förmlich). Die Wegprüfung der
KI (E4 aus T-M17-10, `military.ts`) hält genau diese Märsche an. Folge: Turnier 100 / **50** / 98 %
(Band R-AI-06 gerissen), und auf der Weltkarte in 200 Tagen **1 Krieg statt 15**, 0 Überfälle statt 13.
Die Spionage ist kein Fehler: ein Gegenspion allein bewegt die Kriegspaarung von 64 auf 98 %, und
das Turnier kennt in 50 Partien nur 5 verschiedene Ausgänge — dieselbe Nation gewinnt alle 50.

**Entscheidung (Noah, 2026-09-25), zwei Teile:**
1. **Option C:** ist das Ziel eines geplanten Angriffs veraltet (es gehört inzwischen einer Macht,
   mit der Frieden herrscht), **erklärt die KI förmlich den Krieg**, statt hineinzustolpern oder den
   Angriff stillschweigend fallen zu lassen. Erweiterung von D29.8 um diesen Satz. Im Wegwerfbau
   gemessen: Weltkarte 10 Kriege, **0 Überfälle** (R-AI-09/AK3 hält), progress.slow grün; offen sind
   7 `DIPLOMACY:INVALID_TARGET`, die vor dem Abschluss verschwinden müssen (R-AI-09/AK2).
2. **Option D, in M17:** das Turnier wird als Teil des Integrationstors T-M17-15 so aufgestellt,
   dass es wieder streut (mehr Mächte, Startplätze, Tage). **Das Band 0,55–0,95 bleibt**; geändert
   wird die Aufstellung, nicht die Grenze.

**Abgelehnt:** B (laufende Märsche ins Zielland dulden — bringt 7 Überfälle und damit B6 zurück)
und A (so lassen — KI-Partien ohne Krieg).

**Folge für die Aufgaben:** T-M17-10 und T-M17-12 bleiben `todo` (reopened), bis C gebaut und das
neu aufgestellte Turnier im Band ist.

---

## 2026-09-25 · Nacharbeit Turnier M17 · Option C: Erklärung im Vorlauf der Taktik, ohne Stärkeprüfung, B4 im Kern

**Entscheidung:** (1) Die förmliche Erklärung am veralteten Ziel entsteht in einem Vorlauf der
Taktikstufe (`staleTargetDeclarations`, vor der Armeeschleife), nicht in der Schleife, und
`requestPassage` prüft gegen frühere Stufen **und** die eigenen Befehle der Taktik. (2) Keine
Stärkeprüfung — die hat der Angriffsbefehl gestellt (`worthAttacking`). (3) Nur im Frieden, nicht
über `maxFronts`, einmal je Macht und Zug; sonst bleibt E4 (anhalten, beantragen). (4) Befund B4
wird im Kern behoben (`dropOffer` statt „alle Angebote an mich"), nicht in der KI umgangen.

**Begründung:** (1) In der Schleife beantragte eine später stehende Armee Durchmarsch bei der
Macht, der eine früher stehende eben erklärt hatte — gemessen 6 `INVALID_TARGET` in 200 Tagen.
(2) Gemessen als Variante mit `standing >= 800`: gleiches Turnier, Weltkarte 7 statt 11 Kriege —
der Angriff fiele dann doch stillschweigend weg, was Noahs Entscheid ausschließt. (3) Den
Waffenstillstand lehnt der Kern mit `ON_COOLDOWN` ab; die Frontenzählung ist dieselbe wie
`diplomacy.ts` Abschnitt 2. (4) Ein Mensch, der zwei Friedensangebote hat, verlor beim ersten
Annehmen das zweite — das ist ein Kernfehler, kein KI-Problem; die KI-Umgehung („höchstens eine
Annahme je Zug") hätte ihn für den Spieler gelassen.

**Kippbar:** (2) durch die Stärkeprüfung aus `diplomacy.ts` Abschnitt 4 (eine Zeile, Zahlen oben).

Umgesetzt (Commits `f69dffb`, `e0712f5`, `21859f8`, `1179075`). Weltkarte 200 Tage: 11 Kriege
(vorher 1), 1 Überfall (Befund M17-T6), 0 `INVALID_TARGET`. Zwei Runden adversarischer Prüfung
(2026-09-25) bestätigten die Reparatur; eine Gegenprobe im Bericht war falsch protokolliert
(G-C4b: tatsächlich 5 Tests rot, nicht 1 — der Code selbst war richtig gebaut), berichtigt in
`bericht-turnier-C.md`. Zwei ergänzende Testfälle (`G-C4f`, `G-C4g`, Commit `345544e`) decken
seither auch die Frontenzählung über mehrere Armeen und die Drittmacht-Sperre ab.

---

## 2026-09-25 · Nacharbeit Turnier M17 · Option D: drei Mächte reihum, Füller „normal", 150 Partien, 40 Tage

**Entscheidung:** Das Turnier spielt auf der Testwelt mit allen drei Mächten, in drei Sitzordnungen
reihum; die zwei Streiter sind p1/p2, der Dritte ist Füller auf „normal" und zählt weder in der
Wertung noch nach Handelndem. 25 Startzahlen je Aufstellung (dieselben je Aufstellung), Stufen je
Paar getauscht, 150 Partien je Paarung, 40 Spieltage. Jedes Turnier wird einmal gerechnet und von
allen Tests geteilt. Neu zugesichert: ≥ 50 verschiedene Ausgänge, keine Nation über 600 ‰ der
Partien, förmliche Erklärung beider Stufen.

**Begründung:** Vorabmessung in `PROBLEME.md` M17-T4 (acht Varianten). Nur der Dritte am Tisch
bringt Streuung; mehr Paare, mehr Tage oder andere Paarungen auf zwei Mächten nicht. Der Füller
„normal" ist die einzige Stufe ohne eigene Schlagseite (leicht → 0,97, schwer → 0,73). Die
Weltkarte wäre für einen Lauf, der jeder KI-/Kernänderung folgt, zu teuer. Die Grenzen 50 und
600 ‰ liegen zwischen altem (5–32 Ausgänge, 980 ‰) und neuem Gerät (110, 447 ‰) und hängen nicht
an der Stärke der Stufen.

**Kippbar:** Füllerstufe (eine Konstante im Test), Zahl der Startzahlen (Laufzeit linear).

Umgesetzt (Commits `36121fb`, `d904c3c`, `97c385c`). Gemessen: schwer–leicht 0,847, schwer–normal
im Frieden **0,760** (Band hält), im Krieg 0,633; 110 verschiedene Ausgänge.

**Berichtigung 2026-09-25 (Nacharbeit-Prüfung, Befund 4/5, „hoch"):** Der Satz „sie ist nicht mehr
empfindlich wie das alte Gerät" gilt nur als **Mittelwertaussage über drei Sitzordnungen** — je
Sitzordnung ist die Streuung so groß wie beim alten Gerät (Spionage aus 0,29–0,90, an 0,60–0,92,
Sprünge bis 0,44 gegen 0,34 vorher). Nur die Mittelung trägt das Band. Ebenso hält die Obergrenze
0,95 vor allem, weil Ostmark in zwei von drei Sitzordnungen schwach ist — „normal" gewinnt in
keinem der vier gemessenen Startzahl-Blöcke (1000/5000/7000/9000) mehr als 1 von 75 Paaren. Beide
Zahlen sind Messwerte für T-M17-15, keine Änderung an Band oder Aufstellung.

---

## 2026-09-25 · Nacharbeit Turnier M17 · T-M17-10 und T-M17-12 auf done, statt an T-M17-15 zu hängen

**Entscheidung:** T-M17-10 und T-M17-12 werden nach Noahs Wortlaut vom 2026-09-25 („danach done")
jetzt auf `status: done` gesetzt und ihr `reopened`-Feld aufgelöst — beide Bedingungen (Option C
gebaut, neu aufgestelltes Turnier im Band) sind erfüllt. Der in `fragmente-turnier-D.md`
vorgeschlagene Weg, `reopened` stattdessen bis zur Abnahme von T-M17-15 stehen zu lassen, wird
**nicht** übernommen.

**Begründung:** T-M17-15 hängt selbst von T-M17-10 und T-M17-12 ab (`tasks.yaml`,
`T-M17-15.deps`) — „reopened bis T-M17-15 abgenommen ist" wäre zirkulär, sobald die Abnahme
`status: done` bei den Abhängigkeiten voraussetzt. Noahs eigener Wortlaut nennt nur die zwei
Bedingungen, die jetzt beide erfüllt sind; das weiterführende Messen (Empfindlichkeit je
Sitzordnung und Startzahl, Obergrenze 0,95, Befund M17-T7) ist eine eigene Zusicherung von
T-M17-15 und keine Vorbedingung für den Abschluss der beiden vorgelagerten Aufgaben.

**Kippbar:** durch einen ausdrücklichen neuen Entscheid Noahs, der die Bedingung nachträglich
verschärft.

---

## 2026-09-25 · T-M17-13 · Umsetzen über einen Umsetz-Modus statt eigener Knöpfe (E1)

**Entscheidung:** Ein App-lokaler Zustand `movingSpy` markiert einen Spion als „wird umgesetzt";
dieselbe Provinzleisten-Gruppe zeigt dann in der Zielprovinz `REASSIGN_SPY`-Knöpfe statt der
Anwerbe-Knöpfe. Escape oder ein Klick beendet den Modus.

**Begründung:** Fünf Spione × drei mögliche Aufträge als Dauerknöpfe an jeder Provinz wären eine
Wand aus Knöpfen. Ein Modus zeigt immer nur die Gruppe der aktuell gewählten Zielprovinz.

**Auswirkung:** Das Umsetzen braucht zwei Klicks (Spion wählen, Ziel wählen) statt eines Knopfs
je Spion und Zielprovinz.

**Kippbar:** ein eigenes Panel für Umsetzen statt des Modus.

---

## 2026-09-25 · T-M17-13 · Nummer statt Kennung (E2, Befund M17-S1)

**Entscheidung:** Jeder eigene Spion erscheint nur als „Spion N" nach seiner Position in
`view.espionage.spies`; Knopf-`id`s sind ebenfalls positionsbasiert, nie die interne Kennung.

**Begründung:** Befund M17-S1 — eine Spionkennung im DOM oder Text wäre ein Informationsleck, das
kein Anforderungstext verlangt.

**Auswirkung:** Nummern rücken nach einem Entlassen nach (Spion 3 kann nach dem Entlassen von
Spion 2 zu Spion 2 werden).

**Kippbar:** eine dauerhafte, aber verschleierte Kennung statt der Position.

---

## 2026-09-25 · T-M17-13 · Meldungen werden aus Ereignissen in der Hülle gesammelt, nicht abgeleitet (E3, Abweichung von D29.9)

**Entscheidung:** `collectEspionageNews` sammelt Spionage-Meldungen selbst aus dem Ereignisstrom
und liefert dieselbe Referenz zurück, wenn sich nichts geändert hat — eine bewusste Abweichung
vom in D29.9 beschriebenen Muster `openIntrusion` (Ableitung aus dem Zustand).

**Begründung:** Der Ereignisring hält nur 500 Einträge für alle Mächte; eine abgeleitete Meldung
verschwände bei hohem Tempo ungesehen, sobald der Ring sie verdrängt hat, bevor der Spieler sie
gesehen hat.

**Auswirkung:** `news` ist App-lokaler Zustand und gilt nur innerhalb einer laufenden Sitzung —
Präzisierung durch die Nacharbeit: eine noch nicht quittierte Sabotage, die aus dem Ring
gefallen ist, geht beim Laden verloren; eine schon weggeklickte, die noch im Ring steht, kann
nach dem Laden erneut erscheinen.

**Kippbar:** mit einem dauerhaften Zustandsfeld im Kern (der Spielstand würde größer).

---

## 2026-09-25 · T-M17-13 · Welche Ereignisse zu Meldungen werden (E4)

**Entscheidung:** `SABOTAGE_SUFFERED` wird laut gemeldet; `SPY_DETECTED` (beide Seiten) und
`SPY_LOST` leise; von `SPY_REPORT` nur `targetChanged`. Täglicher Erfolg oder Misserfolg der
eigenen Spionage wird bewusst **nicht** gemeldet, nur im Protokoll und in der Übersicht geführt.

**Begründung:** Ein täglicher Erfolgs-/Misserfolgs-Lärm wäre keine Meldung wert; Zielwechsel
dagegen betrifft eine Spielerentscheidung (neu zuweisen).

**Auswirkung:** Präzisierung durch die Nacharbeit — R-SPY-06 spricht wörtlich von „Ergebnisse …
erscheinen als Meldung", diese Entscheidung erfüllt das nur eingeschränkt (nicht für tägliche
Erfolge/Misserfolge). Siehe 01-REQUIREMENTS-Vermerk unten.

**Kippbar:** einzelne Ereignisklassen ergänzen oder streichen.

---

## 2026-09-25 · T-M17-13 · Gegenspion-`failure` heißt „keine Enttarnung" (E5)

**Entscheidung:** Die Übersicht zeigt `lastOutcome: 'failure'` bei einem Gegenspion als „keine
Enttarnung", nicht als „misslungen" — übernimmt T-M17-09 E4.

**Begründung:** „Misslungen" würde suggerieren, dass ein fremder Spion da war und nur der Wurf
danebenging; der Kern unterscheidet das bewusst nicht (R-SPY-05/AK2).

**Auswirkung:** Der Spieler kann aus dem Text einer Provinz mit Gegenspion nicht ablesen, ob dort
je ein fremder Spion war.

**Kippbar:** ein eigener dritter Ausgangswert im Kern (`null` bei „niemand da").

---

## 2026-09-25 · T-M17-13 · Sabotage bleibt außerhalb SELF (E6)

**Entscheidung:** `SABOTAGE_SUFFERED` bleibt aus der `SELF`-Kategorie ausgenommen — der
Zinnoberbalken bleibt das alleinige Signal für „euch betreffend", wie DECISIONS T-M17-09 E8.

**Begründung:** Konsistenz mit der bestehenden Entscheidung aus T-M17-09.

**Auswirkung:** keine, reine Fortschreibung einer bestehenden Regel.

**Kippbar:** siehe T-M17-09 E8.

---

## 2026-09-25 · T-M17-13 · Das Symbol `trade` wird hier gezeichnet (E7)

**Entscheidung:** Das Zeichen `trade` (`SPY_MISSION_ICONS`-Nachbarschaft in `icons.tsx`) entsteht
in T-M17-13, obwohl D29.9 nur fünf Symbole für diese Aufgabe nennt — T-M17-14 benutzt es weiter.

**Begründung:** Die Spionage-Symbolik und die Handelssymbolik liegen in derselben Datei; das
Symbol vorzuziehen vermeidet eine doppelte Definition.

**Auswirkung:** T-M17-14 legt `icons.tsx` nicht mehr an (siehe T-M17-14 E11, entfällt).

**Kippbar:** nur wenn T-M17-14 es lieber selbst zeichnet.

---

## 2026-09-25 · T-M17-13 · Knopf „Spionage" im Fuß (E8)

**Entscheidung:** Ein neuer Knopf im Fuß (`Foot.tsx`, `Foot.test.tsx`) öffnet die
Spionageübersicht zusätzlich zur Taste `s`/`S`.

**Begründung:** T-M12-07 — nur eine Tastatur-Erreichbarkeit ist keine vollständige Funktion.

**Auswirkung:** zwei neue Dateien außerhalb der ursprünglichen Aufgabenliste (siehe E13).

**Kippbar:** den Knopf woanders platzieren.

---

## 2026-09-25 · T-M17-13 · `NICHT_FUER_DEN_SPIELER` bekommt die Gegenrichtung (E9, Befund W1)

**Entscheidung:** `NICHT_FUER_DEN_SPIELER` bekommt einen Wächter, der auch veraltete Ausnahmen
prüft (W1, wie `DIPLOMATIE_NOCH_OHNE_KNOPF`); der veraltete Eintrag `SET_CAPITAL` fällt mit weg.

**Begründung:** Eine Ausnahmeliste, die nie schrumpft, verdeckt irgendwann Befehle, die längst
einen Knopf haben.

**Auswirkung:** `SET_CAPITAL` ist ab jetzt kein Sonderfall mehr in der Ausnahmeliste.

**Kippbar:** nicht sinnvoll — W1 ist ein Wächter, kein Verhalten.

---

## 2026-09-25 · T-M17-13 · Rubrik im Protokoll (E10)

**Entscheidung:** `SABOTAGE_SUFFERED`/`SPY_DETECTED` stehen im Protokoll unter „Kämpfe";
`SPY_REPORT`/`SPY_LOST` bleiben unter „Sonstiges".

**Begründung:** Sabotage und Enttarnung sind aus Spielersicht Konfliktereignisse, tägliche
Spionageberichte sind es nicht.

**Auswirkung:** keine eigene Rubrik „Spionage" im Protokoll.

**Kippbar:** eigene Rubrik „Spionage" einführen.

---

## 2026-09-25 · T-M17-13 · `PublicView.espionage` bleibt, wo es ist (E11)

**Entscheidung:** `PublicView.espionage` wird nicht nach `self` gezogen — die in T-M17-07
vermerkte Kippoption bleibt bewusst ungenutzt.

**Begründung:** Ein Umzug nach `self` würde `packages/ai` mitziehen (dort wird `espionage`
ebenfalls gelesen) — außerhalb des Umfangs dieser Aufgabe.

**Auswirkung:** keine, Bestandsstruktur bleibt unverändert.

**Kippbar:** als eigene, größere Aufgabe mit `packages/ai`.

---

## 2026-09-25 · T-M17-13 · Eigene-Provinz-Frage aus dem Zustand ist kein Leck (E12)

**Entscheidung:** `spyActions` liest `state.provinces[id].owner === ctx.playerId` direkt aus dem
Zustand, nicht über eine geschwärzte Sicht.

**Begründung:** Eigene Provinzen sind dem Spieler immer sichtbar — „eigen" ist nie verborgene
Information. Alle anderen Fälle (fremde/herrenlose Provinz) urteilt weiterhin `canApply` über
`knownOwner`.

**Auswirkung:** keine — die Unterscheidung eigen/fremd verrät nichts, was der Spieler nicht
ohnehin sieht.

**Kippbar:** nicht sinnvoll — es gibt hier kein verborgenes Bit.

---

## 2026-09-25 · T-M17-13 · Neue Dateien außerhalb der ursprünglichen Aufgabenliste (E13)

**Entscheidung:** `apps/desktop/src/game/rejections.ts`, `apps/desktop/src/ui/Foot.tsx`,
`apps/desktop/src/ui/Dialogs.tsx`, `apps/desktop/src/ui/app.css` sowie fünf Testdateien wurden
zusätzlich zur ursprünglichen `tasks.yaml`-Dateiliste geändert oder neu angelegt.

**Begründung:** `rejections.ts` bündelt die Sperrgrund-Übersetzung (`SPY_REASON_KEYS`) getrennt
von `actions.ts`; `Foot.tsx` trägt E8; `Dialogs.tsx`/`app.css` wurden für die Umsetz-Quittung und
die neuen Übersichtsklassen (`.spy-list`, `.spy`, `.spy__head`, `.spy__target`) mitgeändert.

**Auswirkung:** `tasks.yaml`/`03-TASKS.md` wurden beim Einpflegen um diese Dateien ergänzt.

**Kippbar:** nicht sinnvoll — reine Buchführung über bereits geänderte Dateien.

---

## 2026-09-25 · T-M17-13 · Umbenennung `espionage.overview.salaryValue` → `salaryAmount` (Sachzwang, nicht kippbar)

**Entscheidung:** Der Textschlüssel `espionage.overview.salaryValue` wurde während des Baus in
`salaryAmount` umbenannt — nicht Teil des Bauplans.

**Begründung:** Der Ersatzschrift-Wächter (`test/guards/text-keys.test.ts`) liest
Zeichenketten-Literale aus `actions.ts` als zusammengesetzte Wörter, nachdem er Punkte entfernt
hat: `'espionage.overview.salaryValue'` wurde zu `espionageoverviewsalaryValue`, darin steckt
`lValue` — ein falscher Alarm auf „ue" (dasselbe Muster wie die bestehende Ausnahme
`provinceValue` in `AUSNAHMEN`).

**Auswirkung:** Statt einer weiteren Ausnahme im Wächter wurde der Schlüssel umbenannt — kein
Verhaltensunterschied für den Spieler.

**Kippbar:** nicht sinnvoll ohne den Wächter zu ändern — Sachzwang.

---

## 2026-09-25 · T-M17-14 · Info-Leck bei `ACCEPT_TRADE` — die Oberfläche verstärkt es nicht (E1)

**Entscheidung:** Scheitert die Annahme eines Handelsangebots an einer Provinz aus
`offer.give.provinces` (eigene Armee samt Weg, fremde Armee, Hauptstadt, umkämpft — geprüft von
`canApply` „full" auf der gebenden Seite), heißt der angezeigte Grund immer einheitlich
`trade.blocked.lapsing`, nie Provinz oder konkrete Ursache.

**Begründung:** Ungefiltert würde der Annehmen-Knopf verraten, *wo* der Anbieter gerade
marschiert — ein Informationsleck über eine fremde Macht. Getestet mit dem Kern selbst als
Kontrolle (Test A7).

**Auswirkung:** Präzisiert in der Nacharbeit (2026-09-25): `settleTradeOffers` läuft in jedem
Tick nach Bewegung, Kampf und Besetzung — ein geladener Stand enthält deshalb praktisch nie ein
Angebot, dessen gebende Seite im selben Tick `full` scheitert; der Knopf-Kanal ist über
`ACCEPT_TRADE` also fast nie erreichbar, die Schwärzung ist Verteidigung in der Tiefe für den
passiven Kanal `TRADE_OFFER_CLOSED{invalid}`. Offen bleibt der Kernweg
(`COMMAND_REJECTED.detail`/`canApply`) für KI/Skript — Kernkandidat M18 (siehe PROBLEME.md).

**Kippbar:** eine Kernänderung, die den Grund selbst schwärzt.

---

## 2026-09-25 · T-M17-14 · „Das Hinterlegte geht zurück" fällt aus dem Protokollsatz (E2)

**Entscheidung:** Der Protokollsatz zu `TRADE_AGREED`/`TRADE_OFFER_CLOSED` behauptet keine
Rückgabe mehr. Die Regel steht jetzt in `explain.trade` und als Notiz `trade.escrow` an der
eigenen ausgehenden Zeile, nur wenn `give.resources` tatsächlich nicht leer ist.

**Begründung:** Das Ereignis trägt keine Mengen (R-DIP-05/AK4) und weiß nicht, ob überhaupt etwas
hinterlegt war — der alte Satz hätte eine Rückgabe behauptet, die nie stattfand.

**Auswirkung:** `explain.trade`/`trade.escrow` zählen die Rückgabefälle ohne den Fall „hinfällig"
(`closeTradeOffer` gibt auch bei `invalid` zurück) — Text-Befund, siehe ANLEITUNG-Berichtigung
unten.

**Kippbar:** eine Kernänderung, die dem Ereignis ein Bit „hatte Treuhand" mitgibt.

---

## 2026-09-25 · T-M17-14 · Nur die Meldungen bekommen ein Sprungziel (E3)

**Entscheidung:** `Alerts`' `onJump` nimmt seit dieser Aufgabe ein `JumpTarget` (Provinz oder
Diplomatie mit gewählter Macht); `Foot`/`EventLog` behalten `onJump(provinceId)` unverändert.

**Begründung:** Korrektur am Planungsstand — nur der Sprungtest in `Alerts.test.tsx` zieht mit,
`Foot.test.tsx` (T-M31) bleibt unverändert; bestätigt durch den vollen Testlauf.

**Auswirkung:** Die Schnittstellenänderung ist auf `Alerts.tsx` begrenzt, nicht global.

**Kippbar:** `Foot`/`EventLog` später auf dasselbe `JumpTarget` heben.

---

## 2026-09-25 · T-M17-14 · Gemeldet werden alle eingehenden Angebote (E4)

**Entscheidung:** Jedes eingehende Angebot — Handel und die drei diplomatischen Antragsarten
(Frieden, Bündnis, Durchmarsch) — löst eine leise Meldung (M36) mit Sprung in die Diplomatie aus,
nicht wegklickbar erzwungen.

**Begründung:** R-DIP-07/AK1 verlangt, dass ein Angebot den Spieler in Worten erreicht, ohne eine
Kennung zu nennen.

**Auswirkung:** keine Filterung nach Angebotsart.

**Kippbar:** ein Filter auf `kind === 'rightOfWay'` oder ähnliches.

---

## 2026-09-25 · T-M17-14 · `TRADE_OFFER_CLOSED`/`TRADE_AGREED` gehören zur Diplomatie (E5)

**Entscheidung:** `TRADE_OFFER_CLOSED`/`TRADE_AGREED` stehen im Protokoll unter „Verträge"
(Diplomatie), `TRADE_EXECUTED` (Markttausch) bleibt bei „Wirtschaft" — eine Zeile vor der
Wirtschaftszeile in `categoryOf`.

**Begründung:** Ein ausgehandeltes Angebot ist ein diplomatischer Akt, der automatische
Marktausgleich ist Wirtschaft.

**Auswirkung:** keine Verhaltensänderung, nur Protokoll-Einordnung.

**Kippbar:** eigene Rubrik „Handel".

---

## 2026-09-25 · T-M17-14 · Zwei Gruppen je Macht: Verträge und Durchmarsch/Karte (E6)

**Entscheidung:** Das Diplomatiepanel teilt die Handlungen je Macht in zwei Gruppen — „Verträge"
(sechs: `declareWar` bis `breakAlliance`) und „Durchmarsch und Karte" (fünf, neu über
`passageActions`: grant/request/accept/revokeRightOfWay, shareMap). `acceptRightOfWay` steht in
der Gruppe **und** als eigener Knopf am eingehenden Antrag, mit verschiedenen Kennungen und
verschiedenen Quittungen (Test A8).

**Begründung:** Fünf zusätzliche Handlungen in einer bestehenden Sechsergruppe wären unübersichtlich.

**Auswirkung:** die Durchmarsch-/Kartenrechte des Kerns (seit T-M17-04 fertig) haben erstmals
einen Knopf.

**Kippbar:** andere Gruppierung, z. B. nach Richtung statt nach Art.

---

## 2026-09-25 · T-M17-14 · Eigene Sperrtexte für Handel (E7)

**Entscheidung:** `describeTradeRejection` übersetzt die Kerngründe eines abgelehnten
Handelsbefehls eigens für Handel, statt die allgemeine `describeRejection` zu benutzen.
`QUEUE_FULL` heißt dort „Sie haben schon 5 offene Angebote" statt „Alle Bauplätze belegt".

**Begründung:** `describeRejection` sagt für `QUEUE_FULL` „Alle Bauplätze" — für Handel schlicht
falsch — und nennt Provinzen nicht beim Namen (Gegenprobe G11 zeigt den Unterschied konkret).

**Auswirkung:** zwei parallele Sperrtext-Übersetzungen im Code (Spionage/`rejections.ts` und
Handel/`describeTradeRejection`), bewusst getrennt.

**Kippbar:** beide Übersetzungen zusammenführen, sobald ihre Texte sich decken.

---

## 2026-09-25 · T-M17-14 · E8 entfällt — keine Arbeit nötig

**Entscheidung:** Keine Änderung an `NICHT_FUER_DEN_SPIELER` bezüglich `SET_CAPITAL` nötig.

**Begründung:** `SET_CAPITAL` stand zu Baubeginn von T-M17-14 bereits **nicht** mehr in
`NICHT_FUER_DEN_SPIELER` — vermutlich bereits von T-M17-13 (E9/W1) bereinigt. Der im Bauplan
angenommene Befund war zum Planungszeitpunkt zutreffend, zum Bauzeitpunkt nicht mehr.

**Auswirkung:** keine.

**Kippbar:** nicht — es gibt nichts umzukehren.

---

## 2026-09-25 · T-M17-14 · Der Partner des Diplomatiepanels steht in `uiState` (E9)

**Entscheidung:** `uiState` führt `diplomacyPartner`/`focusDiplomacy` — das Diplomatiepanel wird
von außen gesteuert, statt seine Auswahl lokal zu halten.

**Begründung:** Nur so öffnet eine Meldung „Diplomatie mit X" auch tatsächlich die richtige Macht.

**Auswirkung:** eine Meldung kann das Panel gezielt auf eine Macht lenken.

**Kippbar:** den Partner stattdessen als Prop durchreichen.

---

## 2026-09-25 · T-M17-14 · Kein fremder Bestand, nirgends (E10)

**Entscheidung:** Das Angebotsformular zeigt ausschließlich den eigenen Bestand, nie den des
Partners.

**Begründung:** Test A9 zeigt identischen Formulartext für einen Partner mit `money: 0` und einen
mit `money: 10^12` — kein Rückschluss auf fremde Wirtschaftsstärke möglich.

**Auswirkung:** der Spieler kann aus dem Formular nichts über den Bestand des Partners ablesen.

**Kippbar:** nicht ohne die verborgene Information selbst preiszugeben.

---

## 2026-09-25 · T-M17-14 · E11 entfällt — Symbol bereits da

**Entscheidung:** Kein eigenes Anlegen des Symbols `trade` in `icons.tsx` nötig.

**Begründung:** T-M17-13 hat `trade` bereits angelegt (`M4 8h14 M15 5l3 3-3 3 M20 16H6 M9 13l-3
3 3 3`), siehe T-M17-13 E7.

**Auswirkung:** `icons.tsx` steht nicht in der Dateiliste von T-M17-14.

**Kippbar:** nicht — nichts gebaut, nichts umzukehren.

---

## 2026-09-25 · T-M17-14 · Ablauftage statt Restzeit (E12)

**Entscheidung:** Fristen erscheinen als „Verfällt an Tag N" über `gameTime(expiresAtTick,
tpd).day` — dieselbe Rechnung wie bei `RIGHT_OF_WAY_CHANGED`.

**Begründung:** Konsistenz mit der bestehenden Durchmarsch-Fristanzeige; ein absoluter Tag ist
robuster gegen Tempowechsel als eine Restzeit-Angabe.

**Auswirkung:** keine, Fortschreibung eines bestehenden Musters.

**Kippbar:** auf Restzeit umstellen.

---

## 2026-09-25 · T-M17-14 · Umbenennung `explain.diplomacy.trade` → `explain.trade` (Sachzwang, nicht kippbar)

**Entscheidung:** Der Erklärungsschlüssel für die Treuhandregel steht unter `explain.trade`,
nicht unter `explain.diplomacy.trade`.

**Begründung:** `icons.test.tsx` zählt `Object.keys(de.explain.diplomacy)` und verlangt genau
sechs Einträge (je ein Beziehungszustand mit `RELATION_ICONS`-Zeichen); ein siebter (`trade`,
kein Beziehungszustand) ließ den Wächter zu Recht fallen.

**Auswirkung:** keine funktionale Änderung, nur der Schlüsselpfad.

**Kippbar:** nicht sinnvoll ohne den Wächter zu ändern — Sachzwang.

---

## 2026-09-25 · T-M17-14 · Umbenennung `trade.value`/`trade.valueProvinces` → `trade.worth`/`trade.worthProvinces` (Sachzwang, nicht kippbar)

**Entscheidung:** Die Vorschau-Schlüssel für den Marktwert im Angebotsformular heißen
`trade.worth`/`trade.worthProvinces`.

**Begründung:** Der Ersatzschrift-Wächter (`text-keys.test.ts`) liest Zeichenketten-Literale aus
`actions.ts` ohne Satzzeichen: `'trade.value'` wurde zu `tradevalue`, darin steckt „lue" nach
einem Konsonanten — dieselbe Fehlalarmklasse wie die bestehende Ausnahme `provinceValue` und wie
T-M17-13s `salaryValue`.

**Auswirkung:** keine funktionale Änderung, nur der Schlüsselpfad.

**Kippbar:** nicht sinnvoll ohne den Wächter zu ändern — Sachzwang.

---

## 2026-09-25 · Nacharbeit T-M17-13/14 · Kappung statt Prüfung vor der Vorschau (kritisch 1, Befund M17-U1)

**Entscheidung:** `safeExchangeAmount()` (`actions.ts`) deckelt `giveAmount` so, dass `giveAmount *
Kurs` unterhalb `Number.MAX_SAFE_INTEGER` bleibt, bevor `exchangeAmount()` (Kern) für die Vorschau
rechnet. Der an `canApply` gehende Befehl selbst bleibt ungekürzt.

**Begründung:** `exchangeAmount()` warf `FixedOverflowError` schon bei 3,5 Mrd. Einheiten Seltene
Erden im bloßen Formularentwurf, unabhängig davon, ob `canApply` den Befehl je gesehen hat — die
Vorschau (`TradeOfferForm`, `MarketPanel`) lief jedem Rendern voraus und stürzte ab. Eine Vorschau
braucht den wahren Wert eines unsinnig großen Entwurfs nicht, nur die echte Prüfung muss ihn
ablehnen; eine Grenze wird dabei nicht angehoben, nur eine bestehende technische Grenze
durchgesetzt, bevor sie überfährt.

**Auswirkung:** Test A10 hält die Reparatur fest. Kernkandidat offen (nicht Teil dieser
Nacharbeit): `exchangeAmount()` selbst kappt nicht, jeder künftige Aufrufer außerhalb von
`actions.ts` kann denselben Absturz erzeugen — siehe PROBLEME.md M17-U1.

**Kippbar:** eine Kernänderung, die `exchangeAmount` selbst kappen oder sättigen lässt.

---

## 2026-09-25 · Nacharbeit T-M17-13/14 · Positionsbasierte Handelskennungen (kritisch 2)

**Entscheidung:** Handelsknöpfe tragen positionsbasierte Kennungen
(`trade-in-${index}-accept/-decline`, `trade-out-${index}-withdraw`, `offer-in-${index}-accept`)
statt des globalen Angebotszählers `offer.id` oder einer Spielerkennung.

**Begründung:** Dieselbe wie T-M17-13 E2 (Befund M17-S1) — der Angebotszähler ist ein globaler
Zähler über alle Mächte, eine Spielerkennung im DOM (`id`/`aria-describedby` über `ActionRow`)
verrät die eigene Rolle bzw. Reihenfolge im Spiel.

**Auswirkung:** neuer Test in `actions.test.ts`.

**Kippbar:** eine andere stabile, aber verschleierte Kennung.

---

## 2026-09-25 · Nacharbeit T-M17-13/14 · Ziel in der Knopf-Kennung statt nur in der Aktionsart (mittel)

**Entscheidung:** Die Quittung „befohlen" (`pendingIds`, `App.tsx`, T-M22-05) hing an der reinen
Knopf-Kennung, nicht am Ziel. Vier Kennungsschemata wurden um ihr Ziel ergänzt:
`trade-offer-${partner}`, `diplomacy-${action}-${target}`, `spy-recruit-${provinceId}-${mission}`,
`spy-move-${provinceId}-${mission}`.

**Begründung:** `pendingIds` vergleicht nur Zeichenketten, nie den Befehl selbst — bei stehender
Uhr sperrte ein Angebot an eine Macht das gleiche Formular auch für jede andere Macht oder
Provinz, obwohl dort kein Befehl anstand.

**Auswirkung:** neuer App-Test (Krieg an p2 sperrt p3 nicht).

**Kippbar:** `pendingCommands` selbst nach Zielspieler/-provinz filtern lassen, statt das Ziel in
die Kennung zu kodieren.

---

## 2026-09-25 · Nacharbeit T-M17-13/14 · `trade.unknownProvince` als Rückfall statt der rohen Kennung (mittel)

**Entscheidung:** Neuer Schlüssel `trade.unknownProvince` in `de.ts`; `nameOfOwn`/`nameOfPartner`
(`Panels.tsx`, `TradeOfferForm`) fallen darauf zurück statt auf `?? id`.

**Begründung:** Eine gewählte Provinz im Angebotsformular, die während der Wahl den Besitzer
wechselt, zeigte zuvor ihre rohe Kennung im Text — derselbe Grundsatz wie beim bestehenden
`trade.unknownPower`: nie eine rohe Kennung im sichtbaren Text.

**Auswirkung:** neuer Panels-Test.

**Kippbar:** die Provinz stattdessen aus einer vollständigen (nicht auf den aktuellen Besitz
gefilterten) Namensliste auflösen, sobald `TradeFormSpec` das hergibt.

---

## 2026-09-25 · Nacharbeit T-M17-13/14 · `spy-caught` mit Urheber in der Kennung (niedrig)

**Entscheidung:** Die interne Kennung für Enttarnungs-Meldungen lautet
`spy-caught:${provinceId}:${playerId}` statt nur `${provinceId}`.

**Begründung:** R-SPY-05/AK1 verlangt beide Nennungen bei zwei Enttarnungen derselben Provinz im
selben Tick durch zwei verschiedene Mächte; die Spielerkennung erscheint dabei nur als React-`key`,
nie im DOM (dieselbe Regel wie überall sonst in dieser Aufgabe).

**Auswirkung:** ein zweiter `spy-caught`-Fund in derselben Provinz überschreibt den ersten nicht
mehr in der internen `Map`.

**Kippbar:** stattdessen eine Liste statt eines `Map`-Werts je Provinz führen.
