import { spring, easeOut } from '../ui/motion.ts'
import { toMap, toScreen, type Point, type View } from './picking.ts'
import type { Marker } from './markers.ts'

/**
 * Der Uebergang zwischen Zoomstufen (T-M<n>-05, D9, Plan Zoom-Cluster §5 E2a).
 *
 * Teilen und Buendeln von Sammelmarken als reine Funktion, ohne Leinwand und ohne
 * rAF — das kommt erst in E2b (Einbau). `planTransition` entscheidet einmal, wer wen
 * ersetzt und wie lange das dauert; `frameAt` liest daraus nur noch ab, immer wieder
 * fuer dieselbe Elapsed-Zeit dasselbe Bild (reine Funktion der Zeit, wie `ui/motion.ts`).
 */

/** Dauer des Teilens: Eltern-Marke schrumpft/blendet aus, Kinder fliegen heran (D9). */
export const CLUSTER_SPLIT_MS = 420
/** Dauer des Buendelns: Kinder fliegen zur Gruppe, die Gruppenmarke blendet ein (D9). */
export const CLUSTER_MERGE_MS = 280
/** Dauer der Blende ohne Tanzpartner — kein Flug, nur ein/aus (D9). */
export const CLUSTER_FADE_MS = 120
/** Versatz je weiterem Kind beim Teilen, bis `CLUSTER_STAGGER_MAX` (D9). */
export const CLUSTER_STAGGER_MS = 24
/** Ab dem so-vielten Kind startet jedes weitere gleichzeitig mit ihm (D9). */
export const CLUSTER_STAGGER_MAX = 8

export type DrawnMarker = Marker & { alpha: number; scale: number }

interface TweenItem {
  marker: Marker
  startMap: Point
  targetMap: Point
  startScale: number
  targetScale: number
  startAlpha: number
  targetAlpha: number
  delayMs: number
  durationMs: number
  curve: (t: number) => number
}

export interface TransitionPlan {
  direction: 'split' | 'merge'
  /** Ein Eintrag je Marke der Zielliste, in deren Reihenfolge — garantiert `frameAt` am Ende === Ziel. */
  toItems: readonly TweenItem[]
  /** Nur waehrenddessen sichtbar: ausblendende Eltern (Teilen) und Waisen ohne Partner. */
  extraItems: readonly TweenItem[]
  durationMs: number
}

/**
 * Der Paarungs-Schluessel (D9): gleicher Schluessel in beiden Listen heisst derselbe
 * Gegenstand, nicht zwei verschiedene — dann kein Flug, sofort das Ziel (g).
 * `capital`/`battle` haben keinen Schluessel — sie werden nie getweent (j).
 */
function keyOf(m: Marker): string | null {
  switch (m.kind) {
    case 'army':
      return m.armyId ? `a:${m.armyId}` : null
    case 'armyGroup':
      return m.armyIds && m.armyIds[0] !== undefined ? `ag:${m.armyIds[0]}` : null
    case 'building':
      return m.icon ? `b:${m.provinceId}:${m.icon}` : null
    case 'buildingGroup':
      return `bg:${m.provinceId}`
    default:
      return null
  }
}

function isAnimatable(m: Marker): boolean {
  return m.kind !== 'capital' && m.kind !== 'battle'
}

/** Armee-Kind: `armyId ∈ armyGroup.armyIds`. Gebaeude-Kind: gleiche Provinz wie die `buildingGroup` (D9). */
function parentAmong(child: Marker, groups: readonly Marker[]): Marker | undefined {
  if (child.kind === 'army' && child.armyId) {
    return groups.find((g) => g.kind === 'armyGroup' && g.armyIds?.includes(child.armyId!))
  }
  if (child.kind === 'building') {
    return groups.find((g) => g.kind === 'buildingGroup' && g.provinceId === child.provinceId)
  }
  return undefined
}

function snapItem(marker: Marker, toMapPt: (p: Point) => Point): TweenItem {
  const pt = toMapPt({ x: marker.x, y: marker.y })
  return {
    marker,
    startMap: pt,
    targetMap: pt,
    startScale: 1,
    targetScale: 1,
    startAlpha: 1,
    targetAlpha: 1,
    delayMs: 0,
    durationMs: 0,
    curve: (t) => t,
  }
}

