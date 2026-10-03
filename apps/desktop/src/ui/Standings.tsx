import type { DiplomaticState, GoalView, PublicView } from '@worldwar/core'
import type { TimelineEntry } from '../game/saves.ts'
import { isPluralNation } from '../i18n/grammar.ts'
import { plural, t } from '../i18n/text.ts'
import { LineChart, type ChartRole, type ChartSeries } from './charts/LineChart.tsx'
import { TOKENS } from './tokens.ts'
import { Dialog } from './Dialogs.tsx'
import { amount } from './format.ts'
import { victoryProgress } from './Header.tsx'
import { Meter } from './Meter.tsx'
import { NationName } from './Nation.tsx'
import { useScrollableTab } from './useScrollableTab.ts'

/**
 * Where everyone stands (T-M13-12, R-UI-13).
 *
 * The score existed in the state from M5 onwards and never reached the screen, so the
 * one question a strategy game has to answer at any moment — am I winning — had no
 * answer in the interface at all.
 *
 * Two honesty rules, both from the fog of war (R-DIP-04): a power the player has never
 * met is not listed, and the strength column says *seen* strength, because that is the
 * only kind there is. A column that quietly showed the true army size of an opponent
 * would be the interface cheating on the player's behalf.
 */

export interface StandingsRow {
  id: string
  nation: string
  /** Die Farbe dieser Macht auf der Karte (T-M20-02, R-UI-16). */
  color: string
  score: number
  relation: string
  /** Strength of that power's armies the player can currently see. */
  seenStrength: number
  own: boolean
  /** Die Beziehung als Zustand, nicht als Wort — fuer die Rollen im Diagramm (T-M31-04). */
  state?: DiplomaticState
}

/** The table's rows, strongest first, own power included. */
export function standingsRows(view: PublicView | null, nameOf: (id: string) => string): StandingsRow[] {
  if (!view) return []

  const seen = new Map<string, number>()
  for (const army of view.armies) seen.set(army.owner, (seen.get(army.owner) ?? 0) + army.strength)

  const rows: StandingsRow[] = [
    {
      id: view.playerId,
      nation: view.self.nation,
      color: view.self.color,
      score: view.self.score,
      relation: t('standings.you'),
      seenStrength: seen.get(view.playerId) ?? 0,
      own: true,
    },
    ...view.others
      .filter((other) => other.alive)
      .map((other) => ({
        id: other.id,
        nation: nameOf(other.id),
        color: other.color,
        score: other.score,
        relation: t(`diplomacy.${view.relations[other.id]?.state ?? 'peace'}`),
        seenStrength: seen.get(other.id) ?? 0,
        own: false,
        ...(view.relations[other.id]?.state ? { state: view.relations[other.id]!.state } : {}),
      })),
  ]

  return rows.sort((a, b) => b.score - a.score)
}

/**
 * Der Machtverlauf als Kurve (T-M25-02, R-UI-13, D25.2): die Zeitreihe der Hülle
 * (T-M25-01) wird je bekannter Macht eine Reihe in Spielerfarbe. Eine Macht, die einem
 * Tag fehlt (noch nicht getroffen, ausgeschieden), fehlt dort einfach — die Kurve
 * beginnt und endet, wo das Wissen beginnt und endet.
 */
/**
 * Die Rolle jeder Macht im Diagramm (T-M31-04, D27.6): eigen, der staerkste
 * Kriegsgegner, der staerkste Verbuendete — alle anderen "other". `rows` sind nach
 * Punkten sortiert, also ist der erste Treffer je Zustand der staerkste.
 */
export function chartRoles(rows: readonly StandingsRow[]): Record<string, ChartRole> {
  const roles: Record<string, ChartRole> = {}
  let enemy: string | null = null
  let ally: string | null = null
  for (const row of rows) {
    if (row.own) roles[row.id] = 'own'
    else if (row.state === 'war' && enemy === null) roles[(enemy = row.id)] = 'enemy'
    else if (row.state === 'alliance' && ally === null) roles[(ally = row.id)] = 'ally'
    else roles[row.id] = 'other'
  }
  return roles
}

const ROLE_COLORS: Record<ChartRole, string> = {
  own: TOKENS.good,
  enemy: TOKENS.accent,
  ally: TOKENS.ally,
  other: TOKENS.inkSoft,
}

