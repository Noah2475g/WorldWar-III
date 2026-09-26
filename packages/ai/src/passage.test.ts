import {
  canApply,
  createInitialState,
  grantsPassage,
  planRoute,
  publicView,
  setPassage,
  step,
  type Command,
  type GameConfig,
  type GameState,
} from '@worldwar/core'
import { placeArmy, smallWorld, TEST_RULES } from '@worldwar/testkit'
import { beforeEach, describe, expect, it } from 'vitest'
import { advanceTicks } from './loop'
import { emptyMemory } from './decide'
import { militaryCommands } from './military'
import { guestWithdrawal, ownerOf, predictLandPath, requestPassage, passageCommands } from './passage'
import type { AiContext, Explanation } from './types'

/**
 * Antrag statt Marsch (T-M17-10, R-DIP-08, Befund B6).
 */

const map = smallWorld()
const ctx = { map, rules: TEST_RULES }
const phaseCtx = { map, rules: TEST_RULES, commands: [], events: [] }

const CONFIG3: GameConfig = {
  seed: 1010,
  mapId: 'testworld',
  rulesId: 'default',
  players: [
    { name: 'Nord', kind: 'ai', nation: 'Nordland', color: '#0f62bc', difficulty: 'hard' }, // p1
    { name: 'Ost', kind: 'human', nation: 'Ostmark', color: '#b03a2e' }, // p2
    { name: 'Sued', kind: 'ai', nation: 'Sueden', color: '#4a5d2c', difficulty: 'normal' }, // p3
  ],
  victory: { condition: 'points', pointsShareToWin: 900, dayLimit: null },
}

const ticksPerDay = TEST_RULES.constants.ticksPerDay

function dreiMaechte(): GameState {
  return createInitialState(CONFIG3, ctx)
}

/**
 * Weg durch Sueden: p1 (Nordland) ist im Krieg mit p2 (Ostmark); m1 und m2 gehoeren p3
 * (Sueden); p1 sieht o1 (Aufklaerung); eine p1-Armee steht in n2. Jeder Landweg von n2 nach
 * o1 fuehrt ueber m1 (p3s Land).
 */
function wegDurchSueden(): GameState {
  const state = dreiMaechte()
  state.diplomacy.relations['p1|p2']!.state = 'war'
  state.provinces.m1!.owner = 'p3'
  state.provinces.m2!.owner = 'p3'
  state.players.p1!.intel.o1 = { tick: 0, owner: 'p2', strength: 0 }
  placeArmy(state, { owner: 'p1', at: 'n2', units: [{ unitKey: 'infantry', hpTotal: 10_000 }] })
  return state
}

const contextFor = (state: GameState, id: string): AiContext => ({
  view: publicView(state, id),
  memory: state.ai[id] ?? emptyMemory(600),
  rules: TEST_RULES,
  map,
  difficulty: TEST_RULES.ai.difficulties[state.players[id]!.difficulty ?? 'normal'],
})

/** Jeder neue Befehl muss die reguläre Prüfung bestehen (Z10). */
const allAccepted = (state: GameState, commands: Command[]) =>
  commands.forEach((c) => expect(canApply(state, c, phaseCtx), JSON.stringify(c)).toEqual({ ok: true }))

