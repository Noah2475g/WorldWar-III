import { chance, cloneRng, hashValue } from '@worldwar/shared'
import { TEST_RULES, placeArmy, smallWorld } from '@worldwar/testkit'
import { beforeEach, describe, expect, it } from 'vitest'
import '../commands/handlers'
import { canApply } from '../commands/registry'
import type { Command } from '../commands/types'
import { eventsFor } from '../events/emit'
import type { GameEvent } from '../events/types'
import { spySalary } from '../rules/espionage'
import { armyHp } from '../state/army'
import type { RuleConstants, Rules } from '../rules/types'
import { createInitialState, type GameConfig } from '../state/create'
import { HASH_OMIT_KEYS, type GameState, type Spy, type SpyMission } from '../state/types'
import { step } from '../step'
import { publicView, visibleProvinces } from '../view/publicView'
import { settleEspionage } from './espionage'
import type { PhaseContext } from './index'

/**
 * Sold, Tageslauf und Aufklärung (R-SPY-02, R-SPY-03, T-M17-08, D29.3, D29.4, D29.6).
 *
 * Die Testwelt wie in `commands/espionage.test.ts`: p1 (Nordland) hält n1–n3 und sieht von dort
 * m1, m2, i1 und über die Seeverbindung s1. Ostmark (p2, o1–o3) liegt hinter dem Nebel — o1 ist
 * ihre Hauptstadt und das Ziel, an dem sich zeigen lässt, was ein Spion sieht und ohne ihn nicht.
 *
 * **Der Tageswechsel** läuft nach `bookkeeping`: Tick 24 schließt den ersten Tag (0–23), Tick 48
 * den zweiten. „Frühestens am Tag nach der Anwerbung" heißt deshalb: wer während des Tages
 * angesetzt wurde, der gerade endet (`assignedTick ≥ tick − ticksPerDay`), führt noch nichts aus.
 *
 * Zwei Regelvarianten stellen den Ausgang fest, ohne den Zufall zu berühren: `chance()` zieht bei
 * 0 und bei 1000 Promille keine Zahl. Wo es um den Zufall selbst geht, laufen die echten Regeln.
 */

const map = smallWorld()
const C = TEST_RULES.constants
const DAY = C.ticksPerDay

const withConstants = (over: Partial<RuleConstants>): Rules => ({
  ...TEST_RULES,
  constants: { ...TEST_RULES.constants, ...over },
})
/** Aufklärung gelingt immer — ohne einen Zug aus dem Zufall. */
const SURE = withConstants({ spySuccessIntelPermille: 1000 })
/** Aufklärung misslingt immer — ebenso ohne Zug. */
const NEVER = withConstants({ spySuccessIntelPermille: 0 })

const CONFIG: GameConfig = {
  seed: 1917,
  mapId: 'testworld',
  rulesId: 'default',
  players: [
    { name: 'A', kind: 'human', nation: 'Nordland', color: '#0f62bc' },
    { name: 'B', kind: 'ai', nation: 'Ostmark', color: '#b03a2e', difficulty: 'normal' },
    { name: 'C', kind: 'ai', nation: 'Sueden', color: '#2e7d32', difficulty: 'normal' },
  ],
  victory: { condition: 'points', pointsShareToWin: 600, dayLimit: null },
}

let state: GameState

beforeEach(() => {
  state = createInitialState(CONFIG, { map, rules: TEST_RULES })
})

const hashOf = (s: GameState) => hashValue(s, { omitKeys: HASH_OMIT_KEYS })
const money = (s: GameState, playerId = 'p1') => s.players[playerId]!.resources.money

/** Setzt einen Spion direkt in den Zustand — angesetzt zu Beginn der Partie, also am ersten Tag. */
function placeSpy(
  s: GameState,
  options: { owner?: string; provinceId: string; mission: SpyMission; assignedTick?: number },
): Spy {
  const spy: Spy = {
    id: `s${s.nextIds.spy++}`,
    owner: options.owner ?? 'p1',
    provinceId: options.provinceId,
    mission: options.mission,
    recruitedTick: options.assignedTick ?? 0,
    assignedTick: options.assignedTick ?? 0,
    lastRunTick: null,
    lastOutcome: null,
  }
  s.espionage.spies.push(spy)
  return spy
}

