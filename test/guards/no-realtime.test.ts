import { describe, expect, it } from 'vitest'
import { scan } from './scan'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { ROOT } from './scan'

/**
 * R-TIME-05: nothing in the game advances with the wall clock. Close the program,
 * and the world stands still. This is what separates our speed control from the
 * original's "come back in three hours" design.
 */
const WALL_CLOCK = /\b(Date\.now|new Date\(|performance\.now|setTimeout|setInterval)\b/

function coreFiles(): string[] {
  const out: string[] = []
  const walk = (dir: string): void => {
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) out.push(full)
    }
  }
  walk(join(ROOT, 'packages', 'core', 'src'))
  return out
}

describe('R-TIME-05 Spielzeit ist von der Wanduhr entkoppelt', () => {
  it('der Kern liest die Uhr nirgends', () => {
    const hits = scan(WALL_CLOCK, coreFiles())
    expect(
      hits,
      `Uhrzugriff im Kern:\n${hits.map((h) => `${relative(ROOT, h.file)}:${h.line}  ${h.text}`).join('\n')}`,
    ).toEqual([])
  })

  it('schlaegt an, sobald der Kern die Uhr liest', () => {
    const violating = readFileSync(join(ROOT, 'test', 'guards', 'fixtures', 'violating', 'realtime.txt'), 'utf8')
    const offending = violating.split(/\r?\n/).filter((line) => WALL_CLOCK.test(line))
    expect(offending.length).toBeGreaterThan(0)
  })
})
