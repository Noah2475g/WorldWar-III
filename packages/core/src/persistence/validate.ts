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
  // Seit Stufe 3 (T-M35-03): der Schritt 2 → 3 legt das Feld an, also muss es da sein.
  { key: 'goals', kind: 'object' },
  // Seit Stufe 4 (T-M17-03): dasselbe für die Spionage. Ohne das Feld lädt der Stand
  // fehlerfrei und stürzt im ersten Tick ab — `cloneState` liest `espionage.spies` und
  // `espionage.reveals` (berichtigt am 2026-09-24: eine Spionagephase gibt es noch nicht).
  // Die beiden Listen prüft `validateState` weiter unten.
  { key: 'espionage', kind: 'object' },
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
  if (kindOf(diplomacy['tradeOffers']) !== 'array') problems.push('diplomacy.tradeOffers fehlt')
  if (kindOf(diplomacy['grievances']) !== 'object') problems.push('diplomacy.grievances fehlt')

  // Die Tagespruefung der Zwischenziele liest den Eintrag jeder Macht (T-M35-03). Fehlt er,
  // laedt der Stand fehlerfrei und wirft beim naechsten Tageswechsel einen TypeError.
  const goals = state['goals'] as Record<string, unknown>
  for (const id of state['playerOrder'] as unknown[]) {
    if (typeof id === 'string' && kindOf(goals[id]) !== 'object') problems.push(`goals nennt "${id}" nicht`)
  }

  checkVersion4(state, diplomacy, problems)

  if (problems.length > 0) throw new InvalidStateError(problems)
}

/** Die gerichteten Felder einer Beziehung seit Stufe 4, mit der Art, die sie haben müssen. */
const DIRECTED_FIELDS: { key: string; kinds: readonly string[] }[] = [
  { key: 'aGrantsPassage', kinds: ['boolean'] },
  { key: 'bGrantsPassage', kinds: ['boolean'] },
  { key: 'aPassageEndsAtTick', kinds: ['number', 'null'] },
  { key: 'bPassageEndsAtTick', kinds: ['number', 'null'] },
  { key: 'aSharesMap', kinds: ['boolean'] },
  { key: 'bSharesMap', kinds: ['boolean'] },
]

/**
 * Die Felder der Stufe 4 (T-M17-03), so tief, wie der erste Tick sie liest (Nacharbeit
 * 2026-09-24).
 *
 * Nachgestellt, bevor diese Prüfung kam: `espionage: {}` bestand und warf im ersten Tick
 * einen TypeError aus `cloneState`; ein Handelsangebot ohne `give` ebenso; und eine Beziehung
 * mit den **alten** Schlüsseln `rightOfWay`/`sharedMap` lud still — jeder gewährte Durchmarsch
 * war danach weg, denn gelesen werden nur noch die gerichteten Felder. Die alten Schlüssel
 * werden deshalb ausdrücklich abgewiesen: ein Stand, der beide Formen trägt, ist weder das
 * eine noch das andere.
 */
function checkVersion4(state: Record<string, unknown>, diplomacy: Record<string, unknown>, problems: string[]): void {
  const espionage = state['espionage'] as Record<string, unknown>
  for (const key of ['spies', 'reveals']) {
    const actual = kindOf(espionage[key])
    if (actual !== 'array') problems.push(`Feld "espionage.${key}" fehlt oder ist ${actual} statt array`)
  }

  const nextIds = state['nextIds'] as Record<string, unknown>
  for (const key of ['army', 'battle', 'order', 'spy', 'offer']) {
    const actual = kindOf(nextIds[key])
    if (actual !== 'number') problems.push(`Feld "nextIds.${key}" fehlt oder ist ${actual} statt number`)
  }

  if (kindOf(diplomacy['relations']) === 'object') {
    for (const [pair, relation] of Object.entries(diplomacy['relations'] as Record<string, unknown>)) {
      if (kindOf(relation) !== 'object') {
        problems.push(`diplomacy.relations["${pair}"] ist kein Objekt`)
        continue
      }
      const fields = relation as Record<string, unknown>
      for (const { key, kinds } of DIRECTED_FIELDS) {
        const actual = kindOf(fields[key])
        if (!kinds.includes(actual)) problems.push(`diplomacy.relations["${pair}"].${key} ist ${actual} statt ${kinds.join(' oder ')}`)
      }
      for (const old of ['rightOfWay', 'sharedMap']) {
        if (old in fields) problems.push(`diplomacy.relations["${pair}"] trägt noch "${old}" aus Stufe 3`)
      }
    }
  }

  if (kindOf(diplomacy['tradeOffers']) === 'array') {
    ;(diplomacy['tradeOffers'] as unknown[]).forEach((offer, index) => {
      if (kindOf(offer) !== 'object') {
        problems.push(`diplomacy.tradeOffers[${index}] ist kein Objekt`)
        return
      }
      for (const side of ['give', 'want']) {
        const bundle = (offer as Record<string, unknown>)[side]
        const ok =
          kindOf(bundle) === 'object' &&
          kindOf((bundle as Record<string, unknown>)['resources']) === 'object' &&
          kindOf((bundle as Record<string, unknown>)['provinces']) === 'array'
        if (!ok) problems.push(`diplomacy.tradeOffers[${index}].${side} fehlt oder hat keine Rohstoffe und Provinzen`)
      }
    })
  }
}
