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

## Meilenstein M4 — Armeen, Bewegung, Kampf ✅

*Nachgetragen am 2026-09-03 aus `tasks.yaml` und der Commit-Historie — die Einträge
M4 bis M8 fehlten, obwohl die Aufgaben erledigt waren.*

| Aufgabe | Datum | Ergebnis | verify |
|---|---|---|---|
| T-M4-01 | 2026-09-03 | Armeen bilden, teilen, zusammenlegen — Trefferpunkte bleiben dabei exakt erhalten | grün |
| T-M4-02 | 2026-09-03 | Bewegung: angezeigte Ankunft = tatsächliche Ankunft, kein Durchmarsch durch besetzte Provinzen, Bahn- und Geländefaktoren belegt | grün |
| T-M4-03 | 2026-09-03 | Kampfauflösung mit Stapel-Deckel, Mindestschaden gegen Endlosschlachten, symmetrisch bei Seitentausch, Dreiparteienkampf löst sich auf | grün |
| T-M4-04 | 2026-09-03 | Bombardement ohne Gegenschaden; Rückzug mit Verlust, doppelter Aufmarschverzögerung und Sperrfrist | grün |
| T-M4-05 | 2026-09-03 | Auffrischung nur im eigenen Gebiet und nicht im Kampf; bei Materialmangel halbiert | grün |
| T-M4-05b | 2026-09-03 | Seetransport: Kapazität, belegte Ein- und Ausschiffungszeiten, Verwundbarkeit auf See, Landungsmalus | grün |
| T-M4-05c | 2026-09-03 | Luftstreitkräfte als Fernwaffe — Wirkung nur im Umkreis des Flugplatzes, keine Eroberung, Bodenzeit nach Einsatz | grün |
| T-M4-06 | 2026-09-03 | **Durchstich:** kopflose Minimalpartie über 500 Ticks mit Bauen, Rekrutieren, Marschieren, Kampf, Eroberung; Endzustand als Golden-Master | grün |

## Meilenstein M5 — Moral, Eroberung, Sieg ✅

| Aufgabe | Datum | Ergebnis | verify |
|---|---|---|---|
| T-M5-01 | 2026-09-03 | Moral als Ziel-/Istwert mit Drift von einem Siebtel je Tag (nicht je Tick); jeder Term einzeln geprüft | grün |
| T-M5-02 | 2026-09-03 | Eigentümerwechsel nur ohne Verteidiger; Aufstandsrisiko (33 − Moral) × 3 % je Tag; Garnison unterdrückt | grün |
| T-M5-03 | 2026-09-03 | Hauptstadt, Punkte, Sieg und Ausscheiden — Prüfung nur im Tageswechsel; Hauptstadtverlegung mit Kosten und Sperrfrist | grün |
| T-M5-04 | 2026-09-03 | Ereignisprotokoll als Ringpuffer, Filter nach Art und Spieler, Verdichtung zu Tagesbündeln bei hohem Tempo | grün |
| T-M5-05 | 2026-09-03 | Hot-Seat mit zwei menschlichen Spielern — ohne Sonderpfad im Kern, Hash reproduzierbar | grün |
| T-M5-06 | 2026-09-03 | Kennzahlenbericht über 200 Spieltage; der Test schlägt fehl, sobald eine Ressource unbegrenzt wächst | grün |

## Meilenstein M6 — Diplomatie und Nebel des Krieges ✅

| Aufgabe | Datum | Ergebnis | verify |
|---|---|---|---|
| T-M6-01 | 2026-09-03 | Diplomatische Zustände: Kriegserklärung erst nach Vorlaufzeit, Ansehensverlust beim Überfall, Waffenstillstand läuft ab | grün |
| T-M6-02 | 2026-09-03 | Öffentliche Sicht — keine unerlaubten Felder, Rückgabetyp ist nicht `GameState` | grün |
| T-M6-03 | 2026-09-03 | Aufklärungswissen: letzter bekannter Stand mit Zeitstempel, überlebt Speichern und Laden | grün |

## Meilenstein M7 — Der Computergegner ✅

