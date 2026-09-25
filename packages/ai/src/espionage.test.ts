import { describe, expect, it } from 'vitest'
import {
  canApply,
  createInitialState,
  economyOverview,
  publicView,
  relationKey,
  runTicks,
  buildingCostForLevel,
  spySalary,
  type Command,
  type GameConfig,
  type GameState,
  type Rules,
  type SpyMission,
} from '@worldwar/core'
import { TEST_RULES, placeArmy, smallWorld } from '@worldwar/testkit'
import { espionageCommands, dailyMoneyIncome, dailyArmyMoneyUpkeep, espionageBudget } from './espionage'
import { decide, emptyMemory } from './decide'
import { commandsForTick } from './loop'
import { storeMemories } from './runner'
import type { AiContext, Explanation } from './types'

/**
 * T-M17-12 (D29.8, D29.12, R-AI-09): die KI-Spionage.
 *
 * Echte Zustaende statt handgebauter Sichten (Entscheid E9): die Sicht entsteht mit
 * `publicView(state, 'p2')` aus einem `createInitialState` der Testwelt. So bleibt der Test beim
 * Zusammenfuehren mit m17-a typsicher, und jeder Befehl laesst sich mit `canApply` gegen denselben
 * Zustand pruefen (Z7).
 */

const map = smallWorld()
const FEIND = 'p1'
const ME = 'p2'
const NACHBAR = 'p3'
const CONFIG: GameConfig = {
  seed: 1812,
  mapId: 'testworld',
  rulesId: 'default',
  players: [
    { name: 'Feind', kind: 'ai', nation: 'Nordland', color: '#0f62bc', difficulty: 'normal' },
    { name: 'Ich', kind: 'ai', nation: 'Ostmark', color: '#b03a2e', difficulty: 'normal' },
    { name: 'Nachbar', kind: 'ai', nation: 'Sueden', color: '#2e7d32', difficulty: 'normal' },
  ],
  victory: { condition: 'points', pointsShareToWin: 900, dayLimit: null },
}
const withAi = (patch: Partial<Rules['ai']>): Rules => ({ ...TEST_RULES, ai: { ...TEST_RULES.ai, ...patch } })

interface Lage {
  krieg?: boolean
  verstimmung?: number
  budgetPermille?: number
  geld?: number
  spione?: { id?: string; provinceId: string; mission: SpyMission }[]
  mutate?: (state: GameState) => void
}

function lage(o: Lage = {}) {
  const rules = withAi({ espionageBudgetPermille: o.budgetPermille ?? TEST_RULES.ai.espionageBudgetPermille })
  const state = createInitialState(CONFIG, { map, rules })
  state.tick = 10 * 24 + 5
  state.nextIds.spy = 101
  state.provinces['s2']!.owner = FEIND
  state.provinces['i2']!.owner = FEIND
  state.provinces['m1']!.owner = NACHBAR
  state.players[ME]!.intel['n1'] = { tick: 24, owner: FEIND, strength: 0 }
  if (o.krieg) state.diplomacy.relations[relationKey(FEIND, ME)]!.state = 'war'
  if (o.verstimmung !== undefined) state.diplomacy.grievances[ME] = { [NACHBAR]: o.verstimmung }
  if (o.geld !== undefined) state.players[ME]!.resources.money = o.geld
  for (const s of o.spione ?? []) {
    state.espionage.spies.push({
      id: s.id ?? `s${state.nextIds.spy++}`,
      owner: ME,
      provinceId: s.provinceId,
      mission: s.mission,
      recruitedTick: 0,
      assignedTick: 0,
      lastRunTick: null,
      lastOutcome: null,
    })
  }
  o.mutate?.(state)
  const view = publicView(state, ME)
  const context: AiContext = { view, memory: emptyMemory(600), rules, map, difficulty: rules.ai.difficulties.normal }
  return { state, rules, view, context }
}

/** Entscheiden, jeden Befehl gegen denselben Zustand pruefen (Z7), jede Handlung begruendet (Z6). */
function entscheide(l: ReturnType<typeof lage>, earlier: Command[] = []) {
  const explanations: Explanation[] = []
  const commands = espionageCommands(l.context, explanations, earlier)
  const phaseCtx = { map, rules: l.rules, commands: [], events: [] }
  for (const c of commands) expect(canApply(l.state, c, phaseCtx), JSON.stringify(c)).toEqual({ ok: true })
  begruendet(commands, explanations)
  return { commands, explanations, kurz: commands.map(kurz) }
}

const kurz = (c: Command): string =>
  c.type === 'RECRUIT_SPY'
    ? `anwerben:${c.mission}@${c.provinceId}`
    : c.type === 'REASSIGN_SPY'
      ? `umsetzen:${c.spyId}->${c.mission}@${c.provinceId}`
      : c.type === 'DISMISS_SPY'
        ? `entlassen:${c.spyId}`
        : c.type

const HANDLUNG = /^Spionage: (wirbt|setzt|entlässt) /
function begruendet(commands: Command[], explanations: Explanation[]) {
  const handlungen = explanations.filter((e) => HANDLUNG.test(e.action))
  expect(handlungen).toHaveLength(commands.length)
  for (const e of handlungen) {
    expect(e.reason.length).toBeGreaterThan(5)
    expect(e.alternative?.action.length ?? 0).toBeGreaterThan(0)
    expect(`${e.action} ${e.reason}`).not.toMatch(/\bs\d+\b/)
  }
}

