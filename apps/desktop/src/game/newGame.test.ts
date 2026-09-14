import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { hashValue } from '@worldwar/shared'
import { HASH_OMIT_KEYS, type MapData } from '@worldwar/core'
import { TEST_RULES } from '@worldwar/testkit'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_NEW_GAME,
  MULTIPLAYER_SPEEDS,
  aiBonusPercent,
  fixedSpeedOf,
  invitationOf,
  maxOpponents,
  startGame,
  toConfig,
} from './newGame.ts'
import { SPEED_STOPS } from './speed.ts'

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

describe('R-GAME-01 Die Gegner sind Nachbarn, keine Listenanfaenge', () => {
  it('waehlt die naechstgelegenen Maechte statt der ersten in der Kartendatei', () => {
    // Befund 30: Gegner wurden in Kartenreihenfolge genommen. In der ausgelieferten
    // Voreinstellung (Vereinigte Staaten, sieben Gegner) hiess das: kein Landweg zum
    // Spieler, 0 Kriegserklaerungen in 1000 Spieltagen. Fast jede Messung 'es passiert
    // nichts' im Audit haengt daran — die KI kann in dieser Aufstellung gar nicht kaempfen.
    const world = map
    const spieler = world.startPositions[0]!.nation

    const gegner = toConfig({ ...DEFAULT_NEW_GAME, nation: spieler, opponents: 3 }, world)
      .players.filter((p) => p.kind === 'ai')
      .map((p) => p.nation)

    // Jeder Gegner ist ueber Land erreichbar — das ist die Bedingung dafuer, dass
    // ueberhaupt etwas geschieht.
    const heimat = new Set(world.startPositions[0]!.provinces)
    const landNachbarn = new Set<string>()
    for (const edge of world.edges) {
      if (edge.kind !== 'land') continue
      if (heimat.has(edge.a)) landNachbarn.add(edge.b)
      if (heimat.has(edge.b)) landNachbarn.add(edge.a)
    }
    const nachbarNationen = new Set(
      world.startPositions
        .filter((start) => start.provinces.some((id) => landNachbarn.has(id)))
        .map((start) => start.nation),
    )

    expect(gegner.length).toBe(3)
    expect(
      gegner.some((name) => nachbarNationen.has(name)),
      `keiner der Gegner (${gegner.join(', ')}) grenzt an den Spieler`,
    ).toBe(true)
  })

  it('bleibt bei gleicher Startzahl bei derselben Wahl', () => {
    const world = map
    const einmal = toConfig(DEFAULT_NEW_GAME, world).players.map((p) => p.nation)
    const nochmal = toConfig(DEFAULT_NEW_GAME, world).players.map((p) => p.nation)
    expect(einmal).toEqual(nochmal)
  })
})

/**
 * Die feste Geschwindigkeit einer Partie zu zweit (T-M37-03, R-MP-02, C-11, D28.4).
 *
 * Beim Anlegen gewaehlt, danach nie wieder: im Gleichschritt gibt ohnehin der Langsamere
 * das Tempo vor. Die Rate gehoert in die Huelle und nicht in den Zustand — das ist keine
 * Geschmacksfrage, sondern R-ARCH-04/AK2: laege sie im Zustand, wanderte sie in jeden
 * Spielstand und in jede Pruefsumme, und zwei Spieler bekaemen verschiedene Hashes, weil
 * einer schneller zusieht.
 */
