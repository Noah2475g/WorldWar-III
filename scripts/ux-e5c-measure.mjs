#!/usr/bin/env node
/* Messung E5c: Storyboard-HTML (RecruitSheet, ProvincePopup) ueber 4 Aufloesungen.
 * WICHTIG: misst die isolierten Storyboard-Dateien, NICHT die Live-App (App.tsx-Verdrahtung
 * folgt erst in t_fe5f8bd0). Schreibt Screenshots nach docs/ux/v4-seitenleiste/e5/ und
 * eine layout-e5c.json mit Zaehlwerten (Pixel-Breiten der .recruit-sheet / .province-popup Boxen).
 *
 *   node scripts/ux-e5c-measure.mjs
 */
import { chromium } from 'playwright'
import { resolve } from 'node:path'
import { writeFileSync } from 'node:fs'

const FILES = [
  { tag: 'recruitsheet', path: 'docs/ux/v4-seitenleiste/e5/storyboard-recruitsheet.html' },
  { tag: 'provincepopup', path: 'docs/ux/v4-seitenleiste/e5/storyboard-provincepopup.html' },
]
const VIEWPORTS = [
  { width: 320, height: 640, tag: '320x640' },
  { width: 768, height: 1024, tag: '768x1024' },
  { width: 1024, height: 768, tag: '1024x768' },
  { width: 1920, height: 1080, tag: '1920x1080' },
]
const OUT = resolve('docs/ux/v4-seitenleiste/e5')

const browser = await chromium.launch()
const results = []
for (const vp of VIEWPORTS) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
  const page = await context.newPage()
  for (const f of FILES) {
    await page.goto('file://' + resolve(f.path))
    const shotPath = resolve(OUT, `e5c-${f.tag}-${vp.tag}.png`)
    await page.screenshot({ path: shotPath, fullPage: true })
    const boxes = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('.stage'))
      return els.map((el) => {
        const r = el.getBoundingClientRect()
        return { w: Math.round(r.width), h: Math.round(r.height) }
      })
    })
    results.push({ viewport: vp.tag, file: f.tag, screenshot: shotPath, stageBoxes: boxes })
    console.log(vp.tag, f.tag, '->', shotPath, JSON.stringify(boxes))
  }
  await context.close()
}
await browser.close()
writeFileSync(resolve(OUT, 'layout-e5c.json'), JSON.stringify(results, null, 2))
console.log('Fertig:', resolve(OUT, 'layout-e5c.json'))
