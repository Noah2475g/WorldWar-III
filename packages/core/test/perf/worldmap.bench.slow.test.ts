import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { runAi, storeMemories } from '@worldwar/ai'
import { runTicks, validateMap, type MapData } from '@worldwar/core'
import { TEST_RULES } from '@worldwar/testkit'
import { describe, expect, it } from 'vitest'
import { createInitialState, type GameConfig } from '../../src/state/create'

/**
 * The core rules on the real world map (T-M9-04, R-ARCH-06).
 *
 * Everything before this measured the twelve-province test map. That map fits in a
 * cache line; the world map has 237 provinces, 658 edges and 24 nations, and a rule
 * that costs nothing on the small map can cost everything here. This is the run that
 * says whether the game is playable at all.
 *
 * Slow suite: timing a simulation while thirty other test files run in parallel
 * measures the machine's load, not the code.
 */

const ROOT = fileURLToPath(new URL('../../../..', import.meta.url))
const map = JSON.parse(readFileSync(`${ROOT}/data/maps/world.json`, 'utf8')) as MapData
// The shipped rules, parsed through the real loader — the same ones the game uses.
const rules = TEST_RULES
const ctx = { map, rules }

/** Twelve powers, half of them on the hardest setting — a busy world, not an idle one. */
const CONFIG: GameConfig = {
  seed: 1914,
  mapId: 'world',
  rulesId: 'default',
  players: map.startPositions.slice(0, 12).map((start, index) => ({
    name: start.nation,
    kind: 'ai' as const,
    nation: start.nation,
    color: ['#2C5F7C', '#7C3F2C', '#4A5D2C', '#5B3A6B', '#9FB2BE', '#C4A99C'][index % 6]!,
    difficulty: index % 2 === 0 ? ('hard' as const) : ('normal' as const),
  })),
  victory: { condition: 'points', pointsShareToWin: 950, dayLimit: null },
}

/**
 * Die Aufstellung, die R-AI-04 nennt: **acht** KI-Maechte auf der ausgelieferten Karte
 * (T-M16-02).
 *
 * Sie steht neben CONFIG und nicht statt ihr, und das ist keine Umstaendlichkeit: die
 * beiden Anforderungen widersprechen sich in der Spielerzahl. R-ARCH-06/AK1 sagt zwoelf
 * und hat seine 3,5 ms unter zwoelf gemessen; R-AI-04 sagt acht. Eine Aufstellung fuer
 * beide hiesse, eine der beiden Zahlen still auf andere Bedingungen umzustellen — genau
 * der Fehler, den T-M16-02 behebt.
 */
const AI_CONFIG: GameConfig = {
  ...CONFIG,
  players: map.startPositions.slice(0, 8).map((start, index) => ({
    name: start.nation,
    kind: 'ai' as const,
    nation: start.nation,
    color: ['#2C5F7C', '#7C3F2C', '#4A5D2C', '#5B3A6B', '#9FB2BE', '#C4A99C'][index % 6]!,
    difficulty: index % 2 === 0 ? ('hard' as const) : ('normal' as const),
  })),
}

