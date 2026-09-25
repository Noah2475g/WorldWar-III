/**
 * Reine Logik des Pruefstands fuer die Touch-Bedienung (scripts/android-check.mjs).
 *
 * Hier steht alles, was sich ohne Browser, adb und Netz pruefen laesst: Argumente,
 * Fingerbahnen, die Rechnung fuer den Anker beim Zwei-Finger-Zoom, die Bewertung jeder
 * Messung und der Bericht. Kein Import aus node:*, kein Zugriff auf Dateien oder Prozesse:
 * test/android-check.test.ts faehrt jede Funktion direkt.
 *
 * Der Vertrag mit der Anwendung (gemeinsam mit den Bahnen A und B festgelegt):
 *   - `:root` traegt `data-input="touch" | "mouse"`, per `?touch=1` / `?touch=0` erzwingbar.
 *   - `div.map-wrapper` traegt `data-view-x`, `data-view-y` (Karteneinheiten, gerundet),
 *     `data-view-scale` (Karteneinheiten je CSS-Pixel, Hineinzoomen macht ihn KLEINER)
 *     und `data-selected-province` (Kennung oder leer).
 *   - Die Zoomknoepfe heissen per aria-label „Hineinzoomen" / „Herauszoomen".
 *   - Touch-Ziele sind im Touch-Betrieb mindestens 44 x 44 CSS-Pixel gross.
 */

/**
 * @typedef {{ width: number, height: number, dpr: number, label: string }} Size
 * @typedef {{ x: number, y: number }} Point
 * @typedef {{ x: number, y: number, scale: number }} View
 * @typedef {{ x: string | null, y: string | null, scale: string | null, selected: string | null }} ViewAttrs
 * @typedef {{
 *   target: 'android' | 'chromium',
 *   adb: string,
 *   serial: string | null,
 *   urlPort: number,
 *   url: string | null,
 *   browser: string | null,
 *   debugPort: number,
 *   devtoolsPort: number,
 *   sizes: Size[],
 *   out: string | null,
 *   longPressMs: number,
 *   pinchTolerancePx: number,
 *   minTarget: number,
 *   fullscreen: boolean,
 *   help: boolean,
 * }} Options
 * @typedef {{ id: string, pass: boolean, numbers: Record<string, unknown>, detail: string }} CheckResult
 * @typedef {CheckResult & { nr: number, name: string }} NumberedCheck
 * @typedef {{ label: string, checks: NumberedCheck[], screenshots: string[], error: string | null }} Run
 */

export const DEFAULT_URL_PORT = 4192
export const DEFAULT_DEVTOOLS_PORT = 9229
export const DEFAULT_DEBUG_PORT = 9223
export const DEFAULT_SIZES = '640x360@2,1097x617@1.75'
export const MIN_TARGET_PX = 44
export const MIN_CANVAS = { width: 320, height: 240 }
export const LONG_PRESS_MS = 700
export const PINCH_TOLERANCE_PX = 8

/** Die neun Pruefungen in der Reihenfolge des Berichts. */
export const CHECKS = [
  { nr: 1, id: 'environment', name: 'Umgebung' },
  { nr: 2, id: 'no-page-scroll', name: 'Kein Seitenscroll' },
  { nr: 3, id: 'touch-targets', name: 'Touch-Ziele >= 44 px' },
  { nr: 4, id: 'map-canvas', name: 'Karten-Canvas' },
  { nr: 5, id: 'one-finger-drag', name: 'Ein-Finger-Ziehen' },
  { nr: 6, id: 'pinch-zoom', name: 'Zwei-Finger-Zoom' },
  { nr: 7, id: 'tap-selects', name: 'Antippen waehlt' },
  { nr: 8, id: 'long-press', name: 'Langes Druecken' },
  { nr: 9, id: 'zoom-buttons', name: 'Zoomknoepfe' },
]

export const USAGE = `Aufruf: node scripts/android-check.mjs [Schalter]

  --target android|chromium   Ziel (Vorgabe: android)
  --url <adresse>             volle Seitenadresse; sonst http://localhost:<port>/?touch=1
  --url-port <p>              Port des Spiels (Vorgabe: ${DEFAULT_URL_PORT})
  --out <ordner>              Bildschirmfotos und report.json (Vorgabe: Temp-Ordner)
  --long-press-ms <ms>        Dauer des langen Drueckens (Vorgabe: ${LONG_PRESS_MS})
  --pinch-tolerance <px>      erlaubter Versatz des Zoom-Ankers (Vorgabe: ${PINCH_TOLERANCE_PX})
  --fullscreen                vor den Pruefungen den Knopf "Vollbild" antippen und warten,
                               bis der Browser im Vollbildmodus ist (Vorgabe: aus)

  Android:   --adb <pfad> (sonst Umgebung ADB, sonst "adb"), --serial <geraet>,
             --devtools-port <p> (adb forward, Vorgabe: ${DEFAULT_DEVTOOLS_PORT})
  Chromium:  --browser <exe> (sonst Brave, sonst Edge), --debug-port <p> (Vorgabe: ${DEFAULT_DEBUG_PORT}),
             --sizes "640x360@2,1097x617@1.75"

Exit-Code 0 nur, wenn jede Pruefung in jedem Lauf besteht; 1 bei einem FAIL; 2 bei einem
Fehler im Aufbau (kein Geraet, kein Browser, keine Verbindung).`

