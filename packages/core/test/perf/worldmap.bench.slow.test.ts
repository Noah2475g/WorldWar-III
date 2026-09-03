import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { runAi, storeMemories } from '@worldwar/ai'
import { runTicks, validateMap, type MapData } from '@worldwar/core'
import { TEST_RULES } from '@worldwar/testkit'
import { describe, expect, it } from 'vitest'
import { createInitialState, type GameConfig } from '../../src/state/create'

/**
 * The core rules on the real world map (T-M9-04, R-ARCH-06).
 *
 * Everything before this measured the twelve-province test map. That map fits in a
 * cache line; the world map has 237 provinces, 658 edges and 24 nations, and a rule
 * that costs nothing on the small map can cost everything here. This is the run that
 * says whether the game is playable at all.
 *
 * Slow suite: timing a simulation while thirty other test files run in parallel
 * measures the machine's load, not the code.
 */

const ROOT = fileURLToPath(new URL('../../../..', import.meta.url))
const map = JSON.parse(readFileSync(`${ROOT}/data/maps/world.json`, 'utf8')) as MapData
// The shipped rules, parsed through the real loader — the same ones the game uses.
const rules = TEST_RULES
const ctx = { map, rules }

/** Twelve powers, half of them on the hardest setting — a busy world, not an idle one. */
const CONFIG: GameConfig = {
  seed: 1914,
  mapId: 'world',
  rulesId: 'default',
  players: map.startPositions.slice(0, 12).map((start, index) => ({
    name: start.nation,
    kind: 'ai' as const,
    nation: start.nation,
    color: ['#2C5F7C', '#7C3F2C', '#4A5D2C', '#5B3A6B', '#9FB2BE', '#C4A99C'][index % 6]!,
    difficulty: index % 2 === 0 ? ('hard' as const) : ('normal' as const),
  })),
  victory: { condition: 'points', pointsShareToWin: 950, dayLimit: null },
}

function newGame() {
  const state = createInitialState(CONFIG, ctx)
  // A world at peace measures nothing: without war there are no battles, no movement
  // and no reason for the AI to think.
  const ids = state.playerOrder
  for (let i = 0; i + 1 < ids.length; i += 2) {
    const key = `${ids[i]}|${ids[i + 1]}`
    if (state.diplomacy.relations[key]) state.diplomacy.relations[key]!.state = 'war'
  }
  return state
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0
}

describe('R-ARCH-06 Die Weltkarte traegt die Kernregeln', () => {
  it('ist ueberhaupt eine gueltige Karte', () => {
    const result = validateMap(map)
    expect(result.ok, JSON.stringify(result.ok ? {} : result.errors.slice(0, 5))).toBe(true)
    expect(map.provinces.length).toBeGreaterThan(150)
  })

  it('haelt das Tickbudget auf 237 Provinzen', () => {
    let state = newGame()
    const durations: number[] = []

    // 480 ticks: twenty game days, long enough for production, construction, movement
    // and the first battles to be in the measurement rather than just the warm-up.
    for (let tick = 0; tick < 480; tick++) {
      const started = performance.now()
      const { commands, memories } = runAi(state, ctx)
      const result = runTicks(state, 1, ctx, () => commands)
      state = result.state
      storeMemories(state, memories)
      durations.push(performance.now() - started)
    }

    const report = {
      map: map.id,
      provinces: map.provinces.length,
      edges: map.edges.length,
      players: CONFIG.players.length,
      ticks: durations.length,
      medianMs: Number(median(durations).toFixed(3)),
      p99Ms: Number(percentile(durations, 0.99).toFixed(3)),
      measuredAt: new Date().toISOString(),
    }
    mkdirSync(`${ROOT}/docs/reports`, { recursive: true })
    writeFileSync(`${ROOT}/docs/reports/worldmap-bench.json`, JSON.stringify(report, null, 2) + '\n')

    // The budget from the design, scaled to a full world: a tick has to stay well
    // inside a display frame, or the interactive speeds are a promise that cannot be
    // kept (R-TIME-02).
    expect(report.medianMs, `Median ${report.medianMs} ms`).toBeLessThan(8)
    expect(report.p99Ms, `p99 ${report.p99Ms} ms`).toBeLessThan(40)
  })

  it('laeuft tausend Spieltage ohne Fehler und ohne Speicherwuchs', () => {
    let state = newGame()
    const ticksPerDay = rules.constants.ticksPerDay

    for (let day = 0; day < 1000; day++) {
      const { commands, memories } = runAi(state, ctx)
      const result = runTicks(state, ticksPerDay, ctx, () => commands)
      state = result.state
      storeMemories(state, memories)
      if (state.victory.winner !== null) break
    }

    expect(state.tick).toBeGreaterThan(0)
    // The event log is a ring buffer; if it ever grew without bound, a thousand days
    // would be where it showed.
    expect(state.eventLog.length).toBeLessThan(20_000)
    for (const province of Object.values(state.provinces)) {
      expect(Number.isFinite(province.morale), `${province.id} hat keine Moral mehr`).toBe(true)
    }
  })
})
