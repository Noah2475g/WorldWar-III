// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CostPreview, PreviewArea, slotState } from './CostPreview.tsx'
import type { Action } from './Panels.tsx'

afterEach(cleanup)

const act = (over: Partial<Action> = {}): Action => ({
  id: 'build-factory',
  label: 'Fabrik',
  disabledReason: null,
  onRun: () => undefined,
  ...over,
})

describe('slotState (K3)', () => {
  it('bildet alle Faelle ab', () => {
    expect(slotState({ disabledReason: null })).toBe('ok')
    expect(slotState({ disabledReason: 'x', blockCode: 'INSUFFICIENT_RESOURCES' })).toBe('short')
    expect(slotState({ disabledReason: 'x', blockCode: 'QUEUE_FULL' })).toBe('queue')
    for (const code of ['NOT_YET_AVAILABLE', 'MISSING_BUILDING', 'INVALID_TARGET'] as const) {
      expect(slotState({ disabledReason: 'x', blockCode: code })).toBe('locked')
    }
    expect(slotState({ disabledReason: 'x', blockCode: 'BUILDING_MAX_LEVEL' })).toBe('none')
    expect(slotState({ disabledReason: 'x' })).toBe('none')
  })
})

describe('CostPreview (K3)', () => {
  const lines = [
    { resource: 'iron', need: 800_000, short: 400_000 },
    { resource: 'money', need: 100_000, short: 0 },
  ] as const

  it('zeigt Chips, Fehlbetrag am roten Chip, aria-hidden, nichts Fokussierbares', () => {
    const { container } = render(
      <CostPreview action={act({ disabledReason: 'fehlt', blockCode: 'INSUFFICIENT_RESOURCES', costLines: lines })} />,
    )
    const root = container.querySelector('.cost-preview')!
    expect(root.getAttribute('aria-hidden')).toBe('true')
    expect(root.querySelectorAll('.cost-chip')).toHaveLength(2)
    expect(root.querySelectorAll('.cost-chip--short')).toHaveLength(1)
    expect(root.querySelector('.cost-chip--short')!.textContent).toContain('\u2212400')
    expect(root.querySelectorAll('button, a, input, [tabindex]')).toHaveLength(0)
  })

  it('ist leer bei none, ohne costLines und ohne Aktion', () => {
    for (const action of [
      act({ disabledReason: 'max', blockCode: 'BUILDING_MAX_LEVEL', costLines: lines }),
      act(),
      null,
    ]) {
      const { container, unmount } = render(<CostPreview action={action} />)
      expect(container.querySelector('.cost-preview')!.children).toHaveLength(0)
      unmount()
    }
  })

  it('PreviewArea: Hover fuellt, Verlassen leert', () => {
    const { container } = render(
      <PreviewArea actions={[act({ costLines: lines })]}>
        <div data-action-id="build-factory">
          <button type="button">x</button>
        </div>
      </PreviewArea>,
    )
    fireEvent.pointerOver(container.querySelector('button')!)
    expect(container.querySelectorAll('.cost-chip')).toHaveLength(2)
    fireEvent.pointerLeave(container.querySelector('.preview-area')!)
    expect(container.querySelectorAll('.cost-chip')).toHaveLength(0)
  })

  it('PreviewArea: Fokus fuellt, Blur nach aussen leert, Blur nach innen behaelt', () => {
    const { container } = render(
      <>
        <button type="button" id="aussen">
          aussen
        </button>
        <PreviewArea actions={[act({ costLines: lines })]}>
          <div data-action-id="build-factory">
            <button type="button" id="b1">
              x
            </button>
            <button type="button" id="b2">
              y
            </button>
          </div>
        </PreviewArea>
      </>,
    )
    const b1 = container.querySelector('#b1')!
    fireEvent.focus(b1)
    expect(container.querySelectorAll('.cost-chip')).toHaveLength(2)
    fireEvent.blur(b1, { relatedTarget: container.querySelector('#b2') })
    expect(container.querySelectorAll('.cost-chip')).toHaveLength(2)
    fireEvent.blur(b1, { relatedTarget: container.querySelector('#aussen') })
    expect(container.querySelectorAll('.cost-chip')).toHaveLength(0)
  })
})
