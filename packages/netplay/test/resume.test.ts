import { describe, expect, it } from 'vitest'
import { createInitialState, type Command, type GameConfig, type GameState, type PlayerId } from '@worldwar/core'
import { TEST_RULES, placeArmy, smallWorld } from '@worldwar/testkit'
import { createLockstep, stateHash, type Lockstep } from '../src/lockstep'
import { createLoopback } from '../src/loopback'
import { parseMessage, type CommandsMessage, type NetMessage } from '../src/protocol'

/**
 * Pufferung und Wiederaufnahme nach Abbruch (T-M38-08, R-MP-07/AK1, D28.8).
 *
 * WLAN, Standby, ein versehentlich geschlossener Deckel — nichts davon darf eine Partie
 * kosten. Gefahren wird über das **Schleifendoppel** und durch echtes JSON, wie
 * `twoclients.test.ts`: was eine Leitung nicht überstünde, soll hier auffallen und nicht
 * am Abend.
 *
 * Der Abriss ist hier keine geschlossene Verbindung, sondern das, was eine abgerissene
 * Verbindung **tut**: Nachrichten verschwinden. Das ist der härtere Fall — eine
 * geschlossene Verbindung sagt wenigstens Bescheid.
 *
 * **Die eine Zusicherung, an der alles hängt** (`R-MP-07/AK1`, dritter Block): die
 * Trennung liegt genau **zwischen Senden und Ankommen**. Wer ab dem letzten *gesendeten*
 * Tick puffert, hält für zugestellt, was noch in der Leitung steckt; die Gegenseite wartet
 * für immer auf diese eine Liste, und beide stehen still. Im Test fällt das nie auf, wenn
 * man den Fall nicht ausdrücklich schreibt.
 */

const map = smallWorld()
const ctx = { map, rules: TEST_RULES }
const SEATS: readonly PlayerId[] = ['p1', 'p2']

const config: GameConfig = {
  seed: 1937,
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
  placeArmy(state, { owner: 'p1', at: 'n1', units: [{ unitKey: 'infantry', hpTotal: 12_000 }] })
  placeArmy(state, { owner: 'p2', at: 'o1', units: [{ unitKey: 'infantry', hpTotal: 12_000 }] })
  return state
}

/** Die stehenden Armeen einer Macht — für Befehle, die wirklich etwas ändern. */
const armeen = (state: GameState, owner: PlayerId): string[] =>
  state.armyOrder.filter((id) => state.armies[id]?.owner === owner)

/** Ein Haltungswechsel: billig, erlaubt, und er verschiebt die Prüfsumme. */
function befehlFuer(seite: Lockstep, owner: PlayerId, tick: number): Command | null {
  const id = armeen(seite.state, owner)[0]
  if (!id) return null
  return { type: 'SET_STANCE', playerId: owner, armyId: id, stance: tick % 2 === 0 ? 'defensive' : 'garrison' }
}

/**
 * Zwei Seiten an einem Schleifendoppel, mit einem Schalter für die Leitung.
 *
 * `live` aus heißt: was gesendet wird, geht wirklich hinaus und kommt nirgends an — genau
 * das, was ein toter WLAN-Adapter tut.
 */
function paar() {
  const wire = createLoopback()
  const a = createLockstep({ seat: 'p1', seats: SEATS, state: frisch(), ctx, delayTicks: 2 })
  const b = createLockstep({ seat: 'p2', seats: SEATS, state: frisch(), ctx, delayTicks: 2 })
  const angekommen = { a: 0, b: 0 }
  const verloren = { a: 0, b: 0 }
  let live = true

  const einsortieren = (ziel: Lockstep, von: PlayerId, roh: NetMessage): void => {
    const geprueft = parseMessage(roh)
    if (!geprueft.ok) throw new Error(geprueft.reason)
    if (geprueft.message.kind === 'befehle') ziel.receive(von, geprueft.message)
  }

  wire.b.onMessage((message) => {
    if (!live) return
    angekommen.b += 1
    einsortieren(b, 'p1', message)
  })
  wire.a.onMessage((message) => {
    if (!live) return
    angekommen.a += 1
    einsortieren(a, 'p2', message)
  })

  const senden = (von: 'a' | 'b', message: CommandsMessage): void => {
    if (!live) {
      verloren[von] += 1
      return
    }
    ;(von === 'a' ? wire.a : wire.b).send(message)
  }

  return {
    a,
    b,
    angekommen,
    verloren,
    trennen: (): void => {
      live = false
    },
    verbinden: (): void => {
      live = true
    },
    senden,
  }
}

/** Ein Schritt beider Seiten: erst senden, dann rechnen — wie der Takt der Hülle. */
function schritt(paare: ReturnType<typeof paar>, mitBefehlen = true): void {
  for (const [name, seite, owner] of [
    ['a', paare.a, 'p1'],
    ['b', paare.b, 'p2'],
  ] as const) {
    if (mitBefehlen && seite.tick % 3 === 0) {
      const befehl = befehlFuer(seite, owner, seite.tick)
      if (befehl) seite.give(befehl)
    }
    paare.senden(name, seite.emit())
  }
  paare.a.step()
  paare.b.step()
}

