import { chance, mulFixed, type Fixed } from '@worldwar/shared'
import { emit } from '../events/emit'
import { spySalary, spyTargetProblem } from '../rules/espionage'
import type { GameState, PlayerId, Province, ProvinceId, ResourceKey, Reveal, Spy, SpyId } from '../state/types'
import { atWar } from './combat'
import { addGrievance } from './diplomacy'
import type { PhaseContext } from './index'
import { capitalPenalty, provinceYieldScaled } from './production'

/**
 * Der Tageslauf der Spionage (R-SPY-02, R-SPY-03, T-M17-08, D29.3).
 *
 * Läuft einmal je Tageswechsel, in `dailyTick` direkt nach der Moral — damit eine Sabotage
 * (T-M17-09) nicht vom Moraldrift desselben Tages zur Hälfte zurückgenommen wird. Vier Schritte in
 * fester Reihenfolge, jeder in der Reihenfolge des Arrays (R-ARCH-01):
 *
 *  (a) abgelaufene Aufdeckungen fallen weg — die Provinz liegt wieder hinter dem Nebel;
 *  (b) jeder Spion kostet seinen Tagessold; wer ihn nicht zahlen kann, verliert den Spion
 *      (`SPY_LOST`, R-SPY-02/AK2) — bevor er irgendetwas tut;
 *  (c) jeder fällige Gegenspion würfelt je fremdem Spion in seiner Provinz (R-SPY-05); wer enttarnt
 *      wird, ist verloren und tut heute nichts mehr;
 *  (d) jeder übrige Spion, der **vor** dem endenden Tag angesetzt wurde, führt seinen Auftrag aus
 *      (R-SPY-02/AK3). Passt das Ziel nicht mehr zum Auftrag, wird nicht gewürfelt
 *      (`targetChanged`); sonst entscheidet `chance()` aus dem Zufall des Zustands. Je Provinz wirkt
 *      höchstens eine Sabotage je Tag (R-SPY-04/AK4) — eine Menge dieses Durchlaufs, kein Zustand.
 *
 * **Ohne Spione wird kein Zufall verbraucht** (D29.4) — und ohne Spione und ohne Aufdeckung
 * nichts angefasst. Das ist keine Sparsamkeit, sondern die Zusage, auf der jeder alte Spielstand
 * und der Golden-Master ruhen: `determinism.test.ts` vergleicht den Hash nach jedem von 500 Ticks
 * mit einem Lauf, in dem es diese Funktion nicht gibt.
 */
