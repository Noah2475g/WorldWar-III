import { clampFixed, divFixed, mulChain, quotFixed, type Fixed } from '@worldwar/shared'
import type { Rules } from './types'
import type { MarketState, ResourceKey } from '../state/types'

/**
 * The exchange (R-ECON-05, design D6.8).
 *
 * One price per resource, the same for everybody. This is where the original sells an
 * advantage — resources at a fixed favourable rate for real money — and where we
 * deliberately do not: the rate moves with supply and demand, and it moves for all
 * players identically (R-FREE-02).
 */

/** Reference volume for one full elasticity step. Geschätzt. */
export const MARKET_REFERENCE_VOLUME = 1_000_000

export function createMarket(rules: Rules): MarketState {
  const prices = {} as Record<ResourceKey, Fixed>
  const demand = {} as Record<ResourceKey, Fixed>
  for (const [key, rule] of Object.entries(rules.resources)) {
    prices[key as ResourceKey] = rule.basePrice
    demand[key as ResourceKey] = 0
  }
  return { prices, tickDemand: demand }
}

/**
 * What a player gets for what they give.
 *
 * Both sides are valued at the frozen price of the tick, so the outcome does not
 * depend on who traded first (design D3, rule 3).
 */
export function exchangeAmount(
  market: MarketState,
  give: ResourceKey,
  giveAmount: Fixed,
  want: ResourceKey,
): Fixed {
  const givePrice = market.prices[give]
  const wantPrice = market.prices[want]
  if (wantPrice <= 0) return 0
  // eslint-disable-next-line no-restricted-syntax -- value in price units before dividing by the target price
  const value = giveAmount * givePrice
  return divFixed(value, wantPrice)
}

/** Records this tick's net demand; prices move once, in bookkeeping. */
export function recordDemand(
  market: MarketState,
  give: ResourceKey,
  giveAmount: Fixed,
  want: ResourceKey,
  wantAmount: Fixed,
): void {
  market.tickDemand[give] = (market.tickDemand[give] ?? 0) - giveAmount
  market.tickDemand[want] = (market.tickDemand[want] ?? 0) + wantAmount
}

/**
 * Applies the tick's demand to the prices and lets them drift back towards base.
 *
 * Buying pushes a price up, selling pushes it down, and left alone every price
 * returns to its base value — so a market corner cannot be held forever.
 */
export function settleMarket(market: MarketState, rules: Rules, isDayBoundary: boolean): void {
  for (const [key, rule] of Object.entries(rules.resources)) {
    const resource = key as ResourceKey
    const demand = market.tickDemand[resource] ?? 0
    let price = market.prices[resource]

    if (demand !== 0) {
      // mulChain already normalises: price x elasticity x share is the move itself.
      const share = quotFixed(demand, MARKET_REFERENCE_VOLUME) // may be negative
      price += mulChain([price, rules.constants.marketElasticity, share])
    }

    if (isDayBoundary) {
      const gap = rule.basePrice - price
      price += mulChain([gap, rules.constants.marketReversionPermille])
    }

    market.prices[resource] = clampFixed(
      price,
      rules.constants.marketMinPrice,
      rules.constants.marketMaxPrice,
    )
    market.tickDemand[resource] = 0
  }
}