/** Ein Tageswechsel, unmittelbar: der Zustand steht auf `tick` (ein Vielfaches von 24). */
function settleAt(s: GameState, tick: number, rules: Rules = TEST_RULES): GameEvent[] {
  s.tick = tick
  const events: GameEvent[] = []
  const ctx: PhaseContext = { map, rules, commands: [], events }
  settleEspionage(s, ctx)
  return events
}

/** Läuft die Partie Tick für Tick bis `until`; `commandsAt` liefert die Befehle eines Ticks. */
function runUntil(
  s: GameState,
  until: number,
  rules: Rules = TEST_RULES,
  commandsAt: (tick: number) => Command[] = () => [],
): { state: GameState; events: GameEvent[] } {
  let current = s
  const events: GameEvent[] = []
  while (current.tick < until) {
    const result = step(current, commandsAt(current.tick), { map, rules })
    current = result.state
    events.push(...result.events)
  }
  return { state: current, events }
}

const ofType = <T extends GameEvent['type']>(events: readonly GameEvent[], type: T) =>
  events.filter((event): event is Extract<GameEvent, { type: T }> => event.type === type)

/** Ostburg (o1) mit Gebäuden und einer gemischten Armee — das, was nur ein Spion zeigt. */
function fortifyOstburg(s: GameState) {
  s.provinces['o1']!.buildings = { barracks: 2, fortress: 1 }
  return placeArmy(s, {
    owner: 'p2',
    at: 'o1',
    units: [
      { unitKey: 'infantry', hpTotal: 30_000 },
      { unitKey: 'tank', hpTotal: 12_000 },
    ],
  })
}

describe('R-SPY-02/AK1 Je Spion genau einmal Sold und genau einmal der Auftrag', () => {
  it('zieht jedem Spion am Tageswechsel genau den Sold seines Auftrags ab', () => {
    placeSpy(state, { provinceId: 's1', mission: 'intel' })
    placeSpy(state, { provinceId: 's1', mission: 'economicSabotage' })
    placeSpy(state, { provinceId: 's2', mission: 'militarySabotage' })
    placeSpy(state, { provinceId: 'n1', mission: 'counter' })
    const vorher = money(state)
    const p3vorher = money(state, 'p3')

    settleAt(state, 2 * DAY, NEVER)

    const sold = (['intel', 'economicSabotage', 'militarySabotage', 'counter'] as const)
      .map((mission) => spySalary(C, mission))
      .reduce((a, b) => a + b, 0)
    expect(vorher - money(state)).toBe(sold)
    expect(money(state, 'p3'), 'wer keinen Spion hat, zahlt nichts').toBe(p3vorher)
    expect(state.espionage.spies).toHaveLength(4)
  })

  it('bucht im Spiel am Tageswechsel ab und in den Stunden dazwischen nicht', () => {
    // Zwei Läufe, einer mit Spion: der Unterschied im Geld ist vor dem ersten Tageswechsel null
    // und danach genau ein Sold je vergangenem Tag — `dailyTick` ruft den Tageslauf, `step` nie.
    const mit = createInitialState(CONFIG, { map, rules: SURE })
    placeSpy(mit, { provinceId: 's1', mission: 'intel' })
    let a = state
    let b = mit
    for (let tick = 1; tick <= 3 * DAY; tick++) {
      a = step(a, [], { map, rules: SURE }).state
      b = step(b, [], { map, rules: SURE }).state
      const tage = Math.floor(tick / DAY)
      expect(money(a) - money(b), `nach Tick ${tick}`).toBe(tage * C.spySalaryIntel)
    }
  })

  it('führt jeden Auftrag an jedem Tageswechsel genau einmal aus', () => {
    placeSpy(state, { provinceId: 's1', mission: 'intel' })
    placeSpy(state, { owner: 'p3', provinceId: 'n1', mission: 'intel' })

    const { state: nachher, events } = runUntil(state, 5 * DAY, SURE)
    const berichte = ofType(events, 'SPY_REPORT')

    // Angesetzt an Tag 1 (Tick 0): der Wechsel bei 24 schließt diesen Tag, ausgeführt wird bei
    // 48, 72, 96 und 120 — je Spion viermal, je Wechsel einmal.
    for (const spyId of ['s1', 's2']) {
      expect(berichte.filter((e) => e.spyId === spyId).map((e) => e.tick), spyId).toEqual([48, 72, 96, 120])
    }
    expect(nachher.espionage.spies.map((spy) => [spy.id, spy.lastRunTick, spy.lastOutcome])).toEqual([
      ['s1', 120, 'success'],
      ['s2', 120, 'success'],
    ])
  })

  it('arbeitet die Spione in der Reihenfolge des Zustands ab', () => {
    placeSpy(state, { owner: 'p3', provinceId: 'n1', mission: 'intel' })
    placeSpy(state, { provinceId: 's1', mission: 'intel' })
    placeSpy(state, { provinceId: 'm1', mission: 'intel' })

    const events = settleAt(state, 2 * DAY, SURE)

    expect(ofType(events, 'SPY_REPORT').map((e) => e.spyId)).toEqual(['s1', 's2', 's3'])
  })

  it('würfelt aus dem geseedeten Zufall des Zustands, mit der Regelchance', () => {
    placeSpy(state, { provinceId: 's1', mission: 'intel' })
    const erwartet = cloneRng(state.rng)
    const gelingt = chance(erwartet, C.spySuccessIntelPermille)

    const events = settleAt(state, 2 * DAY)

    expect(ofType(events, 'SPY_REPORT')[0]!.outcome).toBe(gelingt ? 'success' : 'failure')
    // Genau dieser eine Zug, sonst keiner.
    expect(state.rng).toEqual(erwartet)
  })

  it('kennt beide Ausgänge — der Wurf ist echt, nicht festgelegt', () => {
    const ausgaenge = new Set<string>()
    for (let seed = 1; seed <= 40; seed++) {
      const s = createInitialState({ ...CONFIG, seed }, { map, rules: TEST_RULES })
      placeSpy(s, { provinceId: 's1', mission: 'intel' })
      ausgaenge.add(ofType(settleAt(s, 2 * DAY), 'SPY_REPORT')[0]!.outcome)
    }
    expect([...ausgaenge].sort()).toEqual(['failure', 'success'])
  })

  it('verbraucht keinen Zufall und ändert nichts, wenn es keine Spione gibt', () => {
    state.tick = 2 * DAY
    const vorher = hashOf(state)

    settleAt(state, 2 * DAY)

    expect(hashOf(state)).toBe(vorher)
  })

  it('verbraucht keinen Zufall für einen Spion, der heute noch nicht ausführt', () => {
    placeSpy(state, { provinceId: 's1', mission: 'intel', assignedTick: DAY + 5 })
    const rng = cloneRng(state.rng)

    settleAt(state, 2 * DAY)

    expect(state.rng).toEqual(rng)
  })
})

