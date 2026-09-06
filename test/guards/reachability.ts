import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname, relative, resolve } from 'node:path'
import { ROOT } from './scan.ts'

/**
 * Which modules the running application actually reaches (T-M13-04, R-UI-08).
 *
 * This exists because of a failure that happened three times in this project: a module
 * was built, unit-tested and never imported by anything the player runs. The icon set,
 * the sound, the guided introduction — all three had green tests and none of them was
 * in the game. A test that only exercises the building block cannot see that; only
 * following the import chain from the entry point can.
 *
 * Kept as a pure function over a file map so the check itself can be tested in both
 * directions without planting an orphan in the product tree.
 */

/**
 * Import specifiers a module names: `from '…'`, `import '…'` and `import('…')`.
 *
 * Matched on the specifier rather than on the whole statement, because this codebase
 * writes long import lists across a dozen lines and a line-bound pattern misses every
 * one of them — the first version of this guard declared `game/actions.ts` unreachable
 * for exactly that reason, while App.tsx imports eight names from it.
 *
 * The looseness cuts the safe way: an extra edge makes the guard more forgiving, a
 * missed edge would make it cry wolf about a module that is perfectly well wired.
 */
export function importsOf(source: string): string[] {
  const out: string[] = []
  const patterns = [/\bfrom\s*['"]([^'"]+)['"]/g, /\bimport\s*\(?\s*['"]([^'"]+)['"]/g]
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) out.push(match[1]!)
  }
  return out
}

/**
 * Resolves one specifier against the file it appears in.
 *
 * Only relative specifiers matter: a package import leaves this application and is
 * somebody else's reachability question. Extensions are written out in this codebase,
 * which is what makes the resolution honest rather than a guess — but the extensionless
 * and index forms are covered too, so a future style change fails loudly instead of
 * silently declaring modules unreachable.
 */
export function resolveImport(fromFile: string, specifier: string, files: ReadonlySet<string>): string | null {
  if (!specifier.startsWith('.')) return null

  const base = resolve(dirname(fromFile), specifier)
  const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]
  return candidates.find((candidate) => files.has(candidate)) ?? null
}

/**
 * Every module reachable from the entry points, following relative imports.
 *
 * `read` is injected so the walk can run over a synthetic file map in a test.
 */
export function reachableFrom(
  entries: readonly string[],
  files: ReadonlySet<string>,
  read: (file: string) => string,
): Set<string> {
  const seen = new Set<string>()
  const queue = [...entries]

  while (queue.length > 0) {
    const file = queue.pop()!
    if (seen.has(file) || !files.has(file)) continue
    seen.add(file)

    for (const specifier of importsOf(read(file))) {
      const target = resolveImport(file, specifier, files)
      if (target && !seen.has(target)) queue.push(target)
    }
  }

  return seen
}

/** Source files of the application: no tests, no benchmarks, no stylesheets. */
export function applicationModules(dir: string): string[] {
  const out: string[] = []
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (['node_modules', 'dist', 'coverage'].includes(entry.name)) continue
      const full = join(current, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|bench)\./.test(entry.name)) out.push(full)
    }
  }
  walk(dir)
  return out
}

/**
 * Modules that no chain from the entry points reaches.
 *
 * Every exception carries a reason in one sentence. That is the whole point of writing
 * them down here rather than filtering them away silently: an exception nobody can
 * justify is a module nobody needs.
 */
export const REACHABILITY_EXCEPTIONS: Readonly<Record<string, string>> = {
  'apps/desktop/src/index.ts':
    'Paketeinstieg (package.json "main") fuer andere Pakete, nicht Teil der laufenden Anwendung.',
}

export function unreachableModules(entryFiles: readonly string[], directory: string): string[] {
  const modules = applicationModules(directory)
  const files = new Set(modules)
  const reached = reachableFrom(entryFiles, files, (file) => readFileSync(file, 'utf8'))

  return modules
    .filter((file) => !reached.has(file))
    .map((file) => relative(ROOT, file).replace(/\\/g, '/'))
    .filter((file) => !(file in REACHABILITY_EXCEPTIONS))
    .sort()
}
