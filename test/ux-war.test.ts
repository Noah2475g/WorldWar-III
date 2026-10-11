import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as core from '@worldwar/core'
import * as ai from '@worldwar/ai'
import type { MapData } from '@worldwar/core'
import { TEST_RULES } from '@worldwar/testkit'
import { describe, expect, it } from 'vitest'
import { DEFAULT_NEW_GAME, startGame } from '../apps/desktop/src/game/newGame'
import { forceWarDeclaration } from '../scripts/lib/ux-war.mjs'

/**
 * T-M44-03 (Folgefall von R-UX-05/AK4): eine KI-Macht erklärt dem Betrachter wirklich den
 * Krieg, erzwungen über das echte Entscheidungstor der KI (Verstimmung), nicht über einen
 * vorgetäuschten Spielstand.
 *
 * Gefahren wird dieselbe Funktion, die `scripts/ux-capture.mjs` in die Seite schicken wird —
 * gegen den echten Kern, die echte KI (`@worldwar/ai`) und die echte Weltkarte.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const map = JSON.parse(readFileSync(`${ROOT}/data/maps/world.json`, 'utf8')) as MapData
const rules = TEST_RULES
const state = startGame({ ...DEFAULT_NEW_GAME, nation: 'Deutschland', seed: 7, victory: 'points' }, map, rules)
const humanId = Object.values(state.players).find((p) => p.kind === 'human')!.id
const aiCount = state.playerOrder.filter((id) => state.players[id]!.kind === 'ai' && state.players[id]!.alive).length

describe('T-M44-03 ux-war: eine KI-Macht erklärt dem Betrachter wirklich den Krieg', () => {
  it('findet einen Landnachbarn im Frieden und erzwingt die Kriegserklärung über die Verstimmung', () => {
    const r = forceWarDeclaration(core, ai, map, rules, state, humanId)
    expect(r.real, r.reason ?? 'kein Kandidat gefunden').toBe(true)
    expect(r.attacker).not.toBeNull()
    // Der Kandidat ist wirklich eine lebende KI-Macht, kein erfundener Wert.
    expect(state.players[r.attacker!]?.kind).toBe('ai')
    expect(state.players[r.attacker!]?.alive).toBe(true)
  })

  it('verändert den Ausgangsstand nicht (Kopie)', () => {
    const before = JSON.stringify(state)
    forceWarDeclaration(core, ai, map, rules, state, humanId)
    expect(JSON.stringify(state), 'der Ausgangsstand bleibt, wie er war').toBe(before)
  })

  it('bringt den echten Kern über echte Ticks dazu, WAR_DECLARED gegen den Betrachter zu melden', () => {
    const r = forceWarDeclaration(core, ai, map, rules, state, humanId)
    expect(r.real).toBe(true)

    // Spätestens nach `aiCount` echten Ticks hat die angreifende KI-Macht mindestens einmal
    // gedacht (`shouldThinkThisTick`, `decide.ts` Zeile 153-156) — kein Mock, echter Kern.
    const result = ai.advanceTicks(r.next, Math.max(1, aiCount), { map, rules })
    const warDeclared = result.events.some(
      (event: { type: string; targetPlayerId?: string }) =>
        event.type === 'WAR_DECLARED' && event.targetPlayerId === humanId,
    )
    expect(warDeclared, 'echtes WAR_DECLARED-Ereignis gegen den Betrachter nach echten Ticks').toBe(true)
  })

  it('Gegenprobe: ohne gesetzte Verstimmung entsteht im selben Zeitfenster kein WAR_DECLARED gegen den Betrachter', () => {
    const result = ai.advanceTicks(state, Math.max(1, aiCount), { map, rules })
    const warDeclared = result.events.some(
      (event: { type: string; targetPlayerId?: string }) =>
        event.type === 'WAR_DECLARED' && event.targetPlayerId === humanId,
    )
    expect(warDeclared, 'ohne Verstimmung erklärt im selben Zeitfenster niemand den Krieg').toBe(false)
  })

  it('erzwingt WAR_DECLARED binnen aiCount Ticks auch dann, wenn die Strategie-Zeitsperre der KI schon lief (spaeter Spielstand wie ein echtes `stand-1`)', () => {
    // 48 echte Ticks vorlaufen lassen: jede KI hat laengst einmal strategisch gedacht,
    // `lastStrategicTick` ist fuer alle nicht mehr -1 (Befund t_0ff9f671: ein frischer
    // Spielstand bestand den Test oben schon, ein spaeter — wie `stand-1` in `ux-capture.mjs` — nicht).
    const late = ai.advanceTicks(state, 48, { map, rules }).state
    const r = forceWarDeclaration(core, ai, map, rules, late, humanId)
    expect(r.real, r.reason ?? 'kein Kandidat gefunden').toBe(true)

    const result = ai.advanceTicks(r.next, Math.max(1, aiCount), { map, rules })
    const warDeclared = result.events.some(
      (event: { type: string; targetPlayerId?: string }) =>
        event.type === 'WAR_DECLARED' && event.targetPlayerId === humanId,
    )
    expect(warDeclared, 'WAR_DECLARED auch nach bereits gelaufener Strategie-Zeitsperre binnen aiCount Ticks').toBe(true)
  })
})
