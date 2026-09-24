import { clampView, zoomAt, type Point, type View, type ViewLimits } from './picking.ts'

/**
 * Die Gesten der Karte (Touch-Bedienung, Android-Emulator).
 *
 * Eine reine Zustandsmaschine ueber Zeigerereignisse — kein DOM, kein React. `MapCanvas`
 * uebersetzt Pointer-Events in `GestureInput`, ruft `gestureStep` und fuehrt aus, was
 * zurueckkommt. Das trennt die Frage "was hat der Finger gemeint" von der Frage "wie
 * sagt der Browser es", und nur die erste ist schwierig genug fuer einen Test.
 *
 * Ziehen und Aufziehen rechnen **immer vom Ausschnitt zu Beginn der Geste**, nie Schritt
 * fuer Schritt weiter: eine Folge kleiner Verschiebungen summiert Rundung und Randklemme
 * auf, und die Karte rutscht dem Finger davon.
 */

/** Wie weit eine Maus zwischen Druecken und Loslassen wandern darf, um noch zu klicken. */
export const TAP_SLOP_MOUSE_PX = 4
/** Dasselbe fuer Finger und Stift: ein Finger zittert mehr als eine Maus. */
export const TAP_SLOP_TOUCH_PX = 8
/** Ab so langem Liegen ohne Wandern zeigt ein Finger, statt zu tippen (das Zeigen der Maus). */
export const LONG_PRESS_MS = 450
/**
 * Kleinster Fingerabstand, mit dem das Aufziehen rechnet. Zwei fast gleiche Aufsetzpunkte
 * ergaeben sonst einen Zoomfaktor gegen unendlich.
 */
export const MIN_PINCH_DISTANCE_PX = 24
/** Mindestgroesse eines Ziels fuer den Finger in CSS-Pixeln (auch die Trefferflaeche der Armeen). */
export const TOUCH_TARGET_PX = 44

/** Grob (Finger, Stift) oder fein (Maus und alles, was sich nicht ausweist). */
export type PointerKind = 'mouse' | 'touch'

export function pointerKind(pointerType: string): PointerKind {
  return pointerType === 'touch' || pointerType === 'pen' ? 'touch' : 'mouse'
}

export interface GestureInput {
  type: 'down' | 'move' | 'up' | 'cancel' | 'longPressTimer'
  pointerId: number
  /** Wie `PointerEvent.pointerType`: 'mouse', 'touch', 'pen' oder leer. */
  pointerType: string
  /** Die Stelle in Leinwandpunkten (`toCanvasPoint`), nicht in Client-Pixeln. */
  x: number
  y: number
  /** Millisekunden auf einer Uhr, die ueber eine Geste hinweg dieselbe bleibt. */
  time: number
}

export interface GestureContext {
  /** Der Ausschnitt, wie er gerade gezeichnet ist — gelesen nur, wenn eine Geste beginnt. */
  view: View
  limits: ViewLimits
}

export type GestureOutput =
  | { type: 'view'; view: View }
  | { type: 'tap'; at: Point; pointerType: string }
  | { type: 'longPress'; at: Point; pointerType: string }
  | { type: 'hover'; at: Point }
  | { type: 'suppressClick' }

/** Ein Finger: wo er aufsetzte (fuer diese Phase der Geste) und wo er jetzt ist. */
interface Contact {
  id: number
  start: Point
  at: Point
}

export type GestureState =
  | { kind: 'idle' }
  /** Ein Zeiger liegt, ist aber noch innerhalb der Tippschwelle. */
  | { kind: 'pending'; contact: Contact; pointerType: string; startTime: number; view: View }
  | { kind: 'pan'; contact: Contact; view: View }
  | { kind: 'pinch'; a: Contact; b: Contact; view: View }
  /** Das lange Druecken hat gezeigt; der Finger liegt noch. */
  | { kind: 'pressed'; contact: Contact; view: View }

export interface GestureStep {
  state: GestureState
  out: GestureOutput[]
}

export const IDLE: GestureState = { kind: 'idle' }

const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y)
const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

/** Ein Finger zieht die Karte: der Kartenpunkt unter `from` liegt danach unter `to`. */
export function panView(view: View, from: Point, to: Point, limits: ViewLimits): View {
  if (from.x === to.x && from.y === to.y) return view
  return clampView(
    { x: view.x - (to.x - from.x) * view.scale, y: view.y - (to.y - from.y) * view.scale, scale: view.scale },
    limits,
  )
}

