import { advanceTicks } from '@worldwar/ai'
import { HASH_OMIT_KEYS, type Command, type GameEvent, type GameState, type MapData, type PlayerId, type Rules } from '@worldwar/core'
import { canonicalText, hashValue } from '@worldwar/shared'
import {
  NO_PAUSE,
  applyPause,
  isPausedAt,
  pauseAnswer,
  pauseRequest,
  pauseResume,
  pollPause,
  type PauseState,
} from './pause'
import { envelope, type CommandsMessage, type EndMessage, type PauseMessage } from './protocol'

/**
 * Der Gleichschritt (T-M37-06, T-M37-07, R-MP-03, D28.5, MEHRSPIELER.md §2).
 *
 * Das ganze Verfahren in einem Satz: **ein Tick läuft, wenn beide Befehlslisten da sind,
 * und sonst nicht.** Übertragen werden nur Befehle, nie Zustände; beide Rechner haben
 * denselben Zustand und rechnen beide die ganze Partie, Computergegner eingeschlossen.
 *
 * Daraus folgen drei Dinge, die keine Zierde sind:
 *
 * 1. **Das Tempo synchronisiert sich von selbst** — der Langsamere gibt es vor, weil der
 *    Schnellere ohnehin auf seine Nachricht wartet.
 * 2. **Ein Befehl, der jetzt gegeben wird, gilt für `tick + 2`.** Das fällt niemandem auf,
 *    weil Befehle seit T-M22-05 ohnehin erst im nächsten Tick wirken: der Mehrspieler
 *    verdoppelt eine Verzögerung, die es schon gibt, statt eine neue einzuführen.
 * 3. **Es gibt keinen Schiedsrichter.** Die Reihenfolge der Befehle innerhalb eines Ticks
 *    ist ohne Absprache eindeutig, weil beide Seiten nach derselben Regel sortieren
 *    (`orderCommands`, T-M37-07).
 *
 * **Der Kern wird nicht angefasst.** Gerechnet wird mit `advanceTicks` und `opts.scripted`
 * — das gibt es seit T-M14-04 für die Wiedergabe und passt genau, weil es je Tick nach
 * Befehlen fragt. Keine Zeile in `packages/core`, keine in `data/rules`.
 */

/** Ein Befehl, der jetzt gegeben wird, gilt für diesen Tick plus so viele (D28.5). */
export const DEFAULT_COMMAND_DELAY = 2

export type LockstepStatus =
  /** Beide Listen sind da; der nächste Tick kann gerechnet werden. */
  | 'ready'
  /** Es fehlt mindestens eine Liste. Die Uhr steht, und nichts geht verloren. */
  | 'waiting'
  /** Beide haben einer Pause zugestimmt; die Uhr steht ab einem verabredeten Tick. */
  | 'paused'
  /** Die Prüfsummen weichen ab. Die Partie hält an, statt zwei Welten weiterzuspielen. */
  | 'desynced'
  /** Die Partie ist entschieden; der Kern rechnet nicht weiter. */
  | 'finished'

export interface LockstepOptions {
  /** Der eigene Platz — die Kennung in `state.playerOrder`, nicht „Host" oder „Gast". */
  seat: PlayerId
  /**
   * Alle Plätze, die je Tick eine Nachricht schicken, der eigene eingeschlossen.
   *
   * Zwei sind es heute (MEHRSPIELER.md §6 schließt mehr ausdrücklich aus); die Maschine
   * zählt sie trotzdem, statt „der andere" zu sagen — eine Zwei, die irgendwo als Literal
   * steht, ist eine Zwei, die man später an sieben Stellen sucht.
   */
  seats: readonly PlayerId[]
  state: GameState
  ctx: { map: MapData; rules: Rules }
  /** Vorgabe: `DEFAULT_COMMAND_DELAY`. Im Test kleiner, damit ein Fall in drei Ticks steht. */
  delayTicks?: number
}

