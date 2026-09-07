// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { TOKENS } from '../tokens.ts'
import { LineChart, chartDomain, linePath } from './LineChart.tsx'

/**
 * Das Liniendiagramm der Lagekarte (T-M25-02, R-UI-13, D25.2).
 *
 * Eigene SVG-Komponente, keine Fremdbibliothek. Der Pfadraum ist bewusst 0…100 in
 * beiden Achsen (das viewBox-Rechteck), gestreckt per CSS — so ist die Rechnung mit
 * blossem Auge nachpruefbar und der Test bindet exakte Koordinaten statt Pixelraten.
 */

afterEach(cleanup)

/** Eine Farbe, wie sie aus der Sicht kaeme — kein Literal im Quelltext. */
const FARBE = TOKENS.good

describe('R-UI-13 linePath rechnet Tage und Werte in den Pfadraum', () => {
  it('spannt die Tage auf 0…100 und die Werte von unten (0) nach oben (Maximum)', () => {
    const punkte = [
      { day: 1, value: 0 },
      { day: 2, value: 130 },
      { day: 3, value: 260 },
    ]

    expect(linePath(punkte, { minDay: 1, maxDay: 3, maxValue: 260 })).toBe('M0,100 L50,50 L100,0')
  })

  it('rundet krumme Koordinaten auf eine Nachkommastelle', () => {
    const pfad = linePath([{ day: 1, value: 100 }, { day: 3, value: 200 }], {
      minDay: 1,
      maxDay: 4,
      maxValue: 300,
    })

    // Tag 3 von 1…4 → x 66.7; 100 von 300 → y 66.7, 200 von 300 → y 33.3.
    expect(pfad).toBe('M0,66.7 L66.7,33.3')
  })

  it('laesst eine Reihe mit weniger als zwei Punkten ohne Pfad', () => {
    expect(linePath([{ day: 1, value: 5 }], { minDay: 1, maxDay: 3, maxValue: 10 })).toBe('')
  })
})

describe('R-UI-13 chartDomain nimmt das Maximum ueber alle Reihen', () => {
  it('findet Spanne und Hoechstwert', () => {
    const domain = chartDomain([
      { id: 'a', label: 'A', color: FARBE, points: [{ day: 2, value: 10 }] },
      { id: 'b', label: 'B', color: FARBE, points: [{ day: 5, value: 40 }] },
    ])

    expect(domain).toEqual({ minDay: 2, maxDay: 5, maxValue: 40 })
  })

  it('faellt bei lauter Nullen auf ein Maximum von eins zurueck — nie durch null teilen', () => {
    const domain = chartDomain([{ id: 'a', label: 'A', color: FARBE, points: [{ day: 1, value: 0 }, { day: 2, value: 0 }] }])

    expect(domain.maxValue).toBe(1)
  })
})

describe('R-UI-13 LineChart zeichnet Reihen, Legende und Beschreibung', () => {
  const reihen = [
    {
      id: 'p1',
      label: 'Nordland',
      color: FARBE,
      points: [
        { day: 1, value: 0 },
        { day: 3, value: 260 },
      ],
    },
  ]

  it('gibt jeder Reihe einen Pfad mit ihrer Kennung und Farbe', () => {
    const { container } = render(<LineChart series={reihen} ariaLabel="Punkteverlauf" />)

    const pfad = container.querySelector('path[data-series="p1"]') as SVGPathElement
    expect(pfad).toBeTruthy()
    expect(pfad.getAttribute('d')).toBe('M0,100 L100,0')
    expect(pfad.classList.contains('chart__line')).toBe(true)
  })

  it('nennt die Reihe in der Legende und beschreibt das Bild fuers Ohr', () => {
    const { container } = render(<LineChart series={reihen} ariaLabel="Punkteverlauf: Nordland 260" />)

    expect(container.querySelector('.chart__legend')?.textContent).toContain('Nordland')
    expect(container.querySelector('svg')?.getAttribute('aria-label')).toBe('Punkteverlauf: Nordland 260')
  })
})
