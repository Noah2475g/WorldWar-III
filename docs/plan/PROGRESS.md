# PROGRESS

Eine Zeile je abgeschlossener Aufgabe: `T-ID · Datum · Kurzbeschreibung · Tests · verify`

## Meilenstein M0 — Fundament ✅

| Aufgabe | Datum | Ergebnis | verify |
|---|---|---|---|
| T-M0-01 | 2026-09-02 | Monorepo mit pnpm, TypeScript (strict), Vitest, ESLint 9 — fünf Pakete plus Headless-App | grün |
| T-M0-02 | 2026-09-02 | Skriptfläche nach D15; `verify.mjs` überspringt Abdeckungsschwellen für leere Pakete (behebt den Bootstrap-Blocker) | grün |
| T-M0-03 | 2026-09-02 | Sieben Guards mit dauerhaften Verstoß-Fixtures; vier prüfen die echte ESLint-Konfiguration | grün |
| T-M0-04 | 2026-09-02 | Anforderungs-Abgleich als reine Funktion; liest den `scope`-Block, verlangt echte Zusicherungen | grün |
| T-M0-05 | 2026-09-02 | Plan-Konsistenztest — fand acht Abweichungen zwischen `03-TASKS.md` und `tasks.yaml` | grün |

## Meilenstein M1 — Simulationskern ✅

| Aufgabe | Datum | Ergebnis | verify |
|---|---|---|---|
| T-M1-01 | 2026-09-02 | Festkomma-Arithmetik, Rundung halb vom Nullpunkt weg, Überlauf wirft, negative Null normalisiert | grün |
| T-M1-02 | 2026-09-02 | xoshiro128\*\*-Zufallsgenerator als reine Daten; Golden-Vektor für Seed 42 eingefroren | grün |
| T-M1-03 | 2026-09-02 | Zustands-Hash über kanonische Projektion; Ereignisprotokoll ausgeschlossen | grün |
| T-M1-04 | 2026-09-02 | Vollständiges Zustandsmodell inkl. Trefferpunkte-Pool, KI-Gedächtnis, Aufklärung, Produktionsreste | grün |
| T-M1-05 | 2026-09-02 | Tick-Pipeline mit 12 Phasen + Tagesabrechnung nach der Buchhaltung | grün |
| T-M1-06 | 2026-09-02 | Determinismus über 500 Ticks; Golden-Master erzeugt und gegengeprüft | grün |
| T-M1-07 | 2026-09-02 | Kommando-Registry: `check` und `apply` teilen eine Regel; unbekannte Kommandos werden abgelehnt | grün |
| T-M1-08 | 2026-09-02 | 25 Ereignisarten, Vollständigkeit zur Übersetzungszeit geprüft; Alarme steuern das Vorspulen | grün |
| T-M1-09 | 2026-09-02 | Kern-Uhr: `runTicks`, `fastForward` mit sechs Zielarten, Alarm-Unterbrechung, harte Obergrenze | grün |

## Meilenstein M2 — Karte, Graph, Wege ✅

| Aufgabe | Datum | Ergebnis | verify |
|---|---|---|---|
| T-M2-01 | 2026-09-02 | Kartenvalidator mit zehn Fehlerklassen inkl. `EDGE_ASYMMETRY`; Erreichbarkeit über Land **und** See | grün |
| T-M2-02 | 2026-09-02 | Testkarte „Kleine Welt": 12 Provinzen, 3 Nationen, alle Geländetypen, zwei Inseln, Fluss und Meerenge | grün |
| T-M2-03 | 2026-09-02 | Wegfindung mit deterministischem Gleichstand; Kostenfunktion kommt vom Aufrufer | grün |
| T-M2-04 | 2026-09-02 | Szenario-Lader: Spielsituationen als YAML statt als Testcode | grün |

## Meilenstein M3 — Wirtschaft, Bau, Rekrutierung ✅

| Aufgabe | Datum | Ergebnis | verify |
|---|---|---|---|
| T-M3-01 | 2026-09-02 | Regelwerk als Datendateien: 7 Ressourcen, 7 Gebäude, 10 Einheiten, KI-Gewichte — mit strenger Prüfung beim Laden | grün |
| T-M3-02 | 2026-09-02 | Produktion mit belegter Moralformel (0,20 + 0,80 × Moral) und verlustfreiem Restwertübertrag | grün |
| T-M3-03 | 2026-09-03 | Unterhalt, Mangelzustände statt negativer Bestände, Lagergrenzen mit Tagesmeldung | grün |
| T-M3-04 | 2026-09-03 | Bauaufträge mit Sofortzahlung, Bauplatzgrenze, Abbruch mit halber Erstattung, Verfall bei Eigentümerwechsel | grün |
| T-M3-05 | 2026-09-03 | Rekrutierung mit Gebäudevoraussetzung; frische Einheiten starten mit moralabhängiger Stärke | grün |
| T-M3-06 | 2026-09-03 | Markt mit tickfestem Preis für alle Spieler, Preisbewegung durch Nachfrage, tägliche Rückkehr zum Grundwert | grün |

**Stand 2026-09-03:** M0 bis M3 abgeschlossen (24 von 83 Aufgaben).
329 Tests grün, Kern-Abdeckung 93,8 %, `pnpm verify` vollständig grün.
Anforderungs-Tor: 31 von 74 Anforderungen durch Tests belegt.

**Bemerkenswert in M3:**
- Der Fairness-Test des Marktes deckte auf, dass ein tickweise wanderender Preis den
  ersten Spieler in der Zugreihenfolge strukturell bevorzugt hätte — genau der Vorteil,
  den das Original für Geld verkauft. Der Preis ist jetzt für den ganzen Tick fixiert.
- Die belegte Moralwirkung auf frische Rekruten trifft im Trefferpunkte-Pool-Modell eine
  Designentscheidung, die schriftlich festgehalten ist (`DECISIONS.md`, 2026-09-03).
- Mehrere Tests waren zunächst falsch, weil sie die Produktion desselben Ticks
  mitgerechnet haben. Sie vergleichen jetzt gegen einen Leerlauf-Tick.

**Bemerkenswert unterwegs:**
- Der Festkomma-Linter hat dreimal angeschlagen — jedes Mal bei echter Ganzzahl-Rechnung,
  die nun eine begründete Ausnahme trägt. Kein Fehlalarm, aber auch kein Selbstläufer.
- Der Golden-Master wurde einmal absichtlich neu erzeugt (neues Spielerfeld) und einmal
  zur Probe gebrochen — er schlägt bei einer Ein-Punkt-Änderung an.
- Ein echter Fehler, den kein Test fand: `requirements-coverage.mjs` tat gar nichts, weil
  sein Einstiegspunkt-Vergleich unter Windows nie zutraf. Jetzt per Kindprozess getestet.
