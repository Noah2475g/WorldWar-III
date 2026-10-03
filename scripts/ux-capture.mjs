#!/usr/bin/env node
/**
 * UX-Aufnahme: Bildschirmfotos und Messwerte der zentralen Ansichten (UX-PLAN, T-M44-01).
 *
 * Faehrt das laufende Spiel mit Playwright durch — Start, Partie anlegen, Karte, Provinz,
 * Armee, Marsch, Tempo, Gefecht, Diplomatie, Meldungen, Fehler, Spielstaende, Spielende —
 * in drei Fenstergroessen und schreibt PNGs plus `messwerte.json` in einen Zielordner.
 * Phase 6 des UX-Plans faehrt dasselbe Skript mit `--out docs/ux/after`.
 *
 *   pnpm dev --port 5321 --strictPort        # in einem zweiten Terminal
 *   node scripts/ux-capture.mjs --out docs/ux/before [--url http://localhost:5321/]
 *                               [--viewports 375x667,1280x800,1920x1080] [--no-shots]
 *
 * Spiellogik wird nicht angefasst. Das Spielende entsteht aus einem echten Spielstand der
 * Aufnahme, dessen Feld `victory.winner` gesetzt und mit dem `serialise` des Kerns neu
 * versiegelt wird — derselbe Weg, den ein Laden nimmt.
 *
 * Browser: das vorinstallierte Chromium (PLAYWRIGHT_BROWSERS_PATH, sonst /opt/pw-browsers);
 * nie `playwright install`. Keine Benchmark-Messung: die Ruckler-Zahlen sind grob und haengen
 * an der Maschinenlast — sie dienen dem Vorher/Nachher auf derselben Maschine.
 */
// Die Funktionen in page.evaluate laufen im Browser; ihre Namen kennt ESLint unter Node nicht.
/* global document, window, getComputedStyle, innerWidth, innerHeight, HTMLElement, PerformanceObserver, performance, requestAnimationFrame, indexedDB, structuredClone */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import AxeBuilderModule from '@axe-core/playwright'

const AxeBuilder = AxeBuilderModule.default ?? AxeBuilderModule

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const OUT = resolve(arg('out', 'docs/ux/before'))
const BASE_URL = arg('url', 'http://localhost:5321/')
const VIEWPORTS = arg('viewports', '375x667,1280x800,1920x1080')
  .split(',')
  .map((v) => {
    const [w, h] = v.split('x').map(Number)
    return { width: w, height: h, tag: `${w}x${h}` }
  })
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SHOTS = !process.argv.includes('--no-shots')