const FLAGS_WITH_VALUE = new Set([
  'target',
  'adb',
  'serial',
  'url-port',
  'url',
  'browser',
  'debug-port',
  'devtools-port',
  'sizes',
  'out',
  'long-press-ms',
  'pinch-tolerance',
])

/**
 * "640x360@2,1097x617@1.75" -> Groessen. Ohne "@" gilt das Pixelverhaeltnis 1.
 * @param {string} text
 * @returns {Size[]}
 */
export function parseSizes(text) {
  const parts = String(text)
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length === 0) throw new Error('--sizes ist leer')
  return parts.map((part) => {
    const match = /^(\d+)x(\d+)(?:@(\d+(?:\.\d+)?))?$/.exec(part)
    if (!match) throw new Error(`Groesse "${part}" ist nicht BREITExHOEHE@DPR`)
    const width = Number(match[1])
    const height = Number(match[2])
    const dpr = match[3] === undefined ? 1 : Number(match[3])
    if (width <= 0 || height <= 0 || !(dpr > 0)) throw new Error(`Groesse "${part}" hat eine Null`)
    return { width, height, dpr, label: `${width}x${height}@${dpr}` }
  })
}

/** @param {string} name @param {string} value @returns {number} */
function port(name, value) {
  const n = Number(value)
  if (!/^\d+$/.test(value) || n < 1 || n > 65535) throw new Error(`--${name} "${value}" ist kein Port`)
  return n
}

/** @param {string} name @param {string} value @returns {number} */
function positive(name, value) {
  const n = Number(value)
  if (!(n > 0)) throw new Error(`--${name} "${value}" ist keine positive Zahl`)
  return n
}

/**
 * Die Schalter der Kommandozeile. Rein: die Umgebung kommt als Objekt herein.
 * @param {string[]} argv ohne "node" und Skriptpfad
 * @param {Record<string, string | undefined>} env
 * @returns {{ ok: true, options: Options } | { ok: false, error: string }}
 */
