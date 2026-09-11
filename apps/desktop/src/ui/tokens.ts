/**
 * The approved look, as values (T-M10-01b, T-M29-01, R-UI-02).
 *
 * Direction A "Kriegsrat", chosen by Noah on 2026-09-10 (KRIEGSRAT.md D27.1) — a dark
 * map table, amber for time, orders and selection, phosphor green for what is ours,
 * vermilion reserved for exactly one thing: the enemy, combat and alarm. Reserving it
 * is what makes it work; a signal colour used for decoration stops being a signal.
 *
 * Token names survived the change from the light "Lagekarte" so no caller had to move;
 * only their values did. Three names are new because three roles are new: `onWarn`
 * (text on an amber surface), `building` (building markers and resource glyphs) and
 * `ally` (an allied power on the map and in the chart).
 *
 * No component may write a colour of its own (enforced by a lint rule), and `app.css`
 * must mirror every value here (enforced by test/guards/css-mirrors-tokens.test.ts).
 * Every value is under a contrast test that fails if a change drops a pair below WCAG AA.
 */

export const TOKENS = {
  /** Map ground, the dark table. */
  ground: '#0D1117',
  /** Panels and bars. */
  paper: '#161C25',
  /** Sunk surfaces: table rows, meter tracks, empty building slots. */
  paperSunk: '#1E2632',
  /** Text. */
  ink: '#E6E1D3',
  /** Secondary text, units, captions, the clock in the footer. */
  inkSoft: '#9AA0A8',
  /**
   * Panel rules and meter outlines. D27.1 proposed #2F3944; at 1.46:1 against `paper`
   * an empty meter track would have been invisible, so the value is the nearest tone
   * that clears the 3:1 non-text threshold. The contrast test has the last word.
   */
  line: '#5C6A78',
  /** Sea, one shade below the ground. */
  water: '#0A0E14',
  /**
   * Enemy, combat and alarm. Nothing else. D27.1 proposed #E2503A, which reads at
   * 4.44:1 on `paper`; nudged to the first value that clears AA text.
   */
  accent: '#E8583F',
  /** Ours: own armies and provinces, surplus, completed. */
  good: '#7EC57E',
  /** Amber: time, orders, selection, the build queue, a deadline running. */
  warn: '#E0A220',
  /** Light text and halos on a filled dark surface (marker rims, the map ground). */
  onDark: '#F7F4EC',
  /** Text on an amber (`warn`) or vermilion (`accent`) surface — filled buttons. */
  onWarn: '#1A1200',
  /** Map labels sitting on a player-coloured province (dark fills, light lettering). */
  onPlayer: '#E6E1D3',
  /** Building markers on the map and resource glyphs in the bar. */
  building: '#C9B98A',
  /** An allied power: marker rims, the ally line in the power chart. */
  ally: '#6FA8DC',
} as const

export type TokenName = keyof typeof TOKENS

/**
 * Province fills — one per power in a game.
 *
 * Eleven, not six: with six, a game of eight nations gave two of them the same colour,
 * and two nations that look alike on the map are worse than one that looks wrong.
 * Since T-M29-01 they are dark, muted table colours, each deep enough that the light
 * map lettering (`onPlayer`) stays readable on it. Five of D27.1's eleven candidates
 * survived the ΔE > 10 pairwise check; the rest were found by a greedy search over
 * muted dark tones for maximum perceived distance from everything already chosen,
 * the neutral fill (`paperSunk`) and the border (`line`).
 */
export const PLAYER_COLORS = {
  moss: '#2C4A3A',
  slate: '#3A3A52',
  umber: '#4C3A2A',
  petrol: '#2F4A55',
  wine: '#4A2E3A',
  heather: '#704470',
  olive: '#606034',
  plum: '#381C48',
  taupe: '#6C5C60',
  fern: '#346034',
  pine: '#20281C',
  // Dreizehn weitere seit T-M28-14 (Noahs Entscheid vom 2026-09-11: mehr Farben statt
  // weniger Maechte). Die Weltkarte hat 24 Startaufstellungen, und der Startdialog
  // erlaubt so viele Gegner, wie sie hergibt — mit elf Farben teilten sich ab der
  // zwoelften Macht zwei Laender eine Fuellung. Gesucht mit derselben Greedy-Methode wie
  // in T-M29-01, unter denselben vier Bedingungen: Kontrast gegen `onPlayer` ueber 4,5,
  // ΔE ueber 10 gegen jede andere Spielerfarbe, gegen die Grenze, die Neutralfuellung
  // und die Auswahlfarbe — und Buntheit hoechstens so hoch wie die bunteste bestehende,
  // damit der gedeckte Kriegsrat-Ton erhalten bleibt. Kleinster Abstand im Satz: 13,3.
  midnight: '#141428',
  oxblood: '#401414',
  bracken: '#303C14',
  thistle: '#645C7C',
  verdigris: '#406C68',
  peat: '#241414',
  brick: '#704444',
  walnut: '#745C48',
  sage: '#5C6450',
  mulberry: '#401430',
  indigo: '#483C68',
  mauve: '#785064',
  juniper: '#144020',
} as const
/**
 * Die Farben des Beziehungsmodus (T-M26-03, T-M29-01, R-MAP-06, D25.5, D27.1).
 *
 * Fuenf Zustaende aus eigener Sicht als FLAECHEN — dunkel genug fuer die helle
 * Kartenschrift (`onPlayer`), alle fuenf paarweise ueber der ΔE-Schwelle der
 * Spielerfarben. D27.1 nennt fuer Fuellungen ausdruecklich die abgedunkelten
 * Verwandten der Signalfarben (eigen `#3C6E44`, Feind `#7A2E22`): `good` und `accent`
 * selbst wuerden als Flaeche einer ganzen Weltgegend die Schrift unlesbar machen und
 * als Signal verbraucht sein. Die Zuordnung der Rollen bleibt: eigen = Gruen,
 * Buendnis = Blau, Krieg = Zinnober — nur als Tischfarbe statt als Leuchtfarbe.
 */