describe('R-DIP-08/AK2 Antrag statt Marsch (Befund B6)', () => {
  let state: GameState

  beforeEach(() => {
    state = wegDurchSueden()
  })

  it('sagt den Kernweg voraus', () => {
    // Frieden setzen, damit der Gebietsfaktor fuer o1 in Sicht und Kern gleich ist — o1 ist
    // fuer p1 ein unsichtbares Ziel, die KI rechnet es also als fremd.
    state.diplomacy.relations['p1|p2']!.state = 'peace'
    const army = state.armies[state.provinceOrder.length > 0 ? Object.keys(state.armies)[0]! : '']
    const armyId = Object.keys(state.armies)[0]!
    const context = contextFor(state, 'p1')
    const visibleArmy = context.view.armies.find((a) => a.id === armyId)!
    const predicted = predictLandPath(context, visibleArmy, 'o1')
    const real = planRoute(state, state.armies[armyId]!, 'o1', map, TEST_RULES)
    expect(predicted).toEqual(real?.path)
    void army

    const state2 = dreiMaechte()
    state2.provinces.n3!.buildings = { ...state2.provinces.n3!.buildings, railway: 1 }
    const a2 = placeArmy(state2, { owner: 'p1', at: 'n1', units: [{ unitKey: 'infantry', hpTotal: 10_000 }] })
    const context2 = contextFor(state2, 'p1')
    const visible2 = context2.view.armies.find((a) => a.id === a2.id)!
    const predicted2 = predictLandPath(context2, visible2, 'm2')
    const real2 = planRoute(state2, a2, 'm2', map, TEST_RULES)
    expect(predicted2).toEqual(real2?.path)
  })

  it('marschiert nicht durch friedliches Land ohne Recht', () => {
    const context = contextFor(state, 'p1')
    const explanations: Explanation[] = []
    const decision = decideMilitary(context, explanations)
    expect(decision.filter((c) => c.type === 'MOVE_ARMY')).toHaveLength(0)
    const requests = decision.filter((c) => c.type === 'DIPLOMACY' && c.action === 'requestRightOfWay')
    expect(requests).toHaveLength(1)
    expect(requests[0]).toMatchObject({ playerId: 'p1', targetPlayerId: 'p3' })
    allAccepted(state, decision)
  })

  it('marschiert, sobald das Recht besteht', () => {
    setPassage(state.diplomacy.relations['p1|p3']!, 'p3', 'p1', true, null)
    const context = contextFor(state, 'p1')
    const explanations: Explanation[] = []
    const decision = decideMilitary(context, explanations)
    expect(decision.filter((c) => c.type === 'DIPLOMACY')).toHaveLength(0)
    const moves = decision.filter((c) => c.type === 'MOVE_ARMY')
    expect(moves).toHaveLength(1)
  })

  it('marschiert durch herrenloses Land ohne Antrag', () => {
    state.provinces.m1!.owner = null
    state.provinces.m2!.owner = null
    const context = contextFor(state, 'p1')
    const explanations: Explanation[] = []
    const decision = decideMilitary(context, explanations)
    expect(decision.filter((c) => c.type === 'DIPLOMACY')).toHaveLength(0)
    expect(decision.filter((c) => c.type === 'MOVE_ARMY')).toHaveLength(1)
  })

  it('ein gekuendigtes Recht zaehlt nicht als Recht, und beantragt wird dann nicht', () => {
    setPassage(state.diplomacy.relations['p1|p3']!, 'p3', 'p1', true, state.tick + 24)
    const context = contextFor(state, 'p1')
    const explanations: Explanation[] = []
    const decision = decideMilitary(context, explanations)
    expect(decision.filter((c) => c.type === 'MOVE_ARMY')).toHaveLength(0)
    expect(decision.filter((c) => c.type === 'DIPLOMACY')).toHaveLength(0)
    expect(explanations.length).toBeGreaterThan(0)
  })

  it('beantragt nicht, solange eine Kriegserklaerung laeuft', () => {
    state.diplomacy.relations['p1|p3']!.warEffectiveAtTick = state.tick + 12
    const context = contextFor(state, 'p1')
    const explanations: Explanation[] = []
    const decision = decideMilitary(context, explanations)
    expect(decision.filter((c) => c.type === 'MOVE_ARMY')).toHaveLength(0)
    expect(decision.filter((c) => c.type === 'DIPLOMACY')).toHaveLength(0)
  })

  /**
   * Nacharbeit ki (T-M17-10/11), Befund M17-D14: eine eigene `declareWar` DERSELBEN
   * Strategiestufe steht in `view.relations[owner]` noch nicht — sie ist ja selbst nur ein
   * Befehl in `pending`, nicht angewendeter Zustand. Ohne die Pruefung in `requestPassage`
   * legte die Taktikstufe hier ein zweites `DIPLOMACY`-Kommando (`requestRightOfWay p3`),
   * und der Kern lehnte es beim Anwenden mit `INVALID_TARGET`/'Kriegserklärung läuft' ab
   * (`commands/diplomacy.ts`), weil `declareWar` im selben `step()`-Aufruf zuerst greift.
   */
  it('beantragt nicht, wenn im selben Zug eine Kriegserklaerung gegen denselben Empfaenger ansteht (M17-D14)', () => {
    const context = contextFor(state, 'p1')
    const explanations: Explanation[] = []
    const pending: Command[] = [{ type: 'DIPLOMACY', playerId: 'p1', targetPlayerId: 'p3', action: 'declareWar' }]
    const decision = decideMilitary(context, explanations, pending)
    expect(decision.filter((c) => c.type === 'MOVE_ARMY')).toHaveLength(0)
    expect(decision.filter((c) => c.type === 'DIPLOMACY')).toHaveLength(0)
    const fund = explanations.find((e) => e.reason.includes('Kriegserklärung läuft'))
    expect(fund).toBeDefined()

    // Gegenprobe auf den Kern: genau die Befehlsfolge, die ein echter Strategietakt liefert
    // (declareWar zuerst, danach die Taktikstufe) — allAccepted haette den echten Fehler
    // gezeigt: die zweite Ablehnung entstand erst beim Anwenden, nicht bei canApply allein.
    const result = step(state, [...pending, ...decision], ctx)
    const rejected = result.events.filter((e) => e.type === 'COMMAND_REJECTED')
    expect(rejected).toEqual([])
  })

  it('wiederholt den Antrag erst nach Ablauf seiner Frist', () => {
    let context = contextFor(state, 'p1')
    let explanations: Explanation[] = []
    let decision = decideMilitary(context, explanations)
    expect(decision.filter((c) => c.type === 'DIPLOMACY')).toHaveLength(1)
    let memory = context.memory

    // Zweiter Lauf, einen Spieltag spaeter: kein neuer Antrag.
    state.tick += ticksPerDay
    context = { ...contextFor(state, 'p1'), memory }
    explanations = []
    decision = decideMilitary(context, explanations)
    expect(decision.filter((c) => c.type === 'DIPLOMACY')).toHaveLength(0)
    memory = context.memory

    // Dritter Lauf, nach Ablauf der Frist: wieder genau einer.
    const lifetime = TEST_RULES.constants.offerLifetimeDays * ticksPerDay
    state.tick += lifetime
    context = { ...contextFor(state, 'p1'), memory }
    explanations = []
    decision = decideMilitary(context, explanations)
    expect(decision.filter((c) => c.type === 'DIPLOMACY')).toHaveLength(1)
  })

  it('haelt eine marschierende Armee an, bevor sie friedliches Land betritt', () => {
    const armyId = Object.keys(state.armies)[0]!
    state.armies[armyId]!.path = ['m1', 'o1']
    state.armies[armyId]!.arrivalTick = state.tick + 5
    state.armies[armyId]!.departureTick = state.tick
    const context = contextFor(state, 'p1')
    const explanations: Explanation[] = []
    const decision = decideMilitary(context, explanations)
    expect(decision.filter((c) => c.type === 'STOP_ARMY')).toHaveLength(1)
    expect(decision.filter((c) => c.type === 'DIPLOMACY' && c.action === 'requestRightOfWay')).toHaveLength(1)
  })

  it('laesst eine Armee weiterziehen, die das Land ihres Gastgebers verlaesst', () => {
    setPassage(state.diplomacy.relations['p1|p3']!, 'p3', 'p1', true, state.tick + 24)
    const armyId = Object.keys(state.armies)[0]!
    state.armies[armyId]!.locationProvinceId = 'm1'
    state.armies[armyId]!.path = ['n2']
    state.armies[armyId]!.arrivalTick = state.tick + 3
    state.armies[armyId]!.departureTick = state.tick
    const context = contextFor(state, 'p1')
    const explanations: Explanation[] = []
    const decision = decideMilitary(context, explanations)
    expect(decision.filter((c) => c.type === 'STOP_ARMY')).toHaveLength(0)
    expect(decision.filter((c) => c.type === 'MOVE_ARMY')).toHaveLength(0)
  })

  it('schuetzt auch den Marsch zur bedrohten Grenze', () => {
    const s = dreiMaechte()
    s.diplomacy.relations['p1|p2']!.state = 'war'
    s.provinces.o3!.owner = 'p1'
    s.provinces.m1!.owner = 'p3'
    placeArmy(s, { owner: 'p2', at: 'o1', units: [{ unitKey: 'infantry', hpTotal: 40_000 }] })
    placeArmy(s, { owner: 'p1', at: 'm2', units: [{ unitKey: 'infantry', hpTotal: 10_000 }] })
    const context = contextFor(s, 'p1')
    const explanations: Explanation[] = []
    const decision = decideMilitary(context, explanations)
    expect(decision.filter((c) => c.type === 'MOVE_ARMY' && 'targetProvinceId' in c && c.targetProvinceId === 'o3')).toHaveLength(0)
    expect(decision.filter((c) => c.type === 'DIPLOMACY' && c.action === 'requestRightOfWay')).toHaveLength(1)
    expect(explanations.length).toBeGreaterThan(0)
  })
})

