import type { Command, CommandError, GameState, ResourceKey, Rules } from '@worldwar/core'
import { t } from '../i18n/text.ts'
import { amount, missing } from '../ui/format.ts'

/**
 * A refusal, in words the player can act on (T-M10-08, R-UI-05, R-UI-07).
 *
 * The core says *what* went wrong with a code and a few raw fields — a building key,
 * a unit key, a tick. The sentence the player reads must carry names and numbers:
 * "Es fehlt an Rohstoffen: 333 Material" rather than "INSUFFICIENT_RESOURCES
 * barracks". The core cannot know what is missing in the player's terms; this does.
 */

export interface RejectionContext {
  state: GameState
  rules: Rules
  playerId: string
  ticksPerDay: number
}

export interface Rejection {
  code: CommandError
  detail?: Record<string, string | number> | undefined
}

/** The resources an order would consume, so the shortfall can be named. */
function costOf(command: Command | null, rules: Rules): Partial<Record<string, number>> {
  if (!command) return {}
  switch (command.type) {
    case 'BUILD':
      return rules.buildings[command.building]?.cost ?? {}
    case 'RECRUIT': {
      const unit = rules.units[command.unitKey]
      if (!unit) return {}
      return Object.fromEntries(
        Object.entries(unit.cost).map(([key, value]) => [key, (value ?? 0) * command.count]),
      )
    }
    case 'TRADE':
      return { [command.give]: command.giveAmount }
    default:
      return {}
  }
}

export function describeRejection(rejection: Rejection, command: Command | null, ctx: RejectionContext): string {
  const detail = rejection.detail ?? {}
  const values: Record<string, string | number> = { ...detail }

  const buildingKey = detail.required ?? detail.building
  if (typeof buildingKey === 'string') {
    // Die Stufe gehoert in den Satz, nicht nur ins Detail (T-M34-05): seit Zerstoerer
    // Werft 2 und Raketenartillerie Fabrik 3 verlangen, ist "Dafuer fehlt das Gebaeude:
    // Werft" an einer Provinz MIT Werft eine Auskunft, die dem Spieler widerspricht.
    // Stufe 1 bleibt ungenannt — sie ist der Normalfall und waere Rauschen.
    const level = typeof detail.level === 'number' ? detail.level : 1
    values.building =
      level > 1
        ? `${t(`buildings.${buildingKey}`)} ${t('actions.buildLevel', { level })}`
        : t(`buildings.${buildingKey}`)
  }
  if (typeof detail.unitKey === 'string') values.unit = t(`units.${detail.unitKey}`)
  if (typeof detail.resource === 'string') values.resource = t(`resources.${detail.resource}`)

  switch (rejection.code) {
    case 'INSUFFICIENT_RESOURCES': {
      const player = ctx.state.players[ctx.playerId]
      const available = (player?.resources ?? {}) as Partial<Record<string, number>>
      const short = missing(costOf(command, ctx.rules), available)
      values.missing = short || (typeof detail.resource === 'string' ? t(`resources.${detail.resource}`) : t('resources.money'))
      break
    }
    case 'ON_COOLDOWN': {
      if (typeof detail.readyAtTick !== 'number') return t('diplomacy.truceBlocks')
      values.days = Math.max(1, Math.ceil((detail.readyAtTick - ctx.state.tick) / ctx.ticksPerDay))
      break
    }
    case 'INVALID_TARGET':
      if (typeof detail.reason === 'string') {
        return t('actions.reasonDetail', { text: t('errors.INVALID_TARGET'), reason: detail.reason })
      }
      break
    default:
      break
  }

  return t(`errors.${rejection.code}`, values)
}

/** The player's stock, for hints that compare a price with what is in the treasury. */
export function treasuryOf(ctx: RejectionContext): Partial<Record<ResourceKey, number>> {
  return ctx.state.players[ctx.playerId]?.resources ?? {}
}

/** Formats a fixed-point quantity for a sentence — re-exported so callers need one import. */
export { amount }
