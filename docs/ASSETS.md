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
| `ne_50m_admin_1_states_provinces` | Verwaltungseinheiten erster Ordnung, Rohmasse für die Provinzkuration | https://naciscdn.org/naturalearth/50m/cultural/ne_50m_admin_1_states_provinces.zip |
| `ne_50m_admin_0_countries` | Staatsgrenzen und Landeskennungen | https://naciscdn.org/naturalearth/50m/cultural/ne_50m_admin_0_countries.zip |
| `ne_50m_ocean` | Meeresflächen, Küstenerkennung, Seewege | https://naciscdn.org/naturalearth/50m/physical/ne_50m_ocean.zip |

Maßstab 1:50 Mio — die mittlere der drei Natural-Earth-Stufen. 1:10 Mio wäre für 150–250
Provinzen unnötig fein (und zehnmal so groß), 1:110 Mio zu grob für Inseln und Meerengen.

## Schrift — IBM Plex

**Lizenz:** SIL Open Font License 1.1 (OFL). Verwendet werden IBM Plex Sans, IBM Plex Sans
Condensed und IBM Plex Mono. Quelle: https://github.com/IBM/plex

Im Mockup (`docs/design/ui-mockup.html`) über Google Fonts eingebunden; die ausgelieferte
Anwendung bettet die Schriftdateien ein, damit sie ohne Netz funktioniert (R-FREE-04).

## Alles Übrige

Icons, Kartensymbole, Farben, Klänge und Texte sind selbst erstellt. Die Einheitensymbole
folgen der Formensprache militärischer Lagekarten (Rechteck mit Diagonalkreuz für
Infanterie und so fort) — das ist eine gemeinfreie Konvention, keine Übernahme aus einem
konkreten Werk.

**Ausdrücklich nicht übernommen:** Grafiken, Klänge, Texte oder Daten aus *Supremacy 1914*
oder *Conflict of Nations*. Die Mechanik-Recherche in `docs/research/SUPREMACY-MECHANICS.md`
beschreibt Spielregeln — Regeln sind nicht urheberrechtlich geschützt, ihre Darstellung
schon.
