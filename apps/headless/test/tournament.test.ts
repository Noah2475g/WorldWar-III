import { advanceTicks } from '@worldwar/ai'
import { createInitialState, type GameConfig } from '@worldwar/core'
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
  // normal" offenbar so gut wie nie aus.
  //
  // Berichtigt (Nacharbeit ki, 2026-09-25), erneut berichtigt (Nacharbeit Turnier M17, Option C,
  // 2026-09-25, bis dahin): NICHT die fehlende Landnachbarschaft — m1 (Nachbar von n2, Nordlands
  // eigener Provinz) fiel Ostmark unterwegs zu, und `landNeighbours()` war zu dem Zeitpunkt also
  // nicht leer. Die eigentliche Ursache war das Verhaeltnis selbst: ohne B6-Ueberfaelle entstanden
  // keine Verstimmungen, und `relationship()` blieb ueber der Kriegsschwelle. Mit Option C erklaert
  // Nordland an genau diesem veralteten Ziel jetzt foermlich den Krieg (`staleTargetDeclarations`,
  // Test unten) — die "0 Kriegserklaerungen" von M17-D9 sind damit ueberholt.
  it('zaehlt Kriegserklaerung und Beschuss je Stufe nach dem Handelnden (T-M41-08)', () => {
    const result = playTournament({ map, rules, difficulties: ['hard', 'normal'], matches: 2, days: 40, startAtWar: false })
    const handelnd = result.byDifficulty

    expect(handelnd.hard.warDeclarations).toBeGreaterThan(0)
    expect(handelnd.normal.warDeclarations).toBeGreaterThan(0)
    expect(handelnd.hard.warDeclarations + handelnd.normal.warDeclarations).toBe(result.warDeclarations.hard)
  })

  /**
   * Nacharbeit Turnier M17, Option C (2026-09-25, loest M17-D9 ab): m1 faellt Ostmark unterwegs
   * zu (wie vor Option C), aber die Armee stolpert nicht mehr hinein — sie erklaert Ostmark
   * foermlich den Krieg und haelt an, bis die Erklaerung wirkt (`staleTargetDeclarations`,
   * `packages/ai/src/passage.ts`, Noahs Entscheid zu Befund M17-T5).
   */
  it('erklaert foermlich, statt zu stolpern, sobald m1 Ostmark zufaellt (Option C, loest M17-D9 ab)', () => {
    for (let seed = 1; seed <= 3; seed++) {
      const config: GameConfig = {
        seed,
        mapId: map.id,
        rulesId: rules.id,
        players: [
          { name: 'A', kind: 'ai', nation: 'Nordland', color: '#111', difficulty: 'hard' },
          { name: 'B', kind: 'ai', nation: 'Ostmark', color: '#222', difficulty: 'normal' },
        ],
        victory: { condition: 'points', pointsShareToWin: 900, dayLimit: 40 },
      }
      const state = createInitialState(config, { map, rules })
      const run = advanceTicks(state, 40 * rules.constants.ticksPerDay, { map, rules })

      const wars = run.events.filter((e) => e.type === 'WAR_DECLARED')
      expect(wars.length, `seed ${seed}`).toBeGreaterThan(0)
      for (const war of wars) {
        expect(war.withoutDeclaration, `seed ${seed}: ${JSON.stringify(war)}`).toBe(false)
      }
      expect(wars[0], `seed ${seed}`).toMatchObject({ playerId: 'p1', targetPlayerId: 'p2' })
    }
  })

  // Ist-Stand vor Option C (bis 2026-09-25, Befund M17-D9): keine Kriegserklaerung, kein Beschuss
  // in dieser Paarung. Seit Option C erklaert Nordland foermlich (Test oben); die Summenbildung
  // je Stufe bleibt trotzdem richtig, das ist der Kern von T-M41-08.
  it('haelt die Zuordnung nach Stufe konsistent, auch wenn etwas geschieht (Befund M17-D9)', () => {
    const result = playTournament({ map, rules, difficulties: ['hard', 'normal'], matches: 2, days: 40, startAtWar: false })
    const handelnd = result.byDifficulty

    expect(handelnd.hard.warDeclarations + handelnd.normal.warDeclarations).toBe(result.warDeclarations.hard)
    expect(handelnd.hard.automaticBombardments + handelnd.normal.automaticBombardments).toBe(
      result.automaticBombardments.hard,
    )
    expect(handelnd.easy).toEqual({ warDeclarations: 0, automaticBombardments: 0, formalWarDeclarations: 0 })
  })
})

/**
 * Nacharbeit Turnier M17, Option D (Befund M17-T4, Noahs Entscheid zu M17-T5): das Turnier
 * spielt auf der Testwelt mit allen drei Maechten in drei Sitzordnungen reihum, der Dritte als
 * Fueller. Diese schnellen Faelle pruefen nur die neuen Optionen selbst; die Streuung (§1 des
 * Bauplans) misst `tournament.slow.test.ts`.
 */
