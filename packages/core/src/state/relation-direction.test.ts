import { TEST_RULES, placeArmy, smallWorld } from '@worldwar/testkit'
import { describe, expect, it } from 'vitest'
import { runTicks } from '../clock'
import type { Command } from '../commands/types'
import { step } from '../step'
import { publicView, visibleProvinces } from '../view/publicView'
import { createInitialState, grantsPassage, sharesMap, type GameConfig } from './create'
import type { GameState, PlayerId, Relation } from './types'

/**
 * Die Richtung der Beziehungsfelder seit Stufe 4 (Nacharbeit zu T-M17-03, 2026-09-24).
 *
 * Der Schluessel einer Beziehung ist sortiert (`p1|p2`: `a` = p1, `b` = p2), die Frage nicht.
 * Genau hier liegt die Fehlerklasse von Befund B2: wer die Haelfte verwechselt, liest das
 * Recht des anderen. Die Pruefung vom 2026-09-24 fand drei Stellen, an denen eine vertauschte
 * oder fehlende Haelfte **keinen** Test rot machte — bei 114 Testdateien:
 *
 *  1. die Schreiber: `setPassageBothWays` ohne die Haelfte `a`, `acceptAlliance` und
 *     `breakAlliance` ohne ihre Durchmarschzeile, eine wirksame Kriegserklaerung, die gar nichts
 *     mehr loescht;
 *  2. die Sicht: `grantsPassage(state, other, me)` gegen `(state, me, other)` vertauscht, und
 *     dasselbe fuer `sharesMap`;
 *  3. der Fristzweig von `grantsPassage` (`tick < ends`) — heute unerreichbar, weil jeder
 *     Schreiber `null` setzt, aber die Grundlage der Kuendigung in T-M17-04 (D29.2).
 *
 * **Seit T-M17-04** (Zusammenfuehrung der Diplomatiebahn, 2026-09-25) setzen `grantRightOfWay`
 * und `shareMap` nur noch die **eigene** Richtung `handelnd → anderer` (`setPassage`,
 * `setMapShared`); `acceptAlliance`, `breakAlliance` und der Kriegsausbruch schreiben weiter
 * beide, weil Buendnis und Krieg gegenseitig sind (D29.1). Jede Aussage laeuft in **beiden
 * Haelften** des Schluessels (Handelnder < anderer und Handelnder > anderer) und haelt alle
 * sechs Felder fest — ein Schreiber, der wieder beide Richtungen setzt oder die falsche Haelfte
 * trifft, faellt in mindestens einer Haelfte. Die Sicht liest seit T-M17-04 vier gerichtete
 * Felder (`passageGranted`/`passageReceived`, `mapShared`/`mapReceived`, D29.6) statt
 * `rightOfWay`/`sharedMap`; die Tests pruefen je Freigabe beide Blickrichtungen.
 *
 * Weiterhin **ohne** Anforderungskennung im Titel: R-DIP-08 belegen die Tests der
 * Diplomatiebahn (`commands/diplomacy`, `phases/diplomacy`); diese Datei bewacht nur die
 * Schluesselhaelften.
 */

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

const frisch = (): GameState => createInitialState(CONFIG, ctx)
const diplo = (playerId: PlayerId, targetPlayerId: PlayerId, action: string): Command =>
  ({ type: 'DIPLOMACY', playerId, targetPlayerId, action }) as Command
const beziehung = (state: GameState): Relation => state.diplomacy.relations['p1|p2']!

/** Die sechs gerichteten Felder einer Beziehung, in einem Blick. */
const richtungen = (relation: Relation) => ({
  aGrantsPassage: relation.aGrantsPassage,
  bGrantsPassage: relation.bGrantsPassage,
  aPassageEndsAtTick: relation.aPassageEndsAtTick,
  bPassageEndsAtTick: relation.bPassageEndsAtTick,
  aSharesMap: relation.aSharesMap,
  bSharesMap: relation.bSharesMap,
})

const ALLES_AUS = {
  aGrantsPassage: false,
  bGrantsPassage: false,
  aPassageEndsAtTick: null,
  bPassageEndsAtTick: null,
  aSharesMap: false,
  bSharesMap: false,
}

