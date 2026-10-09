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

/**
 * Platz 1 zuerst (T-M44-10, R-UX-02/AK4, Befund B-15): die vier Zeilen um die eigene Macht, und —
 * steht der Erste nicht ohnehin darunter — der Erste als erste Zeile davor. Additiv: `footRows`
 * und mit ihm T-M31-03 bleiben, wie sie waren; wer auf Platz 6 steht, sieht jetzt auch, wie weit der
 * Erste vorn liegt (R-UI-13).
 */
export function footRowsWithLeader(rows: readonly StandingsRow[], count = 4): StandingsRow[] {
  const around = footRows(rows, count)
  const leader = rows[0]
  return leader && around[0] !== leader ? [leader, ...around] : around
}

/**
 * Seit Seitenleiste v3b E3 (D7) wird der Fuss nicht mehr gerendert. Seine Teile ziehen in die
 * Bereiche der Leiste rechts um:
 * - Protokoll -> Bereich `log` (`LogArea`), erste Zeile die Depesche (`button.dispatch-card`, D27),
 * - Ranglisten-Zeilen -> Bereich `standings` (`StandingsTop`, ueber dem Ranglistenpanel),
 * - Ungelesen-Zaehler -> `rail__item[data-area=standings] .badge` (`Rail.tsx`, D28),
 * - die Knoepfe Diplomatie/Markt/Heer/Spionage/Rangliste -> die Eintraege der Leiste.
 */
export interface LogAreaProps {
  entries: readonly EventEntry[]
  ticksPerDay: number
  onJump: (provinceId: string) => void
  onDispatch: () => void
}

export function LogArea(props: LogAreaProps) {
  const report = latestReport(props.entries)
  return (
    <div className="log-area">
      <button type="button" className="button dispatch-card" onClick={props.onDispatch} disabled={!report} title={report?.text}>
        <span className="dispatch-card__label">{t('foot.dispatch')}</span>
        <span className="dispatch-card__text">{report?.text ?? t('foot.none')}</span>
      </button>
      <EventLog entries={props.entries} ticksPerDay={props.ticksPerDay} onJump={props.onJump} />
    </div>
  )
}

export interface StandingsTopProps {
  rows: readonly StandingsRow[]
}

/** Die Ranglisten-Zeilen des alten Fusses: Platz 1 zuerst, dann vier Zeilen um die eigene Macht. */
export function StandingsTop({ rows }: StandingsTopProps) {
  const ranked = footRowsWithLeader(rows)
  return (
    <section className="foot__standings standings-top" aria-label={t('foot.standings')}>
      <ol className="foot__rows">
        {ranked.map((row) => (
          <li key={row.id} className={row.own ? 'foot__row foot__row--own' : 'foot__row'}>
            <span className="foot__rank">{rows.indexOf(row) + 1}.</span>
            <span className="foot__nation">{row.nation}</span>
            <span className="foot__score">{amount(row.score)}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
