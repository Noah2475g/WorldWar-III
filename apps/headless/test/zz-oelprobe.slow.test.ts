import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { advanceTicks } from '@worldwar/ai'
import { createInitialState, economyOverview, parseRules, unitCount, type GameConfig, type MapData } from '@worldwar/core'
import { it } from 'vitest'

// Messprobe (nicht eingecheckt): Oelvorrat, -foerderung, -verbrauch je Macht ueber 200 Spieltage, Weltkarte, acht KI
// wie m17-integration (Schwierigkeit easy/normal/hard im Wechsel). Ausgabe nach OELPROBE_OUT.
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
const SEEDS = (process.env['OELPROBE_SEEDS'] ?? '1815,1914,2015').split(',').map(Number)
const breathe = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

it('Oelprobe', async () => {
  const out: Record<string, unknown> = {}
  for (const seed of SEEDS) {
    const config: GameConfig = {
      seed,
      mapId: map.id,
      rulesId: 'default',
      players: map.startPositions.slice(0, 8).map((start, index) => ({
        name: start.nation,
        kind: 'ai' as const,
        nation: start.nation,
        color: '#000000',
        difficulty: (['easy', 'normal', 'hard'] as const)[index % 3]!,
      })),
      victory: { condition: 'points', pointsShareToWin: 900, dayLimit: null },
    }
    let state = createInitialState(config, { map, rules })
    const perNation: Record<string, { tag: number; bestand: number; foerderung: number; verbrauch: number; mangel: boolean; artillerie: number }[]> = {}
    const recruited: Record<string, Record<string, number>> = {}
    for (let day = 1; day <= 200; day++) {
      const r = advanceTicks(state, rules.constants.ticksPerDay, { map, rules })
      state = r.state
      for (const e of r.events) {
        if (e.type === 'UNIT_RECRUITED') {
          const n = state.players[(e as { playerId: string }).playerId]?.nation ?? '?'
          const k = (e as { unitKey: string }).unitKey
          const c = (e as { count?: number }).count ?? 1
          recruited[n] = recruited[n] ?? {}
          recruited[n]![k] = (recruited[n]![k] ?? 0) + c
        }
      }
      if (day === 1 || day % 10 === 0) {
        for (const id of state.playerOrder) {
          const p = state.players[id]!
          const o = economyOverview(state, id, rules).oil
          let art = 0
          for (const aid of state.armyOrder) {
            const a = state.armies[aid]!
            if (a.owner !== id) continue
            for (const s of a.units) if (s.unitKey === 'artillery') art += unitCount(s, rules)
          }
          ;(perNation[p.nation] ??= []).push({ tag: day, bestand: o.stock, foerderung: o.production, verbrauch: o.consumption, mangel: p.shortages.includes('oil'), artillerie: art })
        }
      }
      if (day % 25 === 0) await breathe()
    }
    out[seed] = { perNation, recruited }
  }
  writeFileSync(process.env['OELPROBE_OUT'] ?? '/tmp/oelprobe.json', JSON.stringify(out, null, 1))
}, 3_600_000)
