import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { deserialise, parseRules, publicView, type MapData } from '@worldwar/core'
import { anchorsFor } from './anchors.ts'
import { ARMY_BOX, BUILDING_BOX, dominantIcon, markersFor, stackSummary, type ArmyMarker } from './markers.ts'
import { armyHome, knownBuildings } from './stellung.ts'

/**
 * B0 Seitenleiste v3b (M1): Gebaeudemarker je Kartenstufe an S575, Sicht der Macht mit den meisten Provinzen.
 * Reine Messung: gezeichnete Gebaeude im Fenster 1280x744, Paare mit >= 25 % Ueberdeckung (kleinere Flaeche),
 * Gebaeude, die >= 25 % unter einem Armeekasten liegen (prognoseRuecktritt). Schreibt
 * docs/ux/v4-seitenleiste/b0/gebaeude-basis.json (Ziel ueber WW_GEBAEUDE_OUT ueberschreibbar, z. B. -m49).
 */
const ROOT = fileURLToPath(new URL('../../../..', import.meta.url))
const load = (path: string) => JSON.parse(readFileSync(`${ROOT}/${path}`, 'utf8')) as never
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
const world = load('data/maps/world.json') as MapData

interface Box {
  x: number
  y: number
  w: number
  h: number
}
const overlap = (a: Box, b: Box): number => {
  const ox = Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2)
  const oy = Math.min(a.y + a.h / 2, b.y + b.h / 2) - Math.max(a.y - a.h / 2, b.y - b.h / 2)
  return ox > 0 && oy > 0 ? ox * oy : 0
}

describe('B0 Seitenleiste v3b: Gebaeudemarker an S575', () => {
  it('zaehlt gezeichnete Gebaeude, Gebaeudepaare und Armee-Ueberdeckung', () => {
    const gz = `${ROOT}/test/fixtures/v3/S575.json.gz`
    const state = deserialise(existsSync(gz) ? gunzipSync(readFileSync(gz)).toString('utf8') : readFileSync(`${ROOT}/test/fixtures/v3/S575.json`, 'utf8'))
    const count: Record<string, number> = {}
    for (const id of state.provinceOrder) {
      const o = state.provinces[id]!.owner
      if (o) count[o] = (count[o] ?? 0) + 1
    }
    const viewer = Object.keys(count).sort((a, b) => count[b]! - count[a]!)[0]!
    const view = publicView(state, viewer, rules)
    const centres = Object.fromEntries(world.provinces.map((p) => [p.id, p.center as { x: number; y: number }])) as Record<string, { x: number; y: number }>
    const buildings = knownBuildings(view.provinces)
    const anchors = Object.fromEntries(world.provinces.map((p) => [p.id, anchorsFor(p.polygons, p.center)]))
    const armiesMit: ArmyMarker[] = view.armies.map((army) => {
      const icon = army.units ? dominantIcon(army.units.map((s) => ({ unitKey: s.unitKey, hp: s.hpTotal }))) : undefined
      const summary = army.units ? stackSummary(army.units, rules) : null
      const own = army.owner === viewer
      const home = own ? armyHome(army.units, buildings[army.provinceId], anchors[army.provinceId], rules) : null
      const next = army.path?.[0]
      const toHome = own && next ? armyHome(army.units, buildings[next], anchors[next], rules) : null
      const march =
        next && army.departureTick != null && army.arrivalTick != null
          ? { toProvinceId: next, departureTick: army.departureTick, arrivalTick: army.arrivalTick, route: army.path!, ...(toHome ? { toHome } : {}) }
          : undefined
      return {
        id: army.id,
        provinceId: army.provinceId,
        owner: army.owner,
        strength: army.strength,
        own,
        ...(icon ? { icon } : {}),
        ...(home ? { home } : {}),
        ...(summary ? { count: summary.count, condition: summary.condition } : {}),
        ...(march ? { march } : {}),
      }
    })

    const mine = world.provinces.filter((p) => state.provinces[p.id]?.owner === viewer)
    const cx = mine.reduce((a, p) => a + (p.center as { x: number }).x, 0) / mine.length
    const cy = mine.reduce((a, p) => a + (p.center as { y: number }).y, 0) / mine.length

    const messen = (s: number) => {
      const v = { x: cx - 640 * s, y: cy - 372 * s, scale: s }
      const all = markersFor(armiesMit, buildings, centres, v, { anchors })
      const inWin = (m: { x: number; y: number }) => m.x >= 0 && m.x <= 1280 && m.y >= 0 && m.y <= 744
      const geb = all.filter((m) => m.kind === 'building' && inWin(m))
      const armies = all.filter((m) => m.kind === 'army')
      const gb: Box[] = geb.map((m) => ({ x: m.x, y: m.y, w: BUILDING_BOX, h: BUILDING_BOX }))
      const ab: Box[] = armies.map((m) => ({ x: m.x, y: m.y, w: ARMY_BOX.width, h: ARMY_BOX.height }))
      const small = BUILDING_BOX * BUILDING_BOX
      let paare = 0
      for (let i = 0; i < gb.length; i++) for (let j = i + 1; j < gb.length; j++) if (overlap(gb[i]!, gb[j]!) >= 0.25 * small) paare += 1
      const ruecktritt = gb.filter((g) => ab.some((a) => overlap(g, a) >= 0.25 * small)).length
      return { gezeichnet: geb.length, paareGebaeude25: paare, prognoseRuecktritt: ruecktritt }
    }

    const region = messen(1.6)
    const welt = messen(2.5)
    let commit = ''
    try {
      commit = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim()
    } catch {
      commit = 'unbekannt'
    }
    const out = process.env.WW_GEBAEUDE_OUT ?? 'docs/ux/v4-seitenleiste/b0/gebaeude-basis.json'
    mkdirSync(`${ROOT}/${out.replace(/\/[^/]+$/, '')}`, { recursive: true })
    writeFileSync(`${ROOT}/${out}`, JSON.stringify({ commit, viewer, region, welt: { gezeichnet: welt.gezeichnet } }, null, 2) + '\n')
    console.log('GEBAEUDE', JSON.stringify({ viewer, region, welt }))
    expect(region.gezeichnet, 'Kamera falsch: Region ohne Gebaeude').toBeGreaterThan(0)
  })
})