export function scoreSeries(rows: readonly StandingsRow[], timeline: readonly TimelineEntry[]): ChartSeries[] {
  const roles = chartRoles(rows)
  return rows.map((row) => ({
    id: row.id,
    label: row.nation,
    // Seit T-M31-04 sagt die Farbe die Rolle (eigen, Feind, Verbuendeter), nicht die
    // Macht — die Spielerfarbe steht weiter in der Tabelle darunter.
    color: ROLE_COLORS[roles[row.id] ?? 'other'],
    role: roles[row.id] ?? 'other',
    points: timeline
      .filter((entry) => row.id in entry.scores)
      .map((entry) => ({ day: entry.day, value: entry.scores[row.id]! })),
  }))
}

/** Promille als Prozent mit höchstens einer Nachkommastelle: 400 → „40", 123 → „12,3". */
function permilleAsPercent(permille: number): string {
  return (permille / 10).toLocaleString('de-DE', { maximumFractionDigits: 1 })
}

/** Der Satz eines Ziels: die Marke, in Provinzen oder als Anteil. */
function goalSentence(row: GoalView): string {
  if (row.goal === 'provinces') return t('goals.rows.provinces', { mark: row.mark })
  return t(`goals.rows.${row.goal}`, { percent: permilleAsPercent(row.mark) })
}

/** Rechts: der Tag bei einem erreichten Ziel, sonst der Abstand zur Marke. */
function goalState(row: GoalView): string {
  if (row.reachedOnDay !== null) return t('goals.reached', { day: row.reachedOnDay })
  const gap = row.mark - row.value
  // Über der Marke, aber noch nicht eingetragen: der Tag entsteht erst am Tageswechsel
  // (D31.3). „Noch 0 Prozentpunkte" wäre falsch, ein erfundener Tag auch.
  if (gap <= 0) return t('goals.dueNextDay')
  if (row.goal === 'provinces') return plural(gap, 'goals.missingProvincesOne', 'goals.missingProvincesMany')
  return plural(gap / 10, 'goals.missingShareOne', 'goals.missingShareMany', { points: permilleAsPercent(gap) })
}

/**
 * Die eigenen Zwischenziele unter der Tabelle (T-M35-05, R-GAME-08/AK3, D31.6).
 *
 * Die Rangliste ist der Ort, an dem der Spieler ohnehin fragt, wie er steht. Vier Zeilen:
 * Zeichen, Satz, bei offenem Ziel der Abstand, bei erreichtem der Tag. Die Quelle ist
 * `self.goals` — die Sicht kennt nur die eigenen. Ohne Ziele (eine Sicht ohne Regeln) steht
 * hier nichts, auch keine Überschrift über einem leeren Kasten.
 */
export function GoalList({ goals }: { goals: readonly GoalView[] | undefined }) {
  if (!goals || goals.length === 0) return null
  return (
    <>
      <h3 className="goals__title">{t('goals.title')}</h3>
      <ul className="goals" aria-label={t('goals.title')}>
        {goals.map((row) => {
          const reached = row.reachedOnDay !== null
          return (
            <li key={row.goal} className={reached ? 'goal goal--reached' : 'goal'}>
              <span className="goal__mark" aria-hidden="true">
                {reached ? t('goals.markReached') : t('goals.markOpen')}
              </span>
              <span className="goal__text">{goalSentence(row)}</span>
              <span className="goal__state">{goalState(row)}</span>
            </li>
          )
        })}
      </ul>
    </>
  )
}

