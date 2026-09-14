import { describe, expect, it } from 'vitest'
import { advanceTicks } from '@worldwar/ai'
import { createInitialState, type Command, type GameConfig, type GameState, type PlayerId } from '@worldwar/core'
import { TEST_RULES, placeArmy, smallWorld } from '@worldwar/testkit'
import { createLockstep, orderCommands, stateHash, type Lockstep } from '../src/lockstep'
import { createLoopback } from '../src/loopback'
import { parseMessage, type CommandsMessage, type NetMessage } from '../src/protocol'

/**
 * Zwei Simulationen, zweihundert Ticks, eine Prüfsumme (T-M37-08, R-MP-03/AK3, D28.2).
 *
 * **Der Beleg, der zählt.** Ein grüner Einzeltest sagt nichts über das Spiel: `lockstep.test.ts`
 * zeigt, dass ein Tick wartet, `order.test.ts` zeigt die Sortierregel an vier Befehlen. Hier
 * laufen zwei vollständige Spiele gegeneinander — über ein Schleifendoppel, durch echtes
 * JSON, mit Befehlen von **beiden** Seiten und einem Computergegner dazwischen — und nach
 * **jedem** Tick muss `hashValue` beider Zustände gleich sein.
 *
 * Die Befehle sind mit Absicht nicht harmlos: beide Seiten teilen im selben Tick eine Armee,
 * und das Teilen nimmt die nächste Armeekennung aus einem Zähler, den sich beide Mächte
 * teilen (`nextIds.army`). Die Reihenfolge entscheidet also wirklich, und die Gegenprobe
 * unten zeigt es an derselben Lage: dieselben Befehle, verschieden sortiert, zwei Welten.
 */

const TICKS = 200
const map = smallWorld()
const ctx = { map, rules: TEST_RULES }

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

/** Derselbe Startzustand auf beiden Rechnern — dieselbe Folge, also bitgleich. */
function frisch(): GameState {
  const state = createInitialState(config, ctx)
  placeArmy(state, { owner: 'p1', at: 'n1', units: [{ unitKey: 'infantry', hpTotal: 12_000 }] })
  placeArmy(state, { owner: 'p1', at: 'n2', units: [{ unitKey: 'infantry', hpTotal: 4000 }] })
  placeArmy(state, { owner: 'p2', at: 'o1', units: [{ unitKey: 'infantry', hpTotal: 12_000 }] })
  placeArmy(state, { owner: 'p2', at: 'o2', units: [{ unitKey: 'infantry', hpTotal: 4000 }] })
  return state
}

/** Die stehenden Armeen einer Macht, in der Reihenfolge des Zustands. */
const stehende = (state: GameState, owner: PlayerId): string[] =>
  state.armyOrder.filter((id) => {
    const army = state.armies[id]
    return army?.owner === owner && army.path.length === 0
  })

/**
 * Was eine Seite in diesem Tick befiehlt.
 *
 * Drei Sorten, an verschiedenen Takten, damit sich die Lage wirklich bewegt:
 * eine Haltung (billig, immer erlaubt), ein Marsch (bewegt die Welt) und — der
 * eigentliche Punkt — ein **Teilen im selben Tick wie die Gegenseite**, das aus dem
 * gemeinsamen Zähler `nextIds.army` schöpft.
 */
