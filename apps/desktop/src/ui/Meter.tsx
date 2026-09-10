import { t } from '../i18n/text.ts'

/**
 * A bounded value as a bar (T-M13-06, R-UI-09).
 *
 * The bar exists so that a value can be compared without being read — morale against
 * morale, progress against progress. Two rules keep it from becoming decoration:
 *
 *  - It stays a value. `role="meter"` with its three numbers, and the figure written
 *    out beside it. A picture of a number that a screen reader cannot read is worse
 *    than the number was.
 *  - It has no colours of its own. The tone picks a class; the class picks a token
 *    from the approved palette (D18.1). No component in this project writes a colour.
 */

export type MeterTone = 'neutral' | 'good' | 'warn' | 'alert'
export type Trend = 'up' | 'down' | null

/** How full the track is, 0…1. Anything outside the range is clamped, not drawn past. */
export function fillFraction(value: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0
  return Math.min(1, Math.max(0, value / max))
}

/**
 * Where a value is heading, given where it is going to end up.
 *
 * Below half a percent of the scale there is no trend: morale drifts by a seventh of
 * the gap per day, and an arrow that flickers between up and down on rounding noise
 * tells the player less than no arrow at all.
 *
 * `scale` has no default on purpose. Morale is fixed-point (0…100 000) in the core and
 * a percentage (0…100) once formatted, and a default would silently be right for one
 * of them and wrong for the other — this test suite caught exactly that.
 */
export function trendOf(value: number, target: number | undefined, scale: number): Trend {
  if (target === undefined) return null
  const difference = target - value
  if (Math.abs(difference) < scale / 200) return null
  return difference > 0 ? 'up' : 'down'
}

export interface MeterProps {
  label: string
  value: number
  max: number
  /** The figure as the player reads it: "70 %", "3 von 8", "Tag 12". */
  text: string
  tone?: MeterTone
  trend?: Trend
  /**
   * Blendet die Beschriftung fuers Auge aus, nicht fuers Ohr.
   *
   * In einer Tabelle steht der Name schon in der ersten Spalte; ein Balken, der ihn
   * wiederholt, sagt dasselbe zweimal — fuer ein Vorleseprogramm bleibt er trotzdem
   * noetig, sonst ist der Balken ein namenloser Wert.
   */
  labelHidden?: boolean
  /**
   * Zeichnet die Spur als n Segmente statt als Fuellung (T-M29-03, D27.6): die Moral
   * in zehn Stufen liest sich auf einen Blick als "vier von zehn", wo ein glatter
   * Balken nur "etwas unter der Haelfte" sagt. Wert und Rolle bleiben dieselben.
   */
  segments?: number
}

const TREND_TEXT: Record<'up' | 'down', string> = {
  up: 'steigend',
  down: 'fallend',
}

const TREND_MARK: Record<'up' | 'down', string> = {
  up: '▲',
  down: '▼',
}

export function Meter({
  label,
  value,
  max,
  text,
  tone = 'neutral',
  trend = null,
  labelHidden = false,
  segments,
}: MeterProps) {
  const fraction = fillFraction(value, max)
  const spoken = trend ? `${label}: ${text}, ${TREND_TEXT[trend]}` : `${label}: ${text}`

  return (
    <div
      className="meter"
      role="meter"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuetext={spoken}
      title={spoken}
    >
      {/* Bei labelHidden faellt der Textknoten ganz weg (T-M23-02, V2-17): das
          aria-label oben nennt den Balken fuers Ohr bereits — ein versteckter Knoten
          dazu liess Vorleseprogramme und Textauszuege den Namen doppelt lesen
          („Indien Indien 6148"). */}
      {!labelHidden && <span className="meter__label">{label}</span>}
      {segments ? (
        <span className={`meter__segments meter__segments--${tone}`}>
          {Array.from({ length: segments }, (_, index) => (
            <i
              key={index}
              className={index < Math.round(fraction * segments) ? 'meter__segment meter__segment--on' : 'meter__segment'}
            />
          ))}
        </span>
      ) : (
        <span className="meter__track">
          <span className={`meter__fill meter__fill--${tone}`} style={{ width: `${Math.round(fraction * 100)}%` }} />
        </span>
      )}
      <span className="meter__value">
        {text}
        {trend && (
          <span className={`meter__trend meter__trend--${trend}`}>
            {TREND_MARK[trend]}
            <span className="visually-hidden"> {TREND_TEXT[trend]}</span>
          </span>
        )}
      </span>
    </div>
  )
}

/** The tone a share of something deserves: plenty is good, a sliver is an alarm. */
export function toneForShare(fraction: number): MeterTone {
  if (fraction >= 0.5) return 'good'
  if (fraction >= 0.25) return 'warn'
  return 'alert'
}

/** A bar for a stretch of game time that is running out or filling up. */
export function progressText(done: number, total: number): string {
  return t('meter.progress', { percent: Math.round(fillFraction(done, total) * 100) })
}