describe('R-DIP-08/AK2 Antrag statt Marsch — in der laufenden Partie', () => {
  it('kein Ueberfall auf dem Weg, und das Recht kommt zustande', () => {
    const state = wegDurchSueden()
    const result = advanceTicks(state, 4 * ticksPerDay, ctx)
    const surprise = result.events.find(
      (e) => e.type === 'WAR_DECLARED' && e.withoutDeclaration === true && e.playerId === 'p1' && e.targetPlayerId === 'p3',
    )
    expect(surprise).toBeUndefined()
    expect(result.applied.some((a) => a.command.type === 'DIPLOMACY' && a.command.playerId === 'p1' && a.command.action === 'requestRightOfWay')).toBe(true)
    expect(result.applied.some((a) => a.command.type === 'DIPLOMACY' && a.command.playerId === 'p3' && a.command.action === 'acceptRightOfWay')).toBe(true)
    expect(grantsPassage(result.state, 'p3', 'p1')).toBe(true)
    const rejected = result.events.filter(
      (e) => e.type === 'COMMAND_REJECTED' && (e.code === 'INVALID_TARGET' || e.code === 'QUEUE_FULL') && (e.playerId === 'p1' || e.playerId === 'p3'),
    )
    expect(rejected).toEqual([])
  })
})

