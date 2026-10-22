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
  /**
   * AK15-Nachbesserung (Review-Runde 1): nur auf einer zusammengelegten Marke gesetzt —
   * die Provinzen, die `clusterWorldMarks` in diese eine Marke zusammengefasst hat
   * (einschliesslich `provinceId` selbst). Fehlt auf unberuehrten Einzelmarken.
   */
  memberProvinceIds?: readonly string[]
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

/** Die groesste Einzelsumme einer Auswahl, fuer das Symbol nach dem Zusammenlegen (D19-Muster). */
function biggestIcon(
  members: readonly WorldRawMark[],
  sumOf: (m: WorldRawMark) => number | undefined,
  iconOf: (m: WorldRawMark) => IconName | undefined,
): IconName | undefined {
  let best: IconName | undefined
  let bestSum = -Infinity
  for (const m of members) {
    const icon = iconOf(m)
    if (icon === undefined) continue
    const sum = sumOf(m) ?? 0
    if (sum > bestSum) {
      best = icon
      bestSum = sum
    }
  }
  return best
}

/**
 * AK15-Nachbesserung (Review-Runde 1, Befund Abschnitt 6): echtes macht-uebergreifendes
 * Zusammenlegen auf far, VOR dem Platzieren durch `layoutMarks`.
 *
 * `layoutMarks`s eigener Zusammenlegen-Zweig (Schritt 5) wird bei realistischen
 * Provinz-Abstaenden praktisch nie erreicht: `WORLD_PILL_SEGMENT`/`BUILDING_GROUP_BOX`
 * (20x20 bzw. 41x20 px) findet fast immer schon im Ring-Versatz (12/20/28, bei
 * Armee/Feind zusaetzlich 36/44 px) einen kollisionsfreien Platz, sodass `mergeRadius`
 * (64/72/0) fuer `collideWorldMarks` praktisch wirkungslos blieb (vom Reviewer am
 * Produktionscode reproduziert).
 *
 * Dieser Vorlauf fasst Rohmarken VOR dem Platzieren zusammen: gleiche `tone` UND
 * `ownerId`, Abstand < `radius`. `buildingSum`/`armySum` werden aufsummiert
 * (D18-Muster), Symbol je Segment ist das der groessten Einzelsumme (D19-Muster,
 * `armyIconFor`-Analogon). Der Ankerpunkt der zusammengelegten Marke ist der Schwerpunkt
 * (Mittel) der Mitglieder, die Kennung (`provinceId`/`ownerId`) die des ersten Mitglieds
 * (Naeherung wie bei `layoutMarks`s eigenem Zusammenlegen: "Icon/Kennung der ersten
 * Provinz").
 *
 * AK15-Nachbesserung (Review-Runde 2, Befund "Zentraler Mangel"): die urspruengliche
 * Variante (Runde 1) nutzte Union-Find mit Single-Linkage-Verkettung ("A < radius bei B,
 * B < radius bei C -> eine Gruppe, auch wenn A und C selbst >= radius auseinanderliegen").
 * Das erzeugt auf echten Kartendaten mit dicht aneinandergereihten Provinzzentren einen
 * unbegrenzten "chaining effect": eine durchgehende Nachbarschaftskette zieht beliebig
 * weit entfernte Punkte in EINE Gruppe (am S575-Spielstand kollabierte so die gesamte
 * West-Afrika-bis-Zentralasien-Landmasse auf eine Marke statt mehrerer, vgl. Bild 5).
 *
 * Runde 2 ersetzt das durch eine **Complete-Linkage-Variante** (gewaehlte Option von den
 * drei im Review vorgeschlagenen, siehe R11-Risikoabschnitt im Bericht): ein Punkt wird
 * einer bestehenden Gruppe nur dann zugeschlagen, wenn er zu JEDEM bereits vorhandenen
 * Mitglied dieser Gruppe < `radius` liegt (nicht nur zum naechsten einzelnen Punkt wie bei
 * Single-Linkage). Dadurch bleibt der maximale paarweise Abstand innerhalb einer Gruppe per
 * Konstruktion immer < `radius` — die Gruppen-Ausdehnung ist begrenzt, eine Kettenreaktion
 * ueber mehrere Gruppenlaengen hinweg ist ausgeschlossen. Passt ein Punkt zu mehreren
 * bestehenden Gruppen, wird die mit dem naechsten Mitglied gewaehlt (deterministisch,
 * reihenfolgeabhaengig wie ein Greedy-Verfahren — fuer die Welt-Pille ausreichend, da nur
 * die Anzahl/Groesse der resultierenden Pillen zaehlt, nicht ein global optimales
 * Clustering).
 *
 * Isoliert in `welt.ts` — `layoutMarks.ts`-Kernschleife (Mid/Near/E1/E2) bleibt
 * unberuehrt, nur `collideWorldMarks` (markers.ts) ruft diese Funktion vor dem Bau der
 * `MarkInput`-Liste auf.
 */
export function clusterWorldMarks(marks: readonly WorldRawMark[], radius: number): WorldRawMark[] {
  const n = marks.length
  const groups: number[][] = []

  for (let i = 0; i < n; i++) {
    const m = marks[i]!
    let bestGroup: number[] | undefined
    let bestDist = Infinity
    for (const group of groups) {
      const first = marks[group[0]!]!
      if (first.tone !== m.tone || first.ownerId !== m.ownerId) continue
      let fits = true
      let minDist = Infinity
      for (const idx of group) {
        const other = marks[idx]!
        const d = Math.hypot(other.x - m.x, other.y - m.y)
        if (d >= radius) {
          fits = false
          break
        }
        if (d < minDist) minDist = d
      }
      if (fits && minDist < bestDist) {
        bestDist = minDist
        bestGroup = group
      }
    }
    if (bestGroup) bestGroup.push(i)
    else groups.push([i])
  }

  const out: WorldRawMark[] = []
  for (const indices of groups) {
    const first = marks[indices[0]!]!
    if (indices.length < 2) {
      out.push(first)
      continue
    }
    const members = indices.map((i) => marks[i]!)
    const buildingSum = members.reduce((sum, m) => sum + (m.buildingSum ?? 0), 0)
    const armySum = members.reduce((sum, m) => sum + (m.armySum ?? 0), 0)
    const x = members.reduce((sum, m) => sum + m.x, 0) / members.length
    const y = members.reduce((sum, m) => sum + m.y, 0) / members.length
    out.push({
      tone: first.tone,
      provinceId: first.provinceId,
      ownerId: first.ownerId,
      x,
      y,
      memberProvinceIds: members.map((m) => m.provinceId),
      ...(buildingSum > 0
        ? {
            buildingSum,
            ...(biggestIcon(members, (m) => m.buildingSum, (m) => m.buildingIcon)
              ? { buildingIcon: biggestIcon(members, (m) => m.buildingSum, (m) => m.buildingIcon)! }
              : {}),
          }
        : {}),
      ...(armySum > 0
        ? {
            armySum,
            ...(biggestIcon(members, (m) => m.armySum, (m) => m.armyIcon)
              ? { armyIcon: biggestIcon(members, (m) => m.armySum, (m) => m.armyIcon)! }
              : {}),
          }
        : {}),
    })
  }
  return out
}
