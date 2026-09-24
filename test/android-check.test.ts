import { describe, expect, it } from 'vitest'
import {
  CHECKS,
  anchorCheck,
  chromeMajor,
  evaluateCanvas,
  evaluateDrag,
  evaluateEnvironment,
  evaluateLongPress,
  evaluatePinch,
  evaluateScroll,
  evaluateTap,
  evaluateTargets,
  evaluateZoomButtons,
  exitCodeFor,
  finalizeChecks,
  formatReport,
  linePath,
  pageUrl,
  parseAdbDevices,
  parseArgs,
  parseSizes,
  parseViewAttrs,
  pickPageTarget,
  pickSerial,
  pickTapPoint,
  pinchPath,
} from '../scripts/lib/android-check-lib.mjs'

/**
 * Der Pruefstand fuer die Touch-Bedienung (Android-Emulator und Chromium mit Touch-Emulation).
 *
 * Getestet wird nur die reine Logik: Argumente, Bewertung der Messwerte, Fingerbahnen,
 * die Rechnung fuer den Anker beim Zwei-Finger-Zoom und der Bericht. Der Lauf selbst
 * (adb, Browser, CDP) steht in scripts/android-check.mjs und wird am echten Fenster gefahren.
 */

const view = (x: number, y: number, scale: number, selected = '') => ({
  x: String(x),
  y: String(y),
  scale: scale.toFixed(4),
  selected,
})

describe('Android-Pruefstand: Argumente', () => {
  it('nimmt ohne Angaben das Android-Ziel mit Port 4190 und 9229', () => {
    const parsed = parseArgs([], {})
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.options.target).toBe('android')
    expect(parsed.options.urlPort).toBe(4190)
    expect(parsed.options.devtoolsPort).toBe(9229)
    expect(parsed.options.adb).toBe('adb')
    expect(parsed.options.serial).toBeNull()
    expect(pageUrl(parsed.options)).toBe('http://localhost:4190/?touch=1')
  })

  it('liest adb aus der Umgebung und die Schalter in beiden Schreibweisen', () => {
    const parsed = parseArgs(['--serial=emulator-5554', '--url-port', '4191', '--out', 'C:/tmp/x'], { ADB: 'D:/ld/adb.exe' })
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.options.adb).toBe('D:/ld/adb.exe')
    expect(parsed.options.serial).toBe('emulator-5554')
    expect(parsed.options.urlPort).toBe(4191)
    expect(parsed.options.out).toBe('C:/tmp/x')
    // --adb schlaegt die Umgebung.
    const explicit = parseArgs(['--adb', 'E:/adb.exe'], { ADB: 'D:/ld/adb.exe' })
    expect(explicit.ok && explicit.options.adb).toBe('E:/adb.exe')
  })

  it('baut fuer Chromium die Groessen und nimmt 127.0.0.1 statt localhost', () => {
    const parsed = parseArgs(['--target', 'chromium', '--browser', 'C:/brave.exe', '--sizes', '640x360@2,1097x617@1.75'], {})
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.options.debugPort).toBe(9223)
    expect(parsed.options.sizes.map((s) => s.label)).toEqual(['640x360@2', '1097x617@1.75'])
    expect(pageUrl(parsed.options)).toBe('http://127.0.0.1:4190/?touch=1')
  })

  it('laesst --url die Adresse vollstaendig bestimmen', () => {
    const parsed = parseArgs(['--url', 'http://127.0.0.1:4191/?touch=1'], {})
    expect(parsed.ok && pageUrl(parsed.options)).toBe('http://127.0.0.1:4191/?touch=1')
  })

  it('weist Unbekanntes und Kaputtes mit einer Meldung zurueck', () => {
    expect(parseArgs(['--target', 'ios'], {})).toMatchObject({ ok: false })
    expect(parseArgs(['--url-port', '0'], {})).toMatchObject({ ok: false })
    expect(parseArgs(['--url-port', 'abc'], {})).toMatchObject({ ok: false })
    expect(parseArgs(['--frobnicate'], {})).toMatchObject({ ok: false })
    expect(parseArgs(['--serial'], {})).toMatchObject({ ok: false })
    expect(parseArgs(['--url', 'ftp://x'], {})).toMatchObject({ ok: false })
    const bad = parseArgs(['--sizes', '640x'], {})
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.error).toMatch(/640x/)
  })

  it('kennt --help', () => {
    expect(parseArgs(['--help'], {})).toMatchObject({ ok: true, options: { help: true } })
  })
})

