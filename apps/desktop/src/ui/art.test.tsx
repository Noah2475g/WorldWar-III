// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { outsideBox } from '../../../../test/path-bounds.ts'
import { ART, ART_FOR_ICON, ART_NAMES, BUILDING_ART, UNIT_ART, UnitArt } from './art.tsx'
import { BUILDING_ICONS, UNIT_ICONS } from './icons.tsx'

/**
 * Der zweite Bildsatz (T-M33-01, EINHEITSBILDER.md D33.1, R-ASSET-01/R-UI-04).
 *
 * Er ersetzt den Glyphensatz nicht, er steht daneben: elf Pixel auf der Karte tragen
 * keinen Schattenriss (D33-a). Geprueft wird hier dreierlei — dass der Satz die
 * ausgelieferten Regeln deckt, dass jede Zeichnung im Kasten 48 x 30 bleibt, und dass
 * sie WORTGLEICH aus dem Entwurfsblatt stammt. Das letzte ist der Punkt: „uebertragen,
 * nicht neu entworfen" ist sonst eine Behauptung, die niemand nachrechnet.
 */

const ROOT = process.cwd()
const rulesFile = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(`${ROOT}/data/rules/default/${name}.json`, 'utf8')) as Record<string, unknown>

/**
 * Die Zeichnungen, wie sie im Entwurfsblatt stehen.
 *
 * Das Blatt setzt seine Kreise ueber eine Hilfsfunktion `c(x, y, r)`; ein Vergleich der
 * blossen Zeichenketten ginge daran vorbei. Also wird derselbe Ausschnitt ausgefuehrt,
 * den der Browser ausfuehrt, und das Ergebnis verglichen.
 */
function entwurfsblatt(): Record<string, { body: string; cut: string }> {
  const blatt = readFileSync(`${ROOT}/docs/design/einheiten-bilder.html`, 'utf8')
  const anfang = blatt.indexOf('const c = ')
  const ende = blatt.indexOf('const UNITS')
  expect(anfang, 'Das Entwurfsblatt hat seinen Bildsatz verloren').toBeGreaterThan(0)
  expect(ende).toBeGreaterThan(anfang)
  return new Function(`${blatt.slice(anfang, ende)}; return ART`)() as Record<
    string,
    { body: string; cut: string }
  >
}

afterEach(cleanup)

describe('R-ASSET-01/R-UI-04 Der Bildsatz deckt die ausgelieferten Regeln', () => {
  it('hat ein Bild fuer jede Einheit der Regeln', () => {
    const units = Object.keys((rulesFile('units').units ?? {}) as object)

    expect(units.length).toBeGreaterThan(5)
    for (const key of units) {
      expect(UNIT_ART[key], `Einheit "${key}" ohne Bild`).toBeTruthy()
      expect(ART_NAMES, `Einheit "${key}" zeigt auf ${UNIT_ART[key]}`).toContain(UNIT_ART[key])
    }
  })

  it('hat ein Bild fuer jedes Gebaeude der Regeln', () => {
    const buildings = Object.keys((rulesFile('buildings').buildings ?? {}) as object)

    expect(buildings.length).toBeGreaterThan(5)
    for (const key of buildings) {
      expect(BUILDING_ART[key as keyof typeof BUILDING_ART], `Gebaeude "${key}" ohne Bild`).toBeTruthy()
    }
  })

  it('kennt keinen Schluessel, den die Regeln nicht haben', () => {
    const units = new Set(Object.keys((rulesFile('units').units ?? {}) as object))
    const buildings = new Set(Object.keys((rulesFile('buildings').buildings ?? {}) as object))

    for (const key of Object.keys(UNIT_ART)) expect(units.has(key), key).toBe(true)
    for (const key of Object.keys(BUILDING_ART)) expect(buildings.has(key), key).toBe(true)
  })

  it('vergibt kein Bild zweimal', () => {
    // Dieselbe Falle wie bei Flugplatz und Jagdflugzeug im Glyphensatz (Befund 30):
    // zwei Sachen mit demselben Bild sind in einer Liste die falsche Auskunft.
    const vergeben = new Map<string, string>()
    for (const [key, art] of [...Object.entries(UNIT_ART), ...Object.entries(BUILDING_ART)]) {
      expect(vergeben.has(art), `"${key}" teilt sich "${art}" mit "${vergeben.get(art)}"`).toBe(false)
      vergeben.set(art, key)
    }
    expect(vergeben.size).toBe(17)
  })

  it('zeichnet jede Zeichnung mit Flaeche UND Innenlinien', () => {
    // Zwei Pfade sind der ganze Entwurf (D33.1): ohne `cut` ist ein Panzer eine
    // Schachtel, weil ein einziger Pfad zwar Loecher stanzen, aber keine Linie ziehen
    // kann.
    expect(ART_NAMES).toHaveLength(17)
    for (const name of ART_NAMES) {
      expect(ART[name].body.length, `${name} ohne Flaeche`).toBeGreaterThan(20)
      expect(ART[name].cut.length, `${name} ohne Innenlinien`).toBeGreaterThan(8)
    }
  })

  it('bleibt mit jedem Pfad im Kasten 48 x 30', () => {
    // Dieselbe Pfadabfahrt wie beim Glyphensatz (T-M33-01, Risiko 7): der Stift wird
    // gefuehrt, statt Zahlen aus der Zeichenkette zu fischen.
    for (const name of ART_NAMES) {
      expect(outsideBox(ART[name].body, 48, 30), `${name}: Flaeche`).toEqual([])
      expect(outsideBox(ART[name].cut, 48, 30), `${name}: Innenlinien`).toEqual([])
    }
  })

  it('faellt, sobald eine Zeichnung den Kasten verlaesst', () => {
    // Der Waechter ueber dem Nichts ist der Fehler, den diese Aufgabe repariert — also
    // wird auch hier gezeigt, dass er rot werden kann.
    expect(outsideBox(`${ART.tank.body} M0 0 L49 2`, 48, 30)).toEqual([
      'rechts bis x = 49.00 (Kasten 48)',
    ])
    expect(outsideBox(`${ART.tank.body} M4 26v6`, 48, 30)).toEqual(['unten bis y = 32.00 (Kasten 30)'])
  })
})

