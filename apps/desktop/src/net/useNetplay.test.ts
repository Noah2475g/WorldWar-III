// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { createElement, type ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createInitialState, type Command, type GameConfig, type GameState } from '@worldwar/core'
import { createLockstep, createLoopback, stateHash, type Lockstep, type Transport } from '@worldwar/netplay'
import { TEST_RULES, placeArmy, smallWorld } from '@worldwar/testkit'
import { WAIT_NOTICE_AFTER_MS, useNetplay, type NetplayView } from './useNetplay.ts'

/**
 * Der Gleichschritt treibt die Uhr der Oberfläche (T-M37-11, R-MP-03/04/05, D28.4).
 *
 * Zwei Haken, zwei vollständige Simulationen, ein Schleifendoppel dazwischen — dieselbe
 * Anordnung wie in `twoclients.test.ts`, nur dass hier die **Oberfläche** den Takt gibt.
 * Was geprüft wird, ist genau das, was ein grüner Einzeltest nicht zeigen könnte: dass
 * ohne Freigabe wirklich kein Tick läuft, dass die Kopfleiste nach zwei Sekunden sagt,
 * worauf sie wartet, und dass die Pause beide Uhren beim selben Tick anhält.
 *
 * **Die Falle aus M22:** jsdom hängt `requestAnimationFrame` an `setInterval`. Unter
 * `vi.useFakeTimers` triebe `advanceTimersByTime` damit jede rAF-Schleife der Anwendung
 * mit. Hier wird nur der Haken gerendert, nicht die ganze App — und rAF wird trotzdem
 * gestubbt, damit der Takt dieses Tests ausschließlich aus `setInterval` kommt.
 */

const map = smallWorld()
const ctx = { map, rules: TEST_RULES }

const config: GameConfig = {
  seed: 1815,
  mapId: map.id,
  rulesId: TEST_RULES.id,
  players: [
    { name: 'Nordland', kind: 'human', nation: 'Nordland', color: 'farbe-eins' },
    { name: 'Ostmark', kind: 'human', nation: 'Ostmark', color: 'farbe-zwei' },
    { name: 'Sueden', kind: 'ai', nation: 'Sueden', color: 'farbe-drei', difficulty: 'normal' },
  ],
  victory: { condition: 'points', pointsShareToWin: 700, dayLimit: null },
}

function frisch(): GameState {
  const state = createInitialState(config, ctx)
  placeArmy(state, { owner: 'p1', at: 'n1', units: [{ unitKey: 'infantry', hpTotal: 6000 }] })
  placeArmy(state, { owner: 'p2', at: 'o1', units: [{ unitKey: 'infantry', hpTotal: 6000 }] })
  return state
}

/** Die Wanduhr des Tests — dieselbe Zahl, die `vi.advanceTimersByTime` weiterdreht. */
let uhr = 0
const now = () => uhr

/** Ein Traeger, der nur den Haken haelt und seine Sicht nach aussen reicht. */
function Traeger(props: {
  session: { lockstep: Lockstep; transport: Transport; seat: string; peer: string }
  speed: number
  sicht: { value: NetplayView | null }
  getickt: { staende: GameState[]; befehle: Command[]; hashes: string[] }
}): ReactElement | null {
  props.sicht.value = useNetplay({
    session: props.session,
    speed: props.speed,
    now,
    onTick: (state, applied) => {
      props.getickt.staende.push(state)
      props.getickt.befehle.push(...applied)
      // Nach JEDEM Tick, nicht am Ende: die beiden Reihen muessen sich decken, so weit
      // sie reichen — das ist die Zusicherung, nicht ein Vergleich der Endstaende.
      props.getickt.hashes.push(stateHash(state))
    },
  })
  return null
}

interface Seite {
  lockstep: Lockstep
  sicht: { value: NetplayView | null }
  getickt: { staende: GameState[]; befehle: Command[]; hashes: string[] }
}

/** Zwei Haken, ueber ein Schleifendoppel verbunden. */
function aufbau(speed = 10): { a: Seite; b: Seite; leitung: ReturnType<typeof createLoopback> } {
  const leitung = createLoopback()
  const machen = (seat: string, peer: string, transport: Transport): Seite => {
    const lockstep = createLockstep({ seat, seats: ['p1', 'p2'], state: frisch(), ctx, delayTicks: 2 })
    const seite: Seite = { lockstep, sicht: { value: null }, getickt: { staende: [], befehle: [], hashes: [] } }
    render(
      createElement(Traeger, {
        session: { lockstep, transport, seat, peer },
        speed,
        sicht: seite.sicht,
        getickt: seite.getickt,
      }),
    )
    return seite
  }
  return { a: machen('p1', 'p2', leitung.a), b: machen('p2', 'p1', leitung.b), leitung }
}

