/**
 * Eine Sparkline: ein Sieben-Tage-Fenster als kleine Linie (T-M25-03, R-UI-13, D25.2).
 *
 * Derselbe Bauplan wie das Liniendiagramm: Punktraum 0…100 (viewBox), per CSS auf eine
 * feste schmale Breite gebracht — die Tabellenzelle bleibt schmal und die Seitenleiste
 * scrollt nicht seitwärts (Wächter aus T-M22-02). Normalisiert wird auf die **eigene**
 * Spanne der Werte: die Sparkline zeigt die Richtung, nicht den Maßstab — der Bestand
 * steht als Zahl daneben, und die bleibt der zugängliche Wert (`aria-hidden` hier).
 */

/** Eine Koordinate im Punktraum, auf eine Nachkommastelle gerundet. */
function round1(value: number): string {
  return String(Math.round(value * 10) / 10)
}

/**
 * Die Werte als polyline-Punkte: Minimum unten (100), Maximum oben (0); eine flache
 * Reihe liegt in der Mitte statt am Boden. Unter zwei Werten gibt es keinen Verlauf.
 */
export function sparklinePoints(values: readonly number[]): string {
  if (values.length < 2) return ''
  const min = Math.min(...values)
  const span = Math.max(...values) - min
  return values
    .map((value, index) => {
      const x = round1((index / (values.length - 1)) * 100)
      const y = span === 0 ? '50' : round1(100 - ((value - min) / span) * 100)
      return `${x},${y}`
    })
    .join(' ')
}

export function Sparkline({ values }: { values: readonly number[] }) {
  const points = sparklinePoints(values)
  if (points === '') return null

  return (
    <svg className="sparkline" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <polyline className="sparkline__line" points={points} />
    </svg>
  )
}