describe('R-MP-02/AK1 Eine Mehrspielerpartie traegt genau eine Rate, und der Gast sieht sie', () => {
  const zuZweit = { ...options, mode: 'multiplayer' as const, opponents: 3 }

  it('waehlt die Rate aus den Rasten ohne die Null', () => {
    expect(MULTIPLAYER_SPEEDS).toEqual(SPEED_STOPS.filter((stop) => stop > 0))
    expect(MULTIPLAYER_SPEEDS).not.toContain(0)
    for (const stop of MULTIPLAYER_SPEEDS) {
      expect(fixedSpeedOf({ ...zuZweit, fixedSpeed: stop })).toBe(stop)
    }
  })

  it('faellt bei einer Zwischenrate auf die naechstniedrige Raste, statt eine zu erfinden', () => {
    // Ein alter Link oder ein von Hand geschriebener Wert darf keine Rate erzeugen, die
    // die Kopfleiste nicht als gedrueckte Stufe zeigen kann (T-M28-10).
    expect(fixedSpeedOf({ ...zuZweit, fixedSpeed: 30 })).toBe(25)
    expect(fixedSpeedOf({ ...zuZweit, fixedSpeed: 0 })).toBe(1)
    expect(fixedSpeedOf({ ...zuZweit, fixedSpeed: -5 })).toBe(1)
    expect(fixedSpeedOf({ ...zuZweit, fixedSpeed: 1000 })).toBe(100)
  })

  it('kennt im Einzelspieler keine feste Rate und keine Einladung', () => {
    expect(fixedSpeedOf({ ...options, mode: 'single' })).toBeNull()
    expect(invitationOf({ ...options, mode: 'single' }, map)).toBeNull()
  })

  it('nennt die Rate in der Einladung, zusammen mit dem, worauf der Gast sich einlaesst', () => {
    const einladung = invitationOf({ ...zuZweit, fixedSpeed: 25 }, map)

    expect(einladung).not.toBeNull()
    expect(einladung!.fixedSpeed).toBe(25)
    expect(einladung!.mapName).toBe(map.name)
    expect(einladung!.hostNation).toBe('Deutschland')
    expect(einladung!.guestNation).not.toBe('Deutschland')
    // Drei Gegner, davon einer der Mitspieler: bleiben zwei Computergegner.
    expect(einladung!.aiOpponents).toBe(2)
    expect(einladung!.victory).toBe(zuZweit.victory)
  })

  it('macht aus dem ersten Gegner einen Menschen — und nur aus ihm', () => {
    const config = toConfig(zuZweit, map)

    expect(config.players.map((p) => p.kind)).toEqual(['human', 'human', 'ai', 'ai'])
    // Eine Schwierigkeitsstufe beschreibt einen Computergegner; der Mitspieler traegt keine.
    expect(config.players[1]!.difficulty).toBeUndefined()
    expect(config.players[2]!.difficulty).toBe(zuZweit.difficulty)
  })

  it('laesst eine Partie zu zweit nicht ohne zweite Macht anlegen', () => {
    // Ohne Gegner gaebe es niemanden, der der Mitspieler sein koennte — und
    // createInitialState verlangt ohnehin zwei Maechte.
    const config = toConfig({ ...zuZweit, opponents: 0 }, map)
    expect(config.players.length).toBe(2)
    expect(config.players[1]!.kind).toBe('human')
  })

  it('bleibt im Einzelspieler unveraendert', () => {
    const config = toConfig(options, map)
    expect(config.players[0]!.kind).toBe('human')
    expect(config.players.slice(1).every((p) => p.kind === 'ai')).toBe(true)
  })
})

/**
 * R-ARCH-04/AK2, gegengeprueft an der neuen Wahl: die Partieart und ihre Rate duerfen den
 * Zustand nicht erreichen. Ein Waechter haelt das seit M5 fuer den `GameState`-Typ grün;
 * dieser Test misst am erzeugten Stand selbst — zwei Partien, die sich nur in der Art
 * unterscheiden, muessen dieselbe Pruefsumme tragen.
 */
describe('R-MP-02/AK1 Die Partieart bleibt in der Huelle', () => {
  it('ergibt mit und ohne Mehrspieler denselben Zustand, solange die Maechte dieselben sind', () => {
    const einzel = startGame({ ...options, opponents: 3 }, map, rules)
    const zuZweit = startGame({ ...options, opponents: 3, mode: 'multiplayer', fixedSpeed: 50 }, map, rules)

    // Der einzige Unterschied ist das Attribut „menschlich" am zweiten Spieler — mehr
    // darf eine Partieart nicht bewirken.
    zuZweit.players['p2']!.kind = 'human'
    einzel.players['p2']!.kind = 'human'
    // Und die Schwierigkeitsstufe, die einen Computergegner beschreibt.
    einzel.players['p2']!.difficulty = null
    // Das Gedaechtnis des Computergegners entfaellt fuer den Mitspieler; sonst ist nichts anders.
    delete einzel.ai['p2']

    expect(hashValue(zuZweit, { omitKeys: HASH_OMIT_KEYS })).toBe(hashValue(einzel, { omitKeys: HASH_OMIT_KEYS }))
  })

  it('schreibt weder Rate noch Partieart in den Spielstand', () => {
    const zustand = startGame({ ...options, mode: 'multiplayer', fixedSpeed: 50 }, map, rules)
    const text = JSON.stringify(zustand)

    expect(text).not.toMatch(/"fixedSpeed"/)
    expect(text).not.toMatch(/"mode"/)
    expect(text).not.toMatch(/"speed"/)
  })
})
