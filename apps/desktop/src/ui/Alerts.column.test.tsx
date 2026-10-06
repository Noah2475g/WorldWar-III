// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Alerts, COLUMN_MAX, type Alert, type AlertKind } from './Alerts.tsx'
import { MESSAGE_ROUTE } from './notice.ts'

/**
 * Die Hinweisspalte oben links (Seitenleiste v3b E1, D3): jede Art steht an ihrem neuen Ort
 * (`section.alerts.map-alerts`), traegt `data-msg`, springt mit einem Klick; mehr als drei Zeilen
 * stehen hinter „+n“, ein Klick klappt auf.
 */

afterEach(cleanup)

const KINDS: readonly AlertKind[] = [
  'battle',
  'overrun',
  'shortage',
  'unrest',
  'capital',
  'completion',
  'unlock',
  'upcoming',
  'sabotage',
  'espionage',
  'offer',
  'clearance',
]

const alertOf = (kind: AlertKind, index = 0): Alert => ({
  id: `${kind}:x${index}`,
  kind,
  icon: 'warning',
  text: `Meldung ${kind} ${index}`,
  short: `K${index}`,
  provinceId: `P${index}`,
})

describe('Hinweisspalte (D3)', () => {
  it.each(KINDS)('zeigt die Art %s in .alerts.map-alerts mit data-msg und einem Klick', (kind) => {
    const onJump = vi.fn()
    const { container } = render(<Alerts column alerts={[alertOf(kind)]} onJump={onJump} />)

    const section = container.querySelector('section.alerts.map-alerts')
    expect(section, 'Spalte fehlt').not.toBeNull()
    const row = section!.querySelector(`li.alert--${kind}`)
    expect(row, `Zeile ${kind}`).not.toBeNull()
    expect(row!.getAttribute('data-msg')).toBe(`${kind}:x0`)

    fireEvent.click(screen.getByRole('button', { name: `Meldung ${kind} 0` }))
    expect(onJump).toHaveBeenCalledTimes(1)
  })

  it('ohne column bleibt es die Liste im Blatt (Telefon-Hochformat)', () => {
    const { container } = render(<Alerts alerts={[alertOf('battle')]} onJump={() => undefined} />)

    expect(container.querySelector('section.alerts')).not.toBeNull()
    expect(container.querySelector('.map-alerts')).toBeNull()
  })

  it('zeigt hoechstens drei Zeilen und „+n“; ein Klick klappt auf', () => {
    const alerts = ['battle', 'shortage', 'offer', 'capital', 'clearance'].map((kind, index) => alertOf(kind as AlertKind, index))
    const { container } = render(<Alerts column alerts={alerts} onJump={() => undefined} />)

    expect(container.querySelectorAll('li.alert[data-msg]')).toHaveLength(COLUMN_MAX)
    const more = screen.getByRole('button', { name: '2 weitere Meldungen anzeigen' })
    expect(more.textContent).toBe('+2')
    expect(more.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(more)
    expect(container.querySelectorAll('li.alert[data-msg]')).toHaveLength(5)
    expect(screen.getByRole('button', { name: 'Weniger Meldungen anzeigen' }).getAttribute('aria-expanded')).toBe('true')
  })

  it('zeigt bei drei oder weniger Zeilen kein „+n“', () => {
    render(<Alerts column alerts={[alertOf('battle', 0), alertOf('offer', 1), alertOf('shortage', 2)]} onJump={() => undefined} />)

    expect(screen.queryByText(/^\+\d/)).toBeNull()
  })

  it('jede Hinweisart steht in MESSAGE_ROUTE genau einmal und im Ort „alerts“', () => {
    for (const kind of KINDS) {
      expect(MESSAGE_ROUTE[kind], kind).toBe('alerts')
    }
  })

  it('jede Art der Union AlertKind in Alerts.tsx steht in MESSAGE_ROUTE (Quelltext gelesen) und in KINDS', () => {
    const source = readFileSync(`${process.cwd()}/apps/desktop/src/ui/Alerts.tsx`, 'utf8')
    const union = /export type AlertKind =([\s\S]*?)\n\nexport /.exec(source)
    expect(union, 'Union AlertKind nicht gefunden').not.toBeNull()
    const declared = [...union![1]!.matchAll(/^\s*\|\s*'([a-z]+)'/gm)].map((m) => m[1]!)
    expect(declared.length).toBeGreaterThanOrEqual(12)
    for (const kind of declared) {
      expect(Object.keys(MESSAGE_ROUTE), kind).toContain(kind)
      expect(MESSAGE_ROUTE[kind as keyof typeof MESSAGE_ROUTE], kind).toBe('alerts')
    }
    expect([...declared].sort()).toEqual([...KINDS].sort())
  })
})
