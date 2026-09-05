import { TEST_RULES, smallWorld } from '@worldwar/testkit'
import {
  HASH_OMIT_KEYS,
  createInitialState,
  deserialise,
  runTicks,
  serialise,
  type Command,
  type GameConfig,
  type GameState,
} from '@worldwar/core'
import { hashValue } from '@worldwar/shared'
import { describe, expect, it } from 'vitest'
import { advanceTicks } from './loop'
import { runAi, storeMemories } from './runner'

/**
 * Die eine Spielschleife (T-M14-04).
 *
 * Vorher gab es vier Fassungen, und sie beschrieben verschiedene Spiele: die Tagesfassung
 * des Parameterlaufs fragte die KI einmal je Spieltag und wandte dasselbe Befehlspaket auf
 * alle 24 Ticks an. Das ist nicht nur eine zweite Schleife — es schaltet die KI der
 * meisten Mächte ab, weil `shouldThinkThisTick` die Denkzeit über `tick % aiCount`
 * verteilt und `tick` dort immer ein Vielfaches von 24 ist.
 */

const map = smallWorld()

/** Derselbe Hash, den der Spielstand fuehrt: das Ereignisprotokoll zaehlt nicht mit. */
const stateHash = (state: GameState) => hashValue(state, { omitKeys: HASH_OMIT_KEYS })
const ctx = { map, rules: TEST_RULES }

function stateWith(aiCount: number): GameState {
  const nations = map.startPositions.slice(0, aiCount).map((s) => s.nation)
  const config: GameConfig = {
    seed: 7,
    mapId: 'testworld',
    rulesId: 'default',
    players: nations.map((nation, i) => ({
      name: nation,
      kind: 'ai' as const,
      nation,
      color: ['#0f62bc', '#b03a2e', '#2e7d32', '#6a1b9a', '#ef6c00', '#00838f'][i]!,
      difficulty: 'normal' as const,
    })),
    victory: { condition: 'points', pointsShareToWin: 900, dayLimit: null },
  }
  const state = createInitialState(config, ctx)
  // Alle gegen alle: eine Welt im Frieden misst nichts.
  for (let i = 0; i < state.playerOrder.length; i++) {
    for (let j = i + 1; j < state.playerOrder.length; j++) {
      const key = `${state.playerOrder[i]}|${state.playerOrder[j]}`
      if (state.diplomacy.relations[key]) state.diplomacy.relations[key]!.state = 'war'
    }
  }
  return state
}

describe('R-AI-01 Eine Spielschleife fuer alle', () => {
  it('laesst jede Macht handeln, nicht nur die erste', () => {
    // Die Tagesschleife des Parameterlaufs liess bei sechs Maechten nur eine denken.
    const state = stateWith(6)
    const ticksPerDay = TEST_RULES.constants.ticksPerDay
    const denker = new Set<string>()

    let current = state
    for (let tick = 0; tick < ticksPerDay; tick++) {
      const { commands } = runAi(current, ctx)
      for (const command of commands) denker.add(command.playerId)
      current = runTicks(current, 1, ctx, () => commands).state
    }
    expect(denker.size, `nur ${[...denker].join(', ')} haben gedacht`).toBeGreaterThan(1)
  })

  it('sammelt die Ereignisse aller Ticks, statt sie am Ende abzulesen', () => {
    // Voraussetzung fuer T-M14-05: das Ereignisprotokoll im Zustand ist ein Ringpuffer
    // (EVENT_LOG_LIMIT), wer daraus zaehlt, zaehlt zu wenig.
    const result = advanceTicks(stateWith(4), 600, ctx)
    expect(result.events.length).toBeGreaterThan(result.state.eventLog.length)
  })

  it('reicht die Spielerbefehle nur in den ersten Tick', () => {
    // Der erste Spieler ist hier ein Mensch: sonst baut die KI in seiner Provinz mit, und
    // der Test zählte ihre Bauten als Wiederholung seines Befehls.
    const state = stateWith(2)
    state.players[state.playerOrder[0]!]!.kind = 'human'
    const eigen = state.playerOrder[0]!
    const provinz = state.provinceOrder.find((id) => state.provinces[id]!.owner === eigen)!
    const befehl = {
      type: 'BUILD' as const,
      playerId: eigen,
      provinceId: provinz,
      building: 'barracks',
    } as const satisfies Command

    // Nur die Bauten in genau dieser Provinz zaehlen: die KI-Maechte bauen daneben ihre
    // eigenen, und die haben mit der Frage nichts zu tun.
    const result = advanceTicks(state, 5, ctx, { playerCommands: [befehl] })
    const begonnen = result.events.filter(
      (e) => e.type === 'BUILD_STARTED' && 'provinceId' in e && e.provinceId === provinz,
    )
    expect(begonnen.length, 'derselbe Spielerbefehl darf nicht in jedem Tick wirken').toBe(1)
  })

  it('haelt an, sobald jemand gewonnen hat', () => {
    const state = stateWith(2)
    const zweiter = state.playerOrder[1]!
    for (const id of state.provinceOrder) {
      if (state.provinces[id]!.owner === zweiter) state.provinces[id]!.owner = state.playerOrder[0]!
    }
    const result = advanceTicks(state, 500, ctx)
    expect(result.state.victory.winner).toBe(state.playerOrder[0])
    // Die Schleife laeuft nicht weiter, nachdem die Partie entschieden ist.
    expect(result.ticks).toBeLessThan(500)
  })

  it('liefert denselben Zustand wie die bisherige Schleife der Anwendung', () => {
    // Gleichstand: die neue gemeinsame Funktion ist genau das, was advance() tat.
    const alt = (() => {
      let current = stateWith(3)
      for (let i = 0; i < 40; i++) {
        if (current.victory.winner !== null) break
        const { commands, memories } = runAi(current, ctx)
        current = runTicks(current, 1, ctx, () => commands).state
        storeMemories(current, memories)
      }
      return current
    })()

    const neu = advanceTicks(stateWith(3), 40, ctx).state
    expect(stateHash(neu)).toBe(stateHash(alt))
  })

  it('setzt einen gespeicherten Stand mit KI bitgleich fort (R-AI-07/AK1)', () => {
    // Befund N2: das KI-Gedaechtnis ist Teil des Spielstands, aber keine Pruefung fuhr
    // je Speichern-Laden-Weiterspielen MIT Befehlsquelle. storeMemories schreibt
    // ausserhalb der Tick-Pipeline in den Zustand — genau dort kann etwas verloren gehen.
    const durchgehend = advanceTicks(stateWith(3), 50, ctx).state

    const haelfte = advanceTicks(stateWith(3), 25, ctx).state
    const geladen = deserialise(serialise(haelfte))
    const fortgesetzt = advanceTicks(geladen, 25, ctx).state

    expect(stateHash(fortgesetzt)).toBe(stateHash(durchgehend))
  })
})