/** Die Zeit vorspulen — Wanduhr und Zeitgeber zusammen, sonst laufen sie auseinander. */
function warte(ms: number): void {
  act(() => {
    uhr += ms
    vi.advanceTimersByTime(ms)
  })
}

beforeEach(() => {
  uhr = 0
  vi.useFakeTimers()
  // jsdoms rAF haengt an setInterval (Falle aus M22): ohne diesen Stub triebe
  // `advanceTimersByTime` jede Bildschleife mit, die irgendwo noch laeuft.
  vi.stubGlobal('requestAnimationFrame', () => 0)
  vi.stubGlobal('cancelAnimationFrame', () => undefined)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('R-MP-03/AK1 Die Oberflaeche rechnet keinen Tick ohne Freigabe', () => {
  it('bleibt stehen, solange nur eine Seite laeuft', () => {
    const leitung = createLoopback()
    const lockstep = createLockstep({ seat: 'p1', seats: ['p1', 'p2'], state: frisch(), ctx })
    const sicht = { value: null as NetplayView | null }
    const getickt = { staende: [] as GameState[], befehle: [] as Command[], hashes: [] as string[] }
    render(
      createElement(Traeger, {
        session: { lockstep, transport: leitung.a, seat: 'p1', peer: 'p2' },
        speed: 10,
        sicht,
        getickt,
      }),
    )

    warte(5000)

    expect(getickt.staende, 'die Uhr ist ohne Gegenseite gelaufen').toHaveLength(0)
    expect(lockstep.tick).toBe(0)
    expect(sicht.value?.status).toBe('waiting')
  })

  it('sagt nach zwei Sekunden, worauf es wartet', () => {
    const leitung = createLoopback()
    const lockstep = createLockstep({ seat: 'p1', seats: ['p1', 'p2'], state: frisch(), ctx })
    const sicht = { value: null as NetplayView | null }
    render(
      createElement(Traeger, {
        session: { lockstep, transport: leitung.a, seat: 'p1', peer: 'p2' },
        speed: 10,
        sicht,
        getickt: { staende: [], befehle: [], hashes: [] },
      }),
    )

    warte(WAIT_NOTICE_AFTER_MS - 200)
    expect(sicht.value?.waiting, 'die Meldung kam zu frueh — sie wuerde bei jedem Tick flackern').toBe(false)

    warte(400)
    expect(sicht.value?.waiting).toBe(true)
  })

  it('laeuft, sobald beide Seiten da sind — und beide halten dieselbe Pruefsumme', () => {
    const { a, b } = aufbau(50)

    warte(1000)

    expect(a.getickt.staende.length, 'kein einziger Tick gelaufen').toBeGreaterThan(10)
    // Die eine Seite darf der anderen um hoechstens einen Tick voraus sein — mehr waere
    // kein Gleichschritt. Verglichen werden die Reihen, so weit sie beide reichen.
    const gemeinsam = Math.min(a.getickt.hashes.length, b.getickt.hashes.length)
    expect(Math.abs(a.lockstep.tick - b.lockstep.tick)).toBeLessThanOrEqual(1)
    expect(a.getickt.hashes.slice(0, gemeinsam)).toEqual(b.getickt.hashes.slice(0, gemeinsam))
    expect(a.sicht.value?.waiting).toBe(false)
    expect(a.sicht.value?.desync).toBeNull()
  })

  it('haelt an, sobald die Leitung zu ist, statt allein weiterzurechnen', () => {
    const { a, leitung } = aufbau(50)
    warte(500)
    const bisher = a.lockstep.tick
    expect(bisher).toBeGreaterThan(3)

    leitung.a.close('Mitspieler weg')
    // Was schon gepuffert war, wird noch gerechnet — verloren geht nichts (D28.8).
    warte(200)
    const stand = a.lockstep.tick
    warte(3000)

    expect(a.lockstep.tick, 'die Uhr lief ohne Gegenseite weiter').toBe(stand)
    expect(stand).toBeGreaterThanOrEqual(bisher)
    expect(a.sicht.value?.waiting).toBe(true)
  })

  it('bringt einen Befehl der Oberflaeche bei tick + 2 zur Wirkung', () => {
    const { a, b } = aufbau(50)
    warte(200)
    const armee = a.lockstep.state.armyOrder.find((id) => a.lockstep.state.armies[id]!.owner === 'p1')!

    act(() => {
      a.sicht.value?.give({ type: 'SET_STANCE', playerId: 'p1', armyId: armee, stance: 'defensive' })
    })
    warte(500)

    expect(a.getickt.befehle.map((c) => c.type)).toContain('SET_STANCE')
    expect(a.lockstep.state.armies[armee]!.stance).toBe('defensive')
    // Und die Gegenseite hat denselben Befehl gesehen — ueber die Leitung, nicht lokal.
    expect(b.getickt.befehle.map((c) => c.type)).toContain('SET_STANCE')
    const gemeinsam = Math.min(a.getickt.hashes.length, b.getickt.hashes.length)
    expect(a.getickt.hashes.slice(0, gemeinsam)).toEqual(b.getickt.hashes.slice(0, gemeinsam))
  })
})

describe('R-MP-05/AK2 Der Pausenantrag erreicht beide Seiten und haelt beide beim selben Tick an', () => {
  it('zeigt der Gegenseite den Antrag, ohne die Partie anzuhalten', () => {
    const { a, b } = aufbau(50)
    warte(200)
    const vorher = a.lockstep.tick

    act(() => a.sicht.value?.requestPause())
    warte(100)

    expect(b.sicht.value?.pause.request?.by).toBe('p1')
    expect(b.sicht.value?.pause.pausedFrom).toBeNull()
    // Ein Antrag allein haelt nichts an (R-MP-05/AK1): die Uhr ist weitergelaufen.
    expect(a.lockstep.tick).toBeGreaterThan(vorher)
  })

  it('haelt nach der Zustimmung beide Uhren beim selben Tick', () => {
    const { a, b } = aufbau(50)
    warte(200)

    act(() => a.sicht.value?.requestPause())
    warte(40)
    act(() => b.sicht.value?.answerPause(true))
    warte(2000)

    expect(a.sicht.value?.status).toBe('paused')
    expect(b.sicht.value?.status).toBe('paused')
    // Der springende Punkt von AK2: beide stehen bei DEMSELBEN Tick, und zwar bei dem,
    // den der Antrag genannt hat — nicht bei dem, den ihre eigene Uhr gerade zeigte.
    expect(a.sicht.value?.pause.pausedFrom).toBe(b.sicht.value?.pause.pausedFrom)
    expect(a.lockstep.tick).toBe(a.sicht.value?.pause.pausedFrom)
    expect(b.lockstep.tick).toBe(b.sicht.value?.pause.pausedFrom)

    // Und sie steht wirklich: weitere zwei Sekunden bringen keinen Tick mehr.
    const stand = a.lockstep.tick
    warte(2000)
    expect(a.lockstep.tick).toBe(stand)
  })

  it('setzt einseitig fort, mit drei Sekunden Vorlauf', () => {
    const { a, b } = aufbau(50)
    warte(200)
    act(() => a.sicht.value?.requestPause())
    warte(40)
    act(() => b.sicht.value?.answerPause(true))
    warte(1000)
    const stand = a.lockstep.tick

    act(() => b.sicht.value?.resume())
    warte(2900)
    expect(a.lockstep.tick, 'die Partie lief vor Ablauf des Vorlaufs weiter').toBe(stand)

    warte(300)
    expect(a.lockstep.tick).toBeGreaterThan(stand)
    expect(a.sicht.value?.status).not.toBe('paused')
  })
})

describe('R-MP-04/AK1 Ein Auseinanderlaufen erreicht die Oberflaeche und haelt an', () => {
  it('meldet den Tick und rechnet nicht weiter', () => {
    const { a, b } = aufbau(50)
    warte(300)
    const bisher = a.lockstep.tick
    expect(bisher).toBeGreaterThan(3)

    // Eine Seite wird kuenstlich verfaelscht — wie in desync.test.ts, nur dass hier die
    // OBERFLAECHE erfahren muss, was geschehen ist.
    a.lockstep.state.players['p1']!.resources.food += 1000
    warte(500)

    expect(a.sicht.value?.desync).not.toBeNull()
    expect(b.sicht.value?.desync).not.toBeNull()
    expect(a.sicht.value?.desync!.tick).toBe(bisher)
    expect(a.sicht.value?.status).toBe('desynced')
    expect(a.lockstep.tick).toBe(bisher)

    // Und es bleibt dabei: kein weiterer Tick, egal wie lange man wartet.
    warte(5000)
    expect(a.lockstep.tick).toBe(bisher)
  })
})