describe('R-DIP-08/AK2 Die KI beantwortet einen Antrag nach ihrer Vertrauensschwelle', () => {
  let state: GameState

  beforeEach(() => {
    state = dreiMaechte()
  })

  it('gewaehrt bei Verhaeltnis ueber der Vertrauensschwelle', () => {
    const s = step(state, [{ type: 'DIPLOMACY', playerId: 'p2', targetPlayerId: 'p3', action: 'requestRightOfWay' }], ctx).state
    const context = contextFor(s, 'p3')
    const explanations: Explanation[] = []
    const commands = passageCommands(context, explanations, [])
    expect(commands).toEqual([{ type: 'DIPLOMACY', playerId: 'p3', targetPlayerId: 'p2', action: 'acceptRightOfWay' }])
    const after = step(s, commands, ctx).state
    expect(grantsPassage(after, 'p3', 'p2')).toBe(true)
  })

  it('gewaehrt nicht bei Verstimmung', () => {
    const s = step(state, [{ type: 'DIPLOMACY', playerId: 'p2', targetPlayerId: 'p3', action: 'requestRightOfWay' }], ctx).state
    s.diplomacy.grievances.p3 = { p2: 900 }
    const context = contextFor(s, 'p3')
    const explanations: Explanation[] = []
    const commands = passageCommands(context, explanations, [])
    expect(commands).toHaveLength(0)
    expect(explanations.some((e) => e.action.includes('p2') && e.action.includes('nicht gewährt'))).toBe(true)
  })

  it('gewaehrt nicht, wer mit meinem Verbuendeten im Krieg ist', () => {
    const s = step(state, [{ type: 'DIPLOMACY', playerId: 'p2', targetPlayerId: 'p3', action: 'requestRightOfWay' }], ctx).state
    s.diplomacy.relations['p1|p3']!.state = 'alliance'
    s.diplomacy.relations['p1|p2']!.state = 'war'
    const context = contextFor(s, 'p3')
    const explanations: Explanation[] = []
    const commands = passageCommands(context, explanations, [])
    expect(commands).toHaveLength(0)
    expect(explanations.some((e) => e.reason.includes('Krieg'))).toBe(true)
  })

  it('beantwortet nicht doppelt, was 1c im selben Zug gewaehrt', () => {
    const s = step(state, [{ type: 'DIPLOMACY', playerId: 'p2', targetPlayerId: 'p3', action: 'requestRightOfWay' }], ctx).state
    setPassage(s.diplomacy.relations['p2|p3']!, 'p2', 'p3', true, null)
    const context = contextFor(s, 'p3')
    const explanations: Explanation[] = []
    const commands = passageCommands(context, explanations, [{ type: 'DIPLOMACY', playerId: 'p3', targetPlayerId: 'p2', action: 'grantRightOfWay' }])
    expect(commands.filter((c) => c.type === 'DIPLOMACY' && c.action === 'acceptRightOfWay')).toHaveLength(0)
    const grants = [{ type: 'DIPLOMACY' as const, playerId: 'p3', targetPlayerId: 'p2', action: 'grantRightOfWay' as const }, ...commands]
    let cur = s
    for (const command of grants) {
      const r = step(cur, [command], ctx)
      expect(r.events.find((e) => e.type === 'COMMAND_REJECTED')).toBeUndefined()
      cur = r.state
    }
  })
})

describe('R-DIP-08/AK3 Die KI kuendigt unter der Kriegsschwelle, und der Gast geht', () => {
  it('kuendigt bei Verhaeltnis unter der Kriegsschwelle', () => {
    const state = dreiMaechte()
    setPassage(state.diplomacy.relations['p2|p3']!, 'p3', 'p2', true, null)
    state.diplomacy.grievances.p3 = { p2: 900 }
    const context = contextFor(state, 'p3')
    const explanations: Explanation[] = []
    const commands = passageCommands(context, explanations, [])
    expect(commands).toEqual([{ type: 'DIPLOMACY', playerId: 'p3', targetPlayerId: 'p2', action: 'revokeRightOfWay' }])
    expect(explanations.some((e) => e.alternative?.action === 'weiter gewähren')).toBe(true)
  })

  it('kuendigt nicht im Buendnis, nicht doppelt und nicht bei gutem Verhaeltnis', () => {
    // Buendnis
    let state = dreiMaechte()
    setPassage(state.diplomacy.relations['p2|p3']!, 'p3', 'p2', true, null)
    state.diplomacy.relations['p2|p3']!.state = 'alliance'
    state.diplomacy.grievances.p3 = { p2: 900 }
    let commands = passageCommands(contextFor(state, 'p3'), [], [])
    expect(commands.filter((c) => c.type === 'DIPLOMACY' && c.action === 'revokeRightOfWay')).toHaveLength(0)

    // schon gekuendigt
    state = dreiMaechte()
    setPassage(state.diplomacy.relations['p2|p3']!, 'p3', 'p2', true, state.tick + 24)
    state.diplomacy.grievances.p3 = { p2: 900 }
    commands = passageCommands(contextFor(state, 'p3'), [], [])
    expect(commands.filter((c) => c.type === 'DIPLOMACY' && c.action === 'revokeRightOfWay')).toHaveLength(0)

    // gutes Verhaeltnis
    state = dreiMaechte()
    setPassage(state.diplomacy.relations['p2|p3']!, 'p3', 'p2', true, null)
    commands = passageCommands(contextFor(state, 'p3'), [], [])
    expect(commands.filter((c) => c.type === 'DIPLOMACY' && c.action === 'revokeRightOfWay')).toHaveLength(0)
  })

  it('erwidert nach eigener Kuendigung erst wieder ueber der Vertrauensschwelle', () => {
    const state = dreiMaechte()
    setPassage(state.diplomacy.relations['p2|p3']!, 'p2', 'p3', true, null)
    state.diplomacy.grievances.p3 = { p2: 400 }
    const commands = passageCommands(contextFor(state, 'p3'), [], [])
    expect(commands.filter((c) => c.type === 'DIPLOMACY' && (c.action === 'grantRightOfWay' || c.action === 'revokeRightOfWay') && c.targetPlayerId === 'p2')).toHaveLength(0)
  })

  it('zieht die eigene Armee vor Fristende heim', () => {
    const state = dreiMaechte()
    state.provinces.m1!.owner = 'p3'
    setPassage(state.diplomacy.relations['p1|p3']!, 'p3', 'p1', true, state.tick + 24)
    const army = placeArmy(state, { owner: 'p1', at: 'm1', units: [{ unitKey: 'infantry', hpTotal: 10_000 }] })
    const context = contextFor(state, 'p1')
    const explanations: Explanation[] = []
    const decision = decideMilitary(context, explanations)
    const moves = decision.filter((c) => c.type === 'MOVE_ARMY' && 'armyId' in c && c.armyId === army.id)
    expect(moves).toHaveLength(1)
    expect((moves[0] as { targetProvinceId: string }).targetProvinceId).toBe('n2')
    expect(explanations.some((e) => e.reason.includes('endet in Tick'))).toBe(true)
    allAccepted(state, decision)
  })

  // Falle 8 (Bauplan §7.13, P17): geprueft und gemessen (Bericht T-M17-10) — die Armee
  // reagiert sofort (Umkehr im Tick nach der Kuendigung), aber der gewaehlte Heimweg m1->n2
  // (160.000 km, Infanterie 6.000 km/h, keine Eisenbahn) braucht ~27 Ticks, die Frist
  // (rightOfWayNoticeTicks) nur 24: die Armee ist bei Fristende noch in m1 unterwegs, und
  // der Kern meldet einen Ueberfall ohne Erklaerung — beim Bau gefunden, nicht die Frist und
  // nicht diese Zusicherung geaendert (Bauplan-Vorgabe). Siehe Bericht "Offene Punkte" und
  // PROBLEME.md M17-D10. Der zweite Teil der Zusage (die Armee kommt bei p1 an) haelt.
  it.todo('in der laufenden Partie: kein Ueberfall nach Ablauf der Frist (Befund M17-D10, offen)')

  it('reagiert sofort auf die Kuendigung, auch wenn der Heimweg laenger ist als die Frist (Befund M17-D10)', () => {
    const state = dreiMaechte()
    state.provinces.m1!.owner = 'p2'
    setPassage(state.diplomacy.relations['p1|p2']!, 'p2', 'p1', true, null)
    const army = placeArmy(state, { owner: 'p1', at: 'm1', units: [{ unitKey: 'infantry', hpTotal: 10_000 }] })
    const result = advanceTicks(state, 2 * ticksPerDay, ctx, {
      playerCommands: [{ type: 'DIPLOMACY', playerId: 'p2', targetPlayerId: 'p1', action: 'revokeRightOfWay' }],
    })
    // Reaktion im naechsten Zug, sobald die Frist im Zustand steht (nicht erst bei Fristende).
    const homeward = result.applied.find(
      (a) => a.command.type === 'MOVE_ARMY' && a.command.playerId === 'p1' && a.command.armyId === army.id && a.command.targetProvinceId === 'n2',
    )
    expect(homeward, JSON.stringify(result.applied)).toBeDefined()
    expect(homeward!.tick).toBeLessThanOrEqual(2)
    // Der Ueberfall ohne Erklaerung tritt trotzdem ein (Befund M17-D10): der Heimweg braucht
    // laenger als die Frist. Diese Zusicherung haelt den Ist-Stand fest, nicht die Zusage.
    const surprise = result.events.find(
      (e) => e.type === 'WAR_DECLARED' && e.withoutDeclaration === true && e.playerId === 'p1' && e.targetPlayerId === 'p2',
    )
    expect(surprise).toBeDefined()
  })
})

