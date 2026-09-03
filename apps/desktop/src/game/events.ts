import type { GameEvent, MapData } from '@worldwar/core'
import { t } from '../i18n/text.ts'
import type { EventEntry } from '../ui/Panels.tsx'

/**
 * Turning an event into a sentence (T-M10-06, R-UI-07).
 *
 * Every event carries ids; the log has to carry names. The translation happens here so
 * that "PROVINCE_CAPTURED p2 DEU-NW" never reaches the player, and so that clicking a
 * line can jump to the place it is about.
 */

/** Fields that name a province, in the order they should be preferred. */
const PROVINCE_FIELDS = ['provinceId', 'targetProvinceId', 'fromProvinceId'] as const

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
 * Ids are swapped for names where the map knows one — a log that says "DEU-NW" makes
 * the player look it up, which is exactly the work the log exists to save.
 */
function valuesFor(event: GameEvent, map: MapData): Record<string, string | number> {
  const record = event as unknown as Record<string, unknown>
  const nameOf = (id: unknown): string =>
    typeof id === 'string' ? (map.provinces.find((p) => p.id === id)?.name ?? id) : ''

  const values: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === 'number') values[key] = value
    else if (typeof value === 'string') values[key] = value
  }

  const province = provinceOf(event)
  if (province) values.province = nameOf(province)
  if (typeof record.playerId === 'string') values.player = record.playerId
  if (typeof record.targetPlayerId === 'string') values.target = record.targetPlayerId
  if (typeof record.resource === 'string') values.resource = t(`resources.${record.resource}`)
  if (typeof record.building === 'string') values.building = record.building
  if (typeof record.armyId === 'string') values.army = record.armyId

  return values
}

export function describeEvent(event: GameEvent, index: number, map: MapData): EventEntry {
  const province = provinceOf(event)

  return {
    id: `${event.tick}-${event.type}-${index}`,
    tick: event.tick,
    text: t(`events.${event.type}`, valuesFor(event, map)),
    ...(province ? { provinceId: province } : {}),
    severity: event.severity === 'alert' ? 'alert' : 'info',
  }
}
