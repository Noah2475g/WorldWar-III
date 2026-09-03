import { TEST_RULES, placeArmy, smallWorld } from '@worldwar/testkit'
import { beforeEach, describe, expect, it } from 'vitest'
import { createInitialState, type GameConfig } from '../state/create'
import { publicView } from './publicView'
import type { GameState } from '../state/types'

/**
 * What the view hands the interface for its displays (T-M13-05, R-DIP-04, R-UI-09).
 *
 * Four things were missing and every one of them is something a progress bar needs:
 * what is being built and when it is done, the same for a levy, where morale is
 * heading, and where fighting is going on. They are added here rather than worked out
 * in the interface, for the reason the project has held to since D11 — the interface
 * shows the game, it does not play it.
 *
 * And every one of them obeys the fog of war. A progress bar is a fine thing right up
 * until it tells the player what an opponent is building.
 */

const map = smallWorld()
const ctx = { map, rules: TEST_RULES }

const CONFIG: GameConfig = {
  seed: 7,
  mapId: 'testworld',
  rulesId: 'default',
  players: [
    { name: 'Mensch', kind: 'human', nation: 'Nordland', color: '#0f62bc' },
    { name: 'KI', kind: 'ai', nation: 'Ostmark', color: '#b03a2e', difficulty: 'normal' },
  ],
  victory: { condition: 'points', pointsShareToWin: 900, dayLimit: null },
}

let state: GameState

beforeEach(() => {
  state = createInitialState(CONFIG, ctx)
})

/** The first province each player owns, for tests that need one of each. */
const ownProvince = (player: string): string =>
  state.provinceOrder.find((id) => state.provinces[id]!.owner === player)!

describe('R-UI-09 Die Sicht nennt, was gerade laeuft', () => {
  it('gibt Bauvorhaben mit ihrem Fertigstellungszeitpunkt heraus', () => {
    const id = ownProvince('p1')
    state.provinces[id]!.buildQueue.push({
      id: 'o1',
      building: 'barracks',
      level: 1,
      startedTick: 0,
      completesAtTick: 48,
      ownerAtStart: 'p1',
    })

    const seen = publicView(state, 'p1', TEST_RULES).provinces.find((p) => p.id === id)

    // Anfang und Ende: ein Fortschrittsbalken braucht beide Enden.
    expect(seen?.buildQueue).toEqual([{ building: 'barracks', startedTick: 0, completesAtTick: 48 }])
    // The length stays as it was; a display that already reads it keeps working.
    expect(seen?.buildQueueLength).toBe(1)
  })

  it('gibt Aushebungen mit ihrem Fertigstellungszeitpunkt heraus', () => {
    const id = ownProvince('p1')
    state.provinces[id]!.recruitQueue.push({
      id: 'o2',
      unitKey: 'infantry',
      count: 2,
      startedTick: 0,
      completesAtTick: 30,
      ownerAtStart: 'p1',
    })

    const seen = publicView(state, 'p1', TEST_RULES).provinces.find((p) => p.id === id)

    expect(seen?.recruitQueue).toEqual([{ unitKey: 'infantry', count: 2, startedTick: 0, completesAtTick: 30 }])
  })

  it('nennt, wohin die Moral laeuft', () => {
    // The current value alone cannot say whether a province is settling down or coming
    // apart — and that is the only thing the player wants to know about it.
    const id = ownProvince('p1')
    state.provinces[id]!.morale = 60_000
    state.provinces[id]!.targetMorale = 80_000

    const seen = publicView(state, 'p1', TEST_RULES).provinces.find((p) => p.id === id)

    expect(seen?.moraleTarget).toBe(80_000)
  })

  it('nennt laufende Kaempfe in Provinzen, die der Spieler sieht', () => {
    const id = ownProvince('p1')
    state.battles.push({ id: 'b1', provinceId: id, sides: [['p1'], ['p2']], startedTick: 5 })

    expect(publicView(state, 'p1', TEST_RULES).battles).toEqual([{ provinceId: id, startedTick: 5 }])
  })
})