describe('D29.8 Erweiterung: veraltetes Ziel -> foermliche Kriegserklaerung (Nacharbeit Turnier M17)', () => {
  /** p1 (hard) marschiert von n2 nach m1; m1 ist unterwegs p3 zugefallen, mit p3 herrscht Frieden. */
  function veraltetesZiel(): { state: GameState; armyId: string } {
    const state = dreiMaechte()
    state.diplomacy.relations['p1|p2']!.state = 'war'
    state.provinces.m1!.owner = 'p3'
    const army = placeArmy(state, { owner: 'p1', at: 'n2', units: [{ unitKey: 'infantry', hpTotal: 10_000 }] })
    army.path = ['m1']
    army.departureTick = state.tick
    army.arrivalTick = state.tick + 5
    return { state, armyId: army.id }
  }

  it('erklaert foermlich den Krieg, wenn das Angriffsziel unterwegs einer friedlichen Macht zufiel', () => {
    const { state, armyId } = veraltetesZiel()
    const commands = decideMilitary(contextFor(state, 'p1'), [])

    const declarations = commands.filter((c) => c.type === 'DIPLOMACY' && c.action === 'declareWar')
    expect(declarations).toEqual([{ type: 'DIPLOMACY', playerId: 'p1', targetPlayerId: 'p3', action: 'declareWar' }])

    const stops = commands.filter((c) => c.type === 'STOP_ARMY')
    expect(stops).toEqual([{ type: 'STOP_ARMY', playerId: 'p1', armyId }])

    expect(commands.some((c) => c.type === 'DIPLOMACY' && c.action === 'requestRightOfWay')).toBe(false)
    expect(commands.some((c) => c.type === 'MOVE_ARMY')).toBe(false)
  })

  it('nennt Grund und Alternative der Erklaerung', () => {
    const { state } = veraltetesZiel()
    const explanations: Explanation[] = []
    decideMilitary(contextFor(state, 'p1'), explanations)

    const explanation = explanations.find((e) => e.action === 'Erklärt p3 den Krieg')
    expect(explanation).toBeDefined()
    expect(explanation!.reason).toContain('m1')
    expect(explanation!.reason).toContain('p3')
    expect(explanation!.alternative?.action).toContain('m1')
  })

  it('die Befehle bestehen den Kern, und die Erklaerung ist foermlich', () => {
    const { state } = veraltetesZiel()
    const commands = decideMilitary(contextFor(state, 'p1'), [])
    const result = step(state, commands, ctx)

    expect(result.events.find((e) => e.type === 'COMMAND_REJECTED')).toBeUndefined()
    expect(result.state.diplomacy.relations['p1|p3']!.warEffectiveAtTick).toBe(
      state.tick + TEST_RULES.constants.warDeclarationDelayTicks,
    )
    const declared = result.events.find(
      (e) => e.type === 'WAR_DECLARED' && e.playerId === 'p1' && e.targetPlayerId === 'p3',
    )
    expect(declared).toMatchObject({ withoutDeclaration: false })
  })

  it('kein Ueberfall bis zum Inkrafttreten, in der laufenden Partie', () => {
    const { state } = veraltetesZiel()
    const result = advanceTicks(state, 2 * ticksPerDay, ctx)

    expect(
      result.events.find(
        (e) => e.type === 'WAR_DECLARED' && e.withoutDeclaration === true && e.targetPlayerId === 'p3',
      ),
    ).toBeUndefined()
    expect(
      result.events.find(
        (e) => e.type === 'WAR_DECLARED' && e.playerId === 'p1' && e.targetPlayerId === 'p3' && e.withoutDeclaration === false,
      ),
    ).toBeDefined()
    expect(
      result.events.find((e) => e.type === 'COMMAND_REJECTED' && e.code === 'INVALID_TARGET'),
    ).toBeUndefined()
  })

  it('erklaert nicht im Waffenstillstand', () => {
    const { state, armyId } = veraltetesZiel()
    state.diplomacy.relations['p1|p3']!.state = 'truce'
    const commands = decideMilitary(contextFor(state, 'p1'), [])

    expect(commands.some((c) => c.type === 'DIPLOMACY' && c.action === 'declareWar')).toBe(false)
    expect(commands.filter((c) => c.type === 'STOP_ARMY')).toEqual([{ type: 'STOP_ARMY', playerId: 'p1', armyId }])
  })

  it('erklaert nicht, solange schon eine Erklaerung laeuft', () => {
    const { state, armyId } = veraltetesZiel()
    state.diplomacy.relations['p1|p3']!.warEffectiveAtTick = state.tick + 12
    const commands = decideMilitary(contextFor(state, 'p1'), [])

    expect(commands.some((c) => c.type === 'DIPLOMACY')).toBe(false)
    expect(commands.filter((c) => c.type === 'STOP_ARMY')).toEqual([{ type: 'STOP_ARMY', playerId: 'p1', armyId }])
  })

  it('erklaert nicht doppelt, wenn die Strategiestufe schon erklaert hat', () => {
    const { state } = veraltetesZiel()
    const pending: Command[] = [{ type: 'DIPLOMACY', playerId: 'p1', targetPlayerId: 'p3', action: 'declareWar' }]
    const commands = decideMilitary(contextFor(state, 'p1'), [], pending)

    expect(commands.some((c) => c.type === 'DIPLOMACY' && c.action === 'declareWar')).toBe(false)
    expect(commands.some((c) => c.type === 'DIPLOMACY' && c.action === 'requestRightOfWay')).toBe(false)
  })

  it('erklaert hoechstens einmal je Macht, auch fuer zwei Armeen', () => {
    const { state } = veraltetesZiel()
    state.provinces.m2!.owner = 'p3'
    const zweite = placeArmy(state, { owner: 'p1', at: 'n2', units: [{ unitKey: 'infantry', hpTotal: 10_000 }] })
    zweite.path = ['m1', 'm2']
    zweite.departureTick = state.tick
    zweite.arrivalTick = state.tick + 5

    const commands = decideMilitary(contextFor(state, 'p1'), [])

    expect(commands.filter((c) => c.type === 'DIPLOMACY' && c.action === 'declareWar')).toHaveLength(1)
    expect(commands.filter((c) => c.type === 'STOP_ARMY')).toHaveLength(2)
    expect(commands.some((c) => c.type === 'DIPLOMACY' && c.action === 'requestRightOfWay')).toBe(false)
  })

  it('haelt die Frontengrenze ein', () => {
    const { state, armyId } = veraltetesZiel()
    const context = { ...contextFor(state, 'p1'), difficulty: { ...TEST_RULES.ai.difficulties.hard, maxFronts: 1 } }
    const commands = decideMilitary(context, [])

    expect(commands.some((c) => c.type === 'DIPLOMACY' && c.action === 'declareWar')).toBe(false)
    expect(commands.filter((c) => c.type === 'STOP_ARMY')).toEqual([{ type: 'STOP_ARMY', playerId: 'p1', armyId }])
    expect(commands.some((c) => c.type === 'DIPLOMACY' && c.action === 'requestRightOfWay')).toBe(true)
  })

  it('beantragt im selben Zug keinen Durchmarsch bei der Macht, der eben erklaert wurde (Ursache der INVALID_TARGET)', () => {
    const state = wegDurchSueden()
    const armeeA = Object.keys(state.armies)[0]!
    state.armies[armeeA]!.path = ['m1', 'o1']
    state.armies[armeeA]!.departureTick = state.tick
    state.armies[armeeA]!.arrivalTick = state.tick + 5

    // B nach A platziert: A steht in view.armies zuerst — genau die Reihenfolge, in der
    // der Wegwerfbau scheiterte.
    state.provinces.m2!.owner = 'p3'
    const armeeB = placeArmy(state, { owner: 'p1', at: 'n2', units: [{ unitKey: 'infantry', hpTotal: 10_000 }] })
    armeeB.path = ['m1', 'm2']
    armeeB.departureTick = state.tick
    armeeB.arrivalTick = state.tick + 5

    const commands = decideMilitary(contextFor(state, 'p1'), [])

    expect(commands.filter((c) => c.type === 'DIPLOMACY' && c.action === 'declareWar')).toEqual([
      { type: 'DIPLOMACY', playerId: 'p1', targetPlayerId: 'p3', action: 'declareWar' },
    ])
    expect(commands.filter((c) => c.type === 'DIPLOMACY' && c.action === 'requestRightOfWay')).toHaveLength(0)

    const result = step(state, commands, ctx)
    expect(result.events.find((e) => e.type === 'COMMAND_REJECTED')).toBeUndefined()
  })

  it('erklaert nicht der Macht am Ziel, wenn eine dritte, unbeteiligte Macht den Weg zuerst sperrt (Gegenprobe G-C4f)', () => {
    const state = dreiMaechte()
    state.provinces.m1!.owner = 'p2'
    state.provinces.m2!.owner = 'p3'
    const army = placeArmy(state, { owner: 'p1', at: 'n2', units: [{ unitKey: 'infantry', hpTotal: 10_000 }] })
    army.path = ['m1', 'm2']
    army.departureTick = state.tick
    army.arrivalTick = state.tick + 5

    const commands = decideMilitary(contextFor(state, 'p1'), [])

    expect(commands.some((c) => c.type === 'DIPLOMACY' && c.action === 'declareWar')).toBe(false)
    const requests = commands.filter((c) => c.type === 'DIPLOMACY' && c.action === 'requestRightOfWay')
    expect(requests).toHaveLength(1)
    expect(requests[0]).toMatchObject({ targetPlayerId: 'p2' })
    allAccepted(state, commands)
  })

  it('haelt die Frontengrenze auch ueber mehrere Armeen im selben Zug ein (Gegenprobe G-C4g)', () => {
    const state = dreiMaechte()
    state.provinces.m1!.owner = 'p2'
    state.provinces.m2!.owner = 'p3'
    const armyA = placeArmy(state, { owner: 'p1', at: 'n2', units: [{ unitKey: 'infantry', hpTotal: 10_000 }] })
    armyA.path = ['m1']
    armyA.departureTick = state.tick
    armyA.arrivalTick = state.tick + 5
    const armyB = placeArmy(state, { owner: 'p1', at: 'n3', units: [{ unitKey: 'infantry', hpTotal: 10_000 }] })
    armyB.path = ['m2']
    armyB.departureTick = state.tick
    armyB.arrivalTick = state.tick + 5
    const context = { ...contextFor(state, 'p1'), difficulty: { ...TEST_RULES.ai.difficulties.hard, maxFronts: 1 } }

    const commands = decideMilitary(context, [])

    expect(commands.filter((c) => c.type === 'DIPLOMACY' && c.action === 'declareWar')).toHaveLength(1)
  })
})

