# ASSETS — Herkunft und Lizenz aller Fremdinhalte

Anforderung R-ASSET-01 verbietet Fremdassets ohne freie Lizenz, R-ASSET-02 lässt nur
gemeinfreie, CC0-, OFL-, MIT-artige und (seit 2026-10-04) CC-BY-Lizenzen zu; bei CC BY stehen
Urheber, Lizenz und Quelle je Datei hier und im Spiel unter „Mitwirkende“.
<!-- LOESCHVERMERK (Review): vorher „R-ASSET-02 lässt nur gemeinfreie, CC0-, OFL- oder MIT-artige Lizenzen zu.“ — geöffnet für CC BY auf Noahs Wort, DECISIONS 2026-10-04. --> Diese Datei ist der Nachweis. Sie
wird von `packages/mapgen/src/sources.test.ts` gegen das Quellenregister im Code geprüft —
eine Quelle, die hier fehlt, lässt den Testlauf scheitern.

## Geodaten — Natural Earth

**Lizenz:** gemeinfrei (Public Domain). Natural Earth verzichtet ausdrücklich auf jede
Namensnennung; sie erfolgt hier freiwillig.

> Made with Natural Earth. Free vector and raster map data @ naturalearthdata.com.

**Bezug:** `node scripts/fetch-geodata.mjs` lädt die Archive nach `data/geo/` (nicht
eingecheckt). Eingecheckt wird nur das Ergebnis der Pipeline, `data/maps/world.json` —
Design D-09: Zur Laufzeit hat das Spiel keine Geodaten-Abhängigkeit und keinen
Netzzugriff (R-FREE-04).

| Datei | Zweck | Adresse |
|---|---|---|
| `ne_10m_admin_1_states_provinces` | Verwaltungseinheiten erster Ordnung, Rohmasse für die Provinzkuration | https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_1_states_provinces.zip |
| `ne_10m_admin_0_countries` | Staatsgrenzen und Landeskennungen | https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_0_countries.zip |
| `ne_10m_ocean` | Meeresflächen, Küstenerkennung, Seewege | https://naciscdn.org/naturalearth/10m/physical/ne_10m_ocean.zip |

Maßstab **1:10 Mio** — die feinste der drei Natural-Earth-Stufen, rund 23 MB. Die
mittlere Stufe 1:50 Mio wäre zehnmal kleiner, untergliedert aber nur neun Länder:
Deutschland, Frankreich und Großbritannien wären dort je eine einzige Provinz gewesen,
und keine europäische Macht hätte die geforderten drei Provinzen erreicht (R-MAP-03).

## Schrift — IBM Plex

**Lizenz:** SIL Open Font License 1.1 (OFL), Wortlaut in
`apps/desktop/src/ui/fonts/OFL.txt`. Quelle: https://github.com/IBM/plex, Stand `v6.4.0`.

| Familie | Wofür |
|---|---|
| IBM Plex Sans | Bedienelemente, Fließtext |
| IBM Plex Sans Condensed | Provinznamen, Kartenlegende |
| IBM Plex Mono | Zahlenkolonnen, Uhrzeit |

Die Namen stehen bewusst ungebrochen in einer Tabelle: `test/guards/no-foreign-assets.test.ts`
sucht jede Familie, die die Oberfläche verlangt, wörtlich in dieser Datei — ein über
zwei Zeilen umgebrochener Name wäre ein Eintrag, den weder Prüfung noch Mensch findet.

**Eingecheckt** unter `apps/desktop/src/ui/fonts/`, zusammen 208 kB:

| Datei | Schnitt | Größe |
|---|---|---|
| `IBMPlexSans-Regular.woff2` | Sans 400 | 61,5 kB |
| `IBMPlexSans-SemiBold.woff2` | Sans 600 | 65,5 kB |
| `IBMPlexSansCondensed-SemiBold.woff2` | Condensed 600 | 36,5 kB |
| `IBMPlexMono-Regular.woff2` | Mono 400 | 44,6 kB |

**Bezug:** `node scripts/fetch-fonts.mjs` holt sie einmalig von der oben genannten
Adresse und prüft jede Datei gegen eine SHA-256-Summe; `--check` prüft die eingecheckten
Dateien, ohne etwas zu laden. Anders als bei den Geodaten wird hier das *Ergebnis*
mitgeliefert: `apps/desktop/src/ui/app.css` bindet die vier Dateien über `@font-face`
mit relativer `url()` ein, damit das Spiel ohne Netz auskommt (R-FREE-04) und auf jedem
Rechner so aussieht wie die freigegebene Richtung A — auch auf einem, der IBM Plex nie
installiert hat.

Das Mockup (`docs/design/ui-mockup.html`) lädt dieselben drei Familien über Google Fonts.
Dass es dieselben sind, prüft `test/design-gate.test.ts`; dass die Anwendung sie
mitbringt statt sie vorauszusetzen, prüft `test/guards/no-foreign-assets.test.ts` — und
zwar so, dass die Zusicherung gegen eine leere Dateimenge fällt. Bis zum 2026-09-06 stand
an dieser Stelle dieselbe Behauptung ohne eine einzige Datei dahinter.

## Alles Übrige

Icons, Kartensymbole, Farben, Klänge und Texte sind selbst erstellt. Die Einheitensymbole
folgen der Formensprache militärischer Lagekarten (Rechteck mit Diagonalkreuz für
Infanterie und so fort) — das ist eine gemeinfreie Konvention, keine Übernahme aus einem
konkreten Werk.

**Ausdrücklich nicht übernommen:** Grafiken, Klänge, Texte oder Daten aus *Supremacy 1914*
oder *Conflict of Nations*. Die Mechanik-Recherche in `docs/research/SUPREMACY-MECHANICS.md`
beschreibt Spielregeln — Regeln sind nicht urheberrechtlich geschützt, ihre Darstellung
schon.

## Icons und Klänge — selbst erstellt

**Icons** (`apps/desktop/src/ui/icons.tsx`): dreizehn Symbole als eingebettetes SVG,
gezeichnet in der Formensprache militärischer Lagekarten — Rechteck mit Diagonalkreuz
für Infanterie, Oval für Panzer, Winkel für Artillerie. Diese Formensprache ist eine
gemeinfreie Konvention, kein Werk; übernommen wurde nichts.

<!-- LOESCHVERMERK (Review): bis T-M46-14 stand hier „Klänge (`apps/desktop/src/ui/sound.ts`): keine Aufnahmen, sondern
erzeugte Töne über die Web-Audio-Schnittstelle — je Ereignis ein Oszillator mit Frequenz, Dauer und Hüllkurve. Nichts wird
geladen, nichts ist lizenziert, nichts wiegt etwas.“ Seit T-M46-14 klingt jede Ereignisart nach einer Aufnahme von Kenney
(Abschnitt „Klänge von Dritten“ unten); die erzeugten Töne in `sound.ts` bleiben nur als Rückfall. -->
**Klänge** (`apps/desktop/src/ui/sound.ts`): Aufnahmen von Kenney (CC0), siehe „Klänge von Dritten“ unten; erzeugte
Töne über die Web-Audio-Schnittstelle bleiben als Rückfall, falls sich eine Datei nicht dekodieren lässt.

## Anwendungssymbol — Eigenerzeugnis, kein Fremdinhalt

