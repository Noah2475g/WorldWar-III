#!/usr/bin/env node
/**
 * Pruefstand fuer die Touch-Bedienung: WorldWar im Android-Emulator oder in Chromium mit
 * Touch-Emulation, gesteuert ueber das Chrome DevTools Protocol (CDP).
 *
 * Der Lauf startet eine Partie so, wie ein Spieler es tut - per Finger, nicht per Maus -
 * und misst dann neun Dinge: Umgebung, Seitenscroll, Touch-Ziele, Karten-Canvas,
 * Ein-Finger-Ziehen, Zwei-Finger-Zoom, Antippen, langes Druecken und die Zoomknoepfe.
 * Jede Pruefung meldet PASS oder FAIL mit Zahlen; der Exit-Code ist 0 nur, wenn alle
 * bestehen. Bildschirmfotos und report.json landen in --out.
 *
 *   node scripts/android-check.mjs                                   # Android (LDPlayer, adb)
 *   node scripts/android-check.mjs --target chromium --sizes "640x360@2,1097x617@1.75"
 *
 * Den Server startet der Aufrufer, etwa:
 *   pnpm desktop:build
 *   pnpm --filter @worldwar/desktop preview --host 127.0.0.1 --port 4192 --strictPort
 *
 * Android: `adb reverse` fuer den Spielport, Chrome per Intent auf die Seite,
 * `adb forward tcp:9229 localabstract:chrome_devtools_remote` fuer CDP. Die Erstbegruessung
 * von Chrome bestaetigt der Mensch selbst - dieses Skript stimmt keinen Bedingungen zu.
 *
 * Chromium: ein SICHTBARES Fenster (kein --headless: Chromium friert unsichtbare Tabs ein,
 * WORKFLOW Falle 17) mit eigenem --user-data-dir und --remote-debugging-port. Beendet
 * werden nur die Prozesse, die der Lauf selbst gestartet hat.
 *
 * Die reine Logik steht in scripts/lib/android-check-lib.mjs und ist dort getestet.
 */
/* global document, window, navigator, getComputedStyle */
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  USAGE,
  auxObservation,
  candidateGrid,
  evaluateCanvas,
  evaluateDrag,
  evaluateEnvironment,
  evaluateLongPress,
  evaluatePinch,
  evaluateScroll,
  evaluateTap,
  evaluateTargetStates,
  evaluateZoomButtons,
  exitCodeFor,
  finalizeChecks,
  formatReport,
  forwardExists,
  linePath,
  pageUrl,
  parseAdbDevices,
  parseArgs,
  parseViewAttrs,
  pickPageTarget,
  pickSerial,
  pinchPath,
  pseudoHitBox,
  rankTapPoints,
} from './lib/android-check-lib.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const TUTORIAL_KEY = 'worldwar.tutorial.seen'
const START_BUTTON = 'Partie beginnen'
const ZOOM_IN = 'Hineinzoomen'
const ZOOM_OUT = 'Herauszoomen'
const FULLSCREEN_BUTTON = 'Vollbild'
const DEVTOOLS_SOCKET = 'localabstract:chrome_devtools_remote'
/** Nach jeder Geste: Klick-Synthese, React-Durchlauf und ein gezeichneter Frame. */
const SETTLE_MS = 400

const sleep = (ms) => new Promise((resolve) => globalThis.setTimeout(resolve, ms))

/** Ein Fehler im Aufbau (kein Geraet, kein Browser, keine Seite): Exit-Code 2. */
class SetupError extends Error {}

// ---------------------------------------------------------------------------------------
// CDP
// ---------------------------------------------------------------------------------------

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new globalThis.WebSocket(wsUrl)
    let nextId = 0
    const pending = new Map()
    ws.onmessage = (event) => {
      const msg = JSON.parse(typeof event.data === 'string' ? event.data : Buffer.from(event.data).toString('utf8'))
      if (!msg.id || !pending.has(msg.id)) return
      const call = pending.get(msg.id)
      pending.delete(msg.id)
      globalThis.clearTimeout(call.timer)
      if (msg.error) call.reject(new Error(`${call.method}: ${msg.error.message}`))
      else call.resolve(msg.result ?? {})
    }
    ws.onerror = () => reject(new SetupError(`WebSocket zu ${wsUrl} scheiterte`))
    ws.onclose = () => {
      for (const call of pending.values()) call.reject(new Error(`${call.method}: Verbindung geschlossen`))
      pending.clear()
    }
    ws.onopen = () =>
      resolve({
        send(method, params = {}, timeoutMs = 20000) {
          return new Promise((res, rej) => {
            const id = ++nextId
            const timer = globalThis.setTimeout(() => {
              pending.delete(id)
              rej(new Error(`${method}: keine Antwort nach ${timeoutMs} ms`))
            }, timeoutMs)
            pending.set(id, { resolve: res, reject: rej, timer, method })
            ws.send(JSON.stringify({ id, method, params }))
          })
        },
        close() {
          ws.close()
        },
      })
  })
}

