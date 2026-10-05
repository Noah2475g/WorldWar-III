import { ONE } from '@worldwar/shared'
import { TEST_RULES, placeArmy, smallWorld } from '@worldwar/testkit'
import { describe, expect, it } from 'vitest'
import { tickOfDay } from '../rules/availability'
import { defenceMultiplier } from '../rules/combat'
import { embarkCost, railwayFactor } from '../rules/movement'
import { buildingFactor } from './production'
import { targetMoraleFor } from './morale'
import { createInitialState, type GameConfig } from '../state/create'
import type { GameState, Province } from '../state/types'
import { step } from '../step'
import { canApply } from '../commands/registry'
import type { Command } from '../commands/types'

const map = smallWorld()
const ctx = { map, rules: TEST_RULES }
const CONFIG: GameConfig = {
  seed: 101,
  mapId: 'testworld',
  rulesId: 'default',
  players: [
    { name: 'A', kind: 'human', nation: 'Nordland', color: '#0f62bc' },
    { name: 'B', kind: 'ai', nation: 'Ostmark', color: '#b03a2e', difficulty: 'normal' },
  ],
  victory: { condition: 'points', pointsShareToWin: 900, dayLimit: null },
}

const TARGET = 'o1' // Stadt, Kueste, Hauptstadt von p2
const FULL = { barracks: 3, fortress: 5, factory: 3, harbour: 2, shipyard: 2, airfield: 2, railway: 3 }
const UNITS = Object.keys(TEST_RULES.units)
const TPD = TEST_RULES.constants.ticksPerDay

function runTicks(state: GameState, n: number): GameState {
  let current = state
  for (let i = 0; i < n; i++) current = step(current, [], ctx).state
  return current
}

function conquered(): GameState {
  const state = createInitialState(CONFIG, ctx)
  state.tick = tickOfDay(95, TEST_RULES)
  for (const p of ['p1', 'p2']) for (const key of Object.keys(state.players[p]!.resources)) state.players[p]!.resources[key as 'food'] = 99_000_000
  state.diplomacy.relations['p1|p2']!.state = 'war'
  state.armies = {}
  state.armyOrder = []
  state.provinces[TARGET]!.buildings = { ...FULL } as Province['buildings']
  placeArmy(state, { owner: 'p1', at: TARGET, units: [{ unitKey: 'infantry', hpTotal: 10_000 }] })
  return runTicks(state, TPD)
}

const cctx = () => ({ ...ctx, commands: [], events: [] })
const rec = (s: GameState, p: string, unitKey: string) =>
  canApply(s, { type: 'RECRUIT', playerId: p, provinceId: TARGET, unitKey, count: 1 } as Command, cctx())
const without = (s: GameState, building: string): GameState => {
  const c = structuredClone(s)
  c.provinces[TARGET]!.buildings = { ...c.provinces[TARGET]!.buildings, [building]: 0 } as Province['buildings']
  return c
}

