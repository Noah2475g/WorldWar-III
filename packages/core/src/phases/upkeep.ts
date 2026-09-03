import { emit } from '../events/emit'
import { armyUpkeep } from '../state/army'
import type { GameState, PlayerId, ResourceKey } from '../state/types'
import type { Phase, PhaseContext } from './index'

/**
 * Upkeep, storage limits and shortages (R-ECON-03, R-ECON-04, design D6.2/D6.8).
 *
 * Two rules that decide how the economy feels:
 *
 *  - Stocks never go negative. Running out is a *state* with consequences, not a
 *    negative number that quietly cancels out next tick.
 *  - Overflow is lost. Storage caps are what stop a large empire from stockpiling
 *    its way past every decision — money is the documented exception (D6.8).
 */

/** Which shortage does what. Read by movement, combat and morale. */
export const SHORTAGE_EFFECTS: Record<string, string> = {
  food: 'Moral sinkt beschleunigt',
  oil: 'Bewegungsgeschwindigkeit halbiert',
  wood: 'Kampfstärke gemindert',
  iron: 'Kampfstärke gemindert',
}

export function hasShortage(state: GameState, playerId: PlayerId, resource: ResourceKey): boolean {
  return state.players[playerId]?.shortages.includes(resource) ?? false
}

export const upkeep: Phase = (draft: GameState, ctx: PhaseContext) => {
  const { rules } = ctx

  // Total upkeep per player, gathered in army order so the result never depends on
  // object iteration order.
  const demand = new Map<PlayerId, Partial<Record<ResourceKey, number>>>()
  for (const armyId of draft.armyOrder) {
    const army = draft.armies[armyId]
    if (!army) continue
    const owed = armyUpkeep(army, rules)
    const bucket = demand.get(army.owner) ?? {}
    for (const [key, amount] of Object.entries(owed)) {
      if (!amount) continue
      const resource = key as ResourceKey
      bucket[resource] = (bucket[resource] ?? 0) + amount
    }
    demand.set(army.owner, bucket)
  }

  for (const playerId of draft.playerOrder) {
    const player = draft.players[playerId]!
    if (!player.alive) continue

    const shortages: ResourceKey[] = []
    const owed = demand.get(playerId) ?? {}

    for (const [key, amount] of Object.entries(owed)) {
      if (!amount) continue
      const resource = key as ResourceKey
      const available = player.resources[resource]

      if (available < amount) {
        // Stocks stop at zero; the shortage flag is what the other phases react to.
        player.resources[resource] = 0
        shortages.push(resource)
      } else {
        player.resources[resource] = available - amount
      }
    }

    // Storage caps, applied after consumption so a full warehouse that is being
    // emptied does not waste this tick's intake.
    for (const [key, limit] of Object.entries(rules.storageLimits)) {
      if (limit === null) continue // money is uncapped (D6.8)
      const resource = key as ResourceKey
      const stock = player.resources[resource]
      if (stock > limit) {
        const wasted = stock - limit
        player.resources[resource] = limit
        // Once per game day, not once per hour: at high speed this would drown the log.
        if (draft.tick % rules.constants.ticksPerDay === 0) {
          emit(ctx.events, draft.tick, 'STORAGE_OVERFLOW', {
            playerId,
            resource,
            wasted,
            audience: [playerId],
          })
        }
      }
    }

    const previous = player.shortages
    const current = [...new Set(shortages)].sort()
    player.shortages = current

    // Report a shortage when it starts, not every hour it lasts — otherwise a long
    // oil crisis would produce one message per game hour.
    for (const resource of current) {
      if (previous.includes(resource)) continue
      emit(ctx.events, draft.tick, 'RESOURCE_SHORTAGE', {
        playerId,
        resource,
        audience: [playerId],
      })
    }
  }
}
