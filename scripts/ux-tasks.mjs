#!/usr/bin/env node
/**
 * Aufgabenlaeufe auf dem Spaetspiel-Stand S300 (PLAN-V3 P0-B2, Bahn C).
 *
 * Fuehrt die acht haeufigsten Handlungen als Spieler aus -- Armee finden und bewegen, Armee teilen
 * und zusammenlegen, bauen, ausheben, Krieg erklaeren, Frieden anbieten, Handel anbieten, Spion
 * anwerben -- je einmal mit der Maus und einmal nur mit der Tastatur, und zaehlt dabei, was der
 * Spieler tun muss: Klicks, Tastendruecke, Bildlaeufe, Fehlwege. Die Zeit steht daneben
 * (Nebenwert, nicht lastfest: Regel 5 der V3).
 *
 *   pnpm dev --port 5351 --strictPort        # in einem zweiten Terminal
 *   node scripts/ux-tasks.mjs --url http://localhost:5351/ --preview-port 5352 \
 *        --out docs/ux/v3-before [--only army-move,build] [--mode maus|tastatur] [--prepare-only]
 *
 * --preview-port wird angenommen und ignoriert: die Laeufe brauchen den Dev-Server (die vorbereiteten
 *                 Staende kommen ueber IndexedDB, der Kern wird nicht geladen).
 *
 * ## Was gezaehlt wird
 *
 * Klicks     jeder Mausklick auf eine Bedienflaeche. Eine Auswahlliste (<select>) zaehlt zwei: Liste
 *            oeffnen, Wert waehlen -- so bedient sie ein Mensch mit der Maus.
 * Tasten     jeder Tastendruck (Tab, Eingabe, Pfeile, Buchstaben, Escape, Kurztasten). Wer in einer
 *            Auswahlliste tippt, zaehlt jeden Buchstaben.
 * Bildlaeufe jedes Mal, wenn das Ziel unterhalb der sichtbaren Flaeche liegt und der Spieler
 *            erst scrollen muss.
 * Fehlwege   Dinge, die der Spieler tut oder erlebt, ohne dem Ziel naeher zu kommen: eine
 *            Fehlermeldung (Hinweiszeile `notice--error|warn`), eine Bedienflaeche, die er
 *            anklickt und die gesperrt ist, eine Taste ohne Wirkung, ein Dialog, den er erst
 *            wieder oeffnen muss. Jeder Fehlweg steht mit Ort und Text in `fehlwege`.
 * Minimum    die kuerzeste Folge, die die Oberflaeche zulaesst (von Hand gezaehlt, steht im Lauf
 *            neben dem Ergebnis), damit "11 Klicks" einen Massstab hat.
 * Zeit       Wanduhr des Laufs in ms -- Nebenwert.
 *
 * Einrichtungsschritte (Stand laden, Einfuehrung schliessen, Vorbedingung herstellen) zaehlen nicht;
 * sie stehen in `einrichtung`.
 *
 * Vorbereiteter Stand: S300 ist ein Stand, in dem die menschliche Partei nichts gebaut und keine
 * Armee hat. Fuer die Armee-Handlungen und das Ausheben baut der Lauf einmalig (und ueber die
 * Oberflaeche, ohne den Kern anzufassen) eine Kaserne und hebt Infanterie aus, speichert den Stand
 * in Platz 2 und legt ihn im Temp-Ordner ab (`ux-tasks/S300-armeen.json`).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const flag = (name) => process.argv.includes(`--${name}`)
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const URL_ = arg('url', 'http://localhost:5351/')
const OUT = resolve(arg('out', 'docs/ux/v3-before'))
const ONLY = arg('only', '').split(',').filter(Boolean)
const MODES = arg('mode', 'maus,tastatur').split(',').filter(Boolean)
const CACHE = join(tmpdir(), 'ux-tasks')
const VP = { width: 1280, height: 800 }
const CLOCK = /Tag\s+([\d.]+)\s+·\s+(\d\d):00/

function findChromium() {
  if (process.env.UX_CHROMIUM) return { executablePath: process.env.UX_CHROMIUM }
  return process.platform === 'win32' ? { channel: 'msedge' } : {}
}

// ---------------------------------------------------------------------------------------
// Seite oeffnen und Staende laden
// ---------------------------------------------------------------------------------------

async function putState(page, text) {
  await page.evaluate(
    (t) =>
      new Promise((res, rej) => {
        const r = indexedDB.open('worldwar', 1)
        r.onupgradeneeded = () => {
          if (!r.result.objectStoreNames.contains('saves')) r.result.createObjectStore('saves')
        }
        r.onerror = () => rej(r.error)
        r.onsuccess = () => {
          const tx = r.result.transaction('saves', 'readwrite')
          tx.objectStore('saves').put(t, 'stand-1')
          tx.oncomplete = () => {
            r.result.close()
            res(true)
          }
          tx.onerror = () => rej(tx.error)
        }
      }),
    text,
  )
}

async function getSave(page, key) {
  return page.evaluate(
    (k) =>
      new Promise((res, rej) => {
        const r = indexedDB.open('worldwar', 1)
        r.onerror = () => rej(r.error)
        r.onsuccess = () => {
          const q = r.result.transaction('saves').objectStore('saves').get(k)
          q.onsuccess = () => {
            r.result.close()
            res(q.result ?? null)
          }
          q.onerror = () => rej(q.error)
        }
      }),
    key,
  )
}

/** Stand laden wie ein Spieler: Spielstaende > Laden (Platz 1). Einfuehrung schliessen. */
async function openState(browser, text) {
  const context = await browser.newContext({ viewport: VP, deviceScaleFactor: 1, locale: 'de-DE' })
  // Wie lange steht die Rueckmeldung "befohlen" im Bild? Die Seite meldet Anfang und Ende selbst.
  await context.addInitScript(() => {
    window.__ack = []
    let on = false
    const check = () => {
      const now = [...document.querySelectorAll('.action__pending')].some((e) => /befohlen/.test(e.textContent ?? ''))
      if (now !== on) {
        on = now
        window.__ack.push({ t: Math.round(performance.now()), on })
      }
    }
    const start = () => new MutationObserver(check).observe(document.body, { childList: true, subtree: true, characterData: true })
    if (document.body) start()
    else document.addEventListener('DOMContentLoaded', start)
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200)))
  await page.goto(URL_, { waitUntil: 'load' })
  await page.getByRole('button', { name: 'Partie beginnen' }).waitFor({ state: 'attached', timeout: 30000 })
  await putState(page, text)
  await page.getByRole('button', { name: 'Spielstände', exact: true }).first().click({ timeout: 10000 })
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: 'Laden', exact: true }).first().click({ timeout: 10000 })
  await page.waitForFunction((src) => new RegExp(src).test(document.body.innerText), CLOCK.source, { timeout: 60000 })
  await page.waitForTimeout(600)
  // Die Einfuehrung deckt die Karte links unten; die Laeufe messen das Spiel, nicht das Tutorial.
  await page.getByRole('button', { name: 'Nicht mehr zeigen' }).click({ timeout: 5000 }).catch(() => {})
  await page.waitForTimeout(300)
  // Der Fokus steht wie nach dem Laden eines Standes auf <body>.
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur())
  return { page, context, errors }
}

