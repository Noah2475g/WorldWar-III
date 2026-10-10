// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DockWithRecruit, readRecruitOpen, RecruitSheet, writeRecruitOpen, type RecruitUnit } from './RecruitSheet.tsx'

afterEach(cleanup)

const units: RecruitUnit[] = [
  { id: 'inf', name: 'Infanterie' },
  { id: 'tank', name: 'Panzer', running: 2 },
  { id: 'art', name: 'Artillerie', disabled: true },
]

describe('readRecruitOpen/writeRecruitOpen (D10: fehlender Schluessel = offen)', () => {
  const key = 'worldwar.recruit.open'
  beforeEach(() => window.localStorage.removeItem(key))

  it('ist offen ohne gespeicherten Wert', () => {
    expect(readRecruitOpen()).toBe(true)
  })

  it('schreibt 0 bei geschlossen und 1 bei offen, liest es zurueck', () => {
    writeRecruitOpen(false)
    expect(window.localStorage.getItem(key)).toBe('0')
    expect(readRecruitOpen()).toBe(false)
    writeRecruitOpen(true)
    expect(readRecruitOpen()).toBe(true)
  })

  it('faellt bei einem Storage-Fehler auf offen zurueck statt abzustuerzen', () => {
    const broken = { getItem: () => { throw new Error('boom') } }
    expect(readRecruitOpen(broken)).toBe(true)
  })
})

describe('RecruitSheet', () => {
  it('zeigt 5x2 Felder, einen Klick je Einheit hebt genau eine aus', () => {
    const onRecruit = vi.fn()
    const { container } = render(
      <RecruitSheet units={units} open={true} onOpenChange={() => undefined} onRecruit={onRecruit} freeSlots={7} />,
    )
    expect(container.querySelectorAll('.recruit-grid .slot')).toHaveLength(3)
    const infantryButton = container.querySelector('button[aria-label="Infanterie ausheben"]') as HTMLButtonElement
    fireEvent.click(infantryButton)
    expect(onRecruit).toHaveBeenCalledTimes(1)
    expect(onRecruit).toHaveBeenCalledWith('inf')
  })

  it('zeigt den laufenden Auftrag ×N bei running > 0', () => {
    const { container } = render(
      <RecruitSheet units={units} open={true} onOpenChange={() => undefined} onRecruit={() => undefined} freeSlots={7} />,
    )
    expect(container.querySelector('.slot__mark')?.textContent).toContain('2')
  })

  it('Zuklappen (Pfeil) ruft onOpenChange(false) auf und blendet das Raster aus', () => {
    const onOpenChange = vi.fn()
    const { container } = render(
      <RecruitSheet units={units} open={true} onOpenChange={onOpenChange} onRecruit={() => undefined} freeSlots={7} />,
    )
    fireEvent.click(container.querySelector('.recruit-sheet__toggle')!)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('ist aria-hidden und zeigt kein Raster, wenn collapsed', () => {
    const { container } = render(
      <RecruitSheet units={units} open={false} onOpenChange={() => undefined} onRecruit={() => undefined} freeSlots={7} />,
    )
    expect(container.querySelector('.recruit-sheet')?.getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelector('.recruit-grid')).toBeNull()
  })
})

describe('DockWithRecruit (Panel-Grid + Sheet-Toggle)', () => {
  it('die Hauptaktion Ausheben in der Leiste oeffnet/schliesst das Raster', () => {
    const onOpenChange = vi.fn()
    const { container } = render(
      <DockWithRecruit
        state="province"
        recruit={{ units, open: false, onOpenChange, onRecruit: () => undefined, freeSlots: 7 }}
      />,
    )
    fireEvent.click(container.querySelector('.dock__recruit-action')!)
    expect(onOpenChange).toHaveBeenCalledWith(true)
  })

  it('zeigt das Raster nur im Zustand province', () => {
    const { container, rerender } = render(
      <DockWithRecruit
        state="foreign"
        recruit={{ units, open: true, onOpenChange: () => undefined, onRecruit: () => undefined, freeSlots: 7 }}
      />,
    )
    expect(container.querySelector('.recruit-sheet')).toBeNull()

    rerender(
      <DockWithRecruit
        state="province"
        recruit={{ units, open: true, onOpenChange: () => undefined, onRecruit: () => undefined, freeSlots: 7 }}
      />,
    )
    expect(container.querySelector('.recruit-sheet')).not.toBeNull()
  })
})
