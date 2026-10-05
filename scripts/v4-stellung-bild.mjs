#!/usr/bin/env node
/* global document, indexedDB */
/**
 * Abnahmebilder V4 Etappe 1 "Stellung" (T-M48-04): Stand S575G, Uebersichtskarte auf SAU, vier Mal zoomen,
 * Pause -> stand-<tag>.png; Tempo kurz an, wieder Pause -> marsch-<tag>.png. Nur 1280x800.
 *
 *   node scripts/v4-stellung-bild.mjs --url http://localhost:5341/ --tag nachher
 *   node scripts/v4-stellung-bild.mjs --url http://localhost:5342/ --tag vorher --serve-root <Pfad von vm07-vorher>
 *
 * Der Zustandsaufbau (Stand in den Speicher, Laden) ist der von ux-nachbesserung-bild.mjs.
 * Klickpunkt der Uebersichtskarte: SAU bei (2479/4000, 1250/2400) der Karte (Plan A5); --fx/--fy ueberschreiben.
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
const URL_ = arg('url', 'http://localhost:5341/')
const TAG = arg('tag', 'nachher')
const FX = Number(arg('fx', String(2479 / 4000)))
const FY = Number(arg('fy', String(1250 / 2400)))
const OUTDIR = resolve(ROOT, arg('out', 'docs/ux/v4-stellung'))
const baseName = (n) => n.replace(/G$/, '')
const readState = (raw) => {
  const dir = resolve(ROOT, 'test/fixtures/v3')
  const plain = join(dir, `${baseName(raw)}.json`)
  const p = existsSync(plain) ? plain : join(dir, `${baseName(raw)}.json.gz`)
  const buf = readFileSync(p)
  return p.endsWith('.gz') ? gunzipSync(buf).toString('utf8') : buf.toString('utf8')
}
// Wurzel des Baums, der den Dev-Server speist (Vite erlaubt /@fs nur dort): --serve-root, sonst dieser Baum.
const SERVE = arg('serve-root', ROOT)
const ROOTFS = (() => {
  const p = SERVE.split(String.fromCharCode(92)).join('/')
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

mkdirSync(OUTDIR, { recursive: true })
const browser = await chromium.launch(process.platform === 'win32' ? { channel: 'msedge' } : {})
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, locale: 'de-DE' })
const page = await context.newPage()
await openState(page, 'S575G')
await page.getByRole('button', { name: 'Nicht mehr zeigen', exact: true }).first().click({ timeout: 3000 }).catch(() => {})
await page.waitForTimeout(400)

const speeds = page.getByRole('group', { name: 'Geschwindigkeit' })
const pause = async () => {
  await speeds.getByRole('button', { name: 'Pause' }).click({ timeout: 4000 }).catch(() => {})
  await page.waitForTimeout(300)
}
await pause()

const mini = page.locator('canvas.map-overview').first()
const box = await mini.boundingBox()
if (!box) throw new Error('canvas.map-overview nicht gefunden')
await mini.click({ position: { x: box.width * FX, y: box.height * FY }, timeout: 4000 })
await page.waitForTimeout(500)
const map = page.locator('.map-layer--overlay').first()
const mb = await map.boundingBox()
if (!mb) throw new Error('.map-layer--overlay nicht gefunden')
await page.mouse.move(mb.x + mb.width / 2, mb.y + mb.height / 2)
for (let i = 0; i < 4; i++) {
  await page.mouse.wheel(0, -240)
  await page.waitForTimeout(80)
}
await page.waitForTimeout(400)
await pause()
await page.screenshot({ path: join(OUTDIR, `stand-${TAG}.png`) })
console.log('Bild', `stand-${TAG}.png`)

// Marsch: Tempo kurz an (Stufe 1), dann wieder Pause
const run = speeds.locator('button:not([aria-label="Pause"])').first()
await run.click({ timeout: 4000 })
await page.waitForTimeout(Number(arg('lauf', '1500')))
await pause()
await page.screenshot({ path: join(OUTDIR, `marsch-${TAG}.png`) })
console.log('Bild', `marsch-${TAG}.png`)
await context.close()
await browser.close()
