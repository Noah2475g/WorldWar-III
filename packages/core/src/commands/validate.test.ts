import { hashValue } from '@worldwar/shared'
import { TEST_RULES, tinyMap } from '@worldwar/testkit'
import { beforeEach, describe, expect, it } from 'vitest'
import type { GameEvent } from '../events/types'
import type { PhaseContext } from '../phases/index'
import { createInitialState, type GameConfig } from '../state/create'
import { HASH_OMIT_KEYS, type GameState } from '../state/types'
import { step } from '../step'
import '../commands/handlers'
import { applyCommand, canApply } from './registry'
import type { Command } from './types'

const CONFIG: GameConfig = {
  seed: 42,
  mapId: 'tiny',
  rulesId: 'test',
  players: [
    { name: 'Noah', kind: 'human', nation: 'Nordland', color: '#0f62bc' },
    { name: 'Gegner', kind: 'ai', nation: 'Sued', color: '#b03a2e', difficulty: 'normal' },
  ],
  victory: { condition: 'points', pointsShareToWin: 600, dayLimit: null },
}

const map = tinyMap()
let state: GameState
let ctx: PhaseContext
let events: GameEvent[]

beforeEach(() => {
  state = createInitialState(CONFIG, { map, rules: TEST_RULES })
  // One army each, so ownership rules have something to bite on.
  state.armies['a1'] = {
    id: 'a1',
    owner: 'p1',
    name: '1. Armee',
    locationProvinceId: 'alpha',
    units: [{ unitKey: 'infantry', hpTotal: 20_000 }],
    path: [],
    arrivalTick: null,
    departureTick: null,
    deployDelayUntil: 0,
    stance: 'aggressive',
    embarked: false,
    cannotAttackUntil: 0,
    bombardTarget: null,
    holdFire: false,
  }
  state.armyOrder = ['a1']
  events = []
  ctx = { map, rules: TEST_RULES, commands: [], events }
})

const hashOf = (s: GameState) => hashValue(s, { omitKeys: HASH_OMIT_KEYS })

describe('R-ARCH-02 Allgemeine Kommandopruefung', () => {
  it('weist unbekannte Spieler zurueck', () => {
    const command: Command = { type: 'SET_STANCE', playerId: 'p99', armyId: 'a1', stance: 'defensive' }
    expect(canApply(state, command, ctx)).toEqual({ ok: false, code: 'UNKNOWN_PLAYER', detail: { playerId: 'p99' } })
  })

  it('weist ausgeschiedene Spieler zurueck', () => {
    state.players['p1']!.alive = false
    const command: Command = { type: 'SET_STANCE', playerId: 'p1', armyId: 'a1', stance: 'defensive' }
    expect(canApply(state, command, ctx)).toMatchObject({ ok: false, code: 'PLAYER_ELIMINATED' })
  })

  it('weist Kommandos ohne zustaendigen Baustein zurueck', () => {
    // Every command type has a handler by now, so this uses an invented one: an
    // unknown command must be rejected, never silently ignored.
    const command = { type: 'SUMMON_DRAGON', playerId: 'p1' } as unknown as Command
    expect(canApply(state, command, ctx)).toMatchObject({ ok: false, code: 'UNKNOWN_COMMAND' })
  })

  it('laesst den Zustand bei jeder Ablehnung unveraendert', () => {
    const before = hashOf(state)
    const rejected: Command[] = [
      { type: 'SET_STANCE', playerId: 'p99', armyId: 'a1', stance: 'defensive' },
      { type: 'SET_STANCE', playerId: 'p2', armyId: 'a1', stance: 'defensive' },
      { type: 'SET_STANCE', playerId: 'p1', armyId: 'unbekannt', stance: 'defensive' },
      { type: 'SET_CAPITAL', playerId: 'p1', provinceId: 'nirgendwo' },
      { type: 'SUMMON_DRAGON', playerId: 'p1' } as unknown as Command,
    ]
    for (const command of rejected) {
      expect(applyCommand(state, command, ctx).ok).toBe(false)
    }
    expect(hashOf(state)).toBe(before)
  })

  it('prueft mit derselben Logik, mit der es anwendet', () => {
    // canApply is what the interface uses to grey out an action; if the two could
    // disagree, the interface would offer moves the core refuses.
    const command: Command = { type: 'SET_STANCE', playerId: 'p2', armyId: 'a1', stance: 'defensive' }
    const checked = canApply(state, command, ctx)
    const applied = applyCommand(state, command, ctx)
    expect(applied).toEqual(checked)
  })
})

