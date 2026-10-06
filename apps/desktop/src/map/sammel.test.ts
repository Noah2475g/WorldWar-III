import { describe, expect, it } from 'vitest'
import type { View } from './picking.ts'
import { armyScreenPoint, markersFor, pickArmy, pickArmyGroup, toneFor as toneForViaMarkers, type ArmyMarker } from './markers.ts'
import {
  ARMY_GROUP_MIN,
  GROUP_ZOOM_SCALE,
  arrowArmies,
  groupArmies,
  groupKey,
  showDayLabel,
  toneFor,
} from './sammel.ts'

/** Sammelmarke als reine Funktion (T-M49-01, R-MAP-05, D1-D10). */

const centres = { alpha: { x: 100, y: 100 }, beta: { x: 300, y: 200 } }
const mid: View = { x: 0, y: 0, scale: 1.6 }

const army = (id: string, provinceId: string, extra: Partial<ArmyMarker> = {}): ArmyMarker => ({
  id,
  provinceId,
  owner: 'p1',
  strength: 10_000,
  own: true,
  ...extra,
})
const many = (n: number, extra: Partial<ArmyMarker> = {}, prefix = 'a', province = 'alpha'): ArmyMarker[] =>
  Array.from({ length: n }, (_, i) => army(`${prefix}${i}`, province, extra))
const marching = (to: string): NonNullable<ArmyMarker['march']> => ({ toProvinceId: to, departureTick: 0, arrivalTick: 100 })

