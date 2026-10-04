import type { IconName } from './icons.tsx'
import barracks from './glyphs/delapouite_barracks.svg?raw'
import coal from './glyphs/delapouite_coal-pile.svg?raw'
import coins from './glyphs/delapouite_coins-pile.svg?raw'
import controlTower from './glyphs/delapouite_control-tower.svg?raw'
import crane from './glyphs/delapouite_crane.svg?raw'
import factory from './glyphs/delapouite_factory.svg?raw'
import harbour from './glyphs/delapouite_harbor-dock.svg?raw'
import fort from './glyphs/delapouite_military-fort.svg?raw'
import railway from './glyphs/delapouite_railway.svg?raw'
import wood from './glyphs/delapouite_wood-pile.svg?raw'
import crystals from './glyphs/lorc_crystal-cluster.svg?raw'
import metal from './glyphs/lorc_metal-bar.svg?raw'
import wheat from './glyphs/lorc_wheat.svg?raw'
import oil from './glyphs/skoll_oil-drum.svg?raw'

/**
 * Die Symbole fuer Gebaeude und Rohstoffe: game-icons.net (CC BY 3.0) — Urheber je Datei in
 * `docs/ASSETS.md` und im Dialog „Mitwirkende" (`CREDITS` unten).
 *
 * Jede Datei ist ein 512er-Bild aus einem schwarzen Hintergrund und einem weissen Pfad. Hier
 * bleibt nur der weisse Pfad uebrig; gefuellt wird mit der Textfarbe. Dieselben Pfaddaten
 * zeichnet die Karte ueber Path2D (Kasten 512 x 512).
 */
export const GLYPH_BOX = 512

const whitePath = (svg: string): string => /<path\s+fill="#fff"\s+d="([^"]+)"/.exec(svg)?.[1] ?? ''

export const GLYPH_PATHS: Readonly<Partial<Record<IconName, string>>> = {
  barracks: whitePath(barracks),
  factory: whitePath(factory),
  airfield: whitePath(controlTower),
  harbour: whitePath(harbour),
  shipyard: whitePath(crane),
  fortress: whitePath(fort),
  railway: whitePath(railway),
  food: whitePath(wheat),
  wood: whitePath(wood),
  iron: whitePath(metal),
  coal: whitePath(coal),
  oil: whitePath(oil),
  rare: whitePath(crystals),
  money: whitePath(coins),
}

/** Namensnennung, wie CC BY 3.0 sie verlangt: Symbol, Urheber, Quelle. */
export interface Credit {
  work: string
  author: string
  license: string
  source: string
}

const GI = 'https://game-icons.net'
export const CREDITS: readonly Credit[] = [
  { work: 'Kaserne (barracks)', author: 'Delapouite', license: 'CC BY 3.0', source: `${GI}/1x1/delapouite/barracks.html` },
  { work: 'Fabrik (factory)', author: 'Delapouite', license: 'CC BY 3.0', source: `${GI}/1x1/delapouite/factory.html` },
  { work: 'Flugplatz (control tower)', author: 'Delapouite', license: 'CC BY 3.0', source: `${GI}/1x1/delapouite/control-tower.html` },
  { work: 'Hafen (harbor dock)', author: 'Delapouite', license: 'CC BY 3.0', source: `${GI}/1x1/delapouite/harbor-dock.html` },
  { work: 'Werft (crane)', author: 'Delapouite', license: 'CC BY 3.0', source: `${GI}/1x1/delapouite/crane.html` },
  { work: 'Festung (military fort)', author: 'Delapouite', license: 'CC BY 3.0', source: `${GI}/1x1/delapouite/military-fort.html` },
  { work: 'Bahn (railway)', author: 'Delapouite', license: 'CC BY 3.0', source: `${GI}/1x1/delapouite/railway.html` },
  { work: 'Nahrung (wheat)', author: 'Lorc', license: 'CC BY 3.0', source: `${GI}/1x1/lorc/wheat.html` },
  { work: 'Material (wood pile)', author: 'Delapouite', license: 'CC BY 3.0', source: `${GI}/1x1/delapouite/wood-pile.html` },
  { work: 'Eisen (metal bar)', author: 'Lorc', license: 'CC BY 3.0', source: `${GI}/1x1/lorc/metal-bar.html` },
  { work: 'Kohle (coal pile)', author: 'Delapouite', license: 'CC BY 3.0', source: `${GI}/1x1/delapouite/coal-pile.html` },
  { work: 'Öl (oil drum)', author: 'Skoll', license: 'CC BY 3.0', source: `${GI}/1x1/skoll/oil-drum.html` },
  { work: 'Seltene Erden (crystal cluster)', author: 'Lorc', license: 'CC BY 3.0', source: `${GI}/1x1/lorc/crystal-cluster.html` },
  { work: 'Geld (coins pile)', author: 'Delapouite', license: 'CC BY 3.0', source: `${GI}/1x1/delapouite/coins-pile.html` },
  { work: 'Truppenzeichen (milsymbol)', author: 'Måns Beckman, Spatial Illusions', license: 'MIT', source: 'https://github.com/spatialillusions/milsymbol' },
  { work: 'Oberflächensymbole (Lucide)', author: 'Lucide Contributors', license: 'ISC', source: 'https://github.com/lucide-icons/lucide' },
  { work: 'Klänge (Interface Sounds, Impact Sounds)', author: 'Kenney (www.kenney.nl)', license: 'CC0', source: 'https://kenney.nl/assets' },
]
