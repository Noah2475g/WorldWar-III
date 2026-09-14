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

  it('zaehlt Kriegserklaerung und Beschuss je Stufe nach dem Handelnden (T-M41-08)', () => {
    // T-M15-08 versprach "neun Zahlen je Stufe". `warDeclarations` und `automaticBombardments`
    // zaehlen aber die ganze Partie fuer jede Stufe, die antritt — der Beschuss von "schwer" in
    // einer Partie gegen "leicht" stand damit auch bei "leicht". Wer je Stufe zusichern will,
    // muss wissen, wer erklaert und wer geschossen hat.
    const result = playTournament({ map, rules, difficulties: ['hard', 'normal'], matches: 2, days: 40, startAtWar: false })
    const handelnd = result.byDifficulty

    expect(handelnd.hard.warDeclarations + handelnd.normal.warDeclarations, 'nichts gemessen').toBeGreaterThan(0)
    // Jede Erklaerung gehoert genau einer Stufe; "schwer" tritt in jeder Partie an, also ist die
    // Partiesumme bei "schwer" die Summe beider Handelnden.
    expect(handelnd.hard.warDeclarations + handelnd.normal.warDeclarations).toBe(result.warDeclarations.hard)
    expect(handelnd.hard.automaticBombardments + handelnd.normal.automaticBombardments).toBe(
      result.automaticBombardments.hard,
    )
    expect(handelnd.easy).toEqual({ warDeclarations: 0, automaticBombardments: 0 })
  })
})
