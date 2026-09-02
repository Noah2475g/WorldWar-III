import type {
  Crossing,
  EdgeKind,
  MapData,
  ProvinceId,
  ProvinceKind,
  ResourceKey,
  Terrain,
} from '../state/types'

/**
 * Map validation (R-MAP-02/AK1, AK2).
 *
 * A map is data, not code — so a broken map must fail loudly at load time with a
 * message that says what to fix, instead of producing a game where an army walks
 * into the sea or a nation starts unreachable.
 */

export type MapErrorCode =
  | 'MISSING_FIELD'
  | 'INVALID_TYPE'
  | 'DUPLICATE_ID'
  | 'UNKNOWN_PROVINCE'
  | 'SELF_EDGE'
  | 'DUPLICATE_EDGE'
  | 'EDGE_ASYMMETRY'
  | 'DISCONNECTED'
  | 'ISOLATED_PROVINCE'
  | 'INVALID_START_POSITION'

export interface MapError {
  code: MapErrorCode
  message: string
  where?: string
}

export type MapValidation = { ok: true } | { ok: false; errors: MapError[] }

const TERRAINS: readonly Terrain[] = ['plains', 'forest', 'mountain', 'desert', 'urban']
const KINDS: readonly ProvinceKind[] = ['city', 'rural']
const EDGE_KINDS: readonly EdgeKind[] = ['land', 'sea']
const CROSSINGS: readonly Crossing[] = ['none', 'river', 'strait']
const RESOURCES: readonly ResourceKey[] = ['food', 'wood', 'iron', 'coal', 'oil', 'rare', 'money']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Structure and types. Everything else is meaningless until this passes. */
function checkShape(candidate: unknown, errors: MapError[]): candidate is MapData {
  if (!isRecord(candidate)) {
    errors.push({ code: 'INVALID_TYPE', message: 'Die Karte ist kein Objekt.' })
    return false
  }

  for (const field of ['id', 'name'] as const) {
    if (typeof candidate[field] !== 'string' || candidate[field] === '') {
      errors.push({ code: 'MISSING_FIELD', message: `Feld "${field}" fehlt oder ist leer.` })
    }
  }
  for (const field of ['width', 'height'] as const) {
    if (!Number.isFinite(candidate[field])) {
      errors.push({ code: 'MISSING_FIELD', message: `Feld "${field}" fehlt oder ist keine Zahl.` })
    }
  }
  if (!Array.isArray(candidate['provinces']) || candidate['provinces'].length === 0) {
    errors.push({ code: 'MISSING_FIELD', message: 'Die Karte enthält keine Provinzen.' })
  }
  if (!Array.isArray(candidate['edges'])) {
    errors.push({ code: 'MISSING_FIELD', message: 'Feld "edges" fehlt.' })
  }
  if (!Array.isArray(candidate['startPositions']) || candidate['startPositions'].length < 2) {
    errors.push({
      code: 'MISSING_FIELD',
      message: 'Die Karte braucht mindestens zwei Startaufstellungen.',
    })
  }

  return errors.length === 0
}