const gameClock = (page) =>
  page.evaluate((src) => {
    const m = new RegExp(src).exec(document.body.innerText)
    return m ? Number(m[1].split('.').join('')) * 24 + Number(m[2]) : null
  }, CLOCK.source)

/** Eine Weile bei Tempo 100 laufen lassen (Einrichtung, zaehlt nicht). */
async function runFor(page, ms) {
  await page.getByRole('button', { name: '100', exact: true }).first().click({ timeout: 5000 })
  await page.waitForTimeout(ms)
  await page.getByRole('button', { name: 'Pause', exact: true }).first().click({ timeout: 5000 })
  await page.waitForTimeout(150)
}

const asideText = (page) => page.evaluate(() => document.querySelector('aside.side')?.innerText ?? '')

// ---------------------------------------------------------------------------------------
// Messer: zaehlt, was der Spieler tut
// ---------------------------------------------------------------------------------------

class Run {
  constructor(page, id, mode, minimum) {
    this.page = page
    this.id = id
    this.mode = mode
    this.minimum = minimum
    this.klicks = 0
    this.tasten = 0
    this.tabs = 0
    this.bildlaeufe = 0
    this.fehlwege = []
    this.einrichtung = []
    this.acks = []
    this.schritte = []
    this.counting = false
    this.t0 = 0
  }