export function settleEspionage(draft: GameState, ctx: PhaseContext): void {
  const espionage = draft.espionage
  if (espionage.spies.length === 0 && espionage.reveals.length === 0) return

  const constants = ctx.rules.constants

  // (a) Was bis zu diesem Wechsel galt, ist vorbei (R-SPY-03/AK2). Ein Spion, der heute wieder
  // Erfolg hat, deckt unten neu auf — so bleibt eine Provinz ohne Lücke offen, solange er es hat.
  espionage.reveals = espionage.reveals.filter((reveal) => reveal.untilTick > draft.tick)

  // Eine ausgeschiedene Macht befiehlt nichts mehr (`registry.ts`, PLAYER_ELIMINATED) — auch
  // nicht das Entlassen ihrer eigenen Spione. Ohne diese Zeile sabotiert und spioniert sie über
  // den Tod hinaus, bis ihr Geld aufgebraucht ist (Befund M17-S3, Nacharbeit kern): stillschweigend
  // entfernt, vor dem Sold, ohne Zufallszug und ohne Ereignis — es gibt niemanden mehr, der eines
  // läse.
  espionage.spies = espionage.spies.filter((spy) => draft.players[spy.owner]!.alive)

  // (b) Sold, in Array-Reihenfolge: reicht das Geld nur für einen Teil, gehen die späteren.
  const paid: Spy[] = []
  for (const spy of espionage.spies) {
    const resources = draft.players[spy.owner]!.resources
    const salary = spySalary(constants, spy.mission)
    if (resources.money < salary) {
      emit(ctx.events, draft.tick, 'SPY_LOST', {
        playerId: spy.owner,
        spyId: spy.id,
        provinceId: spy.provinceId,
        mission: spy.mission,
        reason: 'unpaid',
        audience: [spy.owner],
      })
      continue
    }
    resources.money -= salary
    paid.push(spy)
  }
  espionage.spies = paid

  // Der Tag, der gerade endet, begann bei `tick − ticksPerDay`; wer in ihm angesetzt wurde —
  // angeworben oder umgesetzt —, wartet (R-SPY-02/AK3). Das gilt für Gegenspione wie für alle.
  const dayStart = draft.tick - constants.ticksPerDay

  // (c) Gegenspionage (R-SPY-05) — vor den Aufträgen, damit ein enttarnter Saboteur nichts mehr anrichtet.
  counterIntelligence(draft, ctx, dayStart)

  // (d) Die Aufträge. „Heute sabotiert" ist eine Menge dieses Durchlaufs, kein Zustand (R-SPY-04/AK4):
  // morgen darf dieselbe Provinz wieder getroffen werden, und ein Spielstand trägt nichts davon.
  const sabotagedToday = new Set<ProvinceId>()
  for (const spy of espionage.spies) {
    if (spy.assignedTick >= dayStart) continue
    if (spy.mission === 'counter') continue // (c)

    const outcome = runMission(draft, ctx, spy, sabotagedToday)
    if (outcome === null) continue

    spy.lastRunTick = draft.tick
    spy.lastOutcome = outcome
    emit(ctx.events, draft.tick, 'SPY_REPORT', {
      playerId: spy.owner,
      spyId: spy.id,
      provinceId: spy.provinceId,
      mission: spy.mission,
      outcome,
      audience: [spy.owner],
    })
  }
}

/**
 * Schritt (c): jeder fällige Gegenspion würfelt je fremdem Spion in seiner Provinz (R-SPY-05, D29.3).
 *
 * Reihenfolge: Gegenspione in Array-Reihenfolge, je Gegenspion die fremden Spione in Array-Reihenfolge.
 * Ein schon enttarnter Spion wird nicht noch einmal gewürfelt. Ein fremder Spion ist jeder mit anderem
 * Besitzer — auch einer, der erst heute kam: Gegenspionage bewacht, wer da ist.
 *
 * Der Gegenspion meldet keinen Bericht, nur `targetChanged` (wie jeder Spion). Sein letzter Ausgang ist
 * `success`, wenn er heute jemanden enttarnt hat, sonst `failure` — **gleich, ob niemand da war oder der
 * Wurf misslang**. Unterschiede er das, verriete er dem Besitzer einen Spion, den er nicht gefunden hat.
 */
function counterIntelligence(draft: GameState, ctx: PhaseContext, dayStart: number): void {
  const espionage = draft.espionage
  const detected = new Set<SpyId>()
  for (const counter of espionage.spies) {
    if (counter.mission !== 'counter') continue
    if (detected.has(counter.id)) continue
    if (counter.assignedTick >= dayStart) continue

    const province = draft.provinces[counter.provinceId]!
    if (spyTargetProblem(province.owner, counter.owner, 'counter') !== null) {
      counter.lastRunTick = draft.tick
      counter.lastOutcome = 'targetChanged'
      emit(ctx.events, draft.tick, 'SPY_REPORT', {
        playerId: counter.owner,
        spyId: counter.id,
        provinceId: counter.provinceId,
        mission: counter.mission,
        outcome: 'targetChanged',
        audience: [counter.owner],
      })
      continue
    }

    let found = false
    for (const target of espionage.spies) {
      if (target.provinceId !== counter.provinceId || target.owner === counter.owner) continue
      if (detected.has(target.id)) continue
      if (!chance(draft.rng, ctx.rules.constants.spyDetectionPermille)) continue
      detected.add(target.id)
      found = true
      expose(draft, ctx, counter.owner, target)
    }
    counter.lastRunTick = draft.tick
    counter.lastOutcome = found ? 'success' : 'failure'
  }
  if (detected.size > 0) espionage.spies = espionage.spies.filter((spy) => !detected.has(spy.id))
}

