// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { createElement, type ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { advanceTicks } from '@worldwar/ai'
import { MemoryStorage, createInitialState, type Command, type GameConfig, type GameState } from '@worldwar/core'
import { createLockstep, createLoopback, stateHash, type Lockstep, type Transport } from '@worldwar/netplay'
import { TEST_RULES, placeArmy, smallWorld } from '@worldwar/testkit'
import { loadFrom, saveTo } from '../game/saves.ts'
import {
  RESEND_AFTER_MS,
  WAIT_NOTICE_AFTER_MS,
  takeOverSeat,
  useNetplay,
  type NetplayView,
} from './useNetplay.ts'

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

describe('R-MP-07/AK1 Die Huelle liefert nach, was nicht bestaetigt ist', () => {
  /**
   * Zwei Haken an einer Leitung, die sich durchtrennen lässt.
   *
   * Ein Abriss ist hier nicht „geschlossen", sondern das, was ein Abriss **tut**:
   * Nachrichten verschwinden, ohne dass jemand es merkt. Der Haken erfährt vom Abriss
   * nichts — und genau deshalb ist die Regel „wer wartet, wiederholt" und nicht „wer neu
   * verbindet, holt nach".
   */
  function durchtrennbar(speed = 50) {
    const leitung = createLoopback()
    let offen = true
    const verloren = { a: 0, b: 0 }

    const huelle = (seite: 'a' | 'b', echt: Transport): Transport => ({
      get closed() {
        return echt.closed
      },
      send: (message) => {
        if (!offen) {
          verloren[seite] += 1
          return
        }
        echt.send(message)
      },
      onMessage: (listener) => echt.onMessage(listener),
      onClose: (listener) => echt.onClose(listener),
      close: (reason) => echt.close(reason),
    })

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

    return {
      a: machen('p1', 'p2', huelle('a', leitung.a)),
      b: machen('p2', 'p1', huelle('b', leitung.b)),
      verloren,
      trennen: () => {
        offen = false
      },
      verbinden: () => {
        offen = true
      },
    }
  }

  it('holt die Partie nach einem Abriss von selbst ein', () => {
    const p = durchtrennbar()
    warte(400)
    expect(p.a.lockstep.tick).toBeGreaterThan(5)

    // Was schon angekommen war, wird noch verrechnet — ein Abriss macht die letzten
    // Nachrichten nicht ungeschehen. Danach steht die Uhr, und zwar wirklich.
    p.trennen()
    warte(1000)
    const vorAbriss = p.a.lockstep.tick
    warte(4000)

    expect(p.a.lockstep.tick, 'die Uhr lief ohne Gegenseite weiter').toBe(vorAbriss)
    expect(p.a.sicht.value?.waiting).toBe(true)
    expect(p.verloren.a).toBeGreaterThan(0)

    // Und die Rueckkehr braucht KEINEN Anstoss: der Takt wiederholt von selbst, was
    // nicht bestaetigt ist.
    p.verbinden()
    warte(RESEND_AFTER_MS + 400)

    expect(p.a.lockstep.tick, 'die Partie ist nach der Rueckkehr nicht weitergelaufen').toBeGreaterThan(
      vorAbriss,
    )
    expect(p.b.lockstep.tick).toBe(p.a.lockstep.tick)
    expect(stateHash(p.a.lockstep.state)).toBe(stateHash(p.b.lockstep.state))
  })

  it('verliert dabei keinen Befehl, der waehrend des Abrisses gegeben wurde', () => {
    // Der Befehl gilt fuer tick + 2 und faellt damit mitten in die Luecke. Er muss nach
    // der Rueckkehr wirken - sonst waere die Wiederaufnahme eine Bequemlichkeit und keine
    // Zusage.
    const p = durchtrennbar()
    warte(400)

    p.trennen()
    const armee = p.a.lockstep.state.armyOrder.find((id) => p.a.lockstep.state.armies[id]?.owner === 'p1')!
    act(() => p.a.sicht.value?.give({ type: 'SET_STANCE', playerId: 'p1', armyId: armee, stance: 'defensive' }))
    warte(3000)

    expect(p.a.getickt.befehle, 'der Befehl hat waehrend des Abrisses gewirkt').toHaveLength(0)

    p.verbinden()
    warte(RESEND_AFTER_MS + 600)

    expect(p.a.getickt.befehle.map((c) => c.type)).toContain('SET_STANCE')
    expect(p.b.getickt.befehle.map((c) => c.type)).toContain('SET_STANCE')
    expect(stateHash(p.a.lockstep.state)).toBe(stateHash(p.b.lockstep.state))
  })

  it('wiederholt nicht bei jedem Schlag, sondern hoechstens jede Sekunde', () => {
    // Wiederholen ist gefahrlos, aber nicht umsonst: bei Tempo 50 waeren das sonst
    // fuenfzig Nachrichten je Sekunde fuer nichts.
    const p = durchtrennbar()
    warte(400)
    p.trennen()
    warte(4000)

    // Gezaehlt werden die verlorenen Sendungen einer Seite: je Schlag eine eigene
    // Nachricht plus hoechstens eine Wiederholung je Sekunde - und nicht je Schlag.
    const schlaege = 4000 / 20
    expect(p.verloren.a).toBeLessThan(schlaege)
  })
})