describe('R-BAT-04 Eroberung uebernimmt jedes Gebaeude (Playtest 2026-10-05)', () => {
  const base = conquered()
  const o1 = base.provinces[TARGET]!

  it('a) Besitzer p1, alle sieben Gebaeude unveraendert', () => {
    expect(o1.owner).toBe('p1')
    expect(o1.buildings).toEqual(FULL)
  })

  it.each(UNITS)('b) p1 hebt %s in der eroberten Provinz aus', (u) => {
    expect(rec(base, 'p1', u)).toEqual({ ok: true })
  })

  it.each(UNITS)('c) Schonfrist fuer %s: Moral 10_000 geht, nach der Frist nicht', (u) => {
    const grace = structuredClone(base)
    grace.provinces[TARGET]!.morale = 10_000
    expect(rec(grace, 'p1', u)).toEqual({ ok: true })
    const after = structuredClone(grace)
    after.provinces[TARGET]!.occupiedSince = after.tick - TEST_RULES.constants.occupationPenaltyDays * TPD
    const r = rec(after, 'p1', u)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.code).toBe('INVALID_TARGET')
      expect((r.detail as { reason: string }).reason).toBe('Moral zu niedrig')
    }
  })

  it('d) Fabrik wirkt fuer p1: Faktor und Eisenertrag hoeher als ohne Fabrik', () => {
    const no = without(base, 'factory')
    expect(buildingFactor(o1, 'iron', TEST_RULES)).toBeGreaterThan(buildingFactor(no.provinces[TARGET]!, 'iron', TEST_RULES))
    const withIron = runTicks(structuredClone(base), TPD).players['p1']!.resources.iron
    const noIron = runTicks(no, TPD).players['p1']!.resources.iron
    expect(withIron).toBeGreaterThan(noIron)
  })

  it('e) Festung gibt dem neuen Besitzer Verteidigungsbonus', () => {
    const no = without(base, 'fortress')
    expect(defenceMultiplier(o1, false, TEST_RULES, o1.owner === 'p1')).toBeGreaterThan(
      defenceMultiplier(no.provinces[TARGET]!, false, TEST_RULES, true),
    )
  })

  it('f) Eisenbahn beschleunigt den Marsch', () => {
    expect(railwayFactor(o1, TEST_RULES)).toBeGreaterThan(ONE)
  })

  it('g) Hafen senkt die Einschiffkosten', () => {
    const army = Object.values(base.armies).find((a) => a.owner === 'p1')!
    const i2 = base.provinces['i2']!
    const no = without(base, 'harbour')
    expect(embarkCost(base, army, o1, i2, TEST_RULES)).toBeLessThan(embarkCost(base, army, no.provinces[TARGET]!, i2, TEST_RULES))
  })

  it('h) Flugplatz erlaubt Luftverlegung nach o1, ohne Flugplatz nicht', () => {
    const s = structuredClone(base)
    s.provinces['n1']!.buildings = { ...s.provinces['n1']!.buildings, airfield: 1 } as Province['buildings']
    placeArmy(s, { owner: 'p1', at: 'n1', units: [{ unitKey: 'fighter', hpTotal: 10_000 }] })
    const air = Object.values(s.armies).find((a) => a.owner === 'p1' && a.units[0]!.unitKey === 'fighter')!
    const move = { type: 'MOVE_ARMY', playerId: 'p1', armyId: air.id, targetProvinceId: TARGET } as Command
    expect(canApply(s, move, cctx())).toEqual({ ok: true })
    const s2 = without(s, 'airfield')
    const r = canApply(s2, move, cctx())
    expect(r.ok).toBe(false)
    if (!r.ok) expect((r.detail as { reason: string }).reason).toBe('kein eigener Flugplatz')
  })

  it('i) Gebaeude erhoehen die Zielmoral', () => {
    const no = structuredClone(base)
    no.provinces[TARGET]!.buildings = {} as Province['buildings']
    const pc = { ...ctx, commands: [], events: [] } as never
    expect(targetMoraleFor(base, o1, pc)).toBeGreaterThan(targetMoraleFor(no, no.provinces[TARGET]!, pc))
  })

  it('j) p1 kann jedes Gebaeude ausbauen', () => {
    const s = structuredClone(base)
    s.provinces[TARGET]!.occupiedSince = s.tick - 400
    s.provinces[TARGET]!.morale = 80_000
    s.provinces[TARGET]!.buildings = { barracks: 1, fortress: 1, factory: 1, harbour: 1, shipyard: 1, airfield: 1, railway: 1 } as Province['buildings']
    for (const b of Object.keys(FULL)) {
      expect(canApply(s, { type: 'BUILD', playerId: 'p1', provinceId: TARGET, building: b } as Command, cctx())).toEqual({ ok: true })
    }
  })

  it('k) der alte Besitzer p2 darf nicht mehr ausheben', () => {
    const r = rec(base, 'p2', 'infantry')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('NOT_OWNER')
  })
})
