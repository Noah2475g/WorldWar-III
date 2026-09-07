---
type: plan
status: draft
projekt: WorldWar (Supremacy-WW3-Klon, Singleplayer)
stufe: 1 von 3 (Requirements)
created: 2026-09-02
---

# 01 — REQUIREMENTS

> **Für Agenten:** Dies ist die Wahrheitsquelle für das *Was*. Das *Wie* steht in
> `02-DESIGN.md`, die Reihenfolge in `03-TASKS.md`. Jede Anforderung hat eine stabile ID
> (`R-<Bereich>-<Nr>`) und mindestens ein **Akzeptanzkriterium** in EARS-Form
> (`WENN <Auslöser> DANN SOLL das System <beobachtbares Verhalten>`).
> Eine Anforderung gilt erst als erfüllt, wenn ein automatisierter Test sie prüft und
> dieser Test grün ist. Tests referenzieren die Requirement-ID im Testnamen,
> z. B. `describe('R-ECON-03 …')`.

## 0. Produktvision

Ein vollständiger, lokal laufender Nachbau von **Supremacy: World War 3** (Bytro Labs) als
**Singleplayer gegen Computergegner**. Echtzeit-Strategie auf einer Provinzkarte der Welt:
Provinzen verwalten, Ressourcen produzieren, Gebäude bauen, Armeen rekrutieren, bewegen und
Schlachten führen, Diplomatie betreiben — bis eine Siegbedingung erfüllt ist.

Drei Abweichungen vom Original sind **erklärte Produktziele**, keine Kompromisse:

| # | Ziel | Begründung |
|---|---|---|
| Z1 | **Frei regelbare Spielgeschwindigkeit** inkl. Pause und Vorspulen-bis-Ereignis | Das Original erzwingt Echtzeit-Wartezeiten über Tage. Eine Partie soll in einer Sitzung spielbar sein. |
| Z2 | **Keinerlei Monetarisierung** — kein Gold, keine Premiumwährung, keine Kaufvorteile, keine Werbung, keine Telemetrie | Pay-to-win ist ausdrücklich zu entfernen. Alle im Original kaufbaren Vorteile sind entweder frei verfügbar oder ersatzlos gestrichen. |
| Z3 | **Offline und ohne Konto** spielbar | Kein Server, kein Login, keine Netzwerkverbindung nötig. |

Nicht-Ziel für V1: Multiplayer. Die Architektur muss ihn aber **vorbereiten** (siehe R-ARCH-04).
Nicht-Ziel überhaupt: Veröffentlichung/Vertrieb. Das Projekt ist privat. Dennoch werden
**keine Original-Assets** (Grafiken, Sounds, Texte, Code) von Bytro verwendet; alle Assets
werden selbst erzeugt oder stammen aus frei lizenzierten Quellen (siehe R-ASSET-01).

## 1. Rahmenbedingungen (vom Nutzer entschieden, nicht verhandelbar)

| ID | Entscheidung |
|---|---|
| C-01 | **Tech-Stack:** TypeScript. Simulationskern als reines, UI-freies Package. UI mit React. Kartenrendering über Canvas/WebGL. Build mit Vite. |
| C-02 | **Auslieferung:** Ziel bleibt die Desktop-Anwendung über **Tauri** mit Savegames im echten Dateisystem. **Präzisiert am 2026-09-05 (Entscheidung 2):** Die V1 wird als Browserbau mit dauerhaftem Speicher (**IndexedDB**) abgenommen; die Tauri-Verpackung samt Datei-Port ist **M16** mit eigenem Abnahmekriterium **AK-8**. Grund: C-02 war die einzige Rahmenbedingung, die nie ausgeführt wurde — kein CLI, kein Symbol, kein `Cargo.lock`, keine JS-Bindung, kein Bau; es ist bis heute unbekannt, ob das Programm überhaupt startet. Die Bedingung wird damit nicht aufgehoben, sondern ihr Zeitpunkt festgelegt. |
| C-03 | **Karte:** echte Weltkarte, **150–250 Provinzen**, aus frei lizenzierten Geodaten erzeugt. |
| C-04 | **V1-Umfang:** Kern-Loop (Karte, Wirtschaft, Bau, Einheiten, Bewegung, Kampf, Moral, Zeitsteuerung, KI, Sieg/Niederlage, Speichern/Laden). Diplomatie-Tiefe, Spionage, Forschung, Zeitung, Markt, Nuklearwaffen → V2. |
| C-05 | **Zeitsteuerung:** Pause + frei regelbarer Faktor + „Vorspulen bis Ereignis“. |
| C-06 | **UI-Anspruch:** voller Look in Anlehnung an das Original (Militärkarten-Ästhetik, Icons, Animationen, Sound) — mit vorgelagertem **Design-Gate** (Mockup-Freigabe vor Umsetzung). |
| C-07 | **Sprache:** UI und Dokumentation auf Deutsch. Code, Bezeichner und Commit-Messages auf Englisch. |
| C-08 | **Vorgehen:** strikt **TDD** — Test zuerst, dann Implementierung. Kein Produktionscode ohne vorher fehlschlagenden Test. |
| C-09 | **Regelwerk:** Kernmechanik nach **Supremacy 1914 in der Fassung nach dem Umbau vom 10.01.2023** (deterministischer Kampf, Moral mit Ziel- und Istwert, Stapel-Deckel), **Setting und Einheiten modern (WW3)**. Grund: Für dieses Modell liegen belegte Formeln vor. *(Die verlinkte Steam-Anwendung 784950 ist das umbenannte „Conflict of Nations: World War 3“ — ein Schwesterspiel mit eigenem Modell und weitgehend unveröffentlichten Werten.)* |
| C-10 | **Balancing:** belegte Zahlen aus `docs/research/SUPREMACY-MECHANICS.md` werden übernommen; Lücken werden begründet geschätzt und über automatisierte Testpartien abgestimmt. |
| C-11 | **Mehrspieler (später, entschieden 2026-09-04):** Im Mehrspielermodus gibt es **keine dynamische Zeitsteuerung**. Die Spielgeschwindigkeit wird **beim Start der Partie fest gewählt** und gilt für alle Teilnehmer unverändert, damit in Online-Partien keine Synchronisationsprobleme entstehen. Pause, stufenloses Tempo und Vorspulen bleiben Einzelspieler-Funktionen. Folge für heute: die Zeitsteuerung liegt vollständig **außerhalb** des Simulationskerns und des Spielzustands (R-ARCH-04/AK2), damit sie später durch eine feste Rate ersetzt werden kann, ohne den Kern anzufassen. |

## 2. Anforderungen

### 2.1 Architektur & Qualität (`R-ARCH`)

- **R-ARCH-01 — Deterministischer Simulationskern.**
  Der Kern ist eine reine Funktion über den Spielzustand: `step(state, commands) → newState`.
  Kein Zufall außer aus einem **geseedeten** PRNG, der Teil des Zustands ist.
  Keine Uhrzeit-, Datei- oder Netzwerkzugriffe im Kern.
  - AK1: WENN dieselbe Startkonfiguration mit demselben Seed und derselben Befehlsfolge
    zweimal simuliert wird, DANN SOLL der Zustands-Hash nach jedem Tick identisch sein.
  - AK2: WENN der Kern gebaut wird, DANN SOLL er keine Abhängigkeit auf React, DOM,
    `Date.now`, `Math.random` oder `fs` enthalten (Lint-Regel + Import-Check).

- **R-ARCH-02 — Befehlsbasierte Steuerung.** Jede Spieleraktion ist ein serialisierbares
  Kommando-Objekt. Die UI ändert den Zustand niemals direkt.
  - AK1: WENN ein Kommando ungültig ist (z. B. zu wenig Ressourcen), DANN SOLL der Kern es
    ablehnen und einen strukturierten Fehler mit Grund liefern, ohne den Zustand zu ändern.

- **R-ARCH-03 — Reproduzierbare Partie aus Seed + Kommandolog.**
  - AK1: WENN Seed und Kommandolog einer Partie erneut abgespielt werden, DANN SOLL der
    Endzustand exakt dem Original entsprechen.

- **R-ARCH-04 — Multiplayer-Vorbereitung (nicht implementiert in V1).**
  Der Kern kennt N Spieler; „menschlich“ vs. „KI“ ist nur ein Attribut am Spieler.
  Kommandos sind pro Spieler adressiert und tickgenau eingeordnet.
  - AK1: WENN eine Partie mit zwei als „menschlich“ markierten Spielern erzeugt wird, DANN
    SOLL die Simulation ohne Anpassung des Kerns korrekt laufen (Hot-Seat-Test).
  - AK2 (C-11, 2026-09-04): WENN der Spielzustand oder der Kern nach einer Tempo-, Pause-
    oder Vorspulgröße durchsucht wird, DANN SOLL es keine geben — Geschwindigkeit ist Sache
    der Hülle (Oberfläche, Simulations-Host), nie des Zustands. Ein Mehrspielermodus mit
    fester Startgeschwindigkeit ersetzt später die Hülle, nicht den Kern.

- **R-ARCH-05 — Testabdeckung.** Simulationskern ≥ 90 % Zeilenabdeckung, Gesamtprojekt ≥ 80 %.
  Unterschreitung lässt die Prüfkette fehlschlagen.

- **R-ARCH-06 — Performance.**
  - AK1: WENN die **ausgelieferte Weltkarte** simuliert wird (237 Provinzen, 12 Mächte, KI
    für alle), DANN SOLL ein Tick im Median unter **3,5 ms** und im 99. Perzentil unter
    **8 ms** dauern.
    *(Nachgemessen und begründet am 2026-09-06, siehe DECISIONS.md. R-TIME-02 verlangt bis
    zu 100 Spielstunden je Sekunde, also rund 100 Ticks je Sekunde — dafür genügen 10 ms je
    Tick; 3,5 ms halten die interaktive Betriebsart mit dreifacher Reserve. Die frühere
    Zahl 0,5 ms stammte aus der Entwurfsphase, ist nie nachgerechnet worden und forderte
    das Achtfache dessen, was ihre eigene Begründung trug. Gemessen wird ausdrücklich die
    Karte, die ausgeliefert wird, nicht eine gedachte mit 200 Provinzen: der alte Wortlaut
    ließ zu, dass ein Test die Zahl an einer zwanzigmal kleineren Karte für erfüllt
    erklärt. Die Zusicherung im Bench liegt bei genau diesen Werten — dreimal gemessen
    2,344/2,359/2,463 ms Median, also rund 1,5-fache Reserve: genug für die Schwankung
    einer Maschine, zu wenig für einen echten Rückschritt.)*
  - AK2: WENN die Karte gerendert wird, DANN SOLL die Anzeige bei 200 Provinzen ≥ 60 FPS halten.

