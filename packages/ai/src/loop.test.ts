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

function stateWith(aiCount: number): GameState {
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
  const state = createInitialState(config, ctx)
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
  function lageMitMensch(): GameState {
    const state = stateWith(3)
    const mensch = state.playerOrder[0]!
    state.players[mensch]!.kind = 'human'
    for (const id of state.provinceOrder) {
      if (state.provinces[id]!.owner !== mensch) continue
      placeArmy(state, { owner: mensch, at: id, units: [{ unitKey: 'infantry', hpTotal: 6_000 }], stance: 'defensive' })
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
    const bruch = vomAdjutanten[0]!.tick
    expect(bruch, 'der erste Befehl faellt in Tick 0 — dann prueft die Teilung nichts').toBeGreaterThan(0)
    const erste = advanceTicks(lageMitMensch(), bruch, ctx)
    const geladen = deserialise(serialise(erste.state))
    const zweite = advanceTicks(geladen, TICKS - bruch, ctx)

    expect([...erste.applied, ...zweite.applied]).toEqual(durchgehend.applied)
    expect(stateHash(zweite.state)).toBe(stateHash(durchgehend.state))
  })

  it('erzeugt ueber einen Lauf keinen Befehl, den der Kern ablehnt (Muster R-AI-08/AK3)', () => {
    const lauf = advanceTicks(lageMitMensch(), 400, ctx)
    const mensch = lauf.state.playerOrder[0]!
    expect(lauf.applied.filter((entry) => entry.command.playerId === mensch).length).toBeGreaterThan(0)

    const abgelehnt = lauf.events.filter((event) => event.type === 'COMMAND_REJECTED' && event.playerId === mensch)
    expect(abgelehnt, JSON.stringify(abgelehnt.slice(0, 3))).toEqual([])
  })
})