describe('T-M49-01 Sammelmarke', () => {
  it('Konstanten und toneFor-Wiedereinfuhr', () => {
    expect(ARMY_GROUP_MIN).toBe(4)
    expect(GROUP_ZOOM_SCALE).toBe(1)
    expect(toneForViaMarkers).toBe(toneFor)
    expect(groupKey(army('x', 'alpha'))).toBe('alpha|-|own')
  })

  it('(a) 3 gleiche: keine Gruppe, 4: eine', () => {
    expect(groupArmies(many(3), null).groups).toHaveLength(0)
    expect(groupArmies(many(3), null).singles).toHaveLength(3)
    const r = groupArmies(many(4), null)
    expect(r.groups).toHaveLength(1)
    expect(r.singles).toHaveLength(0)
  })

  it('(b) Station trennt: 4 marschieren nach beta + 4 stehen -> 2 Gruppen', () => {
    const list = [...many(4, { march: marching('beta') }, 'm'), ...many(4, {}, 's')]
    const { groups } = groupArmies(list, null)
    expect(groups).toHaveLength(2)
    expect(groups.map((g) => g.toProvinceId)).toEqual(['beta', null])
  })

  it('(c) Ton trennt: 2 own + 2 other keine, ally != other', () => {
    expect(groupArmies([...many(2, {}, 'o'), ...many(2, { own: false }, 'f')], null).groups).toHaveLength(0)
    const list = [...many(2, { own: false, relation: 'alliance' }, 'a'), ...many(2, { own: false }, 'f')]
    expect(groupArmies(list, null).groups).toHaveLength(0)
    expect(toneFor({ own: false, relation: 'alliance' })).toBe('ally')
    expect(toneFor({ own: false, relation: 'war' })).toBe('enemy')
  })

  it('(d) gewaehlte Armee raus: 4 inkl. -> 4 Einzelne, 5 inkl. -> Gruppe 4 + 1 Einzelne', () => {
    const four = many(4)
    expect(groupArmies(four, 'a1')).toMatchObject({ groups: [], singles: four })
    const five = many(5)
    const r = groupArmies(five, 'a2')
    expect(r.groups).toHaveLength(1)
    expect(r.groups[0]!.members.map((m) => m.id)).toEqual(['a0', 'a1', 'a3', 'a4'])
    expect(r.singles.map((m) => m.id)).toEqual(['a2'])
  })

  it('(e) icon nach count-Summe, Gleichstand erstes, fremd ohne icon', () => {
    const list = [
      army('a0', 'alpha', { icon: 'infantry', count: 5 }),
      army('a1', 'alpha', { icon: 'artillery', count: 4 }),
      army('a2', 'alpha', { icon: 'artillery', count: 3 }),
      army('a3', 'alpha', { icon: 'infantry', count: 1 }),
    ]
    expect(groupArmies(list, null).groups[0]!.icon).toBe('artillery')
    const tie = [
      army('a0', 'alpha', { icon: 'infantry', count: 4 }),
      army('a1', 'alpha', { icon: 'artillery', count: 4 }),
      ...many(2, {}, 'x'),
    ]
    expect(groupArmies(tie, null).groups[0]!.icon).toBe('infantry')
    const foreign = many(4, { own: false })
    expect(groupArmies(foreign, null).groups[0]!.icon).toBeUndefined()
  })

  it('(f) rep: erstes Mitglied mit dem Gruppen-icon, sonst erstes', () => {
    const list = [
      army('a0', 'alpha', { icon: 'infantry', count: 1 }),
      army('a1', 'alpha', { icon: 'artillery', count: 9 }),
      army('a2', 'alpha', { icon: 'artillery', count: 9 }),
      army('a3', 'alpha'),
    ]
    expect(groupArmies(list, null).groups[0]!.rep.id).toBe('a1')
    expect(groupArmies(many(4), null).groups[0]!.rep.id).toBe('a0')
  })

  it('(g) label: Summe, k ab 1000, x n fuer fremde', () => {
    expect(groupArmies(many(4, { count: 12 }), null).groups[0]!.label).toBe('48')
    const big = [600, 600, 17, 17].map((count, i) => army(`b${i}`, 'alpha', { count }))
    expect(groupArmies(big, null).groups[0]!.label).toBe('1k')
    expect(groupArmies(many(5, { own: false }), null).groups[0]!.label).toBe('×5')
    const mixed = [...many(3, { count: 5 }), army('z', 'alpha')]
    expect(groupArmies(mixed, null).groups[0]!.label).toBe('×4')
  })

  it('(h) markersFor mit grouping auf near ist gleich ohne grouping', () => {
    const armies = many(10)
    for (const scale of [1, 0.5]) {
      const v: View = { x: 0, y: 0, scale }
      const without = markersFor(armies, {}, centres, v)
      const withGrouping = markersFor(armies, {}, centres, v, { grouping: { selectedArmyId: null } })
      expect(withGrouping).toEqual(without)
    }
  })

  it('(i) bei 1.6 genau eine armyGroup am Punkt des Vertreters', () => {
    const armies = [
      army('a0', 'alpha', { icon: 'infantry', count: 2 }),
      army('a1', 'alpha', { icon: 'artillery', count: 7 }),
      army('a2', 'alpha', { icon: 'artillery', count: 7 }),
      army('a3', 'alpha', { icon: 'infantry', count: 2 }),
    ]
    const groups = markersFor(armies, {}, centres, mid, { grouping: { selectedArmyId: null } })
    expect(groups.filter((m) => m.kind === 'army')).toHaveLength(0)
    const g = groups.filter((m) => m.kind === 'armyGroup')
    expect(g).toHaveLength(1)
    const rep = armyScreenPoint(armies[1]!, centres, mid)!
    expect(g[0]).toMatchObject({ x: rep.x, y: rep.y, armyIds: ['a0', 'a1', 'a2', 'a3'], label: '18', icon: 'artillery', tone: 'own', own: true })
  })

  it('(j) pickArmy trifft auf der Gruppenmarke kein Mitglied, aber die gewaehlte Armee', () => {
    const armies = many(5)
    const extras = { grouping: { selectedArmyId: 'a2' } }
    const markers = markersFor(armies, {}, centres, mid, extras)
    const g = markers.find((m) => m.kind === 'armyGroup')!
    const single = markers.find((m) => m.kind === 'army')!
    expect(single.armyId).toBe('a2')
    expect(pickArmy({ x: g.x, y: g.y }, armies, centres, mid, extras)).toBeNull()
    expect(pickArmy({ x: single.x, y: single.y }, armies, centres, mid, extras)).toBe('a2')
  })

  it('(k) pickArmyGroup: Mitte trifft, 40 px daneben nicht', () => {
    const armies = many(4, { own: false })
    const extras = { grouping: { selectedArmyId: null } }
    const g = markersFor(armies, {}, centres, mid, extras).find((m) => m.kind === 'armyGroup')!
    expect(pickArmyGroup({ x: g.x, y: g.y }, armies, centres, mid, extras)).toEqual({ armyIds: ['a0', 'a1', 'a2', 'a3'], x: g.x, y: g.y })
    expect(pickArmyGroup({ x: g.x + 40, y: g.y }, armies, centres, mid, extras)).toBeNull()
    expect(pickArmyGroup({ x: g.x, y: g.y }, armies, centres, mid)).toBeNull()
  })

  it('(l) arrowArmies und showDayLabel: near vs mid', () => {
    const list = [...many(4, { march: marching('beta') }), army('solo', 'beta')]
    expect(arrowArmies(list, 1, null)).toEqual(list)
    expect(arrowArmies(list, 1.6, null).map((a) => a.id)).toEqual(['a0', 'solo'])
    expect(arrowArmies(list, 3, 'a1').map((a) => a.id)).toEqual(['a0', 'a1', 'a2', 'a3', 'solo'])
    expect(showDayLabel('a0', 1, null)).toBe(true)
    expect(showDayLabel('a0', 1.6, null)).toBe(false)
    expect(showDayLabel('a0', 1.6, 'a0')).toBe(true)
    expect(showDayLabel('a0', 4, 'a1')).toBe(false)
  })

  it('(m) Cache: mit grouping, dann ohne grouping -> keine armyGroup', () => {
    const armies = many(6)
    const first = markersFor(armies, {}, centres, mid, { grouping: { selectedArmyId: null } })
    expect(first.some((m) => m.kind === 'armyGroup')).toBe(true)
    const second = markersFor(armies, {}, centres, mid)
    expect(second.some((m) => m.kind === 'armyGroup')).toBe(false)
    expect(second.filter((m) => m.kind === 'army')).toHaveLength(6)
    const third = markersFor(armies, {}, centres, mid, { grouping: { selectedArmyId: 'a0' } })
    expect(third.filter((m) => m.kind === 'army')).toHaveLength(1)
  })
})
