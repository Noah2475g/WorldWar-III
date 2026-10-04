#!/usr/bin/env node
/* global document, getComputedStyle, innerWidth, innerHeight, indexedDB, NodeFilter */
/**
 * Messung der Bahn U-Bild (V3 Welle 2, T-M46-13 / T-M46-03): Zaehlwerte, keine Millisekunden.
 *
 *   node scripts/ux-bild.mjs --url http://localhost:5331/ --out docs/reports/v3/ubild-vorher.json
 *        [--states S300,S575G] [--viewports 1280x800,375x667] [--shots docs/ux/v3-after [--shot-states S575G]]
 *
 * Je Stand und Fenstergroesse, in drei Ansichten (Karte, Provinz mit Armee, Armeepanel):
 *  - Kopfleiste und Seitenpanel: Zeichen, Textflaeche, Symbolzahl, Symbolflaeche, Textanteil (Text / (Text + Symbole));
 *  - Karte: Armeemarker je Zoomstufe (Kartenmassstab 0,5 / 1 / 2 / 4 / 8 Karteneinheiten je Pixel): wie viele sind
 *    vollstaendig verdeckt, wie viele teilweise, groesster Stapel an einem Ort — gerechnet mit `markersFor` aus dem
 *    Spielcode ueber den Stand der staerksten Macht (Sicht wie in S575G).
 * Bilder (nur wenn --shots gesetzt) nur 375x667 und 1280x800. Der Spielcode bleibt unberuehrt.
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
const OUT = resolve(arg('out', 'docs/reports/v3/ubild-messwerte.json'))
const SHOTS = arg('shots', '')
const DETAIL = process.argv.includes('--detail')
const SHOT_STATES = arg('shot-states', 'S575G').split(',')
const STATES = arg('states', 'S300,S575G').split(',')
const VIEWPORTS = arg('viewports', '1280x800,375x667')
  .split(',')
  .map((v) => {
    const [width, height] = v.split('x').map(Number)
    return { width, height, tag: v }
  })
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

/** Textflaeche und Symbolflaeche eines Bereichs, in Bildpunkten. */
function measureArea(page, selector) {
  return page.evaluate(([sel, detail]) => {
    const root = document.querySelector(sel)
    if (!root) return null
    const box = root.getBoundingClientRect()
    const inView = (r) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth
    let chars = 0
    let textArea = 0
    const top = []
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
      let nodeArea = 0
      for (const r of range.getClientRects()) {
        if (inView(r)) {
          textArea += r.width * r.height
          nodeArea += r.width * r.height
          seen = true
        }
      }
      if (detail && seen) top.push({ text: text.slice(0, 60), area: Math.round(nodeArea) })
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
    return {
      chars,
      symbols,
      textArea: Math.round(textArea),
      symbolArea: Math.round(symbolArea),
      textShare: total ? +(textArea / total).toFixed(3) : 0,
      boxArea: Math.round(box.width * box.height),
      ...(detail ? { top: top.sort((a, b) => b.area - a.area).slice(0, 30) } : {}),
    }
  }, [selector, DETAIL])
}

// T-M46-17: Alarmliste (.alerts) und Protokoll (.log) kommen dazu; fehlt der Bereich (keine Meldung), steht null.
const AREAS = { kopf: 'header', panel: 'aside', alarme: '.alerts', protokoll: '.log' }
async function measureViews(page, vp, name, stackProvince) {
  const out = {}
  const btn = (n, exact = true) => page.getByRole('button', { name: n, exact }).first()
  // Seit T-M46-17 ist der Knopf ein Zeichen und heisst „Auswählen: Armee N“ (vorher: sichtbares Wort „Auswählen“).
  const selectBtn = () => page.getByRole('button', { name: /^Auswählen(:|$)/ }).first()
  await btn('Nicht mehr zeigen').click({ timeout: 3000 }).catch(() => {})
  const snap = async (key) => {
    const row = {}
    for (const [k, sel] of Object.entries(AREAS)) row[k] = await measureArea(page, sel)
    out[key] = row
    if (SHOTS && SHOT_STATES.includes(name) && ['375x667', '1280x800'].includes(vp.tag)) {
      mkdirSync(resolve(SHOTS), { recursive: true })
      await page.screenshot({ path: join(resolve(SHOTS), `${name}-${key}-${vp.tag}.png`) })
    }
  }
  await snap('karte')
  // Wie ux-late.mjs „karte-brennpunkt“: ueber die Uebersichtskarte nach Asien, wo die Armeen stehen (T-M46-03).
  if (stackProvince) {
    const mini = page.locator('canvas.map-overview').first()
    const box = await mini.boundingBox().catch(() => null)
    if (box) {
      await mini.click({ position: { x: box.width * 0.72, y: box.height * 0.4 }, timeout: 4000 }).catch(() => {})
      await page.waitForTimeout(500)
      await snap('brennpunkt')
      const map = page.locator('.map-layer--overlay').first()
      const mb = await map.boundingBox().catch(() => null)
      if (mb) {
        await page.mouse.move(mb.x + mb.width / 2, mb.y + mb.height / 2)
        for (let i = 0; i < 4; i++) {
          await page.mouse.wheel(0, -240)
          await page.waitForTimeout(80)
        }
        await page.waitForTimeout(300)
        await snap('nah')
      }
    }
  }
  const picker = page.locator('aside select').first()
  const n = Math.min(await picker.locator('option').count(), 60)
  for (let i = 1; i < n; i++) {
    await picker.selectOption({ index: i }, { timeout: 5000 })
    await page.waitForTimeout(100)
    if (await selectBtn().isVisible().catch(() => false)) break
  }
  await snap('provinz')
  if (await selectBtn().isVisible().catch(() => false)) {
    await selectBtn().click({ timeout: 4000 })
    await page.waitForTimeout(300)
    await snap('armee')
  }
  return out
}

