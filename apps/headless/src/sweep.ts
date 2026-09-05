import { type GameConfig, type MapData, type Rules } from '@worldwar/core'
import { advanceTicks } from '@worldwar/ai'
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
  /** Endbestaende aller Maechte zusammen — die Wirtschaftskurve in einer Zahl. */
  stockpile: number
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

  // Eine Schleife, dieselbe wie in der Anwendung (T-M14-04). Vorher stand hier ein
  // `runAi` je Spieltag, dessen Befehlspaket auf alle 24 Ticks angewandt wurde — das
  // liess bei sechs Maechten fuenf nie denken, weil `shouldThinkThisTick` die Denkzeit
  // ueber `tick % aiCount` verteilt und `tick` hier stets ein Vielfaches von 24 war.
  // Jede Balancezahl aus dieser Datei beschrieb bis dahin ein anderes Spiel.
  const gespielt = advanceTicks(state, days * rules.constants.ticksPerDay, ctx)
  state = gespielt.state

  const owned = new Map<string, number>()
  for (const province of Object.values(state.provinces)) {
    if (province.owner) owned.set(province.owner, (owned.get(province.owner) ?? 0) + 1)
  }
  const total = [...owned.values()].reduce((a, b) => a + b, 0) || 1
  const leader = Math.max(0, ...owned.values())

  // Endbestaende, nicht Produktion. Die alte Beschriftung ('Total resources produced')
  // versprach etwas anderes, als die Zahl misst — eine Falschaussage mit Zahl daran.
  const stockpile = Object.values(state.players).reduce(
    (sum, player) => sum + Object.values(player.resources).reduce((a, b) => a + (b ?? 0), 0),
    0,
  )

  // Wie viel tatsaechlich geschah. Gezaehlt wird aus dem Ereignisstrom des Laufs, nicht
  // aus state.eventLog: das ist ein Ringpuffer von 500 Eintraegen und deckt bei rund
  // 12.300 Ereignissen je Partie die letzten paar Spieltage ab. Der Bericht meldete
  // deshalb 3 Eroberungen, wo 49 stattgefunden hatten (Faktor 16), und die eingebaute
  // Warnung 'keine Eroberung heisst, der Lauf hat nichts gemessen' konnte nie ausloesen.
  const captures = gespielt.events.filter((event) => event.type === 'PROVINCE_CAPTURED').length

  return {
    leaderShare: leader / total,
    captures,
    survivors: owned.size,
    stockpile: Math.round(stockpile / 1000),
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
    stockpile: Math.round(mean((r) => r.stockpile)),
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

/** The unchanged rules, played out. Everything else is measured against this. */
export function baselineOf(options: SweepOptions): TrialResult {
  const { map, rules, players, days, seeds } = options
  return average(seeds.map((seed) => playOut(map, rules, players, days, seed, options.nations)))
}

/**
 * Hands the event loop back between games.
 *
 * Not a nicety: a simulation is a synchronous block, and a process that stays inside
 * one for minutes answers nothing while it does. The test runner takes that for a hung
 * worker and fails the run — with every measurement in it correct. One turn of the
 * loop per game is the whole fix.
 */
const breathe = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

async function playSeries(options: SweepOptions, rules: Rules): Promise<TrialResult> {
  const results: TrialResult[] = []
  for (const seed of options.seeds) {
    results.push(playOut(options.map, rules, options.players, options.days, seed, options.nations))
    await breathe()
  }
  return average(results)
}

function effectOf(
  constant: string,
  baseline: TrialResult,
  lower: TrialResult,
  upper: TrialResult,
): ConstantEffect {
  const swing = Math.max(
    Math.abs(lower.leaderShare - baseline.leaderShare),
    Math.abs(upper.leaderShare - baseline.leaderShare),
  )

  return {
    constant,
    baseline,
    lower,
    upper,
    swing: Math.round(swing * 1000) / 1000,
    loadBearing: swing >= SWING_THRESHOLD,
  }
}

/**
 * One constant, moved both ways and played out.
 *
 * Separate from `sweep` so a caller can measure one constant at a time. The slow test
 * uses that: fourteen constants in one call is a quarter of an hour in which nothing
 * is reported, and a run that says nothing for a quarter of an hour cannot be told
 * apart from a run that has hung.
 */
export function measure(options: SweepOptions, constant: string, baseline: TrialResult): ConstantEffect {
  const spread = options.spread ?? 0.25
  const { map, rules, players, days, seeds } = options

  const play = (factor: number): TrialResult =>
    average(
      seeds.map((seed) =>
        playOut(map, withConstant(rules, constant, factor), players, days, seed, options.nations),
      ),
    )

  return effectOf(constant, baseline, play(1 - spread), play(1 + spread))
}

/** The same measurement, but breathing between games. Use this for long runs. */
export async function measureSlowly(
  options: SweepOptions,
  constant: string,
  baseline: TrialResult,
): Promise<ConstantEffect> {
  const spread = options.spread ?? 0.25
  const lower = await playSeries(options, withConstant(options.rules, constant, 1 - spread))
  const upper = await playSeries(options, withConstant(options.rules, constant, 1 + spread))
  return effectOf(constant, baseline, lower, upper)
}

/** The baseline, breathing between games. */
export function baselineSlowly(options: SweepOptions): Promise<TrialResult> {
  return playSeries(options, options.rules)
}

export function sweep(options: SweepOptions, constants?: readonly string[]): ConstantEffect[] {
  const baseline = baselineOf(options)
  const names = constants ?? sweepableConstants(options.rules)

  return names
    .map((constant) => measure(options, constant, baseline))
    .sort((a, b) => b.swing - a.swing)
}
