import { currentStep, progressLabel, type TutorialState } from '../game/tutorial.ts'
import { t } from '../i18n/text.ts'

/**
 * The guided start, as a hint beside the game (T-M13-02, R-UI-05).
 *
 * Three rules from `game/tutorial.ts` decide the shape of this component, and all three
 * are about staying out of the way: it is not a dialogue, it takes no focus, and it
 * covers nothing that can be clicked. A step ends because the player did the thing, not
 * because they pressed "Weiter" — the only button here is the one that ends the whole
 * thing.
 */

export interface TutorialProps {
  state: TutorialState
  onDismiss: () => void
}

export function Tutorial({ state, onDismiss }: TutorialProps) {
  const step = currentStep(state)
  if (!step) return null

  return (
    <aside className="tutorial" aria-label={t('tutorial.title')}>
      <p className="tutorial__progress">{progressLabel(state)}</p>
      <h3 className="tutorial__title">{step.title}</h3>
      <p className="tutorial__text">{step.text}</p>
      <button type="button" className="button" onClick={onDismiss}>
        {t('tutorial.dismiss')}
      </button>
    </aside>
  )
}
