import { describe, expect, it } from 'vitest'
import { RESOURCE_KEYS } from '@worldwar/core'
import { de } from './de.ts'
import { allKeys, hasKey, num, placeholdersOf, t } from './text.ts'

/**
 * The text catalogue (T-M11-04 and T-M10-08, R-UI-07).
 *
 * Two things are checked, and the second is the one that matters. That the lookup
 * works is easy. That the catalogue is *complete* — a German sentence for every
 * rejection the rules can produce, every event the simulation can emit, every resource
 * the rules define — is what keeps `[errors.ON_COOLDOWN]` off the screen.
 */

describe('R-UI-07 Textnachschlag', () => {
  it('findet einen Text und setzt Platzhalter ein', () => {
    expect(t('errors.ON_COOLDOWN', { days: 3 })).toBe('Das geht erst wieder in 3 Tagen.')
  })

  it('formatiert Zahlen deutsch', () => {
    expect(num(1234567)).toBe('1.234.567')
    expect(t('province.lastSeen', { day: 1234 })).toContain('1.234')
  })

  it('macht einen fehlenden Schluessel sichtbar, statt nichts zu liefern', () => {
    // An empty string is a button with no label and a bug report nobody can write.
    expect(t('gibt.es.nicht')).toBe('[gibt.es.nicht]')
    expect(hasKey('gibt.es.nicht')).toBe(false)
  })

  it('laesst einen unbefuellten Platzhalter stehen', () => {
    // A sentence with a visible hole is a bug report; a sentence missing a word is a
    // mystery that reaches the player as a half-sentence.
    expect(t('errors.ON_COOLDOWN')).toContain('{{days}}')
  })

  it('nennt die Platzhalter eines Textes', () => {
    expect(placeholdersOf('events.WAR_DECLARED').sort()).toEqual(['day', 'player', 'target'])
  })
})

describe('R-UI-07 Der Katalog ist vollstaendig', () => {
  it('hat fuer jeden Kommandofehler einen deutschen Satz', () => {
    // The list is the one from the rules; if a new rejection is added there and not
    // here, this fails rather than the interface printing a code at the player.
    const codes = [
      'UNKNOWN_PLAYER',
      'PLAYER_ELIMINATED',
      'UNKNOWN_COMMAND',
      'NOT_OWNER',
      'INSUFFICIENT_RESOURCES',
      'MISSING_BUILDING',
      'BUILDING_MAX_LEVEL',
      'NO_PATH',
      'ARMY_BUSY',
      'ARMY_NOT_FOUND',
      'PROVINCE_NOT_FOUND',
      'AT_WAR_REQUIRED',
      'OUT_OF_RANGE',
      'QUEUE_FULL',
      'INVALID_TARGET',
      'ON_COOLDOWN',
    ] as const

    for (const code of codes) {
      expect(hasKey(`errors.${code}`), `errors.${code} fehlt`).toBe(true)
      const text = t(`errors.${code}`)
      expect(text.length, code).toBeGreaterThan(15)
      expect(text.endsWith('.'), `${code} endet nicht auf einem Punkt`).toBe(true)
    }
  })

  it('hat fuer jede Ereignisart einen Satz', () => {
    const types = [
      'GAME_STARTED', 'COMMAND_REJECTED', 'BUILD_STARTED', 'BUILD_COMPLETED', 'BUILD_CANCELLED',
      'UNIT_RECRUITED', 'ARMY_DEPARTED', 'ARMY_ARRIVED', 'ARMY_DESTROYED', 'ARMY_RETREATED',
      'BATTLE_STARTED', 'BATTLE_RESOLVED', 'BOMBARDMENT', 'PROVINCE_CAPTURED', 'PROVINCE_REVOLTED',
      'RESOURCE_SHORTAGE', 'STORAGE_OVERFLOW', 'TRADE_EXECUTED', 'WAR_DECLARED', 'DIPLOMACY_CHANGED',
      'CAPITAL_LOST', 'CAPITAL_MOVED', 'PLAYER_ELIMINATED', 'GAME_ENDED', 'DAY_REPORT',
    ] as const

    for (const type of types) {
      expect(hasKey(`events.${type}`), `events.${type} fehlt`).toBe(true)
    }
    // And the other way round: no text for an event that does not exist.
    for (const key of Object.keys(de.events)) {
      expect(types as readonly string[], `events.${key} gehoert zu keinem Ereignis`).toContain(key)
    }
  })

  it('benennt jede Ressource der Regeln', () => {
    for (const key of RESOURCE_KEYS) {
      expect(hasKey(`resources.${key}`), `resources.${key} fehlt`).toBe(true)
    }
  })

  it('benennt jede Gelaendeart', () => {
    for (const terrain of ['plains', 'forest', 'mountain', 'desert', 'urban']) {
      expect(hasKey(`terrain.${terrain}`), `terrain.${terrain} fehlt`).toBe(true)
    }
  })

  it('laesst keinen leeren Text zu', () => {
    for (const key of allKeys()) {
      expect(t(key).trim().length, `${key} ist leer`).toBeGreaterThan(0)
    }
  })

  it('sagt bei jeder Ablehnung, was zu tun waere', () => {
    // A rejection that only names the obstacle sends the player looking; the ones that
    // can name a number or a next step do so.
    expect(t('errors.INSUFFICIENT_RESOURCES', { missing: '400 Eisen' })).toContain('400 Eisen')
    expect(t('errors.AT_WAR_REQUIRED')).toContain('Erklären Sie')
    expect(t('errors.QUEUE_FULL')).toContain('Bauplätze')
  })
})
