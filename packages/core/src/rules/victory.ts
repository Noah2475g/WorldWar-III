import { quotFixed, type Fixed } from '@worldwar/shared'
import { unitCount } from '../state/army'
import type { GameState, PlayerId } from '../state/types'
import type { Rules } from './types'

/**
 * Score and victory (R-GAME-02, design D6.7).
 *
 * Computed once per game day, never per tick: it is a sum over every province,
 * building and unit of every player, and nothing in an hour depends on it.
 */
export function scoreOf(state: GameState, playerId: PlayerId, rules: Rules): number {
  const c = rules.constants
  let score = 0

  for (const provinceId of state.provinceOrder) {
    const province = state.provinces[provinceId]!
    if (province.owner !== playerId) continue

    score += c.scoreProvince
    // eslint-disable-next-line no-restricted-syntax -- population in thousands x weight, plain integers
    score += Math.trunc(province.population / 1000) * c.scorePopulationPer1000
    for (const level of Object.values(province.buildings)) {
      // eslint-disable-next-line no-restricted-syntax -- building level x weight, plain integers
      if (level) score += level * c.scoreBuildingLevel
    }
  }

  for (const armyId of state.armyOrder) {
    const army = state.armies[armyId]!
    if (army.owner !== playerId) continue
    for (const stack of army.units) {
      // eslint-disable-next-line no-restricted-syntax -- unit count x weight, plain integers
      score += unitCount(stack, rules) * c.scoreUnit
    }
  }

  return score
}

export interface VictoryCheck {
  winner: PlayerId | null
  condition: 'points' | 'conquest' | 'time' | null
}

/** Has anyone won? Checked at the day boundary. */
export function checkVictory(state: GameState, rules: Rules): VictoryCheck {
  const alive = state.playerOrder.filter((id) => state.players[id]!.alive)
  if (alive.length === 1) return { winner: alive[0]!, condition: 'conquest' }
  if (alive.length === 0) return { winner: null, condition: null }

  const scores = new Map<PlayerId, number>()
  let total = 0
  for (const id of alive) {
    const score = scoreOf(state, id, rules)
    scores.set(id, score)
    total += score
  }

  if (state.victory.condition === 'points' && total > 0) {
    for (const [id, score] of scores) {
      const share = quotFixed(score, total)
      if (share >= state.victory.pointsShareToWin) return { winner: id, condition: 'points' }
    }
  }

  if (state.victory.condition === 'conquest') {
    // Everyone else has lost their capital and holds no province.
    const standing = alive.filter((id) => state.players[id]!.capitalProvinceId !== null)
    if (standing.length === 1) return { winner: standing[0]!, condition: 'conquest' }
  }

  if (state.victory.condition === 'time' && state.victory.dayLimit !== null) {
    // eslint-disable-next-line no-restricted-syntax -- days x ticks-per-day, plain integers
    const limit = state.victory.dayLimit * rules.constants.ticksPerDay
    if (state.tick >= limit) {
      let best: PlayerId | null = null
      let bestScore = -1
      for (const [id, score] of scores) {
        if (score > bestScore) {
          best = id
          bestScore = score
        }
      }
      return { winner: best, condition: 'time' }
    }
  }

  return { winner: null, condition: null }
}

/** Share of all points on the map, for the interface. */
export function pointShare(state: GameState, playerId: PlayerId, rules: Rules): Fixed {
  let total = 0
  for (const id of state.playerOrder) total += scoreOf(state, id, rules)
  if (total === 0) return 0
  return quotFixed(scoreOf(state, playerId, rules), total)
}
