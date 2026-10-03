import { useLayoutEffect, useRef, useState } from 'react'
import type { Rules } from '@worldwar/core'
import { TUTORIAL_TARGETS, currentStep, progressLabel, type TutorialState } from '../game/tutorial.ts'
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
 * Der Wartschritt und der Ausdehnungsschritt brauchen welche, und sie bekommen sie
 * **gerechnet**, nicht geschrieben: `de.ts` haelt fuer die Erklaertexte ausdruecklich
 * fest, dass eine Zahl nicht an zwei Orten stehen darf, und fuer eine Fuehrung gilt das
 * doppelt — sie wird gelesen, wenn der Spieler die Regeln noch nicht kennt und ihr also
 * glaubt.
 */
function valuesFor(stepId: string, rules: Rules, ticksPerDay: number): Record<string, string> {
  if (stepId === 'dayPassed') {
    const ticks = firstUnitAt(rules)
    return {
      wait: duration(ticks, ticksPerDay),
      day: String(Math.floor(ticks / ticksPerDay) + 1),
    }
  }

  if (stepId === 'expansion') {
    // Festkomma: 1000 = 1,0 — die Strafe steht in Zielmoral-Punkten im Satz (T-M24-02).
    return {
      third: String(rules.constants.expansionFreeProvinces + 1),
      penalty: String(rules.constants.expansionPenaltyPerProvince / 1000),
    }
  }

  return {}
}

/**
 * Deckt die Einfuehrung das Element, von dem der Schritt spricht (T-M44-14, R-UX-05/AK2)?
 * Dann wechselt sie die Kante: `data-dodge="top"`, und das Stylesheet setzt sie an den oberen
 * Rand der Flaeche. Gemessen wird nach jedem Zeichnen und bei Groessenaenderung, nicht einmal
 * beim Einblenden — die Seitenleiste liegt je nach Fenster anderswo. Ausgewichen bleibt sie bis
 * zum naechsten Schritt.
 */
function useDodge(stepId: string | undefined) {
  const ref = useRef<HTMLElement>(null)
  const [dodge, setDodge] = useState(false)

  // Ein neuer Schritt beginnt an seinem Platz.
  useLayoutEffect(() => setDodge(false), [stepId])

  useLayoutEffect(() => {
    const selector = stepId ? TUTORIAL_TARGETS[stepId] : null
    const measure = (): void => {
      const own = ref.current
      if (!own || !selector) return setDodge(false)
      const target = [...document.querySelectorAll(selector)].find((el) => !own.contains(el))
      if (!target) return setDodge(false)
      const a = own.getBoundingClientRect()
      const b = target.getBoundingClientRect()
      // Einmal ausgewichen, bleibt sie oben, bis der Schritt wechselt: wer nach dem Wechsel
      // wieder deckte, wuerde zurueckspringen und nie zur Ruhe kommen.
      setDodge((current) => current || (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  })

  return { ref, dodge }
}

export function Tutorial({ state, rules, ticksPerDay, onDismiss }: TutorialProps) {
  const step = currentStep(state)
  const { ref, dodge } = useDodge(step?.id)
  if (!step) return null

  const values = valuesFor(step.id, rules, ticksPerDay)

  return (
    <aside className="tutorial" ref={ref} data-dodge={dodge ? 'top' : undefined} aria-label={t('tutorial.title')}>
      <p className="tutorial__progress">{progressLabel(state)}</p>
      <h3 className="tutorial__title">{t(`tutorial.steps.${step.id}.title`)}</h3>
      <p className="tutorial__text">{t(`tutorial.steps.${step.id}.text`, values)}</p>
      {/* Das Wozu (T-M24-02): der Satz, der den Schritt begruendet — leiser gesetzt,
          damit die Handlungsanweisung darueber die Stimme behaelt. */}
      <p className="tutorial__why">{t(`tutorial.steps.${step.id}.why`)}</p>
      <button type="button" className="button" onClick={onDismiss}>
        {t('tutorial.dismiss')}
      </button>
    </aside>
  )
}
