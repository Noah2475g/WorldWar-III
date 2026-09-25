// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import type { PublicView } from '@worldwar/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyInputMode } from './inputMode.ts'
import { Tooltip, placeTooltip, tooltipFor } from './Tooltip.tsx'

/**
 * Der Tooltip auf dem Telefon (Android-Emulator, 2026-09-24).
 *
 * Zwei Dinge aendern sich im Touch-Betrieb: der Bedienhinweis spricht vom Tippen statt
 * vom Klicken und von Escape, und der Kasten steht ueber dem Finger statt darunter — die
 * Hand verdeckt, was unter ihr liegt. Fuer beide Eingabearten gilt: der Kasten bleibt auf
 * der Karte. Auf 640 x 360 ragte er sonst ueber die Seitenleiste oder aus dem Bild.
 */

let dispose: (() => void) | null = null

afterEach(() => {
  dispose?.()
  dispose = null
  vi.restoreAllMocks()
  cleanup()
})

const view = {
  tick: 100,
  playerId: 'nord',
  provinces: [{ id: 'A', owner: 'nord', kind: 'city', terrain: 'plains', coastal: false, stale: false, asOfTick: 100 }],
  armies: [],
  battles: [],
} as unknown as PublicView

const data = tooltipFor('A', view, { nameOf: () => 'Alpenland', playerName: () => 'Nordland', ticksPerDay: 24 })!

const KEIN_MASS = { width: 0, height: 0 }

describe('placeTooltip: neben dem Anker, aber auf der Karte', () => {
  it('bleibt ohne Masse (jsdom, erstes Bild) beim Versatz wie bisher', () => {
    expect(placeTooltip({ x: 10, y: 20 }, KEIN_MASS, KEIN_MASS)).toEqual({ left: 24, top: 34 })
  })

  it('bleibt rechts unten, wo Platz ist', () => {
    expect(placeTooltip({ x: 10, y: 20 }, { width: 200, height: 100 }, { width: 640, height: 360 })).toEqual({ left: 24, top: 34 })
  })

  it('klappt nach links, wenn rechts der Rand kommt', () => {
    expect(placeTooltip({ x: 500, y: 20 }, { width: 200, height: 100 }, { width: 640, height: 360 })).toEqual({ left: 286, top: 34 })
  })

  it('klappt nach oben, wenn unten der Rand kommt', () => {
    expect(placeTooltip({ x: 10, y: 300 }, { width: 200, height: 100 }, { width: 640, height: 360 })).toEqual({ left: 24, top: 186 })
  })

  it('haelt einen Kasten, der auf keiner Seite passt, an der Kante fest', () => {
    // 250 breit auf 300: rechts nicht, links auch nicht — dann buendig links.
    expect(placeTooltip({ x: 150, y: 100 }, { width: 250, height: 100 }, { width: 300, height: 240 })).toEqual({ left: 0, top: 114 })
    // Groesser als die Karte: oben links, nie mit negativem Versatz.
    expect(placeTooltip({ x: 150, y: 100 }, { width: 400, height: 300 }, { width: 300, height: 240 })).toEqual({ left: 0, top: 0 })
  })

  it('steht fuer den Finger ueber dem Anker, und unter ihm nur, wenn oben kein Platz ist', () => {
    expect(placeTooltip({ x: 10, y: 200 }, { width: 200, height: 100 }, { width: 640, height: 360 }, 'above')).toEqual({ left: 24, top: 86 })
    expect(placeTooltip({ x: 10, y: 50 }, { width: 200, height: 100 }, { width: 640, height: 360 }, 'above')).toEqual({ left: 24, top: 64 })
  })
})

describe('Tooltip: Hinweis und Lage je Eingabeart', () => {
  it('spricht im Mausbetrieb vom Klicken, wie bisher', () => {
    render(<Tooltip data={data} x={10} y={20} />)

    const tip = screen.getByRole('tooltip')
    expect(tip.querySelector('.tooltip__hint')!.textContent).toBe('Klicken: auswählen · Escape: schließen')
    expect(tip.style.left).toBe('24px')
    expect(tip.style.top).toBe('34px')
  })

  it('spricht im Touch-Betrieb vom Tippen und vom langen Druck', () => {
    dispose = applyInputMode({ location: { search: '?touch=1' }, document })
    render(<Tooltip data={data} x={10} y={20} />)

    const hint = screen.getByRole('tooltip').querySelector('.tooltip__hint')!.textContent
    expect(hint).toBe('Tippen: auswählen · Lange drücken: Details')
    expect(hint).not.toMatch(/Klick|Escape|Taste/)
  })

  it('misst Kasten und Karte und haelt den Kasten auf ihr', () => {
    vermessen()

    render(
      <div className="map-area">
        <Tooltip data={data} x={380} y={230} />
      </div>,
    )

    const tip = screen.getByRole('tooltip')
    // 380 + 14 + 200 > 397: nach links. 230 + 14 + 100 > 248: nach oben.
    expect(tip.style.left).toBe('166px')
    expect(tip.style.top).toBe('116px')
  })

  it('stellt den Kasten im Touch-Betrieb ueber den Finger', () => {
    vermessen()
    dispose = applyInputMode({ location: { search: '?touch=1' }, document })

    render(
      <div className="map-area">
        <Tooltip data={data} x={10} y={120} />
      </div>,
    )

    // Unten waere Platz (134 + 100 <= 248) — der Finger bekommt trotzdem den Platz darueber.
    expect(screen.getByRole('tooltip').style.top).toBe('6px')
  })
})

/** jsdom rechnet kein Layout: die Masse kommen aus einem Double, die Rechnung ist echt. */
function vermessen(): void {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('tooltip') ? 200 : 0
  })
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('tooltip') ? 100 : 0
  })
  vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(function (this: Element) {
    return this.classList.contains('map-area') ? 397 : 0
  })
  vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(function (this: Element) {
    return this.classList.contains('map-area') ? 248 : 0
  })
}