describe('Android-Pruefstand: Groessen', () => {
  it('liest Breite, Hoehe und Pixelverhaeltnis', () => {
    expect(parseSizes('640x360@2,1097x617@1.75')).toEqual([
      { width: 640, height: 360, dpr: 2, label: '640x360@2' },
      { width: 1097, height: 617, dpr: 1.75, label: '1097x617@1.75' },
    ])
  })

  it('setzt ohne @ das Verhaeltnis 1', () => {
    expect(parseSizes('800x600')).toEqual([{ width: 800, height: 600, dpr: 1, label: '800x600@1' }])
  })

  it('wirft bei kaputten Angaben', () => {
    expect(() => parseSizes('640x')).toThrow(/640x/)
    expect(() => parseSizes('640x360@0')).toThrow()
    expect(() => parseSizes('')).toThrow()
  })
})

describe('Android-Pruefstand: adb und CDP-Ziele', () => {
  const devices = 'List of devices attached\r\nemulator-5554\tdevice\r\n127.0.0.1:5555\toffline\r\n\r\n'

  it('liest die Geraeteliste samt Zustand', () => {
    expect(parseAdbDevices(devices)).toEqual([
      { serial: 'emulator-5554', state: 'device' },
      { serial: '127.0.0.1:5555', state: 'offline' },
    ])
  })

  it('nimmt das einzige bereite Geraet und sagt sonst, woran es liegt', () => {
    expect(pickSerial(parseAdbDevices(devices), null)).toEqual({ ok: true, serial: 'emulator-5554' })
    expect(pickSerial([], null)).toMatchObject({ ok: false })
    const two = pickSerial(
      [
        { serial: 'a', state: 'device' },
        { serial: 'b', state: 'device' },
      ],
      null,
    )
    expect(two.ok).toBe(false)
    if (!two.ok) expect(two.error).toMatch(/a, b/)
    expect(pickSerial([{ serial: 'a', state: 'device' }], 'b')).toMatchObject({ ok: false })
    expect(pickSerial([{ serial: 'a', state: 'unauthorized' }], 'a')).toMatchObject({ ok: false })
  })

  it('findet den Tab mit der eigenen Adresse, nicht irgendeinen', () => {
    const targets = [
      { type: 'service_worker', url: 'http://localhost:4190/sw.js', webSocketDebuggerUrl: 'ws://sw' },
      { type: 'page', url: 'https://www.google.com/', webSocketDebuggerUrl: 'ws://g' },
      { type: 'page', url: 'http://localhost:4190/#/start', webSocketDebuggerUrl: 'ws://same-origin' },
      { type: 'page', url: 'http://localhost:4190/?touch=1', webSocketDebuggerUrl: 'ws://exact' },
    ]
    expect(pickPageTarget(targets, 'http://localhost:4190/?touch=1')?.webSocketDebuggerUrl).toBe('ws://exact')
    expect(pickPageTarget(targets.slice(0, 3), 'http://localhost:4190/?touch=1')?.webSocketDebuggerUrl).toBe('ws://same-origin')
    expect(pickPageTarget(targets.slice(0, 2), 'http://localhost:4190/?touch=1')).toBeNull()
  })

  it('liest die Chrome-Hauptversion aus der Kennung', () => {
    expect(chromeMajor('Mozilla/5.0 (Linux; Android 9) Chrome/124.0.6367.82 Mobile Safari/537.36')).toBe(124)
    expect(chromeMajor('Mozilla/5.0 Firefox/130')).toBeNull()
  })
})

describe('Android-Pruefstand: Fingerbahnen', () => {
  it('zieht in gleichen Schritten vom Start bis genau zum Ziel', () => {
    const path = linePath({ x: 100, y: 100 }, { x: 40, y: 70 }, 6)
    expect(path).toHaveLength(7)
    expect(path[0]).toEqual({ x: 100, y: 100 })
    expect(path[6]).toEqual({ x: 40, y: 70 })
    expect(path[3]).toEqual({ x: 70, y: 85 })
  })

  it('spreizt zwei Finger um eine feste Mitte', () => {
    const path = pinchPath({ x: 300, y: 200 }, 60, 120, 4)
    expect(path).toHaveLength(5)
    for (const [a, b] of path) {
      expect((a.x + b.x) / 2).toBeCloseTo(300)
      expect((a.y + b.y) / 2).toBeCloseTo(200)
    }
    const [first, last] = [path[0]!, path[4]!]
    expect(first[1].x - first[0].x).toBeCloseTo(60)
    expect(last[1].x - last[0].x).toBeCloseTo(120)
  })
})

