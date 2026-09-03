import { describe, expect, it } from 'vitest'
import { MAP_COLORS } from './render.ts'
import { colorForPlayer, fillFor } from './modes.ts'
import { zoomAt, type View, type ViewLimits } from './picking.ts'
import { BUILDING_OFFSET_Y, MAX_BUILDING_PIPS, markersFor, type ArmyMarker } from './markers.ts'
import { PLAYER_COLORS, contrastRatio, deltaE } from '../ui/tokens.ts'

/**
 * What the map shows (R-MAP-05).
 *
 * The requirement lists five things: provinces coloured by owner, visible borders,
 * zoom and pan, and units, buildings and combat symbols on top. Each of them is a pure
 * function underneath the canvas, so each of them can be checked here — the canvas
 * itself only turns this list into pixels.
 */

const centres = { alpha: { x: 100, y: 100 }, beta: { x: 300, y: 200 }, gamma: { x: 500, y: 50 } }
const view: View = { x: 0, y: 0, scale: 1 }

const army = (id: string, provinceId: string, extra: Partial<ArmyMarker> = {}): ArmyMarker => ({
  id,
  provinceId,
  owner: 'p1',
  strength: 10_000,
  own: true,
  ...extra,
})

describe('R-MAP-05 Kartendarstellung', () => {
  it('faerbt Provinzen nach Eigentuemer', () => {
    const owners = ['p1', 'p2', 'p3', 'p4']
    const fills = owners.map((owner) => fillFor({ id: owner, owner }, 'political'))

    expect(new Set(fills).size, 'Zwei Maechte teilen sich eine Farbe').toBe(owners.length)
    for (const fill of fills) {
      expect(Object.values(PLAYER_COLORS)).toContain(fill)
    }
  })

  it('faerbt herrenloses Land anders als jede Macht', () => {
    const neutral = fillFor({ id: 'x', owner: null }, 'political')
    for (const owner of ['p1', 'p2', 'p3']) {
      expect(neutral).not.toBe(colorForPlayer(owner))
    }
  })

  it('haelt die Grenzen von jeder Fuellfarbe unterscheidbar', () => {
    // Eine Grenze, die auf einer Provinzfarbe verschwindet, ist keine Grenze.
    for (const [name, fill] of Object.entries(PLAYER_COLORS)) {
      expect(deltaE(MAP_COLORS.border, fill), `Grenze auf ${name} nicht zu sehen`).toBeGreaterThan(10)
    }
    expect(contrastRatio(MAP_COLORS.border, MAP_COLORS.sea)).toBeGreaterThan(1.3)
  })

  it('haelt beim Zoomen den Punkt unter dem Zeiger fest', () => {
    const limits: ViewLimits = {
      width: 2000,
      height: 1000,
      viewportWidth: 800,
      viewportHeight: 600,
      minScale: 0.25,
      maxScale: 4,
    }
    const cursor = { x: 400, y: 300 }
    const before = { x: view.x + cursor.x * view.scale, y: view.y + cursor.y * view.scale }

    const zoomed = zoomAt(view, cursor, 0.5, limits)
    const after = { x: zoomed.x + cursor.x * zoomed.scale, y: zoomed.y + cursor.y * zoomed.scale }

    expect(zoomed.scale).toBeLessThan(view.scale)
    expect(Math.abs(after.x - before.x)).toBeLessThan(1)
    expect(Math.abs(after.y - before.y)).toBeLessThan(1)
  })

  it('setzt Einheiten, Gebaeude und Kampfsymbole auf die Karte', () => {
    const markers = markersFor([army('a1', 'alpha', { fighting: true })], { alpha: 2, beta: 1 }, centres, view)

    expect(markers.map((marker) => marker.kind)).toEqual(['building', 'building', 'army', 'battle'])
    expect(markers.filter((marker) => marker.kind === 'building').map((marker) => marker.provinceId)).toEqual([
      'alpha',
      'beta',
    ])
  })

  it('zeichnet das Kampfsymbol zuletzt, damit es nichts verdeckt', () => {
    const markers = markersFor([army('a1', 'alpha', { fighting: true })], {}, centres, view)
    const battle = markers.findIndex((marker) => marker.kind === 'battle')
    const unit = markers.findIndex((marker) => marker.kind === 'army')

    expect(battle).toBeGreaterThan(unit)
  })

  it('legt die Gebaeude unter die Einheit statt darunter zu verschwinden', () => {
    const markers = markersFor([army('a1', 'alpha')], { alpha: 1 }, centres, view)
    const building = markers.find((marker) => marker.kind === 'building')!
    const unit = markers.find((marker) => marker.kind === 'army')!

    expect(building.x).toBe(unit.x)
    expect(building.y - unit.y).toBe(BUILDING_OFFSET_Y)
  })

  it('deckelt die Gebaeudesymbole, statt eine Provinz zuzupflastern', () => {
    const markers = markersFor([], { alpha: 12 }, centres, view)
    expect(markers[0]!.count).toBe(MAX_BUILDING_PIPS)
  })

  it('unterscheidet eigene von fremden Einheiten', () => {
    const markers = markersFor([army('a1', 'alpha'), army('a2', 'beta', { own: false, owner: 'p2' })], {}, centres, view)
    expect(markers.map((marker) => marker.own)).toEqual([true, false])
  })

  it('verschiebt die Symbole mit der Karte', () => {
    const moved = markersFor([army('a1', 'alpha')], {}, centres, { x: 50, y: 20, scale: 1 })
    const still = markersFor([army('a1', 'alpha')], {}, centres, view)

    expect(still[0]!.x - moved[0]!.x).toBe(50)
    expect(still[0]!.y - moved[0]!.y).toBe(20)
  })

  it('zeichnet nichts fuer eine Provinz, die es auf der Karte nicht gibt', () => {
    // Sonst landet ein Symbol auf Koordinate NaN und verschwindet unsichtbar irgendwo.
    expect(markersFor([army('a1', 'nirgendwo')], { nirgendwo: 3 }, centres, view)).toEqual([])
  })
})
