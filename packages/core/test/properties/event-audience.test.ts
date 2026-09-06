import { TEST_RULES, placeArmy, smallWorld } from '@worldwar/testkit'
import { describe, expect, it } from 'vitest'
import { fastForward, firstAlertFor, runTicks } from '../../src/clock'
import { createInitialState, type GameConfig } from '../../src/state/create'
import type { GameEvent } from '../../src/events/types'

/**
 * Wer erfährt was (T-M15-01, R-TIME-06).
 *
 * Das Ereignissystem vermischte zwei Fragen in zwei Feldern und beantwortete eine dritte
 * gar nicht:
 *
 *   - **Lektüre** (`audience`) — wer *darf* es sehen. Leer heißt öffentlich.
 *   - **Dringlichkeit** (`severity`) — muss es gesehen werden, bevor die Zeit weiterläuft.
 *   - **Adressat** (`concerns`) — *wen* geht es an. Das ist neu.
 *
 * Ohne das dritte Feld hielt `firstAlertFor` jedes öffentliche Alarmereignis für jeden
 * Spieler an: eine Eroberung zwischen zwei fremden Mächten stoppte das Vorspulen eines
 * Unbeteiligten. Wer eine Weltkarte mit acht Mächten vorspult, kam damit keine drei
 * Spieltage weit — und das ist die Betriebsart, für die dieses Spiel existiert.
 */

const CONFIG: GameConfig = {
  seed: 7,
  mapId: 'testworld',
  rulesId: 'test',
  players: [
    { name: 'Noah', kind: 'human', nation: 'Nordland', color: '#0f62bc' },
    { name: 'Zwei', kind: 'ai', nation: 'Ostmark', color: '#b03a2e', difficulty: 'normal' },
    { name: 'Drei', kind: 'ai', nation: 'Sueden', color: '#2e7d32', difficulty: 'normal' },
  ],
  victory: { condition: 'points', pointsShareToWin: 600, dayLimit: null },
}

const ctx = { map: smallWorld(), rules: TEST_RULES }
const fresh = () => createInitialState(CONFIG, ctx)

const capture = (previousOwner: string, newOwner: string): GameEvent =>
  ({
    type: 'PROVINCE_CAPTURED',
    tick: 1,
    severity: 'alert',
    audience: [],
    concerns: [previousOwner, newOwner],
    provinceId: 'n2',
    previousOwner,
    newOwner,
  }) as GameEvent

describe('R-TIME-06/AK2 Ein Alarm haelt nur den an, den er angeht', () => {
  it('haelt p1 nicht an, wenn p2 dem p3 eine Provinz abnimmt', () => {
    expect(firstAlertFor([capture('p2', 'p3')], 'p1')).toBeNull()
  })

  it('haelt p1 an, sobald er Vorbesitzer oder Neubesitzer ist', () => {
    expect(firstAlertFor([capture('p1', 'p2')], 'p1')).not.toBeNull()
    expect(firstAlertFor([capture('p2', 'p1')], 'p1')).not.toBeNull()
  })

  it('haelt niemanden an einem Alarm ohne Betroffenen an', () => {
    // Die sichere Richtung des Fehlers. Ein Ereignis, dessen Betroffenenliste jemand zu
    // fuellen vergisst, soll niemanden aufhalten — nicht jeden. Der Eigenschaftstest
    // unten sorgt dafuer, dass diese Lage im Spiel gar nicht erst entsteht.
    const ohne = { ...capture('p2', 'p3'), concerns: [] } as GameEvent
    expect(firstAlertFor([ohne], 'p1')).toBeNull()
    expect(firstAlertFor([ohne], 'p2')).toBeNull()
  })

  it('achtet weiterhin auf die Leserschaft', () => {
    // Ein Adressat, der es nicht lesen darf, erfaehrt es auch nicht.
    const privat = { ...capture('p1', 'p2'), audience: ['p2'] } as GameEvent
    expect(firstAlertFor([privat], 'p1')).toBeNull()
    expect(firstAlertFor([privat], 'p2')).not.toBeNull()
  })
})

