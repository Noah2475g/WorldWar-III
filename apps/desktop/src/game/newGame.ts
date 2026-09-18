import { createInitialState, type GameConfig, type GameState, type MapData, type Rules } from '@worldwar/core'
import { colorForPlayer } from '../map/modes.ts'
import { SPEED_STOPS } from './speed.ts'

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

/**
 * Einzelspieler oder eine Partie zu zweit (T-M37-03, R-MP-02, D28.4).
 *
 * Die Partieart gehört in den Zustand der **Hülle** und nicht in den `GameState`: dort
 * steht die Welt, nicht die Betrachtung der Welt. C-11 hat die Geschwindigkeit am
 * 2026-09-04 aus dem Kern verbannt, R-ARCH-04/AK2 hält das grün — und genau deshalb kostet
 * die feste Rate hier fast nichts.
 */
export type GameMode = 'single' | 'multiplayer'

/**
 * Welche Partiearten **dieser Bau** herstellen kann (T-M39-11, Befund V-1, R-FREE-04).
 *
 * Der Wähler „Partieart" bot seit M37 in *jedem* Bau beide Werte an — auch im
 * ausgelieferten Tauri-Programm, das die zweite technisch nicht kann: `__MULTIPLAYER__`
 * ist dort ein literales `false`, der Rollup-Baum schneidet den Transport heraus, und
 * `connect-src 'none'` verböte die Verbindung ohnehin. Gemessen am 2026-09-14 (Befund V-1)
 * lief die Wahl dort in eine Einzelspielerpartie mit fester Rate und ohne Vorspulen —
 * kein Fehler, kein Netzzugriff, aber ein Versprechen, das das Programm nicht hält.
 *
 * **Eine reine Funktion mit hereingereichter Flagge**, nicht `__MULTIPLAYER__` im Rumpf:
 * die Flagge ist eine Ersetzung beim Bauen, im Testlauf steht sie fest, und eine
 * Verzweigung, deren zweiter Zweig nie läuft, ist ungeprüft. So laufen **beide** Zweige
 * in jedem Lauf; gelesen wird die Flagge dort, wo der Dialog gehängt wird (`App.tsx`).
 */
export function gameModesFor(multiplayerBuild: boolean): readonly GameMode[] {
  return multiplayerBuild ? ['single', 'multiplayer'] : ['single']
}

/**
 * Die Rasten, unter denen eine Mehrspielerpartie ihre feste Rate wählt (R-MP-02/AK1).
 *
 * `SPEED_STOPS` ohne die Null: die Null ist die Pause, und eine Partie zu zweit, die mit
 * „angehalten" beginnt und nie wieder anders kann, wäre keine.
 */
export const MULTIPLAYER_SPEEDS: readonly number[] = SPEED_STOPS.filter((stop) => stop > 0)

/** Die Rate, die eine Mehrspielerpartie trägt, wenn niemand eine andere wählt. */
export const DEFAULT_MULTIPLAYER_SPEED = 10

export interface NewGameOptions {
  /** The nation the player takes, by its name in the map's start positions. */
  nation: string
  seed: number
  difficulty: Difficulty
  /**
   * How many other powers join. Capped at what the map offers.
   *
   * Im Mehrspieler ist die **erste** davon der Mitspieler aus Fleisch und Blut; der Rest
   * sind Computergegner. Deshalb braucht eine Partie zu zweit mindestens einen Gegner.
   */
  opponents: number
  victory: 'points' | 'conquest'
  mapId: string
  /** Einzelspieler oder zu zweit (T-M37-03, R-MP-02). */
  mode: GameMode
  /**
   * Die feste Geschwindigkeit einer Mehrspielerpartie, in Spielstunden je Sekunde.
   *
   * Einmal beim Anlegen gewählt und danach nie wieder: im Gleichschritt gibt ohnehin der
   * Langsamere das Tempo vor, und ein Regler, den einer von beiden bewegt, hieße nur,
   * dass der andere ihn nicht bewegt hat. Im Einzelspieler bleibt der Wert unbenutzt.
   */
  fixedSpeed: number
}

