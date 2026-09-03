import { describe, expect, it } from 'vitest'
import { condenseEvents, filterEvents, recentEvents } from './log'
import type { GameEvent } from './types'

const build = (tick: number, playerId = 'p1'): GameEvent => ({
  type: 'BUILD_COMPLETED',
  tick,
  severity: 'info',
  audience: [playerId],
  playerId,
  provinceId: 'n1',
  building: 'barracks',
  level: 1,
})

const captured = (tick: number): GameEvent => ({
  type: 'PROVINCE_CAPTURED',
  tick,
  severity: 'alert',
  audience: [],
  provinceId: 'm1',
  previousOwner: 'p2',
  newOwner: 'p1',
})

describe('R-GAME-06 Ereignisprotokoll filtern', () => {
  it('filtert nach Art', () => {
    const events = [build(1), captured(2), build(3)]
    expect(filterEvents(events, { types: ['BUILD_COMPLETED'] })).toHaveLength(2)
  })

  it('filtert nach Spieler und beachtet den Empfaengerkreis', () => {
    const events = [build(1, 'p1'), build(2, 'p2'), captured(3)]
    const forP1 = filterEvents(events, { playerId: 'p1' })
    expect(forP1.map((e) => e.type)).toEqual(['BUILD_COMPLETED', 'PROVINCE_CAPTURED'])
  })

  it('filtert nach Provinz und Zeitpunkt', () => {
    const events = [build(1), captured(5)]
    expect(filterEvents(events, { provinceId: 'm1' })).toHaveLength(1)
    expect(filterEvents(events, { sinceTick: 3 })).toHaveLength(1)
  })

  it('filtert nach Schweregrad', () => {
    const events = [build(1), captured(2)]
    expect(filterEvents(events, { severity: 'alert' })).toEqual([captured(2)])
  })

  it('liefert die juengsten Ereignisse zuerst', () => {
    const events = [build(1), build(2), build(3)]
    expect(recentEvents(events, 2).map((e) => e.tick)).toEqual([3, 2])
  })
})

describe('R-GAME-06 Verdichtung bei hohem Tempo', () => {
  it('buendelt Routineereignisse je Spieltag', () => {
    // Three skipped days must produce a digest, not four thousand lines.
    const events = [build(1), build(2), build(3), build(30), build(31)]
    const { digest } = condenseEvents(events, 24)

    expect(digest).toHaveLength(2)
    expect(digest[0]).toMatchObject({ day: 0, type: 'BUILD_COMPLETED', count: 3 })
    expect(digest[1]).toMatchObject({ day: 1, count: 2 })
  })

  it('laesst Alarme einzeln stehen', () => {
    // Losing a province while fast-forwarding must never be summarised away.
    const events = [build(1), captured(2), captured(3)]
    const { alerts, digest } = condenseEvents(events, 24)
    expect(alerts).toHaveLength(2)
    expect(digest).toHaveLength(1)
  })

  it('behaelt je Buendel einen Anknuepfungspunkt', () => {
    const events = [build(1), build(9)]
    const { digest } = condenseEvents(events, 24)
    expect(digest[0]!.latest.tick).toBe(9)
  })
})
