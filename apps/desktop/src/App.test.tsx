// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryStorage, type MapData } from '@worldwar/core'
import { deserialise, serialise } from '@worldwar/core'
import { startGame as neueGameState, DEFAULT_NEW_GAME } from './game/newGame.ts'
import { manualSlotName } from './game/saves.ts'
import { placeArmy, TEST_RULES } from '@worldwar/testkit'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
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
const testworld = JSON.parse(readFileSync(`${ROOT}/data/maps/testworld.json`, 'utf8')) as MapData
// Die Sammlung traegt die Karten selbst, nicht nur ihre Namen (T-M12-08): eine Auswahl,
// zu der die Daten fehlen, kann nur ein Blindschalter sein.
const maps = [
  { id: 'world', name: 'Welt', data: world },
  { id: 'testworld', name: 'Kleine Welt', data: testworld },
]

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
        .find((button) => button.getAttribute('aria-pressed') === 'true')
        ?.getAttribute('aria-label')

    // Seit T-M29-02 traegt die Pause ein Symbol und ihren Namen als aria-label.
    expect(pressed()).toBe('Pause')

    fireEvent.keyDown(window, { key: ' ' })
    expect(pressed()).not.toBe('Pause')

    fireEvent.keyDown(window, { key: ' ' })
    expect(pressed()).toBe('Pause')
  })

  it('wechselt den Kartenmodus mit M', () => {
    startGame()
    // Seit T-M29-02 eine Knopfgruppe: der gedrueckte Knopf ist der Modus.
    const pressed = () =>
      within(screen.getByRole('group', { name: 'Kartenmodus' }))
        .getAllByRole('button')
        .filter((b) => b.getAttribute('aria-pressed') === 'true')
        .map((b) => b.textContent)

    expect(pressed()).toEqual(['Besitz'])
    fireEvent.keyDown(window, { key: 'm' })
    expect(pressed()).toEqual(['Rohstoffe'])
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
    // Seit T-M22-04 oeffnet "Menü" das Menue mit Wegen; die Einstellungen sind einer davon.
    fireEvent.click(screen.getByRole('button', { name: 'Menü' }))
    fireEvent.click(screen.getByRole('button', { name: 'Einstellungen' }))

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
    fireEvent.click(screen.getByRole('button', { name: 'Einstellungen' }))
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
  // Die Spalte hiess bis zum 2026-09-07 "Verbrauch" und fuehrte doch nur den
  // Armeeunterhalt. Ohne Armee stand sie auf null, und der Playtest las das als
  // "die Spalte tut nichts" (Frage 15). Sie heisst jetzt, was sie ist, und daneben
  // steht die Antwort auf die eigentliche Frage: was in Auftraegen gebunden ist.
  it('zeigt Bestand, Produktion, Unterhalt und Bilanz je Rohstoff', () => {
    startGame()
    const panel = screen.getByRole('region', { name: 'Wirtschaft' })

    // "In Auftrag" ist seit T-M22-02 keine Spalte mehr: sie schob die Tabelle aus der
    // Leiste (Befund V2-02). Die Auskunft steht jetzt als Zeichen mit Zahl hinter dem
    // Bestand — geprueft in Panels.test.tsx am Fall mit laufenden Auftraegen.
    for (const column of ['Bestand', 'Produktion', 'Unterhalt', 'Bilanz']) {
      expect(within(panel).getByText(column), `Spalte ${column} fehlt`).toBeTruthy()
    }
    expect(within(panel).queryByText('In Auftrag')).toBeNull()
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

/**
 * Das Protokoll nutzt die volle Breite (T-M22-01, R-TIME-06, R-UI-05, Befund V2-01).
 *
 * Der Playtest V2 fand jeden Eintrag in einer ~90-px-Spalte umgebrochen, waehrend die
 * Leiste ~1400 px breit ist. Ursache: `.log__row` deklariert zwei Rasterspuren (Zeit,
 * Text), aber seit T-M20-03 traegt eine Zeile mit Rubriksymbol DREI Kinder — der Text
 * rutscht in die zweite Rasterzeile und erbt dort die Breite der Zeitspalte.
 *
 * jsdom rechnet kein Layout, also wird die Zusage strukturell gebunden: das echte
 * Stylesheet wird geladen, und jede Zeile darf hoechstens so viele Kinder haben, wie
 * das Raster Spuren deklariert — und die letzte Spur ist die flexible (`fr`), sodass
 * der Text die verfuegbare Breite abzueglich der festen Zeitspalte bekommt. Kein
 * fester Pixelwert fuer den Text.
 */
describe('R-TIME-06 Das Protokoll spricht in ganzen Zeilen', () => {
  const withStylesheet = () => {
    const style = document.createElement('style')
    style.textContent = readFileSync(`${ROOT}/apps/desktop/src/ui/app.css`, 'utf8')
    document.head.appendChild(style)
    return style
  }

  it('gibt dem Text jeder Zeile die flexible Spur — auch mit Rubriksymbol davor', () => {
    const style = withStylesheet()
    try {
      startGame()
      // Genau der Satz des Befunds: eine Kriegserklaerung, deren Zeile ein
      // Rubriksymbol traegt. Ein Tick danach, damit der Befehl sicher angewendet ist.
      fireEvent.keyDown(window, { key: 'd' })
      const panel = screen.getByRole('region', { name: 'Diplomatie' })
      fireEvent.click(within(panel).getAllByRole('button', { name: 'Auswählen' })[0]!)
      fireEvent.click(within(panel).getByRole('button', { name: 'Krieg erklären' }))
      fireEvent.click(screen.getByRole('button', { name: 'Vorspulen' }))

      const log = screen.getByRole('region', { name: 'Ereignisse' })
      const rows = [...log.querySelectorAll('.log__row')]
      expect(rows.length).toBeGreaterThan(0)
      expect(
        rows.some((row) => row.querySelector('svg')),
        'keine Zeile traegt ein Rubriksymbol — der Befundfall fehlt',
      ).toBe(true)

      for (const row of rows) {
        const tracks = window
          .getComputedStyle(row)
          .getPropertyValue('grid-template-columns')
          .trim()
          .split(/\s+/)
          .filter(Boolean)
        expect(
          row.children.length,
          `Zeile "${row.textContent?.slice(0, 60)}" hat mehr Kinder als Rasterspuren — ihr Text faellt aus der flexiblen Spur`,
        ).toBeLessThanOrEqual(tracks.length)
        // Die letzte Spur ist die flexible: der Text bekommt die Breite der Leiste
        // abzueglich der festen Zeitspalte — kein fester Pixelwert.
        expect(tracks[tracks.length - 1]).toMatch(/fr$/)
        expect(tracks[0]).toMatch(/px$/)
      }
    } finally {
      style.remove()
    }
  })
})

/**
 * Der Tagesbericht bekommt einen Koerper (T-M24-01, R-TIME-06, Befund V2-06).
 *
 * Die Verdrahtung, nicht die Rechnung: die Huelle liest am Tageswechsel den Zustand
 * (dayReportBody, geprueft in events.test.ts) und haengt den Koerper an den
 * DAY_REPORT-Eintrag des Protokolls. Ohne diese Verdrahtung bliebe der Bericht die
 * Ueberschrift ohne Koerper, die der Playtest fand.
 */
describe('R-TIME-06 Der Tagesbericht im Protokoll klappt auf', () => {
  it('traegt nach einem Spieltag einen aufklappbaren Koerper', async () => {
    startGame()
    fireEvent.click(screen.getByRole('button', { name: 'Vorspulen' }))

    const log = screen.getByRole('region', { name: 'Ereignisse' })
    await waitFor(() => {
      const bericht = [...log.querySelectorAll('details.log__report')].find((element) =>
        /Tagesbericht/.test(element.querySelector('summary')?.textContent ?? ''),
      )
      expect(bericht, 'kein aufklappbarer Tagesbericht im Protokoll').toBeTruthy()
      expect(bericht!.textContent).toMatch(/Bilanz|Moral|Morgen neu|ruhiger Tag/)
    })
  })
})

/**
 * Der Machtverlauf erreicht das Lage-Panel (T-M25-02, R-UI-13).
 *
 * Die Rechnung prueft Standings.test.tsx an bekannten Reihen; hier steht die
 * Verdrahtung: die Zeitreihe (T-M25-01) waechst am Tageswechsel, und das Lage-Panel
 * bekommt sie — nach drei Spieltagen gibt es eine Kurve (unter drei Punkten steht
 * seit T-M28-01 der ehrliche Wartesatz statt einer Pseudokurve).
 */
describe('R-UI-13 Der Machtverlauf erreicht das Lage-Panel', () => {
  it('zeichnet nach drei Spieltagen eine Kurve im Lage-Panel', async () => {
    startGame()

    fireEvent.click(screen.getByRole('button', { name: 'Vorspulen' }))
    await waitFor(() => expect(screen.getByText(/Tag 2/)).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Vorspulen' }))
    await waitFor(() => expect(screen.getByText(/Tag 3/)).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Vorspulen' }))
    await waitFor(() => expect(screen.getByText(/Tag 4/)).toBeTruthy())

    fireEvent.keyDown(window, { key: 'l' })

    await waitFor(() => {
      const kurve = document.querySelector('.chart path[data-series="p1"]')
      expect(kurve, 'keine eigene Kurve im Lage-Panel').toBeTruthy()
    })
  })

  it('sagt ohne zweiten Tag den ehrlichen Satz', () => {
    startGame()

    fireEvent.keyDown(window, { key: 'l' })

    expect(document.querySelector('.chart__empty'), 'kein Leerzustand im Lage-Panel').toBeTruthy()
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

/**
 * Vor der ersten Partie gibt es keine Sackgasse.
 *
 * Das Mittel hat sich am 2026-09-07 geaendert, die Zusage nicht. Bis dahin blieb der
 * Startdialog bei Escape und beim Kreuz einfach stehen — dahinter lag eine leere Flaeche
 * ohne jeden Ausgang, also durfte man ihn nicht verlassen koennen. Der Preis war ein
 * sichtbarer Knopf, der nichts tat, und das ist selbst ein Verstoss gegen R-UI-05.
 *
 * Seit T-M12-07 traegt die Flaeche dahinter den Weg zurueck, also darf der Dialog
 * schliessen. Geprueft wird deshalb die Zusage — der Spieler strandet nicht — und nicht
 * mehr das alte Mittel.
 */
describe('R-UI-03 Vor der ersten Partie gibt es keine Sackgasse', () => {
  it('laesst den Spieler nach Escape nicht ohne Ausweg zurueck', () => {
    render(<App map={world} rules={TEST_RULES} maps={maps} />)

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(screen.getByRole('button', { name: 'Neue Partie' })).toBeTruthy()
  })

  it('laesst den Spieler nach dem Kreuz nicht ohne Ausweg zurueck', () => {
    render(<App map={world} rules={TEST_RULES} maps={maps} />)

    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }))

    // Das Kreuz wirkt jetzt. Frueher war es ein toter Knopf.
    expect(screen.queryByRole('dialog', { name: 'Neue Partie' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Neue Partie' })).toBeTruthy()
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

  /**
   * Befund vom 2026-09-08 (Sichtpruefung nach M25-M27): ein Marschbefehl ueber die
   * Zielwahl verschwand im laufenden Programm SPURLOS — keine Ablehnung, keine
   * Quittung, kein Marsch. Ursache: der setState-Updater von fastForwardRun trug
   * Seiteneffekte (playerCommands = [], ticksRun +=). React ruft Updater unter
   * StrictMode (main.tsx rendert die App darin) doppelt: der erste Lauf verbrauchte
   * die Befehle, der zweite — dessen Ergebnis zaehlt — rechnete ohne sie. Alle
   * uebrigen Tests rendern ohne StrictMode und konnten das nicht sehen; dieser
   * rendert wie die echte Anwendung.
   */
  it('verliert gesammelte Befehle nicht, wenn React den Updater doppelt ruft (StrictMode wie main.tsx)', () => {
    render(
      <StrictMode>
        <App map={world} rules={TEST_RULES} maps={maps} skipTutorial />
      </StrictMode>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Partie beginnen' }))
    pickCapital()
    fireEvent.click(screen.getByRole('button', { name: 'Kaserne bauen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Vorspulen' }))

    expect(log()).toContain('Bau von Kaserne begonnen')
    // Und die Stoppmeldung zaehlt den Sprung nicht doppelt ("nach 2 Tagen" bei einem):
    // ticksRun += im doppelt gelaufenen Updater war derselbe Fehler von der anderen Seite.
    expect(screen.getByRole('status').textContent).not.toContain('2 Tag')
  })

  it('bietet in der eigenen Provinz jedes Gebaeude mit Preis und jede Einheit mit Grund', () => {
    startGame()
    pickCapital()

    const barracks = screen.getByRole('button', { name: 'Kaserne bauen' })
    expect(barracks.hasAttribute('disabled')).toBe(false)
    expect(barracks.getAttribute('title')).toContain('Material')

    const recruit = screen.getByRole('region', { name: 'Ausheben' })
    expect(within(recruit).getByRole('button', { name: 'Infanterie ausheben' }).hasAttribute('disabled')).toBe(true)
    // One shared reason above the group, not ten below the buttons.
    expect(recruit.textContent).toContain('Dafür fehlt das Gebäude: Kaserne.')
  })

  it('baut, hebt aus, waehlt die Armee und marschiert mit angesagter Ankunft', () => {
    startGame()
    pickCapital()
    fireEvent.click(screen.getByRole('button', { name: 'Kaserne bauen' }))
    // Seit T-M22-05 wirkt ein Befehl im naechsten Tick (V2-08): erst quittiert er …
    expect(log()).not.toContain('Bau von Kaserne begonnen')
    fastForward(1)
    // … dann wendet der naechste Tick ihn an.
    expect(log()).toContain('Bau von Kaserne begonnen')

    fastForward(2)
    const infantry = within(screen.getByRole('region', { name: 'Ausheben' })).getByRole('button', { name: 'Infanterie ausheben' })
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
    fastForward(1)
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
    // Der Befehl wirkt im naechsten Tick (T-M22-05).
    fastForward(1)

    // Der Spieler ist die Mehrzahl-Macht Vereinigte Staaten: das Verb steht in der
    // Mehrzahl (T-M23-02, V2-11).
    expect(log()).toMatch(/Vereinigte Staaten erklären .* den Krieg\. Wirksam ab Tag \d+/)
    expect(log()).not.toMatch(/\bp\d\b/)
  })

  it('nennt am Markt den Gegenwert vor dem Tausch und fuehrt ihn aus', () => {
    startGame()
    fireEvent.keyDown(window, { key: 'h' })
    const panel = screen.getByRole('region', { name: 'Markt' })
    expect(panel.textContent).toMatch(/Ergibt etwa \d+/)

    fireEvent.click(within(panel).getByRole('button', { name: 'Handeln' }))
    // Der Befehl wirkt im naechsten Tick (T-M22-05).
    fastForward(1)
    expect(log()).toMatch(/gegen \d+ .* getauscht/)
  })

  it('bricht die Zielwahl mit Escape ab, ohne das Panel zu schliessen', () => {
    startGame()
    pickCapital()
    fireEvent.click(screen.getByRole('button', { name: 'Kaserne bauen' }))
    fastForward(2)
    fireEvent.click(within(screen.getByRole('region', { name: 'Ausheben' })).getByRole('button', { name: 'Infanterie ausheben' }))
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
 * Jeder Befehl quittiert; eine stehende Uhr sagt es (T-M22-05, R-UI-05, R-TIME-02,
 * Befunde V2-08/V2-09).
 *
 * Ein Befehl wirkt erst im nächsten Tick — bei stehender Uhr also gar nicht, und das
 * Panel zeigte weiter „Frieden", ohne jeden Hinweis. Jetzt sammelt die Hülle die
 * Befehle (`pendingCommands`), der auslösende Knopf zeigt bis zur Anwendung die
 * Quittung, und bei stehender Uhr sagt sie „wirkt beim Weiterlaufen".
 */
describe('R-UI-05 Jeder Befehl quittiert sofort sichtbar', () => {
  const log = () => screen.getByRole('region', { name: 'Ereignisse' }).textContent ?? ''

  it('zeigt am ausloesenden Knopf "befohlen", bis der naechste Tick den Befehl anwendet', () => {
    startGame({ storage: new MemoryStorage() })
    fireEvent.keyDown(window, { key: 'd' })
    const panel = screen.getByRole('region', { name: 'Diplomatie' })
    fireEvent.click(within(panel).getAllByRole('button', { name: 'Auswählen' })[0]!)
    fireEvent.click(within(panel).getByRole('button', { name: 'Krieg erklären' }))

    // Die Quittung steht am Knopf — und bei stehender Uhr nennt sie das Weiterlaufen.
    expect(panel.textContent).toContain('befohlen')
    expect(panel.textContent).toContain('wirkt beim Weiterlaufen')
    // Abgeschickt, nicht angewendet: das Protokoll kennt den Befehl noch nicht.
    expect(log()).not.toMatch(/erklär(t|en)/)

    // Der naechste Tick wendet ihn an; die Quittung verschwindet. Die Vereinigten
    // Staaten erklaeren in der Mehrzahl (T-M23-02, V2-11).
    fireEvent.click(screen.getByRole('button', { name: 'Vorspulen' }))
    expect(log()).toMatch(/erklären .* den Krieg/)
    expect(screen.getByRole('region', { name: 'Diplomatie' }).textContent).not.toContain('befohlen')
  })

  it('sperrt den Knopf, solange sein Befehl aussteht — ein Doppelklick ist kein Doppelbefehl', () => {
    startGame({ storage: new MemoryStorage() })
    fireEvent.keyDown(window, { key: 'd' })
    const panel = screen.getByRole('region', { name: 'Diplomatie' })
    fireEvent.click(within(panel).getAllByRole('button', { name: 'Auswählen' })[0]!)
    const war = within(panel).getByRole('button', { name: 'Krieg erklären' })
    fireEvent.click(war)

    expect(war.hasAttribute('disabled')).toBe(true)
  })

  /**
   * Auch die Zielwahl quittiert sichtbar (T-M28-02, D26.2, Debugging 2026-09-08).
   *
   * Die Quittung aus T-M22-05 hing per actionId am „Marsch befehlen"-Knopf — und der
   * verschwindet mit `setTargeting(null)` im selben Klick. Der Spieler sah nach dem
   * Bestätigen NICHTS: genau das Loch, das T-M22-05 schließen sollte, einen Pfad
   * weiter. Jetzt steht die Quittung in der Armee-Statuszeile, gespeist aus derselben
   * `pendingCommands`-Sammlung. Gerendert wie main.tsx in StrictMode — die Falle vom
   * 2026-09-08 (doppelt gerufene Updater) sieht nur dieser Weg.
   */
  it('quittiert die Zielwahl in der Armee-Statuszeile (StrictMode wie main.tsx)', () => {
    render(
      <StrictMode>
        <App map={world} rules={TEST_RULES} maps={maps} skipTutorial />
      </StrictMode>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Partie beginnen' }))
    const capital = world.startPositions[0]!.capital
    const fastForward = (days: number) => {
      for (let i = 0; i < days; i++) fireEvent.click(screen.getByRole('button', { name: 'Vorspulen' }))
    }
    fireEvent.change(screen.getByRole('combobox', { name: 'Provinz' }), { target: { value: capital } })
    fireEvent.click(screen.getByRole('button', { name: 'Kaserne bauen' }))
    fastForward(3)
    fireEvent.click(
      within(screen.getByRole('region', { name: 'Ausheben' })).getByRole('button', { name: 'Infanterie ausheben' }),
    )
    fastForward(2)
    fireEvent.click(screen.getByRole('button', { name: 'Auswählen' }))
    const panel = screen.getByRole('region', { name: 'Armee' })
    fireEvent.click(within(panel).getByRole('button', { name: 'Marschieren' }))
    const target = within(panel).getByRole('combobox', { name: 'Ziel' })
    const options = Array.from((target as HTMLSelectElement).options).map((option) => option.value)
    const neighbour = world.startPositions[0]!.provinces.find((id) => id !== capital && options.includes(id))!
    fireEvent.change(target, { target: { value: neighbour } })
    fireEvent.click(within(panel).getByRole('button', { name: 'Marsch befehlen' }))

    // Der Bestätigungsknopf ist weg — die Quittung steht in der Statuszeile der Armee,
    // und bei stehender Uhr nennt sie das Weiterlaufen.
    const armee = screen.getByRole('region', { name: 'Armee' })
    expect(within(armee).queryByRole('button', { name: 'Marsch befehlen' })).toBeNull()
    const quittung = within(armee).getByRole('status')
    expect(quittung.textContent).toContain('befohlen')
    expect(quittung.textContent).toContain('wirkt beim Weiterlaufen')
    // Abgeschickt, nicht angewendet: das Protokoll kennt den Marsch noch nicht.
    expect(log()).not.toContain('marschiert nach')

    // Der nächste Tick wendet den Befehl an; die Quittung verschwindet wieder.
    fastForward(1)
    expect(log()).toContain('marschiert nach')
    expect(within(screen.getByRole('region', { name: 'Armee' })).queryByRole('status')).toBeNull()
  }, 20_000)
})

describe('R-TIME-02 Eine stehende Uhr nennt sich Pausiert', () => {
  /**
   * Der Befundfall nachgestellt (V2-09): `requestAnimationFrame` feuert nicht — im
   * Spiel bei verdecktem Fenster, hier per Stummschaltung. Wichtig: OHNE die
   * Stummschaltung haengt jsdoms rAF an `setInterval`, und unter falschen Uhren
   * treibt `advanceTimersByTime` dann die komplette Spielschleife an — genau das
   * Gegenteil des Falls, um den es geht.
   */
  const stehendeUhr = () => {
    vi.stubGlobal('requestAnimationFrame', () => 0)
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'Date'] })
  }

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('zeigt Pausiert, wenn trotz eingestelltem Tempo zwei Sekunden kein Tick lief', () => {
    stehendeUhr()
    startGame({ storage: new MemoryStorage() })
    expect(screen.queryByText('Pausiert')).toBeNull()

    fireEvent.keyDown(window, { key: ' ' })
    act(() => {
      vi.advanceTimersByTime(2500)
    })

    expect(screen.getByText('Pausiert')).toBeTruthy()
  })

  it('sagt bei bewusster Pause nichts — Pause ist kein Fehler', () => {
    stehendeUhr()
    startGame({ storage: new MemoryStorage() })

    act(() => {
      vi.advanceTimersByTime(2500)
    })

    expect(screen.queryByText('Pausiert')).toBeNull()
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
    fireEvent.click(screen.getByRole('button', { name: 'Kaserne bauen' }))
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
    fireEvent.click(screen.getByRole('button', { name: 'Einstellungen' }))
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
    expect(hint.textContent).toContain('Schritt 1 von 10')
  })

  it('geht weiter, sobald der Spieler die genannte Handlung ausfuehrt', () => {
    globalThis.localStorage?.clear()
    render(<App map={world} rules={TEST_RULES} maps={maps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Partie beginnen' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Provinz' }), { target: { value: 'USA-MW' } })

    expect(screen.getByRole('complementary', { name: 'Einstieg' }).textContent).toContain('Schritt 2 von 10')
  })

  it('beendet den Punkteschritt, wenn die Lage der Maechte offen ist (T-M24-02)', () => {
    // Der vierte Schritt erklaert, woher die Punkte kommen, und bittet um einen Blick
    // in die Lage der Maechte. Er endet auf JEDEM Weg dorthin — Taste L wie Kopfleiste —,
    // weil die Verdrahtung am geoeffneten Panel haengt, nicht an einer Taste.
    globalThis.localStorage?.clear()
    render(<App map={world} rules={TEST_RULES} maps={maps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Partie beginnen' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Provinz' }), { target: { value: 'USA-MW' } })
    fireEvent.click(screen.getByRole('button', { name: 'Kaserne bauen' }))
    fireEvent.click(within(screen.getByRole('group', { name: 'Geschwindigkeit' })).getByRole('button', { name: '10' }))

    const hint = () => screen.getByRole('complementary', { name: 'Einstieg' }).textContent ?? ''
    expect(hint(), 'die drei Klickschritte sind nicht durch').toContain('Schritt 4 von 10')

    fireEvent.keyDown(window, { key: 'l' })

    expect(hint(), 'der Blick auf die Lage hat den Schritt nicht beendet').toContain('Schritt 5 von 10')
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

    fireEvent.click(screen.getByRole('button', { name: /Rangliste/ }))

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

/**
 * Die Kartenwahl (T-M12-08, R-GAME-01, Playtest-Frage 4).
 *
 * Der Befund war ein Blindschalter: „Kleine Welt (12)" gewaehlt, es startet die
 * Weltkarte. Die Falle beim Nachweis ist, gegen den Dialogzustand zu pruefen — genau
 * diese Verwechslung hat den Befund ueberhaupt entstehen lassen, denn `options.mapId`
 * trug die Wahl korrekt und wurde nur nie gelesen. Geprueft wird deshalb die Zahl der
 * Provinzen der BEGONNENEN Partie, aus dem Spielstand heraus.
 *
 * Und nicht an der Provinzliste der Oberflaeche: die ist vom Nebel begrenzt (7 von 12
 * auf der kleinen Karte, 13 von 237 auf der Welt). Sie sieht aus wie die Provinzzahl
 * und ist es nicht.
 */
describe('R-GAME-01 Die Kartenwahl wirkt', () => {
  const startOn = async (mapId: string) => {
    const storage = new MemoryStorage()
    render(<App map={world} rules={TEST_RULES} maps={maps} storage={storage} skipTutorial />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Karte' }), { target: { value: mapId } })
    fireEvent.click(screen.getByRole('button', { name: 'Partie beginnen' }))
    fireEvent.keyDown(window, { key: 's', ctrlKey: true })
    fireEvent.click((await screen.findAllByRole('button', { name: 'Speichern' }))[0]!)
    await screen.findByText('Gespeichert.')
    return deserialise((await storage.read(manualSlotName(0)))!)
  }

  it('beginnt die Partie auf der gewaehlten Karte', async () => {
    const saved = await startOn('testworld')

    expect(saved.mapId).toBe('testworld')
    expect(saved.provinceOrder).toHaveLength(12)
  })

  it('bleibt ohne Wahl bei der Weltkarte', async () => {
    const saved = await startOn('world')

    expect(saved.mapId).toBe('world')
    expect(saved.provinceOrder).toHaveLength(237)
  })

  it('zeigt die Provinzen der gewaehlten Karte, nicht die der Welt', async () => {
    render(<App map={world} rules={TEST_RULES} maps={maps} storage={new MemoryStorage()} skipTutorial />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Karte' }), { target: { value: 'testworld' } })
    fireEvent.click(screen.getByRole('button', { name: 'Partie beginnen' }))

    // Namen unterscheiden, Zahlen nicht: die Liste ist vom Nebel begrenzt.
    expect(screen.getByRole('option', { name: 'Hafen' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: 'Mittlerer Westen' })).toBeNull()
  })

  it('stellt die Maechte der gewaehlten Karte zur Wahl', () => {
    render(<App map={world} rules={TEST_RULES} maps={maps} skipTutorial />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Karte' }), { target: { value: 'testworld' } })

    // Sonst waehlt der Spieler die Vereinigten Staaten und spielt Nordland — der
    // stille Zwilling des Blindschalters.
    const nations = screen.getByRole('combobox', { name: 'Macht' })
    expect(within(nations).getByRole('option', { name: 'Nordland' })).toBeTruthy()
    expect(within(nations).queryByRole('option', { name: 'Vereinigte Staaten' })).toBeNull()
  })

  it('spielt die gewaehlte Karte auch weiter, statt am Vorspulen zu zerbrechen', async () => {
    render(<App map={world} rules={TEST_RULES} maps={maps} storage={new MemoryStorage()} skipTutorial />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Karte' }), { target: { value: 'testworld' } })
    fireEvent.click(screen.getByRole('button', { name: 'Partie beginnen' }))

    // Wird nur der Start umgestellt und der Rest nicht, laeuft die Schleife mit 237
    // Provinzen gegen einen Zustand mit zwoelf.
    fireEvent.click(screen.getByRole('button', { name: 'Vorspulen' }))
    await waitFor(() => expect(screen.getByText(/Tag 2/)).toBeTruthy())
  })
})

/**
 * Die Spielstaende sind erreichbar (T-M12-07, R-GAME-03, R-UI-05, Playtest-Frage 26a).
 *
 * Der Stand ueberlebte korrekt und war trotzdem verloren: die Liste oeffnete nur Strg+S,
 * kein Knopf fuehrte dorthin, und ohne laufende Partie wirkte die Tastenkombination
 * nicht — wer das Fenster schloss, kam an seinen Spielstand nicht mehr heran. R-UI-05
 * verlangt jede Aktion per Klick; eine Funktion, die nur die Tastatur kennt, ist keine.
 *
 * Der Durchgang nannte als Weg in die Sackgasse das Kreuz des Startdialogs. Gemessen
 * wurde etwas anderes: das Kreuz war ein toter Knopf (`onClose={() => undefined}`), und
 * in die leere Flaeche fuehrte Strg+S. Beides ist hier abgedeckt.
 */
describe('R-UI-05 Die Spielstaende sind erreichbar', () => {
  const withSave = async () => {
    const storage = new MemoryStorage()
    const state = neueGameState({ ...DEFAULT_NEW_GAME, opponents: 2 }, world, TEST_RULES)
    await storage.write(manualSlotName(0), serialise(state, 'Vor dem Schliessen'))
    return storage
  }

  it('oeffnet die Liste per Knopf, nicht nur per Tastenkombination', async () => {
    startGame({ storage: new MemoryStorage() })

    fireEvent.click(screen.getByRole('button', { name: 'Spielstände' }))

    expect(await screen.findByRole('dialog', { name: 'Spielstände' })).toBeTruthy()
  })

  it('laesst den Stand auch vor der ersten Partie laden', async () => {
    const storage = await withSave()
    render(<App map={world} rules={TEST_RULES} maps={maps} storage={storage} skipTutorial />)

    // Der Fall aus dem Befund: Fenster geschlossen, neu geoeffnet, keine Partie laeuft.
    fireEvent.click(screen.getByRole('button', { name: 'Spielstände' }))
    fireEvent.click((await screen.findAllByRole('button', { name: 'Laden' }))[0]!)

    await waitFor(() => expect(screen.getByRole('banner')).toBeTruthy())
  })

  it('zeigt die Liste auch, wenn Strg+S sie ohne Partie oeffnet', async () => {
    render(<App map={world} rules={TEST_RULES} maps={maps} storage={await withSave()} skipTutorial />)

    fireEvent.keyDown(window, { key: 's', ctrlKey: true })

    // Vorher wurde der Startdialog dadurch ersetzt — durch nichts.
    expect(await screen.findByRole('dialog', { name: 'Spielstände' })).toBeTruthy()
  })

  it('laesst den leeren Zustand nicht als Sackgasse stehen', async () => {
    render(<App map={world} rules={TEST_RULES} maps={maps} storage={new MemoryStorage()} skipTutorial />)

    // Das Kreuz war ein toter Knopf. Jetzt schliesst es — und der Weg zurueck steht da.
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }))
    expect(screen.queryByRole('dialog', { name: 'Neue Partie' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Neue Partie' }))
    expect(await screen.findByRole('dialog', { name: 'Neue Partie' })).toBeTruthy()
  })

  it('fuehrt auch aus der leeren Flaeche zurueck, in die Strg+S geraten kann', async () => {
    render(<App map={world} rules={TEST_RULES} maps={maps} storage={new MemoryStorage()} skipTutorial />)

    fireEvent.keyDown(window, { key: 's', ctrlKey: true })
    fireEvent.keyDown(window, { key: 'Escape' })

    // Vorher war der Startdialog hier fuer immer weg und nur Neuladen half.
    expect(screen.getByRole('button', { name: 'Neue Partie' })).toBeTruthy()
  })
})

/**
 * Weiterspielen mit einem Klick, ein Menü mit Wegen (T-M22-04, R-UI-05, R-GAME-03,
 * Befunde V2-04/V2-05).
 *
 * Nach dem Neustart war der jüngste Stand zwei Klicks entfernt und wurde nicht
 * angeboten; das Menü kannte nur die Einstellungen. Jetzt: existiert ein Spielstand,
 * ist „Weiterspielen (Tag N)" der ERSTE Knopf des Startdialogs und lädt den jüngsten
 * Stand; das Menü bietet aus der laufenden Partie die drei Wege Neue Partie /
 * Spielstände / Einstellungen.
 */
describe('R-GAME-03 Weiterspielen mit einem Klick', () => {
  const withSaves = async () => {
    const storage = new MemoryStorage()
    const older = neueGameState({ ...DEFAULT_NEW_GAME, opponents: 2 }, world, TEST_RULES)
    await storage.write(manualSlotName(1), serialise(older, 'Alt'))
    // Der juengste Stand: Tag 3 (Tick 48 bei 24 Ticks je Tag).
    const newer = neueGameState({ ...DEFAULT_NEW_GAME, opponents: 2 }, world, TEST_RULES)
    newer.tick = 48
    await storage.write(manualSlotName(0), serialise(newer, 'Neu'))
    return storage
  }

  it('bietet Weiterspielen als ERSTEN Knopf des Startdialogs an und laedt den juengsten Stand', async () => {
    const storage = await withSaves()
    render(<App map={world} rules={TEST_RULES} maps={maps} storage={storage} skipTutorial />)

    // Der Knopf nennt den Tag des juengsten Stands …
    const resume = await screen.findByRole('button', { name: 'Weiterspielen (Tag 3)' })
    // … und steht VOR allem anderen im Dialog (V2-04: er war zwei Klicks entfernt).
    const body = document.querySelector('.dialog__body')
    expect(body?.querySelector('button')).toBe(resume)

    fireEvent.click(resume)

    // Ein Klick, und die Partie laeuft am geladenen Tag weiter.
    await waitFor(() => expect(screen.getByRole('banner')).toBeTruthy())
    expect(screen.getByText(/Tag 3 · 00:00/)).toBeTruthy()
  })

  it('bietet ohne Spielstand kein Weiterspielen an', () => {
    render(<App map={world} rules={TEST_RULES} maps={maps} storage={new MemoryStorage()} skipTutorial />)

    expect(screen.queryByRole('button', { name: /Weiterspielen/ })).toBeNull()
  })
})

describe('R-UI-05 Das Menue kennt drei Wege — auch aus der laufenden Partie', () => {
  it('bietet Neue Partie, Spielstaende und Einstellungen an', async () => {
    startGame({ storage: new MemoryStorage() })

    fireEvent.click(screen.getByRole('button', { name: 'Menü' }))
    const menu = screen.getByRole('dialog', { name: 'Menü' })

    expect(within(menu).getByRole('button', { name: 'Neue Partie' })).toBeTruthy()
    expect(within(menu).getByRole('button', { name: 'Spielstände' })).toBeTruthy()
    expect(within(menu).getByRole('button', { name: 'Einstellungen' })).toBeTruthy()
  })

  it('fuehrt aus der laufenden Partie zu den Einstellungen', () => {
    startGame({ storage: new MemoryStorage() })

    fireEvent.click(screen.getByRole('button', { name: 'Menü' }))
    fireEvent.click(screen.getByRole('button', { name: 'Einstellungen' }))

    expect(screen.getByRole('dialog', { name: 'Einstellungen' })).toBeTruthy()
  })

  it('fuehrt aus der laufenden Partie zum Startdialog fuer eine neue Partie', () => {
    // V2-05: aus der laufenden Partie gab es keinen Weg zu "Neue Partie".
    startGame({ storage: new MemoryStorage() })

    fireEvent.click(screen.getByRole('button', { name: 'Menü' }))
    fireEvent.click(screen.getByRole('button', { name: 'Neue Partie' }))

    expect(screen.getByRole('dialog', { name: 'Neue Partie' })).toBeTruthy()
    // Abbrechen laesst die laufende Partie unberuehrt.
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Neue Partie' })).toBeNull()
    expect(screen.getByRole('banner')).toBeTruthy()
  })
})

/**
 * Die Meldungen erreichen den Spieler (T-M12-09, R-UI-14, Playtest-Frage 42).
 *
 * Ueber zwei vollstaendige Partien bis Tag 171 erschien keine einzige Meldung, und der
 * Bereich `.alerts` stand zu keinem Zeitpunkt im DOM. Hauptstadtverlust, Ueberrennen und
 * das eigene Ausscheiden liefen wortlos vorbei.
 *
 * Die gemeldete Ursache — "die Kette bis zur Sicht fehlt" — stimmte nicht: App zeichnet
 * <Alerts> unverwandt und ruft `alertsFor` auf der lebenden Sicht. Leer war die LISTE,
 * und zwar aus drei getrennten Gruenden: die Hauptstadtbedingung fragte nach einer
 * Kennung, die im selben Tick auf null geht; eine unverteidigte Provinz wechselt ohne
 * Gefecht den Besitzer, und ohne Gefecht sagte nichts etwas; und die vierte von R-UI-14
 * geforderte Quelle, die Fertigstellungen, fehlte ganz.
 *
 * Deshalb pruefen diese Tests den BILDSCHIRM aus einer echten Partie heraus. Ein
 * Einzeltest von `alertsFor` hat den Befund nicht verhindert — es gab ihn, gruen — und
 * er wird ihn nicht verhindern.
 */
describe('R-UI-14 Die Meldungen erreichen den Spieler', () => {
  /** Einen vorbereiteten Zustand durch den Ladeweg der Oberflaeche schicken. */
  const zeige = async (state: Parameters<typeof serialise>[0]) => {
    const storage = new MemoryStorage()
    await storage.write(manualSlotName(0), serialise(state, 'Lage'))
    render(<App map={world} rules={TEST_RULES} maps={maps} storage={storage} skipTutorial />)
    fireEvent.click(screen.getByRole('button', { name: 'Spielstände' }))
    fireEvent.click((await screen.findAllByRole('button', { name: 'Laden' }))[0]!)
    return screen.findByRole('region', { name: 'Meldungen' })
  }

  const partie = () => {
    const state = neueGameState({ ...DEFAULT_NEW_GAME, opponents: 2 }, world, TEST_RULES)
    const p1 = state.playerOrder[0]!
    const p2 = state.playerOrder[1]!
    const heimat = state.provinceOrder.find((id) => state.provinces[id]!.owner === p1)!
    return { state, p1, p2, heimat }
  }

  it('meldet die fremde Armee auf eigenem Boden, auch ohne Gefecht', async () => {
    const { state, p2, heimat } = partie()
    // Ueberrennen: kein Verteidiger, also kein Kampf — und vorher kein Wort darueber.
    placeArmy(state, { owner: p2, at: heimat, units: [{ unitKey: 'infantry', hpTotal: 100_000 }] })

    const meldungen = await zeige(state)

    expect(meldungen.textContent).toContain(state.provinces[heimat]!.name)
  })

  it('meldet den Verlust der Hauptstadt', async () => {
    const { state, p1 } = partie()
    // occupation setzt capitalProvinceId im selben Tick auf null und merkt den Verlust
    // nur noch in capitalLostUntil — die alte Bedingung war genau hier tot.
    state.players[p1]!.capitalProvinceId = null
    state.players[p1]!.capitalLostUntil = state.tick + 100

    const meldungen = await zeige(state)

    expect(meldungen.textContent).toContain('Hauptstadt')
  })

  it('meldet, was gerade fertig geworden ist', async () => {
    const { state, p1, heimat } = partie()
    const provinz = state.provinces[heimat]!
    provinz.buildQueue = [
      { id: 'b1', building: 'barracks', startedTick: 0, completesAtTick: state.tick },
    ] as never
    expect(provinz.owner).toBe(p1)

    const meldungen = await zeige(state)

    // R-UI-14 nennt vier Quellen; diese fehlte in alertsFor vollstaendig.
    expect(meldungen.textContent).toContain('fertig')
  })
})

/**
 * Das Vorspulen sagt, warum es anhaelt (T-M12-10, R-TIME-03/AK1, Playtest-Frage 19).
 *
 * Die Anforderung sagt "stoppen UND melden". Gestoppt wurde seit M15 richtig, der Grund
 * lag im Zustand von App — und wurde an keine Komponente weitergereicht. Der Spieler sah
 * die Uhr stehenbleiben und erfuhr nie warum.
 */
describe('R-TIME-03 Das Vorspulen begruendet seinen Halt', () => {
  it('nennt nach dem Lauf den Grund und die verstrichene Zeit', async () => {
    startGame({ storage: new MemoryStorage() })

    fireEvent.click(screen.getByRole('button', { name: 'Vorspulen' }))

    const meldung = await screen.findByRole('status')
    expect(meldung.textContent).toMatch(/Angehalten|Abgebrochen/)
  })

  it('sagt vorher nichts — eine Meldung ohne Lauf waere eine Meldung ueber nichts', () => {
    startGame({ storage: new MemoryStorage() })

    expect(screen.queryByRole('status')).toBeNull()
  })
})

/**
 * Die Debug-Ansicht fuellt sich (T-M12-10, R-AI-05, Playtest-Frage 48).
 *
 * Sie zeigte "Tick: 8", einen LEEREN Zustands-Hash und zwei Ueberschriften ohne Inhalt.
 * Der Plan liess nur zwei Ausgaenge zu: sie fuellt sich oder sie verschwindet. Sie fuellt
 * sich, denn alle drei Groessen gab es bereits und wurden weggeworfen — der Hash ist
 * dieselbe Rechnung wie im Spielstand, die Befehlsliste gibt `advanceTicks` seit M14
 * zurueck, und die Begruendungen der KI entstehen seit M7 in `decide`.
 *
 * Damit ist Frage 48 mit nein zu beantworten, wie der Bogen es erwartet — vorher war sie
 * mit ja zu beantworten, und der Bogen behauptete das Gegenteil.
 */
describe('R-AI-05 Die Debug-Ansicht zeigt etwas', () => {
  const mitDebug = () => {
    globalThis.localStorage?.setItem('worldwar.settings', JSON.stringify({ debug: true }))
    startGame({ storage: new MemoryStorage() })
  }

  it('zeigt einen echten Zustands-Hash statt eines leeren Feldes', () => {
    mitDebug()

    const panel = screen.getByRole('region', { name: 'Debug' })
    const hash = panel.querySelector('.mono')
    expect(hash?.textContent).toMatch(/^[0-9a-f]{8,}$/i)
  })

  it('fuellt Ziel und Kommandolog, sobald die Partie laeuft', async () => {
    mitDebug()

    fireEvent.click(screen.getByRole('button', { name: 'Vorspulen' }))

    await waitFor(() => {
      const panel = screen.getByRole('region', { name: 'Debug' })
      expect(panel.querySelectorAll('.debug-list li').length).toBeGreaterThan(0)
    })
  })
})

/**
 * Die Provinz erklaert sich im Tooltip (T-M31-01, R-UI-11/R-UI-15).
 *
 * Ohne Maus: die per Tastatur gewaehlte Provinz bekommt dieselbe Auskunft am selben
 * Ort — sonst waere der Tooltip ein Mausrecht. Escape schliesst ihn.
 */
describe('T-M31-01 Der Tooltip folgt auch der Tastaturauswahl', () => {
  it('zeigt fuer die per Auswahlliste gewaehlte Provinz einen Tooltip und schliesst ihn mit Escape', () => {
    startGame()
    const capital = world.startPositions[0]!.capital
    expect(screen.queryByRole('tooltip')).toBeNull()

    fireEvent.change(screen.getByRole('combobox', { name: 'Provinz' }), { target: { value: capital } })
    const tip = screen.getByRole('tooltip')
    expect(tip.textContent).toContain(world.provinces.find((p) => p.id === capital)!.name)
    expect(tip.textContent).toMatch(/Moral/)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('tooltip')).toBeNull()
  })
})

/**
 * Der Fuss in der App (T-M31-03): die Neu-Marke zaehlt, was seit dem letzten Oeffnen
 * der Lage dazukam, und wird beim Oeffnen null; die Depesche oeffnet den juengsten
 * Tagesbericht.
 */
describe('T-M31-03 Der Fuss: Neu-Marke und Depesche', () => {
  it('zaehlt neue Zeilen, setzt die Marke beim Oeffnen der Lage auf null und oeffnet die Depesche', () => {
    startGame()
    // Der Start schreibt schon Zeilen ins Protokoll — sie zaehlen als neu.
    const lage = () => screen.getByRole('button', { name: /Rangliste/ })
    expect(lage().querySelector('.foot__badge')).not.toBeNull()

    fireEvent.click(lage())
    expect(lage().querySelector('.foot__badge')).toBeNull()

    // Ein Tageswechsel bringt den Tagesbericht — und die Depesche.
    fireEvent.click(screen.getByRole('button', { name: 'Vorspulen' }))
    const depesche = screen.getByRole('button', { name: 'Depesche' }) as HTMLButtonElement
    expect(depesche.disabled).toBe(false)
    fireEvent.click(depesche)
    expect(screen.getByRole('dialog', { name: 'Depesche' })).toBeTruthy()
  })
})
