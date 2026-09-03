import { hashValue } from '@worldwar/shared'
import { TEST_RULES, placeArmy, smallWorld } from '@worldwar/testkit'
import { beforeEach, describe, expect, it } from 'vitest'
import { runTicks } from '../clock'
import { createInitialState, type GameConfig } from '../state/create'
import { HASH_OMIT_KEYS, SCHEMA_VERSION, type GameState } from '../state/types'
import { MemoryStorage, StorageEntryNotFound, type StoragePort } from './StoragePort'
import { UnsupportedSaveVersion } from './migrate'
import {
  AUTOSAVE_SLOTS,
  SaveFormatError,
  autosaveName,
  deserialise,
  loadGame,
  saveGame,
  serialise,
  shouldAutosave,
  writeAutosave,
  type AutosaveState,
} from './save'

const map = smallWorld()
const ctx = { map, rules: TEST_RULES }

const CONFIG: GameConfig = {
  seed: 606,
  mapId: 'testworld',
  rulesId: 'default',
  players: [
    { name: 'A', kind: 'human', nation: 'Nordland', color: '#0f62bc' },
    { name: 'B', kind: 'ai', nation: 'Ostmark', color: '#b03a2e', difficulty: 'normal' },
  ],
  victory: { condition: 'points', pointsShareToWin: 900, dayLimit: null },
}

let state: GameState
let storage: StoragePort

const hashOf = (s: GameState) => hashValue(s, { omitKeys: HASH_OMIT_KEYS })

beforeEach(() => {
  state = createInitialState(CONFIG, ctx)
  placeArmy(state, { owner: 'p1', at: 'n1', units: [{ unitKey: 'infantry', hpTotal: 12_000 }] })
  state = runTicks(state, 40, ctx).state
  storage = new MemoryStorage()
})

describe('R-GAME-03 Speichern und Laden', () => {
  it('stellt den Zustand bitgenau wieder her', () => {
    const restored = deserialise(serialise(state))
    expect(hashOf(restored)).toBe(hashOf(state))
    expect(restored).toEqual(state)
  })

  it('setzt die Simulation identisch fort', () => {
    // The point of the exercise: a loaded game must be indistinguishable from one
    // that was never interrupted.
    const uninterrupted = runTicks(state, 60, ctx).state
    const resumed = runTicks(deserialise(serialise(state)), 60, ctx).state
    expect(hashOf(resumed)).toBe(hashOf(uninterrupted))
  })

  it('speichert und laedt ueber den Speicher-Port', async () => {
    await saveGame(storage, 'partie.json', state, 'Testlauf')
    expect(await storage.list()).toEqual(['partie.json'])

    const loaded = await loadGame(storage, 'partie.json')
    expect(hashOf(loaded)).toBe(hashOf(state))
  })

  it('meldet einen unbekannten Speicherstand klar', async () => {
    await expect(loadGame(storage, 'gibtsnicht.json')).rejects.toBeInstanceOf(StorageEntryNotFound)
  })
})

describe('R-GAME-05 Beschaedigte und fremde Staende', () => {
  it('weist unlesbare Dateien zurueck', () => {
    expect(() => deserialise('kein json')).toThrow(SaveFormatError)
    expect(() => deserialise('{"nur":"unfug"}')).toThrow(SaveFormatError)
  })

  it('erkennt einen veraenderten Speicherstand', () => {
    // Editing a save by hand is allowed to fail — but it has to fail loudly.
    const envelope = JSON.parse(serialise(state))
    envelope.state.players.p1.resources.money = 999_999_999
    expect(() => deserialise(JSON.stringify(envelope))).toThrow(/Prüfsumme/)
  })

  it('weist eine neuere Spielversion zurueck', () => {
    const envelope = JSON.parse(serialise(state))
    envelope.schemaVersion = SCHEMA_VERSION + 5
    expect(() => deserialise(JSON.stringify(envelope))).toThrow(UnsupportedSaveVersion)
  })

  it('weist eine zu alte Version mit Erklaerung zurueck', () => {
    const envelope = JSON.parse(serialise(state))
    envelope.schemaVersion = 0
    expect(() => deserialise(JSON.stringify(envelope))).toThrow(/keine Umstellung/)
  })
})

describe('R-GAME-04 Automatisches Speichern', () => {
  const base: AutosaveState = { lastSavedTick: 0, lastSavedRealTime: 0, nextSlot: 0 }

  it('speichert erst, wenn Spielzeit UND Echtzeit vergangen sind', () => {
    // At a thousand game hours per second, ticks alone would trigger dozens of saves
    // per second and fill the rotation with near-identical states.
    expect(shouldAutosave(base, 24, 70_000, 1, 24)).toBe(true)
    expect(shouldAutosave(base, 24, 1_000, 1, 24)).toBe(false) // enough ticks, no time
    expect(shouldAutosave(base, 5, 70_000, 1, 24)).toBe(false) // enough time, no ticks
  })

  it('rotiert ueber mehrere Staende', async () => {
    let autosave = base
    for (let i = 0; i < AUTOSAVE_SLOTS + 2; i++) {
      autosave = await writeAutosave(storage, autosave, state, i * 100_000)
    }

    const files = await storage.list()
    expect(files).toHaveLength(AUTOSAVE_SLOTS)
    expect(files).toContain(autosaveName(0))
  })

  it('haelt den zuletzt gespeicherten Zeitpunkt fest', async () => {
    const after = await writeAutosave(storage, base, state, 123_000)
    expect(after.lastSavedTick).toBe(state.tick)
    expect(after.lastSavedRealTime).toBe(123_000)
  })
})

describe('R-GAME-03 Der Speicher-Port ist austauschbar', () => {
  it('erfuellt denselben Vertrag', async () => {
    const port: StoragePort = new MemoryStorage()

    expect(await port.exists('x')).toBe(false)
    await port.write('x', 'inhalt')
    expect(await port.exists('x')).toBe(true)
    expect(await port.read('x')).toBe('inhalt')
    expect(await port.list()).toEqual(['x'])

    await port.remove('x')
    expect(await port.exists('x')).toBe(false)
    await expect(port.read('x')).rejects.toBeInstanceOf(StorageEntryNotFound)
  })
})
