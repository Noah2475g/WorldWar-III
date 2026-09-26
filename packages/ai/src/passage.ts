import { ONE, divFixed, mulChain } from '@worldwar/shared'
import {
  findPath,
  neighborsOf,
  TERRAIN_FACTORS,
  type Command,
  type Edge,
  type PlayerId,
  type ProvinceId,
  type PublicView,
  type VisibleArmy,
  type VisibleProvince,
} from '@worldwar/core'
import { explainRelationship, relationship } from './relationship'
import { warDeclaredThisTurn } from './provinceValue'
import type { AiContext, Explanation } from './types'

/**
 * Antrag statt Marsch (T-M17-10, R-DIP-08, D29.8, Befund B6).
 *
 * Vor jedem `MOVE_ARMY` der Taktik sagt `predictLandPath` den Landweg voraus, den der Kern
 * planen wird — als Nachbau von `edgeTravelTicks` (`rules/movement.ts`) auf der oeffentlichen
 * Sicht, denn die KI darf nur wissen, was sie sieht (R-AI-01). Fuehrt der Weg ueber eine
 * Provinz einer Macht, mit der Frieden oder Waffenstillstand herrscht, ohne Buendnis und ohne
 * unbefristetes Recht, wird nicht marschiert, sondern `requestRightOfWay` gestellt — und die
 * Armee bleibt stehen (E1: kein Ausweichziel, D29.8 woertlich).
 */

/** Wer im Weg steht, und warum. */
export interface PassageBlock {
  provinceId: ProvinceId
  owner: PlayerId
  reason: 'ohne Durchmarschrecht' | 'Durchmarschrecht gekündigt'
}

const provinceCache = new WeakMap<PublicView, Map<ProvinceId, VisibleProvince>>()

function provinceIndex(view: PublicView): Map<ProvinceId, VisibleProvince> {
  let index = provinceCache.get(view)
  if (!index) {
    index = new Map(view.provinces.map((province) => [province.id, province]))
    provinceCache.set(view, index)
  }
  return index
}

/** Besitzer laut Sicht; unbekannte Provinz = herrenlos (E2). Per WeakMap auf die Sicht zwischengespeichert. */
export function ownerOf(context: AiContext, provinceId: ProvinceId): PlayerId | null {
  return provinceIndex(context.view).get(provinceId)?.owner ?? null
}

/** Sperrt `owner` meinen Weg? (E3) */
export function blocksPassage(
  context: AiContext,
  owner: PlayerId | null,
): 'ohne Durchmarschrecht' | 'Durchmarschrecht gekündigt' | null {
  if (owner === null || owner === context.view.playerId) return null
  const relation = context.view.relations[owner]
  if (!relation) return null
  if (relation.state === 'war' || relation.state === 'alliance') return null
  if (relation.passageReceived && relation.passageEndsAtTick.received === null) return null
  return relation.passageReceived ? 'Durchmarschrecht gekündigt' : 'ohne Durchmarschrecht'
}

/** Der Landweg, den der Kern planen wird (E2), oder null. */
export function predictLandPath(context: AiContext, army: VisibleArmy, target: ProvinceId): ProvinceId[] | null {
  const { view, map, rules } = context

  let speed = Number.MAX_SAFE_INTEGER
  for (const stack of army.units ?? []) {
    const rule = rules.units[stack.unitKey]
    if (rule) speed = Math.min(speed, rule.speedKmh)
  }
  if (speed === Number.MAX_SAFE_INTEGER) speed = 0

  const oilShort = view.self.shortages.includes('oil')
  const provinces = provinceIndex(view)

  const edgeCost = (edge: Edge, from: ProvinceId, to: ProvinceId): number => {
    if (speed <= 0) return Number.MAX_SAFE_INTEGER

    // Eisenbahn der Ausgangsprovinz — nur die eigene, fremde Eisenbahnen kennt die KI nicht.
    let railway = ONE
    if (ownerOf(context, from) === view.playerId) {
      const level = provinces.get(from)?.buildings?.railway ?? 0
      if (level > 0) {
        const bonus = rules.buildings.railway.effects.movementBonusPermille ?? 0
        railway = Math.min(rules.constants.railwayFactor, ONE + bonus * level)
      }
    }

    // Gebietsfaktor des Ziels.
    const toOwner = ownerOf(context, to)
    const territory =
      toOwner === view.playerId
        ? ONE
        : toOwner === null
          ? rules.constants.foreignTerritoryFactor
          : view.relations[toOwner]?.state === 'war'
            ? rules.constants.hostileTerritoryFactor
            : rules.constants.foreignTerritoryFactor

    const factors = [railway, territory]
    if (edge.kind === 'land') {
      const toProvince = provinces.get(to)
      if (toProvince) factors.push(TERRAIN_FACTORS[toProvince.terrain])
    }
    if (oilShort) factors.push(500)

    const effective = mulChain([speed, ...factors])
    if (effective <= 0) return Number.MAX_SAFE_INTEGER
    return Math.max(1, Math.ceil(divFixed(edge.distanceKm * ONE, effective) / ONE))
  }

  const result = findPath(map, army.provinceId, target, { canUseSea: false, edgeCost })
  if (!result || result.path.length === 0) return null
  return result.path
}

