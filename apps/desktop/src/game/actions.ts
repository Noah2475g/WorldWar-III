import { ONE } from '@worldwar/shared'
import {
  armyHp,
  armyRange,
  canApply,
  currentDay,
  exchangeAmount,
  planRoute,
  buildTicksForLevel,
  buildingCostForLevel,
  nextBuildLevel,
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
import { BUILDING_ART, UNIT_ART, type ArtName } from '../ui/art.tsx'
import { BUILDING_ICONS, UNIT_ICONS, type IconName } from '../ui/icons.tsx'
import { describeRejection } from './rejections.ts'
import { dominantIcon } from '../map/markers.ts'

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
  /**
   * Der zugaengliche Name, wenn die Beschriftung allein die Handlung nicht nennt
   * (T-M22-06, R-UI-06, Befund V2-13): der Bauknopf heisst sichtbar "Kaserne", ein
   * Vorleseprogramm hoert "Kaserne bauen". Fehlt das Feld, IST die Beschriftung die
   * Handlung ("Krieg erklären", "Marschieren").
   */
  aria?: string
  /** The symbol of the thing being ordered — a building, an arm of service (R-UI-10). */
  icon?: IconName
  /**
   * Das Bild derselben Sache (T-M33-02, D33.3): der Schattenriss fuer die Liste, wo 34
   * px Platz sind. Es TRITT NICHT AN DIE STELLE von `icon` — die Alarme und der
   * Tagesbericht lesen die Glyphe weiter, und die Karte kann gar nichts anderes.
   */
  art?: ArtName
  /** Where the one-sentence explanation of this thing lives (R-UI-11). */
  explainKey?: string
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
  explainKey?: string,
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
    ...(explainKey ? { explainKey } : {}),
    ...(hint ? { hint } : {}),
    disabledReason: result.ok ? null : describeRejection(result, command, ctx),
    command,
  }
}

/** "750 Geld, 400 Eisen · 18 h" — what a button costs, before it is pressed. */
export function costHint(cost: Partial<Record<string, number>>, hours: number, ticksPerDay: number): string {
  return `${costs(cost)} · ${duration(hours, ticksPerDay)}`
}

/**
 * Der Freischaltungstag im Tooltip (T-M15-03, R-TECH-02).
 *
 * Der Ablehnungstext nennt ihn schon — aber nur, solange die Reihenfolge der Pruefungen
 * im Kern ihn zuerst finden laesst. Das ist eine Reihenfolge, keine Zusage: waere die
 * Kasse leer, koennte morgen "zu wenig Rohstoffe" davorstehen, und der Spieler wuesste
 * nicht, dass die Sache ohnehin noch nicht existiert. Der Tag gehoert deshalb an die
 * **Sache**, nicht an ihren jeweils dringendsten Hinderungsgrund.
 *
 * Nach der Freischaltung faellt er weg: "ab Spieltag 1" an der Kaserne waere eine
 * Auskunft, die nur beim ersten Lesen etwas heisst und danach Rauschen ist.
 */
export function availabilityHint(ctx: ActionContext, availableFromDay: number): string {
  const day = currentDay(ctx.state, ctx.rules)
  return day >= availableFromDay ? '' : ` · ${t('actions.availableFrom', { day: availableFromDay })}`
}

/** Die naechste Sache, die freigeschaltet wird — mit Bild, Namen und Tagen bis dahin. */
export interface NextUnlock {
  key: string
  kind: 'buildings' | 'units'
  name: string
  art: ArtName | undefined
  /** Tage bis zur Freischaltung, immer mindestens 1. */
  days: number
}

/**
 * Der Blick nach vorn (T-M34-08, D34.5, R-TECH-02).
 *
 * `availabilityHint` sagt, warum etwas **nicht** geht. Diese Funktion sagt, was als
 * Naechstes kommt — die Gegenrichtung, und seit der gestreckten Leiter (T-M34-03) die
 * wichtigere: die Achse reicht bis Spieltag 80 statt bis 16, und zwischen zwei
 * Freischaltungen liegen jetzt Tage statt Stunden. Aus Warten wird ein Ziel.
 *
 * **Gebaeude und Einheiten in einer Liste, und das ist Absicht.** Es ist eine Achse; wer
 * an Spieltag 25 auf die Fabrik wartet, wartet nicht auf eine Einheit. Bei Gleichstand
 * gewinnt das Gebaeude, weil `Array.prototype.sort` stabil ist und die Gebaeude zuerst
 * stehen — die Fabrik vor dem Panzer, den sie erst moeglich macht.
 *
 * Ist alles frei, kommt `null` zurueck: eine Zeile, die dann „nichts mehr" meldet, waere
 * ab Spieltag 80 eine Dauerzeile ohne Auskunft.
 */
