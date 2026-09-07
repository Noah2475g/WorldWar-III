import { useState } from 'react'
import type { PublicView, ResourceKey, VisibleArmy, VisibleProvince } from '@worldwar/core'
import { t } from '../i18n/text.ts'
import { amount, arrival, costs, duration, percent, population, rate, remaining, unfix } from './format.ts'
import { IconRow, type IconItem } from './IconRow.tsx'
import {
  BUILDING_ICONS,
  Icon,
  RELATION_ICONS,
  RESOURCE_ICONS,
  TERRAIN_ICONS,
  type IconName,
} from './icons.tsx'
import { Meter, toneForShare, trendOf } from './Meter.tsx'
import { Explain } from './Explain.tsx'

/** Morale in the core: fixed-point, 0…100 000 for 0…100 %. */
const MORALE_SCALE = 100_000

/**
 * The side panels (T-M10-05, T-M10-06, R-UI-05).
 *
 * One rule runs through all of them: an action the player cannot take is shown, greyed
 * out, **with the reason** — never hidden. A missing button raises the question of
 * whether the game has the feature at all; a greyed-out one with "Es fehlen 400 Eisen"
 * answers the only question the player actually has.
 */

export interface Action {
  id: string
  label: string
  /** The symbol of the thing being ordered, drawn on the button (R-UI-10). */
  icon?: IconName
  /** Where the explanation of the thing being ordered lives (R-UI-11). */
  explainKey?: string
  /** Null when the action is available; otherwise the reason it is not. */
  disabledReason: string | null
  /** What it costs and how long it takes, for the tooltip. */
  hint?: string
  onRun: () => void
}

/**
 * Deposits and buildings as symbol rows (T-M13-01).
 *
 * Both used to be sentences — "5 Nahrung, 2 Kohle, 1 Eisen" and "Kaserne (Stufe 1),
 * Fabrik (Stufe 1)". The amounts are fixed-point in the core and whole units on screen,
 * which is the one conversion that happens here rather than in the row itself.
 */
export function depositItems(deposits: Partial<Record<string, number>>): IconItem[] {
  return Object.entries(deposits)
    .filter(([, value]) => (value ?? 0) > 0)
    .map(([key, value]) => ({
      icon: RESOURCE_ICONS[key] ?? 'warning',
      label: t(`resources.${key}`),
      count: Math.max(1, Math.round(unfix(value ?? 0))),
    }))
}

export function buildingItems(buildings: Partial<Record<string, number>>): IconItem[] {
  return Object.entries(buildings)
    .filter(([, level]) => (level ?? 0) > 0)
    .map(([key, level]) => ({
      icon: BUILDING_ICONS[key] ?? 'warning',
      label: t(`buildings.${key}`),
      count: level ?? 1,
    }))
}

export interface ActionGroupSpec {
  id: string
  title: string
  actions: readonly Action[]
}

/**
 * Was im Tooltip eines Knopfes steht: der Grund **und** die Kosten (T-M21-06).
 *
 * Bis zum 2026-09-07 stand hier `disabledReason ?? hint`, und bei einem gesperrten Knopf
 * gewann der Grund. Der Spieler erfuhr, *dass* es die Fabrik erst ab Tag 8 gibt, aber nie,
 * *was sie kosten wird* — Vorausplanen war unmoeglich. Verschaerfend liefert
 * `availabilityHint()` seinen Text ausschliesslich, solange die Sache gesperrt ist: also
 * genau dann, wenn er verworfen wurde. Toter Code, gebaut in T-M15-03.
 *
 * Der Hinweis ist mit " · " gegliedert, und ein Glied, das der Grund schon sagt, faellt
 * weg — sonst stuende bei einer gesperrten Fabrik zweimal derselbe Spieltag. **Die Grenze
 * dieser Regel:** sie vergleicht Text, also greift sie nur, solange der Grund den Hinweis
 * woertlich enthaelt (`de.ts`: „ab Spieltag 8" steckt in „Das gibt es erst ab Spieltag
 * 8."). Trifft sie in einer anderen Sprache nicht, steht die Angabe doppelt da — haesslich,
 * aber nicht falsch, und deshalb ist sie diesen kleinen Kniff wert.
 */
