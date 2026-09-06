import { hashValue } from '@worldwar/shared'
import { TEST_RULES, tinyMap } from '@worldwar/testkit'
import { describe, expect, it } from 'vitest'
import { createInitialState, type GameConfig } from '../src/state/create'
import { PHASE_ORDER, step } from '../src/step'
import { HASH_OMIT_KEYS } from '../src/state/types'
import { EVENT_LOG_LIMIT } from '../src/phases/bookkeeping'

const CONFIG: GameConfig = {
  seed: 42,
  mapId: 'tiny',
  rulesId: 'test',
  players: [
    { name: 'Noah', kind: 'human', nation: 'Nordland', color: '#0f62bc' },
    { name: 'Gegner', kind: 'ai', nation: 'Sued', color: '#b03a2e', difficulty: 'normal' },
  ],
  victory: { condition: 'points', pointsShareToWin: 600, dayLimit: null },
}

const ctx = { map: tinyMap(), rules: TEST_RULES }
const fresh = () => createInitialState(CONFIG, ctx)

describe('R-ARCH-01 Tick-Pipeline', () => {
  it('haelt die im Design festgelegte Phasenreihenfolge ein', () => {
    // The order is not cosmetic: retreat before movement, movement before combat,
    // combat before occupation. Swapping any two changes the game (design D3).
    //
    // `bombardment` ist am 2026-09-06 dazugekommen (T-M15-07, Befund 52) und steht
    // **zwischen Bewegung und Nahkampf**. Vorher wirkte `BOMBARD` als Kommando in Phase 1:
    // der Beschuss traf, bevor Bewegung und Kampf desselben Ticks stattgefunden hatten,
    // und eine Armee, die in diesem Tick abmarschierte, wurde noch am alten Ort getroffen.
    // Mit der Feuerautomatik haette dieselbe Kanone zwei Regeln gehabt, je nachdem, wer
    // abdrueckt.
    expect(PHASE_ORDER).toEqual([
      'applyCommands',
      'production',
      'upkeep',
      'construction',
      'recruitment',
      'retreat',
      'movement',
      'bombardment',
      'combat',
      'occupation',
      'regeneration',
      'diplomacy',
      'bookkeeping',
    ])
  })

  it('ruft jede Phase genau einmal und in dieser Reihenfolge auf', () => {
    const seen: string[] = []
    step(fresh(), [], ctx, { onPhase: (name) => seen.push(name) })
    expect(seen).toEqual([...PHASE_ORDER])
  })

  it('erhoeht die Spielzeit um genau eine Stunde', () => {
    const before = fresh()
    const { state } = step(before, [], ctx)
    expect(state.tick).toBe(before.tick + 1)
  })

  it('laesst den Eingangszustand unveraendert', () => {
    // Purity is proven by hash, not by deep-copying on every tick (design D5).
    const before = fresh()
    const hashBefore = hashValue(before, { omitKeys: HASH_OMIT_KEYS })
    step(before, [], ctx)
    expect(hashValue(before, { omitKeys: HASH_OMIT_KEYS })).toBe(hashBefore)
  })

  it('aendert ohne Kommandos weder Besitz noch Streitkraefte', () => {
    // The economy does run on its own — that is the point of a tick. What must not
    // move without an order is the map: ownership, armies, diplomacy.
    const before = fresh()
    const { state } = step(before, [], ctx)

    const shape = (s: typeof state) => ({
      owners: s.provinceOrder.map((id) => s.provinces[id]!.owner),
      armies: s.armyOrder,
      diplomacy: s.diplomacy,
      victory: s.victory,
    })
    expect(hashValue(shape(state))).toBe(hashValue(shape(before)))
  })

  it('liefert die Ereignisse dieses Ticks getrennt zurueck', () => {
    const { events } = step(fresh(), [], ctx)
    expect(Array.isArray(events)).toBe(true)
  })
})

