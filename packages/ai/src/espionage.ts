import { ONE, clampFixed, mulChain, quotFixed, type Fixed } from '@worldwar/shared'
import {
  buildingCostForLevel,
  spySalary,
  unitCount,
  type Command,
  type MapData,
  type PlayerId,
  type ProvinceId,
  type PublicView,
  type Rules,
  type SpyMission,
} from '@worldwar/core'
import { RESERVE_PERMILLE } from './economy'
import type { AiContext, Explanation } from './types'

/**
 * Spionage der KI (R-AI-09, D29.8, D29.12, T-M17-12).
 *
 * Drei Phasen, einmal je Spieltag im Strategietakt (`decide.ts`, zuletzt): erst prueft jeder
 * eigene Spion sein Ziel (Kriegsgegner fuer Aufklaerung und Sabotage, Sabotage nur sichtbar,
 * Gegenspion in die Hauptstadt bei Krieg oder Verstimmung), dann haelt eine Geldpruefung Budget
 * und Ruecklage ein und entlaesst noetigenfalls, dann wirbt sie hoechstens einen neuen Spion an.
 *
 * Der Geldertrag wird aus der Sicht nachgerechnet (Entscheid E2): der Runner baut die Sicht ohne
 * Regeln, `self.economy` fehlt also, und `phases/production.ts` gehoert nicht in diese Bahn.
 * `dailyMoneyIncome`/`dailyArmyMoneyUpkeep` sind ein Zwilling der Steuerformel; `espionage.test.ts`
 * haelt sie gegen `economyOverview` gleich (Block "Finanzen aus der Sicht").
 *
 * Debugtexte nennen Provinznamen, nie Spionkennungen (Entscheid E10, Befund M17-S1): der Wache
 * `text-keys.test.ts` prueft `\bs\d+\b` auf dem gerenderten Text, und eine Kennung wie `s2` waere
 * dort nicht von einer Provinzkennung zu unterscheiden.
 */

type ViewSpy = PublicView['espionage']['spies'][number]
type ViewProvince = PublicView['provinces'][number]

/** Ein eigener Spion und was dieser Zug mit ihm vorhat. */
interface Plan {
  spy: ViewSpy
  provinceId: ProvinceId
  mission: SpyMission
  action: 'keep' | 'reassign' | 'dismiss'
  explanation?: Explanation
}

const MISSION_NAMES: Readonly<Record<SpyMission, string>> = {
  intel: 'Aufklärer',
  economicSabotage: 'Wirtschaftssaboteur',
  militarySabotage: 'Militärsaboteur',
  counter: 'Gegenspion',
}
const isSabotage = (mission: SpyMission): boolean => mission === 'economicSabotage' || mission === 'militarySabotage'
/** Wer bei Geldnot oder Budgetueberschreitung zuerst geht (Entscheid E4). */
const DISMISS_RANK: Readonly<Record<SpyMission, number>> = {
  economicSabotage: 0,
  militarySabotage: 0,
  intel: 1,
  counter: 2,
}

/**
 * Zwilling von `phases/production.ts` (nur Geld) — auf der Sicht statt auf dem Zustand, weil der
 * Runner sie ohne Regeln baut. Aendert sich die Steuerformel im Kern, faellt `espionage.test.ts`
 * Block "Finanzen aus der Sicht" (F-a).
 */