### 2.2 Zeit & Geschwindigkeit (`R-TIME`) — Kernziel Z1

- **R-TIME-01 — Tick als Zeiteinheit.** Ein Tick entspricht **einer Spielstunde**. Alle Dauern
  (Bau, Bewegung, Rekrutierung) werden in Ticks gerechnet, nie in Realzeit.
- **R-TIME-02 — Geschwindigkeitsregelung in zwei Betriebsarten.**
  *(a) Interaktiv:* stufenlos zwischen **Pause und 100 Spielstunden pro Realsekunde**, mit
  laufender Darstellung. *(b) Vorspulen:* darüber hinaus beliebig schnell, ohne Darstellung —
  siehe R-TIME-03. Zusammen erfüllen beide das Ziel Z1 (keine Wartezeiten); ein einzelner
  Regler bis 1000 wäre bei gleichzeitigem Rendern und Melden nicht einlösbar.
  - AK1: WENN der Regler auf Pause steht, DANN SOLL kein Tick ausgeführt werden.
  - AK2: WENN der Regler auf Faktor F ≤ 100 steht, DANN SOLL die Tickrate im Mittel über
    5 Sekunden um höchstens 10 % von F abweichen, solange die Rechenleistung reicht.
  - AK3: WENN die Rechenleistung nicht reicht, DANN SOLL die reale Rate sinken und **kein Tick
    übersprungen werden**; der Rückstand SOLL dabei auf höchstens 2 Ticks begrenzt bleiben,
    damit sich keine Schuld aufbaut, die das Spiel später einfrieren lässt.
  - AK4: WENN vorgespult wird, DANN SOLL die Simulation mindestens 500 Spielstunden pro
    Realsekunde erreichen (200 Provinzen, 8 Spieler).
- **R-TIME-03 — Vorspulen bis Ereignis.** Wählbare Ziele: Bau fertig, Armee am Ziel, Kampf
  beginnt, Angriff auf eigenes Gebiet, Tageswechsel, feste Zahl Stunden/Tage.
  - AK1: WENN während des Vorspulens ein Alarm-Ereignis eintritt (eigene Provinz angegriffen,
    Armee vernichtet, Kriegserklärung), DANN SOLL das Vorspulen sofort stoppen und melden.
- **R-TIME-04 — Zeitanzeige.** Datum und Uhrzeit der Spielwelt sind jederzeit sichtbar.
- **R-TIME-05 — Keine Realzeit-Kopplung.** Kein Fortschritt ist an die reale Uhr gebunden;
  bei geschlossenem Programm schreitet nichts voran.

### 2.3 Anti-Monetarisierung (`R-FREE`) — Kernziel Z2

- **R-FREE-01 — Keine Premiumwährung.** Der Zustand enthält keine Gold-/Premium-Ressource.
  - AK1: WENN der Quelltext nach Kaufwährungs-Begriffen (`gold`, `goldmark`, `premium`, `iap`,
    `purchase`, `shop`, `microtransaction`) durchsucht wird, DANN SOLL kein Treffer existieren
    (Guard-Test mit dokumentierter Ausnahmeliste).
- **R-FREE-02 — Ehemalige Kaufvorteile sind frei oder gestrichen.** Jeder im Original kaufbare
  Vorteil wird einer von drei Kategorien zugeordnet und so umgesetzt: *(a) frei verfügbar*,
  *(b) reguläre Mechanik mit Ressourcenkosten*, *(c) gestrichen*. Zuordnung tabellarisch in
  `02-DESIGN.md`, jede Zeile begründet.
- **R-FREE-03 — Sofortiges Fertigstellen ohne Kosten.** Falls „Bau beschleunigen“ existiert,
  ist es kostenlos — oder es entfällt, weil der Geschwindigkeitsregler dasselbe leistet.
- **R-FREE-04 — Keine Werbung, keine Telemetrie, keine Netzwerkverbindung.**
  - AK1: WENN die Anwendung läuft, DANN SOLL sie keine ausgehende Netzwerkverbindung öffnen
    (per Tauri-Konfiguration eingeschränkt und im Test geprüft).
- **R-FREE-05 — Kein zeitbasierter Druck.** Keine Energie-/Ausdauer-/Wartebalken, die nur
  durch Warten oder Zahlung verschwinden.

### 2.4 Karte & Welt (`R-MAP`)

- **R-MAP-01 — Provinzkarte.** 150–250 Landprovinzen mit Polygon-Geometrie,
  Nachbarschaftsbeziehungen und Seewegen.
- **R-MAP-02 — Datengetrieben.** Die Karte ist eine Datendatei (JSON), kein Code.
  - AK1: WENN eine Kartendatei geladen wird, DANN SOLL sie gegen ein Schema validiert und bei
    Verstoß mit klarer Meldung abgelehnt werden.
  - AK2: WENN die Karte validiert wird, DANN SOLL geprüft werden, dass jede Startposition
    über Land- oder Seewege erreichbar ist.
- **R-MAP-03 — Provinzattribute.** Name, Eigentümer, Typ (Stadt/Land), Ressourcenvorkommen,
  Bevölkerung, Moral, Gebäude, Küstenzugang, Nachbarn, Hauptstadt-Flag.
- **R-MAP-04 — Freie Geodaten.** Geometrie aus gemeinfreien/frei lizenzierten Quellen
  (z. B. Natural Earth). Herkunft und Lizenz dokumentiert.
- **R-MAP-05 — Kartendarstellung.** Provinzen nach Eigentümer eingefärbt, Grenzen sichtbar,
  zoom- und verschiebbar; Einheiten, Gebäude und Kampfsymbole darauf angezeigt.
- **R-MAP-06 — Kartenmodi.** Umschaltbar: politisch, Ressourcen, Moral, Truppenstärke.
- **R-MAP-07 — Kein Modus ohne Daten.** Jeder angebotene Kartenmodus färbt aus einer Größe,
  die das Spiel wirklich führt. Ein Modus, für den keine Daten anfallen, wird nicht angeboten.
  - AK1: WENN ein Kartenmodus in der Auswahl steht, DANN SOLL für mindestens eine Provinz
    einer laufenden Partie eine andere Füllung als „unbekannt“ herauskommen.

- **R-MAP-08 — Die Karte zeigt jedes Stück Land, das eine Provinz hat.** Eine Provinz besteht
  aus **einem oder mehreren** Umrissen: Alaska und Kalifornien gehören zur selben Macht und
  liegen nicht aneinander, eine Insel gehört zu ihrem Festland. Die ausgelieferte Kartendatei
  führt sie alle.
  - AK1: WENN eine Provinz gezeichnet wird, DANN SOLL die Summe ihrer gezeichneten Flächen
    **mindestens 99 %** der Fläche ihrer Quellgeometrie betragen.
  - AK2: WENN eine Provinz einen Ankerpunkt (`center`) hat, DANN SOLL dieser **in einer ihrer
    gezeichneten Flächen** liegen — eine Beschriftung im offenen Meer benennt nichts.
  - AK3: WENN eine Provinz gezeichnet wird, DANN SOLL kein Punkt außerhalb der Leinwand liegen.
- **R-MAP-09 — Die Kartendatei ist an ihre Quelle gebunden.** `world.json` ist ein Erzeugnis;
  `world-shapes.json` ist die Quelle. Ein Wächter vergleicht beide, statt der Datei zu glauben.
  - AK1: WENN `world.json` erzeugt wurde, DANN SOLL ein Test es gegen `world-shapes.json`
    nachrechnen und bei Abweichung fallen — mit Nennung der betroffenen Provinzen.
  - AK2: WENN eine bekannte Landmarke (Stadt) auf die Karte projiziert wird, DANN SOLL sie in
    einer Provinz liegen und nicht im Meer.

### 2.5 Wirtschaft (`R-ECON`)

- **R-ECON-01 — Ressourcenmodell.** Ressourcen analog zum Original (Nahrung, Material/Holz,
  Öl, Kohle, Eisen/Stahl, Seltene Rohstoffe) plus **Geld**. Endgültige Liste in `02-DESIGN.md`.
- **R-ECON-02 — Produktion pro Tick** je Provinz, abhängig von Vorkommen, Gebäuden, Moral
  und Bevölkerung.
- **R-ECON-03 — Verbrauch und Mangel.** Armeen verbrauchen Ressourcen. *(Gebäudeunterhalt am 2026-09-05 zurückgenommen, T-M14-03: `BuildingRule` und `buildings.json` kennen kein `upkeep`-Feld, und die Unterhaltsphase sammelt den Bedarf allein über `armyOrder`. Begründung in DECISIONS.md.)*
  - AK1: WENN ein Vorrat unter null fallen würde, DANN SOLL ein Mangelzustand mit definierten
    Maluspunkten eintreten statt negativer Bestände.
- **R-ECON-04 — Lagergrenzen** je Ressource, mit definierter Überschussbehandlung.
- **R-ECON-05 — Handel/Markt.** V1: einfacher Umtausch zu dynamischem Preis. Spielermarkt → V2.
- **R-ECON-06 — Wirtschaftsübersicht.** Bestand, Produktion/Tag, Verbrauch/Tag und Bilanz
  je Ressource sind sichtbar.

### 2.6 Provinzen, Gebäude, Moral (`R-PROV`)

- **R-PROV-01 — Gebäude bauen.** Kosten Ressourcen und Bauzeit in Ticks; Voraussetzungen werden
  geprüft.
  - AK1: WENN ein Bauauftrag erteilt wird und die Ressourcen reichen, DANN SOLL das System die
    Kosten sofort abziehen und den Auftrag mit Fertigstellungs-Tick einreihen.
  - AK2: WENN die Provinz während des Baus den Eigentümer wechselt, DANN SOLL der Bauauftrag
    abgebrochen werden (keine Rückerstattung).
- **R-PROV-02 — Gebäudetypen** mindestens: Rekrutierungsbüro/Kaserne, Festung, Fabrik/Rüstung,
  Werft, Flugplatz, Infrastruktur/Eisenbahn, Hafen. Effekte in `02-DESIGN.md`.
