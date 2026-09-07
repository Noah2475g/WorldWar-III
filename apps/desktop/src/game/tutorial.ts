import { t } from '../i18n/text.ts'

/**
 * The five steps of a first game (T-M12-02b).
 *
 * A guided start, and three rules about it that matter more than the content:
 *
 *  - It never blocks input. A step is a hint beside the game, not a door in front of
 *    it. A player who wants to ignore it plays on and the hint gets out of the way.
 *  - It appears only in the first game, and remembers that it did.
 *  - It can be switched off in the middle, and stays off.
 *
 * A tutorial that fails any of those is a tutorial people resent, and this game's whole
 * premise is not wasting the player's time.
 */

export interface TutorialStep {
  id: string
  title: string
  text: string
  /** What the player has to do for the step to complete itself. */
  completesOn: 'selectProvince' | 'openBuild' | 'setSpeed' | 'fastForward' | 'openEvents'
}

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    id: 'select',
    title: t('tutorial.steps.select.title'),
    text: t('tutorial.steps.select.text'),
    completesOn: 'selectProvince',
  },
  {
    id: 'build',
    title: t('tutorial.steps.build.title'),
    text: t('tutorial.steps.build.text'),
    completesOn: 'openBuild',
  },
  {
    id: 'speed',
    title: t('tutorial.steps.speed.title'),
    text: t('tutorial.steps.speed.text'),
    completesOn: 'setSpeed',
  },
  {
    id: 'fastForward',
    title: t('tutorial.steps.fastForward.title'),
    text: t('tutorial.steps.fastForward.text'),
    completesOn: 'fastForward',
  },
  {
    id: 'events',
    title: t('tutorial.steps.events.title'),
    text: t('tutorial.steps.events.text'),
    completesOn: 'openEvents',
  },
]

export interface TutorialState {
  /** Index of the current step, or null when the tutorial is done or switched off. */
  step: number | null
  /** Set once the player has finished or dismissed it — it never comes back. */
  seen: boolean
}

export const TUTORIAL_START: TutorialState = { step: 0, seen: false }
export const TUTORIAL_OFF: TutorialState = { step: null, seen: true }

/** What a fresh installation gets: the tutorial on. A returning player: nothing. */
export function initialTutorial(seenBefore: boolean): TutorialState {
  return seenBefore ? TUTORIAL_OFF : TUTORIAL_START
}

/** Advances the tutorial when the player does the thing the current step asks for. */
export function advance(state: TutorialState, action: TutorialStep['completesOn']): TutorialState {
  if (state.step === null) return state

  const current = TUTORIAL_STEPS[state.step]
  if (!current || current.completesOn !== action) return state

  const next = state.step + 1
  return next >= TUTORIAL_STEPS.length ? { step: null, seen: true } : { step: next, seen: false }
}

/** Switched off in the middle — and it stays off. */
export function dismiss(): TutorialState {
  return TUTORIAL_OFF
}

export function currentStep(state: TutorialState): TutorialStep | null {
  return state.step === null ? null : (TUTORIAL_STEPS[state.step] ?? null)
}

/** Progress as "Schritt 2 von 5", so the player knows how much is left. */
export function progressLabel(state: TutorialState): string {
  if (state.step === null) return ''
  return t('tutorial.progress', { step: state.step + 1, total: TUTORIAL_STEPS.length })
}

/** Where the tutorial's memory lives. */
export const TUTORIAL_STORAGE_KEY = 'worldwar.tutorial.seen'

export function tutorialTitle(): string {
  return t('app.title')
}
