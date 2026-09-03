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

const MIGRATIONS: Record<number, Migration> = {
  // Example of the shape a real migration takes; there is nothing to migrate yet.
  // 1: (envelope) => ({ ...envelope, schemaVersion: 2, state: addFieldTo(envelope.state) }),
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
