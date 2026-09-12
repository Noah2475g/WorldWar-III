import { hashValue } from '@worldwar/shared'
import { describe, expect, it } from 'vitest'
import { HASH_OMIT_KEYS, SCHEMA_VERSION, type MapData } from './types'
import { createInitialState, type GameConfig } from './create'
import { TEST_RULES } from '@worldwar/testkit'

/**
 * A three-province inline map: enough to build a state from, small enough to read.
 * The full test map arrives with T-M2-02.
 */
const MAP: MapData = {
  id: 'tiny',
  name: 'Drei Provinzen',
  width: 100,
  height: 100,
  provinces: [
    {
      id: 'alpha',
      name: 'Alpha',
      kind: 'city',
      terrain: 'plains',
      coastal: true,
      center: { x: 10, y: 10 },
      polygons: [
        [
          [0, 0],
          [20, 0],
          [20, 20],
        ],
      ],
      population: 500_000,
      deposits: { food: 3000, iron: 1000 },
    },
    {
      id: 'beta',
      name: 'Beta',
      kind: 'rural',
      terrain: 'forest',
      coastal: false,
      center: { x: 40, y: 10 },
      polygons: [
        [
          [30, 0],
          [50, 0],
          [50, 20],
        ],
      ],
      population: 200_000,
      deposits: { wood: 2000 },
    },
    {
      id: 'gamma',
      name: 'Gamma',
      kind: 'rural',
      terrain: 'mountain',
      coastal: true,
      center: { x: 70, y: 10 },
      polygons: [
        [
          [60, 0],
          [80, 0],
          [80, 20],
        ],
      ],
      population: 150_000,
      deposits: { coal: 1500 },
    },
  ],
  edges: [
    { a: 'alpha', b: 'beta', kind: 'land', distanceKm: 120_000, crossing: 'none' },
    { a: 'beta', b: 'gamma', kind: 'land', distanceKm: 200_000, crossing: 'river' },
    { a: 'alpha', b: 'gamma', kind: 'sea', distanceKm: 400_000, crossing: 'strait' },
  ],
  edgesByProvince: { alpha: [0, 2], beta: [0, 1], gamma: [1, 2] },
  startPositions: [
    { nation: 'Nordland', capital: 'alpha', provinces: ['alpha', 'beta'] },
    { nation: 'Sued', capital: 'gamma', provinces: ['gamma'] },
  ],
}

const CONFIG: GameConfig = {
  seed: 42,
  mapId: 'tiny',
  rulesId: 'test',
  players: [
    { name: 'Noah', kind: 'human', nation: 'Nordland', color: '#0f62bc' },
    { name: 'Gegner', kind: 'ai', nation: 'Sued', color: '#b03a2e', difficulty: 'normal' },
  ],
  victory: { condition: 'points', pointsShareToWin: 600, dayLimit: null },
}

const ctx = { map: MAP, rules: TEST_RULES }

