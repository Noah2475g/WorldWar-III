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
