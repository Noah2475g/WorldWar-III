// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Explain } from './Explain.tsx'
import { de } from '../i18n/de.ts'
import { MAP_MODES } from '../map/modes.ts'

/**
 * Every thing explains itself, where it stands (T-M13-11, R-UI-11).
 *
 * Two halves, and the second is the one that lasts: the component works, and there is
 * a text for every key the rules actually have. A missing explanation must be a red
 * test, not a puzzled player — and a new unit in the rules is exactly the moment one
 * goes missing.
 */

afterEach(cleanup)

const ROOT = process.cwd()
const rules = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(`${ROOT}/data/rules/default/${name}.json`, 'utf8')) as Record<string, unknown>

/** At most two sentences: the requirement says two, and a paragraph is not an answer. */
const sentences = (text: string): number => text.split(/[.!?](?:\s|$)/).filter((part) => part.trim().length > 0).length

describe('R-UI-11 Das Erklaerungsfeld', () => {
  it('bleibt zu, bis der Spieler fragt', () => {
    render(<Explain textKey="explain.buildings.barracks" subject="Kaserne" />)

    expect(screen.queryByRole('note')).toBeNull()
  })

  it('sagt auf Knopfdruck, was das Ding ist', () => {
    render(<Explain textKey="explain.buildings.barracks" subject="Kaserne" />)

    fireEvent.click(screen.getByRole('button', { name: /Kaserne/ }))

    expect(screen.getByRole('note').textContent).toBe(de.explain.buildings.barracks)
  })

  it('ist mit der Tastatur erreichbar und meldet seinen Zustand', () => {
    // Ein title-Attribut waere fuer die Tastatur unsichtbar — R-UI-11 verlangt beides.
    render(<Explain textKey="explain.units.tank" subject="Kampfpanzer" />)
    const button = screen.getByRole('button', { name: /Kampfpanzer/ })

    expect(button.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(button)
    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(button.getAttribute('aria-controls')).toBe(screen.getByRole('note').id)
  })

  it('laesst sich wieder schliessen', () => {
    render(<Explain textKey="explain.units.tank" subject="Kampfpanzer" />)
    const button = screen.getByRole('button', { name: /Kampfpanzer/ })

    fireEvent.click(button)
    fireEvent.click(button)

    expect(screen.queryByRole('note')).toBeNull()
  })
})

describe('R-UI-11 Kein Ding ohne Erklaerung', () => {
  it('erklaert jedes Gebaeude der Regeln', () => {
    for (const key of Object.keys((rules('buildings').buildings ?? {}) as object)) {
      const text = (de.explain.buildings as Record<string, string>)[key]
      expect(text, `Gebaeude "${key}" ohne Erklaerung`).toBeTruthy()
      expect(sentences(text!), `Gebaeude "${key}": mehr als zwei Saetze`).toBeLessThanOrEqual(2)
    }
  })

  it('erklaert jede Einheit der Regeln', () => {
    for (const key of Object.keys((rules('units').units ?? {}) as object)) {
      const text = (de.explain.units as Record<string, string>)[key]
      expect(text, `Einheit "${key}" ohne Erklaerung`).toBeTruthy()
      expect(sentences(text!), `Einheit "${key}": mehr als zwei Saetze`).toBeLessThanOrEqual(2)
    }
  })

  it('erklaert jeden Rohstoff der Regeln', () => {
    for (const key of Object.keys((rules('resources').resources ?? {}) as object)) {
      expect((de.explain.resources as Record<string, string>)[key], `Rohstoff "${key}"`).toBeTruthy()
    }
  })

  it('erklaert jeden Kartenmodus, jede Gelaendeart und jeden Beziehungszustand', () => {
    for (const mode of MAP_MODES) {
      expect((de.explain.mapModes as Record<string, string>)[mode], `Modus "${mode}"`).toBeTruthy()
    }
    for (const terrain of Object.keys(de.terrain)) {
      expect((de.explain.terrain as Record<string, string>)[terrain], `Gelaende "${terrain}"`).toBeTruthy()
    }
    for (const state of ['peace', 'war', 'truce', 'alliance', 'rightOfWay', 'sharedMap']) {
      expect((de.explain.diplomacy as Record<string, string>)[state], `Zustand "${state}"`).toBeTruthy()
    }
  })

  it('nennt in keiner Erklaerung eine Zahl aus den Regeln', () => {
    // Kosten, Dauer und Kampfwerte stehen in den Regeldateien. Stuenden sie hier ein
    // zweites Mal, waeren sie beim naechsten Balancing-Lauf falsch — und niemand wuesste es.
    const all = [
      ...Object.values(de.explain.buildings),
      ...Object.values(de.explain.units),
      ...Object.values(de.explain.resources),
    ]
    for (const text of all) {
      expect(text, `"${text}" nennt eine Zahl`).not.toMatch(/\d/)
    }
  })
})

/**
 * R-UX-05/AK3 · Die Erklaerung ist ein Popover mit Escape (T-M44-13, Befund B-13).
 *
 * Aufnahme vom 2026-10-03: das „?" im Bauplatzraster klappte seinen Text als Block in die Kachel
 * und schob das Raster auseinander; Escape schloss nichts — oder, schlimmer, nahm gleich das
 * Provinzpanel mit. Jetzt liegt der Text ueber dem Raster (`position: absolute`, nimmt keinen
 * Platz), Escape schliesst genau ihn und gibt den Fokus dem „?" zurueck, ein Druck daneben
 * schliesst ihn auch. Das Raster daneben misst `pnpm ux:check` im echten Fenster.
 */
describe('R-UX-05/AK3 Das Erklaerungsfeld ist ein Popover mit Escape', () => {
  const css = readFileSync(`${ROOT}/apps/desktop/src/ui/app.css`, 'utf8')
  /** Die spaeteste Regel zu einem Selektor: der Block von T-M44-13 steht am Ende von app.css. */
  const rule = (selector: string): string => {
    const found = [...css.matchAll(new RegExp(`\\n${selector.replace(/[.[\]']/g, '\\$&')}\\s*\\{([^}]*)\\}`, 'g'))].pop()
    expect(found, `Regel ${selector} in app.css`).toBeDefined()
    return found![1]!
  }

  it('schliesst mit Escape und gibt den Fokus dem Fragezeichen zurueck (heute rot)', () => {
    render(
      <div>
        <Explain textKey="explain.buildings.barracks" subject="Kaserne" />
        <button type="button">daneben</button>
      </div>,
    )
    const toggle = screen.getByRole('button', { name: /Kaserne/ })
    fireEvent.click(toggle)
    expect(screen.getByRole('note')).toBeTruthy()

    // Der Fokus darf irgendwo sein — auch dort, wo ein Mausklick ihn hingelegt hat.
    screen.getByRole('button', { name: 'daneben' }).focus()
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })

    expect(screen.queryByRole('note')).toBeNull()
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(toggle)
  })

  it('nimmt Escape fuer sich: die Karte dahinter schliesst nicht auch ihr Panel (heute rot)', () => {
    const spaeter = vi.fn()
    window.addEventListener('keydown', spaeter)
    try {
      render(<Explain textKey="explain.units.tank" subject="Kampfpanzer" />)
      fireEvent.click(screen.getByRole('button', { name: /Kampfpanzer/ }))
      fireEvent.keyDown(document.body, { key: 'Escape' })
      expect(spaeter).not.toHaveBeenCalled()

      // Zu ist es zu: der naechste Escape gehoert wieder der Oberflaeche.
      fireEvent.keyDown(document.body, { key: 'Escape' })
      expect(spaeter).toHaveBeenCalledTimes(1)
    } finally {
      window.removeEventListener('keydown', spaeter)
    }
  })

  it('schliesst auch bei einem Druck ausserhalb, nicht bei einem Druck darin', () => {
    render(
      <div>
        <Explain textKey="explain.units.tank" subject="Kampfpanzer" />
        <p>woanders</p>
      </div>,
    )
    fireEvent.click(screen.getByRole('button', { name: /Kampfpanzer/ }))

    fireEvent.pointerDown(screen.getByRole('note'))
    expect(screen.getByRole('note')).toBeTruthy()
    fireEvent.pointerDown(screen.getByText('woanders'))
    expect(screen.queryByRole('note')).toBeNull()
  })

  it('bleibt ohne Escape-Haken, solange es zu ist (kein Ohr auf der ganzen Seite)', () => {
    const add = vi.spyOn(document, 'addEventListener')
    render(<Explain textKey="explain.units.tank" subject="Kampfpanzer" />)
    expect(add.mock.calls.filter(([type]) => type === 'keydown')).toHaveLength(0)
    add.mockRestore()
  })

  it('legt den Text ueber das Raster, statt ihn in die Kachel zu klappen (position: absolute)', () => {
    expect(rule('.explain')).toMatch(/position:\s*relative/)
    const text = rule('.explain__text')
    expect(text).toMatch(/position:\s*absolute/)
    expect(text).toMatch(/z-index:/)
    // Es klebt am Fragezeichen und nimmt im Fluss keinen Platz ein.
    expect(text).toMatch(/top:\s*100%/)
  })

  it('traegt role="note" und bleibt mit dem Fragezeichen verbunden', () => {
    render(<Explain textKey="explain.buildings.barracks" subject="Kaserne" />)
    const toggle = screen.getByRole('button', { name: /Kaserne/ })
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-controls')).toBe(screen.getByRole('note').id)
  })
})

describe('Durchsicht B · Escape nimmt dem Fokus nichts weg, was nicht zur Erklärung gehört', () => {
  it('lässt den Fokus in einem Feld daneben, wenn Escape die Erklärung schließt (heute rot)', () => {
    render(
      <div>
        <Explain textKey="explain.buildings.barracks" subject="Kaserne" />
        <input aria-label="Feld daneben" />
      </div>,
    )
    fireEvent.click(screen.getByRole('button', { name: /Kaserne/ }))
    const feld = screen.getByLabelText('Feld daneben')
    feld.focus()
    fireEvent.keyDown(feld, { key: 'Escape' })
    expect(screen.queryByRole('note')).toBeNull()
    expect(document.activeElement).toBe(feld)
  })
})
