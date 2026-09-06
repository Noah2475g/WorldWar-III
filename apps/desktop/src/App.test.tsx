// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryStorage, type MapData } from '@worldwar/core'
import { serialise } from '@worldwar/core'
import { startGame as neueGameState, DEFAULT_NEW_GAME } from './game/newGame.ts'
import { manualSlotName } from './game/saves.ts'
import { TEST_RULES } from '@worldwar/testkit'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { App } from './App.tsx'

/**
 * The assembled game (T-M10-03 … T-M10-12).
 *
 * Everything below this file is tested as a pure function; this checks that the pieces
 * are actually wired to each other — that starting a game produces a header with real
 * numbers in it, that a keystroke reaches the clock, and that a dialogue can be left
 * again. Those are the failures that unit tests cannot see and a screenshot cannot
 * prove.
 */

// jsdom does not give import.meta.url a file: scheme; vitest runs from the repo root.
const ROOT = process.cwd()
const world = JSON.parse(readFileSync(`${ROOT}/data/maps/world.json`, 'utf8')) as MapData
const maps = [{ id: 'world', name: 'Welt', provinces: world.provinces.length }]

beforeAll(() => {
  // jsdom has no canvas and no ResizeObserver; the map draws nothing here, which is
  // fine — what is under test is the wiring, and the drawing has its own budget test.
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never
  HTMLCanvasElement.prototype.getContext = (() => null) as never
})

afterEach(cleanup)

/**
 * A started game, with the guided introduction switched off.
 *
 * Every test below this line is about something else, and a hint box that talks about
 * provinces and speeds would put its words into their text searches.
 */
const startGame = (extra: Partial<Parameters<typeof App>[0]> = {}) => {
  render(<App map={world} rules={TEST_RULES} maps={maps} skipTutorial {...extra} />)
  fireEvent.click(screen.getByRole('button', { name: 'Partie beginnen' }))
}

describe('R-UI-03 Die Partie startet', () => {
  it('zeigt vor dem Start den Dialog', () => {
    render(<App map={world} rules={TEST_RULES} maps={maps} />)

    expect(screen.getByRole('dialog', { name: 'Neue Partie' })).toBeTruthy()
    expect(screen.getByText('Die Welt wird aufgebaut …')).toBeTruthy()
  })

  it('weist den KI-Bonus offen aus', () => {
    // R-AI-02: a player who loses should be able to see whether they were outplayed
    // or out-multiplied.
    render(<App map={world} rules={TEST_RULES} maps={maps} />)

    expect(screen.getByText(/ohne Bonus/)).toBeTruthy()
  })

  it('zeigt nach dem Start Kopfleiste, Karte und Ereignisleiste', () => {
    startGame()

    expect(screen.getByRole('group', { name: 'Geschwindigkeit' })).toBeTruthy()
    expect(screen.getByRole('application', { name: 'Weltkarte' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Ereignisse' })).toBeTruthy()
  })

  it('zeigt echte Rohstoffzahlen statt Platzhalter', () => {
    startGame()

    const resources = screen.getByRole('list', { name: 'Rohstoffe' })
    expect(within(resources).getByText('Nahrung')).toBeTruthy()
    // The starting stock from the rules, formatted — not a dash and not raw fixed-point.
    expect(within(resources).queryByText('—')).toBeNull()
    expect(resources.textContent).toMatch(/\d\.\d{3}/)
  })

  it('nennt Tag und Uhrzeit', () => {
    startGame()

    expect(screen.getByText(/Tag 1 · 00:00/)).toBeTruthy()
  })
})

describe('R-UI-06 Bedienung ohne Maus', () => {
  it('startet und stoppt die Zeit mit der Leertaste', () => {
    startGame()
    const speeds = screen.getByRole('group', { name: 'Geschwindigkeit' })
    const pressed = () =>
      within(speeds)
        .getAllByRole('button')
        .find((button) => button.getAttribute('aria-pressed') === 'true')?.textContent

    expect(pressed()).toBe('‖')

    fireEvent.keyDown(window, { key: ' ' })
    expect(pressed()).not.toBe('‖')

    fireEvent.keyDown(window, { key: ' ' })
    expect(pressed()).toBe('‖')
  })

  it('wechselt den Kartenmodus mit M', () => {
    startGame()
    const select = screen.getByRole('combobox', { name: 'Kartenmodus' }) as HTMLSelectElement

    expect(select.value).toBe('political')
    fireEvent.keyDown(window, { key: 'm' })
    expect(select.value).toBe('resources')
  })

  it('oeffnet die Tastaturuebersicht mit F1 und schliesst sie mit Escape', () => {
    startGame()

    fireEvent.keyDown(window, { key: 'F1' })
    expect(screen.getByRole('dialog', { name: 'Tastatur' })).toBeTruthy()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Tastatur' })).toBeNull()
  })

  it('oeffnet die Spielstaende mit Strg+S', () => {
    startGame()

    fireEvent.keyDown(window, { key: 's', ctrlKey: true })

    expect(screen.getByRole('dialog', { name: 'Spielstände' })).toBeTruthy()
  })
})

describe('R-UI-05 Einstellungen wirken', () => {
  it('aendert die Schriftgroesse sichtbar', () => {
    startGame()
    fireEvent.click(screen.getByRole('button', { name: 'Menü' }))

    const select = screen.getByRole('combobox', { name: /Schriftgröße/ }) as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'large' } })
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }))

    // A setting that changes nothing visible is worse than no setting at all.
    const app = document.querySelector('.app') as HTMLElement
    expect(app.style.fontSize).toBe('125%')
  })

  it('blendet die Debug-Ansicht erst auf Wunsch ein', () => {
    startGame()
    expect(screen.queryByRole('region', { name: 'Debug' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Menü' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Debug-Ansicht' }))
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }))

    expect(screen.getByRole('region', { name: 'Debug' })).toBeTruthy()
  })
})

