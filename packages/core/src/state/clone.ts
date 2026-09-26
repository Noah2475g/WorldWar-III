import type { Army, GameState, Player, Province, TradeBundle } from './types'

/**
 * Fast state copy for the tick loop (T-M8-03).
 *
 * `structuredClone` walks every value generically and was the single largest cost per
 * tick. This does the same job with the shape known in advance: arrays of plain values
 * are copied with slice, records are rebuilt field by field, and nothing is inspected
 * at runtime.
 *
 * It is deliberately explicit rather than clever. A generic deep copy would silently
 * keep working when a new field is added; this one has to be extended, which is the
 * point — a field that is not copied here would be shared between two states and
 * mutate the "previous" one, breaking determinism in a way that is very hard to find.
 */

function cloneProvince(province: Province): Province {
  return {
    id: province.id,
    name: province.name,
    owner: province.owner,
    kind: province.kind,
    terrain: province.terrain,
    coastal: province.coastal,
    neighbors: province.neighbors,
    seaLinks: province.seaLinks,
    population: province.population,
    morale: province.morale,
    targetMorale: province.targetMorale,
    deposits: { ...province.deposits },
    buildings: { ...province.buildings },
    buildQueue: province.buildQueue.map((order) => ({ ...order })),
    recruitQueue: province.recruitQueue.map((order) => ({ ...order })),
    occupiedSince: province.occupiedSince,
    productionRemainder: { ...province.productionRemainder },
  }
}

function cloneArmy(army: Army): Army {
  return {
    id: army.id,
    owner: army.owner,
    name: army.name,
    locationProvinceId: army.locationProvinceId,
    units: army.units.map((stack) => ({ unitKey: stack.unitKey, hpTotal: stack.hpTotal })),
    path: army.path.slice(),
    arrivalTick: army.arrivalTick,
    departureTick: army.departureTick,
    deployDelayUntil: army.deployDelayUntil,
    stance: army.stance,
    embarked: army.embarked,
    cannotAttackUntil: army.cannotAttackUntil,
    bombardTarget: army.bombardTarget,
    holdFire: army.holdFire,
  }
}

function clonePlayer(player: Player): Player {
  const intel: Player['intel'] = {}
  for (const key of Object.keys(player.intel)) {
    const entry = player.intel[key]!
    intel[key] = { tick: entry.tick, owner: entry.owner, strength: entry.strength }
  }

  return {
    id: player.id,
    name: player.name,
    nation: player.nation,
    color: player.color,
    kind: player.kind,
    difficulty: player.difficulty,
    aiBonusMultiplier: player.aiBonusMultiplier,
    resources: { ...player.resources },
    capitalProvinceId: player.capitalProvinceId,
    capitalLostUntil: player.capitalLostUntil,
    capitalMovedAtTick: player.capitalMovedAtTick,
    shortages: player.shortages.slice(),
    alive: player.alive,
    score: player.score,
    reputation: player.reputation,
    intel,
  }
}

/**
 * Ein Handelsbuendel, zwei Ebenen tief (M17, D29.1).
 *
 * `resources` ist ein Record und `provinces` ein Array — beide wuerden bei einem flachen
 * Spread zwischen zwei Zustaenden geteilt. Die Treuhand aendert genau diese Mengen, also
 * waere der Fehler nicht theoretisch.
 */
function cloneBundle(bundle: TradeBundle): TradeBundle {
  return { resources: { ...bundle.resources }, provinces: bundle.provinces.slice() }
}

export function cloneState(state: GameState): GameState {
  const provinces: Record<string, Province> = {}
  for (const id of state.provinceOrder) provinces[id] = cloneProvince(state.provinces[id]!)

  const armies: Record<string, Army> = {}
  for (const id of state.armyOrder) armies[id] = cloneArmy(state.armies[id]!)

  const players: Record<string, Player> = {}
  for (const id of state.playerOrder) players[id] = clonePlayer(state.players[id]!)

  const relations: GameState['diplomacy']['relations'] = {}
  for (const key of Object.keys(state.diplomacy.relations)) {
    relations[key] = { ...state.diplomacy.relations[key]! }
  }

  // Zwei Ebenen, also zwei Schleifen. Ein Spread waere hier eine geteilte Referenz auf
  // die inneren Records — und damit ein Determinismusfehler mit Ansage: der "vorherige"
  // Zustand aenderte sich mit, und der Golden-Master faende es erst Wochen spaeter.
  const grievances: GameState['diplomacy']['grievances'] = {}
  for (const key of Object.keys(state.diplomacy.grievances)) {
    grievances[key] = { ...state.diplomacy.grievances[key]! }
  }

  // Dieselben zwei Ebenen bei den Zwischenzielen (T-M35-03): Macht -> Ziel -> Tag.
  const goals: GameState['goals'] = {}
  for (const key of Object.keys(state.goals)) {
    goals[key] = { ...state.goals[key]! }
  }

  const ai: GameState['ai'] = {}
  for (const key of Object.keys(state.ai)) {
    const memory = state.ai[key]!
    ai[key] = {
      ...memory,
      targetPriority: { ...memory.targetPriority },
      assignments: { ...memory.assignments },
    }
  }

  return {
    schemaVersion: state.schemaVersion,
    seed: state.seed,
    rng: { s0: state.rng.s0, s1: state.rng.s1, s2: state.rng.s2, s3: state.rng.s3 },
    tick: state.tick,
    mapId: state.mapId,
    rulesId: state.rulesId,
    players,
    playerOrder: state.playerOrder.slice(),
    provinces,
    provinceOrder: state.provinceOrder.slice(),
    armies,
    armyOrder: state.armyOrder.slice(),
    diplomacy: {
      relations,
      offers: state.diplomacy.offers.map((offer) => ({ ...offer })),
      // Jedes Angebot mit beiden Buendeln: ein Spread liesse `give.resources` geteilt.
      tradeOffers: state.diplomacy.tradeOffers.map((offer) => ({
        ...offer,
        give: cloneBundle(offer.give),
        want: cloneBundle(offer.want),
      })),
      grievances,
    },
    market: {
      prices: { ...state.market.prices },
      tickDemand: { ...state.market.tickDemand },
    },
    ai,
    battles: state.battles.map((battle) => ({
      ...battle,
      sides: battle.sides.map((side) => side.slice()),
    })),
    eventLog: state.eventLog.slice(),
    victory: { ...state.victory },
    goals,
    // Elementweise, nicht `slice()`: die Eintraege selbst werden geaendert (Auftrag umsetzen,
    // Ausgang eintragen), und geteilte Objekte in zwei Zustaenden sind ein Determinismusfehler.
    espionage: {
      spies: state.espionage.spies.map((spy) => ({ ...spy })),
      reveals: state.espionage.reveals.map((reveal) => ({ ...reveal })),
    },
    nextIds: { ...state.nextIds },
  }
}
