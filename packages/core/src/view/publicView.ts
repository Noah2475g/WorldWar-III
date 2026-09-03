import { armyHp } from '../state/army'
import { relationKey } from '../state/create'
import type {
  ArmyId,
  BuildingKey,
  DiplomaticState,
  GameState,
  PlayerId,
  ProvinceId,
  ResourceKey,
  Stance,
  Tick,
} from '../state/types'
import type { Fixed } from '@worldwar/shared'

/**
 * What one player may see (R-DIP-04, T-M6-02).
 *
 * This is the only thing that leaves the simulation towards a player — the interface
 * and the AI both receive it and nothing else. Two consequences follow, and both are
 * the point:
 *
 *  - The fog of war is real. A player cannot read the full state out of the interface,
 *    out of a save file, or out of a network packet, because it never gets there.
 *  - The AI provably cannot cheat: it decides from the same view a human would have
 *    (R-AI-01).
 */

export interface VisibleProvince {
  id: ProvinceId
  name: string
  owner: PlayerId | null
  kind: 'city' | 'rural'
  terrain: string
  coastal: boolean
  neighbors: readonly ProvinceId[]
  seaLinks: readonly ProvinceId[]
  /** Only for provinces the player owns. */
  morale?: Fixed
  population?: Fixed
  deposits?: Partial<Record<ResourceKey, Fixed>>
  buildings?: Partial<Record<BuildingKey, number>>
  buildQueueLength?: number
  /** True when this is remembered rather than currently observed. */
  stale: boolean
  /** Tick the information dates from. */
  asOfTick: Tick
}

export interface VisibleArmy {
  id: ArmyId
  owner: PlayerId
  provinceId: ProvinceId
  /** Own armies show their exact composition; foreign ones only a strength estimate. */
  units?: { unitKey: string; hpTotal: Fixed }[]
  strength: Fixed
  stance?: Stance
  path?: ProvinceId[]
  arrivalTick?: Tick | null
}

export interface PublicView {
  tick: Tick
  playerId: PlayerId
  self: {
    name: string
    nation: string
    resources: Record<ResourceKey, Fixed>
    shortages: readonly ResourceKey[]
    capitalProvinceId: ProvinceId | null
    score: number
    reputation: Fixed
    aiBonusMultiplier: Fixed
  }
  others: { id: PlayerId; name: string; nation: string; color: string; alive: boolean; score: number }[]
  relations: Record<PlayerId, { state: DiplomaticState; rightOfWay: boolean; sharedMap: boolean }>
  provinces: VisibleProvince[]
  armies: VisibleArmy[]
  marketPrices: Record<ResourceKey, Fixed>
  victory: { condition: string; winner: PlayerId | null }
}

/** Provinces the player can currently observe. */
export function visibleProvinces(state: GameState, playerId: PlayerId): Set<ProvinceId> {
  const visible = new Set<ProvinceId>()

  const allies = new Set<PlayerId>()
  for (const other of state.playerOrder) {
    if (other === playerId) continue
    const relation = state.diplomacy.relations[relationKey(playerId, other)]
    if (relation?.sharedMap || relation?.state === 'alliance') allies.add(other)
  }

  for (const id of state.provinceOrder) {
    const province = state.provinces[id]!
    if (province.owner === playerId || (province.owner && allies.has(province.owner))) {
      visible.add(id)
      // Own provinces see their immediate surroundings.
      for (const neighbour of [...province.neighbors, ...province.seaLinks]) visible.add(neighbour)
    }
  }

  for (const armyId of state.armyOrder) {
    const army = state.armies[armyId]!
    if (army.owner !== playerId && !allies.has(army.owner)) continue
    visible.add(army.locationProvinceId)
    const province = state.provinces[army.locationProvinceId]
    for (const neighbour of province?.neighbors ?? []) visible.add(neighbour)
  }

  return visible
}

/** Builds the filtered view. Never returns anything the player may not know. */
export function publicView(state: GameState, playerId: PlayerId): PublicView {
  const player = state.players[playerId]
  if (!player) throw new Error(`Unbekannter Spieler: ${playerId}`)

  const visible = visibleProvinces(state, playerId)

  const provinces: VisibleProvince[] = []
  for (const id of state.provinceOrder) {
    const province = state.provinces[id]!
    const own = province.owner === playerId

    if (visible.has(id)) {
      provinces.push({
        id,
        name: province.name,
        owner: province.owner,
        kind: province.kind,
        terrain: province.terrain,
        coastal: province.coastal,
        neighbors: province.neighbors,
        seaLinks: province.seaLinks,
        stale: false,
        asOfTick: state.tick,
        ...(own
          ? {
              morale: province.morale,
              population: province.population,
              deposits: { ...province.deposits },
              buildings: { ...province.buildings },
              buildQueueLength: province.buildQueue.length,
            }
          : {}),
      })
      continue
    }

    // Not visible: fall back to what the player remembers, if anything.
    const remembered = player.intel[id]
    if (remembered) {
      provinces.push({
        id,
        name: province.name,
        owner: remembered.owner,
        kind: province.kind,
        terrain: province.terrain,
        coastal: province.coastal,
        neighbors: province.neighbors,
        seaLinks: province.seaLinks,
        stale: true,
        asOfTick: remembered.tick,
      })
    }
  }

  const armies: VisibleArmy[] = []
  for (const armyId of state.armyOrder) {
    const army = state.armies[armyId]!
    const own = army.owner === playerId
    if (!own && !visible.has(army.locationProvinceId)) continue

    armies.push({
      id: army.id,
      owner: army.owner,
      provinceId: army.locationProvinceId,
      strength: armyHp(army),
      ...(own
        ? {
            units: army.units.map((stack) => ({ ...stack })),
            stance: army.stance,
            path: [...army.path],
            arrivalTick: army.arrivalTick,
          }
        : {}),
    })
  }

  const relations: PublicView['relations'] = {}
  for (const other of state.playerOrder) {
    if (other === playerId) continue
    const relation = state.diplomacy.relations[relationKey(playerId, other)]
    if (!relation) continue
    relations[other] = {
      state: relation.state,
      rightOfWay: relation.rightOfWay,
      sharedMap: relation.sharedMap,
    }
  }

  return {
    tick: state.tick,
    playerId,
    self: {
      name: player.name,
      nation: player.nation,
      resources: { ...player.resources },
      shortages: [...player.shortages],
      capitalProvinceId: player.capitalProvinceId,
      score: player.score,
      reputation: player.reputation,
      aiBonusMultiplier: player.aiBonusMultiplier,
    },
    others: state.playerOrder
      .filter((id) => id !== playerId)
      .map((id) => {
        const other = state.players[id]!
        return { id, name: other.name, nation: other.nation, color: other.color, alive: other.alive, score: other.score }
      }),
    relations,
    provinces,
    armies,
    marketPrices: { ...state.market.prices },
    victory: { condition: state.victory.condition, winner: state.victory.winner },
  }
}
