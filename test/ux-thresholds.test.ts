import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CRITERIA, LIMITS, evaluate, exitCodeFor, regressions, render, sectionsNeeded, select } from '../scripts/ux-thresholds.mjs'

/**
 * R-UX-01…06, T-M44-02: die Schwellen als reine Funktion über ein `messwerte.json`.
 *
 * Zwei Seiten derselben Medaille, beide nötig: der **Vorher-Stand** (eingecheckt in
 * `docs/ux/before`) fällt an genau den Stellen, die der UX-PLAN nennt — sonst wäre die Schwelle
 * eine, die jeden Stand durchwinkt —, und ein **erfundener Sollstand** ist grün — sonst wäre sie
 * eine, die nichts durchlässt. Dazu je Kriterium eine Mutation: ein Messwert knapp über der Grenze
 * macht genau dieses Kriterium rot.
 */

type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
type Result = { id: string; status: string; value: string; lines: string[] }

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const BEFORE_PATH = `${ROOT}docs/ux/before/messwerte.json`
const before: Json = JSON.parse(readFileSync(BEFORE_PATH, 'utf8'))
const byId = (results: Result[]) => Object.fromEntries(results.map((r) => [r.id, r])) as Record<string, Result>

/** Ein Messlauf, wie ihn das Werkzeug schreibt, mit allen Sonden — und lauter guten Werten. */
function goodRun(tag: string, opts: { width: number; height: number }): Json {
  const finger = Math.min(opts.width, opts.height) < LIMITS.narrowBelowPx
  const layout = (share: number, headerH: number): Json => ({
    viewport: { w: opts.width, h: opts.height },
    pageOverflowX: false,
    header: { x: 0, y: 0, w: opts.width, h: headerH, visibleArea: 1 },
    mapShareOfViewport: share,
    alarmChipVisible: true,
    goalVisible: true,
    hiddenDrawn: [],
    overflowingRegions: [],
  })
  const touch = { total: 10, under44: 0, under24: 0, regions: { header: { total: 3, under44: 0, under24: 0 }, side: { total: 3, under44: 0, under24: 0 }, dialog: { total: 4, under44: 0, under24: 0 } } }
  return {
    steps: [],
    failures: [],
    layout: {
      mapStart: layout(finger ? 0.5 : 0.56, 60),
      provincePanel: layout(0.34, 62),
      armyPanel: layout(0.33, 62),
      running: layout(finger ? 0.5 : 0.52, 64),
      battle: layout(finger ? 0.48 : 0.5, 66),
    },
    axe: { mapStart: { violations: 0, nodes: 0 }, victory: { violations: 0, nodes: 0 } },
    touch: { mapStart: touch, provincePanel: touch },
    notes: [
      { startButtonInFirstView: true },
      { victoryFocusLeavesDialog: false },
      { victoryState: { real: true, share: 720, goal: 700 } },
      { defeatState: { real: true, share: 730, goal: 700 } },
    ],
    probes: {
      tooltip: { visibleWithDialog: false, text: 'Mittlerer Westen', mentionsMouse: false },
      log: { timeWrapped: 0, duplicateBattleRuns: 0, standingsFirstIsRankOne: true },
      march: { groups: [{ options: 3, disabled: 0 }, { options: 5, disabled: 5 }], openLongTaskMaxMs: 20 },
      explain: { closedByEscape: true },
      endDialog: { namesCondition: true },
      ...(opts.height > opts.width && finger ? { orientationHint: true } : {}),
    },
    dialogs: { victory: { present: true, focusLeaves: false, closable: true, closedByEscape: true } },
    _tag: tag,
  }
}

