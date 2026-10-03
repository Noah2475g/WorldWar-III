import { createInitialState, publicView, step, unitCount, type Command, type GameConfig, type GameState } from '@worldwar/core'
import { TEST_RULES, placeArmy, smallWorld } from '@worldwar/testkit'
import { beforeEach, describe, expect, it } from 'vitest'
import { consolidateCommands } from './consolidate'
import { emptyMemory } from './decide'

/**
 * Review-Punkte 1, 3 und 11 zu `consolidate.ts` (T-M42-15, T-M42-16, T-M42-17). Eigene Datei statt
 * `decide.test.ts`, damit die Faelle von T-M42-08/-09 dort unveraendert bleiben.
 */

const map = smallWorld()
const ctx = { map, rules: TEST_RULES }
const CONFIG: GameConfig = {
  seed: 505,
  mapId: 'testworld',
  rulesId: 'default',
  players: [
    { name: 'Mensch', kind: 'human', nation: 'Nordland', color: '#0f62bc' },
    { name: 'KI', kind: 'ai', nation: 'Ostmark', color: '#b03a2e', difficulty: 'normal' },
  ],
  victory: { condition: 'points', pointsShareToWin: 900, dayLimit: null },
}
const cap = TEST_RULES.constants.stackFullContribution
const hp = (unitKey: string) => TEST_RULES.units[unitKey]!.hpPerUnit

let state: GameState
beforeEach(() => {
  state = createInitialState(CONFIG, ctx)
  // Nur die Armeen des Falls: die Startarmeen der KI gehen aus dem Zustand (nur im Test).
  for (const id of state.armyOrder.filter((armyId) => state.armies[armyId]!.owner === 'p2')) {
    delete state.armies[id]
  }
  state.armyOrder = state.armyOrder.filter((armyId) => state.armies[armyId] !== undefined)
})

const contextFor = () => ({
  view: publicView(state, 'p2'),
  memory: emptyMemory(600),
  rules: TEST_RULES,
  map,
  difficulty: TEST_RULES.ai.difficulties.normal,
})

const eigeneIn = (s: GameState, at: string) =>
  s.armyOrder.map((id) => s.armies[id]!).filter((army) => army.owner === 'p2' && army.locationProvinceId === at)
const einheiten = (army: GameState['armies'][string]) =>
  army.units.reduce((sum, stack) => sum + unitCount(stack, TEST_RULES), 0)
const hpSumme = (armies: GameState['armies'][string][]) =>
  armies.reduce((sum, army) => sum + army.units.reduce((s, stack) => s + stack.hpTotal, 0), 0)
/** Der Zustand direkt nach der Befehlsphase - spaetere Phasen (Erholung) aendern die Hitpoints. */
const nachBefehlen = (s: GameState, commands: readonly Command[]): GameState => {
  let danach: GameState | null = null
  step(s, commands, ctx, {
    onPhase: (name, draft) => {
      if (name === 'applyCommands') danach = structuredClone(draft)
    },
  })
  return danach!
}

describe('T-M42-17 Teilen ueber dem Deckel (Review Punkt 11, Befund M42-09-a)', () => {
  it('T1: 95 Einheiten in einer Garnison -> Teile <= 20, die Hitpoints bleiben erhalten', () => {
    // 95 Infanteristen, der letzte angeschlagen (300 HP fehlen): partielle HP muessen durchgehen.
    placeArmy(state, { owner: 'p2', at: 'o2', units: [{ unitKey: 'infantry', hpTotal: 95 * hp('infantry') - 300 }] })
    const vorher = hpSumme(eigeneIn(state, 'o2'))

    const commands = consolidateCommands(contextFor(), [])
    expect(commands.filter((command) => command.type === 'SPLIT_ARMY')).toHaveLength(4)

    const nachher = nachBefehlen(state, commands)
    const armeen = eigeneIn(nachher, 'o2')
    expect(armeen.map(einheiten).sort((a, b) => a - b)).toEqual([15, 20, 20, 20, 20])
    for (const army of armeen) expect(einheiten(army)).toBeLessThanOrEqual(cap)
    expect(hpSumme(armeen)).toBe(vorher)
  })

  it('T2: nach dem Teilen legt der Merge-Pass den Rest mit einem kleinen Verband zusammen', () => {
    const gross = placeArmy(state, { owner: 'p2', at: 'o2', units: [{ unitKey: 'infantry', hpTotal: 25 * hp('infantry') }] })
    const klein = placeArmy(state, { owner: 'p2', at: 'o2', units: [{ unitKey: 'infantry', hpTotal: 4 * hp('infantry') }] })

    const commands = consolidateCommands(contextFor(), [])
    expect(commands.map((command) => command.type)).toEqual(['SPLIT_ARMY', 'MERGE_ARMIES'])
    expect((commands[1] as Extract<Command, { type: 'MERGE_ARMIES' }>).armyIds).toEqual([gross.id, klein.id].sort())

    const armeen = eigeneIn(nachBefehlen(state, commands), 'o2')
    expect(armeen.map(einheiten).sort((a, b) => a - b)).toEqual([9, 20])
  })

  it('T3: ein gemischter Verband gibt zuerst vom groessten Stapel ab und laesst jedem Stapel einen Rest', () => {
    placeArmy(state, {
      owner: 'p2',
      at: 'o2',
      units: [
        { unitKey: 'infantry', hpTotal: 30 * hp('infantry') },
        { unitKey: 'artillery', hpTotal: 3 * hp('artillery') },
      ],
    })
    const vorher = hpSumme(eigeneIn(state, 'o2'))
    const armeen = eigeneIn(nachBefehlen(state, consolidateCommands(contextFor(), [])), 'o2')
    for (const army of armeen) expect(einheiten(army)).toBeLessThanOrEqual(cap)
    expect(hpSumme(armeen)).toBe(vorher)
  })

  it('T4: ein Verband unter dem Deckel wird nicht geteilt, ein marschierender auch nicht', () => {
    placeArmy(state, { owner: 'p2', at: 'o2', units: [{ unitKey: 'infantry', hpTotal: cap * hp('infantry') }] })
    const marsch = placeArmy(state, { owner: 'p2', at: 'o3', units: [{ unitKey: 'infantry', hpTotal: 40 * hp('infantry') }] })
    state.armies[marsch.id]!.path = ['o2']
    expect(consolidateCommands(contextFor(), []).filter((command) => command.type === 'SPLIT_ARMY')).toEqual([])
  })
})

