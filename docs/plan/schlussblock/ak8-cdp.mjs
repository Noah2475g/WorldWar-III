// AK-8 am gebauten Programm messen, gesteuert über CDP (WebView2 Remote-Debugging).
// Aufruf: node ak8-cdp.mjs <pfad-zur-worldwar.exe> <ausgabe-ordner>
// Vorbedingung (prüft das Skript selbst): %APPDATA%\de.noahhaumersen.worldwar\saves ist leer oder fehlt.
// Nichts wird gelöscht; das Skript beendet nur die Prozesse, die es selbst gestartet hat.
//
// Sieben Schritte, dieselben wie in docs/reports/packaging.md: Start ohne Weiterspielen →
// Partie beginnen → Strg+S und Stand 1 speichern → beenden → neu starten → Spielstände
// prüfen → Weiterspielen. Jeder Schritt schreibt seinen Beleg nach ak8-ergebnis.json.
//
// Zwei Dinge, die beim ersten Lauf am 2026-09-14 auffielen und hier festgehalten sind:
//   1. Der Spielstände-Dialog erscheint LEER und füllt seine Zeilen erst danach (listSlots
//      ist asynchron). Wer sofort nach dem Dialogtitel klickt, findet keinen Knopf —
//      deshalb wartet Schritt 3 auf `li.slot`, nicht auf den Titel.
//   2. Es gibt zehn Zeilen mit je einem Knopf „Speichern"; der Text allein trifft also
//      nicht die Zeile „Stand 1". Geklickt wird über die Zeile, nicht über die Reihenfolge.
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
/** Nur der Rumpf des Dialogs — der Kopf trägt das Kreuz „×", das kein Angebot an den Spieler ist. */
const dialogBodyTexts = `[...(document.querySelector('[role="dialog"] .dialog__body')?.querySelectorAll('button') ?? [])].filter(b => b.offsetParent !== null).map(b => b.textContent.trim())`
const clickByText = (re) => `(() => { const b = [...document.querySelectorAll('button')].find(b => b.offsetParent !== null && ${re}.test(b.textContent.trim())); if (!b || b.disabled) return false; b.click(); return b.textContent.trim() })()`
/** Die Zeilen des Spielstände-Dialogs, so wie sie dastehen: „Stand 1 — Tag 3", „Laden" gesperrt. */
const slotRows = `[...document.querySelectorAll('li.slot')].map(li => ({ label: li.querySelector('.slot__label')?.textContent.trim() ?? '', buttons: [...li.querySelectorAll('button')].map(b => ({ text: b.textContent.trim(), disabled: b.disabled })) }))`
/** Klick auf einen Knopf EINER Zeile — zehn Zeilen tragen denselben Knopftext. */
const clickInSlot = (labelRe, buttonRe) => `(() => {
  const li = [...document.querySelectorAll('li.slot')].find(li => ${labelRe}.test(li.querySelector('.slot__label')?.textContent.trim() ?? ''))
  if (!li) return false
  const b = [...li.querySelectorAll('button')].find(b => b.offsetParent !== null && ${buttonRe}.test(b.textContent.trim()))
  if (!b || b.disabled) return false
  b.click()
  return li.querySelector('.slot__label')?.textContent.trim()
})()`
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