describe('Vorbedingung der Testlage', () => {
  it('p2 sieht s2, i2 und m1 frisch und n1 nur aus der Erinnerung', () => {
    const { view } = lage()
    const byId = new Map(view.provinces.map((p) => [p.id, p]))
    expect(byId.get('s2')?.owner).toBe(FEIND)
    expect(byId.get('s2')?.stale).toBe(false)
    expect(byId.get('i2')?.owner).toBe(FEIND)
    expect(byId.get('i2')?.stale).toBe(false)
    expect(byId.get('m1')?.owner).toBe(NACHBAR)
    expect(byId.get('m1')?.stale).toBe(false)
    expect(byId.get('n1')?.owner).toBe(FEIND)
    expect(byId.get('n1')?.stale).toBe(true)
    expect(view.self.capitalProvinceId).toBe('o1')
    expect(dailyMoneyIncome(view, TEST_RULES)).toBeGreaterThan(0)
    expect(view.armies).toHaveLength(0)
  })
})

describe('Z1 Gegenspion bei Krieg oder Verstimmung (D29.8, R-AI-09)', () => {
  it('wirbt im Krieg einen Gegenspion fuer die Hauptstadt an', () => {
    const l = lage({ krieg: true })
    const { kurz, explanations } = entscheide(l)
    expect(kurz).toEqual(['anwerben:counter@o1'])
    expect(explanations.some((e) => e.reason.includes('Krieg'))).toBe(true)
  })

  it('wirbt bei Verstimmung ab der Schwelle an, auch ohne Krieg', () => {
    const l = lage({ verstimmung: TEST_RULES.ai.espionageCounterGrievance })
    const { kurz, explanations } = entscheide(l)
    expect(kurz).toEqual(['anwerben:counter@o1'])
    expect(explanations.some((e) => e.reason.includes('Verstimmung'))).toBe(true)
  })

  it('wirbt unter der Schwelle und ohne Krieg nichts an', () => {
    const l = lage({ verstimmung: TEST_RULES.ai.espionageCounterGrievance - 1 })
    const { kurz } = entscheide(l)
    expect(kurz).toEqual([])
  })

  it('setzt einen Gegenspion ausserhalb der Hauptstadt in die Hauptstadt um', () => {
    const l = lage({ krieg: true, spione: [{ provinceId: 'o3', mission: 'counter' }] })
    const { kurz } = entscheide(l)
    expect(kurz).toEqual(['umsetzen:s101->counter@o1'])
  })

  it('entlaesst den Gegenspion, wenn Krieg und Verstimmung vorbei sind', () => {
    const l = lage({ spione: [{ provinceId: 'o1', mission: 'counter' }] })
    const { kurz, explanations } = entscheide(l)
    expect(kurz).toEqual(['entlassen:s101'])
    expect(explanations.some((e) => e.reason.includes('vorbei'))).toBe(true)
  })

  it('wirbt keinen zweiten Gegenspion an und setzt ihn nicht auf sich selbst um', () => {
    const l = lage({ krieg: true, spione: [{ provinceId: 'o1', mission: 'counter' }], budgetPermille: 150 })
    expect(espionageBudget(l.view, l.rules)).toBeLessThan(
      spySalary(l.rules.constants, 'counter') + spySalary(l.rules.constants, 'intel'),
    )
    const { kurz, explanations } = entscheide(l)
    expect(kurz).toEqual([])
    expect(
      explanations.some((e) => e.action === 'Spionage: kein Aufklärer angeworben' && e.reason.includes('Budget')),
    ).toBe(true)
  })

  it('ohne eigene Hauptstadt kein Gegenspion', () => {
    const l = lage({
      krieg: true,
      budgetPermille: 1000,
      mutate: (s) => {
        s.players[ME]!.capitalProvinceId = null
      },
    })
    const { commands, kurz } = entscheide(l)
    expect(commands.some((c) => c.type === 'RECRUIT_SPY' && c.mission === 'counter')).toBe(false)
    expect(kurz).toEqual(['anwerben:intel@n1'])
  })

  it('eine einzige Enttarnung loest den Gegenspion aus', () => {
    expect(TEST_RULES.constants.grievanceOnSpyDetected).toBeGreaterThanOrEqual(TEST_RULES.ai.espionageCounterGrievance)
  })

  it('ein besiegter Kriegsgegner zaehlt nicht mehr als Kriegsgegner (Befund M17-S6)', () => {
    // Ohne den `alive.has(id)`-Filter im Kriegsgegner-Satz haelt die KI den Gegenspion mit der
    // Begruendung "Krieg mit p1" auch dann, wenn p1 laengst besiegt ist und `relations` das
    // (noch) nicht nachtraegt — relevant fuer lange Laeufe (T-M17-15), in denen Maechte sterben.
    const l = lage({
      krieg: true,
      spione: [{ provinceId: 'o1', mission: 'counter' }],
      mutate: (s) => {
        s.players[FEIND]!.alive = false
      },
    })
    const { kurz, explanations } = entscheide(l)
    expect(kurz).toEqual(['entlassen:s101'])
    expect(explanations.some((e) => e.reason.includes('vorbei'))).toBe(true)
  })

  it('setzt den Gegenspion bei Hauptstadtverlust noch im selben Zug in die neue Hauptstadt um, statt ihn zu entlassen (Befund M17-S9)', () => {
    // Die alte Hauptstadt (o1) ist gerade gefallen (`capitalProvinceId` schon null, wie
    // `occupation.ts` es beim Verlust setzt), s1 ist die einzige verbliebene eigene Stadt.
    // `capitalCommands` liefe in `decide.ts` davor und gaebe genau das SET_CAPITAL unten aus
    // (hier direkt als `earlier` gereicht, wie `entscheide()` es fuer jeden Vorschritt tut).
    // Ohne die Nacharbeit (`capitalIdFrom`) sieht `espionageCommands` die neue Hauptstadt nicht
    // (die Sicht traegt sie erst naechsten Tag nach) und entlaesst den Gegenspion, statt ihn
    // umzusetzen — am naechsten Tag wirbt die KI dann fuer den vollen Preis neu an.
    const l = lage({
      krieg: true,
      budgetPermille: 1000,
      spione: [{ provinceId: 'o1', mission: 'counter' }],
      mutate: (s) => {
        s.players[ME]!.capitalProvinceId = null
        s.provinces['o1']!.owner = FEIND
        s.provinces['s1']!.owner = ME
      },
    })
    const earlier: Command[] = [{ type: 'SET_CAPITAL', playerId: ME, provinceId: 's1' }]
    const { kurz } = entscheide(l, earlier)
    // Kein zweites Entlassen/Anwerben fuer den Gegenspion (er hat schon ein Ziel); der
    // Aufklaerer daneben wirbt unabhaengig davon an, weil vorher keiner da war.
    expect(kurz).toEqual(['umsetzen:s101->counter@s1', 'anwerben:intel@n1'])
  })

  it('wirbt fuer eine fremdbesetzte Hauptstadt keinen Gegenspion an (Befund M17-S3-Analog)', () => {
    // `capitalProvinceId` traegt noch die alte Hauptstadt, aber ihr Besitzer hat gewechselt —
    // der reachable Zweig von `home` (`capital.owner === me`, Befund eines adversarischen
    // Pruefers: bisher unbelegt). Der zweite Zweig (`!capital.stale` bei weiterhin eigenem
    // Besitz) ist unter der aktuellen Invariante nicht erreichbar: `capitalCommands.ts`
    // begruendet, dass eine eigene Provinz nie `stale` ist (sonst waere sie nicht mehr eigen).
    const l = lage({
      krieg: true,
      budgetPermille: 1000,
      mutate: (s) => {
        s.provinces['o1']!.owner = FEIND
      },
    })
    const { commands, kurz } = entscheide(l)
    expect(commands.some((c) => c.type === 'RECRUIT_SPY' && c.mission === 'counter')).toBe(false)
    expect(kurz).toEqual(['anwerben:intel@n1'])
  })
})

