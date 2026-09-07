import { tinyMap } from '@worldwar/testkit'
import { describe, expect, it } from 'vitest'
import type { MapData } from '../state/types'
import { MapValidationError, parseMap, validateMap, type MapErrorCode } from './validate'

const codesOf = (map: unknown): MapErrorCode[] => {
  const result = validateMap(map)
  return result.ok ? [] : result.errors.map((error) => error.code)
}

/** Deep copy so each test can break exactly one thing. */
const broken = (mutate: (map: MapData) => void): MapData => {
  const map = structuredClone(tinyMap())
  mutate(map)
  return map
}

describe('R-MAP-02 Kartenvalidierung', () => {
  it('nimmt eine gueltige Karte an', () => {
    expect(validateMap(tinyMap())).toEqual({ ok: true })
  })

  it('weist Nicht-Objekte und leere Karten zurueck', () => {
    expect(codesOf(null)).toContain('INVALID_TYPE')
    expect(codesOf('karte')).toContain('INVALID_TYPE')
    expect(codesOf({})).toContain('MISSING_FIELD')
  })

  it('erkennt doppelte Provinzkennungen', () => {
    const map = broken((m) => {
      m.provinces = [...m.provinces, structuredClone(m.provinces[0]!)]
    })
    expect(codesOf(map)).toContain('DUPLICATE_ID')
  })

  it('erkennt fehlende Pflichtangaben einer Provinz', () => {
    const map = broken((m) => {
      ;(m.provinces[0] as { name?: string }).name = ''
    })
    expect(codesOf(map)).toContain('MISSING_FIELD')
  })

  it('erkennt unbekanntes Gelaende und unbekannte Ressourcen', () => {
    const terrain = broken((m) => {
      ;(m.provinces[0] as { terrain: string }).terrain = 'lava'
    })
    expect(codesOf(terrain)).toContain('INVALID_TYPE')

    const deposit = broken((m) => {
      ;(m.provinces[0] as { deposits: Record<string, number> }).deposits = { unobtainium: 5 }
    })
    expect(codesOf(deposit)).toContain('INVALID_TYPE')
  })

  it('erkennt Kanten auf unbekannte Provinzen', () => {
    const map = broken((m) => {
      ;(m.edges[0] as { b: string }).b = 'atlantis'
    })
    expect(codesOf(map)).toContain('UNKNOWN_PROVINCE')
  })

  it('erkennt Kanten einer Provinz auf sich selbst', () => {
    const map = broken((m) => {
      ;(m.edges[0] as { b: string }).b = m.edges[0]!.a
    })
    expect(codesOf(map)).toContain('SELF_EDGE')
  })

  it('erkennt doppelte Verbindungen', () => {
    const map = broken((m) => {
      m.edges = [...m.edges, structuredClone(m.edges[0]!)]
      m.edgesByProvince = { alpha: [0, 2, 3], beta: [0, 1, 3], gamma: [1, 2] }
    })
    expect(codesOf(map)).toContain('DUPLICATE_EDGE')
  })

  it('erkennt eine unplausible Entfernung', () => {
    const map = broken((m) => {
      ;(m.edges[0] as { distanceKm: number }).distanceKm = 0
    })
    expect(codesOf(map)).toContain('INVALID_TYPE')
  })
})

describe('R-MAP-02 Kanten und Verzeichnis muessen uebereinstimmen', () => {
  it('erkennt ein unvollstaendiges Kantenverzeichnis', () => {
    // The failure the design calls EDGE_ASYMMETRY: two descriptions of the same
    // neighbourhood drifting apart, so movement and combat disagree.
    const map = broken((m) => {
      m.edgesByProvince = { ...m.edgesByProvince, alpha: [0] } // sea link missing
    })
    expect(codesOf(map)).toContain('EDGE_ASYMMETRY')
  })

  it('erkennt ein Verzeichnis mit erfundenen Eintraegen', () => {
    const map = broken((m) => {
      m.edgesByProvince = { ...m.edgesByProvince, beta: [0, 1, 2] } // edge 2 is not beta's
    })
    expect(codesOf(map)).toContain('EDGE_ASYMMETRY')
  })
})

describe('R-MAP-02 Erreichbarkeit ueber Land und See', () => {
  it('erkennt eine unerreichbare Provinz', () => {
    const map = broken((m) => {
      m.provinces = [
        ...m.provinces,
        {
          id: 'insel',
          name: 'Insel',
          kind: 'rural',
          terrain: 'plains',
          coastal: true,
          center: { x: 95, y: 95 },
          polygons: [
            [
              [90, 90],
              [99, 90],
              [99, 99],
            ],
          ],
          population: 1000,
          deposits: {},
        },
      ]
      m.edgesByProvince = { ...m.edgesByProvince, insel: [] }
    })
    const codes = codesOf(map)
    expect(codes).toContain('ISOLATED_PROVINCE')
  })

  it('erkennt zwei Teilkarten ohne Verbindung', () => {
    const map = broken((m) => {
      // Cut the sea link and the land bridge, leaving gamma on its own side.
      m.edges = [m.edges[0]!]
      m.edgesByProvince = { alpha: [0], beta: [0], gamma: [] }
    })
    const codes = codesOf(map)
    expect(codes.some((code) => code === 'DISCONNECTED' || code === 'ISOLATED_PROVINCE')).toBe(true)
  })

  it('akzeptiert Inseln, solange ein Seeweg existiert', () => {
    // gamma is reachable from alpha only by sea — that must be fine (R-MAP-02/AK2).
    expect(validateMap(tinyMap()).ok).toBe(true)
  })
})

describe('R-MAP-02 Startaufstellungen', () => {
  it('verlangt, dass die Hauptstadt zu den Startprovinzen gehoert', () => {
    const map = broken((m) => {
      ;(m.startPositions[0] as unknown as { capital: string }).capital = 'gamma'
    })
    expect(codesOf(map)).toContain('INVALID_START_POSITION')
  })

  it('erkennt doppelt vergebene Provinzen', () => {
    const map = broken((m) => {
      ;(m.startPositions[1] as unknown as { provinces: string[] }).provinces = ['gamma', 'beta']
    })
    expect(codesOf(map)).toContain('INVALID_START_POSITION')
  })

  it('erkennt unbekannte Provinzen in einer Startaufstellung', () => {
    const map = broken((m) => {
      ;(m.startPositions[1] as unknown as { provinces: string[] }).provinces = ['gamma', 'utopia']
    })
    expect(codesOf(map)).toContain('UNKNOWN_PROVINCE')
  })

  it('verlangt mindestens zwei Nationen', () => {
    const map = broken((m) => {
      m.startPositions = [m.startPositions[0]!]
    })
    expect(codesOf(map)).toContain('MISSING_FIELD')
  })
})

describe('R-MAP-02 Laden mit klarer Fehlermeldung', () => {
  it('liefert die gueltige Karte typisiert zurueck', () => {
    expect(parseMap(tinyMap()).id).toBe('tiny')
  })

  it('wirft mit allen Problemen im Text', () => {
    const map = broken((m) => {
      ;(m.provinces[0] as { terrain: string }).terrain = 'lava'
      ;(m.provinces[1] as { name: string }).name = ''
    })
    try {
      parseMap(map)
      expect.unreachable('parseMap haette werfen muessen')
    } catch (error) {
      expect(error).toBeInstanceOf(MapValidationError)
      const message = (error as Error).message
      expect(message).toContain('lava')
      expect(message).toContain('Provinz')
      expect((error as MapValidationError).errors.length).toBeGreaterThanOrEqual(2)
    }
  })
})
