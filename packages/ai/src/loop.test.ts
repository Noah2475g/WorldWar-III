import { TEST_RULES, placeArmy, smallWorld } from '@worldwar/testkit'
import {
  HASH_OMIT_KEYS,
  createInitialState,
  deserialise,
  planRoute,
  runTicks,
  serialise,
  type Command,
  type GameConfig,
  type GameState,
} from '@worldwar/core'
import { hashValue } from '@worldwar/shared'
import { describe, expect, it, vi } from 'vitest'
import { garrisonFollowUp } from './adjutant'
import { advanceTicks } from './loop'
import type * as MilitaryModule from './military'
import { runAi, storeMemories } from './runner'
import type { AiContext, Explanation } from './types'

/**
 * Das Kuerzen des KI-Gedaechtnisses, im Test abschaltbar (Nacharbeit T-M41-05, Durchsicht M2).
 *
 * `militaryCommands` kuerzt `memory.assignments` mit genau einer Zuweisung, bevor es das Feld
 * sonst anfasst. Die Huelle reicht der echten Funktion ein Gedaechtnis, das diese Zuweisung
 * verschluckt, wenn `kuerzen.aus` gesetzt ist — dann arbeitet sie wirklich mit den Eintraegen
 * toter Armeen. Ohne Schalter reicht sie alles unveraendert durch. Gezaehlt wird, wie viele
 * Eintraege toter Armeen die Funktion NACH der Kuerzungszeile noch sieht: nur diese Zahl sagt,
 * ob ein Lauf "ohne Kuerzen" gefahren ist.
 */
const kuerzen = vi.hoisted(() => ({ aus: false, verschluckt: 0, totBeimLesen: 0 }))

vi.mock('./military', async (importOriginal) => {
  const original = await importOriginal<typeof MilitaryModule>()
  return {
    ...original,
    militaryCommands: (context: AiContext, explanations: Explanation[]) => {
      const lebend = new Set(
        context.view.armies.filter((army) => army.owner === context.view.playerId).map((army) => army.id),
      )
      let nachKuerzung = false
      const memory = new Proxy(context.memory, {
        set(target, property, value, receiver) {
          if (property === 'assignments') {
            nachKuerzung = true
            if (kuerzen.aus) {
              kuerzen.verschluckt += 1
              return true
            }
          }
          return Reflect.set(target, property, value, receiver)
        },
        get(target, property, receiver) {
          const value: unknown = Reflect.get(target, property, receiver)
          if (property === 'assignments' && nachKuerzung) {
            kuerzen.totBeimLesen += Object.keys(value as Record<string, string>).filter((id) => !lebend.has(id)).length
          }
          return value
        },
      })
      return original.militaryCommands({ ...context, memory }, explanations)
    },
  }
})

/**
 * Die eine Spielschleife (T-M14-04).
 *
 * Vorher gab es vier Fassungen, und sie beschrieben verschiedene Spiele: die Tagesfassung
 * des Parameterlaufs fragte die KI einmal je Spieltag und wandte dasselbe Befehlspaket auf
 * alle 24 Ticks an. Das ist nicht nur eine zweite Schleife — es schaltet die KI der
 * meisten Mächte ab, weil `shouldThinkThisTick` die Denkzeit über `tick % aiCount`
 * verteilt und `tick` dort immer ein Vielfaches von 24 ist.
 */

const map = smallWorld()

/** Derselbe Hash, den der Spielstand fuehrt: das Ereignisprotokoll zaehlt nicht mit. */
const stateHash = (state: GameState) => hashValue(state, { omitKeys: HASH_OMIT_KEYS })
const ctx = { map, rules: TEST_RULES }

function stateWith(aiCount: number, context: typeof ctx = ctx): GameState {
  const nations = map.startPositions.slice(0, aiCount).map((s) => s.nation)
  const config: GameConfig = {
    seed: 7,
    mapId: 'testworld',
    rulesId: 'default',
    players: nations.map((nation, i) => ({
      name: nation,
      kind: 'ai' as const,
      nation,
      color: ['#0f62bc', '#b03a2e', '#2e7d32', '#6a1b9a', '#ef6c00', '#00838f'][i]!,
      difficulty: 'normal' as const,
    })),
    victory: { condition: 'points', pointsShareToWin: 900, dayLimit: null },
  }
  const state = createInitialState(config, context)
  // Alle gegen alle: eine Welt im Frieden misst nichts.
  for (let i = 0; i < state.playerOrder.length; i++) {
    for (let j = i + 1; j < state.playerOrder.length; j++) {
      const key = `${state.playerOrder[i]}|${state.playerOrder[j]}`
      if (state.diplomacy.relations[key]) state.diplomacy.relations[key]!.state = 'war'
    }
  }
  return state
}