describe('Z2 Aufklaerung auf den Kriegsgegner', () => {
  it('klaert die wertvollste bekannte Provinz des Kriegsgegners auf, auch eine erinnerte', () => {
    const l = lage({ krieg: true, budgetPermille: 1000, spione: [{ provinceId: 'o1', mission: 'counter' }] })
    const { kurz } = entscheide(l)
    expect(kurz).toEqual(['anwerben:intel@n1'])
  })

  it('klaert im Frieden niemanden auf', () => {
    const l = lage({ verstimmung: 900, budgetPermille: 1000, spione: [{ provinceId: 'o1', mission: 'counter' }] })
    const { kurz } = entscheide(l)
    expect(kurz).toEqual([])
  })

  it('setzt einen Aufklaerer von einer Friedensmacht auf den Kriegsgegner um', () => {
    const l = lage({
      krieg: true,
      budgetPermille: 1000,
      spione: [
        { provinceId: 'o1', mission: 'counter' },
        { provinceId: 'm1', mission: 'intel' },
      ],
    })
    const { kurz } = entscheide(l)
    expect(kurz).toEqual(['umsetzen:s102->intel@n1', 'anwerben:economicSabotage@s2'])
  })

  it('entlaesst den Aufklaerer ohne Kriegsgegner (Kriegsende)', () => {
    const l = lage({ spione: [{ provinceId: 's2', mission: 'intel' }] })
    const { kurz } = entscheide(l)
    expect(kurz).toEqual(['entlassen:s101'])
  })

  it('laesst einen Aufklaerer auf gueltigem Ziel stehen', () => {
    const l = lage({
      krieg: true,
      budgetPermille: 1000,
      spione: [
        { provinceId: 'o1', mission: 'counter' },
        { provinceId: 's2', mission: 'intel' },
      ],
    })
    const { kurz } = entscheide(l)
    expect(kurz.some((k) => k.startsWith('umsetzen:s102->'))).toBe(false)
  })

  it('eine eroberte Provinz ist kein Ziel mehr', () => {
    const l = lage({
      krieg: true,
      budgetPermille: 1000,
      spione: [
        { provinceId: 'o1', mission: 'counter' },
        { provinceId: 's2', mission: 'intel' },
      ],
      mutate: (s) => {
        s.provinces['s2']!.owner = ME
      },
    })
    const { kurz } = entscheide(l)
    expect(kurz).toContain('umsetzen:s102->intel@n1')
  })
})

