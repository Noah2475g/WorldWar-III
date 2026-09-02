import { describe, expect, it } from 'vitest'
import { HashUnsupportedValueError, hashValue } from './hash'

/**
 * The hash is how we prove two runs are identical (R-ARCH-01/AK1) and that saving and
 * loading changes nothing (R-GAME-03/AK1). It therefore has to be stable against
 * things that do not matter — key order — and sensitive to everything that does.
 */
describe('R-ARCH-01 Zustands-Hash', () => {
  it('liefert fuer gleiche Werte denselben Hash', () => {
    expect(hashValue({ a: 1, b: [1, 2, 3] })).toBe(hashValue({ a: 1, b: [1, 2, 3] }))
  })

  it('ist unabhaengig von der Schluesselreihenfolge', () => {
    // Object key order is an artefact of construction, not part of the game state.
    expect(hashValue({ a: 1, b: 2 })).toBe(hashValue({ b: 2, a: 1 }))
    expect(hashValue({ x: { p: 1, q: 2 } })).toBe(hashValue({ x: { q: 2, p: 1 } }))
  })

  it('ist abhaengig von der Reihenfolge in Listen', () => {
    // Army and province order IS part of the state: it decides evaluation order.
    expect(hashValue([1, 2, 3])).not.toBe(hashValue([3, 2, 1]))
  })

  it('aendert sich bei jeder Feldaenderung', () => {
    const base = { tick: 10, morale: 70, name: 'Ruhrgebiet' }
    expect(hashValue({ ...base, tick: 11 })).not.toBe(hashValue(base))
    expect(hashValue({ ...base, morale: 71 })).not.toBe(hashValue(base))
    expect(hashValue({ ...base, name: 'Ruhrgebiat' })).not.toBe(hashValue(base))
  })

  it('unterscheidet Typen mit gleicher Darstellung', () => {
    expect(hashValue('1')).not.toBe(hashValue(1))
    expect(hashValue(null)).not.toBe(hashValue('null'))
    expect(hashValue([])).not.toBe(hashValue({}))
    expect(hashValue(false)).not.toBe(hashValue(0))
  })

  it('behandelt tiefe Strukturen', () => {
    const deep = { a: { b: { c: { d: [1, { e: 'x' }] } } } }
    const same = { a: { b: { c: { d: [1, { e: 'x' }] } } } }
    const other = { a: { b: { c: { d: [1, { e: 'y' }] } } } }
    expect(hashValue(deep)).toBe(hashValue(same))
    expect(hashValue(deep)).not.toBe(hashValue(other))
  })

  it('liefert einen kurzen, stabilen Hexwert', () => {
    const hash = hashValue({ tick: 1 })
    expect(hash).toMatch(/^[0-9a-f]{16}$/)
  })
})

describe('R-GAME-03 Hash blendet Darstellungsdaten aus', () => {
  it('ignoriert ausgeschlossene Schluessel auf jeder Ebene', () => {
    // eventLog is output, not state. Rewording a message must not make the
    // golden-master fail as if a rule had changed.
    const a = { tick: 5, eventLog: [{ type: 'BUILD_COMPLETED', text: 'fertig' }] }
    const b = { tick: 5, eventLog: [{ type: 'BUILD_COMPLETED', text: 'anders formuliert' }] }
    expect(hashValue(a, { omitKeys: ['eventLog'] })).toBe(hashValue(b, { omitKeys: ['eventLog'] }))
  })

  it('unterscheidet weiterhin alles andere', () => {
    const a = { tick: 5, eventLog: ['x'] }
    const b = { tick: 6, eventLog: ['x'] }
    expect(hashValue(a, { omitKeys: ['eventLog'] })).not.toBe(hashValue(b, { omitKeys: ['eventLog'] }))
  })

  it('ohne Ausschluss wirkt der Ereignisstrom sehr wohl', () => {
    const a = { tick: 5, eventLog: ['x'] }
    const b = { tick: 5, eventLog: ['y'] }
    expect(hashValue(a)).not.toBe(hashValue(b))
  })
})

describe('R-ARCH-01 Hash erzwingt reine Zustandsdaten', () => {
  it('weist undefined zurueck', () => {
    // undefined has no JSON representation: it would survive hashing but vanish on save.
    expect(() => hashValue({ a: undefined })).toThrow(HashUnsupportedValueError)
  })

  it('weist Funktionen zurueck', () => {
    expect(() => hashValue({ fn: () => 1 })).toThrow(HashUnsupportedValueError)
  })

  it('weist NaN und Unendlich zurueck', () => {
    expect(() => hashValue({ x: Number.NaN })).toThrow(HashUnsupportedValueError)
    expect(() => hashValue({ x: Number.POSITIVE_INFINITY })).toThrow(HashUnsupportedValueError)
  })

  it('weist Map und Set zurueck', () => {
    expect(() => hashValue({ m: new Map() })).toThrow(HashUnsupportedValueError)
    expect(() => hashValue({ s: new Set() })).toThrow(HashUnsupportedValueError)
  })

  it('behandelt negative Null wie Null', () => {
    expect(hashValue({ x: -0 })).toBe(hashValue({ x: 0 }))
  })
})
