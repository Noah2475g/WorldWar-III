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

## Meilenstein M9 — Weltkarte (läuft)

| Aufgabe | Datum | Ergebnis | verify |
|---|---|---|---|
| T-M10-01 | 2026-09-03 | **Freigabe erteilt:** Richtung A „Lagekarte" — drei Richtungen vorgelegt, Noah hat gewählt | — |
| T-M9-01 | 2026-09-03 | Geodaten von Natural Earth (1:50 Mio, gemeinfrei) geladen; umkehrbare Projektion, geodätische Entfernung getrennt von der Bilddarstellung, Vereinfachung auf Winkelgraden; Herkunft und Lizenz in `docs/ASSETS.md`, gegen das Quellenregister im Code geprüft | grün |
| T-M10-01b | 2026-09-03 | Freigegebene Optik als `tokens.ts` mit Kontrasttest (12 benannte Paare plus vollständige Kreuzprüfung Text × Grund); Lint-Regel verbietet Farbliterale außerhalb der Tokendatei, mit Verstoß-Fixture | grün |
| T-M9-00 | 2026-09-03 | Zuschnitt der Weltkarte auf Grundlage der 1:10-Mio-Daten: **237 Provinzen** aus 258 Staaten und 4596 Verwaltungseinheiten, 93 Gebiete mit Begründung ausgeschlossen, keine Einheit unverbucht; 91 kuratierte Seewege; **24 Startnationen, jede ein eigener Staat** mit mindestens drei Provinzen | grün |
| T-M9-02a | 2026-09-03 | Provinzgeometrien über eine gemeinsame Topologie verschmolzen (1279 Teile → 237 Provinzen), danach vereinfacht: 602 842 Stützpunkte auf 62 195 (−90 %). Gesamtfläche 133,9 Mio km² gegen erwartete 135 Mio ohne Antarktis. Sichtprüfung der gezeichneten Karte bestanden | grün |
| T-M9-02b | 2026-09-03 | Nachbarschaft aus geteilten Bögen: 445 Landgrenzen, symmetrisch, mit geodätischer Entfernung; Lesotho als einzige Enklave erkannt, 21 Inseln ohne Landnachbarn. Vereinfachung auf topologie-erhaltend umgestellt — die vorherige Ring-für-Ring-Variante hatte Nachbargrenzen auseinandergezogen | grün |
| T-M9-02c | 2026-09-03 | Seewege und `world.json`: 184 Küstenprovinzen bestimmt (nachdem 21 Landlöcher geschlossen wurden), 210 Seewege — 91 kuratiert für die Engstellen, 119 abgeleitet, keine über Land, keine Küstenprovinz ohne Anbindung. Datumsgrenze in Punkt-in-Fläche und Interpolation behandelt. **Die Weltkarte besteht den Kartenvalidator des Kerns fehlerfrei** | grün |
| T-M9-03 | 2026-09-03 | Anreicherung: Gelände aus der Lage, Bevölkerung aus Landeszahlen mit Dichtefaktoren, Vorkommen deterministisch aus der Provinzkennung. **Startwerte aller 24 Nationen innerhalb 14 % vom Median** (Grenze 15 %). Kartenbericht in `docs/reports/map.md` | grün |
| T-M9-04 | 2026-09-03 | Kernregeln auf der echten Weltkarte: **Tick-Median 2,76 ms, p99 5,1 ms** bei 237 Provinzen, 658 Kanten und 12 KI-Spielern (Budget 8 / 40 ms); 1000 Spieltage fehlerfrei, Ereignisprotokoll bleibt beschränkt. Messwerte in `docs/reports/worldmap-bench.json` | grün |

**Stand 2026-09-03:** M0 bis M9 abgeschlossen (62 von 83 Aufgaben), M10 begonnen.
691 Tests grün (plus 3 im Langlauf), Kern-Abdeckung 95,9 %, `pnpm verify` vollständig grün.
Die Weltkarte ist fertig: 237 Provinzen, 448 Landgrenzen, 210 Seewege, 24 spielbare
Nationen, Startwerte innerhalb 14 % vom Median.

## Meilenstein M10 — Oberfläche ✅

