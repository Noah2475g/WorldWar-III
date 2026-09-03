import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createInitialState, economyOverview, parseRules, type GameConfig, type MapData, type Rules } from '@worldwar/core'
import { describe, expect, it } from 'vitest'

/**
 * The world map on the scale of the rules (R-ECON-01, R-GAME-01).
 *
 * The rules were balanced on the small test map. The first world map carried deposits
 * and population a thousand times larger — every validator passed, every start value
 * sat within fifteen per cent of the median, and a barracks cost four game-minutes of
 * income. Consistency among the data proves nothing about its scale; only a figure a
 * player would feel does. So this measures one: how many days of income the first
 * building costs, on the world map against the reference map, with the real rules.
 */

const ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const load = (path: string) => JSON.parse(readFileSync(`${ROOT}/${path}`, 'utf8')) as never

const rules: Rules = parseRules(
  {
    constants: load('data/rules/default/constants.json'),
    resources: load('data/rules/default/resources.json'),
    buildings: load('data/rules/default/buildings.json'),
    units: load('data/rules/default/units.json'),
    ai: load('data/rules/default/ai.json'),
  },
  'default',
)
const world = load('data/maps/world.json') as MapData
const reference = load('data/maps/testworld.json') as MapData

interface DayOne {
  nation: string
  /** Days of own production the first barracks costs, per resource it needs. */
  barracksDays: { wood: number; money: number }
  perDay: Record<'food' | 'wood' | 'iron' | 'money', number>
}

function dayOne(map: MapData, nation: string): DayOne {
  const own = map.startPositions.find((s) => s.nation === nation)!
  const other = map.startPositions.find((s) => s !== own)!
  const config: GameConfig = {
    seed: 1,
    mapId: map.id,
    rulesId: 'default',
    players: [
      { name: own.nation, kind: 'human', nation: own.nation, color: '#000000' },
      { name: other.nation, kind: 'ai', nation: other.nation, color: '#111111', difficulty: 'normal' },
    ],
    victory: { condition: 'points', pointsShareToWin: 700, dayLimit: null },
  }
  const state = createInitialState(config, { map, rules })
  const economy = economyOverview(state, 'p1', rules)
  const barracks = rules.buildings.barracks!
  const days = (resource: 'wood' | 'money') =>
    (barracks.cost[resource] ?? 0) / Math.max(1, economy[resource].production)

  return {
    nation,
    barracksDays: { wood: days('wood'), money: days('money') },
    perDay: {
      food: economy.food.production,
      wood: economy.wood.production,
      iron: economy.iron.production,
      money: economy.money.production,
    },
  }
}

const median = (values: number[]): number => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!

describe('R-ECON-01 Die Weltkarte liegt auf der Skala der Regeln', () => {
  const nations = world.startPositions.map((s) => dayOne(world, s.nation))
  // The nation the rules were tuned against: three provinces, everything it needs.
  const anchor = dayOne(reference, reference.startPositions[0]!.nation)

  it('laesst jede Macht ihre erste Kaserne aus eigener Produktion bezahlen — in Tagen, nicht in Minuten', () => {
    // Under half a day the cost is decoration; over a month the game has not started.
    for (const nation of nations) {
      const { wood, money } = nation.barracksDays
      expect(wood, `${nation.nation}: Kaserne kostet ${wood.toFixed(1)} Tage Material`).toBeGreaterThanOrEqual(0.5)
      expect(wood, `${nation.nation}: Kaserne kostet ${wood.toFixed(1)} Tage Material`).toBeLessThanOrEqual(30)
      expect(money, `${nation.nation}: Kaserne kostet ${money.toFixed(1)} Tage Geld`).toBeGreaterThanOrEqual(0.5)
      expect(money, `${nation.nation}: Kaserne kostet ${money.toFixed(1)} Tage Geld`).toBeLessThanOrEqual(30)
    }
  })

  it('haelt die typische Macht in Reichweite der Referenzkarte', () => {
    // Within a factor of four of the map the numbers were tuned on. A thousandfold gap
    // passed every other test there is.
    for (const resource of ['wood', 'money'] as const) {
      const typical = median(nations.map((n) => n.barracksDays[resource]))
      const ratio = typical / anchor.barracksDays[resource]
      expect(ratio, `${resource}: ${typical.toFixed(1)} Tage gegen ${anchor.barracksDays[resource].toFixed(1)} auf der Referenz`).toBeGreaterThanOrEqual(1 / 4)
      expect(ratio, `${resource}: ${typical.toFixed(1)} Tage gegen ${anchor.barracksDays[resource].toFixed(1)} auf der Referenz`).toBeLessThanOrEqual(4)
    }
  })

  it('gibt jeder Macht vom ersten Tag an Nahrung, Material, Erz und Geld', () => {
    for (const nation of nations) {
      for (const resource of ['food', 'wood', 'iron', 'money'] as const) {
        expect(nation.perDay[resource], `${nation.nation} produziert kein ${resource}`).toBeGreaterThan(0)
      }
    }
  })

  it('siedelt die Provinzen auf der Referenzbevoelkerung des Kerns', () => {
    // production.ts scales output by population against 300 000 and caps the factor at
    // 1,5. When every province sits on that cap, population has stopped meaning anything.
    const populations = world.provinces.map((p) => p.population)
    const typical = median(populations)
    expect(typical).toBeGreaterThanOrEqual(150_000)
    expect(typical).toBeLessThanOrEqual(900_000)
    const belowCap = populations.filter((p) => p < 450_000).length / populations.length
    expect(belowCap, 'fast jede Provinz haengt am Deckel des Bevoelkerungsfaktors').toBeGreaterThan(0.2)
  })
})
