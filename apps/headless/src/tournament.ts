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
  /**
   * Nationen in Sitzordnung (Plan D, Befund M17-T4). Die ersten zwei sind die Streiter
   * p1/p2 (gewertet), jede weitere Nation ist ein Fueller. Vorgabe: die ersten zwei
   * `startPositions` der Karte — heutiges Verhalten, bitgleich.
   */
  nations?: string[]
  /** Schwierigkeit des oder der Fueller. Vorgabe `'normal'` (Plan D). */
  fillerDifficulty?: Difficulty
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
  /**
   * Dieselben zwei Zahlen nach dem **Handelnden** (T-M41-08).
   *
   * Die Summen oben gehoeren der ganzen Partie. T-M15-08 versprach sie "je Stufe" — und wer das
   * zusichern will, muss wissen, wer erklaert und wer geschossen hat. Sonst stuende der Beschuss
   * von "schwer" in einer Partie gegen "leicht" auch bei "leicht".
   */
  byPlayer: Record<PlayerId, ActorCounts>
  /**
   * `WAR_DECLARED` mit `withoutDeclaration` ueber **alle** Maechte der Partie (Bericht,
   * keine Zusicherung, Plan D / Befund M17-T6).
   */
  surpriseAttacks: number
}

/** Was eine Macht selbst getan hat (T-M41-08). */
export interface ActorCounts {
  warDeclarations: number
  automaticBombardments: number
  /**
   * Wie viele der `warDeclarations` foermlich waren, also **nicht** `withoutDeclaration`
   * (Plan D, Befund M17-T1/T5, Noahs Entscheid Option C).
   */
  formalWarDeclarations: number
}

