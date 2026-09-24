import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { TEST_RULES, placeArmy, smallWorld } from '@worldwar/testkit'
import { beforeEach, describe, expect, it } from 'vitest'
import { runTicks } from '../clock'
import type { Command } from '../commands/types'
import { deserialise } from '../persistence/save'
import { createInitialState, type GameConfig } from '../state/create'
import { step } from '../step'
import { publicView } from './publicView'
import type { GameState } from '../state/types'

/**
 * What the view hands the interface for its displays (T-M13-05, R-DIP-04, R-UI-09).
 *
 * Four things were missing and every one of them is something a progress bar needs:
 * what is being built and when it is done, the same for a levy, where morale is
 * heading, and where fighting is going on. They are added here rather than worked out
 * in the interface, for the reason the project has held to since D11 — the interface
 * shows the game, it does not play it.
 *
 * And every one of them obeys the fog of war. A progress bar is a fine thing right up
 * until it tells the player what an opponent is building.
 */

const map = smallWorld()
const ctx = { map, rules: TEST_RULES }

const CONFIG: GameConfig = {
  seed: 7,
  mapId: 'testworld',
  rulesId: 'default',
  players: [
    { name: 'Mensch', kind: 'human', nation: 'Nordland', color: '#0f62bc' },
    { name: 'KI', kind: 'ai', nation: 'Ostmark', color: '#b03a2e', difficulty: 'normal' },
  ],
  victory: { condition: 'points', pointsShareToWin: 900, dayLimit: null },
}

let state: GameState

beforeEach(() => {
  state = createInitialState(CONFIG, ctx)
})

/** The first province each player owns, for tests that need one of each. */
const ownProvince = (player: string): string =>
  state.provinceOrder.find((id) => state.provinces[id]!.owner === player)!

/**
 * Die Sicht verraet keine Rueckzugssperre fremder Armeen (T-M40-10, Befund M2 der Durchsicht von M40).
 *
 * T-M40-04 gab jeder sichtbaren fremden Armee `retreating`, damit „Angriff" einem weichenden Gegner
 * folgen konnte. Die Verfolgung ist mit T-M40-10 entfallen — sie schadete in jedem gemessenen Lauf
 * mit Anlass (D30.9) —, und das Feld war Wissen ohne sichtbare Quelle: der Kern meldet einen Rueckzug
 * nur dem, der weicht (`ARMY_RETREATED` mit `audience` des Besitzers), und die Oberflaeche zeigte es
 * nie. Ohne Leser fuehrt die Sicht es nicht mehr.
 */
describe('R-DIP-04 Die Sicht verraet keine Rueckzugssperre fremder Armeen', () => {
  it('fuehrt bei einer sichtbaren fremden Armee unter Angriffssperre kein Feld retreating', () => {
    state.tick = 100
    // m1 grenzt an n2, das Nordland gehoert — sichtbar.
    const weicht = placeArmy(state, { owner: 'p2', at: 'm1', units: [{ unitKey: 'infantry', hpTotal: 5_000 }] })
    weicht.cannotAttackUntil = 110

    const view = publicView(state, 'p1')
    expect(view.armies.some((army) => army.id === weicht.id), 'die Armee ist nicht sichtbar - der Test misst nichts').toBe(true)
    expect(JSON.stringify(view)).not.toContain('retreating')
  })
})

