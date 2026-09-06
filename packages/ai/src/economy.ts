import type { BuildingKey, Command, ResourceKey } from '@worldwar/core'
import type { AiContext, Explanation } from './types'

/**
 * Economic decisions (T-M7-02).
 *
 * Priorities, in order: fix a shortage, then build what is missing to raise troops,
 * then improve what pays. The AI never spends its last reserves — a bankrupt nation
 * cannot even keep its army fed, which is a worse position than an unbuilt factory.
 */

/** Keep this share of a resource untouched, as a buffer against upkeep. */
export const RESERVE_PERMILLE = 200

function canAfford(context: AiContext, cost: Partial<Record<ResourceKey, number>>): boolean {
  for (const [key, amount] of Object.entries(cost)) {
    if (!amount) continue
    const stock = context.view.self.resources[key as ResourceKey]
    const reserve = Math.trunc((stock * RESERVE_PERMILLE) / 1000)
    if (stock - reserve < amount) return false
  }
  return true
}

/** What a province is missing most, in the order the AI cares about. */
/**
 * Der laufende Spieltag aus der Sicht — nicht aus einer zweiten Zeitrechnung.
 *
 * `view.tick` und `rules.constants.ticksPerDay` sind beide da; eine eigene Zaehlung hier
 * waere die zweite Wahrheit ueber dieselbe Frage, und die geht erfahrungsgemaess
 * auseinander (T-M15-03).
 */
function dayOf(context: AiContext): number {
  return Math.trunc(context.view.tick / context.rules.constants.ticksPerDay) + 1
}

function nextBuilding(context: AiContext, provinceId: string): BuildingKey | null {
  const province = context.view.provinces.find((entry) => entry.id === provinceId)
  if (!province || province.owner !== context.view.playerId) return null

  const level = (key: BuildingKey) => province.buildings?.[key] ?? 0

  // R-TECH-02/AK2: Was es heute noch nicht gibt, waehlt sie nicht. Ein Befehl, den der
  // Kern jeden Tag ablehnt, ist Rauschen im Protokoll statt Verhalten — und die KI
  // fasste ihn in jedem Tick neu. Dasselbe Muster hat 3046 von 4464 Marschbefehlen als
  // NO_PATH enden lassen (T-M14-11).
  const day = dayOf(context)
  const available = (key: BuildingKey) => context.rules.buildings[key].availableFromDay <= day

  // A nation that cannot raise infantry has no other problem worth solving.
  if (available('barracks') && level('barracks') === 0) return 'barracks'
  // Die Fabrik, sobald es sie gibt — und **nicht** erst, wenn kein Mangel mehr besteht.
  //
  // Die alte Bedingung `shortages.size === 0` war als "unter Druck befestigen statt
  // ausbauen" gedacht und wurde zur Dauersperre: eine KI, der irgendein Rohstoff knapp
  // ist, hat *immer* einen Mangel, und so entstand in einer Turnierpartie ueber 150
  // Spieltage **keine einzige Fabrik** — also nie Artillerie, also nie ein
  // Beschussereignis, und R-BAT-08/AK3 war unerreichbar (T-M15-07).
  //
  // Ob die Fabrik bezahlbar ist, entscheidet ohnehin `canAfford` weiter unten, und das
  // haelt eine Ruecklage frei. Zwei Sperren fuer dieselbe Frage, von denen eine nie
  // aufgeht, sind eine zu viel.
  if (available('factory') && level('factory') === 0 && province.kind === 'city') {
    return 'factory'
  }
  if (available('railway') && level('railway') === 0) return 'railway'
  if (available('fortress') && level('fortress') < 2) return 'fortress'
  if (available('harbour') && province.coastal && level('harbour') === 0) return 'harbour'
  return null
}

export function economyCommands(context: AiContext, explanations: Explanation[]): Command[] {
  const commands: Command[] = []
  const own = context.view.provinces.filter((province) => province.owner === context.view.playerId)

  for (const province of own) {
    if ((province.buildQueueLength ?? 0) > 0) continue

    const building = nextBuilding(context, province.id)
    if (!building) continue

    const rule = context.rules.buildings[building]
    if (!canAfford(context, rule.cost)) {
      explanations.push({
        action: `Bau ${building} in ${province.id} aufgeschoben`,
        reason: 'Vorräte reichen nicht über die Rücklage hinaus',
        score: 0,
      })
      continue
    }

    commands.push({ type: 'BUILD', playerId: context.view.playerId, provinceId: province.id, building })
    explanations.push({
      action: `Baut ${building} in ${province.id}`,
      reason:
        building === 'barracks'
          ? 'ohne Rekrutierungsbüro keine Truppen'
          : building === 'fortress'
            ? 'Grenzprovinz sichern'
            : 'Wirtschaft ausbauen',
      score: 600,
    })

    // One build order per tick keeps the treasury from being emptied in one go.
    break
  }

  return commands
}