export function nextUnlock(ctx: ActionContext): NextUnlock | null {
  const day = currentDay(ctx.state, ctx.rules)
  const offen: NextUnlock[] = [
    ...Object.entries(ctx.rules.buildings).map(([key, rule]) => ({
      key,
      kind: 'buildings' as const,
      name: t(`buildings.${key}`),
      art: BUILDING_ART[key as keyof typeof BUILDING_ART],
      days: rule.availableFromDay - day,
    })),
    ...Object.entries(ctx.rules.units).map(([key, rule]) => ({
      key,
      kind: 'units' as const,
      name: t(`units.${key}`),
      art: UNIT_ART[key],
      days: rule.availableFromDay - day,
    })),
  ].filter((entry) => entry.days > 0)

  return offen.sort((a, b) => a.days - b.days)[0] ?? null
}

/**
 * One button per building the rules know, in the order the rules list them.
 *
 * **Der Preis ist der der naechsten Stufe, nicht der der ersten** (T-M34-04). Seit die
 * Stufe kostet, was sie kostet, waere der Grundpreis am Ausbau-Knopf eine Falschauskunft:
 * der Spieler laese 667 Material an einer Fabrik, die ihn 2161 kostet, und der Kern
 * lehnte den Auftrag mit "es fehlen Rohstoffe" ab, den die Oberflaeche eben noch als
 * bezahlbar angeboten hat.
 */
export function buildActions(ctx: ActionContext, provinceId: string): ActionSpec[] {
  const province = ctx.state.provinces[provinceId]

  return Object.entries(ctx.rules.buildings).map(([key, rule]) => {
    const level = province ? nextBuildLevel(province, key as never) : 1
    const cost = buildingCostForLevel(rule, level, ctx.rules.constants)
    const ticks = buildTicksForLevel(rule, level, ctx.rules.constants)
    // Die Stufe steht nur dabei, wenn sie etwas aendert: "Stufe 1" an jedem freien
    // Bauplatz waere Rauschen, "Stufe 3" am Ausbau-Knopf ist die halbe Auskunft.
    const stufe = level > 1 ? `${t('actions.buildLevel', { level })} · ` : ''

    return {
      ...checked(
        ctx,
        { type: 'BUILD', playerId: ctx.playerId, provinceId, building: key as never },
        `build-${key}`,
        t(`buildings.${key}`),
        `${stufe}${costHint(cost, ticks, ctx.ticksPerDay)}${availabilityHint(ctx, rule.availableFromDay)}`,
        BUILDING_ICONS[key],
        `explain.buildings.${key}`,
      ),
      // Sichtbar "Kaserne", hoerbar "Kaserne bauen" (T-M22-06, V2-13).
      aria: t('actions.buildAria', { thing: t(`buildings.${key}`) }),
    }
  })
}

/**
 * Ein Knopf je laufendem Bauvorhaben, um es abzubrechen (T-M14-13, Befund 36).
 *
 * `CANCEL_BUILD` gibt es seit M3 — gebaut, getestet, benannt und von keinem Element der
 * Oberflaeche erreichbar. Und zwar strukturell: der Befehl braucht die Kennung des
 * Auftrags, und die Sicht fuehrte sie nicht. Wer sich vergriffen hatte, musste zusehen,
 * wie die Kaserne fertig wurde, die er nicht mehr wollte.
 */
