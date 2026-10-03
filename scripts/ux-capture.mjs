#!/usr/bin/env node
/**
 * UX-Aufnahme und Prüfmodus: Bildschirmfotos, Messwerte und Schwellen (UX-PLAN, T-M44-01, T-M44-02).
 *
 * Faehrt das laufende Spiel mit Playwright durch — Start, Partie anlegen, Karte, Provinz,
 * Armee, Marsch, Tempo, Gefecht, Diplomatie, Meldungen, Fehler, Spielstaende, Spielende —
 * in mehreren Fenstergroessen und schreibt PNGs plus `messwerte.json` in einen Zielordner.
 * Phase 6 des UX-Plans faehrt dasselbe Skript mit `--out docs/ux/after`.
 *
 * ## Aufnahme
 *
 *   pnpm dev --port 5321 --strictPort        # in einem zweiten Terminal (oder --serve)
 *   node scripts/ux-capture.mjs --out docs/ux/before [--url http://localhost:5321/]
 *                               [--viewports 375x667,1280x800,...] [--no-shots]
 *                               [--merge] [--section viewports|bundle] [--perf-only]
 *                               [--measure-only 1920x1080]
 *
 * --merge         ergaenzt ein vorhandenes messwerte.json, statt es zu ersetzen
 * --section       unter welchem Schluessel die Groessen stehen (`bundle` fuer den Lauf gegen
 *                 `vite build` + `vite preview`, WORKFLOW Falle 18)
 * --perf-only     bricht nach der Tempo-100-Messung ab (fuer den Buendellauf; der vorbereitete
 *                 Spielstand braucht den Dev-Server, weil er den Kern per /@fs laedt)
 * --measure-only  Groessen, die nur als Messwert laufen, ohne Bild (Repo-Groesse, Review Punkt 16:
 *                 fuer docs/ux/after nur 375x667, 1280x800 und die neuen Groessen als Bild)
 *
 * ## Pruefmodus (T-M44-02) — die Browser-Abnahme jeder Aufgabe von M44
 *
 *   pnpm ux:check                            # = node scripts/ux-capture.mjs --check
 *   node scripts/ux-capture.mjs --check --only R-UX-02/AK1 --viewports 1280x800,1366x768
 *   node scripts/ux-capture.mjs --check --from docs/ux/before/messwerte.json   # ohne Browser
 *
 * --check            faehrt die Aufnahme (ohne Bilder, in einen Zwischenordner) und wertet sie gegen
 *                    `scripts/ux-thresholds.mjs` aus: je Kriterium gruen/ROT/offen mit Messwert,
 *                    Exit 1 bei einem roten. Faehrt auch den Buendellauf (`--bundle`) und den
 *                    Mehrspielerlauf (`--mp`), wenn ein gewaehltes Kriterium sie braucht; mit
 *                    `--only` laeuft nur, was gebraucht wird.
 * --only <teil>      nur Kriterien, deren Kennung <teil> enthaelt (`R-UX-02`, `06/AK2`, Komma-Liste)
 * --strict           auch ein offenes Kriterium (noch kein Messwert) gilt als Fehler
 * --from <datei>     wertet nur aus, startet keinen Browser und keinen Server
 * --baseline <datei> Vorher-Stand fuer die Rueckfallpruefung (Vorgabe: docs/ux/before/messwerte.json)
 * --baseline-bundle <datei>
 *                    Ausgangswert des Buendels vom selben Tag (Falle 18: eine absolute Schwelle
 *                    unter der eigenen Streuung ist keine)
 * --serve            startet `vite` im Worktree selbst (Port aus --url) und beendet ihn am Ende;
 *                    unter `--check` automatisch, wenn die Adresse nicht antwortet
 *
 * --bundle           Buendellauf: `vite build` (ohne Mehrspielerflagge), `vite preview` auf
 *                    --preview-port (Vorgabe 5322), Messung von Ladezeit und Tempo 100 in
 *                    1920x1080 (und --viewports) unter dem Schluessel `bundle`; der Server wird
 *                    beendet. --no-build nimmt das vorhandene `apps/desktop/dist`.
 * --mp               Mehrspielerlauf: Bau mit WORLDWAR_MULTIPLAYER=1 nach `apps/desktop/dist-mp`
 *                    (nicht eingecheckt), Hostdienst aus `apps/party` im Prozess, Gastgeber legt an,
 *                    Gast tritt per Link bei (Bedingungen, Name, Lobby), Kopfleiste mit fester Rate,
 *                    gesperrter Vorhang (ein Hash der Gegenseite wird verfaelscht) — in 375x667 und
 *                    1280x800 (oder --mp-viewports). Schluessel `mp`.
 *
 * Weitere Angaben: --bundle-viewports <liste> (Vorgabe 1920x1080), --mp-viewports <liste> (Vorgabe
 * 375x667,1280x800), --preview-port <n> (Vorgabe 5322), --no-build (vorhandenes dist bzw. dist-mp nehmen),
 * --shots (auch im Pruefmodus Bilder schreiben). Ohne --out schreibt der Pruefmodus nach <temp>/ux-check,
 * nie ins Repo; ohne --check ist die Vorgabe weiter docs/ux/before — wer dort nicht hin will, gibt --out an.
 *
 * Browser: UX_CHROMIUM (Pfad zu einer Chromium-Datei) gewinnt; sonst das vorinstallierte
 * Chromium unter PLAYWRIGHT_BROWSERS_PATH bzw. /opt/pw-browsers; unter Windows, wo beides
 * fehlt, Edge ueber `channel: 'msedge'` (Chrome ist dort nicht installiert, WORKFLOW Falle 17).
 *
 * Spiellogik wird nicht angefasst. Das Spielende entsteht aus einem echten Spielstand der
 * Aufnahme: dem Menschen (Sieg) oder einer Gegenmacht (Niederlage) werden per Besitz so viele
 * Provinzen zugeschrieben, bis `checkVictory` des Kerns den Punkteanteil >= pointsShareToWin
 * selbst meldet; erst dann wird `victory.winner` gesetzt und der Stand mit dem `serialise` des
 * Kerns neu versiegelt — derselbe Weg, den ein Laden nimmt. Der Kern bleibt unveraendert
 * (Befund B-22: vorher stand dort ein gesetzter `winner` ohne erfuellte Bedingung).
 *
 * Nie `playwright install`. Keine Benchmark-Messung: die Ruckler-Zahlen sind grob und haengen
 * an der Maschinenlast — sie dienen dem Vorher/Nachher auf derselben Maschine (Falle 18: am
 * gebauten Buendel, gegen einen am selben Tag gemessenen Ausgangswert).
 *
 * LOESCHVERMERK (Review): der zweite Absatz „Browser: das vorinstallierte Chromium …“ der Fassung
 * von T-M44-01 ist im Absatz „Browser: UX_CHROMIUM …“ aufgegangen (derselbe Inhalt, vollstaendiger).
 */
