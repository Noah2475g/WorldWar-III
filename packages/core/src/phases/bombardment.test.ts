import { TEST_RULES, placeArmy, smallWorld } from '@worldwar/testkit'
import { describe, expect, it } from 'vitest'
import { armyHp } from '../state/army'
import { createInitialState, type GameConfig } from '../state/create'
import type { GameState } from '../state/types'
import { step } from '../step'

/**
 * Feuerautomatik und Feuerleitung (T-M15-07, R-BAT-08, R-BAT-06).
 *
 * Vier Vorbedingungen mussten vorher stehen, und keine war Bequemlichkeit: der
 * Stapel-Deckel als Grenzbeitrag (sonst richtet eine selbsttätig wachsende
 * Artilleriearmee ab 50 Einheiten **null** Schaden an), Artillerie in der KI (sonst ist
 * `armyRange` für jede KI-Armee 0 und AK3 unabnehmbar), der Umzug des Beschusses aus
 * Phase 1 (sonst hätte dieselbe Kanone zwei Regeln) und der Diplomatiefilter.
 */

const map = smallWorld()
const ctx = { map, rules: TEST_RULES }

const CONFIG: GameConfig = {
  seed: 707,
  mapId: 'testworld',
  rulesId: 'default',
  players: [
    { name: 'A', kind: 'human', nation: 'Nordland', color: '#0f62bc' },
    { name: 'B', kind: 'ai', nation: 'Ostmark', color: '#b03a2e', difficulty: 'normal' },
    { name: 'C', kind: 'ai', nation: 'Sueden', color: '#2e7d32', difficulty: 'normal' },
  ],
  victory: { condition: 'points', pointsShareToWin: 900, dayLimit: null },
}

/** Artillerie von p1 im neutralen m1, Ziel o1 von p2 — benachbart, im Krieg. */
function frontLine(options: { holdFire?: boolean; units?: number } = {}) {
  const state = createInitialState(CONFIG, ctx)
  state.diplomacy.relations['p1|p2']!.state = 'war'
  placeArmy(state, {
    owner: 'p1',
    at: 'm1',
    units: [{ unitKey: 'artillery', hpTotal: (options.units ?? 20) * TEST_RULES.units['artillery']!.hpPerUnit }],
    stance: 'defensive',
    ...(options.holdFire === undefined ? {} : { holdFire: options.holdFire }),
  })
  placeArmy(state, { owner: 'p2', at: 'o1', units: [{ unitKey: 'infantry', hpTotal: 100_000 }] })
  return state
}

const enemyHp = (state: GameState, owner: string): number =>
  state.armyOrder
    .map((id) => state.armies[id]!)
    .filter((army) => army.owner === owner)
    .reduce((sum, army) => sum + armyHp(army), 0)

describe('R-BAT-08/AK1 Eine stehende Fernwaffenarmee feuert von selbst', () => {
  it('trifft ohne Befehl und meldet den selbsttaetigen Beschuss', () => {
    const state = frontLine()
    const before = enemyHp(state, 'p2')

    const result = step(state, [], ctx)
    const shot = result.events.find((event) => event.type === 'BOMBARDMENT')

    expect(shot, 'kein Beschussereignis').toBeDefined()
    if (shot?.type === 'BOMBARDMENT') {
      expect(shot.automatic, 'der Beschuss ist nicht als selbsttaetig gekennzeichnet').toBe(true)
      expect(shot.damage).toBeGreaterThan(0)
    }
    expect(enemyHp(result.state, 'p2')).toBeLessThan(before)
  })

  it('haelt das Feuer auf Befehl — kein Ereignis, kein Schaden', () => {
    const state = frontLine({ holdFire: true })
    const before = enemyHp(state, 'p2')

    const result = step(state, [], ctx)

    expect(result.events.find((event) => event.type === 'BOMBARDMENT')).toBeUndefined()
    expect(enemyHp(result.state, 'p2')).toBe(before)
  })

  it('nimmt den Befehl "Feuer halten" ueber die Kommandokette an', () => {
    const state = frontLine()
    const armyId = state.armyOrder.find((id) => state.armies[id]!.owner === 'p1')!

    const result = step(state, [{ type: 'SET_HOLD_FIRE', playerId: 'p1', armyId, holdFire: true }], ctx)

    expect(result.state.armies[armyId]!.holdFire).toBe(true)
  })
})

