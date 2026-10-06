import { describe, expect, it } from 'vitest'
import { createInitialState, type Command, type GameConfig, type GameState } from '@worldwar/core'
import { TEST_RULES, smallWorld } from '@worldwar/testkit'
import { createLockstep, stateHash } from '../src/lockstep'
import { createLoopback } from '../src/loopback'
import type { CommandsMessage, NetMessage } from '../src/protocol'

/**
 * Liefervertrag im Gleichschritt (Liefervertrag B1, AK5): zwei Menschen, geplantes Angebot,
 * Annahme, mindestens eine weitere Lieferung, Kuendigung — und nach JEDEM Tick dieselbe
 * Pruefsumme auf beiden Seiten. Macht und Rohstoff stehen im Test (kein Laendername im Kern).
 */

const map = smallWorld()
const ctx = { map, rules: TEST_RULES }
const DAY = TEST_RULES.constants.ticksPerDay

const config: GameConfig = {
  seed: 2112,
  mapId: map.id,
  rulesId: TEST_RULES.id,
  players: [
    { name: 'Nordland', kind: 'human', nation: 'Nordland', color: 'farbe-eins' },
    { name: 'Ostmark', kind: 'human', nation: 'Ostmark', color: 'farbe-zwei' },
  ],
  victory: { condition: 'points', pointsShareToWin: 700, dayLimit: null },
}

function frisch(): GameState {
  const state = createInitialState(config, ctx)
  state.players['p1']!.resources.iron = 500_000
  state.players['p2']!.resources.money = 500_000
  return state
}

describe('Liefervertrag AK5 Zwei Menschen halten im Gleichschritt dieselbe Pruefsumme', () => {
  it('Angebot mit Zeitplan, Annahme, Lieferungen, Kuendigung — Hash beider Seiten je Tick gleich', () => {
    const leitung = createLoopback()
    const a = createLockstep({ seat: 'p1', seats: ['p1', 'p2'], state: frisch(), ctx, delayTicks: 2 })
    const b = createLockstep({ seat: 'p2', seats: ['p1', 'p2'], state: frisch(), ctx, delayTicks: 2 })
    const alsBefehle = (message: NetMessage): CommandsMessage => message as CommandsMessage
    leitung.b.onMessage((message) => b.receive('p1', alsBefehle(message)))
    leitung.a.onMessage((message) => a.receive('p2', alsBefehle(message)))

    let angeboten = false
    let angenommen = false
    let gekuendigt = false
    let lieferungen = 0
    const abweichung: string[] = []
    const gesehen = { offene: 0, vertraege: 0, beendet: 0 }

    for (let i = 0; i < 4 * DAY; i++) {
      const tick = a.tick
      // p1 bietet an (Tick 3), p2 nimmt an, sobald das Angebot im Zustand steht, p1 kuendigt nach einer 2. Lieferung.
      if (!angeboten && tick === 3) {
        a.give({
          type: 'OFFER_TRADE',
          playerId: 'p1',
          targetPlayerId: 'p2',
          give: { resources: { iron: 10_000 }, provinces: [] },
          want: { resources: { money: 4_000 }, provinces: [] },
          schedule: { intervalDays: 1, deliveries: 5 },
        } satisfies Command)
        angeboten = true
      }
      const offen = b.state.diplomacy.tradeOffers[0]
      if (angeboten && !angenommen && offen) {
        b.give({ type: 'ACCEPT_TRADE', playerId: 'p2', offerId: offen.id })
        angenommen = true
      }
      const vertrag = a.state.diplomacy.contracts[0]
      if (vertrag) lieferungen = Math.max(lieferungen, 4 - vertrag.remaining)
      if (vertrag && !gekuendigt && vertrag.remaining <= 3) {
        a.give({ type: 'CANCEL_CONTRACT', playerId: 'p1', contractId: vertrag.id })
        gekuendigt = true
      }

      leitung.a.send(a.emit())
      leitung.b.send(b.emit())
      const links = a.step()
      const rechts = b.step()
      if (!links.ran || !rechts.ran) break

      const h1 = stateHash(a.state)
      const h2 = stateHash(b.state)
      if (h1 !== h2) abweichung.push(`Tick ${links.tick}: ${h1} vs ${h2}`)
      gesehen.offene = Math.max(gesehen.offene, a.state.diplomacy.tradeOffers.length)
      gesehen.vertraege = Math.max(gesehen.vertraege, a.state.diplomacy.contracts.length)
      if (gekuendigt && a.state.diplomacy.contracts.length === 0) gesehen.beendet += 1
      expect(links.applied).toEqual(rechts.applied)
    }

    expect(abweichung, `Auseinandergelaufen:\n${abweichung.join('\n')}`).toEqual([])
    // Es ist wirklich etwas passiert (sonst waere der Gleichschritt an einer stehenden Welt belegt).
    expect(gesehen.offene, 'kein Angebot im Zustand').toBeGreaterThanOrEqual(1)
    expect(gesehen.vertraege, 'kein Vertrag entstanden').toBe(1)
    expect(lieferungen, 'keine weitere Lieferung vor der Kuendigung').toBeGreaterThanOrEqual(1)
    expect(gekuendigt, 'nicht gekuendigt').toBe(true)
    expect(a.state.diplomacy.contracts).toEqual([])
    expect(b.state.diplomacy.contracts).toEqual([])
    expect(a.state.nextIds.contract).toBe(2)
  }, 120_000)
})
