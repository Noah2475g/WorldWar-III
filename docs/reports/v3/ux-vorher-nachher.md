# UX V3: Zahlen vorher und nachher je Aufgabe (T-M46-12)

Nur Zahlen und Quelle, kein Urteil (das fällt ein frischer Agent, PLAN-V3 Phase 2 Punkt 2). Alle Läufe am Dev-Server
(Port 5331), Zählwerte, keine Millisekunden als Beleg (Regel 5). „Vorher“ = `docs/ux/v3-before/` bzw. der
Ausgangswert der jeweiligen Bahn; „nachher“ = Stand `9be3821` (Symbol-Durchgang) mit umgestellten Messskripten.
Neu gemessen am 2026-10-04: `docs/ux/v3-after/aufgaben.json` (ux-tasks, S300, 1280x800, 16 Läufe, alle erreicht) und
`docs/ux/v3-after/messwerte-spaet.json` (ux-late, S100/S300/S575/S575G, 375x667, 1280x800, 1920x1080 ohne Bild;
0 Fehlschritte in 12 Läufen, axe wcag2a/aa: 0 Verstöße, Bilder nicht neu aufgenommen). Die übrigen Werte stammen aus den
Bahnberichten und ihren eingecheckten Rohdaten (Spalte Quelle).

| Aufgabe | Kennzahl (Stand, Fenster) | vorher | nachher | Quelle |
|---|---|---|---|---|
| T-M46-01 Heer | Armee finden und bewegen, Tastatur (S300) | 46 Tasten (37 Tab) | 8 Tasten | `v3-before/aufgaben.json`, `v3-after/aufgaben.json` |
| | Armee finden und bewegen, Maus | 5 Klicks | 5 Klicks | dieselben |
| | Armeezeichen als DOM-Element; Marschzielliste (Einträge/erreichbar) | 0; 237/33 | 0; 237/33 | `begleitmessungen` |
| | Knopf „Auswählen“ mit Armeenamen | ohne Namen (`aria-label` null) | „Auswählen: Armee 3172“ | `begleitmessungen.auswaehlenKnoepfe` |
| T-M46-02 Überblick | Protokollzeilen S575G 1280x800 (alle Tage / „alles“-Ansicht ux-late) | 71 (bis 35 je Tag, 59 % mit Sprung) / 81 | 17 (bis 7 je Tag, 88 % mit Sprung) / 25 | Bahnbericht U-Layout; `messwerte-spaet.json` Szene `protokoll-alles` |
| | Sichtbare Zeilen im Fuß (S575G 1280x800) | 13 (Fuß 167 px) | 6 (Fuß 195 px) | `messwerte-spaet.json` |
| | Ereignisse mit Ort, die am Ort pulsieren | – | 9–11 Orte in 25 s bei Tempo 10 | Bahnbericht U-Layout |
| T-M46-03 Stapel | Vollständig verdeckte Armeemarker S575G (Maßstab 0,5/1/2/4/8) | 208/208/208/208/210 von 237 | 0/0/0/0/0 | `docs/reports/v3/ubild-vorher.json`, `-nachher.json` |
| | Teilweise überdeckt (Maßstab 1/2/4/8) | 0/7/17/23 | 1/25/109/145 | dieselben |
| T-M46-05 Kürzel | Tastatur, Armee bewegen / teilen / bauen / ausheben | 46 / 40 / 19 / 31 | 8 / 6 / 4 / 5 | `aufgaben.json` vorher/nachher |
| | Tastatur, Krieg / Frieden / Handel / Spion | 34 / 39 / 60 / 27 | 6 / 2 / 16 / 11 | dieselben |
| | Maus-Klicks, alle acht | 5/3/2/2/4/3/5/4 | 5/3/2/2/4/3/5/4 | dieselben |
| T-M46-06 Diplomatie | Bildläufe Maus Krieg / Frieden / Handel (S300) | 2 / 1 / 2 | 0 / 0 / 0 | `aufgaben.json` |
| | Handlungen unter dem Falz S575G (Handel y=1550 von 566) | 5 von 5 | 0 von 5 | Bahnbericht U-Layout, `layout-vorher.json`, `layout-nachher.json` |
| T-M46-08 Alarmchip mp | Chip im Mehrspieler belegt (375x667 / 1280x800) | nie belegt | belegt nach 49 s, 169x44 im Bild | `v3-after/mp-alarmchip.json` |
| | Chip-Lage im Einzelspieler S575G 375x667 (x, Breite x Höhe) | x=1116 (außerhalb), 113x44 | x=8 (im Bild), 169x44 | `messwerte-spaet.json` Szene `tempo-100-alarm` |
| T-M46-10 Telefon | Kopfelemente im Bild S575G 375x667; Kopfbreite | 5 von 17; 1561 px | 13 von 13; 375 px | Bahnbericht U-Layout, `layout-vorher.json` |
| | Kopfhöhe 375x667 (S300 / S575G, ux-late) | 97 / 97 px | 150 / 150 px | `messwerte-spaet.json` |
| | Seitenleiste S575G 375x667; Karte mit Panel | 261 px = 39 %; 31 % | 334 px = 50 %; 27,5–30,1 % | Bahnberichte U-Layout, U-Symbol |
| | Protokoll-Blatt auf dem Telefon (Höhe, Filter, sichtbare Zeilen) | 44 px, ohne Filter, 1 Zeile | 367 px, 6 Filter, 7 Zeilen | Bahnberichte U-Layout, U-Symbol |
| T-M46-11 Rückmeldung | „befohlen“ im Bild bei Tempo 1 / 10 / 100 | 687 / 269 / 111 ms | 1658 / 1646 / 1652 ms | `begleitmessungen.rueckmeldungJeTempo` (Zeit, nur Nebenwert) |
| | Aufstandshinweise S575G 1280x800 (Höhe, Zeilen); bei 375 | 352 px, 8 Zeilen; 548 px | 142 px, 1 Zeile; 198 px | Bahnbericht U-Layout, `rueckmeldung-*.json`, `layout-*.json` |
| T-M46-13 Symbole | Textanteil Kopf / Provinzpanel / Armeepanel S575G 1280x800 | 0,928 / 0,856 / 0,944 | 0,454 / 0,332 / 0,264 | Berichte U-Bild und U-Symbol, `ubild-*.json`, `usymbol-*.json` |
| | Symbole im Kopf / Provinz- / Armeepanel | 11 / 22 / 14 | 14 / 25 / 21 (nach U-Bild, vor U-Symbol) | `ubild-nachher.json` |
| T-M46-14 Klang | Ereignisarten mit eigenem Klang | 3 von 7 | 8 von 8 (Kenney, CC0) | Bahnbericht U-Bild |
| T-M46-15 Moralsperre | Text bei gesperrtem Ausheben | Satz ohne Zahl | „Moral 23 von 25 nötig …“ | Bahnbericht U-Layout (Test `recruitActions`) |
| T-M46-17 Textanteil | Kopf / Provinz / Armee / Alarmliste / Protokoll S575G 1280x800 | 0,835 / 0,816 / 0,930 / 0,981 / 0,992 | 0,454 / 0,332 / 0,264 / 0,288 / 0,465 | `usymbol-vorher.json`, `usymbol-nachher.json` |
| | S300: Provinzpanel (nicht Teil der Vorgabe) | – | 0,647 | `usymbol-nachher.json` |

