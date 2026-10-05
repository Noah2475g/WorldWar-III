import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { advanceTicks } from '@worldwar/ai'
import {
  HASH_OMIT_KEYS,
  RESOURCE_KEYS,
  SCHEMA_VERSION,
  createInitialState,
  deserialise,
  parseRules,
  serialise,
  type Command,
  type GameConfig,
  type MapData,
  type ResourceKey,
} from '@worldwar/core'
import { hashValue } from '@worldwar/shared'
import { describe, expect, it } from 'vitest'

/**
 * Das Rezept fuer `packages/core/test/golden/save-v4.json` (Liefervertrag B1, Plan A12).
 *
 * Der eingefrorene Stand der Stufe 4 ist eine gespielte Partie: Weltkarte, acht Maechte,
 * Startzahl 1917, **30 Spieltage** (Tick 720). Der Mensch ist die erste Macht in `playerOrder`
 * (kein Laendername im Code), alle anderen fuehrt die KI. Im letzten Tick (719) schickt der
 * Mensch ein `OFFER_TRADE` OHNE `schedule`: Gabe = sein groesster Nicht-Geld-Bestand, 1 % davon
 * (mindestens 1000), Wunsch = Geld 1000, an die erste KI-Macht ohne Krieg. Der Stand traegt
 * damit mindestens ein offenes Handelsangebot — das, was der Schritt 4 → 5 mitnehmen muss.
 *
 * **Dieser Lauf gilt nur, solange `SCHEMA_VERSION` 4 ist.** Er wird mit dem Schritt auf Stufe 5
 * entfernt; ein eingefrorener Stand wird nie neu erzeugt. Mit `FREEZE_V4=1` schreibt der Lauf
 * die Datei, ohne vergleicht er sie.
 */

const ROOT = fileURLToPath(new URL('../../../', import.meta.url))
const FROZEN = `${ROOT}packages/core/test/golden/save-v4.json`
const LABEL = 'Eingefroren am 2026-10-05 als Beleg für den Migrationsschritt 4 → 5 (Liefervertrag B1)'
const load = (path: string): never => JSON.parse(readFileSync(`${ROOT}${path}`, 'utf8')) as never
const map = load('data/maps/world.json') as MapData
const rules = parseRules(
  {
    constants: load('data/rules/default/constants.json'),
    resources: load('data/rules/default/resources.json'),
    buildings: load('data/rules/default/buildings.json'),
    units: load('data/rules/default/units.json'),
    ai: load('data/rules/default/ai.json'),
  },
  'default',
)

const DAYS = 30

const config: GameConfig = {
  seed: 1917,
  mapId: map.id,
  rulesId: 'default',
  players: map.startPositions.slice(0, 8).map((start, index) => ({
    name: start.nation,
    kind: index === 0 ? ('human' as const) : ('ai' as const),
    nation: start.nation,
    color: ['#2C5F7C', '#7C3F2C', '#4A5D2C', '#5B3A6B', '#9FB2BE', '#C4A99C', '#6B5B3A', '#3A6B5B'][index]!,
    ...(index === 0 ? {} : { difficulty: (['easy', 'normal', 'hard'] as const)[index % 3]! }),
  })),
  victory: { condition: 'points', pointsShareToWin: 900, dayLimit: null },
}

describe('Liefervertrag B1: save-v4.json entsteht zeichengleich aus seinem Rezept', () => {
  it('spielt 30 Spieltage und vergleicht (oder schreibt) den eingefrorenen Stand', async () => {
    expect(SCHEMA_VERSION, 'das Rezept gilt nur auf Stufe 4 — siehe Kopfkommentar').toBe(4)

    let state = createInitialState(config, { map, rules })
    const lastTick = DAYS * rules.constants.ticksPerDay - 1
    for (let day = 0; day < DAYS; day++) {
      const ticks = day === DAYS - 1 ? rules.constants.ticksPerDay - 1 : rules.constants.ticksPerDay
      state = advanceTicks(state, ticks, { map, rules }).state
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
    expect(state.tick).toBe(lastTick)

    // Macht und Rohstoff werden hier per Code gewaehlt (Zeilen: human/partner/resource).
    const human = state.playerOrder[0]!
    const partner = state.playerOrder.find(
      (id) => id !== human && state.players[id]!.alive && state.diplomacy.relations[[human, id].sort().join('|')]?.state !== 'war',
    )
    expect(partner, 'keine KI-Macht ohne Krieg').toBeDefined()
    const stock = state.players[human]!.resources
    let resource: ResourceKey | null = null
    for (const key of RESOURCE_KEYS) {
      if (key === 'money') continue
      if (resource === null || stock[key] > stock[resource]) resource = key
    }
    const amount = Math.min(rules.constants.tradeMaxResource, Math.max(1000, Math.floor(stock[resource!] / 100)))
    expect(stock[resource!]).toBeGreaterThanOrEqual(amount)
    const offer: Command = {
      type: 'OFFER_TRADE',
      playerId: human,
      targetPlayerId: partner!,
      give: { resources: { [resource!]: amount }, provinces: [] },
      want: { resources: { money: 1000 }, provinces: [] },
    }
    const chunk = advanceTicks(state, 1, { map, rules }, { scripted: (tick) => (tick === lastTick ? [offer] : []) })
    state = chunk.state
    expect(chunk.events.filter((event) => event.type === 'COMMAND_REJECTED' && event.playerId === human)).toEqual([])
    expect(state.tick).toBe(DAYS * rules.constants.ticksPerDay)
    expect(state.diplomacy.tradeOffers.length, 'kein offenes Handelsangebot').toBeGreaterThanOrEqual(1)

    const text = serialise(state, LABEL)
    expect(hashValue(deserialise(text), { omitKeys: HASH_OMIT_KEYS })).toBe(hashValue(state, { omitKeys: HASH_OMIT_KEYS }))

    const pretty = JSON.stringify(JSON.parse(text), null, 2) + '\n'
    if (process.env['FREEZE_V4'] === '1') writeFileSync(FROZEN, pretty)
    const frozen = readFileSync(FROZEN, 'utf8')
    expect(frozen === pretty, 'save-v4.json entsteht nicht zeichengleich aus dem Rezept').toBe(true)

    const envelope = JSON.parse(frozen) as { schemaVersion: number; savedAtTick: number; hash: string; state: unknown }
    expect(envelope.schemaVersion).toBe(4)
    expect(envelope.savedAtTick).toBe(state.tick)
    expect(hashValue(envelope.state, { omitKeys: HASH_OMIT_KEYS })).toBe(envelope.hash)
  })
})
