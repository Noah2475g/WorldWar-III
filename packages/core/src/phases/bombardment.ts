import { mulChain, quotFixed } from '@worldwar/shared'
import { armyRange, provincesInRange } from '../commands/bombard'
import { emit } from '../events/emit'
import { applySpread, classShares, damageFor, defenceMultiplier, sideAttackValue } from '../rules/combat'
import { armyHp, pruneEmptyStacks } from '../state/army'
import type { Army, GameState, ProvinceId } from '../state/types'
import { atWar } from './combat'
import type { Phase, PhaseContext } from './index'

/**
 * Beschuss — von Hand befohlen und selbsttätig (R-BAT-06, R-BAT-08, T-M15-07).
 *
 * **Eine eigene Phase, direkt vor dem Nahkampf**, und das ist die Behebung von Befund 52.
 * Bis zum 2026-09-06 wirkte `BOMBARD` als Kommando sofort in Phase 1, während der Nahkampf
 * in Phase 8 aufgelöst wird: der Beschuss traf, bevor Bewegung und Kampf desselben Ticks
 * stattgefunden hatten, und eine Armee, die in diesem Tick abmarschierte, wurde noch am
 * alten Ort getroffen. Solange es nur den Handbeschuss gab, war das in sich stimmig und
 * der Umbau nicht die Golden-Master wert (T-M14-07 hat ihn deshalb bewusst vertagt).
 *
 * Mit der Feuerautomatik ist er unausweichlich: sie ist ihrer Natur nach eine Phase, keine
 * Handlung. Läge sie woanders als der Handbeschuss, hätte **dieselbe Kanone zwei Regeln,
 * je nachdem, wer abdrückt.**
 *
 * `BOMBARD` setzt seither nur noch eine Absicht (`army.bombardTarget`); aufgelöst wird sie
 * hier, zusammen mit dem selbsttätigen Feuer, mit demselben Code und zum selben Zeitpunkt.
 */

/** Was eine Armee braucht, um in diesem Tick überhaupt schießen zu können. */
function canFire(state: GameState, army: Army, ctx: PhaseContext): boolean {
  if (army.units.length === 0) return false
  if (army.embarked) return false
  // Stehend: wer marschiert, richtet keine Geschütze ein.
  if (army.path.length > 0) return false
  if (state.tick < army.cannotAttackUntil) return false
  return armyRange(army, ctx.rules) > 0
}

/**
 * Das Ziel der Feuerautomatik: die erreichbare Feindprovinz mit der größten **sichtbaren**
 * Truppenstärke; bei Gleichstand die kleinere Provinzkennung.
 *
 * Der Gleichstand ist keine Randnotiz: ohne feste Regel hinge das Ziel an der Reihenfolge,
 * in der die Armeen zufällig im Record stehen, und zwei Läufe mit demselben Seed gäben
 * verschiedene Ergebnisse (R-ARCH-01).
 */
export function automaticTarget(state: GameState, army: Army, ctx: PhaseContext): ProvinceId | null {
  const range = armyRange(army, ctx.rules)
  if (range <= 0) return null

  const reachable = provincesInRange(state, army.locationProvinceId, range, ctx.map)

  let best: ProvinceId | null = null
  let bestStrength = -1

  // Über provinceOrder statt über das Set: dieselbe Lage muss dieselbe Reihenfolge ergeben.
  for (const id of state.provinceOrder) {
    if (!reachable.has(id)) continue
    const province = state.provinces[id]!
    if (!province.owner || !atWar(state, army.owner, province.owner)) continue

    let strength = 0
    for (const armyId of state.armyOrder) {
      const other = state.armies[armyId]!
      if (other.locationProvinceId !== id) continue
      if (!atWar(state, army.owner, other.owner)) continue
      strength += armyHp(other)
    }
    if (strength === 0) continue

    if (strength > bestStrength || (strength === bestStrength && best !== null && id < best)) {
      bestStrength = strength
      best = id
    }
  }

  return best
}

/**
 * Den Beschuss einer Armee auf eine Provinz auflösen.
 *
 * Dieselbe Rechnung für Hand und Automatik — der ganze Grund, warum diese Funktion
 * existiert und nicht zweimal dasteht.
 */
