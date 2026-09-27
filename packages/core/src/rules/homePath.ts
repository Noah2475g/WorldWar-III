import { neighborsOf } from '../map/pathfinding'
import type { MapData, PlayerId, ProvinceId } from '../state/types'

/**
 * Der Räumweg (R-DIP-10/AK2, design D34.1-D34.3, T-M43-01).
 *
 * Ein Friedensschluss, ein Bündnisbruch oder eine abgelaufene Kündigung machen aus einer
 * stehenden Armee im fremden Land keinen Überfaller — sie hat eine Räumfrist. Wer aber den
 * kürzesten Weg **hinaus** geht, ist nie ein Überfaller, auch nach Fristende: der Kern
 * plant Wege nach Zeit, nicht nach Feldern, und ein Heimweg, der zufällig ein Feld mehr
 * kostet als der schnellste Ausgang, darf deshalb nicht zum Überfall werden (E3). Kern und
 * KI teilen sich diese eine Rechnung (D34.3), damit beide "kürzester Weg" dasselbe meinen.
 */

/** Was die Räumweg-Rechnung über die Welt wissen muss — aus dem Zustand (Kern) oder der Sicht (KI). */
export interface ClearingWay {
  map: MapData
  ownerOf: (provinceId: ProvinceId) => PlayerId | null
  /**
   * Darf die Armee Land dieses Besitzers ohne Überfall betreten (Krieg, Bündnis,
   * Durchmarschrecht)? Eigene und herrenlose Felder fragt die Rechnung nicht, Felder der
   * Gastmacht nie.
   */
  mayEnter: (owner: PlayerId) => boolean
  useSea: boolean
  /**
   * KI: das erste Feld hinter der Gastmacht muss selbst betretbar sein. Der Kern verlangt
   * es nicht — ein Besitzwechsel im selben Tick darf eine laufende Räumung nicht zum
   * Überfall machen (Sonde rr/rl).
   */
  strictExit?: boolean
}

/** Darf die Armee (Besitzer `me`) auf `owner` stehen, ohne dass es ein Überfall auf `host` wäre? */
function mayStand(way: ClearingWay, owner: PlayerId | null, me: PlayerId, host: PlayerId): boolean {
  return owner !== host && (owner === null || owner === me || way.mayEnter(owner))
}

/**
 * Die kleinste Zahl von Feldern der Gastmacht `host`, die eine Armee (Besitzer `me`) von
 * `from` aus durchqueren muss, um ein Feld zu erreichen, das sie ohne Überfall betreten
 * darf. `0`, wenn schon ein Nachbar von `from` außerhalb der Gastmacht liegt. `null`, wenn
 * kein solches Feld erreichbar ist (die Gastmacht ist von ihrem eigenen Land umschlossen).
 *
 * Breitensuche in Schichten, nur über Felder der Gastmacht — die Welt ist klein genug, dass
 * das nie die teure Suche ist. Besuchte Felder nur zum Nachschlagen (`has`), niemals
 * iteriert: die Reihenfolge der Rückgabe hängt allein von `neighborsOf` (sortiert) ab, nie
 * von der Einfügereihenfolge eines Sets (R-ARCH-01, H8).
 */
export function hostFieldsToLeave(way: ClearingWay, from: ProvinceId, me: PlayerId, host: PlayerId): number | null {
  const visited = new Set<ProvinceId>([from])
  let layer: ProvinceId[] = [from]
  let depth = 0

  while (true) {
    const strictExits: ProvinceId[] = []
    let anyExit = false
    const nextLayer: ProvinceId[] = []

    for (const id of layer) {
      for (const neighbor of neighborsOf(way.map, id, way.useSea)) {
        if (visited.has(neighbor)) continue
        const owner = way.ownerOf(neighbor)
        if (owner === host) {
          visited.add(neighbor)
          nextLayer.push(neighbor)
          continue
        }
        anyExit = true
        if (mayStand(way, owner, me, host)) strictExits.push(neighbor)
      }
    }

    if (strictExits.length > 0) return depth
    // Rückfall (H6): findet sich kein legaler Ausgang, zählt jeder Ausgang aus der
    // Gastmacht — sonst hätte eine Armee ohne Recht bei einem Nachbarn nie einen Räumweg.
    if (anyExit) return depth
    if (nextLayer.length === 0) return null
    layer = nextLayer
    depth += 1
  }
}

/**
 * Ist `path` (Felder ab, aber ohne `from`) ein Räumweg — verlässt er das Land von `host`
 * genau einmal, spätestens so tief, wie es überhaupt möglich ist (R-DIP-10/AK2, E3)?
 */
export function isClearingPath(
  way: ClearingWay,
  from: ProvinceId,
  path: readonly ProvinceId[],
  me: PlayerId,
  host: PlayerId,
): boolean {
  if (path.length === 0) return false

  let k = 0
  while (k < path.length && way.ownerOf(path[k]!) === host) k += 1
  const firstOut = path[k]
  if (firstOut === undefined) return false
  // Nach dem ersten Feld außerhalb der Gastmacht darf der Weg sie nicht wieder betreten
  // (H4) — sonst wäre "hinaus und wieder hinein" ein Räumweg.
  for (let i = k + 1; i < path.length; i += 1) {
    if (way.ownerOf(path[i]!) === host) return false
  }
  if (way.strictExit && !mayStand(way, way.ownerOf(firstOut), me, host)) return false

  const least = hostFieldsToLeave(way, from, me, host)
  return least !== null && k <= least
}
