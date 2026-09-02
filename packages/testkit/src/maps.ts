import type { MapData } from '@worldwar/core'

/**
 * Three provinces, two nations, one sea link. Small enough to reason about by hand,
 * complete enough to build a state and run ticks against. The full 12-province test
 * map ("Kleine Welt") arrives with T-M2-02.
 */
export function tinyMap(): MapData {
  return {
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
        polygon: [
          [0, 0],
          [20, 0],
          [20, 20],
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
        polygon: [
          [30, 0],
          [50, 0],
          [50, 20],
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
        polygon: [
          [60, 0],
          [80, 0],
          [80, 20],
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
}
