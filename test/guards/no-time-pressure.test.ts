import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROOT, fixture, scan } from './scan'

/**
 * The other half of product goal Z2: even without a currency, a game can still sell
 * impatience. No energy bars, no cooldowns that money removes, no "rush this build".
 * Waiting is solved for everyone by the speed control (Z1) — free, for all players.
 */
const WAIT_OR_PAY = /\b(energy|stamina|waitUntil|boostUntil|cooldownPaid|rushCost|speedUpCost|instantFinishPrice)\b/

describe('R-FREE-05 kein zeitbasierter Druck', () => {
  it('findet keine Warte-oder-zahle-Felder im Produktcode', () => {
    const hits = scan(WAIT_OR_PAY)
    expect(
      hits,
      `Warte-/Druckmechanik gefunden:\n${hits.map((h) => `${h.file}:${h.line}  ${h.text}`).join('\n')}`,
    ).toEqual([])
  })

  it('schlaegt bei der hinterlegten Verstoss-Fixture an', () => {
    const offending = fixture('time-pressure')
      .split(/\r?\n/)
      .filter((line) => WAIT_OR_PAY.test(line))
    expect(offending.length).toBeGreaterThan(0)
  })
})

describe('R-FREE-03 Beschleunigen kostet nichts', () => {
  it('kennt in den Regeldateien keinen Beschleunigungspreis', () => {
    // Balancing data is where such a cost would realistically sneak in.
    const rulesDir = join(ROOT, 'data', 'rules')
    const files: string[] = []
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
        else if (entry.name.endsWith('.json')) files.push(full)
      }
    }
    walk(rulesDir)

    const offenders = files.filter((f) => /rushCost|speedUpCost|instantFinish|goldCost/i.test(readFileSync(f, 'utf8')))
    expect(offenders, `Beschleunigungskosten in: ${offenders.join(', ')}`).toEqual([])
  })
})
