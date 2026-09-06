import type { GameEvent, MapData } from '@worldwar/core'
import { t } from '../i18n/text.ts'
import { amount } from '../ui/format.ts'
import { isWorldEventType } from '@worldwar/core'
import { categoryOf, type EventEntry } from '../ui/Panels.tsx'

/**
 * Turning an event into a sentence (T-M10-06, R-UI-07).
 *
 * Every event carries ids; the log has to carry names. The translation happens here so
 * that "PROVINCE_CAPTURED p2 DEU-NW" never reaches the player, and so that clicking a
 * line can jump to the place it is about.
 *
 * Names the map does not know — nations for player ids, army names — come from the
 * caller, because only the game state has them. Without them the ids are shown, which
 * is exactly the failure the tests refuse.
 */

/**
 * Fields that name a province, in the order they should be preferred. A march is
 * about where it goes, so the destination wins over the origin — for the sentence and
 * for the jump.
 */
const PROVINCE_FIELDS = ['provinceId', 'targetProvinceId', 'toProvinceId', 'fromProvinceId'] as const

export interface EventNaming {
  /** The nation behind a player id — "p2" is not a name a player knows. */
  player?: (id: string) => string
  /** The name of an army, for lines about marches and losses. */
  army?: (id: string) => string
  /** For turning a tick into a day where a text names one. */
  ticksPerDay?: number
  /**
   * Wer zusieht (T-M15-09, R-DIP-04).
   *
   * Ohne diese Angabe wird jedes Ereignis in der vollen Fassung erzählt — das ist die
   * sichere Richtung für Aufrufer, die keine Sicht haben (Tests, Werkzeuge). Der
   * Unterschied entsteht nur, wenn jemand *benannt* ist und es nicht der Betrachter ist.
   */
  viewer?: string
}

export function provinceOf(event: GameEvent): string | undefined {
  const record = event as unknown as Record<string, unknown>
  for (const field of PROVINCE_FIELDS) {
    const value = record[field]
    if (typeof value === 'string') return value
  }
  return undefined
}

/**
 * The values an event text needs, gathered from the event's own fields.
 *
 * Ids are swapped for names where anyone knows one — a log that says "DEU-NW" or "p2"
 * makes the player look it up, which is exactly the work the log exists to save.
 */
/** Ereignisarten, für die es eine Fassung aus fremder Sicht gibt. */
const FOREIGN_TEXTS = new Set(['DIPLOMACY_CHANGED', 'CAPITAL_LOST', 'BATTLE_RESOLVED', 'WAR_DECLARED'])

function valuesFor(event: GameEvent, map: MapData, naming: EventNaming): Record<string, string | number> {
  const record = event as unknown as Record<string, unknown>
  const provinceName = (id: unknown): string =>
    typeof id === 'string' ? (map.provinces.find((p) => p.id === id)?.name ?? id) : ''
  const playerName = (id: unknown): string =>
    typeof id === 'string' ? (naming.player?.(id) ?? id) : t('events_ui.nobody')

  const values: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === 'number' || typeof value === 'string') values[key] = value
  }

  const province = provinceOf(event)
  if (province) values.province = provinceName(province)

  const actor = record.newOwner ?? record.playerId
  if (typeof actor === 'string') values.player = playerName(actor)
  if (typeof record.targetPlayerId === 'string') values.target = playerName(record.targetPlayerId)
  if ('victor' in record || 'winner' in record) values.winner = playerName(record.victor ?? record.winner)

  // Die Verluste beider Seiten (T-M14-13, Befund 9). `losses` ist ein Objekt und fiel
  // aus der Schleife oben still heraus, die nur flache Werte übernimmt: der Spieler
  // erfuhr nach einem Gefecht nur, wer das Feld behauptet — nicht, was es gekostet hat.
  // R-BAT-07 verlangt den Bericht seit M4.
  if (record.losses && typeof record.losses === 'object') {
    const parts = Object.entries(record.losses as Record<string, number>)
      .filter(([, value]) => typeof value === 'number' && value > 0)
      .sort(([a], [b]) => a.localeCompare(b, 'de'))
      .map(([id, value]) => `${playerName(id)} ${amount(value)}`)
    values.losses = parts.length > 0 ? parts.join(', ') : t('events_ui.noLosses')
  }

  if (typeof record.resource === 'string') values.resource = t(`resources.${record.resource}`)
  if (typeof record.give === 'string') values.give = t(`resources.${record.give}`)
  if (typeof record.want === 'string') values.want = t(`resources.${record.want}`)
  if (typeof record.giveAmount === 'number') values.giveAmount = amount(record.giveAmount)
  if (typeof record.wantAmount === 'number') values.wantAmount = amount(record.wantAmount)

  if (typeof record.building === 'string') values.building = t(`buildings.${record.building}`)
  if (typeof record.unitKey === 'string') values.unit = t(`units.${record.unitKey}`)
  if (typeof record.armyId === 'string') values.army = naming.army?.(record.armyId) ?? record.armyId
  if (typeof record.newState === 'string') values.state = t(`diplomacy.${record.newState}`)
  if (event.type === 'COMMAND_REJECTED') values.reason = t(`rejections.${String(record.code)}`)

  if (typeof record.effectiveAtTick === 'number') {
    values.day = Math.floor(record.effectiveAtTick / (naming.ticksPerDay ?? 24)) + 1
  }

  return values
}

/**
 * Geht dieses Ereignis den Betrachter selbst an (T-M15-09)?
 *
 * Ein Ereignis ohne benannte Betroffene geht alle an — das ist die sichere Richtung: es
 * wird dann in der vollen Fassung erzählt, und die enthält nichts, was nicht ohnehin
 * öffentlich wäre. Umgekehrt wäre gefährlich.
 */
function concernsViewer(event: GameEvent, viewer: string | undefined): boolean {
  if (!viewer) return true
  return event.concerns.length === 0 || event.concerns.includes(viewer)
}

export function describeEvent(event: GameEvent, index: number, map: MapData, naming: EventNaming = {}): EventEntry {
  const province = provinceOf(event)

  // Aus fremder Sicht: eine kürzere Fassung ohne Mengen, wo es eine gibt (R-DIP-04).
  // Die Auswahl steht hier und nicht im Filter — sonst läge die Geheimhaltung an zwei
  // Stellen, und eine davon würde eines Tages vergessen.
  const fremd = !concernsViewer(event, naming.viewer)
  const key = fremd && FOREIGN_TEXTS.has(event.type) ? `${event.type}_FOREIGN` : event.type

  return {
    id: `${event.tick}-${event.type}-${index}`,
    tick: event.tick,
    category: categoryOf(event.type),
    world: isWorldEventType(event.type),
    text: t(`events.${key}`, valuesFor(event, map, naming)),
    ...(province ? { provinceId: province } : {}),
    severity: event.severity === 'alert' ? 'alert' : 'info',
  }
}