export function planTransition(
  from: { view: View; markers: readonly Marker[] },
  to: readonly Marker[],
  direction: 'split' | 'merge',
): TransitionPlan {
  const toMapPt = (p: Point): Point => toMap(p, from.view)

  const fromByKey = new Map<string, Marker>()
  for (const m of from.markers) {
    const k = keyOf(m)
    if (k) fromByKey.set(k, m)
  }
  const toByKey = new Map<string, Marker>()
  for (const m of to) {
    const k = keyOf(m)
    if (k) toByKey.set(k, m)
  }

  const consumedFrom = new Set<Marker>()
  const consumedTo = new Set<Marker>()

  // Schritt 0: capital/battle werden nie getweent — immer sofort am Ziel (j).
  for (const m of to) {
    if (!isAnimatable(m)) consumedTo.add(m)
  }
  for (const m of from.markers) {
    if (!isAnimatable(m)) consumedFrom.add(m)
  }

  const toItems = new Map<Marker, TweenItem>()
  const extraItems: TweenItem[] = []

  for (const m of to) {
    if (!isAnimatable(m)) toItems.set(m, snapItem(m, toMapPt))
  }

  // Schritt A: gleicher Schluessel in beiden Listen -> kein Tween, sofort Ziel (g).
  for (const [k, toMarker] of toByKey) {
    if (consumedTo.has(toMarker)) continue
    const fromMarker = fromByKey.get(k)
    if (fromMarker && !consumedFrom.has(fromMarker)) {
      toItems.set(toMarker, snapItem(toMarker, toMapPt))
      consumedTo.add(toMarker)
      consumedFrom.add(fromMarker)
    }
  }

  if (direction === 'split') {
    const fromGroups = from.markers.filter((m) => !consumedFrom.has(m) && (m.kind === 'armyGroup' || m.kind === 'buildingGroup'))
    const childrenByParent = new Map<Marker, Marker[]>()
    for (const child of to) {
      if (consumedTo.has(child)) continue
      const parent = parentAmong(child, fromGroups)
      if (!parent) continue
      const list = childrenByParent.get(parent) ?? []
      list.push(child)
      childrenByParent.set(parent, list)
      consumedTo.add(child)
    }
    for (const [parent, children] of childrenByParent) {
      // Feinde zuerst, sonst Eingabereihenfolge (D9) — stabiler Sort, Originalreihenfolge bleibt die Rangfolge.
      const ordered = [...children].sort((a, b) => {
        const ea = a.tone === 'enemy' ? 0 : 1
        const eb = b.tone === 'enemy' ? 0 : 1
        return ea - eb
      })
      const startMap = toMapPt({ x: parent.x, y: parent.y })
      ordered.forEach((child, i) => {
        const delayMs = Math.min(i, CLUSTER_STAGGER_MAX - 1) * CLUSTER_STAGGER_MS
        toItems.set(child, {
          marker: child,
          startMap,
          targetMap: toMapPt({ x: child.x, y: child.y }),
          startScale: 0.6,
          targetScale: 1,
          startAlpha: 0,
          targetAlpha: 1,
          delayMs,
          durationMs: CLUSTER_SPLIT_MS,
          curve: spring,
        })
      })
      consumedFrom.add(parent)
      extraItems.push({
        marker: parent,
        startMap,
        targetMap: startMap,
        startScale: 1,
        targetScale: 0.6,
        startAlpha: 1,
        targetAlpha: 0,
        delayMs: 0,
        durationMs: CLUSTER_SPLIT_MS,
        curve: easeOut,
      })
    }
  } else {
    const toGroups = to.filter((m) => !consumedTo.has(m) && (m.kind === 'armyGroup' || m.kind === 'buildingGroup'))
    const groupHasChildren = new Set<Marker>()
    for (const child of from.markers) {
      if (consumedFrom.has(child)) continue
      const parent = parentAmong(child, toGroups)
      if (!parent) continue
      consumedFrom.add(child)
      groupHasChildren.add(parent)
      extraItems.push({
        marker: child,
        startMap: toMapPt({ x: child.x, y: child.y }),
        targetMap: toMapPt({ x: parent.x, y: parent.y }),
        startScale: 1,
        targetScale: 0.6,
        startAlpha: 1,
        targetAlpha: 0,
        delayMs: 0,
        durationMs: CLUSTER_MERGE_MS,
        curve: easeOut,
      })
    }
    for (const parent of groupHasChildren) {
      const pt = toMapPt({ x: parent.x, y: parent.y })
      toItems.set(parent, {
        marker: parent,
        startMap: pt,
        targetMap: pt,
        startScale: 1,
        targetScale: 1,
        startAlpha: 0,
        targetAlpha: 1,
        delayMs: 0,
        durationMs: CLUSTER_MERGE_MS,
        curve: easeOut,
      })
      consumedTo.add(parent)
    }
  }

  // Ohne Partner: 120 ms Blende, kein Ortswechsel (f).
  for (const m of from.markers) {
    if (consumedFrom.has(m)) continue
    const pt = toMapPt({ x: m.x, y: m.y })
    extraItems.push({
      marker: m,
      startMap: pt,
      targetMap: pt,
      startScale: 1,
      targetScale: 1,
      startAlpha: 1,
      targetAlpha: 0,
      delayMs: 0,
      durationMs: CLUSTER_FADE_MS,
      curve: easeOut,
    })
    consumedFrom.add(m)
  }
  for (const m of to) {
    if (consumedTo.has(m)) continue
    const pt = toMapPt({ x: m.x, y: m.y })
    toItems.set(m, {
      marker: m,
      startMap: pt,
      targetMap: pt,
      startScale: 1,
      targetScale: 1,
      startAlpha: 0,
      targetAlpha: 1,
      delayMs: 0,
      durationMs: CLUSTER_FADE_MS,
      curve: easeOut,
    })
    consumedTo.add(m)
  }

  const orderedToItems = to.map((m) => toItems.get(m)!)
  const all = [...orderedToItems, ...extraItems]
  const durationMs = all.reduce((max, it) => Math.max(max, it.delayMs + it.durationMs), 0)
  return { direction, toItems: orderedToItems, extraItems, durationMs }
}