function goodMeasure(): Json {
  const sizes: [string, number, number][] = [['375x667', 375, 667], ['667x375', 667, 375], ['1280x800', 1280, 800], ['1366x768', 1366, 768], ['1920x1080', 1920, 1080]]
  const viewports = Object.fromEntries(sizes.map(([tag, width, height]) => [tag, goodRun(tag, { width, height })]))
  const mp = Object.fromEntries(
    [['375x667', 375, 667], ['1280x800', 1280, 800]].map(([tag, width, height]) => {
      const run = goodRun(tag as string, { width: width as number, height: height as number })
      run.layout.mpRunning = run.layout.running
      run.dialogs.curtain = { present: true, focusLeaves: false, closable: false, closedByEscape: false }
      return [tag, run]
    }),
  )
  const bundle = { '1920x1080': { perf: { running100: { longTasks: 0, longTaskMaxMs: 0, framesOver50Ms: 1 } } } }
  return { viewports, mp, bundle }
}

const ctx = { baseline: before }

describe('R-UX-01/AK1 R-UX-01/AK2 R-UX-01/AK3 ux-thresholds: der Vorher-Stand fällt, wo der UX-PLAN es sagt (T-M44-02)', () => {
  const r = byId(evaluate(before, ctx))

  it('liest den eingecheckten Vorher-Stand (sonst prüft der Test das Nichts)', () => {
    expect(existsSync(BEFORE_PATH)).toBe(true)
    expect(Object.keys(before.viewports).sort()).toEqual(['1024x768', '1280x800', '1366x768', '1920x1080', '320x568', '375x667', '667x375', '768x1024'])
  })

  it('R-UX-01/AK1: Telefon hochkant — Kartenanteil 0 statt >= 45 %', () => {
    expect(r['R-UX-01/AK1']!.status).toBe('red')
    expect(r['R-UX-01/AK1']!.value).toContain('0 %')
  })

  it('R-UX-01/AK2: Überlauf in allen acht Größen (Dialog und Spielstandraster überall, Kopf und Rohstoffe bei 375 und 320)', () => {
    const k = r['R-UX-01/AK2']!
    expect(k.status).toBe('red')
    expect(k.value).toContain('8 von 8')
    const text = k.lines.join('\n')
    expect(text).toContain('375x667: mapStart: header__top 528>375')
    expect(text).toContain('1280x800: saves: dialog 604>518')
    expect(text).toContain('320x568: mapStart: header__top 528>320, mapStart: resources 478>320, mapStart: foot 370>320')
  })

  it('R-UX-01/AK3: Fehlschritte bei 375x667 (9) und 320x568 (10) — sonst keine', () => {
    const k = r['R-UX-01/AK3']!
    expect(k.status).toBe('red')
    const text = k.lines.join('\n')
    expect(text).toContain('375x667: 9 Fehlschritte')
    expect(text).toContain('320x568: 10 Fehlschritte')
    expect(text).not.toContain('1280x800: ')
  })
})

