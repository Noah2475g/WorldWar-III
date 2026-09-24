import { chance, cloneRng, hashValue, mulFixed } from '@worldwar/shared'
import { TEST_RULES, placeArmy, smallWorld } from '@worldwar/testkit'
import { beforeEach, describe, expect, it } from 'vitest'
import '../commands/handlers'
import { canApply } from '../commands/registry'
import type { Command } from '../commands/types'
import { fastForward, firstAlertFor } from '../clock'
import { eventsFor } from '../events/emit'
import { isAlertType, type GameEvent } from '../events/types'
import { spySalary } from '../rules/espionage'
import { armyHp } from '../state/army'
import type { RuleConstants, Rules } from '../rules/types'
import { createInitialState, type GameConfig } from '../state/create'
import { HASH_OMIT_KEYS, type GameState, type ResourceKey, type Spy, type SpyMission } from '../state/types'
import { step } from '../step'
import { publicView, visibleProvinces } from '../view/publicView'
import { capitalPenalty, provinceYieldScaled } from './production'
import { dailyTick } from './dailyTick'
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
/** Aufklärung und Sabotage misslingen immer — ebenso ohne Zug. */
const NEVER = withConstants({ spySuccessIntelPermille: 0, spySuccessSabotagePermille: 0 })
/** Sabotage gelingt immer — ohne Zug. */
const SABOTAGE = withConstants({ spySuccessSabotagePermille: 1000 })
/** Ein Gegenspion enttarnt immer — ohne Zug. */
const DETECT = withConstants({ spyDetectionPermille: 1000 })
/** Beides sicher. */
const SABOTAGE_DETECT = withConstants({ spySuccessSabotagePermille: 1000, spyDetectionPermille: 1000 })

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