export function StandingsPanel({
  view,
  nameOf,
  timeline = [],
}: {
  view: PublicView | null
  nameOf: (id: string) => string
  /** Die Zeitreihe der Partie (T-M25-01); ohne sie bleibt es beim ehrlichen Satz. */
  timeline?: readonly TimelineEntry[]
}) {
  // Die Tabelle rollt in sich, wo die Seitenleiste schmal ist (touch.css, Telefon quer) — dann
  // braucht sie einen Tabstopp (T-M44-08, R-UX-06/AK1: axe `scrollable-region-focusable`).
  const tableScroll = useScrollableTab<HTMLTableElement>()
  const rows = standingsRows(view, nameOf)
  if (rows.length === 0) return null

  const leader = Math.max(...rows.map((row) => row.score), 1)

  // Unter drei aufgezeichneten Tagen gibt es keine Kurve (T-M28-01, D26.1): ein
  // einzelner Punkt wäre eine leere Behauptung, zwei Punkte eine Gerade, die einen
  // Verlauf nur vortäuscht. Der Wartesatz sagt stattdessen ehrlich, wie weit die
  // Aufzeichnung ist.
  const series = scoreSeries(rows, timeline)
  const days = new Set(timeline.map((entry) => entry.day))
  const endwerte = rows
    .map((row) => {
      const last = series.find((line) => line.id === row.id)?.points.at(-1)
      return last ? `${row.nation} ${Math.round(last.value)}` : null
    })
    .filter(Boolean)
    .join(', ')

  return (
    <section className="panel" aria-label={t('standings.title')}>
      <h2>{t('standings.title')}</h2>
      {days.size >= 3 ? (
        <LineChart series={series} ariaLabel={t('standings.historyAria', { list: endwerte })} />
      ) : (
        <p className="chart__empty">
          {days.size === 0
            ? t('standings.historyEmpty')
            : t('standings.historyWaiting', { days: days.size })}
        </p>
      )}
      <table className="table" aria-label={t('standings.title')} ref={tableScroll.ref} tabIndex={tableScroll.tabIndex}>
        <thead>
          <tr>
            <th>{t('newGame.nation')}</th>
            <th>{t('standings.points')}</th>
            <th>{t('standings.relation')}</th>
            <th>{t('standings.seenStrength')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={row.own ? 'is-selected' : undefined}>
              <td>
                <NationName color={row.color}>{row.nation}</NationName>
              </td>
              <td>
                {/* Gegen den Fuehrenden, nicht gegen eine Zahl aus dem Nichts: so sieht
                    man den Abstand, nicht nur den eigenen Stand. */}
                <Meter
                  label={row.nation}
                  value={row.score}
                  max={leader}
                  text={String(Math.round(row.score))}
                  tone={row.own ? 'good' : 'neutral'}
                  labelHidden
                />
              </td>
              <td className={row.relation === t('diplomacy.war') ? 'state state--war' : 'state'}>{row.relation}</td>
              <td className="mono">{row.seenStrength > 0 ? amount(row.seenStrength) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <GoalList goals={view?.self.goals} />
    </section>
  )
}

/**
 * The end of the game (R-UI-13, R-GAME-02).
 *
 * The state has carried a winner since M5 and the interface never mentioned it: a game
 * could be decided and go on drawing the same map. This says so once, sums the game up
 * in three figures, and lets the player close it — a game that cannot be looked at
 * after the last move is not an ending, it is a crash with a caption.
 */
// LOESCHVERMERK (Review): bis T-M44-08/-15 stand der Endedialog als eigenes Geruest ohne Fokusfalle und Escape.
// Ersetzt durch `Dialog` (Fokus-Einzug, Falle, Escape) und eine sichtbare Ueberschrift mit dem Ausgang. Wortlaut davor:
//
//   <div className="dialog-backdrop">
//     <div className="dialog" role="dialog" aria-modal="true" aria-label={t('standings.victoryTitle')}>
//       <div className="dialog__head"><h2>{t('standings.victoryTitle')}</h2></div>
//       <div className="dialog__body">
//         <p className={own ? 'state' : 'state state--war'}>
//           {own ? t('standings.won') : eliminated && !winner ? t('standings.eliminated') : (() => {
//             const nation = winner ? nameOf(winner) : '—'
//             return t(isPluralNation(nation) ? 'standings.lostPlural' : 'standings.lost', { nation })
//           })()}
//         </p>
//         <p className="facts__inline">
//           {[t('standings.summaryHead', { day: Math.floor(view.tick / ticksPerDay) + 1 }),
//             plural(Math.round(view.self.score), 'standings.summaryPointsOne', 'standings.summaryPointsMany'),
//             plural(provinces, 'standings.summaryProvincesOne', 'standings.summaryProvincesMany')].join(' · ')}
//         </p>
//         <div className="actions">
//           {onNewGame && <button type="button" className="button button--primary" onClick={onNewGame}>{t('standings.newGame')}</button>}
//           <button type="button" className="button" onClick={onClose}>{t('standings.close')}</button>
//         </div></div></div></div>
//
// Ebenso: die Tabelle der Rangliste trug `<table className="table">` ohne weitere Klasse.
export function VictoryDialog({
  view,
  nameOf,
  ticksPerDay,
  onClose,
  onNewGame,
}: {
  view: PublicView
  nameOf: (id: string) => string
  ticksPerDay: number
  onClose: () => void
  /** Eine zweite Partie. Ohne diesen Weg war nach der ersten Schluss (Befund 37). */
  onNewGame?: (() => void) | undefined
}) {
  const winner = view.victory.winner
  const own = winner === view.playerId
  // Die eigene Niederlage ist ein Ausgang, auch wenn die Partie weiterlaeuft (T-M14-10,
  // Befund N4). Der Kern setzt einen Sieger erst, wenn genau eine Macht uebrig ist —
  // scheidet der Mensch als einer von acht aus, erfuhr er es bis heute gar nicht.
  const eliminated = !view.self.alive
  // Nur was WIRKLICH noch da ist (T-M12-10): `view.provinces` fuehrt auch erinnerte
  // Provinzen, und die Erinnerung eines Ausgeschiedenen friert im Tick vor dem Fall ein.
  // Der Dialog schrieb deshalb "1 Provinzen" ueber dem Satz "Ihre letzte Provinz ist
  // gefallen" — er widersprach sich selbst, und die Zahl war die falsche der beiden.
  const provinces = view.provinces.filter(
    (province) => province.owner === view.playerId && !province.stale,
  ).length

  const nation = winner ? nameOf(winner) : '—'
  const condition = victoryConditionSentence(view, own, nation)

  return (
    // Das gemeinsame Dialoggerüst (T-M44-08, R-UX-06/AK2): Fokus-Einzug, Fokusfalle und Escape
    // (= „Karte ansehen“). Ein Klick neben den Dialog schließt NICHT — das Spielende wegzuwischen
    // wäre ein Versehen. Der Name bleibt „Die Partie ist entschieden“ (daran findet ihn die
    // Hülle), die sichtbare Überschrift sagt den Ausgang (T-M44-15, R-UX-05/AK4).
    <Dialog
      title={t('standings.victoryTitle')}
      heading={own ? t('standings.headingWon') : t('standings.headingLost')}
      onClose={onClose}
      backdropCloses={false}
      foot={
        <>
          {onNewGame && (
            <button type="button" className="button button--primary" onClick={onNewGame} data-autofocus>
              {t('standings.newGame')}
            </button>
          )}
          <button type="button" className="button" onClick={onClose} data-autofocus={onNewGame ? undefined : true}>
            {t('standings.close')}
          </button>
        </>
      }
    >
      <p className={own ? 'state' : 'state state--war'}>
        {own
          ? t('standings.won')
          : eliminated && !winner
            ? t('standings.eliminated')
            : // „Vereinigte Staaten haben gewonnen" — der Numerus haengt am Machtnamen (T-M23-02, V2-11).
              t(isPluralNation(nation) ? 'standings.lostPlural' : 'standings.lost', { nation })}
      </p>
      {condition && <p className="victory__condition">{condition}</p>}
      <p className="facts__inline">
        {[
          t('standings.summaryHead', { day: Math.floor(view.tick / ticksPerDay) + 1 }),
          plural(Math.round(view.self.score), 'standings.summaryPointsOne', 'standings.summaryPointsMany'),
          plural(provinces, 'standings.summaryProvincesOne', 'standings.summaryProvincesMany'),
        ].join(' · ')}
      </p>
    </Dialog>
  )
}

/**
 * Die Siegbedingung der Partie in einem Satz, mit der Zahl aus der Sicht (T-M44-15, R-UX-05/AK4).
 *
 * Für den Sieg steht der Anteil dabei, der sie wirklich erfüllt — nicht nur, dass ein Sieger
 * gesetzt ist (Befund B-22). Fehlt die Schwelle in der Sicht, bleibt der Satz bei der Art der
 * Bedingung; ein Satz mit erfundener Zahl wäre schlimmer als keiner.
 */
function victoryConditionSentence(view: PublicView, own: boolean, nation: string): string | null {
  const { condition, winner } = view.victory
  if (condition === 'conquest') {
    if (own) return t('standings.conditionConquestWon')
    return winner ? t('standings.conditionConquestLost', { nation }) : t('standings.conditionConquestOpen')
  }
  const progress = victoryProgress(view)
  const goal = view.victory.pointsShareToWin ? Math.round(view.victory.pointsShareToWin / 10) : null
  if (goal === null) return null
  if (own) {
    return progress
      ? t('standings.conditionPointsWon', { share: Math.round(progress.share), goal })
      : t('standings.conditionPointsOpen', { goal })
  }
  return winner ? t('standings.conditionPointsLost', { goal, nation }) : t('standings.conditionPointsOpen', { goal })
}
