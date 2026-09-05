import { TEST_RULES, placeArmy, smallWorld } from '@worldwar/testkit'
import { beforeEach, describe, expect, it } from 'vitest'
import { armyHp } from '../state/army'
import { createInitialState, type GameConfig } from '../state/create'
import type { GameState } from '../state/types'
import { step } from '../step'
import type { Command } from './types'

/**
 * Beschuss (R-BAT-06, T-M14-07).
 *
 * Diese Datei stand seit M4 als Beleg im Plan und existierte nicht — sie war einer der
 * 79 toten Pfade, die T-M14-02 gefunden hat. Was sie hätte finden müssen, steht unten:
 * der Beschuss traf jede fremde Armee in der Zielprovinz, Verbündete und Neutrale
 * eingeschlossen, und ließ ausgelöschte Armeen als leere Hüllen zurück.
 */

const map = smallWorld()
const ctx = { map, rules: TEST_RULES }

const CONFIG: GameConfig = {
  seed: 91,
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

/** Eine Artillerie von p1, die auf die Nachbarprovinz feuern kann. */
function setUp(): { schuetze: string; ziel: string } {
  state = createInitialState(CONFIG, ctx)
  state.diplomacy.relations['p1|p2']!.state = 'war'

  const ziel = 'm2'
  state.provinces[ziel]!.owner = 'p2'
  placeArmy(state, { owner: 'p1', at: 'm1', units: [{ unitKey: 'artillery', hpTotal: 30_000 }] })
  const schuetze = state.armyOrder.find((id) => state.armies[id]!.owner === 'p1')!
  return { schuetze, ziel }
}

const bombard = (armyId: string, target: string): Command =>
  ({ type: 'BOMBARD', playerId: 'p1', armyId, targetProvinceId: target }) as Command

const hpOf = (s: GameState, owner: string): number =>
  s.armyOrder
    .filter((id) => s.armies[id]!.owner === owner)
    .reduce((sum, id) => sum + armyHp(s.armies[id]!), 0)

beforeEach(() => {
  state = createInitialState(CONFIG, ctx)
})

describe('R-BAT-06 Beschuss trifft nur, wen er treffen darf', () => {
  it('trifft die Armee des Kriegsgegners', () => {
    const { schuetze, ziel } = setUp()
    placeArmy(state, { owner: 'p2', at: ziel, units: [{ unitKey: 'infantry', hpTotal: 20_000 }] })

    const nachher = step(state, [bombard(schuetze, ziel)], ctx).state
    expect(hpOf(nachher, 'p2')).toBeLessThan(20_000)
  })

  it('verschont eine neutrale Macht in derselben Provinz', () => {
    // Befund 51: gefiltert wurde auf `owner !== army.owner` — also auf *jede* fremde
    // Armee. Wer mit p1 im Frieden lebt und zufällig in der beschossenen Provinz steht,
    // bekam die volle Ladung, ohne dass je eine Kriegserklärung gefallen wäre. Die
    // Prüfung davor sieht nur, wem die *Provinz* gehört, nicht wer darin steht.
    const { schuetze, ziel } = setUp()
    placeArmy(state, { owner: 'p2', at: ziel, units: [{ unitKey: 'infantry', hpTotal: 20_000 }] })
    placeArmy(state, { owner: 'p3', at: ziel, units: [{ unitKey: 'infantry', hpTotal: 20_000 }] })

    const nachher = step(state, [bombard(schuetze, ziel)], ctx).state
    expect(hpOf(nachher, 'p2'), 'der Kriegsgegner blieb unbehelligt').toBeLessThan(20_000)
    expect(hpOf(nachher, 'p3'), 'die neutrale Macht wurde beschossen').toBe(20_000)
  })

  it('laesst keine leere Armee-Huelle zurueck', () => {
    // Befund 53: ausgeloeschte Armeen blieben als Hülle im Zustand — ohne
    // ARMY_DESTROYED, und eine solche Hülle hält ihren Besitzer am Leben, weshalb eine
    // Partie nie zu einem Sieger kommt (das hält T-M14-14 auf).
    const { schuetze, ziel } = setUp()
    placeArmy(state, { owner: 'p2', at: ziel, units: [{ unitKey: 'infantry', hpTotal: 100 }] })

    const ergebnis = step(state, [bombard(schuetze, ziel)], ctx)
    const huellen = ergebnis.state.armyOrder.filter((id) => ergebnis.state.armies[id]!.units.length === 0)

    expect(huellen, 'leere Armee-Huelle im Zustand').toEqual([])
    expect(ergebnis.events.some((e) => e.type === 'ARMY_DESTROYED')).toBe(true)
  })
})
