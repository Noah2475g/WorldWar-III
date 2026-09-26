// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { createElement, useEffect } from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { advanceTicks } from '@worldwar/ai'
import { createInitialState } from '@worldwar/core'
import { PROTOCOL_VERSION, createLoopback, stateHash, type NetMessage, type Transport } from '@worldwar/netplay'
import { TEST_RULES } from '@worldwar/testkit'
import type { GameConfig, GameState, MapData } from '@worldwar/core'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../App.tsx'
import { DEFAULT_NEW_GAME, toConfig } from '../game/newGame.ts'
import { configOfState, humanSeats, termsOf, useParty, type PartyView } from './party.ts'
import { parseNetLink } from './link.ts'

/**
 * Vom Link zur laufenden Partie (T-M39-02, T-M39-03, R-MP-12, D28.10).
 *
 * **Ein grüner Einzeltest sagt nichts über das Spiel.** Deshalb zweimal dasselbe, von
 * zwei Seiten: einmal als zwei Haken an einer Leitung, die die ganze Folge von fünf
 * Nachrichten durchlaufen und danach zweihundert Ticks gegeneinander rechnen — und einmal
 * als die **ganze Anwendung** in der Rolle des Gastes, mit einem Gastgeber daneben, der
 * ihr antwortet. Der erste Lauf belegt die Mechanik, der zweite, dass ein Mensch sie
 * erreicht.
 *
 * jsdom rechnet kein Layout und hängt `requestAnimationFrame` an `setInterval`; unter
 * `vi.useFakeTimers` wird rAF deshalb gestubbt, sonst treibt `advanceTimersByTime` die
 * ganze Spielschleife (WORKFLOW §4, Falle aus M22).
 */

const ROOT = process.cwd()
const world = JSON.parse(readFileSync(`${ROOT}/data/maps/world.json`, 'utf8')) as MapData
const testworld = JSON.parse(readFileSync(`${ROOT}/data/maps/testworld.json`, 'utf8')) as MapData
const maps = [
  { id: 'world', name: 'Welt', data: world },
  { id: 'testworld', name: 'Kleine Welt', data: testworld },
]
const mapById = (id: string): MapData => maps.find((entry) => entry.id === id)?.data ?? world

beforeAll(() => {
  // jsdom kennt weder Canvas noch ResizeObserver; die Karte zeichnet hier nichts, und das
  // ist in Ordnung — geprueft wird die Verdrahtung, nicht das Bild (wie in App.test.tsx).
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never
  HTMLCanvasElement.prototype.getContext = (() => null) as never
})

afterEach(cleanup)

/** Ein Träger, der `useParty` fährt und seine Sicht herausreicht — wie in useNetplay.test.ts. */
function Traeger({
  role,
  transport,
  sicht,
  savedState,
}: {
  role: 'host' | 'guest'
  transport: Transport
  sicht: { value: PartyView | null }
  /** Der eigene gespeicherte Stand — beim Gast die Haelfte des Vergleichs (T-M39-06). */
  savedState?: GameState | null
}) {
  const view = useParty({
    link: { role, room: 'raum1', secret: 'geheim' },
    connect: () => transport,
    origin: 'http://host:7749',
    mapById,
    rules: TEST_RULES,
    savedState: savedState ?? null,
  })
  useEffect(() => {
    sicht.value = view
  })
  sicht.value = view
  return null
}

/**
 * Ein Ende, wie der Hostdienst es wirklich bedient (Befund MP-2).
 *
 * Der Unterschied zu `createLoopback` ist genau einer, und er ist der ganze Befund:
 * **hier wird nichts gepuffert.** `Room.relay` schickt an die Plaetze, die GERADE besetzt
 * sind; wer in einen leeren Raum spricht, spricht ins Leere. `verhallt` zaehlt mit, damit
 * ein Test belegen kann, dass die Lage wirklich hergestellt war.
 */
class RaumEnde implements Transport {
  closed = false
  /** Wie viele eigene Nachrichten niemanden erreicht haben. */
  verhallt = 0
  private readonly listeners = new Set<(message: NetMessage) => void>()
  private readonly closeListeners = new Set<(reason: string) => void>()

  constructor(private readonly raum: Set<RaumEnde>) {
    raum.add(this)
  }

