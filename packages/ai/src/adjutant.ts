import {
  armyHp,
  needsTransport,
  planRoute,
  publicView,
  relationKey,
  type Army,
  type ArmyId,
  type Command,
  type GameState,
  type MapData,
  type PlayerId,
  type ProvinceId,
  type PublicView,
  type Rules,
  type Stance,
  type VisibleArmy,
} from '@worldwar/core'

/**
 * The adjutant: a human's stance becomes an order (T-M40-03, D30.2–D30.5, R-UNIT-09).
 *
 * Until M40 three stances existed and one of them did anything: `aggressive` was read
 * nowhere, `defensive` only in combat. "Attack and defence carry themselves out" means
 * movement, not combat — when a neighbouring province is attacked, nobody marches there.
 *
 * Three decisions shape this file, and each is a correction to the first draft:
 *
 *  - **It lives in `packages/ai`, not in the core.** It produces commands, which is the
 *    same kind of code as the AI, and the import direction (shared ← core ← ai ← apps)
 *    forbids the core from knowing it. Its commands go through the same checks as a click
 *    (R-AI-01 in both directions).
 *  - **It reads the state, never events.** The event log is not part of the hash, and a
 *    loaded game begins without the previous tick's events: an adjutant that listened to
 *    `ARMY_INTRUDED` would give different orders after loading (R-AI-07/AK1).
 *  - **It commands human armies only.** After recruitment and after every retreat an AI
 *    army stands on `defensive`; commanding those would change every AI match — tournament,
 *    parameter sweep and AK-1 — and the AI already has its own threat model.
 *
 * What the owner may not know stays unknown: foreign armies and provinces come only from
 * `publicView` (R-DIP-04). Own armies are read from the state — own knowledge, and the
 * view does not carry the attack cooldown.
 */

export interface AdjutantOptions {
  /**
   * The commands already given for this tick, by a human or a script (T-M40-08).
   *
   * Every army they name is left alone (D30.2). A march among them counts as an army on its
   * way, so nobody else is sent to the same province: until T-M40-08 the adjutant was handed
   * only the names of the armies, read `heading` from the state before the tick, and sent a
   * second army after the one the player had just ordered there (finding M1 of the M40 review).
   */
  given?: readonly Command[]
  /**
   * Where the view comes from. In the game always `publicView`; a test hands in a view
   * with less in it, to show that the adjutant decides from nothing else (R-DIP-04).
   */
  viewOf?: (state: GameState, playerId: PlayerId) => PublicView
}

interface AdjutantContext {
  map: MapData
  rules: Rules
}

/** Stances that act on their own (D30.4). `garrison` is the opt-out, `retreat` a one-off order. */
const AUTOMATIC_STANCES: ReadonlySet<Stance> = new Set<Stance>(['defensive', 'aggressive'])

/**
 * The adjutant's orders for this tick: every living human power, in `playerOrder`.
 *
 * Deterministic from the state alone — in lockstep (D28.5) both machines compute it
 * themselves, and only the humans' own orders travel.
 */
export function adjutantCommands(
  state: GameState,
  ctx: AdjutantContext,
  options: AdjutantOptions = {},
): Command[] {
  const given = options.given ?? []
  const held = armiesNamedIn(given)
  const commands: Command[] = []
  for (const playerId of state.playerOrder) {
    const player = state.players[playerId]
    if (!player || player.kind !== 'human' || !player.alive) continue
    commands.push(...ordersFor(state, playerId, ctx, { given, held, viewOf: options.viewOf ?? publicView }))
  }
  return commands
}

/** Armies a command names — the orders given this tick take precedence over the adjutant (D30.2). */
function armiesNamedIn(commands: readonly Command[]): Set<ArmyId> {
  const ids = new Set<ArmyId>()
  for (const command of commands) {
    if ('armyId' in command) ids.add(command.armyId)
    if ('armyIds' in command) for (const id of command.armyIds) ids.add(id)
  }
  return ids
}

/** Standing, landed, free to attack, with land units, and not commanded by the human this tick. */
function canActOnItsOwn(state: GameState, army: Army, rules: Rules, held: ReadonlySet<ArmyId>): boolean {
  return (
    army.path.length === 0 &&
    !army.embarked &&
    state.tick >= army.cannotAttackUntil &&
    army.units.length > 0 &&
    // A pure air or naval formation does not cover a province by marching there, and
    // MOVE_ARMY refuses aircraft outside an airfield (R-UNIT-08) — no refused orders.
    needsTransport(army, rules) &&
    !held.has(army.id)
  )
}

function atWarWithAnyone(state: GameState, playerId: PlayerId): boolean {
  return state.playerOrder.some(
    (other) => other !== playerId && state.diplomacy.relations[relationKey(playerId, other)]?.state === 'war',
  )
}