async function evaluate(cdp, expression) {
  const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text ?? 'Ausnahme in der Seite')
  }
  return r.result?.value
}

/** Eine Funktion in der Seite ausfuehren; sie darf nichts aus diesem Modul benutzen. */
const call = (fn, ...args) => `(${fn.toString()})(${args.map((a) => JSON.stringify(a)).join(', ')})`

/**
 * Wie `call`, aber mit reinen Hilfsfunktionen aus android-check-lib.mjs im Gepaeck (commit
 * d76a92e/Befund C7): ihr Quelltext (per `toString`, sie sind benannte `function`-
 * Erklaerungen und bleiben es beim Uebertragen) steht VOR der Seiten-Funktion im selben
 * Ausdruck. Dieselbe getestete Rechnung laeuft damit in der Seite - keine zweite,
 * driftende Abschrift der Geometrie dort.
 */
const callWithDeps = (fn, deps, ...args) => `${deps.map((d) => d.toString()).join('\n')}\n${call(fn, ...args)}`

async function waitFor(cdp, expression, what, timeoutMs = 30000) {
  const start = Date.now()
  let last = null
  while (Date.now() - start < timeoutMs) {
    try {
      const value = await evaluate(cdp, expression)
      if (value) return value
    } catch (error) {
      last = error
    }
    await sleep(300)
  }
  throw new Error(`Zeitueberschreitung beim Warten auf ${what}${last ? ` (${last.message})` : ''}`)
}

async function getJson(url, init) {
  const response = await globalThis.fetch(url, init)
  if (!response.ok) throw new Error(`${url}: ${response.status}`)
  return response.json()
}

// ---------------------------------------------------------------------------------------
// In der Seite (werden per toString uebertragen - keine Bezuege nach aussen)
// ---------------------------------------------------------------------------------------

function pageEnvironment() {
  const script = [...document.querySelectorAll('script[src]')].map((s) => s.getAttribute('src'))[0] ?? null
  return {
    userAgent: navigator.userAgent,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    dpr: window.devicePixelRatio,
    pointerCoarse: window.matchMedia('(pointer: coarse)').matches,
    hoverNone: window.matchMedia('(hover: none)').matches,
    dataInput: document.documentElement.getAttribute('data-input'),
    bundle: script,
  }
}

function pageScroll() {
  const d = document.documentElement
  const b = document.body
  return {
    scrollWidth: Math.max(d.scrollWidth, b ? b.scrollWidth : 0),
    scrollHeight: Math.max(d.scrollHeight, b ? b.scrollHeight : 0),
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
  }
}

function pageTargets() {
  const out = []
  const query = 'button, select, input:not([type="hidden"]), summary, [role="button"], a[href]'
  // Manche Knoepfe bleiben klein und tragen ihre 44 px stattdessen in einem unsichtbaren
  // ::before/::after (touch.css, z.B. .explain__toggle::after { inset: -11px }). Ein Klick
  // dort trifft das Element selbst (Pseudo-Elemente sind kein eigenes Hit-Test-Ziel), also
  // zaehlt die vergroesserte Flaeche mit - sonst meldet diese Pruefung einen Verstoss, den
  // ein Finger gar nicht hat.
  const pseudoExtra = (el, box) => {
    for (const which of ['::after', '::before']) {
      let cs
      try {
        cs = getComputedStyle(el, which)
      } catch {
        continue
      }
      if (!cs || cs.content === 'none' || cs.content === '' || cs.display === 'none' || cs.visibility === 'hidden') continue
      if (cs.position !== 'absolute' && cs.position !== 'fixed') continue
      if (cs.pointerEvents === 'none') continue
      const num = (v) => (v === 'auto' || v == null ? null : parseFloat(v))
      // Die reine Geometrie (Box + Versatz -> vergroesserte Flaeche) steht getestet in
      // android-check-lib.mjs (pseudoHitBox) - hier bleibt nur das Lesen der Stile, das
      // ohne echtes DOM nicht geht.
      const extra = pseudoHitBox(box, { top: num(cs.top), right: num(cs.right), bottom: num(cs.bottom), left: num(cs.left) })
      if (extra) return extra
    }
    return null
  }
  for (const el of document.querySelectorAll(query)) {
    const style = getComputedStyle(el)
    if (style.visibility === 'hidden' || style.display === 'none') continue
    // Ein Element, dessen (vererbtes) pointer-events "none" ist, nimmt nie einen Klick oder
    // Finger an - ueber die Karte legt sich z.B. die Legende so, damit sie selbst keine
    // Klicks wegnimmt (app.css, Kommentar "nimmt keine Klicks weg"), und ihr "?"-Knopf erbt
    // das, ohne es zurueckzusetzen. Seine Groesse zu pruefen waere eine Pruefung von etwas,
    // das ohnehin kein Finger erreicht - dieselbe Begruendung wie bei display:none.
    if (style.pointerEvents === 'none') continue
    // Ein Haekchen oder Knopf in einem <label> wird ueber das ganze Label getroffen.
    const toggle = el.tagName === 'INPUT' && (el.type === 'checkbox' || el.type === 'radio')
    const label = toggle ? el.closest('label') : null
    const target = label ?? el
    const box = target.getBoundingClientRect()
    const extra = pseudoExtra(target, box)
    const width = extra ? Math.max(box.width, extra.width) : box.width
    const height = extra ? Math.max(box.height, extra.height) : box.height
    const classes = [...el.classList].slice(0, 2).map((c) => `.${c}`).join('')
    const selector = `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${classes}`
    const labelText = el.closest('label')?.querySelector('span')?.textContent ?? ''
    const own = el.tagName === 'SELECT' ? '' : (el.textContent ?? '')
    const text = (el.getAttribute('aria-label') || own || labelText || el.getAttribute('name') || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 30)
    // Deckt etwas anderes die Mitte des Ziels ab (Befund T-TOUCH-KARTENKNOEPFE,
    // 2026-09-25: die Uebersichtskarte lag ueber "Hauptstadt zentrieren"/"Vollbild" bei
    // 1098x498@1.75)? elementFromPoint an der Mitte der echten Box, nicht der um ein
    // Pseudo-Element vergroesserten - ein Finger trifft dort ohnehin nur die echte Flaeche.
    // Dasselbe Muster wie pageButton()/pageFirstOnMap() weiter unten: Treffer zaehlt, wenn
    // das oberste Element das Ziel selbst oder eines seiner Nachfahren ist.
    let covered = false
    let coveredBy = null
    if (box.width > 0 && box.height > 0) {
      const at = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
      const hit = Boolean(at && (at === target || target.contains(at)))
      covered = !hit
      if (covered && at) coveredBy = `${at.tagName.toLowerCase()}${[...at.classList].slice(0, 2).map((c) => `.${c}`).join('')}`
    }
    out.push({ selector, text, width, height, viaLabel: Boolean(label), covered, coveredBy })
  }
  return out
}

