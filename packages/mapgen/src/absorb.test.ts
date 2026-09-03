import { describe, expect, it } from 'vitest'
import { planAbsorptions } from './absorb.ts'
import type { NeighbourEdge } from './adjacency.ts'

/**
 * Where the refused territories go (T-M9-02c).
 *
 * The rule has to be defensible, not merely deterministic: a hole belongs to the
 * neighbour it shares the most border with. Handing it to the nearest centre would be
 * close to arbitrary for a sliver along a mountain range, and handing it to the
 * largest neighbour would drop every hole in Europe into whichever big country happens
 * to be adjacent.
 */

const edge = (from: string, to: string, borderKm: number): NeighbourEdge => ({
  from,
  to,
  distanceKm: 100,
  borderKm,
})

describe('R-MAP-01 Zu kleine Gebiete kommen zum Nachbarn', () => {
  it('gibt ein Loch dem Nachbarn mit der laengsten Grenze', () => {
    const plan = planAbsorptions(
      ['LIE'],
      [edge('LIE', 'CHE', 41), edge('LIE', 'AUT', 35)],
      new Set(['CHE', 'AUT']),
    )

    expect(plan).toEqual([{ id: 'LIE', into: 'CHE', borderKm: 41 }])
  })

  it('entscheidet bei gleich langer Grenze immer gleich', () => {
    const forwards = planAbsorptions(
      ['X'],
      [edge('X', 'BBB', 20), edge('X', 'AAA', 20)],
      new Set(['AAA', 'BBB']),
    )
    const backwards = planAbsorptions(
      ['X'],
      [edge('X', 'AAA', 20), edge('X', 'BBB', 20)],
      new Set(['AAA', 'BBB']),
    )

    expect(forwards).toEqual(backwards)
    expect(forwards[0]?.into).toBe('AAA')
  })

  it('gibt ein Loch nicht an ein anderes Loch', () => {
    // Two refused territories side by side: neither may absorb the other, or the map
    // grows a province nobody decided to keep.
    const plan = planAbsorptions(
      ['X', 'Y'],
      [edge('X', 'Y', 90), edge('X', 'KEEP', 10), edge('Y', 'KEEP', 5)],
      new Set(['KEEP']),
    )

    expect(plan).toEqual([
      { id: 'X', into: 'KEEP', borderKm: 10 },
      { id: 'Y', into: 'KEEP', borderKm: 5 },
    ])
  })

  it('laesst eine abgelehnte Insel drausen', () => {
    // No land neighbour, so no hole: the sea is already there.
    const plan = planAbsorptions(['MDV'], [edge('IND-SOUTH', 'LKA', 30)], new Set(['IND-SOUTH', 'LKA']))

    expect(plan).toEqual([])
  })

  it('verteilt mehrere Loecher unabhaengig voneinander', () => {
    const plan = planAbsorptions(
      ['LIE', 'MCO'],
      [edge('LIE', 'CHE', 41), edge('MCO', 'FRA-SE', 6)],
      new Set(['CHE', 'FRA-SE']),
    )

    expect(plan.map((a) => `${a.id}->${a.into}`)).toEqual(['LIE->CHE', 'MCO->FRA-SE'])
  })

  it('gibt bei nichts zu tun nichts zurueck', () => {
    expect(planAbsorptions([], [edge('A', 'B', 10)], new Set(['A', 'B']))).toEqual([])
  })
})
