import { createRng } from '@worldwar/shared'
import { createMarket } from '../rules/market'
import type { Rules } from '../rules/types'
import {
  SCHEMA_VERSION,
  type AiMemory,
  type Difficulty,
  type GameState,
  type MapData,
  type Player,
  type PlayerId,
  type PlayerKind,
  type Province,
  type ProvinceId,
  type VictoryCondition,
} from './types'
import type { Fixed } from '@worldwar/shared'

export interface PlayerConfig {
  name: string
  kind: PlayerKind
  nation: string
  color: string
  difficulty?: Difficulty
  /** Openly displayed if not 1000 (R-AI-02). */
  aiBonusMultiplier?: Fixed
}

export interface GameConfig {
  seed: number
  mapId: string
  rulesId: string
  players: readonly PlayerConfig[]
  victory: {
    condition: VictoryCondition
    pointsShareToWin: Fixed
    dayLimit: number | null
  }
}

export interface RuleContext {
  map: MapData
  rules: Rules
}

/** Relation key for a pair of players, order-independent. */
export function relationKey(a: PlayerId, b: PlayerId): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

/**
 * Build the starting state of a match.
 *
 * Everything is derived from (config, map, rules) — same input, same state, always.
 * Player ids are positional (`p1`, `p2`, …) rather than generated, so a replay from
 * the same configuration refers to the same players.
 */
export function createInitialState(config: GameConfig, ctx: RuleContext): GameState {
  const { map, rules } = ctx

  if (config.players.length < 2) {
    throw new Error('Eine Partie braucht mindestens zwei Spieler.')
  }
  if (config.players.length > map.startPositions.length) {
    throw new Error(
      `Die Karte "${map.id}" bietet ${map.startPositions.length} Startaufstellungen, ` +
        `gefordert sind ${config.players.length}.`,
    )
  }

  const players: Record<PlayerId, Player> = {}
  const playerOrder: PlayerId[] = []
  const ownerByProvince = new Map<ProvinceId, PlayerId>()
  const ai: Record<PlayerId, AiMemory> = {}

  config.players.forEach((entry, index) => {
    const id = `p${index + 1}`
    const start = map.startPositions.find((position) => position.nation === entry.nation)
    if (!start) {
      throw new Error(`Die Karte "${map.id}" kennt keine Startaufstellung für die Nation "${entry.nation}".`)
    }

    for (const provinceId of start.provinces) {
      if (ownerByProvince.has(provinceId)) {
        throw new Error(`Provinz "${provinceId}" ist zwei Startaufstellungen zugeordnet.`)
      }
      ownerByProvince.set(provinceId, id)
    }

    players[id] = {
      id,
      name: entry.name,
      nation: entry.nation,
      color: entry.color,
      kind: entry.kind,
      difficulty: entry.difficulty ?? null,
      aiBonusMultiplier: entry.aiBonusMultiplier ?? 1000,
      resources: { ...rules.startResources },
      capitalProvinceId: start.capital,
      capitalLostUntil: null,
      capitalMovedAtTick: null,
      shortages: [],
      alive: true,
      score: 0,
      reputation: 1000,
      intel: {},
    }
    playerOrder.push(id)

    if (entry.kind === 'ai') {
      ai[id] = {
        lastStrategicTick: -1,
        lastOperationalTick: -1,
        targetPriority: {},
        assignments: {},
        buildShare: 600,
      }
    }
  })

  // Neighbours and sea links come from the edge list, so both descriptions of the map
  // can never disagree (the map validator enforces the same in T-M2-01).
  const landNeighbors = new Map<ProvinceId, Set<ProvinceId>>()
  const seaNeighbors = new Map<ProvinceId, Set<ProvinceId>>()
  for (const province of map.provinces) {
    landNeighbors.set(province.id, new Set())
    seaNeighbors.set(province.id, new Set())
  }
  for (const edge of map.edges) {
    const target = edge.kind === 'sea' ? seaNeighbors : landNeighbors
    target.get(edge.a)?.add(edge.b)
    target.get(edge.b)?.add(edge.a)
  }

  const provinces: Record<ProvinceId, Province> = {}
  for (const source of map.provinces) {
    provinces[source.id] = {
      id: source.id,
      name: source.name,
      owner: ownerByProvince.get(source.id) ?? null,
      kind: source.kind,
      terrain: source.terrain,
      coastal: source.coastal,
      neighbors: [...(landNeighbors.get(source.id) ?? [])].sort(),
      seaLinks: [...(seaNeighbors.get(source.id) ?? [])].sort(),
      population: source.population,
      morale: rules.constants.startMorale,
      targetMorale: rules.constants.startMorale,
      deposits: { ...source.deposits },
      buildings: {},
      buildQueue: [],
      recruitQueue: [],
      occupiedSince: null,
      productionRemainder: {},
    }
  }

  const provinceOrder = map.provinces.map((province) => province.id).sort()

  const relations: GameState['diplomacy']['relations'] = {}
  for (let i = 0; i < playerOrder.length; i++) {
    for (let j = i + 1; j < playerOrder.length; j++) {
      relations[relationKey(playerOrder[i]!, playerOrder[j]!)] = {
        state: 'peace',
        sinceTick: 0,
        warEffectiveAtTick: null,
        rightOfWay: false,
        sharedMap: false,
      }
    }
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    seed: config.seed,
    rng: createRng(config.seed),
    tick: 0,
    mapId: config.mapId,
    rulesId: config.rulesId,
    players,
    playerOrder,
    provinces,
    provinceOrder,
    armies: {},
    armyOrder: [],
    diplomacy: { relations, offers: [] },
    market: createMarket(rules),
    ai,
    battles: [],
    eventLog: [
      {
        type: 'GAME_STARTED',
        tick: 0,
        severity: 'info',
        audience: [],
        // Der Beginn geht jeden an, der mitspielt (T-M15-01).
        concerns: playerOrder,
        mapId: map.id,
        playerCount: config.players.length,
      },
    ],
    victory: {
      condition: config.victory.condition,
      pointsShareToWin: config.victory.pointsShareToWin,
      dayLimit: config.victory.dayLimit,
      winner: null,
      endedAtTick: null,
    },
    nextIds: { army: 1, battle: 1, order: 1 },
  }
}