function drawAt(item: TweenItem, elapsedMs: number, view: View): DrawnMarker {
  const local = elapsedMs - item.delayMs
  const atEnd = item.durationMs <= 0 || local >= item.durationMs
  if (atEnd) {
    return { ...item.marker, x: item.marker.x, y: item.marker.y, alpha: item.targetAlpha, scale: item.targetScale }
  }
  const t = local <= 0 ? 0 : local / item.durationMs
  const curveVal = item.curve(t)
  const alpha = item.startAlpha + curveVal * (item.targetAlpha - item.startAlpha)
  const scale = item.startScale + curveVal * (item.targetScale - item.startScale)
  const mapX = item.startMap.x + curveVal * (item.targetMap.x - item.startMap.x)
  const mapY = item.startMap.y + curveVal * (item.targetMap.y - item.startMap.y)
  const screen = toScreen({ x: mapX, y: mapY }, view)
  return { ...item.marker, x: screen.x, y: screen.y, alpha: Math.max(0, Math.min(1, alpha)), scale }
}

/**
 * Das Bild bei `elapsedMs`, mit der aktuellen View projiziert (i): Start- und Zielpunkte
 * liegen im Kartenraum (bei `planTransition` festgehalten) und werden hier neu auf den
 * Bildschirm projiziert — bewegt sich die Karte waehrend des Tweens, folgt der Startpunkt
 * ihr mit. Nach Ablauf der jeweiligen Dauer liefert jede Marke exakt ihr Ziel (e, g, j).
 */
export function frameAt(plan: TransitionPlan, elapsedMs: number, view: View): DrawnMarker[] {
  const out: DrawnMarker[] = plan.toItems.map((item) => drawAt(item, elapsedMs, view))
  for (const item of plan.extraItems) {
    const drawn = drawAt(item, elapsedMs, view)
    if (drawn.alpha > 0) out.push(drawn)
  }
  return out
}

/** Ob der ganze Uebergang (alle Marken inkl. ausblendender Waisen/Eltern) vorbei ist. */
export function done(plan: TransitionPlan, elapsedMs: number): boolean {
  return elapsedMs >= plan.durationMs
}