function ordersFor(
  state: GameState,
  playerId: PlayerId,
  ctx: AdjutantContext,
  tick: {
    given: readonly Command[]
    held: ReadonlySet<ArmyId>
    viewOf: (state: GameState, playerId: PlayerId) => PublicView
  },
): Command[] {
  const { given, held } = tick

  const own: Army[] = []
  for (const id of state.armyOrder) {
    const army = state.armies[id]
    if (army && army.owner === playerId) own.push(army)
  }
  const ready = own.filter((army) => AUTOMATIC_STANCES.has(army.stance) && canActOnItsOwn(state, army, ctx.rules, held))

  // A view per tick per human is not cheap (T-M16-02). Without a war or without an army
  // that acts on its own there is nothing to decide, so none is built (D30.3).
  if (ready.length === 0 || !atWarWithAnyone(state, playerId)) return []

  const view = tick.viewOf(state, playerId)
  const provinces = new Map(view.provinces.map((province) => [province.id, province]))

  const hostile = new Map<ProvinceId, VisibleArmy[]>()
  for (const army of view.armies) {
    if (army.owner === playerId || view.relations[army.owner]?.state !== 'war') continue
    hostile.set(army.provinceId, [...(hostile.get(army.provinceId) ?? []), army])
  }

  // Where an own army is already heading — or was ordered to this very tick (finding M1): nobody
  // else is sent there.
  const heading = new Set<ProvinceId>()
  for (const army of own) {
    const destination = army.path[army.path.length - 1]
    if (destination !== undefined) heading.add(destination)
  }
  for (const command of given) {
    if (command.type === 'MOVE_ARMY' && command.playerId === playerId) heading.add(command.targetProvinceId)
  }

  const isOwn = (provinceId: ProvinceId): boolean => provinces.get(provinceId)?.owner === playerId
  // Over land only: `neighbors`, not `seaLinks` (D30.4).
  const bordersOnLand = (from: ProvinceId, to: ProvinceId): boolean => provinces.get(from)?.neighbors.includes(to) ?? false
  const eligible = ready.filter((army) => isOwn(army.locationProvinceId) && !hostile.has(army.locationProvinceId))

  const commands: Command[] = []
  const taken = new Set<ArmyId>()

  // Defence covers (R-UNIT-09/AK1): an own province with a visible enemy in it, towards
  // which no own army is marching, gets at most one army from a bordering own province.
  for (const province of view.provinces) {
    if (province.owner !== playerId || !hostile.has(province.id) || heading.has(province.id)) continue
    const army = earliestArrival(
      state,
      ctx,
      province.id,
      eligible.filter(
        (candidate) =>
          candidate.stance === 'defensive' && !taken.has(candidate.id) && bordersOnLand(candidate.locationProvinceId, province.id),
      ),
    )
    if (!army) continue
    taken.add(army.id)
    heading.add(province.id)
    commands.push({ type: 'MOVE_ARMY', playerId, armyId: army.id, targetProvinceId: province.id })
  }

  // Attack pursues (R-UNIT-09/AK2): a province bordering on land with a visible enemy that
  // has just fallen back — its attack cooldown is running, which the view shows since
  // T-M40-04 — gets at most one pursuer that is at least as strong. Measured against
  // everything hostile visible there, not the retreating army alone: that is what she will
  // fight on arrival.
  for (const province of view.provinces) {
    const there = hostile.get(province.id)
    if (!there || !there.some((army) => army.retreating === true) || heading.has(province.id)) continue
    const enemyStrength = there.reduce((sum, army) => sum + army.strength, 0)
    const army = earliestArrival(
      state,
      ctx,
      province.id,
      eligible.filter(
        (candidate) =>
          candidate.stance === 'aggressive' &&
          !taken.has(candidate.id) &&
          bordersOnLand(candidate.locationProvinceId, province.id) &&
          armyHp(candidate) >= enemyStrength,
      ),
    )
    if (!army) continue
    taken.add(army.id)
    heading.add(province.id)
    commands.push({ type: 'MOVE_ARMY', playerId, armyId: army.id, targetProvinceId: province.id })
  }

  return commands
}

/**
 * The candidate that arrives first, by the same route planning `MOVE_ARMY` uses; a tie
 * goes to the smaller id (string order, as in `armyOrder`). No route, no candidate — the
 * core would refuse the order with `NO_PATH`.
 */
function earliestArrival(state: GameState, ctx: AdjutantContext, target: ProvinceId, candidates: readonly Army[]): Army | null {
  let best: { army: Army; arrival: number } | null = null
  for (const army of candidates) {
    const route = planRoute(state, army, target, ctx.map, ctx.rules)
    if (!route) continue
    if (!best || route.arrivalTick < best.arrival || (route.arrivalTick === best.arrival && army.id < best.army.id)) {
      best = { army, arrival: route.arrivalTick }
    }
  }
  return best?.army ?? null
}
