import { emit } from '../events/emit'
import { expirePassage, grantsPassage, relationKey } from '../state/create'
import type { Fixed } from '@worldwar/shared'
import type { GameState, PlayerId, Relation } from '../state/types'
import type { Phase, PhaseContext } from './index'

/**
 * Diplomatic state over time (R-DIP-02, design D3 phase 11).
 *
 * Declarations come into force, truces run out, and an attack launched without a
 * declaration is recorded as what it is. The delay is what makes a declaration a
 * decision rather than a formality.
 */

/**
 * Ein Krieg beendet Durchmarsch **und** Kartenfreigabe, in beiden Richtungen (Befund M17-3).
 *
 * Entschieden in T-M17-04, kippbar (Fragment A zu `DECISIONS.md`). D29.1 sagte, ein Krieg
 * loesche „wie heute nur den Durchmarsch" — er loeschte seit M6 auch die Karte, und dabei
 * bleibt es: was der andere bis hierher gesehen hat, behaelt er ohnehin im
 * Aufklaerungsgedaechtnis (`player.intel`); geloescht wird nur die **laufende** Sicht. Und
 * `grantRightOfWay`/`shareMap` verweigern jede Freigabe im Krieg — ein Zustand, den kein
 * Befehl herstellen darf, soll auch kein Krieg stehen lassen.
 *
 * Gilt fuer die wirksame Erklaerung **und** fuer den Ueberfall. Den zweiten Fall gab es vor
 * dem gerichteten Recht nicht: wer ueberfallen konnte, hatte nie ein Recht zu verlieren.
 * Jetzt kann A dem B gewaehren und B trotzdem ueberfallen — und ohne diese Zeile lebte As
 * Gewaehrung nach dem naechsten Frieden still wieder auf.
 */
function endTies(relation: Relation): void {
  relation.aGrantsPassage = false
  relation.bGrantsPassage = false
  relation.aPassageEndsAtTick = null
  relation.bPassageEndsAtTick = null
  relation.aSharesMap = false
  relation.bSharesMap = false
}

/** An army standing in someone's territory while not at war is an act of aggression. */
function detectSurpriseAttacks(draft: GameState, ctx: PhaseContext): void {
  for (const armyId of draft.armyOrder) {
    const army = draft.armies[armyId]
    if (!army) continue
    const province = draft.provinces[army.locationProvinceId]
    if (!province?.owner || province.owner === army.owner) continue

    const relation = draft.diplomacy.relations[relationKey(army.owner, province.owner)]
    if (!relation || relation.state === 'war') continue
    // Gerichtet (T-M17-04, R-DIP-08/AK1): der Gast ist die Armee, der Gewaehrende der
    // Besitzer der Provinz. Wer gewaehrt, darf damit **nicht** selbst hinein (Befund B1).
    if (grantsPassage(draft, province.owner, army.owner) || relation.state === 'alliance') continue

    // No declaration, but boots on foreign soil: war starts immediately and costs
    // standing. Forbidding the move outright would remove the interesting choice.
    relation.state = 'war'
    relation.sinceTick = draft.tick
    relation.warEffectiveAtTick = null
    endTies(relation)
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

/**
 * Die Reihenfolge im Tick (D29.3, T-M17-04): (1) Kriegserklaerungen treten in Kraft,
 * (2) abgelaufene Kuendigungsfristen raeumen ihre Richtung ab, (3) Ueberfaelle werden erkannt,
 * (4) **danach** verfallen Angebote. Bis T-M17-04 verfielen die Angebote vor den Ueberfaellen;
 * fuer diplomatische Angebote ist das gleichgueltig (keine der beiden Stufen liest, was die
 * andere schreibt), fuer die Handelsangebote aus T-M17-05 nicht — dort ist „Ueberfall und
 * Verfall im selben Tick" der Pflichtfall.
 */
export const diplomacy: Phase = (draft: GameState, ctx: PhaseContext) => {
  for (const [key, relation] of Object.entries(draft.diplomacy.relations)) {
    const [a, b] = key.split('|') as [PlayerId, PlayerId]

    // (1) Declarations coming into force.
    if (relation.warEffectiveAtTick !== null && draft.tick >= relation.warEffectiveAtTick) {
      relation.state = 'war'
      relation.sinceTick = draft.tick
      relation.warEffectiveAtTick = null
      endTies(relation)

      emit(ctx.events, draft.tick, 'DIPLOMACY_CHANGED', {
        playerId: a,
        targetPlayerId: b,
        newState: 'war',
        audience: [a, b],
      })
    }

    // (2) Eine abgelaufene Kuendigung raeumt ihre Richtung ab (R-DIP-08/AK3). `grantsPassage`
    // antwortet ab dem Tick der Frist ohnehin „nein"; aufgeraeumt wird trotzdem, damit der
    // Zustand kein Recht fuehrt, das nicht mehr gilt, und ein neues `grantRightOfWay` wieder
    // unbefristet beginnt.
    expirePassage(relation, a, b, draft.tick)
    expirePassage(relation, b, a, draft.tick)

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

  // (3)
  detectSurpriseAttacks(draft, ctx)

  // (4) Offers do not stay on the table forever — and how long they stay is a rule, not a
  // number in the code (Befund B3, `offerLifetimeDays`).
  // eslint-disable-next-line no-restricted-syntax -- days x ticks-per-day, plain integers
  const offerLifetime = ctx.rules.constants.offerLifetimeDays * ctx.rules.constants.ticksPerDay
  draft.diplomacy.offers = draft.diplomacy.offers.filter((offer) => draft.tick - offer.tick < offerLifetime)

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
