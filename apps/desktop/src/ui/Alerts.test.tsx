// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { PublicView } from '@worldwar/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Alerts, UNREST_MORALE, alertsFor } from './Alerts.tsx'
import { categoryOf } from './Panels.tsx'

/**
 * What needs looking at (T-M13-13, R-UI-14, R-GAME-06).
 *
 * The log says what happened and keeps saying it; at a hundred game hours a second the
 * one line that mattered scrolls past between two blinks. These are conditions rather
 * than events — one entry for as long as the battle lasts, not one per tick — and the
 * log finally gets the filter R-GAME-06 asked for in M5.
 */

afterEach(cleanup)

const view = (options: {
  battles?: string[]
  shortages?: string[]
  provinces?: { id: string; name: string; owner: string; morale?: number }[]
  capital?: string | null
}): PublicView =>
  ({
    tick: 100,
    playerId: 'p1',
    self: {
      nation: 'Nordland',
      shortages: options.shortages ?? [],
      capitalProvinceId: options.capital === undefined ? 'A' : options.capital,
      score: 10,
    },
    others: [],
    relations: {},
    provinces: (options.provinces ?? [{ id: 'A', name: 'Alpha', owner: 'p1' }]).map((province) => ({
      ...province,
      stale: false,
      asOfTick: 0,
    })),
    armies: [],
    battles: (options.battles ?? []).map((provinceId) => ({ provinceId, startedTick: 90 })),
    marketPrices: {},
    victory: { condition: 'points', winner: null },
  }) as unknown as PublicView

describe('R-UI-14 Meldungen entstehen aus der Lage', () => {
  it('meldet einen Kampf im eigenen Gebiet', () => {
    const alerts = alertsFor(view({ battles: ['A'] }))

    expect(alerts.map((alert) => alert.kind)).toEqual(['battle'])
    expect(alerts[0]!.text).toContain('Alpha')
    expect(alerts[0]!.provinceId).toBe('A')
  })

  it('meldet keinen Kampf anderswo', () => {
    const alerts = alertsFor(
      view({
        battles: ['B'],
        provinces: [
          { id: 'A', name: 'Alpha', owner: 'p1' },
          { id: 'B', name: 'Beta', owner: 'p2' },
        ],
      }),
    )

    expect(alerts).toEqual([])
  })

  it('gibt derselben Lage dieselbe Kennung — sonst waere jede Sekunde eine neue Meldung', () => {
    const first = alertsFor(view({ battles: ['A'] }))
    const later = alertsFor(view({ battles: ['A'] }))

    expect(first[0]!.id).toBe(later[0]!.id)
  })

  it('meldet Mangel und Aufstandsgefahr', () => {
    const alerts = alertsFor(
      view({
        shortages: ['iron'],
        provinces: [{ id: 'A', name: 'Alpha', owner: 'p1', morale: UNREST_MORALE - 1000 }],
      }),
    )

    expect(alerts.map((alert) => alert.kind).sort()).toEqual(['shortage', 'unrest'])
  })

  it('meldet keine Unruhe bei zufriedener Provinz', () => {
    const alerts = alertsFor(view({ provinces: [{ id: 'A', name: 'Alpha', owner: 'p1', morale: 70_000 }] }))

    expect(alerts).toEqual([])
  })

  it('meldet die verlorene Hauptstadt', () => {
    const alerts = alertsFor(
      view({ capital: 'A', provinces: [{ id: 'A', name: 'Alpha', owner: 'p2' }] }),
    )

    expect(alerts.map((alert) => alert.kind)).toContain('capital')
  })

  it('fuehrt die Karte zum Ort, wenn man die Meldung anklickt', () => {
    const onJump = vi.fn()
    render(<Alerts alerts={alertsFor(view({ battles: ['A'] }))} onJump={onJump} />)

    fireEvent.click(screen.getByRole('button', { name: /Alpha/ }))

    expect(onJump).toHaveBeenCalledWith('A')
  })

  it('zeigt nichts, wenn nichts anliegt', () => {
    const { container } = render(<Alerts alerts={[]} onJump={() => undefined} />)

    expect(container.firstChild).toBeNull()
  })
})

describe('R-GAME-06 Das Protokoll ist filterbar', () => {
  it('ordnet jedes Ereignis einer Schublade zu', () => {
    expect(categoryOf('BATTLE_STARTED')).toBe('combat')
    expect(categoryOf('PROVINCE_CAPTURED')).toBe('combat')
    expect(categoryOf('BUILD_COMPLETED')).toBe('economy')
    expect(categoryOf('TRADE_EXECUTED')).toBe('economy')
    expect(categoryOf('WAR_DECLARED')).toBe('diplomacy')
    expect(categoryOf('DAY_REPORT')).toBe('other')
  })
})

/**
 * Die Freischaltungsmeldung beugt ihr Pronomen (T-M23-02, R-UI-07, Befund V2-11).
 *
 * "Neu ab heute: Kaserne. Sie koennen ES jetzt bauen." — das Pronomen hing nicht am
 * Genus der Sache. Die Genus-Tabelle (de.grammar) speist den Satz: die Kaserne → sie,
 * der Hafen → ihn, das Jagdflugzeug → es.
 */
describe('R-UI-07 Die Freischaltungsmeldung beugt ihr Pronomen', () => {
  // view() steht auf Tick 100: Tagesanfang von Spieltag 5 — die Meldung erscheint.
  const regeln = {
    constants: { ticksPerDay: 24 },
    buildings: { barracks: { availableFromDay: 5 }, harbour: { availableFromDay: 5 } },
    units: { infantry: { availableFromDay: 5 }, tank: { availableFromDay: 5 }, fighter: { availableFromDay: 5 } },
  }

  it('setzt das Pronomen nach dem Genus der Sache', () => {
    const texte = Object.fromEntries(alertsFor(view({}), regeln).map((alert) => [alert.id, alert.text]))

    expect(texte['unlock:building:barracks']).toBe('Neu ab heute: Kaserne. Sie können sie jetzt bauen.')
    expect(texte['unlock:building:harbour']).toBe('Neu ab heute: Hafen. Sie können ihn jetzt bauen.')
    expect(texte['unlock:unit:infantry']).toBe('Neu ab heute: Infanterie. Sie können sie jetzt ausheben.')
    expect(texte['unlock:unit:tank']).toBe('Neu ab heute: Kampfpanzer. Sie können ihn jetzt ausheben.')
    expect(texte['unlock:unit:fighter']).toBe('Neu ab heute: Jagdflugzeug. Sie können es jetzt ausheben.')
  })
})
