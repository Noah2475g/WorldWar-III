import { currentDay } from '../rules/availability'
import { canAfford, payCost } from '../rules/build'
import { recruitDuration } from '../rules/recruit'
import type { GameState, ResourceKey } from '../state/types'
import { registerCommand } from './registry'
import { fail, ok, type RecruitCommand } from './types'

/** Largest batch that can be ordered at once — keeps a single order from being a whole army. */
export const MAX_RECRUIT_BATCH = 20

/**
 * Recruiting units (R-UNIT-02, T-M3-05).
 *
 * A unit needs the right building at the right level: barracks for infantry, factory
 * for armour and artillery, shipyard for ships, airfield for aircraft. That mapping is
 * what makes province development a decision rather than a formality.
 */
registerCommand<RecruitCommand>('RECRUIT', {
  check: (state: GameState, command, ctx) => {
    const province = state.provinces[command.provinceId]
    if (!province) return fail('PROVINCE_NOT_FOUND', { provinceId: command.provinceId })
    if (province.owner !== command.playerId) return fail('NOT_OWNER', { provinceId: command.provinceId })

    const unit = ctx.rules.units[command.unitKey]
    if (!unit) return fail('INVALID_TARGET', { unitKey: command.unitKey })

    if (!Number.isSafeInteger(command.count) || command.count < 1 || command.count > MAX_RECRUIT_BATCH) {
      return fail('INVALID_TARGET', { count: command.count })
    }

    // R-TECH-01: derselbe Riegel wie beim Bauen, und ebenfalls vor der Gebaeudepruefung —
    // eine Einheit ist nie frueher zu haben als ihr Gebaeude (der Lader sichert das zu),
    // also ist der Tag hier die genauere Auskunft.
    const day = currentDay(state, ctx.rules)
    if (day < unit.availableFromDay) {
      return fail('NOT_YET_AVAILABLE', { unitKey: command.unitKey, availableFromDay: unit.availableFromDay })
    }

    const level = province.buildings[unit.requiresBuilding] ?? 0
    const needed = unit.requiresBuildingLevel ?? 1
    if (level < needed) {
      return fail('MISSING_BUILDING', { required: unit.requiresBuilding, level: needed })
    }

    // Below this morale a province will not raise new formations at all (D6.8).
    if (province.morale < 25_000) {
      return fail('INVALID_TARGET', { reason: 'Moral zu niedrig', morale: province.morale })
    }

    const player = state.players[command.playerId]!
    const cost: Partial<Record<ResourceKey, number>> = {}
    for (const [key, amount] of Object.entries(unit.cost)) {
      if (!amount) continue
      // eslint-disable-next-line no-restricted-syntax -- unit cost x batch size, plain integers
      cost[key as ResourceKey] = amount * command.count
    }
    if (!canAfford(player.resources, cost)) {
      return fail('INSUFFICIENT_RESOURCES', { unitKey: command.unitKey })
    }
    return ok
  },

  apply: (draft, command, ctx) => {
    const province = draft.provinces[command.provinceId]!
    const player = draft.players[command.playerId]!
    const unit = ctx.rules.units[command.unitKey]!

    const cost: Partial<Record<ResourceKey, number>> = {}
    for (const [key, amount] of Object.entries(unit.cost)) {
      if (!amount) continue
      // eslint-disable-next-line no-restricted-syntax -- unit cost x batch size, plain integers
      cost[key as ResourceKey] = amount * command.count
    }
    payCost(player.resources, cost)

    const orderId = `o${draft.nextIds.order++}`
    const completesAtTick = draft.tick + recruitDuration(unit.buildTicks, province.morale)

    province.recruitQueue.push({
      id: orderId,
      unitKey: command.unitKey,
      count: command.count,
      startedTick: draft.tick,
      completesAtTick,
      ownerAtStart: command.playerId,
    })
  },
})
