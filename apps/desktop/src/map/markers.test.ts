import { describe, expect, it } from 'vitest'
import { MAP_COLORS, marchArrow } from './render.ts'
import { armyHome } from './stellung.ts'
import { colorForPlayer, fillFor } from './modes.ts'
import { zoomAt, toScreen, type View, type ViewLimits } from './picking.ts'
import {
  ARMY_BOX,
  ARMY_HIT_BOX,
  ARMY_LIFT_Y,
  armyScreenPoint,
  declutter,
  BUILDING_BOX,
  BUILDING_MAX_SCALE,
  BUILDING_OFFSET_Y,
  dominantIcon,
  FAN_PITCH,
  fanOut,
  stackSummary,
  marchEnds,
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

  // LOESCHVERMERK (Review): bis T-M46-03 stand hier „liefert die zuletzt gezeichnete — die, die obenauf liegt“
  // (pickArmy bei zwei Armeen auf demselben Punkt, Erwartung 'a2'). Seit dem Auffaechern gibt es
  // keine zwei Marker auf demselben Punkt mehr; der Fall ist unten durch „jede Armee an ihrem Platz“ ersetzt.

  it('waehlt im aufgefaecherten Stapel jede Armee an ihrem eigenen Platz (T-M46-03)', () => {
    const marker = markersFor(beide, {}, centres, view).filter((m) => m.kind === 'army')
    expect(marker).toHaveLength(2)
    for (const m of marker) {
      expect(pickArmy({ x: m.x, y: m.y }, beide, centres, view), m.armyId).toBe(m.armyId)
    }
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

/**
 * Touch-Bedienung: der Finger bekommt eine groessere Trefferflaeche.
 *
 * 24 Punkte reichen fuer eine Maus; ein Finger deckt mehr als das zu, und ein Tippen
 * knapp neben dem Stapel waehlte die Provinz darunter. `MapCanvas` gibt fuer Finger und
 * Stift eine groessere Flaeche mit — die Maus behaelt die alte.
 */
describe('Touch-Bedienung: Trefferflaeche fuer den Finger', () => {
  it('trifft mit groesserer Flaeche, was die Maus-Flaeche verfehlt', () => {
    const armies = [army('a1', 'alpha')]
    const daneben = [
      { x: 100 + 20, y: 100 },
      { x: 100, y: 100 + 20 },
    ]

    for (const punkt of daneben) {
      expect(pickArmy(punkt, armies, centres, view)).toBeNull()
      expect(pickArmy(punkt, armies, centres, view, {}, 44)).toBe('a1')
    }
    // Die groessere Flaeche endet auch irgendwo.
    expect(pickArmy({ x: 100 + 23, y: 100 }, armies, centres, view, {}, 44)).toBeNull()
  })

  it('wird nie kleiner als der gezeichnete Stapel, auch wenn jemand weniger verlangt', () => {
    const armies = [army('a1', 'alpha')]

    expect(pickArmy({ x: 100 + ARMY_BOX.width / 2, y: 100 }, armies, centres, view, {}, 2)).toBe('a1')
    expect(pickArmy({ x: 100, y: 100 + ARMY_BOX.height / 2 }, armies, centres, view, {}, 2)).toBe('a1')
  })

  it('bleibt ohne Angabe bei ARMY_HIT_BOX', () => {
    const armies = [army('a1', 'alpha')]
    const kante = { x: 100, y: 100 + ARMY_HIT_BOX / 2 }

    expect(pickArmy(kante, armies, centres, view)).toBe(pickArmy(kante, armies, centres, view, {}, ARMY_HIT_BOX))
    expect(pickArmy(kante, armies, centres, view)).toBe('a1')
  })
})

/**
 * T-M46-03 · Gestapelte Armeen werden aufgefaechert (VM-02).
 *
 * Noah: „Die Einheiten sind manchmal uebereinander … man hat Einheiten nicht gesehen.“ Gemessen an
 * S575G: 208 von 237 Armeemarkern lagen vollstaendig unter einem anderen, bis zu 27 an einem Ort.
 */
describe('T-M46-03 Aufgefaecherte Stapel', () => {
  const kaesten = (liste: readonly { x: number; y: number }[]) =>
    liste.map((m) => ({ l: m.x - ARMY_BOX.width / 2, t: m.y - ARMY_BOX.height / 2 }))
  const schneiden = (a: { l: number; t: number }, b: { l: number; t: number }) =>
    a.l < b.l + ARMY_BOX.width && b.l < a.l + ARMY_BOX.width && a.t < b.t + ARMY_BOX.height && b.t < a.t + ARMY_BOX.height

  it('laesst eine einzelne Armee, wo sie war', () => {
    const [m] = markersFor([army('a1', 'alpha')], {}, centres, view).filter((x) => x.kind === 'army')
    expect(m).toMatchObject({ x: 100, y: 100 })
  })

  it('stellt n Armeen einer Provinz ueberschneidungsfrei nebeneinander — fuer jede Stapelgroesse bis 40', () => {
    for (const n of [2, 3, 4, 5, 7, 12, 27, 40]) {
      const armeen = Array.from({ length: n }, (_, i) => army(`a${i}`, 'alpha'))
      const marker = markersFor(armeen, {}, centres, view).filter((m) => m.kind === 'army')
      const boxes = kaesten(marker)

      expect(marker, `n=${n}`).toHaveLength(n)
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          expect(schneiden(boxes[i]!, boxes[j]!), `n=${n}: ${i} deckt ${j}`).toBe(false)
        }
      }
    }
  })

  it('haelt den Stapel um den gemeinsamen Punkt zentriert', () => {
    const armeen = Array.from({ length: 9 }, (_, i) => army(`a${i}`, 'alpha'))
    const marker = markersFor(armeen, {}, centres, view).filter((m) => m.kind === 'army')
    const mx = marker.reduce((sum, m) => sum + m.x, 0) / marker.length
    const my = marker.reduce((sum, m) => sum + m.y, 0) / marker.length

    expect(Math.abs(mx - 100)).toBeLessThan(FAN_PITCH.x / 2)
    expect(Math.abs(my - 100)).toBeLessThan(FAN_PITCH.y / 2)
  })

  it('haelt die Abstaende in Bildpunkten, unabhaengig von der Vergroesserung', () => {
    const armeen = [army('a1', 'alpha'), army('a2', 'alpha')]
    const nah = markersFor(armeen, {}, centres, { x: 0, y: 0, scale: 0.5 }).filter((m) => m.kind === 'army')
    const fern = markersFor(armeen, {}, centres, { x: 0, y: 0, scale: 8 }).filter((m) => m.kind === 'army')

    expect(Math.abs(nah[0]!.x - nah[1]!.x)).toBe(FAN_PITCH.x)
    expect(Math.abs(fern[0]!.x - fern[1]!.x)).toBe(FAN_PITCH.x)
  })

  it('bleibt von Bild zu Bild stabil: dieselbe Eingabe, dieselben Plaetze', () => {
    const armeen = Array.from({ length: 6 }, (_, i) => army(`a${i}`, 'alpha'))
    expect(markersFor(armeen, {}, centres, view)).toEqual(markersFor(armeen, {}, centres, view))
  })

  it('loest eine marschierende Armee vom Stapel, sobald sie unterwegs ist', () => {
    const marsch = army('a2', 'alpha', { march: { toProvinceId: 'beta', departureTick: 0, arrivalTick: 100 } })
    const marker = markersFor([army('a1', 'alpha'), marsch], {}, centres, view, { tick: 50 }).filter((m) => m.kind === 'army')

    // a1 steht allein auf der Mitte, a2 auf halbem Weg — keiner von beiden versetzt.
    expect(marker.find((m) => m.armyId === 'a1')).toMatchObject({ x: 100, y: 100 })
    expect(marker.find((m) => m.armyId === 'a2')).toMatchObject({ x: 200, y: 150 })
  })

  it('declutter: 150 Stapel in einem Dutzend dicht liegender Provinzen ueberdecken sich nicht (Nachbesserung U)', () => {
    // Dicht wie Asien bei Massstab 8: zwoelf Mitten im Abstand von 6 Punkten, zwoelf bis dreizehn Armeen je Mitte.
    const raw = Array.from({ length: 150 }, (_, i) => ({ x: 400 + (i % 12) * 6, y: 300 + Math.floor((i % 12) / 4) * 5, own: i % 3 === 0 }))
    const placed = declutter(fanOut(raw))
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const dx = Math.abs(placed[i]!.x - placed[j]!.x)
        const dy = Math.abs(placed[i]!.y - placed[j]!.y)
        expect(dx >= ARMY_BOX.width || dy >= ARMY_BOX.height, `Stapel ${i} und ${j} ueberdecken sich`).toBe(true)
      }
    }
    // Zeitlimit wegen Last, nicht Verhalten: allein 184 ms, unter verify+Last max 3302 ms (gemessen 2026-10-05, t_3cad0a35).
  }, 20_000)

  it('fanOut ist rein: es veraendert die Eingabe nicht und kennt die leere Liste', () => {
    expect(fanOut([])).toEqual([])
    const eingabe = [{ x: 5, y: 5 }, { x: 5, y: 5 }]
    fanOut(eingabe)
    expect(eingabe).toEqual([{ x: 5, y: 5 }, { x: 5, y: 5 }])
  })
})

