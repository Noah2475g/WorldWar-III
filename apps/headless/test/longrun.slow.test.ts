import { runAi, storeMemories } from '@worldwar/ai'
import { RESOURCE_KEYS, createInitialState, runTicks, type GameConfig } from '@worldwar/core'
import { TEST_RULES, smallWorld } from '@worldwar/testkit'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * The long run (R-ARCH-06, acceptance criterion 6). Slow suite only.
 *
 * A thousand game days with everything switched on. What this catches is not a wrong
 * number but a slow rot: an event log that grows without bound, memory that never gets
 * released, a rule that only misbehaves after the four-hundredth day.
 */
const map = smallWorld()
const rules = TEST_RULES
const ctx = { map, rules }

const CONFIG: GameConfig = {
  seed: 31337,
  mapId: 'testworld',
  rulesId: 'default',
  players: [
    { name: 'A', kind: 'ai', nation: 'Nordland', color: '#0f62bc', difficulty: 'hard' },
    { name: 'B', kind: 'ai', nation: 'Ostmark', color: '#b03a2e', difficulty: 'normal' },
    { name: 'C', kind: 'ai', nation: 'Sueden', color: '#2e7d32', difficulty: 'easy' },
  ],
  victory: { condition: 'points', pointsShareToWin: 950, dayLimit: null },
}

/**
 * Gibt die Ereignisschleife zwischen den Spieltagen frei.
 *
 * Eine Simulation ist ein synchroner Block, und wer laenger als eine Minute in einem
 * steckt, beantwortet dem Testlaeufer nichts mehr — der haelt den Arbeitsprozess fuer
 * haengengeblieben und laesst den Lauf scheitern, obwohl jede Zusicherung darin
 * durchgeht. Eine Umdrehung der Schleife je Spieltag ist die ganze Abhilfe.
 */
const breathe = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

describe('Abnahmekriterium 6: Langlauf ueber 1000 Spieltage', () => {
  it('laeuft fehlerfrei und ohne unbegrenztes Wachstum durch', async () => {
    const days = 1000
    const ticks = days * rules.constants.ticksPerDay

    let state = createInitialState(CONFIG, ctx)
    state.diplomacy.relations['p1|p2']!.state = 'war'

    const started = performance.now()
    let ended = 0
    // Die Atempausen zaehlen nicht zur Rechenzeit: sonst misst der Bericht, wie oft
    // die Schleife freigegeben wurde, statt wie schnell der Kern rechnet.
    let paused = 0

    for (let i = 0; i < ticks; i++) {
      const { commands, memories } = runAi(state, ctx)
      state = runTicks(state, 1, ctx, () => commands).state
      storeMemories(state, memories)
      if (state.victory.winner !== null && ended === 0) ended = state.tick
      if (i % 240 === 239) {
        const idle = performance.now()
        await breathe()
        paused += performance.now() - idle
      }
    }

    const elapsed = performance.now() - started - paused

    // The event log is a ring buffer: it must not have grown into the save file.
    expect(state.eventLog.length).toBeLessThanOrEqual(500)

    // Stocks stay finite and non-negative for everyone, all the way through.
    for (const playerId of state.playerOrder) {
      for (const key of RESOURCE_KEYS) {
        const amount = state.players[playerId]!.resources[key]
        expect(Number.isSafeInteger(amount)).toBe(true)
        expect(amount).toBeGreaterThanOrEqual(0)
      }
    }

    // Every province still has a sane morale value after 24 000 ticks.
    for (const id of state.provinceOrder) {
      const morale = state.provinces[id]!.morale
      expect(morale).toBeGreaterThanOrEqual(0)
      expect(morale).toBeLessThanOrEqual(100_000)
    }

    const dir = fileURLToPath(new URL('../../../docs/reports/', import.meta.url))
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      `${dir}performance.md`,
      [
        '# Langlauf und Rechenzeit',
        '',
        `Lauf: ${days} Spieltage (${ticks} Ticks), drei KI-Spieler, Karte "Kleine Welt".`,
        '',
        `- Dauer gesamt: ${Math.round(elapsed)} ms`,
        `- Zeit je Tick inkl. KI: ${(elapsed / ticks).toFixed(3)} ms`,
        `- Ereignisprotokoll am Ende: ${state.eventLog.length} Einträge (Ringpuffer greift)`,
        `- Partie entschieden bei Tick: ${ended || 'nicht entschieden'}`,
        '',
        'Erzeugt von `apps/headless/test/longrun.slow.test.ts`.',
        '',
      ].join('\n'),
    )

    expect(state.tick).toBe(ticks)
  })
})
