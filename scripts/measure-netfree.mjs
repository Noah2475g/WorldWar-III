#!/usr/bin/env node
/**
 * Ist das ausgelieferte Programm netzfrei? Gemessen am Erzeugnis (T-M38-05, R-MP-09/AK3).
 *
 * Noahs dritte Festlegung vom 2026-09-12 lautet: die Tauri-Anwendung behält ihre Sperre
 * **wörtlich** — `connect-src 'none'`, keine Netzberechtigung. Der Mehrspieler läuft über
 * den Browser und den Hostdienst, nicht über das Programm, das Noah weitergibt.
 *
 * **Warum ein eigener Lauf und nicht nur ein Test:** der alte Verpackungswächter hielt
 * `tauri.conf.json` gegen `capabilities/local-only.json` — zwei JSON-Dateien derselben
 * Hand. Er prüfte damit die Absicht gegen sich selbst und wäre grün geblieben, wenn kein
 * Bau je gelaufen wäre (Befunde 17, 20, 21; derselbe Fehler traf 2026-09-06 die ganze
 * Verpackung). Dieser Lauf liest das **kompilierte Programm**: `tauri-build` legt die
 * Inhaltsrichtlinie als Zeichenkette in die Binärdatei, direkt hinter die
 * Bündelkennung. Findet sie sich dort nicht — oder anders —, ist das Erzeugnis nicht das,
 * was die Konfiguration behauptet.
 *
 * Aufruf:
 *
 * ```bash
 * # Beide Buendel bauen — ohne Flagge und mit ihr (T-M39-04):
 * pnpm -C apps/desktop build
 * WORLDWAR_MULTIPLAYER=1 pnpm -C apps/desktop exec vite build --outDir dist-mp
 * pnpm tauri:build                                       # fuer das Erzeugnis selbst
 *
 * node scripts/measure-netfree.mjs                       # Vorgabepfade
 * node scripts/measure-netfree.mjs <exe> <dist> <dist-mp>
 * ```
 *
 * Auf Windows ohne POSIX-Schale setzt `pnpm mp:host` die Flagge selbst; der Ordner heisst
 * dann `dist` und nicht `dist-mp`. Wer nur messen will, setzt die Variable von Hand.
 *
 * Schreibt `docs/reports/packaging-netfree.json`. Der Wächter `test/guards/packaging.test.ts`
 * hält den dort festgehaltenen Text gegen die **heutige** Konfiguration: wer die Sperre
 * lockert, bekommt einen roten Lauf, bis ein neues Programm gebaut und neu gemessen ist.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))

const TAURI = join(root, 'apps/desktop/src-tauri')
const DEFAULT_EXE = join(TAURI, 'target/release/worldwar.exe')
const DEFAULT_DIST = join(root, 'apps/desktop/dist')
/**
 * Derselbe Bau, aber mit `WORLDWAR_MULTIPLAYER=1` (T-M39-04).
 *
 * Er wird gemessen, damit die Zusage darueber nicht aus Unterlassung besteht: „kein
 * WebSocket im ausgelieferten Buendel" ist nur dann eine Aussage ueber die BAUFLAGGE, wenn
 * derselbe Quelltext mit Flagge einen enthaelt. Angelegt von
 * `vite build --outDir dist-mp` mit gesetzter Flagge.
 */
const DEFAULT_DIST_MP = join(root, 'apps/desktop/dist-mp')

/**
 * Woran ein Netzzugriff in einer **Berechtigungsliste** zu erkennen ist. Absichtlich die
 * Präfixe der Tauri-Kerne und nicht das Wort „network": eine Berechtigung heißt
 * `http:default`, nicht `network:allow`.
 *
 * **Nur für die Konfiguration, nicht für das Erzeugnis.** Gemessen am 2026-09-14 an
 * `worldwar.exe`: die Berechtigungskennungen stehen dort **nicht** als Text —
 * `local-only` 0×, `allow-open` 0×, `dialog:` 0×, während das Wort `dialog` 13× vorkommt,
 * weil das Plugin gelinkt ist. Tauri backt die Zugriffsliste in eine eigene Darstellung.
 * Eine Suche nach `http:` im Programm findet dagegen einen Treffer, und der ist **kein
 * Leck**: es ist `build.devUrl` (`http://localhost:5173/`), das direkt hinter der
 * Inhaltsrichtlinie in der Binärdatei steht. Ein Wächter, der daraus „Netzzugriff im
 * Erzeugnis" machte, wäre ein Fehlalarm mit Ansage.
 */
