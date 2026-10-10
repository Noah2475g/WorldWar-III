// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Dock, dockStateClass } from './Dock.tsx'

afterEach(cleanup)

describe('dockStateClass (K1: feste Hoehe je Zustand aus der Klasse, nicht aus dem Inhalt)', () => {
  it('liefert dock + dock--<state>', () => {
    expect(dockStateClass('empty')).toBe('dock dock--empty')
    expect(dockStateClass('province')).toBe('dock dock--province')
    expect(dockStateClass('foreign')).toBe('dock dock--foreign')
    expect(dockStateClass('army')).toBe('dock dock--army')
  })
})

describe('Dock', () => {
  it('zeigt im Zustand empty den Platzhalter statt des Pickers', () => {
    const { container } = render(<Dock state="empty" />)
    expect(container.querySelector('.dock')?.getAttribute('data-state')).toBe('empty')
    expect(container.querySelector('.dock__placeholder')).not.toBeNull()
    expect(container.querySelector('.picker select')).toBeNull()
  })

  it('zeigt im Zustand province den Picker mit den eigenen Provinzen', () => {
    const { container } = render(
      <Dock state="province" pickerOptions={[{ id: 'p1', label: 'Bayern' }]} pickerValue="p1" />,
    )
    const select = container.querySelector('.picker select') as HTMLSelectElement | null
    expect(select).not.toBeNull()
    expect(select!.value).toBe('p1')
    expect(container.querySelectorAll('option')).toHaveLength(2) // Platzhalter + 1 Provinz
  })

  it('ruft onPickerChange mit der gewaehlten id auf', () => {
    const onPickerChange = vi.fn()
    const { container } = render(
      <Dock state="province" pickerOptions={[{ id: 'p1', label: 'Bayern' }]} pickerValue={null} onPickerChange={onPickerChange} />,
    )
    const select = container.querySelector('.picker select') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'p1' } })
    expect(onPickerChange).toHaveBeenCalledWith('p1')
  })

  it('zeigt die Hauptaktion Ausheben nur im Zustand province, mit aria-expanded', () => {
    const onToggleRecruit = vi.fn()
    const { container, rerender } = render(
      <Dock state="province" onToggleRecruit={onToggleRecruit} recruitOpen={true} />,
    )
    const button = container.querySelector('.dock__recruit-action') as HTMLButtonElement
    expect(button).not.toBeNull()
    expect(button.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(button)
    expect(onToggleRecruit).toHaveBeenCalledTimes(1)

    rerender(<Dock state="foreign" />)
    expect(container.querySelector('.dock__recruit-action')).toBeNull()
  })

  it('rendert children im dock__body', () => {
    const { getByText } = render(
      <Dock state="province">
        <p>Inhalt</p>
      </Dock>,
    )
    expect(getByText('Inhalt')).toBeTruthy()
  })
})
