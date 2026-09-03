import { ONE, mulChain } from '@worldwar/shared'
import { emit } from '../events/emit'
import { neighborsOf } from '../map/pathfinding'
import { scaleArmyHp } from '../state/army'
import { atWar } from './combat'
import type { GameState, ProvinceId } from '../state/types'
import type { Phase, PhaseContext } from './index'

/**
 * Retreats (R-BAT-05, design D6.8).
 *
 * Resolved before movement and before combat, so pulling out is a real decision and
 * not a free escape after the blow has landed. Retreating costs strength, doubles the
 * deployment delay and blocks attacking for a day — otherwise "attack, retreat, repeat"
 * would be the dominant strategy.
 */
function retreatTarget(state: GameState, provinceId: ProvinceId, owner: string, map: PhaseContext['map']): ProvinceId | null {
  const candidates = neighborsOf(map, provinceId, false)
    .filter((id) => {
      const province = state.provinces[id]
      if (!province) return false
      if (province.owner === owner || province.owner === null) return true
      return !atWar(state, owner, province.owner)
    })
    .sort()

  // Prefer own territory, then anything not hostile. Sorted, so the choice is stable.
  return candidates.find((id) => state.provinces[id]!.owner === owner) ?? candidates[0] ?? null
}

export const retreat: Phase = (draft: GameState, ctx: PhaseContext) => {
  for (const armyId of draft.armyOrder) {
    const army = draft.armies[armyId]
    if (!army || army.stance !== 'retreat' || army.embarked) continue

    const target = retreatTarget(draft, army.locationProvinceId, army.owner, ctx.map)
    if (!target) {
      // Nowhere to go: the army has to stand and fight.
      army.stance = 'defensive'
      continue
    }

    const from = army.locationProvinceId
    const lost = scaleArmyHp(army, ONE - ctx.rules.constants.retreatLossPermille)

    army.locationProvinceId = target
    army.path = []
    army.arrivalTick = null
    army.stance = 'defensive'
    // eslint-disable-next-line no-restricted-syntax -- delay ticks x 2, plain integers
    army.deployDelayUntil = draft.tick + ctx.rules.constants.deployDelayTicks * 2
    army.cannotAttackUntil = draft.tick + ctx.rules.constants.retreatCooldownTicks

    emit(ctx.events, draft.tick, 'ARMY_RETREATED', {
      playerId: army.owner,
      armyId: army.id,
      fromProvinceId: from,
      toProvinceId: target,
      hpLost: lost,
      audience: [army.owner],
    })

    if (army.units.length === 0) {
      emit(ctx.events, draft.tick, 'ARMY_DESTROYED', {
        playerId: army.owner,
        armyId: army.id,
        provinceId: target,
        audience: [army.owner],
      })
      delete draft.armies[army.id]
      draft.armyOrder = draft.armyOrder.filter((id) => id !== army.id)
    }
  }
  void mulChain
}