- **R-PROV-03 — Moral** je Provinz (0–100), beeinflusst von Hauptstadtnähe, Nachbarprovinzen,
  Nahrungsversorgung, Kriegsmüdigkeit, Besatzungsdauer.
  - AK1: WENN die Moral unter den Schwellwert fällt, DANN SOLL ein Aufstand möglich werden,
    der die Provinz in Rebellenbesitz überführt.
- **R-PROV-04 — Moral wirkt auf Produktion und Rekrutierung** (dokumentierte Formel).
- **R-PROV-05 — Hauptstadt** mit Bonus; ihr Verlust hat definierte Folgen.

### 2.7 Einheiten & Bewegung (`R-UNIT`)

- **R-UNIT-01 — Einheitenkatalog** mit Kosten, Bauzeit, Angriffs-/Verteidigungswerten gegen
  Einheitenklassen, Geschwindigkeit, Reichweite, Unterhalt. Klassen mindestens: Infanterie,
  gepanzert, Artillerie, Luft, See.
- **R-UNIT-02 — Rekrutierung** nur in Provinzen mit passendem Gebäude; kostet Ressourcen und Ticks.
- **R-UNIT-03 — Armeen.** Einheiten werden gestapelt; Armeen sind teilbar und zusammenlegbar.
- **R-UNIT-04 — Bewegung** entlang des Provinzgraphen mit tickgenauer Ankunft, abhängig von der
  langsamsten Einheit, Gelände und Infrastruktur.
  - AK1: WENN ein Marschbefehl erteilt wird, DANN SOLL die voraussichtliche Ankunftszeit **vor**
    Bestätigung angezeigt werden und mit der tatsächlichen Ankunft übereinstimmen (± 0 Ticks,
    solange nichts unterbricht).
- **R-UNIT-05 — Aufmarschverzögerung** nach Bewegungsbeginn, danach volle Kampfkraft.
- **R-UNIT-06 — Seetransport.** Transportschiffe haben eine Kapazität; Ein- und Ausschiffung
  kosten Zeit (an feindlicher Küste mehr); eingeschiffte Verbände kämpfen nicht und sind auf
  See verwundbar; eine Landung an verteidigter Küste hat einen Angriffsmalus.
  - AK1: WENN zwei Kontinente nur über See verbunden sind, DANN SOLL eine Landarmee den
    anderen Kontinent ausschließlich per Transport erreichen können.
- **R-UNIT-08 — Luftstreitkräfte in V1.** Flugzeuge sind auf Flugplätzen stationiert, wirken
  als Fernwaffe in einem Umkreis, verlegen nur zwischen eigenen Flugplätzen und erobern nichts.
  *(Vollwertige Einsatzbefehle mit Rückflug und Bodenzeit: V2.)*
- **R-UNIT-07 — Zustand.** Einheiten haben Stärke in Trefferpunkten; beschädigte Einheiten
  regenerieren in eigenem Gebiet. *(Einheitenmoral am 2026-09-05 zurückgenommen, T-M14-03: ein Verband ist `{ unitKey, hpTotal }`; im Trefferpunkte-Pool ist der Pool die Stärke. DECISIONS.md.)*

### 2.8 Kampf (`R-BAT`)

- **R-BAT-01 — Kampfauflösung pro Tick** nach dokumentierter Formel, wenn feindliche Armeen in
  derselben Provinz stehen.
- **R-BAT-02 — Klassenmatrix.** Schaden hängt von Angreifer- und Verteidigerklasse ab.
- **R-BAT-03 — Verteidigungsboni** durch Festung, Gelände und Eingrabung. *(Der Malus für Fluss- und Meerengenübergänge am 2026-09-05 zurückgenommen, T-M14-03: `crossingFactor` war toter Code ohne einen einzigen Aufrufer. Das Kartenfeld `crossing` bleibt als Datenbestand. DECISIONS.md.)*
- **R-BAT-04 — Provinzeroberung**, wenn keine Verteidiger mehr vorhanden sind; eroberte Provinz
  erhält Moralmalus.
- **R-BAT-05 — Rückzug** ist möglich und kostet definierte Nachteile.
- **R-BAT-06 — Fernkampf/Bombardement** durch Artillerie und Luftwaffe ohne eigenen Nahkampf.
- **R-BAT-07 — Kampfbericht** mit Verlusten beider Seiten, nachlesbar.
  - AK1: WENN ein Kampf stattfindet, DANN SOLL verbleibende Stärke plus gemeldete Verluste
    exakt der Ausgangsstärke entsprechen (Erhaltungs-Test).

### 2.9 Diplomatie (`R-DIP`) — V1 in Grundzügen

- **R-DIP-01 — Zustände:** Frieden, Krieg, Waffenstillstand, Bündnis, Durchmarschrecht,
  Kartenfreigabe.
- **R-DIP-02 — Kriegserklärung** mit Vorlaufzeit; Angriff ohne Kriegserklärung kostet Ansehen.
- **R-DIP-03 — KI reagiert** auf Angebote nach nachvollziehbaren Regeln.
- **R-DIP-04 — Sichtbarkeit** von Provinzen und Armeen abhängig von diplomatischem Zustand und
  Aufklärung (Nebel des Krieges). Der zuletzt bekannte Stand fremder Provinzen wird je Spieler
  **im Spielstand** gespeichert.
  - AK1: WENN ein Spielstand geladen wird, DANN SOLL das Aufklärungswissen unverändert
    fortbestehen.
  - AK2: WENN die Oberfläche Daten erhält, DANN SOLL sie ausschließlich die für diesen Spieler
    sichtbare Auswahl bekommen — nie den vollständigen Spielzustand.

### 2.10 Computergegner (`R-AI`)

- **R-AI-01 — Vollwertige KI-Spieler.** KI nutzt ausschließlich dieselben Kommandos wie ein
  Mensch. Kein Zugriff auf verborgene Informationen, keine Boni auf Standardstufe.
  - AK1: WENN eine KI handelt, DANN SOLL jeder ihrer Befehle die reguläre Kommandovalidierung
    durchlaufen.
- **R-AI-02 — Schwierigkeitsgrade** (leicht, normal, schwer). Höhere Stufen dürfen besser
  *entscheiden*; Ressourcenboni sind erlaubt, müssen aber im UI offen ausgewiesen werden.
- **R-AI-03 — Kompetenzen:** Wirtschaft aufbauen, rekrutieren, Grenzen verteidigen, Ziele
  wählen, angreifen, Diplomatie betreiben, auf Bedrohung reagieren.
- **R-AI-04 — Rechenbudget.** Die Entscheidungen aller KI-Spieler kosten im Mittel höchstens
  **30 % der Tickzeit** (bei 8 KI-Spielern). Als Anteil formuliert, damit das Budget bei jeder
  künftigen Änderung von R-ARCH-06 gültig bleibt.
- **R-AI-07 — KI-Gedächtnis ist Teil des Spielstands.** Pläne, Ziele und Zuordnungen der KI
  werden mitgespeichert.
  - AK1: WENN eine Partie gespeichert und geladen wird, DANN SOLL die KI dieselben
    Entscheidungen treffen wie ohne Unterbrechung (Vergleich über 50 Ticks).
- **R-AI-05 — Nachvollziehbarkeit.** Im Debug-Modus ist die Begründung jeder Entscheidung
  einsehbar (Ziel, Bewertung, Alternative).
- **R-AI-06 — Spielstärke messbar.** Kopflose KI-gegen-KI-Turniere liefern Siegquoten;
  „schwer“ schlägt „leicht“ in ≥ 70 % der Partien.

### 2.11 Partie & Persistenz (`R-GAME`)

- **R-GAME-01 — Partie erstellen:** Karte, Anzahl KI-Gegner, eigenes Land, Schwierigkeit,
  Siegbedingung, Seed.
- **R-GAME-02 — Siegbedingungen:** Punktesieg und Eroberungssieg; Auswahl bei Partiestart. *(Der Zeitsieg am 2026-09-05 als Auswahl zurückgenommen, T-M14-03: der Kern beherrscht ihn, aber keine Produktionsdatei setzt `condition: time`. Er bleibt im Kern und ist über eine Konfiguration erreichbar — siehe `v1_partial`. DECISIONS.md.)*
- **R-GAME-03 — Speichern/Laden** in eine Datei; ein geladener Stand setzt die Simulation
  bitgenau fort.
  - AK1: WENN gespeichert und sofort geladen wird, DANN SOLL der Zustands-Hash identisch sein.
- **R-GAME-04 — Automatisches Speichern** in einstellbarem Intervall (in Spieltagen), mit
  Rotation mehrerer Stände.
- **R-GAME-05 — Speicherstand-Version.** Savegames tragen eine Versionsnummer; inkompatible
  Stände werden mit klarer Meldung abgelehnt statt still zu brechen.
- **R-GAME-06 — Ereignisprotokoll** aller relevanten Ereignisse, filterbar und anspringbar.

### 2.12 Benutzeroberfläche (`R-UI`)

- **R-UI-01 — Design-Gate.** Vor der UI-Umsetzung wird ein Mockup (Farb-/Typo-Tokens,
  Kartenansicht, Provinzpanel, Leiste) zur Freigabe vorgelegt. Ohne Freigabe kein UI-Bau.
  *(Lesson `ui-needs-design-gate` aus dem Projekt Rotation.)*
- **R-UI-02 — Lesbarkeit** als harte Anforderung: Kontrastverhältnis ≥ 4,5:1 für Text,
  automatisiert geprüft.
- **R-UI-03 — Hauptansicht:** Karte, Ressourcenleiste, Zeit-/Geschwindigkeitsleiste,
  Provinzpanel, Armeepanel, Ereignisliste, Diplomatieübersicht.
- **R-UI-04 — Original-naher Look:** Militärkarten-Ästhetik, Einheiten- und Gebäudeicons,
  Bewegungs- und Kampfanimationen, Sound für Kernereignisse — alle Assets selbst erstellt
  oder frei lizenziert.
- **R-UI-05 — Bedienung ohne Nachschlagen:** jede Aktion per Klick auf Karte oder Panel
  erreichbar, mit Tooltip, der Kosten und Dauer nennt.
- **R-UI-06 — Tastaturkürzel** für Pause, Geschwindigkeit, Vorspulen, Speichern.
- **R-UI-07 — Deutschsprachige UI**, Texte zentral in einer Sprachdatei.

#### Ausbau der Oberfläche (V1.1, aufgenommen 2026-09-03)