function pageCanvases() {
  return [...document.querySelectorAll('.map-wrapper canvas.map-layer')].map((c) => {
    const r = c.getBoundingClientRect()
    return {
      name: c.classList.contains('map-layer--overlay') ? 'Overlay' : 'Basis',
      cssWidth: r.width,
      cssHeight: r.height,
      bitmapWidth: c.width,
      bitmapHeight: c.height,
    }
  })
}

function pageMapState() {
  const wrapper = document.querySelector('.map-wrapper')
  const canvas = document.querySelector('canvas[role="application"]')
  const rect = canvas ? canvas.getBoundingClientRect() : null
  const tip = document.querySelector('.tooltip')
  const tipStyle = tip ? getComputedStyle(tip) : null
  const picker = document.querySelector('.picker select')
  let signature = null
  try {
    const small = document.createElement('canvas')
    small.width = 48
    small.height = 27
    const ctx = small.getContext('2d')
    for (const layer of document.querySelectorAll('.map-wrapper canvas.map-layer')) ctx.drawImage(layer, 0, 0, 48, 27)
    const data = ctx.getImageData(0, 0, 48, 27).data
    let h = 2166136261
    for (let i = 0; i < data.length; i++) {
      h ^= data[i]
      h = Math.imul(h, 16777619) >>> 0
    }
    signature = h.toString(16)
  } catch {
    signature = null
  }
  const attr = (name) => (wrapper ? wrapper.getAttribute(name) : null)
  const counts = window.__androidCheckPointer
  return {
    attrs: {
      x: attr('data-view-x'),
      y: attr('data-view-y'),
      scale: attr('data-view-scale'),
      selected: attr('data-selected-province'),
    },
    canvas: rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : null,
    aux: {
      signature,
      pickerValue: picker ? picker.value : null,
      tooltip: Boolean(tip && tip.getBoundingClientRect().width > 0 && tipStyle.visibility !== 'hidden' && tipStyle.display !== 'none'),
      visualScale: window.visualViewport ? Math.round(window.visualViewport.scale * 1000) / 1000 : 1,
      scrollX: Math.round(window.scrollX),
      scrollY: Math.round(window.scrollY),
      ...(counts ? { pointer: { down: counts.down, move: counts.move, up: counts.up, cancel: counts.cancel, target: counts.target } } : {}),
    },
  }
}

/**
 * Zaehlt die Zeigerereignisse einer Geste (passiv, in der Capture-Phase - die Anwendung
 * merkt nichts). `reset` setzt vor jeder Geste auf null.
 */
function pagePointerRecorder(reset) {
  let counts = window.__androidCheckPointer
  if (!counts) {
    counts = { down: 0, move: 0, up: 0, cancel: 0, target: null }
    window.__androidCheckPointer = counts
    const on = (type, key) =>
      document.addEventListener(
        type,
        (event) => {
          counts[key]++
          const t = event.target
          if (key === 'down' && counts.target === null && t && t.tagName) {
            counts.target = `${t.tagName.toLowerCase()}${[...t.classList].slice(0, 2).map((c) => `.${c}`).join('')}`
          }
        },
        { capture: true, passive: true },
      )
    on('pointerdown', 'down')
    on('pointermove', 'move')
    on('pointerup', 'up')
    on('pointercancel', 'cancel')
  }
  if (reset) {
    counts.down = 0
    counts.move = 0
    counts.up = 0
    counts.cancel = 0
    counts.target = null
  }
  return true
}

