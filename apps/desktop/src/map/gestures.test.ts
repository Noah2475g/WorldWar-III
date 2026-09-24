import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  IDLE,
  LONG_PRESS_MS,
  MIN_PINCH_DISTANCE_PX,
  TAP_SLOP_MOUSE_PX,
  TAP_SLOP_TOUCH_PX,
  TOUCH_TARGET_PX,
  gestureStep,
  panView,
  pinchView,
  pointerKind,
  type GestureInput,
  type GestureOutput,
  type GestureState,
} from './gestures.ts'
import { toMap, type View, type ViewLimits } from './picking.ts'

/**
 * Die Gesten der Karte als reine Rechnung (Touch-Bedienung im Android-Emulator).
 *
 * Ein Finger, der die Karte zieht, zwei Finger, die sie aufziehen, ein langes Druecken
 * statt des Zeigens mit der Maus: das laesst sich im Browser nur mit einem Menschen und
 * einem Geraet pruefen. Als Zustandsmaschine ueber Zeigerereignisse ist es Arithmetik,
 * und die haelt ein Test fest. Die Tests kennen die Konstanten nur beim Namen — ihre
 * Werte darf jemand am Geraet nachstellen, ohne dass hier etwas bricht.
 */

/** Eine Karte, deren Rand in keinem dieser Tests erreicht wird. */
const WIDE: ViewLimits = {
  width: 1e9,
  height: 1e9,
  viewportWidth: 1000,
  viewportHeight: 1000,
  minScale: 1e-6,
  maxScale: 1e6,
}

const START: View = { x: 50_000, y: 40_000, scale: 2 }
const ctx = { view: START, limits: WIDE }

type Kind = 'touch' | 'mouse' | 'pen'

const input = (
  type: GestureInput['type'],
  pointerId: number,
  x: number,
  y: number,
  pointerType: Kind = 'touch',
  time = 0,
): GestureInput => ({ type, pointerId, pointerType, x, y, time })

/** Fuehrt eine Folge von Eingaben aus und sammelt alle Ausgaben. */
function run(inputs: readonly GestureInput[], state: GestureState = IDLE): { state: GestureState; out: GestureOutput[] } {
  const out: GestureOutput[] = []
  let current = state
  for (const next of inputs) {
    const step = gestureStep(current, next, ctx)
    current = step.state
    out.push(...step.out)
  }
  return { state: current, out }
}

const views = (out: readonly GestureOutput[]): View[] =>
  out.flatMap((o) => (o.type === 'view' ? [o.view] : []))
const kinds = (out: readonly GestureOutput[]): string[] => out.map((o) => o.type)
const lastView = (out: readonly GestureOutput[]): View | undefined => views(out).at(-1)

describe('Touch-Gesten: die Schwellen stehen in einer festen Ordnung', () => {
  it('die Maus zittert weniger als ein Finger, und zwei Finger liegen weiter auseinander als ein Zittern', () => {
    expect(TAP_SLOP_MOUSE_PX).toBeGreaterThan(0)
    expect(TAP_SLOP_MOUSE_PX).toBeLessThan(TAP_SLOP_TOUCH_PX)
    expect(TAP_SLOP_TOUCH_PX).toBeLessThan(MIN_PINCH_DISTANCE_PX)
    expect(LONG_PRESS_MS).toBeGreaterThan(0)
    expect(TOUCH_TARGET_PX).toBeGreaterThanOrEqual(44)
  })

  it('Stift und Finger sind grob, alles andere zaehlt als Maus', () => {
    expect(pointerKind('touch')).toBe('touch')
    expect(pointerKind('pen')).toBe('touch')
    expect(pointerKind('mouse')).toBe('mouse')
    // jsdom und manche Treiber liefern einen leeren Typ: dann wie bisher die Maus.
    expect(pointerKind('')).toBe('mouse')
  })
})

