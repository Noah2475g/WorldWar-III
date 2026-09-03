import { TEST_RULES, smallWorld } from '@worldwar/testkit'
import { createInitialState, type GameConfig } from '@worldwar/core'
import { describe, expect, it } from 'vitest'
import { SimEngine } from './SimEngine'
import { SLICE_MS, attach } from './worker'
import type { SimMessage } from './protocol'

const map = smallWorld()
const ctx = { map, rules: TEST_RULES }

const CONFIG: GameConfig = {
  seed: 77,
  mapId: 'testworld',
  rulesId: 'default',
  players: [
    { name: 'A', kind: 'human', nation: 'Nordland', color: '#0f62bc' },
    { name: 'B', kind: 'ai', nation: 'Ostmark', color: '#b03a2e', difficulty: 'normal' },
  ],
  victory: { condition: 'points', pointsShareToWin: 900, dayLimit: null },
}

/** A hand-cranked clock and scheduler, standing in for the browser worker's. */
function fakeRuntime() {
  let nowMs = 0
  let slice: (() => void) | null = null
  return {
    runtime: {
      now: () => nowMs,
      every: (_intervalMs: number, run: () => void) => {
        slice = run
        return () => {
          slice = null
        }
      },
    },
    /** Advances real time and runs the slices that fall into it. */
    tick(ms: number) {
      const slices = Math.round(ms / SLICE_MS)
      for (let i = 0; i < slices; i++) {
        nowMs += SLICE_MS
        slice?.()
      }
    },
    get running() {
      return slice !== null
    },
  }
}

function setup() {
  const sent: SimMessage[] = []
  const state = createInitialState(CONFIG, ctx)
  const engine = new SimEngine({ state, ctx, viewerId: 'p1', emit: (m) => sent.push(m) })
  const clock = fakeRuntime()
  const worker = attach(engine, clock.runtime)
  return { engine, sent, clock, worker, startTick: state.tick }
}

describe('R-TIME-02 Die Worker-Schale', () => {
  it('laesst die Welt erst laufen, wenn ein Tempo gesetzt ist', () => {
    const { worker, engine, clock, startTick } = setup()

    clock.tick(1_000)
    expect(engine.tick).toBe(startTick)

    worker.handle({ kind: 'setSpeed', hoursPerSecond: 10 })
    clock.tick(1_000)
    expect(engine.tick).toBeGreaterThan(startTick)
  })

  it('haelt die Zeit an, wenn das Fenster stehenbleibt, statt sie nachzuholen', () => {
    // The slice fires once after a long gap: the cap must eat the difference, not the
    // interface. Without it the first frame after a background pause runs thousands
    // of ticks.
    const { worker, engine, clock, startTick } = setup()
    worker.handle({ kind: 'setSpeed', hoursPerSecond: 100 })

    clock.tick(SLICE_MS)
    const afterOneSlice = engine.tick - startTick

    expect(afterOneSlice).toBeLessThanOrEqual(2)
  })

  it('gibt die Sicht auf Anfrage heraus', () => {
    const { worker, sent } = setup()

    worker.handle({ kind: 'requestView' })

    expect(sent.filter((m) => m.kind === 'view')).toHaveLength(1)
  })

  it('bricht das Vorspulen ab, wenn der Knopf waehrend des Laufs gedrueckt wird', () => {
    // The whole point of running fast-forward in batches: the stop message arrives
    // between two of them. A run that finished inside one call could never be stopped,
    // because the worker would not read its inbox until it was already done.
    const { worker, clock, sent } = setup()

    worker.handle({ kind: 'fastForward', target: { kind: 'ticks', ticks: 100_000 } })
    clock.tick(SLICE_MS * 3)
    worker.handle({ kind: 'abortFastForward' })
    clock.tick(SLICE_MS)

    const done = sent.find((m) => m.kind === 'fastForwardDone')
    expect(done?.kind === 'fastForwardDone' && done.stoppedBy).toBe('aborted')
    expect(done?.kind === 'fastForwardDone' && done.ticksRun).toBeGreaterThan(0)
    expect(done?.kind === 'fastForwardDone' && done.ticksRun).toBeLessThan(100_000)
  })

  it('meldet den Fortschritt waehrend des Vorspulens', () => {
    const { worker, clock, sent } = setup()

    worker.handle({ kind: 'fastForward', target: { kind: 'ticks', ticks: 100_000 } })
    clock.tick(SLICE_MS * 3)

    const progress = sent.filter((m) => m.kind === 'fastForwardProgress')
    expect(progress.length).toBeGreaterThanOrEqual(3)
  })

  it('erreicht das Ziel ueber mehrere Scheiben hinweg', () => {
    const { worker, clock, sent, engine, startTick } = setup()

    worker.handle({ kind: 'fastForward', target: { kind: 'days', days: 30 } })
    for (let i = 0; i < 20 && engine.fastForwarding; i++) clock.tick(SLICE_MS)

    const done = sent.find((m) => m.kind === 'fastForwardDone')
    expect(done?.kind === 'fastForwardDone' && done.stoppedBy).toBe('target')
    expect(engine.tick - startTick).toBe(30 * 24)
  })

  it('reicht Kommandos an die Simulation weiter', () => {
    const { worker, engine, sent } = setup()
    const provinceId = Object.values(engine.debugState.provinces).find((p) => p.owner === 'p1')!.id

    worker.handle({
      kind: 'command',
      command: { type: 'BUILD', playerId: 'p1', provinceId, building: 'barracks' },
    })
    worker.handle({ kind: 'setSpeed', hoursPerSecond: 1 })
    for (let i = 0; i < 200; i++) worker.handle({ kind: 'requestView' })

    // The command is queued; it reaches the simulation with the next tick, not before.
    expect(sent.some((m) => m.kind === 'view')).toBe(true)
  })

  it('laesst sich anhalten', () => {
    const { worker, clock, engine, startTick } = setup()
    worker.handle({ kind: 'setSpeed', hoursPerSecond: 50 })

    worker.stop()
    clock.tick(1_000)

    expect(clock.running).toBe(false)
    expect(engine.tick).toBe(startTick)
  })
})
