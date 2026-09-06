import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { canonicalText, hashValue } from '@worldwar/shared'
import { TEST_RULES, smallWorld } from '@worldwar/testkit'
import { describe, expect, it } from 'vitest'
import { createInitialState, type GameConfig } from '../state/create'
import { HASH_OMIT_KEYS, SCHEMA_VERSION } from '../state/types'
import { ADDED_IN_VERSION_2, highestMigration, migrate, type SaveEnvelope } from './migrate'
import { SaveFormatError, deserialise, serialise } from './save'
import { InvalidStateError, validateState } from './validate'

/**
 * Die erste echte Migration (T-M15-04, R-GAME-07).
 *
 * `MIGRATIONS` war bis zum 2026-09-06 ein leeres Objekt mit einem auskommentierten
 * Beispiel — die Kette ist **nie gelaufen**. Genau in dieser Lücke lagen zwei Löcher:
 *
 *  - `migrate` entfernt nach jedem Schritt den Hash (richtig — er beschreibt den Zustand
 *    *vor* der Umstellung), und `save.ts` prüfte nur `if (migrated.hash)`. Ab dem ersten
 *    echten Schritt wäre **jeder** migrierte Stand ungeprüft durchgelaufen, auch `{}`.
 *  - Es gab zwei Versionsnummern, die im Umschlag und die im Zustand, und nur eine wurde
 *    geführt.
 *
 * Deshalb steht diese Aufgabe **vor** T-M15-05 und T-M15-07: die Migration entsteht mit
 * dem ersten neuen Zustandsfeld, nicht danach.
 */

const V1 = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../test/golden/save-v1.json', import.meta.url)), 'utf8'),
) as SaveEnvelope

const fresh = () => JSON.parse(JSON.stringify(V1)) as SaveEnvelope

const CONFIG: GameConfig = {
  seed: 5,
  mapId: 'testworld',
  rulesId: 'default',
  players: [
    { name: 'A', kind: 'human', nation: 'Nordland', color: '#0f62bc' },
    { name: 'B', kind: 'ai', nation: 'Ostmark', color: '#b03a2e', difficulty: 'normal' },
  ],
  victory: { condition: 'points', pointsShareToWin: 900, dayLimit: null },
}

describe('R-GAME-07/AK1 Ein Stand der V1 laeuft weiter', () => {
  it('laedt den eingefrorenen Stand, statt ihn abzuweisen', () => {
    const state = deserialise(JSON.stringify(fresh()))

    expect(state.schemaVersion).toBe(SCHEMA_VERSION)
    expect(state.tick).toBe(V1.savedAtTick)
    expect(state.eventLog.length, 'der eingefrorene Stand traegt kein Protokoll').toBeGreaterThan(5)
  })

  it('gibt jedem Protokolleintrag ein leeres Betroffenenfeld', () => {
    // Absichtlich leer: ein Alarm von vor dem Laden ist kein Alarm mehr (D19.1). Er wird
    // Lektuere, und das Vorspulen haelt nicht an einem Ereignis an, das der Spieler beim
    // Speichern laengst gesehen hat.
    const state = deserialise(JSON.stringify(fresh()))

    for (const event of state.eventLog) {
      expect(event.concerns, `${event.type} ohne Betroffenenfeld`).toEqual([])
    }
  })

  it('legt Verstimmungs-Record und Feuerleitung leer an', () => {
    const state = deserialise(JSON.stringify(fresh()))

    expect(state.diplomacy.grievances).toEqual({})
    expect(Object.keys(state.armies).length, 'der Stand hat keine Armee').toBeGreaterThan(0)
    for (const id of state.armyOrder) {
      expect(state.armies[id]!.holdFire, `${id} ohne Feuerleitung`).toBe(false)
    }
  })

  it('ruehrt nichts an, was die Simulation liest', () => {
    // Die urspruengliche Zusage lautete "der Hash bleibt derselbe". Das ist nicht
    // einloesbar — der Hash sortiert die Schluessel und nimmt jeden mit, ein neues Feld
    // aendert ihn zwangslaeufig (PROBLEME.md, 2026-09-06). Die Zusage *dahinter* ist
    // dagegen genau pruefbar, und zwar schaerfer als ein Hashvergleich: der Unterschied
    // zwischen altem und neuem Zustand darf ausschliesslich aus den neu angelegten
    // Feldern bestehen.
    const before = fresh().state as unknown as Record<string, unknown>
    const after = migrate(fresh()).state as unknown as Record<string, unknown>

    const strip = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(strip)
      if (value === null || typeof value !== 'object') return value
      const out: Record<string, unknown> = {}
      for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
        if ((ADDED_IN_VERSION_2 as readonly string[]).includes(key)) continue
        out[key] = strip(entry)
      }
      return out
    }

    expect(canonicalText(strip(after))).toBe(canonicalText(strip(before)))
  })

  it('ist nach Speichern und Laden hashgleich (R-GAME-03/AK1)', () => {
    const migrated = deserialise(JSON.stringify(fresh()))
    const again = deserialise(serialise(migrated))

    expect(hashValue(again, { omitKeys: HASH_OMIT_KEYS })).toBe(hashValue(migrated, { omitKeys: HASH_OMIT_KEYS }))
  })
})

