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
| C-02 | **Auslieferung:** Desktop-Anwendung über **Tauri**. Savegames im echten Dateisystem. |
| C-03 | **Karte:** echte Weltkarte, **150–250 Provinzen**, aus frei lizenzierten Geodaten erzeugt. |
| C-04 | **V1-Umfang:** Kern-Loop (Karte, Wirtschaft, Bau, Einheiten, Bewegung, Kampf, Moral, Zeitsteuerung, KI, Sieg/Niederlage, Speichern/Laden). Diplomatie-Tiefe, Spionage, Forschung, Zeitung, Markt, Nuklearwaffen → V2. |
| C-05 | **Zeitsteuerung:** Pause + frei regelbarer Faktor + „Vorspulen bis Ereignis“. |
| C-06 | **UI-Anspruch:** voller Look in Anlehnung an das Original (Militärkarten-Ästhetik, Icons, Animationen, Sound) — mit vorgelagertem **Design-Gate** (Mockup-Freigabe vor Umsetzung). |
| C-07 | **Sprache:** UI und Dokumentation auf Deutsch. Code, Bezeichner und Commit-Messages auf Englisch. |
| C-08 | **Vorgehen:** strikt **TDD** — Test zuerst, dann Implementierung. Kein Produktionscode ohne vorher fehlschlagenden Test. |
| C-09 | **Regelwerk:** Kernmechanik nach **Supremacy 1914 in der Fassung nach dem Umbau vom 10.01.2023** (deterministischer Kampf, Moral mit Ziel- und Istwert, Stapel-Deckel), **Setting und Einheiten modern (WW3)**. Grund: Für dieses Modell liegen belegte Formeln vor. *(Die verlinkte Steam-Anwendung 784950 ist das umbenannte „Conflict of Nations: World War 3“ — ein Schwesterspiel mit eigenem Modell und weitgehend unveröffentlichten Werten.)* |
| C-10 | **Balancing:** belegte Zahlen aus `docs/research/SUPREMACY-MECHANICS.md` werden übernommen; Lücken werden begründet geschätzt und über automatisierte Testpartien abgestimmt. |

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

- **R-ARCH-05 — Testabdeckung.** Simulationskern ≥ 90 % Zeilenabdeckung, Gesamtprojekt ≥ 80 %.
  Unterschreitung lässt die Prüfkette fehlschlagen.

- **R-ARCH-06 — Performance.**
  - AK1: WENN eine Partie mit 200 Provinzen, 8 Spielern und ~400 Armeen simuliert wird, DANN
    SOLL ein Tick im Median unter **0,5 ms** und im 99. Perzentil unter 2 ms dauern.
    *(Nur so ist die interaktive Betriebsart aus R-TIME-02 überhaupt erreichbar; das frühere
    Budget von 5 ms widersprach ihr um den Faktor zehn.)*
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

### 2.5 Wirtschaft (`R-ECON`)

- **R-ECON-01 — Ressourcenmodell.** Ressourcen analog zum Original (Nahrung, Material/Holz,
  Öl, Kohle, Eisen/Stahl, Seltene Rohstoffe) plus **Geld**. Endgültige Liste in `02-DESIGN.md`.
- **R-ECON-02 — Produktion pro Tick** je Provinz, abhängig von Vorkommen, Gebäuden, Moral
  und Bevölkerung.
- **R-ECON-03 — Verbrauch und Mangel.** Armeen und Gebäude verbrauchen Ressourcen.
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
- **R-UNIT-07 — Zustand.** Einheiten haben Stärke/Trefferpunkte und Moral; beschädigte Einheiten
  regenerieren in eigenem Gebiet.

### 2.8 Kampf (`R-BAT`)

- **R-BAT-01 — Kampfauflösung pro Tick** nach dokumentierter Formel, wenn feindliche Armeen in
  derselben Provinz stehen.
- **R-BAT-02 — Klassenmatrix.** Schaden hängt von Angreifer- und Verteidigerklasse ab.
- **R-BAT-03 — Verteidigungsboni** durch Festung, Gelände, Fluss/Küste.
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
- **R-GAME-02 — Siegbedingungen:** Punktesieg, Eroberungssieg, Zeitlimit; Auswahl bei Partiestart.
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

### 2.14 Umfang von V1 — maschinenlesbar

Das Prüfskript aus T-M0-04 liest diesen Block. Er entscheidet, welche Anforderungs-IDs einen
Test brauchen. Ohne ihn wäre „nicht als V2 markiert“ nur Fließtext und nicht auswertbar.

```yaml
scope:
  v2_only: []                       # vollständig auf V2 verschoben — derzeit keine ID
  v1_partial:                       # nur ein Teil gehört zu V1
    R-ECON-05: "V1 nur Umtausch zu dynamischem Preis; Spielermarkt mit Angeboten ist V2"
    R-DIP-01:  "V1 nur die sechs Zustände; ausgehandelte Verträge sind V2"
    R-UNIT-08: "V1 nur Fernwirkung vom Flugplatz; Einsatzbefehle mit Rückflug sind V2"
  test_only: [R-ARCH-04]            # kein eigener Produktionscode, aber Test verpflichtend
```

## 3. Abnahmekriterien für V1 (Definition of Done der Version)

V1 gilt als fertig, wenn **alle** Punkte gemessen erfüllt sind:

| ID | Abnahmekriterium |
|---|---|
| **AK-1** | Eine vollständige Partie gegen mindestens 4 KI-Gegner ist von Start bis Sieg/Niederlage spielbar, ohne Absturz und ohne Blockade. |
| **AK-2** | Alle Anforderungen aus Abschnitt 2, die der `scope`-Block als V1 ausweist, sind durch grüne automatisierte Tests belegt. |
| **AK-3** | Abdeckung: Kern ≥ 90 %, gesamt ≥ 80 %. |
| **AK-4** | Determinismus-, Speicher-/Lade- und Kampf-Eigenschaftstests sind grün. |
| **AK-5** | Guard-Tests für Z2 (keine Monetarisierung) und Z3 (kein Netzwerk) sind grün. |
| **AK-6** | Ein Langlauf (1000 Spieltage, 8 Spieler, kopflos) läuft fehlerfrei durch und hält das Performancebudget ein. |
| **AK-7** | Noah hat einen Playtest nach `docs/PLAYTEST.md` durchgeführt und abgenommen. |

## 4. Offene Punkte

Die Mechanik-Referenz liegt vor (`docs/research/SUPREMACY-MECHANICS.md`, 16 Kapitel,
203 Einzelbelege). Belegt sind unter anderem Moraldrift, Produktionsformel, Aufstandsrisiko,
Stapel-Deckel, Streuung im Kampf, Geschwindigkeiten und Ein-/Ausschiffungszeiten.

**Offen bleibt vor allem eines:** die **Angriffs- und Verteidigungswerte der einzelnen
Einheiten**. Sie wurden beim Umbau 2023 mit unbekanntem Faktor neu skaliert und sind nirgends
veröffentlicht. Sie werden begründet geschätzt und über den Parameterlauf (T-M12-00) abgestimmt.
Gleiches gilt für Trefferpunkte je Einheit, Gebäude-Trefferpunkte und die Punkteformel.
Die vollständige Lückenliste steht in Kapitel 14 der Mechanik-Referenz.
