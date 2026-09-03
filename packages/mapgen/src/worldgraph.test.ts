import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * The neighbour graph of the built map (T-M9-02b, R-MAP-01/R-MAP-02).
 *
 * `adjacency.test.ts` proves the method on shapes small enough to reason about; this
 * proves the result. A graph can be built by a correct algorithm and still be wrong
 * for the game: a continent split in two by a missing border, a distance that says
 * Berlin and Warsaw are ten kilometres apart, a country that quietly lost its only
 * land connection.
 */

const ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const world = JSON.parse(readFileSync(`${ROOT}/data/maps/world-shapes.json`, 'utf8')) as {
  provinces: { id: string; name: string; country: string; continent: string; neighbors: string[] }[]
  edges: { from: string; to: string; distanceKm: number }[]
  enclaves: string[]
  islands: string[]
}

const byId = new Map(world.provinces.map((p) => [p.id, p]))
const neighboursOf = (id: string): string[] => byId.get(id)?.neighbors ?? []
const continentOf = (id: string): string => byId.get(id)?.continent ?? ''

/**
 * Countries that are their own island or archipelago: their provinces border each
 * other but nothing else, so they are cut off by sea without appearing on the list of
 * provinces with no land neighbour at all.
 */
const ISLAND_GROUPS = new Set(['GBR', 'IRL', 'JPN', 'IDN', 'TLS', 'HTI', 'DOM', 'AUS', 'PNG'])

/** Everything reachable overland from one province. */
function walkFrom(start: string): Set<string> {
  const seen = new Set([start])
  const queue = [start]
  while (queue.length > 0) {
    for (const next of neighboursOf(queue.pop()!)) {
      if (seen.has(next)) continue
      seen.add(next)
      queue.push(next)
    }
  }
  return seen
}

describe('R-MAP-01 Der Nachbarschaftsgraph der Weltkarte', () => {
  it('ist symmetrisch', () => {
    for (const province of world.provinces) {
      for (const neighbour of province.neighbors) {
        expect(
          neighboursOf(neighbour),
          `${province.id} kennt ${neighbour}, aber nicht umgekehrt`,
        ).toContain(province.id)
      }
    }
  })

  it('nennt nur Provinzen, die es gibt, und keine sich selbst', () => {
    for (const province of world.provinces) {
      expect(province.neighbors).not.toContain(province.id)
      for (const neighbour of province.neighbors) {
        expect(byId.has(neighbour), `${province.id} nennt unbekanntes ${neighbour}`).toBe(true)
      }
      expect(new Set(province.neighbors).size, `${province.id} nennt einen Nachbarn doppelt`).toBe(
        province.neighbors.length,
      )
    }
  })

  it('fuehrt jede Grenze genau einmal in der Kantenliste', () => {
    const seen = new Set<string>()
    for (const edge of world.edges) {
      const key = [edge.from, edge.to].sort().join('|')
      expect(seen.has(key), `${edge.from}-${edge.to} steht zweimal`).toBe(false)
      seen.add(key)
    }
    // Every neighbour relation has exactly one edge behind it.
    const relations = world.provinces.reduce((n, p) => n + p.neighbors.length, 0)
    expect(seen.size).toBe(relations / 2)
  })

  it('haelt Afrika-Eurasien als eine Landmasse zusammen', () => {
    // A missing border would strand a region and no count would notice. The Old World
    // is one land mass, from Portugal to Kamchatka and down to the Cape, so everything
    // in it has to be reachable from Germany on foot.
    const reachable = walkFrom('DEU-NW')
    const oldWorld = world.provinces.filter((p) => {
      const continent = ['Europe', 'Asia', 'Africa']
      return continent.includes(continentOf(p.id)) && !world.islands.includes(p.id)
    })

    const stranded = oldWorld
      .filter((p) => !reachable.has(p.id) && !ISLAND_GROUPS.has(p.country))
      .map((p) => `${p.name} (${p.id})`)

    expect(stranded, `nicht erreichbar: ${stranded.join(', ')}`).toEqual([])
  })

  it('haelt Amerika als eine Landmasse zusammen', () => {
    const reachable = walkFrom('USA-MW')

    const americas = world.provinces.filter(
      (p) =>
        ['North America', 'South America'].includes(continentOf(p.id)) &&
        !world.islands.includes(p.id) &&
        !ISLAND_GROUPS.has(p.country),
    )
    const stranded = americas
      .filter((p) => !reachable.has(p.id))
      .map((p) => `${p.name} (${p.id})`)

    expect(stranded, `nicht erreichbar: ${stranded.join(', ')}`).toEqual([])
  })

  it('verbindet Eurasien und Afrika ueber Land', () => {
    // Sinai is the one land bridge between the continents, and losing it would change
    // every campaign in the game without any count looking wrong.
    const reachable = new Set(['DEU-NW'])
    const queue = ['DEU-NW']
    while (queue.length > 0) {
      for (const next of neighboursOf(queue.pop()!)) {
        if (reachable.has(next)) continue
        reachable.add(next)
        queue.push(next)
      }
    }

    expect(reachable.has('EGY-NORTH'), 'Ägypten nicht über Land erreichbar').toBe(true)
    expect(reachable.has('ZAF-EAST'), 'Südafrika nicht über Land erreichbar').toBe(true)
    expect(reachable.has('CHN-EAST'), 'China nicht über Land erreichbar').toBe(true)
    expect(reachable.has('IND-SOUTH'), 'Indien nicht über Land erreichbar').toBe(true)
  })

  it('kennt bekannte Nachbarschaften', () => {
    const expected: [string, string][] = [
      ['DEU-NE', 'POL-NW'],
      ['FRA-NE', 'DEU-SW'],
      ['ESP-NE', 'FRA-SW'],
      ['ITA-NORTH', 'CHE'],
      ['USA-WEST', 'CAN-WEST'],
      ['RUS-FAREAST', 'CHN-NE'],
      ['EGY-NORTH', 'ISR'],
    ]
    for (const [a, b] of expected) {
      expect(neighboursOf(a), `${a} sollte an ${b} grenzen`).toContain(b)
    }
  })

  it('erfindet keine Nachbarschaft ueber das Meer hinweg', () => {
    const impossible: [string, string][] = [
      ['GBR-SE', 'FRA-NW'],
      ['USA-NE', 'GBR-SW'],
      ['ITA-SOUTH', 'TUN'],
    ]
    for (const [a, b] of impossible) {
      expect(neighboursOf(a), `${a} und ${b} trennt das Meer`).not.toContain(b)
    }
  })

  it('kennt die spanischen Exklaven in Afrika', () => {
    // Spain and Morocco share a land border, at Ceuta and Melilla. This looked like a
    // bug at first — a lane across the Strait of Gibraltar drawn as a land border —
    // and is in fact the map being right where the assumption was wrong.
    expect(neighboursOf('ESP-SW')).toContain('MAR')
  })
})

