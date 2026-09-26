import { RESOURCE_KEYS, type GameEvent, type GameState, type Player, type ResourceKey, type Rules } from '@worldwar/core'

/**
 * Bestandstabelle des Langlaufs (Befund 58, T-M42-11).
 *
 * `longrun.slow.test.ts` sichert nur zu, dass jeder Bestand eine sichere ganze Zahl
 * und nicht negativ bleibt — nicht, wie weit die Vorraete wachsen. Diese Datei baut
 * die Tabelle, die genau das zeigt, aus reinen Funktionen: ein Schnappschuss der
 * Bestaende am Anfang und am Ende, eine Zaehlung der Lager-Meldungen dazwischen, und
 * eine Formatierung fuer `performance.md`. Keine Schranke — nur Messung.
 */

/** Der Bestand einer Macht zu einem Zeitpunkt, als Kopie. */
export interface StockEntry {
  readonly playerId: string
  readonly nation: string
  readonly resources: Readonly<Record<ResourceKey, number>>
}
export type StockSnapshot = readonly StockEntry[]

/** Schmaler Eingang, damit der schnelle Test ohne ganzen Spielstand auskommt. */
export type StockSource = Pick<GameState, 'playerOrder'> & {
  readonly players: Readonly<Record<string, Pick<Player, 'nation' | 'resources'>>>
}

/**
 * Kopiert die Bestaende aller Maechte in der Reihenfolge von `playerOrder`.
 *
 * Muss kopieren, nicht referenzieren: eine Referenz auf den Startzustand waere heute
 * harmlos, wuerde aber still falsch, sobald ein Schritt den Zustand an Ort und Stelle
 * aendert.
 */
export function snapshotStocks(state: StockSource): StockSnapshot {
  return state.playerOrder.map((playerId) => {
    const player = state.players[playerId]!
    return {
      playerId,
      nation: player.nation,
      resources: { ...player.resources },
    }
  })
}

export type StockEventCounts = Record<'overflow' | 'shortage', Record<ResourceKey, number>>

function zeroPerResource(): Record<ResourceKey, number> {
  const counts = {} as Record<ResourceKey, number>
  for (const key of RESOURCE_KEYS) counts[key] = 0
  return counts
}

export function emptyStockEventCounts(): StockEventCounts {
  return { overflow: zeroPerResource(), shortage: zeroPerResource() }
}

/** Zaehlt `STORAGE_OVERFLOW`- und `RESOURCE_SHORTAGE`-Ereignisse in `into` weiter (addiert, ueberschreibt nicht). */
export function tallyStockEvents(events: readonly GameEvent[], into: StockEventCounts): void {
  for (const event of events) {
    if (event.type === 'STORAGE_OVERFLOW') into.overflow[event.resource] += 1
    else if (event.type === 'RESOURCE_SHORTAGE') into.shortage[event.resource] += 1
  }
}

export interface StockRow {
  readonly resource: ResourceKey
  readonly start: number
  readonly end: number
  readonly largestNation: string | null
  readonly largestEnd: number
  readonly largestStart: number
  readonly storageLimit: number | null
  readonly overflowReports: number
  readonly shortageStarts: number
}

/** Baut eine Zeile je Rohstoff, Summe ueber alle Maechte der Partie, auch ausgeschiedene. */
export function stockRows(
  start: StockSnapshot,
  end: StockSnapshot,
  storageLimits: Rules['storageLimits'],
  counts: StockEventCounts,
): StockRow[] {
  const startByPlayer = new Map(start.map((entry) => [entry.playerId, entry]))

  return RESOURCE_KEYS.map((resource) => {
    const startSum = start.reduce((sum, entry) => sum + entry.resources[resource], 0)
    const endSum = end.reduce((sum, entry) => sum + entry.resources[resource], 0)

    let largest: StockEntry | null = null
    for (const entry of end) {
      if (largest === null || entry.resources[resource] > largest.resources[resource]) largest = entry
    }
    const largestStartEntry = largest ? startByPlayer.get(largest.playerId) : undefined

    return {
      resource,
      start: startSum,
      end: endSum,
      largestNation: largest?.nation ?? null,
      largestEnd: largest?.resources[resource] ?? 0,
      largestStart: largestStartEntry?.resources[resource] ?? 0,
      storageLimit: storageLimits[resource],
      overflowReports: counts.overflow[resource],
      shortageStarts: counts.shortage[resource],
    }
  })
}

const units = (fixed: number): number => Math.floor(fixed / 1000)
const ratio = (end: number, start: number): string => (start === 0 ? '–' : (end / start).toFixed(2))

/** Baut den Bericht-Abschnitt fuer `performance.md`, eine Zeile je Rohstoff. */
export function formatStockSection(rows: readonly StockRow[], days: number): string[] {
  const lines = [
    `## Bestände nach ${days} Spieltagen (Befund 58)`,
    '',
    'Summe über alle Mächte der Partie, auch ausgeschiedene; ganze Einheiten (Festkomma durch 1000, abgerundet). **Keine Schranke:** der Test sichert nur zu, dass jeder Bestand eine sichere ganze Zahl und nicht negativ bleibt. Wie weit die Vorräte wachsen, sagt diese Tabelle, nicht der Test. `STORAGE_OVERFLOW` meldet der Kern höchstens einmal je Macht, Rohstoff und Spieltag; `RESOURCE_SHORTAGE` meldet den Beginn eines Mangels.',
    '',
    '| Rohstoff | Start | Ende | Verhältnis | größter Endbestand einer Macht | Verhältnis dieser Macht | Lagergrenze je Macht | Lagerüberlauf-Meldungen | Mangel-Beginne |',
    '|---|---|---|---|---|---|---|---|---|',
  ]
  for (const row of rows) {
    const largest = row.largestNation === null ? '–' : `${units(row.largestEnd)} (${row.largestNation})`
    const largestRatio = row.largestNation === null ? '–' : ratio(row.largestEnd, row.largestStart)
    const limit = row.storageLimit === null ? 'unbegrenzt' : String(units(row.storageLimit))
    lines.push(
      `| ${row.resource} | ${units(row.start)} | ${units(row.end)} | ${ratio(row.end, row.start)} | ${largest} | ${largestRatio} | ${limit} | ${row.overflowReports} | ${row.shortageStarts} |`,
    )
  }
  return lines
}