describe('R-DIP-04 Die neuen Felder halten den Nebel ein', () => {
  it('verschweigt Bauvorhaben und Aushebungen fremder Provinzen', () => {
    const enemy = ownProvince('p2')
    state.provinces[enemy]!.buildQueue.push({
      id: 'o3',
      building: 'fortress',
      level: 1,
      startedTick: 0,
      completesAtTick: 90,
      ownerAtStart: 'p2',
    })
    state.provinces[enemy]!.recruitQueue.push({
      id: 'o4',
      unitKey: 'tank',
      count: 3,
      startedTick: 0,
      completesAtTick: 90,
      ownerAtStart: 'p2',
    })
    // Make it visible: a scout standing next door sees the province, not its plans.
    placeArmy(state, { owner: 'p1', at: enemy, units: [{ unitKey: 'infantry', hpTotal: 1000 }] })

    const seen = publicView(state, 'p1', TEST_RULES).provinces.find((p) => p.id === enemy)

    expect(seen, 'Die Provinz sollte sichtbar sein').toBeTruthy()
    expect(seen?.buildQueue).toBeUndefined()
    expect(seen?.recruitQueue).toBeUndefined()
    expect(seen?.moraleTarget).toBeUndefined()
  })

  it('verschweigt Kaempfe in Provinzen, die der Spieler nicht sieht', () => {
    const hidden = state.provinceOrder.find(
      (id) => !publicView(state, 'p1', TEST_RULES).provinces.some((p) => p.id === id),
    )
    expect(hidden, 'Die Testkarte hat keine unsichtbare Provinz').toBeTruthy()

    state.battles.push({ id: 'b2', provinceId: hidden!, sides: [['p2'], ['p1']], startedTick: 5 })

    expect(publicView(state, 'p1', TEST_RULES).battles).toEqual([])
  })
})

describe('R-UI-09 Ohne Regeln bleibt die Sicht schlank', () => {
  it('berechnet die Anzeigefelder nur, wenn die Regeln mitkommen', () => {
    // The AI asks for the view every tick and reads none of this; it should not pay for
    // it either. The same rule `economy` has followed since M6.
    const id = ownProvince('p1')
    state.provinces[id]!.buildQueue.push({
      id: 'o5',
      building: 'barracks',
      level: 1,
      startedTick: 0,
      completesAtTick: 48,
      ownerAtStart: 'p1',
    })
    state.battles.push({ id: 'b3', provinceId: id, sides: [['p1'], ['p2']], startedTick: 5 })

    const lean = publicView(state, 'p1')
    const seen = lean.provinces.find((p) => p.id === id)

    expect(lean.battles).toBeUndefined()
    expect(seen?.buildQueue).toBeUndefined()
    expect(seen?.recruitQueue).toBeUndefined()
    expect(seen?.moraleTarget).toBeUndefined()
    // What was there before stays there — this must not become a second contract.
    expect(seen?.buildQueueLength).toBe(1)
  })
})

describe('R-UI-13 Die Sicht sagt, wie weit der Sieg entfernt ist', () => {
  it('nennt die Punktschwelle, wenn die Regeln mitkommen', () => {
    const view = publicView(state, 'p1', TEST_RULES)

    expect(view.victory.pointsShareToWin).toBe(900)
    expect(view.victory.condition).toBe('points')
  })

  it('nennt sie nicht ohne Regeln', () => {
    expect(publicView(state, 'p1').victory.pointsShareToWin).toBeUndefined()
  })
})

describe('R-UI-09 Die Sicht sagt, seit wann eine Armee marschiert', () => {
  it('gibt Abmarsch und Ankunft der eigenen Armee heraus', () => {
    const army = placeArmy(state, {
      owner: 'p1',
      at: ownProvince('p1'),
      units: [{ unitKey: 'infantry', hpTotal: 1000 }],
    })
    army.departureTick = 10
    army.arrivalTick = 40

    const seen = publicView(state, 'p1', TEST_RULES).armies.find((a) => a.id === army.id)

    expect(seen?.departureTick).toBe(10)
    expect(seen?.arrivalTick).toBe(40)
  })

  it('sagt bei fremden Armeen weiterhin nur, dass sie da sind', () => {
    const enemy = placeArmy(state, {
      owner: 'p2',
      at: ownProvince('p1'),
      units: [{ unitKey: 'infantry', hpTotal: 1000 }],
    })
    enemy.departureTick = 10

    const seen = publicView(state, 'p1', TEST_RULES).armies.find((a) => a.id === enemy.id)

    expect(seen, 'Die fremde Armee steht in eigener Provinz und ist sichtbar').toBeTruthy()
    expect(seen?.departureTick).toBeUndefined()
  })
})