describe('Z3 Sabotage nie gegen eine Macht im Frieden', () => {
  it('sabotiert die wertvollste sichtbare Provinz des Kriegsgegners', () => {
    const l = lage({
      krieg: true,
      budgetPermille: 1000,
      spione: [
        { provinceId: 'o1', mission: 'counter' },
        { provinceId: 'n1', mission: 'intel' },
      ],
    })
    const { kurz } = entscheide(l)
    expect(kurz).toEqual(['anwerben:economicSabotage@s2'])
  })

  it('wirbt im Frieden nie einen Saboteur an, auch mit Verstimmung und vollem Budget', () => {
    const l = lage({ verstimmung: 1000, budgetPermille: 1000, spione: [{ provinceId: 'o1', mission: 'counter' }] })
    const { kurz } = entscheide(l)
    expect(kurz).toEqual([])
  })

  it('zieht einen Saboteur von einer Friedensmacht ab', () => {
    const l = lage({
      krieg: true,
      budgetPermille: 1000,
      spione: [
        { provinceId: 'o1', mission: 'counter' },
        { provinceId: 'n1', mission: 'intel' },
        { provinceId: 'm1', mission: 'economicSabotage' },
      ],
    })
    const { kurz } = entscheide(l)
    expect(kurz).toEqual(['umsetzen:s103->economicSabotage@s2'])
  })

  it('entlaesst den Saboteur, wenn es keinen Kriegsgegner mehr gibt', () => {
    const l = lage({
      verstimmung: 900,
      spione: [
        { provinceId: 'o1', mission: 'counter' },
        { provinceId: 's2', mission: 'economicSabotage' },
      ],
    })
    const { kurz } = entscheide(l)
    expect(kurz).toEqual(['entlassen:s102'])
  })

  it('nimmt die Sabotage im selben Zug zurueck, in dem sie Frieden annimmt, haelt aber den Gegenspion (Befund M17-S8)', () => {
    // Der Gegenspion bleibt: `relations[FEIND].state` ist in diesem Zug noch 'war' — ein
    // eigenes Friedensangebot oder dessen Annahme ist ein Antrag, kein Kriegsende (D29.8), und
    // die Gegenseite kann bis dahin weiterhin gegen mich spionieren.
    const l = lage({
      krieg: true,
      budgetPermille: 1000,
      spione: [
        { provinceId: 'o1', mission: 'counter' },
        { provinceId: 's2', mission: 'economicSabotage' },
      ],
    })
    const earlier: Command[] = [{ type: 'DIPLOMACY', playerId: ME, targetPlayerId: FEIND, action: 'acceptPeace' }]
    const { kurz } = entscheide(l, earlier)
    expect(kurz).toEqual(['entlassen:s102'])
    expect(kurz.some((k) => k.startsWith('anwerben:'))).toBe(false)
  })

  it('und ebenso, wenn sie Frieden anbietet — der Gegenspion bleibt (Befund M17-S8)', () => {
    const l = lage({
      krieg: true,
      budgetPermille: 1000,
      spione: [
        { provinceId: 'o1', mission: 'counter' },
        { provinceId: 's2', mission: 'economicSabotage' },
      ],
    })
    const earlier: Command[] = [{ type: 'DIPLOMACY', playerId: ME, targetPlayerId: FEIND, action: 'offerPeace' }]
    const { kurz } = entscheide(l, earlier)
    expect(kurz).toEqual(['entlassen:s102'])
    expect(kurz.some((k) => k.startsWith('anwerben:'))).toBe(false)
  })

  it('ein noch offenes eigenes Friedensangebot vom Vortag sperrt Sabotage ebenso wie eines von heute, laesst den Gegenspion aber im Krieg (Befund M17-S5/M17-S8)', () => {
    // Gegenprobe: `earlier` ist heute leer — ohne `view.outgoingOffers` (Befund M17-S5) waere
    // das Angebot fuer die Spionage unsichtbar, und der Saboteur bliebe stehen, bis der Gegner
    // annimmt und die Beziehung schon auf 'truce' steht (dann zu spaet fuer D29.8/R-SPY-05).
    // Der Gegenspion ist davon unberuehrt (Befund M17-S8): `relations[FEIND].state` bleibt
    // 'war', bis der Gegner tatsaechlich annimmt.
    const l = lage({
      krieg: true,
      budgetPermille: 1000,
      spione: [
        { provinceId: 'o1', mission: 'counter' },
        { provinceId: 's2', mission: 'economicSabotage' },
      ],
      mutate: (s) => {
        s.diplomacy.offers.push({ from: ME, to: FEIND, kind: 'peace', tick: s.tick - 20 })
      },
    })
    expect(l.view.outgoingOffers).toEqual([{ to: FEIND, kind: 'peace', tick: l.state.tick - 20 }])
    const { kurz } = entscheide(l)
    expect(kurz).toEqual(['entlassen:s102'])
    expect(kurz.some((k) => k.startsWith('anwerben:'))).toBe(false)
  })

  it('entlaesst den Gegenspion doch, sobald der Krieg wirklich vorbei ist (Befund M17-S8, Gegenprobe)', () => {
    // Ohne eigenes Friedensangebot, aber echtes Kriegsende (`krieg` nicht gesetzt): der
    // Gegenspion geht, wie schon in Z1 „entlaesst den Gegenspion, wenn Krieg und Verstimmung
    // vorbei sind" — hier zusaetzlich mit einem (irrelevanten) Saboteur daneben, der ebenfalls
    // kein Ziel mehr hat.
    const l = lage({
      spione: [
        { provinceId: 'o1', mission: 'counter' },
        { provinceId: 's2', mission: 'economicSabotage' },
      ],
    })
    const { kurz } = entscheide(l)
    expect(kurz.sort()).toEqual(['entlassen:s101', 'entlassen:s102'].sort())
  })

  it('sabotiert keine nur erinnerte Provinz', () => {
    const l = lage({
      krieg: true,
      budgetPermille: 1000,
      spione: [
        { provinceId: 'o1', mission: 'counter' },
        { provinceId: 's2', mission: 'intel' },
        { provinceId: 'n1', mission: 'economicSabotage' },
      ],
    })
    const { kurz } = entscheide(l)
    expect(kurz).toEqual(['umsetzen:s103->economicSabotage@s2'])
  })

  it('eine erklaerte, noch nicht wirksame Kriegserklaerung ist Frieden', () => {
    const l = lage({
      verstimmung: 900,
      budgetPermille: 1000,
      spione: [{ provinceId: 'o1', mission: 'counter' }],
    })
    const earlier: Command[] = [{ type: 'DIPLOMACY', playerId: ME, targetPlayerId: NACHBAR, action: 'declareWar' }]
    const { kurz } = entscheide(l, earlier)
    expect(kurz).toEqual([])
  })
})

