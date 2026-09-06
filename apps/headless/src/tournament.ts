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
  /**
   * Selbsttaetige Beschussereignisse (R-BAT-08/AK3, T-M15-07).
   *
   * Ohne diese Zahl waere die Feuerautomatik gebaut, gruen getestet und im Spiel
   * moeglicherweise wirkungslos: alle Einzeltests stellen die Lage selbst her, in der
   * geschossen wird. Erst der Turnierlauf sagt, ob sie ueberhaupt vorkommt.
   */
  automaticBombardments: number
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
  // Ein ausgehandelter Frieden ist im Kern ein **Waffenstillstand**: `acceptPeace` setzt
  // `truce`, und erst nach der Regelfrist wird daraus wieder `peace`. Wer hier auf
  // 'peace' zaehlt, zaehlt null und haelt es fuer einen Befund — genau das ist beim
  // ersten Lauf am 2026-09-06 passiert.
  const peaceAgreements = run.events.filter(
    (event) => event.type === 'DIPLOMACY_CHANGED' && event.newState === 'truce',
  ).length
  const automaticBombardments = run.events.filter(
    (event) => event.type === 'BOMBARDMENT' && event.automatic,
  ).length

  const scores = { p1: scoreOf(state, 'p1', options.rules), p2: scoreOf(state, 'p2', options.rules) }
  if (state.victory.winner !== null) {
    return { winner: state.victory.winner, scores, ticks: state.tick, reason: 'victory', warDeclarations, peaceAgreements, automaticBombardments }
  }

  const winner = scores.p1 === scores.p2 ? null : scores.p1 > scores.p2 ? 'p1' : 'p2'
  return { winner, scores, ticks: state.tick, reason: 'timeLimit', warDeclarations, peaceAgreements, automaticBombardments }
}

export interface TournamentResult {
  matches: number
  /** Wins for the first difficulty listed. */
  winsA: number
  winsB: number
  draws: number
  /**
   * **Punktquote** über alle Paare: ein gewonnenes Paar zählt eins, ein unentschiedenes
   * ein halbes — die Wertung, mit der Schachturniere rechnen.
   *
   * Nicht `winsA / (winsA + winsB)`: diese Form ignoriert die Unentschieden im Nenner
   * und meldete für „fünf Siege, fünf Unentschieden" glatte 1,00. Bei einer Paarung, die
   * überwiegend unentschieden ausgeht — und genau das war der Befund des Grundlaufs —
   * ist das kein Messwert, sondern ein Vorzeichen.
   */
  winRateA: number
  /**
   * Anteil gewonnener **Einzelpartien**.
   *
   * Zwei Kennzahlen, weil sie zwei verschiedene Fragen beantworten, und eine davon war
   * bis zum 2026-09-06 nicht gestellt: die Paarwertung sagt „ist die höhere Stufe
   * unabhängig von der Startposition besser", die Partienwertung sagt „bekommt die
   * niedrigere Stufe überhaupt je etwas zu sehen". Eine Stufe, die *keine einzige*
   * Partie abgibt, ist kein Schwierigkeitsgrad, sondern eine Mauer — und das steht nur
   * in dieser Zahl.
   */
  matchWinRateA: number
  /** Kriegserklaerungen und Friedensschluesse je Stufe, ueber alle Partien summiert. */
  warDeclarations: Record<Difficulty, number>
  peaceAgreements: Record<Difficulty, number>
  /** Selbsttaetiger Beschuss je Stufe (R-BAT-08/AK3). */
  automaticBombardments: Record<Difficulty, number>
}

/**
 * Spielt jede Aufstellung **paarweise**: derselbe Seed einmal so, einmal mit getauschten
 * Stufen. Gewertet wird das Paar, nicht die einzelne Partie.
 *
 * Der Grund steht im Grundlauf vom 2026-09-06: „schwer gegen normal" endete **exakt
 * 25:25**, und zwar weil in allen 50 Partien die *erste Nation* gewann. Der alte Aufbau
 * tauschte zwar die Seiten, wertete aber jede Partie einzeln — und maß damit die
 * Startaufstellung der Testkarte statt der Spielstärke. Ein Instrument, das eine
 * Eigenschaft der Karte für eine Eigenschaft der KI hält, kann eine Regeländerung weder
 * bestätigen noch widerlegen.
 *
 * Paarweise gewertet fällt die Startposition heraus: gewinnt eine Stufe **beide** Partien
 * eines Paares, zählt das Paar für sie; gewinnt jede Seite ihre, ist das Paar unentschieden.
 * Das ist dieselbe Technik, mit der Schachturniere die Farbe herausrechnen.
 */
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
  const shells = { easy: 0, normal: 0, hard: 0 } as Record<Difficulty, number>
  let matchWinsA = 0
  let matchWinsB = 0

  // Paare, nicht Partien: `matches` bleibt die Zahl der gespielten Partien, gewertet
  // werden die `matches / 2` Paare.
  const pairs = Math.max(1, Math.floor(options.matches / 2))

  for (let pair = 0; pair < pairs; pair++) {
    const seed = (options.firstSeed ?? 1000) + pair
    const spiele = ([first, second]: [Difficulty, Difficulty]) =>
      playMatch({
        map: options.map,
        rules: options.rules,
        seed,
        difficulties: [first, second],
        ...(options.days !== undefined ? { days: options.days } : {}),
        ...(options.startAtWar !== undefined ? { startAtWar: options.startAtWar } : {}),
      })

    const hin = spiele(options.difficulties)
    const rueck = spiele([options.difficulties[1], options.difficulties[0]])

    // Je Stufe, nicht je Partie: die Seiten werden getauscht, also waere eine Summe ueber
    // "p1" eine Summe ueber zwei verschiedene Stufen.
    for (const difficulty of new Set(options.difficulties)) {
      wars[difficulty] += hin.warDeclarations + rueck.warDeclarations
      peaces[difficulty] += hin.peaceAgreements + rueck.peaceAgreements
      shells[difficulty] += hin.automaticBombardments + rueck.automaticBombardments
    }

    // A spielt hin als p1, rueck als p2.
    const punkteA = (hin.winner === 'p1' ? 1 : 0) + (rueck.winner === 'p2' ? 1 : 0)
    const punkteB = (hin.winner === 'p2' ? 1 : 0) + (rueck.winner === 'p1' ? 1 : 0)
    matchWinsA += punkteA
    matchWinsB += punkteB

    if (punkteA > punkteB) winsA += 1
    else if (punkteB > punkteA) winsB += 1
    else draws += 1
  }

  return {
    matches: pairs * 2,
    winsA,
    winsB,
    draws,
    winRateA: (winsA + draws / 2) / pairs,
    matchWinRateA: matchWinsA + matchWinsB === 0 ? 0 : matchWinsA / (matchWinsA + matchWinsB),
    warDeclarations: wars,
    peaceAgreements: peaces,
    automaticBombardments: shells,
  }
}