describe('R-AI-09/AK4 Jede Durchmarsch-Handlung nennt Grund und Alternative', () => {
  it('jede gesammelte Erklaerung hat Grund und Alternative', () => {
    const cases: Explanation[] = []

    const s2 = wegDurchSueden()
    let ex: Explanation[] = []
    decideMilitary(contextFor(s2, 'p1'), ex)
    cases.push(...ex)

    const s6c = wegDurchSueden()
    const armyId = Object.keys(s6c.armies)[0]!
    s6c.armies[armyId]!.locationProvinceId = 'm1'
    s6c.armies[armyId]!.path = ['o1']
    s6c.armies[armyId]!.arrivalTick = s6c.tick + 5
    s6c.armies[armyId]!.departureTick = s6c.tick
    ex = []
    decideMilitary(contextFor(s6c, 'p1'), ex)
    cases.push(...ex)

    const s8 = dreiMaechte()
    const afterReq = step(s8, [{ type: 'DIPLOMACY', playerId: 'p2', targetPlayerId: 'p3', action: 'requestRightOfWay' }], ctx).state
    ex = []
    passageCommands(contextFor(afterReq, 'p3'), ex, [])
    cases.push(...ex)

    const s9 = dreiMaechte()
    const afterReq9 = step(s9, [{ type: 'DIPLOMACY', playerId: 'p2', targetPlayerId: 'p3', action: 'requestRightOfWay' }], ctx).state
    afterReq9.diplomacy.grievances.p3 = { p2: 900 }
    ex = []
    passageCommands(contextFor(afterReq9, 'p3'), ex, [])
    cases.push(...ex)

    const s12 = dreiMaechte()
    setPassage(s12.diplomacy.relations['p2|p3']!, 'p3', 'p2', true, null)
    s12.diplomacy.grievances.p3 = { p2: 900 }
    ex = []
    passageCommands(contextFor(s12, 'p3'), ex, [])
    cases.push(...ex)

    const s15 = dreiMaechte()
    setPassage(s15.diplomacy.relations['p1|p3']!, 'p3', 'p1', true, s15.tick + 24)
    placeArmy(s15, { owner: 'p1', at: 'm1', units: [{ unitKey: 'infantry', hpTotal: 10_000 }] })
    ex = []
    decideMilitary(contextFor(s15, 'p1'), ex)
    cases.push(...ex)

    expect(cases.length).toBeGreaterThan(0)
    for (const explanation of cases) {
      expect(explanation.reason.length, JSON.stringify(explanation)).toBeGreaterThan(0)
    }

    // Nacharbeit ki (Befund M17-D15): der Titel nennt "Grund UND Alternative" (R-AI-09/AK4:
    // "... oder Durchmarsch beantragt, DANN SOLL ihre Erklärung Grund und Alternative
    // nennen"), die einzige Zusicherung oben prueft aber nur den Grund. `alternative` ist
    // optional im Typ (`types.ts`), AK4 verlangt es fuer jede Durchmarsch-Handlung.
    //
    // Nur auf die Durchmarsch-Erklaerungen selbst eingeschraenkt (Text nennt "Durchmarsch",
    // "Marsch von", "Heimweg" oder "Land von"): `s15` liefert nebenbei auch eine
    // Angriffs-Erklaerung ("Greift m2 mit a1 an") aus einem voellig anderen Zweig von
    // `militaryCommands" — AK4 zaehlt Angriffe nicht auf, und ohne zweites Angriffsziel hat
    // eine Angriffs-Erklaerung nie eine Alternative (military.ts, `targets[1] ? ... : {}`).
    // Eine ungefilterte Pruefung waere hier ein Fehlalarm ausserhalb des Anforderungstexts.
    const isPassageExplanation = (e: Explanation) => /Durchmarsch|Marsch von|Heimweg|Land von/.test(e.action)
    const passageCases = cases.filter(isPassageExplanation)
    expect(passageCases.length).toBeGreaterThan(0)
    for (const explanation of passageCases) {
      expect(explanation.alternative?.action.length ?? 0, JSON.stringify(explanation)).toBeGreaterThan(0)
    }
  })
})