/** Die erste sperrende Provinz auf `path`; Provinzen von `tolerate` zählen nicht (E4). */
export function firstBlock(
  context: AiContext,
  path: readonly ProvinceId[],
  tolerate: PlayerId | null,
): PassageBlock | null {
  for (const provinceId of path) {
    const owner = ownerOf(context, provinceId)
    if (owner === tolerate) continue
    const reason = blocksPassage(context, owner)
    if (reason) return { provinceId, owner: owner!, reason }
  }
  return null
}

/**
 * Antrag statt Marsch (E1, E5, E6). Schreibt Befehl, Erklärung und `memory.assignments`.
 * `requested` dedupliziert je Aufruf von `militaryCommands`.
 *
 * `pending` sind die Befehle, die derselbe `decide()`-Aufruf schon in fruehere Stufen
 * gelegt hat (R-AI-09/AK2, Nacharbeit ki, Befund M17-D14). `view.relations[owner]` ist eine
 * Momentaufnahme vom Zugbeginn — eine eigene `declareWar` derselben Strategiestufe steht
 * darin noch nicht, sie ist ja selbst nur ein Befehl in `pending`. Ohne diese Pruefung
 * beantragte die Taktikstufe im selben Zug einen Durchmarsch bei genau der Macht, der die
 * Strategiestufe eben den Krieg erklaert hat — der Kern lehnt den Antrag dann mit
 * `INVALID_TARGET`/'Kriegserklärung läuft' ab (`commands/diplomacy.ts`), weil `declareWar`
 * zuerst angewendet wird und `relation.warEffectiveAtTick` schon gesetzt ist, wenn der
 * zweite Befehl desselben Zugs geprueft wird.
 */
export function requestPassage(
  context: AiContext,
  army: VisibleArmy,
  target: ProvinceId,
  block: PassageBlock,
  commands: Command[],
  explanations: Explanation[],
  requested: Set<PlayerId>,
  pending: readonly Command[] = [],
): void {
  const { view, memory, rules } = context
  const me = view.playerId
  const owner = block.owner
  const lifetime = rules.constants.offerLifetimeDays * rules.constants.ticksPerDay
  const tick = view.tick
  const alternative = { action: `durch ${block.provinceId} marschieren (Überfall auf ${owner})`, score: 0 }

  const relation = view.relations[owner]
  const declaringThisTurn = warDeclaredThisTurn(context, pending).has(owner)
  const cannotRequest =
    !relation ||
    (relation.state !== 'peace' && relation.state !== 'truce') ||
    relation.warEffectiveAtTick !== undefined ||
    relation.passageReceived ||
    declaringThisTurn

  if (cannotRequest) {
    explanations.push({
      action: `Marsch von ${army.id} nach ${target} unterbleibt`,
      reason: declaringThisTurn
        ? `Weg über ${block.provinceId} (${owner}), Kriegserklärung läuft`
        : `Weg über ${block.provinceId} (${owner}), ${block.reason}`,
      score: 400,
      alternative,
    })
    memory.assignments[army.id] = `blocked:${owner}`
    return
  }

  if (requested.has(owner)) {
    memory.assignments[army.id] = `passage:${owner}:${tick}`
    explanations.push({
      action: `Marsch von ${army.id} nach ${target} unterbleibt`,
      reason: `wartet auf den Antrag bei ${owner}`,
      score: 400,
      alternative,
    })
    return
  }

  const previous = memory.assignments[army.id]
  if (previous?.startsWith(`passage:${owner}:`)) {
    const since = Number(previous.split(':')[2])
    if (tick - since < lifetime) {
      explanations.push({
        action: `Marsch von ${army.id} nach ${target} unterbleibt`,
        reason: `wartet auf Antwort von ${owner} seit ${since}`,
        score: 400,
        alternative,
      })
      return
    }
  }

  commands.push({ type: 'DIPLOMACY', playerId: me, targetPlayerId: owner, action: 'requestRightOfWay' })
  requested.add(owner)
  memory.assignments[army.id] = `passage:${owner}:${tick}`
  explanations.push({
    action: `Beantragt Durchmarsch bei ${owner}`,
    reason: `Weg von ${army.provinceId} nach ${target} führt über ${block.provinceId} (${owner}), ${block.reason}`,
    score: 600,
    alternative: { action: `durch ${block.provinceId} marschieren (Überfall auf ${owner})`, score: 100 },
  })
}