describe('R-UI-09 Die Sicht nennt, was gerade laeuft', () => {
  it('gibt Bauvorhaben mit ihrem Fertigstellungszeitpunkt heraus', () => {
    const id = ownProvince('p1')
    state.provinces[id]!.buildQueue.push({
      id: 'o1',
      building: 'barracks',
      level: 1,
      startedTick: 0,
      completesAtTick: 48,
      ownerAtStart: 'p1',
    })

    const seen = publicView(state, 'p1', TEST_RULES).provinces.find((p) => p.id === id)

    // Anfang und Ende: ein Fortschrittsbalken braucht beide Enden. Und die Kennung, ohne
    // die `CANCEL_BUILD` nicht zu bilden ist — der Befehl war seit M3 gebaut, getestet
    // und aus genau diesem Grund unerreichbar (T-M14-13, Befund 36).
    expect(seen?.buildQueue).toEqual([
      { id: 'o1', building: 'barracks', startedTick: 0, completesAtTick: 48 },
    ])
    // The length stays as it was; a display that already reads it keeps working.
    expect(seen?.buildQueueLength).toBe(1)
  })

  it('gibt Aushebungen mit ihrem Fertigstellungszeitpunkt heraus', () => {
    const id = ownProvince('p1')
    state.provinces[id]!.recruitQueue.push({
      id: 'o2',
      unitKey: 'infantry',
      count: 2,
      startedTick: 0,
      completesAtTick: 30,
      ownerAtStart: 'p1',
    })

    const seen = publicView(state, 'p1', TEST_RULES).provinces.find((p) => p.id === id)

    expect(seen?.recruitQueue).toEqual([{ unitKey: 'infantry', count: 2, startedTick: 0, completesAtTick: 30 }])
  })

  it('nennt, wohin die Moral laeuft', () => {
    // The current value alone cannot say whether a province is settling down or coming
    // apart — and that is the only thing the player wants to know about it.
    const id = ownProvince('p1')
    state.provinces[id]!.morale = 60_000
    state.provinces[id]!.targetMorale = 80_000

    const seen = publicView(state, 'p1', TEST_RULES).provinces.find((p) => p.id === id)

    expect(seen?.moraleTarget).toBe(80_000)
  })

  it('nennt laufende Kaempfe in Provinzen, die der Spieler sieht', () => {
    const id = ownProvince('p1')
    state.battles.push({ id: 'b1', provinceId: id, sides: [['p1'], ['p2']], startedTick: 5 })

    expect(publicView(state, 'p1', TEST_RULES).battles).toEqual([{ provinceId: id, startedTick: 5 }])
  })
})

describe('R-DIP-04 Die neuen Felder halten den Nebel ein', () => {
  it('verschweigt Bauvorhaben und Aushebungen fremder Provinzen', () => {
    const enemy = ownProvince('p2')
    state.provinces[enemy]!.buildQueue.push({
      id: 'o3',
      building: 'fortress',
      level: 1,
      startedTick: 0,
      completesAtTick: 90,
      ownerAtStart: 'p2',
    })
    state.provinces[enemy]!.recruitQueue.push({
      id: 'o4',
      unitKey: 'tank',
      count: 3,
      startedTick: 0,
      completesAtTick: 90,
      ownerAtStart: 'p2',
    })
    // Make it visible: a scout standing next door sees the province, not its plans.
    placeArmy(state, { owner: 'p1', at: enemy, units: [{ unitKey: 'infantry', hpTotal: 1000 }] })

    const seen = publicView(state, 'p1', TEST_RULES).provinces.find((p) => p.id === enemy)

    expect(seen, 'Die Provinz sollte sichtbar sein').toBeTruthy()
    expect(seen?.buildQueue).toBeUndefined()
    expect(seen?.recruitQueue).toBeUndefined()
    expect(seen?.moraleTarget).toBeUndefined()
  })

  it('verschweigt Kaempfe in Provinzen, die der Spieler nicht sieht', () => {
    const hidden = state.provinceOrder.find(
      (id) => !publicView(state, 'p1', TEST_RULES).provinces.some((p) => p.id === id),
    )
    expect(hidden, 'Die Testkarte hat keine unsichtbare Provinz').toBeTruthy()

    state.battles.push({ id: 'b2', provinceId: hidden!, sides: [['p2'], ['p1']], startedTick: 5 })

    expect(publicView(state, 'p1', TEST_RULES).battles).toEqual([])
  })
})

describe('R-UI-09 Ohne Regeln bleibt die Sicht schlank', () => {
  it('berechnet die Anzeigefelder nur, wenn die Regeln mitkommen', () => {
    // The AI asks for the view every tick and reads none of this; it should not pay for
    // it either. The same rule `economy` has followed since M6.
    const id = ownProvince('p1')
    state.provinces[id]!.buildQueue.push({
      id: 'o5',
      building: 'barracks',
      level: 1,
      startedTick: 0,
      completesAtTick: 48,
      ownerAtStart: 'p1',
    })
    state.battles.push({ id: 'b3', provinceId: id, sides: [['p1'], ['p2']], startedTick: 5 })

    const lean = publicView(state, 'p1')
    const seen = lean.provinces.find((p) => p.id === id)

    expect(lean.battles).toBeUndefined()
    expect(seen?.buildQueue).toBeUndefined()
    expect(seen?.recruitQueue).toBeUndefined()
    expect(seen?.moraleTarget).toBeUndefined()
    // What was there before stays there — this must not become a second contract.
    expect(seen?.buildQueueLength).toBe(1)
  })
})

