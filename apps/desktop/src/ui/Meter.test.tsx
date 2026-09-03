// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Meter, fillFraction, trendOf } from './Meter.tsx'

/**
 * The bar (T-M13-06, R-UI-09, R-UI-02).
 *
 * A bar exists so a value can be compared without being read. That only works if it is
 * still a value: it carries `role="meter"` with its numbers, and the figure stays
 * beside it in words. A picture of a number that a screen reader cannot read is not an
 * improvement over the number.
 */

afterEach(cleanup)

describe('R-UI-09 Der Balken ist eine Zahl, kein Bild', () => {
  it('nennt Wert, Minimum und Maximum fuer Vorleseprogramme', () => {
    render(<Meter label="Moral" value={70} max={100} text="70 %" />)

    const meter = screen.getByRole('meter', { name: 'Moral' })
    expect(meter.getAttribute('aria-valuenow')).toBe('70')
    expect(meter.getAttribute('aria-valuemin')).toBe('0')
    expect(meter.getAttribute('aria-valuemax')).toBe('100')
  })

  it('laesst die Zahl daneben stehen', () => {
    render(<Meter label="Moral" value={70} max={100} text="70 %" />)

    expect(screen.getByText('70 %')).toBeTruthy()
  })

  it('fuellt anteilig', () => {
    expect(fillFraction(0, 100)).toBe(0)
    expect(fillFraction(25, 100)).toBe(0.25)
    expect(fillFraction(100, 100)).toBe(1)
  })

  it('laeuft nicht ueber und nicht unter', () => {
    // A morale of 105 % out of a rounding error must not draw past the end of its track.
    expect(fillFraction(150, 100)).toBe(1)
    expect(fillFraction(-20, 100)).toBe(0)
    expect(fillFraction(5, 0)).toBe(0)
  })

  it('nimmt seine Farbe aus den Token, nie aus einem Literal', () => {
    const { container } = render(<Meter label="Moral" value={70} max={100} text="70 %" tone="warn" />)
    const fill = container.querySelector('.meter__fill') as HTMLElement

    // The value drives the width; the tone drives a class, not an inline colour.
    expect(fill.style.width).toBe('70%')
    expect(fill.style.background).toBe('')
    expect(fill.className).toContain('meter__fill--warn')
  })
})

describe('R-UI-09 Der Trendpfeil', () => {
  it('zeigt aufwaerts, wenn das Ziel ueber dem Wert liegt', () => {
    expect(trendOf(60, 80, 100)).toBe('up')
  })

  it('zeigt abwaerts, wenn das Ziel darunter liegt', () => {
    expect(trendOf(80, 60, 100)).toBe('down')
  })

  it('zeigt nichts bei Gleichstand und ohne Ziel', () => {
    expect(trendOf(70, 70, 100)).toBeNull()
    expect(trendOf(70, undefined, 100)).toBeNull()
    // A difference too small to matter is not a trend either — and the scale has to
    // be named, because morale is 0…100 000 in the core and 0…100 on screen.
    expect(trendOf(70_000, 70_400, 100_000)).toBeNull()
  })

  it('sagt in Worten, wohin es geht', () => {
    render(<Meter label="Moral" value={60} max={100} text="60 %" trend="up" />)

    expect(screen.getByRole('meter', { name: /Moral/ }).textContent).toContain('steigend')
  })
})
