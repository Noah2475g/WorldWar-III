import { UNIT_ICONS } from '../ui/icons.tsx'
import { placeBuildings, type Anchor } from './anchors.ts'
import type { BuildingsByProvince } from './markers.ts'
import type { Point } from './picking.ts'

/**
 * Wo eine eigene Armee in ihrer Provinz steht (R-MAP-05/AK1, T-M48-01).
 *
 * Am Anker des Gebaeudes, das ihre staerkste Gattung ausheben wuerde. Das ist reine
 * Huelle: der Kern kennt keine Position innerhalb einer Provinz. `markers.ts` darf hier
 * nur per `import type` hinein (kein Laufzeitzyklus).
 */

/** Die staerkste Gattung eines Stapels: groesstes `hp`, nur Schluessel mit Symbol, bei Gleichstand der erste. */
export function dominantUnitKey(units: readonly { unitKey: string; hp: number }[]): string | undefined {
  let best: { key: string; hp: number } | null = null
  for (const stack of units) {
    if (!UNIT_ICONS[stack.unitKey]) continue
    if (!best || stack.hp > best.hp) best = { key: stack.unitKey, hp: stack.hp }
  }
  return best?.key
}

/**
 * Der Anker des Gattungsgebaeudes in Kartenraum, sonst `null` (E1).
 *
 * Die Stufe ist egal (>= 1 genuegt): Stellung ist kein Ausheben. Fehlt eine Eingabe, gibt es
 * kein passendes Gebaeude oder keinen Anker, bleibt die Armee in der Provinzmitte.
 */
export function armyHome(
  units: readonly { unitKey: string; hpTotal: number }[] | undefined,
  provinceBuildings: Readonly<Partial<Record<string, number>>> | undefined,
  anchors: readonly Anchor[] | undefined,
  rules: { units: Readonly<Record<string, { requiresBuilding?: string } | undefined>> },
): Point | null {
  if (!units || !provinceBuildings || !anchors || anchors.length === 0) return null
  const key = dominantUnitKey(units.map((stack) => ({ unitKey: stack.unitKey, hp: stack.hpTotal })))
  if (!key) return null
  const building = rules.units[key]?.requiresBuilding
  if (!building) return null
  const placed = placeBuildings(provinceBuildings, anchors).find((p) => p.building === building)
  return placed ? { x: placed.x, y: placed.y } : null
}

/** Gebaeude je Provinz, Art → Stufe — nur die eigenen sind bekannt (R-DIP-04); Stufe 0 und leere Provinzen fallen weg. */
export function knownBuildings(
  provinces: readonly { id: string; buildings?: Partial<Record<string, number>> }[],
): BuildingsByProvince {
  const byProvince: Record<string, Partial<Record<string, number>>> = {}
  for (const province of provinces) {
    const known = Object.entries(province.buildings ?? {}).filter(([, level]) => (level ?? 0) > 0)
    if (known.length > 0) byProvince[province.id] = Object.fromEntries(known)
  }
  return byProvince as BuildingsByProvince
}
