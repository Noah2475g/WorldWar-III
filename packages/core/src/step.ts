import type { Command } from './commands/types'
import type { GameEvent } from './events/types'
import { applyCommands } from './phases/applyCommands'
import { bookkeeping } from './phases/bookkeeping'
import { combat } from './phases/combat'
import { construction } from './phases/construction'
import { dailyTick } from './phases/dailyTick'
import { diplomacy } from './phases/diplomacy'
import { movement } from './phases/movement'
import { occupation } from './phases/occupation'
import { production } from './phases/production'
import { recruitment } from './phases/recruitment'
import { regeneration } from './phases/regeneration'
import { retreat } from './phases/retreat'
import { upkeep } from './phases/upkeep'
import { PHASE_ORDER, type Phase, type PhaseContext, type PhaseName } from './phases/index'
import type { Rules } from './rules/types'
import type { GameState, MapData } from './state/types'

export { PHASE_ORDER } from './phases/index'
export type { PhaseName } from './phases/index'

const PHASES: Record<(typeof PHASE_ORDER)[number], Phase> = {
  applyCommands,
  production,
  upkeep,
  construction,
  recruitment,
  retreat,
  movement,
  combat,
  occupation,
  regeneration,
  diplomacy,
  bookkeeping,
}

export interface StepContext {
  map: MapData
  rules: Rules
}

export interface StepOptions {
  /** Observation hook for tests and the debug view. Must not modify the state. */
  onPhase?: (phase: PhaseName, draft: GameState) => void
}

export interface StepResult {
  state: GameState
  /** This tick's events, separate from the state's ring buffer. */
  events: GameEvent[]
}

/**
 * Advance the simulation by exactly one game hour (R-TIME-01).
 *
 * `step` is pure from the outside: the incoming state is never touched. Inside it
 * works on its own mutable draft, because copying a 200-province world through an
 * immutable library on every tick would cost more than the simulation itself
 * (design D5). Purity is proven by a hash test, not bought with an abstraction.
 *
 * Rules and map arrive as context and are deliberately not part of the state: they
 * are the same for everyone all match long, and hashing them would tie the golden
 * master to balancing data (design D2).
 */
export function step(
  state: GameState,
  commands: readonly Command[],
  ctx: StepContext,
  options: StepOptions = {},
): StepResult {
  // TODO(T-M8-03): replace with copy-on-write once the tick budget demands it.
  const draft = structuredClone(state) as GameState
  const events: GameEvent[] = []

  const phaseCtx: PhaseContext = {
    map: ctx.map,
    rules: ctx.rules,
    commands,
    events,
  }

  for (const name of PHASE_ORDER) {
    PHASES[name](draft, phaseCtx)
    options.onPhase?.(name, draft)
  }

  // The day settles after bookkeeping has advanced the clock, so tick 24 closes day 1.
  if (draft.tick % ctx.rules.constants.ticksPerDay === 0) {
    dailyTick(draft, phaseCtx)
    options.onPhase?.('dailyTick', draft)
  }

  return { state: draft, events }
}
