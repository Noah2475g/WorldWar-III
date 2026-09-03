import { describe, expect, it } from 'vitest'
import { MAP_MODES, colorForPlayer, fillFor, legendFor, type ShadedProvince } from './modes.ts'
import { TOKENS } from '../ui/tokens.ts'
import { contrastRatio, deltaE } from '../ui/tokens.ts'

/**
 * The map modes (T-M10-03b, R-MAP-06).
 *
 * The failure worth guarding against is not an ugly colour — it is a colour that
 * *says something untrue*. A province the player cannot see must not be shaded as if
 * its morale were zero, because a shade reads as information.
 */

const province = (over: Partial<ShadedProvince> = {}): ShadedProvince => ({
  id: 'X',
  owner: 'p1',
  ...over,
})

describe('R-MAP-06 Vier Kartenmodi', () => {
  it('kennt genau die vier', () => {
    expect(MAP_MODES).toEqual(['political', 'resources', 'morale', 'threat'])
  })

  it('gibt in jedem Modus eine gueltige Farbe zurueck', () => {
    for (const mode of MAP_MODES) {
      const color = fillFor(province({ morale: 50, threat: 500, deposits: { food: 2000 } }), mode)
      expect(color, mode).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('faerbt Unbekanntes als unbekannt, nicht als null', () => {
    // The whole point: an unseen province is not a province with no morale.
    expect(fillFor(province({ morale: undefined }), 'morale')).toBe(TOKENS.paperSunk)
    expect(fillFor(province({ threat: undefined }), 'threat')).toBe(TOKENS.paperSunk)
    expect(fillFor(province({ deposits: undefined }), 'resources')).toBe(TOKENS.paperSunk)
    expect(fillFor(province({ owner: null }), 'political')).toBe(TOKENS.paperSunk)
  })

  it('unterscheidet hohe von niedriger Moral', () => {
    const low = fillFor(province({ morale: 5 }), 'morale')
    const high = fillFor(province({ morale: 95 }), 'morale')

    expect(low).not.toBe(high)
    // Low morale sits at the vermilion end of the scale, high morale at the green one.
    expect(deltaE(low, TOKENS.accent)).toBeLessThan(deltaE(low, TOKENS.good))
    expect(deltaE(high, TOKENS.good)).toBeLessThan(deltaE(high, TOKENS.accent))
  })

  it('unterscheidet reiche von armen Provinzen', () => {
    const poor = fillFor(province({ deposits: { food: 100 } }), 'resources')
    const rich = fillFor(province({ deposits: { food: 4000, iron: 3000, coal: 2000 } }), 'resources')

    expect(poor).not.toBe(rich)
  })

  it('gibt einem Spieler immer dieselbe Farbe', () => {
    // A nation that changes colour between sessions makes every screenshot and every
    // remembered front line worthless.
    expect(colorForPlayer('p3')).toBe(colorForPlayer('p3'))
    expect(colorForPlayer('p1')).not.toBe(colorForPlayer('p2'))
  })

  it('haelt Kartenschrift auf jeder Provinzfarbe lesbar', () => {
    for (const player of ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7']) {
      const ratio = contrastRatio(TOKENS.onPlayer, colorForPlayer(player))
      expect(ratio, `Schrift auf ${player}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('erklaert jeden Modus in der Legende', () => {
    for (const mode of MAP_MODES) {
      const legend = legendFor(mode)
      expect(legend.length, mode).toBeGreaterThanOrEqual(2)
      for (const entry of legend) {
        expect(entry.label.length, mode).toBeGreaterThan(2)
        expect(entry.color, mode).toMatch(/^#[0-9a-f]{6}$/i)
      }
    }
  })
})
