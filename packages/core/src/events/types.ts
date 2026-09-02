import type { Fixed } from '@worldwar/shared'
import type {
  ArmyId,
  BuildingKey,
  BattleId,
  PlayerId,
  ProvinceId,
  ResourceKey,
  Tick,
} from '../state/types'

/**
 * Events are the game's output stream (design D-07): they feed the log, the interface,
 * the battle reports and the AI explanation view. They are deliberately excluded from
 * the state hash, so rewording a message never looks like a rule change.
 *
 * `severity: 'alert'` is load-bearing, not decoration: fast-forward stops at the first
 * alert (R-TIME-03/AK1). An event that the player must see before time moves on is an
 * alert; everything else is info and may be bundled into a daily digest at high speed.
 */

export type EventSeverity = 'info' | 'alert'

export interface BaseEvent {
  tick: Tick
  severity: EventSeverity
  /** Who may see this. Empty means everyone. */
  audience: PlayerId[]
}

export interface GameStartedEvent extends BaseEvent {
  type: 'GAME_STARTED'
  mapId: string
  playerCount: number
}

export interface CommandRejectedEvent extends BaseEvent {
  type: 'COMMAND_REJECTED'
  playerId: PlayerId
  command: string
  code: string
  provinceId?: ProvinceId
}

export interface BuildStartedEvent extends BaseEvent {
  type: 'BUILD_STARTED'
  playerId: PlayerId
  provinceId: ProvinceId
  building: BuildingKey
  level: number
  completesAtTick: Tick
}

export interface BuildCompletedEvent extends BaseEvent {
  type: 'BUILD_COMPLETED'
  playerId: PlayerId
  provinceId: ProvinceId
  building: BuildingKey
  level: number
}

export interface BuildCancelledEvent extends BaseEvent {
  type: 'BUILD_CANCELLED'
  playerId: PlayerId
  provinceId: ProvinceId
  building: BuildingKey
  reason: 'byPlayer' | 'ownerChanged'
}

export interface UnitRecruitedEvent extends BaseEvent {
  type: 'UNIT_RECRUITED'
  playerId: PlayerId
  provinceId: ProvinceId
  unitKey: string
  count: number
  armyId: ArmyId
}

export interface ArmyDepartedEvent extends BaseEvent {
  type: 'ARMY_DEPARTED'
  playerId: PlayerId
  armyId: ArmyId
  fromProvinceId: ProvinceId
  toProvinceId: ProvinceId
  arrivalTick: Tick
}

export interface ArmyArrivedEvent extends BaseEvent {
  type: 'ARMY_ARRIVED'
  playerId: PlayerId
  armyId: ArmyId
  provinceId: ProvinceId
}

export interface ArmyDestroyedEvent extends BaseEvent {
  type: 'ARMY_DESTROYED'
  playerId: PlayerId
  armyId: ArmyId
  provinceId: ProvinceId
}

export interface ArmyRetreatedEvent extends BaseEvent {
  type: 'ARMY_RETREATED'
  playerId: PlayerId
  armyId: ArmyId
  fromProvinceId: ProvinceId
  toProvinceId: ProvinceId
  hpLost: Fixed
}

export interface BattleStartedEvent extends BaseEvent {
  type: 'BATTLE_STARTED'
  battleId: BattleId
  provinceId: ProvinceId
  sides: PlayerId[][]
}

export interface BattleResolvedEvent extends BaseEvent {
  type: 'BATTLE_RESOLVED'
  battleId: BattleId
  provinceId: ProvinceId
  /** Losses in hit points per player — the basis of the battle report (R-BAT-07). */
  losses: Record<PlayerId, Fixed>
  victor: PlayerId | null
}

export interface BombardmentEvent extends BaseEvent {
  type: 'BOMBARDMENT'
  playerId: PlayerId
  armyId: ArmyId
  targetProvinceId: ProvinceId
  damage: Fixed
}

export interface ProvinceCapturedEvent extends BaseEvent {
  type: 'PROVINCE_CAPTURED'
  provinceId: ProvinceId
  previousOwner: PlayerId | null
  newOwner: PlayerId
}

export interface ProvinceRevoltedEvent extends BaseEvent {
  type: 'PROVINCE_REVOLTED'
  provinceId: ProvinceId
  previousOwner: PlayerId
  morale: Fixed
}

export interface ResourceShortageEvent extends BaseEvent {
  type: 'RESOURCE_SHORTAGE'
  playerId: PlayerId
  resource: ResourceKey
}

