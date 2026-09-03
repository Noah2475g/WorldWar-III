#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { project } from '../packages/mapgen/src/project.ts'

/**
 * Draws the built map, so a person can look at it (T-M9-02a).
 *
 * Every assertion in worldshapes.test.ts can pass on a map that is visibly wrong —
 * a province turned inside out, a country drawn as a spike across the Pacific, an
 * island group that ended up in the wrong hemisphere. Those are found by looking,
 * and looking needs a picture.
 *
 * Usage:  node scripts/preview-map.mjs [--out docs/design/world-preview.html]
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const at = process.argv.indexOf('--out')
const OUT = at === -1 ? join(ROOT, 'docs/design/world-preview.html') : process.argv[at + 1]

const world = JSON.parse(readFileSync(join(ROOT, 'data/maps/world-shapes.json'), 'utf8'))
const rules = JSON.parse(readFileSync(join(ROOT, 'data/mapgen/merge-rules.json'), 'utf8'))
const lanes = readFileSync(join(ROOT, 'data/maps/world-sealinks.csv'), 'utf8')
  .split('\n')
  .slice(1)
  .filter((line) => line.trim())
  .map((line) => line.split(','))

const W = 2000
const H = 1400
// Mercator runs to 85° north and south; the map is cropped to where people live.
const TOP = project({ lon: 0, lat: 78 }).y
const BOTTOM = project({ lon: 0, lat: -58 }).y

const toX = (lon) => project({ lon, lat: 0 }).x * W
const toY = (lat) => ((project({ lon: 0, lat }).y - TOP) / (BOTTOM - TOP)) * H

const startNations = new Set(Object.keys(rules.startNations.nations))

/** Six muted fills from the approved palette, plus grey for everyone else. */
const FILLS = ['#9FB2BE', '#C4A99C', '#B7BE9F', '#B5A6C0', '#D3C49B', '#9CC8B4']
const fillFor = (province) => {
  if (!startNations.has(province.country)) return '#D8D3C3'
  let hash = 0
  for (const char of province.country) hash = (hash * 31 + char.charCodeAt(0)) % 997
  return FILLS[hash % FILLS.length]
}

const paths = []
for (const province of world.provinces) {
  const polygons =
    province.geometry.type === 'MultiPolygon' ? province.geometry.coordinates : [province.geometry.coordinates]
  const d = polygons
    .map((polygon) =>
      polygon
        .map((ring) => {
          const points = ring.map(([lon, lat]) => `${toX(lon).toFixed(1)},${toY(lat).toFixed(1)}`)
          return `M${points.join('L')}Z`
        })
        .join(''),
    )
    .join('')
  paths.push(
    `<path d="${d}" fill="${fillFor(province)}" stroke="#8C8676" stroke-width="0.6"><title>${province.name} (${province.id}) · ${province.areaKm2.toLocaleString('de-DE')} km²</title></path>`,
  )
}

const centreOf = new Map(world.provinces.map((p) => [p.id, p.centre]))
const laneLines = lanes
  .map(([from, to, kind]) => {
    const a = centreOf.get(from)
    const b = centreOf.get(to)
    if (!a || !b) return ''
    // A lane across the date line would otherwise be drawn straight through the map.
    if (Math.abs(a.lon - b.lon) > 180) return ''
    const colour = kind === 'strait' ? '#B3341E' : '#5A6055'
    return `<line x1="${toX(a.lon).toFixed(1)}" y1="${toY(a.lat).toFixed(1)}" x2="${toX(b.lon).toFixed(1)}" y2="${toY(b.lat).toFixed(1)}" stroke="${colour}" stroke-width="${kind === 'strait' ? 2.5 : 1.2}" stroke-dasharray="6 5" opacity="0.75"/>`
  })
  .filter(Boolean)

const labels = world.provinces
  .filter((p) => p.areaKm2 > 400_000)
  .map(
    (p) =>
      `<text x="${toX(p.centre.lon).toFixed(1)}" y="${toY(p.centre.lat).toFixed(1)}" font-size="11" text-anchor="middle" fill="#2B302A" font-family="IBM Plex Sans Condensed, sans-serif">${escape(p.name)}</text>`,
  )

