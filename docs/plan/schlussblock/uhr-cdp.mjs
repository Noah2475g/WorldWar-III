// Die Uhr bei Tempo 100 an der gebauten exe messen (Falle 18), gesteuert über CDP (WebView2 Remote-Debugging).
// Aufruf: node uhr-cdp.mjs --exe <pfad> --label <name> [--runs 5] [--port 9222] [--out docs/reports/v3/uhr-exe.json]
// Vorbedingung (prüft das Skript VOR jedem Start): %APPDATA%\de.noahhaumersen.worldwar\saves ist leer oder fehlt
// (Autosave schreibt bei Tempo 100 ~4x/s). Nichts wird gelöscht; beendet werden nur selbst gestartete Prozesse.
// Verfahren: Partie beginnen (Knopf in .dialog__foot), Taste „+“ siebenmal (SPEED_STOPS [0,1,2,5,10,25,50,100]),
// 10 s Echtzeit; Spielstunden der Kopfleiste und performance.now() im SELBEN Runtime.evaluate → Ticks/s.
// Jeder Lauf mit frisch gestartetem Programm, sichtbares Fenster (kein Headless, Falle 17).
import { spawn, execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const args = {}
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i]
  if (a.startsWith('--')) args[a.slice(2)] = process.argv[++i]
}
const exe = args.exe && resolve(args.exe)
const label = args.label
const runs = Number(args.runs ?? 5)
const PORT = Number(args.port ?? 9222)
const out = resolve(args.out ?? 'docs/reports/v3/uhr-exe.json')
const MEASURE_MS = 10_000
if (!exe || !label || !(runs >= 1)) {
  console.error('Aufruf: node uhr-cdp.mjs --exe <pfad> --label <name> [--runs 5] [--port 9222] [--out <json>]')
  process.exit(2)
}
const savesDir = join(process.env.APPDATA ?? '', 'de.noahhaumersen.worldwar', 'saves')
const savesFiles = () => (existsSync(savesDir) ? readdirSync(savesDir) : [])
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

if (!existsSync(exe)) { console.error('ABBRUCH: exe fehlt:', exe); process.exit(2) }
// Nur vor dem ersten Start: spätere Läufe sehen die Autosaves der eigenen Vorläufe (Datei des Messlaufs, nicht Noahs).
if (savesFiles().length > 0) {
  console.error('ABBRUCH: saves nicht leer — erst parken (umbenennen, SHA-256 notieren), nichts löschen:', savesFiles())
  process.exit(2)
}

function kill(child) {
  try { execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' }) } catch { /* schon weg */ }
}
async function launch() {
  const child = spawn(exe, [], {
    env: { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
    detached: false, stdio: 'ignore',
  })
  for (let i = 0; i < 60; i++) {
    await sleep(1000)
    try {
      const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()
      const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl)
      if (page) return { child, page }
    } catch { /* noch nicht bereit */ }
  }
  kill(child)
  throw new Error('CDP-Port nicht erreichbar nach 60 s')
}
function connect(url) {
  return new Promise((resolveP, reject) => {
    const ws = new WebSocket(url)
    let id = 0
    const pending = new Map()
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
    ws.onerror = reject
    ws.onopen = () => resolveP({
      send: (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) }),
      close: () => ws.close(),
    })
  })
}
async function evaluate(cdp, expression) {
  const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300))
  return r.result?.result?.value
}
async function waitFor(cdp, expression, what, timeoutMs = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const v = await evaluate(cdp, expression).catch(() => null)
    if (v) return v
    await sleep(500)
  }
  throw new Error(`Zeitüberschreitung beim Warten auf: ${what}`)
}
const bodyText = 'document.body.innerText'
// „Partie beginnen“ steht in der festen Fußzeile des Dialogs (.dialog__foot, Dialogs.tsx:166).
// Ältere exe (vor der festen Fußzeile, z. B. 7a6aa47) haben den Knopf ohne .dialog__foot — dann jeder sichtbare Knopf.
const clickStart = `(() => { const pick = (sel) => [...document.querySelectorAll(sel)].find(b => b.offsetParent !== null && /^Partie beginnen$/.test(b.textContent.trim())); const b = pick('.dialog__foot button') ?? pick('button'); if (!b || b.disabled) return false; b.click(); return true })()`
// Kopfleiste „Tag N · HH:MM“ und Zeitstempel im selben Aufruf → kein Rundlauf-Versatz.
const sample = `(() => { const t = performance.now(); const m = /Tag (\\d+) · (\\d\\d):(\\d\\d)/.exec(document.body.innerText); return m ? { t, hours: Number(m[1]) * 24 + Number(m[2]) + Number(m[3]) / 60 } : null })()`

