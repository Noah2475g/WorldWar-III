import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { deserialise, parseRules, publicView, type MapData } from '@worldwar/core'
import { ARMY_BOX, dominantIcon, markersFor, pickArmy, stackSummary, type ArmyMarker } from './markers.ts'

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
    const armies: ArmyMarker[] = view.armies.map((army) => {
      const icon = army.units ? dominantIcon(army.units.map((s) => ({ unitKey: s.unitKey, hp: s.hpTotal }))) : undefined
      const summary = army.units ? stackSummary(army.units, rules) : null
      return {
        id: army.id,
        provinceId: army.provinceId,
        owner: army.owner,
        strength: army.strength,
        own: army.owner === viewer,
        ...(icon ? { icon } : {}),
        ...(summary ? { count: summary.count, condition: summary.condition } : {}),
      }
    })
    const W = ARMY_BOX.width
    const H = ARMY_BOX.height
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
    mkdirSync(`${ROOT}/docs/reports/v3`, { recursive: true })
    writeFileSync(`${ROOT}/docs/reports/v3/treffer.json`, JSON.stringify({ note: 'Erzeugt von apps/desktop/src/map/stapel.slow.test.ts (S575, Sicht der staerksten Macht)', viewer, armies: armies.length, byScale }, null, 2) + '\n')
    for (const row of Object.values(byScale) as { fullyHidden: number; ownTotal: number; ownHit: number }[]) {
      expect(row.fullyHidden).toBe(0)
      expect(row.ownHit, 'jede eigene Armee waehlbar').toBe(row.ownTotal)
    }
  })
})