  start() {
    this.counting = true
    this.t0 = Date.now()
    this.klicks = this.tasten = this.tabs = this.bildlaeufe = 0
    this.fehlwege.length = 0
    this.schritte.length = 0
    this.acks.length = 0
    void this.page.evaluate(() => { window.__ack = [] })
  }

  stop() {
    this.counting = false
    this.ms = Date.now() - this.t0
  }

  /** Wie lange stand die Rueckmeldung "befohlen" im Bild (ms je Befehl); null = steht noch. */
  async ackDurations() {
    const log = await this.page.evaluate(() => window.__ack ?? [])
    const out = []
    let from = null
    for (const e of log) {
      if (e.on) from = e.t
      else if (from !== null) {
        out.push(e.t - from)
        from = null
      }
    }
    if (from !== null) out.push(null)
    return out
  }

  note(kind, label) {
    if (this.counting) this.schritte.push(`${kind}: ${label}`)
    else this.einrichtung.push(`${kind}: ${label}`)
  }

  detour(where, text) {
    if (this.counting) this.fehlwege.push({ wo: where, was: text })
  }

  /** Hinweiszeile lesen: ein Fehlschlag ist ein Fehlweg. */
  async checkNotice(where) {
    const n = await this.page.evaluate(() => {
      const el = document.querySelector('.notice--error, .notice--warn')
      const ok = /✓[^\n]*/.exec(document.body.innerText)
      return { bad: el ? { kind: el.className, text: (el.textContent ?? '').trim().slice(0, 200) } : null, ack: ok ? ok[0].slice(0, 120) : null }
    })
    if (n.ack && this.counting) this.acks.push(n.ack)
    if (n.bad) this.detour(where, `${n.bad.kind.includes('error') ? 'Fehler' : 'Warnung'}: ${n.bad.text}`)
    return n.bad
  }

