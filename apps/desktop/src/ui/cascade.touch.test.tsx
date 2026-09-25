// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

/**
 * Finger brauchen grosse Ziele (touch.css, Android-Emulator, 2026-09-24).
 *
 * Gebunden ist die Kaskade, nicht die Messung: jsdom rechnet kein Layout, und es wendet
 * @media-Regeln nur fuer `all` und `screen` an. Deshalb haengt die Touch-Groesse an
 * `:root[data-input="touch"]` statt an `(pointer: coarse)` — das kann jsdom sehen. Die
 * Regeln fuer kleine Bildschirme (`max-height`) prueft die Messung im echten Fenster.
 *
 * Zwei Richtungen: im Touch-Betrieb ist jedes Bedienelement mindestens 44 CSS-px hoch,
 * und im Mausbetrieb bleibt der Schreibtisch, wie er war — der Waechter in
 * Panels.test.tsx haelt dort die 24 px des Knopfes fest.
 */

const UI = `${process.cwd()}/apps/desktop/src/ui`
const styles: HTMLStyleElement[] = []

beforeEach(() => {
  for (const file of ['app.css', 'touch.css']) {
    const style = document.createElement('style')
    style.textContent = readFileSync(`${UI}/${file}`, 'utf8')
    document.head.appendChild(style)
    styles.push(style)
  }
})

afterEach(() => {
  for (const style of styles.splice(0)) style.remove()
  delete document.documentElement.dataset['input']
  cleanup()
})

function Bedienelemente() {
  return (
    <div className="app">
      <button type="button" className="button">
        Los
      </button>
      <button type="button" className="speed">
        1
      </button>
      <button type="button" className="mode">
        Besitz
      </button>
      <button type="button" className="map-control" aria-label="Hineinzoomen">
        +
      </button>
      <button type="button" className="alarm-chip">
        Alarm
      </button>
      <button type="button" className="button button--icon" aria-label="weniger">
        −
      </button>
      <button type="button" className="alert__dismiss" aria-label="ausblenden">
        ×
      </button>
      <button type="button" className="log__jump">
        Berlin
      </button>
      <button type="button" className="alert__jump">
        Paris
      </button>
      <details className="log__report">
        <summary>Tagesbericht</summary>
      </details>
      <label className="field">
        <span>Name</span>
        <input type="text" aria-label="Name" />
      </label>
      <label className="picker">
        <span>Provinz</span>
        <select aria-label="Provinz">
          <option>Berlin</option>
        </select>
      </label>
      <div className="slot">
        <div className="action action--compact">
          <span className="action__head">
            <button type="button" className="button" aria-label="Fabrik ausbauen">
              +
            </button>
            <button type="button" className="explain__toggle" aria-label="Erklaerung">
              ?
            </button>
          </span>
        </div>
      </div>
      <canvas className="map-layer map-layer--overlay" aria-label="Weltkarte" />
    </div>
  )
}

const css = (element: Element, property: string): string =>
  window.getComputedStyle(element).getPropertyValue(property)

const button = (name: string | RegExp): HTMLElement => screen.getByRole('button', { name })