describe('Touch-Gesten: Tippen gegen Ziehen', () => {
  it('ein kurzes Tippen bleibt ein Tippen und bewegt die Karte nicht', () => {
    const { state, out } = run([input('down', 1, 100, 100), input('up', 1, 101, 100, 'touch', 80)])

    expect(state.kind).toBe('idle')
    expect(kinds(out)).toEqual(['tap'])
    expect(out[0]).toMatchObject({ type: 'tap', at: { x: 101, y: 100 }, pointerType: 'touch' })
  })

  it('ein Zittern unterhalb der Schwelle ist noch kein Ziehen', () => {
    const { out } = run([
      input('down', 1, 100, 100),
      input('move', 1, 100 + TAP_SLOP_TOUCH_PX - 1, 100),
      input('up', 1, 100 + TAP_SLOP_TOUCH_PX - 1, 100),
    ])

    expect(views(out)).toEqual([])
    expect(kinds(out)).toEqual(['tap'])
  })

  it('ueber der Schwelle zieht der Finger die Karte — vom Aufsetzpunkt aus, nicht vom Schwellenpunkt', () => {
    const { state, out } = run([input('down', 1, 100, 100), input('move', 1, 100 + TAP_SLOP_TOUCH_PX + 20, 90)])

    expect(state.kind).toBe('pan')
    // Der Klick danach darf keine Provinz waehlen: gezogen ist nicht getippt.
    expect(kinds(out)).toContain('suppressClick')
    const view = lastView(out)!
    // Der Kartenpunkt unter dem Finger bleibt unter dem Finger.
    expect(view.x).toBeCloseTo(START.x - (TAP_SLOP_TOUCH_PX + 20) * START.scale, 6)
    expect(view.y).toBeCloseTo(START.y + 10 * START.scale, 6)
    expect(view.scale).toBe(START.scale)
  })

  it('nach dem Ziehen gibt das Loslassen kein Tippen', () => {
    const { state, out } = run([
      input('down', 1, 100, 100),
      input('move', 1, 160, 100),
      input('up', 1, 160, 100),
    ])

    expect(state.kind).toBe('idle')
    expect(kinds(out)).not.toContain('tap')
  })

  it('die Maus beginnt frueher zu ziehen als der Finger', () => {
    const distance = TAP_SLOP_MOUSE_PX + 1
    expect(distance).toBeLessThanOrEqual(TAP_SLOP_TOUCH_PX)

    const mouse = run([input('down', 1, 100, 100, 'mouse'), input('move', 1, 100 + distance, 100, 'mouse')])
    const finger = run([input('down', 2, 100, 100), input('move', 2, 100 + distance, 100)])

    expect(mouse.state.kind).toBe('pan')
    expect(finger.state.kind).toBe('pending')
  })

  it('driftet nicht: viele kleine Schritte enden dort, wo ein grosser endet', () => {
    const steps = Array.from({ length: 40 }, (_, i) => input('move', 1, 100 + (i + 1) * 3.7, 100 - (i + 1) * 1.3))
    const many = run([input('down', 1, 100, 100), ...steps])
    const one = run([input('down', 1, 100, 100), input('move', 1, 100 + 40 * 3.7, 100 - 40 * 1.3)])

    expect(lastView(many.out)).toEqual(lastView(one.out))
  })

  it('der Rand haelt die Karte auch beim Ziehen fest', () => {
    const tight: ViewLimits = { width: 1000, height: 600, viewportWidth: 400, viewportHeight: 300, minScale: 0.5, maxScale: 2 }
    const step = gestureStep(
      gestureStep(IDLE, input('down', 1, 100, 100), { view: { x: 0, y: 0, scale: 1 }, limits: tight }).state,
      input('move', 1, 900, 100),
      { view: { x: 0, y: 0, scale: 1 }, limits: tight },
    )

    // Nach rechts gezogen hiesse: links ueber den Kartenrand hinaus. Der Rand gewinnt.
    expect(lastView(step.out)).toEqual({ x: 0, y: 0, scale: 1 })
  })
})

