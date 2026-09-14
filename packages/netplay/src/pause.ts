import type { PlayerId } from '@worldwar/core'
import { envelope, type PauseKind, type PauseMessage } from './protocol'

/**
 * Die Pause als Vertrag (T-M37-10, R-MP-05, D28.7, MEHRSPIELER.md §3.5).
 *
 * Noahs Regel vom 2026-09-12: **beantragt und angenommen.** Kein einseitiges Anhalten —
 * wer eine Pause will, stellt einen Antrag, und die Partie steht erst, wenn der andere
 * zustimmt. Drei Einzelheiten machen daraus eine Mechanik, die hält:
 *
 * 1. **Die Pause hängt an einem Tick, nicht an einem Augenblick.** Sonst steht der eine
 *    bei Tick 500 und der andere bei 502, und der Gleichschritt wäre schon dabei
 *    auseinanderzulaufen, bevor jemand den Finger von der Taste genommen hat.
 * 2. **Ein Antrag verfällt** nach dreißig Sekunden ohne Antwort, mit Hinweis an beide.
 *    Sonst wartet einer auf etwas, das der andere längst weggeklickt hat.
 * 3. **Fortsetzen darf jeder allein**, mit drei Sekunden Vorlauf. Das ist mit Absicht
 *    nicht symmetrisch zum Anhalten: verlangte auch das Fortsetzen eine Zustimmung,
 *    könnte ein abgelenkter Mitspieler die Partie einsperren.
 *
 * **Reine Funktionen mit hereingereichter Uhr.** Kein `setTimeout`, kein `Date.now`: die
 * dreißig Sekunden und die drei Sekunden sind Wanduhrzeiten, und eine Zustandsmaschine,
 * die selbst auf die Uhr sieht, lässt sich nicht in Millisekunden prüfen — sie lässt sich
 * nur abwarten.
 */

/** Nach so langer Stille verfällt ein Antrag (R-MP-05/AK3). */
export const PAUSE_REQUEST_TIMEOUT_MS = 30_000

/** So viel Vorlauf hat das Fortsetzen, damit beide es kommen sehen (D28.7). */
export const RESUME_LEAD_MS = 3_000

/** Was zuletzt geschah — der Satz, den die Oberfläche zeigt. */
export type PauseNotice = 'requested' | 'accepted' | 'declined' | 'expired' | 'resuming' | 'resumed'

export interface PauseRequest {
  /** Wer ihn gestellt hat. */
  by: PlayerId
  /** Wann, auf der Wanduhr — allein für das Verfallen. */
  at: number
  /** Ab welchem Tick die Partie stünde, wenn zugestimmt wird. */
  fromTick: number
}

export interface PauseState {
  /** Der offene Antrag, wenn es einen gibt. */
  request: PauseRequest | null
  /** Ab welchem Tick die Partie steht; `null` heißt: sie läuft. */
  pausedFrom: number | null
  /** Wann sie wieder läuft (Wanduhr); `null` heißt: kein Fortsetzen angekündigt. */
  resumeAt: number | null
  notice: PauseNotice | null
}

/** Eine laufende Partie ohne offenen Antrag. */
export const NO_PAUSE: PauseState = { request: null, pausedFrom: null, resumeAt: null, notice: null }

/** Steht die Partie bei diesem Tick? */
export function isPausedAt(state: PauseState, tick: number): boolean {
  return state.pausedFrom !== null && tick >= state.pausedFrom
}

/**
 * Der Antrag, als Nachricht.
 *
 * `abTick` ist `tick + delay` — dieselbe Verzögerung wie bei einem Befehl, und aus
 * demselben Grund: die Gegenseite muss die Nachricht noch rechtzeitig bekommen.
 */
export function pauseRequest(tick: number, delayTicks: number): PauseMessage {
  return { ...envelope('pause'), art: 'antrag', abTick: tick + delayTicks }
}

