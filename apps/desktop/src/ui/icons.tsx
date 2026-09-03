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
  | 'motorized'
  | 'armour'
  | 'heavyArmour'
  | 'artillery'
  | 'rocket'
  | 'aircraft'
  | 'bomber'
  | 'ship'
  | 'transport'
  | 'barracks'
  | 'factory'
  | 'harbour'
  | 'shipyard'
  | 'fortress'
  | 'railway'
  | 'battle'
  | 'capital'
  | 'warning'
  | 'food'
  | 'wood'
  | 'iron'
  | 'coal'
  | 'oil'
  | 'rare'
  | 'money'

export interface IconProps {
  name: IconName
  size?: number
  title?: string
}

/** Every icon is drawn in a 24×24 box, so they line up without per-icon nudging. */
const PATHS: Record<IconName, string> = {
  // Rectangle with a diagonal cross — infantry, as on any situation map.
  infantry: 'M3 7h18v10H3z M3 7l18 10 M21 7L3 17',
  // The same rectangle on wheels — motorised infantry.
  motorized: 'M3 5h18v9H3z M3 5l18 9 M21 5L3 14 M7 18.4a1.6 1.6 0 1 0 0 .01 M17 18.4a1.6 1.6 0 1 0 0 .01',
  // Oval — armour.
  armour: 'M3 12a9 5 0 1 0 18 0a9 5 0 1 0-18 0',
  // Oval with a bar through it — heavy armour.
  heavyArmour: 'M3 12a9 5 0 1 0 18 0a9 5 0 1 0-18 0 M6 12h12',
  // Chevron with a dot — artillery.
  artillery: 'M3 17h18 M6 17l6-9 6 9 M12 5.5a1.2 1.2 0 1 0 0 .01',
  // Chevron under a rising arrow — rocket artillery.
  rocket: 'M3 19h18 M6 19l6-7 6 7 M12 3v6 M9.8 5.2L12 3l2.2 2.2',
  // Wing shape — air.
  aircraft: 'M12 3l3 8h6l-6 4 2 6-5-4-5 4 2-6-6-4h6z',
  // Seen from above, two engines — the bomber, told apart from the fighter at a glance.
  bomber: 'M2 12h20 M12 4v16 M7 9.5v5 M17 9.5v5',
  // Hull and mast — sea.
  ship: 'M3 16h18l-2 4H5z M12 4v10 M12 6l6 3-6 2z',
  // Hull with a crate — the transport.
  transport: 'M3 16h18l-2 4H5z M7 8h10v6H7z M12 8v6',
  barracks: 'M4 20V9l8-5 8 5v11z M9 20v-6h6v6',
  factory: 'M3 20V11l5 3V11l5 3V6l8 5v9z M7 16h2 M13 16h2',
  harbour: 'M12 4v14 M8 8h8 M5 14a7 7 0 0 0 14 0 M12 2.5a1.4 1.4 0 1 0 0 .01',
  // A crane over a hull — the shipyard, which the set had no answer for at all.
  shipyard: 'M4 20h16 M6 20V5h9 M15 5l3 6 M8 12h6',
  fortress: 'M4 20V8h3V5h3v3h4V5h3v3h3v12z M10 20v-5h4v5',
  railway: 'M4 8h16 M4 16h16 M8 4v16 M16 4v16',
  // Crossed sabres — a battle.
  battle: 'M5 5l14 14 M19 5L5 19 M4 4l3 1 M20 4l-3 1',
  // Star in a circle — a capital.
  capital: 'M12 3l2.4 5.5 6 .5-4.5 4 1.4 5.9L12 15.8 6.7 18.9l1.4-5.9-4.5-4 6-.5z',
  // Triangle with a bar — a warning.
  warning: 'M12 4l9 16H3z M12 10v5 M12 17.4a.6.6 0 1 0 0 .01',
  // The seven resources. Drawn as things, not as letters: a row of symbols is only
  // faster to read than a row of words if it is not itself a word.
  food: 'M12 20v-9 M12 11c-3 0-4.5-1.5-4.5-4.5C10.5 6.5 12 8 12 11z M12 11c3 0 4.5-1.5 4.5-4.5C13.5 6.5 12 8 12 11z',
  wood: 'M12 3l4.5 6H14l4 6H6l4-6H7.5z M12 15v5',
  iron: 'M4 17h16l-2.5-6h-11z M7 11l1.5-4h7L17 11',
  coal: 'M5 15l1.5-4L11 8l5 1.5 3 4-2 5H7z',
  oil: 'M12 4c3.5 5 5.5 7.5 5.5 10.5a5.5 5.5 0 0 1-11 0C6.5 11.5 8.5 9 12 4z',
  rare: 'M12 3l6 5.5-6 12.5-6-12.5z M6 8.5h12',
  money: 'M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16 M9.5 9.5h5 M9.5 14.5h5 M12 7v10',
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

/**
 * Which icon stands for which unit, so the map and the panels agree.
 *
 * The keys are the keys of `data/rules/default/units.json` — exactly those, no more.
 * The first version of this table answered to "cavalry" and "submarine", which the
 * rules never had, and had nothing to say for "motorized" or "heavy_tank", which they
 * do: half the army drew no symbol at all, and a test that only compared the table
 * against itself called that complete.
 */
export const UNIT_ICONS: Record<string, IconName> = {
  infantry: 'infantry',
  motorized: 'motorized',
  tank: 'armour',
  heavy_tank: 'heavyArmour',
  artillery: 'artillery',
  rocket_artillery: 'rocket',
  fighter: 'aircraft',
  bomber: 'bomber',
  destroyer: 'ship',
  transport: 'transport',
}

export const BUILDING_ICONS: Record<string, IconName> = {
  barracks: 'barracks',
  fortress: 'fortress',
  factory: 'factory',
  harbour: 'harbour',
  shipyard: 'shipyard',
  airfield: 'aircraft',
  railway: 'railway',
}

/** And one per resource, for the header bar and the deposits row. */
export const RESOURCE_ICONS: Record<string, IconName> = {
  food: 'food',
  wood: 'wood',
  iron: 'iron',
  coal: 'coal',
  oil: 'oil',
  rare: 'rare',
  money: 'money',
}

/**
 * The raw drawings, for anything that is not React.
 *
 * The map draws the same symbols onto a canvas through Path2D — one set of shapes for
 * the whole game, so a unit looks the same in the panel and on the map because it is
 * literally the same path (R-UI-10).
 */
export const ICON_PATHS: Readonly<Record<IconName, string>> = PATHS

/** Every icon name, for the test that keeps the set complete. */
export const ICON_NAMES = Object.keys(PATHS) as IconName[]
