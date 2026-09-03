import { createInitialState, type GameConfig, type GameState, type MapData, type Rules } from '@worldwar/core'
import { colorForPlayer } from '../map/modes.ts'

/**
 * Setting up a game (T-M10-07a, R-GAME-01).
 *
 * Everything the dialogue collects ends up in the initial state, and the same seed
 * gives the same game — that is not a nicety, it is what makes a bug reproducible and
 * a balance measurement worth anything.
 *
 * The AI bonus is carried through openly (R-AI-02). A hidden multiplier is the thing
 * this project exists to avoid: a player who loses should be able to see whether they
 * were outplayed or out-multiplied.
 */

export type Difficulty = 'easy' | 'normal' | 'hard'

export interface NewGameOptions {
  /** The nation the player takes, by its name in the map's start positions. */
  nation: string
  seed: number
  difficulty: Difficulty
  /** How many AI powers join. Capped at what the map offers. */
  opponents: number
  victory: 'points' | 'conquest'
  mapId: string
}

export const DEFAULT_NEW_GAME: NewGameOptions = {
  nation: '',
  seed: 1914,
  difficulty: 'normal',
  opponents: 7,
  victory: 'points',
  mapId: 'world',
}

/**
 * Turns the dialogue's answers into a game configuration.
 *
 * Opponents are taken from the map's start positions in order, skipping the player's
 * own nation — deterministically, so the same seed really does give the same game
 * rather than merely the same random numbers.
 */
export function toConfig(options: NewGameOptions, map: MapData): GameConfig {
  const available = map.startPositions.map((start) => start.nation)
  const nation = available.includes(options.nation) ? options.nation : (available[0] ?? 'Unbekannt')

  const opponents = available
    .filter((name) => name !== nation)
    .slice(0, Math.max(0, Math.min(options.opponents, available.length - 1)))

  return {
    seed: options.seed,
    mapId: map.id,
    rulesId: 'default',
    players: [
      { name: nation, kind: 'human', nation, color: colorForPlayer('p1') },
      ...opponents.map((name, index) => ({
        name,
        kind: 'ai' as const,
        nation: name,
        color: colorForPlayer(`p${index + 2}`),
        difficulty: options.difficulty,
      })),
    ],
    victory:
      options.victory === 'points'
        ? { condition: 'points' as const, pointsShareToWin: 700, dayLimit: null }
        : { condition: 'conquest' as const, pointsShareToWin: 1000, dayLimit: null },
  }
}

export function startGame(options: NewGameOptions, map: MapData, rules: Rules): GameState {
  return createInitialState(toConfig(options, map), { map, rules })
}

/**
 * The AI's advantage at a difficulty, as a percentage the interface can show.
 *
 * 1000 in the rules means "no bonus"; anything else is displayed rather than hidden
 * (R-AI-02). The hard setting in this game buys the AI more thinking, not more ore —
 * and the player is entitled to know that.
 */
export function aiBonusPercent(rules: Rules, difficulty: Difficulty): number {
  const bonus = rules.ai.difficulties[difficulty]?.resourceBonus ?? 1000
  return Math.round((bonus / 1000 - 1) * 100)
}

/** How many opponents this map can field. */
export function maxOpponents(map: MapData): number {
  return Math.max(0, map.startPositions.length - 1)
}
