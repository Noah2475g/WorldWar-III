import {
  HASH_OMIT_KEYS,
  createInitialState,
  planRoute,
  publicView,
  type Army,
  type Command,
  type GameConfig,
  type GameState,
  type MapData,
  type PlayerId,
  type PublicView,
} from '@worldwar/core'
import { hashValue } from '@worldwar/shared'
import { TEST_RULES, placeArmy, smallWorld } from '@worldwar/testkit'
import { describe, expect, it } from 'vitest'
import { adjutantCommands } from './adjutant'

/**
 * Der Adjutant (T-M40-03, D30.2–D30.5, R-UNIT-09; seit T-M40-10 die Regel aus D30.4).
 *
 * Die Haltung einer Armee eines Menschen ist ein Auftrag: „Verteidigung" rueckt in eine
 * bedrohte eigene Nachbarprovinz nach, ohne dass der Spieler klickt — seit T-M40-10 aber nur,
 * wenn in ihrer Provinz eine weitere eigene Armee stehen bleibt. Die erste Fassung deckte aus
 * jeder Provinz und entbloesste dabei, was sie verlassen hatte (Befund H3, D30.9). Gerechnet auf
 * der Kleinen Welt: Nordland (p1, Mensch) besitzt n1, n2, n3; n2 grenzt ueber Land an n1
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

/**
 * Mitten in der Partie. Aufgestellte Armeen tragen `deployDelayUntil` 0, und seit T-M40-09 ruht
 * die Automatik nach einem Marsch oder Rueckzug fuenf Spieltage — bei Tick 0 handelte sie also
 * noch gar nicht, und jede Lage hier waere leer gruen.
 */
const MITTEN = 200
/** Fuenf Spieltage Ruhe nach Marsch oder Rueckzug (T-M40-09, D30.4). */
const RUHE = 120

const infanterie = (hpTotal = 5_000) => [{ unitKey: 'infantry', hpTotal }]

/**
 * Eine Garnison: sie bleibt stehen, was auch geschieht. Seit T-M40-10 rueckt eine Verteidigung nur
 * aus, wenn in ihrer Provinz eine Armee stehen bleibt — die Lagen stellen sie ihr deshalb daneben,
 * sonst waere jede „nichts befohlen"-Zusicherung schon wegen der neuen Regel gruen.
 */
const garnison = (state: GameState, at: string, owner: PlayerId = 'p1'): Army =>
  placeArmy(state, { owner, at, units: infanterie(), stance: 'garrison' })

