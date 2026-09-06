import { emit } from '../events/emit'
import { applyCommand } from '../commands/registry'
import type { Phase } from './index'

/**
 * Applies this tick's commands (design D3, phase 1).
 *
 * Commands are processed in player order, and a rejected command changes nothing but
 * produces a COMMAND_REJECTED event: the player must learn *why* an order did not
 * happen. Silent failure is the one outcome a strategy game cannot afford
 * (R-ARCH-02/AK1).
 */
export const applyCommands: Phase = (draft, ctx) => {
  const order = new Map(draft.playerOrder.map((id, index) => [id, index]))

  const sorted = [...ctx.commands].sort((a, b) => {
    const byPlayer = (order.get(a.playerId) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.playerId) ?? Number.MAX_SAFE_INTEGER)
    return byPlayer
  })

  for (const command of sorted) {
    const result = applyCommand(draft, command, ctx)
    if (!result.ok) {
      emit(ctx.events, draft.tick, 'COMMAND_REJECTED', {
        playerId: command.playerId,
        command: command.type,
        code: result.code,
        // Der Grund kam bis zum 2026-09-06 nie hier an, obwohl der Kern ihn kennt.
        // `INVALID_TARGET` steht für drei verschiedene Fehler, und einer davon —
        // "bereits dort" — hat sich dahinter einen ganzen Meilenstein lang versteckt:
        // 762 von 807 Ablehnungen einer Turnierpartie (T-M15-05).
        ...(result.detail ? { detail: result.detail } : {}),
        audience: [command.playerId],
      })
    }
  }
}
