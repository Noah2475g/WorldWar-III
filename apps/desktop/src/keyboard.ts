import { SPEED_STOPS } from './game/speed.ts'
import { MAP_MODES, type MapMode } from './map/modes.ts'

/**
 * Keyboard control (T-M10-06, T-M10-12, R-UI-06).
 *
 * Every shortcut resolved by one pure function, so "can this game be played without a
 * mouse" is a question with a testable answer rather than a matter of trying each key
 * by hand and hoping.
 */

export type Shortcut =
  | { type: 'togglePause' }
  | { type: 'speed'; hoursPerSecond: number }
  | { type: 'fastForward' }
  | { type: 'save' }
  | { type: 'load' }
  | { type: 'cycleMode'; mode: MapMode }
  | { type: 'help' }
  | { type: 'openPanel'; panel: 'diplomacy' | 'market' | 'standings' }
  | { type: 'close' }
  | { type: 'pan'; dx: number; dy: number }
  /** Bild-auf/-ab: eine Zoomstufe hinein (1) oder heraus (-1) (T-M30-03). */
  | { type: 'zoom'; direction: 1 | -1 }
  /** Pos1: die eigene Hauptstadt in die Mitte (T-M30-03). */
  | { type: 'centreCapital' }

export interface KeyContext {
  speed: number
  mode: MapMode
  /** While typing in a field, letters belong to the field and not to the game. */
  typing: boolean
  dialogOpen: boolean
}

/** One step along the detents, so + and − move the way a player expects. */
function neighbourSpeed(speed: number, direction: 1 | -1): number {
  const index = SPEED_STOPS.findIndex((stop) => stop >= speed)
  const current = index === -1 ? SPEED_STOPS.length - 1 : index
  return SPEED_STOPS[Math.max(0, Math.min(SPEED_STOPS.length - 1, current + direction))]!
}

export function resolveKey(
  event: { key: string; ctrlKey?: boolean; metaKey?: boolean; target?: EventTarget | null },
  context: KeyContext,
): Shortcut | null {
  const control = event.ctrlKey === true || event.metaKey === true

  // Escape works everywhere, including in a field — it is how you get out.
  if (event.key === 'Escape') return { type: 'close' }

  // While the player is typing, letters are text. Anything else would make the seed
  // field unusable the moment someone types an "f".
  if (context.typing) return null

  if (control && event.key.toLowerCase() === 's') return { type: 'save' }
  if (control && event.key.toLowerCase() === 'l') return { type: 'load' }
  if (control) return null

  if (context.dialogOpen) return null

  switch (event.key) {
    case ' ':
      // Die Leertaste gehoert dem Knopf, auf dem der Fokus liegt (T-M28-09).
      return isInteractiveTarget(event.target ?? null) ? null : { type: 'togglePause' }
    case '+':
    case '=':
      return { type: 'speed', hoursPerSecond: neighbourSpeed(context.speed, 1) }
    case '-':
    case '−':
      return { type: 'speed', hoursPerSecond: neighbourSpeed(context.speed, -1) }
    case 'f':
    case 'F':
      return { type: 'fastForward' }
    case 'm':
    case 'M': {
      const next = MAP_MODES[(MAP_MODES.indexOf(context.mode) + 1) % MAP_MODES.length]!
      return { type: 'cycleMode', mode: next }
    }
    case 'd':
    case 'D':
      return { type: 'openPanel', panel: 'diplomacy' }
    case 'h':
    case 'H':
      return { type: 'openPanel', panel: 'market' }
    case 'l':
    case 'L':
      return { type: 'openPanel', panel: 'standings' }
    case 'F1':
    case '?':
      return { type: 'help' }
    case 'ArrowLeft':
      return { type: 'pan', dx: -1, dy: 0 }
    case 'ArrowRight':
      return { type: 'pan', dx: 1, dy: 0 }
    case 'ArrowUp':
      return { type: 'pan', dx: 0, dy: -1 }
    case 'ArrowDown':
      return { type: 'pan', dx: 0, dy: 1 }
    // Plus und Minus gehoeren dem Tempo (oben); der Zoom nimmt die Bildtasten.
    case 'PageUp':
      return { type: 'zoom', direction: 1 }
    case 'PageDown':
      return { type: 'zoom', direction: -1 }
    case 'Home':
      return { type: 'centreCapital' }
    default:
      return null
  }
}

/** How far one arrow-key press moves the map, in screen pixels. */
export const PAN_STEP = 80

/** Is the event coming from something the player is typing into? */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable
}

/**
 * Liegt der Fokus auf etwas, das die Taste selbst braucht? (T-M28-09, R-UI-06)
 *
 * `isTypingTarget` kannte nur Textfelder — und deckte damit genau den Fall nicht ab, um
 * den es bei der Bedienung ohne Maus geht: Wer tabbt, landet auf **Knoepfen**, und der
 * Browser loest einen Knopf mit Leertaste und Eingabetaste aus. Das Spiel fing die
 * Leertaste vorher ab und pausierte stattdessen, wodurch kein einziger Knopf ohne Maus zu
 * betaetigen war (Durchsicht vom 2026-09-11, Befund 8).
 *
 * Die Karte ist bewusst NICHT dabei: dort gehoert die Taste dem Spiel.
 */
export function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (isTypingTarget(target)) return true
  const tag = target.tagName.toLowerCase()
  if (tag === 'button' || tag === 'a' || tag === 'summary' || tag === 'details') return true
  return target.getAttribute('role') === 'button' || target.getAttribute('role') === 'link'
}

/** Ein Zoomschritt der Knoepfe und Tasten — derselbe wie ein Mausrad-Rasten. */
export const ZOOM_STEP = 1.2
