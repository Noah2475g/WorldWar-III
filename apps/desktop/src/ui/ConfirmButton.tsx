import { useEffect, useState } from 'react'

/**
 * Der Knopf mit der Rückfrage: ein zweiter Klick am selben Knopf (T-M44-09a, R-UX-04/AK1,
 * Entscheid F2 vom 2026-10-03).
 *
 * **Warum kein Dialog.** Ein Dialog würde den Blick vom Knopf nehmen, ein Fokusgerüst
 * brauchen und den Spielfluss unterbrechen; hier bleibt die Frage dort, wo die Hand schon ist.
 *
 * **Ablauf.**
 *  1. Erster Klick: nichts wird gesendet. Der Knopf zeigt statt seiner Beschriftung die Folge in
 *     einem Satz (`consequence`) und trägt dieselbe Zeile in eine `aria-live`-Region ein.
 *  2. Zweiter Klick am selben Knopf: `onConfirm` läuft, der Knopf fällt auf seine Beschriftung
 *     zurück.
 *  3. Abbruch: **Escape** (die Taste beantwortet nur die Frage und schließt nicht zugleich den
 *     Dialog darum — erst die zweite schließt ihn) und **Fokusverlust**.
 *
 * **Keine Zeitüberschreitung.** Die Frage bleibt offen, bis der Spieler sich entscheidet (R-FREE,
 * Wächter `no-time-pressure`); ein Rücksetzen nach Sekunden wäre Zeitdruck und, für wen langsam
 * liest oder tastet, ein Knopf, der sich unter der Hand ändert. Der Quelltext enthält darum
 * keinen Zeitgeber, und der Test hält das fest.
 *
 * **Schnittstelle (einfach gehalten — Paket D setzt sie in `Panels.tsx` für T-M44-09b ein):**
 * ```tsx
 * <ConfirmButton
 *   label={beschriftung}                               // Text im Ruhezustand, aus de.ts
 *   consequence={folgesatz}                            // ganzer Satz aus de.ts: nennt die Folge UND,
 *                                                      // dass noch einmal geklickt wird
 *   onConfirm={() => run(befehl)}                      // läuft erst beim zweiten Klick
 *   className="button"                                 // optional, Vorgabe „button“
 *   disabled={…}                                       // optional; ein gesperrter Knopf fragt nie
 * />
 * ```
 * Der Satz gehört in `de.ts` (Wächter `prose-in-code`), mit Umlauten. Der Knopf rendert neben dem
 * `<button>` eine unsichtbare Geschwisterzeile (`role="status"`); er braucht also einen Elternteil,
 * in dem ein zusätzliches, unsichtbares Element nichts verschiebt (Flex- oder Blockkontext, kein
 * `:first-child`/`:last-child`-Selektor auf dem Knopf).
 */
export function ConfirmButton({
  label,
  consequence,
  onConfirm,
  className = 'button',
  disabled = false,
}: {
  label: string
  consequence: string
  onConfirm: () => void
  className?: string
  disabled?: boolean
}) {
  const [armed, setArmed] = useState(false)

  // Ein gesperrter Knopf vergisst eine offene Frage: wird er wieder frei, fragt er von vorn.
  useEffect(() => {
    if (disabled) setArmed(false)
  }, [disabled])

  return (
    <>
      <button
        type="button"
        className={armed ? `${className} button--confirm` : className}
        disabled={disabled}
        onClick={(event) => {
          if (armed) {
            setArmed(false)
            onConfirm()
            return
          }
          // Safari und Firefox auf dem Mac geben einem Knopf beim Klick keinen Fokus; ohne ihn
          // käme der Fokusverlust nie und die Frage bliebe beim Wegklicken stehen.
          event.currentTarget.focus()
          setArmed(true)
        }}
        onBlur={() => setArmed(false)}
        onKeyDown={(event) => {
          if (!armed || event.key !== 'Escape') return
          // Nur die Frage beantworten: weder der Dialog darum noch die Tastenbelegung der
          // Seite sehen diese Taste.
          event.preventDefault()
          event.stopPropagation()
          setArmed(false)
        }}
      >
        {armed ? consequence : label}
      </button>
      <span className="visually-hidden" role="status" aria-live="polite">
        {armed ? consequence : ''}
      </span>
    </>
  )
}