function befehleFuer(state: GameState, owner: PlayerId, tick: number): Command[] {
  const out: Command[] = []
  const meine = stehende(state, owner)
  const erste = meine[0]
  const zweite = meine[1]

  if (tick % 5 === 0 && erste) {
    out.push({ type: 'SET_STANCE', playerId: owner, armyId: erste, stance: tick % 10 === 0 ? 'defensive' : 'garrison' })
  }
  if (tick % 20 === 0 && erste) {
    const stapel = state.armies[erste]!.units[0]
    if (stapel && stapel.hpTotal > 2000) {
      out.push({ type: 'SPLIT_ARMY', playerId: owner, armyId: erste, take: [{ unitKey: stapel.unitKey, hpTotal: 500 }] })
    }
  }
  if (tick % 31 === 0 && zweite) {
    // Die Nachbarn stehen im ZUSTAND, nicht in der Kartendatei: `MapProvince` kennt sie
    // nicht, und ein `?.neighbors` darauf ist stumm undefined — ein Marsch, den niemand
    // befiehlt, waere hier ein stiller Loch im Beleg.
    const heim = state.armies[zweite]!.locationProvinceId
    const nachbar = state.provinces[heim]?.neighbors[0]
    if (nachbar) out.push({ type: 'MOVE_ARMY', playerId: owner, armyId: zweite, targetProvinceId: nachbar })
  }
  if (tick % 37 === 0) {
    out.push({ type: 'TRADE', playerId: owner, give: 'food', giveAmount: 2000, want: 'money' })
  }
  return out
}

interface Seite {
  maschine: Lockstep
  gegeben: number
}

