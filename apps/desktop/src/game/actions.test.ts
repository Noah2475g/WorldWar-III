import { readFileSync } from 'node:fs'
import { createInitialState, parseRules, type Army, type GameState, type MapData } from '@worldwar/core'
import { describe, expect, it } from 'vitest'
import {
  armyActions,
  buildActions,
  capitalAction,
  diplomacyActions,
  ownArmiesIn,
  planArrival,
  recruitActions,
  targetAction,
  tradePreview,
  unitLines,
  type ActionContext,
} from './actions.ts'
import { describeRejection } from './rejections.ts'
import { DEFAULT_NEW_GAME, toConfig } from './newGame.ts'

/**
 * Every order as a button (T-M10-05, T-M10-06, R-UI-05).
 *
 * The first smoke test found a province panel with one button — "build a barracks" —
 * and an army panel with none. Recruiting, marching, diplomacy and the market were
 * finished in the core and unreachable from the screen. These tests hold the panel to
 * the rule the panels state for themselves: every order listed, the impossible ones
 * greyed out with a reason in words, the possible ones with their price.
 */

const ROOT = process.cwd()
const load = (path: string) => JSON.parse(readFileSync(`${ROOT}/${path}`, 'utf8')) as never
const map = load('data/maps/world.json') as MapData
const rules = parseRules(
  {
    constants: load('data/rules/default/constants.json'),
    resources: load('data/rules/default/resources.json'),
    buildings: load('data/rules/default/buildings.json'),
    units: load('data/rules/default/units.json'),
    ai: load('data/rules/default/ai.json'),
  },
  'default',
)

function fresh(): { ctx: ActionContext; capital: string; neighbour: string } {
  const state = createInitialState(toConfig({ ...DEFAULT_NEW_GAME, nation: 'Deutschland', opponents: 3 }, map), {
    map,
    rules,
  })
  const capital = state.players.p1!.capitalProvinceId!
  const edge = map.edgesByProvince[capital]!.map((i) => map.edges[i]!).find((e) => e.kind === 'land')!
  const neighbour = edge.a === capital ? edge.b : edge.a
  return { ctx: { state, map, rules, playerId: 'p1', ticksPerDay: rules.constants.ticksPerDay }, capital, neighbour }
}

