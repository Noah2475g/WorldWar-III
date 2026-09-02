import { smallWorld } from '@worldwar/testkit'
import { describe, expect, it } from 'vitest'
import type { Edge } from '../state/types'
import { defaultEdgeCost, edgesOf, findPath, neighborsOf, reachableFrom } from './pathfinding'

const map = smallWorld()

describe('R-UNIT-04 Nachbarschaft', () => {
  it('nennt die Nachbarn einer Provinz in fester Reihenfolge', () => {
    expect(neighborsOf(map, 'n1')).toEqual(['i1', 'n2', 'n3', 's1'])
  })

  it('kann Seewege ausblenden', () => {
    expect(neighborsOf(map, 'n1', false)).toEqual(['n2', 'n3'])
  })

  it('findet die Kanten einer Provinz', () => {
    const edges = edgesOf(map, 'i1')
    expect(edges).toHaveLength(2)
    expect(edges.every((edge) => edge.kind === 'sea')).toBe(true)
  })
})

describe('R-UNIT-04 Wegfindung ueber Land', () => {
  it('findet den kuerzesten Weg zwischen benachbarten Provinzen', () => {
    const result = findPath(map, 'n1', 'n2')
    expect(result?.path).toEqual(['n2'])
  })

  it('findet einen mehrstufigen Weg quer ueber den Kontinent', () => {
    // n1 -> n2 -> m1 -> o1: the only sensible land route to the eastern capital.
    const result = findPath(map, 'n1', 'o1', { canUseSea: false })
    expect(result?.path).toEqual(['n2', 'm1', 'o1'])
  })

  it('liefert einen leeren Weg fuer Start gleich Ziel', () => {
    expect(findPath(map, 'm1', 'm1')).toEqual({ path: [], cost: 0 })
  })

  it('kennt unbekannte Provinzen nicht', () => {
    expect(findPath(map, 'n1', 'atlantis')).toBeNull()
    expect(findPath(map, 'atlantis', 'n1')).toBeNull()
  })
})

describe('R-UNIT-06 Seewege sind an Transportfaehigkeit gebunden', () => {
  it('erreicht die Insel nur mit Seefaehigkeit', () => {
    // This is the rule that keeps continents apart until someone builds transports.
    expect(findPath(map, 'n1', 'i1', { canUseSea: false })).toBeNull()
    expect(findPath(map, 'n1', 'i1', { canUseSea: true })?.path).toEqual(['i1'])
  })

  it('nutzt die Meerenge als Abkuerzung, wenn erlaubt', () => {
    const bySea = findPath(map, 'n1', 's1', { canUseSea: true })
    const byLand = findPath(map, 'n1', 's1', { canUseSea: false })
    expect(bySea).not.toBeNull()
    expect(byLand).not.toBeNull()
    expect(bySea!.cost).toBeLessThanOrEqual(byLand!.cost)
  })
})

describe('R-UNIT-04 Gesperrte Provinzen', () => {
  it('umgeht Provinzen, die nicht betreten werden duerfen', () => {
    const direct = findPath(map, 'n1', 'o1', { canUseSea: false })
    expect(direct?.path).toContain('m1')

    // With the middle blocked, the southern detour is the remaining land route.
    const detour = findPath(map, 'n1', 'o1', { canUseSea: false, canEnter: (id) => id !== 'm1' })
    expect(detour).not.toBeNull()
    expect(detour!.path).not.toContain('m1')
    expect(detour!.cost).toBeGreaterThan(direct!.cost)
  })

  it('meldet keinen Weg, wenn jede Route gesperrt ist', () => {
    // Both corridors east closed: the caller turns this into NO_PATH.
    const blocked = findPath(map, 'n1', 'o1', {
      canUseSea: false,
      canEnter: (id) => id !== 'm1' && id !== 'm2',
    })
    expect(blocked).toBeNull()
  })

  it('laesst das Ziel selbst immer betreten', () => {
    // Attacking into enemy territory is exactly the case where canEnter says no —
    // the destination must stay reachable or no attack could ever be ordered.
    const result = findPath(map, 'n1', 'n2', { canEnter: () => false })
    expect(result?.path).toEqual(['n2'])
  })
})

describe('R-ARCH-01 Wegfindung ist deterministisch', () => {
  it('waehlt bei gleichen Kosten immer denselben Weg', () => {
    // Two equally expensive routes: the choice must come from the id comparison,
    // never from object iteration order.
    const symmetric = structuredClone(map)
    for (const edge of symmetric.edges) (edge as Edge).distanceKm = 100_000

    const first = findPath(symmetric, 'n1', 'o2')
    for (let i = 0; i < 20; i++) {
      expect(findPath(symmetric, 'n1', 'o2')).toEqual(first)
    }
  })

  it('liefert dieselbe Route unabhaengig von der Kantenreihenfolge', () => {
    const shuffled = structuredClone(map)
    shuffled.edges = [...shuffled.edges].reverse()
    const index: Record<string, number[]> = {}
    for (const province of shuffled.provinces) index[province.id] = []
    shuffled.edges.forEach((edge, i) => {
      index[edge.a]!.push(i)
      index[edge.b]!.push(i)
    })
    shuffled.edgesByProvince = index

    expect(findPath(shuffled, 'n1', 'o1', { canUseSea: false })?.path).toEqual(
      findPath(map, 'n1', 'o1', { canUseSea: false })?.path,
    )
  })
})

describe('R-UNIT-04 Kosten', () => {
  it('rechnet Entfernung in Ticks um, mindestens einen', () => {
    expect(defaultEdgeCost({ distanceKm: 90_000 } as Edge)).toBe(1)
    expect(defaultEdgeCost({ distanceKm: 260_000 } as Edge)).toBe(3)
    expect(defaultEdgeCost({ distanceKm: 1 } as Edge)).toBe(1)
  })

  it('nutzt die uebergebene Kostenfunktion', () => {
    // Mountains cost triple: the route should avoid them when there is an alternative.
    const throughMountains = findPath(map, 'n1', 'm2', {
      canUseSea: false,
      edgeCost: (edge, _from, to) => (to === 'n3' ? 30 : 1),
    })
    expect(throughMountains?.path).not.toContain('n3')
  })

  it('summiert die Kosten des gesamten Weges', () => {
    const result = findPath(map, 'n1', 'o1', { canUseSea: false, edgeCost: () => 5 })
    expect(result?.cost).toBe(15) // three edges
  })
})

describe('R-MAP-02 Erreichbarkeit', () => {
  it('erreicht vom Festland aus alles ausser den Inseln, wenn kein Schiff da ist', () => {
    const reachable = reachableFrom(map, 'n1', { canUseSea: false })
    expect(reachable.has('o2')).toBe(true)
    expect(reachable.has('i1')).toBe(false)
    expect(reachable.has('i2')).toBe(false)
  })

  it('erreicht mit Schiffen die ganze Karte', () => {
    expect(reachableFrom(map, 'n1', { canUseSea: true }).size).toBe(map.provinces.length)
  })
})
