import { HASH_OMIT_KEYS, MemoryStorage, createInitialState, type GameConfig, type GameState, type PublicView } from '@worldwar/core'
import { hashValue } from '@worldwar/shared'
import { TEST_RULES, smallWorld } from '@worldwar/testkit'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  MANUAL_SLOTS,
  TIMELINE_CAP,
  autosaveDue,
  listSlots,
  loadFrom,
  loadTimeline,
  manualSlotName,
  recordTimelineDay,
  saveTimeline,
  saveTo,
  timelineName,
  type TimelineEntry,
} from './saves.ts'

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

/**
 * Die Zeitreihe der Partie (T-M25-01, R-UI-13, D25.1).
 *
 * Die Sicht kennt nur das Jetzt — für jeden Verlauf braucht die Hülle eine
 * Aufzeichnung. Sie wächst am Tageswechsel um genau einen Eintrag (Punkte je bekannter
 * Macht, eigene Bestände und Bilanzen), hält einen Deckel und wandert je
 * Spielstand-Slot als eigener Schlüssel mit. Best effort: ein alter Stand ohne
 * Aufzeichnung beginnt die Kurve ehrlich am Ladetag statt eine zu erfinden.
 */
describe('R-UI-13 Die Zeitreihe der Partie', () => {
  const sicht = (tick: number, score = 100): PublicView =>
    ({
      tick,
      playerId: 'p1',
      self: {
        score,
        economy: {
          food: { stock: 500_000, production: 220_000, consumption: 100_000, balance: 120_000, committed: 0 },
          iron: { stock: 80_000, production: 0, consumption: 40_000, balance: -40_000, committed: 0 },
        },
      },
      others: [
        { id: 'p2', score: 300, alive: true },
        { id: 'p3', score: 50, alive: false },
      ],
    }) as unknown as PublicView

  it('waechst je Spieltag um genau einen Eintrag', () => {
    const ersterTag = recordTimelineDay([], sicht(24), 24)
    expect(ersterTag).toHaveLength(1)

    // Ein zweiter Aufruf am selben Tag (Vorspulen in Haeppchen) erfindet keinen zweiten
    // Eintrag — und laesst die Reihe unveraendert, damit React nichts umsonst zeichnet.
    expect(recordTimelineDay(ersterTag, sicht(30), 24)).toBe(ersterTag)

    expect(recordTimelineDay(ersterTag, sicht(48), 24)).toHaveLength(2)
  })

  it('traegt Punkte je lebender Macht sowie eigene Bestaende und Bilanzen', () => {
    const [eintrag] = recordTimelineDay([], sicht(24), 24)

    expect(eintrag!.day).toBe(2)
    // Die ausgeschiedene Macht p3 bekommt keinen Punktestand mehr.
    expect(eintrag!.scores).toEqual({ p1: 100, p2: 300 })
    expect(eintrag!.stock.food).toBe(500_000)
    expect(eintrag!.balance.food).toBe(120_000)
    expect(eintrag!.balance.iron).toBe(-40_000)
  })

  it('haelt den Deckel: alte Tage fallen vorn heraus', () => {
    let reihe: readonly TimelineEntry[] = []
    for (let tag = 0; tag < TIMELINE_CAP + 20; tag++) {
      reihe = recordTimelineDay(reihe, sicht(tag * 24), 24)
    }

    expect(reihe).toHaveLength(TIMELINE_CAP)
    // Der aelteste verbliebene Tag ist der einundzwanzigste des Laufs.
    expect(reihe[0]!.day).toBe(21)
    expect(reihe[reihe.length - 1]!.day).toBe(TIMELINE_CAP + 20)
  })

  it('wandert je Spielstand-Slot mit: Speichern und Laden erhalten sie', async () => {
    const reihe = recordTimelineDay([], sicht(24), 24)

    await saveTimeline(storage, manualSlotName(0), reihe)

    expect(await loadTimeline(storage, manualSlotName(0))).toEqual(reihe)
  })

  it('beginnt ohne Aufzeichnung ehrlich leer — auch bei einem kaputten Schluessel', async () => {
    // Ein alter Stand hat keine Zeitreihe; die Kurve beginnt am Ladetag.
    expect(await loadTimeline(storage, manualSlotName(1))).toEqual([])

    // Und ein unlesbarer Schluessel ist dasselbe wie keiner: best effort, kein Absturz.
    await storage.write(timelineName(manualSlotName(2)), '{ das ist keine Zeitreihe')
    expect(await loadTimeline(storage, manualSlotName(2))).toEqual([])
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