describe('R-SPY-02/AK2 Wer den Sold nicht zahlen kann, verliert den Spion', () => {
  it('entfernt ihn, bucht nichts ab und nennt dem Besitzer den Grund', () => {
    placeSpy(state, { provinceId: 's1', mission: 'intel' })
    state.players['p1']!.resources.money = C.spySalaryIntel - 1

    const events = settleAt(state, 2 * DAY, SURE)

    expect(state.espionage.spies).toEqual([])
    expect(money(state), 'nie ein negativer Bestand, nie ein Teilbetrag').toBe(C.spySalaryIntel - 1)
    expect(ofType(events, 'SPY_LOST')).toEqual([
      {
        type: 'SPY_LOST',
        tick: 2 * DAY,
        severity: 'info',
        audience: ['p1'],
        concerns: ['p1'],
        playerId: 'p1',
        spyId: 's1',
        provinceId: 's1',
        mission: 'intel',
        reason: 'unpaid',
      },
    ])
    expect(ofType(events, 'SPY_REPORT'), 'ein verlorener Spion führt nichts mehr aus').toEqual([])
  })

  it('behält ihn, wenn der Bestand genau reicht', () => {
    placeSpy(state, { provinceId: 's1', mission: 'intel' })
    state.players['p1']!.resources.money = C.spySalaryIntel

    const events = settleAt(state, 2 * DAY, SURE)

    expect(state.espionage.spies).toHaveLength(1)
    expect(money(state)).toBe(0)
    expect(ofType(events, 'SPY_LOST')).toEqual([])
  })

  it('zahlt in der Reihenfolge des Zustands — der spätere geht, wenn das Geld nur für einen reicht', () => {
    placeSpy(state, { provinceId: 's1', mission: 'intel' })
    placeSpy(state, { provinceId: 'n1', mission: 'counter' })
    // Reicht für den ersten und um ein Tausendstel nicht mehr für den zweiten.
    state.players['p1']!.resources.money = C.spySalaryIntel + C.spySalaryCounter - 1

    const events = settleAt(state, 2 * DAY, NEVER)

    expect(state.espionage.spies.map((spy) => spy.id)).toEqual(['s1'])
    expect(ofType(events, 'SPY_LOST').map((e) => e.spyId)).toEqual(['s2'])
    expect(money(state)).toBe(C.spySalaryCounter - 1)
  })

  it('verbraucht für einen verlorenen Spion keinen Zufall', () => {
    placeSpy(state, { provinceId: 's1', mission: 'intel' })
    state.players['p1']!.resources.money = 0
    const rng = cloneRng(state.rng)

    settleAt(state, 2 * DAY)

    expect(state.rng).toEqual(rng)
  })
})

