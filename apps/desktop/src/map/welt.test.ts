import { describe, expect, it } from 'vitest'
import type { View } from './picking.ts'
import type { ArmyMarker, BuildingsByProvince } from './markers.ts'
import { worldRawMarks, type WorldProvinceInfo } from './welt.ts'

/** Welt-Pille Rohmarken (E3a, Plan §11.3 D16-D20, §11.4 Schritt 2). */

const centres = { eigen: { x: 100, y: 100 }, feind: { x: 300, y: 200 }, fremd: { x: 500, y: 50 } }
const far: View = { x: 0, y: 0, scale: 3 }
const mid: View = { x: 0, y: 0, scale: 1.6 }

const army = (id: string, provinceId: string, extra: Partial<ArmyMarker> = {}): ArmyMarker => ({
  id,
  provinceId,
  owner: 'p1',
  strength: 10_000,
  own: true,
  ...extra,
})

describe('worldRawMarks (E3a, D20)', () => {
  it('(a) eigene Provinz mit Gebaeude-Summe 5, keine Armee -> ein Rohmark tone own, buildingSum 5, kein armySum', () => {
    const buildings: BuildingsByProvince = { eigen: { factory: 3, barracks: 2 } }
    const provinces: Record<string, WorldProvinceInfo> = { eigen: { owner: 'p1', relation: 'self' } }
    const marks = worldRawMarks(buildings, [], provinces, centres, far)
    expect(marks).toHaveLength(1)
    expect(marks[0]).toMatchObject({ tone: 'own', provinceId: 'eigen', buildingSum: 5 })
    expect(marks[0]!.armySum).toBeUndefined()
  })

  it('(b) eigene Provinz mit 0 Gebaeuden, 3 eigenen Armeen -> tone own, armySum nach D18, kein buildingSum', () => {
    const buildings: BuildingsByProvince = {}
    const provinces: Record<string, WorldProvinceInfo> = { eigen: { owner: 'p1', relation: 'self' } }
    const armies = [
      army('a1', 'eigen', { count: 5 }),
      army('a2', 'eigen', { count: 3 }),
      army('a3', 'eigen', { count: 2 }),
    ]
    const marks = worldRawMarks(buildings, armies, provinces, centres, far)
    expect(marks).toHaveLength(1)
    expect(marks[0]).toMatchObject({ tone: 'own', provinceId: 'eigen', armySum: 10 })
    expect(marks[0]!.buildingSum).toBeUndefined()
  })

  it('(c) eigene Provinz mit beidem -> beide Felder', () => {
    const buildings: BuildingsByProvince = { eigen: { factory: 4 } }
    const provinces: Record<string, WorldProvinceInfo> = { eigen: { owner: 'p1', relation: 'self' } }
    const armies = [army('a1', 'eigen', { count: 7 })]
    const marks = worldRawMarks(buildings, armies, provinces, centres, far)
    expect(marks).toHaveLength(1)
    expect(marks[0]).toMatchObject({ tone: 'own', buildingSum: 4, armySum: 7 })
  })

  it('(d) Kriegsgegner-Provinz mit Armeen -> tone enemy, nur armySum, kein buildingSum trotz bekannter Gebaeude', () => {
    const buildings: BuildingsByProvince = { feind: { fortress: 9 } } // ausgespaeht bekannt, darf nicht einfliessen (D16)
    const provinces: Record<string, WorldProvinceInfo> = { feind: { owner: 'p2', relation: 'war' } }
    const armies = [army('e1', 'feind', { owner: 'p2', own: false, count: 6 })]
    const marks = worldRawMarks(buildings, armies, provinces, centres, far)
    expect(marks).toHaveLength(1)
    expect(marks[0]).toMatchObject({ tone: 'enemy', provinceId: 'feind', armySum: 6 })
    expect(marks[0]!.buildingSum).toBeUndefined()
  })

  it('(e) friedliche Fremdmacht-Provinz -> kein Rohmark', () => {
    const buildings: BuildingsByProvince = { fremd: { factory: 2 } }
    const provinces: Record<string, WorldProvinceInfo> = { fremd: { owner: 'p3', relation: 'peace' } }
    const armies = [army('f1', 'fremd', { owner: 'p3', own: false, count: 4 })]
    const marks = worldRawMarks(buildings, armies, provinces, centres, far)
    expect(marks).toHaveLength(0)
  })

  it('(f) nur bei zoomTier(scale)==="far" aufgerufen, sonst []', () => {
    const buildings: BuildingsByProvince = { eigen: { factory: 5 } }
    const provinces: Record<string, WorldProvinceInfo> = { eigen: { owner: 'p1', relation: 'self' } }
    expect(worldRawMarks(buildings, [], provinces, centres, mid)).toEqual([])
  })
})
