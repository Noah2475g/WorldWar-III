import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { deserialise, parseRules, publicView, type MapData } from '@worldwar/core'
import { anchorsFor } from './anchors.ts'
import { collideMarks, dominantIcon, markersFor, stackSummary, type ArmyMarker } from './markers.ts'
import { armyHome, knownBuildings } from './stellung.ts'

/**
 * E7 Seitenleiste v3b (Plan D14, K16): Markenkollision an S575, Sicht der Macht mit den meisten
 * Provinzen. Dieselbe Kamera wie B0 (gebaeude.slow.test.ts), damit die Zahlen vergleichbar bleiben.
 * Misst Welt (scale 2,5) und Region (scale 1,6): overlapPairs25 muss 0 sein (Feind nie verdeckt,
 * Armeen/Gebaeude weichen aus), zurueckgetretene Gebaeude werden gezaehlt (Schritt 7). `near` wird
 * hier nicht gerufen — K16 verlangt dort bitgleich, das deckt der bestehende near-Waechter ab.
 * Schreibt docs/reports/v4/marken.json.
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

/** overlap-r2-Logik (attachments/t_8df544ca/overlap-r2.mjs): Schnittflaeche / kleinere Flaeche >= 0,25. */
const overlapShare = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): number => {
  const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  if (ox <= 0 || oy <= 0) return 0
  const inter = ox * oy
  const smaller = Math.min(a.w * a.h, b.w * b.h)
  return smaller > 0 ? inter / smaller : 0
}

describe('E7 Seitenleiste v3b: Markenkollision an S575 (Plan K16)', () => {
  it('overlapPairs25 = 0, Feind 100% sichtbar, Gebaeude-Ruecktritt gezaehlt', () => {
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
      const raw = markersFor(armiesMit, buildings, centres, v, { anchors })
      const bounds = { x: 0, y: 0, width: 1280, height: 744 }
      const t0 = performance.now()
      const { markers: placed, layout } = collideMarks(raw, bounds)
      const layoutMs = performance.now() - t0
      const inWin = (m: { x: number; y: number }) => m.x >= 0 && m.x <= bounds.width && m.y >= 0 && m.y <= bounds.height
      const sichtbar = placed.filter((m) => (m.kind === 'army' || m.kind === 'armyGroup' || m.kind === 'building') && inWin(m))
      // Zusammengelegte Marken (Schritt 5, E7b-Zeichnung) teilen bewusst denselben Platz einer
      // anderen Marke — das ist kein Kollisionsfehler, sondern das Ziel des Zusammenlegens.
      const geprueft = sichtbar.filter((m) => !m.merged)
      const boxed = geprueft.map((m, i) => ({
        i,
        kind: m.kind,
        box: {
          x: m.x - (m.kind === 'building' ? 7 : 15),
          y: m.y - (m.kind === 'building' ? 7 : 9),
          w: m.kind === 'building' ? 14 : 30,
          h: m.kind === 'building' ? 14 : 18,
        },
      }))
      // Planer-Nacharbeit Runde 1 (K16 neu): Gebaeude x Gebaeude ist heute ohne gegenseitige
      // Pruefung (anchors.ts, keine Kollision zwischen Gebaeuden) — darum getrennt gezaehlt und
      // gegen die B0-Zahl verglichen, statt mit auf 0 zu bestehen.
      let overlapPairs25 = 0
      let paareGebaeude25 = 0
      for (let i = 0; i < boxed.length; i++)
        for (let j = i + 1; j < boxed.length; j++) {
          if (overlapShare(boxed[i]!.box, boxed[j]!.box) < 0.25) continue
          if (boxed[i]!.kind === 'building' && boxed[j]!.kind === 'building') paareGebaeude25 += 1
          else overlapPairs25 += 1
        }
      const feindGezeichnet = raw.filter((m) => m.kind === 'army' && m.tone === 'enemy').length
      const feindSichtbar = sichtbar.filter((m) => m.kind === 'army' && m.tone === 'enemy').length
      return { gezeichnet: sichtbar.length, overlapPairs25, paareGebaeude25, feindGezeichnet, feindSichtbar, retreatedBuildings: layout.retreatedBuildings, layoutMs }
    }

    const region = messen(1.6)
    const welt = messen(2.5)
    let commit = ''
    try {
      commit = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim()
    } catch {
      commit = 'unbekannt'
    }
    const b0Path = `${ROOT}/docs/ux/v4-seitenleiste/b0/gebaeude-basis.json`
    const b0 = existsSync(b0Path) ? (JSON.parse(readFileSync(b0Path, 'utf8')) as { region: { paareGebaeude25: number } }) : null
    const out = process.env.WW_MARKEN_OUT ?? 'docs/reports/v4/marken.json'
    mkdirSync(`${ROOT}/${out.replace(/\/[^/]+$/, '')}`, { recursive: true })
    writeFileSync(`${ROOT}/${out}`, JSON.stringify({ commit, viewer, region, welt, b0GebaeudePaare: b0?.region.paareGebaeude25 ?? null }, null, 2) + '\n')
    console.log('MARKEN', JSON.stringify({ viewer, region, welt }))

    expect(region.overlapPairs25, 'K16: keine Ueberdeckung >=25% ausser Gebaeude x Gebaeude, Region').toBe(0)
    expect(welt.overlapPairs25, 'K16: keine Ueberdeckung >=25% ausser Gebaeude x Gebaeude, Welt').toBe(0)
    if (b0) expect(region.paareGebaeude25, 'K16: Gebaeude x Gebaeude Paare <= B0').toBeLessThanOrEqual(b0.region.paareGebaeude25)
    expect(region.feindSichtbar, 'K16: Feind 100% sichtbar auf Region').toBe(region.feindGezeichnet)
    expect(welt.feindSichtbar, 'K16: Feind 100% sichtbar auf Welt').toBe(welt.feindGezeichnet)
  })
})
