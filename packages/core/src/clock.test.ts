import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { hashValue } from '@worldwar/shared'
import { TEST_RULES, tinyMap } from '@worldwar/testkit'
import { describe, expect, it } from 'vitest'
import { DEFAULT_MAX_TICKS, fastForward, firstAlertFor, runTicks, targetReached } from './clock'
import type { GameEvent } from './events/types'
import { createInitialState, type GameConfig } from './state/create'
import { HASH_OMIT_KEYS, type GameState } from './state/types'

const CONFIG: GameConfig = {
  seed: 42,
  mapId: 'tiny',
  rulesId: 'test',
  players: [
    { name: 'Noah', kind: 'human', nation: 'Nordland', color: '#0f62bc' },
    { name: 'Gegner', kind: 'ai', nation: 'Sued', color: '#b03a2e', difficulty: 'normal' },
  ],
  victory: { condition: 'points', pointsShareToWin: 600, dayLimit: null },
}

const ctx = { map: tinyMap(), rules: TEST_RULES }
const fresh = () => createInitialState(CONFIG, ctx)

const alertEvent = (tick: number): GameEvent => ({
  type: 'PROVINCE_CAPTURED',
  tick,
  severity: 'alert',
  audience: [],
  provinceId: 'beta',
  previousOwner: 'p1',
  newOwner: 'p2',
})

const arrivalEvent = (tick: number, armyId = 'a1'): GameEvent => ({
  type: 'ARMY_ARRIVED',
  tick,
  severity: 'info',
  audience: [],
  playerId: 'p1',
  armyId,
  provinceId: 'beta',
})

describe('R-TIME-01 Spielzeit zaehlt Ticks, nicht Sekunden', () => {
  it('laeuft genau die verlangte Zahl an Stunden', () => {
    const { state } = runTicks(fresh(), 10, ctx)
    expect(state.tick).toBe(10)
  })

  it('ist unabhaengig davon, wie der Lauf aufgeteilt wird', () => {
    const once = runTicks(fresh(), 30, ctx).state
    const twice = runTicks(runTicks(fresh(), 12, ctx).state, 18, ctx).state
    expect(hashValue(twice, { omitKeys: HASH_OMIT_KEYS })).toBe(hashValue(once, { omitKeys: HASH_OMIT_KEYS }))
  })

  it('sammelt die Ereignisse des gesamten Laufs', () => {
    const { events } = runTicks(fresh(), 48, ctx)
    expect(Array.isArray(events)).toBe(true)
  })

  it('weist unsinnige Tickzahlen zurueck', () => {
    expect(() => runTicks(fresh(), -1, ctx)).toThrow(RangeError)
    expect(() => runTicks(fresh(), 1.5, ctx)).toThrow(RangeError)
  })
})

describe('R-TIME-05 Der Kern liest niemals die Uhr', () => {
  it('enthaelt keinen Verweis auf Datum, Zeitgeber oder Bildtakt', () => {
    // The guard covers this too (T-M0-03); repeated here because R-TIME-05 is a
    // product promise, not just an architecture rule: closing the program must
    // stop the world.
    const dir = fileURLToPath(new URL('./', import.meta.url))
    const offenders: string[] = []
    const walk = (path: string): void => {
      for (const entry of readdirSync(path, { withFileTypes: true })) {
        const full = join(path, entry.name)
        if (entry.isDirectory()) walk(full)
        else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
          const text = readFileSync(full, 'utf8')
          if (/\b(Date\.now|new Date\(|performance\.now|setTimeout|setInterval)\b/.test(text)) {
            offenders.push(entry.name)
          }
        }
      }
    }
    walk(dir)
    expect(offenders).toEqual([])
  })
})

