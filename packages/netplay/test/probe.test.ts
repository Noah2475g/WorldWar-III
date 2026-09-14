import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseRules, type GameConfig, type MapData, type Rules } from '@worldwar/core'
import {
  PROBE_TICKS,
  compareProbe,
  fingerprintOf,
  handshakeComplete,
  probeMessage,
  runProbe,
  welcome,
} from '../src/handshake'

/**
 * Die Determinismus-Probe vor dem ersten Zug (T-M38-03, R-MP-06/AK2, D28.6).
 *
 * **Gemessen auf der ausgelieferten Weltkarte mit dem ausgelieferten Regelwerk**, sechs
 * Mächte — nicht auf der Testkarte. Die Probe ist eine Aussage über die Partie, die jemand
 * wirklich spielt: was zwölf Provinzen in 24 Ticks nicht auseinanderbringt, sagt nichts
 * über 237.
 *
 * Drei Fragen werden hier beantwortet, und die dritte ist die, an der ein Prüfkriterium
 * sonst still durchwinkt (WORKFLOW §4 Falle 13):
 *
 * 1. Kommen zwei Läufe aus derselben Partiedefinition auf dieselbe Prüfsumme?
 * 2. Hält das Tor die Partie an, wenn sie es nicht tun?
 * 3. **Kann die Probe einen Unterschied überhaupt sehen?** Eine Probe über null Ticks wäre
 *    für jede Regeländerung grün, die erst im Lauf wirkt — und niemandem fiele es auf.
 */

const ROOT = fileURLToPath(new URL('../../../', import.meta.url))
const load = (path: string): never => JSON.parse(readFileSync(`${ROOT}${path}`, 'utf8')) as never

/**
 * Das Regelwerk frisch aus den Dateien — zweimal geladen ist zweimal ein eigenes Objekt.
 *
 * `patch` setzt einzelne Konstanten um, ohne die Dateien anzufassen: so sieht der Fall im
 * Betrieb aus, wenn der Gast einen älteren Bau hat. **Der Kern bleibt unberührt**, und
 * `data/rules` auch — die Änderung lebt nur in diesem Test.
 */
function freshRules(patch: Record<string, number> = {}): Rules {
  const constants = load('data/rules/default/constants.json') as unknown as Record<string, unknown>
  return parseRules(
    {
      constants: { ...constants, ...patch } as never,
      resources: load('data/rules/default/resources.json'),
      buildings: load('data/rules/default/buildings.json'),
      units: load('data/rules/default/units.json'),
      ai: load('data/rules/default/ai.json'),
    },
    'default',
  )
}

const map = load('data/maps/world.json') as MapData
const rules = freshRules()
const ctx = { map, rules }

/**
 * Sechs Mächte, zwei Menschen — die Aufstellung einer Partie zu zweit auf der Weltkarte.
 *
 * Die Nationen kommen aus den **Startaufstellungen der Karte selbst** und nicht aus einer
 * abgeschriebenen Liste: eine Nation, die es dort nicht gibt, lässt `createInitialState`
 * zu Recht fallen, und eine abgeschriebene Liste veraltet beim nächsten Kartenbau.
 */
const nations = map.startPositions.slice(0, 6).map((position) => position.nation)
const colors = ['farbe-eins', 'farbe-zwei', 'farbe-drei', 'farbe-vier', 'farbe-fuenf', 'farbe-sechs']

const config: GameConfig = {
  seed: 1914,
  mapId: map.id,
  rulesId: rules.id,
  players: nations.map((nation, index) => ({
    name: nation,
    kind: index < 2 ? ('human' as const) : ('ai' as const),
    nation,
    color: colors[index]!,
    ...(index < 2 ? {} : { difficulty: 'normal' as const }),
  })),
  victory: { condition: 'points', pointsShareToWin: 700, dayLimit: null },
}

describe('R-MP-06/AK2 Zwei Seiten rechnen 24 Ticks und vergleichen', () => {
  it('kommt aus derselben Partiedefinition auf dieselbe Pruefsumme', () => {
    // „Beide Seiten" im selben Prozess: dasselbe, was zwei Rechner tun, nur ohne Leitung.
    // Die zweite Seite laedt ihr Regelwerk NEU — ein eigenes Objekt, aus denselben Zahlen.
    const host = runProbe(config, ctx)
    const gast = runProbe(config, { map: load('data/maps/world.json') as MapData, rules: freshRules() })

    expect(host.ticks).toBe(PROBE_TICKS)
    expect(gast.hash).toBe(host.hash)
    expect(compareProbe(host, probeMessage(gast))).toEqual({ ok: true })
  })

  it('haelt die Partie an, wenn die Pruefsummen abweichen', () => {
    const host = runProbe(config, ctx)
    const fremd = probeMessage({ ...host, hash: '0000000000000000' })
    const result = compareProbe(host, fremd)

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.fault).toBe('probe')
    expect(result.ok === false && result.reason).toMatch(/beginnt nicht/)
  })

  it('unterscheidet verschieden lange Proben von verschiedenen Welten', () => {
    // Sonst schickte die Meldung den Naechsten auf die Suche nach einem Fehler im Kern,
    // den es nicht gibt.
    const host = runProbe(config, ctx)
    const kuerzer = probeMessage({ ...host, ticks: 12 })
    const result = compareProbe(host, kuerzer)

    expect(result.ok === false && result.reason).toMatch(/verschieden lang/)
  })

  it('laesst die Partie erst durch, wenn alle vier Pruefungen stimmen', () => {
    // Das Tor selbst: Fassung, Regelwerk, Karte, Probe. Ein einziger Ort dafuer.
    const abdruck = fingerprintOf(rules, map)
    const gruss = welcome(config, 'p2', abdruck, PROBE_TICKS)
    const host = runProbe(config, ctx)

    expect(handshakeComplete(abdruck, gruss, host, probeMessage(host))).toEqual({ ok: true })

    const andereKarte = welcome(config, 'p2', { ...abdruck, mapHash: 'anders' }, PROBE_TICKS)
    expect(handshakeComplete(abdruck, andereKarte, host, probeMessage(host)).ok).toBe(false)

    const andereProbe = probeMessage({ ...host, hash: 'anders' })
    expect(handshakeComplete(abdruck, gruss, host, andereProbe).ok).toBe(false)
  })
})

