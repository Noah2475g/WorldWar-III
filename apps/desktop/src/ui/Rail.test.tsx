// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RAIL_ENTRIES, Rail, SIDE_LAST_AREA_KEY, isRailArea, readLastSideArea } from './Rail.tsx'

/** Seitenleiste v3b E3 (D6, D28): die Leiste rechts. */
afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

const noop = () => undefined

describe('E3 Leiste rechts', () => {
  it('hat sieben Eintraege in fester Reihenfolge, mit Taste als Marke, und oben den Umschalter', () => {
    const { container } = render(<Rail active={null} open={false} unread={0} onArea={noop} onToggle={noop} />)
    const rail = container.querySelector('nav.rail')!
    expect(rail).toBeTruthy()
    const items = [...rail.querySelectorAll<HTMLButtonElement>('button.rail__item[data-area]')]
    expect(items.map((item) => item.dataset.area)).toEqual(['diplomacy', 'market', 'armies', 'espionage', 'standings', 'economy', 'log'])
    expect(items.map((item) => item.querySelector('.rail__key')?.textContent ?? '')).toEqual(['D', 'H', 'A', 'S', 'L', '', ''])
    for (const item of items) expect(item.querySelector('.rail__name')?.textContent).toBeTruthy()
    expect(rail.firstElementChild?.className).toBe('rail__toggle')
    expect(RAIL_ENTRIES).toHaveLength(7)
  })

  it('markiert den offenen Bereich und meldet Klicks mit dem Ausloeser', () => {
    const onArea = vi.fn()
    const onToggle = vi.fn()
    const { container } = render(<Rail active="market" open unread={0} onArea={onArea} onToggle={onToggle} />)
    const market = container.querySelector<HTMLButtonElement>('[data-area="market"]')!
    expect(market.getAttribute('aria-pressed')).toBe('true')
    expect(container.querySelector('[data-area="log"]')!.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(market)
    expect(onArea).toHaveBeenCalledWith('market', market)
    const toggle = container.querySelector<HTMLButtonElement>('.rail__toggle')!
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(toggle)
    expect(onToggle).toHaveBeenCalledWith(toggle)
  })

  it('zeigt den Ungelesen-Zaehler nur an der Rangliste und nur ab 1', () => {
    const { container, rerender } = render(<Rail active={null} open={false} unread={0} onArea={noop} onToggle={noop} />)
    expect(container.querySelector('.badge')).toBeNull()
    rerender(<Rail active={null} open={false} unread={12} onArea={noop} onToggle={noop} />)
    const badges = container.querySelectorAll('.badge')
    expect(badges).toHaveLength(1)
    expect(container.querySelector('.rail__item[data-area="standings"] .badge')?.textContent).toBe('12')
  })

  it('merkt sich den letzten Bereich; frisch oder unbekannt gilt Diplomatie', () => {
    expect(readLastSideArea()).toBe('diplomacy')
    window.localStorage.setItem(SIDE_LAST_AREA_KEY, 'log')
    expect(readLastSideArea()).toBe('log')
    window.localStorage.setItem(SIDE_LAST_AREA_KEY, 'province')
    expect(readLastSideArea()).toBe('diplomacy')
    expect(isRailArea('economy')).toBe(true)
    expect(isRailArea('army')).toBe(false)
  })
})
