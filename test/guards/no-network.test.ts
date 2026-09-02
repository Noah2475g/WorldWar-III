import { describe, expect, it } from 'vitest'
import { fixture, scan } from './scan'

/**
 * Product goal Z3: the game runs offline, without an account, and never phones home.
 * Tauri permissions enforce this at runtime (T-M11-03); this guard catches it at source level.
 */
const NETWORK_CALLS =
  /\b(fetch\s*\(|XMLHttpRequest|new WebSocket|navigator\.sendBeacon|axios|node:https?|require\(['"]https?['"]\))/

describe('R-FREE-04 keine Netzwerkzugriffe im Produktcode', () => {
  it('findet keine ausgehenden Verbindungen', () => {
    const hits = scan(NETWORK_CALLS)
    expect(
      hits,
      `Netzwerkzugriffe gefunden:\n${hits.map((h) => `${h.file}:${h.line}  ${h.text}`).join('\n')}`,
    ).toEqual([])
  })

  it('schlaegt bei der hinterlegten Verstoss-Fixture an', () => {
    const offending = fixture('network')
      .split(/\r?\n/)
      .filter((line) => NETWORK_CALLS.test(line))
    expect(offending.length).toBeGreaterThan(0)
  })
})