export const DEFAULT_NEW_GAME: NewGameOptions = {
  nation: '',
  seed: 1914,
  difficulty: 'normal',
  opponents: 7,
  victory: 'points',
  mapId: 'world',
  mode: 'single',
  fixedSpeed: DEFAULT_MULTIPLAYER_SPEED,
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

  // Zu zweit braucht es mindestens eine zweite Macht — sie ist der Mitspieler (T-M37-03).
  const wanted = options.mode === 'multiplayer' ? Math.max(1, options.opponents) : options.opponents
  const opponents = opponentsNear(nation, map).slice(0, Math.max(0, Math.min(wanted, available.length - 1)))

  return {
    seed: options.seed,
    mapId: map.id,
    rulesId: 'default',
    players: [
      { name: nation, kind: 'human', nation, color: colorForPlayer('p1') },
      ...opponents.map((name, index) => {
        // Der erste Gegner einer Mehrspielerpartie ist ein Mensch (R-MP-02, D28.1).
        // „Menschlich" ist seit M5 nur ein Attribut am Spieler — genau das sichert
        // R-ARCH-04 zu, und genau deshalb kostet die zweite Person hier eine Zeile.
        // Eine Schwierigkeitsstufe bekommt er nicht: sie beschreibt einen Computergegner.
        const mensch = options.mode === 'multiplayer' && index === 0
        return {
          name,
          kind: mensch ? ('human' as const) : ('ai' as const),
          nation: name,
          color: colorForPlayer(`p${index + 2}`),
          ...(mensch ? {} : { difficulty: options.difficulty }),
        }
      }),
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

/**
 * Was der Gast vor dem Beitritt sieht (T-M37-03, R-MP-02/AK1, R-MP-12, D28.10).
 *
 * Niemand tritt einer Partie bei, deren Bedingungen er nicht kennt — und die feste
 * Geschwindigkeit gehört dazu, denn sie ist das Einzige, was er hinterher nicht mehr
 * ändern kann. Die Einladung entsteht aus derselben Partiedefinition, aus der der Host
 * gleich seinen Startzustand baut; sie erfindet nichts dazu.
 *
 * M39 baut daraus den Beitrittsbildschirm (T-M39-02). Hier ist sie zunächst das, was die
 * Anforderung verlangt: ein Gegenstand, in dem die gewählte Rate wirklich steht.
 */
export interface Invitation {
  mapName: string
  /** Die Nation des Gastgebers. */
  hostNation: string
  /** Die Nation, die dem Gast zufällt — der erste Gegner in Nachbarschaftsreihenfolge. */
  guestNation: string
  /** Wie viele Computergegner mitspielen. */
  aiOpponents: number
  victory: NewGameOptions['victory']
  /** Die feste Rate in Spielstunden je Sekunde. */
  fixedSpeed: number
}

/**
 * Die Einladung zu einer Mehrspielerpartie — `null`, solange es keine ist.
 *
 * `null` statt einer Einladung mit leeren Feldern: eine Einzelspielerpartie lädt niemanden
 * ein, und ein Gegenstand, der so tut, wäre die Vorstufe eines Links ins Leere.
 */
export function invitationOf(options: NewGameOptions, map: MapData): Invitation | null {
  if (options.mode !== 'multiplayer') return null

  const config = toConfig(options, map)
  const host = config.players[0]
  const guest = config.players[1]
  if (!host || !guest) return null

  return {
    mapName: map.name,
    hostNation: host.nation,
    guestNation: guest.nation,
    aiOpponents: config.players.filter((player) => player.kind === 'ai').length,
    victory: options.victory,
    fixedSpeed: fixedSpeedOf(options) ?? DEFAULT_MULTIPLAYER_SPEED,
  }
}

/**
 * Die Rate, an die eine laufende Partie gebunden ist — `null` im Einzelspieler (R-MP-02).
 *
 * Genau **eine** Raste aus `MULTIPLAYER_SPEEDS`: was der Dialog anbietet, ist eine Auswahl
 * aus dieser Liste, und was von woanders kommt (ein geladener Stand, ein alter Link) fällt
 * auf die nächstniedrige Raste zurück, statt eine Zwischenrate zu erfinden. Die Null ist
 * ausgeschlossen — sie ist die Pause und keine Geschwindigkeit.
 */
export function fixedSpeedOf(options: NewGameOptions): number | null {
  if (options.mode !== 'multiplayer') return null
  if (MULTIPLAYER_SPEEDS.includes(options.fixedSpeed)) return options.fixedSpeed

  const kleinere = MULTIPLAYER_SPEEDS.filter((stop) => stop < options.fixedSpeed)
  return kleinere.length > 0 ? Math.max(...kleinere) : MULTIPLAYER_SPEEDS[0]!
}
