import { describe, expect, it } from 'vitest'
import { createInitialState, deserialise, serialise, type GameConfig, type GameState } from '@worldwar/core'
import { TEST_RULES, placeArmy, smallWorld } from '@worldwar/testkit'
import { canonicalOf, createLockstep, stateHash, type Lockstep } from '../src/lockstep'

/**
 * Auseinanderlaufen wird erkannt, gemeldet und hält an (T-M37-09, R-MP-04, D28.6).
 *
 * Zwei Welten, die sich auseinanderentwickeln, sind schlimmer als ein Abbruch: hinterher
 * kann niemand mehr sagen, welche die richtige war. Jede Befehlsnachricht trägt deshalb
 * die Prüfsumme des zuletzt gerechneten Ticks; weichen sie ab, wird **kein** weiterer Tick
 * gerechnet, und der strittige Tick steht im Befund.
 */

const map = smallWorld()
const ctx = { map, rules: TEST_RULES }

const config: GameConfig = {
  seed: 2026,
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

const paar = () => ({
  a: createLockstep({ seat: 'p1', seats: ['p1', 'p2'], state: frisch(), ctx, delayTicks: 1 }),
  b: createLockstep({ seat: 'p2', seats: ['p1', 'p2'], state: frisch(), ctx, delayTicks: 1 }),
})

/** Ein Tick: beide schicken, beide sortieren ein, beide rechnen. */
function tick(a: Lockstep, b: Lockstep) {
  const vonA = a.emit()
  const vonB = b.emit()
  a.receive('p2', vonB)
  b.receive('p1', vonA)
  return [a.step(), b.step()] as const
}

describe('R-MP-04/AK1 Ein Auseinanderlaufen haelt die Partie an und nennt den Tick', () => {
  it('rechnet keinen Tick mehr, sobald die Pruefsummen abweichen', () => {
    const { a, b } = paar()
    // Erst zwei Ticks im Gleichschritt — sonst belegte der Test nur, dass zwei
    // verschiedene Staende verschieden sind.
    tick(a, b)
    tick(a, b)
    expect(stateHash(a.state)).toBe(stateHash(b.state))
    const heiler = a.tick

    // Eine Seite wird kuenstlich verfaelscht: genau das, was ein Rechenfehler, ein
    // anderer Regelstand oder ein geschummelter Klient anrichten wuerde.
    a.state.players['p1']!.resources.food += 1000

    const [links, rechts] = tick(a, b)

    expect(links.ran, 'die verfaelschte Seite hat weitergerechnet').toBe(false)
    expect(rechts.ran, 'die heile Seite hat weitergerechnet').toBe(false)
    expect(a.tick).toBe(heiler)
    expect(b.tick).toBe(heiler)
    expect(a.status).toBe('desynced')
    expect(b.status).toBe('desynced')
  })

  it('nennt beiden Spielern denselben Tick — und den Platz, dessen Zahl abweicht', () => {
    const { a, b } = paar()
    tick(a, b)
    const strittig = a.tick
    a.state.players['p1']!.resources.iron += 1

    tick(a, b)

    expect(a.desync).not.toBeNull()
    expect(b.desync).not.toBeNull()
    expect(a.desync!.tick).toBe(strittig)
    expect(b.desync!.tick).toBe(strittig)
    // Jede Seite zeigt auf die andere, und die beiden Zahlen sind ueber Kreuz dieselben.
    expect(a.desync!.seat).toBe('p2')
    expect(b.desync!.seat).toBe('p1')
    expect(a.desync!.own).toBe(b.desync!.other)
    expect(a.desync!.other).toBe(b.desync!.own)
    expect(a.desync!.own).not.toBe(a.desync!.other)
  })

  it('sagt das Ende mit dem strittigen Tick an', () => {
    const { a, b } = paar()
    tick(a, b)
    const strittig = a.tick
    a.state.market.prices.food += 1
    tick(a, b)

    const ende = a.endMessage()
    expect(ende.kind).toBe('ende')
    expect(ende.reason).toBe('auseinandergelaufen')
    expect(ende.tick).toBe(strittig)
  })

  it('laeuft ohne Verfaelschung weiter — die Gegenprobe', () => {
    // Ohne diese Zeile belegte der Block nur, dass ein Vergleich irgendwann anschlaegt.
    const { a, b } = paar()
    for (let i = 0; i < 12; i += 1) {
      const [links, rechts] = tick(a, b)
      expect(links.ran && rechts.ran, `Tick ${i}`).toBe(true)
    }
    expect(a.desync).toBeNull()
    expect(b.desync).toBeNull()
    // Nach dem letzten Tick wartet die Maschine wieder — auf die Nachrichten des
    // naechsten. „wartend" ist der gesunde Zustand, „getrennt" waere der kranke.
    expect(a.status).toBe('waiting')
    expect(a.tick).toBe(12)
  })

  it('haelt auch dann an, wenn die Verfaelschung von der Gegenseite kommt', () => {
    const { a, b } = paar()
    tick(a, b)
    b.state.players['p2']!.resources.money += 5

    tick(a, b)

    expect(a.status).toBe('desynced')
    expect(b.status).toBe('desynced')
  })
})

describe('R-MP-04/AK2 Nach dem Anhalten laesst sich jeder Stand sichern', () => {
  it('gibt jede Seite einen Spielstand her, der sich speichern und wieder lesen laesst', () => {
    const { a, b } = paar()
    tick(a, b)
    a.state.players['p1']!.resources.coal += 250
    tick(a, b)

    const links = a.snapshot()
    const rechts = b.snapshot()

    expect(links.tick).toBe(rechts.tick)
    expect(links.hash).not.toBe(rechts.hash)

    // Ein Stand ist nur dann gesichert, wenn er den Weg durch die Speicherung uebersteht.
    for (const stand of [links, rechts]) {
      const wieder = deserialise(serialise(stand.state, 'Auseinandergelaufen'))
      expect(stateHash(wieder)).toBe(stand.hash)
    }
  })

  it('macht mit canonicalText sichtbar, WO die Welten sich trennen', () => {
    // Die Pruefsumme sagt nur, DASS sie es tun. `canonicalText` gibt es seit M1 und wurde
    // nie gebraucht; das hier ist der Fall, fuer den es gebaut wurde — lokal, freiwillig,
    // nicht im Spielfluss.
    const { a, b } = paar()
    tick(a, b)
    a.state.players['p1']!.resources.coal += 250
    tick(a, b)

    const links = canonicalOf(a.state)
    const rechts = canonicalOf(b.state)

    expect(links).not.toBe(rechts)
    // Und der Unterschied ist genau der verfaelschte Wert, nicht irgendeiner.
    const stelle = [...links].findIndex((zeichen, index) => zeichen !== rechts[index])
    expect(stelle).toBeGreaterThan(0)
    expect(links.slice(Math.max(0, stelle - 60), stelle + 20)).toContain('coal')
  })

  it('liest aus dem Protokoll nichts in die Pruefsumme hinein', () => {
    // `eventLog` steht in HASH_OMIT_KEYS: zwei Staende, die sich nur im Protokoll
    // unterscheiden, sind DIESELBE Welt — sonst haette jede Ablehnung eine Partie beendet.
    const { a, b } = paar()
    tick(a, b)
    a.state.eventLog.push({
      ...a.state.eventLog[0]!,
      tick: a.tick,
    })

    const [links, rechts] = tick(a, b)

    expect(links.ran && rechts.ran).toBe(true)
    expect(a.desync).toBeNull()
  })
})