/** Der Tagesertrag einer Provinz in Festkomma, so wie die Sabotage ihn bemisst — vor dem Anschlag. */
function tagesertrag(s: GameState, provinceId: string, rules: Rules = TEST_RULES): Partial<Record<ResourceKey, number>> {
  const province = s.provinces[provinceId]!
  const owner = s.players[province.owner!]!
  const out: Partial<Record<ResourceKey, number>> = {}
  for (const [key, scaled] of Object.entries(provinceYieldScaled(province, s.tick, capitalPenalty(owner, s.tick, rules), rules))) {
    if (scaled && scaled > 0) out[key as ResourceKey] = mulFixed(mulFixed(scaled, rules.constants.ticksPerDay), rules.constants.sabotageYieldDestroyedPermille)
  }
  return out
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

  it('eine abgelaufene Aufdeckung zeigt nichts, auch wenn sie noch im Zustand steht', () => {
    // Der Tageslauf nimmt sie am Wechsel weg; die Sicht urteilt trotzdem selbst nach `untilTick`,
    // damit ein Stand, der zwischen Wechsel und Aufräumen entstand, nicht mehr zeigt als erlaubt.
    fortifyOstburg(state)
    state.tick = 3 * DAY
    state.espionage.reveals.push({ player: 'p1', provinceId: 'o1', kind: 'intel', untilTick: 3 * DAY })

    expect(visibleProvinces(state, 'p1').has('o1')).toBe(false)
    expect(publicView(state, 'p1').provinces.find((p) => p.id === 'o1')).toBeUndefined()
  })

  it('zwei Aufklärer am selben Ziel ergeben eine Aufdeckung, nicht zwei', () => {
    placeSpy(state, { provinceId: 'o1', mission: 'intel' })
    placeSpy(state, { provinceId: 'o1', mission: 'intel' })

    const events = settleAt(state, 2 * DAY, SURE)

    expect(ofType(events, 'SPY_REPORT').map((e) => e.outcome)).toEqual(['success', 'success'])
    expect(state.espionage.reveals).toEqual([{ player: 'p1', provinceId: 'o1', kind: 'intel', untilTick: 3 * DAY }])
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

  it('läuft nach der Moral: ein Aufstand desselben Tageswechsels ist für den Spion schon geschehen', () => {
    // D29.3: `settleMorale` → `settleEspionage`. Mit dieser Aufstandschance ist o2 sicher verloren
    // (1000 Promille je Punkt unter der Schwelle, gekappt auf 1000 — kein Zug aus dem Zufall).
    const rules = withConstants({ revoltChancePerPointPermille: 1000 })
    state.provinces['o2']!.morale = 0
    placeSpy(state, { provinceId: 'o2', mission: 'economicSabotage' })
    state.tick = 2 * DAY
    const events: GameEvent[] = []

    dailyTick(state, { map, rules, commands: [], events })

    expect(ofType(events, 'PROVINCE_REVOLTED').map((e) => e.provinceId)).toEqual(['o2'])
    // Vorher gelaufen, hätte der Saboteur eine Provinz von p2 gesehen — und kein Ziel verloren.
    expect(ofType(events, 'SPY_REPORT').map((e) => [e.provinceId, e.outcome])).toEqual([['o2', 'targetChanged']])
    const typen = events.map((e) => e.type)
    expect(typen.indexOf('PROVINCE_REVOLTED')).toBeLessThan(typen.indexOf('SPY_REPORT'))
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

describe('R-SPY-04/AK1 Wirtschaftssabotage senkt die Moral und vernichtet Ertrag, nie mehr als da ist', () => {
  beforeEach(() => {
    placeSpy(state, { provinceId: 'o1', mission: 'economicSabotage' })
  })

  it('senkt die Moral der Zielprovinz um den Regelwert (R-SPY-04/AK1)', () => {
    state.provinces['o1']!.morale = 50_000
    const targetMorale = state.provinces['o1']!.targetMorale

    const events = settleAt(state, 2 * DAY, SABOTAGE)

    expect(state.provinces['o1']!.morale).toBe(50_000 - C.sabotageMoraleLoss)
    expect(state.provinces['o1']!.targetMorale).toBe(targetMorale)
    const [suffered] = ofType(events, 'SABOTAGE_SUFFERED')
    expect(suffered!.moraleLoss).toBe(C.sabotageMoraleLoss)
  })

  it('der Regelwert ist der belegte: −10 Moral (Referenz 4.6)', () => {
    expect(C.sabotageMoraleLoss).toBe(10_000)
  })

  it('drückt die Moral nie unter null', () => {
    state.provinces['o1']!.morale = 4_000

    const events = settleAt(state, 2 * DAY, SABOTAGE)

    expect(state.provinces['o1']!.morale).toBe(0)
    expect(ofType(events, 'SABOTAGE_SUFFERED')[0]!.moraleLoss).toBe(4_000)
  })

  it('vernichtet beim Eigentümer genau den Regelanteil des Tagesertrags dieser Provinz (R-SPY-04/AK1)', () => {
    const vorher = { ...state.players['p2']!.resources }
    const erwartet = tagesertrag(state, 'o1')
    expect(Object.keys(erwartet).length, 'leerer Beweis: o1 hat Geld und Eisen').toBeGreaterThanOrEqual(2)

    const events = settleAt(state, 2 * DAY, SABOTAGE)

    const nachher = state.players['p2']!.resources
    for (const key of Object.keys(vorher) as ResourceKey[]) {
      const erwarteterVerlust = erwartet[key] ?? 0
      expect(vorher[key] - nachher[key], key).toBe(erwarteterVerlust)
    }
    expect(ofType(events, 'SABOTAGE_SUFFERED')[0]!.destroyed).toEqual(erwartet)
  })

  it('bemisst den Anteil am Ertrag VOR dem Moralabzug', () => {
    state.provinces['o1']!.morale = 60_000
    const erwartet = tagesertrag(state, 'o1')
    const kopie = structuredClone(state)
    kopie.provinces['o1']!.morale = 50_000
    const nachAbzug = tagesertrag(kopie, 'o1')
    expect(nachAbzug, 'Vorbedingung: der Ertrag müsste sich mit der Moral ändern').not.toEqual(erwartet)

    const events = settleAt(state, 2 * DAY, SABOTAGE)

    expect(ofType(events, 'SABOTAGE_SUFFERED')[0]!.destroyed).toEqual(erwartet)
  })

  it('nie ein negativer Bestand — höchstens, was der Eigentümer hat', () => {
    state.players['p2']!.resources.money = 1
    state.players['p2']!.resources.iron = 0

    const events = settleAt(state, 2 * DAY, SABOTAGE)

    expect(state.players['p2']!.resources.money).toBe(0)
    expect(state.players['p2']!.resources.iron).toBe(0)
    expect(ofType(events, 'SABOTAGE_SUFFERED')[0]!.destroyed).toEqual({ money: 1 })
    for (const value of Object.values(state.players['p2']!.resources)) {
      expect(value).toBeGreaterThanOrEqual(0)
    }
  })

  it('trifft nur den Eigentümer — der Saboteur zahlt nur seinen Sold, der Dritte nichts', () => {
    const p1vorher = { ...state.players['p1']!.resources }
    const p3vorher = { ...state.players['p3']!.resources }

    settleAt(state, 2 * DAY, SABOTAGE)

    expect(p1vorher.money - state.players['p1']!.resources.money).toBe(C.spySalaryEconomicSabotage)
    for (const key of Object.keys(p1vorher) as ResourceKey[]) {
      if (key === 'money') continue
      expect(state.players['p1']!.resources[key]).toBe(p1vorher[key])
    }
    expect(state.players['p3']!.resources).toEqual(p3vorher)
  })

  it('ein misslungener Versuch bewirkt nichts und meldet dem Opfer nichts', () => {
    const morale = state.provinces['o1']!.morale
    const resources = { ...state.players['p2']!.resources }

    const events = settleAt(state, 2 * DAY, NEVER)

    expect(state.provinces['o1']!.morale).toBe(morale)
    expect(state.players['p2']!.resources).toEqual(resources)
    expect(eventsFor(events, 'p2')).toEqual([])
    expect(ofType(events, 'SPY_REPORT')[0]!.outcome).toBe('failure')
  })

  it('würfelt mit der Sabotagechance aus dem Zufall des Zustands — genau ein Zug', () => {
    const erwartet = cloneRng(state.rng)
    const gelingt = chance(erwartet, C.spySuccessSabotagePermille)

    const events = settleAt(state, 2 * DAY)

    expect(ofType(events, 'SPY_REPORT')[0]!.outcome).toBe(gelingt ? 'success' : 'failure')
    expect(state.rng).toEqual(erwartet)
  })

  it('liest die Sabotagechance, nicht die der Aufklärung', () => {
    const rules = withConstants({ spySuccessIntelPermille: 0, spySuccessSabotagePermille: 1000 })

    const events = settleAt(state, 2 * DAY, rules)

    expect(ofType(events, 'SPY_REPORT')[0]!.outcome).toBe('success')
  })
})

describe('R-SPY-04/AK2 Militaerische Sabotage verzoegert laufende Auftraege und deckt die Armeen auf', () => {
  beforeEach(() => {
    placeSpy(state, { provinceId: 'o1', mission: 'militarySabotage' })
  })

  it('schiebt jeden Bau- und Aushebeauftrag der Provinz um die Regelzahl Stunden (R-SPY-04/AK2)', () => {
    state.provinces['o1']!.buildQueue = [
      { id: 'o900', building: 'barracks', level: 3, startedTick: 0, completesAtTick: 200, ownerAtStart: 'p2' },
    ]
    state.provinces['o1']!.recruitQueue = [
      { id: 'o901', unitKey: 'infantry', count: 2, startedTick: 0, completesAtTick: 150, ownerAtStart: 'p2' },
      { id: 'o902', unitKey: 'infantry', count: 1, startedTick: 0, completesAtTick: 300, ownerAtStart: 'p2' },
    ]
    const morale = state.provinces['o1']!.morale
    const resources = { ...state.players['p2']!.resources }

    const events = settleAt(state, 2 * DAY, SABOTAGE)

    expect(state.provinces['o1']!.buildQueue[0]!.completesAtTick).toBe(212)
    expect(state.provinces['o1']!.recruitQueue[0]!.completesAtTick).toBe(162)
    expect(state.provinces['o1']!.recruitQueue[1]!.completesAtTick).toBe(312)
    const [suffered] = ofType(events, 'SABOTAGE_SUFFERED')
    expect(suffered!.delayTicks).toBe(C.militarySabotageDelayTicks)
    expect(suffered!.moraleLoss).toBe(0)
    expect(suffered!.destroyed).toEqual({})
    expect(state.provinces['o1']!.morale).toBe(morale)
    expect(state.players['p2']!.resources).toEqual(resources)
  })

  it('der Regelwert ist zwölf Stunden', () => {
    expect(C.militarySabotageDelayTicks).toBe(12)
  })

  it('im Spiel wird der Bau genau zwölf Ticks später fertig als ohne Saboteur', () => {
    const ohne = createInitialState(CONFIG, { map, rules: TEST_RULES })
    ohne.provinces['o1']!.buildQueue = [
      { id: 'o900', building: 'barracks', level: 3, startedTick: 0, completesAtTick: 2 * DAY + 5, ownerAtStart: 'p2' },
    ]
    const mit = createInitialState(CONFIG, { map, rules: TEST_RULES })
    mit.provinces['o1']!.buildQueue = [
      { id: 'o900', building: 'barracks', level: 3, startedTick: 0, completesAtTick: 2 * DAY + 5, ownerAtStart: 'p2' },
    ]
    placeSpy(mit, { provinceId: 'o1', mission: 'militarySabotage' })

    const ohneLauf = runUntil(ohne, 3 * DAY, SABOTAGE)
    const mitLauf = runUntil(mit, 3 * DAY, SABOTAGE)

    const tickOhne = ofType(ohneLauf.events, 'BUILD_COMPLETED').find((e) => e.provinceId === 'o1')!.tick
    const tickMit = ofType(mitLauf.events, 'BUILD_COMPLETED').find((e) => e.provinceId === 'o1')!.tick
    expect(tickMit - tickOhne).toBe(C.militarySabotageDelayTicks)
  })

  it('deckt dem Urheber die Armeen der Provinz auf — Zusammensetzung, keine Gebäude', () => {
    fortifyOstburg(state)

    settleAt(state, 2 * DAY, SABOTAGE)

    expect(state.espionage.reveals).toEqual([
      { player: 'p1', provinceId: 'o1', kind: 'armies', untilTick: 2 * DAY + C.spyRevealDays * DAY },
    ])
    const view = publicView(state, 'p1')
    const o1 = view.provinces.find((p) => p.id === 'o1')!
    expect(o1).not.toHaveProperty('buildings')
    expect(view.armies.find((a) => a.owner === 'p2')!.units).toHaveLength(2)
  })

  it('ohne laufende Aufträge gelingt sie trotzdem und meldet es', () => {
    const events = settleAt(state, 2 * DAY, SABOTAGE)

    const [suffered] = ofType(events, 'SABOTAGE_SUFFERED')
    expect(suffered!.kind).toBe('military')
    expect(state.espionage.reveals).toEqual([
      { player: 'p1', provinceId: 'o1', kind: 'armies', untilTick: 2 * DAY + C.spyRevealDays * DAY },
    ])
  })
})

describe('R-SPY-04/AK3 Das Opfer erfaehrt, dass etwas geschah — nicht, wer es war', () => {
  beforeEach(() => {
    state.nextIds.spy = 101
  })

  it('meldet dem Opfer SABOTAGE_SUFFERED ohne jedes Feld des Urhebers', () => {
    placeSpy(state, { provinceId: 'o1', mission: 'economicSabotage' })

    const events = settleAt(state, 2 * DAY, SABOTAGE)
    const [suffered] = ofType(events, 'SABOTAGE_SUFFERED')

    expect(Object.keys(suffered!).sort()).toEqual(
      ['audience', 'concerns', 'delayTicks', 'destroyed', 'kind', 'moraleLoss', 'playerId', 'provinceId', 'severity', 'tick', 'type'],
    )
    expect(suffered!.playerId).toBe('p2')
    expect(suffered!.audience).toEqual(['p2'])
    expect(suffered!.concerns).toEqual(['p2'])
    expect(suffered!.kind).toBe('economic')
    const json = JSON.stringify(suffered)
    expect(json).not.toContain('"p1"')
    expect(json).not.toContain('"s101"')
  })

  it('dasselbe für die Militaersabotage', () => {
    placeSpy(state, { provinceId: 'o1', mission: 'militarySabotage' })

    const events = settleAt(state, 2 * DAY, SABOTAGE)
    const [suffered] = ofType(events, 'SABOTAGE_SUFFERED')

    expect(Object.keys(suffered!).sort()).toEqual(
      ['audience', 'concerns', 'delayTicks', 'destroyed', 'kind', 'moraleLoss', 'playerId', 'provinceId', 'severity', 'tick', 'type'],
    )
    expect(suffered!.kind).toBe('military')
  })

  it('der Urheber bekommt seinen Bericht mit dem Ergebnis', () => {
    placeSpy(state, { provinceId: 'o1', mission: 'economicSabotage' })

    const events = settleAt(state, 2 * DAY, SABOTAGE)

    const report = ofType(events, 'SPY_REPORT')[0]!
    expect(report.outcome).toBe('success')
    expect(report.audience).toEqual(['p1'])
    const sufferedIdx = events.findIndex((e) => e.type === 'SABOTAGE_SUFFERED')
    const reportIdx = events.findIndex((e) => e.type === 'SPY_REPORT')
    expect(sufferedIdx).toBeLessThan(reportIdx)
  })

  it('ist ein Alarm; Bericht und Enttarnung sind keiner', () => {
    expect(isAlertType('SABOTAGE_SUFFERED')).toBe(true)
    expect(isAlertType('SPY_REPORT')).toBe(false)
    expect(isAlertType('SPY_DETECTED')).toBe(false)

    placeSpy(state, { provinceId: 'o1', mission: 'economicSabotage' })
    const events = settleAt(state, 2 * DAY, SABOTAGE)
    expect(ofType(events, 'SABOTAGE_SUFFERED')[0]!.severity).toBe('alert')
  })

  it('firstAlertFor haelt das Opfer an und keinen Dritten (R-SPY-04/AK3)', () => {
    placeSpy(state, { provinceId: 'o1', mission: 'economicSabotage' })

    const events = settleAt(state, 2 * DAY, SABOTAGE)

    expect(firstAlertFor(events, 'p2')?.type).toBe('SABOTAGE_SUFFERED')
    expect(firstAlertFor(events, 'p3')).toBeNull()
    expect(firstAlertFor(events, 'p1')).toBeNull()
  })

  it('das Vorspulen des Opfers haelt am Tageswechsel der Sabotage, das des Dritten nicht', () => {
    const fuerOpfer = createInitialState(CONFIG, { map, rules: TEST_RULES })
    fuerOpfer.nextIds.spy = 101
    placeSpy(fuerOpfer, { provinceId: 'o1', mission: 'economicSabotage' })
    const opferResult = fastForward(fuerOpfer, { kind: 'days', days: 3 }, { map, rules: SABOTAGE }, { alertsFor: 'p2' })
    expect(opferResult.stoppedBy).toBe('alert')
    expect(opferResult.trigger?.type).toBe('SABOTAGE_SUFFERED')
    expect(opferResult.state.tick).toBe(2 * DAY)

    const fuerDritten = createInitialState(CONFIG, { map, rules: TEST_RULES })
    fuerDritten.nextIds.spy = 101
    placeSpy(fuerDritten, { provinceId: 'o1', mission: 'economicSabotage' })
    const drittenResult = fastForward(fuerDritten, { kind: 'days', days: 3 }, { map, rules: SABOTAGE }, { alertsFor: 'p3' })
    expect(drittenResult.stoppedBy).toBe('target')
  })
})

describe('R-SPY-04/AK4 Je Provinz und Tag wirkt hoechstens eine Sabotage', () => {
  it('zwei Wirtschaftssaboteure: die Moral sinkt einmal, der zweite meldet failure', () => {
    placeSpy(state, { owner: 'p1', provinceId: 'o1', mission: 'economicSabotage' })
    placeSpy(state, { owner: 'p3', provinceId: 'o1', mission: 'economicSabotage' })
    const morale = state.provinces['o1']!.morale

    const events = settleAt(state, 2 * DAY, SABOTAGE)

    expect(state.provinces['o1']!.morale).toBe(morale - C.sabotageMoraleLoss)
    expect(ofType(events, 'SABOTAGE_SUFFERED')).toHaveLength(1)
    expect(ofType(events, 'SPY_REPORT').map((e) => [e.spyId, e.outcome])).toEqual([
      ['s1', 'success'],
      ['s2', 'failure'],
    ])
  })

  it('gilt über beide Arten: nach der Wirtschaftssabotage bewirkt die Militaersabotage nichts', () => {
    placeSpy(state, { owner: 'p1', provinceId: 'o1', mission: 'economicSabotage' })
    placeSpy(state, { owner: 'p3', provinceId: 'o1', mission: 'militarySabotage' })
    state.provinces['o1']!.buildQueue = [
      { id: 'o900', building: 'barracks', level: 1, startedTick: 0, completesAtTick: 200, ownerAtStart: 'p2' },
    ]

    const events = settleAt(state, 2 * DAY, SABOTAGE)

    expect(state.provinces['o1']!.buildQueue[0]!.completesAtTick).toBe(200)
    expect(state.espionage.reveals).toEqual([])
    expect(ofType(events, 'SPY_REPORT').map((e) => e.outcome)).toEqual(['success', 'failure'])
  })

  it('ein gesperrter Saboteur wuerfelt nicht', () => {
    const rules = withConstants({ spySuccessSabotagePermille: 999 })
    placeSpy(state, { owner: 'p1', provinceId: 'o1', mission: 'economicSabotage' })
    placeSpy(state, { owner: 'p3', provinceId: 'o1', mission: 'economicSabotage' })
    const erwartet = cloneRng(state.rng)
    expect(chance(erwartet, 999), 'Vorbedingung: die erste Startzahl gelingt').toBe(true)

    settleAt(state, 2 * DAY, rules)

    expect(state.rng).toEqual(erwartet)
  })

  it('ein misslungener erster Versuch sperrt nicht', () => {
    const rules = withConstants({ spySuccessSabotagePermille: 500 })
    let gefunden: GameState | undefined
    for (let seed = 1; seed <= 200; seed++) {
      const kandidat = createInitialState({ ...CONFIG, seed }, { map, rules: TEST_RULES })
      const rng = cloneRng(kandidat.rng)
      const first = chance(rng, 500)
      const second = chance(rng, 500)
      if (!first && second) {
        gefunden = kandidat
        break
      }
    }
    expect(gefunden).toBeDefined()

    placeSpy(gefunden!, { owner: 'p1', provinceId: 'o1', mission: 'economicSabotage' })
    placeSpy(gefunden!, { owner: 'p3', provinceId: 'o1', mission: 'economicSabotage' })

    const events = settleAt(gefunden!, 2 * DAY, rules)

    expect(ofType(events, 'SABOTAGE_SUFFERED')).toHaveLength(1)
    expect(ofType(events, 'SPY_REPORT').map((e) => e.outcome)).toEqual(['failure', 'success'])
  })

  it('am naechsten Tageswechsel kann dieselbe Provinz wieder getroffen werden — heute sabotiert ist kein Zustand', () => {
    placeSpy(state, { provinceId: 'o1', mission: 'economicSabotage' })
    state.provinces['o1']!.morale = 80_000

    settleAt(state, 2 * DAY, SABOTAGE)
    settleAt(state, 3 * DAY, SABOTAGE)

    expect(state.provinces['o1']!.morale).toBe(60_000)
    expect(Object.keys(state.espionage).sort()).toEqual(['reveals', 'spies'])
  })
})

describe('R-SPY-05/AK1 Ein Gegenspion enttarnt fremde Spione in seiner Provinz', () => {
  beforeEach(() => {
    state.nextIds.spy = 101
    placeSpy(state, { owner: 'p2', provinceId: 'o1', mission: 'counter' })
  })

  it('entfernt den Spion und meldet es beiden, mit Nennung der Macht (R-SPY-05/AK1)', () => {
    placeSpy(state, { owner: 'p1', provinceId: 'o1', mission: 'intel' })

    const events = settleAt(state, 2 * DAY, DETECT)

    expect(state.espionage.spies.map((s) => s.id)).toEqual(['s101'])
    expect(ofType(events, 'SPY_DETECTED')).toEqual([
      {
        type: 'SPY_DETECTED',
        tick: 48,
        severity: 'info',
        audience: ['p1', 'p2'],
        concerns: ['p1', 'p2'],
        playerId: 'p1',
        targetPlayerId: 'p2',
        provinceId: 'o1',
        mission: 'intel',
      },
    ])
  })

  it('ein enttarnter Spion fuehrt seinen Auftrag nicht mehr aus', () => {
    placeSpy(state, { owner: 'p1', provinceId: 'o1', mission: 'economicSabotage' })

    const events = settleAt(state, 2 * DAY, SABOTAGE_DETECT)

    expect(ofType(events, 'SABOTAGE_SUFFERED')).toEqual([])
    expect(state.provinces['o1']!.morale).toBe(state.provinces['o1']!.morale)
    expect(ofType(events, 'SPY_REPORT').filter((e) => e.spyId === 's102')).toEqual([])
    expect(state.espionage.reveals).toEqual([])
  })

  it('senkt das Ansehen des Urhebers um den Regelwert', () => {
    placeSpy(state, { owner: 'p1', provinceId: 'o1', mission: 'intel' })

    settleAt(state, 2 * DAY, DETECT)

    expect(state.players['p1']!.reputation).toBe(1000 - C.spyDetectedReputationLoss)
    expect(state.players['p2']!.reputation).toBe(1000)
  })

  it('doppelt bei Sabotage gegen eine Macht, mit der er nicht im Krieg ist', () => {
    placeSpy(state, { owner: 'p1', provinceId: 'o1', mission: 'economicSabotage' })

    settleAt(state, 2 * DAY, SABOTAGE_DETECT)

    expect(state.players['p1']!.reputation).toBe(1000 - 2 * C.spyDetectedReputationLoss)
  })

  it('doppelt gilt auch fuer Militaersabotage', () => {
    placeSpy(state, { owner: 'p1', provinceId: 'o1', mission: 'militarySabotage' })

    settleAt(state, 2 * DAY, SABOTAGE_DETECT)

    expect(state.players['p1']!.reputation).toBe(1000 - 2 * C.spyDetectedReputationLoss)
  })

  it('einfach bei Sabotage im Krieg', () => {
    state.diplomacy.relations['p1|p2']!.state = 'war'
    placeSpy(state, { owner: 'p1', provinceId: 'o1', mission: 'economicSabotage' })

    settleAt(state, 2 * DAY, SABOTAGE_DETECT)

    expect(state.players['p1']!.reputation).toBe(1000 - C.spyDetectedReputationLoss)
  })

  it('eine erklaerte, noch nicht wirksame Kriegserklaerung ist noch Frieden — doppelt', () => {
    state.diplomacy.relations['p1|p2']!.warEffectiveAtTick = 10 * DAY
    placeSpy(state, { owner: 'p1', provinceId: 'o1', mission: 'economicSabotage' })

    settleAt(state, 2 * DAY, SABOTAGE_DETECT)

    expect(state.players['p1']!.reputation).toBe(1000 - 2 * C.spyDetectedReputationLoss)
  })

  it('der Betroffene merkt sich die Verstimmung gegen den Urheber (R-DIP-06, B7)', () => {
    placeSpy(state, { owner: 'p1', provinceId: 'o1', mission: 'intel' })

    settleAt(state, 2 * DAY, DETECT)

    expect(state.diplomacy.grievances['p2']?.['p1']).toBe(C.grievanceOnSpyDetected)
    expect(state.diplomacy.grievances['p1']).toBeUndefined()
  })

  it('die Verstimmung ist gedeckelt wie jede andere', () => {
    state.diplomacy.grievances['p2'] = { p1: 900 }
    placeSpy(state, { owner: 'p1', provinceId: 'o1', mission: 'intel' })

    settleAt(state, 2 * DAY, DETECT)

    expect(state.diplomacy.grievances['p2']!['p1']).toBe(C.grievanceMax)
  })

  it('wuerfelt je fremdem Spion genau einmal, eigene nicht', () => {
    placeSpy(state, { owner: 'p1', provinceId: 'o1', mission: 'intel' })
    placeSpy(state, { owner: 'p3', provinceId: 'o1', mission: 'economicSabotage' })
    placeSpy(state, { owner: 'p1', provinceId: 'o2', mission: 'intel' })
    placeSpy(state, { owner: 'p2', provinceId: 'o1', mission: 'counter', assignedTick: DAY + 5 })
    const rules = withConstants({ spySuccessIntelPermille: 1000, spySuccessSabotagePermille: 1000, spyDetectionPermille: 1 })
    const erwartet = cloneRng(state.rng)
    expect(chance(erwartet, 1), 'Vorbedingung: erster Wurf misslingt').toBe(false)
    expect(chance(erwartet, 1), 'Vorbedingung: zweiter Wurf misslingt').toBe(false)

    settleAt(state, 2 * DAY, rules)

    expect(state.rng).toEqual(erwartet)
  })

  it('ein schon enttarnter Spion wird von einem zweiten Gegenspion nicht noch einmal gewuerfelt', () => {
    placeSpy(state, { owner: 'p2', provinceId: 'o1', mission: 'counter' })
    placeSpy(state, { owner: 'p1', provinceId: 'o1', mission: 'intel' })
    const rules = withConstants({ spyDetectionPermille: 999, spySuccessIntelPermille: 1000 })
    const erwartet = cloneRng(state.rng)
    expect(chance(erwartet, 999), 'Vorbedingung: der erste Wurf enttarnt').toBe(true)

    const events = settleAt(state, 2 * DAY, rules)

    expect(state.rng).toEqual(erwartet)
    expect(ofType(events, 'SPY_DETECTED')).toHaveLength(1)
  })

  it('ein am selben Tag angesetzter Gegenspion enttarnt noch niemanden (R-SPY-02/AK3)', () => {
    // Ersetzt den in beforeEach angesetzten Gegenspion durch einen, der erst heute kam.
    state.espionage.spies = []
    placeSpy(state, { owner: 'p2', provinceId: 'o1', mission: 'counter', assignedTick: DAY + 5 })
    const rules = withConstants({ spyDetectionPermille: 1000, spySuccessIntelPermille: 1000 })
    placeSpy(state, { owner: 'p1', provinceId: 'o1', mission: 'intel' })
    const rng = cloneRng(state.rng)

    const events = settleAt(state, 2 * DAY, rules)

    expect(ofType(events, 'SPY_DETECTED')).toEqual([])
    expect(state.espionage.spies.some((s) => s.owner === 'p1')).toBe(true)
    expect(state.rng, 'weder Gegenspion noch Aufklaerung ziehen bei Permille 1000').toEqual(rng)
  })

  it('ein fremder Spion, der erst heute kam, kann schon enttarnt werden', () => {
    placeSpy(state, { owner: 'p1', provinceId: 'o1', mission: 'intel', assignedTick: DAY + 5 })

    const events = settleAt(state, 2 * DAY, DETECT)

    expect(ofType(events, 'SPY_DETECTED')).toHaveLength(1)
  })

  it('ein Gegenspion in einer inzwischen fremden Provinz meldet targetChanged und wuerfelt nicht', () => {
    state.provinces['o1']!.owner = 'p3'
    const rng = cloneRng(state.rng)

    const events = settleAt(state, 2 * DAY, TEST_RULES)

    expect(state.rng).toEqual(rng)
    expect(ofType(events, 'SPY_REPORT').map((e) => [e.spyId, e.outcome])).toEqual([['s101', 'targetChanged']])
    expect(ofType(events, 'SPY_DETECTED')).toEqual([])
  })

  it('fuehrt Gegenspionage als letzten Ausgang, ohne Bericht', () => {
    // Fall A: ein fremder Spion da, gelingt.
    placeSpy(state, { owner: 'p1', provinceId: 'o1', mission: 'intel' })
    settleAt(state, 2 * DAY, DETECT)
    const counterA = state.espionage.spies.find((s) => s.owner === 'p2')!
    expect(counterA.lastRunTick).toBe(2 * DAY)
    expect(counterA.lastOutcome).toBe('success')
    expect(ofType([], 'SPY_REPORT')).toEqual([])

    // Fall B: kein fremder Spion.
    const b = createInitialState(CONFIG, { map, rules: TEST_RULES })
    placeSpy(b, { owner: 'p2', provinceId: 'o1', mission: 'counter' })
    settleAt(b, 2 * DAY, DETECT)
    const counterB = b.espionage.spies.find((s) => s.owner === 'p2')!
    expect(counterB.lastOutcome).toBe('failure')

    // Fall C: ein fremder Spion da, aber die Entdeckung misslingt — gleich wie B.
    const c = createInitialState(CONFIG, { map, rules: TEST_RULES })
    placeSpy(c, { owner: 'p2', provinceId: 'o1', mission: 'counter' })
    placeSpy(c, { owner: 'p1', provinceId: 'o1', mission: 'intel' })
    settleAt(c, 2 * DAY, withConstants({ spyDetectionPermille: 0 }))
    const counterC = c.espionage.spies.find((s) => s.owner === 'p2')!
    expect(counterC.lastOutcome).toBe('failure')
  })

  it('der Dritte erfaehrt nichts', () => {
    placeSpy(state, { owner: 'p1', provinceId: 'o1', mission: 'intel' })

    const events = settleAt(state, 2 * DAY, DETECT)

    expect(eventsFor(events, 'p3')).toEqual([])
  })

  it('die Verhaeltnisse aus D29.7', () => {
    expect(C.spyDetectedReputationLoss).toBe(100)
    expect(C.grievanceOnSpyDetected).toBe(300)
    expect(C.grievanceOnProvinceLost).toBeLessThan(C.grievanceOnSpyDetected)
    expect(C.grievanceOnSpyDetected).toBeLessThan(C.grievanceOnSurpriseAttack)
  })
})

describe('R-SPY-05/AK2 Ohne Gegenspion wird niemand enttarnt', () => {
  it('dreissig Tage Sabotage ohne Gegenspion: kein SPY_DETECTED, der Spion lebt, Ansehen und Verstimmung bleiben', () => {
    placeSpy(state, { provinceId: 'o1', mission: 'economicSabotage' })
    state.players['p1']!.resources.money += 5_000_000

    const { state: after, events } = runUntil(state, 32 * DAY, TEST_RULES)

    expect(ofType(events, 'SPY_DETECTED')).toEqual([])
    expect(after.espionage.spies.some((s) => s.owner === 'p1')).toBe(true)
    expect(ofType(events, 'SABOTAGE_SUFFERED').length).toBeGreaterThan(0)
    expect(after.diplomacy.grievances['p2']?.['p1']).toBeUndefined()
    expect(ofType(events, 'PROVINCE_REVOLTED').some((e) => e.provinceId === 'o1')).toBe(false)
  })

  it('ein Gegenspion in einer anderen Provinz schuetzt nicht und wuerfelt nicht', () => {
    placeSpy(state, { owner: 'p2', provinceId: 'o2', mission: 'counter' })
    placeSpy(state, { owner: 'p1', provinceId: 'o1', mission: 'economicSabotage' })
    const rules = withConstants({ spySuccessSabotagePermille: 1000 })
    const rng = cloneRng(state.rng)
    chance(rng, 1000) // der eine Zug der Sabotage; die Gegenspionage in o2 zieht keinen.

    const events = settleAt(state, 2 * DAY, rules)

    expect(state.rng).toEqual(rng)
    expect(ofType(events, 'SABOTAGE_SUFFERED')).toHaveLength(1)
    expect(ofType(events, 'SPY_DETECTED')).toEqual([])
  })

  it('der Gegenspion einer dritten Macht in ihrer eigenen Provinz schuetzt das Opfer nicht', () => {
    placeSpy(state, { owner: 'p3', provinceId: 's1', mission: 'counter' })
    placeSpy(state, { owner: 'p1', provinceId: 'o1', mission: 'economicSabotage' })

    const events = settleAt(state, 2 * DAY, SABOTAGE_DETECT)

    expect(ofType(events, 'SABOTAGE_SUFFERED')).toHaveLength(1)
  })
})
