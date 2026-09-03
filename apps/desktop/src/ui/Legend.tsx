import { legendFor, MAP_MODE_NAMES, type MapMode } from '../map/modes.ts'

/**
 * What the colours on the map mean (T-M13-08, R-UI-12).
 *
 * `legendFor` has been in `map/modes.ts` since M10 and nothing ever called it, so the
 * map had four colour schemes and no way to find out what any of them meant. The
 * player was left to infer that green is loyal and vermilion is in revolt — which
 * happens to be right, and was still a guess.
 *
 * Sits on the map rather than in the side panel: a key belongs to its map.
 */

export function Legend({ mode }: { mode: MapMode }) {
  const entries = legendFor(mode)

  return (
    <div className="legend" aria-label={`Legende: ${MAP_MODE_NAMES[mode]}`}>
      <span className="legend__title">{MAP_MODE_NAMES[mode]}</span>
      <ul className="legend__items">
        {entries.map((entry) => (
          <li key={entry.label} className="legend__item">
            {/* Die Farbe kommt aus `legendFor`, also aus denselben Token wie die Karte
                selbst — hier steht kein zweiter Farbwert, der auseinanderlaufen koennte. */}
            <span className="legend__swatch" style={{ background: entry.color }} aria-hidden="true" />
            {entry.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
