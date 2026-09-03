import { TEST_RULES, smallWorld } from '@worldwar/testkit'
import { describe, expect, it } from 'vitest'
import { SWING_THRESHOLD, playOut, sweep, sweepableConstants, withConstant } from '../src/sweep'

/**
 * The balance tool (T-M12-00, R-AI-06).
 *
 * Tested on the small map: what is under test is the tool, not the balance. The real
 * sweep runs against the world map in the slow suite, because varying fifty constants
 * over several seeds is minutes of play, not seconds.
 */

const map = smallWorld()
const rules = TEST_RULES

describe('R-AI-06 Das Werkzeug misst, was eine Konstante bewirkt', () => {
  it('spielt eine Partie aus und beschreibt sie in Zahlen', () => {
    const result = playOut(map, rules, 3, 20, 7)

    expect(result.leaderShare).toBeGreaterThan(0)
    expect(result.leaderShare).toBeLessThanOrEqual(1)
    expect(result.survivors).toBeGreaterThan(0)
    expect(result.days).toBeGreaterThan(0)
  })

  it('spielt bei gleichem Seed dieselbe Partie', () => {
    // Without this the whole tool is noise: a difference between two variants could
    // just as well be a difference between two random games.
    expect(playOut(map, rules, 3, 15, 42)).toEqual(playOut(map, rules, 3, 15, 42))
  })

  it('spielt bei anderem Seed eine andere Partie', () => {
    const a = playOut(map, rules, 3, 40, 1)
    const b = playOut(map, rules, 3, 40, 2)

    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b))
  })

  it('variiert eine Konstante, ohne die anderen anzufassen', () => {
    const changed = withConstant(rules, 'battleRate', 1.25)

    expect(changed.constants.battleRate).toBeGreaterThan(rules.constants.battleRate)
    expect(changed.constants.startMorale).toBe(rules.constants.startMorale)
    // And the original is untouched — a sweep that mutates its input measures itself.
    expect(rules.constants.battleRate).not.toBe(changed.constants.battleRate)
  })

  it('laesst eine unbekannte Konstante das Regelwerk unveraendert', () => {
    expect(withConstant(rules, 'gibtEsNicht', 2)).toBe(rules)
  })

  it('findet die variierbaren Konstanten', () => {
    const names = sweepableConstants(rules)

    expect(names.length).toBeGreaterThan(20)
    expect(names).toContain('battleRate')
    // The comment field is not a constant.
    expect(names).not.toContain('_comment')
  })

  it('meldet je Konstante Ausschlag und ob sie den Ausgang traegt', () => {
    const effects = sweep({ map, rules, players: 3, days: 12, seeds: [11] }, ['battleRate', 'startMorale'])

    expect(effects).toHaveLength(2)
    for (const effect of effects) {
      expect(effect.swing).toBeGreaterThanOrEqual(0)
      expect(effect.loadBearing).toBe(effect.swing >= SWING_THRESHOLD)
      expect(effect.baseline.leaderShare).toBeGreaterThan(0)
    }
  })

  it('sortiert die wirksamsten Konstanten nach oben', () => {
    const effects = sweep({ map, rules, players: 3, days: 12, seeds: [3] }, ['battleRate', 'startMorale', 'minDamage'])

    for (let i = 1; i < effects.length; i++) {
      expect(effects[i - 1]!.swing).toBeGreaterThanOrEqual(effects[i]!.swing)
    }
  })
})
