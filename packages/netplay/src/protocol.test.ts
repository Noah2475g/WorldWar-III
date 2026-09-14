import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createInitialState, type Command, type GameConfig } from '@worldwar/core'
import { TEST_RULES, smallWorld } from '@worldwar/testkit'
import {
  END_REASONS,
  MESSAGE_KINDS,
  PAUSE_KINDS,
  PROTOCOL_VERSION,
  decodeMessage,
  encodeMessage,
  envelope,
  parseMessage,
  type NetMessage,
} from './protocol'

/**
 * Die sieben Nachrichtenarten als Daten (T-M37-05, R-MP-03, D28.9, MEHRSPIELER.md §3.2).
 *
 * Zwei Zusicherungen, und beide sind die Hälfte wert, wenn die andere fehlt: jede Art
 * überlebt den Weg durch JSON unverändert, und was nicht passt, wird **abgelehnt und
 * gemeldet, nie geraten**. Eine halb verstandene Nachricht ist der kürzeste Weg zu zwei
 * verschiedenen Welten.
 */

const map = smallWorld()
const config: GameConfig = {
  seed: 7,
  mapId: map.id,
  rulesId: TEST_RULES.id,
  players: [
    { name: 'Nordland', kind: 'human', nation: 'Nordland', color: 'farbe-eins' },
    { name: 'Ostmark', kind: 'human', nation: 'Ostmark', color: 'farbe-zwei' },
  ],
  victory: { condition: 'points', pointsShareToWin: 700, dayLimit: null },
}

const state = createInitialState(config, { map, rules: TEST_RULES })

const befehl: Command = { type: 'SET_CAPITAL', playerId: 'p1', provinceId: map.startPositions[0]!.capital }

/** Eine gültige Nachricht je Art — die Liste ist die Prüfung, dass keine fehlt. */
const beispiele: Record<(typeof MESSAGE_KINDS)[number], NetMessage> = {
  hallo: { ...envelope('hallo'), name: 'Noah', nation: 'Ostmark' },
  willkommen: {
    ...envelope('willkommen'),
    config,
    seat: 'p2',
    rulesHash: '0123456789abcdef',
    mapHash: 'fedcba9876543210',
    probeTicks: 24,
  },
  probe: { ...envelope('probe'), ticks: 24, hash: '0123456789abcdef' },
  befehle: { ...envelope('befehle'), tick: 12, commands: [befehl], hash: '0123456789abcdef' },
  pause: { ...envelope('pause'), art: 'antrag', abTick: 14 },
  zustand: { ...envelope('zustand'), state },
  ende: { ...envelope('ende'), reason: 'auseinandergelaufen', tick: 99 },
}

