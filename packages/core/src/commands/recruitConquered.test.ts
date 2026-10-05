import { TEST_RULES, placeArmy, smallWorld } from '@worldwar/testkit'
import { describe, expect, it } from 'vitest'
import { tickOfDay } from '../rules/availability'
import { RECRUIT_MIN_MORALE } from '../rules/recruit'
import { createInitialState, type GameConfig } from '../state/create'
import type { GameState } from '../state/types'
import { step } from '../step'
import { canApply } from './registry'
import type { Command } from './types'

/**
 * Playtest 2026-10-04: "In einer eroberten Provinz konnte ich keine Einheiten ausheben, bis ich selber
 * das Gebaeude gebaut habe." Die Gebaeude bleiben bei der Eroberung stehen (`phases/occupation.ts`);
 * gesperrt hat die MORAL: Eroberung setzt sie auf `capturedMorale` (25 000 = genau `RECRUIT_MIN_MORALE`),
 * die erste Tagesabrechnung zieht sie gegen das Ziel, und das liegt in einer entfernten, ausgedehnten
 * Front-Provinz wegen des Besatzungsabzugs (14 Tage) unter 25 000. Ab dann lehnt RECRUIT mit
 * `INVALID_TARGET` / 'Moral zu niedrig' ab, obwohl `buildings.barracks` dem Spieler gehoert.
 *
 * Diese Datei haelt den gewuenschten Zustand fest (SOLL) und die Ursache (Test a).
 * Seit VM-01 (T-M47-01) gilt die Schonfrist; die Ursache bleibt in Test a belegt.
 */
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
  victory: { condition: 'points', pointsShareToWin: 600, dayLimit: null },
}

const recruit = { type: 'RECRUIT', playerId: 'p1', provinceId: 'm1', unitKey: 'infantry', count: 1 } as Command

/** p1 erobert m1 (mit Kaserne) als entfernte Front-Provinz seines Reiches und hat einen Tag lang regiert. */
function conqueredFrontProvinceAfterOneDay(): GameState {
  const state = createInitialState(CONFIG, ctx)
  state.tick = tickOfDay(60, TEST_RULES) // jede Einheit ist freigeschaltet
  for (const key of Object.keys(state.players['p1']!.resources)) state.players['p1']!.resources[key as 'food'] = 99_000_000
  state.diplomacy.relations['p1|p2']!.state = 'war'
  state.players['p1']!.capitalProvinceId = null // volle Entfernungsstrafe
  const m1 = state.provinces['m1']!
  // Reich von p1 breit (Ausdehnungsabzug), die vier Nachbarn von m1 in Feindeshand.
  for (const id of state.provinceOrder) state.provinces[id]!.owner = m1.neighbors.includes(id) ? 'p2' : 'p1'
  m1.owner = 'p2'
  m1.buildings.barracks = 1
  placeArmy(state, { owner: 'p1', at: 'm1', units: [{ unitKey: 'infantry', hpTotal: 10_000 }] })

  let current = state
  for (let i = 0; i < TEST_RULES.constants.ticksPerDay; i++) current = step(current, [], ctx).state
  return current
}

describe('R-UNIT-02/AK1 Schonfrist: Aushebung in einer eroberten Provinz (Playtest 2026-10-04)', () => {
  it('SOLL: eine eroberte Provinz mit eigener Kaserne hebt auch am zweiten Tag aus', () => {
    const state = conqueredFrontProvinceAfterOneDay()
    expect(state.provinces['m1']!.owner).toBe('p1')
    expect(canApply(state, recruit, { ...ctx, commands: [], events: [] })).toEqual({ ok: true })
  })

  // LOESCHVERMERK (Review): IST-Zustand vor VM-01 (LOESCHVERMERKE Nr. 59)
  // it('IST: die Gebaeude bleiben, aber die Moral sinkt unter die Aushebegrenze und sperrt RECRUIT', () => {
  // const state = conqueredFrontProvinceAfterOneDay()
  // const m1 = state.provinces['m1']!
  // expect(m1.owner).toBe('p1')
  // expect(m1.buildings.barracks).toBe(1) // nichts zerstoert, nichts zurueckgesetzt
  // expect(m1.morale).toBeLessThan(RECRUIT_MIN_MORALE)
  // expect(canApply(state, recruit, { ...ctx, commands: [], events: [] })).toEqual({
  // ok: false,
  // code: 'INVALID_TARGET',
  // detail: { reason: 'Moral zu niedrig', morale: m1.morale },
  // })
  // })

  it('die Gebaeude bleiben und die Moral liegt unter der Grenze — die Ursache bleibt belegt', () => {
    const state = conqueredFrontProvinceAfterOneDay()
    const m1 = state.provinces['m1']!
    expect(m1.owner).toBe('p1')
    expect(m1.buildings.barracks).toBe(1)
    expect(m1.morale).toBeLessThan(RECRUIT_MIN_MORALE)
  })

  const gesperrt = {
    ok: false,
    code: 'INVALID_TARGET',
    detail: { reason: 'Moral zu niedrig', morale: RECRUIT_MIN_MORALE - 1 },
  }
  const window = TEST_RULES.constants.occupationPenaltyDays * TEST_RULES.constants.ticksPerDay

  it('nach der Schonfrist gilt die Grenze wieder', () => {
    const state = conqueredFrontProvinceAfterOneDay()
    const m1 = state.provinces['m1']!
    m1.occupiedSince = state.tick - window
    m1.morale = RECRUIT_MIN_MORALE - 1
    expect(canApply(state, recruit, { ...ctx, commands: [], events: [] })).toEqual(gesperrt)
  })

  it('letzter Tick der Schonfrist hebt aus', () => {
    const state = conqueredFrontProvinceAfterOneDay()
    const m1 = state.provinces['m1']!
    m1.occupiedSince = state.tick - window + 1
    m1.morale = RECRUIT_MIN_MORALE - 1
    expect(canApply(state, recruit, { ...ctx, commands: [], events: [] })).toEqual({ ok: true })
  })

  it('eine nie eroberte Provinz unter der Grenze bleibt gesperrt', () => {
    const state = conqueredFrontProvinceAfterOneDay()
    const m1 = state.provinces['m1']!
    m1.occupiedSince = null
    m1.morale = RECRUIT_MIN_MORALE - 1
    expect(canApply(state, recruit, { ...ctx, commands: [], events: [] })).toEqual(gesperrt)
  })
})
