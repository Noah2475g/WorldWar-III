import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { GameEvent, MapData } from '@worldwar/core'
import { describe, expect, it } from 'vitest'
import { describeEvent, provinceOf } from './events.ts'

/**
 * The event log in words (T-M10-06, R-UI-07).
 *
 * The failure this guards against is the one that always ships: a log line reading
 * "PROVINCE_CAPTURED p2 DEU-NW". Every event carries ids, every log line has to carry
 * names, and a line about a place has to be able to take the player there.
 */

const ROOT = fileURLToPath(new URL('../../../..', import.meta.url))
const map = JSON.parse(readFileSync(`${ROOT}/data/maps/world.json`, 'utf8')) as MapData
const provinceId = map.provinces[0]!.id
const provinceName = map.provinces[0]!.name

const event = (over: Record<string, unknown>): GameEvent =>
  ({ tick: 120, severity: 'info', audience: [], ...over }) as unknown as GameEvent

describe('R-UI-07 Ereignisse werden zu Saetzen', () => {
  it('setzt den Provinznamen statt der Kennung ein', () => {
    const entry = describeEvent(event({ type: 'BATTLE_STARTED', provinceId }), 0, map)

    expect(entry.text).toContain(provinceName)
    expect(entry.text).not.toContain(provinceId)
  })

  it('haengt die Provinz an, damit die Zeile anspringbar ist', () => {
    const entry = describeEvent(event({ type: 'PROVINCE_CAPTURED', provinceId, playerId: 'p2' }), 0, map)

    expect(entry.provinceId).toBe(provinceId)
  })

  it('laesst eine Zeile ohne Ort ohne Sprungziel', () => {
    const entry = describeEvent(event({ type: 'GAME_STARTED' }), 0, map)

    expect(entry.provinceId).toBeUndefined()
    expect(entry.text.length).toBeGreaterThan(5)
  })

  it('uebersetzt Ressourcennamen mit', () => {
    const entry = describeEvent(event({ type: 'RESOURCE_SHORTAGE', resource: 'oil' }), 0, map)

    expect(entry.text).toContain('Öl')
    expect(entry.text).not.toContain('oil')
  })

  it('reicht die Dringlichkeit durch', () => {
    const alert = describeEvent(event({ type: 'WAR_DECLARED', severity: 'alert' }), 0, map)
    const plain = describeEvent(event({ type: 'DAY_REPORT', day: 3 }), 0, map)

    expect(alert.severity).toBe('alert')
    expect(plain.severity).toBe('info')
  })

  it('vergibt eindeutige Kennungen fuer die Liste', () => {
    const a = describeEvent(event({ type: 'BATTLE_STARTED', provinceId }), 0, map)
    const b = describeEvent(event({ type: 'BATTLE_STARTED', provinceId }), 1, map)

    expect(a.id).not.toBe(b.id)
  })

  it('findet die Provinz auch in einem anderen Feld', () => {
    expect(provinceOf(event({ type: 'ARMY_ARRIVED', targetProvinceId: 'DEU-NW' }))).toBe('DEU-NW')
    expect(provinceOf(event({ type: 'GAME_STARTED' }))).toBeUndefined()
  })

  it('laesst keinen unuebersetzten Schluessel durch', () => {
    // If an event type ever loses its text, the log must not print "[events.X]".
    const entry = describeEvent(event({ type: 'BUILD_COMPLETED', provinceId, building: 'Kaserne' }), 0, map)

    expect(entry.text.startsWith('[')).toBe(false)
  })
})