/** Was ein Schritt getan hat — oder warum er es nicht getan hat. */
export interface StepOutcome {
  /** Wurde wirklich gerechnet? */
  ran: boolean
  /** Der Tick, der gerechnet wurde — oder auf den gewartet wird. */
  tick: number
  /** Die Plätze, deren Liste fehlt. Leer, sobald gerechnet wurde. */
  waitingFor: readonly PlayerId[]
  /** Die Befehle in der Reihenfolge, in der sie angewendet wurden (ohne die der KI). */
  applied: readonly Command[]
  /** Die Ereignisse dieses Ticks — der Strom, nicht der Ringpuffer im Zustand. */
  events: readonly GameEvent[]
}

/**
 * Die Reihenfolge der Befehle innerhalb eines Ticks (T-M37-07, R-MP-03/AK2, D28.5).
 *
 * **Die Falle, an der Gleichschritt-Umsetzungen scheitern:** zwei Seiten wenden dieselben
 * Befehle in verschiedener Reihenfolge an und laufen auseinander, ohne dass jemand einen
 * Fehler gemacht hat. Die Eingangsreihenfolge ist dafür untauglich — sie hängt daran, wer
 * zuerst geschickt hat, und das ist von Tick zu Tick verschieden.
 *
 * **Die Regel:** sortiert wird nach der Stellung des Spielers in `state.playerOrder`, und
 * innerhalb eines Spielers bleibt seine eigene Reihenfolge erhalten. Das ist stabil, weil
 * `playerOrder` ein ausdrückliches Feld des Zustands ist und kein Nebenprodukt der
 * Schlüsselreihenfolge (`state/types.ts`, Regel 3) — und weil die Befehle eines Spielers
 * immer von genau einem Platz kommen.
 *
 * Was `playerOrder` nicht kennt, hängt hinten an, in Eingangsreihenfolge: eine Kennung, die
 * es nicht gibt, lehnt der Kern ohnehin ab, aber die *Reihenfolge* muss auch dann auf
 * beiden Seiten dieselbe sein — sonst hinge das Ergebnis daran, wer zuerst geschickt hat.
 *
 * Die Befehle der Computergegner stehen hier nicht: sie hängt `commandsForTick` hinten an,
 * und beide Seiten berechnen sie ohnehin selbst und identisch.
 */
export function orderCommands(playerOrder: readonly PlayerId[], commands: readonly Command[]): Command[] {
  // Ein Fach je Macht, in der Reihenfolge des Zustands — plus eines für alles Unbekannte.
  const buckets = new Map<PlayerId, Command[]>()
  for (const id of playerOrder) buckets.set(id, [])
  const unknown: Command[] = []

  for (const command of commands) {
    const bucket = buckets.get(command.playerId)
    if (bucket) bucket.push(command)
    else unknown.push(command)
  }

  const out: Command[] = []
  for (const id of playerOrder) out.push(...(buckets.get(id) ?? []))
  out.push(...unknown)
  return out
}

/** Die Prüfsumme eines Zustands, wie sie in jede Nachricht geht (D28.6). */
export function stateHash(state: GameState): string {
  return hashValue(state, { omitKeys: HASH_OMIT_KEYS })
}

/**
 * Der Text, aus dem die Prüfsumme entsteht (T-M37-09, R-MP-04/AK2, D28.6).
 *
 * Das Werkzeug für die Untersuchung **nach** einem Auseinanderlaufen: zwei dieser Texte
 * nebeneinander sagen, an welchem Feld die Welten sich trennen — die Prüfsumme sagt nur,
 * *dass* sie es tun. `canonicalText` gibt es seit M1 in `packages/shared/src/hash.ts` und
 * wurde nie gebraucht.
 *
 * **Lokal und freiwillig, nicht im Spielfluss.** Der Text ist um ein Vielfaches größer als
 * der Spielstand; ihn je Tick zu erzeugen wäre ein Preis für etwas, das an 999 von 1000
 * Ticks niemand liest.
 */
export function canonicalOf(state: GameState): string {
  return canonicalText(state, { omitKeys: HASH_OMIT_KEYS })
}

