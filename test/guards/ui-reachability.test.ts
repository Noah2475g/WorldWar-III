import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROOT } from './scan.ts'
import {
  REACHABILITY_EXCEPTIONS,
  importsOf,
  reachableFrom,
  resolveImport,
  unreachableModules,
} from './reachability.ts'

/**
 * Nothing built stays unwired (T-M13-04, R-UI-08).
 *
 * Three times in this project a module was built, unit-tested and never imported by
 * anything the player runs: the icon set, the sound, the guided introduction. Every one
 * of them had a green test, and the requirement each was supposed to satisfy counted as
 * covered. The failure is invisible from below — only the import chain from the entry
 * point can see it.
 *
 * Both directions are checked, as every guard in this repository is: the real
 * application is clean, and a synthetic orphan is caught.
 */

const DESKTOP = join(ROOT, 'apps/desktop/src')
const ENTRY = [join(DESKTOP, 'main.tsx')]

describe('R-UI-08 Jedes Modul der Anwendung ist erreichbar', () => {
  it('findet von main.tsx aus jedes Modul unter apps/desktop/src', () => {
    const orphans = unreachableModules(ENTRY, DESKTOP)

    expect(
      orphans,
      `Diese Module erreicht die laufende Anwendung nicht:\n${orphans.join('\n')}\n` +
        'Entweder verdrahten oder loeschen — oder mit einer Begruendung in REACHABILITY_EXCEPTIONS eintragen.',
    ).toEqual([])
  })

  it('begruendet jede Ausnahme in einem Satz', () => {
    // An exception nobody can justify is a module nobody needs.
    for (const [file, reason] of Object.entries(REACHABILITY_EXCEPTIONS)) {
      expect(reason.length, `${file} hat keine echte Begruendung`).toBeGreaterThan(40)
    }
  })
})

describe('R-UI-08 Der Waechter erkennt eine Waise', () => {
  // A synthetic file map rather than a real orphan in the product tree: an orphan
  // planted under apps/desktop/src to prove the guard works would be exactly the thing
  // the guard exists to forbid.
  // Paths go through resolve() so the map speaks the platform's own dialect — on
  // Windows a hand-written "/app/main.tsx" and the resolver's "C:\app\main.tsx" are two
  // different files, and the guard would find nothing at all.
  const path = (relative: string): string => resolve('/app', relative)
  const files = new Map([
    [path('main.tsx'), "import { App } from './App.tsx'"],
    [path('App.tsx'), "import { Panel } from './ui/Panel.tsx'\nimport './ui/app.css'"],
    [path('ui/Panel.tsx'), "import { Icon } from './icons.tsx'"],
    [path('ui/icons.tsx'), 'export const Icon = () => null'],
    [path('ui/orphan.ts'), "import { Icon } from './icons.tsx'"],
  ])
  const set = new Set(files.keys())
  const read = (file: string): string => files.get(file) ?? ''

  it('erreicht, was verdrahtet ist', () => {
    const reached = reachableFrom([path('main.tsx')], set, read)

    expect([...reached].sort()).toEqual(
      [path('App.tsx'), path('main.tsx'), path('ui/Panel.tsx'), path('ui/icons.tsx')].sort(),
    )
  })

  it('erreicht nicht, was niemand importiert — auch wenn es selbst importiert', () => {
    // The orphan pulls in the icon set, so it looks connected from inside. It is not.
    const reached = reachableFrom([path('main.tsx')], set, read)

    expect(reached.has(path('ui/orphan.ts'))).toBe(false)
  })

  it('liest jede Form des Imports', () => {
    const source = [
      "import { a } from './a.ts'",
      "import './b.css'",
      "export { c } from './c.ts'",
      "const d = await import('./d.ts')",
      "// import { e } from './e.ts'",
    ].join('\n')

    expect(importsOf(source)).toContain('./a.ts')
    expect(importsOf(source)).toContain('./b.css')
    expect(importsOf(source)).toContain('./c.ts')
    expect(importsOf(source)).toContain('./d.ts')
  })

  it('loest nur relative Pfade auf — Paketimporte gehoeren nicht hierher', () => {
    expect(resolveImport(path('main.tsx'), 'react', set)).toBeNull()
    expect(resolveImport(path('main.tsx'), './App.tsx', set)).toBe(path('App.tsx'))
  })

  it('findet ein Modul auch ohne ausgeschriebene Endung', () => {
    // The codebase writes them out; if that style ever changes the guard must not
    // silently start reporting every module as unreachable.
    const withoutExtension = new Map([
      [path('plain.tsx'), "import './plainHelper'"],
      [path('plainHelper.ts'), ''],
    ])
    const reached = reachableFrom([path('plain.tsx')], new Set(withoutExtension.keys()), (f) => withoutExtension.get(f) ?? '')

    expect(reached.has(path('plainHelper.ts'))).toBe(true)
  })
})
