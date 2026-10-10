import { describe, expect, it } from 'vitest'
import { centreOnVisible } from './viewRect.ts'

describe('centreOnVisible (E7, D8-Folge-Fix M49)', () => {
  const limits = { width: 4000, height: 4000, viewportWidth: 1280, viewportHeight: 744, minScale: 1, maxScale: 8 }

  it('zentriert ohne Insets wie die volle Leinwand (Default-Abstand oben 12px, D12)', () => {
    const view = centreOnVisible({ x: 2000, y: 2000 }, { x: 0, y: 0, scale: 2 }, limits)
    expect(view.x).toBeCloseTo(2000 - (1280 * 2) / 2)
    expect(view.y).toBeCloseTo(2000 - (12 + (744 - 12) / 2) * 2)
  })

  it('zentriert mit Leiste unten hoeher im Bild, so dass der Punkt ueber der Leiste bleibt', () => {
    const view = centreOnVisible({ x: 2000, y: 2000 }, { x: 0, y: 0, scale: 2 }, limits, { bottomBarHeight: 72 })
    // Die sichtbare Mitte rutscht wegen der Leiste unten weiter nach oben (kleinere
    // Bildschirm-y); damit view.y weniger subtrahiert — der Wert steigt.
    const withoutInset = centreOnVisible({ x: 2000, y: 2000 }, { x: 0, y: 0, scale: 2 }, limits)
    expect(view.y).toBeGreaterThan(withoutInset.y)
  })

  it('bleibt in den Grenzen geklemmt (Rand der Karte)', () => {
    const view = centreOnVisible({ x: 10, y: 10 }, { x: 0, y: 0, scale: 2 }, limits, { bottomBarHeight: 72 })
    expect(view.x).toBeGreaterThanOrEqual(0)
    expect(view.y).toBeGreaterThanOrEqual(0)
  })
})
