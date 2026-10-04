#!/usr/bin/env node
/* global document, window, getComputedStyle, innerWidth, innerHeight, PerformanceObserver, performance, requestAnimationFrame, indexedDB, Image */
/**
 * UX-Aufnahme des Spaetspiels (PLAN-V3 P0-B1): faehrt die Staende S100/S300/S575 (test/fixtures/v3)
 * durch die Ansichten, die im Spielanfang nie vorkamen — Karte mit hunderten Armeen, volles
 * Protokoll, Diplomatie, Markt, Spionage, Rangliste, Speichern/Laden eines grossen Standes — und
 * misst dabei Layout, Ziele, Ueberlauf, axe und lange Aufgaben je Ansicht.
 *
 *   node scripts/ux-late.mjs --url http://localhost:5341/ [--out docs/ux/v3-before]
 *        [--states S100,S300,S575] [--viewports 375x667,1280x800] [--measure-only 1920x1080]
 *        [--full S300]   # Staende, die ALLE Ansichten als Bild bekommen; die anderen nur die Kernbilder
 *        [--merge]       # messwerte-spaet.json ergaenzen statt ersetzen
 *        [--contrast]    # nur die Pixelprobe der axe-„unvollstaendig“-Kontrastknoten auf der Karte
 *
 * Bilder nur in 375x667 und 1280x800 (Regel 12 der V3); 1920x1080 nur als Messwert. Schreibt
 * `messwerte-spaet.json` bzw. `kontrast-probe.json`. Keine Millisekunden als Beleg (Regel 5): die langen
 * Aufgaben sind grobe Zaehlwerte derselben Maschine. Der Spielcode bleibt unberuehrt.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve, dirname, basename } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import AxeBuilderModule from '@axe-core/playwright'

const AxeBuilder = AxeBuilderModule.default ?? AxeBuilderModule
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const flag = (name) => process.argv.includes(`--${name}`)
const parseViewports = (list) =>
  list
    .split(',')
    .filter(Boolean)
    .map((v) => {
      const [width, height] = v.split('x').map(Number)
      return { width, height, tag: `${width}x${height}` }
    })

const URL_ = arg('url', 'http://localhost:5341/')
const OUT = resolve(arg('out', 'docs/ux/v3-before'))
const STATES = arg('states', 'S100,S300,S575,S575G').split(',')
const FULL = arg('full', 'S575G').split(',')
const VIEWPORTS = parseViewports(arg('viewports', '375x667,1280x800'))
const MEASURE_ONLY = parseViewports(arg('measure-only', '1920x1080'))
const CONTRAST_ONLY = flag('contrast')
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
mkdirSync(OUT, { recursive: true })

/** `S575G` = derselbe Stand, aber der Mensch ist die staerkste Macht (Sicht eines Spielers mit grossem Reich). */
const baseName = (name) => name.replace(/G$/, '')
const readState = (rawName) => {
  const name = baseName(rawName)
  const dir = resolve(ROOT, 'test/fixtures/v3')
  const plain = join(dir, `${name}.json`)
  const p = existsSync(plain) ? plain : join(dir, `${name}.json.gz`)
  const raw = readFileSync(p)
  return p.endsWith('.gz') ? gunzipSync(raw).toString('utf8') : raw.toString('utf8')
}

const ROOTFS = (() => { const p = ROOT.split(String.fromCharCode(92)).join('/'); return p.startsWith('/') ? p : `/${p}` })()
const contextOptions = (vp) => ({
  viewport: { width: vp.width, height: vp.height },
  deviceScaleFactor: 1,
  hasTouch: Math.min(vp.width, vp.height) < 600,
  isMobile: Math.min(vp.width, vp.height) < 600,
  locale: 'de-DE',
})