describe('R-AI-01 Eine Spielschleife fuer alle', () => {
  it('laesst jede Macht handeln, nicht nur die erste', () => {
    // Die Tagesschleife des Parameterlaufs liess bei sechs Maechten nur eine denken.
    const state = stateWith(6)
    const ticksPerDay = TEST_RULES.constants.ticksPerDay
    const denker = new Set<string>()

    let current = state
    for (let tick = 0; tick < ticksPerDay; tick++) {
      const { commands } = runAi(current, ctx)
      for (const command of commands) denker.add(command.playerId)
      current = runTicks(current, 1, ctx, () => commands).state
    }
    expect(denker.size, `nur ${[...denker].join(', ')} haben gedacht`).toBeGreaterThan(1)
  })

  it('sammelt die Ereignisse aller Ticks, statt sie am Ende abzulesen', () => {
    // Voraussetzung fuer T-M14-05: das Ereignisprotokoll im Zustand ist ein Ringpuffer
    // (EVENT_LOG_LIMIT), wer daraus zaehlt, zaehlt zu wenig.
    const result = advanceTicks(stateWith(4), 600, ctx)
    expect(result.events.length).toBeGreaterThan(result.state.eventLog.length)
  })

  it('reicht die Spielerbefehle nur in den ersten Tick', () => {
    // Der erste Spieler ist hier ein Mensch: sonst baut die KI in seiner Provinz mit, und
    // der Test zählte ihre Bauten als Wiederholung seines Befehls.
    const state = stateWith(2)
    state.players[state.playerOrder[0]!]!.kind = 'human'
    const eigen = state.playerOrder[0]!
    const provinz = state.provinceOrder.find((id) => state.provinces[id]!.owner === eigen)!
    const befehl = {
      type: 'BUILD' as const,
      playerId: eigen,
      provinceId: provinz,
      building: 'barracks',
    } as const satisfies Command

    // Nur die Bauten in genau dieser Provinz zaehlen: die KI-Maechte bauen daneben ihre
    // eigenen, und die haben mit der Frage nichts zu tun.
    const result = advanceTicks(state, 5, ctx, { playerCommands: [befehl] })
    const begonnen = result.events.filter(
      (e) => e.type === 'BUILD_STARTED' && 'provinceId' in e && e.provinceId === provinz,
    )
    expect(begonnen.length, 'derselbe Spielerbefehl darf nicht in jedem Tick wirken').toBe(1)
  })

  it('haelt an, sobald jemand gewonnen hat', () => {
    const state = stateWith(2)
    const zweiter = state.playerOrder[1]!
    for (const id of state.provinceOrder) {
      if (state.provinces[id]!.owner === zweiter) state.provinces[id]!.owner = state.playerOrder[0]!
    }
    const result = advanceTicks(state, 500, ctx)
    expect(result.state.victory.winner).toBe(state.playerOrder[0])
    // Die Schleife laeuft nicht weiter, nachdem die Partie entschieden ist.
    expect(result.ticks).toBeLessThan(500)
  })

  it('liefert denselben Zustand wie die bisherige Schleife der Anwendung', () => {
    // Gleichstand: die neue gemeinsame Funktion ist genau das, was advance() tat.
    const alt = (() => {
      let current = stateWith(3)
      for (let i = 0; i < 40; i++) {
        if (current.victory.winner !== null) break
        const { commands, memories } = runAi(current, ctx)
        current = runTicks(current, 1, ctx, () => commands).state
        storeMemories(current, memories)
      }
      return current
    })()

    const neu = advanceTicks(stateWith(3), 40, ctx).state
    expect(stateHash(neu)).toBe(stateHash(alt))
  })

  it('setzt einen gespeicherten Stand mit KI bitgleich fort (R-AI-07/AK1)', () => {
    // Befund N2: das KI-Gedaechtnis ist Teil des Spielstands, aber keine Pruefung fuhr
    // je Speichern-Laden-Weiterspielen MIT Befehlsquelle. storeMemories schreibt
    // ausserhalb der Tick-Pipeline in den Zustand — genau dort kann etwas verloren gehen.
    const durchgehend = advanceTicks(stateWith(3), 50, ctx).state

    const haelfte = advanceTicks(stateWith(3), 25, ctx).state
    const geladen = deserialise(serialise(haelfte))
    const fortgesetzt = advanceTicks(geladen, 25, ctx).state

    expect(stateHash(fortgesetzt)).toBe(stateHash(durchgehend))
  })

  it('befiehlt mit und ohne gekuerztes KI-Gedaechtnis dasselbe (T-M41-05)', () => {
    // `AiMemory.assignments` wird geschrieben und nirgends gelesen. Das wird hier nicht
    // behauptet, sondern gefahren: Lauf B schaltet die Kuerzung in `militaryCommands` ab
    // (Huelle oben), die Funktion arbeitet also mit jedem je geschriebenen Eintrag — und
    // muss ueber 200 Ticks dieselben Befehle geben wie der gekuerzte Lauf A.
    //
    // Nacharbeit (Durchsicht M2): bis dahin fuellte Lauf B das Gedaechtnis vor jedem Tick
    // wieder auf, und `militaryCommands` kuerzte gleich zu Beginn — auch B las nach der
    // Kuerzung nie einen toten Eintrag (gemessen: 0). Der Vergleich sah nur Leser VOR
    // `militaryCommands`. Jetzt zaehlt die Huelle, was die Funktion nach der Kuerzung sieht.
    const TICKS = 200
    const ohneKuerzen = <T,>(lauf: () => T): T => {
      kuerzen.aus = true
      try {
        return lauf()
      } finally {
        kuerzen.aus = false
      }
    }

    kuerzen.totBeimLesen = 0
    const gekuerzt = advanceTicks(stateWith(4), TICKS, ctx)
    expect(kuerzen.totBeimLesen, 'Lauf A sieht nach der Kuerzung tote Eintraege').toBe(0)

    kuerzen.verschluckt = 0
    kuerzen.totBeimLesen = 0
    const ungekuerzt = ohneKuerzen(() => advanceTicks(stateWith(4), TICKS, ctx))

    // Nicht leer verglichen: B hat wirklich nicht gekuerzt und dabei tote Eintraege gesehen.
    expect(kuerzen.verschluckt, 'keine Kuerzung verschluckt - der Schalter misst nichts').toBeGreaterThan(0)
    expect(kuerzen.totBeimLesen, 'Lauf B hat nach der Kuerzung keinen toten Eintrag gesehen').toBeGreaterThan(0)
    expect(gekuerzt.applied.length, 'der Lauf hat nichts befohlen').toBeGreaterThan(0)
    expect(ungekuerzt.applied).toEqual(gekuerzt.applied)

    // Und die Kuerzung greift: A fuehrt am Ende weniger Eintraege als B, und nur lebende
    // eigene Armeen.
    const zaehle = (memories: Record<string, { assignments: Record<string, string> }>) =>
      Object.values(memories).reduce((sum, memory) => sum + Object.keys(memory.assignments).length, 0)
    const ohne = zaehle(ungekuerzt.state.ai)
    expect(zaehle(gekuerzt.state.ai), `gekuerzt gegen ${ohne} ohne Kuerzung`).toBeLessThan(ohne)
    for (const [playerId, memory] of Object.entries(gekuerzt.state.ai)) {
      for (const armyId of Object.keys(memory.assignments)) {
        expect(gekuerzt.state.armies[armyId]?.owner ?? 'gefallen', `${playerId} erinnert ${armyId}`).toBe(playerId)
      }
    }
  })
})

