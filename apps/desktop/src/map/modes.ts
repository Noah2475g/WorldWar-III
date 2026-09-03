import { TOKENS, PLAYER_COLORS } from '../ui/tokens.ts'

/**
 * What the colours on the map mean (T-M10-03b, R-MAP-06).
 *
 * Four ways of looking at the same world. The mode decides only the fill of a
 * province — borders, armies and labels are the same in all of them, so switching
 * modes never costs the player their bearings.
 */

export const MAP_MODES = ['political', 'resources', 'morale', 'strength'] as const
export type MapMode = (typeof MAP_MODES)[number]

export const MAP_MODE_NAMES: Record<MapMode, string> = {
  political: 'Besitz',
  resources: 'Rohstoffe',
  morale: 'Moral',
  strength: 'Truppenstärke',
}

export interface ShadedProvince {
  id: string
  owner: string | null
  /**
   * Only known for own provinces; the fog of war is real (R-DIP-04). Explicitly
   * allowed to be undefined rather than merely absent: "unknown" is a value the map
   * has to be able to say, and shading it as zero would be a lie.
   */
  morale?: number | undefined
  deposits?: Partial<Record<string, number>> | undefined
  /**
   * Total strength of the visible armies standing here (R-MAP-06/R-MAP-07).
   *
   * Replaces the old `threat`, which no part of the game ever computed: the fourth mode
   * shaded all 237 provinces in the same grey and told the player nothing at all.
   */
  strength?: number | undefined
}

const PLAYER_FILL = Object.values(PLAYER_COLORS)

/**
 * Ab hier faerbt der Staerkemodus nicht mehr dunkler.
 *
 * Zwanzig Einheiten zu je 1000 Trefferpunkten sind der Stapel-Deckel des Originals —
 * was darueber steht, ist selten und muss nicht mehr unterschieden werden.
 */
export const STRENGTH_FULL = 20_000

/**
 * Die sichtbare Truppenstaerke je Provinz (T-M13-10).
 *
 * Bewusst hier und nicht im Kern: `view.armies` ist bereits nach Sichtbarkeit
 * gefiltert, eine Summe darueber ist Darstellung und keine Spiellogik (D18.2).
 */
export function strengthByProvince(
  armies: readonly { provinceId: string; strength: number }[],
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const army of armies) out[army.provinceId] = (out[army.provinceId] ?? 0) + army.strength
  return out
}

/** Stable colour per player, so a nation keeps its colour across sessions and saves. */
export function colorForPlayer(playerId: string): string {
  let hash = 0
  for (const char of playerId) hash = (hash * 31 + char.charCodeAt(0)) % 9973
  return PLAYER_FILL[hash % PLAYER_FILL.length]!
}

/**
 * Interpolates between two of the palette's colours.
 *
 * Kept to the palette rather than reaching for a rainbow: a gradient invented per
 * chart is how an interface stops looking like one interface (R-UI-02).
 */
function mix(from: string, to: string, t: number): string {
  const clamped = Math.min(1, Math.max(0, t))
  const channel = (hex: string, at: number): number => parseInt(hex.slice(at, at + 2), 16)
  const blend = (at: number): string =>
    Math.round(channel(from, at) + (channel(to, at) - channel(from, at)) * clamped)
      .toString(16)
      .padStart(2, '0')
  return `#${blend(1)}${blend(3)}${blend(5)}`
}

/**
 * The fill for one province in one mode.
 *
 * Unknown is a colour of its own everywhere: a province the player cannot see must not
 * be shaded as if its morale were zero, because that reads as information and is not.
 */
export function fillFor(province: ShadedProvince, mode: MapMode): string {
  switch (mode) {
    case 'political':
      return province.owner === null ? TOKENS.paperSunk : colorForPlayer(province.owner)

    case 'resources': {
      const total = Object.values(province.deposits ?? {}).reduce((sum, value) => (sum ?? 0) + (value ?? 0), 0) ?? 0
      if (province.deposits === undefined) return TOKENS.paperSunk
      // Ten thousand is a rich province; beyond that the shading stops distinguishing.
      return mix(TOKENS.paperSunk, TOKENS.good, total / 10_000)
    }

    case 'morale':
      if (province.morale === undefined) return TOKENS.paperSunk
      // Vermilion at nothing, green at full: the one place the signal colour is used
      // for a scale rather than an alarm, and it means the same thing — trouble.
      return mix(TOKENS.accent, TOKENS.good, province.morale / 100)

    case 'strength':
      if (province.strength === undefined) return TOKENS.paperSunk
      // Zwanzig Einheiten sind ein voller Stapel (Stapel-Deckel, D6); darueber
      // unterscheidet die Faerbung nichts mehr.
      return mix(TOKENS.paper, TOKENS.ink, province.strength / STRENGTH_FULL)
  }
}

/** What the legend has to say for a mode, so the colours are never a guessing game. */
export function legendFor(mode: MapMode): { label: string; color: string }[] {
  switch (mode) {
    case 'political':
      return [
        { label: 'neutral', color: TOKENS.paperSunk },
        { label: 'eigen', color: colorForPlayer('p1') },
      ]
    case 'resources':
      return [
        { label: 'arm', color: TOKENS.paperSunk },
        { label: 'reich', color: TOKENS.good },
      ]
    case 'morale':
      return [
        { label: 'aufständisch', color: TOKENS.accent },
        { label: 'treu', color: TOKENS.good },
      ]
    case 'strength':
      return [
        { label: 'leer', color: TOKENS.paper },
        { label: 'stark besetzt', color: TOKENS.ink },
      ]
  }
}