describe('Z4 Das Budget espionageBudgetPermille wird nie ueberschritten', () => {
  it('wirbt nicht an, wenn der Sold das Budget ueberstiege', () => {
    const l = lage({ krieg: true, budgetPermille: 50 })
    expect(espionageBudget(l.view, l.rules)).toBeLessThan(spySalary(l.rules.constants, 'counter'))
    const { kurz, explanations } = entscheide(l)
    expect(kurz).toEqual([])
    expect(
      explanations.some((e) => e.action === 'Spionage: kein Gegenspion angeworben' && e.reason.includes('Budget')),
    ).toBe(true)
  })

  it('haelt Gegenspion und Aufklaerer im Budget, den Saboteur nicht', () => {
    const l = lage({
      krieg: true,
      budgetPermille: 300,
      spione: [
        { provinceId: 'o1', mission: 'counter' },
        { provinceId: 'n1', mission: 'intel' },
      ],
    })
    const C = l.rules.constants
    const budget = espionageBudget(l.view, l.rules)
    expect(spySalary(C, 'counter') + spySalary(C, 'intel')).toBeLessThanOrEqual(budget)
    expect(budget).toBeLessThan(spySalary(C, 'counter') + spySalary(C, 'intel') + spySalary(C, 'economicSabotage'))
    const { kurz, explanations } = entscheide(l)
    expect(kurz).toEqual([])
    expect(
      explanations.some(
        (e) => e.action === 'Spionage: kein Wirtschaftssaboteur angeworben' && e.reason.includes('Budget'),
      ),
    ).toBe(true)
  })

  it('entlaesst bei ueberschrittenem Budget zuerst den Saboteur, nur ihn', () => {
    const l = lage({
      krieg: true,
      budgetPermille: 300,
      spione: [
        { provinceId: 'o1', mission: 'counter' },
        { provinceId: 'n1', mission: 'intel' },
        { provinceId: 's2', mission: 'economicSabotage' },
      ],
    })
    const { kurz, explanations } = entscheide(l)
    expect(kurz).toEqual(['entlassen:s103'])
    expect(explanations.some((e) => e.reason.includes('Budget'))).toBe(true)
  })

  it('wirbt je Entscheidung hoechstens einen Spion an', () => {
    const l = lage({ krieg: true, budgetPermille: 1000 })
    const { kurz } = entscheide(l)
    expect(kurz).toEqual(['anwerben:counter@o1'])
  })

  it('entlaesst NICHT, wenn der Sold genau gleich dem Budget ist (Grenzwert, Befund M17-S6)', () => {
    // Grenzwert der Entlass-Schleife (`salaries <= budget`): am Gleichstand darf keine der drei
    // Zusagen anschlagen — "das Budget wird nie ueberschritten" heisst nicht "das Budget wird nie
    // erreicht". `766` ‰ ist gezielt so gewaehlt, dass der Sold von Gegenspion + zwei
    // Wirtschaftssaboteuren das Budget ohne Rundungsrest genau trifft (siehe Kommentar unten).
    const l = lage({
      krieg: true,
      budgetPermille: 766,
      spione: [
        { provinceId: 'o1', mission: 'counter' },
        { provinceId: 's2', mission: 'economicSabotage' },
        { provinceId: 'i2', mission: 'economicSabotage' },
      ],
    })
    const C = l.rules.constants
    const salaries = spySalary(C, 'counter') + 2 * spySalary(C, 'economicSabotage')
    // Sanity: kein Rundungsrest, sonst waere das kein Test des Gleichstands.
    expect(espionageBudget(l.view, l.rules)).toBe(salaries)
    const { kurz } = entscheide(l)
    expect(kurz.some((k) => k.startsWith('entlassen:'))).toBe(false)
  })
})