export const NETWORK_MARKERS = ['http:', 'websocket:', 'shell:', 'updater:', 'upload:']

/** Alle .js-Dateien des gebauten Bündels — das, was im Programm wirklich läuft. */
function bundleFiles(dist) {
  const out = []
  const walk = (dir) => {
    if (!existsSync(dir)) return
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith('.js')) out.push(full)
    }
  }
  walk(dist)
  return out
}

function commitOf(root) {
  try {
    return execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  } catch {
    return null
  }
}

/** Was in einem Erzeugnis steht — oder `null`, wenn es dieses Erzeugnis nicht gibt. */
export function measureBinary(path, csp, devUrl) {
  if (!existsSync(path)) return null
  const data = readFileSync(path)
  const stat = statSync(path)
  return {
    // Vom Wurzelverzeichnis aus, nicht absolut: ein Bericht, der den Benutzernamen der
    // messenden Maschine traegt, laesst sich auf keiner zweiten gegenlesen.
    path: path.startsWith(root) ? path.slice(root.length).replaceAll('\\', '/') : path,
    bytes: stat.size,
    builtAt: stat.mtime.toISOString(),
    /** Wie oft die Inhaltsrichtlinie wörtlich in der Binärdatei steht. Erwartet: 1. */
    cspOccurrences: count(data, csp),
    /**
     * Wie oft `connect-src 'none'` darin vorkommt — die eine Zeile, um die es geht.
     *
     * Sie steht in `csp` und wird trotzdem einzeln gezählt: eine Richtlinie, die sich
     * insgesamt geändert hat, fällt über `cspOccurrences` auf, aber die Zahl, die der
     * Sperre entspricht, soll für sich lesbar sein und nicht aus einem längeren Text
     * herausgelesen werden müssen.
     */
    connectSrcNone: count(data, "connect-src 'none'"),
    /**
     * Die Entwicklungsadresse, die mit ins Programm wandert. Gemessen, nicht beanstandet.
     *
     * `build.devUrl` steht in der Binärdatei direkt hinter der Inhaltsrichtlinie. Das ist
     * der Grund, warum eine naive Suche nach `http:` im Erzeugnis anschlägt, und es ist
     * kein Netzzugriff: die Zeichenkette wird im Release-Bau nie benutzt, und die
     * Richtlinie verbietet die Verbindung ohnehin. Wer sie hier nicht erwartet, hält beim
     * nächsten Lesen eine harmlose Zeile für einen Befund.
     */
    devUrlOccurrences: count(data, String(devUrl ?? '')),
    /**
     * Wie oft der Bezeichner `WebSocket` woertlich im Programm steht. Erwartet: **0**.
     *
     * Das ist die Zusage am Erzeugnis und nicht am Quelltext (Befund M38-5): das gebaute
     * Buendel liegt im Programm, also findet eine Suche darin auch, was `vite build`
     * mitgenommen hat. Gross geschrieben und nicht klein: `WebSocket` ist der Bezeichner
     * aus JavaScript. Kleingeschriebenes `websocket` kommt im Erzeugnis mehrfach vor
     * (gemessen 2026-09-14: 5x) und stammt aus der eingebetteten Browserumgebung — wer
     * danach suchte, faende einen Fehlalarm mit Ansage.
     */
    webSocketOccurrences: count(data, 'WebSocket'),
  }
}