/**
 * Veraltetes Angriffsziel -> foermliche Kriegserklaerung (Nacharbeit Turnier M17, Noahs Entscheid
 * zu Befund M17-T5, D29.8 Erweiterung vom 2026-09-25).
 *
 * `rateProvinces` waehlt nur herrenlose oder feindliche Provinzen (targeting.ts). Gehoert das Ziel
 * eines laufenden Marschs inzwischen einer Macht im Frieden, ist der Befehl veraltet: vor M17
 * stolperte die Armee hinein (Ueberfall, Befund M17-T1), seit T-M17-10 haelt E4 sie an. Jetzt
 * erklaert die KI dieser Macht foermlich den Krieg und haelt an, bis die Erklaerung wirkt.
 * Vorlauf vor der Armeeschleife, damit jeder Antrag desselben Zugs die Erklaerung sieht.
 */
export function staleTargetDeclarations(
  context: AiContext,
  explanations: Explanation[],
  pending: readonly Command[],
): Command[] {
  const { view } = context
  const me = view.playerId
  const commands: Command[] = []
  const declared = warDeclaredThisTurn(context, pending)

  // Ausgeschiedene Kriegsgegner zaehlen mit — dieselbe Zaehlung wie activeWars in
  // diplomacy.ts Abschnitt 2; nicht "verbessern".
  let fronts =
    Object.values(view.relations).filter(
      (relation) => relation.state === 'war' || relation.warEffectiveAtTick !== undefined,
    ).length + declared.size

  for (const army of view.armies) {
    if (army.owner !== me) continue
    const path = army.path ?? []
    if (path.length === 0) continue

    const target = path[path.length - 1]!
    const owner = ownerOf(context, target)
    if (owner === null || owner === me) continue

    const host = ownerOf(context, army.provinceId)
    const block = firstBlock(context, path, host !== me ? host : null)
    if (!block || block.owner !== owner) continue

    const relation = view.relations[owner]
    if (!relation || relation.state !== 'peace' || relation.warEffectiveAtTick !== undefined) continue
    if (declared.has(owner)) continue
    if (fronts >= context.difficulty.maxFronts) continue

    commands.push({ type: 'DIPLOMACY', playerId: me, targetPlayerId: owner, action: 'declareWar' })
    declared.add(owner)
    fronts += 1
    explanations.push({
      action: `Erklärt ${owner} den Krieg`,
      reason: `Angriffsziel ${target} gehört inzwischen ${owner} (Frieden, kein Durchmarschrecht) — förmlich statt Überfall`,
      score: 700,
      alternative: { action: `Angriff auf ${target} aufgeben`, score: 200 },
    })
  }

  return commands
}

/** Gast nach Kündigung (E11): Heimmarsch oder null. Schreibt Erklärung und assignment. */
export function guestWithdrawal(context: AiContext, army: VisibleArmy, explanations: Explanation[]): Command | null {
  const { view, memory, map } = context
  const me = view.playerId

  const host = ownerOf(context, army.provinceId)
  if (host === null || host === me) return null

  const relation = view.relations[host]
  if (!relation || relation.state === 'war') return null
  if (!relation.passageReceived || relation.passageEndsAtTick.received === null) return null

  const path = army.path ?? []
  if (path.length > 0 && ownerOf(context, path[path.length - 1]!) === me) return null

  const visited = new Set<ProvinceId>([army.provinceId])
  let frontier: ProvinceId[] = [army.provinceId]
  let target: ProvinceId | null = null

  while (frontier.length > 0 && target === null) {
    const next: ProvinceId[] = []
    for (const current of frontier) {
      for (const neighbour of neighborsOf(map, current, false)) {
        if (visited.has(neighbour)) continue
        const owner = ownerOf(context, neighbour)
        if (owner !== me && owner !== host && owner !== null) continue
        visited.add(neighbour)
        if (owner === me) {
          const weg = predictLandPath(context, army, neighbour)
          if (weg && firstBlock(context, weg, host) === null) {
            target = neighbour
            break
          }
        }
        next.push(neighbour)
      }
      if (target !== null) break
    }
    frontier = next
  }

  if (target === null) {
    explanations.push({
      action: `${army.id} findet keinen Heimweg aus ${army.provinceId}`,
      reason: `Durchmarschrecht bei ${host} endet in Tick ${relation.passageEndsAtTick.received}`,
      score: 500,
      alternative: { action: 'bleiben', score: 200 },
    })
    return null
  }

  memory.assignments[army.id] = `leave:${host}`
  explanations.push({
    action: `Zieht ${army.id} aus dem Land von ${host} ab`,
    reason: `Durchmarschrecht endet in Tick ${relation.passageEndsAtTick.received}`,
    score: 800,
    alternative: { action: 'bleiben (ab Fristende ein Überfall)', score: 0 },
  })
  return { type: 'MOVE_ARMY', playerId: me, armyId: army.id, targetProvinceId: target }
}