describe('Z5 Entlassen bei drohendem Geldmangel', () => {
  const C = TEST_RULES.constants
  const H = TEST_RULES.ai.espionageMoneyHorizonDays
  const sold = (...m: SpyMission[]) => m.reduce((s, x) => s + spySalary(C, x), 0)

  it('entlaesst bei akutem Geldmangel alle Spione, den Saboteur zuerst', () => {
    const l = lage({
      krieg: true,
      budgetPermille: 1000,
      spione: [
        { provinceId: 'o1', mission: 'counter' },
        { provinceId: 'n1', mission: 'intel' },
        { provinceId: 's2', mission: 'economicSabotage' },
      ],
      mutate: (s) => {
        s.players[ME]!.shortages = ['money']
      },
    })
    const { kurz, explanations } = entscheide(l)
    expect(kurz).toEqual(['entlassen:s101', 'entlassen:s102', 'entlassen:s103'])
    for (const e of explanations.filter((e) => e.action.startsWith('Spionage: entlässt'))) {
      expect(e.reason).toContain('Geldmangel')
    }
    expect(kurz.some((k) => k.startsWith('anwerben:'))).toBe(false)
  })

  it('entlaesst nur so viele, wie der Horizont verlangt', () => {
    const basis = lage({
      krieg: true,
      budgetPermille: 1000,
      geld: 0,
      spione: [
        { provinceId: 'o1', mission: 'counter' },
        { provinceId: 'n1', mission: 'intel' },
        { provinceId: 's2', mission: 'economicSabotage' },
      ],
      mutate: (s) => {
        placeArmy(s, { owner: ME, at: 'o1', units: [{ unitKey: 'infantry', hpTotal: 200_000 }] })
      },
    })
    const I = dailyMoneyIncome(basis.view, basis.rules)
    const U = dailyArmyMoneyUpkeep(basis.view, basis.rules)
    const geld = H * (U + sold('counter', 'intel') - I) + 10_000

    expect(geld + H * (I - U - sold('counter', 'intel', 'economicSabotage'))).toBeLessThan(0)
    expect(geld + H * (I - U - sold('counter', 'intel'))).toBeGreaterThanOrEqual(0)

    const l = lage({
      krieg: true,
      budgetPermille: 1000,
      geld,
      spione: [
        { provinceId: 'o1', mission: 'counter' },
        { provinceId: 'n1', mission: 'intel' },
        { provinceId: 's2', mission: 'economicSabotage' },
      ],
      mutate: (s) => {
        placeArmy(s, { owner: ME, at: 'o1', units: [{ unitKey: 'infantry', hpTotal: 200_000 }] })
      },
    })
    const { kurz, explanations } = entscheide(l)
    expect(kurz).toEqual(['entlassen:s103'])
    expect(explanations.some((e) => e.reason.includes('Geldmangel'))).toBe(true)
  })

  it('wirbt nicht an, wenn der Anwerbepreis die Ruecklage anbraeche', () => {
    const l = lage({ krieg: true, geld: 120_000 })
    const RESERVE_PERMILLE = 200
    expect(120_000 - C.spyRecruitCost).toBeLessThan(Math.trunc((120_000 * RESERVE_PERMILLE) / 1000))
    const { kurz, explanations } = entscheide(l)
    expect(kurz).toEqual([])
    expect(explanations.some((e) => e.reason.includes('Rücklage'))).toBe(true)
  })

  it('wirbt an, wenn der Anwerbepreis die Ruecklage genau erreicht, nicht anbricht (Grenzwert, Befund M17-S6)', () => {
    // Grenzwert der Anwerbe-Pruefung (`money - cost < reserve`): am Gleichstand
    // (`money - cost === reserve`) ist die Ruecklage noch unversehrt, das Anwerben darf nicht
    // verweigert werden. `126912` ist gezielt so gewaehlt (siehe Kommentar unten).
    const geld = 126_912
    const RESERVE_PERMILLE = 200
    expect(geld - C.spyRecruitCost).toBe(Math.trunc((geld * RESERVE_PERMILLE) / 1000))
    const l = lage({ krieg: true, geld })
    const { kurz } = entscheide(l)
    expect(kurz).toEqual(['anwerben:counter@o1'])
  })

  it('wirbt nicht an, wenn der neue Sold den Bestand im Horizont aufzehrte', () => {
    const basis = lage({ krieg: true, geld: 300_000 })
    const I = dailyMoneyIncome(basis.view, basis.rules)
    const anzahl = Math.ceil((I + 100_000) / (60 * 24))
    const l = lage({
      krieg: true,
      geld: 300_000,
      mutate: (s) => {
        placeArmy(s, { owner: ME, at: 'o1', units: [{ unitKey: 'infantry', hpTotal: anzahl * 1000 }] })
      },
    })
    const { kurz, explanations } = entscheide(l)
    expect(kurz).toEqual([])
    const nichts = explanations.find((e) => e.action.startsWith('Spionage: kein '))
    expect(nichts?.reason).toContain('Geldmangel')
  })
})

