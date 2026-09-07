import type { PublicView } from '@worldwar/core'
import type { TimelineEntry } from '../game/saves.ts'
import { isPluralNation } from '../i18n/grammar.ts'
import { plural, t } from '../i18n/text.ts'
import { LineChart, type ChartSeries } from './charts/LineChart.tsx'
import { amount } from './format.ts'
import { Meter } from './Meter.tsx'
import { NationName } from './Nation.tsx'

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
export function scoreSeries(rows: readonly StandingsRow[], timeline: readonly TimelineEntry[]): ChartSeries[] {
  return rows.map((row) => ({
    id: row.id,
    label: row.nation,
    color: row.color,
    points: timeline
      .filter((entry) => row.id in entry.scores)
      .map((entry) => ({ day: entry.day, value: entry.scores[row.id]! })),
  }))
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
  const rows = standingsRows(view, nameOf)
  if (rows.length === 0) return null

  const leader = Math.max(...rows.map((row) => row.score), 1)

  // Unter zwei aufgezeichneten Tagen gibt es keine Kurve — ein einzelner Punkt wäre
  // eine leere Behauptung. Der Leerzustand sagt stattdessen, woran es liegt.
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
      {days.size >= 2 ? (
        <LineChart series={series} ariaLabel={t('standings.historyAria', { list: endwerte })} />
      ) : (
        <p className="chart__empty">{t('standings.historyEmpty')}</p>
      )}
      <table className="table">
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

  return (
    <div className="dialog-backdrop">
      <div className="dialog" role="dialog" aria-modal="true" aria-label={t('standings.victoryTitle')}>
        <div className="dialog__head">
          <h2>{t('standings.victoryTitle')}</h2>
        </div>
        <div className="dialog__body">
          <p className={own ? 'state' : 'state state--war'}>
            {own
              ? t('standings.won')
              : eliminated && !winner
                ? t('standings.eliminated')
                : (() => {
                    // „Vereinigte Staaten haben gewonnen" — der Numerus haengt am
                    // Machtnamen (T-M23-02, V2-11).
                    const nation = winner ? nameOf(winner) : '—'
                    return t(isPluralNation(nation) ? 'standings.lostPlural' : 'standings.lost', { nation })
                  })()}
          </p>
          <p className="facts__inline">
            {[
              t('standings.summaryHead', { day: Math.floor(view.tick / ticksPerDay) + 1 }),
              plural(
                Math.round(view.self.score),
                'standings.summaryPointsOne',
                'standings.summaryPointsMany',
              ),
              plural(provinces, 'standings.summaryProvincesOne', 'standings.summaryProvincesMany'),
            ].join(' · ')}
          </p>
          <div className="actions">
            {onNewGame && (
              <button type="button" className="button button--primary" onClick={onNewGame}>
                {t('standings.newGame')}
              </button>
            )}
            <button type="button" className="button" onClick={onClose}>
              {t('standings.close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
