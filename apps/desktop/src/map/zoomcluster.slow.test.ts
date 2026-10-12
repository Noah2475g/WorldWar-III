import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { deserialise, parseRules, publicView, type MapData } from '@worldwar/core'
import { anchorsFor } from './anchors.ts'
import {
  collideMarks,
  dominantIcon,
  markersFor,
  pickArmy,
  pickArmyGroup,
  pickBuildingGroup,
  stackSummary,
  type ArmyMarker,
  type Marker,
} from './markers.ts'
import { armyHome, knownBuildings } from './stellung.ts'

/**
 * Waechter der Gebaeude-Sammelmarke an S575 (T-M51-03, Plan Zoom-Cluster §5 E1c): die
 * Sammelmarke bringt 230 -> 99 Gebaeude-Eintraege im Hauptfenster bei Massstab 1,6, jede
 * gezeichnete Marke ist klickbar, und `near` bleibt bitgleich (D1-D7). Aufbau (Fixture,
 * Sicht, Armeen, Anker) aus `sammel.slow.test.ts` uebernommen. Schreibt
 * `docs/reports/v4/zoomcluster.json`.
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

describe('T-M51-03: Zoom-Cluster-Waechter an S575', () => {
  it('230 -> 99 Gebaeude-Eintraege, klickbar, near bitgleich', () => {
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

    const CX = 2479
    const CY = 1250
    const ohneExtras = { anchors }
    const mitExtras = { anchors, buildingGroups: { selectedProvinceId: null }, grouping: { selectedArmyId: null } }
    const isGeb = (m: Marker) => m.kind === 'building' || m.kind === 'buildingGroup'
    const isBox = (m: Marker) => m.kind === 'army' || m.kind === 'armyGroup'

    const byWindow: {
      ohne: Record<string, number>
      vorLayout: Record<string, number>
      gezeichnet: Record<string, number>
      zurueck: Record<string, number>
      symbole: Record<string, number>
    } = { ohne: {}, vorLayout: {}, gezeichnet: {}, zurueck: {}, symbole: {} }

    const messen = (vw: number, vh: number, scale: number) => {
      const v = { x: CX - (vw / 2) * scale, y: CY - (vh / 2) * scale, scale }
      const inWin = (m: { x: number; y: number }) => m.x >= 0 && m.x <= vw && m.y >= 0 && m.y <= vh
      const listOhne = markersFor(armiesMit, buildings, centres, v, ohneExtras)
      const listMit = markersFor(armiesMit, buildings, centres, v, mitExtras)
      const ohneGeb = listOhne.filter((m) => isGeb(m) && inWin(m))
      const mitGeb = listMit.filter((m) => isGeb(m) && inWin(m))
      const bounds = { x: 0, y: 0, width: vw, height: vh }
      const { markers: placed, layout } = collideMarks(listMit, bounds)
      const gebGezeichnet = placed.filter((m) => isGeb(m) && !m.merged && inWin(m))
      const boxGezeichnet = placed.filter((m) => isBox(m) && !m.merged && inWin(m))
      return { v, listOhne, listMit, ohneGeb, mitGeb, placed, layout, gebGezeichnet, boxGezeichnet }
    }

    // (i) + (ii): 900x548 ueber die vier Stufen.
    const VW = 900
    const VH = 548
    const expectOhne: Record<string, number> = { '0.97': 116, '1.6': 230, '2': 272, '2.3': 0 }
    const expectVorLayout: Record<string, number> = { '1.6': 99, '2': 113 }
    let near: ReturnType<typeof messen> | null = null
    let r16: ReturnType<typeof messen> | null = null
    for (const scale of [0.97, 1.6, 2, 2.3]) {
      const r = messen(VW, VH, scale)
      const key = `${VW}x${VH}@${scale}`
      byWindow.ohne[key] = r.ohneGeb.length
      byWindow.vorLayout[key] = r.mitGeb.length
      byWindow.gezeichnet[key] = r.gebGezeichnet.length
      byWindow.zurueck[key] = r.layout.retreatedBuildings
      // (i)
      expect(r.ohneGeb.length, `(i) ohne Opt-in bei ${scale}`).toBe(expectOhne[String(scale)])
      // (ii) near bitgleich
      if (scale === 0.97) {
        expect(r.listMit, '(ii) near mit == ohne').toEqual(r.listOhne)
        near = r
      }
      // (iii) mit Opt-in vor layoutMarks
      if (expectVorLayout[String(scale)] !== undefined) {
        const erwartet = expectVorLayout[String(scale)]!
        const abweichung = erwartet > 0 ? Math.abs(r.mitGeb.length - erwartet) / erwartet : 0
        if (abweichung > 0.05) {
          throw new Error(`(iii) Abweichung > 5% bei ${scale}: gemessen ${r.mitGeb.length}, erwartet ${erwartet} -> block an planner`)
        }
        expect(r.mitGeb.length, `(iii) vorLayout bei ${scale}`).toBe(erwartet)
      }
      // far: keine Gebaeude
      if (scale === 2.3) expect(r.gebGezeichnet.length, '(ii) far gezeichnet 0').toBe(0)
      if (scale === 1.6) r16 = r
    }
    expect(near, 'near gemessen').not.toBeNull()
    expect(r16, '900x548/1.6 gemessen').not.toBeNull()

    // Zusaetzliche Fenster bei 1,6.
    for (const [vw, vh, erwartet] of [
      [1216, 800, 119],
      [390, 700, 57],
    ] as const) {
      const r = messen(vw, vh, 1.6)
      const key = `${vw}x${vh}@1.6`
      byWindow.ohne[key] = r.ohneGeb.length
      byWindow.vorLayout[key] = r.mitGeb.length
      byWindow.gezeichnet[key] = r.gebGezeichnet.length
      byWindow.zurueck[key] = r.layout.retreatedBuildings
      const abweichung = Math.abs(r.mitGeb.length - erwartet) / erwartet
      if (abweichung > 0.05) {
        throw new Error(`(iii) Abweichung > 5% bei ${vw}x${vh}/1.6: gemessen ${r.mitGeb.length}, erwartet ${erwartet} -> block an planner`)
      }
      if (r.mitGeb.length !== erwartet) {
        console.log(
          `(iii) Abweichung erklaert ${vw}x${vh}/1.6: Realist-Zahl ${erwartet} (Messung vor E1a/E1b), gemessen ${r.mitGeb.length} ` +
            '(Differenz 2 Provinzen, < 5% -- gleiche S575-Fixture, Realist-Skript und markersFor zaehlen Randprovinzen am Fensterrand unterschiedlich: ' +
            'Realist-Skript prueft die Provinz-Mitte in Weltkoordinaten vor Rundung, markersFor filtert nach dem gerundeten Bildschirmpunkt).',
        )
      }
      expect(abweichung, `(iii) vorLayout ${vw}x${vh}/1.6 Abweichung <= 5%`).toBeLessThanOrEqual(0.05)
    }

    // (iv) Symbole bei 900x548/1,6, vor layoutMarks (vergleichbar mit Realist-Messung).
    const symbolCount: Record<string, number> = {}
    for (const m of r16!.mitGeb) {
      if (m.kind !== 'buildingGroup' || !m.icon) continue
      symbolCount[m.icon] = (symbolCount[m.icon] ?? 0) + 1
    }
    byWindow.symbole = symbolCount
    // Mentor-Befund (t_da25ef8a): Realist-Vormessung (t_a659cd99) nutzte eine andere
    // Fixture/Logik als die echte Implementation; die Summe (99 = 94 Gruppen + Rest Einzel)
    // ist exakt korrekt, nur die Symbol-Aufteilung weicht ab. Sollwerte auf die echte
    // Implementation gesetzt, kein Code-Change.
    expect(symbolCount['factory'] ?? 0, '(iv) factory').toBe(41)
    expect(symbolCount['harbour'] ?? 0, '(iv) harbour').toBe(37)
    expect(symbolCount['barracks'] ?? 0, '(iv) barracks').toBe(16)

    // (v) jede gezeichnete buildingGroup ist an ihrer Mitte klickbar.
    let fehlzahl = 0
    const vMit = r16!.v
    for (const m of r16!.gebGezeichnet) {
      if (m.kind !== 'buildingGroup') continue
      const screen = { x: m.x, y: m.y }
      const army = pickArmy(screen, armiesMit, centres, vMit, mitExtras)
      const armyGroup = pickArmyGroup(screen, armiesMit, centres, vMit, mitExtras)
      const geb = pickBuildingGroup(screen, buildings, centres, vMit, mitExtras)
      if (army !== null || armyGroup !== null || geb?.provinceId !== m.provinceId) fehlzahl += 1
    }
    expect(fehlzahl, '(v) jede gezeichnete buildingGroup klickbar').toBe(0)

    // (vi) Summe mit M49-Armeemarken bei 900x548/1,6.
    const summe = r16!.gebGezeichnet.length + r16!.boxGezeichnet.length
    expect(summe, '(vi) Summe <= 160').toBeLessThanOrEqual(160)

    let base = 'unbekannt'
    try {
      base = execSync('git rev-parse origin/main', { cwd: ROOT }).toString().trim()
    } catch {
      /* ohne Git: unbekannt */
    }
    mkdirSync(`${ROOT}/docs/reports/v4`, { recursive: true })
    writeFileSync(
      `${ROOT}/docs/reports/v4/zoomcluster.json`,
      JSON.stringify(
        {
          base,
          viewer,
          byWindow,
          summeMit153: summe,
        },
        null,
        2,
      ) + '\n',
    )
  })
})
