// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SHEET_SNAPS, SheetHandle, SheetNav, nextSnap, type SheetSnap } from './Sheet.tsx'
import { t } from '../i18n/text.ts'

/**
 * Das Blatt (T-M44-03b, R-UX-01): die Seitenleiste des Telefons im Hochformat hat drei Rasten
 * (Streifen, halb, voll). Der Griff ist ein Knopf: Klick, Pfeiltasten und Wischen schalten, Escape
 * schliesst. Die Hoehe der Rasten steht in touch.css (`--map-h` je `data-sheet`).
 */

afterEach(cleanup)

const handle = (snap: SheetSnap, extra: { onSnap?: (s: SheetSnap) => void; onClose?: () => void } = {}) =>
  render(<SheetHandle snap={snap} onSnap={extra.onSnap ?? (() => undefined)} onClose={extra.onClose ?? (() => undefined)} />)

describe('R-UX-01 T-M44-03b Das Blatt hat drei Rasten', () => {
  it('kennt Streifen, halb und voll — in dieser Reihenfolge', () => {
    expect(SHEET_SNAPS).toEqual(['peek', 'half', 'full'])
  })

  it('nextSnap geht eine Raste weiter und bleibt am Rand stehen', () => {
    expect(nextSnap('half', 'up')).toBe('full')
    expect(nextSnap('half', 'down')).toBe('peek')
    expect(nextSnap('full', 'up')).toBe('full')
    expect(nextSnap('peek', 'down')).toBe('peek')
  })

  it('der Griff nennt die Raste im Text und ist ein Knopf', () => {
    handle('half')
    const button = screen.getByRole('button', { name: new RegExp(t('sheet.handle')) })
    expect(button.textContent).toContain(t('sheet.snap.half'))
    // Zeitlimit wegen Last, nicht Verhalten: allein 451 ms, unter verify+Last max 8175 ms (gemessen 2026-10-05, t_3cad0a35).
  }, 30_000)

  it('ein Klick schaltet reihum weiter (Streifen, halb, voll, Streifen)', () => {
    const onSnap = vi.fn()
    for (const [from, to] of [['peek', 'half'], ['half', 'full'], ['full', 'peek']] as const) {
      onSnap.mockClear()
      const { unmount } = handle(from, { onSnap })
      fireEvent.click(screen.getByRole('button'))
      expect(onSnap, `von ${from}`).toHaveBeenCalledWith(to)
      unmount()
    }
    // Zeitlimit wegen Last, nicht Verhalten: allein 116 ms, unter verify+Last max 2712 ms (gemessen 2026-10-05, t_3cad0a35).
  }, 20_000)

  it('Pfeil hoch vergroessert, Pfeil runter verkleinert, Escape schliesst', () => {
    const onSnap = vi.fn()
    const onClose = vi.fn()
    handle('half', { onSnap, onClose })
    const button = screen.getByRole('button')
    fireEvent.keyDown(button, { key: 'ArrowUp' })
    expect(onSnap).toHaveBeenLastCalledWith('full')
    fireEvent.keyDown(button, { key: 'ArrowDown' })
    expect(onSnap).toHaveBeenLastCalledWith('peek')
    fireEvent.keyDown(button, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('Wischen nach oben vergroessert, nach unten verkleinert, ein Tippen schaltet nicht doppelt', () => {
    const onSnap = vi.fn()
    handle('half', { onSnap })
    const button = screen.getByRole('button')
    fireEvent.pointerDown(button, { clientY: 400, pointerId: 1 })
    fireEvent.pointerUp(button, { clientY: 330, pointerId: 1 })
    expect(onSnap).toHaveBeenLastCalledWith('full')
    fireEvent.pointerDown(button, { clientY: 400, pointerId: 1 })
    fireEvent.pointerUp(button, { clientY: 470, pointerId: 1 })
    expect(onSnap).toHaveBeenLastCalledWith('peek')
    onSnap.mockClear()
    fireEvent.pointerDown(button, { clientY: 400, pointerId: 1 })
    fireEvent.pointerUp(button, { clientY: 398, pointerId: 1 })
    expect(onSnap).not.toHaveBeenCalled()
  })

  it('ein Wisch schaltet genau einmal, auch wenn danach der Klick folgt', () => {
    const onSnap = vi.fn()
    handle('half', { onSnap })
    const button = screen.getByRole('button')
    fireEvent.pointerDown(button, { clientY: 400, pointerId: 1 })
    fireEvent.pointerUp(button, { clientY: 330, pointerId: 1 })
    fireEvent.click(button)
    expect(onSnap).toHaveBeenCalledTimes(1)
  })
})

describe('R-UX-01 T-M44-03b Das Blatt im Stylesheet', () => {
  const touch = readFileSync(`${process.cwd()}/apps/desktop/src/ui/touch.css`, 'utf8')

  it('der Griff ist nur im Hochformat des Telefons sichtbar und nimmt dem Browser das Wischen ab', () => {
    expect(touch).toMatch(/\.sheet__handle \{[^}]*display: none;/)
    const portrait = touch.slice(touch.indexOf('(max-width: 599px) and (orientation: portrait)'))
    expect(portrait).toMatch(/:root:root \.sheet__handle \{[^}]*display: flex;[^}]*touch-action: none;/)
  })

  it('jede Raste hat ihre Kartenhoehe, halb bleibt bei 31 dvh (R-UX-01/AK1 mit Panel >= 0,30)', () => {
    expect(touch).toMatch(/data-sheet='peek'\][^{]*\{[^}]*--map-h: 58dvh;/)
    expect(touch).toMatch(/data-sheet='full'\][^{]*\{[^}]*--map-h: 12dvh;/)
    expect(touch).toMatch(/data-panel="open"\] \{[^}]*--map-h: 31dvh;/)
  })
})

describe('T-M46-10 Die Panelwahl im Kopf des Blatts', () => {
  it('bietet Diplomatie, Markt, Heer, Spionage und Lage als Knoepfe mit Namen', () => {
    render(<SheetNav active={null} onPanel={() => undefined} />)
    const names = screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'))
    // Seit E3 (D7) dazu Wirtschaft und Protokoll: der Fuss, der sie trug, entfaellt.
    expect(names).toEqual(['Diplomatie', 'Markt', 'Heer', 'Spionage', 'Rangliste / Sieg', 'Wirtschaft', 'Protokoll'])
  })

  it('meldet das gewaehlte Panel und markiert das offene', () => {
    const onPanel = vi.fn()
    render(<SheetNav active="market" onPanel={onPanel} />)
    expect(screen.getByRole('button', { name: 'Markt' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Heer' }).getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(screen.getByRole('button', { name: 'Heer' }))
    expect(onPanel).toHaveBeenCalledWith('armies')
    // Zeitlimit wegen Last, nicht Verhalten: allein 61 ms, unter verify+Last max 3058 ms (gemessen 2026-10-05, t_3cad0a35).
  }, 20_000)
})