## Begleitwerte (Hinweis, kein Beleg)

| Kennzahl | vorher | nachher | Quelle |
|---|---|---|---|
| Tab-Stationen gesamt / bis Provinzliste / davon Protokoll und Fuß (S300 1280x800) | 86 / 19 / 56 | 38 / 19 / 15 | `begleitmessungen.tabfolgeStart` |
| Tempo 100, 25 s Dev-Server, Bilder > 50 ms von Bildern (S100 / S300 / S575 / S575G, 1280x800) | 179 von 192 / 205 von 216 / 39 von 3056 / 5 von 15 | 75 von 2347 / 22 von 2646 / 5 von 3600 / 4 von 34 | `messwerte-spaet.json` Szene `tempo-100-alarm` (die Bildzahl je Lauf schwankt stark; Dev-Server) |
| Bündel, Tempo 100, 5 s, `ux-capture --bundle --state` (Funktionsprobe, 1920x1080) | – | S500: 99,39 Ticks/s, S300: 100,22 Ticks/s, je 0 Bilder > 50 ms | Lauf vom 2026-10-04, nur Hinweis (Regel 5) |
| axe wcag2a/aa Verstöße ux-late | 0 | 0 | `messwerte-spaet.json` |
| Fehlgeschlagene Schritte ux-late | 0 | 0 | dieselbe |

## Hinweise zur Vergleichbarkeit