async function touchTargets(page) {
  return page.evaluate(() => {
    const sel = 'button, a[href], input, select, textarea, summary, [role=button], [role=tab], [tabindex]:not([tabindex="-1"])'
    const rows = []
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect()
      const style = getComputedStyle(el)
      if (r.width === 0 || r.height === 0 || style.visibility === 'hidden' || style.display === 'none') continue
      if (r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) continue
      const label = (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 40)
      rows.push({ label, w: Math.round(r.width), h: Math.round(r.height) })
    }
    const small = rows.filter((r) => r.w < 44 || r.h < 44)
    const tiny = rows.filter((r) => r.w < 24 || r.h < 24)
    return { total: rows.length, under44: small.length, under24: tiny.length, samples: tiny.slice(0, 8) }
  })
}

async function layout(page) {
  return page.evaluate(() => {
    const box = (sel) => {
      const el = document.querySelector(sel)
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
    }
    const overflowing = [...document.querySelectorAll('.header__top, .speeds, .modes, .resources, .side, .foot, .dialog, .slots, .log')]
      .filter((el) => el.scrollWidth > el.clientWidth + 1)
      .map((el) => `${String(el.className).split(' ')[0]} ${el.scrollWidth}>${el.clientWidth}`)
    const map = box('.map-layer--overlay')
    const chip = document.querySelector('.alarm-chip')
    const dialog = document.querySelector('[role=dialog], .dialog')
    const dialogBox = dialog ? dialog.getBoundingClientRect() : null
    const share = map
      ? +((Math.max(0, Math.min(map.x + map.w, innerWidth) - Math.max(map.x, 0)) * Math.max(0, Math.min(map.y + map.h, innerHeight) - Math.max(map.y, 0))) / (innerWidth * innerHeight)).toFixed(3)
      : 0
    return {
      viewport: { w: innerWidth, h: innerHeight },
      pageOverflowX: document.documentElement.scrollWidth > innerWidth,
      header: box('header'),
      map,
      mapShare: share,
      side: box('.side'),
      sideScroll: (() => { const e = document.querySelector('.side'); return e ? { scrollH: e.scrollHeight, clientH: e.clientHeight, top: e.scrollTop } : null })(),
      foot: box('.foot'),
      overflowingRegions: overflowing,
      alarmChipVisible: Boolean(chip && chip.getBoundingClientRect().width > 0),
      dialog: dialogBox
        ? { h: Math.round(dialogBox.height), scrollH: dialog.scrollHeight, clientH: dialog.clientHeight, fits: dialogBox.bottom <= innerHeight + 1 && dialogBox.top >= -1 }
        : null,
      domNodes: document.getElementsByTagName('*').length,
      svgElements: document.querySelectorAll('svg *').length,
      canvases: document.querySelectorAll('canvas').length,
    }
  })
}

async function axe(page) {
  try {
    const r = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()
    return {
      violations: r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, sample: v.nodes[0]?.target.join(' ').slice(0, 80) })),
      incomplete: r.incomplete.map((v) => ({ id: v.id, nodes: v.nodes.length })),
    }
  } catch (e) {
    return { error: String(e).slice(0, 160) }
  }
}

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
      /* ohne longtask bleibt die Liste leer */
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
  return page.evaluate((w) => {
    window.__uxRaf = false
    const l = window.__uxLong
    const f = window.__uxFrames.slice(1)
    return { wallMs: w, longTasks: l.length, longTaskMaxMs: Math.round(Math.max(0, ...l)), frames: f.length, framesOver50Ms: f.filter((d) => d > 50).length }
  }, wall)
}

async function putState(page, text) {
  await page.evaluate(
    (t) =>
      new Promise((res, rej) => {
        const r = indexedDB.open('worldwar', 1)
        r.onupgradeneeded = () => {
          if (!r.result.objectStoreNames.contains('saves')) r.result.createObjectStore('saves')
        }
        r.onerror = () => rej(r.error)
        r.onsuccess = () => {
          const tx = r.result.transaction('saves', 'readwrite')
          tx.objectStore('saves').put(t, 'stand-1')
          tx.oncomplete = () => {
            r.result.close()
            res(true)
          }
          tx.onerror = () => rej(tx.error)
        }
      }),
    text,
  )
}