  /** Ein Mausklick. Ist die Flaeche gesperrt, ist das ein Fehlweg (der Klick geschieht trotzdem nicht). */
  async click(locator, label, { scrollOk = true } = {}) {
    const loc = locator.first()
    await loc.waitFor({ state: 'attached', timeout: 8000 })
    // Liegt das Ziel ausserhalb des sichtbaren Teils (oder unter der Fusszeile), muss der Spieler scrollen.
    const hidden = await loc.evaluate((el) => {
      const r = el.getBoundingClientRect()
      const x = Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1)
      const y = Math.min(Math.max(r.top + r.height / 2, 1), innerHeight - 1)
      const hit = document.elementFromPoint(x, y)
      return !(hit && (el === hit || el.contains(hit) || hit.contains(el))) || r.top < 0 || r.bottom > innerHeight
    })
    if (hidden && scrollOk) {
      if (this.counting) this.bildlaeufe += 1
      this.note('Bildlauf', label)
      await loc.scrollIntoViewIfNeeded()
    }
    if (!(await loc.isEnabled())) {
      this.detour(label, 'Bedienflaeche gesperrt')
      this.note('Klick (gesperrt)', label)
      if (this.counting) this.klicks += 1
      return false
    }
    await loc.click({ timeout: 8000 })
    if (this.counting) this.klicks += 1
    this.note('Klick', label)
    await this.page.waitForTimeout(250)
    await this.checkNotice(label)
    return true
  }

  /** Klick auf eine Stelle der Karte (Pixel). */
  async clickAt(x, y, label) {
    await this.page.mouse.click(x, y)
    if (this.counting) this.klicks += 1
    this.note('Klick', label)
    await this.page.waitForTimeout(300)
    await this.checkNotice(label)
  }

  /** Auswahlliste mit der Maus: oeffnen und waehlen = zwei Klicks. */
  async pick(selectLoc, match, label) {
    const sel = selectLoc.first()
    await sel.waitFor({ state: 'attached', timeout: 8000 })
    const value = await sel.evaluate((el, m) => {
      const o = [...el.options].find((x) => x.text.trim().startsWith(m))
      return o ? o.value : null
    }, match)
    if (value === null) {
      this.detour(label, `Eintrag "${match}" fehlt in der Liste`)
      return false
    }
    await sel.selectOption(value, { timeout: 8000 })
    if (this.counting) this.klicks += 2
    this.note('Liste (2 Klicks)', `${label} = ${match}`)
    await this.page.waitForTimeout(300)
    await this.checkNotice(label)
    return true
  }

  async key(name, label) {
    // Einzelne Zeichen (auch Umlaute) werden getippt, benannte Tasten gedrueckt.
    if (name.length === 1) await this.page.keyboard.type(name)
    else await this.page.keyboard.press(name)
    if (this.counting) {
      this.tasten += 1
      if (name === 'Tab' || name === 'Shift+Tab') this.tabs += 1
    }
    this.note('Taste', `${name}${label ? ` (${label})` : ''}`)
    await this.page.waitForTimeout(120)
  }

  /** Beschreibung dessen, was den Fokus hat. */
  focusInfo() {
    return this.page.evaluate(() => {
      const el = document.activeElement
      if (!el || el === document.body) return { tag: 'body', name: '', cls: '' }
      const labelledBy = el.getAttribute('aria-labelledby')
      const labels = el.labels ? [...el.labels].map((l) => l.textContent).join(' ') : ''
      const isSel = el.tagName === 'SELECT'
      return {
        tag: el.tagName.toLowerCase(),
        name: isSel ? (el.getAttribute('aria-label') || (el.labels?.[0]?.firstChild?.textContent ?? el.labels?.[0]?.textContent ?? '').trim().split(String.fromCharCode(10))[0].slice(0, 40)) : (el.getAttribute('aria-label') || el.textContent || labels || el.getAttribute('title') || (labelledBy ? document.getElementById(labelledBy)?.textContent : '') || '').trim().slice(0, 80),
        cls: String(el.className?.baseVal ?? el.className ?? '').slice(0, 60),
        select: el.tagName === 'SELECT' ? (el.selectedOptions[0]?.text ?? '') : undefined,
      }
    })
  }

  /** Tab, bis das Ziel den Fokus hat (je Druck ein Zaehler). `test` bekommt {tag,name,cls}. */
  async tabTo(test, label, { max = 250, back = false } = {}) {
    for (let i = 0; i < max; i++) {
      await this.key(back ? 'Shift+Tab' : 'Tab')
      const f = await this.focusInfo()
      if (test(f)) {
        this.note('Fokus', `${label} nach ${i + 1} ${back ? 'Umschalt+Tab' : 'Tab'}`)
        return true
      }
    }
    this.detour(label, `Ziel nach ${max} Tab nicht erreicht`)
    return false
  }

  /** In einer fokussierten Auswahlliste den Eintrag antippen: kuerzester eindeutiger Anfang. */
  async typeSelect(match, label) {
    const prefix = await this.page.evaluate((m) => {
      const el = document.activeElement
      if (!(el instanceof HTMLSelectElement)) return null
      const texts = [...el.options].map((o) => o.text.trim().toLowerCase())
      const target = texts.find((t) => t.startsWith(m.toLowerCase()))
      if (!target) return null
      for (let n = 1; n <= target.length; n++) {
        if (texts.filter((t) => t.startsWith(target.slice(0, n))).length === 1) return target.slice(0, n)
      }
      return target
    }, match)
    if (prefix === null) {
      this.detour(label, `Eintrag "${match}" nicht per Tippen erreichbar (Fokus nicht auf einer Liste?)`)
      return false
    }
    for (const ch of prefix) await this.key(ch === ' ' ? 'Space' : ch, `${label} tippen`)
    await this.page.waitForTimeout(250)
    await this.checkNotice(label)
    return true
  }

  async result(reached, extra = {}) {
    const ackMs = await this.ackDurations()
    return {
      rueckmeldungMs: ackMs,
      aufgabe: this.id,
      bedienung: this.mode,
      erreicht: reached,
      klicks: this.klicks,
      tasten: this.tasten,
      davonTab: this.tabs,
      bildlaeufe: this.bildlaeufe,
      fehlwege: this.fehlwege.length,
      fehlwegeListe: [...this.fehlwege],
      minimum: this.minimum,
      zeitMs: this.ms,
      zeitHinweis: 'Nebenwert, nicht lastfest',
      rueckmeldung: [...new Set(this.acks)],
      schritte: [...this.schritte],
      einrichtung: [...this.einrichtung],
      ...extra,
    }
  }
}

