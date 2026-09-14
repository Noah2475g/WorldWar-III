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
  build: { frontendDist: string; beforeBuildCommand: string; devUrl: string }
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
    // A file dialogue and the window basics. Nothing else — since T-M28-03 the save
    // files go through the shell's own narrow commands, so there is no fs plugin and
    // no fs permission left to grant. The plugin's scope check canonicalised existing
    // paths into the Windows `\\?\` form no pattern ever matched, which silently broke
    // every read-back in the packaged app (PROBLEME.md, 2026-09-08).
    expect(capability.permissions.some((p) => typeof p === 'string' && p.startsWith('fs:'))).toBe(false)
    expect(capability.permissions.some((p) => typeof p === 'string' && p.startsWith('dialog:'))).toBe(true)
    expect(capability.description).toContain('R-FREE-04')
  })

  it('baut die Oberflaeche mit und verpackt sie fuer alle drei Systeme', () => {
    expect(config.build.beforeBuildCommand).toContain('build')
    expect(config.bundle.active).toBe(true)
    for (const target of ['msi', 'deb', 'dmg']) {
      expect(config.bundle.targets, target).toContain(target)
    }
  })

  it('hat eine Rust-Schale ohne Spiellogik und ohne Netz', () => {
    // The game is the bundle; this only supplies a window and a place to save. Since
    // T-M28-03 "a place to save" means six own commands over $APPDATA/saves — file
    // I/O, no game rules. The old line-count cap made way for sharper assertions:
    // no networking, no path accepted from the caller (names are refused, not
    // sanitised, when they carry separators), and every command pinned to saves_dir.
    const main = readFileSync(join(TAURI, 'src/main.rs'), 'utf8')

    expect(main).toContain('tauri::Builder')
    expect(main).not.toMatch(/reqwest|hyper|ureq|TcpStream|UdpSocket/)
    // The whole write/read surface goes through the one checked path builder.
    expect(main).toContain('fn checked_name')
    expect(main).toContain("name.contains(['/', '\\\\', ':'])")
    expect(main).toContain('fn saves_dir')
    // No command takes a directory or a path — only a name and, for writes, data.
    expect(main).not.toMatch(/fn saves_\w+\([^)]*path/)
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

/**
 * Das ausgelieferte Programm bleibt netzfrei — geprüft am Erzeugnis (T-M38-05, R-MP-09/AK3).
 *
 * Noahs dritte Festlegung vom 2026-09-12: die Tauri-Anwendung kennt keinen Mehrspieler
 * und **darf ihn technisch nicht können**. Der Mehrspieler ist der Browserbau, gestartet
 * vom Hostdienst; damit bleibt Ziel Z3 für das Programm wörtlich wahr, das Noah
 * weitergibt, und R-FREE-04 verschiebt nicht seine Grenze, sondern benennt sie genauer
 * (D28.9).
 *
 * **Warum dieser Block neben dem oberen steht.** Der Block „R-FREE-04 Die Verpackung kann
 * nicht ins Netz" hält `tauri.conf.json` gegen `capabilities/local-only.json` — zwei
 * JSON-Dateien derselben Hand. Er ist für das, was er prüft, richtig, aber er prüft die
 * Absicht gegen sich selbst (Befunde 17, 20, 21). Hier kommt die zweite Seite deshalb aus
 * dem **kompilierten Programm**: `tauri-build` legt die Inhaltsrichtlinie als Zeichenkette
 * in die Binärdatei, und `scripts/measure-netfree.mjs` liest sie dort heraus. Die
 * Gleichheit der beiden Texte ist zugleich die Frischeprüfung: wer die Sperre lockert,
 * bekommt einen roten Lauf, bis ein neues Programm gebaut und neu gemessen ist.
 *
 * **Was dieser Wächter nicht kann, und das steht hier statt nirgends:** die Berechtigungen
 * sind im Erzeugnis **nicht** als Text zu finden (gemessen am 2026-09-14: `local-only` 0×,
 * `allow-open` 0×, `dialog:` 0×, während das Wort `dialog` 13× vorkommt). Tauri backt die
 * Zugriffsliste in eine eigene Darstellung. Die Berechtigungen bleiben deshalb eine
 * Aussage über die Konfiguration — und eine Suche nach `http:` in der Binärdatei findet
 * `build.devUrl` und wäre ein Fehlalarm mit Ansage.
 */

/** Eine Inhaltsrichtlinie in ihre Anweisungen zerlegt. */
export function directivesOf(csp: string): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const part of csp.split(';')) {
    const [name, ...values] = part.trim().split(/\s+/)
    if (name) out.set(name, values)
  }
  return out
}

/**
 * Wodurch eine Inhaltsrichtlinie eine Verbindung hinauslässt — leer heißt: durch nichts.
 *
 * Gelesen wird `connect-src`, und wenn es fehlt, greift `default-src`: eine Richtlinie
 * ohne `connect-src` ist nicht strenger, sondern erbt. Genau diese Vererbung ist der Weg,
 * auf dem eine Sperre lautlos verschwindet — jemand streicht die eine Zeile, und
 * `default-src 'self'` erlaubt wieder den eigenen Ursprung.
 */
export function networkOpenings(csp: string): string[] {
  const directives = directivesOf(csp)
  const connect = directives.get('connect-src') ?? directives.get('default-src')
  if (!connect) return ['weder connect-src noch default-src']
  return connect.filter((source) => source !== "'none'")
}

