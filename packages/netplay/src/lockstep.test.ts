import { describe, expect, it } from 'vitest'
import { createInitialState, type Command, type GameConfig, type GameState } from '@worldwar/core'
import { TEST_RULES, placeArmy, smallWorld } from '@worldwar/testkit'
import { DEFAULT_COMMAND_DELAY, createLockstep, stateHash } from './lockstep'

/**
 * Die Gleichschritt-Maschine (T-M37-06, R-MP-03/AK1, D28.5, MEHRSPIELER.md §2).
 *
 * Ein Tick läuft, wenn beide Befehlslisten da sind, und sonst nicht — das ist das ganze
 * Verfahren. Was dieser Block prüft, ist genau das und nichts darüber hinaus: die
 * vollständige Partie über zweihundert Ticks ist T-M37-08, und sie ist der Beleg, der
 * zählt. Ein grüner Einzeltest sagt nichts über das Spiel.
 */

const map = smallWorld()
const ctx = { map, rules: TEST_RULES }

const config: GameConfig = {
  seed: 4711,
  mapId: map.id,
  rulesId: TEST_RULES.id,
  players: [
    { name: 'Nordland', kind: 'human', nation: 'Nordland', color: 'farbe-eins' },
    { name: 'Ostmark', kind: 'human', nation: 'Ostmark', color: 'farbe-zwei' },
    { name: 'Sueden', kind: 'ai', nation: 'Sueden', color: 'farbe-drei', difficulty: 'normal' },
  ],
  victory: { condition: 'points', pointsShareToWin: 700, dayLimit: null },
}

/**
 * Der Startzustand, beide Menschen mit je einer Armee.
 *
 * Nicht Zierde: die Kleine Welt gibt jeder Macht genau eine Stadt, also laesst sich die
 * Hauptstadt nicht verlegen — und ein Befehl, den der Kern ablehnt, belegt nicht, dass er
 * im richtigen Tick ANGEWANDT wurde. Eine Haltung ist billig, immer erlaubt und aendert
 * den Zustand sichtbar.
 *
 * Die Reihenfolge der Anlage ist fest, also ist der Stand auf beiden Seiten bitgleich.
 */
const frisch = (): GameState => {
  const state = createInitialState(config, ctx)
  placeArmy(state, { owner: 'p1', at: 'n1', units: [{ unitKey: 'infantry', hpTotal: 3000 }] })
  placeArmy(state, { owner: 'p2', at: 'o1', units: [{ unitKey: 'infantry', hpTotal: 3000 }] })
  return state
}

/** Die Armee einer Macht — die Kennungen vergibt der Zustand, nicht der Test. */
const armeeVon = (state: GameState, playerId: string): string =>
  state.armyOrder.find((id) => state.armies[id]!.owner === playerId)!

const maschine = (seat: string, state = frisch(), delayTicks?: number) =>
  createLockstep({
    seat,
    seats: ['p1', 'p2'],
    state,
    ctx,
    ...(delayTicks === undefined ? {} : { delayTicks }),
  })

/** Ein Befehl, den der Kern annimmt und der etwas am Zustand aendert. */
const haltung = (playerId: string, armyId: string, stance: 'defensive' | 'garrison'): Command => ({
  type: 'SET_STANCE',
  playerId,
  armyId,
  stance,
})