describe('T-M42-17 zweite Fassung: an der Front wird nicht geteilt', () => {
  it('T5: ein Verband ueber dem Deckel in einer Grenzprovinz bleibt ganz, im Hinterland wird er geteilt', () => {
    placeArmy(state, { owner: 'p2', at: 'o2', units: [{ unitKey: 'infantry', hpTotal: 30 * hp('infantry') }] })
    const hinten = consolidateCommands(contextFor(), []).filter((command) => command.type === 'SPLIT_ARMY')
    expect(hinten, 'im Hinterland geteilt').toHaveLength(1)

    // Suedberg (s2, Nachbar von Sandmark o2) gehoert dem Menschen: o2 ist Grenzprovinz.
    state.provinces['s2']!.owner = 'p1'
    const vorn = consolidateCommands(contextFor(), []).filter((command) => command.type === 'SPLIT_ARMY')
    expect(vorn).toEqual([])
  })
})

describe('T-M42-16 Keine Armee unter Sperre im Merge-Pass (Review Punkt 3)', () => {
  it('S1: eine Armee mit cannotAttackUntil > tick bleibt aussen vor', () => {
    const frisch = placeArmy(state, { owner: 'p2', at: 'o2', units: [{ unitKey: 'infantry', hpTotal: 5 * hp('infantry') }] })
    const gesperrt = placeArmy(state, { owner: 'p2', at: 'o2', units: [{ unitKey: 'infantry', hpTotal: 5 * hp('infantry') }] })
    const dritte = placeArmy(state, { owner: 'p2', at: 'o2', units: [{ unitKey: 'infantry', hpTotal: 5 * hp('infantry') }] })
    state.armies[gesperrt.id]!.cannotAttackUntil = state.tick + 10

    const merges = consolidateCommands(contextFor(), []).filter((command) => command.type === 'MERGE_ARMIES')
    expect(merges.map((command) => (command as Extract<Command, { type: 'MERGE_ARMIES' }>).armyIds)).toEqual([
      [frisch.id, dritte.id].sort(),
    ])
  })

  it('S2: ist die Sperre abgelaufen, geht sie wieder mit', () => {
    placeArmy(state, { owner: 'p2', at: 'o2', units: [{ unitKey: 'infantry', hpTotal: 5 * hp('infantry') }] })
    const alt = placeArmy(state, { owner: 'p2', at: 'o2', units: [{ unitKey: 'infantry', hpTotal: 5 * hp('infantry') }] })
    state.armies[alt.id]!.cannotAttackUntil = state.tick
    expect(consolidateCommands(contextFor(), []).filter((command) => command.type === 'MERGE_ARMIES')).toHaveLength(1)
  })
})

describe('T-M42-15 Provinzen nach Codeeinheiten (Review Punkt 1, Determinismus)', () => {
  it('D1: "B..." vor "a..." wie sort() im Kern - localeCompare("en") stellte "a" vor "B"', () => {
    const context = contextFor()
    context.view.armies = ['a-prov', 'B-prov'].flatMap((provinceId) =>
      [1, 2].map((n) => ({
        id: `x${provinceId}${n}`,
        owner: 'p2',
        provinceId,
        units: [{ unitKey: 'infantry', hpTotal: 3 * hp('infantry') }],
        strength: 0,
      })),
    )
    const orte = consolidateCommands(context, []).map(
      (command) => context.view.armies.find((army) => army.id === (command as Extract<Command, { type: 'MERGE_ARMIES' }>).armyIds[0])!.provinceId,
    )
    expect(orte).toEqual(['B-prov', 'a-prov'])
    expect(['a-prov', 'B-prov'].sort((a, b) => a.localeCompare(b, 'en')), 'die Probe saehe den Unterschied nicht').toEqual([
      'a-prov',
      'B-prov',
    ])
  })
})
