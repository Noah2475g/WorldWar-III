/**
 * The icon set (T-M11-01, R-UI-04/R-ASSET-01).
 *
 * Drawn here as inline SVG rather than shipped as files, and drawn from the vocabulary
 * of military situation maps: a rectangle with a diagonal cross is infantry, an oval is
 * armour, a chevron is artillery. That vocabulary is a public convention, not a work —
 * which is exactly why it can be used at all (R-ASSET-01: nothing taken from anyone).
 *
 * Inline because these are shapes, not pictures: a dozen paths cost less than a dozen
 * requests, they take their colour from the surrounding text, and they scale with the
 * font setting without a second asset.
 */

export type IconName =
  | 'infantry'
  | 'armour'
  | 'artillery'
  | 'aircraft'
  | 'ship'
  | 'barracks'
  | 'factory'
  | 'harbour'
  | 'fortress'
  | 'railway'
  | 'battle'
  | 'capital'
  | 'warning'

export interface IconProps {
  name: IconName
  size?: number
  title?: string
}

/** Every icon is drawn in a 24×24 box, so they line up without per-icon nudging. */
const PATHS: Record<IconName, string> = {
  // Rectangle with a diagonal cross — infantry, as on any situation map.
  infantry: 'M3 7h18v10H3z M3 7l18 10 M21 7L3 17',
  // Oval — armour.
  armour: 'M3 12a9 5 0 1 0 18 0a9 5 0 1 0-18 0',
  // Chevron with a dot — artillery.
  artillery: 'M3 17h18 M6 17l6-9 6 9 M12 5.5a1.2 1.2 0 1 0 0 .01',
  // Wing shape — air.
  aircraft: 'M12 3l3 8h6l-6 4 2 6-5-4-5 4 2-6-6-4h6z',
  // Hull and mast — sea.
  ship: 'M3 16h18l-2 4H5z M12 4v10 M12 6l6 3-6 2z',
  barracks: 'M4 20V9l8-5 8 5v11z M9 20v-6h6v6',
  factory: 'M3 20V11l5 3V11l5 3V6l8 5v9z M7 16h2 M13 16h2',
  harbour: 'M12 4v14 M8 8h8 M5 14a7 7 0 0 0 14 0 M12 2.5a1.4 1.4 0 1 0 0 .01',
  fortress: 'M4 20V8h3V5h3v3h4V5h3v3h3v12z M10 20v-5h4v5',
  railway: 'M4 8h16 M4 16h16 M8 4v16 M16 4v16',
  // Crossed sabres — a battle.
  battle: 'M5 5l14 14 M19 5L5 19 M4 4l3 1 M20 4l-3 1',
  // Star in a circle — a capital.
  capital: 'M12 3l2.4 5.5 6 .5-4.5 4 1.4 5.9L12 15.8 6.7 18.9l1.4-5.9-4.5-4 6-.5z',
  // Triangle with a bar — a warning.
  warning: 'M12 4l9 16H3z M12 10v5 M12 17.4a.6.6 0 1 0 0 .01',
}

export function Icon({ name, size = 16, title }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title && <title>{title}</title>}
      <path d={PATHS[name]} />
    </svg>
  )
}

/** Which icon stands for which unit, so the map and the panels agree. */
export const UNIT_ICONS: Record<string, IconName> = {
  infantry: 'infantry',
  cavalry: 'armour',
  tank: 'armour',
  artillery: 'artillery',
  aircraft: 'aircraft',
  bomber: 'aircraft',
  fighter: 'aircraft',
  ship: 'ship',
  transport: 'ship',
  submarine: 'ship',
}

export const BUILDING_ICONS: Record<string, IconName> = {
  barracks: 'barracks',
  factory: 'factory',
  harbour: 'harbour',
  fortress: 'fortress',
  railway: 'railway',
  airfield: 'aircraft',
  mine: 'factory',
}

/** Every icon name, for the test that keeps the set complete. */
export const ICON_NAMES = Object.keys(PATHS) as IconName[]
