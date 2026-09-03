import { TEST_RULES, placeArmy, smallWorld } from '@worldwar/testkit'
import { createInitialState, type GameConfig, type GameState } from '@worldwar/core'
import { beforeEach, describe, expect, it } from 'vitest'
import { SPEED_STOPS, SimHost } from './SimHost'
import { SimEngine, TICK_BACKLOG_CAP, UPDATE_INTERVAL_MS } from './SimEngine'
import type { SimMessage } from './protocol'

const map = smallWorld()
const ctx = { map, rules: TEST_RULES }

const CONFIG: GameConfig = {
  seed: 1002,
  mapId: 'testworld',
  rulesId: 'default',
  players: [
    { name: 'A', kind: 'human', nation: 'Nordland', color: '#0f62bc' },
    { name: 'B', kind: 'ai', nation: 'Ostmark', color: '#b03a2e', difficulty: 'normal' },
  ],
  victory: { condition: 'points', pointsShareToWin: 900, dayLimit: null },
}

let state: GameState

beforeEach(() => {
  state = createInitialState(CONFIG, ctx)
})

/** An engine wired to a collector, as the worker would wire it to postMessage. */
function engineWith(initial: GameState = state) {
  const sent: SimMessage[] = []
  const engine = new SimEngine({ state: initial, ctx, viewerId: 'p1', emit: (m) => sent.push(m) })
  return { engine, sent }
}

describe('R-TIME-02 Interaktives Tempo', () => {
  it('fuehrt in Pause keinen einzigen Tick aus', () => {
    const { engine } = engineWith()

    engine.setSpeed(0)
    engine.advance(5_000)

    expect(engine.tick).toBe(state.tick)
  })

  it('haelt den Sollwert bei jedem Rastpunkt bis 100', () => {
    for (const speed of SPEED_STOPS.filter((s) => s > 0)) {
      const { engine } = engineWith()
      engine.setSpeed(speed)

      // One second of real time, delivered in 16 ms slices as a display would.
      for (let ms = 0; ms < 1_000; ms += 16) engine.advance(16)

      const ran = engine.tick - state.tick
      // Slicing loses at most one tick per slice boundary; that is the tolerance band.
      expect(ran).toBeGreaterThanOrEqual(Math.floor(speed * 0.9))
      expect(ran).toBeLessThanOrEqual(speed)
    }
  })

  it('deckelt den Rueckstand nach einer Haengepartie auf zwei Ticks', () => {
    // The window was in the background for a minute. Without a cap the simulation would
    // now owe 6000 ticks and freeze the interface trying to pay them back.
    const { engine } = engineWith()
    engine.setSpeed(100)

    engine.advance(60_000)

    expect(engine.tick - state.tick).toBe(TICK_BACKLOG_CAP)
    expect(engine.backlog).toBeLessThanOrEqual(TICK_BACKLOG_CAP)
  })

  it('sammelt keinen wachsenden Rueckstand ueber viele Ueberlastscheiben', () => {
    const { engine } = engineWith()
    engine.setSpeed(100)

    for (let i = 0; i < 20; i++) engine.advance(1_000)

    expect(engine.backlog).toBeLessThanOrEqual(TICK_BACKLOG_CAP)
  })

  it('meldet die Sicht hoechstens zwanzigmal je Sekunde', () => {
    const { engine, sent } = engineWith()
    engine.setSpeed(100)

    for (let ms = 0; ms < 1_000; ms += 10) engine.advance(10)

    const views = sent.filter((m) => m.kind === 'view')
    expect(views.length).toBeLessThanOrEqual(Math.ceil(1_000 / UPDATE_INTERVAL_MS))
    expect(views.length).toBeGreaterThan(0)
  })
})

