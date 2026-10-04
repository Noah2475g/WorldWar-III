import type { MapPing } from '../game/events.ts'

/**
 * Der Puls eines hoerbaren Ereignisses auf der Karte (T-M46-02, VM-03).
 *
 * Noah (Playtest V3): „Es passieren einfach Sounds und man weiss nicht, wo etwas passiert.“ Jedes
 * Ereignis mit Ton pulsiert deshalb an seinem Ort: ein Ring, der sich weitet und ausblendet. Rein
 * gerechnet, damit ein Test Dauer, Radius und die Bewegungsregel festhalten kann.
 */

/** Wie lange ein Puls zu sehen ist - laenger als der Ton (110-420 ms), kuerzer als ein Spieltag bei Tempo 1. */
export const PING_MS = 1800

/** Hoechstens so viele Pulse zugleich: ein Einmarsch mit zwanzig Armeen malt keine Zielscheibe. */
export const MAX_PINGS = 8

/** Radius des Rings am Anfang und am Ende, in Bildpunkten. */
const R_FROM = 12
const R_TO = 46

export interface PingFrame {
  radius: number
  alpha: number
}

/**
 * Das Bild eines Pulses nach `elapsedMs`. Ohne Bewegung (Systemeinstellung) steht der Ring still in
 * mittlerer Groesse und blendet nicht aus - die Groesse ist Zustand, nicht Bewegung (wie beim
 * Gefechtsring); er verschwindet nach `PING_MS` ganz. `null`: der Puls ist vorbei.
 */
export function pingFrame(elapsedMs: number, motion: boolean): PingFrame | null {
  if (!(elapsedMs >= 0) || elapsedMs >= PING_MS) return null
  if (!motion) return { radius: (R_FROM + R_TO) / 2, alpha: 0.9 }
  const p = elapsedMs / PING_MS
  // Zwei Wellen im Abstand eines Drittels: schnell weiten, langsam ausklingen.
  const eased = 1 - (1 - p) * (1 - p)
  return { radius: R_FROM + (R_TO - R_FROM) * eased, alpha: 0.9 * (1 - p) }
}

/**
 * Welche der gemeldeten Pulse sind neu und noch aktuell? Neu: Kennung noch nicht gesehen. Aktuell: das
 * Ereignis ist hoechstens zwei Ticks alt (ein geladener Stand bringt sein ganzes Protokoll mit) und die Partie
 * laeuft nicht schneller als der Ton (`allowed`). Gibt die Neuen zurueck, hoechstens `MAX_PINGS`.
 */
export function freshPings(
  pings: readonly MapPing[],
  seen: ReadonlySet<string>,
  tick: number | undefined,
  allowed: boolean,
): MapPing[] {
  if (!allowed) return []
  return pings.filter((ping) => !seen.has(ping.id) && (tick === undefined || tick - ping.tick <= 2)).slice(-MAX_PINGS)
}

export interface EdgeMarker {
  x: number
  y: number
  /** Richtung zum Ort, im Bogenmass (0 = nach rechts). */
  angle: number
}

/**
 * Liegt der Ort ausserhalb des sichtbaren Kartenausschnitts, zeigt ein Pfeil am Rand zu ihm (T-M46-02):
 * ein Puls, den niemand sieht, weil er hinter dem Rand pulsiert, laesst den Spieler wieder raten, wo es
 * war. Der Pfeil sitzt auf der Strecke von der Mitte zum Ort, `inset` Punkte vom Rand. `null`: der Ort ist
 * im Bild - dort pulsiert der Ring selbst.
 */
export function edgeMarker(at: { x: number; y: number }, width: number, height: number, inset = 14): EdgeMarker | null {
  if (at.x >= 0 && at.x <= width && at.y >= 0 && at.y <= height) return null
  const cx = width / 2
  const cy = height / 2
  const dx = at.x - cx
  const dy = at.y - cy
  const halfW = Math.max(1, cx - inset)
  const halfH = Math.max(1, cy - inset)
  // Der kleinste Streckfaktor, der die Strecke auf den inneren Rahmen bringt.
  const k = Math.min(dx === 0 ? Infinity : halfW / Math.abs(dx), dy === 0 ? Infinity : halfH / Math.abs(dy))
  return { x: cx + dx * k, y: cy + dy * k, angle: Math.atan2(dy, dx) }
}