| Aufgabe | Datum | Ergebnis | verify |
|---|---|---|---|
| T-M10-03a | 2026-09-03 | Kartenansicht: Trefferprüfung rein geometrisch (und damit prüfbar), Ausschnitt bleibt auf der Karte, Zoom auf den Zeiger, Ebenenreihenfolge nach D11 als Daten statt als Aufrufreihenfolge | grün |
| T-M10-03b | 2026-09-03 | Vier Kartenmodi; Unbekanntes wird als unbekannt gefärbt statt als Null. Bildratenbudget auf der echten Weltkarte gehalten — Zeitmessung in der langsamen Suite, weil sie neben 30 Testdateien die Maschinenlast misst | grün |
| T-M10-04 | 2026-09-03 | Kopfleiste mit Rohstoffen, Bilanz, Uhr, Tempo-Rastpunkten, Vorspulen und Kartenmodus; alle Zahlen über eine einzige Festkomma-Umrechnung | grün |
| T-M10-05 | 2026-09-03 | Provinz- und Armeepanel; nicht ausführbare Aktionen ausgegraut **mit Grund**, Tooltip nennt Kosten und Dauer, Ankunft als Zeitpunkt statt als Countdown | grün |
| T-M10-06 | 2026-09-03 | Ereignisleiste: jede der 25 Ereignisarten als deutscher Satz mit Namen statt Kennungen; Klick springt zur Provinz | grün |
| T-M10-07a | 2026-09-03 | Partie erstellen — alle Angaben landen im Anfangszustand, gleicher Seed erzeugt einen bitgleichen Zustand, KI-Bonus offen ausgewiesen (0 %) | grün |
| T-M10-07b | 2026-09-03 | Speichern, Laden, Autospeichern; beschädigter oder fremder Stand wird **in Worten** abgelehnt | grün |
| T-M10-08 | 2026-09-03 | Für jeden der 16 Kommandofehler ein deutscher Satz, der sagt, was fehlt — „Es fehlen 400 Eisen", nicht „nicht genug Rohstoffe" | grün |
| T-M10-09 | 2026-09-03 | Einstellungen für Autospeichern, Ton, Tempogrenze, Schriftgröße und Debug; unsinnige Werte fallen auf die Vorgabe zurück, statt den Start zu verhindern | grün |
| T-M10-10 | 2026-09-03 | Debug-Ansicht mit Tick, Hash, KI-Zielen und Kommandolog; im Normalbetrieb unsichtbar | grün |
| T-M10-11 | 2026-09-03 | Kartenauswahl im Startdialog, mit Provinzzahl je Karte | grün |
| T-M10-12 | 2026-09-03 | Bedienung ohne Maus: jede Aktion über Tastatur, Fokusring sichtbar, Schriftgröße einstellbar, Dialoge fangen den Fokus und geben ihn zurück | grün |
| T-M11-04 | 2026-09-03 | Lokalisierung: ein Katalog, keine Anzeigetexte im Code; ein Test verlangt einen Satz für jeden Fehlercode, jede Ereignisart und jede Ressource | grün |

## Meilenstein M11 — Politur und Verpackung

| Aufgabe | Datum | Ergebnis | verify |
|---|---|---|---|
| T-M11-01 | 2026-09-03 | 13 Icons als eingebettetes SVG in der Formensprache militärischer Lagekarten; nehmen die Textfarbe an, skalieren mit der Schriftgröße, für Vorleseprogramme unsichtbar solange sie Zierde sind | grün |
| T-M11-02 | 2026-09-03 | Erzeugte Klänge statt Aufnahmen (nichts geladen, nichts lizenziert); Ton abschaltbar, und oberhalb von 10 Spielstunden/s schweigen Töne und Animationen — sonst wären die Meldungen eine Störsirene | grün |
| T-M11-03 | 2026-09-03 | Tauri-Verpackung für Windows, Linux und macOS. **Kein Netzzugriff möglich:** keine http-, shell- oder updater-Berechtigung, `connect-src 'none'` in der Inhaltsrichtlinie — ein Guard prüft beides | grün |
| T-M11-04 | 2026-09-03 | (siehe M10) | grün |

## Meilenstein M12 — Balancing, Anleitung, Abnahme

