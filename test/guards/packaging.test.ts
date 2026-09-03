import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROOT } from './scan'

/**
 * The packaged programme cannot reach the network (T-M11-03, R-FREE-04, goal Z3).
 *
 * "The game never phones home" is the one promise that cannot be kept by intention:
 * a dependency, a font, an analytics snippet added in a hurry — any of them would
 * break it silently. So it is enforced twice over and checked here: the shell asks for
 * no networking permission at all, and the content policy forbids outgoing connections
 * even if something tried.
 */

const TAURI = join(ROOT, 'apps/desktop/src-tauri')
const config = JSON.parse(readFileSync(join(TAURI, 'tauri.conf.json'), 'utf8')) as {
  app: { security: { csp: string; capabilities: string[] } }
  build: { frontendDist: string; beforeBuildCommand: string }
  bundle: { active: boolean; targets: string[] }
}
const capability = JSON.parse(readFileSync(join(TAURI, 'capabilities/local-only.json'), 'utf8')) as {
  permissions: string[]
  description: string
}

describe('R-FREE-04 Die Verpackung kann nicht ins Netz', () => {
  it('bittet um keine einzige Netzberechtigung', () => {
    const forbidden = ['http:', 'shell:', 'updater:', 'websocket']
    for (const permission of capability.permissions) {
      for (const bad of forbidden) {
        expect(permission.startsWith(bad), `${permission} erlaubt Netzzugriff`).toBe(false)
      }
    }
  })

  it('verbietet ausgehende Verbindungen auch in der Inhaltsrichtlinie', () => {
    // Belt and braces: even if a dependency tried, the webview refuses.
    expect(config.app.security.csp).toContain("connect-src 'none'")
    expect(config.app.security.csp).toContain("default-src 'self'")
    expect(config.app.security.csp).not.toContain('http://')
    expect(config.app.security.csp).not.toContain('https://')
  })

  it('erlaubt genau die Berechtigungen, die das Spiel braucht', () => {
    // Saving to disk and a file dialogue. Nothing else.
    expect(capability.permissions.some((p) => p.startsWith('fs:'))).toBe(true)
    expect(capability.permissions.some((p) => p.startsWith('dialog:'))).toBe(true)
    expect(capability.description).toContain('R-FREE-04')
  })

  it('baut die Oberflaeche mit und verpackt sie fuer alle drei Systeme', () => {
    expect(config.build.beforeBuildCommand).toContain('build')
    expect(config.bundle.active).toBe(true)
    for (const target of ['msi', 'deb', 'dmg']) {
      expect(config.bundle.targets, target).toContain(target)
    }
  })

  it('hat eine Rust-Schale ohne Spiellogik', () => {
    // The game is the bundle; this only supplies a window and a place to save.
    const main = readFileSync(join(TAURI, 'src/main.rs'), 'utf8')

    expect(main).toContain('tauri::Builder')
    expect(main).not.toMatch(/reqwest|hyper|ureq|TcpStream/)
    expect(main.split('\n').length).toBeLessThan(30)
  })

  it('bringt die Karte mit, statt sie zu laden', () => {
    // An offline game cannot fetch its own world map.
    expect(existsSync(join(ROOT, 'data/maps/world.json'))).toBe(true)
    const main = readFileSync(join(ROOT, 'apps/desktop/src/main.tsx'), 'utf8')
    expect(main).toContain("with { type: 'json' }")
    expect(main).not.toMatch(/fetch\(/)
  })
})
