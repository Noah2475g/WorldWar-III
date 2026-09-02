import { validateMap } from '@worldwar/core'
import { describe, expect, it } from 'vitest'
import { smallWorld, tinyMap } from './maps'

/**
 * The test map is the ground the whole rule set is developed on (T-M2-02). If it is
 * wrong, every later test is testing the wrong world — so it gets its own checks.
 */
describe('R-MAP-01 Testkarte "Kleine Welt"', () => {
  it('besteht die Kartenvalidierung', () => {
    expect(validateMap(smallWorld())).toEqual({ ok: true })
  })

  it('hat zwoelf Provinzen und drei Nationen', () => {
    const map = smallWorld()
    expect(map.provinces).toHaveLength(12)
    expect(map.startPositions).toHaveLength(3)
  })

  it('enthaelt jeden Gelaendetyp', () => {
    // Terrain drives movement speed and defence bonuses; every type needs a home
    // on the map the rules are tested against.
    const terrains = new Set(smallWorld().provinces.map((province) => province.terrain))
    expect([...terrains].sort()).toEqual(['desert', 'forest', 'mountain', 'plains', 'urban'])
  })

  it('hat Inseln, die nur ueber See erreichbar sind', () => {
    const map = smallWorld()
    const landNeighbours = (id: string) =>
      map.edges.filter((edge) => edge.kind === 'land' && (edge.a === id || edge.b === id))

    expect(landNeighbours('i1')).toHaveLength(0)
    expect(landNeighbours('i2')).toHaveLength(0)
    expect(map.edges.some((edge) => edge.kind === 'sea' && (edge.a === 'i1' || edge.b === 'i1'))).toBe(true)
  })

  it('enthaelt einen Flussuebergang und eine Meerenge', () => {
    // Both change combat (design D6.5): river 0.8, strait 0.7 on the attack.
    const crossings = smallWorld().edges.map((edge) => edge.crossing)
    expect(crossings).toContain('river')
    expect(crossings).toContain('strait')
  })

  it('gibt jeder Kuestenprovinz einen Seeweg', () => {
    const map = smallWorld()
    for (const province of map.provinces.filter((p) => p.coastal)) {
      const hasSea = map.edges.some(
        (edge) => edge.kind === 'sea' && (edge.a === province.id || edge.b === province.id),
      )
      expect(hasSea, `${province.id} ist Kuestenprovinz ohne Seeweg`).toBe(true)
    }
  })

  it('verteilt Vorkommen ueber alle Ressourcen ausser Geld', () => {
    const found = new Set<string>()
    for (const province of smallWorld().provinces) {
      for (const key of Object.keys(province.deposits)) found.add(key)
    }
    for (const resource of ['food', 'wood', 'iron', 'coal', 'oil', 'rare']) {
      expect(found, `Keine Provinz liefert ${resource}`).toContain(resource)
    }
  })

  it('haelt Entfernungen in Festkomma-Kilometern', () => {
    for (const edge of smallWorld().edges) {
      expect(Number.isSafeInteger(edge.distanceKm)).toBe(true)
      expect(edge.distanceKm).toBeGreaterThan(0)
    }
  })
})

describe('R-MAP-01 Kleine Karte fuer schnelle Tests', () => {
  it('besteht ebenfalls die Validierung', () => {
    expect(validateMap(tinyMap())).toEqual({ ok: true })
  })
})
