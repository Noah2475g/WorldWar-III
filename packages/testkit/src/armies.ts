import type { Army, GameState, Stance, UnitStack } from '@worldwar/core'

/**
 * Places an army in a test state — with an id from the state's own counter.
 *
 * Hand-written fixtures that pick their own ids ("a1") collide with ids the game
 * generates later, and the collision silently overwrites an army. This helper exists
 * because that happened once and cost a confusing debugging session.
 */
export function placeArmy(
  state: GameState,
  options: {
    owner: string
    at: string
    units: UnitStack[]
    stance?: Stance
    deployDelayUntil?: number
    embarked?: boolean
  },
): Army {
  const id = `a${state.nextIds.army++}`
  const army: Army = {
    id,
    owner: options.owner,
    name: `Armee ${id.slice(1)}`,
    locationProvinceId: options.at,
    units: [...options.units].sort((a, b) => (a.unitKey < b.unitKey ? -1 : a.unitKey > b.unitKey ? 1 : 0)),
    path: [],
    arrivalTick: null,
    departureTick: null,
    deployDelayUntil: options.deployDelayUntil ?? 0,
    stance: options.stance ?? 'aggressive',
    embarked: options.embarked ?? false,
    cannotAttackUntil: 0,
  }
  state.armies[id] = army
  state.armyOrder = [...state.armyOrder, id].sort()
  return army
}
