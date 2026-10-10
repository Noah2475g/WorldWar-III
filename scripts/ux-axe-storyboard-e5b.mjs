import { chromium } from 'playwright'
import AxeBuilderModule from '@axe-core/playwright'
import { resolve } from 'node:path'
const AxeBuilder = AxeBuilderModule.default ?? AxeBuilderModule
const files = [
  'docs/ux/v4-seitenleiste/e5/storyboard-recruitsheet.html',
  'docs/ux/v4-seitenleiste/e5/storyboard-provincepopup.html',
]
const browser = await chromium.launch()
const context = await browser.newContext()
const page = await context.newPage()
for (const f of files) {
  await page.goto('file://' + resolve(f))
  const r = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze()
  const critical = r.violations.filter(v => v.impact === 'critical' || v.impact === 'serious')
  console.log(f, 'violations:', r.violations.length, 'critical/serious:', critical.length)
  if (critical.length) console.log(JSON.stringify(critical.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.length})), null, 2))
}
await browser.close()