  send(message: NetMessage): void {
    let erreicht = 0
    for (const ende of this.raum) {
      if (ende === this || ende.closed) continue
      erreicht += 1
      for (const listener of [...ende.listeners]) listener(message)
    }
    if (erreicht === 0) this.verhallt += 1
  }

  onMessage(listener: (message: NetMessage) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  onClose(listener: (reason: string) => void): () => void {
    this.closeListeners.add(listener)
    return () => this.closeListeners.delete(listener)
  }

  close(reason = 'geschlossen'): void {
    if (this.closed) return
    this.closed = true
    this.raum.delete(this)
    for (const listener of this.closeListeners) listener(reason)
  }

  /** Den Platz raeumen, ohne die eigene Seite zu benachrichtigen — der Browser ist weg. */
  verlassen(): void {
    this.closed = true
    this.raum.delete(this)
  }
}

const partieOptionen = {
  ...DEFAULT_NEW_GAME,
  mode: 'multiplayer' as const,
  mapId: 'testworld',
  nation: testworld.startPositions[0]!.nation,
  opponents: 2,
  fixedSpeed: 25,
}

describe('R-MP-12/AK2 Vom Link zur Partie: fuenf Nachrichten, dann rechnet es', () => {
  it('laeuft die ganze Folge durch und uebergibt an den Gleichschritt', () => {
    const leitung = createLoopback()
    const gastgeber = { value: null as PartyView | null }
    const gast = { value: null as PartyView | null }

    render(createElement(Traeger, { role: 'host', transport: leitung.a, sicht: gastgeber }))
    render(createElement(Traeger, { role: 'guest', transport: leitung.b, sicht: gast }))

    // Der Gast hat sich angemeldet (hallo ohne Namen) - der Gastgeber sieht, dass jemand
    // da ist, bevor derjenige getippt hat. Das ist der halbe Zweck dieses Bildschirms.
    expect(gastgeber.value?.guestName, '„da, aber noch ohne Namen"').toBe('')
    expect(gast.value?.terms, 'der Gast sieht Bedingungen, die niemand geschickt hat').toBeNull()

    // Der Gastgeber legt die Partie an -> willkommen.
    const config = toConfig(partieOptionen, testworld)
    act(() => gastgeber.value!.offer(config, 25))

    // Erst JETZT kennt der Gast die Bedingungen - und zwar alle sechs (R-MP-12/AK1).
    const terms = gast.value?.terms
    expect(terms).not.toBeNull()
    expect(terms).toEqual({
      mapId: 'testworld',
      ownNation: config.players[1]!.nation,
      hostNation: config.players[0]!.nation,
      aiOpponents: 1,
      victory: 'points',
      fixedSpeed: 25,
    })

    // Der Gast traegt seinen Namen ein -> hallo mit Namen.
    act(() => gast.value!.join('Jonas'))
    expect(gastgeber.value?.guestName).toBe('Jonas')

    // Und erst der Start des Gastgebers loest den Handschlag aus (R-MP-12/AK2).
    expect(gastgeber.value?.phase, 'die Partie lief los, ohne dass jemand gestartet hat').toBe('lobby')
    expect(gast.value?.session).toBeNull()

    act(() => gastgeber.value!.begin())

    expect(gastgeber.value?.phase).toBe('playing')
    expect(gast.value?.phase).toBe('playing')
    expect(gastgeber.value?.seat).toBe('p1')
    expect(gast.value?.seat).toBe('p2')
  })

  it('gibt beiden Seiten denselben Startzustand — ohne dass einer ueber die Leitung ging', () => {
    // Der Kern von D28.2: uebertragen werden Befehle, nie Zustaende. Dass beide trotzdem
    // bitgleich anfangen, ist keine Hoffnung, sondern das, was die Probe gerade gemessen
    // hat - und hier steht die Zahl daneben.
    const leitung = createLoopback()
    const gastgeber = { value: null as PartyView | null }
    const gast = { value: null as PartyView | null }
    render(createElement(Traeger, { role: 'host', transport: leitung.a, sicht: gastgeber }))
    render(createElement(Traeger, { role: 'guest', transport: leitung.b, sicht: gast }))

    act(() => gastgeber.value!.offer(toConfig(partieOptionen, testworld), 25))
    act(() => gast.value!.join('Jonas'))
    act(() => gastgeber.value!.begin())

    const a = gastgeber.value!.start!
    const b = gast.value!.start!
    expect(stateHash(a.state)).toBe(stateHash(b.state))
    expect(a.mapId).toBe(b.mapId)
    expect(a.fixedSpeed).toBe(b.fixedSpeed)
    expect(a.seat).not.toBe(b.seat)

    // Und die Plaetze, die je Tick eine Nachricht schicken, sind auf beiden Seiten
    // dieselben zwei - die menschlichen, in Zustandsreihenfolge.
    expect(humanSeats(a.state)).toEqual(['p1', 'p2'])
  })

  it('haelt zweihundert Ticks lang dieselbe Pruefsumme', () => {
    // Was der Handschlag verspricht, wird hier eingeloest: die beiden uebergebenen
    // Gleichschritt-Maschinen rechnen gegeneinander, und nach JEDEM Tick wird verglichen.
    const leitung = createLoopback()
    const gastgeber = { value: null as PartyView | null }
    const gast = { value: null as PartyView | null }
    render(createElement(Traeger, { role: 'host', transport: leitung.a, sicht: gastgeber }))
    render(createElement(Traeger, { role: 'guest', transport: leitung.b, sicht: gast }))

    act(() => gastgeber.value!.offer(toConfig(partieOptionen, testworld), 25))
    act(() => gast.value!.join('Jonas'))
    act(() => gastgeber.value!.begin())

    const eins = gastgeber.value!.session!.lockstep
    const zwei = gast.value!.session!.lockstep
    eins.receive('p2', zwei.emit())
    zwei.receive('p1', eins.emit())

    let vergleiche = 0
    for (let tick = 0; tick < 200; tick += 1) {
      expect(eins.canStep(), `Tick ${tick} war nicht freigegeben`).toBe(true)
      eins.step()
      zwei.step()
      expect(stateHash(eins.state), `Tick ${tick}`).toBe(stateHash(zwei.state))
      vergleiche += 1
      eins.receive('p2', zwei.emit())
      zwei.receive('p1', eins.emit())
    }

    expect(vergleiche).toBe(200)
    expect(eins.tick).toBe(200)
    expect(eins.status).not.toBe('desynced')
  })

  it('bricht ab, wenn die Gegenseite ein anderes Spiel rechnet — statt es zu merken, wenn es zu spaet ist', () => {
    // Die Gegenprobe, die beissen muss: eine Willkommensnachricht mit einer fremden
    // Kartenpruefsumme darf keine Partie eroeffnen (R-MP-06/AK1).
    const leitung = createLoopback()
    const gast = { value: null as PartyView | null }
    render(createElement(Traeger, { role: 'guest', transport: leitung.b, sicht: gast }))

    act(() => {
      leitung.a.send({
        kind: 'willkommen',
        version: PROTOCOL_VERSION,
        config: toConfig(partieOptionen, testworld) as GameConfig,
        seat: 'p2',
        rulesHash: 'fremde-regeln-0000',
        mapHash: 'fremde-karte-0000',
        probeTicks: 24,
        fixedSpeed: 25,
      })
    })

    expect(gast.value?.phase).toBe('refused')
    expect(gast.value?.reason).toMatch(/Regelwerk/)
    expect(gast.value?.terms, 'abgewiesen und trotzdem Bedingungen gezeigt').toBeNull()
  })

  /**
   * Befund MP-2 (Sichtpruefung 2026-09-14, am laufenden Programm in zwei Fenstern).
   *
   * Oeffnet der GAST seinen Link zuerst, verhallt seine Anmeldung: der Hostdienst ist
   * Brieftraeger und kein Briefkasten, `Room.relay` schickt nur an Plaetze, die GERADE
   * besetzt sind. Danach warteten beide endlos — „Es wartet noch niemand" gegen „Der
   * Gastgeber legt die Partie gerade an" —, und nur ein Neuladen beim Gast half.
   *
   * **Kein Test konnte das sehen**, weil `createLoopback` puffert, was ankommt, bevor
   * jemand zuhoert. Deshalb steht hier ein zweites Doppel, das den Raum nachbildet.
   */
  it('findet zusammen, auch wenn der Gast seinen Link ZUERST oeffnet', () => {
    const raum = new Set<RaumEnde>()

    // Der Gast ist zuerst da und redet in einen leeren Raum.
    const gast = { value: null as PartyView | null }
    const gastEnde = new RaumEnde(raum)
    render(createElement(Traeger, { role: 'guest', transport: gastEnde, sicht: gast }))
    expect(gastEnde.verhallt, 'die erste Anmeldung muss ins Leere gehen').toBe(1)

    // Erst danach kommt der Gastgeber.
    const gastgeber = { value: null as PartyView | null }
    render(createElement(Traeger, { role: 'host', transport: new RaumEnde(raum), sicht: gastgeber }))

    expect(gastgeber.value?.guestName, 'der Gastgeber sieht nicht, dass jemand wartet').toBe('')

    // Und die Bedingungen erreichen den Gast, ohne dass er neu geladen hat.
    act(() => gastgeber.value!.offer(toConfig(partieOptionen, testworld), 25))
    expect(gast.value?.terms, 'der Gast wartet weiter auf Bedingungen, die nie kommen').not.toBeNull()

    // Und der Name kommt mit, wenn der Gastgeber sich spaeter noch einmal anmeldet
    // (er hat neu geladen): die zweite Anmeldung ist keine leere.
    act(() => gast.value!.join('Mitspieler Max'))
    for (const ende of [...raum]) if (ende !== gastEnde) ende.verlassen()
    const spaeter = { value: null as PartyView | null }
    render(createElement(Traeger, { role: 'host', transport: new RaumEnde(raum), sicht: spaeter }))
    expect(spaeter.value?.guestName).toBe('Mitspieler Max')
  })
})

/**
 * Und dasselbe an der ganzen Anwendung (T-M39-02, R-MP-12/AK1).
 *
 * Der Gast ist hier wirklich `<App>` — mit Karte, Regeln und ohne Spielstand, denn er hat
 * keinen. Daneben steht ein Gastgeber, der auf dem anderen Ende der Leitung antwortet.
 */
describe('R-MP-12/AK1 Der Beitrittsbildschirm zeigt, worauf man sich einlaesst', () => {
  let uhr = 0

  beforeEach(() => {
    uhr = 0
    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', () => 0)
    vi.stubGlobal('cancelAnimationFrame', () => undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  const warte = (ms: number) => {
    act(() => {
      uhr += ms
      vi.advanceTimersByTime(ms)
    })
  }

  /** Die Anwendung als Gast, mit einem Gastgeber am anderen Ende der Leitung. */
  function alsGast() {
    const leitung = createLoopback()
    const config = toConfig(partieOptionen, testworld)
    const gastgeber = { value: null as PartyView | null }

    render(createElement(Traeger, { role: 'host', transport: leitung.a, sicht: gastgeber }))
    render(
      <App
        map={world}
        rules={TEST_RULES}
        maps={maps}
        skipTutorial
        now={() => uhr}
        party={{
          link: parseNetLink('#/beitreten?raum=raum1&s=geheim')!,
          connect: () => leitung.b,
          origin: 'http://host:7749',
        }}
      />,
    )
    return { leitung, config, gastgeber }
  }

  it('nennt Karte, beide Nationen, Computergegner, Siegbedingung und die feste Rate', () => {
    const { config, gastgeber } = alsGast()
    act(() => gastgeber.value!.offer(config, 25))

    const dialog = screen.getByRole('dialog', { name: /Einladung/ })
    const text = dialog.textContent ?? ''

    expect(text, 'die Karte fehlt').toContain('Kleine Welt')
    expect(text, 'die eigene Nation fehlt').toContain(config.players[1]!.nation)
    expect(text, 'die Nation des Gastgebers fehlt').toContain(config.players[0]!.nation)
    expect(text, 'die Zahl der Computergegner fehlt').toMatch(/Computergegner: 1/)
    expect(text, 'die Siegbedingung fehlt').toMatch(/Siegbedingung: Punkte/)
    expect(text, 'die feste Rate fehlt').toMatch(/Feste Geschwindigkeit: 25/)
    // Und die Einschraenkung, die er sonst erst hinterher merkt (D28.2).
    expect(text).toMatch(/Schummelschutz/)
  })

  it('zeigt die Bedingungen VOR dem Namensfeld und sperrt den Knopf, solange keiner steht', () => {
    // „Dann Name eintragen und beitreten" (§3.7): die Reihenfolge ist die Zusage. Gemessen
    // an der Stellung im Baum, nicht an der Absicht.
    const { config, gastgeber } = alsGast()
    act(() => gastgeber.value!.offer(config, 25))

    const dialog = screen.getByRole('dialog', { name: /Einladung/ })
    const bedingungen = within(dialog).getByText(/Feste Geschwindigkeit: 25/)
    const feld = within(dialog).getByLabelText('Ihr Name')
    expect(
      bedingungen.compareDocumentPosition(feld) & Node.DOCUMENT_POSITION_FOLLOWING,
      'das Namensfeld steht vor den Bedingungen',
    ).toBeTruthy()

    const knopf = within(dialog).getByRole('button', { name: 'Beitreten' })
    expect((knopf as HTMLButtonElement).disabled, 'ein Gast ohne Namen waere ein leerer Platz').toBe(true)

    fireEvent.change(feld, { target: { value: 'Jonas' } })
    expect((knopf as HTMLButtonElement).disabled).toBe(false)
  })

  it('wartet ohne Spielstand — und ohne Anlegedialog, denn der Gast legt nichts an', () => {
    alsGast()

    expect(screen.queryByRole('button', { name: 'Partie beginnen' }), 'der Gast sah den Anlegedialog').toBeNull()
    expect(screen.getByRole('dialog', { name: /Einladung/ }).textContent).toMatch(/Gastgeber legt die Partie/)
  })

  it('spielt danach als p2 — mit der Nation des Gastes und der festen Rate', () => {
    const { config, gastgeber } = alsGast()
    act(() => gastgeber.value!.offer(config, 25))
    fireEvent.change(screen.getByLabelText('Ihr Name'), { target: { value: 'Jonas' } })
    fireEvent.click(screen.getByRole('button', { name: 'Beitreten' }))
    expect(gastgeber.value?.guestName).toBe('Jonas')

    act(() => gastgeber.value!.begin())
    warte(50)

    // Der Beitrittsbildschirm ist weg, die Karte ist da - und der Gast sieht SEINE Macht.
    expect(screen.queryByRole('dialog', { name: /Einladung/ })).toBeNull()
    const kopf = document.querySelector('.header')?.textContent ?? ''
    expect(kopf, 'die feste Rate steht nicht in der Kopfleiste').toContain('25')
    expect(document.body.textContent, 'der Gast sieht die Nation seines Gegners').toContain(
      config.players[1]!.nation,
    )
  })
})

describe('R-MP-12/AK1 Die Bedingungen kommen aus der Partiedefinition, nicht aus einem Formular', () => {
  it('liest sie aus der Willkommensnachricht, samt Siegbedingung und Rate', () => {
    const config = toConfig({ ...partieOptionen, victory: 'conquest' }, testworld)
    const terms = termsOf({
      kind: 'willkommen',
      version: PROTOCOL_VERSION,
      config,
      seat: 'p2',
      rulesHash: 'a',
      mapHash: 'b',
      probeTicks: 24,
      fixedSpeed: 5,
    })

    expect(terms.ownNation).toBe(config.players[1]!.nation)
    expect(terms.hostNation).toBe(config.players[0]!.nation)
    expect(terms.victory).toBe('conquest')
    expect(terms.fixedSpeed).toBe(5)
    expect(terms.aiOpponents).toBe(config.players.filter((p) => p.kind === 'ai').length)
  })
})

/**
 * Speichern und Fortsetzen zu zweit, in der Huelle (T-M39-06, R-MP-13, D28.11).
 *
 * Der Mechanismus selbst — Vergleich, Uebertragung, erneute Pruefung — steht in
 * `packages/netplay/test/resume-save.test.ts` und ist dort auf der Weltkarte ueber
 * dreissig Spieltage gemessen. **Hier geht es um die Verdrahtung:** dass ein Gastgeber
 * einen geladenen Stand wirklich anbieten kann und dass ein Gast mit einem anderen Stand
 * danach beim Stand des Gastgebers landet. Ohne diesen Lauf waere das Fortsetzen gebaut
 * und nicht erreichbar — die Fehlerklasse, fuer die es den Erreichbarkeits-Waechter gibt.
 */
describe('R-MP-13/AK1 Ein geladener Stand wird angeboten, nicht heimlich verschickt', () => {
  /**
   * Zwei Haken an einer Leitung, und ein Schnueffler, der zaehlt, was der Gastgeber
   * schickt.
   *
   * Der Schnueffler wird NACH den Haken angemeldet: das Schleifendoppel reicht seinen
   * Puffer dem ersten Hoerer weiter, und wer sich vordraengt, nimmt dem Gast seine
   * Willkommensnachricht weg.
   */
  const paar = (gastStand: GameState | null = null) => {
    const leitung = createLoopback()
    const gastgeber = { value: null as PartyView | null }
    const gast = { value: null as PartyView | null }
    render(createElement(Traeger, { role: 'host', transport: leitung.a, sicht: gastgeber }))
    render(
      createElement(Traeger, { role: 'guest', transport: leitung.b, sicht: gast, savedState: gastStand }),
    )
    const vomGastgeber: string[] = []
    leitung.b.onMessage((message) => vomGastgeber.push(message.kind))
    return { gastgeber, gast, leitung, vomGastgeber }
  }

  /** Ein Stand, der ein paar Spielstunden alt ist — die Testkarte, damit es schnell geht. */
  const gespielt = (ticks: number) => {
    const config = toConfig(partieOptionen, testworld)
    return advanceTicks(createInitialState(config, { map: testworld, rules: TEST_RULES }), ticks, {
      map: testworld,
      rules: TEST_RULES,
    }, {}).state
  }

  it('laesst beide weiterspielen, wenn die Staende gleich sind — ohne Uebertragung', () => {
    // Der Normalfall eines zweiten Abends: beide haben denselben Stand gesichert. Dann
    // geht KEIN Zustand ueber die Leitung, und genau das wird gezaehlt.
    const stand = gespielt(48)
    const { gastgeber, gast, vomGastgeber } = paar(gespielt(48))

    act(() => gastgeber.value!.offer(configOfState(stand), 25, stand))
    act(() => gast.value!.join('Jonas'))
    act(() => gastgeber.value!.begin())

    expect(gastgeber.value?.phase).toBe('playing')
    expect(gast.value?.phase, 'der Gast ist nicht mitgekommen').toBe('playing')
    expect(vomGastgeber, 'ein Zustand ging ueber die Leitung, obwohl beide denselben hatten').not.toContain(
      'zustand',
    )
    expect(vomGastgeber, 'der Handschlag hat gar nicht stattgefunden').toContain('probe')
    expect(stateHash(gast.value!.start!.state)).toBe(stateHash(stand))
  })

  it('uebertraegt den Stand des Gastgebers, wenn der Gast einen anderen hat', () => {
    const standDesHosts = gespielt(48)
    const { gastgeber, gast, vomGastgeber } = paar(gespielt(24))

    act(() => gastgeber.value!.offer(configOfState(standDesHosts), 25, standDesHosts))
    act(() => gast.value!.join('Jonas'))
    act(() => gastgeber.value!.begin())

    // Der Gast hatte einen aelteren Stand (Tick 24) und landet trotzdem bei dem des
    // Gastgebers - ueber genau eine `zustand`-Nachricht.
    expect(vomGastgeber.filter((kind) => kind === 'zustand')).toHaveLength(1)
    expect(gast.value?.phase).toBe('playing')
    expect(gast.value?.start?.state.tick, 'der Gast spielt bei Tick 0 weiter').toBe(48)
    expect(stateHash(gast.value!.start!.state)).toBe(stateHash(standDesHosts))
    expect(stateHash(gastgeber.value!.start!.state)).toBe(stateHash(standDesHosts))
  })

  it('liest die Partiedefinition aus dem Stand, statt eine zweite Wahrheit anzulegen', () => {
    const stand = gespielt(48)
    const config = configOfState(stand)

    expect(config.mapId).toBe(stand.mapId)
    expect(config.seed).toBe(stand.seed)
    expect(config.players.map((p) => p.nation)).toEqual(stand.playerOrder.map((id) => stand.players[id]!.nation))
    expect(config.players.map((p) => p.kind)).toEqual(stand.playerOrder.map((id) => stand.players[id]!.kind))
    expect(config.victory.condition).toBe(stand.victory.condition)
    // Und sie erzeugt NICHT denselben Zustand wieder: der Anfang ist nicht der 48. Tick.
    const neu = createInitialState(config, { map: testworld, rules: TEST_RULES })
    expect(neu.tick).toBe(0)
    expect(stateHash(neu)).not.toBe(stateHash(stand))
  })
})
