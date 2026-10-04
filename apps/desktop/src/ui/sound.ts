import bong from './sfx/bong_001.ogg?inline'
import confirmation from './sfx/confirmation_002.ogg?inline'
import error from './sfx/error_004.ogg?inline'
import bell from './sfx/impactBell_heavy_003.ogg?inline'
import metalHeavy from './sfx/impactMetal_heavy_001.ogg?inline'
import metalMedium from './sfx/impactMetal_medium_002.ogg?inline'
import plate from './sfx/impactPlate_heavy_002.ogg?inline'
import question from './sfx/question_002.ogg?inline'
import select from './sfx/select_002.ogg?inline'

/**
 * Sound and motion (T-M11-02, T-M46-14, R-UI-04/R-ASSET-01).
 *
 * Seit T-M46-14 klingt jede Ereignisart nach einer eigenen Aufnahme: neun kurze OGG-Dateien
 * von Kenney (CC0, Interface Sounds und Impact Sounds; Eintraege in `docs/ASSETS.md`). Sie
 * stehen als Daten-URL im Bundle und werden ueber `decodeAudioData` gelesen — kein
 * `fetch`, denn das ausgelieferte Programm hat `connect-src 'none'`. Noah (VM-04): Statt
 * einfach diesen Ploppen, das nervt sehr. Die erzeugten Toene unten bleiben nur als Rueckfall,
 * wo es keine Dekodierung gibt oder eine Datei sich nicht lesen laesst.
 *
 * LOESCHVERMERK (Review): bis T-M46-14 stand hier: The sounds are synthesised rather than
 * recorded — a few oscillators through the Web Audio API. Nothing is downloaded, nothing is
 * licensed, nothing is anybody else's (R-ASSET-01), and the whole set weighs nothing.
 *
 * Two rules, and both exist because of how this game is played. Sound can be switched
 * off completely and stays off. And nothing plays above a walking pace: at a hundred
 * game hours a second the alerts would arrive dozens per second, which is not
 * atmosphere but a fault siren.
 */

export type Cue =
  | 'battle'
  | 'captured'
  | 'complete'
  | 'recruited'
  | 'shortage'
  | 'war'
  | 'intruded'
  | 'diplomacy'
  | 'select'

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
  recruited: { frequency: 560, durationMs: 90, type: 'sine', gain: 0.07 },
  intruded: { frequency: 240, durationMs: 300, type: 'square', gain: 0.07 },
  diplomacy: { frequency: 392, durationMs: 160, type: 'sine', gain: 0.08 },
}

/**
 * Welche Aufnahme zu welcher Ereignisart gehoert, und wie laut (T-M46-14).
 *
 * Ein Klang je Art, damit man mit geschlossenen Augen hoert, WAS geschieht: der Befehl ein
 * leiser Klick, die Fertigstellung ein heller Bestaetigungston, die Aushebung ein Metallklang,
 * der Mangel ein Fehlerton, das Gefecht ein schwerer Metallschlag, die Eroberung eine Glocke,
 * der Krieg ein dumpfer Plattenschlag, der Einmarsch ein tiefer Alarmton, die Diplomatie eine
 * Frage. Die Lautstaerke ist je Aufnahme festgelegt, nicht je Wiedergabe.
 */
const SAMPLES: Record<Cue, { url: string; gain: number }> = {
  select: { url: select, gain: 0.5 },
  complete: { url: confirmation, gain: 0.6 },
  recruited: { url: metalMedium, gain: 0.5 },
  shortage: { url: error, gain: 0.6 },
  battle: { url: metalHeavy, gain: 0.7 },
  captured: { url: bell, gain: 0.7 },
  war: { url: plate, gain: 0.8 },
  intruded: { url: bong, gain: 0.8 },
  diplomacy: { url: question, gain: 0.6 },
}

