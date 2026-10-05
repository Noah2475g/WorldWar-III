import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { advanceTicks } from '@worldwar/ai'
import {
  createInitialState,
  parseRules,
  publicView,
  RESOURCE_KEYS,
  type Command,
  type GameConfig,
  type GameEvent,
  type GameState,
  type MapData,
  type ResourceKey,
} from '@worldwar/core'
import { describe, expect, it } from 'vitest'

/**
 * Liefervertrag B2, AK7: eine echte Weltpartie belegt mindestens eine Lieferung.
 *
 * Aufbau (Plan §5 B2 Schritt 5): Weltkarte, Mensch = erste Macht in `playerOrder`, alle anderen KI.
 * Alles wird per Code gewaehlt, keine festen Laender-/Rohstoffannahmen (Oel wird spaeter neu verteilt):
 *  - Partner: die KI-Macht mit dem hoechsten `relationship`-Wert (aus ihrer eigenen Sicht auf den
 *    Menschen), ohne Krieg und ohne laufende Kriegserklaerung — Auswahlzeilen `waehlePartner`.
 *  - Gabe: der groesste Nicht-Geld-Bestand des Menschen; Menge 2 % davon, zwischen 1000 und
 *    `tradeMaxResource` — Auswahlzeilen `waehleGabe`.
 *  - Wunsch: Geld (der einzige Rohstoff mit Tagesbilanz in der KI-Sicht, P8), so viel, dass
 *    `Wert(Gabe) × 1000 >= Geld × Preis(Geld) × 1100` — Auswahlzeilen `rechneWunsch`.
 *  - Zeitplan `{intervalDays: 2, deliveries: 3}`; bis zu 15 Spieltage.
 * Lehnt die KI ab, wird ihre Erklaerung ausgegeben und der Test bleibt rot: keine Mengen drehen (R3).
 */

const ROOT = fileURLToPath(new URL('../../../', import.meta.url))
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

const SEED = 1914
const MAX_DAYS = 15
const INTERVAL_DAYS = 2
const DELIVERIES = 3
const SCHREIBEN = process.env['WORLDWAR_WRITE_REPORT'] === '1'

function config(): GameConfig {
  return {
    seed: SEED,
    mapId: map.id,
    rulesId: 'default',
    players: map.startPositions.slice(0, 8).map((start, index) => ({
      name: start.nation,
      kind: index === 0 ? ('human' as const) : ('ai' as const),
      nation: start.nation,
      color: ['#2C5F7C', '#7C3F2C', '#4A5D2C', '#5B3A6B', '#9FB2BE', '#C4A99C', '#6B5B3A', '#3A6B5B'][index]!,
      ...(index === 0 ? {} : { difficulty: (['easy', 'normal', 'hard'] as const)[index % 3]! }),
    })) as GameConfig['players'],
    victory: { condition: 'points', pointsShareToWin: 900, dayLimit: null },
  }
}