describe('R-GAME-01 Anfangszustand aus Karte und Konfiguration', () => {
  it('setzt Grunddaten aus der Konfiguration', () => {
    const state = createInitialState(CONFIG, ctx)
    expect(state.schemaVersion).toBe(SCHEMA_VERSION)
    expect(state.seed).toBe(42)
    expect(state.tick).toBe(0)
    expect(state.mapId).toBe('tiny')
    expect(state.rulesId).toBe('test')
    expect(state.victory.condition).toBe('points')
  })

  it('legt je Spieler eine Nation mit Hauptstadt und Provinzen an', () => {
    const state = createInitialState(CONFIG, ctx)
    expect(state.playerOrder).toHaveLength(2)

    const [firstId, secondId] = state.playerOrder as [string, string]
    const first = state.players[firstId]!
    expect(first.nation).toBe('Nordland')
    expect(first.capitalProvinceId).toBe('alpha')
    expect(state.provinces['alpha']!.owner).toBe(firstId)
    expect(state.provinces['beta']!.owner).toBe(firstId)
    expect(state.provinces['gamma']!.owner).toBe(secondId)
  })

  it('gibt allen Spielern dieselben Startressourcen und keinen versteckten Bonus', () => {
    const state = createInitialState(CONFIG, ctx)
    const [a, b] = state.playerOrder as [string, string]
    expect(state.players[a]!.resources).toEqual(state.players[b]!.resources)
    // R-AI-02: a bonus is allowed, but only when asked for — and then shown openly.
    expect(state.players[b]!.aiBonusMultiplier).toBe(1000)
  })

  it('uebernimmt Bevoelkerung, Gelaende und Vorkommen aus der Karte', () => {
    const state = createInitialState(CONFIG, ctx)
    const alpha = state.provinces['alpha']!
    expect(alpha.population).toBe(500_000)
    expect(alpha.terrain).toBe('plains')
    expect(alpha.kind).toBe('city')
    expect(alpha.coastal).toBe(true)
    expect(alpha.deposits).toEqual({ food: 3000, iron: 1000 })
  })

  it('leitet Nachbarschaft und Seewege aus den Kanten ab', () => {
    const state = createInitialState(CONFIG, ctx)
    expect([...state.provinces['alpha']!.neighbors].sort()).toEqual(['beta'])
    expect([...state.provinces['beta']!.neighbors].sort()).toEqual(['alpha', 'gamma'])
    expect([...state.provinces['alpha']!.seaLinks].sort()).toEqual(['gamma'])
    expect(state.provinces['beta']!.seaLinks).toEqual([])
  })

  it('startet Provinzen mit der belegten Startmoral', () => {
    const state = createInitialState(CONFIG, ctx)
    expect(state.provinces['alpha']!.morale).toBe(TEST_RULES.constants.startMorale)
    expect(state.provinces['alpha']!.targetMorale).toBe(TEST_RULES.constants.startMorale)
  })

  it('beginnt mit Frieden zwischen allen Spielern', () => {
    const state = createInitialState(CONFIG, ctx)
    const relations = Object.values(state.diplomacy.relations)
    expect(relations).toHaveLength(1) // one pair for two players
    expect(relations[0]!.state).toBe('peace')
  })

  it('legt fuer jeden KI-Spieler ein Gedaechtnis an', () => {
    const state = createInitialState(CONFIG, ctx)
    const aiId = state.playerOrder[1]!
    expect(state.ai[aiId]).toBeDefined()
    expect(state.ai[aiId]!.buildShare).toBeGreaterThan(0)
    expect(state.ai[state.playerOrder[0]!]).toBeUndefined() // human needs none
  })
})

describe('R-ARCH-01 Anfangszustand ist reine, geordnete Daten', () => {
  it('ist verlustfrei serialisierbar', () => {
    const state = createInitialState(CONFIG, ctx)
    expect(JSON.parse(JSON.stringify(state))).toEqual(state)
  })

  it('enthaelt kein undefined, keine Map und kein Set', () => {
    // hashValue throws on anything that would not survive a save/load round trip.
    expect(() => hashValue(createInitialState(CONFIG, ctx), { omitKeys: HASH_OMIT_KEYS })).not.toThrow()
  })

  it('haelt die Ordnungslisten vollstaendig und sortiert', () => {
    const state = createInitialState(CONFIG, ctx)
    expect(state.provinceOrder).toEqual(['alpha', 'beta', 'gamma'])
    expect(state.provinceOrder).toEqual([...state.provinceOrder].sort())
    expect(state.provinceOrder).toHaveLength(Object.keys(state.provinces).length)
    expect(state.playerOrder).toHaveLength(Object.keys(state.players).length)
  })

  it('erzeugt aus demselben Seed denselben Zustand', () => {
    const a = createInitialState(CONFIG, ctx)
    const b = createInitialState(CONFIG, ctx)
    expect(hashValue(a, { omitKeys: HASH_OMIT_KEYS })).toBe(hashValue(b, { omitKeys: HASH_OMIT_KEYS }))
  })

  it('erzeugt aus anderem Seed einen anderen Zustand', () => {
    const a = createInitialState(CONFIG, ctx)
    const b = createInitialState({ ...CONFIG, seed: 43 }, ctx)
    expect(hashValue(a, { omitKeys: HASH_OMIT_KEYS })).not.toBe(hashValue(b, { omitKeys: HASH_OMIT_KEYS }))
  })

  it('meldet das Spielbeginn-Ereignis', () => {
    const state = createInitialState(CONFIG, ctx)
    expect(state.eventLog).toHaveLength(1)
    expect(state.eventLog[0]!.type).toBe('GAME_STARTED')
  })
})

