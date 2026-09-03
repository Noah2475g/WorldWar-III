import { HASH_OMIT_KEYS, MemoryStorage, createInitialState, type GameConfig, type GameState } from '@worldwar/core'
import { hashValue } from '@worldwar/shared'
import { TEST_RULES, smallWorld } from '@worldwar/testkit'
import { beforeEach, describe, expect, it } from 'vitest'
import { MANUAL_SLOTS, autosaveDue, listSlots, loadFrom, manualSlotName, saveTo } from './saves.ts'

/**
 * Saving from the interface's side (T-M10-07b, R-GAME-03/04/05).
 *
 * The core already proves that a save round-trips bit for bit. What is checked here is
 * the part the player meets: that a broken save is refused *in words*, and that the
 * automatic saves do not fill their rotation with five copies of the same second.
 */

const map = smallWorld()
const ctx = { map, rules: TEST_RULES }
const CONFIG: GameConfig = {
  seed: 5,
  mapId: 'testworld',
  rulesId: 'default',
  players: [
    { name: 'A', kind: 'human', nation: 'Nordland', color: '#9FB2BE' },
    { name: 'B', kind: 'ai', nation: 'Ostmark', color: '#C4A99C', difficulty: 'normal' },
  ],
  victory: { condition: 'points', pointsShareToWin: 900, dayLimit: null },
}

let storage: MemoryStorage

beforeEach(() => {
  storage = new MemoryStorage()
})

describe('R-GAME-03 Speichern und Laden aus der Oberflaeche', () => {
  it('stellt einen gespeicherten Stand unveraendert wieder her', async () => {
    const state = createInitialState(CONFIG, ctx)
    await saveTo(storage, manualSlotName(0), state)

    const result = await loadFrom(storage, manualSlotName(0))

    expect(result.ok).toBe(true)
    const hash = (s: GameState) => hashValue(s, { omitKeys: HASH_OMIT_KEYS })
    if (result.ok) expect(hash(result.state)).toBe(hash(state))
  })

  it('lehnt einen beschaedigten Stand mit einem Satz ab', async () => {
    // Not with an exception and not by silently starting over: a player who loses an
    // evening is entitled to know that they did.
    await storage.write(manualSlotName(1), '{ das ist kein Spielstand')

    const result = await loadFrom(storage, manualSlotName(1))

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain('beschädigt')
      expect(result.message).not.toContain('JSON')
    }
  })

  it('erklaert einen Stand aus einer anderen Fassung', async () => {
    await storage.write(
      manualSlotName(2),
      JSON.stringify({ schemaVersion: 99, savedAtTick: 0, state: {} }),
    )

    const result = await loadFrom(storage, manualSlotName(2))

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toContain('Fassung')
  })

  it('meldet einen fehlenden Stand, statt zu stuerzen', async () => {
    const result = await loadFrom(storage, 'gibt-es-nicht')

    expect(result.ok).toBe(false)
  })
})

describe('R-GAME-04 Die Liste der Staende', () => {
  it('zeigt fuenf Handstaende und die automatischen', async () => {
    const slots = await listSlots(storage, 24)

    expect(slots.filter((s) => s.name.startsWith('stand-'))).toHaveLength(MANUAL_SLOTS)
    expect(slots.length).toBeGreaterThan(MANUAL_SLOTS)
  })

  it('zeigt leere Staende als leer und gefuellte mit ihrem Tag', async () => {
    const state = createInitialState(CONFIG, ctx)
    state.tick = 24 * 33
    await saveTo(storage, manualSlotName(0), state)

    const slots = await listSlots(storage, 24)

    expect(slots.find((s) => s.name === manualSlotName(0))?.savedAtDay).toBe(34)
    expect(slots.find((s) => s.name === manualSlotName(1))?.savedAtDay).toBeNull()
  })
})

describe('R-GAME-04 Automatisches Speichern', () => {
  const autosave = { lastSavedTick: 0, lastSavedRealTime: 0, nextSlot: 0 }
  const state = { tick: 24 * 5 } as never

  it('speichert erst, wenn Spielzeit UND Echtzeit vergangen sind', () => {
    // At a hundred game hours a second, ticks alone would fill the whole rotation with
    // near-identical states in half a minute — the opposite of a safety net.
    expect(autosaveDue(autosave, state, 6 * 60_000, 5, 24)).toBe(true)
    expect(autosaveDue(autosave, state, 1000, 5, 24)).toBe(false)
  })

  it('speichert nicht, wenn kaum Spielzeit vergangen ist', () => {
    const barely = { tick: 2 } as never

    expect(autosaveDue(autosave, barely, 60 * 60_000, 5, 24)).toBe(false)
  })
})