describe('R-ARCH-02 Haltung einer Armee setzen', () => {
  it('weist fremde Armeen zurueck', () => {
    const command: Command = { type: 'SET_STANCE', playerId: 'p2', armyId: 'a1', stance: 'defensive' }
    expect(canApply(state, command, ctx)).toMatchObject({ ok: false, code: 'NOT_OWNER' })
  })

  it('weist unbekannte Armeen zurueck', () => {
    const command: Command = { type: 'SET_STANCE', playerId: 'p1', armyId: 'weg', stance: 'defensive' }
    expect(canApply(state, command, ctx)).toMatchObject({ ok: false, code: 'ARMY_NOT_FOUND' })
  })

  it('setzt die Haltung der eigenen Armee', () => {
    const command: Command = { type: 'SET_STANCE', playerId: 'p1', armyId: 'a1', stance: 'defensive' }
    expect(applyCommand(state, command, ctx).ok).toBe(true)
    expect(state.armies['a1']!.stance).toBe('defensive')
  })
})

describe('R-PROV-05 Hauptstadt verlegen', () => {
  it('verlegt in eine eigene Stadt und meldet genau ein Ereignis', () => {
    state.provinces['beta']!.kind = 'city'
    const command: Command = { type: 'SET_CAPITAL', playerId: 'p1', provinceId: 'beta' }

    expect(applyCommand(state, command, ctx).ok).toBe(true)
    expect(state.players['p1']!.capitalProvinceId).toBe('beta')
    expect(events).toHaveLength(1)
    expect(events[0]!.type).toBe('CAPITAL_MOVED')
  })

  it('verlangt eine Stadtprovinz', () => {
    const command: Command = { type: 'SET_CAPITAL', playerId: 'p1', provinceId: 'beta' } // rural
    expect(canApply(state, command, ctx)).toMatchObject({ ok: false, code: 'INVALID_TARGET' })
  })

  it('verlangt eine eigene Provinz', () => {
    state.provinces['gamma']!.kind = 'city'
    const command: Command = { type: 'SET_CAPITAL', playerId: 'p1', provinceId: 'gamma' }
    expect(canApply(state, command, ctx)).toMatchObject({ ok: false, code: 'NOT_OWNER' })
  })

  it('haelt die Sperrfrist von 30 Spieltagen ein', () => {
    state.provinces['beta']!.kind = 'city'
    expect(applyCommand(state, { type: 'SET_CAPITAL', playerId: 'p1', provinceId: 'beta' }, ctx).ok).toBe(true)

    const again: Command = { type: 'SET_CAPITAL', playerId: 'p1', provinceId: 'alpha' }
    expect(canApply(state, again, ctx)).toMatchObject({ ok: false, code: 'ON_COOLDOWN' })

    state.tick = 30 * TEST_RULES.constants.ticksPerDay
    expect(canApply(state, again, ctx).ok).toBe(true)
  })

  it('beendet die Strafe fuer den Verlust der alten Hauptstadt', () => {
    state.provinces['beta']!.kind = 'city'
    state.players['p1']!.capitalLostUntil = 500
    applyCommand(state, { type: 'SET_CAPITAL', playerId: 'p1', provinceId: 'beta' }, ctx)
    expect(state.players['p1']!.capitalLostUntil).toBeNull()
  })
})

describe('R-ARCH-02 Kommandophase im Tick', () => {
  it('meldet jede Ablehnung an den betroffenen Spieler', () => {
    const bad: Command = { type: 'SET_STANCE', playerId: 'p1', armyId: 'weg', stance: 'defensive' }
    const result = step(state, [bad], { map, rules: TEST_RULES })

    const rejected = result.events.filter((event) => event.type === 'COMMAND_REJECTED')
    expect(rejected).toHaveLength(1)
    expect(rejected[0]).toMatchObject({ code: 'ARMY_NOT_FOUND', audience: ['p1'] })
  })

  it('wendet Kommandos in Spielerreihenfolge an, nicht in Eingangsreihenfolge', () => {
    // Order matters wherever commands compete for the same scarce thing — the market
    // price being the obvious case (D6.8). Fixing it to player order keeps a tick
    // reproducible no matter how the commands arrived.
    const commands: Command[] = [
      { type: 'SET_STANCE', playerId: 'p2', armyId: 'fehlt', stance: 'defensive' },
      { type: 'SET_STANCE', playerId: 'p1', armyId: 'fehlt', stance: 'defensive' },
    ]
    const result = step(state, commands, { map, rules: TEST_RULES })
    const rejected = result.events.filter((event) => event.type === 'COMMAND_REJECTED')
    expect(rejected.map((event) => (event as { playerId: string }).playerId)).toEqual(['p1', 'p2'])
  })

  it('fuehrt gueltige Kommandos aus und schreibt sie ins Protokoll', () => {
    const command: Command = { type: 'SET_STANCE', playerId: 'p1', armyId: 'a1', stance: 'defensive' }
    const result = step(state, [command], { map, rules: TEST_RULES })
    expect(result.state.armies['a1']!.stance).toBe('defensive')
    expect(state.armies['a1']!.stance).toBe('aggressive') // original untouched
  })
})

