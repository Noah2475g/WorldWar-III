import { hashValue } from '@worldwar/shared'
import { TEST_RULES, tinyMap } from '@worldwar/testkit'
import { describe, expect, it } from 'vitest'
import { createInitialState, type GameConfig } from '../src/state/create'
import { PHASE_ORDER, step } from '../src/step'
import { HASH_OMIT_KEYS } from '../src/state/types'

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

describe('R-ARCH-01 Tick-Pipeline', () => {
  it('haelt die im Design festgelegte Phasenreihenfolge ein', () => {
    // The order is not cosmetic: retreat before movement, movement before combat,
    // combat before occupation. Swapping any two changes the game (design D3).
    expect(PHASE_ORDER).toEqual([
      'applyCommands',
      'production',
      'upkeep',
      'construction',
      'recruitment',
      'retreat',
      'movement',
      'combat',
      'occupation',
      'regeneration',
      'diplomacy',
      'bookkeeping',
    ])
  })

  it('ruft jede Phase genau einmal und in dieser Reihenfolge auf', () => {
    const seen: string[] = []
    step(fresh(), [], ctx, { onPhase: (name) => seen.push(name) })
    expect(seen).toEqual([...PHASE_ORDER])
  })

  it('erhoeht die Spielzeit um genau eine Stunde', () => {
    const before = fresh()
    const { state } = step(before, [], ctx)
    expect(state.tick).toBe(before.tick + 1)
  })

  it('laesst den Eingangszustand unveraendert', () => {
    // Purity is proven by hash, not by deep-copying on every tick (design D5).
    const before = fresh()
    const hashBefore = hashValue(before, { omitKeys: HASH_OMIT_KEYS })
    step(before, [], ctx)
    expect(hashValue(before, { omitKeys: HASH_OMIT_KEYS })).toBe(hashBefore)
  })

  it('aendert ohne Kommandos nichts ausser der Zeit', () => {
    const before = fresh()
    const { state } = step(before, [], ctx)
    const strip = (s: typeof state) => ({ ...s, tick: 0, eventLog: [], rng: null })
    expect(hashValue(strip(state))).toBe(hashValue(strip(before)))
  })

  it('liefert die Ereignisse dieses Ticks getrennt zurueck', () => {
    const { events } = step(fresh(), [], ctx)
    expect(Array.isArray(events)).toBe(true)
  })
})

describe('R-TIME-01 Tagesabrechnung', () => {
  it('rechnet den Tag erst nach 24 Stunden ab', () => {
    const seen: string[] = []
    let state = fresh()
    for (let i = 0; i < 24; i++) {
      const result = step(state, [], ctx, { onPhase: (name) => seen.push(`${state.tick}:${name}`) })
      state = result.state
    }
    const dailyTicks = seen.filter((entry) => entry.endsWith(':dailyTick'))
    expect(dailyTicks).toHaveLength(1)
    expect(dailyTicks[0]).toBe('23:dailyTick') // the tick that completes the first day
  })

  it('rechnet ueber vier Tage genau viermal ab', () => {
    let state = fresh()
    let daily = 0
    for (let i = 0; i < 96; i++) {
      const result = step(state, [], ctx, { onPhase: (name) => name === 'dailyTick' && daily++ })
      state = result.state
    }
    expect(daily).toBe(4)
    expect(state.tick).toBe(96)
  })

  it('haengt die Tagesabrechnung hinter die Buchhaltung', () => {
    const seen: string[] = []
    let state = fresh()
    for (let i = 0; i < 24; i++) {
      state = step(state, [], ctx, { onPhase: (name) => seen.push(name) }).state
    }
    expect(seen.at(-1)).toBe('dailyTick')
    expect(seen.at(-2)).toBe('bookkeeping')
  })
})

describe('R-ARCH-01 Wiederholbarkeit der Pipeline', () => {
  it('erzeugt aus gleichem Start dieselbe Hash-Folge', () => {
    const runHashes = () => {
      let state = fresh()
      const hashes: string[] = []
      for (let i = 0; i < 50; i++) {
        state = step(state, [], ctx).state
        hashes.push(hashValue(state, { omitKeys: HASH_OMIT_KEYS }))
      }
      return hashes
    }
    expect(runHashes()).toEqual(runHashes())
  })
})
