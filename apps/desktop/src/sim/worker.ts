import type { SimEngine } from './SimEngine'
import type { SimRequest } from './protocol'

/**
 * The worker shell (T-M10-02, design D-03).
 *
 * Deliberately thin: it turns messages into calls and drives the clock. Everything
 * worth testing lives in SimEngine, which needs neither a worker nor a browser — this
 * file is the part that cannot be tested without one, so there is as little of it as
 * possible.
 */

export interface WorkerRuntime {
  /** Real elapsed milliseconds since the previous call. */
  now(): number
  /** Schedules the next slice; a browser worker uses setInterval. */
  every(intervalMs: number, run: () => void): () => void
}

/** How often the worker wakes up in interactive mode: one display frame. */
export const SLICE_MS = 16

export function attach(engine: SimEngine, runtime: WorkerRuntime): {
  handle: (request: SimRequest) => void
  stop: () => void
} {
  let lastAt = runtime.now()

  const stop = runtime.every(SLICE_MS, () => {
    // While fast-forwarding the slice belongs to it entirely: no interactive ticks, no
    // picture. Returning between batches is what lets an incoming stop message land.
    if (engine.fastForwarding) {
      engine.continueFastForward()
      lastAt = runtime.now()
      return
    }
    const at = runtime.now()
    const elapsed = at - lastAt
    lastAt = at
    engine.advance(elapsed)
  })

  const handle = (request: SimRequest): void => {
    switch (request.kind) {
      case 'setSpeed':
        engine.setSpeed(request.hoursPerSecond)
        break
      case 'command':
        engine.enqueue(request.command)
        break
      case 'fastForward':
        engine.startFastForward(request.target)
        break
      case 'abortFastForward':
        engine.abortFastForward()
        break
      case 'requestView':
        engine.sendView()
        break
    }
  }

  return { handle, stop }
}
