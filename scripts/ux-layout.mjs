#!/usr/bin/env node
/* global document, window, getComputedStyle, innerWidth, innerHeight */
/**
 * UX-Zaehlwerte der Bahn U-Layout (PLAN-V3 Welle 2, T-M46-10/02/15/01/06/11/08): Telefon-Layout, Protokoll,
 * Heeruebersicht, Diplomatie. Faehrt den Stand S575G (Mensch = staerkste Macht, test/fixtures/v3) in 375x667
 * und 1280x800 und schreibt NUR Zaehlwerte (Pixel, Anzahl, Tasten) — keine Millisekunden als Beleg (Regel 5).
 *
 *   node scripts/ux-layout.mjs --url http://localhost:5341/ --out docs/ux/v3-after --tag nachher
 *        [--viewports 375x667,1280x800] [--state S575G] [--shots]   # --shots: je ein Bild (nur diese zwei Groessen)
 *
 * Schreibt `<out>/layout-<tag>.json`. Der Spielcode bleibt unberuehrt.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const URL_ = arg('url', 'http://localhost:5341/')
const OUT = resolve(arg('out', 'docs/ux/v3-after'))
const TAG = arg('tag', 'nachher')
const STATE = arg('state', 'S575G')
const SHOTS = process.argv.includes('--shots')
const VIEWPORTS = arg('viewports', '375x667,1280x800')
  .split(',')
  .map((v) => {
    const [width, height] = v.split('x').map(Number)
    return { width, height, tag: `${width}x${height}` }
  })
mkdirSync(OUT, { recursive: true })

const ROOTFS = (() => {
  const p = ROOT.split(String.fromCharCode(92)).join('/')
  return p.startsWith('/') ? p : `/${p}`
})()
const readState = (rawName) => {
  const name = rawName.replace(/G$/, '')
  const dir = resolve(ROOT, 'test/fixtures/v3')
  const plain = join(dir, `${name}.json`)
  const p = existsSync(plain) ? plain : join(dir, `${name}.json.gz`)
  const raw = readFileSync(p)
  return p.endsWith('.gz') ? gunzipSync(raw).toString('utf8') : raw.toString('utf8')
}
const CLOCK = 'Tag\\s+([\\d.]+)\\s+·\\s+(\\d\\d):00'

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

async function openState(page, name) {
  await page.goto(URL_, { waitUntil: 'load' })
  await page.getByRole('button', { name: 'Partie beginnen' }).waitFor({ state: 'attached', timeout: 30000 })
  await putState(page, name.endsWith('G') ? await strongestViewer(page, readState(name)) : readState(name))
  await page.getByRole('button', { name: 'Spielstände', exact: true }).first().click({ timeout: 10000 })
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: 'Laden', exact: true }).first().click({ timeout: 10000 })
  await page.waitForFunction((src) => new RegExp(src).test(document.body.innerText), CLOCK, { timeout: 90000 })
  await page.waitForTimeout(800)
}

/** Kopfleiste: wie viele Bedienelemente liegen ganz im Bild, wie viele ausserhalb. */
const headerScene = (page) =>
  page.evaluate(() => {
    const controls = [...document.querySelectorAll('.header button, .header select, .header [role=button]')].filter((el) => {
      const s = getComputedStyle(el)
      return s.display !== 'none' && s.visibility !== 'hidden' && el.getBoundingClientRect().width > 0
    })
    const inside = (el) => {
      const r = el.getBoundingClientRect()
      return r.left >= -0.5 && r.right <= innerWidth + 0.5 && r.top >= -0.5 && r.bottom <= innerHeight + 0.5
    }
    const label = (el) => (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 24)
    const top = document.querySelector('.header__top')
    const header = document.querySelector('header')
    return {
      headerHeight: Math.round(header.getBoundingClientRect().height),
      topScrollWidth: top.scrollWidth,
      topClientWidth: top.clientWidth,
      controls: controls.length,
      controlsInView: controls.filter(inside).length,
      controlsOutside: controls.filter((el) => !inside(el)).map(label),
      chipInView: (() => {
        const c = document.querySelector('.alarm-chip')
        return c ? inside(c) : null
      })(),
    }
  })

