// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
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