describe('R-GAME-01 Fehlerhafte Konfiguration wird abgewiesen', () => {
  it('braucht mindestens zwei Spieler', () => {
    expect(() => createInitialState({ ...CONFIG, players: [CONFIG.players[0]!] }, ctx)).toThrow(/zwei/i)
  })

  it('braucht fuer jeden Spieler eine Startaufstellung', () => {
    const threePlayers = { ...CONFIG, players: [...CONFIG.players, { ...CONFIG.players[1]!, nation: 'Ost' }] }
    expect(() => createInitialState(threePlayers, ctx)).toThrow(/Startaufstellung/i)
  })

  it('weist eine unbekannte Nation zurueck', () => {
    const wrong = { ...CONFIG, players: [{ ...CONFIG.players[0]!, nation: 'Atlantis' }, CONFIG.players[1]!] }
    expect(() => createInitialState(wrong, ctx)).toThrow(/Atlantis/)
  })
})

/**
 * Der Startvorrat traegt die Eroeffnung nicht mehr allein (T-M34-06, D34.4).
 *
 * Der Befund aus FORTSCHRITT.md Abschnitt 1: der alte Vorrat trug rund dreizehn
 * Infanterie aus der Nahrung und siebenunddreissig aus dem Geld, waehrend eine
 * durchschnittliche Provinz am Tag etwa eine dreiviertel Infanterie an Nahrung
 * erwirtschaftet. **Die ersten Tage waren ein Abbau des Anfangslagers, keine Knappheit.**
 *
 * Gekuerzt wird auf zwei Drittel und nicht weiter: die Eroeffnung soll knapp werden,
 * nicht handlungsunfaehig — und die Kuerzung trifft die KI genauso, die in der Fruehphase
 * ohnehin am schwaechsten spielt.
 */
describe('R-ECON-01 Der Startvorrat ist auf zwei Drittel gekuerzt', () => {
  /** Die Werte vor T-M34-06 — der Bezug, ohne den "zwei Drittel" nichts heisst. */
  const FRUEHER: Readonly<Record<string, number>> = {
    food: 1_000_000, wood: 1_000_000, iron: 500_000, coal: 500_000,
    oil: 250_000, rare: 100_000, money: 2_500_000,
  }

  it('haelt jeden der sieben Vorraete bei zwei Dritteln des alten Werts', () => {
    const abweichungen: string[] = []
    for (const [key, frueher] of Object.entries(FRUEHER)) {
      const heute = TEST_RULES.resources[key as 'food']!.startAmount
      const anteil = heute / frueher
      if (Math.abs(anteil - 2 / 3) > 0.01) {
        abweichungen.push(`${key}: ${heute} von ${frueher} = ${(anteil * 100).toFixed(1)} %`)
      }
    }

    expect(Object.keys(FRUEHER)).toHaveLength(7)
    expect(abweichungen, `nicht zwei Drittel:\n${abweichungen.join('\n')}`).toEqual([])
  })

  it('gibt die gekuerzten Werte auch wirklich in die Partie', () => {
    // Die Zusicherung oben liest das Regelwerk; diese liest den Zustand. Zwischen beiden
    // liegt `createInitialState`, und genau dort koennte ein Vorrat haengen bleiben.
    const state = createInitialState(CONFIG, ctx)
    for (const key of Object.keys(FRUEHER)) {
      expect(state.players['p1']!.resources[key as 'food'], key).toBe(TEST_RULES.resources[key as 'food']!.startAmount)
    }
  })

  it('laesst die Eroeffnung knapp werden, aber nicht handlungsunfaehig', () => {
    // Die Gegenrichtung zur Kuerzung: wer am ersten Spieltag weder bauen noch ausheben
    // kann, hat keine knappe Eroeffnung, sondern gar keine. Kaserne und Infanterie sind
    // die beiden Sachen, die es an Tag 1 gibt (T-M34-03).
    const state = createInitialState(CONFIG, ctx)
    const vorrat = state.players['p1']!.resources

    for (const [was, kosten] of [
      ['Kaserne', TEST_RULES.buildings.barracks.cost],
      ['Infanterie', TEST_RULES.units.infantry!.cost],
    ] as const) {
      for (const [key, betrag] of Object.entries(kosten)) {
        expect(vorrat[key as 'food'], `${was}: ${key}`).toBeGreaterThanOrEqual(betrag ?? 0)
      }
    }
  })
})