describe('T-M46-03 Stapel benachbarter Provinzen decken einander nicht zu', () => {
  const zehn = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`p${i}`, { x: 100 + i * 4, y: 100 + (i % 3) * 3 }]))
  const viele = Array.from({ length: 60 }, (_, i) => army(`a${i}`, `p${i % 10}`, { own: i % 4 !== 0 }))
  const kaesten = (liste: readonly { x: number; y: number }[]) =>
    liste.map((m) => ({ l: m.x - ARMY_BOX.width / 2, t: m.y - ARMY_BOX.height / 2 }))

  it('laesst bei keinem Massstab einen Marker vollstaendig verdeckt (Stichprobe wie in ux-bild.mjs)', () => {
    for (const scale of [0.5, 1, 2, 4, 8]) {
      const marker = markersFor(viele, {}, zehn, { x: 0, y: 0, scale }).filter((m) => m.kind === 'army')
      const boxes = kaesten(marker)
      let verdeckt = 0
      for (let i = 0; i < boxes.length; i++) {
        let bedeckt = 0
        for (let ix = 0; ix < 7; ix++) {
          for (let iy = 0; iy < 5; iy++) {
            const px = boxes[i]!.l + ((ix + 0.5) * ARMY_BOX.width) / 7
            const py = boxes[i]!.t + ((iy + 0.5) * ARMY_BOX.height) / 5
            if (boxes.slice(i + 1).some((b) => px >= b.l && px <= b.l + ARMY_BOX.width && py >= b.t && py <= b.t + ARMY_BOX.height)) bedeckt++
          }
        }
        if (bedeckt === 35) verdeckt++
      }
      expect(marker, `scale ${scale}`).toHaveLength(60)
      expect(verdeckt, `scale ${scale}`).toBe(0)
    }
  })

  it('haelt jede eigene Armee weiter per Klick waehlbar', () => {
    const marker = markersFor(viele, {}, zehn, { x: 0, y: 0, scale: 4 }).filter((m) => m.kind === 'army' && m.own)
    expect(marker.length).toBeGreaterThan(0)
    for (const m of marker) {
      // Ein Klick genau auf die Mitte eines Markers trifft ihn — nicht einen, der obenauf liegt.
      expect(pickArmy({ x: m.x, y: m.y }, viele, zehn, { x: 0, y: 0, scale: 4 }), m.armyId).toBe(m.armyId)
    }
  })

  it('verschiebt die Anordnung mit dem Ausschnitt, statt sie neu zu wuerfeln', () => {
    const a = markersFor(viele, {}, zehn, { x: 0, y: 0, scale: 2 }).filter((m) => m.kind === 'army')
    const b = markersFor(viele, {}, zehn, { x: 40, y: 20, scale: 2 }).filter((m) => m.kind === 'army')

    a.forEach((m, i) => {
      expect(b[i]!.x).toBeCloseTo(m.x - 20, 6)
      expect(b[i]!.y).toBeCloseTo(m.y - 10, 6)
    })
  })

  it('stellt eigene Armeen vor fremde, wenn der Platz knapp ist', () => {
    const eng = { a: { x: 100, y: 100 }, b: { x: 101, y: 100 } }
    const [fremd, eigen] = markersFor(
      [army('f', 'a', { own: false }), army('e', 'b', { own: true })],
      {},
      eng,
      view,
    ).filter((m) => m.kind === 'army')

    // Die eigene Armee behaelt ihren Platz, die fremde weicht aus.
    expect(eigen).toMatchObject({ x: 101, y: 100 })
    expect(fremd!.x !== 100 || fremd!.y !== 100).toBe(true)
  })
})