// Die Funktionen in page.evaluate laufen im Browser; ihre Namen kennt ESLint unter Node nicht.
/* global document, window, getComputedStyle, innerWidth, innerHeight, HTMLElement, PerformanceObserver, performance, requestAnimationFrame, indexedDB, fetch, AbortSignal, setTimeout */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { cpus, loadavg, tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'
import AxeBuilderModule from '@axe-core/playwright'
import { evaluate, exitCodeFor, render, sectionsNeeded } from './ux-thresholds.mjs'
import { grantUntilVictory } from './lib/ux-victory.mjs'

const AxeBuilder = AxeBuilderModule.default ?? AxeBuilderModule

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const flag = (name) => process.argv.includes(`--${name}`)
const parseViewports = (list) =>
  list.split(',').map((v) => {
    const [w, h] = v.split('x').map(Number)
    return { width: w, height: h, tag: `${w}x${h}` }
  })

const CHECK = flag('check')
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
/** Die fuenf Groessen der Anforderungen (R-UX-01); 1920x1080 als Messwert, nicht als Bild. */
const CHECK_VIEWPORTS = '375x667,667x375,1280x800,1366x768,1920x1080'
const DEFAULT_VIEWPORTS = '375x667,667x375,1280x800,1366x768,1920x1080,1024x768,768x1024,320x568'
const MP_VIEWPORTS = parseViewports(arg('mp-viewports', '375x667,1280x800'))
// Im Pruefmodus entstehen keine Bilder und nichts im Repo: der Zwischenordner liegt im Temp.
const OUT = resolve(arg('out', CHECK ? join(tmpdir(), 'ux-check') : 'docs/ux/before'))
const BASE_URL = arg('url', 'http://localhost:5321/')
const VIEWPORTS = parseViewports(arg('viewports', CHECK ? CHECK_VIEWPORTS : DEFAULT_VIEWPORTS))
const SHOTS = CHECK ? flag('shots') : !flag('no-shots')
const MEASURE_ONLY = arg('measure-only', '').split(',').filter(Boolean)
const MERGE = flag('merge')
const SECTION = arg('section', 'viewports')
const PERF_ONLY = flag('perf-only')
const PREVIEW_PORT = Number(arg('preview-port', '5322'))
const ONLY = arg('only', '')

// LOESCHVERMERK (Review): die Fassung von T-M44-01 las die Angaben so (ersetzt durch die Zeilen
// oben, die dasselbe tun und `--check` kennen; `flag` und `parseViewports` ersetzen die Wiederholung):
//   const OUT = resolve(arg('out', 'docs/ux/before'))
//   const VIEWPORTS = arg('viewports', '375x667,667x375,1280x800,1366x768,1920x1080,1024x768,768x1024,320x568')
//     .split(',').map((v) => { const [w, h] = v.split('x').map(Number); return { width: w, height: h, tag: `${w}x${h}` } })
//   const SHOTS = !process.argv.includes('--no-shots')
//   const MERGE = process.argv.includes('--merge')
//   const PERF_ONLY = process.argv.includes('--perf-only')

function findChromium() {
  if (process.env.UX_CHROMIUM) return process.env.UX_CHROMIUM
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers'
  if (!existsSync(root)) return undefined
  const dir = readdirSync(root).find((d) => /^chromium-\d+$/.test(d))
  const exe = dir ? join(root, dir, 'chrome-linux', 'chrome') : undefined
  return exe && existsSync(exe) ? exe : undefined
}

function launchOptions() {
  const executablePath = findChromium()
  if (executablePath) return { executablePath }
  return process.platform === 'win32' ? { channel: 'msedge' } : {}
}

/**
 * Die Ansichten in fester Reihenfolge: die Nummer im Dateinamen haengt an der Ansicht, nicht am
 * Lauf — fehlt eine Ansicht in einer Fenstergroesse, verschieben sich die anderen nicht.
 */
const SCENES = [
  'start-neue-partie',
  'partie-anlegen-startknopf',
  'spielstaende-leer',
  'karte-start-tutorial',
  'kartenansicht',
  'kopfleiste-hud',
  'karte-gezoomt',
  'kartenmodus-rohstoffe',
  'provinz-auswahl',
  'hinweis-erklaerung',
  'rueckmeldung-bau-befohlen',
  'tempo-100-laeuft',
  'pause-armee-ausgehoben',
  'armee-auswahl',
  'beschuss-gesperrt',
  'marsch-zielwahl',
  'fehler-ungueltiges-ziel',
  'marsch-ziel-gewaehlt',
  'marsch-befohlen',
  'diplomatie',
  'krieg-erklaert-ohne-rueckfrage',
  'kampf-gefecht',
  'protokoll-kaempfe',
  'meldungen-depesche',
  'panel-markt',
  'panel-spionage',
  'panel-rangliste-sieg',
  'kartenmodus-beziehungen',
  'menue',
  'einstellungen',
  'spielstand-gespeichert',
  'fehler-spielstand-beschaedigt',
  'spielende-sieg',
  'spielende-niederlage',
]

mkdirSync(OUT, { recursive: true })

const result = {
  createdAt: new Date().toISOString(),
  url: BASE_URL,
  outDir: OUT,
  viewports: {},
}

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

/** Alles, was man anfassen kann, mit Groesse — fuer die 44-px-Zaehlung. */
async function touchTargets(page) {
  return page.evaluate(() => {
    const sel = 'button, a[href], input, select, textarea, summary, [role=button], [role=tab], [tabindex]:not([tabindex="-1"])'
    const rows = []
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect()
      const style = getComputedStyle(el)
      if (r.width === 0 || r.height === 0 || style.visibility === 'hidden' || style.display === 'none') continue
      if (r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) continue
      const label = (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 50)
      // R-UX-06/AK3 zaehlt nur Kopfleiste, Seitenleiste und Dialoge; Karte und Fuss sind eigene Bereiche.
      const region = el.closest('[role=dialog], [role=alertdialog], .dialog') ? 'dialog' : el.closest('header') ? 'header' : el.closest('.side') ? 'side' : el.closest('.foot') ? 'foot' : 'other'
      rows.push({ label, region, w: Math.round(r.width), h: Math.round(r.height) })
    }
    const small = rows.filter((r) => r.w < 44 || r.h < 44)
    const tiny = rows.filter((r) => r.w < 24 || r.h < 24)
    const regions = {}
    for (const name of ['header', 'side', 'dialog']) {
      const own = rows.filter((r) => r.region === name)
      regions[name] = { total: own.length, under44: own.filter((r) => r.w < 44 || r.h < 44).length, under24: own.filter((r) => r.w < 24 || r.h < 24).length }
    }
    return { total: rows.length, under44: small.length, under24: tiny.length, share: rows.length ? +(small.length / rows.length).toFixed(3) : 0, regions, samples: small.slice(0, 25) }
  })
}