describe('R-TIME-03 Vorspulen', () => {
  it('erreicht mindestens 500 Spielstunden je Sekunde', () => {
    const { engine } = engineWith()

    const startedAt = performance.now()
    const result = engine.fastForward({ kind: 'ticks', ticks: 1_000 })
    const seconds = (performance.now() - startedAt) / 1_000

    expect(result.stoppedBy).toBe('target')
    expect(result.ticksRun).toBe(1_000)
    expect(result.ticksRun / seconds).toBeGreaterThan(500)
  })

  it('haelt bei einem Alarm an und nennt den Grund', () => {
    const contested = createInitialState(CONFIG, ctx)
    placeArmy(contested, {
      owner: 'p2',
      at: 'n1',
      units: [{ unitKey: 'infantry', hpTotal: 40_000 }],
    })
    const { engine } = engineWith(contested)

    const result = engine.fastForward({ kind: 'days', days: 30 })

    // Naming the trigger matters: a test that only asks for 'some alert' would stay
    // green if a shortage warning replaced the invasion.
    expect(result.stoppedBy).toBe('alert')
    expect(result.trigger?.type).toBe('WAR_DECLARED')
    expect(result.ticksRun).toBeLessThan(30 * 24)
  })

  it('laesst sich abbrechen und meldet, wie weit es kam', () => {
    const { engine } = engineWith()

    const result = engine.fastForward({ kind: 'ticks', ticks: 10_000 }, () => engine.tick >= state.tick + 50)

    expect(result.stoppedBy).toBe('aborted')
    expect(result.ticksRun).toBeLessThan(10_000)
  })
})

describe('R-DIP-04 Der Worker gibt den Spielzustand nicht heraus', () => {
  it('sendet ausschliesslich die Sicht des Spielers', () => {
    const { engine, sent } = engineWith()
    engine.setSpeed(50)
    for (let ms = 0; ms < 2_000; ms += 16) engine.advance(16)

    for (const message of sent) {
      expect(Object.keys(message)).not.toContain('state')
    }

    // The decisive proof is not the absent key but the absent knowledge. Comparing
    // values would prove nothing here: both nations start identically, so a foreign
    // province's morale is the same *number* as an own one. What must hold is
    // structural — morale is attached only to provinces the viewer owns.
    const own = new Set(
      Object.values(engine.debugState.provinces)
        .filter((province) => province.owner === 'p1')
        .map((province) => province.id),
    )
    let foreignSeen = 0
    for (const message of sent) {
      if (message.kind !== 'view') continue
      for (const province of message.view.provinces) {
        if (own.has(province.id)) continue
        foreignSeen += 1
        expect(province.morale).toBeUndefined()
        expect(province.population).toBeUndefined()
        expect(province.deposits).toBeUndefined()
      }
    }
    // Guards the guard: a view that showed no foreign province at all would pass above.
    expect(foreignSeen).toBeGreaterThan(0)
  })
})

describe('R-TIME-02 Der Host steuert den Worker', () => {
  it('reicht Tempo und Kommandos an den Simulationsport weiter', async () => {
    const requests: unknown[] = []
    const host = new SimHost({
      post: (r) => requests.push(r),
      subscribe: () => () => {},
    })

    host.setSpeed(25)
    host.pause()

    expect(requests).toEqual([
      { kind: 'setSpeed', hoursPerSecond: 25 },
      { kind: 'setSpeed', hoursPerSecond: 0 },
    ])
    expect(host.speed).toBe(0)
  })

  it('rastet auf den naechsten erlaubten Wert ein und deckelt bei 100', () => {
    const host = new SimHost({ post: () => {}, subscribe: () => () => {} })

    host.setSpeed(1_000)
    expect(host.speed).toBe(100)

    host.setSpeed(-5)
    expect(host.speed).toBe(0)
  })

  it('haelt die zuletzt gemeldete Sicht bereit', () => {
    const listeners: ((m: SimMessage) => void)[] = []
    const host = new SimHost({
      post: () => {},
      subscribe: (cb) => {
        listeners.push(cb)
        return () => {}
      },
    })
    const { engine, sent } = engineWith()
    engine.setSpeed(1)
    engine.advance(2_000)

    const view = sent.find((m) => m.kind === 'view')
    expect(view).toBeDefined()
    for (const listener of listeners) listener(view!)

    expect(host.view?.tick).toBe(engine.tick)
  })
})
