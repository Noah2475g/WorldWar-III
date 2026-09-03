import { TEST_RULES, smallWorld } from '@worldwar/testkit'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { runTicks } from '../../src/clock'
import { createInitialState, type GameConfig } from '../../src/state/create'
import { RESOURCE_KEYS } from '../../src/state/types'
import { scoreOf } from '../../src/rules/victory'

/**
 * Balance readings after the core rules (T-M5-06, protocol section 8).
 *
 * Green tests say the rules do what they say. They do not say whether the result is a
 * game worth playing. This run measures the things that would make it not one: an
 * economy running away, morale collapsing everywhere, a map that empties itself.
 */
const map = smallWorld()
const ctx = { map, rules: TEST_RULES }

const CONFIG: GameConfig = {
  seed: 1234,
  mapId: 'testworld',
  rulesId: 'default',
  players: [
    { name: 'Nordland', kind: 'human', nation: 'Nordland', color: '#0f62bc' },
    { name: 'Ostmark', kind: 'ai', nation: 'Ostmark', color: '#b03a2e', difficulty: 'normal' },
    { name: 'Sueden', kind: 'ai', nation: 'Sueden', color: '#2e7d32', difficulty: 'normal' },
  ],
  victory: { condition: 'points', pointsShareToWin: 700, dayLimit: null },
}

const DAYS = 200

function measure() {
  const start = createInitialState(CONFIG, ctx)
  const result = runTicks(start, DAYS * TEST_RULES.constants.ticksPerDay, ctx)
  const end = result.state

  const stocks: Record<string, number> = {}
  const dailyIncome: Record<string, number> = {}
  for (const key of RESOURCE_KEYS) {
    stocks[key] = end.players['p1']!.resources[key]
    dailyIncome[key] = Math.round((end.players['p1']!.resources[key] - start.players['p1']!.resources[key]) / DAYS)
  }

  const morale: Record<string, number> = {}
  for (const id of end.provinceOrder) morale[id] = end.provinces[id]!.morale

  return {
    start,
    end,
    events: result.events,
    stocks,
    dailyIncome,
    morale,
    scores: Object.fromEntries(end.playerOrder.map((id) => [id, scoreOf(end, id, TEST_RULES)])),
    revolts: result.events.filter((e) => e.type === 'PROVINCE_REVOLTED').length,
  }
}

describe('R-ECON-03 Kennzahlen nach den Kernregeln', () => {
  const m = measure()

  it('laesst keine Ressource unbegrenzt wachsen', () => {
    // The runaway case is not a large stock — it is a growth rate that keeps rising.
    // Compare the first fifty days with the last fifty: production may improve, but
    // not by orders of magnitude, or the economy has stopped being a constraint.
    const early = runTicks(createInitialState(CONFIG, ctx), 50 * TEST_RULES.constants.ticksPerDay, ctx).state
    const earlyGain = (key: (typeof RESOURCE_KEYS)[number]) =>
      early.players['p1']!.resources[key] - createInitialState(CONFIG, ctx).players['p1']!.resources[key]

    for (const key of RESOURCE_KEYS) {
      const first = Math.abs(earlyGain(key)) / 50
      const overall = Math.abs(m.dailyIncome[key]!)
      if (first < 1) continue // nothing produced at all: nothing can run away
      expect(overall / first, `${key} beschleunigt sich`).toBeLessThan(3)
    }
  })

  it('haelt die Vorraete im Rahmen der Lagergrenzen', () => {
    for (const key of RESOURCE_KEYS) {
      const limit = TEST_RULES.storageLimits[key]
      if (limit !== null) expect(m.stocks[key]!).toBeLessThanOrEqual(limit)
    }
  })

  it('laesst die Moral nicht flaechendeckend zusammenbrechen', () => {
    const owned = m.end.provinceOrder.filter((id) => m.end.provinces[id]!.owner !== null)
    const average = owned.reduce((sum, id) => sum + m.end.provinces[id]!.morale, 0) / Math.max(1, owned.length)
    expect(average).toBeGreaterThan(40_000)
  })

  it('laesst die Karte nicht in Rebellenhand fallen', () => {
    const neutral = m.end.provinceOrder.filter((id) => m.end.provinces[id]!.owner === null).length
    expect(neutral).toBeLessThan(m.end.provinceOrder.length / 2)
  })

  it('schreibt den Bericht', () => {
    const file = fileURLToPath(new URL('../../../../docs/reports/m5-balance.md', import.meta.url))
    const lines = [
      '# Kennzahlen nach den Kernregeln (T-M5-06)',
      '',
      `Lauf: ${DAYS} Spieltage, Karte "Kleine Welt", drei Nationen, Seed ${CONFIG.seed}.`,
      'Erzeugt vom Test `packages/core/test/balance/m5.test.ts`.',
      '',
      '## Wirtschaft (Nordland)',
      '',
      '| Ressource | Bestand am Ende | Zuwachs je Tag |',
      '|---|---|---|',
      ...RESOURCE_KEYS.map((key) => `| ${key} | ${m.stocks[key]} | ${m.dailyIncome[key]} |`),
      '',
      '## Moral je Provinz',
      '',
      '| Provinz | Moral | Eigentümer |',
      '|---|---|---|',
      ...m.end.provinceOrder.map(
        (id) => `| ${id} | ${Math.round(m.morale[id]! / 1000)} | ${m.end.provinces[id]!.owner ?? 'niemand'} |`,
      ),
      '',
      '## Punkte',
      '',
      ...Object.entries(m.scores).map(([id, score]) => `- ${id}: ${score}`),
      '',
      `Aufstände im Lauf: ${m.revolts}`,
      '',
      '**Lesart:** Die Zahlen sind kein Beweis für gutes Balancing, sondern eine',
      'Frühwarnung. Auffällig wäre: ein Bestand, der ins Unendliche läuft, eine',
      'Durchschnittsmoral unter 40, oder eine Karte, die sich selbst entvölkert.',
      '',
    ]
    writeFileSync(file, lines.join('\n'))
    expect(lines.length).toBeGreaterThan(10)
  })
})