/**
 * Das Zielverhaeltnis der Truppengattungen (T-M14-12, Befund 32).
 *
 * Bis zum 2026-09-06 waehlte die KI 'tank' oder 'infantry' — zwei von zehn Arten.
 * Artillerie, Luftwaffe und Marine waren damit reiner Spielervorteil, ein Bruch von
 * R-AI-01 in die andere Richtung. Fuer die Artillerie kommt hinzu, dass sie Vorbedingung
 * fuer R-BAT-08 ist: eine Feuerautomatik ohne Fernwaffen waere gebaut, gruen getestet und
 * wirkungslos, weil `armyRange` fuer jede KI-Armee null bliebe.
 *
 * Die Anteile sind bewusst grob — es geht nicht um die beste Mischung, sondern darum,
 * dass die KI ueberhaupt eine hat. Luft und Marine bleiben aussen vor, solange sie mit
 * ihnen nichts anzufangen weiss (M17, amphibische KI).
 */
const TARGET_MIX: readonly { unitKey: string; share: number }[] = [
  { unitKey: 'infantry', share: 0.5 },
  { unitKey: 'tank', share: 0.3 },
  { unitKey: 'artillery', share: 0.2 },
]

/**
 * Welche Einheit als naechstes fehlt — gemessen am eigenen Bestand, nicht am Zufall.
 *
 * Gebaut wird, was in dieser Provinz gebaut werden kann und wovon die Macht gemessen am
 * Zielverhaeltnis am weitesten entfernt ist.
 */
export function nextUnitFor(context: AiContext, province: { buildings?: Record<string, number> }): string | null {
  const owned = new Map<string, number>()
  let total = 0
  for (const army of context.view.armies) {
    if (army.owner !== context.view.playerId) continue
    for (const stack of army.units ?? []) {
      owned.set(stack.unitKey, (owned.get(stack.unitKey) ?? 0) + 1)
      total += 1
    }
  }

  const day = dayOf(context)
  const buildable = TARGET_MIX.filter(({ unitKey }) => {
    const rule = context.rules.units[unitKey]
    if (!rule) return false
    // R-TECH-02/AK2: erst der Tag, dann das Gebaeude — beides muss stimmen.
    if (rule.availableFromDay > day) return false
    const needed = rule.requiresBuilding
    return !needed || (province.buildings?.[needed] ?? 0) > 0
  })
  if (buildable.length === 0) return null

  // Groesster Rueckstand zuerst; bei Gleichstand entscheidet die Reihenfolge oben,
  // damit dieselbe Lage denselben Befehl ergibt (R-ARCH-01).
  let best = buildable[0]!
  let bestGap = -Infinity
  for (const entry of buildable) {
    const have = total > 0 ? (owned.get(entry.unitKey) ?? 0) / total : 0
    const gap = entry.share - have
    if (gap > bestGap) {
      bestGap = gap
      best = entry
    }
  }
  return best.unitKey
}

/** Raises troops where possible, sized to what the treasury can carry. */
export function recruitCommands(context: AiContext, explanations: Explanation[]): Command[] {
  const commands: Command[] = []
  const playerId = context.view.playerId

  for (const province of context.view.provinces) {
    if (province.owner !== playerId) continue
    if ((province.buildings?.barracks ?? 0) === 0) continue

    const unitKey = nextUnitFor(context, province)
    if (!unitKey) continue
    const unit = context.rules.units[unitKey]
    if (!unit) continue

    // Batch size: what the difficulty's share of the treasury pays for, capped so a
    // single order never becomes the whole army.
    let affordable = 15
    for (const [key, amount] of Object.entries(unit.cost)) {
      if (!amount) continue
      const stock = context.view.self.resources[key as ResourceKey]
      const budget = Math.trunc((stock * context.difficulty.recruitShare) / 1000)
      affordable = Math.min(affordable, Math.trunc(budget / amount))
    }
    if (affordable < 1) continue

    commands.push({ type: 'RECRUIT', playerId, provinceId: province.id, unitKey, count: affordable })
    explanations.push({
      action: `Rekrutiert ${affordable}x ${unitKey} in ${province.id}`,
      reason: 'Streitkräfte aufbauen',
      score: 500,
      alternative: { action: 'nichts rekrutieren', score: 200 },
    })
    break
  }

  return commands
}

/** Trades away a surplus to cover a shortage — the AI uses the same market as everyone. */
export function tradeCommands(context: AiContext, explanations: Explanation[]): Command[] {
  const shortages = context.view.self.shortages
  if (shortages.length === 0) return []

  const need = shortages[0]!
  const resources = context.view.self.resources

  // Sell the largest stock that is not itself short.
  let best: ResourceKey | null = null
  let bestAmount = 0
  for (const [key, amount] of Object.entries(resources)) {
    const resource = key as ResourceKey
    if (resource === need || shortages.includes(resource)) continue
    if (amount > bestAmount) {
      best = resource
      bestAmount = amount
    }
  }
  const give = Math.trunc(bestAmount / 10)
  if (!best || give < 1000) return []

  explanations.push({
    action: `Tauscht ${give} ${best} gegen ${need}`,
    reason: `Mangel an ${need} decken`,
    score: 700,
  })
  return [{ type: 'TRADE', playerId: context.view.playerId, give: best, giveAmount: give, want: need }]
}
