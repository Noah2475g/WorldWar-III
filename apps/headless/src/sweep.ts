import { runTicks, type GameConfig, type MapData, type Rules } from '@worldwar/core'
import { runAi, storeMemories } from '@worldwar/ai'
import { createInitialState } from '@worldwar/core'

/**
 * Measuring the balance instead of guessing it (T-M12-00, R-AI-06, design D17).
 *
 * Every constant in the rules is a claim about how the game feels, and most of them
 * were estimated. This varies each one on its own and plays the game out, so the
 * question "does this number matter" has an answer with a figure attached.
 *
 * What it looks for is not the best value — it is which constants are *load-bearing*.
 * A number whose ±25 % swing changes nothing can be left alone forever; one that flips
 * who wins is a number that has to be right, and worth the time to get right.
 */

export interface SweepOptions {
  map: MapData
  rules: Rules
  /** Powers in each trial. Fewer runs faster; more makes the outcome less noisy. */
  players: number
  /**
   * Which powers, by name. Neighbours, or the sweep measures nothing: between the
   * United States and Russia nothing happens in forty days, every variant comes out
   * identical, and the tool reports that no constant matters — which would be a
   * finding about the map, read as a finding about the rules.
   */
  nations?: readonly string[]
  /** Game days per trial. */
  days: number
  /** Seeds per variant — the same variant is played several times to see past luck. */
  seeds: number[]
  /** How far each constant is moved, as a fraction. */
  spread?: number
}

export interface TrialResult {
  /** Provinces held by the strongest power, as a share of all owned provinces. */
  leaderShare: number
  /** How many provinces changed hands. Zero means the trial measured nothing. */
  captures: number
  /** How many powers were still alive at the end. */
  survivors: number
  /** Total resources produced across all powers — the economy curve in one number. */
  economy: number
  days: number
}

export interface ConstantEffect {
  constant: string
  baseline: TrialResult
  lower: TrialResult
  upper: TrialResult
  /** The largest relative change in leader share across the two variants. */
  swing: number
  /** True when the swing crosses the threshold: this number decides games. */
  loadBearing: boolean
}

/** Above this relative change, a constant is considered to decide the outcome. */
export const SWING_THRESHOLD = 0.15

function configFor(
  map: MapData,
  players: number,
  seed: number,
  nations?: readonly string[],
): GameConfig {
  const chosen = nations
    ? map.startPositions.filter((start) => nations.includes(start.nation))
    : map.startPositions.slice(0, players)

  return {
    seed,
    mapId: map.id,
    rulesId: 'default',
    players: chosen.slice(0, players).map((start, index) => ({
      name: start.nation,
      kind: 'ai' as const,
      nation: start.nation,
      color: `#${(0x9f_b2_be + index * 0x10_10_10).toString(16).slice(0, 6)}`,
      difficulty: 'normal' as const,
    })),
    victory: { condition: 'points', pointsShareToWin: 700, dayLimit: null },
  }
}

/** Plays one game to the end of its day budget and reports what it looked like. */
export function playOut(
  map: MapData,
  rules: Rules,
  players: number,
  days: number,
  seed: number,
  nations?: readonly string[],
): TrialResult {
  const ctx = { map, rules }
  let state = createInitialState(configFor(map, players, seed, nations), ctx)

  // Everybody at war with everybody. A world at peace measures nothing: without
  // fighting, none of the constants under test ever comes into play.
  const ids = state.playerOrder
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const key = `${ids[i]}|${ids[j]}`
      if (state.diplomacy.relations[key]) state.diplomacy.relations[key]!.state = 'war'
    }
  }

  for (let day = 0; day < days; day++) {
    const { commands, memories } = runAi(state, ctx)
    state = runTicks(state, rules.constants.ticksPerDay, ctx, () => commands).state
    storeMemories(state, memories)
    if (state.victory.winner !== null) break
  }

  const owned = new Map<string, number>()
  for (const province of Object.values(state.provinces)) {
    if (province.owner) owned.set(province.owner, (owned.get(province.owner) ?? 0) + 1)
  }
  const total = [...owned.values()].reduce((a, b) => a + b, 0) || 1
  const leader = Math.max(0, ...owned.values())

  const economy = Object.values(state.players).reduce(
    (sum, player) => sum + Object.values(player.resources).reduce((a, b) => a + (b ?? 0), 0),
    0,
  )

  // How much actually happened. A trial with no captures is a trial that measured
  // nothing, however clean its numbers look.
  const captures = state.eventLog.filter((event) => event.type === 'PROVINCE_CAPTURED').length

  return {
    leaderShare: leader / total,
    captures,
    survivors: owned.size,
    economy: Math.round(economy / 1000),
    days: Math.floor(state.tick / rules.constants.ticksPerDay),
  }
}

/** The average of several seeds, so one lucky game does not become a finding. */
function average(results: TrialResult[]): TrialResult {
  const mean = (pick: (r: TrialResult) => number): number =>
    results.reduce((sum, r) => sum + pick(r), 0) / Math.max(1, results.length)

  return {
    leaderShare: mean((r) => r.leaderShare),
    captures: Math.round(mean((r) => r.captures)),
    survivors: mean((r) => r.survivors),
    economy: Math.round(mean((r) => r.economy)),
    days: Math.round(mean((r) => r.days)),
  }
}

/** Rules with one numeric constant moved by a factor. */
export function withConstant(rules: Rules, name: string, factor: number): Rules {
  const constants = rules.constants as unknown as Record<string, number>
  const value = constants[name]
  if (typeof value !== 'number') return rules

  return {
    ...rules,
    constants: { ...rules.constants, [name]: Math.max(1, Math.round(value * factor)) },
  } as Rules
}

/** Which constants are numbers worth varying. */
export function sweepableConstants(rules: Rules): string[] {
  return Object.entries(rules.constants as unknown as Record<string, unknown>)
    .filter(([key, value]) => typeof value === 'number' && !key.startsWith('_'))
    .map(([key]) => key)
    .sort((a, b) => a.localeCompare(b, 'en'))
}

export function sweep(options: SweepOptions, constants?: readonly string[]): ConstantEffect[] {
  const spread = options.spread ?? 0.25
  const { map, rules, players, days, seeds } = options

  const baseline = average(seeds.map((seed) => playOut(map, rules, players, days, seed, options.nations)))

  const names = constants ?? sweepableConstants(rules)
  const effects: ConstantEffect[] = []

  for (const constant of names) {
    const lower = average(
      seeds.map((seed) =>
        playOut(map, withConstant(rules, constant, 1 - spread), players, days, seed, options.nations),
      ),
    )
    const upper = average(
      seeds.map((seed) =>
        playOut(map, withConstant(rules, constant, 1 + spread), players, days, seed, options.nations),
      ),
    )

    const swing = Math.max(
      Math.abs(lower.leaderShare - baseline.leaderShare),
      Math.abs(upper.leaderShare - baseline.leaderShare),
    )

    effects.push({
      constant,
      baseline,
      lower,
      upper,
      swing: Math.round(swing * 1000) / 1000,
      loadBearing: swing >= SWING_THRESHOLD,
    })
  }

  return effects.sort((a, b) => b.swing - a.swing)
}