Die Oberfläche der V1 sagt die Wahrheit, aber sie sagt sie fast ausschließlich in Wörtern und
Zahlen: Moral als „70 %“, Vorkommen als „5 Nahrung, 2 Kohle, 1 Eisen“, drei gleichlautende
Absagesätze unter drei Knöpfen. Zugleich sind Symbolsatz, Ton und Einstiegshilfe gebaut,
getestet — und in keiner Zeile der Anwendung eingebunden. Die folgenden Anforderungen schließen
beides: die tote Bausubstanz und die Textlastigkeit.

- **R-UI-08 — Nichts Gebautes bleibt unverdrahtet.** Jedes Modul unterhalb von
  `apps/desktop/src` ist vom Einstiegspunkt der Anwendung aus erreichbar. Nicht mehr Benötigtes
  wird gelöscht, nicht liegen gelassen.
  - AK1: WENN ein Modul unter `apps/desktop/src` liegt und kein Testmodul ist, DANN SOLL es
    über die Importkette ab `main.tsx` erreichbar sein.
  - *Begründung: Symbolsatz (`ui/icons.tsx`), Ton (`ui/sound.ts`) und Einstiegshilfe
    (`game/tutorial.ts`) galten über ihre Modultests als belegt, während der Spieler nichts
    davon je zu sehen bekam. Ein Test, der nur den Baustein prüft, belegt nicht das Spiel.*
- **R-UI-09 — Begrenzte Größen erscheinen als Anzeige, nicht als bloße Zahl.** Jede Größe mit
  natürlicher Ober- oder Untergrenze — Moral, Kampfstärke, Bau- und Aushebefortschritt,
  Marschfortschritt, Vorratsreichweite, Anteil am Siegziel — wird grafisch dargestellt
  (Balken oder Ring), mit dem Zahlenwert daneben.
  - AK1: WENN eine solche Größe angezeigt wird, DANN SOLL die Anzeige ihren Anteil am
    Maximum als Länge tragen und den Wert zusätzlich als Text nennen.
- **R-UI-10 — Wiederkehrende Dinge tragen ihr Symbol.** Einheitengattung, Gebäudeart,
  Rohstoff, Beziehungszustand und Warnung erscheinen überall mit demselben Symbol aus dem
  eigenen Satz — in Panels, Kopfleiste und auf der Karte.
  - AK1: WENN ein Gebäude oder eine Einheit in der Oberfläche vorkommt, DANN SOLL das
    zugehörige Symbol daneben stehen.
- **R-UI-11 — Jedes Ding erklärt sich dort, wo es steht.** Gebäude, Einheit, Rohstoff,
  Kartenmodus, Geländeart und Beziehungszustand tragen eine Beschreibung von höchstens zwei
  Sätzen, erreichbar mit Zeiger und Tastatur an der Stelle, an der das Ding vorkommt.
  Ein Nachschlagewerk als eigene Seite ist ausdrücklich nicht gemeint.
  - AK1: WENN eines dieser Dinge in der Oberfläche vorkommt, DANN SOLL eine Beschreibung
    dazu abrufbar sein, ohne die Ansicht zu verlassen.
  - AK2: WENN eine Beschreibung fehlt, DANN SOLL das ein Test melden, nicht der Spieler.

#### Die Karte spricht mit (V1.3, aufgenommen 2026-09-07)

Der Abnahme-Playtest hat einen Kartenfehler zutage gefördert und dabei eine zweite Sache
sichtbar gemacht: die Oberfläche sagt fast alles in Wörtern. Der Symbolsatz existiert und ist
gut — 27 Zeichen, gezeichnet statt geladen —, aber er steht an wenigen Stellen. Wo eine Macht
gemeint ist, steht ihr Name; wo ein Gelände gemeint ist, steht das Wort.

> **Zuerst die Lücken in dem, was schon zugesagt ist.** R-UI-10 nennt im Text den
> **Beziehungszustand**, und dafür gibt es kein Symbol; R-UI-11 nennt die **Geländeart**, und
> die steht als Wort da. Beide sind V1-Anforderungen. Ihr AK1 prüft weniger als ihr Satz
> verspricht — R-UI-10/AK1 fragt nur nach Gebäude und Einheit —, deshalb ist die Lücke nie
> aufgefallen. Das ist dieselbe Bauart wie AK-7 vor dem 2026-09-07: ein Kriterium, das einen
> Teil des Versprechens prüft und den Rest als erfüllt aussehen lässt.

- **R-UI-16 — Jede Macht hat ein Gesicht.** Wo eine Macht genannt wird — Diplomatie, Lage,
  Protokoll, Provinzansicht —, steht ihre Farbe daneben, dieselbe, die sie auf der Karte hat.
  Ein Name allein zwingt den Spieler, sich elf Zuordnungen zu merken, die die Karte längst
  zeigt.
  - AK1: WENN eine Macht in einer Liste oder Zeile erscheint, DANN SOLL ihre Kartenfarbe
    unmittelbar daneben stehen.
  - AK2: WENN die Farbe die einzige Unterscheidung wäre, DANN SOLL zusätzlich ein Text oder
    ein Zeichen tragen — eine Farbe allein ist für rund acht Prozent der Männer keine.
- **R-UI-17 — Die Oberfläche antwortet auf das, was der Spieler tut.** Ein Klick, der etwas
  bewirkt, sieht anders aus als einer, der nichts bewirkt hat: die gewählte Provinz, die
  laufende Zielwahl, der eben gegebene Befehl sind sichtbar, ohne dass man den Text liest.
  - AK1: WENN eine Provinz gewählt ist, DANN SOLL sie auf der Karte und in der Ansicht
    dasselbe Kennzeichen tragen.
  - AK2: WENN ein Befehl angenommen wurde, DANN SOLL die Oberfläche das innerhalb eines
    Bildes zeigen — nicht erst mit dem nächsten Spieltag.

- **R-UI-12 — Die Karte trägt die Lage.** Provinznamen ab einer festgelegten Zoomstufe,
  Legende zum jeweiligen Kartenmodus, Hauptstadt und laufende Kämpfe als Symbol, Marschweg
  und Ziel der ausgewählten Armee als Linie.
- **R-UI-13 — Der Stand der Partie ist ablesbar.** Punktestand aller bekannten Mächte, der
  Anteil am Siegziel und der Ausgang der Partie sind ohne Umweg sichtbar; eine entschiedene
  Partie sagt das von sich aus.
- **R-UI-14 — Was Aufmerksamkeit braucht, meldet sich.** Angriff auf eigenes Gebiet,
  Rohstoffmangel, Aufstandsgefahr und Fertigstellungen erscheinen als Meldung mit Symbol,
  anspringbar; das Ereignisprotokoll bleibt daneben bestehen und wird filterbar (R-GAME-06).
  - AK1: WENN eine Meldung ein Gebiet betrifft, DANN SOLL ein Klick darauf die Karte
    dorthin führen.

### 2.13 Assets & Recht (`R-ASSET`)

- **R-ASSET-01 — Keine Fremdassets.** Keine Grafiken, Sounds, Texte, Daten oder Codeteile aus
  dem Original. Jedes Asset hat einen Herkunfts- und Lizenzeintrag in `docs/ASSETS.md`.
- **R-ASSET-02 — Nur freie Lizenzen** (gemeinfrei, CC0, OFL, MIT o. ä.). Kein kostenpflichtiger
  Dienst, keine Registrierung.

### 2.14 Umfang und Meilensteine — maschinenlesbar

Das Prüfskript aus T-M0-04 (`scripts/requirements-coverage.mjs`) liest diesen Block. Er
entscheidet, welche Anforderungs-ID **jetzt** einen Test braucht und welche später. Ohne ihn
wäre „gehört zur V1“ Fließtext und nicht auswertbar.

**Die Regel in einem Satz:** Eine ID aus Abschnitt 2 ist **V1-Pflicht**, solange sie weder unter
`v2_only` noch unter `later` steht. Nicht umgekehrt — wer eine Anforderung aufnimmt und diesen
Block vergisst, bekommt eine V1-Pflicht zu viel und ein rotes Tor, nie eine stillschweigend
verschwundene Zusage. Das ist die sichere Richtung des Fehlers. Die unsichere hat am 2026-09-04
das Tor ohne eine Zeile Codeänderung von 82/82 auf 82/100 kippen lassen und damit AK-2
gebrochen (`docs/reports/audit-2026-09-05.md`, Befunde 7, 15, 22).

**Was das Skript aus dem Block macht** (Vertrag, geprüft in `test/requirements.test.ts`):

1. **V1 ist hart.** Fehlt einer V1-Pflicht-ID der Testbeleg, endet der Lauf mit Code 1. Das ist
   die Messgröße von AK-2.
2. **Spätere Meilensteine sind Fortschritt.** Je Meilenstein wird „x von y belegt“ gemeldet,
   ohne Einfluss auf den Exit-Code.
3. **Ein `later`-Eintrag kostet zwei Angaben** — einen Meilenstein, den `tasks.yaml` unter
   `milestones:` deklariert, und eine Begründung, getrennt durch „—“. Fehlt eines von beidem,
   endet der Lauf mit Code 1. Damit ist „ID von Hand ausnehmen“ kein billiger Ausweg, sondern
   eine schriftliche Entscheidung.
4. **Die Buchhaltung wird mitgeprüft:** eine ID im `later`-Fach, die es in Abschnitt 2 nicht
   gibt, ist ein Fehler — sonst verschöbe der Block Anforderungen, die niemand geschrieben hat.

