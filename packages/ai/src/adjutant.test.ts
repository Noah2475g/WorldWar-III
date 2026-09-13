import {
  HASH_OMIT_KEYS,
  createInitialState,
  publicView,
  type Army,
  type Command,
  type GameConfig,
  type GameState,
  type PlayerId,
  type PublicView,
} from '@worldwar/core'
import { hashValue } from '@worldwar/shared'
import { TEST_RULES, placeArmy, smallWorld } from '@worldwar/testkit'
import { describe, expect, it } from 'vitest'
import { adjutantCommands } from './adjutant'

/**
 * Der Adjutant (T-M40-03, D30.2–D30.5, R-UNIT-09).
 *
 * Die Haltung einer Armee eines Menschen ist ein Auftrag: „Verteidigung" rueckt in eine
 * angegriffene eigene Nachbarprovinz nach, ohne dass der Spieler klickt. Gerechnet auf der
 * Kleinen Welt: Nordland (p1, Mensch) besitzt n1, n2, n3; n2 grenzt ueber Land an n1
 * (90 km) und n3 (80 km), beide in den Wald — Infanterie braucht 19 und 17 Ticks.
 *
 * Die Lagen werden hier von Hand gestellt. Was der Adjutant ueber eine Partie bewirkt,
 * sagt erst der Messlauf (`apps/headless/test/stance.slow.test.ts`).
 */

const map = smallWorld()
const ctx = { map, rules: TEST_RULES }

const CONFIG: GameConfig = {
  seed: 40,
  mapId: 'testworld',
  rulesId: 'default',
  players: [
    { name: 'Nordland', kind: 'human', nation: 'Nordland', color: '#0f62bc' },
    { name: 'Ostmark', kind: 'ai', nation: 'Ostmark', color: '#b03a2e', difficulty: 'normal' },
    { name: 'Sueden', kind: 'ai', nation: 'Sueden', color: '#2e7d32', difficulty: 'normal' },
  ],
  victory: { condition: 'points', pointsShareToWin: 900, dayLimit: null },
}

const infanterie = (hpTotal = 5_000) => [{ unitKey: 'infantry', hpTotal }]

/** Nordland im Krieg mit Ostmark, und eine Ostmark-Armee steht in n2. */
function angriffAufN2(): { state: GameState; feind: Army } {
  const state = createInitialState(CONFIG, ctx)
  state.diplomacy.relations['p1|p2']!.state = 'war'
  const feind = placeArmy(state, { owner: 'p2', at: 'n2', units: infanterie(8_000) })
  return { state, feind }
}

const zug = (armyId: string, targetProvinceId: string, playerId: PlayerId = 'p1'): Command => ({
  type: 'MOVE_ARMY',
  playerId,
  armyId,
  targetProvinceId,
})

const LUFT = Object.entries(TEST_RULES.units).find(([, unit]) => unit.class === 'air')![0]