| Aufgabe | Datum | Ergebnis | verify |
|---|---|---|---|
| T-M7-00 | 2026-09-03 | KI-Gedächtnis liegt im Spielzustand — nach Speichern und Laden identische Entscheidungen über 50 Ticks | grün |
| T-M7-01 | 2026-09-03 | KI-Grundgerüst und Erklärbarkeit: jeder KI-Befehl besteht `canApply`, die Ausgabe nennt Ziel, Nutzen und Alternative | grün |
| T-M7-02 | 2026-09-03 | Wirtschafts- und Bau-KI — reagiert auf Mangel, verschuldet sich nie, priorisiert Nahrung | grün |
| T-M7-02b | 2026-09-03 | Bedrohungskarte und Kräftevergleich; jeder Nutzenterm liefert 0…1000 | grün |
| T-M7-03 | 2026-09-03 | Militär-KI: verteidigt bei Bedrohung, wählt schwache wertvolle Ziele, bricht aussichtslose Angriffe ab | grün |
| T-M7-04 | 2026-09-03 | Diplomatie-KI — nimmt vorteilhaften Frieden an, kein Zweifrontenkrieg auf Stufe leicht | grün |
| T-M7-05 | 2026-09-03 | Schwierigkeitsgrade und Rechenbudget: KI ≤ 30 % der Tickzeit; Turnier über 50 Partien, schwer schlägt leicht in ≥ 70 % | grün |

## Meilenstein M8 — Speichern, Wiederholung, Dauerlauf ✅

| Aufgabe | Datum | Ergebnis | verify |
|---|---|---|---|
| T-M8-00 | 2026-09-03 | Speicher-Schnittstelle für Tauri, Node und Arbeitsspeicher — dieselbe Vertragstestreihe gegen alle drei | grün |
| T-M8-01 | 2026-09-03 | Speichern und Laden mit Hash-Gleichheit; unbekannte Version wird abgelehnt; Kommandolog in eigener `.replay`-Datei | grün |
| T-M8-02 | 2026-09-03 | Kopfloser Läufer ausgebaut: Wiederholung aus Seed und Kommandolog reproduziert den Endzustand | grün |
| T-M8-03 | 2026-09-03 | Langlauf und Rechenbudget: Tick-Median < 0,5 ms, p99 < 2 ms, 1000 Spieltage ohne Fehler | grün |

## Meilenstein M10 — Oberfläche (läuft)

| Aufgabe | Datum | Ergebnis | verify |
|---|---|---|---|
| T-M10-02 | 2026-09-03 | Simulations-Host im Worker: Tempo-Rastpunkte bis 100, Rückstand auf 2 Ticks gedeckelt, Vorspulen in Häppchen mit wirksamem Abbruch, nur die Spielersicht verlässt den Worker | grün |

**Stand 2026-09-03:** M0 bis M8 abgeschlossen, M10 begonnen (53 von 83 Aufgaben).
525 Tests grün, Kern-Abdeckung 95,9 %, `pnpm verify` vollständig grün.
Anforderungs-Tor: 57 von 74 Anforderungen durch Tests belegt.

**Bemerkenswert in M10:**
- `pnpm verify` war auf `main` rot: ein Typfehler aus M8 (`migrate.ts` setzte `hash` auf
  `undefined`, was `exactOptionalPropertyTypes` verbietet) hinter einer `as`-Zusicherung.
  Der Commit „lint cleanup after M8" hat offenbar nur den Linter laufen lassen. Behoben,
  und die Migrationskette ist jetzt getestet — vorher war sie es nicht, weil die
  Migrationstabelle leer ist und die Schleife nie lief.
- Der Abbruchknopf des Vorspulens wäre eine Attrappe geworden: JavaScript ist einfädig,
  und ein Vorspulen in einem Zug erreicht die Abbruchnachricht nie. Deshalb läuft es
  jetzt in Häppchen über die Ereignisschleife (`DECISIONS.md`, 2026-09-03).
- Der erste Datenschutztest war grün aus dem falschen Grund und dann rot aus dem
  falschen Grund: beide Nationen starten gleich, also hat eine fremde Provinz denselben
  Moral*wert* wie eine eigene. Der Test prüft jetzt die Struktur, nicht die Zahl.

**T-M10-01 vorgelegt (2026-09-03):** Drei Design-Richtungen als Mockup unter
`docs/design/ui-mockup.html`, Tokens und Kontrastwerte in `docs/design/tokens.md`.
Artifact: https://claude.ai/code/artifact/14e02471-d4ab-4267-833d-b6d98f8616e7 —
wartet auf Noahs Freigabe. Bis dahin bleiben T-M10-01b bis T-M11-04 gesperrt.
