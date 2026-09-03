import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { productionFiles } from './scan'

/**
 * No invisible characters in source files.
 *
 * This guard exists because of a real one. A patch applied through the shell replaced
 * two spaces in `adjacency.ts` with NUL bytes, and nothing noticed: the code used the
 * same character on both sides of a split, so every test stayed green while the file
 * was no longer text. Tools that treat it as binary — grep, diffs, review — quietly
 * stop working on it.
 *
 * Checked by character code rather than by a regular expression, because a pattern
 * containing control characters is itself the thing ESLint warns about — and a guard
 * that needs an exemption from a rule it agrees with is a guard nobody trusts.
 */
function firstControlCharacter(text: string): { at: number; code: number } | null {
  for (let at = 0; at < text.length; at++) {
    const code = text.charCodeAt(at)
    // Tab, newline and carriage return are text. Everything else below space is not.
    if (code > 31 || code === 9 || code === 10 || code === 13) continue
    return { at, code }
  }
  return null
}

describe('C-08 Quelldateien enthalten keine Steuerzeichen', () => {
  it('findet keine unsichtbaren Zeichen im Produktcode', () => {
    const offenders: string[] = []
    for (const file of productionFiles()) {
      const found = firstControlCharacter(readFileSync(file, 'utf8'))
      if (!found) continue
      offenders.push(`${file}: U+${found.code.toString(16).padStart(4, '0')} bei Zeichen ${found.at}`)
    }
    expect(offenders, `Steuerzeichen gefunden:\n${offenders.join('\n')}`).toEqual([])
  })

  it('schlaegt bei einem eingeschleusten Nullbyte an', () => {
    expect(firstControlCharacter('const a = 1\u0000+ 2')).toEqual({ at: 11, code: 0 })
    expect(firstControlCharacter('const a = 1 + 2\n')).toBeNull()
    // Tab and newline are text, not control noise.
    expect(firstControlCharacter('\tconst a = 1\r\n')).toBeNull()
  })
})
