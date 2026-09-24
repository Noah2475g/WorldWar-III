import type { Fixed } from '@worldwar/shared'
import type {
  ArmyId,
  BuildingKey,
  BattleId,
  GoalKey,
  PlayerId,
  ProvinceId,
  ResourceKey,
  Spy,
  SpyId,
  SpyMission,
  Terrain,
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
  /**
   * Whom it is *about* (T-M15-01, R-TIME-06).
   *
   * Three different questions used to share two fields: who may read it (`audience`),
   * whether it must be seen before time moves on (`severity`) and — this one — whom it
   * actually concerns. Without the third, `firstAlertFor` stopped every player's
   * fast-forward at every public alert: a capture between two foreign powers halted an
   * uninvolved bystander, and nobody could skip three game days on the world map.
   *
   * Mandatory, not optional. An optional field would have saved the migration and
   * repeated exactly the mistake R-TECH-01/AK3 names: a missing value would silently
   * mean "concerns nobody", and the guard would be green over an absence. `emit()`
   * defaults it to `audience`, so a private event is right without thinking about it and
   * a **public alert has to name its parties** — which is the case that was wrong.
   */
  concerns: PlayerId[]
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
  /**
   * Der Grund, den der Kern bereits kennt (T-M15-05).
   *
   * Die Ablehnung trug ihn seit jeher in `CommandResult.detail` — und das Ereignis liess
   * ihn fallen. Ein Protokoll, das "MOVE_ARMY abgelehnt: INVALID_TARGET" sagt, nennt drei
   * verschiedene Fehler mit demselben Wort (leere Armee, bereits dort, kein Flugplatz),
   * und der teuerste davon hat sich dahinter einen ganzen Meilenstein lang versteckt.
   */
  detail?: Record<string, string | number>
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

/**
 * Eine kriegführende fremde Armee hat eine Provinz betreten, die mir gehört
 * (T-M28-06, R-TIME-06).
 *
 * `ARMY_ARRIVED` konnte das nie tragen: es geht an den Marschierenden, und für den
 * Bestohlenen gab es bis hierher überhaupt kein Ereignis — der Einmarsch war nur als
 * Marker auf der Karte sichtbar, und beim Vorspulen gar nicht. Eigenes Ereignis statt
 * erweitertem `ARMY_ARRIVED`, weil beide verschiedene Sätze sagen und verschiedene
 * Leser haben.
 */
export interface ArmyIntrudedEvent extends BaseEvent {
  type: 'ARMY_INTRUDED'
  /** Der Besitzer der Provinz — der, den es angeht. */
  playerId: PlayerId
  /** Wer eingedrungen ist. */
  intruderId: PlayerId
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

/** Staerke einer Seite vor und nach dem Schlagabtausch eines Ticks, in Trefferpunkten. */
export interface BattleSideStrength {
  before: Fixed
  after: Fixed
}

export interface BattleResolvedEvent extends BaseEvent {
  type: 'BATTLE_RESOLVED'
  battleId: BattleId
  provinceId: ProvinceId
  /** Losses in hit points per player — the basis of the battle report (R-BAT-07). */
  losses: Record<PlayerId, Fixed>
  victor: PlayerId | null
  /**
   * Was der Kampfbericht zeichnet (T-M27-01, R-BAT-05, D25.6).
   *
   * Der Kern kannte Staerken, Gelaende und Festung seit M4 — das Ereignis nannte nur
   * die Verluste, und die Anzeige haette raten muessen. ADDITIV und deshalb optional:
   * Ereignisse gehen nicht in den Zustands-Hash ein, aber alte Spielstaende tragen
   * BATTLE_RESOLVED ohne diese Felder, und die duerfen weiter laden. Jede neue
   * Erzeugung setzt alle fuenf.
   */
  strengths?: Record<PlayerId, BattleSideStrength>
  /** Das Gelaende gehoert allen — es steht am Ereignis, damit der Bericht es nennt. */
  terrain?: Terrain
  /** Festungsstufe der Provinz (0 = keine); sie schuetzt nur den Eigentuemer. */
  fortressLevel?: number
  /** Seiten, die eingegraben kaempften: Eigentuemer der Provinz, alle Armeen stehend. */
  entrenched?: PlayerId[]
  /** Seiten unter Rueckzugssperre: keine ihrer Armeen durfte in diesem Tick angreifen. */
  attackBlocked?: PlayerId[]
}

export interface BombardmentEvent extends BaseEvent {
  type: 'BOMBARDMENT'
  playerId: PlayerId
  armyId: ArmyId
  targetProvinceId: ProvinceId
  damage: Fixed
  /**
   * Selbsttaetiges Feuer statt eines Befehls (R-BAT-08, T-M15-07).
   *
   * Der Unterschied gehoert ins Ereignis, nicht in die Textbildung: der Spieler soll im
   * Protokoll sehen koennen, welche seiner Batterien von selbst geschossen haben — sonst
   * sieht eine Automatik aus wie ein Befehl, den er nicht erteilt hat.
   */
  automatic: boolean
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

/**
 * Eine Macht hat ein Zwischenziel erreicht (T-M35-04, R-GAME-08/AK2, D31.4).
 *
 * `audience: [playerId]` — ein Zwischenziel ist keine Weltnachricht, und wie weit eine fremde
 * Macht ist, verrät es nicht. Nicht in `ALERT_TYPES`: es ist Rückmeldung, kein Alarm, und hält
 * das Vorspulen nicht an. Genau einmal je Macht und Ziel, weil der Tag im Zustand nie
 * zurückgesetzt wird.
 */
export interface GoalReachedEvent extends BaseEvent {
  type: 'GOAL_REACHED'
  playerId: PlayerId
  goal: GoalKey
  /** Derselbe Spieltag wie in `state.goals` und im Tagesbericht. */
  day: number
}

/**
 * Ein Spion hat seinen Auftrag ausgeführt (R-SPY-02, T-M17-08, D29.5).
 *
 * `audience: [playerId]` — nur der Besitzer. Wer ausgespäht wird, erfährt es nicht; nur ein
 * Gegenspion kann einen fremden Spion enttarnen (R-SPY-05). Und das Ereignis trägt **nichts vom
 * Gesehenen**: was eine Aufklärung zeigt, steht in der Sicht (`publicView`) und im
 * Aufklärungsgedächtnis, nicht im Protokoll — sonst läge fremder Bestand im Ereignisprotokoll
 * und damit im Spielstand. Kein Alarm: ein Bericht hält das Vorspulen nicht an.
 */
export interface SpyReportEvent extends BaseEvent {
  type: 'SPY_REPORT'
  playerId: PlayerId
  spyId: SpyId
  provinceId: ProvinceId
  mission: SpyMission
  /** `targetChanged`: die Provinz hat den Besitzer gewechselt, der Auftrag passt nicht mehr — kein Wurf. */
  outcome: NonNullable<Spy['lastOutcome']>
}

/**
 * Ein Spion ist verloren, weil sein Sold nicht zu zahlen war (R-SPY-02/AK2, T-M17-08, D29.5).
 *
 * Nur für den Besitzer. Ziel und Auftrag stehen dabei, weil die Oberfläche keine Kennungen zeigt
 * (Befund M17-S1) und „Spion s3 verloren" niemandem sagt, welcher es war.
 */
export interface SpyLostEvent extends BaseEvent {
  type: 'SPY_LOST'
  playerId: PlayerId
  spyId: SpyId
  provinceId: ProvinceId
  mission: SpyMission
  reason: 'unpaid'
}

/**
 * Eine Provinz wurde sabotiert (R-SPY-04/AK3, T-M17-09, D29.5).
 *
 * **Ohne Urheber — mit Absicht, und nicht nur in der Anzeige.** `describeEvent` übernimmt jedes flache
 * Feld in die Textwerte (`valuesFor`); ein Feld mit dem Angreifer stünde damit im Protokoll des Opfers,
 * sobald ein Satz es nennt. Das Ereignis kennt deshalb nur, was das Opfer ohnehin sieht: die eigene
 * Provinz und was sie verloren hat. Nur das Opfer liest es, und es ist ein **Alarm** — sein Vorspulen hält
 * an (R-TIME-03), das eines Dritten nicht. Alle drei Wirkungsfelder stehen immer: die Wirtschaftssabotage
 * hat `delayTicks` 0, die Militärsabotage `moraleLoss` 0 und `destroyed` leer.
 */
export interface SabotageSufferedEvent extends BaseEvent {
  type: 'SABOTAGE_SUFFERED'
  /** Das Opfer: der Besitzer der Provinz. */
  playerId: PlayerId
  provinceId: ProvinceId
  kind: 'economic' | 'military'
  /** Tatsächlich abgezogene Moral — bei niedriger Moral weniger als der Regelwert. */
  moraleLoss: Fixed
  /** Je Rohstoff, was vernichtet wurde; nur Einträge über null. */
  destroyed: Partial<Record<ResourceKey, Fixed>>
  /** Um so viele Ticks wird jeder laufende Auftrag der Provinz später fertig. */
  delayTicks: number
}

/**
 * Ein Gegenspion hat einen fremden Spion enttarnt (R-SPY-05/AK1, T-M17-09, D29.5).
 *
 * Beide erfahren es, mit Nennung der Macht: `playerId` ist der **Urheber** (dem der Spion gehörte),
 * `targetPlayerId` der **Entdecker**. **Keine Spionkennung:** der Entdecker läse sonst eine fremde
 * Kennung und könnte aus der fortlaufenden Folge fremde Anwerbungen zählen (Befund M17-S1). Kein Alarm.
 * Der Spion ist damit verloren; ein eigenes `SPY_LOST` gibt es dafür nicht.
 */
export interface SpyDetectedEvent extends BaseEvent {
  type: 'SPY_DETECTED'
  playerId: PlayerId
  targetPlayerId: PlayerId
  provinceId: ProvinceId
  mission: SpyMission
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
  | ArmyIntrudedEvent
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
  | GoalReachedEvent
  | SpyReportEvent
  | SpyLostEvent
  | SabotageSufferedEvent
  | SpyDetectedEvent

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
  'ARMY_INTRUDED',
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
  'GOAL_REACHED',
  'SPY_REPORT',
  'SPY_LOST',
  'SABOTAGE_SUFFERED',
  'SPY_DETECTED',
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
  'ARMY_INTRUDED',
  'BATTLE_STARTED',
  'PROVINCE_CAPTURED',
  'PROVINCE_REVOLTED',
  'WAR_DECLARED',
  'CAPITAL_LOST',
  'PLAYER_ELIMINATED',
  'GAME_ENDED',
  // Erlittene Sabotage (T-M17-09, R-SPY-04/AK3): nur das Opfer liest sie, also hält sie nur dessen Vorspulen an.
  'SABOTAGE_SUFFERED',
] as const satisfies readonly EventType[]

export function isAlertType(type: EventType): boolean {
  return (ALERT_TYPES as readonly EventType[]).includes(type)
}