describe('R-MP-03/AK1 Ein Tick laeuft erst, wenn beide Listen da sind', () => {
  it('rechnet nichts, solange die Liste der Gegenseite fehlt', () => {
    const a = maschine('p1')
    const vorher = a.tick
    a.emit()

    expect(a.canStep()).toBe(false)
    expect(a.waitingFor()).toEqual(['p2'])
    const ergebnis = a.step()

    expect(ergebnis.ran).toBe(false)
    expect(ergebnis.waitingFor).toEqual(['p2'])
    expect(a.tick, 'die Uhr ist trotzdem gelaufen').toBe(vorher)
  })

  it('laeuft, sobald sie nachkommt — und nichts geht dabei verloren', () => {
    const a = maschine('p1')
    const b = maschine('p2')
    const vorher = a.tick
    a.emit()
    expect(a.canStep()).toBe(false)

    a.receive('p2', b.emit())

    expect(a.canStep()).toBe(true)
    expect(a.step().ran).toBe(true)
    expect(a.tick).toBe(vorher + 1)
  })

  it('sagt, worauf es wartet — und zwar namentlich', () => {
    // „Warte auf Mitspieler" ist nur dann eine Auskunft, wenn die Maschine den Platz
    // wirklich kennt; sonst ist es ein Satz, der immer stimmt.
    const a = maschine('p1')
    expect(a.waitingFor()).toEqual(['p1', 'p2'])
    a.emit()
    expect(a.waitingFor()).toEqual(['p2'])
    expect(a.status).toBe('waiting')
  })

  it('verschickt auch eine leere Liste — je Tick genau eine Nachricht', () => {
    // Eine ausgelassene leere Nachricht waere von einer abgerissenen Verbindung nicht zu
    // unterscheiden, und die Gegenseite wartete ewig.
    const a = maschine('p1')
    const nachricht = a.emit()

    expect(nachricht.kind).toBe('befehle')
    expect(nachricht.commands).toEqual([])
    expect(nachricht.tick).toBe(a.tick)
    expect(nachricht.hash).toBe(stateHash(a.state))
  })

  it('laesst einen Befehl, der jetzt gegeben wird, bei tick + 2 erscheinen', () => {
    const a = maschine('p1')
    const b = maschine('p2')
    const befehl = haltung('p1', armeeVon(a.state, 'p1'), 'defensive')
    const start = a.tick

    expect(a.give(befehl)).toBe(start + DEFAULT_COMMAND_DELAY)

    // Die Nachrichten der beiden naechsten Ticks tragen ihn noch nicht.
    for (let i = 0; i < DEFAULT_COMMAND_DELAY; i += 1) {
      const eigene = a.emit()
      expect(eigene.commands, `Tick ${start + i}`).toEqual([])
      a.receive('p2', b.emit())
      a.step()
      b.receive('p1', eigene)
      b.step()
    }

    const spaeter = a.emit()
    expect(spaeter.tick).toBe(start + DEFAULT_COMMAND_DELAY)
    expect(spaeter.commands).toEqual([befehl])
  })

  it('wendet den Befehl genau in dem Tick an, fuer den er gilt', () => {
    const a = maschine('p1', frisch(), 1)
    const b = maschine('p2', frisch(), 1)
    const armee = armeeVon(a.state, 'p1')
    a.give(haltung('p1', armee, 'defensive'))

    const lauf = () => {
      const von_a = a.emit()
      const von_b = b.emit()
      a.receive('p2', von_b)
      b.receive('p1', von_a)
      return [a.step(), b.step()] as const
    }

    const erster = lauf()
    expect(erster[0].applied).toEqual([])
    const zweiter = lauf()
    expect(zweiter[0].applied.map((c) => c.type)).toEqual(['SET_STANCE'])
    expect(a.state.armies[armee]!.stance).toBe('defensive')
    // Und die Gegenseite hat denselben Befehl im selben Tick angewandt.
    expect(zweiter[1].applied).toEqual(zweiter[0].applied)
    expect(stateHash(b.state)).toBe(stateHash(a.state))
  })

  it('haelt an, sobald der Kern eine entschiedene Partie nicht weiterrechnet', () => {
    // Nicht „bis in alle Ewigkeit leere Ticks": eine Partie, die vorbei ist, ist vorbei,
    // und die Maschine sagt es, statt stumm zu warten.
    const zustand = frisch()
    zustand.victory = { ...zustand.victory, winner: 'p1' }
    const a = maschine('p1', zustand)
    a.emit()
    a.receive('p2', { ...a.emit(), commands: [] })

    expect(a.step().ran).toBe(false)
    expect(a.status).toBe('finished')
  })
})