describe('R-MP-03 Das Protokoll: sieben Arten, reines JSON, jede mit ihrer Fassung', () => {
  it('kennt genau die sieben Arten des Bauplans', () => {
    expect([...MESSAGE_KINDS]).toEqual(['hallo', 'willkommen', 'probe', 'befehle', 'pause', 'zustand', 'ende'])
    expect([...PAUSE_KINDS]).toEqual(['antrag', 'ja', 'nein', 'weiter'])
    expect([...END_REASONS]).toEqual(['sieg', 'abbruch', 'auseinandergelaufen', 'fassungsstreit'])
  })

  it('liest jede Art aus JSON und schreibt sie unveraendert wieder', () => {
    for (const kind of MESSAGE_KINDS) {
      const original = beispiele[kind]
      const zurueck = decodeMessage(encodeMessage(original))

      expect(zurueck.ok, `${kind}: ${zurueck.ok ? '' : zurueck.reason}`).toBe(true)
      if (!zurueck.ok) continue
      expect(zurueck.message, kind).toEqual(original)
      // Und die zweite Runde aendert auch nichts — sonst waere die erste ein Zufall.
      expect(encodeMessage(zurueck.message), kind).toBe(encodeMessage(original))
    }
  })

  it('traegt in jeder Art die Fassung mit', () => {
    for (const kind of MESSAGE_KINDS) {
      expect(beispiele[kind].version, kind).toBe(PROTOCOL_VERSION)
    }
  })

  it('lehnt eine unbekannte Art ab, statt sie zu raten', () => {
    const ergebnis = parseMessage({ kind: 'schummeln', version: PROTOCOL_VERSION })

    expect(ergebnis.ok).toBe(false)
    if (ergebnis.ok) return
    expect(ergebnis.reason).toMatch(/Unbekannte Nachrichtenart/)
    expect(ergebnis.reason).toMatch(/schummeln/)
  })

  it('lehnt eine fremde Fassung ab und sagt, welche erwartet war', () => {
    for (const version of [PROTOCOL_VERSION + 1, PROTOCOL_VERSION - 1, '1', null, undefined]) {
      const ergebnis = parseMessage({ ...beispiele.hallo, version })
      expect(ergebnis.ok, String(version)).toBe(false)
      if (!ergebnis.ok) expect(ergebnis.reason).toMatch(/Fassung/)
    }
  })

  it('lehnt eine Art mit fehlendem Feld ab, statt sie halb wirken zu lassen', () => {
    const ohne: Record<string, unknown>[] = [
      { ...beispiele.hallo, name: 42 },
      { ...beispiele.willkommen, seat: null },
      { ...beispiele.willkommen, probeTicks: -1 },
      { ...beispiele.probe, hash: 5 },
      { ...beispiele.befehle, tick: 1.5 },
      { ...beispiele.befehle, commands: [{ type: 'MOVE_ARMY' }] },
      { ...beispiele.befehle, commands: 'keine Liste' },
      { ...beispiele.pause, art: 'vielleicht' },
      { ...beispiele.pause, abTick: 'bald' },
      { ...beispiele.zustand, state: { ohneTick: true } },
      { ...beispiele.ende, reason: 'langeweile' },
      { ...beispiele.ende, tick: null },
    ]
    for (const raw of ohne) {
      const ergebnis = parseMessage(raw)
      expect(ergebnis.ok, JSON.stringify(raw).slice(0, 80)).toBe(false)
    }
  })

  it('nimmt weder kaputtes JSON noch etwas, das kein Objekt ist', () => {
    for (const text of ['{kein json', '[]', '"hallo"', 'null', '3']) {
      const ergebnis = decodeMessage(text)
      expect(ergebnis.ok, text).toBe(false)
    }
  })

  it('nimmt eine leere Befehlsliste an — je Tick genau eine Nachricht, auch leer', () => {
    const leer = { ...envelope('befehle'), tick: 0, commands: [], hash: '0000000000000000' }
    const ergebnis = parseMessage(leer)

    expect(ergebnis.ok).toBe(true)
  })
})

/**
 * D28.9: `packages/netplay` enthält **keinen** Netzcode.
 *
 * Das ist der Grund, warum der Rest dieses Meilensteins ohne eine einzige Leitung
 * belegbar ist — und es ist eine Zusage, die nur etwas wert ist, solange jemand sie
 * nachzählt. Der Netz-Wächter in `test/guards/no-network.test.ts` prüft den ganzen
 * Produktcode; dieser hier prüft dieses Paket noch einmal einzeln und schärfer, weil es
 * das Paket ist, dem man Netzcode am ehesten zutrauen würde.
 */
describe('R-MP-03 Das Protokollpaket kennt keine Leitung', () => {
  const dir = fileURLToPath(new URL('..', import.meta.url))
  /**
   * Der Produktcode des Pakets. Tests bleiben aussen vor — dieselbe Grenze wie in
   * `test/guards/scan.ts`, und aus demselben Grund: ein Test, der ein verbotenes Muster
   * nennt, um danach zu suchen, ist kein Verstoss gegen es.
   */
  const dateien = (unter: string): string[] => {
    const out: string[] = []
    for (const entry of readdirSync(unter, { withFileTypes: true })) {
      const full = join(unter, entry.name)
      if (entry.isDirectory()) out.push(...dateien(full))
      else if (/\.(ts|json)$/.test(entry.name) && !/\.test\.ts$/.test(entry.name)) out.push(full)
    }
    return out
  }

  it('durchsucht ueberhaupt Dateien — sonst bewacht der Waechter das Nichts', () => {
    expect(dateien(dir).length).toBeGreaterThanOrEqual(4)
  })

  it('nennt nirgends einen Netzzugriff', () => {
    const verboten = /fetch\s*\(|XMLHttpRequest|WebSocket|node:https?|navigator\.sendBeacon/
    const treffer = dateien(dir)
      .flatMap((datei) =>
        readFileSync(datei, 'utf8')
          .split('\n')
          .map((zeile, index) => ({ datei, zeile: index + 1, text: zeile }))
          .filter((eintrag) => verboten.test(eintrag.text)),
      )
      .map((eintrag) => `${eintrag.datei}:${eintrag.zeile} ${eintrag.text.trim()}`)

    expect(treffer, `Netzcode in packages/netplay:\n${treffer.join('\n')}`).toEqual([])
  })
})