describe('Android-Pruefstand: Vertragsattribute der Karte', () => {
  it('liest Ansicht und Auswahl', () => {
    expect(parseViewAttrs(view(1200, 640, 1.6, 'USA-MW'))).toEqual({
      ok: true,
      view: { x: 1200, y: 640, scale: 1.6 },
      selected: 'USA-MW',
    })
  })

  it('nennt jedes fehlende Attribut beim Namen', () => {
    const parsed = parseViewAttrs({ x: null, y: '3', scale: null, selected: null })
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.missing).toEqual(['data-view-x', 'data-view-scale', 'data-selected-province'])
  })

  it('haelt eine leere Auswahl fuer vorhanden und eine Zahl ohne Wert fuer kaputt', () => {
    expect(parseViewAttrs(view(0, 0, 1)).ok).toBe(true)
    expect(parseViewAttrs({ x: 'abc', y: '0', scale: '1', selected: '' })).toMatchObject({ ok: false, missing: ['data-view-x'] })
    expect(parseViewAttrs({ x: '0', y: '0', scale: '0', selected: '' })).toMatchObject({ ok: false, missing: ['data-view-scale'] })
  })
})

describe('Android-Pruefstand: Anker beim Zwei-Finger-Zoom', () => {
  it('meldet keinen Fehler, wenn der Punkt unter der Mitte stehen bleibt', () => {
    // Vorher: Mitte (300,200) zeigt auf 1000 + 300*2 = 1600 / 500 + 200*2 = 900.
    // Nachher Massstab 1: x = 1600 - 300 = 1300, y = 900 - 200 = 700.
    const r = anchorCheck({ x: 1000, y: 500, scale: 2 }, { x: 1300, y: 700, scale: 1 }, { x: 300, y: 200 })
    expect(r.mapBefore).toEqual({ x: 1600, y: 900 })
    expect(r.errorPx).toBeCloseTo(0)
  })

  it('misst den Versatz in Bildschirmpixeln, wenn um die Ecke gezoomt wurde', () => {
    // Um die linke obere Ecke gezoomt: view.x/y bleiben, nur der Massstab halbiert sich.
    const r = anchorCheck({ x: 1000, y: 500, scale: 2 }, { x: 1000, y: 500, scale: 1 }, { x: 300, y: 200 })
    // Der Punkt unter der Mitte ist jetzt 1300/700 statt 1600/900: 300/200 Karteneinheiten,
    // bei Massstab 1 genauso viele Pixel.
    expect(r.errorMap).toBeCloseTo(Math.hypot(300, 200))
    expect(r.errorPx).toBeCloseTo(Math.hypot(300, 200))
  })
})

