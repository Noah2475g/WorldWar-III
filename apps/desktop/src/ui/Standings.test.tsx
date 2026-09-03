// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { PublicView } from '@worldwar/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StandingsPanel, VictoryDialog, standingsRows } from './Standings.tsx'

/**
 * Where everyone stands, and how the game ends (T-M13-12, R-UI-13, R-GAME-02).
 *
 * The score has been in the state since M5 and the winner since then too; neither ever
 * reached the screen. A strategy game that cannot answer "am I winning" — or "is it
 * over" — is missing something more basic than a feature.
 */

afterEach(cleanup)

const view = (options: {
  self?: number
  others?: { id: string; score: number; alive?: boolean }[]
  armies?: { owner: string; provinceId: string; strength: number }[]
  winner?: string | null
  provinces?: { owner: string }[]
}): PublicView =>
  ({
    tick: 240,
    playerId: 'p1',
    self: { name: 'Mensch', nation: 'Nordland', score: options.self ?? 100, resources: {}, shortages: [] },
    others: (options.others ?? []).map((other) => ({
      id: other.id,
      name: other.id,
      nation: `Macht ${other.id}`,
      color: 'testfarbe',
      alive: other.alive ?? true,
      score: other.score,
    })),
    relations: { p2: { state: 'war', rightOfWay: false, sharedMap: false } },
    provinces: (options.provinces ?? []).map((province, index) => ({ id: `x${index}`, owner: province.owner })),
    armies: options.armies ?? [],
    marketPrices: {},
    victory: { condition: 'points', winner: options.winner ?? null },
  }) as unknown as PublicView

const nameOf = (id: string): string => (id === 'p2' ? 'Ostmark' : id)

describe('R-UI-13 Die Lage der Maechte', () => {
  it('sortiert nach Punkten und stellt die eigene Macht heraus', () => {
    const rows = standingsRows(view({ self: 100, others: [{ id: 'p2', score: 300 }] }), nameOf)

    expect(rows.map((row) => row.nation)).toEqual(['Ostmark', 'Nordland'])
    expect(rows.find((row) => row.own)?.nation).toBe('Nordland')
  })

  it('nennt keine ausgeschiedene Macht', () => {
    const rows = standingsRows(view({ others: [{ id: 'p2', score: 300, alive: false }] }), nameOf)

    expect(rows).toHaveLength(1)
  })

  it('zaehlt nur die Staerke, die der Spieler sieht', () => {
    // Was hinter dem Nebel steht, steht nicht in der Tabelle — eine Spalte mit der
    // wahren Truppenzahl waere die Oberflaeche, die fuer den Spieler schummelt.
    const rows = standingsRows(
      view({
        others: [{ id: 'p2', score: 50 }],
        armies: [
          { owner: 'p1', provinceId: 'a', strength: 3000 },
          { owner: 'p2', provinceId: 'b', strength: 1000 },
          { owner: 'p2', provinceId: 'c', strength: 500 },
        ],
      }),
      nameOf,
    )

    expect(rows.find((row) => row.own)?.seenStrength).toBe(3000)
    expect(rows.find((row) => row.id === 'p2')?.seenStrength).toBe(1500)
  })

  it('zeigt jede Macht als Balken gegen den Fuehrenden', () => {
    render(<StandingsPanel view={view({ self: 100, others: [{ id: 'p2', score: 300 }] })} nameOf={nameOf} />)

    const leader = screen.getByRole('meter', { name: 'Ostmark' })
    expect(leader.getAttribute('aria-valuenow')).toBe('300')
    expect(leader.getAttribute('aria-valuemax')).toBe('300')
    expect(screen.getByRole('meter', { name: 'Nordland' }).getAttribute('aria-valuenow')).toBe('100')
  })
})

describe('R-GAME-02 Das Ende der Partie', () => {
  it('sagt, dass gewonnen wurde, und fasst die Partie zusammen', () => {
    render(
      <VictoryDialog
        view={view({ winner: 'p1', self: 420, provinces: [{ owner: 'p1' }, { owner: 'p1' }, { owner: 'p2' }] })}
        nameOf={nameOf}
        ticksPerDay={24}
        onClose={() => undefined}
      />,
    )

    expect(screen.getByRole('dialog', { name: 'Die Partie ist entschieden' })).toBeTruthy()
    expect(screen.getByText('Sie haben gewonnen.')).toBeTruthy()
    expect(screen.getByText('Tag 11 · 420 Punkte · 2 Provinzen')).toBeTruthy()
  })

  it('nennt den Gewinner beim Namen, wenn es nicht der Spieler ist', () => {
    render(
      <VictoryDialog view={view({ winner: 'p2' })} nameOf={nameOf} ticksPerDay={24} onClose={() => undefined} />,
    )

    expect(screen.getByText('Ostmark hat gewonnen.')).toBeTruthy()
  })

  it('laesst sich schliessen — nach dem letzten Zug darf man die Karte noch ansehen', () => {
    const onClose = vi.fn()
    render(<VictoryDialog view={view({ winner: 'p1' })} nameOf={nameOf} ticksPerDay={24} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: 'Karte ansehen' }))

    expect(onClose).toHaveBeenCalledOnce()
  })
})
