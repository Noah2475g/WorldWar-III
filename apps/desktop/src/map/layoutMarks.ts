/**
 * Markenkollision auf mid/far (E7, Plan §4 D14, Spec §12.14.1/§12.14.2).
 *
 * Reine Geometrie, ohne DOM: dieselbe Regel, die im Mockup (`v3b.mjs`, Referenz-Eigenbau)
 * im Browser mit echten Rechtecken lief, hier als Funktion auf vorgerechneten Rechtecken.
 * `near` bleibt bitgleich (Plan K16) — dieses Modul wird dort nicht aufgerufen.
 *
 * Vorrang (Schritt 1): Feind (4) > Auswahl (3) > eigene Armee (2) > Gebaeude (1). Gemischte
 * Pille (eigen|feind in derselben Provinz, Schritt 2) zaehlt wie Feind, denn sie zeigt den
 * Feind. Schritt 3: Platz an der Mitte, sonst Versatz im Ring bis 28 px (Armeen/Feind bis
 * 44 px, Gebaeude nur bis 13 px — Entscheidung D14, dann Ruecktritt). Schritt 4: Anker-Linie,
 * wenn der Versatz die Mitte verlaesst. Schritt 5: Zusammenlegen gleicher Seite/Macht in
 * Reichweite. Schritt 6: Notfall — geringste Ueberdeckung, aber innerhalb der Karte. Schritt 7:
 * Gebaeude ohne Platz treten zurueck (werden nicht gezeichnet, zaehlen als `retreated`).
 */

export type MarkKind = 'foe' | 'mix' | 'army' | 'building'
export type MarkSide = 'me' | 'foe' | 'mix' | 'bm'

export interface MarkInput {
  id: string
  /** Vorrang: 4 Feind, 3 Auswahl/gemischt, 2 eigene Armee, 1 Gebaeude. */
  pri: number
  kind: MarkKind
  side: MarkSide
  /** Macht, der die Marke zugerechnet wird — fuer das Zusammenlegen (Schritt 5). */
  pow: string
  /** Ankerpunkt (Provinzmitte o.ae.) in Bildpunkten. */
  ax: number
  ay: number
  w: number
  h: number
  /** Zahl in der Pille, fuer das Zusammenlegen (Schritt 5: addiert). */
  n: number
  label?: string
  foe?: boolean
}

export interface PlacedMark {
  id: string
  kind: MarkKind
  side: MarkSide
  tone: 'own' | 'enemy' | 'mix' | 'building'
  rect: { x: number; y: number; w: number; h: number }
  label?: string
  foe: boolean
  /** Anker-Linie zur Provinzmitte, nur wenn der Versatz die Mitte verlaesst (Schritt 4). */
  anchor?: { x: number; y: number }
  /** In eine andere Marke zusammengelegt (Schritt 5) — nicht gezeichnet. */
  merged?: boolean
}

export interface LabelInput {
  pow: string
  label: string
  /** Mitte der sichtbaren Provinzen dieser Macht, Startpunkt der Suche. */
  x: number
  y: number
  w: number
  h: number
}

export interface LabelRect {
  pow: string
  label: string
  rect: { x: number; y: number; w: number; h: number }
}

export interface LayoutResult {
  marks: PlacedMark[]
  labelRects: LabelRect[]
  /** Gebaeude, die keinen Platz fanden und nicht gezeichnet wurden (Schritt 7, Plan K16). */
  retreatedBuildings: number
}

export interface MapBounds {
  x: number
  y: number
  width: number
  height: number
}

/** Gebaeude treten NUR gegen diese Marken-Arten zurueck (Planer-Nacharbeit Runde 1, Punkt 1). */
export const BUILDINGS_YIELD_TO: readonly MarkKind[] = ['army', 'foe', 'mix']

/** Gebaeude: Versatz nur bis 13 px, danach Ruecktritt statt Notfall (Entscheidung D14). */
const BUILDING_MAX_OFFSET = 13
const RING_RADII = [12, 20, 28] as const
const RING_STEPS_PER_RADIUS = 12
const EXT_RADII = [36, 44] as const
const EXT_STEPS_PER_RADIUS = 16
/** Zusammenlegen (Schritt 5): gleiche Seite/Macht in dieser Reichweite vom Anker. */
const MERGE_RADIUS = 64

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

const toBox = (w: number, h: number, cx: number, cy: number): Rect => ({ x: cx - w / 2, y: cy - h / 2, w, h })

