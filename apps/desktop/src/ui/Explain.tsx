import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { t } from '../i18n/text.ts'
import { isTypingTarget } from '../keyboard.ts'

/**
 * What a thing is, where the thing is (T-M13-11, R-UI-11).
 *
 * A question mark beside a name. Pressed, it says in one or two sentences what the
 * building does, what the unit is for, what the colour on the map means. Closed again,
 * it takes up eleven pixels.
 *
 * Deliberately not a tooltip: a `title` attribute is invisible to the keyboard and to
 * a screen reader's ordinary reading flow, and R-UI-11 asks for both. And deliberately
 * not a manual: a page the player has to go and find is a page they read once and then
 * forget, which is exactly what the requirement is trying to avoid.
 *
 * Ein Popover und kein Block (T-M44-13, R-UX-05/AK3, Befund B-13): der Text liegt ueber der
 * Umgebung (`position: absolute`, app.css), nimmt also keinen Platz — das Fragezeichen im
 * Bauplatzraster schob vorher die Kachel auseinander. Escape schliesst genau ihn (und nur,
 * solange er offen ist) und gibt den Fokus dem Fragezeichen zurueck; ein Druck ausserhalb
 * schliesst ihn auch. Escape gehoert ihm, bevor es die Oberflaeche bekommt: sonst nahme dieselbe
 * Taste das Provinzpanel mit, in dem er steht.
 */

export interface ExplainProps {
  /** The lookup key, e.g. "explain.buildings.barracks". */
  textKey: string
  /** What it is about, for the button's own label: "Was ist eine Kaserne?" */
  subject: string
}

// LOESCHVERMERK (Review): bis T-M44-13 war die Erklaerung ein Block in der Kachel, ohne Escape und ohne Fokusrueckgabe:
//   import { useId, useState } from 'react'
//   <span className="explain">
//   <span className="explain__text" id={id} role="note">
// Jetzt ein Popover (`position: absolute`, app.css) mit Escape, Druck ausserhalb und Fokus zurueck aufs Fragezeichen.
export function Explain({ textKey, subject }: ExplainProps) {
  const [open, setOpen] = useState(false)
  const [alignEnd, setAlignEnd] = useState(false)
  const id = useId()
  const text = t(textKey)
  const root = useRef<HTMLSpanElement>(null)
  const toggle = useRef<HTMLButtonElement>(null)
  const note = useRef<HTMLSpanElement>(null)

  // Offen: Escape und ein Druck ausserhalb schliessen. Geschlossen haengt nichts am Dokument.
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      // Die Taste ist verbraucht: weder die Hotkeys der Hülle noch ein Dialog darunter sehen sie.
      event.stopPropagation()
      // Den Fokus zurückgeben, wohin er auch gewandert ist — außer in ein Eingabefeld daneben:
      // wer dort schreibt, behält den Fokus (Durchsicht B, Befund 4).
      const active = document.activeElement
      const owned = !(isTypingTarget(active) && !root.current?.contains(active))
      setOpen(false)
      if (owned) toggle.current?.focus()
    }
    const onPress = (event: Event) => {
      if (event.target instanceof Node && root.current?.contains(event.target)) return
      setOpen(false)
    }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('pointerdown', onPress, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('pointerdown', onPress, true)
    }
  }, [open])

  // Rechts bündig, wenn er links bündig über den Rand der Leiste hinausragte (die Seitenleiste
  // schneidet ab). Gemessen nach dem Zeichnen, vor dem Bild; ohne Layout (jsdom) bleibt es links.
  useLayoutEffect(() => {
    const element = note.current
    if (!open || !element) return
    const bounds = element.closest('.side, .dialog, .map-area')?.getBoundingClientRect()
    const rect = element.getBoundingClientRect()
    setAlignEnd(Boolean(bounds && rect.width > 0 && rect.right > bounds.right))
  }, [open])

  return (
    <span className="explain" ref={root}>
      <button
        type="button"
        className="explain__toggle"
        ref={toggle}
        aria-expanded={open}
        aria-controls={id}
        aria-label={t('explainUi.about', { subject })}
        onClick={() => setOpen((current) => !current)}
      >
        ?
      </button>
      {open && (
        <span
          className={alignEnd ? 'explain__text explain__text--end' : 'explain__text'}
          id={id}
          role="note"
          ref={note}
        >
          {text}
        </span>
      )}
    </span>
  )
}