describe('touch.css: im Touch-Betrieb ist jedes Bedienelement mindestens 44 px', () => {
  beforeEach(() => {
    document.documentElement.dataset['input'] = 'touch'
  })

  it('hebt Knoepfe, Tempo, Modus, Alarm und Kartenknoepfe auf 44 px', () => {
    render(<Bedienelemente />)

    expect(css(button('Los'), 'min-height')).toBe('44px')
    expect(css(button('Los'), 'min-width')).toBe('44px')
    expect(css(button('1'), 'height')).toBe('44px')
    expect(css(button('1'), 'min-width')).toBe('44px')
    expect(css(button('Besitz'), 'min-height')).toBe('44px')
    expect(css(button('Alarm'), 'min-height')).toBe('44px')
    expect(css(button('Hineinzoomen'), 'width')).toBe('44px')
    expect(css(button('Hineinzoomen'), 'height')).toBe('44px')
    expect(css(button('weniger'), 'min-width')).toBe('44px')
    expect(css(button('ausblenden'), 'min-width')).toBe('44px')
    expect(css(button('ausblenden'), 'min-height')).toBe('44px')
  })

  it('macht auch Textverweise, Aufklapper und Eingaben fingergross', () => {
    const { container } = render(<Bedienelemente />)

    expect(css(button('Berlin'), 'min-height')).toBe('44px')
    expect(css(button('Paris'), 'min-height')).toBe('44px')
    expect(css(container.querySelector('summary')!, 'min-height')).toBe('44px')
    expect(css(screen.getByRole('textbox', { name: 'Name' }), 'min-height')).toBe('44px')
    // 16 px: darunter vergroessern mobile Browser beim Fokus die ganze Seite.
    expect(css(screen.getByRole('textbox', { name: 'Name' }), 'font-size')).toBe('16px')
    expect(css(screen.getByRole('combobox', { name: 'Provinz' }), 'min-height')).toBe('44px')
    expect(css(screen.getByRole('combobox', { name: 'Provinz' }), 'font-size')).toBe('16px')
  })

  it('holt den Ausbau-Knopf aus der Ecke des Bauplatzes und gibt dem Fragezeichen Abstand', () => {
    const { container } = render(<Bedienelemente />)

    // Ein 44-px-Ziel oben rechts in einem 60-px-Feld wuerde Bild und Namen verdecken.
    expect(css(container.querySelector('.action--compact')!, 'position')).toBe('static')
    expect(css(button('Fabrik ausbauen'), 'min-height')).toBe('44px')
    // Das Fragezeichen bleibt klein und bekommt ein unsichtbares 44-px-Feld; der Abstand
    // sorgt dafuer, dass dieses Feld dem Knopf daneben keine Tipps stiehlt.
    expect(css(button('Erklaerung'), 'position')).toBe('relative')
    expect(css(container.querySelector('.action__head')!, 'gap')).toBe('12px')
  })
})

describe('touch.css: im Mausbetrieb bleibt der Schreibtisch, wie er war', () => {
  /** Die Masse, die touch.css im Touch-Betrieb anfasst — gelesen an jedem Bedienelement. */
  const MASSE = ['min-height', 'min-width', 'height', 'width', 'font-size', 'padding', 'position', 'gap', 'opacity']

  function vermessen(container: HTMLElement): string[] {
    return [...container.querySelectorAll('button, summary, input, select, .action, .action__head')].flatMap((element) =>
      MASSE.map((property) => `${element.className || element.tagName} ${property}: ${css(element, property)}`),
    )
  }

  for (const mode of ['mouse', undefined] as const) {
    it(`data-input=${mode ?? '(nicht gesetzt)'}: jedes Mass ist dasselbe wie ohne touch.css`, () => {
      if (mode) document.documentElement.dataset['input'] = mode
      const { container } = render(<Bedienelemente />)

      const mitTouch = vermessen(container)
      styles.pop()!.remove()
      const ohneTouch = vermessen(container)

      expect(mitTouch.length).toBeGreaterThan(50)
      expect(mitTouch).toEqual(ohneTouch)
      // Und der Wert, den Panels.test.tsx fuer den Schreibtisch festhaelt.
      expect(css(button('Los'), 'min-height')).toBe('24px')
      expect(css(button('Hineinzoomen'), 'width')).toBe('26px')
    })
  }
})

describe('touch.css: die Seite steht im Touch-Betrieb still', () => {
  beforeEach(() => {
    document.documentElement.dataset['input'] = 'touch'
  })

  it('nimmt .app den Rollcontainer ab und laesst die eine Spalte schmaler werden als ihr Inhalt', () => {
    const { container } = render(<Bedienelemente />)
    const app = container.querySelector('.app')!

    expect(css(app, 'position')).toBe('relative')
    // overflow steht zweimal: hidden, dann clip — die zweite Erklaerung gewinnt.
    expect(css(app, 'overflow')).toBe('clip')
    expect(css(app, 'grid-template-columns')).toBe('minmax(0, 1fr)')
  })

  it('laesst .app im Mausbetrieb unangetastet', () => {
    document.documentElement.dataset['input'] = 'mouse'
    const { container } = render(<Bedienelemente />)
    const app = container.querySelector('.app')!

    // app.css setzt weder position noch overflow noch grid-template-columns an .app:
    // touch.css darf sie im Mausbetrieb nicht setzen (jsdom meldet nicht gesetzte
    // Eigenschaften als leere Zeichenkette, nicht als deren Anfangswert).
    expect(css(app, 'position')).toBe('static')
    expect(css(app, 'overflow')).toBe('')
    expect(css(app, 'grid-template-columns')).not.toBe('minmax(0, 1fr)')
  })
})

