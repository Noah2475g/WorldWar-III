// AK-8 am gebauten Programm messen, gesteuert über CDP (WebView2 Remote-Debugging).
// Aufruf: node ak8-cdp.mjs <pfad-zur-worldwar.exe> <ausgabe-ordner>
// Vorbedingung (prüft das Skript selbst): %APPDATA%\de.noahhaumersen.worldwar\saves ist leer oder fehlt.
// Nichts wird gelöscht; das Skript beendet nur die Prozesse, die es selbst gestartet hat.
import { spawn, execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [, , exe, outDir] = process.argv
if (!exe || !outDir) { console.error('Aufruf: node ak8-cdp.mjs <exe> <ausgabe>'); process.exit(2) }
mkdirSync(outDir, { recursive: true })
const PORT = 9222
const savesDir = join(process.env.APPDATA, 'de.noahhaumersen.worldwar', 'saves')
const log = []
const note = (step, ok, detail) => { const line = { step, ok, detail }; log.push(line); console.log(`${ok ? 'OK  ' : 'FEHL'} ${step}: ${detail}`) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function savesFiles() {
  if (!existsSync(savesDir)) return []
  return readdirSync(savesDir).map((n) => ({ name: n, size: statSync(join(savesDir, n)).size }))
}

if (!existsSync(exe)) { console.error('ABBRUCH: exe fehlt', exe); process.exit(2) }
if (savesFiles().length > 0) { console.error('ABBRUCH: saves nicht leer — erst parken (umbenennen), nichts löschen', savesFiles()); process.exit(2) }

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
  child.kill()
  throw new Error('CDP-Port nicht erreichbar nach 60 s')
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url)
    let id = 0
    const pending = new Map()
    ws.onmessage = (ev) => { const msg = JSON.parse(ev.data); if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) } }
    ws.onerror = reject
    ws.onopen = () => resolve({
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

const buttonTexts = `[...document.querySelectorAll('button')].filter(b => b.offsetParent !== null).map(b => b.textContent.trim())`
const clickByText = (re) => `(() => { const b = [...document.querySelectorAll('button')].find(b => b.offsetParent !== null && ${re}.test(b.textContent.trim())); if (!b || b.disabled) return false; b.click(); return b.textContent.trim() })()`
const bodyText = `document.body.innerText`

async function waitFor(cdp, expression, what, timeoutMs = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const v = await evaluate(cdp, expression).catch(() => null)
    if (v) return v
    await sleep(500)
  }
  throw new Error(`Zeitüberschreitung beim Warten auf: ${what}`)
}

async function screenshot(cdp, name) {
  const r = await cdp.send('Page.captureScreenshot', { format: 'png' })
  if (r.result?.data) writeFileSync(join(outDir, `${name}.png`), Buffer.from(r.result.data, 'base64'))
}

function killTree(child) {
  try { execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' }) } catch { /* schon weg */ }
}

let run1, run2
try {
  // 1 — erster Start: Startdialog ohne „Weiterspielen"
  run1 = await launch()
  let cdp = await connect(run1.page.webSocketDebuggerUrl)
  await waitFor(cdp, `${bodyText}.includes('Partie beginnen')`, 'Startdialog')
  const texts1 = await evaluate(cdp, buttonTexts)
  note('1 Start', !texts1.some((t) => t.startsWith('Weiterspielen')), `Knöpfe: ${texts1.slice(0, 8).join(' | ')}`)
  await screenshot(cdp, '1-start')

  // 2 — Partie beginnen
  const started = await evaluate(cdp, clickByText(/^Partie beginnen$/))
  await waitFor(cdp, `/Tag \\d+/.test(${bodyText})`, 'laufende Partie')
  note('2 Partie beginnen', Boolean(started), `geklickt: ${started}`)
  await screenshot(cdp, '2-partie')

  // 3 — Strg+S, Stand 1 speichern
  for (const type of ['rawKeyDown', 'keyUp']) {
    await cdp.send('Input.dispatchKeyEvent', { type, key: 's', code: 'KeyS', windowsVirtualKeyCode: 83, modifiers: 2 })
  }
  await waitFor(cdp, `${bodyText}.includes('Spielstände')`, 'Spielstände-Dialog')
  const dialogBefore = await evaluate(cdp, buttonTexts)
  // Speichern-Knopf der ersten Zeile (Stand 1): erster sichtbarer Knopf mit Text „Speichern"
  const saved = await evaluate(cdp, clickByText(/^Speichern$/))
  const savedMsg = await waitFor(cdp, `${bodyText}.includes('Gespeichert.') && /Stand 1 — Tag \\d+/.exec(${bodyText})?.[0]`, 'Gespeichert + Zeile Stand 1', 15000).catch((e) => String(e))
  const files = savesFiles()
  note('3 Speichern', Boolean(saved) && /Stand 1 — Tag/.test(String(savedMsg)) && files.some((f) => f.name.startsWith('stand-1')),
    `Knöpfe vorher: ${dialogBefore.slice(0, 6).join(' | ')}; Zeile: ${savedMsg}; Platte: ${files.map((f) => `${f.name} (${f.size} B)`).join(', ')}`)
  await screenshot(cdp, '3-gespeichert')
  cdp.close()

  // 4 — Programm beenden
  killTree(run1.child)
  await sleep(3000)
  note('4 Beenden', savesFiles().length > 0, `Dateien bleiben: ${savesFiles().map((f) => f.name).join(', ')}`)

  // 5–7 — Neustart, „Weiterspielen (Tag N)", laden
  run2 = await launch()
  cdp = await connect(run2.page.webSocketDebuggerUrl)
  const resume = await waitFor(cdp, `(${buttonTexts}).find(t => /^Weiterspielen \\(Tag \\d+\\)$/.test(t))`, 'Weiterspielen-Knopf')
  note('5 Neustart', Boolean(resume), `erster Knopf: ${resume}`)
  await screenshot(cdp, '5-neustart')
  const clicked = await evaluate(cdp, clickByText(/^Weiterspielen \(Tag \d+\)$/))
  await waitFor(cdp, `/Tag \\d+/.test(${bodyText}) && !${bodyText}.includes('Partie beginnen')`, 'geladene Partie')
  const clock = await evaluate(cdp, `(/Tag \\d+ · \\d\\d:\\d\\d/.exec(${bodyText}) || [''])[0]`)
  note('7 Weiterspielen', Boolean(clicked), `Uhr: ${clock}`)
  await screenshot(cdp, '7-geladen')
  cdp.close()
} catch (e) {
  note('ABBRUCH', false, String(e?.message ?? e))
} finally {
  if (run1) killTree(run1.child)
  if (run2) killTree(run2.child)
  writeFileSync(join(outDir, 'ak8-ergebnis.json'), JSON.stringify({ exe, measuredAt: new Date().toISOString(), steps: log, saves: savesFiles() }, null, 2))
  const ok = log.length >= 6 && log.every((l) => l.ok)
  console.log(ok ? 'AK-8 ERFÜLLT' : 'AK-8 NICHT BELEGT — siehe Schritte')
  process.exit(ok ? 0 : 1)
}
