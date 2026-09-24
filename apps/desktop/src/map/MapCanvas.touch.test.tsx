// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { MapCanvas, type ArmyMarker } from './MapCanvas.tsx'
import { LONG_PRESS_MS, TAP_SLOP_TOUCH_PX } from './gestures.ts'
import { markersFor } from './markers.ts'
import { boundsOf, pickProvince, type View } from './picking.ts'
import type { RenderProvince } from './render.ts'

/**
 * Die Karte unter dem Finger (Touch-Bedienung im Android-Emulator).
 *
 * `gestures.ts` rechnet, was ein Finger meint; hier wird geprueft, dass `MapCanvas` die
 * Zeigerereignisse des Browsers wirklich dorthin gibt und ausfuehrt, was zurueckkommt:
 * Ziehen, Aufziehen, langes Druecken als Tooltip, kein Klick nach einer Geste — und dass
 * die Karte ihren Ausschnitt fuer einen Testroboter lesbar an die Huelle schreibt.
 *
 * jsdom rechnet kein Layout (die Huelle misst 0 x 0, die Leinwand also 320 x 240) und
 * kennt kein `setPointerCapture`; die Karte muss ohne beides auskommen.
 */

const ROOT = process.cwd()
const world = JSON.parse(readFileSync(`${ROOT}/data/maps/world.json`, 'utf8')) as {
  width: number
  height: number
  provinces: { id: string; center: { x: number; y: number }; polygons: [number, number][][]; deposits: Record<string, number> }[]
}

const provinces: RenderProvince[] = world.provinces.map((province) => ({
  id: province.id,
  owner: null,
  morale: 50_000,
  deposits: province.deposits,
  strength: 0,
  polygons: province.polygons,
  bounds: boundsOf(province.polygons),
}))
const centres = Object.fromEntries(world.provinces.map((province) => [province.id, province.center]))

/** Ein Zeichenkontext, der alles schluckt und `setTransform` mitschreibt. */
let transforms: number[][] = []
function silentContext(): CanvasRenderingContext2D {
  return new Proxy(
    {},
    {
      get(_target, key: string) {
        if (key === 'measureText') return (text: string) => ({ width: text.length * 6 })
        if (key === 'setTransform') return (...args: number[]) => void transforms.push(args)
        return () => undefined
      },
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D
}

/** Die Bilder, die die Karte bestellt hat — der Test entscheidet, wann eines kommt. */
let frames: FrameRequestCallback[] = []
const nextFrame = () => {
  const due = frames
  frames = []
  for (const frame of due) frame(0)
}

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never
  HTMLCanvasElement.prototype.getContext = (() => silentContext()) as never
})

