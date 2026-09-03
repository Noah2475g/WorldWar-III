import { ONE } from '@worldwar/shared'
import {
  armyHp,
  canApply,
  exchangeAmount,
  planRoute,
  recruitDuration,
  recruitStartCondition,
  type Army,
  type Command,
  type DiplomacyAction,
  type GameState,
  type MapData,
  type ResourceKey,
  type Rules,
  type Stance,
} from '@worldwar/core'
import { t } from '../i18n/text.ts'
import { amount, arrival, costs, duration, unfix } from '../ui/format.ts'
import { BUILDING_ICONS, UNIT_ICONS, type IconName } from '../ui/icons.tsx'
import { describeRejection } from './rejections.ts'

/**
 * Every order the player can give, as data (T-M10-05, T-M10-06, R-UI-05).
 *
 * The interface shows buttons; this decides what they say. One rule for all of them:
 * an order the player cannot give right now is still listed, greyed out, **with the
 * reason** — computed by the same `canApply` the simulation will use, so the reason on
 * the button is the reason the order would be refused. A panel that hides what is not
 * possible leaves the player wondering whether the game has the feature at all.
 *
 * Pure: state, map and rules in, descriptions out. That is what makes "does the panel
 * offer recruitment once the barracks stands" a test instead of a click.
 */

export interface ActionContext {
  state: GameState
  map: MapData
  rules: Rules
  playerId: string
  ticksPerDay: number
}

export interface ActionSpec {
  id: string
  label: string
  /** The symbol of the thing being ordered — a building, an arm of service (R-UI-10). */
  icon?: IconName
  /** What it costs and how long it takes, for the tooltip. */
  hint?: string
  /** Null when the order can be given; otherwise why not. */
  disabledReason: string | null
  /** The order itself. Absent for orders that first need a target on the map. */
  command?: Command
  /** Orders that need a province chosen next: the panel switches to target mode. */
  targetKind?: 'move' | 'bombard'
}

function checked(
  ctx: ActionContext,
  command: Command,
  id: string,
  label: string,
  hint?: string,
  icon?: IconName,
): ActionSpec {
  const result = canApply(ctx.state, command, {
    map: ctx.map,
    rules: ctx.rules,
    commands: [command],
    events: [],
  })
  return {
    id,
    label,
    ...(icon ? { icon } : {}),
    ...(hint ? { hint } : {}),
    disabledReason: result.ok ? null : describeRejection(result, command, ctx),
    command,
  }
}

/** "750 Geld, 400 Eisen · 18 h" — what a button costs, before it is pressed. */
export function costHint(cost: Partial<Record<string, number>>, hours: number, ticksPerDay: number): string {
  return `${costs(cost)} · ${duration(hours, ticksPerDay)}`
}

/** One button per building the rules know, in the order the rules list them. */
export function buildActions(ctx: ActionContext, provinceId: string): ActionSpec[] {
  return Object.entries(ctx.rules.buildings).map(([key, rule]) =>
    checked(
      ctx,
      { type: 'BUILD', playerId: ctx.playerId, provinceId, building: key as never },
      `build-${key}`,
      t(`buildings.${key}`),
      costHint(rule.cost, rule.buildTicks, ctx.ticksPerDay),
      BUILDING_ICONS[key],
    ),
  )
}

/**
 * One button per unit. The hint carries what the core will do with the province's
 * morale: how long the levy takes, and how strong it arrives — a demoralised province
 * raises weak soldiers, and the player should know before paying.
 */
export function recruitActions(ctx: ActionContext, provinceId: string): ActionSpec[] {
  const province = ctx.state.provinces[provinceId]
  const morale = province?.morale ?? ONE
  return Object.entries(ctx.rules.units).map(([key, rule]) => {
    const hours = recruitDuration(rule.buildTicks, morale)
    const condition = recruitStartCondition(morale)
    const strength =
      condition < ONE ? ` · ${t('actions.startStrength', { percent: Math.round(unfix(condition) * 100) })}` : ''
    return checked(
      ctx,
      { type: 'RECRUIT', playerId: ctx.playerId, provinceId, unitKey: key, count: 1 },
      `recruit-${key}`,
      t(`units.${key}`),
      `${costHint(rule.cost, hours, ctx.ticksPerDay)}${strength}`,
      UNIT_ICONS[key],
    )
  })
}