describe('R-UI-13 Die Sicht sagt, wie weit der Sieg entfernt ist', () => {
  it('nennt die Punktschwelle, wenn die Regeln mitkommen', () => {
    const view = publicView(state, 'p1', TEST_RULES)

    expect(view.victory.pointsShareToWin).toBe(900)
    expect(view.victory.condition).toBe('points')
  })

  it('nennt sie nicht ohne Regeln', () => {
    expect(publicView(state, 'p1').victory.pointsShareToWin).toBeUndefined()
  })
})

describe('R-UI-09 Die Sicht sagt, seit wann eine Armee marschiert', () => {
  it('gibt Abmarsch und Ankunft der eigenen Armee heraus', () => {
    const army = placeArmy(state, {
      owner: 'p1',
      at: ownProvince('p1'),
      units: [{ unitKey: 'infantry', hpTotal: 1000 }],
    })
    army.departureTick = 10
    army.arrivalTick = 40

    const seen = publicView(state, 'p1', TEST_RULES).armies.find((a) => a.id === army.id)

    expect(seen?.departureTick).toBe(10)
    expect(seen?.arrivalTick).toBe(40)
  })

  it('sagt bei fremden Armeen weiterhin nur, dass sie da sind', () => {
    const enemy = placeArmy(state, {
      owner: 'p2',
      at: ownProvince('p1'),
      units: [{ unitKey: 'infantry', hpTotal: 1000 }],
    })
    enemy.departureTick = 10

    const seen = publicView(state, 'p1', TEST_RULES).armies.find((a) => a.id === enemy.id)

    expect(seen, 'Die fremde Armee steht in eigener Provinz und ist sichtbar').toBeTruthy()
    expect(seen?.departureTick).toBeUndefined()
  })
})

describe('R-UI-13 Die Sicht sagt, ob man selbst noch im Spiel ist', () => {
  it('meldet die eigene Niederlage', () => {
    // Befund N4: Der Abschlussdialog haengt an `victory.winner`, und den setzt der Kern
    // erst, wenn genau EINE Macht uebrig ist. Scheidet der Mensch als einer von acht aus,
    // bleibt winner null — das Spiel tickt weiter, ohne Provinz, ohne Armee, ohne ein
    // Wort. Die Oberflaeche kann das bis heute gar nicht wissen: `self` fuehrt kein
    // `alive`, und `grep -c alive App.tsx` ergibt 0.
    const state = createInitialState(CONFIG, ctx)
    state.players['p1']!.alive = false

    expect(publicView(state, 'p1').self.alive).toBe(false)
  })

  it('meldet, solange man lebt, dass man lebt', () => {
    const state = createInitialState(CONFIG, ctx)
    expect(publicView(state, 'p1').self.alive).toBe(true)
  })
})

describe('R-AI-01 Die Sicht nennt die Sperre beim Verlegen der Hauptstadt (T-M41-11)', () => {
  // Befund der Untersuchung zu T-M41-08: `SET_CAPITAL` wird 30 Spieltage nach dem letzten Verlegen
  // mit ON_COOLDOWN abgelehnt (`CAPITAL_MOVE_COOLDOWN_DAYS`), aber die Sicht fuehrte nur
  // `capitalLostUntil` — die KI konnte die Sperre nicht sehen und befahl taeglich neu (298-mal in
  // einem Turnierlauf, nach der Reparatur zu H1 72-mal auf der Weltkarte). Eigenes Wissen, also
  // unter `self`; nur Sicht, kein Zustandsfeld.
  it('fuehrt, wann die eigene Hauptstadt zuletzt verlegt wurde', () => {
    state.players['p2']!.capitalMovedAtTick = 48
    expect(publicView(state, 'p2').self.capitalMovedAtTick).toBe(48)
  })

  it('fuehrt null, solange nie verlegt wurde', () => {
    expect(publicView(state, 'p2').self.capitalMovedAtTick).toBeNull()
  })

  it('verraet die Sperre einer fremden Macht nicht', () => {
    state.players['p1']!.capitalMovedAtTick = 48
    expect(publicView(state, 'p2').self.capitalMovedAtTick).toBeNull()
    expect(JSON.stringify(publicView(state, 'p2').others)).not.toContain('capitalMovedAtTick')
  })
})

