/**
 * Stable hash over game state (R-ARCH-01/AK1, R-GAME-03/AK1).
 *
 * Two design points worth stating plainly:
 *
 *  - Object key order is ignored, list order is not. Key order is an accident of how
 *    an object was built; list order (players, provinces, armies) decides evaluation
 *    order and is therefore part of the simulation.
 *  - Anything that cannot survive a save/load round trip — undefined, functions, NaN,
 *    Map, Set — throws instead of hashing. The hash thus doubles as a guard that the
 *    state stayed plain JSON (design D-04).
 *
 * FNV-1a, computed twice with different offsets to give 64 bits of output. That is far
 * beyond what a per-tick comparison needs and cheap enough to run in a test loop.
 */

export class HashUnsupportedValueError extends Error {
  constructor(what: string, path: string) {
    super(`Nicht hashbarer Wert (${what}) bei: ${path || '<wurzel>'}`)
    this.name = 'HashUnsupportedValueError'
  }
}

export interface HashOptions {
  /** Keys skipped at every level — used to keep the event log out of the hash. */
  omitKeys?: readonly string[]
}

const PRIME = 0x01000193

function fnv1a(text: string, offset: number): number {
  let hash = offset >>> 0
  for (let i = 0; i < text.length; i++) {
    hash = (hash ^ text.charCodeAt(i)) >>> 0
    hash = Math.imul(hash, PRIME) >>> 0
  }
  return hash >>> 0
}

/**
 * Canonical text form of a value: sorted keys, explicit type markers so that
 * `"1"` and `1`, or `[]` and `{}`, can never collide.
 */
function canonical(value: unknown, omit: ReadonlySet<string>, path: string): string {
  if (value === null) return 'n'
  const type = typeof value

  if (type === 'boolean') return value === true ? 'bT' : 'bF'
  if (type === 'string') return `s:${(value as string).length}:${value as string}`
  if (type === 'number') {
    const num = value as number
    if (!Number.isFinite(num)) throw new HashUnsupportedValueError(String(num), path)
    // -0 and 0 are the same game value; keep them the same hash value too.
    return `i:${num === 0 ? 0 : num}`
  }
  if (type === 'undefined') throw new HashUnsupportedValueError('undefined', path)
  if (type === 'function') throw new HashUnsupportedValueError('function', path)
  if (type === 'bigint') throw new HashUnsupportedValueError('bigint', path)
  if (type === 'symbol') throw new HashUnsupportedValueError('symbol', path)

  if (Array.isArray(value)) {
    const parts = value.map((entry, index) => canonical(entry, omit, `${path}[${index}]`))
    return `a:${parts.length}:[${parts.join(',')}]`
  }

  const proto = Object.getPrototypeOf(value)
  if (proto !== Object.prototype && proto !== null) {
    throw new HashUnsupportedValueError(value?.constructor?.name ?? 'object', path)
  }

  const record = value as Record<string, unknown>
  const keys = Object.keys(record)
    .filter((key) => !omit.has(key))
    .sort()
  const parts = keys.map((key) => `${key}=${canonical(record[key], omit, path ? `${path}.${key}` : key)}`)
  return `o:${parts.length}:{${parts.join(',')}}`
}

/** 16 hex characters. Stable across machines and runs. */
export function hashValue(value: unknown, options: HashOptions = {}): string {
  const text = canonical(value, new Set(options.omitKeys ?? []), '')
  const a = fnv1a(text, 0x811c9dc5)
  const b = fnv1a(text, 0x1000193)
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0')
}

/** The canonical text itself — useful when a test needs to show *why* two states differ. */
export function canonicalText(value: unknown, options: HashOptions = {}): string {
  return canonical(value, new Set(options.omitKeys ?? []), '')
}
