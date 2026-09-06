import type { Command } from '../commands/types'
import type { GameEvent } from '../events/types'
import type { Rules } from '../rules/types'
import type { GameState, MapData } from '../state/types'

/**
 * A phase is one step of the tick pipeline (design D3). Phases mutate the draft in
 * place — `step()` owns the copy, phases only ever see a state that is already theirs
 * to change. Anything a phase wants to tell the world goes into `ctx.events`.
 */
export interface PhaseContext {
  map: MapData
  rules: Rules
  /** Commands addressed to this tick, in player order. */
  commands: readonly Command[]
  /** Events produced during this tick; appended to the log in bookkeeping. */
  events: GameEvent[]
}

export type Phase = (draft: GameState, ctx: PhaseContext) => void

/**
 * Twelve real phases, in the order fixed by design D3. The order is load-bearing:
 * retreats resolve before movement, movement before combat, combat before occupation.
 * The AI is deliberately not a phase — it produces commands before the tick starts.
 */
export const PHASE_ORDER = [
  'applyCommands',
  'production',
  'upkeep',
  'construction',
  'recruitment',
  'retreat',
  'movement',
  'bombardment',
  'combat',
  'occupation',
  'regeneration',
  'diplomacy',
  'bookkeeping',
] as const

export type PhaseName = (typeof PHASE_ORDER)[number] | 'dailyTick'