describe('R-GAME-03 Speichern und Laden aus der Oberflaeche', () => {
  it('speichert in einen Stand und meldet es', async () => {
    startGame()
    fireEvent.keyDown(window, { key: 's', ctrlKey: true })

    // The slot list is read from storage, so it arrives a tick later.
    const buttons = await screen.findAllByRole('button', { name: 'Speichern' })
    fireEvent.click(buttons[0]!)

    expect(await screen.findByText('Gespeichert.')).toBeTruthy()
  })

  it('nennt den Eigentuemer bei seinem Namen, nicht bei seiner Kennung', async () => {
    // "p1" is an internal id. A player knows nations.
    startGame()
    const map = screen.getByRole('application', { name: 'Weltkarte' })
    fireEvent.click(map, { clientX: 100, clientY: 100 })

    expect(screen.queryByText('p1')).toBeNull()
  })
})

describe('R-TIME-04 Datum und Uhrzeit sind jederzeit sichtbar', () => {
  const clock = () => screen.queryByText(/Tag \d+ · \d{2}:\d{2}/)

  it('steht von der ersten Sekunde an in der Kopfleiste', () => {
    startGame()
    expect(clock()).toBeTruthy()
  })

  it('bleibt sichtbar, waehrend ein Dialog offen ist', () => {
    // "Jederzeit" heisst auch: waehrend der Spieler etwas anderes tut. Eine Uhr, die
    // hinter jedem Dialog verschwindet, beantwortet die Frage "wie spaet ist es"
    // genau dann nicht, wenn sie gestellt wird.
    startGame()
    fireEvent.keyDown(window, { key: 'F1' })

    expect(screen.getByRole('dialog', { name: 'Tastatur' })).toBeTruthy()
    expect(clock()).toBeTruthy()
  })

  it('geht mit der Spielzeit weiter', () => {
    startGame()
    expect(screen.getByText(/Tag 1 · 00:00/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Vorspulen' }))

    expect(screen.queryByText(/Tag 1 · 00:00/)).toBeNull()
    expect(screen.getByText(/Tag 2 · 00:00/)).toBeTruthy()
  })
})

describe('R-ECON-06 Die Wirtschaft steht vollstaendig auf dem Bildschirm', () => {
  it('zeigt Bestand, Produktion, Verbrauch und Bilanz je Rohstoff', () => {
    startGame()
    const panel = screen.getByRole('region', { name: 'Wirtschaft' })

    for (const column of ['Bestand', 'Produktion', 'Verbrauch', 'Bilanz']) {
      expect(within(panel).getByText(column), `Spalte ${column} fehlt`).toBeTruthy()
    }
    for (const resource of ['Nahrung', 'Eisen', 'Geld']) {
      expect(within(panel).getByText(resource), `Zeile ${resource} fehlt`).toBeTruthy()
    }
  })

  it('nennt in der Kopfleiste die Bilanz, nicht nur den Bestand', () => {
    startGame()
    const resources = screen.getByRole('list', { name: 'Rohstoffe' })

    // Vorzeichenbehaftet, damit die Richtung auf einen Blick lesbar ist.
    expect(resources.textContent).toMatch(/[+−±]\d/)
  })
})

describe('R-UI-07 / R-DIP-04 Das Protokoll spricht deutsch und verraet nichts', () => {
  it('zeigt nach einem Tag keine Kennung, keinen Platzhalter und keinen fremden Befehl', () => {
    // The first smoke test read "Bau von barracks begonnen" for another power's
    // province and "Befehl abgelehnt: {{reason}}" twenty-three times in a row.
    startGame()
    fireEvent.click(screen.getByRole('button', { name: 'Vorspulen' }))

    const log = screen.getByRole('region', { name: 'Ereignisse' })
    expect(log.textContent).not.toMatch(/\{\{|abgelehnt|barracks|\bp\d\b/)
  })
})

describe('R-UI-03 Vor der ersten Partie gibt es keine Sackgasse', () => {
  it('laesst den Startdialog bei Escape stehen, solange keine Partie laeuft', () => {
    render(<App map={world} rules={TEST_RULES} maps={maps} />)

    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }))

    expect(screen.getByRole('dialog', { name: 'Neue Partie' })).toBeTruthy()
  })
})

/**
 * The orders, end to end (T-M10-05, T-M10-06). The first smoke test found one button
 * in the province panel and none in the army panel; everything below was unreachable
 * from the screen although the core had it. Driven through the province picker, so
 * the same path serves the keyboard (R-UI-06).
 */
describe('R-UI-05 Befehle aus der Oberflaeche', () => {
  const capital = world.startPositions[0]!.capital
  const pickCapital = () => {
    fireEvent.change(screen.getByRole('combobox', { name: 'Provinz' }), { target: { value: capital } })
  }
  const fastForward = (days: number) => {
    for (let i = 0; i < days; i++) fireEvent.click(screen.getByRole('button', { name: 'Vorspulen' }))
  }
  const log = () => screen.getByRole('region', { name: 'Ereignisse' }).textContent ?? ''

  it('bietet in der eigenen Provinz jedes Gebaeude mit Preis und jede Einheit mit Grund', () => {
    startGame()
    pickCapital()

    const barracks = screen.getByRole('button', { name: 'Kaserne' })
    expect(barracks.hasAttribute('disabled')).toBe(false)
    expect(barracks.getAttribute('title')).toContain('Material')

    const recruit = screen.getByRole('region', { name: 'Ausheben' })
    expect(within(recruit).getByRole('button', { name: 'Infanterie' }).hasAttribute('disabled')).toBe(true)
    // One shared reason above the group, not ten below the buttons.
    expect(recruit.textContent).toContain('Dafür fehlt das Gebäude: Kaserne.')
  })

  it('baut, hebt aus, waehlt die Armee und marschiert mit angesagter Ankunft', () => {
    startGame()
    pickCapital()
    fireEvent.click(screen.getByRole('button', { name: 'Kaserne' }))
    expect(log()).toContain('Bau von Kaserne begonnen')

    fastForward(2)
    const infantry = within(screen.getByRole('region', { name: 'Ausheben' })).getByRole('button', { name: 'Infanterie' })
    expect(infantry.hasAttribute('disabled')).toBe(false)
    fireEvent.click(infantry)
    fastForward(2)
    expect(log()).toContain('Infanterie ausgehoben')

    fireEvent.click(screen.getByRole('button', { name: 'Auswählen' }))
    const panel = screen.getByRole('region', { name: 'Armee' })
    expect(panel.textContent).toContain('Infanterie')
    fireEvent.click(within(panel).getByRole('button', { name: 'Marschieren' }))

    const target = within(panel).getByRole('combobox', { name: 'Ziel' })
    const options = Array.from((target as HTMLSelectElement).options).map((o) => o.value)
    const neighbour = world.startPositions[0]!.provinces.find((id) => id !== capital && options.includes(id))!
    fireEvent.change(target, { target: { value: neighbour } })
    expect(panel.textContent).toMatch(/Ankunft/)

    fireEvent.click(within(panel).getByRole('button', { name: 'Marsch befehlen' }))
    expect(log()).toContain('marschiert nach')
    // Eigenes Zeitlimit, weil dieser Test die ganze Kette faehrt (bauen, vorspulen,
    // ausheben, Armee waehlen, Ziel waehlen, marschieren) und dabei die Anwendung
    // dutzendfach neu zeichnet: allein 3,5 s, unter der Abdeckungsmessung von
    // `pnpm verify` 5,3 s — und damit ueber dem Standardlimit von 5 s. Dieselbe Klasse
    // wie der Renderbenchmark (T-M10-03b) und die ESLint-Guards: gemessen wird dann die
    // Auslastung der Maschine, nicht das Verhalten des Codes. Ein zu knappes Limit macht
    // aus einer langsamen Maschine einen roten Test und aus einem roten Test Rauschen.
  }, 20_000)

  it('erklaert den Krieg aus der Diplomatie und nennt den Wirkungstag', () => {
    startGame()
    fireEvent.keyDown(window, { key: 'd' })
    const panel = screen.getByRole('region', { name: 'Diplomatie' })
    fireEvent.click(within(panel).getAllByRole('button', { name: 'Auswählen' })[0]!)
    fireEvent.click(within(panel).getByRole('button', { name: 'Krieg erklären' }))

    expect(log()).toMatch(/erklärt .* den Krieg\. Wirksam ab Tag \d+/)
    expect(log()).not.toMatch(/\bp\d\b/)
  })

  it('nennt am Markt den Gegenwert vor dem Tausch und fuehrt ihn aus', () => {
    startGame()
    fireEvent.keyDown(window, { key: 'h' })
    const panel = screen.getByRole('region', { name: 'Markt' })
    expect(panel.textContent).toMatch(/Ergibt etwa \d+/)

    fireEvent.click(within(panel).getByRole('button', { name: 'Handeln' }))
    expect(log()).toMatch(/gegen \d+ .* getauscht/)
  })

  it('bricht die Zielwahl mit Escape ab, ohne das Panel zu schliessen', () => {
    startGame()
    pickCapital()
    fireEvent.click(screen.getByRole('button', { name: 'Kaserne' }))
    fastForward(2)
    fireEvent.click(within(screen.getByRole('region', { name: 'Ausheben' })).getByRole('button', { name: 'Infanterie' }))
    fastForward(2)
    fireEvent.click(screen.getByRole('button', { name: 'Auswählen' }))
    const panel = screen.getByRole('region', { name: 'Armee' })
    fireEvent.click(within(panel).getByRole('button', { name: 'Marschieren' }))
    expect(within(panel).queryByRole('combobox', { name: 'Ziel' })).not.toBeNull()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByRole('region', { name: 'Armee' })).toBeTruthy()
    expect(screen.queryByRole('combobox', { name: 'Ziel' })).toBeNull()
  })
})

