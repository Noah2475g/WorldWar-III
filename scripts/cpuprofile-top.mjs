#!/usr/bin/env node
/**
 * Wertet ein `.cpuprofile` aus (P0-A.3 der V3): Anteile je Funktion, keine Millisekunden.
 *
 *   node scripts/cpuprofile-top.mjs <datei.cpuprofile> <Stand> [--merge docs/reports/v3/profil-<Stand>.json]
 *
 * Eigene Zeit je Funktion (self) als Anteil an allen Proben des Profils, dazu die Summe je Paket
 * (ai, core, shared), die Top-15-Funktionen und die Top-Quelldateien.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const [, , file, stand, ...rest] = process.argv
const mergeAt = rest.includes('--merge') ? rest[rest.indexOf('--merge') + 1] : null
const prof = JSON.parse(readFileSync(file, 'utf8'))
const byId = new Map(prof.nodes.map((n) => [n.id, n]))
const self = new Map()
const dt = prof.timeDeltas
for (let i = 0; i < prof.samples.length; i++) self.set(prof.samples[i], (self.get(prof.samples[i]) ?? 0) + (dt[i] ?? 0))
const total = [...self.values()].reduce((a, b) => a + b, 0)
const rel = (u) =>
  u
    .replace(/^file:\/\/\//, '')
    .split('\\')
    .join('/')
    .replace(/^.*\/(packages\/[^/]+\/src\/.*)$/, '$1')
const fns = new Map()
const files = new Map()
for (const [id, t] of self) {
  const cf = byId.get(id).callFrame
  const f = rel(cf.url) || '(nativ)'
  const key = `${cf.functionName || '(anonym)'} ${f}:${cf.lineNumber + 1}`
  fns.set(key, (fns.get(key) ?? 0) + t)
  files.set(f, (files.get(f) ?? 0) + t)
}
const share = (t) => +(t / total).toFixed(4)
const pkg = (re) => share([...files.entries()].filter(([f]) => re.test(f)).reduce((s, [, t]) => s + t, 0))
const result = {
  samples: prof.samples.length,
  top15Self: [...fns.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([fn, t]) => ({ fn, share: share(t) })),
  packageShares: { ai: pkg(/^packages\/ai\/src\//), core: pkg(/^packages\/core\/src\//), shared: pkg(/^packages\/shared\/src\//) },
  topFiles: [...files.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([f, t]) => ({ file: f, share: share(t) })),
}
console.log(JSON.stringify(result, null, 2))
if (mergeAt && existsSync(mergeAt)) {
  const doc = JSON.parse(readFileSync(mergeAt, 'utf8'))
  doc.cpuShares = { stand, ...result }
  writeFileSync(mergeAt, JSON.stringify(doc, null, 2) + '\n')
}