export function dailyMoneyIncome(view: PublicView, rules: Rules): Fixed {
  if (!view.self.alive) return 0
  const c = rules.constants
  const penalty =
    view.self.capitalLostUntil !== null && view.tick < view.self.capitalLostUntil ? c.capitalLossProductionFactor : ONE
  const window = c.occupationPenaltyDays * c.ticksPerDay
  let scaled = 0
  for (const province of view.provinces) {
    if (province.owner !== view.playerId || province.stale) continue
    if (province.population === undefined || province.morale === undefined) continue
    const taxBase = Math.trunc(province.population / 1000) * c.taxPerThousandPopulationPerTick
    if (taxBase <= 0) continue
    const morale =
      c.productionMoraleFloor + mulChain([ONE - c.productionMoraleFloor, clampFixed(quotFixed(province.morale, 100_000), 0, ONE)])
    const population = clampFixed(quotFixed(province.population, 300_000), 500, 1500)
    const elapsed = province.occupiedSince === undefined ? window : view.tick - province.occupiedSince
    const occupation = elapsed >= window ? ONE : 500 + mulChain([500, quotFixed(elapsed, window)])
    scaled += taxBase * mulChain([morale, population, occupation, penalty])
  }
  return Math.round((scaled * c.ticksPerDay) / ONE)
}

/** Zwilling von `state/army.ts` `armyUpkeep`, nur Geld, auf der Sicht. */
export function dailyArmyMoneyUpkeep(view: PublicView, rules: Rules): Fixed {
  let perTick = 0
  for (const army of view.armies) {
    if (army.owner !== view.playerId) continue
    for (const stack of army.units ?? []) {
      const money = rules.units[stack.unitKey]?.upkeep.money ?? 0
      if (money) perTick += money * unitCount(stack, rules)
    }
  }
  return perTick * rules.constants.ticksPerDay
}

/** Hoechstens so viel Tagessold bindet die KI in Spionen (D29.7/D29.8). Gilt dem Sold, nicht dem Anwerbepreis. */
export function espionageBudget(view: PublicView, rules: Rules): Fixed {
  return Math.trunc((dailyMoneyIncome(view, rules) * rules.ai.espionageBudgetPermille) / 1000)
}

/** Bevoelkerung und Stadt-Eigenschaft aus der Karte — oeffentliche Geografie, kein Nebel. */
const mapCache = new WeakMap<MapData, Map<ProvinceId, { population: number; city: boolean }>>()
function mapValues(map: MapData): Map<ProvinceId, { population: number; city: boolean }> {
  const cached = mapCache.get(map)
  if (cached) return cached
  const values = new Map<ProvinceId, { population: number; city: boolean }>()
  for (const province of map.provinces) {
    values.set(province.id, { population: province.population, city: province.kind === 'city' })
  }
  mapCache.set(map, values)
  return values
}

/**
 * Die wertvollste Provinz einer der `enemies`, nach Bevoelkerung laut Karte absteigend, dann
 * Stadt vor Land, dann Kennung aufsteigend (Determinismus, Falle 1) — nie `localeCompare`.
 */