/**
 * Die eigenen Zwischenziele in der Sicht (T-M35-05, R-GAME-08/AK3, D31.6).
 *
 * Eigenes Wissen, also unter `self` — und nur dort. Wie weit eine fremde Macht auf dem Weg zum
 * Sieg ist, verraet die Sicht nicht (R-DIP-04): die Rangliste zeigt fremde Punkte ohnehin,
 * aber ob China die zweite Punktmarke schon an Tag 300 erreicht hat, ist fremdes Wissen.
 * Wie `economy` nur mit Regeln — die Marken stehen dort.
 */
describe('R-GAME-08/AK3 Die Sicht fuehrt nur die eigenen Ziele', () => {
  type GoalRow = { goal: string; mark: number; value: number; reachedOnDay: number | null }
  const goalsIn = (view: unknown): GoalRow[] | undefined => (view as { self: { goals?: GoalRow[] } }).self.goals

  it('nennt je Ziel Marke, eigenen Stand und Tag, in der Reihenfolge der Marken', () => {
    state.players['p1']!.score = 300
    state.players['p2']!.score = 100
    ;(state as unknown as { goals: Record<string, Record<string, number | null>> }).goals['p1']!['pointShareFirst'] = 12

    const rows = goalsIn(publicView(state, 'p1', TEST_RULES))!
    const own = state.provinceOrder.filter((id) => state.provinces[id]!.owner === 'p1').length

    expect(rows.map((row) => row.goal)).toEqual(['provinces', 'pointShareFirst', 'populationShare', 'pointShareSecond'])
    expect(rows.map((row) => row.mark)).toEqual([
      TEST_RULES.constants.goalProvinces,
      TEST_RULES.constants.goalPointShareFirstPermille,
      TEST_RULES.constants.goalPopulationSharePermille,
      TEST_RULES.constants.goalPointShareSecondPermille,
    ])
    expect(rows[0]!.value).toBe(own)
    expect(rows[1]!.value, '300 von 400 Punkten').toBe(750)
    expect(rows[3]!.value).toBe(750)
    expect(rows.map((row) => row.reachedOnDay)).toEqual([null, 12, null, null])
  })

  it('zeigt keiner Macht die Ziele einer anderen', () => {
    const goals = (state as unknown as { goals: Record<string, Record<string, number | null>> }).goals
    goals['p1'] = { provinces: 40, pointShareFirst: 41, populationShare: 42, pointShareSecond: 43 }

    const view = publicView(state, 'p2', TEST_RULES)

    expect(goalsIn(view)!.map((row) => row.reachedOnDay)).toEqual([null, null, null, null])
    const text = JSON.stringify({ ...view, self: undefined })
    expect(text, 'fremde Ziele ausserhalb von self').not.toMatch(/goals|reachedOnDay|pointShareFirst/)
    for (const day of [40, 41, 42, 43]) expect(JSON.stringify(view.self)).not.toContain(`"reachedOnDay":${day}`)
  })

  it('rechnet ohne Regeln keine Ziele', () => {
    expect(goalsIn(publicView(state, 'p1'))).toBeUndefined()
  })
})

/**
 * Die Sicht nennt Durchmarsch und Kartenfreigabe mit ihrer Richtung (T-M17-04, R-DIP-08, D29.6).
 *
 * Bis T-M17-04 hiessen die Felder `rightOfWay` und `sharedMap` — ein Feld je Beziehung, und das
 * reichte, solange jeder Schreiber beide Richtungen setzte (T-M17-03). Jetzt gibt es zwei
 * Antworten, und die Sicht nennt beide, immer aus meiner Richtung: `passageGranted` = ich lasse
 * dich durch, `passageReceived` = du laesst mich durch; ebenso `mapShared` und `mapReceived`.
 * `passageEndsAtTick` traegt die Kuendigungsfrist beider Richtungen — der Gast braucht seine, um
 * rechtzeitig abzuziehen, der Gewaehrende seine, um zu sehen, dass er schon gekuendigt hat.
 */