describe('R-MAP-05/AK1 Stellung: Layout und Marsch', () => {
  const RULES = { units: { infantry: { requiresBuilding: 'barracks' } } }
  const UNITS = [{ unitKey: 'infantry', hpTotal: 100 }]
  const ANCHORS = [
    { x: 130, y: 140, edgeDistance: 30 },
    { x: 80, y: 90, edgeDistance: 20 },
  ]
  const homeOf = armyHome(UNITS, { barracks: 1 }, ANCHORS, RULES)!
  const overlap = (a: { x: number; y: number }, aw: number, ah: number, b: { x: number; y: number }, bw: number, bh: number): number => {
    const w = Math.min(a.x + aw / 2, b.x + bw / 2) - Math.max(a.x - aw / 2, b.x - bw / 2)
    const h = Math.min(a.y + ah / 2, b.y + bh / 2) - Math.max(a.y - ah / 2, b.y - bh / 2)
    return w > 0 && h > 0 ? w * h : 0
  }

  it('(a) eine Armee mit home steht 17 px ueber ihrem Gebaeude', () => {
    expect(ARMY_LIFT_Y).toBe(17)
    const [m] = markersFor([army('a1', 'alpha', { home: homeOf })], {}, centres, view).filter((k) => k.kind === 'army')
    const soll = toScreen(homeOf, view)
    expect(m!.x).toBeCloseTo(soll.x, 9)
    expect(m!.y).toBeCloseTo(soll.y - 17, 9)
  })

  it('(b) Gebaeude frei: kein Armeekasten schneidet das 14x14-Quadrat, bei 1 und 12 Armeen', () => {
    for (const n of [1, 12]) {
      for (const scale of [0.5, 1, 2]) {
        const v: View = { x: 0, y: 0, scale }
        const armies = Array.from({ length: n }, (_, i) => army(`h${i}`, 'alpha', { home: homeOf }))
        const bau = toScreen(homeOf, v)
        const kaesten = markersFor(armies, {}, centres, v).filter((k) => k.kind === 'army')
        expect(kaesten, `n ${n} scale ${scale}`).toHaveLength(n)
        const flaeche = kaesten.reduce((sum, k) => sum + overlap(k, ARMY_BOX.width, ARMY_BOX.height, bau, BUILDING_BOX, BUILDING_BOX), 0)
        expect(flaeche, `n ${n} scale ${scale}`).toBe(0)
      }
    }
  })

  it('(c) Rueckfall-Anker = Mitte: Gebaeude bei Mitte + 17, Armee bei Mitte - 17, keine Ueberschneidung', () => {
    const nurMitte = [{ x: 100, y: 100, edgeDistance: 5 }]
    const home = armyHome(UNITS, { barracks: 1 }, nurMitte, RULES)!
    const marker = markersFor([army('a1', 'alpha', { home })], { alpha: { barracks: 1 } }, centres, view, { anchors: { alpha: nurMitte } })
    const bau = marker.find((k) => k.kind === 'building')!
    const armee = marker.find((k) => k.kind === 'army')!
    expect(bau.y).toBeCloseTo(100 + 17, 9)
    expect(armee.y).toBeCloseTo(100 - 17, 9)
    expect(overlap(armee, ARMY_BOX.width, ARMY_BOX.height, bau, BUILDING_BOX, BUILDING_BOX)).toBe(0)
  })

  const marsch = army('m1', 'alpha', {
    home: homeOf,
    march: { toProvinceId: 'beta', departureTick: 10, arrivalTick: 20, toHome: { x: 320, y: 230 } },
  })
  const eps = 1e-6 * 10

  it('(d) kein Sprung beim Abmarsch', () => {
    const a = armyScreenPoint(marsch, centres, view, 10)!
    const b = armyScreenPoint(marsch, centres, view, 10 + eps)!
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(0.01)
  })

  it('(e) kein Sprung bei Ankunft', () => {
    const p = armyScreenPoint(marsch, centres, view, 20 - eps)!
    const soll = toScreen(marsch.march!.toHome!, view)
    expect(Math.hypot(p.x - soll.x, p.y - (soll.y - 17))).toBeLessThan(0.01)
  })

  it('(f) Pfeil und Marker bleiben deckungsgleich', () => {
    const ends = marchEnds(marsch, centres, view)!
    for (const anteil of [0.1, 0.5, 0.9]) {
      const arrow = marchArrow([[ends[0].x, ends[0].y], [ends[1].x, ends[1].y]], anteil)!
      const p = armyScreenPoint(marsch, centres, view, 10 + anteil * 10)!
      expect(arrow.standpoint[0]).toBeCloseTo(p.x, 9)
      expect(arrow.standpoint[1]).toBeCloseTo(p.y, 9)
    }
    expect(marchEnds(army('x', 'alpha'), centres, view)).toBeNull()
  })

  it('(g) Waechter: 2/3 der eigenen Armeen mit home, keiner vollstaendig verdeckt, alle waehlbar', () => {
    const zehn = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`p${i}`, { x: 100 + i * 4, y: 100 + (i % 3) * 3 }]))
    const viele = Array.from({ length: 60 }, (_, i) => {
      const own = i % 4 !== 0
      const c = zehn[`p${i % 10}`]!
      return army(`a${i}`, `p${i % 10}`, { own, ...(own && i % 3 !== 0 ? { home: { x: c.x + 5, y: c.y + 5 } } : {}) })
    })
    for (const scale of [0.5, 1, 2, 4, 8]) {
      const v: View = { x: 0, y: 0, scale }
      const marker = markersFor(viele, {}, zehn, v).filter((k) => k.kind === 'army')
      expect(marker, `scale ${scale}`).toHaveLength(60)
      let verdeckt = 0
      marker.forEach((m, i) => {
        let bedeckt = 0
        for (let ix = 0; ix < 7; ix++) {
          for (let iy = 0; iy < 5; iy++) {
            const px = m.x - ARMY_BOX.width / 2 + ((ix + 0.5) * ARMY_BOX.width) / 7
            const py = m.y - ARMY_BOX.height / 2 + ((iy + 0.5) * ARMY_BOX.height) / 5
            if (marker.slice(i + 1).some((o) => Math.abs(px - o.x) <= ARMY_BOX.width / 2 && Math.abs(py - o.y) <= ARMY_BOX.height / 2)) bedeckt++
          }
        }
        if (bedeckt === 35) verdeckt++
      })
      expect(verdeckt, `scale ${scale}`).toBe(0)
      for (const m of marker.filter((k) => k.own)) {
        expect(pickArmy({ x: m.x, y: m.y }, viele, zehn, v), `${m.armyId} scale ${scale}`).toBe(m.armyId)
      }
    }
  })

  it('(h) ohne home: Marker und Marsch wie bisher', () => {
    const ohne = army('o1', 'alpha', { march: { toProvinceId: 'beta', departureTick: 10, arrivalTick: 20 } })
    expect(armyScreenPoint(ohne, centres, view)).toEqual({ x: 100, y: 100 })
    expect(armyScreenPoint(ohne, centres, view, 15)).toEqual({ x: 200, y: 150 })
    expect(marchEnds(ohne, centres, view)).toEqual([{ x: 100, y: 100 }, { x: 300, y: 200 }])
    expect(armyScreenPoint(army('z', 'fehlt'), centres, view)).toBeNull()
  })
})