export function cancelActions(ctx: ActionContext, provinceId: string): ActionSpec[] {
  const province = ctx.state.provinces[provinceId]
  const queue = province?.buildQueue ?? []
  // Zwei Auftraege derselben Art hiessen beide "Kaserne abbrechen" (T-M28-16, Befund 5
  // der Durchsicht vom 2026-09-11) — wer den falschen drueckt, verliert den falschen Bau
  // und merkt es erst hinterher. Gibt es die Art mehrfach, nennt der Knopf zusaetzlich
  // den Fertigstellungstag; bei einem einzelnen bleibt der Text schlicht.
  const mehrfach = new Set(
    queue.filter((a, i) => queue.some((b, j) => i !== j && b.building === a.building)).map((o) => o.building),
  )

  return queue.map((order) =>
    checked(
      ctx,
      { type: 'CANCEL_BUILD', playerId: ctx.playerId, provinceId, orderId: order.id } as never,
      `cancel-${order.id}`,
      mehrfach.has(order.building)
        ? t('actions.cancelBuildDay', {
            building: t(`buildings.${order.building}`),
            day: Math.floor(order.completesAtTick / ctx.ticksPerDay) + 1,
          })
        : t('actions.cancelBuild', { building: t(`buildings.${order.building}`) }),
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
    return {
      ...checked(
        ctx,
        { type: 'RECRUIT', playerId: ctx.playerId, provinceId, unitKey: key, count: 1 },
        `recruit-${key}`,
        t(`units.${key}`),
        `${costHint(rule.cost, hours, ctx.ticksPerDay)}${strength}${availabilityHint(ctx, rule.availableFromDay)}`,
        UNIT_ICONS[key],
        `explain.units.${key}`,
      ),
      // Sichtbar "Infanterie", hoerbar "Infanterie ausheben" (T-M22-06, V2-13).
      aria: t('actions.recruitAria', { thing: t(`units.${key}`) }),
      // Das Bild fuer die Liste (T-M33-02); die Glyphe oben bleibt unberuehrt.
      ...(UNIT_ART[key] ? { art: UNIT_ART[key] } : {}),
    }
  })
}

export function capitalAction(ctx: ActionContext, provinceId: string): ActionSpec {
  return checked(ctx, { type: 'SET_CAPITAL', playerId: ctx.playerId, provinceId }, 'set-capital', t('actions.setCapital'))
}

