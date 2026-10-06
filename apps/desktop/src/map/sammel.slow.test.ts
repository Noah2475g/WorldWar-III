import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { deserialise, parseRules, publicView, type MapData } from '@worldwar/core'
import { anchorsFor } from './anchors.ts'
import { ARMY_BOX, dominantIcon, markersFor, pickArmy, pickArmyGroup, stackSummary, type ArmyMarker, type Marker } from './markers.ts'
import { armyHome, knownBuildings } from './stellung.ts'

/**
 * Waechter der Armee-Sammelmarke an S575 (T-M49-03, Plan 4/B3): Kasten je Zoomstufe im Fenster
 * 900x548 um (2479, 1250) ohne und mit `grouping`, near bitgleich, jede eigene Armee erreichbar.
 * Schreibt `docs/reports/v4/sammel.json`.
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

describe('T-M49-03: Sammelmarke an S575', () => {
  it('Startzoom <= 60 Kaesten, near bitgleich, jede eigene Armee erreichbar', () => {
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
    // Wie App.tsx (E2/E4): home/toHome nur fuer eigene Armeen mit bekannten Einheiten.
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

    const VW = 900
    const VH = 548
    const W = ARMY_BOX.width
    const H = ARMY_BOX.height
    const ownTotal = armiesMit.filter((a) => a.own).length
    const isBox = (m: Marker) => m.kind === 'army' || m.kind === 'armyGroup'
    const fullyHidden = (list: Marker[]) => {
      let hidden = 0
      list.forEach((m, i) => {
        let covered = 0
        for (let ix = 0; ix < 7; ix++) {
          for (let iy = 0; iy < 5; iy++) {
            const px = m.x - W / 2 + ((ix + 0.5) * W) / 7
            const py = m.y - H / 2 + ((iy + 0.5) * H) / 5
            if (list.slice(i + 1).some((b) => px >= b.x - W / 2 && px <= b.x + W / 2 && py >= b.y - H / 2 && py <= b.y + H / 2)) covered += 1
          }
        }
        if (covered === 35) hidden += 1
      })
      return hidden
    }
    const byScale: Record<string, unknown> = {}
    const expectOhne: Record<string, number> = { '0.97': 154, '1.6': 216, '2.3': 237 }
    for (const scale of [0.97, 1.6, 2.3]) {
      const v = { x: 2479 - (VW / 2) * scale, y: 1250 - (VH / 2) * scale, scale }
      const grouping = { selectedArmyId: null }
      const listOhne = markersFor(armiesMit, {}, centres, v, {})
      const listMit = markersFor(armiesMit, {}, centres, v, { grouping })
      const inWin = (l: Marker[]) => l.filter((m) => isBox(m) && m.x >= 0 && m.x <= VW && m.y >= 0 && m.y <= VH)
      const ohne = inWin(listOhne)
      const mit = inWin(listMit)
      const groups = mit.filter((m) => m.kind === 'armyGroup')
      const biggest = groups.reduce((n, g) => Math.max(n, g.armyIds?.length ?? 0), 0)
      byScale[String(scale)] = { ohne: ohne.length, mit: mit.length, gruppen: groups.length, groessteGruppe: biggest }
      // (i)
      expect(ohne.length, `(i) ohne grouping bei ${scale}`).toBe(expectOhne[String(scale)])
      // (ii) near: bitgleich
      if (scale === 0.97) expect(listMit, '(ii) near mit == ohne').toEqual(listOhne)
      // (iii)
      if (scale === 1.6) expect(mit.length, '(iii) 1.6').toBeLessThanOrEqual(60)
      if (scale === 2.3) expect(mit.length, '(iii) 2.3').toBeLessThanOrEqual(65)
      // (v)
      expect(fullyHidden(mit), `(v) fullyHidden bei ${scale}`).toBe(0)
    }

    // (iv) + (vi): ganze Karte
    const whole: Record<string, unknown> = {}
    for (const scale of [1.6, 2.3]) {
      const v = { x: 0, y: 0, scale }
      const grouping = { selectedArmyId: null }
      const list = markersFor(armiesMit, {}, centres, v, { grouping })
      const singles = list.filter((m) => m.kind === 'army' && m.own && m.armyId)
      const ownGroups = list.filter((m) => m.kind === 'armyGroup' && m.own)
      const reach = new Map<string, number>()
      for (const m of singles) {
        expect(pickArmy({ x: m.x, y: m.y }, armiesMit, centres, v, { grouping }), `(iv) Einzelkasten ${m.armyId} bei ${scale}`).toBe(m.armyId)
        reach.set(m.armyId!, (reach.get(m.armyId!) ?? 0) + 1)
      }
      let members = 0
      for (const g of ownGroups) {
        const hit = pickArmyGroup({ x: g.x, y: g.y }, armiesMit, centres, v, { grouping })
        expect(hit?.armyIds, `(iv) Gruppenmitte trifft die Gruppe bei ${scale}`).toEqual(g.armyIds)
        for (const id of g.armyIds!) reach.set(id, (reach.get(id) ?? 0) + 1)
        members += g.armyIds!.length
      }
      for (const a of armiesMit.filter((x) => x.own)) expect(reach.get(a.id), `(iv) ${a.id} genau einmal bei ${scale}`).toBe(1)
      expect(members + singles.length, '(iv) Summe Mitglieder + Einzelne').toBe(ownTotal)
      expect(fullyHidden(list.filter(isBox)), `(v) ganze Karte ${scale}`).toBe(0)

      // (vi)
      let big: Marker | undefined
      for (const g of ownGroups) if (g.armyIds!.length > (big?.armyIds!.length ?? 0)) big = g
      expect(big, '(vi) es gibt eine eigene Gruppe').toBeDefined()
      const sel = big!.armyIds![0]!
      const ex = { grouping: { selectedArmyId: sel } }
      const m2 = markersFor(armiesMit, {}, centres, v, ex).find((m) => m.kind === 'army' && m.armyId === sel)
      expect(m2, '(vi) gewaehlte Armee einzeln').toBeDefined()
      expect(pickArmy({ x: m2!.x, y: m2!.y }, armiesMit, centres, v, ex), '(vi) pickArmy waehlt sie').toBe(sel)
      whole[String(scale)] = { ownTotal, ownSingles: singles.length, ownGroups: ownGroups.length, ownMembers: members, groessteEigeneGruppe: big!.armyIds!.length }
    }

    let base = 'unbekannt'
    try {
      base = execSync('git merge-base HEAD origin/main', { cwd: ROOT }).toString().trim()
    } catch {
      /* ohne Git: unbekannt */
    }
    mkdirSync(`${ROOT}/docs/reports/v4`, { recursive: true })
    writeFileSync(`${ROOT}/docs/reports/v4/sammel.json`, JSON.stringify({ base, viewer, byScale, ganzeKarte: whole }, null, 2) + '\n')
  })
})