/**
 * Was festgehalten wird, wenn zwei Welten sich trennen (T-M37-09, R-MP-04/AK1).
 *
 * Der Tick ist der **erste nicht mehr gerechnete** — vor ihm waren beide Seiten gleich,
 * ab ihm ist die Frage offen, und niemand kann hinterher mehr sagen, welche Welt die
 * richtige war. Genau deshalb hält die Partie an, statt weiterzuspielen.
 */
export interface DesyncReport {
  tick: number
  /** Der Platz, dessen Prüfsumme abweicht. */
  seat: PlayerId
  /** Die eigene Prüfsumme des zuletzt gerechneten Ticks. */
  own: string
  /** Die der Gegenseite. */
  other: string
}

/** Ein Spielstand, so wie ihn eine Seite nach dem Anhalten sichern kann (R-MP-04/AK2). */
export interface LockstepSnapshot {
  tick: number
  hash: string
  state: GameState
}

/**
 * Die Zustandsmaschine: sammeln, freigeben, rechnen.
 *
 * Bewusst eine Klasse und keine Kette reiner Funktionen: sie hält vier veränderliche
 * Dinge zusammen (Zustand, Postfach, Ausgangsfach, Tick), und jede Aufteilung davon wäre
 * eine zweite Stelle, an der die Ticks auseinanderlaufen können.
 */
export class Lockstep {
  readonly seat: PlayerId
  readonly seats: readonly PlayerId[]
  readonly delayTicks: number

  protected current: GameState
  protected readonly ctx: { map: MapData; rules: Rules }
  /** Eigene Befehle, nach dem Tick sortiert, für den sie gelten. */
  protected readonly outbox = new Map<number, Command[]>()
  /** Was für einen Tick schon eingetroffen ist, je Platz. */
  protected readonly inbox = new Map<number, Map<PlayerId, CommandsMessage>>()
  protected finished = false
  protected divergence: DesyncReport | null = null
  protected pauseState: PauseState = NO_PAUSE

  constructor(options: LockstepOptions) {
    this.seat = options.seat
    this.seats = [...options.seats]
    this.delayTicks = options.delayTicks ?? DEFAULT_COMMAND_DELAY
    this.current = options.state
    this.ctx = options.ctx
  }

  /** Der Tick, der als Nächstes gerechnet wird. */
  get tick(): number {
    return this.current.tick
  }

  get state(): GameState {
    return this.current
  }

  /** Die Prüfsumme des zuletzt gerechneten Ticks — die Zahl, die in jede Nachricht geht. */
  get hash(): string {
    return stateHash(this.current)
  }

  get status(): LockstepStatus {
    // Das Auseinanderlaufen steht vorn: eine Partie, die sich getrennt hat, ist weder
    // „bereit" noch „wartend" — sie ist vorbei, bis jemand hinsieht.
    if (this.divergence) return 'desynced'
    if (this.finished) return 'finished'
    // Die verabredete Pause steht vor dem Warten: „warte auf Mitspieler" waere falsch,
    // wenn beide sich gerade darauf geeinigt haben, nicht weiterzuspielen.
    if (isPausedAt(this.pauseState, this.tick)) return 'paused'
    return this.waitingFor().length === 0 ? 'ready' : 'waiting'
  }

  /** Der Stand des Pausenvertrags — Antrag, Halt, angekündigtes Fortsetzen (T-M37-10). */
  get pause(): PauseState {
    return this.pauseState
  }

  /**
   * Eine Pause beantragen (R-MP-05/AK1).
   *
   * Der Antrag hält **nichts** an: er geht hinaus und wird sichtbar, und die Partie läuft
   * weiter, bis der andere zustimmt. Die Nachricht gilt ab `tick + delay` — dieselbe
   * Verzögerung wie ein Befehl, damit sie rechtzeitig ankommt.
   */
  requestPause(at: number): PauseMessage {
    const message = pauseRequest(this.tick, this.delayTicks)
    this.pauseState = applyPause(this.pauseState, message, { by: this.seat, at })
    return message
  }

