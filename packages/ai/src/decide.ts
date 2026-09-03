import type { AiMemory, Command, DifficultyRule, MapData, PublicView, Rules } from '@worldwar/core'
import { diplomacyCommands } from './diplomacy'
import { economyCommands, recruitCommands, tradeCommands } from './economy'
import { militaryCommands } from './military'
import type { AiContext, AiDecision, Explanation } from './types'

/**
 * One AI turn (R-AI-01/05, design D8).
 *
 * Three tiers at different rates: strategy once a day, operations every six hours,
 * tactics every hour. The rates come from the memory, not from a clock — the same
 * sequence of ticks always produces the same decisions (R-ARCH-01).
 */

export const STRATEGIC_INTERVAL = 24
export const OPERATIONAL_INTERVAL = 6

export function emptyMemory(buildShare: number): AiMemory {
  return {
    lastStrategicTick: -1,
    lastOperationalTick: -1,
    targetPriority: {},
    assignments: {},
    buildShare,
  }
}

export interface DecideOptions {
  view: PublicView
  memory: AiMemory
  rules: Rules
  map: MapData
  difficulty: DifficultyRule
  /** Collect reasons for the debug view (R-AI-05). Off by default: it costs time. */
  explain?: boolean
}

export function decide(options: DecideOptions): AiDecision {
  const memory: AiMemory = {
    ...options.memory,
    targetPriority: { ...options.memory.targetPriority },
    assignments: { ...options.memory.assignments },
  }

  const context: AiContext = {
    view: options.view,
    memory,
    rules: options.rules,
    map: options.map,
    difficulty: options.difficulty,
  }

  const explanations: Explanation[] = []
  const commands: Command[] = []
  const tick = options.view.tick

  // Strategy: what to build and whom to fight. Once a game day.
  if (memory.lastStrategicTick < 0 || tick - memory.lastStrategicTick >= STRATEGIC_INTERVAL) {
    memory.lastStrategicTick = tick
    commands.push(...diplomacyCommands(context, explanations))
    commands.push(...economyCommands(context, explanations))
  }

  // Operations: raising troops and covering shortages. Every six hours.
  if (memory.lastOperationalTick < 0 || tick - memory.lastOperationalTick >= OPERATIONAL_INTERVAL) {
    memory.lastOperationalTick = tick
    commands.push(...tradeCommands(context, explanations))
    commands.push(...recruitCommands(context, explanations))
  }

  // Tactics: where the armies go. How often depends on the difficulty — reaction
  // speed is what separates a cautious opponent from a relentless one.
  const interval = Math.max(1, options.difficulty.tacticalInterval)
  if (memory.lastTacticalTick === undefined || tick - memory.lastTacticalTick >= interval) {
    memory.lastTacticalTick = tick
    commands.push(...militaryCommands(context, explanations))
  }

  return {
    commands,
    memory,
    explanations: options.explain ? explanations : [],
  }
}

/**
 * Round-robin over the AI players.
 *
 * Which player thinks in which tick is decided by a counter, never by measured time:
 * a decision that depends on how fast the machine is would break determinism outright
 * (the review's finding on the original budget rule).
 */
export function shouldThinkThisTick(tick: number, playerIndex: number, aiCount: number): boolean {
  if (aiCount <= 1) return true
  return tick % aiCount === playerIndex % aiCount
}
