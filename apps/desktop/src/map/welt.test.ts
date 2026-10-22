import { describe, expect, it } from 'vitest'
import type { View } from './picking.ts'
import type { ArmyMarker, BuildingsByProvince } from './markers.ts'
import { clusterWorldMarks, worldRawMarks, type WorldProvinceInfo, type WorldRawMark } from './welt.ts'

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

/**
 * clusterWorldMarks (AK15-Nachbesserung, Review-Runde 1): echtes macht-uebergreifendes
 * Zusammenlegen VOR dem Platzieren. Testfaelle mit realistischer Segment-Groesse
 * (WORLD_PILL_SEGMENT/BUILDING_GROUP_BOX = 20x20 px, zwei Segmente 41x20 px) statt der
 * alten 160x160-Taeuschung — der Befund war ja gerade, dass die kleinen Boxen den
 * Merge-Zweig in `layoutMarks` nie erreichen. Hier geht es nur um den Cluster-Vorlauf
 * selbst, nicht um `layoutMarks`.
 */
const own = (provinceId: string, x: number, y: number, extra: Partial<WorldRawMark> = {}): WorldRawMark => ({
  tone: 'own',
  provinceId,
  ownerId: 'p1',
  x,
  y,
  buildingSum: 5,
  ...extra,
})

describe('clusterWorldMarks (AK15-Nachbesserung, Review-Runde 1)', () => {
  it.each([15, 50, 70])('Abstand %i px (< 72) -> zusammengelegt zu einer Marke', (gap) => {
    const marks = [own('a', 0, 0), own('b', gap, 0)]
    const out = clusterWorldMarks(marks, 72)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ provinceId: 'a', ownerId: 'p1', buildingSum: 10 })
    expect(out[0]!.memberProvinceIds).toEqual(['a', 'b'])
  })

  it('Abstand 80 px (>= 72) -> NICHT zusammengelegt, zwei Marken bleiben', () => {
    const marks = [own('a', 0, 0), own('b', 80, 0)]
    const out = clusterWorldMarks(marks, 72)
    expect(out).toHaveLength(2)
    expect(out.map((m) => m.provinceId).sort()).toEqual(['a', 'b'])
    expect(out.every((m) => m.memberProvinceIds === undefined)).toBe(true)
  })

  it('Abstand genau 72 px -> NICHT zusammengelegt (< ist strikt, Grenze gehoert noch nicht dazu)', () => {
    const marks = [own('a', 0, 0), own('b', 72, 0)]
    const out = clusterWorldMarks(marks, 72)
    expect(out).toHaveLength(2)
  })

  it('Runde 2 AK15: verkettet NICHT mehr transitiv: a-b < 72, b-c < 72, a-c >= 72 -> zwei Gruppen (kein Single-Linkage-Chaining)', () => {
    const marks = [own('a', 0, 0), own('b', 50, 0), own('c', 100, 0)]
    const out = clusterWorldMarks(marks, 72)
    // a-c = 100 >= 72, duerfen NICHT in derselben Gruppe landen (Complete-Linkage-Obergrenze).
    expect(out).toHaveLength(2)
    const grouped = out.find((m) => m.memberProvinceIds !== undefined)
    const single = out.find((m) => m.memberProvinceIds === undefined)
    expect(grouped!.memberProvinceIds).toEqual(['a', 'b'])
    expect(grouped!.buildingSum).toBe(10)
    expect(single!.provinceId).toBe('c')
    expect(single!.buildingSum).toBe(5)
  })

  it('Runde 2 AK15: lange Kette a-b-c-d-e (je < 72 px benachbart, a-e weit auseinander) zerfaellt in mehrere Gruppen, nicht eine Monster-Gruppe', () => {
    const marks = [own('a', 0, 0), own('b', 50, 0), own('c', 100, 0), own('d', 150, 0), own('e', 200, 0)]
    const out = clusterWorldMarks(marks, 72)
    // a-e = 200 px >= 72: duerften unter keinen Umstaenden in derselben Gruppe landen.
    expect(out.length).toBeGreaterThan(1)
    const groupOfA = out.find((m) => m.provinceId === 'a' || m.memberProvinceIds?.includes('a'))!
    const groupOfE = out.find((m) => m.provinceId === 'e' || m.memberProvinceIds?.includes('e'))!
    expect(groupOfA).not.toBe(groupOfE)
    expect(groupOfA.memberProvinceIds?.includes('e')).toBeFalsy()
    expect(groupOfE.memberProvinceIds?.includes('a')).toBeFalsy()
    // Jede resultierende Gruppe muss paarweise < 72 px Ausdehnung haben (Obergrenze eingehalten).
    for (const m of out) {
      if (m.memberProvinceIds) {
        const xs = m.memberProvinceIds.map((id) => marks.find((mk) => mk.provinceId === id)!.x)
        expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(72)
      }
    }
  })

  it('verschiedene Macht (ownerId) in Reichweite -> NICHT zusammengelegt', () => {
    const marks = [own('a', 0, 0), own('b', 15, 0, { ownerId: 'p2' })]
    const out = clusterWorldMarks(marks, 72)
    expect(out).toHaveLength(2)
  })

  it('verschiedener tone (own/enemy) in Reichweite -> NICHT zusammengelegt', () => {
    const marks = [own('a', 0, 0), own('b', 15, 0, { tone: 'enemy' })]
    const out = clusterWorldMarks(marks, 72)
    expect(out).toHaveLength(2)
  })

  it('armySum wird addiert, Symbol ist das der groessten Einzelsumme', () => {
    const marks = [
      { tone: 'own' as const, provinceId: 'a', ownerId: 'p1', x: 0, y: 0, armySum: 3, armyIcon: 'infantry' as const },
      { tone: 'own' as const, provinceId: 'b', ownerId: 'p1', x: 10, y: 0, armySum: 20, armyIcon: 'armour' as const },
    ]
    const out = clusterWorldMarks(marks, 72)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ armySum: 23, armyIcon: 'armour' })
  })

  it('Schwerpunkt (Mittel) der Mitglieder als neuer Ankerpunkt', () => {
    const marks = [own('a', 0, 0), own('b', 20, 0)]
    const out = clusterWorldMarks(marks, 72)
    expect(out[0]).toMatchObject({ x: 10, y: 0 })
  })

  it('leere Eingabe -> leere Ausgabe (keine Division durch 0)', () => {
    expect(clusterWorldMarks([], 72)).toEqual([])
  })

  it('einzelne Marke ohne Nachbarn bleibt unveraendert, ohne memberProvinceIds', () => {
    const marks = [own('a', 0, 0)]
    const out = clusterWorldMarks(marks, 72)
    expect(out).toEqual(marks)
  })
})