/**
 * Ein Mitspieler, der nicht zurückkommt, wird zum Computergegner (T-M38-10, R-MP-08, D28.8).
 *
 * Kein Abend geht verloren, weil jemand ins Bett gegangen ist. Das geht **nur**, weil der
 * Zustand derselbe ist (D28.2): beide Rechner haben die ganze Welt im Speicher, also
 * braucht es zum Alleinweiterspielen ein geändertes Feld und sonst nichts — kein
 * Übertragen, kein Umrechnen, kein zweiter Spielstandstyp, **keine Zeile im Kern**.
 */
describe('R-MP-08/AK1 Der abwesende Spieler wird zum Computergegner', () => {
  it('setzt genau ein Feld und laesst alles andere stehen', () => {
    const vorher = frisch()
    const nachher = takeOverSeat(vorher, 'p2')

    expect(nachher.players['p2']!.kind).toBe('ai')
    expect(nachher.players['p1']!.kind, 'der verbleibende Spieler bleibt Mensch').toBe('human')
    // Alles ausser `kind` ist unveraendert - Name, Nation, Farbe, Rohstoffe, und vor allem
    // `difficulty`: ein Mensch hat keine, und `runAi` liest dann `normal`. Eine
    // Schwierigkeit zu erfinden hiesse, die Partie beim Uebernehmen heimlich zu aendern.
    expect({ ...nachher.players['p2'], kind: 'human' }).toEqual(vorher.players['p2'])
    expect(nachher.players['p2']!.difficulty).toBe(vorher.players['p2']!.difficulty)
  })

  it('gibt ein neues Objekt zurueck, statt am Zustand zu schrauben', () => {
    // Die Huelle haelt einen Spiegel neben dem Zustand; ein Feld, das nur an einem von
    // beiden geaendert wird, ist der Fehler aus T-M41-17.
    const vorher = frisch()
    const nachher = takeOverSeat(vorher, 'p2')

    expect(nachher).not.toBe(vorher)
    expect(vorher.players['p2']!.kind, 'der Ausgangszustand wurde veraendert').toBe('human')
  })

  it('laesst einen Platz in Ruhe, der schon ein Computergegner ist', () => {
    const einmal = takeOverSeat(frisch(), 'p3')
    expect(einmal.players['p3']!.kind).toBe('ai')
    expect(takeOverSeat(einmal, 'p3')).toBe(einmal)
  })

  it('laesst die uebernommene Macht wirklich handeln', () => {
    // Der Beleg, der zaehlt: nicht dass ein Feld steht, sondern dass die KI danach
    // Befehle gibt. `state.ai` hat fuer einen Menschen keinen Eintrag - der Laeufer legt
    // sich beim ersten Denken selbst ein Gedaechtnis an.
    const uebernommen = takeOverSeat(frisch(), 'p2')
    expect(uebernommen.ai['p2'], 'der Mensch hatte ein KI-Gedaechtnis').toBeUndefined()

    const lauf = advanceTicks(uebernommen, 240, ctx, {})

    expect(lauf.ticks).toBe(240)
    expect(lauf.state.ai['p2'], 'die uebernommene Macht hat nie gedacht').toBeDefined()
  })

  it('laeuft ohne Verbindung weiter — dieselbe Partie, ein Spieler weniger', () => {
    const zuZweit = frisch()
    const allein = takeOverSeat(zuZweit, 'p2')

    // Derselbe Ausgangspunkt: die Uebernahme aendert den Lauf nicht rueckwirkend.
    expect(allein.tick).toBe(zuZweit.tick)
    const lauf = advanceTicks(allein, 48, ctx, {})
    expect(lauf.state.tick).toBe(48)
    expect(stateHash(lauf.state)).not.toBe(stateHash(allein))
  })

  it('laesst sich speichern und fortsetzen wie jede andere Partie', async () => {
    // Der greifbarste Gewinn des Gleichschritts (D28.2): es ist wirklich derselbe
    // Zustand, und deshalb geht er durch denselben Spielstand wie jeder andere.
    const uebernommen = advanceTicks(takeOverSeat(frisch(), 'p2'), 24, ctx, {}).state
    const speicher = new MemoryStorage()
    await saveTo(speicher, 'stand', uebernommen, 'Uebernommen')
    const geladen = await loadFrom(speicher, 'stand')

    expect(geladen.ok).toBe(true)
    if (!geladen.ok) return
    expect(geladen.state.players['p2']!.kind, 'die Uebernahme hat den Spielstand nicht ueberlebt').toBe('ai')
    expect(stateHash(geladen.state)).toBe(stateHash(uebernommen))

    // Und sie laeuft weiter wie jede andere: derselbe Stand, derselbe naechste Tick.
    const weiter = advanceTicks(geladen.state, 24, ctx, {})
    expect(stateHash(weiter.state)).toBe(stateHash(advanceTicks(uebernommen, 24, ctx, {}).state))
  })
})

