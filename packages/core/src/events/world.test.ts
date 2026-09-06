import { describe, expect, it } from 'vitest'
import { EVENT_TYPES, type EventType, type GameEvent } from './types'
import { WORLD_EVENT_TYPES, isWorldEventType, worldEventsIn } from './world'

/**
 * Weltgeschehen als Filter (T-M15-09, R-NEWS-04, R-GAME-06).
 *
 * Der Ersatz für die Zeitung. Geprüft wird vor allem eines: dass die Auswahl an der
 * **Art** hängt und nicht am Empfängerkreis — sonst wäre der Filter für einen
 * Unbeteiligten leer und hieße trotzdem „Weltgeschehen".
 */

const event = (type: EventType, audience: string[] = []): GameEvent =>
  ({ type, tick: 1, severity: 'info', audience, concerns: audience }) as GameEvent

describe('R-NEWS-04 Die Positivliste ist vollstaendig und gueltig', () => {
  it('nennt genau die acht vereinbarten Arten', () => {
    expect([...WORLD_EVENT_TYPES].sort()).toEqual(
      [
        'BATTLE_RESOLVED',
        'CAPITAL_LOST',
        'DIPLOMACY_CHANGED',
        'GAME_ENDED',
        'PLAYER_ELIMINATED',
        'PROVINCE_CAPTURED',
        'PROVINCE_REVOLTED',
        'WAR_DECLARED',
      ].sort(),
    )
  })

  it('kennt keine Art, die es im Spiel nicht gibt', () => {
    // Dieselbe Prüfung, die ALERT_TYPES schon hat: eine umbenannte Ereignisart würde die
    // Liste sonst still leerlaufen lassen, und der Filter zeigte nichts mehr an.
    for (const type of WORLD_EVENT_TYPES) {
      expect(EVENT_TYPES as readonly string[], `${type} ist keine bekannte Ereignisart`).toContain(type)
    }
  })
})

describe('R-NEWS-04 Die Auswahl haengt an der Art, nicht am Empfaengerkreis', () => {
  it('nimmt eine Kriegserklaerung zwischen zwei fremden Maechten auf', () => {
    // Der Kernfall. Wer wem den Krieg erklärt, ist öffentlich — auch wenn das Ereignis
    // seine Leserschaft auf die Beteiligten einschränkt, weil es zusätzlich Einzelheiten
    // trägt. Läse dieser Filter `audience`, wäre „Weltgeschehen" für einen Unbeteiligten
    // regelmäßig leer.
    const log = [event('WAR_DECLARED', ['p3', 'p5'])]

    expect(worldEventsIn(log)).toEqual(log)
  })

  it('laesst aus, was nicht auf der Liste steht', () => {
    const log = [event('TRADE_EXECUTED'), event('BUILD_COMPLETED'), event('RESOURCE_SHORTAGE')]

    expect(worldEventsIn(log)).toEqual([])
  })

  it('behaelt die Reihenfolge des Protokolls', () => {
    const log = [
      event('PROVINCE_CAPTURED'),
      event('TRADE_EXECUTED'),
      event('WAR_DECLARED'),
      event('BUILD_STARTED'),
      event('GAME_ENDED'),
    ]

    expect(worldEventsIn(log).map((entry) => entry.type)).toEqual([
      'PROVINCE_CAPTURED',
      'WAR_DECLARED',
      'GAME_ENDED',
    ])
  })

  it('laesst keine Art der Liste aus — geprueft ueber alle Arten des Spiels', () => {
    // Eigenschaftstest statt Aufzählung: ein Protokoll mit je einem Ereignis jeder Art
    // muss genau die acht liefern. Eine Liste, die eine Art vergisst, fällt hier auf.
    const log = EVENT_TYPES.map((type) => event(type))
    const gefunden = worldEventsIn(log).map((entry) => entry.type)

    expect([...gefunden].sort()).toEqual([...WORLD_EVENT_TYPES].sort())
    for (const type of EVENT_TYPES) {
      expect(gefunden.includes(type), `${type}`).toBe(isWorldEventType(type))
    }
  })
})