/** Nordland im Krieg mit Ostmark, und eine Ostmark-Armee steht in n2. */
function angriffAufN2(): { state: GameState; feind: Army } {
  const state = createInitialState(CONFIG, ctx)
  state.tick = MITTEN
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

describe('R-UNIT-09/AK1 Die Verteidigung rueckt nach, ohne zu entbloessen', () => {
  it('schickt genau eine Armee — die mit der fruehesten Ankunft', () => {
    const { state } = angriffAufN2()
    placeArmy(state, { owner: 'p1', at: 'n1', units: infanterie(), stance: 'defensive' })
    garnison(state, 'n1')
    const ausN3 = placeArmy(state, { owner: 'p1', at: 'n3', units: infanterie(), stance: 'defensive' })
    garnison(state, 'n3')

    // n3 -> n2 kommt nach 17 Ticks an, n1 -> n2 nach 19: die kleinere Kennung verliert.
    expect(adjutantCommands(state, ctx)).toEqual([zug(ausN3.id, 'n2')])
  })

  it('nimmt bei gleicher Ankunft die kleinste Kennung — und die andere bleibt stehen', () => {
    const { state } = angriffAufN2()
    const erste = placeArmy(state, { owner: 'p1', at: 'n1', units: infanterie(), stance: 'defensive' })
    placeArmy(state, { owner: 'p1', at: 'n1', units: infanterie(), stance: 'defensive' })

    expect(adjutantCommands(state, ctx)).toEqual([zug(erste.id, 'n2')])
  })

  it('laesst eine Armee, die allein in ihrer Provinz steht, nie von selbst marschieren (T-M40-10)', () => {
    // Genau so entbloesste die Deckung aus M40 zwei von drei verlorenen Provinzen (Befund H3).
    const { state } = angriffAufN2()
    placeArmy(state, { owner: 'p1', at: 'n3', units: infanterie(), stance: 'defensive' })

    expect(adjutantCommands(state, ctx)).toEqual([])

    // Gegenprobe: mit einer Garnison daneben rueckt sie aus.
    garnison(state, 'n3')
    expect(adjutantCommands(state, ctx)).toHaveLength(1)
  })

  it('schickt nie beide Armeen einer Provinz fort, auch nicht in zwei verschiedene Ziele (T-M40-10)', () => {
    // n2 und n3 sind angegriffen, beide grenzen an n1; in n1 stehen zwei Verteidiger. Die erste Regel
    // schickte jeden in eine Provinz und liess n1 leer.
    const { state } = angriffAufN2()
    placeArmy(state, { owner: 'p2', at: 'n3', units: infanterie(8_000) })
    const erste = placeArmy(state, { owner: 'p1', at: 'n1', units: infanterie(), stance: 'defensive' })
    placeArmy(state, { owner: 'p1', at: 'n1', units: infanterie(), stance: 'defensive' })

    expect(adjutantCommands(state, ctx)).toEqual([zug(erste.id, 'n2')])
  })

  it('rueckt vorbeugend in eine leere eigene Provinz, die an einen sichtbaren Kriegsgegner grenzt (T-M40-10)', () => {
    // Die Ostmark-Armee steht in m1, neben dem leeren n2. Die erste Regel sah nur Feinde in eigenen
    // Provinzen — und die sind im Einmarschtick schon fremd (occupation laeuft nach movement).
    const state = createInitialState(CONFIG, ctx)
    state.tick = MITTEN
    state.diplomacy.relations['p1|p2']!.state = 'war'
    placeArmy(state, { owner: 'p2', at: 'm1', units: infanterie(8_000) })
    const ausN3 = placeArmy(state, { owner: 'p1', at: 'n3', units: infanterie(), stance: 'defensive' })
    garnison(state, 'n3')
    garnison(state, 'n1')

    expect(adjutantCommands(state, ctx)).toEqual([zug(ausN3.id, 'n2')])
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
      ['kurz nach einem Marsch', (state, army) => (army.deployDelayUntil = state.tick - RUHE + 1)],
      ['selbst im Gefecht', (state) => void placeArmy(state, { owner: 'p2', at: 'n3', units: infanterie() })],
      ['nur Flugzeuge', (_, army) => (army.units = [{ unitKey: LUFT, hpTotal: 5_000 }])],
      ['ohne Einheiten', (_, army) => (army.units = [])],
    ]

    for (const [name, verderben] of faelle) {
      const { state } = angriffAufN2()
      const armee = placeArmy(state, { owner: 'p1', at: 'n3', units: infanterie(), stance: 'defensive' })
      garnison(state, 'n3')
      garnison(state, 'n1')
      verderben(state, armee)
      expect(adjutantCommands(state, ctx), name).toEqual([])
    }
  })

  it('schickt keine zweite Armee, wenn schon eine eigene dorthin unterwegs ist', () => {
    const { state } = angriffAufN2()
    const unterwegs = garnison(state, 'n1')
    unterwegs.path = ['n2']
    unterwegs.departureTick = state.tick
    unterwegs.arrivalTick = state.tick + 19
    placeArmy(state, { owner: 'p1', at: 'n3', units: infanterie(), stance: 'defensive' })
    garnison(state, 'n3')

    expect(adjutantCommands(state, ctx)).toEqual([])
  })

  it('deckt ueber Land, nicht ueber See', () => {
    // n1 und i1 verbindet nur ein Seeweg (D30.4: `neighbors`, nicht `seaLinks`).
    const state = createInitialState(CONFIG, ctx)
    state.tick = MITTEN
    state.diplomacy.relations['p1|p2']!.state = 'war'
    state.provinces['i1']!.owner = 'p1'
    placeArmy(state, { owner: 'p2', at: 'i1', units: infanterie(8_000) })
    placeArmy(state, { owner: 'p1', at: 'n1', units: infanterie(), stance: 'defensive' })
    garnison(state, 'n1')

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
      garnison(state, 'n3')
      aendern(state)
      expect(adjutantCommands(state, ctx), name).toEqual([])
    }
  })

  it('deckt fuer eine KI-Macht auch dann nicht, wenn ihre Armeen auf Verteidigung stehen (D30.2)', () => {
    // Jede KI-Armee steht nach Aushebung und Rueckzug auf `defensive`. Wuerde der Adjutant sie
    // fuehren, verschoben sich Turnier, Parameterlauf und AK-1.
    const state = createInitialState(CONFIG, ctx)
    state.tick = MITTEN
    state.diplomacy.relations['p1|p2']!.state = 'war'
    placeArmy(state, { owner: 'p1', at: 'o2', units: infanterie(8_000) })
    placeArmy(state, { owner: 'p2', at: 'o1', units: infanterie(), stance: 'defensive' })
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
    garnison(state, 'n3')
    const ohneFeind = (lage: GameState, playerId: PlayerId): PublicView => {
      const view = publicView(lage, playerId)
      return { ...view, armies: view.armies.filter((army) => army.id !== feind.id) }
    }

    expect(adjutantCommands(state, ctx, { viewOf: ohneFeind })).toEqual([])
    // Die Gegenprobe: mit der echten Sicht wird gedeckt.
    expect(adjutantCommands(state, ctx, { viewOf: publicView })).toHaveLength(1)
  })

  it('berechnet keine Sicht ohne Krieg, ohne bereite Verteidigung oder fuer eine Verteidigung, die allein steht (D30.3)', () => {
    const lagen: [string, (state: GameState) => void, number][] = [
      ['Frieden', (state) => (state.diplomacy.relations['p1|p2']!.state = 'peace'), 0],
      ['nur Garnison', (state) => {
        for (const id of state.armyOrder) if (state.armies[id]!.owner === 'p1') state.armies[id]!.stance = 'garrison'
      }, 0],
      // Seit T-M40-10 kann eine allein stehende Verteidigung nichts befehlen: keine Sicht (D30.9).
      ['Verteidigung allein', (state) => {
        for (const id of state.armyOrder) {
          if (state.armies[id]!.owner === 'p1' && state.armies[id]!.stance === 'garrison') delete state.armies[id]
        }
        state.armyOrder = state.armyOrder.filter((id) => state.armies[id])
      }, 0],
      ['Krieg und Verteidigung neben einer Garnison', () => undefined, 1],
    ]
    for (const [name, aendern, erwartet] of lagen) {
      const { state } = angriffAufN2()
      placeArmy(state, { owner: 'p1', at: 'n3', units: infanterie(), stance: 'defensive' })
      garnison(state, 'n3')
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
    garnison(state, 'n1')
    const ausN3 = placeArmy(state, { owner: 'p1', at: 'n3', units: infanterie(), stance: 'defensive' })
    garnison(state, 'n3')

    // Seit T-M40-08 bekommt der Adjutant die Befehle des Ticks selbst, nicht nur eine Menge von Armeen.
    const befehle = adjutantCommands(state, ctx, { given: [{ type: 'STOP_ARMY', playerId: 'p1', armyId: ausN3.id }] })
    expect(befehle.some((command) => 'armyId' in command && command.armyId === ausN3.id)).toBe(false)
    expect(befehle).toEqual([zug(ausN1.id, 'n2')])
  })

  it('zaehlt einen Marschbefehl des Menschen im selben Tick als unterwegs (T-M40-08, Befund M1)', () => {
    // Beleg S3 der Durchsicht: der Spieler schickt eine Garnison nach n2, und der Adjutant schickt im
    // selben Tick eine zweite Armee hinterher — `heading` las nur die Wege im Zustand vor den Befehlen.
    const lage = () => {
      const { state } = angriffAufN2()
      const marschiert = garnison(state, 'n1')
      // Zwei Verteidiger in n3: auch eine Regel, die eine Armee stehen laesst, haette hier eine frei.
      placeArmy(state, { owner: 'p1', at: 'n3', units: infanterie(), stance: 'defensive' })
      placeArmy(state, { owner: 'p1', at: 'n3', units: infanterie(), stance: 'defensive' })
      return { state, marschiert }
    }

    // Gegenprobe: ohne den Spielerbefehl rueckt eine Armee nach n2 nach.
    const ohne = lage()
    expect(adjutantCommands(ohne.state, ctx).filter((command) => command.type === 'MOVE_ARMY')).toHaveLength(1)

    const mit = lage()
    expect(adjutantCommands(mit.state, ctx, { given: [zug(mit.marschiert.id, 'n2')] })).toEqual([])
  })

  it('laesst den Zustand unberuehrt', () => {
    const { state } = angriffAufN2()
    placeArmy(state, { owner: 'p1', at: 'n3', units: infanterie(), stance: 'defensive' })
    garnison(state, 'n3')
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
      garnison(state, 's1', 'p3')
      const nord = placeArmy(state, { owner: 'p1', at: 'n3', units: infanterie(), stance: 'defensive' })
      garnison(state, 'n3')
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
 * Der Angriff marschiert nie von selbst (T-M40-10, D30.4, R-UNIT-09/AK2).
 *
 * T-M40-04 liess eine Armee auf „Angriff" einem weichenden Gegner folgen, der nicht staerker war. Im
 * Messlauf des Entwurfs schadete das in jedem Lauf mit Anlass — 1914 wurden vier Armeen binnen zehn
 * Tagen nach einem solchen Befehl vernichtet — und es brauchte ein Sichtfeld ohne sichtbare Quelle
 * (Befund M2). Die Haltung wirkt seitdem nur im Kampf: keine eingegrabene Verteidigung, dafuer die
 * Angriffswerte (`phases/combat.ts`, dort geprueft).
 */
describe('R-UNIT-09/AK2 Der Angriff marschiert nie von selbst', () => {
  it('folgt keinem weichenden Gegner und rueckt nirgends nach — auch wenn eine Armee daneben stehen bleibt', () => {
    const state = createInitialState(CONFIG, ctx)
    state.tick = MITTEN
    state.diplomacy.relations['p1|p2']!.state = 'war'
    state.provinces['m1']!.owner = 'p2'
    // In m1 weicht ein schwacher Gegner zurueck (seine Angriffssperre laeuft); n3 ist angegriffen.
    const weichend = placeArmy(state, { owner: 'p2', at: 'm1', units: infanterie(1_000) })
    weichend.cannotAttackUntil = state.tick + 20
    placeArmy(state, { owner: 'p2', at: 'n3', units: infanterie(1_000) })
    for (const at of ['n2', 'n2', 'n1', 'n1']) placeArmy(state, { owner: 'p1', at, units: infanterie(5_000), stance: 'aggressive' })

    expect(adjutantCommands(state, ctx)).toEqual([])

    // Gegenprobe: dieselben Armeen auf Verteidigung ruecken nach.
    for (const id of state.armyOrder) if (state.armies[id]!.owner === 'p1') state.armies[id]!.stance = 'defensive'
    expect(adjutantCommands(state, ctx).length).toBeGreaterThan(0)
  })
})

/**
 * Kein fremder Boden, keine Rueckkehr in die Schlacht (T-M40-09, Befunde K2 und H1 der Durchsicht
 * von M40, R-UNIT-09/AK7).
 *
 * Die Automatik gab Befehle, die der Kern annimmt und die trotzdem schaden. Eine Armee in der
 * Provinz einer Macht, mit der Frieden herrscht, ist ein Ueberfall — `detectSurpriseAttacks` erklaert
 * im selben Tick Krieg ohne Erklaerung, auch auf dem Durchmarsch; `MOVE_ARMY` prueft den Besitz nicht,
 * und `planRoute` nimmt den billigsten Weg, wem immer er gehoert. Und eine Armee, die sich eben
 * zurueckgezogen hatte, kehrte bei Sperrende in dieselbe Schlacht zurueck (Beleg S4c: Tick 24). Seit
 * T-M40-10 zielt die Automatik nur noch auf eigene Provinzen; die Route bleibt die Stelle, an der
 * fremder Boden hereinkommt.
 */
describe('R-UNIT-09/AK7 Die Automatik marschiert nur auf eigenes Land, in einer Etappe, und ruht nach Marsch und Rueckzug', () => {
  it('schickt nie eine Armee in eine fremde oder neutrale Provinz, auch wenn dort ein Kriegsgegner steht (Beleg S5)', () => {
    for (const besitzer of [null, 'p2', 'p3'] as const) {
      const state = createInitialState(CONFIG, ctx)
      state.tick = MITTEN
      state.diplomacy.relations['p1|p2']!.state = 'war'
      state.provinces['m1']!.owner = besitzer
      const weichend = placeArmy(state, { owner: 'p2', at: 'm1', units: infanterie(1_000) })
      weichend.cannotAttackUntil = state.tick + 20
      for (const stance of ['defensive', 'defensive', 'aggressive', 'aggressive'] as const) {
        placeArmy(state, { owner: 'p1', at: 'n2', units: infanterie(), stance })
      }

      const befehle = adjutantCommands(state, ctx)
      expect(
        befehle.filter((command) => command.type === 'MOVE_ARMY' && state.provinces[command.targetProvinceId]!.owner !== 'p1'),
        String(besitzer),
      ).toEqual([])
    }
  })

  /** Die Kleine Welt, in der der billigste Weg von n3 nach n2 ueber m2 und m1 fuehrt. */
  function umwegKarte(): MapData {
    const karte = smallWorld()
    for (const kante of karte.edges) {
      const enden = [kante.a, kante.b].sort().join('-')
      if (enden === 'n1-n2' || enden === 'n2-n3') kante.distanceKm = 2_000_000
    }
    return karte
  }

  /** n2 angegriffen und von einer Garnison gehalten, Verteidigung und Garnison in n3; m1 gehoert Sueden. */
  function angriffMitUmweg(karte: MapData) {
    const { state } = angriffAufN2()
    state.provinces['m1']!.owner = 'p3'
    placeArmy(state, { owner: 'p1', at: 'n2', units: infanterie(30_000), stance: 'garrison' })
    const ausN3 = placeArmy(state, { owner: 'p1', at: 'n3', units: infanterie(), stance: 'defensive' })
    garnison(state, 'n3')
    // Eine Garnison in n1, damit n1 nicht als leere bedrohte Provinz ein zweites Ziel wird.
    garnison(state, 'n1')
    return { state, ausN3, ctx: { map: karte, rules: TEST_RULES } }
  }

  it('verwirft eine Route mit mehr als einer Etappe — sonst fuehrte die Deckung ueber fremdes Land', () => {
    const umweg = angriffMitUmweg(umwegKarte())
    // Vorbedingung: der billigste Weg fuehrt wirklich durch m2 und die Provinz der Friedensmacht.
    expect(planRoute(umweg.state, umweg.ausN3, 'n2', umweg.ctx.map, TEST_RULES)!.path).toEqual(['m2', 'm1', 'n2'])

    expect(adjutantCommands(umweg.state, umweg.ctx)).toEqual([])

    // Gegenprobe auf der unveraenderten Karte: dieselbe Lage deckt n2 in einer Etappe.
    const normal = angriffMitUmweg(smallWorld())
    expect(adjutantCommands(normal.state, normal.ctx)).toEqual([zug(normal.ausN3.id, 'n2')])
  })

  it('gibt in jeder Lage nur Befehle, deren Route genau die eine Etappe ins Ziel ist', () => {
    const angriffAusN1 = () => {
      const { state } = angriffAufN2()
      placeArmy(state, { owner: 'p1', at: 'n1', units: infanterie(), stance: 'defensive' })
      garnison(state, 'n1')
      return { state, ctx }
    }
    const vorbeugend = () => {
      const state = createInitialState(CONFIG, ctx)
      state.tick = MITTEN
      state.diplomacy.relations['p1|p2']!.state = 'war'
      placeArmy(state, { owner: 'p2', at: 'm1', units: infanterie(8_000) })
      placeArmy(state, { owner: 'p1', at: 'n3', units: infanterie(), stance: 'defensive' })
      garnison(state, 'n3')
      return { state, ctx }
    }
    const lagen = [angriffMitUmweg(umwegKarte()), angriffMitUmweg(smallWorld()), angriffAusN1(), vorbeugend()]

    let befehle = 0
    for (const lage of lagen) {
      for (const command of adjutantCommands(lage.state, lage.ctx)) {
        expect(command.type).toBe('MOVE_ARMY')
        if (command.type !== 'MOVE_ARMY') continue
        befehle += 1
        const army = lage.state.armies[command.armyId]!
        expect(planRoute(lage.state, army, command.targetProvinceId, lage.ctx.map, TEST_RULES)?.path, command.armyId).toEqual([
          command.targetProvinceId,
        ])
        expect(lage.state.provinces[command.targetProvinceId]!.owner, command.armyId).toBe('p1')
      }
    }
    expect(befehle, 'keine Lage erzeugte einen Befehl - die Eigenschaft misst nichts').toBeGreaterThan(0)
  })

  it('kehrt nach einem Rueckzug nicht vor Ablauf von fuenf Spieltagen in die Schlacht zurueck (Beleg S4c)', () => {
    const T = 1_000
    const constants = TEST_RULES.constants
    const lage = (tick: number) => {
      const { state } = angriffAufN2()
      placeArmy(state, { owner: 'p1', at: 'n2', units: infanterie(30_000), stance: 'garrison' })
      garnison(state, 'n1')
      const weicht = placeArmy(state, { owner: 'p1', at: 'n1', units: infanterie(), stance: 'defensive' })
      // So hinterlaesst `phases/retreat.ts` eine Armee: Verteidigung, doppelte Aufstellungsstrafe, Angriffssperre.
      weicht.deployDelayUntil = T + constants.deployDelayTicks * 2
      weicht.cannotAttackUntil = T + constants.retreatCooldownTicks
      state.tick = tick
      return { state, weicht }
    }
    const ruheEnde = T + constants.deployDelayTicks * 2 + RUHE

    const kurzVorher = lage(ruheEnde - 1)
    // Die Angriffssperre ist lange vorbei — bis T-M40-09 kehrte die Armee genau dann zurueck.
    expect(kurzVorher.state.tick).toBeGreaterThan(kurzVorher.weicht.cannotAttackUntil)
    expect(adjutantCommands(kurzVorher.state, ctx)).toEqual([])

    const danach = lage(ruheEnde)
    expect(adjutantCommands(danach.state, ctx)).toEqual([zug(danach.weicht.id, 'n2')])
  })
})