/**
 * Beide Haelften des Schluessels `p1|p2`: einmal handelt `a` (p1), einmal `b` (p2). Ein Test,
 * der nur eine Haelfte faehrt, sieht eine fehlende Zeile fuer die andere nicht — genau so
 * ueberlebte die Mutation „`setPassageBothWays` ohne `a`".
 */
const HAELFTEN = [
  { name: 'Handelnder ist a (p1 < p2)', handelnd: 'p1', anderer: 'p2' },
  { name: 'Handelnder ist b (p2 > p1)', handelnd: 'p2', anderer: 'p1' },
] as const

/** Die Haelfte des Schluessels, die die Richtung `von → zu` traegt: `a`, wenn `von` < `zu`. */
const haelfte = (von: PlayerId, zu: PlayerId): 'a' | 'b' => (von < zu ? 'a' : 'b')

describe('T-M17-04 Durchmarsch und Karte setzen nur die eigene Richtung, Buendnis und Krieg beide', () => {
  for (const { name, handelnd, anderer } of HAELFTEN) {
    it(`grantRightOfWay — ${name}: nur handelnd → anderer, die eigene Frist faellt weg, die fremde bleibt`, () => {
      // Beide Richtungen laufen vorher in einer Kuendigung: auf einer frischen Beziehung stuende
      // schon `null`, und eine fehlende Zeile `…PassageEndsAtTick = null` fiele nicht auf. Die
      // Gegenrichtung gehoert dem anderen — sie darf weder ihre Frist verlieren noch sich
      // unbefristet oeffnen.
      const state = frisch()
      Object.assign(beziehung(state), {
        aGrantsPassage: true,
        bGrantsPassage: true,
        aPassageEndsAtTick: 10_000,
        bPassageEndsAtTick: 10_000,
      })
      const nachher = step(state, [diplo(handelnd, anderer, 'grantRightOfWay')], ctx).state

      const eigen = haelfte(handelnd, anderer)
      const fremd = haelfte(anderer, handelnd)
      expect(richtungen(beziehung(nachher))).toEqual({
        ...ALLES_AUS,
        [`${eigen}GrantsPassage`]: true,
        [`${eigen}PassageEndsAtTick`]: null,
        [`${fremd}GrantsPassage`]: true,
        [`${fremd}PassageEndsAtTick`]: 10_000,
      })
    })

    it(`grantRightOfWay — ${name}: auf frischer Beziehung oeffnet sich nur handelnd → anderer`, () => {
      const nachher = step(frisch(), [diplo(handelnd, anderer, 'grantRightOfWay')], ctx).state

      expect(richtungen(beziehung(nachher))).toEqual({
        ...ALLES_AUS,
        [`${haelfte(handelnd, anderer)}GrantsPassage`]: true,
      })
      expect(grantsPassage(nachher, handelnd, anderer)).toBe(true)
      expect(grantsPassage(nachher, anderer, handelnd), 'wer gewaehrt, darf nicht selbst hinein').toBe(false)
    })

    it(`shareMap — ${name}: nur handelnd zeigt anderer seine Karte`, () => {
      const nachher = step(frisch(), [diplo(handelnd, anderer, 'shareMap')], ctx).state

      expect(richtungen(beziehung(nachher))).toEqual({
        ...ALLES_AUS,
        [`${haelfte(handelnd, anderer)}SharesMap`]: true,
      })
      expect(sharesMap(nachher, handelnd, anderer)).toBe(true)
      expect(sharesMap(nachher, anderer, handelnd)).toBe(false)
    })

    it(`acceptAlliance — ${name} nimmt an`, () => {
      const angeboten = step(frisch(), [diplo(anderer, handelnd, 'offerAlliance')], ctx).state
      const verbuendet = step(angeboten, [diplo(handelnd, anderer, 'acceptAlliance')], ctx).state

      expect(beziehung(verbuendet).state).toBe('alliance')
      expect(richtungen(beziehung(verbuendet))).toEqual({
        ...ALLES_AUS,
        aGrantsPassage: true,
        bGrantsPassage: true,
        aSharesMap: true,
        bSharesMap: true,
      })
    })

    it(`breakAlliance — ${name} bricht`, () => {
      const angeboten = step(frisch(), [diplo(anderer, handelnd, 'offerAlliance')], ctx).state
      const verbuendet = step(angeboten, [diplo(handelnd, anderer, 'acceptAlliance')], ctx).state
      const gebrochen = step(verbuendet, [diplo(handelnd, anderer, 'breakAlliance')], ctx).state

      expect(beziehung(gebrochen).state).toBe('peace')
      expect(richtungen(beziehung(gebrochen))).toEqual(ALLES_AUS)
    })

    it(`eine wirksame Kriegserklaerung loescht Durchmarsch, Frist und Karte — ${name} erklaert`, () => {
      // Vorher alles gesetzt, auch eine Frist: sonst saehe der Test eine Zeile nicht, die
      // "false" auf ein Feld schreibt, das ohnehin "false" ist. (Dass der Krieg auch die
      // Karte nimmt, ist Befund M17-3 — die Frage gehoert T-M17-04.)
      const state = frisch()
      Object.assign(beziehung(state), {
        aGrantsPassage: true,
        bGrantsPassage: true,
        aPassageEndsAtTick: 10_000,
        bPassageEndsAtTick: 10_000,
        aSharesMap: true,
        bSharesMap: true,
      })

      const erklaert = step(state, [diplo(handelnd, anderer, 'declareWar')], ctx).state
      expect(richtungen(beziehung(erklaert)).aGrantsPassage, 'die Erklaerung allein loescht noch nichts').toBe(true)

      const krieg = runTicks(erklaert, TEST_RULES.constants.warDeclarationDelayTicks, ctx).state
      expect(beziehung(krieg).state).toBe('war')
      expect(richtungen(beziehung(krieg))).toEqual(ALLES_AUS)
    })
  }
})