describe('R-MP-08/AK2 Ohne Klick geschieht nichts davon', () => {
  it('macht aus keinem Mitspieler von selbst einen Computergegner', () => {
    // Fuenf Minuten ohne Gegenseite: die Uhr steht, und der Platz bleibt menschlich. Die
    // Uebernahme ist ein bewusster Klick und passiert nie von selbst - auch nicht, wenn es
    // noch so bequem waere. Ein Spiel, das nach einer Weile allein entscheidet, wem die
    // Armeen gehoeren, ist kein Spiel zu zweit mehr.
    const leitung = createLoopback()
    const lockstep = createLockstep({ seat: 'p1', seats: ['p1', 'p2'], state: frisch(), ctx })
    const sicht = { value: null as NetplayView | null }
    render(
      createElement(Traeger, {
        session: { lockstep, transport: leitung.a, seat: 'p1', peer: 'p2' },
        speed: 50,
        sicht,
        getickt: { staende: [], befehle: [], hashes: [] },
      }),
    )

    warte(300_000)

    expect(sicht.value?.lost, 'der Hinweis ist nicht einmal erschienen').toBe(true)
    expect(lockstep.state.players['p2']!.kind, 'der Mitspieler wurde von selbst ersetzt').toBe('human')
    expect(lockstep.tick, 'die Uhr lief ohne den Mitspieler').toBe(0)
  })
})
