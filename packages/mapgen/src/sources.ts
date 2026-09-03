/**
 * Where the raw geography comes from, and under what licence (T-M9-01, R-ASSET-02).
 *
 * This is data, not a download: the fetching lives in `scripts/fetch-geodata.mjs`,
 * outside the packages the network guard watches, because the game itself must never
 * reach the network (R-FREE-04). The pipeline runs once on a developer's machine and
 * checks in its result (design D-09).
 */

export interface GeoSource {
  id: string
  /** File name once unpacked, without extension. */
  name: string
  url: string
  /** What this file contributes to the map. */
  purpose: string
  licence: string
  attribution: string
  /** Approximate download size, so a surprise is a bug and not a habit. */
  bytes: number
}

/**
 * Natural Earth is public domain — explicitly, in writing, with no attribution
 * required. The attribution below is given anyway; it costs nothing and it means the
 * next person can find the source without digging through git history.
 */
export const NATURAL_EARTH_LICENCE = 'Public Domain (Natural Earth Terms of Use)'
const ATTRIBUTION = 'Made with Natural Earth. Free vector and raster map data @ naturalearthdata.com.'

export const GEO_SOURCES: readonly GeoSource[] = [
  {
    id: 'admin1',
    name: 'ne_50m_admin_1_states_provinces',
    url: 'https://naciscdn.org/naturalearth/50m/cultural/ne_50m_admin_1_states_provinces.zip',
    purpose: 'Verwaltungseinheiten erster Ordnung — die Rohmasse, aus der Provinzen kuratiert werden.',
    licence: NATURAL_EARTH_LICENCE,
    attribution: ATTRIBUTION,
    bytes: 911_408,
  },
  {
    id: 'admin0',
    name: 'ne_50m_admin_0_countries',
    url: 'https://naciscdn.org/naturalearth/50m/cultural/ne_50m_admin_0_countries.zip',
    purpose: 'Staatsgrenzen und Landeskennungen — ordnet jede Provinz einem Land zu.',
    licence: NATURAL_EARTH_LICENCE,
    attribution: ATTRIBUTION,
    bytes: 799_734,
  },
  {
    id: 'ocean',
    name: 'ne_50m_ocean',
    url: 'https://naciscdn.org/naturalearth/50m/physical/ne_50m_ocean.zip',
    purpose: 'Meeresflächen — trennt Küste von Binnenland und trägt die Seewege.',
    licence: NATURAL_EARTH_LICENCE,
    attribution: ATTRIBUTION,
    bytes: 461_745,
  },
]

/** The source with this id, or a readable error naming the ones that exist. */
export function geoSource(id: string): GeoSource {
  const found = GEO_SOURCES.find((source) => source.id === id)
  if (!found) {
    throw new RangeError(
      `Unbekannte Geodatenquelle "${id}". Bekannt sind: ${GEO_SOURCES.map((s) => s.id).join(', ')}.`,
    )
  }
  return found
}
