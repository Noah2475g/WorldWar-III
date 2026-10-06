#!/usr/bin/env node
/* global document, indexedDB, innerWidth, innerHeight, getComputedStyle, NodeFilter */
/**
 * Abnahmebilder + Messung der Bauvorschau (B3, Plan Bauvorschau §4, Spec §5/§9).
 *
 *   pnpm dev --port 5331 --strictPort        # in einem zweiten Terminal
 *   node scripts/ux-bauvorschau-bild.mjs --url http://localhost:5331/ \
 *        [--out docs/ux/bauvorschau] [--report docs/reports/v3/bauvorschau-hover.json]
 *
 * Zustandsaufbau 1:1 wie scripts/ux-nachbesserung-bild.mjs (Stand S575G: der Mensch ist die Macht mit den meisten
 * Provinzen), mit EINER Abweichung (A12-Rueckfall, im Bericht vermerkt): Im geladenen Stand S575G hat der Spieler
 * Rohstoffe, es gibt kein "fehlt"-Feld. Darum werden die Rohstoffe des menschlichen Spielers VOR dem Laden auf 0 gesetzt;
 * dann ist jedes Bauvorhaben ohne Hauptmangel ein `.slot--short`.
 *
 * Pruefung A11: Maus (echtes Zeigerereignis) auf ein `.slot--short` -> `.cost-preview .cost-chip--short` muss existieren
 * (Chromium feuert pointerover auch auf gesperrten Knoepfen). Fehlt es: D6-Rueckfall in app.css, neu messen.
 *
 * Schreibt: desktop-1280x800.png (Maus auf .slot--short, Vorschauzeile gefuellt), telefon-375x667.png (Touch: kein
 * Hover, Touch-Rot am Feld) und den Textanteil der gefuellten Zeile (.cost-preview) in den Bericht.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const URL_ = arg('url', 'http://localhost:5331/')
const OUTDIR = resolve(arg('out', 'docs/ux/bauvorschau'))
const REPORT = resolve(arg('report', 'docs/reports/v3/bauvorschau-hover.json'))
const STATE = 'S575G'
const ORIGIN = new URL(URL_).origin
const baseName = (n) => n.replace(/G$/, '')
const readState = (raw) => {
  const dir = resolve(ROOT, 'test/fixtures/v3')
  const plain = join(dir, `${baseName(raw)}.json`)
  const p = existsSync(plain) ? plain : join(dir, `${baseName(raw)}.json.gz`)
  const buf = readFileSync(p)
  return p.endsWith('.gz') ? gunzipSync(buf).toString('utf8') : buf.toString('utf8')
}
const ROOTFS = (() => {
  const p = ROOT.split(String.fromCharCode(92)).join('/')
  return p.startsWith('/') ? p : `/${p}`
})()

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

/** Mensch = staerkste Macht (wie ux-nachbesserung-bild.mjs); ZUSATZ A12-Rueckfall: deren Rohstoffe auf 0. */
async function strongestBroke(page, text) {
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
      for (const k of Object.keys(state.players[top].resources)) state.players[top].resources[k] = 0
      return core.serialise(state)
    },
    { origin: ORIGIN, root: ROOTFS, raw: text },
  )
}

async function openState(page) {
  await page.goto(URL_, { waitUntil: 'load' })
  await page.getByRole('button', { name: 'Partie beginnen' }).waitFor({ state: 'attached', timeout: 30000 })
  await putState(page, await strongestBroke(page, readState(STATE)))
  await page.getByRole('button', { name: 'Spielstände', exact: true }).first().click({ timeout: 10000 })
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: 'Laden', exact: true }).first().click({ timeout: 10000 })
  await page.waitForFunction(() => /Tag\s+[\d.]+\s+·\s+\d\d:00/.test(document.body.innerText), null, { timeout: 90000 })
  await page.waitForTimeout(800)
  await page.getByRole('button', { name: 'Nicht mehr zeigen', exact: true }).first().click({ timeout: 3000 }).catch(() => {})
  await page.waitForTimeout(400)
}

/** Eigene Provinz waehlen, die ein .slot--short zeigt. */
async function pickOwnProvince(page) {
  const picker = page.locator('aside select').first()
  const n = Math.min(await picker.locator('option').count(), 80)
  for (let i = 1; i < n; i++) {
    await picker.selectOption({ index: i }, { timeout: 5000 })
    await page.waitForTimeout(120)
    if ((await page.locator('aside .slot--short').count()) > 0) return i
  }
  return -1
}