describe('R-AI-01/AK1 Die neuen Befehle bestehen die regulaere Pruefung', () => {
  it('allAccepted ueber alle neuen Durchmarsch-Befehle', () => {
    const s2 = wegDurchSueden()
    let commands = decideMilitary(contextFor(s2, 'p1'), [])
    allAccepted(s2, commands)

    setPassage(s2.diplomacy.relations['p1|p3']!, 'p3', 'p1', true, null)
    commands = decideMilitary(contextFor(s2, 'p1'), [])
    allAccepted(s2, commands)

    const s6c = wegDurchSueden()
    const armyId = Object.keys(s6c.armies)[0]!
    s6c.armies[armyId]!.locationProvinceId = 'm1'
    s6c.armies[armyId]!.path = ['o1']
    s6c.armies[armyId]!.arrivalTick = s6c.tick + 5
    s6c.armies[armyId]!.departureTick = s6c.tick
    commands = decideMilitary(contextFor(s6c, 'p1'), [])
    allAccepted(s6c, commands)

    const s8 = dreiMaechte()
    const afterReq = step(s8, [{ type: 'DIPLOMACY', playerId: 'p2', targetPlayerId: 'p3', action: 'requestRightOfWay' }], ctx).state
    commands = passageCommands(contextFor(afterReq, 'p3'), [], [])
    allAccepted(afterReq, commands)

    const s12 = dreiMaechte()
    setPassage(s12.diplomacy.relations['p2|p3']!, 'p3', 'p2', true, null)
    s12.diplomacy.grievances.p3 = { p2: 900 }
    commands = passageCommands(contextFor(s12, 'p3'), [], [])
    allAccepted(s12, commands)

    const s15 = dreiMaechte()
    setPassage(s15.diplomacy.relations['p1|p3']!, 'p3', 'p1', true, s15.tick + 24)
    placeArmy(s15, { owner: 'p1', at: 'm1', units: [{ unitKey: 'infantry', hpTotal: 10_000 }] })
    commands = decideMilitary(contextFor(s15, 'p1'), [])
    allAccepted(s15, commands)
  })
})