- Die Messskripte suchten Knöpfe teils über Wörter im Text („Auswählen“, „Zusammenlegen“); seit dem Symbol-Durchgang tragen sie
  den Namen als `aria-label`. Die Skripte lesen jetzt `aria-label` vor `textContent`; die Zählregeln blieben gleich.
  Die Ankunft einer marschierenden Armee steht als „380 · 03:00“ statt „Ankunft Tag 380“; der Erfolgstest erkennt beide Formen.
- In `messwerte-spaet.json` (nachher) nennen die Szenen Bildnamen (`image`), die nicht neu aufgenommen wurden; die Bilder
  liegen in `docs/ux/v3-before/` und, für die Welle-2/3-Bahnen, in `docs/ux/v3-after/`.
- Szene `diplomatie-macht` (nachher, Stand `9be3821`): `layout.header.y` war −82 bzw. −74/−78, die App war dort nach oben gerollt. **Behoben** in der Nachbesserung U (Abschnitt unten, Punkt 1).

## Nachbesserung (V3 Phase 2, Bahn U, 2026-10-04)

Abarbeitung der Nachbesserungsliste des Prüfers (`bericht-abgleich.md`). Zählwerte, keine Millisekunden (Regel 5). Ausgangswert =
Stand `41f0c9d` (Ende der Welle 3), Dev-Server Port 5331; für die „vorher“-Zahlen des Protokolls zusätzlich der Stand `41710c4`
(main, vor allen UX-Änderungen) auf Port 5332. Rohdaten: `docs/ux/v3-after/nachbesserung-diplomatie.json`,
`docs/ux/v3-after/layout-nachbesserung.json`, `docs/reports/v3/unachbesserung-textanteil.json`, `ereignisort.json`, `treffer.json`.
Bilder (nur 1280x800/375x667, Einträge in `docs/ASSETS.md`): `S575G-nachher2-tastenhilfe-1280x800.png`,
`S575G-nachher2-diplomatie-1280x800.png`, `S575G-nachher2-karte-375x667.png`.

### 1 · Diplomatie-Kopfverschiebung (Szene `diplomatie-macht`)

Ursache: Beim Wählen einer Macht rief das Diplomatiepanel `block.scrollIntoView({ block: 'start' })` auf. `scrollIntoView` rollt
**jeden** Vorfahren mit Rollbereich, auch die mit `overflow: hidden`; so schob es die ganze App (`.app`, 100vh) um die Kopfhöhe
nach oben. Behoben mit `ui/scrollWithin.ts` (rollt nur den nächsten Rollrahmen, die Seitenleiste); Altzeile mit LOESCHVERMERK Nr. 55.
Test: `Panels.test.tsx` „Machtwahl rollt nur die Seitenleiste“ (schlägt mit `scrollIntoView` fehl, besteht mit dem Fix).

| Kennzahl | vorher | nachher |
|---|---|---|
| `header.y`, Desktop (S100/S300/S575 bei 1280 und 1920, S575G bei 1280 und 1920: 8 Läufe) | −74 / −78 / −82 | **0 in allen 8** |
| `header.y`, Telefon 375x667 (4 Läufe) | 0 | 0 |
| `foot.y` S575G 1280x800 | 522 | 604 (mit dem Fuß von 168 px siehe Punkt 2: 632) |
| Bild | `S575G-nachher-diplomatie-1280x800.png` (Kopf fehlt) | `S575G-nachher2-diplomatie-1280x800.png` (Kopf da) |

### 2 · T-M46-02 Überblick

| Kennzahl | vorher | nachher |
|---|---|---|
| Hörbare Ereignisarten mit Ort (Puls und Sprung) | 7 von 8: `DIPLOMACY_CHANGED` hatte einen Ton, aber keinen Ort | **8 von 8** (`placeOf`: Hauptstadt der Gegenseite, wie beim Krieg) |
| Quote hörbarer Ereignisse mit Puls UND Sprung (S100/S300/S575, je 720 Ticks mit KI, jede der Mächte als Betrachter) | – | **2142 von 2142 = 100 %** (BATTLE_STARTED 696, UNIT_RECRUITED 710, ARMY_INTRUDED 396, PROVINCE_CAPTURED 236, BUILD_COMPLETED 104) |
| Test für alle 8 Arten (Ort + Puls je Art) | – | `overview.test.ts` „jede Ereignisart mit Ton hat einen Ort“ |

