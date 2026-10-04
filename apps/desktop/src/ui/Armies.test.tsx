// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { PublicView, VisibleArmy } from '@worldwar/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { armyRows } from '../game/armies.ts'
import { resolveKey } from '../keyboard.ts'
import { ArmiesPanel, ArmyPanel, filterArmyRows, type ArmyRow, type Targeting } from './Panels.tsx'

/**
 * Die Heeruebersicht (T-M46-01, R-UX-04): alle eigenen Armeen mit Ort, Staerke und Auftrag, Sprung zur
 * Karte, direkter Marschbefehl, Filter. Gemessen vorher (S300, 1280x800): Armee bewegen per Tastatur 46
 * Tasten (37 davon Tab), per Maus 5 Klicks; Armeen waren nur Canvas-Pixel (0 DOM-Elemente).
 */

afterEach(cleanup)

const army = (id: string, over: Partial<VisibleArmy> = {}): VisibleArmy =>
  ({ id, owner: 'p1', provinceId: 'USA-MW', strength: 12_400, stance: 'aggressive', ...over }) as VisibleArmy

const view = (armies: VisibleArmy[], tick = 100): PublicView => ({ tick, playerId: 'p1', armies }) as unknown as PublicView

const names: Record<string, string> = { a1: 'Armee 10', a2: 'Armee 2', a3: 'Armee 3', a4: 'Fremde' }
const deps = {
  nameOfArmy: (id: string) => names[id] ?? id,
  nameOfProvince: (id: string) => (id === 'USA-MW' ? 'Mittlerer Westen' : id === 'USA-S' ? 'Südstaaten' : id),
  ticksPerDay: 24,
  battleProvinces: new Set<string>(['USA-NE']),
}

describe('armyRows: eine Zeile je eigene Armee, Gefecht vor Marsch vor Stand', () => {
  const armies = [
    army('a1'),
    army('a2', { provinceId: 'USA-NE' }),
    army('a3', { arrivalTick: 130, path: ['USA-MW', 'USA-S'] }),
    army('a4', { owner: 'p2' }),
  ]
  const rows = armyRows(view(armies), deps)

  it('zeigt nur eigene Armeen', () => {
    expect(rows.map((row) => row.id).sort()).toEqual(['a1', 'a2', 'a3'])
  })

  it('ordnet Gefecht, Marsch, Stand; innerhalb nach Name mit Zahlen als Zahlen', () => {
    expect(rows.map((row) => [row.id, row.order])).toEqual([
      ['a2', 'battle'],
      ['a3', 'marching'],
      ['a1', 'idle'],
    ])
    const idle = armyRows(view([army('a1'), army('a2')]), deps)
    expect(idle.map((row) => row.name)).toEqual(['Armee 2', 'Armee 10'])
  })

  it('nennt den Auftrag als Satz mit Ziel und Ankunft', () => {
    const marching = rows.find((row) => row.id === 'a3')!
    expect(marching.orderText).toContain('marschiert nach Südstaaten')
    expect(marching.orderText).toContain('Ankunft')
    expect(rows.find((row) => row.id === 'a2')!.orderText).toBe('im Gefecht')
    expect(rows.find((row) => row.id === 'a1')!.orderText).toBe('steht · Angriff')
    expect(rows.find((row) => row.id === 'a1')!.provinceName).toBe('Mittlerer Westen')
  })

  it('eine angekommene Armee steht, auch wenn der Ankunftstick noch im Wert steht', () => {
    const arrived = armyRows(view([army('a1', { arrivalTick: 90 })]), deps)
    expect(arrived[0]!.order).toBe('idle')
  })
})

const rows: ArmyRow[] = [
  { id: 'a2', name: 'Armee 2', provinceName: 'Nordosten', strength: 5000, order: 'battle', orderText: 'im Gefecht' },
  { id: 'a3', name: 'Armee 3', provinceName: 'Südstaaten', strength: 7000, order: 'marching', orderText: 'marschiert nach X' },
  { id: 'a1', name: 'Armee 1', provinceName: 'Mittlerer Westen', strength: 9000, order: 'idle', orderText: 'steht · Angriff' },
]

describe('ArmiesPanel', () => {
  it('listet jede Armee mit Namen, Ort, Auftrag und zwei Knoepfen, die den Namen tragen', () => {
    render(<ArmiesPanel rows={rows} onSelect={vi.fn()} onMarch={vi.fn()} />)
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(within(items[1]!).getByText('Armee 3')).toBeTruthy()
    expect(within(items[1]!).getByText('Südstaaten')).toBeTruthy()
    expect(within(items[1]!).getByText('marschiert nach X')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Armee 3 auswählen und auf der Karte zeigen' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Armee 3 marschieren lassen' })).toBeTruthy()
  })

  it('ruft Auswaehlen und Marschieren mit der Armee', () => {
    const onSelect = vi.fn()
    const onMarch = vi.fn()
    render(<ArmiesPanel rows={rows} onSelect={onSelect} onMarch={onMarch} />)
    fireEvent.click(screen.getByRole('button', { name: 'Armee 1 auswählen und auf der Karte zeigen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Armee 1 marschieren lassen' }))
    expect(onSelect).toHaveBeenCalledWith('a1')
    expect(onMarch).toHaveBeenCalledWith('a1')
  })

  it('der Fokus steht beim Oeffnen auf der ersten Armee (per Taste A: der naechste Druck gehoert ihr)', () => {
    render(<ArmiesPanel rows={rows} onSelect={vi.fn()} onMarch={vi.fn()} />)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Armee 2 auswählen und auf der Karte zeigen' }))
  })

  it('filtert nach Auftrag und zaehlt in der Beschriftung', () => {
    render(<ArmiesPanel rows={rows} onSelect={vi.fn()} onMarch={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'marschiert 1' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(filterArmyRows(rows, 'idle').map((row) => row.id)).toEqual(['a1'])
    expect(filterArmyRows(rows, 'all')).toHaveLength(3)
  })

  it('sagt es, wenn es keine Armee gibt', () => {
    render(<ArmiesPanel rows={[]} onSelect={vi.fn()} onMarch={vi.fn()} />)
    expect(screen.getByText('Sie haben keine Armee.')).toBeTruthy()
  })
})

describe('Taste A und die Zielliste', () => {
  it('A oeffnet die Heeruebersicht', () => {
    const context = { speed: 1, mode: 'political', typing: false, dialogOpen: false, fastForwarding: false } as const
    expect(resolveKey({ key: 'a' }, context)).toEqual({ type: 'openPanel', panel: 'armies' })
    expect(resolveKey({ key: 'A' }, context)).toEqual({ type: 'openPanel', panel: 'armies' })
    expect(resolveKey({ key: 'a' }, { ...context, typing: true })).toBeNull()
  })

  it('beginnt die Zielwahl, steht der Fokus auf der Zielliste', () => {
    const noop = (): void => undefined
    const targeting: Targeting = {
      kind: 'move',
      target: null,
      options: [{ id: 'USA-S', name: 'Südstaaten', arrivalDay: 3 }],
      unreachable: [],
      confirm: null,
      onChoose: noop,
      onCancel: noop,
      delayDays: 0,
      onDelay: noop,
    }
    const { rerender } = render(<ArmyPanel army={army('a1')} actions={[]} ticksPerDay={24} currentTick={0} />)
    expect(document.activeElement).toBe(document.body)
    rerender(<ArmyPanel army={army('a1')} actions={[]} targeting={targeting} ticksPerDay={24} currentTick={0} />)
    expect(document.activeElement?.tagName).toBe('SELECT')
  })
})