const CLOCK = 'Tag\\s+([\\d.]+)\\s+·\\s+(\\d\\d):00'

async function openState(page, name) {
  await page.goto(URL_, { waitUntil: 'load' })
  await page.getByRole('button', { name: 'Partie beginnen' }).waitFor({ state: 'attached', timeout: 30000 })
  await putState(page, name.endsWith('G') ? await strongestViewer(page, readState(name)) : readState(name))
  await page.getByRole('button', { name: 'Spielstände', exact: true }).first().click({ timeout: 10000 })
  await page.waitForTimeout(400)
  const t0 = Date.now()
  await page.getByRole('button', { name: 'Laden', exact: true }).first().click({ timeout: 10000 })
  await page.waitForFunction((src) => new RegExp(src).test(document.body.innerText), CLOCK, { timeout: 90000 })
  const ms = Date.now() - t0
  await page.waitForTimeout(800)
  return ms
}

/**
 * Derselbe Stand, aber der Mensch ist die Macht mit den meisten Provinzen: nur `kind` zweier Spieler wird getauscht
 * und der Stand mit dem `serialise` des Kerns neu versiegelt (Muster von ux-capture.mjs, Kern unveraendert).
 */
async function strongestViewer(page, text) {
  return page.evaluate(
    async ({ origin, root, raw }) => {
      const core = await import(/* @vite-ignore */ `${origin}/@fs${root}/packages/core/src/index.ts`)
      const state = core.deserialise(raw)
      const count = {}
      for (const id of state.provinceOrder) {
        const o = state.provinces[id].owner
        if (o) count[o] = (count[o] ?? 0) + 1
      }
      const top = Object.keys(count).sort((a, b) => count[b] - count[a])[0]
      for (const id of state.playerOrder) state.players[id].kind = id === top ? 'human' : 'ai'
      return core.serialise(state)
    },
    { origin: new URL(URL_).origin, root: ROOTFS, raw: text },
  )
}

