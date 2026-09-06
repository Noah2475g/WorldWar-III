// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import type { PublicView } from '@worldwar/core'
import { afterEach, describe, expect, it } from 'vitest'
import { Header, victoryProgress } from './Header.tsx'
import { reachInDays } from './format.ts'

/**
 * The header (T-M13-07, R-UI-13).
 *
 * The score alone answers nothing: 4 200 points is a good game in a small world and a
 * hopeless one in a large one. What the player is asking is how close the end is, and
 * that is a share against a threshold.
 */

afterEach(cleanup)

const view = (self: number, others: number[], goal?: number): PublicView =>
  ({
    tick: 0,
    playerId: 'p1',
    self: {
      name: 'Mensch',
      nation: 'Nordland',
      resources: { food: 1000, wood: 1000, iron: 500, coal: 500, oil: 250, rare: 100, money: 2500 },
      shortages: [],
      capitalProvinceId: 'A',
      score: self,
      reputation: 1000,
      aiBonusMultiplier: 1000,
    },
    others: others.map((score, index) => ({
      id: `p${index + 2}`,
      name: `KI ${index + 1}`,
      nation: 'Ostmark',
      // Kein Hex-Literal: Farben gehoeren in tokens.ts, und das gilt auch hier.
      color: 'testfarbe',
      alive: true,
      score,
    })),
    relations: {},
    provinces: [],
    armies: [],
    marketPrices: { food: 1, wood: 1, iron: 1, coal: 1, oil: 1, rare: 1, money: 1 },
    victory: { condition: 'points', winner: null, ...(goal === undefined ? {} : { pointsShareToWin: goal }) },
  }) as unknown as PublicView

const noop = () => undefined

const renderHeader = (v: PublicView | null) =>
  render(
    <Header
      view={v}
      ticksPerDay={24}
      speed={0}
      fastForwarding={false}
      mode="political"
      onSpeed={noop}
      onFastForward={noop}
      onAbort={noop}
      onMode={noop}
      onMenu={noop}
      onSaves={noop}
      onPanel={noop}
    />,
  )

describe('R-UI-13 Der Weg zum Sieg', () => {
  it('rechnet den eigenen Anteil an allen Punkten', () => {
    // 300 von 1000 Punkten sind 30 %, das Ziel 900 Promille sind 90 %.
    expect(victoryProgress(view(300, [400, 300], 900))).toEqual({ share: 30, goal: 90 })
  })

  it('zeigt den Anteil als Anzeige mit beiden Zahlen', () => {
    renderHeader(view(300, [400, 300], 900))

    const meter = screen.getByRole('meter', { name: 'Siegziel' })
    expect(meter.textContent).toContain('30 % von 90 %')
  })

  it('bleibt still, wenn es nichts zu rechnen gibt', () => {
    // Ohne Schwelle (Sicht ohne Regeln) und vor dem ersten Punkt gibt es keinen Anteil.
    expect(victoryProgress(view(300, [400], undefined))).toBeNull()
    expect(victoryProgress(view(0, [0], 900))).toBeNull()
    expect(victoryProgress(null)).toBeNull()

    renderHeader(view(0, [0], 900))
    expect(screen.queryByRole('meter', { name: 'Siegziel' })).toBeNull()
  })
})

describe('R-UI-10 Die Kopfleiste zeigt Rohstoffe mit Symbol', () => {
  it('setzt vor jede Zahl das Zeichen ihres Rohstoffs', () => {
    const { container } = renderHeader(view(100, [100], 900))
    const list = screen.getByRole('list', { name: 'Rohstoffe' })

    expect(list.querySelectorAll('svg').length).toBe(7)
    // Und der Name bleibt lesbar — fuer Vorleseprogramme und fuer den Zeiger.
    expect(screen.getByText('Nahrung')).toBeTruthy()
    expect(container.querySelector('.resource')?.getAttribute('title')).toBe('Nahrung')
  })
})

describe('R-UI-09 Die Kopfleiste sagt, wie lange es reicht', () => {
  const withEconomy = (stock: number, balance: number): PublicView => {
    const base = view(100, [100], 900)
    return {
      ...base,
      self: {
        ...base.self,
        economy: {
          food: { stock, production: 0, consumption: Math.max(0, -balance), balance },
          wood: { stock: 5000, production: 100, consumption: 0, balance: 100 },
          iron: { stock: 5000, production: 100, consumption: 0, balance: 100 },
          coal: { stock: 5000, production: 100, consumption: 0, balance: 100 },
          oil: { stock: 5000, production: 100, consumption: 0, balance: 100 },
          rare: { stock: 5000, production: 100, consumption: 0, balance: 100 },
          money: { stock: 5000, production: 100, consumption: 0, balance: 100 },
        },
      },
    } as PublicView
  }

  it('nennt die Reichweite, wenn der Vorrat schrumpft', () => {
    renderHeader(withEconomy(10_000, -5000))

    expect(screen.getByText('noch 2 Tage')).toBeTruthy()
  })

  it('schweigt, solange der Vorrat waechst', () => {
    renderHeader(withEconomy(10_000, 5000))

    expect(screen.queryByText(/noch .* Tage/)).toBeNull()
  })

  it('kennzeichnet einen Vorrat unter drei Tagen als Mangel', () => {
    const { container } = renderHeader(withEconomy(4000, -2000))

    expect(container.querySelector('.resource--short')).toBeTruthy()
  })

  it('rechnet keine Reichweite aus einem leeren Lager oder einer Null-Bilanz', () => {
    expect(reachInDays(0, -100)).toBeNull()
    expect(reachInDays(1000, 0)).toBeNull()
    expect(reachInDays(1000, -100)).toBe(10)
  })
})