export function buttonTitle(action: Pick<Action, 'disabledReason' | 'hint'>): string | undefined {
  const reason = action.disabledReason
  const parts = (action.hint ?? '')
    .split(' · ')
    .filter((part) => part !== '' && !(reason ?? '').includes(part))

  return [reason, ...parts].filter(Boolean).join(' · ') || undefined
}

function ActionButton({ action, showReason }: { action: Action; showReason: boolean }) {
  const reasonId = `${action.id}-reason`
  return (
    <div className="action">
      {/* Knopf und Fragezeichen in einer Zeile: untereinander ergaeben die
          Erklaerzeichen eine eigene Reihe einsamer Kreise (in der Sichtpruefung
          zu T-M13-17 gefunden). */}
      <span className="action__head">
        <button
          type="button"
          className="button"
          disabled={action.disabledReason !== null}
          title={buttonTitle(action)}
          aria-describedby={action.disabledReason ? reasonId : undefined}
          onClick={action.onRun}
        >
          {action.icon && <Icon name={action.icon} size={13} />}
          {action.label}
        </button>
        {action.explainKey && <Explain textKey={action.explainKey} subject={action.label} />}
      </span>
      {action.disabledReason &&
        (showReason ? (
          <p id={reasonId} className="action__reason">
            {action.disabledReason}
          </p>
        ) : (
          <span id={reasonId} className="visually-hidden">
            {action.disabledReason}
          </span>
        ))}
    </div>
  )
}

export function ActionRow({ actions }: { actions: readonly Action[] }) {
  if (actions.length === 0) return null
  return (
    <div className="actions">
      {actions.map((action) => (
        <ActionButton key={action.id} action={action} showReason />
      ))}
    </div>
  )
}

/**
 * A titled set of orders. When every order in the group is refused for the same
 * reason — ten units, one missing barracks — the reason is said once above the group
 * rather than ten times below it.
 */
export function ActionGroup({ group }: { group: ActionGroupSpec }) {
  const reasons = new Set(group.actions.map((action) => action.disabledReason))
  const shared =
    group.actions.length > 0 && reasons.size === 1 && !reasons.has(null) ? group.actions[0]!.disabledReason : null

  /*
   * Jeder Grund erscheint höchstens einmal (T-M13-15, R-UI-09).
   *
   * Zehn Aushebeknöpfe mit vier verschiedenen Gründen ergaben zehn Absagesätze — und
   * "Dafür fehlt das Gebäude: Fabrik." viermal untereinander ist keine Auskunft, sondern
   * eine Wand. Die Knöpfe ohne sichtbaren Grund behalten ihn im Tooltip und in der
   * Textfassung für Vorleseprogramme, verlieren also nichts.
   */
  const alreadyShown = new Set<string>()
  const showsReason = (action: Action): boolean => {
    if (shared !== null || action.disabledReason === null) return false
    if (alreadyShown.has(action.disabledReason)) return false
    alreadyShown.add(action.disabledReason)
    return true
  }

  return (
    <section className="group" aria-label={group.title}>
      <h3 className="group__title">{group.title}</h3>
      {shared && <p className="group__reason">{shared}</p>}
      <div className="actions">
        {group.actions.map((action) => (
          <ActionButton key={action.id} action={action} showReason={showsReason(action)} />
        ))}
      </div>
    </section>
  )
}

/**
 * Choosing a province without the mouse (R-UI-06). The map is the natural way; this
 * is the one that works from the keyboard, and it lists only what the player may
 * know about — own provinces first, then the ones currently in view of their armies.
 */