```yaml
scope:
  v2_only: []                       # vollständig gestrichen — derzeit keine ID
  later:                            # "<Meilenstein> — <Begründung>"; Achse: DECISIONS.md, 2026-09-05
    R-TIME-06:  "M15 — Vorspulen bis Ereignis erreicht die Oberfläche (T-M15-06)"
    R-MAP-08:   "M19 — mehrteilige Provinzen; gefunden im Abnahme-Playtest am 2026-09-07 (T-M19-02)"
    R-MAP-09:   "M19 — der Waechter, der den Fehler haette finden muessen (T-M19-01)"
    R-UI-16:    "M20 — die Macht an ihrer Farbe erkennbar (T-M20-02)"
    R-UI-17:    "M20 — Rueckmeldung auf eigene Handlungen (T-M20-04)"
    R-BAT-08:   "M15 — Feuerautomatik und Feuerleitung (T-M15-07)"
    R-TECH-01:  "M15 — Freischaltung nach Spieltag (T-M15-02)"
    R-TECH-02:  "M15 — Freischaltung in der Oberfläche (T-M15-03)"
    R-DIP-06:   "M15 — das Verhältnis steuert die KI (T-M15-05)"
    R-AI-08:    "M15 — die KI nutzt die neuen Mittel (T-M15-08)"
    R-GAME-07:  "M15 — Migration der Spielstände v1 auf v2 (T-M15-04)"
    R-NEWS-04:  "M15 — Weltgeschehen als Filter im Ereignisprotokoll, der Ersatz für die Zeitung (T-M15-09)"
    R-PKG-01:   "M16 — das Erzeugnis wird zum ersten Mal wirklich gebaut (T-M16-03)"
    R-PKG-02:   "M16 — Datei-Port, die Einlösung der Zusage von T-M8-00 (T-M16-04)"
    R-UI-15:    "M16 — gebaut und belegt am 2026-09-07 (T-M16-07); bleibt hier, weil M16 hinter der V1-Abnahme liegt"
    R-SPY-01:   "M17 — Spionage; verschoben am 2026-09-05, Entscheidung 3"
    R-SPY-02:   "M17 — Spionage; verschoben am 2026-09-05, Entscheidung 3"
    R-SPY-03:   "M17 — Spionage; verschoben am 2026-09-05, Entscheidung 3"
    R-SPY-04:   "M17 — Spionage; verschoben am 2026-09-05, Entscheidung 3"
    R-SPY-05:   "M17 — Spionage; verschoben am 2026-09-05, Entscheidung 3"
    R-SPY-06:   "M17 — Spionage; verschoben am 2026-09-05, Entscheidung 3"
    R-DIP-05:   "M17 — Handelsangebote mit Treuhand; erst braucht die bestehende Börse einen Nutzer"
    R-DIP-07:   "M17 — Handel in der Oberfläche; folgt R-DIP-05"
  v1_partial:                       # nur ein Teil gehört zu V1
    R-GAME-02: "V1 nur Punkte- und Eroberungssieg; das Zeitlimit bleibt im Kern und ist nur über eine Konfiguration erreichbar (M18)"
    R-DIP-01:  "V1 nur die sechs Zustände; ausgehandelte Verträge mit Provinz-, Karten- und Tributterm sind M18"
    R-UNIT-08: "V1 nur Fernwirkung vom Flugplatz; Einsatzbefehle mit Rückflug sind M18"
  test_only: [R-ARCH-04]            # kein eigener Produktionscode, aber Test verpflichtend
  # Übergangsliste (T-M14-02b, eingefroren am 2026-09-06). Diese 26 Anforderungen tragen
  # Akzeptanzkriterien, sind aber nur auf Namensebene gebucht: irgendwo steht ein
  # `describe('R-XX-nn …')` mit einer Zusicherung, und welches AK dabei geprüft wurde, hat
  # nie jemand gelesen. Sie sind eine **Schuld mit Namen**, keine Ausnahme ohne Ende: die
  # Liste darf nur schrumpfen (ein Test hält das fest), und wer eine dieser Anforderungen
  # anfasst, benennt seine Testblöcke `R-XX-nn/AK1` und streicht die ID hier.
  # Die übrigen 56 V1-Anforderungen führen gar keine Kriterien — dort gibt es nichts
  # nachzuziehen. Jede NEUE Anforderung wird von Anfang an je Kriterium gebucht.
  name_level:
    - R-ARCH-01
    - R-ARCH-02
    - R-ARCH-03
    - R-ARCH-04
    - R-ARCH-06
    - R-TIME-02
    - R-TIME-03
    - R-FREE-01
    - R-FREE-04
    - R-MAP-02
    - R-MAP-07
    - R-ECON-03
    - R-PROV-01
    - R-PROV-03
    - R-UNIT-04
    - R-UNIT-06
    - R-BAT-07
    - R-DIP-04
    - R-AI-01
    - R-AI-07
    - R-GAME-03
    - R-UI-08
    - R-UI-09
    - R-UI-10
    - R-UI-11
    - R-UI-14
```

### 2.15 Tiefe zwischen den Kriegen (V1.2, aufgenommen 2026-09-04)

Die V1 spielt sich als Folge von Kriegen: Wer nicht kämpft, baut und wartet. Zwischen zwei
Mächten gibt es genau vier Handlungen — Krieg, Frieden, Bündnis, Durchmarsch — und von der
Welt jenseits der eigenen Grenzen erfährt der Spieler nur, was seine Armeen sehen. Tag 1
unterscheidet sich von Tag 40 durch nichts als den Kontostand. Der Rahmen C-04 hatte genau
diese Tiefe auf V2 verschoben: *Diplomatie-Tiefe, Spionage, Forschung, Zeitung, Markt,
Nuklearwaffen*. Dieser Abschnitt holt vier davon in den Umfang und schließt drei Lücken, die
beim Lesen des Codes am 2026-09-04 ans Licht kamen:

1. **„Vorspulen bis Ereignis“ erreicht die Oberfläche nicht.** Der Kern (`fastForward`,
   sechs Ziele, Alarmstopp) und der Simulations-Host können es, die Anleitung verspricht es,
   der Knopf in der Anwendung läuft schlicht einen Spieltag weiter (`step(ticksPerDay)`).
   Dazu erzeugt der Kern das Ereignis `BATTLE_STARTED` nirgends — das Ziel „ein Gefecht
   beginnt“ kann nicht greifen —, und öffentliche Alarme (jede Eroberung irgendwo auf der
   Welt) würden das Vorspulen eines Unbeteiligten anhalten. Ziel Z1 ist damit nur zur
   Hälfte eingelöst. → R-TIME-06.
2. **Die KI beschießt nie.** Kein Pfad in `packages/ai` erzeugt `BOMBARD`; Bündnisse nimmt
   sie nie an, Durchmarsch erwidert sie nie. Beschuss ist ein reiner Spielervorteil — ein
   Bruch von R-AI-01 in die andere Richtung. → R-BAT-08, R-DIP-06.
3. **Die KI erklärt den Krieg nur, wenn ein Nachbar deutlich schwächer ist.** Das Verhältnis
   zwischen zwei Mächten — Ansehen, Verstimmungen, Bündnisse, Kriege gegen Verbündete —
   spielt keine Rolle; `reputation` wird von keiner Zeile gelesen. Noahs Vorgabe vom
   2026-09-04: *die KI muss auch auf Grundlage der Beziehung angreifen können.* → R-DIP-06.

**Nachtrag zu C-04 (2026-09-04):** Spionage, Zeitung, Handel zwischen Mächten und
Forschung — Letztere in der Form, die das gewählte Regelwerk (C-09, D-11) tatsächlich hat:
Supremacy 1914 kennt keinen Forschungsbaum, sondern **Freischaltung nach Spieltag und
Gebäudestufe** (Referenz 1.4, 5.2, 10.1) — wurden hier in den Umfang geholt.

**Auf Umfang gebracht (2026-09-05, Entscheidung 3 in `DECISIONS.md`).** Der Abschnitt
begründet sich mit einem Satz — *Tag 1 unterscheidet sich von Tag 40 durch nichts als den
Kontostand* —, sein Umfang bestand aber zu zwei Dritteln aus Atmosphäre: Spionage allein war
32 % des Akzeptanzbudgets und beantwortet diesen Satz nicht. Was bleibt, ist **M15 „Die KI
wird ein Gegner"**: R-TIME-06, R-BAT-08, R-TECH-01/02, R-DIP-06, R-AI-08, R-GAME-07.
**Nach M17 verschoben:** Spionage (R-SPY-01…06) und die Handelsangebote mit Treuhand
(R-DIP-05, R-DIP-07) — Letztere, weil ein zweiter Handelsweg über einem ersten steht, den
noch niemand benutzt (die KI erzeugte in drei Läufen null `TRADE`). **Gestrichen:** die
Zeitung, ersetzt durch **R-NEWS-04**, einen Filter „Weltgeschehen" im bestehenden
Ereignisprotokoll — Begründung dort. Die drei Anforderungen sind am 2026-09-06 mit
T-M15-09 aus diesem Dokument entfernt worden, nachdem ihr Ersatz stand. Die verschobenen Anforderungen bleiben
unten ausformuliert stehen; ihr Meilenstein steht im `scope`-Block (2.14), nicht im Fließtext.

**Weiterhin vertagt, jetzt auf M18:** Nuklearwaffen (nur im Schwesterspiel belegt,
Referenz 6.7 und 7.11), Lufteinsatzbefehle mit Rückflug (R-UNIT-08, Referenz 7.8),
Koalitionen (Referenz 9.3), Verträge mit Provinz-, Karten- und Tributterm (R-DIP-01,
Referenz 9.4), Gebäude- und Moralschaden durch Beschuss samt Hauptstadtbeute (Referenz 7.7,
3.8), Sammelpunkte und Dauerrekrutierung (in D12 als „frei verfügbar“ zugesagt, bis heute
nicht gebaut — die Zusage bleibt, der Bau folgt in M18), die Verdrahtung des
Hintergrundprozesses (D-03) und der Mehrspielermodus mit fester Startgeschwindigkeit (C-11).
Die **Verpackung als Programm** (Tauri, C-02) ist seit dem 2026-09-05 ein eigener
Meilenstein **M16** mit eigenem Abnahmekriterium.

Vier Regeln gelten für jede Anforderung dieses Abschnitts:
1. **Die KI kann alles, was der Spieler kann** (R-AI-01) — auch das, was die V1 dem Spieler
   schon gab. Eine Mechanik, die nur der Mensch nutzt, ist ein Spielervorteil und damit ein
   Bruch der Zusage „die KI schummelt nicht“, nur in die andere Richtung.
2. **Kein Wissen ohne Quelle** (R-DIP-04). Jedes neue Feld der Sicht nennt, warum der
   Spieler es sehen darf.
3. **Jede Zahl steht in den Regeldateien** (D-08) und in `BALANCING.md` mit Status.
4. **Ein Spielstand der V1 läuft weiter** (R-GAME-05): neue Zustandsfelder kommen mit einer
   Migration, nie mit einer Ablehnung.

#### Die Zusagen der V1 einlösen (`R-TIME`, `R-BAT`)

