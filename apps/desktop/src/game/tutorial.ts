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
    title: 'Ihre Provinzen',
    text: 'Klicken Sie eine Ihrer Provinzen an. Rechts stehen Moral, Bevölkerung und was im Boden liegt.',
    completesOn: 'selectProvince',
  },
  {
    id: 'build',
    title: 'Etwas bauen',
    text: 'Jeder Knopf nennt vorher Kosten und Dauer. Was Sie sich nicht leisten können, ist ausgegraut — mit dem Grund daneben.',
    completesOn: 'openBuild',
  },
  {
    id: 'speed',
    title: 'Die Zeit läuft',
    text: 'Die Leertaste startet und stoppt. Die Zahlen sind Spielstunden je Sekunde — bei 10 vergeht ein Spieltag in gut zwei Sekunden.',
    completesOn: 'setSpeed',
  },
  {
    id: 'fastForward',
    title: 'Vorspulen',
    text: 'Für längere Strecken: läuft, bis etwas passiert, das Sie sehen müssen — und sagt dann, was es war.',
    completesOn: 'fastForward',
  },
  {
    id: 'events',
    title: 'Was geschieht',
    text: 'Unten stehen die Ereignisse. Rot heißt hinsehen; ein Klick springt zu der Provinz, um die es geht.',
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
  return `Schritt ${state.step + 1} von ${TUTORIAL_STEPS.length}`
}

/** Where the tutorial's memory lives. */
export const TUTORIAL_STORAGE_KEY = 'worldwar.tutorial.seen'

export function tutorialTitle(): string {
  return t('app.title')
}
