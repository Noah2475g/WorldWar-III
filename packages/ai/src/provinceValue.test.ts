import { parseRules, RulesError } from '@worldwar/core'
import { RAW_DEFAULT_RULES, TEST_RULES } from '@worldwar/testkit'
import { describe, expect, it } from 'vitest'

/**
 * Die Zahlen des Provinzhandels (R-DIP-09, D29.7, D29.8, T-M17-11). Ohne sie ergibt jede
 * Rechnung `NaN`, und die KI naehme nie eine Provinz an, ohne dass ein Test das bemerkte.
 */
describe('D29.7 Die Zahlen des Provinzhandels stehen im Regelwerk', () => {
  it('fuehrt die drei neuen Zahlen', () => {
    expect(TEST_RULES.ai.provinceValueHorizonDays).toBe(60)
    expect(TEST_RULES.ai.provinceSalePremiumPermille).toBe(1300)
    expect(TEST_RULES.ai.provinceValuePositionPermille).toBe(250)
  })

  it('wirft ohne provinceValueHorizonDays', () => {
    const rest = { ...(RAW_DEFAULT_RULES.ai as Record<string, unknown>) }
    delete rest.provinceValueHorizonDays
    const raw = { ...RAW_DEFAULT_RULES, ai: rest }
    expect(() => parseRules(raw, 'default')).toThrow(RulesError)
    try {
      parseRules(raw, 'default')
    } catch (error) {
      expect(error).toBeInstanceOf(RulesError)
      expect((error as RulesError).message).toContain('provinceValueHorizonDays')
    }
  })

  it('wirft bei einem Aufschlag unter 1000', () => {
    const raw = { ...RAW_DEFAULT_RULES, ai: { ...RAW_DEFAULT_RULES.ai, provinceSalePremiumPermille: 900 } }
    expect(() => parseRules(raw, 'default')).toThrow(RulesError)
  })

  it('wirft bei Horizont 0 und bei Lage ueber 1000', () => {
    const rawHorizon = { ...RAW_DEFAULT_RULES, ai: { ...RAW_DEFAULT_RULES.ai, provinceValueHorizonDays: 0 } }
    expect(() => parseRules(rawHorizon, 'default')).toThrow(RulesError)
    const rawLage = { ...RAW_DEFAULT_RULES, ai: { ...RAW_DEFAULT_RULES.ai, provinceValuePositionPermille: 1001 } }
    expect(() => parseRules(rawLage, 'default')).toThrow(RulesError)
  })
})