- **R-TIME-06 — Vorspulen bis Ereignis in der Oberfläche.** Der Vorspulknopf bietet die
  Ziele aus R-TIME-03 (Bau fertig, Armee am Ziel, Gefecht beginnt, Tageswechsel, feste Zahl
  Tage) an, zeigt den Fortschritt, lässt sich abbrechen und hält bei jedem Alarm an, **der
  den Spieler betrifft** — und nur bei dem.
  - AK1: WENN ein Ziel gewählt wird, DANN SOLL die Anwendung den Kern mit genau diesem Ziel
    vorspulen lassen (dieselbe Funktion wie der Simulations-Host, keine zweite Schleife) und
    beim Halt den Grund in Worten nennen.
  - AK2: WENN ein öffentlicher Alarm eintritt, der den Spieler nicht betrifft (eine
    Eroberung zwischen zwei anderen Mächten), DANN SOLL das Vorspulen **nicht** anhalten;
    WENN er ihn betrifft (eigene Provinz, eigene Armee, eigene Hauptstadt, Kriegserklärung
    an ihn, Partieende), DANN SOLL es anhalten.
  - AK3: WENN ein Kampf beginnt, DANN SOLL der Kern `BATTLE_STARTED` mit den Beteiligten
    erzeugen — bisher entsteht das Ereignis nie, obwohl Vorspulziel und Alarmliste es kennen.
  - AK4: WENN die Anwendung über viele Tage vorspult, DANN SOLL sie in Häppchen rechnen und
    zwischen den Häppchen die Ereignisschleife freigeben, damit der Abbruchknopf antwortet
    (die Simulation läuft nach der Entscheidung vom 2026-09-03 im Hauptthread).
  - AK5 (C-11): WENN Zustand und Kern geprüft werden, DANN SOLL kein Tempo, keine Pause und
    kein Vorspulziel darin liegen — alles davon gehört der Hülle (R-ARCH-04/AK2).
- **R-BAT-08 — Feuerautomatik und Feuerleitung.** Nach Referenz 6.5 beschießen untätige
  Fernwaffen selbsttätig den nächsten Feind. Eine stehende Armee mit Fernwaffen beschießt in
  jeder Kampfphase die feindliche Nachbarprovinz mit der größten sichtbaren Truppenstärke,
  sofern sie mit deren Eigentümer im Krieg ist — für Mensch und KI gleichermaßen. Der
  Spieler kann je Armee **Feuer halten** (das ist die in D12 als „frei“ zugesagte
  Feuerleitung, in ihrer kleinsten Form).
  - AK1: WENN eine stehende Armee mit Fernwaffen eine feindliche Provinz in Reichweite hat
    und nicht „Feuer halten“ befohlen ist, DANN SOLL sie ohne Befehl beschießen, mit einem
    Ereignis, das den selbsttätigen Beschuss kennzeichnet.
  - AK2: WENN zwei Ziele gleich stark sind, DANN SOLL die Wahl deterministisch sein
    (kleinste Provinzkennung), und WENN die Seiten vertauscht werden, DANN SOLL das
    Ergebnis gespiegelt sein.
  - AK3: WENN eine KI-Macht Artillerie besitzt und im Krieg ist, DANN SOLL ihre Artillerie
    im Turnier Beschussereignisse erzeugen — die KI beschießt, ohne es lernen zu müssen —
    und ihre Fernwaffenverbände SOLLEN in Reichweite eines Ziels stehen bleiben, statt in
    den Nahkampf zu laufen.

#### Freischaltung (`R-TECH`)

- **R-TECH-01 — Gebäude und Einheiten werden nach Spieltag freigeschaltet.** Jedes Gebäude
  und jede Einheit trägt in den Regeln einen ersten Spieltag (`availableFromDay`); vorher
  lehnt das Spiel den Auftrag ab. Die belegten Tage des Originals (Referenz 1.4: Kaserne
  Tag 1, Hafen Tag 2, Eisenbahn Tag 5, Fabrik Tag 8, Flugplatz Tag 10) werden übernommen,
  die Tage der Einheiten daraus abgeleitet.
  - AK1: WENN ein Bau- oder Aushebeauftrag vor dem ersten Spieltag der Sache erteilt wird,
    DANN SOLL der Kern ihn mit `NOT_YET_AVAILABLE` ablehnen und den Tag nennen, ab dem es
    geht — für Mensch und KI gleichermaßen.
  - AK2: WENN der erste Spieltag erreicht ist, DANN SOLL derselbe Auftrag ohne weitere
    Bedingung angenommen werden.
  - AK3: WENN eine Regeldatei ein Gebäude oder eine Einheit ohne ersten Spieltag enthält,
    DANN SOLL der Lader das mit klarer Meldung ablehnen — ein Tag, der fehlt, wäre still
    Tag 1.
  - *Begründung: Ohne Zeitachse ist Tag 1 wie Tag 40 — wer die Fabrik bezahlen kann, baut
    sie sofort, und der Aufbau einer Macht ist keine Abfolge von Entscheidungen, sondern
    eine Einkaufsliste. C-04 nennt „Forschung“; das Regelwerk kennt stattdessen diese
    Zeitachse, und die wird gebaut statt eines erfundenen Baums.*
- **R-TECH-02 — Der Spieler sieht, was wann kommt.** Ein noch gesperrter Knopf nennt den
  Tag, an dem er frei wird; der Tooltip nennt ihn auch vorher.
  - AK1: WENN ein Bau- oder Aushebeknopf wegen des Spieltags gesperrt ist, DANN SOLL er
    den Tag der Freischaltung in Worten nennen — nicht nur „nicht verfügbar“.
  - AK2: WENN die KI ein Gebäude oder eine Einheit wählt, DANN SOLL sie nichts wählen, was
    heute noch gesperrt ist — ein täglich abgelehnter Befehl ist Rauschen im Protokoll,
    kein Verhalten.

#### Spionage (`R-SPY`)

Nach Referenz 10.2: Spione sind keine Einheiten auf der Karte. Sie werden gegen Geld auf
eine Zielprovinz angesetzt, führen ihren Auftrag einmal je Spieltag aus, kosten je Auftrag
einen täglichen Sold und können von Gegenspionage enttarnt werden. Was das Original gegen
Goldmark sofort verkauft (Referenz 11.1, „Instant Espionage“), gibt es hier ausschließlich
auf diesem Weg — regulär, mit Zeit und Risiko, für alle gleich (R-FREE-02, Kategorie b).

- **R-SPY-01 — Spione anwerben, ansetzen, entlassen.** Ein Spion wird für einen festen
  Geldbetrag angeworben und auf eine Provinz mit einem von vier Aufträgen angesetzt:
  *Aufklärung*, *Wirtschaftssabotage*, *Militärsabotage* (nur fremde Provinzen) oder
  *Gegenspionage* (nur eigene Provinzen). Auftrag und Ziel sind jederzeit änderbar; ein
  Spion ist jederzeit entlassbar; je Macht gibt es eine Regelhöchstzahl.
  - AK1: WENN ein Spion angeworben wird, DANN SOLL der Betrag sofort abgezogen und der
    Spion mit Auftrag, Ziel und Anwerbetag im Spielzustand geführt werden.
  - AK2: WENN das Geld nicht reicht, DANN SOLL der Kern mit `INSUFFICIENT_RESOURCES`
    ablehnen; WENN das Ziel zum Auftrag nicht passt (Sabotage oder Aufklärung in eigener,
    Gegenspionage in fremder Provinz, Sabotage in herrenloser Provinz), DANN SOLL er mit
    `INVALID_TARGET` ablehnen; WENN die Höchstzahl erreicht ist, DANN SOLL er mit
    `QUEUE_FULL` ablehnen.
  - AK3: WENN ein Spion angesetzt wird, DANN SOLL das Ziel eine Provinz sein, die der
    Spieler kennt (sichtbar oder im Aufklärungsgedächtnis) — niemand schickt einen Spion
    in eine Stadt, von der er nie gehört hat.
- **R-SPY-02 — Sold und Tageslauf.** Am Tageswechsel wird je Spion der Sold seines
  Auftrags abgebucht; wer ihn nicht zahlen kann, verliert den Spion. Danach führt jeder
  Spion seinen Auftrag genau einmal aus — frühestens am Tag nach der Anwerbung.
  - AK1: WENN ein Spieltag endet, DANN SOLL für jeden Spion genau einmal Sold abgezogen und
    genau einmal ein Auftrag ausgeführt werden, in fester Reihenfolge und aus dem
    geseedeten Zufall des Zustands (R-ARCH-01).
  - AK2: WENN der Sold nicht gezahlt werden kann, DANN SOLL der Spion aus dem Zustand
    entfernt und der Besitzer mit dem Grund benachrichtigt werden.
  - AK3: WENN ein Spion am selben Tag angeworben wurde, DANN SOLL er an diesem Tageswechsel
    noch nichts ausführen.
- **R-SPY-03 — Aufklärung öffnet den Nebel.** Ein gelungener Aufklärungsauftrag macht
  die Zielprovinz für den Tag sichtbar — einschließlich ihrer Gebäude mit Stufe und der
  Zusammensetzung der dort stehenden Armeen, die der Spieler sonst nur als Stärke sieht.
  - AK1: WENN ein Aufklärungsauftrag gelungen ist, DANN SOLL die Sicht (`publicView`) die
    Zielprovinz als beobachtet führen, mit Gebäuden und Armeezusammensetzung.
  - AK2: WENN der Spion entfernt wird oder der Auftrag misslingt, DANN SOLL die Provinz
    zum nächsten Tageswechsel wieder hinter den Nebel fallen; das Aufklärungsgedächtnis
    behält den letzten Stand (R-DIP-04/AK1).
- **R-SPY-04 — Sabotage trifft, was das Original trifft.** Wirtschaftssabotage senkt bei
  Erfolg die Moral der Zielprovinz um den belegten Betrag (Referenz 4.6: −10) und
  vernichtet einen Teil ihres Tagesertrags beim Eigentümer; Militärsabotage verzögert bei
  Erfolg die laufenden Bau- und Aushebeaufträge der Provinz und deckt die dort stehenden
  Armeen auf. Je Provinz und Tag wirkt höchstens eine Sabotage. Der Betroffene erfährt,
  *dass* etwas geschah, nicht *wer* es war.
  - AK1: WENN Wirtschaftssabotage gelingt, DANN SOLL die Provinzmoral um den Regelwert
    sinken und der Eigentümer den Regelanteil des Tagesertrags dieser Provinz verlieren,
    nie mehr, als er hat.
  - AK2: WENN Militärsabotage gelingt, DANN SOLL jeder laufende Auftrag der Provinz um die
    Regelzahl Stunden später fertig werden.
  - AK3: WENN eine Sabotage gelingt, DANN SOLL der Betroffene ein Ereignis ohne Nennung des
    Urhebers erhalten und der Urheber eines mit dem Ergebnis; das Ereignis des Betroffenen
    SOLL sein Vorspulen anhalten (R-TIME-03), das eines Dritten nicht.
  - AK4: WENN in einer Provinz an einem Tag bereits eine Sabotage gelungen ist, DANN SOLL
    eine zweite an diesem Tag nichts mehr bewirken — sonst fällt jede Provinz binnen einer
    Woche in den Aufstand.
