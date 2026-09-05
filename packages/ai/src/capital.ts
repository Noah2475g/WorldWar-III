import type { Command } from '@worldwar/core'
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

  const own = view.provinces.filter((province) => province.owner === playerId)
  if (own.length === 0) return []

  const current = view.self.capitalProvinceId
  const stillOurs = current !== null && own.some((province) => province.id === current)
  if (stillOurs) return []

  // Nur Städte kommen in Frage — dieselbe Regel, die auch für den Menschen gilt.
  const candidates = own.filter((province) => province.kind === 'city')
  if (candidates.length === 0) return []

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
