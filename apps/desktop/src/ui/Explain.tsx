import { useId, useState } from 'react'
import { t } from '../i18n/text.ts'

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
 */

export interface ExplainProps {
  /** The lookup key, e.g. "explain.buildings.barracks". */
  textKey: string
  /** What it is about, for the button's own label: "Was ist eine Kaserne?" */
  subject: string
}

export function Explain({ textKey, subject }: ExplainProps) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const text = t(textKey)

  return (
    <span className="explain">
      <button
        type="button"
        className="explain__toggle"
        aria-expanded={open}
        aria-controls={id}
        aria-label={t('explainUi.about', { subject })}
        onClick={() => setOpen((current) => !current)}
      >
        ?
      </button>
      {open && (
        <span className="explain__text" id={id} role="note">
          {text}
        </span>
      )}
    </span>
  )
}
