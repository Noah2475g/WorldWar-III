import { mulChain } from '@worldwar/shared'
import { emit } from '../events/emit'
import { recruitStartCondition } from '../rules/recruit'
import type { Army, GameState, ProvinceId } from '../state/types'
import type { Phase, PhaseContext } from './index'

/**
 * Recruitment progress and delivery (R-UNIT-02, design D3 phase 5).
 *
 * Finished units join an army that is already sitting in the province, and only start
 * a new one if there is none. Otherwise a busy province would litter the map with
 * one-unit armies that the player then has to merge by hand.
 */
function findHostArmy(draft: GameState, owner: string, provinceId: ProvinceId): Army | undefined {
  for (const armyId of draft.armyOrder) {
    const army = draft.armies[armyId]
    if (
      army &&
      army.owner === owner &&
      army.locationProvinceId === provinceId &&
      army.path.length === 0 &&
      !army.embarked
    ) {
      return army
    }
  }
  return undefined
}

export const recruitment: Phase = (draft: GameState, ctx: PhaseContext) => {
  for (const provinceId of draft.provinceOrder) {
    const province = draft.provinces[provinceId]!
    if (province.recruitQueue.length === 0) continue

    const remaining = []
    for (const order of province.recruitQueue) {
      // A province that changed hands does not deliver to its former owner.
      if (province.owner !== order.ownerAtStart) continue

      if (draft.tick + 1 < order.completesAtTick) {
        remaining.push(order)
        continue
      }

      const unit = ctx.rules.units[order.unitKey]
      if (!unit) continue

      // Belegt: fresh units start with hit points in proportion to province morale.
      const condition = recruitStartCondition(province.morale)
      // eslint-disable-next-line no-restricted-syntax -- per-unit hit points x batch size, plain integers
      const fullHp = unit.hpPerUnit * order.count
      const hpTotal = mulChain([fullHp, condition])

      let army = findHostArmy(draft, order.ownerAtStart, provinceId)
      if (!army) {
        const id = `a${draft.nextIds.army++}`
        army = {
          id,
          owner: order.ownerAtStart,
          name: `Armee ${id.slice(1)}`,
          locationProvinceId: provinceId,
          units: [],
          path: [],
          arrivalTick: null,
          departureTick: null,
          deployDelayUntil: 0,
          stance: 'defensive',
          embarked: false,
          cannotAttackUntil: 0,
        }
        draft.armies[id] = army
        draft.armyOrder = [...draft.armyOrder, id].sort()
      }

      const existing = army.units.find((stack) => stack.unitKey === order.unitKey)
      if (existing) {
        existing.hpTotal += hpTotal
      } else {
        army.units.push({ unitKey: order.unitKey, hpTotal })
        army.units.sort((a, b) => (a.unitKey < b.unitKey ? -1 : a.unitKey > b.unitKey ? 1 : 0))
      }

      emit(ctx.events, draft.tick, 'UNIT_RECRUITED', {
        playerId: order.ownerAtStart,
        provinceId,
        unitKey: order.unitKey,
        count: order.count,
        armyId: army.id,
        audience: [order.ownerAtStart],
      })
    }

    province.recruitQueue = remaining
  }
}