function newGame(config: GameConfig = CONFIG) {
  const state = createInitialState(config, ctx)
  // A world at peace measures nothing: without war there are no battles, no movement
  // and no reason for the AI to think.
  const ids = state.playerOrder
  for (let i = 0; i + 1 < ids.length; i += 2) {
    const key = `${ids[i]}|${ids[i + 1]}`
    if (state.diplomacy.relations[key]) state.diplomacy.relations[key]!.state = 'war'
  }
  return state
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0
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

describe('R-ARCH-06 Die Weltkarte traegt die Kernregeln', () => {
  it('ist ueberhaupt eine gueltige Karte', () => {
    const result = validateMap(map)
    expect(result.ok, JSON.stringify(result.ok ? {} : result.errors.slice(0, 5))).toBe(true)
    expect(map.provinces.length).toBeGreaterThan(150)
  })

  it('R-ARCH-06/AK1 haelt das Tickbudget auf 237 Provinzen', () => {
    let state = newGame()
    const durations: number[] = []

    // 480 ticks: twenty game days, long enough for production, construction, movement
    // and the first battles to be in the measurement rather than just the warm-up.
    for (let tick = 0; tick < 480; tick++) {
      const started = performance.now()
      const { commands, memories } = runAi(state, ctx)
      const result = runTicks(state, 1, ctx, () => commands)
      state = result.state
      storeMemories(state, memories)
      durations.push(performance.now() - started)
    }

    const medianMs = Number(median(durations).toFixed(3))
    const p99Ms = Number(percentile(durations, 0.99).toFixed(3))

    // Die Anforderung, an der gemessen wird — eine Zahl, nicht zwei.
    //
    // Bis zum 2026-09-06 standen hier drei verschiedene: R-ARCH-06/AK1 forderte 0,5 ms,
    // dieser Test sicherte 8 ms zu (das Sechzehnfache — eine Erlaubnis, keine Prüfung),
    // und gemessen wurden 2,4 ms. Nachgerechnet trug die Anforderung ihre eigene Zahl
    // nicht: R-TIME-02 verlangt rund 100 Ticks je Sekunde, dafür genügen 10 ms je Tick.
    // Noahs Entscheidung (DECISIONS.md, 2026-09-06): die Anforderung wird auf einen
    // gemessenen Wert gesetzt — und die Zusicherung genau darauf, mit rund 1,5-facher
    // Reserve über der dreifach wiederholten Messung. Wer sie anhebt, muss erklären warum.
    const REQUIREMENT = { id: 'R-ARCH-06/AK1', medianMs: 3.5, p99Ms: 8, provinces: 237, players: 12 }
    const meets = medianMs < REQUIREMENT.medianMs && p99Ms < REQUIREMENT.p99Ms

    const report = {
      map: map.id,
      provinces: map.provinces.length,
      edges: map.edges.length,
      players: CONFIG.players.length,
      ticks: durations.length,
      medianMs,
      p99Ms,
      requirement: REQUIREMENT,
      meetsRequirement: meets,
      headroom: {
        median: Number((REQUIREMENT.medianMs / Math.max(0.001, medianMs)).toFixed(2)),
        p99: Number((REQUIREMENT.p99Ms / Math.max(0.001, p99Ms)).toFixed(2)),
      },
      note: meets
        ? `Eingehalten: ${medianMs} ms Median gegen ${REQUIREMENT.medianMs} ms gefordert, ${p99Ms} ms p99 gegen ${REQUIREMENT.p99Ms} ms.`
        : `Verfehlt: ${medianMs} ms Median gegen ${REQUIREMENT.medianMs} ms gefordert (Faktor ${(medianMs / REQUIREMENT.medianMs).toFixed(1)}).`,
      measuredAt: new Date().toISOString(),
    }
    mkdirSync(`${ROOT}/docs/reports`, { recursive: true })
    writeFileSync(`${ROOT}/docs/reports/worldmap-bench.json`, JSON.stringify(report, null, 2) + '\n')

    expect(report.medianMs, `Median ${report.medianMs} ms`).toBeLessThan(REQUIREMENT.medianMs)
    expect(report.p99Ms, `p99 ${report.p99Ms} ms`).toBeLessThan(REQUIREMENT.p99Ms)
  })

  it('laeuft tausend Spieltage ohne Fehler und ohne Speicherwuchs', async () => {
    let state = newGame()
    const ticksPerDay = rules.constants.ticksPerDay

    for (let day = 0; day < 1000; day++) {
      const { commands, memories } = runAi(state, ctx)
      const result = runTicks(state, ticksPerDay, ctx, () => commands)
      state = result.state
      storeMemories(state, memories)
      if (state.victory.winner !== null) break
      if (day % 10 === 9) await breathe()
    }

    expect(state.tick).toBeGreaterThan(0)
    // The event log is a ring buffer; if it ever grew without bound, a thousand days
    // would be where it showed.
    expect(state.eventLog.length).toBeLessThan(20_000)
    for (const province of Object.values(state.provinces)) {
      expect(Number.isFinite(province.morale), `${province.id} hat keine Moral mehr`).toBe(true)
    }
  })
})

/**
 * Das Rechenbudget der KI, unter den Bedingungen der Anforderung (T-M16-02, R-AI-04).
 *
 * Bis zum 2026-09-07 wurde R-AI-04 auf **zwoelf Provinzen mit drei Maechten** gemessen,
 * waehrend die Anforderung „bei 8 KI-Spielern" sagt. Der gemeldete Anteil war damit keine
 * Aussage ueber die Anforderung — weder eine gute noch eine schlechte. Dieselbe Diskrepanz
 * war fuer R-ARCH-06/AK1 einen Tag zuvor behoben und elf Zeilen darunter erneut begangen
 * worden.
 *
 * **Der Anteil allein ist nicht lesbar**, und deshalb stehen beide Mediane einzeln in der
 * Datei: `share = ki / (ki + tick)`. Die acht `visibleProvinces`-Laeufe von `updateIntel`
 * liegen im NENNER, also in der Tickzeit. Wird der Tick schneller, steigt der gemeldete
 * Anteil, obwohl das Spiel besser geworden ist — und umgekehrt. Wer nur den Quotienten
 * fortschreibt, kann „die KI wurde teurer" nicht von „der Tick wurde billiger" trennen.
 */
describe('R-AI-04 Das Rechenbudget der KI', () => {
  it('bleibt auf der Weltkarte mit acht KI-Maechten unter dreissig Prozent', () => {
    let state = newGame(AI_CONFIG)
    // Einlaufen, damit Produktion, Bau und die ersten Gefechte in der Messung liegen.
    for (let tick = 0; tick < 120; tick++) {
      const { commands, memories } = runAi(state, ctx)
      state = runTicks(state, 1, ctx, () => commands).state
      storeMemories(state, memories)
    }

    const aiSamples: number[] = []
    const tickSamples: number[] = []

    // 480 Ticks = 20 Spieltage, und ein Vielfaches von acht: die Maechte denken reihum
    // (jede jeden achten Tick), und eine Stichprobe, die nicht aufgeht, gewichtet die
    // Maechte ungleich, die zufaellig oefter drankamen.
    for (let i = 0; i < 480; i++) {
      const beforeAi = performance.now()
      const { commands, memories } = runAi(state, ctx)
      aiSamples.push(performance.now() - beforeAi)

      const beforeTick = performance.now()
      state = runTicks(state, 1, ctx, () => commands).state
      tickSamples.push(performance.now() - beforeTick)
      storeMemories(state, memories)
    }

    const aiMedianMs = Number(median(aiSamples).toFixed(4))
    const tickMedianMs = Number(median(tickSamples).toFixed(4))
    const share = Number((aiMedianMs / Math.max(0.0001, aiMedianMs + tickMedianMs)).toFixed(3))

    const REQUIREMENT = { id: 'R-AI-04', maxShare: 0.3, provinces: 237, aiPlayers: 8 }
    const report = {
      map: map.id,
      provinces: map.provinces.length,
      edges: map.edges.length,
      players: AI_CONFIG.players.length,
      aiPlayers: AI_CONFIG.players.filter((player) => player.kind === 'ai').length,
      ticks: aiSamples.length,
      aiMedianMs,
      tickMedianMs,
      aiP99Ms: Number(percentile(aiSamples, 0.99).toFixed(4)),
      share,
      requirement: REQUIREMENT,
      meetsRequirement: share < REQUIREMENT.maxShare,
      certifies:
        'R-AI-04 unter seinen eigenen Bedingungen: ausgelieferte Weltkarte, acht KI-Maechte.',
      note:
        'Beide Mediane stehen einzeln, weil der Anteil allein nicht lesbar ist: updateIntel liegt im Nenner, ein schnellerer Tick hebt den gemeldeten Anteil.',
      measuredAt: new Date().toISOString(),
    }
    mkdirSync(`${ROOT}/docs/reports`, { recursive: true })
    writeFileSync(`${ROOT}/docs/reports/ai-bench.json`, JSON.stringify(report, null, 2) + String.fromCharCode(10))

    // Die Zusicherung ist die Anforderung, nicht ein bequemer Nachbarwert. Bis heute
    // sicherte der Bench 0,5 zu, wo R-AI-04 0,30 sagt — eine Erlaubnis, keine Pruefung.
    expect(share, `Anteil ${share} (KI ${aiMedianMs} ms, Tick ${tickMedianMs} ms)`).toBeLessThan(
      REQUIREMENT.maxShare,
    )
  })
})