describe('R-AI-06 Drei Maechte reihum (Plan D)', () => {
  it('spielt mit drei Maechten und wertet nur die beiden Streiter (Plan D)', () => {
    const result = playMatch({
      map,
      rules,
      seed: 7,
      difficulties: ['hard', 'normal'],
      days: 10,
      nations: ['Nordland', 'Ostmark', 'Sueden'],
    })

    expect(Object.keys(result.byPlayer).sort()).toEqual(['p1', 'p2'])
    expect(Object.keys(result.scores).sort()).toEqual(['p1', 'p2'])
    expect(result.surpriseAttacks).toBeGreaterThanOrEqual(0)
  })

  it('verteilt die Paare auf die Aufstellungen (Plan D)', () => {
    const result = playTournament({
      map,
      rules,
      difficulties: ['hard', 'normal'],
      matches: 6,
      days: 10,
      startAtWar: false,
      setups: [
        ['Nordland', 'Ostmark', 'Sueden'],
        ['Ostmark', 'Sueden', 'Nordland'],
        ['Sueden', 'Nordland', 'Ostmark'],
      ],
    })

    expect(result.matches).toBe(6)
    expect(result.winsA + result.winsB + result.draws).toBe(3)
    expect(Object.values(result.winsByNation).reduce((sum, n) => sum + n, 0)).toBeLessThanOrEqual(6)
    expect(result.outcomes).toBeGreaterThanOrEqual(1)
    expect(result.outcomes).toBeLessThanOrEqual(6)
  })

  it('S1 - bySetup je Sitzordnung, und die Teile addieren sich zur Summe (T-M17-15)', () => {
    const DREI = [
      ['Nordland', 'Ostmark', 'Sueden'],
      ['Ostmark', 'Sueden', 'Nordland'],
      ['Sueden', 'Nordland', 'Ostmark'],
    ]
    const result = playTournament({
      map,
      rules,
      difficulties: ['hard', 'normal'],
      matches: 6,
      days: 10,
      startAtWar: false,
      setups: DREI,
    })

    expect(Object.keys(result.bySetup)).toEqual(['Nordland/Ostmark/Sueden', 'Ostmark/Sueden/Nordland', 'Sueden/Nordland/Ostmark'])

    let summeWinsA = 0
    let summeWinsB = 0
    let summeDraws = 0
    for (const [schluessel, eintrag] of Object.entries(result.bySetup)) {
      expect(eintrag.winsA + eintrag.winsB + eintrag.draws, `${schluessel}: ein Paar je Sitzordnung`).toBe(1)
      expect(eintrag.winRateA, schluessel).toBe((eintrag.winsA + eintrag.draws / 2) / 1)
      summeWinsA += eintrag.winsA
      summeWinsB += eintrag.winsB
      summeDraws += eintrag.draws
    }
    expect(summeWinsA).toBe(result.winsA)
    expect(summeWinsB).toBe(result.winsB)
    expect(summeDraws).toBe(result.draws)
  })

  it('S2 - ohne Aufstellung ein Eintrag in bySetup, gleich den Summenfeldern (T-M17-15)', () => {
    const result = playTournament({ map, rules, difficulties: ['hard', 'easy'], matches: 4, days: 20 })
    expect(Object.keys(result.bySetup)).toEqual(['Nordland/Ostmark'])
    const eintrag = result.bySetup['Nordland/Ostmark']!
    expect(eintrag).toEqual({ winsA: result.winsA, winsB: result.winsB, draws: result.draws, winRateA: result.winRateA })
  })

  it('verlangt, dass die Paare sich auf die Aufstellungen teilen lassen', () => {
    expect(() =>
      playTournament({
        map,
        rules,
        difficulties: ['hard', 'normal'],
        matches: 4,
        days: 10,
        startAtWar: false,
        setups: [
          ['Nordland', 'Ostmark', 'Sueden'],
          ['Ostmark', 'Sueden', 'Nordland'],
          ['Sueden', 'Nordland', 'Ostmark'],
        ],
      }),
    ).toThrow()
  })

  it('lehnt eine unbekannte Nation ab', () => {
    expect(() =>
      playMatch({ map, rules, seed: 1, difficulties: ['hard', 'normal'], days: 10, nations: ['Nordland', 'Atlantis'] }),
    ).toThrow()
  })

  it('bleibt ohne Aufstellung bitgleich (Plan D)', () => {
    const ohne = playTournament({ map, rules, difficulties: ['hard', 'easy'], matches: 4, days: 20 })
    const mitEinerAufstellung = playTournament({
      map,
      rules,
      difficulties: ['hard', 'easy'],
      matches: 4,
      days: 20,
      setups: [['Nordland', 'Ostmark']],
    })

    expect(mitEinerAufstellung).toEqual(ohne)
  })
})
