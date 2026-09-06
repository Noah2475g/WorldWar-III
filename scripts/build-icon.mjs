#!/usr/bin/env node
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * The application icon, drawn rather than fetched (T-M16-03, R-ASSET-01).
 *
 * `tauri.conf.json` asks for `icons/icon.png` and there was no image file in the whole
 * project — the build fails on that first step and says nothing about the rest.
 * R-ASSET-01 forbids foreign assets, so the icon is generated here, from the very
 * colours the interface already uses (`apps/desktop/src/ui/tokens.ts`, direction A
 * "Lagekarte", approved 2026-09-03). A script rather than a drawing, because an asset
 * nobody can rebuild is an asset nobody can change.
 *
 * Windows needs a second file. `tauri-build` stops with "`icons/icon.ico` not found;
 * required for generating a Windows Resource file" — the .png alone does not build on
 * Windows, and that is not in the Tauri config anywhere. Both files come from the same
 * drawing here, which is the point of drawing it as maths instead of pixels: every size
 * is rendered rather than resampled.
 *
 * No dependency: PNG is a handful of length-prefixed chunks around a zlib stream, and
 * an ICO is a directory in front of a few PNGs. An image library for one flat drawing
 * would cost more than it saves.
 */

// --- The palette, copied from tokens.ts. Kept as literals on purpose: this script must
// --- run without the TypeScript toolchain, and the contrast test owns the originals.
const GROUND = [0xe4, 0xe0, 0xd2] // linen map ground
const WATER = [0xbf, 0xc9, 0xc6] // sea
const LINE = [0x8c, 0x86, 0x76] // province borders
const INK = [0x1f, 0x24, 0x20] // frame
const ACCENT = [0xb3, 0x34, 0x1e] // combat and alarm. Nothing else.

/** Samples per axis. Sixteen samples a pixel is plenty for straight edges. */
const AA = 4

/** Distance from point p to the segment a—b, in unit coordinates. */
function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const lengthSquared = dx * dx + dy * dy
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

/** Distance to a polyline: the smallest distance to any of its segments. */
function distanceToPath(px, py, points) {
  let best = Infinity
  for (let i = 0; i < points.length - 1; i++) {
    const d = distanceToSegment(px, py, points[i][0], points[i][1], points[i + 1][0], points[i + 1][1])
    if (d < best) best = d
  }
  return best
}

/** The sea corner, as a half-plane test: everything below the line through a and b. */
function belowLine(px, py, [ax, ay], [bx, by]) {
  return (bx - ax) * (py - ay) - (by - ay) * (px - ax) > 0
}

/** Province borders in map ink, kept away from the middle so the counter sits clear. */
const BORDERS = [
  [
    [0.24, 0.02],
    [0.19, 0.2],
    [0.02, 0.29],
  ],
  [
    [0.62, 0.02],
    [0.72, 0.19],
    [0.98, 0.23],
  ],
  [
    [0.28, 0.98],
    [0.34, 0.82],
    [0.16, 0.71],
  ],
]

const SEA_A = [0.62, 1.02]
const SEA_B = [1.02, 0.66]

const FRAME = 0.035
const BORDER_WIDTH = 0.011

/**
 * The unit counter, and it is the whole point of the icon.
 *
 * A rectangle with a diagonal cross is the map symbol for a body of troops, and it is
 * the one shape that says wargame at sixteen pixels without a single letter. The first
 * attempt drew a kinked front line instead and came out looking like a share price — a
 * rising red zigzag means something else entirely to everyone who has ever seen one.
 */
const COUNTER = { left: 0.2, right: 0.8, top: 0.33, bottom: 0.67 }
const COUNTER_EDGE = 0.022
const CROSS_WIDTH = 0.026

function insideRect(x, y, r, inset = 0) {
  return x > r.left + inset && x < r.right - inset && y > r.top + inset && y < r.bottom - inset
}

