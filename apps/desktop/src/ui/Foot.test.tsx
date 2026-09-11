// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Foot, footRows, isDayReport, latestReport, unreadCount } from './Foot.tsx'
import type { EventEntry } from './Panels.tsx'
import type { StandingsRow } from './Standings.tsx'

/**
 * Der Fuss (T-M31-03, D27.6): die Neu-Marke zaehlt, was seit dem letzten Oeffnen
 * dazukam, und die Rangliste zeigt die eigene Zeile immer — beides rein gerechnet.
 */

afterEach(cleanup)

const entry = (id: string, tick: number, extra: Partial<EventEntry> = {}): EventEntry => ({
  id,
  tick,
  text: `Ereignis ${id}`,
  severity: 'info',
  ...extra,
})

const row = (id: string, score: number, own = false): StandingsRow => ({
  id,
  nation: `Macht ${id}`,
  color: 'testfarbe',
  score,
  relation: 'Frieden',
  seenStrength: 0,
  own,
})

describe('T-M31-03 Der Fuss', () => {
  it('zaehlt die Neu-Marke als Zeilen seit dem zuletzt gesehenen Tick', () => {
    const entries = [entry('a', 10), entry('b', 30), entry('c', 50)]
    expect(unreadCount(entries, 0)).toBe(3)
    expect(unreadCount(entries, 30)).toBe(1)
    expect(unreadCount(entries, 50)).toBe(0)
  })

  it('erkennt den Tagesbericht an Bilanzen oder Absaetzen, nicht am Kampf', () => {
    expect(isDayReport(entry('r', 24, { deltas: [{ label: 'Nahrung', balance: 5 }] }))).toBe(true)
    expect(isDayReport(entry('r', 24, { body: ['Moral steigt.'] }))).toBe(true)
    expect(isDayReport(entry('x', 24))).toBe(false)
    expect(
      isDayReport(entry('k', 24, { body: ['Gefecht'], battle: { sides: [], terrain: 'plains', fortressLevel: 0 } as never })),
    ).toBe(false)
    expect(latestReport([entry('r1', 24, { body: ['a'] }), entry('r2', 48, { body: ['b'] }), entry('x', 60)])?.id).toBe('r2')
    expect(latestReport([entry('x', 60)])).toBeNull()
  })

  it('zeigt vier Zeilen um die eigene Macht und die eigene immer', () => {
    const rows = [row('a', 900), row('b', 800), row('c', 700), row('d', 600), row('e', 500, true), row('f', 400), row('g', 300)]
    expect(footRows(rows).map((r) => r.id)).toEqual(['d', 'e', 'f', 'g'])
    // Ganz oben: das Fenster beginnt bei eins.
    expect(footRows([row('a', 900, true), ...rows.slice(1)]).map((r) => r.id)).toEqual(['a', 'b', 'c', 'd'])
    // Weniger als vier Maechte: alle.
    expect(footRows(rows.slice(0, 2)).length).toBe(2)
    for (const r of [rows, [row('a', 900, true), ...rows.slice(1)]]) expect(footRows(r).some((x) => x.own)).toBe(true)
  })

  it('rendert Protokoll, Rangliste (eigene in eigener Klasse) und drei Knoepfe mit Neu-Marke', () => {
    const onPanel = vi.fn()
    const onDispatch = vi.fn()
    const entries = [entry('a', 10), entry('r', 24, { body: ['Tagesbericht'] }), entry('b', 30)]
    render(
      <Foot
        entries={entries}
        ticksPerDay={24}
        rows={[row('a', 900), row('b', 800, true), row('c', 700)]}
        seenTick={10}
        onJump={() => undefined}
        onDispatch={onDispatch}
        onPanel={onPanel}
      />,
    )

    expect(screen.getByRole('region', { name: 'Ereignisse' })).toBeTruthy()
    const standings = screen.getByRole('region', { name: 'Rangliste' })
    expect(within(standings).getAllByRole('listitem').length).toBe(3)
    expect(standings.querySelector('.foot__row--own')?.textContent).toContain('Macht b')

    // Zwei Zeilen nach Tick 10: die Marke sagt 2.
    const lage = screen.getByRole('button', { name: /Rangliste/ })
    expect(lage.textContent).toContain('2')
    fireEvent.click(lage)
    expect(onPanel).toHaveBeenCalledWith('standings')

    fireEvent.click(screen.getByRole('button', { name: 'Depesche' }))
    expect(onDispatch).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Diplomatie' }))
    expect(onPanel).toHaveBeenCalledWith('diplomacy')
  })

  it('sperrt die Depesche, solange es keinen Tagesbericht gibt', () => {
    render(
      <Foot entries={[entry('a', 10)]} ticksPerDay={24} rows={[]} seenTick={0} onJump={() => undefined} onDispatch={() => undefined} onPanel={() => undefined} />,
    )
    expect((screen.getByRole('button', { name: 'Depesche' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
