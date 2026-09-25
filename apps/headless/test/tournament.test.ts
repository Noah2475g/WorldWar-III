import { TEST_RULES, smallWorld } from '@worldwar/testkit'
import { describe, expect, it } from 'vitest'
import { playMatch, playTournament } from '../src/tournament'

/**
 * Difficulty is a claim that has to be measured (R-AI-06, T-M7-05).
 *
 * The short form runs in the normal suite; the full fifty-match tournament lives in
 * tournament.slow.test.ts, because `pnpm verify` runs after every task and has to
 * stay usable.
 */
const map = smallWorld()
const rules = TEST_RULES

describe('R-AI-06 KI gegen KI', () => {
  it('spielt eine Partie bis zu einem Ergebnis', () => {
    const result = playMatch({ map, rules, seed: 7, difficulties: ['normal', 'normal'], days: 30 })
    expect(result.ticks).toBeGreaterThan(0)
    expect(result.scores['p1']).toBeGreaterThan(0)
    expect(['victory', 'timeLimit']).toContain(result.reason)
  })

  it('liefert bei gleichem Seed dasselbe Ergebnis', () => {
    const a = playMatch({ map, rules, seed: 11, difficulties: ['hard', 'easy'], days: 20 })
    const b = playMatch({ map, rules, seed: 11, difficulties: ['hard', 'easy'], days: 20 })
    expect(a.scores).toEqual(b.scores)
    expect(a.winner).toBe(b.winner)
  })

  it('wertet paarweise, damit die Startposition nicht entscheidet', () => {
    // **Am 2026-09-06 umgestellt (T-M15-05).** Vorher tauschte das Turnier zwar die
    // Seiten, wertete aber jede Partie einzeln — und maß damit die Startaufstellung der
    // Testkarte statt der Spielstärke: „schwer gegen normal" endete exakt 25:25, weil in
    // allen 50 Partien die *erste Nation* gewann. Gewertet wird jetzt das Paar aus Hin-
    // und Rückpartie desselben Seeds; die Position fällt heraus.
    const result = playTournament({ map, rules, difficulties: ['hard', 'easy'], matches: 4, days: 20 })

    expect(result.matches).toBe(4)
    expect(result.winsA + result.winsB + result.draws, 'zwei Paare, zwei Wertungen').toBe(2)
    expect(result.winRateA).toBeGreaterThanOrEqual(0)
    expect(result.winRateA).toBeLessThanOrEqual(1)
  })

  // Befund M17-D9 (T-M17-10, gemessen 2026-09-25): B6 ("Antrag statt Marsch") behebt genau die
  // Ueberfaelle, die dieser Test bis hierhin gemessen hat. Vor T-M17-10 marschierten Armeen
  // ungeprueft durch fremdes Land, und `detectSurpriseAttacks` meldete das als WAR_DECLARED
  // (withoutDeclaration) — das war die Quelle der "6 Kriegserklaerungen" bei 40/80/120/200
  // Tagen (schwer gegen normal, Testwelt, seed der Paarung). Nach T-M17-10: 0 Kriegserklaerungen
  // bei denselben Tagen, UND 0 bei 300 Tagen ueber 8 verschiedene Seeds (Wegwerflauf, nicht
  // committet) — die "echte" diplomatische Kriegserklaerung (declareWar aus Verstimmung,
  // diplomacy.ts, seit vor M17) loest auf dieser kleinen Testwelt in der Paarung "schwer gegen
  // normal" offenbar so gut wie nie aus. Ob das an der Testwelt liegt (zwei Maechte, kurze
  // Grenzen) oder an der Schwelle selbst, ist eine eigene Untersuchung (ausserhalb T-M17-10,
  // vgl. T-M17-15 "Integrationstor") — hier nur festgehalten, nicht behoben (Falle 8: nicht
  // die Zusicherung "biegen", bis sie wieder passt).
  it.todo('zaehlt Kriegserklaerung und Beschuss je Stufe nach dem Handelnden (T-M41-08, Befund M17-D9: misst seit T-M17-10 durchgehend 0)')

  it('haelt die Zuordnung nach Stufe konsistent, auch wenn nichts geschieht (Befund M17-D9)', () => {
    const result = playTournament({ map, rules, difficulties: ['hard', 'normal'], matches: 2, days: 40, startAtWar: false })
    const handelnd = result.byDifficulty

    // Ist-Stand seit T-M17-10 (Befund M17-D9): keine Kriegserklaerung, kein Beschuss in dieser
    // Paarung. Die Summenbildung je Stufe bleibt trotzdem richtig (0 + 0 = 0), das ist der
    // Kern von T-M41-08 und haelt unabhaengig davon, ob ueberhaupt etwas geschieht.
    expect(handelnd.hard.warDeclarations + handelnd.normal.warDeclarations).toBe(result.warDeclarations.hard)
    expect(handelnd.hard.automaticBombardments + handelnd.normal.automaticBombardments).toBe(
      result.automaticBombardments.hard,
    )
    expect(handelnd.easy).toEqual({ warDeclarations: 0, automaticBombardments: 0 })
  })
})
