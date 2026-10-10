#!/usr/bin/env node
/**
 * axe mit vollem WCAG-2.2-Set (Seitenleiste v3b E3, D30; DR t_cc59e67e Auflage A3).
 *
 * `ux-capture.mjs` prueft seit M44 mit den Tags wcag2a/2aa/21a/21aa — damit bleibt der Vergleich mit B0
 * gleich. Dieses Skript laeuft daneben mit dem ganzen Satz (wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa)
 * ueber die Szenen der Seitenleiste: Start (zu), jeder Bereich der Leiste rechts offen, Provinz offen.
 *
 *   node scripts/ux-axe-full.mjs --url http://localhost:5361/ --out docs/ux/v4-seitenleiste/e3/axe-voll.json
 *                                [--viewport 1280x800]
 *
 * Erwartet einen laufenden Dev-Server unter --url (eigener Port, WORKFLOW Falle 9). Exit 1 bei einem
 * Verstoss, damit `--check`-Laeufe ihn nicht uebersehen.
 */
/* global document */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { chromium } from 'playwright'
import AxeBuilderModule from '@axe-core/playwright'
import { RAIL_ITEM } from './ux-sel.mjs'

const AxeBuilder = AxeBuilderModule.default ?? AxeBuilderModule
export const AXE_TAGS_FULL = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
export const AREAS = ['diplomacy', 'market', 'armies', 'espionage', 'standings', 'economy', 'log']

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name)
  return i > 0 ? process.argv[i + 1] : fallback
}
const url = arg('--url', 'http://localhost:5361/')
const out = arg('--out', null)
const [width, height] = arg('--viewport', '1280x800').split('x').map(Number)

async function scan(page) {
  const r = await new AxeBuilder({ page }).withTags(AXE_TAGS_FULL).analyze()
  return {
    passes: r.passes.length,
    violations: r.violations.length,
    nodes: r.violations.reduce((s, v) => s + v.nodes.length, 0),
    byRule: r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, samples: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) })),
  }
}

const browser = await chromium.launch()
const result = { url, viewport: `${width}x${height}`, tags: AXE_TAGS_FULL, scenes: {} }
try {
  const context = await browser.newContext({ viewport: { width, height } })
  const page = await context.newPage()
  await page.goto(url)
  await page.getByRole('button', { name: 'Partie beginnen', exact: true }).click({ timeout: 30000 })
  await page.getByRole('button', { name: 'Nicht mehr zeigen' }).click({ timeout: 3000 }).catch(() => {})
  await page.waitForTimeout(500)
  result.scenes.zu = await scan(page)
  for (const area of AREAS) {
    await page.locator(RAIL_ITEM(area)).first().click({ timeout: 5000 })
    await page.waitForTimeout(400)
    result.scenes[area] = await scan(page)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  }
  const picker = page.locator('.picker select').first()
  await picker.selectOption({ index: 1 }, { timeout: 5000 })
  await page.waitForTimeout(400)
  result.scenes.provinz = await scan(page)
  result.total = Object.values(result.scenes).reduce((s, v) => s + v.violations, 0)
  result.open = await page.evaluate(() => document.querySelector('aside.side')?.getAttribute('data-open'))
} finally {
  await browser.close()
}
if (out) {
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`)
}
console.log(JSON.stringify({ total: result.total, scenes: Object.fromEntries(Object.entries(result.scenes).map(([k, v]) => [k, v.violations])) }))
process.exit(result.total > 0 ? 1 : 0)
