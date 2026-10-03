import { RECRUIT_MIN_MORALE, buildingCostForLevel, unitCount } from '@worldwar/core'
import type { BuildingKey, Command, ProvinceId, ResourceKey } from '@worldwar/core'
import type { Fixed } from '@worldwar/shared'
import { dailyArmyUpkeep, dailyMoneyLedger, dailyOilYield, unitsWithinDailyBalance, unitsWithinStockHorizon } from './finance'
import { ledgerAfter } from './provinceValue'
import { threatMap } from './threat'
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

/**
 * Der Vorrats-Horizont des Oel-Waechters in Spieltagen (T-M42-14, Review Punkt 9, R-AI-12/AK4 in der Fassung
 * vom 2026-10-03). Eine Einheit mit Oelunterhalt wird nur ausgehoben, wenn der Oelvorrat nach dem Zug bei der
 * Oel-Tagesbilanz danach noch mindestens so viele Tage reicht. Eine KI-Konstante, keine Spielregel: sie steht
 * bewusst nicht in `data/rules` (Mensch und KI spielen nach denselben Regeln; nur die KI rechnet so vorsichtig).
 */
export const OIL_HORIZON_DAYS = 30

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
function buildingCandidatesFor(
  context: AiContext,
  province: AiContext['view']['provinces'][number],
): BuildingKey[] {
  if (province.owner !== context.view.playerId) return []

  const level = (key: BuildingKey) => province.buildings?.[key] ?? 0

  // R-TECH-02/AK2: Was es heute noch nicht gibt, waehlt sie nicht. Ein Befehl, den der
  // Kern jeden Tag ablehnt, ist Rauschen im Protokoll statt Verhalten — und die KI
  // fasste ihn in jedem Tick neu. Dasselbe Muster hat 3046 von 4464 Marschbefehlen als
  // NO_PATH enden lassen (T-M14-11).
  const day = dayOf(context)
  const available = (key: BuildingKey) => context.rules.buildings[key].availableFromDay <= day

  // A nation that cannot raise infantry has no other problem worth solving.
  if (available('barracks') && level('barracks') === 0) return ['barracks']
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
  //
  // **Und bis zu ihrer hoechsten Stufe** (T-M41-01). Bis zum 2026-09-13 stand hier
  // `level === 0`: keine Macht kam je ueber Fabrikstufe 1, und die Gebaeudeachse aus
  // T-M34-04 war eine fuer den Menschen allein. Nur die Fabrik wird ausgebaut — Kaserne,
  // Eisenbahn und Hafen bleiben bei genau einmal: gemessen reisst die Kaserne Stufe 2
  // R-AI-06 im Turnier (schwer gegen normal im Frieden 1,00 statt 0,70), die Eisenbahn
  // aendert nichts (DECISIONS.md, 2026-09-13; Haltetest in economy.test.ts).
  //
  // **Ein Ausbau sperrt die Stadt nicht** (Nacharbeit zu T-M41-01, H1 der Durchsicht). Die
  // erste Fabrik bleibt der einzige Wunsch einer Stadt ohne Fabrik, wie bisher. Steht sie aber,
  // ist ihr Ausbau nur der **erste** Wunsch: Eisenbahn, Festung und Hafen stehen dahinter, und
  // `economyCommands` nimmt den ersten, der bezahlbar ist. Vorher lieferte diese Funktion fuer
  // jede solche Stadt nur "factory"; war die Stufe zu teuer (Stufe 3 das 3,24-fache), kam in
  // der Stadt nichts anderes an die Reihe — in der Vollpartie mit Startzahl 1815 hielt Russland
  // am Ende 48 Staedte, 36 davon mit Fabrik und ohne Eisenbahn.
  const candidates: BuildingKey[] = []
  if (available('factory') && province.kind === 'city' && level('factory') < context.rules.buildings.factory.maxLevel) {
    if (level('factory') === 0) return ['factory']
    candidates.push('factory')
  }
  if (available('railway') && level('railway') === 0) candidates.push('railway')
  // LOESCHVERMERK (Review): bis T-M42-13 stand die Festung fuer **jede** Provinz bis Stufe 2 in der
  // Liste, gleich hinter der Eisenbahn - in langen Partien standen dadurch alle Staedte auf Festung 2
  // (Festungspatt, Befund M42-04-a). Alte Zeilen:
  // if (available('fortress') && level('fortress') < 2) candidates.push('fortress')
  // if (available('harbour') && province.coastal && level('harbour') === 0) candidates.push('harbour')
  //
  // **Festung nur an der Front, sonst zuletzt** (T-M42-13, Review Punkt 10): in einer Grenzprovinz
  // (ein Landnachbar in fremdem Besitz) oder einer bedrohten Provinz (`threatMap` > 0) wie bisher hinter
  // der Eisenbahn; im Hinterland erst, wenn kein Wirtschaftsbau (Fabrik, Eisenbahn, Hafen) mehr fehlt.
  const festungErlaubt = available('fortress') && level('fortress') < 2
  const front = frontProvinces(context).has(province.id)
  if (festungErlaubt && front) candidates.push('fortress')
  if (available('harbour') && province.coastal && level('harbour') === 0) candidates.push('harbour')
  if (festungErlaubt && !front && candidates.length === 0) candidates.push('fortress')
  return candidates
}