function escape(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const nations = Object.entries(rules.startNations.nations)
  .map(([, n]) => {
    const count = world.provinces.filter((p) => n.countries.includes(p.country)).length
    return `<li><b>${n.name}</b> <span>${count}</span></li>`
  })
  .join('')

const html = `<title>Weltkarte, gebaut</title>
<style>
  :root { --page:#EDEAE1; --card:#FAF8F3; --text:#22261F; --soft:#5C6157; --rule:#C8C3B4; --mark:#B3341E; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
    --page:#16181A; --card:#202326; --text:#E7E9E3; --soft:#A0A69B; --rule:#383C3F; --mark:#E0705A; } }
  :root[data-theme="dark"] { --page:#16181A; --card:#202326; --text:#E7E9E3; --soft:#A0A69B; --rule:#383C3F; --mark:#E0705A; }
  body { background:var(--page); color:var(--text); font-family:"IBM Plex Sans",system-ui,sans-serif; line-height:1.55; }
  .wrap { max-width:1180px; margin:0 auto; padding:32px 20px 72px; }
  h1 { font-size:32px; margin:0 0 6px; font-weight:600; letter-spacing:-0.01em; }
  p.lede { color:var(--soft); font-size:16px; max-width:62ch; margin:0 0 22px; }
  .figures { display:flex; gap:26px; flex-wrap:wrap; margin:0 0 22px; padding:14px 0; border-block:1px solid var(--rule); }
  .figures div { font-variant-numeric:tabular-nums; }
  .figures b { display:block; font-size:24px; font-family:"IBM Plex Mono",monospace; }
  .figures span { font-size:11px; letter-spacing:0.08em; text-transform:uppercase; color:var(--soft); }
  .map { background:#BFC9C6; border:1px solid var(--rule); border-radius:3px; overflow:hidden; }
  .map svg { display:block; width:100%; height:auto; }
  ul { list-style:none; padding:0; margin:20px 0 0; display:grid;
       grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:2px 16px; font-size:13px; }
  li { display:flex; justify-content:space-between; padding:3px 0; border-bottom:1px solid var(--rule); }
  li span { font-family:"IBM Plex Mono",monospace; color:var(--soft); }
  .legend { display:flex; gap:18px; font-size:12px; color:var(--soft); margin-top:10px; align-items:center; flex-wrap:wrap; }
  .legend i { display:inline-block; width:22px; height:0; border-top:2.5px dashed var(--mark); margin-right:5px; vertical-align:middle; }
  .legend i.sea { border-top:1.2px dashed var(--soft); }
  h2 { font-size:19px; margin:34px 0 0; font-weight:600; }
</style>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans+Condensed:wght@400;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<div class="wrap">
<h1>Die Weltkarte, wie sie jetzt gebaut ist</h1>
<p class="lede">Aus Natural Earth 1:10 Mio verschmolzen und vereinfacht. Jede Fläche ist eine
spielbare Provinz; farbig sind die Provinzen der 24 Startnationen, grau alles Übrige.
Zeigen Sie auf eine Fläche, um Name, Kennung und Größe zu sehen.</p>

<div class="figures">
  <div><b>${world.provinces.length}</b><span>Provinzen</span></div>
  <div><b>${Object.keys(rules.startNations.nations).length}</b><span>Startnationen</span></div>
  <div><b>${lanes.length}</b><span>Seewege</span></div>
  <div><b>${world.toleranceDegrees}°</b><span>Vereinfachung</span></div>
</div>

<div class="map"><svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Weltkarte mit ${world.provinces.length} Provinzen">
<g>${paths.join('')}</g>
<g>${laneLines.join('')}</g>
<g>${labels.join('')}</g>
</svg></div>
<div class="legend">
  <span><i></i>Meerenge — Engstelle, die eine Kampagne entscheidet</span>
  <span><i class="sea"></i>Seeweg</span>
  <span>Beschriftet sind Provinzen über 400 000 km².</span>
</div>

<h2>Startnationen und ihre Provinzen</h2>
<ul>${nations}</ul>
</div>
`

mkdirSync(join(ROOT, 'docs/design'), { recursive: true })
writeFileSync(OUT, html)
console.log(`${OUT} geschrieben (${(html.length / 1024 / 1024).toFixed(2)} MB)`)
