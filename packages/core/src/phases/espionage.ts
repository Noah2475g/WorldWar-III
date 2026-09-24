import { chance } from '@worldwar/shared'
import { emit } from '../events/emit'
import { spySalary, spyTargetProblem } from '../rules/espionage'
import type { GameState, Reveal, Spy } from '../state/types'
import type { PhaseContext } from './index'

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
 *  (c) Gegenspionage (R-SPY-05) — kommt mit T-M17-09;
 *  (d) jeder übrige Spion, der **vor** dem endenden Tag angesetzt wurde, führt seinen Auftrag aus
 *      (R-SPY-02/AK3). Passt das Ziel nicht mehr zum Auftrag, wird nicht gewürfelt
 *      (`targetChanged`); sonst entscheidet `chance()` aus dem Zufall des Zustands.
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

  // (c) Gegenspionage: T-M17-09. Ein Gegenspion zahlt schon heute Sold, würfelt aber noch nicht.

  // (d) Die Aufträge. „Frühestens am Tag nach der Anwerbung": der Tag, der gerade endet, begann
  // bei `tick − ticksPerDay`; wer in ihm angesetzt wurde — angeworben oder umgesetzt —, wartet.
  const dayStart = draft.tick - constants.ticksPerDay
  for (const spy of espionage.spies) {
    if (spy.assignedTick >= dayStart) continue
    if (spy.mission === 'counter') continue // (c)

    const outcome = runMission(draft, ctx, spy)
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
 * Ein Auftrag, einmal. `null` heißt: dieser Auftrag hat im Tageslauf noch keine Wirkung.
 *
 * Das Ziel wird gegen den **wahren** Besitzer geprüft — der Kern urteilt hier nicht für einen
 * Spieler, er stellt fest, was geschieht. Es ist dieselbe Regel wie beim Anwerben
 * (`spyTargetProblem`), nur dort gegen das, was der Spieler weiß.
 */
function runMission(draft: GameState, ctx: PhaseContext, spy: Spy): NonNullable<Spy['lastOutcome']> | null {
  const province = draft.provinces[spy.provinceId]!
  if (spyTargetProblem(province.owner, spy.owner, spy.mission) !== null) return 'targetChanged'

  switch (spy.mission) {
    case 'intel': {
      if (!chance(draft.rng, ctx.rules.constants.spySuccessIntelPermille)) return 'failure'
      reveal(draft, ctx, { player: spy.owner, provinceId: spy.provinceId, kind: 'intel' })
      return 'success'
    }
    case 'economicSabotage':
    case 'militarySabotage':
      // Wurf und Wirkung der Sabotage: T-M17-09 (R-SPY-04). Bis dahin zahlt ein Saboteur Sold und
      // meldet nur, wenn sein Ziel nicht mehr passt — kein Wurf, also kein Zufall.
      return null
    case 'counter':
      return null
  }
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
