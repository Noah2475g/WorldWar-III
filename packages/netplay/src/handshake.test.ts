import { describe, expect, it } from 'vitest'
import type { GameConfig, MapData, Rules } from '@worldwar/core'
import { TEST_RULES, smallWorld } from '@worldwar/testkit'
import {
  accept,
  compareFingerprints,
  fingerprintOf,
  fingerprintOfWelcome,
  hello,
  welcome,
} from './handshake'
import { PROTOCOL_VERSION, envelope } from './protocol'

/**
 * Der Handschlag: Fassung, Regeln, Karte (T-M38-02, R-MP-06, D28.6).
 *
 * Ein Gast mit anderen Zahlen rechnet ein anderes Spiel. Das muss vor dem ersten Zug
 * auffallen und nicht nach dem ersten Gefecht — dann ist eine Stunde Partie verloren, und
 * niemand kann hinterher sagen, welche der beiden Welten die richtige war.
 */

const map = smallWorld()
const own = fingerprintOf(TEST_RULES, map)

const config: GameConfig = {
  seed: 1937,
  mapId: map.id,
  rulesId: TEST_RULES.id,
  players: [
    { name: 'Nordland', kind: 'human', nation: 'Nordland', color: 'farbe-eins' },
    { name: 'Ostmark', kind: 'human', nation: 'Ostmark', color: 'farbe-zwei' },
  ],
  victory: { condition: 'points', pointsShareToWin: 700, dayLimit: null },
}

describe('R-MP-06/AK1 Der Handschlag verhindert die Partie und nennt den Grund', () => {
  it('laesst zwei gleiche Seiten durch', () => {
    expect(compareFingerprints(own, fingerprintOf(TEST_RULES, map))).toEqual({ ok: true })
  })

  it('haelt eine fremde Protokollfassung auf', () => {
    const andere = { ...own, version: own.version + 1 }
    const result = compareFingerprints(own, andere)

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.fault).toBe('version')
    expect(result.ok === false && result.reason).toMatch(/Fassung/)
  })

  it('haelt ein anderes Regelwerk auf', () => {
    // Nicht erfunden: dieselbe Regelmappe mit einer geaenderten Zahl darin. Genau so
    // sieht der Fall im Betrieb aus - der Gast hat einen aelteren Bau.
    const geaendert: Rules = {
      ...TEST_RULES,
      constants: { ...TEST_RULES.constants, ticksPerDay: TEST_RULES.constants.ticksPerDay + 1 },
    }
    const result = compareFingerprints(own, fingerprintOf(geaendert, map))

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.fault).toBe('rules')
    expect(result.ok === false && result.reason).toMatch(/Regelwerk/)
  })

  it('haelt eine andere Karte auf', () => {
    const verschoben: MapData = {
      ...map,
      provinces: [...map.provinces].reverse(),
    }
    const result = compareFingerprints(own, fingerprintOf(TEST_RULES, verschoben))

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.fault).toBe('map')
    expect(result.ok === false && result.reason).toMatch(/Karte/)
  })

  it('bildet die Pruefsummen ueber die geladenen Daten und nicht ueber ihre Namen', () => {
    // Der Kern der Aufgabe. Zwei Regelwerke mit DEMSELBEN Namen und verschiedenen Zahlen
    // muessen verschiedene Pruefsummen haben - sonst belegte der Handschlag nichts.
    const gleicherName: Rules = {
      ...TEST_RULES,
      constants: { ...TEST_RULES.constants, ticksPerDay: TEST_RULES.constants.ticksPerDay + 1 },
    }
    expect(gleicherName.id).toBe(TEST_RULES.id)
    expect(fingerprintOf(gleicherName, map).rulesHash).not.toBe(own.rulesHash)

    const gleicheKennung: MapData = { ...map, provinces: [...map.provinces].reverse() }
    expect(gleicheKennung.id).toBe(map.id)
    expect(fingerprintOf(TEST_RULES, gleicheKennung).mapHash).not.toBe(own.mapHash)
  })

  it('nennt zuerst die Fassung, auch wenn alles drei abweicht', () => {
    // Die Reihenfolge ist gewaehlt: nach einer fremden Fassung bedeuten die anderen Felder
    // auf der Gegenseite moeglicherweise etwas anderes, und ein Vergleich waere geraten.
    const alles = { version: own.version + 1, rulesHash: 'x', mapHash: 'y' }
    const result = compareFingerprints(own, alles)
    expect(result.ok === false && result.fault).toBe('version')
  })
})

describe('R-MP-06 Die Nachrichten des Handschlags', () => {
  it('sagt hallo mit Namen und gewuenschter Nation', () => {
    expect(hello('Jonas', 'Ostmark')).toEqual({
      kind: 'hallo',
      version: PROTOCOL_VERSION,
      name: 'Jonas',
      nation: 'Ostmark',
    })
  })

  it('antwortet mit Partiedefinition, Platz, Pruefsummen und Probeauftrag', () => {
    const message = welcome(config, 'p2', own, 24, 10)

    expect(message.seat).toBe('p2')
    expect(message.config).toBe(config)
    expect(message.probeTicks).toBe(24)
    // Die feste Rate reist mit (T-M39-02, R-MP-02/AK1): sie ist das Einzige an einer
    // Partie zu zweit, was der Gast hinterher nicht mehr aendern kann.
    expect(message.fixedSpeed).toBe(10)
    expect(fingerprintOfWelcome(message)).toEqual(own)
  })

  it('reicht den Abdruck so weiter, dass die Gegenseite ihn vergleichen kann', () => {
    // Der ganze Weg in einer Zeile: Host baut, Gast liest, Gast vergleicht.
    const gast = fingerprintOf(TEST_RULES, map)
    expect(compareFingerprints(gast, fingerprintOfWelcome(welcome(config, 'p2', own, 24, 10)))).toEqual({
      ok: true,
    })
  })
})

describe('R-MP-06/AK3 Unbekanntes wird verworfen und gemeldet, nie geraten', () => {
  it('nimmt an, was das Protokoll kennt', () => {
    const message = { ...envelope('probe'), ticks: 24, hash: 'abc' }
    const result = accept(message)

    expect(result.ok).toBe(true)
    expect(result.ok === true && result.message).toEqual(message)
  })

  it('verwirft eine unbekannte Art und nennt sie', () => {
    const result = accept({ kind: 'schummeln', version: PROTOCOL_VERSION })

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.fault).toBe('message')
    expect(result.ok === false && result.reason).toMatch(/schummeln/)
  })

  it('verwirft eine fremde Fassung und nennt sie einen Fassungsstreit', () => {
    // Der Unterschied zaehlt: eine fremde Fassung beendet die Verbindung mit einer
    // Erklaerung, eine kaputte Nachricht ist ein Fehler auf der Leitung.
    const result = accept({ ...envelope('probe'), version: 99, ticks: 24, hash: 'abc' })

    expect(result.ok === false && result.fault).toBe('version')
  })

  it('verwirft eine Nachricht, der ein Feld fehlt — statt es zu erraten', () => {
    // Eine `befehle` ohne Pruefsumme waere die teuerste Art zu raten: das
    // Auseinanderlaufen faellt dann Stunden spaeter auf.
    const result = accept({ ...envelope('befehle'), tick: 3, commands: [] })

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.reason).toMatch(/Pruefsumme/)
  })

  it('verwirft, was gar keine Nachricht ist', () => {
    for (const unsinn of [null, 42, 'hallo', [], undefined]) {
      expect(accept(unsinn).ok, `${JSON.stringify(unsinn)} durfte nicht durchkommen`).toBe(false)
    }
  })
})