/**
 * Sound and the guided start, wired to the running game (T-M13-02).
 *
 * Both were built in M11/M12, both had passing unit tests, and neither was reachable
 * from the application. So what is checked here is exactly the missing half: that the
 * game itself produces a tone, that the setting silences it, and that a first-time
 * player is greeted.
 */
describe('R-UI-04 Der Ton haengt am Spiel', () => {
  /** A stand-in for the browser's audio, counting what the game asks it to play. */
  const fakeAudio = () => {
    const started: number[] = []
    const context = {
      currentTime: 0,
      destination: {},
      createOscillator: () => ({
        type: 'sine',
        frequency: { value: 0 },
        connect: () => undefined,
        start: (at: number) => started.push(at),
        stop: () => undefined,
      }),
      createGain: () => ({
        gain: { value: 0, setValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined },
        connect: () => undefined,
      }),
    }
    return { started, factory: () => context as unknown as AudioContext }
  }

  /** Build something, then let it finish — a completion is the cheapest audible event. */
  const buildAndFinish = (days: number) => {
    fireEvent.change(screen.getByRole('combobox', { name: 'Provinz' }), { target: { value: 'USA-MW' } })
    fireEvent.click(screen.getByRole('button', { name: 'Kaserne' }))
    for (let day = 0; day < days; day++) fireEvent.keyDown(window, { key: 'f' })
  }

  it('spielt einen Ton, wenn im Protokoll etwas Hoerbares steht', () => {
    const audio = fakeAudio()
    startGame({ audio: audio.factory })

    buildAndFinish(3)

    expect(audio.started.length, 'Das Spiel hat keinen einzigen Ton ausgeloest').toBeGreaterThan(0)
  })

  it('bleibt still, wenn der Ton abgeschaltet ist', () => {
    const audio = fakeAudio()
    startGame({ audio: audio.factory })
    fireEvent.click(screen.getByRole('button', { name: 'Menü' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Ton' }))
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }))

    buildAndFinish(3)

    expect(audio.started.length).toBe(0)
  })

  it('spielt dasselbe Ereignis nicht zweimal', () => {
    const audio = fakeAudio()
    startGame({ audio: audio.factory })
    buildAndFinish(3)
    const after = audio.started.length

    // Ein Klick, der den Zustand nicht bewegt, darf das Protokoll nicht noch einmal vertonen.
    fireEvent.click(screen.getByRole('button', { name: 'Diplomatie' }))

    expect(audio.started.length).toBe(after)
  })
})

