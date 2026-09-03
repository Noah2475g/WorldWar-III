import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { hashValue } from '@worldwar/shared'
import { HASH_OMIT_KEYS, type MapData } from '@worldwar/core'
import { TEST_RULES } from '@worldwar/testkit'
import { describe, expect, it } from 'vitest'
import { DEFAULT_NEW_GAME, aiBonusPercent, maxOpponents, startGame, toConfig } from './newGame.ts'

/**
 * Starting a game (T-M10-07a, R-GAME-01/R-AI-02).
 *
 * Run against the real world map, because the thing worth checking is that the
 * dialogue's answers survive the trip into the initial state — and that the same seed
 * really gives the same game, which is what makes a bug reproducible at all.
 */

const ROOT = fileURLToPath(new URL('../../../..', import.meta.url))
const map = JSON.parse(readFileSync(`${ROOT}/data/maps/world.json`, 'utf8')) as MapData
const rules = TEST_RULES

const options = { ...DEFAULT_NEW_GAME, nation: 'Deutschland' }

describe('R-GAME-01 Partie erstellen', () => {
  it('setzt den Spieler auf die gewaehlte Macht', () => {
    const config = toConfig(options, map)

    expect(config.players[0]).toMatchObject({ nation: 'Deutschland', kind: 'human' })
  })

  it('stellt genau so viele Gegner auf, wie gewuenscht', () => {
    const config = toConfig({ ...options, opponents: 5 }, map)

    expect(config.players).toHaveLength(6)
    expect(config.players.slice(1).every((p) => p.kind === 'ai')).toBe(true)
  })

  it('stellt den Spieler nicht gegen sich selbst', () => {
    const config = toConfig({ ...options, opponents: 20 }, map)

    const nations = config.players.map((p) => p.nation)
    expect(new Set(nations).size).toBe(nations.length)
    expect(nations.filter((n) => n === 'Deutschland')).toHaveLength(1)
  })

  it('deckelt die Gegnerzahl auf das, was die Karte hergibt', () => {
    const config = toConfig({ ...options, opponents: 999 }, map)

    expect(config.players.length - 1).toBeLessThanOrEqual(maxOpponents(map))
  })

  it('faellt bei unbekannter Macht auf die erste zurueck, statt zu scheitern', () => {
    const config = toConfig({ ...options, nation: 'Atlantis' }, map)

    expect(config.players[0]?.nation).toBe(map.startPositions[0]?.nation)
  })

  it('reicht Schwierigkeit und Siegbedingung durch', () => {
    const config = toConfig({ ...options, difficulty: 'hard', victory: 'conquest' }, map)

    expect(config.players[1]).toMatchObject({ difficulty: 'hard' })
    expect(config.victory.condition).toBe('conquest')
  })

  it('gibt jeder Macht eine eigene Farbe', () => {
    const colors = toConfig({ ...options, opponents: 6 }, map).players.map((p) => p.color)

    expect(new Set(colors).size).toBe(colors.length)
  })
})

describe('R-GAME-01 Dieselbe Startzahl, dieselbe Partie', () => {
  it('erzeugt bei gleichem Seed einen bitgleichen Anfangszustand', () => {
    // Without this a bug report is unusable: "es passierte in meiner Partie" cannot be
    // followed up if the same settings produce a different world.
    const a = startGame({ ...options, seed: 4711 }, map, rules)
    const b = startGame({ ...options, seed: 4711 }, map, rules)

    expect(hashValue(a, { omitKeys: HASH_OMIT_KEYS })).toBe(hashValue(b, { omitKeys: HASH_OMIT_KEYS }))
  })

  it('erzeugt bei anderem Seed eine andere Partie', () => {
    const a = startGame({ ...options, seed: 1 }, map, rules)
    const b = startGame({ ...options, seed: 2 }, map, rules)

    expect(hashValue(a, { omitKeys: HASH_OMIT_KEYS })).not.toBe(
      hashValue(b, { omitKeys: HASH_OMIT_KEYS }),
    )
  })

  it('gibt dem Spieler Provinzen und eine Hauptstadt', () => {
    const state = startGame(options, map, rules)
    const own = Object.values(state.provinces).filter((p) => p.owner === 'p1')

    expect(own.length).toBeGreaterThanOrEqual(3)
    expect(state.players.p1?.capitalProvinceId).toBeTruthy()
  })
})

describe('R-AI-02 Der KI-Bonus wird offen ausgewiesen', () => {
  it('meldet null Prozent, wenn die KI keinen Bonus hat', () => {
    // The whole point of the project: a player who loses should be able to see whether
    // they were outplayed or out-multiplied.
    for (const difficulty of ['easy', 'normal', 'hard'] as const) {
      expect(aiBonusPercent(rules, difficulty), difficulty).toBe(0)
    }
  })

  it('wuerde einen Bonus melden, wenn es einen gaebe', () => {
    const withBonus = {
      ...rules,
      ai: { ...rules.ai, difficulties: { ...rules.ai.difficulties, hard: { ...rules.ai.difficulties.hard, resourceBonus: 1250 } } },
    }

    expect(aiBonusPercent(withBonus, 'hard')).toBe(25)
  })
})