const RAW_KEY = /\b(barracks|harbour|infantry|wood|iron|p\d)\b|\{\{/

function withArmy(state: GameState, where: string, hp = 3000): Army {
  const army: Army = {
    id: 'a1',
    owner: 'p1',
    name: 'Armee 1',
    locationProvinceId: where,
    units: [{ unitKey: 'infantry', hpTotal: hp }],
    path: [],
    arrivalTick: null,
    departureTick: null,
    deployDelayUntil: 0,
    stance: 'defensive',
    embarked: false,
    cannotAttackUntil: 0,
  }
  state.armies[army.id] = army
  state.armyOrder = [...state.armyOrder, army.id]
  return army
}

describe('R-PROV-01 Bauen: jedes Gebaeude ist ein Knopf mit Preis', () => {
  it('listet jedes Gebaeude der Regeln, die Kaserne bezahlbar mit Kosten und Dauer', () => {
    const { ctx, capital } = fresh()
    const actions = buildActions(ctx, capital)

    expect(actions.map((a) => a.id)).toEqual(Object.keys(rules.buildings).map((key) => `build-${key}`))
    const barracks = actions.find((a) => a.id === 'build-barracks')!
    expect(barracks.disabledReason).toBeNull()
    expect(barracks.hint).toContain('Material')
    expect(barracks.hint).toContain('1 Tag')
  })

  it('nennt bei jedem ausgegrauten Knopf den Grund in Worten', () => {
    const { ctx, capital } = fresh()
    for (const action of buildActions(ctx, capital)) {
      if (action.disabledReason === null) continue
      expect(action.disabledReason.length).toBeGreaterThan(10)
      expect(action.disabledReason).not.toMatch(RAW_KEY)
    }
  })

  it('sagt, was fehlt, wenn die Kasse leer ist', () => {
    const { ctx, capital } = fresh()
    ctx.state.players.p1!.resources.wood = 0

    const barracks = buildActions(ctx, capital).find((a) => a.id === 'build-barracks')!
    expect(barracks.disabledReason).toBe('Es fehlt an Rohstoffen: 333 Material.')
  })
})

describe('R-UNIT-02 Ausheben braucht das Gebaeude und nennt die Anfangsstaerke', () => {
  it('graut ohne Kaserne jede Einheit aus, mit dem Namen des fehlenden Gebaeudes', () => {
    const { ctx, capital } = fresh()
    const infantry = recruitActions(ctx, capital).find((a) => a.id === 'recruit-infantry')!

    expect(infantry.disabledReason).toContain('Kaserne')
    expect(infantry.disabledReason).not.toMatch(RAW_KEY)
  })

  it('bietet Infanterie an, sobald die Kaserne steht — mit Dauer und Anfangsstaerke', () => {
    const { ctx, capital } = fresh()
    ctx.state.provinces[capital]!.buildings.barracks = 1

    const infantry = recruitActions(ctx, capital).find((a) => a.id === 'recruit-infantry')!
    expect(infantry.disabledReason).toBeNull()
    expect(infantry.hint).toMatch(/\d+ h|Tag/)
    // Start morale is 70: a province that raises soldiers at seventy per cent says so.
    expect(infantry.hint).toContain('Anfangsstärke 70 %')
  })
})

describe('R-UNIT-03/04 Armeebefehle', () => {
  it('bietet Marsch, Haltung und Teilen an und begruendet den Rest', () => {
    const { ctx, capital } = fresh()
    withArmy(ctx.state, capital)

    const byId = Object.fromEntries(armyActions(ctx, 'a1').map((a) => [a.id, a]))
    expect(byId.march!.disabledReason).toBeNull()
    expect(byId.march!.targetKind).toBe('move')
    expect(byId.stop!.disabledReason).toContain('steht bereits')
    expect(byId['stance-defensive']!.disabledReason).toContain('schon')
    expect(byId['stance-aggressive']!.disabledReason).toBeNull()
    expect(byId.merge!.disabledReason).toContain('Keine zweite')
    expect(byId.split!.disabledReason).toBeNull()
    expect(byId.bombard!.disabledReason).toContain('Reichweite')
  })

  it('legt zwei Armeen am selben Ort zusammen und teilt keine zu kleine', () => {
    const { ctx, capital } = fresh()
    withArmy(ctx.state, capital)
    const second: Army = { ...withArmy(ctx.state, capital, 1), id: 'a2', name: 'Armee 2' }
    ctx.state.armies.a2 = second
    ctx.state.armyOrder = ['a1', 'a2']

    const byId = Object.fromEntries(armyActions(ctx, 'a1').map((a) => [a.id, a]))
    expect(byId.merge!.disabledReason).toBeNull()
    expect(byId.merge!.command).toMatchObject({ type: 'MERGE_ARMIES', armyIds: ['a1', 'a2'] })

    const tiny = Object.fromEntries(armyActions(ctx, 'a2').map((a) => [a.id, a]))
    expect(tiny.split!.disabledReason).toContain('Zu klein')
  })

  it('sagt vor dem Marschbefehl, wann die Armee ankommt', () => {
    const { ctx, capital, neighbour } = fresh()
    withArmy(ctx.state, capital)

    const plan = planArrival(ctx, 'a1', neighbour)
    expect(plan).not.toBeNull()
    expect(plan!.arrivalTick).toBeGreaterThan(ctx.state.tick)
    expect(plan!.text).toMatch(/^Ankunft/)

    const confirm = targetAction(ctx, 'a1', 'move', neighbour)
    expect(confirm.disabledReason).toBeNull()
    expect(confirm.command).toMatchObject({ type: 'MOVE_ARMY', targetProvinceId: neighbour })
  })

  it('lehnt den Marsch an den eigenen Standort mit dem Grund ab', () => {
    const { ctx, capital } = fresh()
    withArmy(ctx.state, capital)

    const confirm = targetAction(ctx, 'a1', 'move', capital)
    expect(confirm.disabledReason).toContain('bereits dort')
  })

  it('zaehlt die Einheiten einer Armee in Worten und findet die Armeen einer Provinz', () => {
    const { ctx, capital } = fresh()
    const army = withArmy(ctx.state, capital, 3000)

    expect(unitLines(army, rules)).toEqual(['3 × Infanterie'])
    expect(ownArmiesIn(ctx, capital)).toEqual([{ id: 'a1', name: 'Armee 1', strength: 3000 }])
  })
})

describe('R-DIP-01 Diplomatie und R-ECON-05 Markt', () => {
  it('bietet die Kriegserklaerung an und begruendet, was nicht geht', () => {
    const { ctx } = fresh()
    const byId = Object.fromEntries(diplomacyActions(ctx, 'p2').map((a) => [a.id, a]))

    expect(byId['diplomacy-declareWar']!.disabledReason).toBeNull()
    expect(byId['diplomacy-offerPeace']!.disabledReason).toContain('nur im Krieg')
    expect(byId['diplomacy-acceptPeace']!.disabledReason).toContain('kein Angebot')
    for (const action of Object.values(byId)) {
      if (action.disabledReason) expect(action.disabledReason).not.toMatch(RAW_KEY)
    }
  })

  it('nennt vor dem Tausch den Gegenwert und lehnt Gleiches gegen Gleiches ab', () => {
    const { ctx } = fresh()

    const trade = tradePreview(ctx, 'wood', 100_000, 'iron')
    expect(trade.wantAmount).toBeGreaterThan(0)
    expect(trade.text).toMatch(/^Ergibt etwa \d+ Eisen\.$/)
    expect(trade.action.disabledReason).toBeNull()

    const same = tradePreview(ctx, 'wood', 100_000, 'wood')
    expect(same.text).toBe('Dafür gibt es nichts.')
    expect(same.action.disabledReason).toContain('gleiche Ressource')
  })

  it('macht aus der Hauptstadt keinen Knopf fuer die Hauptstadt', () => {
    const { ctx, capital } = fresh()
    expect(capitalAction(ctx, capital).disabledReason).not.toBeNull()
  })
})

describe('R-UI-07 Ablehnungen in Worten', () => {
  it('rechnet eine Sperre in Tage um und nennt den Waffenstillstand beim Namen', () => {
    const { ctx } = fresh()
    ctx.state.tick = 10

    expect(describeRejection({ code: 'ON_COOLDOWN', detail: { readyAtTick: 58 } }, null, ctx)).toBe(
      'Das geht erst wieder in 2 Tagen.',
    )
    expect(describeRejection({ code: 'ON_COOLDOWN', detail: { reason: 'Waffenstillstand' } }, null, ctx)).toContain(
      'Waffenstillstand',
    )
  })

  it('uebersetzt das fehlende Gebaeude', () => {
    const { ctx } = fresh()
    expect(describeRejection({ code: 'MISSING_BUILDING', detail: { required: 'harbour' } }, null, ctx)).toBe(
      'Dafür fehlt das Gebäude: Hafen.',
    )
  })
})
