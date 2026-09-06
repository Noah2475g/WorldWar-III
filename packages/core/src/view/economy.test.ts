import { TEST_RULES, placeArmy, smallWorld } from '@worldwar/testkit'
import { beforeEach, describe, expect, it } from 'vitest'
import { createInitialState, type GameConfig } from '../state/create'
import { runTicks } from '../clock'
import { publicView } from './publicView'
import { economyOverview } from './economy'
import type { GameState, ResourceKey } from '../state/types'

/**
 * The economy overview (R-ECON-06).
 *
 * The one test that matters here is the third: the production figure the interface
 * shows has to be the production the simulation actually delivers. An overview derived
 * from its own arithmetic looks right on the day it is written and is wrong by the
 * next change to the rules — so it is checked against a played-out game day, not
 * against a second copy of the formula.
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

describe('R-ECON-06 Bestand, Produktion, Verbrauch und Bilanz je Rohstoff', () => {
  it('nennt fuer jeden Rohstoff alle vier Zahlen', () => {
    const overview = economyOverview(state, 'p1', TEST_RULES)

    for (const [resource, flow] of Object.entries(overview)) {
      expect(typeof flow.stock, resource).toBe('number')
      expect(typeof flow.production, resource).toBe('number')
      expect(typeof flow.consumption, resource).toBe('number')
      expect(flow.balance, resource).toBe(flow.production - flow.consumption)
    }
  })

  it('zeigt den Bestand, den der Spieler wirklich hat', () => {
    const overview = economyOverview(state, 'p1', TEST_RULES)
    for (const [key, flow] of Object.entries(overview)) {
      expect(flow.stock).toBe(state.players.p1!.resources[key as ResourceKey])
    }
  })

  it('sagt die Tagesproduktion voraus, die der Tag dann liefert', () => {
    // Ohne Armeen: was hereinkommt, ist genau die Produktion — kein Unterhalt
    // verrechnet sich dazwischen.
    const forecast = economyOverview(state, 'p1', TEST_RULES)
    const before = { ...state.players.p1!.resources }

    const after = runTicks(state, TEST_RULES.constants.ticksPerDay, ctx, () => []).state

    let checked = 0
    for (const [key, flow] of Object.entries(forecast)) {
      const resource = key as ResourceKey
      const actual = after.players.p1!.resources[resource] - before[resource]
      if (flow.production === 0) {
        expect(actual, `${resource} wurde produziert, ohne angekuendigt zu sein`).toBe(0)
        continue
      }
      checked++

      // Nicht auf die Einheit genau: die Moral wandert im Lauf des Tages, und der
      // Uebertrag aus der Festkomma-Rechnung verschiebt einzelne Einheiten. Zehn
      // Prozent trennen "die Vorschau stimmt" sicher von "sie rechnet etwas anderes".
      const deviation = Math.abs(actual - flow.production) / flow.production
      expect(deviation, `${resource}: angekuendigt ${flow.production}, geliefert ${actual}`).toBeLessThan(0.1)
    }

    // Sonst prueft der Test nur, dass nichts angekuendigt und nichts geliefert wurde.
    expect(checked, 'Kein Rohstoff wurde ueberhaupt produziert').toBeGreaterThan(2)
  })

  it('rechnet den Unterhalt der Armeen als Verbrauch', () => {
    const without = economyOverview(state, 'p1', TEST_RULES)
    placeArmy(state, { owner: 'p1', at: 'n1', units: [{ unitKey: 'infantry', hpTotal: 100_000 }] })
    const withArmy = economyOverview(state, 'p1', TEST_RULES)

    const eaten = Object.entries(withArmy).filter(([key, flow]) => flow.consumption > without[key as ResourceKey].consumption)
    expect(eaten.length, 'Eine Armee kostet nichts').toBeGreaterThan(0)

    for (const [key, flow] of eaten) {
      const resource = key as ResourceKey
      expect(flow.balance).toBe(flow.production - flow.consumption)
      expect(flow.balance).toBeLessThan(without[resource].balance)
    }
  })

  it('haelt eine ausgeschiedene Macht bei null, statt zu brechen', () => {
    state.players.p2!.alive = false
    const overview = economyOverview(state, 'p2', TEST_RULES)

    for (const flow of Object.values(overview)) {
      expect(flow.production).toBe(0)
      expect(flow.consumption).toBe(0)
    }
  })

  it('liegt der Oberflaeche in der Sicht bei, aber nur wenn sie danach fragt', () => {
    // Die KI bekommt sie nicht: sie braucht die Uebersicht nicht, und sie kostet einen
    // Durchlauf ueber alle Provinzen.
    expect(publicView(state, 'p1').self.economy).toBeUndefined()

    const economy = publicView(state, 'p1', TEST_RULES).self.economy
    expect(economy).toBeDefined()
    expect(economy!.food.production).toBe(economyOverview(state, 'p1', TEST_RULES).food.production)
  })
/**
   * Wohin die Rohstoffe gehen (T-M12-10, Playtest-Frage 15).
   *
   * Die Uebersicht fuehrte allein den Armeeunterhalt. Wer baute, sah seinen Bestand
   * fallen und fand die Zahl nirgends wieder — die Frage "wohin gehen meine Rohstoffe"
   * blieb offen, obwohl das Panel genau dafuer da ist.
   *
   * Gemessen wird gegen die Regeln, nicht gegen eine zweite Kopie der Rechnung.
   */
  describe('R-ECON-06 Was in Auftraegen gebunden ist', () => {
    it('zaehlt einen laufenden Bau zu den gebundenen Mitteln', () => {
      const eigene = state.provinceOrder.find((id) => state.provinces[id]!.owner === 'p1')!
      const kosten = TEST_RULES.buildings.barracks!.cost
      state.provinces[eigene]!.buildQueue = [
        {
          id: 'o1',
          building: 'barracks',
          level: 1,
          startedTick: 0,
          completesAtTick: 24,
          ownerAtStart: 'p1',
        },
      ]

      const overview = economyOverview(state, 'p1', TEST_RULES)

      for (const [key, amount] of Object.entries(kosten)) {
        expect(overview[key as ResourceKey].committed).toBe(amount)
      }
    })

    it('laesst Bilanz und Unterhalt unberuehrt — eine Einmalzahlung ist keine Rate', () => {
      const eigene = state.provinceOrder.find((id) => state.provinces[id]!.owner === 'p1')!
      const vorher = economyOverview(state, 'p1', TEST_RULES)
      state.provinces[eigene]!.buildQueue = [
        {
          id: 'o1',
          building: 'barracks',
          level: 1,
          startedTick: 0,
          completesAtTick: 24,
          ownerAtStart: 'p1',
        },
      ]

      const nachher = economyOverview(state, 'p1', TEST_RULES)

      // Playtest 16b hat die Bilanz fuenfmal gegen den echten Tageszuwachs geprueft.
      // Eine Einmalzahlung darin waere genau dieser Nachweis, kaputtgemacht.
      expect(nachher.wood.balance).toBe(vorher.wood.balance)
      expect(nachher.wood.consumption).toBe(vorher.wood.consumption)
    })

    it('zaehlt den Auftrag eines Voreigentuemers nicht als eigenen', () => {
      const eigene = state.provinceOrder.find((id) => state.provinces[id]!.owner === 'p1')!
      state.provinces[eigene]!.buildQueue = [
        {
          id: 'o1',
          building: 'barracks',
          level: 1,
          startedTick: 0,
          completesAtTick: 24,
          ownerAtStart: 'p2',
        },
      ]

      const overview = economyOverview(state, 'p1', TEST_RULES)

      expect(overview.wood.committed).toBe(0)
    })
  })
})
