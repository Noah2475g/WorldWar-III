// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { HOVER_DELAY_MS, MapCanvas } from './MapCanvas.tsx'
import { anchorsFor } from './anchors.ts'
import { boundsOf } from './picking.ts'
import { toMap, toScreen, ZOOM_MID_MAX_SCALE, ZOOM_NEAR_MAX_SCALE } from './picking.ts'
import { ARMY_LIFT_Y, buildingMarkers, markersFor } from './markers.ts'
import { GROUP_ZOOM_SCALE } from './sammel.ts'
import { marchLabel } from './render.ts'
import type { RenderProvince } from './render.ts'
import { TOKENS } from '../ui/tokens.ts'
import { ICON_PATHS } from '../ui/icons.tsx'
import { GLYPH_PATHS } from '../ui/glyphs.ts'
import { ART } from '../ui/art.tsx'
import { planTransition, frameAt, done as tweenDone } from './tween.ts'

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
  /** Jede je gesetzte Fassung einer Eigenschaft — `props` haelt nur die letzte. */
  seen: Record<string, unknown[]>
}

function recordingContext(): { context: CanvasRenderingContext2D; recorder: Recorder } {
  const recorder: Recorder = { calls: {}, props: {}, seen: {} }
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
        ;(recorder.seen[key] ??= []).push(value)
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
      onMode={() => undefined}
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
    // Zeitlimit wegen Last, nicht Verhalten: allein 115 ms, unter verify+Last max 3093 ms (gemessen 2026-10-05, t_3cad0a35).
  }, 20_000)

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
    // Zeitlimit wegen Last, nicht Verhalten: allein 276 ms, unter verify+Last max 8005 ms (gemessen 2026-10-05, t_3cad0a35).
  }, 30_000)

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

  it('zentriert auf den GENAUEN Kartenpunkt eines Klicks abseits der Mitte (Massstab der Uebersicht, nicht 1)', () => {
    // Ein Klick genau in der Mitte traefe zufaellig denselben Punkt, ob nun mit dem
    // Massstab der Uebersicht gerechnet wird oder faelschlich mit 1 — die Symmetrie
    // verdeckte den Fehler. Ein Klick abseits der Mitte deckt ihn auf.
    const changes: { x: number; y: number; scale: number }[] = []
    zeichne({ speed: 100, view: { x: 0, y: 0, scale: 2 }, onViewChange: (next) => changes.push(next) })

    const overview = screen.getByRole('button', { name: 'Übersichtskarte' }) as HTMLCanvasElement
    overview.getBoundingClientRect = () => ({ left: 0, top: 0, width: 132, height: 74 }) as DOMRect

    fireEvent.click(overview, { clientX: 33, clientY: 24 })
    expect(changes.length).toBe(1)

    const overviewScale = Math.max(world.width / 132, world.height / 74)
    const expected = { x: 33 * overviewScale, y: 24 * overviewScale }
    const centred = changes[0]!
    expect(centred.x + (320 * centred.scale) / 2).toBeCloseTo(expected.x, 0)
    expect(centred.y + (240 * centred.scale) / 2).toBeCloseTo(expected.y, 0)
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

describe('T-M31-01 Die Karte meldet, worauf der Zeiger liegt', () => {
  it('meldet die Provinz unter dem Zeiger entprellt und beim Verlassen nichts', () => {
    vi.useFakeTimers()
    try {
      const hovers: (string | null)[] = []
      const wo = world.provinces[0]!
      zeichne({
        speed: 100,
        view: { x: centres[wo.id]!.x - 160, y: centres[wo.id]!.y - 120, scale: 1 },
        onHover: (id) => hovers.push(id),
      })
      const map = screen.getByRole('application') as HTMLCanvasElement
      map.getBoundingClientRect = () => ({ left: 0, top: 0, width: 320, height: 240 }) as DOMRect

      // Zwei Bewegungen kurz nacheinander: erst nach der Entprellzeit faellt EINE Meldung.
      fireEvent.pointerMove(map, { clientX: 160, clientY: 120 })
      fireEvent.pointerMove(map, { clientX: 161, clientY: 121 })
      expect(hovers).toEqual([])
      vi.advanceTimersByTime(HOVER_DELAY_MS + 5)
      expect(hovers.length).toBe(1)
      expect(typeof hovers[0]).toBe('string')

      fireEvent.pointerLeave(map)
      expect(hovers[hovers.length - 1]).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})

/**
 * T-M28-06 · Die Karte hebt die eingenommene Provinz hervor.
 *
 * Der Alarm im Kopf sagt, *dass* etwas ist; der Ring sagt, *wo*. Gebunden wird die
 * Farbe, nicht die Strichstaerke: Zinnober ist die Farbe des Feindes (D27.1), und ein
 * Ring in Bernstein waere von der Auswahl nicht zu unterscheiden.
 */
describe('T-M28-06 Der Einmarsch ist auf der Karte zu sehen', () => {
  const zinnober = TOKENS.accent

  it('zieht den Zinnober-Ring um die gemeldete Provinz', () => {
    zeichne({ alarmProvince: provinces[3]!.id })

    expect(recorder.seen.strokeStyle ?? []).toContain(zinnober)
  })

  it('zieht ihn nicht, solange kein Alarm offen ist', () => {
    zeichne()

    expect(recorder.seen.strokeStyle ?? []).not.toContain(zinnober)
  })
})

/**
 * Was auf der Karte bleibt (T-M33-04, EINHEITSBILDER.md D33-a).
 *
 * M33 gibt den Panels einen zweiten Bildsatz — Schattenrisse im Kasten 48 x 30. Die
 * Karte bekommt ihn ausdruecklich NICHT: sie stempelt die Glyphe bei 11 px Kantenlaenge,
 * und ein gefuellter Panzer ist dort ein Fleck. Der Entscheid ist eine Zusage, also steht
 * hier ein Test und nicht nur ein Satz im Bauplan.
 */
describe('T-M33-04 Die Karte stempelt weiter die NATO-Glyphe', () => {
  /** Jedes `d`, aus dem die Karte einen Path2D baut. */
  const gestempelt = (zeichnen: () => void): string[] => {
    const gesehen: string[] = []
    const vorher = globalThis.Path2D
    globalThis.Path2D = class {
      constructor(d?: string) {
        if (typeof d === 'string') gesehen.push(d)
      }
    } as never
    try {
      zeichnen()
    } finally {
      if (vorher) globalThis.Path2D = vorher
      else delete (globalThis as { Path2D?: unknown }).Path2D
    }
    return gesehen
  }

  it('baut jeden Stempel aus ICON_PATHS und keinen aus dem Bildsatz', () => {
    const wo = world.provinces[0]!
    const pfade = gestempelt(() =>
      zeichne({
        speed: 100,
        view: { x: wo.center.x - 400, y: wo.center.y - 300, scale: 1 },
        armies: [{ id: 'a1', provinceId: wo.id, owner: 'p1', strength: 5000, own: true, icon: 'armour', count: 7 }],
        buildings: { [wo.id]: { barracks: 1 } },
        anchors: { [wo.id]: anchorsFor(wo.polygons, wo.center) },
      }),
    )

    // Ohne diese Zeile prueft der Rest sieben Stempel, die es nicht gibt.
    expect(pfade.length, 'Die Karte hat keinen einzigen Stempel gebaut').toBeGreaterThan(0)

    // Einheiten: die NATO-Glyphe; Gebaeude seit T-M46-13: das gefuellte Zeichen von game-icons.net.
    const glyphen = new Set([...Object.values(ICON_PATHS), ...Object.values(GLYPH_PATHS)])
    const risse = new Set(Object.values(ART).flatMap((bild) => [bild.body, bild.cut]))
    for (const d of pfade) {
      expect(risse.has(d), `Die Karte stempelt einen Schattenriss: ${d.slice(0, 30)}`).toBe(false)
      expect(glyphen.has(d), `Unbekannter Stempel: ${d.slice(0, 30)}`).toBe(true)
    }
  })
})

/**
 * T-M28-08 · Kämpfe werden ein Ereignis.
 *
 * Gebunden wird, dass das Gefecht mehr ist als ein Strichkreis: ein Schein darunter
 * (gefüllt, durchscheinend) und Einschlagzeichen daneben. Wie es aussieht, sagt der
 * Blick ins Fenster — dass es gezeichnet wird, sagt dieser Test.
 */
describe('T-M28-08 Das Gefecht bekommt Schein und Einschlaege', () => {
  it('zeichnet ohne Gefecht keinen Ring', () => {
    zeichne()

    expect(recorder.calls.arc ?? 0).toBe(0)
  })

  it('zeichnet mit Gefecht Schein, Ring und Einschlaege', () => {
    // `speed` ueber der Bewegungsgrenze: die Bildschleife dieses Testaufbaus ruft rAF
    // synchron auf und liefe sonst endlos rekursiv. Der Blitz faellt damit weg — der
    // Schein, der Ring und die Einschlaege bleiben, denn sie sind Zustand.
    zeichne({ battleProvinces: [provinces[5]!.id], speed: 100 })

    // Schein und Ring sind zwei Boegen; jedes Einschlagzeichen zwei Striche.
    expect(recorder.calls.arc ?? 0).toBeGreaterThanOrEqual(2)
    expect(recorder.calls.fill ?? 0).toBeGreaterThan(0)
    expect(recorder.calls.stroke ?? 0).toBeGreaterThan(0)
    // Der Schein deckt nie: irgendwann stand die Deckkraft unter eins.
    const alphas = (recorder.seen.globalAlpha ?? []) as number[]
    expect(alphas.some((value) => value > 0 && value < 1)).toBe(true)
    // Und Bernstein ist im Spiel — die Farbe der Einschlaege (D27.2).
    expect(recorder.seen.strokeStyle ?? []).toContain(TOKENS.warn)
  })
})


describe('T-M45-04 Die Flaechenebene zeichnet nur, wenn sich ein Pixel aendern kann', () => {
  /** Ein Commit der Huelle liefert bei jedem Tick eine NEUE Liste; gezeichnet wird nur bei neuer Fuellung. */
  const gleicheNeueListe = () => provinces.map((province) => ({ ...province }))

  // Wie in der Huelle ist `labelFor` ein gemerkter Wert: eine neue Funktion je Aufruf waere ein anderer Grund zum Neuzeichnen.
  const labelFor = (id: string) => id
  const sicht = { x: 0, y: 0, scale: 4 }
  // speed 100: die Bildschleife steht (motionAllowed=false), der synchrone rAF-Stub rekurriert nicht.
  const props = (list: RenderProvince[], mode: 'political' | 'morale' = 'political') => ({
    provinces: list,
    centres,
    armies: [],
    buildings: {},
    mode,
    width: world.width,
    height: world.height,
    view: sicht,
    ownershipVersion: 1,
    selectedProvince: null,
    speed: 100,
    onSelect: () => undefined,
    onViewChange: () => undefined,
    onMode: () => undefined,
    labelFor,
  })

  const contextFor = new WeakMap<Recorder, CanvasRenderingContext2D>()

  const fuellungen = (container: HTMLElement, recorders: Map<HTMLCanvasElement, Recorder>) => {
    const canvas = container.querySelector('canvas.map-layer:not(.map-layer--overlay)') as HTMLCanvasElement
    return recorders.get(canvas)?.calls.fill ?? 0
  }

  const start = () => {
    const recorders = new Map<HTMLCanvasElement, Recorder>()
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement) {
      let entry = recorders.get(this)
      if (!entry) {
        const made = recordingContext()
        entry = made.recorder
        recorders.set(this, entry)
        contextFor.set(entry, made.context)
      }
      return contextFor.get(entry)
    } as never
    const result = render(<MapCanvas {...props(provinces)} />)
    return { ...result, recorders }
  }

  it('zeichnet die Provinzen nicht neu, wenn dieselbe Fuellung in einer neuen Liste ankommt', () => {
    const { rerender, container, recorders } = start()
    const nachDemErsten = fuellungen(container, recorders)
    expect(nachDemErsten).toBeGreaterThan(50)

    // Moral, Staerke und Vorkommen aendern sich bei jedem Tick; im Besitzmodus faerbt keines davon.
    rerender(<MapCanvas {...props(gleicheNeueListe().map((p) => ({ ...p, morale: (p.morale ?? 0) + 1000 })))} />)

    expect(fuellungen(container, recorders), 'die teure Ebene wurde ohne neue Fuellung neu gezeichnet').toBe(nachDemErsten)
  })

  it('zeichnet neu, sobald eine Provinz die Farbe wechselt', () => {
    const { rerender, container, recorders } = start()
    const nachDemErsten = fuellungen(container, recorders)

    const neu = gleicheNeueListe()
    neu[1] = { ...neu[1]!, owner: neu[1]!.owner === 'p2' ? 'p3' : 'p2' }
    rerender(<MapCanvas {...props(neu)} />)

    expect(fuellungen(container, recorders)).toBeGreaterThan(nachDemErsten)
  })

  it('zeichnet neu, wenn der Modus die Fuellung aus der Moral nimmt', () => {
    const { rerender, container, recorders } = start()
    const nachDemErsten = fuellungen(container, recorders)

    rerender(<MapCanvas {...props(gleicheNeueListe().map((p) => ({ ...p, morale: (p.morale ?? 0) + 30_000 })), 'morale')} />)

    expect(fuellungen(container, recorders)).toBeGreaterThan(nachDemErsten)
  })
})

describe('T-M49-02 Sammelmarke', () => {
  const wo = world.provinces[Math.floor(world.provinces.length / 2)]!.id
  const vier = ['a1', 'a2', 'a3', 'a4'].map((id) => ({
    id,
    provinceId: wo,
    owner: 'p1',
    strength: 5000,
    own: true,
    icon: 'infantry' as const,
    count: 3,
  }))
  const ansicht = (scale: number) => ({ x: centres[wo]!.x - 160 * scale, y: centres[wo]!.y - 120 * scale, scale })
  const mitGruppe = (scale: number, selectedArmyId: string | null = null) =>
    markersFor(vier, {}, centres, ansicht(scale), { grouping: { selectedArmyId } })
  const ueberzug = (container: HTMLElement) => container.querySelector('canvas[role="application"]') as HTMLCanvasElement
  const rahmen = () => {
    const rect = ueberzug(document.body)
    rect.getBoundingClientRect = () => ({ left: 0, top: 0, width: 320, height: 240 }) as DOMRect
    return rect
  }

  it('(a) vier eigene Armeen: bei 0.9 vier Kaesten, bei 1.6 einer', () => {
    // Zaehlweise: drawImage der Ueberzug-Leinwand = ein Stempel je Kasten (die Marke
    // stempelt genau einmal, ihr Versatzrahmen ist strokeRect/fillRect). Jedes Bild zeichnet
    // gleich oft, daher verhalten sich die Zaehlungen wie die Kastenzahl 4 : 1.
    zeichne({ speed: 100, armies: vier, view: ansicht(0.9) })
    const nah = recorder.calls.drawImage ?? 0
    cleanup()
    zeichne({ speed: 100, armies: vier, view: ansicht(1.6) })
    const mittel = recorder.calls.drawImage ?? 0
    expect(mittel).toBeGreaterThan(0)
    expect(nah).toBe(mittel * 4)
  })

  it('(b) Klick auf die Marke zoomt auf 1 und zentriert, ohne zu waehlen', () => {
    const marke = mitGruppe(1.6).find((m) => m.kind === 'armyGroup')!
    const ansichten: { x: number; y: number; scale: number }[] = []
    const onSelectArmy = vi.fn()
    const onSelect = vi.fn()
    zeichne({
      speed: 100,
      armies: vier,
      view: ansicht(1.6),
      onSelectArmy,
      onSelect,
      onViewChange: (v) => ansichten.push(v),
    })
    fireEvent.click(rahmen(), { clientX: marke.x, clientY: marke.y })

    expect(ansichten.length).toBe(1)
    expect(ansichten[0]!.scale).toBe(1)
    const punkt = toMap({ x: marke.x, y: marke.y }, ansicht(1.6))
    // Ausschnitt der Leinwand (jsdom: 320x240): die Mitte liegt bei x + 160, y + 126
    // (D8-Folge-Fix M49: centreOnVisible statt centreOn — Default-Abstand oben 12px, D12).
    expect(ansichten[0]!.x + 160).toBeCloseTo(punkt.x, 0)
    expect(ansichten[0]!.y + 126).toBeCloseTo(punkt.y, 0)
    expect(onSelectArmy).not.toHaveBeenCalled()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('(c) ohne onSelectArmy bleibt der Klick Ortswahl', () => {
    const marke = mitGruppe(1.6).find((m) => m.kind === 'armyGroup')!
    const onSelect = vi.fn()
    const onViewChange = vi.fn()
    zeichne({ speed: 100, armies: vier, view: ansicht(1.6), onSelect, onViewChange })
    fireEvent.click(rahmen(), { clientX: marke.x, clientY: marke.y })
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onViewChange).not.toHaveBeenCalled()
  })

  it('(d) die gewaehlte Armee steht einzeln und ist anklickbar', () => {
    const kasten = mitGruppe(1.6, 'a2').find((m) => m.kind === 'army' && m.armyId === 'a2')!
    const onSelectArmy = vi.fn()
    zeichne({ speed: 100, armies: vier, view: ansicht(1.6), selectedArmyId: 'a2', onSelectArmy })
    fireEvent.click(rahmen(), { clientX: kasten.x, clientY: kasten.y })
    expect(onSelectArmy).toHaveBeenCalledWith('a2')
  })

  it('(e) Tageslabel bei 1.5 nur fuer die gewaehlte Armee', () => {
    const ziel = world.provinces[1]!.id
    const marsch = {
      id: 'm1',
      provinceId: wo,
      owner: 'p1',
      strength: 5000,
      own: true,
      march: { toProvinceId: ziel, departureTick: 0, arrivalTick: 48, route: [ziel] },
    }
    const texte = (selectedArmyId: string | null) => {
      const { context: basis, recorder: rec } = recordingContext()
      recorder = rec
      const gesehen: string[] = []
      // Der Recorder zaehlt nur Aufrufe; die Texte schneidet diese Huelle um fillText mit.
      const context = new Proxy(basis, {
        get(ziel, key) {
          if (key === 'fillText') return (text: string) => void gesehen.push(text)
          return Reflect.get(ziel, key)
        },
      })
      HTMLCanvasElement.prototype.getContext = (() => context) as never
      render(
        <MapCanvas
          provinces={provinces}
          centres={centres}
          armies={[marsch]}
          buildings={{}}
          mode="political"
          width={world.width}
          height={world.height}
          view={ansicht(1.5)}
          ownershipVersion={1}
          selectedProvince={null}
          onSelect={() => undefined}
          onViewChange={() => undefined}
          onMode={() => undefined}
          labelFor={(id) => id}
          speed={100}
          tick={12}
          ticksPerDay={24}
          selectedArmyId={selectedArmyId}
        />,
      )
      cleanup()
      return gesehen.filter((text) => text === marchLabel({ done: 0, total: 2 }) || / T$/.test(text))
    }
    expect(texte(null)).toEqual([])
    expect(texte('m1').length).toBeGreaterThan(0)
    expect(new Set(texte('m1')).size).toBe(1)
  })

  it('(f) data-zoom-tier: mid bei 1.6, near bei 1', () => {
    const { container } = zeichne({ speed: 100, view: ansicht(1.6) })
    expect(container.querySelector('[data-zoom-tier]')!.getAttribute('data-zoom-tier')).toBe('mid')
    cleanup()
    const { container: nah } = zeichne({ speed: 100, view: ansicht(1) })
    expect(nah.querySelector('[data-zoom-tier]')!.getAttribute('data-zoom-tier')).toBe('near')
  })
})

describe('T-M51-02 Gebaeude-Sammelmarke', () => {
  const woProvince = world.provinces[0]!
  const wo = woProvince.id
  const andereProvince = world.provinces[4]!.id
  const anchors = { [wo]: anchorsFor(woProvince.polygons, woProvince.center) }
  // Vier Arten (D3: n >= BUILDING_GROUP_MIN = 2) in derselben Provinz.
  const buildings = { [wo]: { factory: 1, airfield: 1, harbour: 1, shipyard: 1 } }
  const ansicht = (scale: number) => ({
    x: woProvince.center.x - 160 * scale,
    y: woProvince.center.y - 120 * scale,
    scale,
  })
  const mitGruppe = (scale: number, selectedProvinceId: string | null = null) =>
    buildingMarkers(buildings, centres, ansicht(scale), { buildingGroups: { selectedProvinceId } })
  const ueberzug = (container: HTMLElement) => container.querySelector('canvas[role="application"]') as HTMLCanvasElement
  const rahmen = () => {
    const rect = ueberzug(document.body)
    rect.getBoundingClientRect = () => ({ left: 0, top: 0, width: 320, height: 240 }) as DOMRect
    return rect
  }

  it('(a) Provinz mit 4 Arten: bei 0.9 vier Gebaeude-Stempel, bei 1.6 eine Marke', () => {
    // Zaehlweise wie M49-Test (a): near stempelt je Art ein Quadrat per drawImage;
    // mid zeichnet EINE Pille per arcTo (vier Boegen, kein Quadrat mehr, kein drawImage).
    zeichne({ speed: 100, buildings, anchors, view: ansicht(0.9) })
    const nahStempel = recorder.calls.drawImage ?? 0
    const nahBoegen = recorder.calls.arcTo ?? 0
    cleanup()
    zeichne({ speed: 100, buildings, anchors, view: ansicht(1.6) })
    const mittelBoegen = recorder.calls.arcTo ?? 0
    const mittelStempel = recorder.calls.drawImage ?? 0

    expect(nahStempel).toBeGreaterThan(0)
    expect(nahStempel % 4).toBe(0)
    expect(nahBoegen).toBe(0)
    expect(mittelBoegen).toBeGreaterThan(0)
    expect(mittelBoegen % 4).toBe(0)
    expect(mittelStempel).toBe(0)
  })

  it('(b) Klick auf die Marke mit onSelectArmy zoomt auf GROUP_ZOOM_SCALE und zentriert', () => {
    const marke = mitGruppe(1.6).find((m) => m.kind === 'buildingGroup')!
    const ansichten: { x: number; y: number; scale: number }[] = []
    const onSelectArmy = vi.fn()
    const onSelect = vi.fn()
    zeichne({
      speed: 100,
      buildings,
      anchors,
      view: ansicht(1.6),
      onSelectArmy,
      onSelect,
      onViewChange: (v) => ansichten.push(v),
    })
    fireEvent.click(rahmen(), { clientX: marke.x, clientY: marke.y })

    expect(ansichten.length).toBe(1)
    expect(ansichten[0]!.scale).toBe(GROUP_ZOOM_SCALE)
    const punkt = toMap({ x: marke.x, y: marke.y }, ansicht(1.6))
    // Ausschnitt der Leinwand (jsdom: 320x240), centreOnVisible: Mitte bei x+160, y+126.
    expect(ansichten[0]!.x + 160).toBeCloseTo(punkt.x, 0)
    expect(ansichten[0]!.y + 126).toBeCloseTo(punkt.y, 0)
    expect(onSelectArmy).not.toHaveBeenCalled()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('(c) ohne onSelectArmy bleibt der Klick Ortswahl', () => {
    const marke = mitGruppe(1.6).find((m) => m.kind === 'buildingGroup')!
    const onSelect = vi.fn()
    const onViewChange = vi.fn()
    zeichne({ speed: 100, buildings, anchors, view: ansicht(1.6), onSelect, onViewChange })
    fireEvent.click(rahmen(), { clientX: marke.x, clientY: marke.y })
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onViewChange).not.toHaveBeenCalled()
  })

  it('(d) ein Armee-Kasten ueber der Marke gewinnt den Klick, nicht die Marke', () => {
    const marke = mitGruppe(1.6).find((m) => m.kind === 'buildingGroup')!
    // Dieselbe Rechnung wie `armyScreenPoint` rueckwaerts: `home` so gewaehlt, dass der
    // gezeichnete Punkt der Armee (base.y - ARMY_LIFT_Y) genau auf der Marke liegt.
    const home = toMap({ x: marke.x, y: marke.y + ARMY_LIFT_Y }, ansicht(1.6))
    const armee = { id: 'a9', provinceId: wo, owner: 'p1', strength: 1000, own: true, home }
    const onSelectArmy = vi.fn()
    const onViewChange = vi.fn()
    zeichne({ speed: 100, buildings, anchors, armies: [armee], view: ansicht(1.6), onSelectArmy, onViewChange })
    fireEvent.click(rahmen(), { clientX: marke.x, clientY: marke.y })
    expect(onSelectArmy).toHaveBeenCalledWith('a9')
    expect(onViewChange).not.toHaveBeenCalled()
  })

  it('(e) gewaehlte Provinz zeichnet den Ring der Marke in primary (strokeStyle-Mitschnitt)', () => {
    // Pure Funktion: die gewaehlte Provinz bekommt `selected: true` (D6).
    expect(mitGruppe(1.6, wo).find((m) => m.kind === 'buildingGroup')?.selected).toBe(true)
    expect(mitGruppe(1.6, andereProvince).find((m) => m.kind === 'buildingGroup')?.selected).toBeFalsy()

    const primaryStrokes = (selectedProvince: string) => {
      const strokes: string[] = []
      const { context: basis, recorder: rec } = recordingContext()
      recorder = rec
      const context = new Proxy(basis, {
        get(target, key) {
          if (key === 'stroke')
            return () => {
              strokes.push(String(rec.props.strokeStyle))
              rec.calls.stroke = (rec.calls.stroke ?? 0) + 1
            }
          return Reflect.get(target, key)
        },
      })
      HTMLCanvasElement.prototype.getContext = (() => context) as never
      render(
        <MapCanvas
          provinces={provinces}
          centres={centres}
          armies={[]}
          buildings={buildings}
          anchors={anchors}
          mode="political"
          width={world.width}
          height={world.height}
          view={ansicht(1.6)}
          ownershipVersion={1}
          selectedProvince={selectedProvince}
          onSelect={() => undefined}
          onViewChange={() => undefined}
          onMode={() => undefined}
          labelFor={(id) => id}
          speed={100}
        />,
      )
      cleanup()
      return strokes.filter((s) => s === TOKENS.primary).length
    }

    // Andere Provinz gewaehlt: nur deren eigener Auswahlring ist primary, die Marke nicht.
    const ohneRing = primaryStrokes(andereProvince)
    // `wo` gewaehlt: zusaetzlich die Markenring (D6) zeichnet primary — mehr Treffer.
    const mitRing = primaryStrokes(wo)
    expect(mitRing).toBeGreaterThan(ohneRing)
  })
})

describe('T-M<n>-06 Zoom-Cluster Uebergang', () => {
  const wo = world.provinces[Math.floor(world.provinces.length / 2)]!.id
  const ansicht = (scale: number) => ({ x: centres[wo]!.x - 160 * scale, y: centres[wo]!.y - 120 * scale, scale })
  const vier = ['a1', 'a2', 'a3', 'a4'].map((id) => ({
    id,
    provinceId: wo,
    owner: 'p1',
    strength: 5000,
    own: true,
    icon: 'infantry' as const,
    count: 3,
  }))
  const eine = [{ id: 'solo', provinceId: wo, owner: 'p1', strength: 5000, own: true, icon: 'infantry' as const }]

  /**
   * Treibt die Uhr selbst (Plan §8: jsdom-rAF ist gestubbt, Test (b) braucht eigene Uhr).
   * Ruft wie der globale Stub synchron auf, aber mit wachsender Zeit und einer Decke —
   * ein unveraendertes `fn(0)` liefe hier endlos rekursiv, bis der Aufrufstapel ueberlaeuft.
   */
  function steppedRaf(ceilingMs: number, stepMs = 49) {
    const prevRaf = globalThis.requestAnimationFrame
    const prevCaf = globalThis.cancelAnimationFrame
    let calls = 0
    let t = 0
    globalThis.requestAnimationFrame = ((fn: FrameRequestCallback) => {
      calls += 1
      if (t > ceilingMs) return 1
      t += stepMs
      fn(t)
      return 1
    }) as never
    globalThis.cancelAnimationFrame = (() => undefined) as never
    return {
      callCount: () => calls,
      restore() {
        globalThis.requestAnimationFrame = prevRaf
        globalThis.cancelAnimationFrame = prevCaf
      },
    }
  }

  /** Rendert einmal mit `extra`; der erste Zeichenlauf zaehlt verdoppelt (T-M30-01) und
   * ist daher als absoluter Wert nicht vergleichbar — nur der DELTA eines spaeteren
   * Stufenwechsels per `rerender` ist das eine echte, ungedoppelte Bild. */
  const mounted = (extra: Partial<Parameters<typeof MapCanvas>[0]>) => zeichne(extra)

  it('(a) Tempo 100: nach Stufenwechsel sofort das Zielbild, keine rAF-Anforderung', () => {
    const rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame')
    const { rerender } = mounted({ speed: 100, armies: vier, view: ansicht(1.6) })
    const vor = recorder.calls.drawImage ?? 0
    rafSpy.mockClear()

    rerender(
      <MapCanvas
        provinces={provinces}
        centres={centres}
        armies={vier}
        buildings={{}}
        mode="political"
        width={world.width}
        height={world.height}
        view={ansicht(0.9)}
        ownershipVersion={1}
        selectedProvince={null}
        onSelect={() => undefined}
        onViewChange={() => undefined}
        onMode={() => undefined}
        labelFor={(id) => id}
        speed={100}
      />,
    )

    const danach = (recorder.calls.drawImage ?? 0) - vor
    // Sofort das Zielbild: vier eigene Kaesten (je Armee ein Stempel, D9/R-D6) statt
    // der einen Sammelmarke der mittleren Stufe — vier ist unabhaengig vom (verdoppelten)
    // Ausgangswert `vor`, denn dieser hier ist der eine echte Bildwechsel per `rerender`.
    expect(danach).toBe(4)
    expect(rafSpy).not.toHaveBeenCalled()
    rafSpy.mockRestore()
  })

  it('(b) Tempo 1, reduced false: rAF laeuft, nach > 588 ms steht die Schleife am Ziel', () => {
    const { rerender } = mounted({ speed: 1, armies: vier, view: ansicht(0.9) })
    const vor = recorder.calls.drawImage ?? 0
    expect(vor).toBeGreaterThan(0)

    const raf = steppedRaf(650)
    try {
      rerender(
        <MapCanvas
          provinces={provinces}
          centres={centres}
          armies={vier}
          buildings={{}}
          mode="political"
          width={world.width}
          height={world.height}
          view={ansicht(1.6)}
          ownershipVersion={1}
          selectedProvince={null}
          onSelect={() => undefined}
          onViewChange={() => undefined}
          onMode={() => undefined}
          labelFor={(id) => id}
          speed={1}
        />,
      )
    } finally {
      raf.restore()
    }

    // Die Schleife lief (sonst waere sie nie bis >588 ms vorgedrungen, sondern haette
    // nach einem Bild (t=0) schon aufgehoert).
    expect(raf.callCount()).toBeGreaterThan(1)
    // Irgendetwas wurde waehrend des Tweens gezeichnet (fading Kinder + einblendende Marke).
    expect((recorder.calls.drawImage ?? 0) - vor).toBeGreaterThan(0)

    // Das Ziel selbst (unabhaengig vom Leinwand-Mitschnitt): nach > 588 ms ist der Plan
    // fertig, und `frameAt` liefert genau eine sichtbare Marke — die Sammelmarke (D9 Buendeln).
    const von = markersFor(vier, {}, centres, ansicht(0.9), { grouping: { selectedArmyId: null } })
    const nach = markersFor(vier, {}, centres, ansicht(1.6), { grouping: { selectedArmyId: null } })
    const plan = planTransition({ view: ansicht(0.9), markers: von }, nach, 'merge')
    expect(tweenDone(plan, 650)).toBe(true)
    const frame = frameAt(plan, 650, ansicht(1.6)).filter((m) => m.alpha > 0)
    expect(frame.length).toBe(1)
    expect(frame[0]!.kind).toBe('armyGroup')
  })

  it('(c) Klick waehrend des Tweens trifft die Ziel-Anordnung (onSelectArmy)', () => {
    const onSelectArmy = vi.fn()
    const { rerender, container } = zeichne({ speed: 1, armies: vier, view: ansicht(1.6), onSelectArmy })

    const raf = steppedRaf(100) // erstes Bild: Tween laeuft, noch lange nicht fertig (< 588 ms)
    try {
      rerender(
        <MapCanvas
          provinces={provinces}
          centres={centres}
          armies={vier}
          buildings={{}}
          mode="political"
          width={world.width}
          height={world.height}
          view={ansicht(0.9)}
          ownershipVersion={1}
          selectedProvince={null}
          onSelect={() => undefined}
          onViewChange={() => undefined}
          onMode={() => undefined}
          labelFor={(id) => id}
          speed={1}
          onSelectArmy={onSelectArmy}
        />,
      )
    } finally {
      raf.restore()
    }
    expect(raf.callCount()).toBeGreaterThan(0)

    // Klick fragt markersFor ohne Tween -> die Ziel-Anordnung (near: einzelne Kaesten, D9).
    const ziel = markersFor(vier, {}, centres, ansicht(0.9), { grouping: { selectedArmyId: null } }).find(
      (m) => m.kind === 'army' && m.armyId === 'a2',
    )!
    const overlay = container.querySelectorAll('canvas[role="application"]')[0] as HTMLCanvasElement
    overlay.getBoundingClientRect = () => ({ left: 0, top: 0, width: 320, height: 240 }) as DOMRect
    fireEvent.click(overlay, { clientX: ziel.x, clientY: ziel.y })

    expect(onSelectArmy).toHaveBeenCalledWith('a2')
  })

  it('(d) Stufenwechsel ohne Gruppen (nur Einzelne): kein Tween', () => {
    const rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame')
    const { rerender } = zeichne({ speed: 1, armies: eine, view: ansicht(1.6) })
    rafSpy.mockClear()

    rerender(
      <MapCanvas
        provinces={provinces}
        centres={centres}
        armies={eine}
        buildings={{}}
        mode="political"
        width={world.width}
        height={world.height}
        view={ansicht(0.9)}
        ownershipVersion={1}
        selectedProvince={null}
        onSelect={() => undefined}
        onViewChange={() => undefined}
        onMode={() => undefined}
        labelFor={(id) => id}
        speed={1}
      />,
    )

    // Eine einzelne Armee hat denselben Schluessel auf beiden Stufen (D9 g): sofortiges Ziel, kein Plan.
    expect(rafSpy).not.toHaveBeenCalled()
    rafSpy.mockRestore()
  })
})

describe('T-M51-08 Welt-Pille', () => {
  const woProvince = world.provinces[0]!
  const wo = woProvince.id
  const feindProvince = world.provinces[1]!
  const feind = feindProvince.id
  const friedeProvince = world.provinces[2]!
  const friede = friedeProvince.id
  const ansicht = (scale: number) => ({ x: woProvince.center.x - 160 * scale, y: woProvince.center.y - 120 * scale, scale })
  // far: scale > ZOOM_MID_MAX_SCALE (2) — Mindestabstand zur Grenze, damit `zoomTier` sicher 'far' liefert.
  const FAR = ansicht(4)

  // D16: eigene Provinz (relation 'self'), Kriegsgegner ('war'), friedliche Fremdmacht ('peace') —
  // nur die ersten zwei bekommen eine Pille (A19).
  const weltProvinces: RenderProvince[] = provinces.map((province) => {
    if (province.id === wo) return { ...province, owner: 'p1', relation: 'self' as const }
    if (province.id === feind) return { ...province, owner: 'p2', relation: 'war' as const }
    if (province.id === friede) return { ...province, owner: 'p3', relation: 'peace' as const }
    return province
  })
  const worldPillProvinceInfo = Object.fromEntries(
    weltProvinces.map((province) => [province.id, { owner: province.owner, relation: province.relation }]),
  )

  const buildings = { [wo]: { factory: 2, airfield: 1 }, [friede]: { factory: 3 } }
  const eigeneArmee = { id: 'a1', provinceId: wo, owner: 'p1', strength: 5000, own: true, icon: 'infantry' as const, count: 7 }
  const feindArmee = {
    id: 'a2',
    provinceId: feind,
    owner: 'p2',
    strength: 5000,
    own: false,
    relation: 'war' as const,
    icon: 'armour' as const,
    count: 4,
  }
  const friedeArmee = { id: 'a3', provinceId: friede, owner: 'p3', strength: 2000, own: false, relation: 'peace' as const }

  const pillen = (armies: Parameters<typeof markersFor>[0], marks: Parameters<typeof markersFor>[1], selectedProvinceId: string | null = null) =>
    markersFor(armies, marks, centres, FAR, {
      worldPill: { provinces: worldPillProvinceInfo, selectedProvinceId },
    }).filter((m) => m.kind === 'worldPill')

  const ueberzug = (container: HTMLElement) => container.querySelector('canvas[role="application"]') as HTMLCanvasElement
  const rahmen = () => {
    const rect = ueberzug(document.body)
    rect.getBoundingClientRect = () => ({ left: 0, top: 0, width: 320, height: 240 }) as DOMRect
    return rect
  }

  it('(a) eigene Provinz mit Gebaeuden+Armee: eine Pille, zwei Segmente', () => {
    const marken = pillen([eigeneArmee], buildings)
    const eigene = marken.filter((m) => m.provinceId === wo)
    expect(eigene).toHaveLength(1)
    const pille = eigene[0]!
    expect(pille.tone).toBe('own')
    // D17: Summe der Gebaeude-STUFEN (factory 2 + airfield 1 = 3), nicht die Artenzahl.
    expect(pille.buildingLabel).toBe('3')
    // D18: Summe der Stueckzahl (count: 7, eine Armee).
    expect(pille.armyLabel).toBe('7')
  })

  it('(b) Kriegsgegner-Provinz: rote Pille, nur das Armee-Segment', () => {
    const marken = pillen([feindArmee], {})
    const gegner = marken.filter((m) => m.provinceId === feind)
    expect(gegner).toHaveLength(1)
    const pille = gegner[0]!
    expect(pille.tone).toBe('enemy')
    expect(pille.buildingLabel).toBeUndefined()
    expect(pille.armyLabel).toBe('4')
  })

  it('(c) friedliche Fremdmacht bekommt keine Pille (A19)', () => {
    const marken = pillen([friedeArmee], buildings)
    expect(marken.find((m) => m.provinceId === friede)).toBeUndefined()
  })

  it('(d) Klick auf die Pille mit onSelectArmy zoomt in den mid-Bereich, zentriert', () => {
    const pille = pillen([eigeneArmee], buildings).find((m) => m.provinceId === wo)!
    const ansichten: { x: number; y: number; scale: number }[] = []
    const onSelectArmy = vi.fn()
    const onSelect = vi.fn()
    zeichne({
      speed: 100,
      provinces: weltProvinces,
      buildings,
      armies: [eigeneArmee],
      view: FAR,
      onSelectArmy,
      onSelect,
      onViewChange: (v) => ansichten.push(v),
    })
    fireEvent.click(rahmen(), { clientX: pille.x, clientY: pille.y })

    expect(ansichten.length).toBe(1)
    // D23: mid, nicht near (GROUP_ZOOM_SCALE waere near) — Grenzen bewusst strikt (weder near noch far).
    expect(ansichten[0]!.scale).toBeGreaterThan(ZOOM_NEAR_MAX_SCALE)
    expect(ansichten[0]!.scale).toBeLessThanOrEqual(ZOOM_MID_MAX_SCALE)
    const punkt = toMap({ x: pille.x, y: pille.y }, FAR)
    // Zentriert heisst: der Kartenpunkt der Pille liegt nach dem Zoom im sichtbaren
    // Ausschnitt (jsdom: 320x240) — nicht zwingend exakt in der Mitte, denn `clampView`
    // darf am Kartenrand nachziehen (Befund beim Bauen, t_447fcdc7: woProvince.center
    // und `centres[wo]` (erster Umrisspunkt) weichen leicht voneinander ab).
    const wiederAufDemSchirm = toScreen(punkt, ansichten[0]!)
    expect(wiederAufDemSchirm.x).toBeGreaterThanOrEqual(0)
    expect(wiederAufDemSchirm.x).toBeLessThanOrEqual(320)
    expect(wiederAufDemSchirm.y).toBeGreaterThanOrEqual(0)
    expect(wiederAufDemSchirm.y).toBeLessThanOrEqual(240)
    expect(onSelectArmy).not.toHaveBeenCalled()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('(e) gewaehlte Provinz zeichnet einen zusaetzlichen primary-Ring (wie D6/buildingGroup)', () => {
    expect(pillen([eigeneArmee], buildings, wo).find((m) => m.provinceId === wo)?.selected).toBe(true)
    expect(pillen([eigeneArmee], buildings, feind).find((m) => m.provinceId === wo)?.selected).toBeFalsy()

    const primaryStrokes = (selectedProvince: string | null) => {
      const strokes: string[] = []
      const { context: basis, recorder: rec } = recordingContext()
      recorder = rec
      const context = new Proxy(basis, {
        get(target, key) {
          if (key === 'stroke')
            return () => {
              strokes.push(String(rec.props.strokeStyle))
              rec.calls.stroke = (rec.calls.stroke ?? 0) + 1
            }
          return Reflect.get(target, key)
        },
      })
      HTMLCanvasElement.prototype.getContext = (() => context) as never
      render(
        <MapCanvas
          provinces={weltProvinces}
          centres={centres}
          armies={[eigeneArmee]}
          buildings={buildings}
          mode="political"
          width={world.width}
          height={world.height}
          view={FAR}
          ownershipVersion={1}
          selectedProvince={selectedProvince}
          onSelect={() => undefined}
          onViewChange={() => undefined}
          onMode={() => undefined}
          labelFor={(id) => id}
          speed={100}
        />,
      )
      cleanup()
      return strokes.filter((s) => s === TOKENS.primary).length
    }

    // Baseline `null` statt einer anderen Provinz: zwei verschiedene Provinzen haben
    // unterschiedlich viele Umriss-Teile und damit von sich aus verschieden viele
    // generische Auswahl-Strokes (Befund beim Bauen, t_447fcdc7) — `null` zeichnet gar
    // keinen Provinz-Ring und ist der einzige saubere Nullpunkt.
    const ohneRing = primaryStrokes(null)
    const mitRing = primaryStrokes(wo)
    expect(mitRing).toBeGreaterThan(ohneRing)
  })
})
