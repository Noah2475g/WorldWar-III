import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { canonicalText, hashValue } from '@worldwar/shared'
import { TEST_RULES, smallWorld } from '@worldwar/testkit'
import { describe, expect, it } from 'vitest'
import { parseRules } from '../rules/load'
import type { RawRules } from '../rules/types'
import { grantsPassage, relationKey, sharesMap } from '../state/create'
import { cloneState } from '../state/clone'
import { HASH_OMIT_KEYS, SCHEMA_VERSION, type GameState, type MapData, type Relation } from '../state/types'
import { step } from '../step'
import {
  ADDED_IN_VERSION_2,
  ADDED_IN_VERSION_3,
  ADDED_IN_VERSION_4,
  REMOVED_IN_VERSION_4,
  migrate,
  type SaveEnvelope,
} from './migrate'
import { deserialise, serialise } from './save'
import { validateState } from './validate'

/**
 * Der Schritt 3 → 4 (T-M17-03, R-GAME-09, D29.10).
 *
 * Gefahren an einem **eingefrorenen echten Stand der Stufe 3**
 * (`packages/core/test/golden/save-v3.json`, T-M17-02): 30 Spieltage Weltkarte, gespielt und
 * nicht geschrieben, mit gewährtem Durchmarsch, geteilter Karte, einem Bündnis und offenen
 * Friedensangeboten. Ein Stand ohne diese Felder hätte beim Schritt nichts zu verlieren —
 * und der Test wäre grün, ohne etwas zu belegen.
 *
 * **Dieser Schritt ist der erste, der etwas wegnimmt.** Bis hierher legte jede Migration
 * Felder an, und der Differenztest strich sie auf beiden Seiten. `rightOfWay` → `aGrantsPassage`
 * und `bGrantsPassage` ist eine **Umbenennung mit Richtung**: sie muss als solche geprüft
 * werden, sonst wäre der Unterschied „irgendwie anders" statt „genau diese Schlüssel".
 */

