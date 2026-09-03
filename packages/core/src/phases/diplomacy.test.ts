import { TEST_RULES, placeArmy, smallWorld } from '@worldwar/testkit'
import { beforeEach, describe, expect, it } from 'vitest'
import { runTicks } from '../clock'
import type { Command } from '../commands/types'
import { createInitialState, type GameConfig } from '../state/create'
import type { GameState } from '../state/types'
import { step } from '../step'
import { intelAge } from '../view/intel'
import { publicView, visibleProvinces } from '../view/publicView'

const map = smallWorld()
const ctx = { map, rules: TEST_RULES }

const CONFIG: GameConfig = {
  seed: 202,
  mapId: 'testworld',
  rulesId: 'default',
  players: [
    { name: 'A', kind: 'human', nation: 'Nordland', color: '#0f62bc' },
    { name: 'B', kind: 'ai', nation: 'Ostmark', color: '#b03a2e', difficulty: 'normal' },
    { name: 'C', kind: 'ai', nation: 'Sueden', color: '#2e7d32', difficulty: 'normal' },
  ],
  victory: { condition: 'points', pointsShareToWin: 900, dayLimit: null },
}

let state: GameState

const diplo = (playerId: string, targetPlayerId: string, action: string): Command =>
  ({ type: 'DIPLOMACY', playerId, targetPlayerId, action }) as Command

beforeEach(() => {
  state = createInitialState(CONFIG, ctx)
})

describe('R-DIP-02 Kriegserklaerung', () => {
  it('wird erst nach der Vorlaufzeit wirksam', () => {
    const declared = step(state, [diplo('p1', 'p2', 'declareWar')], ctx).state
    expect(declared.diplomacy.relations['p1|p2']!.state).toBe('peace')
    expect(declared.diplomacy.relations['p1|p2']!.warEffectiveAtTick).toBe(
      TEST_RULES.constants.warDeclarationDelayTicks,
    )

    const later = runTicks(declared, TEST_RULES.constants.warDeclarationDelayTicks, ctx).state
    expect(later.diplomacy.relations['p1|p2']!.state).toBe('war')
  })

  it('meldet die Erklaerung an beide Seiten', () => {
    const result = step(state, [diplo('p1', 'p2', 'declareWar')], ctx)
    const event = result.events.find((e) => e.type === 'WAR_DECLARED')
    expect([...(event?.audience ?? [])].sort()).toEqual(['p1', 'p2'])
  })

  it('kostet Ansehen, wenn ohne Erklaerung angegriffen wird', () => {
    // Marching into someone's land uninvited is possible — it just costs standing.
    placeArmy(state, { owner: 'p1', at: 'o1', units: [{ unitKey: 'infantry', hpTotal: 5_000 }] })
    const before = state.players['p1']!.reputation

    const result = step(state, [], ctx)
    expect(result.state.diplomacy.relations['p1|p2']!.state).toBe('war')
    expect(result.state.players['p1']!.reputation).toBeLessThan(before)
    expect(result.events.find((e) => e.type === 'WAR_DECLARED')).toMatchObject({ withoutDeclaration: true })
  })

  it('laesst Durchmarschrecht ohne Kriegsgrund zu', () => {
    const granted = step(state, [diplo('p2', 'p1', 'grantRightOfWay')], ctx).state
    placeArmy(granted, { owner: 'p1', at: 'o3', units: [{ unitKey: 'infantry', hpTotal: 5_000 }] })

    const after = step(granted, [], ctx).state
    expect(after.diplomacy.relations['p1|p2']!.state).toBe('peace')
  })
})