describe('R-SPY-02/AK3 Am Tag der Anwerbung führt ein Spion noch nichts aus', () => {
  const recruitAt =
    (tick: number, provinceId = 's1'): ((now: number) => Command[]) =>
    (now) =>
      now === tick ? [{ type: 'RECRUIT_SPY', playerId: 'p1', provinceId, mission: 'intel' } as Command] : []

  for (const angeworben of [DAY, DAY + 7, 2 * DAY - 1]) {
    it(`angeworben in Tick ${angeworben}: der Wechsel bei 48 zahlt Sold, ausgeführt wird erst bei 72`, () => {
      const bis48 = runUntil(state, 2 * DAY, SURE, recruitAt(angeworben))
      expect(bis48.state.espionage.spies).toHaveLength(1)
      expect(ofType(bis48.events, 'SPY_REPORT')).toEqual([])
      expect(bis48.state.espionage.spies[0]!.lastRunTick).toBeNull()

      const bis72 = runUntil(bis48.state, 3 * DAY, SURE)
      expect(ofType(bis72.events, 'SPY_REPORT').map((e) => e.tick)).toEqual([3 * DAY])
    })
  }

  it('fängt auch nach dem Umsetzen erst am Tag danach wieder an', () => {
    placeSpy(state, { provinceId: 's1', mission: 'intel' })
    const umsetzen = (now: number): Command[] =>
      now === 2 * DAY + 2
        ? [{ type: 'REASSIGN_SPY', playerId: 'p1', spyId: 's1', provinceId: 'm1', mission: 'intel' } as Command]
        : []

    const { events } = runUntil(state, 4 * DAY, SURE, umsetzen)
    const berichte = ofType(events, 'SPY_REPORT').map((e) => `${e.tick}:${e.provinceId}`)

    // 48 noch am alten Ziel; umgesetzt in Tick 50, also nichts bei 72; am neuen Ziel ab 96.
    expect(berichte).toEqual(['48:s1', '96:m1'])
  })
})