function count(buffer, needle) {
  const bytes = Buffer.from(needle, 'utf8')
  let found = 0
  let at = 0
  for (;;) {
    const next = buffer.indexOf(bytes, at)
    if (next < 0) return found
    found += 1
    at = next + 1
  }
}

/** Steckt der Mehrspielereinstieg im gebauten Bündel? */
export function measureBundle(dist) {
  const files = bundleFiles(dist)
  if (files.length === 0) return null
  let bytes = 0
  const withWebSocket = []
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    bytes += text.length
    if (/\bWebSocket\b/.test(text)) withWebSocket.push(file.slice(root.length).replaceAll('\\', '/'))
  }
  return { files: files.length, bytes, withWebSocket }
}

function main() {
  const [exeArg, distArg] = process.argv.slice(2)
  const config = JSON.parse(readFileSync(join(TAURI, 'tauri.conf.json'), 'utf8'))
  const capability = JSON.parse(readFileSync(join(TAURI, 'capabilities/local-only.json'), 'utf8'))
  const csp = config.app.security.csp

  const binary = measureBinary(exeArg ?? DEFAULT_EXE, csp, config.build.devUrl)
  const bundle = measureBundle(distArg ?? DEFAULT_DIST)
  const bundleWithMultiplayer = measureBundle(process.argv[4] ?? DEFAULT_DIST_MP)

  const report = {
    measuredAt: new Date().toISOString(),
    measuredAtCommit: commitOf(root),
    /** Die Richtlinie, wie sie zum Zeitpunkt der Messung in der Konfiguration stand. */
    csp,
    permissions: capability.permissions,
    /** Netzberechtigungen in der Konfiguration — das Erzeugnis traegt sie nicht als Text. */
    networkPermissions: capability.permissions.filter((permission) =>
      NETWORK_MARKERS.some((marker) => String(permission).startsWith(marker)),
    ),
    binary,
    bundle,
    /**
     * Derselbe Quelltext, mit der Bauflagge gebaut — die Gegenprobe zur Zeile darueber.
     * `null`, wenn niemand ihn gebaut hat; dann sagt der Waechter das, statt zu schweigen.
     */
    bundleWithMultiplayer,
  }
  writeFileSync(join(root, 'docs/reports/packaging-netfree.json'), `${JSON.stringify(report, null, 2)}\n`)

  console.log(`Inhaltsrichtlinie: ${csp}`)
  if (binary) {
    console.log(
      `Erzeugnis: ${binary.path}\n  ${binary.bytes} Bytes, gebaut ${binary.builtAt}\n` +
        `  Richtlinie woertlich im Programm: ${binary.cspOccurrences}x\n` +
        `  davon connect-src 'none':         ${binary.connectSrcNone}x\n` +
        `  devUrl im Programm (kein Leck):   ${binary.devUrlOccurrences}x
` +
        `  WebSocket im Programm:            ${binary.webSocketOccurrences}x`,
    )
  } else {
    console.log(`Erzeugnis: nicht vorhanden (${exeArg ?? DEFAULT_EXE}) — kein Bau gelaufen.`)
  }
  if (bundle) {
    console.log(
      `Buendel: ${bundle.files} Dateien, ${bundle.bytes} Zeichen\n` +
        `  WebSocket im Buendel: ${bundle.withWebSocket.length === 0 ? 'nein' : bundle.withWebSocket.join(', ')}`,
    )
  } else {
    console.log('Buendel: nicht vorhanden — pnpm desktop:build lief nicht.')
  }
  if (bundleWithMultiplayer) {
    console.log(
      `Buendel MIT Flagge: ${bundleWithMultiplayer.files} Dateien, ${bundleWithMultiplayer.bytes} Zeichen
` +
        `  WebSocket darin: ${bundleWithMultiplayer.withWebSocket.length === 0 ? 'nein' : bundleWithMultiplayer.withWebSocket.join(', ')}`,
    )
  } else {
    console.log('Buendel MIT Flagge: nicht vorhanden — die Gegenprobe fehlt.')
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).href) {
  main()
}
