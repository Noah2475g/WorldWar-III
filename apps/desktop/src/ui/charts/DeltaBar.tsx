/**
 * Ein ±-Balken für eine Bilanz (T-M25-03/-04, R-UI-05, D25.2).
 *
 * EINE Komponente, zweimal verwendet: die Wirtschaftstabelle und der Tagesbericht
 * zeigen dieselben Balken, nicht zwei Kopien. Positiv wächst er von der Mitte nach
 * rechts (grün), negativ nach links (zinnober — der Signalton, hier zu Recht: eine
 * negative Bilanz ist die Zahl, die rot werden darf), null ist ein Strich.
 *
 * Der Balken ist ein **Bild ohne Stimme** (`aria-hidden`): die Zahl daneben bleibt der
 * zugängliche Wert. Und er trägt keine eigene Farbe — die Klassen zeigen auf die
 * Token in `app.css`, wie überall (R-UI-02).
 */

/**
 * Die halbe Spur (50 %) gehört dem größten Betrag; alles andere skaliert dagegen.
 * Ein winziger Wert bleibt mit 2 % sichtbar, statt auf null gerundet zu verschwinden —
 * und null selbst hat keine Breite: sie wird als Strich gezeichnet, nicht als Balken.
 */
export function deltaWidth(value: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || value === 0 || max <= 0) return 0
  const width = Math.min(50, (Math.abs(value) / max) * 50)
  return Math.max(2, Math.round(width * 10) / 10)
}

export function DeltaBar({ value, max }: { value: number; max: number }) {
  const width = deltaWidth(value, max)

  return (
    <span className="delta" aria-hidden="true">
      {width === 0 ? (
        <span className="delta__zero" />
      ) : (
        <span
          className={`delta__fill delta__fill--${value > 0 ? 'plus' : 'minus'}`}
          style={value > 0 ? { left: '50%', width: `${width}%` } : { right: '50%', width: `${width}%` }}
        />
      )}
    </span>
  )
}
