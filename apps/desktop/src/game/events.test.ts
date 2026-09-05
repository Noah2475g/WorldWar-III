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

describe('R-UI-07 Keine Kennung erreicht das Protokoll', () => {
  // Found in the first smoke test: "Bau von barracks begonnen", "Befehl abgelehnt:
  // {{reason}}", and a march that named its origin as its destination.
  const nations: Record<string, string> = { p1: 'Deutschland', p2: 'Russland' }
  const naming = {
    player: (id: string) => nations[id] ?? id,
    army: (id: string) => `Armee ${id.slice(1)}`,
    ticksPerDay: 24,
  }

  it('uebersetzt Gebaeude und Einheiten', () => {
    const built = describeEvent(event({ type: 'BUILD_STARTED', provinceId, building: 'barracks' }), 0, map)
    expect(built.text).toContain('Kaserne')
    expect(built.text).not.toContain('barracks')

    const recruited = describeEvent(
      event({ type: 'UNIT_RECRUITED', provinceId, unitKey: 'infantry', count: 3, armyId: 'a1' }),
      0,
      map,
    )
    expect(recruited.text).toContain('3 Infanterie')
    expect(recruited.text).not.toContain('infantry')
  })

  it('nennt bei einer Ablehnung den Grund in Worten', () => {
    const entry = describeEvent(
      event({ type: 'COMMAND_REJECTED', playerId: 'p1', command: 'BUILD', code: 'QUEUE_FULL' }),
      0,
      map,
    )

    expect(entry.text).not.toContain('{{')
    expect(entry.text).toContain('Bauplätze')
  })

  it('nennt Spieler bei ihrer Nation', () => {
    const captured = describeEvent(
      event({ type: 'PROVINCE_CAPTURED', provinceId, previousOwner: 'p1', newOwner: 'p2' }),
      0,
      map,
      naming,
    )
    expect(captured.text).toContain('Russland')
    expect(captured.text).not.toMatch(/\bp\d\b/)

    const war = describeEvent(
      event({
        type: 'WAR_DECLARED',
        playerId: 'p2',
        targetPlayerId: 'p1',
        effectiveAtTick: 48,
        withoutDeclaration: false,
      }),
      0,
      map,
      naming,
    )
    expect(war.text).toContain('Russland erklärt Deutschland')
    expect(war.text).toContain('Tag 3')
  })

  it('nennt eine Armee bei ihrem Namen und ein Gefecht bei seinem Sieger', () => {
    const arrived = describeEvent(
      event({ type: 'ARMY_ARRIVED', playerId: 'p1', armyId: 'a7', provinceId }),
      0,
      map,
      naming,
    )
    expect(arrived.text).toContain('Armee 7')

    const resolved = describeEvent(
      event({ type: 'BATTLE_RESOLVED', battleId: 'b1', provinceId, losses: {}, victor: null }),
      0,
      map,
      naming,
    )
    expect(resolved.text).toContain('niemand')
    expect(resolved.text).not.toContain('{{')
  })

  it('springt beim Marsch zum Ziel, nicht zum Start', () => {
    const from = map.provinces[0]!
    const to = map.provinces[1]!
    const entry = describeEvent(
      event({
        type: 'ARMY_DEPARTED',
        playerId: 'p1',
        armyId: 'a1',
        fromProvinceId: from.id,
        toProvinceId: to.id,
        arrivalTick: 130,
      }),
      0,
      map,
      naming,
    )

    expect(entry.provinceId).toBe(to.id)
    expect(entry.text).toContain(`nach ${to.name}`)
  })

  it('beschreibt einen Handel mit beiden Seiten', () => {
    const entry = describeEvent(
      event({
        type: 'TRADE_EXECUTED',
        playerId: 'p1',
        give: 'wood',
        giveAmount: 400000,
        want: 'iron',
        wantAmount: 250000,
      }),
      0,
      map,
    )

    expect(entry.text).toBe('400 Material gegen 250 Eisen getauscht.')
  })
})

describe('R-BAT-07 Der Kampfbericht nennt die Verluste beider Seiten', () => {
  const naming = { player: (id: string) => (id === 'p1' ? 'Deutschland' : 'Frankreich') }

  it('nennt beide Seiten mit ihren Verlusten', () => {
    // Befund 9: Der Kern erzeugt BATTLE_RESOLVED mit `losses: Record<PlayerId, Fixed>`
    // seit M4. Die Anwendung uebernahm in die Textwerte nur flache Zahlen und
    // Zeichenketten — `losses` ist ein Objekt und fiel still heraus. Der Spieler erfuhr
    // nach einem Gefecht nur, wer das Feld behauptet, nicht was es gekostet hat, und
    // R-BAT-07 ('Kampfbericht mit Verlusten beider Seiten, nachlesbar') war damit im
    // Kern erfuellt und in der Oberflaeche gar nicht gebaut.
    const entry = describeEvent(
      event({ type: 'BATTLE_RESOLVED', provinceId, victor: 'p1', losses: { p1: 3000, p2: 12_000 } }),
      0,
      map,
      naming,
    )

    expect(entry.text).toContain('Deutschland')
    expect(entry.text).toContain('Frankreich')
    expect(entry.text).toMatch(/Verluste/)
  })

  it('sagt es, wenn niemand etwas verloren hat', () => {
    const entry = describeEvent(
      event({ type: 'BATTLE_RESOLVED', provinceId, victor: 'p1', losses: {} }),
      0,
      map,
      naming,
    )
    expect(entry.text).toMatch(/keine/)
  })

  it('laesst keine Kennung durch', () => {
    const entry = describeEvent(
      event({ type: 'BATTLE_RESOLVED', provinceId, victor: 'p1', losses: { p1: 100, p2: 200 } }),
      0,
      map,
      naming,
    )
    expect(entry.text).not.toMatch(/\bp1\b|\bp2\b/)
  })
})