describe('Android-Pruefstand: Bewertung der Messungen', () => {
  it('Umgebung: verlangt grobe Zeiger, data-input=touch und die bestellte Groesse', () => {
    const env = {
      userAgent: 'Chrome/140.0',
      innerWidth: 640,
      innerHeight: 360,
      dpr: 2,
      pointerCoarse: true,
      hoverNone: true,
      dataInput: 'touch',
    }
    expect(evaluateEnvironment(env, { width: 640, height: 360, dpr: 2, label: '640x360@2' }).pass).toBe(true)
    expect(evaluateEnvironment(env, null).pass).toBe(true)
    const noAttr = evaluateEnvironment({ ...env, dataInput: null }, null)
    expect(noAttr.pass).toBe(false)
    expect(noAttr.detail).toMatch(/data-input/)
    expect(evaluateEnvironment({ ...env, pointerCoarse: false }, null).pass).toBe(false)
    expect(evaluateEnvironment({ ...env, innerWidth: 980 }, { width: 640, height: 360, dpr: 2, label: 'x' }).pass).toBe(false)
  })

  it('Seitenscroll: gleich gross ist in Ordnung, ein Pixel mehr nicht', () => {
    expect(evaluateScroll({ scrollWidth: 640, scrollHeight: 360, innerWidth: 640, innerHeight: 360 }).pass).toBe(true)
    const r = evaluateScroll({ scrollWidth: 640, scrollHeight: 581, innerWidth: 640, innerHeight: 360 })
    expect(r.pass).toBe(false)
    expect(r.numbers).toMatchObject({ overflowX: 0, overflowY: 221 })
  })

  it('Touch-Ziele: 44 x 44 reicht, 43,9 nicht; unsichtbare zaehlen nicht', () => {
    const r = evaluateTargets([
      { selector: 'button.a', text: 'A', width: 44, height: 44 },
      { selector: 'button.b', text: 'B', width: 120, height: 43.9 },
      { selector: 'button.c', text: '?', width: 14, height: 14 },
      { selector: 'button.d', text: 'weg', width: 0, height: 0 },
    ])
    expect(r.pass).toBe(false)
    expect(r.numbers).toMatchObject({ total: 3, violators: 2, smallest: 14 })
    // Der kleinste zuerst: der ist am schwersten zu treffen.
    expect(r.violators.map((v) => v.selector)).toEqual(['button.c', 'button.b'])
    expect(evaluateTargets([{ selector: 'b', text: '', width: 48, height: 48 }]).pass).toBe(true)
  })

  it('Karten-Canvas: Mindestgroesse und gleiches Verhaeltnis auf beiden Achsen', () => {
    const ok = evaluateCanvas([
      { name: 'Basis', cssWidth: 640, cssHeight: 250, bitmapWidth: 1280, bitmapHeight: 500 },
    ])
    // 250 Pixel hoch sind ueber 240; DPR 2 auf beiden Achsen ist ein gleiches Verhaeltnis.
    expect(ok.pass).toBe(true)
    const stretched = evaluateCanvas([
      { name: 'Basis', cssWidth: 260, cssHeight: 240, bitmapWidth: 320, bitmapHeight: 240 },
    ])
    expect(stretched.pass).toBe(false)
    expect(stretched.detail).toMatch(/260/)
    expect(evaluateCanvas([]).pass).toBe(false)
  })

  it('Ziehen: ohne Vertragsattribute ein klares FAIL statt eines Absturzes', () => {
    const missing = { x: null, y: null, scale: null, selected: null }
    const r = evaluateDrag(missing, missing, { dx: -150, dy: -80 })
    expect(r.pass).toBe(false)
    expect(r.detail).toMatch(/data-view-x/)
  })

  it('Ziehen: Karte folgt dem Finger und die Auswahl bleibt', () => {
    // Finger 150 nach links, 80 nach oben bei Massstab 2 -> Ansicht +300 / +160.
    const good = evaluateDrag(view(1000, 500, 2, 'X'), view(1300, 660, 2, 'X'), { dx: -150, dy: -80 })
    expect(good.pass).toBe(true)
    expect(good.numbers).toMatchObject({ viewDx: 300, viewDy: 160, expectedDx: 300, expectedDy: 160 })
    expect(evaluateDrag(view(1000, 500, 2, 'X'), view(1300, 660, 2, 'Y'), { dx: -150, dy: -80 }).pass).toBe(false)
    expect(evaluateDrag(view(1000, 500, 2, 'X'), view(1000, 500, 2, 'X'), { dx: -150, dy: -80 }).pass).toBe(false)
    // Falsche Richtung: die Karte flieht vor dem Finger.
    expect(evaluateDrag(view(1000, 500, 2), view(700, 340, 2), { dx: -150, dy: -80 }).pass).toBe(false)
  })

  it('Zwei-Finger-Zoom: kleinerer Massstab und Anker innerhalb der Toleranz', () => {
    const mid = { x: 300, y: 200 }
    expect(evaluatePinch(view(1000, 500, 2), view(1300, 700, 1), mid, 8).pass).toBe(true)
    // Um die Ecke gezoomt: Massstab stimmt, der Anker nicht.
    const corner = evaluatePinch(view(1000, 500, 2), view(1000, 500, 1), mid, 8)
    expect(corner.pass).toBe(false)
    expect(corner.detail).toMatch(/Anker/)
    // Herausgezoomt statt hinein.
    expect(evaluatePinch(view(1000, 500, 1), view(850, 400, 1.5), mid, 8).pass).toBe(false)
    // Unveraendert.
    expect(evaluatePinch(view(1000, 500, 2), view(1000, 500, 2), mid, 8).pass).toBe(false)
    const missing = { x: null, y: null, scale: null, selected: null }
    expect(evaluatePinch(missing, missing, mid, 8).pass).toBe(false)
  })

  it('Antippen: eine Provinz ist danach gewaehlt', () => {
    expect(evaluateTap(view(0, 0, 1, ''), view(0, 0, 1, 'USA-MW')).pass).toBe(true)
    expect(evaluateTap(view(0, 0, 1, ''), view(0, 0, 1, '')).pass).toBe(false)
    expect(evaluateTap({ x: null, y: null, scale: null, selected: null }, { x: null, y: null, scale: null, selected: null }).pass).toBe(false)
  })

  it('Langes Druecken: vorher kein Tooltip, nach dem Loslassen einer', () => {
    expect(evaluateLongPress({ before: false, duringHold: true, after: true }).pass).toBe(true)
    expect(evaluateLongPress({ before: false, duringHold: true, after: false }).pass).toBe(false)
    // War er vorher schon da, beweist er nichts.
    expect(evaluateLongPress({ before: true, duringHold: true, after: true }).pass).toBe(false)
  })

  it('Zoomknoepfe: hinein verkleinert den Massstab, heraus vergroessert ihn', () => {
    const good = evaluateZoomButtons([
      { label: 'Hineinzoomen', found: true, before: view(0, 0, 1.6), after: view(0, 0, 1.3333) },
      { label: 'Herauszoomen', found: true, before: view(0, 0, 1.3333), after: view(0, 0, 1.6) },
    ])
    expect(good.pass).toBe(true)
    const wrong = evaluateZoomButtons([
      { label: 'Hineinzoomen', found: true, before: view(0, 0, 1.6), after: view(0, 0, 1.92) },
      { label: 'Herauszoomen', found: true, before: view(0, 0, 1.92), after: view(0, 0, 1.6) },
    ])
    expect(wrong.pass).toBe(false)
    const absent = evaluateZoomButtons([
      { label: 'Hineinzoomen', found: false, before: view(0, 0, 1), after: view(0, 0, 1) },
      { label: 'Herauszoomen', found: true, before: view(0, 0, 1), after: view(0, 0, 1.2) },
    ])
    expect(absent.pass).toBe(false)
    expect(absent.detail).toMatch(/Hineinzoomen/)
  })
})