describe('R-DIP-08 Die Sicht nennt Durchmarsch und Karte mit ihrer Richtung', () => {
  const diplo = (playerId: string, targetPlayerId: string, action: string): Command =>
    ({ type: 'DIPLOMACY', playerId, targetPlayerId, action }) as Command

  it('trennt, was ich gewaehre, von dem, was ich erhalte', () => {
    const granted = step(state, [diplo('p1', 'p2', 'grantRightOfWay'), diplo('p2', 'p1', 'shareMap')], ctx).state

    expect(publicView(granted, 'p1').relations['p2']).toMatchObject({
      passageGranted: true,
      passageReceived: false,
      mapShared: false,
      mapReceived: true,
    })
    expect(publicView(granted, 'p2').relations['p1']).toMatchObject({
      passageGranted: false,
      passageReceived: true,
      mapShared: true,
      mapReceived: false,
    })
  })

  it('nennt die Kuendigungsfrist beiden Seiten, jeder in seiner Richtung', () => {
    const granted = step(state, [diplo('p1', 'p2', 'grantRightOfWay')], ctx).state
    expect(publicView(granted, 'p1').relations['p2']!.passageEndsAtTick).toEqual({ granted: null, received: null })

    const revoked = step(granted, [diplo('p1', 'p2', 'revokeRightOfWay')], ctx).state
    const ends = granted.tick + TEST_RULES.constants.rightOfWayNoticeTicks

    expect(publicView(revoked, 'p1').relations['p2']!.passageEndsAtTick).toEqual({ granted: ends, received: null })
    expect(publicView(revoked, 'p2').relations['p1']!.passageEndsAtTick).toEqual({ granted: null, received: ends })
    // Bis zum Fristende gilt das Recht, und die Sicht sagt es.
    expect(publicView(revoked, 'p2').relations['p1']!.passageReceived).toBe(true)
  })

  it('zeigt eine abgelaufene Frist nicht mehr', () => {
    const granted = step(state, [diplo('p1', 'p2', 'grantRightOfWay')], ctx).state
    const revoked = step(granted, [diplo('p1', 'p2', 'revokeRightOfWay')], ctx).state
    const later = runTicks(revoked, TEST_RULES.constants.rightOfWayNoticeTicks, ctx).state

    expect(publicView(later, 'p2').relations['p1']).toMatchObject({
      passageReceived: false,
      passageEndsAtTick: { granted: null, received: null },
    })
  })

  it('fuehrt die alten Namen nicht mehr', () => {
    // Ein Leser, der noch `rightOfWay` fragt, bekaeme `undefined` — also „nein" — und saehe
    // keinen Fehler. Der Typ faengt es beim Bau, dieser Test im Lauf.
    const relation = publicView(state, 'p1').relations['p2'] as unknown as Record<string, unknown>

    expect('rightOfWay' in relation).toBe(false)
    expect('sharedMap' in relation).toBe(false)
  })

  it('zeigt nach dem Laden eines alten Standes beide Richtungen (R-DIP-08/AK4 und AK6)', () => {
    const v3Text = readFileSync(fileURLToPath(new URL('../../test/golden/save-v3.json', import.meta.url)), 'utf8')
    const old = (JSON.parse(v3Text) as { state: { diplomacy: { relations: Record<string, Record<string, unknown>> } } })
      .state.diplomacy.relations
    const loaded = deserialise(v3Text)

    const passage = Object.keys(old).find((key) => old[key]!['rightOfWay'] === true && old[key]!['state'] !== 'alliance')!
    const map = Object.keys(old).find((key) => old[key]!['sharedMap'] === true && old[key]!['state'] !== 'alliance')!
    for (const [key, felder] of [
      [passage, ['passageGranted', 'passageReceived']],
      [map, ['mapShared', 'mapReceived']],
    ] as const) {
      const [a, b] = key.split('|') as [string, string]
      for (const [me, other] of [
        [a, b],
        [b, a],
      ] as const) {
        const relation = publicView(loaded, me).relations[other] as unknown as Record<string, unknown>
        for (const feld of felder) expect(relation[feld], `${me} → ${other}: ${feld}`).toBe(true)
      }
    }
  })
})
