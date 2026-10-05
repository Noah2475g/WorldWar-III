import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { advanceTicks } from '@worldwar/ai'
import { RECRUIT_MIN_MORALE, createInitialState, parseRules, type GameConfig, type MapData } from '@worldwar/core'
import { describe, expect, it } from 'vitest'

/**
 * VM-01 / T-M47-02: Integrationsmessung der Schonfrist auf der Weltkarte (acht KI, 200 Spieltage,
 * drei Startzahlen). Gezaehlt wird tickweise: Eroberungen (PROVINCE_CAPTURED), alle angewendeten
 * RECRUIT-Befehle, davon die in der Schonfrist (frisch eroberte Provinz) und davon die unter
 * RECRUIT_MIN_MORALE. Belegt wird, dass die KI die Schonfrist im Spiel wirklich nutzt.
 *
 * Das Fenster wird absichtlich aus den Regeln berechnet (occupationPenaltyDays * ticksPerDay) und
 * NICHT ueber recruitMoraleBlocked importiert — so laeuft die Gegenprobe auch auf dem alten Stand.
 */

const ROOT = fileURLToPath(new URL('../../../', import.meta.url))
const load = (path: string): never => JSON.parse(readFileSync(`${ROOT}${path}`, 'utf8')) as never
const map = load('data/maps/world.json') as MapData
const rules = parseRules(
  {
    constants: load('data/rules/default/constants.json'),
    resources: load('data/rules/default/resources.json'),
    buildings: load('data/rules/default/buildings.json'),
    units: load('data/rules/default/units.json'),
    ai: load('data/rules/default/ai.json'),
  },
  'default',
)

const DAYS = 200
const STARTZAHLEN = [1815, 1914, 2015] as const
const SCHREIBEN = process.env['WORLDWAR_WRITE_REPORT'] === '1'

/** Gibt die Ereignisschleife frei — ein langer synchroner Lauf toetet sonst den Worker (WORKFLOW §4). */
const breathe = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

function integrationConfig(seed: number): GameConfig {
  return {
    seed,
    mapId: map.id,
    rulesId: 'default',
    players: map.startPositions.slice(0, 8).map((start, index) => ({
      name: start.nation,
      kind: 'ai' as const,
      nation: start.nation,
      color: ['#2C5F7C', '#7C3F2C', '#4A5D2C', '#5B3A6B', '#9FB2BE', '#C4A99C', '#6B5B3A', '#3A6B5B'][index]!,
      difficulty: (['easy', 'normal', 'hard'] as const)[index % 3]!,
    })),
    victory: { condition: 'points', pointsShareToWin: 900, dayLimit: null },
  }
}

interface Zaehlung {
  seed: number
  captures: number
  recruits: number
  recruitsInGrace: number
  recruitsInGraceBelowLimit: number
}

async function zaehle(seed: number): Promise<Zaehlung> {
  const window = rules.constants.occupationPenaltyDays * rules.constants.ticksPerDay
  let current = createInitialState(integrationConfig(seed), { map, rules })
  const z = { seed, captures: 0, recruits: 0, recruitsInGrace: 0, recruitsInGraceBelowLimit: 0 }
  for (let day = 0; day < DAYS && current.victory.winner === null; day++) {
    for (let hour = 0; hour < rules.constants.ticksPerDay; hour++) {
      const before = current
      const chunk = advanceTicks(current, 1, { map, rules })
      current = chunk.state
      z.captures += chunk.events.filter((e) => e.type === 'PROVINCE_CAPTURED').length
      for (const { command } of chunk.applied) {
        if (command.type !== 'RECRUIT') continue
        z.recruits += 1
        const p = before.provinces[command.provinceId]!
        const inGrace = p.occupiedSince !== null && before.tick - p.occupiedSince < window
        if (inGrace) z.recruitsInGrace += 1
        if (inGrace && p.morale < RECRUIT_MIN_MORALE) z.recruitsInGraceBelowLimit += 1
      }
    }
    await breathe()
  }
  return z
}

describe('R-UNIT-02/AK1 Schonfrist im Spiel: die KI hebt in frisch eroberten Provinzen aus (VM-01, T-M47-02)', () => {
  it('drei Startzahlen, 200 Spieltage: Aushebungen in der Schonfrist unter der Moralgrenze', async () => {
    const ergebnisse: Zaehlung[] = []
    for (const seed of STARTZAHLEN) ergebnisse.push(await zaehle(seed))
    if (SCHREIBEN) {
      mkdirSync(`${ROOT}docs/reports/vm01`, { recursive: true })
      writeFileSync(
        `${ROOT}docs/reports/vm01/schonfrist.json`,
        JSON.stringify({ note: 'Erzeugt von apps/headless/test/schonfrist.slow.test.ts (T-M47-02).', days: DAYS, ergebnisse }, null, 2) + '\n',
      )
    }
    const summe = ergebnisse.reduce((s, e) => s + e.recruitsInGraceBelowLimit, 0)
    expect(summe, JSON.stringify(ergebnisse)).toBeGreaterThan(0)
  }, 1_800_000)
})
