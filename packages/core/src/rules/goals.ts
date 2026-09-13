import { quotFixed } from '@worldwar/shared'
import { GOAL_KEYS, type GameState, type GoalKey, type PlayerId } from '../state/types'
import type { Rules } from './types'

/**
 * Zwischenziele (R-GAME-08, D31.3, T-M35-03).
 *
 * Rückmeldung, keine Regel: nichts hier liest `checkVictory`, und nichts hier verbraucht
 * Zufall. Die Prüfung läuft einmal je Spieltag in `dailyTick`, **nach** der Punktberechnung,
 * deren Zahlen sie liest, und **vor** `checkVictory`, das sie nicht liest.
 */

/** Wo eine Macht gegenüber den Marken steht. */
export interface GoalStanding {
  /** Zahl der eigenen Provinzen. */
  provinces: number
  /** Anteil an allen Punkten, in Promille — dieselbe Rechnung wie die Siegprüfung. */
  pointSharePermille: number
  /** Anteil an der Weltbevölkerung, in Promille. */
  populationSharePermille: number
}

/** Ein Ziel, das an diesem Tageswechsel zum ersten Mal erreicht wurde. */
export interface GoalReached {
  playerId: PlayerId
  goal: GoalKey
  day: number
}

/** Die Marke eines Ziels aus den Regeln (D31.2). */
export function goalMark(goal: GoalKey, rules: Rules): number {
  const c = rules.constants
  switch (goal) {
    case 'provinces':
      return c.goalProvinces
    case 'pointShareFirst':
      return c.goalPointShareFirstPermille
    case 'populationShare':
      return c.goalPopulationSharePermille
    case 'pointShareSecond':
      return c.goalPointShareSecondPermille
  }
}

/** Der Stand, der gegen die Marke eines Ziels gehalten wird. */
export function goalValue(goal: GoalKey, standing: GoalStanding): number {
  switch (goal) {
    case 'provinces':
      return standing.provinces
    case 'pointShareFirst':
    case 'pointShareSecond':
      return standing.pointSharePermille
    case 'populationShare':
      return standing.populationSharePermille
  }
}

/**
 * Der Stand einer Macht.
 *
 * Die Punkte kommen aus `player.score`, also aus genau den Zahlen, die `dailyTick` gerade
 * gesetzt hat — kein zweiter Aufruf von `scoreOf`. Die Summe läuft über **alle** Mächte in
 * `playerOrder` (eine ausgeschiedene trägt null Punkte), die Bevölkerung über **alle**
 * Provinzen, neutrale eingeschlossen: die Weltbevölkerung ist die ganze Karte.
 */
export function goalStanding(state: GameState, playerId: PlayerId): GoalStanding {
  let totalScore = 0
  for (const id of state.playerOrder) totalScore += state.players[id]!.score

  let provinces = 0
  let ownPopulation = 0
  let totalPopulation = 0
  for (const id of state.provinceOrder) {
    const province = state.provinces[id]!
    totalPopulation += province.population
    if (province.owner !== playerId) continue
    provinces += 1
    ownPopulation += province.population
  }

  return {
    provinces,
    pointSharePermille: totalScore > 0 ? quotFixed(state.players[playerId]!.score, totalScore) : 0,
    populationSharePermille: totalPopulation > 0 ? quotFixed(ownPopulation, totalPopulation) : 0,
  }
}

/**
 * Trägt für jede lebende Macht den Spieltag jedes Ziels ein, dessen Marke sie heute erreicht.
 *
 * Ein gesetzter Tag wird **nie** zurückgesetzt und nie überschrieben (R-GAME-08/AK1): wer
 * 25 Provinzen hatte und auf 24 fällt, hat das Ziel trotzdem erreicht, und wer sie danach
 * zurückerobert, erreicht es nicht ein zweites Mal. Gibt die neu erreichten Ziele zurück.
 */
export function settleGoals(draft: GameState, rules: Rules, day: number): GoalReached[] {
  const reached: GoalReached[] = []

  for (const playerId of draft.playerOrder) {
    if (!draft.players[playerId]!.alive) continue
    const days = draft.goals[playerId]!
    const standing = goalStanding(draft, playerId)

    for (const goal of GOAL_KEYS) {
      if (days[goal] !== null) continue
      if (goalValue(goal, standing) < goalMark(goal, rules)) continue
      days[goal] = day
      reached.push({ playerId, goal, day })
    }
  }

  return reached
}