describe('R-BAT-08/AK2 Die Zielwahl ist bestimmt', () => {
  /** Zwei erreichbare Feindprovinzen mit gleicher sichtbarer Staerke. */
  function tie(reversed: boolean) {
    const state = createInitialState(CONFIG, ctx)
    state.diplomacy.relations['p1|p2']!.state = 'war'
    placeArmy(state, {
      owner: 'p1',
      at: 'm1',
      units: [{ unitKey: 'artillery', hpTotal: 20 * TEST_RULES.units['artillery']!.hpPerUnit }],
      stance: 'defensive',
    })
    const first = { owner: 'p2', at: 'o1', units: [{ unitKey: 'infantry', hpTotal: 50_000 }] }
    const second = { owner: 'p2', at: 'o3', units: [{ unitKey: 'infantry', hpTotal: 50_000 }] }
    if (reversed) {
      placeArmy(state, second)
      placeArmy(state, first)
    } else {
      placeArmy(state, first)
      placeArmy(state, second)
    }
    return state
  }

  it('waehlt bei Gleichstand dieselbe Provinz, in beiden Reihenfolgen der Armeeliste', () => {
    // Ohne feste Regel haengt das Ziel daran, in welcher Reihenfolge die Armeen zufaellig
    // im Record stehen — und zwei Laeufe mit demselben Seed gaeben verschiedene Ergebnisse.
    const a = step(tie(false), [], ctx).events.find((event) => event.type === 'BOMBARDMENT')
    const b = step(tie(true), [], ctx).events.find((event) => event.type === 'BOMBARDMENT')

    expect(a?.type === 'BOMBARDMENT' ? a.targetProvinceId : null).toBe('o1')
    expect(b?.type === 'BOMBARDMENT' ? b.targetProvinceId : null).toBe('o1')
  })

  it('spiegelt das Ergebnis beim Seitentausch trefferpunktgenau', () => {
    const seite = (owner: 'p1' | 'p2') => {
      const state = createInitialState(CONFIG, ctx)
      state.diplomacy.relations['p1|p2']!.state = 'war'
      const gegner = owner === 'p1' ? 'p2' : 'p1'
      placeArmy(state, {
        owner,
        at: 'm1',
        units: [{ unitKey: 'artillery', hpTotal: 20 * TEST_RULES.units['artillery']!.hpPerUnit }],
        stance: 'defensive',
      })
      // Die Zielprovinz gehoert in beiden Richtungen dem Verteidiger — sonst waere die
      // Lage nicht gespiegelt, sondern eine andere: o1 gehoert von Haus aus p2, und p2
      // fuehrt keinen Krieg gegen sich selbst.
      state.provinces['o1']!.owner = gegner
      placeArmy(state, { owner: gegner, at: 'o1', units: [{ unitKey: 'infantry', hpTotal: 100_000 }] })
      const result = step(state, [], ctx)
      return enemyHp(result.state, gegner)
    }

    expect(seite('p1')).toBe(seite('p2'))
  })
})

describe('R-BAT-08 Wer nicht steht, feuert nicht', () => {
  const noShot = (state: GameState) =>
    expect(step(state, [], ctx).events.find((event) => event.type === 'BOMBARDMENT')).toBeUndefined()

  it('feuert nicht auf dem Marsch', () => {
    const state = frontLine()
    const armyId = state.armyOrder.find((id) => state.armies[id]!.owner === 'p1')!
    state.armies[armyId]!.path = ['n2']
    noShot(state)
  })

  it('feuert nicht eingeschifft', () => {
    const state = frontLine()
    const armyId = state.armyOrder.find((id) => state.armies[id]!.owner === 'p1')!
    state.armies[armyId]!.embarked = true
    noShot(state)
  })

  it('feuert nicht unter Rueckzugssperre', () => {
    const state = frontLine()
    const armyId = state.armyOrder.find((id) => state.armies[id]!.owner === 'p1')!
    state.armies[armyId]!.cannotAttackUntil = state.tick + 10
    noShot(state)
  })
})