/**
 * Der Adjutant in der Spielschleife (T-M40-03, D30.2, D30.3, R-UNIT-09/AK4).
 *
 * Nordland ist ein Mensch mit einem Verteidiger in jeder Provinz; eine starke Ostmark-Armee
 * marschiert von m1 auf n2. Kommt sie an, kaempft sie gegen den Verteidiger von n2 — und der
 * Adjutant schickt eine Nachbararmee, ohne dass jemand klickt.
 */
describe('R-UNIT-09/AK4 Der Adjutant in der Spielschleife', () => {
  /** Der Tick, an dem die Lage beginnt (siehe `lageMitMensch`). */
  const START = 200

  function lageMitMensch(): GameState {
    const state = stateWith(3)
    // Mitten in der Partie: aufgestellte Armeen tragen deployDelayUntil 0, und seit T-M40-09 ruht die
    // Automatik nach einem Marsch fuenf Spieltage — bei Tick 0 handelte sie noch gar nicht.
    state.tick = START
    const mensch = state.playerOrder[0]!
    state.players[mensch]!.kind = 'human'
    for (const id of state.provinceOrder) {
      if (state.provinces[id]!.owner !== mensch) continue
      placeArmy(state, { owner: mensch, at: id, units: [{ unitKey: 'infantry', hpTotal: 6_000 }], stance: 'defensive' })
      // Eine Garnison daneben: seit T-M40-10 rueckt eine Verteidigung nur aus, wenn in ihrer Provinz
      // eine Armee stehen bleibt.
      placeArmy(state, { owner: mensch, at: id, units: [{ unitKey: 'infantry', hpTotal: 6_000 }], stance: 'garrison' })
    }
    const angreifer = placeArmy(state, {
      owner: state.playerOrder[1]!,
      at: 'm1',
      units: [{ unitKey: 'infantry', hpTotal: 30_000 }],
    })
    // Schon auf dem Marsch: eine KI laesst eine Armee mit Weg weitermarschieren (military.ts).
    const route = planRoute(state, angreifer, 'n2', map, TEST_RULES)!
    angreifer.path = route.path
    angreifer.departureTick = state.tick
    angreifer.arrivalTick = route.arrivalTick
    return state
  }

  it('gibt nach Speichern, Laden und Weiterspielen dieselben Befehle wie ohne Unterbrechung', () => {
    const TICKS = 150
    const durchgehend = advanceTicks(lageMitMensch(), TICKS, ctx)
    const mensch = durchgehend.state.playerOrder[0]!
    const vomAdjutanten = durchgehend.applied.filter((entry) => entry.command.playerId === mensch)
    expect(vomAdjutanten.length, 'der Adjutant hat in diesem Lauf nichts befohlen').toBeGreaterThan(0)

    // Geteilt genau im Tick seines ersten Befehls: den muss der geladene Stand selbst finden.
    // Ein Adjutant, der an den Ereignissen des Vorticks hinge, faende ihn hier nicht (D30.3).
    // Die Lage beginnt bei START, geteilt wird nach so vielen Ticks.
    const bruch = vomAdjutanten[0]!.tick - START
    expect(bruch, 'der erste Befehl faellt in den ersten Tick — dann prueft die Teilung nichts').toBeGreaterThan(0)
    const erste = advanceTicks(lageMitMensch(), bruch, ctx)
    const geladen = deserialise(serialise(erste.state))
    const zweite = advanceTicks(geladen, TICKS - bruch, ctx)

    expect([...erste.applied, ...zweite.applied]).toEqual(durchgehend.applied)
    expect(stateHash(zweite.state)).toBe(stateHash(durchgehend.state))
  })

  it('nennt die Befehle der Automatik gesondert — genau die Befehle fuer den Menschen in applied (T-M40-13)', () => {
    // Die Oberflaeche schreibt daraus eine leise Zeile; ein Ereignis des Kerns gibt es dafuer nicht.
    const lauf = advanceTicks(lageMitMensch(), 150, ctx)
    const mensch = lauf.state.playerOrder[0]!
    const fuerDenMenschen = lauf.applied.filter((entry) => entry.command.playerId === mensch)
    expect(fuerDenMenschen.length, 'der Adjutant hat in diesem Lauf nichts befohlen').toBeGreaterThan(0)
    expect(lauf.adjutant).toEqual(fuerDenMenschen)
  })

  it('erzeugt ueber einen Lauf keinen Befehl, den der Kern ablehnt (Muster R-AI-08/AK3)', () => {
    const lauf = advanceTicks(lageMitMensch(), 400, ctx)
    const mensch = lauf.state.playerOrder[0]!
    expect(lauf.applied.filter((entry) => entry.command.playerId === mensch).length).toBeGreaterThan(0)

    const abgelehnt = lauf.events.filter((event) => event.type === 'COMMAND_REJECTED' && event.playerId === mensch)
    expect(abgelehnt, JSON.stringify(abgelehnt.slice(0, 3))).toEqual([])
  })
})

