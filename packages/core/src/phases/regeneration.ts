import { mulChain } from '@worldwar/shared'
import { unitCount } from '../state/army'
import { atWar } from './combat'
import type { GameState } from '../state/types'
import type { Phase, PhaseContext } from './index'

/**
 * Units recover in friendly territory (R-UNIT-07, design D6.8).
 *
 * In the pool model this means topping up the partially spent unit: an infantry pool
 * of 3500 counts as four units and can grow back to 4000 — but never beyond, because
 * that would be recruiting, not healing.
 */
export const regeneration: Phase = (draft: GameState, ctx: PhaseContext) => {
  const { rules } = ctx

  for (const armyId of draft.armyOrder) {
    const army = draft.armies[armyId]
    if (!army || army.embarked || army.path.length > 0) continue

    const province = draft.provinces[army.locationProvinceId]
    if (!province) continue

    // Only at home, and only in peace and quiet.
    const friendly = province.owner === army.owner
    if (!friendly) continue

    const contested = draft.armyOrder.some((otherId) => {
      const other = draft.armies[otherId]
      return (
        other &&
        other.locationProvinceId === army.locationProvinceId &&
        other.owner !== army.owner &&
        atWar(draft, army.owner, other.owner)
      )
    })
    if (contested) continue

    const player = draft.players[army.owner]
    const shortage = player?.shortages.includes('wood') || player?.shortages.includes('iron')
    const rate = shortage
      ? mulChain([rules.constants.regenPermillePerTick, rules.constants.regenShortageFactor])
      : rules.constants.regenPermillePerTick

    for (const stack of army.units) {
      const rule = rules.units[stack.unitKey]
      if (!rule) continue
      // eslint-disable-next-line no-restricted-syntax -- per-unit hit points x unit count, plain integers
      const ceiling = rule.hpPerUnit * unitCount(stack, rules)
      if (stack.hpTotal >= ceiling) continue

      const healed = mulChain([ceiling, rate])
      stack.hpTotal = Math.min(ceiling, stack.hpTotal + Math.max(1, healed))
    }
  }
}