describe('R-ASSET-01 Die Zeichnungen stammen wortgleich aus dem Entwurfsblatt', () => {
  const entwurf = entwurfsblatt()

  it('uebernimmt jede der siebzehn Zeichnungen unveraendert', () => {
    for (const name of ART_NAMES) {
      expect(entwurf[name], `${name} steht nicht im Entwurfsblatt`).toBeTruthy()
      expect(ART[name].body, `${name}: Flaeche weicht vom Entwurf ab`).toBe(entwurf[name]!.body)
      expect(ART[name].cut, `${name}: Innenlinien weichen vom Entwurf ab`).toBe(entwurf[name]!.cut)
    }
  })

  it('nimmt bei der Infanterie den Mann und nicht das Emblem', () => {
    // Noahs Wahl der zweiten Runde (EINHEITSBILDER.md Kopf und Abschnitt 2b). Die
    // verworfene Fassung bleibt im Blatt sichtbar und geht nicht in den Code — ein
    // Bildsatz, der beide fuehrt, hat die Entscheidung nicht getroffen.
    expect(ART.infantry.body).toBe(entwurf.infantry!.body)
    expect(ART.infantry.body).not.toBe(entwurf.infantry_emblem!.body)
    expect(ART_NAMES).not.toContain('infantry_emblem')
  })
})

describe('R-UI-10 Glyphe und Bild zeigen auf dieselbe Sache', () => {
  it('findet zu jedem Zeichen einer Einheit oder eines Gebaeudes das Bild', () => {
    // Die Bruecke, die das Panel braucht: es fuehrt den Glyphennamen und will das Bild
    // (T-M33-04). Ohne sie muesste jede Liste den Regelschluessel mitschleppen.
    for (const [key, icon] of Object.entries(UNIT_ICONS)) {
      expect(ART_FOR_ICON[icon], `${key}: ${icon} ohne Bild`).toBe(UNIT_ART[key])
    }
    for (const [key, icon] of Object.entries(BUILDING_ICONS)) {
      expect(ART_FOR_ICON[icon], `${key}: ${icon} ohne Bild`).toBe(
        BUILDING_ART[key as keyof typeof BUILDING_ART],
      )
    }
  })
})

describe('R-UI-04 UnitArt zeichnet die Flaeche und die Innenlinien', () => {
  it('setzt beide Pfade in einen Kasten von 48 zu 30', () => {
    const { container } = render(<UnitArt name="tank" width={44} />)
    const svg = container.querySelector('svg')!
    const paths = container.querySelectorAll('path')

    expect(svg.getAttribute('viewBox')).toBe('0 0 48 30')
    expect(svg.getAttribute('width')).toBe('44')
    expect(svg.getAttribute('height')).toBe('27.5')
    expect(paths).toHaveLength(2)
    expect(paths[0]!.getAttribute('d')).toBe(ART.tank.body)
    expect(paths[1]!.getAttribute('d')).toBe(ART.tank.cut)
  })

  it('traegt die Besitzerfarbe als Klasse, wie das Plaettchen den Rahmen', () => {
    // R-UI-10: dieselbe Zuordnung wie beim Marker, damit Karte und Liste dasselbe sagen.
    for (const tone of ['own', 'ally', 'enemy', 'other', 'ink', 'building'] as const) {
      const { container, unmount } = render(<UnitArt name="infantry" tone={tone} />)
      expect(container.querySelector('svg')?.getAttribute('class'), tone).toContain(`unit-art--${tone}`)
      unmount()
    }
  })

  it('ist ohne Beschriftung fuer Vorleseprogramme unsichtbar', () => {
    // Im Knopf steht der Name schon am Knopf; ein zweiter Name daneben wird doppelt
    // vorgelesen (dieselbe Regel wie bei Icon).
    const { container } = render(<UnitArt name="barracks" />)

    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('bekommt mit Beschriftung eine Rolle und einen Titel', () => {
    const { container } = render(<UnitArt name="barracks" label="Rekrutierungsbüro" />)
    const svg = container.querySelector('svg')!

    expect(svg.getAttribute('role')).toBe('img')
    expect(svg.getAttribute('aria-label')).toBe('Rekrutierungsbüro')
    expect(svg.querySelector('title')?.textContent).toBe('Rekrutierungsbüro')
  })
})
