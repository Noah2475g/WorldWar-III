import { describe, expect, it } from 'vitest'
import { placeBuildings, type Anchor } from './anchors.ts'
import { dominantIcon } from './markers.ts'
import { armyHome, dominantUnitKey, knownBuildings } from './stellung.ts'
import { UNIT_ICONS } from '../ui/icons.tsx'

const RULES = {
  units: {
    infantry: { requiresBuilding: 'barracks' },
    tank: { requiresBuilding: 'factory' },
    heavy_tank: { requiresBuilding: 'factory' },
  },
}

const ANCHORS: Anchor[] = [
  { x: 100, y: 100, edgeDistance: 40 },
  { x: 130, y: 100, edgeDistance: 30 },
  { x: 160, y: 100, edgeDistance: 20 },
  { x: 100, y: 130, edgeDistance: 35 },
  { x: 130, y: 130, edgeDistance: 25 },
  { x: 160, y: 130, edgeDistance: 15 },
]

function pointOf(buildings: Record<string, number>, building: string) {
  const p = placeBuildings(buildings, ANCHORS).find((q) => q.building === building)
  if (!p) throw new Error('Gebaeude nicht platziert: ' + building)
  return { x: p.x, y: p.y }
}

describe('R-MAP-05/AK1 Stellung am Gattungsgebaeude', () => {
  it('(a) Infanterie + Kaserne -> Kasernenpunkt', () => {
    const b = { barracks: 1, factory: 1 }
    expect(armyHome([{ unitKey: 'infantry', hpTotal: 50 }], b, ANCHORS, RULES)).toEqual(pointOf(b, 'barracks'))
  })

  it('(b) Panzer-Mehrheit + Fabrik -> Fabrikpunkt', () => {
    const b = { barracks: 1, factory: 2 }
    const units = [
      { unitKey: 'infantry', hpTotal: 20 },
      { unitKey: 'tank', hpTotal: 80 },
    ]
    expect(armyHome(units, b, ANCHORS, RULES)).toEqual(pointOf(b, 'factory'))
  })

  it('(c) Panzer, nur Kaserne -> null', () => {
    expect(armyHome([{ unitKey: 'tank', hpTotal: 80 }], { barracks: 1 }, ANCHORS, RULES)).toBeNull()
  })

  it('(d) units undefined -> null', () => {
    expect(armyHome(undefined, { barracks: 1 }, ANCHORS, RULES)).toBeNull()
  })

  it('(e) nur unbekannter Schluessel -> null', () => {
    expect(armyHome([{ unitKey: 'ufo', hpTotal: 99 }], { barracks: 1 }, ANCHORS, RULES)).toBeNull()
  })

  it('(f) anchors leer/undefined und buildings undefined -> null', () => {
    const units = [{ unitKey: 'infantry', hpTotal: 50 }]
    expect(armyHome(units, { barracks: 1 }, [], RULES)).toBeNull()
    expect(armyHome(units, { barracks: 1 }, undefined, RULES)).toBeNull()
    expect(armyHome(units, undefined, ANCHORS, RULES)).toBeNull()
  })

  it('(g) heavy_tank + Fabrik Stufe 1 -> Fabrikpunkt (Stufe egal)', () => {
    const b = { factory: 1 }
    expect(armyHome([{ unitKey: 'heavy_tank', hpTotal: 60 }], b, ANCHORS, RULES)).toEqual(pointOf(b, 'factory'))
  })

  it('(h) Gleichstand -> erster', () => {
    const b = { barracks: 1, factory: 1 }
    const units = [
      { unitKey: 'tank', hpTotal: 50 },
      { unitKey: 'infantry', hpTotal: 50 },
    ]
    expect(armyHome(units, b, ANCHORS, RULES)).toEqual(pointOf(b, 'factory'))
    expect(dominantUnitKey([{ unitKey: 'tank', hp: 5 }, { unitKey: 'infantry', hp: 5 }])).toBe('tank')
  })

  it('(i) knownBuildings filtert Stufe 0 und leere Provinzen', () => {
    const out = knownBuildings([
      { id: 'A', buildings: { barracks: 1, factory: 0 } },
      { id: 'B', buildings: { factory: 0 } },
      { id: 'C' },
      { id: 'D', buildings: {} },
    ])
    expect(out).toEqual({ A: { barracks: 1 } })
  })

  it('(j) dominantIcon liefert dasselbe wie vor dem Umbau', () => {
    // Die alte Schleife, woertlich als Referenz.
    const alt = (units: readonly { unitKey: string; hp: number }[]) => {
      let best: { icon: string; hp: number } | null = null
      for (const stack of units) {
        const icon = UNIT_ICONS[stack.unitKey]
        if (!icon) continue
        if (!best || stack.hp > best.hp) best = { icon, hp: stack.hp }
      }
      return best?.icon
    }
    const beispiele = [
      [],
      [{ unitKey: 'infantry', hp: 10 }],
      [{ unitKey: 'ufo', hp: 99 }, { unitKey: 'tank', hp: 3 }],
      [{ unitKey: 'tank', hp: 5 }, { unitKey: 'infantry', hp: 5 }],
      [{ unitKey: 'infantry', hp: 1 }, { unitKey: 'heavy_tank', hp: 70 }, { unitKey: 'bomber', hp: 40 }],
    ]
    for (const units of beispiele) expect(dominantIcon(units)).toBe(alt(units))
  })
})
