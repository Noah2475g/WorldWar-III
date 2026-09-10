import { useState } from 'react'
import type { PublicView, ResourceKey, Terrain, VisibleArmy, VisibleProvince } from '@worldwar/core'
// Nur der Typ: zur Laufzeit importiert weiterhin events.ts aus Panels.tsx, nicht umgekehrt.
import type { BattleReportData } from '../game/events.ts'
import type { TimelineEntry } from '../game/saves.ts'
import { t } from '../i18n/text.ts'
import { DeltaBar } from './charts/DeltaBar.tsx'
import { Sparkline } from './charts/Sparkline.tsx'
import { amount, arrival, costs, duration, percent, population, rate, remaining, unfix } from './format.ts'
import { IconRow, type IconItem } from './IconRow.tsx'
import {
  BUILDING_ICONS,
  BUILDING_ORDER,
  Icon,
  RELATION_ICONS,
  RESOURCE_ICONS,
  TERRAIN_ICONS,
  type IconName,
} from './icons.tsx'
import { Meter, toneForShare, trendOf } from './Meter.tsx'
import { NationName } from './Nation.tsx'
import { UnitMarker } from './UnitMarker.tsx'
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
  /**
   * Der zugaengliche Name mit Verb (T-M22-06, R-UI-06, V2-13): sichtbar "Kaserne",
   * hoerbar "Kaserne bauen". Fehlt er, ist die Beschriftung selbst die Handlung.
   */
  aria?: string
  /** The symbol of the thing being ordered, drawn on the button (R-UI-10). */
  icon?: IconName
  /** Where the explanation of the thing being ordered lives (R-UI-11). */
  explainKey?: string
  /** Null when the action is available; otherwise the reason it is not. */
  disabledReason: string | null
  /** What it costs and how long it takes, for the tooltip. */
  hint?: string
  /**
   * Die Quittung (T-M22-05, Befund V2-08): der Befehl ist abgeschickt und noch nicht
   * angewendet. Der Knopf zeigt den Satz und ist gesperrt, bis der naechste Tick den
   * Befehl anwendet — ein Doppelklick waere sonst ein Doppelbefehl.
   */
  pendingNotice?: string
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

/**
 * Der Verteidigungsbonus je Gelaende, in Promille (T-M29-03, R-UI-11).
 *
 * Der Kern schreibt diese Zahlen als Literale in `defenceMultiplier` (combat.ts) —
 * es gibt keine Regel-Datei, aus der die Oberflaeche sie lesen koennte, und der Kern
 * bleibt in M29 unangetastet. Darum stehen sie hier ein zweites Mal, und ein Test in
 * Panels.test.tsx haelt beide Tabellen am Kern selbst deckungsgleich.
 */