describe('Android-Pruefstand: Tipp-Punkt auf einer Provinz', () => {
  const provinces = [
    { id: 'FERN', center: { x: 3900, y: 2300 } },
    { id: 'NAH', center: { x: 1330, y: 700 } },
    { id: 'MITTE', center: { x: 1310, y: 690 } },
    { id: 'RAND', center: { x: 1005, y: 505 } },
  ]

  it('nimmt die Provinzmitte, die der Kartenmitte am naechsten liegt', () => {
    // Ansicht 1000/500, Massstab 1, Canvas 600x400: die Mitte zeigt auf 1300/700.
    const p = pickTapPoint(provinces, { x: 1000, y: 500, scale: 1 }, { width: 600, height: 400 })
    expect(p).toEqual({ id: 'MITTE', x: 310, y: 190 })
  })

  it('meidet den Rand und gibt null, wenn nichts im Innern liegt', () => {
    expect(pickTapPoint([provinces[3]!], { x: 1000, y: 500, scale: 1 }, { width: 600, height: 400 })).toBeNull()
    expect(pickTapPoint([], { x: 0, y: 0, scale: 1 }, { width: 600, height: 400 })).toBeNull()
  })
})

describe('Android-Pruefstand: Bericht', () => {
  const pass = { id: 'environment', pass: true, numbers: {}, detail: 'innerWidth 640' }

  it('fuellt nicht gelaufene Pruefungen als FAIL auf und nummeriert nach CHECKS', () => {
    const checks = finalizeChecks([pass], 'Partie startete nicht')
    expect(checks).toHaveLength(CHECKS.length)
    expect(checks[0]).toMatchObject({ nr: 1, name: 'Umgebung', pass: true })
    expect(checks.slice(1).every((c) => !c.pass && /nicht gelaufen: Partie startete nicht/.test(c.detail))).toBe(true)
  })

  it('druckt jede Pruefung mit PASS/FAIL und Zahlen, und der Exit-Code folgt', () => {
    const allPass = CHECKS.map((c) => ({ id: c.id, pass: true, numbers: {}, detail: `ok ${c.nr}` }))
    const good = { runs: [{ label: '640x360@2', checks: finalizeChecks(allPass, null), screenshots: [], error: null }] }
    expect(exitCodeFor(good)).toBe(0)
    const text = formatReport(good)
    expect(text).toMatch(/640x360@2/)
    expect(text).toMatch(/PASS\s+1 Umgebung/)
    expect(text).toMatch(/9 von 9 bestanden/)

    const bad = { runs: [{ label: 'android:emulator-5554', checks: finalizeChecks([pass], null), screenshots: [], error: null }] }
    expect(exitCodeFor(bad)).toBe(1)
    expect(formatReport(bad)).toMatch(/FAIL\s+2 Kein Seitenscroll/)
    expect(exitCodeFor({ runs: [] })).toBe(1)
  })
})
