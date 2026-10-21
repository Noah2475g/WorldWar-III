import { BUILDING_ICONS, type IconName } from '../ui/icons.tsx'
import { zoomTier, type Point, type View } from './picking.ts'
import { BUILDING_SYMBOL_PRIO } from './sammel.ts'
import type { ArmyMarker, BuildingsByProvince } from './markers.ts'
import type { RelationKind } from './modes.ts'

/**
 * Welt-Pille auf far (E3a, Plan §11.3 D16-D20): Rohmarken je Provinz, vor dem
 * macht-uebergreifenden Zusammenlegen (`collideWorldMarks`, folgt in E3b/E3a weiter
 * unten in `layoutMarks.ts`). Reine Funktion ohne Leinwand, Muster wie `groupBuildings`/
 * `groupArmies` (sammel.ts) — hier aber je Provinz statt je Sammelschluessel, weil die
 * Welt-Pille Provinzen macht-uebergreifend zusammenlegt (D21), nicht nur Armeen.
 *
 * D16: "Land" = `province.owner`/die bereits abgeleitete `relation` aus Spielersicht
 * (`modes.ts: relationKindFor`) — keine neue Datei/Tabelle. `relation === 'self'` ist die
 * eigene Provinz, `relation === 'war'` der Kriegsgegner; alles andere (friedliche
 * Fremdmacht, unbekannt) bekommt keine Pille (A19).
 *
 * D19-Hinweis (dokumentierte Abweichung, kein Blocker): `armyIconFor` unten spiegelt den
 * Algorithmus von `sammel.ts:groupIcon` (dort privat, D25 haelt `sammel.ts` fuer E3
 * ausdruecklich unveraendert) — bewusst nachgebaut statt importiert, um die Datei nicht
 * anzufassen. `buildingIconFor` dagegen nutzt `BUILDING_SYMBOL_PRIO`/`BUILDING_ICONS`
 * direkt (echte Wiederverwendung, keine neue Datei noetig).
 */

export interface WorldProvinceInfo {
  owner: string | null
  /** Beziehung aus Spielersicht (`modes.ts: relationKindFor`), 'self' = eigene Provinz. */
  relation?: RelationKind | undefined
}

export interface WorldRawMark {
  tone: 'own' | 'enemy'
  provinceId: string
  ownerId: string
  x: number
  y: number
  buildingSum?: number
  buildingIcon?: IconName
  armySum?: number
  armyIcon?: IconName
}

/** D18: Summe `count` wie `sammel.ts:groupLabel`, sonst Mitgliederzahl (dieselbe Regel). */
function armySumOf(list: readonly ArmyMarker[]): number {
  if (list.length === 0) return 0
  if (list.every((a) => a.count !== undefined)) {
    return list.reduce((sum, a) => sum + (a.count ?? 0), 0)
  }
  return list.length
}

/** D19: Algorithmus wie `sammel.ts:groupIcon` (dort privat) — groesste Summe `count` gewinnt. */
function armyIconFor(list: readonly ArmyMarker[]): IconName | undefined {
  const sums = new Map<IconName, number>()
  for (const a of list) {
    if (!a.icon) continue
    sums.set(a.icon, (sums.get(a.icon) ?? 0) + (a.count ?? 1))
  }
  let best: IconName | undefined
  let bestSum = -Infinity
  for (const [icon, sum] of sums) {
    if (sum > bestSum) {
      best = icon
      bestSum = sum
    }
  }
  return best
}

/** D19: erste vorhandene Art nach `BUILDING_SYMBOL_PRIO` (echte Wiederverwendung). */
function buildingIconFor(byKind: BuildingsByProvince[string] | undefined): IconName | undefined {
  if (!byKind) return undefined
  for (const kind of BUILDING_SYMBOL_PRIO) {
    if ((byKind[kind] ?? 0) >= 1) return BUILDING_ICONS[kind]
  }
  return undefined
}

/** D17: Summe der Gebaeude-STUFEN (nicht die Artenzahl wie Mid-D3, bewusste Abweichung, R10). */
function buildingSumOf(byKind: BuildingsByProvince[string] | undefined): number {
  if (!byKind) return 0
  return Object.values(byKind).reduce((sum: number, n) => sum + (n ?? 0), 0)
}

/**
 * D20: Rohmarken fuer die Welt-Pille, nur auf far (sonst `[]`). Je eigener Provinz mit
 * Gebaeude-Summe > 0 und/oder eigenen Armeen > 0 ein `tone:'own'`-Rohmark; je
 * Kriegsgegner-Provinz (`relation === 'war'`) mit bekannten Armeen > 0 ein
 * `tone:'enemy'`-Rohmark (nie `buildingSum`, D16 — Feindgebiet zeigt nur Armeen, selbst
 * wenn Gebaeude ausgespaeht sind).
 */
export function worldRawMarks(
  buildings: BuildingsByProvince,
  armies: readonly ArmyMarker[],
  provinces: Readonly<Record<string, WorldProvinceInfo>>,
  centres: Readonly<Record<string, Point>>,
  view: View,
): WorldRawMark[] {
  if (zoomTier(view.scale) !== 'far') return []

  const armiesByProvince = new Map<string, ArmyMarker[]>()
  for (const army of armies) {
    const list = armiesByProvince.get(army.provinceId)
    if (list) list.push(army)
    else armiesByProvince.set(army.provinceId, [army])
  }

  const out: WorldRawMark[] = []
  for (const [provinceId, info] of Object.entries(provinces)) {
    const centre = centres[provinceId]
    if (!centre || !info.owner) continue
    const provinceArmies = armiesByProvince.get(provinceId) ?? []

    if (info.relation === 'self') {
      const byKind = buildings[provinceId]
      const buildingSum = buildingSumOf(byKind)
      const ownArmies = provinceArmies.filter((a) => a.own)
      const armySum = armySumOf(ownArmies)
      if (buildingSum <= 0 && armySum <= 0) continue
      out.push({
        tone: 'own',
        provinceId,
        ownerId: info.owner,
        x: centre.x,
        y: centre.y,
        ...(buildingSum > 0
          ? { buildingSum, ...(buildingIconFor(byKind) ? { buildingIcon: buildingIconFor(byKind)! } : {}) }
          : {}),
        ...(armySum > 0 ? { armySum, ...(armyIconFor(ownArmies) ? { armyIcon: armyIconFor(ownArmies)! } : {}) } : {}),
      })
      continue
    }

    if (info.relation === 'war') {
      const armySum = armySumOf(provinceArmies)
      if (armySum <= 0) continue
      out.push({
        tone: 'enemy',
        provinceId,
        ownerId: info.owner,
        x: centre.x,
        y: centre.y,
        armySum,
        ...(armyIconFor(provinceArmies) ? { armyIcon: armyIconFor(provinceArmies)! } : {}),
      })
    }
  }
  return out
}