describe('R-UNIT-09/AK1 Die Verteidigung deckt die angegriffene Nachbarprovinz', () => {
  it('schickt genau eine Armee — die mit der fruehesten Ankunft', () => {
    const { state } = angriffAufN2()
    placeArmy(state, { owner: 'p1', at: 'n1', units: infanterie(), stance: 'defensive' })
    const ausN3 = placeArmy(state, { owner: 'p1', at: 'n3', units: infanterie(), stance: 'defensive' })

    // n3 -> n2 kommt nach 17 Ticks an, n1 -> n2 nach 19: die kleinere Kennung verliert.
    expect(adjutantCommands(state, ctx)).toEqual([zug(ausN3.id, 'n2')])
  })

  it('nimmt bei gleicher Ankunft die kleinste Kennung', () => {
    const { state } = angriffAufN2()
    const erste = placeArmy(state, { owner: 'p1', at: 'n1', units: infanterie(), stance: 'defensive' })
    placeArmy(state, { owner: 'p1', at: 'n1', units: infanterie(), stance: 'defensive' })

    expect(adjutantCommands(state, ctx)).toEqual([zug(erste.id, 'n2')])
  })

  it('laesst jede Armee stehen, die nicht in Frage kommt', () => {
    const faelle: [string, (state: GameState, army: Army) => void][] = [
      ['Garnison', (_, army) => (army.stance = 'garrison')],
      ['Angriff', (_, army) => (army.stance = 'aggressive')],
      ['Rueckzug', (_, army) => (army.stance = 'retreat')],
      ['unterwegs', (state, army) => {
        army.path = ['n1']
        army.departureTick = state.tick
        army.arrivalTick = state.tick + 20
      }],
      ['eingeschifft', (_, army) => (army.embarked = true)],
      ['unter Angriffssperre', (state, army) => (army.cannotAttackUntil = state.tick + 10)],
      ['selbst im Gefecht', (state) => void placeArmy(state, { owner: 'p2', at: 'n3', units: infanterie() })],
      ['nur Flugzeuge', (_, army) => (army.units = [{ unitKey: LUFT, hpTotal: 5_000 }])],
      ['ohne Einheiten', (_, army) => (army.units = [])],
    ]

    for (const [name, verderben] of faelle) {
      const { state } = angriffAufN2()
      const armee = placeArmy(state, { owner: 'p1', at: 'n3', units: infanterie(), stance: 'defensive' })
      verderben(state, armee)
      expect(adjutantCommands(state, ctx), name).toEqual([])
    }
  })

  it('schickt keine zweite Armee, wenn schon eine eigene dorthin unterwegs ist', () => {
    const { state } = angriffAufN2()
    const unterwegs = placeArmy(state, { owner: 'p1', at: 'n1', units: infanterie(), stance: 'garrison' })
    unterwegs.path = ['n2']
    unterwegs.departureTick = state.tick
    unterwegs.arrivalTick = state.tick + 19
    placeArmy(state, { owner: 'p1', at: 'n3', units: infanterie(), stance: 'defensive' })

    expect(adjutantCommands(state, ctx)).toEqual([])
  })

  it('deckt ueber Land, nicht ueber See', () => {
    // n1 und i1 verbindet nur ein Seeweg (D30.4: `neighbors`, nicht `seaLinks`).
    const state = createInitialState(CONFIG, ctx)
    state.diplomacy.relations['p1|p2']!.state = 'war'
    state.provinces['i1']!.owner = 'p1'
    placeArmy(state, { owner: 'p2', at: 'i1', units: infanterie(8_000) })
    placeArmy(state, { owner: 'p1', at: 'n1', units: infanterie(), stance: 'defensive' })

    expect(adjutantCommands(state, ctx)).toEqual([])
  })

  it('befiehlt nichts im Frieden, nichts fuer eine KI-Macht und nichts fuer eine ausgeschiedene', () => {
    const lagen: [string, (state: GameState) => void][] = [
      ['Frieden', (state) => (state.diplomacy.relations['p1|p2']!.state = 'peace')],
      ['KI-Macht', (state) => (state.players['p1']!.kind = 'ai')],
      ['ausgeschieden', (state) => (state.players['p1']!.alive = false)],
    ]
    for (const [name, aendern] of lagen) {
      const { state } = angriffAufN2()
      placeArmy(state, { owner: 'p1', at: 'n3', units: infanterie(), stance: 'defensive' })
      aendern(state)
      expect(adjutantCommands(state, ctx), name).toEqual([])
    }
  })

  it('deckt fuer eine KI-Macht auch dann nicht, wenn ihre Armee auf Verteidigung steht (D30.2)', () => {
    // Jede KI-Armee steht nach Aushebung und Rueckzug auf `defensive`. Wuerde der Adjutant sie
    // fuehren, verschoben sich Turnier, Parameterlauf und AK-1.
    const state = createInitialState(CONFIG, ctx)
    state.diplomacy.relations['p1|p2']!.state = 'war'
    placeArmy(state, { owner: 'p1', at: 'o2', units: infanterie(8_000) })
    placeArmy(state, { owner: 'p2', at: 'o1', units: infanterie(), stance: 'defensive' })

    expect(adjutantCommands(state, ctx)).toEqual([])
  })
})