describe('Z6 Jede Spionagehandlung ist begruendet (R-AI-09/AK4)', () => {
  it('jede Handlung nennt Grund und Alternative', () => {
    const anwerben = entscheide(lage({ krieg: true }))
    expect(anwerben.commands.length).toBe(1)

    const umsetzen = entscheide(lage({ krieg: true, spione: [{ provinceId: 'o3', mission: 'counter' }] }))
    expect(umsetzen.commands.length).toBe(1)

    const entlassen = entscheide(lage({ spione: [{ provinceId: 'o1', mission: 'counter' }] }))
    expect(entlassen.commands.length).toBe(1)
  })

  it('entscheidet unabhaengig von den Spionkennungen (Befund M17-S1)', () => {
    const lauf = (ids: [string, string, string]) =>
      lage({
        krieg: true,
        budgetPermille: 300,
        spione: [
          { id: ids[0], provinceId: 'o1', mission: 'counter' },
          { id: ids[1], provinceId: 'n1', mission: 'intel' },
          { id: ids[2], provinceId: 's2', mission: 'economicSabotage' },
        ],
      })
    const vorwaerts = lauf(['s101', 's102', 's103'])
    const rueckwaerts = lauf(['s903', 's902', 's901'])
    const byIndex = (l: ReturnType<typeof lauf>, kurz: string[]) => {
      const ids = l.state.espionage.spies.map((s) => s.id)
      return kurz.map((k) => k.replace(/s\d+/g, (m) => `#${ids.indexOf(m)}`))
    }
    const a = entscheide(vorwaerts)
    const b = entscheide(rueckwaerts)
    expect(byIndex(vorwaerts, a.kurz)).toEqual(['entlassen:#2'])
    expect(byIndex(rueckwaerts, b.kurz)).toEqual(['entlassen:#2'])
  })

  it('entlaesst bei Gleichstand im DISMISS_RANK den spaetesten im Array, nie nach der Kennung (E4)', () => {
    // Zwei Gegenspione (gleicher DISMISS_RANK): einer sitzt schon in der Hauptstadt, der andere
    // anderswo, aber ebenfalls gueltig (eigene, nicht erinnerte Provinz) - Phase 1 behaelt beide,
    // Phase 2 muss einen entlassen, weil zwei Gegenspionsolde das Budget (150 permille) ueberstiegen.
    const lauf = (ids: [string, string]) =>
      lage({
        krieg: true,
        spione: [
          { id: ids[0], provinceId: 'o1', mission: 'counter' },
          { id: ids[1], provinceId: 'o2', mission: 'counter' },
        ],
      })
    const vorwaerts = lauf(['s101', 's102'])
    const rueckwaerts = lauf(['s902', 's901'])
    const budget = espionageBudget(vorwaerts.view, vorwaerts.rules)
    const salary = spySalary(vorwaerts.rules.constants, 'counter')
    expect(salary).toBeLessThanOrEqual(budget)
    expect(2 * salary).toBeGreaterThan(budget)

    const byIndex = (l: ReturnType<typeof lauf>, kurz: string[]) => {
      const ids = l.state.espionage.spies.map((s) => s.id)
      return kurz.map((k) => k.replace(/s\d+/g, (m) => `#${ids.indexOf(m)}`))
    }
    const a = entscheide(vorwaerts)
    const b = entscheide(rueckwaerts)
    // Der zweite Spion im Array (Index 1, o2) geht, unabhaengig davon, ob seine Kennung
    // alphabetisch vor oder nach der des ersten liegt.
    expect(byIndex(vorwaerts, a.kurz)).toEqual(['entlassen:#1'])
    expect(byIndex(rueckwaerts, b.kurz)).toEqual(['entlassen:#1'])
  })
})

const SPY_TYPES = new Set(['RECRUIT_SPY', 'REASSIGN_SPY', 'DISMISS_SPY'])

describe('Z7 Eigenschaft ueber 60 Spieltage: Budget, kein Frieden sabotiert, kein Befehl abgelehnt', () => {
  it('haelt Budget, Kriegsschranke und Ablehnungsfreiheit ueber einen Lauf', () => {
    const RUN = withAi({ espionageBudgetPermille: 1000 })
    const runConfig: GameConfig = {
      seed: 1815,
      mapId: 'testworld',
      rulesId: 'default',
      players: [
        { name: 'Feind', kind: 'ai', nation: 'Nordland', color: '#0f62bc', difficulty: 'easy' },
        { name: 'Ich', kind: 'ai', nation: 'Ostmark', color: '#b03a2e', difficulty: 'normal' },
        { name: 'Nachbar', kind: 'ai', nation: 'Sueden', color: '#2e7d32', difficulty: 'hard' },
      ],
      victory: { condition: 'points', pointsShareToWin: 900, dayLimit: null },
    }
    let current = createInitialState(runConfig, { map, rules: RUN })
    current.diplomacy.relations[relationKey(FEIND, ME)]!.state = 'war'

    const ctx = { map, rules: RUN }
    const phaseCtx = { map, rules: RUN, commands: [], events: [] }
    let strategisch = 0
    let berichte = 0
    const anwerbungen: Record<SpyMission, number> = { intel: 0, economicSabotage: 0, militarySabotage: 0, counter: 0 }

    const TAGE = 60
    for (let i = 0; i < TAGE * 24; i++) {
      const tick = commandsForTick(current, ctx)
      for (const p of current.playerOrder) {
        const memory = tick.memories[p]
        if (!memory || memory.lastStrategicTick !== current.tick) continue
        strategisch += 1
        const view = publicView(current, p)
        const eigene = tick.ai.filter((c) => c.playerId === p && SPY_TYPES.has(c.type))
        for (const c of eigene) expect(canApply(current, c, phaseCtx), JSON.stringify(c)).toEqual({ ok: true })

        const geplant = plane(view.espionage.spies, eigene)
        expect(geplant.reduce((s, x) => s + spySalary(RUN.constants, x.mission), 0)).toBeLessThanOrEqual(
          espionageBudget(view, RUN),
        )

        const frieden = new Set(
          tick.ai
            .filter((c) => c.playerId === p && c.type === 'DIPLOMACY' && (c.action === 'acceptPeace' || c.action === 'offerPeace'))
            .map((c) => (c as { targetPlayerId: string }).targetPlayerId),
        )
        for (const s of geplant) {
          if (s.mission !== 'economicSabotage' && s.mission !== 'militarySabotage') continue
          const ziel = view.provinces.find((e) => e.id === s.provinceId)
          if (!ziel) continue
          expect(ziel.stale).toBe(false)
          expect(view.relations[ziel.owner!]?.state).toBe('war')
          expect(frieden.has(ziel.owner!)).toBe(false)
        }
        for (const c of eigene) if (c.type === 'RECRUIT_SPY') anwerbungen[c.mission] += 1
      }
      const result = runTicks(current, 1, ctx, () => tick.commands)
      current = result.state
      storeMemories(current, tick.memories)
      berichte += result.events.filter((e) => e.type === 'SPY_REPORT').length
    }

    console.log('Z7', { strategisch, anwerbungen, berichte })
    expect(strategisch).toBeGreaterThan(100)
    expect(anwerbungen.counter).toBeGreaterThan(0)
    expect(anwerbungen.intel).toBeGreaterThan(0)
    expect(anwerbungen.economicSabotage).toBeGreaterThan(0)
    expect(berichte).toBeGreaterThan(0)
  }, 30_000)
})

