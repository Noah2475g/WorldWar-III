import { parseRules, RulesError } from '@worldwar/core'
import { RAW_DEFAULT_RULES, TEST_RULES } from '@worldwar/testkit'
import { describe, expect, it } from 'vitest'

/**
 * Handelsangebote der KI (R-DIP-05, D29.7, D29.8, T-M17-10).
 *
 * Die Zahlen zuerst (L1–L3): ohne sie ergibt jede Rechnung `NaN`, und die KI naehme nie
 * etwas an und boete nie etwas an, ohne dass ein Test das je bemerkte (rules/load.ts).
 */
describe('D29.7 Die Handelszahlen der KI stehen im Regelwerk', () => {
  it('fuehrt die vier neuen Zahlen mit den vereinbarten Werten', () => {
    expect(TEST_RULES.ai.tradeAcceptMarginPermille).toBe(1050)
    expect(TEST_RULES.ai.tradeImpactPermille).toBe(30)
    expect(TEST_RULES.ai.tradeOfferPremiumPermille).toBe(1060)
    expect(TEST_RULES.ai.tradeKeepStockPermille).toBe(500)
  })

  it('wirft ohne tradeImpactPermille', () => {
    const { tradeImpactPermille, ...rest } = RAW_DEFAULT_RULES.ai as Record<string, unknown>
    const raw = { ...RAW_DEFAULT_RULES, ai: rest }
    expect(() => parseRules(raw, 'default')).toThrow(RulesError)
    try {
      parseRules(raw, 'default')
    } catch (error) {
      expect(error).toBeInstanceOf(RulesError)
      expect((error as RulesError).message).toContain('tradeImpactPermille')
    }
  })

  it('wirft bei einer Annahmemarge unter 1000', () => {
    const raw = { ...RAW_DEFAULT_RULES, ai: { ...RAW_DEFAULT_RULES.ai, tradeAcceptMarginPermille: 900 } }
    expect(() => parseRules(raw, 'default')).toThrow(RulesError)
  })
})
