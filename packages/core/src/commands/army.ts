import { emit } from '../events/emit'
import { pruneEmptyStacks } from '../state/army'
import type { Army, GameState } from '../state/types'
import { registerCommand } from './registry'
import { fail, ok, type MergeArmiesCommand, type SplitArmyCommand, type StopArmyCommand } from './types'

/**
 * Splitting and merging armies (R-UNIT-03, T-M4-01).
 *
 * Hit points are conserved exactly: whatever leaves one army arrives in the other.
 * That invariant is what lets the combat model trust its own numbers later.
 */

registerCommand<SplitArmyCommand>('SPLIT_ARMY', {
  check: (state: GameState, command) => {
    const army = state.armies[command.armyId]
    if (!army) return fail('ARMY_NOT_FOUND', { armyId: command.armyId })
    if (army.owner !== command.playerId) return fail('NOT_OWNER', { armyId: command.armyId })
    if (army.path.length > 0) return fail('ARMY_BUSY', { armyId: command.armyId })
    if (command.take.length === 0) return fail('INVALID_TARGET', { reason: 'nichts ausgewählt' })

    for (const wanted of command.take) {
      const stack = army.units.find((entry) => entry.unitKey === wanted.unitKey)
      if (!stack) return fail('INVALID_TARGET', { unitKey: wanted.unitKey })
      if (!Number.isSafeInteger(wanted.hpTotal) || wanted.hpTotal <= 0) {
        return fail('INVALID_TARGET', { unitKey: wanted.unitKey, hpTotal: wanted.hpTotal })
      }
      if (wanted.hpTotal >= stack.hpTotal) {
        // Taking everything would leave an empty shell behind; that is a move, not a split.
        return fail('INVALID_TARGET', { unitKey: wanted.unitKey, reason: 'ganze Stärke' })
      }
    }
    return ok
  },

  apply: (draft, command) => {
    const source = draft.armies[command.armyId]!
    const id = `a${draft.nextIds.army++}`

    const detached: Army = {
      id,
      owner: source.owner,
      name: `Armee ${id.slice(1)}`,
      locationProvinceId: source.locationProvinceId,
      units: [],
      path: [],
      arrivalTick: null,
      departureTick: null,
      deployDelayUntil: source.deployDelayUntil,
      stance: source.stance,
      embarked: source.embarked,
      cannotAttackUntil: source.cannotAttackUntil,
      holdFire: source.holdFire,
    }

    for (const wanted of command.take) {
      const stack = source.units.find((entry) => entry.unitKey === wanted.unitKey)!
      stack.hpTotal -= wanted.hpTotal
      detached.units.push({ unitKey: wanted.unitKey, hpTotal: wanted.hpTotal })
    }

    detached.units.sort((a, b) => (a.unitKey < b.unitKey ? -1 : a.unitKey > b.unitKey ? 1 : 0))
    pruneEmptyStacks(source)

    draft.armies[id] = detached
    draft.armyOrder = [...draft.armyOrder, id].sort()
  },
})

registerCommand<MergeArmiesCommand>('MERGE_ARMIES', {
  check: (state: GameState, command) => {
    if (command.armyIds.length < 2) return fail('INVALID_TARGET', { reason: 'mindestens zwei Armeen' })

    const armies = command.armyIds.map((id) => state.armies[id])
    if (armies.some((army) => !army)) return fail('ARMY_NOT_FOUND', {})
    if (armies.some((army) => army!.owner !== command.playerId)) return fail('NOT_OWNER', {})

    const place = armies[0]!.locationProvinceId
    if (armies.some((army) => army!.locationProvinceId !== place)) {
      return fail('INVALID_TARGET', { reason: 'nicht am selben Ort' })
    }
    if (armies.some((army) => army!.path.length > 0)) return fail('ARMY_BUSY', {})
    if (armies.some((army) => army!.embarked !== armies[0]!.embarked)) {
      return fail('INVALID_TARGET', { reason: 'teils eingeschifft' })
    }
    return ok
  },

  apply: (draft, command) => {
    const ids = [...command.armyIds].sort()
    const target = draft.armies[ids[0]!]!

    for (const id of ids.slice(1)) {
      const source = draft.armies[id]!
      for (const stack of source.units) {
        const existing = target.units.find((entry) => entry.unitKey === stack.unitKey)
        if (existing) existing.hpTotal += stack.hpTotal
        else target.units.push({ ...stack })
      }
      // The merged army inherits the worst of both: a fresh unit does not undo the
      // deployment delay of the one it joins.
      target.deployDelayUntil = Math.max(target.deployDelayUntil, source.deployDelayUntil)
      target.cannotAttackUntil = Math.max(target.cannotAttackUntil, source.cannotAttackUntil)

      delete draft.armies[id]
      draft.armyOrder = draft.armyOrder.filter((entry) => entry !== id)
    }

    target.units.sort((a, b) => (a.unitKey < b.unitKey ? -1 : a.unitKey > b.unitKey ? 1 : 0))
  },
})

registerCommand<StopArmyCommand>('STOP_ARMY', {
  check: (state: GameState, command) => {
    const army = state.armies[command.armyId]
    if (!army) return fail('ARMY_NOT_FOUND', { armyId: command.armyId })
    if (army.owner !== command.playerId) return fail('NOT_OWNER', { armyId: command.armyId })
    return ok
  },

  apply: (draft, command, ctx) => {
    const army = draft.armies[command.armyId]!
    if (army.path.length === 0) return

    army.path = []
    army.arrivalTick = null
    army.departureTick = null

    emit(ctx.events, draft.tick, 'ARMY_ARRIVED', {
      playerId: army.owner,
      armyId: army.id,
      provinceId: army.locationProvinceId,
      audience: [army.owner],
    })
  },
})