describe('R-UI-05 Die Einstiegshilfe empfaengt den neuen Spieler', () => {
  it('zeigt den ersten Schritt in der ersten Partie', () => {
    globalThis.localStorage?.clear()
    render(<App map={world} rules={TEST_RULES} maps={maps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Partie beginnen' }))

    const hint = screen.getByRole('complementary', { name: 'Einstieg' })
    expect(hint.textContent).toContain('Schritt 1 von 5')
  })

  it('geht weiter, sobald der Spieler die genannte Handlung ausfuehrt', () => {
    globalThis.localStorage?.clear()
    render(<App map={world} rules={TEST_RULES} maps={maps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Partie beginnen' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Provinz' }), { target: { value: 'USA-MW' } })

    expect(screen.getByRole('complementary', { name: 'Einstieg' }).textContent).toContain('Schritt 2 von 5')
  })

  it('bleibt weg, wenn der Spieler sie abgeschaltet hat', () => {
    globalThis.localStorage?.clear()
    render(<App map={world} rules={TEST_RULES} maps={maps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Partie beginnen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Nicht mehr zeigen' }))

    expect(screen.queryByRole('complementary', { name: 'Einstieg' })).toBeNull()
    expect(globalThis.localStorage?.getItem('worldwar.tutorial.seen')).toBe('true')
  })
})

/**
 * Automatic saving, wired to the running game (T-M13-03, R-GAME-04).
 *
 * The core has had the rotation and the two-clock rule since M8, the settings dialogue
 * has offered an interval since M10 — and nothing connected them. The setting was a
 * decoration. What is checked here is that it is not one any more.
 */
describe('R-GAME-04 Automatisches Speichern in der laufenden Partie', () => {
  /** A clock the test moves by hand; the real one would make this untestable. */
  const clock = (start = 1_000_000) => {
    let now = start
    return { now: () => now, pass: (minutes: number) => (now += minutes * 60_000) }
  }

  const autosaves = async (storage: MemoryStorage) =>
    (await storage.list()).filter((name) => name.startsWith('auto'))

  it('schreibt nach dem eingestellten Intervall einen Stand', async () => {
    const storage = new MemoryStorage()
    const time = clock()
    startGame({ storage, now: time.now })

    expect(await autosaves(storage)).toHaveLength(0)

    // Beide Uhren muessen laufen: ein Spieltag und die eingestellten Minuten.
    time.pass(6)
    fireEvent.keyDown(window, { key: 'f' })

    await waitFor(async () => expect((await autosaves(storage)).length).toBeGreaterThan(0))
  })

  it('haelt die Rotation ein, statt den Speicher vollzuschreiben', async () => {
    const storage = new MemoryStorage()
    const time = clock()
    startGame({ storage, now: time.now })

    for (let day = 0; day < 6; day++) {
      time.pass(6)
      fireEvent.keyDown(window, { key: 'f' })
    }

    await waitFor(async () => expect((await autosaves(storage)).length).toBeGreaterThan(1))
    expect((await autosaves(storage)).length).toBeLessThanOrEqual(3)
  })

  it('schreibt nichts, solange die Partie steht', async () => {
    const storage = new MemoryStorage()
    const time = clock()
    startGame({ storage, now: time.now })

    // Zeit vergeht, Spielzeit nicht — ein Stand waere identisch mit dem letzten.
    time.pass(60)
    fireEvent.click(screen.getByRole('button', { name: 'Diplomatie' }))

    expect(await autosaves(storage)).toHaveLength(0)
  })
})

/**
 * Die Lage der Maechte, aus dem laufenden Spiel heraus (T-M13-12, R-UI-13).
 */
describe('R-UI-13 Die Lageuebersicht ist erreichbar', () => {
  it('oeffnet sich mit der Taste L', () => {
    startGame()

    fireEvent.keyDown(window, { key: 'l' })

    expect(screen.getByRole('region', { name: 'Lage' })).toBeTruthy()
  })

  it('oeffnet sich auch aus der Kopfleiste', () => {
    startGame()

    fireEvent.click(screen.getByRole('button', { name: 'Lage' }))

    expect(screen.getByRole('region', { name: 'Lage' })).toBeTruthy()
  })

  it('nennt die eigene Macht und mindestens einen Gegner', () => {
    startGame()
    fireEvent.keyDown(window, { key: 'l' })
    const panel = screen.getByRole('region', { name: 'Lage' })

    expect(panel.textContent).toContain('Vereinigte Staaten')
    expect(within(panel).getAllByRole('meter').length).toBeGreaterThan(1)
  })
})

/**
 * Nach dem Ende geht es weiter (R-GAME-01, R-UI-13, T-M12-06).
 *
 * Der Playtest vom 2026-09-06 fand den Knopf "Neue Partie" im Endedialog und stellte
 * fest, dass er ins Leere fuehrt: er schloss den Dialog, oeffnete keinen Startdialog und
 * liess den Spieler in der beendeten Partie stehen. Ursache war ein Zustandswert ohne
 * Renderzweig — `setDialog('new')` wird nur hinter dem Fruehausstieg gezeichnet, den eine
 * geladene Partie nie erreicht.
 *
 * Warum kein Test das fand, ist der lehrreichere Teil: `Standings.test.tsx` rendert den
 * VictoryDialog dreimal und jedes Mal OHNE `onNewGame`. Da die Eigenschaft optional ist,
 * lag der Knopf in keinem einzigen Testlauf im DOM. Und keiner der ueber dreissig Tests
 * hier erreichte je eine entschiedene Partie. Geprueft wurde, DASS ein Handler gerufen
 * wird — nie, WAS danach auf dem Bildschirm steht.
 *
 * Dieser Test geht deshalb den Weg des Spielers: eine entschiedene Partie laden, klicken,
 * und hinsehen.
 */
describe('R-GAME-01/AK1 Nach dem Ende beginnt die naechste Partie', () => {
  /** Ein Spielstand, dessen Partie entschieden ist — ohne ihn dauert der Weg 171 Tage. */
  async function entschiedenerStand() {
    const storage = new MemoryStorage()
    const state = neueGameState({ ...DEFAULT_NEW_GAME, opponents: 2 }, world, TEST_RULES)
    // Der Spieler ist ausgeschieden: genau der Fall, den der Playtest erreicht hat.
    const p1 = state.playerOrder[0]!
    state.players[p1]!.alive = false
    await storage.write(manualSlotName(0), serialise(state, 'Ende'))
    return storage
  }

  it('zeigt den Startdialog, nachdem "Neue Partie" gedrueckt wurde', async () => {
    const storage = await entschiedenerStand()
    render(<App map={world} rules={TEST_RULES} maps={maps} storage={storage} skipTutorial />)
    fireEvent.click(screen.getByRole('button', { name: 'Partie beginnen' }))

    // Den entschiedenen Stand laden — der Endedialog muss von selbst kommen.
    fireEvent.keyDown(window, { key: 's', ctrlKey: true })
    const liste = await screen.findByRole('dialog', { name: 'Spielstände' })
    fireEvent.click(within(liste).getAllByRole('button', { name: 'Laden' })[0]!)
    const ende = await screen.findByRole('dialog', { name: 'Die Partie ist entschieden' })

    // Und jetzt der Knopf, der bis zum 2026-09-06 ins Leere fuehrte.
    fireEvent.click(within(ende).getByRole('button', { name: 'Neue Partie' }))

    // Die Zusicherung ist der BILDSCHIRM, nicht der Zustand: genau daran ist der
    // Befund vorbeigekommen.
    expect(await screen.findByRole('dialog', { name: 'Neue Partie' })).toBeTruthy()
    expect(screen.getByText('Die Welt wird aufgebaut …')).toBeTruthy()
  })

  it('spielt die zweite Partie wirklich an', async () => {
    const storage = await entschiedenerStand()
    render(<App map={world} rules={TEST_RULES} maps={maps} storage={storage} skipTutorial />)
    fireEvent.click(screen.getByRole('button', { name: 'Partie beginnen' }))
    fireEvent.keyDown(window, { key: 's', ctrlKey: true })
    const liste = await screen.findByRole('dialog', { name: 'Spielstände' })
    fireEvent.click(within(liste).getAllByRole('button', { name: 'Laden' })[0]!)
    const ende = await screen.findByRole('dialog', { name: 'Die Partie ist entschieden' })
    fireEvent.click(within(ende).getByRole('button', { name: 'Neue Partie' }))

    fireEvent.click(await screen.findByRole('button', { name: 'Partie beginnen' }))

    // Tag 1 statt des Tages, an dem die alte Partie endete.
    await waitFor(() => expect(screen.getByText(/Tag 1\b/)).toBeTruthy())
    expect(screen.queryByRole('dialog', { name: 'Die Partie ist entschieden' })).toBeNull()
  })

  it('meldet auch der ZWEITEN Partie ihr Ende', async () => {
    // Die Flagge victoryAcknowledged wird nirgends sonst zurueckgesetzt. Bliebe sie
    // stehen, endete die zweite Partie stumm — der Fehler, den R-UI-13 beheben sollte,
    // nur eine Partie spaeter.
    const storage = await entschiedenerStand()
    render(<App map={world} rules={TEST_RULES} maps={maps} storage={storage} skipTutorial />)
    fireEvent.click(screen.getByRole('button', { name: 'Partie beginnen' }))

    for (const durchgang of [1, 2]) {
      fireEvent.keyDown(window, { key: 's', ctrlKey: true })
      const liste = await screen.findByRole('dialog', { name: 'Spielstände' })
      fireEvent.click(within(liste).getAllByRole('button', { name: 'Laden' })[0]!)
      const ende = await screen.findByRole('dialog', { name: 'Die Partie ist entschieden' })
      expect(ende, `Durchgang ${durchgang}`).toBeTruthy()
      fireEvent.click(within(ende).getByRole('button', { name: 'Neue Partie' }))
      fireEvent.click(await screen.findByRole('button', { name: 'Partie beginnen' }))
      await waitFor(() => expect(screen.getByText(/Tag 1\b/)).toBeTruthy())
    }
  })
})