/**
 * Der erste Kandidat, an dem jeder Finger (Kandidat + Versatz) wirklich die Karte trifft.
 * Dazu, was an der Kartenmitte liegt, wenn es nicht die Karte ist.
 */
function pageFirstOnMap(candidates, offsets) {
  const canvas = document.querySelector('canvas[role="application"]')
  const describe = (el) => (el ? `${el.tagName.toLowerCase()}${[...el.classList].slice(0, 2).map((c) => `.${c}`).join('')}` : 'nichts')
  if (!canvas) return { index: -1, centreCover: 'keine Karte' }
  const r = canvas.getBoundingClientRect()
  const atCentre = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
  const centreCover = atCentre === canvas ? null : describe(atCentre)
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]
    if (offsets.every((o) => document.elementFromPoint(c.x + o.x, c.y + o.y) === canvas)) return { index: i, centreCover }
  }
  return { index: -1, centreCover }
}

/** Mittelpunkt eines Knopfs, nach Text oder aria-label; vorher in Sicht gerollt. */
function pageButton(by, value) {
  const buttons = [...document.querySelectorAll('button')]
  const b =
    by === 'text'
      ? buttons.find((x) => x.offsetParent !== null && (x.textContent ?? '').trim() === value)
      : buttons.find((x) => x.getAttribute('aria-label') === value)
  if (!b) return null
  b.scrollIntoView({ block: 'center', inline: 'center' })
  const r = b.getBoundingClientRect()
  const x = r.left + r.width / 2
  const y = r.top + r.height / 2
  const hit = document.elementFromPoint(x, y)
  return { x, y, width: r.width, height: r.height, hit: Boolean(hit && (hit === b || b.contains(hit))), disabled: b.disabled }
}

// ---------------------------------------------------------------------------------------
// Touch
// ---------------------------------------------------------------------------------------

async function touch(cdp, type, points) {
  const touchPoints = points.map((p, id) => ({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, id, radiusX: 4, radiusY: 4, force: 1 }))
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints })
}

async function tap(cdp, point) {
  await touch(cdp, 'touchStart', [point])
  await sleep(60)
  await touch(cdp, 'touchEnd', [])
}

// ---------------------------------------------------------------------------------------
// Ein Lauf: Partie per Touch starten, dann die neun Pruefungen
// ---------------------------------------------------------------------------------------

function loadProvinces() {
  try {
    const map = JSON.parse(readFileSync(join(ROOT, 'data', 'maps', 'world.json'), 'utf8'))
    return map.provinces.map((p) => ({ id: p.id, center: p.center }))
  } catch {
    return []
  }
}

const slug = (text) => text.replace(/[^A-Za-z0-9.-]+/g, '_')

async function navigateAndSeed(cdp, url) {
  await cdp.send('Page.navigate', { url })
  await waitFor(cdp, `document.readyState === 'complete' && location.href.startsWith(${JSON.stringify(new URL(url).origin)})`, 'die Seite', 30000)
  await evaluate(cdp, `localStorage.setItem(${JSON.stringify(TUTORIAL_KEY)}, 'true'); window.__androidCheckStale = true; true`)
  await cdp.send('Page.reload', { ignoreCache: true })
  await waitFor(cdp, `!window.__androidCheckStale && document.readyState === 'complete'`, 'die neu geladene Seite', 30000)
}

/**
 * @param {*} cdp
 * @param {{ label: string, expected: import('./lib/android-check-lib.mjs').Size | null, url: string,
 *   out: string, provinces: { id: string, center: { x: number, y: number } }[],
 *   options: import('./lib/android-check-lib.mjs').Options, resetPageZoom: () => Promise<boolean> }} ctx
 */
