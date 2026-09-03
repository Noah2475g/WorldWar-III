// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Tutorial } from './Tutorial.tsx'
import { TUTORIAL_START, TUTORIAL_STEPS, advance, dismiss } from '../game/tutorial.ts'

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
    render(<Tutorial state={TUTORIAL_START} onDismiss={() => undefined} />)

    expect(screen.getByText(TUTORIAL_STEPS[0]!.title)).toBeTruthy()
    expect(screen.getByText(`Schritt 1 von ${TUTORIAL_STEPS.length}`)).toBeTruthy()
  })

  it('zeigt nichts, wenn sie abgeschaltet ist', () => {
    const { container } = render(<Tutorial state={dismiss()} onDismiss={() => undefined} />)

    expect(container.firstChild).toBeNull()
  })

  it('laesst sich abschalten', () => {
    const onDismiss = vi.fn()
    render(<Tutorial state={TUTORIAL_START} onDismiss={onDismiss} />)

    fireEvent.click(screen.getByRole('button', { name: /Nicht mehr zeigen/ }))

    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('faengt keine Eingabe ab', () => {
    // A hint beside the game, not a door in front of it: no dialogue role, no modal,
    // and nothing that swallows a click meant for the map.
    const { container } = render(<Tutorial state={TUTORIAL_START} onDismiss={() => undefined} />)
    const box = container.firstElementChild as HTMLElement

    expect(box.getAttribute('role')).not.toBe('dialog')
    expect(box.getAttribute('aria-modal')).toBeNull()
    expect(box.className).toContain('tutorial')
  })

  it('geht durch die Schritte in der vorgesehenen Reihenfolge', () => {
    // The machine belongs to game/tutorial.ts; this is the belt-and-braces check that
    // the component is fed by it rather than by its own copy of the sequence.
    let state = TUTORIAL_START
    for (const step of TUTORIAL_STEPS) {
      const { unmount } = render(<Tutorial state={state} onDismiss={() => undefined} />)
      expect(screen.getByText(step.title)).toBeTruthy()
      unmount()
      state = advance(state, step.completesOn)
    }

    expect(state.step).toBeNull()
    expect(state.seen).toBe(true)
  })
})
