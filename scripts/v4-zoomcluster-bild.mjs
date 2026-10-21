#!/usr/bin/env node
/* global document, indexedDB */
/**
 * Abnahmebilder Zoom-Cluster (E1), Kopie von v4-sammel-bild.mjs: Stand S575G, Uebersichtskarte auf SAU,
 * Zoomstufe per Werkzeugspalte-Knoepfen 'Region'/'Nah' (Seitenleiste E3, data-tier="mid"/"near",
 * scale 1,6 / 0,97) statt Mausrad -> mid-<tag>.png (data-zoom-tier muss mid sein). Nur --tag nachher:
 * danach per Knopf 'Nah' (data-tier="near") -> nah-nachher.png (Tier muss near sein). Fallback, falls
 * die Zoomstufen-Knoepfe nicht gefunden werden: Mausrad (wie im Original). Logt data-zoom-tier und
 * data-view-scale.
 *
 *   node scripts/v4-zoomcluster-bild.mjs --url http://localhost:5343/ --tag nachher
 *   node scripts/v4-zoomcluster-bild.mjs --url http://localhost:5344/ --tag vorher --serve-root <Pfad> --no-tier-check
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
const URL_ = arg('url', 'http://localhost:5343/')
const TAG = arg('tag', 'nachher')
const FX = Number(arg('fx', String(2479 / 4000)))
const FY = Number(arg('fy', String(1250 / 2400)))
const WHEEL = Number(arg('wheel', '3'))
const NOTIER = process.argv.includes('--no-tier-check')
/**
 * Filmstreifen (T-M<n>-06, D9, Plan §5 E2b, Schritt 3): `page.clock.install()` faelscht
 * rAF NICHT (A11, R8 — Playwright-Dokumentation) — die Zoom-Cluster-Animation laeuft ueber
 * `requestAnimationFrame`, `clock.runFor` ruehrt sie also nicht. Deshalb nur zwei echte
 * Bilder: 000 (Klickmoment, Tween startet) und 100 (nach > 588 ms Echtzeit, Ziel erreicht).
 */
const FILM = process.argv.includes('--film')
const OUTDIR = resolve(ROOT, arg('out', 'docs/ux/v4-zoomcluster'))
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
if (FILM) await page.clock.install({ time: 0 })
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
await page.waitForTimeout(900)

const canvasInfo = async () =>
  page.evaluate(() => {
    const el = document.querySelector('[data-selected-province]')
    return { tier: el?.getAttribute('data-zoom-tier') ?? null, scale: el?.getAttribute('data-view-scale') ?? null }
  })
const check = async (want, label) => {
  const info = await canvasInfo()
  console.log(label, 'data-zoom-tier=', info.tier, 'data-view-scale=', info.scale)
  if (!NOTIER && info.tier !== want) {
    console.error(`ABBRUCH: Tier ${info.tier}, erwartet ${want}`)
    await browser.close()
    process.exit(2)
  }
}

/** Zoomstufe per Werkzeugspalte-Knopf (data-tier="mid"|"near", Seitenleiste E3). Fallback: Mausrad. */
async function setTierViaButton(tier) {
  const btn = page.locator(`[data-tier="${tier}"]`).first()
  if ((await btn.count()) > 0) {
    await btn.click({ timeout: 4000 })
    await page.waitForTimeout(300)
    return true
  }
  return false
}
async function wheelFallback(times) {
  const map = page.locator('.map-layer--overlay').first()
  const mb = await map.boundingBox()
  if (!mb) throw new Error('.map-layer--overlay nicht gefunden')
  await page.mouse.move(mb.x + mb.width / 2, mb.y + mb.height / 2)
  for (let i = 0; i < times; i++) {
    await page.mouse.wheel(0, -240)
    await page.waitForTimeout(80)
  }
  await page.waitForTimeout(400)
}

// Stufe 'Region' (data-tier="mid", scale 1,6) ueber den Zoomstufen-Knopf anfahren.
await pause()
if (!(await setTierViaButton('mid'))) await wheelFallback(0)
await pause()
await check('mid', 'mid')
await page.screenshot({ path: join(OUTDIR, `mid-${TAG}.png`) })
console.log('Bild', `mid-${TAG}.png`)

if (TAG === 'nachher') {
  // Stufe 'Nah' (data-tier="near", scale 0,97) ueber den Zoomstufen-Knopf anfahren; Fallback Mausrad.
  if (!(await setTierViaButton('near'))) await wheelFallback(WHEEL)
  await page.waitForTimeout(400)
  await pause()
  await check('near', 'nah')
  await page.screenshot({ path: join(OUTDIR, `nah-${TAG}.png`) })
  console.log('Bild', `nah-${TAG}.png`)
}

if (FILM) {
  /**
   * Filmstreifen (Schritt 3, D9): von 'mid' (hier bereits angefahren) aus Teilen (Klick
   * 'Nah') und Buendeln (Klick 'Region') je als 000/100-Paar. `page.clock.runFor` wird
   * aufgerufen, weil der Plan es verlangt — sie bewegt NUR die virtuelle Uhr der Seite
   * (setTimeout/Date), nicht die Zoom-Cluster-Animation (die haengt an rAF, A11).
   * Das eigentliche Abwarten ist deshalb `page.waitForTimeout` (Echtzeit).
   */
  await pause()
  if (!(await setTierViaButton('mid'))) await wheelFallback(0)
  await pause()
  await check('mid', 'film-teilen-vor')

  // Teilen: mid -> near (D9 Kinder fliegen vom Elternpunkt, <= 588 ms).
  await setTierViaButton('near')
  await page.screenshot({ path: join(OUTDIR, 'teilen-000.png') })
  console.log('Bild', 'teilen-000.png')
  await page.clock.runFor(600)
  await page.waitForTimeout(650)
  await check('near', 'film-teilen-nach')
  await page.screenshot({ path: join(OUTDIR, 'teilen-100.png') })
  console.log('Bild', 'teilen-100.png')

  // Zurueck auf 'mid', dann Buendeln: near -> mid (D9 Kinder fliegen zur Gruppe, 280 ms).
  await pause()
  if (!(await setTierViaButton('mid'))) await wheelFallback(0)
  await pause()
  await check('mid', 'film-buendeln-vor')
  // Erneut 'near' anfahren, damit der folgende Klick auf 'Region' tatsaechlich einen
  // Stufenwechsel (near -> mid) ausloest statt eines Neins (schon auf der Stufe).
  await setTierViaButton('near')
  await page.waitForTimeout(400)
  await pause()
  await check('near', 'film-buendeln-start')

  await setTierViaButton('mid')
  await page.screenshot({ path: join(OUTDIR, 'buendeln-000.png') })
  console.log('Bild', 'buendeln-000.png')
  await page.clock.runFor(400)
  await page.waitForTimeout(450)
  await check('mid', 'film-buendeln-nach')
  await page.screenshot({ path: join(OUTDIR, 'buendeln-100.png') })
  console.log('Bild', 'buendeln-100.png')
}

await context.close()
await browser.close()