export function capitalAction(ctx: ActionContext, provinceId: string): ActionSpec {
  return checked(ctx, { type: 'SET_CAPITAL', playerId: ctx.playerId, provinceId }, 'set-capital', t('actions.setCapital'))
}

/** The player's own armies standing in a province, for the panel's list. */
export function ownArmiesIn(ctx: ActionContext, provinceId: string): { id: string; name: string; strength: number }[] {
  return ctx.state.armyOrder
    .map((id) => ctx.state.armies[id])
    .filter((army): army is Army => !!army && army.owner === ctx.playerId && army.locationProvinceId === provinceId)
    .map((army) => ({ id: army.id, name: army.name, strength: armyHp(army) }))
}

/** Half of every stack, rounded down — what "Teilen" detaches. */
export function halfOf(army: Army): { unitKey: string; hpTotal: number }[] {
  return (
    army.units
      .map((stack) => ({ unitKey: stack.unitKey, hpTotal: Math.floor(stack.hpTotal / 2) }))
      .filter((stack) => stack.hpTotal > 0)
  )
}

/** Whether any unit in the army can bombard at range (R-BAT-06). */
export function hasRangedUnits(army: Army, rules: Rules): boolean {
  return army.units.some((stack) => (rules.units[stack.unitKey]?.rangeProvinces ?? 0) > 0)
}

export function armyActions(ctx: ActionContext, armyId: string): ActionSpec[] {
  const army = ctx.state.armies[armyId]
  if (!army || army.owner !== ctx.playerId) return []
  const playerId = ctx.playerId

  const march: ActionSpec = {
    id: 'march',
    label: t('army.move'),
    disabledReason: army.units.length === 0 ? t('army.empty') : null,
    targetKind: 'move',
  }

  const stop = checked(ctx, { type: 'STOP_ARMY', playerId, armyId }, 'stop', t('army.stop'))
  if (stop.disabledReason === null && army.path.length === 0) stop.disabledReason = t('army.notMoving')

  const stance = (value: Stance, label: string): ActionSpec => {
    const spec = checked(ctx, { type: 'SET_STANCE', playerId, armyId, stance: value }, `stance-${value}`, label)
    if (spec.disabledReason === null && army.stance === value) spec.disabledReason = t('army.alreadyStance')
    return spec
  }

  const partners = ctx.state.armyOrder.filter((id) => {
    const other = ctx.state.armies[id]
    return !!other && other.owner === playerId && other.locationProvinceId === army.locationProvinceId
  })
  const merge: ActionSpec =
    partners.length < 2
      ? { id: 'merge', label: t('army.merge'), disabledReason: t('army.noPartner') }
      : checked(ctx, { type: 'MERGE_ARMIES', playerId, armyIds: partners }, 'merge', t('army.merge'))

  const take = halfOf(army)
  const split: ActionSpec =
    take.length === 0
      ? { id: 'split', label: t('army.split'), disabledReason: t('army.tooSmall') }
      : checked(ctx, { type: 'SPLIT_ARMY', playerId, armyId, take }, 'split', t('army.split'))

  const bombard: ActionSpec = {
    id: 'bombard',
    label: t('army.bombard'),
    disabledReason: hasRangedUnits(army, ctx.rules) ? null : t('army.noRanged'),
    targetKind: 'bombard',
  }

  return [
    march,
    stop,
    stance('aggressive', t('army.stanceAggressive')),
    stance('defensive', t('army.stanceDefensive')),
    merge,
    split,
    bombard,
  ]
}

