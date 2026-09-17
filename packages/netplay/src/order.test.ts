import { describe, expect, it } from 'vitest'
import { createInitialState, type Command, type GameConfig, type GameState } from '@worldwar/core'
import { TEST_RULES, placeArmy, smallWorld } from '@worldwar/testkit'
import { createLockstep, orderCommands, stateHash } from './lockstep'

/**
 * Die Befehlsreihenfolge ist ohne Schiedsrichter eindeutig (T-M37-07, R-MP-03/AK2, D28.5).
 *
 * **Die Falle, an der Gleichschritt scheitert:** zwei Seiten wenden dieselben Befehle in
 * verschiedener Reihenfolge an und laufen auseinander, ohne dass jemand einen Fehler
 * gemacht hat. Die Eingangsreihenfolge taugt dafür nicht — sie hängt daran, wer zuerst
 * geschickt hat, und das wechselt von Tick zu Tick.
 *
 * Sortiert wird nach der Stellung des Spielers in `state.playerOrder`; innerhalb eines
 * Spielers bleibt seine eigene Folge erhalten. `playerOrder` ist ein ausdrückliches Feld
 * und keine Schlüsselreihenfolge (`state/types.ts`, Regel 3) — genau dafür gibt es es.
 */

const map = smallWorld()
const ctx = { map, rules: TEST_RULES }

const config: GameConfig = {
  seed: 1848,
  mapId: map.id,
  rulesId: TEST_RULES.id,
  players: [
    { name: 'Nordland', kind: 'human', nation: 'Nordland', color: 'farbe-eins' },
    { name: 'Ostmark', kind: 'human', nation: 'Ostmark', color: 'farbe-zwei' },
    { name: 'Sueden', kind: 'ai', nation: 'Sueden', color: 'farbe-drei', difficulty: 'normal' },
  ],
  victory: { condition: 'points', pointsShareToWin: 700, dayLimit: null },
}

const frisch = (): GameState => {
  const state = createInitialState(config, ctx)
  placeArmy(state, { owner: 'p1', at: 'n1', units: [{ unitKey: 'infantry', hpTotal: 3000 }] })
  placeArmy(state, { owner: 'p1', at: 'n2', units: [{ unitKey: 'infantry', hpTotal: 2000 }] })
  placeArmy(state, { owner: 'p2', at: 'o1', units: [{ unitKey: 'infantry', hpTotal: 3000 }] })
  return state
}

/** Ein erkennbarer Befehl: die Kennung steckt in der Armee, damit die Folge lesbar bleibt. */
const marke = (playerId: string, armyId: string): Command => ({
  type: 'SET_STANCE',
  playerId,
  armyId,
  stance: 'defensive',
})

describe('R-MP-03/AK2 Die Reihenfolge ergibt sich allein aus playerOrder', () => {
  const ordnung = ['p1', 'p2', 'p3']
  const a1 = marke('p1', 'a1')
  const a2 = marke('p1', 'a2')
  const b1 = marke('p2', 'b1')
  const b2 = marke('p2', 'b2')

  it('ergibt bei vertauschter Eingangsreihenfolge dieselbe Anwendungsreihenfolge', () => {
    const so = orderCommands(ordnung, [a1, a2, b1, b2])
    const andersherum = orderCommands(ordnung, [b1, b2, a1, a2])
    const durchmischt = orderCommands(ordnung, [b1, a1, b2, a2])

    expect(so).toEqual([a1, a2, b1, b2])
    expect(andersherum).toEqual(so)
    expect(durchmischt).toEqual(so)
  })

  it('behaelt innerhalb eines Spielers dessen eigene Folge', () => {
    // Zwei Befehle desselben Spielers dürfen NICHT umsortiert werden: „erst anhalten,
    // dann Garnison" ist etwas anderes als andersherum.
    expect(orderCommands(ordnung, [a2, a1])).toEqual([a2, a1])
    expect(orderCommands(ordnung, [b1, a2, a1])).toEqual([a2, a1, b1])
  })

  it('folgt der Stellung im Zustand, nicht der Kennung', () => {
    // Waere die Regel „alphabetisch nach playerId", faende dieser Test nichts. Dieselben
    // Befehle, umgekehrte playerOrder — und die Reihenfolge dreht sich mit.
    expect(orderCommands(['p2', 'p1'], [a1, b1])).toEqual([b1, a1])
  })

  it('haengt eine unbekannte Kennung hinten an, in Eingangsreihenfolge', () => {
    // Der Kern lehnt sie ohnehin ab — aber die REIHENFOLGE muss auch dann auf beiden
    // Seiten dieselbe sein, sonst haengt das Ergebnis daran, wer zuerst geschickt hat.
    const fremd = marke('p99', 'x1')
    expect(orderCommands(ordnung, [fremd, a1])).toEqual([a1, fremd])
    expect(orderCommands(ordnung, [a1, fremd])).toEqual([a1, fremd])
  })

  it('haengt nichts an, wo nichts ist', () => {
    expect(orderCommands(ordnung, [])).toEqual([])
    expect(orderCommands([], [a1, b1])).toEqual([a1, b1])
  })

  it('gibt beiden Maschinen dieselbe Folge, auch wenn die Nachrichten verschieden ankommen', () => {
    // Der Fall, den die Regel wirklich abwehrt: A bekommt erst die eigene Liste und dann
    // die fremde, B umgekehrt. Ohne Sortierung waeren das zwei verschiedene Welten.
    const a = createLockstep({ seat: 'p1', seats: ['p1', 'p2'], state: frisch(), ctx, delayTicks: 1 })
    const b = createLockstep({ seat: 'p2', seats: ['p1', 'p2'], state: frisch(), ctx, delayTicks: 1 })

    const armeenVonP1 = a.state.armyOrder.filter((id) => a.state.armies[id]!.owner === 'p1')
    const armeeVonP2 = a.state.armyOrder.find((id) => a.state.armies[id]!.owner === 'p2')!
    a.give(marke('p1', armeenVonP1[0]!))
    a.give(marke('p1', armeenVonP1[1]!))
    b.give(marke('p2', armeeVonP2))

    // Ein Leertick, damit die Befehle faellig werden.
    const vonA0 = a.emit()
    const vonB0 = b.emit()
    a.receive('p2', vonB0)
    b.receive('p1', vonA0)
    a.step()
    b.step()

    const vonA = a.emit()
    const vonB = b.emit()
    // A sortiert die eigene Liste zuerst ein, B die fremde — die Reihenfolge des
    // Eingangs ist auf den beiden Rechnern verschieden.
    a.receive('p2', vonB)
    b.receive('p1', vonA)

    const links = a.step()
    const rechts = b.step()

    expect(links.applied.length).toBe(3)
    expect(links.applied).toEqual(rechts.applied)
    expect(links.applied.map((c) => c.playerId)).toEqual(['p1', 'p1', 'p2'])
    expect(stateHash(a.state)).toBe(stateHash(b.state))
  })
})
