// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { BUILDING_ICONS, ICON_NAMES, Icon, UNIT_ICONS } from './icons.tsx'

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
