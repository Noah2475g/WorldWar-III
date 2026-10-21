import { CUE_SPEED_LIMIT, prefersReducedMotion } from './sound.ts'

/**
 * The little movement this interface allows itself (T-M13-16, R-UI-04).
 *
 * Exactly one thing moves on its own: the ring around a battle. It breathes, so that a
 * fight is findable on a map of 237 provinces without the player hunting for a red
 * circle. Everything else that moves does so once, in response to something the player
 * or the world did — a new alert fading in, a finished building lighting up — and is
 * done with it.
 *
 * A pure function of time, which is what makes "does it pulse in a steady rhythm"
 * something a test can answer rather than something a person has to watch.
 */

/** One breath of the battle ring. Slow enough to read as breathing, not as blinking. */
export const PULSE_PERIOD_MS = 1600

/**
 * The pulse at a moment in time, 0…1 and back, as a smooth curve.
 *
 * Returns a constant when movement is unwanted — the system setting, or a game running
 * faster than a person can watch. At a hundred game hours a second the ring would
 * strobe, which is not atmosphere but a fault light.
 */
export function pulse(timeMs: number, options: { speed?: number; reduced?: boolean; period?: number } = {}): number {
  const reduced = options.reduced ?? prefersReducedMotion()
  if (reduced || (options.speed ?? 0) > CUE_SPEED_LIMIT) return 1

  const period = options.period ?? PULSE_PERIOD_MS
  // Cosine rather than a sawtooth: a ring that jumps back to its smallest size at the
  // end of each cycle twitches instead of breathing.
  return (1 - Math.cos((timeMs / period) * 2 * Math.PI)) / 2
}

/** Whether anything should move at all right now. */
export function motionAllowed(speed: number, reduced = prefersReducedMotion()): boolean {
  return !reduced && speed <= CUE_SPEED_LIMIT
}

/** The battle ring's radius at a moment in time. */
export function ringRadius(timeMs: number, base: number, options: Parameters<typeof pulse>[1] = {}): number {
  return base + pulse(timeMs, options) * 3
}

/** Wie lange ein Gefechtsblitz nachleuchtet (T-M28-08). Eine Runde, ein Blitz. */
export const BATTLE_FLASH_MS = 260

/**
 * Die Helligkeit des Gefechtsblitzes, 1 im Augenblick der Runde und 0 am Ende (T-M28-08).
 *
 * Der Puls daneben atmet in eigenem Takt und sagt nichts ueber das Spiel; dieser Wert
 * haengt am Spieltick — er ist die einzige Bewegung auf dieser Karte, die etwas meldet
 * statt nur zu leben. Und wie jede: wer weniger Bewegung verlangt oder schneller spielt,
 * als ein Mensch zusieht, bekommt sie gar nicht. Der Ring bleibt dann trotzdem gross —
 * die Groesse ist Zustand, nicht Bewegung.
 */
export function battleFlash(
  sinceRoundMs: number,
  options: { speed?: number; reduced?: boolean; duration?: number } = {},
): number {
  const reduced = options.reduced ?? prefersReducedMotion()
  if (reduced || (options.speed ?? 0) > CUE_SPEED_LIMIT) return 0

  const duration = options.duration ?? BATTLE_FLASH_MS
  if (!(sinceRoundMs >= 0) || sinceRoundMs >= duration) return 0
  return 1 - sinceRoundMs / duration
}

/** Wie lange die Farbwelle eines Besitzwechsels laeuft (T-M26-02, D25.4). */
export const OWNERSHIP_FADE_MS = 600

/**
 * Die Blendkurve eines Besitzwechsels: 0 bei Beginn, 1 am Ende, dazwischen weich.
 *
 * Smoothstep statt linear — eine Flaeche, die mit konstanter Rate umkippt, wirkt wie
 * ein Ladebalken; eine, die sich einschwingt, wie ein Ereignis. Und wie beim Puls:
 * wer weniger Bewegung verlangt (Systemeinstellung) oder die Partie schneller laufen
 * laesst, als ein Mensch zusieht, bekommt sofort den neuen Zustand — der alte harte
 * Wechsel war nie falsch, nur stumm.
 */