/** The player's own armies standing in a province, for the panel's list. */
export function ownArmiesIn(
  ctx: ActionContext,
  provinceId: string,
): { id: string; name: string; strength: number; icon: IconName | undefined }[] {
  return ctx.state.armyOrder
    .map((id) => ctx.state.armies[id])
    .filter((army): army is Army => !!army && army.owner === ctx.playerId && army.locationProvinceId === provinceId)
    .map((army) => ({
      id: army.id,
      name: army.name,
      strength: armyHp(army),
      // Dieselbe Gattung, die die Karte auf die Armeemarke zeichnet — seit M13 gerechnet,
      // in der Liste daneben aber nie gezeigt (T-M20-03).
      icon: dominantIcon(army.units.map((stack) => ({ unitKey: stack.unitKey, hp: stack.hpTotal }))),
    }))
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

  // Die Zahlen kommen aus den Regeln, nicht aus dem Text (T-M12-10): eine
  // festgeschriebene 2 im Satz waere die zweite Wahrheit ueber dieselbe Sache.
  const konstanten = ctx.rules.constants
  const hinweisZeit = (ticks: number): string => duration(ticks, ctx.ticksPerDay)

  const march: ActionSpec = {
    id: 'march',
    label: t('army.move'),
    hint: t('army.moveHint', { time: hinweisZeit(konstanten.deployDelayTicks) }),
    disabledReason: army.units.length === 0 ? t('army.empty') : null,
    targetKind: 'move',
  }

  const stop = checked(ctx, { type: 'STOP_ARMY', playerId, armyId }, 'stop', t('army.stop'), t('army.stopHint'))
  if (stop.disabledReason === null && army.path.length === 0) stop.disabledReason = t('army.notMoving')

  const stanceHints: Record<Stance, string> = {
    aggressive: t('army.stanceAggressiveHint'),
    defensive: t('army.stanceDefensiveHint'),
    // Der Rueckzug ist der teuerste Befehl des Spiels und trug bis heute kein Wort dazu.
    retreat: t('army.stanceRetreatHint', {
      loss: Math.round(konstanten.retreatLossPermille / 10),
      cooldown: hinweisZeit(konstanten.retreatCooldownTicks),
      deploy: hinweisZeit(konstanten.deployDelayTicks * 2),
    }),
  }

  const stance = (value: Stance, label: string): ActionSpec => {
    const spec = checked(
      ctx,
      { type: 'SET_STANCE', playerId, armyId, stance: value },
      `stance-${value}`,
      label,
      stanceHints[value],
    )
    if (spec.disabledReason === null && army.stance === value) spec.disabledReason = t('army.alreadyStance')
    // "Angriff" ist eine Haltung, kein Befehl — hoerbar wird ein Verb daraus (T-M22-06).
    spec.aria = t('army.stanceAria', { stance: label })
    return spec
  }

  const partners = ctx.state.armyOrder.filter((id) => {
    const other = ctx.state.armies[id]
    return !!other && other.owner === playerId && other.locationProvinceId === army.locationProvinceId
  })
  const merge: ActionSpec =
    partners.length < 2
      ? { id: 'merge', label: t('army.merge'), hint: t('army.mergeHint'), disabledReason: t('army.noPartner') }
      : checked(ctx, { type: 'MERGE_ARMIES', playerId, armyIds: partners }, 'merge', t('army.merge'), t('army.mergeHint'))

  const take = halfOf(army)
  const split: ActionSpec =
    take.length === 0
      ? { id: 'split', label: t('army.split'), hint: t('army.splitHintNone'), disabledReason: t('army.tooSmall') }
      : checked(
          ctx,
          { type: 'SPLIT_ARMY', playerId, armyId, take },
          'split',
          t('army.split'),
          t('army.splitHint', {
            units: unitLines({ ...army, units: take } as Army, ctx.rules).join(', '),
          }),
        )

  const bombard: ActionSpec = {
    id: 'bombard',
    label: t('army.bombard'),
    hint: t('army.bombardHint', { range: armyRange(army, ctx.rules) }),
    disabledReason: hasRangedUnits(army, ctx.rules) ? null : t('army.noRanged'),
    targetKind: 'bombard',
  }

  /**
   * Feuerleitung (T-M15-07, R-BAT-08).
   *
   * Ein Umschalter, kein Paar aus zwei Knoepfen: der Zustand ist binaer, und zwei Knoepfe,
   * von denen immer einer ausgegraut ist, kosten Platz und sagen dasselbe. Der Tooltip
   * erklaert, was ohne Zutun geschieht — sonst ist "Feuer halten" ein Knopf gegen etwas,
   * von dem der Spieler nicht weiss, dass es passiert.
   */
  const holdFire: ActionSpec = checked(
    ctx,
    { type: 'SET_HOLD_FIRE', playerId, armyId, holdFire: !army.holdFire },
    'holdFire',
    army.holdFire ? t('army.resumeFire') : t('army.holdFire'),
    t('army.holdFireHint'),
  )
  if (holdFire.disabledReason === null && !hasRangedUnits(army, ctx.rules)) {
    holdFire.disabledReason = t('army.noRanged')
  }
  // "Feuer frei" traegt kein Verb — hoerbar heisst der Knopf "Feuer freigeben" (T-M22-06).
  if (army.holdFire) holdFire.aria = t('army.resumeFireAria')

  return [
    march,
    stop,
    stance('aggressive', t('army.stanceAggressive')),
    stance('defensive', t('army.stanceDefensive')),
    // Der Rueckzug war die einzige Kampfhandlung, die die KI befehlen konnte und der
    // Spieler nicht (T-M14-13, Befund 8): die Hilfsfunktion ist ueber den vollen
    // Stance-Typ generisch, aufgerufen wurde sie mit zwei von drei Werten.
    stance('retreat', t('army.stanceRetreat')),
    merge,
    split,
    bombard,
    holdFire,
  ]
}

/**
 * The order for a chosen target, checked like any other.
 *
 * `departInTicks` bleibt bei „sofort" ganz weg — ein Kommandolog ohne das Feld ist
 * genau das, was der Kern seit jeher liest (T-M32-01).
 */
export function targetAction(
  ctx: ActionContext,
  armyId: string,
  kind: 'move' | 'bombard',
  target: string,
  departInTicks = 0,
): ActionSpec {
  return kind === 'move'
    ? checked(
        ctx,
        {
          type: 'MOVE_ARMY',
          playerId: ctx.playerId,
          armyId,
          targetProvinceId: target,
          ...(departInTicks > 0 ? { departInTicks } : {}),
        },
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
  departInTicks = 0,
): { arrivalTick: number; text: string } | null {
  const army = ctx.state.armies[armyId]
  if (!army) return null
  const route = planRoute(ctx.state, army, target, ctx.map, ctx.rules)
  if (!route) return null
  // Ein verzoegerter Abmarsch verschiebt jeden Tick des Marsches um denselben Betrag
  // (T-M32-01) — die Vorschau muss dieselbe Rechnung machen wie der Kern.
  const arrivalTick = route.arrivalTick + Math.max(0, departInTicks)
  return { arrivalTick, text: arrival(ctx.state.tick, arrivalTick, ctx.ticksPerDay) }
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