/** Pixelprobe fuer axe-„unvollstaendig“: Vordergrund aus der Gestaltung, Hintergrund aus dem Bild ohne den Text. */
async function contrastProbe(page, label) {
  const result = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()
  const nodes = result.incomplete.filter((i) => i.id === 'color-contrast').flatMap((i) => i.nodes.map((n) => n.target[0]))
  const rows = []
  for (const target of nodes.slice(0, 40)) {
    const loc = page.locator(target).first()
    const info = await loc
      .evaluate((el) => {
        const r = el.getBoundingClientRect()
        const s = getComputedStyle(el)
        const x = Math.max(0, r.x)
        const y = Math.max(0, r.y)
        return {
          text: (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40),
          tag: el.tagName.toLowerCase(),
          cls: String(el.className?.baseVal ?? el.className).slice(0, 40),
          color: s.color,
          fill: s.fill,
          fontSize: parseFloat(s.fontSize),
          fontWeight: s.fontWeight,
          textShadow: s.textShadow,
          rect: { x, y, width: Math.min(r.width, innerWidth - x), height: Math.min(r.height, innerHeight - y) },
        }
      })
      .catch(() => null)
    if (!info || info.rect.width < 2 || info.rect.height < 2) {
      rows.push({ target, skipped: true })
      continue
    }
    // Text unsichtbar machen, Bild des Bereichs holen, wieder herstellen.
    await loc.evaluate((el) => {
      el.__oldStyle = el.getAttribute('style')
      el.style.setProperty('color', 'transparent', 'important')
      el.style.setProperty('fill', 'transparent', 'important')
      el.style.setProperty('stroke', 'transparent', 'important')
      el.style.setProperty('text-shadow', 'none', 'important')
    })
    const png = await page.screenshot({ clip: info.rect })
    await loc.evaluate((el) => (el.__oldStyle === null ? el.removeAttribute('style') : el.setAttribute('style', el.__oldStyle)))
    const svgText = info.tag === 'text' || info.tag === 'tspan'
    const fg = svgText && info.fill.startsWith('rgb') ? info.fill : info.color
    const stats = await page.evaluate(
      async ({ b64, fgColor }) => {
        const img = new Image()
        img.src = 'data:image/png;base64,' + b64
        await img.decode()
        const c = document.createElement('canvas')
        c.width = img.width
        c.height = img.height
        const g = c.getContext('2d')
        g.drawImage(img, 0, 0)
        const d = g.getImageData(0, 0, c.width, c.height).data
        const lin = (v) => {
          const u = v / 255
          return u <= 0.03928 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4
        }
        const lum = (r, gg, b) => 0.2126 * lin(r) + 0.7152 * lin(gg) + 0.0722 * lin(b)
        const m = /rgba?\(([^)]+)\)/.exec(fgColor)
        const [fr, fgc, fb] = m ? m[1].split(',').map((x) => parseFloat(x)) : [255, 255, 255]
        const fl = lum(fr, fgc, fb)
        const ratios = []
        for (let i = 0; i < d.length; i += 4) {
          const bl = lum(d[i], d[i + 1], d[i + 2])
          ratios.push((Math.max(fl, bl) + 0.05) / (Math.min(fl, bl) + 0.05))
        }
        ratios.sort((a, b) => a - b)
        const q = (p) => +ratios[Math.min(ratios.length - 1, Math.floor(p * ratios.length))].toFixed(2)
        return { pixels: ratios.length, min: q(0), p05: q(0.05), median: q(0.5), p95: q(0.95), fg: [fr, fgc, fb] }
      },
      { b64: png.toString('base64'), fgColor: fg },
    )
    const large = info.fontSize >= 24 || (info.fontSize >= 18.66 && Number(info.fontWeight) >= 700)
    const need = large ? 3 : 4.5
    rows.push({
      target,
      text: info.text,
      tag: info.tag,
      cls: info.cls,
      fontSize: info.fontSize,
      need,
      ...stats,
      textShadow: info.textShadow.slice(0, 60),
      verdict: stats.p05 >= need ? 'gruen' : stats.median >= need ? 'grenzwertig' : 'ROT',
    })
  }
  return { label, incompleteNodes: nodes.length, probed: rows.filter((r) => !r.skipped).length, rows }
}