/** Seitenleiste bei offenem Panel (Provinz gewaehlt): Hoehe in Pixeln und als Anteil der Fensterhoehe. */
const sideScene = (page) =>
  page.evaluate(() => {
    const box = (sel) => {
      const el = document.querySelector(sel)
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { y: Math.round(r.y), h: Math.round(r.height), w: Math.round(r.width) }
    }
    const side = document.querySelector('.side')
    return {
      side: box('.side'),
      sideShareOfViewport: +((side?.getBoundingClientRect().height ?? 0) / innerHeight).toFixed(3),
      sideScrollH: side?.scrollHeight ?? null,
      map: box('.map-layer--overlay'),
      mapShare: +((document.querySelector('.map-layer--overlay')?.getBoundingClientRect().height ?? 0) / innerHeight).toFixed(3),
      foot: box('.foot'),
      sheet: document.querySelector('.app')?.getAttribute('data-sheet') ?? null,
      panelOpen: document.querySelector('.app')?.getAttribute('data-panel') ?? null,
    }
  })

/** Protokoll: Hoehe, sichtbare Zeilen, Filter sichtbar, Eintraege gesamt, Zeilen je Spieltag. */
const logScene = (page) =>
  page.evaluate(() => {
    const log = document.querySelector('.foot .log') ?? document.querySelector('.log')
    if (!log) return { present: false }
    const r = log.getBoundingClientRect()
    const items = [...log.querySelectorAll('li')]
    const visible = items.filter((li) => {
      const b = li.getBoundingClientRect()
      return b.height > 0 && b.bottom > r.top + 1 && b.top < r.bottom - 1 && b.bottom > 0 && b.top < innerHeight
    })
    const filters = log.querySelector('.log__filters')
    const fs = filters ? getComputedStyle(filters) : null
    const filterButtons = [...log.querySelectorAll('.log__filters button, .log__filters [role=tab]')]
    return {
      present: true,
      box: { h: Math.round(r.height), w: Math.round(r.width) },
      entriesInDom: items.length,
      visibleRows: visible.length,
      filterVisible: Boolean(filters && fs.display !== 'none' && filters.getBoundingClientRect().height > 0),
      filterButtonsInView: filterButtons.filter((b) => {
        const q = b.getBoundingClientRect()
        return q.width > 0 && q.bottom <= innerHeight && q.right <= innerWidth && q.left >= 0
      }).length,
    }
  })

async function runViewport(browser, vp) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    hasTouch: Math.min(vp.width, vp.height) < 600,
    isMobile: Math.min(vp.width, vp.height) < 600,
    locale: 'de-DE',
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))
  const btn = (n, exact = true) => page.getByRole('button', { name: n, exact }).first()
  const out = { viewport: vp.tag, scenes: {}, errors }
  const shot = async (key) => {
    if (SHOTS) await page.screenshot({ path: join(OUT, `${STATE}-${TAG}-${key}-${vp.tag}.png`) })
  }
  await openState(page, STATE)
  await btn('Nicht mehr zeigen').click({ timeout: 3000 }).catch(() => {})
  await page.waitForTimeout(300)

  out.scenes.kopf = await headerScene(page)
  out.scenes.protokollKarte = await logScene(page)
  out.scenes.ohnePanel = await sideScene(page)
  await shot('kopf')

  // Telefon: das Protokoll klappt auf (T-M46-10) — dann zaehlen Hoehe, Zeilen und Filter im offenen Blatt.
  const toggle = page.locator('.foot__logtoggle')
  if (await toggle.isVisible().catch(() => false)) {
    await toggle.click({ timeout: 4000 })
    await page.waitForTimeout(300)
    out.scenes.protokollOffen = await logScene(page)
    await shot('protokoll')
    await toggle.click({ timeout: 4000 }).catch(() => {})
    await page.waitForTimeout(200)
  }

  // Provinz waehlen -> Panel offen.
  const picker = page.locator('aside select').first()
  await picker.selectOption({ index: 1 }, { timeout: 5000 }).catch((e) => errors.push(String(e).split('\n')[0]))
  await page.waitForTimeout(500)
  out.scenes.panel = await sideScene(page)
  await shot('panel')
  out.errors = errors
  await context.close()
  return out
}

const browser = await chromium.launch(process.env.UX_CHROMIUM ? { executablePath: process.env.UX_CHROMIUM } : process.platform === 'win32' ? { channel: 'msedge' } : {})
const result = { tag: TAG, state: STATE, runs: [] }
for (const vp of VIEWPORTS) result.runs.push(await runViewport(browser, vp))
await browser.close()
const file = join(OUT, `layout-${TAG}.json`)
writeFileSync(file, JSON.stringify(result, null, 2) + '\n')
console.log(file)
for (const r of result.runs) console.log(r.viewport, JSON.stringify(r.scenes.kopf), JSON.stringify(r.scenes.panel), JSON.stringify(r.scenes.protokollKarte), r.errors)