/** Textanteil eines Bereichs (Messfunktion wie scripts/ux-bild.mjs measureArea, ohne Detail). */
const measure = (page, selector) =>
  page.evaluate((sel) => {
    const root = document.querySelector(sel)
    if (!root) return null
    const inView = (r) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth
    let chars = 0
    let textArea = 0
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n.textContent.replace(/\s+/g, ' ').trim()
      if (!text) continue
      const el = n.parentElement
      const st = el && getComputedStyle(el)
      if (!st || st.visibility === 'hidden' || st.display === 'none') continue
      const range = document.createRange()
      range.selectNodeContents(n)
      let seen = false
      for (const r of range.getClientRects()) {
        if (inView(r)) {
          textArea += r.width * r.height
          seen = true
        }
      }
      if (seen) chars += text.length
    }
    let symbols = 0
    let symbolArea = 0
    for (const svg of root.querySelectorAll('svg')) {
      const r = svg.getBoundingClientRect()
      if (!inView(r) || r.width > 80 || r.height > 80) continue
      const st = getComputedStyle(svg)
      if (st.visibility === 'hidden' || st.display === 'none') continue
      symbols += 1
      symbolArea += r.width * r.height
    }
    const total = textArea + symbolArea
    return { chars, symbols, textArea: Math.round(textArea), symbolArea: Math.round(symbolArea), textShare: total ? +(textArea / total).toFixed(3) : 0 }
  }, selector)

const browser = await chromium.launch(process.platform === 'win32' ? { channel: 'msedge' } : {})
mkdirSync(OUTDIR, { recursive: true })
const report = {
  erzeugt: new Date().toISOString(),
  skript: 'scripts/ux-bauvorschau-bild.mjs',
  stand: `${STATE} (Rohstoffe des Menschen vor dem Laden auf 0, A12-Rueckfall)`,
  grenze: 0.5,
  hinweis: 'Textanteil der gefuellten Vorschauzeile (.cost-preview). Ausbau Stufe >= 2: nur dokumentiert, bekannte Grenze bis 0,61 (Spec §5).',
}
let a11 = false
try {
  // Desktop: Maus
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, locale: 'de-DE' })
    const page = await context.newPage()
    await openState(page)
    const idx = await pickOwnProvince(page)
    report.provinzOptionIndex = idx
    if (idx < 0) throw new Error('keine eigene Provinz mit .slot--short gefunden')
    const hover = async (loc) => {
      const box = await loc.boundingBox()
      await page.mouse.move(2, 2)
      await page.waitForTimeout(150)
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 })
      await page.waitForTimeout(400)
    }
    const fill = async (loc) => ({
      slotKlassen: await loc.evaluate((el) => el.className),
      gesperrterKnopf: await loc.locator('button').first().isDisabled().catch(() => null),
      costChipShort: await page.evaluate(() => document.querySelector('.cost-preview .cost-chip--short') !== null),
      ...(await measure(page, '.cost-preview')),
      zeile: await page.evaluate(() => document.querySelector('.cost-preview')?.textContent ?? null),
      hoehe: await page.evaluate(() => Math.round(document.querySelector('.cost-preview').getBoundingClientRect().height)),
    })
    // Ausbau (gebautes Feld, Stufe >= 2): nur dokumentieren
    const built = page.locator('aside .slot--built.slot--short').first()
    if ((await built.count()) > 0) {
      await hover(built)
      report.ausbauStufeAb2 = await fill(built)
    }
    // Stufe-1-Fall: freies Feld (Bild + Grenze 0,5); gibt es keins, das gebaute
    const free = page.locator('aside .slot--free.slot--short').first()
    const target = (await free.count()) > 0 ? free : page.locator('aside .slot--short').first()
    await hover(target)
    report.desktop1280x800 = await fill(target)
    a11 = report.desktop1280x800.costChipShort
    console.log(a11 ? 'cost-chip--short gefunden' : 'cost-chip--short NICHT gefunden (A11 offen -> D6-Rueckfall)')
    report.a11CostChipShortGefunden = a11
    await page.screenshot({ path: join(OUTDIR, 'desktop-1280x800.png') })
    await context.close()
  }
  // Telefon: Touch (keine Hover-Zeile; Touch-Rot am Feld)
  {
    const context = await browser.newContext({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, locale: 'de-DE' })
    const page = await context.newPage()
    await openState(page)
    const idx = await pickOwnProvince(page)
    report.telefonProvinzOptionIndex = idx
    await page.locator('aside .slot--short').first().scrollIntoViewIfNeeded().catch(() => {})
    await page.waitForTimeout(300)
    report.telefon375x667 = { costPreviewImDom: await page.evaluate(() => document.querySelector('.cost-preview') !== null), slotShort: await page.locator('aside .slot--short').count() }
    await page.screenshot({ path: join(OUTDIR, 'telefon-375x667.png') })
    await context.close()
  }
  report.urteil = report.desktop1280x800.textShare <= report.grenze ? 'Stufe-1-Fall <= 0,5' : 'UEBER 0,5'
} finally {
  mkdirSync(dirname(REPORT), { recursive: true })
  writeFileSync(REPORT, JSON.stringify(report, null, 2) + '\n')
  await browser.close()
}
console.log(JSON.stringify(report, null, 2))
if (!a11) process.exitCode = 2