export function parseArgs(argv, env) {
  /** @type {Options} */
  const options = {
    target: 'android',
    adb: env['ADB'] || 'adb',
    serial: null,
    urlPort: DEFAULT_URL_PORT,
    url: null,
    browser: null,
    debugPort: DEFAULT_DEBUG_PORT,
    devtoolsPort: DEFAULT_DEVTOOLS_PORT,
    sizes: parseSizes(DEFAULT_SIZES),
    out: null,
    longPressMs: LONG_PRESS_MS,
    pinchTolerancePx: PINCH_TOLERANCE_PX,
    minTarget: MIN_TARGET_PX,
    fullscreen: false,
    help: false,
  }
  try {
    for (let i = 0; i < argv.length; i++) {
      const arg = argv[i] ?? ''
      // pnpm 11 reicht das Trennzeichen aus `pnpm android:check -- --target …` wörtlich durch.
      if (arg === '--') continue
      if (arg === '--help' || arg === '-h') {
        options.help = true
        continue
      }
      // Ein Schalter ohne Wert (Befund T-M31, Vollbild-Knopf vor den Pruefungen antippen).
      if (arg === '--fullscreen') {
        options.fullscreen = true
        continue
      }
      const match = /^--([a-z-]+)(?:=(.*))?$/.exec(arg)
      if (!match || !FLAGS_WITH_VALUE.has(match[1] ?? '')) throw new Error(`unbekannter Schalter "${arg}"`)
      const name = match[1] ?? ''
      let value = match[2]
      if (value === undefined) {
        value = argv[i + 1]
        if (value === undefined || value.startsWith('--')) throw new Error(`--${name} braucht einen Wert`)
        i++
      }
      switch (name) {
        case 'target':
          if (value !== 'android' && value !== 'chromium') throw new Error(`--target "${value}": android oder chromium`)
          options.target = value
          break
        case 'adb':
          options.adb = value
          break
        case 'serial':
          options.serial = value
          break
        case 'url-port':
          options.urlPort = port(name, value)
          break
        case 'url':
          if (!/^https?:\/\//.test(value)) throw new Error(`--url "${value}" ist keine http(s)-Adresse`)
          options.url = value
          break
        case 'browser':
          options.browser = value
          break
        case 'debug-port':
          options.debugPort = port(name, value)
          break
        case 'devtools-port':
          options.devtoolsPort = port(name, value)
          break
        case 'sizes':
          options.sizes = parseSizes(value)
          break
        case 'out':
          options.out = value
          break
        case 'long-press-ms':
          options.longPressMs = positive(name, value)
          break
        case 'pinch-tolerance':
          options.pinchTolerancePx = positive(name, value)
          break
      }
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
  return { ok: true, options }
}

/**
 * Die Seite, die der Lauf oeffnet. Android geht ueber `adb reverse` an localhost (ein sicherer
 * Kontext, derselbe Ursprung wie beim Spieler); Chromium an 127.0.0.1, weil `vite preview
 * --host 127.0.0.1` nur IPv4 bedient und localhost unter Windows zuerst ::1 fragen kann.
 * @param {Options} options
 */
export function pageUrl(options) {
  if (options.url) return options.url
  const host = options.target === 'android' ? 'localhost' : '127.0.0.1'
  return `http://${host}:${options.urlPort}/?touch=1`
}

/**
 * Die Ausgabe von `adb devices`.
 * @param {string} text
 * @returns {{ serial: string, state: string }[]}
 */
export function parseAdbDevices(text) {
  const out = []
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('List of devices') || line.startsWith('*')) continue
    const [serial, state] = line.split(/\s+/)
    if (serial && state) out.push({ serial, state })
  }
  return out
}

/**
 * Das Geraet fuer den Lauf: das verlangte, sonst das einzige bereite.
 * @param {{ serial: string, state: string }[]} devices
 * @param {string | null} requested
 * @returns {{ ok: true, serial: string } | { ok: false, error: string }}
 */
export function pickSerial(devices, requested) {
  const ready = devices.filter((d) => d.state === 'device')
  if (requested) {
    const found = devices.find((d) => d.serial === requested)
    if (!found) return { ok: false, error: `Geraet ${requested} fehlt in "adb devices"` }
    if (found.state !== 'device') return { ok: false, error: `Geraet ${requested} ist "${found.state}", nicht bereit` }
    return { ok: true, serial: requested }
  }
  if (ready.length === 1 && ready[0]) return { ok: true, serial: ready[0].serial }
  if (ready.length === 0) {
    const others = devices.map((d) => `${d.serial} (${d.state})`).join(', ')
    return { ok: false, error: `kein bereites Geraet${others ? `: ${others}` : ''}` }
  }
  return { ok: false, error: `mehrere Geraete, bitte --serial: ${ready.map((d) => d.serial).join(', ')}` }
}

/**
 * Der Tab mit der eigenen Seite aus `/json`: zuerst die genaue Adresse, sonst derselbe Ursprung.
 * @template {{ type?: string, url?: string, webSocketDebuggerUrl?: string }} T
 * @param {T[]} targets
 * @param {string} url
 * @returns {T | null}
 */
export function pickPageTarget(targets, url) {
  const pages = targets.filter((t) => t.type === 'page' && t.webSocketDebuggerUrl)
  const exact = pages.find((t) => t.url === url)
  if (exact) return exact
  const origin = new URL(url).origin
  return pages.find((t) => typeof t.url === 'string' && t.url.startsWith(`${origin}/`)) ?? null
}

/** @param {string} userAgent @returns {number | null} */
export function chromeMajor(userAgent) {
  const match = /Chrome\/(\d+)/.exec(String(userAgent))
  return match ? Number(match[1]) : null
}

/**
 * Eine gerade Fingerbahn in `steps` gleichen Schritten, Start und Ziel eingeschlossen.
 * @param {Point} from @param {Point} to @param {number} steps
 * @returns {Point[]}
 */
export function linePath(from, to, steps) {
  const out = []
  for (let s = 0; s <= steps; s++) {
    out.push({ x: from.x + ((to.x - from.x) * s) / steps, y: from.y + ((to.y - from.y) * s) / steps })
  }
  return out
}

/**
 * Zwei Finger, waagerecht um eine feste Mitte, Abstand linear von d0 nach d1.
 * @param {Point} mid @param {number} d0 @param {number} d1 @param {number} steps
 * @returns {[Point, Point][]}
 */
export function pinchPath(mid, d0, d1, steps) {
  /** @type {[Point, Point][]} */
  const out = []
  for (let s = 0; s <= steps; s++) {
    const half = (d0 + ((d1 - d0) * s) / steps) / 2
    out.push([
      { x: mid.x - half, y: mid.y },
      { x: mid.x + half, y: mid.y },
    ])
  }
  return out
}

/**
 * Die Vertragsattribute der Karte. Fehlt eines, nennt das Ergebnis es beim Namen —
 * die Pruefungen melden dann FAIL statt abzustuerzen.
 * @param {ViewAttrs} attrs
 * @returns {{ ok: true, view: View, selected: string } | { ok: false, missing: string[] }}
 */
export function parseViewAttrs(attrs) {
  const missing = []
  const num = (/** @type {string | null} */ value, /** @type {string} */ name, positiveOnly = false) => {
    const n = value === null || value === undefined || value.trim() === '' ? NaN : Number(value)
    if (!Number.isFinite(n) || (positiveOnly && !(n > 0))) {
      missing.push(name)
      return 0
    }
    return n
  }
  const x = num(attrs.x, 'data-view-x')
  const y = num(attrs.y, 'data-view-y')
  const scale = num(attrs.scale, 'data-view-scale', true)
  if (attrs.selected === null || attrs.selected === undefined) missing.push('data-selected-province')
  if (missing.length > 0) return { ok: false, missing }
  return { ok: true, view: { x, y, scale }, selected: String(attrs.selected) }
}

/**
 * Welcher Kartenpunkt liegt vor und nach dem Zoom unter der Fingermitte?
 * `mid` ist in CSS-Pixeln relativ zur linken oberen Ecke der Karte; ein Kartenpunkt ist
 * `view + mid * scale`. Der Fehler in Bildschirmpixeln ist der Abstand geteilt durch den
 * Massstab danach.
 * @param {View} before @param {View} after @param {Point} mid
 */
export function anchorCheck(before, after, mid) {
  const mapBefore = { x: before.x + mid.x * before.scale, y: before.y + mid.y * before.scale }
  const mapAfter = { x: after.x + mid.x * after.scale, y: after.y + mid.y * after.scale }
  const errorMap = Math.hypot(mapAfter.x - mapBefore.x, mapAfter.y - mapBefore.y)
  return { mapBefore, mapAfter, errorMap, errorPx: errorMap / after.scale }
}

/** @param {number} n */
const round1 = (n) => Math.round(n * 10) / 10

/** @param {string[]} missing */
const missingText = (missing) => `Vertragsattribut fehlt an div.map-wrapper: ${missing.join(', ')}`

/**
 * @param {{ userAgent: string, innerWidth: number, innerHeight: number, dpr: number,
 *   pointerCoarse: boolean, hoverNone: boolean, dataInput: string | null }} env
 * @param {Size | null} expected die bestellte Groesse (nur bei Chromium)
 * @returns {CheckResult}
 */
export function evaluateEnvironment(env, expected) {
  const problems = []
  if (!env.pointerCoarse) problems.push('(pointer: coarse) passt nicht')
  if (env.dataInput !== 'touch') problems.push(`:root data-input ist ${env.dataInput === null ? 'nicht gesetzt' : `"${env.dataInput}"`}, erwartet "touch"`)
  if (expected) {
    if (env.innerWidth !== expected.width || env.innerHeight !== expected.height) {
      problems.push(`Fenster ${env.innerWidth}x${env.innerHeight} statt ${expected.width}x${expected.height}`)
    }
    if (Math.abs(env.dpr - expected.dpr) > 0.01) problems.push(`DPR ${env.dpr} statt ${expected.dpr}`)
  }
  const base = `${env.innerWidth}x${env.innerHeight} CSS-px, DPR ${env.dpr}, Chrome ${chromeMajor(env.userAgent) ?? '?'}, pointer:coarse ${env.pointerCoarse ? 'ja' : 'nein'}, hover:none ${env.hoverNone ? 'ja' : 'nein'}, data-input ${env.dataInput ?? '(fehlt)'}`
  return {
    id: 'environment',
    pass: problems.length === 0,
    numbers: { ...env, chromeMajor: chromeMajor(env.userAgent) },
    detail: problems.length ? `${base} - ${problems.join('; ')}` : base,
  }
}

/**
 * @param {{ scrollWidth: number, scrollHeight: number, innerWidth: number, innerHeight: number }} m
 * @returns {CheckResult}
 */
export function evaluateScroll(m) {
  const overflowX = Math.max(0, m.scrollWidth - m.innerWidth)
  const overflowY = Math.max(0, m.scrollHeight - m.innerHeight)
  return {
    id: 'no-page-scroll',
    pass: overflowX === 0 && overflowY === 0,
    numbers: { ...m, overflowX, overflowY },
    detail: `Seite ${m.scrollWidth}x${m.scrollHeight} bei ${m.innerWidth}x${m.innerHeight} sichtbar (Ueberstand ${overflowX} / ${overflowY} px)`,
  }
}

/**
 * Die reine Geometrie eines vergroesserten Pseudo-Elements (commit d76a92e): manche
 * Knoepfe bleiben klein und tragen ihre 44 px stattdessen in einem unsichtbaren
 * `::before`/`::after` mit negativem `inset` (touch.css, z.B. `.explain__toggle::after
 * { inset: -11px }`). Ein Klick dort trifft das Element selbst - Pseudo-Elemente sind
 * kein eigenes Hit-Test-Ziel -, also zaehlt die vergroesserte Flaeche mit.
 *
 * `inset` sind schon Zahlen oder `null` (aus `getComputedStyle`, "auto" wird zu `null`) -
 * das Lesen der Stile bleibt in der Seite (scripts/android-check.mjs, `pageTargets`),
 * hier steht nur die Rechnung. Eine Seite ohne Rand auf einer ganzen Achse (weder top
 * noch bottom, oder weder left noch right gesetzt) zaehlt nicht als eigenes Ziel. Ein
 * POSITIVER Versatz (Polsterung nach innen) schrumpft die Flaeche nie unter die des
 * Elements - nur eine wirklich groessere Flaeche kommt zurueck.
 * @param {{ left: number, right: number, top: number, bottom: number, width: number, height: number }} box
 * @param {{ top: number | null, right: number | null, bottom: number | null, left: number | null }} inset
 * @returns {{ width: number, height: number } | null}
 */
export function pseudoHitBox(box, inset) {
  if ((inset.top === null && inset.bottom === null) || (inset.left === null && inset.right === null)) return null
  const l = inset.left !== null ? box.left + inset.left : box.left
  const r = inset.right !== null ? box.right - inset.right : box.right
  const t = inset.top !== null ? box.top + inset.top : box.top
  const b = inset.bottom !== null ? box.bottom - inset.bottom : box.bottom
  const width = r - l
  const height = b - t
  if (width > box.width || height > box.height) return { width, height }
  return null
}

/**
 * Jedes sichtbare Bedienelement braucht mindestens `min` x `min` CSS-Pixel UND seine Mitte
 * muss wirklich ihm gehoeren: `covered` (aus `document.elementFromPoint` an der Boxmitte,
 * gemessen in scripts/android-check.mjs) ist true, wenn dort ein anderes Element liegt, das
 * das Ziel weder selbst ist noch enthaelt - ein Finger trifft dann nie den Knopf, egal wie
 * gross er ist (Befund T-TOUCH-KARTENKNOEPFE, 2026-09-25: die Uebersichtskarte lag ueber
 * "Hauptstadt zentrieren"/"Vollbild"). Elemente ohne Flaeche (nicht gezeichnet) zaehlen nicht.
 * @param {{ selector: string, text: string, width: number, height: number, state?: string, covered?: boolean, coveredBy?: string | null }[]} elements
 * @param {number} [min]
 */
export function evaluateTargets(elements, min = MIN_TARGET_PX) {
  const visible = elements.filter((e) => e.width > 0 && e.height > 0)
  const violators = visible
    .filter((e) => e.width < min || e.height < min || e.covered === true)
    .map((e) => ({ ...e, width: round1(e.width), height: round1(e.height) }))
    .sort((a, b) => Math.min(a.width, a.height) - Math.min(b.width, b.height))
  const smallest = violators.length ? Math.min(violators[0]?.width ?? 0, violators[0]?.height ?? 0) : null
  const coveredCount = violators.filter((v) => v.covered === true).length
  const list = violators
    .slice(0, 6)
    .map((v) => `${v.selector}${v.text ? ` "${v.text}"` : ''} ${v.width}x${v.height}${v.covered ? ` (verdeckt von ${v.coveredBy ?? '?'})` : ''}`)
    .join(', ')
  return {
    id: 'touch-targets',
    pass: violators.length === 0,
    numbers: { total: visible.length, violators: violators.length, smallest, covered: coveredCount, min },
    violators,
    detail: `${violators.length} von ${visible.length} unter ${min}x${min} px oder verdeckt${list ? `: ${list}${violators.length > 6 ? ', ...' : ''}` : ''}`,
  }
}

/**
 * Touch-Ziele in mehreren Zustaenden (Startdialog, Partie, Provinz gewaehlt): die Pruefung
 * besteht nur, wenn jeder Zustand besteht. Jeder Verstoss traegt den Zustand, in dem er lag.
 * @param {{ name: string, elements: { selector: string, text: string, width: number, height: number }[] }[]} states
 * @param {number} [min]
 */
export function evaluateTargetStates(states, min = MIN_TARGET_PX) {
  if (states.length === 0) {
    return { id: 'touch-targets', pass: false, numbers: { min, states: {} }, violators: [], detail: 'kein Zustand gemessen' }
  }
  const per = states.map((state) => ({ name: state.name, ...evaluateTargets(state.elements, min) }))
  return {
    id: 'touch-targets',
    pass: per.every((p) => p.pass),
    numbers: { min, states: Object.fromEntries(per.map((p) => [p.name, p.numbers])) },
    violators: per.flatMap((p) => p.violators.map((v) => ({ ...v, state: p.name }))),
    detail: per.map((p) => `${p.name}: ${p.detail}`).join(' | '),
  }
}

/**
 * Steht diese Weiterleitung schon in `adb forward --list`? Dann gehoert sie jemand anderem,
 * und der Lauf laesst sie am Ende stehen.
 * @param {string} listText @param {string} serial @param {number} localPort @param {string} remote
 */
export function forwardExists(listText, serial, localPort, remote) {
  return String(listText)
    .split(/\r?\n/)
    .some((line) => {
      const [s, local, r] = line.trim().split(/\s+/)
      return s === serial && local === `tcp:${localPort}` && r === remote
    })
}

/**
 * Was sich ohne Vertragsattribute beobachten laesst: eine Pruefsumme eines verkleinerten
 * Kartenbilds, der Wert der Provinzliste in der Seitenleiste, der Tooltip, der Seitenzoom
 * und der Rollstand. Sie aendert kein PASS/FAIL, macht aber einen Ausgangswert ohne die
 * Attribute lesbar ("die Seite zoomt statt der Karte").
 * Dazu, falls gemessen, die Zeigerereignisse waehrend der Geste: ein `pointercancel` heisst,
 * dass der Browser die Geste uebernommen hat (Seite rollen oder zoomen statt Karte).
 * @typedef {{ down: number, move: number, up: number, cancel: number, target: string | null }} PointerCounts
 * @typedef {{ signature: string | null, pickerValue: string | null, tooltip: boolean, visualScale: number,
 *   scrollX: number, scrollY: number, pointer?: PointerCounts }} Aux
 * @param {Aux} before @param {Aux} after
 */
export function auxObservation(before, after) {
  const parts = []
  if (after.pointer) {
    const p = after.pointer
    parts.push(`Zeiger auf ${p.target ?? '?'}: down ${p.down}, move ${p.move}, up ${p.up}, cancel ${p.cancel}`)
  }
  if (before.signature !== null && after.signature !== null) {
    parts.push(`Kartenbild ${before.signature === after.signature ? 'unveraendert' : 'veraendert'}`)
  }
  if (before.pickerValue !== null || after.pickerValue !== null) {
    parts.push(`Provinzliste "${before.pickerValue ?? ''}" -> "${after.pickerValue ?? ''}"`)
  }
  parts.push(`Tooltip ${after.tooltip ? 'sichtbar' : 'nicht sichtbar'}`)
  if (Math.abs(after.visualScale - 1) > 0.01 || Math.abs(before.visualScale - 1) > 0.01) {
    parts.push(`Seitenzoom ${Math.round(before.visualScale * 100) / 100} -> ${Math.round(after.visualScale * 100) / 100}`)
  }
  if (after.scrollX !== before.scrollX || after.scrollY !== before.scrollY) {
    parts.push(`Seite gerollt ${before.scrollX}/${before.scrollY} -> ${after.scrollX}/${after.scrollY}`)
  }
  return parts.join(', ')
}

/**
 * @param {{ name: string, cssWidth: number, cssHeight: number, bitmapWidth: number, bitmapHeight: number }[]} canvases
 * @param {{ width: number, height: number }} [min]
 * @returns {CheckResult}
 */
export function evaluateCanvas(canvases, min = MIN_CANVAS) {
  if (canvases.length === 0) {
    return { id: 'map-canvas', pass: false, numbers: { canvases: 0 }, detail: 'keine Karten-Canvas in .map-wrapper gefunden' }
  }
  const rows = canvases.map((c) => {
    const ratioX = c.cssWidth > 0 ? c.bitmapWidth / c.cssWidth : 0
    const ratioY = c.cssHeight > 0 ? c.bitmapHeight / c.cssHeight : 0
    const sizeOk = c.cssWidth >= min.width && c.cssHeight >= min.height
    const ratioOk = ratioX > 0 && Math.abs(ratioX - ratioY) <= 0.01 * Math.max(ratioX, ratioY)
    return { ...c, ratioX: Math.round(ratioX * 1000) / 1000, ratioY: Math.round(ratioY * 1000) / 1000, sizeOk, ratioOk }
  })
  const detail = rows
    .map((r) => `${r.name} CSS ${round1(r.cssWidth)}x${round1(r.cssHeight)}, Bitmap ${r.bitmapWidth}x${r.bitmapHeight} (Verhaeltnis ${r.ratioX} / ${r.ratioY})${r.sizeOk ? '' : ` unter ${min.width}x${min.height}`}${r.ratioOk ? '' : ' verzerrt'}`)
    .join('; ')
  return { id: 'map-canvas', pass: rows.every((r) => r.sizeOk && r.ratioOk), numbers: { canvases: rows }, detail }
}

/**
 * Ein Finger zieht die Karte: die Ansicht folgt dem Finger (Finger nach links heisst
 * view.x waechst), und die Auswahl bleibt, wie sie war.
 * @param {ViewAttrs} beforeAttrs @param {ViewAttrs} afterAttrs @param {{ dx: number, dy: number }} finger
 * @returns {CheckResult}
 */
export function evaluateDrag(beforeAttrs, afterAttrs, finger) {
  const before = parseViewAttrs(beforeAttrs)
  const after = parseViewAttrs(afterAttrs)
  if (!before.ok) return { id: 'one-finger-drag', pass: false, numbers: { missing: before.missing }, detail: missingText(before.missing) }
  if (!after.ok) return { id: 'one-finger-drag', pass: false, numbers: { missing: after.missing }, detail: missingText(after.missing) }
  const viewDx = after.view.x - before.view.x
  const viewDy = after.view.y - before.view.y
  const expectedDx = -finger.dx * before.view.scale
  const expectedDy = -finger.dy * before.view.scale
  const problems = []
  let followed = 0
  for (const [axis, got, want] of /** @type {[string, number, number][]} */ ([
    ['x', viewDx, expectedDx],
    ['y', viewDy, expectedDy],
  ])) {
    if (Math.abs(want) < 5) continue
    if (Math.sign(got) === Math.sign(want) && Math.abs(got) >= 0.25 * Math.abs(want)) followed++
    else problems.push(`${axis}: ${Math.round(got)} statt etwa ${Math.round(want)}`)
  }
  if (followed === 0 && problems.length === 0) problems.push('keine Bewegung erwartet')
  if (after.selected !== before.selected) problems.push(`Auswahl wechselte "${before.selected}" -> "${after.selected}"`)
  const share = (got, want) => (Math.abs(want) < 1 ? null : Math.round((got / want) * 100))
  return {
    id: 'one-finger-drag',
    pass: problems.length === 0,
    numbers: {
      viewDx,
      viewDy,
      expectedDx: Math.round(expectedDx),
      expectedDy: Math.round(expectedDy),
      followPercentX: share(viewDx, expectedDx),
      followPercentY: share(viewDy, expectedDy),
      selectedBefore: before.selected,
      selectedAfter: after.selected,
    },
    detail: `Finger ${finger.dx}/${finger.dy} px, Ansicht ${Math.round(viewDx)}/${Math.round(viewDy)} (erwartet ${Math.round(expectedDx)}/${Math.round(expectedDy)}), Auswahl "${before.selected}" -> "${after.selected}"${problems.length ? ` - ${problems.join('; ')}` : ''}`,
  }
}

/**
 * Zwei Finger spreizen: der Massstab wird kleiner (hinein), und der Kartenpunkt unter der
 * Fingermitte bleibt innerhalb von `tolerancePx` stehen.
 * @param {ViewAttrs} beforeAttrs @param {ViewAttrs} afterAttrs @param {Point} mid @param {number} tolerancePx
 * @returns {CheckResult}
 */
export function evaluatePinch(beforeAttrs, afterAttrs, mid, tolerancePx) {
  const before = parseViewAttrs(beforeAttrs)
  const after = parseViewAttrs(afterAttrs)
  if (!before.ok) return { id: 'pinch-zoom', pass: false, numbers: { missing: before.missing }, detail: missingText(before.missing) }
  if (!after.ok) return { id: 'pinch-zoom', pass: false, numbers: { missing: after.missing }, detail: missingText(after.missing) }
  const anchor = anchorCheck(before.view, after.view, mid)
  const ratio = after.view.scale / before.view.scale
  const problems = []
  if (!(ratio < 0.95)) problems.push(`Massstab ${before.view.scale} -> ${after.view.scale} ist nicht hineingezoomt`)
  if (!(anchor.errorPx <= tolerancePx)) problems.push(`Anker um ${round1(anchor.errorPx)} px verrutscht (erlaubt ${tolerancePx})`)
  return {
    id: 'pinch-zoom',
    pass: problems.length === 0,
    numbers: {
      scaleBefore: before.view.scale,
      scaleAfter: after.view.scale,
      scaleRatio: Math.round(ratio * 1000) / 1000,
      anchorErrorPx: round1(anchor.errorPx),
      anchorErrorMap: round1(anchor.errorMap),
      mid,
    },
    detail: `Massstab ${before.view.scale} -> ${after.view.scale} (x${Math.round(ratio * 1000) / 1000}), Anker-Versatz ${round1(anchor.errorPx)} px${problems.length ? ` - ${problems.join('; ')}` : ''}`,
  }
}

/**
 * @param {ViewAttrs} beforeAttrs @param {ViewAttrs} afterAttrs
 * @returns {CheckResult}
 */
export function evaluateTap(beforeAttrs, afterAttrs) {
  const before = parseViewAttrs(beforeAttrs)
  const after = parseViewAttrs(afterAttrs)
  if (!after.ok) return { id: 'tap-selects', pass: false, numbers: { missing: after.missing }, detail: missingText(after.missing) }
  const was = before.ok ? before.selected : '?'
  return {
    id: 'tap-selects',
    pass: after.selected !== '',
    numbers: { selectedBefore: was, selectedAfter: after.selected },
    detail: after.selected ? `gewaehlt: "${after.selected}" (vorher "${was}")` : `nichts gewaehlt (vorher "${was}")`,
  }
}

/**
 * Langes Druecken ist das Zeigen ohne Maus: der Tooltip erscheint, und die Auswahl bleibt,
 * wie sie war. Waehlt das Druecken die Provinz, stammt der Tooltip von der Auswahl - und
 * waehrend eines Marschbefehls saesse damit das Ziel.
 * @param {{ before: boolean, duringHold: boolean, after: boolean,
 *   selectedBefore: string | null, selectedAfter: string | null, selectionSource: string }} m
 * @returns {CheckResult}
 */
export function evaluateLongPress(m) {
  const yes = (/** @type {boolean} */ b) => (b ? 'ja' : 'nein')
  const problems = []
  if (m.before) problems.push('Tooltip war schon vorher sichtbar')
  if (!m.after) problems.push('kein .tooltip nach dem Loslassen')
  if ((m.selectedBefore ?? '') !== (m.selectedAfter ?? '')) {
    problems.push(`das Druecken waehlte "${m.selectedAfter ?? ''}" (${m.selectionSource}) - der Tooltip kommt von der Auswahl`)
  }
  return {
    id: 'long-press',
    pass: problems.length === 0,
    numbers: m,
    detail: `Tooltip vorher ${yes(m.before)}, waehrend des Haltens ${yes(m.duringHold)}, nach dem Loslassen ${yes(m.after)}${problems.length ? ` - ${problems.join('; ')}` : ''}`,
  }
}

/**
 * `hit` sagt, ob der Finger an der Knopfmitte wirklich den Knopf trifft (elementFromPoint);
 * liegt etwas darueber, landet der Tipp dort - und eine Massstabsaenderung kaeme von woanders.
 * @param {{ label: string, found: boolean, hit?: boolean, before: ViewAttrs, after: ViewAttrs, size?: { width: number, height: number } }[]} presses
 * @returns {CheckResult}
 */
export function evaluateZoomButtons(presses) {
  const problems = []
  const rows = []
  for (const press of presses) {
    if (!press.found) {
      problems.push(`Knopf "${press.label}" nicht gefunden`)
      continue
    }
    if (press.hit === false) problems.push(`"${press.label}" verdeckt (der Finger trifft ein anderes Element)`)
    const before = parseViewAttrs(press.before)
    const after = parseViewAttrs(press.after)
    if (!before.ok || !after.ok) {
      problems.push(missingText(before.ok ? (after.ok ? [] : after.missing) : before.missing))
      continue
    }
    const zoomIn = /hinein/i.test(press.label)
    const right = zoomIn ? after.view.scale < before.view.scale : after.view.scale > before.view.scale
    rows.push({ label: press.label, scaleBefore: before.view.scale, scaleAfter: after.view.scale, size: press.size ?? null, right })
    if (!right) problems.push(`"${press.label}": Massstab ${before.view.scale} -> ${after.view.scale}, falsche Richtung`)
  }
  const unique = [...new Set(problems)]
  return {
    id: 'zoom-buttons',
    pass: unique.length === 0 && rows.length === presses.length && presses.length > 0,
    numbers: { presses: rows },
    detail: [
      ...rows.map((r) => `${r.label} ${r.scaleBefore} -> ${r.scaleAfter}${r.size ? ` (${round1(r.size.width)}x${round1(r.size.height)} px)` : ''}`),
      ...unique,
    ].join('; '),
  }
}

/**
 * Tipp-Punkte mitten auf Provinzen: jede Provinzmitte im Innern der Karte (mit Abstand zum
 * Rand, dort liegen Zoomknoepfe und Uebersichtskarte), die naechste zur Kartenmitte zuerst.
 * Welcher davon nicht verdeckt ist, weiss nur die Seite - sie nimmt den ersten freien.
 * @param {{ id: string, center: Point }[]} provinces
 * @param {View} view
 * @param {{ width: number, height: number }} canvas
 * @param {number} [margin] Anteil des Randes, der gemieden wird
 * @returns {{ id: string, x: number, y: number }[]} in CSS-Pixeln relativ zur Karte
 */
export function rankTapPoints(provinces, view, canvas, margin = 0.2) {
  const out = []
  for (const province of provinces) {
    const x = (province.center.x - view.x) / view.scale
    const y = (province.center.y - view.y) / view.scale
    if (x < canvas.width * margin || x > canvas.width * (1 - margin)) continue
    if (y < canvas.height * margin || y > canvas.height * (1 - margin)) continue
    out.push({ id: province.id, x: Math.round(x), y: Math.round(y), distance: Math.hypot(x - canvas.width / 2, y - canvas.height / 2) })
  }
  return out.sort((a, b) => a.distance - b.distance).map(({ id, x, y }) => ({ id, x, y }))
}

/**
 * Die naechste Provinzmitte zur Kartenmitte, oder null.
 * @param {{ id: string, center: Point }[]} provinces @param {View} view
 * @param {{ width: number, height: number }} canvas @param {number} [margin]
 */
export function pickTapPoint(provinces, view, canvas, margin = 0.2) {
  return rankTapPoints(provinces, view, canvas, margin)[0] ?? null
}

/**
 * Ohne lesbare Ansicht: ein Raster ueber die Karte (Schrittweite `step` CSS-Pixel, halber
 * Schritt Abstand zum Rand), die Mitte zuerst, dann nach wachsendem Abstand.
 * @param {{ width: number, height: number }} canvas @param {number} step
 * @returns {Point[]} relativ zur Karte
 */
export function candidateGrid(canvas, step) {
  const centre = { x: Math.round(canvas.width / 2), y: Math.round(canvas.height / 2) }
  const out = [centre]
  for (let y = step / 2; y < canvas.height; y += step) {
    for (let x = step / 2; x < canvas.width; x += step) {
      if (x !== centre.x || y !== centre.y) out.push({ x: Math.round(x), y: Math.round(y) })
    }
  }
  const d = (/** @type {Point} */ p) => Math.hypot(p.x - centre.x, p.y - centre.y)
  return out.sort((a, b) => d(a) - d(b))
}

/**
 * Nummeriert die Ergebnisse nach CHECKS und traegt jede nicht gelaufene Pruefung als FAIL ein.
 * @param {CheckResult[]} results
 * @param {string | null} reason warum der Rest nicht lief
 * @returns {NumberedCheck[]}
 */
export function finalizeChecks(results, reason) {
  return CHECKS.map((check) => {
    const found = results.find((r) => r.id === check.id)
    if (found) return { ...found, nr: check.nr, name: check.name }
    return {
      id: check.id,
      nr: check.nr,
      name: check.name,
      pass: false,
      numbers: {},
      detail: `nicht gelaufen: ${reason ?? 'Lauf brach vorher ab'}`,
    }
  })
}

/** @param {{ runs: Run[] }} report */
export function exitCodeFor(report) {
  if (report.runs.length === 0) return 1
  return report.runs.every((run) => !run.error && run.checks.length === CHECKS.length && run.checks.every((c) => c.pass)) ? 0 : 1
}

/**
 * Der Bericht fuer die Konsole: je Lauf eine Zeile pro Pruefung, dann die Summe.
 * @param {{ runs: Run[] }} report
 */
export function formatReport(report) {
  const lines = []
  for (const run of report.runs) {
    const passed = run.checks.filter((c) => c.pass).length
    lines.push(`${run.label}  (${passed} von ${run.checks.length} bestanden)`)
    if (run.error) lines.push(`  Abbruch: ${run.error}`)
    for (const check of run.checks) {
      lines.push(`  ${check.pass ? 'PASS' : 'FAIL'}  ${check.nr} ${check.name.padEnd(22)} ${check.detail}`)
    }
    lines.push('')
  }
  lines.push(exitCodeFor(report) === 0 ? 'ERGEBNIS: alle Pruefungen bestanden' : 'ERGEBNIS: mindestens eine Pruefung FAIL')
  return lines.join('\n')
}