/** The colour of one sample, as a flat RGB triple. Order matters: last drawn wins. */
function sampleColour(x, y) {
  if (x < FRAME || y < FRAME || x > 1 - FRAME || y > 1 - FRAME) return INK

  let colour = belowLine(x, y, SEA_A, SEA_B) ? WATER : GROUND

  for (const border of BORDERS) {
    if (distanceToPath(x, y, border) < BORDER_WIDTH) colour = LINE
  }

  if (insideRect(x, y, COUNTER)) {
    colour = INK
    if (insideRect(x, y, COUNTER, COUNTER_EDGE)) {
      colour = ACCENT
      const a = distanceToSegment(x, y, COUNTER.left, COUNTER.top, COUNTER.right, COUNTER.bottom)
      const b = distanceToSegment(x, y, COUNTER.left, COUNTER.bottom, COUNTER.right, COUNTER.top)
      if (Math.min(a, b) < CROSS_WIDTH) colour = GROUND
    }
  }

  return colour
}

/** Render at any edge length. The drawing is maths, so small sizes are drawn, not shrunk. */
function render(size) {
  const pixels = Buffer.alloc(size * size * 4)
  const step = 1 / (size * AA)

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0
      let g = 0
      let b = 0
      for (let sy = 0; sy < AA; sy++) {
        for (let sx = 0; sx < AA; sx++) {
          const c = sampleColour((px * AA + sx + 0.5) * step, (py * AA + sy + 0.5) * step)
          r += c[0]
          g += c[1]
          b += c[2]
        }
      }
      const n = AA * AA
      const at = (py * size + px) * 4
      pixels[at] = Math.round(r / n)
      pixels[at + 1] = Math.round(g / n)
      pixels[at + 2] = Math.round(b / n)
      pixels[at + 3] = 255
    }
  }
  return pixels
}

// --- PNG ------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buffer) {
  let c = 0xffffffff
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function toPng(size, pixels) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // colour type: RGBA
  header[10] = 0 // deflate
  header[11] = 0 // adaptive filtering
  header[12] = 0 // no interlace

  // One filter byte (0, "None") in front of every scanline.
  const stride = size * 4 + 1
  const raw = Buffer.alloc(size * stride)
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0
    pixels.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// --- ICO ------------------------------------------------------------------------

/**
 * An ICO is a six-byte header, one sixteen-byte directory entry per image, then the
 * images. The entries carry PNG here rather than the older bitmap form: Windows has
 * read PNG entries since Vista, and a bitmap entry would need its own upside-down
 * scanline order and a mask plane for no gain.
 */
function toIco(images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // 1 = icon
  header.writeUInt16LE(images.length, 4)

  const directory = Buffer.alloc(16 * images.length)
  let offset = header.length + directory.length

  images.forEach(({ size, png }, index) => {
    const at = index * 16
    directory[at] = size >= 256 ? 0 : size // 0 means 256
    directory[at + 1] = size >= 256 ? 0 : size
    directory[at + 2] = 0 // palette size: none
    directory[at + 3] = 0 // reserved
    directory.writeUInt16LE(1, at + 4) // colour planes
    directory.writeUInt16LE(32, at + 6) // bits per pixel
    directory.writeUInt32LE(png.length, at + 8)
    directory.writeUInt32LE(offset, at + 12)
    offset += png.length
  })

  return Buffer.concat([header, directory, ...images.map((i) => i.png)])
}

// --- Ausgabe --------------------------------------------------------------------

const ICONS = join(fileURLToPath(new URL('..', import.meta.url)), 'apps/desktop/src-tauri/icons')
mkdirSync(ICONS, { recursive: true })

const write = (name, buffer) => {
  writeFileSync(join(ICONS, name), buffer)
  console.log(`  ${name.padEnd(16)} ${String(buffer.length).padStart(7)} Bytes`)
}

console.log('Symbol gezeichnet aus den Tokens der Oberflaeche:')

const main = render(512)
write('icon.png', toPng(512, main))

// Die Groessen, die Windows in Taskleiste, Explorer und Alt-Tab wirklich zeigt.
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]
write(
  'icon.ico',
  toIco(ICO_SIZES.map((size) => ({ size, png: toPng(size, render(size)) }))),
)

// Die beiden Groessen, die der Tauri-Bau ausserdem gern findet.
for (const size of [32, 128]) write(`${size}x${size}.png`, toPng(size, render(size)))
