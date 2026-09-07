import { describe, expect, it } from 'vitest'
import { MAP_COLORS } from './render.ts'
import { colorForPlayer, fillFor } from './modes.ts'
import { zoomAt, type View, type ViewLimits } from './picking.ts'
import {
  BUILDING_OFFSET_Y,
  MAX_BUILDING_PIPS,
  dominantIcon,
  marchPoint,
  markersFor,
  type ArmyMarker,
} from './markers.ts'
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

/**
 * Was auf der Karte steht (T-M13-09, R-UI-12).
 *
 * Drei Dinge fehlten: die eigene Hauptstadt war nicht zu finden, ein Kampf zeigte sich
 * nie (die Fahne `fighting` setzte niemand), und jede Armee trug das Infanteriekreuz,
 * ganz gleich, woraus sie bestand.
 */
describe('R-UI-12 Hauptstadt, Kampf und Gattung', () => {
  it('zeichnet die eigene Hauptstadt als eigenes Zeichen', () => {
    const markers = markersFor([], {}, centres, view, { capitalProvinceId: 'alpha' })

    expect(markers.map((m) => m.kind)).toEqual(['capital'])
    expect(markers[0]).toMatchObject({ provinceId: 'alpha', x: 100, y: 100 })
  })

  it('zeichnet einen Kampf dort, wo die Sicht einen meldet', () => {
    const markers = markersFor([], {}, centres, view, { battleProvinces: ['beta'] })

    expect(markers.filter((m) => m.kind === 'battle').map((m) => m.provinceId)).toEqual(['beta'])
  })

  it('zeichnet keinen Kampf ohne Meldung — die alte Fahne setzte niemand', () => {
    const markers = markersFor([army('a1', 'alpha')], {}, centres, view)

    expect(markers.some((m) => m.kind === 'battle')).toBe(false)
  })

  it('fasst mehrere Armeen in derselben Schlacht zu einem Zeichen zusammen', () => {
    const markers = markersFor([army('a1', 'beta'), army('a2', 'beta')], {}, centres, view, {
      battleProvinces: ['beta', 'beta'],
    })

    expect(markers.filter((m) => m.kind === 'battle')).toHaveLength(1)
  })

  it('gibt der Armee das Zeichen ihres staerksten Stapels', () => {
    expect(dominantIcon([{ unitKey: 'infantry', hp: 1000 }, { unitKey: 'tank', hp: 4000 }])).toBe('armour')
    expect(dominantIcon([{ unitKey: 'infantry', hp: 4000 }, { unitKey: 'tank', hp: 1000 }])).toBe('infantry')
  })

  it('bleibt ohne bekannte Zusammensetzung beim schlichten Kasten', () => {
    // Fremde Armeen zeigen nur eine Staerke — was in ihnen steckt, geht den Spieler
    // nichts an (R-DIP-04).
    expect(dominantIcon([])).toBeUndefined()
    expect(dominantIcon([{ unitKey: 'gibtesnicht', hp: 5000 }])).toBeUndefined()
  })

  it('haelt die Reihenfolge ein: Gebaeude, Armee, Hauptstadt, Kampf', () => {
    const markers = markersFor([army('a1', 'alpha')], { alpha: 2 }, centres, view, {
      capitalProvinceId: 'alpha',
      battleProvinces: ['alpha'],
    })

    expect(markers.map((m) => m.kind)).toEqual(['building', 'army', 'capital', 'battle'])
  })
})

describe('R-UI-04 Eine marschierende Armee bewegt sich (T-M20-04)', () => {
  /**
   * Die offene Hälfte einer V1-Zusage: R-UI-04 verspricht „Bewegungs- **und**
   * Kampfanimationen", und nur die Kampfhälfte gab es. Der Ring um ein Gefecht atmet
   * seit T-M13-16; eine marschierende Armee klebte in der Provinzmitte und stand im
   * nächsten Bild ohne Übergang in der nächsten.
   *
   * Geprüft wird als **Arithmetik**, nicht am Bild. `MapCanvas` ist die am schlechtesten
   * abgedeckte Datei der Oberfläche, weil sie ohne Leinwand nicht läuft — der Anteil des
   * Weges dagegen läuft überall, und was hier grün ist, ist wirklich geprüft.
   */
  const centres = { a: { x: 0, y: 0 }, b: { x: 100, y: 200 } }
  const marschierend: ArmyMarker = {
    id: 'a1',
    provinceId: 'a',
    owner: 'p1',
    strength: 1000,
    own: true,
    march: { toProvinceId: 'b', departureTick: 10, arrivalTick: 20 },
  }

  it('steht auf halbem Weg, wenn die Haelfte der Zeit um ist', () => {
    expect(marchPoint(marschierend, centres, 15)).toEqual({ x: 50, y: 100 })
  })

  it('bewegt sich gleichmaessig ueber die ganze Strecke', () => {
    expect(marchPoint(marschierend, centres, 12)).toEqual({ x: 20, y: 40 })
    expect(marchPoint(marschierend, centres, 18)).toEqual({ x: 80, y: 160 })
  })

  it('steht vor dem Abmarsch und nach der Ankunft in der Provinzmitte', () => {
    // Null heisst „nimm die Mitte". Ein Marker, der vor dem Abmarsch schon unterwegs
    // waere, zeigte einen Befehl an, den der Spieler noch gar nicht gegeben hat.
    expect(marchPoint(marschierend, centres, 10)).toBeNull()
    expect(marchPoint(marschierend, centres, 9)).toBeNull()
    expect(marchPoint(marschierend, centres, 20)).toBeNull()
    expect(marchPoint(marschierend, centres, 25)).toBeNull()
  })

  it('bleibt in der Mitte, wenn etwas fehlt oder nicht stimmt', () => {
    // Eine Armee an einem erfundenen Zwischenort waere schlimmer als eine, die nicht
    // wandert: der Spieler klickt dorthin, wo nichts ist.
    const ohneMarsch: ArmyMarker = { ...marschierend }
    delete ohneMarsch.march
    expect(marchPoint(ohneMarsch, centres, 15), 'ohne Marschangabe').toBeNull()
    expect(
      marchPoint({ ...marschierend, march: { ...marschierend.march!, toProvinceId: 'gibtesnicht' } }, centres, 15),
      'Ziel ohne Mittelpunkt',
    ).toBeNull()
    expect(
      marchPoint({ ...marschierend, march: { ...marschierend.march!, arrivalTick: 10 } }, centres, 10),
      'Marsch ohne Dauer — hier wuerde durch null geteilt',
    ).toBeNull()
    expect(marchPoint({ ...marschierend, provinceId: 'gibtesnicht' }, centres, 15), 'Start ohne Mittelpunkt').toBeNull()
  })

  it('setzt den Marker unterwegs zwischen die Provinzen', () => {
    const view = { x: 0, y: 0, scale: 1 }
    const unterwegs = markersFor([marschierend], {}, centres, view, { tick: 15 })
      .find((marker) => marker.kind === 'army')

    expect(unterwegs).toMatchObject({ x: 50, y: 100 })
  })

  it('laesst ihn in der Mitte, wenn keine Uhr mitkommt', () => {
    // Genau der Fall „Bewegung abgeschaltet": ohne `tick` gibt es keinen Anteil, und der
    // Marker steht da, wo er bis T-M20-04 immer stand.
    const view = { x: 0, y: 0, scale: 1 }
    const still = markersFor([marschierend], {}, centres, view, {}).find((marker) => marker.kind === 'army')

    expect(still).toMatchObject({ x: 0, y: 0 })
  })
})
