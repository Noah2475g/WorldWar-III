import { readFileSync, existsSync, statSync } from 'node:fs'
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
  bundle: { active: boolean; targets: string[]; icon: string[] }
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

/**
 * R-PKG-01: der Bau ist gelaufen, nicht nur beschrieben (T-M16-03).
 *
 * Der Block darüber prüft die Konfiguration gegen sich selbst — `tauri.conf.json` gegen
 * `capabilities/local-only.json`, zwei Dateien derselben Hand. Er ist für das, was er
 * prüft, richtig, und er blieb **grün, während nie ein Bau gelaufen war**: bis zum
 * 2026-09-06 hatte `@tauri-apps/cli` null Treffer im Lockfile, es gab kein `Cargo.lock`
 * und im ganzen Projekt keine einzige Bilddatei.
 *
 * Dieser Block hängt deshalb ausschließlich an Dingen, die ein Bau **hinterlässt** oder
 * ohne die er **abbricht**. Zwei davon sind teuer gelernt: `tauri-build` bricht mit
 * „`icons/icon.ico` not found" ab, und der Bundler danach mit „Couldn't find a .ico icon",
 * wenn die Datei zwar existiert, aber nicht in `bundle.icon` steht. Beides sagt die
 * Tauri-Vorlage nirgends.
 */
describe('R-PKG-01 Die Verpackung ist gebaut worden', () => {
  it('fuehrt die Werkzeugkette im Lockfile', () => {
    // Ein Eintrag in package.json ohne Eintrag im Lockfile heisst: nie installiert.
    const lock = readFileSync(join(ROOT, 'pnpm-lock.yaml'), 'utf8')
    expect(lock, '@tauri-apps/cli fehlt im Lockfile - dann lief kein Bau').toContain('@tauri-apps/cli')

    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
      devDependencies: Record<string, string>
    }
    expect(pkg.devDependencies['@tauri-apps/cli']).toBeTruthy()
  })

  it('hat ein Cargo.lock, das nur ein Bau erzeugt', () => {
    const lock = join(TAURI, 'Cargo.lock')
    expect(existsSync(lock), 'Cargo.lock fehlt - dann hat cargo nie aufgeloest').toBe(true)
    expect(readFileSync(lock, 'utf8')).toContain('name = "worldwar"')
  })

  it('hat die Symbole, ohne die der Bau abbricht', () => {
    // Die .png allein genuegt auf Windows nicht: tauri-build verlangt zusaetzlich eine
    // .ico fuer die Windows-Ressource, und der Bundler verlangt sie in bundle.icon.
    for (const name of ['icon.png', 'icon.ico']) {
      const file = join(TAURI, 'icons', name)
      expect(existsSync(file), `${name} fehlt - der Bau bricht daran ab`).toBe(true)
      expect(statSync(file).size, `${name} ist leer`).toBeGreaterThan(512)
    }
    expect(config.bundle.icon, 'icon.ico steht nicht in bundle.icon').toContain('icons/icon.ico')
  })

  it('erzeugt die Symbole aus dem Entwurf, statt sie zu beziehen', () => {
    // R-ASSET-01: keine Fremdassets. Ein Bild, das niemand neu bauen kann, ist ein Bild,
    // das niemand aendern kann - deshalb ist das Symbol ein Skript und keine Datei.
    const script = readFileSync(join(ROOT, 'scripts/build-icon.mjs'), 'utf8')
    expect(script).not.toMatch(/https?:\/\//)
    for (const token of ['0xe4, 0xe0, 0xd2', '0xb3, 0x34, 0x1e']) {
      expect(script, 'das Symbol nutzt nicht die Farben der Oberflaeche').toContain(token)
    }
  })
})
