import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { runAi, storeMemories } from '@worldwar/ai'
import { RESOURCE_KEYS, createInitialState, parseRules, runTicks, type MapData, type Rules } from '@worldwar/core'
import { DEFAULT_NEW_GAME, toConfig } from '../../desktop/src/game/newGame'

/**
 * The long run (R-ARCH-06, acceptance criterion 6). Slow suite only.
 *
 * A thousand game days with everything switched on. What this catches is not a wrong
 * number but a slow rot: an event log that grows without bound, memory that never gets
 * released, a rule that only misbehaves after the four-hundredth day.
 *
 * Until 2026-09-08 this ran the 12-province test map with THREE players — while AK-6
 * reads, verbatim, "1000 Spieltage, 8 Spieler". The same failure class as R-AI-04
 * being measured on the wrong map (PROBLEME.md, 2026-09-06): the criterion looked
 * covered because *a* long run existed, not *the* long run it names. It surfaced the
 * day the acceptance script started calling this file by name and its seven-second
 * runtime became visible. Now it plays the SHIPPED default setup — the same world,
 * the same eight powers a player gets on first start — and pins those conditions
 * with assertions so they cannot silently shrink again.
 */
const ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const load = (path: string) => JSON.parse(readFileSync(`${ROOT}/${path}`, 'utf8')) as never

const rules: Rules = parseRules(
  {
    constants: load('data/rules/default/constants.json'),
    resources: load('data/rules/default/resources.json'),
    buildings: load('data/rules/default/buildings.json'),
    units: load('data/rules/default/units.json'),
    ai: load('data/rules/default/ai.json'),
  },
  'default',
)
const map = load('data/maps/world.json') as MapData
const ctx = { map, rules }

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
  it('laeuft in der ausgelieferten Aufstellung fehlerfrei und ohne unbegrenztes Wachstum durch', async () => {
    const days = 1000
    const ticks = days * rules.constants.ticksPerDay

    // Die ausgelieferte Voreinstellung — dieselbe Partie wie beim ersten Start und
    // wie im AK-1-Test. Alle Plaetze KI-besetzt: der Lauf ist kopflos.
    const config = toConfig({ ...DEFAULT_NEW_GAME, seed: 31337 }, map)
    const aiConfig = { ...config, players: config.players.map((p) => ({ ...p, kind: 'ai' as const })) }

    // AK-6 beim Wort genommen — und festgenagelt, damit die Bedingungen nie wieder
    // still schrumpfen: 8 Spieler, die Weltkarte, 1000 Tage.
    expect(aiConfig.players).toHaveLength(8)
    expect(map.provinces.length).toBeGreaterThanOrEqual(200)

    let state = createInitialState(aiConfig, ctx)

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
        `Lauf: ${days} Spieltage (${ticks} Ticks), ${aiConfig.players.length} KI-Spieler, Weltkarte (${map.provinces.length} Provinzen) — die ausgelieferte Voreinstellung.`,
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
