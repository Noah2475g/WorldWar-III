import { NationName } from '../Nation.tsx'

/**
 * Ein Liniendiagramm im Stil der Lagekarte (T-M25-02, R-UI-13, D25.2).
 *
 * Eigene SVG-Komponente, keine Fremdbibliothek — die Leitplanke aus LEVEL-UP 2. Der
 * Pfadraum ist 0…100 in beiden Achsen (das viewBox-Rechteck), gestreckt per CSS mit
 * `preserveAspectRatio="none"`; die Striche bleiben dank `vector-effect:
 * non-scaling-stroke` gleich dünn. So ist die Rechnung mit bloßem Auge nachprüfbar,
 * und ein Test bindet exakte Koordinaten statt an Pixeln zu raten.
 *
 * Farben kommen als **Daten** aus der Sicht (Spielerfarben), nie als Literal aus dem
 * Quelltext — dieselbe Regel wie beim Farbfeld der Mächtetabelle (`Nation.tsx`).
 * Fürs Ohr trägt das Bild eine aria-Beschreibung mit den Endwerten; die Legende
 * darunter nennt jede Reihe mit ihrem Farbfeld.
 */

export interface ChartPoint {
  day: number
  value: number
}

/**
 * Die Rolle einer Reihe (T-M31-04, D27.6): eigen mit Flaeche, Feind und Verbuendeter
 * als benannte Linien, alles andere duenn und ohne Namen. Ohne Rolle gilt die Reihe
 * als benannt — so bleiben aeltere Aufrufer unveraendert.
 */
export type ChartRole = 'own' | 'enemy' | 'ally' | 'other'

export interface ChartSeries {
  id: string
  label: string
  /** Farbwert — aus der Sicht oder aus den Tokens je Rolle; nie ein Literal. */
  color: string
  role?: ChartRole
  points: readonly ChartPoint[]
}

export interface ChartDomain {
  minDay: number
  maxDay: number
  minValue: number
  maxValue: number
}

/**
 * Die gemeinsame Spanne aller Reihen — von min−Rand bis max+Rand (T-M28-01, D26.1).
 *
 * Bis M27 begann die Y-Skala bei 0: acht Tage Historie mit Punkteständen von 2 800
 * bis 10 000 ergaben flache, ans obere Fünftel gedrängte Linien. Die Skala umfasst
 * jetzt nur die tatsächliche Wertspanne plus ein Zehntel Rand je Seite; der Rand ist
 * nie unter eins, damit eine flache Reihe in der Mitte liegt statt durch null zu teilen.
 */
export function chartDomain(series: readonly ChartSeries[]): ChartDomain {
  let minDay = Infinity
  let maxDay = -Infinity
  let low = Infinity
  let high = -Infinity
  for (const line of series) {
    for (const point of line.points) {
      if (point.day < minDay) minDay = point.day
      if (point.day > maxDay) maxDay = point.day
      if (point.value < low) low = point.value
      if (point.value > high) high = point.value
    }
  }
  if (!Number.isFinite(low)) return { minDay, maxDay, minValue: 0, maxValue: 1 }
  const pad = Math.max((high - low) / 10, 1)
  return { minDay, maxDay, minValue: low - pad, maxValue: high + pad }
}

/** Eine Koordinate im Pfadraum, auf eine Nachkommastelle gerundet. */
function round1(value: number): string {
  return String(Math.round(value * 10) / 10)
}

/**
 * Die Punkte einer Reihe als SVG-Pfad im 0…100-Raum: Tage von links nach rechts,
 * Werte von unten (minValue) nach oben (maxValue) — seit T-M28-01 gegen die untere
 * Skalengrenze gerechnet, nicht gegen null. Unter zwei Punkten gibt es keinen Pfad —
 * ein einzelner Punkt ist keine Kurve.
 */
export function linePath(points: readonly ChartPoint[], domain: ChartDomain): string {
  if (points.length < 2 || domain.maxDay <= domain.minDay) return ''
  if (domain.maxValue <= domain.minValue) return ''
  const span = domain.maxDay - domain.minDay
  const valueSpan = domain.maxValue - domain.minValue
  return points
    .map((point, index) => {
      const x = round1(((point.day - domain.minDay) / span) * 100)
      const y = round1(100 - ((point.value - domain.minValue) / valueSpan) * 100)
      return `${index === 0 ? 'M' : 'L'}${x},${y}`
    })
    .join(' ')
}

export function LineChart({ series, ariaLabel }: { series: readonly ChartSeries[]; ariaLabel: string }) {
  const domain = chartDomain(series)
  if (domain.maxDay <= domain.minDay) return null

  const drawn = series.filter((line) => line.points.length >= 2)
  const valueSpan = domain.maxValue - domain.minValue
  const featured = (line: ChartSeries): boolean => line.role !== 'other'
  // Duenne Linien zuerst, damit die benannten obenauf liegen.
  const ordered = [...drawn].sort((a, b) => Number(featured(a)) - Number(featured(b)))
  const endX = (line: ChartSeries): string => round1(((line.points[line.points.length - 1]!.day - domain.minDay) / (domain.maxDay - domain.minDay)) * 100)
  const endY = (line: ChartSeries): string => round1(100 - ((line.points[line.points.length - 1]!.value - domain.minValue) / valueSpan) * 100)

  return (
    <figure className="chart">
      <div className="chart__frame">
        <svg className="chart__plot" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={ariaLabel}>
          {/* Die eigene Kurve traegt eine Flaeche bis zum unteren Rand (T-M31-04). */}
          {ordered
            .filter((line) => line.role === 'own')
            .map((line) => (
              <path
                key={`area-${line.id}`}
                className="chart__area"
                data-series={line.id}
                d={`${linePath(line.points, domain)} L${endX(line)},100 L0,100 Z`}
                style={{ fill: line.color }}
              />
            ))}
          {ordered.map((line) => (
            <path
              key={line.id}
              className={featured(line) ? 'chart__line' : 'chart__line chart__line--thin'}
              data-series={line.id}
              d={linePath(line.points, domain)}
              style={{ stroke: line.color }}
            />
          ))}
          {/* Der Endpunkt je benannter Linie — markiert, wo die Kurve heute steht. */}
          {ordered.filter(featured).map((line) => (
            <circle
              key={`end-${line.id}`}
              className="chart__end"
              data-series={line.id}
              cx={endX(line)}
              cy={endY(line)}
              r={1.6}
              style={{ fill: line.color }}
            />
          ))}
        </svg>
        {/* Der Endwert je benannter Linie am rechten Rand (T-M28-01, D26.1): der Rand der
            Skala (ein Zehntel je Seite) hält die Beschriftung im Bild. Stumm fürs Ohr — die
            aria-Beschreibung des Bildes nennt die Endwerte bereits mit Namen. */}
        {drawn.filter(featured).map((line) => {
          const last = line.points[line.points.length - 1]!
          const top = round1(100 - ((last.value - domain.minValue) / valueSpan) * 100)
          return (
            <span
              key={line.id}
              className="chart__endvalue"
              data-series={line.id}
              style={{ top: `${top}%`, color: line.color }}
              aria-hidden="true"
            >
              {Math.round(last.value)}
            </span>
          )
        })}
      </div>
      <figcaption className="chart__legend">
        {series.filter(featured).map((line) => (
          <NationName key={line.id} color={line.color}>
            {line.label}
          </NationName>
        ))}
      </figcaption>
    </figure>
  )
}