describe('R-GAME-07/AK2 Kein Ladeweg ohne Pruefung', () => {
  it('lehnt einen migrierten Stand ab, dem ein Pflichtfeld fehlt (Befund 55)', () => {
    // Vorher kam selbst `{}` durch: `migrate` entfernt den Hash, und die einzige Pruefung
    // haengte an genau diesem Hash.
    const broken = fresh()
    delete (broken.state as unknown as Record<string, unknown>)['playerOrder']

    expect(() => deserialise(JSON.stringify(broken))).toThrow(SaveFormatError)
    expect(() => deserialise(JSON.stringify(broken))).toThrow(/playerOrder/)
  })

  it('lehnt einen voellig leeren Stand ab', () => {
    const empty = { schemaVersion: 1, savedAtTick: 0, state: { schemaVersion: 1 } }

    expect(() => deserialise(JSON.stringify(empty))).toThrow(SaveFormatError)
  })

  it('lehnt einen Umschlag ab, dessen Zustand eine andere Version nennt (Befund 56)', () => {
    // Eine vergessliche Migration, die state.schemaVersion nicht mitzieht: Umschlag 2,
    // Zustand 1. Danach kann niemand mehr sagen, welche Regeln fuer diesen Stand gelten.
    const state = createInitialState(CONFIG, { map: smallWorld(), rules: TEST_RULES })
    const envelope = JSON.parse(serialise(state)) as SaveEnvelope
    ;(envelope.state as unknown as Record<string, unknown>)['schemaVersion'] = 1

    expect(() => deserialise(JSON.stringify(envelope))).toThrow(/verschiedene Formatversionen/)
  })

  it('lehnt einen aktuellen Stand ohne Pruefsumme ab', () => {
    // `serialise` schreibt immer einen Hash. Ein hashloser, nicht migrierter Stand
    // stammt nicht von diesem Spiel — und ohne diesen Zweig gaebe es einen Ladeweg
    // voellig ohne Pruefung.
    const state = createInitialState(CONFIG, { map: smallWorld(), rules: TEST_RULES })
    const envelope = JSON.parse(serialise(state)) as Partial<SaveEnvelope>
    delete envelope.hash

    expect(() => deserialise(JSON.stringify(envelope))).toThrow(/Prüfsumme/)
  })

  it('haelt am Hash fest, wo es keine Migration gab', () => {
    // Die Gegenrichtung: die neue Pruefung darf die alte nicht ersetzen.
    const state = createInitialState(CONFIG, { map: smallWorld(), rules: TEST_RULES })
    const envelope = JSON.parse(serialise(state)) as SaveEnvelope
    envelope.state.tick += 1

    expect(() => deserialise(JSON.stringify(envelope))).toThrow(/Prüfsumme stimmt nicht/)
  })
})