Grenze der Messung: In den 720 Ticks kamen WAR_DECLARED, RESOURCE_SHORTAGE und DIPLOMACY_CHANGED nicht vor; sie sind nur durch den Einheitentest belegt, nicht durch den Lauf.

**Sichtzeilen 6 gegen 20, geklärt:** `ux-late` zählte alle `li` des Protokolls im Fenster (nach „alles“ und ohne den Kasten des Protokolls),
`ux-layout` alle `li` im Kasten (auch verschachtelte Teile und Berichtsbilanzen, die den Kasten nur streifen). Beide zählten Verschiedenes.
**Verfahren ab jetzt** (`ux-layout.mjs`, Feld `fullRows`): Protokollzeilen (`.log__row`), die **ganz** im Rollrahmen des Protokolls und im
Fenster liegen (1 px Toleranz), Stand S575G frisch geladen, 1280x800, Standardfilter.

| Kennzahl (S575G 1280x800, `fullRows`-Verfahren) | `41710c4` (vor UX) | `41f0c9d` (vor Nachbesserung) | nachher |
|---|---|---|---|
| Ganze Zeilen im Fuß | 6 | 3 | 3 |
| Zeilenhöhe | 20 px | 33 px | 27 px (Zeichen 26 → 20 px, Textanteil Protokoll 0,465 → 0,435) |
| Fußhöhe | 168 px | 196 px | **168 px** (Karte 65,2 → 68,8 % der Höhe) |
| Zeilen im DOM | 81 | 22 | 22 |

Bewertung: Die Fußhöhe 196 px war der Preis der 26-px-Zeichen (Textanteil des Protokolls ≤ 0,5); mit 20-px-Zeichen genügt 168 px. Die Zahl
der ganzen Zeilen halbiert sich gegenüber `41710c4` (6 → 3), dafür steht eine Zeile jetzt für viele (Sammelzeilen: bis 7 statt 35 Zeilen je
Spieltag). Ob das für den Überblick reicht, kann nur Noah sagen. Die Zeilenhöhe 27 px ist die Untergrenze (Zielgröße 24 px).

### 3 · T-M46-03 Stapel

| Kennzahl (S575G, 237 Armeen, 193 eigene; Maßstab 0,5 / 1 / 2 / 4 / 8) | vorher | nachher |
|---|---|---|
| Eigene Armeen, Klick auf die Mitte wählt sie | 193 von 193 in jedem Maßstab | 193 von 193 in jedem Maßstab |
| Klick auf einen sichtbaren Punkt der eigenen Marker wählt den richtigen (Punkte im 7x5-Raster je Marker) | 6755/6755, 6752/6752, 6696/6708, 5381/5811, 3797/4769 | **6755/6755 in jedem Maßstab** |
| Vollständig verdeckt | 0 / 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 / 0 |
| Teilweise verdeckt | 0 / 1 / 25 / 109 / 145 | **0 / 0 / 0 / 0 / 0** |
| Mittlere Verschiebung vom Ort (Maßstab 4 / 8) | 87 / 95 px | 118 / 155 px (der Preis) |
| Aufrufe von `overlapAt` bei Maßstab 8 | 37 871 | 114 414, mit Zahlen- statt Zeichenkettenschlüsseln (keine neun Zeichenketten je Aufruf mehr) |

Änderung: `DECLUTTER_RADIUS` 96 → 256 (LOESCHVERMERK Nr. 56) und Zahlenschlüssel in `declutter`. Fremde Armeen sind per Karte nicht wählbar
(`pickArmy`: nur eigene tragen Befehle); der Klick trifft die Provinz darunter. `render.bench.slow.test.ts` kompiliert (`tsc --noEmit` grün); die
Zeitmessung läuft nicht hier, sondern im Rechnerfenster des Orchestrators. Offen: ob der Radius bei Maßstab 8 (Marker bis 276 px vom Ort)
Noah zu weit vom Ort weg ist; Alternative wäre eine Sammelzeichen-Darstellung bei weitem Zoom.

### 4 · T-M46-17 / -13 Textanteil und Symbole

Textanteil = Textfläche / (Textfläche + Symbolfläche), `ux-bild.mjs`, 64 Messungen (S300 und S575G, 1280x800 und 375x667, Kopf, Seitenpanel,
Alarmliste, Protokoll; auf dem Telefon zusätzlich das aufgeklappte Blatt). **Größter Wert nachher: 0,498.**