describe('R-UNIT-09/AK4 Der Adjutant entscheidet aus dem Zustand, in der Sicht des Besitzers', () => {
  it('liest fremde Armeen nur aus der Sicht — was sie nicht zeigt, wird nicht gedeckt (R-DIP-04)', () => {
    // Im Spiel kann der Nebel eine Armee in einer eigenen Provinz nie verbergen: eigene
    // Provinzen sind immer sichtbar. Geprueft wird deshalb die Quelle der Entscheidung — eine
    // Sicht ohne die feindliche Armee, bei unveraendertem Zustand.
    const { state, feind } = angriffAufN2()
    placeArmy(state, { owner: 'p1', at: 'n3', units: infanterie(), stance: 'defensive' })
    const ohneFeind = (lage: GameState, playerId: PlayerId): PublicView => {
      const view = publicView(lage, playerId)
      return { ...view, armies: view.armies.filter((army) => army.id !== feind.id) }
    }

    expect(adjutantCommands(state, ctx, { viewOf: ohneFeind })).toEqual([])
    // Die Gegenprobe: mit der echten Sicht wird gedeckt.
    expect(adjutantCommands(state, ctx, { viewOf: publicView })).toHaveLength(1)
  })

  it('berechnet keine Sicht ohne Krieg oder ohne Armee mit selbsttaetiger Haltung (D30.3)', () => {
    const lagen: [string, (state: GameState) => void, number][] = [
      ['Frieden', (state) => (state.diplomacy.relations['p1|p2']!.state = 'peace'), 0],
      ['nur Garnison', (state) => {
        for (const id of state.armyOrder) if (state.armies[id]!.owner === 'p1') state.armies[id]!.stance = 'garrison'
      }, 0],
      ['Krieg und Verteidigung', () => undefined, 1],
    ]
    for (const [name, aendern, erwartet] of lagen) {
      const { state } = angriffAufN2()
      placeArmy(state, { owner: 'p1', at: 'n3', units: infanterie(), stance: 'defensive' })
      aendern(state)
      let sichten = 0
      const viewOf = (lage: GameState, playerId: PlayerId): PublicView => {
        sichten += 1
        return publicView(lage, playerId)
      }
      adjutantCommands(state, ctx, { viewOf })
      expect(sichten, name).toBe(erwartet)
    }
  })

  it('laesst eine Armee aus, fuer die der Mensch im selben Tick befiehlt (D30.2)', () => {
    const { state } = angriffAufN2()
    const ausN1 = placeArmy(state, { owner: 'p1', at: 'n1', units: infanterie(), stance: 'defensive' })
    const ausN3 = placeArmy(state, { owner: 'p1', at: 'n3', units: infanterie(), stance: 'defensive' })

    const befehle = adjutantCommands(state, ctx, { heldArmies: new Set([ausN3.id]) })
    expect(befehle.some((command) => 'armyId' in command && command.armyId === ausN3.id)).toBe(false)
    expect(befehle).toEqual([zug(ausN1.id, 'n2')])
  })

  it('laesst den Zustand unberuehrt', () => {
    const { state } = angriffAufN2()
    placeArmy(state, { owner: 'p1', at: 'n3', units: infanterie(), stance: 'defensive' })
    const vorher = hashValue(state, { omitKeys: HASH_OMIT_KEYS })

    expect(adjutantCommands(state, ctx)).toHaveLength(1)
    expect(hashValue(state, { omitKeys: HASH_OMIT_KEYS })).toBe(vorher)
  })
})

describe('Mehrspieler: die Befehle des Adjutanten entstehen in playerOrder-Reihenfolge', () => {
  it('ordnet nach Spielerreihenfolge, nicht nach Aufstellung oder Einfuegereihenfolge', () => {
    // Im Gleichschritt (D28.5) rechnen beide Rechner den Adjutanten selbst; dieselbe Lage muss
    // dieselbe Liste in derselben Reihenfolge geben, auch wenn ein Record anders gewachsen ist.
    const bau = (umgekehrt: boolean) => {
      const { state } = angriffAufN2()
      state.players['p3']!.kind = 'human'
      state.diplomacy.relations['p2|p3']!.state = 'war'
      placeArmy(state, { owner: 'p2', at: 's2', units: infanterie(8_000) })
      // Sueden zuerst aufgestellt, also mit der kleineren Kennung.
      const sued = placeArmy(state, { owner: 'p3', at: 's1', units: infanterie(), stance: 'defensive' })
      const nord = placeArmy(state, { owner: 'p1', at: 'n3', units: infanterie(), stance: 'defensive' })
      if (umgekehrt) state.armies = Object.fromEntries(Object.entries(state.armies).reverse())
      return { state, sued, nord }
    }

    const vorwaerts = bau(false)
    const befehle = adjutantCommands(vorwaerts.state, ctx)
    expect(befehle).toEqual([zug(vorwaerts.nord.id, 'n2'), zug(vorwaerts.sued.id, 's2', 'p3')])
    expect(adjutantCommands(bau(true).state, ctx)).toEqual(befehle)
  })
})

/**
 * Der Angriff verfolgt den weichenden Gegner (T-M40-04, D30.4, R-UNIT-09/AK2).
 *
 * Nordland haelt n2; eine Ostmark-Armee ist nach m1 zurueckgewichen (neutral, ueber Land an
 * n2, 160 km). „Eben zurueckgewichen" heisst: ihre Angriffssperre laeuft — und das zeigt die
 * Sicht seit T-M40-04 fuer jede sichtbare fremde Armee (`retreating`).
 */