export interface StorageOverflowEvent extends BaseEvent {
  type: 'STORAGE_OVERFLOW'
  playerId: PlayerId
  resource: ResourceKey
  wasted: Fixed
}

export interface TradeExecutedEvent extends BaseEvent {
  type: 'TRADE_EXECUTED'
  playerId: PlayerId
  give: ResourceKey
  giveAmount: Fixed
  want: ResourceKey
  wantAmount: Fixed
}

export interface WarDeclaredEvent extends BaseEvent {
  type: 'WAR_DECLARED'
  playerId: PlayerId
  targetPlayerId: PlayerId
  effectiveAtTick: Tick
  withoutDeclaration: boolean
}

export interface DiplomacyChangedEvent extends BaseEvent {
  type: 'DIPLOMACY_CHANGED'
  playerId: PlayerId
  targetPlayerId: PlayerId
  newState: 'peace' | 'war' | 'truce' | 'alliance'
}

export interface CapitalLostEvent extends BaseEvent {
  type: 'CAPITAL_LOST'
  playerId: PlayerId
  provinceId: ProvinceId
  penaltyUntilTick: Tick
}

export interface CapitalMovedEvent extends BaseEvent {
  type: 'CAPITAL_MOVED'
  playerId: PlayerId
  provinceId: ProvinceId
}

export interface PlayerEliminatedEvent extends BaseEvent {
  type: 'PLAYER_ELIMINATED'
  playerId: PlayerId
}

export interface GameEndedEvent extends BaseEvent {
  type: 'GAME_ENDED'
  winner: PlayerId | null
  condition: 'points' | 'conquest' | 'time'
}

export interface DayReportEvent extends BaseEvent {
  type: 'DAY_REPORT'
  day: number
  scores: Record<PlayerId, number>
}

export type GameEvent =
  | GameStartedEvent
  | CommandRejectedEvent
  | BuildStartedEvent
  | BuildCompletedEvent
  | BuildCancelledEvent
  | UnitRecruitedEvent
  | ArmyDepartedEvent
  | ArmyArrivedEvent
  | ArmyDestroyedEvent
  | ArmyRetreatedEvent
  | BattleStartedEvent
  | BattleResolvedEvent
  | BombardmentEvent
  | ProvinceCapturedEvent
  | ProvinceRevoltedEvent
  | ResourceShortageEvent
  | StorageOverflowEvent
  | TradeExecutedEvent
  | WarDeclaredEvent
  | DiplomacyChangedEvent
  | CapitalLostEvent
  | CapitalMovedEvent
  | PlayerEliminatedEvent
  | GameEndedEvent
  | DayReportEvent

export type EventType = GameEvent['type']

/** Every event type, as data. Kept in sync with the union by a compile-time check below. */
export const EVENT_TYPES = [
  'GAME_STARTED',
  'COMMAND_REJECTED',
  'BUILD_STARTED',
  'BUILD_COMPLETED',
  'BUILD_CANCELLED',
  'UNIT_RECRUITED',
  'ARMY_DEPARTED',
  'ARMY_ARRIVED',
  'ARMY_DESTROYED',
  'ARMY_RETREATED',
  'BATTLE_STARTED',
  'BATTLE_RESOLVED',
  'BOMBARDMENT',
  'PROVINCE_CAPTURED',
  'PROVINCE_REVOLTED',
  'RESOURCE_SHORTAGE',
  'STORAGE_OVERFLOW',
  'TRADE_EXECUTED',
  'WAR_DECLARED',
  'DIPLOMACY_CHANGED',
  'CAPITAL_LOST',
  'CAPITAL_MOVED',
  'PLAYER_ELIMINATED',
  'GAME_ENDED',
  'DAY_REPORT',
] as const satisfies readonly EventType[]

// If the union grows and this list does not, the next line stops compiling.
type MissingFromList = Exclude<EventType, (typeof EVENT_TYPES)[number]>
const _exhaustive: MissingFromList extends never ? true : false = true
void _exhaustive

/**
 * Events that must interrupt fast-forward (R-TIME-03/AK1). Losing a province while
 * skipping three game days would be the single worst thing this game could do.
 */
export const ALERT_TYPES = [
  'ARMY_DESTROYED',
  'BATTLE_STARTED',
  'PROVINCE_CAPTURED',
  'PROVINCE_REVOLTED',
  'WAR_DECLARED',
  'CAPITAL_LOST',
  'PLAYER_ELIMINATED',
  'GAME_ENDED',
] as const satisfies readonly EventType[]

export function isAlertType(type: EventType): boolean {
  return (ALERT_TYPES as readonly EventType[]).includes(type)
}
