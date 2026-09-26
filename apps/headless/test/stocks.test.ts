import type { GameEvent, ResourceKey } from '@worldwar/core'
import { RESOURCE_KEYS } from '@worldwar/core'
import { describe, expect, it } from 'vitest'
import {
  emptyStockEventCounts,
  formatStockSection,
  snapshotStocks,
  stockRows,
  tallyStockEvents,
  type StockSource,
} from '../src/stocks'

describe('Befund 58 Bestandstabelle des Langlaufs (T-M42-11)', () => {
  /** Baut einen vollstaendigen Rohstoff-Rekord, 0 als Vorgabe, Rest ueberschrieben. */
  const res = (partial: Partial<Record<ResourceKey, number>>): Record<ResourceKey, number> => {
    const full = {} as Record<ResourceKey, number>
    for (const key of RESOURCE_KEYS) full[key] = partial[key] ?? 0
    return full
  }

  it('T1 kopiert den Bestand statt ihn zu referenzieren', () => {
    const state: StockSource = {
      playerOrder: ['p2', 'p1'],
      players: {
        p1: { nation: 'Land1', resources: res({ food: 100 }) },
        p2: { nation: 'Land2', resources: res({ food: 200 }) },
      },
    }
    const snapshot = snapshotStocks(state)
    expect(snapshot.map((e) => e.playerId)).toEqual(['p2', 'p1'])

    // Der Snapshot ist eine Kopie: eine Aenderung am Original an Ort und Stelle darf
    // ihn nicht beruehren (in-place, wie es storeMemories/upkeep am Zustand tun).
    state.players.p1!.resources.food = 999
    expect(snapshot.find((e) => e.playerId === 'p1')!.resources.food).toBe(100)
  })

  it('T2 zeigt alle sieben Rohstoffe, auch ohne Bewegung', () => {
    const snap = snapshotStocks({
      playerOrder: ['p1'],
      players: { p1: { nation: 'Land', resources: res({ food: 1000, wood: 1000, iron: 1000, coal: 1000, oil: 1000, rare: 1000, money: 1000 }) } },
    })
    const rows = stockRows(snap, snap, res({}), emptyStockEventCounts())
    expect(rows).toHaveLength(7)
    expect(rows.map((r) => r.resource)).toEqual(RESOURCE_KEYS)
    const lines = formatStockSection(rows, 1000)
    for (const key of RESOURCE_KEYS) {
      const line = lines.find((l) => l.startsWith(`| ${key} |`))!
      expect(line).toContain('1.00')
    }
  })

  it('T3 summiert ueber alle Maechte, auch ausgeschiedene', () => {
    const start = snapshotStocks({
      playerOrder: ['p1', 'p2'],
      players: {
        p1: { nation: 'Land1', resources: res({ food: 1000 }) },
        p2: { nation: 'Land2', resources: res({ food: 1000 }) },
      },
    })
    const end = snapshotStocks({
      playerOrder: ['p1', 'p2'],
      players: {
        // p2 ist im Modell "ausgeschieden" - der Snapshot kennt `alive` absichtlich nicht.
        p1: { nation: 'Land1', resources: res({ food: 5000 }) },
        p2: { nation: 'Land2', resources: res({ food: 7000 }) },
      },
    })
    const rows = stockRows(start, end, res({}), emptyStockEventCounts())
    const food = rows.find((r) => r.resource === 'food')!
    expect(food.end).toBe(12000)
  })

  it('T4 findet den groessten Endbestand samt eigenem Verhaeltnis', () => {
    const start = snapshotStocks({
      playerOrder: ['a', 'b'],
      players: {
        a: { nation: 'A', resources: res({ food: 1000 }) },
        b: { nation: 'B', resources: res({ food: 2000 }) },
      },
    })
    const end = snapshotStocks({
      playerOrder: ['a', 'b'],
      players: {
        a: { nation: 'A', resources: res({ food: 4000 }) },
        b: { nation: 'B', resources: res({ food: 6000 }) },
      },
    })
    const rows = stockRows(start, end, res({}), emptyStockEventCounts())
    const food = rows.find((r) => r.resource === 'food')!
    expect(food.largestNation).toBe('B')
    expect(food.largestEnd).toBe(6000)
    expect(food.largestStart).toBe(2000)
    const line = formatStockSection(rows, 1).find((l) => l.startsWith('| food |'))!
    expect(line).toContain('6 (B)')
    expect(line).toContain('3.00')
  })

  it('T5 entscheidet Gleichstand streng, der erste in Reihenfolge gewinnt', () => {
    const snapA = snapshotStocks({
      playerOrder: ['a', 'b'],
      players: {
        a: { nation: 'A', resources: res({ food: 5000 }) },
        b: { nation: 'B', resources: res({ food: 5000 }) },
      },
    })
    const rows = stockRows(snapA, snapA, res({}), emptyStockEventCounts())
    expect(rows.find((r) => r.resource === 'food')!.largestNation).toBe('A')
  })

  it('T6 zeigt bei Start 0 einen Strich, nie Infinity oder NaN', () => {
    const start = snapshotStocks({
      playerOrder: ['a'],
      players: { a: { nation: 'A', resources: res({ food: 0 }) } },
    })
    const end = snapshotStocks({
      playerOrder: ['a'],
      players: { a: { nation: 'A', resources: res({ food: 5000 }) } },
    })
    const rows = stockRows(start, end, res({}), emptyStockEventCounts())
    const line = formatStockSection(rows, 1).find((l) => l.startsWith('| food |'))!
    expect(line).toContain('–')
    expect(line).not.toContain('Infinity')
    expect(line).not.toContain('NaN')
  })

  it('T7 kommt ohne Maechte aus', () => {
    const rows = stockRows([], [], res({}), emptyStockEventCounts())
    expect(rows).toHaveLength(7)
    for (const row of rows) {
      expect(row.largestNation).toBeNull()
    }
    const lines = formatStockSection(rows, 1)
    const foodLine = lines.find((l) => l.startsWith('| food |'))!
    // Jede Zelle einzeln pruefen, nicht nur "die Zeile enthaelt irgendwo einen Strich" -
    // sonst deckt der Bindestrich der Verhaeltnis-Spalte den fehlenden Waechter der
    // Endbestand-Spalte zu.
    const cells = foodLine.split('|').map((c) => c.trim())
    expect(cells[5]).toBe('–') // groesster Endbestand einer Macht
    expect(cells[6]).toBe('–') // Verhaeltnis dieser Macht
    expect(foodLine).toContain('–')
  })

  it('T8 zeigt die Lagergrenze, unbegrenzt bei null', () => {
    const limits = res({ rare: 500_000_000 })
    const withMoneyUnlimited: Record<ResourceKey, number | null> = { ...limits, money: null }
    const rows = stockRows([], [], withMoneyUnlimited, emptyStockEventCounts())
    const moneyLine = formatStockSection(rows, 1).find((l) => l.startsWith('| money |'))!
    expect(moneyLine).toContain('unbegrenzt')
    const rareLine = formatStockSection(rows, 1).find((l) => l.startsWith('| rare |'))!
    expect(rareLine).toContain('500000')
  })

  it('T9 zaehlt Lager-Ereignisse, addiert ueber mehrere Aufrufe', () => {
    const events: GameEvent[] = [
      { type: 'STORAGE_OVERFLOW', tick: 1, severity: 'info', audience: [], concerns: [], playerId: 'p1', resource: 'food', wasted: 10 } satisfies GameEvent,
      { type: 'STORAGE_OVERFLOW', tick: 2, severity: 'info', audience: [], concerns: [], playerId: 'p1', resource: 'food', wasted: 5 } satisfies GameEvent,
      { type: 'RESOURCE_SHORTAGE', tick: 3, severity: 'info', audience: [], concerns: [], playerId: 'p1', resource: 'money' } satisfies GameEvent,
      { type: 'TRADE_EXECUTED', tick: 4, severity: 'info', audience: [], concerns: [], playerId: 'p1', give: 'food', giveAmount: 1, want: 'wood', wantAmount: 1 } satisfies GameEvent,
    ]
    const counts = emptyStockEventCounts()
    tallyStockEvents(events, counts)
    // Exakter Vergleich, keine Stichprobe: ein TRADE_EXECUTED ohne `resource`-Feld darf
    // unter keinem Schluessel auftauchen, auch nicht unter einem, den RESOURCE_KEYS nicht
    // kennt (sonst deckt die Stichprobe je bekanntem Schluessel das Mitzaehlen zu).
    expect(counts).toEqual({
      overflow: res({ food: 2 }),
      shortage: res({ money: 1 }),
    })
    tallyStockEvents(events, counts)
    expect(counts).toEqual({
      overflow: res({ food: 4 }),
      shortage: res({ money: 2 }),
    })
  })

  it('T10 rechnet Festkomma in ganze Einheiten um, abgerundet', () => {
    const start = snapshotStocks({
      playerOrder: ['a'],
      players: { a: { nation: 'A', resources: res({ food: 999 }) } },
    })
    const end = snapshotStocks({
      playerOrder: ['a'],
      players: { a: { nation: 'A', resources: res({ food: 80_255_520 }) } },
    })
    const rows = stockRows(start, end, res({}), emptyStockEventCounts())
    const line = formatStockSection(rows, 1).find((l) => l.startsWith('| food |'))!
    expect(line).toContain('| 0 |')
    expect(line).toContain('80255')
  })

  it('T11 baut den Abschnitt formvertragsgetreu', () => {
    const rows = stockRows([], [], res({}), emptyStockEventCounts())
    const lines = formatStockSection(rows, 1000)
    expect(lines[0]).toBe('## Bestände nach 1000 Spieltagen (Befund 58)')
    expect(lines.some((l) => l.includes('Keine Schranke'))).toBe(true)
    const dataLines = lines.filter((l) => l.startsWith('| ') && !l.startsWith('| Rohstoff') && !l.startsWith('|---'))
    expect(dataLines).toHaveLength(7)
  })
})