function findChromium() {
  if (process.env.UX_CHROMIUM) return process.env.UX_CHROMIUM
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers'
  if (!existsSync(root)) return undefined
  const dir = readdirSync(root).find((d) => /^chromium-\d+$/.test(d))
  const exe = dir ? join(root, dir, 'chrome-linux', 'chrome') : undefined
  return exe && existsSync(exe) ? exe : undefined
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
      rows.push({ label, w: Math.round(r.width), h: Math.round(r.height) })
    }
    const small = rows.filter((r) => r.w < 44 || r.h < 44)
    const tiny = rows.filter((r) => r.w < 24 || r.h < 24)
    return { total: rows.length, under44: small.length, under24: tiny.length, share: rows.length ? +(small.length / rows.length).toFixed(3) : 0, samples: small.slice(0, 25) }
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
    return {
      viewport: { w: innerWidth, h: innerHeight },
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

async function runViewport(browser, vp) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    hasTouch: vp.width < 600,
    isMobile: vp.width < 600,
    locale: 'de-DE',
  })
  const page = await context.newPage()
  const data = { steps: [], failures: [], axe: {}, touch: {}, keyboard: {}, perf: {}, notes: [] }
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 200))
  })
  const shot = async (name, opts = {}) => {
    const index = SCENES.indexOf(name)
    const prefix = index >= 0 ? String(index + 1).padStart(2, '0') : 'x'
    const file = `${prefix}-${name}-${vp.tag}.png`
    if (SHOTS) await page.screenshot({ path: join(OUT, file), fullPage: false, ...opts })
    data.steps.push(file)
    return file
  }
  const step = async (label, fn) => {
    try {
      await fn()
    } catch (e) {
      data.failures.push({ step: label, error: String(e).split('\n')[0].slice(0, 240) })
      // Was der Spieler an dieser Stelle sieht, ist selbst ein Befund.
      await shot(`${label}-nicht-erreichbar`).catch(() => {})
      await page.keyboard.press('Escape').catch(() => {})
    }
  }
  const btn = (name, exact = true) => page.getByRole('button', { name, exact }).first()
  const speed = async (label) => btn(label).click({ timeout: 5000 })
  const provincePicker = () => page.locator('aside select').first()
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
  await page.goto(BASE_URL, { waitUntil: 'load' })
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
    await axe(page, 'provincePanel', data.axe)
    data.touch.provincePanel = await touchTargets(page)
  })
  await step('erklaerung', async () => {
    await btn('Was ist Kaserne?').click({ timeout: 5000 })
    await page.waitForTimeout(300)
    await shot('hinweis-erklaerung')
    await btn('Was ist Kaserne?').click({ timeout: 5000 })
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
    data.layout.running = await layout(page)
    await page.getByRole('button', { name: 'Infanterie ausheben', exact: true }).and(page.locator(':enabled')).waitFor({ timeout: 60000 })
    await speed('Pause')
  })
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
    await axe(page, 'armyPanel', data.axe)
    data.touch.armyPanel = await touchTargets(page)
  })
  await step('beschuss-gesperrt', async () => {
    await btn('Beschießen').evaluate((el) => el.scrollIntoView({ block: 'center' }))
    await page.waitForTimeout(200)
    await shot('beschuss-gesperrt')
  })
  await step('marsch-zielwahl', async () => {
    await btn('Marschieren').click({ timeout: 5000 })
    await page.waitForTimeout(300)
    await shot('marsch-zielwahl')
    data.notes.push({ marchTargetOptions: await page.locator('aside select').nth(1).locator('option').count() })
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
    // Ein echter Stand der Aufnahme, einmal als Sieg und einmal kaputt, in Platz 2 und 3.
    const ok = await page.evaluate(async ({ origin, root }) => {
      const core = await import(/* @vite-ignore */ `${origin}/@fs${root}/packages/core/src/index.ts`)
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open('worldwar', 1)
        r.onsuccess = () => res(r.result)
        r.onerror = () => rej(r.error)
      })
      const get = (k) => new Promise((res) => { const q = db.transaction('saves').objectStore('saves').get(k); q.onsuccess = () => res(q.result) })
      const put = (k, v) => new Promise((res) => { const tx = db.transaction('saves', 'readwrite'); tx.objectStore('saves').put(v, k); tx.oncomplete = () => res(true) })
      const raw = await get('stand-1')
      if (!raw) return 'kein stand-1'
      const state = core.deserialise(raw)
      const human = Object.values(state.players).find((p) => p.kind === 'human') ?? Object.values(state.players)[0]
      const humanId = human.id
      const other = Object.keys(state.players).find((id) => id !== humanId)
      const win = structuredClone(state)
      win.victory.winner = humanId
      win.victory.condition = win.victory.condition ?? 'points'
      await put('stand-2', core.serialise(win))
      const lose = structuredClone(state)
      lose.victory.winner = other
      await put('stand-4', core.serialise(lose))
      await put('stand-3', JSON.stringify({ schemaVersion: state.schemaVersion, savedAtTick: state.tick, kaputt: true }))
      return 'ok'
    }, { origin: new URL(BASE_URL).origin, root: ROOT })
    data.notes.push({ preparedSaves: ok })
    await page.keyboard.press('Escape')
  })
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
    await axe(page, 'victory', data.axe)
    data.keyboard.victory = await keyboardWalk(page, 8)
    data.notes.push({ victoryFocusLeavesDialog: data.keyboard.victory.order.some((o) => /Menü|Weltkarte/.test(o)) })
  })
  await step('laden-niederlage', async () => {
    // Neu laden: der Endedialog merkt sich das Quittieren je Sitzung.
    await page.reload({ waitUntil: 'load' })
    await btn('Spielstände').click({ timeout: 10000 })
    await page.waitForTimeout(400)
    await page.getByRole('button', { name: 'Laden' }).nth(3).click({ timeout: 5000 })
    await page.waitForTimeout(800)
    await shot('spielende-niederlage')
  })

  data.consoleErrors = errors.slice(0, 20)
  await context.close()
  return data
}

const executablePath = findChromium()
const browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}) })
for (const vp of VIEWPORTS) {
  const started = Date.now()
  process.stdout.write(`${vp.tag} ... `)
  result.viewports[vp.tag] = await runViewport(browser, vp)
  result.viewports[vp.tag].durationMs = Date.now() - started
  console.log(`${result.viewports[vp.tag].steps.length} Bilder, ${result.viewports[vp.tag].failures.length} Fehlschritte`)
}
await browser.close()
writeFileSync(join(OUT, 'messwerte.json'), JSON.stringify(result, null, 2) + '\n')
console.log(`messwerte.json -> ${OUT}`)
