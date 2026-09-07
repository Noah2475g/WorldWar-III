// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { DeltaBar, deltaWidth } from './DeltaBar.tsx'

/**
 * Der ±-Balken (T-M25-03/-04, R-UI-05, D25.2): eine Komponente fuer Wirtschaftstabelle
 * UND Tagesbericht. Positiv waechst er nach rechts (gruen), negativ nach links
 * (zinnober), null ist ein Strich. Er ist ein Bild ohne Stimme — die Zahl daneben
 * bleibt der zugaengliche Wert.
 */

afterEach(cleanup)

describe('R-UI-05 deltaWidth misst den Betrag gegen das Maximum', () => {
  it('gibt dem groessten Betrag die halbe Spur und skaliert den Rest', () => {
    expect(deltaWidth(120, 120)).toBe(50)
    expect(deltaWidth(-40, 120)).toBe(16.7)
  })

  it('haelt einen winzigen Wert sichtbar, statt ihn auf null zu runden', () => {
    expect(deltaWidth(1, 10_000)).toBe(2)
  })

  it('gibt bei null oder unbrauchbarem Massstab keine Breite', () => {
    expect(deltaWidth(0, 100)).toBe(0)
    expect(deltaWidth(50, 0)).toBe(0)
    expect(deltaWidth(Number.NaN, 100)).toBe(0)
  })
})

describe('R-UI-05 DeltaBar zeichnet Richtung und Null', () => {
  it('waechst positiv nach rechts und negativ nach links', () => {
    const plus = render(<DeltaBar value={120} max={120} />)
    const fill = plus.container.querySelector('.delta__fill--plus') as HTMLElement
    expect(fill.style.left).toBe('50%')
    expect(fill.style.width).toBe('50%')
    plus.unmount()

    const minus = render(<DeltaBar value={-60} max={120} />)
    const gegen = minus.container.querySelector('.delta__fill--minus') as HTMLElement
    expect(gegen.style.right).toBe('50%')
    expect(gegen.style.width).toBe('25%')
  })

  it('zeigt null als Strich und bleibt fuers Ohr stumm', () => {
    const { container } = render(<DeltaBar value={0} max={120} />)

    expect(container.querySelector('.delta__zero')).toBeTruthy()
    expect(container.querySelector('.delta__fill')).toBeNull()
    expect(container.querySelector('.delta')?.getAttribute('aria-hidden')).toBe('true')
  })
})