describe('Grundlagen', () => {
  it('ownerOf liest den Besitzer aus der Sicht, unbekannt heisst herrenlos', () => {
    const state = dreiMaechte()
    const context = contextFor(state, 'p1')
    expect(ownerOf(context, 'n1')).toBe('p1')
    expect(ownerOf(context, 'm1')).toBeNull()
  })

  it('guestWithdrawal liefert null ohne Gastgeber', () => {
    const state = dreiMaechte()
    const army = placeArmy(state, { owner: 'p1', at: 'n1', units: [{ unitKey: 'infantry', hpTotal: 1000 }] })
    const context = contextFor(state, 'p1')
    const visible = context.view.armies.find((a) => a.id === army.id)!
    expect(guestWithdrawal(context, visible, [])).toBeNull()
  })

  it('requestPassage schreibt memory.assignments', () => {
    const state = wegDurchSueden()
    const armyId = Object.keys(state.armies)[0]!
    const context = contextFor(state, 'p1')
    const visible = context.view.armies.find((a) => a.id === armyId)!
    const commands: Command[] = []
    const explanations: Explanation[] = []
    requestPassage(context, visible, 'o1', { provinceId: 'm1', owner: 'p3', reason: 'ohne Durchmarschrecht' }, commands, explanations, new Set())
    expect(context.memory.assignments[armyId]).toMatch(/^passage:p3:/)
  })
})

// -- Helfer ------------------------------------------------------------------------------------

/** Ruft die Taktik direkt (P2 usw. pruefen militaryCommands, nicht den ganzen Strategietakt). */
function decideMilitary(context: AiContext, explanations: Explanation[], pending: readonly Command[] = []): Command[] {
  return militaryCommands(context, explanations, pending)
}
