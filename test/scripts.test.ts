import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('..', import.meta.url))
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  scripts: Record<string, string>
}

/** Every script named in design section D15 must exist. */
const REQUIRED_SCRIPTS = [
  'test',
  'test:slow',
  'test:watch',
  'coverage',
  'coverage:requirements',
  'lint',
  'typecheck',
  'build',
  'map:build',
  'sim:long',
  'sim:tournament',
  'bench',
  'balance:sweep',
  'dev',
  'tauri:dev',
  'verify',
]

describe('T-M0-02 script surface', () => {
  it.each(REQUIRED_SCRIPTS)('defines "%s"', (name) => {
    expect(pkg.scripts[name], `package.json is missing script "${name}" (design D15)`).toBeTruthy()
  })

  it('every referenced script file exists', () => {
    const missing: string[] = []
    for (const [name, command] of Object.entries(pkg.scripts)) {
      for (const match of command.matchAll(/(scripts\/[\w.-]+\.mjs)/g)) {
        const file = match[1]!
        if (!existsSync(new URL(file, `file://${root.replace(/\\/g, '/')}`))) {
          missing.push(`${name} -> ${file}`)
        }
      }
    }
    expect(missing, `referenced but absent: ${missing.join(', ')}`).toEqual([])
  })

  it('keeps long runs out of the fast suite', () => {
    // pnpm verify runs after every task and must stay short; slow runs have their own config.
    expect(pkg.scripts['test:slow']).toContain('vitest.slow.config.ts')
    expect(pkg.scripts['test']).not.toContain('slow')
  })

  it('R-ARCH-05 verify does not include the requirements gate', () => {
    // coverage:requirements is red by design until the very last task; wiring it into
    // verify would block every one of the 83 tasks (plan review, blocker 1).
    const verify = readFileSync(new URL('../scripts/verify.mjs', import.meta.url), 'utf8')
    // Look for it as an executed argument, not as prose: the file explains in a comment
    // why the gate is excluded, and that mention must not fail the test.
    expect(verify).not.toMatch(/\[\s*['"]coverage:requirements['"]\s*\]/)
  })
})
