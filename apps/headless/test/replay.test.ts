import { TEST_RULES, placeArmy, smallWorld } from '@worldwar/testkit'
import { describe, expect, it } from 'vitest'
import { recordGame, replayGame } from '../src/replay'

const map = smallWorld()
const rules = TEST_RULES

const CONFIG = {
  seed: 808,
  mapId: 'testworld',
  rulesId: 'default',
  players: [
    { name: 'A', kind: 'ai' as const, nation: 'Nordland', color: '#0f62bc', difficulty: 'normal' as const },
    { name: 'B', kind: 'ai' as const, nation: 'Ostmark', color: '#b03a2e', difficulty: 'hard' as const },
  ],
  victory: { condition: 'points' as const, pointsShareToWin: 900, dayLimit: null },
}

const setup = (state: Parameters<NonNullable<Parameters<typeof recordGame>[0]['setup']>>[0]) => {
  state.diplomacy.relations['p1|p2']!.state = 'war'
  placeArmy(state, { owner: 'p1', at: 'n2', units: [{ unitKey: 'infantry', hpTotal: 15_000 }] })
}

describe('R-ARCH-03 Aufzeichnen und Wiedergeben', () => {
  it('reproduziert den Endzustand aus Seed und Kommandolog', () => {
    // Everything the AI did is in the log, because AI orders are ordinary commands.
    const { recording } = recordGame({ config: CONFIG, map, rules, ticks: 240, setup })
    const replayed = replayGame(recording, map, rules, setup)
    expect(replayed.matches).toBe(true)
  })

  it('zeichnet die Kommandos mit ihrem Zeitpunkt auf', () => {
    const { recording } = recordGame({ config: CONFIG, map, rules, ticks: 100, setup })
    expect(recording.commands.length).toBeGreaterThan(0)
    for (const entry of recording.commands) {
      expect(entry.tick).toBeGreaterThanOrEqual(0)
      expect(entry.command.playerId).toBeTruthy()
    }
  })

  it('faellt auf, wenn die Wiedergabe abweicht', () => {
    const { recording } = recordGame({ config: CONFIG, map, rules, ticks: 120, setup })
    // Replaying without the same starting arrangement must not silently "work".
    const wrong = replayGame(recording, map, rules)
    expect(wrong.matches).toBe(false)
  })

  it('ist als JSON ablegbar', () => {
    const { recording } = recordGame({ config: CONFIG, map, rules, ticks: 60, setup })
    const revived = JSON.parse(JSON.stringify(recording))
    expect(replayGame(revived, map, rules, setup).matches).toBe(true)
  })
})