describe('T-M17-04 Die Sicht liest gerichtet: passageGranted/-Received, mapShared/-Received', () => {
  it('Durchmarsch in der Haelfte b (p2 laesst p1 durch): p1 empfaengt, p2 gewaehrt', () => {
    const state = frisch()
    beziehung(state).bGrantsPassage = true

    expect(publicView(state, 'p1').relations['p2']!.passageReceived).toBe(true)
    expect(publicView(state, 'p1').relations['p2']!.passageGranted).toBe(false)
    expect(publicView(state, 'p2').relations['p1']!.passageGranted).toBe(true)
    expect(publicView(state, 'p2').relations['p1']!.passageReceived).toBe(false)
  })

  it('Durchmarsch in der Haelfte a (p1 laesst p2 durch): p2 empfaengt, p1 gewaehrt', () => {
    const state = frisch()
    beziehung(state).aGrantsPassage = true

    expect(publicView(state, 'p2').relations['p1']!.passageReceived).toBe(true)
    expect(publicView(state, 'p2').relations['p1']!.passageGranted).toBe(false)
    expect(publicView(state, 'p1').relations['p2']!.passageGranted).toBe(true)
    expect(publicView(state, 'p1').relations['p2']!.passageReceived).toBe(false)
  })

  it('Karte in der Haelfte b (p2 zeigt p1 seine Karte): p1 empfaengt, p2 teilt', () => {
    const state = frisch()
    beziehung(state).bSharesMap = true

    expect(publicView(state, 'p1').relations['p2']!.mapReceived).toBe(true)
    expect(publicView(state, 'p1').relations['p2']!.mapShared).toBe(false)
    expect(publicView(state, 'p2').relations['p1']!.mapShared).toBe(true)
    expect(publicView(state, 'p2').relations['p1']!.mapReceived).toBe(false)
  })

  it('Karte in der Haelfte a (p1 zeigt p2 seine Karte): p2 empfaengt, p1 teilt — und nur p2 sieht mehr Provinzen', () => {
    const state = frisch()
    const vorher = { p1: visibleProvinces(state, 'p1').size, p2: visibleProvinces(state, 'p2').size }
    beziehung(state).aSharesMap = true

    expect(publicView(state, 'p2').relations['p1']!.mapReceived).toBe(true)
    expect(publicView(state, 'p2').relations['p1']!.mapShared).toBe(false)
    expect(publicView(state, 'p1').relations['p2']!.mapShared).toBe(true)
    expect(publicView(state, 'p1').relations['p2']!.mapReceived).toBe(false)
    // Die Gegenrichtung zu `phases/diplomacy.test.ts` „erweitert die Sicht im Buendnis", die
    // nur die Haelfte b faehrt.
    expect(visibleProvinces(state, 'p2').size).toBeGreaterThan(vorher.p2)
    expect(visibleProvinces(state, 'p1').size).toBe(vorher.p1)
  })
})

