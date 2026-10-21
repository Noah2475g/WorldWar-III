import { describe, expect, it } from 'vitest'
import { planTransition, frameAt, done, CLUSTER_SPLIT_MS, CLUSTER_MERGE_MS, CLUSTER_FADE_MS, CLUSTER_STAGGER_MS, CLUSTER_STAGGER_MAX } from './tween.ts'
import type { Marker } from './markers.ts'
import type { IconName } from '../ui/icons.tsx'
import type { View } from './picking.ts'

/**
 * Der Zoom-Cluster-Uebergang als reine Funktion (T-M<n>-05, D9, Plan Zoom-Cluster §5 E2a).
 *
 * `planTransition` + `frameAt` statt Pinselstriche auf einer Leinwand — damit "schrumpft
 * die Eltern-Marke wirklich auf 0,6" eine Behauptung ist, die ein Test pruefen kann, nicht
 * nur ein Auge beim Playtest.
 */

const view: View = { x: 0, y: 0, scale: 1 }

function armyGroup(armyIds: string[], x: number, y: number, label = '×' + armyIds.length): Marker {
  return { kind: 'armyGroup', provinceId: 'P', x, y, own: true, armyIds, label }
}

function army(armyId: string, x: number, y: number, tone: Marker['tone'] = 'own'): Marker {
  return { kind: 'army', provinceId: 'P', x, y, own: tone === 'own', armyId, tone }
}

function buildingGroup(provinceId: string, x: number, y: number): Marker {
  return { kind: 'buildingGroup', provinceId, x, y, icon: 'factory', label: '3' }
}

function building(provinceId: string, icon: string, x: number, y: number): Marker {
  return { kind: 'building', provinceId, x, y, icon: icon as IconName }
}

describe('T-M<n>-05 planTransition/frameAt — Teilen', () => {
  it('(a) armyGroup[a1..a4] teilt sich: 4 Kinder starten am Elternpunkt (alpha 0, scale 0.6)', () => {
    const parent = armyGroup(['a1', 'a2', 'a3', 'a4'], 100, 100)
    const to = [army('a1', 10, 10), army('a2', 20, 20), army('a3', 30, 30), army('a4', 40, 40)]
    const plan = planTransition({ view, markers: [parent] }, to, 'split')
    const frame = frameAt(plan, 0, view).filter((m) => m.kind === 'army')
    expect(frame).toHaveLength(4)
    for (const m of frame) {
      expect(m.x).toBeCloseTo(100, 6)
      expect(m.y).toBeCloseTo(100, 6)
      expect(m.alpha).toBeCloseTo(0, 6)
      expect(m.scale).toBeCloseTo(0.6, 6)
    }
  })

  it('(c) buildingGroup P teilt sich in 3 building P', () => {
    const parent = buildingGroup('P', 50, 50)
    const to = [building('P', 'factory', 10, 10), building('P', 'airfield', 20, 20), building('P', 'harbour', 30, 30)]
    const plan = planTransition({ view, markers: [parent] }, to, 'split')
    const frame = frameAt(plan, 0, view).filter((m) => m.kind === 'building')
    expect(frame).toHaveLength(3)
    for (const m of frame) {
      expect(m.x).toBeCloseTo(50, 6)
      expect(m.y).toBeCloseTo(50, 6)
      expect(m.alpha).toBeCloseTo(0, 6)
      expect(m.scale).toBeCloseTo(0.6, 6)
    }
  })

  it('(d) 10 Kinder: Startversaetze 0,24,...,168, Rest 168; Feinde zuerst; Ende <= 588 ms', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `a${i}`)
    const parent = armyGroup(ids, 0, 0)
    // a7 ist Feind, muss trotz spaeter Eingabe zuerst (Versatz 0) starten.
    const to = ids.map((id, i) => army(id, i + 1, i + 1, id === 'a7' ? 'enemy' : 'own'))
    const plan = planTransition({ view, markers: [parent] }, to, 'split')

    expect(plan.durationMs).toBe(CLUSTER_SPLIT_MS + (CLUSTER_STAGGER_MAX - 1) * CLUSTER_STAGGER_MS)
    expect(plan.durationMs).toBeLessThanOrEqual(588)

    // Direkt nach Start (t=0 ms): nur der Feind (Versatz 0) ist schon am Bewegen (alpha > 0 bei t>0),
    // alle anderen sitzen noch exakt am Elternpunkt mit alpha 0 (ihr Versatz ist noch nicht erreicht).
    const frame1 = frameAt(plan, 1, view)
    const byId = new Map(frame1.map((m) => [m.armyId, m]))
    expect(byId.get('a7')!.alpha).toBeGreaterThan(0)
    for (const id of ids.filter((i) => i !== 'a7')) {
      expect(byId.get(id)!.alpha).toBeCloseTo(0, 6)
    }
  })

  it('(e) bei elapsed >= Ende: toEqual Zielliste (alpha 1, scale 1, exakte Positionen)', () => {
    const parent = armyGroup(['a1', 'a2'], 0, 0)
    const to = [army('a1', 10, 10), army('a2', 20, 20)]
    const plan = planTransition({ view, markers: [parent] }, to, 'split')
    const frame = frameAt(plan, plan.durationMs, view)
    expect(frame).toEqual(to.map((m) => ({ ...m, alpha: 1, scale: 1 })))
  })

  it('(f) ohne Partner: 120 ms Blende, kein Ortswechsel', () => {
    const to = [army('solo', 42, 17)]
    const plan = planTransition({ view, markers: [] }, to, 'split')
    expect(plan.durationMs).toBe(CLUSTER_FADE_MS)
    const mid = frameAt(plan, CLUSTER_FADE_MS / 2, view)[0]!
    expect(mid.x).toBeCloseTo(42, 6)
    expect(mid.y).toBeCloseTo(17, 6)
    expect(mid.alpha).toBeGreaterThan(0)
    expect(mid.alpha).toBeLessThan(1)
    const end = frameAt(plan, CLUSTER_FADE_MS, view)[0]!
    expect(end).toEqual({ ...to[0]!, alpha: 1, scale: 1 })
  })

  it('(g) gleicher Schluessel -> sofort Ziel', () => {
    const from = [army('a1', 0, 0)]
    const to = [army('a1', 99, 99)]
    const plan = planTransition({ view, markers: from }, to, 'split')
    const frame = frameAt(plan, 0, view)
    expect(frame).toEqual([{ ...to[0]!, alpha: 1, scale: 1 }])
  })

  it('(j) capital/battle werden nie getweent', () => {
    const capital: Marker = { kind: 'capital', provinceId: 'P', x: 5, y: 5 }
    const battle: Marker = { kind: 'battle', provinceId: 'P', x: 6, y: 6 }
    const plan = planTransition({ view, markers: [] }, [capital, battle], 'split')
    const frame0 = frameAt(plan, 0, view)
    expect(frame0).toEqual([
      { ...capital, alpha: 1, scale: 1 },
      { ...battle, alpha: 1, scale: 1 },
    ])
    expect(done(plan, 0)).toBe(true)
  })
})