describe('R-MP-07/AK1 Die Partie uebersteht einen Verbindungsabbruch', () => {
  it('laeuft nach der Rueckkehr am selben Tick weiter, ohne dass ein Befehl fehlt', () => {
    const p = paar()
    for (let i = 0; i < 20; i += 1) schritt(p)
    const vorAbriss = p.a.tick

    expect(vorAbriss).toBe(20)
    expect(stateHash(p.a.state)).toBe(stateHash(p.b.state))

    // Zwoelf Schritte ins Leere: beide senden weiter, nichts kommt an, und die Uhren
    // stehen - genau das, was der Gleichschritt tun soll.
    p.trennen()
    for (let i = 0; i < 12; i += 1) schritt(p)

    expect(p.a.tick, 'die Partie ist waehrend des Abrisses weitergelaufen').toBe(vorAbriss)
    expect(p.a.status).toBe('waiting')
    expect(p.verloren.a).toBeGreaterThan(0)

    // Die Rueckkehr ist ein Nachliefern und kein Neuanfang.
    p.verbinden()
    for (const message of p.a.pending()) p.senden('a', message)
    for (const message of p.b.pending()) p.senden('b', message)
    for (let i = 0; i < 20; i += 1) schritt(p)

    expect(p.a.tick).toBe(40)
    expect(p.b.tick).toBe(40)
    expect(stateHash(p.a.state)).toBe(stateHash(p.b.state))
  })

  it('haelt fest, was noch nicht bestaetigt ist — und raeumt es weg, sobald es ankam', () => {
    const p = paar()
    for (let i = 0; i < 6; i += 1) schritt(p)

    // Sechs Runden: beide stehen bei Tick 6, ausgetauscht sind die Listen fuer 0 bis 5.
    // Die Nachricht der Gegenseite fuer Tick 5 bestaetigt alles BIS 4 - fuer 5 selbst
    // liegt noch keine Bestaetigung vor, denn sie kaeme erst mit der Nachricht fuer 6.
    // Es bleibt also genau eine offene Liste, und das ist die letzte gesendete.
    expect(p.a.tick).toBe(6)
    expect(p.a.confirmedThrough).toBe(4)
    expect(p.a.pending().map((m) => m.tick)).toEqual([5])
  })

  it('liefert die Liste nach, die zwischen Senden und Ankommen verlorenging', () => {
    // Der Fall, der im Betrieb der Normalfall ist: die Verbindung reisst NICHT in der
    // Pause zwischen zwei Nachrichten, sondern mitten in einer. Wer ab dem letzten
    // GESENDETEN Tick puffert, haelt sie fuer zugestellt - und beide stehen fuer immer.
    const p = paar()
    for (let i = 0; i < 8; i += 1) schritt(p)
    const strittig = p.a.tick

    // A sendet seine Liste fuer diesen Tick, und genau sie geht unterwegs verloren.
    p.trennen()
    const unterwegs = p.a.emit()
    p.senden('a', unterwegs)
    p.verbinden()

    // B sendet weiter und wartet - ohne A's Liste kann es diesen Tick nicht rechnen.
    p.senden('b', p.b.emit())
    p.b.step()

    expect(p.b.tick, 'B haette ohne A nicht rechnen duerfen').toBe(strittig)
    expect(p.b.waitingFor(strittig)).toEqual(['p1'])

    // Das Nachliefern MUSS diesen Tick enthalten. Er ist gesendet und nicht bestaetigt.
    const nachzuliefern = p.a.pending().map((m) => m.tick)
    expect(nachzuliefern, 'der verlorene Tick fehlt in der Nachlieferung').toContain(strittig)

    for (const message of p.a.pending()) p.senden('a', message)
    for (let i = 0; i < 5; i += 1) schritt(p)

    expect(p.a.tick).toBeGreaterThan(strittig)
    expect(p.b.tick).toBe(p.a.tick)
    expect(stateHash(p.a.state)).toBe(stateHash(p.b.state))
  })

  it('laesst sich gefahrlos zweimal nachliefern', () => {
    // Erneut zu senden darf nichts kosten: `put` legt je Tick und Platz genau eine
    // Nachricht ab. Nur deshalb darf die Huelle die Liste blind wiederholen, ohne zu
    // wissen, ob es ueberhaupt einen Abriss gab.
    const p = paar()
    for (let i = 0; i < 10; i += 1) schritt(p)
    const vorher = stateHash(p.a.state)

    for (let runde = 0; runde < 3; runde += 1) {
      for (const message of p.a.pending()) p.senden('a', message)
      for (const message of p.b.pending()) p.senden('b', message)
    }
    for (let i = 0; i < 10; i += 1) schritt(p)

    expect(stateHash(p.a.state)).toBe(stateHash(p.b.state))
    expect(stateHash(p.a.state)).not.toBe(vorher)
    expect(p.a.tick).toBe(20)
  })

  it('behaelt nach einem langen Abriss genau die unbestaetigten Ticks', () => {
    const p = paar()
    for (let i = 0; i < 5; i += 1) schritt(p)
    const abTick = p.a.tick

    p.trennen()
    for (let i = 0; i < 7; i += 1) schritt(p)

    // Waehrend des Abrisses stand die Uhr, also kommt nichts Neues dazu. Uebrig bleiben
    // genau ZWEI Listen, und die erste davon ist der Grund fuer diese ganze Aufgabe:
    // Tick 4 ist die letzte, die noch hinausging, bevor die Leitung starb - gesendet, aber
    // nie bestaetigt. Tick 5 ist die, an der beide seither warten. Wer ab dem letzten
    // GESENDETEN Tick puffert, liefert nur die 5 nach, und die Gegenseite wartet fuer
    // immer auf die 4.
    expect(p.a.pending().map((m) => m.tick)).toEqual([abTick - 1, abTick])
    expect(p.a.confirmedThrough).toBe(abTick - 2)
  })
})
