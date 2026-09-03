import { runAi, storeMemories } from '@worldwar/ai'
import {
  createInitialState,
  runTicks,
  scoreOf,
  type Difficulty,
  type GameConfig,
  type MapData,
  type PlayerId,
  type Rules,
} from '@worldwar/core'

/**
 * AI versus AI (R-AI-06, T-M7-05).
 *
 * The only honest way to answer "is 'hard' actually harder?" — an opinion about a
 * utility function is not evidence. Matches are seeded, so a result can be reproduced
 * and investigated rather than argued about.
 */

export interface MatchOptions {
  map: MapData
  rules: Rules
  seed: number
  difficulties: [Difficulty, Difficulty]
  /** Game days before the match is decided on points. */
  days?: number
}

export interface MatchResult {
  winner: PlayerId | null
  scores: Record<PlayerId, number>
  ticks: number
  reason: 'victory' | 'timeLimit'
}

export function playMatch(options: MatchOptions): MatchResult {
  const days = options.days ?? 60
  const nations = options.map.startPositions.slice(0, 2)

  const config: GameConfig = {
    seed: options.seed,
    mapId: options.map.id,
    rulesId: options.rules.id,
    players: [
      {
        name: `KI-${options.difficulties[0]}`,
        kind: 'ai',
        nation: nations[0]!.nation,
        color: '#0f62bc',
        difficulty: options.difficulties[0],
      },
      {
        name: `KI-${options.difficulties[1]}`,
        kind: 'ai',
        nation: nations[1]!.nation,
        color: '#b03a2e',
        difficulty: options.difficulties[1],
      },
    ],
    victory: { condition: 'points', pointsShareToWin: 750, dayLimit: days },
  }

  let state = createInitialState(config, { map: options.map, rules: options.rules })
  // They are here to fight; a peace treaty at tick zero would make the match pointless.
  state.diplomacy.relations['p1|p2']!.state = 'war'

  const limit = days * options.rules.constants.ticksPerDay
  for (let i = 0; i < limit; i++) {
    const { commands, memories } = runAi(state, { map: options.map, rules: options.rules })
    state = runTicks(state, 1, { map: options.map, rules: options.rules }, () => commands).state
    storeMemories(state, memories)
    if (state.victory.winner !== null) {
      return {
        winner: state.victory.winner,
        scores: { p1: scoreOf(state, 'p1', options.rules), p2: scoreOf(state, 'p2', options.rules) },
        ticks: state.tick,
        reason: 'victory',
      }
    }
  }

  const scores = { p1: scoreOf(state, 'p1', options.rules), p2: scoreOf(state, 'p2', options.rules) }
  const winner = scores.p1 === scores.p2 ? null : scores.p1 > scores.p2 ? 'p1' : 'p2'
  return { winner, scores, ticks: state.tick, reason: 'timeLimit' }
}

export interface TournamentResult {
  matches: number
  /** Wins for the first difficulty listed. */
  winsA: number
  winsB: number
  draws: number
  winRateA: number
}

/** Plays the same pairing from a fixed set of seeds, sides swapped every other match. */
export function playTournament(options: {
  map: MapData
  rules: Rules
  difficulties: [Difficulty, Difficulty]
  matches: number
  days?: number
  firstSeed?: number
}): TournamentResult {
  let winsA = 0
  let winsB = 0
  let draws = 0

  for (let i = 0; i < options.matches; i++) {
    // Swap sides every other match so a favourable starting position cannot decide it.
    const swapped = i % 2 === 1
    const pairing: [Difficulty, Difficulty] = swapped
      ? [options.difficulties[1], options.difficulties[0]]
      : options.difficulties

    const result = playMatch({
      map: options.map,
      rules: options.rules,
      seed: (options.firstSeed ?? 1000) + i,
      difficulties: pairing,
      ...(options.days !== undefined ? { days: options.days } : {}),
    })

    if (result.winner === null) draws += 1
    else {
      const aWon = swapped ? result.winner === 'p2' : result.winner === 'p1'
      if (aWon) winsA += 1
      else winsB += 1
    }
  }

  const decided = winsA + winsB
  return { matches: options.matches, winsA, winsB, draws, winRateA: decided === 0 ? 0 : winsA / decided }
}
