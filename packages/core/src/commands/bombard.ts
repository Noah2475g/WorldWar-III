import { mulChain, quotFixed } from '@worldwar/shared'
import { emit } from '../events/emit'
import { neighborsOf } from '../map/pathfinding'
import { applySpread, classShares, damageFor, defenceMultiplier, sideAttackValue } from '../rules/combat'
import { armyHp, pruneEmptyStacks } from '../state/army'
import { atWar } from '../phases/combat'
import type { GameState, ProvinceId } from '../state/types'
import { registerCommand } from './registry'
import { fail, ok, type BombardCommand } from './types'

/**
 * Ranged attack (R-BAT-06, T-M4-04).
 *
 * Artillery and aircraft strike a neighbouring province without entering it: damage
 * without a counter-blow, but also without capturing anything. Range is re-checked
 * when the order resolves, because movement happens in between.
 */
export function provincesInRange(
  state: GameState,
  from: ProvinceId,
  range: number,
  map: { edges: readonly unknown[]; edgesByProvince: Readonly<Record<string, readonly number[]>>; provinces: readonly { id: string }[] },
): Set<ProvinceId> {
  const reached = new Set<ProvinceId>([from])
  let frontier: ProvinceId[] = [from]

  for (let step = 0; step < range; step++) {
    const next: ProvinceId[] = []
    for (const id of frontier) {
      for (const neighbour of neighborsOf(map as never, id, true)) {
        if (reached.has(neighbour)) continue
        reached.add(neighbour)
        next.push(neighbour)
      }
    }
    frontier = next
  }
  reached.delete(from)
  return reached
}

/** Longest range in this army; zero means it cannot bombard at all. */
export function armyRange(army: { units: { unitKey: string }[] }, rules: { units: Record<string, { rangeProvinces?: number }> }): number {
  let best = 0
  for (const stack of army.units) {
    best = Math.max(best, rules.units[stack.unitKey]?.rangeProvinces ?? 0)
  }
  return best
}

registerCommand<BombardCommand>('BOMBARD', {
  check: (state: GameState, command, ctx) => {
    const army = state.armies[command.armyId]
    if (!army) return fail('ARMY_NOT_FOUND', { armyId: command.armyId })
    if (army.owner !== command.playerId) return fail('NOT_OWNER', { armyId: command.armyId })
    if (army.embarked) return fail('INVALID_TARGET', { reason: 'eingeschifft' })
    if (state.tick < army.cannotAttackUntil) return fail('ON_COOLDOWN', { until: army.cannotAttackUntil })

    const range = armyRange(army, ctx.rules)
    if (range <= 0) return fail('INVALID_TARGET', { reason: 'keine Fernwaffe' })

    const target = state.provinces[command.targetProvinceId]
    if (!target) return fail('PROVINCE_NOT_FOUND', { provinceId: command.targetProvinceId })

    if (!provincesInRange(state, army.locationProvinceId, range, ctx.map).has(command.targetProvinceId)) {
      return fail('OUT_OF_RANGE', { range })
    }
    if (!target.owner || !atWar(state, command.playerId, target.owner)) {
      return fail('AT_WAR_REQUIRED', { provinceId: command.targetProvinceId })
    }
    return ok
  },

  apply: (draft, command, ctx) => {
    const army = draft.armies[command.armyId]!
    const province = draft.provinces[command.targetProvinceId]!

    // Getroffen wird, mit wem man im Krieg ist — nicht jeder, der zufällig hier steht
    // (T-M14-07, Befund 51). Die Prüfung davor sieht nur, wem die *Provinz* gehört; ein
    // Verbündeter oder eine neutrale Macht in derselben Provinz bekam bisher die volle
    // Ladung, ohne dass je eine Kriegserklärung gefallen wäre.
    const defenders = draft.armyOrder
      .map((id) => draft.armies[id]!)
      .filter(
        (other) =>
          other.locationProvinceId === command.targetProvinceId &&
          other.owner !== army.owner &&
          atWar(draft, army.owner, other.owner),
      )

    if (defenders.length === 0) {
      // Shelling an empty province only hurts its morale.
      province.morale = Math.max(0, province.morale - ctx.rules.constants.battleMoraleLoss)
      emit(ctx.events, draft.tick, 'BOMBARDMENT', {
        playerId: army.owner,
        armyId: army.id,
        targetProvinceId: command.targetProvinceId,
        damage: 0,
        audience: [army.owner],
      })
      return
    }

    const shares = classShares(defenders, ctx.rules)
    const value = sideAttackValue(draft, [army], shares, false, ctx.rules)
    const spread = applySpread(value, draft.rng, ctx.rules)
    const defence = defenceMultiplier(province, true, ctx.rules)

    // Ranged fire is deliberately weaker than closing with the enemy.
    const damage = mulChain([damageFor(spread, defence, ctx.rules), ctx.rules.constants.bombardFactor])

    const total = defenders.reduce((sum, other) => sum + armyHp(other), 0)
    let dealt = 0
    for (const defender of defenders) {
      for (const stack of defender.units) {
        const share = quotFixed(stack.hpTotal, total)
        const hit = Math.min(stack.hpTotal, mulChain([damage, share]))
        stack.hpTotal -= hit
        dealt += hit
      }
      pruneEmptyStacks(defender)
    }

    army.cannotAttackUntil = draft.tick + 1

    // Eine ausgelöschte Armee verschwindet, statt als leere Hülle liegen zu bleiben
    // (T-M14-07, Befund 53). Der Nahkampf tat das längst; der Beschuss nicht — und eine
    // Hülle ohne Einheiten hält ihren Besitzer am Leben, weshalb eine Partie nie zu einem
    // Sieger kommt. Genau daran hätte der Abnahmetest aus T-M14-14 gehangen.
    for (const defender of defenders) {
      if (defender.units.length > 0) continue
      emit(ctx.events, draft.tick, 'ARMY_DESTROYED', {
        playerId: defender.owner,
        armyId: defender.id,
        provinceId: command.targetProvinceId,
        audience: [defender.owner],
      })
      delete draft.armies[defender.id]
      draft.armyOrder = draft.armyOrder.filter((id) => id !== defender.id)
    }

    emit(ctx.events, draft.tick, 'BOMBARDMENT', {
      playerId: army.owner,
      armyId: army.id,
      targetProvinceId: command.targetProvinceId,
      damage: dealt,
    })
  },
})
