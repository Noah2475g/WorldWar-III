import { t } from '../i18n/text.ts'
import { CREDITS } from './glyphs.ts'
import { Dialog } from './Dialogs.tsx'

/**
 * Die Mitwirkenden (T-M46-13): die Namensnennung, die CC BY 3.0 fuer die Symbole von
 * game-icons.net verlangt — Urheber, Lizenz, Quelle — im Spiel selbst. Die Liste kommt aus
 * `CREDITS` und damit aus derselben Stelle wie die Symbole.
 */
export function CreditsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title={t('menu.credits')} onClose={onClose}>
      <p className="muted">{t('menu.creditsIntro')}</p>
      <ul className="credits">
        {CREDITS.map((credit) => (
          <li key={credit.work}>
            <strong>{credit.work}</strong> — {credit.author}, {credit.license}
            <br />
            <span className="muted">{credit.source}</span>
          </li>
        ))}
      </ul>
    </Dialog>
  )
}