| Aufgabe | Datum | Ergebnis | verify |
|---|---|---|---|
| T-M12-00 | 2026-09-03 | Parameterlauf: jede beobachtete Konstante um ±25 % bewegt und ausgespielt. **4 von 14 Konstanten sind tragend, alle vier drehen sich um Moral und Ausdehnung**; `battleRate`, `minDamage` und `defenceCap` verschieben den Ausgang um 0,0 %. Der erste Lauf meldete, dass keine Zahl etwas ausmacht — zwischen den USA und Russland passiert in vierzig Tagen nichts. Ein Durchgang zählt jetzt Eroberungen und weigert sich, einen Befund zu melden, wenn keine stattfand | grün |
| T-M12-01 | 2026-09-03 | Alle 60 Konstanten in `BALANCING.md` mit Status, Herkunft und gemessenem Ausschlag; ein Test lässt jede neue Zahl ohne Eintrag durchfallen | grün |
| T-M12-02 | 2026-09-03 | Spielanleitung und Playtest-Vorlage; jede Frage trägt die Anforderungs-ID, die sie prüft | grün |
| T-M12-02b | 2026-09-03 | Einstiegshilfe für die erste Partie: fünf Schritte, die keine Eingabe blockieren, nur beim ersten Mal erscheinen und abschaltbar bleiben | grün |
| T-M12-03 | 2026-09-03 | **Abnahmelauf: 6 von 6 maschinellen Kriterien grün** (`pnpm acceptance`, `docs/reports/acceptance.md`). Offen bleibt AK-7, der Playtest durch Noah | grün |

### Was der Abnahmelauf ans Licht gebracht hat

Drei Befunde, die ohne den Lauf niemand gesehen hätte:

1. **Sechs Anforderungen waren nie geprüft** — und zwei davon nicht, weil ein Test
   fehlte, sondern weil die Sache fehlte. `balance={{}}` stand in der Kopfleiste: die
   Wirtschaftsbilanz war eine leere Eigenschaft. Gebäude wurden auf der Karte nie
   gezeichnet. Beides ist jetzt gebaut, mit Test.
2. **Das Prüfskript sah `*.test.tsx` nicht an** — also genau die Dateien, in denen die
   Oberflächen-Anforderungen belegt werden.
3. **Die langsame Suite scheiterte an sich selbst.** Ein Test, der 467 Sekunden am Stück
   rechnet, beantwortet dem Testläufer nichts mehr; der hält den Arbeitsprozess für
   hängengeblieben und lässt den Lauf scheitern, obwohl jede Zusicherung darin
   durchgeht. Die Langläufe geben die Ereignisschleife jetzt regelmäßig frei. Dazu läuft
   die Suite seriell: ein Bildratenbudget neben einer vierminütigen Simulation misst die
   Maschinenlast, nicht den Code — genau daran war das Tickbudget mit 8,3 ms gegen 8 ms
   gescheitert und lief allein mit 2,2 ms durch.

**Stand 2026-09-03:** M0 bis M12 abgeschlossen (**82 von 83 Aufgaben**). 900 Tests grün
plus die langsame Suite, Kern-Abdeckung 95,9 %, Gesamtabdeckung 90,9 %, **alle 74
V1-Anforderungen durch einen Test belegt**. Offen ist allein T-M12-03 als Tor: der
Playtest durch Noah nach `docs/PLAYTEST.md` — ob das Spiel Spaß macht, findet kein
Skript heraus.

## Vor T-M12-03 — Rauchtest der Oberfläche (2026-09-03, Abend)

Bevor Noah die 45 Minuten investiert, einmal selbst durch die Playtest-Liste, soweit
eine Maschine das kann (Startdialog, Karte, Modi, Vorspulen, Speichern, Tastatur).
Sieben Befunde, sechs behoben — Einzelheiten in `PROBLEME.md`:

| Befund | Anforderung | Status |
|---|---|---|
| KI-Befehle wurden je Tick eines Vorspulens wiederholt angewandt: 1 × „Bau begonnen", 23 × „Befehl abgelehnt" | R-AI-01 | behoben (`advance.ts`, dieselbe Schleife wie der kopflose Läufer) |
| Protokoll zeigte Bauten und Ablehnungen fremder Mächte | R-DIP-04 | behoben (`eventsFor`) |
| Rohtexte im Protokoll: `{{reason}}`, `barracks`, `p2`, Marsch „nach" dem Startort, Handel und Kriegserklärung mit falschen Platzhaltern | R-UI-07 | behoben, Katalog um Gebäude, Einheiten und Ablehnungsgründe ergänzt, Vollständigkeit getestet |
| Wirtschaftsübersicht: zwei von fünf Spalten hinter einem Rollbalken | R-ECON-06 | behoben (Seitenleiste 380px) |
| „1 Tage" im Kosten-Tooltip | R-UI-05 | behoben |
| Escape im Startdialog ließ einen leeren Bildschirm ohne Rückweg | R-UI-03 | behoben |
| **Die Weltkarte ist wirtschaftlich vom Regelwerk abgekoppelt** — Vorkommen und Bevölkerung um Faktor 600–1000 über der Skala, auf der die Regeln abgestimmt wurden; eine Kaserne kostet vier Spielminuten Einkommen, Italien hat kein Material | R-ECON-01, R-MAP-04 | **offen — Entscheidung Noah**, blockiert die Aussagekraft des Playtests |

