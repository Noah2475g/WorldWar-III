// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { Toaster, toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MESSAGE_ROUTE, NOTICE_DURATION, NOTICE_ID, error, ack, info, showNotice, warn } from './notice.ts'

/**
 * Meldungen als Toast (Seitenleiste v3b E1, D2/D21): ein Toast, eine id, kein verschachteltes aria-live.
 * Echter <Toaster>, Fake-Timer; sonner zeigt per setTimeout(0) und raeumt 200 ms nach dem Ablauf auf.
 */

const toasts = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('[data-sonner-toast]')]
/** Im DOM stehende, nicht abtretende Toasts. */
const live = (): HTMLElement[] => toasts().filter((el) => el.getAttribute('data-removed') !== 'true')

const wait = (ms: number): void => {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0) as unknown as number)
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
  render(<Toaster visibleToasts={1} position="bottom-left" />)
  wait(10)
})

afterEach(() => {
  act(() => {
    toast.dismiss()
    vi.advanceTimersByTime(1000)
  })
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('Toast-Meldungen (D2)', () => {
  it('(a) eine Quittung und dann ein Fehler: genau ein Toast, der Text ist der Fehler', () => {
    act(() => ack('✓ befohlen: Kaserne bauen'))
    wait(10)
    expect(toasts().length).toBe(1)
    expect(toasts()[0]!.querySelector('.notice--ack')).not.toBeNull()
    expect(toasts()[0]!.querySelector('.action__pending')).not.toBeNull()

    act(() => error('Das Ziel ist ungültig.'))
    wait(10)
    expect(toasts().length).toBe(1)
    expect(toasts()[0]!.textContent).toContain('Das Ziel ist ungültig.')
    expect(toasts()[0]!.querySelector('.notice--error')).not.toBeNull()
    expect(NOTICE_ID).toBe('notice')
  })

  it('(b) nach der neuen Dauer plus 200 ms ist kein Toast mehr im DOM', () => {
    act(() => ack('✓ befohlen: A'))
    wait(10)
    act(() => error('Fehler B'))
    wait(10)
    wait(NOTICE_DURATION.error + 200 + 50)
    expect(toasts().length).toBe(0)
  })

  it('(c) Hover haelt den Toast', () => {
    act(() => error('Fehler'))
    wait(10)
    const el = toasts()[0]!
    act(() => {
      el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
      el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    })
    wait(NOTICE_DURATION.error + 1000)
    expect(live().length).toBe(1)
  })

  it('(d) Hover, dann ersetzen (gleiche id und Dauer), dann Maus weg: der neue Toast steht die volle Dauer', () => {
    act(() => error('Fehler 1'))
    wait(10)
    const el = toasts()[0]!
    act(() => {
      el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
    })
    wait(1000)
    act(() => error('Fehler 2'))
    wait(10)
    const neu = toasts()[0]!
    act(() => {
      neu.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }))
    })
    // Kurz vor Ablauf der vollen neuen Dauer (minus 50 ms Toleranz) steht er noch.
    wait(NOTICE_DURATION.error - 50 - 10)
    expect(live().length, 'der ersetzte Toast lief mit dem Rest der alten Dauer ab').toBe(1)
    expect(live()[0]!.textContent).toContain('Fehler 2')
    wait(50 + 10 + 200 + 50)
    expect(toasts().length).toBe(0)
  })

  it('(e) kein verschachteltes aria-live / role=alert im Toast; ein Container mit aria-live=polite', () => {
    act(() => error('Fehler'))
    wait(10)
    expect(document.querySelectorAll('[data-sonner-toast] [aria-live], [data-sonner-toast] [role=alert]').length).toBe(0)
    expect(document.querySelectorAll('section[aria-live=polite]').length).toBe(1)
  })

  it('traegt data-msg und die Klassen je Art; fertig traegt einen Sprung-Knopf', () => {
    const jump = vi.fn()
    act(() => warn('Höchstzahl erreicht'))
    wait(10)
    expect(toasts()[0]!.querySelector('.notice--warn')).not.toBeNull()
    expect(toasts()[0]!.querySelector('[data-msg^="warn:"]')).not.toBeNull()

    act(() => info('Kaserne fertig', { jump: { label: 'Ansehen', onJump: jump } }))
    wait(10)
    const button = toasts()[0]!.querySelector<HTMLButtonElement>('.notice--info button.notice__jump')
    expect(button).not.toBeNull()
    act(() => button!.click())
    expect(jump).toHaveBeenCalledTimes(1)
  })

  it('Dauer je Art laut Spec 10.9.4', () => {
    expect(NOTICE_DURATION.error).toBe(6000)
    expect(NOTICE_DURATION.warn).toBe(6000)
    expect(NOTICE_DURATION.info).toBe(4000)
    expect(NOTICE_DURATION.ack).toBeGreaterThan(0)
    expect(() => showNotice('ack', 'x')).not.toThrow()
  })
})

describe('MESSAGE_ROUTE (D21/K19): jede Art genau ein Ort', () => {
  const PLACES = ['toast', 'alerts', 'chip', 'dock']

  it('jede Art hat genau einen gueltigen Ort', () => {
    for (const [kind, place] of Object.entries(MESSAGE_ROUTE)) {
      expect(PLACES, kind).toContain(place)
    }
  })

  it('enthaelt Fehler, fertig, Angebot, Einmarsch und Quittung', () => {
    expect(MESSAGE_ROUTE.error).toBe('toast')
    expect(MESSAGE_ROUTE.done).toBe('toast')
    expect(MESSAGE_ROUTE.offer).toBe('alerts')
    expect(MESSAGE_ROUTE.intrusion).toBe('chip')
    expect(MESSAGE_ROUTE.ack).toBe('toast')
  })
})
