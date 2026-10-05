// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { cleanup, render, screen } from '@testing-library/react'
import type { PublicView } from '@worldwar/core'
import { afterEach, describe, expect, it } from 'vitest'
import { Tooltip, tooltipFor } from './Tooltip.tsx'

/**
 * Die Provinz erklaert sich im Tooltip (T-M31-01, D27.6).
 *
 * Zwei Zusagen: der Inhalt kommt aus der SICHT (was der Spieler nicht sehen darf,
 * steht nicht da), und die Auskunft ist dieselbe fuer Maus und Tastatur — die
 * Komponente kennt keinen Zeiger, nur einen Anker.
 */

afterEach(cleanup)

const view = {
  tick: 100,
  playerId: 'p1',
  provinces: [
    { id: 'A', owner: 'p1', kind: 'city', terrain: 'mountain', coastal: false, morale: 64_000, stale: false, asOfTick: 100 },
    { id: 'B', owner: 'p2', kind: 'rural', terrain: 'plains', coastal: true, stale: true, asOfTick: 30 },
    { id: 'C', owner: null, kind: 'rural', terrain: 'desert', coastal: false, stale: false, asOfTick: 100 },
  ],
  armies: [
    { id: 'a1', owner: 'p1', provinceId: 'A', strength: 4000 },
    { id: 'a2', owner: 'p2', provinceId: 'A', strength: 2500 },
  ],
  battles: [{ provinceId: 'A', startedTick: 60 }],
} as unknown as PublicView

const sources = {
  nameOf: (id: string) => ({ A: 'Alpenland', B: 'Bergen', C: 'Wueste' })[id] ?? id,
  playerName: (id: string) => ({ p1: 'Nordland', p2: 'Ostmark' })[id] ?? id,
  ticksPerDay: 24,
}

describe('T-M31-01 Die Provinz erklaert sich im Tooltip', () => {
  it('baut die Auskunft aus der Sicht: Name, Besitzer, Moral, Armeen, Gefechtsrunde', () => {
    expect(tooltipFor('A', view, sources)).toEqual({
      provinceId: 'A',
      name: 'Alpenland',
      owner: 'Nordland',
      terrain: 'mountain',
      moralePercent: 64,
      armies: { count: 2, strength: 6500 },
      // Tick 100 bei Beginn 60 und 24 je Tag: der zweite Tag des Gefechts.
      battleRound: 2,
      staleDay: null,
    })
  })

  it('verschweigt, was die Sicht nicht kennt: fremde Moral, und nennt den Stand veralteter Sicht', () => {
    const b = tooltipFor('B', view, sources)!
    expect(b.moralePercent).toBeNull()
    expect(b.battleRound).toBeNull()
    expect(b.staleDay).toBe(2)
    expect(tooltipFor('C', view, sources)!.owner).toBeNull()
  })

  it('gibt fuer Unbekanntes nichts zurueck', () => {
    expect(tooltipFor('gibtesnicht', view, sources)).toBeNull()
    expect(tooltipFor(null, view, sources)).toBeNull()
    expect(tooltipFor('A', null, sources)).toBeNull()
  })

  it('rendert als role="tooltip" mit Name, Land, Moral, Gelaende, Armeen, Gefecht und Bedienhinweis', () => {
    render(<Tooltip data={tooltipFor('A', view, sources)!} x={10} y={20} />)

    const tip = screen.getByRole('tooltip')
    expect(tip.textContent).toContain('Alpenland')
    expect(tip.textContent).toContain('Nordland')
    expect(tip.textContent).toContain('64 %')
    expect(tip.textContent).toContain('Gebirge')
    expect(tip.textContent).toContain('Verteidigung +30 %')
    expect(tip.textContent).toContain('2 Armeen')
    expect(tip.textContent).toContain('Runde 2')
    expect(tip.textContent).toMatch(/Klicken/)
    // Neben dem Anker, nicht darauf: der Zeiger soll den Kasten nicht verdecken.
    expect(tip.style.left).toBe('24px')
    expect(tip.style.top).toBe('34px')
    // Zeitlimit wegen Last, nicht Verhalten: allein 224 ms, unter verify+Last max 7162 ms (gemessen 2026-10-05, t_3cad0a35).
  }, 30_000)

  it('sagt "keine" statt "0 Armeen" und laesst die Gefechtszeile ohne Gefecht weg', () => {
    render(<Tooltip data={tooltipFor('C', view, sources)!} x={0} y={0} />)

    const tip = screen.getByRole('tooltip')
    expect(tip.textContent).toContain('neutral')
    expect(tip.textContent).toContain('keine')
    expect(tip.textContent).not.toMatch(/Runde/)
  })
})

/**
 * R-UX-02/AK3 · Der Auswahl-Tooltip nennt keine Mausbedienung (T-M44-07, Befund B-06).
 *
 * Eine schon gewaehlte Provinz sagt nicht mehr „Klicken: auswaehlen" — das hat sie hinter sich.
 * Der Kasten ist Auskunft und kein Knopf: man kann ihn nicht markieren (`user-select: none`),
 * damit ein Ziehen ueber die Karte nicht seinen Text greift.
 */
describe('R-UX-02/AK3 Der Tooltip einer gewaehlten Provinz', () => {
  it('nennt „Klicken: auswaehlen" nur, solange die Provinz noch nicht gewaehlt ist (heute rot)', () => {
    render(<Tooltip data={tooltipFor('A', view, sources)!} x={0} y={0} />)
    expect(screen.getByRole('tooltip').textContent).toMatch(/Klicken/)

    cleanup()
    render(<Tooltip data={tooltipFor('A', view, sources)!} x={0} y={0} selected />)
    const tip = screen.getByRole('tooltip').textContent ?? ''
    expect(tip).not.toMatch(/Klick|Maus/)
    expect(tip).toMatch(/Escape/)
  })

  it('verbietet das Markieren seines Textes in app.css', () => {
    const css = readFileSync(`${process.cwd()}/apps/desktop/src/ui/app.css`, 'utf8')
    // Alle Regeln fuer `.tooltip`: der Block von T-M44-07 steht am Ende von app.css.
    const rules = [...css.matchAll(/\n\.tooltip\s*\{([^}]*)\}/g)].map((match) => match[1]!)
    expect(rules.length).toBeGreaterThan(0)
    expect(rules.join('\n')).toMatch(/user-select:\s*none/)
  })
})
