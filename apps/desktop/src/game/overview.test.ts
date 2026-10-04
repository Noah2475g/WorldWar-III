import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { GameEvent, MapData } from '@worldwar/core'
import { describe, expect, it } from 'vitest'
import { PING_MS, edgeMarker, freshPings, pingFrame } from '../map/pings.ts'
import type { EventEntry } from '../ui/Panels.tsx'
import { describeEvent, groupEntries, importanceOf, pingsFor, placeOf } from './events.ts'

/**
 * Der Ueberblick (T-M46-02, VM-03): Wichtigkeit, Ort, Sammelzeilen und Pulse. Noah (Playtest V3):
 * „Sounds passieren und man weiss nicht, wo etwas passiert, und die Konsole unten ist viel zu ueberfuellt.“
 * Gemessen an S575G vorher: 35 Zeilen an einem Spieltag, 59 % der Zeilen mit Sprung.
 */

const ROOT = fileURLToPath(new URL('../../../..', import.meta.url))
const map = JSON.parse(readFileSync(`${ROOT}/data/maps/world.json`, 'utf8')) as MapData
const [a, b, c] = map.provinces.map((p) => p.id) as [string, string, string]

const ev = (over: Record<string, unknown>): GameEvent =>
  ({ tick: 100, severity: 'info', concerns: ['p1'], audience: [], ...over }) as unknown as GameEvent

const capitals: Record<string, string> = { p1: a, p2: b }
const capital = (id: string): string | undefined => capitals[id]

describe('importanceOf: was die Aufmerksamkeit braucht, was Alltag ist', () => {
  it('Alarm, Rueckschlag und Krieg sind wichtig', () => {
    expect(importanceOf(ev({ type: 'ARMY_INTRUDED', severity: 'alert', playerId: 'p1', provinceId: a }), 'p1')).toBe('major')
    expect(importanceOf(ev({ type: 'WAR_DECLARED', playerId: 'p2', targetPlayerId: 'p1' }), 'p1')).toBe('major')
    expect(
      importanceOf(ev({ type: 'PROVINCE_CAPTURED', severity: 'alert', provinceId: a, previousOwner: 'p1', newOwner: 'p2' }), 'p1'),
    ).toBe('major')
  })

  it('Ankuenfte, Beschuss und Fremdes sind Alltag, Bau fertig und Gefechtsausgang sind ueblich', () => {
    expect(importanceOf(ev({ type: 'ARMY_ARRIVED', provinceId: a }), 'p1')).toBe('minor')
    expect(importanceOf(ev({ type: 'BOMBARDMENT', provinceId: a }), 'p1')).toBe('minor')
    expect(importanceOf(ev({ type: 'BATTLE_RESOLVED', provinceId: a, concerns: ['p2', 'p3'] }), 'p1')).toBe('minor')
    expect(importanceOf(ev({ type: 'BUILD_COMPLETED', provinceId: a }), 'p1')).toBe('normal')
    expect(importanceOf(ev({ type: 'BATTLE_RESOLVED', provinceId: a }), 'p1')).toBe('normal')
  })

  it('quittiert, was der Spieler selbst befahl: Abmarsch, Baubeginn, Handel bleiben ueblich', () => {
    for (const type of ['ARMY_DEPARTED', 'BUILD_STARTED', 'TRADE_EXECUTED']) {
      expect(importanceOf(ev({ type, provinceId: a }), 'p1')).toBe('normal')
    }
  })

  it('eine fremde Kriegserklaerung bleibt Weltlage', () => {
    expect(
      importanceOf(ev({ type: 'WAR_DECLARED', playerId: 'p2', targetPlayerId: 'p3', concerns: ['p2', 'p3'] }), 'p1'),
    ).toBe('normal')
  })
})

