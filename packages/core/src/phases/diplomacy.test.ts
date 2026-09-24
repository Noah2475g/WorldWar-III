import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { TEST_RULES, placeArmy, smallWorld } from '@worldwar/testkit'
import { beforeEach, describe, expect, it } from 'vitest'
import { runTicks } from '../clock'
import type { Command } from '../commands/types'
import type { GameEvent } from '../events/types'
import { deserialise } from '../persistence/save'
import {
  createInitialState,
  grantsPassage,
  passageEndsAtTick,
  sharesMap,
  type GameConfig,
} from '../state/create'
import type { GameState, MapData } from '../state/types'
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
    // Beide Richtungen: ein Buendnis ist gegenseitig, und seit Stufe 4 steht das im Zustand.
    expect(allied.diplomacy.relations['p1|p2']!.aSharesMap).toBe(true)
    expect(allied.diplomacy.relations['p1|p2']!.bSharesMap).toBe(true)
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
    // Gerichtet: p2 (die Haelfte `b` des Schluessels `p1|p2`) zeigt p1 seine Karte. Wer hier
    // die andere Richtung setzt, sieht nichts — genau das soll der Test unterscheiden koennen.
    state.diplomacy.relations['p1|p2']!.bSharesMap = true
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

/**
 * Ansehen und Verstimmung klingen ab (T-M15-05, R-DIP-06/AK5).
 *
 * Ohne das Abklingen wäre beides ein Einbahnverkehr: ein Überfall im dritten Spieljahr
 * hinge einer Macht bis zum Ende der Partie an, und die Diplomatie hätte kein Gedächtnis,
 * sondern ein Strafregister. Geprüft wird hier, in der Datei, die das Abklingen wirklich
 * enthält — nicht in der KI, die es nur liest.
 */
describe('R-DIP-06/AK5 Zeit heilt, langsam und in beide Richtungen', () => {
  it('traegt dem Ueberfallenen eine Verstimmung ein — und nicht dem Angreifer', () => {
    // Gerichtet, und das ist der ganze Grund für ein eigenes Record: `relations` hat
    // einen gemeinsamen Schlüssel je Paar und könnte "wer ist auf wen böse" gar nicht
    // ausdrücken.
    const state = createInitialState(CONFIG, ctx)
    placeArmy(state, { owner: 'p1', at: 'o1', units: [{ unitKey: 'infantry', hpTotal: 10_000 }] })

    const after = step(state, [], ctx).state

    expect(after.diplomacy.grievances['p2']?.['p1'], 'das Opfer ist nicht verstimmt').toBeGreaterThan(0)
    expect(after.diplomacy.grievances['p1']?.['p2'], 'der Angreifer ist verstimmt').toBeUndefined()
  })

  it('laesst das Ansehen je Spieltag um den Regelbetrag zurueckwandern', () => {
    const state = createInitialState(CONFIG, ctx)
    state.players['p1']!.reputation = TEST_RULES.constants.reputationBaseline - 500

    const einTag = runTicks(state, TEST_RULES.constants.ticksPerDay, ctx).state

    expect(einTag.players['p1']!.reputation).toBe(
      TEST_RULES.constants.reputationBaseline - 500 + TEST_RULES.constants.reputationRecoveryPerDay,
    )
  })

  it('haelt am Ausgangswert an, statt darueber hinauszuschiessen', () => {
    const state = createInitialState(CONFIG, ctx)
    state.players['p1']!.reputation = TEST_RULES.constants.reputationBaseline - 1

    const einTag = runTicks(state, TEST_RULES.constants.ticksPerDay, ctx).state

    expect(einTag.players['p1']!.reputation).toBe(TEST_RULES.constants.reputationBaseline)
  })

  it('verkleinert jede Verstimmung je Spieltag um den Regelanteil', () => {
    const state = createInitialState(CONFIG, ctx)
    state.diplomacy.grievances = { p1: { p2: 1000 } }

    const einTag = runTicks(state, TEST_RULES.constants.ticksPerDay, ctx).state
    const erwartet = 1000 - Math.trunc((1000 * TEST_RULES.constants.grievanceDecayPermillePerDay) / 1000)

    expect(einTag.diplomacy.grievances['p1']?.['p2']).toBe(erwartet)
  })

  it('vergisst eine abgeklungene Verstimmung ganz', () => {
    // Sonst wüchse das Record über eine lange Partie mit Einträgen voller Nullen — und
    // stünde in jedem Speicherstand.
    const state = createInitialState(CONFIG, ctx)
    state.diplomacy.grievances = { p1: { p2: 1 } }

    const einTag = runTicks(state, TEST_RULES.constants.ticksPerDay, ctx).state

    expect(einTag.diplomacy.grievances['p1']).toBeUndefined()
  })

  it('laeuft ueber playerOrder, nicht ueber die Einfuegereihenfolge', () => {
    // R-ARCH-01. Ein Object.keys-Durchlauf gäbe dasselbe Ergebnis, solange die Records
    // zufällig in derselben Reihenfolge entstehen — und ein anderes an dem Tag, an dem
    // sie es nicht tun. Geprüft, indem die Einfügereihenfolge umgedreht wird.
    const vorwaerts = createInitialState(CONFIG, ctx)
    vorwaerts.diplomacy.grievances = { p1: { p2: 500, p3: 300 }, p3: { p1: 200 } }

    const rueckwaerts = createInitialState(CONFIG, ctx)
    rueckwaerts.diplomacy.grievances = { p3: { p1: 200 }, p1: { p3: 300, p2: 500 } }

    const a = runTicks(vorwaerts, TEST_RULES.constants.ticksPerDay, ctx).state
    const b = runTicks(rueckwaerts, TEST_RULES.constants.ticksPerDay, ctx).state

    expect(a.diplomacy.grievances).toEqual(b.diplomacy.grievances)
  })
})