// ---------------------------------------------------------------------------------------
// Vorbereiteter Stand: Kaserne und Infanterie
// ---------------------------------------------------------------------------------------

async function prepareArmies(browser, text) {
  const { page, context } = await openState(browser, text)
  const sel = page.locator('aside select').first()
  await sel.selectOption({ label: 'Mittlerer Westen' })
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: 'Kaserne bauen' }).click()
  await runFor(page, 1500)
  const log = []
  for (let i = 0; i < 12; i++) {
    const ok = await page.getByRole('button', { name: 'Infanterie ausheben', exact: true }).click({ timeout: 1500 }).then(() => true, () => false)
    log.push(ok)
    await runFor(page, 1200)
    const txt = await asideText(page)
    const m = /Armeen hier([\s\S]*?)Ausheben/.exec(txt)
    const count = (m?.[1].match(/Stärke/g) ?? []).length
    if (count >= 2 && log.filter(Boolean).length >= 5) break
  }
  const text2 = await asideText(page)
  await page.getByRole('button', { name: 'Spielstände', exact: true }).first().click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: 'Speichern' }).nth(1).click()
  await page.waitForTimeout(800)
  const saved = await getSave(page, 'stand-2')
  await context.close()
  if (typeof saved !== 'string') throw new Error('Platz 2 nicht gespeichert')
  return { saved, armiesBlock: /Armeen hier([\s\S]*?)Ausheben/.exec(text2)?.[1]?.trim(), recruitClicks: log }
}


// ---------------------------------------------------------------------------------------
// Begleitmessungen (keine Aufgabe, aber Ursache der Zahlen oben)
// ---------------------------------------------------------------------------------------

const isProv = (f) => f.tag === 'select' && /Provinz/.test(f.name)

async function extras(browser, base, armies) {
  const out = {}
  // 1. Tab-Reihenfolge auf dem frisch geladenen S300: wie viele Stationen, wo steht die Provinzliste.
  {
    const { page, context } = await openState(browser, base)
    out.tabfolgeStart = await page.evaluate(() => {
      const sel = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'
      const all = [...document.querySelectorAll(sel)].filter((el) => el.offsetParent !== null || el.tagName === 'SUMMARY')
      const idx = all.findIndex((el) => el.tagName === 'SELECT' && /Provinz/.test(el.labels?.[0]?.textContent ?? ''))
      const log = all.filter((el) => el.closest('footer, .foot')).length
      return { stationen: all.length, provinzlisteAlsNummer: idx + 1, davonImProtokollUndFuss: log }
    })
    // Tab bis zur Provinzliste gezaehlt (wie ein Spieler).
    const r = new Run(page, 'extras', 'tastatur', null)
    r.start()
    await r.tabTo(isProv, 'Provinzliste')
    out.tabBisProvinzliste = r.tabs
    await context.close()
  }
  // 2. Armeen: Zeichen im DOM? Beschriftung der "Auswaehlen"-Knoepfe? Laenge der Marschzielliste.
  {
    const { page, context } = await openState(browser, armies)
    out.armeeZeichenImDom = await page.evaluate(() => document.querySelectorAll('[aria-label^="Armee"], .unit-marker').length)
    await page.locator('aside select').first().selectOption({ label: 'Mittlerer Westen' })
    await page.waitForTimeout(300)
    out.auswaehlenKnoepfe = await page.evaluate(() =>
      [...document.querySelectorAll('aside.side button')].filter((b) => b.textContent?.trim() === 'Auswählen').map((b) => ({ ariaLabel: b.getAttribute('aria-label'), title: b.getAttribute('title') })),
    )
    await page.getByRole('button', { name: 'Auswählen', exact: true }).first().click()
    await page.getByRole('button', { name: 'Marschieren', exact: true }).click()
    await page.waitForTimeout(300)
    out.marschzielliste = await page.evaluate(() => {
      const sel = document.querySelectorAll('aside select')[1]
      const opts = [...(sel?.options ?? [])].map((o) => o.text)
      return { eintraege: opts.length, erreichbar: opts.filter((o) => /Ankunft Tag/.test(o)).length, unerreichbar: opts.filter((o) => o && !/Ankunft Tag/.test(o) && !/keine/.test(o)).length }
    })
    await context.close()
  }
  // 3. Wie lange steht "befohlen" im Bild, je Tempo? (Kaserne bauen in Mittlerer Westen)
  out.rueckmeldungJeTempo = {}
  for (const tempo of ['Pause', '1', '10', '100']) {
    const { page, context } = await openState(browser, base)
    if (tempo !== 'Pause') await page.getByRole('button', { name: tempo, exact: true }).first().click()
    await page.locator('aside select').first().selectOption({ label: 'Mittlerer Westen' })
    await page.waitForTimeout(300)
    await page.evaluate(() => { window.__ack = [] })
    await page.getByRole('button', { name: 'Kaserne bauen' }).click()
    await page.waitForTimeout(2500)
    const log = await page.evaluate(() => window.__ack)
    const on = log.find((e) => e.on)
    const off = log.find((e) => !e.on && on && e.t > on.t)
    out.rueckmeldungJeTempo[tempo] = on ? (off ? off.t - on.t : 'bleibt stehen (>2,5 s)') : 'nie gesehen'
    await context.close()
  }
  return out
}

