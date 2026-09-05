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
import type { Rules } from '../rules/types'
import { economyOverview, type EconomyOverview } from './economy'

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
  /**
   * What is being built here, when it started and when it is finished (R-UI-09).
   *
   * Only for own provinces, and only when the view was asked for with the rules: a
   * progress bar is a fine thing right until it tells the player what an opponent is
   * building. The start tick is part of it — a bar needs both ends, and the first
   * version of this field left it out on the grounds that "a display needs the end,
   * not the paperwork", which turned out to be exactly wrong.
   */
  buildQueue?: { building: BuildingKey; startedTick: Tick; completesAtTick: Tick }[]
  /** The same for levies being raised. */
  recruitQueue?: { unitKey: string; count: number; startedTick: Tick; completesAtTick: Tick }[]
  /**
   * Where morale is heading. The current figure alone cannot say whether a province is
   * settling down or coming apart, which is the one thing the player wants to know.
   */
  moraleTarget?: Fixed
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
  /** When the march began — a progress bar needs both ends of the stretch (R-UI-09). */
  departureTick?: Tick | null
}

export interface PublicView {
  tick: Tick
  playerId: PlayerId
  self: {
    name: string
    nation: string
    /**
     * Ist der Spieler noch im Spiel? (T-M14-10, Befund N4)
     *
     * Der Abschlussdialog haengt an `victory.winner`, und den setzt der Kern erst, wenn
     * genau eine Macht uebrig ist. Scheidet der Mensch als einer von acht aus, bleibt
     * `winner` null: das Spiel tickt weiter, er hat keine Provinz, keine Armee und kein
     * Wort dazu. Die Oberflaeche konnte es nicht einmal wissen.
     */
    alive: boolean
    resources: Record<ResourceKey, Fixed>
    shortages: readonly ResourceKey[]
    capitalProvinceId: ProvinceId | null
    score: number
    reputation: Fixed
    aiBonusMultiplier: Fixed
    /**
     * Stock, production, consumption and balance per resource (R-ECON-06).
     *
     * Only present when the caller passed the rules — the AI does not need it, and
     * computing it walks every province.
     */
    economy?: EconomyOverview
  }
  others: { id: PlayerId; name: string; nation: string; color: string; alive: boolean; score: number }[]
  relations: Record<PlayerId, { state: DiplomaticState; rightOfWay: boolean; sharedMap: boolean }>
  provinces: VisibleProvince[]
  armies: VisibleArmy[]
  /**
   * Fighting the player can see, for the combat symbol on the map and the alerts
   * (R-UI-12, R-UI-14). Only in provinces they observe, and only with the rules — a
   * battle in a province behind the fog is not their news.
   */
  battles?: { provinceId: ProvinceId; startedTick: Tick }[]
  marketPrices: Record<ResourceKey, Fixed>
  /**
   * The victory condition, its winner — and the share of points it takes to win
   * (R-UI-13). Without the threshold the interface can show a score but not how far
   * away the end of the game is.
   */
  victory: { condition: string; winner: PlayerId | null; pointsShareToWin?: number }
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
export function publicView(state: GameState, playerId: PlayerId, rules?: Rules): PublicView {
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
              // Only with the rules: the AI asks for this view every tick and reads
              // none of it, so it should not pay for it either (D18.2).
              ...(rules
                ? {
                    buildQueue: province.buildQueue.map((order) => ({
                      building: order.building,
                      startedTick: order.startedTick,
                      completesAtTick: order.completesAtTick,
                    })),
                    recruitQueue: province.recruitQueue.map((order) => ({
                      unitKey: order.unitKey,
                      count: order.count,
                      startedTick: order.startedTick,
                      completesAtTick: order.completesAtTick,
                    })),
                    moraleTarget: province.targetMorale,
                  }
                : {}),
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
            departureTick: army.departureTick,
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
      alive: player.alive,
      resources: { ...player.resources },
      shortages: [...player.shortages],
      capitalProvinceId: player.capitalProvinceId,
      score: player.score,
      reputation: player.reputation,
      aiBonusMultiplier: player.aiBonusMultiplier,
      ...(rules ? { economy: economyOverview(state, playerId, rules) } : {}),
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
    ...(rules
      ? {
          battles: state.battles
            .filter((battle) => visible.has(battle.provinceId))
            .map((battle) => ({ provinceId: battle.provinceId, startedTick: battle.startedTick })),
        }
      : {}),
    marketPrices: { ...state.market.prices },
    victory: {
      condition: state.victory.condition,
      winner: state.victory.winner,
      ...(rules ? { pointsShareToWin: state.victory.pointsShareToWin } : {}),
    },
  }
}
