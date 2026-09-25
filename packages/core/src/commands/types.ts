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
  TradeBundle,
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
  /**
   * Optional: hold the army in place for this many ticks before the march begins
   * (T-M32-01). Absent or `0` is the old behaviour to the tick — the field is purely
   * additive, so command logs recorded before it exist replay unchanged.
   */
  departInTicks?: number
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
  // Durchmarsch erbitten, annehmen, kuendigen (T-M17-04, R-DIP-08). Die KI gibt sie ab
  // T-M17-10, die Oberflaeche erreicht sie in T-M17-14.
  | 'requestRightOfWay'
  | 'acceptRightOfWay'
  | 'revokeRightOfWay'

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

/**
 * Handelsangebote mit Treuhand (T-M17-05, R-DIP-05, D29.2).
 *
 * `give.resources` wandert beim Angebot aus dem Bestand in die Treuhand; `want` wird erst bei
 * der Annahme gezahlt. `provinces` gehoert dem Provinzhandel (T-M17-06) und muss bis dahin leer
 * sein. Die Oberflaeche erreicht die vier Befehle in T-M17-14.
 */
export interface OfferTradeCommand {
  type: 'OFFER_TRADE'
  playerId: PlayerId
  targetPlayerId: PlayerId
  give: TradeBundle
  want: TradeBundle
}

/** Nur der Empfaenger (`to`) nimmt an; beide Seiten tauschen im selben Tick. */
export interface AcceptTradeCommand {
  type: 'ACCEPT_TRADE'
  playerId: PlayerId
  offerId: string
}

/** Nur der Empfaenger lehnt ab; die Treuhand geht an den Anbieter zurueck. */
export interface DeclineTradeCommand {
  type: 'DECLINE_TRADE'
  playerId: PlayerId
  offerId: string
}

/** Nur der Anbieter zieht zurueck; die Treuhand geht an ihn zurueck. */
export interface WithdrawTradeCommand {
  type: 'WITHDRAW_TRADE'
  playerId: PlayerId
  offerId: string
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
  | OfferTradeCommand
  | AcceptTradeCommand
  | DeclineTradeCommand
  | WithdrawTradeCommand

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
