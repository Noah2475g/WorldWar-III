// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { MapCanvas } from './MapCanvas.tsx'
import { boundsOf } from './picking.ts'
import type { RenderProvince } from './render.ts'

/**
 * Die Karte, die wirklich zeichnet (T-M16-06, R-ARCH-06/AK2, R-UI-12).
 *
 * `MapCanvas` lief bis zum 2026-09-07 in **keinem** Test: `getContext` liefert in jsdom
 * `null`, die Zeichenwege enden an der ersten Abfrage, und 141 von 249 Zeilen waren
 * unausgefuehrt. Damit war die groesste Datei der Oberflaeche die einzige, ueber die nur
 * Schaetzungen vorlagen.
 *
 * Hier bekommt sie einen Zeichenkontext, der jeden Aufruf mitschreibt. Das ist kein
 * echtes Bild — Farben, Ueberdeckung und Bildrate sagt es nicht —, aber es ist die
 * Antwort auf die Frage, die vorher offen war: **laeuft** der Zeichenweg, und ruft er
 * das, was er soll. Was ein Bild braucht, misst der Lauf im Browser
 * (\`docs/reports/render-bench.json\`).
 */

const ROOT = process.cwd()
const world = JSON.parse(readFileSync(`${ROOT}/data/maps/world.json`, 'utf8')) as {
  width: number
  height: number
  provinces: { id: string; polygons: [number, number][][]; population: number; deposits: Record<string, number> }[]
}

/** Jeder Aufruf wird gezaehlt; jede Eigenschaft nimmt an, was man ihr gibt. */
interface Recorder {
  calls: Record<string, number>
  props: Record<string, unknown>
}

function recordingContext(): { context: CanvasRenderingContext2D; recorder: Recorder } {
  const recorder: Recorder = { calls: {}, props: {} }
  const context = new Proxy(
    {},
    {
      get(_target, key: string) {
        if (key === 'canvas') return { width: 960, height: 600 }
        if (key === 'measureText') {
          return (text: string) => {
            recorder.calls.measureText = (recorder.calls.measureText ?? 0) + 1
            return { width: text.length * 6 }
          }
        }
        if (key in recorder.props) return recorder.props[key]
        return (...args: unknown[]) => {
          recorder.calls[key] = (recorder.calls[key] ?? 0) + 1
          return args.length > 0 ? undefined : undefined
        }
      },
      set(_target, key: string, value: unknown) {
        recorder.props[key] = value
        return true
      },
    },
  ) as unknown as CanvasRenderingContext2D
  return { context, recorder }
}

let recorder: Recorder

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never
  // Eine Bildschleife, die synchron ist: sonst zeichnet der Ueberzug in jsdom nie.
  globalThis.requestAnimationFrame = ((fn: FrameRequestCallback) => {
    fn(0)
    return 1
  }) as never
  globalThis.cancelAnimationFrame = (() => undefined) as never
})

afterEach(cleanup)

const provinces: RenderProvince[] = world.provinces.map((province, index) => ({
  id: province.id,
  owner: index % 5 === 0 ? null : `p${(index % 8) + 1}`,
  morale: 40_000 + (index % 60) * 1000,
  deposits: province.deposits,
  strength: (index * 37) % 20_000,
  polygons: province.polygons,
  bounds: boundsOf(province.polygons),
}))

const centres = Object.fromEntries(
  world.provinces.map((province) => [province.id, { x: province.polygons[0]![0]![0], y: province.polygons[0]![0]![1] }]),
)

const zeichne = (extra: Partial<Parameters<typeof MapCanvas>[0]> = {}) => {
  const { context, recorder: rec } = recordingContext()
  recorder = rec
  HTMLCanvasElement.prototype.getContext = (() => context) as never
  const result = render(
    <MapCanvas
      provinces={provinces}
      centres={centres}
      armies={[]}
      buildings={{}}
      mode="political"
      width={world.width}
      height={world.height}
      view={{ x: 0, y: 0, scale: 4 }}
      ownershipVersion={1}
      selectedProvince={null}
      onSelect={() => undefined}
      onViewChange={() => undefined}
      labelFor={(id) => id}
      {...extra}
    />,
  )
  return result
}

