#!/usr/bin/env node
/* global getComputedStyle */
/**
 * Stichprobe der von axe als „unvollstaendig“ gemeldeten Kontrastknoten (T-M44-17, R-UX-06/AK1, B-23).
 *
 * axe kann bei Knoten mit Hintergrundverlauf, Ueberlagerung oder Animation den Kontrast nicht
 * entscheiden und meldet sie als `incomplete`. Dieses Skript holt davon mindestens `--count` (Vorgabe 24,
 * verteilt ueber Zustaende), liest Vorder- und Hintergrundfarbe aus der berechneten Gestaltung des Knotens
 * und seiner Vorfahren (der erste nicht durchsichtige Hintergrund) und rechnet das WCAG-Verhaeltnis selbst.
 * Es schreibt nichts ins Repository; die Tabelle gehoert in den UX-PLAN.
 *
 *   node scripts/ux-contrast-sample.mjs --url http://localhost:5341/ [--count 24]
 */
import AxeBuilder from '@axe-core/playwright'
import { chromium } from 'playwright'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : fallback
}
const URL_ = arg('url', 'http://localhost:5341/')
const COUNT = Number(arg('count', '24'))

const browser = await chromium.launch(process.platform === 'win32' ? { channel: 'msedge' } : {})
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
const page = await context.newPage()
await page.goto(URL_)
await page.getByRole('button', { name: 'Partie beginnen' }).click()
await page.getByRole('button', { name: 'Pause' }).waitFor({ timeout: 30000 })
await page.waitForTimeout(800)

const rows = []
const states = [
  ['Start', async () => {}],
  ['Provinz', async () => {
    await page.locator('aside select').first().selectOption({ index: 2 })
    await page.waitForTimeout(400)
  }],
  ['Diplomatie', async () => {
    await page.getByRole('button', { name: 'Diplomatie' }).click()
    await page.waitForTimeout(400)
  }],
  ['Markt', async () => {
    await page.getByRole('button', { name: 'Markt' }).click()
    await page.waitForTimeout(400)
  }],
]
for (const [state, enter] of states) {
  await enter()
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  for (const item of result.incomplete.filter((i) => i.id === 'color-contrast')) {
    for (const node of item.nodes) {
      const target = node.target[0]
      const data = await page
        .locator(target)
        .first()
        .evaluate((el) => {
          const parse = (c) => {
            const m = /rgba?\(([^)]+)\)/.exec(c)
            if (!m) return null
            const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number)
            return { r, g, b, a }
          }
          const lum = ({ r, g, b }) => {
            const f = (v) => {
              const s = v / 255
              return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
            }
            return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
          }
          let bg = null
          for (let n = el; n && !bg; n = n.parentElement) {
            const c = parse(getComputedStyle(n).backgroundColor)
            if (c && c.a > 0.99) bg = c
          }
          const fg = parse(getComputedStyle(el).color)
          if (!fg || !bg) return null
          const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a)
          const text = (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 32)
          return { text, fg: `rgb(${fg.r},${fg.g},${fg.b})`, bg: `rgb(${bg.r},${bg.g},${bg.b})`, ratio: +((hi + 0.05) / (lo + 0.05)).toFixed(2), size: getComputedStyle(el).fontSize }
        })
        .catch(() => null)
      if (data && data.text) rows.push({ state, target: target.slice(0, 40), ...data })
    }
  }
}
await browser.close()

const picked = []
const seen = new Set()
for (const r of rows) {
  const key = `${r.state}|${r.text}|${r.fg}|${r.bg}`
  if (seen.has(key)) continue
  seen.add(key)
  picked.push(r)
}
const sample = picked.slice(0, Math.max(COUNT, 20))
console.log(`unvollstaendige Knoten gelesen: ${rows.length}, verschiedene (je Zustand und Text): ${picked.length}, Stichprobe: ${sample.length}`)
const below = sample.filter((r) => r.ratio < 4.5)
for (const r of sample) console.log(`${r.ratio >= 4.5 ? 'ok ' : 'ZU NIEDRIG'} ${r.ratio}\t${r.state}\t${r.size}\t${r.fg} auf ${r.bg}\t${r.text}`)
console.log(`unter 4,5:1: ${below.length}`)
process.exitCode = below.length > 0 ? 1 : 0