// ---------------------------------------------------------------------------------------
// Ablauf
// ---------------------------------------------------------------------------------------

async function main() {
  const base = readFileSync(join(ROOT, 'test/fixtures/v3/S300.json'), 'utf8')
  mkdirSync(CACHE, { recursive: true })
  const browser = await chromium.launch(findChromium())
  try {
    const armiesFile = join(CACHE, 'S300-armeen.json')
    if (!existsSync(armiesFile) || flag('prepare')) {
      process.stdout.write('Vorbereiten (Kaserne, Infanterie) ... ')
      const prep = await prepareArmies(browser, base)
      writeFileSync(armiesFile, prep.saved)
      console.log(`ok: ${prep.armiesBlock?.replace(/\s+/g, ' ')}`)
    }
    if (flag('prepare-only')) return
    const armies = readFileSync(armiesFile, 'utf8')
    const results = []
    const { TASKS } = await import('./ux-tasks.defs.mjs')
    for (const task of TASKS) {
      if (ONLY.length && !ONLY.includes(task.id)) continue
      for (const mode of MODES) {
        if (!task[mode]) continue
        process.stdout.write(`${task.id} / ${mode} ... `)
        const text = task.base === 'armeen' ? armies : base
        let r
        for (let versuch = 1; versuch <= 2; versuch++) {
          const { page, context, errors } = await openState(browser, text)
          try {
            const run = new Run(page, task.id, mode, task.minimum[mode])
            r = await task[mode](run, page)
            r.konsolenFehler = errors.slice(0, 5)
            r.versuche = versuch
          } catch (e) {
            r = { aufgabe: task.id, bedienung: mode, erreicht: false, abbruch: String(e).split('\n').slice(0, 3).join(' | ').slice(0, 400), versuche: versuch }
          }
          await context.close()
          if (!r.abbruch) break
        }
        r.titel = task.title
        results.push(r)
        console.log(r.abbruch ? `ABBRUCH ${r.abbruch}` : `erreicht=${r.erreicht} Klicks=${r.klicks} Tasten=${r.tasten} Fehlwege=${r.fehlwege}`)
      }
    }
    const begleit = ONLY.length ? null : await extras(browser, base, armies)
    mkdirSync(OUT, { recursive: true })
    const file = join(OUT, ONLY.length ? 'aufgaben.partial.json' : 'aufgaben.json')
    writeFileSync(
      file,
      JSON.stringify({ erzeugt: new Date().toISOString(), skript: 'scripts/ux-tasks.mjs', fenster: `${VP.width}x${VP.height}`, stand: 'test/fixtures/v3/S300.json', begleitmessungen: begleit, laeufe: results }, null, 2) + '\n',
    )
    console.log(`-> ${file}`)
  } finally {
    await browser.close()
  }
}

await main()
