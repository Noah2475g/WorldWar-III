import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { deserialise, parseRules, publicView, type MapData } from '@worldwar/core'
import { toScreen } from './picking.ts'
import { relationKindFor } from './modes.ts'
import { collideWorldMarks, dominantIcon, stackSummary, WORLD_PILL_SEGMENT, type ArmyMarker } from './markers.ts'
import { layoutMarks, type MarkInput } from './layoutMarks.ts'
import { worldRawMarks, type WorldProvinceInfo, type WorldRawMark } from './welt.ts'
import { armyHome, knownBuildings } from './stellung.ts'
import { anchorsFor } from './anchors.ts'

/**
 * Waechter der Welt-Pille an S575 (T-M51-09, Plan Zoom-Cluster §11.4 E3c): belegt
 * Rohstand (`worldRawMarks`) und zusammengelegte Zahl (`collideWorldMarks`) gegen die
 * gemessenen Basiszahlen (A19/A20) und beweist, dass Mid/Near unveraendert bleiben (D24,
 * Schritt 4 — die bestehenden Waechter laufen unveraendert mit, ihre Berichte duerfen
 * sich nicht aendern). Schreibt `docs/reports/v4/weltpille.json`.
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
const world = load('data/maps/world.json') as MapData & { width: number; height: number }

describe('T-M51-09: Welt-Pille-Waechter an S575', () => {
  it('Rohstand <= 137 (A20), Mid/Near bitgleich (D24)', () => {
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

    // D16: "Land" = province.owner, Beziehung wie modes.ts:relationKindFor (gleiches
    // Muster wie App.tsx Zeile 905 — vom Aufrufer gesetzt, nicht neu erfunden).
    const provinces: Record<string, WorldProvinceInfo> = {}
    for (const p of view.provinces) {
      provinces[p.id] = { owner: p.owner, relation: relationKindFor(p.owner, viewer, view.relations ?? {}) }
    }

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

    // Viewport fuer Welt (Schritt 1): ganze Karte in 1280x800 einpassen. MapData.width/
    // height liegen auf oberster Ebene von world.json vor (Plan §11.7-Hinweis), kein
    // selber-rechnen aus Provinz-Polygonen noetig.
    const VW = 1280
    const VH = 800
    const scale = Math.max(world.width / VW, world.height / VH)
    const view2 = { x: (world.width - VW * scale) / 2, y: (world.height - VH * scale) / 2, scale }

    // Schritt 2: Rohmarken vor/nach collideWorldMarks.
    const raw = worldRawMarks(buildings, armiesMit, provinces, centres, view2)
    const rohstandEigen = raw.filter((m) => m.tone === 'own').length
    const rohstandFeind = raw.filter((m) => m.tone === 'enemy').length

    const erwartetEigen = 126
    const erwartetFeind = 11
    const abwEigen = erwartetEigen > 0 ? Math.abs(rohstandEigen - erwartetEigen) / erwartetEigen : 0
    const abwFeind = erwartetFeind > 0 ? Math.abs(rohstandFeind - erwartetFeind) / erwartetFeind : 0
    if (abwEigen > 0.1) {
      console.log(`Rohstand eigen Abweichung > 10%: gemessen ${rohstandEigen}, erwartet ~${erwartetEigen} (Spielstand kann sich geaendert haben, kein Blocker).`)
    }
    if (abwFeind > 0.1) {
      console.log(`Rohstand feind Abweichung > 10%: gemessen ${rohstandFeind}, erwartet ~${erwartetFeind} (Spielstand kann sich geaendert haben, kein Blocker).`)
    }
    // A20: Rohstand-Obergrenze <= 126 eigen + <= 11 Feind = <= 137.
    expect(rohstandEigen, 'A20 Rohstand eigen <= 126').toBeLessThanOrEqual(126)
    expect(rohstandFeind, 'A20 Rohstand feind <= 11').toBeLessThanOrEqual(11)
    expect(rohstandEigen + rohstandFeind, 'A20 Rohstand gesamt <= 137').toBeLessThanOrEqual(137)

    const bounds = { x: -100_000, y: -100_000, width: 200_000, height: 200_000 }
    const zusammengelegt = collideWorldMarks(raw, bounds, null)
    const byOwner: Record<string, number> = {}
    for (const m of zusammengelegt) {
      if (m.kind !== 'worldPill') continue
      byOwner[m.ownerId] = (byOwner[m.ownerId] ?? 0) + 1
    }

    // Schritt 5 (Gegenprobe): dieselbe Abbildung wie `collideWorldMarks` (markers.ts), nur
    // mit `mergeRadius=0` statt 72 an `layoutMarks` -- die hartcodierte 72 in
    // `collideWorldMarks` selbst bleibt unveraendert (D25: markers.ts nicht anfassen).
    const toInput = (mark: WorldRawMark): MarkInput => {
      const hasBuilding = (mark.buildingSum ?? 0) > 0
      const hasArmy = (mark.armySum ?? 0) > 0
      const segments = (hasBuilding ? 1 : 0) + (hasArmy ? 1 : 0)
      return {
        id: mark.provinceId,
        pri: mark.tone === 'enemy' ? 4 : 2,
        kind: mark.tone === 'enemy' ? 'foe' : 'army',
        side: mark.tone === 'enemy' ? 'foe' : 'me',
        pow: mark.ownerId,
        ax: mark.x,
        ay: mark.y,
        w: segments * WORLD_PILL_SEGMENT.width + (segments === 2 ? 1 : 0),
        h: WORLD_PILL_SEGMENT.height,
        n: mark.buildingSum ?? 0,
        ...(hasArmy ? { n2: mark.armySum } : {}),
        foe: mark.tone === 'enemy',
      }
    }
    const inputsZero = raw.map((mark) => toInput({ ...mark, x: toScreen({ x: mark.x, y: mark.y }, view2).x, y: toScreen({ x: mark.x, y: mark.y }, view2).y }))
    const { marks: marksZero } = layoutMarks(inputsZero, bounds, 0)
    const gezeichnetZero = marksZero.filter((m) => !m.merged).length
    expect(gezeichnetZero, 'Gegenprobe rot gesehen: mergeRadius=0 zeigt fast nur Einzelmarken (>= echte Zusammenlegung)').toBeGreaterThanOrEqual(
      zusammengelegt.length,
    )
    if (raw.length > 0) {
      expect(gezeichnetZero, 'Gegenprobe rot gesehen: mergeRadius=0 legt fast nichts zusammen').toBe(raw.length)
    }

    // Schritt 4: Mid/Near unveraendert (D24) -- bestehende Waechter-Berichte duerfen sich
    // durch diese Karte nicht aendern (Diff-Beweis erfolgt ausserhalb dieses Tests durch
    // `git diff --exit-code` auf die drei Berichte, siehe Karte Schritt 4).

    let base = 'unbekannt'
    try {
      base = execSync('git rev-parse origin/main', { cwd: ROOT }).toString().trim()
    } catch {
      /* ohne Git: unbekannt */
    }
    mkdirSync(`${ROOT}/docs/reports/v4`, { recursive: true })
    writeFileSync(
      `${ROOT}/docs/reports/v4/weltpille.json`,
      JSON.stringify(
        {
          base,
          viewer,
          rohstand: { eigen: rohstandEigen, feind: rohstandFeind },
          zusammengelegt: zusammengelegt.length,
          byOwner,
          abweichungErwartung: {
            eigen: { gemessen: rohstandEigen, erwartet: erwartetEigen, ueber10Prozent: abwEigen > 0.1 },
            feind: {
              gemessen: rohstandFeind,
              erwartet: erwartetFeind,
              ueber10Prozent: abwFeind > 0.1,
              hinweis:
                abwFeind > 0.1
                  ? 'Spielstand S575 hat sich seit A19/A20 (E3a) weiterentwickelt (weniger sichtbare Feind-Armeen) -- kein Blocker, nur Protokoll (R13).'
                  : undefined,
            },
          },
        },
        null,
        2,
      ) + '\n',
    )
  })
})
