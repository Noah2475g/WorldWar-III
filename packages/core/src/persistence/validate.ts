import type { GameState } from '../state/types'

/**
 * Was ein geladener Zustand mindestens sein muss (T-M15-04, R-GAME-07, Befund 55).
 *
 * Bis zum 2026-09-06 gab es diese Prüfung nicht — und sie fehlte an genau der Stelle,
 * an der sie zählt. `deserialise` prüfte `if (migrated.hash)`, und `migrate` entfernt den
 * Hash nach jedem Schritt, weil er den Zustand *vor* der Umstellung beschreibt. Solange
 * `MIGRATIONS` leer war, fiel das nicht auf. Ab dem ersten echten Schritt wäre **jeder
 * migrierte Stand ohne jede Prüfung durchgelaufen** — auch `{}`.
 *
 * Die Prüfung ist bewusst grob. Sie ersetzt den Hash nicht (das kann sie nicht: der Hash
 * beschreibt einen Zustand, den es nach der Migration nicht mehr gibt), sondern beantwortet
 * die eine Frage, die der Hash für einen migrierten Stand nicht mehr beantworten kann:
 * *ist das überhaupt ein Spielstand?* Ein halb verstandener Stand ist schlimmer als
 * abgelehnter.
 */

export class InvalidStateError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Der Speicherstand ist unvollständig: ${problems.join('; ')}`)
    this.name = 'InvalidStateError'
  }
}

/** Pflichtfelder eines Zustands, mit der Art, die sie haben müssen. */
const REQUIRED: { key: keyof GameState; kind: 'number' | 'string' | 'array' | 'object' }[] = [
  { key: 'schemaVersion', kind: 'number' },
  { key: 'seed', kind: 'number' },
  { key: 'rng', kind: 'object' },
  { key: 'tick', kind: 'number' },
  { key: 'mapId', kind: 'string' },
  { key: 'rulesId', kind: 'string' },
  { key: 'players', kind: 'object' },
  { key: 'playerOrder', kind: 'array' },
  { key: 'provinces', kind: 'object' },
  { key: 'provinceOrder', kind: 'array' },
  { key: 'armies', kind: 'object' },
  { key: 'armyOrder', kind: 'array' },
  { key: 'diplomacy', kind: 'object' },
  { key: 'market', kind: 'object' },
  { key: 'ai', kind: 'object' },
  { key: 'battles', kind: 'array' },
  { key: 'eventLog', kind: 'array' },
  { key: 'victory', kind: 'object' },
  { key: 'nextIds', kind: 'object' },
]

function kindOf(value: unknown): string {
  if (Array.isArray(value)) return 'array'
  if (value === null) return 'null'
  return typeof value
}

/**
 * Prüft einen Zustand auf Vollständigkeit und Stimmigkeit. Wirft `InvalidStateError`.
 *
 * Zwei Klassen von Befunden, und beide sind schon einmal in diesem Projekt vorgekommen:
 * fehlende Pflichtfelder, und Ordnungslisten, die auf Einträge zeigen, die es nicht gibt
 * (oder umgekehrt). Das Zweite ist der stillere Fehler — eine `playerOrder`, die einen
 * gelöschten Spieler nennt, lässt die Simulation an einer beliebigen späteren Stelle
 * abstürzen, mit einer Meldung, die nichts mit dem Speicherstand zu tun hat.
 */
export function validateState(value: unknown): asserts value is GameState {
  const problems: string[] = []

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new InvalidStateError([`Der Spielstand ist kein Objekt, sondern ${kindOf(value)}`])
  }

  const state = value as Record<string, unknown>

  for (const { key, kind } of REQUIRED) {
    const actual = kindOf(state[key])
    if (actual !== kind) problems.push(`Feld "${key}" fehlt oder ist ${actual} statt ${kind}`)
  }

  if (problems.length > 0) throw new InvalidStateError(problems)

  const order = (key: 'playerOrder' | 'provinceOrder' | 'armyOrder', record: 'players' | 'provinces' | 'armies') => {
    const ids = state[key] as unknown[]
    const entries = state[record] as Record<string, unknown>
    for (const id of ids) {
      if (typeof id !== 'string') problems.push(`${key} enthält eine Kennung, die kein Text ist`)
      else if (!(id in entries)) problems.push(`${key} nennt "${id}", das es in ${record} nicht gibt`)
    }
    const dangling = Object.keys(entries).filter((id) => !(ids as string[]).includes(id))
    if (dangling.length > 0) problems.push(`${record} enthält ${dangling.length} Einträge ohne Platz in ${key}`)
  }

  order('playerOrder', 'players')
  order('provinceOrder', 'provinces')
  order('armyOrder', 'armies')

  const diplomacy = state['diplomacy'] as Record<string, unknown>
  if (kindOf(diplomacy['relations']) !== 'object') problems.push('diplomacy.relations fehlt')
  if (kindOf(diplomacy['offers']) !== 'array') problems.push('diplomacy.offers fehlt')
  if (kindOf(diplomacy['grievances']) !== 'object') problems.push('diplomacy.grievances fehlt')

  if (problems.length > 0) throw new InvalidStateError(problems)
}
