import { t } from '../i18n/text.ts'
import { amount } from './format.ts'
import { EventLog, type EventEntry } from './Panels.tsx'
import type { StandingsRow } from './Standings.tsx'

/**
 * Der Fuss (T-M31-03, D27.6, R-UI-13/R-UI-14/R-UI-03).
 *
 * Drei Teile: links das Protokoll (unveraendert, mit seinen Filtern), in der Mitte
 * die Rangliste — dauerhaft, vier Zeilen um die eigene Macht, damit "wo stehe ich"
 * nie ein Panel weit weg ist —, rechts drei Knoepfe: Depesche (der juengste
 * Tagesbericht), Diplomatie/Markt, Rangliste/Sieg mit der Neu-Marke: die Zahl der
 * Protokollzeilen, die seit dem letzten Oeffnen dazukamen. Beide Rechnungen sind
 * rein, damit ein Test sie festhalten kann.
 */

/** Ein Tagesbericht im Protokoll: traegt Bilanzen oder Absaetze, aber keinen Kampf. */
export function isDayReport(entry: EventEntry): boolean {
  return !entry.battle && ((entry.deltas?.length ?? 0) > 0 || (entry.body?.length ?? 0) > 0)
}

/** Der juengste Tagesbericht, oder null. */
export function latestReport(entries: readonly EventEntry[]): EventEntry | null {
  let best: EventEntry | null = null
  for (const entry of entries) {
    if (isDayReport(entry) && (!best || entry.tick > best.tick)) best = entry
  }
  return best
}

/** Wie viele Zeilen seit dem letzten Oeffnen dazukamen — die Neu-Marke. */
export function unreadCount(entries: readonly EventEntry[], seenTick: number): number {
  return entries.filter((entry) => entry.tick > seenTick).length
}

/**
 * Vier Zeilen um die eigene Macht: der Rang darueber, die eigene, zwei darunter —
 * am Rand der Liste rutscht das Fenster, damit es immer vier sind (wenn es vier gibt).
 * Die eigene Zeile ist immer dabei; das ist die einzige, die zaehlt.
 */
export function footRows(rows: readonly StandingsRow[], count = 4): StandingsRow[] {
  const own = rows.findIndex((row) => row.own)
  if (rows.length <= count) return [...rows]
  const start = Math.max(0, Math.min(own === -1 ? 0 : own - 1, rows.length - count))
  return rows.slice(start, start + count)
}

export interface FootProps {
  entries: readonly EventEntry[]
  ticksPerDay: number
  rows: readonly StandingsRow[]
  /** Der Tick, bis zu dem der Spieler das Protokoll zuletzt gesehen hat. */
  seenTick: number
  onJump: (provinceId: string) => void
  onDispatch: () => void
  onPanel: (panel: 'diplomacy' | 'market' | 'standings') => void
}

export function Foot(props: FootProps) {
  const unread = unreadCount(props.entries, props.seenTick)
  const ranked = footRows(props.rows)
  const report = latestReport(props.entries)

  return (
    <footer className="foot">
      <EventLog entries={props.entries} ticksPerDay={props.ticksPerDay} onJump={props.onJump} />

      <section className="foot__standings" aria-label={t('foot.standings')}>
        <h3 className="foot__title">{t('foot.standings')}</h3>
        <ol className="foot__rows">
          {ranked.map((row) => (
            <li key={row.id} className={row.own ? 'foot__row foot__row--own' : 'foot__row'}>
              <span className="foot__rank">{props.rows.indexOf(row) + 1}.</span>
              <span className="foot__nation">{row.nation}</span>
              <span className="foot__score">{amount(row.score)}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="foot__buttons">
        <button type="button" className="button foot__button" onClick={props.onDispatch} disabled={!report} title={report?.text}>
          {t('foot.dispatch')}
        </button>
        <span className="foot__pair">
          <button type="button" className="button foot__button" onClick={() => props.onPanel('diplomacy')}>
            {t('header.diplomacy')}
          </button>
          <button type="button" className="button foot__button" onClick={() => props.onPanel('market')}>
            {t('header.market')}
          </button>
        </span>
        <button type="button" className="button foot__button" onClick={() => props.onPanel('standings')}>
          {t('foot.standingsOpen')}
          {unread > 0 && (
            <span className="foot__badge" aria-label={t('foot.unread', { count: unread })}>
              {unread}
            </span>
          )}
        </button>
      </div>
    </footer>
  )
}
