import { CAPITAL_MOVE_COOLDOWN_DAYS, type Command } from '@worldwar/core'
import type { AiContext, Explanation } from './types'

/**
 * Eine neue Hauptstadt, wenn die alte verloren ist (T-M14-12, Befund 12).
 *
 * `SET_CAPITAL` wurde von keiner Zeile in `packages/ai` erzeugt. Für die KI hieß das: Wer
 * seine Hauptstadt verliert, hat für den Rest der Partie keine — und die Entfernungsstrafe
 * auf die Moral rechnet gegen `capitalProvinceId`, also trifft sie **jede** Provinz mit
 * ihrem vollen Betrag. Eine Macht, der einmal die Hauptstadt genommen wurde, erholt sich
 * nie wieder; sie fällt bis zum Aufstand durch. Der Mensch kann verlegen, die KI nicht:
 * ein Bruch von R-AI-01 in die andere Richtung.
 *
 * Die Wahl ist bewusst schlicht — die volkreichste eigene Stadt. Wer eine bessere Regel
 * will, braucht erst eine Messung, dass die schlichte nicht genügt.
 */
export function capitalCommands(context: AiContext, explanations: Explanation[]): Command[] {
  const { view } = context
  const playerId = view.playerId

  // Nur, was sie sieht (Durchsicht N2, wie T-M41-09 in `economy.ts`): eine erinnerte Provinz (`stale`)
  // trägt den Besitzer von damals. Eigene Provinzen sind immer sichtbar — eine erinnerte „eigene"
  // ist verloren, und ein Verlegen dorthin lehnte der Kern mit NOT_OWNER ab, jeden Denkschritt neu.
  const own = view.provinces.filter((province) => province.owner === playerId && !province.stale)
  if (own.length === 0) return []

  const current = view.self.capitalProvinceId
  const stillOurs = current !== null && own.some((province) => province.id === current)
  if (stillOurs) return []

  // Nur Städte kommen in Frage — dieselbe Regel, die auch für den Menschen gilt.
  const candidates = own.filter((province) => province.kind === 'city')
  if (candidates.length === 0) return []

  // **Die Sperre des Verlegens** (T-M41-11). Der Kern lehnt ein neues Verlegen bis
  // `CAPITAL_MOVE_COOLDOWN_DAYS` nach dem letzten mit ON_COOLDOWN ab. Die Sicht führte die Sperre
  // nicht, und die KI befahl jeden Tag neu — 298-mal in einem Turnierlauf, 72-mal auf der Weltkarte.
  const movedAt = view.self.capitalMovedAtTick
  const readyAt =
    movedAt === null ? null : movedAt + CAPITAL_MOVE_COOLDOWN_DAYS * context.rules.constants.ticksPerDay
  if (readyAt !== null && view.tick < readyAt) {
    explanations.push({
      action: 'Verlegt die Hauptstadt noch nicht',
      reason: `Sperre des Verlegens bis Tick ${readyAt}`,
      score: 0,
    })
    return []
  }

  // Die volkreichste; bei Gleichstand die mit der kleineren Kennung, damit dieselbe Lage
  // denselben Befehl ergibt (R-ARCH-01).
  const best = [...candidates].sort(
    (a, b) => (b.population ?? 0) - (a.population ?? 0) || a.id.localeCompare(b.id, 'en'),
  )[0]!

  explanations.push({
    action: `Verlegt die Hauptstadt nach ${best.id}`,
    reason: current === null ? 'ohne Hauptstadt trifft die Entfernungsstrafe jede Provinz voll' : 'die alte Hauptstadt ist verloren',
    score: 900,
  })

  return [{ type: 'SET_CAPITAL', playerId, provinceId: best.id } as Command]
}
