import { createInitialState, type GameConfig, type GameState, type MapData, type Rules } from '@worldwar/core'
import { colorForPlayer } from '../map/modes.ts'

/**
 * Setting up a game (T-M10-07a, R-GAME-01).
 *
 * Everything the dialogue collects ends up in the initial state, and the same seed
 * gives the same game — that is not a nicety, it is what makes a bug reproducible and
 * a balance measurement worth anything.
 *
 * The AI bonus is carried through openly (R-AI-02). A hidden multiplier is the thing
 * this project exists to avoid: a player who loses should be able to see whether they
 * were outplayed or out-multiplied.
 */

export type Difficulty = 'easy' | 'normal' | 'hard'

export interface NewGameOptions {
  /** The nation the player takes, by its name in the map's start positions. */
  nation: string
  seed: number
  difficulty: Difficulty
  /** How many AI powers join. Capped at what the map offers. */
  opponents: number
  victory: 'points' | 'conquest'
  mapId: string
}

export const DEFAULT_NEW_GAME: NewGameOptions = {
  nation: '',
  seed: 1914,
  difficulty: 'normal',
  opponents: 7,
  victory: 'points',
  mapId: 'world',
}

/**
 * Die Gegner nach Nachbarschaft, nicht nach Kartenreihenfolge (T-M14-11, Befund 30).
 *
 * Bis zum 2026-09-06 wurden die ersten N Nationen der Kartendatei genommen. In der
 * ausgelieferten Voreinstellung — Vereinigte Staaten, sieben Gegner — waren das Russland,
 * China, Indien und weitere ohne Landweg zum Spieler: **0 Kriegserklaerungen in 1000
 * Spieltagen**. Fast jede Messung des Audits, in der 'nichts passiert', haengt daran; die
 * KI konnte in dieser Aufstellung gar nicht kaempfen.
 *
 * Gesucht wird per Breitensuche ueber Landgrenzen ab dem Gebiet des Spielers: wer zuerst
 * gefunden wird, ist zuerst Gegner. Die Reihenfolge ist deterministisch (Kartenreihenfolge
 * innerhalb derselben Entfernung), also gibt dieselbe Startzahl weiterhin dieselbe Partie.
 * Reicht die Nachbarschaft nicht fuer die gewuenschte Zahl, fuellen die uebrigen Nationen
 * in Kartenreihenfolge auf — eine Partie mit zu wenigen Gegnern waere schlimmer als eine
 * mit einem fernen.
 */
export function opponentsNear(nation: string, map: MapData): string[] {
  const start = map.startPositions.find((entry) => entry.nation === nation)
  const nationOf = new Map<string, string>()
  for (const entry of map.startPositions) {
    for (const id of entry.provinces) nationOf.set(id, entry.nation)
  }

  const landNeighbours = new Map<string, string[]>()
  for (const edge of map.edges) {
    if (edge.kind !== 'land') continue
    landNeighbours.set(edge.a, [...(landNeighbours.get(edge.a) ?? []), edge.b])
    landNeighbours.set(edge.b, [...(landNeighbours.get(edge.b) ?? []), edge.a])
  }

  const found: string[] = []
  const seenProvince = new Set<string>(start?.provinces ?? [])
  const seenNation = new Set<string>([nation])
  let frontier = [...(start?.provinces ?? [])]

  while (frontier.length > 0) {
    const next: string[] = []
    for (const id of frontier) {
      for (const neighbour of landNeighbours.get(id) ?? []) {
        if (seenProvince.has(neighbour)) continue
        seenProvince.add(neighbour)
        next.push(neighbour)

        const owner = nationOf.get(neighbour)
        if (owner && !seenNation.has(owner)) {
          seenNation.add(owner)
          found.push(owner)
        }
      }
    }
    frontier = next
  }

  // Auffuellen, falls die Landmasse zu klein ist — eine Insel hat sonst keine Gegner.
  const rest = map.startPositions
    .map((entry) => entry.nation)
    .filter((name) => !seenNation.has(name))
  return [...found, ...rest]
}

/**
 * Turns the dialogue's answers into a game configuration.
 *
 * Opponents come from `opponentsNear`, so the game starts with somebody within reach —
 * deterministically, so the same seed really does give the same game rather than merely
 * the same random numbers.
 */
export function toConfig(options: NewGameOptions, map: MapData): GameConfig {
  const available = map.startPositions.map((start) => start.nation)
  const nation = available.includes(options.nation) ? options.nation : (available[0] ?? 'Unbekannt')

  const opponents = opponentsNear(nation, map).slice(
    0,
    Math.max(0, Math.min(options.opponents, available.length - 1)),
  )

  return {
    seed: options.seed,
    mapId: map.id,
    rulesId: 'default',
    players: [
      { name: nation, kind: 'human', nation, color: colorForPlayer('p1') },
      ...opponents.map((name, index) => ({
        name,
        kind: 'ai' as const,
        nation: name,
        color: colorForPlayer(`p${index + 2}`),
        difficulty: options.difficulty,
      })),
    ],
    victory:
      options.victory === 'points'
        ? { condition: 'points' as const, pointsShareToWin: 700, dayLimit: null }
        : { condition: 'conquest' as const, pointsShareToWin: 1000, dayLimit: null },
  }
}

export function startGame(options: NewGameOptions, map: MapData, rules: Rules): GameState {
  return createInitialState(toConfig(options, map), { map, rules })
}

/**
 * The AI's advantage at a difficulty, as a percentage the interface can show.
 *
 * 1000 in the rules means "no bonus"; anything else is displayed rather than hidden
 * (R-AI-02). The hard setting in this game buys the AI more thinking, not more ore —
 * and the player is entitled to know that.
 */
export function aiBonusPercent(rules: Rules, difficulty: Difficulty): number {
  const bonus = rules.ai.difficulties[difficulty]?.resourceBonus ?? 1000
  return Math.round((bonus / 1000 - 1) * 100)
}

/** How many opponents this map can field. */
export function maxOpponents(map: MapData): number {
  return Math.max(0, map.startPositions.length - 1)
}
