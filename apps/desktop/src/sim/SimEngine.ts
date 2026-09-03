import {
  fastForward,
  firstAlertFor,
  publicView,
  runTicks,
  type Command,
  type FastForwardTarget,
  type GameEvent,
  type GameState,
  type PlayerId,
  type StepContext,
} from '@worldwar/core'
import type { FastForwardStop, SimMessage } from './protocol'

/**
 * The simulation side of the wire (T-M10-02, design D5).
 *
 * This is what runs inside the worker; `worker.ts` is only the shell that turns
 * postMessage into calls on this object. Real time enters through `advance(elapsedMs)`
 * and nowhere else — which is why the whole thing can be driven by a test without a
 * timer, a worker, or a browser.
 */

/**
 * How many ticks a single slice may owe. Design D5: when the machine cannot keep up
 * the *rate* drops, but no backlog accumulates. Without this cap, a window that was
 * in the background for a minute would owe six thousand ticks and freeze on return.
 */
export const TICK_BACKLOG_CAP = 2

/** At most twenty pictures per second, whatever the tick rate (design D5). */
export const UPDATE_INTERVAL_MS = 50

/** Above this speed single events are replaced by a daily digest (design D5). */
export const DIGEST_ABOVE_SPEED = 10

export const MAX_INTERACTIVE_SPEED = 100

/**
 * Game hours per batch while fast-forwarding. Large enough that the batching costs
 * nothing (thousands of hours per second), small enough that the stop button answers
 * within a frame.
 */
export const FAST_FORWARD_BATCH = 250

export interface SimEngineOptions {
  state: GameState
  ctx: StepContext
  /** Whose view leaves the worker. The human player — never "all". */
  viewerId: PlayerId
  emit: (message: SimMessage) => void
  /** Commands the AI contributes for a tick; the interface adds the player's. */
  commandSource?: (tick: number) => readonly Command[]
}

export interface EngineFastForwardResult {
  ticksRun: number
  stoppedBy: FastForwardStop
  trigger: GameEvent | null
}

export class SimEngine {
  #state: GameState
  readonly #ctx: StepContext
  readonly #viewerId: PlayerId
  readonly #emit: (message: SimMessage) => void
  readonly #commandSource: ((tick: number) => readonly Command[]) | undefined

  #speed = 0
  /** Fractional ticks owed to the player, always below the cap. */
  #backlog = 0
  #msSinceUpdate = Number.POSITIVE_INFINITY
  #queued: Command[] = []
  #digest: { day: number; counts: Record<string, number>; alerts: GameEvent[] } | null = null
  #ff: { target: FastForwardTarget; total: number; abort: boolean } | null = null

  constructor(options: SimEngineOptions) {
    this.#state = options.state
    this.#ctx = options.ctx
    this.#viewerId = options.viewerId
    this.#emit = options.emit
    this.#commandSource = options.commandSource
  }

  get tick(): number {
    return this.#state.tick
  }

  get speed(): number {
    return this.#speed
  }

  get backlog(): number {
    return this.#backlog
  }

  /**
   * The state itself, for tests and for saving — never for sending. Named so that a
   * reviewer notices immediately if it ever appears in a message.
   */
  get debugState(): GameState {
    return this.#state
  }

  setSpeed(hoursPerSecond: number): void {
    this.#speed = Math.max(0, Math.min(MAX_INTERACTIVE_SPEED, hoursPerSecond))
    // A speed change must not pay out time that passed while paused.
    this.#backlog = 0
  }

  enqueue(command: Command): void {
    this.#queued.push(command)
  }

