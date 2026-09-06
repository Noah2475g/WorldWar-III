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

/**
 * Tempo, Pause und Vorspulziel gehören nicht in den Spielstand (T-M15-06, R-TIME-05/AK2).
 *
 * Der Zustand ist die Welt, nicht die Betrachtung der Welt. Läge das Tempo darin, wäre
 * es hashwirksam, wanderte in jeden Spielstand und in jede Wiedergabe — und zwei Spieler
 * mit demselben Stand bekämen verschiedene Hashes, weil einer schneller zusieht. Genau
 * das trennt die Geschwindigkeitsregelung dieses Spiels von einer Spielmechanik.
 */
describe('R-TIME-05/AK2 Die Betrachtung liegt nicht im Zustand', () => {
  const stateTypes = readFileSync(join(ROOT, 'packages/core/src/state/types.ts'), 'utf8')

  /** Der Rumpf von `interface GameState` — nur die oberste Ebene. */
  const gameState = (): string => {
    const start = stateTypes.indexOf('export interface GameState {')
    return stateTypes.slice(start, stateTypes.indexOf('\n}', start))
  }

  it('kennt kein Feld fuer Tempo, Pause oder Vorspulziel', () => {
    const verboten = /\b(speed|hoursPerSecond|paused|pause|fastForward|fastForwarding|realTime|wallClock)\b/i
    const treffer = gameState()
      .split('\n')
      .filter((line) => verboten.test(line) && !line.trim().startsWith('*') && !line.trim().startsWith('//'))

    expect(treffer, `Betrachtungszustand im GameState:\n${treffer.join('\n')}`).toEqual([])
  })

  it('prueft eine nicht leere Menge — sonst waere die Zusicherung wertlos', () => {
    // Die Lehre aus der fehlenden Schrift (T-M14-09): ein Wächter über einer leeren Menge
    // ist immer grün. Hier ist es der Rumpf des Zustands, und er hat Felder.
    expect(gameState().split('\n').length).toBeGreaterThan(20)
    expect(gameState()).toContain('tick')
  })
})
