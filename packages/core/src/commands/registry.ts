import type { PhaseContext } from '../phases/index'
import type { GameState } from '../state/types'
import { fail, ok, type Command, type CommandResult, type CommandType } from './types'

/**
 * One handler per command type. Validation and application share the same check
 * function on purpose: the interface greys out an action for exactly the reason the
 * core would reject it, and there is no second copy of the rules to drift apart
 * (design D4).
 *
 * Handlers are registered by the task that owns the mechanic — BUILD in T-M3-04,
 * MOVE_ARMY in T-M4-02, and so on. An unregistered command is rejected rather than
 * silently ignored.
 */
export interface CommandHandler<C extends Command = Command> {
  /** Pure check. Never mutates. Used by the interface for tooltips and disabled states. */
  check: (state: GameState, command: C, ctx: PhaseContext) => CommandResult
  /** Applies the command. Only ever called after `check` returned ok. */
  apply: (draft: GameState, command: C, ctx: PhaseContext) => void
}

const handlers = new Map<CommandType, CommandHandler>()

export function registerCommand<C extends Command>(
  type: C['type'],
  handler: CommandHandler<C>,
): void {
  handlers.set(type, handler as CommandHandler)
}

export function hasHandler(type: CommandType): boolean {
  return handlers.has(type)
}

/** Checks that hold for every command, before any type-specific rule. */
function commonChecks(state: GameState, command: Command): CommandResult {
  const player = state.players[command.playerId]
  if (!player) return fail('UNKNOWN_PLAYER', { playerId: command.playerId })
  if (!player.alive) return fail('PLAYER_ELIMINATED', { playerId: command.playerId })
  return ok
}

/**
 * Can this command be applied right now? Pure — safe to call from the interface on
 * every render.
 */
export function canApply(state: GameState, command: Command, ctx: PhaseContext): CommandResult {
  const common = commonChecks(state, command)
  if (!common.ok) return common

  const handler = handlers.get(command.type)
  if (!handler) return fail('UNKNOWN_COMMAND', { type: command.type })

  return handler.check(state, command, ctx)
}

/**
 * Applies a command to the draft. Returns the same result `canApply` would give;
 * on failure the draft is left untouched (R-ARCH-02/AK1).
 */
export function applyCommand(draft: GameState, command: Command, ctx: PhaseContext): CommandResult {
  const verdict = canApply(draft, command, ctx)
  if (!verdict.ok) return verdict

  handlers.get(command.type)!.apply(draft, command, ctx)
  return ok
}

/** Test seam: drops all registrations. Never called by the game itself. */
export function resetCommandRegistry(): void {
  handlers.clear()
}
