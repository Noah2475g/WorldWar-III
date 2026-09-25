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
  // Berichtigt (Nacharbeit ki, 2026-09-25): NICHT die fehlende Landnachbarschaft — der Test
  // "haelt genau den Ausgangsbefund fest" unten misst, dass m1 (Nachbar von n2, Nordlands
  // eigener Provinz) nach der Partie durchgehend Ostmark gehoert; `landNeighbours()` ist zu
  // dem Zeitpunkt also nicht leer. Die eigentliche Ursache ist das Verhaeltnis selbst: ohne
  // B6-Ueberfaelle entstehen keine Verstimmungen, und `relationship()` bleibt ueber der
  // Kriegsschwelle (siehe `PROBLEME.md`, Befund M17-D9, berichtigt). Eine eigene Untersuchung
  // bleibt trotzdem noetig (ausserhalb T-M17-10, vgl. T-M17-15 "Integrationstor") — hier nur
  // festgehalten, nicht behoben (Falle 8: nicht die Zusicherung "biegen", bis sie wieder passt).
  it.todo('zaehlt Kriegserklaerung und Beschuss je Stufe nach dem Handelnden (T-M41-08, Befund M17-D9: misst seit T-M17-10 durchgehend 0)')

  /**
   * Nacharbeit ki (T-M17-10/11), Befund M17-D9 berichtigt: `landNeighbours()` haelt nicht
   * "immer leer", wie die vorige Fassung des Kommentars oben behauptete. m1 grenzt an n2
   * (Nordlands eigene Provinz, Kante `n2-m1` in `testworld.json`) — sobald Ostmark m1 haelt,
   * sind Nordland und Ostmark direkte Landnachbarn. Acht Partien, Frieden-Start, 40 Spieltage:
   * m1 UND m2 gehoeren am Ende durchgehend Ostmark, und trotzdem bleiben Kriegserklaerungen
   * und Verstimmungen bei null. Die Ursache liegt also im Verhaeltnis (keine Ueberfaelle →
   * keine Verstimmung → `relationship()` bleibt ueber der Kriegsschwelle), nicht in der
   * Kartentopologie.
   */
  it('haelt genau den Ausgangsbefund fest: m1 wird Landnachbar, aber ohne Verstimmung bleibt es beim Frieden (Befund M17-D9, berichtigt)', () => {
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

      // m1 grenzt an n2 (Nordland) — sobald m1 Ostmark gehoert, sind beide Landnachbarn.
      expect(run.state.provinces.m1!.owner, `seed ${seed}`).toBe('p2')
      expect(run.state.diplomacy.grievances.p1 ?? {}, `seed ${seed}`).toEqual({})
      expect(run.events.filter((e) => e.type === 'WAR_DECLARED')).toEqual([])
    }
  })

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