async function runFlow(cdp, ctx) {
  const results = []
  const screenshots = []
  const targetStates = []
  const extra = {}
  let shotNr = 0
  const shot = async (name) => {
    try {
      const r = await cdp.send('Page.captureScreenshot', { format: 'png' })
      const file = `${slug(ctx.label)}-${String(++shotNr).padStart(2, '0')}-${name}.png`
      writeFileSync(join(ctx.out, file), Buffer.from(r.data, 'base64'))
      screenshots.push(file)
    } catch (error) {
      screenshots.push(`(kein Bild ${name}: ${error.message})`)
    }
  }
  /** Der Zustand VOR einer Geste; setzt zugleich den Zaehler der Zeigerereignisse zurueck. */
  const stateBefore = async () => {
    await evaluate(cdp, call(pagePointerRecorder, true))
    return evaluate(cdp, call(pageMapState))
  }
  const state = () => evaluate(cdp, call(pageMapState))
  const check = async (id, body) => {
    try {
      results.push(await body())
    } catch (error) {
      results.push({ id, pass: false, numbers: {}, detail: `Fehler im Lauf: ${error.message}` })
    }
  }
  const withAux = (result, before, after) => ({
    ...result,
    numbers: { ...result.numbers, aux: { before: before.aux, after: after.aux } },
    detail: `${result.detail} [Hilfsbeobachtung: ${auxObservation(before.aux, after.aux)}]`,
  })
  /**
   * Eine Stelle, an der jeder Finger (Punkt + Versatz) die Karte trifft und nicht etwas,
   * das darueber liegt: zuerst Provinzmitten nahe der Kartenmitte (wenn die Ansicht lesbar
   * ist), sonst ein Raster, die Mitte zuerst. Ist die Mitte verdeckt, steht es im Bericht.
   */
  const pointOn = async (s, offsets = [{ x: 0, y: 0 }]) => {
    const c = s.canvas
    if (!c) throw new Error('keine Karte (canvas[role="application"]) gefunden')
    const parsed = parseViewAttrs(s.attrs)
    const ranked = parsed.ok ? rankTapPoints(ctx.provinces, parsed.view, c).map((p) => ({ ...p, how: 'Provinzmitte' })) : []
    const grid = candidateGrid(c, 16).map((p) => ({ id: null, ...p, how: 'Raster' }))
    const all = [...ranked, ...grid]
    const absolute = all.map((p) => ({ x: c.left + p.x, y: c.top + p.y }))
    const found = await evaluate(cdp, call(pageFirstOnMap, absolute, offsets))
    const cover = found.centreCover ? `Kartenmitte verdeckt von ${found.centreCover}` : null
    if (found.index < 0) throw new Error(`keine freie Stelle auf der Karte${cover ? ` (${cover})` : ''}`)
    const p = all[found.index]
    const where = `${p.how === 'Raster' && found.index === 0 ? 'Kartenmitte' : p.how}${p.id ? ` ${p.id}` : ''} bei ${p.x}/${p.y}${cover ? `; ${cover}` : ''}`
    return { ...absolute[found.index], rel: { x: p.x, y: p.y }, province: p.id, where, centreCover: found.centreCover }
  }
  /** Wer ist gerade gewaehlt - ueber den Vertrag, sonst ueber die Provinzliste der Seitenleiste. */
  const selection = (s) =>
    s.attrs.selected !== null
      ? { value: s.attrs.selected, source: 'data-selected-province' }
      : { value: s.aux.pickerValue, source: 'Provinzliste' }
  const scrollTop = () => evaluate(cdp, 'window.scrollTo(0, 0); true')

  // --- Vorbereitung: Seite laden, Einfuehrung als gesehen markieren, Partie per Finger ---
  try {
    await navigateAndSeed(cdp, ctx.url)
    await waitFor(cdp, call(pageButton, 'text', START_BUTTON), `den Knopf "${START_BUTTON}"`, 30000)
    await sleep(300)
    await shot('startdialog')
    targetStates.push({ name: 'Startdialog', elements: await evaluate(cdp, callWithDeps(pageTargets, [pseudoHitBox])) })
    const start = await evaluate(cdp, call(pageButton, 'text', START_BUTTON))
    extra.startButton = start
    await tap(cdp, start)
    await waitFor(
      cdp,
      `Boolean(document.querySelector('canvas[role="application"]')) && !document.querySelector('[role="dialog"]')`,
      'die laufende Partie (Tipp auf den Startknopf)',
      20000,
    )
    await sleep(800)
    await scrollTop()
    await evaluate(cdp, call(pagePointerRecorder, true))
    await shot('partie')

    // --fullscreen: wie ein Spieler den Knopf "Vollbild" antippen, BEVOR die neun
    // Pruefungen laufen (Befund 2026-09-25: am Telefon frisst Chrome selbst ~80 CSS-Punkte
    // Hoehe, die Vollbild zurueckgibt). Fehlt der Knopf, ist das ein klarer Aufbaufehler
    // dieses Laufs (derselbe Weg wie ein fehlender Startknopf), kein Absturz.
    if (ctx.options.fullscreen) {
      await waitFor(cdp, call(pageButton, 'label', FULLSCREEN_BUTTON), `den Knopf "${FULLSCREEN_BUTTON}" (--fullscreen)`, 5000)
      const fsButton = await evaluate(cdp, call(pageButton, 'label', FULLSCREEN_BUTTON))
      extra.fullscreenButton = fsButton
      await tap(cdp, fsButton)
      await waitFor(cdp, 'Boolean(document.fullscreenElement)', 'den Vollbildmodus (--fullscreen)', 3000)
      // Die Groesse aendert sich mit dem Vollbildwechsel; die Karte soll neu gemessen haben.
      await sleep(SETTLE_MS)
      await scrollTop()
      await shot('vollbild')
    }
  } catch (error) {
    return { label: ctx.label, checks: finalizeChecks(results, error.message), screenshots, error: error.message, extra }
  }

  // --- 1 Umgebung, 2 Seitenscroll, 4 Canvas, dazu die Touch-Ziele der laufenden Partie ---
  let environment = null
  await check('environment', async () => {
    environment = await evaluate(cdp, call(pageEnvironment))
    return evaluateEnvironment(environment, ctx.expected)
  })
  await check('no-page-scroll', async () => evaluateScroll(await evaluate(cdp, call(pageScroll))))
  await check('map-canvas', async () => evaluateCanvas(await evaluate(cdp, call(pageCanvases))))
  try {
    targetStates.push({ name: 'Partie', elements: await evaluate(cdp, callWithDeps(pageTargets, [pseudoHitBox])) })
  } catch (error) {
    extra.targetsError = error.message
  }

  // --- 8 Langes Druecken (zuerst: noch ist nichts gewaehlt, also kein Tooltip) ---
  await check('long-press', async () => {
    await scrollTop()
    const before = await stateBefore()
    const p = await pointOn(before)
    await touch(cdp, 'touchStart', [p])
    await sleep(ctx.options.longPressMs)
    const during = await state()
    await touch(cdp, 'touchEnd', [])
    await sleep(SETTLE_MS)
    const after = await state()
    await shot('langes-druecken')
    const [was, now] = [selection(before), selection(after)]
    const result = evaluateLongPress({
      before: before.aux.tooltip,
      duringHold: during.aux.tooltip,
      after: after.aux.tooltip,
      selectedBefore: was.value,
      selectedAfter: now.value,
      selectionSource: now.source,
    })
    result.numbers = { ...result.numbers, point: p, holdMs: ctx.options.longPressMs }
    result.detail = `${result.detail} (${p.where}, ${ctx.options.longPressMs} ms)`
    return withAux(result, before, after)
  })

  // --- 7 Antippen waehlt eine Provinz ---
  await check('tap-selects', async () => {
    await scrollTop()
    const before = await stateBefore()
    const p = await pointOn(before)
    await tap(cdp, p)
    await sleep(SETTLE_MS)
    const after = await state()
    await shot('antippen')
    const result = evaluateTap(before.attrs, after.attrs)
    result.numbers = { ...result.numbers, point: p }
    result.detail = `${result.detail} (${p.where})`
    return withAux(result, before, after)
  })

  // --- 5 Ein Finger zieht die Karte, ohne die Auswahl zu aendern ---
  await check('one-finger-drag', async () => {
    await scrollTop()
    const before = await stateBefore()
    const c = before.canvas
    const finger = { dx: -Math.round(Math.min(150, c.width * 0.3)), dy: -Math.round(Math.min(100, c.height * 0.25)) }
    // Der Finger setzt dort auf, wo die Karte frei liegt; wohin er zieht, ist gleich -
    // ein Touch bleibt bei dem Element, auf dem er begann.
    const from = await pointOn(before)
    const path = linePath(from, { x: from.x + finger.dx, y: from.y + finger.dy }, 12)
    await touch(cdp, 'touchStart', [path[0]])
    for (const p of path.slice(1)) {
      await sleep(16)
      await touch(cdp, 'touchMove', [p])
    }
    await sleep(30)
    await touch(cdp, 'touchEnd', [])
    await sleep(SETTLE_MS)
    const after = await state()
    await shot('ziehen')
    const result = withAux(evaluateDrag(before.attrs, after.attrs, finger), before, after)
    result.numbers = { ...result.numbers, start: from }
    result.detail = `${result.detail} (Start ${from.where})`
    return result
  })

  // --- 6 Zwei Finger zoomen um ihre Mitte ---
  await check('pinch-zoom', async () => {
    await scrollTop()
    const before = await stateBefore()
    const c = before.canvas
    const d0 = Math.round(Math.max(30, Math.min(100, Math.min(c.width, c.height) * 0.15)))
    const d1 = Math.round(Math.min(d0 * 1.8, c.width * 0.85))
    // Beide Finger muessen beim Aufsetzen die Karte treffen; die Mitte dazwischen ist der Anker.
    const mid = await pointOn(before, [
      { x: -d0 / 2, y: 0 },
      { x: d0 / 2, y: 0 },
    ])
    const path = pinchPath(mid, d0, d1, 12)
    await touch(cdp, 'touchStart', path[0])
    for (const pair of path.slice(1)) {
      await sleep(16)
      await touch(cdp, 'touchMove', pair)
    }
    await sleep(30)
    await touch(cdp, 'touchEnd', [])
    await sleep(SETTLE_MS + 200)
    const after = await state()
    await shot('zwei-finger')
    const result = withAux(evaluatePinch(before.attrs, after.attrs, mid.rel, ctx.options.pinchTolerancePx), before, after)
    result.numbers = { ...result.numbers, fingerDistance: { from: d0, to: d1 }, mid }
    result.detail = `${result.detail} (Mitte ${mid.where}, Finger ${d0} -> ${d1} px)`
    // Hat die Geste die ganze Seite gezoomt, stellt der Lauf sie zurueck - sonst
    // treffen die folgenden Pruefungen daneben.
    if (Math.abs(after.aux.visualScale - 1) > 0.01) {
      result.numbers.pageZoomReset = await ctx.resetPageZoom()
      await scrollTop()
    }
    return result
  })

  // --- 9 Zoomknoepfe per Finger ---
  await check('zoom-buttons', async () => {
    const presses = []
    const notes = []
    for (const label of [ZOOM_IN, ZOOM_OUT]) {
      await scrollTop()
      const button = await evaluate(cdp, call(pageButton, 'label', label))
      const before = await stateBefore()
      if (button) {
        await tap(cdp, button)
        await sleep(SETTLE_MS)
      }
      const after = await state()
      presses.push({
        label,
        found: Boolean(button),
        hit: button ? button.hit : undefined,
        before: before.attrs,
        after: after.attrs,
        size: button ? { width: button.width, height: button.height } : undefined,
        aux: { before: before.aux, after: after.aux },
      })
      // Je Knopf, nicht ueber beide: hinein und wieder heraus landet sonst beim Ausgangsbild.
      notes.push(`${label}: ${auxObservation(before.aux, after.aux)}`)
    }
    await shot('zoomknoepfe')
    const result = evaluateZoomButtons(presses)
    result.numbers = { ...result.numbers, presses: presses.map((p) => ({ label: p.label, found: p.found, hit: p.hit, size: p.size, aux: p.aux })) }
    result.detail = `${result.detail} [Hilfsbeobachtung: ${notes.join('; ')}]`
    return result
  })

  // --- 3 Touch-Ziele: Startdialog, Partie und (falls etwas gewaehlt ist) die Provinz ---
  await check('touch-targets', async () => {
    await scrollTop()
    const now = await state()
    if (now.attrs.selected || now.aux.pickerValue) {
      await shot('provinz')
      targetStates.push({ name: 'Provinz gewaehlt', elements: await evaluate(cdp, callWithDeps(pageTargets, [pseudoHitBox])) })
    }
    return evaluateTargetStates(targetStates, ctx.options.minTarget)
  })

  return { label: ctx.label, environment, checks: finalizeChecks(results, null), screenshots, error: null, extra }
}

