import { emit } from '../events/emit'
import type { GameState } from '../state/types'
import type { Phase, PhaseContext } from './index'

/**
 * Building progress and completions (R-PROV-01, design D3 phase 4).
 *
 * Orders carry the player who placed them. If the province changed hands while the
 * scaffolding stood, the order dies with no refund (R-PROV-01/AK2) — conquering a
 * half-built factory should not hand the conqueror a discount.
 */
export const construction: Phase = (draft: GameState, ctx: PhaseContext) => {
  for (const provinceId of draft.provinceOrder) {
    const province = draft.provinces[provinceId]!
    if (province.buildQueue.length === 0) continue

    const remaining = []
    for (const order of province.buildQueue) {
      if (province.owner !== order.ownerAtStart) {
        emit(ctx.events, draft.tick, 'BUILD_CANCELLED', {
          playerId: order.ownerAtStart,
          provinceId,
          building: order.building,
          reason: 'ownerChanged',
          audience: [order.ownerAtStart],
        })
        continue
      }

      // `completesAtTick` is the clock reading at which the building stands. The phase
      // runs before bookkeeping advances the clock, so it compares against tick + 1.
      if (draft.tick + 1 < order.completesAtTick) {
        remaining.push(order)
        continue
      }

      province.buildings[order.building] = order.level
      emit(ctx.events, draft.tick, 'BUILD_COMPLETED', {
        playerId: order.ownerAtStart,
        provinceId,
        building: order.building,
        level: order.level,
        audience: [order.ownerAtStart],
      })
    }

    province.buildQueue = remaining
  }
}
