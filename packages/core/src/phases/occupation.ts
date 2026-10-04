import { emit } from '../events/emit'
import { atWar } from './combat'
import { addGrievance } from './diplomacy'
import { presentArmiesByProvince } from '../state/army'
import type { Army, GameState, PlayerId, ProvinceId } from '../state/types'
import type { Phase, PhaseContext } from './index'

/**
 * Province capture (R-BAT-04, design D6.6).
 *
 * A province changes hands when an enemy land force stands in it and nobody is left
 * to defend it. Aircraft and ships cannot take ground — that is what keeps land forces
 * necessary.
 */
function canOccupy(present: readonly Army[], rules: PhaseContext['rules']): PlayerId | null {
  const withLand = present.filter((army) =>
    army.units.some((stack) => {
      const rule = rules.units[stack.unitKey]
      return rule && rule.class !== 'air' && rule.class !== 'navy'
    }),
  )
  if (withLand.length === 0) return null

  const owners = new Set(withLand.map((army) => army.owner))
  if (owners.size !== 1) return null // still contested

  return [...owners][0]!
}

/**
 * Der Besitzerwechsel selbst — ein Helfer fuer die Eroberung (unten) und die Abtretung durch
 * Vertrag (`commands/tradeOffer.ts`, T-M17-06, R-DIP-09/AK2).
 *
 * Er setzt nur den Besitzer und nimmt die Aushebungen vom Band. Laufende Bauauftraege bleiben
 * stehen und enden in der Bauphase ueber `ownerAtStart` (`BUILD_CANCELLED` an den alten Besitzer,
 * ohne Erstattung, R-PROV-01/AK2). Was eine Eroberung ZUSAETZLICH kostet — Eroberungsmoral,
 * Besatzungszeit, Verstimmung, Hauptstadtverlust und `PROVINCE_CAPTURED` —, bleibt beim Aufrufer:
 * eine Abtretung hat davon nichts. Der Aufstand (`phases/morale.ts`) nimmt ihn nicht, weil er die
 * Provinz niemandem gibt und beide Warteschlangen selbst leert.
 *
 * Gibt den Vorbesitzer zurueck.
 */
export function transferProvince(draft: GameState, provinceId: ProvinceId, newOwner: PlayerId): PlayerId | null {
  const province = draft.provinces[provinceId]!
  const previousOwner = province.owner
  province.owner = newOwner
  // Orders die with the change of owner; the construction phase reports it.
  province.recruitQueue = []
  return previousOwner
}

export const occupation: Phase = (draft: GameState, ctx: PhaseContext) => {
  // Grouped once per phase (V3 T-M45-03): a capture changes owners, never where armies stand.
  const armiesHere = presentArmiesByProvince(draft)

  for (const provinceId of draft.provinceOrder) {
    const present = armiesHere.get(provinceId)
    if (!present) continue
    const province = draft.provinces[provinceId]!
    const claimant = canOccupy(present, ctx.rules)
    if (!claimant || claimant === province.owner) continue

    // Neutral ground can be walked into; owned ground needs a war.
    if (province.owner !== null && !atWar(draft, claimant, province.owner)) continue

    const previousOwner = transferProvince(draft, provinceId, claimant)
    province.morale = ctx.rules.constants.capturedMorale
    province.occupiedSince = draft.tick

    // Eine verlorene Provinz ist der haeufigste Anlass fuer eine Verstimmung — und der
    // Grund, warum ein Krieg sich verhaertet, statt nach dem ersten Gefecht zu enden
    // (T-M15-05, R-DIP-06).
    if (previousOwner) {
      addGrievance(
        draft,
        previousOwner,
        claimant,
        ctx.rules.constants.grievanceOnProvinceLost,
        ctx.rules.constants.grievanceMax,
      )
    }

    // Betroffen sind die beiden, denen die Provinz gehoerte und gehoert — nicht jeder,
    // der zusieht (T-M15-01). Ein Vorbesitzer kann null sein: herrenloses Land geht
    // niemanden an ausser dem, der es nimmt.
    emit(ctx.events, draft.tick, 'PROVINCE_CAPTURED', {
      provinceId,
      previousOwner,
      newOwner: claimant,
      concerns: previousOwner ? [previousOwner, claimant] : [claimant],
    })

    // Losing a capital hurts the whole nation for a while (design D6.8).
    if (previousOwner && draft.players[previousOwner]?.capitalProvinceId === provinceId) {
      const player = draft.players[previousOwner]!
      // eslint-disable-next-line no-restricted-syntax -- days x ticks-per-day, plain integers
      const until = draft.tick + ctx.rules.constants.capitalLossDays * ctx.rules.constants.ticksPerDay
      player.capitalLostUntil = until
      player.capitalProvinceId = null

      emit(ctx.events, draft.tick, 'CAPITAL_LOST', {
        playerId: previousOwner,
        provinceId,
        penaltyUntilTick: until,
        concerns: [previousOwner, claimant],
      })
    }
  }
}