describe('T-M17-03 Die Ueberfallerkennung fragt den Besitzer der Provinz', () => {
  it('Haelfte a: p1 laesst p2 durch — p2 in p1s Land ist kein Ueberfall, p1 in p2s Land schon', () => {
    const gewaehrt = frisch()
    beziehung(gewaehrt).aGrantsPassage = true
    placeArmy(gewaehrt, { owner: 'p2', at: 'n1', units: [{ unitKey: 'infantry', hpTotal: 5_000 }] })
    expect(beziehung(step(gewaehrt, [], ctx).state).state).toBe('peace')

    const umgekehrt = frisch()
    beziehung(umgekehrt).aGrantsPassage = true
    placeArmy(umgekehrt, { owner: 'p1', at: 'o1', units: [{ unitKey: 'infantry', hpTotal: 5_000 }] })
    expect(beziehung(step(umgekehrt, [], ctx).state).state).toBe('war')
  })

  it('Haelfte b: p2 laesst p1 durch — p1 in p2s Land ist kein Ueberfall, p2 in p1s Land schon', () => {
    const gewaehrt = frisch()
    beziehung(gewaehrt).bGrantsPassage = true
    placeArmy(gewaehrt, { owner: 'p1', at: 'o1', units: [{ unitKey: 'infantry', hpTotal: 5_000 }] })
    expect(beziehung(step(gewaehrt, [], ctx).state).state).toBe('peace')

    const umgekehrt = frisch()
    beziehung(umgekehrt).bGrantsPassage = true
    placeArmy(umgekehrt, { owner: 'p2', at: 'n1', units: [{ unitKey: 'infantry', hpTotal: 5_000 }] })
    expect(beziehung(step(umgekehrt, [], ctx).state).state).toBe('war')
  })
})

describe('T-M17-03 Die Frist eines Durchmarschs gilt bis zu ihrem Tick, nicht darueber', () => {
  for (const { name, handelnd, anderer } of HAELFTEN) {
    it(`gilt bei tick = Frist - 1 und nicht mehr bei tick = Frist — ${name} gewaehrt`, () => {
      const state = frisch()
      const frist = 500
      const relation = beziehung(state)
      if (handelnd < anderer) {
        relation.aGrantsPassage = true
        relation.aPassageEndsAtTick = frist
      } else {
        relation.bGrantsPassage = true
        relation.bPassageEndsAtTick = frist
      }

      state.tick = frist - 1
      expect(grantsPassage(state, handelnd, anderer)).toBe(true)
      expect(grantsPassage(state, anderer, handelnd), 'die Gegenrichtung ist nicht gewaehrt').toBe(false)

      state.tick = frist
      expect(grantsPassage(state, handelnd, anderer)).toBe(false)
    })
  }

  it('ohne Frist gilt das Recht unbefristet, und die Karte kennt keine Frist', () => {
    const state = frisch()
    beziehung(state).bGrantsPassage = true
    beziehung(state).bSharesMap = true
    state.tick = 1_000_000

    expect(grantsPassage(state, 'p2', 'p1')).toBe(true)
    expect(sharesMap(state, 'p2', 'p1')).toBe(true)
    expect(sharesMap(state, 'p1', 'p2')).toBe(false)
  })
})