export const TERRAIN_DEFENCE_PERMILLE: Record<Terrain, number> = {
  plains: 0,
  forest: 150,
  mountain: 300,
  desert: 0,
  urban: 200,
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

function ActionButton({
  action,
  showReason,
  compact = false,
  primary = false,
  pressed,
}: {
  action: Action
  showReason: boolean
  /** Nur das Zeichen und ein Plus — fuer den Ausbau-Knopf im gebauten Bauplatz (T-M29-03). */
  compact?: boolean
  /** Die eine Hauptaktion je Panel, in Bernstein (D27.1). */
  primary?: boolean
  /** Fuer Zustandsknoepfe in einer Gruppe: gedrueckt = gilt gerade (T-M31-02). */
  pressed?: boolean
}) {
  const reasonId = `${action.id}-reason`
  return (
    <div className={compact ? 'action action--compact' : 'action'}>
      {/* Knopf und Fragezeichen in einer Zeile: untereinander ergaeben die
          Erklaerzeichen eine eigene Reihe einsamer Kreise (in der Sichtpruefung
          zu T-M13-17 gefunden). */}
      <span className="action__head">
        <button
          type="button"
          className={primary ? 'button button--primary' : 'button'}
          aria-pressed={pressed}
          disabled={action.disabledReason !== null || action.pendingNotice !== undefined}
          title={buttonTitle(action)}
          // Der Name nennt die Handlung, nicht nur die Sache (T-M22-06, V2-13).
          aria-label={compact ? (action.aria ?? action.label) : action.aria}
          aria-describedby={action.disabledReason ? reasonId : undefined}
          onClick={action.onRun}
        >
          {action.icon && <Icon name={action.icon} size={13} />}
          {compact ? '+' : action.label}
        </button>
        {action.explainKey && <Explain textKey={action.explainKey} subject={action.label} />}
      </span>
      {/* Die Quittung am ausloesenden Element (T-M22-05): abgeschickt, wirkt im
          naechsten Tick — bei stehender Uhr sagt der Satz das Weiterlaufen dazu. */}
      {action.pendingNotice && (
        <p className="action__pending" role="status">
          {action.pendingNotice}
        </p>
      )}
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
  /** Die Farbe des Besitzers auf der Karte (T-M20-02, R-UI-16). */
  ownerColor?: string | null
  actions: readonly Action[]
  /** Build, recruit — the orders a province takes, grouped. */
  groups?: readonly ActionGroupSpec[]
  /** The player's own armies standing here. */
  armies?: readonly { id: string; name: string; strength: number; icon?: IconName | undefined }[]
  selectedArmy?: string | null
  onSelectArmy?: (id: string) => void
  isCapital?: boolean
  ticksPerDay: number
  currentTick: number
}

export function ProvincePanel(props: ProvincePanelProps) {
  const province = props.province
  if (!province) return null

  const buildGroup = props.groups?.find((group) => group.id === 'build')
  const buildActions = buildGroup?.actions ?? []
  // Was die Bau-Gruppe sonst noch traegt (kein Bauplatz), bleibt eine Gruppe.
  const leftoverBuild = buildActions.filter((entry) => !BUILDING_ORDER.some((key) => entry.id === `build-${key}`))
  const otherGroups = [
    ...(buildGroup && leftoverBuild.length > 0 ? [{ ...buildGroup, actions: leftoverBuild }] : []),
    ...(props.groups?.filter((group) => group.id !== 'build') ?? []),
  ]
  const defence = TERRAIN_DEFENCE_PERMILLE[province.terrain]

  return (
    <section className="panel" aria-label={province.name}>
      <header className="panel__head">
        <h2>
          {/* Der Stern der Hauptstadt als Zeichen vor dem Namen (D27.6). */}
          {props.isCapital && <Icon name="capital" size={14} title={t('province.capital')} />}
          {props.isCapital ? ' ' : ''}
          {province.name}
        </h2>
        <p className="panel__sub">
          {province.kind === 'city' ? t('province.kindCity') : t('province.kindRural')} ·{' '}
          {/* Das Zeichen vor dem Wort, nicht statt seiner: R-UI-11 verlangt das Symbol,
              und der Name bleibt daneben stehen, weil ein Bild allein keine Auskunft ist
              (T-M20-01). Seit T-M29-03 mit dem Bonus, den das Gelaende dem Verteidiger
              gibt — die Zahl, die der Angreifer wissen will. */}
          <Icon name={TERRAIN_ICONS[province.terrain]} size={13} />{' '}
          {t(`terrain.${province.terrain}`)}
          {defence > 0 ? ` · ${t('province.defenceBonus', { percent: defence / 10 })}` : ''}
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
        <dd>
          {props.ownerName && props.ownerColor ? (
            <NationName color={props.ownerColor}>{props.ownerName}</NationName>
          ) : (
            (props.ownerName ?? t('province.neutral'))
          )}
        </dd>

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
          segments={10}
        />
      )}

      {province.deposits && Object.keys(province.deposits).length > 0 && (
        <>
          <h3>{t('province.deposits')}</h3>
          <IconRow items={depositItems(province.deposits)} />
        </>
      )}

      {/* Das Bauplatz-Raster (T-M29-03, D27.6): je Gebaeudeart genau ein Feld —
          gebaut, im Bau mit Fortschritt und Restzeit, oder frei mit der Bau-Aktion.
          Eine Liste der gebauten Gebaeude sagte nicht, was frei ist und was wann
          fertig wird; das Raster sagt beides, ohne ein Wort mehr. */}
      <h3>{t('province.buildSlots')}</h3>
      <div className="slots">
        {BUILDING_ORDER.map((key) => {
          const level = province.buildings?.[key] ?? 0
          const order = province.buildQueue?.find((entry) => entry.building === key)
          const build = buildActions.find((entry) => entry.id === `build-${key}`)
          const name = t(`buildings.${key}`)

          if (order) {
            return (
              <div key={key} className="slot slot--queued">
                <Icon name={BUILDING_ICONS[key] ?? 'warning'} size={18} title={name} />
                <span className="slot__name">
                  {name}
                  {level > 0 && <sup className="slot__level">{level + 1}</sup>}
                </span>
                <Meter
                  label={name}
                  labelHidden
                  value={props.currentTick - order.startedTick}
                  max={Math.max(1, order.completesAtTick - order.startedTick)}
                  text={remaining(props.currentTick, order.completesAtTick, props.ticksPerDay)}
                  tone="warn"
                />
              </div>
            )
          }

          if (level > 0) {
            return (
              <div key={key} className="slot slot--built">
                {/* Die Textfassung wie in der alten Symbolzeile: "2 Fabrik" fuers Ohr. */}
                <Icon name={BUILDING_ICONS[key] ?? 'warning'} size={18} title={level > 1 ? `${level} ${name}` : name} />
                <span className="slot__name">
                  {name}
                  {level > 1 && <sup className="slot__level">{level}</sup>}
                </span>
                {/* Die Ausbau-Aktion bleibt erreichbar — als Knopf im gebauten Feld. */}
                {build && <ActionButton action={build} showReason={false} compact />}
              </div>
            )
          }

          return (
            <div key={key} className="slot slot--free">
              {build ? (
                <ActionButton action={build} showReason={false} />
              ) : (
                <span className="slot__name">{name}</span>
              )}
            </div>
          )
        })}
      </div>

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
                  {/* Die vorherrschende Gattung — seit M13 fuer die Kartenmarke
                      gerechnet, in dieser Liste bis T-M20-03 nicht gezeigt. */}
                  {army.icon && <Icon name={army.icon} size={13} />} {army.name} ·{' '}
                  {t('army.strength')} {amount(army.strength)}
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
      {otherGroups.map((group) => (
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
  /**
   * Die Quittung eines abgeschickten Armee-Befehls (T-M28-02, D26.2, R-UI-05).
   *
   * Die Quittung aus T-M22-05 hing am auslösenden Knopf — der Bestätigungsknopf der
   * Zielwahl verschwindet aber im selben Klick (`setTargeting(null)`), und der Spieler
   * sah nach dem Bestätigen nichts. Sie steht deshalb zusätzlich hier, in der
   * Statuszeile der Armee, gespeist aus derselben `pendingCommands`-Sammlung der App.
   */
  pendingNotice?: string | null | undefined
  /** Zustand der Armee, 0…1 — Trefferpunkte am Vollstand (T-M31-02, nur eigene). */
  condition?: number | undefined
  ticksPerDay: number
  currentTick: number
}

/** Das Zeichen je Armeebefehl (T-M31-02, R-UI-10) — aus dem vorhandenen Satz. */
const ARMY_ACTION_ICONS: Record<string, IconName> = {
  march: 'rightOfWay',
  stop: 'entrenched',
  merge: 'alliance',
  split: 'queue',
  bombard: 'artillery',
  holdFire: 'battle',
}

const STANCES = ['aggressive', 'defensive', 'retreat'] as const

export function ArmyPanel(props: ArmyPanelProps) {
  const army = props.army
  if (!army) return null
  const targeting = props.targeting ?? null

  // Die Haltung als Dreiergruppe, die uebrigen Befehle zweispaltig (D27.6).
  const stanceActions = STANCES.map((value) => props.actions.find((action) => action.id === `stance-${value}`)).filter(
    (action): action is Action => action !== undefined,
  )
  const commands = props.actions
    .filter((action) => !action.id.startsWith('stance-'))
    .map((action) => (action.icon || !ARMY_ACTION_ICONS[action.id] ? action : { ...action, icon: ARMY_ACTION_ICONS[action.id]! }))

  return (
    <section className="panel" aria-label={t('army.title')}>
      <header className="panel__head">
        <h2>{props.name ?? t('army.title')}</h2>
        <p className="panel__sub">
          {t('army.power')} {amount(army.strength)}
          {props.condition !== undefined && ` · ${t('army.condition')} ${percent(Math.round(props.condition * 100))}`}
        </p>
      </header>

      {/* Der Zustand als Balken: Trefferpunkte am Vollstand (T-M31-02, R-UI-09). */}
      {props.condition !== undefined && (
        <Meter
          label={t('army.condition')}
          value={Math.round(props.condition * 100)}
          max={100}
          text={percent(Math.round(props.condition * 100))}
          tone={toneForShare(props.condition)}
        />
      )}

      {/* Die Zielwahl-Quittung in der Statuszeile (T-M28-02): abgeschickt, noch nicht
          angewendet — bei stehender Uhr sagt der Satz das Weiterlaufen dazu. */}
      {props.pendingNotice && (
        <p className="action__pending" role="status">
          {props.pendingNotice}
        </p>
      )}

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

      {/* Die Einheiten als NATO-Stapel — dieselben Marker wie auf der Karte (T-M31-02). */}
      {props.units && props.units.length > 0 && (
        <>
          <h3>{t('army.units')}</h3>
          <ul className="units" aria-label={t('army.units')}>
            {props.units.map((item) => (
              <li key={`${item.icon}-${item.label}`}>
                <UnitMarker icon={item.icon} label={item.label} count={item.count ?? 1} />
              </li>
            ))}
          </ul>
        </>
      )}

      {stanceActions.length > 0 && !targeting && (
        <div className="stances" role="group" aria-label={t('army.stance')}>
          {stanceActions.map((action) => (
            <ActionButton
              key={action.id}
              action={action}
              showReason={false}
              pressed={army.stance !== undefined && action.id === `stance-${army.stance}`}
            />
          ))}
        </div>
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
        commands.length > 0 && (
          <div className="actions actions--grid" role="group" aria-label={t('army.commands')}>
            {commands.map((action) => (
              <ActionButton key={action.id} action={action} showReason primary={action.id === 'march'} />
            ))}
          </div>
        )
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
  /**
   * Trifft diese Zeile den Betrachter selbst — als Rückschlag (T-M22-03, V2-07)?
   *
   * Eigener Provinzverlust, eigene Hauptstadt, Aufstand im eigenen Land, eigenes
   * Ausscheiden: der Fall der eigenen Großstadt darf nicht dieselbe optische Stimme
   * haben wie „Vietnam ist gefallen" am anderen Ende der Welt.
   */
  self?: boolean
  /**
   * Der aufklappbare Körper einer Zeile (T-M24-01, R-TIME-06, Befund V2-06).
   *
   * Heute trägt ihn nur der Tagesbericht: die Zeile wird ein `details/summary`, die
   * Überschrift bleibt die Zeile, die Absätze stehen dahinter. Eine Zeile ohne Körper
   * bleibt, was sie war.
   */
  body?: readonly string[]
  /**
   * Die Bilanzen des Tagesberichts als Balken (T-M25-04, R-UI-05, D25.2).
   *
   * Dieselben Delta-Balken wie in der Wirtschaftstabelle — eine Komponente, zweimal
   * verwendet. Als Daten getrennt vom Text: ein Balken lässt sich nicht in eine
   * Textzeile pressen, und die Zahl daneben bleibt der zugängliche Wert.
   */
  deltas?: readonly DayReportDelta[]
  /**
   * Der Anzeigedatensatz eines Gefechts (T-M27-02, R-BAT-05, D25.6).
   *
   * Anders als `body` ist der Gefechtskörper strukturiert — Balken statt Absätze:
   * je Seite Stärke vorher/nachher und Verlust, dazu die Umstände als Zeichen.
   * Gebaut von `battleReport` in game/events.ts; ein altes Ereignis ohne die
   * additiven Felder trägt keinen, und die Zeile bleibt, was sie war.
   */
  battle?: BattleReportData
}

/** Eine Bilanzzeile des Tagesberichts: Rohstoffname und Festkomma-Tagesbilanz. */
export interface DayReportDelta {
  label: string
  balance: number
}

export type EventCategory = 'combat' | 'economy' | 'diplomacy' | 'other'

/**
 * Das Zeichen einer Protokollrubrik (T-M20-03).
 *
 * `categoryOf` sortiert jede Zeile seit M13 in eine Schublade, und sichtbar war die
 * Einteilung nur, solange ein Filter gedrueckt war. Mit dem Zeichen sieht man beim
 * Ueberfliegen, welche Art Meldung eine Zeile ist, ohne sie zu lesen.
 *
 * `other` bekommt bewusst keines: ein Zeichen fuer „nichts davon" waere eine Auskunft,
 * die keine ist, und in einer Spalte mit lauter gleichen Symbolen faende das Auge die
 * Ausnahme nicht mehr.
 */
export const CATEGORY_ICONS: Partial<Record<EventCategory, IconName>> = {
  combat: 'battle',
  economy: 'money',
  diplomacy: 'alliance',
}

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

/**
 * Die Balkenlängen des Kampfberichts (T-M27-02, D25.6), rein und exakt gebunden.
 *
 * Der Maßstab ist die stärkste Seite **vorher**: ihre volle Stärke ist die volle Spur,
 * alles andere skaliert dagegen — so ist das Kräfteverhältnis der beiden Balken
 * ablesbar, nicht nur der eigene Schwund. Der Verlust ist die Differenz vorher−nachher
 * und wird an die Restspur geklemmt, damit Rundung nie über 100 % läuft.
 */
export function battleBarWidths(
  before: number,
  after: number,
  max: number,
): { after: number; loss: number } {
  if (!Number.isFinite(before) || !Number.isFinite(after) || !(max > 0)) return { after: 0, loss: 0 }
  const track = (value: number) => Math.max(0, Math.min(100, Math.round((value / max) * 1000) / 10))
  const kept = track(after)
  const loss = Math.max(0, Math.min(100 - kept, track(before - after)))
  return { after: kept, loss }
}

/**
 * Die Satzfassung des Gefechtsbilds — fürs Ohr (T-M27-02, R-UI-10).
 *
 * Das Bild trägt sie als aria-Text: je Seite Stärke vorher/nachher und Verluste mit
 * denselben Zahlen, die neben den Balken stehen, danach Gelände und Festung. Ein
 * Vorleseprogramm bekommt so den ganzen Bericht als einen Satzzug, nicht als
 * zusammenhanglose Balkenbreiten.
 */
export function battleSentence(battle: BattleReportData): string {
  const parts = battle.sides.map((side) => {
    const satz = t('events_ui.battleSide', {
      name: side.name,
      before: amount(side.before),
      after: amount(side.after),
      losses: amount(side.losses),
    })
    const extras = [
      ...(side.entrenched ? [t('events_ui.battleEntrenchedSentence', { name: side.name })] : []),
      ...(side.attackBlocked ? [t('events_ui.battleBlockedSentence', { name: side.name })] : []),
    ]
    return [satz, ...extras].join(' ')
  })
  parts.push(t('events_ui.battleTerrain', { terrain: t(`terrain.${battle.terrain}`) }))
  if (battle.fortressLevel > 0) {
    parts.push(t('events_ui.battleFortressSentence', { level: battle.fortressLevel }))
  }
  return parts.join(' ')
}

/**
 * Der Gefechtskörper: je Seite ein Stärkebalken vorher → nachher, der Verlust als
 * zinnoberroter Abschnitt (der Signalton, hier zu Recht), die Umstände als Zeichen
 * aus dem bestehenden Symbolsatz. Die Zahlen stehen sichtbar daneben — das Bild
 * ersetzt sie nicht, es macht sie vergleichbar.
 */
function BattleBody({ battle }: { battle: BattleReportData }) {
  const max = Math.max(...battle.sides.map((side) => side.before), 1)
  return (
    <div className="battle" role="img" aria-label={battleSentence(battle)}>
      {battle.sides.map((side) => {
        const widths = battleBarWidths(side.before, side.after, max)
        return (
          <div key={side.playerId} className="battle__side">
            <span className="battle__name">
              {side.name}
              {side.entrenched && (
                <Icon name="entrenched" size={12} title={t('events_ui.battleEntrenched')} />
              )}
              {side.attackBlocked && (
                <Icon name="noRetreat" size={12} title={t('events_ui.battleBlocked')} />
              )}
            </span>
            <span className="battle__bar">
              <span className="battle__after" style={{ width: `${widths.after}%` }} />
              <span className="battle__loss" style={{ width: `${widths.loss}%` }} />
            </span>
            <span className="battle__numbers">
              {amount(side.before)} → {amount(side.after)}
            </span>
          </div>
        )
      })}
      <p className="battle__facts">
        <Icon name={TERRAIN_ICONS[battle.terrain]} size={12} title={t(`terrain.${battle.terrain}`)} />
        <span>{t(`terrain.${battle.terrain}`)}</span>
        {battle.fortressLevel > 0 && (
          <>
            <Icon
              name="fortress"
              size={12}
              title={t('events_ui.battleFortress', { level: battle.fortressLevel })}
            />
            <span>{t('events_ui.battleFortress', { level: battle.fortressLevel })}</span>
          </>
        )}
      </p>
    </div>
  )
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
          <li
            key={entry.id}
            className={[
              'log__row',
              ...(entry.severity === 'alert' ? ['log__row--alert'] : []),
              // Der eigene Rueckschlag traegt Balken und Fettung (T-M22-03, V2-07).
              ...(entry.self ? ['log__row--self'] : []),
            ].join(' ')}
          >
            <time>
              {Math.floor(entry.tick / ticksPerDay) + 1} ·{' '}
              {String(entry.tick % ticksPerDay).padStart(2, '0')}:00
            </time>
            {/* Symbol und Text teilen sich EINE Rasterspur (T-M22-01, Befund V2-01):
                als drittes Rasterkind rutschte der Text in die zweite Zeile und erbte
                dort die 72 px der Zeitspalte — jeder Eintrag brach nach 1-2 Woertern um. */}
            <span className="log__entry">
              {CATEGORY_ICONS[entry.category ?? 'other'] && (
                <Icon
                  name={CATEGORY_ICONS[entry.category ?? 'other']!}
                  size={13}
                  title={t(`alerts.${entry.category ?? 'other'}`)}
                />
              )}
              {entry.body || entry.battle || (entry.deltas && entry.deltas.length > 0) ? (
                /* Der Tagesbericht klappt auf (T-M24-01, Befund V2-06): die Zeile ist
                   die Überschrift, der Körper steht dahinter — details/summary reicht,
                   im Stil der Lagekarte. Seit T-M27-02 nutzt der Kampfbericht dasselbe
                   Muster, sein Körper ist aber strukturiert: Balken statt Absätze. */
                <details className="log__report">
                  <summary>{entry.text}</summary>
                  {entry.battle && <BattleBody battle={entry.battle} />}
                  {/* Die Bilanzen als Balken (T-M25-04): DERSELBE DeltaBar wie in der
                      Wirtschaftstabelle; der groesste Betrag des Tages ist der
                      Massstab, die Zahl daneben bleibt der zugaengliche Wert. */}
                  {entry.deltas && entry.deltas.length > 0 && (
                    <ul className="log__deltas" aria-label={t('dayReport.balance')}>
                      {entry.deltas.map((delta) => (
                        <li key={delta.label}>
                          <span>{delta.label}</span>
                          <span className="log__delta-value">
                            {rate(delta.balance)}
                            <DeltaBar
                              value={delta.balance}
                              max={Math.max(...entry.deltas!.map((d) => Math.abs(d.balance)), 1)}
                            />
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {entry.body && entry.body.length > 0 && (
                    <ul>
                      {entry.body.map((line, lineIndex) => (
                        <li key={lineIndex}>{line}</li>
                      ))}
                    </ul>
                  )}
                </details>
              ) : entry.provinceId ? (
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
            </span>
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
                <td>
                  <NationName color={other.color}>{nameOf(other.id)}</NationName>
                </td>
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
        {/* Das Zeichen des jeweils GEWAEHLTEN Rohstoffs neben der Liste (T-M23-03,
            DECISIONS.md 2026-09-07): das select bleibt — T-M20-03 bestaetigt —, aber
            das Auge bekommt seinen Anker. Ohne title: die Liste nennt den Namen. */}
        <span className="market__choice market__choice--give">
          <Icon name={RESOURCE_ICONS[give] ?? 'money'} size={14} />
          <select id="market-give" value={give} onChange={(event) => setGive(event.target.value as ResourceKey)}>
            {resources.map((key) => (
              <option key={key} value={key}>
                {t(`resources.${key}`)} ({amount(stock[key] ?? 0)})
              </option>
            ))}
          </select>
        </span>
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
        <span className="market__choice market__choice--want">
          <Icon name={RESOURCE_ICONS[want] ?? 'money'} size={14} />
          <select id="market-want" value={want} onChange={(event) => setWant(event.target.value as ResourceKey)}>
            {resources.map((key) => (
              <option key={key} value={key}>
                {t(`resources.${key}`)}
              </option>
            ))}
          </select>
        </span>
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
export function EconomyPanel({
  view,
  timeline = [],
  expenses = {},
}: {
  view: PublicView | null
  /** Die Zeitreihe der Partie (T-M25-01) — sie speist die Sparkline je Rohstoff. */
  timeline?: readonly TimelineEntry[]
  /**
   * Der Tagesabfluss je Rohstoff (T-M28-05, v1-Befund 15): Bau + Aushebung + Markt
   * des Tages, gerechnet von `dayExpenses` in game/events.ts — denselben Quellen wie
   * der Tagesbericht. Steht als Zeichen mit Zahl neben dem Unterhalt (D24.2-Stil):
   * eine sechste Spalte schob die Tabelle schon einmal aus der Leiste (T-M22-02).
   */
  expenses?: Partial<Record<string, number>>
}) {
  const economy = view?.self.economy
  if (!economy) return null

  const shortages = new Set(view?.self.shortages ?? [])

  // Der Massstab der Bilanzbalken: der groesste Betrag bekommt die halbe Spur, alle
  // anderen skalieren dagegen — so ist "Oel frisst am meisten" ohne Lesen sichtbar.
  const maxBalance = Math.max(...Object.values(economy).map((flow) => Math.abs(flow.balance)), 1)

  // Das Sieben-Tage-Fenster der Sparkline (D25.2), je Rohstoff aus der Zeitreihe.
  const window7 = timeline.slice(-7)
  const stockHistory = (key: string): number[] =>
    window7.filter((entry) => key in entry.stock).map((entry) => entry.stock[key]!)

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
              <td>
                {/* Dasselbe Zeichen wie in der Kopfleiste und in der Vorkommenzeile:
                    der Satz ist da, die Tabelle war die letzte Stelle ohne ihn. */}
                <Icon name={RESOURCE_ICONS[key] ?? 'warning'} size={13} />{' '}
                {t(`resources.${key}`)}
                <Explain textKey={`explain.resources.${key}`} subject={t(`resources.${key}`)} />
              </td>
              <td>
                {amount(flow.stock)}
                {/* Bezahlt und noch nicht geliefert — keine Rate, deshalb ohne
                    Vorzeichen und ausserhalb der Bilanz (T-M12-10). Als sechste Spalte
                    schob dieser Wert die Tabelle aus der Leiste (T-M22-02, V2-02);
                    jetzt steht er als Zeichen mit Zahl hinter dem Bestand, und nur,
                    wenn es ihn gibt — eine Null ist keine Auskunft. */}
                {flow.committed > 0 && (
                  <span
                    className="committed"
                    title={t('economy.committedTitle', { amount: amount(flow.committed) })}
                  >
                    <Icon name="queue" size={11} title={t('economy.committed')} />
                    {amount(flow.committed)}
                  </span>
                )}
                {/* Der Trend der letzten sieben Tage (T-M25-03): ein Bild ohne Stimme
                    in der Zelle — keine sechste Spalte, die Leiste bleibt stehen. */}
                <Sparkline values={stockHistory(key)} />
              </td>
              <td>{rate(flow.production)}</td>
              <td>
                {rate(-flow.consumption)}
                {/* Die Ausgaben des Tages hinter dem Unterhalt (T-M28-05): Bau,
                    Aushebung und Markt — die Antwort auf „wohin geht mein Bestand,
                    obwohl die Bilanz stimmt". Nur wenn es sie gibt: eine Null ist
                    keine Auskunft. Textfassung im Titel, Muster wie „In Auftrag". */}
                {(expenses[key] ?? 0) > 0 && (
                  <span
                    className="expense"
                    title={t('economy.expensesTitle', { amount: amount(expenses[key]!) })}
                  >
                    −{amount(expenses[key]!)}
                  </span>
                )}
              </td>
              <td>
                {rate(flow.balance)}
                <DeltaBar value={flow.balance} max={maxBalance} />
              </td>
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
