import type { PublicView } from '@worldwar/core'
import { t } from '../i18n/text.ts'
import { amount } from './format.ts'
import { Meter } from './Meter.tsx'

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
        score: other.score,
        relation: t(`diplomacy.${view.relations[other.id]?.state ?? 'peace'}`),
        seenStrength: seen.get(other.id) ?? 0,
        own: false,
      })),
  ]

  return rows.sort((a, b) => b.score - a.score)
}

export function StandingsPanel({ view, nameOf }: { view: PublicView | null; nameOf: (id: string) => string }) {
  const rows = standingsRows(view, nameOf)
  if (rows.length === 0) return null

  const leader = Math.max(...rows.map((row) => row.score), 1)

  return (
    <section className="panel" aria-label={t('standings.title')}>
      <h2>{t('standings.title')}</h2>
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
              <td>{row.nation}</td>
              <td>
                {/* Gegen den Fuehrenden, nicht gegen eine Zahl aus dem Nichts: so sieht
                    man den Abstand, nicht nur den eigenen Stand. */}
                <Meter
                  label={row.nation}
                  value={row.score}
                  max={leader}
                  text={String(Math.round(row.score))}
                  tone={row.own ? 'good' : 'neutral'}
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
}: {
  view: PublicView
  nameOf: (id: string) => string
  ticksPerDay: number
  onClose: () => void
}) {
  const winner = view.victory.winner
  const own = winner === view.playerId
  const provinces = view.provinces.filter((province) => province.owner === view.playerId).length

  return (
    <div className="dialog-backdrop">
      <div className="dialog" role="dialog" aria-modal="true" aria-label={t('standings.victoryTitle')}>
        <div className="dialog__head">
          <h2>{t('standings.victoryTitle')}</h2>
        </div>
        <div className="dialog__body">
          <p className={own ? 'state' : 'state state--war'}>
            {own ? t('standings.won') : t('standings.lost', { nation: winner ? nameOf(winner) : '—' })}
          </p>
          <p className="facts__inline">
            {t('standings.summary', {
              day: Math.floor(view.tick / ticksPerDay) + 1,
              points: Math.round(view.self.score),
              provinces,
            })}
          </p>
          <div className="actions">
            <button type="button" className="button button--primary" onClick={onClose}>
              {t('standings.close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