function checkProvinces(map: MapData, errors: MapError[]): void {
  const seen = new Set<ProvinceId>()

  for (const province of map.provinces) {
    const where = `Provinz "${province.id}"`

    if (typeof province.id !== 'string' || province.id === '') {
      errors.push({ code: 'MISSING_FIELD', message: 'Provinz ohne Kennung.', where })
      continue
    }
    if (seen.has(province.id)) {
      errors.push({ code: 'DUPLICATE_ID', message: `Kennung "${province.id}" kommt mehrfach vor.`, where })
    }
    seen.add(province.id)

    if (typeof province.name !== 'string' || province.name === '') {
      errors.push({ code: 'MISSING_FIELD', message: 'Provinz ohne Namen.', where })
    }
    if (!KINDS.includes(province.kind)) {
      errors.push({ code: 'INVALID_TYPE', message: `Unbekannte Provinzart "${province.kind}".`, where })
    }
    if (!TERRAINS.includes(province.terrain)) {
      errors.push({ code: 'INVALID_TYPE', message: `Unbekanntes Gelände "${province.terrain}".`, where })
    }
    if (typeof province.coastal !== 'boolean') {
      errors.push({ code: 'MISSING_FIELD', message: 'Feld "coastal" fehlt.', where })
    }
    if (!Number.isSafeInteger(province.population) || province.population < 0) {
      errors.push({ code: 'INVALID_TYPE', message: 'Bevölkerung muss eine nicht-negative ganze Zahl sein.', where })
    }
    if (!Array.isArray(province.polygon) || province.polygon.length < 3) {
      errors.push({ code: 'MISSING_FIELD', message: 'Provinzumriss braucht mindestens drei Punkte.', where })
    }
    for (const [resource, amount] of Object.entries(province.deposits ?? {})) {
      if (!RESOURCES.includes(resource as ResourceKey)) {
        errors.push({ code: 'INVALID_TYPE', message: `Unbekannte Ressource "${resource}".`, where })
      }
      if (!Number.isSafeInteger(amount) || (amount as number) < 0) {
        errors.push({ code: 'INVALID_TYPE', message: `Vorkommen "${resource}" ist keine gültige Menge.`, where })
      }
    }
  }
}

function checkEdges(map: MapData, errors: MapError[]): void {
  const known = new Set(map.provinces.map((province) => province.id))
  const pairs = new Set<string>()

  map.edges.forEach((edge, index) => {
    const where = `Kante ${index} (${edge.a} – ${edge.b})`

    if (!known.has(edge.a) || !known.has(edge.b)) {
      errors.push({ code: 'UNKNOWN_PROVINCE', message: 'Kante verweist auf eine unbekannte Provinz.', where })
      return
    }
    if (edge.a === edge.b) {
      errors.push({ code: 'SELF_EDGE', message: 'Kante verbindet eine Provinz mit sich selbst.', where })
      return
    }
    if (!EDGE_KINDS.includes(edge.kind)) {
      errors.push({ code: 'INVALID_TYPE', message: `Unbekannte Kantenart "${edge.kind}".`, where })
    }
    if (!CROSSINGS.includes(edge.crossing)) {
      errors.push({ code: 'INVALID_TYPE', message: `Unbekannter Übergang "${edge.crossing}".`, where })
    }
    if (!Number.isSafeInteger(edge.distanceKm) || edge.distanceKm <= 0) {
      errors.push({ code: 'INVALID_TYPE', message: 'Entfernung muss eine positive ganze Zahl sein.', where })
    }

    const key = edge.a < edge.b ? `${edge.kind}:${edge.a}|${edge.b}` : `${edge.kind}:${edge.b}|${edge.a}`
    if (pairs.has(key)) {
      errors.push({ code: 'DUPLICATE_EDGE', message: 'Diese Verbindung ist doppelt eingetragen.', where })
    }
    pairs.add(key)
  })
}

/**
 * The index must agree with the edge list. This is the failure the reviews singled
 * out: two descriptions of the same neighbourhood that quietly drift apart, so
 * movement and combat disagree about who borders whom.
 */
function checkEdgeIndex(map: MapData, errors: MapError[]): void {
  const expected = new Map<ProvinceId, Set<number>>()
  for (const province of map.provinces) expected.set(province.id, new Set())
  map.edges.forEach((edge, index) => {
    expected.get(edge.a)?.add(index)
    expected.get(edge.b)?.add(index)
  })

  for (const province of map.provinces) {
    const listed = new Set(map.edgesByProvince?.[province.id] ?? [])
    const want = expected.get(province.id)!
    const missing = [...want].filter((index) => !listed.has(index))
    const extra = [...listed].filter((index) => !want.has(index))

    if (missing.length > 0 || extra.length > 0) {
      errors.push({
        code: 'EDGE_ASYMMETRY',
        message:
          `Kantenverzeichnis stimmt nicht mit der Kantenliste überein ` +
          `(fehlend: [${missing.join(', ')}], zu viel: [${extra.join(', ')}]).`,
        where: `Provinz "${province.id}"`,
      })
    }
  }
}