describe('R-UX-02/AK1 R-UX-02/AK5 R-UX-05/AK1 R-UX-06/AK1 R-UX-06/AK2 R-UX-06/AK3 ux-thresholds: der Vorher-Stand, Fortsetzung', () => {
  const r = byId(evaluate(before, ctx))

  it('R-UX-02/AK1: Kopf- und Rohstoffleiste 107 px bei 1280x800 und 1366x768, 67 px bei 1920x1080 (mit Alarmchip)', () => {
    const k = r['R-UX-02/AK1']!
    expect(k.status).toBe('red')
    expect(k.value).toContain('1280x800 107 px > 70')
    expect(k.value).toContain('1366x768 107 px > 70')
    expect(k.value, '1920x1080 hält die Grenze').not.toContain('1920x1080 67')
  })

  it('R-UX-02/AK5: Tempo 100 am Bündel hält schon (0 lange Aufgaben, 1 Bild > 50 ms) — grün', () => {
    expect(r['R-UX-02/AK5']!.status).toBe('green')
    expect(r['R-UX-02/AK5']!.value).toBe('0 / 0 ms / 1')
  })

  it('R-UX-05/AK1: „Partie beginnen“ unter dem Dialogrand bei 1280x800 (nicht bei 1920x1080 und 768x1024)', () => {
    const k = r['R-UX-05/AK1']!
    expect(k.status).toBe('red')
    expect(k.value).toContain('6 von 8')
    expect(k.lines.join('\n')).toContain('1280x800')
    expect(k.lines.join('\n')).not.toContain('1920x1080')
    expect(k.lines.join('\n')).not.toContain('768x1024')
  })

  it('R-UX-06/AK1: axe — scrollable-region-focusable bei 375/320, color-contrast ab Einstellungen', () => {
    const k = r['R-UX-06/AK1']!
    expect(k.status).toBe('red')
    const text = k.lines.join('\n')
    expect(text).toContain('375x667 mapStart: scrollable-region-focusable (1)')
    expect(text).toContain('1280x800 settings: color-contrast (1)')
  })

  it('R-UX-06/AK2: der Endedialog lässt den Tab hinaus — in allen acht Größen', () => {
    const k = r['R-UX-06/AK2']!
    expect(k.status).toBe('red')
    expect(k.value).toContain('8 Befunde')
  })

  it('R-UX-06/AK3: zu kleine Ziele — per Finger < 44 px bei 375x667, am Schreibtisch < 24 px bei 1280x800', () => {
    const k = r['R-UX-06/AK3']!
    expect(k.status).toBe('red')
    const text = k.lines.join('\n')
    expect(text).toContain('375x667 mapStart: 4 Ziele < 44 px')
    expect(text).toContain('1280x800 mapStart: 30 Ziele < 24 px')
  })

  it('was noch keine Sonde hat, ist offen und nicht grün (R-UX-02/AK2…AK4, R-UX-04, R-UX-05/AK2…AK4)', () => {
    for (const id of ['R-UX-02/AK2', 'R-UX-02/AK3', 'R-UX-02/AK4', 'R-UX-04/AK1', 'R-UX-04/AK2', 'R-UX-05/AK2', 'R-UX-05/AK3', 'R-UX-05/AK4']) {
      expect(r[id]!.status, id).toBe('open')
    }
    expect(r['R-UX-03/AK1-4']!.status).toBe('open')
    expect(r['R-UX-06/AK4']!.status).toBe('open')
  })

  it('der Exit-Code ist 1, solange etwas rot ist; offen allein erst mit --strict', () => {
    expect(exitCodeFor(evaluate(before, ctx))).toBe(1)
    const onlyOpen = evaluate(before, { ...ctx, only: 'R-UX-02/AK2' })
    expect(exitCodeFor(onlyOpen)).toBe(0)
    expect(exitCodeFor(onlyOpen, { strict: true })).toBe(1)
  })

  it('der Bericht nennt grün, ROT und offen mit dem Messwert', () => {
    const text = render(evaluate(before, ctx))
    expect(text).toMatch(/ROT {3}R-UX-01\/AK1/)
    expect(text).toMatch(/grün {2}R-UX-02\/AK5/)
    expect(text).toMatch(/offen R-UX-02\/AK2/)
    expect(text).toMatch(/\d+ grün, \d+ rot, \d+ offen \(von \d+\)/)
  })
})

