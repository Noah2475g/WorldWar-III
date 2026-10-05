import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { deserialise, parseRules, publicView, type MapData } from '@worldwar/core'
import { anchorsFor, placeBuildings } from './anchors.ts'
import { ARMY_BOX, BUILDING_OFFSET_Y, dominantIcon, markersFor, pickArmy, stackSummary, type ArmyMarker } from './markers.ts'
import { armyHome, dominantUnitKey, knownBuildings } from './stellung.ts'

/**
 * Treffertest und Ueberdeckung der Armeemarker an S575G (V3 Nachbesserung U, T-M46-03):
 * „jede Armee per Klick waehlbar“ und „0 vollstaendig verdeckte Marker“, je Kartenmassstab 0,5 / 1 / 2 / 4 / 8.
 *
 * Gerechnet mit dem Spielcode (`markersFor`, `pickArmy`) ueber die Sicht der Macht mit den meisten Provinzen.
 * Treffer = ein Klick auf die Mitte des gezeichneten Markers waehlt diese Armee (nur eigene Armeen sind per Karte
 * waehlbar, eine fremde traegt keine Befehle: `pickArmy`). Der Klick auf die Mitte ist der Mindestfall; mit dem Finger
 * (Trefferflaeche 44 px) gilt dasselbe. Schreibt `docs/reports/v3/treffer.json`.
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

describe('V3 Nachbesserung U: Armeemarker an S575G', () => {
  it('jede eigene Armee per Klick waehlbar, keine vollstaendig verdeckt, Teilueberdeckung je Massstab', () => {
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
    // Derselbe Bestand ohne home/toHome: der alte Weg (Provinzmitte).
    const armiesOhne: ArmyMarker[] = armiesMit.map((m) => {
      const { home: _home, march, ...rest } = m
      void _home
      if (!march) return rest
      const { toHome: _toHome, ...marchRest } = march
      void _toHome
      return { ...rest, march: marchRest }
    })
    const armiesWithHome = armiesMit.filter((m) => m.home).length
    const byBuilding: Record<string, number> = {}
    const byProvinceHome: Record<string, number> = {}
    for (const m of armiesMit) {
      if (!m.home) continue
      byProvinceHome[m.provinceId] = (byProvinceHome[m.provinceId] ?? 0) + 1
      const key = m.icon ?? '?'
      byBuilding[key] = (byBuilding[key] ?? 0) + 1
    }
    // Belegt die Differenz 193 eigene - armiesWithHome: eigene Armeen ohne home, obwohl das Gattungsgebaeude Stufe >= 1 hat.
    const ankerLuecke: Record<string, { anker: number; gebaeudeStufe1: number; gezeichnet: number; armeenOhneHome: string[] }> = {}
    for (const army of view.armies) {
      if (army.owner !== viewer || !army.units) continue
      const mark = armiesMit.find((m) => m.id === army.id)
      if (mark?.home) continue
      const key = dominantUnitKey(army.units.map((u) => ({ unitKey: u.unitKey, hp: u.hpTotal })))
      const req = key ? rules.units[key]?.requiresBuilding : undefined
      const pb = buildings[army.provinceId]
      if (!key || !req || !pb || !pb[req]) continue
      const an = anchors[army.provinceId] ?? []
      ankerLuecke[army.provinceId] ??= { anker: an.length, gebaeudeStufe1: Object.keys(pb).length, gezeichnet: placeBuildings(pb, an).length, armeenOhneHome: [] }
      ankerLuecke[army.provinceId]!.armeenOhneHome.push(`${key}:${req}`)
    }
    const ankerFehlend = Object.values(ankerLuecke).reduce((n, r) => n + r.armeenOhneHome.length, 0)
    console.log('ANKER', ankerFehlend, JSON.stringify(ankerLuecke))
    const topProvince = Object.entries(byProvinceHome).sort((a, b) => b[1] - a[1])[0]?.[0]
    const W = ARMY_BOX.width
    const H = ARMY_BOX.height
    const measure = (armies: ArmyMarker[]): Record<string, unknown> => {
    const byScale: Record<string, unknown> = {}
    for (const scale of [0.5, 1, 2, 4, 8]) {
      const v = { x: 0, y: 0, scale }
      const list = markersFor(armies, {}, centres, v, {}).filter((m) => m.kind === 'army')
      let hidden = 0
      let partly = 0
      let hiddenCentre = 0
      let ownTotal = 0
      let ownHit = 0
      let displaced = 0
      let visiblePoints = 0
      let visiblePicked = 0
      let sumMove = 0
      let maxMove = 0
      list.forEach((m, i) => {
        // Zeichenreihenfolge: spaeter gezeichnete liegen oben.
        let covered = 0
        for (let ix = 0; ix < 7; ix++) {
          for (let iy = 0; iy < 5; iy++) {
            const px = m.x - W / 2 + ((ix + 0.5) * W) / 7
            const py = m.y - H / 2 + ((iy + 0.5) * H) / 5
            for (let j = i + 1; j < list.length; j++) {
              const b = list[j]!
              if (px >= b.x - W / 2 && px <= b.x + W / 2 && py >= b.y - H / 2 && py <= b.y + H / 2) {
                covered += 1
                break
              }
            }
          }
        }
        if (covered === 35) hidden += 1
        else if (covered > 0) partly += 1
        const cx = m.x
        const cy = m.y
        if (list.slice(i + 1).some((b) => Math.abs(cx - b.x) <= W / 2 && Math.abs(cy - b.y) <= H / 2)) hiddenCentre += 1
        const home = centres[m.provinceId]
        if (home) {
          const hx = home.x / scale
          const hy = home.y / scale
          const move = Math.hypot(m.x - hx, m.y - hy)
          if (move > 48) displaced += 1
          sumMove += move
          maxMove = Math.max(maxMove, move)
        }
        if (m.own && m.armyId) {
          for (let ix = 0; ix < 7; ix++) {
            for (let iy = 0; iy < 5; iy++) {
              const px = m.x - W / 2 + ((ix + 0.5) * W) / 7
              const py = m.y - H / 2 + ((iy + 0.5) * H) / 5
              if (list.slice(i + 1).some((b) => px >= b.x - W / 2 && px <= b.x + W / 2 && py >= b.y - H / 2 && py <= b.y + H / 2)) continue
              visiblePoints += 1
              if (pickArmy({ x: px, y: py }, armies, centres, v, {}) === m.armyId) visiblePicked += 1
            }
          }
          ownTotal += 1
          if (pickArmy({ x: m.x, y: m.y }, armies, centres, v, {}) === m.armyId) ownHit += 1
        }
      })
      byScale[String(scale)] = { markers: list.length, fullyHidden: hidden, partlyCovered: partly, centreCovered: hiddenCentre, ownTotal, ownHit, visiblePoints, visiblePicked, farFromHome48px: displaced, meanMovePx: Math.round(sumMove / Math.max(1, list.length)), maxMovePx: Math.round(maxMove) }
    }
    return byScale
    }
    const ohneStellung = measure(armiesOhne)
    const mitStellung = measure(armiesMit)

    // Heimatgebaeude: Gebaeudemarker, an deren Punkt mindestens eine Armee ihr home hat; 7x7 Stichproben auf 14x14.
    const gebaeude: Record<string, unknown> = {}
    for (const scale of [0.5, 1, 2]) {
      const v = { x: 0, y: 0, scale }
      const all = markersFor(armiesMit, buildings, centres, v, { anchors })
      const eps = 1e-6
      const homeBuildings = all.filter(
        (m) =>
          m.kind === 'building' &&
          armiesMit.some((a) => {
            if (!a.home || a.provinceId !== m.provinceId) return false
            const hx = a.home.x / scale
            const hy = a.home.y / scale
            return Math.abs(m.x - hx) < eps && (Math.abs(m.y - hy) < eps || Math.abs(m.y - (hy + BUILDING_OFFSET_Y)) < eps)
          }),
      )
      // Dieselben Gebaeudemarker, einmal von den Kaesten mit, einmal ohne Stellung verdeckt.
      const cover = (armiesX: typeof armiesMit) => {
        const armyBoxes = markersFor(armiesX, buildings, centres, v, { anchors }).filter((m) => m.kind === 'army')
        let fully = 0
        let partly = 0
        for (const bm of homeBuildings) {
          let covered = 0
          for (let ix = 0; ix < 7; ix++) {
            for (let iy = 0; iy < 7; iy++) {
              const px = bm.x - 7 + ((ix + 0.5) * 14) / 7
              const py = bm.y - 7 + ((iy + 0.5) * 14) / 7
              if (armyBoxes.some((b) => px >= b.x - W / 2 && px <= b.x + W / 2 && py >= b.y - H / 2 && py <= b.y + H / 2)) covered += 1
            }
          }
          if (covered === 49) fully += 1
          else if (covered > 0) partly += 1
        }
        return { fully, partly }
      }
      const mit = cover(armiesMit)
      const ohne = cover(armiesOhne as typeof armiesMit)
      gebaeude[String(scale)] = {
        homeBuildings: homeBuildings.length,
        homeBuildingsFullyCovered: mit.fully,
        homeBuildingsPartly: mit.partly,
        ohneStellungFullyCovered: ohne.fully,
        ohneStellungPartly: ohne.partly,
      }
    }

    mkdirSync(`${ROOT}/docs/reports/v3`, { recursive: true })
    mkdirSync(`${ROOT}/docs/reports/v4`, { recursive: true })
    writeFileSync(`${ROOT}/docs/reports/v3/treffer.json`, JSON.stringify({ note: 'Erzeugt von apps/desktop/src/map/stapel.slow.test.ts (S575, Sicht der staerksten Macht), seit T-M48-03 mit Stellung', viewer, armies: armiesMit.length, byScale: mitStellung }, null, 2) + '\n')
    writeFileSync(`${ROOT}/docs/reports/v4/stellung.json`, JSON.stringify({ armiesWithHome, byBuilding, topProvince, ohneStellung, mitStellung, gebaeude, ankerLuecke }, null, 2) + '\n')
    expect(armiesWithHome, 'Waechter ueber leerer Menge').toBeGreaterThan(0)
    for (const row of Object.values(mitStellung) as { fullyHidden: number; ownTotal: number; ownHit: number }[]) {
      expect(row.fullyHidden).toBe(0)
      expect(row.ownHit, 'jede eigene Armee waehlbar').toBe(row.ownTotal)
    }
    // Ist-Stand T-M48-03, Soll 0, offen fuer Noah (declutter/E7): Waechter je Massstab auf die Messwerte, kein Summenwaechter.
    const HOME_FULLY_COVERED_MAX: Record<string, number> = { '0.5': 0, '1': 2, '2': 4 }
    for (const [scale, max] of Object.entries(HOME_FULLY_COVERED_MAX)) {
      const g = gebaeude[scale] as { homeBuildingsFullyCovered: number; homeBuildingsPartly: number }
      console.log('HOME', scale, 'voll', g.homeBuildingsFullyCovered, 'teils', g.homeBuildingsPartly)
      expect(g.homeBuildingsFullyCovered, `Heimatgebaeude voll verdeckt, Massstab ${scale}`).toBeLessThanOrEqual(max)
    }
  })
})
