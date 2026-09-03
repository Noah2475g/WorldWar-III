import type { GameEvent, MapData } from '@worldwar/core'
import { t } from '../i18n/text.ts'
import { amount } from '../ui/format.ts'
import type { EventEntry } from '../ui/Panels.tsx'

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

export function describeEvent(event: GameEvent, index: number, map: MapData, naming: EventNaming = {}): EventEntry {
  const province = provinceOf(event)

  return {
    id: `${event.tick}-${event.type}-${index}`,
    tick: event.tick,
    text: t(`events.${event.type}`, valuesFor(event, map, naming)),
    ...(province ? { provinceId: province } : {}),
    severity: event.severity === 'alert' ? 'alert' : 'info',
  }
}
