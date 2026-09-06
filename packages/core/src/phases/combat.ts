import { mulChain, quotFixed, type Fixed } from '@worldwar/shared'
import { emit } from '../events/emit'
import {
  applySpread,
  classShares,
  damageFor,
  defenceMultiplier,
  sideAttackValue,
} from '../rules/combat'
import { armyHp, pruneEmptyStacks } from '../state/army'
import type { Army, GameState, PlayerId, ProvinceId } from '../state/types'
import type { Phase, PhaseContext } from './index'

/**
 * Battle resolution (R-BAT-01/02/03/07, design D6.5).
 *
 * A battle has N sides, not two: three parties plus rebels in one province is normal
 * on a busy map. Every side fights everyone it is at war with, simultaneously.
 */

export function atWar(state: GameState, a: PlayerId, b: PlayerId): boolean {
  if (a === b) return false
  const key = a < b ? `${a}|${b}` : `${b}|${a}`
  return state.diplomacy.relations[key]?.state === 'war'
}

/** Armies that can fight here: present, not at sea, not empty. */
function combatantsIn(state: GameState, provinceId: ProvinceId): Army[] {
  return state.armyOrder
    .map((id) => state.armies[id]!)
    .filter((army) => army && army.locationProvinceId === provinceId && !army.embarked && army.units.length > 0)
}

/** Groups the armies present into sides — one per player, in player order. */
function sidesIn(state: GameState, armies: readonly Army[]): { player: PlayerId; armies: Army[] }[] {
  const byPlayer = new Map<PlayerId, Army[]>()
  for (const army of armies) {
    byPlayer.set(army.owner, [...(byPlayer.get(army.owner) ?? []), army])
  }
  return state.playerOrder
    .filter((id) => byPlayer.has(id))
    .map((player) => ({ player, armies: byPlayer.get(player)! }))
}

/** Distributes damage across a side's armies and stacks, proportional to strength. */
function applyDamage(side: { armies: Army[] }, damage: Fixed): Fixed {
  const total = side.armies.reduce((sum, army) => sum + armyHp(army), 0)
  if (total <= 0) return 0

  let dealt = 0
  for (const army of side.armies) {
    for (const stack of army.units) {
      const share = quotFixed(stack.hpTotal, total)
      const hit = Math.min(stack.hpTotal, mulChain([damage, share]))
      stack.hpTotal -= hit
      dealt += hit
    }
    pruneEmptyStacks(army)
  }
  return dealt
}