describe('R-TIME-01 Tagesabrechnung', () => {
  it('rechnet den Tag erst nach 24 Stunden ab', () => {
    const seen: string[] = []
    let state = fresh()
    for (let i = 0; i < 24; i++) {
      const result = step(state, [], ctx, { onPhase: (name) => seen.push(`${state.tick}:${name}`) })
      state = result.state
    }
    const dailyTicks = seen.filter((entry) => entry.endsWith(':dailyTick'))
    expect(dailyTicks).toHaveLength(1)
    expect(dailyTicks[0]).toBe('23:dailyTick') // the tick that completes the first day
  })

  it('rechnet ueber vier Tage genau viermal ab', () => {
    let state = fresh()
    let daily = 0
    for (let i = 0; i < 96; i++) {
      const result = step(state, [], ctx, { onPhase: (name) => name === 'dailyTick' && daily++ })
      state = result.state
    }
    expect(daily).toBe(4)
    expect(state.tick).toBe(96)
  })

  it('haengt die Tagesabrechnung hinter die Buchhaltung', () => {
    const seen: string[] = []
    let state = fresh()
    for (let i = 0; i < 24; i++) {
      state = step(state, [], ctx, { onPhase: (name) => seen.push(name) }).state
    }
    expect(seen.at(-1)).toBe('dailyTick')
    expect(seen.at(-2)).toBe('bookkeeping')
  })
})

describe('R-ARCH-01 Wiederholbarkeit der Pipeline', () => {
  it('erzeugt aus gleichem Start dieselbe Hash-Folge', () => {
    const runHashes = () => {
      let state = fresh()
      const hashes: string[] = []
      for (let i = 0; i < 50; i++) {
        state = step(state, [], ctx).state
        hashes.push(hashValue(state, { omitKeys: HASH_OMIT_KEYS }))
      }
      return hashes
    }
    expect(runHashes()).toEqual(runHashes())
  })
})

/**
 * Was am Tagesende geschieht, steht auch im Protokoll (T-M12-09, R-UI-14).
 *
 * `step` laesst die Phasenreihe laufen und ruft `dailyTick` danach — `bookkeeping` ist
 * aber die Phase, die `ctx.events` an `draft.eventLog` haengt, und sie ist die letzte.
 * Alles, was am Tagesende entsteht, kam damit zurueck (`StepResult.events`) und stand
 * doch nie im Protokoll. Fuer die Oberflaeche heisst das: nie. `advance` gibt nur
 * `.state` weiter, das Protokoll ist ihre einzige Ereignisquelle.
 *
 * Der Playtest hat es als "das eigene Ausscheiden lief wortlos an mir vorbei" gemeldet.
 *
 * Die Reihenfolge der Phasen wird dafuer NICHT angefasst — sie ist der Golden Master.
 * Nachtragen genuegt, und es ist hashneutral, weil `eventLog` in HASH_OMIT_KEYS steht.
 */
describe('R-UI-14 Das Tagesende erreicht das Protokoll', () => {
  const ticksPerDay = TEST_RULES.constants.ticksPerDay

  const runDays = (days: number) => {
    let state = fresh()
    const returned: string[] = []
    for (let i = 0; i < days * ticksPerDay; i += 1) {
      const result = step(state, [], ctx)
      returned.push(...result.events.map((event) => event.type))
      state = result.state
    }
    return { state, returned }
  }

  it('traegt den Tagesbericht ins Protokoll, nicht nur in die Rueckgabe', () => {
    const { state, returned } = runDays(3)

    expect(returned.filter((type) => type === 'DAY_REPORT')).toHaveLength(3)
    // Genau hier stand vorher null.
    expect(state.eventLog.filter((event) => event.type === 'DAY_REPORT')).toHaveLength(3)
  })

  it('laesst den Simulationshash unberuehrt', () => {
    // Der Beweis, dass das Nachtragen keine Regeländerung ist: der Hash laesst das
    // Protokoll aus, also darf es wachsen, ohne dass die Partie eine andere wird.
    const { state } = runDays(1)

    expect(HASH_OMIT_KEYS).toContain('eventLog')
    expect(hashValue(state, { omitKeys: HASH_OMIT_KEYS })).toBe(
      hashValue({ ...state, eventLog: [] }, { omitKeys: HASH_OMIT_KEYS }),
    )
  })

  it('haelt auch mit dem Tagesende den Deckel des Ringspeichers ein', () => {
    // Ein blosses push waere der naechstliegende Fehler: das Protokoll waechst dann an
    // jeder Tagesgrenze ueber seine Grenze hinaus und in die Spielstaende hinein.
    const { state } = runDays(30)

    expect(state.eventLog.length).toBeLessThanOrEqual(EVENT_LOG_LIMIT)
  })
})