- **R-SPY-05 — Gegenspionage enttarnt.** Ein Gegenspion in einer eigenen Provinz hat je
  Tag eine Regelchance, jeden fremden Spion in derselben Provinz zu enttarnen. Ein
  enttarnter Spion ist verloren, beide Seiten erfahren es, der Urheber verliert Ansehen —
  bei Sabotage gegen eine Macht, mit der er nicht im Krieg ist, doppelt — und der
  Betroffene merkt sich die Verstimmung (R-DIP-06).
  - AK1: WENN ein fremder Spion enttarnt wird, DANN SOLL er entfernt, beide Mächte
    benachrichtigt (mit Nennung der Macht), das Ansehen des Urhebers gesenkt und die
    Verstimmung des Betroffenen gegen den Urheber erhöht werden.
  - AK2: WENN keine Gegenspionage in der Provinz steht, DANN SOLL kein Spion enttarnt werden
    — Sabotage ist dann unsichtbar, und Gegenspionage ist der einzige Schutz.
- **R-SPY-06 — Spionage in der Oberfläche.** Eine Spionageübersicht (Taste `S`) zeigt die
  eigenen Spione mit Auftrag, Ziel, Tagessold und letztem Ergebnis; Anwerben und Umsetzen
  läuft über die Provinzleiste der Zielprovinz (fremd: Aufklärung und Sabotage; eigen:
  Gegenspionage) mit Kosten im Tooltip und Grund bei Sperre; Ergebnisse, Enttarnungen und
  erlittene Sabotage erscheinen als Meldung (R-UI-14) und im Protokoll; jeder Auftrag
  trägt eine Erklärung (R-UI-11) und ein Symbol (R-UI-10).
  - AK1: WENN eine fremde Provinz gewählt ist, DANN SOLL die Provinzleiste das Anwerben
    eines Spions je Auftrag anbieten — gesperrt mit Grund, wenn das Geld fehlt.
  - AK2: WENN eine Sabotage erlitten wurde, DANN SOLL eine Meldung mit Sprungziel erscheinen.

#### Handel und Verhältnis zwischen Mächten (`R-DIP`, Fortsetzung)

- **R-DIP-05 — Handelsangebote zwischen Mächten.** Nach Referenz 9.4 und 3.7: Eine Macht
  bietet einer anderen Rohstoffe oder Geld gegen Rohstoffe oder Geld an. Das Angebotene
  wird beim Angebot hinterlegt (Treuhand) und kehrt bei Ablauf, Ablehnung oder Rücknahme
  zurück; Annahme tauscht sofort. Im Krieg gibt es keinen Handel. Damit ist der in
  R-ECON-05 auf V2 verschobene „Spielermarkt mit Angeboten“ gebaut; der anonyme Umtausch
  bleibt daneben bestehen.
  - AK1: WENN ein Angebot gemacht wird, DANN SOLL die angebotene Menge sofort aus dem
    Bestand in die Treuhand wandern und das Angebot nach der Regelfrist ohne Antwort
    verfallen — mit Rückgabe.
  - AK2: WENN der Empfänger annimmt und die Gegenleistung aufbringen kann, DANN SOLLEN
    beide Seiten im selben Tick tauschen; kann er es nicht, DANN SOLL die Annahme mit
    `INSUFFICIENT_RESOURCES` abgelehnt werden und das Angebot bestehen bleiben.
  - AK3: WENN beide Mächte im Krieg sind (oder es werden), DANN SOLL kein Angebot
    möglich sein und ein offenes Angebot mit Rückgabe verfallen.
  - AK4: WENN ein Tausch zustande kommt, DANN SOLL die Welt davon erfahren, dass die beiden
    Mächte handeln — nicht, wie viel (die Mengen bleiben bei den beiden Parteien).
- **R-DIP-06 — Das Verhältnis steuert die KI: Krieg, Frieden, Bündnis, Durchmarsch.**
  Die KI führt je fremder Macht ein **Verhältnis** aus dem, was sie wissen darf: dem
  öffentlichen Ansehen der Macht, ihren eigenen Verstimmungen (enttarnte Spione gegen sie,
  Überfälle ohne Kriegserklärung, gebrochene Bündnisse), bestehenden Bündnissen und
  gewährtem Durchmarsch, Kriegen der Macht gegen ihre Verbündeten (Kriege sind öffentlich,
  Referenz 10.3) und der Bedrohung an der Grenze. Auf dieser Grundlage — nicht nur, wenn
  ein Nachbar deutlich schwächer ist — erklärt sie den Krieg, tritt für Verbündete ein,
  nimmt Bündnisse an und erwidert Durchmarsch (Referenz 9.5). Ansehen erholt sich je
  Spieltag um einen Regelbetrag bis zum Ausgangswert; Verstimmungen klingen ab.
  - AK1: WENN das Verhältnis zu einer Nachbarmacht unter die Kriegsschwelle der
    Schwierigkeitsstufe fällt und das Kräfteverhältnis die Stufe nicht abschreckt, DANN
    SOLL die KI den Krieg erklären — auch einer gleich starken Macht; WENN das Verhältnis
    gut ist, DANN SOLL sie einen schwächeren Nachbarn **nicht** angreifen, nur weil er
    schwächer ist.
  - AK2: WENN ein Verbündeter der KI angegriffen wird und ihre Fronten es zulassen, DANN
    SOLL sie dem Angreifer den Krieg erklären (Bündnisfall).
  - AK3: WENN eine Macht mit gutem Verhältnis ein Bündnis anbietet, DANN SOLL die KI
    annehmen; WENN das Verhältnis schlecht oder das Ansehen unter der Vertrauensschwelle
    ist, DANN SOLL sie ablehnen. WENN ihr Durchmarsch gewährt wurde und das Verhältnis gut
    ist, DANN SOLL sie ihn binnen der Regelfrist erwidern.
  - AK4: WENN ein Krieg seit der Regelzahl Tage keinen Provinzwechsel mehr gebracht hat und
    das Verhältnis nicht feindselig ist, DANN SOLL die KI Frieden anbieten oder annehmen.
  - AK5: WENN ein Spieltag endet, DANN SOLL das Ansehen um den Regelbetrag Richtung
    Ausgangswert wandern und jede Verstimmung um den Regelanteil abklingen.
  - AK6: WENN die KI eine dieser Entscheidungen trifft, DANN SOLL ihre Erklärung (R-AI-05)
    das Verhältnis und seinen ausschlaggebenden Anteil nennen.
- **R-DIP-07 — Handel in der Oberfläche.** Die Diplomatieübersicht bietet je Macht ein
  Angebotsformular mit Vorschau (Marktwert beider Seiten), listet eingehende Angebote mit
  Annehmen/Ablehnen und ausgehende mit Rücknahme, zeigt das Ansehen der Macht als Balken
  und nennt, welche Mächte miteinander im Krieg liegen; ein eingehendes Angebot meldet sich
  (R-UI-14).
  - AK1: WENN ein Angebot eingeht, DANN SOLL eine Meldung erscheinen, die zur
    Diplomatieübersicht führt, und das Angebot dort mit beiden Seiten in Worten stehen.

#### Weltgeschehen statt Zeitung (`R-NEWS`)

> **R-NEWS-01, R-NEWS-02 und R-NEWS-03 sind am 2026-09-06 gestrichen** — ersatzlos, mit
> **T-M15-09**, das ihren Ersatz gebaut hat. Sie standen bis dahin ausformuliert hier, weil
> eine Zusage nicht verschwindet, bevor das da ist, was an ihre Stelle tritt. Jetzt ist es
> da, und der Text ist weg: eine Anforderung, die niemand mehr baut und die trotzdem im
> Anforderungsdokument steht, wird beim nächsten Lesen wieder zur Zusage. Die Begründung
> steht in `DECISIONS.md` (Entscheidung 3 vom 2026-09-05) und in `02-DESIGN.md`, D19.8 —
> kurz: R-NEWS-02 verbot der Zeitung ausdrücklich Mengen, Vorräte, Truppen und Gebäude, und
> was danach übrig blieb, liegt bereits vollständig im Ereignisprotokoll. Die Zeitung
> hätte ein Zustandsfeld mit Ringpuffer, eine Migration und Text im Simulationshash
> gekostet; der Filter kostet nichts davon.

- **R-NEWS-04 (M15) — Weltgeschehen im Ereignisprotokoll.** Das Ereignisprotokoll (R-GAME-06)
  bekommt einen Filter „Weltgeschehen“. Er zeigt genau die Ereignisarten einer festen
  Positivliste — Kriegserklärung, Wechsel des diplomatischen Zustands, Eroberung, Verlust
  einer Hauptstadt, Aufstand, ausgeschiedene Macht, entschiedene Schlacht, Partieende —,
  gleich, ob sie den Spieler betreffen; alle diese Ereignisse sind bereits öffentlich. Kein
  neues Zustandsfeld, keine Migration, kein Text im Simulationshash.
  - AK1: WENN der Filter „Weltgeschehen“ gewählt ist, DANN SOLL die Liste genau die Ereignisse
    der Positivliste enthalten und kein anderes — als Eigenschaftstest über zufällige
    Ereignisfolgen.
  - AK2: WENN ein Eintrag des Weltgeschehens einen Ort trägt, DANN SOLL ein Klick darauf die
    Karte dorthin führen (R-UI-14/AK1), und der Eintrag SOLL ein deutscher Satz mit Namen
    sein, ohne Kennungen.
  - AK3: WENN ein Ereignis des Weltgeschehens den Spieler nicht betrifft, DANN SOLL es sein
    Vorspulen nicht anhalten (R-TIME-06/AK2) — Weltgeschehen ist Lektüre, kein Alarm.

#### Querschnitt