describe('R-MP-06/AK2 Die Probe sieht den Unterschied, den sie sehen soll', () => {
  it('faellt bei einer geaenderten Regelzahl der Tagesrechnung', () => {
    // Falle 13: ein Kriterium, das die Aenderung nicht sehen kann, winkt jede durch.
    // `moraleDriftDivisor` ist eine Zahl, die im Startzustand NICHT vorkommt und erst
    // wirkt, wenn ein Spieltag zu Ende gerechnet wird.
    const host = runProbe(config, ctx)
    const gast = runProbe(config, { map, rules: freshRules({ moraleDriftDivisor: 41 }) })

    expect(gast.hash).not.toBe(host.hash)
    expect(compareProbe(host, probeMessage(gast)).ok).toBe(false)
  })

  it('waere bei zwoelf Ticks blind — 24 ist die kleinste Zahl, die den Tag sieht', () => {
    // Die Messung, die PROBE_TICKS begruendet, und sie ist knapp: vier gemessene
    // Konstanten der Tagesrechnung (moraleDriftDivisor, baseTargetMorale,
    // foodSurplusBonus, ownNeighborBonus) werden **genau** bei Tick 24 sichtbar und bei
    // 12 nicht. Wer die Zahl als Stellknopf nach unten dreht, dreht die Probe ab.
    const geaendert = freshRules({ moraleDriftDivisor: 41 })

    const halb = [runProbe(config, ctx, 12), runProbe(config, { map, rules: geaendert }, 12)]
    expect(halb[0]!.hash, 'zwoelf Ticks sehen die Tagesrechnung nicht').toBe(halb[1]!.hash)

    const ganz = [runProbe(config, ctx, PROBE_TICKS), runProbe(config, { map, rules: geaendert }, PROBE_TICKS)]
    expect(ganz[0]!.hash).not.toBe(ganz[1]!.hash)
  })

  it('sagt auch, was sie NICHT sieht: die Gefechtskonstanten', () => {
    // Gemessen am 2026-09-14: `battleRate` und `minDamage` aendern die Pruefsumme auch
    // nach 48 Ticks nicht, weil in den ersten zwei Spieltagen kein Gefecht stattfindet.
    // Die Probe ist ein billiger frueher Widerleger und kein Beweis der Bitgleichheit —
    // ein Waechter, der mehr verspricht, als er kann, ist schlimmer als ein enger, der
    // sagt, was er kann. Dafuer traegt danach JEDE Befehlsnachricht ihre Pruefsumme
    // (T-M37-09), und die sieht alles.
    const host = runProbe(config, ctx)
    const kampf = runProbe(config, { map, rules: freshRules({ battleRate: 3, minDamage: 2 }) })

    expect(kampf.hash, 'ueberraschung: die Probe sieht jetzt doch Gefechtskonstanten').toBe(host.hash)
  })
})

describe('R-MP-06/AK2 Die Probe bleibt unter hundert Millisekunden', () => {
  it('rechnet 24 Ticks der Weltkarte in weniger als 100 ms', () => {
    // Grundlage: ein Tick kostet auf der Weltkarte 1,54 ms (gemessen 2026-09-12, sechs
    // Maechte), 24 Ticks also rund 37 ms. Wird sie teurer, ist PROBE_TICKS der
    // Stellknopf — nicht die Grenze. Eine Grenze anzuheben, damit eine Zahl passt, gilt
    // hier als Fehler.
    //
    // Der erste Lauf traegt das Aufwaermen des Uebersetzers; gemessen wird der schnellste
    // von dreien, wie jede Zeitmessung dieses Hauses (WORKFLOW §4 Falle 18).
    const zeiten = [runProbe(config, ctx), runProbe(config, ctx), runProbe(config, ctx)].map((p) => p.ms)
    const schnellster = Math.min(...zeiten)

    expect(schnellster, `Probe: ${zeiten.join(' / ')} ms`).toBeLessThan(100)
  })

  it('misst die Dauer, ohne selbst auf die Wanduhr zu sehen', () => {
    // Die Uhr wird hereingereicht — dieselbe Regel wie beim Pausenvertrag (T-M37-10).
    let jetzt = 1000
    const outcome = runProbe(config, ctx, 1, () => (jetzt += 7))

    expect(outcome.ms).toBe(7)
  })
})
