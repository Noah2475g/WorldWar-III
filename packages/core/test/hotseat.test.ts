import { hashValue } from '@worldwar/shared'
import { TEST_RULES, placeArmy, smallWorld } from '@worldwar/testkit'
import { describe, expect, it } from 'vitest'
import { runTicks } from '../src/clock'
import type { Command } from '../src/commands/types'
import { createInitialState, type GameConfig } from '../src/state/create'
import { HASH_OMIT_KEYS, type GameState } from '../src/state/types'

/**
 * Hot seat: two human players in one game (R-ARCH-04/AK1, T-M5-05).
 *
 * Multiplayer is not part of V1, but the architecture claims to be ready for it. This
 * test is what keeps that claim honest — "human" is only an attribute on a player, and
 * two of them must need no special path through the core.
 */
const map = smallWorld()
const ctx = { map, rules: TEST_RULES }

const CONFIG: GameConfig = {
  seed: 2024,
  mapId: 'testworld',
  rulesId: 'default',
  players: [
    { name: 'Noah', kind: 'human', nation: 'Nordland', color: '#0f62bc' },
    { name: 'Freund', kind: 'human', nation: 'Ostmark', color: '#b03a2e' },
  ],
  victory: { condition: 'points', pointsShareToWin: 900, dayLimit: null },
}

function build(): GameState {
  const state = createInitialState(CONFIG, ctx)
  state.diplomacy.relations['p1|p2']!.state = 'war'
  placeArmy(state, { owner: 'p1', at: 'n2', units: [{ unitKey: 'infantry', hpTotal: 12_000 }] })
  placeArmy(state, { owner: 'p2', at: 'o3', units: [{ unitKey: 'infantry', hpTotal: 12_000 }] })
  return state
}

/** Both players act in the same tick — the case a turn-based core would not survive. */
const commandsFor = (tick: number): Command[] => {
  if (tick === 2) {
    return [
      { type: 'BUILD', playerId: 'p1', provinceId: 'n1', building: 'barracks' },
      { type: 'BUILD', playerId: 'p2', provinceId: 'o1', building: 'barracks' },
    ]
  }
  if (tick === 5) {
    return [
      { type: 'MOVE_ARMY', playerId: 'p1', armyId: 'a1', targetProvinceId: 'm1' },
      { type: 'MOVE_ARMY', playerId: 'p2', armyId: 'a2', targetProvinceId: 'm1' },
    ]
  }
  return []
}

describe('R-ARCH-04 Hot-Seat: zwei menschliche Spieler', () => {
  it('laeuft 200 Stunden ohne Sonderpfad im Kern', () => {
    const result = runTicks(build(), 200, ctx, commandsFor)
    expect(result.state.tick).toBe(200)
    expect(result.state.players['p1']!.kind).toBe('human')
    expect(result.state.players['p2']!.kind).toBe('human')
  })

  it('wendet beide Kommandostroeme tickgenau an', () => {
    const result = runTicks(build(), 200, ctx, commandsFor)
    const built = result.events.filter((e) => e.type === 'BUILD_STARTED')
    expect(built.map((e) => (e as { playerId: string }).playerId).sort()).toEqual(['p1', 'p2'])
  })

  it('bleibt reproduzierbar', () => {
    const a = runTicks(build(), 200, ctx, commandsFor).state
    const b = runTicks(build(), 200, ctx, commandsFor).state
    expect(hashValue(a, { omitKeys: HASH_OMIT_KEYS })).toBe(hashValue(b, { omitKeys: HASH_OMIT_KEYS }))
  })

  it('braucht kein KI-Gedaechtnis fuer menschliche Spieler', () => {
    const state = build()
    expect(Object.keys(state.ai)).toHaveLength(0)
    expect(runTicks(state, 50, ctx).state.tick).toBe(50)
  })

  it('laesst beide Seiten gegeneinander kaempfen', () => {
    const result = runTicks(build(), 200, ctx, commandsFor)
    expect(result.events.some((e) => e.type === 'BATTLE_RESOLVED')).toBe(true)
  })
})
