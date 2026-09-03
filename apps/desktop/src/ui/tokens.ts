/**
 * The approved look, as values (T-M10-01b, R-UI-02).
 *
 * Direction A "Lagekarte", approved by Noah on 2026-09-03 — a light linen map, ink for
 * text, muted national colours, and vermilion reserved for exactly one thing: combat
 * and alarm. Reserving it is what makes it work; a signal colour used for decoration
 * stops being a signal.
 *
 * No component may write a colour of its own (enforced by a lint rule). Every value
 * here is under a contrast test that fails if a change drops a pair below WCAG AA.
 */

export const TOKENS = {
  /** Map ground, linen. */
  ground: '#E4E0D2',
  /** Panels and bars. */
  paper: '#F2EEE3',
  /** Sunk surfaces: table rows, meter tracks. */
  paperSunk: '#DAD5C6',
  /** Text. */
  ink: '#1F2420',
  /** Secondary text, units, captions. */
  inkSoft: '#54594F',
  /** Province borders, panel rules. */
  line: '#8C8676',
  /** Sea. */
  water: '#BFC9C6',
  /** Combat and alarm. Nothing else. */
  accent: '#B3341E',
  /** Completed, at peace, in surplus. */
  good: '#33613F',
  /** Shortage, deadline running. */
  warn: '#7A5410',
  /** Text on a filled accent or ink surface. */
  onDark: '#F7F4EC',
  /** Map labels sitting on a player-coloured province. */
  onPlayer: '#161A15',
} as const

export type TokenName = keyof typeof TOKENS

/**
 * Province fills. Chosen light enough that map labels stay readable on top of them,
 * and far enough apart that two nations are never mistaken for one another.
 */
export const PLAYER_COLORS = {
  petrol: '#9FB2BE',
  clay: '#C4A99C',
  moss: '#B7BE9F',
  heather: '#B5A6C0',
  sand: '#D3C49B',
  mint: '#9CC8B4',
} as const

export interface ContrastPair {
  foreground: TokenName
  background: TokenName
  /** Where this combination appears — named so a failure says what breaks. */
  use: string
  /** True for text at 24 px or above, where WCAG allows 3:1. */
  large?: boolean
}

/** Every combination the interface actually produces. */
export const CONTRAST_PAIRS: readonly ContrastPair[] = [
  { foreground: 'ink', background: 'paper', use: 'Panels, Fließtext' },
  { foreground: 'ink', background: 'ground', use: 'Leisten, Kartenschrift' },
  { foreground: 'ink', background: 'paperSunk', use: 'Tabellenzeilen' },
  { foreground: 'inkSoft', background: 'paper', use: 'Einheiten, Nebentext' },
  { foreground: 'inkSoft', background: 'ground', use: 'Kartenlegende' },
  { foreground: 'accent', background: 'paper', use: 'Kampf, Kriegserklärung' },
  { foreground: 'accent', background: 'ground', use: 'Alarm in der Kopfleiste' },
  { foreground: 'good', background: 'paper', use: 'fertiggestellt, Frieden' },
  { foreground: 'warn', background: 'paper', use: 'Mangel, Frist' },
  { foreground: 'onDark', background: 'ink', use: 'Hauptknopf' },
  { foreground: 'onDark', background: 'accent', use: 'Alarmknopf' },
  { foreground: 'ink', background: 'water', use: 'Beschriftung auf See' },
]

export const SPACING = { xs: 2, sm: 4, md: 8, lg: 12, xl: 20, xxl: 32 } as const

export const TYPE = {
  map: '"IBM Plex Sans Condensed", "IBM Plex Sans", system-ui, sans-serif',
  ui: '"IBM Plex Sans", system-ui, sans-serif',
  num: '"IBM Plex Mono", ui-monospace, monospace',
  sizes: { xs: 11, sm: 12, base: 14, md: 16, lg: 20, xl: 26 },
} as const

const HEX = /^#[0-9a-fA-F]{6}$/

/** WCAG relative luminance. Throws on anything that is not a six-digit hex colour. */
export function relativeLuminance(color: string): number {
  if (!HEX.test(color)) {
    throw new RangeError(`Kein sechsstelliger Hex-Farbwert: "${color}"`)
  }

  const channel = (offset: number): number => {
    const value = parseInt(color.slice(offset, offset + 2), 16) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }

  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

/** WCAG contrast ratio, 1:1 to 21:1. Symmetric in its arguments. */
export function contrastRatio(a: string, b: string): number {
  const first = relativeLuminance(a)
  const second = relativeLuminance(b)
  const lighter = Math.max(first, second)
  const darker = Math.min(first, second)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Perceived colour difference (CIE76 ΔE in Lab).
 *
 * Contrast ratio is the wrong instrument for telling two province fills apart: it only
 * knows lightness, so a blue-grey and a red-brown of equal brightness come out as
 * "identical" when a person sees two obviously different countries. ΔE answers the
 * question actually being asked — can you tell these two apart at a glance?
 */
export function deltaE(a: string, b: string): number {
  const [l1, a1, b1] = toLab(a)
  const [l2, a2, b2] = toLab(b)
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2)
}

/** sRGB hex to CIE Lab, by way of XYZ with the D65 white point. */
function toLab(color: string): [number, number, number] {
  if (!HEX.test(color)) throw new RangeError(`Kein sechsstelliger Hex-Farbwert: "${color}"`)

  const linear = (offset: number): number => {
    const value = parseInt(color.slice(offset, offset + 2), 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }
  const r = linear(1)
  const g = linear(3)
  const bl = linear(5)

  const x = (r * 0.4124564 + g * 0.3575761 + bl * 0.1804375) / 0.95047
  const y = r * 0.2126729 + g * 0.7151522 + bl * 0.072175
  const z = (r * 0.0193339 + g * 0.119192 + bl * 0.9503041) / 1.08883

  const f = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const fx = f(x)
  const fy = f(y)
  const fz = f(z)

  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}
