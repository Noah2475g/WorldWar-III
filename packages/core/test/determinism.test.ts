import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { hashValue } from '@worldwar/shared'
import { TEST_RULES, smallWorld, tinyMap } from '@worldwar/testkit'
import { describe, expect, it } from 'vitest'
import { createInitialState, type GameConfig } from '../src/state/create'
import { HASH_OMIT_KEYS, type GameState } from '../src/state/types'
import { step } from '../src/step'

const CONFIG: GameConfig = {
  seed: 42,
  mapId: 'tiny',
  rulesId: 'test',
  players: [
    { name: 'Noah', kind: 'human', nation: 'Nordland', color: '#0f62bc' },
    { name: 'Gegner', kind: 'ai', nation: 'Sued', color: '#b03a2e', difficulty: 'normal' },
  ],
  victory: { condition: 'points', pointsShareToWin: 600, dayLimit: null },
}

const ctx = { map: tinyMap(), rules: TEST_RULES }
const hashOf = (state: GameState) => hashValue(state, { omitKeys: HASH_OMIT_KEYS })

function run(ticks: number): { hashes: string[]; final: GameState } {
  let state = createInitialState(CONFIG, ctx)
  const hashes: string[] = []
  for (let i = 0; i < ticks; i++) {
    state = step(state, [], ctx).state
    hashes.push(hashOf(state))
  }
  return { hashes, final: state }
}

describe('R-ARCH-01 Determinismus ueber lange Laeufe', () => {
  it('liefert nach jedem der 500 Ticks denselben Hash', () => {
    // AK1 in full: not just the same end state, the same state after every single tick.
    const a = run(500)
    const b = run(500)
    expect(a.hashes).toEqual(b.hashes)
  })

  it('erreicht denselben Zustand unabhaengig von der Aufteilung des Laufs', () => {
    // Stopping and resuming must not change anything — the precondition for save/load.
    let inOnePiece = createInitialState(CONFIG, ctx)
    for (let i = 0; i < 100; i++) inOnePiece = step(inOnePiece, [], ctx).state

    let inTwoPieces = createInitialState(CONFIG, ctx)
    for (let i = 0; i < 37; i++) inTwoPieces = step(inTwoPieces, [], ctx).state
    const revived = JSON.parse(JSON.stringify(inTwoPieces)) as GameState
    let resumed = revived
    for (let i = 0; i < 63; i++) resumed = step(resumed, [], ctx).state

    expect(hashOf(resumed)).toBe(hashOf(inOnePiece))
  })

  it('unterscheidet sich bei anderem Seed', () => {
    let other = createInitialState({ ...CONFIG, seed: 43 }, ctx)
    for (let i = 0; i < 100; i++) other = step(other, [], ctx).state

    let base = createInitialState(CONFIG, ctx)
    for (let i = 0; i < 100; i++) base = step(base, [], ctx).state

    expect(hashOf(other)).not.toBe(hashOf(base))
  })
})

/**
 * Golden master.
 *
 * The stored hashes pin down the behaviour of the whole rule set. They are *expected*
 * to change when a rule changes — but only then, and only as a deliberate act:
 * regenerate with `UPDATE_GOLDEN=1 pnpm test`, and say so in the commit message.
 */
describe('R-ARCH-03 Golden-Master', () => {
  const file = fileURLToPath(new URL('./golden/tiny-500.json', import.meta.url))

  it('stimmt mit dem festgeschriebenen Lauf ueberein', () => {
    const { hashes } = run(500)
    const checkpoints = {
      tick1: hashes[0]!,
      tick24: hashes[23]!,
      tick100: hashes[99]!,
      tick500: hashes[499]!,
    }

    if (process.env['UPDATE_GOLDEN'] === '1') {
      mkdirSync(fileURLToPath(new URL('./golden/', import.meta.url)), { recursive: true })
      writeFileSync(
        file,
        `${JSON.stringify({ config: CONFIG, map: 'tiny', ticks: 500, checkpoints }, null, 2)}\n`,
      )
    }

    expect(existsSync(file), 'Golden-Datei fehlt — mit UPDATE_GOLDEN=1 erzeugen').toBe(true)
    const stored = JSON.parse(readFileSync(file, 'utf8')) as { checkpoints: Record<string, string> }
    expect(checkpoints).toEqual(stored.checkpoints)
  })
})

/**
 * T-M32-01 made `MOVE_ARMY` carry an optional `departInTicks`. The field is additive:
 * a command log recorded before it existed must replay to the same hash, tick for tick.
 */
describe('R-ARCH-02 Additive Kommandofelder', () => {
  const world = { map: smallWorld(), rules: TEST_RULES }

  function replay(command: Record<string, unknown>): string[] {
    let current = createInitialState(
      {
        ...CONFIG,
        mapId: 'testworld',
        players: [
          { name: 'A', kind: 'human', nation: 'Nordland', color: '#0f62bc' },
          { name: 'B', kind: 'ai', nation: 'Ostmark', color: '#b03a2e', difficulty: 'normal' },
        ],
      },
      world,
    )
    current.armies['a1'] = {
      id: 'a1',
      owner: 'p1',
      name: 'a1',
      locationProvinceId: 'n1',
      units: [{ unitKey: 'infantry', hpTotal: 10_000 }],
      path: [],
      arrivalTick: null,
      departureTick: null,
      deployDelayUntil: 0,
      stance: 'aggressive',
      embarked: false,
      cannotAttackUntil: 0,
      bombardTarget: null,
      holdFire: false,
    }
    current.armyOrder = ['a1']

    const hashes: string[] = []
    for (let i = 0; i < 40; i++) {
      current = step(current, i === 3 ? [command as never] : [], world).state
      hashes.push(hashOf(current))
    }
    return hashes
  }

  it('ein Marschbefehl ohne das Feld liefert dieselben Hashes wie mit dem Wert 0', () => {
    const alt = replay({ type: 'MOVE_ARMY', playerId: 'p1', armyId: 'a1', targetProvinceId: 'n2' })
    const neu = replay({ type: 'MOVE_ARMY', playerId: 'p1', armyId: 'a1', targetProvinceId: 'n2', departInTicks: 0 })

    expect(neu).toEqual(alt)
  })

  it('und unterscheidet sich, sobald wirklich verzoegert wird', () => {
    const alt = replay({ type: 'MOVE_ARMY', playerId: 'p1', armyId: 'a1', targetProvinceId: 'n2' })
    const spaet = replay({ type: 'MOVE_ARMY', playerId: 'p1', armyId: 'a1', targetProvinceId: 'n2', departInTicks: 8 })

    expect(spaet).not.toEqual(alt)
  })
})