/**
 * Ein fremder Spion ist enttarnt (R-SPY-05/AK1): der Urheber verliert Ansehen — doppelt bei Sabotage
 * gegen eine Macht, mit der er nicht im Krieg ist (eine erklärte, noch nicht wirksame Kriegserklärung
 * ist noch Frieden) —, und der Entdecker merkt sich die Verstimmung (R-DIP-06, Befund B7). Ansehen ohne
 * Boden, wie beim Überfall (`phases/diplomacy.ts`).
 */
function expose(draft: GameState, ctx: PhaseContext, discoverer: PlayerId, spy: Spy): void {
  const constants = ctx.rules.constants
  const sabotage = spy.mission === 'economicSabotage' || spy.mission === 'militarySabotage'
  const doubled = sabotage && !atWar(draft, spy.owner, discoverer)
  const loss = constants.spyDetectedReputationLoss
  // eslint-disable-next-line no-restricted-syntax -- Verdopplung nach R-SPY-05, ganze Zahl
  draft.players[spy.owner]!.reputation -= doubled ? 2 * loss : loss
  addGrievance(draft, discoverer, spy.owner, constants.grievanceOnSpyDetected, constants.grievanceMax)
  emit(ctx.events, draft.tick, 'SPY_DETECTED', {
    playerId: spy.owner,
    targetPlayerId: discoverer,
    provinceId: spy.provinceId,
    mission: spy.mission,
    audience: [spy.owner, discoverer],
  })
}

/**
 * Ein Auftrag, einmal. `null` heißt: dieser Auftrag hat im Tageslauf keine Wirkung (Gegenspionage
 * läuft in Schritt c).
 *
 * Das Ziel wird gegen den **wahren** Besitzer geprüft — der Kern urteilt hier nicht für einen
 * Spieler, er stellt fest, was geschieht. Es ist dieselbe Regel wie beim Anwerben
 * (`spyTargetProblem`), nur dort gegen das, was der Spieler weiß.
 */
function runMission(
  draft: GameState,
  ctx: PhaseContext,
  spy: Spy,
  sabotagedToday: Set<ProvinceId>,
): NonNullable<Spy['lastOutcome']> | null {
  const province = draft.provinces[spy.provinceId]!
  if (spyTargetProblem(province.owner, spy.owner, spy.mission) !== null) return 'targetChanged'

  switch (spy.mission) {
    case 'intel': {
      if (!chance(draft.rng, ctx.rules.constants.spySuccessIntelPermille)) return 'failure'
      reveal(draft, ctx, { player: spy.owner, provinceId: spy.provinceId, kind: 'intel' })
      return 'success'
    }
    case 'economicSabotage':
    case 'militarySabotage': {
      // Höchstens eine gelungene Sabotage je Provinz und Tag (R-SPY-04/AK4). Wer danach kommt, würfelt
      // nicht — es gäbe nichts mehr zu bewirken — und meldet `failure`.
      if (sabotagedToday.has(spy.provinceId)) return 'failure'
      if (!chance(draft.rng, ctx.rules.constants.spySuccessSabotagePermille)) return 'failure'
      sabotagedToday.add(spy.provinceId)
      if (spy.mission === 'economicSabotage') sabotageEconomy(draft, ctx, province)
      else sabotageMilitary(draft, ctx, province, spy.owner)
      return 'success'
    }
    case 'counter':
      return null
  }
}