describe('R-MP-03/AK3 Zwei Simulationen halten ueber zweihundert Ticks dieselbe Pruefsumme', () => {
  it('laeuft zweihundert Ticks mit Befehlen beider Seiten und weicht nach keinem ab', () => {
    const leitung = createLoopback()
    const a: Seite = {
      maschine: createLockstep({ seat: 'p1', seats: ['p1', 'p2'], state: frisch(), ctx, delayTicks: 2 }),
      gegeben: 0,
    }
    const b: Seite = {
      maschine: createLockstep({ seat: 'p2', seats: ['p1', 'p2'], state: frisch(), ctx, delayTicks: 2 }),
      gegeben: 0,
    }

    // Der Briefträger: was das eine Ende sendet, sortiert das andere ein. Mehr tut der
    // Hostdienst später auch nicht (D28.2, „es gibt keinen Schiedsrichter").
    const alsBefehle = (message: NetMessage): CommandsMessage => {
      expect(message.kind).toBe('befehle')
      return message as CommandsMessage
    }
    leitung.b.onMessage((message) => b.maschine.receive('p1', alsBefehle(message)))
    leitung.a.onMessage((message) => a.maschine.receive('p2', alsBefehle(message)))

    expect(stateHash(a.maschine.state), 'die beiden Staende beginnen verschieden').toBe(
      stateHash(b.maschine.state),
    )

    const abweichung: string[] = []
    let gelaufen = 0

    for (let i = 0; i < TICKS; i += 1) {
      const tick = a.maschine.tick

      for (const befehl of befehleFuer(a.maschine.state, 'p1', tick)) {
        a.maschine.give(befehl)
        a.gegeben += 1
      }
      for (const befehl of befehleFuer(b.maschine.state, 'p2', tick)) {
        b.maschine.give(befehl)
        b.gegeben += 1
      }

      // Je Tick genau eine Nachricht von jeder Seite — auch wenn sie leer ist.
      leitung.a.send(a.maschine.emit())
      leitung.b.send(b.maschine.emit())

      const links = a.maschine.step()
      const rechts = b.maschine.step()
      if (!links.ran || !rechts.ran) break
      gelaufen += 1

      // Nach JEDEM Tick, nicht am Ende: ein Vergleich am Schluss saehe nicht, wann es
      // auseinanderging, und genau das ist die Frage, die hinterher niemand mehr
      // beantworten kann.
      const linkerHash = stateHash(a.maschine.state)
      const rechterHash = stateHash(b.maschine.state)
      if (linkerHash !== rechterHash) abweichung.push(`Tick ${links.tick}: ${linkerHash} vs ${rechterHash}`)
      expect(links.applied).toEqual(rechts.applied)
    }

    expect(abweichung, `Auseinandergelaufen:\n${abweichung.join('\n')}`).toEqual([])
    expect(gelaufen, 'die Partie ist vor dem zweihundertsten Tick zu Ende gegangen').toBe(TICKS)

    // Die Messzahlen des Laufs — ohne sie waere „200 Ticks, ein Hash" eine Behauptung.
    expect(a.gegeben, 'die erste Seite hat gar nichts befohlen').toBeGreaterThan(40)
    expect(b.gegeben, 'die zweite Seite hat gar nichts befohlen').toBeGreaterThan(40)
    expect(a.maschine.tick).toBe(TICKS)
    expect(b.maschine.tick).toBe(TICKS)
    // Es ist wirklich etwas passiert: geteilt wurde, und der gemeinsame Zaehler ist
    // gewandert. Ohne das waere der Gleichschritt an einer stehenden Welt belegt.
    expect(a.maschine.state.armyOrder.length).toBeGreaterThan(4)
    expect(a.maschine.state.nextIds.army).toBeGreaterThan(5)
    expect(a.maschine.state.nextIds).toEqual(b.maschine.state.nextIds)
  }, 120_000)

  it('schickt die Nachrichten wirklich durch JSON — und nur Befehle, nie Zustaende', () => {
    // Ein Doppel, das die Gegenstaende weiterreicht, verschwiege, dass etwas im Zustand
    // steckt, was den Weg ueber eine Leitung nicht uebersteht.
    const leitung = createLoopback()
    const gesehen: NetMessage[] = []
    leitung.b.onMessage((message) => gesehen.push(message))

    const a = createLockstep({ seat: 'p1', seats: ['p1', 'p2'], state: frisch(), ctx })
    a.give({ type: 'SET_STANCE', playerId: 'p1', armyId: stehende(a.state, 'p1')[0]!, stance: 'garrison' })
    leitung.a.send(a.emit())

    expect(gesehen).toHaveLength(1)
    const nachricht = gesehen[0]!
    expect(nachricht.kind).toBe('befehle')
    expect(parseMessage(JSON.parse(JSON.stringify(nachricht))).ok).toBe(true)
    // Kein Zustand auf der Leitung: nur Tick, Befehle und die Pruefsumme.
    expect(Object.keys(nachricht).sort()).toEqual(['commands', 'hash', 'kind', 'tick', 'version'])
  })

  it('meldet ein geschlossenes Ende, statt in einen Brunnen zu senden', () => {
    const leitung = createLoopback()
    const gruende: string[] = []
    leitung.b.onClose((grund) => gruende.push(grund))

    leitung.a.close('Mitspieler weg')

    expect(gruende).toEqual(['Mitspieler weg'])
    expect(leitung.a.closed).toBe(true)
    expect(leitung.b.closed).toBe(true)
    expect(() => leitung.a.send({ kind: 'ende', version: 1, reason: 'abbruch', tick: 0 })).toThrow(/geschlossen/)
    // Zweimal schliessen ist erlaubt und tut beim zweiten Mal nichts.
    expect(() => leitung.b.close()).not.toThrow()
    expect(gruende).toEqual(['Mitspieler weg'])
  })

  it('meldet einen abgemeldeten Hoerer nicht mehr', () => {
    const leitung = createLoopback()
    const gesehen: NetMessage[] = []
    const ab = leitung.b.onMessage((message) => gesehen.push(message))
    const abClose = leitung.b.onClose(() => gesehen.push({ kind: 'ende', version: 1, reason: 'abbruch', tick: 0 }))

    ab()
    abClose()
    leitung.a.send({ kind: 'pause', version: 1, art: 'antrag', abTick: 3 })
    leitung.a.close()

    expect(gesehen).toEqual([])
  })
})