/** Wie viel Flaeche bekommt was? Waagerechter Ueberlauf, Kopfleiste, sichtbare Karte. */
async function layout(page) {
  return page.evaluate(() => {
    const box = (sel) => {
      const el = document.querySelector(sel)
      if (!el) return null
      const r = el.getBoundingClientRect()
      const visW = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0))
      const visH = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0))
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), visibleArea: Math.round(visW * visH) }
    }
    const overflowing = [...document.querySelectorAll('.header__top, .speeds, .modes, .resources, .side, .foot, .dialog, .slots')]
      .filter((el) => el.scrollWidth > el.clientWidth + 1)
      .map((el) => `${el.className.split(' ')[0]} ${el.scrollWidth}>${el.clientWidth}`)
    const map = box('.map-layer--overlay')
    const drawn = (el) => {
      const r = el.getBoundingClientRect()
      return getComputedStyle(el).display !== 'none' && (r.width > 0 || r.height > 0)
    }
    const chip = document.querySelector('.alarm-chip')
    const goal = document.querySelector('header .meter')
    return {
      viewport: { w: innerWidth, h: innerHeight },
      // Zustand der Kopfleiste, damit R-UX-02/AK1 weiss, ob Alarmchip und Siegziel dabei waren.
      alarmChipVisible: Boolean(chip && drawn(chip)),
      goalVisible: Boolean(goal && drawn(goal)),
      // R-UX-02/AK2: ein Element mit `hidden`, das trotzdem gezeichnet wird.
      hiddenDrawn: [...document.querySelectorAll('[hidden]')].filter((el) => getComputedStyle(el).display !== 'none').map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`),
      pageOverflowX: document.documentElement.scrollWidth > innerWidth,
      header: box('header'),
      map,
      mapShareOfViewport: map ? +(map.visibleArea / (innerWidth * innerHeight)).toFixed(3) : 0,
      side: box('.side'),
      foot: box('.foot'),
      overflowingRegions: overflowing,
    }
  })
}

/** Tab-Reihenfolge und sichtbarer Fokus. */
async function keyboardWalk(page, steps = 40) {
  await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined))
  const order = []
  for (let i = 0; i < steps; i++) {
    await page.keyboard.press('Tab')
    const info = await page.evaluate(() => {
      const el = document.activeElement
      if (!el || el === document.body) return null
      const s = getComputedStyle(el)
      const outline = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0
      const ring = s.boxShadow && s.boxShadow !== 'none'
      const r = el.getBoundingClientRect()
      return {
        inDialog: Boolean(el.closest('[role=dialog], [role=alertdialog]')),
        el: el.tagName.toLowerCase(),
        label: (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40),
        focusVisible: el.matches(':focus-visible'),
        indicator: Boolean(outline || ring),
        offscreen: r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth,
      }
    })
    order.push(info)
  }
  const real = order.filter(Boolean)
  return {
    steps,
    reached: real.length,
    distinct: new Set(real.map((o) => `${o.el}:${o.label}`)).size,
    withoutIndicator: real.filter((o) => !o.indicator).length,
    offscreen: real.filter((o) => o.offscreen).length,
    // Nur sinnvoll, wenn die Wanderung bei offenem Dialog begann (R-UX-06/AK2).
    outsideDialog: real.filter((o) => !o.inDialog).length,
    order: real.slice(0, 40).map((o) => `${o.el}:${o.label}${o.indicator ? '' : ' [kein Fokusrahmen]'}${o.offscreen ? ' [ausserhalb]' : ''}`),
  }
}

async function axe(page, name, store) {
  try {
    const r = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()
    store[name] = {
      passes: r.passes.length,
      incomplete: r.incomplete.map((v) => ({ id: v.id, nodes: v.nodes.length })),
      violations: r.violations.length,
      nodes: r.violations.reduce((s, v) => s + v.nodes.length, 0),
      byRule: r.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.length,
        help: v.help,
        samples: v.nodes.slice(0, 4).map((n) => ({ target: n.target.join(' '), summary: (n.failureSummary ?? '').split('\n').slice(1, 2).join(' ').slice(0, 160) })),
      })),
    }
  } catch (e) {
    store[name] = { error: String(e).slice(0, 200) }
  }
}

/**
 * R-UX-06/AK2: bleibt Tab in einem offenen Dialog, und schliesst Escape ihn, soweit er schliessbar
 * ist? Schliesst den Dialog (Escape) — wer danach noch etwas braucht, oeffnet ihn neu.
 */
async function dialogProbe(page, store, name, steps = 10, { escape = true } = {}) {
  const sel = '[role=dialog], [role=alertdialog]'
  if (!(await page.locator(sel).first().isVisible().catch(() => false))) {
    store[name] = { present: false }
    return
  }
  const walk = await keyboardWalk(page, steps)
  const closable = await page.evaluate(() =>
    [...document.querySelectorAll('[role=dialog] button, [role=alertdialog] button')].some((b) => /schließen|×/i.test(b.getAttribute('aria-label') || b.textContent || '')),
  )
  if (!escape) {
    // Lobby und Beitritt: Escape verliesse die Partie und risse die Leitung ab — nur der Tab wird geprueft.
    store[name] = { present: true, steps, focusLeaves: walk.outsideDialog > 0, outside: walk.outsideDialog, closable, closedByEscape: null }
    return
  }
  await page.keyboard.press('Escape')
  await page.waitForTimeout(250)
  const stillOpen = await page.locator(sel).first().isVisible().catch(() => false)
  store[name] = { present: true, steps, focusLeaves: walk.outsideDialog > 0, outside: walk.outsideDialog, closable, closedByEscape: !stillOpen }
}

/** Was zeigt der Kartentooltip gerade? (R-UX-02/AK3) */
async function tooltipState(page) {
  return page.evaluate(() => {
    const el = document.querySelector('.tooltip')
    if (!el) return { visible: false, text: '' }
    const r = el.getBoundingClientRect()
    const visible = getComputedStyle(el).visibility !== 'hidden' && r.width > 0 && r.height > 0
    return { visible, text: (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 200) }
  })
}

/** Was der Endedialog sagt, und ob er die Siegbedingung nennt (R-UX-05/AK4). */
async function endDialogText(page) {
  return page.evaluate(() => {
    const el = document.querySelector('[role=dialog]')
    const text = (el?.textContent ?? '').trim().replace(/\s+/g, ' ')
    return { text: text.slice(0, 400), namesCondition: /Siegbedingung|Punkteanteil|\d+\s?%/.test(text) }
  })
}

/** Grobe Ruckler: lange Aufgaben (>50 ms) waehrend einer Handlung. */
async function longTasksDuring(page, action) {
  await page.evaluate(() => {
    window.__uxLong = []
    try {
      window.__uxObs?.disconnect()
      window.__uxObs = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) window.__uxLong.push(e.duration)
      })
      window.__uxObs.observe({ type: 'longtask', buffered: false })
    } catch {
      /* ohne longtask-Unterstuetzung bleibt die Liste leer */
    }
    window.__uxFrames = []
    let last = performance.now()
    window.__uxRaf = true
    const tick = (now) => {
      window.__uxFrames.push(now - last)
      last = now
      if (window.__uxRaf) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  const t0 = Date.now()
  await action()
  const wall = Date.now() - t0
  await page.waitForTimeout(300)
  return page.evaluate((wall) => {
    window.__uxRaf = false
    const l = window.__uxLong
    const f = window.__uxFrames.slice(1)
    const sorted = [...f].sort((a, b) => a - b)
    const pct = (p) => (sorted.length ? +sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))].toFixed(1) : null)
    return {
      wallMs: wall,
      longTasks: l.length,
      longTaskTotalMs: Math.round(l.reduce((s, d) => s + d, 0)),
      longTaskMaxMs: Math.round(Math.max(0, ...l)),
      frames: f.length,
      frameP50Ms: pct(0.5),
      frameP95Ms: pct(0.95),
      framesOver50Ms: f.filter((d) => d > 50).length,
    }
  }, wall)
}

/** Fenster wie ein Spieler es hat: unter 600 px kurzer Seite per Finger (inputMode.ts). */
const contextOptions = (vp) => ({
  viewport: { width: vp.width, height: vp.height },
  deviceScaleFactor: 1,
  hasTouch: Math.min(vp.width, vp.height) < 600,
  isMobile: Math.min(vp.width, vp.height) < 600,
  locale: 'de-DE',
})

async function runViewport(browser, vp, run = { url: BASE_URL, perfOnly: PERF_ONLY }) {
  const context = await browser.newContext(contextOptions(vp))
  const page = await context.newPage()
  const data = { steps: [], failures: [], axe: {}, touch: {}, keyboard: {}, perf: {}, notes: [], probes: {}, dialogs: {} }
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 200))
  })
  const shot = async (name, opts = {}) => {
    const index = SCENES.indexOf(name)
    const prefix = index >= 0 ? String(index + 1).padStart(2, '0') : 'x'
    const file = `${prefix}-${name}-${vp.tag}.png`
    if (SHOTS && !MEASURE_ONLY.includes(vp.tag)) await page.screenshot({ path: join(OUT, file), fullPage: false, ...opts })
    data.steps.push(file)
    return file
  }
  const step = async (label, fn) => {
    try {
      await fn()
    } catch (e) {
      data.failures.push({ step: label, error: String(e).split('\n')[0].slice(0, 240) })
      // Was der Spieler an dieser Stelle sieht, ist selbst ein Befund.
      if (!String(e).includes('PERF_ONLY')) await shot(`${label}-nicht-erreichbar`).catch(() => {})
      await page.keyboard.press('Escape').catch(() => {})
    }
  }
  const btn = (name, exact = true) => page.getByRole('button', { name, exact }).first()
  const speed = async (label) => btn(label).click({ timeout: 5000 })
  const provincePicker = () => page.locator('aside select').first()
  /**
   * Das Provinzpanel wieder oeffnen, nachdem Escape es geschlossen hat: dieselbe Auswahl loest kein
   * `change` aus, also erst eine andere, dann wieder `Mittlerer Westen`.
   */
  const reselectProvince = async () => {
    const other = await provincePicker().evaluate((el) => [...el.options].find((o) => o.value && o.textContent?.trim() !== 'Mittlerer Westen')?.value ?? null)
    if (other) await provincePicker().selectOption(other, { timeout: 5000 })
    await provincePicker().selectOption({ label: 'Mittlerer Westen' }, { timeout: 5000 })
    await page.waitForTimeout(300)
  }
  const runUntil = async (predicate, arg, timeout = 60000) => {
    await speed('100')
    try {
      await page.waitForFunction(predicate, arg, { timeout })
    } finally {
      await speed('Pause').catch(() => {})
    }
  }

  // --- 1. Laden bis bedienbar -------------------------------------------------------
  const t0 = Date.now()
  await page.goto(run.url, { waitUntil: 'load' })
  await page.getByRole('button', { name: 'Partie beginnen' }).waitFor({ state: 'attached', timeout: 30000 })
  const readyWall = Date.now() - t0
  data.perf.load = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0]
    const paint = Object.fromEntries(performance.getEntriesByType('paint').map((p) => [p.name, Math.round(p.startTime)]))
    return {
      domInteractiveMs: Math.round(nav.domInteractive),
      domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd),
      loadEventMs: Math.round(nav.loadEventEnd),
      transferKB: Math.round(performance.getEntriesByType('resource').reduce((s, r) => s + (r.transferSize || 0), 0) / 1024),
      resources: performance.getEntriesByType('resource').length,
      ...paint,
    }
  })
  data.perf.load.startDialogInteractiveMs = readyWall
  data.perf.load.note = 'Dev-Server (vite, unbuendelt) — fuer den Vergleich vorher/nachher, nicht als absolute Zusage.'

  await shot('start-neue-partie')
  data.touch.startDialog = await touchTargets(page)
  await axe(page, 'startDialog', data.axe)
  data.keyboard.startDialog = await keyboardWalk(page, 15)
  await step('partie-anlegen-unten', async () => {
    await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent?.trim() === 'Partie beginnen')?.scrollIntoView({ block: 'end' }))
    await page.waitForTimeout(200)
    await shot('partie-anlegen-startknopf')
    await page.evaluate(() => document.querySelector('.dialog')?.scrollTo(0, 0))
    data.notes.push({
      startButtonInFirstView: await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.trim() === 'Partie beginnen')
        const d = document.querySelector('.dialog')
        if (!b) return null
        const bottom = Math.min(innerHeight, d ? d.getBoundingClientRect().bottom : innerHeight)
        return b.getBoundingClientRect().bottom <= bottom
      }),
    })
  })
  await step('spielstaende-vor-partie', async () => {
    await btn('Spielstände').click({ timeout: 5000 })
    await page.waitForTimeout(300)
    await shot('spielstaende-leer')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
    if (!(await page.getByRole('button', { name: 'Partie beginnen' }).isVisible().catch(() => false))) {
      await btn('Neue Partie').click({ timeout: 3000 }).catch(() => {})
    }
  })

  // --- 2. Partie beginnen -----------------------------------------------------------
  const tStart = Date.now()
  await page.getByRole('button', { name: 'Partie beginnen' }).click()
  await btn('Pause').waitFor({ timeout: 30000 })
  await page.waitForTimeout(500)
  data.perf.startGameMs = Date.now() - tStart
  await shot('karte-start-tutorial')
  // R-UX-05/AK2: im Hochformat ein nicht blockierender Hinweis „quer halten empfohlen“.
  if (vp.height > vp.width) {
    data.probes.orientationHint = await page.evaluate(() => /quer halten/i.test(document.body.innerText))
  }
  await axe(page, 'mapStart', data.axe)
  data.touch.mapStart = await touchTargets(page)
  data.layout = { mapStart: await layout(page) }
  data.keyboard.mapStart = await keyboardWalk(page, 40)
  await step('tutorial-schliessen', async () => {
    await btn('Nicht mehr zeigen').click({ timeout: 5000 })
    await page.waitForTimeout(300)
    await shot('kartenansicht')
  })
  await step('kopfleiste', async () => {
    const header = page.locator('header').first()
    const box = await header.boundingBox()
    data.notes.push({ headerHeightPx: box ? Math.round(box.height) : null })
    if (box) await shot('kopfleiste-hud', { clip: { x: 0, y: 0, width: vp.width, height: Math.min(vp.height, Math.ceil(box.height + 40)) } })
  })

  // --- 3. Zoom und Schieben ---------------------------------------------------------
  await step('karte-zoom', async () => {
    const map = page.locator('.map-layer--overlay').first()
    const b = await map.boundingBox()
    if (!b) throw new Error('Karte ohne Flaeche')
    const cx = b.x + b.width / 2
    const cy = b.y + b.height / 2
    data.perf.zoom = await longTasksDuring(page, async () => {
      await page.mouse.move(cx, cy)
      for (let i = 0; i < 8; i++) {
        await page.mouse.wheel(0, -240)
        await page.waitForTimeout(60)
      }
    })
    await shot('karte-gezoomt')
    data.perf.pan = await longTasksDuring(page, async () => {
      await page.mouse.move(cx, cy)
      await page.mouse.down()
      for (let i = 0; i < 20; i++) await page.mouse.move(cx - i * 12, cy - i * 6, { steps: 2 })
      await page.mouse.up()
    })
    for (let i = 0; i < 8; i++) await page.mouse.wheel(0, 240)
    await btn('Hauptstadt zentrieren').click({ timeout: 3000 }).catch(() => {})
    await page.waitForTimeout(300)
  })
  await step('kartenmodus-rohstoffe', async () => {
    await btn('Rohstoffe').click({ timeout: 5000 })
    await page.waitForTimeout(400)
    await shot('kartenmodus-rohstoffe')
    await btn('Besitz').click({ timeout: 5000 })
  })

  // --- 4. Provinz, Bau, Erklaerung --------------------------------------------------
  await step('provinz-auswahl', async () => {
    await provincePicker().selectOption({ label: 'Mittlerer Westen' }, { timeout: 5000 })
    await page.waitForTimeout(400)
    await shot('provinz-auswahl')
    data.layout.provincePanel = await layout(page)
    await axe(page, 'provincePanel', data.axe)
    data.touch.provincePanel = await touchTargets(page)
  })
  await step('probe-tooltip', async () => {
    // R-UX-02/AK3: Zeiger weg von der Karte, Provinz gewaehlt — und dann ein Dialog dazu.
    try {
      await page.mouse.move(4, vp.height - 4)
      await page.waitForTimeout(250)
      const afterSelection = await tooltipState(page)
      await btn('Menü').click({ timeout: 3000 })
      await page.waitForTimeout(250)
      const withDialog = await tooltipState(page)
      await page.keyboard.press('Escape')
      await page.waitForTimeout(200)
      // Escape schliesst heute mit dem Menue auch das Provinzpanel (App.tsx, Fall `close`): wiederherstellen.
      if (!(await btn('Kaserne bauen').isVisible().catch(() => false))) await reselectProvince()
      data.probes.tooltip = {
        afterSelection,
        visibleWithDialog: withDialog.visible,
        text: afterSelection.text,
        mentionsMouse: /Klick|Maus/i.test(afterSelection.text),
      }
    } catch (e) {
      data.probes.tooltip = null
      data.notes.push({ tooltipProbeError: String(e).split('\n')[0].slice(0, 160) })
    }
  })
  await step('erklaerung', async () => {
    await btn('Was ist Kaserne?').click({ timeout: 5000 })
    await page.waitForTimeout(300)
    await shot('hinweis-erklaerung')
    // R-UX-05/AK3: Escape schliesst die Erklaerung. Escape schliesst heute auch das Panel
    // (App.tsx, Fall `close`), deshalb waehlt die Probe danach die Provinz neu.
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
    const expanded = await btn('Was ist Kaserne?').getAttribute('aria-expanded', { timeout: 1500 }).catch(() => null)
    data.probes.explain = { closedByEscape: expanded !== 'true' }
    if (expanded === 'true') await btn('Was ist Kaserne?').click({ timeout: 5000 })
    if (!(await btn('Kaserne bauen').isVisible().catch(() => false))) await reselectProvince()
  })
  await step('bau-befehlen', async () => {
    await btn('Kaserne bauen').click({ timeout: 5000 })
    await page.waitForTimeout(300)
    await shot('rueckmeldung-bau-befohlen')
  })
  await step('tempo-laeuft', async () => {
    await speed('100')
    await page.waitForTimeout(400)
    await shot('tempo-100-laeuft')
    data.perf.running100 = await longTasksDuring(page, () => page.waitForTimeout(3000))
    // Falle 18: die Messung gilt nur auf ruhiger Maschine; die Last steht neben dem Wert, damit man sie sieht.
    data.perf.machine = { loadAvg1: +loadavg()[0].toFixed(2), cores: cpus().length }
    data.layout.running = await layout(page)
    if (run.perfOnly) {
      await speed('Pause')
      throw new Error('PERF_ONLY')
    }
    await page.getByRole('button', { name: 'Infanterie ausheben', exact: true }).and(page.locator(':enabled')).waitFor({ timeout: 60000 })
    await speed('Pause')
  })
  if (run.perfOnly) {
    data.failures = data.failures.filter((f) => !f.error.includes('PERF_ONLY'))
    data.consoleErrors = errors.slice(0, 20)
    await context.close()
    return data
  }
  await step('ausheben', async () => {
    let clicked = 0
    for (let i = 0; i < 3; i++) {
      const ok = await page.getByRole('button', { name: 'Infanterie ausheben', exact: true }).click({ timeout: 3000 }).then(() => true, () => false)
      if (ok) clicked += 1
      await page.waitForTimeout(150)
    }
    data.notes.push({ recruitClicks: clicked })
    if (clicked === 0) throw new Error('Infanterie ausheben nicht klickbar')
    await runUntil(() => [...document.querySelectorAll('aside button')].some((b) => b.textContent?.trim() === 'Auswählen'), null)
    await page.waitForTimeout(300)
    await shot('pause-armee-ausgehoben')
  })

  // --- 5. Armee und Marsch ----------------------------------------------------------
  await step('armee-auswahl', async () => {
    await btn('Auswählen').click({ timeout: 5000 })
    await page.waitForTimeout(300)
    await shot('armee-auswahl')
    data.layout.armyPanel = await layout(page)
    await axe(page, 'armyPanel', data.axe)
    data.touch.armyPanel = await touchTargets(page)
  })
  await step('beschuss-gesperrt', async () => {
    await btn('Beschießen').evaluate((el) => el.scrollIntoView({ block: 'center' }))
    await page.waitForTimeout(200)
    await shot('beschuss-gesperrt')
  })
  await step('marsch-zielwahl', async () => {
    // R-UX-04/AK2: das Oeffnen der Zielwahl darf keine lange Aufgabe erzeugen.
    data.perf.openMarch = await longTasksDuring(page, () => btn('Marschieren').click({ timeout: 5000 }))
    await page.waitForTimeout(300)
    await shot('marsch-zielwahl')
    data.notes.push({ marchTargetOptions: await page.locator('aside select').nth(1).locator('option').count() })
    data.probes.march = await page.evaluate((openMs) => {
      const select = document.querySelectorAll('aside select')[1]
      const groups = [...(select?.querySelectorAll('optgroup') ?? [])].map((g) => ({ label: g.label, options: g.children.length, disabled: [...g.children].filter((o) => o.disabled).length }))
      return { options: select?.querySelectorAll('option').length ?? 0, groups, openLongTaskMaxMs: openMs }
    }, data.perf.openMarch.longTaskMaxMs)
  })
  await step('fehler-ungueltiges-ziel', async () => {
    await page.locator('aside select').nth(1).selectOption({ label: 'Nordwestaustralien' }, { timeout: 5000 })
    await page.waitForTimeout(300)
    await shot('fehler-ungueltiges-ziel')
  })
  await step('marsch-befehlen', async () => {
    await page.locator('aside select').nth(1).selectOption({ label: 'Nordostmexiko' }, { timeout: 5000 })
    await page.waitForTimeout(300)
    await shot('marsch-ziel-gewaehlt')
    await btn('Marsch befehlen').click({ timeout: 5000 })
    await page.waitForTimeout(300)
    await shot('marsch-befohlen')
  })

  // --- 6. Diplomatie und Krieg ------------------------------------------------------
  await step('diplomatie', async () => {
    await btn('Diplomatie').click({ timeout: 5000 })
    await page.waitForTimeout(300)
    await shot('diplomatie')
    await axe(page, 'diplomacy', data.axe)
    await btn('Mexiko').click({ timeout: 5000 })
    await page.waitForTimeout(300)
    await btn('Krieg erklären').click({ timeout: 5000 })
    await page.waitForTimeout(300)
    await shot('krieg-erklaert-ohne-rueckfrage')
  })
  await step('kampf', async () => {
    await runUntil(() => /Gefecht (bei|entschieden)|: Gefecht entschieden/.test(document.querySelector('footer, .foot')?.textContent ?? document.body.innerText), null, 90000)
    await page.waitForTimeout(300)
    await page.getByText(/Gefecht (bei|entschieden)|: Gefecht entschieden/).first().click({ timeout: 3000 }).catch(() => {})
    await page.waitForTimeout(500)
    await shot('kampf-gefecht')
    data.layout.battle = await layout(page)
    await btn('Kämpfe').click({ timeout: 3000 }).catch(() => {})
    await page.waitForTimeout(200)
    await shot('protokoll-kaempfe')
    // R-UX-02/AK4: Zeitangabe einzeilig, Gefechtszeilen zusammengefasst, Platz 1 zuerst.
    data.probes.log = await page.evaluate(() => {
      const times = [...document.querySelectorAll('.log li time')]
      const wrapped = times.filter((el) => {
        const style = getComputedStyle(el)
        const line = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.4
        return el.getBoundingClientRect().height > line * 1.5
      }).length
      const texts = [...document.querySelectorAll('.log li .log__entry')].map((el) => (el.textContent ?? '').trim())
      let duplicates = 0
      for (let i = 1; i < texts.length; i++) if (texts[i] === texts[i - 1] && /Gefecht/.test(texts[i])) duplicates += 1
      const first = document.querySelector('.foot__rows li .foot__rank')?.textContent?.trim()
      return { entries: texts.length, timeWrapped: wrapped, duplicateBattleRuns: duplicates, standingsFirstIsRankOne: first === '1.' }
    })
    await btn('alles').click({ timeout: 3000 }).catch(() => {})
  })
  await step('meldungen', async () => {
    await btn('Depesche').click({ timeout: 5000 })
    await page.waitForTimeout(300)
    await shot('meldungen-depesche')
    await page.keyboard.press('Escape')
  })
  await step('panels', async () => {
    for (const [label, name] of [
      ['Markt', 'panel-markt'],
      ['Spionage', 'panel-spionage'],
      ['Rangliste / Sieg', 'panel-rangliste-sieg'],
    ]) {
      await page.getByRole('button', { name: label }).first().click({ timeout: 5000 })
      await page.waitForTimeout(300)
      await shot(name)
    }
  })
  await step('kartenmodus-beziehungen', async () => {
    await btn('Beziehungen').click({ timeout: 5000 })
    await page.waitForTimeout(300)
    await shot('kartenmodus-beziehungen')
    await btn('Besitz').click({ timeout: 5000 })
  })

  // --- 7. Menue, Einstellungen, Spielstaende ----------------------------------------
  await step('menue', async () => {
    await btn('Menü').click({ timeout: 5000 })
    await page.waitForTimeout(300)
    await shot('menue')
    await btn('Einstellungen').click({ timeout: 5000 })
    await page.waitForTimeout(300)
    await shot('einstellungen')
    await axe(page, 'settings', data.axe)
    data.keyboard.settings = await keyboardWalk(page, 12)
    await dialogProbe(page, data.dialogs, 'settings', 12)
    await page.keyboard.press('Escape')
  })
  await step('speichern', async () => {
    await btn('Spielstände').click({ timeout: 5000 })
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: 'Speichern' }).first().click({ timeout: 5000 })
    await page.waitForTimeout(600)
    await shot('spielstand-gespeichert')
    data.layout.saves = await layout(page)
    await axe(page, 'saves', data.axe)
  })
  await step('spielstand-praeparieren', async () => {
    // Ein echter Stand der Aufnahme, einmal als Sieg, einmal als Niederlage, einmal kaputt, in Platz 2, 4 und 3.
    // B-22: der Sieger bekommt den Besitz, den die Siegbedingung verlangt — `checkVictory` des Kerns
    // muss ihn selbst melden, bevor `victory.winner` gesetzt wird. Nichts davon aendert den Kern.
    const prepared = await page.evaluate(async ({ origin, root, grantSource }) => {
      const core = await import(/* @vite-ignore */ `${origin}/@fs${root}/packages/core/src/index.ts`)
      const json = async (name) => (await fetch(`${origin}/@fs${root}/data/rules/default/${name}.json`)).json()
      const rules = core.parseRules(
        { constants: await json('constants'), resources: await json('resources'), buildings: await json('buildings'), units: await json('units'), ai: await json('ai') },
        'default',
      )
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open('worldwar', 1)
        r.onsuccess = () => res(r.result)
        r.onerror = () => rej(r.error)
      })
      const get = (k) => new Promise((res) => { const q = db.transaction('saves').objectStore('saves').get(k); q.onsuccess = () => res(q.result) })
      const put = (k, v) => new Promise((res) => { const tx = db.transaction('saves', 'readwrite'); tx.objectStore('saves').put(v, k); tx.oncomplete = () => res(true) })
      const raw = await get('stand-1')
      if (!raw) return { error: 'kein stand-1' }
      const state = core.deserialise(raw)
      const human = Object.values(state.players).find((p) => p.kind === 'human') ?? Object.values(state.players)[0]
      const humanId = human.id
      const other = Object.keys(state.players).find((id) => id !== humanId)
      // Derselbe Text wie in `scripts/lib/ux-victory.mjs` (dort getestet); in der Seite per eval, weil sie in sich geschlossen ist.
      const grantUntilVictory = (0, eval)(`(${grantSource})`)
      const grant = (source, to) => grantUntilVictory(core, rules, source, to)
      const win = grant(state, humanId)
      win.next.victory.winner = humanId
      win.next.victory.condition = 'points'
      await put('stand-2', core.serialise(win.next))
      const lose = grant(state, other)
      lose.next.victory.winner = other
      lose.next.victory.condition = 'points'
      await put('stand-4', core.serialise(lose.next))
      await put('stand-3', JSON.stringify({ schemaVersion: state.schemaVersion, savedAtTick: state.tick, kaputt: true }))
      const brief = (r) => ({ real: r.real, moved: r.moved, share: r.share, goal: r.goal, condition: r.condition })
      return { ok: true, win: brief(win), lose: brief(lose) }
    }, { origin: new URL(run.url).origin, root: ROOT, grantSource: grantUntilVictory.toString() })
    data.notes.push({ preparedSaves: prepared.ok ? 'ok' : prepared.error })
    if (prepared.ok) {
      data.notes.push({ victoryState: prepared.win })
      data.notes.push({ defeatState: prepared.lose })
    }
    await page.keyboard.press('Escape')
  })
  // LOESCHVERMERK (Review): die Fassung von T-M44-01 setzte nur das Feld und liess den Besitz, wie er war
  // (Befund B-22: Kopfleiste „7 % von 70 %“ neben „Sie haben gewonnen“). Ersetzt durch `grant` oben:
  // const win = structuredClone(state)
  // win.victory.winner = humanId
  // win.victory.condition = win.victory.condition ?? 'points'
  // await put('stand-2', core.serialise(win))
  // const lose = structuredClone(state)
  // lose.victory.winner = other
  // await put('stand-4', core.serialise(lose))
  await step('fehler-spielstand-kaputt', async () => {
    await btn('Spielstände').click({ timeout: 5000 })
    await page.waitForTimeout(400)
    await page.getByRole('button', { name: 'Laden' }).nth(2).click({ timeout: 5000 })
    await page.waitForTimeout(500)
    await shot('fehler-spielstand-beschaedigt')
  })
  await step('laden-sieg', async () => {
    if (!(await page.getByRole('button', { name: 'Laden' }).first().isVisible().catch(() => false))) {
      await btn('Spielstände').click({ timeout: 5000 })
      await page.waitForTimeout(300)
    }
    await page.getByRole('button', { name: 'Laden' }).nth(1).click({ timeout: 5000 })
    await page.waitForTimeout(800)
    await shot('spielende-sieg')
    data.probes.endDialog = await endDialogText(page)
    await axe(page, 'victory', data.axe)
    data.keyboard.victory = await keyboardWalk(page, 8)
    data.notes.push({ victoryFocusLeavesDialog: data.keyboard.victory.order.some((o) => /Menü|Weltkarte/.test(o)) })
    await dialogProbe(page, data.dialogs, 'victory')
  })
  await step('laden-niederlage', async () => {
    // Neu laden: der Endedialog merkt sich das Quittieren je Sitzung.
    await page.reload({ waitUntil: 'load' })
    await btn('Spielstände').click({ timeout: 10000 })
    await page.waitForTimeout(400)
    await page.getByRole('button', { name: 'Laden' }).nth(3).click({ timeout: 5000 })
    await page.waitForTimeout(800)
    await shot('spielende-niederlage')
    data.probes.endDialogDefeat = await endDialogText(page)
  })

  data.consoleErrors = errors.slice(0, 20)
  await context.close()
  return data
}

// ---------------------------------------------------------------------------------------
// Mehrspieler (T-M44-02, R-UX-02/AK1, R-UX-06/AK2, Befund B-24)
// ---------------------------------------------------------------------------------------

/**
 * Gastgeber und Gast in zwei Fenstern desselben Rechners: Anlegen, Link, Beitritt, Lobby, Start,
 * Kopfleiste mit fester Rate, und zuletzt der gesperrte Vorhang — dazu verfaelscht der Gast ab
 * einem Tick den Hash seiner Befehlsnachrichten (nur auf der Leitung, im Browser des Gastes;
 * `packages/netplay` bleibt, wie es ist), und der Gastgeber meldet das Auseinanderlaufen.
 */
async function runMultiplayerViewport(browser, vp, party) {
  const data = { steps: [], failures: [], axe: {}, touch: {}, keyboard: {}, perf: {}, notes: [], probes: {}, dialogs: {}, layout: {} }
  const errors = []
  const hostContext = await browser.newContext(contextOptions(vp))
  const guestContext = await browser.newContext(contextOptions(vp))
  const host = await hostContext.newPage()
  const guest = await guestContext.newPage()
  for (const [who, page] of [['host', host], ['gast', guest]]) {
    page.on('pageerror', (e) => errors.push(`${who}: ${String(e).slice(0, 200)}`))
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`${who}: ${m.text().slice(0, 200)}`)
    })
  }
  const shot = async (page, name) => {
    const file = `mp-${name}-${vp.tag}.png`
    if (SHOTS && !MEASURE_ONLY.includes(vp.tag)) await page.screenshot({ path: join(OUT, file), fullPage: false })
    data.steps.push(file)
  }
  const step = async (label, page, fn) => {
    try {
      await fn()
    } catch (e) {
      data.failures.push({ step: `mp-${label}`, error: String(e).split('\n')[0].slice(0, 240) })
      await shot(page, `${label}-nicht-erreichbar`).catch(() => {})
    }
  }
  const btn = (page, name) => page.getByRole('button', { name, exact: true }).first()

  // Der Gast haelt ab dem Zeichen `tamper` seine Hashes zurueck (verfaelscht sie).
  let tamper = false
  await guest.routeWebSocket(/.*/, (ws) => {
    const server = ws.connectToServer()
    ws.onMessage((message) => {
      if (tamper && typeof message === 'string') {
        try {
          const parsed = JSON.parse(message)
          if (parsed.kind === 'befehle') {
            parsed.hash = 'ux-capture-verfaelscht'
            server.send(JSON.stringify(parsed))
            return
          }
        } catch {
          /* kein JSON: unveraendert weiter */
        }
      }
      server.send(message)
    })
    server.onMessage((message) => ws.send(message))
    ws.onClose((code, reason) => server.close({ code, reason }))
    server.onClose((code, reason) => ws.close({ code, reason }))
  })

  let guestLink = ''
  await step('gastgeber-anlegen', host, async () => {
    const t0 = Date.now()
    await host.goto(party.hostLink, { waitUntil: 'load' })
    await host.getByRole('button', { name: 'Partie beginnen' }).waitFor({ state: 'attached', timeout: 30000 })
    data.perf.hostReadyMs = Date.now() - t0
    await shot(host, 'gastgeber-anlegen')
    data.touch.hostNewGame = await touchTargets(host)
    await axe(host, 'hostNewGame', data.axe)
    const mode = host.locator('.dialog select').first()
    const selected = await mode.evaluate((el) => el.options[el.selectedIndex]?.textContent ?? '').catch(() => '')
    data.notes.push({ hostModeSelected: selected })
    await host.getByRole('button', { name: 'Partie beginnen' }).click()
  })
  await step('lobby', host, async () => {
    const field = host.locator('.dialog input[readonly]')
    await field.waitFor({ timeout: 30000 })
    guestLink = await field.inputValue()
    await shot(host, 'lobby-gastgeber')
    data.layout.lobby = await layout(host)
    data.touch.lobby = await touchTargets(host)
    await axe(host, 'lobby', data.axe)
    data.keyboard.lobby = await keyboardWalk(host, 10)
    await dialogProbe(host, data.dialogs, 'lobby', 10, { escape: false })
  })
  await step('gast-beitritt', guest, async () => {
    if (!guestLink) throw new Error('kein Gastlink aus der Lobby')
    // Der Gastlink traegt `localhost`/die Adresse des Gastgebers; im Test ist es derselbe Rechner.
    await guest.goto(guestLink, { waitUntil: 'load' })
    await guest.locator('.dialog input[type=text]').waitFor({ timeout: 30000 })
    await shot(guest, 'gast-bedingungen')
    data.probes.joinTerms = (await guest.locator('.dialog').first().textContent())?.trim().replace(/\s+/g, ' ').slice(0, 400)
    data.layout.join = await layout(guest)
    data.touch.join = await touchTargets(guest)
    await axe(guest, 'join', data.axe)
    data.keyboard.join = await keyboardWalk(guest, 10)
    await dialogProbe(guest, data.dialogs, 'join', 10, { escape: false })
    await guest.locator('.dialog input[type=text]').fill('Gast')
    await shot(guest, 'gast-name')
    await btn(guest, 'Beitreten').click({ timeout: 5000 })
  })
  await step('start', host, async () => {
    const begin = btn(host, 'Partie starten')
    await host.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent?.trim() === 'Partie starten' && !b.disabled), null, { timeout: 30000 })
    await shot(host, 'lobby-gast-da')
    await begin.click()
    await host.locator('.clock__fixed').waitFor({ timeout: 60000 })
    await host.waitForTimeout(500)
  })
  await step('kopfleiste-feste-rate', host, async () => {
    await btn(host, 'Nicht mehr zeigen').click({ timeout: 3000 }).catch(() => {})
    // Auf das Siegziel warten: es steht ab Tag 2 in der Kopfleiste (UX-PLAN B-02).
    await host.locator('header .meter').waitFor({ timeout: 90000 })
    await host.waitForTimeout(500)
    data.probes.fixedSpeed = await host.locator('.clock__fixed').isVisible()
    data.layout.mpRunning = await layout(host)
    await shot(host, 'kopfleiste-feste-rate')
    data.touch.mpRunning = await touchTargets(host)
    await axe(host, 'mpRunning', data.axe)
    data.keyboard.mpRunning = await keyboardWalk(host, 30)
    data.perf.mpRunning = await longTasksDuring(host, () => host.waitForTimeout(3000))
  })
  await step('vorhang', host, async () => {
    tamper = true
    await host.locator('.dialog-backdrop--locked').waitFor({ timeout: 60000 })
    await host.waitForTimeout(400)
    await shot(host, 'vorhang-gesperrt')
    data.layout.curtain = await layout(host)
    data.touch.curtain = await touchTargets(host)
    await axe(host, 'curtain', data.axe)
    const walk = await keyboardWalk(host, 10)
    data.keyboard.curtain = walk
    await host.keyboard.press('Escape')
    await host.waitForTimeout(250)
    const stillThere = await host.locator('.dialog-backdrop--locked').isVisible().catch(() => false)
    data.dialogs.curtain = { present: true, steps: 10, focusLeaves: walk.outsideDialog > 0, outside: walk.outsideDialog, closable: false, closedByEscape: !stillThere, locked: stillThere }
  })

  data.consoleErrors = errors.slice(0, 20)
  await hostContext.close()
  await guestContext.close()
  return data
}

// ---------------------------------------------------------------------------------------
// Server und Bau (nur Werkzeug; alles Gestartete wird am Ende beendet)
// ---------------------------------------------------------------------------------------

const cleanups = []
async function runCleanups() {
  while (cleanups.length > 0) {
    try {
      await cleanups.pop()()
    } catch {
      /* ein Aufraeumschritt darf den naechsten nicht verhindern */
    }
  }
}
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    void runCleanups().then(() => process.exit(130))
  })
}

const viteBin = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js')

async function reachable(url, ms = 1500) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(ms) })
    return r.ok
  } catch {
    return false
  }
}

/** vite im Worktree starten (eigener Port, WORKFLOW Falle 9) und auf die Adresse warten. */
async function startVite(mode, port) {
  const args = mode === 'preview' ? [viteBin, 'preview', '--port', String(port), '--strictPort'] : [viteBin, '--port', String(port), '--strictPort']
  const child = spawn(process.execPath, args, { cwd: join(ROOT, 'apps/desktop'), stdio: 'ignore', detached: process.platform !== 'win32' })
  cleanups.push(async () => {
    if (child.exitCode !== null) return
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'])
    else {
      try {
        process.kill(-child.pid, 'SIGTERM')
      } catch {
        child.kill('SIGTERM')
      }
    }
  })
  const url = `http://localhost:${port}/`
  for (let i = 0; i < 60; i++) {
    if (await reachable(url)) return url
    if (child.exitCode !== null) throw new Error(`vite ${mode} endete sofort (Status ${child.exitCode}); belegt der Port ${port}?`)
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`vite ${mode} antwortet nicht auf ${url}`)
}