- **R-AI-08 — Die KI nutzt die neuen Mittel.** Die KI beantwortet vorliegende Angebote nach
  Nutzen und Verhältnis, lässt ihre Fernwaffen wirken (R-BAT-08) und beachtet die
  Freischaltung (R-TECH-01) — alles über dieselben Kommandos wie der Mensch (R-AI-01).
  *(Die Spionageklauseln — Gegenspion in der Hauptstadt, Aufklärung, Sabotage — sind am
  2026-09-06 mit R-SPY nach M17 gezogen und aus Anforderungs- und AK-Text entfernt
  (Entscheidung 3 vom 2026-09-05, begründet in `DECISIONS.md`). Ohne diese Kürzung wäre das
  Integrationstor unerfüllbar: es verlangte Ereignisse einer Mechanik, die in diesem
  Meilenstein gar nicht gebaut wird.)*
  - AK1: WENN eine KI ein Angebot erhält, dessen Gegenwert zum Marktpreis mindestens die
    Regelmarge über dem Gegebenen liegt und das Verhältnis zum Anbieter nicht schlecht ist,
    DANN SOLL sie annehmen; sonst ablehnen — und beides begründen (R-AI-05).
  - AK2: WENN die KI über 200 Spieltage spielt, DANN SOLL sie nie zahlungsunfähig werden
    und keinen Befehl erzeugen, den der Kern wegen der Freischaltung oder eines fehlenden
    Angebots verwirft.
  - AK3: WENN die KI über 200 Spieltage spielt, DANN SOLL sie Fabriken bauen, Artillerie
    ausheben und selbsttätigen Beschuss erzeugen — sonst ist die Feuerautomatik aus
    R-BAT-08 für die KI tot, gleich wie viele Einzeltests grün sind.
- **R-GAME-07 — Spielstände der V1 laufen weiter.** Die neuen Zustandsfelder von M15 —
  **Betroffenheit am Ereignis, Verstimmungen, Feuerleitung** — kommen mit **einer**
  Migration von Version 1 auf 2. *(Spione, Aufklärung und Zeitung standen hier bis zum
  2026-09-06 und sind gestrichen: Spionage ist nach M17 verschoben, die Zeitung durch den
  Filter „Weltgeschehen" ersetzt, der kein Zustandsfeld braucht — beides begründet in
  DECISIONS.md. Eine Anforderung, die Felder nennt, die in ihrem Meilenstein nicht
  entstehen, ist entweder unerfüllbar oder wird stillschweigend kleiner gelesen als sie
  dasteht; das war der Nachtrags-Fehler von 2.15.)*
  - AK1: WENN ein Spielstand der Version 1 geladen wird, DANN SOLL er nach der Migration
    laufen, mit leeren neuen Feldern, und derselbe Stand SOLL nach Speichern und Laden
    hashgleich bleiben (R-GAME-03/AK1).
  - AK2: WENN ein Spielstand geladen wird, DANN SOLL **kein Ladeweg ohne Prüfung** bleiben:
    nach einer Migration prüft `validateState` den Zustand, ohne Migration die Prüfsumme,
    und ein Stand ohne beides wird abgelehnt.

### 2.16 Verpackung als Programm (M16, aufgenommen 2026-09-06) — `R-PKG`

Bis heute ist unbekannt, ob WorldWar überhaupt als Programm startet. C-02 nennt Tauri seit
dem ersten Tag als Ziel, und C-02 ist die einzige Rahmenbedingung, die **nie ausgeführt**
wurde: `@tauri-apps/cli` hat null Treffer im Lockfile, `Cargo.lock` und `src-tauri/target/`
fehlen, das in `tauri.conf.json` verlangte Symbol gibt es nicht, und der einzige Beleg ist
ein Wächter, der zwei JSON-Dateien gegeneinander hält — also die Konfiguration gegen sich
selbst prüft (Befunde 17, 20, 21).

Dieser Abschnitt macht daraus zwei Anforderungen mit Kriterien, damit **AK-8 etwas hat,
worauf es ruht**. Bis zum 2026-09-06 war AK-8 eine Zusage in C-02 und stand in keiner
Abnahmeliste — genau die Fehlerklasse, die M14 abgeräumt hat (die Zusage wurde nie ans
Erzeugnis gebunden), nur in der Zukunftsform.

- **R-PKG-01 — Das Spiel läuft als eigenständiges Programm.** Die Verpackung ist gebaut
  worden, nicht bloß beschrieben.
  - AK1: WENN die Verpackung gebaut wird, DANN SOLL ein startfähiges Erzeugnis entstehen,
    und `Cargo.lock`, das Anwendungssymbol sowie ein Eintrag für `@tauri-apps/cli` im
    Lockfile SOLLEN im Baum liegen. *(Die Zusicherung liest das Erzeugnis, nicht die
    Konfiguration: ein Wächter, der `tauri.conf.json` gegen `capabilities/local-only.json`
    hält, bleibt auch dann grün, wenn nie ein Bau lief.)*
  - AK2: WENN das Erzeugnis läuft, DANN SOLL R-FREE-04 auch dort gelten — keine
    Netzberechtigung, keine ausgehende Verbindung.
- **R-PKG-02 — Spielstände liegen im Dateisystem.** Der Datei-Port, den T-M8-00 zusagte und
  nie baute; die V1 liefert stattdessen IndexedDB (C-02, präzisiert am 2026-09-05).
  - AK1: WENN das Programm läuft, DANN SOLL `createStorage` den Datei-Port wählen, und
    dieser SOLL dieselbe Vertragsreihe erfüllen wie `MemoryStorage` und `IndexedDbStorage`
    — damit erfüllt T-M8-00s Zusage „dieselbe Vertragstestreihe gegen alle drei
    Umsetzungen" zum ersten Mal ihren Wortlaut.
  - AK2: WENN ein Spielstand **außerhalb** des Programms gelöscht wird, DANN SOLL er nicht
    mehr in der Liste stehen. *(Der Beleg, dass wirklich das Dateisystem gelesen wird und
    nicht ein Zwischenspeicher, der zufällig dieselben Namen kennt.)*

Dazu eine Anforderung, die nicht die Verpackung betrifft, aber erst am gebauten Programm
prüfbar ist:

- **R-UI-15 — Bedienbar ohne Maus.** Bis zum 2026-09-07 war nur der Kontrast (R-UI-02) und
  die Tastenzuordnung als reine Funktion (R-UI-06) belegt; **kein Test öffnete einen Dialog
  und schloss ihn** (Befund N12). Seit T-M16-07 tut das `a11y.test.tsx` — einschließlich
  des Fokusfangs, den es vorher gar nicht gab: `aria-modal` sagt einem Vorleseprogramm,
  dass hinter dem Dialog nichts ist, die Tabulatortaste hört nicht darauf.
  - AK1: WENN ein Dialog offen ist, DANN SOLL Escape ihn schließen und der Fokus SOLL im
    Dialog bleiben, solange er offen ist.
  - AK2: WENN ein Bedienelement keinen sichtbaren Text trägt, DANN SOLL es einen Namen für
    Hilfsmittel tragen (`aria-label` oder gleichwertig).

## 3. Abnahmekriterien für V1 (Definition of Done der Version)

V1 gilt als fertig, wenn **alle** Punkte gemessen erfüllt sind:

| ID | Abnahmekriterium |
|---|---|
| **AK-1** | Eine vollständige Partie gegen mindestens 4 KI-Gegner ist von Start bis Sieg/Niederlage spielbar, ohne Absturz und ohne Blockade. |
| **AK-2** | Alle Anforderungen aus Abschnitt 2, die der `scope`-Block **keinem späteren Meilenstein zuweist**, sind durch grüne automatisierte Tests belegt — nachgewiesen dadurch, dass `pnpm coverage:requirements` die Zeile `V1 offen: 0` meldet und mit Exit 0 endet. |
| **AK-3** | Abdeckung: Kern ≥ 90 %, gesamt ≥ 80 %. |
| **AK-4** | Determinismus-, Speicher-/Lade- und Kampf-Eigenschaftstests sind grün. |
| **AK-5** | Guard-Tests für Z2 (keine Monetarisierung) und Z3 (kein Netzwerk) sind grün. |
| **AK-6** | Ein Langlauf (1000 Spieltage, 8 Spieler, kopflos) läuft fehlerfrei durch und hält das Performancebudget ein. |
| **AK-7** | Noah hat einen Playtest nach `docs/PLAYTEST.md` durchgeführt und abgenommen. |

### 3.1 Abnahmekriterium für M16 — nicht Teil der V1

| ID | Abnahmekriterium |
|---|---|
| **AK-8** | Das verpackte Programm startet, schreibt einen Spielstand, wird geschlossen, neu gestartet — und der Stand liegt wieder in der Liste. Belegt durch R-PKG-01/AK1 und R-PKG-02/AK1. |

**Warum es hier steht und trotzdem nicht mitzählt.** C-02 sagt seit dem 2026-09-05: die
Tauri-Verpackung ist M16 „mit eigenem Abnahmekriterium **AK-8**". Bis zum 2026-09-06 war das
eine Zusage ohne Ort: Abschnitt 3 kannte AK-1 bis AK-7, `scripts/acceptance.mjs` prüfte
AK-1 bis AK-5 und AK-7, und **nach AK-8 suchte kein Skript**. Damit war es dieselbe
Fehlerklasse, die M14 abgeräumt hat — die Zusage wurde nie ans Erzeugnis gebunden.

AK-8 bekommt deshalb einen Ort, aber **einen eigenen**: die V1 wird nach AK-1 bis AK-7
abgenommen, und ein AK-8, das gegen die V1 zählte, würde die Abnahme an einen Bau ketten,
der ausdrücklich hinter ihr liegt. Das wäre der Fehler des Nachtrags 2.15 in neuer Gestalt
— dort hatte eine später zugefügte Zeile AK-2 unerfüllbar gemacht. `pnpm acceptance` weist
AK-8 als eigene Zeile mit dem Vermerk „M16, zählt nicht gegen V1" aus und lässt den
Exit-Code unberührt, solange M16 nicht gebaut ist.

## 4. Offene Punkte

Die Mechanik-Referenz liegt vor (`docs/research/SUPREMACY-MECHANICS.md`, 16 Kapitel,
203 Einzelbelege). Belegt sind unter anderem Moraldrift, Produktionsformel, Aufstandsrisiko,
Stapel-Deckel, Streuung im Kampf, Geschwindigkeiten und Ein-/Ausschiffungszeiten.

**Offen bleibt vor allem eines:** die **Angriffs- und Verteidigungswerte der einzelnen
Einheiten**. Sie wurden beim Umbau 2023 mit unbekanntem Faktor neu skaliert und sind nirgends
veröffentlicht. Sie werden begründet geschätzt und über den Parameterlauf (T-M12-00) abgestimmt.
Gleiches gilt für Trefferpunkte je Einheit, Gebäude-Trefferpunkte und die Punkteformel.
Die vollständige Lückenliste steht in Kapitel 14 der Mechanik-Referenz.
