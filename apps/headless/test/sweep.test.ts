import { TEST_RULES, smallWorld } from '@worldwar/testkit'
import { describe, expect, it } from 'vitest'
import { SWING_THRESHOLD, playOut, sweep, sweepableConstants, withConstant } from '../src/sweep'

/**
 * The balance tool (T-M12-00, R-AI-06).
 *
 * Tested on the small map: what is under test is the tool, not the balance. The real
 * sweep runs against the world map in the slow suite, because varying fifty constants
 * over several seeds is minutes of play, not seconds.
 */

const map = smallWorld()
const rules = TEST_RULES

describe('R-AI-06 Das Werkzeug misst, was eine Konstante bewirkt', () => {
  it('spielt eine Partie aus und beschreibt sie in Zahlen', () => {
    const result = playOut(map, rules, 3, 20, 7)

    expect(result.leaderShare).toBeGreaterThan(0)
    expect(result.leaderShare).toBeLessThanOrEqual(1)
    expect(result.survivors).toBeGreaterThan(0)
    expect(result.days).toBeGreaterThan(0)
  })

  it('spielt bei gleichem Seed dieselbe Partie', () => {
    // Without this the whole tool is noise: a difference between two variants could
    // just as well be a difference between two random games.
    expect(playOut(map, rules, 3, 15, 42)).toEqual(playOut(map, rules, 3, 15, 42))
  })

  it('spielt bei anderem Seed eine andere Partie', () => {
    const a = playOut(map, rules, 3, 40, 1)
    const b = playOut(map, rules, 3, 40, 2)

    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b))
  })

  it('variiert eine Konstante, ohne die anderen anzufassen', () => {
    const changed = withConstant(rules, 'battleRate', 1.25)

    expect(changed.constants.battleRate).toBeGreaterThan(rules.constants.battleRate)
    expect(changed.constants.startMorale).toBe(rules.constants.startMorale)
    // And the original is untouched — a sweep that mutates its input measures itself.
    expect(rules.constants.battleRate).not.toBe(changed.constants.battleRate)
  })

  it('laesst eine unbekannte Konstante das Regelwerk unveraendert', () => {
    expect(withConstant(rules, 'gibtEsNicht', 2)).toBe(rules)
  })

  it('findet die variierbaren Konstanten', () => {
    const names = sweepableConstants(rules)

    expect(names.length).toBeGreaterThan(20)
    expect(names).toContain('battleRate')
    // The comment field is not a constant.
    expect(names).not.toContain('_comment')
  })

  it('meldet je Konstante Ausschlag und ob sie den Ausgang traegt', () => {
    const effects = sweep({ map, rules, players: 3, days: 12, seeds: [11] }, ['battleRate', 'startMorale'])

    expect(effects).toHaveLength(2)
    for (const effect of effects) {
      expect(effect.swing).toBeGreaterThanOrEqual(0)
      expect(effect.loadBearing).toBe(effect.swing >= SWING_THRESHOLD)
      expect(effect.baseline.leaderShare).toBeGreaterThan(0)
    }
  })

  it('sortiert die wirksamsten Konstanten nach oben', () => {
    const effects = sweep({ map, rules, players: 3, days: 12, seeds: [3] }, ['battleRate', 'startMorale', 'minDamage'])

    for (let i = 1; i < effects.length; i++) {
      expect(effects[i - 1]!.swing).toBeGreaterThanOrEqual(effects[i]!.swing)
    }
  })
})

/**
 * Die Messgeräte selbst (T-M14-05, Ursache E des Audits).
 *
 * Ein Werkzeug, das das Falsche misst, ist schlimmer als keines: es liefert Zahlen, und
 * Zahlen werden geglaubt. `playOut` zählte die Eroberungen aus `state.eventLog` — einem
 * Ringpuffer von 500 Einträgen, der bei rund 12.300 Ereignissen je Partie die letzten paar
 * Spieltage abdeckt. Der Bericht meldete deshalb 3 Eroberungen, wo 49 stattgefunden hatten,
 * und die eingebaute Warnung „keine Eroberung heißt, der Lauf hat nichts gemessen" konnte
 * nie auslösen.
 */
describe('R-AI-06 Die Messgeraete messen die Partie, nicht ihren Schwanz', () => {
  it('zaehlt die Eroberungen der ganzen Partie, nicht die des Ringpuffers', () => {
    // Gegengeprüft an der Sache selbst: wie viele Provinzen haben den Besitzer gewechselt?
    // Eine feste Zahl wäre wertlos — sie würde nur festhalten, was heute herauskommt.
    const lang = playOut(map, rules, 3, 120, 1914)

    expect(lang.captures, 'eine Partie ueber 120 Tage ohne Eroberung misst nichts').toBeGreaterThan(0)
    // Der Ringpuffer fasst 500 Ereignisse; eine Partie dieser Länge erzeugt ein Vielfaches.
    // Die Zählung darf davon nicht abhängen.
    expect(lang.captures).toBeGreaterThanOrEqual(playOut(map, rules, 3, 40, 1914).captures)
  })

  it('nennt die Endbestaende beim Namen, statt sie Produktion zu nennen', () => {
    // `economy` war als "Total resources produced" beschriftet und summierte Endbestände.
    // Eine Beschriftung, die etwas anderes verspricht als sie misst, ist eine Falschaussage
    // mit Zahl daran.
    const result = playOut(map, rules, 3, 20, 7)
    expect(result.stockpile).toBeGreaterThan(0)
    expect('economy' in result, 'die alte, falsch beschriftete Groesse ist weg').toBe(false)
  })
})
