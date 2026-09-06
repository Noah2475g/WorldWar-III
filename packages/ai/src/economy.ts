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

/**
 * Dasselbe, aber mit der Provinz statt ihrer Kennung (R-AI-04, T-M15-08).
 *
 * Der Unterschied ist kein Stil: `nextBuilding` beginnt mit einem `find` ueber alle
 * Provinzen der Sicht, und seit `missingForNextBuilding` ihn **je eigener Provinz und
 * Tick** ruft, ist das quadratisch. Der KI-Anteil an der Tickzeit stieg dadurch von 44 %
 * auf 52 % und riss R-AI-04.
 */
function nextBuildingFor(
  context: AiContext,
  province: AiContext['view']['provinces'][number],
): BuildingKey | null {
  if (province.owner !== context.view.playerId) return null

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

  /**
   * **Städte zuerst** (T-M15-08), und das ist keine Kosmetik.
   *
   * Gemessen über 60 Spieltage: die KI baute neun Kasernen und **keine einzige Fabrik**,
   * obwohl sie sich eine hätte leisten können. Die Ursache war die Reihenfolge: die
   * Auswahl läuft je Provinz, und jede Landprovinz ohne Kaserne liefert „Kaserne" —
   * neun davon verbrauchen das Holz, bevor die Stadt an der Reihe ist. Eine Fabrik kann
   * nur in einer Stadt stehen, eine Kaserne überall; wer die Landprovinzen zuerst
   * bedient, baut die Stadtgebäude nie.
   *
   * Über `playerOrder`-stabiles Sortieren, nicht über `sort` mit Zufall: dieselbe Lage
   * muss dieselbe Reihenfolge ergeben (R-ARCH-01). `filter` ist stabil, also bleibt die
   * Reihenfolge innerhalb beider Gruppen die der Sicht.
   */
  const eigene = context.view.provinces.filter((province) => province.owner === context.view.playerId)
  const own = [
    ...eigene.filter((province) => province.kind === 'city'),
    ...eigene.filter((province) => province.kind !== 'city'),
  ]

  for (const province of own) {
    if ((province.buildQueueLength ?? 0) > 0) continue

    const building = nextBuildingFor(context, province)
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
export function rankedUnitsFor(context: AiContext, province: { buildings?: Record<string, number> }): string[] {
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
  if (buildable.length === 0) return []

  // Groesster Rueckstand zuerst; bei Gleichstand entscheidet die Reihenfolge oben,
  // damit dieselbe Lage denselben Befehl ergibt (R-ARCH-01).
  return buildable
    .map((entry, index) => ({
      entry,
      index,
      gap: entry.share - (total > 0 ? (owned.get(entry.unitKey) ?? 0) / total : 0),
    }))
    .sort((a, b) => b.gap - a.gap || a.index - b.index)
    .map(({ entry }) => entry.unitKey)
}

/**
 * Die dringlichste Einheit, die in dieser Provinz gebaut werden kann.
 *
 * Behaelt die alte Bedeutung fuer Aufrufer, die nur eine Antwort wollen. Wer die
 * **Bezahlbarkeit** mitentscheiden lassen muss, nimmt `rankedUnitsFor` (T-M15-08).
 */
export function nextUnitFor(context: AiContext, province: { buildings?: Record<string, number> }): string | null {
  return rankedUnitsFor(context, province)[0] ?? null
}

/** Raises troops where possible, sized to what the treasury can carry. */
export function recruitCommands(context: AiContext, explanations: Explanation[]): Command[] {
  const commands: Command[] = []
  const playerId = context.view.playerId

  /**
   * **Die vielseitigste Provinz zuerst** (T-M15-08).
   *
   * Der Rumpf unten bricht nach der **ersten** Provinz ab, die etwas ausheben kann — eine
   * Ordensregel, damit nicht in jedem Tick das ganze Reich rekrutiert. Zusammen mit der
   * Reihenfolge der Sicht hiess das: gefragt wurde immer dieselbe Provinz, und wenn die
   * nur eine Kaserne hatte, hob die KI **nur Infanterie** aus. Gemessen auf der Weltkarte
   * ueber 200 Spieltage: 43 Fabriken gebaut, **null Artillerie** — und ohne Artillerie ist
   * `armyRange` jeder KI-Armee 0 und die Feuerautomatik aus T-M15-07 wirkungslos.
   *
   * Gefragt wird deshalb die Provinz zuerst, die am meisten bauen kann. Stabil sortiert:
   * bei gleicher Zahl bleibt die Reihenfolge der Sicht, damit dieselbe Lage denselben
   * Befehl ergibt (R-ARCH-01).
   */
  const eigene = context.view.provinces.filter((province) => province.owner === playerId)
  const arten = (province: (typeof eigene)[number]): number =>
    Object.values(province.buildings ?? {}).filter((level) => (level ?? 0) > 0).length
  const nachVielseitigkeit = eigene
    .map((province, index) => ({ province, index }))
    .sort((a, b) => arten(b.province) - arten(a.province) || a.index - b.index)
    .map((entry) => entry.province)

  for (const province of nachVielseitigkeit) {
    // **Kein Kasernen-Riegel** (T-M15-08). Hier stand `if (barracks === 0) continue`, und
    // das ist der Grund, warum die KI auf der Weltkarte in 200 Spieltagen **43 Fabriken
    // baute und null Artillerie aushob**: eine Provinz mit Fabrik, aber ohne Kaserne wurde
    // uebersprungen, bevor `nextUnitFor` sie ueberhaupt zu sehen bekam. Und `nextUnitFor`
    // prueft die noetige Bauart ohnehin selbst — der Riegel war eine zweite, groebere
    // Fassung derselben Frage, und die groebere gewann.
    //
    // Ohne Artillerie ist `armyRange` jeder KI-Armee 0, und die Feuerautomatik aus
    // T-M15-07 waere gebaut, gruen getestet und wirkungslos gewesen.
    if (Object.values(province.buildings ?? {}).every((level) => (level ?? 0) === 0)) continue

    /**
     * **Die dringlichste Einheit, die auch bezahlbar ist** (T-M15-08).
     *
     * Vorher wurde genau eine gewaehlt — die mit dem groessten Rueckstand — und wenn die
     * unbezahlbar war, ging die Provinz leer aus. Gemessen auf der Weltkarte ueber 200
     * Spieltage: **3322 Infanteristen, 15 Panzer, 0 Artillerie.** Der Panzer hat bei einem
     * Zielverhaeltnis von 30 % immer den groesseren Rueckstand als die Artillerie mit
     * 20 %, ist aber wegen des Oels selten zu bezahlen — also gewann er die Wahl und
     * scheiterte danach am Geld, und die Artillerie kam **nie** an die Reihe. Damit war
     * `armyRange` jeder KI-Armee 0 und die Feuerautomatik aus T-M15-07 wirkungslos.
     */
    let unitKey: string | null = null
    let unit: (typeof context.rules.units)[string] | undefined
    let affordable = 0

    for (const kandidat of rankedUnitsFor(context, province)) {
      const regel = context.rules.units[kandidat]
      if (!regel) continue

      // Batch size: what the difficulty's share of the treasury pays for, capped so a
      // single order never becomes the whole army.
      let moeglich = 15
      for (const [key, amount] of Object.entries(regel.cost)) {
        if (!amount) continue
        const stock = context.view.self.resources[key as ResourceKey]
        const budget = Math.trunc((stock * context.difficulty.recruitShare) / 1000)
        moeglich = Math.min(moeglich, Math.trunc(budget / amount))
      }
      if (moeglich < 1) continue

      unitKey = kandidat
      unit = regel
      affordable = moeglich
      break
    }

    if (!unitKey || !unit) continue

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

/**
 * Was der KI zum nächsten Bauvorhaben fehlt — **bevor** ein Mangel eintritt (T-M15-08).
 *
 * Der Befund, den diese Funktion behebt, ist der teuerste des Meilensteins: die KI baute
 * auf der Testkarte über 150 Spieltage **keine einzige Fabrik**, weil ihr das Holz fehlte
 * (gemessen 83.081 gegen 667.000 Kosten) — und ohne Fabrik keine Artillerie, ohne
 * Artillerie kein selbsttätiger Beschuss, also R-BAT-08/AK3 tot (PROBLEME.md, T-M15-07).
 *
 * Gehandelt wurde bis dahin **erst bei eingetretenem Mangel** (`shortages.length === 0` →
 * Rückgabe). Ein Mangel heißt aber, dass ein Vorrat schon aufgebraucht ist; wer erst dann
 * tauscht, tauscht immer zu spät und nie für etwas, das er *vorhat*. Ein Mensch verkauft
 * Überschuss, um sich die Fabrik leisten zu können — genau das fehlte.
 */
function missingForNextBuilding(context: AiContext): ResourceKey | null {
  const own = context.view.provinces.filter((province) => province.owner === context.view.playerId)

  for (const province of own) {
    if ((province.buildQueueLength ?? 0) > 0) continue
    const building = nextBuildingFor(context, province)
    if (!building) continue

    const rule = context.rules.buildings[building]
    for (const [key, amount] of Object.entries(rule.cost)) {
      if (!amount) continue
      const resource = key as ResourceKey
      const stock = context.view.self.resources[resource]
      const reserve = Math.trunc((stock * RESERVE_PERMILLE) / 1000)
      if (stock - reserve < amount) return resource
    }
  }
  return null
}

/** Trades away a surplus to cover a shortage — the AI uses the same market as everyone. */
export function tradeCommands(context: AiContext, explanations: Explanation[]): Command[] {
  const shortages = context.view.self.shortages

  // Zwei Anlässe, und der zweite ist neu: ein eingetretener Mangel, **oder** ein
  // Bauvorhaben, das sonst nie zustande kommt.
  const need = shortages[0] ?? missingForNextBuilding(context)
  if (!need) return []

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
    reason: shortages.length > 0 ? `Mangel an ${need} decken` : `${need} fuer das naechste Bauvorhaben`,
    score: 700,
  })
  return [{ type: 'TRADE', playerId: context.view.playerId, give: best, giveAmount: give, want: need }]
}
