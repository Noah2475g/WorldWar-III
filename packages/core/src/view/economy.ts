import { ONE, type Fixed } from '@worldwar/shared'
import { armyUpkeep } from '../state/army'
import { capitalPenalty, provinceYieldScaled } from '../phases/production'
import type { Rules } from '../rules/types'
import { RESOURCE_KEYS, type GameState, type PlayerId, type ResourceKey } from '../state/types'

/**
 * The economy overview (R-ECON-06, T-M10-04).
 *
 * Stock, production per day, consumption per day and the balance between them — the
 * four numbers a player steers by. Production is not sampled from the last tick but
 * computed from the same function the production phase uses, so the figure on screen
 * is the figure the simulation will actually produce; a sampled rate would swing with
 * the fixed-point carry and read as noise.
 *
 * "Per day" rather than per tick because that is the unit players think in: a factory
 * that takes two days to pay for itself is a decision, 0.04 per hour is a puzzle.
 */

export interface ResourceFlow {
  /** What is in store right now. */
  stock: Fixed
  /** What the current provinces yield over one game day. */
  production: Fixed
  /** What the current armies eat over one game day. */
  consumption: Fixed
  /** production − consumption. Negative means the stock is running down. */
  balance: Fixed
  /**
   * Was in laufenden Bau- und Aushebungsauftraegen steckt (T-M12-10, R-ECON-06).
   *
   * Der Playtest fragte "wohin gehen meine Rohstoffe", und die Uebersicht konnte es
   * nicht sagen: sie fuehrte allein den Armeeunterhalt, und der steht ohne Armee auf
   * null. Bau- und Aushebungskosten sind aber keine Rate, sondern Einmalzahlungen — sie
   * gehoeren deshalb NICHT in `consumption` und nicht in `balance`, die als Tagesrate
   * gegen den echten Zuwachs geprueft sind.
   *
   * Was hier steht, ist bereits bezahlt und noch nicht geliefert. Das ist die ehrliche
   * Antwort auf die Frage, und sie ist eine reine Funktion ueber den Zustand: kein
   * Hauptbuch, keine Schemastufe, keine Abhaengigkeit vom Ringspeicher des Protokolls.
   */
  committed: Fixed
}

export type EconomyOverview = Record<ResourceKey, ResourceFlow>

/**
 * The daily balance sheet of one player.
 *
 * Pure and read-only: it takes a state and gives numbers back, so the interface can
 * ask for it whenever a panel opens without the simulation having to remember
 * anything.
 */
export function economyOverview(state: GameState, playerId: PlayerId, rules: Rules): EconomyOverview {
  const player = state.players[playerId]
  const ticksPerDay = rules.constants.ticksPerDay

  const production: Partial<Record<ResourceKey, number>> = {}
  const consumption: Partial<Record<ResourceKey, number>> = {}
  const committed: Partial<Record<ResourceKey, number>> = {}

  if (player?.alive) {
    const penalty = capitalPenalty(player, state.tick, rules)

    for (const provinceId of state.provinceOrder) {
      const province = state.provinces[provinceId]
      if (!province || province.owner !== playerId) continue

      for (const [key, scaled] of Object.entries(provinceYieldScaled(province, state.tick, penalty, rules))) {
        const resource = key as ResourceKey
        production[resource] = (production[resource] ?? 0) + scaled
      }

      // Was in dieser Provinz gerade entsteht — bezahlt, noch nicht da. Nur eigene
      // Auftraege: ein Auftrag des Voreigentuemers liefert nicht an uns.
      for (const order of province.buildQueue) {
        if (order.ownerAtStart !== playerId) continue
        for (const [key, amount] of Object.entries(rules.buildings[order.building]?.cost ?? {})) {
          const resource = key as ResourceKey
          committed[resource] = (committed[resource] ?? 0) + (amount ?? 0)
        }
      }
      for (const order of province.recruitQueue) {
        if (order.ownerAtStart !== playerId) continue
        for (const [key, amount] of Object.entries(rules.units[order.unitKey]?.cost ?? {})) {
          const resource = key as ResourceKey
          // eslint-disable-next-line no-restricted-syntax -- unit cost x batch size, plain integers (wie commands/recruit.ts:72)
          committed[resource] = (committed[resource] ?? 0) + (amount ?? 0) * order.count
        }
      }
    }

    for (const armyId of state.armyOrder) {
      const army = state.armies[armyId]
      if (!army || army.owner !== playerId) continue

      for (const [key, amount] of Object.entries(armyUpkeep(army, rules))) {
        if (!amount) continue
        const resource = key as ResourceKey
        consumption[resource] = (consumption[resource] ?? 0) + amount
      }
    }
  }

  const overview = {} as EconomyOverview
  for (const resource of RESOURCE_KEYS) {
    // Production is scaled twice over (deposit x factor), consumption only once.
    // eslint-disable-next-line no-restricted-syntax -- per-tick fixed-point yield x hours per day, then down one scale
    const perDay = Math.round(((production[resource] ?? 0) * ticksPerDay) / ONE)
    // eslint-disable-next-line no-restricted-syntax -- per-tick upkeep x hours per day, plain integers
    const eaten = (consumption[resource] ?? 0) * ticksPerDay

    overview[resource] = {
      stock: player?.resources[resource] ?? 0,
      production: perDay,
      consumption: eaten,
      balance: perDay - eaten,
      committed: committed[resource] ?? 0,
    }
  }

  return overview
}