describe('R-ARCH-06/AK2 Die Karte zeichnet wirklich', () => {
  it('fuellt Provinzen, statt nur eine Leinwand anzulegen', () => {
    zeichne()

    // Ohne diesen Test war jeder dieser Aufrufe unbelegt: getContext gab null, und der
    // Zeichenweg endete an der ersten Abfrage.
    expect(recorder.calls.fill ?? 0).toBeGreaterThan(50)
    expect(recorder.calls.moveTo ?? 0).toBeGreaterThan(50)
    expect(recorder.calls.lineTo ?? 0).toBeGreaterThan(500)
    expect(recorder.calls.clearRect ?? 0).toBeGreaterThan(0)
  })

  it('nimmt die Farben aus den Gestaltungsmarken, nicht aus dem Code', () => {
    zeichne()

    // Ein Wert wie "#cdb77e" im Zeichencode waere eine zweite Farbtabelle neben tokens.ts.
    expect(typeof recorder.props.fillStyle).toBe('string')
    expect(String(recorder.props.fillStyle)).toMatch(/^#|rgba?\(/)
  })

  it('beschriftet die Karte, wenn sie nah genug ist', () => {
    // `scale` sind Weltkoordinaten je Bildschirmpunkt: klein heisst nah. Beschriftet
    // wird bis LABEL_MAX_SCALE = 2, darueber waere die Karte eine Buchstabensuppe.
    zeichne({ view: { x: 0, y: 0, scale: 1.5 } })

    expect(recorder.calls.fillText ?? 0).toBeGreaterThan(0)
    expect(recorder.calls.measureText ?? 0).toBeGreaterThan(0)
  })

  it('zeichnet Marschrouten als Pfeil statt als gestrichelte Linie (T-M26-01)', () => {
    const stationen = world.provinces.slice(0, 4).map((province) => province.id)
    // speed 100 haelt die Bildschleife an (motionAllowed=false): der synchron
    // gestubbte requestAnimationFrame dieser Datei wuerde sonst endlos rekurrieren.
    // Der Pfeil ist Zustand, keine Bewegung — er muss trotzdem dastehen.
    zeichne({
      armies: [
        {
          id: 'a1',
          provinceId: stationen[0]!,
          owner: 'p1',
          strength: 1000,
          own: true,
          march: {
            toProvinceId: stationen[1]!,
            departureTick: 0,
            arrivalTick: 100,
            route: stationen.slice(1),
          },
        },
      ],
      tick: 50,
      speed: 100,
    })

    // Die gestrichelte Vorschau ist ersetzt; gestrichen wird nirgends mehr.
    expect(recorder.calls.setLineDash ?? 0).toBe(0)
    // Der blasse Routenrest ist die einzige Stelle, die globalAlpha anfasst — der
    // Recorder behaelt den letzten gesetzten Wert (save/restore stellt er nicht nach).
    expect(recorder.props.globalAlpha).toBe(0.35)
  })

  it('meldet die angeklickte Provinz an den Aufrufer', () => {
    let gewaehlt: string | null | undefined
    const { container } = zeichne({ onSelect: (id) => (gewaehlt = id) })
    const overlay = container.querySelectorAll('canvas')[1] ?? container.querySelector('canvas')!
    overlay.getBoundingClientRect = () => ({ left: 0, top: 0, width: 960, height: 600 }) as DOMRect

    fireEvent.click(overlay, { clientX: 480, clientY: 300 })

    // Der Wert darf null sein (Meer), aber der Griff muss gerufen worden sein.
    expect(gewaehlt !== undefined).toBe(true)
  })
})
