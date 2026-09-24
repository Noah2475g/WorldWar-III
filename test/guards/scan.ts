import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ESLint } from 'eslint'

export const ROOT = fileURLToPath(new URL('../..', import.meta.url))

/**
 * Eine Testdatei, an ihrem Namen erkannt (T-M38-11, Befund M38-4).
 *
 * Bis zum 2026-09-18 stand hier `!f.endsWith('.test.ts')` — und eine `.test.tsx` endet
 * nicht auf `.test.ts`. 22 von 205 Dateien, die `productionFiles()` lieferte, waren
 * Testdateien der Oberflaeche. Beide Endungen in EINEM Ausdruck, damit die naechste
 * (`.test.mts`, `.test.jsx`) nicht wieder eine eigene Zeile braucht, die jemand vergisst.
 */
export function isTestFile(file: string): boolean {
  return /\.test\.[cm]?[jt]sx?$/.test(file)
}

/** Product source only — plan documents, tests and fixtures are explicitly out of scope. */
export function productionFiles(): string[] {
  const roots = [join(ROOT, 'packages'), join(ROOT, 'apps')]
  const out: string[] = []
  for (const base of roots) {
    collect(base, out)
  }
  return out.filter((f) => !isTestFile(f))
}

function collect(dir: string, out: string[]): void {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    // `dist-mp` ist der zweite Bau, mit der Mehrspielerflagge (T-M39-04) - erzeugter
    // Code und kein Produktcode. Er heisst nicht `dist`, weil `vite build --outDir dist`
    // ihn beim naechsten Lauf loeschen wuerde; das kostet ihn hier einen eigenen Eintrag,
    // und ohne den meldet der Netz-Waechter das gebuendelte `new WebSocket` als Verstoss.
    if (['node_modules', 'dist', 'dist-mp', 'coverage', 'target', 'src-tauri'].includes(entry.name)) continue
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
let sharedEslint: ESLint | null = null

export async function lintAs(code: string, filePath: string): Promise<string[]> {
  // Eine Instanz je Arbeiter: die erste Pruefung laedt die Konfiguration samt
  // typbewusstem Parser und ist der teure Teil — jede weitere ist Millisekunden.
  const eslint = (sharedEslint ??= new ESLint({ cwd: ROOT }))
  const results = await eslint.lintText(code, { filePath: join(ROOT, filePath), warnIgnored: false })
  return results.flatMap((r) => r.messages.map((m) => `${m.ruleId ?? 'error'}: ${m.message}`))
}
