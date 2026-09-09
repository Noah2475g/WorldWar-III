// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Sparkline, sparklinePoints } from './Sparkline.tsx'

/**
 * Die Sparkline (T-M25-03, R-UI-13, D25.2): ein Sieben-Tage-Fenster als kleine Linie
 * in der Tabellenzelle. Wie beim Liniendiagramm ist der Punktraum 0…100 und wird per
 * CSS auf eine feste schmale Breite gebracht — die Zelle bleibt schmal, die Leiste
 * scrollt nicht seitwaerts (T-M22-02).
 */

afterEach(cleanup)

describe('R-UI-13 sparklinePoints spannt die Werte in den Punktraum', () => {
  it('normalisiert auf die eigene Spanne: Minimum unten, Maximum oben', () => {
    expect(sparklinePoints([100, 250, 400])).toBe('0,100 50,50 100,0')
  })

  it('legt eine flache Reihe in die Mitte statt an den Boden', () => {
    expect(sparklinePoints([70, 70, 70])).toBe('0,50 50,50 100,50')
  })

  it('gibt unter zwei Werten nichts — ein Punkt ist kein Verlauf', () => {
    expect(sparklinePoints([])).toBe('')
    expect(sparklinePoints([42])).toBe('')
  })
})

describe('R-UI-13 Sparkline zeichnet die Linie stumm', () => {
  it('traegt die Punkte als polyline und spricht nicht mit', () => {
    const { container } = render(<Sparkline values={[100, 250, 400]} />)
    const svg = container.querySelector('svg.sparkline')

    expect(svg?.getAttribute('aria-hidden')).toBe('true')
    expect(svg?.querySelector('polyline')?.getAttribute('points')).toBe('0,100 50,50 100,0')
  })

  it('zeichnet unter zwei Werten gar nichts', () => {
    const { container } = render(<Sparkline values={[42]} />)

    expect(container.querySelector('.sparkline')).toBeNull()
  })
})
