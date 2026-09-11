// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { PublicView } from '@worldwar/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

const renderHeader = (
  v: PublicView | null,
  extra: { stalled?: boolean; speed?: number; onSpeed?: (s: number) => void; onMode?: (m: string) => void } = {},
) =>
  render(
    <Header
      view={v}
      ticksPerDay={24}
      speed={extra.speed ?? 0}
      stalled={extra.stalled ?? false}
      fastForwarding={false}
      fastForwardNotice={null}
      mode="political"
      onSpeed={extra.onSpeed ?? noop}
      onFastForward={noop}
      onAbort={noop}
      onMode={extra.onMode ?? noop}
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

/**
 * Eine stehende Uhr nennt sich Pausiert (T-M22-05, R-TIME-02, Befund V2-09): bei
 * verdecktem Fenster feuert requestAnimationFrame nicht, die Anzeige stand auf "100",
 * die Zeit stand — ohne ein Wort. Ob sie steht, entscheidet App; hier steht die
 * andere Haelfte: dass die Leiste es auch sagt, als role="status" fuers Ohr.
 */
describe('R-TIME-02 Eine stehende Uhr sagt es', () => {
  it('zeigt Pausiert, wenn die Uhr trotz Tempo steht', () => {
    renderHeader(view(300, [400], 900), { stalled: true, speed: 10 })

    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.getByText('Pausiert')).toBeTruthy()
  })

  it('schweigt, solange die Uhr laeuft oder bewusst pausiert ist', () => {
    renderHeader(view(300, [400], 900), { stalled: false, speed: 10 })

    expect(screen.queryByText('Pausiert')).toBeNull()
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

  it('nennt die Reichweite im Titel, wenn der Vorrat schrumpft (T-M29-02)', () => {
    const { container } = renderHeader(withEconomy(10_000, -5000))

    // Seit dem Kriegsrat steht die Reichweite im `title` der Bilanz, nicht als
    // dritte Zahl in der Leiste — die Leiste bleibt eine Zeile (D27.6).
    expect(container.querySelector('.resource--food em')?.getAttribute('title')).toContain('noch 2 Tage')
    expect(screen.queryByText('noch 2 Tage')).toBeNull()
  })

  it('schweigt, solange der Vorrat waechst', () => {
    const { container } = renderHeader(withEconomy(10_000, 5000))

    expect(container.querySelector('.resource--food em')?.getAttribute('title')).not.toMatch(/noch .* Tage/)
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

/**
 * Die Kopfleiste im Kriegsrat (T-M29-02, D27.1/D27.2, R-UI-03, R-TIME-04, R-UI-10).
 *
 * Tempo und Kartenmodus sind Knopfgruppen mit genau einem gedrueckten Knopf — ein
 * `<select>` sagt nicht auf einen Blick, was gilt, und ein Regler ohne Rasten sagt
 * nicht, wie schnell man wirklich faehrt. Die Tagesbilanz traegt ihr Vorzeichen im
 * Text, nicht nur in der Farbe, damit sie auch ohne Farbe lesbar bleibt.
 */
describe('T-M29-02 Kopfleiste im Kriegsrat', () => {
  const withBalance = (balance: number): PublicView => {
    const base = view(100, [100], 900)
    const flow = { stock: 5000, production: 100, consumption: 0, balance: 100 }
    return {
      ...base,
      self: {
        ...base.self,
        economy: {
          food: { stock: 50_000, production: Math.max(0, balance), consumption: Math.max(0, -balance), balance },
          wood: flow,
          iron: flow,
          coal: flow,
          oil: flow,
          rare: flow,
          money: flow,
        },
      },
    } as PublicView
  }

  it('traegt in der Tempo-Gruppe genau einen gedrueckten Knopf und schaltet per Klick', () => {
    const onSpeed = vi.fn()
    renderHeader(view(100, [100], 900), { speed: 0, onSpeed })
    const group = screen.getByRole('group', { name: 'Geschwindigkeit' })

    const pressed = within(group).getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true')
    expect(pressed.length).toBe(1)
    expect(pressed[0]?.getAttribute('aria-label')).toBe('Pause')

    fireEvent.click(within(group).getByRole('button', { name: '10' }))
    expect(onSpeed).toHaveBeenCalledWith(10)
  })

  it('zeigt bei laufender Uhr die Stufe als gedrueckt, nicht die Pause', () => {
    renderHeader(view(100, [100], 900), { speed: 25 })
    const group = screen.getByRole('group', { name: 'Geschwindigkeit' })

    const pressed = within(group).getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true')
    expect(pressed.map((b) => b.textContent)).toEqual(['25'])
  })

  it('schreibt das Vorzeichen der Tagesbilanz in den Text und die Richtung in die Klasse', () => {
    const { container } = renderHeader(withBalance(-6000))
    const balance = container.querySelector('.resource--food em')

    // Festkomma: −6000 sind −6 je Tag (`rate` rechnet das Tausendstel heraus).
    expect(balance?.textContent).toBe('−6')
    expect(balance?.className).toContain('resource__balance--minus')

    cleanup()
    const plus = renderHeader(withBalance(2200)).container.querySelector('.resource--food em')
    expect(plus?.textContent).toBe('+2')
    expect(plus?.className).toContain('resource__balance--plus')
  })

  it('macht den Kartenmodus zur Knopfgruppe mit genau einem gedrueckten Knopf', () => {
    const onMode = vi.fn()
    renderHeader(view(100, [100], 900), { onMode })
    const group = screen.getByRole('group', { name: 'Kartenmodus' })

    const pressed = within(group).getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true')
    expect(pressed.map((b) => b.textContent)).toEqual(['Besitz'])

    fireEvent.click(within(group).getByRole('button', { name: 'Moral' }))
    expect(onMode).toHaveBeenCalledWith('morale')
  })

  it('haelt einen leeren, verborgenen Platz fuer den Einmarsch-Alarm bereit (T-M28-06)', () => {
    const { container } = renderHeader(view(100, [100], 900))
    const slot = container.querySelector('.header__alarm') as HTMLElement | null

    expect(slot).not.toBeNull()
    expect(slot?.hidden).toBe(true)
    expect(slot?.textContent).toBe('')
  })
})