/** Strategietakt (E8, E10): Anträge an mich beantworten, eigene Gewährungen kündigen. */
export function passageCommands(context: AiContext, explanations: Explanation[], pending: readonly Command[]): Command[] {
  const { view, difficulty, rules } = context
  const me = view.playerId
  const grievances = view.self.grievances
  const commands: Command[] = []

  const granting = new Set<PlayerId>()
  for (const command of pending) {
    if (command.type === 'DIPLOMACY' && command.playerId === me && command.action === 'grantRightOfWay') {
      granting.add(command.targetPlayerId)
    }
  }

  const allies = new Set(
    Object.entries(view.relations)
      .filter(([, relation]) => relation.state === 'alliance')
      .map(([id]) => id),
  )

  // Antworten — view.incomingOffers mit kind === 'rightOfWay', nach from sortiert.
  const requests = view.incomingOffers
    .filter((offer) => offer.kind === 'rightOfWay')
    .slice()
    .sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0))

  for (const offer of requests) {
    const from = offer.from
    const relation = view.relations[from]
    if (!relation || relation.state === 'war') continue
    if (granting.has(from)) continue

    if (relation.warEffectiveAtTick !== undefined) {
      explanations.push({
        action: `Durchmarsch für ${from} nicht gewährt`,
        reason: 'Kriegserklärung läuft',
        score: 300,
        alternative: { action: 'Durchmarsch gewähren', score: 100 },
      })
      continue
    }

    const wert = relationship(view, from, grievances, rules)
    const inKriegMitVerbuendetem = view.publicWars.some(
      (war) => (war.a === from && allies.has(war.b)) || (war.b === from && allies.has(war.a)),
    )

    if (wert.value >= difficulty.trustThreshold && !inKriegMitVerbuendetem) {
      commands.push({ type: 'DIPLOMACY', playerId: me, targetPlayerId: from, action: 'acceptRightOfWay' })
      explanations.push({
        action: `Durchmarsch für ${from} gewährt (Antrag)`,
        reason: `${explainRelationship(wert)} erreicht die Vertrauensschwelle ${difficulty.trustThreshold}`,
        score: 500,
        alternative: { action: 'Antrag verfallen lassen', score: 200 },
      })
    } else {
      explanations.push({
        action: `Durchmarsch für ${from} nicht gewährt`,
        reason: inKriegMitVerbuendetem
          ? `${from} führt Krieg gegen meinen Verbündeten`
          : `${explainRelationship(wert)} unter der Vertrauensschwelle ${difficulty.trustThreshold}`,
        score: 300,
        alternative: { action: 'Durchmarsch gewähren', score: 100 },
      })
    }
  }

  // Kündigen — Object.keys(view.relations).sort(): nur unbefristete eigene Gewährungen im Frieden/Waffenstillstand.
  for (const other of Object.keys(view.relations).sort()) {
    const relation = view.relations[other]!
    if (!relation.passageGranted || relation.passageEndsAtTick.granted !== null) continue
    if (relation.state !== 'peace' && relation.state !== 'truce') continue

    const wert = relationship(view, other, grievances, rules)
    if (wert.value < difficulty.warThreshold) {
      commands.push({ type: 'DIPLOMACY', playerId: me, targetPlayerId: other, action: 'revokeRightOfWay' })
      explanations.push({
        action: `Kündigt den Durchmarsch für ${other}`,
        reason: `${explainRelationship(wert)} unter der Kriegsschwelle ${difficulty.warThreshold}`,
        score: 600,
        alternative: { action: 'weiter gewähren', score: 200 },
      })
    }
  }

  return commands
}