export const combat: Phase = (draft: GameState, ctx: PhaseContext) => {
  const { rules } = ctx
  const battles: GameState['battles'] = []

  for (const provinceId of draft.provinceOrder) {
    const present = combatantsIn(draft, provinceId)
    if (present.length < 2) continue

    const sides = sidesIn(draft, present)
    const fighting = sides.filter((side) => sides.some((other) => atWar(draft, side.player, other.player)))
    if (fighting.length < 2) continue

    const province = draft.provinces[provinceId]!

    // Damage is computed for every side first, then applied — so the outcome does not
    // depend on who is evaluated first (R-BAT "Seitentausch spiegelt das Ergebnis").
    const planned: { side: (typeof fighting)[number]; damage: Fixed }[] = []

    for (const side of fighting) {
      const enemies = fighting.filter((other) => atWar(draft, side.player, other.player))
      if (enemies.length === 0) continue

      // Wer unter Sperre steht, greift nicht an — getroffen wird er trotzdem (T-M14-07,
      // Befund 49). `cannotAttackUntil` wurde beim Rueckzug gesetzt und nur vom Beschuss
      // gelesen; der Nahkampf sah die Sperre nie, und eine Armee zog sich zurueck und
      // schlug im selben Tick wieder zu. Eine Sperre, die nur die Haelfte der Kampfarten
      // kennt, ist keine.
      const angriffsfaehig = side.armies.filter((army) => draft.tick >= army.cannotAttackUntil)
      if (angriffsfaehig.length === 0) continue

      const enemyArmies = enemies.flatMap((other) => other.armies)
      const shares = classShares(enemyArmies, rules)

      // Entrenched defenders fight with defence values and do not counter-attack;
      // a meeting engagement lets both sides use their attack values (belegt).
      const stationary = angriffsfaehig.every((army) => army.path.length === 0 && army.stance === 'defensive')
      const isDefender = stationary && province.owner === side.player

      const value = sideAttackValue(draft, angriffsfaehig, shares, isDefender, rules)
      const spread = applySpread(value, draft.rng, rules)

      // Split the blow across every enemy present, by their share of the strength —
      // otherwise a third party in the same province fights for free.
      const enemyTotal = enemyArmies.reduce((sum, army) => sum + armyHp(army), 0)
      if (enemyTotal <= 0) continue

      for (const enemy of enemies) {
        const enemyHp = enemy.armies.reduce((sum, army) => sum + armyHp(army), 0)
        if (enemyHp <= 0) continue

        // Die Festung gehoert dem Eigentuemer der Provinz, das Gelaende allen
        // (T-M14-07). Vorher bekam jede Seite beides — auch der Angreifer, der die
        // Festung gerade sturmt.
        const ownsProvince = province.owner === enemy.player
        const entrenched = ownsProvince && enemy.armies.every((army) => army.path.length === 0)
        const defence = defenceMultiplier(province, entrenched, rules, ownsProvince)

        const share = quotFixed(enemyHp, enemyTotal)
        const portion = mulChain([spread, share])
        planned.push({ side: enemy, damage: damageFor(portion, defence, rules) })
      }
    }

    const losses: Record<PlayerId, Fixed> = {}
    for (const entry of planned) {
      const dealt = applyDamage(entry.side, entry.damage)
      losses[entry.side.player] = (losses[entry.side.player] ?? 0) + dealt
    }

    // Battle morale: fighting wears a province down regardless of who wins.
    province.morale = Math.max(0, province.morale - rules.constants.battleMoraleLoss)

    const battleId = `b${draft.nextIds.battle++}`
    const parties = fighting.map((side) => side.player)
    battles.push({
      id: battleId,
      provinceId,
      sides: fighting.map((side) => [side.player]),
      startedTick: draft.tick,
    })

    // Der Beginn eines Gefechts, genau einmal (T-M15-01, R-TIME-06/AK3).
    //
    // `BATTLE_STARTED` stand seit M1 im Ereignistyp, in der Alarmliste und als Ziel des
    // Vorspulens — und wurde von keiner Zeile erzeugt. „Bis zum ersten Gefecht vorspulen"
    // lief deshalb stumm bis zur Obergrenze durch.
    //
    // Die Kampfliste wird in jedem Tick neu aufgebaut und bekommt dabei eine neue
    // `battleId`; ohne Entprellung gegen die Liste des Vortricks meldete ein Gefecht über
    // drei Ticks dreimal seinen Beginn, und das Vorspulen bliebe an derselben Schlacht
    // stehen, bis sie entschieden ist. Verglichen wird deshalb Ort und Beteiligung, nicht
    // die Kennung. Die Kennung selbst bleibt tickweise — sie wandert in den Zustand, und
    // eine Änderung an ihrer Vergabe wäre eine Änderung am Golden-Master.
    const wasFighting = draft.battles.some(
      (previous) =>
        previous.provinceId === provinceId &&
        previous.sides.flat().length === parties.length &&
        parties.every((player) => previous.sides.some((side) => side.includes(player))),
    )
    if (!wasFighting) {
      emit(ctx.events, draft.tick, 'BATTLE_STARTED', {
        battleId,
        provinceId,
        sides: fighting.map((side) => [side.player]),
        concerns: parties,
      })
    }

    const survivors = fighting.filter((side) => side.armies.some((army) => army.units.length > 0))
    const victor = survivors.length === 1 ? survivors[0]!.player : null

    emit(ctx.events, draft.tick, 'BATTLE_RESOLVED', {
      battleId,
      provinceId,
      losses,
      victor,
      concerns: parties,
    })

    // Remove armies that were wiped out entirely.
    for (const side of fighting) {
      for (const army of side.armies) {
        if (army.units.length > 0) continue
        emit(ctx.events, draft.tick, 'ARMY_DESTROYED', {
          playerId: army.owner,
          armyId: army.id,
          provinceId,
          audience: [army.owner],
        })
        delete draft.armies[army.id]
        draft.armyOrder = draft.armyOrder.filter((id) => id !== army.id)
      }
    }
  }

  draft.battles = battles
}
