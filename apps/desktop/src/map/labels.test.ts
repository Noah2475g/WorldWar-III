import { describe, expect, it } from 'vitest'
import { LABEL_MAX_SCALE, labelsFor, type LabelCandidate } from './labels.ts'

/**
 * Province names on the map (T-M13-08, R-UI-12).
 *
 * A pure function with the text width handed in, for a reason worth stating: jsdom has
 * no canvas and cannot measure a font, so a decision made inside the drawing call would
 * be a decision no test could ever see. Everything that decides *whether* a name is
 * drawn happens here; the canvas only draws what comes out.
 */

/** A stand-in for the browser's font metrics: six pixels a character. */
const measure = (text: string): number => text.length * 6

const province = (id: string, name: string, x: number, y: number, width = 200, height = 100): LabelCandidate => ({
  id,
  name,
  centre: { x, y },
  bounds: { minX: x - width / 2, maxX: x + width / 2, minY: y - height / 2, maxY: y + height / 2 },
})

const viewport = { width: 800, height: 600 }
const near = { x: 0, y: 0, scale: 1 }

describe('R-UI-12 Die Karte beschriftet sich ab einer Zoomstufe', () => {
  it('schreibt nichts, solange die ganze Welt zu sehen ist', () => {
    // Bei Weltansicht ist eine Provinz zwanzig Pixel breit; jeder Name waere dort
    // laenger als das Land, das er benennt.
    const far = { x: 0, y: 0, scale: LABEL_MAX_SCALE + 0.1 }

    expect(labelsFor([province('A', 'Bayern', 100, 100)], far, viewport, measure)).toEqual([])
  })

  it('schreibt je sichtbarer Provinz einen Namen, wenn man nah genug ist', () => {
    const labels = labelsFor(
      [province('A', 'Bayern', 100, 100), province('B', 'Sachsen', 100, 400)],
      near,
      viewport,
      measure,
    )

    expect(labels.map((label) => label.id)).toEqual(['A', 'B'])
    expect(labels[0]!.text).toBe('Bayern')
  })

  it('laesst weg, was ausserhalb des Bildausschnitts liegt', () => {
    const labels = labelsFor([province('A', 'Bayern', 5000, 5000)], near, viewport, measure)

    expect(labels).toEqual([])
  })

  it('laesst einen Namen weg, der breiter ist als seine Provinz', () => {
    // Lieber kein Name als einer, der ueber drei Nachbarn hinwegschreibt.
    const narrow = province('A', 'Nordrhein-Westfalen', 100, 100, 40)

    expect(labelsFor([narrow], near, viewport, measure)).toEqual([])
  })

  it('laesst zwei Namen nicht uebereinander liegen', () => {
    // Zwei Provinzmitten dicht beieinander: nur die erste bekommt ihren Namen.
    const labels = labelsFor(
      [province('A', 'Bayern', 100, 100), province('B', 'Baden', 104, 102)],
      near,
      viewport,
      measure,
    )

    expect(labels.map((label) => label.id)).toEqual(['A'])
  })

  it('setzt den Namen auf die Provinzmitte, in Bildschirmkoordinaten', () => {
    // Verschoben, aber nah genug: jenseits von LABEL_MAX_SCALE gaebe es gar keine Namen.
    const shifted = { x: 50, y: 20, scale: 1 }
    const [label] = labelsFor([province('A', 'Bayern', 100, 100)], shifted, viewport, measure)

    expect(label).toEqual({ id: 'A', text: 'Bayern', x: 50, y: 80 })
  })
})
