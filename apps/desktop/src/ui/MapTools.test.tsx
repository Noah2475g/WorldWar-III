// @vitest-environment jsdom
import { createRef } from 'react'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MapTools, ZOOM_TIER_SCALE } from './MapTools.tsx'
import { zoomTier } from '../map/picking.ts'

/** Seitenleiste v3b E3 (D8): die Werkzeug-Spalte oben rechts. */
afterEach(cleanup)

const setup = (over: Partial<Parameters<typeof MapTools>[0]> = {}) => {
  const props = {
    tier: 'mid' as const,
    mode: 'political' as const,
    capitalDisabled: false,
    fullscreen: null,
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onHome: vi.fn(),
    onTier: vi.fn(),
    onMode: vi.fn(),
    overviewRef: createRef<HTMLCanvasElement>(),
    overviewSize: { width: 132, height: 74 },
    onOverviewClick: vi.fn(),
    legend: <div className="legend">L</div>,
    ...over,
  }
  return { props, ...render(<MapTools {...props} />) }
}

describe('E3 Werkzeug-Spalte', () => {
  it('stapelt Zoom, drei Zoomstufen, Kartenmodus, Uebersicht und Legende in einer Spalte', () => {
    const { container } = setup()
    const col = container.querySelector('.map-tools-col')!
    expect([...col.children].map((child) => child.className.split(' ')[0])).toEqual([
      'map-controls',
      'map-tiers',
      'map-tools',
      'map-overview',
      'legend',
    ])
    expect(col.querySelectorAll('.map-control')).toHaveLength(3)
  })

  it('markiert die aktive Stufe und meldet einen Klick auf eine Stufe', () => {
    const { container, props } = setup({ tier: 'near' })
    const tiers = [...container.querySelectorAll<HTMLButtonElement>('.map-tier')]
    expect(tiers.map((tier) => tier.textContent)).toEqual(['Welt', 'Region', 'Nah'])
    expect(tiers.map((tier) => tier.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true'])
    fireEvent.click(tiers[0]!)
    expect(props.onTier).toHaveBeenCalledWith('far')
  })

  it('setzt die Stufen auf Massstaebe, die zoomTier wieder als dieselbe Stufe liest', () => {
    expect(ZOOM_TIER_SCALE).toEqual({ far: 2.5, mid: 1.6, near: 0.97 })
    for (const [tier, scale] of Object.entries(ZOOM_TIER_SCALE)) expect(zoomTier(scale)).toBe(tier)
  })

  it('reicht Zoom und Heimweg durch; ohne Hauptstadt ist ⌂ gesperrt', () => {
    const { container, props } = setup({ capitalDisabled: true })
    const [plus, minus, home] = [...container.querySelectorAll<HTMLButtonElement>('.map-control')]
    fireEvent.click(plus!)
    fireEvent.click(minus!)
    expect(props.onZoomIn).toHaveBeenCalledTimes(1)
    expect(props.onZoomOut).toHaveBeenCalledTimes(1)
    expect(home!.disabled).toBe(true)
  })
})
