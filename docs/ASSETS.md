# ASSETS — Herkunft und Lizenz aller Fremdinhalte

Anforderung R-ASSET-01 verbietet Fremdassets ohne freie Lizenz, R-ASSET-02 lässt nur
gemeinfreie, CC0-, OFL- oder MIT-artige Lizenzen zu. Diese Datei ist der Nachweis. Sie
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

**Klänge** (`apps/desktop/src/ui/sound.ts`): keine Aufnahmen, sondern erzeugte Töne über
die Web-Audio-Schnittstelle — je Ereignis ein Oszillator mit Frequenz, Dauer und
Hüllkurve. Nichts wird geladen, nichts ist lizenziert, nichts wiegt etwas.

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
