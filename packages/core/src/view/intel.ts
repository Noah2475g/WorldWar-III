import { armyHp } from '../state/army'
import type { GameState } from '../state/types'
import { visibleProvinces } from './publicView'

/**
 * Reconnaissance memory (R-DIP-04/AK1, T-M6-03).
 *
 * What a player once saw stays known — with the timestamp of when it was seen, so the
 * interface can show it as "last known" rather than as fact. It lives in the state and
 * therefore survives saving and loading; a memory that resets on load would make the
 * fog of war a lie.
 */
export function updateIntel(draft: GameState): void {
  for (const playerId of draft.playerOrder) {
    const player = draft.players[playerId]!
    if (!player.alive) continue

    const visible = visibleProvinces(draft, playerId)
    for (const provinceId of visible) {
      const province = draft.provinces[provinceId]
      if (!province) continue

      let strength = 0
      for (const armyId of draft.armyOrder) {
        const army = draft.armies[armyId]!
        if (army.locationProvinceId === provinceId && army.owner !== playerId) {
          strength += armyHp(army)
        }
      }

      player.intel[provinceId] = { tick: draft.tick, owner: province.owner, strength }
    }
  }
}

/** How old a piece of information is, in ticks. */
export function intelAge(state: GameState, playerId: string, provinceId: string): number | null {
  const entry = state.players[playerId]?.intel[provinceId]
  return entry ? state.tick - entry.tick : null
}