describe('R-UNIT-09/AK2 Der Angriff verfolgt den weichenden Gegner', () => {
  function rueckzugNachM1(staerke: number): { state: GameState; weichend: Army } {
    const state = createInitialState(CONFIG, ctx)
    state.diplomacy.relations['p1|p2']!.state = 'war'
    state.tick = 100
    const weichend = placeArmy(state, { owner: 'p2', at: 'm1', units: infanterie(staerke) })
    weichend.cannotAttackUntil = state.tick + 20
    return { state, weichend }
  }

  it('folgt einem gleich starken Weichenden', () => {
    const { state } = rueckzugNachM1(5_000)
    const jaeger = placeArmy(state, { owner: 'p1', at: 'n2', units: infanterie(5_000), stance: 'aggressive' })

    expect(adjutantCommands(state, ctx)).toEqual([zug(jaeger.id, 'm1')])
  })

  it('folgt einem staerkeren nicht', () => {
    const { state } = rueckzugNachM1(5_001)
    placeArmy(state, { owner: 'p1', at: 'n2', units: infanterie(5_000), stance: 'aggressive' })

    expect(adjutantCommands(state, ctx)).toEqual([])
  })

  it('folgt keinem, dessen Angriffssperre abgelaufen ist', () => {
    const { state, weichend } = rueckzugNachM1(5_000)
    weichend.cannotAttackUntil = state.tick
    placeArmy(state, { owner: 'p1', at: 'n2', units: infanterie(5_000), stance: 'aggressive' })

    expect(adjutantCommands(state, ctx)).toEqual([])
  })

  it('folgt keinem, den die Sicht nicht zeigt (R-DIP-04)', () => {
    // Wie bei der Verteidigung: m1 grenzt an eine eigene Provinz und ist im Spiel immer
    // sichtbar. Geprueft wird die Quelle — eine Sicht ohne den Weichenden, Zustand unveraendert.
    const { state, weichend } = rueckzugNachM1(5_000)
    placeArmy(state, { owner: 'p1', at: 'n2', units: infanterie(5_000), stance: 'aggressive' })
    const imNebel = (lage: GameState, playerId: PlayerId): PublicView => {
      const view = publicView(lage, playerId)
      return { ...view, armies: view.armies.filter((army) => army.id !== weichend.id) }
    }

    expect(adjutantCommands(state, ctx, { viewOf: imNebel })).toEqual([])
    expect(adjutantCommands(state, ctx, { viewOf: publicView })).toHaveLength(1)
  })

  it('misst an allem, was dort sichtbar steht, nicht nur am Weichenden', () => {
    // Ein schwacher Weichender neben einem frischen Verband ist kein Ziel: zusammen sind sie
    // staerker als die Verfolgerin, und dort kaempft sie gegen beide.
    const { state } = rueckzugNachM1(2_000)
    placeArmy(state, { owner: 'p2', at: 'm1', units: infanterie(4_000) })
    placeArmy(state, { owner: 'p1', at: 'n2', units: infanterie(5_000), stance: 'aggressive' })

    expect(adjutantCommands(state, ctx)).toEqual([])
  })

  it('schickt je Provinz hoechstens eine Verfolgerin, bei gleicher Ankunft die kleinste Kennung', () => {
    const { state } = rueckzugNachM1(5_000)
    const erste = placeArmy(state, { owner: 'p1', at: 'n2', units: infanterie(5_000), stance: 'aggressive' })
    placeArmy(state, { owner: 'p1', at: 'n2', units: infanterie(5_000), stance: 'aggressive' })

    expect(adjutantCommands(state, ctx)).toEqual([zug(erste.id, 'm1')])
  })

  it('schickt keine zweite, wenn schon eine eigene Armee dorthin unterwegs ist', () => {
    const { state } = rueckzugNachM1(5_000)
    const unterwegs = placeArmy(state, { owner: 'p1', at: 'n2', units: infanterie(5_000), stance: 'aggressive' })
    unterwegs.path = ['m1']
    unterwegs.departureTick = state.tick
    unterwegs.arrivalTick = state.tick + 40
    placeArmy(state, { owner: 'p1', at: 'n2', units: infanterie(5_000), stance: 'aggressive' })

    expect(adjutantCommands(state, ctx)).toEqual([])
  })

  it('verfolgt nicht aus Verteidigung, Garnison oder Rueckzug, und nicht aus einer umkaempften Provinz', () => {
    for (const stance of ['defensive', 'garrison', 'retreat'] as const) {
      const { state } = rueckzugNachM1(5_000)
      placeArmy(state, { owner: 'p1', at: 'n2', units: infanterie(5_000), stance })
      expect(adjutantCommands(state, ctx), stance).toEqual([])
    }

    const { state } = rueckzugNachM1(5_000)
    placeArmy(state, { owner: 'p1', at: 'n2', units: infanterie(5_000), stance: 'aggressive' })
    placeArmy(state, { owner: 'p2', at: 'n2', units: infanterie(1_000) })
    expect(adjutantCommands(state, ctx), 'umkaempft').toEqual([])
  })
})
