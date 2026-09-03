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