export function fadeProgress(
  elapsedMs: number,
  options: { speed?: number; reduced?: boolean; duration?: number } = {},
): number {
  const reduced = options.reduced ?? prefersReducedMotion()
  if (reduced || (options.speed ?? 0) > CUE_SPEED_LIMIT) return 1

  const duration = options.duration ?? OWNERSHIP_FADE_MS
  const t = Math.min(1, Math.max(0, elapsedMs / duration))
  return t * t * (3 - 2 * t)
}

/**
 * Die Feder-Stuetzstellen des Zoom-Cluster-Uebergangs (T-M<n>-05, D9, Plan Zoom-Cluster \u00a73).
 *
 * Nachbau der CSS-`linear()`-Kurve `--spring` (urspruenglich `design-tokens-v3.css:49`) als
 * JS-Funktion, weil jsdom keine CSS-Easing-Kurven kennt (Risiko im Plan). Stuetzstellen ohne
 * Prozentangabe werden wie bei CSS `linear()` gleichmaessig zwischen die benachbarten
 * expliziten Stellen verteilt: `0` ist die erste (0 %), `.009` die einzige Stelle ohne Prozent
 * zwischen `0` (0 %) und `.035` (2,1 %) -> 1,05 %.
 */
const SPRING_STOPS: readonly (readonly [number, number])[] = [
  [0, 0],
  [1.05, 0.009],
  [2.1, 0.035],
  [4.4, 0.141],
  [12.9, 0.723],
  [16.7, 0.938],
  [19.8, 1.017],
  [23, 1.051],
  [26.5, 1.056],
  [33.6, 1.032],
  [41.5, 1.006],
  [50, 0.996],
  [100, 1],
]

/**
 * Stueckweise lineare Interpolation der `--spring`-Stuetzstellen, `t` in 0...1.
 *
 * Fuer den 420-ms-Teilen-Flug der Zoom-Cluster-Marken (D9): das Ziel wird kurz ueberschritten
 * (Maximum rund 1,056 bei t ~ 0,265) und schwingt sich dann ein, statt abrupt anzuhalten.
 */
export function spring(t: number): number {
  const pct = Math.min(1, Math.max(0, t)) * 100
  for (let i = 1; i < SPRING_STOPS.length; i++) {
    const [p0, v0] = SPRING_STOPS[i - 1]!
    const [p1, v1] = SPRING_STOPS[i]!
    if (pct <= p1) {
      if (p1 === p0) return v1
      const frac = (pct - p0) / (p1 - p0)
      return v0 + frac * (v1 - v0)
    }
  }
  return SPRING_STOPS[SPRING_STOPS.length - 1]![1]
}

/**
 * Kubische Bezier `cubic-bezier(.22,1,.36,1)` (CSS `--ease-out`), fuer das Buendeln (280 ms)
 * und die Blende ohne Partner (120 ms) im Zoom-Cluster-Uebergang (D9).
 *
 * Newton-Iteration auf dem x-Parameter (die Kurve ist in x streng monoton fuer diese
 * Kontrollpunkte), danach y aus demselben Bezier-Parameter t.
 */
export function easeOut(t: number): number {
  const x = Math.min(1, Math.max(0, t))
  const x1 = 0.22
  const x2 = 0.36
  const y1 = 1
  const y2 = 1

  const bezier = (p1: number, p2: number, s: number): number => {
    const mt = 1 - s
    return 3 * mt * mt * s * p1 + 3 * mt * s * s * p2 + s * s * s
  }
  const bezierDerivative = (p1: number, p2: number, s: number): number => {
    const mt = 1 - s
    return 3 * mt * mt * p1 + 6 * mt * s * (p2 - p1) + 3 * s * s * (1 - p2)
  }

  let s = x
  for (let i = 0; i < 8; i++) {
    const cx = bezier(x1, x2, s) - x
    const dx = bezierDerivative(x1, x2, s)
    if (Math.abs(dx) < 1e-6) break
    s -= cx / dx
    s = Math.min(1, Math.max(0, s))
  }
  return bezier(y1, y2, s)
}
