import { t, num } from '../i18n/text.ts'

/**
 * Turning game numbers into readable ones (T-M10-04, T-M10-05).
 *
 * Every quantity in the core is fixed-point with three decimals; every quantity on
 * screen is a rounded figure with a unit. The conversion happens here and nowhere
 * else — a component that divides by a thousand on its own is a component that will
 * one day forget to.
 */

/** The core's fixed-point scale: three decimals. */
export const FIXED = 1000

/** Fixed-point to a plain number. */
export function unfix(value: number): number {
  return value / FIXED
}

/** A resource amount as the player sees it: whole units, grouped. */
export function amount(fixed: number): string {
  return num(Math.round(unfix(fixed)))
}

/**
 * Ein Kurs: Geld je Einheit (T-M32-02).
 *
 * Kein Festkomma — der Kurs ist ein Verhaeltnis zweier Festkommazahlen, und das
 * Tausendstel kuerzt sich heraus. Zwei Nachkommastellen, weil die Kurse nahe 1 liegen.
 */
export function price(value: number): string {
  return value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * A rate, always signed.
 *
 * The sign is the point: "+42" and "−17" are read at a glance, "42" needs a moment to
 * work out which way the balance is going.
 */
export function rate(fixed: number): string {
  const value = Math.round(unfix(fixed))
  if (value === 0) return '±0'
  return value > 0 ? `+${num(value)}` : `−${num(Math.abs(value))}`
}

/**
 * Population, shortened where the exact figure is noise: 1,24 Mio.
 *
 * The core counts people in fixed-point thousands (production.ts: 300 000 is a
 * reference population of three hundred thousand), so the raw figure *is* the number
 * of people. Dividing it by a thousand, as the first version did, showed a province
 * of nine hundred thousand as "900".
 */
export function population(fixed: number): string {
  const people = fixed
  if (people >= 1_000_000) return `${(people / 1_000_000).toLocaleString('de-DE', { maximumFractionDigits: 2 })} Mio`
  if (people >= 1_000) return `${Math.round(people / 1000)} Tsd`
  return num(Math.round(people))
}

/** A percentage from a 0…100 game value. */
export function percent(value: number): string {
  return `${Math.round(value)} %`
}

export interface GameTime {
  day: number
  hour: number
}

/** Ticks are game hours; the calendar starts on day 1 at midnight. */
export function gameTime(tick: number, ticksPerDay: number): GameTime {
  return { day: Math.floor(tick / ticksPerDay) + 1, hour: tick % ticksPerDay }
}

/** "Tag 34 · 06:00" — the header's clock. */
export function formatTime(tick: number, ticksPerDay: number): string {
  const { day, hour } = gameTime(tick, ticksPerDay)
  return `${t('header.day')} ${num(day)} · ${String(hour).padStart(2, '0')}:00`
}

/**
 * A duration in game hours, as hours below a day and as days above it.
 *
 * "36 h" is a number to convert; "1,5 Tage" is a decision. Above a day the player is
 * thinking in days, so that is what the interface says.
 */
export function duration(hours: number, ticksPerDay = 24): string {
  return durationIn('actions.days', hours, ticksPerDay)
}

/**
 * Dieselbe Dauer im Dativ: „nach 2 Tagen", nicht „nach 2 Tage" (T-M23-02, V2-11).
 *
 * Nur die Mehrzahl beugt sich — „1 Tag" und „14 h" sind im Dativ dieselben Wörter.
 * Für Sätze mit „nach", „in", „seit"; die Kopfleiste nutzt sie für den Vorspul-Halt.
 */
export function durationDative(hours: number, ticksPerDay = 24): string {
  return durationIn('actions.daysDative', hours, ticksPerDay)
}

function durationIn(daysKey: 'actions.days' | 'actions.daysDative', hours: number, ticksPerDay: number): string {
  if (hours < ticksPerDay) return t('actions.hours', { count: Math.max(0, Math.round(hours)) })
  const days = hours / ticksPerDay
  const rounded = days >= 10 ? Math.round(days) : Math.round(days * 10) / 10
  // One day is singular; "1 Tage" is the kind of slip a player notices before anything else.
  if (rounded === 1) return t('actions.day', { count: 1 })
  return t(daysKey, { count: rounded.toLocaleString('de-DE') })
}

/** When a march will arrive, said as a time rather than as a countdown. */
export function arrival(nowTick: number, arrivalTick: number, ticksPerDay: number): string {
  const { day, hour } = gameTime(arrivalTick, ticksPerDay)
  const inHours = arrivalTick - nowTick
  if (inHours <= 0) return t('army.idle')
  if (inHours < ticksPerDay) return t('army.arrivesIn', { hours: Math.round(inHours) })
  return t('army.arrivesAt', { day: num(day), hour: String(hour).padStart(2, '0') })
}

/**
 * How much longer something has to run: "noch 6 h", "noch 2 Tage" (T-M13-07).
 *
 * The counterpart to `arrival`, which names a point in time. A progress bar is asking a
 * different question — not "when does it land" but "how much of my patience is left" —
 * and for that a duration reads faster than a date.
 */
export function remaining(nowTick: number, endTick: number, ticksPerDay: number): string {
  const hours = Math.max(0, endTick - nowTick)
  if (hours === 0) return t('meter.done')
  if (hours < ticksPerDay) return t('meter.remaining', { time: t('time.hours', { hours: Math.round(hours) }) })
  const days = Math.round((hours / ticksPerDay) * 10) / 10
  return t('meter.remaining', { time: t('time.days', { days: days.toLocaleString('de-DE') }) })
}

/**
 * How many game days a stock lasts at the current balance (T-M13-14, R-UI-09).
 *
 * Null while the balance is positive: a stock that is growing has no range, and a
 * figure like "reicht 4000 Tage" is noise pretending to be information. The question
 * this answers is the only one a red balance raises — how long have I got.
 */
export function reachInDays(stock: number, balancePerDay: number): number | null {
  if (balancePerDay >= 0 || stock <= 0) return null
  return stock / Math.abs(balancePerDay)
}

/** Below this many days of stock left, a resource is a shortage rather than a figure. */
export const SHORT_REACH_DAYS = 3

/**
 * Wie die Reichweite gerundet wird — einmal, fuer die kurze und die lange Fassung.
 *
 * Beide nennen dieselbe Zahl, weil sie gleichzeitig auf dem Bildschirm stehen: die
 * Kurzfassung in der Leiste, die lange im Tooltip derselben Zelle. Zwei Rundungen
 * hiessen zwei Zahlen fuer denselben Vorrat.
 */
function roundedDays(days: number): string {
  const rounded = days < 10 ? Math.round(days * 10) / 10 : Math.round(days)
  return rounded.toLocaleString('de-DE')
}

/** "noch 2 Tage" — the range of a stock, rounded the way a player thinks about it. */
export function reachText(days: number): string {
  return t('meter.remaining', { time: t('time.days', { days: roundedDays(days) }) })
}

/**
 * Dieselbe Reichweite in Leistenbreite: „6 T" (T-M36-02, ROHSTOFFE.md D36.2).
 *
 * Sichtbar ist sie nur, solange ein Vorrat draengt — dann ist sie die Auskunft, nach
 * der gehandelt wird. Vorher stand dort die Tagesbilanz, die an einem ruhigen Tag
 * keine Entscheidung traegt und den Blick trotzdem kostet.
 */
export function reachShort(days: number): string {
  return t('header.reachDays', { days: roundedDays(days) })
}

/** A list of costs: "750 Geld, 400 Eisen". */
export function costs(entries: Partial<Record<string, number>>): string {
  return Object.entries(entries)
    .filter(([, value]) => (value ?? 0) > 0)
    .map(([key, value]) => `${amount(value ?? 0)} ${t(`resources.${key}`)}`)
    .join(', ')
}

/**
 * What is missing for an action, for the rejection text.
 *
 * Only the shortfall, not the whole bill: a player who is told "es fehlen 400 Eisen"
 * knows what to do, one who is told the full price has to work out the difference.
 */
export function missing(
  needed: Partial<Record<string, number>>,
  available: Partial<Record<string, number>>,
): string {
  const short = Object.entries(needed)
    .map(([key, value]) => [key, (value ?? 0) - (available[key] ?? 0)] as const)
    .filter(([, gap]) => gap > 0)
    .map(([key, gap]) => `${amount(gap)} ${t(`resources.${key}`)}`)

  return short.join(', ')
}
