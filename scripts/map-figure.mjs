#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'

/**
 * Draws a section of a map file as an SVG, for the reports (T-M19-05).
 *
 * A screenshot would do the same job and none of it afterwards: it cannot be diffed, it
 * carries the whole interface along with the thing it is meant to show, and nobody can
 * tell a year later which build it came from. This reads a `world.json` and draws the
 * outlines it actually contains — so the figure is the data, not a picture of a window.
 *
 * Usage:  node scripts/map-figure.mjs <out.svg> <x> <y> <w> <h> <label>=<world.json> ...
 * Example: node scripts/map-figure.mjs docs/reports/x.svg 200 400 900 800 \
 *            "vorher=old.json" "nachher=data/maps/world.json"
 */

const [out, x0, y0, w, h, ...panels] = process.argv.slice(2)
if (!out || panels.length === 0) {
  console.error('Aufruf: node scripts/map-figure.mjs <out.svg> <x> <y> <w> <h> <label>=<datei> ...')
  process.exit(1)
}

const view = { x: Number(x0), y: Number(y0), w: Number(w), h: Number(h) }
const GAP = 40
const HEADER = 34

// The palette of the interface (apps/desktop/src/ui/tokens.ts), so the figure looks like
// the thing it documents rather than like a chart.
const PAPER = '#F2EEE3'
const WATER = '#BFC9C6'
const LAND = '#DAD5C6'
const LINE = '#8C8676'
const INK = '#1F2420'

const rings = (province) => province.polygons ?? [province.polygon]

function panel(label, path, offsetX) {
  const world = JSON.parse(readFileSync(path, 'utf8'))
  let points = 0
  const paths = []

  for (const province of world.provinces) {
    const parts = []
    for (const ring of rings(province)) {
      if (!ring || ring.length < 3) continue
      // Only what the section shows, so the file stays small and the figure honest.
      let touches = false
      for (const [px, py] of ring) {
        if (px >= view.x && px <= view.x + view.w && py >= view.y && py <= view.y + view.h) {
          touches = true
          break
        }
      }
      if (!touches) continue
      points += ring.length
      parts.push('M' + ring.map(([px, py]) => `${px - view.x} ${py - view.y}`).join('L') + 'Z')
    }
    if (parts.length > 0) paths.push(`<path d="${parts.join('')}"/>`)
  }

  return {
    points,
    svg:
      `<g transform="translate(${offsetX} ${HEADER})">` +
      `<rect width="${view.w}" height="${view.h}" fill="${WATER}"/>` +
      `<g fill="${LAND}" stroke="${LINE}" stroke-width="1.2" stroke-linejoin="round">` +
      paths.join('') +
      `</g>` +
      `<rect width="${view.w}" height="${view.h}" fill="none" stroke="${INK}" stroke-width="2"/>` +
      `</g>` +
      `<text x="${offsetX}" y="22" font-family="Georgia, serif" font-size="20" fill="${INK}">${label}</text>`,
  }
}

const parts = panels.map((argument, index) => {
  const at = argument.indexOf('=')
  const label = argument.slice(0, at)
  const built = panel(label, argument.slice(at + 1), index * (view.w + GAP))
  console.log(`${label}: ${built.points} Punkte im Ausschnitt`)
  return built.svg
})

const width = panels.length * view.w + (panels.length - 1) * GAP
const height = view.h + HEADER
// Rendered at most 960 px wide, so the figure fits a page without the reader zooming;
// the viewBox keeps the geometry, so nothing is lost by it.
const shown = Math.min(1, 960 / width)
const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" ` +
  `width="${Math.round(width * shown)}" height="${Math.round(height * shown)}">` +
  `<rect width="${width}" height="${height}" fill="${PAPER}"/>` +
  parts.join('') +
  `</svg>\n`

writeFileSync(out, svg)
console.log(`${out} geschrieben (${(svg.length / 1024).toFixed(0)} kB).`)
