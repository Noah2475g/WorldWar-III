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
- Szene `diplomatie-macht` (nachher): `layout.header.y` ist −82 bzw. −74, die Seite ist dort nach oben gescrollt; kein Fehlschritt, Ursache nicht untersucht (vorher 0).