describe('T-M<n>-05 planTransition/frameAt — Buendeln', () => {
  it('(b) Buendeln (umgekehrt): 280 ms, kein Versatz', () => {
    const from = [army('a1', 10, 10), army('a2', 20, 20), army('a3', 30, 30), army('a4', 40, 40)]
    const parent = armyGroup(['a1', 'a2', 'a3', 'a4'], 100, 100)
    const plan = planTransition({ view, markers: from }, [parent], 'merge')
    expect(plan.durationMs).toBe(CLUSTER_MERGE_MS)

    const atStart = frameAt(plan, 0, view)
    // Gruppenmarke (toItem) startet unsichtbar an ihrer Stelle.
    const group = atStart.find((m) => m.kind === 'armyGroup')!
    expect(group.alpha).toBeCloseTo(0, 6)
    expect(group.x).toBeCloseTo(100, 6)
    // Kinder (extraItems) starten an ihren eigenen Punkten, voll sichtbar, scale 1.
    const children = atStart.filter((m) => m.kind === 'army')
    expect(children).toHaveLength(4)
    for (const c of children) {
      expect(c.alpha).toBeCloseTo(1, 6)
      expect(c.scale).toBeCloseTo(1, 6)
    }

    const atEnd = frameAt(plan, CLUSTER_MERGE_MS, view)
    expect(atEnd).toEqual([{ ...parent, alpha: 1, scale: 1 }])
  })
})

describe('T-M<n>-05 planTransition/frameAt — Rueckwechsel und View', () => {
  it('(h) Rueckwechsel mitten im Tween: erstes Bild <= 0,5 px vom letzten gezeichneten', () => {
    const parent = armyGroup(['a1', 'a2'], 0, 0)
    const to = [army('a1', 100, 0), army('a2', 0, 100)]
    const forward = planTransition({ view, markers: [parent] }, to, 'split')
    const drawnMidway = frameAt(forward, 200, view)

    // Rueckwechsel: aus den gezeichneten (teilweise getweenten) Positionen wird neu geplant.
    const back = planTransition({ view, markers: drawnMidway }, [parent], 'merge')
    const firstBackFrame = frameAt(back, 0, view)
    const children = firstBackFrame.filter((m) => m.kind === 'army')
    for (const child of children) {
      const was = drawnMidway.find((m) => m.armyId === child.armyId)!
      expect(Math.hypot(child.x - was.x, child.y - was.y)).toBeLessThanOrEqual(0.5)
    }
  })

  it('(i) View verschoben waehrend des Tweens: Startpunkt folgt der Karte (Kartenraum)', () => {
    const parent = armyGroup(['a1'], 50, 50)
    const to = [army('a1', 150, 50)]
    const plan = planTransition({ view, markers: [parent] }, to, 'split')

    const sameView = frameAt(plan, 1, view)[0]!
    const shiftedView: View = { x: 20, y: 0, scale: 1 }
    const shifted = frameAt(plan, 1, shiftedView)[0]!

    // Derselbe Kartenpunkt, zehn Bildpunkte weiter verschobene View -> der Startanteil
    // (fast das ganze Bild bei t nahe 0) verschiebt sich um denselben Betrag auf dem Schirm.
    expect(shifted.x).toBeCloseTo(sameView.x - 20, 1)
  })
})