/** Wartet, bis der Spielstände-Dialog seine Zeilen nachgeladen hat, und gibt sie zurück. */
async function waitForSlots(cdp, what) {
  await waitFor(cdp, `${bodyText}.includes('Spielstände')`, `${what}: Dialogtitel`)
  const rows = await waitFor(cdp, `(() => { const r = ${slotRows}; return r.length ? JSON.stringify(r) : '' })()`, `${what}: Zeilen`, 15000)
  return JSON.parse(rows)
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
  const texts1 = await evaluate(cdp, dialogBodyTexts)
  note('1 Start', !texts1.some((t) => t.startsWith('Weiterspielen')), `Knöpfe des Startdialogs: ${texts1.join(' | ')}`)
  await screenshot(cdp, '1-start')

  // 2 — Partie beginnen
  const started = await evaluate(cdp, clickByText(/^Partie beginnen$/))
  await waitFor(cdp, `/Tag \\d+/.test(${bodyText})`, 'laufende Partie')
  const clock2 = await evaluate(cdp, `(/Tag \\d+ · \\d\\d:\\d\\d/.exec(${bodyText}) || [''])[0]`)
  note('2 Partie beginnen', Boolean(started), `geklickt: ${started}; Uhr: ${clock2}`)
  await screenshot(cdp, '2-partie')

  // 3 — Strg+S, Stand 1 speichern
  for (const type of ['rawKeyDown', 'keyUp']) {
    await cdp.send('Input.dispatchKeyEvent', { type, key: 's', code: 'KeyS', windowsVirtualKeyCode: 83, modifiers: 2 })
  }
  // Der Dialog erscheint leer und füllt sich erst — auf die Zeilen warten, nicht auf den Titel.
  const rowsBefore = await waitForSlots(cdp, 'Spielstände-Dialog')
  const saved = await evaluate(cdp, clickInSlot(/^Stand 1\b/, /^Speichern$/))
  const savedMsg = await waitFor(cdp, `${bodyText}.includes('Gespeichert.') && /Stand 1 — Tag \\d+/.exec(${bodyText})?.[0]`, 'Gespeichert + Zeile Stand 1', 15000).catch((e) => String(e))
  const files = savesFiles()
  note('3 Speichern', Boolean(saved) && /Stand 1 — Tag/.test(String(savedMsg)) && files.some((f) => f.name.startsWith('stand-1')),
    `Zeile vorher: ${rowsBefore[0]?.label}; geklickt in Zeile: ${saved}; Zeile danach: ${savedMsg}; Platte: ${files.map((f) => `${f.name} (${f.size} B)`).join(', ')}`)
  await screenshot(cdp, '3-gespeichert')
  cdp.close()

  // 4 — Programm beenden
  killTree(run1.child)
  await sleep(3000)
  note('4 Beenden', savesFiles().length > 0, `Dateien bleiben: ${savesFiles().map((f) => f.name).join(', ')}`)

  // 5 — Neustart: „Weiterspielen (Tag N)" ist der ERSTE Knopf des Startdialogs (T-M22-04)
  run2 = await launch()
  cdp = await connect(run2.page.webSocketDebuggerUrl)
  const startTexts = JSON.parse(await waitFor(cdp, `(() => { const b = ${dialogBodyTexts}; return b.length ? JSON.stringify(b) : '' })()`, 'Startdialog nach dem Neustart'))
  const resume = startTexts[0] ?? ''
  note('5 Neustart', /^Weiterspielen \(Tag \d+\)$/.test(resume), `Knöpfe in dieser Reihenfolge: ${startTexts.join(' | ')}`)
  await screenshot(cdp, '5-neustart')

  // 6 — Spielstände: die Zeile steht da, „Laden" ist frei; danach zurück zum Startdialog
  const opened = await evaluate(cdp, clickByText(/^Spielstände$/))
  const rowsAfter = await waitForSlots(cdp, 'Spielstände nach dem Neustart')
  const stand1 = rowsAfter.find((r) => /^Stand 1\b/.test(r.label))
  const loadFree = stand1?.buttons.some((b) => b.text === 'Laden' && !b.disabled) === true
  note('6 Spielstände', Boolean(opened) && /^Stand 1 — Tag \d+$/.test(stand1?.label ?? '') && loadFree,
    `Zeile: ${stand1?.label}; Knöpfe: ${stand1?.buttons.map((b) => `${b.text}${b.disabled ? ' (gesperrt)' : ''}`).join(' / ')}`)
  await screenshot(cdp, '6-spielstaende')
  await evaluate(cdp, clickByText(/^×$/))
  await waitFor(cdp, `${bodyText}.includes('Partie beginnen')`, 'zurück im Startdialog')

  // 7 — Weiterspielen: die Partie läuft am gespeicherten Tag weiter
  const clicked = await evaluate(cdp, clickByText(/^Weiterspielen \(Tag \d+\)$/))
  await waitFor(cdp, `/Tag \\d+/.test(${bodyText}) && !${bodyText}.includes('Partie beginnen')`, 'geladene Partie')
  const clock = await evaluate(cdp, `(/Tag \\d+ · \\d\\d:\\d\\d/.exec(${bodyText}) || [''])[0]`)
  note('7 Weiterspielen', Boolean(clicked) && clock !== '', `geklickt: ${clicked}; Uhr: ${clock}`)
  await screenshot(cdp, '7-geladen')
  cdp.close()
} catch (e) {
  note('ABBRUCH', false, String(e?.message ?? e))
} finally {
  if (run1) killTree(run1.child)
  if (run2) killTree(run2.child)
  writeFileSync(join(outDir, 'ak8-ergebnis.json'), JSON.stringify({ exe, measuredAt: new Date().toISOString(), steps: log, saves: savesFiles() }, null, 2))
  const ok = log.length >= 7 && log.every((l) => l.ok)
  console.log(ok ? 'AK-8 ERFÜLLT' : 'AK-8 NICHT BELEGT — siehe Schritte')
  process.exit(ok ? 0 : 1)
}