async function runState(browser, name, vp, measureOnly) {
  const context = await browser.newContext(contextOptions(vp))
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 200))
  })
  const data = { state: name, viewport: vp.tag, scenes: {}, failures: [] }
  const full = FULL.includes(name)
  const shotNames = []
  const btn = (n, exact = true) => page.getByRole('button', { name: n, exact }).first()
  const mode = async (label) => {
    const button = btn(label)
    if (await button.isVisible().catch(() => false)) return button.click({ timeout: 5000 })
    return page.getByRole('combobox', { name: 'Kartenmodus' }).selectOption({ label }, { timeout: 5000 })
  }
  let idx = 0
  /** Eine Ansicht: herstellen, messen, ggf. fotografieren. `core` = Bild auch fuer die nicht-vollen Staende. */
  const scene = async (key, fn, { core = false, axeToo = true } = {}) => {
    idx += 1
    const entry = { n: idx }
    const wantShot = !measureOnly && (full || core)
    try {
      const extra = await fn()
      if (extra && typeof extra === 'object') Object.assign(entry, extra)
      entry.layout = await layout(page)
      entry.touch = await touchTargets(page)
      if (axeToo) entry.axe = await axe(page)
      if (wantShot) {
        const file = `${name}-${String(idx).padStart(2, '0')}-${key}-${vp.tag}.png`
        await page.screenshot({ path: join(OUT, file) })
        entry.image = file
        shotNames.push(file)
      }
    } catch (e) {
      entry.error = String(e).split('\n')[0].slice(0, 240)
      data.failures.push({ scene: key, error: entry.error })
      if (wantShot) {
        const file = `${name}-${String(idx).padStart(2, '0')}-${key}-FEHLER-${vp.tag}.png`
        await page.screenshot({ path: join(OUT, file) }).catch(() => {})
        entry.image = file
        shotNames.push(file)
      }
      await page.keyboard.press('Escape').catch(() => {})
    }
    data.scenes[key] = entry
  }
  const reading = () =>
    page.evaluate((src) => {
      const m = new RegExp(src).exec(document.body.innerText)
      return { t: performance.now(), day: m ? Number(m[1].split('.').join('')) : null, hour: m ? Number(m[2]) : null }
    }, CLOCK)

  data.loadToClockMs = await openState(page, name)

  await scene(
    'karte-geladen',
    async () => ({ tutorialShown: await page.getByRole('button', { name: 'Nicht mehr zeigen' }).isVisible().catch(() => false) }),
    {},
  )
  await btn('Nicht mehr zeigen').click({ timeout: 3000 }).catch(() => {})
  await page.waitForTimeout(300)

  await scene('karte-besitz', async () => ({}), {})
  await scene(
    'karte-truppen',
    async () => {
      await mode('Truppenstärke')
      await page.waitForTimeout(500)
      return {}
    },
    {},
  )
  await scene(
    'karte-brennpunkt',
    async () => {
      // Dorthin springen, wo die Armeen der KI stehen: ueber die Uebersichtskarte nach Asien.
      const mini = page.locator('canvas.map-overview').first()
      const b = await mini.boundingBox()
      if (!b) throw new Error('keine Uebersichtskarte')
      await mini.click({ position: { x: b.width * 0.72, y: b.height * 0.4 }, timeout: 4000 })
      await page.waitForTimeout(500)
      const map = page.locator('.map-layer--overlay').first()
      const mb = await map.boundingBox()
      const zoom = await longTasksDuring(page, async () => {
        await page.mouse.move(mb.x + mb.width / 2, mb.y + mb.height / 2)
        for (let i = 0; i < 4; i++) {
          await page.mouse.wheel(0, -240)
          await page.waitForTimeout(60)
        }
      })
      await page.waitForTimeout(300)
      return { zoom }
    },
    { core: true, axeToo: false },
  )
  await scene(
    'karte-zoom-schieben',
    async () => {
      const map = page.locator('.map-layer--overlay').first()
      const b = await map.boundingBox()
      if (!b) throw new Error('Karte ohne Flaeche')
      const cx = b.x + b.width / 2
      const cy = b.y + b.height / 2
      const zoom = await longTasksDuring(page, async () => {
        await page.mouse.move(cx, cy)
        for (let i = 0; i < 8; i++) {
          await page.mouse.wheel(0, -240)
          await page.waitForTimeout(60)
        }
      })
      const pan = await longTasksDuring(page, async () => {
        await page.mouse.move(cx, cy)
        await page.mouse.down()
        for (let i = 0; i < 20; i++) await page.mouse.move(cx - i * 12, cy - i * 6, { steps: 2 })
        await page.mouse.up()
      })
      return { zoom, pan }
    },
    { axeToo: false },
  )
  for (let i = 0; i < 8; i++) await page.mouse.wheel(0, 240)
  await mode('Besitz').catch(() => {})

  await scene(
    'protokoll-alles',
    async () => {
      await btn('alles').click({ timeout: 4000 }).catch(() => {})
      await page.waitForTimeout(300)
      return page.evaluate(() => {
        const log = document.querySelector('.log')
        const items = [...document.querySelectorAll('.log li')]
        const scroller = [...document.querySelectorAll('.log, .log *')].find((el) => el.scrollHeight > el.clientHeight + 2 && getComputedStyle(el).overflowY !== 'visible')
        return {
          entries: items.length,
          logBox: log ? { h: Math.round(log.getBoundingClientRect().height), w: Math.round(log.getBoundingClientRect().width) } : null,
          scrollable: Boolean(scroller),
          scrollHeight: scroller?.scrollHeight ?? null,
          clientHeight: scroller?.clientHeight ?? null,
          focusable: scroller ? scroller.tabIndex >= 0 : null,
          visibleRows: items.filter((li) => {
            const r = li.getBoundingClientRect()
            return r.bottom > 0 && r.top < innerHeight && r.height > 0
          }).length,
        }
      })
    },
    { core: true },
  )
  await scene('protokoll-kaempfe', async () => {
    const filter = btn('Kämpfe')
    const filterVisible = await filter.isVisible().catch(() => false)
    if (filterVisible) await filter.click({ timeout: 4000 })
    await page.waitForTimeout(300)
    return page.evaluate((fv) => ({ filterVisible: fv, entries: document.querySelectorAll('.log li').length }), filterVisible)
  })
  await btn('alles').click({ timeout: 2000 }).catch(() => {})

  await scene('provinz-eigene', async () => {
    const picker = page.locator('aside select').first()
    await picker.selectOption({ index: 1 }, { timeout: 5000 })
    await page.waitForTimeout(500)
    const buttons = await page.evaluate(() =>
      [...document.querySelectorAll('aside button')]
        .map((b) => b.textContent.trim())
        .filter(Boolean)
        .slice(0, 40),
    )
    return { optionCount: await picker.locator('option').count(), buttons }
  })

  // Armee des Menschen: Provinz mit eigener Armee suchen; gibt es keine, Kaserne bauen und ausheben.
  await scene(
    'armee-ausheben',
    async () => {
      const picker = page.locator('aside select').first()
      const n = Math.min(await picker.locator('option').count(), 40)
      for (let i = 1; i < n; i++) {
        await picker.selectOption({ index: i }, { timeout: 5000 })
        await page.waitForTimeout(150)
        if (await btn('Auswählen').isVisible().catch(() => false)) return { builtBarracks: false, foundArmyInOption: i, optionsScanned: i }
      }
      await picker.selectOption({ index: 1 }, { timeout: 5000 })
      await page.waitForTimeout(300)
      const recruit = page.getByRole('button', { name: 'Infanterie ausheben', exact: true }).first()
      let builtBarracks = false
      if (!(await recruit.isEnabled().catch(() => false))) {
        const build = btn('Kaserne bauen')
        if (await build.isVisible().catch(() => false)) {
          await build.click({ timeout: 4000 })
          builtBarracks = true
        }
      }
      await btn('100').click({ timeout: 5000 })
      try {
        await page.getByRole('button', { name: 'Infanterie ausheben', exact: true }).and(page.locator(':enabled')).waitFor({ timeout: 60000 })
      } finally {
        await btn('Pause').click({ timeout: 5000 }).catch(() => {})
      }
      for (let i = 0; i < 3; i++) {
        await recruit.click({ timeout: 3000 }).catch(() => {})
        await page.waitForTimeout(150)
      }
      await btn('100').click({ timeout: 5000 })
      try {
        await page.waitForFunction(() => [...document.querySelectorAll('aside button')].some((b) => b.textContent?.trim() === 'Auswählen'), null, { timeout: 90000 })
      } finally {
        await btn('Pause').click({ timeout: 5000 }).catch(() => {})
      }
      return { builtBarracks, foundArmyInOption: null }
    },
    { axeToo: false },
  )
  await scene(
    'armee-panel',
    async () => {
      await btn('Auswählen').click({ timeout: 5000 })
      await page.waitForTimeout(400)
      return page.evaluate(() => {
        const side = document.querySelector('aside.side')
        const panel = [...document.querySelectorAll('aside.side section.panel')].find((el) => el.querySelector('.panel__head'))
        const inView = (el) => {
          if (!el) return false
          const r = el.getBoundingClientRect()
          return r.top >= 0 && r.bottom <= innerHeight && r.height > 0
        }
        const march = [...document.querySelectorAll('aside button')].find((b) => b.textContent?.includes('Marschieren'))
        return { nameVisible: inView(panel?.querySelector('h2')), marchVisible: inView(march), sideScrollTop: side?.scrollTop ?? null, sideScrollH: side?.scrollHeight ?? null }
      })
    },
  )
  await scene(
    'armee-marsch-zielwahl',
    async () => {
      const t = await longTasksDuring(page, () => btn('Marschieren').click({ timeout: 5000 }))
      await page.waitForTimeout(300)
      const options = await page.evaluate(() => {
        const select = document.querySelectorAll('aside select')[1]
        return { options: select?.querySelectorAll('option').length ?? 0, groups: [...(select?.querySelectorAll('optgroup') ?? [])].map((g) => ({ label: g.label, options: g.children.length })) }
      })
      return { open: t, ...options }
    },
  )
  await page.keyboard.press('Escape').catch(() => {})
  await page.waitForTimeout(250)

  for (const [key, label] of [
    ['diplomatie', 'Diplomatie'],
    ['markt', 'Markt'],
    ['spionage', 'Spionage'],
    ['rangliste', 'Rangliste / Sieg'],
  ]) {
    await scene(
      key,
      async () => {
        await btn(label, false).click({ timeout: 6000 })
        await page.waitForTimeout(400)
        return page.evaluate(() => {
          const d = document.querySelector('[role=dialog]') ?? document.querySelector('aside')
          return { text: (d?.innerText ?? '').replace(/\s+/g, ' ').slice(0, 300) }
        })
      },
      { core: key === 'diplomatie' },
    )
    if (key === 'diplomatie') {
      await scene('diplomatie-macht', async () => {
        const countries = await page.evaluate(() =>
          [...document.querySelectorAll('[role=dialog] button, aside button')]
            .map((b) => b.textContent.trim())
            .filter((t) => ['Kanada', 'Mexiko', 'Brasilien', 'Argentinien', 'Russland', 'China', 'Indien'].includes(t)),
        )
        const target = countries.includes('Indien') ? 'Indien' : countries[0]
        if (!target) throw new Error('keine Macht in der Diplomatie')
        await btn(target).click({ timeout: 5000 })
        await page.waitForTimeout(400)
        const buttons = await page.evaluate(() => [...document.querySelectorAll('[role=dialog] button, aside button')].map((b) => ({ t: b.textContent.trim(), dis: b.disabled })).filter((b) => b.t))
        return {
          target,
          panelText: await page.evaluate(() => (document.querySelector('aside')?.innerText ?? '').replace(/\s+/g, ' ').slice(-420)),
          buttons: buttons.slice(0, 30),
          has: {
            krieg: buttons.some((b) => /Krieg/.test(b.t)),
            frieden: buttons.some((b) => /Frieden/.test(b.t)),
            buendnis: buttons.some((b) => /Bündnis/.test(b.t)),
            handel: buttons.some((b) => /Handel/.test(b.t)),
          },
        }
      })
    }
    await page.keyboard.press('Escape')
    await page.waitForTimeout(250)
  }

  await scene(
    'speichern-laden',
    async () => {
      await btn('Spielstände').click({ timeout: 6000 })
      await page.waitForTimeout(400)
      const save = await longTasksDuring(page, async () => {
        await page.getByRole('button', { name: 'Speichern' }).first().click({ timeout: 5000 })
        await page.waitForTimeout(800)
      })
      const rows = await page.evaluate(() =>
        [...document.querySelectorAll('[role=dialog] .slots > *, [role=dialog] li')]
          .map((x) => x.textContent.replace(/\s+/g, ' ').trim().slice(0, 90))
          .slice(0, 8),
      )
      return { save, rows }
    },
    {},
  )
  await scene(
    'laden-grosser-stand',
    async () => {
      const t0 = Date.now()
      const t = await longTasksDuring(page, async () => {
        await page.getByRole('button', { name: 'Laden', exact: true }).first().click({ timeout: 6000 })
        await page.waitForFunction((src) => new RegExp(src).test(document.body.innerText), CLOCK, { timeout: 60000 })
      })
      return { load: t, wallMs: Date.now() - t0 }
    },
    { axeToo: false },
  )
  await page.keyboard.press('Escape').catch(() => {})
  await page.waitForTimeout(300)

  // Alarmchip und Tempo: bis zu 25 s bei 100 laufen lassen und nach dem Einmarsch-Alarm schauen.
  await scene(
    'tempo-100-alarm',
    async () => {
      const a = await reading()
      const run = await longTasksDuring(page, async () => {
        await btn('100').click({ timeout: 5000 })
        await page.waitForFunction(() => document.querySelector('.alarm-chip') !== null, null, { timeout: 25000 }).catch(() => {})
        await page.waitForTimeout(500)
      })
      const chip = await page.evaluate(() => {
        const c = document.querySelector('.alarm-chip')
        const h = document.querySelector('header')
        return {
          chip: Boolean(c),
          chipText: c?.textContent?.trim() ?? null,
          chipBox: c ? (({ x, y, width, height }) => ({ x: Math.round(x), y: Math.round(y), w: Math.round(width), h: Math.round(height) }))(c.getBoundingClientRect()) : null,
          headerH: h ? Math.round(h.getBoundingClientRect().height) : null,
        }
      })
      const b = await reading()
      await btn('Pause').click({ timeout: 5000 }).catch(() => {})
      return { run, ...chip, dayStart: a.day, dayEnd: b.day }
    },
    {},
  )

  data.consoleErrors = errors.slice(0, 10)
  data.images = shotNames
  await context.close()
  return data
}

