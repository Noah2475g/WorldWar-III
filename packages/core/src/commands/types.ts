import type { PlayerId } from '../state/types'

/**
 * Every player action is a serialisable command (R-ARCH-02). The union is completed
 * in T-M1-07; this is the shape the pipeline needs to carry them around.
 */
export interface CommandBase {
  playerId: PlayerId
}

export type Command = CommandBase & { type: string }
