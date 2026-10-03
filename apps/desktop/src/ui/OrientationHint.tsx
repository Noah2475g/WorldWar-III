import { useState } from 'react'
import { t } from '../i18n/text.ts'

/**
 * „Quer halten empfohlen“ (T-M44-03a, R-UX-05/AK2, Orchestrator-Entscheid F1).
 *
 * Das Telefon hochkant ist seit T-M44-03a bedienbar — die Karte steht oben, die Seitenleiste
 * darunter —, aber die Karte ist dort ein Streifen, und quer hat sie das Vierfache. Der Hinweis
 * sagt das einmal und geht weg. Er ist **keine Sperre**: kein Dialog, kein Fokus, kein Abdunkeln,
 * kein Zeitgeber; wer ihn nicht liest, spielt weiter.
 *
 * Gezeichnet wird er immer, sichtbar nur im Hochformat: `app.css` blendet ihn aus, die Regel unter
 * `(max-width: 599px) and (orientation: portrait)` in `touch.css` zeigt ihn. So braucht es keine
 * Ausrichtungsabfrage in JavaScript, und ein gedrehtes Telefon verliert ihn von selbst.
 */

/** Wo sich der Hinweis merkt, dass er gesehen wurde — je Browser, nicht je Partie. */
export const ORIENTATION_HINT_KEY = 'worldwar.orientationHint.seen'

function wasSeen(): boolean {
  try {
    return globalThis.localStorage?.getItem(ORIENTATION_HINT_KEY) === 'true'
  } catch {
    // Gesperrte Webdaten: der Hinweis erscheint beim naechsten Start wieder, mehr nicht.
    return false
  }
}

function remember(): void {
  try {
    globalThis.localStorage?.setItem(ORIENTATION_HINT_KEY, 'true')
  } catch {
    // Siehe oben.
  }
}

export function OrientationHint() {
  const [dismissed, setDismissed] = useState(wasSeen)
  if (dismissed) return null

  return (
    <div className="orient-hint" role="note">
      <span>{t('orientation.hint')}</span>
      <button
        type="button"
        className="orient-hint__close"
        aria-label={t('orientation.dismiss')}
        title={t('orientation.dismiss')}
        onClick={() => {
          remember()
          setDismissed(true)
        }}
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  )
}
