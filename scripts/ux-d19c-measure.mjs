#!/usr/bin/env node
/* Messung D19c (t_17b9deb7, Schritt 6): belegt an der LIVE-App (Dev-Server, Desktop-Breiten),
 * dass Provinz-/Armee-Wahl die Seitenleiste NICHT mehr oeffnet (data-side-open bleibt 'false',
 * .map-tools-col nicht verschoben) und misst K1 (scrollHeight/clientHeight) fuer `.dock` in
 * beiden Zustaenden — erweitert den E5-Messordner aus E5c (docs/ux/v4-seitenleiste/e5/) um den
 * nach D19c geschlossenen Zustand.
 *
 *   node scripts/ux-d19c-measure.mjs
 */
import { chromium } from 'playwright'
import { resolve } from 'node:path'
import { writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'

const PORT = 5431
const ROOT = resolve(import.meta.dirname, '..')
const OUT = resolve(ROOT, 'docs/ux/v4-seitenleiste/e5')
const VIEWPORTS = [
  { width: 1280, height: 800, tag: '1280x800' },
  { width: 1920, height: 1080, tag: '1920x1080' },
]

function waitForServer(url, tries = 60) {
  return new Promise((done, fail) => {
    const tick = (n) => {
      // eslint-disable-next-line no-undef -- Node >= 18 globaler fetch, Lint-Globals-Liste kennt ihn nicht.
      fetch(url)
        .then(() => done())
        .catch(() =>
          // eslint-disable-next-line no-undef -- Node-globales setTimeout, siehe oben.
          n <= 0 ? fail(new Error('Dev-Server antwortet nicht: ' + url)) : setTimeout(() => tick(n - 1), 500),
        )
    }
    tick(tries)
  })
}

const viteBin = resolve(ROOT, 'node_modules', 'vite', 'bin', 'vite.js')
const child = spawn(process.execPath, [viteBin, '--port', String(PORT), '--strictPort'], {
  cwd: resolve(ROOT, 'apps/desktop'),
  stdio: ['ignore', 'pipe', 'pipe'],
})
child.stdout.on('data', (d) => process.stdout.write(`[vite] ${d}`))
child.stderr.on('data', (d) => process.stderr.write(`[vite!] ${d}`))
process.on('exit', () => {
  try {
    if (child.pid) process.kill(child.pid)
  } catch {
    // schon weg
  }
})

try {
  const url = `http://localhost:${PORT}/`
  await waitForServer(url)

  const browser = await chromium.launch()
  const results = []
  try {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
      const page = await context.newPage()
      await page.goto(url, { waitUntil: 'load' })
      await page.getByRole('button', { name: 'Partie beginnen' }).click()

      const readState = async (label) => ({
        label,
        dataSideOpen: await page.locator('.app').getAttribute('data-side-open'),
        mapToolsTransform: await page.locator('.map-tools-col').evaluate((el) => {
          // eslint-disable-next-line no-undef -- laeuft im Browser-Kontext der Seite (Playwright `page.evaluate`), nicht in Node.
          return getComputedStyle(el).transform
        }),
        dockState: await page.locator('.dock').getAttribute('data-state'),
        dockK1: await page.locator('.dock').evaluate((el) => {
          const h = el.clientHeight || 1
          return Math.round((el.scrollHeight / h) * 100) / 100
        }),
      })

      const leer = await readState('leer (Spielbeginn)')

      // Eigene Provinz waehlen (Dock-Picker, own-optgroup erster Eintrag).
      await page.locator('.picker select').first().selectOption({ index: 1 })
      const provinz = await readState('eigene Provinz gewaehlt')

      // Zurueck in den leeren Zustand, dann eine Armee waehlen (falls vorhanden).
      await page.locator('.picker select').first().selectOption({ index: 0 })
      const auswaehlenKnoepfe = page.getByRole('button', { name: /^Auswählen/ })
      let armee = null
      if ((await auswaehlenKnoepfe.count()) > 0) {
        await page.locator('.picker select').first().selectOption({ index: 1 })
        await auswaehlenKnoepfe.first().click()
        armee = await readState('eigene Armee gewaehlt')
      }

      const screenshotPath = resolve(OUT, `d19c-geschlossen-${vp.tag}.png`)
      await page.screenshot({ path: screenshotPath, fullPage: false })

      results.push({ viewport: vp.tag, screenshot: screenshotPath, leer, provinz, armee })
      console.log(vp.tag, JSON.stringify({ leer, provinz, armee }))
      await context.close()
    }
  } finally {
    await browser.close()
  }

  writeFileSync(resolve(OUT, 'layout-d19c.json'), JSON.stringify(results, null, 2))
  console.log('Fertig:', resolve(OUT, 'layout-d19c.json'))
} finally {
  try {
    if (child.pid) process.kill(child.pid)
  } catch {
    // schon weg
  }
}
