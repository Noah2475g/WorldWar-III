import type { Rules } from '@worldwar/core'
import { currentStep, progressLabel, type TutorialState } from '../game/tutorial.ts'
import { t } from '../i18n/text.ts'
import { firstUnitAt } from '../game/opening.ts'
import { duration } from './format.ts'

/**
 * The guided start, as a hint beside the game (T-M13-02, R-UI-05).
 *
 * Three rules from `game/tutorial.ts` decide the shape of this component, and all three
 * are about staying out of the way: it is not a dialogue, it takes no focus, and it
 * covers nothing that can be clicked. A step ends because the player did the thing, not
 * because they pressed "Weiter" — the only button here is the one that ends the whole
 * thing.
 *
 * Seit T-M21-03 loest diese Komponente die Texte auf, statt sie fertig entgegenzunehmen.
 * Der Grund ist der Wartschritt: sein Satz nennt eine Dauer, und die steht in den Regeln,
 * nicht im Text.
 */

export interface TutorialProps {
  state: TutorialState
  /** Die Regeln der laufenden Partie — sie tragen die Zahlen, die im Text erscheinen. */
  rules: Rules
  ticksPerDay: number
  onDismiss: () => void
}

/**
 * Die Werte, die ein Schritttext einsetzen darf.
 *
 * Nur der Wartschritt braucht welche, und er bekommt sie **gerechnet**, nicht
 * geschrieben: `de.ts:441-443` haelt fuer die Erklaertexte ausdruecklich fest, dass eine
 * Zahl nicht an zwei Orten stehen darf, und fuer eine Fuehrung gilt das doppelt — sie
 * wird gelesen, wenn der Spieler die Regeln noch nicht kennt und ihr also glaubt.
 */
function valuesFor(stepId: string, rules: Rules, ticksPerDay: number): Record<string, string> {
  if (stepId !== 'dayPassed') return {}

  const ticks = firstUnitAt(rules)
  return {
    wait: duration(ticks, ticksPerDay),
    day: String(Math.floor(ticks / ticksPerDay) + 1),
  }
}

export function Tutorial({ state, rules, ticksPerDay, onDismiss }: TutorialProps) {
  const step = currentStep(state)
  if (!step) return null

  const values = valuesFor(step.id, rules, ticksPerDay)

  return (
    <aside className="tutorial" aria-label={t('tutorial.title')}>
      <p className="tutorial__progress">{progressLabel(state)}</p>
      <h3 className="tutorial__title">{t(`tutorial.steps.${step.id}.title`)}</h3>
      <p className="tutorial__text">{t(`tutorial.steps.${step.id}.text`, values)}</p>
      <button type="button" className="button" onClick={onDismiss}>
        {t('tutorial.dismiss')}
      </button>
    </aside>
  )
}
