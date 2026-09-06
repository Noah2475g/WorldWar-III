import { hashValue } from '@worldwar/shared'
import { HASH_OMIT_KEYS, SCHEMA_VERSION, type GameState } from '../state/types'
import { assertSupported, migrate, type SaveEnvelope } from './migrate'
import { InvalidStateError, validateState } from './validate'
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

  // Erst die Frage, ob wir diese Stufe ueberhaupt kennen: ein Stand aus einer neueren
  // Fassung soll das erfahren und nicht zuerst etwas ueber Formatversionen lesen.
  assertSupported(envelope.schemaVersion)

  // Befund 56: Es gab zwei Versionsnummern — die im Umschlag und die im Zustand — und
  // nur eine wurde geführt. Der Umschlag ist die führende; sagt der Zustand etwas
  // anderes, ist der Stand von einer Migration angefasst worden, die ihn nicht mitzog,
  // und niemand kann sagen, welche Regeln für ihn gelten.
  const stateVersion = (envelope.state as { schemaVersion?: unknown }).schemaVersion
  if (typeof stateVersion !== 'number') {
    throw new SaveFormatError('Dem Spielstand fehlt seine Formatversion.')
  }
  if (stateVersion !== envelope.schemaVersion) {
    throw new SaveFormatError(
      `Umschlag und Spielstand nennen verschiedene Formatversionen (${envelope.schemaVersion} gegen ${stateVersion}).`,
    )
  }

  const wasMigrated = envelope.schemaVersion !== SCHEMA_VERSION
  const migrated = migrate(envelope as SaveEnvelope)
  const state = migrated.state

  // Drei Ladewege, und seit dem 2026-09-06 hat jeder eine Prüfung (Befund 55).
  //
  // Vorher stand hier nur `if (migrated.hash)` — und `migrate` entfernt den Hash nach
  // jedem Schritt, weil er den Zustand *vor* der Umstellung beschreibt. Solange
  // MIGRATIONS leer war, fiel das nicht auf; ab dem ersten echten Schritt wäre jeder
  // migrierte Stand ungeprüft durchgelaufen, auch `{}`.
  if (wasMigrated) {
    // Migriert: der Hash von damals kann nicht mehr stimmen, also wird der Zustand
    // selbst befragt.
    try {
      validateState(state)
    } catch (error) {
      throw new SaveFormatError(
        error instanceof InvalidStateError ? error.message : 'Der Speicherstand ist unvollständig.',
      )
    }
  } else if (typeof migrated.hash === 'string') {
    const actual = hashValue(state, { omitKeys: HASH_OMIT_KEYS })
    if (actual !== migrated.hash) {
      throw new SaveFormatError(
        'Der Speicherstand wurde verändert oder ist beschädigt: die Prüfsumme stimmt nicht.',
      )
    }
  } else {
    // Weder migriert noch mit Hash: `serialise` schreibt immer einen. Ein aktueller
    // Stand ohne Hash stammt nicht von diesem Spiel.
    throw new SaveFormatError('Dem Speicherstand fehlt die Prüfsumme.')
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