function bestTarget(context: AiContext, enemies: ReadonlySet<PlayerId>, visibleOnly: boolean): ViewProvince | null {
  const values = mapValues(context.map)
  const candidates = context.view.provinces.filter(
    (p) => p.owner !== null && enemies.has(p.owner) && (!visibleOnly || !p.stale),
  )
  if (candidates.length === 0) return null
  candidates.sort((a, b) => {
    const va = values.get(a.id) ?? { population: 0, city: false }
    const vb = values.get(b.id) ?? { population: 0, city: false }
    if (va.population !== vb.population) return vb.population - va.population
    if (va.city !== vb.city) return va.city ? -1 : 1
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
  return candidates[0]!
}

/**
 * Maechte, denen ich in diesem Zug schon Frieden angeboten oder ihn angenommen habe (Entscheid
 * E8), UND Maechte, denen ich an einem frueheren Tag Frieden angeboten habe und die noch nicht
 * geantwortet haben (Befund M17-S5, `view.outgoingOffers`).
 *
 * Ohne den zweiten Teil sah `espionageCommands` nur den heutigen Zug: ein Angebot von gestern,
 * das der Gegner heute annimmt, waere fuer die Spionage unsichtbar geblieben, bis morgen wieder
 * entschieden wird — und ein Saboteur haette in der Zwischenzeit gegen eine Macht gearbeitet, die
 * (aus meiner eigenen Sicht heraus) laengst auf Frieden zusteuert. `view.outgoingOffers` traegt
 * sich selbst ab (`phases/diplomacy.ts` wirft es nach `offerLifetime`), ein abgelehntes oder
 * abgelaufenes Angebot bindet hier also nichts mehr.
 *
 * **Gilt nur fuer Aufklaerung und Sabotage, nicht fuer den Gegenspion** (Befund M17-S8,
 * Nacharbeit): D29.8 entlaesst den Gegenspion „bei Kriegsende", nicht bei einem eigenen,
 * noch unbeantworteten Friedensangebot — ein Angebot ist ein Antrag, kein Ende, und solange
 * `view.relations[x].state === 'war'` bleibt, kann die Gegenseite weiterhin spionieren. Der
 * Aufrufer haelt deshalb den echten Kriegszustand (`warEnemies`) getrennt von der durch
 * `peaceBound` bereits verminderten Menge (`enemies`) und liest ausschliesslich `warEnemies`
 * fuer `counterReason`.
 */
function peaceBound(earlier: readonly Command[], view: PublicView, me: PlayerId): Set<PlayerId> {
  const bound = new Set<PlayerId>()
  for (const c of earlier) {
    if (c.type === 'DIPLOMACY' && c.playerId === me && (c.action === 'acceptPeace' || c.action === 'offerPeace')) {
      bound.add(c.targetPlayerId)
    }
  }
  for (const offer of view.outgoingOffers) {
    if (offer.kind === 'peace') bound.add(offer.to)
  }
  return bound
}

/**
 * Die Hauptstadt dieses Strategietakts (Befund M17-S9): `capitalCommands` laeuft in `decide.ts`
 * vor der Spionage und setzt bei Hauptstadtverlust noch im selben Zug ein `SET_CAPITAL` — die
 * Sicht selbst (`view.self.capitalProvinceId`) traegt das erst am naechsten Tag nach, weil der
 * Befehl hier nur gelesen, nie angewandt wird (wie `moneyCommittedBy`/`peaceBound`).
 */
function capitalIdFrom(earlier: readonly Command[], view: PublicView, me: PlayerId): ProvinceId | null {
  for (const c of earlier) {
    if (c.type === 'SET_CAPITAL' && c.playerId === me) return c.provinceId
  }
  return view.self.capitalProvinceId
}

/**
 * Was eigene Befehle desselben Zugs schon an Geld binden (Falle 5): der Bauauftrag, und seit der
 * Zusammenfuehrung mit der Diplomatiebahn (2026-09-25) auch der Handel, der im Strategietakt vor
 * der Spionage laeuft — ein Angebot legt `give` sofort in Treuhand, eine Annahme zahlt `want`
 * sofort. Dieselben drei Befehle zieht `ledgerAfter` (`provinceValue.ts`) fuer den Handel ab;
 * `RECRUIT_SPY` braucht dort keinen Abzug, weil die Spionage als letzte plant.
 */
function moneyCommittedBy(earlier: readonly Command[], context: AiContext, known: Map<ProvinceId, ViewProvince>): Fixed {
  const me = context.view.playerId
  let sum = 0
  for (const c of earlier) {
    if (c.playerId !== me) continue
    if (c.type === 'BUILD') {
      const rule = context.rules.buildings[c.building]
      if (!rule) continue
      const level = (known.get(c.provinceId)?.buildings?.[c.building] ?? 0) + 1
      sum += buildingCostForLevel(rule, level, context.rules.constants).money ?? 0
    } else if (c.type === 'OFFER_TRADE') {
      sum += c.give.resources.money ?? 0
    } else if (c.type === 'ACCEPT_TRADE') {
      const offer = context.view.tradeOffers.incoming.find((o) => o.id === c.offerId)
      sum += offer?.want.resources.money ?? 0
    }
  }
  return sum
}

const nameOf = (known: Map<ProvinceId, ViewProvince>, id: ProvinceId): string => known.get(id)?.name ?? id

function dismissExplanation(known: Map<ProvinceId, ViewProvince>, spy: ViewSpy, reason: string): Explanation {
  return {
    action: `Spionage: entlässt ${MISSION_NAMES[spy.mission]} in ${nameOf(known, spy.provinceId)}`,
    reason,
    score: 400,
    alternative: { action: 'Spion behalten', score: 100 },
  }
}

function reassign(
  plan: Plan,
  provinceId: ProvinceId,
  mission: SpyMission,
  reason: string,
  known: Map<ProvinceId, ViewProvince>,
): void {
  const alt = nameOf(known, plan.spy.provinceId)
  const neu = nameOf(known, provinceId)
  plan.action = 'reassign'
  plan.provinceId = provinceId
  plan.mission = mission
  plan.explanation = {
    action: `Spionage: setzt ${MISSION_NAMES[mission]} von ${alt} auf ${neu} um`,
    reason,
    score: 450,
    alternative: { action: 'Spion entlassen', score: 200 },
  }
}

/**
 * Die Spionagebefehle der KI fuer diesen Spieltag (R-AI-09, D29.8).
 *
 * `earlier` sind die Befehle, die derselbe Strategietakt schon beschlossen hat (Diplomatie,
 * Bau) — gelesen, nie angewandt: ein Friedensangebot desselben Zugs zaehlt schon als Frieden
 * (E8), ein Bauauftrag desselben Zugs mindert das verfuegbare Geld (Falle 5).
 */
export function espionageCommands(
  context: AiContext,
  explanations: Explanation[],
  earlier: readonly Command[] = [],
): Command[] {
  const { view, rules } = context
  const commands: Command[] = []
  if (!view.self.alive) return commands
  const me = view.playerId
  const known = new Map(view.provinces.map((p) => [p.id, p] as const))
  const alive = new Set(view.others.filter((o) => o.alive).map((o) => o.id))
  const peace = peaceBound(earlier, view, me)
  const warEnemies = new Set(
    Object.keys(view.relations)
      .sort()
      .filter((id) => view.relations[id]!.state === 'war' && alive.has(id)),
  )
  // Aufklaerung und Sabotage duerfen eine Macht nicht mehr als Ziel fuehren, der ich (oder deren
  // Angebot ich) schon Frieden angeboten habe — der Gegenspion liest stattdessen `warEnemies`
  // (Befund M17-S8, siehe `peaceBound`).
  const enemies = new Set([...warEnemies].filter((id) => !peace.has(id)))
  let grudge: { against: PlayerId; value: Fixed } | null = null
  for (const id of Object.keys(view.self.grievances).sort()) {
    const value = view.self.grievances[id]!
    if (alive.has(id) && (!grudge || value > grudge.value)) grudge = { against: id, value }
  }
  const threshold = rules.ai.espionageCounterGrievance
  const counterReason =
    warEnemies.size > 0
      ? `Krieg mit ${[...warEnemies].join(', ')}`
      : grudge && grudge.value >= threshold
        ? `Verstimmung ${grudge.value} gegen ${grudge.against}, Schwelle ${threshold}`
        : null
  // Die Hauptstadt dieses Zugs: liest `earlier` fuer ein SET_CAPITAL desselben Strategietakts
  // (`capitalCommands` laeuft davor in `decide.ts`) — sonst entliesse ein Hauptstadtverlust den
  // Gegenspion, statt ihn in dieselbe neue Hauptstadt umzusetzen (Befund M17-S9, Nacharbeit).
  const capitalId = capitalIdFrom(earlier, view, me)
  const capital = capitalId === null ? undefined : known.get(capitalId)
  const home = capital && capital.owner === me && !capital.stale ? capital : null
  const intelTarget = bestTarget(context, enemies, false)
  const sabotageTarget = bestTarget(context, enemies, true)

  const income = dailyMoneyIncome(view, rules)
  const upkeep = dailyArmyMoneyUpkeep(view, rules)
  // Dieselbe Formel wie `espionageBudget()` (Befund M17-S10, Nacharbeit): vorher stand die
  // Berechnung hier ein zweites Mal, ohne dass ein Test eine Abweichung zwischen beiden
  // Stellen haette erzwingen koennen (die Z4-Grenzwerttests leiten ihre Werte ueber
  // `espionageBudget()` her und vergleichen sie mit diesem Aufruf).
  const budget = espionageBudget(view, rules)
  const horizon = rules.ai.espionageMoneyHorizonDays
  const money = view.self.resources.money - moneyCommittedBy(earlier, context, known)
  const reserve = Math.trunc((view.self.resources.money * RESERVE_PERMILLE) / 1000)
  const acute = view.self.shortages.includes('money')

  // --- Phase 1: Zielpruefung je eigenem Spion, in Array-Reihenfolge -------------------------
  const plans: Plan[] = view.espionage.spies.map((spy) => ({
    spy,
    provinceId: spy.provinceId,
    mission: spy.mission,
    action: 'keep',
  }))

  for (const plan of plans) {
    const spy = plan.spy
    if (spy.mission === 'counter') {
      if (counterReason === null) {
        plan.action = 'dismiss'
        plan.explanation = dismissExplanation(known, spy, 'Krieg und Verstimmung vorbei')
        continue
      }
      const hasHomeCounter = plans.some(
        (p) => p !== plan && p.action !== 'dismiss' && p.mission === 'counter' && p.provinceId === home?.id,
      )
      if (home && spy.provinceId !== home.id && !hasHomeCounter) {
        reassign(plan, home.id, 'counter', `Hauptstadt ${home.name} ohne Gegenspion`, known)
        continue
      }
      const target = known.get(spy.provinceId)
      if (!target || target.owner !== me || target.stale) {
        plan.action = 'dismiss'
        plan.explanation = dismissExplanation(known, spy, 'Provinz nicht mehr eigen')
      }
      continue
    }

    const sabotage = isSabotage(spy.mission)
    const target = known.get(spy.provinceId)
    const valid = !!target && target.owner !== null && enemies.has(target.owner) && (!sabotage || !target.stale)
    if (valid) continue

    let why: string
    if (!target) why = 'Ziel unbekannt'
    else if (target.owner === me) why = 'eigene Provinz'
    else if (target.owner === null) why = 'herrenlos'
    else if (!enemies.has(target.owner)) why = `${target.owner} ist kein Kriegsgegner`
    else why = 'Ziel nur erinnert'

    const nextMission: SpyMission = sabotage ? 'economicSabotage' : 'intel'
    const next = sabotage ? sabotageTarget : intelTarget
    if (next && !(next.id === spy.provinceId && nextMission === spy.mission)) {
      reassign(plan, next.id, nextMission, `${nameOf(known, next.id)}: ${why}`, known)
    } else {
      plan.action = 'dismiss'
      plan.explanation = dismissExplanation(known, spy, `${why}, kein anderes Ziel`)
    }
  }

  // --- Phase 2: Geld — Budget und drohender Geldmangel ---------------------------------------
  const bound = (): Fixed =>
    plans.reduce((sum, p) => (p.action === 'dismiss' ? sum : sum + spySalary(rules.constants, p.mission)), 0)
  const projection = (salary: Fixed, cost: Fixed): Fixed => money - cost + horizon * (income - upkeep - bound() - salary)

  for (;;) {
    const salaries = bound()
    const threatened = acute || projection(0, 0) < 0
    if (!threatened && salaries <= budget) break
    const victim = plans
      .map((plan, index) => ({ plan, index }))
      .filter(({ plan }) => plan.action !== 'dismiss')
      .sort((a, b) => DISMISS_RANK[a.plan.mission] - DISMISS_RANK[b.plan.mission] || b.index - a.index)[0]?.plan
    if (!victim) break
    const reason = acute
      ? 'akuter Geldmangel: Unterhalt nicht mehr bezahlt'
      : threatened
        ? `drohender Geldmangel: Bestand ${money}, Tagesbilanz ${income - upkeep - salaries}, reicht keine ${horizon} Tage`
        : `Budget überschritten: Sold ${salaries} über ${budget} (${rules.ai.espionageBudgetPermille} ‰ von ${income})`
    victim.action = 'dismiss'
    victim.explanation = {
      action: `Spionage: entlässt ${MISSION_NAMES[victim.spy.mission]} in ${nameOf(known, victim.spy.provinceId)}`,
      reason,
      score: 400,
      alternative: { action: 'Spion behalten', score: 100 },
    }
  }

  // --- Phase 3: Befehle, dann hoechstens ein Anwerben -----------------------------------------
  for (const plan of plans) {
    if (plan.action === 'keep') continue
    if (plan.action === 'reassign') {
      commands.push({ type: 'REASSIGN_SPY', playerId: me, spyId: plan.spy.id, provinceId: plan.provinceId, mission: plan.mission })
    } else {
      commands.push({ type: 'DISMISS_SPY', playerId: me, spyId: plan.spy.id })
    }
    if (plan.explanation) explanations.push(plan.explanation)
  }

  const nonDismissed = (mission: SpyMission): boolean => plans.some((p) => p.action !== 'dismiss' && p.mission === mission)
  const wanted: { mission: SpyMission; target: ViewProvince; reason: string }[] = []
  if (counterReason && home && !nonDismissed('counter')) {
    wanted.push({ mission: 'counter', target: home, reason: counterReason })
  }
  if (intelTarget && !nonDismissed('intel')) {
    wanted.push({
      mission: 'intel',
      target: intelTarget,
      reason: `Kriegsgegner ${intelTarget.owner}: wertvollste bekannte Provinz (Bevölkerung laut Karte)`,
    })
  }
  if (sabotageTarget && !nonDismissed('economicSabotage')) {
    wanted.push({
      mission: 'economicSabotage',
      target: sabotageTarget,
      reason: `Kriegsgegner ${sabotageTarget.owner}: wertvollste sichtbare Provinz`,
    })
  }

  if ((acute || projection(0, 0) < 0) && wanted.length > 0) {
    explanations.push({
      action: 'Spionage: kein Anwerben',
      reason: `drohender Geldmangel: Bestand ${money}, Tagesbilanz ${income - upkeep - bound()}, reicht keine ${horizon} Tage`,
      score: 0,
    })
    return commands
  }

  for (const w of wanted) {
    const salary = spySalary(rules.constants, w.mission)
    const cost = rules.constants.spyRecruitCost
    const count = plans.filter((p) => p.action !== 'dismiss').length
    const problem =
      count >= rules.constants.maxSpiesPerPlayer
        ? `Obergrenze ${rules.constants.maxSpiesPerPlayer} erreicht`
        : bound() + salary > budget
          ? `Sold ${salary} überstiege das Budget ${budget} (gebunden ${bound()})`
          : money - cost < reserve
            ? `Anwerben ${cost} bräche die Rücklage ${reserve} an (verfügbar ${money})`
            : projection(salary, cost) < 0
              ? `drohender Geldmangel nach dem Anwerben (Horizont ${horizon} Tage)`
              : null
    if (problem) {
      explanations.push({ action: `Spionage: kein ${MISSION_NAMES[w.mission]} angeworben`, reason: problem, score: 0 })
      continue
    }
    commands.push({ type: 'RECRUIT_SPY', playerId: me, provinceId: w.target.id, mission: w.mission })
    explanations.push({
      action: `Spionage: wirbt ${MISSION_NAMES[w.mission]} für ${w.target.name} an`,
      reason: `${w.reason}; Sold ${salary} von Budget ${budget}`,
      score: 500,
      alternative: { action: 'Geld für Bau und Truppen behalten', score: 300 },
    })
    break
  }

  return commands
}
