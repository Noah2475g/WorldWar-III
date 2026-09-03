import type { BuildingKey, Command, ResourceKey } from '@worldwar/core'
import type { AiContext, Explanation } from './types'

/**
 * Economic decisions (T-M7-02).
 *
 * Priorities, in order: fix a shortage, then build what is missing to raise troops,
 * then improve what pays. The AI never spends its last reserves — a bankrupt nation
 * cannot even keep its army fed, which is a worse position than an unbuilt factory.
 */

/** Keep this share of a resource untouched, as a buffer against upkeep. */
export const RESERVE_PERMILLE = 200

function canAfford(context: AiContext, cost: Partial<Record<ResourceKey, number>>): boolean {
  for (const [key, amount] of Object.entries(cost)) {
    if (!amount) continue
    const stock = context.view.self.resources[key as ResourceKey]
    // eslint-disable-next-line no-restricted-syntax -- reserve share of the stock, plain integers
    const reserve = Math.trunc((stock * RESERVE_PERMILLE) / 1000)
    if (stock - reserve < amount) return false
  }
  return true
}

/** What a province is missing most, in the order the AI cares about. */
function nextBuilding(context: AiContext, provinceId: string): BuildingKey | null {
  const province = context.view.provinces.find((entry) => entry.id === provinceId)
  if (!province || province.owner !== context.view.playerId) return null

  const level = (key: BuildingKey) => province.buildings?.[key] ?? 0
  const shortages = new Set(context.view.self.shortages)

  // A nation that cannot raise infantry has no other problem worth solving.
  if (level('barracks') === 0) return 'barracks'
  // Under pressure, fortify rather than expand.
  if (shortages.size === 0 && level('factory') === 0 && province.kind === 'city') return 'factory'
  if (level('railway') === 0) return 'railway'
  if (level('fortress') < 2) return 'fortress'
  if (province.coastal && level('harbour') === 0) return 'harbour'
  return null
}

export function economyCommands(context: AiContext, explanations: Explanation[]): Command[] {
  const commands: Command[] = []
  const own = context.view.provinces.filter((province) => province.owner === context.view.playerId)

  for (const province of own) {
    if ((province.buildQueueLength ?? 0) > 0) continue

    const building = nextBuilding(context, province.id)
    if (!building) continue

    const rule = context.rules.buildings[building]
    if (!canAfford(context, rule.cost)) {
      explanations.push({
        action: `Bau ${building} in ${province.id} aufgeschoben`,
        reason: 'Vorräte reichen nicht über die Rücklage hinaus',
        score: 0,
      })
      continue
    }

    commands.push({ type: 'BUILD', playerId: context.view.playerId, provinceId: province.id, building })
    explanations.push({
      action: `Baut ${building} in ${province.id}`,
      reason:
        building === 'barracks'
          ? 'ohne Rekrutierungsbüro keine Truppen'
          : building === 'fortress'
            ? 'Grenzprovinz sichern'
            : 'Wirtschaft ausbauen',
      score: 600,
    })

    // One build order per tick keeps the treasury from being emptied in one go.
    break
  }

  return commands
}

/** Raises troops where possible, sized to what the treasury can carry. */
export function recruitCommands(context: AiContext, explanations: Explanation[]): Command[] {
  const commands: Command[] = []
  const playerId = context.view.playerId

  for (const province of context.view.provinces) {
    if (province.owner !== playerId) continue
    if ((province.buildings?.barracks ?? 0) === 0) continue

    const unitKey = (province.buildings?.factory ?? 0) > 0 ? 'tank' : 'infantry'
    const unit = context.rules.units[unitKey]
    if (!unit) continue

    // Batch size: what the difficulty's share of the treasury pays for, capped so a
    // single order never becomes the whole army.
    let affordable = 15
    for (const [key, amount] of Object.entries(unit.cost)) {
      if (!amount) continue
      const stock = context.view.self.resources[key as ResourceKey]
      // eslint-disable-next-line no-restricted-syntax -- share of stock divided by unit cost, plain integers
      const budget = Math.trunc((stock * context.difficulty.recruitShare) / 1000)
      // eslint-disable-next-line no-restricted-syntax -- budget divided by unit cost, plain integers
      affordable = Math.min(affordable, Math.trunc(budget / amount))
    }
    if (affordable < 1) continue

    commands.push({ type: 'RECRUIT', playerId, provinceId: province.id, unitKey, count: affordable })
    explanations.push({
      action: `Rekrutiert ${affordable}x ${unitKey} in ${province.id}`,
      reason: 'Streitkräfte aufbauen',
      score: 500,
      alternative: { action: 'nichts rekrutieren', score: 200 },
    })
    break
  }

  return commands
}

/** Trades away a surplus to cover a shortage — the AI uses the same market as everyone. */
export function tradeCommands(context: AiContext, explanations: Explanation[]): Command[] {
  const shortages = context.view.self.shortages
  if (shortages.length === 0) return []

  const need = shortages[0]!
  const resources = context.view.self.resources

  // Sell the largest stock that is not itself short.
  let best: ResourceKey | null = null
  let bestAmount = 0
  for (const [key, amount] of Object.entries(resources)) {
    const resource = key as ResourceKey
    if (resource === need || shortages.includes(resource)) continue
    if (amount > bestAmount) {
      best = resource
      bestAmount = amount
    }
  }

  // eslint-disable-next-line no-restricted-syntax -- a tenth of the stock, plain integers
  const give = Math.trunc(bestAmount / 10)
  if (!best || give < 1000) return []

  explanations.push({
    action: `Tauscht ${give} ${best} gegen ${need}`,
    reason: `Mangel an ${need} decken`,
    score: 700,
  })
  return [{ type: 'TRADE', playerId: context.view.playerId, give: best, giveAmount: give, want: need }]
}
