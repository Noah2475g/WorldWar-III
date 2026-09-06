import type { Fixed } from '@worldwar/shared'
import type { GameEvent } from '../events/types'
import type {
  ArmyId,
  BuildingKey,
  OrderId,
  PlayerId,
  ProvinceId,
  ResourceKey,
  Stance,
} from '../state/types'

/**
 * Every player action is a serialisable command (R-ARCH-02, design D4).
 *
 * The same union is used by humans and by the AI, and both go through the same
 * validation — that is what makes R-AI-01 ("the AI can do nothing a player cannot")
 * structural rather than a promise (design D-10).
 */

export interface BuildCommand {
  type: 'BUILD'
  playerId: PlayerId
  provinceId: ProvinceId
  building: BuildingKey
}

export interface CancelBuildCommand {
  type: 'CANCEL_BUILD'
  playerId: PlayerId
  provinceId: ProvinceId
  orderId: OrderId
}

export interface RecruitCommand {
  type: 'RECRUIT'
  playerId: PlayerId
  provinceId: ProvinceId
  unitKey: string
  count: number
}

export interface MoveArmyCommand {
  type: 'MOVE_ARMY'
  playerId: PlayerId
  armyId: ArmyId
  targetProvinceId: ProvinceId
}

export interface StopArmyCommand {
  type: 'STOP_ARMY'
  playerId: PlayerId
  armyId: ArmyId
}

export interface SplitArmyCommand {
  type: 'SPLIT_ARMY'
  playerId: PlayerId
  armyId: ArmyId
  take: { unitKey: string; hpTotal: Fixed }[]
}

export interface MergeArmiesCommand {
  type: 'MERGE_ARMIES'
  playerId: PlayerId
  armyIds: ArmyId[]
}

export interface SetStanceCommand {
  type: 'SET_STANCE'
  playerId: PlayerId
  armyId: ArmyId
  stance: Stance
}

/**
 * Feuerleitung (R-BAT-08, T-M15-07).
 *
 * „Feuer halten" ist die **Ausnahme**: eine stehende Fernwaffenarmee schießt von selbst,
 * solange nichts anderes befohlen ist. Andersherum — Feuer erst auf Befehl — wäre der
 * Normalfall eine stumme Batterie an der Front gewesen, und niemand hätte den Unterschied
 * bemerkt. Für Mensch und KI dieselbe Regel.
 */
export interface SetHoldFireCommand {
  type: 'SET_HOLD_FIRE'
  playerId: PlayerId
  armyId: ArmyId
  holdFire: boolean
}

export interface BombardCommand {
  type: 'BOMBARD'
  playerId: PlayerId
  armyId: ArmyId
  targetProvinceId: ProvinceId
}

export interface TradeCommand {
  type: 'TRADE'
  playerId: PlayerId
  give: ResourceKey
  giveAmount: Fixed
  want: ResourceKey
}

export type DiplomacyAction =
  | 'declareWar'
  | 'offerPeace'
  | 'acceptPeace'
  | 'offerAlliance'
  | 'acceptAlliance'
  | 'breakAlliance'
  | 'grantRightOfWay'
  | 'shareMap'

export interface DiplomacyCommand {
  type: 'DIPLOMACY'
  playerId: PlayerId
  targetPlayerId: PlayerId
  action: DiplomacyAction
}

export interface SetCapitalCommand {
  type: 'SET_CAPITAL'
  playerId: PlayerId
  provinceId: ProvinceId
}

export type Command =
  | BuildCommand
  | CancelBuildCommand
  | RecruitCommand
  | MoveArmyCommand
  | StopArmyCommand
  | SplitArmyCommand
  | MergeArmiesCommand
  | SetStanceCommand
  | SetHoldFireCommand
  | BombardCommand
  | TradeCommand
  | DiplomacyCommand
  | SetCapitalCommand

export type CommandType = Command['type']

export type CommandError =
  | 'UNKNOWN_PLAYER'
  | 'PLAYER_ELIMINATED'
  | 'UNKNOWN_COMMAND'
  | 'NOT_OWNER'
  | 'INSUFFICIENT_RESOURCES'
  | 'MISSING_BUILDING'
  | 'BUILDING_MAX_LEVEL'
  | 'NO_PATH'
  | 'ARMY_BUSY'
  | 'ARMY_NOT_FOUND'
  | 'PROVINCE_NOT_FOUND'
  | 'AT_WAR_REQUIRED'
  | 'OUT_OF_RANGE'
  | 'QUEUE_FULL'
  | 'INVALID_TARGET'
  | 'ON_COOLDOWN'
  /** Its first game day has not come yet (R-TECH-01). `detail.availableFromDay` says which. */
  | 'NOT_YET_AVAILABLE'

export type CommandResult =
  | { ok: true }
  | { ok: false; code: CommandError; detail?: Record<string, string | number> }

export const ok: CommandResult = { ok: true }

export function fail(
  code: CommandError,
  detail?: Record<string, string | number>,
): CommandResult {
  return detail ? { ok: false, code, detail } : { ok: false, code }
}

/** Shared shape for the events a successful command produces. */
export type CommandEvents = GameEvent[]