describe('R-BAT-06 Kein Beschuss ohne Krieg', () => {
  it('laesst Verbuendete und Neutrale in der Zielprovinz unberuehrt', () => {
    // Eigenschaftstest ueber Dreiparteienlagen: die Automatik darf nur treffen, mit wem
    // Krieg besteht — und sie darf niemandem den Krieg erklaeren.
    const state = createInitialState(CONFIG, ctx)
    state.diplomacy.relations['p1|p2']!.state = 'war'
    placeArmy(state, {
      owner: 'p1',
      at: 'm1',
      units: [{ unitKey: 'artillery', hpTotal: 30 * TEST_RULES.units['artillery']!.hpPerUnit }],
      stance: 'defensive',
    })
    placeArmy(state, { owner: 'p2', at: 'o1', units: [{ unitKey: 'infantry', hpTotal: 100_000 }] })
    placeArmy(state, { owner: 'p3', at: 'o1', units: [{ unitKey: 'infantry', hpTotal: 100_000 }] })

    const before = enemyHp(state, 'p3')
    const result = step(state, [], ctx)

    expect(enemyHp(result.state, 'p3'), 'die neutrale Macht wurde getroffen').toBe(before)
    expect(enemyHp(result.state, 'p2'), 'der Kriegsgegner wurde nicht getroffen').toBeLessThan(100_000)
    expect(result.state.diplomacy.relations['p1|p3']!.state, 'die Automatik hat Krieg ausgeloest').toBe('peace')
  })
})

describe('R-BAT-08 Wirksamkeit statt Gruen', () => {
  it('richtet mit sechzig Einheiten mehr an als mit fuenfundzwanzig', () => {
    // Ohne T-M14-06 ist dieser Test rot, und *das* ist der Grund, warum T-M14-06 vorher
    // liegt: der Stapel-Deckel wirkte als Faktor auf die ganze Armee, und eine Armee ab
    // 50 Einheiten richtete exakt null Schaden an. Eine selbsttaetig feuernde
    // Artilleriearmee waechst ueber die Rekrutierung von allein dorthin — die
    // Feuerautomatik waere gebaut, gruen getestet und wirkungslos gewesen.
    const schaden = (units: number) => {
      const result = step(frontLine({ units }), [], ctx)
      const shot = result.events.find((event) => event.type === 'BOMBARDMENT')
      return shot?.type === 'BOMBARDMENT' ? shot.damage : 0
    }

    expect(schaden(60)).toBeGreaterThan(schaden(25))
  })
})

describe('R-BAT-06 Der Handbeschuss wirkt zum selben Zeitpunkt', () => {
  it('setzt nur eine Absicht und loest sie in der Beschussphase auf', () => {
    // Befund 52: `BOMBARD` wirkte in Phase 1, der Nahkampf in Phase 8. Eine Armee, die in
    // diesem Tick abmarschierte, wurde noch am alten Ort getroffen.
    const state = frontLine({ holdFire: true })
    const armyId = state.armyOrder.find((id) => state.armies[id]!.owner === 'p1')!

    const result = step(state, [{ type: 'BOMBARD', playerId: 'p1', armyId, targetProvinceId: 'o1' }], ctx)
    const shot = result.events.find((event) => event.type === 'BOMBARDMENT')

    expect(shot, 'der befohlene Beschuss fand nicht statt').toBeDefined()
    expect(shot?.type === 'BOMBARDMENT' ? shot.automatic : true, 'Handbeschuss als selbsttaetig gemeldet').toBe(false)
    // Die Absicht ist verbraucht: sonst schoesse dieselbe Armee in jedem folgenden Tick
    // erneut, ohne dass der Spieler es noch einmal befohlen hat.
    expect(result.state.armies[armyId]!.bombardTarget).toBeNull()
  })

  it('feuert nicht zweimal — Befehl schlaegt Automatik', () => {
    const state = frontLine()
    const armyId = state.armyOrder.find((id) => state.armies[id]!.owner === 'p1')!

    const result = step(state, [{ type: 'BOMBARD', playerId: 'p1', armyId, targetProvinceId: 'o1' }], ctx)

    expect(result.events.filter((event) => event.type === 'BOMBARDMENT').length).toBe(1)
  })
})
