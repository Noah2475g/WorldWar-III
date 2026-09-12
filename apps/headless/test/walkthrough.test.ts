import { HASH_OMIT_KEYS, type GameState } from '@worldwar/core'
import { hashValue } from '@worldwar/shared'
import { TEST_RULES, placeArmy, smallWorld } from '@worldwar/testkit'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { eventCounts, runGame, type ScriptedCommand } from '../src/run'

/**
 * The walkthrough (T-M4-06).
 *
 * Two nations, five hundred game hours, a fixed script: build a barracks, raise
 * infantry, march into contested ground, fight, take the province. If this run stops
 * producing all five milestones, something in the rules has stopped being a game.
 */
const map = smallWorld()
const rules = TEST_RULES

const CONFIG = {
  seed: 4711,
  mapId: 'testworld',
  rulesId: 'default',
  players: [
    { name: 'Nordland', kind: 'human' as const, nation: 'Nordland', color: '#0f62bc' },
    { name: 'Ostmark', kind: 'ai' as const, nation: 'Ostmark', color: '#b03a2e', difficulty: 'normal' as const },
  ],
  victory: { condition: 'points' as const, pointsShareToWin: 900, dayLimit: null },
}

const script: ScriptedCommand[] = [
  { atTick: 0, command: { type: 'BUILD', playerId: 'p1', provinceId: 'n1', building: 'barracks' } },
  { atTick: 30, command: { type: 'RECRUIT', playerId: 'p1', provinceId: 'n1', unitKey: 'infantry', count: 12 } },
  { atTick: 60, command: { type: 'MOVE_ARMY', playerId: 'p1', armyId: 'a2', targetProvinceId: 'm1' } },
]

function walkthrough() {
  return runGame({
    config: CONFIG,
    map,
    rules,
    ticks: 500,
    script,
    setup: (state) => {
      // Nordland bekommt die Kasse fuer sein Drehbuch (T-M34-06). Seit der Startvorrat
      // auf zwei Dritteln steht, reicht er fuer eine Kaserne UND zwoelf Infanterie am
      // zweiten Spieltag nicht mehr — nach der Kaserne blieben 334.000 Material, und
      // zwoelf Infanterie kosten 600.000. Der Durchstich prueft die Kette Bau →
      // Aushebung → Marsch → Schlacht → Eroberung; ob die Eroeffnung knapp ist, pruefen
      // `create.test.ts` und `economy-scale.test.ts`. Ein Drehbuch, das an der Kasse
      // scheitert, prueft die Kette nicht mehr — es meldet nur noch, dass es sie nicht
      // geprueft hat.
      for (const key of Object.keys(state.players['p1']!.resources)) {
        state.players['p1']!.resources[key as 'wood'] = 5_000_000
      }
      // Ostmark holds the contested middle with a small garrison, and the two are at war.
      state.diplomacy.relations['p1|p2']!.state = 'war'
      state.provinces['m1']!.owner = 'p2'
      placeArmy(state, { owner: 'p2', at: 'm1', units: [{ unitKey: 'infantry', hpTotal: 4_000 }], stance: 'defensive' })
    },
  })
}

describe('R-ARCH-03 Durchstich: eine Partie ohne Oberflaeche', () => {
  const result = walkthrough()
  const counts = eventCounts(result.events)

  it('laeuft 500 Stunden ohne Fehler durch', () => {
    expect(result.state.tick).toBeGreaterThanOrEqual(400)
  })

  it('baut ein Gebaeude fertig', () => {
    expect(counts['BUILD_COMPLETED'] ?? 0).toBeGreaterThan(0)
  })

  it('rekrutiert Einheiten', () => {
    expect(counts['UNIT_RECRUITED'] ?? 0).toBeGreaterThan(0)
  })

  it('bringt eine Armee ans Ziel', () => {
    expect(counts['ARMY_ARRIVED'] ?? 0).toBeGreaterThan(0)
  })

  it('fuehrt eine Schlacht', () => {
    expect(counts['BATTLE_RESOLVED'] ?? 0).toBeGreaterThan(0)
  })

  it('erobert eine Provinz', () => {
    expect(counts['PROVINCE_CAPTURED'] ?? 0).toBeGreaterThan(0)
    expect(result.state.provinces['m1']!.owner).toBe('p1')
  })

  it('rechnet die Tage ab', () => {
    expect(counts['DAY_REPORT'] ?? 0).toBeGreaterThanOrEqual(20)
  })

  it('haelt die Wirtschaft am Laufen', () => {
    const player = result.state.players['p1']!
    expect(player.resources.food).toBeGreaterThan(0)
    expect(player.resources.money).toBeGreaterThan(0)
  })
})

describe('R-ARCH-01 Der Durchstich ist reproduzierbar', () => {
  const file = fileURLToPath(new URL('./golden/walkthrough.json', import.meta.url))

  it('liefert bei jedem Lauf denselben Endzustand', () => {
    const a = walkthrough()
    const b = walkthrough()
    expect(hashValue(a.state, { omitKeys: HASH_OMIT_KEYS })).toBe(
      hashValue(b.state, { omitKeys: HASH_OMIT_KEYS }),
    )
  })

  it('stimmt mit dem festgeschriebenen Lauf ueberein', () => {
    const result = walkthrough()
    const hash = hashValue(result.state as GameState, { omitKeys: HASH_OMIT_KEYS })
    const summary = { hash, tick: result.state.tick, owner_m1: result.state.provinces['m1']!.owner }

    if (process.env['UPDATE_GOLDEN'] === '1') {
      mkdirSync(fileURLToPath(new URL('./golden/', import.meta.url)), { recursive: true })
      writeFileSync(file, `${JSON.stringify(summary, null, 2)}\n`)
    }

    expect(existsSync(file), 'Golden-Datei fehlt — mit UPDATE_GOLDEN=1 erzeugen').toBe(true)
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual(summary)
  })
})