// ---------------------------------------------------------------------------------------
// Ziele: Chromium mit Touch-Emulation, Android ueber adb
// ---------------------------------------------------------------------------------------

function defaultBrowser() {
  const candidates = [
    'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ]
  return candidates.find((c) => existsSync(c)) ?? null
}

function killTree(child) {
  if (!child?.pid) return
  try {
    if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
    else child.kill('SIGTERM')
  } catch {
    // schon beendet
  }
}

async function assertServed(url) {
  try {
    const response = await globalThis.fetch(url)
    if (!response.ok) throw new Error(String(response.status))
  } catch (error) {
    throw new SetupError(
      `${url} antwortet nicht (${error.message}). Erst bauen und ausliefern, etwa: pnpm desktop:build; ` +
        'pnpm --filter @worldwar/desktop preview --host 127.0.0.1 --port <port> --strictPort',
    )
  }
}

async function runChromium(options, url, out, provinces, report) {
  const browser = options.browser ?? defaultBrowser()
  if (!browser || !existsSync(browser)) throw new SetupError(`kein Browser gefunden (${browser ?? 'Brave/Edge fehlen'}); --browser <exe> angeben`)
  await assertServed(url)
  report.browser = browser
  const profile = join(tmpdir(), `worldwar-android-check-profile-${process.pid}-${Date.now()}`)
  mkdirSync(profile, { recursive: true })
  const port = options.debugPort
  const child = spawn(
    browser,
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      // Ein verdecktes Fenster darf nicht einfrieren: rAF zeichnet die Karte.
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-background-timer-throttling',
      '--window-size=1400,1000',
      'about:blank',
    ],
    { stdio: 'ignore' },
  )
  let cdp = null
  try {
    let version = null
    for (let i = 0; i < 60 && !version; i++) {
      await sleep(500)
      version = await getJson(`http://127.0.0.1:${port}/json/version`).catch(() => null)
    }
    if (!version) throw new SetupError(`Debug-Port ${port} antwortet nicht - laeuft dort schon etwas?`)
    report.browserVersion = version.Browser ?? null
    const targets = await getJson(`http://127.0.0.1:${port}/json`)
    let page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl)
    if (!page) page = await getJson(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })
    cdp = await connect(page.webSocketDebuggerUrl)
    await cdp.send('Page.enable')
    await cdp.send('Runtime.enable')
    await cdp.send('Page.bringToFront').catch(() => null)
    const resetPageZoom = async () => {
      try {
        await cdp.send('Emulation.resetPageScaleFactor')
        return true
      } catch {
        return false
      }
    }
    for (const size of options.sizes) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: size.width,
        height: size.height,
        deviceScaleFactor: size.dpr,
        mobile: true,
        screenWidth: size.width,
        screenHeight: size.height,
        screenOrientation: { type: 'landscapePrimary', angle: 90 },
      })
      await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
      console.log(`Lauf ${size.label} ...`)
      report.runs.push(await runFlow(cdp, { label: size.label, expected: size, url, out, provinces, options, resetPageZoom }))
    }
  } finally {
    cdp?.close()
    killTree(child)
    await sleep(1500)
    try {
      rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 })
    } catch {
      console.warn(`Profilordner blieb liegen: ${profile}`)
    }
  }
}

