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
  it('spannt die Tage auf 0…100 und die Werte von unten (minValue) nach oben (maxValue)', () => {
    const punkte = [
      { day: 1, value: 0 },
      { day: 2, value: 130 },
      { day: 3, value: 260 },
    ]

    expect(linePath(punkte, { minDay: 1, maxDay: 3, minValue: 0, maxValue: 260 })).toBe('M0,100 L50,50 L100,0')
  })

  it('rundet krumme Koordinaten auf eine Nachkommastelle', () => {
    const pfad = linePath([{ day: 1, value: 100 }, { day: 3, value: 200 }], {
      minDay: 1,
      maxDay: 4,
      minValue: 0,
      maxValue: 300,
    })

    // Tag 3 von 1…4 → x 66.7; 100 von 300 → y 66.7, 200 von 300 → y 33.3.
    expect(pfad).toBe('M0,66.7 L66.7,33.3')
  })

  it('rechnet gegen die untere Skalengrenze, nicht gegen null (T-M28-01)', () => {
    // Punktestaende 2 800…10 000 nutzten mit 0-Basis nur das obere Fuenftel; die Skala
    // beginnt jetzt bei minValue. 100 liegt in 100…200 unten, 200 oben.
    const pfad = linePath([{ day: 1, value: 100 }, { day: 2, value: 200 }], {
      minDay: 1,
      maxDay: 2,
      minValue: 100,
      maxValue: 200,
    })

    expect(pfad).toBe('M0,100 L100,0')
  })

  it('laesst eine Reihe mit weniger als zwei Punkten ohne Pfad', () => {
    expect(linePath([{ day: 1, value: 5 }], { minDay: 1, maxDay: 3, minValue: 0, maxValue: 10 })).toBe('')
  })
})

describe('R-UI-13 chartDomain spannt die Skala von min−Rand bis max+Rand (T-M28-01)', () => {
  it('findet Spanne und Wertgrenzen mit einem Zehntel Rand', () => {
    // Werte 10…40, Spanne 30, Rand 3: die Skala laeuft 7…43 — die 0-Basis ist weg,
    // acht flache Tage druecken die Kurve nicht mehr an den oberen Rand.
    const domain = chartDomain([
      { id: 'a', label: 'A', color: FARBE, points: [{ day: 2, value: 10 }] },
      { id: 'b', label: 'B', color: FARBE, points: [{ day: 5, value: 40 }] },
    ])

    expect(domain).toEqual({ minDay: 2, maxDay: 5, minValue: 7, maxValue: 43 })
  })

  it('gibt einer flachen Reihe mindestens einen Rand von eins — nie durch null teilen', () => {
    const domain = chartDomain([{ id: 'a', label: 'A', color: FARBE, points: [{ day: 1, value: 0 }, { day: 2, value: 0 }] }])

    expect(domain.minValue).toBe(-1)
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
    // Werte 0…260, Rand 26: die Skala laeuft −26…286, also 0 → y 91.7 und 260 → y 8.3
    // (T-M28-01) — gegen die alte 0-Basis ('M0,100 L100,0') faellt dieser Test.
    expect(pfad.getAttribute('d')).toBe('M0,91.7 L100,8.3')
    expect(pfad.classList.contains('chart__line')).toBe(true)
  })

  it('schreibt den Endwert jeder Linie an den rechten Rand (T-M28-01)', () => {
    const { container } = render(<LineChart series={reihen} ariaLabel="Punkteverlauf" />)

    const endwert = container.querySelector('.chart__endvalue[data-series="p1"]') as HTMLElement
    expect(endwert, 'kein Endwert am rechten Rand').toBeTruthy()
    expect(endwert.textContent).toBe('260')
    // Auf der Hoehe des letzten Punkts: 260 in der Skala −26…286 liegt bei 8.3 %.
    expect(endwert.style.top).toBe('8.3%')
    // jsdom normalisiert Hex zu rgb(): gebunden wird, DASS die Reihenfarbe ankommt.
    const rgb = (hex: string) => `rgb(${[1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16)).join(', ')})`
    expect(endwert.style.color).toBe(rgb(TOKENS.good))
  })

  it('nennt die Reihe in der Legende und beschreibt das Bild fuers Ohr', () => {
    const { container } = render(<LineChart series={reihen} ariaLabel="Punkteverlauf: Nordland 260" />)

    expect(container.querySelector('.chart__legend')?.textContent).toContain('Nordland')
    expect(container.querySelector('svg')?.getAttribute('aria-label')).toBe('Punkteverlauf: Nordland 260')
  })
})
