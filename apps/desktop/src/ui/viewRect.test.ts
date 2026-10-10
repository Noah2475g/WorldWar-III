import { describe, expect, it } from 'vitest'
import { centreOnVisible, visibleRect } from './viewRect.ts'

describe('visibleRect', () => {
  it('zieht links/rechts/unten/oben ab (D12-Grundfall)', () => {
    const rect = visibleRect(
      { width: 1280, height: 800 },
      { hintColumnWidth: 220, toolsWidth: 48, bottomBarHeight: 110 },
    )
    expect(rect).toEqual({ x: 220, y: 12, width: 1012, height: 678 })
  })

  it('nutzt topInset=12 als Default, wenn keine Insets angegeben sind', () => {
    const rect = visibleRect({ width: 800, height: 600 })
    expect(rect).toEqual({ x: 0, y: 12, width: 800, height: 588 })
  })

  it('erlaubt einen eigenen topInset (z. B. 0 fuer Telefon-Hochformat ohne Kopf)', () => {
    const rect = visibleRect({ width: 375, height: 667 }, { topInset: 0, bottomBarHeight: 56 })
    expect(rect).toEqual({ x: 0, y: 0, width: 375, height: 611 })
  })

  it('bleibt bei width/height=0, wenn Insets die Ansicht komplett ausfuellen', () => {
    const rect = visibleRect({ width: 300, height: 200 }, { hintColumnWidth: 200, toolsWidth: 200 })
    expect(rect.width).toBe(0)
    expect(rect.height).toBe(188)
  })

  it('klemmt negative Insets nicht negativ (Schutz vor Fehlkonfiguration)', () => {
    const rect = visibleRect({ width: 500, height: 400 }, { hintColumnWidth: -50, bottomBarHeight: -10 })
    expect(rect).toEqual({ x: 0, y: 12, width: 500, height: 388 })
  })
})

describe('centreOnVisible', () => {
  const rect = { x: 220, y: 12, width: 1012, height: 678 }

  it('zentriert einen Punkt mittig im Rechteck (Normalfall)', () => {
    const point = centreOnVisible({ x: 700, y: 400 }, { width: 288, height: 160 }, rect)
    expect(point).toEqual({ x: 700 - 144, y: 400 - 80 })
  })

  it('klemmt an die linke/obere Kante, wenn der Punkt zu nah am Rand liegt', () => {
    const point = centreOnVisible({ x: 230, y: 20 }, { width: 288, height: 160 }, rect)
    expect(point).toEqual({ x: rect.x, y: rect.y })
  })

  it('klemmt an die rechte/untere Kante, wenn der Punkt zu nah am Rand liegt', () => {
    const point = centreOnVisible({ x: 1220, y: 680 }, { width: 288, height: 160 }, rect)
    expect(point).toEqual({ x: rect.x + rect.width - 288, y: rect.y + rect.height - 160 })
  })

  it('klemmt zusaetzlich an optionale limits (z. B. Kartengrenzen), falls enger als rect', () => {
    const limits = { x: 220, y: 12, width: 400, height: 300 }
    const point = centreOnVisible({ x: 700, y: 400 }, { width: 288, height: 160 }, rect, limits)
    expect(point.x).toBe(limits.x + limits.width - 288)
    expect(point.y).toBe(limits.y + limits.height - 160)
  })

  it('faellt bei view groesser als rect auf die Rect-Kante zurueck statt negativ zu ragen', () => {
    const smallRect = { x: 0, y: 0, width: 200, height: 100 }
    const point = centreOnVisible({ x: 100, y: 50 }, { width: 288, height: 160 }, smallRect)
    expect(point).toEqual({ x: 0, y: 0 })
  })
})