describe('placeOf: jedes hoerbare Ereignis hat einen Ort', () => {
  it('nimmt die Provinz des Ereignisses, sonst die Hauptstadt der betroffenen Macht', () => {
    expect(placeOf(ev({ type: 'BATTLE_STARTED', provinceId: c }), 'p1', capital)).toBe(c)
    // Mangel: die eigene Wirtschaft
    expect(placeOf(ev({ type: 'RESOURCE_SHORTAGE', playerId: 'p1', resource: 'food' }), 'p1', capital)).toBe(a)
    // Krieg: die Hauptstadt der Gegenseite, aus beiden Richtungen
    expect(placeOf(ev({ type: 'WAR_DECLARED', playerId: 'p2', targetPlayerId: 'p1' }), 'p1', capital)).toBe(b)
    expect(placeOf(ev({ type: 'WAR_DECLARED', playerId: 'p1', targetPlayerId: 'p2' }), 'p1', capital)).toBe(b)
  })

  it('ohne Hauptstadtauskunft und ohne Provinz bleibt es ohne Ort', () => {
    expect(placeOf(ev({ type: 'RESOURCE_SHORTAGE', playerId: 'p1', resource: 'food' }), 'p1')).toBeUndefined()
    expect(placeOf(ev({ type: 'DAY_REPORT' }), 'p1', capital)).toBeUndefined()
  })

  it('die Zeile traegt den Ort, damit der Klick springt, und markiert sich als hoerbar', () => {
    const entry = describeEvent(ev({ type: 'RESOURCE_SHORTAGE', playerId: 'p1', resource: 'food' }), 0, map, {
      viewer: 'p1',
      capital,
    })
    expect(entry.provinceId).toBe(a)
    expect(entry.audible).toBe(true)
    expect(entry.type).toBe('RESOURCE_SHORTAGE')
    // Ein fremdes Ereignis hat keinen Ton fuer mich.
    const foreign = describeEvent(ev({ type: 'BATTLE_STARTED', provinceId: c, concerns: ['p2'] }), 0, map, {
      viewer: 'p1',
      capital,
    })
    expect(foreign.audible).toBeUndefined()
  })
})

const row = (id: string, tick: number, type: string, over: Partial<EventEntry> = {}): EventEntry => ({
  id,
  tick,
  type,
  text: `${type} ${id}`,
  provinceId: a,
  severity: 'info',
  importance: 'normal',
  ...over,
})

describe('groupEntries: Sammelzeilen je Art und Spieltag', () => {
  it('macht aus vielen gleichartigen Zeilen eines Tages eine, die Teile mit Sprung tragen', () => {
    const entries = [
      row('1', 130, 'BOMBARDMENT', { importance: 'minor' }),
      row('2', 128, 'ARMY_INTRUDED', { importance: 'major', severity: 'alert' }),
      row('3', 125, 'BOMBARDMENT', { importance: 'minor', provinceId: b }),
      row('4', 120, 'BOMBARDMENT', { importance: 'minor', provinceId: c }),
    ]
    const grouped = groupEntries(entries, 24)
    expect(grouped).toHaveLength(2)
    expect(grouped[0]!.parts).toHaveLength(3)
    expect(grouped[0]!.text).toContain('+2 weitere')
    expect(grouped[0]!.provinceId).toBe(a) // der juengste Ort
    expect(grouped[0]!.parts!.map((p) => p.provinceId)).toEqual([a, b, c])
    expect(grouped[1]!.id).toBe('2')
  })

  it('trennt die Tage und laesst Solo-Arten und Zeilen ohne Art unberuehrt', () => {
    const entries = [
      row('1', 130, 'BATTLE_RESOLVED'),
      row('2', 100, 'BATTLE_RESOLVED'), // anderer Tag (130/24 = 5, 100/24 = 4)
      row('3', 99, 'DAY_REPORT'),
      row('4', 98, 'DAY_REPORT'),
      { id: '5', tick: 97, text: 'ohne Art', severity: 'info' } as EventEntry,
      { id: '6', tick: 96, text: 'ohne Art 2', severity: 'info' } as EventEntry,
    ]
    expect(groupEntries(entries, 24)).toHaveLength(6)
  })

  it('nimmt die Wichtigkeit des wichtigsten Teils und merkt sich Alarm und Rueckschlag', () => {
    const grouped = groupEntries(
      [
        row('1', 130, 'ARMY_DESTROYED', { importance: 'normal' }),
        row('2', 129, 'ARMY_DESTROYED', { importance: 'major', severity: 'alert', self: true, audible: true }),
      ],
      24,
    )
    expect(grouped).toHaveLength(1)
    expect(grouped[0]!.importance).toBe('major')
    expect(grouped[0]!.severity).toBe('alert')
    expect(grouped[0]!.self).toBe(true)
    expect(grouped[0]!.audible).toBe(true)
  })

  it('zaehlt: 35 gleichartige Zeilen eines Tages werden drei, die Voreinstellung zeigt zwei', () => {
    const entries: EventEntry[] = []
    for (let i = 0; i < 12; i++) entries.push(row(`b${i}`, 120 + (i % 3), 'BOMBARDMENT', { importance: 'minor' }))
    for (let i = 0; i < 12; i++) entries.push(row(`m${i}`, 121 + (i % 3), 'ARMY_DEPARTED'))
    for (let i = 0; i < 11; i++) entries.push(row(`i${i}`, 122, 'ARMY_INTRUDED', { importance: 'major', severity: 'alert' }))
    const grouped = groupEntries(
      entries.sort((x, y) => y.tick - x.tick),
      24,
    )
    expect(entries).toHaveLength(35)
    expect(grouped).toHaveLength(3)
    expect(grouped.filter((entry) => entry.importance !== 'minor')).toHaveLength(2)
  })
})

