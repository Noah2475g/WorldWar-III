// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { MapData } from '@worldwar/core'
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

const startGame = () => {
  render(<App map={world} rules={TEST_RULES} maps={maps} />)
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
