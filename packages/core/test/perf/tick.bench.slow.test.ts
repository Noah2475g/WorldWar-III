import { runAi, storeMemories } from '@worldwar/ai'
import { runTicks } from '@worldwar/core'
import { TEST_RULES, placeArmy, smallWorld } from '@worldwar/testkit'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createInitialState, type GameConfig } from '../../src/state/create'

/**
 * Performance budgets (R-ARCH-06, R-AI-04).
 *
 * A benchmark that only prints numbers proves nothing — this one asserts. The measured
 * values are written to docs/reports so a regression can be compared against history
 * rather than against memory.
 *
 * Note on the numbers: R-ARCH-06/AK1 is measured on the *shipped* world map, and the
 * test that certifies it lives in worldmap.bench.slow.test.ts. This map has twelve
 * provinces — a twentieth of the real one — so the numbers here certify nothing about
 * the requirement; they catch an order-of-magnitude regression early, on a map small
 * enough to be fast. Until 2026-09-06 this file asserted the requirement's own figures
 * on twelve provinces and was green at 0.04 ms, which is how a budget breached by a
 * factor of five stayed invisible for a milestone.
 *
 * This runs in the slow suite (`pnpm bench`), on its own. Timing a simulation while
 * thirty other test files run in parallel measures the machine's load, not the code.
 */
const map = smallWorld()
const rules = TEST_RULES
const ctx = { map, rules }

const CONFIG: GameConfig = {
  seed: 999,
  mapId: 'testworld',
  rulesId: 'default',
  players: [
    { name: 'A', kind: 'ai', nation: 'Nordland', color: '#0f62bc', difficulty: 'hard' },
    { name: 'B', kind: 'ai', nation: 'Ostmark', color: '#b03a2e', difficulty: 'hard' },
    { name: 'C', kind: 'ai', nation: 'Sueden', color: '#2e7d32', difficulty: 'normal' },
  ],
  victory: { condition: 'points', pointsShareToWin: 950, dayLimit: null },
}

function loaded() {
  const state = createInitialState(CONFIG, ctx)
  state.diplomacy.relations['p1|p2']!.state = 'war'
  for (let i = 0; i < 12; i++) {
    placeArmy(state, {
      owner: i % 2 === 0 ? 'p1' : 'p2',
      at: i % 3 === 0 ? 'm1' : i % 3 === 1 ? 'n2' : 'o3',
      units: [{ unitKey: i % 2 === 0 ? 'infantry' : 'tank', hpTotal: 20_000 }],
    })
  }
  return state
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

describe('R-ARCH-06 Rechenzeit je Tick', () => {
  it('bleibt im Budget und schreibt den Messwert', () => {
    const samples: number[] = []
    let state = loaded()

    // Warm-up, so the first measurements are not dominated by JIT compilation.
    state = runTicks(state, 200, ctx).state

    for (let i = 0; i < 500; i++) {
      const before = performance.now()
      state = runTicks(state, 1, ctx).state
      samples.push(performance.now() - before)
    }

    const tickMedian = median(samples)
    const p99 = [...samples].sort((a, b) => a - b)[Math.floor(samples.length * 0.99)] ?? 0

    // Geschrieben wird in eine EIGENE Datei: ai-bench.json gehoert seit T-M16-02 der
    // Messung auf der Weltkarte, und zwei Schreiber auf eine Datei sind ein Bericht,
    // der davon abhaengt, wer zuletzt lief.
    const dir = fileURLToPath(new URL('../../../../docs/reports/', import.meta.url))
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      `${dir}tick-bench.json`,
      `${JSON.stringify({ provinces: map.provinces.length, armies: 12, tickMedianMs: tickMedian, tickP99Ms: p99 }, null, 2)}\n`,
    )

    // Twelve provinces: a local guard rail, not the requirement (see the file comment).
    // The tail is measured while the rest of the suite runs in parallel, so it gets a
    // wider allowance than the median — a regression shows up in the median first.
    expect(tickMedian).toBeLessThan(0.5)
    expect(p99).toBeLessThan(2)
  })
})