/**
 * Durchmarsch und Kartenfreigabe haben eine Richtung (T-M17-04, R-DIP-08, D29.2–D29.6).
 *
 * Bis Stufe 3 war beides ein symmetrisches Feld je Paar, und T-M17-03 hat den Zustand
 * gerichtet, ohne das Verhalten zu aendern: jeder Schreiber setzte beide Richtungen. Hier
 * wird die Richtung wirksam. Der erste Test ist der Befund B1 selbst — vor dieser Aufgabe
 * war er rot, weil „ich lasse dich durch" zugleich „ich darf zu dir" hiess.
 */
describe('R-DIP-08 Durchmarsch und Kartenfreigabe haben eine Richtung', () => {
  const infantry = [{ unitKey: 'infantry' as const, hpTotal: 5_000 }]
  const rejection = (events: readonly GameEvent[]) => events.find((event) => event.type === 'COMMAND_REJECTED')
  const passageEvent = (events: readonly GameEvent[]) => events.find((event) => event.type === 'RIGHT_OF_WAY_CHANGED')

  describe('AK1 Wer gewaehrt, laesst durch — und darf selbst nicht hinein', () => {
    it('macht aus dem Einmarsch des Gewaehrenden einen Ueberfall (Befund B1)', () => {
      // p1 gewaehrt p2. Bis T-M17-04 setzte das auch p2 → p1, und p1 marschierte folgenlos zu p2.
      const granted = step(state, [diplo('p1', 'p2', 'grantRightOfWay')], ctx).state
      expect(grantsPassage(granted, 'p1', 'p2'), 'p1 laesst p2 nicht durch').toBe(true)
      expect(grantsPassage(granted, 'p2', 'p1'), 'die Gegenrichtung ist mitgesetzt').toBe(false)

      placeArmy(granted, { owner: 'p1', at: 'o3', units: infantry })
      const result = step(granted, [], ctx)

      expect(result.state.diplomacy.relations['p1|p2']!.state).toBe('war')
      expect(result.events.find((event) => event.type === 'WAR_DECLARED')).toMatchObject({
        playerId: 'p1',
        targetPlayerId: 'p2',
        withoutDeclaration: true,
      })
    })

    it('laesst den Gast durch das Gebiet des Gewaehrenden, ohne dass es ein Ueberfall ist', () => {
      const granted = step(state, [diplo('p1', 'p2', 'grantRightOfWay')], ctx).state
      placeArmy(granted, { owner: 'p2', at: 'n3', units: infantry })

      const after = step(granted, [], ctx).state
      expect(after.diplomacy.relations['p1|p2']!.state).toBe('peace')
    })

    it('meldet die Gewaehrung beiden — und nur beim ersten Mal', () => {
      const first = step(state, [diplo('p1', 'p2', 'grantRightOfWay')], ctx)
      expect(passageEvent(first.events)).toMatchObject({
        playerId: 'p1',
        targetPlayerId: 'p2',
        granted: true,
        effectiveAtTick: 0,
      })
      expect([...passageEvent(first.events)!.audience].sort()).toEqual(['p1', 'p2'])

      // Ein zweites „gewaehren" aendert nichts — und erzaehlt deshalb auch nichts.
      const again = step(first.state, [diplo('p1', 'p2', 'grantRightOfWay')], ctx)
      expect(passageEvent(again.events)).toBeUndefined()
      expect(rejection(again.events)).toBeUndefined()
    })
  })

  describe('AK2 Der Durchmarsch laesst sich erbitten', () => {
    it('zeigt den Antrag dem Gefragten und nicht dem Fragenden', () => {
      const asked = step(state, [diplo('p2', 'p1', 'requestRightOfWay')], ctx).state

      expect(publicView(asked, 'p1').incomingOffers).toEqual([{ from: 'p2', kind: 'rightOfWay', tick: 0 }])
      expect(publicView(asked, 'p2').incomingOffers).toEqual([])
      // Ein Antrag ist kein Recht.
      expect(grantsPassage(asked, 'p1', 'p2')).toBe(false)
    })

    it('gibt mit der Annahme dem Antragsteller das Recht — und nur ihm', () => {
      const asked = step(state, [diplo('p2', 'p1', 'requestRightOfWay')], ctx).state
      const accepted = step(asked, [diplo('p1', 'p2', 'acceptRightOfWay')], ctx)

      expect(grantsPassage(accepted.state, 'p1', 'p2')).toBe(true)
      expect(grantsPassage(accepted.state, 'p2', 'p1')).toBe(false)
      expect(accepted.state.diplomacy.offers).toEqual([])
      expect(passageEvent(accepted.events)).toMatchObject({ playerId: 'p1', targetPlayerId: 'p2', granted: true })
    })

    it('nimmt nur den einen Antrag vom Tisch, nicht die der anderen', () => {
      // Befund B4 in der Art der Durchmarschantraege: `acceptPeace` loescht alle Friedensangebote
      // an den Annehmenden. Ein Antrag ist eine Bitte eines Einzelnen und wird einzeln beantwortet.
      const asked = step(state, [diplo('p2', 'p1', 'requestRightOfWay'), diplo('p3', 'p1', 'requestRightOfWay')], ctx).state
      const accepted = step(asked, [diplo('p1', 'p2', 'acceptRightOfWay')], ctx).state

      expect(accepted.diplomacy.offers.map((offer) => `${offer.from}>${offer.to}:${offer.kind}`)).toEqual([
        'p3>p1:rightOfWay',
      ])
    })

    it('lehnt die Annahme ab, wenn kein Antrag vorliegt', () => {
      const result = step(state, [diplo('p1', 'p2', 'acceptRightOfWay')], ctx)

      expect(rejection(result.events)).toMatchObject({ code: 'INVALID_TARGET', detail: { reason: 'kein Angebot' } })
      expect(grantsPassage(result.state, 'p1', 'p2')).toBe(false)
    })

    it('lehnt den Antrag im Krieg ab', () => {
      state.diplomacy.relations['p1|p2']!.state = 'war'
      const result = step(state, [diplo('p2', 'p1', 'requestRightOfWay')], ctx)

      expect(rejection(result.events)).toMatchObject({ code: 'INVALID_TARGET', detail: { reason: 'im Krieg' } })
      expect(result.state.diplomacy.offers).toEqual([])
    })

    it('lehnt den Antrag ab, solange eine Kriegserklaerung laeuft', () => {
      const declared = step(state, [diplo('p1', 'p2', 'declareWar')], ctx).state
      expect(declared.diplomacy.relations['p1|p2']!.state).toBe('peace')

      const result = step(declared, [diplo('p2', 'p1', 'requestRightOfWay')], ctx)
      expect(rejection(result.events)).toMatchObject({ code: 'INVALID_TARGET', detail: { reason: 'Kriegserklärung läuft' } })
      expect(result.state.diplomacy.offers).toEqual([])
    })

    it('lehnt den Antrag ab, wenn das Recht schon besteht', () => {
      const granted = step(state, [diplo('p1', 'p2', 'grantRightOfWay')], ctx).state
      const result = step(granted, [diplo('p2', 'p1', 'requestRightOfWay')], ctx)

      expect(rejection(result.events)).toMatchObject({ code: 'INVALID_TARGET', detail: { reason: 'bereits gewährt' } })
    })

    it('laesst einen Antrag, der den Kriegsausbruch ueberlebt hat, nicht mehr annehmen', () => {
      const asked = step(state, [diplo('p2', 'p1', 'requestRightOfWay')], ctx).state
      asked.diplomacy.relations['p1|p2']!.state = 'war'

      const result = step(asked, [diplo('p1', 'p2', 'acceptRightOfWay')], ctx)
      expect(rejection(result.events)).toMatchObject({ code: 'INVALID_TARGET', detail: { reason: 'im Krieg' } })
      expect(grantsPassage(result.state, 'p1', 'p2')).toBe(false)
    })

    it('ersetzt einen wiederholten Antrag, statt ihn zu stapeln', () => {
      const once = step(state, [diplo('p2', 'p1', 'requestRightOfWay')], ctx).state
      const twice = step(once, [diplo('p2', 'p1', 'requestRightOfWay')], ctx).state

      expect(twice.diplomacy.offers).toEqual([{ from: 'p2', to: 'p1', kind: 'rightOfWay', tick: 1 }])
    })

    it('raeumt einen Antrag ab, wenn der Gefragte ohnehin gewaehrt', () => {
      const asked = step(state, [diplo('p2', 'p1', 'requestRightOfWay')], ctx).state
      const granted = step(asked, [diplo('p1', 'p2', 'grantRightOfWay')], ctx).state

      expect(granted.diplomacy.offers).toEqual([])
    })
  })

  describe('AK3 Ein Widerruf wirkt nach der Frist', () => {
    /** p1 gewaehrt p2, und eine Armee von p2 steht in n3 — im Land von p1. */
    function guestInLand(): GameState {
      const granted = step(state, [diplo('p1', 'p2', 'grantRightOfWay')], ctx).state
      placeArmy(granted, { owner: 'p2', at: 'n3', units: infantry })
      return granted
    }

    it('ist vor Fristende kein Ueberfall und danach schon — und beide erfahren es', () => {
      const revoked = step(guestInLand(), [diplo('p1', 'p2', 'revokeRightOfWay')], ctx)
      const event = passageEvent(revoked.events)
      const ends = revoked.state.tick - 1 + TEST_RULES.constants.rightOfWayNoticeTicks

      expect(event).toMatchObject({ playerId: 'p1', targetPlayerId: 'p2', granted: false, effectiveAtTick: ends })
      expect([...event!.audience].sort()).toEqual(['p1', 'p2'])
      expect(passageEndsAtTick(revoked.state, 'p1', 'p2')).toBe(ends)

      // Jeder Tick bis zum Fristende: der Gast steht, und niemand ueberfaellt niemanden.
      let current = revoked.state
      while (current.tick < ends) {
        current = step(current, [], ctx).state
        expect(current.diplomacy.relations['p1|p2']!.state, `Tick ${current.tick}`).toBe('peace')
      }
      expect(grantsPassage(current, 'p1', 'p2'), 'das Recht endet nicht mit dem Tick der Frist').toBe(false)

      const after = step(current, [], ctx)
      expect(after.state.diplomacy.relations['p1|p2']!.state).toBe('war')
      expect(after.events.find((e) => e.type === 'WAR_DECLARED')).toMatchObject({
        playerId: 'p2',
        targetPlayerId: 'p1',
        withoutDeclaration: true,
      })
    })

    it('raeumt eine abgelaufene Frist aus dem Zustand', () => {
      const revoked = step(state, [diplo('p1', 'p2', 'grantRightOfWay')], ctx).state
      const noticed = step(revoked, [diplo('p1', 'p2', 'revokeRightOfWay')], ctx).state
      const later = runTicks(noticed, TEST_RULES.constants.rightOfWayNoticeTicks + 1, ctx).state

      // p1 ist die Haelfte `a` des Schluessels `p1|p2`.
      expect(later.diplomacy.relations['p1|p2']!.aGrantsPassage).toBe(false)
      expect(later.diplomacy.relations['p1|p2']!.aPassageEndsAtTick).toBeNull()
      expect(passageEndsAtTick(later, 'p1', 'p2')).toBeNull()
    })

    it('nimmt einen Widerruf zurueck, wenn der Gewaehrende vor Fristende erneut gewaehrt', () => {
      const noticed = step(guestInLand(), [diplo('p1', 'p2', 'revokeRightOfWay')], ctx).state
      const renewed = step(noticed, [diplo('p1', 'p2', 'grantRightOfWay')], ctx)

      expect(passageEndsAtTick(renewed.state, 'p1', 'p2')).toBeNull()
      expect(passageEvent(renewed.events)).toMatchObject({ granted: true })
      const later = runTicks(renewed.state, TEST_RULES.constants.rightOfWayNoticeTicks + 1, ctx).state
      expect(later.diplomacy.relations['p1|p2']!.state).toBe('peace')
    })

    it('lehnt den Widerruf eines Rechts ab, das nicht besteht', () => {
      // Die Gegenrichtung zaehlt nicht: p2 laesst p1 durch, p1 kann das nicht widerrufen.
      const granted = step(state, [diplo('p2', 'p1', 'grantRightOfWay')], ctx).state
      const result = step(granted, [diplo('p1', 'p2', 'revokeRightOfWay')], ctx)

      expect(rejection(result.events)).toMatchObject({ code: 'INVALID_TARGET', detail: { reason: 'nicht gewährt' } })
      expect(passageEndsAtTick(result.state, 'p2', 'p1')).toBeNull()
    })

    it('lehnt einen zweiten Widerruf ab, statt die Frist zu verschieben', () => {
      const noticed = step(guestInLand(), [diplo('p1', 'p2', 'revokeRightOfWay')], ctx).state
      const ends = passageEndsAtTick(noticed, 'p1', 'p2')
      const again = step(noticed, [diplo('p1', 'p2', 'revokeRightOfWay')], ctx)

      expect(rejection(again.events)).toMatchObject({ code: 'INVALID_TARGET', detail: { reason: 'bereits gekündigt' } })
      expect(passageEndsAtTick(again.state, 'p1', 'p2')).toBe(ends)
    })

    it('lehnt den Widerruf im Buendnis ab — das Buendnis laesst ohnehin durch', () => {
      const offered = step(state, [diplo('p1', 'p2', 'offerAlliance')], ctx).state
      const allied = step(offered, [diplo('p2', 'p1', 'acceptAlliance')], ctx).state
      const result = step(allied, [diplo('p1', 'p2', 'revokeRightOfWay')], ctx)

      expect(rejection(result.events)).toMatchObject({ code: 'INVALID_TARGET', detail: { reason: 'im Bündnis' } })
    })
  })

  describe('AK4 Ein alter Stand behaelt beide Richtungen', () => {
    const world = JSON.parse(
      readFileSync(fileURLToPath(new URL('../../../../data/maps/world.json', import.meta.url)), 'utf8'),
    ) as MapData
    const worldCtx = { map: world, rules: TEST_RULES }
    const v3Text = readFileSync(fileURLToPath(new URL('../../test/golden/save-v3.json', import.meta.url)), 'utf8')
    const v3Relations = (JSON.parse(v3Text) as { state: { diplomacy: { relations: Record<string, Record<string, unknown>> } } })
      .state.diplomacy.relations

    /** Das erste Paar im eingefrorenen Stand, das eine Bedingung erfuellt — im Frieden, ohne Buendnis. */
    const pairWhere = (test: (old: Record<string, unknown>) => boolean): [string, string] => {
      const key = Object.keys(v3Relations).find(
        (candidate) => v3Relations[candidate]!['state'] === 'peace' && test(v3Relations[candidate]!),
      )
      expect(key, 'der eingefrorene Stand traegt das Paar nicht').toBeDefined()
      return key!.split('|') as [string, string]
    }

    it('laesst nach dem Laden beide Seiten ohne Ueberfall hinueber', () => {
      const state = deserialise(v3Text)
      const [a, b] = pairWhere((old) => old['rightOfWay'] === true)
      const [c, d] = pairWhere((old) => old['rightOfWay'] === false)

      expect(grantsPassage(state, a, b)).toBe(true)
      expect(grantsPassage(state, b, a)).toBe(true)

      const provinceOf = (owner: string) => state.provinceOrder.find((id) => state.provinces[id]!.owner === owner)!
      placeArmy(state, { owner: a, at: provinceOf(b), units: infantry })
      placeArmy(state, { owner: b, at: provinceOf(a), units: infantry })
      // Die Gegenprobe im selben Tick: ein Paar ohne altes Recht wird zum Krieg. Ohne sie
      // koennte der Test auch deshalb gruen sein, weil gar kein Ueberfall erkannt wird.
      placeArmy(state, { owner: c, at: provinceOf(d), units: infantry })

      const after = step(state, [], worldCtx).state
      expect(after.diplomacy.relations[`${a}|${b}`]!.state).toBe('peace')
      expect(after.diplomacy.relations[`${c}|${d}`]!.state).toBe('war')
    })

    it('behaelt die geteilte Karte in beide Richtungen', () => {
      const state = deserialise(v3Text)
      const [a, b] = pairWhere((old) => old['sharedMap'] === true)

      expect(sharesMap(state, a, b)).toBe(true)
      expect(sharesMap(state, b, a)).toBe(true)
    })
  })

  describe('AK5 Ein Antrag ohne Antwort verfaellt', () => {
    it('verfaellt nach der Regelfrist, keinen Tick frueher', () => {
      const lifetime = TEST_RULES.constants.offerLifetimeDays * TEST_RULES.constants.ticksPerDay
      const asked = step(state, [diplo('p2', 'p1', 'requestRightOfWay')], ctx).state

      const justBefore = runTicks(asked, lifetime - 1, ctx).state
      expect(justBefore.diplomacy.offers).toHaveLength(1)
      expect(step(justBefore, [], ctx).state.diplomacy.offers).toHaveLength(0)
    })

    it('nimmt die Frist aus den Regeln und nicht aus dem Code (Befund B3)', () => {
      // Vorher stand `3 * ticksPerDay` in der Phase. Mit einem Tag laeuft dasselbe Angebot
      // nach 24 Ticks ab — mit der Zahl im Code laege es dann noch zwei Tage.
      const rules = { ...TEST_RULES, constants: { ...TEST_RULES.constants, offerLifetimeDays: 1 } }
      const oneDay = { map, rules }
      const asked = step(state, [diplo('p1', 'p2', 'offerAlliance')], oneDay).state

      expect(runTicks(asked, TEST_RULES.constants.ticksPerDay, oneDay).state.diplomacy.offers).toEqual([])
    })
  })

  describe('AK6 Die Kartenfreigabe hat eine Richtung', () => {
    it('zeigt B das Gebiet von A — und A nicht das Gebiet von B', () => {
      const plain = step(state, [], ctx).state
      const shared = step(state, [diplo('p1', 'p2', 'shareMap')], ctx).state

      expect(visibleProvinces(plain, 'p2').has('n1'), 'n1 war schon vorher sichtbar').toBe(false)
      expect(visibleProvinces(shared, 'p2').has('n1')).toBe(true)
      expect([...visibleProvinces(shared, 'p1')].sort()).toEqual([...visibleProvinces(plain, 'p1')].sort())
      expect(sharesMap(shared, 'p1', 'p2')).toBe(true)
      expect(sharesMap(shared, 'p2', 'p1')).toBe(false)
    })
  })

  /**
   * Befund M17-3, entschieden in T-M17-04 (kippbar, Fragment A): ein Krieg nimmt die
   * Kartenfreigabe mit, nicht nur den Durchmarsch — gleich, ob er erklaert wurde oder mit
   * einem Ueberfall begann. Was der andere bis dahin gesehen hat, behaelt er ohnehin im
   * Aufklaerungsgedaechtnis (`player.intel`); geloescht wird nur die laufende Sicht. Und die
   * Befehle selbst verweigern Freigaben im Krieg — ein Zustand, den kein Befehl herstellen darf,
   * soll auch kein Krieg stehen lassen.
   */
  describe('M17-3 Ein Krieg beendet Durchmarsch und Kartenfreigabe in beiden Richtungen', () => {
    it('beim Wirksamwerden einer Kriegserklaerung', () => {
      const tied = step(
        state,
        [
          diplo('p1', 'p2', 'grantRightOfWay'),
          diplo('p1', 'p2', 'shareMap'),
          diplo('p2', 'p1', 'grantRightOfWay'),
          diplo('p2', 'p1', 'shareMap'),
        ],
        ctx,
      ).state
      const declared = step(tied, [diplo('p1', 'p2', 'declareWar')], ctx).state
      const atWar = runTicks(declared, TEST_RULES.constants.warDeclarationDelayTicks, ctx).state

      expect(atWar.diplomacy.relations['p1|p2']!.state).toBe('war')
      for (const [x, y] of [['p1', 'p2'], ['p2', 'p1']] as const) {
        expect(grantsPassage(atWar, x, y), `Durchmarsch ${x} → ${y}`).toBe(false)
        expect(sharesMap(atWar, x, y), `Karte ${x} → ${y}`).toBe(false)
      }
    })

    it('auch beim Ueberfall — sonst lebte das Recht des Angreifers nach dem Frieden wieder auf', () => {
      // Erst seit dem gerichteten Recht erreichbar: p1 gewaehrt p2 und ueberfaellt p2 trotzdem.
      const tied = step(state, [diplo('p1', 'p2', 'grantRightOfWay'), diplo('p1', 'p2', 'shareMap')], ctx).state
      placeArmy(tied, { owner: 'p1', at: 'o3', units: infantry })

      const atWar = step(tied, [], ctx).state
      expect(atWar.diplomacy.relations['p1|p2']!.state).toBe('war')
      expect(grantsPassage(atWar, 'p1', 'p2')).toBe(false)
      expect(sharesMap(atWar, 'p1', 'p2')).toBe(false)
    })
  })
})

