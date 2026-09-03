import { hashValue } from '@worldwar/shared'
import { HASH_OMIT_KEYS, SCHEMA_VERSION, type GameState } from '../state/types'
import { migrate, type SaveEnvelope } from './migrate'
import type { StoragePort } from './StoragePort'

/**
 * Saving and loading (R-GAME-03/05, T-M8-01).
 *
 * A saved game carries its schema version and a hash of the state it was made from.
 * The hash is not a checksum against disk corruption — it is the guarantee the
 * requirement asks for: what comes back is bit-identical to what went in, or loading
 * fails loudly instead of continuing in a subtly different world.
 */

export class SaveFormatError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SaveFormatError'
  }
}

export function serialise(state: GameState, label?: string): string {
  const envelope: SaveEnvelope = {
    schemaVersion: SCHEMA_VERSION,
    savedAtTick: state.tick,
    hash: hashValue(state, { omitKeys: HASH_OMIT_KEYS }),
    ...(label !== undefined ? { label } : {}),
    state,
  }
  return JSON.stringify(envelope)
}

export function deserialise(text: string): GameState {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new SaveFormatError('Der Speicherstand ist keine gültige JSON-Datei.')
  }

  if (typeof raw !== 'object' || raw === null) {
    throw new SaveFormatError('Der Speicherstand hat kein gültiges Format.')
  }

  const envelope = raw as Partial<SaveEnvelope>
  if (typeof envelope.schemaVersion !== 'number' || !envelope.state) {
    throw new SaveFormatError('Dem Speicherstand fehlen Version oder Spielstand.')
  }

  const migrated = migrate(envelope as SaveEnvelope)
  const state = migrated.state

  if (migrated.hash) {
    const actual = hashValue(state, { omitKeys: HASH_OMIT_KEYS })
    if (actual !== migrated.hash) {
      throw new SaveFormatError(
        'Der Speicherstand wurde verändert oder ist beschädigt: die Prüfsumme stimmt nicht.',
      )
    }
  }

  return state
}

export async function saveGame(storage: StoragePort, name: string, state: GameState, label?: string): Promise<void> {
  await storage.write(name, serialise(state, label))
}

export async function loadGame(storage: StoragePort, name: string): Promise<GameState> {
  return deserialise(await storage.read(name))
}

/**
 * Automatic saves with rotation (R-GAME-04).
 *
 * Two conditions, not one: enough game days *and* enough real seconds. Without the
 * second, fast-forwarding at a thousand hours a second would fill the rotation with
 * near-identical states in a blink and hammer the disk (review finding).
 */
export interface AutosaveState {
  lastSavedTick: number
  lastSavedRealTime: number
  nextSlot: number
}

export const AUTOSAVE_SLOTS = 5

export function shouldAutosave(
  autosave: AutosaveState,
  tick: number,
  realTimeMs: number,
  intervalDays: number,
  ticksPerDay: number,
  minRealSeconds = 60,
): boolean {
  // eslint-disable-next-line no-restricted-syntax -- days x ticks-per-day, plain integers
  const dueByTicks = tick - autosave.lastSavedTick >= intervalDays * ticksPerDay
  // eslint-disable-next-line no-restricted-syntax -- seconds to milliseconds, plain integers
  const dueByClock = realTimeMs - autosave.lastSavedRealTime >= minRealSeconds * 1000
  return dueByTicks && dueByClock
}

export function autosaveName(slot: number): string {
  return `autosave-${slot}.json`
}

export async function writeAutosave(
  storage: StoragePort,
  autosave: AutosaveState,
  state: GameState,
  realTimeMs: number,
): Promise<AutosaveState> {
  const name = autosaveName(autosave.nextSlot)
  await saveGame(storage, name, state, `Automatisch, Tick ${state.tick}`)

  return {
    lastSavedTick: state.tick,
    lastSavedRealTime: realTimeMs,
    nextSlot: (autosave.nextSlot + 1) % AUTOSAVE_SLOTS,
  }
}