describe('R-DIP-01 Frieden und Buendnisse', () => {
  it('braucht ein Angebot und eine Annahme', () => {
    state.diplomacy.relations['p1|p2']!.state = 'war'

    const offered = step(state, [diplo('p1', 'p2', 'offerPeace')], ctx).state
    expect(offered.diplomacy.offers).toHaveLength(1)
    expect(offered.diplomacy.relations['p1|p2']!.state).toBe('war')

    const accepted = step(offered, [diplo('p2', 'p1', 'acceptPeace')], ctx).state
    expect(accepted.diplomacy.relations['p1|p2']!.state).toBe('truce')
  })

  it('laesst den Waffenstillstand auslaufen', () => {
    state.diplomacy.relations['p1|p2']!.state = 'truce'
    state.diplomacy.relations['p1|p2']!.sinceTick = 0

    const after = runTicks(state, TEST_RULES.constants.truceDurationDays * 24 + 1, ctx).state
    expect(after.diplomacy.relations['p1|p2']!.state).toBe('peace')
  })

  it('verhindert eine Kriegserklaerung waehrend des Waffenstillstands', () => {
    state.diplomacy.relations['p1|p2']!.state = 'truce'
    const result = step(state, [diplo('p1', 'p2', 'declareWar')], ctx)
    expect(result.events.find((e) => e.type === 'COMMAND_REJECTED')).toMatchObject({ code: 'ON_COOLDOWN' })
  })

  it('teilt im Buendnis die Karte', () => {
    const offered = step(state, [diplo('p1', 'p2', 'offerAlliance')], ctx).state
    const allied = step(offered, [diplo('p2', 'p1', 'acceptAlliance')], ctx).state

    expect(allied.diplomacy.relations['p1|p2']!.state).toBe('alliance')
    expect(allied.diplomacy.relations['p1|p2']!.sharedMap).toBe(true)
  })

  it('kostet Ansehen, ein Buendnis zu brechen', () => {
    const offered = step(state, [diplo('p1', 'p2', 'offerAlliance')], ctx).state
    const allied = step(offered, [diplo('p2', 'p1', 'acceptAlliance')], ctx).state
    const before = allied.players['p1']!.reputation

    const broken = step(allied, [diplo('p1', 'p2', 'breakAlliance')], ctx).state
    expect(broken.diplomacy.relations['p1|p2']!.state).toBe('peace')
    expect(broken.players['p1']!.reputation).toBeLessThan(before)
  })

  it('laesst Angebote verfallen', () => {
    const offered = step(state, [diplo('p1', 'p2', 'offerAlliance')], ctx).state
    const later = runTicks(offered, 4 * 24, ctx).state
    expect(later.diplomacy.offers).toHaveLength(0)
  })
})

describe('R-DIP-04 Nebel des Krieges', () => {
  it('zeigt eigene Provinzen mit allen Angaben', () => {
    const view = publicView(state, 'p1')
    const own = view.provinces.find((p) => p.id === 'n1')!
    expect(own.morale).toBeDefined()
    expect(own.deposits).toBeDefined()
    expect(own.stale).toBe(false)
  })

  it('zeigt benachbarte Provinzen ohne Innenleben', () => {
    const view = publicView(state, 'p1')
    const neighbour = view.provinces.find((p) => p.id === 'm1')!
    expect(neighbour.owner).toBeDefined()
    expect(neighbour.morale).toBeUndefined()
    expect(neighbour.deposits).toBeUndefined()
  })

  it('nennt fremde Armeen nur mit Staerke, nicht mit Zusammensetzung', () => {
    placeArmy(state, { owner: 'p2', at: 'm1', units: [{ unitKey: 'tank', hpTotal: 26_000 }] })
    const view = publicView(state, 'p1')
    const foreign = view.armies.find((a) => a.owner === 'p2')!
    expect(foreign.strength).toBe(26_000)
    expect(foreign.units).toBeUndefined()
    expect(foreign.stance).toBeUndefined()
  })

  it('zeigt eigene Armeen vollstaendig', () => {
    placeArmy(state, { owner: 'p1', at: 'n1', units: [{ unitKey: 'infantry', hpTotal: 5_000 }] })
    const view = publicView(state, 'p1')
    const own = view.armies.find((a) => a.owner === 'p1')!
    expect(own.units).toHaveLength(1)
    expect(own.stance).toBeDefined()
  })

  it('erweitert die Sicht im Buendnis', () => {
    const before = visibleProvinces(state, 'p1').size
    state.diplomacy.relations['p1|p2']!.sharedMap = true
    expect(visibleProvinces(state, 'p1').size).toBeGreaterThan(before)
  })

  it('enthaelt niemals den vollen Spielzustand', () => {
    // The structural guarantee: there is no route from the interface to hidden data,
    // because the hidden data never leaves the simulation.
    const view = publicView(state, 'p1')
    const serialised = JSON.stringify(view)
    expect(serialised).not.toContain('"rng"')
    expect(serialised).not.toContain('"productionRemainder"')
    expect(serialised).not.toContain('"intel"')
  })
})

describe('R-DIP-04 Aufklaerungsgedaechtnis', () => {
  it('merkt sich gesehene Provinzen mit Zeitstempel', () => {
    const after = runTicks(state, 2, ctx).state
    expect(after.players['p1']!.intel['m1']).toBeDefined()
    expect(intelAge(after, 'p1', 'm1')).toBeGreaterThanOrEqual(0)
  })

  it('ueberlebt Speichern und Laden', () => {
    const after = runTicks(state, 5, ctx).state
    const revived = JSON.parse(JSON.stringify(after)) as GameState
    expect(revived.players['p1']!.intel).toEqual(after.players['p1']!.intel)
  })

  it('altert sichtbar', () => {
    const early = runTicks(state, 2, ctx).state
    const later = runTicks(early, 20, ctx).state
    // The memory of a province still in view is fresh; the timestamp keeps moving.
    expect(later.players['p1']!.intel['m1']!.tick).toBeGreaterThan(early.players['p1']!.intel['m1']!.tick)
  })
})