describe('R-GAME-07 validateState prueft, was ein Zustand sein muss', () => {
  it('nimmt einen frischen Zustand an', () => {
    const state = createInitialState(CONFIG, { map: smallWorld(), rules: TEST_RULES })
    expect(() => validateState(state)).not.toThrow()
  })

  it('faellt bei einer Ordnungsliste, die ins Leere zeigt', () => {
    // Der stillere Fehler: eine playerOrder, die einen geloeschten Spieler nennt, laesst
    // die Simulation an beliebiger spaeterer Stelle abstuerzen — mit einer Meldung, die
    // nichts mit dem Speicherstand zu tun hat.
    const state = createInitialState(CONFIG, { map: smallWorld(), rules: TEST_RULES })
    state.playerOrder = [...state.playerOrder, 'p99']

    expect(() => validateState(state)).toThrow(InvalidStateError)
    expect(() => validateState(state)).toThrow(/p99/)
  })

  it('faellt bei einem Eintrag ohne Platz in der Ordnungsliste', () => {
    const state = createInitialState(CONFIG, { map: smallWorld(), rules: TEST_RULES })
    state.playerOrder = state.playerOrder.slice(1)

    expect(() => validateState(state)).toThrow(/ohne Platz/)
  })

  it('faellt bei fehlendem Verstimmungs-Record', () => {
    const state = createInitialState(CONFIG, { map: smallWorld(), rules: TEST_RULES })
    delete (state.diplomacy as unknown as Record<string, unknown>)['grievances']

    expect(() => validateState(state)).toThrow(/grievances/)
  })
})

describe('R-GAME-07 Der Formatwaechter', () => {
  it('haelt SCHEMA_VERSION und MIGRATIONS zusammen', () => {
    // Wer ein Zustandsfeld hinzufuegt, ohne die Version zu erhoehen und einen Schritt
    // einzutragen, laesst diesen Test scheitern.
    expect(SCHEMA_VERSION).toBe(highestMigration() + 1)
  })

  it('kennt genau einen Schritt fuer den ganzen Meilenstein', () => {
    // Entscheidung vom 2026-09-06 (DECISIONS.md): T-M15-05 und T-M15-07 fuellen die
    // Felder mit Verhalten und erhoehen die Version NICHT. Drei Schritte fuer einen
    // Meilenstein hiessen drei eingefrorene Staende und einen Waechter, der sich mit
    // sich selbst streitet.
    expect(highestMigration()).toBe(1)
    expect(SCHEMA_VERSION).toBe(2)
  })

  it('friert die Schluesselliste eines frischen Zustands ein', () => {
    const state = createInitialState(CONFIG, { map: smallWorld(), rules: TEST_RULES })

    expect(Object.keys(state).sort()).toEqual(
      [
        'ai',
        'armies',
        'armyOrder',
        'battles',
        'diplomacy',
        'eventLog',
        'mapId',
        'market',
        'nextIds',
        'playerOrder',
        'players',
        'provinceOrder',
        'provinces',
        'rng',
        'rulesId',
        'schemaVersion',
        'seed',
        'tick',
        'victory',
      ].sort(),
    )
  })

  it('legt die Felder von T-M15-05 und T-M15-07 schon an', () => {
    // Der Schnitt, der diesen Meilenstein zusammenhaelt: beide Felder existieren leer,
    // bevor die Aufgaben sie fuellen.
    const state = createInitialState(CONFIG, { map: smallWorld(), rules: TEST_RULES })

    expect(state.diplomacy.grievances).toEqual({})
    expect(Object.keys(state.diplomacy).sort()).toEqual(['grievances', 'offers', 'relations'])
  })
})