/**
 * Nach Marsch und Rueckzug ruht die Automatik (T-M40-09, Befund H1 der Durchsicht von M40).
 *
 * Eine Armee, die sich aus einem Gefecht zurueckzieht, zahlt dafuer Staerke — und stand danach auf
 * Verteidigung. Bei Ablauf der Angriffssperre schickte der Adjutant sie in dieselbe laufende
 * Schlacht zurueck (Beleg S4c: Tick 24). Ebenso marschierte eine Armee, die der Spieler eben
 * verlegt hatte, bei der Ankunft sofort weiter. Gerechnet ueber die Spielschleife, ohne KI: alle
 * drei Maechte sind Menschen, damit nichts anderes marschiert als der Adjutant.
 */
describe('R-UNIT-09/AK7 Nach Marsch und Rueckzug ruht die Automatik fuenf Spieltage', () => {
  /** Fuenf Spieltage (T-M40-09, D30.4). */
  const RUHE = 120

  /** Nordland haelt n2 mit einer starken Garnison gegen eine starke Ostmark-Armee: die Schlacht dauert. */
  function langeSchlacht(): { state: GameState; mensch: string; feind: string } {
    const state = stateWith(3)
    state.tick = 200
    for (const id of state.playerOrder) state.players[id]!.kind = 'human'
    const mensch = state.playerOrder[0]!
    const feind = state.playerOrder[1]!
    expect(state.provinces['n2']!.owner).toBe(mensch)
    placeArmy(state, { owner: mensch, at: 'n2', units: [{ unitKey: 'infantry', hpTotal: 300_000 }], stance: 'garrison' })
    placeArmy(state, { owner: feind, at: 'n2', units: [{ unitKey: 'infantry', hpTotal: 300_000 }], stance: 'garrison' })
    // Eine Garnison in n1 bleibt stehen, was auch geschieht.
    placeArmy(state, { owner: mensch, at: 'n1', units: [{ unitKey: 'infantry', hpTotal: 6_000 }], stance: 'garrison' })
    return { state, mensch, feind }
  }

  const maersche = (applied: readonly { tick: number; command: Command }[], armyId: string, nach: number) =>
    applied.filter((entry) => entry.tick > nach && entry.command.type === 'MOVE_ARMY' && entry.command.armyId === armyId)

  it('schickt eine zurueckgewichene Armee nicht in dieselbe Schlacht zurueck, solange sie ruht (Beleg S4c)', () => {
    const { state, mensch } = langeSchlacht()
    const weicht = placeArmy(state, { owner: mensch, at: 'n2', units: [{ unitKey: 'infantry', hpTotal: 6_000 }], stance: 'defensive' })

    const lauf = advanceTicks(state, 200, ctx, {
      playerCommands: [{ type: 'SET_STANCE', playerId: mensch, armyId: weicht.id, stance: 'retreat' }],
    })

    const rueckzug = lauf.events.find((event) => event.type === 'ARMY_RETREATED' && event.armyId === weicht.id)
    expect(rueckzug, 'die Armee ist nicht zurueckgewichen - der Test misst nichts').toBeDefined()
    const ruheEnde = rueckzug!.tick + TEST_RULES.constants.deployDelayTicks * 2 + RUHE
    const zurueck = maersche(lauf.applied, weicht.id, rueckzug!.tick)
    expect(zurueck.filter((entry) => entry.tick < ruheEnde), JSON.stringify(zurueck)).toEqual([])
  })

  it('laesst eine vom Spieler verlegte Armee nach dem Abmarsch fuenf Spieltage stehen', () => {
    // Nicht "nach der Ankunft": der Zustand kennt den Tick der Ankunft nicht, wohl aber
    // `deployDelayUntil`, das Befehl und Abmarsch setzen — auch nach dem Laden.
    const { state, mensch } = langeSchlacht()
    const zieht = placeArmy(state, { owner: mensch, at: 'n3', units: [{ unitKey: 'infantry', hpTotal: 6_000 }], stance: 'defensive' })
    expect(planRoute(state, zieht, 'n1', map, TEST_RULES)!.path, 'Vorbedingung: eine Etappe, nicht durch die Schlacht').toEqual(['n1'])

    const lauf = advanceTicks(state, 250, ctx, {
      playerCommands: [{ type: 'MOVE_ARMY', playerId: mensch, armyId: zieht.id, targetProvinceId: 'n1' }],
    })

    const abmarsch = lauf.events.find((event) => event.type === 'ARMY_DEPARTED' && event.armyId === zieht.id)
    const ankunft = lauf.events.find((event) => event.type === 'ARMY_ARRIVED' && event.armyId === zieht.id)
    expect(abmarsch && ankunft, 'die Armee ist nicht in n1 angekommen - der Test misst nichts').toBeTruthy()
    const ruheEnde = abmarsch!.tick + TEST_RULES.constants.deployDelayTicks + RUHE
    expect(ankunft!.tick, 'die Armee kam erst nach der Ruhe an - der Test misst nichts').toBeLessThan(ruheEnde)
    const vonSelbst = maersche(lauf.applied, zieht.id, abmarsch!.tick)
    expect(vonSelbst.filter((entry) => entry.tick < ruheEnde), JSON.stringify(vonSelbst)).toEqual([])
  })

  /**
   * Szenario R1 der Durchsicht der Nacharbeit (Befund H-A, T-M40-14).
   *
   * Nordland haelt n2 in einer Schlacht, die lange dauert; in n1 steht eine Garnison. Der Spieler
   * schickt eine Verteidigung von n3 nach n1, ueber eine Kante, die der Test so lang macht, dass der
   * Marsch die Ruhe fast oder ganz aufbraucht. Danach ist n3 leer und grenzt an die Schlacht. Die Ruhe
   * zaehlt ab dem Abmarsch: nach der Ankunft blieben in R1 sechs Ticks, dann marschierte die Armee von
   * selbst weiter (Beleg: Abmarsch 200, Ankunft 316, von selbst an Tick 322).
   */
  function langerMarsch(distanceKm: number) {
    const karte = smallWorld()
    for (const edge of karte.edges) {
      const kante = [edge.a, edge.b].sort().join('-')
      if (kante === 'n1-n3') edge.distanceKm = distanceKm
      // Kein kuerzerer Weg von n3 nach n1 ueber n2 oder m2.
      if (kante === 'n2-n3' || kante === 'm2-n3') edge.distanceKm = 5_000_000
    }
    const kontext = { map: karte, rules: TEST_RULES }
    const state = stateWith(3, kontext)
    state.tick = 200
    for (const id of state.playerOrder) state.players[id]!.kind = 'human'
    const mensch = state.playerOrder[0]!
    const feind = state.playerOrder[1]!
    const stark = [{ unitKey: 'infantry', hpTotal: 900_000 }]
    placeArmy(state, { owner: mensch, at: 'n2', units: stark, stance: 'garrison' })
    placeArmy(state, { owner: feind, at: 'n2', units: stark, stance: 'garrison' })
    placeArmy(state, { owner: mensch, at: 'n1', units: [{ unitKey: 'infantry', hpTotal: 6_000 }], stance: 'garrison' })
    const zieht = placeArmy(state, { owner: mensch, at: 'n3', units: [{ unitKey: 'infantry', hpTotal: 6_000 }], stance: 'defensive' })
    expect(planRoute(state, zieht, 'n1', karte, TEST_RULES)!.path, 'Vorbedingung: eine Etappe').toEqual(['n1'])
    const marsch: Command = { type: 'MOVE_ARMY', playerId: mensch, armyId: zieht.id, targetProvinceId: 'n1' }
    return { state, kontext, zieht, marsch }
  }

  it('laesst eine Verteidigung, die der Spieler selbst verlegt, am Ziel stehen, auch wenn der Marsch die Ruhe aufbraucht (T-M40-14, Szenario R1)', () => {
    const TICKS = 700
    const tagesTicks = TEST_RULES.constants.ticksPerDay
    for (const [fall, distanceKm] of [
      ['R1, 117 Ticks Marsch', 700_000],
      ['Marsch laenger als die Ruhe', 1_400_000],
    ] as const) {
      // Gegenprobe ohne Folgebefehl: die Lage loest die Automatik wirklich aus.
      const ohne = langerMarsch(distanceKm)
      const ohneLauf = advanceTicks(ohne.state, TICKS, ohne.kontext, { playerCommands: [ohne.marsch] })
      const abmarsch = ohneLauf.events.find((event) => event.type === 'ARMY_DEPARTED' && event.armyId === ohne.zieht.id)
      const ankunft = ohneLauf.events.find((event) => event.type === 'ARMY_ARRIVED' && event.armyId === ohne.zieht.id)
      expect(abmarsch && ankunft, `${fall}: die Armee ist nicht in n1 angekommen - der Test misst nichts`).toBeTruthy()
      const ruheEnde = abmarsch!.tick + TEST_RULES.constants.deployDelayTicks + RUHE
      expect(ruheEnde - ankunft!.tick, `${fall}: nach der Ankunft bleibt ein Tag Ruhe oder mehr - der Test misst nichts`).toBeLessThan(tagesTicks)
      const vonSelbst = ohneLauf.adjutant.filter(
        (entry) => entry.command.type === 'MOVE_ARMY' && entry.command.armyId === ohne.zieht.id,
      )
      expect(vonSelbst.length, `${fall}: ohne Folgebefehl bleibt sie auch stehen - die Lage misst nichts`).toBeGreaterThan(0)
      expect(vonSelbst[0]!.tick - ankunft!.tick, `${fall}: ${JSON.stringify(vonSelbst[0])}`).toBeLessThanOrEqual(tagesTicks)

      // Mit dem, was die Oberflaeche seit T-M40-14 zum Marschbefehl schickt.
      const mit = langerMarsch(distanceKm)
      const folge = garrisonFollowUp(mit.state, mit.marsch)
      const lauf = advanceTicks(mit.state, TICKS, mit.kontext, { playerCommands: folge ? [mit.marsch, folge] : [mit.marsch] })
      expect(
        lauf.events.some((event) => event.type === 'ARMY_ARRIVED' && event.armyId === mit.zieht.id && event.provinceId === 'n1'),
        `${fall}: mit Folgebefehl nicht angekommen`,
      ).toBe(true)
      expect(lauf.state.armies[mit.zieht.id]?.stance, `${fall}: der Marschbefehl hat sie nicht auf Garnison gestellt`).toBe('garrison')
      const fuerSie = lauf.adjutant.filter((entry) => 'armyId' in entry.command && entry.command.armyId === mit.zieht.id)
      expect(fuerSie, fall).toEqual([])
    }
  })
})

