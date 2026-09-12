import { emit } from '../events/emit'
import { currentDay } from '../rules/availability'
import { buildSlots, buildTicksForLevel, buildingCostForLevel, canAfford, completionTick, nextBuildLevel, payCost, refundCost } from '../rules/build'
import type { GameState } from '../state/types'
import { registerCommand } from './registry'
import { fail, ok, type BuildCommand, type CancelBuildCommand } from './types'

/**
 * Building construction (R-PROV-01, T-M3-04).
 *
 * Costs are taken the moment the order is placed, not when it completes: otherwise a
 * player could queue everything at once and decide later what to pay for.
 */
registerCommand<BuildCommand>('BUILD', {
  check: (state: GameState, command, ctx) => {
    const province = state.provinces[command.provinceId]
    if (!province) return fail('PROVINCE_NOT_FOUND', { provinceId: command.provinceId })
    if (province.owner !== command.playerId) return fail('NOT_OWNER', { provinceId: command.provinceId })

    const rule = ctx.rules.buildings[command.building]
    if (!rule) return fail('INVALID_TARGET', { building: command.building })

    const current = province.buildings[command.building] ?? 0
    const queued = province.buildQueue.filter((order) => order.building === command.building).length
    if (current + queued >= rule.maxLevel) {
      return fail('BUILDING_MAX_LEVEL', { building: command.building, level: rule.maxLevel })
    }

    if (rule.requiresCoastal && !province.coastal) {
      return fail('INVALID_TARGET', { building: command.building, reason: 'braucht Küste' })
    }
    // R-TECH-01: vor ihrem ersten Spieltag gibt es die Sache nicht — und die Ablehnung
    // nennt den Tag, statt den Spieler raten zu lassen. Die Pruefung steht vor dem Geld:
    // "du kannst es dir nicht leisten" waere fuer etwas, das es noch gar nicht gibt, die
    // falsche Auskunft.
    const day = currentDay(state, ctx.rules)
    if (day < rule.availableFromDay) {
      return fail('NOT_YET_AVAILABLE', { building: command.building, availableFromDay: rule.availableFromDay })
    }
    if (rule.requiresBuilding && (province.buildings[rule.requiresBuilding] ?? 0) < 1) {
      return fail('MISSING_BUILDING', { required: rule.requiresBuilding })
    }
    if (province.buildQueue.length >= buildSlots(province, ctx.rules)) {
      return fail('QUEUE_FULL', { slots: buildSlots(province, ctx.rules) })
    }

    const player = state.players[command.playerId]!
    // Der Preis der Stufe, die dieser Auftrag baut — nicht der Grundpreis (T-M34-04).
    // Geprueft wird mit derselben Zahl, die `apply` gleich abzieht; zwei Formeln fuer
    // denselben Preis waeren die Bauart, an der dieses Projekt schon gescheitert ist.
    const level = nextBuildLevel(province, command.building)
    if (!canAfford(player.resources, buildingCostForLevel(rule, level, ctx.rules.constants))) {
      return fail('INSUFFICIENT_RESOURCES', { building: command.building, level })
    }
    return ok
  },

  apply: (draft, command, ctx) => {
    const province = draft.provinces[command.provinceId]!
    const player = draft.players[command.playerId]!
    const rule = ctx.rules.buildings[command.building]!

    const level = nextBuildLevel(province, command.building)
    payCost(player.resources, buildingCostForLevel(rule, level, ctx.rules.constants))

    const orderId = `o${draft.nextIds.order++}`
    const completesAtTick = completionTick(
      draft.tick,
      buildTicksForLevel(rule, level, ctx.rules.constants),
      province.morale,
    )

    province.buildQueue.push({
      id: orderId,
      building: command.building,
      level,
      startedTick: draft.tick,
      completesAtTick,
      ownerAtStart: command.playerId,
    })

    emit(ctx.events, draft.tick, 'BUILD_STARTED', {
      playerId: command.playerId,
      provinceId: command.provinceId,
      building: command.building,
      level,
      completesAtTick,
      audience: [command.playerId],
    })
  },
})

registerCommand<CancelBuildCommand>('CANCEL_BUILD', {
  check: (state: GameState, command) => {
    const province = state.provinces[command.provinceId]
    if (!province) return fail('PROVINCE_NOT_FOUND', { provinceId: command.provinceId })
    if (province.owner !== command.playerId) return fail('NOT_OWNER', { provinceId: command.provinceId })
    if (!province.buildQueue.some((order) => order.id === command.orderId)) {
      return fail('INVALID_TARGET', { orderId: command.orderId })
    }
    return ok
  },

  apply: (draft, command, ctx) => {
    const province = draft.provinces[command.provinceId]!
    const player = draft.players[command.playerId]!
    const index = province.buildQueue.findIndex((order) => order.id === command.orderId)
    const [order] = province.buildQueue.splice(index, 1)
    if (!order) return

    // Half the outlay comes back — cancelling costs something, but not everything.
    // Die Haelfte des TATSAECHLICH bezahlten Preises (T-M34-04): der Auftrag traegt seine
    // Stufe, und ohne sie waere der Abbruch einer dritten Stufe ein Verlustgeschaeft mit
    // Ansage — halb zurueck vom Preis der ersten.
    refundCost(
      player.resources,
      buildingCostForLevel(ctx.rules.buildings[order.building]!, order.level, ctx.rules.constants),
    )

    emit(ctx.events, draft.tick, 'BUILD_CANCELLED', {
      playerId: command.playerId,
      provinceId: command.provinceId,
      building: order.building,
      reason: 'byPlayer',
      audience: [command.playerId],
    })
  },
})