/**
 * Die Antwort auf einen Antrag (R-MP-05/AK2).
 *
 * Sie trägt den Tick des Antrags weiter — **oder einen späteren, wenn der schon vorbei
 * wäre.** Genau daran wäre die Zusage sonst gerissen: zwischen Antrag und Zustimmung
 * vergeht Bedenkzeit, und in der Zeit läuft die Partie weiter. Wer bei Tick 10 einen Halt
 * ab 12 beantragt und bei Tick 14 eine Zustimmung bekommt, müsste rückwärts anhalten.
 *
 * Der Zustimmende rechnet den Tick, weil er der Spätere von beiden ist: der Gleichschritt
 * hält die zwei Uhren höchstens einen Tick auseinander, und `+ delay` deckt diesen Tick
 * und den Weg der Nachricht ab.
 */
export function pauseAnswer(
  state: PauseState,
  art: Extract<PauseKind, 'ja' | 'nein'>,
  at: { tick: number; delayTicks: number },
): PauseMessage {
  const beantragt = state.request?.fromTick ?? 0
  return { ...envelope('pause'), art, abTick: Math.max(beantragt, at.tick + at.delayTicks) }
}

/** Das Fortsetzen, als Nachricht. `abTick` ist der Tick, bei dem die Partie steht. */
export function pauseResume(state: PauseState): PauseMessage {
  return { ...envelope('pause'), art: 'weiter', abTick: state.pausedFrom ?? 0 }
}

/**
 * Eine Pausennachricht anwenden — auf **beiden** Seiten dieselbe Funktion.
 *
 * Genau das ist der Trick hinter R-MP-05/AK2: die Zustimmung trägt den Tick des Antrags
 * mit sich, also hängt der Halt nicht davon ab, was die jeweilige Seite lokal gespeichert
 * hat. Beide Uhren stehen deshalb beim **selben** Tick, auch wenn der Antrag auf einer
 * Seite schon verfallen war.
 */
export function applyPause(
  state: PauseState,
  message: PauseMessage,
  context: { by: PlayerId; at: number },
): PauseState {
  switch (message.art) {
    case 'antrag':
      // Ein Antrag allein hält NICHTS an (R-MP-05/AK1) — er wird nur sichtbar.
      return {
        ...state,
        request: { by: context.by, at: context.at, fromTick: message.abTick },
        notice: 'requested',
      }

    case 'ja':
      return { ...state, request: null, pausedFrom: message.abTick, resumeAt: null, notice: 'accepted' }

    case 'nein':
      return { ...state, request: null, notice: 'declined' }

    case 'weiter':
      // Drei Sekunden Vorlauf, und beide sehen sie kommen. Dass die Wanduhren der beiden
      // Rechner dabei um Millisekunden auseinanderliegen, macht nichts: der Gleichschritt
      // wartet ohnehin auf den Langsameren.
      return { ...state, resumeAt: context.at + RESUME_LEAD_MS, notice: 'resuming' }
  }
}

/**
 * Die Wanduhr weiterdrehen: verfallene Anträge und fälliges Fortsetzen.
 *
 * Wird von der Hülle regelmäßig gerufen — und ist der einzige Ort, an dem echte Zeit in
 * dieser Mechanik vorkommt.
 */
export function pollPause(state: PauseState, at: number): PauseState {
  let next = state

  if (next.request && at - next.request.at >= PAUSE_REQUEST_TIMEOUT_MS) {
    // Verfallen — und **beide** erfahren es (R-MP-05/AK3): beide Seiten rechnen dieselbe
    // Frist auf demselben Antrag, also fällt er auf beiden Rechnern von selbst.
    next = { ...next, request: null, notice: 'expired' }
  }

  if (next.resumeAt !== null && at >= next.resumeAt) {
    next = { ...next, pausedFrom: null, resumeAt: null, notice: 'resumed' }
  }

  return next
}

/** Wie lange ein offener Antrag noch gilt, in Millisekunden — `null`, wenn keiner offen ist. */
export function remainingRequestMs(state: PauseState, at: number): number | null {
  if (!state.request) return null
  return Math.max(0, PAUSE_REQUEST_TIMEOUT_MS - (at - state.request.at))
}