describe('R-SPY-03/AK1 Gelungene Aufklärung zeigt die Provinz mit Gebäuden und Armeen', () => {
  it('führt die Zielprovinz als beobachtet — mit Gebäuden und der Zusammensetzung der Armee', () => {
    const armee = fortifyOstburg(state)
    placeSpy(state, { provinceId: 'o1', mission: 'intel' })

    const vorher = publicView(state, 'p1')
    expect(vorher.provinces.find((p) => p.id === 'o1'), 'o1 liegt vorher hinter dem Nebel').toBeUndefined()
    expect(vorher.armies.find((a) => a.id === armee.id)).toBeUndefined()

    settleAt(state, 2 * DAY, SURE)
    const view = publicView(state, 'p1', TEST_RULES)

    const o1 = view.provinces.find((p) => p.id === 'o1')!
    expect(o1).toMatchObject({ owner: 'p2', stale: false, asOfTick: 2 * DAY })
    expect(o1.buildings).toEqual({ barracks: 2, fortress: 1 })
    expect(o1.revealedUntilTick).toBe(3 * DAY)
    const gesehen = view.armies.find((a) => a.id === armee.id)!
    expect(gesehen.units).toEqual([
      { unitKey: 'infantry', hpTotal: 30_000 },
      { unitKey: 'tank', hpTotal: 12_000 },
    ])
  })

  it('zeigt Gebäude und Armeen, aber nichts vom Innenleben einer fremden Provinz', () => {
    const armee = fortifyOstburg(state)
    state.provinces['o1']!.buildQueue = [
      { id: 'o9', building: 'factory', level: 1, startedTick: 0, completesAtTick: 500, ownerAtStart: 'p2' },
    ]
    placeSpy(state, { provinceId: 'o1', mission: 'intel' })
    settleAt(state, 2 * DAY, SURE)

    const view = publicView(state, 'p1', TEST_RULES)
    const o1 = view.provinces.find((p) => p.id === 'o1')!
    for (const feld of ['morale', 'population', 'deposits', 'buildQueueLength', 'buildQueue', 'recruitQueue', 'moraleTarget']) {
      expect(o1, feld).not.toHaveProperty(feld)
    }
    const gesehen = view.armies.find((a) => a.id === armee.id)!
    for (const feld of ['stance', 'path', 'arrivalTick', 'departureTick']) {
      expect(gesehen, feld).not.toHaveProperty(feld)
    }
  })

  it('deckt nur die Zielprovinz auf, nicht ihre Nachbarn', () => {
    placeSpy(state, { provinceId: 'o1', mission: 'intel' })
    settleAt(state, 2 * DAY, SURE)

    const sichtbar = visibleProvinces(state, 'p1')
    expect(sichtbar.has('o1')).toBe(true)
    expect(sichtbar.has('o2')).toBe(false)
    expect(sichtbar.has('o3')).toBe(false)
  })

  it('zeigt die Aufdeckung nur dem, dessen Spion sie gewonnen hat', () => {
    fortifyOstburg(state)
    placeSpy(state, { provinceId: 'o1', mission: 'intel' })
    settleAt(state, 2 * DAY, SURE)

    expect(visibleProvinces(state, 'p3').has('o1')).toBe(false)
    expect(publicView(state, 'p3').provinces.find((p) => p.id === 'o1')).toBeUndefined()
    // Und der Ausgespähte sieht an seiner eigenen Provinz nichts Neues.
    expect(publicView(state, 'p2').provinces.find((p) => p.id === 'o1')).not.toHaveProperty('revealedUntilTick')
  })

  it('gibt einer bereits sichtbaren fremden Provinz Gebäude und Zusammensetzung dazu', () => {
    // s1 sieht p1 ohnehin über die Seeverbindung — als Umriss mit Stärke, ohne Gebäude.
    state.provinces['s1']!.buildings = { harbour: 1 }
    const armee = placeArmy(state, { owner: 'p3', at: 's1', units: [{ unitKey: 'infantry', hpTotal: 8_000 }] })
    const ohne = publicView(state, 'p1')
    expect(ohne.provinces.find((p) => p.id === 's1')).not.toHaveProperty('buildings')
    expect(ohne.armies.find((a) => a.id === armee.id)).not.toHaveProperty('units')

    placeSpy(state, { provinceId: 's1', mission: 'intel' })
    settleAt(state, 2 * DAY, SURE)
    const mit = publicView(state, 'p1')

    expect(mit.provinces.find((p) => p.id === 's1')!.buildings).toEqual({ harbour: 1 })
    expect(mit.armies.find((a) => a.id === armee.id)!.units).toEqual([{ unitKey: 'infantry', hpTotal: 8_000 }])
  })

  it('eine Aufdeckung der Armeen zeigt die Zusammensetzung, aber keine Gebäude (D29.6)', () => {
    const armee = fortifyOstburg(state)
    state.tick = 2 * DAY
    state.espionage.reveals.push({ player: 'p1', provinceId: 'o1', kind: 'armies', untilTick: 3 * DAY })

    const view = publicView(state, 'p1')
    const o1 = view.provinces.find((p) => p.id === 'o1')!

    expect(o1.stale).toBe(false)
    expect(o1).not.toHaveProperty('buildings')
    expect(o1).not.toHaveProperty('revealedUntilTick')
    expect(view.armies.find((a) => a.id === armee.id)!.units).toHaveLength(2)
  })

  it('macht die Provinz bekannt: dorthin kann ein weiterer Spion angeworben werden', () => {
    placeSpy(state, { provinceId: 'o1', mission: 'intel' })
    const ctx: PhaseContext = { map, rules: TEST_RULES, commands: [], events: [] }
    const nach = { type: 'RECRUIT_SPY', playerId: 'p1', provinceId: 'o1', mission: 'economicSabotage' } as Command

    expect(canApply(state, nach, ctx)).toEqual({ ok: false, code: 'INVALID_TARGET', detail: { reason: 'unbekannt' } })
    settleAt(state, 2 * DAY, SURE)
    expect(canApply(state, nach, ctx)).toEqual({ ok: true })
  })
})

