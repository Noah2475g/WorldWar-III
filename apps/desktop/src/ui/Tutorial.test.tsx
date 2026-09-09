// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Tutorial } from './Tutorial.tsx'
import { TEST_RULES } from '@worldwar/testkit'
import { TUTORIAL_START, TUTORIAL_STEPS, advance, dismiss } from '../game/tutorial.ts'
import { t } from '../i18n/text.ts'
import { firstUnitAt } from '../game/opening.ts'
import { duration } from './format.ts'

/** Die Regeln der laufenden Partie tragen die Zahlen, die im Wartschritt erscheinen. */
const rules = TEST_RULES
const ticksPerDay = TEST_RULES.constants.ticksPerDay

/**
 * The guided start, on screen (T-M13-02, R-UI-05).
 *
 * The state machine was built and tested in M12 and never rendered anywhere, so what
 * is checked here is the part that was missing: that it appears, that it says where it
 * is in the sequence, that it can be got rid of — and above all that it never stands
 * between the player and the game.
 */

afterEach(cleanup)

describe('R-UI-05 Die Einstiegshilfe', () => {
  it('zeigt den ersten Schritt mit Fortschritt', () => {
    render(<Tutorial state={TUTORIAL_START} rules={rules} ticksPerDay={ticksPerDay} onDismiss={() => undefined} />)

    expect(screen.getByText(t(`tutorial.steps.${TUTORIAL_STEPS[0]!.id}.title`))).toBeTruthy()
    expect(screen.getByText(`Schritt 1 von ${TUTORIAL_STEPS.length}`)).toBeTruthy()
  })

  it('zeigt nichts, wenn sie abgeschaltet ist', () => {
    const { container } = render(<Tutorial state={dismiss()} rules={rules} ticksPerDay={ticksPerDay} onDismiss={() => undefined} />)

    expect(container.firstChild).toBeNull()
  })

  it('laesst sich abschalten', () => {
    const onDismiss = vi.fn()
    render(<Tutorial state={TUTORIAL_START} rules={rules} ticksPerDay={ticksPerDay} onDismiss={onDismiss} />)

    fireEvent.click(screen.getByRole('button', { name: /Nicht mehr zeigen/ }))

    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('faengt keine Eingabe ab', () => {
    // A hint beside the game, not a door in front of it: no dialogue role, no modal,
    // and nothing that swallows a click meant for the map.
    const { container } = render(<Tutorial state={TUTORIAL_START} rules={rules} ticksPerDay={ticksPerDay} onDismiss={() => undefined} />)
    const box = container.firstElementChild as HTMLElement

    expect(box.getAttribute('role')).not.toBe('dialog')
    expect(box.getAttribute('aria-modal')).toBeNull()
    expect(box.className).toContain('tutorial')
  })

  it('nennt zu jedem Schritt das Wozu, nicht nur das Was (T-M24-02)', () => {
    // Frage 50 des Abnahmebogens: das Was war gefuehrt, das Wozu fehlte. Der
    // Begruendungssatz steht als eigener Absatz unter dem Text.
    render(<Tutorial state={TUTORIAL_START} rules={rules} ticksPerDay={ticksPerDay} onDismiss={() => undefined} />)

    expect(screen.getByText(t(`tutorial.steps.${TUTORIAL_STEPS[0]!.id}.why`))).toBeTruthy()
  })

  it('setzt die Zahlen der Moralstrafe aus den Regeln ein, nicht aus dem Satz', () => {
    // Der letzte Schritt warnt vor der Ausdehnungsstrafe — mit den Zahlen der laufenden
    // Partie: ab welcher Provinz, und wie viel Zielmoral jede weitere kostet.
    const bisZurStrafe = TUTORIAL_STEPS.slice(0, -1).reduce(
      (state, step) => advance(state, step.completesOn),
      TUTORIAL_START,
    )
    const { container } = render(
      <Tutorial state={bisZurStrafe} rules={rules} ticksPerDay={ticksPerDay} onDismiss={() => undefined} />,
    )
    const text = container.textContent ?? ''

    expect(text, 'ein Platzhalter steht noch da').not.toContain('{{')
    expect(text).toContain(String(rules.constants.expansionFreeProvinces + 1))
    expect(text).toContain(String(rules.constants.expansionPenaltyPerProvince / 1000))
  })

  it('geht durch die Schritte in der vorgesehenen Reihenfolge', () => {
    // The machine belongs to game/tutorial.ts; this is the belt-and-braces check that
    // the component is fed by it rather than by its own copy of the sequence.
    let state = TUTORIAL_START
    for (const step of TUTORIAL_STEPS) {
      const { unmount } = render(<Tutorial state={state} rules={rules} ticksPerDay={ticksPerDay} onDismiss={() => undefined} />)
      expect(screen.getByText(t(`tutorial.steps.${step.id}.title`))).toBeTruthy()
      unmount()
      state = advance(state, step.completesOn)
    }

    expect(state.step).toBeNull()
    expect(state.seen).toBe(true)
  })
})

describe('R-UI-05 Die Fuehrung nennt das Warten beim Namen (T-M21-03)', () => {
  /** Die Führung bis zu dem Schritt, der das Warten erklärt — seit T-M24-02 vier Klicks. */
  const bisZumWarten = ['selectProvince', 'openBuild', 'setSpeed', 'openStandings'].reduce(
    (state, klick) => advance(state, klick as never),
    TUTORIAL_START,
  )

  it('setzt die Wartezeit aus den Regeln in den Satz ein', () => {
    render(<Tutorial state={bisZumWarten} rules={rules} ticksPerDay={ticksPerDay} onDismiss={() => undefined} />)
    const text = screen.getByText(/Startvorrat/).textContent ?? ''

    expect(text, 'der Platzhalter steht noch da').not.toContain('{{')
    expect(text, 'die Dauer fehlt').toContain(duration(firstUnitAt(rules), ticksPerDay))
    expect(text, 'auf das Vorspulen wird nicht gezeigt').toMatch(/spulen|Tempo/)
  })

  it('schreibt die Zahl nirgends in den Text', () => {
    // Die Regel des Projekts: eine Zahl steht nicht an zwei Orten. Stünde sie im Satz,
    // wäre sie beim ersten Balancing falsch, und niemand merkte es — die Führung wird ja
    // gerade von dem gelesen, der die Regeln noch nicht kennt.
    const vorlage = t('tutorial.steps.dayPassed.text')

    expect(vorlage, 'die Vorlage nennt eine feste Stundenzahl').not.toMatch(/\b\d+\s*(h|Stunden)\b/)
    expect(vorlage, 'ohne Platzhalter kann die Dauer nicht aus den Regeln kommen').toContain('{{wait}}')
  })

  it('nennt bei einem anderen Schritt keine Zahl', () => {
    render(<Tutorial state={TUTORIAL_START} rules={rules} ticksPerDay={ticksPerDay} onDismiss={() => undefined} />)

    expect(screen.getByText(t('tutorial.steps.select.text'))).toBeTruthy()
  })
})