**Stand 2026-09-03 (Abend):** 82 von 83 Aufgaben. 915 Tests grün, Kern-Abdeckung
95,9 %, Gesamtabdeckung 90,9 %, `pnpm verify` vollständig grün. Der Playtest sollte
erst nach der Entscheidung zur Wirtschaftsskala stattfinden — vorher misst er die
Wirtschaft nicht.

## Nachtrag zu T-M9-03 — Die Weltkarte auf der Skala der Regeln (2026-09-03, Nacht)

Noahs Entscheidung zum siebten Befund: der Weg mit den wenigsten Spielproblemen. Das ist
die Karte auf die Regelskala zu bringen, nicht die Regeln auf die Karte
(`DECISIONS.md`, 2026-09-03).

| Schritt | Ergebnis | verify |
|---|---|---|
| Generator ohne doppelte Festkomma-Umrechnung | `world.json` neu gebaut; `world-shapes.json` bitgleich; Startwerte Median 41.262, größte Abweichung 13 % | grün |
| Bevölkerung auf die Referenz des Kerns (ein Fünftel) | Median 443.000 je Provinz statt 2,4 Mio — der Bevölkerungsfaktor hing zuvor bei jeder Provinz am Deckel, Geld war zwanzigfach zu reichlich | grün |
| Mindestvorkommen Holz und Erz je Startnation (`ensureStartingBasics`) | Italien kann bauen; jede der 24 Mächte produziert Nahrung, Material, Erz und Geld ab Tag 1 | grün |
| Skalentest `economy-scale.test.ts` | Kaserne kostet jede Macht 0,5–30 Tage Einkommen, die typische Macht liegt binnen Faktor 4 an der Referenzkarte; Bevölkerung auf der Referenz | grün |
| Bevölkerungsanzeige | zeigte die Testkarte als „900" statt „900 Tsd" — Einheit des Kerns sind Festkomma-Tausender | grün |

Gemessen: Deutschland Kaserne 2,4 Tage Material / 2,3 Tage Geld (vorher 4 Spielminuten),
Italien 3,5 / 3,1 (vorher nie), Referenz Nordland 8,8 / 4,1. Der Parameterlauf ist auf
der neuen Karte wiederholt — Ergebnis in `BALANCING.md` und `docs/reports/balance-sweep.md`.

## Nachtrag zu T-M10-05/06 — Die Befehle erreichen die Oberfläche (2026-09-03, Nacht)

Beim zweiten Gang durch die Playtest-Liste: Die Provinzleiste bot nur „Kaserne bauen",
die Armeeleiste nichts. Alles andere war im Kern fertig und nirgends anklickbar
(`PROBLEME.md`). Angebunden, mit Tests:

