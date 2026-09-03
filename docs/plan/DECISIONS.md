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