/**
 * Starke Einheiten verlangen eine hoehere Gebaeudestufe (T-M34-05, D34.2).
 *
 * Das Feld `requiresBuildingLevel` gibt es seit M12 und `recruit.ts` wertet es aus — es
 * wird hier nur **benutzt**: Raketenartillerie Fabrik 3 statt 2, Zerstoerer Werft 2 statt
 * 1, Bomber bleibt Flugplatz 2. Mehr nicht: eine Bedingung, die niemand erfuellen kann,
 * ist keine Fortschrittsachse, sondern eine Sperre — und die Hoechststufen sind niedrig
 * (Fabrik 3, Werft 2).
 */
describe('R-UNIT-02 Die Stufe des Gebaeudes ist die zweite Bedingung', () => {
  /** Eine Provinz, in der nur noch die Gebaeudestufe ablehnen kann. */
  const bereit = (unitKey: string, level: number): GameState => {
    const unit = TEST_RULES.units[unitKey]!
    const province = state.provinces['alpha']!
    province.owner = 'p1'
    province.morale = 90_000
    province.buildings[unit.requiresBuilding] = level
    if (unit.requiresBuilding === 'shipyard') province.buildings.harbour = 1
    state.tick = (unit.availableFromDay - 1) * TEST_RULES.constants.ticksPerDay
    for (const key of Object.keys(state.players['p1']!.resources)) {
      state.players['p1']!.resources[key as 'money'] = 99_000_000
    }
    return state
  }

  it('verlangt von der Raketenartillerie die dritte Fabrikstufe', () => {
    expect(TEST_RULES.units.rocket_artillery!.requiresBuildingLevel).toBe(3)
    expect(TEST_RULES.buildings.factory.maxLevel, 'eine Stufe, die es nicht gibt, ist eine Sperre').toBeGreaterThanOrEqual(3)
  })

  it('verlangt vom Zerstoerer die zweite Werftstufe, und der Bomber bleibt bei zwei', () => {
    expect(TEST_RULES.units.destroyer!.requiresBuildingLevel).toBe(2)
    expect(TEST_RULES.buildings.shipyard.maxLevel).toBeGreaterThanOrEqual(2)
    expect(TEST_RULES.units.bomber!.requiresBuildingLevel, 'der Bomber war nicht Teil dieser Aufgabe').toBe(2)
  })

  it('lehnt mit der Stufe darunter ab und nennt Gebaeude UND Stufe', () => {
    for (const [unitKey, verlangt] of [['rocket_artillery', 3], ['destroyer', 2]] as const) {
      const rejected = canApply(
        bereit(unitKey, verlangt - 1),
        { type: 'RECRUIT', playerId: 'p1', provinceId: 'alpha', unitKey, count: 1 } as Command,
        ctx,
      )

      expect(rejected, unitKey).toMatchObject({ ok: false, code: 'MISSING_BUILDING' })
      expect(rejected.ok ? undefined : rejected.detail, unitKey).toMatchObject({
        required: TEST_RULES.units[unitKey]!.requiresBuilding,
        level: verlangt,
      })
    }
  })

  it('nimmt denselben Auftrag mit der verlangten Stufe an', () => {
    // Die Gegenprobe: ohne sie belegte der Test oben nur, dass irgendetwas ablehnt.
    for (const [unitKey, verlangt] of [['rocket_artillery', 3], ['destroyer', 2]] as const) {
      const result = canApply(
        bereit(unitKey, verlangt),
        { type: 'RECRUIT', playerId: 'p1', provinceId: 'alpha', unitKey, count: 1 } as Command,
        ctx,
      )

      expect(result.ok, `${unitKey}: ${JSON.stringify(result)}`).toBe(true)
    }
  })
})