const load = (name: string): SaveEnvelope =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../../test/golden/${name}`, import.meta.url)), 'utf8')) as SaveEnvelope

const V1 = load('save-v1.json')
const V2 = load('save-v2.json')
const V3 = load('save-v3.json')
const copy = (envelope: SaveEnvelope): SaveEnvelope => JSON.parse(JSON.stringify(envelope)) as SaveEnvelope

/** Die ausgelieferte Weltkarte und die Standardregeln — damit ist save-v3.json entstanden. */
const ROOT = fileURLToPath(new URL('../../../..', import.meta.url))
const data = (path: string): unknown => JSON.parse(readFileSync(`${ROOT}/data/${path}`, 'utf8'))
const WELT = {
  map: data('maps/world.json') as MapData,
  rules: parseRules(
    {
      constants: data('rules/default/constants.json'),
      resources: data('rules/default/resources.json'),
      buildings: data('rules/default/buildings.json'),
      units: data('rules/default/units.json'),
      ai: data('rules/default/ai.json'),
    } as RawRules,
    'default',
  ),
}

/** Entfernt die genannten Schluessel in jeder Tiefe — was bleibt, darf sich nicht unterscheiden. */
function strip(value: unknown, keys: readonly string[]): unknown {
  if (Array.isArray(value)) return value.map((entry) => strip(entry, keys))
  if (value === null || typeof value !== 'object') return value
  const out: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (keys.includes(key)) continue
    out[key] = strip(entry, keys)
  }
  return out
}

const hashOf = (state: GameState) => hashValue(state, { omitKeys: HASH_OMIT_KEYS })
/** Die Beziehungen des eingefrorenen Standes, noch mit den Feldern der Stufe 3. */
const altRelationen = V3.state.diplomacy.relations as unknown as Record<string, Record<string, unknown>>

describe('R-GAME-09/AK1 Ein Stand der Stufe 3 laeuft nach der Migration weiter', () => {
  it('ist ein echter Stand der Stufe 3, der die Felder dieser Stufe wirklich traegt', () => {
    // Ohne diese Vorbedingung pruefte der Schritt einen Stand, an dem es nichts zu verlieren
    // gibt — dieselbe Falle wie bei `migration-v2.test.ts`, nur teurer: hier geht es um eine
    // Umbenennung, und ein Stand ohne gesetztes Recht koennte sie nicht von "loeschen"
    // unterscheiden.
    expect(V3.schemaVersion).toBe(3)
    expect(V3.state.schemaVersion).toBe(3)
    expect('espionage' in V3.state, 'der eingefrorene Stand stammt von nach dem Schritt').toBe(false)

    const werte = Object.values(altRelationen)
    expect(werte.length).toBeGreaterThan(0)
    expect(
      werte.some((relation) => relation['rightOfWay'] === true && relation['state'] !== 'alliance'),
      'kein gewaehrter Durchmarsch ausserhalb eines Buendnisses',
    ).toBe(true)
    expect(
      werte.some((relation) => relation['sharedMap'] === true && relation['state'] !== 'alliance'),
      'keine geteilte Karte ausserhalb eines Buendnisses',
    ).toBe(true)
    expect(werte.some((relation) => relation['state'] === 'alliance'), 'kein Buendnis').toBe(true)
    expect(werte.some((relation) => relation['rightOfWay'] === false), 'alle Beziehungen gewaehren — dann traegt "false" nichts').toBe(true)
    expect(V3.state.diplomacy.offers.length, 'kein offenes Angebot').toBeGreaterThan(0)
  })

  it('laedt ihn auf die aktuelle Stufe, mit leerer Spionage und leeren Handelsangeboten', () => {
    const state = deserialise(JSON.stringify(copy(V3)))

    expect(state.schemaVersion).toBe(SCHEMA_VERSION)
    expect(SCHEMA_VERSION).toBe(4)
    expect(state.espionage).toEqual({ spies: [], reveals: [] })
    expect(state.diplomacy.tradeOffers).toEqual([])
    expect(state.nextIds.spy).toBe(1)
    expect(state.nextIds.offer).toBe(1)
    // Die Zaehler, die es schon gab, bleiben stehen — eine Migration erfindet keine Kennungen.
    expect(state.nextIds.army).toBe((V3.state.nextIds as unknown as Record<string, number>)['army'])
  })

  it('uebernimmt Durchmarsch und Karte in BEIDE Richtungen — verhaltensgleich', () => {
    const state = deserialise(JSON.stringify(copy(V3)))

    let gewaehrt = 0
    let geteilt = 0
    for (const [key, relation] of Object.entries(state.diplomacy.relations)) {
      const alt = altRelationen[key]!
      const passage = alt['rightOfWay'] === true
      const karte = alt['sharedMap'] === true
      if (passage) gewaehrt++
      if (karte) geteilt++

      expect(relation.aGrantsPassage, key).toBe(passage)
      expect(relation.bGrantsPassage, key).toBe(passage)
      expect(relation.aSharesMap, key).toBe(karte)
      expect(relation.bSharesMap, key).toBe(karte)
      // Unbefristet: bis Stufe 3 gab es keine andere Moeglichkeit, und eine erfundene Frist
      // nimmt einem Spieler ein Recht weg, das er sich erspielt hat.
      expect(relation.aPassageEndsAtTick, key).toBeNull()
      expect(relation.bPassageEndsAtTick, key).toBeNull()

      const [a, b] = key.split('|') as [string, string]
      expect(grantsPassage(state, a, b), key).toBe(passage)
      expect(grantsPassage(state, b, a), key).toBe(passage)
      expect(sharesMap(state, a, b), key).toBe(karte)
      expect(sharesMap(state, b, a), key).toBe(karte)
    }

    // Ueber einer leeren Menge waere jede Zusicherung oben wahr.
    expect(gewaehrt, 'kein uebernommener Durchmarsch').toBeGreaterThan(0)
    expect(geteilt, 'keine uebernommene Karte').toBeGreaterThan(0)
  })

  it('aendert nichts ausser den neuen und den entfernten Schluesseln', () => {
    const after = migrate(copy(V3)).state
    const beide = [...ADDED_IN_VERSION_4, ...REMOVED_IN_VERSION_4]

    expect(canonicalText(strip(after, beide))).toBe(canonicalText(strip(V3.state, beide)))
    expect(REMOVED_IN_VERSION_4).toEqual(['rightOfWay', 'sharedMap'])
  })

  it('nimmt rightOfWay und sharedMap wirklich aus dem Zustand', () => {
    // Die Gegenprobe zum Test davor: der streicht beide Listen: waeren die alten Schluessel
    // noch da, faende er es nicht. Ein migrierter Stand, der beides traegt, waere doppelt
    // gefuehrt — und die naechste Aufgabe wuesste nicht, welches Feld gilt.
    const text = JSON.stringify(migrate(copy(V3)).state)

    expect(text).not.toContain('"rightOfWay"')
    expect(text).not.toContain('"sharedMap"')
    expect(text).toContain('"aGrantsPassage"')
    expect(text).toContain('"bSharesMap"')
  })

  it('ist nach Speichern und Laden hashgleich (AK1)', () => {
    const migrated = deserialise(JSON.stringify(copy(V3)))
    const again = deserialise(serialise(migrated))

    expect(hashOf(again)).toBe(hashOf(migrated))
  })

  it('laeuft danach zwei Spieltage auf seiner Weltkarte weiter und bleibt ladbar', () => {
    // Bis zum 2026-09-24 stand hier `copy(V2)` auf `smallWorld` — ein Stand der Stufe 2 mit
    // zwei Maechten und einer Beziehung ohne Freigaben. Die Zusage „save-v3.json laeuft nach
    // der Migration" hatte damit keinen Test, der den Stand auch nur einen Tick rechnete
    // (Nacharbeit zu T-M17-03). Jetzt laeuft der eingefrorene Stand selbst, auf der Karte und
    // mit den Regeln, mit denen er entstanden ist: acht Maechte, 237 Provinzen, gewaehrter
    // Durchmarsch und geteilte Karte ohne Buendnis.
    let state = deserialise(JSON.stringify(copy(V3)))
    for (let i = 0; i < 48; i++) state = step(state, [], WELT).state

    expect(state.tick).toBe(V3.savedAtTick + 48)
    expect(state.espionage).toEqual({ spies: [], reveals: [] })
    expect(hashOf(deserialise(serialise(state)))).toBe(hashOf(state))
  })

  it('rechnet nach Speichern und Laden dasselbe wie ohne Unterbrechung', () => {
    // Laufen allein reicht nicht: ein migrierter Stand, der nach dem Laden anders
    // weiterrechnet als im Speicher, laeuft auch — nur in eine andere Partie.
    const start = deserialise(JSON.stringify(copy(V3)))
    let durch = start
    for (let i = 0; i < 48; i++) durch = step(durch, [], WELT).state

    let geteilt = start
    for (let i = 0; i < 24; i++) geteilt = step(geteilt, [], WELT).state
    geteilt = deserialise(serialise(geteilt))
    for (let i = 0; i < 24; i++) geteilt = step(geteilt, [], WELT).state

    expect(hashOf(geteilt)).toBe(hashOf(durch))
  })

  it('weist einen Stand ohne die Felder der Stufe 4 ab, statt ihn halb zu verstehen', () => {
    const ohneSpionage = migrate(copy(V3)).state as unknown as Record<string, unknown>
    delete ohneSpionage['espionage']
    expect(() => validateState(ohneSpionage)).toThrow(/espionage/)

    const ohneHandel = migrate(copy(V3)).state as unknown as Record<string, unknown>
    delete (ohneHandel['diplomacy'] as Record<string, unknown>)['tradeOffers']
    expect(() => validateState(ohneHandel)).toThrow(/tradeOffers/)
  })
})

describe('R-GAME-09/AK2 Ein Stand der Stufe 1 oder 2 laeuft ueber alle Schritte', () => {
  it('fuehrt save-v1.json und save-v2.json auf die aktuelle Stufe', () => {
    for (const [name, envelope] of [
      ['save-v1.json', V1],
      ['save-v2.json', V2],
    ] as const) {
      const state = deserialise(JSON.stringify(copy(envelope)))

      expect(state.schemaVersion, name).toBe(SCHEMA_VERSION)
      expect(state.espionage, name).toEqual({ spies: [], reveals: [] })
      expect(state.diplomacy.tradeOffers, name).toEqual([])
      for (const relation of Object.values(state.diplomacy.relations)) {
        expect(relation.aGrantsPassage, name).toBe(relation.bGrantsPassage)
        expect(relation.aSharesMap, name).toBe(relation.bSharesMap)
      }
    }
  })

  it('liefert in einem Zug dasselbe wie Schritt fuer Schritt', () => {
    const direct = migrate(copy(V1))
    const stepwise = migrate(migrate(migrate(copy(V1), undefined, 2), undefined, 3), undefined, 4)

    expect(canonicalText(stepwise)).toBe(canonicalText(direct))
  })

  it('aendert nichts ausser den Feldern aller drei Schritte', () => {
    const after = migrate(copy(V1)).state
    const alle = [...ADDED_IN_VERSION_2, ...ADDED_IN_VERSION_3, ...ADDED_IN_VERSION_4, ...REMOVED_IN_VERSION_4]

    expect(canonicalText(strip(after, alle))).toBe(canonicalText(strip(V1.state, alle)))
  })

  it('ist nach Speichern und Laden hashgleich (AK2)', () => {
    for (const envelope of [V1, V2]) {
      const migrated = deserialise(JSON.stringify(copy(envelope)))
      expect(hashOf(deserialise(serialise(migrated)))).toBe(hashOf(migrated))
    }
  })

  it('laeuft danach zwei Spieltage weiter und bleibt ladbar (AK2)', () => {
    // Beide eingefrorenen Staende stammen von der Testkarte `testworld`. Bis zum 2026-09-24
    // lief hier nur save-v2.json, und zwar im Block von AK1; save-v1.json wurde nach der
    // Kette 1 → 4 nie gerechnet.
    const ctx = { map: smallWorld(), rules: TEST_RULES }
    for (const [name, envelope] of [
      ['save-v1.json', V1],
      ['save-v2.json', V2],
    ] as const) {
      let state = deserialise(JSON.stringify(copy(envelope)))
      for (let i = 0; i < 48; i++) state = step(state, [], ctx).state

      expect(state.tick, name).toBe(envelope.savedAtTick + 48)
      expect(state.espionage, name).toEqual({ spies: [], reveals: [] })
      expect(hashOf(deserialise(serialise(state))), name).toBe(hashOf(state))
    }
  })
})

describe('cloneState teilt keine Referenz mit den neuen Feldern', () => {
  const spion = {
    id: 's1',
    owner: 'p1',
    provinceId: 'n1',
    mission: 'intel' as const,
    recruitedTick: 10,
    assignedTick: 10,
    lastRunTick: null,
    lastOutcome: null,
  }
  const angebot = {
    id: 'o1',
    from: 'p1',
    to: 'p2',
    give: { resources: { iron: 5_000 }, provinces: ['n1'] },
    want: { resources: { food: 1_000 }, provinces: [] },
    createdTick: 10,
    expiresAtTick: 100,
  }

  const gefuellt = (): GameState => {
    const state = deserialise(JSON.stringify(copy(V2)))
    const ersteMacht = state.playerOrder[0]!
    const zweiteMacht = state.playerOrder[1]!
    state.espionage.spies.push({ ...spion, owner: ersteMacht, provinceId: state.provinceOrder[0]! })
    state.espionage.reveals.push({ player: ersteMacht, provinceId: state.provinceOrder[0]!, kind: 'intel', untilTick: 99 })
    state.diplomacy.tradeOffers.push({ ...angebot, from: ersteMacht, to: zweiteMacht })
    return state
  }

  it('kopiert Spione, Aufdeckungen und Handelsangebote elementweise', () => {
    const state = gefuellt()
    const klon = cloneState(state)

    expect(klon.espionage.spies[0]).not.toBe(state.espionage.spies[0])
    expect(klon.espionage.reveals[0]).not.toBe(state.espionage.reveals[0])
    expect(klon.diplomacy.tradeOffers[0]).not.toBe(state.diplomacy.tradeOffers[0])
    // Zwei Ebenen tiefer, und genau hier waere ein Spread stillschweigend falsch.
    expect(klon.diplomacy.tradeOffers[0]!.give.resources).not.toBe(state.diplomacy.tradeOffers[0]!.give.resources)
    expect(klon.diplomacy.tradeOffers[0]!.give.provinces).not.toBe(state.diplomacy.tradeOffers[0]!.give.provinces)
    expect(klon.diplomacy.tradeOffers[0]!.want.resources).not.toBe(state.diplomacy.tradeOffers[0]!.want.resources)
    expect(klon.nextIds).not.toBe(state.nextIds)
  })

  it('laesst den Ausgangszustand unveraendert, wenn der Klon sich aendert', () => {
    // Die Frage hinter allen `not.toBe`: aendert sich der "vorherige" Zustand mit? Genau das
    // ist der Determinismusfehler, den `clone.ts` in seinem Kopf beschreibt.
    const state = gefuellt()
    const vorher = hashOf(state)
    const klon = cloneState(state)

    klon.espionage.spies[0]!.mission = 'counter'
    klon.espionage.reveals[0]!.untilTick = 1
    klon.diplomacy.tradeOffers[0]!.give.resources.iron = 1
    klon.diplomacy.tradeOffers[0]!.give.provinces.push('n2')
    klon.nextIds.spy = 99

    expect(hashOf(state)).toBe(vorher)
    expect(state.espionage.spies[0]!.mission).toBe('intel')
    expect(state.diplomacy.tradeOffers[0]!.give.provinces).toEqual(['n1'])
    expect(state.nextIds.spy).toBe(1)
  })

  it('kopiert auch die gerichteten Beziehungsfelder, ohne sie zu teilen', () => {
    const state = deserialise(JSON.stringify(copy(V3)))
    const schluessel = relationKey(state.playerOrder[0]!, state.playerOrder[1]!)
    const klon = cloneState(state)

    klon.diplomacy.relations[schluessel]!.aGrantsPassage = true
    klon.diplomacy.relations[schluessel]!.bPassageEndsAtTick = 500

    const original: Relation = state.diplomacy.relations[schluessel]!
    expect(original.aGrantsPassage).toBe(altRelationen[schluessel]!['rightOfWay'] === true)
    expect(original.bPassageEndsAtTick).toBeNull()
  })
})

/**
 * Ein Stand der Stufe 4 wird auf die Felder dieser Stufe geprueft — auf BEIDEN Ladewegen
 * (R-GAME-05, Nacharbeit zu T-M17-03, 2026-09-24).
 *
 * Bis hierher pruefte `validateState` `espionage` nur als Objekt und die gerichteten Felder gar
 * nicht, und `deserialise` rief die Pruefung nur fuer migrierte Staende. Nachgestellt: ein Stand
 * mit `espionage: {}` wurde angenommen und warf im ersten Tick einen TypeError aus `cloneState`;
 * ein Stand der Stufe 4 mit den ALTEN Schluesseln `rightOfWay`/`sharedMap` und gueltiger
 * Pruefsumme lud still — und jeder gewaehrte Durchmarsch war danach weg. Ein Stand, der die
 * Pruefsumme besteht, ist nur unveraendert, nicht vollstaendig: er kann aus einem Bau stammen,
 * der ein Feld noch nicht kannte, ohne die Stufe zu heben.
 */
describe('R-GAME-05 Ein Stand der Stufe 4 wird auf die Felder dieser Stufe geprueft', () => {
  const migriert = (): Record<string, unknown> => migrate(copy(V3)).state as unknown as Record<string, unknown>
  /** Ein Umschlag der aktuellen Stufe mit GUELTIGER Pruefsumme — er laeuft ueber den Hash-Weg. */
  const mitPruefsumme = (state: Record<string, unknown>): string => serialise(state as unknown as GameState)
  const erstesPaar = (state: Record<string, unknown>) =>
    Object.values((state['diplomacy'] as { relations: Record<string, Record<string, unknown>> }).relations)[0]!

  it('nimmt einen vollstaendigen Stand an, auch mit Spion, Aufdeckung und Handelsangebot', () => {
    const state = deserialise(JSON.stringify(copy(V3)))
    const [erste, zweite] = state.playerOrder as [string, string]
    state.espionage.spies.push({
      id: 's1',
      owner: erste,
      provinceId: state.provinceOrder[0]!,
      mission: 'intel',
      recruitedTick: 10,
      assignedTick: 10,
      lastRunTick: null,
      lastOutcome: null,
    })
    state.espionage.reveals.push({ player: erste, provinceId: state.provinceOrder[0]!, kind: 'intel', untilTick: 99 })
    state.diplomacy.tradeOffers.push({
      id: 'o1',
      from: erste,
      to: zweite,
      give: { resources: { iron: 5_000 }, provinces: [] },
      want: { resources: {}, provinces: [] },
      createdTick: 10,
      expiresAtTick: 100,
    })

    expect(() => validateState(state)).not.toThrow()
    expect(hashOf(deserialise(serialise(state)))).toBe(hashOf(state))
  })

  it('weist eine Spionage ohne Listen ab (espionage: {})', () => {
    const state = migriert()
    state['espionage'] = {}
    expect(() => validateState(state)).toThrow(/espionage\.spies/)

    const halb = migriert()
    halb['espionage'] = { spies: [] }
    expect(() => validateState(halb)).toThrow(/espionage\.reveals/)
  })

  it('weist fehlende Zaehler fuer Spione und Handelsangebote ab', () => {
    const state = migriert()
    delete (state['nextIds'] as Record<string, unknown>)['spy']
    expect(() => validateState(state)).toThrow(/nextIds\.spy/)

    const ohneAngebot = migriert()
    ;(ohneAngebot['nextIds'] as Record<string, unknown>)['offer'] = '1'
    expect(() => validateState(ohneAngebot)).toThrow(/nextIds\.offer/)
  })

  it('weist eine Beziehung mit den alten Schluesseln statt der gerichteten Felder ab', () => {
    const state = migriert()
    const paar = erstesPaar(state)
    for (const key of ['aGrantsPassage', 'bGrantsPassage', 'aPassageEndsAtTick', 'bPassageEndsAtTick', 'aSharesMap', 'bSharesMap']) {
      delete paar[key]
    }
    paar['rightOfWay'] = true
    paar['sharedMap'] = true
    expect(() => validateState(state)).toThrow(/aGrantsPassage/)
    expect(() => validateState(state)).toThrow(/rightOfWay/)
  })

  it('weist eine Frist ab, die weder Zahl noch null ist', () => {
    const state = migriert()
    erstesPaar(state)['bPassageEndsAtTick'] = undefined
    expect(() => validateState(state)).toThrow(/bPassageEndsAtTick/)
  })

  it('weist ein Handelsangebot ohne Buendel ab', () => {
    const state = deserialise(JSON.stringify(copy(V3))) as unknown as Record<string, unknown>
    const diplomacy = state['diplomacy'] as { tradeOffers: unknown[] }
    diplomacy.tradeOffers.push({ id: 'o1', from: 'p1', to: 'p2', want: { resources: {}, provinces: [] }, createdTick: 1, expiresAtTick: 2 })
    expect(() => validateState(state)).toThrow(/tradeOffers/)
  })

  it('prueft auch einen Stand mit gueltiger Pruefsumme — ohne espionage', () => {
    const state = migriert()
    delete state['espionage']
    const text = mitPruefsumme(state)
    expect(JSON.parse(text).schemaVersion, 'der Umschlag muss den Hash-Weg nehmen').toBe(SCHEMA_VERSION)

    expect(() => deserialise(text)).toThrow(/espionage/)
  })

  it('prueft auch einen Stand mit gueltiger Pruefsumme — mit den alten Schluesseln der Stufe 3', () => {
    const state = migriert()
    for (const paar of Object.values((state['diplomacy'] as { relations: Record<string, Record<string, unknown>> }).relations)) {
      paar['rightOfWay'] = paar['aGrantsPassage']
      paar['sharedMap'] = paar['aSharesMap']
      for (const key of ['aGrantsPassage', 'bGrantsPassage', 'aPassageEndsAtTick', 'bPassageEndsAtTick', 'aSharesMap', 'bSharesMap']) {
        delete paar[key]
      }
    }

    expect(() => deserialise(mitPruefsumme(state))).toThrow(/rightOfWay/)
  })
})
