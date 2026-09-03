import { TEST_RULES, smallWorld } from '@worldwar/testkit'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { playTournament } from '../src/tournament'

/**
 * The full tournament (R-AI-06). Runs only via `pnpm test:slow`.
 *
 * Fifty matches take minutes, and `pnpm verify` runs after every task — putting this
 * in the normal suite would make the whole TDD loop unusable, and the next step after
 * that is someone starting to skip tests.
 */
const map = smallWorld()
const rules = TEST_RULES

describe('R-AI-06 Schwer schlaegt Leicht', () => {
  it('gewinnt in mindestens 70 Prozent von 50 Partien', () => {
    const result = playTournament({
      map,
      rules,
      difficulties: ['hard', 'easy'],
      matches: 50,
      days: 40,
    })

    const dir = fileURLToPath(new URL('../../../docs/reports/', import.meta.url))
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      `${dir}ai-tournament.md`,
      [
        '# KI-Turnier (T-M7-05)',
        '',
        `50 Partien "schwer" gegen "leicht", 40 Spieltage je Partie, Seiten jede zweite Partie getauscht.`,
        '',
        `- Siege schwer: ${result.winsA}`,
        `- Siege leicht: ${result.winsB}`,
        `- Unentschieden: ${result.draws}`,
        `- Siegquote schwer: ${Math.round(result.winRateA * 100)} %`,
        '',
        'Anforderung R-AI-06: mindestens 70 % für die höhere Stufe.',
        '',
      ].join('\n'),
    )

    expect(result.winRateA).toBeGreaterThanOrEqual(0.7)
  })
})
