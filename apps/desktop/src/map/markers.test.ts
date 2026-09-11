import { describe, expect, it } from 'vitest'
import { MAP_COLORS } from './render.ts'
import { colorForPlayer, fillFor } from './modes.ts'
import { zoomAt, type View, type ViewLimits } from './picking.ts'
import {
  ARMY_BOX,
  ARMY_HIT_BOX,
  BUILDING_BOX,
  BUILDING_MAX_SCALE,
  BUILDING_OFFSET_Y,
  dominantIcon,
  stackSummary,
  marchPoint,
  markersFor,
  pickArmy,
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
    const markers = markersFor(
      [army('a1', 'alpha', { fighting: true })],
      { alpha: { barracks: 1, factory: 1 }, beta: { fortress: 1 } },
      centres,
      view,
    )

    expect(markers.map((marker) => marker.kind)).toEqual(['building', 'building', 'building', 'army', 'battle'])
    expect(markers.filter((marker) => marker.kind === 'building').map((marker) => marker.provinceId)).toEqual([
      'alpha',
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

  it('legt die Gebaeude ohne Anker unter die Einheit statt darunter zu verschwinden', () => {
    const markers = markersFor([army('a1', 'alpha')], { alpha: { barracks: 1 } }, centres, view)
    const building = markers.find((marker) => marker.kind === 'building')!
    const unit = markers.find((marker) => marker.kind === 'army')!

    expect(building.x).toBe(unit.x)
    expect(building.y - unit.y).toBe(BUILDING_OFFSET_Y)
  })

  it('stellt Gebaeude an die Anker der Provinz, mit Glyphe und Stufe (T-M30-02)', () => {
    const anchors = {
      alpha: [
        { x: 110, y: 90, edgeDistance: 30 },
        { x: 80, y: 120, edgeDistance: 5 },
      ],
    }
    const markers = markersFor([], { alpha: { barracks: 2, harbour: 1 } }, centres, view, { anchors })

    expect(markers).toEqual([
      { kind: 'building', provinceId: 'alpha', x: 110, y: 90, icon: 'barracks', level: 2 },
      // Der Hafen nimmt den randnaechsten Anker.
      { kind: 'building', provinceId: 'alpha', x: 80, y: 120, icon: 'harbour', level: 1 },
    ])
  })

  it('zeigt Gebaeude erst ab der mittleren Zoomstufe (D27.4)', () => {
    const far = { x: 0, y: 0, scale: BUILDING_MAX_SCALE * 2 }
    expect(markersFor([], { alpha: { barracks: 1 } }, centres, far)).toEqual([])
    expect(markersFor([], { alpha: { barracks: 1 } }, centres, view).length).toBe(1)
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
    expect(markersFor([army('a1', 'nirgendwo')], { nirgendwo: { barracks: 3 } }, centres, view)).toEqual([])
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
    const markers = markersFor([army('a1', 'alpha')], { alpha: { barracks: 1 } }, centres, view, {
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

/**
 * Armee-Marker sind Klickziele (T-M22-06, R-UI-05, Befund V2-14).
 *
 * Der Kasten wird ~20x14 px gezeichnet, und ausgewaehlt wurde nur ueber das
 * Provinz-Panel — ein Klick auf die Karte traf immer die Provinz. `pickArmy` gibt dem
 * Marker eine Trefferflaeche von mindestens 24 px (Picking, nicht Zeichnung): der
 * Kasten bleibt klein, der Finger darf daneben liegen.
 */
describe('R-UI-05 Armee-Marker haben eine Trefferflaeche von mindestens 24 px', () => {
  it('deckelt die Trefferflaeche nicht unter 24 px', () => {
    expect(ARMY_HIT_BOX).toBeGreaterThanOrEqual(24)
  })

  it('trifft die eigene Armee auch knapp neben dem Kasten', () => {
    const armies = [army('a1', 'alpha')]

    // 11 px daneben: innerhalb der 24-px-Flaeche, obwohl der Kasten nur 20 px breit ist.
    expect(pickArmy({ x: 111, y: 100 }, armies, centres, view)).toBe('a1')
    expect(pickArmy({ x: 100, y: 89 }, armies, centres, view)).toBe('a1')
  })

  it('trifft nichts ausserhalb der Trefferflaeche', () => {
    const armies = [army('a1', 'alpha')]

    // Quer reicht seit T-M30-01 die halbe Stapelbreite (15 px), hochkant die 12 px.
    expect(pickArmy({ x: 100, y: 100 + ARMY_HIT_BOX / 2 + 1 }, armies, centres, view)).toBeNull()
    expect(pickArmy({ x: 300, y: 300 }, armies, centres, view)).toBeNull()
  })

  it('waehlt bei zwei Treffern den naeheren', () => {
    const armies = [army('fern', 'alpha'), army('nah', 'beta')]
    // Punkt zwischen beiden, aber naeher an beta (300/200).
    expect(pickArmy({ x: 295, y: 195 }, armies, centres, view)).toBe('nah')
  })

  it('greift nur eigene Armeen — eine fremde waehlt man nicht per Klick', () => {
    const armies = [army('fremd', 'alpha', { own: false, owner: 'p2' })]

    expect(pickArmy({ x: 100, y: 100 }, armies, centres, view)).toBeNull()
  })

  it('trifft eine marschierende Armee dort, wo sie gerade gezeichnet wird', () => {
    const unterwegs = army('a1', 'alpha', {
      march: { toProvinceId: 'beta', departureTick: 0, arrivalTick: 10 },
    })

    // Zur Haelfte des Weges steht der Marker bei (200, 150) — nicht in der Provinzmitte.
    expect(pickArmy({ x: 200, y: 150 }, [unterwegs], centres, view, { tick: 5 })).toBe('a1')
    expect(pickArmy({ x: 100, y: 100 }, [unterwegs], centres, view, { tick: 5 })).toBeNull()
  })
})

/**
 * Der Stapel mit Zahl und Zustand (T-M30-01, D27.2, R-MAP-05/R-UI-10/R-UI-12).
 *
 * Noahs Lob galt den NATO-Markern; die Karte zeigte Kaesten ohne Zahl. Die Stueckzahl
 * ist nirgends gespeichert (D2: nur `hpTotal`), also wird sie hier hergeleitet, und
 * der Zustand ist der Anteil der Trefferpunkte am Vollstand — beides reine Rechnung,
 * beides testbar ohne Leinwand.
 */
describe('T-M30-01 Armeen sind Stapel mit Zahl und Zustand', () => {
  const rules = { units: { infantry: { hpPerUnit: 1000 }, tank: { hpPerUnit: 2000 } } }

  it('zaehlt die Einheiten ueber zwei Gattungen und rechnet den Zustand', () => {
    // 3 Infanterie (2 500 von 3 000 TP) + 2 Panzer (3 000 von 4 000 TP) = 5 Einheiten, 5 500 / 7 000.
    const summary = stackSummary(
      [
        { unitKey: 'infantry', hpTotal: 2500 },
        { unitKey: 'tank', hpTotal: 3000 },
      ],
      rules,
    )

    expect(summary.count).toBe(5)
    expect(summary.condition).toBeCloseTo(5500 / 7000, 6)
  })

  it('zaehlt eine angeschlagene Einheit als vorhanden und einen leeren Stapel als nichts', () => {
    expect(stackSummary([{ unitKey: 'infantry', hpTotal: 1 }], rules)).toEqual({ count: 1, condition: 0.001 })
    expect(stackSummary([], rules)).toEqual({ count: 0, condition: 0 })
    expect(stackSummary([{ unitKey: 'gibtesnicht', hpTotal: 5000 }], rules)).toEqual({ count: 0, condition: 0 })
  })

  it('traegt Zahl, Zustand und Ton in den Marker', () => {
    const markers = markersFor(
      [
        army('a1', 'alpha', { count: 5, condition: 0.8 }),
        army('a2', 'beta', { own: false, owner: 'p2', relation: 'war' }),
        army('a3', 'gamma', { own: false, owner: 'p3', relation: 'alliance' }),
      ],
      {},
      centres,
      view,
    )
    const [own, foe, friend] = markers.filter((marker) => marker.kind === 'army')

    expect(own).toMatchObject({ count: 5, condition: 0.8, tone: 'own' })
    // Von fremden weiss der Spieler keine Zahl (R-DIP-04) — dann steht auch keine da.
    expect(foe!.count).toBeUndefined()
    expect(foe!.tone).toBe('enemy')
    expect(friend!.tone).toBe('ally')
  })

  it('macht aus jeder anderen Beziehung den neutralen Ton', () => {
    const markers = markersFor([army('a2', 'beta', { own: false, owner: 'p2' })], {}, centres, view)
    expect(markers[0]!.tone).toBe('other')
  })

  it('haelt die Trefferflaeche nie kleiner als den gezeichneten Stapel', () => {
    // 30 x 18 gezeichnet: quer reicht der Stapel ueber die 24 px hinaus, also greift
    // seine halbe Breite; hochkant bleiben die 24 px das Mindestmass.
    const armies = [army('a1', 'alpha')]
    expect(pickArmy({ x: 100 + ARMY_BOX.width / 2 - 1, y: 100 }, armies, centres, view)).toBe('a1')
    expect(pickArmy({ x: 100 + ARMY_BOX.width / 2 + 2, y: 100 }, armies, centres, view)).toBeNull()
    expect(pickArmy({ x: 100, y: 100 + ARMY_HIT_BOX / 2 - 1 }, armies, centres, view)).toBe('a1')
  })
})

/**
 * T-M28-13 · Ein Klick wählt die Armee, die man sieht.
 *
 * Befund 3 der Durchsicht vom 2026-09-11: Stehen zwei eigene Armeen in derselben Provinz,
 * liegen ihre Marker übereinander. Gezeichnet wird die **letzte** der Liste — ihren Kasten
 * samt Zahl und Zustandsbalken sieht der Spieler. `pickArmy` nahm bei gleichem Abstand
 * aber die **erste**: der Klick wählte die verdeckte, und die sichtbare war per Karte
 * überhaupt nicht anwählbar.
 */
describe('T-M28-13 Deckungsgleiche Stapel', () => {
  const beide = [army('a1', 'alpha'), army('a2', 'alpha')]

  it('liefert die zuletzt gezeichnete — die, die obenauf liegt', () => {
    expect(pickArmy({ x: 100, y: 100 }, beide, centres, view)).toBe('a2')
  })

  it('bleibt bei ungleichem Abstand bei der naeheren', () => {
    const centresVersetzt = { ...centres, beta: { x: 120, y: 100 } }
    const versetzt = [army('a1', 'alpha'), army('a2', 'beta')]

    expect(pickArmy({ x: 101, y: 100 }, versetzt, centresVersetzt, view)).toBe('a1')
  })
})

/**
 * T-M28-12 · Das Gebäudequadrat verschwindet nicht unter dem Armeekasten.
 *
 * Befund 2 der Durchsicht vom 2026-09-11: Ist die Provinz für das Ankergitter zu klein,
 * liefert `anchorsFor` genau einen Anker — den Mittelpunkt, weil nur er sicher im Land
 * liegt. Genau dorthin setzt `markersFor` aber auch den Armeekasten, und der ist mit
 * 30×18 und deckendem Grund größer als das 14×14-Quadrat: es verschwand restlos.
 * **92 von 237 Provinzen der Weltkarte laufen in diesen Rückfall.**
 */
describe('T-M28-12 Gebaeude auf dem Mittelpunkt-Anker', () => {
  const mitte = { x: 100, y: 100 }
  const nurMitte = [{ ...mitte, edgeDistance: 5 }]

  const gebaeude = () =>
    markersFor([army('a1', 'alpha')], { alpha: { barracks: 1 } }, centres, { x: 0, y: 0, scale: 1 }, {
      anchors: { alpha: nurMitte },
    })

  it('setzt das Quadrat unter den Kasten, nicht darauf', () => {
    const marker = gebaeude()
    const bau = marker.find((m) => m.kind === 'building')!
    const armee = marker.find((m) => m.kind === 'army')!

    expect(bau.y).toBeGreaterThan(armee.y)
    expect(bau.y - armee.y).toBeGreaterThanOrEqual(ARMY_BOX.height / 2 + BUILDING_BOX / 2)
  })

  it('laesst einen echten Gitteranker unveraendert', () => {
    const versetzt = [{ x: 130, y: 140, edgeDistance: 20 }]
    const marker = markersFor([], { alpha: { barracks: 1 } }, centres, { x: 0, y: 0, scale: 1 }, {
      anchors: { alpha: versetzt },
    })
    const bau = marker.find((m) => m.kind === 'building')!

    expect(bau.y).toBe(140)
  })
})

/**
 * T-M28-14 · Jede Macht bekommt eine eigene Farbe.
 *
 * Befund 6 der Durchsicht vom 2026-09-11 (schwer): `colorForPlayer` hatte elf Farben und
 * rechnete modulo, der Startdialog erlaubt aber so viele Gegner, wie die Karte
 * Startaufstellungen hat — auf der Weltkarte 24. Ab der zwölften Macht wiederholte sich
 * eine Farbe, und zwei Länder waren im Besitzmodus nicht zu unterscheiden. Noahs
 * Entscheid vom 2026-09-11: **mehr Farben**, nicht weniger Mächte.
 */
describe('T-M28-14 Eine Farbe je Macht, auch in der groessten Partie', () => {
  const MAECHTE = 24
  const alle = Array.from({ length: MAECHTE }, (_, i) => `p${i + 1}`)

  it('gibt es mindestens so viele Farben wie Startaufstellungen auf der Weltkarte', () => {
    expect(Object.keys(PLAYER_COLORS).length).toBeGreaterThanOrEqual(MAECHTE)
  })

  it('vergibt in einer Hoechstbesetzung keine Farbe zweimal', () => {
    const farben = alle.map((id) => colorForPlayer(id))

    expect(new Set(farben).size).toBe(MAECHTE)
  })

  it('haelt die Farbe einer Macht ueber Sitzungen hinweg fest', () => {
    // Sie haengt allein an der Kennung — ein geladener Stand faerbt die Welt wie zuvor.
    expect(colorForPlayer('p7')).toBe(colorForPlayer('p7'))
    expect(colorForPlayer('p7')).not.toBe(colorForPlayer('p8'))
  })
})