async function main() {
  const browser = await chromium.launch(process.platform === 'win32' ? { channel: 'msedge' } : {})
  const out = { createdAt: new Date().toISOString(), url: URL_, runs: [] }
  try {
    if (CONTRAST_ONLY) {
      const context = await browser.newContext(contextOptions({ width: 1280, height: 800 }))
      const page = await context.newPage()
      out.contrast = []
      for (const name of STATES) {
        await openState(page, name)
        out.contrast.push(await contrastProbe(page, `${name} Karte mit Einfuehrung`))
        await page.getByRole('button', { name: 'Nicht mehr zeigen' }).click({ timeout: 2000 }).catch(() => {})
        await page.waitForTimeout(300)
        out.contrast.push(await contrastProbe(page, `${name} Karte`))
      }
      await context.close()
      writeFileSync(join(OUT, 'kontrast-probe.json'), JSON.stringify(out, null, 1) + '\n')
      console.log('geschrieben kontrast-probe.json')
      return
    }
    for (const name of STATES) {
      for (const vp of VIEWPORTS) {
        console.log('lauf', name, vp.tag)
        out.runs.push(await runState(browser, name, vp, false))
      }
      for (const vp of MEASURE_ONLY) {
        console.log('lauf', name, vp.tag, '(nur Messwert)')
        out.runs.push(await runState(browser, name, vp, true))
      }
    }
  } finally {
    await browser.close()
  }
  const file = join(OUT, 'messwerte-spaet.json')
  let merged = out
  if (flag('merge') && existsSync(file)) {
    const old = JSON.parse(readFileSync(file, 'utf8'))
    const keep = old.runs.filter((r) => !out.runs.some((n) => n.state === r.state && n.viewport === r.viewport))
    merged = { ...old, createdAt: out.createdAt, runs: [...keep, ...out.runs] }
  }
  writeFileSync(file, JSON.stringify(merged, null, 1) + '\n')
  console.log('geschrieben', basename(file), 'Laeufe', merged.runs.length)
}

await main()
