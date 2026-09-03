import type { PublicView, VisibleArmy, VisibleProvince } from '@worldwar/core'
import { t } from '../i18n/text.ts'
import { amount, arrival, costs, duration, percent, population, rate, unfix } from './format.ts'

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
  /** Null when the action is available; otherwise the reason it is not. */
  disabledReason: string | null
  /** What it costs and how long it takes, for the tooltip. */
  hint?: string
  onRun: () => void
}

export function ActionRow({ actions }: { actions: readonly Action[] }) {
  return (
    <div className="actions">
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          className="button"
          disabled={action.disabledReason !== null}
          title={action.disabledReason ?? action.hint ?? undefined}
          aria-describedby={action.disabledReason ? `${action.id}-reason` : undefined}
          onClick={action.onRun}
        >
          {action.label}
          {action.disabledReason && (
            <span id={`${action.id}-reason`} className="visually-hidden">
              {action.disabledReason}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

export interface ProvincePanelProps {
  province: VisibleProvince | null
  ownerName: string | null
  actions: readonly Action[]
  ticksPerDay: number
  currentTick: number
}

export function ProvincePanel(props: ProvincePanelProps) {
  const province = props.province
  if (!province) return null

  return (
    <section className="panel" aria-label={province.name}>
      <header className="panel__head">
        <h2>{province.name}</h2>
        <p className="panel__sub">
          {province.kind === 'city' ? t('province.kindCity') : t('province.kindRural')} ·{' '}
          {t(`terrain.${province.terrain}`)} ·{' '}
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

        {province.morale !== undefined && (
          <>
            <dt>{t('province.morale')}</dt>
            <dd>{percent(unfix(province.morale))}</dd>
          </>
        )}

        {province.population !== undefined && (
          <>
            <dt>{t('province.population')}</dt>
            <dd>{population(province.population)}</dd>
          </>
        )}
      </dl>

      {province.deposits && Object.keys(province.deposits).length > 0 && (
        <>
          <h3>{t('province.deposits')}</h3>
          <p className="facts__inline">{costs(province.deposits)}</p>
        </>
      )}

      {province.buildQueueLength !== undefined && province.buildQueueLength > 0 && (
        <p className="facts__inline">
          {t('province.buildQueue')}: {province.buildQueueLength}
        </p>
      )}

      <ActionRow actions={props.actions} />
    </section>
  )
}

export interface ArmyPanelProps {
  army: VisibleArmy | null
  actions: readonly Action[]
  ticksPerDay: number
  currentTick: number
}

export function ArmyPanel(props: ArmyPanelProps) {
  const army = props.army
  if (!army) return null

  return (
    <section className="panel" aria-label={t('army.title')}>
      <header className="panel__head">
        <h2>{t('army.title')}</h2>
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
        <dt>{t('army.moving')}</dt>
        <dd>
          {army.arrivalTick != null
            ? arrival(props.currentTick, army.arrivalTick, props.ticksPerDay)
            : t('army.idle')}
        </dd>
      </dl>

      <ActionRow actions={props.actions} />
    </section>
  )
}

export interface EventEntry {
  id: string
  tick: number
  text: string
  provinceId?: string
  severity: 'info' | 'alert'
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
  if (entries.length === 0) {
    return (
      <section className="log" aria-label={t('events_ui.title')}>
        <p className="log__empty">{t('events_ui.empty')}</p>
      </section>
    )
  }

  return (
    <section className="log" aria-label={t('events_ui.title')}>
      <ul>
        {entries.map((entry) => (
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

export function DiplomacyPanel({ view, nameOf }: { view: PublicView | null; nameOf: (id: string) => string }) {
  if (!view || view.others.length === 0) {
    return (
      <section className="panel" aria-label={t('diplomacy.title')}>
        <p>{t('diplomacy.noRelations')}</p>
      </section>
    )
  }

  return (
    <section className="panel" aria-label={t('diplomacy.title')}>
      <h2>{t('diplomacy.title')}</h2>
      <table className="table">
        <thead>
          <tr>
            <th>{t('newGame.nation')}</th>
            <th>{t('diplomacy.title')}</th>
          </tr>
        </thead>
        <tbody>
          {view.others.map((other) => {
            const relation = view.relations[other.id]
            return (
              <tr key={other.id}>
                <td>{nameOf(other.id)}</td>
                <td className={relation?.state === 'war' ? 'state state--war' : 'state'}>
                  {t(`diplomacy.${relation?.state ?? 'peace'}`)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
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
          </tr>
        </thead>
        <tbody>
          {Object.entries(economy).map(([key, flow]) => (
            <tr key={key} className={shortages.has(key as never) ? 'state state--war' : undefined}>
              <td>{t(`resources.${key}`)}</td>
              <td>{amount(flow.stock)}</td>
              <td>{rate(flow.production)}</td>
              <td>{rate(-flow.consumption)}</td>
              <td>{rate(flow.balance)}</td>
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