describe('R-UX-01/AK1 R-UX-02/AK1 ux-thresholds: ein erfundener Sollstand ist grün (T-M44-02)', () => {
  const measure = goodMeasure()
  const results = evaluate(measure, ctx)
  const r = byId(results)

  it('alles Messbare grün; offen bleibt nur, was ohne Browser geprüft wird', () => {
    const notGreen = results.filter((x: Result) => x.status !== 'green').map((x: Result) => `${x.id}: ${x.status} ${x.value}`)
    expect(notGreen.sort()).toEqual([
      'R-UX-03/AK1-4: open kein Browser-Messwert: Wächter text-keys und Komponententests der Aufgaben T-M44-06 und T-M44-18',
      'R-UX-04/AK1: open Sonde probes.confirm fehlt in den Daten (T-M44-09a)',
      'R-UX-06/AK4: open kein Browser-Messwert: apps/desktop/src/ui/tokens.contrast.test.ts (T-M44-08, T-M44-17)',
    ])
    expect(exitCodeFor(results)).toBe(0)
  })

  it('der Vorhang (Mehrspieler) darf den Tab nicht hinauslassen: Mutation → R-UX-06/AK2 rot', () => {
    const m = structuredClone(measure)
    m.mp['1280x800'].dialogs.curtain.focusLeaves = true
    expect(byId(evaluate(m, ctx))['R-UX-06/AK2']!.status).toBe('red')
  })

  it('jede Schwelle trägt: ein Messwert knapp daneben macht genau dieses Kriterium rot', () => {
    const cases: [string, (m: Json) => void][] = [
      ['R-UX-01/AK1', (m) => (m.viewports['375x667'].layout.mapStart.mapShareOfViewport = 0.44)],
      ['R-UX-01/AK1', (m) => (m.viewports['375x667'].layout.armyPanel.mapShareOfViewport = 0.29)],
      ['R-UX-01/AK2', (m) => (m.viewports['1280x800'].layout.running.overflowingRegions = ['dialog 604>518'])],
      ['R-UX-01/AK2', (m) => (m.mp['375x667'].layout.mpRunning.pageOverflowX = true)],
      ['R-UX-01/AK3', (m) => m.viewports['1366x768'].failures.push({ step: 'tempo-laeuft', error: 'x' })],
      ['R-UX-02/AK1', (m) => (m.viewports['1280x800'].layout.battle.header.h = LIMITS.headerMaxPx + 1)],
      ['R-UX-02/AK1', (m) => (m.mp['1280x800'].layout.running.header.h = LIMITS.headerMaxPx + 1)],
      ['R-UX-02/AK2', (m) => (m.viewports['1280x800'].layout.running.hiddenDrawn = ['div.header__alarm'])],
      ['R-UX-02/AK3', (m) => (m.viewports['1280x800'].probes.tooltip.visibleWithDialog = true)],
      ['R-UX-02/AK3', (m) => (m.viewports['1280x800'].probes.tooltip.mentionsMouse = true)],
      ['R-UX-02/AK4', (m) => (m.viewports['1280x800'].probes.log.timeWrapped = 1)],
      ['R-UX-02/AK4', (m) => (m.viewports['1280x800'].probes.log.standingsFirstIsRankOne = false)],
      ['R-UX-02/AK5', (m) => (m.bundle['1920x1080'].perf.running100.framesOver50Ms = LIMITS.framesOver50MsMax + 1)],
      ['R-UX-02/AK5', (m) => (m.bundle['1920x1080'].perf.running100.longTaskMaxMs = LIMITS.longTaskMaxMs + 1)],
      ['R-UX-04/AK2', (m) => (m.viewports['1280x800'].probes.march.groups[1].disabled = 4)],
      ['R-UX-04/AK2', (m) => (m.viewports['1280x800'].probes.march.openLongTaskMaxMs = LIMITS.openLongTaskMaxMs + 1)],
      ['R-UX-05/AK1', (m) => (m.viewports['1280x800'].notes[0].startButtonInFirstView = false)],
      ['R-UX-05/AK2', (m) => (m.viewports['375x667'].probes.orientationHint = false)],
      ['R-UX-05/AK3', (m) => (m.viewports['1280x800'].probes.explain.closedByEscape = false)],
      ['R-UX-05/AK4', (m) => (m.viewports['1280x800'].notes[2].victoryState.real = false)],
      ['R-UX-05/AK4', (m) => (m.viewports['1280x800'].probes.endDialog.namesCondition = false)],
      ['R-UX-06/AK1', (m) => (m.viewports['1280x800'].axe.victory = { violations: 1, nodes: 1, byRule: [{ id: 'color-contrast', nodes: 1 }] })],
      ['R-UX-06/AK2', (m) => (m.viewports['1280x800'].notes[1].victoryFocusLeavesDialog = true)],
      ['R-UX-06/AK2', (m) => (m.viewports['1280x800'].dialogs.victory.closedByEscape = false)],
      ['R-UX-06/AK3', (m) => (m.viewports['375x667'].touch.mapStart.regions.header.under44 = 1)],
      ['R-UX-06/AK3', (m) => (m.viewports['1280x800'].touch.mapStart.regions.side.under24 = 1)],
    ]
    for (const [id, mutate] of cases) {
      const m = structuredClone(measure)
      mutate(m)
      const got = byId(evaluate(m, ctx))
      expect(got[id]!.status, `${id} nach Mutation`).toBe('red')
      const others = Object.values(got).filter((x) => x.id !== id && x.status === 'red' && r[x.id]!.status !== 'red')
      expect(others.map((x) => x.id), `nur ${id} wird rot`).toEqual([])
    }
  })

  it('Grenzwerte sind grün: genau 70 px, genau 3 Bilder, genau 45 % und 30 %', () => {
    const m = structuredClone(measure)
    m.viewports['1280x800'].layout.battle.header.h = LIMITS.headerMaxPx
    m.bundle['1920x1080'].perf.running100.framesOver50Ms = LIMITS.framesOver50MsMax
    m.bundle['1920x1080'].perf.running100.longTaskMaxMs = LIMITS.longTaskMaxMs
    m.viewports['375x667'].layout.mapStart.mapShareOfViewport = LIMITS.mapShareNoPanel
    m.viewports['375x667'].layout.armyPanel.mapShareOfViewport = LIMITS.mapShareWithPanel
    const got = byId(evaluate(m, ctx))
    for (const id of ['R-UX-01/AK1', 'R-UX-02/AK1', 'R-UX-02/AK5']) expect(got[id]!.status, id).toBe('green')
  })

  it('Falle 18: gegen den Ausgangswert desselben Tages zählt auch eine kleine Verschlechterung', () => {
    const m = structuredClone(measure)
    m.bundle['1920x1080'].perf.running100.framesOver50Ms = 3
    const same = { bundle: { '1920x1080': { perf: { running100: { longTasks: 0, longTaskMaxMs: 0, framesOver50Ms: 1 } } } } }
    const got = byId(evaluate(m, { ...ctx, sameDayBundle: same }))
    expect(got['R-UX-02/AK5']!.status).toBe('red')
    expect(got['R-UX-02/AK5']!.value).toContain('mehr Bilder')
    expect(byId(evaluate(m, ctx))['R-UX-02/AK5']!.status, 'ohne Ausgangswert gilt nur die absolute Grenze').toBe('green')
  })

  it('R-UX-02/AK5 Falle 18: der Bericht sagt, wenn die Maschine nicht ruhig war — der Wert bleibt, was er ist', () => {
    const m = structuredClone(measure)
    m.bundle['1920x1080'].perf.running100.framesOver50Ms = LIMITS.framesOver50MsMax + 1
    m.bundle['1920x1080'].perf.machine = { loadAvg1: 3.2, cores: 4 }
    const busy = byId(evaluate(m, ctx))['R-UX-02/AK5']!
    expect(busy.status, 'die Grenze wird nicht angehoben, weil die Maschine beschäftigt war').toBe('red')
    expect(busy.lines.join('\n')).toContain('Maschine nicht ruhig (Last 3.2 bei 4 Kernen)')
    m.bundle['1920x1080'].perf.machine = { loadAvg1: 0.4, cores: 4 }
    expect(byId(evaluate(m, ctx))['R-UX-02/AK5']!.lines.join('\n')).not.toContain('Maschine nicht ruhig')
  })

  it('R-UX-01/AK3 Rückfallprüfung: 667x375 und 1366x768 dürfen nicht schlechter werden als vorher', () => {
    const m = structuredClone(measure)
    // Vorher hatte 1366x768 null Fehlschritte und zwei überlaufende Bereiche (Dialog, Raster im Speicherdialog);
    // drei sind eine Verschlechterung.
    m.viewports['1366x768'].layout.running.overflowingRegions = ['side 300>250', 'resources 500>400', 'foot 400>300']
    const worse = regressions(m.viewports['1366x768'], before.viewports['1366x768'])
    expect(worse.join(' ')).toContain('Überlauf')
    expect(byId(evaluate(m, ctx))['R-UX-01/AK3']!.status).toBe('red')
    expect(byId(evaluate(measure, ctx))['R-UX-01/AK3']!.status).toBe('green')
  })
})

