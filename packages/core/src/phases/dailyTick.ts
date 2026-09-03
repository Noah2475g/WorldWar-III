import { emit } from '../events/emit'
import { checkVictory, scoreOf } from '../rules/victory'
import { settleMorale } from './morale'
import type { GameState, PlayerId } from '../state/types'
import type { Phase, PhaseContext } from './index'

/**
 * The daily settlement (design D3).
 *
 * Everything defined in units of days lives here: morale drift and revolts, scores,
 * elimination and the victory check. Running these hourly would be both twenty-four
 * times too strong and pure waste in the hottest path.
 */
export const dailyTick: Phase = (draft: GameState, ctx: PhaseContext) => {
  settleMorale(draft, ctx)

  const scores: Record<PlayerId, number> = {}
  for (const playerId of draft.playerOrder) {
    const player = draft.players[playerId]!
    player.score = scoreOf(draft, playerId, ctx.rules)
    scores[playerId] = player.score

    if (!player.alive) continue

    // A player with no provinces and no armies left is out.
    const holdsProvince = draft.provinceOrder.some((id) => draft.provinces[id]!.owner === playerId)
    const holdsArmy = draft.armyOrder.some((id) => draft.armies[id]!.owner === playerId)
    if (!holdsProvince && !holdsArmy) {
      player.alive = false
      emit(ctx.events, draft.tick, 'PLAYER_ELIMINATED', { playerId })
    }
  }

  if (draft.victory.winner === null) {
    const verdict = checkVictory(draft, ctx.rules)
    if (verdict.winner || verdict.condition) {
      draft.victory.winner = verdict.winner
      draft.victory.endedAtTick = draft.tick
      emit(ctx.events, draft.tick, 'GAME_ENDED', {
        winner: verdict.winner,
        condition: verdict.condition ?? draft.victory.condition,
      })
    }
  }

  // eslint-disable-next-line no-restricted-syntax -- tick divided by ticks-per-day, plain integers
  const day = Math.trunc(draft.tick / ctx.rules.constants.ticksPerDay)
  emit(ctx.events, draft.tick, 'DAY_REPORT', { day, scores })
}