export function playMatch(options: MatchOptions): MatchResult {
  const days = options.days ?? 60
  const nationNames = options.nations ?? options.map.startPositions.slice(0, 2).map((entry) => entry.nation)
  const byName = new Map(options.map.startPositions.map((entry) => [entry.nation, entry]))

  const players: GameConfig['players'] = nationNames.map((nation, index) => {
    const position = byName.get(nation)
    if (!position) throw new Error(`playMatch: unbekannte Nation "${nation}"`)
    if (index === 0) {
      return {
        name: `KI-${options.difficulties[0]}`,
        kind: 'ai' as const,
        nation: position.nation,
        color: '#0f62bc',
        difficulty: options.difficulties[0],
      }
    }
    if (index === 1) {
      return {
        name: `KI-${options.difficulties[1]}`,
        kind: 'ai' as const,
        nation: position.nation,
        color: '#b03a2e',
        difficulty: options.difficulties[1],
      }
    }
    // Fueller (Plan D): sitzt mit am Tisch, wird aber nicht gewertet (byPlayer, byDifficulty).
    return {
      name: `KI-fueller-${index}`,
      kind: 'ai' as const,
      nation: position.nation,
      color: '#777777',
      difficulty: options.fillerDifficulty ?? 'normal',
    }
  })

  const config: GameConfig = {
    seed: options.seed,
    mapId: options.map.id,
    rulesId: options.rules.id,
    players,
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

  // byPlayer bleibt nur p1 und p2 — der Fueller zaehlt nirgends nach Handelndem, sonst
  // stuende seine Stufe "normal" in der Zahl des Streiters "normal" (Plan D).
  const byPlayer: Record<PlayerId, ActorCounts> = {
    p1: { warDeclarations: 0, automaticBombardments: 0, formalWarDeclarations: 0 },
    p2: { warDeclarations: 0, automaticBombardments: 0, formalWarDeclarations: 0 },
  }
  for (const event of run.events) {
    if (event.type === 'WAR_DECLARED' && byPlayer[event.playerId]) {
      byPlayer[event.playerId]!.warDeclarations += 1
      if (!event.withoutDeclaration) byPlayer[event.playerId]!.formalWarDeclarations += 1
    }
    if (event.type === 'BOMBARDMENT' && event.automatic && byPlayer[event.playerId]) {
      byPlayer[event.playerId]!.automaticBombardments += 1
    }
  }
  const surpriseAttacks = run.events.filter(
    (event) => event.type === 'WAR_DECLARED' && event.withoutDeclaration,
  ).length

  const scores = { p1: scoreOf(state, 'p1', options.rules), p2: scoreOf(state, 'p2', options.rules) }
  // Sieger: p1/p2 wie heute; gewinnt der Fueller, entscheiden die Punkte der Streiter
  // (Plan D §1). `reason` ist 'victory', sobald ueberhaupt ein Sieger feststeht — auch
  // beim Fueller —, sonst 'timeLimit'.
  if (state.victory.winner === 'p1' || state.victory.winner === 'p2') {
    return { winner: state.victory.winner, scores, ticks: state.tick, reason: 'victory', warDeclarations, peaceAgreements, automaticBombardments, byPlayer, surpriseAttacks }
  }

  const winner = scores.p1 === scores.p2 ? null : scores.p1 > scores.p2 ? 'p1' : 'p2'
  const reason = state.victory.winner !== null ? 'victory' : 'timeLimit'
  return { winner, scores, ticks: state.tick, reason, warDeclarations, peaceAgreements, automaticBombardments, byPlayer, surpriseAttacks }
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
  /**
   * Kriegserklaerungen und Beschuss je Stufe **nach dem Handelnden** (T-M41-08).
   *
   * Die beiden Felder darueber zaehlen jede Partie fuer beide Stufen, die antreten; hier zaehlt
   * nur, was die Stufe selbst getan hat.
   */
  byDifficulty: Record<Difficulty, ActorCounts>
  /**
   * Verschiedene Ausgaenge (Plan D, Befund M17-T4): Menge der Schluessel
   * `${setup.join('/')}|${hin|rueck}|${winner}|${scores.p1}|${scores.p2}` ueber alle
   * gespielten Partien. Ein Turnier, in dem immer dieselbe Nation mit denselben Punkten
   * gewinnt, hat wenige Ausgaenge, egal wie hoch die Quote ist.
   */
  outcomes: number
  /** Partiensiege je Nation, nur Partien mit Sieger (Plan D, Befund M17-T4). */
  winsByNation: Record<string, number>
  /** Summe `surpriseAttacks` aller Partien (Bericht, Plan D / Befund M17-T6). */
  surpriseAttacks: number
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
  /**
   * Aufstellungen in Sitzordnung, jede eine Liste von Nationen (Plan D, Befund M17-T4).
   * Vorgabe: eine Aufstellung mit den heutigen Nationen (bitgleich zum alten Verhalten).
   * Die Paare teilen sich **gleichmaessig** auf die Aufstellungen auf — `pairs % setups.length`
   * muss 0 sein, sonst wird geworfen.
   */
  setups?: string[][]
}): TournamentResult {
  let winsA = 0
  let winsB = 0
  let draws = 0
  const wars = { easy: 0, normal: 0, hard: 0 } as Record<Difficulty, number>
  const peaces = { easy: 0, normal: 0, hard: 0 } as Record<Difficulty, number>
  const shells = { easy: 0, normal: 0, hard: 0 } as Record<Difficulty, number>
  const acted: Record<Difficulty, ActorCounts> = {
    easy: { warDeclarations: 0, automaticBombardments: 0, formalWarDeclarations: 0 },
    normal: { warDeclarations: 0, automaticBombardments: 0, formalWarDeclarations: 0 },
    hard: { warDeclarations: 0, automaticBombardments: 0, formalWarDeclarations: 0 },
  }
  const credit = (difficulty: Difficulty, counts: ActorCounts | undefined): void => {
    if (!counts) return
    acted[difficulty].warDeclarations += counts.warDeclarations
    acted[difficulty].automaticBombardments += counts.automaticBombardments
    acted[difficulty].formalWarDeclarations += counts.formalWarDeclarations
  }
  let matchWinsA = 0
  let matchWinsB = 0
  const outcomeKeys = new Set<string>()
  const winsByNation: Record<string, number> = {}
  let surpriseAttacks = 0

  // Paare, nicht Partien: `matches` bleibt die Zahl der gespielten Partien, gewertet
  // werden die `matches / 2` Paare.
  const pairs = Math.max(1, Math.floor(options.matches / 2))

  const setups = options.setups ?? [options.map.startPositions.slice(0, 2).map((entry) => entry.nation)]
  if (pairs % setups.length !== 0) {
    throw new Error(`playTournament: ${pairs} Paare lassen sich nicht auf ${setups.length} Aufstellungen teilen`)
  }
  const pairsPerSetup = pairs / setups.length

  for (const setup of setups) {
    for (let local = 0; local < pairsPerSetup; local++) {
      const seed = (options.firstSeed ?? 1000) + local
      const spiele = ([first, second]: [Difficulty, Difficulty]) =>
        playMatch({
          map: options.map,
          rules: options.rules,
          seed,
          difficulties: [first, second],
          nations: setup,
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
      // Nach dem Handelnden: hin spielt die erste Stufe p1, rueck spielt sie p2.
      credit(options.difficulties[0], hin.byPlayer['p1'])
      credit(options.difficulties[1], hin.byPlayer['p2'])
      credit(options.difficulties[1], rueck.byPlayer['p1'])
      credit(options.difficulties[0], rueck.byPlayer['p2'])

      surpriseAttacks += hin.surpriseAttacks + rueck.surpriseAttacks

      // Nation von p1/p2 aendert sich zwischen hin und rueck nicht — nur die Stufe, die
      // sie spielt, wird getauscht.
      const nationOf: Record<'p1' | 'p2', string | undefined> = { p1: setup[0], p2: setup[1] }
      for (const [zug, art] of [
        [hin, 'hin'],
        [rueck, 'rueck'],
      ] as const) {
        outcomeKeys.add(`${setup.join('/')}|${art}|${zug.winner}|${zug.scores.p1}|${zug.scores.p2}`)
        if (zug.winner === 'p1' || zug.winner === 'p2') {
          const nation = nationOf[zug.winner]
          if (nation) winsByNation[nation] = (winsByNation[nation] ?? 0) + 1
        }
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
    byDifficulty: acted,
    outcomes: outcomeKeys.size,
    winsByNation,
    surpriseAttacks,
  }
}