describe('pingsFor: jedes hoerbare Ereignis pulsiert an seinem Ort', () => {
  it('liefert je Ton-Ereignis, das mich betrifft, einen Puls am Ort - nicht fuer Fremdes und Stummes', () => {
    const pings = pingsFor(
      [
        ev({ type: 'BATTLE_STARTED', severity: 'alert', provinceId: a }),
        ev({ type: 'BUILD_COMPLETED', provinceId: b }),
        ev({ type: 'RESOURCE_SHORTAGE', tick: 101, playerId: 'p1', resource: 'iron' }),
        ev({ type: 'WAR_DECLARED', tick: 102, playerId: 'p2', targetPlayerId: 'p1' }),
        ev({ type: 'ARMY_ARRIVED', provinceId: c }), // kein Ton
        ev({ type: 'BATTLE_STARTED', provinceId: c, concerns: ['p2'] }), // nicht meins
      ],
      'p1',
      capital,
    )
    expect(pings.map((p) => [p.provinceId, p.tone])).toEqual([
      [a, 'alert'],
      [b, 'good'],
      [a, 'info'], // Mangel -> eigene Hauptstadt
      [b, 'info'], // Krieg -> Hauptstadt der Gegenseite
    ])
  })

  it('einmal je Ort und Tick', () => {
    const pings = pingsFor(
      [
        ev({ type: 'ARMY_INTRUDED', provinceId: a, severity: 'alert' }),
        ev({ type: 'ARMY_INTRUDED', provinceId: a, severity: 'alert' }),
      ],
      'p1',
    )
    expect(pings).toHaveLength(1)
  })
})

describe('Der Puls selbst', () => {
  it('weitet sich und blendet aus, dauert PING_MS, und ohne Bewegung steht er still', () => {
    const start = pingFrame(0, true)!
    const mid = pingFrame(PING_MS / 2, true)!
    expect(mid.radius).toBeGreaterThan(start.radius)
    expect(mid.alpha).toBeLessThan(start.alpha)
    expect(pingFrame(PING_MS, true)).toBeNull()
    expect(pingFrame(10, false)).toEqual(pingFrame(PING_MS - 10, false))
  })

  it('fresh: nur Neue, nur Aktuelle, nur wenn der Ton erlaubt ist', () => {
    const list = [
      { id: 'x', provinceId: a, tick: 100, tone: 'alert' as const },
      { id: 'y', provinceId: b, tick: 50, tone: 'info' as const },
    ]
    expect(freshPings(list, new Set(), 101, true).map((p) => p.id)).toEqual(['x'])
    expect(freshPings(list, new Set(['x']), 101, true)).toEqual([])
    expect(freshPings(list, new Set(), 101, false)).toEqual([])
  })
})

describe('edgeMarker: ein Ort hinter dem Rand zeigt einen Pfeil am Rand', () => {
  it('im Bild: kein Pfeil', () => {
    expect(edgeMarker({ x: 100, y: 80 }, 400, 300)).toBeNull()
  })

  it('rechts davon: Pfeil am rechten Rand, Richtung 0', () => {
    const marker = edgeMarker({ x: 900, y: 150 }, 400, 300)!
    expect(marker.x).toBeCloseTo(386)
    expect(marker.y).toBeCloseTo(150)
    expect(marker.angle).toBeCloseTo(0)
  })

  it('schraeg darunter: Pfeil auf dem inneren Rahmen, nie ausserhalb', () => {
    const marker = edgeMarker({ x: -500, y: 900 }, 400, 300)!
    expect(marker.x).toBeGreaterThanOrEqual(14)
    expect(marker.x).toBeLessThanOrEqual(386)
    expect(marker.y).toBeCloseTo(286)
    expect(marker.angle).toBeGreaterThan(Math.PI / 2)
  })
})
