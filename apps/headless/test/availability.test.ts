import { advanceTicks } from '@worldwar/ai'
import { createInitialState } from '@worldwar/core'
import { TEST_RULES, smallWorld } from '@worldwar/testkit'
import { describe, expect, it } from 'vitest'

/**
 * Die Freischaltung im laufenden Spiel (T-M15-03, R-TECH-02/AK2).
 *
 * Die Einzeltests in `packages/ai/src/economy.test.ts` prüfen die Auswahl; dieser prüft
 * das Ergebnis. Der Unterschied ist der, den dieses Projekt schon zweimal teuer gelernt
 * hat: eine Funktion kann richtig wählen und ihr Aufrufer trotzdem daneben liegen — der
 * Anteil abgelehnter KI-Befehle lag bei 57 %, während jeder Einzeltest grün war
 * (T-M14-11). Gezählt wird deshalb aus dem Ereignisstrom eines echten Laufs.
 */

const map = smallWorld()
const ctx = { map, rules: TEST_RULES }

const CONFIG = {
  seed: 8080,
  mapId: 'testworld',
  rulesId: 'default',
  players: [
    { name: 'Eins', kind: 'ai' as const, nation: 'Nordland', color: '#0f62bc', difficulty: 'hard' as const },
    { name: 'Zwei', kind: 'ai' as const, nation: 'Ostmark', color: '#b03a2e', difficulty: 'normal' as const },
    { name: 'Drei', kind: 'ai' as const, nation: 'Sueden', color: '#2e7d32', difficulty: 'easy' as const },
  ],
  victory: { condition: 'points' as const, pointsShareToWin: 900, dayLimit: null },
}

describe('R-TECH-02/AK2 Die KI erzeugt keine Befehle, die der Tag verbietet', () => {
  it('sechzig Spieltage ohne eine einzige Ablehnung NOT_YET_AVAILABLE', () => {
    const state = createInitialState(CONFIG, ctx)
    const { events } = advanceTicks(state, 60 * TEST_RULES.constants.ticksPerDay, ctx)

    const rejected = events.filter((event) => event.type === 'COMMAND_REJECTED')
    const zuFrueh = rejected.filter((event) => event.code === 'NOT_YET_AVAILABLE')

    // Erst die Zusicherung, dass der Lauf ueberhaupt etwas gemessen hat: eine Zaehlung
    // ueber einer leeren Menge ist immer null, und genau daran sind in diesem Projekt
    // schon drei Waechter gescheitert.
    expect(events.length, 'der Lauf hat nichts gemessen').toBeGreaterThan(100)
    expect(
      rejected.some((event) => event.command === 'BUILD' || event.command === 'RECRUIT') ||
        events.some((event) => event.type === 'BUILD_STARTED'),
      'im Lauf wurde weder gebaut noch ein Bau abgelehnt — die Zaehlung sagt nichts',
    ).toBe(true)

    expect(zuFrueh.length, `Ablehnungen wegen des Spieltags: ${zuFrueh.length}`).toBe(0)
  })
})