| Ansicht | vorher | nachher |
|---|---|---|
| S575G 375x667 Kopf | 0,610 | 0,498 |
| S575G 375x667 Protokoll (geschlossen / Blatt) | 0,759 / 0,694 | 0,480 / 0,472 |
| S300 375x667 Kopf | 0,563 | 0,462 |
| S300 375x667 Protokoll (geschlossen) | 0,614 | 0,267 |
| S300 375x667 Provinzpanel | 0,527 | 0,488 |
| S300 1280x800 Provinzpanel | 0,647 | 0,473 |
| S575G 1280x800 Kopf / Provinz / Armee / Alarme / Protokoll | 0,454 / 0,332 / 0,264 / 0,288 / 0,465 | 0,454 / 0,328 / 0,244 / 0,288 / 0,435 |

Änderungen: Zeichen im Kopf des Telefons größer, wo der Knopf ohnehin 44 px hoch ist (Menüknöpfe 18 → 28, Tempo 11/16 → 22, Alarmchip 14 → 26,
Rohstoffe 20 → 22 px; Uhrtext 12 → 11 px); Protokollzeile auf dem Telefon 14 → 28 px (die Zeile ist 44 px hoch); Spionage-Handlungen als Zeichenknöpfe
(Name im Tooltip und `aria-label`, Sperrgrund als `aria-description`); Panelüberschrift 18 → 16 px. Preis: Kopf Telefon 150 → 154 px, Karte mit
Panel 27,5 → 26,9 %; Protokollblatt auf dem Telefon 7 → 6 Zeilen im Bild. Die Zahlen, die Spieler brauchen (Rohstoffe, Tempo, Tag und Uhr), blieben sichtbar.

**Symbolabdeckung** (`icons.test.tsx`, gegen `data/rules/default`): Einheiten 10 von 10, Gebäude 7 von 7, Rohstoffe 7 von 7 mit Symbol (24 von 24), kein Schlüssel ohne Regel.

**Zeichenknöpfe im Armeepanel** (`ux-bild.mjs`, Feld `knoepfe`): S575G 1280x800: 13 Knöpfe, 12 reine Zeichenknöpfe, davon **12 mit Tooltip und `aria-label`**
(der 13. ist der Sprung zu „Indien“); 375x667: 19 Knöpfe, 17 Zeichenknöpfe, 17 mit beidem. Neu: der Tooltip eines Zeichenknopfes beginnt mit dem Namen
(vorher nur Hinweis oder Sperrgrund, oder gar keiner). Die Lernbarkeit der Zeichen selbst bleibt ungemessen (nur Noah kann sie urteilen).

### 5 · T-M46-05 Tastenhilfe, T-M46-14 Klang

| Kennzahl | vorher | nachher |
|---|---|---|
| Tastenhilfe mit A, P, B, E sichtbar | ohne Bild | `S575G-nachher2-tastenhilfe-1280x800.png` (21 Zeilen) |
| Kollisionstest über 77 Tasten (26 Buchstaben klein und groß, 10 Ziffern, 15 Sondertasten) | nur 10 Buchstaben | **0 Kollisionen**; 10 belegte Buchstaben (a b d e f h l m p s), alle 10 genau einmal in der Tastenhilfe, jede genannte Taste belegt (`keyboard.test.ts`) |
| Klangarten mit eigenem Klang | 3 von 7 | 8 von 8 |

Der Nenner 7 gegen 8: Vorher hatten **7** Ereignisarten einen Ton (BATTLE_STARTED, PROVINCE_CAPTURED, BUILD_COMPLETED, UNIT_RECRUITED, RESOURCE_SHORTAGE,
WAR_DECLARED, ARMY_INTRUDED); nur drei davon teilten ihren Klang mit keiner anderen (Bau und Aushebung hatten einen, Krieg und Einmarsch einen). Mit T-M46-14 kam
**DIPLOMACY_CHANGED** als achte hörbare Art dazu (vorher stumm). Auf gleichem Nenner 8 gerechnet: vorher 3 von 8 mit eigenem Klang, nachher 8 von 8; 9 Aufnahmen für
9 Klangnamen (der neunte ist „select“). **Ton-Testlauf:** `sound.test.ts` 25 von 25 grün (darunter „gibt jeder Ereignisart ihren eigenen Klang“).
Wie der Klang klingt und ob er noch nervt, kann nur Noah prüfen.