  /** Zustimmen oder ablehnen. Die Antwort trägt den Tick des Antrags weiter (AK2). */
  answerPause(accept: boolean, at: number): PauseMessage {
    const message = pauseAnswer(this.pauseState, accept ? 'ja' : 'nein')
    this.pauseState = applyPause(this.pauseState, message, { by: this.seat, at })
    return message
  }

  /** Fortsetzen — einseitig, mit drei Sekunden Vorlauf. Die Asymmetrie ist Absicht (D28.7). */
  resume(at: number): PauseMessage {
    const message = pauseResume(this.pauseState)
    this.pauseState = applyPause(this.pauseState, message, { by: this.seat, at })
    return message
  }

  /** Eine Pausennachricht der Gegenseite anwenden — dieselbe Funktion wie für die eigene. */
  receivePause(from: PlayerId, message: PauseMessage, at: number): void {
    this.pauseState = applyPause(this.pauseState, message, { by: from, at })
  }

  /**
   * Die Wanduhr weiterdrehen: ein Antrag verfällt nach dreißig Sekunden, ein
   * angekündigtes Fortsetzen wird nach drei fällig. Der einzige Ort, an dem echte Zeit in
   * dieser Maschine vorkommt — und auch hier wird sie hereingereicht, nicht gelesen.
   */
  pollClock(at: number): PauseState {
    this.pauseState = pollPause(this.pauseState, at)
    return this.pauseState
  }

  /** Der Befund, wenn die Welten sich getrennt haben — sonst `null` (T-M37-09). */
  get desync(): DesyncReport | null {
    return this.divergence
  }

  /**
   * Den eigenen Stand sichern, damit der Fehler untersuchbar bleibt (R-MP-04/AK2).
   *
   * Der Zustand selbst, nicht eine Zusammenfassung: er geht durch dieselbe Serialisierung
   * wie ein Spielstand, und erst dann lässt sich fragen, welche der beiden Welten die
   * richtige war. `canonicalOf` daneben sagt, **wo** sie sich unterscheiden.
   */
  snapshot(): LockstepSnapshot {
    return { tick: this.tick, hash: this.hash, state: this.current }
  }

  /**
   * Die Nachricht, mit der eine Seite das Ende ansagt.
   *
   * Bei einem Auseinanderlaufen nennt sie den strittigen Tick — „ab wann" ist die einzige
   * Auskunft, die hinterher noch etwas wert ist.
   */
  endMessage(reason: EndMessage['reason'] = 'auseinandergelaufen'): EndMessage {
    return { ...envelope('ende'), reason, tick: this.divergence?.tick ?? this.tick }
  }

  /**
   * Einen Befehl geben. Er gilt für `tick + delay` und wird in der Nachricht dieses Ticks
   * verschickt — gibt zurück, für welchen Tick, damit die Oberfläche es sagen kann.
   */
  give(command: Command): number {
    const target = this.tick + this.delayTicks
    this.outbox.set(target, [...(this.outbox.get(target) ?? []), command])
    return target
  }

  /**
   * Die Nachricht dieses Ticks — **auch wenn sie leer ist**.
   *
   * Je Tick genau eine, von jeder Seite: eine ausgelassene leere Nachricht wäre von einer
   * abgerissenen Verbindung nicht zu unterscheiden, und die Gegenseite wartete ewig.
   */
  emit(tick: number = this.tick): CommandsMessage {
    const message: CommandsMessage = {
      ...envelope('befehle'),
      tick,
      commands: this.outbox.get(tick) ?? [],
      hash: this.hash,
    }
    // Die eigene Nachricht zählt mit: der Tick läuft, wenn ALLE Plätze geliefert haben.
    this.put(this.seat, message)
    return message
  }

  /** Eine Nachricht der Gegenseite einsortieren. */
  receive(from: PlayerId, message: CommandsMessage): void {
    this.put(from, message)
  }