describe('R-TIME-06/AK3 Der Kern meldet den Beginn eines Gefechts', () => {
  /** Zwei verfeindete Armeen in derselben Provinz — das Gefecht laeuft ueber Ticks. */
  function atWar() {
    const state = fresh()
    state.diplomacy.relations['p1|p2']!.state = 'war'
    placeArmy(state, { owner: 'p1', at: 'n2', units: [{ unitKey: 'infantry', hpTotal: 400_000 }] })
    placeArmy(state, { owner: 'p2', at: 'n2', units: [{ unitKey: 'infantry', hpTotal: 400_000 }] })
    return state
  }

  it('meldet ein Gefecht ueber drei Ticks genau einmal', () => {
    const { events } = runTicks(atWar(), 3, ctx)
    const started = events.filter((event) => event.type === 'BATTLE_STARTED')

    expect(started.length, 'BATTLE_STARTED je Tick statt je Gefecht').toBe(1)
  })

  it('nennt dieselben Maechte wie das zugehoerige BATTLE_RESOLVED', () => {
    const { events } = runTicks(atWar(), 1, ctx)
    const started = events.find((event) => event.type === 'BATTLE_STARTED')
    const resolved = events.find((event) => event.type === 'BATTLE_RESOLVED')

    expect(started, 'kein BATTLE_STARTED').toBeDefined()
    expect(resolved, 'kein BATTLE_RESOLVED').toBeDefined()
    if (started?.type !== 'BATTLE_STARTED' || resolved?.type !== 'BATTLE_RESOLVED') return

    expect(started.battleId).toBe(resolved.battleId)
    expect(started.sides.flat().sort()).toEqual(Object.keys(resolved.losses).sort())
    expect(started.concerns.sort()).toEqual(['p1', 'p2'])
  })

  it('haelt das Vorspulen am Beginn eines Gefechts an', () => {
    // Ohne den Erzeuger lief dieser Lauf bis maxTicks durch und meldete `limit` — das
    // Vorspulziel "bis zum ersten Gefecht" war seit M1 im Menue und ohne Wirkung.
    const result = fastForward(atWar(), { kind: 'battleStarts' }, ctx, { maxTicks: 50 })

    expect(result.stoppedBy, 'das Vorspulen lief bis zum Limit durch').toBe('target')
    expect(result.trigger?.type).toBe('BATTLE_STARTED')
    expect(result.ticksRun, 'es haette im ersten Tick anhalten muessen').toBe(1)
  })
})

describe('R-TIME-06/AK1 Jeder Alarm nennt seine Betroffenen', () => {
  it('ueber zweihundert Spieltage mit drei Maechten', () => {
    // Eigenschaftstest statt Aufzaehlung: eine Liste von Ereignistypen waere genau so
    // vollstaendig wie am Tag ihrer Niederschrift. Gepruefte Eigenschaft:
    //   (a) jeder Alarm nennt mindestens einen Betroffenen, und
    //   (b) kein Betroffener steht ausserhalb einer nicht leeren Leserschaft.
    let state = fresh()
    state.diplomacy.relations['p1|p2']!.state = 'war'
    placeArmy(state, { owner: 'p1', at: 'n1', units: [{ unitKey: 'infantry', hpTotal: 300_000 }] })
    placeArmy(state, { owner: 'p2', at: 'n2', units: [{ unitKey: 'infantry', hpTotal: 300_000 }] })

    const seen: GameEvent[] = []
    for (let day = 0; day < 200; day++) {
      const result = runTicks(state, TEST_RULES.constants.ticksPerDay, ctx)
      state = result.state
      seen.push(...result.events)
      if (state.victory.winner !== null) break
    }

    expect(seen.length, 'der Lauf hat nichts gemessen').toBeGreaterThan(50)

    const alerts = seen.filter((event) => event.severity === 'alert')
    expect(alerts.length, 'kein einziger Alarm im Lauf — die Eigenschaft waere leer').toBeGreaterThan(0)

    const ohneBetroffenen = alerts.filter((event) => event.concerns.length === 0).map((event) => event.type)
    expect([...new Set(ohneBetroffenen)], 'Alarme ohne Betroffenen').toEqual([])

    const ausserhalb = seen
      .filter((event) => event.audience.length > 0 && event.concerns.some((id) => !event.audience.includes(id)))
      .map((event) => event.type)
    expect([...new Set(ausserhalb)], 'Betroffene ausserhalb der Leserschaft').toEqual([])
  })
})
