import { advanceTicks } from '@worldwar/ai'
import {
  createInitialState,
  scoreOf,
  type Difficulty,
  type GameConfig,
  type MapData,
  type PlayerId,
  type Rules,
} from '@worldwar/core'

/**
 * AI versus AI (R-AI-06, T-M7-05).
 *
 * The only honest way to answer "is 'hard' actually harder?" — an opinion about a
 * utility function is not evidence. Matches are seeded, so a result can be reproduced
 * and investigated rather than argued about.
 */

export interface MatchOptions {
  map: MapData
  rules: Rules
  seed: number
  difficulties: [Difficulty, Difficulty]
  /** Game days before the match is decided on points. */
  days?: number
  /**
   * Ob die Partie im Krieg beginnt. Vorgabe `true`.
   *
   * Fuer die Paarung "schwer gegen normal" ist `false` der interessantere Fall: dort
   * soll gerade gemessen werden, **ob** eine Stufe den Krieg erklaert — beginnt er
   * bereits, ist die Zahl der Kriegserklaerungen null und sagt nichts.
   */
  startAtWar?: boolean
}

export interface MatchResult {
  winner: PlayerId | null
  scores: Record<PlayerId, number>
  ticks: number
  reason: 'victory' | 'timeLimit'
  /**
   * Was diplomatisch geschah (T-M15-05, Schritt 1).
   *
   * Ohne diese Zahlen ist jede Aenderung an der Kriegsentscheidung Blindflug: die
   * Siegquote sagt, *wer* gewonnen hat, aber nicht, ob ueberhaupt jemand einen Krieg
   * angefangen hat. Ein Turnier, in dem beide Seiten nur wirtschaften, kann eine
   * Diplomatieregel weder bestaetigen noch widerlegen — und meldet trotzdem eine Quote.
   */
  warDeclarations: number
  peaceAgreements: number
}

export function playMatch(options: MatchOptions): MatchResult {
  const days = options.days ?? 60
  const nations = options.map.startPositions.slice(0, 2)

  const config: GameConfig = {
    seed: options.seed,
    mapId: options.map.id,
    rulesId: options.rules.id,
    players: [
      {
        name: `KI-${options.difficulties[0]}`,
        kind: 'ai',
        nation: nations[0]!.nation,
        color: '#0f62bc',
        difficulty: options.difficulties[0],
      },
      {
        name: `KI-${options.difficulties[1]}`,
        kind: 'ai',
        nation: nations[1]!.nation,
        color: '#b03a2e',
        difficulty: options.difficulties[1],
      },
    ],
    victory: { condition: 'points', pointsShareToWin: 750, dayLimit: days },
  }

  let state = createInitialState(config, { map: options.map, rules: options.rules })
  // They are here to fight; a peace treaty at tick zero would make the match pointless.
  if (options.startAtWar !== false) state.diplomacy.relations['p1|p2']!.state = 'war'

  // Dieselbe Schleife wie die Anwendung (T-M14-04). Vorher stand hier eine eigene —
  // gleich gebaut, aber eben eine zweite, und zwei Schleifen sind zwei Spiele.
  const limit = days * options.rules.constants.ticksPerDay
  const run = advanceTicks(state, limit, { map: options.map, rules: options.rules })
  state = run.state

  // Aus dem Ereignisstrom des Laufs, nicht aus state.eventLog: der ist ein Ringpuffer
  // von 500 Eintraegen und deckte bei ~12.300 Ereignissen je Partie die letzten
  // Spieltage ab (T-M14-05). Eine Kriegserklaerung an Tag 3 stuende dort nicht mehr.
  const warDeclarations = run.events.filter((event) => event.type === 'WAR_DECLARED').length
  const peaceAgreements = run.events.filter(
    (event) => event.type === 'DIPLOMACY_CHANGED' && event.newState === 'peace',
  ).length

  const scores = { p1: scoreOf(state, 'p1', options.rules), p2: scoreOf(state, 'p2', options.rules) }
  if (state.victory.winner !== null) {
    return { winner: state.victory.winner, scores, ticks: state.tick, reason: 'victory', warDeclarations, peaceAgreements }
  }

  const winner = scores.p1 === scores.p2 ? null : scores.p1 > scores.p2 ? 'p1' : 'p2'
  return { winner, scores, ticks: state.tick, reason: 'timeLimit', warDeclarations, peaceAgreements }
}

export interface TournamentResult {
  matches: number
  /** Wins for the first difficulty listed. */
  winsA: number
  winsB: number
  draws: number
  winRateA: number
  /** Kriegserklaerungen und Friedensschluesse je Stufe, ueber alle Partien summiert. */
  warDeclarations: Record<Difficulty, number>
  peaceAgreements: Record<Difficulty, number>
}

/** Plays the same pairing from a fixed set of seeds, sides swapped every other match. */
export function playTournament(options: {
  map: MapData
  rules: Rules
  difficulties: [Difficulty, Difficulty]
  matches: number
  days?: number
  firstSeed?: number
  startAtWar?: boolean
}): TournamentResult {
  let winsA = 0
  let winsB = 0
  let draws = 0
  const wars = { easy: 0, normal: 0, hard: 0 } as Record<Difficulty, number>
  const peaces = { easy: 0, normal: 0, hard: 0 } as Record<Difficulty, number>

  for (let i = 0; i < options.matches; i++) {
    // Swap sides every other match so a favourable starting position cannot decide it.
    const swapped = i % 2 === 1
    const pairing: [Difficulty, Difficulty] = swapped
      ? [options.difficulties[1], options.difficulties[0]]
      : options.difficulties

    const result = playMatch({
      map: options.map,
      rules: options.rules,
      seed: (options.firstSeed ?? 1000) + i,
      difficulties: pairing,
      ...(options.days !== undefined ? { days: options.days } : {}),
      ...(options.startAtWar !== undefined ? { startAtWar: options.startAtWar } : {}),
    })

    // Je Stufe, nicht je Partie: die Seiten werden getauscht, also waere eine Summe ueber
    // "p1" eine Summe ueber zwei verschiedene Stufen.
    for (const difficulty of new Set(pairing)) {
      wars[difficulty] += result.warDeclarations
      peaces[difficulty] += result.peaceAgreements
    }

    if (result.winner === null) draws += 1
    else {
      const aWon = swapped ? result.winner === 'p2' : result.winner === 'p1'
      if (aWon) winsA += 1
      else winsB += 1
    }
  }

  const decided = winsA + winsB
  return {
    matches: options.matches,
    winsA,
    winsB,
    draws,
    winRateA: decided === 0 ? 0 : winsA / decided,
    warDeclarations: wars,
    peaceAgreements: peaces,
  }
}