  protected put(from: PlayerId, message: CommandsMessage): void {
    const fuerTick = this.inbox.get(message.tick) ?? new Map<PlayerId, CommandsMessage>()
    fuerTick.set(from, message)
    this.inbox.set(message.tick, fuerTick)
  }

  /** Worauf gewartet wird — für die Kopfleiste, die nach zwei Sekunden etwas sagen soll. */
  waitingFor(tick: number = this.tick): PlayerId[] {
    const da = this.inbox.get(tick)
    return this.seats.filter((seat) => !da?.has(seat))
  }

  /** Kann der nächste Tick gerechnet werden? */
  canStep(): boolean {
    return this.status === 'ready'
  }

  /**
   * Einen Tick rechnen, wenn beide Listen da sind.
   *
   * Gerechnet wird mit `advanceTicks` und `opts.scripted` — **ohne eine Zeile Änderung im
   * Kern**. `commandsForTick` hängt die Befehle der Computergegner selbst hinten an, auf
   * beiden Seiten identisch aus demselben Zustand.
   */
  step(): StepOutcome {
    const tick = this.tick
    if (!this.canStep()) {
      return { ran: false, tick, waitingFor: this.waitingFor(), applied: [], events: [] }
    }

    // Zuerst die Pruefsumme, dann die Rechnung (T-M37-09, R-MP-04/AK1, D28.6): jede
    // Nachricht traegt den Hash des zuletzt gerechneten Ticks. Weicht er ab, sind die
    // Welten schon getrennt, und ein weiterer Tick machte die Frage nur unbeantwortbarer.
    const abweichung = this.checkHashes(tick)
    if (abweichung) {
      this.divergence = abweichung
      return { ran: false, tick, waitingFor: [], applied: [], events: [] }
    }

    const applied = this.commandsFor(tick)
    const result = advanceTicks(this.current, 1, this.ctx, {
      scripted: (at) => (at === tick ? applied : []),
    })

    if (result.ticks === 0) {
      // Der Kern rechnet eine entschiedene Partie nicht weiter (`victory.winner`).
      this.finished = true
      return { ran: false, tick, waitingFor: [], applied: [], events: [] }
    }

    this.current = result.state
    this.inbox.delete(tick)
    this.outbox.delete(tick)
    return { ran: true, tick, waitingFor: [], applied, events: result.events }
  }

  /**
   * Trägt eine der Nachrichten dieses Ticks eine andere Prüfsumme als der eigene Stand?
   *
   * Verglichen wird gegen den **eigenen** Hash: alle Seiten haben `tick - 1` hinter sich,
   * wenn sie die Nachricht für `tick` schreiben, also beschreiben alle Zahlen denselben
   * Augenblick. Die eigene Nachricht ist dabei egal — sie trägt den eigenen Hash.
   */
  protected checkHashes(tick: number): DesyncReport | null {
    const eigener = this.hash
    for (const [seat, message] of this.inbox.get(tick) ?? []) {
      if (seat === this.seat) continue
      if (message.hash !== eigener) return { tick, seat, own: eigener, other: message.hash }
    }
    return null
  }

  /** Die Befehle eines Ticks, aus allen eingetroffenen Listen, in der Reihenfolge der Regel. */
  protected commandsFor(tick: number): Command[] {
    const da = this.inbox.get(tick)
    if (!da) return []
    // Eingesammelt wird in der Reihenfolge der Plaetze; sortiert wird danach ohnehin nach
    // `playerOrder`, also haengt das Ergebnis nicht daran, wer zuerst geschickt hat.
    const alle: Command[] = []
    for (const seat of this.seats) alle.push(...(da.get(seat)?.commands ?? []))
    return orderCommands(this.current.playerOrder, alle)
  }
}

/** Eine Maschine bauen. Eine Funktion davor, damit Aufrufer kein `new` schreiben müssen. */
export function createLockstep(options: LockstepOptions): Lockstep {
  return new Lockstep(options)
}
