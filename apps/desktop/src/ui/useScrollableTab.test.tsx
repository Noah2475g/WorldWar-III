// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useScrollableTab } from './useScrollableTab.ts'

/**
 * R-UX-06/AK1 (T-M44-08, Befund B-10): ein Bereich, der rollt, nimmt den Tastaturfokus — und nur
 * dann. jsdom rechnet kein Layout; die Maße werden hier gesetzt, die Messung im echten Fenster
 * macht `pnpm ux:check --only R-UX-06/AK1` (axe `scrollable-region-focusable`).
 */

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function Leiste() {
  const scroll = useScrollableTab<HTMLUListElement>()
  return (
    <ul aria-label="Rohstoffe" ref={scroll.ref} tabIndex={scroll.tabIndex}>
      <li>Eisen</li>
    </ul>
  )
}

const maße = (scrollWidth: number, clientWidth: number) => {
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', { configurable: true, get: () => scrollWidth })
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => clientWidth })
}

describe('R-UX-06/AK1 Ein rollender Bereich ist mit der Tastatur erreichbar', () => {
  it('bekommt tabindex 0, wenn der Inhalt breiter ist als der Bereich', () => {
    maße(478, 375)
    render(<Leiste />)

    expect(screen.getByLabelText('Rohstoffe').getAttribute('tabindex')).toBe('0')
  })

  it('bekommt keinen Tabstopp, wenn alles hineinpasst', () => {
    maße(375, 375)
    render(<Leiste />)

    expect(screen.getByLabelText('Rohstoffe').hasAttribute('tabindex')).toBe(false)
  })

  it('misst neu, wenn der Bereich oder ein Kind seine Größe ändert', () => {
    maße(375, 375)
    let melde: () => void = () => undefined
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          melde = callback
        }
        observe() {}
        disconnect() {}
      },
    )
    render(<Leiste />)
    expect(screen.getByLabelText('Rohstoffe').hasAttribute('tabindex')).toBe(false)

    maße(520, 375)
    melde()

    return vi.waitFor(() => expect(screen.getByLabelText('Rohstoffe').getAttribute('tabindex')).toBe('0'))
  })

  it('die Kopfleiste setzt ihn an der Rohstoffleiste ein', () => {
    const quelle = readFileSync(`${process.cwd()}/apps/desktop/src/ui/Header.tsx`, 'utf8')
    expect(quelle).toContain("useScrollableTab<HTMLUListElement>()")
    expect(quelle).toMatch(/className="resources"[^>]*tabIndex=\{resourcesScroll\.tabIndex\}/)
  })
})
