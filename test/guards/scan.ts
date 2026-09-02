import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ESLint } from 'eslint'

export const ROOT = fileURLToPath(new URL('../..', import.meta.url))

/** Product source only — plan documents, tests and fixtures are explicitly out of scope. */
export function productionFiles(): string[] {
  const roots = [join(ROOT, 'packages'), join(ROOT, 'apps')]
  const out: string[] = []
  for (const base of roots) {
    collect(base, out)
  }
  return out.filter((f) => !f.endsWith('.test.ts'))
}

function collect(dir: string, out: string[]): void {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (['node_modules', 'dist', 'coverage', 'target', 'src-tauri'].includes(entry.name)) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) collect(full, out)
    else if (/\.(ts|tsx|js|mjs|json)$/.test(entry.name)) out.push(full)
  }
}

export interface Hit {
  file: string
  line: number
  text: string
}

/** Search production sources for a forbidden pattern. */
export function scan(pattern: RegExp, files = productionFiles()): Hit[] {
  const hits: Hit[] = []
  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split(/\r?\n/)
    lines.forEach((text, index) => {
      // A line that explains the rule is not a violation of it.
      if (/eslint-disable|GUARD-ALLOW/.test(text)) return
      const re = new RegExp(pattern.source, pattern.flags.replace('g', ''))
      if (re.test(text)) hits.push({ file: relative(ROOT, file), line: index + 1, text: text.trim() })
    })
  }
  return hits
}

/** Read a stored violation fixture. Fixtures live as .txt so they are never compiled. */
export function fixture(name: string): string {
  return readFileSync(join(ROOT, 'test', 'guards', 'fixtures', 'violating', `${name}.txt`), 'utf8')
}

/**
 * Run the project's real ESLint configuration against a snippet, pretending it lives at
 * `filePath`. This is how a guard proves the rule actually fires — not just that the
 * rule name appears somewhere in a config file.
 */
export async function lintAs(code: string, filePath: string): Promise<string[]> {
  const eslint = new ESLint({ cwd: ROOT })
  const results = await eslint.lintText(code, { filePath: join(ROOT, filePath), warnIgnored: false })
  return results.flatMap((r) => r.messages.map((m) => `${m.ruleId ?? 'error'}: ${m.message}`))
}
