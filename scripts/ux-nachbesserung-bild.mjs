#!/usr/bin/env node
/* global document, indexedDB */
/**
 * Bilder der Nachbesserung U (V3, Phase 2): Tastenhilfe (T-M46-05), Diplomatie mit gewaehlter Macht ohne verschobenen
 * Kopf (Punkt 1), Telefon-Kopf nach dem Symbol-Durchgang (T-M46-17). Nur 1280x800 und 375x667.
 *
 *   node scripts/ux-nachbesserung-bild.mjs --url http://localhost:5331/ --out docs/ux/v3-after
 *
 * Der Zustandsaufbau (Stand in den Speicher, Laden) ist der von ux-bild.mjs.
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
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
const ORIGIN = new URL(URL_).origin

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

/** Derselbe Stand, der Mensch ist die Macht mit den meisten Provinzen (wie ux-late.mjs). */
async function strongest(page, text) {
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
    { origin: ORIGIN, root: ROOTFS, raw: text },
  )
}

async function openState(page, name) {
  await page.goto(URL_, { waitUntil: 'load' })
  await page.getByRole('button', { name: 'Partie beginnen' }).waitFor({ state: 'attached', timeout: 30000 })
  const raw = readState(name)
  await putState(page, name.endsWith('G') ? await strongest(page, raw) : raw)
  await page.getByRole('button', { name: 'Spielstände', exact: true }).first().click({ timeout: 10000 })
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: 'Laden', exact: true }).first().click({ timeout: 10000 })
  await page.waitForFunction(() => /Tag\s+[\d.]+\s+·\s+\d\d:00/.test(document.body.innerText), null, { timeout: 90000 })
  await page.waitForTimeout(800)
}


const [a, b] = ['1280x800', '375x667']
const browser = await chromium.launch(process.platform === 'win32' ? { channel: 'msedge' } : {})
mkdirSync(resolve(arg('out', 'docs/ux/v3-after')), { recursive: true })
const OUTDIR = resolve(arg('out', 'docs/ux/v3-after'))
const open = async (size) => {
  const [w, h] = size.split('x').map(Number)
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: w < 600, isMobile: w < 600, locale: 'de-DE' })
  const page = await context.newPage()
  await openState(page, 'S575G')
  await page.getByRole('button', { name: 'Nicht mehr zeigen', exact: true }).first().click({ timeout: 3000 }).catch(() => {})
  await page.waitForTimeout(400)
  return { context, page }
}
{
  const { context, page } = await open(a)
  // Tastenhilfe
  await page.keyboard.press('F1')
  await page.waitForTimeout(500)
  await page.screenshot({ path: join(OUTDIR, `S575G-nachher2-tastenhilfe-${a}.png`) })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  // Diplomatie, Macht waehlen: der Kopf bleibt bei y = 0
  await page.getByRole('button', { name: 'Diplomatie', exact: false }).first().click({ timeout: 6000 })
  await page.waitForTimeout(500)
  const target = page.locator('aside .nation-select').first()
  await target.click({ timeout: 5000 })
  await page.waitForTimeout(500)
  const y = await page.evaluate(() => Math.round(document.querySelector('header').getBoundingClientRect().y))
  console.log('header.y nach Machtwahl', y)
  await page.screenshot({ path: join(OUTDIR, `S575G-nachher2-diplomatie-${a}.png`) })
  await context.close()
}
{
  const { context, page } = await open(b)
  await page.screenshot({ path: join(OUTDIR, `S575G-nachher2-karte-${b}.png`) })
  await context.close()
}
await browser.close()