/**
 * Wirtschaftssabotage (R-SPY-04/AK1): der Eigentümer verliert den Regelanteil des Tagesertrags der
 * Provinz, je Rohstoff gekappt an seinem Bestand, und die Provinzmoral sinkt um den Regelwert, nie unter
 * null. Der Ertrag wird **vor** dem Moralabzug bemessen — es ist der Ertrag des Tages, der gerade endet.
 * `targetMorale` bleibt: die Provinz erholt sich über den gewöhnlichen Drift.
 */
function sabotageEconomy(draft: GameState, ctx: PhaseContext, province: Province): void {
  const { rules } = ctx
  const constants = rules.constants
  const victim = province.owner! // spyTargetProblem schließt herrenlose Ziele aus
  const player = draft.players[victim]!

  const destroyed: Partial<Record<ResourceKey, Fixed>> = {}
  const yields = provinceYieldScaled(province, draft.tick, capitalPenalty(player, draft.tick, rules), rules)
  for (const [key, scaled] of Object.entries(yields)) {
    if (!scaled || scaled <= 0) continue
    const resource = key as ResourceKey
    // Ertrag je Tick ist mit ONE skaliert; mal Ticks je Tag, durch ONE: der Tagesertrag in Festkomma.
    const daily = mulFixed(scaled, constants.ticksPerDay)
    const loss = Math.min(mulFixed(daily, constants.sabotageYieldDestroyedPermille), Math.max(0, player.resources[resource]))
    if (loss <= 0) continue
    player.resources[resource] -= loss
    destroyed[resource] = loss
  }

  const before = province.morale
  province.morale = Math.max(0, before - constants.sabotageMoraleLoss)

  emit(ctx.events, draft.tick, 'SABOTAGE_SUFFERED', {
    playerId: victim,
    provinceId: province.id,
    kind: 'economic',
    moraleLoss: before - province.morale,
    destroyed,
    delayTicks: 0,
    audience: [victim],
  })
}

/**
 * Militärsabotage (R-SPY-04/AK2): jeder laufende Bau- und Aushebeauftrag der Provinz wird um die
 * Regelzahl Ticks später fertig, und der Saboteur sieht die Armeen der Provinz (`armies`, D29.6).
 */
function sabotageMilitary(draft: GameState, ctx: PhaseContext, province: Province, saboteur: PlayerId): void {
  const victim = province.owner!
  const delay = ctx.rules.constants.militarySabotageDelayTicks
  for (const order of province.buildQueue) order.completesAtTick += delay
  for (const order of province.recruitQueue) order.completesAtTick += delay
  reveal(draft, ctx, { player: saboteur, provinceId: province.id, kind: 'armies' })

  emit(ctx.events, draft.tick, 'SABOTAGE_SUFFERED', {
    playerId: victim,
    provinceId: province.id,
    kind: 'military',
    moraleLoss: 0,
    destroyed: {},
    delayTicks: delay,
    audience: [victim],
  })
}

/**
 * Deckt eine Provinz für einen Spieler auf, bis `spyRevealDays` Tageswechsel vergangen sind.
 *
 * Je Spieler, Provinz und Art gibt es höchstens **eine** Aufdeckung: zwei Aufklärer am selben
 * Ziel verlängern sie, statt sie zu stapeln. Die Reihenfolge des Arrays ist die, in der sie
 * entstanden sind.
 */
function reveal(draft: GameState, ctx: PhaseContext, what: Omit<Reveal, 'untilTick'>): void {
  const { spyRevealDays, ticksPerDay } = ctx.rules.constants
  // eslint-disable-next-line no-restricted-syntax -- days x ticks-per-day, plain integers
  const untilTick = draft.tick + spyRevealDays * ticksPerDay
  const existing = draft.espionage.reveals.find(
    (entry) => entry.player === what.player && entry.provinceId === what.provinceId && entry.kind === what.kind,
  )
  if (existing) {
    existing.untilTick = Math.max(existing.untilTick, untilTick)
    return
  }
  draft.espionage.reveals.push({ ...what, untilTick })
}