/** Die Daten-URL einer Aufnahme als Bytes — ohne Netz, ohne fetch. */
function bytesOf(dataUrl: string): ArrayBuffer {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const binary = globalThis.atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

/** Die dekodierten Aufnahmen je Kontext; null heisst: nicht lesbar, es bleibt beim erzeugten Ton. */
const decoded = new WeakMap<object, Map<Cue, Promise<AudioBuffer | null>>>()

function bufferFor(audio: AudioContext, cue: Cue): Promise<AudioBuffer | null> {
  let perContext = decoded.get(audio)
  if (!perContext) {
    perContext = new Map()
    decoded.set(audio, perContext)
  }
  let pending = perContext.get(cue)
  if (!pending) {
    pending = audio
      .decodeAudioData(bytesOf(SAMPLES[cue].url))
      .then((buffer) => buffer)
      .catch(() => null)
    perContext.set(cue, pending)
  }
  return pending
}

/** Dekodiert alle Aufnahmen im Voraus, damit der erste Klang nicht auf die Dekodierung wartet. */
export function preloadSamples(audio: Pick<AudioContext, 'decodeAudioData'>): void {
  if (typeof audio.decodeAudioData !== 'function') return
  for (const cue of Object.keys(SAMPLES) as Cue[]) void bufferFor(audio as AudioContext, cue)
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
  if (!context) {
    context = new globalThis.AudioContext()
    resumeOnGesture(context)
    preloadSamples(context)
  }
  return context
}

/** Was die Weckregel von einem AudioContext braucht. */
interface Resumable {
  readonly state: string
  resume: () => Promise<void>
}

type GestureTarget = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>

/** Die Gesten, die ein Browser als Nutzeraktivierung zaehlt und die jede Eingabeart hat. */
export const UNLOCK_EVENTS = ['pointerdown', 'keydown'] as const

/**
 * Weckt einen schlafenden Ton bei der ersten Beruehrung (Android-Emulator, 2026-09-24).
 *
 * Chrome auf Android startet einen AudioContext, der vor jeder Nutzergeste entsteht, im
 * Zustand `suspended` — und er bleibt stumm, bis `resume()` in einer Geste laeuft. Genau
 * das geschieht hier: bei jedem `pointerdown`/`keydown`, solange er schlaeft; sobald er
 * laeuft, haengt sich die Regel ab. Scheitert das Wecken, versucht es die naechste Geste.
 *
 * Gibt eine Aufraeumfunktion zurueck. Ohne Ereignisziel (node) haengt sie nichts an.
 */
export function resumeOnGesture(
  audio: Resumable,
  target: GestureTarget | undefined = globalThis as unknown as GestureTarget,
): () => void {
  if (audio.state !== 'suspended' || typeof target?.addEventListener !== 'function') return () => undefined

  const remove = (): void => {
    for (const type of UNLOCK_EVENTS) target.removeEventListener(type, unlock, { capture: true })
  }
  function unlock(): void {
    if (audio.state !== 'suspended') {
      remove()
      return
    }
    void audio.resume().then(
      () => {
        if (audio.state !== 'suspended') remove()
      },
      () => undefined,
    )
  }
  for (const type of UNLOCK_EVENTS) target.addEventListener(type, unlock, { capture: true, passive: true })
  return remove
}

/**
 * Plays one cue. Silently does nothing where there is no audio at all — a game that
 * refuses to start because a browser has no audio context would be absurd.
 */
export function play(cue: Cue, options: SoundOptions, factory: AudioFactory = defaultFactory): boolean {
  if (!shouldPlay(cue, options)) return false

  const audio = factory()
  if (!audio) return false

  // Die Aufnahme, wo der Kontext dekodieren kann (T-M46-14); sonst der erzeugte Ton.
  if (typeof audio.decodeAudioData === 'function' && typeof audio.createBufferSource === 'function') {
    void bufferFor(audio, cue).then((buffer) => {
      if (buffer) startSample(audio, buffer, SAMPLES[cue].gain)
      else startTone(audio, TONES[cue])
    })
    return true
  }

  startTone(audio, TONES[cue])
  return true
}

function startSample(audio: AudioContext, buffer: AudioBuffer, level: number): void {
  const source = audio.createBufferSource()
  const gain = audio.createGain()
  source.buffer = buffer
  gain.gain.value = level
  source.connect(gain)
  gain.connect(audio.destination)
  source.start()
}

/** Der erzeugte Ton: der Rueckfall, wenn es keine lesbare Aufnahme gibt. */
function startTone(audio: AudioContext, tone: Tone): void {
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
const CUE_URGENCY: readonly Cue[] = [
  'war',
  'intruded',
  'captured',
  'battle',
  'shortage',
  'diplomacy',
  'recruited',
  'complete',
  'select',
]

/** The single cue a batch of events deserves, or null when none of them is worth a sound. */
export function cueForEvents(events: readonly { type: string }[]): Cue | null {
  const cues = new Set<Cue>()
  for (const event of events) {
    const cue = cueFor(event.type)
    if (cue) cues.add(cue)
  }
  return CUE_URGENCY.find((cue) => cues.has(cue)) ?? null
}

/**
 * Der Ton der Ereignisse, die MICH angehen (T-M28-08).
 *
 * `cueForEvents` sieht jedes lesbare Ereignis an — und lesbar ist auch ein oeffentliches
 * (`audience: []`). Ein Gefecht zwischen China und Indien spielte dem amerikanischen
 * Spieler deshalb einen Kampfton vor, eine Kriegserklaerung zweier Fremder den
 * Kriegston. `concerns` beantwortet dieselbe Frage, die es fuer das Vorspulen schon
 * beantwortet (T-M15-01, `firstAlertFor`): wen es angeht.
 */
export function cueForOwnEvents(
  events: readonly { type: string; concerns?: readonly string[] }[],
  viewer: string,
): Cue | null {
  return cueForEvents(events.filter((event) => (event.concerns ?? []).includes(viewer)))
}

/** The cue an event deserves, or null for the ones that are merely bookkeeping. */
export function cueFor(eventType: string): Cue | null {
  switch (eventType) {
    case 'BATTLE_STARTED':
      return 'battle'
    case 'PROVINCE_CAPTURED':
      return 'captured'
    case 'BUILD_COMPLETED':
      return 'complete'
    // Die Aushebung hat seit T-M46-14 einen eigenen Klang (vorher derselbe wie der Bau).
    case 'UNIT_RECRUITED':
      return 'recruited'
    case 'DIPLOMACY_CHANGED':
      return 'diplomacy'
    case 'RESOURCE_SHORTAGE':
      return 'shortage'
    case 'WAR_DECLARED':
      return 'war'
    // Der Einmarsch bekam bis T-M46-14 den Kriegston (T-M28-06); jetzt hat der Alarm einen eigenen.
    case 'ARMY_INTRUDED':
      return 'intruded'
    default:
      return null
  }
}
