import { createRng } from '@worldwar/shared'
import { createMarket } from '../rules/market'
import type { Rules } from '../rules/types'
import {
  GOAL_KEYS,
  SCHEMA_VERSION,
  type AiMemory,
  type Difficulty,
  type GameState,
  type GoalKey,
  type MapData,
  type Player,
  type PlayerId,
  type PlayerKind,
  type Province,
  type ProvinceId,
  type Relation,
  type Tick,
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
 * Laesst `grantor` die Truppen von `guest` durch sein Gebiet? (M17, D29.1, R-DIP-08)
 *
 * **Diese Funktion, `sharesMap` und `passageEndsAtTick` sind die einzigen Leserinnen der
 * gerichteten Felder, `setPassage`, `expirePassage` und `setMapShared` die einzigen Schreiber
 * einer Richtung**
 * (seit T-M17-04; wer beide Richtungen zugleich setzt oder loescht, muss es nicht wissen).
 * Der Grund ist nicht Ordnungsliebe: der Schluessel einer Beziehung ist sortiert (`a|b` mit
 * a < b), die Frage ist es nicht. Wer `relation.aGrantsPassage` an einer beliebigen Stelle
 * im Spiel liest, muss dort wissen, ob die fragende Macht gerade `a` oder `b` ist — und
 * genau dieser Fehler war bis Stufe 3 in den Zustand eingebaut: `rightOfWay` galt fuer
 * beide Richtungen, und wer „gewaehrte", durfte selbst folgenlos ins Land des anderen
 * (Befund B2, `PROBLEME.md` 2026-09-13).
 *
 * Steht eine Kuendigungsfrist (`revokeRightOfWay`, T-M17-04), gilt das Recht **bis** dahin
 * (`tick < ends`): im Tick der Frist selbst ist der Gast schon ein Eindringling.
 */
export function grantsPassage(state: GameState, grantor: PlayerId, guest: PlayerId): boolean {
  const relation = state.diplomacy.relations[relationKey(grantor, guest)]
  if (!relation) return false
  const granted = grantor < guest ? relation.aGrantsPassage : relation.bGrantsPassage
  if (!granted) return false
  const ends = grantor < guest ? relation.aPassageEndsAtTick : relation.bPassageEndsAtTick
  return ends === null || state.tick < ends
}

/** Zeigt `owner` seine Karte an `viewer`? (M17, D29.1) — gerichtet wie `grantsPassage`. */
export function sharesMap(state: GameState, owner: PlayerId, viewer: PlayerId): boolean {
  const relation = state.diplomacy.relations[relationKey(owner, viewer)]
  if (!relation) return false
  return owner < viewer ? relation.aSharesMap : relation.bSharesMap
}

/**
 * Bis zu welchem Tick laesst `grantor` den `guest` noch durch? `null` heisst: unbefristet —
 * oder gar nicht; wer das unterscheiden muss, fragt vorher `grantsPassage` (T-M17-04).
 *
 * Die dritte Leserin der gerichteten Felder, aus demselben Grund wie die beiden oben: die
 * Frage ist gerichtet, der Schluessel nicht. Ein abgelaufenes Recht meldet `null`, auch wenn
 * die Phase es im selben Tick noch nicht aufgeraeumt hat — die Sicht soll keine Frist zeigen,
 * die schon vorbei ist.
 */
export function passageEndsAtTick(state: GameState, grantor: PlayerId, guest: PlayerId): Tick | null {
  if (!grantsPassage(state, grantor, guest)) return null
  const relation = state.diplomacy.relations[relationKey(grantor, guest)]!
  return grantor < guest ? relation.aPassageEndsAtTick : relation.bPassageEndsAtTick
}

/**
 * Schreibt die **eine** Richtung `grantor → guest` des Durchmarschs (T-M17-04, R-DIP-08).
 *
 * Steht neben den Leserinnen, weil der Schreiber dasselbe wissen muss wie sie — welche Haelfte
 * des Schluessels wer ist. Bis T-M17-04 setzte jeder Schreiber beide Richtungen und musste es
 * nicht wissen; jetzt ist genau diese Stelle der Unterschied zwischen „ich lasse dich durch"
 * und „ich darf zu dir" (Befund B1). `endsAtTick` ist die Kuendigungsfrist, `null` unbefristet.
 */
export function setPassage(
  relation: Relation,
  grantor: PlayerId,
  guest: PlayerId,
  granted: boolean,
  endsAtTick: Tick | null = null,
): void {
  const ends = granted ? endsAtTick : null
  if (grantor < guest) {
    relation.aGrantsPassage = granted
    relation.aPassageEndsAtTick = ends
  } else {
    relation.bGrantsPassage = granted
    relation.bPassageEndsAtTick = ends
  }
}

/**
 * Raeumt die Richtung `grantor → guest` ab, wenn ihre Kuendigungsfrist bis `tick` abgelaufen
 * ist (T-M17-04, D29.3 Schritt 2). `passageEndsAtTick` kann das nicht beantworten — sie meldet
 * ein abgelaufenes Recht absichtlich als `null`.
 */
export function expirePassage(relation: Relation, grantor: PlayerId, guest: PlayerId, tick: Tick): void {
  const ends = grantor < guest ? relation.aPassageEndsAtTick : relation.bPassageEndsAtTick
  if (ends !== null && tick >= ends) setPassage(relation, grantor, guest, false)
}

/** Schreibt die eine Richtung `owner → viewer` der Kartenfreigabe (T-M17-04, R-DIP-08/AK6). */
export function setMapShared(relation: Relation, owner: PlayerId, viewer: PlayerId, shared: boolean): void {
  if (owner < viewer) relation.aSharesMap = shared
  else relation.bSharesMap = shared
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
  // Jede Macht beginnt mit vier offenen Zwischenzielen (R-GAME-08, D31.1).
  const goals: GameState['goals'] = {}

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

    const open = {} as Record<GoalKey, number | null>
    for (const goal of GOAL_KEYS) open[goal] = null
    goals[id] = open

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
        aGrantsPassage: false,
        bGrantsPassage: false,
        aPassageEndsAtTick: null,
        bPassageEndsAtTick: null,
        aSharesMap: false,
        bSharesMap: false,
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
    diplomacy: { relations, offers: [], tradeOffers: [], grievances: {} },
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
    goals,
    espionage: { spies: [], reveals: [] },
    nextIds: { army: 1, battle: 1, order: 1, spy: 1, offer: 1 },
  }
}