  /** Real time has passed. Runs as many game hours as that buys, capped. */
  advance(elapsedMs: number): number {
    this.#msSinceUpdate += elapsedMs
    if (this.#speed === 0) return 0

    this.#backlog = Math.min(TICK_BACKLOG_CAP, this.#backlog + (elapsedMs / 1_000) * this.#speed)

    const due = Math.floor(this.#backlog)
    if (due > 0) {
      this.#backlog -= due
      this.#runInteractive(due)
    }

    if (this.#msSinceUpdate >= UPDATE_INTERVAL_MS) {
      this.#msSinceUpdate = 0
      this.#emitView()
    }
    return due
  }

  #runInteractive(ticks: number): void {
    const result = runTicks(this.#state, ticks, this.#ctx, (tick) => this.#commandsFor(tick))
    this.#state = result.state
    this.#report(result.events)
  }

  #commandsFor(tick: number): readonly Command[] {
    const queued = this.#queued
    this.#queued = []
    return [...queued, ...(this.#commandSource?.(tick) ?? [])]
  }

  /**
   * At high speed the simulation produces more events per second than a person can
   * read — and serialising them would cost more than the simulation itself. Alerts
   * still arrive one by one; everything else becomes a count per game day.
   */
  #report(events: readonly GameEvent[]): void {
    if (events.length === 0) return

    if (this.#speed <= DIGEST_ABOVE_SPEED) {
      this.#emit({ kind: 'events', events })
      return
    }

    const ticksPerDay = this.#ctx.rules.constants.ticksPerDay
    const day = Math.floor(this.#state.tick / ticksPerDay)
    if (this.#digest === null || this.#digest.day !== day) {
      this.#flushDigest()
      this.#digest = { day, counts: {}, alerts: [] }
    }

    for (const event of events) {
      this.#digest.counts[event.type] = (this.#digest.counts[event.type] ?? 0) + 1
    }
    const alert = firstAlertFor(events, this.#viewerId)
    if (alert) this.#digest.alerts.push(alert)
  }

  #flushDigest(): void {
    if (this.#digest === null) return
    this.#emit({
      kind: 'digest',
      day: this.#digest.day,
      counts: this.#digest.counts,
      alerts: this.#digest.alerts,
    })
    this.#digest = null
  }

  #emitView(): void {
    this.#flushDigest()
    this.#emit({ kind: 'view', view: publicView(this.#state, this.#viewerId) })
  }

  /** The current view on demand — after a command, or when a panel opens. */
  sendView(): void {
    this.#emitView()
  }

  get fastForwarding(): boolean {
    return this.#ff !== null
  }

  /**
   * Fast-forward (design D5, mode b): no snapshots, no per-event traffic, no picture.
   *
   * It runs in batches and the batches are driven from outside, one per slice of the
   * worker's clock. That is not an optimisation — it is the only way the stop button
   * can work at all: JavaScript is single-threaded, so a fast-forward that ran to
   * completion in one call would never reach the message that asks it to stop.
   */
  startFastForward(target: FastForwardTarget): void {
    this.#ff = { target, total: 0, abort: false }
  }

  abortFastForward(): void {
    if (this.#ff) this.#ff.abort = true
  }

  /** Runs one batch. Returns true while there is more to do. */
  continueFastForward(batchTicks: number = FAST_FORWARD_BATCH): boolean {
    const run = this.#ff
    if (!run) return false

    if (run.abort) {
      this.#ff = null
      this.#finishFastForward({ ticksRun: run.total, stoppedBy: 'aborted', trigger: null })
      return false
    }

    const result = fastForward(this.#state, this.#remaining(run.target, run.total), this.#ctx, {
      alertsFor: this.#viewerId,
      maxTicks: batchTicks,
      ...(this.#commandSource ? { commandSource: (tick: number) => this.#commandsFor(tick) } : {}),
    })
    this.#state = result.state
    run.total += result.ticksRun

    if (result.stoppedBy !== 'limit') {
      this.#ff = null
      this.#finishFastForward({ ticksRun: run.total, stoppedBy: result.stoppedBy, trigger: result.trigger })
      return false
    }

    this.#emit({ kind: 'fastForwardProgress', ticksRun: run.total })
    return true
  }

  /**
   * The whole run in one go — for headless use and for tests. shouldAbort stands in
   * for the stop button that the interface cannot press while this call is on the stack.
   */
  fastForward(target: FastForwardTarget, shouldAbort?: () => boolean): EngineFastForwardResult {
    this.startFastForward(target)
    let last: EngineFastForwardResult = { ticksRun: 0, stoppedBy: 'aborted', trigger: null }
    const capture = (result: EngineFastForwardResult): void => {
      last = result
    }
    this.#onFastForwardDone = capture

    while (this.continueFastForward()) {
      if (shouldAbort?.()) this.abortFastForward()
    }
    this.#onFastForwardDone = null
    return last
  }

  /**
   * Fast-forward runs in batches so the abort button stays responsive — but the core
   * counts 'ticks' and 'days' from the start of each call. Carrying the target across
   * batches means subtracting what already ran; state- and event-based targets need no
   * translation because they read the world, not the counter.
   */
  #remaining(target: FastForwardTarget, alreadyRun: number): FastForwardTarget {
    const ticksPerDay = this.#ctx.rules.constants.ticksPerDay
    if (target.kind === 'ticks') return { kind: 'ticks', ticks: target.ticks - alreadyRun }
    if (target.kind === 'days') return { kind: 'ticks', ticks: target.days * ticksPerDay - alreadyRun }
    return target
  }

  #onFastForwardDone: ((result: EngineFastForwardResult) => void) | null = null

  #finishFastForward(result: EngineFastForwardResult): void {
    this.#onFastForwardDone?.(result)
    this.#emit({ kind: 'fastForwardDone', ...result })
    this.#backlog = 0
    this.#emitView()
  }
}