/** DISMISS entfernt, REASSIGN aendert, RECRUIT haengt an — die Planlage nach den KI-Befehlen. */
function plane(
  spies: { id: string; provinceId: string; mission: SpyMission }[],
  commands: readonly Command[],
): { provinceId: string; mission: SpyMission }[] {
  const byId = new Map(spies.map((s) => [s.id, { provinceId: s.provinceId, mission: s.mission }]))
  for (const c of commands) {
    if (c.type === 'DISMISS_SPY') byId.delete(c.spyId)
    else if (c.type === 'REASSIGN_SPY') byId.set(c.spyId, { provinceId: c.provinceId, mission: c.mission })
  }
  const geplant = [...byId.values()]
  for (const c of commands) if (c.type === 'RECRUIT_SPY') geplant.push({ provinceId: c.provinceId, mission: c.mission })
  return geplant
}

describe('Finanzen aus der Sicht, Zwilling zu economyOverview', () => {
  it('der Geldertrag aus der Sicht ist der der Wirtschaftsuebersicht', () => {
    const l = lage({
      mutate: (s) => {
        s.provinces['o2']!.morale = 43_210
        s.provinces['o3']!.occupiedSince = s.tick - 50
        s.players[ME]!.capitalLostUntil = s.tick + 100
      },
    })
    for (const p of l.state.playerOrder) {
      const view = publicView(l.state, p)
      expect(dailyMoneyIncome(view, l.rules)).toBe(economyOverview(l.state, p, l.rules).money.production)
    }
  })

  it('ohne Hauptstadtverlust und ohne Besatzung ebenso', () => {
    const l = lage()
    for (const p of l.state.playerOrder) {
      const view = publicView(l.state, p)
      expect(dailyMoneyIncome(view, l.rules)).toBe(economyOverview(l.state, p, l.rules).money.production)
    }
  })

  it('der Armeeunterhalt aus der Sicht ist der der Uebersicht', () => {
    const l = lage({
      mutate: (s) => {
        placeArmy(s, {
          owner: ME,
          at: 'o1',
          units: [
            { unitKey: 'infantry', hpTotal: 12_345 },
            { unitKey: 'tank', hpTotal: 5_201 },
          ],
        })
      },
    })
    const view = publicView(l.state, ME)
    const upkeep = dailyArmyMoneyUpkeep(view, l.rules)
    expect(upkeep).toBe(economyOverview(l.state, ME, l.rules).money.consumption)
    expect(upkeep).toBeGreaterThan(0)
  })
})

describe('Z9 Die Spionage laeuft im Strategietakt von decide', () => {
  it('decide wirbt im Strategietakt an, ausserhalb nicht', () => {
    const { view, rules, context } = lage({ krieg: true })
    const erster = decide({ view, memory: emptyMemory(600), rules, map, difficulty: context.difficulty, explain: true })
    expect(erster.commands.some((c) => c.type === 'RECRUIT_SPY' && c.provinceId === 'o1' && c.mission === 'counter')).toBe(
      true,
    )

    const zweiter = decide({
      view,
      memory: { ...emptyMemory(600), lastStrategicTick: view.tick },
      rules,
      map,
      difficulty: context.difficulty,
      explain: true,
    })
    expect(zweiter.commands.some((c) => c.type === 'RECRUIT_SPY' || c.type === 'REASSIGN_SPY' || c.type === 'DISMISS_SPY')).toBe(
      false,
    )
  })

  it('der Bauauftrag desselben Zugs mindert das Geld der Spionage', () => {
    const l = lage({ krieg: true, geld: 300_000 })
    const kaserne = buildingCostForLevel(l.rules.buildings.barracks!, 1, l.rules.constants).money
    expect(l.state.provinces['o2']!.buildings.barracks ?? 0).toBe(0)
    expect(kaserne).toBe(250_000)

    const ohne = entscheide(l)
    expect(ohne.kurz).toEqual(['anwerben:counter@o1'])

    const earlier: Command[] = [{ type: 'BUILD', playerId: ME, provinceId: 'o2', building: 'barracks' }]
    const mit = entscheide(l, earlier)
    expect(mit.kurz).toEqual([])
    expect(mit.explanations.some((e) => e.reason.includes('Rücklage'))).toBe(true)
  })
})
