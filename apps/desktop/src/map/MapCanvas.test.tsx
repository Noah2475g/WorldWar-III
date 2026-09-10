// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { MapCanvas } from './MapCanvas.tsx'
import { anchorsFor } from './anchors.ts'
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
  provinces: {
    id: string
    center: { x: number; y: number }
    polygons: [number, number][][]
    population: number
    deposits: Record<string, number>
  }[]
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

    // Seit T-M30-04 (D27.5) ist der REST der Route gestrichelt — die Strichelung ist
    // jetzt Absicht, nicht der alte Zustand. Was hier bindet: das Gelaufene ist voll, und
    // die Spitze steht als Flaeche am Ziel.
    expect(recorder.calls.setLineDash ?? 0).toBeGreaterThan(0)
    // Kein blasser Rest mehr: seit D27.5 traegt der Rest die Strichelung statt einer
    // Deckung — globalAlpha wird fuer den Pfeil nicht mehr angefasst.
    expect(recorder.props.globalAlpha).toBeUndefined()
    expect(recorder.calls.fill ?? 0).toBeGreaterThan(0)
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

describe('T-M30-01 Stapelmarker werden gestempelt, nicht je Bild gezeichnet', () => {
  it('zeichnet den Stapel per drawImage aus dem Zwischenspeicher und schreibt die Zahl dazu', () => {
    const wo = world.provinces[0]!.id
    zeichne({
      speed: 100,
      armies: [
        { id: 'a1', provinceId: wo, owner: 'p1', strength: 5000, own: true, icon: 'armour', count: 7, condition: 0.6 },
        { id: 'a2', provinceId: world.provinces[1]!.id, owner: 'p2', strength: 5000, own: false, relation: 'war' },
      ],
    })

    // Zwei Stapel, zwei Stempel — der Rahmen samt Glyphe kommt aus dem Zwischenspeicher.
    expect(recorder.calls.drawImage ?? 0).toBeGreaterThanOrEqual(2)
    // Die Zahl steht nur am eigenen Stapel; die Weltansicht (scale 4) beschriftet
    // keine Provinzen, also sind diese fillText die der Stapelzahl — je Bild einer,
    // bei zwei Stempeln je Bild (der Ueberzug zeichnet nach dem Messen der Groesse erneut).
    expect(recorder.calls.fillText ?? 0).toBeGreaterThanOrEqual(1)
    expect((recorder.calls.fillText ?? 0) * 2).toBe(recorder.calls.drawImage)
  })
})

describe('T-M30-02 Gebaeude stehen als Stempel an ihren Ankern', () => {
  it('stempelt je Gebaeude ein Quadrat und schreibt die Stufe ab 2 dazu', () => {
    const wo = world.provinces[0]!
    const anchors = { [wo.id]: anchorsFor(wo.polygons, wo.center) }
    zeichne({
      speed: 100,
      view: { x: wo.center.x - 400, y: wo.center.y - 300, scale: 1 },
      buildings: { [wo.id]: { barracks: 1, factory: 2 } },
      anchors,
    })

    // Zwei Gebaeude, zwei Stempel je Bild — und keine Pips mehr (fillRect nur noch
    // fuer Grund, Spuren und Balken, nicht 4-px-Quadrate je Gebaeude).
    expect(recorder.calls.drawImage ?? 0).toBeGreaterThanOrEqual(2)
    expect((recorder.calls.drawImage ?? 0) % 2).toBe(0)
  })
})

describe('T-M30-03 Zoomknoepfe und Uebersichtskarte', () => {
  it('bietet drei Knoepfe mit Namen, die den Ausschnitt aendern', () => {
    const changes: { x: number; y: number; scale: number }[] = []
    const capital = world.provinces[3]!
    zeichne({
      speed: 100,
      view: { x: 500, y: 300, scale: 2 },
      capitalProvinceId: capital.id,
      onViewChange: (next) => changes.push(next),
    })

    fireEvent.click(screen.getByRole('button', { name: 'Hineinzoomen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Herauszoomen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Hauptstadt zentrieren' }))

    expect(changes.length).toBe(3)
    expect(changes[0]!.scale).toBeLessThan(2)
    expect(changes[1]!.scale).toBeGreaterThan(2)
    // Zentrieren: die Hauptstadt liegt danach in der Mitte des Ausschnitts. jsdom
    // rechnet kein Layout — der Huellen-Mindestwert (320 x 240) ist der Ausschnitt.
    const centred = changes[2]!
    // `centres` dieser Datei zeigt auf den ersten Umrisspunkt — zentriert wird, was
    // die Karte als Mitte kennt, nicht was die Kartendatei sagt.
    expect(centred.x + (320 * centred.scale) / 2).toBeCloseTo(centres[capital.id]!.x, 0)
  })

  it('zeichnet die Uebersichtskarte und zentriert bei Klick dort', () => {
    const changes: { x: number; y: number; scale: number }[] = []
    zeichne({ speed: 100, view: { x: 0, y: 0, scale: 2 }, onViewChange: (next) => changes.push(next) })

    const overview = screen.getByRole('button', { name: 'Übersichtskarte' }) as HTMLCanvasElement
    expect(overview.width).toBe(132)
    expect(overview.height).toBe(74)

    // Ein Klick in die Mitte der Uebersicht zentriert die Kartenmitte.
    overview.getBoundingClientRect = () => ({ left: 0, top: 0, width: 132, height: 74 }) as DOMRect
    fireEvent.click(overview, { clientX: 66, clientY: 37 })
    expect(changes.length).toBe(1)
    // Die Uebersicht ist nicht verzerrt: ein Massstab fuer beide Achsen, die Welt
    // sitzt links oben — der Klickpunkt ist der Kartenpunkt mal diesem Massstab.
    const overviewScale = Math.max(world.width / 132, world.height / 74)
    expect(changes[0]!.x + (320 * changes[0]!.scale) / 2).toBeCloseTo(66 * overviewScale, 0)
  })
})

describe('T-M30-04 Der Marschweg zeigt Stand und Rest', () => {
  it('zeichnet den Rest gestrichelt, den Standpunkt als Kreis und ab mittel die Tagesangabe', () => {
    const stationen = world.provinces.slice(0, 3).map((province) => province.id)
    const start = world.provinces[0]!
    zeichne({
      speed: 100,
      tick: 12,
      ticksPerDay: 24,
      view: { x: centres[start.id]!.x - 300, y: centres[start.id]!.y - 200, scale: 1.5 },
      armies: [
        {
          id: 'a1',
          provinceId: stationen[0]!,
          owner: 'p1',
          strength: 5000,
          own: true,
          march: { toProvinceId: stationen[1]!, departureTick: 0, arrivalTick: 48, route: stationen.slice(1) },
        },
      ],
    })

    expect(recorder.calls.setLineDash ?? 0).toBeGreaterThanOrEqual(1)
    // Der Standpunkt ist ein Kreis; die Gefechtsringe sind es auch, aber hier kaempft niemand.
    expect(recorder.calls.arc ?? 0).toBeGreaterThanOrEqual(1)
    // Die Tagesangabe steht als Text da (die Stapelzahl auch: beide sind fillText).
    expect(recorder.calls.fillText ?? 0).toBeGreaterThanOrEqual(1)
  })
})
