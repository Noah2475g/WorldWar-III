/**
 * Sound and motion (T-M11-02, R-UI-04/R-ASSET-01).
 *
 * The sounds are synthesised rather than recorded — a few oscillators through the Web
 * Audio API. Nothing is downloaded, nothing is licensed, nothing is anybody else's
 * (R-ASSET-01), and the whole set weighs nothing.
 *
 * Two rules, and both exist because of how this game is played. Sound can be switched
 * off completely and stays off. And nothing plays above a walking pace: at a hundred
 * game hours a second the alerts would arrive dozens per second, which is not
 * atmosphere but a fault siren.
 */

export type Cue = 'battle' | 'captured' | 'complete' | 'shortage' | 'war' | 'select'

/** Above this speed the game is being skimmed, not watched. Silence, and no animation. */
export const CUE_SPEED_LIMIT = 10

interface Tone {
  frequency: number
  durationMs: number
  type: OscillatorType
  gain: number
}

/**
 * What each cue sounds like. Low and short for events that merely happened, higher and
 * longer for the ones that need the player to look up.
 */
const TONES: Record<Cue, Tone> = {
  select: { frequency: 440, durationMs: 40, type: 'sine', gain: 0.05 },
  complete: { frequency: 660, durationMs: 110, type: 'sine', gain: 0.08 },
  shortage: { frequency: 300, durationMs: 180, type: 'triangle', gain: 0.1 },
  battle: { frequency: 220, durationMs: 220, type: 'sawtooth', gain: 0.09 },
  captured: { frequency: 520, durationMs: 260, type: 'triangle', gain: 0.11 },
  war: { frequency: 180, durationMs: 420, type: 'sawtooth', gain: 0.12 },
}

export interface SoundOptions {
  enabled: boolean
  /** Game hours per second; cues stop above CUE_SPEED_LIMIT. */
  speed: number
}

/** Should this cue be played at all? Pure, so the rule is testable without audio. */
export function shouldPlay(cue: Cue, options: SoundOptions): boolean {
  if (!options.enabled) return false
  if (options.speed > CUE_SPEED_LIMIT) return false
  return cue in TONES
}

type AudioFactory = () => AudioContext | null

let context: AudioContext | null = null

const defaultFactory: AudioFactory = () => {
  if (typeof globalThis.AudioContext !== 'function') return null
  context ??= new globalThis.AudioContext()
  return context
}

/**
 * Plays one cue. Silently does nothing where there is no audio at all — a game that
 * refuses to start because a browser has no audio context would be absurd.
 */
export function play(cue: Cue, options: SoundOptions, factory: AudioFactory = defaultFactory): boolean {
  if (!shouldPlay(cue, options)) return false

  const audio = factory()
  if (!audio) return false

  const tone = TONES[cue]
  const oscillator = audio.createOscillator()
  const gain = audio.createGain()

  oscillator.type = tone.type
  oscillator.frequency.value = tone.frequency
  gain.gain.value = tone.gain

  oscillator.connect(gain)
  gain.connect(audio.destination)

  const now = audio.currentTime
  // A short fade out; a tone that stops dead clicks.
  gain.gain.setValueAtTime(tone.gain, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.durationMs / 1000)
  oscillator.start(now)
  oscillator.stop(now + tone.durationMs / 1000)

  return true
}

/**
 * How long an animation may take at the current speed.
 *
 * Zero above the limit, and that is the point: an army movement animated over 400 ms
 * while the game runs a hundred game hours a second would still be sliding across the
 * map long after the army arrived, fought and died.
 */
export function animationMs(baseMs: number, speed: number): number {
  if (speed > CUE_SPEED_LIMIT) return 0
  if (speed <= 1) return baseMs
  // Between walking pace and the limit, animations shorten with the speed rather than
  // switching off abruptly.
  return Math.round(baseMs / speed)
}

/** Respect the system setting; nobody should have to find it in our options too. */
export function prefersReducedMotion(): boolean {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

/**
 * The order in which cues matter, most urgent first (T-M13-02).
 *
 * One tick can produce a declaration of war, two battles and three finished buildings.
 * Playing all six is not atmosphere, it is noise — so a tick gets at most one sound,
 * and it is the one the player most needs to look up for.
 */
const CUE_URGENCY: readonly Cue[] = ['war', 'captured', 'battle', 'shortage', 'complete', 'select']

/** The single cue a batch of events deserves, or null when none of them is worth a sound. */
export function cueForEvents(events: readonly { type: string }[]): Cue | null {
  const cues = new Set<Cue>()
  for (const event of events) {
    const cue = cueFor(event.type)
    if (cue) cues.add(cue)
  }
  return CUE_URGENCY.find((cue) => cues.has(cue)) ?? null
}

/** The cue an event deserves, or null for the ones that are merely bookkeeping. */
export function cueFor(eventType: string): Cue | null {
  switch (eventType) {
    case 'BATTLE_STARTED':
      return 'battle'
    case 'PROVINCE_CAPTURED':
      return 'captured'
    case 'BUILD_COMPLETED':
    case 'UNIT_RECRUITED':
      return 'complete'
    case 'RESOURCE_SHORTAGE':
      return 'shortage'
    case 'WAR_DECLARED':
      return 'war'
    default:
      return null
  }
}
