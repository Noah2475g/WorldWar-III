// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { BUILDING_ICONS, ICON_NAMES, Icon, RESOURCE_ICONS, UNIT_ICONS } from './icons.tsx'

/** The rules as they are shipped — the set has to cover those, not a test fixture. */
const ROOT = process.cwd()
const rulesFile = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(`${ROOT}/data/rules/default/${name}.json`, 'utf8')) as Record<string, unknown>

/**
 * The icon set (T-M11-01, R-ASSET-01).
 *
 * What matters is completeness and provenance: every unit and every building the rules
 * define needs a symbol, and every symbol is drawn here rather than taken from
 * somewhere. Nothing in this file came from anyone else.
 */

afterEach(cleanup)

describe('R-UI-04 Icons', () => {
  it('zeichnet jedes Icon', () => {
    for (const name of ICON_NAMES) {
      const { container, unmount } = render(<Icon name={name} />)
      const path = container.querySelector('path')
      expect(path?.getAttribute('d')?.length, name).toBeGreaterThan(10)
      unmount()
    }
  })

  it('nimmt die Farbe des umgebenden Textes an', () => {
    // So an icon in a warning is the warning's colour without a second asset.
    const { container } = render(<Icon name="battle" />)

    expect(container.querySelector('svg')?.getAttribute('stroke')).toBe('currentColor')
  })

  it('ist ohne Beschriftung fuer Vorleseprogramme unsichtbar', () => {
    // A decorative icon beside its own label would be read out twice.
    const { container } = render(<Icon name="infantry" />)

    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('bekommt mit Beschriftung eine Rolle und einen Titel', () => {
    render(<Icon name="battle" title="Gefecht" />)

    expect(screen.getByRole('img', { name: 'Gefecht' })).toBeTruthy()
  })

  it('kennt ein Symbol fuer jede Einheit und jedes Gebaeude', () => {
    for (const [key, icon] of Object.entries(UNIT_ICONS)) {
      expect(ICON_NAMES, `${key} zeigt auf ${icon}`).toContain(icon)
    }
    for (const [key, icon] of Object.entries(BUILDING_ICONS)) {
      expect(ICON_NAMES, `${key} zeigt auf ${icon}`).toContain(icon)
    }
  })
})

describe('R-UI-10 Der Satz deckt die ausgelieferten Regeln', () => {
  // The old set answered to keys the rules never had ("cavalry", "mine") and had no
  // answer for keys they do have ("motorized", "shipyard"). A symbol table that does
  // not match the rules is a table that silently draws nothing.
  it('hat ein Symbol fuer jedes Gebaeude der Regeln', () => {
    const buildings = Object.keys((rulesFile('buildings').buildings ?? {}) as object)

    expect(buildings.length).toBeGreaterThan(5)
    for (const key of buildings) {
      expect(BUILDING_ICONS[key], `Gebaeude "${key}" ohne Symbol`).toBeTruthy()
    }
  })

  it('hat ein Symbol fuer jede Einheit der Regeln', () => {
    const units = Object.keys((rulesFile('units').units ?? {}) as object)

    expect(units.length).toBeGreaterThan(5)
    for (const key of units) {
      expect(UNIT_ICONS[key], `Einheit "${key}" ohne Symbol`).toBeTruthy()
    }
  })

  it('hat ein Symbol fuer jeden Rohstoff der Regeln', () => {
    const resources = Object.keys((rulesFile('resources').resources ?? {}) as object)

    expect(resources.length).toBeGreaterThan(5)
    for (const key of resources) {
      expect(RESOURCE_ICONS[key], `Rohstoff "${key}" ohne Symbol`).toBeTruthy()
    }
  })

  it('kennt keinen Schluessel, den die Regeln nicht haben', () => {
    // The other direction, and it matters just as much: a table entry for a unit that
    // does not exist is dead weight that looks like coverage.
    const units = new Set(Object.keys((rulesFile('units').units ?? {}) as object))
    const buildings = new Set(Object.keys((rulesFile('buildings').buildings ?? {}) as object))

    for (const key of Object.keys(UNIT_ICONS)) {
      expect(units.has(key), `"${key}" steht im Symbolsatz, aber nicht in den Regeln`).toBe(true)
    }
    for (const key of Object.keys(BUILDING_ICONS)) {
      expect(buildings.has(key), `"${key}" steht im Symbolsatz, aber nicht in den Regeln`).toBe(true)
    }
  })
})
