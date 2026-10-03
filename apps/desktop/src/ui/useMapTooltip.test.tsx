// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import type { PublicView } from '@worldwar/core'
import { afterEach, describe, expect, it } from 'vitest'
import { useMapTooltip, type MapTooltipInput } from './useMapTooltip.ts'

/**
 * R-UX-02/AK3 · Wer den Tooltip zeigt (T-M44-07, Befund B-06).
 *
 * Vorher galt `tooltipId = hover?.id ?? selectedProvince`: die Auswahl hielt den Kasten
 * auch dann, wenn sie mit der Maus gekommen und der Zeiger laengst weg war — und er lag
 * ueber der Depesche. Jetzt: der Zeiger zeigt, die Tastatur zeigt, sonst nichts, und
 * unter einem Dialog gar nichts.
 */

afterEach(cleanup)

const view = {
  tick: 0,
  playerId: 'p1',
  provinces: [
    { id: 'A', owner: 'p1', kind: 'city', terrain: 'plains', coastal: false, morale: 50_000, stale: false, asOfTick: 0 },
    { id: 'B', owner: 'p2', kind: 'rural', terrain: 'plains', coastal: false, stale: false, asOfTick: 0 },
  ],
  armies: [],
  battles: [],
} as unknown as PublicView

const base: MapTooltipInput = {
  selectedProvince: null,
  dialogOpen: false,
  mapView: { x: 0, y: 0, scale: 1 },
  view,
  centres: { A: { x: 10, y: 10 }, B: { x: 40, y: 40 } },
  nameOfProvince: (id) => id,
  nameOf: (id) => id,
  ticksPerDay: 24,
}

const mount = (input: Partial<MapTooltipInput> = {}) =>
  renderHook((props: Partial<MapTooltipInput>) => useMapTooltip({ ...base, ...props }), { initialProps: input })

/** Die Eingabeart vor der Auswahl: ein Tastendruck oder ein Druck mit Maus/Finger. */
const press = (kind: 'keyboard' | 'pointer') => {
  if (kind === 'keyboard') document.dispatchEvent(new Event('keydown', { bubbles: true }))
  else document.dispatchEvent(new Event('pointerdown', { bubbles: true }))
}

describe('R-UX-02/AK3 Der Zeiger zeigt, die Auswahl nur per Tastatur', () => {
  it('zeigt den Kasten ueber der Provinz unter dem Zeiger und nimmt ihn mit dem Zeiger wieder fort', () => {
    const { result } = mount()
    act(() => result.current.onHover('B', { x: 5, y: 6 }))
    expect(result.current.tooltip?.provinceId).toBe('B')
    expect(result.current.tooltipAt).toEqual({ x: 5, y: 6 })

    act(() => result.current.onHover(null, null))
    expect(result.current.tooltip).toBeNull()
  })

  it('zeigt nach einer Auswahl per Maus keinen Kasten, wenn der Zeiger weg ist (heute rot)', () => {
    const { result, rerender } = mount()
    act(() => press('pointer'))
    rerender({ selectedProvince: 'A' })
    expect(result.current.tooltip).toBeNull()

    // Auch nicht, nachdem der Zeiger die Karte betreten und wieder verlassen hat.
    act(() => result.current.onHover('A', { x: 1, y: 1 }))
    expect(result.current.tooltip?.provinceId).toBe('A')
    act(() => result.current.onHover(null, null))
    expect(result.current.tooltip).toBeNull()
  })

  it('zeigt nach einer Auswahl per Tastatur den Kasten an der Provinzmitte, als gewaehlt', () => {
    const { result, rerender } = mount()
    act(() => press('keyboard'))
    rerender({ selectedProvince: 'B' })

    expect(result.current.tooltip?.provinceId).toBe('B')
    expect(result.current.selected).toBe(true)
    expect(result.current.tooltipAt).toEqual({ x: 40, y: 40 })
  })

  it('behaelt die Art der Auswahl, wenn sich nur die Ansicht aendert, und fragt bei jeder neuen Auswahl neu', () => {
    const { result, rerender } = mount()
    act(() => press('keyboard'))
    rerender({ selectedProvince: 'A' })
    expect(result.current.tooltip).not.toBeNull()

    // Die Maus waehlt die naechste: der Kasten geht, obwohl vorher die Tastatur gewaehlt hat.
    act(() => press('pointer'))
    rerender({ selectedProvince: 'B' })
    expect(result.current.tooltip).toBeNull()
  })

  it('nennt den Zeiger-Kasten ueber der gewaehlten Provinz „gewaehlt", ueber einer anderen nicht', () => {
    const { result, rerender } = mount()
    act(() => press('pointer'))
    rerender({ selectedProvince: 'A' })
    act(() => result.current.onHover('A', { x: 1, y: 1 }))
    expect(result.current.selected).toBe(true)
    act(() => result.current.onHover('B', { x: 1, y: 1 }))
    expect(result.current.selected).toBe(false)
  })

  it('zeigt unter einem offenen Dialog nie einen Kasten, weder fuer den Zeiger noch fuer die Auswahl (heute rot)', () => {
    const { result, rerender } = mount()
    act(() => press('keyboard'))
    rerender({ selectedProvince: 'A' })
    act(() => result.current.onHover('B', { x: 1, y: 1 }))
    expect(result.current.tooltip).not.toBeNull()

    rerender({ selectedProvince: 'A', dialogOpen: true })
    expect(result.current.tooltip).toBeNull()

    // Und er kommt mit dem Dialog nicht von selbst zurueck, wenn der Zeiger fort ist.
    act(() => result.current.onHover(null, null))
    rerender({ selectedProvince: 'A', dialogOpen: false })
    expect(result.current.tooltip?.provinceId).toBe('A')
  })

  it('blendet mit Escape aus, bis sich Auswahl oder Zeiger aendern (T-M31-01 bleibt)', () => {
    const { result, rerender } = mount()
    act(() => press('keyboard'))
    rerender({ selectedProvince: 'A' })
    act(() => result.current.hide())
    expect(result.current.tooltip).toBeNull()

    act(() => press('keyboard'))
    rerender({ selectedProvince: 'B' })
    expect(result.current.tooltip?.provinceId).toBe('B')
  })
})