| Schritt | Ergebnis | verify |
|---|---|---|
| `game/actions.ts` | Jeder Befehl als Daten: 7 Gebäude, 10 Einheiten, Hauptstadt, 7 Armeebefehle, 8 diplomatische Handlungen, Markt — Grund aus `canApply`, Kosten und Dauer im Tooltip | grün |
| `game/rejections.ts` | Ablehnungen in Worten: Fehlbetrag gerechnet („Es fehlt an Rohstoffen: 333 Material."), Gebäude bei Namen, Sperren in Tagen | grün |
| Zielwahl | Marsch/Beschuss: Klick auf die Karte oder Liste im Panel, Ankunftszeit vor der Bestätigung, Escape bricht ab | grün |
| Diplomatie (D), Markt (H), Provinzliste | Aus Kopfleiste und Tastatur; Gegenwert vor dem Tausch; Provinzwahl ohne Maus | grün |
| Ende-zu-Ende | Bauen → Ausheben → Armee wählen → Marsch mit Ankunft im Protokoll; Kriegserklärung mit Wirkungstag; Tausch; Abbruch | grün |

## M13 — Eine Oberfläche, die man ansieht

| Aufgabe | Datum | Was | Prüfung |
|---|---|---|---|
| T-M13-01 | 2026-09-04 | Symbole erreichen die Oberfläche: Satz auf die ausgelieferten Regeln gebracht (`shipyard`, `motorized`, `heavy_tank`, `rocket_artillery`, `destroyer`, `transport` hatten keines; `cavalry`, `submarine`, `mine` gab es gar nicht), sieben Rohstoffsymbole ergänzt, `IconRow` als Bauteil, Vorkommen und Gebäude als Symbolzeile statt als Satz, Symbol auf jedem Bau- und Aushebeknopf, Kopfleiste mit Rohstoffzeichen | 963 Tests grün, `pnpm verify` grün, im laufenden Spiel gegengeprüft |
| T-M13-02 | 2026-09-04 | Ton und Einstiegshilfe eingeschaltet: `cueForEvents` wählt je Tick den dringlichsten Ton (Krieg vor Eroberung vor Kampf vor Mangel vor Fertigstellung), Ton hängt am eigenen Protokollanteil, Toneinstellung wirkt; `Tutorial.tsx` zeigt die fünf Schritte aus M12 neben dem Spiel, ohne Eingaben abzufangen, und merkt sich das Abschalten | 977 Tests grün, `pnpm verify` grün, im laufenden Spiel gegengeprüft |
| T-M13-03 | 2026-09-04 | Automatisches Speichern verdrahtet: Kern (Rotation, Zwei-Uhren-Regel) und Einstellung waren seit M8/M10 da, aber unverbunden — die Einstellung war Zierde. Uhr beim Partiestart und beim Laden gesetzt, sonst greift die Echtzeitbedingung sofort; Schreibsperre gegen doppelte Läufe | 980 Tests grün, `pnpm verify` grün |
| T-M13-04 | 2026-09-04 | Erreichbarkeits-Guard: verfolgt die Importkette ab `main.tsx` und meldet jedes Modul, das die laufende Anwendung nicht erreicht. Drei begründete Ausnahmen (Paketeinstieg, Worker-Hülle mit Maschine). Beim Bau selbst gefunden: eine zeilengebundene Regex übersah mehrzeilige Importlisten und erklärte `game/actions.ts` für tot | 987 Tests grün, `pnpm verify` grün |
| T-M13-05 | 2026-09-04 | Sicht erweitert um Bauschlange, Aushebeschlange, Moralziel und sichtbare Kämpfe — jeweils nur für eigene Provinzen bzw. gesehene Orte und nur, wenn die Sicht mit Regeln angefordert wird (die KI zahlt nichts für Anzeigen, die sie nicht liest). Truppenstärke je Provinz bewusst nicht im Kern: `view.armies` ist bereits gefiltert, die Summe ist Darstellung | 994 Tests grün, `pnpm verify` grün |
| T-M13-06 | 2026-09-04 | `Meter` als Bauteil: `role="meter"` mit Zahlen und Textfassung, Füllung aus Token statt Literal, Trendpfeil erst ab einem halben Prozent der Skala. Moral erscheint als Balken mit Pfeil statt als Prozentzahl. Zwei Befunde beim Bau: ein Standardmaßstab für `trendOf` wäre für die Festkomma- und die Prozentskala unterschiedlich falsch gewesen (jetzt Pflichtangabe); die leere Balkenspur hatte 1,27:1 gegen das Panel und bekam einen Umriss | 1008 Tests grün, `pnpm verify` grün |
| T-M13-07 | 2026-09-04 | Fortschritt sichtbar: Bauvorhaben und Aushebungen als Balken mit Restzeit statt als bloße Anzahl, Marsch als Balken, Siegziel als Anteilsbalken in der Kopfleiste. Korrektur an T-M13-05: der Startzeitpunkt gehört doch in die Sicht — ein Balken braucht beide Enden; dazu `departureTick` je eigener Armee und die Punktschwelle in `victory` | 1021 Tests grün, `pnpm verify` grün |
| T-M13-08 | 2026-09-04 | Die Karte beschriftet sich und erklärt ihre Farben: `labels.ts` als reine Funktion mit übergebener Textbreite (jsdom kann keine Schrift messen), Namen erst unterhalb der Zoomschwelle, keiner breiter als seine Provinz, keine Überlappung; heller Saum für Lesbarkeit auf jeder Füllung. `Legend` zeigt endlich, was `legendFor` seit M10 wusste. Schwelle nach der Sichtprüfung von 1,2 auf 2,0 angehoben — bei Spielstart (1,6) war die Karte sonst namenlos | 1030 Tests grün, Beschriftungsbudget gemessen, `pnpm verify` grün |
| T-M13-09 | 2026-09-04 | Karte trägt Hauptstadt (Stern über der Provinz), laufende Kämpfe (Ring mit Säbeln, aus der Sicht statt aus einer Fahne, die nie jemand setzte), Armeekasten mit dem Zeichen der stärksten Gattung, Marschweg der gewählten Armee. Karte und Panels zeichnen dieselben Pfade — `ICON_PATHS` über `Path2D` | 1037 Tests grün, `pnpm verify` grün |
