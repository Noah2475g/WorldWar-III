import { describe, expect, it } from 'vitest'
import { fixture, scan } from './scan'

/**
 * Product goal Z2: this game has no monetization at all. Not "fair" monetization,
 * not cosmetics — none. The guard makes that structural instead of a promise.
 */
const CURRENCY_TERMS =
  /\b(goldmark|premiumBalance|premiumCurrency|microtransaction|inAppPurchase|iapProduct|priceEur|priceUsd|checkout|paywall|SHOP_ITEMS|buyWithGold)\b/i

describe('R-FREE-01 keine Kaufwaehrung im Produktcode', () => {
  it('findet keine Kaufwaehrungs-Begriffe in packages/ und apps/', () => {
    const hits = scan(CURRENCY_TERMS)
    expect(
      hits,
      `Kaufwaehrungs-Begriffe gefunden:\n${hits.map((h) => `${h.file}:${h.line}  ${h.text}`).join('\n')}`,
    ).toEqual([])
  })

  it('schlaegt bei der hinterlegten Verstoss-Fixture an', () => {
    // Proves the guard can fail. A guard that never fires protects nothing.
    const violating = fixture('monetization')
    const offending = violating
      .split(/\r?\n/)
      .filter((line) => CURRENCY_TERMS.test(line) && !/eslint-disable|GUARD-ALLOW/.test(line))
    expect(offending.length).toBeGreaterThan(0)
  })
})