/**
 * Ein Gelaender, keine Zusicherung (T-M16-02).
 *
 * Dieser Block hiess bis zum 2026-09-07 "bleibt unter dreissig Prozent der Tickzeit"
 * und sicherte fuenfzig zu. Beides war falsch: der Titel nannte die Zahl der
 * Anforderung, die Zusicherung liess das Anderthalbfache davon durch, und gemessen
 * wurde auf zwoelf Provinzen mit drei Maechten, waehrend R-AI-04 acht KI-Spieler sagt.
 *
 * R-AI-04 wird jetzt dort gemessen, wo es gilt: `worldmap.bench.slow.test.ts`, 237
 * Provinzen, acht KI-Maechte. Was hier bleibt, faengt einen Rueckschritt um eine
 * Groessenordnung frueh ab und belegt die Anforderung nicht — derselbe Vermerk wie im
 * Nachbarblock.
 *
 * Die Zahlen auseinanderzuhalten lohnt sich: auf der kleinen Karte liegt der Anteil bei
 * rund 0,46, auf der Weltkarte bei 0,074. Nicht weil die KI dort billiger waere, sondern
 * weil der Tick teurer ist — der Anteil ist ein Quotient, und beide Seiten wachsen
 * verschieden. Wer die 0,46 als "knapp an der Grenze" liest, liest eine Zahl ueber die
 * Testkarte als Aussage ueber das Spiel.
 */
describe('KI-Rechenzeit auf der kleinen Karte (Gelaender, nicht R-AI-04)', () => {
  it('bleibt in derselben Groessenordnung wie die Tickzeit', () => {
    let state = loaded()
    state = runTicks(state, 100, ctx).state

    const aiSamples: number[] = []
    const tickSamples: number[] = []

    for (let i = 0; i < 300; i++) {
      const beforeAi = performance.now()
      const { commands, memories } = runAi(state, ctx)
      aiSamples.push(performance.now() - beforeAi)

      const beforeTick = performance.now()
      state = runTicks(state, 1, ctx, () => commands).state
      tickSamples.push(performance.now() - beforeTick)
      storeMemories(state, memories)
    }

    const aiMedian = median(aiSamples)
    const tickMedian = median(tickSamples)
    const share = aiMedian / Math.max(0.0001, aiMedian + tickMedian)

    const dir = fileURLToPath(new URL('../../../../docs/reports/', import.meta.url))
    writeFileSync(
      `${dir}ai-bench-smallmap.json`,
      `${JSON.stringify({ aiMedianMs: aiMedian, tickMedianMs: tickMedian, share: Number(share.toFixed(3)),
        // Die Bedingungen gehoeren in die Datei, sonst liest die naechste Person den
        // Anteil als erfuellte Anforderung: R-AI-04 verlangt acht KI-Maechte, hier
        // stehen drei auf zwoelf Provinzen.
        provinces: map.provinces.length, players: CONFIG.players.length,
        certifies: 'nichts - Gelaender gegen Rueckschritte. R-AI-04 wird in docs/reports/ai-bench.json belegt (Weltkarte, acht KI-Maechte, T-M16-02).',
      }, null, 2)}\n`,
    )

    // Gemessen wird die ABSOLUTE KI-Zeit, nicht der Anteil (T-M16-02).
    //
    // Der Anteil taugt hier nicht als Gelaender: auf zwoelf Provinzen brauchen KI und
    // Tick beide rund 0,065 ms, der Quotient liegt also von Natur aus bei 0,5 und
    // schwankt mit jeder Messung. Gemessen 0,487 gegen eine Grenze von 0,5 — das sind
    // 2,6 % Reserve, und ein Gelaender, das zufaellig reisst, kostet genau die
    // Untersuchung, die es sparen soll. Am 2026-09-06 hat das Tickbudget diese Lektion
    // schon einmal erteilt.
    //
    // Das ist KEINE Lockerung: die Zusicherung, die R-AI-04 vertritt, steht seit heute
    // in worldmap.bench.slow.test.ts und ist mit 0,30 strenger als die 0,5 hier je
    // waren. Was hier bleibt, soll einen Rueckschritt um eine Groessenordnung fangen —
    // und dafuer ist die absolute Zeit die richtige Groesse. Gemessen 0,064 ms.
    expect(aiMedian, `KI-Median ${aiMedian.toFixed(4)} ms`).toBeLessThan(0.5)
  })
})