beforeEach(() => {
  frames = []
  transforms = []
  globalThis.requestAnimationFrame = ((fn: FrameRequestCallback) => {
    frames.push(fn)
    return frames.length
  }) as never
  globalThis.cancelAnimationFrame = (() => undefined) as never
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

/** Ein Ausschnitt ueber Europa in der Naehe, damit unter der Mitte Land liegt. */
const land = world.provinces.find((province) => province.id.startsWith('DEU')) ?? world.provinces[0]!
const START: View = { x: land.center.x - 160, y: land.center.y - 120, scale: 1 }

interface Calls {
  views: View[]
  selected: (string | null)[]
  armies: string[]
  hovers: ({ id: string | null; at: { x: number; y: number } | null })[]
}

function karte(extra: Partial<Parameters<typeof MapCanvas>[0]> = {}) {
  const calls: Calls = { views: [], selected: [], armies: [], hovers: [] }
  const result = render(
    <MapCanvas
      provinces={provinces}
      centres={centres}
      armies={[]}
      buildings={{}}
      mode="political"
      width={world.width}
      height={world.height}
      view={START}
      ownershipVersion={1}
      selectedProvince={null}
      speed={100}
      onSelect={(id) => calls.selected.push(id)}
      onSelectArmy={(id) => calls.armies.push(id)}
      onHover={(id, at) => calls.hovers.push({ id, at })}
      onViewChange={(view) => calls.views.push(view)}
      labelFor={(id) => id}
      {...extra}
    />,
  )
  const map = screen.getByRole('application', { name: 'Weltkarte' }) as HTMLCanvasElement
  // Die Leinwand in ihrer eigenen Groesse gezeigt: ein Client-Pixel ist ein Punkt.
  map.getBoundingClientRect = () => ({ left: 0, top: 0, width: 320, height: 240, right: 320, bottom: 240 }) as DOMRect
  return { ...result, map, calls }
}

type Pointer = { pointerId: number; pointerType: string; isPrimary?: boolean; buttons?: number }
const finger = (pointerId = 1, isPrimary = pointerId === 1): Pointer => ({ pointerId, pointerType: 'touch', isPrimary })
const mouse: Pointer = { pointerId: 1, pointerType: 'mouse', isPrimary: true }

const at = (pointer: Pointer, x: number, y: number) => ({ ...pointer, clientX: x, clientY: y })

describe('Touch-Bedienung: Ziehen waehlt nichts aus', () => {
  it('nach einem Ziehen mit der Maus waehlt der Klick keine Provinz (Befund: jedes Ziehen endete in einer Auswahl)', () => {
    const { map, calls } = karte()

    fireEvent.pointerDown(map, at(mouse, 100, 100))
    fireEvent.pointerMove(map, at({ ...mouse, buttons: 1 }, 160, 130))
    fireEvent.pointerUp(map, at(mouse, 160, 130))
    fireEvent.click(map, { clientX: 160, clientY: 130 })

    expect(calls.selected).toEqual([])
    expect(calls.views.at(-1)).toEqual({ x: START.x - 60, y: START.y - 30, scale: 1 })
  })

  it('ein Klick ohne Ziehen waehlt weiter aus — auch gleich nach einem Ziehen', () => {
    const { map, calls } = karte()

    fireEvent.pointerDown(map, at(mouse, 100, 100))
    fireEvent.pointerMove(map, at({ ...mouse, buttons: 1 }, 180, 100))
    fireEvent.pointerUp(map, at(mouse, 180, 100))
    fireEvent.click(map, { clientX: 180, clientY: 100 })

    fireEvent.pointerDown(map, at(mouse, 160, 120))
    fireEvent.pointerUp(map, at(mouse, 160, 120))
    fireEvent.click(map, { clientX: 160, clientY: 120 })

    expect(calls.selected).toEqual([pickProvince({ x: 160, y: 120 }, START, provinces)])
  })

  it('ein Finger zieht die Karte, und ein Zittern bleibt ein Tippen', () => {
    const { map, calls } = karte()

    fireEvent.pointerDown(map, at(finger(), 100, 100))
    fireEvent.pointerMove(map, at(finger(), 100 + TAP_SLOP_TOUCH_PX - 2, 100))
    fireEvent.pointerUp(map, at(finger(), 100 + TAP_SLOP_TOUCH_PX - 2, 100))
    fireEvent.click(map, { clientX: 100, clientY: 100 })
    expect(calls.views).toEqual([])
    expect(calls.selected.length).toBe(1)

    fireEvent.pointerDown(map, at(finger(), 100, 100))
    fireEvent.pointerMove(map, at(finger(), 40, 70))
    fireEvent.pointerUp(map, at(finger(), 40, 70))
    expect(calls.views.at(-1)).toEqual({ x: START.x + 60, y: START.y + 30, scale: 1 })
  })

  it('zwei Finger zoomen hinein und behalten die Stelle zwischen sich', () => {
    const { map, calls } = karte()

    fireEvent.pointerDown(map, at(finger(1), 110, 120))
    fireEvent.pointerDown(map, at(finger(2), 210, 120))
    fireEvent.pointerMove(map, at(finger(1), 60, 120))
    fireEvent.pointerMove(map, at(finger(2), 260, 120))
    fireEvent.pointerUp(map, at(finger(1), 60, 120))
    fireEvent.pointerUp(map, at(finger(2), 260, 120))
    fireEvent.click(map, { clientX: 160, clientY: 120 })

    const view = calls.views.at(-1)!
    expect(view.scale).toBeCloseTo(0.5, 9)
    expect(view.x + 160 * view.scale).toBeCloseTo(START.x + 160 * START.scale, 6)
    // Zwei Finger sind kein Tippen.
    expect(calls.selected).toEqual([])
  })

  it('schickt waehrend des Ziehens hoechstens einen Ausschnitt je Bild', () => {
    const { map, calls } = karte()

    fireEvent.pointerDown(map, at(finger(), 100, 100))
    for (let i = 1; i <= 6; i++) fireEvent.pointerMove(map, at(finger(), 100 + i * 10, 100))
    expect(calls.views).toEqual([])

    nextFrame()
    expect(calls.views).toEqual([{ x: START.x - 60, y: START.y, scale: 1 }])

    fireEvent.pointerMove(map, at(finger(), 170, 100))
    // Das Loslassen wartet nicht auf das naechste Bild: der letzte Stand geht sofort raus.
    fireEvent.pointerUp(map, at(finger(), 170, 100))
    expect(calls.views.at(-1)).toEqual({ x: START.x - 70, y: START.y, scale: 1 })
    nextFrame()
    expect(calls.views.length).toBe(2)
  })

  it('ein Abbruch durch den Browser beendet die Geste', () => {
    const { map, calls } = karte()

    fireEvent.pointerDown(map, at(finger(), 100, 100))
    fireEvent.pointerMove(map, at(finger(), 140, 100))
    fireEvent.pointerCancel(map, at(finger(), 140, 100))
    const count = calls.views.length
    fireEvent.pointerMove(map, at(finger(), 200, 100))
    nextFrame()

    expect(calls.views.length).toBe(count)

    // Dasselbe, wenn nur der Zeigerfang verloren geht, ohne dass ein Loslassen kam.
    fireEvent.pointerDown(map, at(finger(), 100, 100))
    fireEvent.pointerMove(map, at(finger(), 140, 100))
    fireEvent.lostPointerCapture(map, at(finger(), 140, 100))
    const after = calls.views.length
    fireEvent.pointerMove(map, at(finger(), 220, 100))
    nextFrame()
    expect(calls.views.length).toBe(after)
  })

  it('ein neuer erster Finger raeumt eine Geste ab, deren Loslassen verloren ging', () => {
    const { map, calls } = karte()

    // Zwei Finger, deren Loslassen nie ankommt ...
    fireEvent.pointerDown(map, at(finger(1), 100, 100))
    fireEvent.pointerDown(map, at(finger(2), 200, 100))
    // ... und danach ein ganz neues Tippen.
    fireEvent.pointerDown(map, at(finger(5, true), 160, 120))
    fireEvent.pointerUp(map, at(finger(5, true), 160, 120))
    fireEvent.click(map, { clientX: 160, clientY: 120 })

    expect(calls.selected.length).toBe(1)
  })
})

describe('Touch-Bedienung: langes Druecken zeigt, was die Maus beim Zeigen zeigt', () => {
  it('meldet nach dem langen Druecken Provinz und Stelle und waehlt beim Loslassen nicht aus', () => {
    vi.useFakeTimers()
    const { map, calls } = karte()

    fireEvent.pointerDown(map, at(finger(), 160, 120))
    vi.advanceTimersByTime(LONG_PRESS_MS - 10)
    expect(calls.hovers).toEqual([])
    vi.advanceTimersByTime(20)

    expect(calls.hovers).toEqual([{ id: pickProvince({ x: 160, y: 120 }, START, provinces), at: { x: 160, y: 120 } }])
    expect(calls.hovers[0]!.id).not.toBeNull()

    fireEvent.pointerUp(map, at(finger(), 160, 120))
    fireEvent.click(map, { clientX: 160, clientY: 120 })
    // Auf Touch folgt dem Loslassen ein pointerleave — der Tooltip muss es ueberstehen.
    fireEvent.pointerLeave(map, at(finger(), 160, 120))

    expect(calls.selected).toEqual([])
    expect(calls.hovers.length).toBe(1)

    // Die naechste Beruehrung nimmt den Tooltip wieder weg.
    fireEvent.pointerDown(map, at(finger(), 60, 60))
    expect(calls.hovers.at(-1)).toEqual({ id: null, at: null })
  })

  it('ein Finger, der zieht, zeigt nichts', () => {
    vi.useFakeTimers()
    const { map, calls } = karte()

    fireEvent.pointerDown(map, at(finger(), 160, 120))
    fireEvent.pointerMove(map, at(finger(), 220, 120))
    vi.advanceTimersByTime(LONG_PRESS_MS * 2)

    expect(calls.hovers).toEqual([])
  })

  it('die Maus kennt kein langes Druecken, und ihr Verlassen raeumt weiter auf', () => {
    vi.useFakeTimers()
    const { map, calls } = karte()

    fireEvent.pointerDown(map, at(mouse, 160, 120))
    vi.advanceTimersByTime(LONG_PRESS_MS * 2)
    fireEvent.pointerUp(map, at(mouse, 160, 120))
    expect(calls.hovers).toEqual([])

    fireEvent.pointerLeave(map, at(mouse, 400, 120))
    expect(calls.hovers).toEqual([{ id: null, at: null }])
  })

  it('unterdrueckt das Kontextmenue des Browsers auf der Karte', () => {
    const { map } = karte()

    // fireEvent gibt false zurueck, wenn preventDefault gerufen wurde.
    expect(fireEvent.contextMenu(map)).toBe(false)
  })
})

describe('Touch-Bedienung: Tippen trifft, wohin der Finger zeigt', () => {
  it('ein Finger trifft den eigenen Stapel mit groesserer Flaeche als die Maus', () => {
    const armies: ArmyMarker[] = [{ id: 'a1', provinceId: land.id, owner: 'eigen', strength: 5000, own: true }]
    const marker = markersFor(armies, {}, centres, START, {}).find((m) => m.kind === 'army')!
    const daneben = { clientX: marker.x + 20, clientY: marker.y }

    const touch = karte({ armies })
    fireEvent.pointerDown(touch.map, at(finger(), daneben.clientX, daneben.clientY))
    fireEvent.pointerUp(touch.map, at(finger(), daneben.clientX, daneben.clientY))
    fireEvent.click(touch.map, daneben)
    expect(touch.calls.armies).toEqual(['a1'])
    cleanup()

    const maus = karte({ armies })
    fireEvent.pointerDown(maus.map, at(mouse, daneben.clientX, daneben.clientY))
    fireEvent.pointerUp(maus.map, at(mouse, daneben.clientX, daneben.clientY))
    fireEvent.click(maus.map, daneben)
    expect(maus.calls.armies).toEqual([])
    expect(maus.calls.selected.length).toBe(1)
  })

  it('rechnet eine gestauchte Leinwand heraus (Huelle kleiner als 320 x 240)', () => {
    const { map, calls } = karte()
    // Die Huelle ist halb so gross wie die Leinwand: der Browser zeigt sie gestaucht.
    map.getBoundingClientRect = () => ({ left: 0, top: 0, width: 160, height: 120, right: 160, bottom: 120 }) as DOMRect

    const richtig = pickProvince({ x: 300, y: 200 }, START, provinces)
    const alt = pickProvince({ x: 150, y: 100 }, START, provinces)
    expect(richtig, 'Der Testpunkt muss zwei verschiedene Provinzen unterscheiden').not.toBe(alt)

    fireEvent.click(map, { clientX: 150, clientY: 100 })
    expect(calls.selected).toEqual([richtig])
  })
})

describe('Touch-Bedienung: der Finger gehoert der Karte', () => {
  it('laesst dem Browser den Finger auf der Karte nicht (touch-action)', () => {
    const { map } = karte()

    expect(map.style.touchAction).toBe('none')
  })
})

describe('Touch-Bedienung: der Finger gehoert der Karte', () => {
  it('laesst dem Browser den Finger auf der Karte nicht (touch-action)', () => {
    const { map } = karte()

    expect(map.style.touchAction).toBe('none')
  })
})