describe('R-SPY-03/AK2 Ohne Spion oder nach Misserfolg fällt die Provinz zurück in den Nebel', () => {
  /** Bis 48 gelingt die Aufklärung, danach liefert `rest` die Regeln und Befehle. */
  function aufgedecktBis48() {
    const armee = fortifyOstburg(state)
    placeSpy(state, { provinceId: 'o1', mission: 'intel' })
    const bis48 = runUntil(state, 2 * DAY, SURE)
    expect(publicView(bis48.state, 'p1').provinces.find((p) => p.id === 'o1')!.stale).toBe(false)
    return { armee, state: bis48.state }
  }

  it('nach einem Misserfolg zum nächsten Tageswechsel — das Gedächtnis behält den letzten Stand', () => {
    const { armee, state: s48 } = aufgedecktBis48()

    // Den ganzen Tag über bleibt sie aufgedeckt …
    const bis71 = runUntil(s48, 3 * DAY - 1, NEVER)
    expect(publicView(bis71.state, 'p1').provinces.find((p) => p.id === 'o1')!.stale).toBe(false)

    // … und der Wechsel bei 72 misslingt.
    const bis72 = runUntil(bis71.state, 3 * DAY, NEVER)
    expect(ofType(bis72.events, 'SPY_REPORT').map((e) => e.outcome)).toEqual(['failure'])

    const view = publicView(bis72.state, 'p1')
    const o1 = view.provinces.find((p) => p.id === 'o1')!
    expect(o1).toMatchObject({ owner: 'p2', stale: true, asOfTick: 3 * DAY - 1 })
    expect(o1).not.toHaveProperty('buildings')
    expect(view.armies.find((a) => a.id === armee.id)).toBeUndefined()
    expect(bis72.state.players['p1']!.intel['o1']).toEqual({
      tick: 3 * DAY - 1,
      owner: 'p2',
      strength: armyHp(bis72.state.armies[armee.id]!),
    })
    expect(bis72.state.espionage.reveals).toEqual([])
  })

  it('nach dem Entlassen ebenfalls erst zum nächsten Tageswechsel', () => {
    const { state: s48 } = aufgedecktBis48()
    const entlassen = (now: number): Command[] =>
      now === 2 * DAY + 3 ? [{ type: 'DISMISS_SPY', playerId: 'p1', spyId: 's1' } as Command] : []

    const bis71 = runUntil(s48, 3 * DAY - 1, NEVER, entlassen)
    expect(bis71.state.espionage.spies).toEqual([])
    expect(visibleProvinces(bis71.state, 'p1').has('o1'), 'das Entlassen nimmt die Aufdeckung nicht sofort').toBe(true)

    const bis72 = runUntil(bis71.state, 3 * DAY, NEVER)
    expect(visibleProvinces(bis72.state, 'p1').has('o1')).toBe(false)
    expect(publicView(bis72.state, 'p1').provinces.find((p) => p.id === 'o1')!.stale).toBe(true)
  })

  it('nach dem Verlust mangels Sold am selben Tageswechsel', () => {
    fortifyOstburg(state)
    placeSpy(state, { provinceId: 'o1', mission: 'intel' })
    settleAt(state, 2 * DAY, SURE)
    expect(visibleProvinces(state, 'p1').has('o1')).toBe(true)

    state.players['p1']!.resources.money = 0
    const events = settleAt(state, 3 * DAY, SURE)

    expect(ofType(events, 'SPY_LOST')).toHaveLength(1)
    expect(state.espionage.reveals).toEqual([])
    expect(visibleProvinces(state, 'p1').has('o1')).toBe(false)
  })

  it('bleibt ohne Lücke aufgedeckt, solange der Spion jeden Tag Erfolg hat', () => {
    fortifyOstburg(state)
    placeSpy(state, { provinceId: 'o1', mission: 'intel' })
    const { state: s96, events } = runUntil(state, 4 * DAY, SURE, () => [])
    expect(ofType(events, 'SPY_REPORT')).toHaveLength(3)

    // Nie mehr als eine Aufdeckung je Macht, Provinz und Art — sie wird verlängert, nicht gestapelt.
    expect(s96.espionage.reveals).toEqual([{ player: 'p1', provinceId: 'o1', kind: 'intel', untilTick: 5 * DAY }])
    // Das Gedächtnis ist auf dem Stand der letzten Stunde, weil die Provinz durchgehend sichtbar war.
    expect(s96.players['p1']!.intel['o1']!.tick).toBe(4 * DAY - 1)
  })
})

