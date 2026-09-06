import { SCHEMA_VERSION, type GameState } from '../state/types'

/**
 * Save format migrations (R-GAME-05, T-M8-01).
 *
 * An older save is either migrated or rejected with a readable message — never loaded
 * half-understood. A game that silently continues from a state it does not fully
 * comprehend is worse than one that refuses.
 */

export interface SaveEnvelope {
  schemaVersion: number
  savedAtTick: number
  /** Hash of the state as saved; checked after migration. */
  hash?: string
  label?: string
  state: GameState
}

export class UnsupportedSaveVersion extends Error {
  constructor(version: number) {
    super(
      `Dieser Speicherstand hat Version ${version}, das Spiel kennt Version ${SCHEMA_VERSION}. ` +
        (version > SCHEMA_VERSION
          ? 'Er stammt aus einer neueren Fassung des Spiels.'
          : 'Für diese alte Fassung gibt es keine Umstellung.'),
    )
    this.name = 'UnsupportedSaveVersion'
  }
}

/** One step from version n to n+1. Registered in order. */
export type Migration = (envelope: SaveEnvelope) => SaveEnvelope

/**
 * Schritt 1 → 2: die Zustandsfelder von M15, alle leer (T-M15-04, R-GAME-07).
 *
 * **Ein** Schritt für den ganzen Meilenstein, und das ist eine Entscheidung, keine
 * Bequemlichkeit (DECISIONS.md, 2026-09-06): T-M15-05 füllt das Verstimmungs-Record,
 * T-M15-07 die Feuerleitung — beide erhöhen `SCHEMA_VERSION` **nicht**. Drei Schritte
 * für einen Meilenstein hießen drei eingefrorene Stände, drei Prüfpfade und einen
 * Formatwächter, der sich mit sich selbst streitet.
 *
 * Die Werte sind sämtlich neutral: ein leeres Betroffenenfeld heißt „geht niemanden an"
 * (ein Alarm von vor dem Laden ist kein Alarm mehr — D19.1), ein leeres Verstimmungs-
 * Record heißt „niemand ist auf niemanden böse", und `holdFire: false` heißt „feuert",
 * also genau das Verhalten, das eine V1-Armee hatte. Die Migration ändert damit nichts,
 * was die Simulation vorher anders gelesen hätte.
 */
const toVersion2: Migration = (envelope) => {
  const state = envelope.state as unknown as Record<string, unknown>

  // Bewusst nachsichtig gegenueber fehlenden Teilen: eine Migration darf an fremdem
  // Inhalt nicht *abstuerzen*, sie darf ihn nur nicht verstehen. Die Ablehnung ist
  // Sache von validateState — ein TypeError statt einer Meldung waere fuer den Spieler
  // ununterscheidbar von einem Absturz des Spiels.
  const armies = state['armies']
  if (armies !== null && typeof armies === 'object' && !Array.isArray(armies)) {
    const record = armies as Record<string, Record<string, unknown>>
    for (const id of Object.keys(record)) {
      const army = record[id]
      if (army !== null && typeof army === 'object') record[id] = { ...army, bombardTarget: null, holdFire: false }
    }
  }

  const diplomacy = state['diplomacy']
  if (diplomacy !== null && typeof diplomacy === 'object' && !Array.isArray(diplomacy)) {
    ;(diplomacy as Record<string, unknown>)['grievances'] = {}
  }

  const eventLog = state['eventLog']
  if (Array.isArray(eventLog)) {
    state['eventLog'] = eventLog.map((event) =>
      event !== null && typeof event === 'object' ? { ...(event as Record<string, unknown>), concerns: [] } : event,
    )
  }

  state['schemaVersion'] = 2

  return { ...envelope, schemaVersion: 2, state: state as unknown as GameState }
}

/**
 * Die Felder, die Schritt 1 → 2 anlegt — als Liste, damit ein Test sie gegen die
 * tatsaechliche Aenderung halten kann.
 *
 * Die urspruengliche Zusage der Aufgabe lautete "der Hash des migrierten Zustands ist
 * derselbe wie der im V1-Umschlag". Das ist nicht einloesbar: der Hash sortiert die
 * Schluessel und nimmt jeden mit, ein neues Feld aendert ihn also zwangslaeufig. Die
 * Zusage dahinter — *die Migration ruehrt nichts an, was die Simulation liest* — ist
 * dagegen genau pruefbar, und zwar schaerfer: der Unterschied zwischen altem und neuem
 * Zustand darf **ausschliesslich** aus dieser Liste bestehen. Siehe PROBLEME.md.
 */
export const ADDED_IN_VERSION_2 = ['schemaVersion', 'holdFire', 'bombardTarget', 'grievances', 'concerns'] as const

const MIGRATIONS: Record<number, Migration> = {
  1: toVersion2,
}

/** Die hoechste Stufe, fuer die ein Schritt eingetragen ist. */
export function highestMigration(migrations: Record<number, Migration> = MIGRATIONS): number {
  const steps = Object.keys(migrations).map(Number)
  return steps.length === 0 ? 0 : Math.max(...steps)
}

/**
 * A migration that changes the state invalidates the stored hash: the hash describes the
 * state as written, not as migrated. The key is removed rather than set to undefined —
 * the save format must not carry a hash field that means "no hash".
 */
function withoutHash(envelope: SaveEnvelope): SaveEnvelope {
  const copy = { ...envelope }
  delete copy.hash
  return copy
}

/**
 * Ist diese Stufe ueberhaupt ladbar? Wirft `UnsupportedSaveVersion`, wenn nicht.
 *
 * Getrennt von `migrate`, weil `deserialise` die Frage **vor** allen anderen stellen
 * muss: ein Stand aus einer neueren Fassung des Spiels soll das erfahren, und nicht
 * zuerst eine Meldung ueber Formatversionen bekommen, die er nicht einordnen kann.
 */
export function assertSupported(
  version: number,
  migrations: Record<number, Migration> = MIGRATIONS,
  target: number = SCHEMA_VERSION,
): void {
  if (version > target) throw new UnsupportedSaveVersion(version)
  for (let step = version; step < target; step++) {
    if (!migrations[step]) throw new UnsupportedSaveVersion(version)
  }
}

export function migrate(
  envelope: SaveEnvelope,
  migrations: Record<number, Migration> = MIGRATIONS,
  target: number = SCHEMA_VERSION,
): SaveEnvelope {
  let current = envelope

  while (current.schemaVersion < target) {
    const step = migrations[current.schemaVersion]
    if (!step) throw new UnsupportedSaveVersion(envelope.schemaVersion)
    current = withoutHash(step(current))
  }

  if (current.schemaVersion > target) throw new UnsupportedSaveVersion(current.schemaVersion)
  return current
}
