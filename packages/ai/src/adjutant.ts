import {
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
 *
 * **The rule is the one that does not strip a province (T-M40-10, D30.4).** The first version
 * covered an attacked neighbour from any province and pursued retreating enemies. Measured on
 * the world map over three seeds and two set-ups it held 79.7 % of the province-days a garrison
 * held and lost ten provinces without a battle — provinces it had emptied itself: battles there
 * last one to three ticks, a march 25 to 113, so cover arrives after the fight and the province
 * it left falls. The pursuit did harm in every run that gave it a chance. What is left: a
 * defending army moves only when another own army stays behind in its province, and an army on
 * `aggressive` never marches by itself. Measured without harm (D30.9); whether it helps is not
 * shown — and if the measurement ever fails, the rule is withdrawn, not tightened.
 *
 * A command the core accepts can still do harm, and the M40 review found two (T-M40-09):
 * a march into the province of a power at peace is a surprise attack — war without
 * declaration, reputation, grievance — even in passing, because `MOVE_ARMY` does not check
 * ownership and `planRoute` takes the cheapest way whoever owns it (finding K2); and an army
 * that had just retreated was sent back into the same battle the hour its cooldown ended
 * (finding H1). Hence: one land stage into own land, and a rest after every march.
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

/**
 * How long an army does nothing on its own after a march or a retreat: five game days
 * (T-M40-09, D30.4, R-UNIT-09/AK7).
 *
 * Counted from `deployDelayUntil`, which the core already sets when an order is given, when the
 * army departs and — doubled — when it retreats: state, so a loaded game rests the same way. The
 * attack cooldown of a retreat (24 ticks in the shipped rules) ends long before; it used to be
 * the only thing that held a retreated army back, and it held it back for exactly one day.
 * Battles on the world map last a median of one to three ticks, the longest measured 27, so five
 * days means "not the same battle". The state has no arrival tick, so the rest is measured from
 * the departure, not from the arrival: a march that uses up the five days leaves no rest after it.
 * A march the player orders himself therefore takes the army out of the automatic (`garrisonFollowUp`,
 * T-M40-14).
 */
export const ADJUTANT_REST_TICKS = 120

/**
 * What a player's own order carries with it: an army that acts on its own goes to `garrison` in
 * the same tick. The interface sends it with the order; the loop never calls this.
 *
 *  - **Stop** (T-M40-11, finding H2 of the M40 review): otherwise the adjutant marched the army
 *    off again the next tick.
 *  - **March** (T-M40-14, finding H-A of the second review): the rest counts from the departure,
 *    and the state has no arrival tick. A march of 117 ticks left six ticks of rest after arrival,
 *    one of 122 or more left none — and the adjutant sent on the army the player had just placed.
 *    The player put it there; that is what `garrison` says. An arrival tick in the state would
 *    have cost a schema step and new golden masters for the same case.
 *
 * Returns null for every other army and every other order.
 */
export function garrisonFollowUp(state: GameState, command: Command): Command | null {
  if (command.type !== 'STOP_ARMY' && command.type !== 'MOVE_ARMY') return null
  const army = state.armies[command.armyId]
  if (!army || army.owner !== command.playerId || army.stance !== 'defensive') return null
  return { type: 'SET_STANCE', playerId: command.playerId, armyId: command.armyId, stance: 'garrison' }
}

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

/**
 * Standing, landed and with land units: an army that holds its province.
 *
 * A pure air or naval formation does not hold a province — `occupation` counts land forces — and
 * MOVE_ARMY refuses aircraft outside an airfield (R-UNIT-08).
 */
function holdsGround(army: Army, rules: Rules): boolean {
  return army.path.length === 0 && !army.embarked && army.units.length > 0 && needsTransport(army, rules)
}

/** Holds its ground, defends, free to attack, rested, and not commanded this tick. */
function canActOnItsOwn(state: GameState, army: Army, rules: Rules, held: ReadonlySet<ArmyId>): boolean {
  return (
    army.stance === 'defensive' &&
    holdsGround(army, rules) &&
    state.tick >= army.cannotAttackUntil &&
    // Rested (T-M40-09, finding H1): not within five game days of its last march or retreat.
    state.tick >= army.deployDelayUntil + ADJUTANT_REST_TICKS &&
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
  const ready = own.filter((army) => canActOnItsOwn(state, army, ctx.rules, held))
  if (ready.length === 0 || !atWarWithAnyone(state, playerId)) return []

  // How many own armies stay put in each province this tick. An army the player orders to march this
  // tick does not — and neither does one he orders to retreat: the core checks no battle for that, and
  // `phases/retreat.ts` moves every army on `retreat` out in this very tick (T-M40-15, finding M-A of
  // the second review; the adjutant sent the other army away and the province stood empty). A defender
  // may leave only while at least one other stays (D30.4).
  const leaving = new Set<ArmyId>()
  for (const command of given) {
    if (command.playerId !== playerId) continue
    if (command.type === 'MOVE_ARMY' || (command.type === 'SET_STANCE' && command.stance === 'retreat')) {
      leaving.add(command.armyId)
    }
  }
  const staying = new Map<ProvinceId, number>()
  for (const army of own) {
    if (!holdsGround(army, ctx.rules) || leaving.has(army.id)) continue
    staying.set(army.locationProvinceId, (staying.get(army.locationProvinceId) ?? 0) + 1)
  }
  const mayLeave = (army: Army): boolean => (staying.get(army.locationProvinceId) ?? 0) >= 2

  // A view per tick per human is not cheap (T-M16-02). Without a war, without a defender that
  // may act, or when every such defender stands alone, there is nothing to decide (D30.3).
  if (!ready.some(mayLeave)) return []

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

  // The targets, all of them own provinces (R-UNIT-09/AK1, AK7): first those with a visible enemy
  // in them, then those with no own army that border a province with a visible enemy — before the
  // enemy walks in, because `occupation` hands an empty province over in the tick of the entry.
  const occupied = new Set(own.map((army) => army.locationProvinceId))
  const attacked: ProvinceId[] = []
  const exposed: ProvinceId[] = []
  for (const province of view.provinces) {
    if (province.owner !== playerId) continue
    if (hostile.has(province.id)) attacked.push(province.id)
    else if (!occupied.has(province.id) && province.neighbors.some((neighbour) => hostile.has(neighbour))) {
      exposed.push(province.id)
    }
  }

  const commands: Command[] = []
  const taken = new Set<ArmyId>()
  for (const target of [...attacked, ...exposed]) {
    if (heading.has(target)) continue
    const army = earliestArrival(
      state,
      ctx,
      target,
      eligible.filter(
        (candidate) => !taken.has(candidate.id) && mayLeave(candidate) && bordersOnLand(candidate.locationProvinceId, target),
      ),
    )
    if (!army) continue
    taken.add(army.id)
    heading.add(target)
    staying.set(army.locationProvinceId, (staying.get(army.locationProvinceId) ?? 0) - 1)
    commands.push({ type: 'MOVE_ARMY', playerId, armyId: army.id, targetProvinceId: target })
  }

  return commands
}

/**
 * The candidate that arrives first, by the same route planning `MOVE_ARMY` uses; a tie
 * goes to the smaller id (string order, as in `armyOrder`). No route, no candidate — the
 * core would refuse the order with `NO_PATH`.
 *
 * And no route of more than one stage (T-M40-09, finding K2): the target borders the army's
 * province, but `planRoute` takes the cheapest way whoever owns it, and a detour through a
 * foreign province is a surprise attack on its owner. One land stage straight into the target
 * or nothing — the core stays as it is.
 */
function earliestArrival(state: GameState, ctx: AdjutantContext, target: ProvinceId, candidates: readonly Army[]): Army | null {
  let best: { army: Army; arrival: number } | null = null
  for (const army of candidates) {
    const route = planRoute(state, army, target, ctx.map, ctx.rules)
    if (!route || route.path.length !== 1 || route.path[0] !== target) continue
    if (!best || route.arrivalTick < best.arrival || (route.arrivalTick === best.arrival && army.id < best.army.id)) {
      best = { army, arrival: route.arrivalTick }
    }
  }
  return best?.army ?? null
}