describe('R-UX-01/AK3 ux-thresholds: die Rückfallprüfung vergleicht nur, was beide Stände gemessen haben', () => {
  it('ein dazugekommener Messzustand (Provinzpanel mit Überlauf) ist keine Verschlechterung', () => {
    const now: Json = structuredClone(before.viewports['667x375'])
    now.layout.provincePanel = { ...now.layout.running, overflowingRegions: ['side 288>252', 'resources 400>300'] }
    now.axe.neuerZustand = { violations: 1, nodes: 3 }
    expect(regressions(now, before.viewports['667x375'])).toEqual([])
  })

  it('derselbe Stand ist nicht schlechter als er selbst', () => {
    for (const tag of Object.keys(before.viewports)) expect(regressions(before.viewports[tag], before.viewports[tag]), tag).toEqual([])
  })
})

describe('R-UX-01/AK1 ux-thresholds: Auswahl und Zahlen der Anforderungen', () => {
  it('die Grenzen stehen so in R-UX-01…06', () => {
    expect(LIMITS).toMatchObject({
      mapShareNoPanel: 0.45,
      mapShareWithPanel: 0.3,
      headerMaxPx: 70,
      headerMinWidth: 1280,
      framesOver50MsMax: 3,
      longTaskMaxMs: 60,
      openLongTaskMaxMs: 50,
      touchFingerPx: 44,
      touchDeskPx: 24,
      narrowBelowPx: 600,
    })
  })

  it('jedes Kriterium von R-UX-01…06 hat eine Kennung mit Anforderung und Titel', () => {
    const ids = CRITERIA.map((c: { id: string }) => c.id)
    expect(new Set(ids).size, 'Kennungen sind eindeutig').toBe(ids.length)
    for (const req of ['R-UX-01', 'R-UX-02', 'R-UX-03', 'R-UX-04', 'R-UX-05', 'R-UX-06']) {
      expect(ids.some((id: string) => id.startsWith(req)), `${req} hat ein Kriterium`).toBe(true)
    }
    for (const c of CRITERIA) expect(c.title.length).toBeGreaterThan(10)
  })

  it('--only wählt nach Teilzeichenkette und sagt, welche Teile der Aufnahme nötig sind', () => {
    expect(select('R-UX-02').map((c: { id: string }) => c.id)).toEqual(['R-UX-02/AK1', 'R-UX-02/AK2', 'R-UX-02/AK3', 'R-UX-02/AK4', 'R-UX-02/AK5'])
    expect(select('06/ak2,05/AK1').map((c: { id: string }) => c.id)).toEqual(['R-UX-05/AK1', 'R-UX-06/AK2'])
    expect(select('R-UX-99')).toEqual([])
    expect([...sectionsNeeded('R-UX-02/AK5')]).toEqual(['bundle'])
    expect([...sectionsNeeded('R-UX-05/AK1')]).toEqual(['viewports'])
    expect([...sectionsNeeded('R-UX-06/AK2')].sort()).toEqual(['mp', 'viewports'])
    expect([...sectionsNeeded('R-UX-03')], 'ohne Browser nichts zu fahren').toEqual([])
  })

  it('ohne Daten bricht nichts: leere Messwerte sind offen, nicht grün und nicht ein Absturz', () => {
    const results = evaluate({}, {})
    expect(results.every((x: Result) => x.status === 'open')).toBe(true)
    expect(exitCodeFor(results)).toBe(0)
    expect(exitCodeFor(results, { strict: true })).toBe(1)
  })
})