describe('R-MAP-02 Entfernungen zwischen Nachbarn', () => {
  const edgeBetween = (a: string, b: string) =>
    world.edges.find((e) => (e.from === a && e.to === b) || (e.from === b && e.to === a))

  it('trifft bekannte Strecken groessenordnungsrichtig', () => {
    // Centre to centre, so these are not city distances — but a province the size of
    // Bavaria and its neighbour are hundreds of kilometres apart, not thousands.
    const berlinWarsaw = edgeBetween('DEU-NE', 'POL-NW')!
    expect(berlinWarsaw.distanceKm).toBeGreaterThan(200)
    expect(berlinWarsaw.distanceKm).toBeLessThan(800)

    const acrossSiberia = edgeBetween('RUS-SIB', 'RUS-FAREAST')!
    expect(acrossSiberia.distanceKm).toBeGreaterThan(1500)
  })

  it('gibt jeder Grenze eine Entfernung ueber null', () => {
    for (const edge of world.edges) {
      expect(edge.distanceKm, `${edge.from}-${edge.to}`).toBeGreaterThan(0)
      // Half the planet between two provinces that touch would mean the date line was
      // measured the long way round.
      expect(edge.distanceKm, `${edge.from}-${edge.to}`).toBeLessThan(6000)
    }
  })
})

describe('R-MAP-02 Enklaven und Inseln der Weltkarte', () => {
  it('erkennt Lesotho als Enklave', () => {
    expect(world.enclaves).toContain('LSO')
    expect(neighboursOf('LSO').every((n) => byId.get(n)?.country === 'ZAF')).toBe(true)
  })

  it('haelt nur echte Inseln fuer Inseln', () => {
    const known = ['ISL', 'CUB', 'MDG', 'LKA', 'NZL', 'PHL', 'JAM', 'MLT', 'TWN', 'FJI']
    for (const island of known) {
      expect(world.islands, `${island} sollte ohne Landnachbarn sein`).toContain(island)
    }
    // And nothing continental slipped in.
    for (const id of world.islands) {
      expect(neighboursOf(id), `${id} steht als Insel, hat aber Nachbarn`).toEqual([])
    }
  })

  it('laesst keine Startnation ohne Landverbindung ins Ausland', () => {
    // A power whose provinces only touch each other cannot fight a land war at all.
    const seagoing = new Set(['GBR', 'JPN', 'IDN', 'AUS'])
    for (const province of world.provinces) {
      const country = province.country
      if (seagoing.has(country)) continue
      const foreign = world.provinces
        .filter((p) => p.country === country)
        .flatMap((p) => p.neighbors)
        .filter((n) => byId.get(n)?.country !== country)
      if (world.islands.includes(province.id)) continue
      expect(foreign.length, `${country} hat keine Landgrenze ins Ausland`).toBeGreaterThan(0)
    }
  })
})
