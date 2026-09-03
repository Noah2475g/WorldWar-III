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