/** Je Sicht einmal gerechnet: `economyCommands` und `nextBuildingShortfall` fragen dieselbe Lage. */
const frontCache = new WeakMap<object, ReadonlySet<ProvinceId>>()

/**
 * Die eigenen Provinzen an der Front (T-M42-13, Review Punkt 10): ein Landnachbar gehoert einer anderen
 * Macht, oder eine Armee einer Macht im Krieg steht in Reichweite (`threatMap`, `ai.threatRange`).
 * Herrenloses Land zaehlt nicht als fremder Besitz. Nur aus der Sicht - die KI sieht, was ein Mensch sieht.
 */
export function frontProvinces(context: AiContext): ReadonlySet<ProvinceId> {
  const cached = frontCache.get(context.view)
  if (cached) return cached
  const me = context.view.playerId
  const owners = new Map(context.view.provinces.map((province) => [province.id, province.owner]))
  const threat = threatMap(context.view, context.rules.ai.threatRange)
  const front = new Set<ProvinceId>()
  for (const province of context.view.provinces) {
    if (province.owner !== me) continue
    const grenze = province.neighbors.some((id) => {
      const owner = owners.get(id)
      return owner !== undefined && owner !== null && owner !== me
    })
    if (grenze || (threat.byProvince[province.id] ?? 0) > 0) front.add(province.id)
  }
  frontCache.set(context.view, front)
  return front
}

/**
 * Der erste Wunsch einer Provinz — worauf der Handel hinarbeitet (T-M15-08).
 *
 * Bewusst der erste und nicht der erste bezahlbare: gehandelt wird fuer das, was fehlt.
 * Die Nacharbeit zu H1 aendert nur, was gebaut wird, nicht, wofuer getauscht wird.
 */
function nextBuildingFor(
  context: AiContext,
  province: AiContext['view']['provinces'][number],
): BuildingKey | null {
  return buildingCandidatesFor(context, province)[0] ?? null
}

/**
 * **Erst die Fabrik** (T-M42-06, R-AI-12/AK1, D32.7).
 *
 * Solange die Macht eine sichtbare eigene Stadt, aber noch keine Fabrik hat und keine im Bau ist, haelt
 * sie die Kosten der ersten Fabrik samt Ruecklage zurueck. Gemessen vor M42: "normal" und "schwer"
 * begannen auf der Weltkarte in 200 Spieltagen keine einzige Fabrik (0 von 200 Tagen mit bezahlbarer
 * Fabrik) - jede Aushebung nahm das Geld vorher, und ohne Fabrik gibt es keine Artillerie.
 *
 * Nur bis zur **ersten** Fabrik: die Sonde "jede Stadt" kostete Artillerie (m18-plan-v2 §3.2).
 *
 * **"Im Bau"** liest die KI aus einem Ersatzmerkmal, weil ihre Sicht nur `buildQueueLength` traegt,
 * nicht die Schlange selbst (`runner.ts` baut `publicView` ohne Regeln, D18.2): eine eigene Stadt ohne
 * Fabrik mit `buildQueueLength > 0` **und schon einer Kaserne** - `economyCommands` baut dort nur noch
 * die Fabrik. Bekannte Unschaerfe: ein Kasernenausbau (nur ein Mensch befiehlt ihn) oder ein vor Tag 28
 * begonnener Bau in der Schlange liest sich ebenso (Haltetest V8).
 *
 * Wert je Rohstoff: aufgerundet `kosten * 1000 / (1000 - RESERVE_PERMILLE)` - der Bestand, bei dem
 * `canAfford` die Fabrik traegt.
 */
