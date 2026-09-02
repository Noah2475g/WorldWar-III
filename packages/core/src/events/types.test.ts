import { hashValue } from '@worldwar/shared'
import { describe, expect, it } from 'vitest'
import { alertsIn, emit, eventsFor } from './emit'
import { ALERT_TYPES, EVENT_TYPES, isAlertType, type GameEvent } from './types'

describe('R-GAME-06 Ereignistypen', () => {
  it('fuehrt jede Ereignisart genau einmal', () => {
    expect(new Set(EVENT_TYPES).size).toBe(EVENT_TYPES.length)
  })

  it('kennzeichnet Alarmereignisse als solche', () => {
    // These are the ones fast-forward must stop at (R-TIME-03/AK1).
    expect(isAlertType('PROVINCE_CAPTURED')).toBe(true)
    expect(isAlertType('ARMY_DESTROYED')).toBe(true)
    expect(isAlertType('WAR_DECLARED')).toBe(true)
    expect(isAlertType('BUILD_COMPLETED')).toBe(false)
    expect(isAlertType('DAY_REPORT')).toBe(false)
  })

  it('haelt die Alarmliste innerhalb der bekannten Arten', () => {
    for (const type of ALERT_TYPES) {
      expect(EVENT_TYPES).toContain(type)
    }
  })

  it('leitet den Schweregrad aus der Art ab, nicht aus dem Aufrufer', () => {
    const events: GameEvent[] = []
    emit(events, 5, 'PROVINCE_CAPTURED', {
      provinceId: 'alpha',
      previousOwner: 'p1',
      newOwner: 'p2',
    })
    emit(events, 5, 'BUILD_COMPLETED', {
      playerId: 'p1',
      provinceId: 'alpha',
      building: 'barracks',
      level: 1,
    })
    expect(events[0]!.severity).toBe('alert')
    expect(events[1]!.severity).toBe('info')
  })

  it('setzt Zeit und Empfaengerkreis', () => {
    const events: GameEvent[] = []
    emit(events, 17, 'RESOURCE_SHORTAGE', { playerId: 'p1', resource: 'food', audience: ['p1'] })
    expect(events[0]!.tick).toBe(17)
    expect(events[0]!.audience).toEqual(['p1'])

    emit(events, 17, 'DAY_REPORT', { day: 1, scores: { p1: 10 } })
    expect(events[1]!.audience).toEqual([]) // public by default
  })

  it('erzeugt reine, serialisierbare Daten', () => {
    const events: GameEvent[] = []
    emit(events, 1, 'BATTLE_RESOLVED', {
      battleId: 'b1',
      provinceId: 'alpha',
      losses: { p1: 1200, p2: 800 },
      victor: 'p1',
    })
    expect(JSON.parse(JSON.stringify(events))).toEqual(events)
    expect(() => hashValue(events)).not.toThrow()
  })

  it('nennt bei jedem Ereignis die betroffenen Kennungen', () => {
    const events: GameEvent[] = []
    emit(events, 1, 'ARMY_ARRIVED', { playerId: 'p1', armyId: 'a1', provinceId: 'beta' })
    const event = events[0] as Extract<GameEvent, { type: 'ARMY_ARRIVED' }>
    expect(event.armyId).toBe('a1')
    expect(event.provinceId).toBe('beta')
    expect(event.playerId).toBe('p1')
  })
})

describe('R-DIP-04 Ereignisse respektieren den Empfaengerkreis', () => {
  it('filtert nach Spieler', () => {
    const events: GameEvent[] = []
    emit(events, 1, 'RESOURCE_SHORTAGE', { playerId: 'p1', resource: 'oil', audience: ['p1'] })
    emit(events, 1, 'DAY_REPORT', { day: 1, scores: {} })

    expect(eventsFor(events, 'p1')).toHaveLength(2)
    expect(eventsFor(events, 'p2')).toHaveLength(1) // only the public one
  })

  it('sammelt Alarmereignisse fuer das Vorspulen', () => {
    const events: GameEvent[] = []
    emit(events, 1, 'BUILD_COMPLETED', { playerId: 'p1', provinceId: 'a', building: 'factory', level: 1 })
    emit(events, 1, 'ARMY_DESTROYED', { playerId: 'p1', armyId: 'a1', provinceId: 'a' })
    expect(alertsIn(events)).toHaveLength(1)
    expect(alertsIn(events)[0]!.type).toBe('ARMY_DESTROYED')
  })
})
