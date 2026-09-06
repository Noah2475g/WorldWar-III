import { neighborsOf } from '../map/pathfinding'
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

  /**
   * Setzt nur noch die **Absicht** (T-M15-07, Befund 52).
   *
   * Bis zum 2026-09-06 richtete diese Stelle den Schaden sofort an — in Phase 1, waehrend
   * der Nahkampf in Phase 8 aufgeloest wird. Damit galten fuer zwei Kampfarten zwei
   * Zeitpunkte, und eine Armee, die in diesem Tick abmarschierte, wurde noch am alten Ort
   * getroffen. Aufgeloest wird jetzt in `phases/bombardment.ts`, direkt vor dem Nahkampf
   * und mit demselben Code wie die Feuerautomatik: dieselbe Kanone, eine Regel.
   */
  apply: (draft, command) => {
    draft.armies[command.armyId]!.bombardTarget = command.targetProvinceId
  },
})