const overlaps = (a: Rect, b: Rect, pad = 0): boolean =>
  !(a.x >= b.x + b.w + pad || a.x + a.w + pad <= b.x || a.y >= b.y + b.h + pad || a.y + a.h + pad <= b.y)

const overlapArea = (a: Rect, b: Rect): number => {
  const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  return ox > 0 && oy > 0 ? ox * oy : 0
}

const inside = (r: Rect, bounds: MapBounds, margin = 4): boolean =>
  r.x >= bounds.x + margin &&
  r.x + r.w <= bounds.x + bounds.width - margin &&
  r.y >= bounds.y + margin &&
  r.y + r.h <= bounds.y + bounds.height - margin

/** Ring-Versaetze, nach Entfernung sortiert — wie das Mockup, in Bildpunkten statt CSS. */
function ringOffsets(radii: readonly number[], perRadius: number): [number, number][] {
  const out: [number, number][] = [[0, 0]]
  for (const radius of radii) {
    for (let k = 0; k < perRadius; k++) {
      const angle = (k * Math.PI * 2) / perRadius - Math.PI / 2
      out.push([Math.round(Math.cos(angle) * radius * 1.4), Math.round(Math.sin(angle) * radius)])
    }
  }
  return out
}

const RING = ringOffsets(RING_RADII, RING_STEPS_PER_RADIUS)
const RING_EXT = ringOffsets(EXT_RADII, EXT_STEPS_PER_RADIUS)

const toneOf = (side: MarkSide): PlacedMark['tone'] =>
  side === 'bm' ? 'building' : side === 'foe' ? 'enemy' : side === 'mix' ? 'mix' : 'own'

interface Placed {
  input: MarkInput
  rect: Rect
  cx: number
  cy: number
}

/**
 * Legt eine Liste von Marken an (Schritte 1-7). `bounds` ist das Sicht-Rechteck in
 * Bildpunkten (z. B. {x:0,y:0,width:1280,height:744}); Marken ausserhalb werden
 * trotzdem platziert, wenn ihr Anker im Rechteck liegt — das ist Aufgabe des Aufrufers.
 */
export function layoutMarks(input: readonly MarkInput[], bounds: MapBounds): LayoutResult {
  const items = [...input].sort((a, b) => b.pri - a.pri || b.n - a.n)
  const placed: Placed[] = []
  const out: PlacedMark[] = []
  let retreatedBuildings = 0

  for (const it of items) {
    const isBuilding = it.kind === 'building'
    let spot: [number, number, Rect] | null = null

    for (const [dx, dy] of RING) {
      if (isBuilding && Math.hypot(dx, dy) > BUILDING_MAX_OFFSET) break
      const r = toBox(it.w, it.h, it.ax + dx, it.ay + dy)
      if (inside(r, bounds) && !placed.some((p) => overlaps(r, p.rect))) {
        spot = [dx, dy, r]
        break
      }
    }

    if (!spot && !isBuilding) {
      for (const [dx, dy] of RING_EXT) {
        const r = toBox(it.w, it.h, it.ax + dx, it.ay + dy)
        if (inside(r, bounds) && !placed.some((p) => overlaps(r, p.rect))) {
          spot = [dx, dy, r]
          break
        }
      }
    }

    if (!spot && isBuilding) {
      // Schritt 7: Gebaeude nur gegen Armee/Feind/Namen zurueck (BUILDINGS_YIELD_TO) — gegen
      // andere Gebaeude gibt es hier keine Pruefung (anchors.ts regelt das schon, keine
      // gegenseitige Kollision). Fand es in 13 px keinen freien Platz, tritt es zurueck.
      retreatedBuildings++
      continue
    }

    if (!spot) {
      // Schritt 5: gleiche Seite und Macht in Reichweite zusammenlegen (Zahl addiert).
      let target: Placed | null = null
      let bestDistance = Infinity
      for (const p of placed) {
        if (p.input.side !== it.side || p.input.pow !== it.pow || it.side === 'mix') continue
        const d = Math.hypot(p.cx - it.ax, p.cy - it.ay)
        if (d < MERGE_RADIUS && d < bestDistance) {
          bestDistance = d
          target = p
        }
      }
      if (target) {
        const existing = out.find((o) => o.id === target!.input.id)
        if (existing) existing.label = String((Number(existing.label) || target.input.n) + it.n)
        out.push({
          id: it.id,
          kind: it.kind,
          side: it.side,
          tone: toneOf(it.side),
          rect: { ...target.rect },
          foe: it.foe ?? false,
          merged: true,
        })
        continue
      }

      // Schritt 6: Notfall — geringste Ueberdeckung, aber innerhalb der Karte. Sucht dieselben
      // Ringe wie Schritt 3 (Gebaeude nur den kleinen, Armeen/Feind auch den erweiterten) — sonst
      // waere der Notfall schlechter als der reguläre Versuch, der ihm vorausging (Befund E7-Messung).
      let bestDx = 0
      let bestDy = 0
      let bestRect = toBox(it.w, it.h, it.ax, it.ay)
      let bestPenalty = Infinity
      for (const [dx, dy] of isBuilding ? RING : [...RING, ...RING_EXT]) {
        const r = toBox(it.w, it.h, it.ax + dx, it.ay + dy)
        const penalty = (inside(r, bounds) ? 0 : 1e7) + placed.reduce((sum, p) => sum + overlapArea(r, p.rect), 0)
        if (penalty < bestPenalty) {
          bestPenalty = penalty
          bestDx = dx
          bestDy = dy
          bestRect = r
        }
      }
      spot = [bestDx, bestDy, bestRect]
    }

    const [dx, dy, r] = spot
    const cx = it.ax + dx
    const cy = it.ay + dy
    const placedMark: Placed = { input: it, rect: r, cx, cy }
    placed.push(placedMark)
    out.push({
      id: it.id,
      kind: it.kind,
      side: it.side,
      tone: toneOf(it.side),
      rect: r,
      ...(it.label !== undefined ? { label: it.label } : {}),
      foe: it.foe ?? false,
      // Schritt 4: Anker-Linie nur wenn die Mitte den Versatz verlaesst (die Marke die Mitte nicht mehr deckt).
      ...(dx !== 0 || dy !== 0 ? { anchor: { x: it.ax, y: it.ay } } : {}),
    })
  }

  return { marks: out, labelRects: layoutLabels(input, out, bounds), retreatedBuildings }
}