async function runAndroid(options, url, out, provinces, report) {
  const adb = (serial, args) =>
    execFileSync(options.adb, serial ? ['-s', serial, ...args] : args, { encoding: 'utf8', timeout: 30000, windowsHide: true })
  let devicesText
  try {
    devicesText = adb(null, ['devices'])
  } catch (error) {
    throw new SetupError(`adb laeuft nicht (${options.adb}): ${error.message}`)
  }
  const picked = pickSerial(parseAdbDevices(devicesText), options.serial)
  if (!picked.ok) throw new SetupError(picked.error)
  const serial = picked.serial
  report.serial = serial
  const target = new URL(url)
  const local = target.hostname === 'localhost' || target.hostname === '127.0.0.1'
  const gamePort = Number(target.port || (target.protocol === 'https:' ? 443 : 80))
  if (local) {
    await assertServed(`http://127.0.0.1:${gamePort}${target.pathname}`)
    adb(serial, ['reverse', `tcp:${gamePort}`, `tcp:${gamePort}`])
  }
  const devtools = options.devtoolsPort
  const hadForward = forwardExists(adb(null, ['forward', '--list']), serial, devtools, DEVTOOLS_SOCKET)
  adb(serial, ['forward', `tcp:${devtools}`, DEVTOOLS_SOCKET])
  report.adb = { reverse: local ? gamePort : null, forward: devtools, forwardExisted: hadForward }
  let cdp = null
  try {
    // Die Adresse in einfachen Anfuehrungszeichen: adb reicht sie an die Schale des Geraets.
    adb(serial, ['shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', `'${url}'`, 'com.android.chrome'])
    let page = null
    for (let i = 0; i < 60 && !page; i++) {
      await sleep(500)
      const targets = await getJson(`http://127.0.0.1:${devtools}/json`).catch(() => [])
      page = pickPageTarget(targets, url)
    }
    if (!page) {
      throw new SetupError(
        `kein Chrome-Tab mit ${url} ueber tcp:${devtools} - ist Chrome eingerichtet (Erstbegruessung von Hand bestaetigt) und im Vordergrund?`,
      )
    }
    cdp = await connect(page.webSocketDebuggerUrl)
    await cdp.send('Page.enable')
    await cdp.send('Runtime.enable')
    await cdp.send('Page.bringToFront').catch(() => null)
    const resetPageZoom = async () => {
      try {
        await cdp.send('Emulation.resetPageScaleFactor')
        return true
      } catch {
        try {
          await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 })
          return true
        } catch {
          return false
        }
      }
    }
    const label = `android_${serial}`
    console.log(`Lauf ${label} ...`)
    report.runs.push(await runFlow(cdp, { label, expected: null, url, out, provinces, options, resetPageZoom }))
  } finally {
    cdp?.close()
    // Die eigene Weiterleitung raeumen; eine fremde (vorher schon da) bleibt stehen.
    if (!hadForward) {
      try {
        adb(serial, ['forward', '--remove', `tcp:${devtools}`])
      } catch {
        // schon weg
      }
    }
  }
}

