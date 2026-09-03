import { emit } from '../events/emit'
import { atWar } from './combat'
import type { GameState, PlayerId, ProvinceId } from '../state/types'
import type { Phase, PhaseContext } from './index'

/**
 * Province capture (R-BAT-04, design D6.6).
 *
 * A province changes hands when an enemy land force stands in it and nobody is left
 * to defend it. Aircraft and ships cannot take ground — that is what keeps land forces
 * necessary.
 */
function canOccupy(state: GameState, provinceId: ProvinceId, rules: PhaseContext['rules']): PlayerId | null {
  const present = state.armyOrder
    .map((id) => state.armies[id]!)
    .filter((army) => army.locationProvinceId === provinceId && !army.embarked && army.units.length > 0)

  const withLand = present.filter((army) =>
    army.units.some((stack) => {
      const rule = rules.units[stack.unitKey]
      return rule && rule.class !== 'air' && rule.class !== 'navy'
    }),
  )
  if (withLand.length === 0) return null

  const owners = new Set(withLand.map((army) => army.owner))
  if (owners.size !== 1) return null // still contested

  return [...owners][0]!
}

export const occupation: Phase = (draft: GameState, ctx: PhaseContext) => {
  for (const provinceId of draft.provinceOrder) {
    const province = draft.provinces[provinceId]!
    const claimant = canOccupy(draft, provinceId, ctx.rules)
    if (!claimant || claimant === province.owner) continue

    // Neutral ground can be walked into; owned ground needs a war.
    if (province.owner !== null && !atWar(draft, claimant, province.owner)) continue

    const previousOwner = province.owner
    province.owner = claimant
    province.morale = ctx.rules.constants.capturedMorale
    province.occupiedSince = draft.tick
    // Orders die with the change of owner; the construction phase reports it.
    province.recruitQueue = []

    emit(ctx.events, draft.tick, 'PROVINCE_CAPTURED', {
      provinceId,
      previousOwner,
      newOwner: claimant,
    })

    // Losing a capital hurts the whole nation for a while (design D6.8).
    if (previousOwner && draft.players[previousOwner]?.capitalProvinceId === provinceId) {
      const player = draft.players[previousOwner]!
      // eslint-disable-next-line no-restricted-syntax -- days x ticks-per-day, plain integers
      const until = draft.tick + ctx.rules.constants.capitalLossDays * ctx.rules.constants.ticksPerDay
      player.capitalLostUntil = until
      player.capitalProvinceId = null

      emit(ctx.events, draft.tick, 'CAPITAL_LOST', {
        playerId: previousOwner,
        provinceId,
        penaltyUntilTick: until,
      })
    }
  }
}