/**
 * Zwei Finger ziehen die Karte auf: der Massstab folgt dem Verhaeltnis der Abstaende,
 * und der Kartenpunkt zwischen den Fingern zu Beginn liegt danach zwischen den Fingern
 * jetzt — so verschieben zwei Finger zugleich, wie es jede Kartenanwendung tut.
 *
 * Gerechnet als Verschiebung ohne Klemme und danach `zoomAt` um die neue Mitte: `zoomAt`
 * haelt den Punkt unter `mid1` fest, und nach der Verschiebung ist das der alte Punkt
 * unter `mid0`. Die Klemme greift erst am Ende, einmal.
 */
export function pinchView(view: View, a0: Point, b0: Point, a1: Point, b1: Point, limits: ViewLimits): View {
  const mid0 = midpoint(a0, b0)
  const mid1 = midpoint(a1, b1)
  const shifted = { x: view.x - (mid1.x - mid0.x) * view.scale, y: view.y - (mid1.y - mid0.y) * view.scale, scale: view.scale }
  const factor = Math.max(MIN_PINCH_DISTANCE_PX, distance(a0, b0)) / Math.max(MIN_PINCH_DISTANCE_PX, distance(a1, b1))
  return zoomAt(shifted, mid1, factor, limits)
}

const at = (input: GestureInput): Point => ({ x: input.x, y: input.y })

/** Der Ausschnitt, den eine laufende Geste gerade zeigt. */
function currentView(state: GestureState, limits: ViewLimits): View | null {
  switch (state.kind) {
    case 'idle':
      return null
    case 'pending':
    case 'pressed':
      return state.view
    case 'pan':
      return panView(state.view, state.contact.start, state.contact.at, limits)
    case 'pinch':
      return pinchView(state.view, state.a.start, state.b.start, state.a.at, state.b.at, limits)
  }
}

/** Die Finger, die die Geste gerade haelt. */
function contactsOf(state: GestureState): Contact[] {
  switch (state.kind) {
    case 'idle':
      return []
    case 'pinch':
      return [state.a, state.b]
    default:
      return [state.contact]
  }
}

/** Ein zweiter Finger: ab jetzt wird aufgezogen, vom Ausschnitt und den Stellen dieses Augenblicks. */
function startPinch(
  state: Extract<GestureState, { kind: 'pending' | 'pan' | 'pressed' }>,
  input: GestureInput,
  limits: ViewLimits,
): GestureStep {
  const view = currentView(state, limits) ?? state.view
  const here = at(input)
  return {
    state: {
      kind: 'pinch',
      a: { id: state.contact.id, start: state.contact.at, at: state.contact.at },
      b: { id: input.pointerId, start: here, at: here },
      view,
    },
    // Ein zweiter Finger bricht jedes Tippen ab.
    out: [{ type: 'suppressClick' }],
  }
}

function down(state: GestureState, input: GestureInput, context: GestureContext): GestureStep {
  const here = at(input)
  const fresh: GestureStep = {
    state: {
      kind: 'pending',
      contact: { id: input.pointerId, start: here, at: here },
      pointerType: input.pointerType,
      startTime: input.time,
      view: context.view,
    },
    out: [],
  }
  switch (state.kind) {
    case 'idle':
      return fresh
    case 'pinch':
      // Ein dritter Finger (oder ein doppelt gemeldeter) aendert nichts.
      return { state, out: [] }
    default:
      // Derselbe Zeiger noch einmal heisst: sein Loslassen ging verloren. Neu anfangen.
      if (state.contact.id === input.pointerId) return fresh
      return startPinch(state, input, context.limits)
  }
}