describe('D29.3 (d) Ein Ziel, das nicht mehr zum Auftrag passt, wird nicht gewürfelt', () => {
  it('Aufklärung in einer inzwischen eigenen Provinz: targetChanged, kein Zug, keine Aufdeckung', () => {
    placeSpy(state, { provinceId: 'o1', mission: 'intel' })
    state.provinces['o1']!.owner = 'p1'
    const rng = cloneRng(state.rng)

    const events = settleAt(state, 2 * DAY)

    expect(ofType(events, 'SPY_REPORT').map((e) => e.outcome)).toEqual(['targetChanged'])
    expect(state.rng).toEqual(rng)
    expect(state.espionage.reveals).toEqual([])
    expect(state.espionage.spies[0]).toMatchObject({ lastRunTick: 2 * DAY, lastOutcome: 'targetChanged' })
  })

  it('Sabotage in einer inzwischen herrenlosen Provinz: targetChanged, kein Zug', () => {
    placeSpy(state, { provinceId: 'o2', mission: 'economicSabotage' })
    state.provinces['o2']!.owner = null
    const rng = cloneRng(state.rng)

    const events = settleAt(state, 2 * DAY)

    expect(ofType(events, 'SPY_REPORT').map((e) => [e.spyId, e.outcome])).toEqual([['s1', 'targetChanged']])
    expect(state.rng).toEqual(rng)
  })

  it('Aufklärung in einer herrenlosen Provinz passt weiter — dort wird gewürfelt', () => {
    placeSpy(state, { provinceId: 'm1', mission: 'intel' })

    const events = settleAt(state, 2 * DAY, SURE)

    expect(ofType(events, 'SPY_REPORT').map((e) => e.outcome)).toEqual(['success'])
  })
})

describe('R-DIP-04 Der Tageslauf verrät niemandem etwas, das er nicht wissen darf', () => {
  it('meldet Bericht und Verlust nur dem Besitzer — der Ausgespähte erfährt nichts', () => {
    fortifyOstburg(state)
    placeSpy(state, { provinceId: 'o1', mission: 'intel' })
    placeSpy(state, { provinceId: 'o1', mission: 'intel' })
    state.players['p1']!.resources.money = C.spySalaryIntel

    const events = settleAt(state, 2 * DAY, SURE)

    expect(events.map((e) => e.type).sort()).toEqual(['SPY_LOST', 'SPY_REPORT'])
    for (const event of events) {
      expect(event.audience, event.type).toEqual(['p1'])
      expect(event.concerns, event.type).toEqual(['p1'])
      expect(event.severity, `${event.type} ist kein Alarm`).toBe('info')
    }
    expect(eventsFor(events, 'p2')).toEqual([])
    expect(eventsFor(events, 'p3')).toEqual([])
  })

  it('trägt im Bericht nur Kennung, Ziel, Auftrag und Ausgang — nichts vom Gesehenen', () => {
    fortifyOstburg(state)
    placeSpy(state, { provinceId: 'o1', mission: 'intel' })

    const [bericht] = ofType(settleAt(state, 2 * DAY, SURE), 'SPY_REPORT')

    expect(Object.keys(bericht!).sort()).toEqual(
      ['audience', 'concerns', 'mission', 'outcome', 'playerId', 'provinceId', 'severity', 'spyId', 'tick', 'type'],
    )
  })

  it('führt Ausgang und Tag in der eigenen Sicht der Spione', () => {
    placeSpy(state, { provinceId: 's1', mission: 'intel' })
    settleAt(state, 2 * DAY, SURE)

    expect(publicView(state, 'p1').espionage.spies[0]).toMatchObject({ lastRunTick: 2 * DAY, lastOutcome: 'success' })
    expect(publicView(state, 'p3').espionage.spies).toEqual([])
  })
})