export function factoryReserve(context: AiContext): Partial<Record<ResourceKey, Fixed>> | null {
  const rule = context.rules.buildings.factory
  if (rule.availableFromDay > dayOf(context)) return null
  const me = context.view.playerId
  const eigene = context.view.provinces.filter((province) => province.owner === me && !province.stale)
  const staedte = eigene.filter((province) => province.kind === 'city')
  if (staedte.length === 0) return null
  if (eigene.some((province) => (province.buildings?.factory ?? 0) > 0)) return null
  if (staedte.some((province) => (province.buildQueueLength ?? 0) > 0 && (province.buildings?.barracks ?? 0) > 0)) {
    return null
  }

  const teiler = 1000 - RESERVE_PERMILLE
  const vorbehalt: Partial<Record<ResourceKey, Fixed>> = {}
  for (const [key, amount] of Object.entries(buildingCostForLevel(rule, 1, context.rules.constants))) {
    if (!amount) continue
    vorbehalt[key as ResourceKey] = Math.trunc((amount * 1000 + teiler - 1) / teiler)
  }
  return vorbehalt
}

export function economyCommands(context: AiContext, explanations: Explanation[]): Command[] {
  const commands: Command[] = []

  // R-AI-12/AK1, D32.7: solange der Vorbehalt steht, nur Kaserne und Fabrik.
  const vorbehalt = factoryReserve(context)
  if (vorbehalt) {
    explanations.push({
      action: 'Vorbehalt für die erste Fabrik',
      reason: 'erst die Fabrik: andere Bauten außer der Kaserne warten, ausgehoben wird nur darüber',
      score: 0,
    })
  }

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
  //
  // **Nur, was sie sieht** (T-M41-09). Eine Provinz ausser Sicht fuehrt die Sicht mit dem
  // Besitzer, den die Macht zuletzt gesehen hat (`stale`) — auch dann noch als eigene, wenn ein
  // Gegner sie laengst haelt. Die Erinnerung zeigt keine Gebaeude, also wollte die KI dort eine
  // Kaserne: 213 abgelehnte Bauauftraege in 200 Spieltagen, eine Provinz 94-mal, und wegen des
  // einen Baus je Denkschritt verdraengte jeder davon den echten Bau des Tages.
  const eigene = context.view.provinces.filter(
    (province) => province.owner === context.view.playerId && !province.stale,
  )
  const own = [
    ...eigene.filter((province) => province.kind === 'city'),
    ...eigene.filter((province) => province.kind !== 'city'),
  ]

  for (const province of own) {
    if ((province.buildQueueLength ?? 0) > 0) continue

    // Der erste Wunsch dieser Provinz, den die Vorräte tragen (Nacharbeit zu T-M41-01, H1).
    // Allein bleiben nur die fehlende Kaserne und die erste Fabrik einer Stadt. **Jede andere
    // Provinz** hat eine Ausweichliste — auch eine Landprovinz mit Kaserne und eine Stadt mit
    // Fabrik 3: Eisenbahn, Festung, Hafen. Vorher ging eine solche Provinz leer aus, wenn die
    // Eisenbahn zu teuer war, und die Suche lief zur nächsten Provinz; jetzt baut sie selbst die
    // Festung (berichtigt nach der Durchsicht von Block N2, M2 — hier stand, nur eine Stadt mit
    // Fabrik habe mehr als einen Wunsch; Haltetest in `economy.test.ts`).
    let building: BuildingKey | null = null
    for (const candidate of buildingCandidatesFor(context, province)) {
      if (vorbehalt && candidate !== 'barracks' && candidate !== 'factory') continue
      const rule = context.rules.buildings[candidate]
      // Der Preis der Stufe, die sie bauen will (T-M34-04). Mit dem Grundpreis zu rechnen
      // hiesse, jeden Ausbau zu befehlen und vom Kern mit INSUFFICIENT_RESOURCES abgelehnt
      // zu bekommen — genau das Rauschen im Protokoll, das R-TECH-02/AK2 verbietet und das
      // dieses Projekt mit 57 % abgelehnter Befehle schon einmal bezahlt hat (T-M14-11).
      const kosten = buildingCostForLevel(rule, (province.buildings?.[candidate] ?? 0) + 1, context.rules.constants)
      if (canAfford(context, kosten)) {
        building = candidate
        break
      }
      explanations.push({
        action: `Bau ${candidate} in ${province.id} aufgeschoben`,
        reason: 'Vorräte reichen nicht über die Rücklage hinaus',
        score: 0,
      })
    }
    if (!building) continue

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
 * ihnen nichts anzufangen weiss (amphibische KI: M18, umgehaengt am 2026-09-13 mit
 * T-M17-01).
 *
 * **Seit T-M42-07 60/30/10** (Noahs Antwort auf Frage 1, D32.8; vorher 50/30/20). Der Panzer ist
 * fuer die KI meist unbezahlbar (Oel), und sein Anteil wird bewusst **nicht** umverteilt: ohne
 * Panzer liegt das Gleichgewicht bei (1 - 0,6 + 0,1) / 2 = 25 % Artillerie (Haltetest X2), gemessen
 * im Zielband 15-30 % (R-AI-12/AK3).
 */
// LOESCHVERMERK (Review): T-M42-07 (D32.8) ersetzt die Mischung 50/30/20. Alte Fassung:
// const TARGET_MIX: readonly { unitKey: string; share: number }[] = [
//   { unitKey: 'infantry', share: 0.5 },
//   { unitKey: 'tank', share: 0.3 },
//   { unitKey: 'artillery', share: 0.2 },
// ]
export const TARGET_MIX: readonly { unitKey: string; share: number }[] = [
  { unitKey: 'infantry', share: 0.6 },
  { unitKey: 'tank', share: 0.3 },
  { unitKey: 'artillery', share: 0.1 },
]

/**
 * Welche Einheit als naechstes fehlt — gemessen am eigenen Bestand, nicht am Zufall.
 *
 * Gebaut wird, was in dieser Provinz gebaut werden kann und wovon die Macht gemessen am
 * Zielverhaeltnis am weitesten entfernt ist.
 */
/** Der eigene Bestand je Einheitenart, in Einheiten (T-M42-05, D32.6). */
export interface UnitStock {
  owned: ReadonlyMap<string, number>
  total: number
}

/**
 * Der eigene Bestand in **Einheiten**, nicht in Stapeln (T-M42-05, R-AI-10/AK1, D32.6).
 *
 * Bis zum 2026-10-02 zaehlte `rankedUnitsFor` je Stapel eine 1: drei Infanteriearmeen zu je fuenf
 * und eine Batterie zu eins waren "75 % Infanterie", dieselben Truppen nach dem Zusammenlegen
 * "50 %" - das Zusammenlegen aenderte, was die KI als Naechstes aushebt (T-M41-10 riss daran).
 * Gezaehlt wird wie im Kern (`unitCount`, aufgerundet), damit eine angeschlagene Einheit eine
 * Einheit bleibt.
 */
// LOESCHVERMERK (Review): T-M42-05 (D32.6) ersetzt die Stapelzaehlung in `rankedUnitsFor`. Alte Fassung:
// export function rankedUnitsFor(context: AiContext, province: { buildings?: Record<string, number> }): string[] {
//   const owned = new Map<string, number>()
//   let total = 0
//   for (const army of context.view.armies) {
//     if (army.owner !== context.view.playerId) continue
//     for (const stack of army.units ?? []) {
//       owned.set(stack.unitKey, (owned.get(stack.unitKey) ?? 0) + 1)
//       total += 1
//     }
//   }
export function unitStockOf(context: AiContext): UnitStock {
  const owned = new Map<string, number>()
  let total = 0
  for (const army of context.view.armies) {
    if (army.owner !== context.view.playerId) continue
    for (const stack of army.units ?? []) {
      const count = unitCount(stack, context.rules)
      owned.set(stack.unitKey, (owned.get(stack.unitKey) ?? 0) + count)
      total += count
    }
  }
  return { owned, total }
}

export function rankedUnitsFor(
  context: AiContext,
  province: { buildings?: Record<string, number> },
  stock: UnitStock = unitStockOf(context),
  /**
   * T-M42-07, zweite Iteration (Befund M42-07-a): ein Panzer, den die Macht nicht tragen kann, gibt
   * seinen Anteil an die Artillerie ab. Ohne das liegt das Gleichgewicht einer Macht ohne Panzer bei
   * (1 - 0,6 + 0,1) / 2 = 25 % Artillerie - und weil fuenf von acht Maechten kein Oel foerdern (der
   * Oel-Waechter R-AI-12/AK4 laesst ihnen keine Artillerie), blieb der Anteil ueber alle Maechte bei
   * rund 9 %. Mit dem Panzeranteil bei der Artillerie liegt es bei (1 - 0,6 + 0,4) / 2 = 40 %.
   */
  panzerAnteilZurArtillerie = false,
): string[] {
  const { owned, total } = stock
  const panzerAnteil = TARGET_MIX.find(({ unitKey }) => unitKey === 'tank')?.share ?? 0
  const mix = panzerAnteilZurArtillerie
    ? TARGET_MIX.filter((entry) => entry.unitKey !== 'tank').map((entry) =>
        entry.unitKey === 'artillery' ? { ...entry, share: entry.share + panzerAnteil } : entry,
      )
    : TARGET_MIX

  const day = dayOf(context)
  const buildable = mix.filter(({ unitKey }) => {
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

/**
 * Traegt der Bestand nach Vorbehalt (D32.7) und Ruecklage (`RESERVE_PERMILLE`) die Kosten einer
 * Einheit? Die Bedingung der Untergrenze aus D32.8 - derselbe Massstab wie `canAfford` fuer Bauten.
 */
function traegtNachRuecklage(
  bestand: Record<ResourceKey, number>,
  cost: Partial<Record<ResourceKey, number>>,
  vorbehalt: Partial<Record<ResourceKey, Fixed>> | null,
): boolean {
  for (const [key, amount] of Object.entries(cost)) {
    if (!amount) continue
    // Der Bestand nach den Befehlen desselben Zugs (Befund M42-07-a, dritte Iteration).
    const stock = Math.max(0, bestand[key as ResourceKey])
    const reserve = Math.trunc((stock * RESERVE_PERMILLE) / 1000)
    if (stock - reserve - (vorbehalt?.[key as ResourceKey] ?? 0) < amount) return false
  }
  return true
}

/** Raises troops where possible, sized to what the treasury can carry. */
// LOESCHVERMERK (Review): Befund M42-07-a, dritte Iteration - die Signatur bekommt `pending`. Alte Zeile:
// export function recruitCommands(context: AiContext, explanations: Explanation[]): Command[] {
export function recruitCommands(context: AiContext, explanations: Explanation[], pending: readonly Command[] = []): Command[] {
  // Befund M42-07-a, dritte Iteration: die Untergrenze hebt bis an die Ruecklage heran aus und traf
  // deshalb auf Geld, das Bau, Handel und Spionage desselben Zugs schon ausgegeben hatten (Stufe AB:
  // 14 abgelehnte Artillerien, China 7-mal). Die Untergrenze prueft deshalb den Bestand nach diesen
  // Befehlen (`ledgerAfter`). Der Anteil der Schwierigkeit rechnet weiter mit dem Sichtbestand - ihn
  // umzustellen ist T-M42-04 (mit neuer Abstimmung von `recruitShare`).
  const nachZug = ledgerAfter(context, pending)
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
  // Nur sichtbare eigene Provinzen (T-M41-09) — eine erinnerte fuehrt keine Gebaeude und fiele
  // unten ohnehin heraus; der Filter sagt es, statt sich darauf zu verlassen.
  const eigene = context.view.provinces.filter((province) => province.owner === playerId && !province.stale)
  const arten = (province: (typeof eigene)[number]): number =>
    Object.values(province.buildings ?? {}).filter((level) => (level ?? 0) > 0).length
  const nachVielseitigkeit = eigene
    .map((province, index) => ({ province, index }))
    .sort((a, b) => arten(b.province) - arten(a.province) || a.index - b.index)
    .map((entry) => entry.province)

  // R-AI-11/AK2, D32.4: die Tagesbilanz nach der Aushebung bleibt nicht negativ. Einmal je
  // Aufruf, nicht je Provinz — Ertrag, Unterhalt und Sold haengen an der Macht, nicht am Ort.
  // Warum die Tagesbilanz und nicht eine Projektion ueber mehrere Tage: eine Projektion liess
  // sich mit grossem Bestand (Kanada 325 k) leerrechnen, ohne dass die Aushebung je aufhoerte
  // (Kritik K-1). Ein grosser Bestand hilft hier bewusst nicht: bei schon negativer Tagesbilanz
  // gibt es keine Aushebung, egal wie voll die Kasse ist (Testfall E3).
  // Bekannte Unschaerfe: Einheiten in Ausbildung sieht die KI nicht (die Sicht fuehrt keine
  // Aushebungs-Warteschlange, `runner.ts` baut sie ohne Regeln) — zwei Aushebungen desselben
  // Tages koennen die Bilanz um hoechstens einen Block ueberziehen (gemessen: 4 von 13
  // negativen Aushebungstagen ohne Warteschlange, 0 Mangeltage).
  const bilanz = dailyMoneyLedger(context.view, context.rules)
  const ticksPerDay = context.rules.constants.ticksPerDay
  let bilanzSperrte = false

  // R-AI-12/AK1, D32.7: ausgehoben wird nur aus dem Bestand ueber dem Vorbehalt fuer die erste Fabrik.
  const vorbehalt = factoryReserve(context)
  let vorbehaltSperrte = false

  // D32.6: der Bestand in Einheiten einmal je Aufruf, nicht je Provinz (T-M42-05).
  const bestandInEinheiten = unitStockOf(context)

  // R-AI-12/AK4, D32.8 (T-M42-07): die Oel-Tagesbilanz - Foerderung minus Oelunterhalt aller Armeen.
  // Ein voller Oelbestand hilft bewusst nicht: wer kein Oel foerdert, fuehrt keine Einheit mit
  // Oelunterhalt, sonst laeuft der Bestand leer und das Heer in den Mangel.
  const oelSpielraum = dailyOilYield(context.view, context.rules) - dailyArmyUpkeep(context.view, context.rules, 'oil')
  let oelSperrte = false
  // T-M42-14 (Review Punkt 9, R-AI-12/AK4 neu gefasst): der Waechter rechnet mit dem Vorrat nach den
  // Befehlen desselben Zugs ueber `OIL_HORIZON_DAYS` statt mit der Tagesbilanz allein.
  const oelVorrat = nachZug.oil
  const oelTraegt = (jeEinheitTaeglich: number): number =>
    unitsWithinStockHorizon(oelVorrat, oelSpielraum, jeEinheitTaeglich, OIL_HORIZON_DAYS)

  // Befund M42-07-a, zweite Iteration: kann die Macht keinen einzigen Panzer tragen (Anteil der
  // Schwierigkeit, Oel- oder Geld-Tagesbilanz), geht sein Anteil an die Artillerie. Einmal je Aufruf,
  // nicht je Provinz - Bestand und Bilanzen haengen an der Macht.
  const panzer = context.rules.units['tank']
  const panzerTragbar =
    panzer !== undefined &&
    Object.entries(panzer.cost).every(([key, amount]) => {
      if (!amount) return true
      const frei = Math.max(0, context.view.self.resources[key as ResourceKey] - (vorbehalt?.[key as ResourceKey] ?? 0))
      return Math.trunc((frei * context.difficulty.recruitShare) / 1000) >= amount
    }) &&
    // LOESCHVERMERK (Review): T-M42-14 - Vorrats-Horizont statt Tagesbilanz. Alte Zeile:
    // unitsWithinDailyBalance(oelSpielraum, (panzer.upkeep.oil ?? 0) * ticksPerDay) >= 1 &&
    oelTraegt((panzer.upkeep.oil ?? 0) * ticksPerDay) >= 1 &&
    unitsWithinDailyBalance(bilanz.margin, (panzer.upkeep.money ?? 0) * ticksPerDay) >= 1

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
    // Unter der Moralgrenze hebt der Kern ohnehin nichts aus (D6.8) — sonst wirft die KI
    // RECRUIT ins Blaue (R-AI-09/AK2, Nacharbeit Turnier M17, C3).
    if ((province.morale ?? 0) < RECRUIT_MIN_MORALE) continue

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
    let begrenzt = false
    let vorbehaltBegrenzt = false
    let untergrenze = false
    /** Was vor dem Kandidaten in der Rangliste stand - jeder davon ist gescheitert, sonst staenden wir nicht hier (D32.8). */
    const davor: string[] = []

    for (const kandidat of rankedUnitsFor(context, province, bestandInEinheiten, true /* zweite Iteration: immer, nicht nur bei !panzerTragbar */)) {
      const regel = context.rules.units[kandidat]
      if (!regel) {
        davor.push(kandidat)
        continue
      }

      // Batch size: what the difficulty's share of the treasury pays for, capped so a
      // single order never becomes the whole army. R-AI-12/AK1, D32.7: der Vorbehalt fuer
      // die erste Fabrik zieht vom Bestand ab, bevor der Anteil der Schwierigkeit greift.
      let moeglich = 15
      let ohneVorbehalt = 15
      for (const [key, amount] of Object.entries(regel.cost)) {
        if (!amount) continue
        const stock = context.view.self.resources[key as ResourceKey]
        const frei = Math.max(0, stock - (vorbehalt?.[key as ResourceKey] ?? 0))
        const budget = Math.trunc((frei * context.difficulty.recruitShare) / 1000)
        moeglich = Math.min(moeglich, Math.trunc(budget / amount))
        ohneVorbehalt = Math.min(
          ohneVorbehalt,
          Math.trunc(Math.trunc((stock * context.difficulty.recruitShare) / 1000) / amount),
        )
      }
      // **Die Untergrenze** (T-M42-07, R-AI-12/AK3, D32.8). Der Anteil der Schwierigkeit traegt eine
      // Artillerie (200 000 Geld) erst ab 1 Mio. ("normal") bzw. 2,5 Mio. ("leicht") auf dem Konto -
      // gemessen hob die KI deshalb in 200 Spieltagen keine einzige aus (Befund M17-T7). Eine Einheit
      // gibt es trotzdem, wenn alle vier Bedingungen gelten: der Anteil traegt keine, die Einheit
      // braucht eine Fabrik, vor ihr stand in der Rangliste nur der unbezahlbare Panzer, und der
      // Bestand nach Vorbehalt **und** Ruecklage traegt die Kosten. Nicht fuer die Infanterie und
      // nicht hinter ihr: deren Menge regelt weiter der Anteil.
      // LOESCHVERMERK (Review): zweite Iteration M42-07-a. Alte Zeile:
      // const nurPanzerDavor = davor.length > 0 && davor.every((key) => key === 'tank')
      // Befund M42-07-a, zweite Iteration: hat der Panzer seinen Anteil an die Artillerie abgegeben,
      // darf sie auch ganz vorn stehen - der Panzer steht dann der Sache nach vor ihr.
      const nurPanzerDavor = davor.every((key) => key === 'tank') && (davor.length > 0 || !panzerTragbar)
      if (moeglich < 1 && nurPanzerDavor && regel.requiresBuilding === 'factory' && traegtNachRuecklage(nachZug, regel.cost, vorbehalt)) {
        moeglich = 1
        untergrenze = true
      } else {
        untergrenze = false
      }
      if (moeglich < 1) {
        if (ohneVorbehalt >= 1) vorbehaltSperrte = true
        davor.push(kandidat)
        continue
      }

      // R-AI-11/AK2, D32.4: die Tagesbilanz nach der Aushebung bleibt nicht negativ.
      const budgetMoeglich = moeglich
      const jeEinheit = (regel.upkeep.money ?? 0) * ticksPerDay
      moeglich = Math.min(moeglich, unitsWithinDailyBalance(bilanz.margin, jeEinheit))
      if (moeglich < 1) {
        bilanzSperrte = true
        davor.push(kandidat)
        continue // naechster Kandidat; nach dem letzten die naechste Provinz (D32.4)
      }

      // R-AI-12/AK4, D32.8: Einheiten mit Oelunterhalt nur, solange die Oel-Tagesbilanz danach nicht
      // negativ ist - dieselbe Rechnung wie fuer das Geld oben (`unitsWithinDailyBalance`).
      const oelJeEinheit = (regel.upkeep.oil ?? 0) * ticksPerDay
      if (oelJeEinheit > 0) {
        // LOESCHVERMERK (Review): T-M42-14 - Vorrats-Horizont statt Tagesbilanz. Alte Zeile:
        // moeglich = Math.min(moeglich, unitsWithinDailyBalance(oelSpielraum, oelJeEinheit))
        moeglich = Math.min(moeglich, oelTraegt(oelJeEinheit))
        if (moeglich < 1) {
          oelSperrte = true
          davor.push(kandidat)
          continue
        }
      }

      unitKey = kandidat
      unit = regel
      affordable = moeglich
      begrenzt = moeglich < budgetMoeglich
      vorbehaltBegrenzt = budgetMoeglich < ohneVorbehalt
      break
    }

    if (!unitKey || !unit) continue

    commands.push({ type: 'RECRUIT', playerId, provinceId: province.id, unitKey, count: affordable })
    explanations.push({
      action: `Rekrutiert ${affordable}x ${unitKey} in ${province.id}`,
      reason:
        (begrenzt
          ? `Streitkräfte aufbauen; die Tagesbilanz trägt ${affordable} (Spielraum ${bilanz.margin} je Tag, ${(unit.upkeep.money ?? 0) * ticksPerDay} je Einheit)`
          : 'Streitkräfte aufbauen') +
        (vorbehaltBegrenzt ? '; Vorbehalt für die erste Fabrik' : '') +
        (untergrenze ? '; Untergrenze: eine Einheit aus dem Bestand über der Rücklage' : '') +
        (oelSperrte ? `; Ölvorrat trägt über ${OIL_HORIZON_DAYS} Tage keine weitere Einheit mit Ölunterhalt (Vorrat ${oelVorrat}, Spielraum ${oelSpielraum} je Tag)` : ''),
      score: 500,
      alternative: { action: 'nichts rekrutieren', score: 200 },
    })
    break
  }

  if (commands.length === 0 && oelSperrte) {
    explanations.push({
      action: 'Aushebung unterbleibt',
      reason: `Ölvorrat trägt über ${OIL_HORIZON_DAYS} Tage keine Einheit mit Ölunterhalt: Vorrat ${oelVorrat}, Spielraum ${oelSpielraum} je Tag`,
      score: 0,
      alternative: { action: 'aus dem Ölbestand ausheben', score: 0 },
    })
  }
  if (commands.length === 0 && bilanzSperrte) {
    explanations.push({
      action: 'Aushebung unterbleibt',
      reason: `Tagesbilanz trägt keine weitere Einheit: Ertrag ${bilanz.income}, Unterhalt ${bilanz.upkeep}, Sold ${bilanz.salary} je Tag`,
      score: 0,
      alternative: { action: 'aus dem Bestand ausheben', score: 0 },
    })
  } else if (commands.length === 0 && vorbehaltSperrte) {
    explanations.push({
      action: 'Aushebung unterbleibt',
      reason: 'Vorbehalt für die erste Fabrik: der Bestand darüber trägt keine Einheit',
      score: 0,
      alternative: { action: 'aus dem Vorbehalt ausheben', score: 0 },
    })
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
/** Was dem nächsten Bauvorhaben fehlt, mit Menge (T-M17-10) — die Börse braucht den Rohstoff, das Handelsangebot auch die Menge. */
export interface BuildingShortfall {
  resource: ResourceKey
  amount: Fixed
  building: BuildingKey
  provinceId: ProvinceId
}

export function nextBuildingShortfall(context: AiContext): BuildingShortfall | null {
  // Nur sichtbare eigene Provinzen (T-M41-09): sonst tauscht die KI fuer einen Bau, den der Kern ablehnt.
  const own = context.view.provinces.filter(
    (province) => province.owner === context.view.playerId && !province.stale,
  )

  for (const province of own) {
    if ((province.buildQueueLength ?? 0) > 0) continue
    const building = nextBuildingFor(context, province)
    if (!building) continue

    const rule = context.rules.buildings[building]
    const kosten = buildingCostForLevel(rule, (province.buildings?.[building] ?? 0) + 1, context.rules.constants)
    for (const [key, amount] of Object.entries(kosten)) {
      if (!amount) continue
      const resource = key as ResourceKey
      const stock = context.view.self.resources[resource]
      const reserve = Math.trunc((stock * RESERVE_PERMILLE) / 1000)
      if (stock - reserve < amount) {
        return { resource, amount: amount - (stock - reserve), building, provinceId: province.id }
      }
    }
  }
  return null
}

function missingForNextBuilding(context: AiContext): ResourceKey | null {
  return nextBuildingShortfall(context)?.resource ?? null
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
    reason: shortages.length > 0 ? `Mangel an ${need} decken` : `${need} für das nächste Bauvorhaben`,
    score: 700,
  })
  return [{ type: 'TRADE', playerId: context.view.playerId, give: best, giveAmount: give, want: need }]
}
