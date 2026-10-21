import { ZOOM_NEAR_MAX_SCALE, zoomTier } from './picking.ts'
import { BUILDING_ICONS, type IconName } from '../ui/icons.tsx'
import type { BuildingKey } from '@worldwar/core'
import type { ArmyMarker, BuildingsByProvince, MarkerTone } from './markers.ts'

/**
 * Die Sammelmarke (T-M49-01, D1-D7): ab vier Armeen mit gleichem Schluessel — Provinz, Station,
 * Seite — wird auf mittlerer und weiter Stufe EINE Marke gezeichnet statt vier Kaesten.
 *
 * Reine Funktionen ohne Leinwand: Zeichnen (`markers.ts`) und Klick (`pickArmyGroup`) fragen
 * dieselbe Gruppierung, damit getroffen wird, was man sieht. Der Import aus `markers.ts` ist
 * nur ein Typ-Import (D12) — kein Zyklus.
 */

/** Ab so vielen Armeen (ohne die gewaehlte) entsteht eine Gruppe (D3). */
export const ARMY_GROUP_MIN = 4

/** Der Massstab, auf den ein Klick auf die Sammelmarke zoomt (D8). */
export const GROUP_ZOOM_SCALE = ZOOM_NEAR_MAX_SCALE

/** Der Stapel-Ton aus Besitz und Beziehung (D12: hierher gezogen, `markers.ts` fuehrt ihn weiter). */
export function toneFor(army: Pick<ArmyMarker, 'own' | 'relation'>): MarkerTone {
  if (army.own) return 'own'
  if (army.relation === 'war') return 'enemy'
  if (army.relation === 'alliance') return 'ally'
  return 'other'
}

export interface ArmyGroup {
  key: string
  provinceId: string
  toProvinceId: string | null
  tone: MarkerTone
  own: boolean
  members: readonly ArmyMarker[]
  rep: ArmyMarker
  icon?: IconName
  label: string
}

/** D2: Provinz, naechste Station, Seite. */
export function groupKey(army: ArmyMarker): string {
  return `${army.provinceId}|${army.march?.toProvinceId ?? '-'}|${toneFor(army)}`
}

/** D4: das icon mit der groessten Summe `count`; Gleichstand: das zuerst aufgetretene. */
function groupIcon(members: readonly ArmyMarker[]): IconName | undefined {
  const sums = new Map<IconName, number>()
  for (const m of members) {
    if (!m.icon) continue
    sums.set(m.icon, (sums.get(m.icon) ?? 0) + (m.count ?? 1))
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

/** D6: Summe `count` (ab 1000 als `Nk`), sonst `×Mitglieder`. */
function groupLabel(members: readonly ArmyMarker[]): string {
  if (members.every((m) => m.count !== undefined)) {
    const n = members.reduce((sum, m) => sum + (m.count ?? 0), 0)
    return n >= 1000 ? `${Math.floor(n / 1000)}k` : String(n)
  }
  return `×${members.length}`
}

/**
 * Teilt die Armeen in Einzelne und Gruppen (D3-D6). Die gewaehlte Armee gehoert nie zu einer
 * Gruppe und zaehlt nicht mit. `singles` in Eingabereihenfolge, `groups` in der Reihenfolge
 * ihres ersten Mitglieds.
 */
export function groupArmies(
  armies: readonly ArmyMarker[],
  selectedArmyId: string | null,
): { singles: ArmyMarker[]; groups: ArmyGroup[] } {
  const buckets = new Map<string, ArmyMarker[]>()
  for (const army of armies) {
    if (army.id === selectedArmyId) continue
    const key = groupKey(army)
    const list = buckets.get(key)
    if (list) list.push(army)
    else buckets.set(key, [army])
  }

  const groups: ArmyGroup[] = []
  const grouped = new Set<string>()
  for (const [key, members] of buckets) {
    if (members.length < ARMY_GROUP_MIN) continue
    const first = members[0]!
    const icon = groupIcon(members)
    const rep = (icon ? members.find((m) => m.icon === icon) : undefined) ?? first
    for (const m of members) grouped.add(m.id)
    groups.push({
      key,
      provinceId: first.provinceId,
      toProvinceId: first.march?.toProvinceId ?? null,
      tone: toneFor(first),
      own: first.own,
      members,
      rep,
      ...(icon ? { icon } : {}),
      label: groupLabel(members),
    })
  }
  return { singles: armies.filter((a) => !grouped.has(a.id)), groups }
}

/** D7: near alle Armeen, sonst Einzelne und je Gruppe der Vertreter, in Eingabereihenfolge. */
export function arrowArmies(
  armies: readonly ArmyMarker[],
  scale: number,
  selectedArmyId: string | null,
): ArmyMarker[] {
  if (zoomTier(scale) === 'near') return [...armies]
  const { singles, groups } = groupArmies(armies, selectedArmyId)
  const keep = new Set<string>([...singles.map((a) => a.id), ...groups.map((g) => g.rep.id)])
  return armies.filter((a) => keep.has(a.id))
}

/** D7: near immer, sonst nur fuer die gewaehlte Armee. */
export function showDayLabel(armyId: string, scale: number, selectedArmyId: string | null): boolean {
  if (zoomTier(scale) === 'near') return true
  return armyId === selectedArmyId
}

/**
 * Gebaeude-Sammelmarke (T-M51-01, D1-D8, Plan Zoom-Cluster): ab zwei Gebaeudearten mit
 * Stufe >= 1 in derselben Provinz wird auf mid EINE Marke statt mehrerer Quadrate
 * berechnet. Reine Funktion ohne Leinwand, wie `groupArmies` — Zeichnen (`markers.ts`)
 * und Klick (`pickBuildingGroup`) fragen dieselbe Gruppierung.
 */

/** Ab so vielen Gebaeudearten (Stufe >= 1) entsteht eine Gruppe (D3). */
export const BUILDING_GROUP_MIN = 2

/**
 * Vorrang des Symbols (D4): die erste vorhandene Art gewinnt. Bewusste Abweichung vom
 * Mockup v3b (`v3b.mjs:58`), das noch die alte Thinker-Prio (Festung zuerst) nutzt.
 */
export const BUILDING_SYMBOL_PRIO: readonly BuildingKey[] = [
  'factory',
  'airfield',
  'harbour',
  'shipyard',
  'barracks',
  'railway',
  'fortress',
]

export interface BuildingGroup {
  /** Zahl der Arten mit Stufe >= 1 (Datenwahrheit, nicht die Zahl platzierter Quadrate). */
  n: number
  icon: IconName
  /** Die vorhandenen Arten, nach Vorrang sortiert (D4). */
  kinds: readonly BuildingKey[]
}

/**
 * Gruppiert Gebaeude je Provinz (D3-D4). Nur Provinzen mit mindestens `BUILDING_GROUP_MIN`
 * Arten (Stufe >= 1) landen in der Map — eine einzelne Art bleibt das heutige Einzelquadrat.
 */
export function groupBuildings(buildings: BuildingsByProvince): Map<string, BuildingGroup> {
  const out = new Map<string, BuildingGroup>()
  for (const [provinceId, byKind] of Object.entries(buildings)) {
    const kinds = BUILDING_SYMBOL_PRIO.filter((kind) => (byKind[kind] ?? 0) >= 1)
    if (kinds.length < BUILDING_GROUP_MIN) continue
    out.set(provinceId, { n: kinds.length, icon: BUILDING_ICONS[kinds[0]!] ?? 'warning', kinds })
  }
  return out
}