function move(state: GestureState, input: GestureInput, limits: ViewLimits): GestureStep {
  const here = at(input)
  switch (state.kind) {
    case 'idle':
      // Eine Maus ohne gedrueckte Taste zeigt; ein Finger in der Luft kommt nicht vor.
      return { state, out: pointerKind(input.pointerType) === 'mouse' ? [{ type: 'hover', at: here }] : [] }
    case 'pending': {
      if (state.contact.id !== input.pointerId) return { state, out: [] }
      const contact = { ...state.contact, at: here }
      const slop = pointerKind(state.pointerType) === 'touch' ? TAP_SLOP_TOUCH_PX : TAP_SLOP_MOUSE_PX
      if (distance(contact.start, here) <= slop) return { state: { ...state, contact }, out: [] }
      // Ueber der Schwelle: ab jetzt wird gezogen — vom Aufsetzpunkt aus, damit der
      // Kartenpunkt unter dem Finger bleibt, statt um die Schwelle nachzuhinken.
      const next: GestureState = { kind: 'pan', contact, view: state.view }
      return {
        state: next,
        out: [{ type: 'suppressClick' }, { type: 'view', view: panView(state.view, contact.start, here, limits) }],
      }
    }
    case 'pan': {
      if (state.contact.id !== input.pointerId) return { state, out: [] }
      const next = { ...state, contact: { ...state.contact, at: here } }
      return { state: next, out: [{ type: 'view', view: panView(next.view, next.contact.start, here, limits) }] }
    }
    case 'pinch': {
      let next: typeof state
      if (state.a.id === input.pointerId) next = { ...state, a: { ...state.a, at: here } }
      else if (state.b.id === input.pointerId) next = { ...state, b: { ...state.b, at: here } }
      else return { state, out: [] }
      return {
        state: next,
        out: [{ type: 'view', view: pinchView(next.view, next.a.start, next.b.start, next.a.at, next.b.at, limits) }],
      }
    }
    case 'pressed':
      if (state.contact.id !== input.pointerId) return { state, out: [] }
      return { state: { ...state, contact: { ...state.contact, at: here } }, out: [] }
  }
}

function up(state: GestureState, input: GestureInput, limits: ViewLimits): GestureStep {
  switch (state.kind) {
    case 'idle':
      return { state, out: [] }
    case 'pending': {
      if (state.contact.id !== input.pointerId) return { state, out: [] }
      const here = at(input)
      // Blieb der Zeitgeber aus (ein langsamer Rechner, ein verschluckter Aufruf), sagt es
      // die Uhr: ein Finger, der so lange lag, hat gezeigt und nicht getippt.
      if (pointerKind(state.pointerType) === 'touch' && input.time - state.startTime >= LONG_PRESS_MS) {
        return {
          state: IDLE,
          out: [{ type: 'longPress', at: here, pointerType: state.pointerType }, { type: 'suppressClick' }],
        }
      }
      return { state: IDLE, out: [{ type: 'tap', at: here, pointerType: state.pointerType }] }
    }
    case 'pan':
    case 'pressed':
      return state.contact.id === input.pointerId ? { state: IDLE, out: [] } : { state, out: [] }
    case 'pinch': {
      const rest = state.a.id === input.pointerId ? state.b : state.b.id === input.pointerId ? state.a : null
      if (!rest) return { state, out: [] }
      // Der verbliebene Finger zieht weiter — vom Ausschnitt, den das Aufziehen gerade
      // zeigt, und von seiner jetzigen Stelle: kein Sprung beim Abheben.
      return {
        state: { kind: 'pan', contact: { id: rest.id, start: rest.at, at: rest.at }, view: currentView(state, limits)! },
        out: [],
      }
    }
  }
}

/**
 * Ein Schritt der Gestenerkennung: alter Zustand und ein Ereignis rein, neuer Zustand und
 * das, was zu tun ist, raus. Unbekannte Zeiger und veraltete Zeitgeber aendern nichts —
 * der Zustand kommt dann unveraendert (dasselbe Objekt) zurueck.
 */
export function gestureStep(state: GestureState, input: GestureInput, context: GestureContext): GestureStep {
  switch (input.type) {
    case 'down':
      return down(state, input, context)
    case 'move':
      return move(state, input, context.limits)
    case 'up':
      return up(state, input, context.limits)
    case 'cancel':
      // Der Browser hat die Geste an sich genommen (oder den Zeiger verloren): zuruecksetzen,
      // aber nur, wenn der Zeiger zu dieser Geste gehoert.
      return contactsOf(state).some((contact) => contact.id === input.pointerId) ? { state: IDLE, out: [] } : { state, out: [] }
    case 'longPressTimer':
      if (
        state.kind !== 'pending' ||
        state.contact.id !== input.pointerId ||
        pointerKind(state.pointerType) !== 'touch'
      ) {
        return { state, out: [] }
      }
      return {
        state: { kind: 'pressed', contact: state.contact, view: state.view },
        out: [{ type: 'longPress', at: state.contact.at, pointerType: state.pointerType }, { type: 'suppressClick' }],
      }
  }
}