export const RELATION_COLORS = {
  /** Eigenes Land: das dunkle Phosphorgruen des Tisches. */
  self: '#3C6E44',
  /** Verbuendet: gedecktes Blau, Verwandter von `ally`. */
  ally: '#2A4A66',
  /** Frieden: die vertiefte Tischflaeche, ruhig wie die Karte selbst. */
  peace: '#1E2632',
  /** Krieg: dunkler Zinnober-Ton — Verwandter des Alarms, nicht der Alarm. */
  war: '#7A2E22',
  /** Unbekannt: Nebelgrau. Keine Auskunft ist eine eigene Farbe, keine Behauptung. */
  unknown: '#3A3D40',
} as const

export interface ContrastPair {
  foreground: TokenName
  background: TokenName
  /** Where this combination appears — named so a failure says what breaks. */
  use: string
  /**
   * True for text at 24 px or above, where WCAG allows 3:1 — und fuer alles, was gar
   * keine Schrift ist: Balken, Umrisse, Schattenrisse (WCAG 1.4.11, dieselbe Schwelle).
   */
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
  { foreground: 'good', background: 'paper', use: 'fertiggestellt, Überschuss' },
  { foreground: 'warn', background: 'paper', use: 'Uhr, Frist, Auswahl' },
  { foreground: 'warn', background: 'ground', use: 'Kopfzeilen der Panels' },
  { foreground: 'onWarn', background: 'warn', use: 'Hauptknopf (Bernstein)' },
  { foreground: 'onWarn', background: 'accent', use: 'Alarmknopf' },
  { foreground: 'onDark', background: 'ground', use: 'Markerrand, Halo auf der Karte' },
  { foreground: 'building', background: 'ground', use: 'Gebäudemarker auf der Karte' },
  { foreground: 'building', background: 'paper', use: 'Rohstoffsymbole in der Leiste' },
  { foreground: 'ally', background: 'paper', use: 'Verbündeter im Machtverlauf' },
  { foreground: 'ink', background: 'water', use: 'Beschriftung auf See' },
  // Der Schattenriss auf der vertieften Plakette (T-M33-01, D33.2). Er sitzt auf
  // `paperSunk` und nicht auf `paper`, und genau dieses Paar stand bisher in keiner
  // Zeile: gemessen 7,38 (good), 6,03 (ally) und 4,28 (accent) — alle drei ueber der
  // 3:1-Schwelle fuer Nicht-Text, `accent` unter 4,5 und damit fuer Schrift zu wenig.
  // Die zwei Töne der Rohstoffleiste (T-M36-03, D36.2). Sie sitzen auf `paperSunk`,
  // dem Grund der Leiste: der gedämpfte Bestand („wer läuft, ist ruhig") bei 5,78 und
  // der Bernstein der knappen Zelle samt ihrer Reichweite bei 6,79 — beides Schrift,
  // also gegen 4,5 und nicht gegen 3.
  { foreground: 'inkSoft', background: 'paperSunk', use: 'gedämpfter Bestand in der Rohstoffleiste' },
  { foreground: 'warn', background: 'paperSunk', use: 'knapper Rohstoff und seine Reichweite' },
  { foreground: 'good', background: 'paperSunk', use: 'eigener Schattenriss im Plättchen', large: true },
  { foreground: 'ally', background: 'paperSunk', use: 'verbündeter Schattenriss', large: true },
  { foreground: 'accent', background: 'paperSunk', use: 'feindlicher Schattenriss', large: true },
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