describe('Touch-Gesten: Zeigen mit der Maus, langes Druecken mit dem Finger', () => {
  it('eine Maus ohne gedrueckte Taste zeigt, ein Finger ohne Beruehrung gibt es nicht', () => {
    const mouse = run([input('move', 1, 30, 40, 'mouse')])
    const finger = run([input('move', 2, 30, 40)])

    expect(mouse.out).toEqual([{ type: 'hover', at: { x: 30, y: 40 } }])
    expect(finger.out).toEqual([])
  })

  it('mit gedrueckter Maustaste wird nicht gezeigt', () => {
    const { out } = run([input('down', 1, 30, 40, 'mouse'), input('move', 1, 31, 40, 'mouse')])

    expect(kinds(out)).not.toContain('hover')
  })

  it('langes Druecken zeigt die Stelle und schluckt den Klick danach', () => {
    const { state, out } = run([
      input('down', 1, 200, 150),
      input('move', 1, 202, 151),
      input('longPressTimer', 1, 202, 151, 'touch', LONG_PRESS_MS),
    ])

    expect(state.kind).toBe('pressed')
    expect(kinds(out)).toEqual(['longPress', 'suppressClick'])
    expect(out[0]).toMatchObject({ at: { x: 202, y: 151 } })

    // Loslassen danach ist kein Tippen mehr — sonst waehlte das Zeigen zugleich aus.
    const after = gestureStep(state, input('up', 1, 202, 151, 'touch', LONG_PRESS_MS + 200), ctx)
    expect(after.state.kind).toBe('idle')
    expect(after.out).toEqual([])
  })

  it('die Maus kennt kein langes Druecken', () => {
    const { state, out } = run([
      input('down', 1, 200, 150, 'mouse'),
      input('longPressTimer', 1, 200, 150, 'mouse', LONG_PRESS_MS),
      input('up', 1, 200, 150, 'mouse', LONG_PRESS_MS * 3),
    ])

    expect(state.kind).toBe('idle')
    expect(kinds(out)).toEqual(['tap'])
  })

  it('ein Zeitgeber, der nach dem Ziehen oder fuer einen anderen Finger kommt, tut nichts', () => {
    const panned = run([input('down', 1, 100, 100), input('move', 1, 180, 100)])
    const late = gestureStep(panned.state, input('longPressTimer', 1, 180, 100), ctx)
    expect(late.state).toBe(panned.state)
    expect(late.out).toEqual([])

    const pending = run([input('down', 1, 100, 100)])
    const stranger = gestureStep(pending.state, input('longPressTimer', 7, 100, 100), ctx)
    expect(stranger.state).toBe(pending.state)
    expect(stranger.out).toEqual([])
  })

  it('bleibt der Zeitgeber aus, erkennt das Loslassen das lange Druecken an der Zeit', () => {
    const { out } = run([input('down', 1, 200, 150, 'touch', 1000), input('up', 1, 200, 150, 'touch', 1000 + LONG_PRESS_MS)])

    expect(kinds(out)).toEqual(['longPress', 'suppressClick'])
  })
})