function build(outDir, env = {}) {
  const r = spawnSync(process.execPath, [viteBin, 'build', '--outDir', outDir], {
    cwd: join(ROOT, 'apps/desktop'),
    env: { ...process.env, ...env },
    stdio: 'inherit',
  })
  if (r.status !== 0) throw new Error(`vite build ${outDir} fehlgeschlagen (Status ${r.status})`)
}

// ---------------------------------------------------------------------------------------
// Ablauf
// ---------------------------------------------------------------------------------------

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function report(measured) {
  const baselinePath = resolve(arg('baseline', join(ROOT, 'docs/ux/before/messwerte.json')))
  const bundlePath = arg('baseline-bundle', '')
  const ctx = {
    only: ONLY,
    baseline: existsSync(baselinePath) ? readJson(baselinePath) : null,
    sameDayBundle: bundlePath && existsSync(resolve(bundlePath)) ? readJson(resolve(bundlePath)) : null,
  }
  const results = evaluate(measured, ctx)
  console.log('')
  console.log(render(results))
  return exitCodeFor(results, { strict: flag('strict') })
}

async function main() {
  if (flag('from')) {
    // Nur auswerten: kein Browser, kein Server.
    process.exitCode = report(readJson(resolve(arg('from', ''))))
    return
  }

  const needs = sectionsNeeded(ONLY)
  const wantBundle = flag('bundle') || (CHECK && needs.has('bundle'))
  const wantMp = flag('mp') || (CHECK && needs.has('mp'))
  const wantViewports = CHECK ? needs.has('viewports') : !(flag('bundle') || flag('mp'))
  const file = join(OUT, 'messwerte.json')
  const target = MERGE && existsSync(file) ? readJson(file) : result
  if (target !== result) target.updatedAt = result.createdAt
  const browser = await chromium.launch(launchOptions())
  cleanups.push(() => browser.close())

  try {
    if (wantViewports) {
      let url = BASE_URL
      if (!(await reachable(url))) {
        if (!CHECK && !flag('serve')) throw new Error(`${url} antwortet nicht. Erst \`pnpm dev --port 5321 --strictPort\` starten (oder --serve).`)
        url = await startVite('dev', Number(new URL(BASE_URL).port || 5321))
        console.log(`Dev-Server gestartet: ${url}`)
      }
      target[SECTION] = target[SECTION] ?? {}
      for (const vp of VIEWPORTS) {
        const started = Date.now()
        process.stdout.write(`${vp.tag} ... `)
        const data = await runViewport(browser, vp, { url, perfOnly: PERF_ONLY })
        data.durationMs = Date.now() - started
        data.url = url
        target[SECTION][vp.tag] = data
        console.log(`${data.steps.length} Bilder, ${data.failures.length} Fehlschritte`)
      }
    }

    if (wantBundle) {
      // Falle 18: die Uhr wird am gebauten Buendel gemessen. Gebaut wird ohne Mehrspielerflagge,
      // wie das ausgelieferte Programm.
      if (!flag('no-build')) {
        console.log('Baue das Buendel (vite build) ...')
        build('dist', { WORLDWAR_MULTIPLAYER: '' })
      }
      const url = await startVite('preview', PREVIEW_PORT)
      console.log(`vite preview: ${url}`)
      const sizes = parseViewports(arg('bundle-viewports', '1920x1080'))
      target.bundle = target.bundle ?? {}
      for (const vp of sizes) {
        const started = Date.now()
        process.stdout.write(`Buendel ${vp.tag} ... `)
        const data = await runViewport(browser, vp, { url, perfOnly: true })
        data.durationMs = Date.now() - started
        data.url = url
        target.bundle[vp.tag] = data
        console.log(`Tempo 100: ${data.perf.running100 ? `${data.perf.running100.longTasks} lange Aufgaben, ${data.perf.running100.framesOver50Ms} Bilder > 50 ms` : 'nicht erreichbar'}`)
      }
    }

    if (wantMp) {
      if (!flag('no-build')) {
        console.log('Baue das Buendel mit Mehrspielerflagge (WORLDWAR_MULTIPLAYER=1) nach dist-mp ...')
        build('dist-mp', { WORLDWAR_MULTIPLAYER: '1' })
      }
      const serverUrl = pathToFileURL(join(ROOT, 'apps/party/src/server.ts')).href
      const roomUrl = pathToFileURL(join(ROOT, 'apps/party/src/room.ts')).href
      const { createPartyServer } = await import(serverUrl)
      const { createRoomId, createSecret } = await import(roomUrl)
      // Je Groesse ein eigener Raum: der vorige ist besetzt oder auseinandergelaufen.
      const rooms = MP_VIEWPORTS.map(() => ({ id: createRoomId(), secret: createSecret() }))
      const service = createPartyServer({ root: join(ROOT, 'apps/desktop/dist-mp'), port: 0, host: '127.0.0.1', rooms })
      const port = await service.listen()
      cleanups.push(() => service.close())
      target.mp = target.mp ?? {}
      for (const [i, vp] of MP_VIEWPORTS.entries()) {
        const started = Date.now()
        process.stdout.write(`mp ${vp.tag} ... `)
        const room = rooms[i]
        const party = { hostLink: `http://127.0.0.1:${port}/#/gastgeben?raum=${encodeURIComponent(room.id)}&s=${encodeURIComponent(room.secret)}` }
        const data = await runMultiplayerViewport(browser, vp, party)
        data.durationMs = Date.now() - started
        target.mp[vp.tag] = data
        console.log(`${data.steps.length} Bilder, ${data.failures.length} Fehlschritte`)
      }
    }
  } finally {
    // Die Messwerte bleiben auch bei einem Abbruch mitten im Lauf erhalten.
    writeFileSync(file, JSON.stringify(target, null, 2) + '\n')
    console.log(`messwerte.json -> ${OUT}`)
    await runCleanups()
  }

  if (CHECK) process.exitCode = report(target)
}

await main()

// LOESCHVERMERK (Review): die Fassung von T-M44-01 endete mit dem folgenden Block (eine Schleife ueber
// die Fenstergroessen, ohne Pruefmodus, Buendel- und Mehrspielerlauf); ersetzt durch `main()` oben:
//   const browser = await chromium.launch(launchOptions())
//   const file = join(OUT, 'messwerte.json')
//   const target = MERGE && existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : result
//   target[SECTION] = target[SECTION] ?? {}
//   if (target !== result) target.updatedAt = result.createdAt
//   for (const vp of VIEWPORTS) {
//     const started = Date.now()
//     process.stdout.write(`${vp.tag} ... `)
//     const data = await runViewport(browser, vp)
//     data.durationMs = Date.now() - started
//     data.url = BASE_URL
//     target[SECTION][vp.tag] = data
//     console.log(`${data.steps.length} Bilder, ${data.failures.length} Fehlschritte`)
//   }
//   await browser.close()
//   writeFileSync(file, JSON.stringify(target, null, 2) + '\n')
//   console.log(`messwerte.json -> ${OUT}`)
