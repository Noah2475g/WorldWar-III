import {
  publicView,
  type Command,
  type GameState,
  type MapData,
  type PlayerId,
  type Rules,
} from '@worldwar/core'
import { decide, emptyMemory, shouldThinkThisTick } from './decide'
import type { Explanation } from './types'

/**
 * Wires the AI into the simulation loop.
 *
 * This is the only place that touches the full game state, and all it does with it is
 * build a `publicView` per AI player. The decision functions themselves never see
 * anything a human could not (R-AI-01).
 */

export interface AiRunnerResult {
  commands: Command[]
  /** Memories to write back into the state after the tick. */
  memories: Record<PlayerId, ReturnType<typeof emptyMemory>>
  explanations: Record<PlayerId, Explanation[]>
}

export function runAi(
  state: GameState,
  ctx: { map: MapData; rules: Rules },
  options: { explain?: boolean } = {},
): AiRunnerResult {
  const aiPlayers = state.playerOrder.filter(
    (id) => state.players[id]!.kind === 'ai' && state.players[id]!.alive,
  )

  const commands: Command[] = []
  const memories: AiRunnerResult['memories'] = {}
  const explanations: AiRunnerResult['explanations'] = {}

  aiPlayers.forEach((playerId, index) => {
    memories[playerId] = state.ai[playerId] ?? emptyMemory(ctx.rules.ai.buildShareDefault)
    if (!shouldThinkThisTick(state.tick, index, aiPlayers.length)) return

    const player = state.players[playerId]!
    const difficulty = ctx.rules.ai.difficulties[player.difficulty ?? 'normal']

    const decision = decide({
      view: publicView(state, playerId),
      memory: memories[playerId]!,
      rules: ctx.rules,
      map: ctx.map,
      difficulty,
      ...(options.explain ? { explain: true } : {}),
    })

    commands.push(...decision.commands)
    memories[playerId] = decision.memory
    if (options.explain) explanations[playerId] = decision.explanations
  })

  return { commands, memories, explanations }
}

/** Applies the memories the AI produced. Called after the tick that used them. */
export function storeMemories(state: GameState, memories: AiRunnerResult['memories']): void {
  for (const [playerId, memory] of Object.entries(memories)) {
    state.ai[playerId] = memory
  }
}
