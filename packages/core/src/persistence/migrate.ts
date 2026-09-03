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
type Migration = (envelope: SaveEnvelope) => SaveEnvelope

const MIGRATIONS: Record<number, Migration> = {
  // Example of the shape a real migration takes; there is nothing to migrate yet.
  // 1: (envelope) => ({ ...envelope, schemaVersion: 2, state: addFieldTo(envelope.state) }),
}

export function migrate(envelope: SaveEnvelope): SaveEnvelope {
  let current = envelope

  while (current.schemaVersion < SCHEMA_VERSION) {
    const step = MIGRATIONS[current.schemaVersion]
    if (!step) throw new UnsupportedSaveVersion(envelope.schemaVersion)
    const next = step(current)
    // A migration that changes the state invalidates the stored hash.
    current = { ...next, hash: undefined } as SaveEnvelope
  }

  if (current.schemaVersion > SCHEMA_VERSION) throw new UnsupportedSaveVersion(current.schemaVersion)
  return current
}