const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`)

const breathe = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

describe('Liefervertrag AK7: Weltpartie mit Mensch und sieben KI', () => {
  it('die KI nimmt den Vertrag an, und mindestens eine Lieferung folgt der Annahme', async () => {
    let state: GameState = createInitialState(config(), { map, rules })
    const human = state.playerOrder[0]!

    // waehlePartner: hoechster relationship-Wert der KI zum Menschen, ohne Krieg/Erklaerung.
    const relationship = (await import('@worldwar/ai')).relationship
    let partner: string | null = null
    let best = -1
    for (const id of state.playerOrder) {
      if (id === human) continue
      const relation = state.diplomacy.relations[pairKey(id, human)]
      if (relation && (relation.state === 'war' || relation.warEffectiveAtTick != null)) continue
      const view = publicView(state, id)
      const wert = relationship(view, human, view.self.grievances, rules).value
      if (wert > best) {
        best = wert
        partner = id
      }
    }
    expect(partner, 'kein KI-Partner ohne Krieg').not.toBeNull()

    // waehleGabe: groesster Nicht-Geld-Bestand des Menschen, 2 % davon.
    const stock = state.players[human]!.resources
    let give: ResourceKey | null = null
    for (const key of RESOURCE_KEYS) {
      if (key === 'money') continue
      if (give === null || stock[key] > stock[give]) give = key
    }
    expect(give).not.toBeNull()
    const giveAmount = Math.min(Math.trunc((stock[give!] * 2) / 100), rules.constants.tradeMaxResource)
    expect(giveAmount, 'Gabemenge unter 1000').toBeGreaterThanOrEqual(1000)

    // rechneWunsch: Geld so, dass Wert(Gabe) × 1000 >= Geld × Preis(Geld) × 1100.
    const prices = state.market.prices
    const wantMoney = Math.min(
      Math.floor((giveAmount * prices[give!] * 1000) / (prices.money * 1100)),
      rules.constants.tradeMaxMoney,
    )
    expect(wantMoney).toBeGreaterThan(0)
    expect(giveAmount * prices[give!] * 1000).toBeGreaterThanOrEqual(wantMoney * prices.money * 1100)

    const offer: Command = {
      type: 'OFFER_TRADE',
      playerId: human,
      targetPlayerId: partner!,
      give: { resources: { [give!]: giveAmount }, provinces: [] },
      want: { resources: { money: wantMoney }, provinces: [] },
      schedule: { intervalDays: INTERVAL_DAYS, deliveries: DELIVERIES },
    }

    const events: GameEvent[] = []
    const ablehnungen: string[] = []
    let annahmeTick: number | null = null
    let remainingBeiAnnahme = 0
    let letzterRest = 0
    let schliessgrund: string | null = null
    let vertragId: string | null = null

    for (let hour = 0; hour < MAX_DAYS * rules.constants.ticksPerDay; hour++) {
      const chunk = advanceTicks(
        state,
        1,
        { map, rules },
        { explain: true, ...(hour === 0 ? { playerCommands: [offer] } : {}) },
      )
      state = chunk.state
      events.push(...chunk.events)

      const rejected = chunk.events.find((e) => e.type === 'COMMAND_REJECTED' && e.playerId === human)
      if (rejected) throw new Error(`Angebot abgelehnt: ${JSON.stringify(rejected)}`)

      for (const e of chunk.explanations[partner!] ?? []) {
        if (/Angebot .* ab$/.test(e.action)) ablehnungen.push(`Tick ${state.tick}: ${e.action}: ${e.reason}`)
      }

      const contract = state.diplomacy.contracts.find((c) => c.from === human || c.to === human)
      if (contract && annahmeTick === null) {
        annahmeTick = state.tick
        vertragId = contract.id
        remainingBeiAnnahme = contract.remaining
      }
      if (contract) letzterRest = contract.remaining

      const closed = chunk.events.find((e) => e.type === 'CONTRACT_CLOSED' && e.contractId === vertragId)
      if (closed && closed.type === 'CONTRACT_CLOSED') {
        schliessgrund = closed.reason
        if (closed.reason === 'completed') letzterRest = 0
        break
      }
      if (hour % rules.constants.ticksPerDay === 0) await breathe()
    }

    const lieferungenNachAnnahme = remainingBeiAnnahme - letzterRest
    const bericht = {
      gemessenAm: new Date().toISOString().slice(0, 10),
      measuredAtCommit: execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(),
      seed: SEED,
      partner,
      gabe: give,
      gabeMenge: giveAmount,
      wunschGeld: wantMoney,
      zeitplan: { intervalDays: INTERVAL_DAYS, deliveries: DELIVERIES },
      annahmeTick,
      annahmeTag: annahmeTick === null ? null : Math.trunc(annahmeTick / rules.constants.ticksPerDay),
      lieferungenNachAnnahme,
      schliessgrund,
      ablehnungen,
    }
    console.log(JSON.stringify(bericht, null, 2))
    if (SCHREIBEN) {
      mkdirSync(`${ROOT}docs/reports`, { recursive: true })
      writeFileSync(`${ROOT}docs/reports/liefervertrag.json`, `${JSON.stringify(bericht, null, 2)}\n`)
    }

    expect(annahmeTick, `KI hat nicht angenommen: ${ablehnungen.join(' | ')}`).not.toBeNull()
    expect(lieferungenNachAnnahme, 'keine Lieferung nach der Annahme').toBeGreaterThanOrEqual(1)
  })
})
