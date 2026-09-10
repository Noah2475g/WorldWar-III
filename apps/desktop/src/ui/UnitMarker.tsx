import { ICON_PATHS, type IconName } from './icons.tsx'

/**
 * Der NATO-Stapel als SVG fuers Panel (T-M31-02, D27.2, R-UI-10).
 *
 * Dieselbe Sprache wie auf der Karte (T-M30-01): Rechteck 30 x 18, Rahmen in der
 * Besitzerfarbe, Glyphe links aus demselben 24er-Pfad, Zahl rechts. Ein Strichbild,
 * zwei Ausgaben — die Karte stempelt es auf die Leinwand, das Panel setzt es als SVG.
 * Die Zahl steht als Text im Bild UND im Namen fuers Ohr: "8 Infanterie".
 */

export type MarkerTone = 'own' | 'ally' | 'enemy' | 'other'

export interface UnitMarkerProps {
  icon: IconName
  label: string
  count: number
  tone?: MarkerTone
}

export function UnitMarker({ icon, label, count, tone = 'own' }: UnitMarkerProps) {
  const name = `${count} ${label}`
  return (
    <svg
      className={`unit-marker unit-marker--${tone}`}
      width={30}
      height={18}
      viewBox="0 0 30 18"
      role="img"
      aria-label={name}
    >
      <title>{name}</title>
      <rect x={0.6} y={0.6} width={28.8} height={16.8} rx={1} className="unit-marker__box" />
      {/* Die Glyphe: 24er-Pfad auf 11 px, links im Kasten. */}
      <g transform="translate(3.5 3.5) scale(0.4583)">
        <path d={ICON_PATHS[icon]} className="unit-marker__glyph" />
      </g>
      <text x={27} y={12.5} textAnchor="end" className="unit-marker__count">
        {count}
      </text>
    </svg>
  )
}