/**
 * Der Pflichtfall aus D29.3 (T-M17-05): ein Handelsangebot laeuft in genau dem Tick ab, in dem
 * seine beiden Maechte durch einen Ueberfall in den Krieg geraten. Beides schliesst das Angebot
 * mit Rueckgabe — die Treuhand darf trotzdem nur **einmal** zurueckgehen, und der Grund ist der
 * Krieg (Schritt 3 vor Schritt 4, und der Krieg zaehlt vor der Frist).
 */
describe('D29.3 Ueberfall und Verfall eines Handelsangebots im selben Tick', () => {
  it('schliesst das Angebot genau einmal, mit Grund Krieg, und gibt die Treuhand genau einmal zurueck', () => {
    const offer: Command = {
      type: 'OFFER_TRADE',
      playerId: 'p1',
      targetPlayerId: 'p2',
      give: { resources: { money: 50_000 }, provinces: [] },
      want: { resources: {}, provinces: [] },
    }
    const lifetime = TEST_RULES.constants.tradeOfferLifetimeDays * TEST_RULES.constants.ticksPerDay

    // Zwei Partien, die sich nur im Angebot unterscheiden — die zweite ist die Gegenprobe.
    let mit = step(state, [offer], ctx).state
    let ohne = step(state, [], ctx).state
    expect(mit.diplomacy.tradeOffers).toHaveLength(1)
    expect(mit.diplomacy.tradeOffers[0]!.expiresAtTick).toBe(lifetime)
    mit = runTicks(mit, lifetime - 1, ctx).state
    ohne = runTicks(ohne, lifetime - 1, ctx).state
    expect(mit.tick).toBe(lifetime)
    expect(mit.diplomacy.tradeOffers, 'einen Tick vor dem Ablauf liegt es noch').toHaveLength(1)
    expect(mit.players['p1']!.resources.money).toBe(ohne.players['p1']!.resources.money - 50_000)

    // Im Tick des Ablaufs marschiert p1 bei p2 ein.
    placeArmy(mit, { owner: 'p1', at: 'o1', units: [{ unitKey: 'infantry', hpTotal: 5_000 }] })
    placeArmy(ohne, { owner: 'p1', at: 'o1', units: [{ unitKey: 'infantry', hpTotal: 5_000 }] })
    const result = step(mit, [], ctx)
    const kontrolle = step(ohne, [], ctx).state

    expect(result.state.diplomacy.relations['p1|p2']!.state).toBe('war')
    expect(result.state.diplomacy.tradeOffers).toEqual([])
    const geschlossen = result.events.filter((e) => e.type === 'TRADE_OFFER_CLOSED')
    expect(geschlossen).toHaveLength(1)
    expect(geschlossen[0]).toMatchObject({ playerId: 'p1', targetPlayerId: 'p2', reason: 'war' })
    // Genau einmal zurueck: derselbe Bestand wie in der Partie ohne Angebot.
    expect(result.state.players['p1']!.resources.money).toBe(kontrolle.players['p1']!.resources.money)
    expect(result.state.players['p2']!.resources.money).toBe(kontrolle.players['p2']!.resources.money)
  })
})