/**
 * Die Gegenprobe (T-M37-08, „Fertig wenn") — und was sie wirklich zeigen kann.
 *
 * Der Plan verlangte: nimmt man die Sortierung aus T-M37-07 heraus, muss dieser Beleg
 * FALLEN. Er faellt nicht, und das ist ein **Befund und kein Versaeumnis** (PROBLEME.md,
 * Befund M37-1): `packages/core/src/phases/applyCommands.ts` sortiert die Befehle eines
 * Ticks seit M1 selbst nach `playerOrder` — die Zusage aus D28.5 war ueber Machtgrenzen
 * hinweg schon eingeloest, bevor `orderCommands` geschrieben wurde. Ein Test, der
 * behauptete, das Gegenteil zu zeigen, waere eine Luege ueber die eigene Reparatur.
 *
 * Was die Gegenprobe deshalb zeigt, ist das, was noch wirklich auf dem Spiel steht:
 *
 * 1. **Ueber Machtgrenzen hinweg sortiert der Kern.** Dieselben Befehle, vertauscht
 *    eingereicht, ergeben denselben Zustand — der Beleg fuer den Befund selbst.
 * 2. **Innerhalb einer Macht entscheidet die Reihenfolge, und sie wird NICHT sortiert.**
 *    Zwei Teilungen desselben Spielers, vertauscht, ergeben zwei verschiedene Welten.
 *    Genau diese Folge muss `orderCommands` erhalten — wer sie „aufraeumt" (nach
 *    Armeekennung, nach Befehlsart), zerstoert den Gleichschritt. Die Regel ist damit
 *    nicht redundant, sondern eine Zusage in die andere Richtung.
 */
describe('R-MP-03/AK3 Was die Reihenfolge traegt — und was der Kern schon traegt', () => {
  const teilen = (playerId: PlayerId, armyId: string): Command => ({
    type: 'SPLIT_ARMY',
    playerId,
    armyId,
    take: [{ unitKey: 'infantry', hpTotal: 500 }],
  })
  const einTick = (state: GameState, commands: readonly Command[]) =>
    advanceTicks(state, 1, ctx, { scripted: (tick) => (tick === state.tick ? [...commands] : []) })

  it('ergibt ueber Machtgrenzen hinweg denselben Zustand — der Kern sortiert selbst (Befund M37-1)', () => {
    const links = frisch()
    const rechts = frisch()
    const vonP1 = stehende(links, 'p1')[0]!
    const vonP2 = stehende(links, 'p2')[0]!

    const erst = einTick(links, [teilen('p1', vonP1), teilen('p2', vonP2)])
    const dann = einTick(rechts, [teilen('p2', vonP2), teilen('p1', vonP1)])

    expect(erst.state.armyOrder.length, 'es wurde gar nicht geteilt').toBe(6)
    expect(stateHash(dann.state)).toBe(stateHash(erst.state))
  })

  it('ergibt innerhalb einer Macht zwei verschiedene Welten — die Folge darf nicht sortiert werden', () => {
    const links = frisch()
    const rechts = frisch()
    const [erste, zweite] = stehende(links, 'p1')
    expect(erste && zweite, 'die Macht hat keine zwei stehenden Armeen').toBeTruthy()

    const so = einTick(links, [teilen('p1', erste!), teilen('p1', zweite!)])
    const andersherum = einTick(rechts, [teilen('p1', zweite!), teilen('p1', erste!)])

    expect(so.state.armyOrder.length).toBe(6)
    // Die neue Armee `a5` stammt je nach Folge aus einer anderen Quelle und steht
    // deshalb woanders: der gemeinsame Zaehler `nextIds.army` vergibt der Reihe nach.
    expect(so.state.armies['a5']!.locationProvinceId).not.toBe(
      andersherum.state.armies['a5']!.locationProvinceId,
    )
    expect(stateHash(andersherum.state)).not.toBe(stateHash(so.state))
  })

  it('erhaelt orderCommands genau diese Folge', () => {
    // Die Zusage des Gleichschritts an den Kern: umsortiert wird nach playerOrder, und
    // sonst nichts. Ein „Aufraeumen" innerhalb einer Macht waere der Fehler, den der
    // Test darueber sichtbar macht.
    const eins = teilen('p1', 'a1')
    const zwei = teilen('p1', 'a2')
    expect(orderCommands(['p1', 'p2'], [eins, zwei])).toEqual([eins, zwei])
    expect(orderCommands(['p1', 'p2'], [zwei, eins])).toEqual([zwei, eins])
  })
})
