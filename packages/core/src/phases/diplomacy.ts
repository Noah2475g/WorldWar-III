import { emit } from '../events/emit'
import { relationKey } from '../state/create'
import type { Fixed } from '@worldwar/shared'
import type { GameState, PlayerId } from '../state/types'
import type { Phase, PhaseContext } from './index'

/**
 * Diplomatic state over time (R-DIP-02, design D3 phase 11).
 *
 * Declarations come into force, truces run out, and an attack launched without a
 * declaration is recorded as what it is. The delay is what makes a declaration a
 * decision rather than a formality.
 */

/** An army standing in someone's territory while not at war is an act of aggression. */
function detectSurpriseAttacks(draft: GameState, ctx: PhaseContext): void {
  for (const armyId of draft.armyOrder) {
    const army = draft.armies[armyId]
    if (!army) continue
    const province = draft.provinces[army.locationProvinceId]
    if (!province?.owner || province.owner === army.owner) continue

    const relation = draft.diplomacy.relations[relationKey(army.owner, province.owner)]
    if (!relation || relation.state === 'war') continue
    if (relation.rightOfWay || relation.state === 'alliance') continue

    // No declaration, but boots on foreign soil: war starts immediately and costs
    // standing. Forbidding the move outright would remove the interesting choice.
    relation.state = 'war'
    relation.sinceTick = draft.tick
    relation.warEffectiveAtTick = null
    draft.players[army.owner]!.reputation -= ctx.rules.constants.surpriseAttackReputationLoss
    // Der Ueberfall macht das **Opfer** boese, nicht den Taeter — deshalb ist das
    // Verstimmungs-Record gerichtet und kein gemeinsamer Schluessel wie `relations`.
    addGrievance(
      draft,
      province.owner,
      army.owner,
      ctx.rules.constants.grievanceOnSurpriseAttack,
      ctx.rules.constants.grievanceMax,
    )

    emit(ctx.events, draft.tick, 'WAR_DECLARED', {
      playerId: army.owner,
      targetPlayerId: province.owner,
      effectiveAtTick: draft.tick,
      withoutDeclaration: true,
      audience: [army.owner, province.owner] as PlayerId[],
    })
  }
}

export const diplomacy: Phase = (draft: GameState, ctx: PhaseContext) => {
  for (const [key, relation] of Object.entries(draft.diplomacy.relations)) {
    // Declarations coming into force.
    if (relation.warEffectiveAtTick !== null && draft.tick >= relation.warEffectiveAtTick) {
      relation.state = 'war'
      relation.sinceTick = draft.tick
      relation.warEffectiveAtTick = null
      relation.rightOfWay = false
      relation.sharedMap = false

      const [a, b] = key.split('|') as [PlayerId, PlayerId]
      emit(ctx.events, draft.tick, 'DIPLOMACY_CHANGED', {
        playerId: a,
        targetPlayerId: b,
        newState: 'war',
        audience: [a, b],
      })
    }

    // Truces expire back into plain peace.
    if (relation.state === 'truce') {
      // eslint-disable-next-line no-restricted-syntax -- days x ticks-per-day, plain integers
      const duration = ctx.rules.constants.truceDurationDays * ctx.rules.constants.ticksPerDay
      if (draft.tick >= relation.sinceTick + duration) {
        relation.state = 'peace'
        relation.sinceTick = draft.tick
      }
    }
  }

  // Offers do not stay on the table forever.
  // eslint-disable-next-line no-restricted-syntax -- days x ticks-per-day, plain integers
  const offerLifetime = 3 * ctx.rules.constants.ticksPerDay
  draft.diplomacy.offers = draft.diplomacy.offers.filter((offer) => draft.tick - offer.tick < offerLifetime)

  detectSurpriseAttacks(draft, ctx)
  relax(draft, ctx)
}

/**
 * Ansehen und Verstimmungen klingen ab (T-M15-05, R-DIP-06/AK5).
 *
 * Ohne diesen Schritt wäre beides ein Einbahnverkehr: ein Überfall im dritten Spieljahr
 * hinge einer Macht bis zum Ende der Partie an, und die Diplomatie hätte kein Gedächtnis,
 * sondern ein Strafregister. Zeit heilt — langsam, und in beide Richtungen.
 *
 * Läuft **einmal je Spieltag** und über `playerOrder`, nicht über `Object.keys`: sonst
 * hinge das Ergebnis an der Einfügereihenfolge eines Records, und R-ARCH-01 wäre gebrochen
 * an einer Stelle, die kein Golden-Master findet, weil Records in der Praxis meist doch
 * in derselben Reihenfolge entstehen.
 */
function relax(draft: GameState, ctx: PhaseContext): void {
  const { constants } = ctx.rules
  if (draft.tick % constants.ticksPerDay !== 0) return

  for (const id of draft.playerOrder) {
    const player = draft.players[id]!

    // Das Ansehen kriecht zum Ausgangswert zurück — von oben wie von unten.
    if (player.reputation < constants.reputationBaseline) {
      player.reputation = Math.min(constants.reputationBaseline, player.reputation + constants.reputationRecoveryPerDay)
    } else if (player.reputation > constants.reputationBaseline) {
      player.reputation = Math.max(constants.reputationBaseline, player.reputation - constants.reputationRecoveryPerDay)
    }

    const mine = draft.diplomacy.grievances[id]
    if (!mine) continue
    for (const other of draft.playerOrder) {
      const value = mine[other]
      if (value === undefined) continue
      // eslint-disable-next-line no-restricted-syntax -- Promilleanteil auf einen Verhältniswert, ganze Zahlen
      const next = value - Math.max(1, Math.trunc((value * constants.grievanceDecayPermillePerDay) / 1000))
      if (next <= 0) delete mine[other]
      else mine[other] = next
    }
    if (Object.keys(mine).length === 0) delete draft.diplomacy.grievances[id]
  }
}

/** Eine Verstimmung eintragen, gedeckelt. `who` ist der Verstimmte, `against` der Anlass. */
export function addGrievance(draft: GameState, who: PlayerId, against: PlayerId, amount: Fixed, max: Fixed): void {
  if (who === against) return
  const mine = (draft.diplomacy.grievances[who] ??= {})
  mine[against] = Math.min(max, (mine[against] ?? 0) + amount)
}
