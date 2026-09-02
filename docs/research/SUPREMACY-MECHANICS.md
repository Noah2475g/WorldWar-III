# Supremacy 1914 / Supremacy: World War 3 — Technische Mechanik-Referenz

**Zweck:** Grundlage für einen Singleplayer-Klon. Alle Zahlen sind mit Belegstatus markiert.
**Stand:** 2026-09-02. **Recherche-Basis:** `docs/research/_raw/` + ergänzende Web-Abrufe.

## Inhalt

| # | Kapitel | Kernaussage |
|---|---|---|
| **0** | [Belegkonvention](#0-belegkonvention) | **Steam-App 784950 = umbenanntes Conflict of Nations**; Bruch durch das Rework vom 2023-01-10 |
| **1** | [Zeitmodell](#1-zeitmodell-priorität--bitte-zuerst-lesen) | 3 Ebenen: kontinuierlich / Combat Tick (1 h) / Day Change; Speed-Multiplikator 1×–4× |
| **2** | [Kartenmodell](#2-kartenmodell) | Provinzgraph mit km-Maßstab; Bewegung nur auf Wegen; Kartengrößen 2–501 Spieler |
| **3** | [Ressourcen & Wirtschaft](#3-ressourcen-und-wirtschaft-supremacy-1914) | 7 Ressourcen in 3 Kategorien; 800 t je Kategorie je Provinz je Tag; Orderbook-Markt |
| **4** | [Moral](#4-moral-priorität) | Current/Target mit Drift 1/7; Produktion = 0,2 + 0,8·Moral; Aufstand = (33−Moral)·3 % |
| **5** | [Gebäude](#5-gebäude-province-upgrades-supremacy-1914) | 9 Gebäude, Spieltag-Gating, Produktionszeit-Matrix, Festungsreduktion 50–90 % |
| **6** | [Einheiten](#6-einheiten-supremacy-1914) | 13 Einheiten; Kosten belegt, **Kampfwerte nicht** |
| **7** | [Kampfsystem](#7-kampfsystem-priorität) | Deterministisch ±10 %; Army-Cap 20→50; Meeting vs. Attack/Defense |
| **8** | [Bewegung](#8-bewegung-priorität) | Vollständige km/h-Tabelle; Bahn ×2,5; Ein-/Ausschiffung 1,5–4,5 h |
| **9** | [Diplomatie](#9-diplomatie) | 6 Zustände; Krieg ohne Karenzzeit; KI übernimmt nach 3 Tagen Inaktivität |
| **10** | [Forschung, Spionage, Zeitung, Sieg](#10-forschung-spionage-zeitung-siegbedingungen) | S1914 **ohne** Forschungsbaum; Index of Power ist **relativ** |
| **11** | [Monetarisierung](#11-monetarisierung-was-echtgeld-konkret-kauft-priorität) | Vollständige Liste Goldmark + High Command mit Klon-Empfehlung je Punkt |
| **12** | [WW3 vs. S1914](#12-unterschiede-supremacy-world-war-3-gegenüber-supremacy-1914) | 30-Zeilen-Vergleichstabelle |
| **13** | [Simulationsschleife](#13-implementierungs-kurzfassung-simulationsschleife) | Pseudocode für Tick-Loop und Day Change |
| **14** | [Offene Fragen](#14-offene-fragen--nicht-belegbar) | 24 Punkte, nach Auswirkung sortiert |
| **15** | [Quellen](#15-quellen) | Alle URLs + lokale Rohdateien |

> **Die vier wichtigsten Abschnitte für die Implementierung:** 1.1 (Zeitebenen), 4.3 (Moralfaktoren), 7.2 (Schadensformel), 8.2 (Geschwindigkeitstabelle).

## 0. Belegkonvention

Jede Zahl trägt eine Markierung:

| Marker | Bedeutung |
|---|---|
| **[B]** | **Belegt** — direkt aus Quelle, Quelle in eckigen Klammern genannt (Datei in `_raw/` oder URL) |
| **[B-alt]** | Belegt, aber **Stand vor dem Combat-Rework 2023-01-10** — Größenordnung gültig, Absolutwerte veraltet |
| **[A]** | **Abgeleitet** — rechnerisch/logisch aus belegten Zahlen gefolgert |
| **[S]** | **Unbekannt – Schätzung nötig** — keine Quelle gefunden |

### 0.1 Wichtige Vorab-Erkenntnis: Was ist App 784950?

**Steam-App 784950 „SUPREMACY: WORLD WAR 3" ist das umbenannte „Conflict of Nations: World War 3"** (Dorado Games / Bytro Labs, Stillfront). **[B]** — belegt durch: die Steam-Seite läuft unter `store.steampowered.com/app/784950/` mit Titel „SUPREMACY: WORLD WAR 3" (`_raw/ww3/steam_784950.txt`), das offizielle Help Center liegt unter `bytro.helpshift.com/hc/en/6-supremacy-ww3/` **und** unter `.../6-conflict-of-nations/` mit identischen Artikel-IDs (z. B. FAQ 323), und die Community-Wikis `conflictofnations.wiki.gg` / `wiki.conflictnations.com` beschreiben exakt dieses Spiel.

**Konsequenz für den Klon:** WW3 ist **kein** direkter Nachfolger von Supremacy 1914 mit gleicher Engine, sondern ein **eigenständiges Bytro-Schwesterspiel** mit anderem Wirtschafts-, Moral- und Kampfmodell (Städte statt Provinzen, Forschungsbaum, Raketen, Echelons). Supremacy 1914 (Steam-App **979920**) ist das eigentliche „Original". Kapitel 12 listet die Unterschiede systematisch.

### 0.2 Der Bruch von 2023: zwei Spielstände in allen Quellen

Am **2023-01-10** hat Bytro das Kampf- und Moralsystem von Supremacy 1914 grundlegend umgebaut **[B: `_raw/hs_288.txt`]**. Fast alle Fan-Wikis beschreiben **noch den Stand davor**. Für den Klon gilt:

- **Vor 2023:** stochastisches System mit „empty rolls" (Fehlschlägen), Size Factors pro Einheitentyp, Overkill-Bonus, Last-Stand-Rabatt, Korruption, Kriegs-Moralstrafe.
- **Ab 2023:** deterministisches System (±10 % Zufall), Schaden gleichmäßig verteilt, ein einziger Army-Damage-Cap, keine Korruption, keine Kriegs-Moralstrafe.

**Empfehlung:** Den **Post-2023-Regelsatz** nachbauen — er ist einfacher, vorhersagbar und besser dokumentiert. Die absoluten Balancing-Zahlen (HP/Damage pro Einheit) wurden dabei mit einem unbekannten Faktor hochskaliert und sind **nicht öffentlich** → **[S]**.

---

## 1. Zeitmodell (Priorität — bitte zuerst lesen)

Supremacy 1914 ist ein **kontinuierliches Echtzeitspiel ohne Züge**. Es gibt drei verschachtelte Zeitebenen:

### 1.1 Die drei Zeitebenen

| Ebene | Intervall | Was passiert | Beleg |
|---|---|---|---|
| **Kontinuierlich** | laufend (Server-Simulation) | Einheitenbewegung entlang Wegen, Ressourcen-Akkumulation, Bau-/Produktionsfortschritt | **[B: `_raw/manual_body.txt`; `_raw/s1914_Economics_and_Resources.txt`]** — „Resources are continuously produced and consumed. The resulting income rate for each resource is given per hour." |
| **Combat Tick** | **exakt 1 Stunde Spielzeit** | Eine Kampfrunde je laufendem Gefecht | **[B: `_raw/manual_body.txt` Z.169]** — „Combat is resolved turn-based with one attack action per hour (also known as a 'combat tick')." |
| **Day Change / Tagesabrechnung** | **1× pro Spieltag** | Moral-Neuberechnung, Aufstände, Spionage-Aktionen, Zeitung, Siegpunkte, Spione-Gehälter, Einheiten-Heilung/Moraldrift | **[B: `_raw/manual_body.txt` Z.48, Z.157, Z.241–242; `_raw/hs_288.txt`]** |

### 1.2 Spielgeschwindigkeit

Die Kartengeschwindigkeit ist ein **fester Multiplikator zwischen Spielzeit und Echtzeit**, beim Anlegen der Runde festgelegt und danach unveränderlich.

| Speed | 1 Spieltag entspricht | Beispiel | Beleg |
|---|---|---|---|
| **1× (Standard)** | 24 h Echtzeit | Gebäude „1 Tag" = 24 h real | **[B: Bytro Help Center FAQ 323 „Why doesn't the speed change on 4x maps?"]** |
| **2×** | 12 h Echtzeit | — | **[B-alt: Forum „Game Speed" Thread 6324]** |
| **4×** | 6 h Echtzeit | 12 h Truppenmarsch = 3 h real | **[B: Bytro FAQ 323]** |
| **3× / 10×** | 8 h / 2,4 h | nur Sonder-/Turnierkarten | **[B-alt: Forum Thread 6324]** |

> **Wichtig:** Der Multiplikator skaliert **alle** Dauern (Bau, Rekrutierung, Bewegung, Combat Ticks). Die im Spiel angezeigten Werte (z. B. „4 Tage Bauzeit") sind **Spielzeit**, nicht Echtzeit. **[B: `_raw/…/318-release-notes---2023-02-21` — „infantry recruitment time … now match real-time hours and are adjusted according to the maps' speed"]**

**Für einen Singleplayer-Klon:** Der Echtzeitbezug ist reines Monetarisierungs-/Retention-Design. **Empfehlung: Spielzeit von Echtzeit entkoppeln** — ein simulierter Tick-Loop mit Pause/Beschleunigung (z. B. 1 Spielstunde = 1 s, pausierbar, bis 100× beschleunigbar). Das Regelwerk bleibt identisch, weil alle Formeln in *Spielstunden* und *Spieltagen* definiert sind.

### 1.3 Zeitpunkt des Day Change

- Supremacy 1914: Day Change zu einer **festen Serverzeit** pro Runde; die verbleibende Zeit steht im „Game Info"-Tab der Zeitung **[B: `_raw/manual_body.txt` Z.213]**. Genaue Uhrzeit/Zeitzone → **[S]**.
- WW3/CoN: Siegpunkte werden **um Mitternacht GMT+1 / CEST+1** aktualisiert **[B: `_raw/ww3/w3_Victory.txt`]**.
- WW3/CoN: **Aufstände** haben pro Stadttyp einen **eigenen, täglich neu gewürfelten Zeitpunkt** innerhalb der 24 h (nicht am Day Change!) **[B: `_raw/ww3/w3_Insurgents.txt`]**.

### 1.4 Freischaltung nach Spieltag (Tech-Gating ohne Forschung)

Supremacy 1914 hat **keinen Forschungsbaum**. Stattdessen werden Gebäude an Spieltage gekoppelt:

| Gebäude | ab Spieltag | Beleg |
|---|---|---|
| Workshop, Recruitment Office, Barracks | Tag 1 | **[B: `_raw/s1914_Workshops` (s1914-Wiki Infobox); `_raw/gm101.txt`]** |
| Harbour | Tag 2 | **[B: s1914-Wiki `Harbour` Infobox]** |
| Railway | Tag 5 | **[B: s1914-Wiki `Railway` Infobox]** |
| Factory | Tag 8 | **[B: s1914-Wiki `Factory` Infobox]** |
| Aerodrome | Tag 10 | **[B: s1914-Wiki `Aerodrome` Infobox]** |
| Fortress | ab Tag 1, Level-abhängig | **[B-alt: `_raw/gm101.txt`]**, genaue Level-Gates → **[S]** |

Daraus folgt implizit die Einheiten-Zeitachse: Armoured Car ab Tag 2, Artillerie ab Tag 8, Panzer ab ~Tag 19–21 **[B-alt: s1914-Wiki `Armoured Car` / `Artillery` / `Tank`]**.

---

## 2. Kartenmodell

### 2.1 Grundstruktur

Die Karte ist ein **Graph aus Provinzen**, kein Hex- oder Kachelraster:

- **Provinz** = Polygon mit genau einem **Provinzzentrum** („center-point", meist eine Stadt). Das Zentrum ist der einzige eroberbare Punkt und Standort aller Gebäude. **[B: `_raw/manual_body.txt`; `_raw/ww3/w2_Provinces.txt`]**
- **Wege/Straßen** verbinden Provinzzentren. **Einheiten bewegen sich ausschließlich auf diesen Wegen und Seerouten** — freie Bewegung über die Fläche gibt es nicht. **[B: `_raw/s1914_Units.txt`]** — „Units move only on the roads and sea routes shown on the map."
- **Nachbarschaft** = „durch einen Pfad verbunden" („connected by a path"). Sie ist **distanzabhängig**: zwei sehr große Provinzen können trotz gemeinsamer Grenze zu weit auseinanderliegen, um sich Moral-Nachbarschaftsboni zu geben. **[B: `_raw/s1914_Morale.txt`]**
- **Distanzen sind metrisch in km**, Geschwindigkeiten in km/h. Die Karte hat also einen echten Maßstab. **[B: `_raw/s1914_Units.txt` Speed-Tabellen; Reichweiten in km]**
- **Hauptstadtdistanz wird als Luftlinie gemessen**, nicht entlang von Wegen — Bahnstrecken und Ein-/Ausschiffungszeiten ändern sie nicht. **[B: `_raw/s1914_Morale.txt`]**

**Datenmodell-Empfehlung [A]:**
```
Province { id, name, polygon, centerPoint{x,y}, owner, isCoastal,
           resourceType, isDoubleResource, morale, targetMorale,
           buildings[], neighbours[] }
Edge     { fromProvinceId, toProvinceId, lengthKm, type: LAND|SEA }
```

### 2.2 Provinztypen (Supremacy 1914)

| Typ | Bedeutung | Beleg |
|---|---|---|
| **Einfach-Ressourcenprovinz** | 1 Ressourcen-Icon, Basisproduktion | **[B: `_raw/s1914_Economics_and_Resources.txt`]** |
| **Doppel-Ressourcenprovinz** | 2 Icons desselben Typs, **exakt doppelte** Produktion **und doppelte Infanterie-Rekrutierungsrate** | **[B: `_raw/s1914_Morale.txt`; `_raw/s1914_Barracks` (s1914-Wiki)]** |
| **Küstenprovinz** | erlaubt Harbour-Bau; Ein-/Ausschiffung | **[B: s1914-Wiki `Harbour`]** |
| **Hauptstadt** | genau 1 pro Nation, verlegbar | **[B: s1914-Wiki `Capital`]** |
| **Internationales Gebiet / Meer** | Durchmarsch löst **keinen** Krieg aus | **[B: `_raw/w_warfare.txt`]** |

Ein Startland besteht aus **10 Provinzen**, davon **2 Doppel-Ressourcenprovinzen**. **[B: `_raw/s1914_Economics_and_Resources.txt`]** Jede Provinz ist auf **eine** der drei Kategorien (Food / Material / Energy) fokussiert.

### 2.3 Kartengrößen und Spielerzahlen (Supremacy 1914)

**[B: Forum-Thread 1994 „Map Information", via Websuche zusammengefasst — Originalforum aktuell 502]**

| Karte | Spieler | Provinzen |
|---|---|---|
| Mexico and USA 1914 | 2 | 36 |
| Battle for Western Europe | 4 | 106 |
| Battle of the Balkans | 6 | 76 |
| Europe 1910 Historic | 8 | 163 |
| **Europe 1914** („10p map") | **10** | **163** |
| South America 1914 | 10 | 117 |
| Tournament Island | 10 | 226 |
| South-East Asia | 15 | 188 |
| Middle East 1914 | 30 | 393 |
| **The Great War** („31p map") | **31** | **367** |
| Shattered America | 43 | **[S]** |
| **World in Flames** | **100** | **1.036** |
| **The Great War (500p)** | **501** | **5.071** |

> Diese Zahlen stammen aus einer Forum-Übersicht; ein direkter Abruf war nicht möglich (Cloudflare 502). Als **[B]** mit Vorbehalt einstufen — Provinzzahlen können sich durch Patches verschoben haben.

**Skalierung mit Kartengröße [B: `_raw/s1914_Morale.txt`]:** Reichweiten und Moral-Distanzstrafen sind **kartengrößenabhängig**. Beispiel Artillerie-Reichweite: **50 km auf der 10p-Karte**, **133 km auf der 31p-Karte**. Railgun: 150 km (10p und 31p), 400 km auf einer großen Karte. Battleship: 75 km (10p), 200 km (31p).
> **Implementierungshinweis [A]:** Reichweiten sind offenbar als *Bruchteil der Kartenausdehnung* definiert und werden in km umgerechnet — nicht als feste km-Werte.

### 2.4 Kartenmodell WW3 / CoN

Deutlich anders: **Provinzen vs. Städte** sind getrennte Konzepte.

| Element | Eigenschaften | Beleg |
|---|---|---|
| **Province** (ohne Stadt) | eigene Bauliste (Combat Outpost, Airfield, Field Hospital, Local Industry, Military Logistics, Pontoon), **50 %** Ressourcenrate, **rebelliert nie** | **[B: `_raw/ww3/w2_Provinces.txt`; `_raw/ww3/w3_Production.txt`; `_raw/ww3/wg_Morale.txt`]** |
| **Homeland City** | Startstädte, **100 %** Ressourcenrate, Zielmoral 90 % | **[B: dito]** |
| **Occupied City** | erobert: **25 %** Rate, **keine** Einheitenproduktion, Zielmoral 60 % | **[B: dito]** |
| **Annexed City** | für Geld annektiert: **50 %** Rate, Einheitenproduktion möglich, Zielmoral 60 %; verliert Status bei Rückeroberung | **[B: dito]** |
| **Population** | Städte/Provinzen haben eine **Bevölkerungszahl**, die Basisproduktion **und** Siegpunktwert bestimmt; wächst moralabhängig | **[B: `_raw/ww3/w2_Provinces.txt`]** |
| **Terrain-Typen** | modifizieren Attack/Defense/Speed/HP je Einheit | **[B: `_raw/ww3/wiki_Combat.txt`]**, konkrete Werte → **[S]** |

Kartengrößen WW3: **bis 140 Spieler auf der größten Karte** **[B: `_raw/ww3/steam_784950.txt`]**. Flashpoint Europe: 30 spielbare + 29 KI-Nationen; World War III: 64 spielbare Nationen **[B: `_raw/ww3/wg_Maps.txt`]**.

---

## 3. Ressourcen und Wirtschaft (Supremacy 1914)

### 3.1 Die 7 Ressourcen + Geld

**[B: `_raw/manual_body.txt` Z.82; `_raw/s1914_Economics_and_Resources.txt`]**

| Ressource | Kategorie | Spezifischer Verbrauch | Folge bei Mangel |
|---|---|---|---|
| **Grain** (Getreide) | Food | **20 t / Einheit / Tag**; **1.000 t / Barracks-Level / Tag** | Truppenmoral sinkt; Barracks werden deaktiviert |
| **Fish** (Fisch) | Food | kein Eigenbedarf | — |
| **Iron Ore** (Eisenerz) | Material | kein Eigenbedarf (nur Baukosten) | — |
| **Lumber** (Holz) | Material | kein Eigenbedarf | — |
| **Coal** (Kohle) | Energy | **500 t / Railway / Tag** | Railways stellen Betrieb ein bis repariert |
| **Oil** (Öl) | Energy | **5 Barrel / Einheit / Tag** | Mobilization sinkt → Tempo **und** Stärke der Armeen fallen |
| **Gas** | Energy | kein Eigenbedarf | — |
| **Money (£)** | — | Gebäude-Upkeep, Spione, Baukosten | Gebäude fallen aus |
| **Goldmark** | Premium | — | siehe Kapitel 11 |

### 3.2 Kategorie-Grundbedarf (der eigentliche Wirtschaftsmotor)

**[B: `_raw/s1914_Economics_and_Resources.txt`]**

> **Jede Provinz verbraucht pro Tag 800 t Food + 800 t Material + 800 t Energy = 2.400 t gesamt.**

Entscheidend: **Innerhalb einer Kategorie ist die Ressource frei wählbar.** Der Spieler stellt per **Schieberegler** ein, welcher Anteil des Kategoriebedarfs mit welcher Ressource gedeckt wird (z. B. Energiebedarf zu 100 % aus Gas, um Kohle und Öl zu schonen). **[B: dito]**

Wird eine Kategorie nicht gedeckt → **Moralverlust in allen Provinzen** (Details in 4.4).

### 3.3 Produktionsformel

**Post-2023 (empfohlen) [B: `_raw/hs_288.txt`]:** Lineare Kurve
```
produktionsFaktor(morale) = 0.20 + 0.80 * (morale / 100)      // morale in 0..100
```
- 100 % Moral → 100 % Produktion = **3.150 t/Tag** (Einfachprovinz) bzw. **6.300 t/Tag** (Doppelprovinz)
- 0 % Moral → 20 % Produktion = **630 t/Tag** bzw. **1.260 t/Tag**

**[B: `_raw/s1914_Morale.txt`, Abschnitt „edited as of May 2024", der explizit auf `hs_288` verweist]**

**Pre-2023 (nur zur Einordnung) [B-alt: `_raw/s1914_Morale.txt`]:**
```
basis_einfach = morale * 24 + 750
basis_doppel  = morale * 48 + 1500
```
Break-even gegen die 2.400 t Verbrauch lag bei **69 % Moral** (Einfach) bzw. **19 %** (Doppel).

### 3.4 Gebäudeboni auf Produktion

**[B: `_raw/s1914_Morale.txt`]** — Boni sind **additiv auf die Basis**, nicht multiplikativ untereinander:
```
gesamt = basis
       + basis * railwayBonus      // 0.33 wenn aktive Railway
       + basis * harbourBonus      // 0.25 wenn Harbour
       + basis * factoryBonus      // 0.0825 pro Factory-Level (siehe unten)
```
Fehlt ein Gebäude, geht sein Bonus als 0 ein. Beschädigte Gebäude liefern **anteilig weniger** Bonus (proportional zu fehlenden HP) **[B: `_raw/s1914_Morale.txt`]**.

*Rechenbeispiel aus der Quelle (pre-2023-Basis):* Einfachprovinz, 25 Moral, mit Railway + Harbour →
`1350 + 1350*0.33 + 1350*0.25 = 2133 t/Tag`.

**Factory-Produktionsbonus:** 8,3 % pro Level **[B-alt: s1914-Wiki `Factory` Infobox]**, präzisiert auf **8,25 % pro Level** durch In-Game-Test Mai 2024 **[B: s1914-Wiki `Factory`, Kommentar „updated as of May 2024, source: in game testing"]**.
> **Achtung:** Das Release-Update 2023-02-21 änderte die Factory-Boni erneut („production bonus of 100 % added to lvl 1 Factories; bonuses for lvl 2–4 increased") **[B: Bytro Release Notes 2023-02-21]** — dort geht es allerdings um den **Produktionsgeschwindigkeits**-Bonus für Einheiten, nicht den Ressourcenbonus. Trennschärfe unklar → **[S]**.

### 3.5 Korruption (entfernt)

Pre-2023 verlor jede Provinz bei großem Reich einen Teil ihrer Produktion **[B-alt: `_raw/manual_body.txt` Z.84]**. **Post-2023 ersatzlos gestrichen** **[B: `_raw/hs_288.txt`]** — die Rolle übernimmt jetzt die **Expansions-Moralstrafe** (siehe 4.3).

### 3.6 Lager

- **Kein Lagerlimit** dokumentiert. Ressourcen akkumulieren unbegrenzt; Bilanz wird als Rate pro Stunde angezeigt. **[B: `_raw/s1914_Economics_and_Resources.txt`]**
- Ressourcen können **negativ** werden — daraus entsteht die Shortage-Moralstrafe. **[B: `_raw/s1914_Morale.txt`]**
- Handelslimits: **Geld max. 100.000**, **Ressourcen max. 30.000** pro Direkt-Trade. **[B: `_raw/manual_body.txt` Z.201]**

### 3.7 Markt (Stock Market)

**[B: `_raw/manual_body.txt` Z.91–101; `_raw/s1914_Economics_and_Resources.txt`]**

- Anonymer, **globaler Orderbook-Markt** für alle 7 Ressourcen gegen Geld. Buy- und Sell-Orders, Teilausführung möglich, offene Orders stornierbar.
- Preis wird als **Quotient** notiert: `@ 3.0` bedeutet **1.000 Einheiten kosten 3.000 Geld**. Kleinerer Quotient = besseres Angebot.
- Bei Verkaufsangebot werden die Ressourcen **sofort vom Bestand abgezogen** und gelten als „active" bis Ausführung/Storno.
- Preise entstehen rein aus Angebot/Nachfrage der Spieler + KI-Nationen. Eisen ist früh teuer (Festungsbau), später billig.
- **Embargo / Krieg blockiert den Handel** zwischen den betroffenen Nationen. **[B: `_raw/manual_body.txt` Z.101]**
- **Goldmark-Kauf umgeht den Markt: fixer Kurs @ 0.5 → 5.000 Ressourcen für 2.500 Goldmark.** **[B: `_raw/manual_body.txt` Z.98]** ← Premium-Vorteil, siehe Kapitel 11.

### 3.8 Geld / Steuern

- Jede Provinz erzeugt **Steuereinnahmen**, die **nicht** vom Kategorieverbrauch aufgezehrt werden. **[B: `_raw/manual_body.txt` Z.87]**
- Bei Eroberung einer Provinz erhält der Angreifer **die gesamte Tagesproduktion und einen Teil der Steuereinnahmen**. **[B: `_raw/manual_body.txt` Z.70]**
- Bei Eroberung einer **Hauptstadt**: **die Hälfte der Geldreserven** des Gegners. **[B: `_raw/manual_body.txt` Z.74]**
- Konkrete Steuerformel (Geld/Provinz/Tag) → **[S]**.

### 3.9 Ressourcen WW3 / CoN (völlig anderes Modell)

**[B: `_raw/ww3/w3_Production.txt`; `_raw/ww3/wg_Gold.txt`]** — 6 Ressourcen + Geld, **keine Kategorien**, jede hat feste Verwendung:

| Ressource | Verwendung |
|---|---|
| **Supplies** | Forschung + Bau; die meiste Infanterie, Support, Officers, Frühspiel-Einheiten |
| **Components** | Bau + Mobilisierung fast aller Armored/Naval/Air-Einheiten |
| **Manpower** | **alle** Einheiten (Mobilisierung + Upkeep), Annexion von Städten |
| **Rare Materials** | **alle Forschung**, Stealth, U-Boote, Raketen, Arms Industries |
| **Fuel** | Upkeep aller Einheiten, Bauten in Städten, Airfields, Military Logistics, Raketensprengköpfe |
| **Electronics** | alle Gebäude außer Bunker; fahrzeuggebundene Einheiten |
| **Money** | alles; einzige Handelswährung am Markt |

Produktionsrate wird **nach allen Boni** durch den Provinz-/Stadttyp gedeckelt (100 / 50 / 25 %, siehe 2.4).

---

## 4. Moral (Priorität)

Moral ist das **zentrale Kopplungsglied** zwischen Militär, Wirtschaft und Politik. Sie existiert auf zwei Ebenen: **Provinzmoral** und **Einheitenmoral**.

### 4.1 Zwei-Werte-Modell und Drift

Jede Provinz hat **zwei** Moralwerte **[B: `_raw/s1914_Morale.txt`]**:

- **Current Morale** — der aktuelle Wert, bestimmt Produktion, Bauzeit, Aufstandsrisiko.
- **Target Morale** (= "max morale", "Moraltrend") — Zielwert aus allen Boni/Strafen.

**Am Day Change driftet Current in Richtung Target:**

```
// Version A - Fan-Wiki, präzise:
current += (target - current) / 7                 // 1/7 der Lücke pro Tag
// [B: _raw/s1914_Morale.txt]

// Version B - offizielles Handbuch:
current += (target - current) * 0.20..0.25        // 20-25 % der Lücke pro Tag
// [B: _raw/manual_body.txt Z.63]
```

> **Widerspruch in den Quellen.** 1/7 ~ 14,3 % vs. 20-25 %. Das Handbuch ist älter (beschreibt teils Pre-2023-Stand), das Fan-Wiki wurde 2024 aktualisiert. **Empfehlung: 1/7 als Startwert, Konstante konfigurierbar machen.** **[A]**

**Ausgangswerte [B: `_raw/s1914_Morale.txt`; `_raw/manual_body.txt` Z.70-71]:**

| Situation | Moralwert |
|---|---|
| Basis-/Grundmoral aller Provinzen (Zielwert ohne Modifikatoren) | **102** |
| Spielstart, alle Provinzen | **70** |
| Frisch eroberte Provinz | **25** |
| Rückeroberung eigener Provinz, die vorher > 80 hatte | **automatisch auf 75** |
| Rückeroberung, wenn der neue Besitzer sie schon > 80 gebracht hatte | normal **25** |

### 4.2 Wirkungen der Provinzmoral

**[B: `_raw/s1914_Morale.txt`; `_raw/hs_288.txt`]**

| Wirkung | Formel (post-2023) |
|---|---|
| **Ressourcenproduktion** | `0.20 + 0.80 * morale` -> 0 % Moral = 20 %, 100 % = 100 % **[B: `_raw/hs_288.txt`]** |
| **Bau-/Produktionsgeschwindigkeit** | lineare Kurve: **100 % Moral -> 110 % Speed**, **80 % Moral -> 100 % Speed (Basis)**, **0 % Moral -> 20 % Speed** **[B: `_raw/hs_288.txt`]** |
| **Auto-Rekrutierungszeit (Infanterie)** | linear: **100 % -> 100 % Speed**, **0 % -> 20 % Speed** **[B: `_raw/hs_288.txt`]** |
| **Infanterie-Hitpoints** | Neu rekrutierte Infanterie startet mit **HP proportional zur Provinzmoral**. Beispiel: 75 Moral -> 15/20 HP. **[B: `_raw/s1914_Morale.txt`]** |
| **Aufstandsrisiko** | siehe 4.5 |

**Pre-2023-Zahlen zur Einordnung [B-alt: `_raw/s1914_Morale.txt`]:** Basis-Bauzeit war bei **80 Moral** definiert; 25 Moral -> **2,2x** so lange; 100 Moral -> **10 % weniger**. Infanterie-Rekrutierung dauerte bei 25 Moral **4x** so lange wie bei 100.

### 4.3 Faktoren auf die Target Morale (vollständige Liste)

**[B: `_raw/s1914_Morale.txt` — Stand 2024; ergänzt durch `_raw/hs_288.txt` und `_raw/manual_body.txt`]**

**Boni:**

| Faktor | Wert |
|---|---|
| **Nachbarprovinzen (positiv)** | **+1** je volle 10 Moralpunkte, die eine per Pfad verbundene Provinz **über 80** liegt — pro Nachbar. *Bsp.: 3 Nachbarn mit je 100 Moral -> +6.* |
| **Fortress** | **+5 pro Level** (Lvl 5 -> **+25**) |
| **Railway (aktiv)** | **+15** (deaktiviert: 0) |
| **Harbour** | **+10** |
| **Factory** | **+4 pro Level** (Lvl 4 -> **+16**) |
| **Capital** | **+10** **[B-alt: s1914-Wiki `Capital` Infobox]** |
| **Eroberung einer feindlichen Hauptstadt** | **+10 sofort auf alle eigenen Provinzen** (Instant, nicht Target) |

> **Widerspruch:** Die alten Wiki-Infoboxen nennen abweichende Werte (Fortress +5 %/Lvl, Railway +7...10 %, Harbour +7...10 %, Factory +2,5 %/Lvl). Diese sind **Pre-2023** und in *Prozent* statt Punkten notiert. **Die Punktwerte oben (2024er Stand) sind maßgeblich.** **[A]**

**Strafen:**

| Faktor | Wert |
|---|---|
| **Nachbarprovinzen (negativ)** | **-1** je volle 10 Moralpunkte, die ein Nachbar **unter 80** liegt — pro Nachbar. *Bsp.: 3 Nachbarn mit je 40 Moral -> -12.* |
| **Feindliche Nachbarprovinzen** | **-5 pro verbundener Provinz** einer Nation, mit der man im Krieg ist (entfällt bei grosser Distanz) |
| **Feindliche Armeen im Gebiet** | **-1 pro feindlicher Einheit**, **gedeckelt bei -30** |
| **Hauptstadtdistanz** | max. **-35**, kartengrößenabhängig (siehe 4.4) |
| **Expansion** | ab **6 %** aller Karten-Provinzen im Besitz beginnend, linear steigend bis **50 %** Besitz -> dann max. **-35** |
| **Keine Hauptstadt** | **-40** auf alle Provinzen (zusätzlich zum Sofort-Malus -20); hebt die Hauptstadtdistanz-Strafe auf, bis eine neue Hauptstadt fertig ist |
| **Ressourcenknappheit** | ungedeckelt, siehe 4.4 |
| **Krieg ("at war")** | **Pre-2023: -X pro Kriegsgegner. Post-2023 ersatzlos entfernt.** **[B: `_raw/hs_288.txt`]** |

### 4.4 Zwei Sonderfälle im Detail

**Hauptstadtdistanz** **[B: `_raw/s1914_Morale.txt`; `_raw/hs_288.txt`]** — gemessen als **Luftlinie**, nicht Wegstrecke; Bahn hilft nicht.

*Post-2023-Definition (allgemein):* Strafe beginnt bei **Range 200**, erreicht Maximum bei **~50 % der größeren Kartendimension (Breite oder Höhe)**, Maximum **-35**.

*Aeltere, kartenspezifische Messung (in "Tagesreisen"):*

| Karte | erster Strafpunkt ab | Steigerung |
|---|---|---|
| **500p (The Great War 500)** | 0,6 Tage Distanz | +1 je weitere 0,3 Tage -> 3 Tage = -9 |
| **100p (World in Flames) / 43p (Shattered America)** | 0,4 Tage | +1 je weitere 0,1 Tage -> 2 Tage = -17 |
| **31p (The Great War)** | ab 0 | +1,5 je 0,1 Tage -> 1 Tag = -15 |

**Ressourcenknappheit** **[B: `_raw/s1914_Morale.txt`]** — zwei Stufen:

1. **Drohende Knappheit:** Wird ein Vorrat in den nächsten **14 Stunden** vollständig aufgebraucht, greift bereits eine Strafe. Schwere hängt ab von (a) Distanz der Provinz zur Hauptstadt und (b) wie bald die Erschöpfung eintritt. Sofort behebbar (Markt kaufen / Slider umstellen).
2. **Echte Knappheit:** Ist der Vorrat bereits **negativ**, wird die Target Morale **jeden Day Change weiter beschädigt**. Schwere skaliert mit der Höhe des Negativstands und mit der Hauptstadtdistanz. **Kein Cap.** Wird das nicht korrigiert, führt es kaskadierend zu Aufständen in den Aussenprovinzen.

Knappheit wird auf **Kategorieebene** ausgewertet: Food (Grain, Fish), Material (Iron, Wood), Energy (Coal, Oil, Gas).

### 4.5 Aufstände / Revolts

**[B: `_raw/s1914_Morale.txt`; `_raw/manual_body.txt` Z.65]**

```
revoltChance% = max(0, (33 - morale) * 3)        // morale in 0..100
// 0 Moral -> 99 % (Quelle nennt "bis zu 96 %")
```
- Schwelle: **unter 33 Moral** (Handbuch nennt "< 30 %" — geringfügiger Widerspruch, **[A]** 33 verwenden, da neuere Quelle).
- **Unterdrückung:** Es wird eine **Land-Defense-Stärke in Höhe des Prozentwerts** in der Provinzmitte benötigt, um einen Aufstand garantiert zu verhindern. *Bsp.: 10 Moral -> 69 % Chance -> Ground Defense 69 nötig.*
- Folgen: Garnisonstruppen werden beschädigt oder vernichtet, oder die **Provinz wechselt den Besitzer**.
- Die für Unterdrückung nötige Stärke und der Aufstandsschaden wurden 2023 mit umskaliert **[B: `_raw/hs_288.txt`]** -> Absolutwerte heute unbekannt **[S]**.

### 4.6 Sofortwirkende Moralereignisse (Instant, nicht Target)

**[B: `_raw/s1914_Morale.txt`; `_raw/manual_body.txt` Z.70-78]**

| Ereignis | Wirkung |
|---|---|
| Provinz erobert | Provinz auf **25** gesetzt |
| **Eigene** Hauptstadt verloren | **-20 auf alle** eigenen Provinzen (sofort) **plus -40 Target** (dauerhaft); Handbuch nennt zusätzlich "maximale Moral aller Provinzen -40 %" |
| **Feindliche** Hauptstadt erobert | **+10 auf alle** eigenen Provinzen (die eroberte Hauptstadt selbst startet bei 25) |
| Spion, Economic Sabotage | Chance auf **-10** Moral, beliebig oft stapelbar |
| Instant-Espionage (Goldmark) | **-10** Moral sofort |
| Goldmark-Moralboost | **+10 %** für **500 Goldmark** **[B: `_raw/manual_body.txt` Z.68]** |
| **Einheitenbeschuss auf das Provinzzentrum** | jede Einheit fügt **1/25 ihres höchsten Schadenswerts** als Moralschaden zu. *Bsp.: Tank mit 30 Ground Damage -> 1,2 Moralschaden.* **[B: `_raw/s1914_Morale.txt`]** |

> **Post-2023-Präzisierung [B: `_raw/hs_288.txt`]:** Einheiten haben jetzt **dedizierte Building-Damage- und Morale-Damage-Werte**. Gebäude und Provinzmoral werden **nur beschädigt, wenn das Provinzzentrum angegriffen wird**. Die 1/25-Regel ist damit der Pre-2023-Stand; die neuen Werte sind pro Einheit einzeln konfiguriert -> **[S]**.

### 4.7 Einheitenmoral / Condition

**[B: `_raw/manual_body.txt` Z.148-159]**

- **Infanterie hat Moral**; **mechanische Einheiten** (Artillerie, Panzer, Armoured Car, Heavy Tank, Railgun, Battleship, Flugzeuge, U-Boote, Ballons) haben stattdessen einen **Condition-Wert**. Für Condition gelten weitgehend dieselben Regeln.
- **Startmoral** = Moral der Provinz, in der die Einheit ausgebildet wurde.
- **Drift**: Einheitenmoral driftet zur Moral der Provinz, in der sie steht, mit **1/5 (20 %) der Differenz pro Day Change** **[B: `_raw/s1914_Morale.txt`]**.
- **Condition-Regeneration**: auf eigenem Territorium (Marine: überall) **ca. +17 % der Differenz zu 100 % pro Tag** **[B: `_raw/manual_body.txt` Z.157]**.
- **Nahrungsmangel** senkt Einheitenmoral. **Feindliches Territorium** senkt sie ebenfalls.
- **Siege/Niederlagen** gaben pre-2023 kleine Moralboni/-mali — **post-2023 entfernt** **[B: `_raw/hs_288.txt`]**.
- **Merging**: Beim Zusammenlegen wird der **Durchschnitt** aller Moral-/Condition-Werte gebildet.

### 4.8 Mobilization (Oelversorgung)

**[B: `_raw/manual_body.txt` Z.175; `_raw/w_warfare.txt`]**

Ein separater Wert neben Moral. Skaliert **linear** sowohl **Bewegungstempo** als auch **Schadensausstoss**. Sinkt bei Oelmangel (5 Barrel/Einheit/Tag). Bewegung auf **Bahnstrecken benötigt kein Oel** **[B: `_raw/w_warfare.txt`]**.
> Post-2023 wurde die anfängliche Mobilization-Beschränkung der ersten Spieltage entfernt **[B: `_raw/hs_288.txt`]**. Genaue Kurve -> **[S]**.

### 4.9 Moralmodell WW3 / CoN (zum Vergleich, deutlich anders)

**[B: `_raw/ww3/wg_Morale.txt`]** — hier sind die Formeln sogar **exakter dokumentiert** als bei S1914:

```
// Ressourcenproduktion
produktion = morale * 0.8 + 0.25          // morale als 0..1
// 25 % -> 0.45 | 70 % -> 0.81 | 90 % -> 0.97 | 100 % -> 1.05

// Bau-/Mobilisierungszeit
zeitFaktor = 1                            wenn morale > 90 %
zeitFaktor = 1 / (0.75 + 0.25*(x-25)/65)  wenn 25 % < x < 90 %
zeitFaktor = 1.3333                       wenn morale < 25 %
```

**Zielmoral nach Typ:** Homeland City 90 %, Annexed City 60 %, Occupied City 60 %, Province 100 %. HQ-Stadt erreicht schnell 100 %.

**Modifikatoren (Auszug, alle [B: `_raw/ww3/wg_Morale.txt`]):**

| Faktor | Wert |
|---|---|
| Ressourcenknappheit | bis **-50** |
| Zivile Opfer (Kriegsverbrechen) | max. **-30**, baut sich um **1/3 pro Tag** ab |
| HQ verloren | **-20** sofort auf alles |
| Nachbarmoral <= 40 % (x Nachbarn) | **-7x** für Städte, **-4x** für Provinzen |
| Nachbarmoral 100 % (x Nachbarn) | **+3x** für Städte, **+x** für Provinzen |
| Distanz zum HQ (x) | **-5x** |
| Feindliche Nachbarprovinzen (x) | **-5x** |
| Im Krieg mit x Nationen | **-2x**, max. **-25** |
| Feindliche Einheiten in der Provinz | **-1** |
| Underground Bunkers Lvl 1-5 | **+5 / +10 / +20 / +35 / +50** |
| Relocate Headquarters | **+25** |
| Combat Outpost / Field Hospital Lvl 1-3 | **+10 / +13 / +15** |

**Aufstände (Insurgents)** **[B: `_raw/ww3/w3_Insurgents.txt`; `_raw/ww3/wg_Morale.txt`]**: Risiko ab **<= 33 %** Moral, stark erhöht unter **25 %**; bei 25 % beträgt die Chance **50 %**. **Provinzen rebellieren nie — nur Städte.** Rebellen erscheinen als eigene "Nation" im Ranking, expandieren aber nicht über eroberte Städte hinaus. Der Aufstands-Zeitpunkt wird **pro Stadttyp einmal täglich zufällig** gewürfelt.

---

## 5. Gebäude (Province Upgrades, Supremacy 1914)

Grundregeln **[B: `_raw/manual_body.txt` Z.104-108]**:

- Jedes Gebäude kann **nur einmal pro Provinz** gebaut werden, manche in mehreren Leveln.
- **Produktivitätsboni sind nicht kumulativ multiplikativ** — jeder Prozentsatz wird auf die *Basisproduktion* angewandt und dann addiert (siehe 3.4).
- Gebäude können **an-/abgeschaltet** werden, um Upkeep zu sparen.
- In manchen Provinzen kann der **Harbour an mehreren Stellen** platziert werden — nur einer pro Provinz, Position beeinflusst Logistik.
- **Post-2023:** Gebäude nehmen **Schaden bei Eroberung der Provinz** **[B: `_raw/hs_288.txt`]**. Es gibt einen **10-HP-Puffer**, bevor ein beschädigtes Gebäude seine Hauptfunktion verliert **[B: Bytro Release Notes 2023-02-21]**.
- **Post-2023:** Gebäude sind im Fog of War verborgen, bis die Provinz gescoutet oder per Spion aufgedeckt wird (temporär) **[B: `_raw/hs_288.txt`]**.
- **Post-2023:** Workshop und Factory sind **getrennte Gebäude** und können gleichzeitig in einer Provinz stehen **[B: `_raw/hs_288.txt`]**.

### 5.1 Gebäudetabelle

Alle Kosten/Zeiten **[B-alt: s1914-Wiki Infoboxen `Capital`, `Recruitment Center`, `Barracks`, `Workshops`, `Factory`, `Fortress`, `Harbour`, `Railway`, `Aerodrome`]** — Stand vor 2023, Größenordnung weiterhin gültig. Moralwerte in Punkten **[B: `_raw/s1914_Morale.txt`, 2024]**.

| Gebäude | ab Tag | Bauzeit | Max Lvl | Kosten (pro Level) | Moral | Produktion | Upkeep/Tag | Sonstige Wirkung |
|---|---|---|---|---|---|---|---|---|
| **Capital** | 1 | 2 Tage | 1 | 2.000 GBP, 5.000 Eisen, 5.000 Holz | **+10** | — | — | genau 1 pro Nation, verlegbar; Verlust = Katastrophe (4.6) |
| **Recruitment Office** | 1 | **5 Minuten** | 1 | 1.000 GBP, 250 Eisen, 250 Holz | — | — | **250 GBP** | rekrutiert passiv Infanterie, **bis +100 %** Rekrutierungsrate |
| **Barracks** | 1 | 1 Tag/Level | 2 | 4.000 GBP, 1.500 Getreide, 1.500 Holz | — | — | **1.000 Getreide + 500 GBP pro Level** | Lvl 1: **+50 %**, Lvl 2: **+150 %** Rekrutierung **[B: Release Notes 2023-02-21, Erhöhung von +100 % auf +150 %]**; ermöglicht **Kavallerie** |
| **Workshop** | 1 | **L1: 15 Sek**, L2: 30 Min | 2 | 1.000 GBP, 500 Eisen, 500 Holz, 500 Oel | — | — | — | ermöglicht **Armoured Car**; L1 **+50 %**, L2 **+100 %** Produktionsgeschwindigkeit; **L2 ist Voraussetzung für Factory** |
| **Factory** | **8** | 2 Tage | **4** | 10.000 GBP, 2.500 Eisen, 2.500 Holz, 2.500 Oel | **+4/Level** (max +16) | **+8,25 %/Level** | — | schaltet mechanisierte Einheiten frei, verkürzt Produktionszeit (5.2) |
| **Fortress** | 1 | 1 Tag/Level | **5** | 4.000 GBP, 2.000 Eisen | **+5/Level** (max +25) | — | — | **Schadensreduktion** (5.3); ab **Lvl ~3,5** werden Truppen vor gegnerischer Sicht verborgen |
| **Harbour** | 2 | 3 Tage | 1 | 10.000 GBP, 10.000 Holz | **+10** | **+25 %** | — | nur Küstenprovinzen; **-50 % Ein-/Ausschiffungszeit**; Voraussetzung für Marineeinheiten |
| **Railway** | 5 | 3 Tage | 1 | 10.000 GBP, 5.000 Holz, 3.000 Eisen, 1.000 Kohle | **+15** | **+33 %** | **500 Kohle** | **+150 % Bewegungstempo** in der Provinz; ermöglicht Railgun-Bewegung; **abschaltbar** |
| **Aerodrome / Airbase** | 10 | 1 Tag | 1 | 5.000 GBP, 2.000 Holz, 2.000 Gas | — | — | — | **Start/Landung** von Flugzeugen; **nicht** nötig zur Produktion von Flugzeugen |

> **Widerspruchs-Hinweis Aerodrome:** Die Fighter-Seite sagt "an aerodrome is required to operate aircraft, **not** to produce them", die Bomber-Seite sagt das Gegenteil, die Factory-Seite sagt "You do **not** need an aerodrome to build fighters and bombers". **[A] Mehrheitsentscheidung: Aerodrome nur zum Starten nötig, nicht zur Produktion.**

**Mindest-Moralvoraussetzungen für den Bau** **[B: Bytro Release Notes 2023-02-21]** — Werte nach der Senkung:

| Gebäude | Mindestbedingung |
|---|---|
| Railroad | **50** (vorher 60) |
| Barracks Lvl 1 | **30** (vorher 40) |
| Harbor | **50** (vorher 60) |

Für die übrigen Gebäude -> **[S]**.

### 5.2 Produktionszeiten je Gebäudestufe (die eigentliche Tech-Tabelle)

**[B: s1914-Wiki `Factory`, Tabelle; post-2023-Struktur mit getrenntem Workshop]** — Zeiten in **Spielzeit**, zusätzlich moralmoduliert (4.2).

| Einheit | Voraussetzung | WS 1 | WS 2 | Fabrik 1 | Fabrik 2 | Fabrik 3 | Fabrik 4 |
|---|---|---|---|---|---|---|---|
| **Cavalry** | Barracks | 2 Tage | 1 Tag | 1 Tag | 12 h | 8 h | 6 h |
| **Armoured Car** | — | 2 Tage | 1 Tag | 1 Tag | 12 h | 8 h | 6 h |
| **Artillery** | — | — | — | 4 Tage | 2 Tage | 1 T 8 h | 1 Tag |
| **Balloon** | — | — | — | 4 Tage | 2 Tage | 1 T 8 h | 1 Tag |
| **Light Cruiser** | Harbour | — | — | 4 Tage | 2 Tage | 1 T 8 h | 1 Tag |
| **Tank** | — | — | — | — | 3 Tage | 2 Tage | 1 T 12 h |
| **Fighter** | Airbase* | — | — | — | 3 Tage | 2 Tage | 1 T 12 h |
| **Submarine** | Harbour | — | — | — | 3 Tage | 2 Tage | 1 T 12 h |
| **Heavy Tank** | — | — | — | — | — | 2 T 16 h | 2 Tage |
| **Railgun** | Railway | — | — | — | — | 4 Tage | 3 Tage |
| **Bomber** | Airbase* | — | — | — | — | 3 T 8 h | 2 T 12 h |
| **Battleship** | Harbour | — | — | — | — | 4 Tage | 3 Tage |

\* siehe Widerspruchs-Hinweis oben.

Zusätzlich **[B: Release Notes 2023-02-21]**: "Minimum production time of units was reduced by 10 %" und der Deckel für hohe Provinzmoral bei Lvl-4-Fabriken wurde aufgehoben (max. Moral wirkt jetzt auch dort).

**Wichtig:** Pro Provinz kann **immer nur eine Einheit gleichzeitig** produziert werden. **[B: `_raw/s1914_Units.txt`]**

### 5.3 Festungen: Schadensreduktion

**[B: Bytro Release Notes 2023-02-21 — zeigt beide Stände]**

| Level | Reduktion **vor** 2023-02 | Reduktion **ab** 2023-02 |
|---|---|---|
| 1 | 67 % | **50 %** |
| 2 | 80 % | **60 %** |
| 3 | 86 % | **70 %** |
| 4 | 89 % | **80 %** |
| 5 | 91 % | **90 %** |

Die Reduktion gilt nur, solange die Festung **unbeschädigt** ist — Schaden an der Festung verringert ihren Effekt anteilig **[B-alt: s1914-Wiki `Fortress`]**. Ab **Lvl ~3,5** verbirgt die Festung Stärke, Moral, Anzahl und Zusammensetzung der stationierten Truppen **[B: Release Notes 2023-02-21]**.

### 5.4 Gebäude in WW3 / CoN (Uebersicht)

**Stadt-Gebäude [B: `_raw/ww3/b_*.txt`, `_raw/ww3/w2_Provinces.txt`]:** Arms Industry, Army Base, Air Base, Naval Base, Recruiting Office, Military Hospital, Underground Bunkers, Secret Weapons Lab, Headquarters (Relocate HQ), Annexed City (Annexion als "Bau").

**Provinz-Gebäude [B: `_raw/ww3/w2_Provinces.txt`]:**

| Gebäude | Wirkung |
|---|---|
| **Combat Outpost** | befestigte Stellung, senkt Angreiferstärke, **+Moral**; wird bei Eroberung zerstört |
| **Airfield** | Flugzeug-/Airmobile-/Airlift-Operationen; **ab 40 % HP funktionsfähig**; bei Eroberung zerstört |
| **Field Hospital** | erhöht Heilrate (Lvl 1-3 = +1/+2/+3 HP/Tag), **+Moral** |
| **Local Industry** | nur sinnvoll in Ressourcenprovinzen; erhöht Ressourcen (nicht Manpower/Money) |
| **Military Logistics** | erhöht Bodentempo in der Provinz |
| **Pontoon** | nur Küstenprovinzen; erlaubt Ein-/Ausschiffung; ab 40 % HP funktionsfähig |

**Heilraten [B: `_raw/ww3/wiki_Combat.txt`]:** Basis in eigenen Städten **+1 HP/Tag/Einheit**; Military Hospital Lvl 1-5 = **+1 bis +5 HP/Tag**; Provinzen Basis **+0**, Field Hospital Lvl 1-3 = **+1 bis +3**; Marineeinheiten in Küstengewässern **+2 HP/Tag** (nur ausserhalb des Kampfes); Flugzeuge auf einem Träger in Küstengewässern ebenfalls +2.

**Bunker [B: `_raw/ww3/wiki_Combat.txt`]:** schützen Bevölkerung vor Massenvernichtungswaffen; geschützte Bevölkerung = **2 x Bunkerlevel**; geschützter Anteil nimmt keinen Schaden, solange der Bunker steht.

---

## 6. Einheiten (Supremacy 1914)

**13 Einheitentypen in drei Zweigen: Land, Luft, See** **[B: `_raw/manual_body.txt` Z.110]**.

Grundregeln:
- Pro Provinz läuft **eine Produktion gleichzeitig**. **[B: `_raw/s1914_Units.txt`]**
- Alle Landeinheiten kosten **20 t Getreide + 5 t Oel Upkeep pro Einheit und Tag**. **[B: `_raw/w_warfare.txt`; `_raw/s1914_Economics_and_Resources.txt`]**
- Land- und Lufteinheiten werden auf See automatisch zu **Transportschiffen**; Flugzeuge ohne Flugplatz zu **Transport-LKW**. **[B: `_raw/s1914_Units.txt`; `_raw/hs_288.txt`]**
- **Stack-Benennung nach Anzahl** **[B: `_raw/s1914_Units.txt`]**: Brigade (0-10), Division (10-19), Corps (20-49), Army (50+). Beim Zusammenlegen erbt der Stack die **niedrigste Nummer**.
- **Infanterie: 20 HP = 1.000 Soldaten**, also **1 HP = 50 Soldaten**. **[B: supremacy1914-Wiki `Infantry`]**

### 6.1 Kosten, Voraussetzungen, Reichweiten

Quellen: **[B-alt: s1914-Wiki und supremacy1914-Wiki Einheiten-Infoboxen]**. Wo die beiden Wikis abweichen, sind beide Werte genannt.

| Einheit | Klasse | Kosten | Voraussetzung | Bauzeit (Basis) | Reichweite | Sicht |
|---|---|---|---|---|---|---|
| **Infantry** | Land | **keine direkten Baukosten** — passiv rekrutiert | Recruitment Office / Barracks | moral- und gebäudeabhängig | Nahkampf (hat dennoch kleine Reichweite) | Standard |
| **Cavalry** | Land | **[S]** | Barracks + Workshop/Factory | 2 Tage (WS1) ... 6 h (F4) | Nahkampf | Standard |
| **Armoured Car** | Land | 7.000 GBP, 2.000 Eisen, 1.500 Oel | **Workshop Lvl 1** | 2 Tage (WS1) / 1 Tag (WS2) | Nahkampf | Standard |
| **Artillery** | Land, Ranged | 10.000 GBP, 3.000 Eisen, 2.000 Oel | **Factory Lvl 1** | 4 Tage / Fabriklevel | **50 km** (10p-Karte), **133 km** (31p-Karte) | Standard |
| **Tank** | Land | 20.000 GBP, 5.000 Eisen, 3.000 Oel | **Factory Lvl 2** | 4-6 Tage / Fabriklevel | Nahkampf | Standard |
| **Heavy Tank** | Land | **[S]** | **Factory Lvl 3** | 2 T 16 h (F3) / 2 T (F4) | Nahkampf | Standard |
| **Railgun** | Land, Ranged | 50.000 GBP, 10.000 Eisen, 5.000 Holz, 5.000 Kohle, 10.000 Oel | **Factory Lvl 3 + Railway** | 12 Tage / Fabriklevel | **150 km** (10p & 31p), **400 km** (Grosskarte) | Standard |
| **Balloon** | Luft (Aufklärung) | 5.000 GBP, 1.000 Holz, 1.000 Gas | **Factory Lvl 1** | 4 Tage | — | **300 km** |
| **Fighter** | Luft | 20.000 GBP, 2.500 Eisen, 5.000 Holz, 5.000 Oel | **Factory Lvl 2** | 3 Tage | Nahkampf ("effektiv 5 km") | Patrouillenradius |
| **Bomber** | Luft | 50.000 GBP, 5.000 Eisen, 7.500 Holz, 10.000 Oel | **Factory Lvl 3** | 5 Tage | größer als Railgun | Patrouillenradius |
| **Light Cruiser** | See, Ranged | 15.000 GBP, 3.000 Eisen, 2.000 Kohle, 2.000 Oel | **Factory Lvl 1 + Harbour** | 4 Tage / Fabriklevel | **40 km** | Standard |
| **Submarine** | See, Stealth | 15.000-20.000 GBP, 3.000 Eisen, 2.000 Kohle *oder* Holz, 2.000-3.000 Oel | **Factory Lvl 2 + Harbour** | 3-6 Tage / Fabriklevel | **Nahkampf (melee)** | Standard |
| **Battleship** | See, Ranged | 50.000 GBP, 15.000 Eisen, 5.000 Holz, 10.000 Kohle, 5.000 Oel | **Factory Lvl 3 + Harbour** | 4 Tage (F3) / 3 Tage (F4) | **75 km** (10p), **200 km** (31p) | **90 km** |

**Reichweiten-Referenz aus dem Battle-Calculator [B: dxcalc.com/share/s1914.info.html]:** Artillery 50, Railgun 150, Cruiser 40, Battleship 75 (Werte der Standardkarte). Flugzeuge gelten als Nahkampfeinheiten mit effektiv 5 km.

### 6.2 Kampfwerte — WARNUNG: keine belastbare aktuelle Quelle

Es existieren **zwei widersprüchliche Wertesysteme** in den Fan-Wikis, und **beide sind vor dem Rework 2023-01-10 entstanden**. Bytro hat damals "die Hitpoint- und Damage-Werte aller Einheiten und Gebäude mit einem Faktor multipliziert" und danach viele Einheiten einzeln neu balanciert **[B: `_raw/hs_288.txt`]**. **Die heutigen Absolutwerte sind nicht öffentlich dokumentiert.** -> **[S]**

**System A (s1914-Wiki, ältere Skala) [B-alt]:**

| Einheit | Strength Land / See / Luft |
|---|---|
| Infantry | 1 (moralabhängig) |
| Armoured Car | 1,2 / 0,4 |
| Artillery | 1,5 |
| Tank | 4 / 0,4 |
| Railgun | 3 / 0,5 |
| Balloon | 0,5 / — / 1,5 |
| Fighter | 0,4 / 0,4 / **4** |
| Bomber | 0,4 / 0,4 / **6** |
| Light Cruiser | 2 |
| Submarine | 4 |
| Battleship | **200 HP, 40 Durchschnittsschaden** |

**System B (supremacy1914-Wiki, neuere Skala) [B-alt]:**

| Einheit | Strength |
|---|---|
| Infantry | 4 |
| Artillery | 8 |
| Tank | 4 |
| Railgun | 20 / 6,7 |
| Battleship | 6 |
| Submarine | 4 |
| Balloon | 0,5 / 0,4 (See) |

**Belastbare Einzelwerte (konkret genannte Schadenszahlen) [B-alt]:**

| Quelle | Aussage |
|---|---|
| s1914-Wiki `Fighter` | Fighter: **20 Schaden gegen Flugzeuge**, **5 gegen Boden/See**, **1 gegen Gebäude** |
| s1914-Wiki `Bomber` | Bomber: **30 gegen Boden/See**, **6 gegen Gebäude**, **3 gegen Flugzeuge** |
| supremacy1914-Wiki `Morale` | "ein Tank macht **30 Ground Damage**" |
| `_raw/manual_body.txt` Z.133 | Flugzeuge **am Boden ohne Flugplatz**: Fighter nutzt **10 %**, Bomber **7 %** seines Wertes |

> **Empfehlung für den Klon [A]:** Ein eigenes, in sich konsistentes Wertesystem definieren. Die *Relationen* aus System A/B übernehmen (Tank ~4x Infanterie, Bomber stärkster Bodenangreifer, Fighter dominiert die Luft, U-Boot 2x Light Cruiser, Battleship 3x Light Cruiser **[B-alt: supremacy1914-Wiki `Battleship`, `Submarine`]**) und die Absolutzahlen frei skalieren.

### 6.3 Schadensklassen (Damage Categories)

**[B: `_raw/manual_body.txt` Z.170-176; `_raw/hs_288.txt`]** — der Schaden einer Einheit hängt ab von:

1. **Terrain der Einheit** (Land / See / Luft) — z. B. **Lufteinheiten auf 10 % am Boden**, **Infanterie auf 17 % zur See**.
2. **Zielklasse**: normal / air / buildings — **post-2023 zusätzlich eine eigene Naval-Kategorie** und **dedizierte Building-Damage- und Morale-Damage-Werte**.
3. **Angriff vs. Verteidigung**: jede Einheit hat getrennte Attack- und Defense-Werte; manche sind besser im Angriff, andere in der Verteidigung.
4. **Einheiten-Moral / Condition** (linear, siehe 7.2).
5. **Mobilization** (linear).
6. **Stack-Größe** (siehe 7.3).

### 6.4 Damage Area (Zielverteilung, post-2023)

**[B: Bytro Release Notes 2023-02-21]** — Einheiten mit wenigen Basis-HP wurden "ausweichfähiger" gemacht, damit eingehender Schaden stärker auf HP-starke Einheiten fällt:

| Einheit | Damage Area vorher | nachher |
|---|---|---|
| Infantry | 1 | **0,5** |
| Cavalry | 1 | **0,75** |
| Transport Ship | 1 | **0,75** |

Interpretation **[A]:** "Damage Area" ist ein Trefferflächen-/Gewichtungsfaktor bei der Schadensverteilung innerhalb eines Stacks. Wer eine größere Area hat, zieht anteilig mehr Schaden. Die Werte aller übrigen Einheiten -> **[S]**.

### 6.5 Sonderfähigkeiten

| Einheit | Fähigkeit | Beleg |
|---|---|---|
| **Submarine** | **Stealth**: unsichtbar, solange sie nicht angreift. Wird im Kampf sichtbar, taucht danach wieder ab und kann nicht mehr von Fernwaffen anvisiert werden. Aufdeckbar durch **patrouillierende Fighter**, **Spione**, **Ballons** (seit 2023-02) oder direkte Berührung. | **[B: `_raw/manual_body.txt` Z.143-147; Release Notes 2023-02-21]** |
| **Fortress Lvl >= ~3,5** | verbirgt stationierte Truppen komplett | **[B: Release Notes 2023-02-21]** |
| **Balloon** | Sichtweite 300 km (= Railgun-Reichweite auf 10p); kann Truppen als Schutzschirm gegen Bomber dienen; seit 2023-02 auch U-Boot- und Festungsaufklärung | **[B-alt: s1914-Wiki `Balloons`; B: Release Notes 2023-02-21]** |
| **Fighter (Patrol)** | sammelt Aufklärung, deckt versteckte Einheiten auf, greift automatisch feindliche Flugzeuge im Patrouillenradius an, **sofern diese einen Attack- oder Patrol-Befehl haben** (reine Move-Befehle werden nicht angegriffen) | **[B: `_raw/manual_body.txt` Z.135-136]** |
| **Bomber** | muss nach jedem Angriff **zur Basis zurückfliegen, um neue Bomben zu laden** | **[B: `_raw/manual_body.txt` Z.138]** |
| **Railgun** | kann sich nur in Provinzen mit **funktionierender Railway** bewegen; feuert auch weiter, wenn die Bahn verloren geht. **Bei Ein-Schuss-Kill wird das nächste Ziel nach 60 Sekunden statt 60 Minuten anvisiert.** | **[B-alt: supremacy1914-Wiki `Railgun`]** |
| **Artillery** | **Auto-Bombardement**: untätige Fernwaffen beschiessen automatisch den nächsten Feind | **[B: `_raw/manual_body.txt` Z.167]** |

### 6.6 Sichtweiten / Aufklärung

**[B: `_raw/w_warfare.txt`]**
- Feindliche Armeen sind ab **150 km** sichtbar.
- **Details** (Größe, Moral, Zusammensetzung) erst ab **90 km**.
- Ballon: **300 km** Sichtweite.
- Battleship: **90 km** Sichtweite bei 75 km Reichweite.

### 6.7 Einheiten WW3 / CoN (Uebersicht)

**11 Einheitenklassen [B: `_raw/ww3/wg_Units.txt`]:** Infantry, Armored, Support, Helicopters, Fighters, Heavies, Naval, Submarines, Missiles, Officers, Seasons.

Wichtige Struktur-Unterschiede zu S1914:
- **Nur Infanterie (ausser Special Forces) kann Territorium erobern.** **[B: `_raw/ww3/wg_Units.txt`; `_raw/ww3/w2_Provinces.txt`]**
- Einheiten werden **erforscht** und in **Tiers** verbessert; eine Verbesserung upgradet **automatisch alle bestehenden Einheiten des Typs**. **[B: `_raw/ww3/wg_Research.txt`]**
- **Officers** als eigene Unterstützungsklasse.
- **Missiles** (Cruise / Ballistic / ICBM) mit konventionellen, chemischen und nuklearen Sprengköpfen. Nur **Cruise Missiles** können Einheiten anvisieren und verfolgen; **Ballistic/ICBM treffen nur Provinzzentren**. **[B: `_raw/ww3/wiki_Combat.txt`]**
- **Echelons** (1st/2nd/3rd) steuern die Schadensverteilung im Stack: Frontlinien-Einheiten (Mercenaries, MBT, Tank Destroyer) ziehen mehr Schaden, Rear Guard weniger. **[B: `_raw/ww3/wiki_Combat.txt`]**
- **Stealth**-Einheiten können fremdes Territorium **ohne Kriegserklärung** infiltrieren. **[B: `_raw/ww3/w3_Field_of_View.txt`]**

---

## 7. Kampfsystem (Priorität)

### 7.1 Auslösung von Kämpfen

**[B: `_raw/manual_body.txt` Z.163-167]** — Kampf beginnt in drei Fällen:

1. Expliziter **Attack-Befehl** auf feindliche Armee oder Provinzhauptstadt.
2. Man wird selbst so angegriffen und verteidigt sich.
3. **Automatisch**, wenn die eigene Armee den Weg einer feindlichen Armee kreuzt oder an der Hauptstadt einer feindlichen Provinz vorbeikommt. Gewinnt man, setzt die Armee den vorherigen Befehl fort.

Zusätzlich: **Auto-Bombardement** untätiger Fernwaffen auf das nächstgelegene Ziel.

> **Post-2023-Änderung [B: Bytro Release Notes 2023-02-21]:** "Untätige Armeen initiieren nicht mehr automatisch Kämpfe, egal wo sie stehen. Fernkampfarmeen wie Artillerie sind davon nicht betroffen." Das heißt: **Nahkampfeinheiten greifen nicht mehr von selbst an, Fernkampfeinheiten schon.**

Ob ein Kampf ausgelöst wird, hängt vom diplomatischen Status ab (siehe 9.2).

### 7.2 Schadensberechnung (post-2023, empfohlenes Modell)

**[B: `_raw/hs_288.txt`]** — das ist der wichtigste Abschnitt für den Klon:

```
// Pro Combat Tick (1 Spielstunde), pro Armee:

1. Basisschaden = Summe der Angriffs- bzw. Verteidigungswerte aller Einheiten
                  im Stack gegen die Zielklasse

2. Skalierung pro Einheit:
     * terrainFaktor        (Land/See/Luft; z.B. Luft am Boden 10 %,
                             Infanterie zur See 17 %)
     * moralFaktor          (nur Infanterie, linear; siehe unten)
     * healthFaktor         100 % HP -> 100 % Schaden
                            0 %  HP -> 50 % Schaden      (linear)
     * mobilizationFaktor   (linear mit Ölversorgung)

3. Army Damage Cap (Stack-Größe):
     <= 20 Einheiten : jede Einheit trägt 100 % bei
     20..50 Einheiten: Beitrag zusätzlicher Einheiten fällt LINEAR auf 0 %
     >= 50 Einheiten : zusätzliche Einheiten tragen nichts mehr bei

4. Zufall: * (1 ± bis zu 0.10)      // ±10 %, KEINE Fehlschläge mehr

5. Verteilung: Schaden wird GLEICHMÄSSIG auf die Einheiten
   des Zielstacks verteilt (gewichtet über "Damage Area", siehe 6.4).

6. Verluste: Einheiten sterben abhängig davon, wie viel eingehender
   Schaden im Verhältnis zu ihren verbleibenden HP steht.
```

**Moralkurve für Infanterie [B: `_raw/manual_body.txt` Z.172]:** Bei maximaler Moral voller Schaden, danach **linear fallend bis 55 % Moral**; unter 55 % wird der Schaden **nicht weiter reduziert**.

**Entfernte Pre-2023-Mechaniken, die man NICHT nachbauen sollte [B: `_raw/hs_288.txt`]:**

| Mechanik | War | Ist |
|---|---|---|
| **Empty Rolls** | Angriffe konnten komplett danebengehen | entfernt — kein Miss mehr |
| **Size Factors** | jeder Einheitentyp hatte eigene Stapel-Grenze | entfernt — ein einziger Army-Cap für alle |
| **Flowering Exploit** | Aufteilen in viele kleine Stacks umging Schadensgrenzen | unterbunden |
| **Last Stand** | kleine Armeen bekamen Schadensrabatt | entfernt |
| **Overkill** | massive Überlegenheit gab Extraschaden | entfernt |
| **Schaden „one by one"** | gesamter Stack-Schaden traf **eine** feindliche Einheit, Überschuss ging an die nächste | ersetzt durch **gleichmäßige Verteilung** |

> Die Beschreibung "units will fall one by one, excess damage applied to next unit in line" in `_raw/manual_body.txt` Z.176 ist damit **veraltet**. **[A]**

### 7.3 Stack-Größe: die zentrale Balancing-Bremse

```
beitrag(n) = 1.0                          für n <= 20
beitrag(n) = 1.0 - (n - 20) / 30          für 20 < n < 50
beitrag(n) = 0.0                          für n >= 50
```
**[B: `_raw/hs_288.txt`]** — "units contribute 100 % strength up to 20 units. Above 20 units the strength added by additional units linearly drops to 0 % until the army size reaches 50."

Das ist die wichtigste taktische Regel des Spiels: **Der Sweet Spot liegt bei ~20 Einheiten pro Stack**, jenseits von 50 ist jede weitere Einheit reiner Ballast (kostet Upkeep, trägt nichts bei — absorbiert aber Schaden).

### 7.4 Angriffs- vs. Verteidigungsschaden (Engagement-Typen)

**[B: `_raw/manual_body.txt` Z.185]** — entscheidend für die Kampfdauer:

| Situation | Ablauf |
|---|---|
| **Armee steht stationär in einer Stadt (entrenched)** | Sie macht **nur Verteidigungsschaden**. Die angreifende Armee macht **nur Angriffsschaden**. |
| **Kampf außerhalb einer Stadt**, oder Verteidiger hat Move-/Attack-Befehl | **Beide** Seiten greifen mit **Angriffsschaden** an und erwidern mit **Verteidigungsschaden** → solche Kämpfe sind **doppelt so schnell entschieden**. |

WW3/CoN formuliert dasselbe expliziter **[B: `_raw/ww3/wiki_Combat.txt`]**:

- **Meeting Engagement** (Verteidiger *nicht* im Provinzzentrum), pro Tick:
  1. A greift B an (A offensiv, B defensiv)
  2. B kontert A (B offensiv, A defensiv)
- **Attack/Defense Engagement** (Verteidiger *im* Provinzzentrum, entrenched), pro Tick:
  1. Nur A greift an (A offensiv, B defensiv) — B kontert **nicht**.

Der **erste Combat Tick erfolgt sofort**, alle weiteren **stündlich**. **[B: `_raw/ww3/wiki_Combat.txt`]**

### 7.5 Belagerung, Eroberung, Provinzschaden

- Eine Provinz wird erobert, indem eine Einheit ihr **Zentrum** besetzt. **[B: `_raw/ww3/w2_Provinces.txt`; analog S1914]**
- **Gebäude und Provinzmoral nehmen nur Schaden, wenn das Provinzzentrum angegriffen wird.** **[B: `_raw/hs_288.txt`]**
- **Post-2023: Gebäude nehmen bei der Eroberung automatisch Schaden.** **[B: `_raw/hs_288.txt`]**
- Beschädigte Gebäude verlieren ihre Funktion erst nach **10 HP Puffer**. **[B: Release Notes 2023-02-21]**
- Festungen reduzieren den eingehenden Schaden (5.3); die Reduktion sinkt, wenn die Festung selbst beschädigt wird.
- Eroberungsfolgen: Provinzmoral auf 25, volle Tagesproduktion + Teil der Steuern an den Eroberer (3.8), Rückeroberungs-Sonderregel (4.1).

**Contested Targets** **[B: `_raw/manual_body.txt` Z.184]:** Greifen mehrere Nationen dieselbe Provinz an und ein Verbündeter erobert sie zuerst, greift die eigene Armee **weiter die Stadt an und löst Krieg mit dem Verbündeten aus**. Gegenmittel: nicht die Stadt, sondern die **Truppen in der Stadt** als Ziel wählen.

### 7.6 Rückzug

- **Supremacy 1914:** Kein dedizierter Retreat-Befehl dokumentiert. Man gibt einer im Kampf stehenden Armee einen Move-Befehl weg vom Feind. **[S]** ob dabei Sonderregeln greifen.
- **WW3/CoN [B: `_raw/ww3/wiki_Combat.txt`]:** expliziter **Retreat-Befehl**. Nur Boden- und Marineeinheiten. Rückzug in nächstes befreundetes Gebiet, **kostet Hitpoints**, gibt dafür **deutlich erhöhtes Bewegungstempo** und die Einheiten sind **sehr schwer zu treffen**.

### 7.7 Bombardement / Fernkampf

**[B: `_raw/manual_body.txt` Z.128, Z.183; `_raw/w_warfare.txt`]**

- Eine Armee mit Fernkampfeinheiten nähert sich dem Ziel **nur so weit, bis die Einheit mit der größten Reichweite feuern kann**.
- **Auch Infanterie hat eine (kleine) Reichweite** — daher kann ein Gefecht beginnen, bevor das eigentliche Ziel erreicht ist; es wird zu Ende gefochten, bevor der Marsch weitergeht.
- Fernwaffen können **Gebäude zerstören und Provinzmoral senken, ohne die Provinz zu erobern** — das ist ein eigener strategischer Weg, den Index of Power des Gegners zu senken. **[B: `_raw/hs_1.txt`]**
- Railgun-Nachladeintervall: normalerweise **60 Minuten**; bei Ein-Schuss-Kill **60 Sekunden**. **[B-alt: supremacy1914-Wiki `Railgun`]**

### 7.8 Luftkampf

**[B: `_raw/manual_body.txt` Z.131-140]**

- Flugzeuge brauchen ein **Airfield zum Starten**. Sie verwenden **Luft-Schadenswerte**, wenn sie in der Luft sind **oder** in einer Provinz mit Flugplatz stationiert sind; **Boden-Schadenswerte** (Fighter **10 %**, Bomber **7 %**), wenn sie am Boden ohne Flugplatz stehen.
- **Patrol**: Fighter sammeln Aufklärung, decken versteckte Einheiten auf und greifen automatisch feindliche Flugzeuge mit Attack-/Patrol-Befehl an. Flugzeuge, die den Radius nur mit Move-Befehl durchqueren, werden **nicht** angegriffen.
- **Attack**: Nach jedem Angriff muss das Flugzeug **zur Basis zurück, um neu zu laden**.
- **Basiswechsel**: Move-Befehl auf einen anderen Flugplatz. Außerhalb der Flugreichweite wird das Flugzeug **auf Bodenfahrzeuge verladen** (langsam und verwundbar).
- Diplomatie: **Shared Map** erlaubt Nutzung fremder Flugplätze; **Right of Way allein nicht** — dann bewegt sich das Flugzeug nur am Boden.
- Patrouillenmechanik laut Battle Calculator: **4 Ticks à 1/4 Schaden pro Runde**. **[B: dxcalc.com/share/s1914.info.html]**

### 7.9 Seekampf

**[B: `_raw/manual_body.txt` Z.141-147; s1914-Wiki Schiffsseiten]**

- **Battleship**: größte Reichweite, kann Küsten- und Seeziele beschießen, Provinzupgrades zerstören und Moral senken.
- **Light Cruiser**: billiger, schneller (40 km/h), kürzere Reichweite (40 km), schwächer.
- **Submarine**: reine Nahkampfeinheit, Stealth, ideal gegen Battleships und Landungsflotten sowie zur Seewegsperre.
- **Konter-Dreieck [B-alt: s1914-Wiki]:** U-Boote schlagen Battleships und Light Cruiser; Railguns, Fighter und Bomber überreichen Battleships; Battleships überreichen Light Cruiser.
- **Post-2023 wurde eine eigene Naval-Schadenskategorie eingeführt.** **[B: `_raw/hs_288.txt`]**
- Ein häufiger Trick: Infanterie auf ein Schiff stapeln als "meat shield" — verlangsamt das Schiff aber auf Infanteriegeschwindigkeit. **[B-alt: s1914-Wiki `Battleship`]**

### 7.10 Anti-Air-Modell (nur WW3 / CoN)

**[B: `_raw/ww3/wiki_Combat.txt`]** — für S1914 nicht relevant, aber sauber modelliert:

| Fall | Regel |
|---|---|
| **Point Defense** — Rakete/Flugzeug greift einen Stack an, der selbst eine AA-Einheit enthält | AA verteidigt **jedes Mal**, **kein Cooldown** |
| **AA Envelope** — Ziel steht nur *innerhalb* der Reichweite einer benachbarten AA-Einheit | AA geht nach dem Abfangen auf **Cooldown**, die nächste Rakete kommt durch |

### 7.11 Sonstige WW3-Kampfregeln

- **Entrenchment**: Ein Stack auf einem Provinzzentrum bekommt automatisch **25 % Schadensreduktion**; endet mit dem nächsten Move-Befehl; durch Gebäude steigerbar. **[B: `_raw/ww3/w2_Provinces.txt`; `_raw/ww3/wiki_Combat.txt`]**
- **Stacking Penalty** wird farbcodiert angezeigt: gelb = abnehmender Ertrag, orange = kein Zugewinn, rot = **negativ**, der Stack wird schwächer. **[B: `_raw/ww3/wiki_Combat.txt`]**
- **Crimes Against Humanity**: Einheiten in noch nicht eroberten feindlichen Städten dezimieren die Zivilbevölkerung → eigene **Nationalmoral sinkt** (max −30, erholt sich mit 1/3 pro Tag). Chemische/nukleare Waffen verstärken das massiv. **[B: `_raw/ww3/wiki_Combat.txt`; `_raw/ww3/wg_Morale.txt`]**
- **Friendly Fire**: Chemische und nukleare Waffen beschädigen **alle** Einheiten im Wirkungsbereich, auch eigene. **[B: `_raw/ww3/wiki_Combat.txt`]**
- Wird während eines laufenden Kampfes Frieden geschlossen, **endet der Kampf nicht** — bei Ablauf des Combat Timers wird erneut Krieg erklärt. **[B: `_raw/ww3/wg_Combat.txt`]**

---

## 8. Bewegung (Priorität)

### 8.1 Grundmodell

**[B: `_raw/s1914_Units.txt`; `_raw/w_warfare.txt`]**

- Bewegung erfolgt **ausschließlich entlang der Wege und Seerouten** des Kartengraphen.
- Geschwindigkeit in **km/h**, Wegstrecken in km → Reisezeit = `distanz / geschwindigkeit`, moduliert durch Territoriumstyp, Bahn und Mobilization.
- Die Route ist standardmäßig die **schnellste**, nicht die kürzeste. **[B: `_raw/manual_body.txt` Z.120]**
- **Die Geschwindigkeit eines gemischten Stacks ist die der langsamsten Einheit.** **[B: `_raw/w_warfare.txt`]**

### 8.2 Geschwindigkeitstabelle (der zentrale Datensatz)

**[B: `_raw/w_warfare.txt` — s1914-Wiki `Warfare`, Unit Speeds]** — Werte in km/h; **Klammerwerte = mit Railway**.

| Einheit | Eigenes Gebiet | Fremdes Gebiet | Feindliches Gebiet | See |
|---|---|---|---|---|
| **Infantry** | 36 (90) | 25 (63) | 12,5 (31) | 21 |
| **Armoured Car** | **72** (90) | 50 (63) | 25 (31) | 21 |
| **Artillery** | 25 (62,5) | 18 (43,75) | 9 (21) | 21 |
| **Tank** | 36 (90) | 25 (62,5) | 12,5 (31) | 21 |
| **Railgun** | — (12,5) | — (9) | — (4,4) | 21 |
| **Balloon** | 25 (62,5) | 18 (43,75) | 9 (21) | 21 |
| **Battleship** | — | — | — | **30** |
| **Light Cruiser** | — | — | — | **40** |
| **Submarine** | — | — | — | **30** |
| **Bomber** | 18 (am Boden) | — | — | **144 (in der Luft)** |
| **Fighter** | 18 (am Boden) | — | — | **216 (in der Luft)** |

Abgeleitete Regelmäßigkeiten **[A]**:
```
fremdesGebiet   ≈ eigenesGebiet * 0.70     (36 -> 25; 72 -> 50; 25 -> 18)
feindlichesGeb. ≈ eigenesGebiet * 0.35     (36 -> 12.5; 72 -> 25; 25 -> 9)
mitRailway      ≈ ohneRailway  * 2.5       (36 -> 90; 25 -> 62.5; 18 -> 43.75)
```
> **Achtung Widerspruch:** Die Railway-Infobox nennt "+150 % Bewegungstempo" **[B-alt: s1914-Wiki `Railway`]**, was einem Faktor 2,5 entspricht — konsistent mit der Tabelle. Die Formulierung "increases troop movements by 150 %" ist also als **auf 250 %** zu lesen. **[A]**

Alle Seegeschwindigkeiten von Landeinheiten (als Transportschiff) sind einheitlich **21 km/h**. Reine Marineeinheiten sind schneller (30-40 km/h).

### 8.3 Ein- und Ausschiffung (Seetransport)

**[B: `_raw/w_warfare.txt`]**

| Situation | Dauer |
|---|---|
| Normale Küste, ohne Harbour | **3 Stunden** |
| Normale Küste, **mit Harbour** | **1,5 Stunden** |
| **Feindliche** Küste, ohne Harbour | **4,5 Stunden** |
| **Feindliche** Küste, mit Harbour | **2,25 Stunden** |

Der Harbour halbiert also durchgängig die Zeit (−50 %) **[B: s1914-Wiki `Harbour`]**; feindliche Küsten kosten den Faktor 1,5.

**Taktische Konsequenz [B: `_raw/manual_body.txt`, Abschnitt Battleship/Landung]:** Während der Ausschiffung sind Truppen nur mit Bruchteilstärke einsatzfähig — ein klassisches Zeitfenster für Gegenangriffe. Battleship-Unterstützung ist deshalb Standard bei Landungen.

### 8.4 Aufmarschverzögerung / Befehlssystem

**[B: `_raw/manual_body.txt` Z.117-128; `_raw/w_warfare.txt`]**

| Befehl | Wirkung |
|---|---|
| **Move / March** | Bewegung auf schnellster Route |
| **Via / Add Target / Waypoints** | erzwungene Zwischenpunkte (Shift+Linksklick), um Routen zu erzwingen |
| **Delay / Arrival Time** | **Zeitgesteuerter Aufmarsch:** Ankunftszeit vorgeben; die Armee **wartet am Startort**, damit sie exakt zum gewünschten Zeitpunkt ankommt. Ermöglicht koordinierte Mehrfrontenangriffe. |
| **Forced March** | **+50 % Bewegungstempo**, kostet **5 % Moral pro Stunde** **[B: `_raw/manual_body.txt` Z.124]** |
| **Split Armies** | Stack nach Einheitentyp per Slider aufteilen; der abgespaltene Teil führt den neuen Befehl aus |
| **Merge** | Armeen verschmelzen automatisch, wenn sie am selben Ort stehen und **keinen** oder **denselben** Attack-Befehl haben. Zwei getrennte Armeen am selben Ort sind unmöglich. **[B: `_raw/w_warfare.txt`]** |
| **Rally Point** | Neu produzierte Einheiten marschieren automatisch zu einem Sammelpunkt — **Premium-Feature** (Kapitel 11) |

**Advanced Fire Control** (Premium) mit vier Modi **[B: `_raw/manual_body.txt` Z.324-333]**: *Hold Fire*, *Return Fire*, *Fire at Will* (Standard), *Aggressive* (unterbricht sogar Marschbefehle).

### 8.5 Mobilization und Geschwindigkeit

**[B: `_raw/w_warfare.txt`; `_raw/hs_288.txt`]**

- Ölmangel senkt Mobilization → Armeen werden **langsamer und schwächer**.
- **Bewegung auf Railways verbraucht kein Öl.**
- **Post-2023 zusätzlich:** gesundheitsabhängige Geschwindigkeitsstrafe, lineare Kurve:
  ```
  HP >= 60 %  -> 100 % Tempo
  HP  = 0 %   ->  20 % Tempo    (linear dazwischen)
  ```

### 8.6 Bewegung in WW3 / CoN

- **Terrain-Typen** modifizieren Attack, Defense, **Speed Value** und HP je Einheit. **[B: `_raw/ww3/wiki_Combat.txt`]** Konkrete Werte → **[S]**.
- **Military Logistics** (Provinzgebäude) erhöht Bodentempo in der Provinz. **[B: `_raw/ww3/w2_Provinces.txt`]**
- **Pontoon** erlaubt Ein-/Ausschiffung in Küstenprovinzen ohne Hafen. **[B: dito]**
- **Airlift / Air Assault** als eigene Bewegungsart für Airmobile-Infanterie. **[B: `_raw/ww3/wg_Combat.txt` Navigationsleiste]**
- **Refueling** von Flugzeugen über eigene oder per Right of Way freigegebene Flugplätze. **[B: `_raw/ww3/w2_Diplomatic_Status.txt`]**
- **Retreat** gibt erhöhtes Tempo gegen HP-Verlust (7.6).

---

## 9. Diplomatie

### 9.1 Die sechs Beziehungszustände (Supremacy 1914)

**[B: `_raw/manual_body.txt` Z.196; `_raw/w_warfare.txt`]** — "In total there are 6 diplomatic relations between countries. By default, peace is the initial condition."

| Zustand | Bedeutung |
|---|---|
| **War** | Truppen greifen sich immer automatisch an |
| **Trade Embargo / Ceasefire** | kein Handel; Betreten des Territoriums löst Krieg aus |
| **Peace** (Standard) | Truppen feuern **nicht automatisch** aufeinander — mehr nicht. Betreten fremden Territoriums löst trotzdem Krieg aus |
| **Right of Way** | Durchmarschrecht; keine automatischen Verteidigungsaktionen; Flugzeuge dürfen fremde Flugplätze **nicht** nutzen |
| **Shared Map** | wie Right of Way + geteilte Kartenaufklärung; Flugzeuge **dürfen** fremde Flugplätze nutzen |
| **Shared Intelligence** | wie Shared Map, zusätzlich werden auch die *von Dritten geteilten* Karten weitergereicht — **nur für Premium-Mitglieder** **[B: `_raw/manual_body.txt` Z.334]** |

Manche Beziehungen müssen **vom Gegenüber bestätigt** werden. **[B: `_raw/manual_body.txt` Z.194]**

### 9.2 Kriegsauslösung („Acts of War")

**[B: `_raw/w_warfare.txt`; `_raw/manual_body.txt` Z.178-181]**

```
Trifft eigene Armee auf fremde Armee ...
  auf internationalem Gebiet / auf See  -> kein Krieg
  auf fremdem Territorium bei Status War / Embargo / Peace -> KRIEG
  bei Status Right of Way / Shared Map / Shared Intelligence -> kein Krieg
```
Zusätzlich: Ein expliziter Attack-Befehl auf einen Nicht-Kriegsgegner löst eine Bestätigungsabfrage aus und **ändert danach den diplomatischen Status**. Das ist der „Sneak Attack" — es gibt **keine Vorwarnzeit und keine Kriegserklärungs-Verzögerung**. **[B: `_raw/gm101.txt`]**

> **Kriegserklärungszeiten:** In Supremacy 1914 ist **keine Karenzzeit** dokumentiert — Krieg tritt sofort in Kraft. **[A]** aus dem Fehlen jeglicher Erwähnung; ein expliziter Beleg fehlt → **[S]**.

**WW3/CoN identisch** **[B: `_raw/ww3/wiki_Combat.txt`]**: Kriegserklärung per Diplomatie-Panel *oder* automatisch beim Betreten fremden Territoriums, mit Warn-Popup. **Stealth-Einheiten können ohne Kriegserklärung infiltrieren.** **[B: `_raw/ww3/w3_Field_of_View.txt`]**

WW3 hat nur **fünf** Zustände (Shared Intelligence, Peace, Right of Way, War + Coalition) und dort ist **Peace ausdrücklich rein symbolisch ohne Spielmechanik-Wirkung**. **[B: `_raw/ww3/w2_Diplomatic_Status.txt`]**

> **Falle in WW3 [B: `_raw/ww3/w2_Diplomatic_Status.txt`]:** Gewährt man Right of Way und der andere hat Infanterie im eigenen Gebiet stehen, kann er bei Kriegserklärung **sofort Provinzen und Städte einnehmen**.

### 9.3 Koalitionen

**Supremacy 1914 [B: `_raw/manual_body.txt` Z.229-234]:**
- Eigener Chat, eigenes Ranking, eigene Flagge.
- **Man kann niemanden einladen** — Spieler müssen sich **bewerben**, der Koalitionsführer entscheidet.
- Austritt jederzeit über „My coalitions".

**WW3/CoN [B: `_raw/ww3/w2_Coalition.txt`]:**
- **Gemeinsames Siegpunkt-Limit**, das mit jedem Mitglied **steigt** (Beispiel: solo 1.850 VP; bei 3 Mitgliedern **5.550 VP für das Team gemeinsam**). Es ist egal, wer wie viel beisteuert.
- Beim Austritt läuft ein **24-Stunden-Countdown**, Teammitglieder werden benachrichtigt.
- **Inaktivität startet den Austritts-Timer automatisch.**

### 9.4 Handel zwischen Spielern

**[B: `_raw/manual_body.txt` Z.198-205]** — handelbar sind:

| Gegenstand | Limit |
|---|---|
| **Geld** | max. **100.000** |
| **Ressourcen** (alle Basisressourcen) | max. **30.000** |
| **Beziehung** | alle außer „at war" |
| **Provinzen** | beliebig |
| **Erkundete Karte** | nur Aufklärungsdaten, die **mindestens 5 Tage alt** sind |
| **Armeen/Einheiten** | möglich — bleiben **physisch am Ort**, wechseln nur die Kontrolle **[B: `_raw/s1914_Economics_and_Resources.txt`]** |

### 9.5 KI-Verhalten

**[B: `_raw/manual_body.txt` Z.192, Z.197]** — für einen Singleplayer-Klon das wichtigste Kapitel der Diplomatie:

- Ist ein menschlicher Spieler **3 Tage inaktiv**, übernimmt die KI seine Nation, bis er zurückkehrt.
- **Standard-KI** ergreift **keine diplomatische Initiative** (erklärt nicht von sich aus Krieg oder Embargo), **reagiert aber**: Gewährt man ihr Right of Way, bietet sie es nach einiger Zeit ebenfalls an.
- **Elite-KI** ist zurückhaltender bei Statusänderungen und verfolgt zusätzlich **Ruf/Reputation** aus diplomatischem und militärischem Verhalten: gute Reputation → gewährt Right of Way; schlechte Reputation → **erklärt den Krieg**.
- **Post-2023:** Die KI platziert Truppen intelligenter — sie priorisiert **Feindgrenzen** und **wertvolle Provinzen mit vielen Gebäuden**. **[B: `_raw/hs_288.txt`]**

### 9.6 Sichtbarkeit und Fog of War

**[B: `_raw/w_warfare.txt`; `_raw/hs_288.txt`; `_raw/ww3/w3_Field_of_View.txt`]**

Supremacy 1914:
- Feindarmeen ab **150 km** sichtbar, Details (Größe/Moral/Zusammensetzung) ab **90 km**.
- **Post-2023: Gebäude sind im Fog of War verborgen**, bis die Provinz mit einer Einheit gescoutet oder per Spion aufgedeckt wird. Wird ein Gebäude aufgedeckt, ist **auch sein Level** sichtbar. Die Aufdeckung ist **temporär**. Deshalb erzeugt ein Baufortschritt **keinen Zeitungsartikel** mehr.
- Festungen ab Lvl ~3,5 verbergen Truppen; U-Boote sind unsichtbar (6.5).

WW3/CoN nutzt **zwei völlig unabhängige Systeme** — das ist als Modell interessant:
1. **Sight Range** (Fog of War): volle Sicht im eigenen Gebiet und bei Koalitionspartnern/Shared Intelligence. Fremde Armeen **außerhalb** befreundeten Gebiets erscheinen nur als *„Unidentified"* (Fragezeichen) — Details nur durch eine Einheit mit **Scout**-Fähigkeit oder durch Kampfkontakt. Marineeinheiten sind **immer** identifiziert. **Stealth**-Einheiten sind komplett unsichtbar, außer durch eine Einheit mit **Reveal Stealth** für die passende Domäne (Ground/Air/Naval).
2. **Radar**: unabhängig davon; Einheiten haben eine **Radarsignatur** aus *Typ* (Ground / Fixed Wing / Rotary Wing / Naval) und *Größe* (HIGH / LOW). Radar-Einheiten orten passende Signaturen.

---

## 10. Forschung, Spionage, Zeitung, Siegbedingungen

### 10.1 Forschung

**Supremacy 1914 hat KEINEN Forschungsbaum.** **[B: `_raw/manual_body.txt` — kein Forschungskapitel; `_raw/hs_index.txt` — kein Forschungsartikel]** Technologischer Fortschritt wird über zwei andere Achsen abgebildet:

1. **Spieltag-Gating** von Gebäuden (1.4) — Factory ab Tag 8, Aerodrome ab Tag 10 usw.
2. **Gebäudelevel** als Freischaltung (5.2) — Factory Lvl 2 schaltet Tanks frei, Lvl 3 Railguns/Bomber/Battleships.

Zusätzlich gibt es **Unit Packs** als Rundenoption („Air Pack", „Air & Naval Pack"): Ohne diese Option stehen Flugzeuge, Light Cruiser, Submarine und Ballon **gar nicht** zur Verfügung; Battleships hingegen sind in Normalrunden dabei. **[B: `_raw/manual_body.txt` Z.130, Z.141]** Packs sind teils an Gold-Runden gekoppelt (Kapitel 11).

**WW3 / CoN hat einen echten Forschungsbaum [B: `_raw/ww3/wg_Research.txt`; `_raw/ww3/w3_Military_Doctrine.txt`]:**
- **Maximal 2 Forschungen gleichzeitig.**
- Kosten: **Supplies + Rare Materials + Money**.
- Eine erforschte Verbesserung **upgradet automatisch alle bestehenden Einheiten** des Typs.
- **Militärdoktrinen** (Western / Eastern / European) bestimmen, welche Einheiten **früh** verfügbar sind:
  | Doktrin | Frühe Schwerpunkte |
  |---|---|
  | **Eastern** | Main Battle Tank, SAM Launcher, Gunship Helicopter |
  | **European** | Mechanized Infantry, Tank Destroyer, Strike Fighter |
  | **Western** | Armored Combat Vehicle, Theatre Defense System, Attack Helicopter, AWACS |
- Forschung ist **per Gold um bis zu 12 Stunden beschleunigbar** — Monetarisierungspunkt.

### 10.2 Spionage (Supremacy 1914)

**[B: `_raw/manual_body.txt` Z.236-294]**

**Grundmechanik:**
- Spione sind **keine Einheiten auf der Karte**, sondern werden im Espionage-HQ verwaltet.
- **Rekrutierung: 20.000 GBP**, gerichtet auf eine bestimmte Zielprovinz.
- Spione führen ihre Mission **einmal pro Tag** aus (nicht sofort). Ergebnisse im Reports-Tab.
- **Gehälter werden am Day Change abgebucht.**
- Wird eine Gegenspionage in derselben Provinz betrieben, kann der Spion **enttarnt und vernichtet** werden — **beide Seiten werden benachrichtigt**.
- Kann man die Gehälter nicht zahlen, **wechselt der Spion die Seiten** und dient dem Zielland. **[B-alt: `_raw/gm101.txt`]**

**Missionen und Tageskosten:**

| Mission | Kosten/Spion/Tag | Wirkung |
|---|---|---|
| **Intelligence** | **2.000 GBP** | Positionen und Missionen feindlicher Spione; ein- und ausgehende Kommunikation; Armeen in der Zielprovinz; Ressourcenproduktion und Handel |
| **Economic Sabotage** | **4.000 GBP** | Zerstörung von Ressourcen; Diebstahl von Steuereinnahmen; **Moralsenkung (−10, stapelbar)**; Deaktivierung von Rekrutierungsgebäuden |
| **Military Sabotage** | **4.000 GBP** | Aufdeckung **aller** feindlichen Armeen; Gebäudeschaden; Verlängerung von Produktionszeiten; Deaktivierung von Rekrutierungsgebäuden |
| **Counter Intelligence** | **1.000 GBP** | Abwehr; enttarnt feindliche Spione |
| *(untätig, nicht zugewiesen)* | **500 GBP** | — (deshalb überzählige Spione entlassen) |

**Wichtig für den Klon:** Spionage ist einer der Hauptwege, gegnerische Moral zu senken — und damit gegnerischen Index of Power. Sabotage-Spione auf neutrale Länder zu setzen, **provoziert Krieg**. **[B-alt: `_raw/gm101.txt`]**

Spionageschaden wurde 2023 mit umskaliert **[B: `_raw/hs_288.txt`]** → heutige Absolutwerte **[S]**.

### 10.3 Zeitung („Daily European")

**[B: `_raw/manual_body.txt` Z.206-228]**

- Erscheint **einmal pro Spieltag**; ältere Ausgaben per Tagesnummer abrufbar.
- **Oberer Teil (Spielinformationen):**
  - **Index of Nations** — alle Spieler mit ihren Siegpunkten.
  - **Karte** — täglich aktualisierte territoriale Übersicht.
  - **Stats** — rotierende Statistiken (reichste Nationen, aktivste Erkunder, technologisch fortschrittlichste …).
  - **Game Info** — Siegbedingung der Runde, verbleibende Zeit bis Day Change, Sonderregeln.
- **Unterer Teil (Artikel):** teils automatisch generiert, teils von Spielern geschrieben.
  - Automatisch: Bauberichte *(post-2023 entfallen wegen Fog of War, siehe 9.6)*, Kriegsverluste, beschädigte/deaktivierte Gebäude, eroberte Hauptstädte, Aufstände, Handel und Statusänderungen.
  - Spielerartikel: öffentlich, als offizielle Regierungsverlautbarung — oder **anonym**.
  - **Bild-Upload nur für Premium.**

Für einen Singleplayer-Klon ist die Zeitung das ideale **Event-Log / Feedback-Kanal** und praktisch gratis zu implementieren. **[A]**

### 10.4 Siegbedingungen und Punktesystem (Supremacy 1914)

**[B: `_raw/hs_1.txt`; `_raw/manual_body.txt` Z.2-7, Z.215-216]**

**Ziel:** Als Erster eine festgelegte Menge **Index of Power (IoP)** erreichen.

**Der IoP ist ein RELATIVER Anteilswert, kein Absolutwert:**

> „Your IoP score is not an absolute number. Instead it reflects what share of the game's overall morale and buildings you control — and thus changes depending on the performance of other players."

Er speist sich aus drei Beiträgen **[B: `_raw/hs_1.txt`]**:
1. **Eroberte Provinzen / Territorium**
2. **Gebäude** — jedes Gebäude zählt **nach seinem Level**, Upgrades erhöhen den Score
3. **Moral** der eigenen Provinzen

**Daraus folgt der zweite Siegweg — Sabotage:** Weil der Wert relativ ist, steigt der eigene IoP auch, wenn man **fremde Gebäude zerstört** oder **fremde Moral senkt** — ohne eine einzige Provinz zu erobern. Artillerie, Battleships, Bomber und Spione sind dafür die Werkzeuge. **[B: `_raw/hs_1.txt`]**

**Punkteverteilung [B: `_raw/manual_body.txt` Z.215]:**
> „Die Summe von **2000 relativen Siegpunkten** wird permanent unter allen Spielern aufgeteilt. Wird ein Spieler proportional größer, erhält er einen größeren Anteil der verfügbaren Basispunkte. Da die Siegpunkte relativ berechnet werden, fällt gleichzeitig die Punktzahl der anderen Spieler. (Basispunkte sind im Spiel nicht sichtbar und liegen der Berechnung im Hintergrund zugrunde.)"

**Die offizielle Formel-PDF (`supremacy1914.com/fileadmin/files/PointFormula.pdf`) ist nicht mehr abrufbar (HTTP 404 / NoSuchKey).** → **[S]** Die exakte Gewichtung von Provinzen vs. Gebäuden vs. Moral ist damit **unbekannt**.

**Vorschlag für den Klon [A]:**
```
basisPunkte(spieler) = w_prov * anzahlProvinzen
                     + w_geb  * summe(gebaeudeLevel)
                     + w_mor  * summe(provinzMoral)
IoP(spieler) = 2000 * basisPunkte(spieler) / summe(basisPunkte aller Spieler)
```
Gewichte `w_*` frei tunen; die Siegschwelle liegt kartenabhängig unterhalb von 2000 (bei WW3 sind z. B. 1.850 VP für einen Solospieler dokumentiert).

**Rundenende:** Rankte Runden schütten Goldmark je nach finalem IoP aus, dazu Account-Level, Kampfstatistiken und Achievements. **[B: `_raw/manual_body.txt` Z.10]**

### 10.5 Siegbedingungen WW3 / CoN

**[B: `_raw/ww3/w3_Victory.txt`; `_raw/ww3/w2_Coalition.txt`; `_raw/ww3/w2_Provinces.txt`]**

- Sieg durch Erreichen eines **Victory-Point-Limits**, angezeigt unter dem eigenen Spielernamen.
- **VP kommen aus gehaltenen Provinzen und Städten**; der Wert einer Stadt richtet sich nach ihrer **Bevölkerungszahl** — je größer, desto mehr VP.
- **VP werden nur einmal pro Spieltag aktualisiert** (bei Day Change, Mitternacht GMT+1/CEST+1).
- Nach Erreichen läuft die Runde **bis Mitternacht des laufenden Spieltags weiter**, damit die übrigen Spieler noch punkten können. Dann Rundenende, VP werden in **Gold** umgerechnet.
- **Koalitionen erhöhen das gemeinsame Limit** proportional zur Mitgliederzahl (9.3).

---

## 11. Monetarisierung: was Echtgeld konkret kauft (Priorität)

Ziel dieses Kapitels: **jeden Premium-Vorteil identifizieren**, damit er im Klon entweder **kostenlos** verfügbar oder **ersatzlos gestrichen** wird.

Supremacy 1914 hat **zwei getrennte Monetarisierungsschienen**:
1. **Goldmark** — Premium-Währung, verbrauchbar, wirkt direkt auf die Spielmechanik.
2. **High Command** — Abo (1/6/12 Monate), schaltet **dauerhafte Komfort- und Kontrollfunktionen** frei.

### 11.1 Goldmark: mechanische Effekte

**Quellen [B: `_raw/manual_body.txt` Z.296-301, Z.273-294, Z.68, Z.98; `_raw/hs_3.txt`; `_raw/s1914_Morale.txt`]**

| Wirkung | Preis | Klon-Empfehlung |
|---|---|---|
| **Provinzmoral sofort +10 %** | **500 GM** | **STREICHEN** — bricht das Moralsystem, das der Kern des Wirtschaftsspiels ist |
| **Ressourcen zum Fixkurs @ 0,5 kaufen** (5.000 Ressourcen für 2.500 GM) | **2.500 GM / 5.000 Res** | **STREICHEN** — hebelt Markt und Ressourcenknappheit aus |
| **Rekrutierung beschleunigen** | variabel **[S]** | **STREICHEN** — stattdessen globale Zeitraffer-Funktion (1.2) |
| **Bau/Konstruktion beschleunigen** | variabel **[S]** | **STREICHEN** — dito |
| **Eigene Truppenmoral erhöhen** | variabel **[S]** | **STREICHEN** |
| **Gegnerische Truppen-/Provinzmoral senken** | siehe Instant-Espionage | **STREICHEN** |
| **Armeen heilen / verstärken** („army healing costs", post-2023 statischer Preis mit linearem Anstieg bei größeren Stacks; für Nicht-Infanterie erhöht) | **[S]** | ggf. als **kostenlose** Reparaturmechanik über Ressourcen umsetzen |
| **Gold-Runden-Eintritt** (Runden mit Sonderoptionen/Unit-Packs) | **5.000 GM** pro Spieler | **Alle Unit Packs im Klon standardmäßig aktivieren** |

**Instant Espionage Actions** — Spionageeffekte **ohne** Spionrekrutierung, mit **sofortigem Ergebnis** **[B: `_raw/manual_body.txt` Z.273-294]**:

| Aktion | Preis | Wirkung |
|---|---|---|
| **Reveal Armies** | **750 GM** | deckt Armeen in und um die gewählte Provinz auf |
| **Country Information** | **750 GM** | Ressourcen, diplomatische Beziehungen, Spionpositionen und Fabrikproduktion eines Spielers |
| **Reveal All Armies** | **1.650 GM** | deckt **alle** Armeen eines Spielers auf |
| **Decrease Morale** | **2.000 GM** | −10 Moral in der gewählten Provinz |
| **Destroy Resources** | **2.000 GM** | zerstört Teile der Tagesproduktion der Provinz |
| **Damage Upgrade** | **2.000 GM** | beschädigt ein Gebäude (nie die Hauptstadt) |

> **Widerspruch:** `_raw/s1914_Morale.txt` nennt für den sofortigen −10-Moral-Agenten **3.950 Goldmark** statt 2.000. Vermutlich unterschiedliche Patchstände oder unterschiedliche Aktionen (Agent vs. Instant Action). **[A]** — für den Klon irrelevant, da gestrichen.

**Mehrere Instant Actions sind verkettbar** für kumulative Wirkung. **[B: `_raw/manual_body.txt` Z.294]**

**Woher Goldmark kommt [B: `_raw/hs_3.txt`; `_raw/manual_body.txt` Z.10]:** Tutorial, Rundengewinne (je höher der finale IoP, desto mehr), tägliche **Werbevideos in der Mobile-App**, E-Mail-Promotions, und Kauf im Shop.

### 11.2 High Command (Premium-Abo): die vollständige Liste

**[B: `_raw/manual_body.txt` Z.302-339]** — das ist die relevanteste Liste, weil hier **echte Spielmechanik** hinter der Paywall liegt, nicht nur Geschwindigkeit:

| Feature | Was es tut | Klon-Empfehlung |
|---|---|---|
| **General Mobilization** | Bei Spielstart bekommt **jede** Provinz automatisch ein Recruitment Office, das laufend Infanterie rekrutiert | **KOSTENLOS** — oder besser: als normalen Bau beibehalten und nur die Bulk-Bau-UI kostenlos machen |
| **Rally Points** | Neu produzierte Einheiten marschieren automatisch zu einem Sammelpunkt | **KOSTENLOS** (reine Bequemlichkeit) |
| **Build Queue** | Globale Bauwarteschlange; **Kosten werden erst bei Baubeginn abgebucht**, dadurch echte Vorausplanung; Übersicht über fehlende Ressourcen | **KOSTENLOS** |
| **Advanced Fire Control** | Vier Feuermodi: *Hold Fire*, *Return Fire*, *Fire at Will* (Standard), *Aggressive* | **KOSTENLOS** — das ist **taktische Tiefe**, nicht Komfort |
| **Shared Intelligence** | Eigener diplomatischer Status: wie Shared Map, plus Weitergabe der von Dritten geteilten Karten | **KOSTENLOS** (oder streichen, da Singleplayer) |
| **Keine Gebühr für Gold-Runden** | Zugang zu allen Sonderoptionen/Unit-Packs ohne 5.000 GM | **KOSTENLOS** — alle Packs immer an |
| **Bild-Upload in der Zeitung** | Kosmetik | streichen (Singleplayer) |
| **5 statt 1 eigene Runden pro Monat** | Kontingent | streichen (Singleplayer) |
| **„Honored Member" Medaille** (ab 12 Monaten) | Kosmetik | streichen |

**Zusätzlich [B-alt: s1914-Wiki `Recruitment Center`]:** Für High-Command-Mitglieder sind Recruitment Offices **kostenlos und unzerstörbar**.

### 11.3 Monetarisierung in WW3 / CoN

**[B: `_raw/ww3/wg_Gold.txt`; `_raw/ww3/wg_Research.txt`; `_raw/ww3/w4_Security_Council.txt`; `_raw/ww3/w4_Seasons.txt`]**

| Vehikel | Wirkung |
|---|---|
| **Gold** | Bau und **Forschung beschleunigen** (Forschung bis **12 h am Stück**); **Einheiten heilen** (außerhalb des Kampfes); feindliche Armeen aufdecken; Sabotage |
| **Security Council** | Abo-Äquivalent zum High Command |
| **Seasons / Seasonal Units** | Zeitlich begrenzte Einheiten mit **eigenen Stats und Skins**; jeder darf sie während der Saison bauen, **dauerhaft freischalten** aber nur, wer genug Season Points sammelt |
| **Verkaufsdruck** | Beim Login startet gelegentlich ein **10-Minuten-Sale** mit bis zu +20 % Gold; früher bis zu +1.000 % |

> **Bemerkenswert [B: `_raw/ww3/wg_Gold.txt`]:** Das Wiki hält fest, dass Gold-Einsatz oft als unfair gilt und das Spiel Spieler verwarnt, die sich darüber beschweren. Für den Klon ein klares Signal, **welche Mechanik man nicht übernimmt**.

### 11.4 Zusammenfassung: Was der Klon anders macht

**Streichen (Pay-to-Win, verzerrt Kernmechanik):**
- Sofortiger Moral-Kauf (Provinz und Truppen)
- Ressourcenkauf zum Fixkurs unter Marktpreis
- Bau-/Rekrutierungs-/Forschungsbeschleunigung gegen Währung
- Instant-Espionage ohne Spione und ohne Risiko
- Bezahltes Heilen von Armeen
- Season-Units mit exklusiven Stats

**Kostenlos machen (echte Features, künstlich hinter Paywall):**
- Build Queue mit später Kostenabbuchung
- Rally Points
- Advanced Fire Control (4 Feuermodi)
- General Mobilization
- Alle Unit Packs (Air, Naval, Submarine, Balloon) immer aktiv
- Shared Intelligence als regulärer Diplomatiestatus

**Ersetzen:**
- Der gesamte Echtzeit-Wartedruck (der eigentliche Monetarisierungsmotor) wird durch eine **Zeitraffer-/Pause-Steuerung** ersetzt (1.2). Damit fällt die ökonomische Grundlage der Goldmark-Beschleunigung komplett weg.

---

## 12. Unterschiede: Supremacy: World War 3 gegenüber Supremacy 1914

**Vorbemerkung (siehe 0.1):** WW3 ist das umbenannte *Conflict of Nations: World War 3*, ein **eigenständiges Bytro-Spiel**, kein Nachfolger auf derselben Engine. Die Unterschiede sind daher fundamental, nicht kosmetisch.

| Aspekt | Supremacy 1914 | Supremacy: World War 3 (CoN) |
|---|---|---|
| **Setting** | 1. Weltkrieg, historische Karten | Moderne/nahe Zukunft, geopolitische Szenarien |
| **Steam-App** | 979920 | **784950** |
| **Kartenobjekte** | nur **Provinzen** (alle gleichartig) | **Provinzen + Städte** als getrennte Objekte mit unterschiedlichen Regeln |
| **Provinzwert** | Ressourcentyp, einfach/doppelt | **Bevölkerungszahl** bestimmt Produktion **und** Siegpunkte; Bevölkerung wächst moralabhängig |
| **Besitzstatus** | binär (eigen/fremd) | **Homeland / Occupied / Annexed** mit 100 / 25 / 50 % Produktionsrate; Annexion ist ein **kostenpflichtiger Bau** |
| **Ressourcen** | **7** Ressourcen in **3 Kategorien**, innerhalb der Kategorie frei substituierbar, Slider-Steuerung | **6** Ressourcen + Money, **keine Kategorien**, jede mit fester Verwendung |
| **Grundverbrauch** | **800 t je Kategorie je Provinz je Tag** | kein Kategoriebedarf; Upkeep hängt an Einheiten und Gebäuden |
| **Forschung** | **keine** — Fortschritt über Spieltage und Gebäudelevel | **echter Forschungsbaum**, max. 2 parallel, Tier-Upgrades wirken rückwirkend auf alle Einheiten |
| **Fraktionsidentität** | keine | **3 Militärdoktrinen** (Western / Eastern / European) mit eigenen Einheitenskins und Forschungsreihenfolgen |
| **Einheitenklassen** | 13 Einheiten, 3 Zweige | **11 Klassen**, darunter Helicopters, Missiles, Officers, Seasonal Units |
| **Eroberung** | jede Landeinheit kann erobern | **nur Infanterie** (außer Special Forces) kann erobern |
| **Massenvernichtung** | keine | **Chemie, Nuklear, ICBM**, Kontamination, Bunker, Dekontamination als eigene Mechanik |
| **Luftabwehr** | Fighter/Ballon als Anti-Air | ausdifferenziertes **AA-System** mit *Point Defense* vs. *AA Envelope* und Cooldowns |
| **Aufklärung** | ein System (Sichtradius 150/90 km) | **zwei unabhängige Systeme**: Sight Range (mit Camouflage/Scout/Stealth) **und** Radar (Signaturtyp + Größe) |
| **Schadensverteilung im Stack** | gleichmäßig, gewichtet über Damage Area | **Echelons** (1st/2nd/3rd Line) — Frontlinieneinheiten ziehen mehr Schaden |
| **Stacking-Strafe** | harter Cap: 100 % bis 20, linear auf 0 % bis 50 | **weicher, farbcodierter** Verlauf; bei Überfüllung **negativ** (Stack wird schwächer) |
| **Entrenchment** | implizit über Festungen und Verteidigungswerte | **explizit: 25 % Schadensreduktion** auf dem Provinzzentrum, automatisch |
| **Rückzug** | kein dedizierter Befehl | **Retreat-Befehl** — HP-Kosten gegen Tempo und Trefferimmunität |
| **Heilung** | Condition-Regeneration ca. 17 %/Tag auf eigenem Gebiet | **feste HP/Tag** je nach Hospital-Level (+1 bis +5), Marine +2 in Küstengewässern |
| **Aufstände** | jede Provinz unter 33 Moral, `(33−Moral)*3 %` | **nur Städte**; bei 25 % Moral 50 % Chance; Rebellen sind eine **eigene Nation im Ranking** |
| **Aufstandszeitpunkt** | am Day Change | **pro Stadttyp einmal täglich zufällig gewürfelte Uhrzeit** |
| **Kriegsverbrechen** | keine Mechanik | **Civilian Casualties** senken die eigene Nationalmoral um bis zu −30 |
| **Diplomatie** | **6** Zustände; Peace hat Mechanikwirkung (kein Auto-Feuer) | **5** Zustände; **Peace ist rein symbolisch, ohne Mechanikwirkung** |
| **Koalition** | Chat, Ranking, Flagge; Sieg bleibt individuell | **gemeinsames VP-Limit**, das mit jedem Mitglied steigt; Austritt mit 24-h-Countdown |
| **Siegwertung** | **Index of Power** — relativer Anteil an Territorium, Gebäuden und Moral | **Victory Points** — absolute Summe aus gehaltenen Provinzen/Städten, gewichtet nach Bevölkerung |
| **Rundenende** | bei Erreichen der IoP-Schwelle | bei VP-Schwelle, Runde läuft **bis Mitternacht des Spieltags** weiter |
| **Spielerzahl (max.)** | 501 (The Great War 500p) | **140** auf der größten Karte |
| **Premium-Abo** | High Command | Security Council |
| **Season-Content** | keine (nur Event-Einheiten wie Zeppelin 2024) | **Seasons** mit exklusiven, dauerhaft freischaltbaren Einheiten |

### 12.1 Was der Klon von WW3 übernehmen sollte

Trotz des anderen Settings sind einige WW3-Systeme **besser dokumentiert und sauberer modelliert** als ihre S1914-Pendants:

1. **Die Moralformeln** (4.9) sind explizit als Gleichungen dokumentiert — direkt implementierbar.
2. **Meeting vs. Attack/Defense Engagement** (7.4) ist die klarste Beschreibung des Kampfablaufs in beiden Spielen.
3. **Explizites Entrenchment** (25 % Reduktion auf dem Zentrum) ist einfacher und lesbarer als S1914s implizite Regel.
4. **Retreat als Befehl** mit HP-Kosten löst ein echtes Designproblem von S1914 (Rückzug ist dort kaum steuerbar).
5. **Zwei getrennte Aufklärungssysteme** (Sicht vs. Radar) geben Aufklärungseinheiten eine eigene Rolle.
6. **Provinz- vs. Stadtstatus** (Homeland/Occupied/Annexed) modelliert Besatzungskosten realistischer als S1914s reine Moralstrafe.

---

## 13. Implementierungs-Kurzfassung (Simulationsschleife)

Konsolidiert aus allen obigen Kapiteln — **[A]**, aber jede Einzelregel ist oben belegt.

```
// ---- Kontinuierlich (z.B. alle 1 Spielminute) ----
für jede Armee mit Bewegungsbefehl:
    tempo = basisTempo[einheitstyp][territoriumsTyp]
          * (railway ? 2.5 : 1.0)
          * (forcedMarch ? 1.5 : 1.0)
          * mobilizationFaktor
          * healthSpeedFaktor        // >=60% HP: 1.0, 0% HP: 0.2
    tempo = min über alle Einheiten im Stack        // langsamste bestimmt
    position += tempo * dt
    prüfe Kollision mit feindlichen Armeen / Provinzzentren -> Kampf

für jede Provinz:
    ressourcen += tagesProduktion * dt / 24h
    baufortschritt += dt * moralSpeedFaktor         // 80% Moral = 1.0

// ---- Stündlich (Combat Tick) ----
für jedes laufende Gefecht:
    if verteidigerIstEntrenched:
        schaden(A -> B, A.offensiv, B.defensiv)
    else:
        schaden(A -> B, A.offensiv, B.defensiv)
        schaden(B -> A, B.offensiv, A.defensiv)

funktion schaden(von, nach, angriffsStat, verteidigungsStat):
    roh = 0
    für jede Einheit u in von.stack (aufsteigend indiziert i):
        beitrag = i < 20 ? 1.0 : max(0, 1.0 - (i-20)/30)
        roh += u.stat(zielklasse(nach))
             * terrainFaktor(u, von.terrain)
             * moralFaktor(u)               // Infanterie: linear bis 55%, dann konstant
             * healthDamageFaktor(u)        // 100% HP: 1.0, 0% HP: 0.5
             * mobilizationFaktor(u)
             * beitrag
    roh *= random(0.90, 1.10)               // kein Miss
    verteileGleichmaessig(roh, nach.stack, gewichtetNachDamageArea)
    if ziel == provinzZentrum:
        gebaeude.hp   -= summe(buildingDamage)
        provinz.moral -= summe(moraleDamage)

// ---- Day Change (1x pro Spieltag) ----
für jede Provinz:
    target = 102
           + fortLevel*5 + (railwayAktiv ? 15 : 0) + (harbour ? 10 : 0)
           + factoryLevel*4 + (istHauptstadt ? 10 : 0)
           + nachbarBonus - nachbarStrafe          // ±1 je 10 Punkte über/unter 80
           - feindNachbarn*5
           - min(30, feindEinheitenImGebiet)
           - hauptstadtDistanzStrafe               // max 35
           - expansionsStrafe                      // 6%..50% Provinzanteil -> 0..35
           - (hatHauptstadt ? 0 : 40)
           - ressourcenmangelStrafe                // ungedeckelt
    current += (target - current) / 7
    produktion = basis * (0.20 + 0.80 * current/100)
               * (1 + railway*0.33 + harbour*0.25 + factoryLevel*0.0825)
    if current < 33:
        chance = (33 - current) * 3
        if garnisonsVerteidigung < chance und würfel(chance): aufstand()

für jede Einheit:
    moral   += (provinzMoral - moral) / 5
    condition += (100 - condition) * 0.17          // nur eigenes Gebiet / Marine überall

zahleUpkeep()      // 20 Getreide + 5 Öl je Einheit; 500 Kohle je Railway;
                   // 1000 Getreide + 500 GBP je Barracks-Level; 250 GBP je Recruitment Office
                   // 800 t Food + 800 t Material + 800 t Energy je Provinz
führeSpionageAktionenAus()
berechneIndexOfPower()
veroeffentlicheZeitung()
```

**Reihenfolge-Hinweis [A]:** Der Day Change muss Moral **vor** Produktion und Aufstandswurf aktualisieren, da beide von der neuen Moral abhängen. Ressourcenmangel wiederum wird aus der Bilanz des Vortages ermittelt — hier ist eine explizite Reihenfolgeentscheidung nötig, die die Quellen nicht klären → **[S]**.

---

## 14. Offene Fragen / nicht belegbar

Sortiert nach Auswirkung auf den Klon.

### 14.1 Hoch — blockiert originalgetreues Balancing

1. **Aktuelle Hitpoint- und Damage-Werte aller Einheiten (post-2023).** Bytro hat alle Werte mit einem unbekannten Faktor skaliert und danach einzeln nachjustiert; die Werte stehen nur im Spiel-Client. Beide Fan-Wikis zeigen widersprüchliche Pre-2023-Skalen (6.2). **Schätzung nötig.**
2. **Attack- und Defense-Werte getrennt.** Das Handbuch erwähnt ausdrücklich, dass jede Einheit getrennte Angriffs- und Verteidigungswerte pro Zielklasse hat — **keine einzige Quelle listet sie**. **Schätzung nötig.**
3. **Damage-Area-Werte** für alle Einheiten außer Infantry (0,5), Cavalry (0,75) und Transport Ship (0,75). **Schätzung nötig.**
4. **Building Damage und Morale Damage** als eigene Werte pro Einheit (post-2023 eingeführt). Nur die alte 1/25-Faustregel ist belegt. **Schätzung nötig.**
5. **Index-of-Power-Formel.** Die offizielle `PointFormula.pdf` ist offline (HTTP 404). Gewichtung von Provinzen vs. Gebäuden vs. Moral unbekannt. Vorschlag in 10.4. **Schätzung nötig.**
6. **Gebäude-Hitpoints** und wie schnell sie unter Beschuss fallen. Nur der 10-HP-Funktionspuffer ist belegt. **Schätzung nötig.**

### 14.2 Mittel — betrifft Systemverhalten

7. **Kosten und Stats von Cavalry und Heavy Tank.** Beide Wiki-Seiten sind Stubs. Nur Bauzeiten sind belegt (5.2). **Schätzung nötig.**
8. **Steuerformel** (Geld pro Provinz pro Tag) und wie stark Moral/Gebäude darauf wirken. **Schätzung nötig.**
9. **Mobilization-Kurve**: wie genau Ölmangel in Prozentpunkte Mobilization umgerechnet wird. **Schätzung nötig.**
10. **Ressourcenmangel-Strafe**: die Quelle beschreibt nur qualitativ ("skaliert mit Hauptstadtdistanz und Höhe des Negativstands, kein Cap"). Keine Formel. **Schätzung nötig.**
11. **Widerspruch Moraldrift: 1/7 vs. 20–25 % pro Tag** (4.1). Beide Quellen sind offiziell bzw. aktuell — nicht auflösbar.
12. **Widerspruch Aufstandsschwelle: 33 vs. 30 Moral** (4.5).
13. **Widerspruch Aerodrome**: Voraussetzung zur *Produktion* von Flugzeugen oder nur zum *Starten*? Drei Quellen, zwei Aussagen (5.1).
14. **Widerspruch Submarine-Kosten**: 15.000 GBP (s1914-Wiki) vs. 20.000 GBP (supremacy1914-Wiki); Kohle vs. Holz als zweite Ressource (6.1).
15. **Widerspruch Moralboni-Einheit**: Punkte (2024er Stand) vs. Prozent (alte Infoboxen) für Fortress/Railway/Harbour/Factory (4.3).
16. **Mindest-Moralvoraussetzungen** für alle Gebäude außer Railroad (50), Barracks Lvl 1 (30) und Harbor (50).
17. **Exakte Uhrzeit/Zeitzone des Day Change** in Supremacy 1914 (bei WW3 belegt: Mitternacht GMT+1).
18. **Fortress-Level-Gating**: ab welchem Spieltag welches Festungslevel baubar ist.
19. **Goldmark-Preise** für Bau-/Rekrutierungsbeschleunigung, Truppenmoral-Boost und Armee-Heilung. Nur die Instant-Espionage-Preise und der Moral-Boost (500 GM) sind belegt. *(Für den Klon irrelevant, da gestrichen.)*

### 14.3 Niedrig — nur Vollständigkeit

20. **Provinzzahlen der Karten** stammen aus einer Websuche-Zusammenfassung eines Forumsthreads, der direkt nicht abrufbar war (Cloudflare 502). Nicht primärverifiziert.
21. **Terrain-Modifikatoren in WW3** (Attack/Defense/Speed/HP je Terraintyp) — Konzept belegt, Zahlen nicht.
22. **Rückzugsregeln in Supremacy 1914** — ob es überhaupt Sonderregeln gibt, ist unklar.
23. **Genaue Wirkung der „Damage Area"** — die Interpretation als Trefferflächen-Gewichtung ist abgeleitet, nicht belegt.
24. **Zeppelin** (Event-Einheit April 2024): nur Reichweite 350 und "hoher Gebäudeschaden" belegt.

### 14.4 Methodische Warnung

Die drei genutzten Fan-Wikis (`s1914.fandom.com`, `supremacy1914.fandom.com`, `conflictofnations.wiki.gg` / `wiki.conflictnations.com`) sind **unterschiedlich gepflegt und teils jahrealt**. Das offizielle Bytro-Forum (`forum.supremacy1914.com`), das die maßgeblichen Datenblätter und die „Formula & Data Spreadsheet"-Threads enthält, war während der gesamten Recherche **nicht erreichbar (HTTP 502 hinter Cloudflare)**. Sollte es wieder verfügbar sein, sind vor allem diese Threads nachzuholen:

- Thread 11 „Formula & Data Spreadsheet"
- Thread 9 „Game Mechanical Index"
- Thread 1994 „Map Information (n° of players, provinces …)"
- Thread 2936 „Logistics calculations"
- `forum.supremacy1914.com/index.php?5-units-en/` (offizielle Einheitentabelle)

---

## 15. Quellen

### 15.1 Primärquellen (offiziell, Bytro)

| Quelle | URL | lokal |
|---|---|---|
| **Supremacy 1914: Official Game Manual** (Steam-Guide, vollständiges Handbuch) | https://steamcommunity.com/sharedfiles/filedetails/?id=1749425523 | `_raw/manual_body.txt`, `_raw/steam_manual.txt` |
| **Game mechanics update — 2023-01-10** (das Combat-/Moral-Rework) | https://bytro.helpshift.com/hc/en/3-supremacy-1914/faq/288-game-mechanics-update---2023-01-10/ | `_raw/hs_288.txt` |
| **Release notes — 2023-02-21** (Festungs-, Fabrik-, Damage-Area-Balancing) | https://bytro.helpshift.com/hc/en/3-supremacy-1914/faq/318-release-notes---2023-02-21/ | — (per curl abgerufen) |
| Bytro Help Center: The Index of Power | https://bytro.helpshift.com/hc/en/3-supremacy-1914/faq/1-... | `_raw/hs_1.txt` |
| Bytro Help Center: Game Rounds | — | `_raw/hs_2.txt` |
| Bytro Help Center: What are Goldmarks? | https://bytro.helpshift.com/hc/en/3-supremacy-1914/faq/3-what-are-goldmarks/ | `_raw/hs_3.txt` |
| Bytro Help Center: Long-term strategy / Diplomacy / Resources / Alliances | — | `_raw/hs_5.txt`, `hs_7.txt`, `hs_47.txt`, `hs_107.txt`, `hs_index.txt` |
| Bytro Help Center (WW3): „Why doesn't the speed change on 4x maps?" | https://bytro.helpshift.com/hc/en/6-supremacy-ww3/faq/323-why-doesn-t-the-speed-change-on-4x-maps/ | — |
| Bytro Help Center (WW3): Common Questions, Units/Economy/Research, Diplomacy | https://bytro.helpshift.com/hc/en/6-supremacy-ww3/ | `_raw/ww3/sec_*.txt`, `_raw/ww3/faq_*.txt` |
| **Steam-Store: SUPREMACY: WORLD WAR 3** (App 784950) | https://store.steampowered.com/app/784950/ | `_raw/ww3/steam_784950.txt` |
| Steam-Store: Supremacy 1914 (App 979920) | https://store.steampowered.com/app/979920/Supremacy_1914/ | — |
| Offizielle Punkteformel (**offline, HTTP 404**) | http://www.supremacy1914.com/fileadmin/files/PointFormula.pdf | `_raw/pf.pdf` (Fehlerdokument) |

### 15.2 Fan-Wikis Supremacy 1914

| Quelle | URL | lokal |
|---|---|---|
| **supremacy1914.fandom.com — Morale** (beste Formelquelle, Stand 2024) | https://supremacy1914.fandom.com/wiki/Morale | `_raw/s1914_Morale.txt` |
| supremacy1914.fandom.com — Economics and Resources | https://supremacy1914.fandom.com/wiki/Economics_and_Resources | `_raw/s1914_Economics_and_Resources.txt` |
| supremacy1914.fandom.com — Units / Resources / Espionage / Diplomacy / Newspaper / Buildings | https://supremacy1914.fandom.com/wiki/Units | `_raw/s1914_*.txt` |
| supremacy1914.fandom.com — Einheiten- und Gebäudeseiten (Infoboxen) | .../wiki/Infantry, /Artillery, /Tank, /Railgun, /Battleship, /Submarine, /Balloon, /Fortress, /Factory, /Harbour, /Railway, /Barracks, /Workshop, /Recruitment_Office, /Airfield | `_raw/u_*.txt` |
| **s1914.fandom.com — Warfare** (Geschwindigkeitstabelle, Ein-/Ausschiffung, Upkeep) | https://s1914.fandom.com/wiki/Warfare | `_raw/w_warfare.txt` |
| s1914.fandom.com — Factory (Produktionszeit-Matrix) | https://s1914.fandom.com/wiki/Factory | via MediaWiki-API |
| s1914.fandom.com — Einheiten-/Gebäude-Infoboxen | https://s1914.fandom.com/wiki/{Infantry,Artillery,Tank,Railgun,Battleship,Light_Cruiser,Submarine,Armoured_Car,Balloons,Bomber,Fighter,Fortress,Harbor,Harbour,Railway,Barracks,Workshop,Workshops,Recruitment_Center,Aerodrome,Capital} | via MediaWiki-API |
| s1914.fandom.com — Game Mechanics 101 / Economy / Province Administration / Diplomacy | https://s1914.fandom.com/wiki/Game_Mechanics_101 | `_raw/gm101.txt` |

### 15.3 Fan-Wikis WW3 / Conflict of Nations

| Quelle | URL | lokal |
|---|---|---|
| **wiki.conflictnations.com — Combat** (Engagement-Typen, Echelons, AA, Heilung, Retreat) | https://wiki.conflictnations.com/Combat | `_raw/ww3/wiki_Combat.txt` |
| wiki.conflictnations.com — Provinces / Production / Victory / Insurgents / Field of View / Military Doctrine / Support / Submarines / Coalition / Diplomatic Status / Seasons | https://wiki.conflictnations.com/ | `_raw/ww3/w2_*.txt`, `w3_*.txt`, `w4_*.txt` |
| **conflictofnations.wiki.gg — Morale** (explizite Formeln) | https://conflictofnations.wiki.gg/wiki/Morale | `_raw/ww3/wg_Morale.txt` |
| conflictofnations.wiki.gg — Units / Gold / Research / Maps / Buildings / Resources / Combat / Espionage | https://conflictofnations.wiki.gg/wiki/Units | `_raw/ww3/wg_*.txt` |

### 15.4 Community-Werkzeuge und Sonstiges

| Quelle | URL |
|---|---|
| dxter's Supremacy 1914 Battle Calculator — Hilfeseite (Reichweiten, Patrouillen-Ticks) | https://dxcalc.com/share/s1914.info.html |
| Offizielles Forum (**während der Recherche durchgängig HTTP 502**) | https://forum.supremacy1914.com/ |
| Map-Informationen (Spieler-/Provinzzahlen, via Websuche-Zusammenfassung des Forumsthreads 1994) | https://forum.supremacy1914.com/forum/index.php?thread/1994-map-information-.../ |
| Levelwinner Beginner's Guide 2024 | https://www.levelwinner.com/supremacy-1914-beginners-guide-tips-tricks-strategies-to-conquer-the-world/ |
| Stillfront-Pressemitteilung (neue Karten/Features) | https://www.stillfront.com/en/bytro-releases-new-map-new-features-for-supremacy-1914/ |