export function resolveBombardment(
  draft: GameState,
  army: Army,
  targetProvinceId: ProvinceId,
  ctx: PhaseContext,
  automatic: boolean,
): void {
  const province = draft.provinces[targetProvinceId]
  if (!province) return

  // Getroffen wird, mit wem man im Krieg ist — nicht jeder, der zufällig hier steht
  // (T-M14-07, Befund 51). Die Reichweitenprüfung sieht nur, wem die *Provinz* gehört.
  const defenders = draft.armyOrder
    .map((id) => draft.armies[id]!)
    .filter(
      (other) =>
        other.locationProvinceId === targetProvinceId &&
        other.owner !== army.owner &&
        atWar(draft, army.owner, other.owner),
    )

  if (defenders.length === 0) {
    province.morale = Math.max(0, province.morale - ctx.rules.constants.battleMoraleLoss)
    emit(ctx.events, draft.tick, 'BOMBARDMENT', {
      playerId: army.owner,
      armyId: army.id,
      targetProvinceId,
      damage: 0,
      automatic,
      audience: [army.owner],
    })
    return
  }

  const shares = classShares(defenders, ctx.rules)
  const value = sideAttackValue(draft, [army], shares, false, ctx.rules)
  const spread = applySpread(value, draft.rng, ctx.rules)
  const defence = defenceMultiplier(province, true, ctx.rules)

  // Ranged fire is deliberately weaker than closing with the enemy.
  const damage = mulChain([damageFor(spread, defence, ctx.rules), ctx.rules.constants.bombardFactor])

  const total = defenders.reduce((sum, other) => sum + armyHp(other), 0)
  let dealt = 0
  for (const defender of defenders) {
    for (const stack of defender.units) {
      const share = quotFixed(stack.hpTotal, total)
      const hit = Math.min(stack.hpTotal, mulChain([damage, share]))
      stack.hpTotal -= hit
      dealt += hit
    }
    pruneEmptyStacks(defender)
  }

  army.cannotAttackUntil = draft.tick + 1

  // Eine ausgelöschte Armee verschwindet, statt als leere Hülle liegen zu bleiben
  // (T-M14-07, Befund 53): eine Hülle ohne Einheiten hält ihren Besitzer am Leben, und
  // eine Partie käme nie zu einem Sieger.
  for (const defender of defenders) {
    if (defender.units.length > 0) continue
    emit(ctx.events, draft.tick, 'ARMY_DESTROYED', {
      playerId: defender.owner,
      armyId: defender.id,
      provinceId: targetProvinceId,
      audience: [defender.owner],
    })
    delete draft.armies[defender.id]
    draft.armyOrder = draft.armyOrder.filter((id) => id !== defender.id)
  }

  emit(ctx.events, draft.tick, 'BOMBARDMENT', {
    playerId: army.owner,
    armyId: army.id,
    targetProvinceId,
    damage: dealt,
    automatic,
    audience: [army.owner],
  })
}

export const bombardment: Phase = (draft: GameState, ctx: PhaseContext) => {
  // Über armyOrder, nicht über Object.keys(draft.armies): die Reihenfolge gehört in den
  // Zustand, nicht in die Einfügereihenfolge eines Records (R-ARCH-01).
  for (const armyId of [...draft.armyOrder]) {
    const army = draft.armies[armyId]
    if (!army) continue

    // Die befohlene Absicht hat Vorrang und wird in jedem Fall verbraucht — auch wenn sie
    // sich nicht mehr ausführen lässt. Ein Ziel, das liegen bleibt, würde in jedem
    // folgenden Tick erneut geschossen, ohne dass der Spieler es noch einmal befohlen hat.
    const ordered = army.bombardTarget
    army.bombardTarget = null

    if (!canFire(draft, army, ctx)) continue

    if (ordered) {
      const range = armyRange(army, ctx.rules)
      const stillInRange = provincesInRange(draft, army.locationProvinceId, range, ctx.map).has(ordered)
      const target = draft.provinces[ordered]
      if (stillInRange && target?.owner && atWar(draft, army.owner, target.owner)) {
        resolveBombardment(draft, army, ordered, ctx, false)
      }
      continue
    }

    // R-BAT-08: Feuer frei, solange nichts anderes befohlen ist. „Feuer halten" ist die
    // Ausnahme und muss gesetzt werden — eine Artilleriearmee, die stumm an der Front
    // steht, wäre der Normalfall gewesen, und niemand hätte den Unterschied gemerkt.
    if (army.holdFire) continue

    const target = automaticTarget(draft, army, ctx)
    if (target) resolveBombardment(draft, army, target, ctx, true)
  }
}
