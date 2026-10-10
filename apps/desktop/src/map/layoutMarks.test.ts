import { describe, expect, it } from 'vitest'
import { BUILDINGS_YIELD_TO, layoutMarks, placeLabels, type MarkInput } from './layoutMarks.ts'

const BOUNDS = { x: 0, y: 0, width: 1280, height: 744 }

const mark = (over: Partial<MarkInput> & { id: string }): MarkInput => ({
  pri: 1,
  kind: 'building',
  side: 'bm',
  pow: 'p1',
  ax: 100,
  ay: 100,
  w: 14,
  h: 14,
  n: 1,
  ...over,
})

describe('layoutMarks (E7, Spec §12.14.1)', () => {
  it('Schritt 1: Vorrang — Feind vor eigener Armee vor Gebaeude an gleicher Stelle', () => {
    const { marks } = layoutMarks(
      [
        mark({ id: 'bm', pri: 1, kind: 'building', side: 'bm' }),
        mark({ id: 'me', pri: 2, kind: 'army', side: 'me' }),
        mark({ id: 'foe', pri: 4, kind: 'foe', side: 'foe', foe: true }),
      ],
      BOUNDS,
    )
    const foe = marks.find((m) => m.id === 'foe')!
    expect(foe.rect.x + foe.rect.w / 2).toBeCloseTo(100, 0)
    expect(foe.rect.y + foe.rect.h / 2).toBeCloseTo(100, 0)
  })

  it('Feind ist nie verdeckt: bei dichtem Gedraenge bleibt sein Rechteck frei', () => {
    const crowd: MarkInput[] = Array.from({ length: 6 }, (_, i) =>
      mark({ id: `b${i}`, pri: 1, kind: 'building', side: 'bm', ax: 100 + i, ay: 100 }),
    )
    const foe = mark({ id: 'foe', pri: 4, kind: 'foe', side: 'foe', pow: 'feind', ax: 100, ay: 100, foe: true })
    const { marks } = layoutMarks([...crowd, foe], BOUNDS)
    const foeRect = marks.find((m) => m.id === 'foe')!.rect
    const others = marks.filter((m) => m.id !== 'foe')
    for (const o of others) {
      const overlapX = Math.min(foeRect.x + foeRect.w, o.rect.x + o.rect.w) - Math.max(foeRect.x, o.rect.x)
      const overlapY = Math.min(foeRect.y + foeRect.h, o.rect.y + o.rect.h) - Math.max(foeRect.y, o.rect.y)
      expect(overlapX > 0 && overlapY > 0).toBe(false)
    }
  })

  it('Schritt 2: gemischte Pille eigen|feind in derselben Provinz zaehlt wie Feind (pri 3)', () => {
    const mix = mark({ id: 'mix', pri: 3, kind: 'mix', side: 'mix', foe: true })
    const { marks } = layoutMarks([mix], BOUNDS)
    const placed = marks.find((m) => m.id === 'mix')!
    expect(placed.tone).toBe('mix')
    expect(placed.foe).toBe(true)
  })

  it('Schritt 3/4: Anker bei Versatz — zwei Armeen an einer Stelle bekommen Versatz + Anker-Linie', () => {
    const { marks } = layoutMarks(
      [
        mark({ id: 'a1', pri: 2, kind: 'army', side: 'me', w: 30, h: 18 }),
        mark({ id: 'a2', pri: 2, kind: 'army', side: 'me', pow: 'p2', w: 30, h: 18 }),
      ],
      BOUNDS,
    )
    const second = marks.find((m) => m.id === 'a2')!
    expect(second.anchor).toEqual({ x: 100, y: 100 })
  })

  it('Schritt 5: gleiche Seite und Macht in Reichweite werden zusammengelegt', () => {
    const base = mark({ id: 'b1', pri: 2, kind: 'army', side: 'me', pow: 'p1', w: 200, h: 200 })
    const near = mark({ id: 'b2', pri: 2, kind: 'army', side: 'me', pow: 'p1', ax: 130, ay: 100, n: 3, w: 200, h: 200 })
    const { marks } = layoutMarks([base, near], BOUNDS)
    expect(marks.filter((m) => m.merged)).toHaveLength(1)
    expect(marks.some((m) => m.label === '4')).toBe(true) // 1 + 3 zusammengelegt
  })

  it('Schritt 6: Notfall bleibt innerhalb der Karte, auch ohne freien Platz', () => {
    const corner = mark({ id: 'c', pri: 2, kind: 'army', side: 'me', ax: 4, ay: 4, w: 30, h: 18 })
    const blockers: MarkInput[] = Array.from({ length: 20 }, (_, i) =>
      mark({ id: `x${i}`, pri: 4, kind: 'foe', side: 'foe', pow: 'feind', ax: 4 + i, ay: 4, w: 30, h: 18, foe: true }),
    )
    const { marks } = layoutMarks([...blockers, corner], BOUNDS)
    const placed = marks.find((m) => m.id === 'c')!
    expect(placed.rect.x).toBeGreaterThanOrEqual(BOUNDS.x + 4)
    expect(placed.rect.y).toBeGreaterThanOrEqual(BOUNDS.y + 4)
    expect(placed.rect.x + placed.rect.w).toBeLessThanOrEqual(BOUNDS.width - 4)
  })

  it('Schritt 7: Gebaeude ohne Platz treten zurueck (BUILDINGS_YIELD_TO) statt zu erzwingen', () => {
    const blockingArmy = mark({ id: 'army', pri: 2, kind: 'army', side: 'me', ax: 100, ay: 100, w: 200, h: 200 })
    const building = mark({ id: 'bm', pri: 1, kind: 'building', side: 'bm', ax: 100, ay: 100, w: 14, h: 14 })
    const { marks, retreatedBuildings } = layoutMarks([blockingArmy, building], BOUNDS)
    expect(marks.some((m) => m.id === 'bm')).toBe(false)
    expect(retreatedBuildings).toBe(1)
  })

  it('BUILDINGS_YIELD_TO listet nur army/foe/mix — Gebaeude gegen Gebaeude ist nicht enthalten', () => {
    expect(BUILDINGS_YIELD_TO).toEqual(['army', 'foe', 'mix'])
    expect(BUILDINGS_YIELD_TO).not.toContain('building')
  })

  it('placeLabels: Machtname findet freie Stelle ueber eigenem Gebiet, sonst tritt er zurueck', () => {
    const labels = [{ pow: 'p1', label: 'Beispielland', x: 400, y: 400, w: 80, h: 16 }]
    const marks = layoutMarks([mark({ id: 'bm', ax: 400, ay: 400 })], BOUNDS).marks
    const free = placeLabels(labels, marks, BOUNDS)
    expect(free).toHaveLength(1)

    const alwaysForeign = () => false
    const stuck = placeLabels(labels, marks, BOUNDS, alwaysForeign)
    expect(stuck).toHaveLength(0)
  })

  it('Dev-Hook-Vertrag: Rueckgabeform passt zu window.__wwMarks (kind, tone, rect, foe)', () => {
    const { marks } = layoutMarks([mark({ id: 'bm' })], BOUNDS)
    expect(marks[0]).toMatchObject({ kind: 'building', tone: 'building', foe: false, rect: { x: expect.any(Number), y: expect.any(Number), w: 14, h: 14 } })
  })
})
