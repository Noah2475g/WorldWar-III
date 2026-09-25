// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { MapCanvas } from './MapCanvas.tsx'
import { applyInputMode } from '../ui/inputMode.ts'

/**
 * Der Vollbild-Knopf der Karte (Android-Emulator, 1280x720@320, 2026-09-25).
 *
 * Am echten Geraet frisst Chrome selbst gut 80 CSS-Punkte Hoehe fuer Tabs und
 * Adresszeile - mehr, als Kopf- und Fusszeile in `touch.css` noch hergeben. Vollbild
 * (`document.documentElement.requestFullscreen`) gibt sie zurueck. Der Knopf zeigt sich
 * nur im Touch-Betrieb und nur, wenn der Browser Vollbild ueberhaupt anbietet, und
 * wechselt Beschriftung und Wirkung, sobald `fullscreenchange` feuert.
 */

let dispose: (() => void) | null = null

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never
  HTMLCanvasElement.prototype.getContext = (() =>
    new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D) as never
})

beforeEach(() => {
  globalThis.requestAnimationFrame = ((fn: FrameRequestCallback) => {
    fn(0)
    return 1
  }) as never
  globalThis.cancelAnimationFrame = (() => undefined) as never
})

afterEach(() => {
  dispose?.()
  dispose = null
  // `fullscreenElement` ist per defineProperty gesetzt und bleibt sonst ueber den
  // naechsten Test hinaus bestehen (kein echtes Vollbild raeumt es automatisch auf).
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null })
  vi.restoreAllMocks()
  cleanup()
})

function karte() {
  return render(
    <MapCanvas
      provinces={[]}
      centres={{}}
      armies={[]}
      buildings={{}}
      mode="political"
      width={1000}
      height={1000}
      view={{ x: 0, y: 0, scale: 1 }}
      ownershipVersion={1}
      selectedProvince={null}
      onSelect={() => undefined}
      onViewChange={() => undefined}
      labelFor={(id) => id}
    />,
  )
}

/** `document.fullscreenEnabled`/`requestFullscreen`/`exitFullscreen` gibt es in jsdom nicht - Doubles. */
function stubFullscreenApi(enabled: boolean) {
  Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: enabled })
  const requestFullscreen = vi.fn().mockResolvedValue(undefined)
  const exitFullscreen = vi.fn().mockResolvedValue(undefined)
  document.documentElement.requestFullscreen = requestFullscreen as unknown as typeof document.documentElement.requestFullscreen
  document.exitFullscreen = exitFullscreen as unknown as typeof document.exitFullscreen
  return { requestFullscreen, exitFullscreen }
}

function setFullscreenElement(element: Element | null) {
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: element })
}

describe('Vollbild-Knopf: nur im Touch-Betrieb und nur, wenn der Browser es anbietet', () => {
  it('fehlt im Maus-Betrieb, auch wenn der Browser Vollbild anbietet', () => {
    stubFullscreenApi(true)
    karte()

    expect(screen.queryByRole('button', { name: /Vollbild/ })).toBeNull()
  })

  it('fehlt im Touch-Betrieb, wenn der Browser kein Vollbild anbietet', () => {
    stubFullscreenApi(false)
    dispose = applyInputMode({ location: { search: '?touch=1' }, document })
    karte()

    expect(screen.queryByRole('button', { name: /Vollbild/ })).toBeNull()
  })

  it('steht im Touch-Betrieb mit Vollbild-Unterstuetzung als Knopf "Vollbild" da', () => {
    stubFullscreenApi(true)
    dispose = applyInputMode({ location: { search: '?touch=1' }, document })
    karte()

    const button = screen.getByRole('button', { name: 'Vollbild' })
    expect(button.className).toContain('map-control')
  })
})

describe('Vollbild-Knopf: antippen wechselt Vollbild, und der Knopf folgt fullscreenchange', () => {
  it('ruft requestFullscreen an document.documentElement auf', () => {
    const { requestFullscreen } = stubFullscreenApi(true)
    dispose = applyInputMode({ location: { search: '?touch=1' }, document })
    karte()

    fireEvent.click(screen.getByRole('button', { name: 'Vollbild' }))

    expect(requestFullscreen).toHaveBeenCalledTimes(1)
    expect(requestFullscreen).toHaveBeenCalledWith({ navigationUI: 'hide' })
  })

  it('wechselt nach einem fullscreenchange mit gesetztem fullscreenElement zu "Vollbild beenden", und der Tipp ruft exitFullscreen', () => {
    const { exitFullscreen } = stubFullscreenApi(true)
    dispose = applyInputMode({ location: { search: '?touch=1' }, document })
    const { container } = karte()

    setFullscreenElement(container.querySelector('.map-wrapper'))
    fireEvent(document, new Event('fullscreenchange'))

    const button = screen.getByRole('button', { name: 'Vollbild beenden' })
    fireEvent.click(button)

    expect(exitFullscreen).toHaveBeenCalledTimes(1)
  })

  it('faengt eine Ablehnung von requestFullscreen still ab (kein unhandled rejection, kein Absturz)', async () => {
    stubFullscreenApi(true)
    document.documentElement.requestFullscreen = vi.fn().mockRejectedValue(new Error('vom Nutzer verboten')) as unknown as typeof document.documentElement.requestFullscreen
    dispose = applyInputMode({ location: { search: '?touch=1' }, document })
    karte()

    expect(() => fireEvent.click(screen.getByRole('button', { name: 'Vollbild' }))).not.toThrow()
    await Promise.resolve()
    await Promise.resolve()
  })
})