// ---------------------------------------------------------------------------------------

function gitCommit() {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim()
  } catch {
    return null
  }
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2), process.env)
  if (!parsed.ok) {
    console.error(parsed.error)
    console.error(USAGE)
    return 2
  }
  const options = parsed.options
  if (options.help) {
    console.log(USAGE)
    return 0
  }
  if (typeof globalThis.WebSocket !== 'function' || typeof globalThis.fetch !== 'function') {
    console.error('Dieses Node hat kein eingebautes WebSocket/fetch: Node 22 oder neuer, oder node --experimental-websocket.')
    return 2
  }
  const url = pageUrl(options)
  const out = options.out ?? join(tmpdir(), 'worldwar-android-check', stamp())
  mkdirSync(out, { recursive: true })
  const report = {
    tool: 'scripts/android-check.mjs',
    measuredAt: new Date().toISOString(),
    commit: gitCommit(),
    target: options.target,
    url,
    settings: { longPressMs: options.longPressMs, pinchTolerancePx: options.pinchTolerancePx, minTarget: options.minTarget },
    runs: [],
    setupError: null,
    pass: false,
  }
  const provinces = loadProvinces()
  let code
  try {
    if (options.target === 'chromium') await runChromium(options, url, out, provinces, report)
    else await runAndroid(options, url, out, provinces, report)
    code = exitCodeFor(report)
  } catch (error) {
    report.setupError = error.message
    console.error(`${error instanceof SetupError ? 'Aufbau' : 'Abbruch'}: ${error.message}`)
    code = 2
  }
  report.pass = code === 0
  writeFileSync(join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
  if (report.runs.length) console.log(`\n${formatReport(report)}`)
  console.log(`\nBericht: ${join(out, 'report.json')}`)
  return code
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error)
    process.exit(2)
  },
)