/** The order for a chosen target, checked like any other. */
export function targetAction(ctx: ActionContext, armyId: string, kind: 'move' | 'bombard', target: string): ActionSpec {
  return kind === 'move'
    ? checked(
        ctx,
        { type: 'MOVE_ARMY', playerId: ctx.playerId, armyId, targetProvinceId: target },
        'confirm-move',
        t('army.confirmMove'),
      )
    : checked(
        ctx,
        { type: 'BOMBARD', playerId: ctx.playerId, armyId, targetProvinceId: target },
        'confirm-bombard',
        t('army.confirmBombard'),
      )
}

/**
 * When the army would arrive, said before the order is given (R-UNIT-04, T-M10-05).
 *
 * Planned by the same route function the movement phase uses, so the time shown is
 * the time that happens.
 */
export function planArrival(
  ctx: ActionContext,
  armyId: string,
  target: string,
): { arrivalTick: number; text: string } | null {
  const army = ctx.state.armies[armyId]
  if (!army) return null
  const route = planRoute(ctx.state, army, target, ctx.map, ctx.rules)
  if (!route) return null
  return { arrivalTick: route.arrivalTick, text: arrival(ctx.state.tick, route.arrivalTick, ctx.ticksPerDay) }
}

const DIPLOMACY: readonly { action: DiplomacyAction; label: string }[] = [
  { action: 'declareWar', label: 'actions.declareWar' },
  { action: 'offerPeace', label: 'actions.offerPeace' },
  { action: 'acceptPeace', label: 'actions.acceptPeace' },
  { action: 'offerAlliance', label: 'actions.offerAlliance' },
  { action: 'acceptAlliance', label: 'actions.acceptAlliance' },
  { action: 'breakAlliance', label: 'actions.breakAlliance' },
  { action: 'grantRightOfWay', label: 'actions.grantRightOfWay' },
  { action: 'shareMap', label: 'actions.shareMap' },
]

export function diplomacyActions(ctx: ActionContext, targetPlayerId: string): ActionSpec[] {
  return DIPLOMACY.map(({ action, label }) =>
    checked(ctx, { type: 'DIPLOMACY', playerId: ctx.playerId, targetPlayerId, action }, `diplomacy-${action}`, t(label)),
  )
}

/** What a trade would return at the tick's price, and the order to make it. */
export function tradePreview(
  ctx: ActionContext,
  give: ResourceKey,
  giveAmount: number,
  want: ResourceKey,
): { wantAmount: number; text: string; action: ActionSpec } {
  const wantAmount = give === want ? 0 : exchangeAmount(ctx.state.market, give, giveAmount, want)
  const action = checked(ctx, { type: 'TRADE', playerId: ctx.playerId, give, giveAmount, want }, 'trade', t('market.trade'))
  const text =
    wantAmount > 0
      ? t('market.preview', { amount: amount(wantAmount), resource: t(`resources.${want}`) })
      : t('market.previewNone')
  return { wantAmount, text, action }
}

/** "3 × Infanterie" — the composition of an own army, in whole units. */
export function unitLines(army: Army, rules: Rules): string[] {
  return unitCounts(army, rules).map((entry) =>
    t('army.unitCount', { count: entry.count, unit: t(`units.${entry.unitKey}`) }),
  )
}

/**
 * The same composition as data rather than as a sentence (T-M13-01).
 *
 * The panel draws it as a row of symbols, and the map asks it which arm of service is
 * the strongest one in the stack. Both need the numbers, not the wording.
 */
export function unitCounts(army: Army, rules: Rules): { unitKey: string; count: number; hp: number }[] {
  return army.units.map((stack) => {
    const per = rules.units[stack.unitKey]?.hpPerUnit ?? ONE
    return {
      unitKey: stack.unitKey,
      count: Math.max(1, Math.round(stack.hpTotal / per)),
      hp: stack.hpTotal,
    }
  })
}