describe('touch.css: die Karte gehoert dem Finger, in jeder Eingabeart', () => {
  it('nimmt dem Browser Wischen und Markieren auf der Karte ab', () => {
    render(<Bedienelemente />)
    const karte = screen.getByLabelText('Weltkarte')

    // Ohne touch-action uebernimmt der Browser das Ziehen und schickt pointercancel.
    expect(css(karte, 'touch-action')).toBe('none')
    expect(css(karte, 'user-select')).toBe('none')
  })
})

/**
 * Kartenknoepfe und Uebersichtskarte ueberdecken sich nicht (T-TOUCH-KARTENKNOEPFE,
 * 2026-09-25). Gemessen im echten Fenster (LDPlayer, Chrome 124) bei 1098x498@1.75 und
 * 1097x617@1.75: elementFromPoint an "Hauptstadt zentrieren" und "Vollbild" traf die
 * Uebersichtskarte statt den Knopf, weil die viersaeulige 44-px-Kartenknopf-Spalte oben
 * rechts (182 px hoch) und die 132x74-Uebersichtskarte unten rechts bei dieser Hoehe in
 * denselben senkrechten Streifen fallen. Gebunden ist hier nur die Kaskade ausserhalb
 * eines @media-Blocks (touch.css stellt die Kartenknoepfe im Touch-Betrieb bei jeder Hoehe
 * als Reihe); die Messung im echten Fenster deckt scripts/android-check.mjs ab. Die
 * Uebersichtskarte bleibt rechts: links deckte sie die Einfuehrung zu (gemessen an d55e5b3).
 */
function Kartenknoepfe() {
  return (
    <div className="map-wrapper">
      <div className="map-controls" role="group" aria-label="Kartenwerkzeuge">
        <button type="button" className="map-control" aria-label="Hineinzoomen">
          +
        </button>
        <button type="button" className="map-control" aria-label="Herauszoomen">
          −
        </button>
        <button type="button" className="map-control" aria-label="Hauptstadt zentrieren">
          ◎
        </button>
        <button type="button" className="map-control" aria-label="Vollbild an">
          ⛶
        </button>
      </div>
      <canvas className="map-overview" role="button" aria-label="Übersichtskarte" />
    </div>
  )
}

describe('touch.css: Kartenknoepfe und Uebersichtskarte liegen nie im selben Streifen', () => {
  it('stellt die Kartenknoepfe im Touch-Betrieb als Reihe, die Uebersichtskarte bleibt rechts', () => {
    document.documentElement.dataset['input'] = 'touch'
    const { container } = render(<Kartenknoepfe />)
    const overview = screen.getByRole('button', { name: 'Übersichtskarte' })
    const controls = container.querySelector('.map-controls')!

    expect(css(controls, 'flex-direction')).toBe('row')
    // Die Kartenknoepfe bleiben oben rechts ...
    expect(css(controls, 'right')).toBe('var(--sp-md)')
    // ... und die Uebersichtskarte unten rechts - nicht links, dort liegt die Einfuehrung.
    // jsdom loest var(...) in der Kaskade nicht zu px auf; der Rohwert bindet die Regel.
    expect(css(overview, 'right')).toBe('var(--sp-lg)')
    expect(css(overview, 'left')).toBe('auto')
  })

  it('laesst im Mausbetrieb die Spalte und die Uebersichtskarte, wie sie waren', () => {
    document.documentElement.dataset['input'] = 'mouse'
    const { container } = render(<Kartenknoepfe />)
    const overview = screen.getByRole('button', { name: 'Übersichtskarte' })

    expect(css(container.querySelector('.map-controls')!, 'flex-direction')).toBe('column')
    expect(css(overview, 'right')).toBe('var(--sp-lg)')
    // app.css setzt kein "left" an .map-overview; jsdom meldet fuer absolut positionierte
    // Elemente ohne eigene "left"-Regel deren Startwert "auto".
    expect(css(overview, 'left')).toBe('auto')
  })
})