async function pressPlus(cdp) {
  for (const type of ['keyDown', 'keyUp']) {
    await cdp.send('Input.dispatchKeyEvent', { type, key: '+', code: 'Equal', text: type === 'keyDown' ? '+' : undefined, windowsVirtualKeyCode: 187, modifiers: 8 })
  }
}

async function oneRun(n) {
  const { child, page } = await launch()
  try {
    const cdp = await connect(page.webSocketDebuggerUrl)
    await waitFor(cdp, `${bodyText}.includes('Partie beginnen')`, 'Startdialog')
    if (!(await evaluate(cdp, clickStart))) throw new Error('Knopf „Partie beginnen“ in .dialog__foot nicht gefunden/gesperrt')
    await waitFor(cdp, `/Tag \\d+ · \\d\\d:\\d\\d/.test(${bodyText}) && !${bodyText}.includes('Partie beginnen')`, 'laufende Partie')
    for (let i = 0; i < 7; i++) { await pressPlus(cdp); await sleep(150) }
    await sleep(1500) // Tempo einschwingen lassen
    const a = await evaluate(cdp, sample)
    await sleep(MEASURE_MS)
    const b = await evaluate(cdp, sample)
    cdp.close()
    if (!a || !b) throw new Error('Kopfleiste ohne Uhr gelesen')
    const ticksPerSecond = (b.hours - a.hours) / ((b.t - a.t) / 1000)
    return { run: n, ticksPerSecond: Math.round(ticksPerSecond * 100) / 100, hours: b.hours - a.hours, seconds: (b.t - a.t) / 1000 }
  } finally {
    kill(child)
    await sleep(3000)
  }
}

const stats = (list) => {
  const v = list.map((r) => r.ticksPerSecond).sort((x, y) => x - y)
  const med = v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2
  return { runs: v.length, min: v[0], median: Math.round(med * 100) / 100, max: v[v.length - 1] }
}

const results = []
let failed = null
for (let n = 1; n <= runs; n++) {
  try {
    const r = await oneRun(n)
    results.push(r)
    console.log(`Lauf ${n}/${runs}: ${r.ticksPerSecond.toFixed(2)} Ticks/s (${r.hours.toFixed(1)} h in ${r.seconds.toFixed(2)} s)`)
  } catch (e) { failed = `Lauf ${n}: ${e?.message ?? e}`; break }
}

if (results.length) {
  const s = stats(results)
  console.log(`${label}: ${s.runs} Läufe, Minimum ${s.min.toFixed(2)} / Median ${s.median.toFixed(2)} / Höchstwert ${s.max.toFixed(2)}`)
  mkdirSync(dirname(out), { recursive: true })
  let doc = { exes: {} }
  try { doc = JSON.parse(readFileSync(out, 'utf8')); doc.exes ??= {} } catch { /* neu */ }
  const stamped = results.map((r) => ({ ...r, measuredAt: new Date().toISOString() }))
  const all = [...(doc.exes[label]?.results ?? []), ...stamped]
  doc.exes[label] = { exe, results: all, summary: stats(all) }
  writeFileSync(out, JSON.stringify(doc, null, 2) + '\n')
  console.log('geschrieben:', out)
}
if (failed) { console.error('ABBRUCH:', failed); process.exit(1) }