**Lizenz:** keine nötig. Das Symbol ist **kein Fremdasset**: es wird von
`scripts/build-icon.mjs` gezeichnet, aus den Farbwerten der eigenen Oberfläche
(`apps/desktop/src/ui/tokens.ts`, Entwurfsrichtung A „Lagekarte"). Es enthält keine fremde
Grafik, keine fremde Schrift und keinen fremden Code — die Datei besteht aus Geometrie
und einem PNG-/ICO-Kodierer über `node:zlib`.

**Warum als Skript und nicht als Bild:** Ein Asset, das niemand neu bauen kann, ist ein
Asset, das niemand ändern kann. `node scripts/build-icon.mjs` erzeugt alle vier Dateien
neu; jede Größe wird **gerendert statt skaliert**, weil die Zeichnung in Einheitskoordinaten
vorliegt.

| Datei | Zweck |
|---|---|
| `apps/desktop/src-tauri/icons/icon.png` | 512 × 512, Grundgröße; von `tauri.conf.json` verlangt |
| `apps/desktop/src-tauri/icons/icon.ico` | 16/24/32/48/64/128/256; **`tauri-build` bricht auf Windows ohne sie ab** und der Bundler verlangt sie zusätzlich in `bundle.icon` |
| `apps/desktop/src-tauri/icons/32x32.png` | Taskleiste und Fensterecke |
| `apps/desktop/src-tauri/icons/128x128.png` | Explorer, Verknüpfungen |

**Das Motiv** ist eine Einheitenmarke auf der Lagekarte — ein Rechteck mit dem
Andreaskreuz, das Kartenzeichen für einen Truppenverband, auf Leinengrund mit
Provinzgrenzen und einer Meeresecke. Zinnoberrot ist im Entwurf für Kampf und Alarm
reserviert und wird auch hier für nichts anderes benutzt; das ist zugleich der Grund,
warum das Symbol bei sechzehn Pixeln noch trägt: **eine** gesättigte Form auf ruhigem
Grund.

## Abbildungen in den Berichten

Kein Fremdinhalt — erzeugt aus den eigenen Kartendateien und deshalb ohne Lizenzfrage. Sie
stehen hier trotzdem, damit niemand sie für zugekaufte Grafik hält.

| Datei | Erzeugt von | Zeigt |
|---|---|---|
| `docs/reports/map-nordamerika.svg` | `node scripts/map-figure.mjs` | Nordamerika vor und nach T-M19-02 |
| `docs/reports/map-groenland.svg` | `node scripts/map-figure.mjs` | Grönland vor und nach dem Beschnitt (T-M19-03) |
| `docs/design/kriegsrat-icons.svg` | von Hand gezeichnet (Entwurf Kriegsrat, 2026-09-10) | Symbolsatz des Kriegsrat-Entwurfs: NATO-Marker, Gebäude, Rohstoffe — eigene Strichzeichnungen, keine Fremdquelle |
| `docs/reports/sichtpruefung-2026-09-14/p1-uhr-vorher.png` | Bildschirmfoto des eigenen Spiels (Brave über CDP, Sichtprüfung 2026-09-14) | die Uhr vor dem Zehn-Sekunden-Fenster bei Tempo 100 |
| `docs/reports/sichtpruefung-2026-09-14/p1-uhr-nachher.png` | dito | dieselbe Uhr danach |
| `docs/reports/sichtpruefung-2026-09-14/p3-tag8.png` | dito | das Transportschiff an Spieltag 8 |
| `docs/reports/sichtpruefung-2026-09-14/p3c-tag68.png` | dito | derselbe Punkt an Spieltag 68 |
| `docs/reports/sichtpruefung-2026-09-14/p4-haltungen.png` | dito | die Haltungen einer Armee im Kriegsrat |
| `docs/reports/sichtpruefung-2026-09-14/p4b-garnison.png` | dito | der Folgebefehl der Garnison |
| `docs/reports/sichtpruefung-2026-09-14/p5-rueckt-nach.png` | dito | die leise Zeile „rückt von selbst nach" |
| `docs/reports/sichtpruefung-2026-09-14/p6-zwischenziele.png` | dito | die Zwischenziele zum Sieg |
| `docs/reports/sichtpruefung-2026-09-14/p7-gefecht-nah.png` | dito | ein Gefecht in der Nahansicht |
| `docs/reports/sichtpruefung-mehrspieler-2026-09-14/1-gast-beitrittsbildschirm.png` | Bildschirmfoto des eigenen Spiels (Brave über CDP, Sichtprüfung Mehrspieler 2026-09-14) | der Beitrittsbildschirm beim Gast, mit allen sechs Angaben |
| `docs/reports/sichtpruefung-mehrspieler-2026-09-14/1a-host-anlegedialog.png` | dito | der Anlegedialog beim Gastgeber, Partieart und feste Geschwindigkeit |
| `docs/reports/sichtpruefung-mehrspieler-2026-09-14/1d-host-lobby-gast-da.png` | dito | die Lobby, sobald der Gast wartet |
| `docs/reports/sichtpruefung-mehrspieler-2026-09-14/2a-lobby-gast-ohne-namen.png` | dito | der Beitrittsknopf ist ohne Namen gesperrt |
| `docs/reports/sichtpruefung-mehrspieler-2026-09-14/2b-lobby-kopiert.png` | dito | der Kopier-Knopf markiert das Feld, statt in die Zwischenablage zu schreiben |
| `docs/reports/sichtpruefung-mehrspieler-2026-09-14/2d-lobby-gast-bereit.png` | dito | der Gast ist bereit, der Gastgeber hat noch nicht gestartet |
| `docs/reports/sichtpruefung-mehrspieler-2026-09-14/3a-host-partie-laeuft.png` | dito | die laufende Partie beim Gastgeber |
| `docs/reports/sichtpruefung-mehrspieler-2026-09-14/3b-gast-partie-laeuft.png` | dito | dieselbe Partie beim Gast |
| `docs/reports/sichtpruefung-mehrspieler-2026-09-14/3c-host-debug.png` | dito | Tick und Pruefsumme des Gastgebers |
| `docs/reports/sichtpruefung-mehrspieler-2026-09-14/3d-gast-debug.png` | dito | Tick und Pruefsumme des Gastes, derselbe Wert |
| `docs/reports/sichtpruefung-mehrspieler-2026-09-14/3e-host-lauf.png` | dito | der Gastgeber nach 245 gemeinsamen Ticks |
| `docs/reports/sichtpruefung-mehrspieler-2026-09-14/3f-gast-lauf.png` | dito | der Gast nach denselben 245 Ticks |
| `docs/reports/sichtpruefung-mehrspieler-2026-09-14/3i-host-kriegserklaerung-des-gastes.png` | dito | die Kriegserklaerung des Gastes, gesehen beim Gastgeber |
| `docs/reports/sichtpruefung-mehrspieler-2026-09-14/3j-gast-kriegserklaerung.png` | dito | dieselbe Kriegserklaerung beim Gast |
| `docs/reports/sichtpruefung-mehrspieler-2026-09-14/3k-gast-befiehlt-im-stillstand.png` | dito | ein Befehl des Gastes bei stehender Uhr |
| `docs/reports/sichtpruefung-mehrspieler-2026-09-14/3l-host-sieht-den-befehl-des-gastes.png` | dito | derselbe Befehl, angekommen beim Gastgeber |
| `docs/reports/sichtpruefung-mehrspieler-2026-09-14/4a-gast-pausenantrag.png` | dito | der Gast stellt den Pausenantrag |
| `docs/reports/sichtpruefung-mehrspieler-2026-09-14/4b-host-antrag-gestellt.png` | dito | der Antrag, wie ihn der Gastgeber sieht |
| `docs/reports/sichtpruefung-mehrspieler-2026-09-14/4c-host-pausiert.png` | dito | der Gastgeber nach der Zustimmung |
| `docs/reports/sichtpruefung-mehrspieler-2026-09-14/4d-gast-pausiert.png` | dito | der Gast am selben Tick |
| `docs/reports/sichtpruefung-mehrspieler-2026-09-14/5a-kopfleiste-zu-zweit.png` | dito | die Kopfleiste im Mehrspieler, ohne Tempoknoepfe |
| `docs/reports/sichtpruefung-mehrspieler-2026-09-14/5b-hinweis-plus.png` | dito | der Hinweis auf die Plus-Taste |
| `docs/reports/sichtpruefung-mehrspieler-2026-09-14/5c-hinweis-vorspulen.png` | dito | der Hinweis auf das Vorspulen |
| `docs/reports/sichtpruefung-mehrspieler-2026-09-14/5d-leertaste.png` | dito | die Leertaste beim Gastgeber |
| `docs/reports/sichtpruefung-mehrspieler-2026-09-14/5e-leertaste-beim-gast.png` | dito | dieselbe Taste beim Gast |
| `docs/reports/sichtpruefung-mehrspieler-2026-09-14/6a-host-wartet-auf-mitspieler.png` | dito | "Warte auf Mitspieler" nach 4,6 Sekunden |
| `docs/reports/sichtpruefung-mehrspieler-2026-09-14/6b-host-mitspieler-ist-weg.png` | dito | der Hinweis mit zwei Knoepfen nach 12,8 Sekunden |
| `docs/reports/sichtpruefung-mehrspieler-2026-09-14/6c-gast-waehrend-des-abbruchs.png` | dito | der Gast waehrend des Abbruchs |
| `docs/reports/sichtpruefung-mehrspieler-2026-09-14/6d-host-nach-der-rueckkehr.png` | dito | der Gastgeber nach der Rueckkehr, 28 Ticks ohne Abweichung |
| `docs/reports/sichtpruefung-mehrspieler-2026-09-14/6e-gast-nach-der-rueckkehr.png` | dito | der Gast nach der Rueckkehr |
| `docs/reports/sichtpruefung-mehrspieler-2026-09-14/mp2-a-host-sieht-niemanden.png` | dito | Befund MP-2: der Gastgeber sieht niemanden |
| `docs/reports/sichtpruefung-mehrspieler-2026-09-14/mp2-b-gast-wartet-vergebens.png` | dito | Befund MP-2: der Gast wartet vergebens |
| `docs/reports/sichtpruefung-mehrspieler-2026-09-14/mp2-c-gast-nach-neuladen.png` | dito | Befund MP-2: erst das Neuladen loeste es |
| `docs/reports/sichtpruefung-mehrspieler-2026-09-14/mp2-d-repariert-host.png` | dito | MP-2 repariert, Gastgeber |
| `docs/reports/sichtpruefung-mehrspieler-2026-09-14/mp2-e-repariert-gast.png` | dito | MP-2 repariert, Gast |
| `docs/reports/sichtpruefung-mehrspieler-2026-09-14/mp3-a-gast-platz-besetzt.png` | dito | Befund MP-3: die Abweisung wurde endlos wiederholt |
| `docs/reports/sichtpruefung-mehrspieler-2026-09-14/mp3-c-repariert-abweisung.png` | dito | MP-3 repariert: die Abweisung nennt ihren Grund und hoert auf |

Die drei Zeichnungen sind SVG und damit Text: sie lassen sich versionieren und vergleichen, was
ein Bildschirmfoto nicht kann. Die Farben stammen aus `apps/desktop/src/ui/tokens.ts`. Die neun
Bildschirmfotos der Sichtprüfung zeigen ausschließlich das eigene Spiel und sind deshalb ebenso
ohne Lizenzfrage; sie stehen hier, weil `test/guards/no-foreign-assets.test.ts` jede eingecheckte
Bilddatei namentlich verlangt (nachgetragen am 2026-09-14 mit T-M41-17 — der Wächter war seit
`2a437b0` rot).

## Bildschirmfotos der UX-Aufnahme (M44, 2026-10-03)

Kein Fremdinhalt — Bildschirmfotos des eigenen Spiels, erzeugt mit `node scripts/ux-capture.mjs --out docs/ux/before`
(Playwright gegen den Dev-Server, T-M44-01) und danach verlustfrei mit oxipng (Stufe 3) verkleinert. Sie stehen hier, weil
`test/guards/no-foreign-assets.test.ts` jede eingecheckte Bilddatei namentlich verlangt (WORKFLOW §4 Falle 23). Befunde dazu:
`docs/plan/UX-PLAN.md`. Die Nachher-Aufnahme (`docs/ux/after/`, T-M44-21) wird hier ebenso eingetragen.

| Datei | Erzeugt von | Zeigt |
|---|---|---|
| `docs/ux/before/01-start-neue-partie-1024x768.png` | `scripts/ux-capture.mjs` | start neue partie, 1024x768 |
| `docs/ux/before/01-start-neue-partie-1280x800.png` | `scripts/ux-capture.mjs` | start neue partie, 1280x800 |
| `docs/ux/before/01-start-neue-partie-1366x768.png` | `scripts/ux-capture.mjs` | start neue partie, 1366x768 |
| `docs/ux/before/01-start-neue-partie-1920x1080.png` | `scripts/ux-capture.mjs` | start neue partie, 1920x1080 |
| `docs/ux/before/01-start-neue-partie-320x568.png` | `scripts/ux-capture.mjs` | start neue partie, 320x568 |
| `docs/ux/before/01-start-neue-partie-375x667.png` | `scripts/ux-capture.mjs` | start neue partie, 375x667 |
| `docs/ux/before/01-start-neue-partie-667x375.png` | `scripts/ux-capture.mjs` | start neue partie, 667x375 |
| `docs/ux/before/01-start-neue-partie-768x1024.png` | `scripts/ux-capture.mjs` | start neue partie, 768x1024 |
| `docs/ux/before/02-partie-anlegen-startknopf-1024x768.png` | `scripts/ux-capture.mjs` | partie anlegen startknopf, 1024x768 |
| `docs/ux/before/02-partie-anlegen-startknopf-1280x800.png` | `scripts/ux-capture.mjs` | partie anlegen startknopf, 1280x800 |
| `docs/ux/before/02-partie-anlegen-startknopf-1366x768.png` | `scripts/ux-capture.mjs` | partie anlegen startknopf, 1366x768 |
| `docs/ux/before/02-partie-anlegen-startknopf-1920x1080.png` | `scripts/ux-capture.mjs` | partie anlegen startknopf, 1920x1080 |
| `docs/ux/before/02-partie-anlegen-startknopf-320x568.png` | `scripts/ux-capture.mjs` | partie anlegen startknopf, 320x568 |
| `docs/ux/before/02-partie-anlegen-startknopf-375x667.png` | `scripts/ux-capture.mjs` | partie anlegen startknopf, 375x667 |
| `docs/ux/before/02-partie-anlegen-startknopf-667x375.png` | `scripts/ux-capture.mjs` | partie anlegen startknopf, 667x375 |
| `docs/ux/before/02-partie-anlegen-startknopf-768x1024.png` | `scripts/ux-capture.mjs` | partie anlegen startknopf, 768x1024 |
| `docs/ux/before/03-spielstaende-leer-1024x768.png` | `scripts/ux-capture.mjs` | spielstände leer, 1024x768 |
| `docs/ux/before/03-spielstaende-leer-1280x800.png` | `scripts/ux-capture.mjs` | spielstände leer, 1280x800 |
| `docs/ux/before/03-spielstaende-leer-1366x768.png` | `scripts/ux-capture.mjs` | spielstände leer, 1366x768 |
| `docs/ux/before/03-spielstaende-leer-1920x1080.png` | `scripts/ux-capture.mjs` | spielstände leer, 1920x1080 |
| `docs/ux/before/03-spielstaende-leer-320x568.png` | `scripts/ux-capture.mjs` | spielstände leer, 320x568 |
| `docs/ux/before/03-spielstaende-leer-375x667.png` | `scripts/ux-capture.mjs` | spielstände leer, 375x667 |
| `docs/ux/before/03-spielstaende-leer-667x375.png` | `scripts/ux-capture.mjs` | spielstände leer, 667x375 |
| `docs/ux/before/03-spielstaende-leer-768x1024.png` | `scripts/ux-capture.mjs` | spielstände leer, 768x1024 |
| `docs/ux/before/04-karte-start-tutorial-1024x768.png` | `scripts/ux-capture.mjs` | karte start tutorial, 1024x768 |
| `docs/ux/before/04-karte-start-tutorial-1280x800.png` | `scripts/ux-capture.mjs` | karte start tutorial, 1280x800 |
| `docs/ux/before/04-karte-start-tutorial-1366x768.png` | `scripts/ux-capture.mjs` | karte start tutorial, 1366x768 |
| `docs/ux/before/04-karte-start-tutorial-1920x1080.png` | `scripts/ux-capture.mjs` | karte start tutorial, 1920x1080 |
| `docs/ux/before/04-karte-start-tutorial-320x568.png` | `scripts/ux-capture.mjs` | karte start tutorial, 320x568 |
| `docs/ux/before/04-karte-start-tutorial-375x667.png` | `scripts/ux-capture.mjs` | karte start tutorial, 375x667 |
| `docs/ux/before/04-karte-start-tutorial-667x375.png` | `scripts/ux-capture.mjs` | karte start tutorial, 667x375 |
| `docs/ux/before/04-karte-start-tutorial-768x1024.png` | `scripts/ux-capture.mjs` | karte start tutorial, 768x1024 |
| `docs/ux/before/05-kartenansicht-1024x768.png` | `scripts/ux-capture.mjs` | kartenansicht, 1024x768 |
| `docs/ux/before/05-kartenansicht-1280x800.png` | `scripts/ux-capture.mjs` | kartenansicht, 1280x800 |
| `docs/ux/before/05-kartenansicht-1366x768.png` | `scripts/ux-capture.mjs` | kartenansicht, 1366x768 |
| `docs/ux/before/05-kartenansicht-1920x1080.png` | `scripts/ux-capture.mjs` | kartenansicht, 1920x1080 |
| `docs/ux/before/05-kartenansicht-320x568.png` | `scripts/ux-capture.mjs` | kartenansicht, 320x568 |
| `docs/ux/before/05-kartenansicht-375x667.png` | `scripts/ux-capture.mjs` | kartenansicht, 375x667 |
| `docs/ux/before/05-kartenansicht-667x375.png` | `scripts/ux-capture.mjs` | kartenansicht, 667x375 |
| `docs/ux/before/05-kartenansicht-768x1024.png` | `scripts/ux-capture.mjs` | kartenansicht, 768x1024 |
| `docs/ux/before/06-kopfleiste-hud-1024x768.png` | `scripts/ux-capture.mjs` | kopfleiste hud, 1024x768 |
| `docs/ux/before/06-kopfleiste-hud-1280x800.png` | `scripts/ux-capture.mjs` | kopfleiste hud, 1280x800 |
| `docs/ux/before/06-kopfleiste-hud-1366x768.png` | `scripts/ux-capture.mjs` | kopfleiste hud, 1366x768 |
| `docs/ux/before/06-kopfleiste-hud-1920x1080.png` | `scripts/ux-capture.mjs` | kopfleiste hud, 1920x1080 |
| `docs/ux/before/06-kopfleiste-hud-320x568.png` | `scripts/ux-capture.mjs` | kopfleiste hud, 320x568 |
| `docs/ux/before/06-kopfleiste-hud-375x667.png` | `scripts/ux-capture.mjs` | kopfleiste hud, 375x667 |
| `docs/ux/before/06-kopfleiste-hud-667x375.png` | `scripts/ux-capture.mjs` | kopfleiste hud, 667x375 |
| `docs/ux/before/06-kopfleiste-hud-768x1024.png` | `scripts/ux-capture.mjs` | kopfleiste hud, 768x1024 |
| `docs/ux/before/07-karte-gezoomt-1024x768.png` | `scripts/ux-capture.mjs` | karte gezoomt, 1024x768 |
| `docs/ux/before/07-karte-gezoomt-1280x800.png` | `scripts/ux-capture.mjs` | karte gezoomt, 1280x800 |
| `docs/ux/before/07-karte-gezoomt-1366x768.png` | `scripts/ux-capture.mjs` | karte gezoomt, 1366x768 |
| `docs/ux/before/07-karte-gezoomt-1920x1080.png` | `scripts/ux-capture.mjs` | karte gezoomt, 1920x1080 |
| `docs/ux/before/07-karte-gezoomt-320x568.png` | `scripts/ux-capture.mjs` | karte gezoomt, 320x568 |
| `docs/ux/before/07-karte-gezoomt-375x667.png` | `scripts/ux-capture.mjs` | karte gezoomt, 375x667 |
| `docs/ux/before/07-karte-gezoomt-667x375.png` | `scripts/ux-capture.mjs` | karte gezoomt, 667x375 |
| `docs/ux/before/07-karte-gezoomt-768x1024.png` | `scripts/ux-capture.mjs` | karte gezoomt, 768x1024 |
| `docs/ux/before/08-kartenmodus-rohstoffe-1024x768.png` | `scripts/ux-capture.mjs` | kartenmodus rohstoffe, 1024x768 |
| `docs/ux/before/08-kartenmodus-rohstoffe-1280x800.png` | `scripts/ux-capture.mjs` | kartenmodus rohstoffe, 1280x800 |
| `docs/ux/before/08-kartenmodus-rohstoffe-1366x768.png` | `scripts/ux-capture.mjs` | kartenmodus rohstoffe, 1366x768 |
| `docs/ux/before/08-kartenmodus-rohstoffe-1920x1080.png` | `scripts/ux-capture.mjs` | kartenmodus rohstoffe, 1920x1080 |
| `docs/ux/before/08-kartenmodus-rohstoffe-320x568.png` | `scripts/ux-capture.mjs` | kartenmodus rohstoffe, 320x568 |
| `docs/ux/before/08-kartenmodus-rohstoffe-375x667.png` | `scripts/ux-capture.mjs` | kartenmodus rohstoffe, 375x667 |
| `docs/ux/before/08-kartenmodus-rohstoffe-667x375.png` | `scripts/ux-capture.mjs` | kartenmodus rohstoffe, 667x375 |
| `docs/ux/before/08-kartenmodus-rohstoffe-768x1024.png` | `scripts/ux-capture.mjs` | kartenmodus rohstoffe, 768x1024 |
| `docs/ux/before/09-provinz-auswahl-1024x768.png` | `scripts/ux-capture.mjs` | provinz auswahl, 1024x768 |
| `docs/ux/before/09-provinz-auswahl-1280x800.png` | `scripts/ux-capture.mjs` | provinz auswahl, 1280x800 |
| `docs/ux/before/09-provinz-auswahl-1366x768.png` | `scripts/ux-capture.mjs` | provinz auswahl, 1366x768 |
| `docs/ux/before/09-provinz-auswahl-1920x1080.png` | `scripts/ux-capture.mjs` | provinz auswahl, 1920x1080 |
| `docs/ux/before/09-provinz-auswahl-320x568.png` | `scripts/ux-capture.mjs` | provinz auswahl, 320x568 |
| `docs/ux/before/09-provinz-auswahl-375x667.png` | `scripts/ux-capture.mjs` | provinz auswahl, 375x667 |
| `docs/ux/before/09-provinz-auswahl-667x375.png` | `scripts/ux-capture.mjs` | provinz auswahl, 667x375 |
| `docs/ux/before/09-provinz-auswahl-768x1024.png` | `scripts/ux-capture.mjs` | provinz auswahl, 768x1024 |
| `docs/ux/before/10-hinweis-erklaerung-1024x768.png` | `scripts/ux-capture.mjs` | hinweis erklärung, 1024x768 |
| `docs/ux/before/10-hinweis-erklaerung-1280x800.png` | `scripts/ux-capture.mjs` | hinweis erklärung, 1280x800 |
| `docs/ux/before/10-hinweis-erklaerung-1366x768.png` | `scripts/ux-capture.mjs` | hinweis erklärung, 1366x768 |
| `docs/ux/before/10-hinweis-erklaerung-1920x1080.png` | `scripts/ux-capture.mjs` | hinweis erklärung, 1920x1080 |
| `docs/ux/before/10-hinweis-erklaerung-320x568.png` | `scripts/ux-capture.mjs` | hinweis erklärung, 320x568 |
| `docs/ux/before/10-hinweis-erklaerung-375x667.png` | `scripts/ux-capture.mjs` | hinweis erklärung, 375x667 |
| `docs/ux/before/10-hinweis-erklaerung-667x375.png` | `scripts/ux-capture.mjs` | hinweis erklärung, 667x375 |
| `docs/ux/before/10-hinweis-erklaerung-768x1024.png` | `scripts/ux-capture.mjs` | hinweis erklärung, 768x1024 |
| `docs/ux/before/11-rueckmeldung-bau-befohlen-1024x768.png` | `scripts/ux-capture.mjs` | rückmeldung bau befohlen, 1024x768 |
| `docs/ux/before/11-rueckmeldung-bau-befohlen-1280x800.png` | `scripts/ux-capture.mjs` | rückmeldung bau befohlen, 1280x800 |
| `docs/ux/before/11-rueckmeldung-bau-befohlen-1366x768.png` | `scripts/ux-capture.mjs` | rückmeldung bau befohlen, 1366x768 |
| `docs/ux/before/11-rueckmeldung-bau-befohlen-1920x1080.png` | `scripts/ux-capture.mjs` | rückmeldung bau befohlen, 1920x1080 |
| `docs/ux/before/11-rueckmeldung-bau-befohlen-320x568.png` | `scripts/ux-capture.mjs` | rückmeldung bau befohlen, 320x568 |
| `docs/ux/before/11-rueckmeldung-bau-befohlen-375x667.png` | `scripts/ux-capture.mjs` | rückmeldung bau befohlen, 375x667 |
| `docs/ux/before/11-rueckmeldung-bau-befohlen-667x375.png` | `scripts/ux-capture.mjs` | rückmeldung bau befohlen, 667x375 |
| `docs/ux/before/11-rueckmeldung-bau-befohlen-768x1024.png` | `scripts/ux-capture.mjs` | rückmeldung bau befohlen, 768x1024 |
| `docs/ux/before/12-tempo-100-laeuft-1024x768.png` | `scripts/ux-capture.mjs` | tempo 100 läuft, 1024x768 |
| `docs/ux/before/12-tempo-100-laeuft-1280x800.png` | `scripts/ux-capture.mjs` | tempo 100 läuft, 1280x800 |
| `docs/ux/before/12-tempo-100-laeuft-1366x768.png` | `scripts/ux-capture.mjs` | tempo 100 läuft, 1366x768 |
| `docs/ux/before/12-tempo-100-laeuft-1920x1080.png` | `scripts/ux-capture.mjs` | tempo 100 läuft, 1920x1080 |
| `docs/ux/before/12-tempo-100-laeuft-667x375.png` | `scripts/ux-capture.mjs` | tempo 100 läuft, 667x375 |
| `docs/ux/before/12-tempo-100-laeuft-768x1024.png` | `scripts/ux-capture.mjs` | tempo 100 läuft, 768x1024 |
| `docs/ux/before/13-pause-armee-ausgehoben-1024x768.png` | `scripts/ux-capture.mjs` | pause armee ausgehoben, 1024x768 |
| `docs/ux/before/13-pause-armee-ausgehoben-1280x800.png` | `scripts/ux-capture.mjs` | pause armee ausgehoben, 1280x800 |
| `docs/ux/before/13-pause-armee-ausgehoben-1366x768.png` | `scripts/ux-capture.mjs` | pause armee ausgehoben, 1366x768 |
| `docs/ux/before/13-pause-armee-ausgehoben-1920x1080.png` | `scripts/ux-capture.mjs` | pause armee ausgehoben, 1920x1080 |
| `docs/ux/before/13-pause-armee-ausgehoben-667x375.png` | `scripts/ux-capture.mjs` | pause armee ausgehoben, 667x375 |
| `docs/ux/before/13-pause-armee-ausgehoben-768x1024.png` | `scripts/ux-capture.mjs` | pause armee ausgehoben, 768x1024 |
| `docs/ux/before/14-armee-auswahl-1024x768.png` | `scripts/ux-capture.mjs` | armee auswahl, 1024x768 |
| `docs/ux/before/14-armee-auswahl-1280x800.png` | `scripts/ux-capture.mjs` | armee auswahl, 1280x800 |
| `docs/ux/before/14-armee-auswahl-1366x768.png` | `scripts/ux-capture.mjs` | armee auswahl, 1366x768 |
| `docs/ux/before/14-armee-auswahl-1920x1080.png` | `scripts/ux-capture.mjs` | armee auswahl, 1920x1080 |
| `docs/ux/before/14-armee-auswahl-667x375.png` | `scripts/ux-capture.mjs` | armee auswahl, 667x375 |
| `docs/ux/before/14-armee-auswahl-768x1024.png` | `scripts/ux-capture.mjs` | armee auswahl, 768x1024 |
| `docs/ux/before/15-beschuss-gesperrt-1024x768.png` | `scripts/ux-capture.mjs` | beschuss gesperrt, 1024x768 |
| `docs/ux/before/15-beschuss-gesperrt-1280x800.png` | `scripts/ux-capture.mjs` | beschuss gesperrt, 1280x800 |
| `docs/ux/before/15-beschuss-gesperrt-1366x768.png` | `scripts/ux-capture.mjs` | beschuss gesperrt, 1366x768 |
| `docs/ux/before/15-beschuss-gesperrt-1920x1080.png` | `scripts/ux-capture.mjs` | beschuss gesperrt, 1920x1080 |
| `docs/ux/before/15-beschuss-gesperrt-667x375.png` | `scripts/ux-capture.mjs` | beschuss gesperrt, 667x375 |
| `docs/ux/before/15-beschuss-gesperrt-768x1024.png` | `scripts/ux-capture.mjs` | beschuss gesperrt, 768x1024 |
| `docs/ux/before/16-marsch-zielwahl-1024x768.png` | `scripts/ux-capture.mjs` | marsch zielwahl, 1024x768 |
| `docs/ux/before/16-marsch-zielwahl-1280x800.png` | `scripts/ux-capture.mjs` | marsch zielwahl, 1280x800 |
| `docs/ux/before/16-marsch-zielwahl-1366x768.png` | `scripts/ux-capture.mjs` | marsch zielwahl, 1366x768 |
| `docs/ux/before/16-marsch-zielwahl-1920x1080.png` | `scripts/ux-capture.mjs` | marsch zielwahl, 1920x1080 |
| `docs/ux/before/16-marsch-zielwahl-667x375.png` | `scripts/ux-capture.mjs` | marsch zielwahl, 667x375 |
| `docs/ux/before/16-marsch-zielwahl-768x1024.png` | `scripts/ux-capture.mjs` | marsch zielwahl, 768x1024 |
| `docs/ux/before/17-fehler-ungueltiges-ziel-1024x768.png` | `scripts/ux-capture.mjs` | fehler ungültiges ziel, 1024x768 |
| `docs/ux/before/17-fehler-ungueltiges-ziel-1280x800.png` | `scripts/ux-capture.mjs` | fehler ungültiges ziel, 1280x800 |
| `docs/ux/before/17-fehler-ungueltiges-ziel-1366x768.png` | `scripts/ux-capture.mjs` | fehler ungültiges ziel, 1366x768 |
| `docs/ux/before/17-fehler-ungueltiges-ziel-1920x1080.png` | `scripts/ux-capture.mjs` | fehler ungültiges ziel, 1920x1080 |
| `docs/ux/before/17-fehler-ungueltiges-ziel-667x375.png` | `scripts/ux-capture.mjs` | fehler ungültiges ziel, 667x375 |
| `docs/ux/before/17-fehler-ungueltiges-ziel-768x1024.png` | `scripts/ux-capture.mjs` | fehler ungültiges ziel, 768x1024 |
| `docs/ux/before/18-marsch-ziel-gewaehlt-1024x768.png` | `scripts/ux-capture.mjs` | marsch ziel gewählt, 1024x768 |
| `docs/ux/before/18-marsch-ziel-gewaehlt-1280x800.png` | `scripts/ux-capture.mjs` | marsch ziel gewählt, 1280x800 |
| `docs/ux/before/18-marsch-ziel-gewaehlt-1366x768.png` | `scripts/ux-capture.mjs` | marsch ziel gewählt, 1366x768 |
| `docs/ux/before/18-marsch-ziel-gewaehlt-1920x1080.png` | `scripts/ux-capture.mjs` | marsch ziel gewählt, 1920x1080 |
| `docs/ux/before/18-marsch-ziel-gewaehlt-667x375.png` | `scripts/ux-capture.mjs` | marsch ziel gewählt, 667x375 |
| `docs/ux/before/18-marsch-ziel-gewaehlt-768x1024.png` | `scripts/ux-capture.mjs` | marsch ziel gewählt, 768x1024 |
| `docs/ux/before/19-marsch-befohlen-1024x768.png` | `scripts/ux-capture.mjs` | marsch befohlen, 1024x768 |
| `docs/ux/before/19-marsch-befohlen-1280x800.png` | `scripts/ux-capture.mjs` | marsch befohlen, 1280x800 |
| `docs/ux/before/19-marsch-befohlen-1366x768.png` | `scripts/ux-capture.mjs` | marsch befohlen, 1366x768 |
| `docs/ux/before/19-marsch-befohlen-1920x1080.png` | `scripts/ux-capture.mjs` | marsch befohlen, 1920x1080 |
| `docs/ux/before/19-marsch-befohlen-667x375.png` | `scripts/ux-capture.mjs` | marsch befohlen, 667x375 |
| `docs/ux/before/19-marsch-befohlen-768x1024.png` | `scripts/ux-capture.mjs` | marsch befohlen, 768x1024 |
| `docs/ux/before/20-diplomatie-1024x768.png` | `scripts/ux-capture.mjs` | diplomatie, 1024x768 |
| `docs/ux/before/20-diplomatie-1280x800.png` | `scripts/ux-capture.mjs` | diplomatie, 1280x800 |
| `docs/ux/before/20-diplomatie-1366x768.png` | `scripts/ux-capture.mjs` | diplomatie, 1366x768 |
| `docs/ux/before/20-diplomatie-1920x1080.png` | `scripts/ux-capture.mjs` | diplomatie, 1920x1080 |
| `docs/ux/before/20-diplomatie-320x568.png` | `scripts/ux-capture.mjs` | diplomatie, 320x568 |
| `docs/ux/before/20-diplomatie-375x667.png` | `scripts/ux-capture.mjs` | diplomatie, 375x667 |
| `docs/ux/before/20-diplomatie-667x375.png` | `scripts/ux-capture.mjs` | diplomatie, 667x375 |
| `docs/ux/before/20-diplomatie-768x1024.png` | `scripts/ux-capture.mjs` | diplomatie, 768x1024 |
| `docs/ux/before/21-krieg-erklaert-ohne-rueckfrage-1024x768.png` | `scripts/ux-capture.mjs` | krieg erklärt ohne rückfrage, 1024x768 |
| `docs/ux/before/21-krieg-erklaert-ohne-rueckfrage-1280x800.png` | `scripts/ux-capture.mjs` | krieg erklärt ohne rückfrage, 1280x800 |
| `docs/ux/before/21-krieg-erklaert-ohne-rueckfrage-1366x768.png` | `scripts/ux-capture.mjs` | krieg erklärt ohne rückfrage, 1366x768 |
| `docs/ux/before/21-krieg-erklaert-ohne-rueckfrage-1920x1080.png` | `scripts/ux-capture.mjs` | krieg erklärt ohne rückfrage, 1920x1080 |
| `docs/ux/before/21-krieg-erklaert-ohne-rueckfrage-320x568.png` | `scripts/ux-capture.mjs` | krieg erklärt ohne rückfrage, 320x568 |
| `docs/ux/before/21-krieg-erklaert-ohne-rueckfrage-375x667.png` | `scripts/ux-capture.mjs` | krieg erklärt ohne rückfrage, 375x667 |
| `docs/ux/before/21-krieg-erklaert-ohne-rueckfrage-667x375.png` | `scripts/ux-capture.mjs` | krieg erklärt ohne rückfrage, 667x375 |
| `docs/ux/before/21-krieg-erklaert-ohne-rueckfrage-768x1024.png` | `scripts/ux-capture.mjs` | krieg erklärt ohne rückfrage, 768x1024 |
| `docs/ux/before/22-kampf-gefecht-1024x768.png` | `scripts/ux-capture.mjs` | kampf gefecht, 1024x768 |
| `docs/ux/before/22-kampf-gefecht-1280x800.png` | `scripts/ux-capture.mjs` | kampf gefecht, 1280x800 |
| `docs/ux/before/22-kampf-gefecht-1366x768.png` | `scripts/ux-capture.mjs` | kampf gefecht, 1366x768 |
| `docs/ux/before/22-kampf-gefecht-1920x1080.png` | `scripts/ux-capture.mjs` | kampf gefecht, 1920x1080 |
| `docs/ux/before/22-kampf-gefecht-667x375.png` | `scripts/ux-capture.mjs` | kampf gefecht, 667x375 |
| `docs/ux/before/22-kampf-gefecht-768x1024.png` | `scripts/ux-capture.mjs` | kampf gefecht, 768x1024 |
| `docs/ux/before/23-protokoll-kaempfe-1024x768.png` | `scripts/ux-capture.mjs` | protokoll kämpfe, 1024x768 |
| `docs/ux/before/23-protokoll-kaempfe-1280x800.png` | `scripts/ux-capture.mjs` | protokoll kämpfe, 1280x800 |
| `docs/ux/before/23-protokoll-kaempfe-1366x768.png` | `scripts/ux-capture.mjs` | protokoll kämpfe, 1366x768 |
| `docs/ux/before/23-protokoll-kaempfe-1920x1080.png` | `scripts/ux-capture.mjs` | protokoll kämpfe, 1920x1080 |
| `docs/ux/before/23-protokoll-kaempfe-667x375.png` | `scripts/ux-capture.mjs` | protokoll kämpfe, 667x375 |
| `docs/ux/before/23-protokoll-kaempfe-768x1024.png` | `scripts/ux-capture.mjs` | protokoll kämpfe, 768x1024 |
| `docs/ux/before/24-meldungen-depesche-1024x768.png` | `scripts/ux-capture.mjs` | meldungen depesche, 1024x768 |
| `docs/ux/before/24-meldungen-depesche-1280x800.png` | `scripts/ux-capture.mjs` | meldungen depesche, 1280x800 |
| `docs/ux/before/24-meldungen-depesche-1366x768.png` | `scripts/ux-capture.mjs` | meldungen depesche, 1366x768 |
| `docs/ux/before/24-meldungen-depesche-1920x1080.png` | `scripts/ux-capture.mjs` | meldungen depesche, 1920x1080 |
| `docs/ux/before/24-meldungen-depesche-667x375.png` | `scripts/ux-capture.mjs` | meldungen depesche, 667x375 |
| `docs/ux/before/24-meldungen-depesche-768x1024.png` | `scripts/ux-capture.mjs` | meldungen depesche, 768x1024 |
| `docs/ux/before/25-panel-markt-1024x768.png` | `scripts/ux-capture.mjs` | panel markt, 1024x768 |
| `docs/ux/before/25-panel-markt-1280x800.png` | `scripts/ux-capture.mjs` | panel markt, 1280x800 |
| `docs/ux/before/25-panel-markt-1366x768.png` | `scripts/ux-capture.mjs` | panel markt, 1366x768 |
| `docs/ux/before/25-panel-markt-1920x1080.png` | `scripts/ux-capture.mjs` | panel markt, 1920x1080 |
| `docs/ux/before/25-panel-markt-320x568.png` | `scripts/ux-capture.mjs` | panel markt, 320x568 |
| `docs/ux/before/25-panel-markt-375x667.png` | `scripts/ux-capture.mjs` | panel markt, 375x667 |
| `docs/ux/before/25-panel-markt-667x375.png` | `scripts/ux-capture.mjs` | panel markt, 667x375 |
| `docs/ux/before/25-panel-markt-768x1024.png` | `scripts/ux-capture.mjs` | panel markt, 768x1024 |
| `docs/ux/before/26-panel-spionage-1024x768.png` | `scripts/ux-capture.mjs` | panel spionage, 1024x768 |
| `docs/ux/before/26-panel-spionage-1280x800.png` | `scripts/ux-capture.mjs` | panel spionage, 1280x800 |
| `docs/ux/before/26-panel-spionage-1366x768.png` | `scripts/ux-capture.mjs` | panel spionage, 1366x768 |
| `docs/ux/before/26-panel-spionage-1920x1080.png` | `scripts/ux-capture.mjs` | panel spionage, 1920x1080 |
| `docs/ux/before/26-panel-spionage-320x568.png` | `scripts/ux-capture.mjs` | panel spionage, 320x568 |
| `docs/ux/before/26-panel-spionage-375x667.png` | `scripts/ux-capture.mjs` | panel spionage, 375x667 |
| `docs/ux/before/26-panel-spionage-667x375.png` | `scripts/ux-capture.mjs` | panel spionage, 667x375 |
| `docs/ux/before/26-panel-spionage-768x1024.png` | `scripts/ux-capture.mjs` | panel spionage, 768x1024 |
| `docs/ux/before/27-panel-rangliste-sieg-1024x768.png` | `scripts/ux-capture.mjs` | panel rangliste sieg, 1024x768 |
| `docs/ux/before/27-panel-rangliste-sieg-1280x800.png` | `scripts/ux-capture.mjs` | panel rangliste sieg, 1280x800 |
| `docs/ux/before/27-panel-rangliste-sieg-1366x768.png` | `scripts/ux-capture.mjs` | panel rangliste sieg, 1366x768 |
| `docs/ux/before/27-panel-rangliste-sieg-1920x1080.png` | `scripts/ux-capture.mjs` | panel rangliste sieg, 1920x1080 |
| `docs/ux/before/27-panel-rangliste-sieg-320x568.png` | `scripts/ux-capture.mjs` | panel rangliste sieg, 320x568 |
| `docs/ux/before/27-panel-rangliste-sieg-375x667.png` | `scripts/ux-capture.mjs` | panel rangliste sieg, 375x667 |
| `docs/ux/before/27-panel-rangliste-sieg-667x375.png` | `scripts/ux-capture.mjs` | panel rangliste sieg, 667x375 |
| `docs/ux/before/27-panel-rangliste-sieg-768x1024.png` | `scripts/ux-capture.mjs` | panel rangliste sieg, 768x1024 |
| `docs/ux/before/28-kartenmodus-beziehungen-1024x768.png` | `scripts/ux-capture.mjs` | kartenmodus beziehungen, 1024x768 |
| `docs/ux/before/28-kartenmodus-beziehungen-1280x800.png` | `scripts/ux-capture.mjs` | kartenmodus beziehungen, 1280x800 |
| `docs/ux/before/28-kartenmodus-beziehungen-1366x768.png` | `scripts/ux-capture.mjs` | kartenmodus beziehungen, 1366x768 |
| `docs/ux/before/28-kartenmodus-beziehungen-1920x1080.png` | `scripts/ux-capture.mjs` | kartenmodus beziehungen, 1920x1080 |
| `docs/ux/before/28-kartenmodus-beziehungen-375x667.png` | `scripts/ux-capture.mjs` | kartenmodus beziehungen, 375x667 |
| `docs/ux/before/28-kartenmodus-beziehungen-667x375.png` | `scripts/ux-capture.mjs` | kartenmodus beziehungen, 667x375 |
| `docs/ux/before/28-kartenmodus-beziehungen-768x1024.png` | `scripts/ux-capture.mjs` | kartenmodus beziehungen, 768x1024 |
| `docs/ux/before/29-menue-1024x768.png` | `scripts/ux-capture.mjs` | menü, 1024x768 |
| `docs/ux/before/29-menue-1280x800.png` | `scripts/ux-capture.mjs` | menü, 1280x800 |
| `docs/ux/before/29-menue-1366x768.png` | `scripts/ux-capture.mjs` | menü, 1366x768 |
| `docs/ux/before/29-menue-1920x1080.png` | `scripts/ux-capture.mjs` | menü, 1920x1080 |
| `docs/ux/before/29-menue-320x568.png` | `scripts/ux-capture.mjs` | menü, 320x568 |
| `docs/ux/before/29-menue-375x667.png` | `scripts/ux-capture.mjs` | menü, 375x667 |
| `docs/ux/before/29-menue-667x375.png` | `scripts/ux-capture.mjs` | menü, 667x375 |
| `docs/ux/before/29-menue-768x1024.png` | `scripts/ux-capture.mjs` | menü, 768x1024 |
| `docs/ux/before/30-einstellungen-1024x768.png` | `scripts/ux-capture.mjs` | einstellungen, 1024x768 |
| `docs/ux/before/30-einstellungen-1280x800.png` | `scripts/ux-capture.mjs` | einstellungen, 1280x800 |
| `docs/ux/before/30-einstellungen-1366x768.png` | `scripts/ux-capture.mjs` | einstellungen, 1366x768 |
| `docs/ux/before/30-einstellungen-1920x1080.png` | `scripts/ux-capture.mjs` | einstellungen, 1920x1080 |
| `docs/ux/before/30-einstellungen-320x568.png` | `scripts/ux-capture.mjs` | einstellungen, 320x568 |
| `docs/ux/before/30-einstellungen-375x667.png` | `scripts/ux-capture.mjs` | einstellungen, 375x667 |
| `docs/ux/before/30-einstellungen-667x375.png` | `scripts/ux-capture.mjs` | einstellungen, 667x375 |
| `docs/ux/before/30-einstellungen-768x1024.png` | `scripts/ux-capture.mjs` | einstellungen, 768x1024 |
| `docs/ux/before/31-spielstand-gespeichert-1024x768.png` | `scripts/ux-capture.mjs` | spielstand gespeichert, 1024x768 |
| `docs/ux/before/31-spielstand-gespeichert-1280x800.png` | `scripts/ux-capture.mjs` | spielstand gespeichert, 1280x800 |
| `docs/ux/before/31-spielstand-gespeichert-1366x768.png` | `scripts/ux-capture.mjs` | spielstand gespeichert, 1366x768 |
| `docs/ux/before/31-spielstand-gespeichert-1920x1080.png` | `scripts/ux-capture.mjs` | spielstand gespeichert, 1920x1080 |
| `docs/ux/before/31-spielstand-gespeichert-320x568.png` | `scripts/ux-capture.mjs` | spielstand gespeichert, 320x568 |
| `docs/ux/before/31-spielstand-gespeichert-375x667.png` | `scripts/ux-capture.mjs` | spielstand gespeichert, 375x667 |
| `docs/ux/before/31-spielstand-gespeichert-667x375.png` | `scripts/ux-capture.mjs` | spielstand gespeichert, 667x375 |
| `docs/ux/before/31-spielstand-gespeichert-768x1024.png` | `scripts/ux-capture.mjs` | spielstand gespeichert, 768x1024 |
| `docs/ux/before/32-fehler-spielstand-beschaedigt-1024x768.png` | `scripts/ux-capture.mjs` | fehler spielstand beschädigt, 1024x768 |
| `docs/ux/before/32-fehler-spielstand-beschaedigt-1280x800.png` | `scripts/ux-capture.mjs` | fehler spielstand beschädigt, 1280x800 |
| `docs/ux/before/32-fehler-spielstand-beschaedigt-1366x768.png` | `scripts/ux-capture.mjs` | fehler spielstand beschädigt, 1366x768 |
| `docs/ux/before/32-fehler-spielstand-beschaedigt-1920x1080.png` | `scripts/ux-capture.mjs` | fehler spielstand beschädigt, 1920x1080 |
| `docs/ux/before/32-fehler-spielstand-beschaedigt-320x568.png` | `scripts/ux-capture.mjs` | fehler spielstand beschädigt, 320x568 |
| `docs/ux/before/32-fehler-spielstand-beschaedigt-375x667.png` | `scripts/ux-capture.mjs` | fehler spielstand beschädigt, 375x667 |
| `docs/ux/before/32-fehler-spielstand-beschaedigt-667x375.png` | `scripts/ux-capture.mjs` | fehler spielstand beschädigt, 667x375 |
| `docs/ux/before/32-fehler-spielstand-beschaedigt-768x1024.png` | `scripts/ux-capture.mjs` | fehler spielstand beschädigt, 768x1024 |
| `docs/ux/before/33-spielende-sieg-1024x768.png` | `scripts/ux-capture.mjs` | spielende sieg, 1024x768 |
| `docs/ux/before/33-spielende-sieg-1280x800.png` | `scripts/ux-capture.mjs` | spielende sieg, 1280x800 |
| `docs/ux/before/33-spielende-sieg-1366x768.png` | `scripts/ux-capture.mjs` | spielende sieg, 1366x768 |
| `docs/ux/before/33-spielende-sieg-1920x1080.png` | `scripts/ux-capture.mjs` | spielende sieg, 1920x1080 |
| `docs/ux/before/33-spielende-sieg-320x568.png` | `scripts/ux-capture.mjs` | spielende sieg, 320x568 |
| `docs/ux/before/33-spielende-sieg-375x667.png` | `scripts/ux-capture.mjs` | spielende sieg, 375x667 |
| `docs/ux/before/33-spielende-sieg-667x375.png` | `scripts/ux-capture.mjs` | spielende sieg, 667x375 |
| `docs/ux/before/33-spielende-sieg-768x1024.png` | `scripts/ux-capture.mjs` | spielende sieg, 768x1024 |
| `docs/ux/before/34-spielende-niederlage-1024x768.png` | `scripts/ux-capture.mjs` | spielende niederlage, 1024x768 |
| `docs/ux/before/34-spielende-niederlage-1280x800.png` | `scripts/ux-capture.mjs` | spielende niederlage, 1280x800 |
| `docs/ux/before/34-spielende-niederlage-1366x768.png` | `scripts/ux-capture.mjs` | spielende niederlage, 1366x768 |
| `docs/ux/before/34-spielende-niederlage-1920x1080.png` | `scripts/ux-capture.mjs` | spielende niederlage, 1920x1080 |
| `docs/ux/before/34-spielende-niederlage-320x568.png` | `scripts/ux-capture.mjs` | spielende niederlage, 320x568 |
| `docs/ux/before/34-spielende-niederlage-375x667.png` | `scripts/ux-capture.mjs` | spielende niederlage, 375x667 |
| `docs/ux/before/34-spielende-niederlage-667x375.png` | `scripts/ux-capture.mjs` | spielende niederlage, 667x375 |
| `docs/ux/before/34-spielende-niederlage-768x1024.png` | `scripts/ux-capture.mjs` | spielende niederlage, 768x1024 |
| `docs/ux/before/x-armee-auswahl-nicht-erreichbar-320x568.png` | `scripts/ux-capture.mjs` | armee auswahl nicht erreichbar, 320x568 |
| `docs/ux/before/x-armee-auswahl-nicht-erreichbar-375x667.png` | `scripts/ux-capture.mjs` | armee auswahl nicht erreichbar, 375x667 |
| `docs/ux/before/x-ausheben-nicht-erreichbar-320x568.png` | `scripts/ux-capture.mjs` | ausheben nicht erreichbar, 320x568 |
| `docs/ux/before/x-ausheben-nicht-erreichbar-375x667.png` | `scripts/ux-capture.mjs` | ausheben nicht erreichbar, 375x667 |
| `docs/ux/before/x-beschuss-gesperrt-nicht-erreichbar-320x568.png` | `scripts/ux-capture.mjs` | beschuss gesperrt nicht erreichbar, 320x568 |
| `docs/ux/before/x-beschuss-gesperrt-nicht-erreichbar-375x667.png` | `scripts/ux-capture.mjs` | beschuss gesperrt nicht erreichbar, 375x667 |
| `docs/ux/before/x-fehler-ungueltiges-ziel-nicht-erreichbar-320x568.png` | `scripts/ux-capture.mjs` | fehler ungültiges ziel nicht erreichbar, 320x568 |
| `docs/ux/before/x-fehler-ungueltiges-ziel-nicht-erreichbar-375x667.png` | `scripts/ux-capture.mjs` | fehler ungültiges ziel nicht erreichbar, 375x667 |
| `docs/ux/before/x-kampf-nicht-erreichbar-320x568.png` | `scripts/ux-capture.mjs` | kampf nicht erreichbar, 320x568 |
| `docs/ux/before/x-kampf-nicht-erreichbar-375x667.png` | `scripts/ux-capture.mjs` | kampf nicht erreichbar, 375x667 |
| `docs/ux/before/x-kartenmodus-beziehungen-nicht-erreichbar-320x568.png` | `scripts/ux-capture.mjs` | kartenmodus beziehungen nicht erreichbar, 320x568 |
| `docs/ux/before/x-marsch-befehlen-nicht-erreichbar-320x568.png` | `scripts/ux-capture.mjs` | marsch befehlen nicht erreichbar, 320x568 |
| `docs/ux/before/x-marsch-befehlen-nicht-erreichbar-375x667.png` | `scripts/ux-capture.mjs` | marsch befehlen nicht erreichbar, 375x667 |
| `docs/ux/before/x-marsch-zielwahl-nicht-erreichbar-320x568.png` | `scripts/ux-capture.mjs` | marsch zielwahl nicht erreichbar, 320x568 |
| `docs/ux/before/x-marsch-zielwahl-nicht-erreichbar-375x667.png` | `scripts/ux-capture.mjs` | marsch zielwahl nicht erreichbar, 375x667 |
| `docs/ux/before/x-meldungen-nicht-erreichbar-320x568.png` | `scripts/ux-capture.mjs` | meldungen nicht erreichbar, 320x568 |
| `docs/ux/before/x-meldungen-nicht-erreichbar-375x667.png` | `scripts/ux-capture.mjs` | meldungen nicht erreichbar, 375x667 |
| `docs/ux/before/x-tempo-laeuft-nicht-erreichbar-320x568.png` | `scripts/ux-capture.mjs` | tempo läuft nicht erreichbar, 320x568 |
| `docs/ux/before/x-tempo-laeuft-nicht-erreichbar-375x667.png` | `scripts/ux-capture.mjs` | tempo läuft nicht erreichbar, 375x667 |

### Nachher-Aufnahme (T-M44-21, 2026-10-03)

Erzeugt mit `node scripts/ux-capture.mjs --out docs/ux/after --measure-only 1920x1080` (Bilder in 375x667, 667x375, 1280x800, 1366x768; 1920x1080 nur als Messwert) und `--mp` (Mehrspieler, 375x667 und 1280x800), verlustfrei optimiert (Pillow `optimize=True`, Pixel je Datei auf Gleichheit geprüft; oxipng ist auf dieser Maschine nicht installiert). Kein Fremdinhalt.

| Datei | Erzeugt von | Zeigt |
|---|---|---|
| `docs/ux/after/01-start-neue-partie-1280x800.png` | `scripts/ux-capture.mjs` | start neue partie, 1280x800 |
| `docs/ux/after/01-start-neue-partie-1366x768.png` | `scripts/ux-capture.mjs` | start neue partie, 1366x768 |
| `docs/ux/after/01-start-neue-partie-1920x1080.png` | `scripts/ux-capture.mjs` | start neue partie, 1920x1080 |
| `docs/ux/after/01-start-neue-partie-375x667.png` | `scripts/ux-capture.mjs` | start neue partie, 375x667 |
| `docs/ux/after/01-start-neue-partie-667x375.png` | `scripts/ux-capture.mjs` | start neue partie, 667x375 |
| `docs/ux/after/02-partie-anlegen-startknopf-1280x800.png` | `scripts/ux-capture.mjs` | partie anlegen startknopf, 1280x800 |
| `docs/ux/after/02-partie-anlegen-startknopf-1366x768.png` | `scripts/ux-capture.mjs` | partie anlegen startknopf, 1366x768 |
| `docs/ux/after/02-partie-anlegen-startknopf-1920x1080.png` | `scripts/ux-capture.mjs` | partie anlegen startknopf, 1920x1080 |
| `docs/ux/after/02-partie-anlegen-startknopf-375x667.png` | `scripts/ux-capture.mjs` | partie anlegen startknopf, 375x667 |
| `docs/ux/after/02-partie-anlegen-startknopf-667x375.png` | `scripts/ux-capture.mjs` | partie anlegen startknopf, 667x375 |
| `docs/ux/after/03-spielstaende-leer-1280x800.png` | `scripts/ux-capture.mjs` | spielstaende leer, 1280x800 |
| `docs/ux/after/03-spielstaende-leer-1366x768.png` | `scripts/ux-capture.mjs` | spielstaende leer, 1366x768 |
| `docs/ux/after/03-spielstaende-leer-1920x1080.png` | `scripts/ux-capture.mjs` | spielstaende leer, 1920x1080 |
| `docs/ux/after/03-spielstaende-leer-375x667.png` | `scripts/ux-capture.mjs` | spielstaende leer, 375x667 |
| `docs/ux/after/03-spielstaende-leer-667x375.png` | `scripts/ux-capture.mjs` | spielstaende leer, 667x375 |
| `docs/ux/after/04-karte-start-tutorial-1280x800.png` | `scripts/ux-capture.mjs` | karte start tutorial, 1280x800 |
| `docs/ux/after/04-karte-start-tutorial-1366x768.png` | `scripts/ux-capture.mjs` | karte start tutorial, 1366x768 |
| `docs/ux/after/04-karte-start-tutorial-1920x1080.png` | `scripts/ux-capture.mjs` | karte start tutorial, 1920x1080 |
| `docs/ux/after/04-karte-start-tutorial-375x667.png` | `scripts/ux-capture.mjs` | karte start tutorial, 375x667 |
| `docs/ux/after/04-karte-start-tutorial-667x375.png` | `scripts/ux-capture.mjs` | karte start tutorial, 667x375 |
| `docs/ux/after/05-kartenansicht-1280x800.png` | `scripts/ux-capture.mjs` | kartenansicht, 1280x800 |
| `docs/ux/after/05-kartenansicht-1366x768.png` | `scripts/ux-capture.mjs` | kartenansicht, 1366x768 |
| `docs/ux/after/05-kartenansicht-1920x1080.png` | `scripts/ux-capture.mjs` | kartenansicht, 1920x1080 |
| `docs/ux/after/05-kartenansicht-375x667.png` | `scripts/ux-capture.mjs` | kartenansicht, 375x667 |
| `docs/ux/after/05-kartenansicht-667x375.png` | `scripts/ux-capture.mjs` | kartenansicht, 667x375 |
| `docs/ux/after/06-kopfleiste-hud-1280x800.png` | `scripts/ux-capture.mjs` | kopfleiste hud, 1280x800 |
| `docs/ux/after/06-kopfleiste-hud-1366x768.png` | `scripts/ux-capture.mjs` | kopfleiste hud, 1366x768 |
| `docs/ux/after/06-kopfleiste-hud-1920x1080.png` | `scripts/ux-capture.mjs` | kopfleiste hud, 1920x1080 |
| `docs/ux/after/06-kopfleiste-hud-375x667.png` | `scripts/ux-capture.mjs` | kopfleiste hud, 375x667 |
| `docs/ux/after/06-kopfleiste-hud-667x375.png` | `scripts/ux-capture.mjs` | kopfleiste hud, 667x375 |
| `docs/ux/after/07-karte-gezoomt-1280x800.png` | `scripts/ux-capture.mjs` | karte gezoomt, 1280x800 |
| `docs/ux/after/07-karte-gezoomt-1366x768.png` | `scripts/ux-capture.mjs` | karte gezoomt, 1366x768 |
| `docs/ux/after/07-karte-gezoomt-1920x1080.png` | `scripts/ux-capture.mjs` | karte gezoomt, 1920x1080 |
| `docs/ux/after/07-karte-gezoomt-375x667.png` | `scripts/ux-capture.mjs` | karte gezoomt, 375x667 |
| `docs/ux/after/07-karte-gezoomt-667x375.png` | `scripts/ux-capture.mjs` | karte gezoomt, 667x375 |
| `docs/ux/after/08-kartenmodus-rohstoffe-1280x800.png` | `scripts/ux-capture.mjs` | kartenmodus rohstoffe, 1280x800 |
| `docs/ux/after/08-kartenmodus-rohstoffe-1366x768.png` | `scripts/ux-capture.mjs` | kartenmodus rohstoffe, 1366x768 |
| `docs/ux/after/08-kartenmodus-rohstoffe-1920x1080.png` | `scripts/ux-capture.mjs` | kartenmodus rohstoffe, 1920x1080 |
| `docs/ux/after/08-kartenmodus-rohstoffe-375x667.png` | `scripts/ux-capture.mjs` | kartenmodus rohstoffe, 375x667 |
| `docs/ux/after/08-kartenmodus-rohstoffe-667x375.png` | `scripts/ux-capture.mjs` | kartenmodus rohstoffe, 667x375 |
| `docs/ux/after/09-provinz-auswahl-1280x800.png` | `scripts/ux-capture.mjs` | provinz auswahl, 1280x800 |
| `docs/ux/after/09-provinz-auswahl-1366x768.png` | `scripts/ux-capture.mjs` | provinz auswahl, 1366x768 |
| `docs/ux/after/09-provinz-auswahl-1920x1080.png` | `scripts/ux-capture.mjs` | provinz auswahl, 1920x1080 |
| `docs/ux/after/09-provinz-auswahl-375x667.png` | `scripts/ux-capture.mjs` | provinz auswahl, 375x667 |
| `docs/ux/after/09-provinz-auswahl-667x375.png` | `scripts/ux-capture.mjs` | provinz auswahl, 667x375 |
| `docs/ux/after/10-hinweis-erklaerung-1280x800.png` | `scripts/ux-capture.mjs` | hinweis erklaerung, 1280x800 |
| `docs/ux/after/10-hinweis-erklaerung-1366x768.png` | `scripts/ux-capture.mjs` | hinweis erklaerung, 1366x768 |
| `docs/ux/after/10-hinweis-erklaerung-1920x1080.png` | `scripts/ux-capture.mjs` | hinweis erklaerung, 1920x1080 |
| `docs/ux/after/10-hinweis-erklaerung-375x667.png` | `scripts/ux-capture.mjs` | hinweis erklaerung, 375x667 |
| `docs/ux/after/10-hinweis-erklaerung-667x375.png` | `scripts/ux-capture.mjs` | hinweis erklaerung, 667x375 |
| `docs/ux/after/11-rueckmeldung-bau-befohlen-1280x800.png` | `scripts/ux-capture.mjs` | rueckmeldung bau befohlen, 1280x800 |
| `docs/ux/after/11-rueckmeldung-bau-befohlen-1366x768.png` | `scripts/ux-capture.mjs` | rueckmeldung bau befohlen, 1366x768 |
| `docs/ux/after/11-rueckmeldung-bau-befohlen-1920x1080.png` | `scripts/ux-capture.mjs` | rueckmeldung bau befohlen, 1920x1080 |
| `docs/ux/after/11-rueckmeldung-bau-befohlen-375x667.png` | `scripts/ux-capture.mjs` | rueckmeldung bau befohlen, 375x667 |
| `docs/ux/after/11-rueckmeldung-bau-befohlen-667x375.png` | `scripts/ux-capture.mjs` | rueckmeldung bau befohlen, 667x375 |
| `docs/ux/after/12-tempo-100-laeuft-1280x800.png` | `scripts/ux-capture.mjs` | tempo 100 laeuft, 1280x800 |
| `docs/ux/after/12-tempo-100-laeuft-1366x768.png` | `scripts/ux-capture.mjs` | tempo 100 laeuft, 1366x768 |
| `docs/ux/after/12-tempo-100-laeuft-1920x1080.png` | `scripts/ux-capture.mjs` | tempo 100 laeuft, 1920x1080 |
| `docs/ux/after/12-tempo-100-laeuft-375x667.png` | `scripts/ux-capture.mjs` | tempo 100 laeuft, 375x667 |
| `docs/ux/after/12-tempo-100-laeuft-667x375.png` | `scripts/ux-capture.mjs` | tempo 100 laeuft, 667x375 |
| `docs/ux/after/13-pause-armee-ausgehoben-1280x800.png` | `scripts/ux-capture.mjs` | pause armee ausgehoben, 1280x800 |
| `docs/ux/after/13-pause-armee-ausgehoben-1366x768.png` | `scripts/ux-capture.mjs` | pause armee ausgehoben, 1366x768 |
| `docs/ux/after/13-pause-armee-ausgehoben-375x667.png` | `scripts/ux-capture.mjs` | pause armee ausgehoben, 375x667 |
| `docs/ux/after/13-pause-armee-ausgehoben-667x375.png` | `scripts/ux-capture.mjs` | pause armee ausgehoben, 667x375 |
| `docs/ux/after/14-armee-auswahl-1280x800.png` | `scripts/ux-capture.mjs` | armee auswahl, 1280x800 |
| `docs/ux/after/14-armee-auswahl-1366x768.png` | `scripts/ux-capture.mjs` | armee auswahl, 1366x768 |
| `docs/ux/after/14-armee-auswahl-375x667.png` | `scripts/ux-capture.mjs` | armee auswahl, 375x667 |
| `docs/ux/after/14-armee-auswahl-667x375.png` | `scripts/ux-capture.mjs` | armee auswahl, 667x375 |
| `docs/ux/after/15-beschuss-gesperrt-1280x800.png` | `scripts/ux-capture.mjs` | beschuss gesperrt, 1280x800 |
| `docs/ux/after/15-beschuss-gesperrt-1366x768.png` | `scripts/ux-capture.mjs` | beschuss gesperrt, 1366x768 |
| `docs/ux/after/15-beschuss-gesperrt-375x667.png` | `scripts/ux-capture.mjs` | beschuss gesperrt, 375x667 |
| `docs/ux/after/15-beschuss-gesperrt-667x375.png` | `scripts/ux-capture.mjs` | beschuss gesperrt, 667x375 |
| `docs/ux/after/16-marsch-zielwahl-1280x800.png` | `scripts/ux-capture.mjs` | marsch zielwahl, 1280x800 |
| `docs/ux/after/16-marsch-zielwahl-1366x768.png` | `scripts/ux-capture.mjs` | marsch zielwahl, 1366x768 |
| `docs/ux/after/16-marsch-zielwahl-375x667.png` | `scripts/ux-capture.mjs` | marsch zielwahl, 375x667 |
| `docs/ux/after/16-marsch-zielwahl-667x375.png` | `scripts/ux-capture.mjs` | marsch zielwahl, 667x375 |
| `docs/ux/after/17-fehler-ungueltiges-ziel-1280x800.png` | `scripts/ux-capture.mjs` | fehler ungueltiges ziel, 1280x800 |
| `docs/ux/after/17-fehler-ungueltiges-ziel-1366x768.png` | `scripts/ux-capture.mjs` | fehler ungueltiges ziel, 1366x768 |
| `docs/ux/after/17-fehler-ungueltiges-ziel-375x667.png` | `scripts/ux-capture.mjs` | fehler ungueltiges ziel, 375x667 |
| `docs/ux/after/17-fehler-ungueltiges-ziel-667x375.png` | `scripts/ux-capture.mjs` | fehler ungueltiges ziel, 667x375 |
| `docs/ux/after/18-marsch-ziel-gewaehlt-1280x800.png` | `scripts/ux-capture.mjs` | marsch ziel gewaehlt, 1280x800 |
| `docs/ux/after/18-marsch-ziel-gewaehlt-1366x768.png` | `scripts/ux-capture.mjs` | marsch ziel gewaehlt, 1366x768 |
| `docs/ux/after/18-marsch-ziel-gewaehlt-375x667.png` | `scripts/ux-capture.mjs` | marsch ziel gewaehlt, 375x667 |
| `docs/ux/after/18-marsch-ziel-gewaehlt-667x375.png` | `scripts/ux-capture.mjs` | marsch ziel gewaehlt, 667x375 |
| `docs/ux/after/19-marsch-befohlen-1280x800.png` | `scripts/ux-capture.mjs` | marsch befohlen, 1280x800 |
| `docs/ux/after/19-marsch-befohlen-1366x768.png` | `scripts/ux-capture.mjs` | marsch befohlen, 1366x768 |
| `docs/ux/after/19-marsch-befohlen-375x667.png` | `scripts/ux-capture.mjs` | marsch befohlen, 375x667 |
| `docs/ux/after/19-marsch-befohlen-667x375.png` | `scripts/ux-capture.mjs` | marsch befohlen, 667x375 |
| `docs/ux/after/20-diplomatie-1280x800.png` | `scripts/ux-capture.mjs` | diplomatie, 1280x800 |
| `docs/ux/after/20-diplomatie-1366x768.png` | `scripts/ux-capture.mjs` | diplomatie, 1366x768 |
| `docs/ux/after/20-diplomatie-375x667.png` | `scripts/ux-capture.mjs` | diplomatie, 375x667 |
| `docs/ux/after/20-diplomatie-667x375.png` | `scripts/ux-capture.mjs` | diplomatie, 667x375 |
| `docs/ux/after/21-krieg-erklaert-ohne-rueckfrage-1280x800.png` | `scripts/ux-capture.mjs` | krieg erklaert ohne rueckfrage, 1280x800 |
| `docs/ux/after/21-krieg-erklaert-ohne-rueckfrage-1366x768.png` | `scripts/ux-capture.mjs` | krieg erklaert ohne rueckfrage, 1366x768 |
| `docs/ux/after/21-krieg-erklaert-ohne-rueckfrage-375x667.png` | `scripts/ux-capture.mjs` | krieg erklaert ohne rueckfrage, 375x667 |
| `docs/ux/after/21-krieg-erklaert-ohne-rueckfrage-667x375.png` | `scripts/ux-capture.mjs` | krieg erklaert ohne rueckfrage, 667x375 |
| `docs/ux/after/22-kampf-gefecht-1280x800.png` | `scripts/ux-capture.mjs` | kampf gefecht, 1280x800 |
| `docs/ux/after/22-kampf-gefecht-1366x768.png` | `scripts/ux-capture.mjs` | kampf gefecht, 1366x768 |
| `docs/ux/after/22-kampf-gefecht-375x667.png` | `scripts/ux-capture.mjs` | kampf gefecht, 375x667 |
| `docs/ux/after/22-kampf-gefecht-667x375.png` | `scripts/ux-capture.mjs` | kampf gefecht, 667x375 |
| `docs/ux/after/23-protokoll-kaempfe-1280x800.png` | `scripts/ux-capture.mjs` | protokoll kaempfe, 1280x800 |
| `docs/ux/after/23-protokoll-kaempfe-1366x768.png` | `scripts/ux-capture.mjs` | protokoll kaempfe, 1366x768 |
| `docs/ux/after/23-protokoll-kaempfe-375x667.png` | `scripts/ux-capture.mjs` | protokoll kaempfe, 375x667 |
| `docs/ux/after/23-protokoll-kaempfe-667x375.png` | `scripts/ux-capture.mjs` | protokoll kaempfe, 667x375 |
| `docs/ux/after/24-meldungen-depesche-1280x800.png` | `scripts/ux-capture.mjs` | meldungen depesche, 1280x800 |
| `docs/ux/after/24-meldungen-depesche-1366x768.png` | `scripts/ux-capture.mjs` | meldungen depesche, 1366x768 |
| `docs/ux/after/24-meldungen-depesche-375x667.png` | `scripts/ux-capture.mjs` | meldungen depesche, 375x667 |
| `docs/ux/after/24-meldungen-depesche-667x375.png` | `scripts/ux-capture.mjs` | meldungen depesche, 667x375 |
| `docs/ux/after/25-panel-markt-1280x800.png` | `scripts/ux-capture.mjs` | panel markt, 1280x800 |
| `docs/ux/after/25-panel-markt-1366x768.png` | `scripts/ux-capture.mjs` | panel markt, 1366x768 |
| `docs/ux/after/25-panel-markt-375x667.png` | `scripts/ux-capture.mjs` | panel markt, 375x667 |
| `docs/ux/after/25-panel-markt-667x375.png` | `scripts/ux-capture.mjs` | panel markt, 667x375 |
| `docs/ux/after/26-panel-spionage-1280x800.png` | `scripts/ux-capture.mjs` | panel spionage, 1280x800 |
| `docs/ux/after/26-panel-spionage-1366x768.png` | `scripts/ux-capture.mjs` | panel spionage, 1366x768 |
| `docs/ux/after/26-panel-spionage-375x667.png` | `scripts/ux-capture.mjs` | panel spionage, 375x667 |
| `docs/ux/after/26-panel-spionage-667x375.png` | `scripts/ux-capture.mjs` | panel spionage, 667x375 |
| `docs/ux/after/27-panel-rangliste-sieg-1280x800.png` | `scripts/ux-capture.mjs` | panel rangliste sieg, 1280x800 |
| `docs/ux/after/27-panel-rangliste-sieg-1366x768.png` | `scripts/ux-capture.mjs` | panel rangliste sieg, 1366x768 |
| `docs/ux/after/27-panel-rangliste-sieg-375x667.png` | `scripts/ux-capture.mjs` | panel rangliste sieg, 375x667 |
| `docs/ux/after/27-panel-rangliste-sieg-667x375.png` | `scripts/ux-capture.mjs` | panel rangliste sieg, 667x375 |
| `docs/ux/after/28-kartenmodus-beziehungen-1280x800.png` | `scripts/ux-capture.mjs` | kartenmodus beziehungen, 1280x800 |
| `docs/ux/after/28-kartenmodus-beziehungen-1366x768.png` | `scripts/ux-capture.mjs` | kartenmodus beziehungen, 1366x768 |
| `docs/ux/after/28-kartenmodus-beziehungen-375x667.png` | `scripts/ux-capture.mjs` | kartenmodus beziehungen, 375x667 |
| `docs/ux/after/28-kartenmodus-beziehungen-667x375.png` | `scripts/ux-capture.mjs` | kartenmodus beziehungen, 667x375 |
| `docs/ux/after/29-menue-1280x800.png` | `scripts/ux-capture.mjs` | menue, 1280x800 |
| `docs/ux/after/29-menue-1366x768.png` | `scripts/ux-capture.mjs` | menue, 1366x768 |
| `docs/ux/after/29-menue-375x667.png` | `scripts/ux-capture.mjs` | menue, 375x667 |
| `docs/ux/after/29-menue-667x375.png` | `scripts/ux-capture.mjs` | menue, 667x375 |
| `docs/ux/after/30-einstellungen-1280x800.png` | `scripts/ux-capture.mjs` | einstellungen, 1280x800 |
| `docs/ux/after/30-einstellungen-1366x768.png` | `scripts/ux-capture.mjs` | einstellungen, 1366x768 |
| `docs/ux/after/30-einstellungen-375x667.png` | `scripts/ux-capture.mjs` | einstellungen, 375x667 |
| `docs/ux/after/30-einstellungen-667x375.png` | `scripts/ux-capture.mjs` | einstellungen, 667x375 |
| `docs/ux/after/31-spielstand-gespeichert-1280x800.png` | `scripts/ux-capture.mjs` | spielstand gespeichert, 1280x800 |
| `docs/ux/after/31-spielstand-gespeichert-1366x768.png` | `scripts/ux-capture.mjs` | spielstand gespeichert, 1366x768 |
| `docs/ux/after/31-spielstand-gespeichert-375x667.png` | `scripts/ux-capture.mjs` | spielstand gespeichert, 375x667 |
| `docs/ux/after/31-spielstand-gespeichert-667x375.png` | `scripts/ux-capture.mjs` | spielstand gespeichert, 667x375 |
| `docs/ux/after/32-fehler-spielstand-beschaedigt-1280x800.png` | `scripts/ux-capture.mjs` | fehler spielstand beschaedigt, 1280x800 |
| `docs/ux/after/32-fehler-spielstand-beschaedigt-1366x768.png` | `scripts/ux-capture.mjs` | fehler spielstand beschaedigt, 1366x768 |
| `docs/ux/after/32-fehler-spielstand-beschaedigt-375x667.png` | `scripts/ux-capture.mjs` | fehler spielstand beschaedigt, 375x667 |
| `docs/ux/after/32-fehler-spielstand-beschaedigt-667x375.png` | `scripts/ux-capture.mjs` | fehler spielstand beschaedigt, 667x375 |
| `docs/ux/after/33-spielende-sieg-1280x800.png` | `scripts/ux-capture.mjs` | spielende sieg, 1280x800 |
| `docs/ux/after/33-spielende-sieg-1366x768.png` | `scripts/ux-capture.mjs` | spielende sieg, 1366x768 |
| `docs/ux/after/33-spielende-sieg-375x667.png` | `scripts/ux-capture.mjs` | spielende sieg, 375x667 |
| `docs/ux/after/33-spielende-sieg-667x375.png` | `scripts/ux-capture.mjs` | spielende sieg, 667x375 |
| `docs/ux/after/34-spielende-niederlage-1280x800.png` | `scripts/ux-capture.mjs` | spielende niederlage, 1280x800 |
| `docs/ux/after/34-spielende-niederlage-1366x768.png` | `scripts/ux-capture.mjs` | spielende niederlage, 1366x768 |
| `docs/ux/after/34-spielende-niederlage-375x667.png` | `scripts/ux-capture.mjs` | spielende niederlage, 375x667 |
| `docs/ux/after/34-spielende-niederlage-667x375.png` | `scripts/ux-capture.mjs` | spielende niederlage, 667x375 |
| `docs/ux/after/mp-gast-bedingungen-1280x800.png` | `scripts/ux-capture.mjs` | mp gast bedingungen, 1280x800 |
| `docs/ux/after/mp-gast-bedingungen-375x667.png` | `scripts/ux-capture.mjs` | mp gast bedingungen, 375x667 |
| `docs/ux/after/mp-gast-name-1280x800.png` | `scripts/ux-capture.mjs` | mp gast name, 1280x800 |
| `docs/ux/after/mp-gast-name-375x667.png` | `scripts/ux-capture.mjs` | mp gast name, 375x667 |
| `docs/ux/after/mp-gastgeber-anlegen-1280x800.png` | `scripts/ux-capture.mjs` | mp gastgeber anlegen, 1280x800 |
| `docs/ux/after/mp-gastgeber-anlegen-375x667.png` | `scripts/ux-capture.mjs` | mp gastgeber anlegen, 375x667 |
| `docs/ux/after/mp-kopfleiste-feste-rate-1280x800.png` | `scripts/ux-capture.mjs` | mp kopfleiste feste rate, 1280x800 |
| `docs/ux/after/mp-kopfleiste-feste-rate-375x667.png` | `scripts/ux-capture.mjs` | mp kopfleiste feste rate, 375x667 |
| `docs/ux/after/mp-lobby-gast-da-1280x800.png` | `scripts/ux-capture.mjs` | mp lobby gast da, 1280x800 |
| `docs/ux/after/mp-lobby-gast-da-375x667.png` | `scripts/ux-capture.mjs` | mp lobby gast da, 375x667 |
| `docs/ux/after/mp-lobby-gastgeber-1280x800.png` | `scripts/ux-capture.mjs` | mp lobby gastgeber, 1280x800 |
| `docs/ux/after/mp-lobby-gastgeber-375x667.png` | `scripts/ux-capture.mjs` | mp lobby gastgeber, 375x667 |
| `docs/ux/after/mp-vorhang-gesperrt-1280x800.png` | `scripts/ux-capture.mjs` | mp vorhang gesperrt, 1280x800 |
| `docs/ux/after/mp-vorhang-gesperrt-375x667.png` | `scripts/ux-capture.mjs` | mp vorhang gesperrt, 375x667 |
| `docs/ux/after/x-krieg-fragt-nach-1280x800.png` | `scripts/ux-capture.mjs` | krieg fragt nach, 1280x800 |
| `docs/ux/after/x-krieg-fragt-nach-1366x768.png` | `scripts/ux-capture.mjs` | krieg fragt nach, 1366x768 |
| `docs/ux/after/x-krieg-fragt-nach-375x667.png` | `scripts/ux-capture.mjs` | krieg fragt nach, 375x667 |
| `docs/ux/after/x-krieg-fragt-nach-667x375.png` | `scripts/ux-capture.mjs` | krieg fragt nach, 667x375 |

## Bildschirmfotos der Spaetspiel-Aufnahme (V3 P0-B1, 2026-10-04)

Kein Fremdinhalt — Bildschirmfotos des eigenen Spiels, erzeugt mit `node scripts/ux-late.mjs --out docs/ux/v3-before` (Playwright gegen den Dev-Server, Staende `test/fixtures/v3`). Nur 375x667 und 1280x800 (PLAN-V3 Regel 12). Sie stehen hier, weil `test/guards/no-foreign-assets.test.ts` jede eingecheckte Bilddatei namentlich verlangt. Befunde: `docs/ux/v3-before/messwerte-spaet.json`.

| Datei | Erzeugt von | Zeigt |
|---|---|---|
| `docs/ux/v3-before/S100-04-karte-brennpunkt-1280x800.png` | `scripts/ux-late.mjs` | Tag 100: Karte im Brennpunkt der Armeen, 1280x800 |
| `docs/ux/v3-before/S100-04-karte-brennpunkt-375x667.png` | `scripts/ux-late.mjs` | Tag 100: Karte im Brennpunkt der Armeen, 375x667 |
| `docs/ux/v3-before/S100-06-protokoll-alles-1280x800.png` | `scripts/ux-late.mjs` | Tag 100: volles Protokoll, 1280x800 |
| `docs/ux/v3-before/S100-06-protokoll-alles-375x667.png` | `scripts/ux-late.mjs` | Tag 100: volles Protokoll, 375x667 |
| `docs/ux/v3-before/S100-12-diplomatie-1280x800.png` | `scripts/ux-late.mjs` | Tag 100: Diplomatie, 1280x800 |
| `docs/ux/v3-before/S100-12-diplomatie-375x667.png` | `scripts/ux-late.mjs` | Tag 100: Diplomatie, 375x667 |
| `docs/ux/v3-before/S300-04-karte-brennpunkt-1280x800.png` | `scripts/ux-late.mjs` | Tag 300: Karte im Brennpunkt der Armeen, 1280x800 |
| `docs/ux/v3-before/S300-04-karte-brennpunkt-375x667.png` | `scripts/ux-late.mjs` | Tag 300: Karte im Brennpunkt der Armeen, 375x667 |
| `docs/ux/v3-before/S300-06-protokoll-alles-1280x800.png` | `scripts/ux-late.mjs` | Tag 300: volles Protokoll, 1280x800 |
| `docs/ux/v3-before/S300-06-protokoll-alles-375x667.png` | `scripts/ux-late.mjs` | Tag 300: volles Protokoll, 375x667 |
| `docs/ux/v3-before/S300-12-diplomatie-1280x800.png` | `scripts/ux-late.mjs` | Tag 300: Diplomatie, 1280x800 |
| `docs/ux/v3-before/S300-12-diplomatie-375x667.png` | `scripts/ux-late.mjs` | Tag 300: Diplomatie, 375x667 |
| `docs/ux/v3-before/S575-04-karte-brennpunkt-1280x800.png` | `scripts/ux-late.mjs` | Tag 575: Karte im Brennpunkt der Armeen, 1280x800 |
| `docs/ux/v3-before/S575-04-karte-brennpunkt-375x667.png` | `scripts/ux-late.mjs` | Tag 575: Karte im Brennpunkt der Armeen, 375x667 |
| `docs/ux/v3-before/S575-06-protokoll-alles-1280x800.png` | `scripts/ux-late.mjs` | Tag 575: volles Protokoll, 1280x800 |
| `docs/ux/v3-before/S575-06-protokoll-alles-375x667.png` | `scripts/ux-late.mjs` | Tag 575: volles Protokoll, 375x667 |
| `docs/ux/v3-before/S575-12-diplomatie-1280x800.png` | `scripts/ux-late.mjs` | Tag 575: Diplomatie, 1280x800 |
| `docs/ux/v3-before/S575-12-diplomatie-375x667.png` | `scripts/ux-late.mjs` | Tag 575: Diplomatie, 375x667 |
| `docs/ux/v3-before/S575G-01-karte-geladen-1280x800.png` | `scripts/ux-late.mjs` | Tag 575 aus Sicht der staerksten Macht: Karte nach dem Laden, 1280x800 |
| `docs/ux/v3-before/S575G-01-karte-geladen-375x667.png` | `scripts/ux-late.mjs` | Tag 575 aus Sicht der staerksten Macht: Karte nach dem Laden, 375x667 |
| `docs/ux/v3-before/S575G-02-karte-besitz-1280x800.png` | `scripts/ux-late.mjs` | Tag 575 aus Sicht der staerksten Macht: Karte Besitz, 1280x800 |
| `docs/ux/v3-before/S575G-02-karte-besitz-375x667.png` | `scripts/ux-late.mjs` | Tag 575 aus Sicht der staerksten Macht: Karte Besitz, 375x667 |
| `docs/ux/v3-before/S575G-03-karte-truppen-1280x800.png` | `scripts/ux-late.mjs` | Tag 575 aus Sicht der staerksten Macht: Karte Truppenstaerke, 1280x800 |
| `docs/ux/v3-before/S575G-03-karte-truppen-375x667.png` | `scripts/ux-late.mjs` | Tag 575 aus Sicht der staerksten Macht: Karte Truppenstaerke, 375x667 |
| `docs/ux/v3-before/S575G-04-karte-brennpunkt-1280x800.png` | `scripts/ux-late.mjs` | Tag 575 aus Sicht der staerksten Macht: Karte im Brennpunkt der Armeen, 1280x800 |
| `docs/ux/v3-before/S575G-04-karte-brennpunkt-375x667.png` | `scripts/ux-late.mjs` | Tag 575 aus Sicht der staerksten Macht: Karte im Brennpunkt der Armeen, 375x667 |
| `docs/ux/v3-before/S575G-05-karte-zoom-schieben-1280x800.png` | `scripts/ux-late.mjs` | Tag 575 aus Sicht der staerksten Macht: Karte gezoomt, 1280x800 |
| `docs/ux/v3-before/S575G-05-karte-zoom-schieben-375x667.png` | `scripts/ux-late.mjs` | Tag 575 aus Sicht der staerksten Macht: Karte gezoomt, 375x667 |
| `docs/ux/v3-before/S575G-06-protokoll-alles-1280x800.png` | `scripts/ux-late.mjs` | Tag 575 aus Sicht der staerksten Macht: volles Protokoll, 1280x800 |
| `docs/ux/v3-before/S575G-06-protokoll-alles-375x667.png` | `scripts/ux-late.mjs` | Tag 575 aus Sicht der staerksten Macht: volles Protokoll, 375x667 |
| `docs/ux/v3-before/S575G-07-protokoll-kaempfe-1280x800.png` | `scripts/ux-late.mjs` | Tag 575 aus Sicht der staerksten Macht: Protokoll Kaempfe, 1280x800 |
| `docs/ux/v3-before/S575G-07-protokoll-kaempfe-375x667.png` | `scripts/ux-late.mjs` | Tag 575 aus Sicht der staerksten Macht: Protokoll Kaempfe, 375x667 |
| `docs/ux/v3-before/S575G-08-provinz-eigene-1280x800.png` | `scripts/ux-late.mjs` | Tag 575 aus Sicht der staerksten Macht: Provinzpanel, 1280x800 |
| `docs/ux/v3-before/S575G-08-provinz-eigene-375x667.png` | `scripts/ux-late.mjs` | Tag 575 aus Sicht der staerksten Macht: Provinzpanel, 375x667 |
| `docs/ux/v3-before/S575G-09-armee-ausheben-1280x800.png` | `scripts/ux-late.mjs` | Tag 575 aus Sicht der staerksten Macht: Armee ausgehoben, 1280x800 |
| `docs/ux/v3-before/S575G-09-armee-ausheben-375x667.png` | `scripts/ux-late.mjs` | Tag 575 aus Sicht der staerksten Macht: Armee ausgehoben, 375x667 |
| `docs/ux/v3-before/S575G-10-armee-panel-1280x800.png` | `scripts/ux-late.mjs` | Tag 575 aus Sicht der staerksten Macht: Armeepanel, 1280x800 |
| `docs/ux/v3-before/S575G-10-armee-panel-375x667.png` | `scripts/ux-late.mjs` | Tag 575 aus Sicht der staerksten Macht: Armeepanel, 375x667 |
| `docs/ux/v3-before/S575G-11-armee-marsch-zielwahl-1280x800.png` | `scripts/ux-late.mjs` | Tag 575 aus Sicht der staerksten Macht: Marsch-Zielwahl, 1280x800 |
| `docs/ux/v3-before/S575G-11-armee-marsch-zielwahl-375x667.png` | `scripts/ux-late.mjs` | Tag 575 aus Sicht der staerksten Macht: Marsch-Zielwahl, 375x667 |
| `docs/ux/v3-before/S575G-12-diplomatie-1280x800.png` | `scripts/ux-late.mjs` | Tag 575 aus Sicht der staerksten Macht: Diplomatie, 1280x800 |
| `docs/ux/v3-before/S575G-12-diplomatie-375x667.png` | `scripts/ux-late.mjs` | Tag 575 aus Sicht der staerksten Macht: Diplomatie, 375x667 |
| `docs/ux/v3-before/S575G-13-diplomatie-macht-1280x800.png` | `scripts/ux-late.mjs` | Tag 575 aus Sicht der staerksten Macht: Diplomatie mit gewaehlter Macht, 1280x800 |
| `docs/ux/v3-before/S575G-13-diplomatie-macht-375x667.png` | `scripts/ux-late.mjs` | Tag 575 aus Sicht der staerksten Macht: Diplomatie mit gewaehlter Macht, 375x667 |
| `docs/ux/v3-before/S575G-14-markt-1280x800.png` | `scripts/ux-late.mjs` | Tag 575 aus Sicht der staerksten Macht: Markt, 1280x800 |
| `docs/ux/v3-before/S575G-14-markt-375x667.png` | `scripts/ux-late.mjs` | Tag 575 aus Sicht der staerksten Macht: Markt, 375x667 |
| `docs/ux/v3-before/S575G-15-spionage-1280x800.png` | `scripts/ux-late.mjs` | Tag 575 aus Sicht der staerksten Macht: Spionage, 1280x800 |
| `docs/ux/v3-before/S575G-15-spionage-375x667.png` | `scripts/ux-late.mjs` | Tag 575 aus Sicht der staerksten Macht: Spionage, 375x667 |
| `docs/ux/v3-before/S575G-16-rangliste-1280x800.png` | `scripts/ux-late.mjs` | Tag 575 aus Sicht der staerksten Macht: Rangliste, 1280x800 |
| `docs/ux/v3-before/S575G-16-rangliste-375x667.png` | `scripts/ux-late.mjs` | Tag 575 aus Sicht der staerksten Macht: Rangliste, 375x667 |
| `docs/ux/v3-before/S575G-17-speichern-laden-1280x800.png` | `scripts/ux-late.mjs` | Tag 575 aus Sicht der staerksten Macht: Spielstaende speichern, 1280x800 |
| `docs/ux/v3-before/S575G-17-speichern-laden-375x667.png` | `scripts/ux-late.mjs` | Tag 575 aus Sicht der staerksten Macht: Spielstaende speichern, 375x667 |
| `docs/ux/v3-before/S575G-18-laden-grosser-stand-1280x800.png` | `scripts/ux-late.mjs` | Tag 575 aus Sicht der staerksten Macht: Laden eines grossen Standes, 1280x800 |
| `docs/ux/v3-before/S575G-18-laden-grosser-stand-375x667.png` | `scripts/ux-late.mjs` | Tag 575 aus Sicht der staerksten Macht: Laden eines grossen Standes, 375x667 |
| `docs/ux/v3-before/S575G-19-tempo-100-alarm-1280x800.png` | `scripts/ux-late.mjs` | Tag 575 aus Sicht der staerksten Macht: Tempo 100 mit Alarm, 1280x800 |
| `docs/ux/v3-before/S575G-19-tempo-100-alarm-375x667.png` | `scripts/ux-late.mjs` | Tag 575 aus Sicht der staerksten Macht: Tempo 100 mit Alarm, 375x667 |

## Symbole von Dritten — game-icons.net, milsymbol, Lucide (V3 Welle 2, T-M46-13, 2026-10-04)

Auf Noahs Wort vom 2026-10-04 (DECISIONS) ist R-ASSET-02 für **CC BY 3.0** geöffnet; CC BY verlangt die Nennung
des Urhebers, und die steht hier **und** sichtbar im Spiel (Menü, Eintrag „Mitwirkende“; Quelle der Texte:
`CREDITS` in `apps/desktop/src/ui/glyphs.ts`). Die Dateien liegen unverändert wie bezogen vor; das Spiel
verwendet nur den weißen Pfad und füllt ihn mit der Textfarbe (`apps/desktop/src/ui/Icon.tsx`).

**game-icons.net** — Lizenz Creative Commons Attribution 3.0 (https://creativecommons.org/licenses/by/3.0/),
Bezug https://github.com/game-icons/icons (Ordner je Urheber), Seite https://game-icons.net. Kein Konto nötig.

| Datei | Urheber | Quelle | Zeigt |
|---|---|---|---|
| `apps/desktop/src/ui/glyphs/delapouite_barracks.svg` | Delapouite — CC BY 3.0 | https://game-icons.net/1x1/delapouite/barracks.html | Kaserne |
| `apps/desktop/src/ui/glyphs/delapouite_factory.svg` | Delapouite — CC BY 3.0 | https://game-icons.net/1x1/delapouite/factory.html | Fabrik |
| `apps/desktop/src/ui/glyphs/delapouite_control-tower.svg` | Delapouite — CC BY 3.0 | https://game-icons.net/1x1/delapouite/control-tower.html | Flugplatz |
| `apps/desktop/src/ui/glyphs/delapouite_harbor-dock.svg` | Delapouite — CC BY 3.0 | https://game-icons.net/1x1/delapouite/harbor-dock.html | Hafen |
| `apps/desktop/src/ui/glyphs/delapouite_crane.svg` | Delapouite — CC BY 3.0 | https://game-icons.net/1x1/delapouite/crane.html | Werft |
| `apps/desktop/src/ui/glyphs/delapouite_military-fort.svg` | Delapouite — CC BY 3.0 | https://game-icons.net/1x1/delapouite/military-fort.html | Festung |
| `apps/desktop/src/ui/glyphs/delapouite_railway.svg` | Delapouite — CC BY 3.0 | https://game-icons.net/1x1/delapouite/railway.html | Bahn |
| `apps/desktop/src/ui/glyphs/lorc_wheat.svg` | Lorc — CC BY 3.0 | https://game-icons.net/1x1/lorc/wheat.html | Nahrung |
| `apps/desktop/src/ui/glyphs/delapouite_wood-pile.svg` | Delapouite — CC BY 3.0 | https://game-icons.net/1x1/delapouite/wood-pile.html | Material |
| `apps/desktop/src/ui/glyphs/lorc_metal-bar.svg` | Lorc — CC BY 3.0 | https://game-icons.net/1x1/lorc/metal-bar.html | Eisen |
| `apps/desktop/src/ui/glyphs/delapouite_coal-pile.svg` | Delapouite — CC BY 3.0 | https://game-icons.net/1x1/delapouite/coal-pile.html | Kohle |
| `apps/desktop/src/ui/glyphs/skoll_oil-drum.svg` | Skoll — CC BY 3.0 | https://game-icons.net/1x1/skoll/oil-drum.html | Öl |
| `apps/desktop/src/ui/glyphs/lorc_crystal-cluster.svg` | Lorc — CC BY 3.0 | https://game-icons.net/1x1/lorc/crystal-cluster.html | Seltene Erden |
| `apps/desktop/src/ui/glyphs/delapouite_coins-pile.svg` | Delapouite — CC BY 3.0 | https://game-icons.net/1x1/delapouite/coins-pile.html | Geld |

**milsymbol** — Måns Beckman (Spatial Illusions), Lizenz **MIT**, https://github.com/spatialillusions/milsymbol,
npm-Paket `milsymbol` (`apps/desktop/package.json`). Erzeugt zur Laufzeit die NATO-Truppenzeichen (APP-6/MIL-STD-2525)
für die zehn Einheitenarten; es wird keine Datei eingecheckt.

**Lucide** — Lucide Contributors (Eric Fennis u. a.), Lizenz **ISC**, https://github.com/lucide-icons/lucide,
npm-Paket `lucide-react` (`apps/desktop/package.json`). Oberflächensymbole (Uhr, Pause, Warnung, Beziehungen,
Gelände, Spionage); keine Datei eingecheckt.

## Klänge von Dritten — Kenney (V3 Welle 2, T-M46-14, 2026-10-04)

Urheber **Kenney** (www.kenney.nl), Lizenz **CC0 1.0** (https://creativecommons.org/publicdomain/zero/1.0/, gemeinfrei
gestellt; Nennung freiwillig und im Menü unter „Mitwirkende“ trotzdem geführt). Bezug ohne Konto von
https://kenney.nl/assets/interface-sounds und https://kenney.nl/assets/impact-sounds (ZIP, 835 kB bzw. 801 kB; daraus
nur die neun Dateien unten, unverändert, OGG). Sie liegen unter `apps/desktop/src/ui/sfx/` und stehen als Daten-URL im
Bündel (`sound.ts`, kein `fetch`: `connect-src 'none'`).

| Datei | Paket | Ereignisart | Zweck |
|---|---|---|---|
| `apps/desktop/src/ui/sfx/select_002.ogg` | Kenney Interface Sounds (CC0) | `select` | Befehl/Auswahl |
| `apps/desktop/src/ui/sfx/confirmation_002.ogg` | Kenney Interface Sounds (CC0) | `complete` | Bau fertig |
| `apps/desktop/src/ui/sfx/error_004.ogg` | Kenney Interface Sounds (CC0) | `shortage` | Rohstoffmangel |
| `apps/desktop/src/ui/sfx/bong_001.ogg` | Kenney Interface Sounds (CC0) | `intruded` | Alarm: Einmarsch |
| `apps/desktop/src/ui/sfx/question_002.ogg` | Kenney Interface Sounds (CC0) | `diplomacy` | Diplomatie |
| `apps/desktop/src/ui/sfx/impactMetal_medium_002.ogg` | Kenney Impact Sounds (CC0) | `recruited` | Aushebung |
| `apps/desktop/src/ui/sfx/impactMetal_heavy_001.ogg` | Kenney Impact Sounds (CC0) | `battle` | Gefecht |
| `apps/desktop/src/ui/sfx/impactBell_heavy_003.ogg` | Kenney Impact Sounds (CC0) | `captured` | Eroberung |
| `apps/desktop/src/ui/sfx/impactPlate_heavy_002.ogg` | Kenney Impact Sounds (CC0) | `war` | Kriegserklärung |

## Bildschirmfotos der Bahn U-Bild (V3 Welle 2, T-M46-13 / T-M46-03, 2026-10-04)

Kein Fremdinhalt — Bildschirmfotos des eigenen Spiels (Stand S575G, Sicht der stärksten Macht, mit den Symbolen aus dem
Abschnitt oben), erzeugt mit `node scripts/ux-bild.mjs --shots docs/ux/v3-after`. Messwerte dazu:
`docs/reports/v3/ubild-vorher.json` und `docs/reports/v3/ubild-nachher.json`. Nur 375x667 und 1280x800.

| Datei | Erzeugt von | Zeigt |
|---|---|---|
| `docs/ux/v3-after/S575G-armee-1280x800.png` | `scripts/ux-bild.mjs` | Armeepanel mit Haltungen als Zeichen und Truppenzeichen, 1280x800 |
| `docs/ux/v3-after/S575G-armee-375x667.png` | `scripts/ux-bild.mjs` | Armeepanel mit Haltungen als Zeichen und Truppenzeichen, 375x667 |
| `docs/ux/v3-after/S575G-brennpunkt-1280x800.png` | `scripts/ux-bild.mjs` | Karte über Asien: aufgefächerte Armeestapel, 1280x800 |
| `docs/ux/v3-after/S575G-karte-1280x800.png` | `scripts/ux-bild.mjs` | Karte mit der neuen Kopfleiste (Symbole statt Text), 1280x800 |
| `docs/ux/v3-after/S575G-karte-375x667.png` | `scripts/ux-bild.mjs` | Karte mit der neuen Kopfleiste (Symbole statt Text), 375x667 |
| `docs/ux/v3-after/S575G-nah-1280x800.png` | `scripts/ux-bild.mjs` | Karte über Asien, vergrößert: aufgefächerte Armeestapel, 1280x800 |
| `docs/ux/v3-after/S575G-provinz-1280x800.png` | `scripts/ux-bild.mjs` | Provinzpanel mit Zeichen für Eigentümer, Bevölkerung, Moral und Bauplätze, 1280x800 |
| `docs/ux/v3-after/S575G-provinz-375x667.png` | `scripts/ux-bild.mjs` | Provinzpanel mit Zeichen für Eigentümer, Bevölkerung, Moral und Bauplätze, 375x667 |