/** Welche Berechtigungen der Liste ins Netz führen. Leer heißt: keine. */
export function networkPermissions(permissions: readonly string[]): string[] {
  const prefixes = ['http:', 'websocket:', 'shell:', 'updater:', 'upload:']
  return permissions.filter((permission) => prefixes.some((prefix) => permission.startsWith(prefix)))
}

interface NetfreeReport {
  measuredAt: string
  measuredAtCommit: string | null
  csp: string
  permissions: string[]
  networkPermissions: string[]
  binary: {
    path: string
    bytes: number
    builtAt: string
    cspOccurrences: number
    connectSrcNone: number
    devUrlOccurrences: number
  } | null
  bundle: { files: number; bytes: number; withWebSocket: string[] } | null
}

const REPORT = join(ROOT, 'docs/reports/packaging-netfree.json')
const report = (): NetfreeReport => JSON.parse(readFileSync(REPORT, 'utf8')) as NetfreeReport

describe('R-MP-09/AK3 Das ausgelieferte Programm bleibt netzfrei', () => {
  it('laesst die Inhaltsrichtlinie keine einzige Verbindung hinaus', () => {
    const openings = networkOpenings(config.app.security.csp)
    expect(openings, `connect-src laesst hinaus: ${openings.join(', ')}`).toEqual([])
  })

  it('faellt, sobald jemand die Sperre lockert', () => {
    // Die Gegenprobe. Ohne sie waere die Zusicherung darueber die Aussage, dass irgendetwas
    // gelesen wurde — die Fehlerklasse vom 2026-09-05.
    expect(networkOpenings("default-src 'self'; connect-src 'self' ws://192.168.0.2:7749")).toEqual([
      "'self'",
      'ws://192.168.0.2:7749',
    ])
    // Die stille Art, die Sperre zu verlieren: connect-src streichen und default-src erben.
    expect(networkOpenings("default-src 'self'; img-src 'self' data:")).toEqual(["'self'"])
    expect(networkOpenings("img-src 'self'")).toHaveLength(1)
  })

  it('bittet um keine Berechtigung, die ins Netz fuehrt', () => {
    expect(networkPermissions(capability.permissions)).toEqual([])
    // Und auch hier die Gegenrichtung: die Regel erkennt eine, wenn es eine gaebe.
    expect(networkPermissions(['core:default', 'http:default', 'dialog:allow-open'])).toEqual([
      'http:default',
    ])
    expect(networkPermissions(['websocket:allow-connect'])).toHaveLength(1)
  })

  it('traegt dieselbe Richtlinie im gebauten Programm wie in der Konfiguration', () => {
    // Die eine Zusicherung, die nicht die Absicht gegen sich selbst haelt: links steht
    // `tauri.conf.json`, rechts die Zeichenkette, die aus `worldwar.exe` gelesen wurde.
    const gemessen = report()

    expect(gemessen.binary, 'der Bericht kennt kein Erzeugnis — dann lief kein Bau').not.toBeNull()
    expect(
      gemessen.csp,
      'die Richtlinie hat sich seit der Messung geaendert — neu bauen und neu messen',
    ).toBe(config.app.security.csp)
    expect(gemessen.binary?.cspOccurrences, 'die Richtlinie steht nicht im Programm').toBe(1)
    expect(gemessen.binary?.connectSrcNone).toBeGreaterThanOrEqual(1)
    expect(gemessen.binary?.bytes, 'ein Erzeugnis dieser Groesse ist keines').toBeGreaterThan(1_000_000)
    expect(gemessen.networkPermissions).toEqual([])
  })

  it('misst das Erzeugnis noch einmal, wenn es auf dieser Maschine liegt', () => {
    // Ein Bericht ist ein Zeuge und kein Beweis. Liegt das Programm hier, wird es gelesen
    // und gegen den Bericht gehalten; liegt es nicht hier, sagt die Zusicherung das.
    const gemessen = report()
    const exe = join(ROOT, gemessen.binary?.path ?? 'nichts')
    if (!existsSync(exe)) {
      expect(
        gemessen.binary?.path,
        'kein Erzeugnis auf dieser Maschine — es bleibt beim Bericht',
      ).toBeTruthy()
      return
    }

    const data = readFileSync(exe)
    expect(data.length).toBe(gemessen.binary?.bytes)
    expect(data.includes(Buffer.from(config.app.security.csp, 'utf8'))).toBe(true)
    expect(data.includes(Buffer.from("connect-src 'self'", 'utf8'))).toBe(false)
  })

  it('haelt den Mehrspielereinstieg aus dem gebauten Buendel heraus', () => {
    // „Nicht erreichbar" heisst hier: was `vite build` zusammenlegt, enthaelt keinen
    // WebSocket. Gemessen am Buendel und nicht am Quelltext — was der Bau wirklich
    // mitnimmt, entscheidet der Bau.
    const gemessen = report()

    expect(gemessen.bundle, 'kein gebautes Buendel im Bericht — pnpm desktop:build lief nie').not.toBeNull()
    expect(gemessen.bundle?.bytes, 'ein Buendel dieser Groesse ist keines').toBeGreaterThan(500_000)
    expect(
      gemessen.bundle?.withWebSocket,
      `WebSocket im ausgelieferten Buendel: ${gemessen.bundle?.withWebSocket.join(', ')}`,
    ).toEqual([])
  })
})
