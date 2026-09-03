import { describe, expect, it } from 'vitest'
import type { GameState } from '../state/types'
import { UnsupportedSaveVersion, migrate, type Migration, type SaveEnvelope } from './migrate'

/**
 * The migration table is empty as long as the schema has never changed. Testing the
 * chain through the real table would therefore test nothing — so the chain is fed a
 * table of its own. What is under test is the walk, not any particular migration.
 */

const stateOf = (marker: string) => ({ tick: 0, marker } as unknown as GameState)

const envelope = (schemaVersion: number, hash?: string): SaveEnvelope => ({
  schemaVersion,
  savedAtTick: 0,
  ...(hash !== undefined ? { hash } : {}),
  state: stateOf('v' + String(schemaVersion)),
})

/** Bumps the version by one and rewrites the state, as a real migration would. */
const step = (to: number): Migration => (e) => ({
  ...e,
  schemaVersion: to,
  state: stateOf('v' + String(to)),
})

describe('R-GAME-05 Umstellung alter Speicherstaende', () => {
  it('laeuft die Kette Stufe fuer Stufe bis zur aktuellen Version', () => {
    const table: Record<number, Migration> = { 1: step(2), 2: step(3) }

    const result = migrate(envelope(1), table, 3)

    expect(result.schemaVersion).toBe(3)
    expect((result.state as unknown as { marker: string }).marker).toBe('v3')
  })

  it('verwirft die gespeicherte Pruefsumme, sobald migriert wurde', () => {
    // The hash describes the state as it was written. After a migration it describes
    // nothing, and keeping it would make loading fail on a perfectly good save.
    const result = migrate(envelope(1, 'alter-hash'), { 1: step(2) }, 2)

    expect('hash' in result).toBe(false)
  })

  it('laesst einen aktuellen Stand unveraendert', () => {
    const current = envelope(1, 'hash-1')

    expect(migrate(current, {}, 1)).toBe(current)
  })

  it('lehnt einen Stand ab, fuer den eine Stufe fehlt', () => {
    expect(() => migrate(envelope(1), { 1: step(2) }, 5)).toThrow(UnsupportedSaveVersion)
  })

  it('lehnt einen Stand aus einer neueren Fassung ab', () => {
    expect(() => migrate(envelope(9), {}, 1)).toThrow(/neueren Fassung/)
  })
})