/** Armeemarker-Ueberdeckung mit `markersFor` aus dem Spielcode, ueber die Sicht der staerksten Macht. */
async function overlap(page, name) {
  return page.evaluate(
    async ({ origin, root, raw, nameArg }) => {
      const at = (p) => import(/* @vite-ignore */ `${origin}/@fs${root}/${p}`)
      const core = await at('packages/core/src/index.ts')
      const markers = await at('apps/desktop/src/map/markers.ts')
      const world = (await at('data/maps/world.json')).default
      const rules = core.parseRules(
        {
          constants: (await at('data/rules/default/constants.json')).default,
          resources: (await at('data/rules/default/resources.json')).default,
          buildings: (await at('data/rules/default/buildings.json')).default,
          units: (await at('data/rules/default/units.json')).default,
          ai: (await at('data/rules/default/ai.json')).default,
        },
        'default',
      )
      const state = core.deserialise(raw)
      const count = {}
      for (const id of state.provinceOrder) {
        const o = state.provinces[id].owner
        if (o) count[o] = (count[o] ?? 0) + 1
      }
      const viewer = nameArg.endsWith('G')
        ? Object.keys(count).sort((a, b) => count[b] - count[a])[0]
        : (state.playerOrder.find((p) => state.players[p].kind === 'human') ?? state.playerOrder[0])
      const view = core.publicView(state, viewer, rules)
      const centres = Object.fromEntries(world.provinces.map((p) => [p.id, p.center]))
      const armies = view.armies.map((army) => {
        const icon = army.units ? markers.dominantIcon(army.units.map((s) => ({ unitKey: s.unitKey, hp: s.hpTotal }))) : undefined
        const summary = army.units ? markers.stackSummary(army.units, rules) : null
        return {
          id: army.id,
          provinceId: army.provinceId,
          owner: army.owner,
          strength: army.strength,
          own: army.owner === viewer,
          ...(icon ? { icon } : {}),
          ...(summary ? { count: summary.count, condition: summary.condition } : {}),
        }
      })
      const W = markers.ARMY_BOX.width
      const H = markers.ARMY_BOX.height
      const result = { viewer, armies: armies.length, byScale: {} }
      const perProvince = {}
      for (const a of armies) perProvince[a.provinceId] = (perProvince[a.provinceId] ?? 0) + 1
      result.provincesWithStack = Object.values(perProvince).filter((c) => c > 1).length
      result.largestStack = Math.max(0, ...Object.values(perProvince))
      result.largestStackProvince = Object.keys(perProvince).sort((a, b) => perProvince[b] - perProvince[a])[0] ?? null
      for (const scale of [0.5, 1, 2, 4, 8]) {
        const list = markers.markersFor(armies, {}, centres, { x: 0, y: 0, scale }, {}).filter((m) => m.kind === 'army')
        let hidden = 0
        let partly = 0
        const boxes = list.map((m) => ({ l: m.x - W / 2, t: m.y - H / 2 }))
        for (let i = 0; i < boxes.length; i++) {
          const a = boxes[i]
          let covered = 0
          const total = 35
          for (let ix = 0; ix < 7; ix++) {
            for (let iy = 0; iy < 5; iy++) {
              const px = a.l + ((ix + 0.5) * W) / 7
              const py = a.t + ((iy + 0.5) * H) / 5
              for (let j = i + 1; j < boxes.length; j++) {
                const b = boxes[j]
                if (px >= b.l && px <= b.l + W && py >= b.t && py <= b.t + H) {
                  covered += 1
                  break
                }
              }
            }
          }
          if (covered === total) hidden += 1
          else if (covered > 0) partly += 1
        }
        result.byScale[scale] = { markers: list.length, fullyHidden: hidden, partlyCovered: partly }
      }
      return result
    },
    { origin: ORIGIN, root: ROOTFS, raw: readState(name), nameArg: name },
  )
}

const browser = await chromium.launch(process.platform === 'win32' ? { channel: 'msedge' } : {})
const result = { url: URL_, states: {} }
try {
  for (const name of STATES) {
    result.states[name] = { viewports: {} }
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 1,
        hasTouch: Math.min(vp.width, vp.height) < 600,
        isMobile: Math.min(vp.width, vp.height) < 600,
        locale: 'de-DE',
      })
      const page = await context.newPage()
      try {
        await openState(page, name)
        if (!result.states[name].overlap) result.states[name].overlap = await overlap(page, name)
        result.states[name].viewports[vp.tag] = await measureViews(page, vp, name, result.states[name].overlap.largestStackProvince)
      } catch (e) {
        result.states[name].viewports[vp.tag] = { error: String(e).split('\n')[0].slice(0, 200) }
      }
      await context.close()
    }
  }
} finally {
  await browser.close()
}
mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n')
console.log('geschrieben', OUT)