/** Machtnamen frei platzieren (§12.14.2): Marken und bereits gesetzte Namen meiden, sonst zurueck. */
function layoutLabels(_input: readonly MarkInput[], marks: readonly PlacedMark[], bounds: MapBounds): LabelRect[] {
  return placeLabels([], marks, bounds)
}

const LABEL_OFFSETS: [number, number][] = (() => {
  const out: [number, number][] = []
  for (const dy of [0, -14, 14, -28, 28, -42, 42, -56, 56, -70, 70]) {
    for (const dx of [0, -24, 24, -48, 48, -72, 72, -96, 96]) out.push([dx, dy])
  }
  return out.sort((a, b) => Math.hypot(a[0], a[1] * 1.6) - Math.hypot(b[0], b[1] * 1.6))
})()

/**
 * Machtnamen frei (§12.14.2): eigene Funktion, damit der Aufrufer sie mit der
 * `ownAt`-Probe (Pixel ueber eigenem Gebiet) fuettern kann — die hat dieses Modul nicht,
 * weil sie die gezeichnete Flaeche (Canvas) braucht. Ohne `ownAt` gilt nur Kollision.
 */
export function placeLabels(
  labels: readonly LabelInput[],
  marks: readonly PlacedMark[],
  bounds: MapBounds,
  ownAt?: (x: number, y: number, pow: string) => boolean,
): LabelRect[] {
  const markRects = marks.map((m) => m.rect)
  const out: LabelRect[] = []
  for (const label of labels) {
    let placedRect: Rect | null = null
    for (const [dx, dy] of LABEL_OFFSETS) {
      const r = toBox(label.w, label.h, label.x + dx, label.y + dy)
      if (!inside(r, bounds)) continue
      if (markRects.some((m) => overlaps(r, m, 3))) continue
      if (out.some((o) => overlaps(r, o.rect, 8))) continue
      if (ownAt) {
        const cy = r.y + r.h / 2
        const midOk = ownAt(r.x + r.w / 2, cy, label.pow)
        const sideOk = ownAt(r.x + 2, cy, label.pow) || ownAt(r.x + r.w - 2, cy, label.pow)
        if (!midOk || !sideOk) continue
      }
      placedRect = r
      break
    }
    if (!placedRect) continue // Schritt 7 (Namen): kein freier Platz -> Name tritt zurueck, nicht erzwingen.
    out.push({ pow: label.pow, label: label.label, rect: placedRect })
  }
  return out
}