/**
 * Ein Rueckzug-Klick und die Automatik leeren im selben Tick keine Provinz (T-M40-15, Befund M-A der
 * Durchsicht der Nacharbeit).
 *
 * `SET_STANCE` prueft kein Gefecht, und `phases/retreat.ts` laesst jede Armee auf Rueckzug ausweichen.
 * Szenario R2: in n3 stehen eine Verteidigung und eine Garnison, eine Ostmark-Armee steht in n2. Der
 * Spieler zieht die Garnison zurueck; die Automatik schickte im selben Tick die Verteidigung nach n2, und
 * nach 25 Ticks stand keine eigene Armee mehr in n3. Gerechnet ueber die Spielschleife, alle Maechte
 * Menschen, damit nichts anderes marschiert.
 */
describe('R-UNIT-09/AK1 Ein Rueckzug-Klick und die Automatik leeren im selben Tick keine Provinz', () => {
  it('laesst die Verteidigung in n3 stehen, wenn der Spieler dort die Garnison zurueckzieht (T-M40-15, Szenario R2)', () => {
    const state = stateWith(3)
    state.tick = 200
    for (const id of state.playerOrder) state.players[id]!.kind = 'human'
    const mensch = state.playerOrder[0]!
    const feind = state.playerOrder[1]!
    expect(state.provinces['n3']!.owner).toBe(mensch)
    placeArmy(state, { owner: feind, at: 'n2', units: [{ unitKey: 'infantry', hpTotal: 8_000 }] })
    const verteidigung = placeArmy(state, { owner: mensch, at: 'n3', units: [{ unitKey: 'infantry', hpTotal: 6_000 }], stance: 'defensive' })
    const weicht = placeArmy(state, { owner: mensch, at: 'n3', units: [{ unitKey: 'infantry', hpTotal: 6_000 }], stance: 'garrison' })

    const lauf = advanceTicks(state, 25, ctx, {
      playerCommands: [{ type: 'SET_STANCE', playerId: mensch, armyId: weicht.id, stance: 'retreat' }],
    })

    const rueckzug = lauf.events.find((event) => event.type === 'ARMY_RETREATED' && event.armyId === weicht.id)
    expect(rueckzug, 'die Garnison ist nicht ausgewichen - der Test misst nichts').toBeDefined()
    const inN3 = lauf.state.armyOrder.filter(
      (id) => lauf.state.armies[id]!.owner === mensch && lauf.state.armies[id]!.locationProvinceId === 'n3',
    )
    expect(inN3, JSON.stringify(lauf.adjutant)).toEqual([verteidigung.id])
  })
})