describe('R-TIME-03 Vorspulen bis zum Ziel', () => {
  it('spult eine feste Zahl Stunden vor', () => {
    const result = fastForward(fresh(), { kind: 'ticks', ticks: 50 }, ctx)
    expect(result.ticksRun).toBe(50)
    expect(result.state.tick).toBe(50)
    expect(result.stoppedBy).toBe('target')
  })

  it('spult ganze Spieltage vor', () => {
    const result = fastForward(fresh(), { kind: 'days', days: 3 }, ctx)
    expect(result.state.tick).toBe(72)
  })

  it('spult bis zum naechsten Tageswechsel vor', () => {
    const start = runTicks(fresh(), 5, ctx).state
    const result = fastForward(start, { kind: 'nextDay' }, ctx)
    expect(result.state.tick).toBe(24)
    expect(result.ticksRun).toBe(19)
  })

  it('bricht bei einer Obergrenze ab, statt endlos zu laufen', () => {
    // A target that never occurs must not hang the game.
    const result = fastForward(fresh(), { kind: 'battleStarts' }, ctx, { maxTicks: 40 })
    expect(result.stoppedBy).toBe('limit')
    expect(result.ticksRun).toBe(40)
  })

  it('hat eine vernuenftige Voreinstellung fuer die Obergrenze', () => {
    expect(DEFAULT_MAX_TICKS).toBeGreaterThanOrEqual(24 * 1000)
  })

  it('liefert denselben Zustand wie derselbe Lauf in Einzelschritten', () => {
    const stepped = runTicks(fresh(), 40, ctx).state
    const forwarded = fastForward(fresh(), { kind: 'ticks', ticks: 40 }, ctx).state
    expect(hashValue(forwarded, { omitKeys: HASH_OMIT_KEYS })).toBe(
      hashValue(stepped, { omitKeys: HASH_OMIT_KEYS }),
    )
  })
})

describe('R-TIME-03 Zielerkennung', () => {
  const state = { tick: 24 } as GameState

  it('erkennt eine erreichte Stundenzahl', () => {
    expect(targetReached({ kind: 'ticks', ticks: 10 }, [], state, 10, 24)).toBe(true)
    expect(targetReached({ kind: 'ticks', ticks: 10 }, [], state, 9, 24)).toBe(false)
  })

  it('erkennt den Tageswechsel', () => {
    expect(targetReached({ kind: 'nextDay' }, [], { tick: 24 } as GameState, 5, 24)).toBe(true)
    expect(targetReached({ kind: 'nextDay' }, [], { tick: 25 } as GameState, 5, 24)).toBe(false)
  })

  it('erkennt die Ankunft einer bestimmten Armee', () => {
    const events = [arrivalEvent(24, 'a7')]
    expect(targetReached({ kind: 'armyArrived', armyId: 'a7' }, events, state, 1, 24)).toBeTruthy()
    expect(targetReached({ kind: 'armyArrived', armyId: 'a1' }, events, state, 1, 24)).toBe(false)
  })

  it('erkennt eine fertige Baustelle', () => {
    const events: GameEvent[] = [
      {
        type: 'BUILD_COMPLETED',
        tick: 10,
        severity: 'info',
        audience: [],
        playerId: 'p1',
        provinceId: 'alpha',
        building: 'barracks',
        level: 1,
      },
    ]
    expect(targetReached({ kind: 'buildComplete', playerId: 'p1' }, events, state, 1, 24)).toBeTruthy()
    expect(targetReached({ kind: 'buildComplete', playerId: 'p2' }, events, state, 1, 24)).toBe(false)
  })
})

describe('R-TIME-03 Alarme unterbrechen das Vorspulen', () => {
  it('findet den ersten Alarm fuer den Spieler', () => {
    const events = [arrivalEvent(1), alertEvent(2)]
    expect(firstAlertFor(events, 'p1')).toMatchObject({ type: 'PROVINCE_CAPTURED' })
  })

  it('ignoriert Alarme, die einen anderen Spieler betreffen', () => {
    const privateAlert: GameEvent = { ...alertEvent(2), audience: ['p2'] }
    expect(firstAlertFor([privateAlert], 'p1')).toBeNull()
    expect(firstAlertFor([privateAlert], 'p2')).not.toBeNull()
  })

  it('haelt an, sobald ein Waechter ausloest', () => {
    // Stand-in for a real alert until provinces can actually fall (T-M5-02):
    // the mechanism is what matters here.
    const result = fastForward(fresh(), { kind: 'ticks', ticks: 100 }, ctx, {
      guards: [(state) => state.tick === 7],
    })
    expect(result.stoppedBy).toBe('alert')
    expect(result.state.tick).toBe(7)
    expect(result.ticksRun).toBe(7)
  })

  it('laeuft ohne Alarm bis zum Ziel durch', () => {
    // Well inside the first game day: nothing that raises an alert can happen yet.
    const result = fastForward(fresh(), { kind: 'ticks', ticks: 10 }, ctx, { alertsFor: 'p1' })
    expect(result.stoppedBy).toBe('target')
    expect(result.trigger).toBeNull()
  })
})
