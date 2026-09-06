import {
  createInitialState,
  runTicks,
  type Army,
  type Command,
  type GameConfig,
  type GameEvent,
  type GameState,
  type MapData,
  type Province,
  type Rules,
} from '@worldwar/core'
import { parse as parseYaml } from 'yaml'

/**
 * Scenario runner (T-M2-04, design D14).
 *
 * A scenario says: given this situation, run N hours, expect this outcome. Written as
 * data rather than test code, so a rule can be pinned down by someone reading the
 * rules — not by someone reading TypeScript. It is also the format the balancing work
 * in M12 leans on.
 */

export interface ScenarioExpectation {
  path: string
  op: '==' | '!=' | '>=' | '<=' | '>' | '<' | 'includes' | 'excludes'
  value: unknown
}

export interface Scenario {
  name: string
  seed?: number
  players?: { name: string; kind: 'human' | 'ai'; nation: string }[]
  /** Province overrides applied after the initial state is built. */
  provinces?: Record<string, Partial<Province>>
  /** Armies placed before the run. */
  armies?: (Partial<Army> & { id: string; owner: string; at: string })[]
  /** Commands issued at a given tick. */
  commands?: { at: number; command: Command }[]
  /** How many game hours to run. */
  run: number
  expect: ScenarioExpectation[]
}

export interface ScenarioContext {
  map: MapData
  rules: Rules
}

export interface ScenarioResult {
  state: GameState
  events: GameEvent[]
  failures: string[]
}

const KNOWN_KEYS = new Set([
  'name',
  'seed',
  'players',
  'provinces',
  'armies',
  'commands',
  'run',
  'expect',
])

export function parseScenario(text: string): Scenario {
  const raw = parseYaml(text) as Record<string, unknown>
  if (!raw || typeof raw !== 'object') throw new Error('Szenario ist kein Objekt.')

  for (const key of Object.keys(raw)) {
    // Unknown keys are almost always typos, and a silently ignored expectation is
    // worse than no test at all.
    if (!KNOWN_KEYS.has(key)) throw new Error(`Unbekanntes Feld im Szenario: "${key}"`)
  }
  if (typeof raw['name'] !== 'string') throw new Error('Szenario braucht einen Namen.')
  if (!Number.isSafeInteger(raw['run'])) throw new Error('Szenario braucht "run" als ganze Zahl.')
  if (!Array.isArray(raw['expect'])) throw new Error('Szenario braucht "expect" als Liste.')

  return raw as unknown as Scenario
}

/** Reads a dotted path out of the state; `events` is a synthetic root. */
export function readPath(state: GameState, events: readonly GameEvent[], path: string): unknown {
  if (path === 'events') return events.map((event) => event.type)

  let current: unknown = state
  for (const part of path.split('.')) {
    if (current === null || current === undefined) return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

function compare(actual: unknown, op: ScenarioExpectation['op'], expected: unknown): boolean {
  switch (op) {
    case '==':
      return JSON.stringify(actual) === JSON.stringify(expected)
    case '!=':
      return JSON.stringify(actual) !== JSON.stringify(expected)
    case '>=':
      return typeof actual === 'number' && actual >= (expected as number)
    case '<=':
      return typeof actual === 'number' && actual <= (expected as number)
    case '>':
      return typeof actual === 'number' && actual > (expected as number)
    case '<':
      return typeof actual === 'number' && actual < (expected as number)
    case 'includes':
      return Array.isArray(actual) && actual.includes(expected)
    case 'excludes':
      return Array.isArray(actual) && !actual.includes(expected)
  }
}

export function runScenario(scenario: Scenario, ctx: ScenarioContext): ScenarioResult {
  const config: GameConfig = {
    seed: scenario.seed ?? 1,
    mapId: ctx.map.id,
    rulesId: ctx.rules.id,
    players: (scenario.players ?? []).map((player, index) => ({
      name: player.name,
      kind: player.kind,
      nation: player.nation,
      color: index === 0 ? '#0f62bc' : '#b03a2e',
    })),
    victory: { condition: 'points', pointsShareToWin: 600, dayLimit: null },
  }

  if (config.players.length === 0) {
    config.players = ctx.map.startPositions.slice(0, 2).map((position, index) => ({
      name: position.nation,
      kind: index === 0 ? ('human' as const) : ('ai' as const),
      nation: position.nation,
      color: index === 0 ? '#0f62bc' : '#b03a2e',
    }))
  }

  let state = createInitialState(config, ctx)

  for (const [id, overrides] of Object.entries(scenario.provinces ?? {})) {
    const province = state.provinces[id]
    if (!province) throw new Error(`Szenario "${scenario.name}": unbekannte Provinz "${id}".`)
    Object.assign(province, overrides)
  }

  for (const entry of scenario.armies ?? []) {
    state.armies[entry.id] = {
      id: entry.id,
      owner: entry.owner,
      name: entry.name ?? entry.id,
      locationProvinceId: entry.at,
      units: entry.units ?? [],
      path: entry.path ?? [],
      arrivalTick: entry.arrivalTick ?? null,
      departureTick: entry.departureTick ?? null,
      deployDelayUntil: entry.deployDelayUntil ?? 0,
      stance: entry.stance ?? 'aggressive',
      embarked: entry.embarked ?? false,
      cannotAttackUntil: entry.cannotAttackUntil ?? 0,
    bombardTarget: null,
    holdFire: false,
    }
    state.armyOrder = [...state.armyOrder, entry.id].sort()
  }

  const byTick = new Map<number, Command[]>()
  for (const entry of scenario.commands ?? []) {
    byTick.set(entry.at, [...(byTick.get(entry.at) ?? []), entry.command])
  }

  const result = runTicks(state, scenario.run, ctx, (tick) => byTick.get(tick) ?? [])
  state = result.state

  const failures: string[] = []
  for (const expectation of scenario.expect) {
    const actual = readPath(state, result.events, expectation.path)
    if (!compare(actual, expectation.op, expectation.value)) {
      failures.push(
        `${expectation.path} ${expectation.op} ${JSON.stringify(expectation.value)} — tatsächlich: ${JSON.stringify(actual)}`,
      )
    }
  }

  return { state, events: result.events, failures }
}