/**
 * Reachability over land AND sea (R-MAP-02/AK2).
 *
 * Checking only land would be wrong on any real world map: the Americas are not
 * connected to Eurasia by land, and never will be.
 */
function checkConnectivity(map: MapData, errors: MapError[]): void {
  const adjacency = new Map<ProvinceId, ProvinceId[]>()
  for (const province of map.provinces) adjacency.set(province.id, [])
  for (const edge of map.edges) {
    adjacency.get(edge.a)?.push(edge.b)
    adjacency.get(edge.b)?.push(edge.a)
  }

  for (const [id, neighbours] of adjacency) {
    if (neighbours.length === 0) {
      errors.push({
        code: 'ISOLATED_PROVINCE',
        message: 'Provinz hat weder Land- noch Seeverbindung.',
        where: `Provinz "${id}"`,
      })
    }
  }

  const first = map.provinces[0]?.id
  if (!first) return

  const seen = new Set<ProvinceId>([first])
  const queue: ProvinceId[] = [first]
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const next of adjacency.get(current) ?? []) {
      if (!seen.has(next)) {
        seen.add(next)
        queue.push(next)
      }
    }
  }

  if (seen.size !== map.provinces.length) {
    const unreachable = map.provinces.filter((province) => !seen.has(province.id)).map((p) => p.id)
    errors.push({
      code: 'DISCONNECTED',
      message: `Nicht erreichbar von "${first}" aus: ${unreachable.slice(0, 5).join(', ')}${unreachable.length > 5 ? ' …' : ''}.`,
    })
  }
}

function checkStartPositions(map: MapData, errors: MapError[]): void {
  const known = new Set(map.provinces.map((province) => province.id))
  const claimed = new Map<ProvinceId, string>()
  const nations = new Set<string>()

  for (const start of map.startPositions) {
    const where = `Startaufstellung "${start.nation}"`

    if (nations.has(start.nation)) {
      errors.push({ code: 'DUPLICATE_ID', message: 'Nation kommt mehrfach vor.', where })
    }
    nations.add(start.nation)

    if (start.provinces.length === 0) {
      errors.push({ code: 'INVALID_START_POSITION', message: 'Nation ohne Provinzen.', where })
    }
    if (!start.provinces.includes(start.capital)) {
      errors.push({
        code: 'INVALID_START_POSITION',
        message: `Hauptstadt "${start.capital}" gehört nicht zu den Startprovinzen.`,
        where,
      })
    }

    for (const provinceId of start.provinces) {
      if (!known.has(provinceId)) {
        errors.push({ code: 'UNKNOWN_PROVINCE', message: `Provinz "${provinceId}" existiert nicht.`, where })
        continue
      }
      const other = claimed.get(provinceId)
      if (other) {
        errors.push({
          code: 'INVALID_START_POSITION',
          message: `Provinz "${provinceId}" ist auch "${other}" zugeordnet.`,
          where,
        })
      }
      claimed.set(provinceId, start.nation)
    }
  }
}

/** Full validation. Collects every problem instead of stopping at the first. */
export function validateMap(candidate: unknown): MapValidation {
  const errors: MapError[] = []

  if (!checkShape(candidate, errors)) {
    return { ok: false, errors }
  }

  const map = candidate
  checkProvinces(map, errors)
  checkEdges(map, errors)

  // Index and connectivity only make sense once provinces and edges are sound.
  if (errors.length === 0) {
    checkEdgeIndex(map, errors)
    checkConnectivity(map, errors)
    checkStartPositions(map, errors)
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors }
}

export class MapValidationError extends Error {
  constructor(public readonly errors: MapError[]) {
    super(
      `Karte ist ungültig (${errors.length} Problem${errors.length === 1 ? '' : 'e'}):\n` +
        errors.map((error) => `  [${error.code}] ${error.where ? `${error.where}: ` : ''}${error.message}`).join('\n'),
    )
    this.name = 'MapValidationError'
  }
}

/** Validate and return a typed map, or throw with every problem listed. */
export function parseMap(candidate: unknown): MapData {
  const result = validateMap(candidate)
  if (!result.ok) throw new MapValidationError(result.errors)
  return candidate as MapData
}