export function ProvincePicker({
  own,
  others,
  value,
  onChange,
}: {
  own: readonly { id: string; name: string }[]
  others: readonly { id: string; name: string }[]
  value: string | null
  onChange: (id: string | null) => void
}) {
  return (
    <label className="picker">
      <span>{t('province.pick')}</span>
      <select value={value ?? ''} onChange={(event) => onChange(event.target.value || null)}>
        <option value="">{t('province.pickNone')}</option>
        <optgroup label={t('province.pickOwn')}>
          {own.map((province) => (
            <option key={province.id} value={province.id}>
              {province.name}
            </option>
          ))}
        </optgroup>
        {others.length > 0 && (
          <optgroup label={t('province.pickOthers')}>
            {others.map((province) => (
              <option key={province.id} value={province.id}>
                {province.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    </label>
  )
}

export interface ProvincePanelProps {
  province: VisibleProvince | null
  ownerName: string | null
  actions: readonly Action[]
  /** Build, recruit — the orders a province takes, grouped. */
  groups?: readonly ActionGroupSpec[]
  /** The player's own armies standing here. */
  armies?: readonly { id: string; name: string; strength: number }[]
  selectedArmy?: string | null
  onSelectArmy?: (id: string) => void
  isCapital?: boolean
  ticksPerDay: number
  currentTick: number
}

export function ProvincePanel(props: ProvincePanelProps) {
  const province = props.province
  if (!province) return null

  const built = Object.entries(province.buildings ?? {}).filter(([, level]) => (level ?? 0) > 0)

  return (
    <section className="panel" aria-label={province.name}>
      <header className="panel__head">
        <h2>
          {province.name}
          {props.isCapital ? ` · ${t('province.capital')}` : ''}
        </h2>
        <p className="panel__sub">
          {province.kind === 'city' ? t('province.kindCity') : t('province.kindRural')} ·{' '}
          {/* Das Zeichen vor dem Wort, nicht statt seiner: R-UI-11 verlangt das Symbol,
              und der Name bleibt daneben stehen, weil ein Bild allein keine Auskunft ist
              (T-M20-01). */}
          <Icon name={TERRAIN_ICONS[province.terrain]} size={13} />{' '}
          {t(`terrain.${province.terrain}`)}
          <Explain textKey={`explain.terrain.${province.terrain}`} subject={t(`terrain.${province.terrain}`)} /> ·{' '}
          {province.coastal ? t('province.coastal') : t('province.landlocked')}
        </p>
      </header>

      {province.stale && (
        <p className="notice notice--info">
          {t('province.lastSeen', { day: Math.floor(province.asOfTick / props.ticksPerDay) + 1 })}
        </p>
      )}

      <dl className="facts">
        <dt>{t('province.owner')}</dt>
        <dd>{props.ownerName ?? t('province.neutral')}</dd>

        {province.population !== undefined && (
          <>
            <dt>{t('province.population')}</dt>
            <dd>{population(province.population)}</dd>
          </>
        )}
      </dl>

      {/* Moral als Balken statt als Prozentzahl, mit dem Pfeil dorthin, wo sie hinlaeuft
          (R-UI-09). Der Wert allein sagt nicht, ob eine Provinz sich beruhigt oder
          auseinanderfaellt — und genau das ist die Frage. */}
      {province.morale !== undefined && (
        <Meter
          label={t('province.morale')}
          value={province.morale}
          max={MORALE_SCALE}
          text={percent(unfix(province.morale))}
          tone={toneForShare(province.morale / MORALE_SCALE)}
          trend={trendOf(province.morale, province.moraleTarget, MORALE_SCALE)}
        />
      )}

      {province.deposits && Object.keys(province.deposits).length > 0 && (
        <>
          <h3>{t('province.deposits')}</h3>
          <IconRow items={depositItems(province.deposits)} />
        </>
      )}

      {/* Nur wenn etwas steht: eine Überschrift über einem "Keine Gebäude" sagt zweimal
          dasselbe Nichts, und die Bauknöpfe darunter sagen es ein drittes Mal. */}
      {built.length > 0 && (
        <>
          <h3>{t('province.buildings')}</h3>
          <IconRow items={buildingItems(province.buildings ?? {})} />
        </>
      )}

      {/* Was gerade entsteht, mit Fortschritt und Restzeit (R-UI-09). Vorher stand hier
          allein die Anzahl der Vorhaben — eine Zahl, die nichts darueber sagt, ob sich
          das Warten noch lohnt. */}
      {(province.buildQueue ?? []).map((order) => (
        <Meter
          key={`build-${order.building}-${order.completesAtTick}`}
          label={t(`buildings.${order.building}`)}
          value={props.currentTick - order.startedTick}
          max={Math.max(1, order.completesAtTick - order.startedTick)}
          text={remaining(props.currentTick, order.completesAtTick, props.ticksPerDay)}
          tone="good"
        />
      ))}

      {(province.recruitQueue ?? []).map((order) => (
        <Meter
          key={`recruit-${order.unitKey}-${order.completesAtTick}`}
          label={`${order.count} × ${t(`units.${order.unitKey}`)}`}
          value={props.currentTick - order.startedTick}
          max={Math.max(1, order.completesAtTick - order.startedTick)}
          text={remaining(props.currentTick, order.completesAtTick, props.ticksPerDay)}
          tone="good"
        />
      ))}

      {/* Die Sicht ohne Regeln kennt nur die Anzahl — dann bleibt es bei der Zahl. */}
      {province.buildQueue === undefined && province.buildQueueLength !== undefined && province.buildQueueLength > 0 && (
        <p className="facts__inline">
          {t('province.buildQueue')}: {province.buildQueueLength}
        </p>
      )}

      {props.armies && props.armies.length > 0 && (
        <>
          <h3>{t('army.here')}</h3>
          <ul className="army-list">
            {props.armies.map((army) => (
              <li key={army.id} className={army.id === props.selectedArmy ? 'is-selected' : undefined}>
                <span>
                  {army.name} · {t('army.strength')} {amount(army.strength)}
                </span>
                <button type="button" className="button" onClick={() => props.onSelectArmy?.(army.id)}>
                  {t('army.select')}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <ActionRow actions={props.actions} />
      {props.groups?.map((group) => (
        <ActionGroup key={group.id} group={group} />
      ))}
    </section>
  )
}

/** The panel's state while an order still needs a place on the map. */
export interface Targeting {
  kind: 'move' | 'bombard'
  target: { id: string; name: string; arrivalText: string | null } | null
  options: readonly { id: string; name: string }[]
  /** The order for the chosen target, checked — null until a target is chosen. */
  confirm: Action | null
  onChoose: (id: string | null) => void
  onCancel: () => void
}

export interface ArmyPanelProps {
  army: VisibleArmy | null
  name?: string | undefined
  /** The stacks of an own army, as symbols with counts (R-UI-10). */
  units?: readonly IconItem[] | undefined
  actions: readonly Action[]
  targeting?: Targeting | null | undefined
  ticksPerDay: number
  currentTick: number
}

export function ArmyPanel(props: ArmyPanelProps) {
  const army = props.army
  if (!army) return null
  const targeting = props.targeting ?? null

  return (
    <section className="panel" aria-label={t('army.title')}>
      <header className="panel__head">
        <h2>{props.name ?? t('army.title')}</h2>
        <p className="panel__sub">
          {t('army.strength')}: {amount(army.strength)}
        </p>
      </header>

      <dl className="facts">
        {army.stance && (
          <>
            <dt>{t('army.stance')}</dt>
            <dd>{t(`army.stance${army.stance[0]!.toUpperCase()}${army.stance.slice(1)}`)}</dd>
          </>
        )}
        {army.arrivalTick == null && (
          <>
            <dt>{t('army.moving')}</dt>
            <dd>{t('army.idle')}</dd>
          </>
        )}
      </dl>

      {/* Ein laufender Marsch als Anzeige: wie weit, und wie lange noch (R-UI-09). */}
      {army.arrivalTick != null && (
        <Meter
          label={t('meter.march')}
          value={props.currentTick - (army.departureTick ?? props.currentTick)}
          max={Math.max(1, army.arrivalTick - (army.departureTick ?? props.currentTick))}
          text={arrival(props.currentTick, army.arrivalTick, props.ticksPerDay)}
        />
      )}

      {props.units && props.units.length > 0 && (
        <>
          <h3>{t('army.units')}</h3>
          <IconRow items={props.units} />
        </>
      )}

      {targeting ? (
        <section className="group" aria-label={t('army.targetLabel')}>
          <p className="notice notice--info">{t('army.chooseTarget')}</p>
          <label className="picker">
            <span>{t('army.targetLabel')}</span>
            <select
              value={targeting.target?.id ?? ''}
              onChange={(event) => targeting.onChoose(event.target.value || null)}
            >
              <option value="">{t('province.pickNone')}</option>
              {targeting.options.map((province) => (
                <option key={province.id} value={province.id}>
                  {province.name}
                </option>
              ))}
            </select>
          </label>
          {targeting.target && (
            <p className="facts__inline">
              {t('army.arrivalPreview', {
                target: targeting.target.name,
                arrival: targeting.target.arrivalText ?? t('army.noRoute'),
              })}
            </p>
          )}
          <div className="actions">
            {targeting.confirm && <ActionButton action={targeting.confirm} showReason />}
            <button type="button" className="button" onClick={targeting.onCancel}>
              {t('army.cancel')}
            </button>
          </div>
        </section>
      ) : (
        <ActionRow actions={props.actions} />
      )}
    </section>
  )
}

export interface EventEntry {
  id: string
  tick: number
  text: string
  provinceId?: string
  severity: 'info' | 'alert'
  /** Which drawer of the log this line belongs in (R-GAME-06). */
  category?: EventCategory
  /**
   * Gehört diese Zeile zum Weltgeschehen (R-NEWS-04, T-M15-09)?
   *
   * Getrennt von `category`, weil es eine andere Frage ist: die Rubrik sagt *worum* es
   * geht, das Weltgeschehen sagt, ob es **die Welt** angeht — eine Eroberung zwischen zwei
   * fremden Mächten ist beides „Kampf" und Weltgeschehen, ein eigener Bauabschluss weder
   * noch.
   */
  world?: boolean
}

export type EventCategory = 'combat' | 'economy' | 'diplomacy' | 'other'

export type EventFilterKey = EventCategory | 'all' | 'world'

export const EVENT_FILTERS: readonly EventFilterKey[] = ['all', 'combat', 'economy', 'diplomacy', 'world']

/**
 * Which drawer an event belongs in (T-M13-13, R-GAME-06).
 *
 * R-GAME-06 has asked for a filterable log since M5 and the log has never had one — at
 * a hundred game hours a second the one line that mattered scrolled past between two
 * blinks, and there was no way to ask for just the fighting.
 */
export function categoryOf(type: string): EventCategory {
  if (/BATTLE|BOMBARD|ARMY|CAPTURED|REVOLTED|CAPITAL/.test(type)) return 'combat'
  if (/BUILD|RECRUIT|RESOURCE|STORAGE|TRADE/.test(type)) return 'economy'
  if (/WAR|DIPLOMACY|ELIMINATED|GAME_ENDED/.test(type)) return 'diplomacy'
  return 'other'
}

export function EventLog({
  entries,
  ticksPerDay,
  onJump,
}: {
  entries: readonly EventEntry[]
  ticksPerDay: number
  onJump: (provinceId: string) => void
}) {
  const [filter, setFilter] = useState<EventFilterKey>('all')
  const shown =
    filter === 'all'
      ? entries
      : filter === 'world'
        ? // Weltgeschehen fragt nicht nach der Rubrik, sondern nach der Positivliste des
          // Kerns (R-NEWS-04) — auch wenn es zwischen zwei fremden Mächten geschieht.
          entries.filter((entry) => entry.world === true)
        : entries.filter((entry) => (entry.category ?? 'other') === filter)

  const filterBar = (
    <div className="log__filters" role="group" aria-label={t('alerts.filter')}>
      {EVENT_FILTERS.map((value) => (
        <button
          key={value}
          type="button"
          className={filter === value ? 'speed speed--active' : 'speed'}
          aria-pressed={filter === value}
          onClick={() => setFilter(value)}
        >
          {t(`alerts.${value}`)}
        </button>
      ))}
    </div>
  )

  if (shown.length === 0) {
    return (
      <section className="log" aria-label={t('events_ui.title')}>
        {filterBar}
        <p className="log__empty">{t('events_ui.empty')}</p>
      </section>
    )
  }

  return (
    <section className="log" aria-label={t('events_ui.title')}>
      {filterBar}
      <ul>
        {shown.map((entry) => (
          <li key={entry.id} className={entry.severity === 'alert' ? 'log__row log__row--alert' : 'log__row'}>
            <time>
              {Math.floor(entry.tick / ticksPerDay) + 1} ·{' '}
              {String(entry.tick % ticksPerDay).padStart(2, '0')}:00
            </time>
            {entry.provinceId ? (
              <button
                type="button"
                className="log__jump"
                onClick={() => onJump(entry.provinceId!)}
                title={t('events_ui.jumpTo')}
              >
                {entry.text}
              </button>
            ) : (
              <span>{entry.text}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * Relations with every other power, and the orders towards the one the player picks
 * (R-DIP-01, T-M10-06). Eight orders per power is a wall; eight for one chosen power
 * is a decision.
 */
export function DiplomacyPanel({
  view,
  nameOf,
  actionsFor,
}: {
  view: PublicView | null
  nameOf: (id: string) => string
  actionsFor?: (playerId: string) => readonly Action[]
}) {
  const [chosen, setChosen] = useState<string | null>(null)

  if (!view || view.others.length === 0) {
    return (
      <section className="panel" aria-label={t('diplomacy.title')}>
        <p>{t('diplomacy.noRelations')}</p>
      </section>
    )
  }

  const chosenAlive = view.others.find((other) => other.id === chosen)

  return (
    <section className="panel" aria-label={t('diplomacy.title')}>
      <h2>{t('diplomacy.title')}</h2>
      <table className="table">
        <thead>
          <tr>
            <th>{t('newGame.nation')}</th>
            <th>{t('diplomacy.title')}</th>
            {actionsFor && <th>{t('diplomacy.choose')}</th>}
          </tr>
        </thead>
        <tbody>
          {view.others.map((other) => {
            const relation = view.relations[other.id]
            return (
              <tr key={other.id} className={other.id === chosen ? 'is-selected' : undefined}>
                <td>{nameOf(other.id)}</td>
                <td className={relation?.state === 'war' ? 'state state--war' : 'state'}>
                  {/* R-UI-10 nennt den Beziehungszustand — bis T-M20-01 stand er als
                      blosses Wort da. Das Wort bleibt: die Farbe der Kriegszeile darf
                      nie das einzige Unterscheidungsmerkmal sein. */}
                  <Icon name={RELATION_ICONS[relation?.state ?? 'peace']} size={13} />{' '}
                  {t(`diplomacy.${relation?.state ?? 'peace'}`)}
                  <Explain
                    textKey={`explain.diplomacy.${relation?.state ?? 'peace'}`}
                    subject={t(`diplomacy.${relation?.state ?? 'peace'}`)}
                  />
                </td>
                {actionsFor && (
                  <td>
                    <button type="button" className="button" onClick={() => setChosen(other.id)}>
                      {t('army.select')}
                    </button>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
      {actionsFor && chosenAlive && (
        <section className="group" aria-label={t('diplomacy.with', { nation: nameOf(chosenAlive.id) })}>
          <h3 className="group__title">{t('diplomacy.with', { nation: nameOf(chosenAlive.id) })}</h3>
          <ActionRow actions={actionsFor(chosenAlive.id)} />
        </section>
      )}
    </section>
  )
}

/**
 * The exchange (R-ECON-05). One price for everyone, fixed for the tick; the panel
 * shows what a trade returns before the button is pressed, because a market that
 * only tells you afterwards is a lottery.
 */
export function MarketPanel({
  resources,
  stock,
  preview,
}: {
  resources: readonly ResourceKey[]
  stock: Partial<Record<ResourceKey, number>>
  preview: (give: ResourceKey, giveAmount: number, want: ResourceKey) => { text: string; action: Action }
}) {
  const [give, setGive] = useState<ResourceKey>(resources[0] ?? 'wood')
  const [want, setWant] = useState<ResourceKey>(resources[1] ?? 'iron')
  const [units, setUnits] = useState(100)
  // The interface counts whole units; the core counts thousandths.
  const giveAmount = Math.max(0, Math.round(units)) * 1000
  const result = preview(give, giveAmount, want)

  return (
    <section className="panel" aria-label={t('market.title')}>
      <h2>{t('market.title')}</h2>
      <div className="market">
        <label htmlFor="market-give">{t('market.give')}</label>
        <select id="market-give" value={give} onChange={(event) => setGive(event.target.value as ResourceKey)}>
          {resources.map((key) => (
            <option key={key} value={key}>
              {t(`resources.${key}`)} ({amount(stock[key] ?? 0)})
            </option>
          ))}
        </select>
        <label htmlFor="market-amount">{t('market.amount')}</label>
        <input
          id="market-amount"
          type="number"
          min={1}
          step={1}
          value={units}
          onChange={(event) => setUnits(Number(event.target.value))}
        />
        <label htmlFor="market-want">{t('market.want')}</label>
        <select id="market-want" value={want} onChange={(event) => setWant(event.target.value as ResourceKey)}>
          {resources.map((key) => (
            <option key={key} value={key}>
              {t(`resources.${key}`)}
            </option>
          ))}
        </select>
      </div>
      <p className="facts__inline">{result.text}</p>
      <ActionRow actions={[result.action]} />
      <p className="panel__sub">{t('market.hint')}</p>
    </section>
  )
}

/**
 * The economy overview (R-ECON-06).
 *
 * Four columns per resource: what is in store, what comes in over a game day, what
 * goes out, and the difference. The header shows only the last of those, because a
 * bar with four numbers per resource is unreadable — but the balance alone does not
 * say whether a shortage comes from a lost mine or from a new army, and that is the
 * question a player asks the moment a figure turns red.
 */
export function EconomyPanel({ view }: { view: PublicView | null }) {
  const economy = view?.self.economy
  if (!economy) return null

  const shortages = new Set(view?.self.shortages ?? [])

  return (
    <section className="panel" aria-label={t('economy.title')}>
      <h2>{t('economy.title')}</h2>
      <table className="table table--numbers">
        <thead>
          <tr>
            <th>{t('economy.resource')}</th>
            <th>{t('economy.stock')}</th>
            <th>{t('economy.production')}</th>
            <th>{t('economy.consumption')}</th>
            <th>{t('economy.balance')}</th>
            <th>{t('economy.committed')}</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(economy).map(([key, flow]) => (
            <tr key={key} className={shortages.has(key as never) ? 'state state--war' : undefined}>
              <td>
                {t(`resources.${key}`)}
                <Explain textKey={`explain.resources.${key}`} subject={t(`resources.${key}`)} />
              </td>
              <td>{amount(flow.stock)}</td>
              <td>{rate(flow.production)}</td>
              <td>{rate(-flow.consumption)}</td>
              <td>{rate(flow.balance)}</td>
              {/* Bezahlt und noch nicht geliefert — keine Rate, deshalb ohne Vorzeichen
                  und ausserhalb der Bilanz (T-M12-10). */}
              <td>{amount(flow.committed)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

/** A cost-and-duration hint for a tooltip: "750 Geld, 400 Eisen · 18 h". */
export function hintFor(
  cost: Partial<Record<string, number>>,
  hours: number,
  ticksPerDay: number,
): string {
  const parts = [costs(cost), duration(hours, ticksPerDay)].filter(Boolean)
  return parts.join(' · ')
}
