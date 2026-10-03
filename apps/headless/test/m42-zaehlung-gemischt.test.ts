import { describe, expect, it } from 'vitest'
import { createInitialState, type GameConfig, type GameState, type PlayerId } from '@worldwar/core'
import { TEST_RULES, placeArmy, smallWorld } from '@worldwar/testkit'
import { m42Zaehler } from './m42-zaehlung'

/**
 * Review Punkt 5 (T-M42-18): die Zahl "gemischte Armeen mit Reichweiteneinheit". Eigene Datei, damit die
 * Faelle von T-M42-01 in `m42-zaehlung.test.ts` unveraendert bleiben.
 */
const map = smallWorld()
const rules = TEST_RULES
const CONFIG: GameConfig = {
  seed: 4202,
  mapId: 'testworld',
  rulesId: 'default',
  players: [
    { name: 'Leicht', kind: 'ai', nation: 'Nordland', color: '#0f62bc', difficulty: 'easy' },
    { name: 'Normal', kind: 'ai', nation: 'Ostmark', color: '#b03a2e', difficulty: 'normal' },
  ],
  victory: { condition: 'points', pointsShareToWin: 900, dayLimit: null },
}
const KI: ReadonlySet<PlayerId> = new Set(['p1', 'p2'])
const leer = (state: GameState) => ({ state, events: [], applied: [] })

describe('T-M42-18 gemischte Armeen mit Reichweiteneinheit (Review Punkt 5)', () => {
  it('G1: zaehlt nur Armeen mit Reichweiteneinheit UND anderer Einheit, Hoechstwert und Endstand', () => {
    const zaehler = m42Zaehler(rules, KI)
    const state = createInitialState(CONFIG, { map, rules })
    // Die Startaufstellung zaehlt als Grundwert mit; geprueft wird der Unterschied.
    zaehler.tagesende(leer(state))
    const basis = zaehler.bericht().heer.gemischteMitReichweite.hoechstens

    // Batterie (keine), Linie (keine), gemischt (eine) mit 3 Artillerien.
    placeArmy(state, { owner: 'p1', at: 'n1', units: [{ unitKey: 'artillery', hpTotal: 2 * rules.units['artillery']!.hpPerUnit }] })
    placeArmy(state, { owner: 'p1', at: 'n1', units: [{ unitKey: 'infantry', hpTotal: 5_000 }] })
    const gemischt = placeArmy(state, {
      owner: 'p2',
      at: 'o1',
      units: [
        { unitKey: 'infantry', hpTotal: 8_000 },
        { unitKey: 'artillery', hpTotal: 3 * rules.units['artillery']!.hpPerUnit },
      ],
    })
    zaehler.tagesende(leer(state))
    let heer = zaehler.bericht().heer.gemischteMitReichweite
    expect(heer.hoechstens).toBe(basis + 1)
    expect(heer.amEnde).toBe(basis + 1)
    expect(heer.reichweiteEinheitenAmEnde).toBeGreaterThanOrEqual(3)

    // Am naechsten Tagesende ohne die gemischte Armee: der Hoechstwert bleibt, der Endstand faellt.
    delete state.armies[gemischt.id]
    state.armyOrder = state.armyOrder.filter((id) => id !== gemischt.id)
    zaehler.tagesende(leer(state))
    heer = zaehler.bericht().heer.gemischteMitReichweite
    expect(heer.hoechstens).toBe(basis + 1)
    expect(heer.amEnde).toBe(basis)
  })
})