describe('Touch-Gesten: zwei Finger', () => {
  it('ein zweiter Finger bricht das Tippen ab', () => {
    const { state, out } = run([
      input('down', 1, 100, 100),
      input('down', 2, 200, 100),
      input('up', 1, 100, 100),
      input('up', 2, 200, 100),
    ])

    expect(state.kind).toBe('idle')
    expect(kinds(out)).toContain('suppressClick')
    expect(kinds(out)).not.toContain('tap')
  })

  it('auseinanderziehen zoomt hinein, und der Punkt zwischen den Fingern bleibt stehen', () => {
    const { state, out } = run([
      input('down', 1, 400, 300),
      input('down', 2, 500, 300),
      input('move', 1, 350, 300),
      input('move', 2, 550, 300),
    ])

    expect(state.kind).toBe('pinch')
    const view = lastView(out)!
    // Abstand 100 → 200: doppelt so nah, also halber Massstab (Karteneinheiten je Pixel).
    expect(view.scale).toBeCloseTo(START.scale / 2, 9)
    const before = toMap({ x: 450, y: 300 }, START)
    const after = toMap({ x: 450, y: 300 }, view)
    expect(after.x).toBeCloseTo(before.x, 6)
    expect(after.y).toBeCloseTo(before.y, 6)
  })

  it('beide Finger zusammen verschieben die Karte mit', () => {
    const { out } = run([
      input('down', 1, 400, 300),
      input('down', 2, 500, 300),
      input('move', 1, 430, 340),
      input('move', 2, 530, 340),
    ])

    const view = lastView(out)!
    expect(view.scale).toBeCloseTo(START.scale, 9)
    expect(view.x).toBeCloseTo(START.x - 30 * START.scale, 6)
    expect(view.y).toBeCloseTo(START.y - 40 * START.scale, 6)
  })

  it('hebt ein Finger ab, zieht der andere weiter — ohne Sprung', () => {
    const pinched = run([
      input('down', 1, 400, 300),
      input('down', 2, 500, 300),
      input('move', 2, 600, 300),
    ])
    const atLift = lastView(pinched.out)!

    const lifted = gestureStep(pinched.state, input('up', 2, 600, 300), ctx)
    expect(lifted.state.kind).toBe('pan')
    expect(kinds(lifted.out)).not.toContain('tap')

    const moved = gestureStep(lifted.state, input('move', 1, 420, 310), ctx)
    const view = lastView(moved.out)!
    expect(view.scale).toBeCloseTo(atLift.scale, 9)
    expect(view.x).toBeCloseTo(atLift.x - 20 * atLift.scale, 6)
    expect(view.y).toBeCloseTo(atLift.y - 10 * atLift.scale, 6)
  })

  it('ein dritter Finger wird uebergangen', () => {
    const pinched = run([input('down', 1, 400, 300), input('down', 2, 500, 300)])
    const third = gestureStep(pinched.state, input('down', 3, 50, 50), ctx)

    expect(third.state).toBe(pinched.state)
    expect(third.out).toEqual([])
  })

  it('zwei fast gleiche Aufsetzpunkte zoomen nicht ins Unendliche', () => {
    const { out } = run([input('down', 1, 400, 300), input('down', 2, 401, 300), input('move', 2, 900, 300)])

    const view = lastView(out)!
    expect(Number.isFinite(view.scale)).toBe(true)
    expect(view.scale).toBeGreaterThanOrEqual((START.scale * MIN_PINCH_DISTANCE_PX) / 500)
  })

  it('der Massstab bleibt in den Grenzen der Karte', () => {
    const tight: ViewLimits = { ...WIDE, minScale: 1, maxScale: 3 }
    const pinchCtx = { view: START, limits: tight }
    let state = gestureStep(IDLE, input('down', 1, 400, 300), pinchCtx).state
    state = gestureStep(state, input('down', 2, 500, 300), pinchCtx).state
    const step = gestureStep(state, input('move', 2, 1400, 300), pinchCtx)

    expect(lastView(step.out)!.scale).toBe(1)
  })

  it('die Stelle zwischen den Fingern bleibt fuer jede Fingerstellung, wo sie war (Eigenschaft)', () => {
    const point = fc.record({
      x: fc.double({ min: 0, max: 1000, noNaN: true }),
      y: fc.double({ min: 0, max: 1000, noNaN: true }),
    })
    const view = fc.record({
      x: fc.double({ min: 1e6, max: 2e6, noNaN: true }),
      y: fc.double({ min: 1e6, max: 2e6, noNaN: true }),
      scale: fc.double({ min: 0.25, max: 4, noNaN: true }),
    })
    const apart = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot(a.x - b.x, a.y - b.y) >= MIN_PINCH_DISTANCE_PX

    fc.assert(
      fc.property(view, point, point, point, point, (start, a0, b0, a1, b1) => {
        fc.pre(apart(a0, b0) && apart(a1, b1))
        const next = pinchView(start, a0, b0, a1, b1, WIDE)
        const before = toMap({ x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 }, start)
        const after = toMap({ x: (a1.x + b1.x) / 2, y: (a1.y + b1.y) / 2 }, next)
        expect(after.x).toBeCloseTo(before.x, 4)
        expect(after.y).toBeCloseTo(before.y, 4)
        expect(next.scale).toBeCloseTo(
          (start.scale * Math.hypot(a0.x - b0.x, a0.y - b0.y)) / Math.hypot(a1.x - b1.x, a1.y - b1.y),
          9,
        )
      }),
      { numRuns: 300 },
    )
  })

  it('eine Pinch-Stellung ohne Bewegung ist der Ausgangsausschnitt', () => {
    const a = { x: 100, y: 200 }
    const b = { x: 300, y: 260 }
    const same = pinchView(START, a, b, a, b, WIDE)

    expect(same.x).toBeCloseTo(START.x, 9)
    expect(same.y).toBeCloseTo(START.y, 9)
    expect(same.scale).toBeCloseTo(START.scale, 12)
    expect(panView(START, a, a, WIDE)).toEqual(START)
  })
})

describe('Touch-Gesten: Abbruch', () => {
  it('ein Abbruch setzt zurueck, und die naechste Bewegung zieht nichts mehr', () => {
    const panned = run([input('down', 1, 100, 100), input('move', 1, 180, 100)])
    const cancelled = gestureStep(panned.state, input('cancel', 1, 180, 100), ctx)

    expect(cancelled.state).toEqual(IDLE)
    expect(cancelled.out).toEqual([])
    expect(gestureStep(cancelled.state, input('move', 1, 260, 100), ctx).out).toEqual([])
  })

  it('ein Abbruch waehrend zwei Finger liegen, setzt ebenfalls zurueck', () => {
    const pinched = run([input('down', 1, 400, 300), input('down', 2, 500, 300)])

    expect(gestureStep(pinched.state, input('cancel', 2, 500, 300), ctx).state).toEqual(IDLE)
  })

  it('ein Abbruch fuer einen fremden Zeiger laesst die Geste stehen', () => {
    const panned = run([input('down', 1, 100, 100), input('move', 1, 180, 100)])
    const other = gestureStep(panned.state, input('cancel', 9, 0, 0), ctx)

    expect(other.state).toBe(panned.state)
  })

  it('ein Loslassen ohne Aufsetzen tut nichts', () => {
    const step = gestureStep(IDLE, input('up', 4, 10, 10), ctx)

    expect(step.state).toBe(IDLE)
    expect(step.out).toEqual([])
  })
})
