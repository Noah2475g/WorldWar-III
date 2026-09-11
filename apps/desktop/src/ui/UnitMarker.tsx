import { ART, type ArtName } from './art.tsx'
import { ICON_PATHS, type IconName } from './icons.tsx'

/**
 * Der NATO-Stapel als SVG fuers Panel (T-M31-02, D27.2, R-UI-10).
 *
 * Dieselbe Sprache wie auf der Karte (T-M30-01): Rechteck 30 x 18, Rahmen in der
 * Besitzerfarbe, Glyphe links aus demselben 24er-Pfad, Zahl rechts. Ein Strichbild,
 * zwei Ausgaben — die Karte stempelt es auf die Leinwand, das Panel setzt es als SVG.
 * Die Zahl steht als Text im Bild UND im Namen fuers Ohr: "8 Infanterie".
 *
 * Seit T-M33-04 kann dieselbe Platte statt der Glyphe einen **Schattenriss** tragen
 * (D33.2/D33.3). Was dabei NICHT wechselt, ist der Punkt: Rahmen, Besitzerfarbe, Lage
 * und Zahl bleiben, wo sie sind. Zwei Bildsprachen im selben Spiel halten nur zusammen,
 * solange alles ausser der Fuellung gleich bleibt (Risiko 1) — und die Karte selbst
 * bleibt ganz bei der Glyphe, weil elf Pixel keinen Panzer tragen (D33-a).
 */

export type MarkerTone = 'own' | 'ally' | 'enemy' | 'other'

/** Der Kasten des Plaettchens in eigenen Einheiten — die Breite in px skaliert ihn. */
const BOX_WIDTH = 30
const BOX_HEIGHT = 18
/** Breite mit Glyphe (T-M31-02) und mit Bild (D33.3). */
const GLYPH_WIDTH = 30
const ART_WIDTH = 44

/**
 * Der Platz links im Kasten, in den das Bild passen muss: 17 x 14 Einheiten neben der
 * Zahl. Der Kasten des Bildsatzes ist 48 x 30, also entscheidet die Breite.
 */
const ART_SCALE = 17 / 48
const ART_OFFSET_Y = (BOX_HEIGHT - 30 * ART_SCALE) / 2

export interface UnitMarkerProps {
  icon: IconName
  /** Der Schattenriss statt der Glyphe (T-M33-04). Fehlt er, bleibt es bei `icon`. */
  art?: ArtName
  label: string
  count: number
  tone?: MarkerTone
}

export function UnitMarker({ icon, art, label, count, tone = 'own' }: UnitMarkerProps) {
  const name = `${count} ${label}`
  const width = art ? ART_WIDTH : GLYPH_WIDTH
  return (
    <svg
      className={`unit-marker unit-marker--${tone}`}
      width={width}
      height={(width * BOX_HEIGHT) / BOX_WIDTH}
      viewBox={`0 0 ${BOX_WIDTH} ${BOX_HEIGHT}`}
      role="img"
      aria-label={name}
    >
      <title>{name}</title>
      <rect x={0.6} y={0.6} width={28.8} height={16.8} rx={1} className="unit-marker__box" />
      {art ? (
        /* Der Schattenriss: Flaeche und Innenlinien, links im Kasten wie die Glyphe. */
        <g transform={`translate(2 ${ART_OFFSET_Y}) scale(${ART_SCALE})`}>
          <path d={ART[art].body} className="unit-marker__art" />
          <path d={ART[art].cut} className="unit-marker__art-cut" />
        </g>
      ) : (
        /* Die Glyphe: 24er-Pfad auf 11 px, links im Kasten. */
        <g transform="translate(3.5 3.5) scale(0.4583)">
          <path d={ICON_PATHS[icon]} className="unit-marker__glyph" />
        </g>
      )}
      <text x={27} y={12.5} textAnchor="end" className="unit-marker__count">
        {count}
      </text>
    </svg>
  )
}
